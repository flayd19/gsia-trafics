// =====================================================================
// NegociacoesModule.tsx — Negotiations: notifications + social feed
// Doc 05/06
// =====================================================================

import { useState } from 'react';
import { DiarioScreen } from '@/screens/feed/DiarioScreen';
import { useFeed }       from '@/hooks/useFeed';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import { Bell, MessageCircle } from 'lucide-react';

type Tab = 'notificacoes' | 'diario';

interface Props {
  cadeia: UseCadeiaReturn;
}

export function NegociacoesModule({ cadeia }: Props) {
  const [tab, setTab] = useState<Tab>('notificacoes');
  const feed = useFeed();
  const { state } = cadeia;
  const notifications = state.notifications.slice().sort((a, b) => b.createdAt - a.createdAt);

  const TYPE_COLORS: Record<string, string> = {
    success: 'text-emerald-400 bg-emerald-900/20 border-emerald-700/30',
    warning: 'text-amber-400  bg-amber-900/20  border-amber-700/30',
    error:   'text-red-400    bg-red-900/20    border-red-700/30',
    info:    'text-blue-400   bg-blue-900/20   border-blue-700/30',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-slate-800/60 shrink-0">
        <button
          onClick={() => setTab('notificacoes')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === 'notificacoes' ? 'bg-slate-700 text-white' : 'text-slate-500'
          }`}
        >
          <Bell size={14} />
          Notificações
          {notifications.filter((n) => !n.read).length > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {notifications.filter((n) => !n.read).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('diario')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === 'diario' ? 'bg-slate-700 text-white' : 'text-slate-500'
          }`}
        >
          <MessageCircle size={14} /> O Diário
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'notificacoes' && (
          <div className="overflow-y-auto h-full px-4 py-3 space-y-2">
            {notifications.length === 0 && (
              <div className="text-center text-slate-500 py-12">
                <Bell size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => cadeia.markNotificationRead(n.id)}
                className={`rounded-xl border p-3 cursor-pointer transition-all ${
                  TYPE_COLORS[n.type] ?? TYPE_COLORS.info
                } ${!n.read ? 'opacity-100' : 'opacity-50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm">{n.title}</p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-current shrink-0 mt-1.5" />}
                </div>
                <p className="text-xs mt-0.5 opacity-80">{n.message}</p>
                <p className="text-xs opacity-50 mt-1">
                  {new Date(n.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
            {notifications.length > 0 && (
              <button
                onClick={cadeia.clearNotifications}
                className="w-full text-center text-slate-500 text-xs py-2 hover:text-slate-300 transition-colors"
              >
                Limpar tudo
              </button>
            )}
          </div>
        )}

        {tab === 'diario' && <DiarioScreen feed={feed} />}
      </div>
    </div>
  );
}
