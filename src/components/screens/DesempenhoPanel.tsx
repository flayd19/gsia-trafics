// =====================================================================
// DesempenhoPanel — Sub-painel de performance/tunagem na OficinaScreen
// =====================================================================
import { useState, useMemo } from 'react';
import type { OwnedCar } from '@/types/game';
import type { TuneType, TuneUpgrade, StatKey } from '@/types/performance';
import { TUNE_META, TUNE_SECTIONS, TUNE_AFFECTS } from '@/types/performance';
import {
  getFullPerformance,
  generateBasePerformance,
  calcTuneCost,
  applyTuneUpgrades,
} from '@/lib/performanceEngine';

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
  if (igp > 75) return 'text-emerald-400';
  if (igp > 50) return 'text-amber-400';
  return 'text-red-400';
}

function igpBg(igp: number): string {
  if (igp > 75) return 'bg-emerald-500/10 border-emerald-500/25';
  if (igp > 50) return 'bg-amber-500/10 border-amber-500/25';
  return 'bg-red-500/10 border-red-500/25';
}

function statGradient(v: number): string {
  if (v >= 70) return 'linear-gradient(90deg,#10b981,#059669)';
  if (v >= 40) return 'linear-gradient(90deg,#f59e0b,#f97316)';
  return 'linear-gradient(90deg,#ef4444,#dc2626)';
}

// ── Mapa de label amigável dos stats ────────────────────────────
const STAT_META: Record<StatKey, { label: string; icon: string }> = {
  topSpeed:     { label: 'Veloc. Máx',   icon: '🏁' },
  acceleration: { label: 'Aceleração',   icon: '⚡' },
  power:        { label: 'Potência',     icon: '💪' },
  torque:       { label: 'Torque',       icon: '🔄' },
  aerodynamics: { label: 'Aerodinâmica', icon: '💨' },
  stability:    { label: 'Estabilidade', icon: '🎯' },
  grip:         { label: 'Grip',         icon: '🛞' },
  gearShift:    { label: 'Câmbio',       icon: '⚙️' },
};

const RADAR_STATS: StatKey[] = [
  'topSpeed', 'acceleration', 'power', 'torque',
  'aerodynamics', 'stability', 'grip',
];

// ── SVG Radar Chart ──────────────────────────────────────────────
function RadarChart({
  base,
  tuned,
  hasTune,
}: {
  base: Record<string, number>;
  tuned: Record<string, number>;
  hasTune: boolean;
}) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;
  const n = RADAR_STATS.length;

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const toXY = (i: number, value: number) => {
    const a = angle(i);
    const dist = (value / 100) * r;
    return { x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist };
  };

  const gridPoly = (pct: number) =>
    RADAR_STATS.map((_, i) => {
      const a = angle(i);
      const d = (pct / 100) * r;
      return `${cx + Math.cos(a) * d},${cy + Math.sin(a) * d}`;
    }).join(' ');

  const makePoly = (data: Record<string, number>) =>
    RADAR_STATS.map((k, i) => {
      const p = toXY(i, data[k] ?? 0);
      return `${p.x},${p.y}`;
    }).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px] mx-auto">
      {/* Grid */}
      {[20, 40, 60, 80, 100].map(pct => (
        <polygon key={pct} points={gridPoly(pct)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      {/* Axis lines */}
      {RADAR_STATS.map((_, i) => {
        const p = toXY(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
      })}
      {/* Base polygon */}
      <polygon points={makePoly(base)} fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.5)" strokeWidth="1.5" />
      {/* Tuned polygon */}
      {hasTune && (
        <polygon points={makePoly(tuned)} fill="rgba(16,185,129,0.18)" stroke="rgba(16,185,129,0.7)" strokeWidth="1.5" />
      )}
      {/* Labels */}
      {RADAR_STATS.map((k, i) => {
        const a = angle(i);
        const lx = cx + Math.cos(a) * (r + 18);
        const ly = cy + Math.sin(a) * (r + 18);
        return (
          <text key={k} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="rgba(255,255,255,0.5)">
            {STAT_META[k].icon}
          </text>
        );
      })}
      <circle cx={cx} cy={cy} r="2.5" fill="rgba(99,102,241,0.8)" />
    </svg>
  );
}

// ── Barra de stat com before/after ───────────────────────────────
function StatBar({ label, icon, base, current }: { label: string; icon: string; base: number; current: number }) {
  const diff = current - base;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground flex items-center gap-1">
          <span>{icon}</span>{label}
        </span>
        <span className="flex items-center gap-1.5">
          {diff > 0 && <span className="text-emerald-400 font-bold text-[10px]">+{diff}</span>}
          <span className="font-bold text-foreground tabular-nums">{Math.round(current)}</span>
        </span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden relative">
        {diff > 0 && (
          <div
            className="absolute h-full rounded-full"
            style={{ width: `${base}%`, background: 'rgba(99,102,241,0.25)' }}
          />
        )}
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${current}%`, background: statGradient(current) }}
        />
      </div>
    </div>
  );
}

// ── Pontinhos de nível ───────────────────────────────────────────
function LevelDots({ level }: { level: number }) {
  return (
    <div className="flex gap-[3px]">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i <= level ? 'bg-primary' : 'bg-muted'}`} />
      ))}
    </div>
  );
}

