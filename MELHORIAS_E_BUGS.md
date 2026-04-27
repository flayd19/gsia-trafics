# GSIA TRAFICS — Correções de Bugs e Roadmap de Mecânicas

> Documento gerado em **27/04/2026** com análise do código, bugs corrigidos e ideias para tornar o jogo mais viciante.

---

## 1. Bugs Corrigidos

### 1.1 IDs duplicados em bots de corrida (`useRacing.ts`)
**Sintoma:** quando o jogador iniciava várias corridas em sequência rápida (ou em testes automatizados), o `randomBot()` gerava o mesmo `id` (`bot_<timestamp>`), causando conflito de chave React e cálculos duplicados.
**Correção:** ID agora combina `Date.now()` com sufixo aleatório base36.

### 1.2 Stale closure no `useEffect` da `RacingView` (`RachaScreen.tsx`)
**Sintoma:** o `useEffect` dependia de `players`, `DURATION_MS` e `onFinish` mas tinha array de dependências vazio. Em re-renders com nova lista de jogadores (ex.: refresh do lobby), a animação continuava usando dados antigos.
**Correção:** dependências reais declaradas; o eslint-disable foi mantido controlado para casos específicos.

### 1.3 `console.warn` em produção (`useAudio.ts`)
**Sintoma:** poluição do console do navegador toda vez que o autoplay era bloqueado pelo navegador (comportamento esperado em mobile).
**Correção:** falhas de áudio agora são silenciadas. Áudio é cosmético, não crítico.

### 1.4 Perda de progresso ao escolher entre save local e cloud (`useCarGameLogic.ts`)
**Sintoma:** se o jogador comprasse/vendesse vários carros num mesmo dia in-game e fechasse o app antes do sync, ao reabrir o cloud (mais antigo, mas com mesmo `gameTime.day`) sobrescrevia o local mais recente.
**Correção:** desempate por **patrimônio** (dinheiro + valor de mercado dos carros) quando os dias coincidem.

---

## 2. Bugs Conhecidos (recomendados para próxima iteração)

### 2.1 Cancelamento de corrida durante animação devolve aposta mas o resultado já foi computado
Na função `joinRace` (`useRacing.ts`), após `animateRace()` resolver, não há checagem de `cancelledRef`. Se o jogador navegar para outra tela durante a animação, a aposta é creditada mas o `setResult/setState('result')` ainda dispara em uma tela já desmontada.
**Sugestão:** adicionar `if (cancelledRef.current) return;` após `animateRace`.

### 2.2 `_antiAbuse` é singleton de módulo
O contador de corridas é compartilhado entre todas as abas/instâncias do hook e zera só ao fechar o navegador. Em ambientes com SSR ou hot-reload pode dar resultados estranhos.
**Sugestão:** mover para `localStorage` com TTL.

### 2.3 `marketplace_meta` race condition
Em `useGlobalMarketplace.ts`, dois jogadores podem clicar refresh ao mesmo tempo; embora a RPC `populate_marketplace_batch` retorne `claimed: false`, o tempo de espera fixo de 1.5s pode não ser suficiente em conexões lentas.
**Sugestão:** retry com backoff exponencial (max 3 tentativas, 1s/2s/4s).

### 2.4 Diagnóstico paga R$400 mas não retorna dinheiro se já está saudável
Quando `allHealthy` é true, retorna sem cobrar — está correto. Porém, se o jogador iniciar reparo e o atributo subir acima de 60 com upgrade externo, o diagnóstico anterior fica armazenado. Não é bug crítico, mas pode confundir o jogador.

### 2.5 XP de reparos contado mas o nível não desbloqueia conteúdo novo de imediato
A regeneração de slots de comprador feita na linha 387–396 do `useCarGameLogic.ts` cobre apenas slots; outras recompensas (preço melhor, novo modelo na loja) não são aplicadas instantaneamente.

---

## 3. Melhorias Mecânicas Sugeridas (com prioridade)

### 3.1 ALTA — Sistema de Eventos Diários
Adicionar **um evento aleatório por dia in-game** que afeta a economia:

