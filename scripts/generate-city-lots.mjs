#!/usr/bin/env node
// =====================================================================
// generate-city-lots.mjs
//
// Gera src/data/goianesia-lots.json — dados geográficos da cidade
// para o jogo de compra/venda/construção de lotes.
//
// Modos:
//   node scripts/generate-city-lots.mjs              # procedural (default)
//   node scripts/generate-city-lots.mjs --osm        # baixa de Overpass
//
// Procedural gera ~2000 lotes em quarteirões dispostos numa elipse
// inspirada em Goianésia (centro, GO-080, parques NW e W, Jardim
// Esperança SE, Clube Campestre S). Não é geograficamente preciso,
// mas tem distribuição parecida e roda em qualquer ambiente.
//
// Modo OSM pega dados reais do OpenStreetMap via Overpass API. Requer
// internet com acesso a overpass-api.de. Útil quando você quiser
// substituir os dados procedurais por dados reais (commit o JSON novo).
// =====================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(__dirname, '..', 'src', 'data', 'goianesia-lots.json');

// ── Geografia base de Goianésia (GO) ─────────────────────────────────
const CITY_CENTER  = [-49.1167, -15.3169]; // [lng, lat] aproximado
const URBAN_RX_DEG = 0.0145;   // raio E-W em graus  (~1.55 km)
const URBAN_RY_DEG = 0.0118;   // raio N-S em graus  (~1.31 km)

// Conversões aproximadas em -15° lat
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG = 107_086;

// Tamanho dos quarteirões e lotes
const BLOCK_W_M       = 110; // largura
const BLOCK_H_M       = 90;  // altura
const STREET_WIDTH_M  = 14;  // entre quarteirões
const LOTS_PER_ROW    = 5;
const LOT_ROWS        = 2;

// Áreas especiais (não viram quarteirões — viram parques/clubes)
const SPECIAL_AREAS = [
  // Parque Araguaia (NW) — elipse pequena
  { name: 'Parque Araguaia',     type: 'park',   center: [-49.1240, -15.3055], rx: 0.0030, ry: 0.0025 },
  // Parque das Palmeiras (W)
  { name: 'Parque das Palmeiras', type: 'park',  center: [-49.1280, -15.3155], rx: 0.0025, ry: 0.0020 },
  // Clube Campestre (S)
  { name: 'Clube Campestre',      type: 'club',  center: [-49.1170, -15.3315], rx: 0.0020, ry: 0.0015 },
];

// Bairros / regiões para etiquetar lotes
const NEIGHBORHOODS = [
  { name: 'Centro',           center: [-49.1167, -15.3169], radius: 0.0050 },
  { name: 'Covoá',            center: [-49.1265, -15.3090], radius: 0.0050 },
  { name: 'Jardim Esperança', center: [-49.1090, -15.3245], radius: 0.0055 },
  { name: 'Vila Norte',       center: [-49.1130, -15.3060], radius: 0.0055 },
  { name: 'Setor Oeste',      center: [-49.1240, -15.3210], radius: 0.0055 },
  { name: 'Setor Sul',        center: [-49.1180, -15.3270], radius: 0.0050 },
];

