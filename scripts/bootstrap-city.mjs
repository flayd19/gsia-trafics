#!/usr/bin/env node
// =====================================================================
// bootstrap-city.mjs
//
// Popula o banco Supabase com os ~4.700 lotes do JSON gerado por
// generate-city-lots.mjs. Faz chamadas RPC chunked pra admin_bootstrap_city.
//
// Uso:
//   ADMIN_PASSWORD=alife1219! node scripts/bootstrap-city.mjs
//
// Variáveis (com defaults para o projeto novo):
//   SUPABASE_URL       — URL do projeto (default: o novo construtora)
//   SUPABASE_ANON_KEY  — anon key
//   ADMIN_PASSWORD     — senha do painel admin
//   CHUNK_SIZE         — quantos lotes por chamada (default 100)
//
// Idempotente: pode rodar de novo, faz upsert.
// =====================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, '..', 'src', 'data', 'goianesia-lots.json');

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  'https://twlcjplhpjkkfvyvohwj.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bGNqcGxocGpra2Z2eXZvaHdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTY5NzksImV4cCI6MjA5MzU3Mjk3OX0.nlmZACUe0Znttx-R2lBnzy8LMVNOUHbDgjpInpsAvnI';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'alife1219!';
const CHUNK_SIZE     = Number(process.env.CHUNK_SIZE || 100);

if (!fs.existsSync(DATA_PATH)) {
  console.error('JSON não encontrado em', DATA_PATH);
  console.error('Rode primeiro: node scripts/generate-city-lots.mjs');
  process.exit(1);
}

const raw  = fs.readFileSync(DATA_PATH, 'utf8');
const data = JSON.parse(raw);

console.log(`[carregando] ${data.lots.length} lotes em ${data.blocks.length} quarteirões`);
console.log(`[supabase]   ${SUPABASE_URL}`);
console.log(`[chunk]      ${CHUNK_SIZE} lotes por chamada\n`);

async function callRpc(blocksChunk, lotsChunk) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/admin_bootstrap_city`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'params=single-object',
    },
    body: JSON.stringify({
      p_admin_password: ADMIN_PASSWORD,
      p_blocks:         blocksChunk,
      p_lots:           lotsChunk,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  let totalLots   = 0;
  let totalBlocks = 0;
  for (let i = 0; i < data.lots.length; i += CHUNK_SIZE) {
    const lotsChunk   = data.lots.slice(i, i + CHUNK_SIZE);
    const blocksChunk = i === 0 ? data.blocks : [];
    const result = await callRpc(blocksChunk, lotsChunk);
    totalLots   += result.lots_upserted   ?? 0;
    totalBlocks += result.blocks_upserted ?? 0;
    process.stdout.write(`\r[progresso] ${Math.min(i + CHUNK_SIZE, data.lots.length)}/${data.lots.length}`);
  }
  console.log(`\n\n✅ Concluído. ${totalLots} lotes e ${totalBlocks} quarteirões enviados.`);
}

main().catch(err => {
  console.error('\n❌ Erro:', err.message);
  console.error('Verifique:');
  console.error('  • A SQL fresh setup foi rodada no projeto?');
  console.error('  • A senha admin está correta?');
  console.error('  • SUPABASE_URL aponta pro projeto novo?');
  process.exit(1);
});
