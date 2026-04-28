// =====================================================================
// COMPRADORES DE CARROS (NPCs) — Aba Vendas
// =====================================================================
import type { CarBuyerNPC, BuyerPersonality, OwnedCar } from '@/types/game';
import { CAR_MODELS, conditionValueFactor } from '@/data/cars';

// Templates de compradores (são instanciados dinamicamente)
interface BuyerTemplate {
  name: string;
  avatar: string;
  personality: BuyerPersonality;
  targetCategories: string[];
  payRange: { min: number; max: number };
  hasTradeIn: boolean;
  patience: number; // segundos
  description: string;
}

export const BUYER_TEMPLATES: BuyerTemplate[] = [
  // ── RACIONAIS (pagam perto da FIPE, negociam pouco) ─────────────
  {
    name: 'Marcos Rodrigues',
    avatar: '👨‍💼',
    personality: 'racional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.80, max: 0.96 },
    hasTradeIn: false,
    patience: 70,
    description: 'Sabe o valor do carro. Paga justo.',
  },
  {
    name: 'Ana Paula Ferreira',
    avatar: '👩‍💼',
    personality: 'racional',
    targetCategories: ['popular'],
    payRange: { min: 0.75, max: 0.93 },
    hasTradeIn: false,
    patience: 65,
    description: 'Pesquisou bastante. Não paga mais que a tabela.',
  },
  {
    name: 'Roberto Cunha',
    avatar: '🧑‍💻',
    personality: 'racional',
    targetCategories: ['medio', 'suv'],
    payRange: { min: 0.82, max: 0.98 },
    hasTradeIn: false,
    patience: 75,
    description: 'Quer qualidade pelo preço certo.',
  },
  {
    name: 'Juliana Motta',
    avatar: '👩‍🔬',
    personality: 'racional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.78, max: 0.95 },
    hasTradeIn: true,
    patience: 80,
    description: 'Veio com o carro dela pra trocar.',
  },

  // ── EMOCIONAIS (podem pagar um pouco acima da FIPE se gostar) ───
  {
    name: 'Gabriel Sousa',
    avatar: '😄',
    personality: 'emocional',
    targetCategories: ['esportivo', 'suv'],
    payRange: { min: 0.84, max: 1.05 },
    hasTradeIn: false,
    patience: 55,
    description: 'Se apaixona rápido. Pode pagar um pouco acima.',
  },
  {
    name: 'Fernanda Lima',
    avatar: '😍',
    personality: 'emocional',
    targetCategories: ['popular', 'suv'],
    payRange: { min: 0.82, max: 1.03 },
    hasTradeIn: false,
    patience: 50,
    description: 'Quer o carro dos sonhos, preço não é prioridade.',
  },
  {
    name: 'Diego Alves',
    avatar: '🤩',
    personality: 'emocional',
    targetCategories: ['esportivo'],
    payRange: { min: 0.86, max: 1.05 },
    hasTradeIn: true,
    patience: 60,
    description: 'Louquinho por esportivos. Paga bem se for o certo.',
  },
  {
    name: 'Camila Torres',
    avatar: '💃',
    personality: 'emocional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.80, max: 1.02 },
    hasTradeIn: false,
    patience: 55,
    description: 'Gosta de carro bonito. Valoriza aparência.',
  },

  // ── PECHINCHEIROS (tentam pagar abaixo da FIPE sempre) ───────────
  {
    name: 'Dona Maria',
    avatar: '👵',
    personality: 'pechincha',
    targetCategories: ['popular'],
    payRange: { min: 0.55, max: 0.80 },
    hasTradeIn: false,
    patience: 90,
    description: 'Negocia até o último centavo. Nunca aceita de primeira.',
  },
  {
    name: 'Seu Zé das Aranhas',
    avatar: '🕷️',
    personality: 'pechincha',
    targetCategories: ['popular', 'pickup'],
    payRange: { min: 0.52, max: 0.78 },
    hasTradeIn: true,
    patience: 85,
    description: 'Mestre da pechincha. Vai oferecer o menos possível.',
  },
  {
    name: 'Claudinho Comprador',
    avatar: '🤑',
    personality: 'pechincha',
    targetCategories: ['popular', 'medio', 'suv'],
    payRange: { min: 0.56, max: 0.82 },
    hasTradeIn: false,
    patience: 80,
    description: 'Só compra se sentir que fez um bom negócio.',
  },
  {
    name: 'Vera Nogueira',
    avatar: '🧓',
    personality: 'pechincha',
    targetCategories: ['popular'],
    payRange: { min: 0.58, max: 0.80 },
    hasTradeIn: false,
    patience: 100,
    description: 'Tem todo o tempo do mundo e quer descontar ao máximo.',
  },

  // ── APRESSADOS (pagam rápido, sem muita briga) ──────────────────
  {
    name: 'Dr. Fábio Braga',
    avatar: '👨‍⚕️',
    personality: 'apressado',
    targetCategories: ['suv', 'medio'],
    payRange: { min: 0.83, max: 1.00 },
    hasTradeIn: false,
    patience: 35,
    description: 'Não tem tempo a perder. Fecha rápido.',
  },
  {
    name: 'Renata Corrêa',
    avatar: '👩‍⚕️',
    personality: 'apressado',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.80, max: 0.98 },
    hasTradeIn: false,
    patience: 30,
    description: 'Com pressa pra fechar. Aceita rápido.',
  },
  {
    name: 'Thiago Veloz',
    avatar: '🏃',
    personality: 'apressado',
    targetCategories: ['popular'],
    payRange: { min: 0.76, max: 0.96 },
    hasTradeIn: true,
    patience: 40,
    description: 'Quer resolver agora. Se não fechar logo, some.',
  },

  // ── CURIOSOS (indecisos, podem ou não comprar) ───────────────────
  {
    name: 'Paulo Wanderley',
    avatar: '🤔',
    personality: 'curioso',
    targetCategories: ['popular', 'medio', 'suv'],
    payRange: { min: 0.70, max: 0.95 },
    hasTradeIn: false,
    patience: 60,
    description: 'Ainda não sabe o que quer. Pode se convencer.',
  },
  {
    name: 'Lúcia Mendes',
    avatar: '🧐',
    personality: 'curioso',
    targetCategories: ['popular', 'eletrico'],
    payRange: { min: 0.74, max: 0.97 },
    hasTradeIn: false,
    patience: 65,
    description: 'Curiosa sobre carros elétricos e populares.',
  },
  {
    name: 'Heitor Peixoto',
    avatar: '😐',
    personality: 'curioso',
    targetCategories: ['pickup', 'suv'],
    payRange: { min: 0.72, max: 0.94 },
    hasTradeIn: true,
    patience: 55,
    description: 'Quer trocar o dele. Avalia opções.',
  },

  // ── GOIANÉSIA CREW — galera da cidade ────────────────────────────
  {
    name: 'Toin do Pastel',
    avatar: '🥟',
    personality: 'pechincha',
    targetCategories: ['popular'],
    payRange: { min: 0.50, max: 0.76 },
    hasTradeIn: false,
    patience: 95,
    description: 'Quando não tá fritando pastel, tá pechincando carro.',
  },
  {
    name: 'Catitu',
    avatar: '🐗',
    personality: 'emocional',
    targetCategories: ['pickup', 'popular'],
    payRange: { min: 0.80, max: 1.02 },
    hasTradeIn: true,
    patience: 50,
    description: 'Teimoso como um catitu. Quer o carro e ponto.',
  },
  {
    name: 'Vitinho Brasil',
    avatar: '🇧🇷',
    personality: 'emocional',
    targetCategories: ['esportivo', 'medio'],
    payRange: { min: 0.84, max: 1.06 },
    hasTradeIn: false,
    patience: 45,
    description: 'Patriota e apaixonado por carros. Paga bem se for bonito.',
  },
  {
    name: 'Rogerin do Peixe',
    avatar: '🐟',
    personality: 'pechincha',
    targetCategories: ['popular', 'pickup'],
    payRange: { min: 0.52, max: 0.79 },
    hasTradeIn: true,
    patience: 88,
    description: 'Negocia como se tivesse vendendo peixe na feira.',
  },
  {
    name: 'Valdeci Vito',
    avatar: '🚐',
    personality: 'racional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.78, max: 0.94 },
    hasTradeIn: false,
    patience: 70,
    description: 'Precisa de um carro pras entregas. Paga o justo.',
  },
  {
    name: 'Thierry Sertanejo',
    avatar: '🎸',
    personality: 'emocional',
    targetCategories: ['pickup', 'suv'],
    payRange: { min: 0.82, max: 1.04 },
    hasTradeIn: false,
    patience: 55,
    description: 'Vai buscar o carro pra ir pro rodeio. Lascou o gosto.',
  },
  {
    name: 'Tomas DJ',
    avatar: '🎧',
    personality: 'emocional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.80, max: 1.03 },
    hasTradeIn: false,
    patience: 48,
    description: 'Quer colocar o som paredão. Qualquer carro serve.',
  },
  {
    name: 'DJ Tubas',
    avatar: '📻',
    personality: 'apressado',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.82, max: 0.99 },
    hasTradeIn: false,
    patience: 30,
    description: 'Tem show hoje à noite. Precisa do carro agora.',
  },
  {
    name: 'Bruno Sombra Curta',
    avatar: '😎',
    personality: 'racional',
    targetCategories: ['popular', 'medio', 'suv'],
    payRange: { min: 0.76, max: 0.95 },
    hasTradeIn: false,
    patience: 68,
    description: 'Faz sombra curta em tudo. Não paga a mais.',
  },
  {
    name: 'Gui 062',
    avatar: '📍',
    personality: 'emocional',
    targetCategories: ['esportivo', 'medio'],
    payRange: { min: 0.85, max: 1.07 },
    hasTradeIn: false,
    patience: 52,
    description: 'Representando Goiás. Quer carro com pegada.',
  },
  {
    name: 'Nandin',
    avatar: '👦',
    personality: 'curioso',
    targetCategories: ['popular'],
    payRange: { min: 0.68, max: 0.92 },
    hasTradeIn: false,
    patience: 60,
    description: 'Primeiro carro da vida. Tá com medo de levar gato por lebre.',
  },
  {
    name: 'Fernandin Calhas',
    avatar: '🔧',
    personality: 'pechincha',
    targetCategories: ['popular', 'pickup'],
    payRange: { min: 0.54, max: 0.80 },
    hasTradeIn: true,
    patience: 82,
    description: 'Instala calhas e negocia carro do mesmo jeito: no detalhe.',
  },
  {
    name: 'Pedro Noiado',
    avatar: '👀',
    personality: 'curioso',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.70, max: 0.93 },
    hasTradeIn: false,
    patience: 58,
    description: 'Fica olhando o carro com desconfiança. Às vezes compra, às vezes vai embora.',
  },
  {
    name: 'Will Morgado',
    avatar: '🤠',
    personality: 'racional',
    targetCategories: ['pickup', 'suv'],
    payRange: { min: 0.80, max: 0.97 },
    hasTradeIn: true,
    patience: 73,
    description: 'Fazendeiro na veia. Sabe o que quer e o que vale.',
  },
  {
    name: 'Dieguin Revisa',
    avatar: '🔍',
    personality: 'racional',
    targetCategories: ['popular', 'medio', 'suv'],
    payRange: { min: 0.77, max: 0.96 },
    hasTradeIn: false,
    patience: 75,
    description: 'Pede pra revisar tudo antes. Se passar, fecha na hora.',
  },
  {
    name: 'Arapinha Silas',
    avatar: '🦜',
    personality: 'curioso',
    targetCategories: ['popular'],
    payRange: { min: 0.65, max: 0.90 },
    hasTradeIn: false,
    patience: 62,
    description: 'Fala muito, decide pouco. Mas quando decide, fecha.',
  },
  {
    name: 'Silas Dançarino',
    avatar: '💃',
    personality: 'emocional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.78, max: 1.01 },
    hasTradeIn: false,
    patience: 50,
    description: 'Gosta de dançar e de carro bom. Se curtir, paga e vai embora.',
  },
  {
    name: 'Baguega',
    avatar: '😴',
    personality: 'curioso',
    targetCategories: ['popular'],
    payRange: { min: 0.60, max: 0.88 },
    hasTradeIn: false,
    patience: 90,
    description: 'Sem pressa nenhuma. Aparece, olha, some, volta amanhã.',
  },
  {
    name: 'Sandro e Ronaldo',
    avatar: '👬',
    personality: 'racional',
    targetCategories: ['popular', 'medio', 'pickup'],
    payRange: { min: 0.79, max: 0.97 },
    hasTradeIn: false,
    patience: 65,
    description: 'Dupla que resolve junto. Um aprova o preço, o outro o carro.',
  },
  {
    name: 'Gustavo Lima',
    avatar: '🎤',
    personality: 'emocional',
    targetCategories: ['pickup', 'suv', 'esportivo'],
    payRange: { min: 0.88, max: 1.10 },
    hasTradeIn: false,
    patience: 40,
    description: 'Balada boa, carro bom. Se topou o carro, o preço nem discute.',
  },

  // ── TIPOS EXTRAS — mais variedade ────────────────────────────────
  {
    name: 'Zé Barrinha',
    avatar: '🥤',
    personality: 'pechincha',
    targetCategories: ['popular'],
    payRange: { min: 0.50, max: 0.75 },
    hasTradeIn: false,
    patience: 100,
    description: 'Gasta mais na barrinha do que no carro. Pechincha até o osso.',
  },
  {
    name: 'Marquinhos Tuning',
    avatar: '🔩',
    personality: 'emocional',
    targetCategories: ['popular', 'esportivo'],
    payRange: { min: 0.80, max: 1.05 },
    hasTradeIn: true,
    patience: 55,
    description: 'Já tem o kit do tuning separado. Precisa do carro pra montar.',
  },
  {
    name: 'Dona Conceição',
    avatar: '👒',
    personality: 'pechincha',
    targetCategories: ['popular'],
    payRange: { min: 0.55, max: 0.78 },
    hasTradeIn: false,
    patience: 95,
    description: 'Aposentada raiz. Negocia cada real com calma e precisão.',
  },
  {
    name: 'Serginho Rebaixado',
    avatar: '⬇️',
    personality: 'emocional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.82, max: 1.04 },
    hasTradeIn: true,
    patience: 48,
    description: 'Só compra se der pra rebaixar. Paga bem por carro com potential.',
  },
  {
    name: 'Kinha da Farmácia',
    avatar: '💊',
    personality: 'apressado',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.81, max: 0.99 },
    hasTradeIn: false,
    patience: 35,
    description: 'Plantão daqui a pouco. Resolve rápido ou não resolve.',
  },
  {
    name: 'Toninho Contabilidade',
    avatar: '📊',
    personality: 'racional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.75, max: 0.93 },
    hasTradeIn: false,
    patience: 78,
    description: 'Calculou o custo-benefício na planilha antes de vir.',
  },
  {
    name: 'Belinha Salão',
    avatar: '💇',
    personality: 'emocional',
    targetCategories: ['popular', 'suv'],
    payRange: { min: 0.80, max: 1.02 },
    hasTradeIn: false,
    patience: 52,
    description: 'Quer carro bonito por dentro. Interior impecável é prioridade.',
  },
  {
    name: 'Claudão Segurança',
    avatar: '💪',
    personality: 'racional',
    targetCategories: ['suv', 'pickup'],
    payRange: { min: 0.82, max: 0.98 },
    hasTradeIn: false,
    patience: 65,
    description: 'Precisa de carro grande pro trabalho. Paga o justo.',
  },
  {
    name: 'Nilton Chácara',
    avatar: '🌾',
    personality: 'pechincha',
    targetCategories: ['pickup', 'popular'],
    payRange: { min: 0.55, max: 0.82 },
    hasTradeIn: true,
    patience: 85,
    description: 'Veio da chácara com o carro velho pra trocar. Negocia muito.',
  },
  {
    name: 'Cris Lava-Jato',
    avatar: '🚿',
    personality: 'curioso',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.70, max: 0.94 },
    hasTradeIn: false,
    patience: 62,
    description: 'Olha o carro com olho de quem já lavou muita capota.',
  },
  {
    name: 'Dedé Mototaxista',
    avatar: '🏍️',
    personality: 'racional',
    targetCategories: ['popular'],
    payRange: { min: 0.72, max: 0.92 },
    hasTradeIn: false,
    patience: 70,
    description: 'Vai trocar a moto por carro. Orçamento apertado, critério alto.',
  },
  {
    name: 'Mainha da Roça',
    avatar: '👵',
    personality: 'emocional',
    targetCategories: ['popular'],
    payRange: { min: 0.74, max: 0.98 },
    hasTradeIn: false,
    patience: 58,
    description: 'Presente do filho. Ela quer e o filho paga. Emoção na veia.',
  },
  {
    name: 'Professor Raimundinho',
    avatar: '📚',
    personality: 'racional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.76, max: 0.95 },
    hasTradeIn: false,
    patience: 72,
    description: 'Pesquisou tabela FIPE antes de vir. Sabe o que vale.',
  },
  {
    name: 'Fresquinha Mecânica',
    avatar: '⚙️',
    personality: 'racional',
    targetCategories: ['popular', 'medio', 'classico'],
    payRange: { min: 0.74, max: 0.96 },
    hasTradeIn: true,
    patience: 80,
    description: 'Mão boa na mecânica. Avalia mais o motor do que a lataria.',
  },
  {
    name: 'Pitoco Bombeiro',
    avatar: '🚒',
    personality: 'apressado',
    targetCategories: ['suv', 'pickup'],
    payRange: { min: 0.83, max: 1.01 },
    hasTradeIn: false,
    patience: 32,
    description: 'Disciplina de quartel. Se gostou, fecha rápido e vai embora.',
  },
  {
    name: 'Gabi Influencer',
    avatar: '📱',
    personality: 'emocional',
    targetCategories: ['popular', 'suv'],
    payRange: { min: 0.83, max: 1.05 },
    hasTradeIn: false,
    patience: 45,
    description: 'Vai postar o carro novo hoje. Visual importa mais que preço.',
  },
  {
    name: 'Lourival Eletricista',
    avatar: '⚡',
    personality: 'pechincha',
    targetCategories: ['popular', 'eletrico'],
    payRange: { min: 0.56, max: 0.81 },
    hasTradeIn: false,
    patience: 87,
    description: 'Curioso com elétricos mas pechinca em tudo.',
  },
  {
    name: 'Baiano Goiânia',
    avatar: '🌶️',
    personality: 'emocional',
    targetCategories: ['popular', 'medio', 'esportivo'],
    payRange: { min: 0.82, max: 1.06 },
    hasTradeIn: false,
    patience: 50,
    description: 'Veio da Bahia e adoptou Goiás. Animado, faz negócio na hora.',
  },
  {
    name: 'Xandão Deputado',
    avatar: '🏛️',
    personality: 'apressado',
    targetCategories: ['suv', 'luxo'],
    payRange: { min: 0.87, max: 1.08 },
    hasTradeIn: false,
    patience: 28,
    description: 'Agenda cheia. Manda o assessor pagar. Sem enrolação.',
  },
  {
    name: 'Dinha Distribuidora',
    avatar: '📦',
    personality: 'racional',
    targetCategories: ['pickup', 'popular'],
    payRange: { min: 0.78, max: 0.96 },
    hasTradeIn: false,
    patience: 68,
    description: 'Carro pra entrega. Avalia o custo-benefício com cuidado.',
  },
  {
    name: 'Cabelão Rock',
    avatar: '🤘',
    personality: 'emocional',
    targetCategories: ['esportivo', 'classico'],
    payRange: { min: 0.85, max: 1.08 },
    hasTradeIn: true,
    patience: 48,
    description: 'Clássico ou esportivo. Nada no meio. Paga bem pelo que quer.',
  },
  {
    name: 'Rosinha Saúde',
    avatar: '🏃',
    personality: 'curioso',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.72, max: 0.95 },
    hasTradeIn: false,
    patience: 65,
    description: 'Cuida bem de tudo. Quer carro conservado pra cuidar igual.',
  },
  {
    name: 'Véi do Sertão',
    avatar: '🤠',
    personality: 'pechincha',
    targetCategories: ['pickup', 'classico'],
    payRange: { min: 0.52, max: 0.78 },
    hasTradeIn: true,
    patience: 92,
    description: 'Homem do campo. Paciência de quem planta e espera colheita.',
  },
  {
    name: 'Neguinho Serrinha',
    avatar: '🌲',
    personality: 'racional',
    targetCategories: ['pickup', 'popular'],
    payRange: { min: 0.76, max: 0.95 },
    hasTradeIn: false,
    patience: 73,
    description: 'Madeireiro que pesquisa antes de comprar qualquer coisa.',
  },
  {
    name: 'Fofão da Praça',
    avatar: '🧙',
    personality: 'curioso',
    targetCategories: ['popular', 'classico'],
    payRange: { min: 0.60, max: 0.88 },
    hasTradeIn: false,
    patience: 85,
    description: 'Aparece todo dia só pra olhar. Mas quando compra, compra.',
  },
  {
    name: 'Tatinha Corretora',
    avatar: '🏠',
    personality: 'apressado',
    targetCategories: ['suv', 'medio'],
    payRange: { min: 0.82, max: 1.00 },
    hasTradeIn: false,
    patience: 38,
    description: 'Visita imóvel daqui a meia hora. Resolve o carro antes.',
  },
  {
    name: 'Pipoca do Estádio',
    avatar: '🍿',
    personality: 'emocional',
    targetCategories: ['popular'],
    payRange: { min: 0.76, max: 0.99 },
    hasTradeIn: false,
    patience: 55,
    description: 'Corintiano roxo. Quer o carro pra ir pro jogo. Animado demais.',
  },
  {
    name: 'Moniquinha Contábil',
    avatar: '🧮',
    personality: 'racional',
    targetCategories: ['popular', 'medio'],
    payRange: { min: 0.77, max: 0.95 },
    hasTradeIn: false,
    patience: 76,
    description: 'CRC na parede. Sabe o custo-benefício de cada parafuso.',
  },
  {
    name: 'Beto Assador',
    avatar: '🍖',
    personality: 'emocional',
    targetCategories: ['pickup', 'suv'],
    payRange: { min: 0.83, max: 1.04 },
    hasTradeIn: false,
    patience: 50,
    description: 'Boteco e churrasqueira na propriedade. Quer pickup pra levar material.',
  },
  {
    name: 'Lorena Veterinária',
    avatar: '🐾',
    personality: 'racional',
    targetCategories: ['suv', 'pickup'],
    payRange: { min: 0.80, max: 0.97 },
    hasTradeIn: false,
    patience: 67,
    description: 'Precisa de espaço pra transportar os pets. Avalia bem.',
  },
  {
    name: 'Jailton Oficina',
    avatar: '🔨',
    personality: 'pechincha',
    targetCategories: ['popular', 'medio', 'classico'],
    payRange: { min: 0.54, max: 0.82 },
    hasTradeIn: true,
    patience: 88,
    description: 'Conserta carro dos outros e negocia o próprio com dureza.',
  },
];

