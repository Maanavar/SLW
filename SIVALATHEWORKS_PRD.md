# Siva Lathe Works — Product Requirements Document

**Version:** 1.0  
**Date:** April 2026  
**Status:** Completed & Deployed  

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Data Models](#3-data-models)
4. [Business Rules & Domain Logic](#4-business-rules--domain-logic)
5. [Pages & Functionality](#5-pages--functionality)
   - [Login](#51-login-screen)
   - [Jobs (Home)](#52-jobs-screen--home)
   - [Dashboard](#53-dashboard-screen)
   - [Customers](#54-customers-screen)
   - [Work Types](#55-work-types-screen)
   - [Payments](#56-payments-screen)
   - [Records](#57-records-screen)
   - [Finance Reports](#58-finance-reports-screen)
   - [Expenses Manager](#59-expenses-manager-screen)
   - [Commission Management](#510-commission-management-screen)
   - [History](#511-history-screen)
   - [Logger / Admin](#512-logger--admin-screen)
6. [State Management](#6-state-management)
7. [Navigation & Layout](#7-navigation--layout)
8. [Utility Libraries](#8-utility-libraries)
9. [Mobile Behavior](#9-mobile-behavior)

---

## 1. Product Overview

**Siva Lathe Works (SLW)** is an internal business operations and financial management system for a lathe manufacturing workshop. It serves as a single command center for:

- Logging daily job work orders and billing
- Tracking customer balances and payments
- Managing commission workers and their payouts
- Recording operational expenses
- Generating financial reports and break-even analysis
- Maintaining a full audit trail

**Target User:** Single admin (owner/manager of the workshop)  
**Access Model:** Admin-only login, single role  
**Deployment:** Web app (PWA) with optional backend; works offline  
**Currency:** Indian Rupee (INR)

---

## 2. Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| UI Framework | React 18.2 + TypeScript |
| Build Tool | Vite 5.0 |
| Routing | React Router v6 (hash-based) |
| State Management | Zustand 4.4 (with localStorage persistence) |
| Styling | Plain CSS (custom, no CSS-in-JS) |
| PWA | Service Worker registered in main.tsx |

### Backend
| Layer | Technology |
|---|---|
| Server | Express 4.21 + TypeScript |
| ORM | Prisma 5.20 |
| Database | PostgreSQL (Docker) |
| Runtime | Node 20+ |
| Validation | Zod |
| Security | Helmet, CORS |
| Logging | Morgan |

### Infrastructure
| Tool | Purpose |
|---|---|
| Docker Compose | PostgreSQL + Adminer (local dev) |
| ESLint + Prettier | Code quality and formatting |

---

## 3. Data Models

### Customer
| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| name | string | Required |
| shortCode | string | Optional short identifier |
| type | enum | Monthly \| Invoice \| Party-Credit \| Cash |
| hasCommission | boolean | Whether commission applies for this customer |
| requiresDc | boolean | Whether Delivery Challan is required |
| advanceBalance | number | Pre-paid amount; offsets outstanding balance |
| notes | string | Optional |
| isActive | boolean | Soft-delete flag |

### Job
| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| jobCardId | string | Format: `DDMM###` (auto-generated, daily increment) |
| customerId | string | FK → Customer |
| date | date | Job date |
| workTypeId | string | FK → WorkType |
| quantity | number | 1–9999 |
| amount | number | Our net income for this line |
| commissionAmount | number | Commission for this line |
| commissionWorkerId | string | FK → CommissionWorker (optional) |
| paidAmount | number | Amount paid (same-day entry) |
| paymentMode | enum | Cash \| UPI \| Bank \| Cheque |
| paymentStatus | enum | Paid \| Pending \| Partially Paid (derived) |
| dcNo | string | Delivery Challan number (if applicable) |
| dcDate | date | DC date |
| vehicleNo | string | Vehicle number (for RMP/Mahalingam) |
| dcApprovedWithout | boolean | DC waived flag |
| rmpHandler | enum | Bhai \| Raja (RMP customers only) |
| workMode | enum | Workshop \| Spot |
| notes | string | Optional |

### WorkType
| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| name | string | Required |
| shortCode | string | Optional |
| category | string | FK → Category name |
| defaultUnit | string | e.g., "piece", "kg", "meter" |
| defaultRate | number | Suggested rate when adding job lines |
| isActive | boolean | Soft-delete flag |

### Payment
| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| customerId | string | FK → Customer |
| amount | number | Total payment amount |
| mode | enum | Cash \| UPI \| Bank \| Cheque \| Mixed |
| cashAmount | number | Breakdown if Mixed mode |
| upiAmount | number | Breakdown if Mixed mode |
| bankAmount | number | Breakdown if Mixed mode |
| chequeAmount | number | Breakdown if Mixed mode |
| date | date | Payment date |
| jobCardId | string | Linked job card (optional) |
| notes | string | Optional |

### Expense
| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| category | enum | EB \| Rent \| Salary \| Material \| Fuel \| Union \| Other |
| description | string | Optional detail |
| amount | number | Required |
| date | date | Expense date |
| isRecurring | boolean | Auto-generate monthly |
| recurringDay | number | Day of month (1–28) to apply recurring |

### CommissionWorker
| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| name | string | Required, unique per customer |
| customerId | string | FK → Customer |
| isActive | boolean | Active status |

### CommissionPayment
| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| workerId | string | FK → CommissionWorker |
| amount | number | Amount paid to worker |
| date | date | Payment date |
| jobIds | string[] | Linked job IDs (optional audit trail) |
| notes | string | Optional |

### ActivityLog
| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| timestamp | datetime | Auto-set |
| entityType | enum | CUSTOMER \| JOB \| PAYMENT \| EXPENSE \| WORK_TYPE \| etc. |
| entityId | string | ID of affected entity |
| action | enum | create \| update \| delete |
| actor | string | User display name |
| beforeState | JSON | Entity state before change |
| afterState | JSON | Entity state after change |
| message | string | Human-readable description |

### User
| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| displayName | string | Shown in UI |
| password | string | Hashed |
| role | string | admin (only role) |

---

## 4. Business Rules & Domain Logic

### Job Card ID Generation
- Format: `DDMM###` where DD = day, MM = month, ### = 3-digit daily serial
- Serial resets to `001` each new day
- Example: `15042001` = 15th April, serial 001
- Auto-incremented; read-only in form

### Customer Types & Feature Flags
| Type | Commission | DC | Notes |
|---|---|---|---|
| Monthly | Optional (hasCommission flag) | Optional (requiresDc flag) | Regular billed monthly |
| Invoice | No | No | Invoice-based billing |
| Party-Credit | Optional | No | Credit party |
| Cash | No | No | Cash-only customers |

### DC (Delivery Challan) Logic
- Shown only when `customer.requiresDc = true` OR customer name matches "Mahalingam" pattern
- Fields: DC No., DC Date, Vehicle No. (hidden for Wagen Autos), DC Approved Without toggle
- DC approval toggle = DC was waived for that card

### RMP (Ramani Motors / RMP Customers)
- Special field: **RMP Handler** — "Bhai" or "Raja"
- Maps to named commission workers automatically
- Vehicle No. always shown

### Commission Logic
- Only for customers where `hasCommission = true`
- Assigned per job line (individual worker) or per card (bulk)
- Outstanding Commission = Sum(job.commissionAmount for worker's jobs) − Sum(commissionPayments to worker)
- Supports fixed rupee amounts (per-line entry)

### Payment Status Derivation
```
paidAmount >= finalBill → "Paid"
0 < paidAmount < finalBill → "Partially Paid"
paidAmount == 0 → "Pending"
```
Where `finalBill = job.amount + job.commissionAmount`

### Dual Payment Tracking
- **Payment Vouchers:** Manually recorded via "Record Payment" modal (preferred)
- **Job Paid Entries:** From `job.paidAmount` set at job creation (fallback)
- Vouchers take precedence; no double-counting

### Customer Advance Balance
- Tracks pre-paid amounts for a customer
- Offsets the outstanding balance in all summary views
- Can result in negative outstanding (overpaid)

### Recurring Expenses
- Marked with `isRecurring = true` and a `recurringDay` (1–28)
- Automatically generated for each month on that day
- Day capped at 28 to avoid invalid dates (Feb, etc.)

### Break-Even Calculation
```
Break-Even Jobs = Total Monthly Expenses / Average Net Profit per Job
Average Net Profit = (Total Revenue − Total Commission) / Total Job Cards
```

### Ageing Analysis (Outstanding Buckets)
- Current: 0–30 days
- 30+ days overdue
- 60+ days overdue
- 90+ days overdue
- Compared against job date vs. current date

---

## 5. Pages & Functionality

---

### 5.1 Login Screen

**Route:** `/login`

**Purpose:** Authenticate admin before accessing the app.

**UI Elements:**
- App title: "Siva Lathe Works"
- Display Name input (default: "SLW Admin", max 80 chars)
- Password input (required)
- "Sign In" button
- "Continue Offline" button
- Error message display

**User Actions:**
- Enter credentials → authenticate via backend API
- Continue Offline → create local session with display name (no password needed)
- Auto-redirect to last visited page after successful login

**Logic:**
- If auth token already exists → skip login, auto-redirect
- If network error → show offline option automatically
- Offline mode: full app access using localStorage data only

---

### 5.2 Jobs Screen (Home)

**Route:** `/` (default landing page)

**Purpose:** Primary screen for daily job entry and viewing submitted job cards.

---

#### A. Job Entry Form

**Fields:**

| Field | Type | Condition |
|---|---|---|
| Customer | SearchableSelect (required) | Always |
| Job Date | Date picker (default: today) | Always |
| Job Card ID | Auto-generated, read-only | Always |
| Work Lines | Repeating rows (1+) | Always |
| Commission Worker | Select per line | hasCommission customers |
| Commission Amount | Number per line | hasCommission customers |
| DC No. | Text | requiresDc customers |
| DC Date | Date | requiresDc customers |
| Vehicle No. | Text | requiresDc (not Wagen Autos) |
| DC Approved Without | Toggle | requiresDc customers |
| RMP Handler | Bhai \| Raja | RMP customers |
| Work Mode | Workshop \| Spot | Always |
| Payment Mode | Cash \| UPI \| Bank \| Cheque | Always |
| Paid Amount | Number (optional) | Always |
| Notes | Textarea | Always |

**Work Line Fields (per line):**
- Work Type (grouped by category, with search)
- Quantity (stepper, 1–9999)
- Amount (INR) — auto-fills from work type default rate
- Commission (INR) — shown only for commission customers
- Worker selector — shown only for commission customers

**Form Actions:**
- "+ Add Line" — adds a new work line row
- "× Remove" — removes a line (min 1 line required)
- **Submit** — validates and saves job card

**Validation Rules:**
- At least one work line required
- Work type and amount required per line
- Quantity between 1–9999
- Customer required

**Auto-Behaviors:**
- Selecting customer → shows/hides commission, DC, RMP fields
- Selecting work type → suggests default amount
- For single-worker commission customers → auto-selects worker

---

#### B. Job Summary Panel

Displayed while filling the form:
- Total Amount (sum of all line amounts)
- Total Commission (sum of all line commissions)
- Net Value (= Total Amount, our income)
- Final Value (Amount + Commission)

---

#### C. Submitted Job Cards

**View Mode:** Today | Date Range (toggle)

**Each Card Displays:**
- Date (formatted)
- Job Card ID
- Customer Name
- Line count + work type summary
- Final Bill, Commission, Net Income, Paid Amount
- Status badge: Paid (green) | Partially Paid (amber) | Pending (red)

**Card Actions:**
- Click row → open Job Card Details Modal (read-only view)
- Edit icon → open Job Card Edit Overlay (full edit)
- Delete → confirmation prompt → deletes card and all its lines
- Record Payment icon → open Record Payment Modal

**Today's Metrics Panel:**
- Total Cards, Total Bill, Paid, Pending
- Payment mode breakdown: Cash / UPI / Bank / Cheque

---

### 5.3 Dashboard Screen

**Route:** `/dashboard`

**Purpose:** Executive snapshot of operations with quick action buttons.

---

#### A. Quick Actions
- New Job → `/`
- Add Customer → opens Customer Modal
- Record Payment → `/payments`
- View Records → `/records`

---

#### B. Period Performance

**Period Tabs:** Today | Week | Month  
**Navigation:** Prev / Next arrows to shift the period

**Stat Cards:**
- Jobs Count
- Total Revenue
- Commission Expense
- Gross Profit (Revenue − Commission)
- Cash Received
- Outstanding (Revenue − Received)
- Payment breakdown: Cash | UPI | Bank | Cheque

---

#### C. Customer Balances Table

| Column | Description |
|---|---|
| Customer Name | Clickable to edit |
| Short Code | |
| Type | Badge (Monthly/Invoice/Party-Credit/Cash) |
| Our Income | Sum of job.amount |
| Commission | Sum of job.commissionAmount |
| Final Bill | Income + Commission |
| Paid Amount | From payments or job paid entries |
| Advance | customer.advanceBalance |
| Balance | Final Bill − Paid (color-coded) |

**Filters:** Customer type dropdown, search by name  
**Summary Row:** Column totals  
**Sorting:** By balance (highest first)

---

### 5.4 Customers Screen

**Route:** `/customers`

**Purpose:** Manage customer master data.

**UI:**
- Search bar (name or code, real-time, case-insensitive)
- "Add Customer" button
- Table: Name | Code | Type | Commission | DC Required
- Click row → open Customer Modal

**Customer Modal Fields:**
- Name (required)
- Short Code
- Customer Type (Monthly | Invoice | Party-Credit | Cash)
- Has Commission (toggle)
- Requires DC (toggle)
- Notes
- Is Active (toggle)

**Commission Workers Sub-Section** (visible if Has Commission = ON):
- List of workers: Name, Active status
- Add worker: Name input + Active toggle
- Edit / Delete per worker
- Validation: No duplicate worker names per customer

**Empty State:** "No customers yet" with Add Customer CTA

---

### 5.5 Work Types Screen

**Route:** `/work-types`

**Purpose:** Manage catalog of work categories and their default rates.

**UI:**
- Search bar (name, category, code)
- "Manage Categories" button
- "Add Work Type" button
- Table: Category | Name | Code | Unit | Default Rate
- Click row → open Work Type Modal

**Work Type Modal Fields:**
- Category (dropdown from categories list)
- Name (required)
- Short Code
- Default Unit (e.g., "piece", "kg")
- Default Rate (INR)
- Is Active (toggle)

**Category Modal:**
- List of all categories
- Add / Edit / Delete category
- Delete blocked if any work type uses that category
- Validation: No empty or duplicate category names

---

### 5.6 Payments Screen

**Route:** `/payments`

**Purpose:** Record and review all customer payments.

---

#### A. Period Filter

Tabs: Today | Week | Month | Quarter | Half-Year | Year | All Time | Custom Range  
Custom Range: From date + To date inputs

---

#### B. Record Payment Modal

**Fields:**
- Customer (required)
- Amount entry type: Single amount OR mode breakdown (radio toggle)
- Payment Mode: Cash | UPI | Bank | Cheque | Mixed
  - Mixed: Breakdown inputs for each mode
- Date (default: today)
- Payment Scope: Manual | Week | Month | Range
  - Non-manual: Auto-calculates pending amount for scope
- Settlement checkbox: Pay full customer outstanding balance
- Advance adjustment
- Notes

---

#### C. Payments Table

**Columns:** Date | Customer | Job Card ID | Amount | Mode | Actions (View / Edit / Delete)

**Data Sources:**
- Payment Vouchers (manually recorded) — primary
- Job Paid Entries (from job.paidAmount) — fallback to prevent gaps

**Sorting:** Date newest first  
**Filtering:** By customer name, by period

---

### 5.7 Records Screen

**Route:** `/records`

**Purpose:** View and export all job cards across any time period.

---

#### A. Filters & Controls

| Control | Options |
|---|---|
| Period | Day \| Week \| Month \| Quarter \| Half-Year \| Year \| All Time \| Custom Range |
| View Mode | Cards view \| Table view |
| Payment Status | All \| Paid \| Unpaid |
| Customer | Search input |

---

#### B. Job Cards Display

**Cards View — Each Card Shows:**
- Date, Job Card ID, Customer
- Line count, Work summary
- Final Bill, Commission, Net Income, Paid, Pending
- Status badge (Paid / Partially Paid / Pending)

**Table View — Columns:**
Same fields in columnar format; sortable headers

**Color Coding:**
- Paid: Green
- Partially Paid: Amber
- Pending: Red

**Card Actions:** View Details | Edit | Delete | Record Payment

---

#### C. Export

**Selectable Fields (checkboxes):**
Card ID, Date, Customer, Work Type, Quantity, Amount, Commission, Paid, DC No., DC Date, Vehicle No.

**Summary Fields:** Total Cards, Total Bill, Total Net, Total Paid, Total Pending

**Format:** CSV

---

### 5.8 Finance Reports Screen

**Route:** `/finance`

**Purpose:** Accounting-standard multi-tab financial analysis.

**Period Filter:** Today | Week | Month | Quarter | Year | All Time | Date Range

---

#### Tab 1 — Revenue Report
- Total Revenue, Job Count, Average Revenue per Job
- Revenue by customer breakdown
- Revenue by work type category

#### Tab 2 — Payments Report
- Total Payments Received, Payment Count, Average Payment
- Outstanding Amount (Revenue − Payments)
- Payment method breakdown: Cash | UPI | Bank | Cheque
- Payments by customer

#### Tab 3 — Commission Report
- Total Commission Paid, Jobs with Commission, Average Commission per Job
- Outstanding commission (unpaid to workers)
- Commission vs. gross profit ratio
- Commission by customer and worker

#### Tab 4 — Customer Financials
Same as Customer Balances Table on Dashboard, for the selected period.

#### Tab 5 — Payment Methods Breakdown
- Cash | UPI | Bank | Cheque: Total amount + % of total
- Visual breakdown (pie/bar)

#### Tab 6 — Outstanding Ageing Report
- Per customer, outstanding broken into buckets:
  - Current (0–30 days), 30+ days, 60+ days, 90+ days
- Oldest outstanding, total overdue

#### Tab 7 — Daily Cash Flow
- Day-by-day: Inflow (payments), Outflow (commission)
- Running balance and trend line
- Granularity adapts to selected period

---

### 5.9 Expenses Manager Screen

**Route:** `/expenses`

**Purpose:** Track operational costs and analyse profitability.

---

#### Tab 1 — Overview

**Expense Entry Form:**
- Category: EB | Rent | Salary | Material | Fuel | Union | Other
- Description (text)
- Amount (required)
- Date (date picker)
- Is Recurring toggle
  - If ON: Day of month (1–28)

**Metrics Cards:**
- Total Monthly Expenses
- Monthly Revenue (from jobs)
- Monthly Commission
- Gross Profit (Revenue − Commission)
- Net Profit (Gross Profit − Expenses)
- Expense category breakdown table

**Monthly Navigation:** Prev / Next month

#### Tab 2 — Monthly
- Month selector
- Total expenses by category
- Recurring vs. one-time split
- Annualized projection
- Comparison to average month

#### Tab 3 — Breakdown
- Category distribution (% of total per category)
- Trend over time

#### Tab 4 — History
- All expenses table: Date | Category | Description | Amount | Recurring
- Filter by category, by date range
- Delete per entry (with confirmation)

#### Tab 5 — Break-Even Analysis
- Current monthly expenses (projected)
- Average profit per job card
- Break-even point (number of jobs needed)
- Current month's job count
- Shortfall or buffer vs. break-even

---

### 5.10 Commission Management Screen

**Route:** `/commission`

**Purpose:** Track commission earned by workers and record payouts.

---

#### Tab 1 — Workers

**Workers Table:**
| Column | Description |
|---|---|
| Worker Name | |
| Customer | Customer they work for |
| Outstanding | Unpaid commission (jobs − payments) |
| Commission Paid | Lifetime total paid |
| Actions | View Details, Record Payment, Delete |

**Summary Metrics:**
- Total Active Workers
- Total Outstanding Commission
- Total Commission Paid

**Record Payment Form:**
- Worker selector (dropdown)
- Amount (required)
- Date (default: today)
- Notes (optional)

**Worker Details Modal:**
- Name, customer
- Outstanding commission
- List of job cards assigned to worker: Card ID | Date | Commission Amount

---

#### Tab 2 — History

**Commission Payments Table:**
- Date | Worker Name | Customer | Amount Paid | Notes | Actions (View / Edit / Delete)
- Filters: by worker, by customer, by date range
- Sort: newest first

---

### 5.11 History Screen

**Route:** `/history`

**Purpose:** Single-day job card viewer for quick daily review.

**UI:**
- Date picker (default: today) with prev/next day navigation
- Payment Status filter: All | Paid | Unpaid
- View Mode: Cards | Table
- Card Actions: View Details | Edit | Delete | Record Payment
- Same card display format as Records screen (but single-day only)

---

### 5.12 Logger / Admin Screen

**Route:** `/logger`

**Purpose:** Audit trail viewer and data management operations.

---

#### A. Activity Logs Table

**Columns:** Timestamp | Entity Type | Entity ID | Action | Actor | Message  
**Click log entry → Detail Modal:**
- Full ID, Timestamp, Actor
- Entity type and action
- Before state (JSON)
- After state (JSON)
- "Open Target" button → navigates to affected entity's page

#### B. Data Management Actions

| Action | Confirmation Level |
|---|---|
| Purge Jobs | Warning modal |
| Purge Payments | Warning modal |
| Purge Expenses | Warning modal |
| Purge Customers | Warning modal |
| Purge Work Types | Warning modal |
| Purge All Data | Red modal + text confirmation ("PURGE_ALL") |
| Clear Activity Logs | Warning modal |
| Seed Demo Data | Confirmation + password input ("seed") |

**Notes:**
- Dangerous actions styled in red
- All purges are hard deletes (no soft delete)
- Demo seed populates default customers and work types for testing

---

## 6. State Management

### dataStore (Zustand)

**Holds all business data:**  
customers, jobs, payments, workTypes, categories, expenses, commissionWorkers, commissionPayments

**Key methods:**
- `initializeData()` — load from localStorage or API on app start
- `refreshData()` — sync with backend
- Full CRUD for each entity: `add*`, `update*`, `delete*`, `get*`
- Computed getters: `getActiveCustomers()`, `getCustomerJobs()`, `getCommissionPaymentsForWorker()`

**Persistence:**
- Zustand `persist` middleware
- localStorage key: `siva_data`
- Legacy localStorage keys maintained for compatibility

**Backend Sync:**
- Optional (env flag `enableBackendSync`)
- Falls back to offline mode if API unavailable
- On first sync: auto-imports legacy localStorage data if backend is empty

### uiStore (Zustand)

**Holds UI state:**  
theme, sidebarCollapsed, modal (isOpen, type, id), toasts[]

**Methods:**
- `toggleTheme()` / `setTheme()` — persisted to localStorage `siva_theme`; sets `document.documentElement.dataset.theme`
- `toggleSidebar()`, `setSidebarCollapsed()`
- `openModal(type, id?)`, `closeModal()`
- `addToast()`, `removeToast()`, `clearToasts()`

---

## 7. Navigation & Layout

### Sidebar Sections

| Section | Items |
|---|---|
| Operations | Dashboard, Jobs |
| Reporting | Records |
| Finance | Payments, Finance, Commission, Expenses |
| Admin | Customers, Work Types, History, Logger |

**Mobile Nav:** Bottom navigation bar on small screens  
**Sidebar Collapse:** Auto-collapse on mobile; toggle button in header

### Global Modals (triggered from anywhere)
- CustomerModal (add/edit customer)
- WorkTypeModal (add/edit work type)
- CategoryModal (manage work type categories)

---

## 8. Utility Libraries

### Date Utils
- `getLocalDateString()` — returns YYYY-MM-DD
- `getWeekStartDate()`, `getMonthInputString()` — period helpers
- Period ranges for: day, week, month, quarter, half-year, year

### Currency Utils
- `formatCurrency(amount)` — INR format with commas

### Job Utils
- `getJobFinalBillValue(job)` = amount + commissionAmount
- `getJobNetValue(job)` = amount
- `getJobPaidAmount(job)` — from paidAmount or status
- `getPaymentStatusFromAmounts(paid, due)` — derives Paid / Partially Paid / Pending
- `isDcApplicableCustomer(customer)` — true if requiresDc or Mahalingam pattern
- `isCommissionApplicableCustomer(customer)` — true if hasCommission

### Report Utils
- `groupJobsByCard(jobs)` — groups by jobCardId
- `getJobsInRange(jobs, from, to)` — date filter
- `getReportRange(tab)` — converts tab name to date range

### Finance Utils
- `calculateRevenueMetrics(jobs, period)`
- `calculatePaymentMetrics(payments, jobs, period)`
- `calculateCommissionMetrics(jobs, commissionPayments, period)`
- `calculateCustomerFinancials(customer, jobs, payments)`
- `calculateWorkerCommissionSummary(worker, jobs, commissionPayments)`
- `calculateOutstandingAgeing(jobs, payments, today)`
- `calculateDailyCashFlow(jobs, payments, period)`

---

## 9. Mobile Behavior

- **Bottom Nav:** `MobileNav` component replaces sidebar on small screens
- **Sidebar:** Auto-collapses; toggle button in header
- **Tables:** Horizontal scroll or stacked columns on mobile
- **Inputs:** Native HTML date pickers (browser's native picker on iOS/Android)
- **Touch Targets:** Larger buttons and padding for touch
- **Modals:** Full-screen or near-full-screen on small viewports
- **Search Inputs:** Auto-focus in modals for keyboard accessibility

---

*This document represents the complete feature set of Siva Lathe Works as of April 2026.*
