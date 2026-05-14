// =====================================================================
// banco.ts — Bank, loan, and calendar types
// Doc 07 — Financial System
// =====================================================================

export interface BankAccount {
  id:            string;
  userId:        string;
  balance:       number;
  totalInterest: number;
  monthlyRate:   number;
  lastInterestAt: string;
  createdAt:     string;
}

export interface BankTransaction {
  id:           string;
  userId:       string;
  type:         'deposit' | 'withdrawal' | 'interest' | 'loan_disbursement' | 'loan_payment';
  amount:       number;
  balanceAfter: number;
  description:  string;
  createdAt:    string;
}

export interface CompanyValuation {
  id:          string;
  userId:      string;
  companyId:   string;
  valuation:   number;
  valuedAt:    string;
}

export interface Loan {
  id:                    string;
  userId:                string;
  collateralCompanyId:   string;
  principal:             number;
  monthlyRate:           number;
  installments:          number;
  pmt:                   number;
  totalPaid:             number;
  missedPayments:        number;
  status:                'active' | 'paid_off' | 'defaulted';
  nextPaymentAt:         string;
  createdAt:             string;
}

export interface LoanPayment {
  id:            string;
  loanId:        string;
  userId:        string;
  installmentNo: number;
  amount:        number;
  paidAt:        string;
  missed:        boolean;
}

export interface GameCalendar {
  id:           string;
  userId:       string;
  gameDay:      number;
  gameMonth:    number;
  gameYear:     number;
  lastDayAt:    string;
  lastMonthAt:  string;
  createdAt:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** PMT (fixed installment) formula: P * [r(1+r)^n] / [(1+r)^n - 1] */
export function calcPMT(principal: number, monthlyRate: number, installments: number): number {
  if (monthlyRate === 0) return principal / installments;
  const r = monthlyRate;
  const n = installments;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/** Company valuation: capital × 3 + totalRevenue × 0.5 (simple heuristic) */
export function estimateValuation(capital: number, totalRevenue: number): number {
  return capital * 3 + totalRevenue * 0.5;
}

/** Max loan = 70% of collateral valuation */
export function maxLoanAmount(valuation: number): number {
  return valuation * 0.7;
}
