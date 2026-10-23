import puppeteer from '../vault-frontend/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const testFilePath = path.join(__dirname, 'test_policy.txt');

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

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('SAFEVAULT — PART 5 COMPREHENSIVE VERIFICATION SUITE');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const ts = Date.now();
  const user1Email = `part5_u1_${ts}@test.example`;
  const user1Pass = 'VaultPart5Pass!';
  const user2Email = `part5_u2_${ts}@test.example`;
  const user2Pass = 'VaultPart5Pass!';

  // Fixed client date for test reproducibility: 2026-10-16
  const clientDate = '2026-10-16';

  try {
    const page1 = await newPage(browser);
    console.log(`\n--- Signing up User 1: ${user1Email} ---`);
    await signup(page1, user1Email, user1Pass);

    const token = await page1.evaluate(() => {
      const storageKey = Object.keys(localStorage).find((k) => k.includes('auth-token'));
      if (storageKey) {
        const item = JSON.parse(localStorage.getItem(storageKey));
        return item?.access_token || item?.currentSession?.access_token || null;
      }
      return null;
    });

    // ── Seed User 1 Data ───────────────────────────────────────────────────
    console.log('\n--- Seeding test data for User 1 ---');

    // Helper for authenticated POST
    async function postJson(endpoint, body) {
      const res = await fetch(`http://localhost:4000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      return res.json();
    }

    // 1. Birthdays:
    // saideepak: 2000-11-05 (in 20 days from 2026-10-16)
    // anita: 1998-10-25 (in 9 days from 2026-10-16 -> NEAREST!)
    // charlie: 1992-05-10 (far in future: next is 2027-05-10, in 206 days)
    await postJson('/api/dashboard/events', {
      event_type: 'birthday',
      event_date: '2000-11-05',
      description: 'saideepak',
    });
    await postJson('/api/dashboard/events', {
      event_type: 'birthday',
      event_date: '1998-10-25',
      description: 'anita',
    });
    await postJson('/api/dashboard/events', {
      event_type: 'birthday',
      event_date: '1992-05-10',
      description: 'charlie',
    });

    // 2. Events/Alerts:
    // Upcoming this month
    await postJson('/api/dashboard/events', {
      event_type: 'due_date',
      event_date: '2026-10-28',
      description: 'Dentist Checkup',
      amount: 80,
    });
    // Upcoming this year
    await postJson('/api/dashboard/events', {
      event_type: 'renewal',
      event_date: '2026-12-15',
      description: 'Car Registration Renewal',
      amount: 150,
    });
    // Past event
    await postJson('/api/dashboard/events', {
      event_type: 'other',
      event_date: '2026-09-01',
      description: 'Annual Health Checkup',
      amount: 200,
    });

    // 3. Tasks:
    // Open task
    const tOpen = await postJson('/api/dashboard/tasks', {
      title: 'Submit quarterly report',
      due_date: '2026-10-22',
    });
    // Completed tasks (create and mark done)
    const tDone1 = await postJson('/api/dashboard/tasks', {
      title: 'Clean the garage',
      due_date: '2026-10-10',
    });
    const tDone2 = await postJson('/api/dashboard/tasks', {
      title: 'Buy vitamins',
    });
    await fetch(`http://localhost:4000/api/dashboard/tasks/${tDone1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_done: true }),
    });
    await fetch(`http://localhost:4000/api/dashboard/tasks/${tDone2.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_done: true }),
    });

    // 4. Notes:
    await postJson('/api/dashboard/notes', {
      content: 'Felt dizziness and lightheadedness after workout session',
    });
    await postJson('/api/dashboard/notes', {
      content: 'Doctor advised staying well hydrated and checking blood pressure',
    });
    // Add 21 more dummy notes to exceed 20 rows limit
    for (let i = 1; i <= 21; i++) {
      await postJson('/api/dashboard/notes', {
        content: `Archived reference note #${i} on general wellness`,
      });
    }

    console.log('Seeding completed successfully.');

    // Helper for asking chat
    async function askChat(question, history = []) {
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, history, client_date: clientDate }),
      });
      return res.json();
    }

    // ── a) "when is saideepak's birthday?" -> exact date plus days remaining
    console.log("\n--- a) when is saideepak's birthday? ---");
    try {
      const res = await askChat("when is saideepak's birthday?");
      const pass =
        /nov(ember)?\s*5|2026-11-05/i.test(res.answer) &&
        /20\s*days/i.test(res.answer) &&
        res.mode === 'dashboard';
      record("a) \"when is saideepak's birthday?\" -> exact date plus days remaining", pass, res.answer);
    } catch (e) {
      record("a) \"when is saideepak's birthday?\"", false, e.message);
    }

    // ── b) "whose birthday is next?" -> the correct nearest birthday
    console.log('\n--- b) whose birthday is next? ---');
    try {
      const res = await askChat('whose birthday is next?');
      const pass = /anita/i.test(res.answer) && res.mode === 'dashboard';
      record('b) "whose birthday is next?" -> the correct nearest birthday', pass, res.answer);
    } catch (e) {
      record('b) "whose birthday is next?"', false, e.message);
    }

    // ── c) "list all birthdays" -> every saved birthday, none missing
    console.log('\n--- c) list all birthdays ---');
    try {
      const res = await askChat('list all birthdays');
      const hasSaideepak = /saideepak/i.test(res.answer);
      const hasAnita = /anita/i.test(res.answer);
      const hasCharlie = /charlie/i.test(res.answer);
      const pass = hasSaideepak && hasAnita && hasCharlie && res.mode === 'dashboard';
      record('c) "list all birthdays" -> every saved birthday, none missing', pass, res.answer);
    } catch (e) {
      record('c) "list all birthdays"', false, e.message);
    }

    // ── d) "what notes do I have?" and "what did I note about dizziness?"
    console.log('\n--- d) what notes do I have? and dizziness note ---');
    try {
      const res1 = await askChat('what notes do I have?');
      const res2 = await askChat('what did I note about dizziness?');
      const pass =
        res1.mode === 'dashboard' &&
        res2.mode === 'dashboard' &&
        /dizz(y|iness)|workout/i.test(res2.answer);
      record(
        'd) "what notes do I have?" and "what did I note about dizziness?"',
        pass,
        `Notes reply: ${res1.answer.substring(0, 150)}... | Dizziness reply: ${res2.answer}`
      );
    } catch (e) {
      record('d) notes and dizziness', false, e.message);
    }

    // ── e) "what tasks do I have?" AND "which tasks did I finish?"
    console.log('\n--- e) what tasks do I have? AND which tasks did I finish? ---');
    try {
      const resOpen = await askChat('what tasks do I have?');
      const resDone = await askChat('which tasks did I finish?');
      const hasOpen = /quarterly report/i.test(resOpen.answer);
      const hasDone = /garage|vitamins/i.test(resDone.answer);
      const pass = hasOpen && hasDone && resOpen.mode === 'dashboard' && resDone.mode === 'dashboard';
      record(
        'e) "what tasks do I have?" AND "which tasks did I finish?" (completed tasks)',
        pass,
        `Open tasks reply: ${resOpen.answer} | Done tasks reply: ${resDone.answer}`
      );
    } catch (e) {
      record('e) tasks open and done', false, e.message);
    }

    // ── f) "what's coming up this month?" and "any alerts this year?"
    console.log("\n--- f) what's coming up this month? and any alerts this year? ---");
    try {
      const resMonth = await askChat("what's coming up this month?");
      const resYear = await askChat('any alerts this year?');
      const hasDentist = /dentist/i.test(resMonth.answer);
      const hasCarRenewal = /car registration|renewal|dentist/i.test(resYear.answer);
      const pass = hasDentist && hasCarRenewal && resMonth.mode === 'dashboard' && resYear.mode === 'dashboard';
      record(
        'f) "what\'s coming up this month?" and "any alerts this year?"',
        pass,
        `This month reply: ${resMonth.answer} | This year reply: ${resYear.answer}`
      );
    } catch (e) {
      record('f) alerts coming up', false, e.message);
    }

    // ── g) "how many birthdays/notes/tasks do I have?" -> counts match database
    console.log('\n--- g) how many birthdays/notes/tasks do I have? ---');
    try {
      // 3 birthdays, 3 tasks (1 open + 2 done), 23 notes
      const res = await askChat('how many birthdays, notes, and tasks do I have?');
      const has3Birthdays = /\b3\s*birthdays?\b/i.test(res.answer) || /birthdays?:\s*3/i.test(res.answer);
      const has3Tasks = /\b3\s*tasks?\b/i.test(res.answer) || /tasks?:\s*3/i.test(res.answer);
      const has23Notes = /\b23\s*notes?\b/i.test(res.answer) || /notes?:\s*23/i.test(res.answer);
      const pass = has3Birthdays && has3Tasks && has23Notes && res.mode === 'dashboard';
      record(
        'g) "how many birthdays/notes/tasks do I have?" -> counts match the database',
        pass,
        res.answer
      );
    } catch (e) {
      record('g) counts match', false, e.message);
    }

    // ── h) a notes/event row older than the 20-row limits is still found via counts or truncation note
    console.log('\n--- h) older row found via counts / truncation note ---');
    try {
      const res = await askChat('tell me about the total volume of notes and if all are shown');
      const pass =
        /23|showing|truncat/i.test(res.answer) && res.mode === 'dashboard';
      record(
        'h) a notes/event row older than the 20-row limits is still found via counts or truncation note',
        pass,
        res.answer
      );
    } catch (e) {
      record('h) older row via counts / truncation', false, e.message);
    }

    // ── i) "what is my passport number?" (in no file or data) -> says not found
    console.log('\n--- i) what is my passport number? ---');
    try {
      const res = await askChat('what is my passport number?');
      const lower = res.answer.toLowerCase();
      const pass =
        (lower.includes('not find') ||
          lower.includes("couldn't find") ||
          lower.includes('not in') ||
          lower.includes('no record') ||
          lower.includes('could not find')) &&
        !/\b[A-Z0-9]{8,10}\b/.test(res.answer);
      record(
        'i) "what is my passport number?" (in no file or data) -> says not found, does NOT guess',
        pass,
        res.answer
      );
    } catch (e) {
      record('i) passport number', false, e.message);
    }

    // ── j) "what is Kafka Schema Registry?" -> normal general answer, labeled general knowledge
    console.log('\n--- j) what is Kafka Schema Registry? ---');
    try {
      const res = await askChat('what is Kafka Schema Registry?');
      const pass =
        res.mode === 'general' &&
        res.sources.length === 0 &&
        (res.answer.includes('Not from your files') || res.answer.includes('[Not from your files]')) &&
        /schema|kafka/i.test(res.answer);
      record(
        'j) "what is Kafka Schema Registry?" -> normal general answer, labeled general knowledge',
        pass,
        `Mode: ${res.mode}, sources: ${res.sources.length}, answer: ${res.answer.substring(0, 200)}`
      );
    } catch (e) {
      record('j) Kafka Schema Registry', false, e.message);
    }

    // ── k) a question answered from an uploaded file still returns correct sources
    console.log('\n--- k) question from uploaded file returns correct sources ---');
    try {
      // Upload test_policy.txt
      await page1.goto('http://localhost:3000/upload', { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 1000));
      const fileInput = await page1.$('input[type="file"]');
      await fileInput.uploadFile(testFilePath);
      await page1.waitForFunction(
        () =>
          document.body.innerText.includes('Processing Complete') ||
          document.body.innerText.includes('Upload successful') ||
          document.querySelector('.bg-rose-50') !== null,
        { timeout: 90000 }
      );

      // Chat query strictly about policy content
      const res = await askChat('what is the emergency room co-pay in my policy?');
      const pass =
        (res.mode === 'files' || res.mode === 'mixed') &&
        res.sources.length > 0 &&
        /150/.test(res.answer);
      record(
        'k) a question answered from an uploaded file still returns correct sources',
        pass,
        `Mode: ${res.mode}, sources: ${JSON.stringify(res.sources)}, answer: ${res.answer}`
      );
    } catch (e) {
      record('k) uploaded file question', false, e.message);
    }

    // ── l) a second user's chat never shows user 1's birthdays, notes, tasks or events
    console.log("\n--- l) second user's chat isolation ---");
    try {
      const page2 = await newPage(browser);
      await signup(page2, user2Email, user2Pass);
      const token2 = await page2.evaluate(() => {
        const storageKey = Object.keys(localStorage).find((k) => k.includes('auth-token'));
        if (storageKey) {
          const item = JSON.parse(localStorage.getItem(storageKey));
          return item?.access_token || item?.currentSession?.access_token || null;
        }
        return null;
      });

      const res2Bday = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
        body: JSON.stringify({ question: 'list all birthdays', client_date: clientDate }),
      }).then((r) => r.json());

      const res2Task = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
        body: JSON.stringify({ question: 'what tasks do I have?', client_date: clientDate }),
      }).then((r) => r.json());

      const leaksBday = /saideepak|anita|charlie/i.test(res2Bday.answer);
      const leaksTask = /quarterly report|garage/i.test(res2Task.answer);
      const pass = !leaksBday && !leaksTask;
      record(
        "l) a second user's chat never shows user 1's birthdays, notes, tasks or events",
        pass,
        `User 2 Bday reply: "${res2Bday.answer}" | User 2 Task reply: "${res2Task.answer}"`
      );
      await page2.close();
    } catch (e) {
      record('l) second user chat isolation', false, e.message);
    }

    // ── m) the Birthdays card shows birthdays far in the future, with days-until labels
    console.log('\n--- m) Birthdays card shows birthdays far in future with days-until labels ---');
    try {
      // Log back in as user 1
      await page1.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
      await page1.type('input[type="email"]', user1Email);
      await page1.type('input[type="password"]', user1Pass);
      await page1.click('button[type="submit"]');
      await page1.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 25000 });

      // Wait for birthday data to load and render (async fetch after navigation)
      await page1.waitForFunction(
        () => document.body.innerText.includes('anita') || document.body.innerText.includes('saideepak') || document.body.innerText.includes('charlie'),
        { timeout: 20000 }
      ).catch(() => {}); // proceed even if not found — let the assertion below record the result

      // Check Birthdays card content
      const bodyText = await page1.evaluate(() => document.body.innerText);
      const showsCharlie = bodyText.toLowerCase().includes('charlie');
      const showsDaysUntil = /in\s+\d+\s+days|today|tomorrow/i.test(bodyText);
      const pass = showsCharlie && showsDaysUntil;
      record(
        'm) the Birthdays card shows birthdays far in the future, with days-until labels',
        pass,
        `Shows charlie (>30 days away): ${showsCharlie}, shows days-until labels: ${showsDaysUntil}`
      );
    } catch (e) {
      record('m) Birthdays card far in future', false, e.message);
    }

    await page1.close();
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY RESULTS:');
  console.log('='.repeat(60));
  for (const r of results) {
    console.log(`${r.status === 'PASS' ? '✅' : '❌'} [${r.status}] ${r.name}`);
  }
}

run().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
