import { useState, useEffect, useMemo, useRef } from 'react';
import {
  MoreHorizontal,
  Settings as SettingsIcon,
  LogOut,
  User,
  X,
  Home,
  Building2,
  ShoppingBag,
  BarChart3,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAudio } from '@/hooks/useAudio';

// ── Tab definitions ───────────────────────────────────────────────────

type TabDef = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};

const PRIMARY_TABS: TabDef[] = [
  { id: 'inicio',    label: 'Início',    icon: Home },
  { id: 'empresas',  label: 'Empresas',  icon: Building2 },
  { id: 'mercado',   label: 'Mercado',   icon: ShoppingBag },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
];

const SECONDARY_TABS: TabDef[] = [
  { id: 'settings', label: 'Ajustes', icon: SettingsIcon },
];

// ── Props ─────────────────────────────────────────────────────────────

interface GameLayoutProps {
  children:        React.ReactNode;
  money:           number;
  companiesCount:  number;
  onTabChange:     (tab: string) => void;
  currentTab:      string;
  user?:           { email?: string } | null;
  onLogout?:       () => void;
  playerName?:     string;
  unreadCount?:    number;
}

export const GameLayout = ({
  children,
  money,
  companiesCount,
  onTabChange,
  currentTab,
  user,
  onLogout,
  playerName,
  unreadCount = 0,
}: GameLayoutProps) => {
  const [displayName, setDisplayName] = useState<string>('');
  const [moreOpen, setMoreOpen]       = useState(false);
  const { playClickSound }            = useAudio();
  const mainRef                       = useRef<HTMLElement>(null);

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
      const name = profile?.display_name || playerName || user.email.split('@')[0] || 'Jogador';
      setDisplayName(name.length > 15 ? name.substring(0, 15) : name);
    };
    fetchDisplayName();
  }, [user?.email, playerName]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

  const formatMoney = (amount: number) => {
    const safe = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
    if (Math.abs(safe) >= 1_000_000)
      return `R$${(safe / 1_000_000).toFixed(2)}M`;
    if (Math.abs(safe) >= 1_000)
      return `R$${(safe / 1_000).toFixed(1)}k`;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(safe);
  };

  const currentTabInPrimary = useMemo(
    () => PRIMARY_TABS.some((t) => t.id === currentTab),
    [currentTab],
  );

  const handleTab = (id: string) => {
    playClickSound();
    setMoreOpen(false);
    onTabChange(id);
  };

  const isNegative = money < 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--gradient-bg)', backgroundAttachment: 'fixed' }}
    >
      {/* ── Top Header ── */}
      <header className="ios-nav-bar">
        <div className="flex items-center justify-between gap-2 py-2.5">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-[14px] flex items-center justify-center text-lg shadow-md flex-shrink-0"
              style={{
                background: 'var(--gradient-primary-btn)',
                boxShadow: 'var(--shadow-md), var(--glow-primary-sm), inset 0 1px 0 hsl(0 0% 100% / 0.25)',
              }}
            >
              🏭
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span
                className="font-game-title text-[15px] tracking-tight truncate"
                style={{ color: 'hsl(var(--foreground))', textShadow: '0 1px 8px hsl(228 35% 2% / 0.5)' }}
              >
                CADEIA
              </span>
              <span
                className="text-[10px]"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                Gerenciamento Econômico
              </span>
            </div>
          </div>

          {/* User chip */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {user && (
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-full"
                style={{
                  background: 'hsl(228 30% 18%)',
                  border: '1px solid hsl(var(--border) / 0.6)',
                  boxShadow: 'var(--shadow-sm), var(--bevel-light)',
                }}
              >
                <User size={11} style={{ color: 'hsl(var(--muted-foreground))' }} />
                <span
                  className="text-[11px] font-bold truncate max-w-[72px]"
                  style={{ color: 'hsl(var(--foreground))' }}
                >
                  {displayName || user.email?.split('@')[0]}
                </span>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="w-5 h-5 flex items-center justify-center rounded-full active:scale-90 transition"
                    style={{ color: 'hsl(var(--danger))' }}
                    aria-label="Sair"
                  >
                    <LogOut size={10} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Money HUD ── */}
        <div className="pb-3">
          <div
            className={`money-pill w-full ${isNegative ? 'money-pill-negative' : ''}`}
            style={{ borderRadius: 'var(--radius-lg)' }}
          >
            {/* Icon */}
            <div
              className="w-10 h-10 rounded-[13px] flex items-center justify-center text-xl flex-shrink-0"
              style={
                isNegative
                  ? { background: 'var(--gradient-danger)', boxShadow: 'var(--shadow-sm), var(--glow-danger)' }
                  : { background: 'var(--gradient-primary-btn)', boxShadow: 'var(--shadow-sm), var(--glow-primary-sm), inset 0 1px 0 hsl(0 0% 100% / 0.25)' }
              }
            >
              {isNegative ? '🏦' : '💰'}
            </div>

            {/* Balance */}
            <div className="flex-1 min-w-0">
              <div
                className="text-[10px] uppercase tracking-widest font-bold"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                Caixa Pessoal
              </div>
              <div
                className="font-game-title tabular-nums text-xl leading-tight"
                style={{
                  color: isNegative ? 'hsl(var(--danger))' : 'hsl(var(--foreground))',
                  textShadow: isNegative
                    ? '0 0 12px hsl(4 100% 59% / 0.35)'
                    : '0 1px 6px hsl(228 35% 2% / 0.4)',
                }}
              >
                {formatMoney(money)}
              </div>
            </div>

            {/* Right chips */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <div
                className="neon-badge text-[10px]"
                style={
                  companiesCount > 0
                    ? { color: 'hsl(var(--primary))' }
                    : { color: 'hsl(var(--muted-foreground))', background: 'hsl(228 30% 16%)', borderColor: 'hsl(var(--border) / 0.5)', boxShadow: 'none' }
                }
              >
                🏢 {companiesCount} empresa{companiesCount !== 1 ? 's' : ''}
              </div>
              {unreadCount > 0 && (
                <div
                  className="neon-badge text-[10px]"
                  style={{ color: 'hsl(var(--primary))' }}
                >
                  🔔 {unreadCount}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main ref={mainRef} className="flex-1 overflow-y-auto smooth-scroll pb-tabbar">
        <div className="animate-fade-in max-w-[640px] mx-auto w-full">
          {children}
        </div>
      </main>

      {/* ── Floating Bottom Tab Bar ── */}
      <nav className="ios-tab-bar" role="tablist" aria-label="Navegação principal">
        <div className="ios-tab-bar-inner">
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
                <Icon size={21} strokeWidth={active ? 2.5 : 2} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          {/* Mais button */}
          <button
            role="tab"
            aria-selected={(!currentTabInPrimary || moreOpen) ? true : undefined}
            data-active={(!currentTabInPrimary || moreOpen) ? 'true' : 'false'}
            onClick={() => { playClickSound(); setMoreOpen((v) => !v); }}
            className="ios-tab-item touch-manipulation"
            aria-label="Mais opções"
          >
            <MoreHorizontal size={21} strokeWidth={!currentTabInPrimary ? 2.5 : 2} />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      {/* ── "Mais" action sheet ── */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end"
          onClick={() => setMoreOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 animate-fade-in"
            style={{ background: 'hsl(228 35% 2% / 0.65)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          />
          <div
            className="relative w-full max-w-[640px] mx-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
          >
            <div
              className="mx-3 mb-3 overflow-hidden"
              style={{
                background: 'hsl(228 30% 12% / 0.95)',
                backdropFilter: 'saturate(200%) blur(28px)',
                WebkitBackdropFilter: 'saturate(200%) blur(28px)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid hsl(var(--border) / 0.45)',
                boxShadow: 'var(--shadow-xl), inset 0 1px 0 hsl(0 0% 100% / 0.07)',
              }}
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <span
                  className="text-[11px] uppercase tracking-widest font-bold"
                  style={{ color: 'hsl(var(--muted-foreground))' }}
                >
                  Mais opções
                </span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition"
                  style={{ background: 'hsl(228 30% 20%)', border: '1px solid hsl(var(--border) / 0.5)', color: 'hsl(var(--muted-foreground))' }}
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ borderTop: '1px solid hsl(var(--border) / 0.25)' }}>
                {SECONDARY_TABS.map((tab, idx) => {
                  const Icon = tab.icon;
                  const active = currentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTab(tab.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left touch-manipulation transition"
                      style={{
                        background: active ? 'hsl(108 100% 54% / 0.07)' : 'transparent',
                        borderTop: idx > 0 ? '1px solid hsl(var(--border) / 0.18)' : 'none',
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-[13px] flex items-center justify-center flex-shrink-0"
                        style={
                          active
                            ? { background: 'var(--gradient-primary-btn)', color: 'hsl(var(--primary-foreground))', boxShadow: 'var(--shadow-sm), var(--glow-primary-sm)' }
                            : { background: 'hsl(228 30% 20%)', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border) / 0.5)' }
                        }
                      >
                        <Icon size={18} />
                      </div>
                      <span
                        className="flex-1 font-bold text-[15px]"
                        style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}
                      >
                        {tab.label}
                      </span>
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
