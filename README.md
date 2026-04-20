# GSIA TRAFICS

Jogo tycoon de logística (web) — React + TypeScript + Vite + Tailwind + shadcn/ui + Supabase.

## Rodando localmente

Requisitos: Node.js 18+ e npm.

```sh
# 1. Instalar dependências
npm install

# 2. Rodar em modo desenvolvimento
npm run dev

# 3. Build de produção
npm run build

# 4. Preview do build
npm run preview
```

## Stack

- **Framework:** Vite + React 18 + TypeScript
- **UI:** Tailwind CSS + shadcn/ui + Radix primitives
- **Backend:** Supabase (auth + database + RPCs)
- **Estado local:** React hooks + localStorage (fallback)
- **Deploy:** Netlify (`netlify.toml`) ou Vercel (`vercel.json`)

## Estrutura

```
src/
├── components/
│   ├── screens/        # Telas (Home, Warehouse, Trips, Sales, Stores, PlayerMarket, …)
│   └── ui/             # Componentes shadcn/ui
├── hooks/              # useGameLogic, useAuth, usePlayerMarket, …
├── data/               # Produtos, compradores, lojas, dados estáticos
├── types/              # Tipos TypeScript
├── utils/              # Helpers (formatação, preços, riscos, …)
├── integrations/
│   └── supabase/       # Cliente + tipos gerados do Supabase
└── pages/              # Index, Auth, NotFound

supabase/
└── migrations/         # Migrações SQL do banco
```

## Deploy

### Netlify
Conecte o repositório no Netlify — ele detecta o `netlify.toml` automaticamente.
Build command: `npm run build` • Publish dir: `dist`

Via CLI:
```sh
npm install -g netlify-cli
npm run deploy:netlify
```

### Vercel
Conecte o repositório no Vercel — ele detecta o `vercel.json` automaticamente.
Framework: Vite • Build: `npm run build` • Output: `dist`

Via CLI:
```sh
npm install -g vercel
npm run deploy:vercel
```

## Mercado P2P

O jogo inclui um mercado entre jogadores (`PlayerMarketScreen`) com backend real via Supabase. Veja `supabase/migrations/20260419000000_create_player_market_listings.sql` para o schema.
