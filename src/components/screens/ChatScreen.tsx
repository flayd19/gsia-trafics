// =====================================================================
// ChatScreen — Mensagens entre jogadores com envio de dinheiro/carros
// =====================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Search, Send, DollarSign, Car as CarIcon,
  CheckCircle, MessageSquare, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { GameState, OwnedCar } from '@/types/game';
import {
  useChat,
  type ChatMessage,
  type ChatThread,
  type PlayerListEntry,
} from '@/hooks/useChat';
import { conditionValueFactor } from '@/data/cars';

interface ChatScreenProps {
  gameState:    GameState;
  onMoneyDeducted: (amount: number) => void;
  onCarRemoved:    (carInstanceId: string) => void;
  onCarClaimed:    (car: OwnedCar) => { success: boolean; message: string };
  onMoneyReceived?: (amount: number) => void;
  /** Idempotente: aplica crédito e marca messageId como processado. */
  onIncomingChatMoney?: (messageId: string, amount: number) => void;
  /** Idempotente: aplica débito e marca messageId como processado. */
  onOutgoingChatMoney?: (messageId: string, amount: number) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

// ── Tela principal ──────────────────────────────────────────────────
export function ChatScreen({
  gameState,
  onMoneyDeducted,
  onCarRemoved,
  onCarClaimed,
  onMoneyReceived,
  onIncomingChatMoney,
  onOutgoingChatMoney,
}: ChatScreenProps) {
  const chat = useChat({
    currentMoney: gameState.money,
    onMoneyDeducted,
    onCarRemoved,
    onCarClaimed,
    onMoneyReceived,
    onIncomingChatMoney,
    onOutgoingChatMoney,
  });

  const carsInGarage = useMemo(
    () => (gameState.garage ?? []).filter(s => s.unlocked && s.car).map(s => s.car!),
    [gameState.garage],
  );

  // ── Conversa aberta ───────────────────────────────────────────────
  if (chat.activeOtherId) {
    return (
      <ConversationView
        chat={chat}
        carsInGarage={carsInGarage}
        currentMoney={gameState.money}
      />
    );
  }

  // ── Lista de threads + busca ─────────────────────────────────────
  return (
    <ThreadListView chat={chat} />
  );
}

// ── Lista de conversas + jogadores ──────────────────────────────────
interface ThreadListViewProps {
  chat: ReturnType<typeof useChat>;
}

function ThreadListView({ chat }: ThreadListViewProps) {
  const [tab, setTab]       = useState<'conversas' | 'jogadores'>('conversas');
  const [search, setSearch] = useState('');

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chat.allPlayers;
    return chat.allPlayers.filter(p => p.displayName.toLowerCase().includes(q));
  }, [chat.allPlayers, search]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-game-title text-xl font-bold flex items-center gap-2">
            <MessageSquare size={20} className="text-primary" />
            Chat
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Converse, envie dinheiro e carros para outros jogadores.
          </p>
        </div>
        {chat.totalUnread > 0 && (
          <span className="px-2 py-1 rounded-full bg-red-500 text-white text-[11px] font-bold">
            {chat.totalUnread}
          </span>
        )}
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1 p-1 ios-surface rounded-[14px]">
        <button
          onClick={() => setTab('conversas')}
          className={`flex-1 py-2 rounded-[10px] text-[13px] font-semibold transition-all ${
            tab === 'conversas'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <MessageSquare size={12} />
            Conversas
            {chat.totalUnread > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                {chat.totalUnread}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setTab('jogadores')}
          className={`flex-1 py-2 rounded-[10px] text-[13px] font-semibold transition-all ${
            tab === 'jogadores'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Users size={12} />
            Jogadores
            <span className="text-[10px] text-muted-foreground font-normal">({chat.allPlayers.length})</span>
          </span>
        </button>
      </div>

      {/* ── Aba Conversas ────────────────────────────────────────── */}
      {tab === 'conversas' && (
        <div className="space-y-2">
          {chat.loadingThreads && chat.threads.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-muted-foreground">Carregando...</div>
          ) : chat.threads.length === 0 ? (
            <div className="ios-surface rounded-[16px] p-8 text-center space-y-2">
              <div className="text-4xl">💬</div>
              <div className="text-[14px] font-semibold text-foreground">Nenhuma conversa ainda</div>
              <div className="text-[11px] text-muted-foreground">
                Vá na aba "Jogadores" para iniciar um chat.
              </div>
            </div>
          ) : (
            chat.threads.map(t => (
              <ThreadCard
                key={t.otherUserId}
                thread={t}
                onOpen={() => void chat.openConversation(t.otherUserId, t.otherName)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Aba Jogadores ────────────────────────────────────────── */}
      {tab === 'jogadores' && (
        <div className="space-y-3">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              placeholder="Buscar jogador..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 text-[13px]"
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

          {chat.loadingPlayers && chat.allPlayers.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-muted-foreground">Carregando...</div>
          ) : filteredPlayers.length === 0 ? (
            <div className="ios-surface rounded-[16px] p-6 text-center space-y-2">
              <div className="text-3xl">🔍</div>
              <div className="text-[13px] text-muted-foreground">Nenhum jogador encontrado</div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredPlayers.map(p => (
                <PlayerCard
                  key={p.userId}
                  player={p}
                  onMessage={() => void chat.openConversation(p.userId, p.displayName)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Card de conversa (thread) ───────────────────────────────────────
function ThreadCard({ thread, onOpen }: { thread: ChatThread; onOpen: () => void }) {
  const isUnread = thread.unreadCount > 0;
  let preview = '';
  switch (thread.lastType) {
    case 'text':
      preview = thread.lastContent ?? '';
      break;
    case 'money_sent':
      preview = `💰 ${fmt(Number(thread.lastPayload?.amount ?? 0))}`;
      break;
    case 'car_sent':
      preview = `🚗 enviou um carro`;
      break;
  }
  return (
    <button
      onClick={onOpen}
      className={`w-full ios-surface rounded-[14px] p-3 flex items-center gap-3 text-left transition-all hover:bg-muted/30 ${
        isUnread ? 'border border-primary/30 bg-primary/5' : ''
      }`}
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 ${
        isUnread ? 'bg-primary/15' : 'bg-muted'
      }`}>
        👤
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[13px] truncate ${isUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground'}`}>
            {thread.otherName}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {fmtTime(thread.lastCreatedAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className={`text-[11px] truncate ${isUnread ? 'text-foreground/90' : 'text-muted-foreground'}`}>
            {preview}
          </span>
          {isUnread && (
            <span className="shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {thread.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Card de jogador ─────────────────────────────────────────────────
function PlayerCard({ player, onMessage }: { player: PlayerListEntry; onMessage: () => void }) {
  return (
    <div className="ios-surface rounded-[12px] p-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg shrink-0">
        👤
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-foreground truncate">{player.displayName}</div>
        <div className="text-[10px] text-muted-foreground">
          Lv {player.level} · {fmt(player.patrimony)}
        </div>
      </div>
      <Button size="sm" onClick={onMessage} className="text-[12px] gap-1.5 px-3">
        <MessageSquare size={13} />
        Chat
      </Button>
    </div>
  );
}

// ── Visualização de uma conversa ───────────────────────────────────
interface ConversationViewProps {
  chat:         ReturnType<typeof useChat>;
  carsInGarage: OwnedCar[];
  currentMoney: number;
}

function ConversationView({ chat, carsInGarage, currentMoney }: ConversationViewProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll para o fim quando novas mensagens chegam
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat.activeMessages.length]);

  const handleSendText = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const r = await chat.sendText(text);
    setSending(false);
    if (r.success) setText('');
    else toast.error(r.message);
  };

  return (
    <div className="space-y-3 flex flex-col" style={{ minHeight: '70vh' }}>
      {/* Header conversa */}
      <div className="flex items-center gap-2">
        <button
          onClick={chat.closeConversation}
          className="p-1.5 rounded-full hover:bg-muted/50"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} className="text-muted-foreground" />
        </button>
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-base">
          👤
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold text-foreground">{chat.activeOtherName}</div>
          <div className="text-[10px] text-muted-foreground">conversa privada</div>
        </div>
      </div>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        className="flex-1 ios-surface rounded-[14px] p-3 overflow-y-auto space-y-2 min-h-[400px]"
      >
        {chat.loadingMessages && chat.activeMessages.length === 0 ? (
          <div className="text-center py-8 text-[12px] text-muted-foreground">Carregando...</div>
        ) : chat.activeMessages.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <div className="text-3xl">👋</div>
            <div className="text-[12px] text-muted-foreground">
              Comece a conversa enviando uma mensagem.
            </div>
          </div>
        ) : (
          chat.activeMessages.map(m => (
            <MessageBubble
              key={m.id}
              msg={m}
              isMine={m.senderId === chat.myUserId}
              onClaimCar={async () => {
                const r = await chat.claimCar(m.id);
                if (r.success) toast.success(r.message);
                else toast.error(r.message);
              }}
            />
          ))
        )}
      </div>

      {/* Compose */}
      <div className="space-y-2">
        <div className="flex gap-1.5">
          <SendMoneyDialog
            currentMoney={currentMoney}
            onSend={async (amount, message) => {
              const r = await chat.sendMoney(amount, message);
              if (r.success) toast.success(r.message);
              else toast.error(r.message);
              return r.success;
            }}
          />
          <SendCarDialog
            cars={carsInGarage}
            onSend={async (car, message) => {
              const r = await chat.sendCar(car, message);
              if (r.success) toast.success(r.message);
              else toast.error(r.message);
              return r.success;
            }}
          />
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Mensagem..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSendText(); }}
            maxLength={500}
            disabled={sending}
            className="text-[13px]"
          />
          <Button
            size="sm"
            onClick={() => void handleSendText()}
            disabled={!text.trim() || sending}
            className="px-3"
          >
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Bolha de mensagem ───────────────────────────────────────────────
function MessageBubble({
  msg, isMine, onClaimCar,
}: {
  msg: ChatMessage;
  isMine: boolean;
  onClaimCar: () => void;
}) {
  const align = isMine ? 'items-end' : 'items-start';
  const bg    = isMine ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-foreground';

  return (
    <div className={`flex flex-col ${align}`}>
      <div className={`max-w-[85%] rounded-[14px] px-3 py-2 ${bg}`}>
        {msg.type === 'text' && (
          <p className="text-[13px] whitespace-pre-wrap break-words">{msg.content}</p>
        )}
        {msg.type === 'money_sent' && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider opacity-80 font-semibold">
              <DollarSign size={11} /> {isMine ? 'Você enviou' : 'Recebeu'}
            </div>
            <div className="text-[18px] font-black tabular-nums">
              {fmt(Number(msg.payload?.amount ?? 0))}
            </div>
            {msg.content && (
              <p className="text-[12px] mt-1 opacity-90 italic border-t border-current/20 pt-1">
                "{msg.content}"
              </p>
            )}
          </div>
        )}
        {msg.type === 'car_sent' && (
          <CarMessage msg={msg} isMine={isMine} onClaim={onClaimCar} />
        )}
      </div>
      <span className="text-[9px] text-muted-foreground mt-0.5 px-1">{fmtTime(msg.createdAt)}</span>
    </div>
  );
}

function CarMessage({
  msg, isMine, onClaim,
}: {
  msg: ChatMessage;
  isMine: boolean;
  onClaim: () => void;
}) {
  const car = msg.payload?.car;
  const claimed = !!msg.payload?.claimed;
  if (!car) {
    return <div className="text-[12px] opacity-70">Carro indisponível</div>;
  }
  return (
    <div className="space-y-1.5 min-w-[200px]">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider opacity-80 font-semibold">
        <CarIcon size={11} /> {isMine ? 'Você enviou' : 'Recebeu carro'}
      </div>
      <div className="flex items-center gap-2 bg-current/5 rounded-[10px] p-2">
        <span className="text-2xl">{car.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold truncate">{car.fullName}</div>
          <div className="text-[10px] opacity-80">
            {car.year} · Cond. {car.condition}%
          </div>
        </div>
      </div>
      {msg.content && (
        <p className="text-[11px] mt-1 opacity-90 italic border-t border-current/20 pt-1">
          "{msg.content}"
        </p>
      )}
      {!isMine && (
        claimed ? (
          <div className="text-[11px] flex items-center gap-1 text-emerald-400 font-semibold">
            <CheckCircle size={11} /> Recebido na garagem
          </div>
        ) : (
          <Button size="sm" className="w-full text-[11px] mt-1" onClick={onClaim}>
            Aceitar carro
          </Button>
        )
      )}
      {isMine && claimed && (
        <div className="text-[10px] opacity-70 italic">✓ aceito pelo destinatário</div>
      )}
    </div>
  );
}

// ── Dialog: enviar dinheiro ─────────────────────────────────────────
function SendMoneyDialog({
  currentMoney, onSend,
}: {
  currentMoney: number;
  onSend: (amount: number, message?: string) => Promise<boolean>;
}) {
  const [open, setOpen]       = useState(false);
  const [amount, setAmount]   = useState('');
  const [note, setNote]       = useState('');
  const [sending, setSending] = useState(false);

  const numericAmount = parseInt(amount.replace(/\D/g, '') || '0', 10);
  const valid = numericAmount > 0 && numericAmount <= currentMoney;

  const handleSend = async () => {
    if (!valid || sending) return;
    setSending(true);
    const ok = await onSend(numericAmount, note.trim() || undefined);
    setSending(false);
    if (ok) {
      setOpen(false);
      setAmount('');
      setNote('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-[12px] border-emerald-500/30 text-emerald-500">
          <DollarSign size={13} /> Dinheiro
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-500" />
            Enviar dinheiro
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Saldo disponível: <strong>{fmt(currentMoney)}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Valor</label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="text-[16px] font-mono mt-1"
            />
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {[1_000, 5_000, 10_000, 50_000, 100_000].map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  disabled={v > currentMoney}
                  className="px-2 py-0.5 rounded-[8px] text-[11px] bg-muted hover:bg-muted/70 disabled:opacity-30"
                >
                  {fmt(v)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Mensagem (opcional)</label>
            <Input
              placeholder="Algum recado..."
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={150}
              className="text-[13px] mt-1"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => void handleSend()} disabled={!valid || sending}>
            {sending ? 'Enviando...' : `Enviar ${valid ? fmt(numericAmount) : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: enviar carro ────────────────────────────────────────────
function SendCarDialog({
  cars, onSend,
}: {
  cars: OwnedCar[];
  onSend: (car: OwnedCar, message?: string) => Promise<boolean>;
}) {
  const [open, setOpen]       = useState(false);
  const [selected, setSelected] = useState<OwnedCar | null>(null);
  const [note, setNote]       = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!selected || sending) return;
    setSending(true);
    const ok = await onSend(selected, note.trim() || undefined);
    setSending(false);
    if (ok) {
      setOpen(false);
      setSelected(null);
      setNote('');
    }
  };

  const inRepair = (c: OwnedCar) => !!c.inRepair;
  const sendableCars = cars.filter(c => !inRepair(c));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-[12px] border-primary/30 text-primary">
          <CarIcon size={13} /> Carro
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CarIcon size={18} className="text-primary" />
            Enviar carro
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            O carro será removido da sua garagem após o destinatário aceitar.
          </DialogDescription>
        </DialogHeader>
        {sendableCars.length === 0 ? (
          <div className="ios-surface rounded-[12px] p-4 text-center text-[12px] text-muted-foreground">
            Você não tem carros disponíveis (carros em reparo não podem ser enviados).
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {sendableCars.map(car => {
              const isSelected = selected?.instanceId === car.instanceId;
              const marketValue = Math.round(car.fipePrice * conditionValueFactor(car.condition));
              return (
                <button
                  key={car.instanceId}
                  onClick={() => setSelected(car)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] ios-surface text-left transition-all ${
                    isSelected ? 'border border-primary/40 bg-primary/5' : 'border border-transparent'
                  }`}
                >
                  <span className="text-2xl">{car.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">{car.fullName}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Cond. {car.condition}% · {car.year} · Mercado: {fmt(marketValue)}
                    </div>
                  </div>
                  {isSelected && <CheckCircle size={16} className="text-primary" />}
                </button>
              );
            })}
          </div>
        )}
        {selected && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Mensagem (opcional)</label>
            <Input
              placeholder="Algum recado para o destinatário..."
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={150}
              className="text-[13px]"
            />
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => void handleSend()} disabled={!selected || sending}>
            {sending ? 'Enviando...' : selected ? 'Enviar carro' : 'Selecione um carro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