// Rodovia GO-080 (corta a cidade em diagonal, NE → SW)
const HIGHWAY_GO080 = {
  name: 'GO-080',
  type: 'trunk',
  path: [
    [-49.0950, -15.3030],
    [-49.1050, -15.3110],
    [-49.1170, -15.3185],
    [-49.1290, -15.3265],
    [-49.1390, -15.3340],
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────
const blockWDeg  = BLOCK_W_M       / M_PER_DEG_LNG;
const blockHDeg  = BLOCK_H_M       / M_PER_DEG_LAT;
const streetWDeg = STREET_WIDTH_M  / M_PER_DEG_LNG;
const streetHDeg = STREET_WIDTH_M  / M_PER_DEG_LAT;

function inEllipse(dx, dy, rx, ry) {
  return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
}

function inSpecialArea(lng, lat) {
  for (const a of SPECIAL_AREAS) {
    const dx = lng - a.center[0];
    const dy = lat - a.center[1];
    if (inEllipse(dx, dy, a.rx, a.ry)) return a;
  }
  return null;
}

function neighborhoodFor(lng, lat) {
  let best = null;
  let bestDist = Infinity;
  for (const n of NEIGHBORHOODS) {
    const dx = lng - n.center[0];
    const dy = lat - n.center[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= n.radius && dist < bestDist) {
      best = n.name;
      bestDist = dist;
    }
  }
  return best ?? 'Periferia';
}

// Subdivide um quarteirão (4 cantos) em N lotes em grid LOTS_PER_ROW x LOT_ROWS
function subdivideBlock(block, blockId) {
  const [bl, br, tr, tl] = block.polygon; // bottom-left, bottom-right, top-right, top-left
  const lots = [];

  for (let row = 0; row < LOT_ROWS; row++) {
    for (let col = 0; col < LOTS_PER_ROW; col++) {
      const t0 = col / LOTS_PER_ROW;
      const t1 = (col + 1) / LOTS_PER_ROW;
      const r0 = row / LOT_ROWS;
      const r1 = (row + 1) / LOT_ROWS;

      // Interpolação bilinear
      const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const bot0 = lerp(bl, br, t0);
      const bot1 = lerp(bl, br, t1);
      const top0 = lerp(tl, tr, t0);
      const top1 = lerp(tl, tr, t1);

      const p0 = lerp(bot0, top0, r0);
      const p1 = lerp(bot1, top1, r0);
      const p2 = lerp(bot1, top1, r1);
      const p3 = lerp(bot0, top0, r1);

      lots.push({
        id:        `${blockId}_l${row}${col}`,
        block_id:  blockId,
        polygon:   [p0, p1, p2, p3].map(p => [round6(p[0]), round6(p[1])]),
      });
    }
  }
  return lots;
}

function round6(n) { return Math.round(n * 1e6) / 1e6; }

function polygonAreaM2(polygon) {
  // Aproximação: converte coords pra metros locais e usa shoelace
  const [cx, cy] = polygon[0];
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const ax = (a[0] - cx) * M_PER_DEG_LNG;
    const ay = (a[1] - cy) * M_PER_DEG_LAT;
    const bx = (b[0] - cx) * M_PER_DEG_LNG;
    const by = (b[1] - cy) * M_PER_DEG_LAT;
    area += ax * by - bx * ay;
  }
  return Math.abs(area) / 2;
}

// Preço base do lote (R$): função do bairro + área + ruído.
function lotBasePrice(neighborhood, areaM2) {
  // Multiplicador por bairro (modulação de preço)
  const NEIGHBORHOOD_MULT = {
    'Centro':           1.45,
    'Covoá':            0.85,
    'Jardim Esperança': 0.95,
    'Vila Norte':       0.90,
    'Setor Oeste':      1.00,
    'Setor Sul':        0.90,
    'Periferia':        0.75,
  };
  const mult = NEIGHBORHOOD_MULT[neighborhood] ?? 0.80;
  // R$ por m² na faixa popular brasileira (~R$200-600/m² em cidades médias)
  const pricePerM2 = 320 * mult;
  // Pequena variação aleatória ±15 %
  const noise = 0.85 + Math.random() * 0.30;
  const raw = areaM2 * pricePerM2 * noise;
  // Arredonda em múltiplos de R$ 500 para preços "comerciais"
  return Math.round(raw / 500) * 500;
}

// ── Geração procedural de quarteirões ────────────────────────────────
function generateProcedural() {
  const blocks = [];
  const lots   = [];
  const parks  = SPECIAL_AREAS.filter(a => a.type === 'park').map((a, i) => ({
    id:   `park_${i}`,
    name: a.name,
    polygon: ellipsePolygon(a.center, a.rx, a.ry, 24),
  }));
  const clubs = SPECIAL_AREAS.filter(a => a.type === 'club').map((a, i) => ({
    id:   `club_${i}`,
    name: a.name,
    polygon: ellipsePolygon(a.center, a.rx, a.ry, 24),
  }));

  // Streets como uma grade implícita (a partir das bordas dos blocks).
  // Vou anotar as ruas principais separadamente: principais N-S e E-W
  // que cruzam o centro.
  const streets = [];
  const stepX = blockWDeg + streetWDeg;
  const stepY = blockHDeg + streetHDeg;

  // Origem da grade: aproximadamente 1 raio antes do centro
  const startLng = CITY_CENTER[0] - URBAN_RX_DEG - blockWDeg;
  const startLat = CITY_CENTER[1] - URBAN_RY_DEG - blockHDeg;
  const endLng   = CITY_CENTER[0] + URBAN_RX_DEG + blockWDeg;
  const endLat   = CITY_CENTER[1] + URBAN_RY_DEG + blockHDeg;

  // Constrói quarteirões dentro da elipse urbana
  let blockIdx = 0;
  for (let lat = startLat; lat <= endLat; lat += stepY) {
    for (let lng = startLng; lng <= endLng; lng += stepX) {
      const cx = lng + blockWDeg / 2;
      const cy = lat + blockHDeg / 2;
      // Dentro da elipse urbana?
      const dx = cx - CITY_CENTER[0];
      const dy = cy - CITY_CENTER[1];
      if (!inEllipse(dx, dy, URBAN_RX_DEG, URBAN_RY_DEG)) continue;
      // Não colide com área especial?
      if (inSpecialArea(cx, cy)) continue;

      const id = `b${blockIdx.toString().padStart(4, '0')}`;
      blockIdx++;
      const polygon = [
        [round6(lng),              round6(lat)             ],
        [round6(lng + blockWDeg),  round6(lat)             ],
        [round6(lng + blockWDeg),  round6(lat + blockHDeg) ],
        [round6(lng),              round6(lat + blockHDeg) ],
      ];
      const block = {
        id,
        polygon,
        neighborhood: neighborhoodFor(cx, cy),
      };
      blocks.push(block);

      // Subdivide em lotes
      const blockLots = subdivideBlock(block, id);
      for (const l of blockLots) {
        const area = polygonAreaM2(l.polygon);
        const lc = centroid(l.polygon);
        const nb = neighborhoodFor(lc[0], lc[1]);
        lots.push({
          id:           l.id,
          block_id:     l.block_id,
          polygon:      l.polygon,
          area_m2:      Math.round(area),
          neighborhood: nb,
          base_price:   lotBasePrice(nb, area),
        });
      }
    }
  }

  // Streets: colhe das bordas dos quarteirões (grade implícita)
  // Para fins visuais, gero linhas horizontais e verticais que cobrem a área urbana.
  for (let lat = startLat - streetHDeg / 2; lat <= endLat; lat += stepY) {
    streets.push({
      id:   `s_h_${streets.length}`,
      type: 'residential',
      path: [
        [round6(CITY_CENTER[0] - URBAN_RX_DEG - blockWDeg), round6(lat)],
        [round6(CITY_CENTER[0] + URBAN_RX_DEG + blockWDeg), round6(lat)],
      ],
    });
  }
  for (let lng = startLng - streetWDeg / 2; lng <= endLng; lng += stepX) {
    streets.push({
      id:   `s_v_${streets.length}`,
      type: 'residential',
      path: [
        [round6(lng), round6(CITY_CENTER[1] - URBAN_RY_DEG - blockHDeg)],
        [round6(lng), round6(CITY_CENTER[1] + URBAN_RY_DEG + blockHDeg)],
      ],
    });
  }

  return {
    city: 'Goianésia',
    state: 'GO',
    generatedAt: new Date().toISOString(),
    mode: 'procedural',
    bbox: {
      minLng: round6(CITY_CENTER[0] - URBAN_RX_DEG - blockWDeg),
      minLat: round6(CITY_CENTER[1] - URBAN_RY_DEG - blockHDeg),
      maxLng: round6(CITY_CENTER[0] + URBAN_RX_DEG + blockWDeg),
      maxLat: round6(CITY_CENTER[1] + URBAN_RY_DEG + blockHDeg),
    },
    cityCenter: CITY_CENTER,
    blocks,
    lots,
    streets,
    parks,
    clubs,
    highways: [HIGHWAY_GO080],
    neighborhoods: NEIGHBORHOODS.map(n => ({ name: n.name, center: n.center })),
  };
}

function ellipsePolygon([cx, cy], rx, ry, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([round6(cx + Math.cos(a) * rx), round6(cy + Math.sin(a) * ry)]);
  }
  return pts;
}

