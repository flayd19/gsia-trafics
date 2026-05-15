// =====================================================================
// HubScreen.tsx — Tela inicial (Hub) com 6 módulos (Doc 05)
// Grid 2×3 de cards modulares, saldo pessoal, alertas críticos, FAB
// =====================================================================

import { Bell, Plus, Building2, ShoppingBag, Map, Handshake, BarChart3, User, Share, ArrowDownToLine, X } from 'lucide-react';
import type { HubModule } from '@/types/cadeia';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import { usePWAInstall } from '@/hooks/usePWAInstall';

interface Props {
  cadeia: UseCadeiaReturn;
  onNavigate: (module: HubModule) => void;
  bankBalance?: number;
}

function fmt(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(2)}`;
}

type ModuleDef = {
  id: HubModule;
  label: string;
  subLabel?: (props: Props) => string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
};

const MODULES: ModuleDef[] = [
  {
    id: 'empresas',
    label: 'Minhas Empresas',
    subLabel: ({ cadeia }) => {
      const n = cadeia.state.companies.filter(c => c.status === 'active').length;
      return `${n} ativa${n !== 1 ? 's' : ''}`;
    },
    icon: Building2,
    gradient: 'from-slate-700 to-slate-800',
  },
  {
    id: 'mercado',
    label: 'Mercado',
    subLabel: ({ cadeia }) => {
      const n = cadeia.state.marketListings.filter(l => l.availableQty > 0).length;
      return `${n} oferta${n !== 1 ? 's' : ''}`;
    },
    icon: ShoppingBag,
    gradient: 'from-blue-900 to-blue-800',
  },
  {
    id: 'mapa',
    label: 'Mapa',
    icon: Map,
    gradient: 'from-emerald-900 to-emerald-800',
  },
  {
    id: 'negociacoes',
    label: 'Negociações',
    icon: Handshake,
    gradient: 'from-amber-900 to-amber-800',
  },
  {
    id: 'financas',
    label: 'Finanças',
    icon: BarChart3,
    gradient: 'from-purple-900 to-purple-800',
  },
  {
    id: 'perfil',
    label: 'Perfil',
    icon: User,
    gradient: 'from-rose-900 to-rose-800',
  },
];

export function HubScreen({ cadeia, onNavigate, bankBalance = 0 }: Props) {
  const { state } = cadeia;
  const { installState, triggerInstall, dismissInstall } = usePWAInstall();

  const unreadCount   = state.notifications.filter(n => !n.read).length;
  const companyCash   = state.companies.reduce((s, c) => s + c.capital, 0);
  const todayProfit   = state.transactions
    .filter(t => {
      const d = new Date(t.date || 0);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    })
    .reduce((s, t) => s + (t.amount || 0), 0);

  // Critical alerts
  const alerts: string[] = [];
  state.companies.forEach(c => {
    if (c.status === 'active' && c.capital < 500)
      alerts.push(`${c.name}: caixa crítico (${fmt(c.capital)})`);
  });
  if (bankBalance < 0) alerts.push('Saldo bancário negativo!');

  const moduleCards = MODULES.map(m => ({
    ...m,
    badge: m.id === 'negociacoes' ? unreadCount : 0,
    sub:   m.subLabel ? m.subLabel({ cadeia, onNavigate, bankBalance }) : undefined,
  }));

  return (
    <div
      className="flex flex-col min-h-[100dvh] bg-slate-950 text-slate-100"
      style={{
        paddingTop:    'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-white">Cadeia</h1>
        <button
          onClick={() => onNavigate('negociacoes')}
          className="relative p-2 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all"
          aria-label="Notificações"
        >
          <Bell size={18} className="text-slate-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </header>

      {/* ── Scrollable content ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>

        {/* Balance card */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 p-5">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Patrimônio Total</p>
          <p className="text-4xl font-bold text-white">{fmt(state.playerCapital + companyCash)}</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-slate-700/30 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Pessoal</p>
              <p className="text-sm font-bold text-white mt-0.5">{fmt(state.playerCapital)}</p>
            </div>
            <div className="bg-slate-700/30 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Empresas</p>
              <p className="text-sm font-bold text-white mt-0.5">{fmt(companyCash)}</p>
            </div>
          </div>
          {Math.abs(todayProfit) > 0 && (
            <p className={`text-xs font-semibold mt-2 ${todayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {todayProfit >= 0 ? '▲' : '▼'} {todayProfit >= 0 ? '+' : ''}{fmt(todayProfit)} hoje
            </p>
          )}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="rounded-xl bg-amber-900/30 border border-amber-700/40 p-3 space-y-1">
            <p className="text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-1">⚠ Atenção</p>
            {alerts.map((a, i) => (
              <p key={i} className="text-amber-300 text-sm">• {a}</p>
            ))}
          </div>
        )}

        {/* PWA iOS — antes do grid de módulos */}
        {installState === 'ios-safari' && (
          <div className="rounded-2xl bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border border-blue-700/30 p-4 flex items-start gap-3">
            <span className="text-2xl mt-0.5 shrink-0">📲</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-200 mb-1">Instalar no iPhone</p>
              <p className="text-xs text-blue-300/70 leading-relaxed">
                Toque em <Share size={11} className="inline mx-0.5" /> <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>
              </p>
            </div>
            <button onClick={dismissInstall} className="text-blue-400/50 hover:text-blue-300 shrink-0">
              <X size={16} />
            </button>
          </div>
        )}

        {/* PWA Android — antes do grid de módulos */}
        {installState === 'android-chrome' && (
          <button
            onClick={triggerInstall}
            className="w-full rounded-xl bg-green-900/30 border border-green-700/40 p-3 flex items-center gap-3"
          >
            <ArrowDownToLine size={20} className="text-green-400 shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-green-300 text-sm font-semibold">Instalar app</p>
              <p className="text-green-400/60 text-xs">Adicionar Cadeia à tela inicial</p>
            </div>
            <button onClick={e => { e.stopPropagation(); dismissInstall(); }} className="text-green-400/50">
              <X size={14} />
            </button>
          </button>
        )}

        {/* Modules grid */}
        <div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">Módulos</p>
          <div className="grid grid-cols-2 gap-3">
            {moduleCards.map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => onNavigate(m.id)}
                  className={`relative bg-gradient-to-br ${m.gradient} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[108px] border border-white/5 hover:opacity-90 active:scale-[0.97] transition-all`}
                >
                  {m.badge > 0 && (
                    <span className="absolute top-2.5 right-2.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {m.badge > 9 ? '9+' : m.badge}
                    </span>
                  )}
                  <Icon size={30} className="text-white/80" />
                  <span className="text-sm font-semibold text-white text-center leading-tight">{m.label}</span>
                  {m.sub && <span className="text-white/40 text-xs">{m.sub}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Spacer for FAB */}
        <div className="h-16" />
      </main>

      {/* ── FAB ────────────────────────────────────────────────────── */}
      <button
        onClick={() => onNavigate('empresas')}
        style={{ bottom: `calc(1.5rem + env(safe-area-inset-bottom))` }}
        className="fixed right-5 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-900/40 flex items-center justify-center z-50 active:scale-95 transition-all"
        aria-label="Criar empresa"
      >
        <Plus size={24} className="text-white" />
      </button>
    </div>
  );
}
