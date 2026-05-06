// =====================================================================
// PropriedadesScreen — Gerenciar Imóveis (Construir · Alugar · Vender)
// =====================================================================
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Home, Building2, Hammer, DollarSign, Key, Tag,
  TrendingUp, AlertCircle, CheckCircle2, Clock,
  ChevronRight, Plus, RefreshCw,
} from 'lucide-react';
import type { GameState, PropertyType } from '@/types/game';
import type { UsePropriedadesReturn } from '@/hooks/usePropriedades';
import { BUILD_OPTIONS, AVAILABLE_LOTS, fmtBRL } from '@/hooks/usePropriedades';

// ── Props ─────────────────────────────────────────────────────────

interface PropriedadesScreenProps {
  gameState: GameState;
  proprApi: UsePropriedadesReturn;
  onSpend: (amount: number) => { ok: boolean; message: string };
  onReceive: (amount: number) => void;
}

// ── Status helpers ────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  construindo: 'Em Construção',
  pronto:      'Disponível',
  alugado:     'Alugado',
  a_venda:     'À Venda',
  vendido:     'Vendido',
};

const STATUS_COLOR: Record<string, string> = {
  construindo: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  pronto:      'bg-blue-500/15 text-blue-600 border-blue-500/30',
  alugado:     'bg-green-500/15 text-green-600 border-green-500/30',
  a_venda:     'bg-purple-500/15 text-purple-600 border-purple-500/30',
  vendido:     'bg-muted text-muted-foreground border-border',
};

// ── Main Component ────────────────────────────────────────────────