// ─────────────────────────────────────────────────────────────────
// Sistema de ciclos (30 min)
// ─────────────────────────────────────────────────────────────────

/** Duração de um ciclo de compradores em milissegundos (3 min) */
export const BUYER_CYCLE_MS = 3 * 60 * 1_000;

/** Índice do ciclo atual; incrementa a cada 30 minutos de tempo real */
export function currentCycleEpoch(): number {
  return Math.floor(Date.now() / BUYER_CYCLE_MS);
}

/** Segundos restantes até o início do próximo ciclo */
export function secondsUntilNextCycle(): number {
  const elapsed = Date.now() % BUYER_CYCLE_MS;
  return Math.ceil((BUYER_CYCLE_MS - elapsed) / 1_000);
}

/** Timestamp (ms) do início do próximo ciclo de compradores */
export function nextCycleTimestamp(): number {
  return Math.ceil(Date.now() / BUYER_CYCLE_MS) * BUYER_CYCLE_MS;
}

/**
 * Número máximo de slots de comprador disponíveis para o nível do jogador.
 *
 * Progressão:
 *   Nível  1–9  → 2 slots (base)
 *   Nível 10    → 3 slots  (+1 a cada 10 níveis a partir daqui)
 *   Nível 20    → 4 slots
 *   Nível 30    → 5 slots
 *   Nível 40    → 6 slots
 *   Nível 50    → 7 slots  … e assim por diante
 *
 * Fórmula: 2 + floor(level / 10)
 */
