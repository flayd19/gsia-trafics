# GSIA TRAFICS — Design System

**Versão:** 2.0 · "Operations" · iOS/macOS-inspired
**Objetivo:** Interface de sistema operacional de gestão — limpa, sofisticada, minimalista. Transmite controle, discrição e inteligência estratégica. Nada de estética caricata de crime.
**Referência visual:** Apple HIG, Linear, Stripe Dashboard, Revolut Business, Notion.

---

## 1. Paleta de cores

### 1.1 Base (light mode)

| Token                 | HEX        | Uso                                            |
| --------------------- | ---------- | ---------------------------------------------- |
| `--bg-canvas`         | `#F2F2F7`  | Fundo raiz da aplicação (iOS system group)     |
| `--bg-surface`        | `#FFFFFF`  | Cards, sheets, modais                          |
| `--bg-surface-alt`    | `#FAFAFC`  | Linhas alternadas de tabela, cabeçalhos        |
| `--bg-elevated`       | `#FFFFFF`  | Sheets flutuantes (com shadow maior)           |
| `--bg-inset`          | `#EFEFF4`  | Inputs, campos read-only, blocos de destaque   |
| `--bg-overlay`        | `rgba(0,0,0,0.04)` | Hover leve                             |

### 1.2 Texto

| Token               | HEX       | Uso                                    |
| ------------------- | --------- | -------------------------------------- |
| `--text-primary`    | `#1C1C1E` | Títulos, dados principais              |
| `--text-secondary`  | `#3A3A3C` | Texto de corpo, subtítulos             |
| `--text-tertiary`   | `#8E8E93` | Labels, descrições, placeholders       |
| `--text-quaternary` | `#C7C7CC` | Hints, estados desabilitados           |
| `--text-on-accent`  | `#FFFFFF` | Texto sobre azul primário              |

### 1.3 Cor primária — iOS Blue

| Token              | HEX        | Uso                                  |
| ------------------ | ---------- | ------------------------------------ |
| `--accent-500`     | `#007AFF`  | Botões primários, links, CTA         |
| `--accent-600`     | `#0051D5`  | Hover de botão primário              |
| `--accent-700`     | `#0041A8`  | Pressionado                          |
| `--accent-tint`    | `#E5F1FF`  | Fundo de estados selecionados, tags  |
| `--accent-tint-2`  | `rgba(0,122,255,0.08)` | Hover sutil em itens blue |

### 1.4 Semântica

| Token             | HEX       | Uso                              |
| ----------------- | --------- | -------------------------------- |
| `--success-500`   | `#34C759` | Lucro, status seguro, toggles ON |
| `--success-tint`  | `#E6F7EB` | Fundo de tags "seguro"           |
| `--danger-500`    | `#FF3B30` | Perda, risco crítico, erros      |
| `--danger-tint`   | `#FFE8E7` | Fundo de tags "em risco"         |
| `--warning-500`   | `#FF9500` | Alertas, atenção                 |
| `--warning-tint`  | `#FFF4E0` | Fundo de tags "atenção"          |
| `--info-500`      | `#5AC8FA` | Informação, dicas                |
| `--info-tint`     | `#E7F6FE` | Fundo de tags "info"             |

### 1.5 Neutras / separadores

| Token                  | HEX / RGBA                 | Uso                       |
| ---------------------- | -------------------------- | ------------------------- |
| `--separator-opaque`   | `#E5E5EA`                  | Dividers visíveis         |
| `--separator-hairline` | `rgba(60,60,67,0.18)`      | Dividers finos sobre glass |
| `--stroke-subtle`      | `rgba(0,0,0,0.06)`         | Borda de card hairline    |

### 1.6 Glassmorphism (HUD e nav bars)

```css
background: rgba(255, 255, 255, 0.72);
backdrop-filter: saturate(180%) blur(20px);
-webkit-backdrop-filter: saturate(180%) blur(20px);
border: 1px solid rgba(255, 255, 255, 0.5);
```

Para dark overlays sobre conteúdo:
```css
background: rgba(242, 242, 247, 0.8);
backdrop-filter: blur(30px);
```

---

## 2. Tipografia

### 2.1 Font stack

```css
font-family:
  -apple-system, BlinkMacSystemFont,
  "SF Pro Display", "SF Pro Text",
  "Inter", "Helvetica Neue", Helvetica, Arial,
  sans-serif;
```

