/**
 * carImageFetcher.js
 * ==================
 * Busca imagens reais de anúncios de veículos via Apify (Webmotors/OLX)
 * e GeckoAPI como fallback, com normalização inteligente de nomes e
 * fuzzy matching para tolerar variações de nomenclatura.
 *
 * DEPENDÊNCIAS:
 *   npm install apify-client node-fetch
 *
 * USO:
 *   import { fetchCarImage } from './carImageFetcher.js';
 *   const result = await fetchCarImage('gol g2 msi');
 *
 * CONFIGURAÇÃO (variáveis de ambiente):
 *   APIFY_TOKEN      — token da conta Apify (https://console.apify.com/account/integrations)
 *   GECKOAPI_KEY     — chave da GeckoAPI (opcional, usado como fallback)
 *   GECKOAPI_BASE    — base URL da GeckoAPI (ex: https://api.geckoapi.com.br)
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  apifyToken:    process.env.APIFY_TOKEN    ?? '',
  geckoApiKey:   process.env.GECKOAPI_KEY   ?? '',
  geckoApiBase:  process.env.GECKOAPI_BASE  ?? 'https://api.geckoapi.com.br',

  // Actor Apify que faz scraping do Webmotors (público na Apify Store)
  // Substitua pelo ID real do actor que você usar:
  //   'drobnikj/webmotors-scraper' — Webmotors
  //   'apify/web-scraper'          — genérico
  webmotorsActorId: process.env.APIFY_ACTOR_ID ?? 'drobnikj/webmotors-scraper',

  // Máximo de itens retornados por busca na API
  maxResults: 5,

  // Timeout por tentativa de busca (ms)
  timeoutMs: 15_000,
};

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZAÇÃO DE NOME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Termos que não ajudam na busca e devem ser removidos.
 * Cobre motorizações, combustíveis, acabamentos e siglas de versão.
 */
const STOPWORDS = new Set([
  // Motorizações
  '1.0', '1.4', '1.6', '1.8', '2.0', '2.4', '2.5', '3.0', '3.5',
  '1000', '1400', '1600', '1800',
  // Combustíveis
  'flex', 'gasolina', 'etanol', 'diesel', 'gnv', 'híbrido', 'elétrico',
  // Transmissão
  'manual', 'automático', 'automatico', 'cvt', 'dct', 'tiptronic',
  // Acabamentos / siglas de versão (variam por montadora)
  'msi', 'tsi', 'tdi', 'gdi', 'fsi', 'tfsi', 'crdi', 'vvti', 'vtec',
  'ltz', 'ltz+', 'lt', 'ls', 'lx', 'ex', 'sx', 'se', 'sel',
  'premium', 'sport', 'urban', 'active', 'style', 'elite',
  'limited', 'exclusive', 'adventure', 'trailhawk',
  'highline', 'comfortline', 'trendline', 'sportline',
  'r-line', 'rline',
  // Adjetivos comuns em anúncios
  'completo', 'único', 'unico', 'novo', 'impecável', 'impecavel',
  'revisado', 'financiado', 'ipva', 'pago', 'novíssimo', 'novissimo',
  // Unidades e drivetrain
  'cv', 'hp', 'km', 'kms', '4x4', '4x2', 'awd', 'fwd', 'rwd', '4wd',
  'abs', 'airbag', 'ar', 'condicionado',
  // Carroceria (raramente útil na busca)
  'sedan', 'hatch', 'suv', 'pickup', 'cabine', 'dupla',
]);

/**
 * Aliases de marca/modelo — mapeamento da esquerda para a forma canônica.
 * Ordenados por tamanho para evitar substituições parciais erradas.
 */
const ALIASES = new Map(Object.entries({
  'vw/':          'volkswagen ',
  'vw ':          'volkswagen ',
  'gm ':          'chevrolet ',
  'benz ':        'mercedes-benz ',
  'merc ':        'mercedes-benz ',
  'mb ':          'mercedes-benz ',
  'fca ':         'fiat ',
  'hrv':          'hr-v',
}));