export function maxBuyerSlots(level: number): number {
  return 2 + Math.floor(level / 10);
}

// ─────────────────────────────────────────────────────────────────
// Progressão por nível — categorias e preços desbloqueados
// ─────────────────────────────────────────────────────────────────

interface BuyerTier {
  minLevel: number;
  maxLevel: number;
  /**
   * Distribuição percentual por categoria. A soma não precisa ser 100 —
   * usamos como pesos normalizados em weighted random.
   * Categorias ausentes neste objeto NUNCA são pedidas neste tier
   * (exceto pedidos raros que pegam de um tier superior).
   */
  categoryWeights: Record<string, number>;
  /** Preço FIPE máximo (variante mais barata) para pedidos de modelo específico. */
  maxFipePrice: number;
}

/**
 * Progressão de pedidos por nível do jogador.
 *
 *  • 1-10  Início       — populares dominam, médios e clássicos como apoio.
 *  • 11-15 Intermediário — adiciona SUVs e pickups.
 *  • 16-20 Intermediário+— adiciona esportivos e elétricos.
 *  • 21-25 Avançado     — esportivos e luxo ganham espaço, populares somem aos poucos.
 *  • 26+   Endgame      — supercarros dominam, luxo segue como apoio.
 *
 * Pedidos raros: 5% de chance por comprador de pegar uma categoria de um
 * TIER ACIMA do atual (ex: jogador Lv 5 recebendo um pedido de SUV).
 */
