import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Home,
  MoreHorizontal,
  Settings as SettingsIcon,
  LogOut,
  User,
  Trophy,
  X,
  DollarSign,
  ShoppingBag,
  Wrench,
  Car,
  Zap,
  MessageSquare,
  Briefcase,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAudio } from '@/hooks/useAudio';
import { ensureReputation, levelProgress, xpRequiredForLevel, MAX_LEVEL } from '@/lib/reputation';
import type { Reputation } from '@/types/game';

/* ----------------------------------------------------------------
 * Tab metadata — Compra & Venda de Carros
 * 5 principais no bottom tab bar; resto no sheet "Mais".
 * ---------------------------------------------------------------- */

type TabDef = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};

const PRIMARY_TABS: TabDef[] = [
  { id: 'garagem',      label: 'Garagem',      icon: Car },
  { id: 'fornecedores', label: 'Comprar',       icon: ShoppingBag },
  { id: 'oficina',      label: 'Oficina',       icon: Wrench },
  { id: 'vendas',       label: 'Vendas',        icon: DollarSign },
];

const SECONDARY_TABS: TabDef[] = [
  { id: 'home',        label: 'Início',       icon: Home },
  { id: 'rachas',      label: 'Rachas',       icon: Zap },
  { id: 'chat',        label: 'Chat',         icon: MessageSquare },
  { id: 'employees',   label: 'Funcionários', icon: Briefcase },
  { id: 'ranking',     label: 'Ranking',      icon: Trophy },
  { id: 'settings',    label: 'Ajustes',      icon: SettingsIcon },
];

/* ---------------------------------------------------------------- */

interface GameLayoutProps {
  children: React.ReactNode;
  money: number;
  garageCount: number;
  gameTime: { day: number; time: string };
  onTabChange: (tab: string) => void;
  currentTab: string;
  isSyncing?: boolean;
  user?: { email?: string } | null;
  onLogout?: () => void;
  reputation?: Reputation;
}