### 2.2 Números / dados

```css
font-family:
  "SF Mono", "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum" 1, "ss01" 1;
```

Regra: **todo número de dinheiro, estoque, % ou tempo usa tabular-nums** para alinhamento perfeito em tabelas e HUD.

### 2.3 Escala tipográfica (iOS HIG baseada)

| Nome          | Tamanho / Line-height | Peso     | Letter-spacing | Uso                          |
| ------------- | --------------------- | -------- | -------------- | ---------------------------- |
| Large Title   | 34 / 41 px            | 700      | -0.4px         | Título de tela raiz          |
| Title 1       | 28 / 34 px            | 700      | -0.3px         | Hero headers                 |
| Title 2       | 22 / 28 px            | 700      | -0.2px         | Seções principais            |
| Title 3       | 20 / 25 px            | 600      | -0.1px         | Subsection                   |
| Headline      | 17 / 22 px            | 600      | 0              | Nome de produto, card title  |
| Body          | 17 / 22 px            | 400      | 0              | Texto padrão                 |
| Callout       | 16 / 21 px            | 400      | 0              | Descrições secundárias       |
| Subhead       | 15 / 20 px            | 500      | 0              | Células de tabela            |
| Footnote      | 13 / 18 px            | 400      | 0              | Metadados                    |
| Caption 1     | 12 / 16 px            | 500      | 0              | Tags, uppercase labels       |
| Caption 2     | 11 / 13 px            | 400      | 0.1px          | Micro-labels                 |

### 2.4 Regras

- **Nunca** mais de 2 pesos na mesma tela (exceto Semibold em nav bars)
- **Nunca** ALL CAPS em body text; apenas em tags (12px semibold letter-spacing 0.5px)
- Hierarquia por tamanho e cor, não por peso

---

## 3. Grid e espaçamento

### 3.1 Escala (base 4px)

```
4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96
```

Tokens: `--space-1` (4px), `--space-2` (8px), `--space-3` (12px), ..., `--space-16` (64px).

### 3.2 Container

| Breakpoint | Width       | Gutter | Margin lateral |
| ---------- | ----------- | ------ | -------------- |
| Mobile     | < 600px     | 16px   | 20px           |
| Tablet     | 600-1024px  | 24px   | 32px           |
| Desktop    | > 1024px    | 32px   | 48px           |
| Content max | —          | —      | 1200px         |

### 3.3 Safe areas

Sempre respeitar `env(safe-area-inset-*)` para iOS. Nav bar top tem 44px + safe area. Tab bar bottom tem 56px + safe area.

### 3.4 Raio de canto

| Token         | Valor  | Uso                             |
| ------------- | ------ | ------------------------------- |
| `--radius-sm` | 8px    | Inputs, small chips             |
| `--radius-md` | 12px   | Botões, switches                |
| `--radius-lg` | 16px   | Cards padrão                    |
| `--radius-xl` | 20px   | Sheets, modais, cards hero      |
| `--radius-2xl`| 28px   | Sheets iOS estilo bottom-sheet  |
| `--radius-pill` | 999px | Tags, avatars, pills            |

### 3.5 Sombras

```css
--shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
--shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
--shadow-md: 0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04);
--shadow-xl: 0 16px 48px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.06);
--shadow-focus-ring: 0 0 0 3px rgba(0,122,255,0.25);
```

Regra: shadows são **sutis**. Preferimos hairline borders (`rgba(0,0,0,0.06)`) e color em vez de blur forte.

---

## 4. Componentes

### 4.1 Botões

**Altura mínima:** 44px (touch target iOS). **Radius:** 12px. **Padding:** `0 20px`. **Font:** 17 / 600, sem caps.

#### Primário
- Bg `--accent-500`, text `--text-on-accent`
- Hover: bg `--accent-600`
- Active: bg `--accent-700` + scale(0.98)
- Disabled: bg `#C7C7CC`, text rgba(255,255,255,0.7)
- Transition: `background-color 150ms, transform 100ms ease-out`

#### Secundário (tint)
- Bg `--accent-tint`, text `--accent-500`
- Hover: bg `#D4E8FF`
- Active: bg `#C2DDFF`