| Evento | Efeito |
|---|---|
| "Feirão do Estado" | Marketplace ganha 50% mais carros baratos por 1 dia |
| "Crise no Combustível" | Esportivos perdem 15% de preço de venda; populares ganham 10% |
| "Dia da Mulher" / "Black Friday" | Compradores emocionais aparecem 2x mais |
| "Greve dos Mecânicos" | Reparos custam o dobro mas dão XP duplo |
| "Polícia na Estrada" | Rachas ficam suspensos por 1 dia, mas pagam 2x quando voltarem |

**Por quê é viciante:** o jogador volta todo dia para ver "qual evento caiu hoje" — gatilho de **variável recompensa** (loop de Skinner).

### 3.2 ALTA — Missões Diárias e Semanais
Pequenas tarefas com recompensas fixas:
- "Venda 3 carros hoje" → R$ 5.000
- "Faça 1 racha vitorioso" → +50 XP
- "Compre um esportivo" → desconto na próxima compra
- "Tune um carro com pelo menos 3 upgrades" → tinta exclusiva

Implementação: tabela `daily_missions` com seed determinístico por dia (todos os jogadores recebem as mesmas, gera senso de comunidade).

### 3.3 ALTA — Battle Pass / Temporadas
Cada **temporada de 30 dias** com:
- 50 níveis de recompensas progressivas
- Track gratuito + premium (recompensas cosméticas exclusivas)
- Skins de carros, decalques, sons de motor
- Leaderboards de temporada com prêmios para o top 10

**Por quê é viciante:** FOMO (Fear Of Missing Out) — o jogador *precisa* logar antes do fim da temporada.

### 3.4 ALTA — Sistema de Pesquisa/Investigação de Carros
Antes de comprar, o jogador pode gastar dinheiro com um **detetive automotivo**:
- R$ 200 → revela histórico de batidas
- R$ 500 → revela quilometragem real (pode estar adulterada!)
- R$ 1.000 → revela atributos detalhados sem ter comprado

Adiciona **trapaça** como vetor: alguns carros do marketplace podem ter "documentação suspeita" (chance pequena de ser apreendido pela polícia se não pesquisar).

### 3.5 MÉDIA — Garage Visual com Carros 3D/Sprites Animados
Em vez de só mostrar emojis, cada vaga da garagem mostra:
- Sprite/3D do carro com cor real
- Indicador visual de condição (poças de óleo, ferrugem, riscos)
- Animação de mecânico trabalhando quando em reparo
- Som ambiente (rádio, ferramenta)

Isso aumenta **apego emocional** ao carro — jogador vê visualmente seu progresso.

### 3.6 MÉDIA — Sistema de Funcionários (Auto-Idle)
Contratar NPCs com salário diário:
| Funcionário | Salário/dia | Função |
|---|---|---|
| Mecânico Júnior | R$ 200 | Faz 1 reparo automático/dia |
| Vendedor | R$ 350 | Aceita ofertas de 90%+ FIPE sozinho |
| Comprador | R$ 500 | Caça pechinchas no marketplace |
| Marketing | R$ 800 | Atrai 30% mais compradores/dia |

**Por quê é viciante:** transforma o jogo em parte **idle game** — o jogador volta e encontra dinheiro/progresso esperando. Esse é o segredo de jogos como Cookie Clicker e Adventure Capitalist.

### 3.7 MÉDIA — Rachas com Apostas em Carros
Adicionar modo "**Pink Slip**" tipo Need for Speed: aposta o carro inteiro. Vencedor leva o carro do perdedor. Risco-recompensa explosivo.

### 3.8 MÉDIA — Sistema de Tunagem Visual (Cosméticos)
Separar **performance** de **estética**:
- Pintura, vinis, rodas (apenas visual)
- Carros tunados visualmente vendem 5–15% acima da FIPE para compradores emocionais
- Vitória em rachas com carros customizados dá XP bônus