/**
 * Normaliza o nome bruto de um veículo:
 * 1. Lowercase e trim
 * 2. Resolve aliases de marca
 * 3. Remove stopwords token a token
 * 4. Remove tokens puramente numéricos de 4+ dígitos (anos)
 * 5. Colapsa espaços
 *
 * @param {string} rawName - Ex: "Gol G2 MSI 1.6 Flex Completo"
 * @returns {string}       - Ex: "volkswagen gol g2"
 */
export function normalizeCarName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';

  let name = rawName.toLowerCase().trim();

  // Resolve aliases (maior string primeiro para evitar conflitos)
  const sortedAliases = [...ALIASES.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [alias, canonical] of sortedAliases) {
    if (name.includes(alias)) {
      name = name.replace(alias, canonical);
    }
  }

  // Tokeniza por espaço/hífen/barra
  const tokens = name.split(/[\s/]+/).filter(Boolean);

  const kept = tokens.filter(token => {
    if (!token) return false;

    // Remove stopwords exatas
    if (STOPWORDS.has(token)) return false;

    // Remove anos com 4 dígitos (2001, 2024...) — mas mantém gerações alfanuméricas (g2, mk6, r34)
    if (/^\d{4,}$/.test(token)) return false;

    // Remove tokens só-numéricos curtos (soltos, não parte de versão)
    if (/^\d{1,3}$/.test(token)) return false;

    return true;
  });

  return kept.join(' ').replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIAÇÕES DE BUSCA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marcas reconhecidas — usadas para criar variação "sem marca".
 */
const KNOWN_BRANDS = new Set([
  'volkswagen', 'fiat', 'chevrolet', 'ford', 'toyota', 'honda',
  'hyundai', 'kia', 'nissan', 'renault', 'jeep', 'peugeot',
  'citroën', 'citroen', 'mitsubishi', 'subaru', 'audi', 'bmw',
  'mercedes-benz', 'volvo', 'porsche', 'land', 'range', 'chery',
]);

/**
 * Gera variações de busca do mais específico para o mais genérico.
 * A busca tenta cada variação em ordem até encontrar resultado.
 *
 * @param {string} originalRaw  - Nome original (ex: "gol g2 msi")
 * @param {string} normalized   - Normalizado  (ex: "volkswagen gol g2")
 * @returns {string[]}
 */
export function generateSearchVariations(originalRaw, normalized) {
  const variations = [];
  const seen = new Set();

  const add = (v) => {
    const clean = v.trim().toLowerCase().replace(/\s+/g, ' ');
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      variations.push(clean);
    }
  };

  // 1. Nome original limpo (mais específico)
  add(originalRaw.toLowerCase().trim());

  // 2. Normalizado completo
  add(normalized);

  // 3. Progressão de tokens: remove último token a cada passo
  const tokens = normalized.split(' ');
  for (let i = tokens.length - 1; i >= 2; i--) {
    add(tokens.slice(0, i).join(' '));
  }

  // 4. Geração por extenso: "g2" → "geração 2" e "gen2"
  const genMatch = normalized.match(/\bg(\d)\b/);
  if (genMatch) {
    add(normalized.replace(/\bg\d\b/, `geração ${genMatch[1]}`));
    add(normalized.replace(/\bg\d\b/, `gen${genMatch[1]}`));
    // Também sem a marca, com geração por extenso
    if (KNOWN_BRANDS.has(tokens[0])) {
      add(tokens.slice(1).join(' ').replace(/\bg\d\b/, `geração ${genMatch[1]}`));
    }
  }

  // 5. Sem a marca (só modelo + geração)
  if (tokens.length >= 2 && KNOWN_BRANDS.has(tokens[0])) {
    add(tokens.slice(1).join(' '));
  }

  // 6. Apenas os dois primeiros tokens (marca + modelo base)
  if (tokens.length > 2) {
    add(tokens.slice(0, 2).join(' '));
  }

  // 7. Só o modelo base (segundo token, se houver marca)
  if (tokens.length >= 2 && KNOWN_BRANDS.has(tokens[0])) {
    add(tokens[1]);
  }

  return variations;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUZZY MATCHING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Similaridade Jaro-Winkler entre duas strings.
 * Retorna 0 (nenhuma) a 1 (idêntico).
 *
 * @param {string} s1
 * @param {string} s2
 * @returns {number}
 */
