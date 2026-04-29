import { useEffect, useMemo, useState } from 'react';
import { useAdminApi, type AdminPlayer } from '@/hooks/useAdminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Users, Plus, Minus, Save, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);

export function AdminPlayersTab() {
  const api = useAdminApi();
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const load = async () => {
    setLoading(true);
    setPlayers(await api.listPlayers());
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter(p =>
      p.display_name.toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q)
    );
  }, [players, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Users size={18} className="text-primary" /> Jogadores
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {players.length} jogadores · ajuste saldo via SET (valor exato) ou ADJUST (delta).
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : 'Atualizar'}
        </Button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {loading && players.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Loader2 size={20} className="animate-spin mx-auto mb-2" />
          Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="ios-surface rounded-[12px] p-6 text-center text-sm text-muted-foreground">
          Nenhum jogador encontrado.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(p => (
            <PlayerCard
              key={p.user_id}
              player={p}
              onSet={async (newMoney) => {
                try {
                  await api.setPlayerMoney(p.user_id, newMoney);
                  toast.success(`Saldo de ${p.display_name} definido para ${fmt(newMoney)}.`);
                  await load();
                } catch {
                  toast.error('Falha ao definir saldo.');
                }
              }}
              onAdjust={async (delta) => {
                try {
                  const newVal = await api.adjustPlayerMoney(p.user_id, delta);
                  toast.success(`Saldo de ${p.display_name}: ${fmt(newVal)} (${delta > 0 ? '+' : ''}${fmt(delta)}).`);
                  await load();
                } catch {
                  toast.error('Falha ao ajustar saldo.');
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerCard({
  player, onSet, onAdjust,
}: {
  player: AdminPlayer;
  onSet:    (newMoney: number) => Promise<void>;
  onAdjust: (delta: number)    => Promise<void>;
}) {
  const [setValue,    setSetValue]    = useState('');
  const [adjustValue, setAdjustValue] = useState('');
  const [busy, setBusy] = useState(false);

  const parsedSet    = parseInt(setValue.replace(/\D/g, '') || '0', 10);
  const parsedAdjust = parseInt(adjustValue.replace(/[^\d-]/g, '') || '0', 10);

  return (
    <div className="ios-surface rounded-[14px] p-3.5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-base shrink-0">
          👤
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{player.display_name}</div>
          <div className="text-[11px] text-muted-foreground truncate">{player.email}</div>
          <div className="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
              Lv {player.level}
            </span>
            <span className="text-muted-foreground">
              Patrimônio: <strong>{fmt(player.total_patrimony ?? 0)}</strong>
            </span>
            <span className="text-muted-foreground">
              Vitórias: <strong>{player.races_won}</strong>
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Saldo</div>
          <div className="text-base font-bold tabular-nums">{fmt(Number(player.money ?? 0))}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
        {/* SET */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Definir saldo (SET)
          </div>
          <div className="flex gap-1.5">
            <Input
              placeholder="0"
              value={setValue}
              onChange={e => setSetValue(e.target.value)}
              className="text-[12px]"
              inputMode="numeric"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || parsedSet < 0}
              onClick={async () => {
                setBusy(true);
                await onSet(parsedSet);
                setSetValue('');
                setBusy(false);
              }}
            >
              <Save size={12} />
            </Button>
          </div>
        </div>

        {/* ADJUST */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Ajustar (+/-)
          </div>
          <div className="flex gap-1.5">
            <Input
              placeholder="ex: 5000 ou -1000"
              value={adjustValue}
              onChange={e => setAdjustValue(e.target.value)}
              className="text-[12px]"
              inputMode="numeric"
            />
            <Button
              size="sm"
              variant="outline"
              className={parsedAdjust > 0 ? 'text-emerald-500' : parsedAdjust < 0 ? 'text-red-400' : ''}
              disabled={busy || parsedAdjust === 0}
              onClick={async () => {
                setBusy(true);
                await onAdjust(parsedAdjust);
                setAdjustValue('');
                setBusy(false);
              }}
            >
              {parsedAdjust >= 0 ? <Plus size={12} /> : <Minus size={12} />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