const LEVEL_TIERS: BuyerTier[] = [
  // ── Tier 1 — Início (1-10) ──────────────────────────────────────
  {
    minLevel: 1, maxLevel: 10,
    categoryWeights: {
      popular:  60,
      medio:    25,
      classico: 15,
    },
    maxFipePrice: 120_000,
  },
  // ── Tier 2 — Intermediário 1 (11-15) ────────────────────────────
  {
    minLevel: 11, maxLevel: 15,
    categoryWeights: {
      popular:  20,
      medio:    20,
      suv:      25,
      pickup:   20,
      classico: 15,
    },
    maxFipePrice: 220_000,
  },
  // ── Tier 3 — Intermediário 2 (16-20) ────────────────────────────
  {
    minLevel: 16, maxLevel: 20,
    categoryWeights: {
      medio:     10,
      suv:       10,
      pickup:    10,
      esportivo: 25,
      eletrico:  20,
      popular:   15,
      classico:  10,
    },
    maxFipePrice: 400_000,
  },
  // ── Tier 4 — Avançado (21-25) ───────────────────────────────────
  {
    minLevel: 21, maxLevel: 25,
    categoryWeights: {
      esportivo: 35,
      luxo:      25,
      suv:       10,
      pickup:    10,
      eletrico:  10,
      popular:    5,
      medio:      5,
    },
    maxFipePrice: 1_000_000,
  },
  // ── Tier 5 — Endgame (26+) ──────────────────────────────────────
  {
    minLevel: 26, maxLevel: 100,
    categoryWeights: {
      supercar:  50,
      luxo:      20,
      esportivo: 15,
      eletrico:  10,
      popular:    2,
      medio:      2,
      suv:        1,
    },
    maxFipePrice: Infinity,
  },
];

