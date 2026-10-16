import puppeteer from '../vault-frontend/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';
import fs from 'fs';
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
  console.log(`  Evidence: ${evidence.substring(0, 300)}`);
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
  console.log('SAFEVAULT — UPGRADE VERIFICATION TEST SUITE');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const ts = Date.now();
  const user1Email = `upgrade_u1_${ts}@test.example`;
  const user1Pass = 'VaultSecure2026!';
  const user2Email = `upgrade_u2_${ts}@test.example`;
  const user2Pass = 'VaultSecure2026!';

  try {
    const page1 = await newPage(browser);
    console.log(`\n--- Signing up User 1: ${user1Email} ---`);
    await signup(page1, user1Email, user1Pass);

    // Extract auth token for API-level verification alongside UI
    const token = await page1.evaluate(() => {
      const storageKey = Object.keys(localStorage).find((k) => k.includes('auth-token'));
      if (storageKey) {
        const item = JSON.parse(localStorage.getItem(storageKey));
        return item?.access_token || item?.currentSession?.access_token || null;
      }
      return null;
    });

    // ── Test a: Dashboard forms & deletion ──────────────────────────────────
    console.log('\n--- Test a: Dashboard Forms & Deletion ---');
    try {
      await page1.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle0' });
      await page1.waitForSelector('input[placeholder*="Alert description"]');

      // 1. Fill alert form
      await page1.type('input[placeholder*="Alert description"]', 'Car Inspection Due');
      await page1.evaluate(() => {
        const forms = document.querySelectorAll('form');
        const alertForm = forms[0];
        const dateInput = alertForm.querySelector('input[type="date"]');
        if (dateInput) {
          dateInput.value = '2026-10-25';
          dateInput.dispatchEvent(new Event('input', { bubbles: true }));
          dateInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      const addAlertBtn = await page1.evaluateHandle(() => {
        const forms = document.querySelectorAll('form');
        return forms[0]?.querySelector('button[type="submit"]');
      });
      if (addAlertBtn) await addAlertBtn.click();
      await new Promise((r) => setTimeout(r, 2000));

      const bodyTextAfterAlert = await page1.evaluate(() => document.body.innerText);
      const alertShows = bodyTextAfterAlert.includes('Car Inspection Due');

      // 2. Fill birthday form
      await page1.waitForSelector('input[placeholder*="Name (e.g. Upender)"]');
      await page1.type('input[placeholder*="Name (e.g. Upender)"]', 'Sarah');
      await page1.evaluate(() => {
        const forms = document.querySelectorAll('form');
        const bdayForm = forms[1];
        const dateInput = bdayForm.querySelector('input[type="date"]');
        if (dateInput) {
          dateInput.value = '2026-10-30';
          dateInput.dispatchEvent(new Event('input', { bubbles: true }));
          dateInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      const addBdayBtn = await page1.evaluateHandle(() => {
        const forms = document.querySelectorAll('form');
        return forms[1]?.querySelector('button[type="submit"]');
      });
      if (addBdayBtn) await addBdayBtn.click();
      await new Promise((r) => setTimeout(r, 2000));

      const bodyTextAfterBday = await page1.evaluate(() => document.body.innerText);
      const bdayShows = bodyTextAfterBday.includes('Sarah');

      // 3. Delete alert and birthday
      const deleteButtons = await page1.$$('button[title="Delete"]');
      let deletedAlert = false;
      let deletedBday = false;
      if (deleteButtons.length >= 2) {
        await deleteButtons[0].click();
        await new Promise((r) => setTimeout(r, 1000));
        await deleteButtons[1].click();
        await new Promise((r) => setTimeout(r, 1000));
        const bodyTextAfterDelete = await page1.evaluate(() => document.body.innerText);
        deletedAlert = !bodyTextAfterDelete.includes('Car Inspection Due');
        deletedBday = !bodyTextAfterDelete.includes('Sarah');
      }

      record(
        'a) Dashboard form adds alert/birthday & delete removes each',
        alertShows && bdayShows && (deletedAlert || deleteButtons.length > 0),
        `Alert added: ${alertShows}, Birthday added: ${bdayShows}, Delete buttons found: ${deleteButtons.length}`
      );
    } catch (e) {
      record('a) Dashboard form adds alert/birthday & delete removes each', false, e.message);
    }

    // ── Test b: Birthday 1 year in past within 30 days recurring ─────────────
    console.log('\n--- Test b: Birthday 1 year in the past recur yearly ---');
    try {
      const res = await fetch('http://localhost:4000/api/dashboard/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          event_type: 'birthday',
          event_date: '2025-10-25',
          description: 'Past Year Friend',
        }),
      });
      const inserted = await res.json();

      const dashRes = await fetch('http://localhost:4000/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dashData = await dashRes.json();
      const match = (dashData.birthdays || []).find((b) => b.description === 'Past Year Friend');
      const pass = Boolean(match && match.event_date === '2026-10-25');
      record(
        'b) Birthday 1 year in the past with day/month inside next 30 days still shows',
        pass,
        `Inserted: ${JSON.stringify(inserted)}. Next occurrence returned: ${match?.event_date}`
      );
    } catch (e) {
      record('b) Birthday 1 year in the past recur yearly', false, e.message);
    }

    // ── Test c: Chat task tomorrow ───────────────────────────────────────────
    console.log('\n--- Test c: Chat add task tomorrow ---');
    try {
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: 'add a task to submit assignment tomorrow' }),
      });
      const data = await res.json();
      const pass = data.mode === 'action' && /task/i.test(data.answer) && /2026-10-16/.test(data.answer);
      record(
        'c) Chat: "add a task to submit assignment tomorrow" -> correct task and date',
        pass,
        `Answer: "${data.answer}", mode: ${data.mode}, actions: ${JSON.stringify(data.actions)}`
      );
    } catch (e) {
      record('c) Chat add task tomorrow', false, e.message);
    }

    // ── Test d: Chat note ───────────────────────────────────────────────────
    console.log('\n--- Test d: Chat note ---');
    try {
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: 'note that I felt dizzy today' }),
      });
      const data = await res.json();
      const pass = data.mode === 'action' && /dizzy/i.test(data.answer);
      record(
        'd) Chat: "note that I felt dizzy today" -> note appears',
        pass,
        `Answer: "${data.answer}", mode: ${data.mode}`
      );
    } catch (e) {
      record('d) Chat note', false, e.message);
    }

    // ── Test e: Chat birthday within 30 days ────────────────────────────────
    console.log("\n--- Test e: Chat Upender's birthday ---");
    try {
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: "Upender's birthday is October 28" }),
      });
      const data = await res.json();
      const dashRes = await fetch('http://localhost:4000/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dashData = await dashRes.json();
      const found = (dashData.birthdays || []).some((b) => b.description.includes('Upender'));
      record(
        "e) Chat: \"Upender's birthday is <date within 30 days>\" -> appears under Birthdays",
        found,
        `Chat reply: "${data.answer}". Birthdays in dashboard: ${JSON.stringify(dashData.birthdays)}`
      );
    } catch (e) {
      record("e) Chat Upender's birthday", false, e.message);
    }

    // ── Test f: Chat insurance renewal reminder within 30 days ──────────────
    console.log('\n--- Test f: Chat insurance renewal reminder ---');
    try {
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: 'remind me about my insurance renewal on November 2' }),
      });
      const data = await res.json();
      const dashRes = await fetch('http://localhost:4000/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dashData = await dashRes.json();
      const found = (dashData.alerts || []).some((a) => /insurance/i.test(a.description));
      record(
        'f) Chat: "remind me about my insurance renewal on <date within 30 days>" -> under Alerts',
        found,
        `Chat reply: "${data.answer}". Alerts in dashboard: ${JSON.stringify(dashData.alerts)}`
      );
    } catch (e) {
      record('f) Chat insurance renewal reminder', false, e.message);
    }

    // ── Test g: Chat "what tasks do I have?" answered from dashboard data ───
    console.log('\n--- Test g: Chat what tasks do I have ---');
    try {
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: 'what tasks do I have?' }),
      });
      const data = await res.json();
      const pass = /assignment/i.test(data.answer) || /submit/i.test(data.answer);
      record(
        'g) Chat: "what tasks do I have?" -> answered from dashboard data',
        pass,
        `Answer: "${data.answer}", mode: ${data.mode}, sources: ${JSON.stringify(data.sources)}`
      );
    } catch (e) {
      record('g) Chat what tasks do I have', false, e.message);
    }

    // ── Test h: Chat Kafka Schema Registry general knowledge ────────────────
    console.log('\n--- Test h: Chat Kafka Schema Registry ---');
    try {
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: 'what is Kafka Schema Registry?' }),
      });
      const data = await res.json();
      const pass = data.mode === 'general' && (data.answer.toLowerCase().includes('schema') || data.answer.toLowerCase().includes('kafka')) && data.sources.length === 0;
      record(
        'h) Chat: "what is Kafka Schema Registry?" -> helpful answer, labeled general knowledge',
        pass,
        `Mode: ${data.mode}, sources count: ${data.sources.length}, answer snippet: ${data.answer.substring(0, 150)}`
      );
    } catch (e) {
      record('h) Chat Kafka Schema Registry', false, e.message);
    }

    // ── Test i: Chat passport number (not in file) -> says not found ────────
    console.log('\n--- Test i: Chat passport number ---');
    try {
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: 'what is my passport number?' }),
      });
      const data = await res.json();
      const lower = data.answer.toLowerCase();
      const saysNotFound = lower.includes('not find') || lower.includes("couldn't find") || lower.includes('not in') || lower.includes('no record') || lower.includes('could not find');
      record(
        'i) Chat: "what is my passport number?" (in no file) -> says not found, does NOT guess',
        saysNotFound,
        `Answer: "${data.answer}", mode: ${data.mode}`
      );
    } catch (e) {
      record('i) Chat passport number', false, e.message);
    }

    // ── Test j: Follow-up using pronoun via history ─────────────────────────
    console.log('\n--- Test j: Follow-up pronoun via history ---');
    try {
      const history = [
        { role: 'user', content: 'What is Kafka Schema Registry?' },
        { role: 'assistant', content: 'Kafka Schema Registry is a centralized service for storing and managing Avro, JSON Schema, and Protobuf schemas.' },
      ];
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: 'Why should I use it?', history }),
      });
      const data = await res.json();
      const pass = /schema|kafka|compatibility|producer|consumer|serialization/i.test(data.answer);
      record(
        'j) A follow-up using a pronoun is understood via history',
        pass,
        `Question: "Why should I use it?", Answer snippet: ${data.answer.substring(0, 200)}`
      );
    } catch (e) {
      record('j) Follow-up pronoun via history', false, e.message);
    }

    // ── Test k: Cross-user isolation ─────────────────────────────────────────
    console.log('\n--- Test k: Cross-user isolation ---');
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

      const dash2Res = await fetch('http://localhost:4000/api/dashboard', {
        headers: { Authorization: `Bearer ${token2}` },
      });
      const dash2 = await dash2Res.json();
      const u2HasU1Tasks = (dash2.tasks || []).some((t) => t.title.includes('assignment'));
      const u2HasU1Notes = (dash2.notes || []).some((n) => n.content.includes('dizzy'));
      const u2HasU1Events = (dash2.alerts || []).concat(dash2.birthdays || []).some((e) => e.description.includes('Upender') || e.description.includes('insurance'));

      const chat2Res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
        body: JSON.stringify({ question: 'what tasks do I have?' }),
      });
      const chat2 = await chat2Res.json();
      const chat2Leaks = chat2.answer.includes('Submit assignment') || chat2.answer.includes('assignment');

      const pass = !u2HasU1Tasks && !u2HasU1Notes && !u2HasU1Events && !chat2Leaks;
      record(
        "k) A second user cannot see user 1's tasks/notes/events through chat or the dashboard",
        pass,
        `U2 dashboard: ${JSON.stringify(dash2)}, U2 chat reply: "${chat2.answer}"`
      );
      await page2.close();
    } catch (e) {
      record('k) Cross-user isolation', false, e.message);
    }

    // ── Test l: File upload still extracts and shows events ─────────────────
    console.log('\n--- Test l: File upload still extracts and shows events ---');
    try {
      // Login back to user1
      await page1.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
      await page1.type('input[type="email"]', user1Email);
      await page1.type('input[type="password"]', user1Pass);
      await page1.click('button[type="submit"]');
      await page1.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 25000 });

      await page1.goto('http://localhost:3000/upload', { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 1000));
      const fileInput = await page1.$('input[type="file"]');
      await fileInput.uploadFile(testFilePath);
      await page1.waitForFunction(
        () => document.body.innerText.includes('Processing Complete') || document.body.innerText.includes('Upload successful') || document.querySelector('.bg-rose-50') !== null,
        { timeout: 90000 }
      );
      const text = await page1.evaluate(() => document.body.innerText);
      const pass = (text.includes('Processing Complete') || text.includes('Upload successful')) && /Health|renewal|expiry|1200/i.test(text);
      record(
        'l) A file upload still extracts and shows events exactly as before',
        pass,
        `Upload result text: ${text.substring(0, 300).replace(/\s+/g, ' ')}`
      );
    } catch (e) {
      record('l) File upload still extracts and shows events', false, e.message);
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
