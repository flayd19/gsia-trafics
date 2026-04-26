// =====================================================================
// DesempenhoPanel — Sub-painel de performance/tunagem na OficinaScreen
// =====================================================================
import { useState } from 'react';
import type { OwnedCar } from '@/types/game';
import type { TuneType, TuneUpgrade } from '@/types/performance';
import { TUNE_META } from '@/types/performance';
import { getFullPerformance, generateBasePerformance, calcTuneCost } from '@/lib/performanceEngine';

// ── Props ────────────────────────────────────────────────────────
interface DesempenhoPanelProps {
  car: OwnedCar;
  money: number;
  onApplyTune: (carInstanceId: string, type: TuneType, newUpgrades: TuneUpgrade[]) => void;
  onSpendMoney: (amount: number) => boolean;
}

// ── Helpers ──────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

function igpColor(igp: number): string {
  if (igp > 75) return 'text-emerald-500';
  if (igp > 50) return 'text-amber-500';
  return 'text-red-500';
}

function igpBg(igp: number): string {
  if (igp > 75) return 'bg-emerald-500/15 border-emerald-500/30';
  if (igp > 50) return 'bg-amber-500/15 border-amber-500/30';
  return 'bg-red-500/15 border-red-500/30';
}

function statBarBg(v: number): string {
  if (v >= 70) return 'linear-gradient(90deg, #10b981, #059669)';
  if (v >= 40) return 'linear-gradient(90deg, #f59e0b, #f97316)';
  return 'linear-gradient(90deg, #ef4444, #dc2626)';
}

const STAT_LABELS: { key: keyof ReturnType<typeof getFullPerformance>; label: string; icon: string }[] = [
  { key: 'topSpeed',     label: 'Velocidade Máx',  icon: '🏁' },
  { key: 'acceleration', label: 'Aceleração',      icon: '⚡' },
  { key: 'power',        label: 'Potência',        icon: '💪' },
  { key: 'torque',       label: 'Torque',          icon: '🔄' },
  { key: 'aerodynamics', label: 'Aerodinâmica',    icon: '💨' },
  { key: 'stability',    label: 'Estabilidade',    icon: '🎯' },
  { key: 'grip',         label: 'Grip',            icon: '🛞' },
];

const TUNE_ORDER: TuneType[] = [
  'engine', 'turbo', 'ecu', 'transmission', 'suspension', 'tires', 'weight_reduction', 'aerodynamics',
];

// ── Componente de barra de stat ──────────────────────────────────
function StatBar({ label, icon, value }: { label: string; icon: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground flex items-center gap-1">
          <span>{icon}</span>{label}
        </span>
        <span className="font-bold text-foreground tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value}%`, background: statBarBg(value) }}
        />
      </div>
    </div>
  );
}

// ── Pontinhos de nível ───────────────────────────────────────────
function LevelDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i <= level ? 'bg-primary' : 'bg-muted'}`}
        />
      ))}
    </div>
  );
}

// ── Painel principal ─────────────────────────────────────────────
export function DesempenhoPanel({ car, money, onApplyTune, onSpendMoney }: DesempenhoPanelProps) {
  const [flashStat, setFlashStat] = useState<string | null>(null);
  const [flashValue, setFlashValue] = useState('');

  const perf     = getFullPerformance(car);
  const baseStat = generateBasePerformance(car);
  const upgrades = car.tuneUpgrades ?? [];

  const getUpgradeLevel = (type: TuneType): number =>
    upgrades.find(u => u.type === type)?.level ?? 0;

  const handleTune = (type: TuneType) => {
    const currentLevel = getUpgradeLevel(type);
    if (currentLevel >= 5) return;

    const nextLevel = currentLevel + 1;
    const cost      = calcTuneCost(type, nextLevel, baseStat);

    if (money < cost) return;

    const spent = onSpendMoney(cost);
    if (!spent) return;

    const existing = upgrades.filter(u => u.type !== type);
    const newUpgrade: TuneUpgrade = { type, level: nextLevel, appliedAt: Date.now() };
    const newUpgrades = [...existing, newUpgrade];

    onApplyTune(car.instanceId, type, newUpgrades);

    // Flash animation
    const meta = TUNE_META[type];
    setFlashStat(type);
    setFlashValue(`+${meta.label} Nv${nextLevel}`);
    setTimeout(() => setFlashStat(null), 1800);
  };

  return (
    <div className="space-y-5">
      {/* IGP + Tração */}
      <div className={`ios-surface rounded-[16px] p-4 border ${igpBg(perf.igp)}`}>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center justify-center">
            <div className={`text-[48px] font-black tabular-nums leading-none ${igpColor(perf.igp)}`}>
              {perf.igp}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">
              IGP
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="font-bold text-[15px] text-foreground truncate">{car.fullName}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                {perf.traction}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {perf._hp} cv · {perf._torqueNm} Nm
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              0–100 em {perf._0to100}s · {perf._topSpeedKmh} km/h
            </div>
            {perf._hasTurbo && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold">
                💨 Turbo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Barras de stats */}
      <div className="ios-surface rounded-[16px] p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
          Atributos de Performance
        </div>
        {STAT_LABELS.map(({ key, label, icon }) => (
          <StatBar key={key} label={label} icon={icon} value={perf[key] as number} />
        ))}
        <div className="pt-1 border-t border-border">
          <div className="text-[10px] text-muted-foreground">
            * Peso ({perf.weight}/100) atua como redutor interno do IGP — não exibido como barra
          </div>
        </div>
      </div>

      {/* Tunagem */}
      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Tunagem
        </div>

        {/* Flash de upgrade */}
        {flashStat && (
          <div className="flex items-center justify-center gap-2 py-2 rounded-[12px] bg-primary/10 text-primary text-[13px] font-bold animate-bounce">
            <span>✅</span>
            <span>{flashValue} aplicado!</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          {TUNE_ORDER.map(type => {
            const meta  = TUNE_META[type];
            const level = getUpgradeLevel(type);
            const maxed = level >= 5;
            const nextLevel = level + 1;
            const cost  = maxed ? 0 : calcTuneCost(type, nextLevel, baseStat);
            const canAfford = !maxed && money >= cost;

            return (
              <div
                key={type}
                className={`ios-surface rounded-[14px] p-3 flex items-center gap-3 transition-opacity ${
                  maxed ? 'opacity-60' : ''
                } ${flashStat === type ? 'ring-1 ring-primary' : ''}`}
              >
                {/* Ícone */}
                <div className="w-10 h-10 rounded-[12px] bg-primary/10 flex items-center justify-center text-xl shrink-0">
                  {meta.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[13px] text-foreground">{meta.label}</span>
                    {maxed && (
                      <span className="text-[10px] text-emerald-500 font-bold uppercase">MAX</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{meta.desc}</div>
                  <div className="mt-1.5">
                    <LevelDots level={level} />
                  </div>
                </div>

                {/* Custo + botão */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {!maxed && (
                    <div className="text-[10px] text-muted-foreground tabular-nums">{fmt(cost)}</div>
                  )}
                  <button
                    disabled={maxed || !canAfford}
                    onClick={() => handleTune(type)}
                    className={`px-3 py-1.5 rounded-[10px] text-[12px] font-bold transition-all active:scale-95 ${
                      maxed
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : canAfford
                        ? 'bg-primary text-primary-foreground hover:opacity-90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    {maxed ? 'Máximo' : canAfford ? 'Tunar' : 'Sem saldo'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
