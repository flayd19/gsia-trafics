// =====================================================================
// BancoModule.tsx — Virtual bank screen (deposits, withdrawals, interest)
// Doc 07 — Financial System
// =====================================================================

import { useState } from 'react';
import { TrendingUp, ArrowDownToLine, ArrowUpFromLine, CreditCard, Clock } from 'lucide-react';
import type { UseBancoReturn } from '@/hooks/useBanco';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import { EmprestimoWizard } from './EmprestimoWizard';

function fmt(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(2)}`;
}

const TX_LABELS: Record<string, string> = {
  deposit:           '↓ Depósito',
  withdrawal:        '↑ Saque',
  interest:          '📈 Rendimento',
  loan_disbursement: '💳 Empréstimo',
  loan_payment:      '💸 Parcela paga',
};

// ── Deposit / Withdraw sheet ──────────────────────────────────────────

interface TransferSheetProps {
  mode:          'deposit' | 'withdraw';
  maxAmount:     number;
  onConfirm:     (amount: number) => Promise<{ ok: boolean; error?: string }>;
  onClose:       () => void;
}

function TransferSheet({ mode, maxAmount, onConfirm, onClose }: TransferSheetProps) {
  const [amount,     setAmount]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err,        setErr]        = useState('');

  const numAmount = Number(amount);
  const isValid   = numAmount > 0 && numAmount <= maxAmount;

  const handleConfirm = async () => {
    if (!isValid) return;
    setSubmitting(true);
    const res = await onConfirm(numAmount);
    setSubmitting(false);
    if (res.ok) onClose();
    else setErr(res.error ?? 'Erro');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div
        className="relative w-full rounded-t-3xl bg-slate-900 border-t border-slate-700/60 p-5 pb-8 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-white text-lg">
          {mode === 'deposit' ? '💳 Depositar no Banco' : '💵 Sacar do Banco'}
        </h3>
        <p className="text-slate-400 text-sm">
          {mode === 'deposit'
            ? `Disponível na conta pessoal: ${fmt(maxAmount)}`
            : `Saldo no banco: ${fmt(maxAmount)}`}
        </p>

        <div>
          <label className="text-slate-400 text-xs font-medium block mb-1">Valor (R$)</label>
          <input
            type="number"
            min={1}
            max={maxAmount}
            step={100}
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setErr(''); }}
            placeholder="0,00"
            className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2.5 text-base font-bold focus:outline-none focus:border-blue-500"
          />
          {err && <p className="text-red-400 text-xs mt-1">{err}</p>}
        </div>

        <button
          disabled={!isValid || submitting}
          onClick={handleConfirm}
          className={`w-full rounded-2xl py-3 font-bold text-white transition-all ${
            isValid && !submitting
              ? 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98]'
              : 'bg-slate-700 opacity-50 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Processando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  );
}

// ── BancoModule ───────────────────────────────────────────────────────

interface Props {
  banco:  UseBancoReturn;
  cadeia: UseCadeiaReturn;
}

export function BancoModule({ banco, cadeia }: Props) {
  const [sheet,       setSheet]       = useState<'deposit' | 'withdraw' | null>(null);
  const [showLoan,    setShowLoan]    = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDeposit = async (amount: number) => {
    const res = await banco.deposit(amount);
    if (res.ok) {
      showToast(`R$ ${amount.toFixed(2)} depositado!`);
    }
    return res;
  };

  const handleWithdraw = async (amount: number) => {
    const res = await banco.withdraw(amount, cadeia.state.playerCapital);
    if (res.ok) showToast(`R$ ${amount.toFixed(2)} sacado!`);
    return res;
  };

  const bal    = banco.account?.balance ?? 0;
  const rate   = (banco.account?.monthlyRate ?? 0.005) * 100;
  const earned = banco.account?.totalInterest ?? 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-4 space-y-4">

        {/* Balance card */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-900/60 to-indigo-900/60 border border-blue-700/40 p-5">
          <p className="text-blue-300/70 text-xs font-medium mb-1">Saldo no Banco Virtual</p>
          <p className="text-3xl font-bold text-white">{fmt(bal)}</p>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1 text-xs text-blue-300/70">
              <TrendingUp size={12} />
              {rate.toFixed(1)}% a.m.
            </div>
            <div className="text-xs text-blue-300/70">
              Rendimentos: <span className="text-emerald-400 font-semibold">{fmt(earned)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setSheet('deposit')}
            className="rounded-2xl bg-slate-800 border border-slate-700/40 p-3.5 flex flex-col items-center gap-2 hover:border-blue-500/50 active:scale-95 transition-all"
          >
            <ArrowDownToLine size={22} className="text-emerald-400" />
            <span className="text-xs font-semibold text-slate-300">Depositar</span>
          </button>
          <button
            onClick={() => setSheet('withdraw')}
            className="rounded-2xl bg-slate-800 border border-slate-700/40 p-3.5 flex flex-col items-center gap-2 hover:border-blue-500/50 active:scale-95 transition-all"
          >
            <ArrowUpFromLine size={22} className="text-amber-400" />
            <span className="text-xs font-semibold text-slate-300">Sacar</span>
          </button>
          <button
            onClick={() => setShowLoan(true)}
            className="rounded-2xl bg-slate-800 border border-slate-700/40 p-3.5 flex flex-col items-center gap-2 hover:border-blue-500/50 active:scale-95 transition-all"
          >
            <CreditCard size={22} className="text-purple-400" />
            <span className="text-xs font-semibold text-slate-300">Empréstimo</span>
          </button>
        </div>

        {/* Active loans */}
        {banco.loans.length > 0 && (
          <div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Empréstimos ativos</p>
            <div className="space-y-2">
              {banco.loans.map((loan) => (
                <div
                  key={loan.id}
                  className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white text-sm font-semibold">{fmt(loan.principal)}</p>
                    <p className="text-slate-400 text-xs">
                      {Math.round(loan.totalPaid / loan.pmt)}/{loan.installments} parcelas · {fmt(loan.pmt)}/mês
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const res = await banco.payLoan(loan.id, cadeia.state.playerCapital);
                      if (res.ok) showToast('Parcela paga!');
                      else showToast(`Erro: ${res.error}`);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold active:scale-95 transition-all"
                  >
                    Pagar {fmt(loan.pmt)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent transactions */}
        {banco.transactions.length > 0 && (
          <div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Extrato</p>
            <div className="space-y-1.5">
              {banco.transactions.slice(0, 10).map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-xl bg-slate-800/40 border border-slate-700/30 px-3 py-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock size={12} className="text-slate-500 shrink-0" />
                    <span className="text-slate-300 text-sm truncate">{TX_LABELS[tx.type] ?? tx.type}</span>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ml-2 ${
                    ['deposit','interest','loan_disbursement'].includes(tx.type)
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}>
                    {['deposit','interest','loan_disbursement'].includes(tx.type) ? '+' : '-'}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sheets */}
      {sheet === 'deposit' && (
        <TransferSheet
          mode="deposit"
          maxAmount={cadeia.state.playerCapital}
          onConfirm={handleDeposit}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'withdraw' && (
        <TransferSheet
          mode="withdraw"
          maxAmount={bal}
          onConfirm={handleWithdraw}
          onClose={() => setSheet(null)}
        />
      )}
      {showLoan && (
        <EmprestimoWizard
          banco={banco}
          cadeia={cadeia}
          onClose={() => setShowLoan(false)}
          onToast={showToast}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-full shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
