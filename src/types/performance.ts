// =====================================================================
// Performance Types — Sistema de Desempenho + Tunagem + Rachas
// =====================================================================

export type TractionType = 'FWD' | 'RWD' | 'AWD';

export type TuneType =
  // ── Motor ──────────────────────────────────────────────────────
  | 'engine'           // Kit motor completo
  | 'turbo'            // Turbo/turbina upgradada
  | 'intercooler'      // Intercooler esportivo (só eficiente c/ turbo)
  | 'exhaust'          // Escape esportivo
  | 'injection'        // Injeção direta/mapeamento
  // ── Transmissão ────────────────────────────────────────────────
  | 'ecu'              // Reprogramação ECU
  | 'transmission'     // Câmbio sequencial/sport
  | 'clutch'           // Embreagem esportiva
  // ── Chassi / Suspensão ─────────────────────────────────────────
  | 'suspension'       // Kit suspensão sport
  | 'sway_bar'         // Barra estabilizadora
  | 'differential'     // Diferencial LSD
  | 'geometry'         // Alinhamento/geometria racing
  // ── Aerodinâmica ───────────────────────────────────────────────
  | 'aerodynamics'     // Kit aerodinâmico completo
  | 'wing'             // Aerofólio traseiro
  | 'diffuser'         // Difusor dianteiro/traseiro
  // ── Pneus & Rodas ──────────────────────────────────────────────
  | 'tires'            // Pneus esportivos
  | 'light_rims'       // Aros leves forjados
  // ── Redução de peso ────────────────────────────────────────────
  | 'weight_reduction' // Remoção de peso morto
  | 'carbon_parts';    // Peças em fibra de carbono

export interface PerformanceStats {
  topSpeed:     number; // 0-100
  acceleration: number; // 0-100 (maior = mais rápido)
  power:        number; // 0-100
  torque:       number; // 0-100
  weight:       number; // 0-100 (interno: maior = mais pesado = penalidade)
  aerodynamics: number; // 0-100
  stability:    number; // 0-100
  grip:         number; // 0-100
  gearShift:    number; // 0-100
  traction:     TractionType;
  // dados brutos internos (não mostrados ao jogador)
  _hp:           number;
  _torqueNm:     number;
  _weightKg:     number;
  _0to100:       number;
  _topSpeedKmh:  number;
  _hasTurbo:     boolean;
  _engineType:   string;
  igp:           number; // Índice Geral de Performance 0-100
}

export interface TuneUpgrade {
  type:      TuneType;
  level:     number; // 1-5
  appliedAt: number;
}

// ── Participante de corrida multiplayer ──────────────────────────
export interface RaceParticipant {
  userId:   string;
  name:     string;
  carName:  string;
  carIcon:  string;
  igp:      number;
  position: number; // 1-4
  payout:   number;
}

export interface RaceRecord {
  id:           string;
  // v1 legacy — em corridas multiplayer, opponentName = "X jogadores"
  opponentName: string;
  opponentCar:  string;
  myIgp:        number;
  opponentIgp:  number;
  bet:          number;
  won:          boolean;
  payout:       number;
  createdAt:    string;
  // v2 multiplayer
  participants?: RaceParticipant[];
  myPosition?:   number; // 1-4
  totalPlayers?: number;
}

// ── Seções de tunagem para organização da UI ─────────────────────
export interface TuneSection {
  id:    string;
  label: string;
  icon:  string;
  types: TuneType[];
}

export const TUNE_SECTIONS: TuneSection[] = [
  {
    id: 'motor', label: 'Motor', icon: '🔥',
    types: ['engine', 'turbo', 'intercooler', 'exhaust', 'injection'],
  },
  {
    id: 'transmissao', label: 'Transmissão', icon: '⚙️',
    types: ['ecu', 'transmission', 'clutch'],
  },
  {
    id: 'chassi', label: 'Chassi & Suspensão', icon: '🔧',
    types: ['suspension', 'sway_bar', 'differential', 'geometry'],
  },
  {
    id: 'aero', label: 'Aerodinâmica', icon: '💨',
    types: ['aerodynamics', 'wing', 'diffuser'],
  },
  {
    id: 'rodas', label: 'Pneus & Rodas', icon: '⚫',
    types: ['tires', 'light_rims'],
  },
  {
    id: 'peso', label: 'Redução de Peso', icon: '⚖️',
    types: ['weight_reduction', 'carbon_parts'],
  },
];

