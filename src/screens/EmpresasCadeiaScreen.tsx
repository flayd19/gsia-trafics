// =====================================================================
// EmpresasCadeiaScreen.tsx — Gerenciar empresas no jogo Cadeia
// Listar, criar, configurar, retirar dividendo
// =====================================================================

import { useState } from 'react';
import { Plus, Building2, X, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import type { Company, CompanyTypeId, CompanySize, RegionId } from '@/types/cadeia';
import { COMPANY_TYPES, REGIONS, getCompanyType, getRecipesForCompany, getSizeVariant } from '@/data/cadeia';
import { getInventoryQty } from '@/lib/cadeiaEngine';

interface Props {
  cadeia: UseCadeiaReturn;
}

function fmt(v: number, decimals = 0): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toFixed(decimals)}`;
}

const SIZE_LABELS: Record<CompanySize, string> = {
  pequena: 'P',
  media: 'M',
  grande: 'G',
};

const SIZE_NAMES: Record<CompanySize, string> = {
  pequena: 'Pequena',
  media: 'Média',
  grande: 'Grande',
};

// ── Componente de card de empresa ─────────────────────────────────────
function CompanyCard({ company, cadeia }: { company: Company; cadeia: UseCadeiaReturn }) {
  const [expanded, setExpanded] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [depositAmt, setDepositAmt] = useState('');

  const def = getCompanyType(company.typeId);
  const recipes = getRecipesForCompany(company.typeId, company.size);
  const hasMultipleRecipes = recipes.length > 1;
  const hasProduction = company.activeProductions.length > 0;
  const minsLeft = hasProduction
    ? Math.max(0, Math.ceil((company.activeProductions[0]!.completesAt - Date.now()) / 60_000))
    : null;

  const productionPct = hasProduction
    ? Math.min(
        100,
        Math.round(
          ((Date.now() - company.activeProductions[0]!.startedAt) /
            (company.activeProductions[0]!.completesAt - company.activeProductions[0]!.startedAt)) *
            100,
        ),
      )
    : 0;

  function handleWithdraw() {
    const amt = parseFloat(withdrawAmt);
    if (isNaN(amt) || amt <= 0) return;
    const r = cadeia.withdrawFromCompany(company.id, amt);
    if (r.ok) setWithdrawAmt('');
  }

  function handleDeposit() {
    const amt = parseFloat(depositAmt);
    if (isNaN(amt) || amt <= 0) return;
    const r = cadeia.depositToCompany(company.id, amt);
    if (r.ok) setDepositAmt('');
  }

  const sizeVariant = getSizeVariant(company.typeId, company.size);

  return (
    <div className="ios-card overflow-hidden">
      {/* Cabeçalho do card */}
      <button
        className="w-full p-4 flex items-center gap-3 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-2xl">{def.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm truncate">{company.name}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
              {SIZE_LABELS[company.size]}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                company.status === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : company.status === 'paused'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {company.status === 'active' ? 'Ativa' : company.status === 'paused' ? 'Pausada' : 'Fechada'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {def.name} • {REGIONS.find((r) => r.id === company.regionId)?.name} • {fmt(company.capital)}
          </p>
        </div>
        {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>

      {/* Barra de progresso de produção */}
      {hasProduction && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>⚙️ Produzindo… {minsLeft}min restante</span>
            <span>{productionPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-background/60 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000"
              style={{ width: `${productionPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Painel expandido */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/30 pt-3 flex flex-col gap-4">
          {/* Info do tamanho */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-background/30 rounded-xl p-3">
            <div>
              <span className="text-muted-foreground">Capacidade:</span>
              <span className="ml-1 font-medium">
                {sizeVariant.storageCapacity > 0 ? `${sizeVariant.storageCapacity.toLocaleString('pt-BR')} un` : '∞ (logística)'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Custo/dia:</span>
              <span className="ml-1 font-medium text-red-400">
                {fmt(sizeVariant.operationalCostPerDay)}
              </span>
            </div>
          </div>

          {/* Inventário */}
          {company.inventory.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">📦 Estoque</p>
              <div className="flex flex-wrap gap-2">
                {company.inventory.map((item) => (
                  <div key={item.productId} className="flex items-center gap-1 bg-background/40 px-2 py-1 rounded-lg text-xs">
                    <span>{item.productId}</span>
                    <span className="text-muted-foreground">×</span>
                    <span className="font-bold">{item.quantity.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seletor de receita (siderúrgica tem 2 conjuntos) */}
          {hasMultipleRecipes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">⚙️ Receita ativa</p>
              <div className="flex flex-col gap-1.5">
                {recipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors ${
                      (company.config.selectedRecipeId ?? recipes[0]?.id) === recipe.id
                        ? 'bg-primary/20 border border-primary/50 text-primary'
                        : 'bg-background/40 border border-transparent text-muted-foreground'
                    }`}
                    onClick={() => cadeia.setSelectedRecipe(company.id, recipe.id)}
                  >
                    <span className="font-medium">{recipe.name}</span>
                    <span className="text-[10px]">
                      {recipe.inputs.map(i => `${i.quantity} ${i.productId}`).join(', ') || 'sem insumo'}
                      {' → '}
                      {recipe.outputs.map(o => `${o.quantity} ${o.productId}`).join(', ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Automação toggles */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">⚙️ Automação</p>
            <div className="flex flex-col gap-1.5">
              {[
                { key: 'autoProduction', label: 'Auto-produção' },
                { key: 'autoSell', label: 'Auto-venda' },
                { key: 'autoBuy', label: 'Auto-compra' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs">{label}</span>
                  <button
                    className={`transition-colors ${
                      (company.config as Record<string, unknown>)[key] ? 'text-primary' : 'text-muted-foreground'
                    }`}
                    onClick={() =>
                      cadeia.updateCompanyConfig(company.id, {
                        [key]: !(company.config as Record<string, unknown>)[key],
                      } as Partial<Company['config']>)
                    }
                  >
                    {(company.config as Record<string, unknown>)[key] ? (
                      <ToggleRight size={22} />
                    ) : (
                      <ToggleLeft size={22} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Retirar / Depositar capital */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Retirar dividendo</p>
              <div className="flex gap-1">
                <input
                  type="number"
                  className="flex-1 bg-background/60 border border-border/40 rounded-lg px-2 py-1.5 text-xs min-w-0"
                  placeholder="R$ valor"
                  value={withdrawAmt}
                  onChange={(e) => setWithdrawAmt(e.target.value)}
                />
                <button className="btn-gaming px-2 py-1.5 text-xs" onClick={handleWithdraw}>
                  <ArrowUpToLine size={14} />
                </button>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Depositar capital</p>
              <div className="flex gap-1">
                <input
                  type="number"
                  className="flex-1 bg-background/60 border border-border/40 rounded-lg px-2 py-1.5 text-xs min-w-0"
                  placeholder="R$ valor"
                  value={depositAmt}
                  onChange={(e) => setDepositAmt(e.target.value)}
                />
                <button className="btn-gaming px-2 py-1.5 text-xs" onClick={handleDeposit}>
                  <ArrowDownToLine size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            {company.status === 'active' ? (
              <button
                className="flex-1 py-2 rounded-xl bg-yellow-500/20 text-yellow-400 text-xs font-medium"
                onClick={() => cadeia.pauseCompany(company.id)}
              >
                Pausar
              </button>
            ) : company.status === 'paused' ? (
              <button
                className="flex-1 py-2 rounded-xl bg-green-500/20 text-green-400 text-xs font-medium"
                onClick={() => cadeia.resumeCompany(company.id)}
              >
                Retomar
              </button>
            ) : null}
            {company.status !== 'closed' && (
              <button
                className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-400 text-xs font-medium"
                onClick={() => cadeia.closeCompany(company.id)}
              >
                Fechar empresa
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal de criação de empresa (2 etapas) ────────────────────────────
//
// Estrutura: modal ocupa h-[92dvh], split em:
//   - cabeçalho fixo (shrink-0)
//   - área scrollável central (flex-1 overflow-y-auto)
//   - rodapé fixo com botão de ação (shrink-0) — SEMPRE visível
//
function CreateCompanyModal({
  cadeia,
  onClose,
}: {
  cadeia: UseCadeiaReturn;
  onClose: () => void;
}) {
  // Etapa 1: escolher tipo | Etapa 2: escolher tamanho + nome + região
  const [step, setStep] = useState<1 | 2>(1);
  const [activeCategory, setActiveCategory] = useState<string>('extracao');
  const [selectedType, setSelectedType] = useState<CompanyTypeId | null>(null);
  const [selectedSize, setSelectedSize] = useState<CompanySize>('pequena');
  const [selectedRegion, setSelectedRegion] = useState<RegionId>('sudeste');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');

  const categories = [
    { id: 'extracao',  label: '⛏️ Extração' },
    { id: 'industria', label: '🏭 Indústria' },
    { id: 'logistica', label: '🚚 Logística' },
    { id: 'varejo',    label: '🛒 Varejo' },
  ];
  const visibleTypes = COMPANY_TYPES.filter((t) => t.category === activeCategory);

  function selectType(typeId: CompanyTypeId) {
    setSelectedType(typeId);
    setCompanyName(getCompanyType(typeId).name);
    setError('');
  }

  function goToStep2() {
    if (!selectedType) { setError('Selecione um tipo de empresa.'); return; }
    setError('');
    setStep(2);
  }

  function handleCreate() {
    if (!selectedType) { setError('Selecione um tipo de empresa.'); return; }
    const result = cadeia.buyCompany(selectedType, selectedSize, selectedRegion, companyName);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error ?? 'Erro desconhecido.');
    }
  }

  const def     = selectedType ? getCompanyType(selectedType) : null;
  const variant = selectedType ? getSizeVariant(selectedType, selectedSize) : null;
  const canAfford = variant ? cadeia.state.playerCapital >= variant.baseCost : false;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      {/* Container: altura fixa, flex-col para empurrar rodapé para baixo */}
      <div
        className="w-full max-w-lg bg-[hsl(228_30%_11%)] rounded-t-3xl flex flex-col"
        style={{ height: '92dvh' }}
      >
        {/* ── Cabeçalho fixo ─────────────────────────────────────── */}
        <div className="shrink-0 px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step === 2 && (
                <button
                  onClick={() => { setStep(1); setError(''); }}
                  className="p-2 rounded-full bg-background/40 text-muted-foreground"
                >
                  ‹
                </button>
              )}
              <h2 className="font-bold text-lg">
                {step === 1 ? 'Escolha o tipo' : `${def?.icon} ${def?.name}`}
              </h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-background/40">
              <X size={18} />
            </button>
          </div>

          {/* Indicador de etapa */}
          <div className="flex gap-1.5 mt-3">
            <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-border'}`} />
            <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-border/40'}`} />
          </div>
        </div>

        {/* ── Área scrollável ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5">

          {step === 1 && (
            <>
              {/* Tabs de categoria — scroll horizontal */}
              <div className="flex gap-2 pb-3 overflow-x-auto no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`shrink-0 px-3 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      activeCategory === cat.id
                        ? 'bg-primary text-background'
                        : 'bg-background/40 text-muted-foreground'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Lista de tipos (compacta, touch targets ≥44px) */}
              <div className="flex flex-col gap-2 pb-4">
                {visibleTypes.map((t) => {
                  const minCost = t.sizes[0]!.baseCost;
                  const isSelected = selectedType === t.id;
                  return (
                    <button
                      key={t.id}
                      className={`flex items-center gap-3 px-4 rounded-2xl text-left transition-colors ${
                        isSelected
                          ? 'bg-primary/20 border border-primary/50'
                          : 'bg-background/30 border border-transparent active:bg-background/50'
                      }`}
                      style={{ minHeight: 60 }}
                      onClick={() => selectType(t.id)}
                    >
                      <span className="text-2xl shrink-0">{t.icon}</span>
                      <div className="flex-1 min-w-0 py-3">
                        <p className="text-sm font-semibold leading-tight">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.description}</p>
                      </div>
                      <div className="shrink-0 text-right py-3">
                        <p className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground/70'}`}>
                          {minCost >= 1_000 ? `R$${(minCost / 1_000).toFixed(0)}k` : `R$${minCost}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">nível {t.minLevel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && selectedType && (
            <div className="flex flex-col gap-5 pb-6 pt-1">

              {/* Tamanho — 3 cards grandes (touch targets ≥64px) */}
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Tamanho</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['pequena', 'media', 'grande'] as CompanySize[]).map((size) => {
                    const sv = getSizeVariant(selectedType, size);
                    const active = selectedSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`flex flex-col items-center justify-center rounded-2xl py-4 transition-colors ${
                          active
                            ? 'bg-primary/20 border-2 border-primary'
                            : 'bg-background/30 border-2 border-transparent active:bg-background/50'
                        }`}
                      >
                        <span className={`text-sm font-bold ${active ? 'text-primary' : ''}`}>
                          {SIZE_NAMES[size]}
                        </span>
                        <span className={`text-base font-extrabold mt-1 ${active ? 'text-primary' : 'text-foreground'}`}>
                          {sv.baseCost >= 1_000_000
                            ? `R$${(sv.baseCost / 1_000_000).toFixed(1)}M`
                            : `R$${(sv.baseCost / 1_000).toFixed(0)}k`}
                        </span>
                        <span className="text-[10px] text-red-400 mt-1">
                          -{(sv.operationalCostPerDay / 1_000).toFixed(1)}k/dia
                        </span>
                        {sv.storageCapacity > 0 && (
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {sv.storageCapacity >= 1_000
                              ? `${(sv.storageCapacity / 1_000).toFixed(0)}k cap`
                              : `${sv.storageCapacity} cap`}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nome */}
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Nome</p>
                <input
                  className="w-full bg-background/50 border border-border/50 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Nome da empresa..."
                  autoComplete="off"
                />
              </div>

              {/* Região */}
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Região</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {REGIONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRegion(r.id)}
                      className={`flex flex-col items-center py-3 rounded-2xl text-[11px] transition-colors ${
                        selectedRegion === r.id
                          ? 'bg-primary/20 border-2 border-primary text-primary'
                          : 'bg-background/30 border-2 border-transparent active:bg-background/50'
                      }`}
                    >
                      <span className="text-lg">{r.icon}</span>
                      <span className="mt-1 text-center leading-tight">{r.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resumo inline */}
              {variant && (
                <div className="rounded-2xl bg-background/30 px-4 py-3 text-xs flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Custo de abertura</span>
                    <span className="font-bold text-red-400">-{fmt(variant.baseCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Custo diário</span>
                    <span className="font-bold text-orange-400">-{fmt(variant.operationalCostPerDay)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border/20 pt-1.5 mt-0.5">
                    <span className="text-muted-foreground">Saldo após</span>
                    <span className={`font-bold ${!canAfford ? 'text-red-400' : 'text-green-400'}`}>
                      {fmt(cadeia.state.playerCapital - variant.baseCost)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Rodapé fixo — SEMPRE visível ───────────────────────── */}
        <div
          className="shrink-0 px-5 pt-3 pb-5 border-t border-border/20 bg-[hsl(228_30%_11%)]"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          {error && (
            <p className="text-xs text-red-400 mb-2 text-center">{error}</p>
          )}

          {step === 1 ? (
            <button
              className={`w-full py-4 rounded-2xl text-sm font-bold transition-colors ${
                selectedType
                  ? 'btn-gaming'
                  : 'bg-background/30 text-muted-foreground border border-border/30'
              }`}
              onClick={goToStep2}
            >
              {selectedType ? `Continuar com ${getCompanyType(selectedType).name} →` : 'Selecione um tipo'}
            </button>
          ) : (
            <button
              className={`w-full py-4 rounded-2xl text-sm font-bold transition-colors ${
                canAfford
                  ? 'btn-gaming'
                  : 'bg-red-900/40 text-red-400 border border-red-500/30'
              }`}
              onClick={handleCreate}
            >
              {canAfford
                ? `✅ Abrir empresa — ${variant ? fmt(variant.baseCost) : ''}`
                : `❌ Capital insuficiente`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tela principal ────────────────────────────────────────────────────
export function EmpresasCadeiaScreen({ cadeia }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'todas' | 'ativas' | 'pausadas'>('todas');

  const filteredCompanies = cadeia.state.companies.filter((c) => {
    if (c.status === 'closed') return false;
    if (filter === 'ativas') return c.status === 'active';
    if (filter === 'pausadas') return c.status === 'paused';
    return true;
  });

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      {/* Filtros */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['todas', 'ativas', 'pausadas'] as const).map((f) => (
            <button
              key={f}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors capitalize ${
                filter === f
                  ? 'bg-primary text-background font-bold'
                  : 'bg-background/40 text-muted-foreground'
              }`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          className="btn-gaming px-3 py-1.5 text-xs flex items-center gap-1"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={14} /> Nova
        </button>
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="ios-card p-8 text-center">
          <Building2 size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            {filter === 'todas' ? 'Nenhuma empresa ainda.' : `Nenhuma empresa ${filter}.`}
          </p>
          {filter === 'todas' && (
            <button className="btn-gaming px-4 py-2 text-sm" onClick={() => setShowCreate(true)}>
              Abrir primeira empresa
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredCompanies.map((company) => (
            <CompanyCard key={company.id} company={company} cadeia={cadeia} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCompanyModal cadeia={cadeia} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