export const GameLayout = ({
  children,
  money,
  garageCount,
  gameTime,
  onTabChange,
  currentTab,
  isSyncing,
  user,
  onLogout,
  reputation,
}: GameLayoutProps) => {
  const [displayName, setDisplayName] = useState<string>('');
  const [moreOpen, setMoreOpen] = useState(false);
  const { playClickSound } = useAudio();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const fetchDisplayName = async () => {
      if (!user?.email) return;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data: profile } = await supabase
        .from('player_profiles')
        .select('display_name')
        .eq('user_id', authUser.id)
        .maybeSingle();
      const name = profile?.display_name || user.email.split('@')[0] || 'Jogador';
      setDisplayName(name.length > 15 ? name.substring(0, 15) : name);
    };
    fetchDisplayName();
  }, [user?.email]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

  const formatMoney = (amount: number) => {
    // BUG FIX: defesa contra NaN/Infinity. Intl.NumberFormat formata NaN como
    // a string literal "NaN", causando a HUD aparecer "NaN" para o jogador.
    const safe = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(safe);
  };

  const currentTabInPrimary = useMemo(
    () => PRIMARY_TABS.some((t) => t.id === currentTab),
    [currentTab]
  );

  const handleTab = (id: string) => {
    playClickSound();
    setMoreOpen(false);
    onTabChange(id);
  };

  const isNegative = money < 0;

  const rep = ensureReputation(reputation);
  const isMaxLevel = rep.level >= MAX_LEVEL;
  const xpNeeded = isMaxLevel ? 0 : xpRequiredForLevel(rep.level + 1);
  const xpProgressPct = Math.round(levelProgress(rep) * 100);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Nav Bar */}
      <header className="ios-nav-bar">
        <div className="flex items-center justify-between py-2">
          {/* Brand */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ background: 'var(--gradient-primary)' }}
            >
              🚗
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-game-title text-[15px] font-bold text-foreground tracking-tight truncate">
                GSIA Carros
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[11px] font-bold text-primary tabular-nums">
                  📅 {gameTime.time}
                </span>
                {isSyncing && (
                  <span className="text-[10px] text-muted-foreground opacity-70">· sync…</span>
                )}
              </div>
            </div>
          </div>

          {/* User chip */}
          <div className="flex items-center gap-1">
            {user && (
              <div className="flex items-center gap-1 ios-surface px-2 py-1 !shadow-none">
                <User size={12} className="text-muted-foreground" />
                <span className="text-[11px] font-semibold text-foreground truncate max-w-[80px]">
                  {displayName || user.email?.split('@')[0]}
                </span>
                {onLogout && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLogout}
                    className="h-6 w-6 p-0"
                    aria-label="Sair"
                  >
                    <LogOut size={12} className="text-danger" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* HUD balance */}
        <div className="pb-2">
          <div
            className={`ios-surface flex items-center gap-3 px-3 py-2 ${
              isNegative ? 'border-danger/40' : ''
            }`}
          >
            <div
              className={`w-9 h-9 rounded-[12px] flex items-center justify-center text-white text-base shadow-sm ${
                isNegative ? 'bg-danger' : ''
              }`}
              style={!isNegative ? { background: 'var(--gradient-primary)' } : undefined}
            >
              {isNegative ? '🏦' : '💰'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Saldo disponível
              </div>
              <div
                className={`font-game-title tabular-nums text-lg font-bold leading-tight ${
                  isNegative ? 'text-danger' : 'text-foreground'
                }`}
              >
                {formatMoney(money)}
              </div>
              {isNegative && (
                <div className="text-[10px] text-danger font-semibold animate-pulse">
                  Cheque especial
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-0.5">
              <div className="text-[10px] text-muted-foreground tabular-nums">
                🚗 {garageCount} carros
              </div>
              <button
                onClick={() => handleTab('settings')}
                className="text-[10px] text-primary font-semibold px-1.5 py-0.5 rounded-md hover:bg-primary/10 active:scale-95 transition"
                aria-label="Abrir ajustes"
              >
                Ajustes
              </button>
            </div>
          </div>

          {/* Reputação */}
          <div className="mt-2 flex items-center gap-2">
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full text-white text-[11px] font-bold shadow-sm"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <span>⭐</span>
              <span className="tabular-nums">Nv {rep.level}</span>
              {isMaxLevel && <span className="text-[9px] opacity-90">MAX</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${xpProgressPct}%`, background: 'var(--gradient-primary)' }}
                />
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums leading-none">
                {isMaxLevel
                  ? `XP total ${rep.totalXp}`
                  : `${rep.xp} / ${xpNeeded} XP · próximo Nv ${rep.level + 1}`}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main ref={mainRef} className="flex-1 overflow-y-auto smooth-scroll pb-tabbar">
        <div className="px-3 py-3 animate-fade-in max-w-[640px] mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Bottom Tab Bar */}
      <nav className="ios-tab-bar" role="tablist" aria-label="Navegação principal">
        <div className="flex items-stretch justify-around px-1">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                data-active={active ? 'true' : 'false'}
                onClick={() => handleTab(tab.id)}
                className="ios-tab-item touch-manipulation"
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <button
            role="tab"
            aria-selected={!currentTabInPrimary || moreOpen}
            data-active={!currentTabInPrimary || moreOpen ? 'true' : 'false'}
            onClick={() => { playClickSound(); setMoreOpen(v => !v); }}
            className="ios-tab-item touch-manipulation"
            aria-label="Mais opções"
          >
            <MoreHorizontal size={22} strokeWidth={!currentTabInPrimary ? 2.4 : 2} />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      {/* "Mais" — action sheet */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end"
          onClick={() => setMoreOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/35 animate-fade-in" />
          <div
            className="relative w-full max-w-[640px] mx-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
          >
            <div
              className="ios-surface-elevated mx-3 mb-3 overflow-hidden"
              style={{ borderRadius: 'var(--radius-lg)' }}
            >
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Mais opções
                </div>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground active:scale-95"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="divide-y divide-border">
                {SECONDARY_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = currentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left touch-manipulation active:bg-muted transition ${active ? 'bg-primary/5' : ''}`}
                    >
                      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                        <Icon size={18} />
                      </div>
                      <span className={`flex-1 font-semibold text-[15px] ${active ? 'text-primary' : 'text-foreground'}`}>
                        {tab.label}
                      </span>
                      {active && (
                        <span className="text-[10px] text-primary font-bold uppercase tracking-wider">atual</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ height: 'var(--safe-bottom)' }} />
          </div>
        </div>
      )}
    </div>
  );
};
