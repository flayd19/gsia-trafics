// =====================================================================
// EmprestimoWizard.tsx — 4-step loan wizard
// Doc 07 — Financial System
// =====================================================================

import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Building2, AlertTriangle } from 'lucide-react';
import type { UseBancoReturn } from '@/hooks/useBanco';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import { calcPMT, estimateValuation, maxLoanAmount } from '@/types/banco';

function fmt(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(2)}`;
}

const INSTALLMENT_OPTIONS = [6, 12, 18, 24, 36, 48, 60];

interface Props {
  banco:   UseBancoReturn;
  cadeia:  UseCadeiaReturn;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function EmprestimoWizard({ banco, cadeia, onClose, onToast }: Props) {
  const [step,           setStep]           = useState(0);
  const [collateralId,   setCollateralId]   = useState('');
  const [amount,         setAmount]         = useState('');
  const [installments,   setInstallments]   = useState(12);
  const [submitting,     setSubmitting]     = useState(false);
  const [agreed,         setAgreed]         = useState(false);

  const activeCompanies = cadeia.state.companies.filter((c) => c.status === 'active');
  const company         = activeCompanies.find((c) => c.id === collateralId);
  const valuation       = company ? estimateValuation(company.capital, company.totalRevenue) : 0;
  const maxAmount       = maxLoanAmount(valuation);
  const numAmount       = Number(amount);
  const pmt             = numAmount > 0 ? calcPMT(numAmount, 0.025, installments) : 0;
  const totalCost       = pmt * installments;
  const totalInterest   = totalCost - numAmount;

  const canNext = () => {
    if (step === 0) return !!collateralId;
    if (step === 1) return numAmount > 0 && numAmount <= maxAmount;
    if (step === 2) return installments > 0;
    return agreed;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const res = await banco.takeLoan(collateralId, numAmount, installments, cadeia.state.companies);
    setSubmitting(false);
    if (res.ok) {
      onToast(`Empréstimo aprovado! ${fmt(numAmount)} creditado.`);
      onClose();
    } else {
      onToast(`Erro: ${res.error}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div
        className="relative w-full rounded-t-3xl bg-slate-900 border-t border-slate-700/60 p-5 pb-8 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-lg">Solicitar Empréstimo</h3>
            <p className="text-slate-500 text-xs">Passo {step + 1} de 4</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-800">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-purple-500' : 'bg-slate-700'}`} />
          ))}
        </div>

        {/* Step 0 — Pick collateral */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-slate-400 text-sm">Selecione a empresa como garantia</p>
            {activeCompanies.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">Você precisa de uma empresa ativa.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeCompanies.map((c) => {
                  const val     = estimateValuation(c.capital, c.totalRevenue);
                  const maxLoan = maxLoanAmount(val);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCollateralId(c.id)}
                      className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${
                        collateralId === c.id
                          ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                          : 'bg-slate-800 border-slate-700/40 text-white hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="opacity-60" />
                        <span className="font-semibold">{c.name}</span>
                      </div>
                      <div className="text-xs opacity-60 mt-0.5">
                        Avaliação: {fmt(val)} · Máx: {fmt(maxLoan)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 1 — Amount */}
        {step === 1 && company && (
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-3 text-sm">
              <p className="text-slate-400">Garantia: <span className="text-white font-semibold">{company.name}</span></p>
              <p className="text-slate-400 mt-0.5">Máximo disponível: <span className="text-emerald-400 font-semibold">{fmt(maxAmount)}</span></p>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">Valor solicitado (R$)</label>
              <input
                type="number"
                min={1000}
                max={maxAmount}
                step={1000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2.5 text-base font-bold focus:outline-none focus:border-purple-500"
              />
              {numAmount > maxAmount && (
                <p className="text-red-400 text-xs mt-1">Valor acima do limite permitido</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2 — Installments */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-slate-400 text-sm">Número de parcelas</p>
            <div className="grid grid-cols-4 gap-2">
              {INSTALLMENT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setInstallments(n)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    installments === n
                      ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                      : 'bg-slate-800 border-slate-700/40 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {n}x
                </button>
              ))}
            </div>
            {numAmount > 0 && (
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-3 text-sm space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Parcela mensal</span>
                  <span className="text-white font-bold">{fmt(pmt)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total a pagar</span>
                  <span className="text-white">{fmt(totalCost)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total de juros (2,5%/mês)</span>
                  <span className="text-amber-400">{fmt(totalInterest)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Confirm */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="rounded-xl bg-amber-900/20 border border-amber-700/40 p-3 flex gap-2">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300 text-xs leading-relaxed">
                2 parcelas não pagas resultam na <strong>falência da empresa garantidora</strong> ({company?.name}).
                Confirme apenas se tiver certeza.
              </p>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Valor</span>
                <span className="text-white font-bold">{fmt(numAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Parcelas</span>
                <span className="text-white">{installments}x {fmt(pmt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Garantia</span>
                <span className="text-white">{company?.name}</span>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-5 h-5 rounded accent-purple-500"
              />
              <span className="text-slate-300 text-sm">Concordo com os termos e riscos</span>
            </label>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700/40 text-slate-300 font-semibold text-sm hover:bg-slate-700 active:scale-95 transition-all"
            >
              <ChevronLeft size={16} /> Voltar
            </button>
          )}
          {step < 3 ? (
            <button
              disabled={!canNext()}
              onClick={() => setStep((s) => s + 1)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-white transition-all ${
                canNext()
                  ? 'bg-purple-600 hover:bg-purple-500 active:scale-[0.98]'
                  : 'bg-slate-700 opacity-50 cursor-not-allowed'
              }`}
            >
              Próximo <ChevronRight size={16} />
            </button>
          ) : (
            <button
              disabled={!agreed || submitting}
              onClick={handleSubmit}
              className={`flex-1 py-3 rounded-xl font-bold text-white transition-all ${
                agreed && !submitting
                  ? 'bg-purple-600 hover:bg-purple-500 active:scale-[0.98]'
                  : 'bg-slate-700 opacity-50 cursor-not-allowed'
              }`}
            >
              {submitting ? 'Processando...' : 'Solicitar Empréstimo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
