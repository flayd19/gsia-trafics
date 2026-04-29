// =====================================================================
// AuctionsTab — Sub-aba "Leilões" dentro de Comprar
// 25 carros por ciclo de 6h, lances livres, vence o maior lance ao final.
//
// Cada card já mostra TUDO inline:
//   • Thumbnail + identidade do carro
//   • FIPE + Condição
//   • Stats setoriais (vel.máx, accel, grip, stab) em mini-barras
//   • Tempo restante + barra de progresso
//   • Lance atual + input + botão Dar Lance (sem dialog)
//   • Histórico de lances colapsível
// =====================================================================
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Gavel, Clock, TrendingUp, Trophy, Hammer, RefreshCw, CheckCircle2,
  ChevronDown, ChevronUp, ListOrdered,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { GameState, OwnedCar } from '@/types/game';
import { useAuctions, type AuctionItem, type AuctionBid } from '@/hooks/useAuctions';
import { conditionLabel } from '@/data/cars';
import { useCarImages } from '@/hooks/useCarImages';
import { generateBasePerformance } from '@/lib/performanceEngine';
import type { PerformanceStats } from '@/types/performance';

interface AuctionsTabProps {
  gameState:        GameState;
  onAddCarToGarage: (car: OwnedCar) => { success: boolean; message: string };
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

function fmtTimeLeft(endsAtIso: string): { label: string; expired: boolean; pct: number } {
  const ends = new Date(endsAtIso).getTime();
  const now  = Date.now();
  const ms   = ends - now;
  if (ms <= 0) return { label: 'encerrado', expired: true, pct: 100 };
  const totalCycle = 6 * 60 * 60 * 1000;
  const elapsed = totalCycle - ms;
  const pct = Math.max(0, Math.min(100, (elapsed / totalCycle) * 100));
  const hours = Math.floor(ms / 3_600_000);
  const mins  = Math.floor((ms % 3_600_000) / 60_000);
  const secs  = Math.floor((ms % 60_000) / 1_000);
  const label = hours > 0
    ? `${hours}h ${String(mins).padStart(2, '0')}m`
    : mins > 0
      ? `${mins}m ${String(secs).padStart(2, '0')}s`
      : `${secs}s`;
  return { label, expired: false, pct };
}

function fmtBidTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ── Tela ────────────────────────────────────────────────────────────
export function AuctionsTab({ gameState, onAddCarToGarage }: AuctionsTabProps) {
  const auctionsHook = useAuctions({
    currentMoney:     gameState.money,
    overdraftLimit:   gameState.overdraftLimit,
    onAddCarToGarage,
  });

  // Tick para atualizar contadores em tempo real
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick(x => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const winningsTotal = auctionsHook.winnings.length;

  return (
    <div className="space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-game-title text-[15px] font-bold flex items-center gap-1.5">
            <Gavel size={16} className="text-primary" />
            Leilões
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            25 carros · ciclo de 6h · sem lance mínimo · maior lance ao encerrar vence.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-[12px]"
          onClick={() => void auctionsHook.refresh()}
          disabled={auctionsHook.loading}
        >
          <RefreshCw size={13} className={auctionsHook.loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Carros ganhos pendentes de claim */}
      {winningsTotal > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold px-1 flex items-center gap-1.5">
            🏆 Carros ganhos
            <span className="w-4 h-4 rounded-full bg-emerald-400 text-black text-[9px] font-black flex items-center justify-center">
              {winningsTotal}
            </span>
          </div>
          {auctionsHook.winnings.map(w => {
            const cd = w.carData as Record<string, unknown>;
            return (
              <div key={w.id} className="ios-surface rounded-[14px] p-3 border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3">
                <span className="text-2xl">{String(cd['icon'] ?? '🚗')}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-foreground truncate">
                    {String(cd['brand'])} {String(cd['model'])} {String(cd['trim'] ?? '')}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Pagou {fmt(w.amountPaid)} · {String(cd['year'])} · Cond. {String(cd['condition'])}%
                  </div>
                </div>
                <Button
                  size="sm"
                  className="text-[12px] gap-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={async () => {
                    const r = await auctionsHook.claimWinning(w.id);
                    if (r.success) toast.success(r.message);
                    else toast.error(r.message);
                  }}
                >
                  <CheckCircle2 size={12} /> Receber
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista de leilões */}
      {auctionsHook.loading && auctionsHook.auctions.length === 0 ? (
        <div className="text-center py-10 text-[13px] text-muted-foreground">Carregando leilões...</div>
      ) : auctionsHook.auctions.length === 0 ? (
        <div className="ios-surface rounded-[16px] p-8 text-center space-y-2">
          <div className="text-4xl">🔨</div>
          <div className="text-[14px] font-semibold text-foreground">Nenhum leilão ativo</div>
          <div className="text-[11px] text-muted-foreground">
            Aguarde a abertura do próximo ciclo (6h).
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {auctionsHook.auctions.map(a => (
            <AuctionCard
              key={a.id}
              auction={a}
              myUserId={auctionsHook.myUserId}
              currentMoney={gameState.money}
              overdraftLimit={gameState.overdraftLimit}
              loadBids={auctionsHook.loadBids}
              onPlaceBid={async (amount) => {
                const r = await auctionsHook.placeBid(a.id, amount);
                if (r.success) toast.success(r.message);
                else toast.error(r.message);
                return r.success;
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card individual de leilão (tudo inline) ──────────────────────────
function AuctionCard({
  auction, myUserId, currentMoney, overdraftLimit, loadBids, onPlaceBid,
}: {
  auction:        AuctionItem;
  myUserId:       string | null;
  currentMoney:   number;
  overdraftLimit: number;
  loadBids:       (auctionId: string) => Promise<AuctionBid[]>;
  onPlaceBid:     (amount: number) => Promise<boolean>;
}) {
  const { getImgForInstance } = useCarImages();
  const imgUrl = getImgForInstance(auction.modelId, auction.id);
  const time = fmtTimeLeft(auction.endsAt);
  const isLeading = myUserId && auction.highestBidderId === myUserId;
  const minNextBid = auction.highestBid != null
    ? Math.floor(auction.highestBid) + 1
    : 1;
  const maxAffordable = currentMoney - overdraftLimit;

  // Stats de performance — gerados a partir dos campos do leilão
  const stats: PerformanceStats = useMemo(() => generateBasePerformance({
    instanceId: auction.id,
    modelId:    auction.modelId,
    fipePrice:  auction.fipePrice,
    condition:  auction.condition,
  }), [auction.id, auction.modelId, auction.fipePrice, auction.condition]);

  const [bidInput, setBidInput] = useState('');
  const [sending,  setSending]  = useState(false);
  const [showBids, setShowBids] = useState(false);
  const [bids,     setBids]     = useState<AuctionBid[]>([]);
  const [loadingBids, setLoadingBids] = useState(false);

  const numeric = parseInt(bidInput.replace(/\D/g, '') || '0', 10);
  const valid   = numeric >= minNextBid && numeric <= maxAffordable && !time.expired;

  const handleBid = useCallback(async () => {
    if (!valid || sending) return;
    setSending(true);
    const ok = await onPlaceBid(numeric);
    setSending(false);
    if (ok) {
      setBidInput('');
      // Recarrega histórico se aberto
      if (showBids) {
        const updated = await loadBids(auction.id);
        setBids(updated);
      }
    }
  }, [valid, sending, numeric, onPlaceBid, showBids, loadBids, auction.id]);

  const toggleBids = useCallback(async () => {
    const next = !showBids;
    setShowBids(next);
    if (next && bids.length === 0) {
      setLoadingBids(true);
      try {
        const list = await loadBids(auction.id);
        setBids(list);
      } finally {
        setLoadingBids(false);
      }
    }
  }, [showBids, bids.length, loadBids, auction.id]);

  return (
    <div className={`ios-surface rounded-[14px] overflow-hidden ${
      isLeading ? 'border border-emerald-500/40 bg-emerald-500/5' : ''
    }`}>
      {/* Thumbnail */}
      <div className="relative w-full bg-muted flex items-center justify-center overflow-hidden" style={{ height: 110 }}>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={`${auction.brand} ${auction.model}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <span
          className="text-[52px] items-center justify-center"
          style={{ display: imgUrl ? 'none' : 'flex' }}
        >{auction.icon}</span>

        {/* Badges */}
        {isLeading && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white bg-emerald-500 flex items-center gap-0.5">
            <Trophy size={9} /> Você lidera
          </div>
        )}
        <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${
          time.expired ? 'bg-red-500' : time.pct > 80 ? 'bg-amber-500' : 'bg-primary'
        } flex items-center gap-1`}>
          <Clock size={9} /> {time.label}
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2.5">
        {/* Identidade do carro */}
        <div>
          <div className="text-[14px] font-bold text-foreground truncate">
            {auction.brand} {auction.model} <span className="text-muted-foreground font-normal">{auction.trim}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {auction.year} · <span className="font-semibold">{conditionLabel(auction.condition)} {auction.condition}%</span>
            {auction.mileage > 0 && ` · ${auction.mileage.toLocaleString('pt-BR')} km`}
          </div>
          <div className="text-[11px] text-muted-foreground">
            FIPE de referência: <span className="font-semibold text-foreground">{fmt(auction.fipePrice)}</span>
          </div>
        </div>

        {/* Stats de desempenho — 4 mini-barras */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 bg-muted/30 rounded-[10px] p-2">
          <MiniStat label="Vel. máx" value={stats.topSpeed} />
          <MiniStat label="Aceler."  value={stats.acceleration} />
          <MiniStat label="Aderência" value={stats.grip} />
          <MiniStat label="Estab."   value={stats.stability} />
          <div className="col-span-2 flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-border/30">
            <span className="text-muted-foreground">IGP geral</span>
            <span className="font-mono font-bold text-foreground tabular-nums">{stats.igp}/100</span>
          </div>
        </div>

        {/* Lance atual */}
        <div className="flex items-center justify-between bg-muted/30 rounded-[10px] p-2">
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
              Lance atual
            </div>
            {auction.highestBid != null ? (
              <>
                <div className="text-[15px] font-bold text-foreground tabular-nums">
                  {fmt(auction.highestBid)}
                </div>
                <div className="text-[9px] text-muted-foreground truncate">
                  por {auction.highestBidderName} · {auction.bidCount} lance{auction.bidCount !== 1 ? 's' : ''}
                </div>
              </>
            ) : (
              <div className="text-[14px] font-bold text-muted-foreground italic">
                Sem lances · aceita qualquer valor
              </div>
            )}
          </div>
          {/* Barra de tempo */}
          <div className="w-20 shrink-0">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${time.pct > 80 ? 'bg-amber-400' : 'bg-primary'}`}
                style={{ width: `${time.pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Input de lance + botão (inline, sem dialog) */}
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="numeric"
              placeholder={auction.highestBid != null ? `> ${fmt(minNextBid)}` : 'Qualquer valor'}
              value={bidInput}
              onChange={e => setBidInput(e.target.value)}
              disabled={time.expired || sending}
              className="text-[14px] font-mono flex-1"
              onKeyDown={e => { if (e.key === 'Enter') void handleBid(); }}
            />
            <Button
              size="sm"
              className="px-3 gap-1 shrink-0"
              disabled={!valid || sending}
              onClick={() => void handleBid()}
            >
              <Hammer size={13} />
              {sending ? '...' : 'Dar lance'}
            </Button>
          </div>
          {bidInput && !valid && (
            <div className="text-[10px] text-red-400">
              {numeric < minNextBid
                ? (auction.highestBid != null
                    ? `Precisa superar ${fmt(minNextBid)}`
                    : 'Lance precisa ser positivo')
                : 'Acima do que você pode pagar'}
            </div>
          )}
          {!bidInput && (
            <div className="flex flex-wrap gap-1">
              {[
                Math.round(auction.fipePrice * 0.30),
                Math.round(auction.fipePrice * 0.60),
                Math.round(auction.fipePrice * 0.85),
                Math.round(auction.fipePrice * 1.00),
              ].filter((v, i, arr) => arr.indexOf(v) === i && v >= minNextBid && v <= maxAffordable)
                .map(v => (
                  <button
                    key={v}
                    onClick={() => setBidInput(String(v))}
                    className="px-2 py-0.5 rounded-[8px] text-[10px] bg-muted hover:bg-muted/70 text-muted-foreground"
                  >
                    {fmt(v)}
                  </button>
                ))}
            </div>
          )}
          <div className="text-[9px] text-muted-foreground italic flex items-start gap-1">
            <TrendingUp size={9} className="shrink-0 mt-0.5" />
            <span>Valor só é cobrado se você vencer o leilão.</span>
          </div>
        </div>

        {/* Histórico de lances colapsível */}
        <button
          onClick={() => void toggleBids()}
          className="w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground py-1.5 px-1 transition-colors"
        >
          <span className="flex items-center gap-1.5 font-semibold">
            <ListOrdered size={12} />
            Histórico de lances
            {auction.bidCount > 0 && (
              <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">
                {auction.bidCount}
              </span>
            )}
          </span>
          {showBids ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showBids && (
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {loadingBids ? (
              <div className="text-[11px] text-muted-foreground text-center py-2">Carregando...</div>
            ) : bids.length === 0 ? (
              <div className="text-[11px] text-muted-foreground italic text-center py-2">
                Nenhum lance ainda. Seja o primeiro!
              </div>
            ) : (
              bids.map((b, idx) => {
                const isMyBid = myUserId && b.bidderId === myUserId;
                const isWinning = idx === 0;
                return (
                  <div key={b.id} className={`flex items-center gap-2 px-2 py-1 rounded-[8px] text-[11px] ${
                    isWinning ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-muted/30'
                  }`}>
                    <span className={`shrink-0 w-5 text-center font-bold ${
                      isWinning ? 'text-emerald-400' : 'text-muted-foreground'
                    }`}>
                      {idx + 1}º
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-foreground truncate">
                          {isMyBid ? 'Você' : b.bidderName}
                        </span>
                        {isMyBid && (
                          <span className="text-[8px] font-bold text-primary bg-primary/10 px-1 rounded">
                            você
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-muted-foreground">{fmtBidTime(b.createdAt)}</div>
                    </div>
                    <span className={`font-mono font-bold tabular-nums shrink-0 ${
                      isWinning ? 'text-emerald-400' : 'text-foreground'
                    }`}>
                      {fmt(b.amount)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mini-barra de stat ───────────────────────────────────────────────
function MiniStat({ label, value }: { label: string; value: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const color = safe >= 75 ? 'bg-emerald-500'
              : safe >= 50 ? 'bg-amber-500'
              : safe >= 30 ? 'bg-orange-500'
              : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-12 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${safe}%` }} />
      </div>
      <span className="text-[9px] font-mono font-bold text-foreground tabular-nums w-6 text-right">{safe}</span>
    </div>
  );
}
