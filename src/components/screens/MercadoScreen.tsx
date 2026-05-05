// =====================================================================
// MercadoScreen — Mercado NPC + P2P de materiais
// =====================================================================
import { useState, useMemo } from 'react';
import { ShoppingCart, RefreshCw, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GameState } from '@/types/game';
import { MATERIALS, getMaterialDef, currentMaterialPrice, fmt } from '@/data/construction';

interface MercadoScreenProps {
  gameState:   GameState;
  onBuyMaterial: (
    materialId: string,
    quantity: number,
    unitPrice: number,
  ) => { ok: boolean; message: string };
}

type Tab = 'npc' | 'p2p';

interface CartItem {
  materialId: string;
  quantity:   number;
  unitPrice:  number;
}

export function MercadoScreen({ gameState, onBuyMaterial }: MercadoScreenProps) {
  const [tab,     setTab]     = useState<Tab>('npc');
  const [cart,    setCart]    = useState<CartItem[]>([]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Preços NPC (recalculados uma vez por render, simulando variação de mercado)
  const npcPrices = useMemo(() =>
    MATERIALS.map(m => ({ ...m, currentPrice: currentMaterialPrice(m) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab], // recalcula ao mudar de aba (simula atualização)
  );

  function flash(result: { ok: boolean; message: string }) {
    setMessage({ text: result.message, ok: result.ok });
    setTimeout(() => setMessage(null), 3_500);
  }

  // ── Carrinho ──────────────────────────────────────────────────────
  function setQty(materialId: string, delta: number, unitPrice: number) {
    setCart(prev => {
      const existing = prev.find(c => c.materialId === materialId);
      const current  = existing?.quantity ?? 0;
      const next     = Math.max(0, current + delta);
      if (next === 0) return prev.filter(c => c.materialId !== materialId);
      if (existing) return prev.map(c => c.materialId === materialId ? { ...c, quantity: next } : c);
      return [...prev, { materialId, quantity: next, unitPrice }];
    });
  }

  function cartQty(materialId: string) {
    return cart.find(c => c.materialId === materialId)?.quantity ?? 0;
  }

  const cartTotal    = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);
  const canAfford    = gameState.money >= cartTotal;

  function buyCart() {
    if (cart.length === 0) return;
    let allOk = true;
    for (const item of cart) {
      const result = onBuyMaterial(item.materialId, item.quantity, item.unitPrice);
      if (!result.ok) { allOk = false; flash(result); break; }
    }
    if (allOk) {
      setCart([]);
      flash({ ok: true, message: `✅ Compra realizada! ${fmt(cartTotal)} debitado.` });
    }
  }

  function buySingle(materialId: string, unitPrice: number) {
    const qty = cartQty(materialId);
    if (qty === 0) {
      flash({ ok: false, message: 'Selecione a quantidade primeiro.' });
      return;
    }
    const result = onBuyMaterial(materialId, qty, unitPrice);
    flash(result);
    if (result.ok) setCart(prev => prev.filter(c => c.materialId !== materialId));
  }

  const categories = ['estrutura', 'alvenaria', 'cobertura', 'acabamento'] as const;
  const catLabels: Record<string, string> = {
    estrutura:   '🏗️ Estrutura',
    alvenaria:   '🧱 Alvenaria',
    cobertura:   '🏠 Cobertura',
    acabamento:  '🎨 Acabamento',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-game-title text-xl font-bold text-foreground flex items-center gap-2">
          🏪 Mercado
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Compre materiais para as obras
        </p>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1 p-1 ios-surface rounded-[14px]">
        {([
          { id: 'npc', label: 'Fornecedores NPC' },
          { id: 'p2p', label: 'Entre Jogadores' },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-[10px] text-[12px] font-semibold transition-all ${
              tab === id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {message && (
        <div className={`px-3 py-2 rounded-[10px] text-[12px] font-medium ${
          message.ok
            ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/25 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* ── NPC ──────────────────────────────────────────────── */}
      {tab === 'npc' && (
        <div className="space-y-4">
          {/* Nota de variação */}
          <div className="ios-surface rounded-[12px] px-3 py-2 flex items-center gap-2">
            <RefreshCw size={12} className="text-primary shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Preços variam ±10% a cada visita. Compre em quantidade para economizar.
            </p>
          </div>

          {/* Categorias */}
          {categories.map(cat => {
            const catMats = npcPrices.filter(m => m.category === cat);
            return (
              <div key={cat} className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
                  {catLabels[cat]}
                </div>
                {catMats.map(mat => {
                  const qty     = cartQty(mat.materialId);
                  const stock   = gameState.warehouse.find(w => w.materialId === mat.materialId);
                  const total   = qty * mat.currentPrice;
                  return (
                    <div key={mat.materialId} className="ios-surface rounded-[12px] p-3 space-y-2">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">{mat.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-foreground">{mat.name}</div>
                          <div className="text-[10px] text-muted-foreground">{mat.unit}</div>
                          {stock && (
                            <div className="text-[10px] text-emerald-400 font-semibold">
                              Estoque: {stock.quantity.toLocaleString('pt-BR')}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[15px] font-bold text-primary">
                            {fmt(mat.currentPrice)}
                          </div>
                          <div className="text-[9px] text-muted-foreground">/{mat.unit}</div>
                        </div>
                      </div>

                      {/* Controles de quantidade */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 ios-surface rounded-[10px] px-2 py-1 !shadow-none bg-muted/30">
                          {[1, 10, 50, 100].map(delta => (
                            <button
                              key={delta}
                              onClick={() => setQty(mat.materialId, -delta, mat.currentPrice)}
                              disabled={qty < delta}
                              className="text-[10px] font-bold text-red-400 disabled:opacity-30 w-5 text-center"
                            >
                              -{delta}
                            </button>
                          ))}
                          <span className="text-[13px] font-bold text-foreground tabular-nums w-8 text-center">
                            {qty}
                          </span>
                          {[1, 10, 50, 100].map(delta => (
                            <button
                              key={delta}
                              onClick={() => setQty(mat.materialId, delta, mat.currentPrice)}
                              className="text-[10px] font-bold text-emerald-400 w-5 text-center"
                            >
                              +{delta}
                            </button>
                          ))}
                        </div>

                        <Button
                          size="sm"
                          disabled={qty === 0 || gameState.money < total}
                          onClick={() => buySingle(mat.materialId, mat.currentPrice)}
                          className="flex-1 text-[12px] gap-1"
                        >
                          <ShoppingCart size={12} />
                          {qty > 0 ? `Comprar · ${fmt(total)}` : 'Selecione qty'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Botão comprar tudo */}
          {cart.length > 0 && (
            <div className="sticky bottom-0 ios-surface rounded-[14px] p-3 border border-primary/20 bg-background/80 backdrop-blur-sm space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">
                  {cart.length} itens no carrinho
                </span>
                <span className={`font-bold ${canAfford ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(cartTotal)}
                </span>
              </div>
              <Button
                className="w-full gap-1.5"
                disabled={!canAfford}
                onClick={buyCart}
              >
                <ShoppingCart size={14} />
                Comprar tudo · {fmt(cartTotal)}
              </Button>
              {!canAfford && (
                <div className="text-[10px] text-red-400 text-center">
                  Saldo insuficiente ({fmt(gameState.money)})
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── P2P ──────────────────────────────────────────────── */}
      {tab === 'p2p' && (
        <div className="ios-surface rounded-[16px] p-8 text-center space-y-3">
          <div className="text-4xl">🤝</div>
          <div className="text-[14px] font-semibold text-foreground">
            Mercado entre jogadores
          </div>
          <div className="text-[11px] text-muted-foreground">
            Em breve: compre e venda materiais diretamente com outros jogadores.
            Negocie preços e faça parcerias!
          </div>
          <div className="flex flex-wrap gap-2 justify-center text-[11px] text-muted-foreground">
            {['Materiais excedentes', 'Preços abaixo do NPC', 'Negociação direta'].map(t => (
              <span key={t} className="ios-surface px-2 py-1 rounded-full text-[10px]">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
