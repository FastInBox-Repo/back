#!/usr/bin/env node
// Dependency-free release smoke test for the FastInBox API.
// Uses Node's global fetch (Node 18+/22). Requires a running server.
//
// Usage:
//   BASE_URL=http://localhost:4001 node scripts/smoke.mjs
//   node scripts/smoke.mjs http://localhost:4001
// Optional:
//   SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD  (defaults to demo admin)
//   SMOKE_SELF_SERVICE_CODE                   (a valid NUT-XXXXXX code)
//
// Exits non-zero if any assertion fails.

const BASE_URL = (
  process.env.BASE_URL ||
  process.argv[2] ||
  'http://localhost:4001'
).replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@fastinbox.test';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'fastinbox123';
const SELF_SERVICE_CODE = process.env.SMOKE_SELF_SERVICE_CODE || '';

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(name, extra = '') {
  passed += 1;
  console.log(`✓ ${name}${extra ? ` ${extra}` : ''}`);
}
function fail(name, reason) {
  failed += 1;
  console.error(`✗ ${name} — ${reason}`);
}
function skip(name, reason) {
  skipped += 1;
  console.log(`⊘ SKIP ${name} — ${reason}`);
}

async function req(method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}

async function step(name, fn) {
  try {
    await fn();
  } catch (err) {
    fail(name, err instanceof Error ? err.message : String(err));
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log(`FastInBox smoke → ${BASE_URL}\n`);

  await step('GET /health', async () => {
    const r = await req('GET', '/health');
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json?.status === 'ok', 'status !== ok');
    assert(
      r.headers.get('x-content-type-options') === 'nosniff',
      'missing X-Content-Type-Options security header',
    );
    pass('GET /health', '(200, security header present)');
  });

  await step('GET /ready', async () => {
    const r = await req('GET', '/ready');
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json?.status === 'ready', 'status !== ready');
    assert(r.json?.checks?.seed === 'ok', `seed check = ${r.json?.checks?.seed}`);
    assert(
      typeof r.json?.checks?.uptimeMs === 'number',
      'uptimeMs missing',
    );
    pass('GET /ready', `(seed=${r.json.checks.seed})`);
  });

  let token = '';
  await step('POST /auth/login (admin)', async () => {
    const r = await req('POST', '/auth/login', {
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    assert(r.status === 200 || r.status === 201, `expected 200/201, got ${r.status}`);
    assert(typeof r.json?.accessToken === 'string', 'no accessToken');
    token = r.json.accessToken;
    pass('POST /auth/login (admin)', '(token acquired)');
  });

  if (!token) {
    console.error('\nAborting: admin login failed, cannot run authed steps.');
    summarize();
    process.exit(1);
  }

  await step('GET /admin/diagnostics', async () => {
    const r = await req('GET', '/admin/diagnostics', { token });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const m = r.json?.modules;
    assert(m?.subscriptions?.status === 'ok', 'subscriptions block missing/not ok');
    assert(m?.selfService?.status === 'ok', 'selfService block missing/not ok');
    assert(m?.orders?.status === 'ok', 'orders block missing/not ok');
    pass(
      'GET /admin/diagnostics',
      `(subs=${m.subscriptions.total} codes=${m.selfService.codes} orders=${m.orders.total})`,
    );
  });

  await step('GET /admin/reports/forecast?days=7', async () => {
    const r = await req('GET', '/admin/reports/forecast?days=7', { token });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const w = r.json?.windows;
    assert(Array.isArray(w) && w.length >= 1, 'expected >=1 forecast window');
    for (const win of w) {
      assert(
        win.lowerBound <= win.expectedMeals && win.expectedMeals <= win.upperBound,
        `bound invariant violated on ${win.date}/${win.slot}`,
      );
      assert(
        win.expectedMeals === win.fromHistory + win.fromSubscriptions,
        `decomposition invariant violated on ${win.date}/${win.slot}`,
      );
    }
    pass('GET /admin/reports/forecast?days=7', `(${w.length} windows, invariants hold)`);
  });

  await step('GET /subscriptions (admin sees >=3)', async () => {
    const r = await req('GET', '/subscriptions', { token });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(Array.isArray(r.json), 'expected array');
    assert(r.json.length >= 3, `expected >=3, got ${r.json.length}`);
    pass('GET /subscriptions', `(${r.json.length} subscriptions)`);
  });

  await step('GET /public/self-service/:code (invalid → 404)', async () => {
    const r = await req('GET', '/public/self-service/NUT-ZZZZZZ');
    assert(r.status === 404, `expected 404, got ${r.status}`);
    assert(
      r.json?.code === 'SELF_SERVICE_CODE_INVALID',
      `expected SELF_SERVICE_CODE_INVALID, got ${r.json?.code}`,
    );
    pass('GET /public/self-service/:code (invalid)', '(404 SELF_SERVICE_CODE_INVALID)');
  });

  if (SELF_SERVICE_CODE) {
    await step('GET /public/self-service/:code (valid)', async () => {
      const r = await req(
        'GET',
        `/public/self-service/${encodeURIComponent(SELF_SERVICE_CODE)}`,
      );
      assert(r.status === 200, `expected 200, got ${r.status}`);
      assert(r.json?.clinic?.id, 'clinic missing in whitelabel payload');
      assert(r.json?.nutritionist?.fullName, 'nutritionist missing');
      pass(
        'GET /public/self-service/:code (valid)',
        `(clinic=${r.json.clinic.name})`,
      );
    });
  } else {
    skip(
      'GET /public/self-service/:code (valid)',
      'set SMOKE_SELF_SERVICE_CODE to a valid code to test the happy path',
    );
  }

  summarize();
  process.exit(failed > 0 ? 1 : 0);
}

function summarize() {
  console.log(
    `\n${passed} passed, ${failed} failed, ${skipped} skipped (base=${BASE_URL})`,
  );
}

main().catch((err) => {
  console.error(`\nFatal: ${err instanceof Error ? err.message : String(err)}`);
  console.error('Is the server running? Start it with: node dist/main');
  process.exit(1);
});