/** Retorna o tier de compradores correspondente ao nível do jogador. */
function getBuyerTier(level: number): BuyerTier {
  for (const t of LEVEL_TIERS) {
    if (level >= t.minLevel && level <= t.maxLevel) return t;
  }
  // Fallback defensivo — nunca deveria chegar aqui se LEVEL_TIERS cobre 1-100.
  return LEVEL_TIERS[LEVEL_TIERS.length - 1] ?? LEVEL_TIERS[0]!;
}

/** Retorna o tier IMEDIATAMENTE acima do atual (para pedidos raros). */
function getNextTierAbove(level: number): BuyerTier | null {
  const current = getBuyerTier(level);
  const idx = LEVEL_TIERS.indexOf(current);
  if (idx < 0 || idx >= LEVEL_TIERS.length - 1) return null;
  return LEVEL_TIERS[idx + 1] ?? null;
}

/**
 * Weighted random: escolhe uma chave do objeto de pesos.
 * Pesos podem somar qualquer valor — normalizamos internamente.
 */
function weightedPick<K extends string>(weights: Record<K, number>): K | null {
  const entries = Object.entries(weights) as Array<[K, number]>;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1]?.[0] ?? null;
}

/**
 * Probabilidade (0-1) de um comprador gerar pedido raro de tier acima.
 * Calibrado em 5% — pequeno o suficiente para não atrapalhar a progressão,
 * grande o suficiente para o jogador ter uma surpresa ocasional.
 */