#### Terciário (ghost)
- Bg transparent, text `--accent-500`
- Hover: bg `--accent-tint-2`
- Sem border

#### Destrutivo
- Bg `--danger-500`, text white
- Hover: bg `#E52B21`

#### Ícone
- 44×44px, ícone 20px centralizado
- Border-radius 12px
- Hover: bg `rgba(0,0,0,0.04)`

### 4.2 Cards

#### Padrão
```css
background: var(--bg-surface);
border-radius: 16px;
padding: 20px;
box-shadow: var(--shadow-sm);
border: 1px solid var(--stroke-subtle);
```

#### Glass (HUD, floating)
```css
background: rgba(255, 255, 255, 0.72);
backdrop-filter: saturate(180%) blur(20px);
border: 1px solid rgba(255, 255, 255, 0.5);
border-radius: 20px;
box-shadow: var(--shadow-md);
```

#### Stats / KPI card
- Padding 20px
- Label Caption 1 uppercase `--text-tertiary`
- Valor Title 1 tabular-nums `--text-primary`
- Delta Footnote + ícone seta
  - Positivo: `--success-500`
  - Negativo: `--danger-500`

### 4.3 Inputs

```css
height: 44px;
padding: 0 16px;
border-radius: 12px;
background: var(--bg-inset);
border: 1px solid transparent;
font: 17px/22px -apple-system;
color: var(--text-primary);
transition: all 150ms ease;

&:focus {
  background: var(--bg-surface);
  border-color: var(--accent-500);
  box-shadow: var(--shadow-focus-ring);
  outline: none;
}
```

Labels acima, 13px/500 `--text-tertiary` uppercase letter-spacing 0.3px.
Helper text abaixo, 12px `--text-tertiary`. Erros em `--danger-500`.

### 4.4 Tabelas (fintech)

```css
/* Container */
border-radius: 16px;
overflow: hidden;
background: var(--bg-surface);
border: 1px solid var(--stroke-subtle);

/* Header */
background: var(--bg-surface-alt);
backdrop-filter: blur(10px);
position: sticky;
top: 0;
height: 44px;
font: 12px/16px 600; text-transform: uppercase;
color: var(--text-tertiary);
letter-spacing: 0.5px;
border-bottom: 1px solid var(--separator-opaque);

/* Rows */
height: 52px;
border-bottom: 1px solid var(--separator-hairline);

&:hover {
  background: rgba(0,122,255,0.03);
}

/* Cells */
font: 15px/20px 500;
padding: 0 16px;

.num {
  font-family: "SF Mono", monospace;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
```

### 4.5 Tags / Status pills

```css
display: inline-flex;
align-items: center;
gap: 6px;
height: 24px;
padding: 0 10px;
border-radius: 999px;
font: 12px/1 600;
letter-spacing: 0.3px;
```

| Status       | Bg           | Text          | Dot          |
| ------------ | ------------ | ------------- | ------------ |
| Seguro       | success-tint | success-500   | success-500  |
| Em risco     | warning-tint | `#C2410C`     | warning-500  |
| Crítico      | danger-tint  | danger-500    | danger-500   |
| Alta demanda | accent-tint  | accent-600    | accent-500   |
| Aguardando   | `#F2F2F7`    | `#6B7280`     | `#8E8E93`    |
| Em trânsito  | info-tint    | `#0891B2`     | info-500     |

### 4.6 Toggle (iOS switch)

- W 51px, H 31px
- Off: bg `#E9E9EA`
- On: bg `--success-500`
- Handle: 27px branco, shadow `var(--shadow-sm)`
- Transition: 200ms

### 4.7 Segmented Control

```css
display: inline-flex;
background: var(--bg-inset);
border-radius: 9px;
padding: 2px;
height: 32px;

/* Active segment */
background: var(--bg-surface);
border-radius: 7px;
box-shadow: var(--shadow-xs);
font-weight: 600;
```

### 4.8 Charts

- Line: stroke 2.5px `--accent-500`
- Area: gradient `rgba(0,122,255,0.15)` → `rgba(0,122,255,0)`
- Grid: `--separator-hairline` apenas horizontal, dashed 2,4
- Axis labels: 11px `--text-tertiary`
- Tooltip: card branco, radius 8px, shadow-md, tabular-nums
- Eixo X: só mostrar 4-6 ticks principais
- Curve: monotone (não cardinal pra evitar over-shoot)