function centroid(polygon) {
  let cx = 0, cy = 0;
  for (const [x, y] of polygon) { cx += x; cy += y; }
  return [cx / polygon.length, cy / polygon.length];
}

// ── Modo OSM (Overpass API) ─────────────────────────────────────────
async function generateFromOSM() {
  const bbox = {
    minLng: CITY_CENTER[0] - URBAN_RX_DEG,
    minLat: CITY_CENTER[1] - URBAN_RY_DEG,
    maxLng: CITY_CENTER[0] + URBAN_RX_DEG,
    maxLat: CITY_CENTER[1] + URBAN_RY_DEG,
  };
  const bboxStr = `${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`;
  const query = `
    [out:json][timeout:60];
    (
      way[highway](${bboxStr});
      way[leisure=park](${bboxStr});
      way[landuse=residential](${bboxStr});
      relation[boundary=administrative]["name"="Goianésia"];
    );
    out body;
    >;
    out skel qt;
  `;
  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
  // eslint-disable-next-line no-console
  console.log('[osm] fetching', url.length, 'bytes-encoded url');
  const res = await fetch(url);
  if (!res.ok) throw new Error('Overpass HTTP ' + res.status);
  const data = await res.json();
  // eslint-disable-next-line no-console
  console.log('[osm] elementos recebidos:', data.elements.length);

  // Implementação OSM completa requer:
  //  - extrair nodes (points), ways (linhas/polígonos), relations
  //  - identificar polígonos fechados de quarteirões via faces da malha de ruas
  //  - subdividir em lotes
  // Por concisão, este modo gera o JSON com ruas/parques REAIS mas mantém
  // os QUARTEIRÕES e LOTES do modo procedural. Substitua isso conforme
  // sua necessidade refinar a precisão.
  const procedural = generateProcedural();
  procedural.mode = 'osm-hybrid';
  procedural.streets = extractStreets(data);
  procedural.parks   = extractParks(data);
  return procedural;
}

