// =====================================================================
// InicioScreen.tsx — Dashboard principal do jogo Cadeia
// Visão geral: capital, empresas, notificações, atalhos
// =====================================================================

import { useState } from 'react';
import { Building2, TrendingUp, TrendingDown, Bell, Plus, ChevronRight, Factory, Truck, ShoppingCart, Pickaxe, X, Share, ArrowDownToLine } from 'lucide-react';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import { getCompanyType } from '@/data/cadeia';
import { usePWAInstall } from '@/hooks/usePWAInstall';

interface Props {
  cadeia: UseCadeiaReturn;
  onNavigate: (tab: string) => void;
}

function fmt(value: number): string {
  if (value >= 1_000_000) return `R$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `R$${(value / 1_000).toFixed(1)}k`;
  return `R$${value.toFixed(2)}`;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  extracao: <Pickaxe size={16} />,
  industria: <Factory size={16} />,
  logistica: <Truck size={16} />,
  varejo: <ShoppingCart size={16} />,
};

export function InicioScreen({ cadeia, onNavigate }: Props) {
  const { state, markNotificationRead, clearNotifications } = cadeia;
  const [showNotifs, setShowNotifs] = useState(false);
  const { installState, triggerInstall, dismissInstall } = usePWAInstall();

  const activeCompanies = state.companies.filter((c) => c.status === 'active');
  const totalCompanyCapital = state.companies.reduce((sum, c) => sum + c.capital, 0);
  const unreadCount = state.notifications.filter((n) => !n.read).length;

  // Últimas 5 transações com valor
  const recentTxns = [...state.transactions]
    .reverse()
    .filter((t) => t.amount !== 0)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">

      {/* ── Banner de instalação iOS ─────────────────────────────── */}
      {installState === 'ios-safari' && (
        <div className="rounded-2xl bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-500/30 p-4 flex items-start gap-3">
          <span className="text-2xl mt-0.5">📲</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-200 mb-1">Instalar no iPhone</p>
            <p className="text-xs text-blue-300/80 leading-relaxed">
              Toque em <Share size={12} className="inline mx-0.5 text-blue-300" /> <strong>Compartilhar</strong> e depois em{' '}
              <strong>Adicionar à Tela de Início</strong> para jogar offline como app nativo.
            </p>
          </div>
          <button
            onClick={dismissInstall}
            className="text-blue-400/60 hover:text-blue-300 shrink-0 mt-0.5"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Banner de instalação Android/Chrome ──────────────────── */}
      {installState === 'android-chrome' && (
        <button
          className="rounded-2xl bg-gradient-to-r from-green-900/60 to-emerald-900/60 border border-green-500/30 p-4 flex items-center gap-3 w-full text-left"
          onClick={triggerInstall}
        >
          <ArrowDownToLine size={22} className="text-green-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-200">Instalar app</p>
            <p className="text-xs text-green-300/80">Adicionar Cadeia à tela inicial</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); dismissInstall(); }}
            className="text-green-400/60 hover:text-green-300 shrink-0"
          >
            <X size={16} />
          </button>
        </button>
      )}

      {/* ── Cabeçalho de riqueza ────────────────────────────────── */}
      <div className="ios-card p-5 flex flex-col gap-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Caixa Pessoal</p>
        <p className="text-3xl font-bold text-primary">{fmt(state.playerCapital)}</p>
        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp size={12} className="text-green-400" />
            Total ganho: {fmt(state.totalEarned)}
          </span>
          <span className="flex items-center gap-1">
            <TrendingDown size={12} className="text-red-400" />
            Total gasto: {fmt(state.totalSpent)}
          </span>
        </div>
      </div>

      {/* ── Estatísticas rápidas ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="ios-card p-3 flex flex-col items-center gap-1">
          <Building2 size={20} className="text-primary" />
          <p className="text-xl font-bold">{activeCompanies.length}</p>
          <p className="text-[11px] text-muted-foreground text-center">Empresas</p>
        </div>
        <div className="ios-card p-3 flex flex-col items-center gap-1">
          <TrendingUp size={20} className="text-green-400" />
          <p className="text-xl font-bold">{fmt(totalCompanyCapital)}</p>
          <p className="text-[11px] text-muted-foreground text-center">Nas Empresas</p>
        </div>
        <div className="ios-card p-3 flex flex-col items-center gap-1">
          <Bell size={20} className={unreadCount > 0 ? 'text-yellow-400' : 'text-muted-foreground'} />
          <p className="text-xl font-bold">{unreadCount}</p>
          <p className="text-[11px] text-muted-foreground text-center">Alertas</p>
        </div>
      </div>

      {/* ── Empresas ativas ──────────────────────────────────────── */}
      <div className="ios-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Minhas Empresas</h2>
          <button
            className="flex items-center gap-1 text-xs text-primary"
            onClick={() => onNavigate('empresas')}
          >
            Ver todas <ChevronRight size={12} />
          </button>
        </div>

        {activeCompanies.length === 0 ? (
          <div className="text-center py-6">
            <Building2 size={32} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma empresa ainda</p>
            <button
              className="btn-gaming mt-3 text-xs px-4 py-2"
              onClick={() => onNavigate('empresas')}
            >
              <Plus size={14} className="inline mr-1" /> Abrir primeira empresa
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {activeCompanies.slice(0, 4).map((company) => {
              const def = getCompanyType(company.typeId);
              const hasProduction = company.activeProductions.length > 0;
              const minsLeft = hasProduction
                ? Math.max(0, Math.ceil((company.activeProductions[0]!.completesAt - Date.now()) / 60_000))
                : null;

              return (
                <button
                  key={company.id}
                  className="flex items-center gap-3 p-2 rounded-xl bg-background/40 hover:bg-background/60 transition-colors text-left w-full"
                  onClick={() => onNavigate('empresas')}
                >
                  <span className="text-xl">{def.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{def.name} • {fmt(company.capital)}</p>
                  </div>
                  {hasProduction && minsLeft !== null && (
                    <span className="neon-badge text-[10px] whitespace-nowrap">
                      ⚙️ {minsLeft}min
                    </span>
                  )}
                  {!hasProduction && def.category !== 'logistica' && (
                    <span className="text-[10px] text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                      Ocioso
                    </span>
                  )}
                </button>
              );
            })}
            {activeCompanies.length > 4 && (
              <p className="text-xs text-muted-foreground text-center mt-1">
                +{activeCompanies.length - 4} outras empresas
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Transações recentes ───────────────────────────────────── */}
      {recentTxns.length > 0 && (
        <div className="ios-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Últimas Transações</h2>
            <button
              className="text-xs text-primary flex items-center gap-1"
              onClick={() => onNavigate('relatorios')}
            >
              Ver todas <ChevronRight size={12} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {recentTxns.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="text-base">{t.amount > 0 ? '💰' : '💸'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate text-foreground/80">{t.description}</p>
                  <p className="text-[11px] text-muted-foreground">{t.companyName}</p>
                </div>
                <span
                  className={`text-xs font-bold whitespace-nowrap ${
                    t.amount > 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {t.amount > 0 ? '+' : ''}{fmt(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Notificações ─────────────────────────────────────────── */}
      {state.notifications.length > 0 && (
        <div className="ios-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              Notificações
              {unreadCount > 0 && (
                <span className="neon-badge text-[10px]">{unreadCount}</span>
              )}
            </h2>
            <button
              className="text-xs text-muted-foreground"
              onClick={clearNotifications}
            >
              Limpar
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {[...state.notifications].reverse().slice(0, 5).map((n) => (
              <button
                key={n.id}
                className={`flex items-start gap-2 p-2 rounded-xl text-left w-full transition-colors ${
                  n.read ? 'opacity-50' : 'bg-background/40'
                }`}
                onClick={() => markNotificationRead(n.id)}
              >
                <span className="text-base mt-0.5">
                  {n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : n.type === 'error' ? '❌' : 'ℹ️'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground">{n.message}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