---

## 5. HUD (gameplay)

### 5.1 Layout

Posição: top-center flutuante, 12px do topo, dentro de container com max-width 680px.

### 5.2 Visual

```
┌─────────────────────────────────────────────────────┐
│  💵  $ 1,238,450     📦  120 / 500     🟢  Baixo   │
└─────────────────────────────────────────────────────┘
```

```css
height: 56px;
padding: 12px 24px;
border-radius: 20px;
background: rgba(255, 255, 255, 0.72);
backdrop-filter: saturate(180%) blur(20px);
border: 1px solid rgba(255, 255, 255, 0.5);
box-shadow: var(--shadow-md);
display: flex;
gap: 32px;
align-items: center;
```

### 5.3 Elementos

- **Saldo:** ícone 16px + valor tabular 17/600
- **Estoque:** ícone + "120 / 500" tabular 17/500, barra de progresso 4px abaixo
  - Verde < 70%, amarelo 70-90%, vermelho > 90%
- **Risco:** dot 8px colorido + label 15/500
  - Baixo (verde) / Médio (amarelo) / Alto (vermelho)

### 5.4 Comportamento

- Sempre visível durante gameplay
- **Contraste aumenta ao scroll** (bg passa de 0.72 → 0.92 opacity quando scroll > 0)
- Não se sobrepõe ao conteúdo crítico — conteúdo tem `padding-top: 80px` quando HUD presente

---

## 6. Navegação

### 6.1 Top nav bar (iOS style)

- Altura 44px + safe area
- Glass bg
- Grid: [back 44px] [título centralizado, truncado] [action 44px]
- Título: 17/600 quando inline, transforma em Large Title 34/700 quando scrolled to top
- Border-bottom hairline quando scrolled

### 6.2 Tab bar (bottom)

- Altura 56px + safe area
- Glass bg com top border hairline
- Max 5 tabs
- Cada tab:
  - Ícone 24px (outlined quando inativo, filled quando ativo)
  - Label 10/600 uppercase letterspace 0.3
  - Ativo: `--accent-500`
  - Inativo: `--text-tertiary`

### 6.3 Sheet (bottom-sheet iOS)

- Radius top 28px, bottom 0
- Shadow `var(--shadow-xl)`
- Drag indicator: 36×5 pill, `#D1D1D6`, centered top com margin 8px
- Entrance: slide up 300ms spring
- Backdrop: `rgba(0,0,0,0.25)` com backdrop-blur 4px

---

## 7. Animações & microinterações

### 7.1 Durações

| Tipo                 | Duração | Ease                               |
| -------------------- | ------- | ---------------------------------- |
| Hover                | 100ms   | ease-out                           |
| Press (scale 0.98)   | 100ms   | ease-out                           |
| Tooltip / toast      | 150ms   | ease-in-out                        |
| Sheet / modal        | 300ms   | cubic-bezier(0.32, 0.72, 0, 1)     |
| Page transition      | 250ms   | cubic-bezier(0.25, 0.1, 0.25, 1)   |
| Number count-up      | 800ms   | easeOutQuart                       |
| Chart path draw      | 600ms   | easeInOutCubic                     |

### 7.2 Microinterações

- **Botão:** `transform: scale(0.98)` no active
- **Toggle ON:** handle slide 200ms, bg color 150ms
- **Número atualizando:** count-up animado, não troca abrupta
- **Card hover:** shadow sm → md, transition 200ms, NÃO levanta (sem translateY)
- **Row hover (tabela):** bg transition 100ms, sem outline
- **Destaque de dado novo:** flash de 300ms bg `--accent-tint` → transparent
- **Tag "crítico":** pulse sutil (opacity 1 → 0.7 → 1, 2s infinite)

### 7.3 `prefers-reduced-motion`

Todas animações duration-* viram 0ms. Transforms ficam opacity-only.

---

## 8. Ícones

- **Lib:** `lucide-react` (já no projeto), `stroke-width: 1.75px`
- **Tamanhos:** 16px (inline), 20px (padrão), 24px (toolbar), 32px (hero)
- **Cor:** herda de `color` do texto pai
- **Padrão em listas iOS:** ícone dentro de container colorido 28px radius 7px, ícone white dentro

