// =====================================================================
// RelatoriosScreen.tsx — Finanças, histórico de transações, ranking
// =====================================================================

import { useState } from 'react';
import { TrendingUp, TrendingDown, Building2, BarChart3 } from 'lucide-react';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import { getCompanyType, calcTaxRate } from '@/data/cadeia';

interface Props {
  cadeia: UseCadeiaReturn;
}

function fmt(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toFixed(2)}`;
}

const TX_TYPE_LABELS: Record<string, string> = {
  production_complete: '⚙️ Produção',
  production_cost:     '⚙️ Custo lote',
  sale:                '💰 Venda',
  purchase:            '🛒 Compra',
  tax:                 '🏛️ Imposto',
  dividend:            '💸 Dividendo',
  logistics_income:    '🚚 Logística',
  company_purchase:    '🏢 Empresa',
  operational_cost:    '🏭 Custo fixo',
  salary_cost:         '👷 Salários',
  contract_purchase:   '📋 Contrato compra',
  contract_sale:       '📋 Contrato venda',
};

export function RelatoriosScreen({ cadeia }: Props) {
  const { state } = cadeia;
  const [tab, setTab] = useState<'resumo' | 'transacoes' | 'ranking'>('resumo');
  const [txFilter, setTxFilter] = useState<string>('todas');

  const activeCompanies = state.companies.filter((c) => c.status === 'active');
  const totalAssets =
    state.playerCapital +
    state.companies.reduce((sum, c) => sum + c.capital, 0);
  const currentTaxRate = calcTaxRate(activeCompanies.length);

  // Receita e custo por empresa
  const companyStats = [...state.companies]
    .filter((c) => c.status !== 'closed')
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Filtrar transações
  const filteredTxns = [...state.transactions]
    .reverse()
    .filter((t) => txFilter === 'todas' || t.type === txFilter);

  // Ranking de empresas por receita
  const rankingCompanies = [...activeCompanies].sort(
    (a, b) => b.totalRevenue - a.totalRevenue,
  );

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 p-4 pb-0">
        {(['resumo', 'transacoes', 'ranking'] as const).map((t) => (
          <button
            key={t}
            className={`flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-primary text-background'
                : 'bg-background/40 text-muted-foreground'
            }`}
            onClick={() => setTab(t)}
          >
            {t === 'resumo' ? '📊 Resumo' : t === 'transacoes' ? '📋 Transações' : '🏆 Ranking'}
          </button>
        ))}
      </div>

      {/* ── Resumo Financeiro ───────────────────────────────────── */}
      {tab === 'resumo' && (
        <div className="flex flex-col gap-4 p-4 pb-28 overflow-y-auto">
          {/* Patrimônio total */}
          <div className="ios-card p-5">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Patrimônio Total</p>
            <p className="text-4xl font-bold text-primary">{fmt(totalAssets)}</p>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <div className="bg-background/40 rounded-2xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Caixa Pessoal</p>
                <p className="text-lg font-bold mt-1">{fmt(state.playerCapital)}</p>
              </div>
              <div className="bg-background/40 rounded-2xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Nas Empresas</p>
                <p className="text-lg font-bold mt-1">
                  {fmt(state.companies.reduce((s, c) => s + c.capital, 0))}
                </p>
              </div>
              <div className="bg-background/40 rounded-2xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Total Ganho</p>
                <p className="text-lg font-bold text-green-400 mt-1">{fmt(state.totalEarned)}</p>
              </div>
              <div className="bg-background/40 rounded-2xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Total Gasto</p>
                <p className="text-lg font-bold text-red-400 mt-1">{fmt(state.totalSpent)}</p>
              </div>
            </div>
          </div>

          {/* Taxa de imposto atual */}
          <div className="ios-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">🏛️ Imposto Progressivo</p>
              <span className="neon-badge text-sm">{Math.round(currentTaxRate * 100)}%</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {activeCompanies.length} empresa(s) ativa(s). Imposto sobre receita bruta.
            </p>
            <div className="flex flex-col gap-1">
              {[
                [1, '5%'], [2, '8%'], [3, '12%'], [4, '17%'],
                [5, '23%'], [6, '30%'], [7, '38%+'],
              ].map(([n, rate]) => (
                <div
                  key={n}
                  className={`flex justify-between text-xs px-2 py-1 rounded-lg ${
                    activeCompanies.length === n
                      ? 'bg-primary/20 text-primary font-bold'
                      : 'text-muted-foreground'
                  }`}
                >
                  <span>{n} empresa(s)</span>
                  <span>{rate}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Desempenho por empresa */}
          {companyStats.length > 0 && (
            <div className="ios-card p-4">
              <p className="text-sm font-semibold mb-3">📈 Desempenho por Empresa</p>
              <div className="flex flex-col gap-2">
                {companyStats.map((c) => {
                  const def = getCompanyType(c.typeId);
                  const profit = c.totalRevenue - c.totalCost;
                  return (
                    <div key={c.id} className="rounded-2xl bg-background/30 border border-border/20 p-3 flex items-center gap-3">
                      <span className="text-2xl shrink-0">{def.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{c.name}</p>
                        <div className="flex gap-3 mt-0.5">
                          <span className="text-[11px] text-green-400">↑ {fmt(c.totalRevenue)}</span>
                          <span className="text-[11px] text-red-400">↓ {fmt(c.totalCost)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-base font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {profit >= 0 ? '+' : ''}{fmt(profit)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">caixa: {fmt(c.capital)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Transações ─────────────────────────────────────────── */}
      {tab === 'transacoes' && (
        <div className="flex flex-col gap-3 p-4 pb-28 overflow-y-auto">
          {/* Filtro por tipo */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {['todas', ...Object.keys(TX_TYPE_LABELS)].map((type) => (
              <button
                key={type}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                  txFilter === type
                    ? 'bg-primary text-background font-bold'
                    : 'bg-background/40 text-muted-foreground'
                }`}
                onClick={() => setTxFilter(type)}
              >
                {type === 'todas' ? 'Todas' : TX_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          {filteredTxns.length === 0 ? (
            <div className="ios-card p-8 text-center">
              <BarChart3 size={36} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma transação encontrada.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredTxns.slice(0, 50).map((t) => (
                <div key={t.id} className="ios-card px-3 py-3 flex items-center gap-3">
                  <span className="text-lg shrink-0">
                    {TX_TYPE_LABELS[t.type]?.split(' ')[0] ?? '💫'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.companyName}</p>
                  </div>
                  <span
                    className={`text-sm font-bold whitespace-nowrap shrink-0 ${
                      t.amount > 0 ? 'text-green-400' : t.amount < 0 ? 'text-red-400' : 'text-muted-foreground'
                    }`}
                  >
                    {t.amount !== 0 ? (t.amount > 0 ? '+' : '') + fmt(t.amount) : '—'}
                  </span>
                </div>
              ))}
              {filteredTxns.length > 50 && (
                <p className="text-xs text-muted-foreground text-center">
                  Mostrando últimas 50 de {filteredTxns.length} transações
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Ranking ────────────────────────────────────────────── */}
      {tab === 'ranking' && (
        <div className="flex flex-col gap-3 p-4 pb-28 overflow-y-auto">
          {rankingCompanies.length === 0 ? (
            <div className="ios-card p-8 text-center">
              <Building2 size={36} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma empresa ativa ainda.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rankingCompanies.map((c, i) => {
                const def = getCompanyType(c.typeId);
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={c.id} className="ios-card p-4 flex items-center gap-3">
                    <span className="text-2xl min-w-[2rem] text-center">
                      {medals[i] ?? `#${i + 1}`}
                    </span>
                    <span className="text-xl">{def.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {def.name} • Rep. {c.reputation.toFixed(0)}/100
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-400">{fmt(c.totalRevenue)}</p>
                      <p className="text-[11px] text-muted-foreground">receita total</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