const RARE_REQUEST_CHANCE = 0.05;

/**
 * Seleciona a categoria do pedido respeitando os pesos do tier corrente
 * e aplicando 5% de chance de pedido raro (categoria de tier acima).
 *
 * Retorna a categoria escolhida e um flag indicando se foi pedido raro.
 */
function pickRequestedCategory(playerLevel: number): { category: string; rare: boolean } {
  const tier = getBuyerTier(playerLevel);
  const isRare = Math.random() < RARE_REQUEST_CHANCE;

  if (isRare) {
    const upperTier = getNextTierAbove(playerLevel);
    if (upperTier) {
      // Filtra apenas categorias do tier acima que NÃO existem no tier atual.
      const newCategories = Object.keys(upperTier.categoryWeights).filter(
        c => !(c in tier.categoryWeights),
      );
      if (newCategories.length > 0) {
        const upperWeights: Record<string, number> = {};
        for (const c of newCategories) {
          upperWeights[c] = upperTier.categoryWeights[c] ?? 1;
        }
        const picked = weightedPick(upperWeights);
        if (picked) return { category: picked, rare: true };
      }
    }
    // Sem tier acima ou todas as categorias já cobertas — cai no normal
  }

  const picked = weightedPick(tier.categoryWeights);
  return { category: picked ?? 'popular', rare: false };
}

/** Lista de todas as categorias permitidas no tier (legacy compat). */
function tierAllowedCategories(tier: BuyerTier): string[] {
  return Object.keys(tier.categoryWeights);
}

// Labels legíveis para categorias
export const CATEGORY_LABELS: Record<string, string> = {
  popular:   'Popular',
  medio:     'Médio',
  classico:  'Clássico',
  suv:       'SUV',
  pickup:    'Pickup',
  esportivo: 'Esportivo',
  eletrico:  'Elétrico',
  luxo:      'Luxo',
  jdm:       'JDM',
  supercar:  'Supercarro',
};

function genCycleId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Instancia um comprador para um slot de ciclo específico.
 *
 * Regra de trade-in obrigatória:
 * - Compradores com trade-in DEVEM solicitar um modelo específico (nunca categoria).
 * - O modelo desejado deve ter FIPE mínima > FIPE do carro oferecido na troca.
 * - Se nenhum modelo válido for encontrado, a troca é removida (negociação em dinheiro).
 *
 * Fluxo:
 *  1. Decide antecipadamente se o comprador terá trade-in (rola o dado antes).
 *  2. Se terá trade-in → força effectiveReqType = 'model'.
 *  3. Seleciona modelo com FIPE mínima adequada para ser o teto do trade-in.
 *  4. Gera o trade-in com FIPE ≤ 90 % do menor FIPE do modelo desejado.
 *  5. Valida defensivamente: se FIPE do trade-in ≥ FIPE mín do modelo → remove troca.
 */
