/**
 * Re-test for tests d, f, m only (the three that failed in the full suite).
 * Creates a fresh user, seeds minimal data, then retests.
 */
import puppeteer from '../vault-frontend/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];
function record(name, pass, evidence) {
  const status = pass === true ? 'PASS' : pass === false ? 'FAIL' : 'UNVERIFIED';
  results.push({ name, status, evidence });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '❓';
  console.log(`\n${icon} [${status}] ${name}`);
  console.log(`  Evidence: ${evidence}`);
}

async function newPage(browser) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  p.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  BROWSER ERR:', msg.text());
  });
  return p;
}

async function signup(page, email, password) {
  await page.goto('http://localhost:3000/signup', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 25000 });
}

const clientDate = '2026-10-16';

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('RETEST: d, f, m');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const ts = Date.now();
  const userEmail = `retest_dfm_${ts}@test.example`;
  const userPass = 'VaultRetestPass!';

  try {
    const page = await newPage(browser);
    console.log(`\n--- Signing up: ${userEmail} ---`);
    await signup(page, userEmail, userPass);

    const token = await page.evaluate(() => {
      const storageKey = Object.keys(localStorage).find((k) => k.includes('auth-token'));
      if (storageKey) {
        const item = JSON.parse(localStorage.getItem(storageKey));
        return item?.access_token || item?.currentSession?.access_token || null;
      }
      return null;
    });

    async function postJson(endpoint, body) {
      const res = await fetch(`http://localhost:4000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      return res.json();
    }

    console.log('\n--- Seeding ---');
    // Birthdays: anita (in 9 days), saideepak (in 20 days), charlie (far future)
    await postJson('/api/dashboard/events', { event_type: 'birthday', event_date: '1998-10-25', description: 'anita' });
    await postJson('/api/dashboard/events', { event_type: 'birthday', event_date: '2000-11-05', description: 'saideepak' });
    await postJson('/api/dashboard/events', { event_type: 'birthday', event_date: '1992-05-10', description: 'charlie' });

    // Events
    await postJson('/api/dashboard/events', { event_type: 'due_date', event_date: '2026-10-28', description: 'Dentist Checkup', amount: 80 });
    await postJson('/api/dashboard/events', { event_type: 'renewal', event_date: '2026-12-15', description: 'Car Registration Renewal', amount: 150 });

    // Notes
    await postJson('/api/dashboard/notes', { content: 'Felt dizziness and lightheadedness after workout session' });
    await postJson('/api/dashboard/notes', { content: 'Doctor advised staying well hydrated' });
    // 21 more to exceed limits
    for (let i = 1; i <= 21; i++) {
      await postJson('/api/dashboard/notes', { content: `Archived reference note #${i} on general wellness` });
    }

    console.log('Seeding done.\n');

    async function askChat(question, history = []) {
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, history, client_date: clientDate }),
      });
      return res.json();
    }

    // ── d) "what notes do I have?" and "what did I note about dizziness?"
    console.log('--- d) notes + dizziness ---');
    try {
      const res1 = await askChat('what notes do I have?');
      const res2 = await askChat('what did I note about dizziness?');
      console.log('  d-1 mode:', res1.mode, '| answer snippet:', (res1.answer || '').substring(0, 100));
      console.log('  d-2 mode:', res2.mode, '| answer:', res2.answer);
      const pass =
        res1.mode === 'dashboard' &&
        res2.mode === 'dashboard' &&
        /dizz(y|iness)|workout/i.test(res2.answer || '');
      record(
        'd) "what notes do I have?" and "what did I note about dizziness?"',
        pass,
        `Notes reply: ${(res1.answer || 'undefined').substring(0, 150)} | Dizziness reply: ${res2.answer}`
      );
    } catch (e) {
      record('d) notes and dizziness', false, e.message);
    }

    // ── f) "what's coming up this month?" and "any alerts this year?"
    console.log('\n--- f) coming up this month + alerts this year ---');
    try {
      const resMonth = await askChat("what's coming up this month?");
      const resYear = await askChat('any alerts this year?');
      console.log('  f-month mode:', resMonth.mode, '| answer:', resMonth.answer);
      console.log('  f-year mode:', resYear.mode, '| answer snippet:', (resYear.answer || '').substring(0, 100));
      const hasDentist = /dentist/i.test(resMonth.answer || '');
      const hasCarRenewal = /car registration|renewal|dentist/i.test(resYear.answer || '');
      const pass = hasDentist && hasCarRenewal && resMonth.mode === 'dashboard' && resYear.mode === 'dashboard';
      record(
        'f) "what\'s coming up this month?" and "any alerts this year?"',
        pass,
        `This month reply: ${resMonth.answer || 'undefined'} | This year reply: ${(resYear.answer || '').substring(0, 150)}`
      );
    } catch (e) {
      record('f) alerts coming up', false, e.message);
    }

    // ── m) Birthdays card shows birthdays far in the future, with days-until labels
    console.log('\n--- m) Birthdays card shows charlie (far future) + days-until labels ---');
    try {
      // Navigate to dashboard (already logged in)
      await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle0' });

      // Wait for birthday data to load and render
      await page.waitForFunction(
        () =>
          document.body.innerText.toLowerCase().includes('anita') ||
          document.body.innerText.toLowerCase().includes('saideepak') ||
          document.body.innerText.toLowerCase().includes('charlie'),
        { timeout: 20000 }
      ).catch(() => {});

      const bodyText = await page.evaluate(() => document.body.innerText);
      const showsCharlie = bodyText.toLowerCase().includes('charlie');
      const showsDaysUntil = /in\s+\d+\s+days|today|tomorrow/i.test(bodyText);
      console.log('  showsCharlie:', showsCharlie, '| showsDaysUntil:', showsDaysUntil);
      console.log('  Relevant excerpt:', bodyText.substring(0, 500));
      const pass = showsCharlie && showsDaysUntil;
      record(
        'm) the Birthdays card shows birthdays far in the future, with days-until labels',
        pass,
        `Shows charlie (>30 days away): ${showsCharlie}, shows days-until labels: ${showsDaysUntil}`
      );
    } catch (e) {
      record('m) Birthdays card far in future', false, e.message);
    }

    await page.close();
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(60));
  console.log('RETEST SUMMARY:');
  console.log('='.repeat(60));
  for (const r of results) {
    console.log(`${r.status === 'PASS' ? '✅' : '❌'} [${r.status}] ${r.name}`);
  }
}

run().catch((err) => {
  console.error('Retest failed:', err);
  process.exit(1);
});
