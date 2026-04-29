// =====================================================================
// AuctionsTab — Sub-aba "Leilões" dentro de Comprar
// 25 carros por ciclo de 6h, lances livres, vence o maior lance ao final
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import {
  Gavel, Clock, TrendingUp, Trophy, Hammer, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { GameState, OwnedCar } from '@/types/game';
import { useAuctions, type AuctionItem } from '@/hooks/useAuctions';
import { conditionLabel } from '@/data/cars';

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
            25 carros · ciclo de 6h · vence o maior lance ao encerrar.
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

// ── Card individual de leilão ──────────────────────────────────────
function AuctionCard({
  auction, myUserId, currentMoney, overdraftLimit, onPlaceBid,
}: {
  auction:        AuctionItem;
  myUserId:       string | null;
  currentMoney:   number;
  overdraftLimit: number;
  onPlaceBid:     (amount: number) => Promise<boolean>;
}) {
  const time = fmtTimeLeft(auction.endsAt);
  const isLeading = myUserId && auction.highestBidderId === myUserId;
  // Sem lance mínimo: lance inicial = R$ 1; lance subsequente = highest + R$ 1
  const minNextBid = auction.highestBid != null
    ? Math.floor(auction.highestBid) + 1
    : 1;

  return (
    <div className={`ios-surface rounded-[14px] p-3 space-y-2 ${
      isLeading ? 'border border-emerald-500/40 bg-emerald-500/5' : ''
    }`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{auction.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-foreground truncate">
            {auction.brand} {auction.model} {auction.trim}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {auction.year} · Cond. <span className="font-semibold">{conditionLabel(auction.condition)} {auction.condition}%</span>
            {auction.mileage > 0 && ` · ${auction.mileage.toLocaleString('pt-BR')} km`}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            FIPE de referência: <span className="font-semibold">{fmt(auction.fipePrice)}</span>
          </div>
        </div>
        {isLeading && (
          <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded-full bg-emerald-500/20 shrink-0 flex items-center gap-1">
            <Trophy size={9} /> Você lidera
          </span>
        )}
      </div>

      {/* Lance atual + tempo */}
      <div className="grid grid-cols-2 gap-2">
        <div className="ios-surface rounded-[10px] p-2 !shadow-none bg-muted/30">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
            Lance atual
          </div>
          {auction.highestBid != null ? (
            <>
              <div className="text-[14px] font-bold text-foreground tabular-nums">
                {fmt(auction.highestBid)}
              </div>
              <div className="text-[9px] text-muted-foreground truncate">
                por {auction.highestBidderName ?? '—'} · {auction.bidCount} lances
              </div>
            </>
          ) : (
            <>
              <div className="text-[14px] font-bold text-muted-foreground italic">Sem lances</div>
              <div className="text-[9px] text-muted-foreground">
                Aceita qualquer valor
              </div>
            </>
          )}
        </div>
        <div className="ios-surface rounded-[10px] p-2 !shadow-none bg-muted/30">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
            <Clock size={9} /> Encerra em
          </div>
          <div className={`text-[14px] font-mono font-bold tabular-nums ${
            time.expired ? 'text-red-400'
            : time.pct > 90 ? 'text-amber-400'
            : 'text-foreground'
          }`}>
            {time.label}
          </div>
          <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden">
            <div
              className={`h-full ${time.pct > 90 ? 'bg-amber-400' : 'bg-primary'}`}
              style={{ width: `${time.pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Ação: dar lance */}
      <BidDialog
        auction={auction}
        minNextBid={minNextBid}
        currentMoney={currentMoney}
        overdraftLimit={overdraftLimit}
        onPlaceBid={onPlaceBid}
        disabled={time.expired}
      />
    </div>
  );
}

// ── Dialog de lance ─────────────────────────────────────────────────
function BidDialog({
  auction, minNextBid, currentMoney, overdraftLimit, onPlaceBid, disabled,
}: {
  auction:        AuctionItem;
  minNextBid:     number;
  currentMoney:   number;
  overdraftLimit: number;
  onPlaceBid:     (amount: number) => Promise<boolean>;
  disabled:       boolean;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);

  const numeric = parseInt(amount.replace(/\D/g, '') || '0', 10);
  const maxAffordable = currentMoney - overdraftLimit;
  const valid = numeric >= minNextBid && numeric <= maxAffordable;

  // Sugestões rápidas (frações da FIPE para servir de referência)
  const suggestions = useMemo(() => {
    const base = minNextBid;
    return [
      base,
      Math.round(auction.fipePrice * 0.30),
      Math.round(auction.fipePrice * 0.60),
      Math.round(auction.fipePrice * 0.85),
      Math.round(auction.fipePrice * 1.00),
    ].filter((v, i, arr) => arr.indexOf(v) === i && v >= minNextBid && v <= maxAffordable);
  }, [minNextBid, auction.fipePrice, maxAffordable]);

  const handlePlace = async () => {
    if (!valid || sending) return;
    setSending(true);
    const ok = await onPlaceBid(numeric);
    setSending(false);
    if (ok) {
      setOpen(false);
      setAmount('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="w-full gap-1.5 text-[12px]"
          disabled={disabled}
        >
          <Hammer size={13} />
          {disabled ? 'Encerrado' : 'Dar lance'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer size={18} className="text-primary" />
            Lance no leilão
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            <strong>{auction.brand} {auction.model}</strong> · FIPE {fmt(auction.fipePrice)} · Cond. {auction.condition}%
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="ios-surface rounded-[12px] p-3 !shadow-none bg-muted/30">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <div className="text-muted-foreground">
                  {auction.highestBid != null ? 'Para superar' : 'Sem mínimo'}
                </div>
                <div className="font-mono font-bold tabular-nums">
                  {auction.highestBid != null ? fmt(minNextBid) : '—'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Seu saldo</div>
                <div className="font-mono font-bold tabular-nums">{fmt(currentMoney)}</div>
              </div>
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Valor do lance</label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder={String(minNextBid)}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="text-[16px] font-mono mt-1"
            />
            {amount && !valid && (
              <div className="text-[10px] text-red-400 mt-1">
                {numeric < minNextBid
                  ? (auction.highestBid != null
                      ? `Precisa superar o lance atual (${fmt(minNextBid)})`
                      : 'Lance precisa ser positivo.')
                  : 'Acima do que você pode pagar.'}
              </div>
            )}
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {suggestions.slice(0, 5).map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className="px-2 py-0.5 rounded-[8px] text-[11px] bg-muted hover:bg-muted/70"
                >
                  {fmt(v)}
                </button>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground italic flex items-start gap-1">
            <TrendingUp size={11} className="shrink-0 mt-0.5" />
            <span>O valor só é cobrado se você vencer o leilão. Se outro jogador der lance maior, sua reserva é liberada.</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => void handlePlace()} disabled={!valid || sending}>
            {sending ? 'Enviando...' : valid ? `Dar lance ${fmt(numeric)}` : 'Insira valor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