export function PropriedadesScreen({
  gameState,
  proprApi,
  onSpend,
  onReceive,
}: PropriedadesScreenProps) {
  const [activeTab, setActiveTab] = useState<'meus' | 'construir' | 'alugueis'>('meus');
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [selectedBuildType, setSelectedBuildType] = useState<PropertyType | null>(null);
  const [saleInput, setSaleInput] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currentDay = gameState.gameTime.day;
  const { properties, buyLotAndBuild, listForRent, collectRent, evictTenant, listForSale, cancelSale, acceptBuyer } = proprApi;

  const activeProps = properties.filter(p => p.status !== 'vendido');
  const rentedProps = properties.filter(p => p.status === 'alugado');
  const pendingBuyerProps = properties.filter(p => p.status === 'a_venda' && p.pendingBuyerName);

  // Total investido
  const totalInvested = activeProps.reduce((s, p) => s + p.lotCost + p.buildCost, 0);
  const totalRentMonth = rentedProps.reduce((s, p) => s + p.rentMonthly, 0);

  // ── Construir ──────────────────────────────────────────────────
  const handleBuild = () => {
    if (!selectedLotId || !selectedBuildType) {
      toast.error('Selecione um terreno e um tipo de construção.');
      return;
    }
    const result = buyLotAndBuild(selectedLotId, selectedBuildType, currentDay, gameState.money);
    if (!result.ok) { toast.error(result.message); return; }
    const spendResult = onSpend(result.cost!);
    if (!spendResult.ok) { toast.error(spendResult.message); return; }
    toast.success(result.message);
    setSelectedLotId(null);
    setSelectedBuildType(null);
    setActiveTab('meus');
  };

  // ── Alugar ─────────────────────────────────────────────────────
  const handleRent = (instanceId: string) => {
    const result = listForRent(instanceId, currentDay);
    result.ok ? toast.success(result.message) : toast.error(result.message);
  };

  // ── Cobrar aluguel ─────────────────────────────────────────────
  const handleCollect = (instanceId: string) => {
    const result = collectRent(instanceId, currentDay);
    if (!result.ok) { toast.error(result.message); return; }
    if (result.amount) onReceive(result.amount);
    toast.success(result.message);
  };

  // ── Despejar inquilino ─────────────────────────────────────────
  const handleEvict = (instanceId: string) => {
    const result = evictTenant(instanceId);
    result.ok ? toast.success(result.message) : toast.error(result.message);
  };

  // ── Vender ─────────────────────────────────────────────────────
  const handleListSale = (instanceId: string) => {
    const priceStr = saleInput[instanceId] ?? '';
    const price = parseInt(priceStr.replace(/\D/g, ''), 10);
    if (!price || price < 1000) { toast.error('Informe um preço válido (mín. R$ 1.000).'); return; }
    const result = listForSale(instanceId, price, currentDay);
    result.ok ? toast.success(result.message) : toast.error(result.message);
    setSaleInput(prev => ({ ...prev, [instanceId]: '' }));
  };

  const handleCancelSale = (instanceId: string) => {
    const result = cancelSale(instanceId);
    result.ok ? toast.success(result.message) : toast.error(result.message);
  };

  const handleAcceptBuyer = (instanceId: string) => {
    const result = acceptBuyer(instanceId);
    if (!result.ok) { toast.error(result.message); return; }
    if (result.amount) onReceive(result.amount);
    toast.success(result.message);
  };

  // ── Selected lot details ───────────────────────────────────────
  const selectedLot = AVAILABLE_LOTS.find(l => l.id === selectedLotId);
  const selectedBuild = selectedBuildType ? BUILD_OPTIONS[selectedBuildType] : null;
  const totalCost = selectedLot && selectedBuild
    ? selectedLot.price + selectedBuild.buildCost
    : 0;
  const canAfford = totalCost > 0 && gameState.money >= totalCost;
  const alreadyOwned = selectedLotId ? properties.some(p => p.lotId === selectedLotId && p.status !== 'vendido') : false;

  // ── Tab bar ────────────────────────────────────────────────────
  const tabs = [
    { id: 'meus' as const,     label: 'Meus Imóveis', icon: Home,         count: activeProps.length },
    { id: 'construir' as const, label: 'Construir',   icon: Hammer,       count: null },
    { id: 'alugueis' as const, label: 'Aluguéis',     icon: Key,          count: rentedProps.length },
  ];

  return (
    <div className="space-y-4">
      {/* Header KPIs */}
      <div className="ios-surface p-3 space-y-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          🏠 Portfólio Imobiliário
        </div>
        <div className="grid grid-cols-3 gap-2 mt-1">
          <KpiBox label="Imóveis" value={String(activeProps.length)} icon="🏗️" />
          <KpiBox label="Investido" value={fmtBRL(totalInvested)} icon="💰" />
          <KpiBox label="Aluguel/mês" value={fmtBRL(totalRentMonth)} icon="📈" />
        </div>
        {pendingBuyerProps.length > 0 && (
          <div className="flex items-center gap-2 mt-2 bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-2">
            <AlertCircle size={14} className="text-purple-600 shrink-0" />
            <span className="text-[12px] text-purple-700 font-semibold">
              {pendingBuyerProps.length} comprador{pendingBuyerProps.length > 1 ? 'es' : ''} aguardando resposta!
            </span>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[12px] font-semibold transition-all ${
                active ? 'bg-background shadow text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon size={14} />
              <span>{t.label}</span>
              {t.count !== null && t.count > 0 && (
                <span className={`text-[10px] px-1 rounded-full font-bold ${active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Meus Imóveis ────────────────────────────────────────── */}
      {activeTab === 'meus' && (
        <div className="space-y-3">
          {activeProps.length === 0 ? (
            <EmptyState
              icon="🏗️"
              title="Nenhum imóvel ainda"
              subtitle="Compre um terreno e comece a construir!"
              action="Ir para Construir"
              onAction={() => setActiveTab('construir')}
            />
          ) : (
            activeProps.map(prop => {
              const isExpanded = expandedId === prop.instanceId;
              const buildProgress = prop.status === 'construindo'
                ? Math.min(100, Math.round(((currentDay - prop.buildStartDay) / (prop.buildEndDay - prop.buildStartDay)) * 100))
                : 100;
              const daysLeft = prop.status === 'construindo' ? Math.max(0, prop.buildEndDay - currentDay) : 0;
              const pendingRent = prop.status === 'alugado' && prop.lastRentDay !== undefined
                ? Math.floor((prop.rentMonthly / 30) * (currentDay - prop.lastRentDay))
                : 0;

              return (
                <div key={prop.instanceId} className="ios-surface overflow-hidden">
                  {/* Card header */}
                  <button
                    className="w-full flex items-center gap-3 p-3 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : prop.instanceId)}
                  >
                    <div className="w-11 h-11 rounded-[12px] bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                      {prop.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14px] text-foreground truncate">{prop.name}</div>
                      <div className="text-[11px] text-muted-foreground">{prop.areaM2}m² · {prop.neighborhood}</div>
                      {prop.status === 'construindo' && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${buildProgress}%` }} />
                          </div>
                          <span className="text-[10px] text-amber-600 font-semibold">{daysLeft}d</span>
                        </div>
                      )}
                      {prop.status === 'alugado' && pendingRent > 0 && (
                        <div className="text-[11px] text-green-600 font-semibold mt-0.5">
                          💰 {fmtBRL(pendingRent)} para cobrar
                        </div>
                      )}
                      {prop.status === 'a_venda' && prop.pendingBuyerName && (
                        <div className="text-[11px] text-purple-600 font-semibold mt-0.5 flex items-center gap-1">
                          <AlertCircle size={10} /> {prop.pendingBuyerName} quer comprar!
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${STATUS_COLOR[prop.status]}`}>
                        {STATUS_LABEL[prop.status]}
                      </span>
                      <ChevronRight
                        size={14}
                        className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </button>

                  {/* Expanded actions */}
                  {isExpanded && (
                    <div className="border-t border-border px-3 pb-3 pt-2 space-y-3">
                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2">
                        <MiniStat label="Valor de mercado" value={fmtBRL(prop.marketValue)} />
                        <MiniStat label="Investido" value={fmtBRL(prop.lotCost + prop.buildCost)} />
                        <MiniStat label="Aluguel/mês" value={fmtBRL(prop.rentMonthly)} />
                      </div>

                      {/* Ações por status */}
                      {prop.status === 'pronto' && (
                        <div className="space-y-2">
                          <Button size="sm" className="w-full" onClick={() => handleRent(prop.instanceId)}>
                            <Key size={14} className="mr-1" /> Anunciar para Alugar
                          </Button>
                          <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              className="flex-1 h-9 rounded-xl border border-border bg-muted/50 px-3 text-[13px]"
                              placeholder={`Preço de venda (sugerido: ${fmtBRL(prop.marketValue)})`}
                              value={saleInput[prop.instanceId] ?? ''}
                              onChange={e => setSaleInput(prev => ({ ...prev, [prop.instanceId]: e.target.value }))}
                            />
                            <Button size="sm" variant="outline" onClick={() => handleListSale(prop.instanceId)}>
                              <Tag size={14} /> Vender
                            </Button>
                          </div>
                        </div>
                      )}

                      {prop.status === 'alugado' && (
                        <div className="space-y-2">
                          <div className="text-[12px] text-muted-foreground">
                            Inquilino: <span className="font-semibold text-foreground">{prop.tenantName}</span>
                            {' '}· desde o Dia {prop.tenantSince}
                          </div>
                          <div className="text-[12px] text-muted-foreground">
                            Total recebido: <span className="font-semibold text-green-600">{fmtBRL(prop.rentCollected)}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              disabled={pendingRent <= 0}
                              onClick={() => handleCollect(prop.instanceId)}
                            >
                              <DollarSign size={14} className="mr-1" />
                              Cobrar {pendingRent > 0 ? fmtBRL(pendingRent) : 'Aluguel'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEvict(prop.instanceId)}>
                              Despejar
                            </Button>
                          </div>
                        </div>
                      )}

                      {prop.status === 'a_venda' && (
                        <div className="space-y-2">
                          <div className="text-[12px] text-muted-foreground">
                            Anunciado por <span className="font-semibold text-foreground">{fmtBRL(prop.salePrice!)}</span>
                            {' '}· Dia {prop.listedForSaleDay}
                          </div>
                          {prop.pendingBuyerName ? (
                            <div className="space-y-2">
                              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-2 text-[12px] text-purple-700">
                                🏷️ <strong>{prop.pendingBuyerName}</strong> ofereceu {fmtBRL(prop.salePrice!)}
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1" onClick={() => handleAcceptBuyer(prop.instanceId)}>
                                  <CheckCircle2 size={14} className="mr-1" /> Aceitar venda
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleCancelSale(prop.instanceId)}>
                                  Recusar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                                <Clock size={12} /> Aguardando comprador...
                              </div>
                              <Button size="sm" variant="outline" className="w-full" onClick={() => handleCancelSale(prop.instanceId)}>
                                Cancelar anúncio
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {prop.status === 'construindo' && (
                        <div className="text-[12px] text-muted-foreground flex items-center gap-2">
                          <Hammer size={12} className="text-amber-600" />
                          Conclusão prevista: Dia {prop.buildEndDay} ({daysLeft} dia{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''})
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Construir ───────────────────────────────────────────── */}
      {activeTab === 'construir' && (
        <div className="space-y-4">
          {/* Step 1: Choose lot */}
          <SectionHeader icon="📍" title="1. Escolha o Terreno" />
          <div className="space-y-2">
            {AVAILABLE_LOTS.map(lot => {
              const owned = properties.some(p => p.lotId === lot.id && p.status !== 'vendido');
              const selected = selectedLotId === lot.id;
              return (
                <button
                  key={lot.id}
                  disabled={owned}
                  onClick={() => { setSelectedLotId(lot.id); setSelectedBuildType(null); }}
                  className={`w-full ios-surface p-3 text-left flex items-center gap-3 transition-all ${
                    owned ? 'opacity-50 cursor-not-allowed' : ''
                  } ${selected ? 'ring-2 ring-primary' : ''}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-xl shrink-0">
                    🏞️
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13px] text-foreground">{lot.name}</div>
                    <div className="text-[11px] text-muted-foreground">{lot.neighborhood} · {lot.areaM2}m²</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Aceita: {lot.buildOptions.map(b => BUILD_OPTIONS[b].icon + ' ' + BUILD_OPTIONS[b].name).join(', ')}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13px] font-bold text-foreground">{fmtBRL(lot.price)}</div>
                    {owned && <div className="text-[10px] text-muted-foreground">já possui</div>}
                    {selected && !owned && <CheckCircle2 size={14} className="text-primary ml-auto mt-1" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Step 2: Choose build type */}
          {selectedLot && (
            <>
              <SectionHeader icon="🔨" title="2. Tipo de Construção" />
              <div className="space-y-2">
                {selectedLot.buildOptions.map(typeId => {
                  const b = BUILD_OPTIONS[typeId];
                  const sel = selectedBuildType === typeId;
                  return (
                    <button
                      key={typeId}
                      onClick={() => setSelectedBuildType(typeId)}
                      className={`w-full ios-surface p-3 text-left flex items-center gap-3 transition-all ${sel ? 'ring-2 ring-primary' : ''}`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                        {b.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[13px] text-foreground">{b.name}</div>
                        <div className="text-[11px] text-muted-foreground">{b.areaM2}m² · {b.buildDays} dias</div>
                        <div className="text-[11px] text-muted-foreground">{b.description}</div>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="text-[12px] font-bold text-foreground">{fmtBRL(b.buildCost)}</div>
                        <div className="text-[10px] text-green-600">{fmtBRL(b.rentMonthly)}/mês</div>
                        <div className="text-[10px] text-blue-600">vale {fmtBRL(b.marketValue)}</div>
                        {sel && <CheckCircle2 size={14} className="text-primary ml-auto" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Step 3: Summary + confirm */}
          {selectedLot && selectedBuild && (
            <div className="ios-surface p-4 space-y-3">
              <SectionHeader icon="💼" title="3. Resumo do Investimento" />
              <div className="space-y-1.5 text-[13px]">
                <CostRow label="Terreno" value={fmtBRL(selectedLot.price)} />
                <CostRow label="Construção" value={fmtBRL(selectedBuild.buildCost)} />
                <div className="border-t border-border pt-1.5 flex justify-between font-bold">
                  <span className="text-foreground">Total</span>
                  <span className={canAfford ? 'text-foreground' : 'text-destructive'}>{fmtBRL(totalCost)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <MiniStat label="Retorno aluguel" value={`${fmtBRL(selectedBuild.rentMonthly)}/mês`} />
                  <MiniStat label="Valor estimado" value={fmtBRL(selectedBuild.marketValue)} />
                </div>
              </div>

              {alreadyOwned && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                  <AlertCircle size={14} className="text-amber-600" />
                  <span className="text-[12px] text-amber-700">Você já possui imóvel neste terreno.</span>
                </div>
              )}
              {!canAfford && !alreadyOwned && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">
                  <AlertCircle size={14} className="text-destructive" />
                  <span className="text-[12px] text-destructive">Saldo insuficiente. Falta {fmtBRL(totalCost - gameState.money)}.</span>
                </div>
              )}

              <Button
                className="w-full"
                disabled={!canAfford || alreadyOwned}
                onClick={handleBuild}
              >
                <Hammer size={15} className="mr-1" />
                Comprar Terreno e Iniciar Obra — {fmtBRL(totalCost)}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Aluguéis ────────────────────────────────────────────── */}
      {activeTab === 'alugueis' && (
        <div className="space-y-3">
          {rentedProps.length === 0 ? (
            <EmptyState
              icon="🔑"
              title="Nenhum imóvel alugado"
              subtitle="Alugar seus imóveis gera renda passiva constante."
              action="Ver Meus Imóveis"
              onAction={() => setActiveTab('meus')}
            />
          ) : (
            <>
              {/* Summary */}
              <div className="ios-surface p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Resumo de Aluguéis
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <KpiBox label="Contratos ativos" value={String(rentedProps.length)} icon="📝" />
                  <KpiBox label="Receita mensal" value={fmtBRL(totalRentMonth)} icon="💵" />
                </div>
              </div>

              {rentedProps.map(prop => {
                const lastDay = prop.lastRentDay ?? prop.tenantSince ?? currentDay;
                const daysPassed = currentDay - lastDay;
                const pendingRent = Math.floor((prop.rentMonthly / 30) * daysPassed);
                return (
                  <div key={prop.instanceId} className="ios-surface p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{prop.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[13px] text-foreground truncate">{prop.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Inquilino: <span className="font-semibold text-foreground">{prop.tenantName}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[12px] font-bold text-green-600">{fmtBRL(prop.rentMonthly)}/mês</div>
                        <div className="text-[10px] text-muted-foreground">desde o Dia {prop.tenantSince}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-[11px] text-muted-foreground">
                          Pendente: <span className="font-semibold text-foreground">{fmtBRL(pendingRent)}</span>
                          {' '}({daysPassed} dia{daysPassed !== 1 ? 's' : ''})
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Total recebido: <span className="font-semibold text-green-600">{fmtBRL(prop.rentCollected)}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={pendingRent <= 0}
                        onClick={() => handleCollect(prop.instanceId)}
                      >
                        <DollarSign size={13} className="mr-1" />
                        Cobrar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────

function KpiBox({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-muted/40 rounded-xl px-3 py-2 text-center">
      <div className="text-lg leading-none">{icon}</div>
      <div className="text-[13px] font-bold text-foreground mt-0.5 tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground leading-none">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-xl px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground leading-none">{label}</div>
      <div className="text-[12px] font-semibold text-foreground mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <span className="font-bold text-[14px] text-foreground">{title}</span>
    </div>
  );
}

function EmptyState({
  icon, title, subtitle, action, onAction,
}: {
  icon: string; title: string; subtitle: string; action: string; onAction: () => void;
}) {
  return (
    <div className="ios-surface p-8 flex flex-col items-center text-center gap-3">
      <div className="text-4xl">{icon}</div>
      <div>
        <div className="font-bold text-[15px] text-foreground">{title}</div>
        <div className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</div>
      </div>
      <Button size="sm" onClick={onAction}>{action}</Button>
    </div>
  );
}