// ── Card de tunagem individual ───────────────────────────────────
interface TuneCardProps {
  type: TuneType;
  level: number;
  currentUpgrades: TuneUpgrade[];
  perf: ReturnType<typeof getFullPerformance>;
  baseStat: ReturnType<typeof generateBasePerformance>;
  money: number;
  isFlashing: boolean;
  onTune: (type: TuneType) => void;
}

function TuneCard({ type, level, currentUpgrades, perf, baseStat, money, isFlashing, onTune }: TuneCardProps) {
  const meta = TUNE_META[type];
  const maxed = level >= 5;
  const nextLevel = level + 1;
  const cost = maxed ? 0 : calcTuneCost(type, nextLevel, baseStat);
  const canAfford = !maxed && money >= cost;
  const affectedStats = TUNE_AFFECTS[type];

  // Simula próximo nível para preview de ganhos
  const preview = useMemo(() => {
    if (maxed) return null;
    const simUpgrades: TuneUpgrade[] = [
      ...currentUpgrades.filter(u => u.type !== type),
      { type, level: nextLevel, appliedAt: 0 },
    ];
    return applyTuneUpgrades(baseStat, simUpgrades);
  }, [type, level, nextLevel, baseStat, maxed, currentUpgrades]);

  return (
    <div
      className={`ios-surface rounded-[14px] p-3 transition-all ${
        isFlashing ? 'ring-1 ring-emerald-500 bg-emerald-500/5' : ''
      } ${maxed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Ícone */}
        <div className="w-10 h-10 rounded-[12px] bg-primary/10 flex items-center justify-center text-xl shrink-0 mt-0.5">
          {meta.icon}
        </div>

        {/* Info central */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-[13px] text-foreground">{meta.label}</span>
            {maxed && (
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide">✓ MAX</span>
            )}
            {meta.note && !maxed && (
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                {meta.note}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">{meta.desc}</div>

          {/* Stats afetados */}
          <div className="flex flex-wrap gap-1">
            {affectedStats.map(statKey => {
              const sm = STAT_META[statKey];
              const currentVal = perf[statKey] as number;
              const previewVal = preview ? (preview[statKey] as number) : currentVal;
              const diff = previewVal - currentVal;
              return (
                <span
                  key={statKey}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-muted border border-border text-[10px] text-muted-foreground"
                >
                  {sm.icon} {sm.label}
                  {!maxed && diff > 0 && (
                    <span className="text-emerald-400 font-bold ml-0.5">+{diff}</span>
                  )}
                </span>
              );
            })}
          </div>

          {/* Dots + custo */}
          <div className="flex items-center justify-between pt-0.5">
            <LevelDots level={level} />
            {!maxed && (
              <span className="text-[10px] text-muted-foreground tabular-nums">{fmt(cost)}</span>
            )}
          </div>
        </div>

        {/* Botão */}
        <div className="shrink-0 mt-0.5">
          <button
            disabled={maxed || !canAfford}
            onClick={() => onTune(type)}
            className={`px-3 py-1.5 rounded-[10px] text-[12px] font-bold transition-all active:scale-95 ${
              maxed
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : canAfford
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {maxed ? 'MAX' : canAfford ? 'Tunar' : '💸'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Seção colapsável ─────────────────────────────────────────────
interface TuneSectionProps {
  section: (typeof TUNE_SECTIONS)[number];
  upgrades: TuneUpgrade[];
  perf: ReturnType<typeof getFullPerformance>;
  baseStat: ReturnType<typeof generateBasePerformance>;
  money: number;
  flashStat: TuneType | null;
  onTune: (type: TuneType) => void;
}

function CollapsibleSection({
  section, upgrades, perf, baseStat, money, flashStat, onTune,
}: TuneSectionProps) {
  const [open, setOpen] = useState(true);

  const totalLevels = section.types.reduce((sum, t) => sum + (upgrades.find(u => u.type === t)?.level ?? 0), 0);
  const maxLevels = section.types.length * 5;

  return (
    <div className="ios-surface rounded-[16px] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3.5 text-left active:bg-muted/20 transition-colors"
      >
        <span className="text-xl">{section.icon}</span>
        <span className="flex-1 font-bold text-[13px] text-foreground">{section.label}</span>
        <div className="flex items-center gap-2">
          <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(totalLevels / maxLevels) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground w-8 text-right">{totalLevels}/{maxLevels}</span>
          <span className={`text-[11px] text-muted-foreground transition-transform duration-200 ${open ? '' : '-rotate-90'}`}>
            ▾
          </span>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-2">
          {section.types.map(type => (
            <TuneCard
              key={type}
              type={type}
              level={upgrades.find(u => u.type === type)?.level ?? 0}
              currentUpgrades={upgrades}
              perf={perf}
              baseStat={baseStat}
              money={money}
              isFlashing={flashStat === type}
              onTune={onTune}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Painel principal ─────────────────────────────────────────────
export function DesempenhoPanel({ car, money, onApplyTune, onSpendMoney }: DesempenhoPanelProps) {
  const [activeTab, setActiveTab] = useState<'visao' | 'tunagem'>('visao');
  const [flashStat, setFlashStat] = useState<TuneType | null>(null);
  const [flashMessage, setFlashMessage] = useState('');

  const perf     = getFullPerformance(car);
  const baseStat = generateBasePerformance(car);
  const upgrades = car.tuneUpgrades ?? [];
  const totalUpgrades = upgrades.reduce((s, u) => s + u.level, 0);
  const hasTune = totalUpgrades > 0;

  const handleTune = (type: TuneType) => {
    const currentLevel = upgrades.find(u => u.type === type)?.level ?? 0;
    if (currentLevel >= 5) return;

    const nextLevel = currentLevel + 1;
    const cost = calcTuneCost(type, nextLevel, baseStat);
    if (money < cost) return;

    const spent = onSpendMoney(cost);
    if (!spent) return;

    const newUpgrades: TuneUpgrade[] = [
      ...upgrades.filter(u => u.type !== type),
      { type, level: nextLevel, appliedAt: Date.now() },
    ];
    onApplyTune(car.instanceId, type, newUpgrades);

    setFlashStat(type);
    setFlashMessage(`${TUNE_META[type].label} Nível ${nextLevel} aplicado!`);
    setTimeout(() => setFlashStat(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header IGP */}
      <div className={`ios-surface rounded-[16px] p-4 border ${igpBg(perf.igp)}`}>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center w-[64px] shrink-0">
            <div className={`text-[52px] font-black tabular-nums leading-none ${igpColor(perf.igp)}`}>
              {perf.igp}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">
              IGP
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="font-bold text-[15px] text-foreground truncate">{car.fullName}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                {perf.traction}
              </span>
              {perf._hasTurbo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold">
                  💨 Turbo
                </span>
              )}
              {hasTune && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                  🔧 {totalUpgrades} pts
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {perf._hp} cv · {perf._torqueNm} Nm · 0–100 em {perf._0to100}s · {perf._topSpeedKmh} km/h
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-[12px] bg-muted p-1 gap-1">
        {(['visao', 'tunagem'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded-[9px] text-[12px] font-semibold transition-all ${
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            {tab === 'visao' ? '📊 Visão Geral' : '🔧 Tunagem'}
          </button>
        ))}
      </div>

      {/* ── Tab: Visão Geral ── */}
      {activeTab === 'visao' && (
        <div className="space-y-4">
          {/* Radar */}
          <div className="ios-surface rounded-[16px] p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Radar de Performance
            </div>
            <RadarChart
              base={baseStat as unknown as Record<string, number>}
              tuned={perf as unknown as Record<string, number>}
              hasTune={hasTune}
            />
            {hasTune && (
              <div className="flex items-center justify-center gap-4 mt-2 text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-indigo-400 inline-block rounded" />
                  <span className="text-muted-foreground">Base</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-emerald-400 inline-block rounded" />
                  <span className="text-muted-foreground">Tunado</span>
                </span>
              </div>
            )}
          </div>

          {/* Barras */}
          <div className="ios-surface rounded-[16px] p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Atributos
            </div>
            {RADAR_STATS.map(key => (
              <StatBar
                key={key}
                label={STAT_META[key].label}
                icon={STAT_META[key].icon}
                base={baseStat[key] as number}
                current={perf[key] as number}
              />
            ))}
            {/* Câmbio separado pois não está no radar */}
            <StatBar
              label={STAT_META.gearShift.label}
              icon={STAT_META.gearShift.icon}
              base={baseStat.gearShift}
              current={perf.gearShift}
            />
            <div className="pt-1 border-t border-border text-[10px] text-muted-foreground">
              ⚖️ Peso interno: {perf.weight}/100 (quanto maior, mais penaliza o IGP)
            </div>
          </div>

          {/* Dados técnicos */}
          <div className="ios-surface rounded-[16px] p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Dados Técnicos
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Motor',       value: perf._engineType },
                { label: 'Tração',      value: perf.traction },
                { label: 'Potência',    value: `${perf._hp} cv` },
                { label: 'Torque',      value: `${perf._torqueNm} Nm` },
                { label: '0–100 km/h',  value: `${perf._0to100}s` },
                { label: 'Vel. Máxima', value: `${perf._topSpeedKmh} km/h` },
                { label: 'Peso aprox.', value: `${perf._weightKg} kg` },
                { label: 'Turbo',       value: perf._hasTurbo ? 'Sim ✓' : 'Não' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/30 rounded-[10px] p-2.5">
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                  <div className="text-[12px] font-bold text-foreground mt-0.5">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Tunagem ── */}
      {activeTab === 'tunagem' && (
        <div className="space-y-3">
          {/* Flash */}
          {flashStat && (
            <div className="flex items-center justify-center gap-2 py-2.5 rounded-[12px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[13px] font-bold animate-pulse">
              ✅ {flashMessage}
            </div>
          )}

          {/* Saldo */}
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[12px] text-muted-foreground">Saldo disponível</span>
            <span className="text-[13px] font-bold text-foreground">{fmt(money)}</span>
          </div>

          {/* Seções colapsáveis */}
          {TUNE_SECTIONS.map(section => (
            <CollapsibleSection
              key={section.id}
              section={section}
              upgrades={upgrades}
              perf={perf}
              baseStat={baseStat}
              money={money}
              flashStat={flashStat}
              onTune={handleTune}
            />
          ))}
        </div>
      )}
    </div>
  );
}
