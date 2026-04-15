/**
 * StatCard Component
 * Display statistics on dashboard with title and value
 * Supports breakdown tooltip on hover for detailed breakdowns
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import './StatCard.css';

export interface PaymentBreakdown {
  cash?: number;
  upi?: number;
  bank?: number;
  cheque?: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
  breakdown?: PaymentBreakdown;
}

export function StatCard({ title, value, subtitle, icon, className = '', breakdown }: StatCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const hasBreakdown = breakdown && (breakdown.cash || breakdown.upi || breakdown.bank || breakdown.cheque);

  return (
    <div
      className={`stat-card ${className} ${hasBreakdown ? 'stat-card-hoverable' : ''}`}
      onMouseEnter={() => hasBreakdown && setShowBreakdown(true)}
      onMouseLeave={() => setShowBreakdown(false)}
    >
      <div className="stat-card-header">
        <h3 className="stat-card-title">{title}</h3>
        {icon && <div className="stat-card-icon">{icon}</div>}
      </div>
      <div className="stat-card-value">{value}</div>
      {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}

      {hasBreakdown && showBreakdown && (
        <div className="stat-card-breakdown">
          <div className="breakdown-header">Payment Breakdown</div>
          <div className="breakdown-items">
            {breakdown.cash !== undefined && breakdown.cash > 0 && (
              <div className="breakdown-item">
                <span className="breakdown-label">Cash</span>
                <span className="breakdown-value">₹{breakdown.cash.toLocaleString('en-IN')}</span>
              </div>
            )}
            {breakdown.upi !== undefined && breakdown.upi > 0 && (
              <div className="breakdown-item">
                <span className="breakdown-label">UPI</span>
                <span className="breakdown-value">₹{breakdown.upi.toLocaleString('en-IN')}</span>
              </div>
            )}
            {breakdown.bank !== undefined && breakdown.bank > 0 && (
              <div className="breakdown-item">
                <span className="breakdown-label">Bank</span>
                <span className="breakdown-value">₹{breakdown.bank.toLocaleString('en-IN')}</span>
              </div>
            )}
            {breakdown.cheque !== undefined && breakdown.cheque > 0 && (
              <div className="breakdown-item">
                <span className="breakdown-label">Cheque</span>
                <span className="breakdown-value">₹{breakdown.cheque.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