export function spawnCycleBuyer(
  slotIndex: number,
  requirementType: 'category' | 'model',
  playerLevel: number,
): CarBuyerNPC {
  const tier = getBuyerTier(playerLevel);
  const allowedCats = tierAllowedCategories(tier);

  // Categoria desejada do pedido — aplica weighted distribution + 5% rare
  const { category: requestedCategory, rare: isRareRequest } = pickRequestedCategory(playerLevel);

  // Filtra templates cujas categorias-alvo TÊM a categoria sorteada
  // (tornar a personalidade do comprador coerente com o pedido).
  // Se nenhum template combinar, cai pra qualquer template do tier.
  const matchingTemplates = BUYER_TEMPLATES.filter(t =>
    t.targetCategories.includes(requestedCategory),
  );
  const fallbackTemplates = BUYER_TEMPLATES.filter(t =>
    t.targetCategories.some(c => allowedCats.includes(c)),
  );
  const templatePool = matchingTemplates.length > 0
    ? matchingTemplates
    : (fallbackTemplates.length > 0 ? fallbackTemplates : BUYER_TEMPLATES);
  const template = templatePool[Math.floor(Math.random() * templatePool.length)];

  // ── 1. Decide antecipadamente se haverá trade-in ─────────────────
  // Compradores com trade-in OBRIGAM pedido de modelo específico.
  const willHaveTradeIn = template.hasTradeIn && Math.random() > 0.4;
  const effectiveReqType: 'category' | 'model' = willHaveTradeIn ? 'model' : requirementType;

  // ── 2. Determina o target com effectiveReqType ───────────────────
  let targetModelIds:   string[] = [];
  let targetCategories: string[] = [];
  let targetModelId:    string | undefined;
  let targetModelName:  string | undefined;
  let maxTradeInFipe:   number;

  // Pedidos raros levantam o teto de FIPE para acomodar carros caros
  const effectiveMaxFipe = isRareRequest && tier.maxFipePrice !== Infinity
    ? tier.maxFipePrice * 3
    : tier.maxFipePrice;

  if (effectiveReqType === 'model') {
    // Filtra modelos PELA categoria sorteada para coerência com o pedido
    const eligibleModels = CAR_MODELS.filter(m =>
      m.category === requestedCategory &&
      Math.min(...m.variants.map(v => v.fipePrice)) <= effectiveMaxFipe,
    );
    // Fallback se nenhum modelo se encaixa
    const widerPool = eligibleModels.length > 0
      ? eligibleModels
      : CAR_MODELS.filter(m =>
          allowedCats.includes(m.category) &&
          Math.min(...m.variants.map(v => v.fipePrice)) <= effectiveMaxFipe,
        );
    const modelPool = widerPool.length > 0 ? widerPool : CAR_MODELS;
    const model = modelPool[Math.floor(Math.random() * modelPool.length)];
    targetModelIds  = [model.id];
    targetModelId   = model.id;
    targetModelName = `${model.brand} ${model.model}`;
    maxTradeInFipe = Math.min(...model.variants.map(v => v.fipePrice)) * 0.9;
  } else {
    targetCategories = [requestedCategory];
    maxTradeInFipe = (effectiveMaxFipe === Infinity ? 500_000 : effectiveMaxFipe) * 0.8;
  }

  // ── 3. Gera trade-in dentro do teto ─────────────────────────────
  let tradeInCar = willHaveTradeIn ? generateTradeInCar(maxTradeInFipe) : undefined;

  // ── 4. Validação defensiva: trade-in FIPE < modelo desejado FIPE ─
  // Caso generateTradeInCar retorne algo acima do teto (edge case),
  // remove a troca em vez de criar inconsistência econômica.
  if (tradeInCar && targetModelId) {
    const desiredModel = CAR_MODELS.find(m => m.id === targetModelId);
    const modelMinFipe = desiredModel
      ? Math.min(...desiredModel.variants.map(v => v.fipePrice))
      : Infinity;
    if (tradeInCar.fipePrice >= modelMinFipe) {
      tradeInCar = undefined; // remove troca inválida → negociação só em dinheiro
    }
  }

  const tradeInValue = tradeInCar
    ? Math.round(
        tradeInCar.fipePrice *
        conditionValueFactor(tradeInCar.condition) *
        (0.85 + Math.random() * 0.15)
      )
    : undefined;

  return {
    id:              genCycleId(),
    name:            template.name,
    avatar:          template.avatar,
    personality:     template.personality,
    targetModelIds,
    targetCategories,
    targetModelId,
    targetModelName,
    requirementType: effectiveReqType,
    slotIndex,
    payRange:        template.payRange,
    hasTradeIn:      !!tradeInCar,
    tradeInCar,
    tradeInValue,
    patience:  secondsUntilNextCycle(),
    arrivedAt: Date.now(),
    state:     'waiting',
  };
}

/**
 * Gera todos os compradores para um novo ciclo.
 * lockedSlotIndices: slots que permanecem bloqueados (não recebem comprador novo).
 * Distribui 50% categoria / 50% modelo específico, com pequeno embaralhamento.
 */
export function generateCycleBuyers(
  playerLevel: number,
  lockedSlotIndices: number[],
): CarBuyerNPC[] {
  const totalSlots = maxBuyerSlots(playerLevel);

  // Distribui tipos: alternando categoria/modelo → 50/50 para slots pares
  const reqTypes: Array<'category' | 'model'> = Array.from(
    { length: totalSlots },
    (_, i): 'category' | 'model' => (i % 2 === 0 ? 'category' : 'model'),
  );
  // Fisher-Yates shuffle para não ser sempre previsível
  for (let i = reqTypes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = reqTypes[i];
    reqTypes[i] = reqTypes[j];
    reqTypes[j] = tmp;
  }

  const buyers: CarBuyerNPC[] = [];
  for (let i = 0; i < totalSlots; i++) {
    if (lockedSlotIndices.includes(i)) continue;
    buyers.push(spawnCycleBuyer(i, reqTypes[i], playerLevel));
  }
  return buyers;
}

// ─────────────────────────────────────────────────────────────────
// Gerador de instância de comprador (legado — mantido para compat)
// ─────────────────────────────────────────────────────────────────

/**
 * Gera um OwnedCar para ser usado como trade-in de um NPC.
 * maxFipePrice: teto de FIPE — garante que o trade-in nunca valha mais
 * do que o carro que o comprador quer adquirir.
 */
