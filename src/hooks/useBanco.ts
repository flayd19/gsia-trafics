// =====================================================================
// useBanco.ts — Bank account, loans, and game calendar hook
// Doc 07 — Financial System
// =====================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { BankAccount, BankTransaction, Loan, GameCalendar } from '@/types/banco';
import { calcPMT, maxLoanAmount, estimateValuation } from '@/types/banco';
import type { Company } from '@/types/cadeia';

function rowToAccount(row: Record<string, unknown>): BankAccount {
  return {
    id:             row.id as string,
    userId:         row.user_id as string,
    balance:        Number(row.balance),
    totalInterest:  Number(row.total_interest),
    monthlyRate:    Number(row.monthly_rate),
    lastInterestAt: row.last_interest_at as string,
    createdAt:      row.created_at as string,
  };
}

function rowToLoan(row: Record<string, unknown>): Loan {
  return {
    id:                  row.id as string,
    userId:              row.user_id as string,
    collateralCompanyId: row.collateral_company_id as string,
    principal:           Number(row.principal),
    monthlyRate:         Number(row.monthly_rate),
    installments:        Number(row.installments),
    pmt:                 Number(row.pmt),
    totalPaid:           Number(row.total_paid),
    missedPayments:      Number(row.missed_payments),
    status:              row.status as Loan['status'],
    nextPaymentAt:       row.next_payment_at as string,
    createdAt:           row.created_at as string,
  };
}

function rowToCalendar(row: Record<string, unknown>): GameCalendar {
  return {
    id:          row.id as string,
    userId:      row.user_id as string,
    gameDay:     Number(row.game_day),
    gameMonth:   Number(row.game_month),
    gameYear:    Number(row.game_year),
    lastDayAt:   row.last_day_at as string,
    lastMonthAt: row.last_month_at as string,
    createdAt:   row.created_at as string,
  };
}

export interface UseBancoReturn {
  account:      BankAccount | null;
  loans:        Loan[];
  transactions: BankTransaction[];
  calendar:     GameCalendar | null;
  loading:      boolean;
  error:        string | null;
  deposit:      (amount: number) => Promise<{ ok: boolean; error?: string }>;
  withdraw:     (amount: number, playerCapital: number) => Promise<{ ok: boolean; error?: string; newBalance?: number }>;
  takeLoan:     (collateralCompanyId: string, amount: number, installments: number, companies: Company[]) => Promise<{ ok: boolean; error?: string; pmt?: number }>;
  payLoan:      (loanId: string, playerCapital: number) => Promise<{ ok: boolean; error?: string }>;
  refresh:      () => Promise<void>;
}