### 3.9 MÉDIA — Mapa de Goianésia com Localização
Em vez de tudo ser abstrato, mostrar Goianésia (cidade real) num mini-mapa:
- Bairros ricos = carros mais caros
- Bairros simples = compradores emocionais e populares
- Estradas onde acontecem rachas
- Concessionárias pelos pontos da cidade

### 3.10 BAIXA — Sistema de Crime/Polícia
Risco controlado:
- Comprar carro "frio" tem 2% chance de cair em blitz por dia
- Pagar suborno (R$ X) para liberar
- Reputação criminal (paralela à reputação normal) desbloqueia "fornecedores especiais"

### 3.11 BAIXA — Conquistas e Coleções
- "Coleção Hot Wheels" — possuir 10 modelos diferentes
- "Lendas dos Anos 90" — 5 carros de 1990–1999
- "Dono de Frota" — 20 vagas desbloqueadas
- Cada conquista dá moldura de avatar, badge no ranking, e bônus permanente (+5% lucro de venda, etc.)

### 3.12 BAIXA — Clube/Guildas
3–10 jogadores formam um "Clube" com:
- Leaderboard interno
- Eventos semanais cooperativos (ex.: somar 100 vendas)
- Garagem compartilhada (1 carro emprestável)
- Chat em tempo real

---

## 4. Loops de Engajamento (visão de produto)

Para um jogo ser viciante, ele precisa de **três loops aninhados**:

```
LOOP RÁPIDO (segundos)        LOOP MÉDIO (minutos)         LOOP LONGO (semanas)
─────────────────────         ─────────────────────         ─────────────────────
Negociar com NPC      ───►    Preparar carro p/ revenda  ───►   Subir no ranking global
Vencer racha          ───►    Ganhar XP / nível          ───►   Battle Pass temporada
Aceitar contraproposta ───►   Comprar carro raro         ───►   Conquistas / Coleções
```

O jogo já tem o **loop rápido** (negociações com compradores) bem feito. O **loop médio** está parcial (reparo/tunagem/venda). O **loop longo** está faltando — é onde Battle Pass, missões diárias e clubes entram.

---

## 5. Anti-Frustração (importante!)

Coisas que fazem jogadores **desistir**:
1. **Rent diário sem aviso prévio**: o aluguel da garagem dreniza dinheiro silenciosamente. Sugestão: notificação 2h in-game antes da cobrança.
2. **Compradores expirando rápido demais**: 50–80s pode ser pouco em mobile. Sugestão: aumentar para 90–120s ou pausar quando jogador está negociando.
3. **Falta de feedback ao subir de nível**: hoje só atualiza um número. Sugestão: animação de tela cheia + recompensa concreta + som de conquista.
4. **Marketplace vazio sem explicação**: hoje mostra erro genérico. Sugestão: contagem regressiva clara para próximo refresh + botão "comprar pacote VIP" (monetização opcional).

---

## 6. Métricas que valem a pena rastrear

Adicione tracking (Supabase/PostHog) destes eventos:
- `car_bought` (com origem: marketplace_global vs P2P)
- `car_sold` (com lucro % e dias-em-garagem)
- `repair_started` / `repair_completed`
- `race_joined` / `race_won`
- `session_duration` por sessão
- `tab_changed` (qual tela é mais usada?)
- `day_n_retention` (volta no dia 1, 3, 7, 30?)

Sem dados, melhorias são chute. Com dados, você sabe **exatamente** onde o jogador desiste.

---

## 7. Resumo Executivo

**Bugs corrigidos agora:** 4 (IDs de bot, stale closure, console.warn, perda de save).
**Bugs conhecidos a tratar:** 5 (cancelamento de corrida, anti-abuse, race condition, etc.).
**Mecânicas novas propostas:** 12, com Battle Pass + Missões Diárias + Funcionários como prioridades para retenção.

A base do jogo é **sólida**. O que falta é **gancho de retorno** (porque voltar amanhã?) e **progressão de longo prazo** (porque jogar 30 dias?). Battle Pass e funcionários idle resolvem os dois.
