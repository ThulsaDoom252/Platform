/** Read-only measurements. Never prints credentials or lesson data. */
import { config } from 'dotenv';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

config({ path: '.env.production.local', quiet: true });
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL });
async function measure() {
  const base = process.argv[2] || 'http://localhost:3100';
  if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use the local production build for authenticated measurements');
  const { rows: [teacher] } = await pool.query("select id, name from users where role = 'TEACHER' order by created_at limit 1");
  const token = await new SignJWT({ userId: teacher.id, name: teacher.name, role: 'TEACHER' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m')
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  const paths = process.argv.slice(3);
  for (const path of paths.length ? paths : ['/teacher/students', '/teacher/lessons', '/teacher/activities', '/teacher/homeworks', '/teacher/class', '/teacher/materials']) {
    const samples: number[] = [];
    let bytes = 0;
    let html = '';
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      const response = await fetch(`${base}${path}`, { headers: { cookie: `ewv_session=${token}` }, redirect: 'manual' });
      const body = await response.arrayBuffer();
      if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}`);
      samples.push(Math.round(performance.now() - start));
      bytes = body.byteLength;
      html = new TextDecoder().decode(body);
    }
    const chunks = [...new Set([...html.matchAll(/<script[^>]+src="([^"?]+\.js)(?:\?[^" ]*)?"/g)].map((match) => match[1]))];
    const sizes = chunks.filter((url) => url.startsWith('/_next/static/')).map((url) => {
      const content = readFileSync(`.next/${url.slice('/_next/'.length)}`);
      return { bytes: content.length, gzip: gzipSync(content).length };
    });
    console.log(JSON.stringify({ path, samplesMs: samples, htmlKB: Math.round(bytes / 1024), initialJsKB: Math.round(sizes.reduce((sum, chunk) => sum + chunk.bytes, 0) / 1024), initialJsGzipKB: Math.round(sizes.reduce((sum, chunk) => sum + chunk.gzip, 0) / 1024) }));
  }
}
measure().finally(() => pool.end()).catch((error) => { console.error({ type: error?.name, message: error?.message }); process.exitCode = 1; });