function extractStreets(osmData) {
  const nodes = new Map();
  for (const el of osmData.elements) {
    if (el.type === 'node') nodes.set(el.id, [el.lon, el.lat]);
  }
  const streets = [];
  for (const el of osmData.elements) {
    if (el.type === 'way' && el.tags?.highway) {
      const path = el.nodes.map(id => nodes.get(id)).filter(Boolean);
      if (path.length < 2) continue;
      streets.push({
        id:   `s_${el.id}`,
        name: el.tags.name ?? null,
        type: el.tags.highway,
        path: path.map(p => [round6(p[0]), round6(p[1])]),
      });
    }
  }
  return streets;
}

function extractParks(osmData) {
  const nodes = new Map();
  for (const el of osmData.elements) {
    if (el.type === 'node') nodes.set(el.id, [el.lon, el.lat]);
  }
  const parks = [];
  for (const el of osmData.elements) {
    if (el.type === 'way' && (el.tags?.leisure === 'park' || el.tags?.landuse === 'recreation_ground')) {
      const polygon = el.nodes.map(id => nodes.get(id)).filter(Boolean);
      if (polygon.length < 3) continue;
      parks.push({
        id:      `p_${el.id}`,
        name:    el.tags.name ?? 'Parque',
        polygon: polygon.map(p => [round6(p[0]), round6(p[1])]),
      });
    }
  }
  return parks;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const useOsm = process.argv.includes('--osm');

  let data;
  if (useOsm) {
    // eslint-disable-next-line no-console
    console.log('[modo] OSM (Overpass API)');
    data = await generateFromOSM();
  } else {
    // eslint-disable-next-line no-console
    console.log('[modo] procedural');
    data = generateProcedural();
  }

  // Garante que o diretório existe
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 0)); // compact

  const summary = {
    blocks:  data.blocks.length,
    lots:    data.lots.length,
    streets: data.streets.length,
    parks:   data.parks.length,
    bbox:    data.bbox,
  };
  // eslint-disable-next-line no-console
  console.log('[ok]', OUTPUT);
  // eslint-disable-next-line no-console
  console.log(summary);
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('Erro:', err);
  process.exit(1);
});
  process.exit(1);
});