Exemplo:
```
┌────┐
│ 💙 │  TrendingUp
└────┘
```

---

## 9. Wireframes das 8 telas

### 9.1 Menu Principal

```
┌─────────────────────────────┐
│ Operações                   │  ← Large title 34pt
│ Painel de Controle          │  ← Subhead tertiary
│                             │
│ ┌─────────┐ ┌─────────┐     │  ← 2x2 grid de action cards
│ │ 📊      │ │ 🛒      │     │     radius 20, shadow-sm
│ │Dashboard│ │ Compras │     │     ícone em círculo colorido
│ │ 12 ativ │ │ 34 ofert│     │     32px
│ └─────────┘ └─────────┘     │
│ ┌─────────┐ ┌─────────┐     │
│ │ 💰      │ │ 🗺️       │     │
│ │ Vendas  │ │Logística│     │
│ └─────────┘ └─────────┘     │
│                             │
│ ─── Mais ─────────────      │  ← Footnote uppercase
│ ▸ Inventário              › │  ← List rows
│ ▸ Eventos                 › │     border-bottom hairline
│ ▸ Configurações           › │
│                             │
├─────────────────────────────┤
│ [🏠] [📊] [🛒] [🗺️] [⚙️]   │  ← Tab bar glass
└─────────────────────────────┘
```

### 9.2 Dashboard

```
┌─────────────────────────────┐
│ ← Dashboard              ⓘ  │  ← Top nav glass sticky
├─────────────────────────────┤
│                             │
│ SALDO TOTAL                 │  ← Caption tertiary
│ $ 1,238,450                 │  ← Large title tabular
│ ▲ +$34,200 (7d)             │  ← Green delta
│                             │
│ ┌──────────┬──────────┐     │  ← 2x2 stats mini
│ │Lucro 7d  │Risco     │     │
│ │+34,200   │ ● Baixo  │     │
│ ├──────────┼──────────┤     │
│ │Operações │Rotas     │     │
│ │12 ativas │ 3 ativas │     │
│ └──────────┴──────────┘     │
│                             │
│ ╭─ Lucro ao longo do tempo ╮ │  ← Card chart
│ │ ·──·──·──╱╲──·──·─·──· │ │     area gradient
│ │                        │ │
│ ╰────────────────────────╯ │
│                             │
│ OPERAÇÕES EM ANDAMENTO      │
│ ┌─────────────────────┐     │
│ │ ● Entrega P12      … │    │  ← Row com status dot
│ │ ● Negociação A4    … │    │     hover highlight
│ └─────────────────────┘     │
└─────────────────────────────┘
```

### 9.3 Compras

```
┌─────────────────────────────┐
│ ← Mercado              ⚙️   │
├─────────────────────────────┤
│ 🔍 Buscar mercadoria...     │  ← Input bg-inset
│                             │
│ [Todos][Elet][Quím][Outros] │  ← Segmented
│                             │
│ ┌───────────────────────┐   │
│ │ ╭─╮  Produto X       │   │  ← Card
│ │ │📦│ Fornecedor Y    │   │
│ │ ╰─╯ $ 1,200 / un     │   │     preço tabular big
│ │      Estoque: 240    │   │
│ │                [+]   │   │     botão tint radius 12
│ └───────────────────────┘   │
│ ┌───────────────────────┐   │
│ │ ... outra oferta ...  │   │
│ └───────────────────────┘   │
│                             │
└─────────────────────────────┘

[ao tocar] ↓

┌─────────────────────────────┐
│          ▬▬                 │  ← Drag handle
│                             │
│ Produto X                   │  ← Sheet com detalhes
│ Fornecedor Y · ⭐ 4.8        │
│                             │
│ Quantidade    [ - ] 12 [+] │  ← Stepper
│                             │
│ Preço unit.          $1,200 │
│ Subtotal            $14,400 │
│ Taxa (5%)              $720 │
│ ─────────────────────────── │
│ Total              $15,120  │
│                             │
│ ┌─────────────────────────┐ │
│ │    Confirmar compra     │ │  ← Primary btn full-width
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### 9.4 Vendas / Negociação

```
┌─────────────────────────────┐
│ ← Vendas                    │
├─────────────────────────────┤
│ Produto X · 240 un. estoque │
│                             │
│ PREÇO SUGERIDO              │
│ $ 1,450 / un                │  ← Tabular big
│ ▲ +20% vs compra            │
│                             │
│ ╭─ Slider negociação ─────╮ │
│ │ $1,200 ──●────── $1,800 │ │
│ │    custo     valor     │ │
│ ╰──────────────────────────╯│
│                             │
│ QTD a vender                │
│ [ - ]  50  [ + ]            │
│                             │
│ LUCRO ESTIMADO              │
│ + $12,500                   │  ← Success-500
│                             │
│ ┌─ Oferta dos compradores ┐ │
│ │ Contato A $1,400 · 30un  │ │  ← Lista estilo tabela
│ │ Contato B $1,480 · 50un  │ │
│ │ Contato C $1,350 · 100un │ │
│ └──────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │     Enviar contraoferta │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### 9.5 Inventário

