// =====================================================================
// TIPOS DE REPARO — Oficina
// Preços base já incluem +10% conforme especificação.
// conditionGain mantido para compatibilidade; ganho real é RNG 5–28%.
// Cada reparo afeta APENAS o atributo indicado em `attribute`.
// =====================================================================
import type { RepairType } from '@/types/game';

export const REPAIR_TYPES: RepairType[] = [

  // ── SEMPRE DISPONÍVEL (sem diagnóstico) ─────────────────────────
  {
    id: 'lavagem_completa',
    name: 'Lavagem Completa',
    description: 'Higienização interna e externa, polimento e cera.',
    icon: '🫧',
    baseCost: 385,        // 350 × 1.10
    conditionGain: 5,
    durationSec: 20,
    attribute: 'body',
    isAlwaysAvailable: true,
  },

  // ── LATARIA (body) ───────────────────────────────────────────────
  {
    id: 'pneus_novos',
    name: 'Pneus Novos',
    description: 'Quatro pneus novos. Melhora segurança e aparência.',
    icon: '🔘',
    baseCost: 2_420,      // 2.200 × 1.10
    conditionGain: 15,
    durationSec: 45,
    attribute: 'body',
  },
  {
    id: 'funilaria_pintura',
    name: 'Funilaria & Pintura',
    description: 'Conserto de amassados, arranhões e retoque de pintura.',
    icon: '🎨',
    baseCost: 3_850,      // 3.500 × 1.10
    conditionGain: 20,
    durationSec: 60,
    attribute: 'body',
  },

  // ── MECÂNICA (mechanical) ────────────────────────────────────────
  {
    id: 'alinhamento_balanceamento',
    name: 'Alinhamento & Balanceamento',
    description: 'Corrige direção e vibração. Aumenta avaliação do carro.',
    icon: '⚙️',
    baseCost: 495,        // 450 × 1.10
    conditionGain: 8,
    durationSec: 25,
    attribute: 'mechanical',
  },
  {
    id: 'revisao_basica',
    name: 'Revisão Básica',
    description: 'Troca de óleo, filtros e fluidos.',
    icon: '🔧',
    baseCost: 880,        // 800 × 1.10
    conditionGain: 10,
    durationSec: 35,
    attribute: 'mechanical',
  },
  {
    id: 'pastilhas_freios',
    name: 'Freios Completos',
    description: 'Troca de pastilhas, discos e fluido de freio.',
    icon: '🛑',
    baseCost: 1_320,      // 1.200 × 1.10
    conditionGain: 12,
    durationSec: 40,
    attribute: 'mechanical',
  },
  {
    id: 'suspensao',
    name: 'Suspensão Completa',
    description: 'Troca de amortecedores, molas e bandejas.',
    icon: '🏎️',
    baseCost: 4_620,      // 4.200 × 1.10
    conditionGain: 18,
    durationSec: 70,
    attribute: 'mechanical',
  },
  {
    id: 'motor_revisado',
    name: 'Motor Revisado',
    description: 'Revisão completa do motor, correias e velas.',
    icon: '⚡',
    baseCost: 6_050,      // 5.500 × 1.10
    conditionGain: 25,
    durationSec: 90,
    attribute: 'mechanical',
  },
  {
    id: 'restauracao_completa',
    name: 'Restauração Completa',
    description: 'Reforma total: motor, lataria, interior e pintura.',
    icon: '✨',
    baseCost: 13_200,     // 12.000 × 1.10
    conditionGain: 45,
    durationSec: 180,
    attribute: 'mechanical',
  },

  // ── ELÉTRICA (electrical) ────────────────────────────────────────
  {
    id: 'revisao_eletrica',
    name: 'Revisão Elétrica',
    description: 'Diagnóstico e correção do sistema elétrico e bateria.',
    icon: '🔌',
    baseCost: 1_980,      // 1.800 × 1.10
    conditionGain: 12,
    durationSec: 50,
    attribute: 'electrical',
  },
  {
    id: 'troca_bateria',
    name: 'Troca de Bateria',
    description: 'Substituição da bateria e verificação do alternador.',
    icon: '🔋',
    baseCost: 1_210,      // 1.100 × 1.10
    conditionGain: 10,
    durationSec: 20,
    attribute: 'electrical',
  },
  {
    id: 'reparo_ar',
    name: 'Reparo do Ar-Condicionado',
    description: 'Recarga de gás, limpeza e revisão do sistema de A/C.',
    icon: '❄️',
    baseCost: 1_815,      // 1.650 × 1.10
    conditionGain: 12,
    durationSec: 40,
    attribute: 'electrical',
  },

  // ── INTERIOR (interior) ──────────────────────────────────────────
  {
    id: 'higienizacao_interior',
    name: 'Higienização do Interior',
    description: 'Limpeza profunda de bancos, tapetes e painel.',
    icon: '🧹',
    baseCost: 847,        // 770 × 1.10
    conditionGain: 8,
    durationSec: 25,
    attribute: 'interior',
  },
  {
    id: 'reparo_interior',
    name: 'Reforma do Interior',
    description: 'Restauração de bancos, revestimentos e acabamentos.',
    icon: '🪑',
    baseCost: 3_025,      // 2.750 × 1.10
    conditionGain: 18,
    durationSec: 55,
    attribute: 'interior',
  },
];