function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDist  = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches  = new Array(len1).fill(false);
  const s2Matches  = new Array(len2).fill(false);
  let matches      = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end   = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Bônus de prefixo (Winkler)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Verifica se o título do anúncio é relevante para o termo buscado.
 *
 * Estratégia:
 * - Tokeniza busca e título
 * - Para cada token da busca, procura o melhor match no título
 * - Aceita se ≥ 60% dos tokens importantes tiverem similaridade ≥ 0.8
 *
 * @param {string} searchTerm   - Ex: "volkswagen gol g2"
 * @param {string} adTitle      - Ex: "VW Gol G2 1.0 2001"
 * @param {number} [threshold]  - Similaridade mínima, padrão 0.82
 * @returns {{ matches: boolean, score: number }}
 */
export function isRelevant(searchTerm, adTitle, threshold = 0.82) {
  if (!adTitle) return { matches: false, score: 0 };

  // Remove acentos para comparação mais robusta
  const normalize = (s) =>
    s.toLowerCase()
     .normalize('NFD')
     .replace(/[̀-ͯ]/g, '')
     .replace(/[^a-z0-9\s]/g, ' ');

  const searchTokens = normalize(searchTerm).split(/\s+/).filter(t => t.length > 1);
  const titleTokens  = normalize(adTitle).split(/\s+/).filter(Boolean);

  if (searchTokens.length === 0) return { matches: false, score: 0 };

  let matched = 0;

  for (const st of searchTokens) {
    // Tokens muito curtos (preposições, artigos) — não pesam
    if (st.length <= 2) { matched++; continue; }

    const bestScore = Math.max(...titleTokens.map(tt => jaroWinkler(st, tt)));
    if (bestScore >= threshold) matched++;
  }

  const score = matched / searchTokens.length;
  return { matches: score >= 0.6, score };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO DE URL DE IMAGEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica se uma URL de imagem é válida fazendo um HEAD request.
 *
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function isImageUrlValid(url) {
  if (!url || typeof url !== 'string') return false;

  // Extensões de imagem aceitas
  if (!/\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(url)) return false;

  // Rejeita placeholders e logos genéricos
  const blocklist = ['placeholder', 'logo', 'default', 'no-image', 'sem-foto', 'noimage', 'semfoto'];
  if (blocklist.some(b => url.toLowerCase().includes(b))) return false;

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);

    const resp = await fetch(url, {
      method:  'HEAD',
      signal:  ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CarImageBot/1.0)' },
    });
    clearTimeout(timer);

    const ct = resp.headers.get('content-type') ?? '';
    return resp.ok && ct.startsWith('image/');
  } catch {
    return false;
  }
}

/**
 * Filtra e retorna a primeira URL de imagem válida de uma lista.
 * Testa em paralelo, mas respeita a ordem de prioridade original.
 * Prefere imagens com indicadores de boa qualidade na URL.
 *
 * @param {string[]} urls
 * @returns {Promise<string|null>}
 */
