/** Local production-build integration checks; never mutates lesson contents. */
import { config } from 'dotenv';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
config({ path: '.env.production.local', quiet: true });
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL });
const base = 'http://localhost:3100';
async function verify() {
  const { rows: [own] } = await pool.query(`select a.id, u.id as user_id, u.name
    from lesson_assignments a join users u on u.id=a.student_id
    where u.role='STUDENT' and not u.access_blocked order by a.created_at desc limit 1`);
  assert(own, 'An assigned lesson is required for read-only checks');
  const token = await new SignJWT({ userId: own.user_id, name: own.name, role: 'STUDENT' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m')
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  const headers = { cookie: `ewv_session=${token}`, 'Content-Type': 'application/json' };
  const post = (input: object, extra = {}) => fetch(`${base}/api/class/live`, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(input) });
  assert.equal((await fetch(`${base}/api/class/live`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"resource":"focus"}' })).status, 401);
  assert.equal((await post({ resource: 'unknown' })).status, 400);
  assert.equal((await post({ resource: 'lesson', id: 'invalid' })).status, 400);
  assert.equal((await post({ resource: 'lesson-state', id: own.id }, { Origin: 'https://other.invalid' })).status, 403);
  const { rows: [other] } = await pool.query('select id from lesson_assignments where student_id <> $1 limit 1', [own.user_id]);
  assert(other, 'A second student assignment is required for isolation checks');
  for (const resource of ['lesson', 'lesson-state']) assert.equal((await post({ resource, id: other.id })).status, 404);
  for (const resource of ['lesson', 'lesson-state']) {
    const start = performance.now();
    const first = await post({ resource, id: own.id });
    assert.equal(first.status, 200);
    const body = await first.text();
    const { data, version } = JSON.parse(body);
    assert(data && version);
    const unchanged = await post({ resource, id: own.id, version });
    assert.equal(unchanged.status, 204);
    assert.equal((await unchanged.text()).length, 0);
    console.log(JSON.stringify({ resource, firstPayloadBytes: Buffer.byteLength(body), unchangedPayloadBytes: 0, roundTripMs: Math.round(performance.now() - start) }));
  }
  console.log('PASS: authentication, same-origin policy, validation, student isolation, full lesson, lightweight state, unchanged response');
}
verify().finally(() => pool.end()).catch((error) => { console.error({ type: error?.name, message: error?.message }); process.exitCode = 1; });
