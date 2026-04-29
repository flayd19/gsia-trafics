import { useEffect, useMemo, useState } from 'react';
import { useAdminApi, type AdminPlayer } from '@/hooks/useAdminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Users, Plus, Minus, Save, Loader2, X, AlertTriangle, Trash2,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);

export function AdminPlayersTab() {
  const api = useAdminApi();
  const [players,    setPlayers]    = useState<AdminPlayer[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [dedupeOpen, setDedupeOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<Array<{
    category:        string;
    email:           string;
    count:           number;
    oldest_user_id:  string;
    newest_user_id:  string;
  }>>([]);
  const [dedupeBusy, setDedupeBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const load = async () => {
    setLoading(true);
    setPlayers(await api.listPlayers());
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openDedupe = async () => {
    setDedupeOpen(true);
    setConfirmText('');
    setDuplicates(await api.listDuplicateAccounts());
  };

  const handleDedupe = async () => {
    if (confirmText !== 'OK') return;
    setDedupeBusy(true);
    try {
      const result = await api.dedupeAccounts();
      if (result) {
        toast.success(
          `Limpeza concluída: ${result.duplicateUsersDeleted} contas duplicadas, ` +
          `${result.orphanProfilesDeleted} perfis órfãos, ` +
          `${result.orphanProgressDeleted} saves órfãos removidos.`,
        );
        setDedupeOpen(false);
        await load();
      }
    } catch {
      toast.error('Falha ao executar limpeza — veja a aba Erros.');
    } finally {
      setDedupeBusy(false);
    }
  };

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
        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void openDedupe()}
            className="gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
          >
            <AlertTriangle size={13} /> Limpar duplicatas
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : 'Atualizar'}
          </Button>
        </div>
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

      {/* Dialog: limpar contas duplicadas */}
      <Dialog open={dedupeOpen} onOpenChange={setDedupeOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Limpar contas duplicadas e órfãs
            </DialogTitle>
            <DialogDescription className="text-xs">
              Para cada email com múltiplas contas em <code>auth.users</code>, mantém a mais antiga
              e mescla o maior saldo. Remove perfis e progresso órfãos. Para confirmar digite{' '}
              <code>OK</code>:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Itens detectados ({duplicates.length})
            </div>
            {duplicates.length === 0 ? (
              <div className="ios-surface rounded-[10px] p-4 text-center text-xs text-muted-foreground">
                ✨ Nenhuma duplicata ou órfão encontrado.
              </div>
            ) : (
              <div className="space-y-1 max-h-[240px] overflow-y-auto">
                {duplicates.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 ios-surface rounded-[8px] p-2 text-xs"
                  >
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      d.category === 'duplicate_email'
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-amber-500/15 text-amber-500'
                    }`}>
                      {d.category === 'duplicate_email' ? 'DUPLICATA' :
                       d.category === 'orphan_profile' ? 'PERFIL ÓRFÃO' :
                       'PROGRESSO ÓRFÃO'}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-mono text-[10px]">
                      {d.email}
                    </span>
                    {d.count > 1 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {d.count}x
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Input
            placeholder="OK"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value.toUpperCase())}
            disabled={dedupeBusy}
          />

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDedupeOpen(false)} disabled={dedupeBusy}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== 'OK' || dedupeBusy || duplicates.length === 0}
              onClick={() => void handleDedupe()}
              className="gap-1.5"
            >
              {dedupeBusy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Executar limpeza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
