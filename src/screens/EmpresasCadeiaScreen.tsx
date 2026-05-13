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

// ── Modal de criação de empresa ───────────────────────────────────────
function CreateCompanyModal({
  cadeia,
  onClose,
}: {
  cadeia: UseCadeiaReturn;
  onClose: () => void;
}) {
  const [selectedType, setSelectedType] = useState<CompanyTypeId | null>(null);
  const [selectedSize, setSelectedSize] = useState<CompanySize>('pequena');
  const [selectedRegion, setSelectedRegion] = useState<RegionId>('sudeste');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');

  const groupedTypes = [
    { label: '⛏️ Extração', types: COMPANY_TYPES.filter((t) => t.category === 'extracao') },
    { label: '🏭 Indústria', types: COMPANY_TYPES.filter((t) => t.category === 'industria') },
    { label: '🚚 Logística', types: COMPANY_TYPES.filter((t) => t.category === 'logistica') },
    { label: '🛒 Varejo', types: COMPANY_TYPES.filter((t) => t.category === 'varejo') },
  ];

  function handleCreate() {
    if (!selectedType) { setError('Selecione um tipo de empresa.'); return; }
    const result = cadeia.buyCompany(selectedType, selectedSize, selectedRegion, companyName);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error ?? 'Erro desconhecido.');
    }
  }

  const def = selectedType ? getCompanyType(selectedType) : null;
  const variant = selectedType ? getSizeVariant(selectedType, selectedSize) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[hsl(228_30%_12%)] rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Nova Empresa</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-background/40">
            <X size={18} />
          </button>
        </div>

        {/* Seleção de tipo */}
        <div className="flex flex-col gap-3 mb-4">
          {groupedTypes.map(({ label, types }) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground mb-2">{label}</p>
              <div className="flex flex-col gap-1.5">
                {types.map((t) => {
                  const minVariant = t.sizes[0]!;
                  return (
                    <button
                      key={t.id}
                      className={`flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                        selectedType === t.id
                          ? 'bg-primary/20 border border-primary/50'
                          : 'bg-background/40 border border-transparent'
                      }`}
                      onClick={() => { setSelectedType(t.id); setCompanyName(t.name); }}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-primary">
                          a partir de {minVariant.baseCost >= 1_000 ? `R$${(minVariant.baseCost / 1_000).toFixed(0)}k` : `R$${minVariant.baseCost}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground">nível {t.minLevel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Seleção de tamanho + nome + região */}
        {selectedType && def && (
          <>
            {/* Seletor de tamanho */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Tamanho</p>
              <div className="grid grid-cols-3 gap-2">
                {((['pequena', 'media', 'grande'] as CompanySize[])).map((size) => {
                  const sv = getSizeVariant(selectedType, size);
                  return (
                    <button
                      key={size}
                      className={`flex flex-col items-center p-3 rounded-xl text-center transition-colors ${
                        selectedSize === size
                          ? 'bg-primary/20 border border-primary/50 text-primary'
                          : 'bg-background/40 border border-transparent'
                      }`}
                      onClick={() => setSelectedSize(size)}
                    >
                      <span className="text-xs font-bold">{SIZE_NAMES[size]}</span>
                      <span className={`text-sm font-bold mt-1 ${selectedSize === size ? 'text-primary' : 'text-foreground'}`}>
                        {sv.baseCost >= 1_000 ? `R$${(sv.baseCost / 1_000).toFixed(0)}k` : `R$${sv.baseCost}`}
                      </span>
                      {sv.storageCapacity > 0 && (
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {sv.storageCapacity.toLocaleString('pt-BR')} cap
                        </span>
                      )}
                      <span className="text-[10px] text-red-400 mt-0.5">
                        -{(sv.operationalCostPerDay / 1_000).toFixed(1)}k/dia
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Nome da empresa</p>
              <input
                className="w-full bg-background/60 border border-border/40 rounded-xl px-3 py-2 text-sm"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nome personalizado..."
              />
            </div>

            {/* Região */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Região</p>
              <div className="grid grid-cols-5 gap-1">
                {REGIONS.map((r) => (
                  <button
                    key={r.id}
                    className={`flex flex-col items-center p-2 rounded-xl text-[11px] transition-colors ${
                      selectedRegion === r.id
                        ? 'bg-primary/20 border border-primary/50 text-primary'
                        : 'bg-background/40'
                    }`}
                    onClick={() => setSelectedRegion(r.id)}
                  >
                    <span className="text-base">{r.icon}</span>
                    <span className="mt-0.5 text-center leading-tight">{r.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Resumo de custo */}
            {variant && (
              <div className="bg-background/40 rounded-xl p-3 mb-4 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Custo de abertura</span>
                  <span className="font-bold text-red-400">-{fmt(variant.baseCost)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Custo operacional/dia</span>
                  <span className="font-bold text-orange-400">-{fmt(variant.operationalCostPerDay)}</span>
                </div>
                <div className="flex justify-between border-t border-border/30 pt-1 mt-1">
                  <span className="text-muted-foreground">Após compra</span>
                  <span className={`font-bold ${cadeia.state.playerCapital - variant.baseCost < 0 ? 'text-red-400' : ''}`}>
                    {fmt(cadeia.state.playerCapital - variant.baseCost)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <p className="text-xs text-red-400 mb-3 text-center">{error}</p>
        )}

        <button
          className="btn-gaming w-full py-3"
          onClick={handleCreate}
          disabled={!selectedType}
        >
          <Plus size={16} className="inline mr-1" /> Abrir empresa
        </button>
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
