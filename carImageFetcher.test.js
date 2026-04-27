import { normalizeCarName, generateSearchVariations, isRelevant } from './carImageFetcher.js';

let passed = 0, failed = 0;

function test(desc, fn) {
  try { fn(); console.log(`  OK  ${desc}`); passed++; }
  catch(e) { console.error(`  FAIL ${desc}\n       -> ${e.message}`); failed++; }
}

function expect(actual) {
  return {
    toBe(e)          { if (actual !== e) throw new Error(`Esperado "${e}", recebeu "${actual}"`); },
    toContain(item)  { if (!actual.includes(item)) throw new Error(`Nao contem "${item}": ${JSON.stringify(actual)}`); },
    toBeTrue()       { if (actual !== true)  throw new Error(`Esperado true, recebeu ${actual}`); },
    toBeFalse()      { if (actual !== false) throw new Error(`Esperado false, recebeu ${actual}`); },
    toBeAtLeast(n)   { if (actual < n) throw new Error(`Esperado >= ${n}, recebeu ${actual}`); },
    toBeInRange(a,b) { if (actual < a || actual > b) throw new Error(`Esperado [${a},${b}], recebeu ${actual}`); },
  };
}

// ── NORMALIZACAO ──────────────────────────────────────────────────────────────
// Nota: alias de marca só é expandido se a marca aparecer no input.
// "gol 1.6" → "gol" (sem marca no input = sem marca no output).
// "vw gol 1.6" → "volkswagen gol" (alias "vw " resolvido).
console.log('\n normalizeCarName()');

test('remove motorizacao decimal (1.6)',      () => expect(normalizeCarName('gol 1.6')).toBe('gol'));
test('remove stopword msi',                  () => expect(normalizeCarName('gol g2 msi')).toBe('gol g2'));
test('remove multiplos stopwords',           () => expect(normalizeCarName('gol g2 msi 1.6 flex completo')).toBe('gol g2'));
test('alias vw expande para volkswagen',     () => expect(normalizeCarName('vw gol g2 msi')).toBe('volkswagen gol g2'));
test('alias vw/ expande para volkswagen',    () => expect(normalizeCarName('vw/gol g2')).toBe('volkswagen gol g2'));
test('mantem geracao g2',                    () => expect(normalizeCarName('gol g2 msi').includes('g2')).toBeTrue());
test('mantem geracao mk6',                   () => expect(normalizeCarName('golf mk6 tsi').includes('mk6')).toBeTrue());
test('mantem r34',                           () => expect(normalizeCarName('skyline r34').includes('r34')).toBeTrue());
test('remove ano 4 digitos',                 () => expect(normalizeCarName('civic 2018 touring').includes('2018')).toBeFalse());
test('remove flex',                          () => expect(normalizeCarName('palio flex').includes('flex')).toBeFalse());
test('remove automatico',                    () => expect(normalizeCarName('corolla automatico').includes('automatico')).toBeFalse());
test('remove ltz',                           () => expect(normalizeCarName('s10 ltz diesel').includes('ltz')).toBeFalse());
test('remove tsi',                           () => expect(normalizeCarName('polo tsi highline').includes('tsi')).toBeFalse());
test('remove highline',                      () => expect(normalizeCarName('polo tsi highline').includes('highline')).toBeFalse());
test('vazio retorna vazio',                  () => expect(normalizeCarName('')).toBe(''));
test('undefined retorna vazio',              () => expect(normalizeCarName(undefined)).toBe(''));

// ── VARIACOES ─────────────────────────────────────────────────────────────────
// A função recebe o nome original E o normalizado separadamente —
// o resultado de normalizeCarName() deve ser passado como segundo arg.
console.log('\n generateSearchVariations()');

test('contem nome original',         () => expect(generateSearchVariations('gol g2 msi','volkswagen gol g2')).toContain('gol g2 msi'));
test('contem normalizado',           () => expect(generateSearchVariations('gol g2 msi','volkswagen gol g2')).toContain('volkswagen gol g2'));
test('contem sem marca (gol g2)',    () => expect(generateSearchVariations('gol g2','volkswagen gol g2')).toContain('gol g2'));
test('contem geracao por extenso',   () => expect(generateSearchVariations('gol g2','volkswagen gol g2')).toContain('volkswagen gol geração 2'));
test('contem gen2',                  () => expect(generateSearchVariations('gol g2','volkswagen gol g2')).toContain('volkswagen gol gen2'));
test('sem duplicatas',               () => { const v = generateSearchVariations('gol g2 msi','volkswagen gol g2'); expect(new Set(v).size).toBe(v.length); });
test('pelo menos 4 variacoes',       () => expect(generateSearchVariations('gol g2 msi','volkswagen gol g2').length).toBeAtLeast(4));
test('original vem antes do generico', () => {
  const v = generateSearchVariations('gol g2 msi','volkswagen gol g2');
  const iOrig = v.indexOf('gol g2 msi');
  const iGenr = v.indexOf('gol');
  if (iOrig === -1) throw new Error('original nao encontrado');
  if (iGenr !== -1 && iOrig > iGenr) throw new Error(`original (pos ${iOrig}) deve vir antes do generico (pos ${iGenr})`);
});

// ── FUZZY MATCHING ────────────────────────────────────────────────────────────
console.log('\n isRelevant()');

test('aceita correspondencia exata',       () => expect(isRelevant('volkswagen gol g2','Volkswagen Gol G2 1.0 2001').matches).toBeTrue());
test('aceita titulo com dados extras',     () => expect(isRelevant('volkswagen gol g2','VW Gol G2 1.0 MSI 2000').matches).toBeTrue());
test('rejeita modelo diferente (Corolla)', () => expect(isRelevant('volkswagen gol g2','Toyota Corolla XEi 2020').matches).toBeFalse());
test('aceita Honda Civic EX 2019',         () => expect(isRelevant('honda civic','Honda Civic EX 2019').matches).toBeTrue());
test('aceita Citroen com acento',          () => expect(isRelevant('citroen c3','Citroën C3 Tendance 2019').matches).toBeTrue());
test('rejeita titulo vazio',               () => expect(isRelevant('gol g2','').matches).toBeFalse());
test('score entre 0 e 1',                 () => expect(isRelevant('gol g2','Gol G2 2001').score).toBeInRange(0,1));
test('score exato >= 0.8',                () => expect(isRelevant('volkswagen gol g2','Volkswagen Gol G2').score).toBeAtLeast(0.8));
test('rejeita Onix vs Gol',               () => expect(isRelevant('gol g2','Chevrolet Onix Plus 2023').matches).toBeFalse());
test('aceita HB20S com variacao',         () => expect(isRelevant('hyundai hb20s','Hyundai HB20S Comfort Plus 2021').matches).toBeTrue());
test('aceita Civic Type R FL5',           () => expect(isRelevant('honda civic type r','Honda Civic Type R FL5 2023').matches).toBeTrue());

// ── RELATORIO ─────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${'='.repeat(50)}`);
console.log(` Total: ${total} | OK: ${passed} | FAIL: ${failed}`);
console.log('='.repeat(50) + '\n');
if (failed > 0) process.exit(1);
