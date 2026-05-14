// =====================================================================
// CompanyDetailScreen.tsx — Detalhe de empresa com 8 abas internas
// Doc 08 — Correção UX crítica
// =====================================================================

import { useState, useMemo } from 'react';
import {
  ArrowLeft, ToggleLeft, ToggleRight, ArrowUpToLine, ArrowDownToLine,
  ShoppingCart, Package, TrendingUp, Users, Zap, FileText, Wallet,
  BarChart3, AlertTriangle, ChevronRight, UserPlus, Minus, Plus,
} from 'lucide-react';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import type { Company } from '@/types/cadeia';
import { getCompanyType, getSizeVariant, PRODUCTS, REGIONS, getRecipesForCompany, getPMR } from '@/data/cadeia';
import { UpgradesTab } from '@/screens/upgrades/UpgradesTab';

// ── Helpers ───────────────────────────────────────────────────────────

function fmt(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toFixed(2)}`;
}

function pmrIndicator(price: number, pmr: number) {
  if (pmr <= 0) return null;
  const r = price / pmr;
  if (r <= 0.95) return { label: '🟢 Abaixo PMR', cls: 'text-emerald-400' };
  if (r <= 1.05) return { label: '🟡 No PMR',     cls: 'text-amber-400' };
  return                { label: '🔴 Acima PMR',  cls: 'text-red-400' };
}

// Employee roles by company category
const EMPLOYEE_ROLES: Record<string, { role: string; label: string; icon: string; salary: number; bonus: string; max?: number }[]> = {
  varejo: [
    { role: 'repositor',  label: 'Repositor',  icon: '🛒', salary: 70,  bonus: '+3% reposição' },
    { role: 'atendente',  label: 'Atendente',  icon: '💁', salary: 90,  bonus: '+3% velocidade venda' },
    { role: 'caixa',      label: 'Caixa',      icon: '💳', salary: 95,  bonus: '-5% tempo fila' },
    { role: 'gerente',    label: 'Gerente',    icon: '👨‍💼', salary: 400, bonus: '+5% reputação', max: 2 },
  ],
  extracao: [
    { role: 'operario',   label: 'Operário',   icon: '⛏️', salary: 80,  bonus: '+5% produção' },
    { role: 'tecnico',    label: 'Técnico',    icon: '🔧', salary: 180, bonus: '+10% eficiência', max: 3 },
    { role: 'gerente',    label: 'Gerente',    icon: '👨‍💼', salary: 400, bonus: '+5% reputação', max: 1 },
  ],
  industria: [
    { role: 'operario',   label: 'Operário',   icon: '👷', salary: 100, bonus: '+5% produção' },
    { role: 'tecnico',    label: 'Técnico',    icon: '🔬', salary: 200, bonus: '-8% ciclo' },
    { role: 'engenheiro', label: 'Engenheiro', icon: '📐', salary: 500, bonus: '+15% eficiência', max: 2 },
    { role: 'gerente',    label: 'Gerente',    icon: '👨‍💼', salary: 400, bonus: '+5% reputação', max: 1 },
  ],
  logistica: [
    { role: 'motorista',  label: 'Motorista',  icon: '🚛', salary: 150, bonus: '+1 frete simultâneo' },
    { role: 'mecanico',   label: 'Mecânico',   icon: '🔩', salary: 200, bonus: '-10% manutenção' },
    { role: 'gerente',    label: 'Gerente',    icon: '👨‍💼', salary: 400, bonus: '+5% reputação', max: 1 },
  ],
};

// ── Tab definitions ───────────────────────────────────────────────────

type TabId = 'resumo' | 'estoque' | 'comprar' | 'vender' | 'rh' | 'upgrades' | 'contratos' | 'caixa';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'resumo',    icon: '📊', label: 'Resumo'    },
  { id: 'estoque',   icon: '📦', label: 'Estoque'   },
  { id: 'comprar',   icon: '🛒', label: 'Comprar'   },
  { id: 'vender',    icon: '💰', label: 'Vender'    },
  { id: 'rh',        icon: '👷', label: 'RH'        },
  { id: 'upgrades',  icon: '⚙️', label: 'Upgrades'  },
  { id: 'contratos', icon: '📋', label: 'Contratos' },
  { id: 'caixa',     icon: '💵', label: 'Caixa'     },
];

// ── Sub-components (each tab) ─────────────────────────────────────────

// 📊 Resumo
function TabResumo({ company, cadeia, onGoTo }: { company: Company; cadeia: UseCadeiaReturn; onGoTo: (t: TabId) => void }) {
  const def      = getCompanyType(company.typeId);
  const variant  = getSizeVariant(company.typeId, company.size);
  const region   = REGIONS.find((r) => r.id === company.regionId);
  const recipes  = getRecipesForCompany(company.typeId, company.size);
  const prod     = company.activeProductions[0];
  const minsLeft = prod ? Math.max(0, Math.ceil((prod.completesAt - Date.now()) / 60_000)) : 0;
  const pct      = prod ? Math.min(100, Math.round(((Date.now() - prod.startedAt) / (prod.completesAt - prod.startedAt)) * 100)) : 0;
  const noStock  = company.inventory.length === 0 || company.inventory.every((i) => i.quantity === 0);

  // Today's transactions
  const today = new Date().toDateString();
  const todayTxs = cadeia.state.transactions.filter(
    (t) => t.companyId === company.id && new Date(t.occurredAt).toDateString() === today,
  );
  const todayRevenue = todayTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const todayExpense = todayTxs.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const todayProfit  = todayRevenue + todayExpense;

  return (
    <div className="space-y-3 p-4">
      {/* Onboarding para empresa vazia */}
      {noStock && company.status === 'active' && (
        <div className="rounded-2xl bg-blue-900/20 border border-blue-700/30 p-4 space-y-3">
          <p className="text-blue-200 font-bold text-sm">👋 Bem-vindo ao {company.name}!</p>
          <p className="text-blue-300/80 text-xs leading-relaxed">
            Para começar a vender, você precisa comprar mercadoria.
          </p>
          <div className="space-y-1.5 text-xs text-blue-300/70">
            <p>Passo 1: Compre estoque 🛒</p>
            <p>Passo 2: Defina preços de venda 💰</p>
            <p>Passo 3: Ative auto-venda ⚙️</p>
          </div>
          <button
            onClick={() => onGoTo('comprar')}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2.5 active:scale-95 transition-all"
          >
            Começar pelo passo 1 →
          </button>
        </div>
      )}

      {/* Info geral */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-xs">Status</p>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            company.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' :
            company.status === 'paused' ? 'bg-amber-900/40 text-amber-400' :
            'bg-red-900/40 text-red-400'
          }`}>
            {company.status === 'active' ? '🟢 Ativa' : company.status === 'paused' ? '🟡 Pausada' : '🔴 Fechada'}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Localização</span>
          <span className="text-slate-300">{def.name} • {region?.icon} {region?.name}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Capacidade</span>
          <span className="text-slate-300">
            {company.inventory.reduce((s, i) => s + i.quantity, 0).toFixed(0)}/{variant.storageCapacity > 0 ? variant.storageCapacity : '∞'} un
          </span>
        </div>
      </div>

      {/* Lucro hoje */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 space-y-1.5">
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Hoje</p>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Receita</span>
          <span className="text-emerald-400 font-semibold">+{fmt(todayRevenue)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Despesas</span>
          <span className="text-red-400 font-semibold">{fmt(todayExpense)}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-slate-700/40 pt-1.5 mt-1">
          <span className="text-slate-300 font-semibold">Lucro</span>
          <span className={`font-bold ${todayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {todayProfit >= 0 ? '+' : ''}{fmt(todayProfit)}
          </span>
        </div>
      </div>

      {/* Produção em andamento */}
      {prod && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 space-y-2">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Produção</p>
          <div className="flex justify-between text-xs text-slate-400">
            <span>⚙️ Produzindo…</span>
            <span>{minsLeft}min restante · {pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Alerta sem estoque */}
      {noStock && company.status === 'active' && (
        <button
          onClick={() => onGoTo('comprar')}
          className="w-full rounded-xl bg-amber-900/20 border border-amber-700/30 p-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <span className="text-amber-300 text-sm font-semibold">Sem estoque! Vá em 🛒 Comprar</span>
          </div>
          <ChevronRight size={16} className="text-amber-400" />
        </button>
      )}

      {/* Automação */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 space-y-2.5">
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Automação</p>
        {[
          { key: 'autoProduction', label: 'Auto-produção' },
          { key: 'autoSell',       label: 'Auto-venda'    },
          { key: 'autoBuy',        label: 'Auto-compra'   },
        ].map(({ key, label }) => {
          const val = (company.config as Record<string, unknown>)[key] as boolean;
          return (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{label}</span>
              <button
                onClick={() => cadeia.updateCompanyConfig(company.id, { [key]: !val } as Partial<Company['config']>)}
                className={`transition-colors ${val ? 'text-emerald-400' : 'text-slate-600'}`}
              >
                {val ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
            </div>
          );
        })}
      </div>

      {/* Receita ativa (se múltiplas) */}
      {recipes.length > 1 && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 space-y-2">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Receita ativa</p>
          {recipes.map((r) => {
            const active = (company.config.selectedRecipeId ?? recipes[0]?.id) === r.id;
            return (
              <button
                key={r.id}
                onClick={() => cadeia.setSelectedRecipe(company.id, r.id)}
                className={`w-full text-left rounded-xl px-3 py-2 text-xs border transition-all ${
                  active ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300' : 'bg-slate-700/40 border-slate-600/30 text-slate-400'
                }`}
              >
                <span className="font-semibold">{r.name}</span>
                <span className="ml-2 opacity-60">
                  {r.inputs.map((i) => `${i.quantity} ${i.productId}`).join(', ') || 'sem insumo'} → {r.outputs.map((o) => `${o.quantity} ${o.productId}`).join(', ')}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2 pt-1">
        {company.status === 'active' && (
          <button onClick={() => cadeia.pauseCompany(company.id)} className="flex-1 py-2.5 rounded-xl bg-amber-900/30 text-amber-400 text-sm font-semibold border border-amber-700/30 active:scale-95 transition-all">
            Pausar
          </button>
        )}
        {company.status === 'paused' && (
          <button onClick={() => cadeia.resumeCompany(company.id)} className="flex-1 py-2.5 rounded-xl bg-emerald-900/30 text-emerald-400 text-sm font-semibold border border-emerald-700/30 active:scale-95 transition-all">
            Retomar
          </button>
        )}
        {company.status !== 'closed' && (
          <button onClick={() => cadeia.closeCompany(company.id)} className="flex-1 py-2.5 rounded-xl bg-red-900/30 text-red-400 text-sm font-semibold border border-red-700/30 active:scale-95 transition-all">
            Fechar empresa
          </button>
        )}
      </div>
    </div>
  );
}

// 📦 Estoque
function TabEstoque({ company, cadeia }: { company: Company; cadeia: UseCadeiaReturn; onGoTo: (t: TabId) => void }) {
  const def     = getCompanyType(company.typeId);
  const variant = getSizeVariant(company.typeId, company.size);
  const totalQty = company.inventory.reduce((s, i) => s + i.quantity, 0);
  const totalVal = company.inventory.reduce((s, i) => s + i.quantity * i.avgCost, 0);
  const usedPct  = variant.storageCapacity > 0 ? (totalQty / variant.storageCapacity) * 100 : 0;

  if (company.inventory.length === 0 || totalQty === 0) {
    return (
      <div className="p-4 space-y-4">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Capacidade usada</span>
            <span className="text-slate-300 font-semibold">0/{variant.storageCapacity > 0 ? variant.storageCapacity : '∞'} un</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-slate-400">Valor estocado</span>
            <span className="text-slate-300 font-semibold">R$ 0</span>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/40 border border-slate-700/30 p-6 text-center space-y-3">
          <Package size={40} className="mx-auto text-slate-600" />
          <p className="text-slate-400 text-sm">Você ainda não tem produtos.</p>
          <p className="text-slate-500 text-xs leading-relaxed">
            Para começar a vender, compre mercadoria de fornecedores ou outros jogadores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Capacidade usada</span>
          <span className="text-slate-300 font-semibold">{totalQty.toFixed(1)}/{variant.storageCapacity > 0 ? variant.storageCapacity : '∞'} un</span>
        </div>
        {variant.storageCapacity > 0 && (
          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${usedPct > 80 ? 'bg-red-500' : usedPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${usedPct}%` }} />
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-400">Valor estocado</span>
          <span className="text-slate-300 font-semibold">{fmt(totalVal)}</span>
        </div>
      </div>

      {company.inventory.filter((i) => i.quantity > 0).map((item) => {
        const prod  = PRODUCTS.find((p) => p.id === item.productId);
        const pmrVal = getPMR(cadeia.state.pmr, item.productId, company.regionId);
        const ind   = pmrVal ? pmrIndicator(item.avgCost, pmrVal) : null;
        return (
          <div key={item.productId} className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-white text-sm">{prod?.icon} {prod?.name ?? item.productId}</p>
                <p className="text-slate-400 text-xs mt-0.5">Estoque: {item.quantity.toFixed(1)} {prod?.unit}</p>
              </div>
              {ind && <span className={`text-[10px] font-semibold ${ind.cls}`}>{ind.label}</span>}
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Custo médio: {fmt(item.avgCost)}/{prod?.unit}</span>
              {pmrVal && <span>PMR: {fmt(pmrVal)}/{prod?.unit}</span>}
            </div>
            {company.config.minInventory[item.productId] !== undefined && (
              <p className="text-xs text-blue-400/70">
                Estoque mínimo: {company.config.minInventory[item.productId]} {prod?.unit} (auto-repor)
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 🛒 Comprar
function TabComprar({ company, cadeia }: { company: Company; cadeia: UseCadeiaReturn }) {
  const [subTab, setSubTab] = useState<'vitrine' | 'npcs' | 'solicitar'>('vitrine');
  const [qty, setQty]       = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [product, setProduct]   = useState('');
  const [validity, setValidity] = useState('24h');
  const [buyQty, setBuyQty]     = useState<Record<string, string>>({});
  const [toast, setToast]       = useState<string | null>(null);

  const def           = getCompanyType(company.typeId);
  const accepted      = def.acceptedProducts;
  const variant       = getSizeVariant(company.typeId, company.size);
  const currentStock  = company.inventory.reduce((s, i) => s + i.quantity, 0);
  const freeCapacity  = variant.storageCapacity > 0 ? variant.storageCapacity - currentStock : Infinity;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // Filter vitrine (player listings) by accepted products
  const vitrineListings = cadeia.state.marketListings.filter(
    (l) => !l.isNPC && accepted.includes(l.productId) && l.availableQty > 0,
  );

  // NPC listings
  const npcListings = cadeia.state.marketListings.filter(
    (l) => l.isNPC && accepted.includes(l.productId) && l.availableQty > 0,
  );

  const handleBuy = async (listingId: string, qty: number) => {
    const res = cadeia.buyFromSpotMarket(company.id, listingId, qty);
    if (res.ok) showToast(`Compra realizada!`);
    else showToast(`Erro: ${res.error}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 pt-4 pb-3 shrink-0">
        {(['vitrine', 'npcs', 'solicitar'] as const).map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all capitalize ${subTab === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {t === 'vitrine' ? 'Vitrine' : t === 'npcs' ? 'NPCs' : 'Solicitar'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {/* Vitrine sub-tab */}
        {subTab === 'vitrine' && (
          <>
            <p className="text-slate-500 text-xs">Produtos compatíveis com {def.name} de outros jogadores:</p>
            {vitrineListings.length === 0 && (
              <div className="text-center text-slate-500 py-10">
                <ShoppingCart size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nenhum jogador vendendo produtos compatíveis agora.</p>
                <p className="text-xs mt-1 opacity-60">Tente os NPCs ou solicite uma proposta.</p>
              </div>
            )}
            {vitrineListings.map((l) => {
              const p    = PRODUCTS.find((pr) => pr.id === l.productId);
              const pmrV = getPMR(cadeia.state.pmr, l.productId, l.regionId);
              const ind  = pmrV ? pmrIndicator(l.pricePerUnit, pmrV) : null;
              const qKey = l.id;
              return (
                <div key={l.id} className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white text-sm">{p?.icon} {p?.name ?? l.productId}</p>
                      <p className="text-slate-400 text-xs">{l.sellerName}</p>
                    </div>
                    {ind && <span className={`text-[10px] font-semibold ${ind.cls}`}>{ind.label}</span>}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white font-bold">{fmt(l.pricePerUnit)}</span>
                    <span className="text-slate-400">/{p?.unit ?? 'un'} · {l.availableQty.toFixed(1)} disp.</span>
                  </div>
                  {pmrV && (
                    <p className="text-xs text-slate-500">PMR: {fmt(pmrV)}/{p?.unit}</p>
                  )}
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number" min={1} max={Math.min(l.availableQty, freeCapacity)}
                      placeholder="Qtd"
                      value={buyQty[qKey] ?? ''}
                      onChange={(e) => setBuyQty((prev) => ({ ...prev, [qKey]: e.target.value }))}
                      className="w-20 rounded-xl bg-slate-700 border border-slate-600 text-white px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => { const q = Number(buyQty[qKey]); if (q > 0) handleBuy(l.id, q); }}
                      className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-1.5 active:scale-95 transition-all"
                    >
                      Comprar
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* NPCs sub-tab */}
        {subTab === 'npcs' && (
          <>
            <div className="rounded-xl bg-amber-900/20 border border-amber-700/30 p-3 flex gap-2">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300 text-xs leading-relaxed">
                NPCs são 15-25% mais caros que o PMR. Use só em emergências.
              </p>
            </div>
            {npcListings.length === 0 && (
              <div className="text-center text-slate-500 py-10 text-sm">Nenhum NPC disponível agora.</div>
            )}
            {npcListings.map((l) => {
              const p    = PRODUCTS.find((pr) => pr.id === l.productId);
              const pmrV = getPMR(cadeia.state.pmr, l.productId, l.regionId);
              const overPmr = pmrV ? Math.round(((l.pricePerUnit / pmrV) - 1) * 100) : 0;
              const qKey = `npc_${l.id}`;
              return (
                <div key={l.id} className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white text-sm">🏪 {p?.icon} {p?.name ?? l.productId}</p>
                      <p className="text-slate-400 text-xs">Atacadão Brasil · Sempre disponível</p>
                    </div>
                    {overPmr > 0 && (
                      <span className="text-[10px] text-red-400 font-semibold">+{overPmr}% PMR</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white font-bold">{fmt(l.pricePerUnit)}</span>
                    <span className="text-slate-400">/{p?.unit ?? 'un'}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number" min={1} max={freeCapacity}
                      placeholder="Qtd"
                      value={buyQty[qKey] ?? ''}
                      onChange={(e) => setBuyQty((prev) => ({ ...prev, [qKey]: e.target.value }))}
                      className="w-20 rounded-xl bg-slate-700 border border-slate-600 text-white px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => { const q = Number(buyQty[qKey]); if (q > 0) handleBuy(l.id, q); }}
                      className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold py-1.5 active:scale-95 transition-all"
                    >
                      Comprar NPC
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Solicitar sub-tab */}
        {subTab === 'solicitar' && (
          <div className="space-y-4">
            <p className="text-slate-500 text-xs">Publique um pedido de compra. Outros jogadores veem e podem fazer ofertas.</p>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1">Produto</label>
                <select value={product} onChange={(e) => setProduct(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Selecionar...</option>
                  {accepted.map((pid) => {
                    const p = PRODUCTS.find((pr) => pr.id === pid);
                    return <option key={pid} value={pid}>{p?.icon} {p?.name ?? pid}</option>;
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs font-medium block mb-1">Quantidade</label>
                  <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-medium block mb-1">Preço máximo (R$)</label>
                  <input type="number" min={0} step={0.01} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1">Validade</label>
                <select value={validity} onChange={(e) => setValidity(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                  {['6h','12h','24h','48h','7d'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <button
              disabled={!product || !qty || !maxPrice}
              onClick={() => showToast('Pedido publicado! (em breve outros jogadores poderão responder)')}
              className={`w-full rounded-2xl py-3 font-bold text-white transition-all ${
                product && qty && maxPrice ? 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98]' : 'bg-slate-700 opacity-50 cursor-not-allowed'
              }`}
            >
              Publicar pedido
            </button>
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-3 text-xs text-slate-500">
              Seus pedidos ativos: 0
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-full shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// 💰 Vender
function TabVender({ company, cadeia }: { company: Company; cadeia: UseCadeiaReturn }) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [toast, setToast]   = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const items = company.inventory.filter((i) => i.quantity > 0);
  const def   = getCompanyType(company.typeId);

  if (items.length === 0) {
    return (
      <div className="p-4 text-center text-slate-500 py-12">
        <TrendingUp size={36} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">Sem estoque para definir preços.</p>
        <p className="text-xs mt-1 opacity-60">Compre produtos primeiro na aba 🛒 Comprar.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Definir preços de venda</p>

      {items.map((item) => {
        const p    = PRODUCTS.find((pr) => pr.id === item.productId);
        const pmrV = getPMR(cadeia.state.pmr, item.productId, company.regionId);
        const cur  = company.config.sellPrices[item.productId] ?? (pmrV || item.avgCost * 1.1);
        const disp = Number(prices[item.productId] ?? cur);
        const ind  = pmrV ? pmrIndicator(disp, pmrV) : null;

        const speed = ind?.label.includes('🟢') ? 'rápida' : ind?.label.includes('🟡') ? 'normal' : 'lenta';

        return (
          <div key={item.productId} className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-white text-sm">{p?.icon} {p?.name ?? item.productId}</p>
                <p className="text-slate-400 text-xs">Em estoque: {item.quantity.toFixed(1)} {p?.unit}</p>
              </div>
              {ind && <span className={`text-[10px] font-semibold ${ind.cls}`}>{ind.label}</span>}
            </div>

            {pmrV && (
              <p className="text-xs text-slate-500">PMR atual: {fmt(pmrV)}/{p?.unit}</p>
            )}

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-slate-400 text-[10px] font-medium block mb-1">Seu preço</label>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 text-sm">R$</span>
                  <input
                    type="number" min={0} step={0.01}
                    value={prices[item.productId] ?? cur.toFixed(2)}
                    onChange={(e) => setPrices((prev) => ({ ...prev, [item.productId]: e.target.value }))}
                    className="flex-1 rounded-xl bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  const p = Number(prices[item.productId] ?? cur);
                  cadeia.updateCompanyConfig(company.id, { sellPrices: { ...company.config.sellPrices, [item.productId]: p } });
                  showToast('Preço atualizado!');
                }}
                className="mt-5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold active:scale-95 transition-all"
              >
                Salvar
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Velocidade prevista: <span className="text-slate-300">{speed}</span>
              {disp > item.avgCost && (
                <span className="ml-2 text-emerald-400">Margem: +{fmt(disp - item.avgCost)}/{p?.unit}</span>
              )}
            </p>

            <div className="flex items-center justify-between border-t border-slate-700/40 pt-2">
              <span className="text-xs text-slate-400">Auto-venda</span>
              <button
                onClick={() => cadeia.updateCompanyConfig(company.id, { autoSell: !company.config.autoSell })}
                className={`transition-colors ${company.config.autoSell ? 'text-emerald-400' : 'text-slate-600'}`}
              >
                {company.config.autoSell ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>
            </div>
          </div>
        );
      })}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-full shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// 👷 RH
function TabRH({ company, cadeia }: { company: Company; cadeia: UseCadeiaReturn }) {
  const def   = getCompanyType(company.typeId);
  const roles = EMPLOYEE_ROLES[def.category] ?? EMPLOYEE_ROLES.extracao!;
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [toast, setToast]   = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const totalSalary = Object.entries(counts).reduce((s, [, n]) => s + n * (roles.find((r) => r.role === Object.keys(counts)[0])?.salary ?? 0), 0);

  const hire = (role: string, salary: number, max?: number) => {
    const cur = counts[role] ?? 0;
    if (max !== undefined && cur >= max) { showToast(`Máximo de ${max} para esta função`); return; }
    const dayCost = salary;
    if (company.capital < dayCost * 7) { showToast(`Caixa insuficiente para 1 semana de salário`); return; }
    setCounts((prev) => ({ ...prev, [role]: (prev[role] ?? 0) + 1 }));
    showToast(`+1 ${role} contratado!`);
  };

  const fire = (role: string) => {
    setCounts((prev) => ({ ...prev, [role]: Math.max(0, (prev[role] ?? 0) - 1) }));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400">Funcionários</span>
          <span className="text-white font-semibold">
            {Object.values(counts).reduce((s, n) => s + n, 0)} contratados
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Salários diários</span>
          <span className="text-red-400 font-semibold">{fmt(Object.entries(counts).reduce((s, [r, n]) => s + n * (roles.find((ro) => ro.role === r)?.salary ?? 0), 0))}</span>
        </div>
      </div>

      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Tipos disponíveis</p>

      {roles.map((r) => {
        const n = counts[r.role] ?? 0;
        return (
          <div key={r.role} className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-white text-sm">{r.icon} {r.label}</p>
                <p className="text-slate-400 text-xs">{fmt(r.salary)}/dia · {r.bonus}</p>
                {r.max && <p className="text-slate-500 text-xs">Máx: {r.max}</p>}
              </div>
              <span className="text-slate-400 text-sm">Tem: {n}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fire(r.role)}
                disabled={n === 0}
                className={`p-2 rounded-xl transition-all ${n > 0 ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50 active:scale-95' : 'bg-slate-700/30 text-slate-600 cursor-not-allowed'}`}
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => hire(r.role, r.salary, r.max)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-2 active:scale-95 transition-all"
              >
                <UserPlus size={14} /> Contratar +1
              </button>
            </div>
          </div>
        );
      })}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-full shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// 📋 Contratos
function TabContratos() {
  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl bg-slate-800/40 border border-slate-700/30 p-6 text-center space-y-3">
        <FileText size={40} className="mx-auto text-slate-600" />
        <p className="text-white font-semibold text-sm">Contratos ativos: 0</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          Contratos garantem volume e preço fixo, criando previsibilidade no fornecimento.
        </p>
      </div>
      <button className="w-full rounded-2xl bg-blue-600/20 border border-blue-700/30 text-blue-300 text-sm font-semibold py-3 hover:bg-blue-600/30 active:scale-[0.98] transition-all">
        Propor contrato a outro jogador
      </button>
      <div className="rounded-2xl bg-slate-800/40 border border-slate-700/30 p-4 text-sm text-slate-500">
        <p className="font-semibold mb-1">Contratos recebidos: 0</p>
        <p className="text-xs">Quando alguém propor um contrato para você, aparece aqui.</p>
      </div>
    </div>
  );
}

// 💵 Caixa
function TabCaixa({ company, cadeia }: { company: Company; cadeia: UseCadeiaReturn }) {
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [depositAmt,  setDepositAmt]  = useState('');
  const [toast, setToast]             = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const variant = getSizeVariant(company.typeId, company.size);

  const recentTxs = cadeia.state.transactions
    .filter((t) => t.companyId === company.id)
    .slice(-15)
    .reverse();

  const today = new Date().toDateString();
  const todayChange = cadeia.state.transactions
    .filter((t) => t.companyId === company.id && new Date(t.occurredAt).toDateString() === today)
    .reduce((s, t) => s + t.amount, 0);

  const handleWithdraw = () => {
    const amt = parseFloat(withdrawAmt);
    if (isNaN(amt) || amt <= 0) return;
    const r = cadeia.withdrawFromCompany(company.id, amt);
    if (r.ok) { setWithdrawAmt(''); showToast(`Retirado ${fmt(amt)} (imposto aplicado)`); }
    else showToast(`Erro: ${r.error}`);
  };

  const handleDeposit = () => {
    const amt = parseFloat(depositAmt);
    if (isNaN(amt) || amt <= 0) return;
    const r = cadeia.depositToCompany(company.id, amt);
    if (r.ok) { setDepositAmt(''); showToast(`Depositado ${fmt(amt)}`); }
    else showToast(`Erro: ${r.error}`);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Saldo */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/40 p-4">
        <p className="text-slate-400 text-xs mb-1">Caixa atual</p>
        <p className="text-2xl font-bold text-white">{fmt(company.capital)}</p>
        <p className={`text-sm mt-1 ${todayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          Mudança hoje: {todayChange >= 0 ? '+' : ''}{fmt(todayChange)}
        </p>
      </div>

      {/* Ações */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-slate-400 text-xs font-medium">↑ Retirar (10% imposto)</label>
          <div className="flex gap-1.5">
            <input
              type="number" min={1} value={withdrawAmt}
              onChange={(e) => setWithdrawAmt(e.target.value)}
              placeholder="R$ valor"
              className="flex-1 min-w-0 rounded-xl bg-slate-800 border border-slate-600 text-white px-2 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
            <button onClick={handleWithdraw} className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white active:scale-95 transition-all">
              <ArrowUpToLine size={15} />
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-slate-400 text-xs font-medium">↓ Depositar (livre)</label>
          <div className="flex gap-1.5">
            <input
              type="number" min={1} value={depositAmt}
              onChange={(e) => setDepositAmt(e.target.value)}
              placeholder="R$ valor"
              className="flex-1 min-w-0 rounded-xl bg-slate-800 border border-slate-600 text-white px-2 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button onClick={handleDeposit} className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white active:scale-95 transition-all">
              <ArrowDownToLine size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Próximos compromissos */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-3 space-y-1.5 text-sm">
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Próximos compromissos</p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">• Custos fixos (em ~12min)</span>
          <span className="text-red-400">-{fmt(variant.operationalCostPerDay)}</span>
        </div>
      </div>

      {/* Extrato */}
      {recentTxs.length > 0 && (
        <div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Últimas movimentações</p>
          <div className="space-y-1.5">
            {recentTxs.map((tx) => (
              <div key={tx.id} className="rounded-xl bg-slate-800/40 border border-slate-700/30 px-3 py-2 flex items-center justify-between">
                <span className="text-slate-300 text-xs truncate flex-1">{tx.description}</span>
                <span className={`text-xs font-semibold ml-2 shrink-0 ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-full shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── CompanyDetailScreen ───────────────────────────────────────────────

interface Props {
  company: Company;
  cadeia:  UseCadeiaReturn;
  onBack:  () => void;
}

export function CompanyDetailScreen({ company, cadeia, onBack }: Props) {
  const [tab, setTab] = useState<TabId>('resumo');
  const def    = getCompanyType(company.typeId);
  const region = REGIONS.find((r) => r.id === company.regionId);

  // Alert badges per tab
  const noStock    = company.inventory.every((i) => i.quantity === 0);
  const lowCapital = company.capital < 500;

  const badgeFor = (t: TabId): string | null => {
    if (t === 'estoque' && noStock && company.status === 'active') return '!';
    if (t === 'caixa'   && lowCapital) return '!';
    return null;
  };

  return (
    <div
      className="flex flex-col min-h-[100dvh] bg-slate-950 text-slate-100"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-800 active:scale-95 transition-all">
          <ArrowLeft size={18} className="text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{def.icon}</span>
            <p className="font-bold text-white text-base truncate">{company.name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              company.status === 'active' ? 'bg-emerald-900/50 text-emerald-400' :
              company.status === 'paused' ? 'bg-amber-900/50 text-amber-400' :
              'bg-red-900/50 text-red-400'
            }`}>
              {company.status === 'active' ? '● Ativa' : company.status === 'paused' ? '● Pausada' : '● Fechada'}
            </span>
          </div>
          <p className="text-slate-500 text-xs">{def.name} · {region?.icon} {region?.name}</p>
        </div>
        <p className="text-emerald-400 font-bold text-sm shrink-0">{fmt(company.capital)}</p>
      </header>

      {/* Tab bar — scrollable horizontal */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-slate-800/60 shrink-0 px-2">
        {TABS.map((t) => {
          const badge  = badgeFor(t.id);
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex-shrink-0 flex flex-col items-center px-3 py-2.5 text-[11px] font-semibold transition-all border-b-2 ${
                active ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span className="mt-0.5">{t.label}</span>
              {badge && (
                <span className="absolute top-1.5 right-1 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {tab === 'resumo'    && <TabResumo    company={company} cadeia={cadeia} onGoTo={setTab} />}
        {tab === 'estoque'   && <TabEstoque   company={company} cadeia={cadeia} onGoTo={setTab} />}
        {tab === 'comprar'   && <TabComprar   company={company} cadeia={cadeia} />}
        {tab === 'vender'    && <TabVender    company={company} cadeia={cadeia} />}
        {tab === 'rh'        && <TabRH        company={company} cadeia={cadeia} />}
        {tab === 'upgrades'  && <UpgradesTab  company={company} cadeia={cadeia} />}
        {tab === 'contratos' && <TabContratos />}
        {tab === 'caixa'     && <TabCaixa     company={company} cadeia={cadeia} />}
      </div>
    </div>
  );
}
