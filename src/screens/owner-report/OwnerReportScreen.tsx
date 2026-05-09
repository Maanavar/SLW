import { useEffect, useMemo, useRef, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useCommissionWorkersQuery } from '@/hooks/useCommissionWorkersQuery';
import { useCommissionPaymentsQuery } from '@/hooks/useCommissionPaymentsQuery';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import {
  getJobAgentCommissionIncome,
  getJobAgentNetPayable,
  isAgentWorkJob,
} from '@/lib/jobUtils';
import { calculateRevenueMetrics, calculateWorkerCommissionSummary } from '@/lib/financeUtils';
import { useToast } from '@/hooks/useToast';
import './OwnerReportScreen.css';

// â”€â”€â”€ Light theme tokens for PNG export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LIGHT_VARS: Record<string, string> = {
  '--bg': '#eef0f8',
  '--bg-elev': '#ffffff',
  '--bg-sunk': '#e2e5f0',
  '--bg-hover': '#d8dcea',
  '--border': '#c8cde2',
  '--border-strong': '#b6bdd4',
  '--text': '#181a2c',
  '--text-muted': '#535870',
  '--text-faint': '#8489a6',
  '--accent': 'oklch(0.50 0.19 265)',
  '--accent-soft': 'oklch(0.93 0.04 265)',
  '--accent-border': 'oklch(0.82 0.09 265)',
  '--accent-text': 'oklch(0.36 0.19 265)',
  '--green': 'oklch(0.55 0.14 150)',
  '--green-soft': 'oklch(0.93 0.05 150)',
  '--green-border': 'oklch(0.82 0.09 150)',
  '--amber': 'oklch(0.67 0.15 75)',
  '--amber-soft': 'oklch(0.94 0.06 75)',
  '--amber-border': 'oklch(0.83 0.10 75)',
  '--red': 'oklch(0.55 0.20 25)',
  '--red-soft': 'oklch(0.94 0.04 25)',
  '--red-border': 'oklch(0.84 0.08 25)',
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getMonthRange(year: number, month: number) {
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

function getMonthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

const EXPENSE_LABEL: Record<string, string> = {
  EB: 'EB (Electricity)',
  Rent: 'Rent',
  Salary: 'Salary',
  Material: 'Material',
  Fuel: 'Fuel',
  Union: 'Union',
  Other: 'Other',
};

// â”€â”€â”€ Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function OwnerReportScreen() {
  const { jobs, expenses, ensureRangeLoaded } = useDataStore();
  const { data: commissionWorkers = [] } = useCommissionWorkersQuery();
  const { data: commissionPayments = [] } = useCommissionPaymentsQuery();
  const reportRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const todayDate = new Date();
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth() + 1);

  const today = getLocalDateString();

  const { start: periodStart, end: periodEnd } = useMemo(
    () => getMonthRange(year, month),
    [year, month]
  );
  const monthLabel = useMemo(() => getMonthLabel(year, month), [year, month]);

  useEffect(() => {
    void ensureRangeLoaded({ from: periodStart, to: periodEnd });
  }, [ensureRangeLoaded, periodEnd, periodStart]);

  const monthJobs = useMemo(
    () => jobs.filter((j) => j.date >= periodStart && j.date <= periodEnd),
    [jobs, periodStart, periodEnd]
  );

  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.date >= periodStart && e.date <= periodEnd),
    [expenses, periodStart, periodEnd]
  );

  const metrics = useMemo(
    () => calculateRevenueMetrics(jobs, expenses, { from: periodStart, to: periodEnd }),
    [jobs, expenses, periodStart, periodEnd]
  );

  // Per-worker commission split into paid and unpaid buckets for selected month
  const workerCommissionRows = useMemo(() => {
    const summary = calculateWorkerCommissionSummary(
      jobs,
      commissionPayments,
      commissionWorkers,
      { from: periodStart, to: periodEnd }
    );

    return summary
      .map((row) => {
        const due = Math.max(0, row.totalDue || 0);
        const paid = Math.min(due, Math.max(0, row.totalPaid || 0));
        const unpaid = Math.max(0, due - paid);
        return { name: row.workerName || 'Others', paid, unpaid, due };
      })
      .filter((row) => row.due > 0);
  }, [jobs, commissionPayments, commissionWorkers, periodStart, periodEnd]);

  const workerCommissionsPaid = useMemo(
    () =>
      workerCommissionRows
        .filter((row) => row.paid > 0)
        .sort((a, b) => b.paid - a.paid)
        .map((row) => ({ name: row.name, amount: row.paid })),
    [workerCommissionRows]
  );

  const workerCommissionsUnpaid = useMemo(
    () =>
      workerCommissionRows
        .filter((row) => row.unpaid > 0)
        .sort((a, b) => b.unpaid - a.unpaid)
        .map((row) => ({ name: row.name, amount: row.unpaid })),
    [workerCommissionRows]
  );

  // Agent work: commission received by SLW + amount payable back to agent — grouped by agentName
  const agentSummaries = useMemo(() => {
    const map = new Map<string, { commissionReceived: number; payableToAgent: number }>();
    for (const job of monthJobs) {
      if (!isAgentWorkJob(job)) continue;
      const name = (job.agentName || '').trim() || 'Unknown Agent';
      const entry = map.get(name) ?? { commissionReceived: 0, payableToAgent: 0 };
      entry.commissionReceived += getJobAgentCommissionIncome(job);
      entry.payableToAgent += getJobAgentNetPayable(job);
      map.set(name, entry);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].commissionReceived - a[1].commissionReceived)
      .map(([name, data]) => ({ name, ...data }));
  }, [monthJobs]);

  const totalAgentCommissionReceived = agentSummaries.reduce((s, r) => s + r.commissionReceived, 0);
  const totalAgentPayable = agentSummaries.reduce((s, r) => s + r.payableToAgent, 0);
  const hasAgentWork = agentSummaries.length > 0;

  // Expense breakdown by category
  const expenseRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthExpenses) {
      const cat = e.category || 'Other';
      map.set(cat, (map.get(cat) || 0) + e.amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({ cat, amount }));
  }, [monthExpenses]);

  const totalWorkerCommissionPaid = workerCommissionsPaid.reduce((s, r) => s + r.amount, 0);
  const totalWorkerCommissionUnpaid = workerCommissionsUnpaid.reduce((s, r) => s + r.amount, 0);
  const isCurrentMonth =
    year === todayDate.getFullYear() && month === todayDate.getMonth() + 1;

  // â”€â”€ PNG export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const renderPngBlob = async (sourceNode: HTMLDivElement): Promise<Blob> => {
    const host = document.createElement('div');
    host.style.cssText =
      'position:fixed;left:-100000px;top:0;opacity:0;pointer-events:none;z-index:-1;margin:0;padding:0;background:#ffffff;';
    for (const [k, v] of Object.entries(LIGHT_VARS)) host.style.setProperty(k, v);

    const clone = sourceNode.cloneNode(true) as HTMLDivElement;
    clone.style.width = '720px';
    clone.style.maxWidth = '720px';
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';
    clone.style.borderRadius = '0';
    host.appendChild(clone);
    document.body.appendChild(host);

    try {
      const w = Math.ceil(clone.scrollWidth || 720);
      const h = Math.ceil(clone.scrollHeight || 1);
      const { toBlob } = await import('html-to-image');
      const blob = await toBlob(clone, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        width: w,
        height: h,
        canvasWidth: w,
        canvasHeight: h,
        pixelRatio: 2,
      });
      if (!blob) throw new Error('PNG generation failed');
      return blob;
    } finally {
      document.body.removeChild(host);
    }
  };

  const handleSharePng = async () => {
    if (!reportRef.current) return;
    try {
      const blob = await renderPngBlob(reportRef.current);
      const fileName = `slw-monthly-audit-${year}-${String(month).padStart(2, '0')}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'SLW Monthly Audit', text: `${monthLabel} Audit — Siva Lathe Works` });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${monthLabel} Audit ready — Siva Lathe Works. PNG downloaded, attach in WhatsApp.`)}`,
        '_blank'
      );
      toast.info('PNG Downloaded', 'Attach the image in WhatsApp.');
    } catch {
      toast.error('Error', 'Failed to generate PNG');
    }
  };

  // â”€â”€ PDF export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleDownloadPdf = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 16;
    let y = 18;

    const getY = () => (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;

    // â”€â”€ Header â”€â”€
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('Siva Lathe Works', margin, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text('Monthly Audit Report', pageW - margin, y, { align: 'right' });
    y += 7;
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.setFont('helvetica', 'bold');
    doc.text(monthLabel, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generated: ${today}`, pageW - margin, y, { align: 'right' });
    y += 5;
    doc.setDrawColor(210);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    const addMetricRow = (tamil: string, english: string, value: number, highlight = false) => {
      if (highlight) {
        doc.setFillColor(17, 20, 30);
        doc.rect(margin, y - 5, pageW - margin * 2, 14, 'F');
        doc.setTextColor(255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(tamil, margin + 3, y + 4);
        doc.text(formatCurrency(value), pageW - margin - 3, y + 4, { align: 'right' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(200);
        doc.text(english, margin + 3, y + 9);
        y += 19;
        doc.setTextColor(40);
      } else {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40);
        doc.text(tamil, margin, y);
        doc.text(formatCurrency(value), pageW - margin, y, { align: 'right' });
        y += 5;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120);
        doc.text(english, margin, y);
        y += 7;
        doc.setDrawColor(225);
        doc.line(margin, y, pageW - margin, y);
        y += 6;
        doc.setTextColor(40);
      }
    };

    const addSectionHeader = (tamil: string, english: string, total?: string) => {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40);
      doc.text(tamil, margin, y);
      if (total) doc.text(total, pageW - margin, y, { align: 'right' });
      y += 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      doc.text(english, margin, y);
      y += 5;
    };

    // 1. Total Revenue
    addMetricRow('மாத வருமானம்', 'Total Revenue — All billed work this month', metrics.totalRevenue);
    // 2. Worker Commission (Paid)
    addSectionHeader('கமிஷன் கொடுத்தது', 'Commission Paid to Workers', formatCurrency(totalWorkerCommissionPaid));

    if (workerCommissionsPaid.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Worker', 'Commission']],
        body: [
          ...workerCommissionsPaid.map((r) => [r.name, formatCurrency(r.amount)]),
          ['Total', formatCurrency(totalWorkerCommissionPaid)],
        ],
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [50, 50, 75], textColor: 255 },
        bodyStyles: { textColor: [40, 40, 40] },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (data) => {
          if (data.row.index === workerCommissionsPaid.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [235, 235, 248];
          }
        },
      });
      y = getY() + 6;
    } else {
      doc.setTextColor(160);
      doc.setFontSize(8);
      doc.text('No paid commission entries this month', margin, y);
      y += 8;
    }

    // 2b. Worker Commission (Unpaid)
    addSectionHeader(
      'கமிஷன் கொடுக்கவேண்டியது',
      'Commission to be paid to Workers',
      formatCurrency(totalWorkerCommissionUnpaid)
    );

    if (workerCommissionsUnpaid.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Worker', 'Commission']],
        body: [
          ...workerCommissionsUnpaid.map((r) => [r.name, formatCurrency(r.amount)]),
          ['Total', formatCurrency(totalWorkerCommissionUnpaid)],
        ],
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [140, 70, 30], textColor: 255 },
        bodyStyles: { textColor: [40, 40, 40] },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (data) => {
          if (data.row.index === workerCommissionsUnpaid.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 243, 233];
          }
        },
      });
      y = getY() + 6;
    } else {
      doc.setTextColor(160);
      doc.setFontSize(8);
      doc.text('No unpaid commission entries this month', margin, y);
      y += 8;
    }

    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // 3. Agent Work (if any)
    if (hasAgentWork) {
      addSectionHeader('CommissionDC & Leafcut', 'Commission Received by SLW + Amount Paid to Agents');

      // Commission received table
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 100, 50);
      doc.text('Commission Received by SLW (நமக்கு வந்தது)', margin, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['Agent', 'Commission Received']],
        body: [
          ...agentSummaries.map((r) => [r.name, formatCurrency(r.commissionReceived)]),
          ['Total', formatCurrency(totalAgentCommissionReceived)],
        ],
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 100, 50], textColor: 255 },
        bodyStyles: { textColor: [40, 40, 40] },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (data) => {
          if (data.row.index === agentSummaries.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [230, 248, 235];
          }
        },
      });
      y = getY() + 5;

      // Payable to agents table
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(150, 30, 30);
      doc.text('Paid / Payable to Agents (அவங்களுக்கு கொடுத்தது)', margin, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['Agent', 'Amount Payable']],
        body: [
          ...agentSummaries.map((r) => [r.name, formatCurrency(r.payableToAgent)]),
          ['Total', formatCurrency(totalAgentPayable)],
        ],
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [150, 50, 50], textColor: 255 },
        bodyStyles: { textColor: [40, 40, 40] },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (data) => {
          if (data.row.index === agentSummaries.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 235, 235];
          }
        },
      });
      y = getY() + 6;

      doc.setDrawColor(220);
      doc.line(margin, y, pageW - margin, y);
      y += 6;
    }

    // 4. Gross Profit
    addMetricRow('நம்ம வருமானம்', 'Gross Profit — Our earnings after paying worker commission', metrics.grossProfit);

    // 5. Expenses
    addSectionHeader('செலவு', 'Monthly Expenses (EB, Rent, Salary…)', formatCurrency(metrics.totalExpenses));

    if (expenseRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Category', 'Amount']],
        body: [
          ...expenseRows.map((r) => [EXPENSE_LABEL[r.cat] || r.cat, formatCurrency(r.amount)]),
          ['Total', formatCurrency(metrics.totalExpenses)],
        ],
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [160, 50, 50], textColor: 255 },
        bodyStyles: { textColor: [40, 40, 40] },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (data) => {
          if (data.row.index === expenseRows.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 240, 240];
          }
        },
      });
      y = getY() + 8;
    } else {
      doc.setTextColor(160);
      doc.setFontSize(8);
      doc.text('No expenses recorded this month', margin, y);
      y += 10;
    }

    // 6. Net Profit
    addMetricRow('செலவு போக மீத வருமானம்', 'Net Profit — After all expenses', metrics.netProfit, true);

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160);
    doc.text(
      `Siva Lathe Works — Monthly Audit — ${monthLabel}`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    );

    doc.save(`slw-monthly-audit-${year}-${String(month).padStart(2, '0')}.pdf`);
    toast.success('PDF Downloaded', `${monthLabel} audit saved.`);
  };

  const handleSharePdf = () => {
    void handleDownloadPdf();
    window.setTimeout(() => {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${monthLabel} Audit — Siva Lathe Works. PDF saved, attach in WhatsApp.`)}`,
        '_blank'
      );
    }, 400);
  };

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="or-screen">
      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside className="or-sidebar">
        <div className="or-sidebar-header">
          <h1 className="or-sidebar-title">Monthly Audit</h1>
          <p className="or-sidebar-sub">Send monthly report to owner</p>
        </div>

        <div className="or-field">
          <label className="or-label">Month</label>
          <div className="or-month-row">
            <select
              className="or-select"
              aria-label="Month"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map(
                (m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                )
              )}
            </select>
            <select
              className="or-select or-year-sel"
              aria-label="Year"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {Array.from({ length: 4 }, (_, i) => todayDate.getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {isCurrentMonth && <p className="or-current-badge">Current month</p>}
        </div>

        <div className="or-quick-grid">
          <div className="or-quick-item">
            <span className="or-quick-label">Revenue</span>
            <span className="or-quick-value">{formatCurrency(metrics.totalRevenue)}</span>
          </div>
          <div className="or-quick-item or-quick-profit">
            <span className="or-quick-label">Net Profit</span>
            <span className={`or-quick-value ${metrics.netProfit < 0 ? 'neg' : ''}`}>{formatCurrency(metrics.netProfit)}</span>
          </div>
        </div>

        <div className="or-actions">
          <p className="or-actions-label">Share via WhatsApp</p>
          <button type="button" className="or-btn or-btn-png" onClick={() => void handleSharePng()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
            Share as Image (PNG)
          </button>
          <button type="button" className="or-btn or-btn-pdf" onClick={() => void handleSharePdf()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Share as PDF
          </button>
          <button type="button" className="or-btn or-btn-dl" onClick={() => void handleDownloadPdf()}>
            Download PDF
          </button>
        </div>
      </aside>

      {/* â”€â”€ Report document â”€â”€ */}
      <div className="or-canvas">
        <div className="or-doc" ref={reportRef}>

          {/* Header */}
          <header className="or-doc-header">
            <div className="or-brand">
              <div className="or-brand-mark" aria-hidden="true">SLW</div>
              <div>
                <p className="or-company-name">SIVA LATHE WORKS</p>
                <p className="or-report-type">Monthly Audit Report</p>
              </div>
            </div>
            <div className="or-header-right">
              <p className="or-month-label">{monthLabel}</p>
              <p className="or-generated">Generated {today}</p>
            </div>
          </header>

          <div className="or-divider" />

          {/* 1. Total Revenue */}
          <div className="or-metric-section or-metric-revenue">
            <div className="or-metric-left">
              <p className="or-metric-tamil">மாத வருமானம்</p>
              <p className="or-metric-english">Total Revenue — All billed work this month</p>
            </div>
            <p className="or-metric-value">{formatCurrency(metrics.totalRevenue)}</p>
          </div>

          <div className="or-divider" />
          {/* 2. Worker Commission (Paid) */}
          <div className="or-section">
            <div className="or-section-head">
              <div>
                <p className="or-metric-tamil">கமிஷன் கொடுத்தது</p>
                <p className="or-metric-english"></p>
              </div>
              <p className="or-section-total">{formatCurrency(totalWorkerCommissionPaid)}</p>
            </div>

            {workerCommissionsPaid.length > 0 ? (
              <table className="or-detail-table">
                <tbody>
                  {workerCommissionsPaid.map((row) => (
                    <tr key={row.name} className="or-detail-row">
                      <td className="or-detail-name">{row.name}</td>
                      <td className="or-detail-amount">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                  <tr className="or-detail-total-row">
                    <td className="or-detail-name">Total</td>
                    <td className="or-detail-amount">{formatCurrency(totalWorkerCommissionPaid)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="or-empty-note">No paid commission entries this month</p>
            )}
          </div>

          <div className="or-divider" />

          {/* 2b. Worker Commission (Unpaid) */}
          <div className="or-section">
            <div className="or-section-head">
              <div>
                <p className="or-metric-tamil">நம்ம வேலை - கமிஷன் கொடுக்கவேண்டியது</p>
                <p className="or-metric-english"></p>
              </div>
              <p className="or-section-total or-section-total-red">{formatCurrency(totalWorkerCommissionUnpaid)}</p>
            </div>

            {workerCommissionsUnpaid.length > 0 ? (
              <table className="or-detail-table">
                <tbody>
                  {workerCommissionsUnpaid.map((row) => (
                    <tr key={row.name} className="or-detail-row">
                      <td className="or-detail-name">{row.name}</td>
                      <td className="or-detail-amount">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                  <tr className="or-detail-total-row">
                    <td className="or-detail-name">Total</td>
                    <td className="or-detail-amount">{formatCurrency(totalWorkerCommissionUnpaid)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="or-empty-note">No unpaid commission entries this month</p>
            )}
          </div>

          <div className="or-divider" />
          {/* 3. Agent Work — only if there are agent work jobs */}
          {hasAgentWork && (
            <>
              <div className="or-section">
                <div className="or-section-head">
                  <div>
                    <p className="or-metric-tamil">கமிஷன்  DC &amp; Leafcut</p>
                    <p className="or-metric-english"></p>
                  </div>
                </div>

                <div className="or-agent-grid">
                  {/* Commission received by SLW */}
                  <div className="or-agent-sub or-agent-income">
                    <p className="or-agent-sub-title">
                      <span className="or-agent-sub-dot or-dot-green" />
                      Commission for us
                      <span className="or-agent-sub-hint">நமக்கு வரவேண்டியது</span>
                    </p>
                    <table className="or-detail-table">
                      <tbody>
                        {agentSummaries.map((row) => (
                          <tr key={row.name} className="or-detail-row">
                            <td className="or-detail-name">{row.name}</td>
                            <td className="or-detail-amount or-amt-green">{formatCurrency(row.commissionReceived)}</td>
                          </tr>
                        ))}
                        <tr className="or-detail-total-row">
                          <td className="or-detail-name">Total</td>
                          <td className="or-detail-amount or-amt-green">{formatCurrency(totalAgentCommissionReceived)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Amount paid / payable to agent */}
                  <div className="or-agent-sub or-agent-payout">
                    <p className="or-agent-sub-title">
                      <span className="or-agent-sub-dot or-dot-red" />
                      Commission DC
                      <span className="or-agent-sub-hint">நாம கொடுக்கவேண்டியது</span>
                    </p>
                    <table className="or-detail-table">
                      <tbody>
                        {agentSummaries.map((row) => (
                          <tr key={row.name} className="or-detail-row">
                            <td className="or-detail-name">{row.name}</td>
                            <td className="or-detail-amount or-amt-red">{formatCurrency(row.payableToAgent)}</td>
                          </tr>
                        ))}
                        <tr className="or-detail-total-row">
                          <td className="or-detail-name">Total</td>
                          <td className="or-detail-amount or-amt-red">{formatCurrency(totalAgentPayable)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="or-divider" />
            </>
          )}

          {/* 4. Gross Profit */}
          <div className="or-metric-section or-metric-gross">
            <div className="or-metric-left">
              <p className="or-metric-tamil">நம்ம வருமானம்</p>
              <p className="or-metric-english">
                Gross Profit — SLW earnings after paying worker commission
              </p>
            </div>
            <p className="or-metric-value">{formatCurrency(metrics.grossProfit)}</p>
          </div>

          <div className="or-divider" />

          {/* 5. Expenses */}
          <div className="or-section">
            <div className="or-section-head">
              <div>
                <p className="or-metric-tamil">செலவு</p>
                <p className="or-metric-english">Monthly Expenses (EB, Rent, Salary…)</p>
              </div>
              <p className="or-section-total or-section-total-red">{formatCurrency(metrics.totalExpenses)}</p>
            </div>

            {expenseRows.length > 0 ? (
              <table className="or-detail-table">
                <tbody>
                  {expenseRows.map((row) => (
                    <tr key={row.cat} className="or-detail-row">
                      <td className="or-detail-name">{EXPENSE_LABEL[row.cat] || row.cat}</td>
                      <td className="or-detail-amount">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                  <tr className="or-detail-total-row">
                    <td className="or-detail-name">Total</td>
                    <td className="or-detail-amount">{formatCurrency(metrics.totalExpenses)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="or-empty-note">No expenses recorded this month</p>
            )}
          </div>

          <div className="or-divider" />

          {/* 6. Net Profit */}
          <div className="or-metric-section or-metric-net">
            <div className="or-metric-left">
              <p className="or-metric-tamil or-metric-tamil-lg">செலவு போக மீத வருமானம்</p>
              <p className="or-metric-english">Net Profit — After paying commission &amp; all expenses</p>
            </div>
            <p className={`or-metric-value or-metric-value-lg ${metrics.netProfit < 0 ? 'or-value-neg' : 'or-value-pos'}`}>
              {formatCurrency(metrics.netProfit)}
            </p>
          </div>

          <footer className="or-doc-footer">
            <p>Siva Lathe Works · Monthly Audit · {monthLabel}</p>
          </footer>
        </div>
      </div>
    </div>
  );
}