export function useBanco(): UseBancoReturn {
  const { user } = useAuth();
  const [account,      setAccount]      = useState<BankAccount | null>(null);
  const [loans,        setLoans]        = useState<Loan[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [calendar,     setCalendar]     = useState<GameCalendar | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [accRes, loansRes, txRes, calRes] = await Promise.all([
        supabase.from('bank_accounts').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('loans').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }),
        supabase.from('bank_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('game_calendar').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      if (accRes.data) setAccount(rowToAccount(accRes.data as Record<string, unknown>));
      setLoans((loansRes.data ?? []).map((r) => rowToLoan(r as Record<string, unknown>)));
      setTransactions(
        (txRes.data ?? []).map((r) => {
          const row = r as Record<string, unknown>;
          return {
            id:           row.id as string,
            userId:       row.user_id as string,
            type:         row.type as BankTransaction['type'],
            amount:       Number(row.amount),
            balanceAfter: Number(row.balance_after),
            description:  row.description as string,
            createdAt:    row.created_at as string,
          } satisfies BankTransaction;
        }),
      );
      if (calRes.data) setCalendar(rowToCalendar(calRes.data as Record<string, unknown>));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar banco');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Ensure account exists
  const ensureAccount = useCallback(async (): Promise<BankAccount | null> => {
    if (!user) return null;
    if (account) return account;
    const { data, error: e } = await supabase
      .from('bank_accounts')
      .insert({ user_id: user.id })
      .select()
      .single();
    if (e || !data) return null;
    const acc = rowToAccount(data as Record<string, unknown>);
    setAccount(acc);
    return acc;
  }, [user, account]);

  const deposit = useCallback(
    async (amount: number): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: 'Não autenticado' };
      if (amount <= 0) return { ok: false, error: 'Valor inválido' };
      const acc = await ensureAccount();
      if (!acc) return { ok: false, error: 'Conta não encontrada' };

      const newBalance = acc.balance + amount;
      const [updateRes, txRes] = await Promise.all([
        supabase.from('bank_accounts').update({ balance: newBalance }).eq('user_id', user.id),
        supabase.from('bank_transactions').insert({
          user_id:      user.id,
          type:         'deposit',
          amount,
          balance_after: newBalance,
          description:  `Depósito de R$ ${amount.toFixed(2)}`,
        }),
      ]);
      if (updateRes.error) return { ok: false, error: updateRes.error.message };
      await fetchAll();
      return { ok: true };
    },
    [user, ensureAccount, fetchAll],
  );

  const withdraw = useCallback(
    async (
      amount: number,
      _playerCapital: number,
    ): Promise<{ ok: boolean; error?: string; newBalance?: number }> => {
      if (!user) return { ok: false, error: 'Não autenticado' };
      const acc = await ensureAccount();
      if (!acc) return { ok: false, error: 'Conta não encontrada' };
      if (amount > acc.balance) return { ok: false, error: 'Saldo insuficiente no banco' };

      const newBalance = acc.balance - amount;
      await supabase.from('bank_accounts').update({ balance: newBalance }).eq('user_id', user.id);
      await supabase.from('bank_transactions').insert({
        user_id:      user.id,
        type:         'withdrawal',
        amount,
        balance_after: newBalance,
        description:  `Saque de R$ ${amount.toFixed(2)}`,
      });
      await fetchAll();
      return { ok: true, newBalance: amount };
    },
    [user, ensureAccount, fetchAll],
  );

  const takeLoan = useCallback(
    async (
      collateralCompanyId: string,
      amount: number,
      installments: number,
      companies: Company[],
    ): Promise<{ ok: boolean; error?: string; pmt?: number }> => {
      if (!user) return { ok: false, error: 'Não autenticado' };
      const company = companies.find((c) => c.id === collateralCompanyId);
      if (!company) return { ok: false, error: 'Empresa não encontrada' };

      const valuation = estimateValuation(company.capital, company.totalRevenue);
      const maxAmount = maxLoanAmount(valuation);
      if (amount > maxAmount)
        return { ok: false, error: `Limite máximo: R$ ${maxAmount.toFixed(2)} (70% da avaliação)` };

      const MONTHLY_RATE = 0.025;
      const pmt = calcPMT(amount, MONTHLY_RATE, installments);
      const nextPayment = new Date();
      nextPayment.setDate(nextPayment.getDate() + 30);

      const { error: e } = await supabase.from('loans').insert({
        user_id:               user.id,
        collateral_company_id: collateralCompanyId,
        principal:             amount,
        monthly_rate:          MONTHLY_RATE,
        installments,
        pmt,
        next_payment_at:       nextPayment.toISOString(),
      });
      if (e) return { ok: false, error: e.message };

      // Register bank transaction
      const acc = await ensureAccount();
      const newBankBalance = (acc?.balance ?? 0) + amount;
      await supabase.from('bank_transactions').insert({
        user_id:      user.id,
        type:         'loan_disbursement',
        amount,
        balance_after: newBankBalance,
        description:  `Empréstimo de R$ ${amount.toFixed(2)} (${installments}x R$ ${pmt.toFixed(2)})`,
      });

      await fetchAll();
      return { ok: true, pmt };
    },
    [user, ensureAccount, fetchAll],
  );

  const payLoan = useCallback(
    async (
      loanId: string,
      playerCapital: number,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: 'Não autenticado' };
      const loan = loans.find((l) => l.id === loanId);
      if (!loan) return { ok: false, error: 'Empréstimo não encontrado' };
      if (playerCapital < loan.pmt) return { ok: false, error: `Saldo insuficiente (parcela: R$ ${loan.pmt.toFixed(2)})` };

      const installmentsPaid = Math.round(loan.totalPaid / loan.pmt) + 1;
      const remaining        = loan.installments - installmentsPaid;
      const newTotalPaid     = loan.totalPaid + loan.pmt;
      const isLastPayment    = remaining <= 0;

      const nextPayment = new Date(loan.nextPaymentAt);
      nextPayment.setDate(nextPayment.getDate() + 30);

      await supabase.from('loans').update({
        total_paid:       newTotalPaid,
        status:           isLastPayment ? 'paid_off' : 'active',
        next_payment_at:  isLastPayment ? null : nextPayment.toISOString(),
      }).eq('id', loanId);

      await supabase.from('loan_payments').insert({
        loan_id:        loanId,
        user_id:        user.id,
        installment_no: installmentsPaid,
        amount:         loan.pmt,
        missed:         false,
      });

      await fetchAll();
      return { ok: true };
    },
    [user, loans, fetchAll],
  );

  return { account, loans, transactions, calendar, loading, error, deposit, withdraw, takeLoan, payLoan, refresh: fetchAll };
}