export async function pickBestImage(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return null;

  const candidates = urls.slice(0, 8); // testa no máximo 8

  const results = await Promise.all(
    candidates.map(url =>
      isImageUrlValid(url).then(ok => ({ url, ok }))
    )
  );

  const valid = results.filter(r => r.ok);
  if (valid.length === 0) return null;

  // Heurística: URLs com indicadores de tamanho grande são preferidas
  const preferLarge = valid.find(r =>
    /large|full|1200|900|800|original|big/i.test(r.url)
  );

  return (preferLarge ?? valid[0]).url;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRAÇÃO APIFY — WEBMOTORS SCRAPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca anúncios de veículos no Webmotors via Apify.
 *
 * O actor recebe uma query de texto e retorna uma lista de anúncios.
 * Ajuste as chaves de `input` conforme o actor real que você usar.
 *
 * @param {string} query       - Ex: "volkswagen gol g2"
 * @param {string} searchTerm  - Termo normalizado para o filtro de relevância
 * @returns {Promise<{titulo: string, imagem_url: string}|null>}
 */
async function searchViaApify(query, searchTerm) {
  if (!CONFIG.apifyToken) {
    throw new Error('APIFY_TOKEN não configurado. Defina a variável de ambiente.');
  }

  // Import dinâmico — apify-client é opcional
  const { ApifyClient } = await import('apify-client').catch(() => {
    throw new Error('apify-client não instalado. Execute: npm install apify-client');
  });

  const client = new ApifyClient({ token: CONFIG.apifyToken });

  // ── Inicia o actor e aguarda conclusão ───────────────────────────
  const run = await client.actor(CONFIG.webmotorsActorId).call(
    {
      // Parâmetros comuns de actors de scraping de marketplace.
      // Ajuste os nomes das chaves conforme o actor específico.
      searchQuery:   query,
      search:        query,      // alias comum
      keyword:       query,      // alias comum
      maxResults:    CONFIG.maxResults,
      maxItems:      CONFIG.maxResults,
      includePhotos: true,
      withImages:    true,
    },
    {
      timeoutSecs:  CONFIG.timeoutMs / 1_000,
      memoryMbytes: 512,
    }
  );

  // ── Lê os itens do dataset gerado pela execução ───────────────────
  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: CONFIG.maxResults });

  if (!items || items.length === 0) return null;

  // ── Filtra por relevância e extrai melhor imagem ──────────────────
  for (const item of items) {
    // Normaliza campos de título (cada actor pode usar nomes diferentes)
    const title  = item.title ?? item.titulo ?? item.name ?? item.descricao ?? '';

    // Normaliza campos de imagens (array de strings ou array de objetos)
    const rawPhotos = item.photos ?? item.fotos ?? item.images ?? item.imagens ?? [];
    const urls = rawPhotos.map(p =>
      typeof p === 'string' ? p : (p.url ?? p.src ?? p.href ?? '')
    ).filter(Boolean);

    const { matches } = isRelevant(searchTerm, title);
    if (!matches) {
      continue;
    }

    const bestImg = await pickBestImage(urls);
    if (!bestImg) continue;

    return { titulo: title, imagem_url: bestImg };
  }

  return null; // nenhum resultado relevante com imagem válida
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRAÇÃO GECKOAPI — FALLBACK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca anúncios via GeckoAPI.
 *
 * Endpoints assumidos (ajuste à documentação real):
 *   GET {BASE}/v1/veiculos/buscar?q={query}&limit=5&com_fotos=true
 *   Authorization: Bearer {KEY}
 *
 * Resposta esperada: { results: [ { titulo, fotos: [string] } ] }
 * ou array direto:   [ { titulo, fotos: [string] } ]
 *
 * @param {string} query
 * @param {string} searchTerm
 * @returns {Promise<{titulo: string, imagem_url: string}|null>}
 */
