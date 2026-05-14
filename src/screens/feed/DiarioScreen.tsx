// =====================================================================
// DiarioScreen.tsx — Social feed "O Diário"
// Doc 06 — Multiplayer Interactions
// =====================================================================

import { useState } from 'react';
import { RefreshCw, Send, Newspaper } from 'lucide-react';
import type { UseFeedReturn, FeedEvent } from '@/hooks/useFeed';

const EMOJIS = ['👍', '🔥', '💰', '😮', '👏'];

const EVENT_ICONS: Record<string, string> = {
  company_created:  '🏭',
  company_sold:     '💼',
  big_sale:         '💸',
  big_purchase:     '🛒',
  loan_taken:       '🏦',
  loan_paid:        '✅',
  upgrade_applied:  '⬆️',
  vitrine_offer:    '🛍️',
  freight_delivered:'🚛',
  bank_deposit:     '💳',
  manual_post:      '✏️',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)  return 'agora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface EventCardProps {
  event: FeedEvent;
  onReact: (emoji: string) => void;
}

function EventCard({ event, onReact }: EventCardProps) {
  const icon = EVENT_ICONS[event.eventType] ?? '📰';

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700/40 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-slate-700 flex items-center justify-center text-xl shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold text-white text-sm truncate">{event.playerName}</p>
            <span className="text-slate-500 text-xs shrink-0">{timeAgo(event.createdAt)}</span>
          </div>
          <p className="text-slate-300 text-sm mt-0.5 leading-relaxed">{event.text}</p>
        </div>
      </div>

      {/* Reactions */}
      <div className="flex items-center gap-2 flex-wrap">
        {EMOJIS.map((emoji) => {
          const r = event.reactions.find((rx) => rx.emoji === emoji);
          return (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95 ${
                r?.myReaction
                  ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300'
                  : 'bg-slate-700/60 border border-slate-600/40 text-slate-400 hover:border-slate-500'
              }`}
            >
              {emoji} {r && r.count > 0 && <span>{r.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── DiarioScreen ──────────────────────────────────────────────────────

interface Props {
  feed: UseFeedReturn;
}

export function DiarioScreen({ feed }: Props) {
  const [text, setText]       = useState('');
  const [posting, setPosting] = useState(false);
  const [toast, setToast]     = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handlePost = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPosting(true);
    const res = await feed.postEvent(trimmed);
    setPosting(false);
    if (res.ok) {
      setText('');
      showToast('Publicado!');
    } else {
      showToast(`Erro: ${res.error}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Compose */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-800/60">
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Compartilhe algo com os outros jogadores..."
            maxLength={280}
            rows={2}
            className="flex-1 rounded-xl bg-slate-800 border border-slate-700/50 text-white placeholder-slate-500 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
          <button
            disabled={!text.trim() || posting}
            onClick={handlePost}
            className={`p-3 rounded-xl font-bold transition-all active:scale-95 self-end ${
              text.trim() && !posting
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Send size={16} />
          </button>
        </div>
        {text.length > 200 && (
          <p className={`text-xs mt-1 text-right ${text.length > 260 ? 'text-red-400' : 'text-slate-500'}`}>
            {text.length}/280
          </p>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">O Diário</p>
        <button
          onClick={() => feed.refresh()}
          className="p-1.5 rounded-full hover:bg-slate-800 active:scale-95 transition-all"
        >
          <RefreshCw size={14} className={`text-slate-500 ${feed.loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {feed.loading && !feed.events.length && (
          <div className="text-center text-slate-500 py-12 text-sm">Carregando...</div>
        )}
        {!feed.loading && !feed.events.length && (
          <div className="text-center text-slate-500 py-12">
            <Newspaper size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum post ainda. Seja o primeiro!</p>
          </div>
        )}
        {feed.events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onReact={(emoji) => feed.react(event.id, emoji)}
          />
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-full shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