```
┌─────────────────────────────┐
│ ← Inventário    [+novo]     │
├─────────────────────────────┤
│ 🔍  [Categoria ▾] [Status ▾]│  ← Filter chips
│                             │
│ ┌─────────────────────────┐ │
│ │PRODUTO  │ QTD │  PREÇO  │ │  ← Header
│ ├─────────┼─────┼─────────┤ │     uppercase
│ │ Produto A  120 $  1,200 │ │     tabular-nums
│ │ Produto B   34 $  4,800 │ │     right-align
│ │ Produto C    8 $ 12,400 │ │     rows 52px
│ │ Produto D  450 $    720 │ │
│ │ Produto E   12 $  8,900 │ │
│ │ ...                     │ │
│ └─────────────────────────┘ │
│                             │
│ 5 produtos · $ 2,340,000    │  ← Summary footnote
└─────────────────────────────┘
```

### 9.6 Mapa / Logística

```
┌─────────────────────────────┐
│ ← Logística                 │
├─────────────────────────────┤
│╔═══════════════════════════╗│  ← Mapa full-bleed
│║   .                       ║│     landmass cinza
│║      ●━━━●━━━●  ROTA 1   ║│     claro #E5E5EA
│║    A              B      ║│
│║   .   ●╌╌╌╌╌●  ROTA 2   ║│     rotas:
│║       C       D          ║│     verde (safe)
│║     .    ●━━●  ROTA 3    ║│     amarelo
│║           E   F          ║│     vermelho (risk)
│╚═══════════════════════════╝│
│ ┌───────────────────────┐   │  ← Card flutuante
│ │ ● Rota 1 · Seguro     │   │     sobre mapa
│ │ A → B · 2h30 · $8k    │   │
│ │ Veículo Van 2 · 80%   │   │
│ │         [Detalhes]    │   │
│ └───────────────────────┘   │
└─────────────────────────────┘
```

### 9.7 Configurações (iOS grouped)

```
┌─────────────────────────────┐
│ Configurações               │  ← Large title
├─────────────────────────────┤
│                             │
│ GERAL                       │  ← Caption uppercase
│ ┌─────────────────────────┐ │     tertiary
│ │ 🔵 Notificações       › │ │  ← Card agrupado
│ │ 🟢 Som                 ━│ │     radius 16
│ │ 🟣 Tema          Auto › │ │     ícones em sq
│ └─────────────────────────┘ │     colorido 28
│                             │
│ JOGO                        │
│ ┌─────────────────────────┐ │
│ │ 🔴 Dificuldade  Médio › │ │
│ │ 🟠 Auto-save     On  ━ │ │     toggle iOS
│ │ 🔵 Tutorial        ›    │ │
│ └─────────────────────────┘ │
│                             │
│ CONTA                       │
│ ┌─────────────────────────┐ │
│ │ 👤 Perfil             › │ │
│ │ 🔔 Privacidade        › │ │
│ │ 🚪 Sair              ⛔ │ │  ← Text em danger-500
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### 9.8 Alertas / Eventos

```
┌─────────────────────────────┐
│ ← Eventos         🔴 3      │  ← Badge count
├─────────────────────────────┤
│ HOJE                        │
│ ┃┌─────────────────────────┐│  ← Stripe colorida 3px
│ ┃│ 🟡 Fiscalização próxima ││     à esquerda
│ ┃│ Rota 2 · há 5 min       ││     card
│ ┃│ Desvie ou aguarde 30min ││
│ ┃│  [Dispensar][Detalhes]  ││
│ ┃└─────────────────────────┘│
│ ┃┌─────────────────────────┐│
│ ┃│ 🟢 Oportunidade         ││
│ ┃│ Produto Z · 2h atrás    ││
│ ┃│ Demanda +40% em B       ││
│ ┃│  [Ver oferta]           ││
│ ┃└─────────────────────────┘│
│                             │
│ ONTEM                       │
│ ┃┌─────────────────────────┐│
│ ┃│ 🔴 Interceptação        ││
│ ┃│ Rota 1 · ontem 23:14    ││     crítico:
│ ┃│ Perda $4,200            ││     pulse animation
│ ┃│  [Analisar]             ││
│ ┃└─────────────────────────┘│
└─────────────────────────────┘
```

---

## 10. Acessibilidade

- **Contraste:**
  - Body text AAA (7:1) — primary `#1C1C1E` sobre `#F2F2F7` ✓
  - UI text AA (4.5:1)
  - Tags testadas com APCA
