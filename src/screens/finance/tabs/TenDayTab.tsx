import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { formatCurrency } from '@/lib/currencyUtils';
import type { TenDaySet } from '@/lib/financeUtils';
import type { Customer } from '@/types';
import { MONTH_NAMES } from '../financeHelpers';

type SelectedDay = { setNum: number; dayNum: number } | null;

type Entry = { custId: number; subLabel: string; amount: number };

interface TenDayPayables {
  agentCommissionMap: Map<string, Entry>;
  agentTdsMap: Map<string, Entry>;
  slwWorkerMap: Map<string, Entry>;
  agentSettlementInternalByCustomer: Map<number, number>;
  agentSettlementExternal: number;
  totalAgentCommission: number;
  totalAgentTds: number;
  totalSlwWorker: number;
  totalAgentInternal: number;
}

interface TenDayTabProps {
  today: string;
  tenDayYear: number;
  tenDayMonth: number;
  tenDaySets: TenDaySet[];
  tenDayPayables: TenDayPayables;
  selectedDay: SelectedDay;
  setSelectedDay: Dispatch<SetStateAction<SelectedDay>>;
  navigateTenDayMonth: (delta: number) => void;
  getCustomer: (id: number) => Customer | undefined;
}

export function TenDayTab({
  today,
  tenDayYear,
  tenDayMonth,
  tenDaySets,
  tenDayPayables,
  selectedDay,
  setSelectedDay,
  navigateTenDayMonth,
  getCustomer,
}: TenDayTabProps) {
  return (
    <div className="fin-tab-content" onClick={() => setSelectedDay(null)}>
      <div className="td-month-nav">
        <button
          type="button"
          className="td-month-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigateTenDayMonth(-1);
          }}
        >
          &lt;
        </button>
        <span className="td-month-label">
          {MONTH_NAMES[tenDayMonth - 1]} {tenDayYear}
        </span>
        <button
          type="button"
          className="td-month-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigateTenDayMonth(1);
          }}
        >
          &gt;
        </button>
      </div>

      {(() => {
        const mRev = tenDaySets.reduce((s, t) => s + t.totalRevenue, 0);
        const mCom = tenDaySets.reduce((s, t) => s + t.totalCommission, 0);
        const mSlw = tenDaySets.reduce((s, t) => s + t.totalSlwNetProfit, 0);
        const mAgent = tenDaySets.reduce((s, t) => s + t.totalAgentNetProfit, 0);
        const mExp = tenDaySets.reduce((s, t) => s + t.totalExpenses, 0);
        const mNet = tenDaySets.reduce((s, t) => s + t.totalNetProfit, 0);
        const mCards = tenDaySets.reduce((s, t) => s + t.totalCards, 0);
        const totalPayables =
          tenDayPayables.totalSlwWorker +
          tenDayPayables.totalAgentInternal +
          tenDayPayables.agentSettlementExternal;

        return (
          <div className="td-summary-row">
            <div className="td-sum-card">
              <div className="td-sum-card-hd">
                <span className="td-sum-card-title">Month Total</span>
                <span className="td-sum-card-period">
                  {MONTH_NAMES[tenDayMonth - 1]} {tenDayYear}
                </span>
              </div>
              <div className="td-sum-stats">
                <div className="td-sum-stat">
                  <span className="td-sum-stat-lbl">Revenue</span>
                  <span className="td-sum-stat-val">{formatCurrency(mRev)}</span>
                </div>
                <div className="td-sum-stat">
                  <span className="td-sum-stat-lbl">Commission Out</span>
                  <span className="td-sum-stat-val color-muted">-{formatCurrency(mCom)}</span>
                </div>
                {mExp > 0 && (
                  <div className="td-sum-stat td-sum-stat--wide">
                    <span className="td-sum-stat-lbl">Expenses</span>
                    <span className="td-sum-stat-val color-red">-{formatCurrency(mExp)}</span>
                  </div>
                )}
                <div className="td-sum-stat td-sum-stat--wide">
                  <span className="td-sum-stat-lbl">Net Profit</span>
                  <span className={`td-sum-stat-val${mNet >= 0 ? ' color-green' : ' color-red'}`}>
                    {formatCurrency(mNet)}
                  </span>
                </div>
                <div className="td-sum-stat">
                  <span className="td-sum-stat-lbl">Cards</span>
                  <span className="td-sum-stat-val">{mCards}</span>
                </div>
              </div>
              <div className="td-sum-breakdown">
                <div className="td-sum-brk">
                  <span className="td-sum-brk-lbl">SLW Work</span>
                  <span className="td-sum-brk-val">{formatCurrency(mSlw)}</span>
                </div>
                <div className="td-sum-brk-sep" />
                <div className="td-sum-brk">
                  <span className="td-sum-brk-lbl">Agent / Ext DC</span>
                  <span className="td-sum-brk-val">{formatCurrency(mAgent)}</span>
                </div>
              </div>
            </div>

            <div className="td-sum-card">
              <div className="td-sum-card-hd">
                <span className="td-sum-card-title">Commission &amp; Payables</span>
                <span className="td-sum-card-period">
                  {MONTH_NAMES[tenDayMonth - 1]} {tenDayYear}
                </span>
              </div>
              <div className="td-com-body">
                {(() => {
                  const entryLabel = (custId: number, sub: string) => {
                    const cust = getCustomer(custId);
                    const base = cust?.shortCode
                      ? cust.shortCode.toUpperCase()
                      : (cust?.name ?? `#${custId}`);
                    return sub ? `${base} - ${sub}` : base;
                  };
                  const commEntries = Array.from(tenDayPayables.agentCommissionMap.values()).filter(
                    (e) => e.amount > 0 && getCustomer(e.custId)?.hasCommission
                  );
                  const tdsEntries = Array.from(tenDayPayables.agentTdsMap.values()).filter(
                    (e) => e.amount > 0 && getCustomer(e.custId)?.hasCommission
                  );

                  return (
                    <div className="td-com-col td-com-col--in">
                      <div className="td-com-col-hd">Receivable</div>
                      <div className="td-com-subhd">Namakku Commission</div>
                      {commEntries.map((e) => (
                        <div key={`comm-${e.custId}|${e.subLabel}`} className="td-com-row">
                          <span>{entryLabel(e.custId, e.subLabel)}</span>
                          <span>{formatCurrency(e.amount)}</span>
                        </div>
                      ))}
                      <div className="td-com-subhd td-com-subhd--tds">TDS Collected</div>
                      {tdsEntries.map((e) => (
                        <div
                          key={`tds-${e.custId}|${e.subLabel}`}
                          className="td-com-row td-com-row--tds"
                        >
                          <span>{entryLabel(e.custId, e.subLabel)}</span>
                          <span>{formatCurrency(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="td-com-vsep" />

                {(() => {
                  const entryLabel = (custId: number, sub: string) => {
                    const cust = getCustomer(custId);
                    const base = cust?.shortCode
                      ? cust.shortCode.toUpperCase()
                      : (cust?.name ?? `#${custId}`);
                    return sub ? `${base} - ${sub}` : base;
                  };
                  const workerEntries = Array.from(tenDayPayables.slwWorkerMap.values()).filter(
                    (e) => e.amount > 0 && getCustomer(e.custId)?.hasCommission
                  );
                  const internalEntries = Array.from(
                    tenDayPayables.agentSettlementInternalByCustomer.entries()
                  ).filter(([custId, amt]) => amt > 0 && getCustomer(custId)?.hasCommission);

                  return (
                    <div className="td-com-col td-com-col--out">
                      <div className="td-com-col-hd">To Pay</div>
                      <div className="td-com-subhd">Worker - SLW Work</div>
                      {workerEntries.map((e) => (
                        <div key={`slw-${e.custId}|${e.subLabel}`} className="td-com-row">
                          <span>{entryLabel(e.custId, e.subLabel)}</span>
                          <span>{formatCurrency(e.amount)}</span>
                        </div>
                      ))}
                      <div className="td-com-subhd">Full Commission DC</div>
                      {internalEntries.map(([custId, amt]) => {
                        const cust = getCustomer(custId);
                        const lbl = cust?.shortCode
                          ? cust.shortCode.toUpperCase()
                          : (cust?.name ?? `#${custId}`);
                        return (
                          <div key={`int-${custId}`} className="td-com-row">
                            <span>{lbl}</span>
                            <span>{formatCurrency(amt)}</span>
                          </div>
                        );
                      })}
                      {tenDayPayables.agentSettlementExternal > 0 && (
                        <div className="td-com-row">
                          <span className="td-com-subhd" style={{ marginTop: 0 }}>
                            Leaf Cut Bhai
                          </span>
                          <span>{formatCurrency(tenDayPayables.agentSettlementExternal)}</span>
                        </div>
                      )}
                      <div className="td-com-total">
                        <span>Total Payables</span>
                        <span>{formatCurrency(totalPayables)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="fin-table-tile">
        <div className="fin-chart-title">
          Daily Net Profit - {MONTH_NAMES[tenDayMonth - 1]} {tenDayYear}
        </div>
        <div className="td-daily-3col">
          {tenDaySets.map((set) => {
            const maxDayNet = Math.max(...set.days.map((d) => Math.max(0, d.netProfit)), 1);
            return (
              <div key={set.setNumber} className="td-daily-col">
                <div className="td-daily-col-hd">
                  <span className="td-daily-col-set">Set {set.setNumber}</span>
                  <span className="td-daily-col-range">
                    {new Date(`${set.fromDate}T00:00:00`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    {' - '}
                    {new Date(`${set.toDate}T00:00:00`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <div className="td-daily-col-body">
                  {set.days.map((day) => (
                    <div
                      key={day.dayNum}
                      className={`td-daily-row${day.netProfit === 0 ? ' is-zero' : ''}${day.date === today ? ' is-today' : ''}`}
                    >
                      <span className="td-daily-daynum">{day.dayNum}</span>
                      <div className="td-daily-bar-wrap">
                        <div
                          className="td-daily-bar"
                          style={
                            {
                              '--pct': `${(Math.max(0, day.netProfit) / maxDayNet) * 100}%`,
                            } as CSSProperties
                          }
                        />
                      </div>
                      <span className="td-daily-amount">
                        {formatCurrency(Math.max(0, day.netProfit))}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="td-daily-col-footer">
                  <span className="td-daily-footer-label">Net Profit</span>
                  <span className="td-daily-footer-val color-green">
                    {formatCurrency(set.totalNetProfit)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="td-sets-row">
        {tenDaySets.map((set) => {
          const maxRev = Math.max(...set.days.map((d) => d.revenue), 1);
          const activeDay =
            selectedDay?.setNum === set.setNumber
              ? (set.days.find((d) => d.dayNum === selectedDay.dayNum) ?? null)
              : null;

          return (
            <div key={set.setNumber} className="td-set-card" onClick={(e) => e.stopPropagation()}>
              <div className="td-set-header">
                <span className="td-set-title">{set.label}</span>
                <div className="td-set-header-badges">
                  {today >= set.fromDate && today <= set.toDate && (
                    <span className="td-set-current-badge">Current</span>
                  )}
                  <span className="td-set-badge">{set.totalCards} cards</span>
                </div>
              </div>

              <div className="td-vbar-wrap">
                <div className="td-vbar-chart">
                  {set.days.map((day) => {
                    const isSelected =
                      selectedDay?.setNum === set.setNumber && selectedDay?.dayNum === day.dayNum;
                    return (
                      <div
                        key={day.dayNum}
                        className="td-vbar-col"
                        role="button"
                        tabIndex={0}
                        aria-label={`Day ${day.dayNum}: ${formatCurrency(day.revenue)}`}
                        onClick={() => {
                          setSelectedDay(
                            isSelected ? null : { setNum: set.setNumber, dayNum: day.dayNum }
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedDay(
                              isSelected ? null : { setNum: set.setNumber, dayNum: day.dayNum }
                            );
                          }
                        }}
                      >
                        <div
                          className={`td-vbar-bar${day.revenue === 0 ? ' td-vbar-bar--empty' : ''}${isSelected ? ' td-vbar-bar--selected' : ''}`}
                          style={
                            {
                              '--bar-height': `${Math.max((day.revenue / maxRev) * 72, day.revenue > 0 ? 4 : 1)}px`,
                            } as CSSProperties
                          }
                        />
                        <span className="td-vbar-label">{day.dayNum}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeDay && (
                <div className="td-day-detail">
                  <div className="td-day-detail-header">
                    <span className="td-day-detail-title">
                      {new Date(`${activeDay.date}T00:00:00`).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <button
                      type="button"
                      className="td-day-detail-close"
                      onClick={() => setSelectedDay(null)}
                      aria-label="Close"
                    >
                      x
                    </button>
                  </div>
                  <div className="td-day-detail-grid">
                    <div className="td-day-detail-item">
                      <span>Revenue</span>
                      <span>{formatCurrency(activeDay.revenue)}</span>
                    </div>
                    <div className="td-day-detail-item">
                      <span>Commission</span>
                      <span className="color-muted">{formatCurrency(activeDay.commission)}</span>
                    </div>
                    <div className="td-day-detail-item">
                      <span>SLW Work</span>
                      <span>{formatCurrency(activeDay.slwNetProfit)}</span>
                    </div>
                    <div className="td-day-detail-item">
                      <span>Agent / Ext DC</span>
                      <span>{formatCurrency(activeDay.agentNetProfit)}</span>
                    </div>
                    {activeDay.expenses > 0 && (
                      <div className="td-day-detail-item">
                        <span>Expenses</span>
                        <span className="color-red">-{formatCurrency(activeDay.expenses)}</span>
                      </div>
                    )}
                    <div className="td-day-detail-item">
                      <span>Net Profit</span>
                      <span className={activeDay.netProfit >= 0 ? 'color-green' : 'color-red'}>
                        {formatCurrency(activeDay.netProfit)}
                      </span>
                    </div>
                    <div className="td-day-detail-item">
                      <span>Cards</span>
                      <span>{activeDay.cards}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="td-set-stats">
                <div className="td-stat-row">
                  <span className="td-stat-key">Revenue</span>
                  <span className="td-stat-val">{formatCurrency(set.totalRevenue)}</span>
                </div>
                <div className="td-stat-row">
                  <span className="td-stat-key">Commission</span>
                  <span className="td-stat-val color-muted">
                    {formatCurrency(set.totalCommission)}
                  </span>
                </div>
                <div className="td-stat-divider" />
                <div className="td-stat-row">
                  <span className="td-stat-key">SLW Work</span>
                  <span className="td-stat-val">{formatCurrency(set.totalSlwNetProfit)}</span>
                </div>
                <div className="td-stat-row">
                  <span className="td-stat-key">Agent / Ext DC</span>
                  <span className="td-stat-val">{formatCurrency(set.totalAgentNetProfit)}</span>
                </div>
                {set.totalExpenses > 0 && (
                  <>
                    <div className="td-stat-divider" />
                    <div className="td-stat-row">
                      <span className="td-stat-key">Expenses</span>
                      <span className="td-stat-val color-red">
                        -{formatCurrency(set.totalExpenses)}
                      </span>
                    </div>
                  </>
                )}
                <div className="td-stat-divider" />
                <div className="td-stat-row td-stat-row--total">
                  <span className="td-stat-key">Net Profit</span>
                  <span
                    className={`td-stat-val${set.totalNetProfit >= 0 ? ' color-green' : ' color-red'}`}
                  >
                    {formatCurrency(set.totalNetProfit)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
