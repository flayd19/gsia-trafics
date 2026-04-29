// =====================================================================
// WarrantiesTab — sub-aba "Garantias" dentro de Vendas
// Lista claims pendentes; jogador pode pagar reparo ou recusar.
// =====================================================================
import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { GameState } from '@/types/game';
import { WARRANTY_MIN_LEVEL } from '@/types/warranty';
import { ensureReputation } from '@/lib/reputation';

interface WarrantiesTabProps {
  gameState:                GameState;
  onPayClaim:               (claimId: string) => { success: boolean; message: string };
  onRefuseClaim:            (claimId: string) => { success: boolean; message: string };
  onDismissClaim:           (claimId: string) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const ATTR_LABEL: Record<string, string> = {
  body:       'Lataria',
  mechanical: 'Mecânica',
  electrical: 'Elétrica',
  interior:   'Interior',
};

function fmtTimeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'expirado';
  const min = Math.floor(ms / 60_000);
  const sec = Math.floor((ms % 60_000) / 1_000);
  return min > 0 ? `${min}min ${sec}s` : `${sec}s`;
}

export function WarrantiesTab({ gameState, onPayClaim, onRefuseClaim, onDismissClaim }: WarrantiesTabProps) {
  const level = ensureReputation(gameState.reputation).level;
  const claims = gameState.warrantyClaims ?? [];

  // Tick para atualizar contador de tempo
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick(x => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Sistema só funciona para Lv 8+
  if (level < WARRANTY_MIN_LEVEL) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2">
          <ShieldCheck size={20} className="text-primary mt-0.5" />
          <div>
            <h3 className="font-game-title text-[15px] font-bold">Garantias</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Sistema desbloqueia no nível {WARRANTY_MIN_LEVEL}.
            </p>
          </div>
        </div>
        <div className="ios-surface rounded-[16px] p-6 text-center space-y-2">
          <div className="text-4xl">🔒</div>
          <div className="text-[13px] font-semibold text-foreground">Disponível a partir do Lv {WARRANTY_MIN_LEVEL}</div>
          <div className="text-[11px] text-muted-foreground leading-relaxed max-w-md mx-auto">
            Você está no Lv {level}. Continue jogando para subir de nível e desbloquear garantias —
            jogadores iniciantes não recebem claims para o jogo não atrapalhar a progressão.
          </div>
        </div>
      </div>
    );
  }

  const pending  = claims.filter(c => c.status === 'pending');
  const resolved = claims.filter(c => c.status !== 'pending').slice(0, 10);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start gap-2">
        <ShieldCheck size={20} className="text-primary mt-0.5" />
        <div className="flex-1">
          <h3 className="font-game-title text-[15px] font-bold flex items-center gap-2">
            Garantias
            {pending.length > 0 && (
              <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Carros vendidos com condição abaixo de 60% podem gerar reclamação. Pague ou recuse.
          </p>
        </div>
      </div>

      {/* Pendentes */}
      {pending.length === 0 ? (
        <div className="ios-surface rounded-[16px] p-6 text-center space-y-2">
          <div className="text-4xl">😌</div>
          <div className="text-[13px] font-semibold text-foreground">Sem reclamações</div>
          <div className="text-[11px] text-muted-foreground">
            Vendendo carros com boa condição (≥ 60%), nenhum cliente reclama.
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pending.map(claim => {
            const timeLeft = fmtTimeLeft(claim.expiresAt);
            const expired  = claim.expiresAt - Date.now() <= 0;
            const canAffordRepair = gameState.money >= claim.repairCost;
            return (
              <div key={claim.id} className="ios-surface rounded-[14px] p-3.5 space-y-3 border border-amber-500/30 bg-amber-500/5">
                {/* Header do claim */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-[12px] bg-amber-500/15 flex items-center justify-center text-2xl shrink-0">
                    {claim.car.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-bold text-foreground truncate">
                        {claim.buyerName}
                      </span>
                      <span className="text-[9px] font-bold text-amber-500 px-1.5 py-0.5 rounded-full bg-amber-500/15 flex items-center gap-0.5">
                        <ShieldAlert size={9} /> Reclamação
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {claim.car.fullName} · vendido por {fmt(claim.salePrice)}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] mt-0.5">
                      <Clock size={9} className={expired ? 'text-red-400' : 'text-muted-foreground'} />
                      <span className={expired ? 'text-red-400 font-semibold' : 'text-muted-foreground'}>
                        {timeLeft}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pedido do cliente */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-[10px] p-2.5 space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">
                    Cliente está pedindo:
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{claim.repairIcon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-foreground">{claim.repairName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {ATTR_LABEL[claim.attribute] ?? claim.attribute} · vendido com cond. {claim.car.condition}%
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[16px] font-bold text-amber-500 tabular-nums">{fmt(claim.repairCost)}</div>
                      <div className="text-[9px] text-muted-foreground">custo do reparo</div>
                    </div>
                  </div>
                </div>

                {/* Avisos e ações */}
                <div className="text-[10px] text-muted-foreground italic flex items-start gap-1 leading-relaxed">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5 text-red-400" />
                  <span>
                    Se recusar, <strong>{fmt(claim.salePrice)}</strong> serão subtraídos do seu saldo
                    e o <strong>{claim.car.brand} {claim.car.model}</strong> volta para a garagem.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-400 border-red-500/30 hover:bg-red-500/10 gap-1.5"
                    onClick={() => {
                      const r = onRefuseClaim(claim.id);
                      if (r.success) toast.warning(r.message);
                      else toast.error(r.message);
                    }}
                  >
                    <ShieldX size={13} /> Recusar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={!canAffordRepair}
                    onClick={() => {
                      const r = onPayClaim(claim.id);
                      if (r.success) toast.success(r.message);
                      else toast.error(r.message);
                    }}
                  >
                    <ShieldCheck size={13} /> Pagar {fmt(claim.repairCost)}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Histórico */}
      {resolved.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-border/40">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
            Histórico recente
          </div>
          {resolved.map(claim => (
            <div key={claim.id} className={`ios-surface rounded-[12px] p-2.5 flex items-center gap-2.5 ${
              claim.status === 'paid' ? 'opacity-80' : 'opacity-60'
            }`}>
              <span className="text-lg">{claim.car.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold text-foreground truncate">{claim.buyerName}</span>
                  {claim.status === 'paid' ? (
                    <span className="text-[9px] font-bold text-emerald-400 px-1 rounded bg-emerald-500/10">PAGO</span>
                  ) : (
                    <span className="text-[9px] font-bold text-red-400 px-1 rounded bg-red-500/10">RECUSADO</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {claim.repairName} · {fmt(claim.repairCost)}
                </div>
              </div>
              <button
                onClick={() => onDismissClaim(claim.id)}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="Remover do histórico"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