- **Touch targets:** mínimo 44×44px
- **Focus:** `box-shadow: 0 0 0 3px rgba(0,122,255,0.25)` em qualquer elemento focusable
- **Reduced motion:** `prefers-reduced-motion: reduce` zera durations de transform
- **Dark mode:** ver §11

---

## 11. Dark mode (prévia)

| Token             | Light      | Dark                    |
| ----------------- | ---------- | ----------------------- |
| bg-canvas         | `#F2F2F7`  | `#000000`               |
| bg-surface        | `#FFFFFF`  | `#1C1C1E`               |
| bg-surface-alt    | `#FAFAFC`  | `#2C2C2E`               |
| bg-inset          | `#EFEFF4`  | `#2C2C2E`               |
| text-primary      | `#1C1C1E`  | `#FFFFFF`               |
| text-secondary    | `#3A3A3C`  | `#EBEBF5`               |
| text-tertiary     | `#8E8E93`  | `#EBEBF599` (60%)       |
| accent-500        | `#007AFF`  | `#0A84FF` (um tom acima)|
| separator         | `#E5E5EA`  | `#38383A`               |

Glassmorphism dark:
```css
background: rgba(30, 30, 32, 0.72);
backdrop-filter: saturate(180%) blur(20px);
```

---

## 12. Dos & Don'ts

### ✓ Dos
- Use hairlines em vez de sombras fortes
- Números em tabular-nums SEMPRE
- Espaço em branco generoso (24-32px entre seções)
- Um único verde e um único vermelho na tela ao mesmo tempo
- Ícones outline coerentes (stroke 1.75)
- Micro-copy em minúsculas exceto tags

### ✗ Don'ts
- Gradientes chamativos
- Sombras coloridas
- Emojis como ícones primários (só em conteúdo casual)
- Mais de 2 pesos de fonte por tela
- Bordas de mais de 1px
- Cantos com menos de 8px (exceto separators)
- ALL CAPS em body text
- Nada estética "criminal" explícita — somos um sistema de operações profissional
- Skeuomorfismo / gradientes abusivos / texturas

---

## 13. Mapeamento vs. tema atual

| Elemento antigo (Luxo Gold)  | Novo (Operations iOS)         |
| ---------------------------- | ----------------------------- |
| Fundo preto                  | `--bg-canvas` #F2F2F7         |
| Dourado #D4AF37              | `--accent-500` #007AFF        |
| Creme #e8e0cc                | `--bg-surface` #FFFFFF        |
| Cinzel (títulos)             | SF Pro Display / Inter        |
| Raleway (UI)                 | SF Pro Text / Inter           |
| `.game-card` (pretos)        | `.card` (brancos)             |
| `.btn-luxury` (gold)         | `.btn-primary` (iOS blue)     |
| `.gold-divider`              | `--separator-opaque` hairline |
| `.hud-element`               | `.hud` glass                  |

A migração pode ser gradual: tokens CSS primeiro, depois componentes shadcn, depois telas.

---

**Fim.** Próximo passo sugerido: aplicar tokens CSS (`:root { ... }`) no `src/index.css` e começar pela Home/Dashboard para validar direção visual.