function generateTradeInCar(maxFipePrice: number): OwnedCar {
  // Filtra modelos cujo menor preço de variante cabe no teto
  const eligibleModels = CAR_MODELS.filter(m =>
    Math.min(...m.variants.map(v => v.fipePrice)) <= maxFipePrice,
  );
  const modelPool = eligibleModels.length > 0 ? eligibleModels : CAR_MODELS;
  const model = modelPool[Math.floor(Math.random() * modelPool.length)];

  // Filtra variantes dentro do teto para garantia adicional
  const eligibleVariants = model.variants.filter(v => v.fipePrice <= maxFipePrice);
  const variantPool = eligibleVariants.length > 0 ? eligibleVariants : model.variants;
  const variant = variantPool[Math.floor(Math.random() * variantPool.length)];

  const condition = Math.floor(20 + Math.random() * 60); // 20-80
  const factor = conditionValueFactor(condition);
  return {
    instanceId: `tradein_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    modelId: model.id,
    variantId: variant.id,
    fullName: `${model.brand} ${model.model} ${variant.trim}`,
    brand: model.brand,
    model: model.model,
    trim: variant.trim,
    year: variant.year,
    icon: model.icon,
    fipePrice: variant.fipePrice,
    condition,
    purchasePrice: Math.round(variant.fipePrice * factor),
    purchasedAt: Date.now(),
  };
}

/**
 * Instancia um comprador aleatório (legado — sem exigência específica).
 * Compradores genéricos não oferecem troca de veículos: apenas pagamento em dinheiro.
 */
export function spawnBuyer(id: string): CarBuyerNPC {
  const template = BUYER_TEMPLATES[Math.floor(Math.random() * BUYER_TEMPLATES.length)];
  // Sem trade-in: compradores sem pedido específico não têm base para propor troca equilibrada.
  return {
    id,
    name:             template.name,
    avatar:           template.avatar,
    personality:      template.personality,
    targetModelIds:   [],
    targetCategories: template.targetCategories,
    payRange:         template.payRange,
    hasTradeIn:       false,
    tradeInCar:       undefined,
    tradeInValue:     undefined,
    patience:         template.patience,
    arrivedAt:        Date.now(),
    state:            'waiting',
  };
}

/**
 * Multiplicador sobre o máximo do comprador a partir do qual ele faz uma contraoferta.
 * Se playerOffer ≤ buyerMax × COUNTER_OFFER_RATIO → contraoferta.
 * Se playerOffer > buyerMax × COUNTER_OFFER_RATIO → rejeição direta.
 */
export const COUNTER_OFFER_RATIO = 1.30;

/**
 * Calcula o valor que o comprador está disposto a pagar.
 *
 * Range: entre valor_mercado (FIPE × conditionValueFactor) e FIPE puro.
 * Aleatoriedade uniforme dentro do intervalo — quanto melhor o carro, mais
 * próximo da FIPE o comprador tende a pagar.
 *
 *   low  = min(valor_mercado, FIPE)
 *   high = max(valor_mercado, FIPE)
 *   oferta = low + random × (high − low)
 */
export function calculateBuyerOffer(
  _buyer: CarBuyerNPC,
  fipePrice: number,
  condition: number,
): number {
  const marketValue = fipePrice * conditionValueFactor(condition);
  const low  = Math.min(marketValue, fipePrice);
  const high = Math.max(marketValue, fipePrice);
  return Math.round(low + Math.random() * (high - low));
}

/**
 * Avalia a probabilidade de aceitação da oferta do jogador.
 *
 * Fluxo:
 *  1. Calcula ratio = preço_jogador / valor_mercado  (FIPE × conditionValueFactor)
 *  2. Define chance base pelo ratio:
 *       ≤ 0.95 → 90–100 %
 *       ≤ 1.00 → 70–90 %
 *       ≤ 1.10 → 40–70 %
 *       > 1.10 → 10–40 %
 *  3. Ajuste por condição do veículo:
 *       condition ≥ 60 → bônus = (condition − 60) × 0.5
 *       condition < 60 → penalidade = (60 − condition) × 0.7
 *  4. chance_final = base + bônus −penalidade, clampado em [0, 100].
 *  5. Se condition ≥ 60 → chance mínima garantida de 60 %.
 *  6. Retorna true se random × 100 ≤ chance_final.
 *
 * Bônus por personalidade:
 *   emocional  → +10  (decide pelo coração)
 *   apressado  → +8   (quer fechar logo)
 *   curioso    → +0
 *   racional   → +0
 *   pechincha  → −8   (sempre tenta pagar menos)
 */
export function evaluatePlayerOffer(
  buyer: CarBuyerNPC,
  playerOfferPrice: number,
  fipePrice: number,
  condition: number,
): boolean {
  const marketValue = fipePrice * conditionValueFactor(condition);
  // Teto real do comprador: o maior entre valor_mercado e FIPE
  const buyerMax = Math.max(marketValue, fipePrice);
  const ratio    = playerOfferPrice / buyerMax;

  // ── 1. Chance base pelo ratio preço/teto_comprador ──────────────
  // ratio ≤ 1.0 → pede dentro do que o comprador pagaria → alta chance
  let baseChance: number;
  if (ratio <= 0.90) {
    baseChance = 90 + Math.random() * 10;  // 90–100 %
  } else if (ratio <= 1.00) {
    baseChance = 75 + Math.random() * 15;  // 75–90 %
  } else if (ratio <= 1.10) {
    baseChance = 40 + Math.random() * 30;  // 40–70 %
  } else {
    baseChance = 10 + Math.random() * 30;  // 10–40 %
  }

  // ── 2. Ajuste por condição do veículo ───────────────────────────
  const bonus    = condition >= 60 ? (condition - 60) * 0.5 : 0;
  const penalty  = condition <  60 ? (60 - condition) * 0.7 : 0;

  // ── 3. Bônus por personalidade ──────────────────────────────────
  const personalityBonus: Record<BuyerPersonality, number> = {
    emocional: 10,
    apressado:  8,
    curioso:    0,
    racional:   0,
    pechincha: -8,
  };
  const emotionalBonus = personalityBonus[buyer.personality] ?? 0;

  // ── 4. Chance final ─────────────────────────────────────────────
  let chance = baseChance + bonus - penalty + emotionalBonus;

  // ── 5. Garantia mínima para veículos em bom estado ─────────────
  if (condition >= 60) chance = Math.max(chance, 60);

  return Math.random() * 100 <= Math.min(100, Math.max(0, chance));
}
