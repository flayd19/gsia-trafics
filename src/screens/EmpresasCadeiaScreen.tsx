// =====================================================================
// EmpresasCadeiaScreen.tsx — Lista de empresas + navegação p/ detalhe
// Doc 08 — cards compactos, status visual, alerta estoque
// =====================================================================

import { useState } from 'react';
import { Plus, Building2, X, ChevronRight } from 'lucide-react';
import type { UseCadeiaReturn } from '@/hooks/useCadeia';
import type { Company, CompanyTypeId, CompanySize, RegionId } from '@/types/cadeia';
import { COMPANY_TYPES, REGIONS, getCompanyType, getSizeVariant } from '@/data/cadeia';
import { CompanyDetailScreen } from '@/screens/empresa/CompanyDetailScreen';

interface Props {
  cadeia: UseCadeiaReturn;
}

function fmt(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toFixed(0)}`;
}

const SIZE_NAMES: Record<CompanySize, string> = {
  pequena: 'Pequena',
  media:   'Média',
  grande:  'Grande',
};

// ── Indicador de saúde financeira da empresa ──────────────────────────
function statusDot(company: Company, todayPL: number): string {
  if (company.status === 'paused') return 'bg-yellow-400';
  if (company.status === 'closed') return 'bg-slate-500';
  if (todayPL > 0) return 'bg-emerald-400';
  if (todayPL < 0) return 'bg-red-400';
  return 'bg-amber-400';
}

// ── Card de empresa compacto ──────────────────────────────────────────
function CompanyCard({
  company,
  cadeia,
  onClick,
}: {
  company: Company;
  cadeia:  UseCadeiaReturn;
  onClick: () => void;
}) {
  const def    = getCompanyType(company.typeId);
  const region = REGIONS.find((r) => r.id === company.regionId);

  const today  = new Date().toDateString();
  const todayPL = cadeia.state.transactions
    .filter((t) => t.companyId === company.id && new Date(t.occurredAt).toDateString() === today)
    .reduce((acc, t) => acc + t.amount, 0);

  const dot = statusDot(company, todayPL);

  const hasProduction = company.activeProductions.length > 0;
  const prod          = company.activeProductions[0];
  const pct           = prod
    ? Math.min(100, Math.round(((Date.now() - prod.startedAt) / (prod.completesAt - prod.startedAt)) * 100))
    : 0;
  const minsLeft = prod ? Math.max(0, Math.ceil((prod.completesAt - Date.now()) / 60_000)) : 0;

  const noStock    = company.inventory.length === 0 || company.inventory.every((i) => i.quantity === 0);
  const lowCapital = company.capital < 500;

  return (
    <button
      className="w-full ios-card p-4 text-left active:scale-[0.98] transition-transform"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {/* Ícone */}
        <span className="text-2xl shrink-0">{def.icon}</span>

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {/* Status dot */}
            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
            <p className="font-semibold text-sm truncate">{company.name}</p>
            {/* Alertas */}
            {(noStock || lowCapital) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 shrink-0">
                ⚠️
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground truncate">
            {def.name} • {region?.name ?? company.regionId} • {SIZE_NAMES[company.size]}
          </p>

          <div className="flex items-center gap-3 mt-1 text-xs">
            <span className="text-slate-400">Caixa: {fmt(company.capital)}</span>
            {todayPL !== 0 && (
              <span className={todayPL > 0 ? 'text-emerald-400' : 'text-red-400'}>
                {todayPL > 0 ? '+' : ''}{fmt(todayPL)} hoje
              </span>
            )}
          </div>

          {/* Alertas textuais */}
          {noStock && (
            <p className="text-[11px] text-amber-400 mt-0.5">⚠️ Estoque vazio</p>
          )}
          {lowCapital && !noStock && (
            <p className="text-[11px] text-red-400 mt-0.5">⚠️ Caixa baixo</p>
          )}
        </div>

        {/* Seta */}
        <ChevronRight size={16} className="text-muted-foreground shrink-0" />
      </div>

      {/* Barra de produção */}
      {hasProduction && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>⚙️ Produzindo… {minsLeft}min</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-background/60 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

// ── Modal de criação de empresa (2 etapas) ────────────────────────────
function CreateCompanyModal({
  cadeia,
  onClose,
}: {
  cadeia:  UseCadeiaReturn;
  onClose: () => void;
}) {
  const [step, setStep]               = useState<1 | 2>(1);
  const [activeCategory, setActiveCategory] = useState<string>('extracao');
  const [selectedType, setSelectedType]     = useState<CompanyTypeId | null>(null);
  const [selectedSize, setSelectedSize]     = useState<CompanySize>('pequena');
  const [selectedRegion, setSelectedRegion] = useState<RegionId>('sudeste');
  const [companyName, setCompanyName]       = useState('');
  const [error, setError]                   = useState('');

  const categories = [
    { id: 'extracao',  label: '⛏️ Extração'  },
    { id: 'industria', label: '🏭 Indústria'  },
    { id: 'logistica', label: '🚚 Logística'  },
    { id: 'varejo',    label: '🛒 Varejo'     },
  ];
  const visibleTypes = COMPANY_TYPES.filter((t) => t.category === activeCategory);

  function selectType(typeId: CompanyTypeId) {
    setSelectedType(typeId);
    setCompanyName(getCompanyType(typeId).name);
    setError('');
  }

  function goToStep2() {
    if (!selectedType) { setError('Selecione um tipo de empresa.'); return; }
    setStep(2);
    setError('');
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

  const def       = selectedType ? getCompanyType(selectedType) : null;
  const variant   = selectedType ? getSizeVariant(selectedType, selectedSize) : null;
  const canAfford = variant ? cadeia.state.playerCapital >= variant.baseCost : false;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg bg-[hsl(228_30%_11%)] rounded-t-3xl flex flex-col"
        style={{ height: '92dvh' }}
      >
        {/* Cabeçalho */}
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
          <div className="flex gap-1.5 mt-3">
            <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-border'}`} />
            <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-border/40'}`} />
          </div>
        </div>

        {/* Área scrollável */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5">
          {step === 1 && (
            <>
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
              <div className="flex flex-col gap-2 pb-4">
                {visibleTypes.map((t) => {
                  const minCost   = t.sizes[0]!.baseCost;
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
              {/* Tamanho */}
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Tamanho</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['pequena', 'media', 'grande'] as CompanySize[]).map((size) => {
                    const sv     = getSizeVariant(selectedType, size);
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

              {/* Resumo */}
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

        {/* Rodapé fixo */}
        <div
          className="shrink-0 px-5 pt-3 pb-5 border-t border-border/20 bg-[hsl(228_30%_11%)]"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          {error && <p className="text-xs text-red-400 mb-2 text-center">{error}</p>}

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
                : '❌ Capital insuficiente'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tela principal ────────────────────────────────────────────────────
export function EmpresasCadeiaScreen({ cadeia }: Props) {
  const [showCreate, setShowCreate]           = useState(false);
  const [filter, setFilter]                   = useState<'todas' | 'ativas' | 'pausadas'>('todas');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const filteredCompanies = cadeia.state.companies.filter((c) => {
    if (c.status === 'closed') return false;
    if (filter === 'ativas')   return c.status === 'active';
    if (filter === 'pausadas') return c.status === 'paused';
    return true;
  });

  // ── Tela de detalhe (full-screen overlay dentro do módulo)
  if (selectedCompanyId) {
    const company = cadeia.state.companies.find((c) => c.id === selectedCompanyId);
    if (company) {
      return (
        <CompanyDetailScreen
          company={company}
          cadeia={cadeia}
          onBack={() => setSelectedCompanyId(null)}
        />
      );
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      {/* Filtros + botão nova */}
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

      {/* Estado vazio */}
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
            <CompanyCard
              key={company.id}
              company={company}
              cadeia={cadeia}
              onClick={() => setSelectedCompanyId(company.id)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCompanyModal cadeia={cadeia} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