// ── Afeta quais stats (para mostrar na UI) ───────────────────────
export type StatKey = 'topSpeed' | 'acceleration' | 'power' | 'torque' | 'aerodynamics' | 'stability' | 'grip' | 'gearShift';

export const TUNE_AFFECTS: Record<TuneType, StatKey[]> = {
  engine:          ['power', 'torque'],
  turbo:           ['power', 'acceleration', 'torque'],
  intercooler:     ['power', 'torque'],
  exhaust:         ['power', 'gearShift'],
  injection:       ['power', 'torque'],
  ecu:             ['gearShift', 'torque'],
  transmission:    ['gearShift', 'acceleration'],
  clutch:          ['gearShift', 'acceleration'],
  suspension:      ['grip', 'stability'],
  sway_bar:        ['stability'],
  differential:    ['grip', 'stability'],
  geometry:        ['grip'],
  aerodynamics:    ['aerodynamics', 'topSpeed'],
  wing:            ['aerodynamics', 'stability'],
  diffuser:        ['aerodynamics', 'stability'],
  tires:           ['grip', 'stability'],
  light_rims:      ['grip', 'acceleration'],
  weight_reduction:['acceleration', 'topSpeed'],
  carbon_parts:    ['acceleration', 'topSpeed'],
};

// ── Metadados completos de cada upgrade ─────────────────────────
export const TUNE_META: Record<TuneType, {
  label:    string;
  icon:     string;
  desc:     string;
  baseCost: number;
  note?:    string; // nota especial exibida na UI
}> = {
  // Motor
  engine:          { label: 'Kit Motor',         icon: '🔩', desc: 'Componentes internos do motor',     baseCost:  8_000 },
  turbo:           { label: 'Turbina',            icon: '🌀', desc: 'Turbo de maior fluxo de ar',        baseCost: 14_000, note: '↑↑ em motor turbo' },
  intercooler:     { label: 'Intercooler',        icon: '❄️', desc: 'Resfriamento do ar comprimido',     baseCost:  9_000, note: 'Só eficiente com turbo' },
  exhaust:         { label: 'Escape Esportivo',   icon: '💥', desc: 'Reduz contrapressão dos gases',     baseCost:  6_500 },
  injection:       { label: 'Injeção Direta',     icon: '⛽', desc: 'Mapeamento e injeção otimizados',   baseCost: 11_000 },
  // Transmissão
  ecu:             { label: 'Reprog. ECU',        icon: '🖥️', desc: 'Remapa curvas de torque e câmbio',  baseCost:  7_000 },
  transmission:    { label: 'Câmbio Sport',       icon: '🔄', desc: 'Câmbio sequencial ou short-shift',  baseCost: 10_000 },
  clutch:          { label: 'Embreagem Sport',    icon: '🏁', desc: 'Embreagem de alta performance',     baseCost:  8_500 },
  // Chassi
  suspension:      { label: 'Suspensão Sport',    icon: '🔧', desc: 'Molas e amortecedores esportivos',  baseCost:  9_000 },
  sway_bar:        { label: 'Barra Estab.',       icon: '📐', desc: 'Reduz rolagem em curvas',           baseCost:  5_500 },
  differential:    { label: 'Diferencial LSD',    icon: '⚡', desc: 'Melhora tração em curvas',          baseCost: 13_000 },
  geometry:        { label: 'Geometria Racing',   icon: '📏', desc: 'Camber, caster e convergência',     baseCost:  4_500 },
  // Aero
  aerodynamics:    { label: 'Kit Aerodinâmico',   icon: '🏎️', desc: 'Conjunto completo de aerofólios',   baseCost: 12_000 },
  wing:            { label: 'Aerofólio',          icon: '🪶', desc: 'Downforce traseiro ajustável',      baseCost:  8_000 },
  diffuser:        { label: 'Difusor',            icon: '🔀', desc: 'Difusor dianteiro e traseiro',      baseCost:  9_500 },
  // Pneus
  tires:           { label: 'Pneus Esportivos',   icon: '⚫', desc: 'Composição de alta aderência',      baseCost:  5_000 },
  light_rims:      { label: 'Aros Leves',         icon: '🔘', desc: 'Aros forjados reduzem massa',       baseCost:  7_500 },
  // Peso
  weight_reduction:{ label: 'Redução de Peso',    icon: '⚖️', desc: 'Remove componentes desnecessários', baseCost: 10_000, note: '↑↑ em carro pesado' },
  carbon_parts:    { label: 'Peças em Carbono',   icon: '🫙', desc: 'Capô, portas e teto em fibra',      baseCost: 16_000 },
};