async function searchViaGeckoAPI(query, searchTerm) {
  if (!CONFIG.geckoApiKey) {
    throw new Error('GECKOAPI_KEY não configurado. Defina a variável de ambiente.');
  }

  const endpoint = new URL(`${CONFIG.geckoApiBase}/v1/veiculos/buscar`);
  endpoint.searchParams.set('q',         query);
  endpoint.searchParams.set('limit',     String(CONFIG.maxResults));
  endpoint.searchParams.set('com_fotos', 'true');

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.timeoutMs);

  let resp;
  try {
    resp = await fetch(endpoint.toString(), {
      headers: {
        'Authorization': `Bearer ${CONFIG.geckoApiKey}`,
        'Accept':        'application/json',
        'User-Agent':    'CarImageFetcher/1.0',
      },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '(sem corpo)');
    throw new Error(`GeckoAPI HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }

  const data = await resp.json();

  // Suporta { results: [] }, { veiculos: [] } ou array direto []
  const items = Array.isArray(data)
    ? data
    : (data.results ?? data.veiculos ?? data.data ?? []);

  for (const item of items) {
    const title    = item.titulo ?? item.title ?? item.descricao ?? '';
    const rawFotos = item.fotos  ?? item.photos ?? item.imagens  ?? [];
    const urls     = rawFotos.map(f =>
      typeof f === 'string' ? f : (f.url ?? f.src ?? '')
    ).filter(Boolean);

    const { matches } = isRelevant(searchTerm, title);
    if (!matches) continue;

    const bestImg = await pickBestImage(urls);
    if (!bestImg) continue;

    return { titulo: title, imagem_url: bestImg };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORQUESTRADOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca a melhor imagem de um veículo tentando múltiplas variações de nome
 * e múltiplas fontes (Apify → GeckoAPI), na ordem configurada.
 *
 * @param {string} carName - Nome bruto do veículo
 * @returns {Promise<{
 *   nome_original:     string,
 *   nome_normalizado:  string,
 *   nome_usado_busca:  string,
 *   titulo_encontrado: string,
 *   imagem_url:        string,
 *   fonte:             'apify'|'geckoapi',
 * }>}
 */
export async function fetchCarImage(carName) {
  if (!carName || typeof carName !== 'string') {
    throw new TypeError('fetchCarImage: carName deve ser uma string não vazia.');
  }

  // ── 1. Normalizar ────────────────────────────────────────────────
  const normalized = normalizeCarName(carName);
  if (!normalized) {
    throw new Error(`Não foi possível normalizar: "${carName}"`);
  }

  // ── 2. Gerar variações do mais específico para o mais genérico ───
  const variations = generateSearchVariations(carName, normalized);

  console.log(`\n[fetchCarImage] Entrada:    "${carName}"`);
  console.log(`[fetchCarImage] Normalizado: "${normalized}"`);
  console.log(`[fetchCarImage] Variações (${variations.length}):`);
  variations.forEach((v, i) => console.log(`  ${i + 1}. "${v}"`));

  // ── 3. Fontes disponíveis (ordem de prioridade) ──────────────────
  // Uma fonte só é tentada se tiver credenciais configuradas.
  const sources = [
    { nome: 'apify',    fn: searchViaApify,    hasKey: () => !!CONFIG.apifyToken  },
    { nome: 'geckoapi', fn: searchViaGeckoAPI, hasKey: () => !!CONFIG.geckoApiKey },
  ];

  const erros = [];

  // ── 4. Loop: variação × fonte ────────────────────────────────────
  for (const variation of variations) {
    for (const source of sources) {
      if (!source.hasKey()) continue; // pula fonte sem credencial

      try {
        console.log(`[fetchCarImage] → "${variation}" via ${source.nome}...`);

        const resultado = await source.fn(variation, normalized);

        if (resultado) {
          console.log(`[fetchCarImage] ✅ Encontrado! Título: "${resultado.titulo}"`);

          return {
            nome_original:     carName,
            nome_normalizado:  normalized,
            nome_usado_busca:  variation,
            titulo_encontrado: resultado.titulo,
            imagem_url:        resultado.imagem_url,
            fonte:             source.nome,
          };
        }

        console.log(`[fetchCarImage]    Sem resultado relevante.`);
      } catch (err) {
        const msg = `${source.nome}/"${variation}": ${err.message}`;
        erros.push(msg);
        console.warn(`[fetchCarImage] ⚠️  ${msg}`);
      }
    }
  }

  // ── 5. Nenhuma tentativa funcionou ───────────────────────────────
  const detalhe = erros.length > 0
    ? `\nErros:\n  ${erros.join('\n  ')}`
    : '\n(Nenhuma credencial configurada ou nenhum resultado encontrado)';

  throw new Error(
    `Nenhuma imagem encontrada para "${carName}" após ${variations.length} variações.${detalhe}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUÇÃO DIRETA (CLI)
//   node carImageFetcher.js "gol g2 msi"
// ─────────────────────────────────────────────────────────────────────────────

// Detecta se está sendo executado diretamente (ESM)
const isMain = process.argv[1]?.endsWith('carImageFetcher.js');

if (isMain) {
  const input = process.argv[2] ?? 'gol g2 msi';

  fetchCarImage(input)
    .then(result => {
      console.log('\n✅ Resultado final:');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(err => {
      console.error('\n❌ Erro:', err.message);
      process.exit(1);
    });
}
