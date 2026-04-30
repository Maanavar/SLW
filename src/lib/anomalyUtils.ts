import type { Customer, Job, Payment } from '@/types';
import { getJobFinalBillValue, getJobNetValue, groupJobsByCard, isAgentWorkJob } from '@/lib/jobUtils';
import { getLocalDateString } from '@/lib/dateUtils';

export interface Anomaly {
  id: string;
  type: 'gross_profit_drop' | 'customer_silent' | 'duplicate' | 'large_job';
  severity: 'warning' | 'info';
  message: string;
  relatedCustomerId?: number;
  detectedAt: string;
}

function getWeekStartDateString(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return getLocalDateString(d);
}

function getWeekBuckets() {
  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - 35);
  start.setHours(0, 0, 0, 0);

  const weeks: Array<{ from: string; to: string }> = [];
  const cursor = new Date(start);
  for (let i = 0; i < 6; i++) {
    const weekStart = getWeekStartDateString(cursor);
    const weekEndDate = new Date(`${weekStart}T00:00:00`);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    weeks.push({ from: weekStart, to: getLocalDateString(weekEndDate) });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function detectAnomalies(jobs: Job[], _payments: Payment[], customers: Customer[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const detectedAt = new Date().toISOString();
  const slwJobs = jobs.filter((job) => !isAgentWorkJob(job));

  const weekBuckets = getWeekBuckets();
  const weeklyGrossProfit = weekBuckets.map((week) =>
    slwJobs
      .filter((job) => job.date >= week.from && job.date <= week.to)
      .reduce((sum, job) => sum + getJobNetValue(job), 0)
  );
  if (weeklyGrossProfit.length >= 5) {
    const thisWeekGrossProfit = weeklyGrossProfit[weeklyGrossProfit.length - 1];
    const previous4 = weeklyGrossProfit.slice(
      Math.max(0, weeklyGrossProfit.length - 5),
      weeklyGrossProfit.length - 1
    );
    const avg4Week = mean(previous4);
    if (avg4Week > 0 && thisWeekGrossProfit < avg4Week * 0.6) {
      const dropPct = Math.round(((avg4Week - thisWeekGrossProfit) / avg4Week) * 100);
      anomalies.push({
        id: `gross_profit_drop_${getLocalDateString(new Date())}`,
        type: 'gross_profit_drop',
        severity: 'warning',
        message: `Gross profit this week is ${dropPct}% below your 4-week average.`,
        detectedAt,
      });
    }
  }

  const jobsByCustomer = new Map<number, Job[]>();
  slwJobs.forEach((job) => {
    if (!jobsByCustomer.has(job.customerId)) {
      jobsByCustomer.set(job.customerId, []);
    }
    jobsByCustomer.get(job.customerId)!.push(job);
  });

  const now = new Date();
  customers
    .filter((customer) => customer.isActive !== false)
    .forEach((customer) => {
      // Deduplicate dates — one entry per calendar day, not per job line.
      // Multi-line cards share the same date and would flood gapDays with
      // zeros, artificially collapsing the median and causing false alerts.
      const uniqueDates = [
        ...new Set(
          (jobsByCustomer.get(customer.id) || [])
            .map((job) => job.date.slice(0, 10))
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b));

      if (uniqueDates.length < 3) {
        return;
      }

      const gapDays: number[] = [];
      for (let i = 1; i < uniqueDates.length; i++) {
        const prev = new Date(`${uniqueDates[i - 1]}T00:00:00`);
        const curr = new Date(`${uniqueDates[i]}T00:00:00`);
        gapDays.push(Math.max(0, Math.floor((curr.getTime() - prev.getTime()) / 86400000)));
      }
      const usualGap = median(gapDays);
      if (usualGap <= 0) {
        return;
      }

      const lastJobDate = new Date(`${uniqueDates[uniqueDates.length - 1]}T00:00:00`);
      const daysSinceLastJob = Math.max(0, Math.floor((now.getTime() - lastJobDate.getTime()) / 86400000));

      // Require at least 14 days of silence AND 1.5× the usual gap before alerting.
      // This prevents false positives for customers who visited recently.
      const silenceThreshold = Math.max(14, usualGap * 1.5);
      if (daysSinceLastJob > silenceThreshold) {
        anomalies.push({
          id: `customer_silent_${customer.id}_${uniqueDates[uniqueDates.length - 1]}`,
          type: 'customer_silent',
          severity: 'info',
          message: `${customer.name} has no jobs for ${daysSinceLastJob} days (usual gap ${Math.round(usualGap)} days).`,
          relatedCustomerId: customer.id,
          detectedAt,
        });
      }
    });

  const groupedCards = groupJobsByCard(slwJobs);
  groupedCards.forEach((cardGroup) => {
    const sameCardLines = cardGroup.jobs;
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    sameCardLines.forEach((line) => {
      const signature = `${line.workTypeName.toLowerCase()}|${Number(line.amount) || 0}`;
      if (seen.has(signature)) {
        duplicates.add(signature);
      } else {
        seen.add(signature);
      }
    });
    if (duplicates.size > 0) {
      const cardId = cardGroup.primary.jobCardId || `LEGACY-${cardGroup.primary.id}`;
      anomalies.push({
        id: `duplicate_${cardId}_${cardGroup.primary.date}`,
        type: 'duplicate',
        severity: 'warning',
        message: `Possible duplicate job line found on card ${cardId}.`,
        relatedCustomerId: cardGroup.primary.customerId,
        detectedAt,
      });
    }
  });

  const cardTotalsByCustomer = new Map<number, number[]>();
  groupedCards.forEach((cardGroup) => {
    const total = cardGroup.jobs.reduce((sum, line) => sum + getJobFinalBillValue(line), 0);
    if (!cardTotalsByCustomer.has(cardGroup.primary.customerId)) {
      cardTotalsByCustomer.set(cardGroup.primary.customerId, []);
    }
    cardTotalsByCustomer.get(cardGroup.primary.customerId)!.push(total);
  });

  groupedCards.forEach((cardGroup) => {
    const customerCardTotals = cardTotalsByCustomer.get(cardGroup.primary.customerId) || [];
    if (customerCardTotals.length < 5) {
      return;
    }
    const threshold = mean(customerCardTotals) + 2 * stdDev(customerCardTotals);
    const cardTotal = cardGroup.jobs.reduce((sum, line) => sum + getJobFinalBillValue(line), 0);
    if (cardTotal > threshold) {
      const customerName =
        customers.find((customer) => customer.id === cardGroup.primary.customerId)?.name || 'Customer';
      const cardId = cardGroup.primary.jobCardId || `LEGACY-${cardGroup.primary.id}`;
      anomalies.push({
        id: `large_job_${cardId}`,
        type: 'large_job',
        severity: 'info',
        message: `Job ${cardId} for ${customerName} looks unusually large (₹${Math.round(cardTotal).toLocaleString('en-IN')}).`,
        relatedCustomerId: cardGroup.primary.customerId,
        detectedAt,
      });
    }
  });

  return anomalies
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'warning' ? -1 : 1;
      return a.message.localeCompare(b.message);
    })
    .slice(0, 12);
}
