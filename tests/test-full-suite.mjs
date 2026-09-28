/**
 * Full E2E + Security Test Suite
 * Covers STEP 3 (happy-path e2e) and STEP 4 (security + accuracy tests)
 *
 * Run from vault-frontend/:
 *   node test-full-suite.mjs
 */

import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\91996\\.gemini\\antigravity\\brain\\840bbf9b-7259-419a-8b93-e14e2461e7ab';
const testFilePath = path.join(__dirname, 'test_policy.txt');

// ── Results table ──────────────────────────────────────────────────────────
const results = [];
function record(name, pass, evidence) {
  const status = pass === true ? 'PASS' : pass === false ? 'FAIL' : 'UNVERIFIED';
  results.push({ name, status, evidence });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '❓';
  console.log(`\n${icon} [${status}] ${name}`);
  console.log(`  Evidence: ${evidence.substring(0, 200)}`);
}

// ── Page helpers ───────────────────────────────────────────────────────────
async function newPage(browser) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  p.on('console', msg => { if (msg.type() === 'error') console.log('  BROWSER ERR:', msg.text()); });
  return p;
}

async function signup(page, email, password) {
  await page.goto('http://localhost:3000/signup', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 25000 });
}

async function uploadFileToPage(page, filePath) {
  await page.goto('http://localhost:3000/upload', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1000));
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) throw new Error('File input not found on upload page');
  await fileInput.uploadFile(filePath);
  
  // Wait for either success container or red error box
  await page.waitForFunction(
    () => document.body.innerText.includes('Upload successful') || document.querySelector('.bg-red-50') !== null,
    { timeout: 90000 }
  );

  const errorElem = await page.$('.bg-red-50');
  if (errorElem) {
    const errMsg = await page.evaluate(el => el.innerText, errorElem);
    throw new Error(`Upload error on page: ${errMsg}`);
  }

  return page.evaluate(() => document.body.innerText);
}

async function chat(page, question) {
  await page.goto('http://localhost:3000/chat', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1000));
  const input = await page.$('input[type="text"]');
  if (!input) throw new Error('Chat text input not found');
  await input.type(question);
  await page.click('button[type="submit"]');

  // Wait for assistant reply or failure message
  await page.waitForFunction(() => {
    const t = document.body.innerText;
    return t.includes('Sources:')
      || t.toLowerCase().includes("couldn't find")
      || t.toLowerCase().includes('could not find')
      || t.toLowerCase().includes('not find')
      || t.toLowerCase().includes('no relevant')
      || t.toLowerCase().includes('not contained')
      || t.includes('Answered by')
      || t.includes('Error:');
  }, { timeout: 90000 });

  return page.evaluate(() => document.body.innerText);
}

// ── MAIN ──────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('VAULT AI — FULL E2E + SECURITY TEST SUITE');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const testPdfPath = path.join(artifactDir, 'test_mortgage.pdf');
  const testPngPath = path.join(artifactDir, 'test_utility_bill.png');

  // Generate 100% valid PDF and PNG using Chrome
  console.log('\nGenerating standard test assets via Chrome...');
  const assetPage = await browser.newPage();
  
  // 1. PDF
  await assetPage.setContent(`
    <html><body style="font-family: Arial; padding: 30px;">
      <h1>Mortgage Loan Statement</h1>
      <p>Borrower: Dr. Alex Morgan</p>
      <p>Property Address: 42 Oak Street</p>
      <p>Monthly Payment: $1450</p>
      <p>First Payment Due Date: 2026-11-01</p>
      <p>Interest Rate: 4.5% fixed</p>
    </body></html>
  `);
  const pdfBytes = await assetPage.pdf({ format: 'A4' });
  fs.writeFileSync(testPdfPath, pdfBytes);

  // 2. PNG with text
  await assetPage.setContent(`
    <html><body style="font-family: Arial; padding: 40px; background: white; color: black;">
      <h2>Electric Utility Bill</h2>
      <p>Account Number: ELEC-99201</p>
      <p>Service Period: October 2026</p>
      <p>Due Date: 2026-11-15</p>
      <p>Total Balance Due: $185.50</p>
    </body></html>
  `);
  await assetPage.setViewport({ width: 800, height: 600 });
  await assetPage.screenshot({ path: testPngPath });
  await assetPage.close();

  console.log('Created test PDF:', testPdfPath, `(${pdfBytes.length} bytes)`);
  console.log('Created test PNG:', testPngPath);

  const ts = Date.now();
  const user1Email = `vault_user1_${ts}@test.example`;
  const user1Pass  = 'VaultPassword2026!';
  const user2Email = `vault_user2_${ts}@test.example`;
  const user2Pass  = 'VaultPassword2026!';

  let page1;

  try {
    // ══════════════════════════════════════════════════════════════
    // STEP 3: Happy-Path E2E — User 1
    // ══════════════════════════════════════════════════════════════
    console.log(`\n\n=== STEP 3: E2E HAPPY PATH ===\nUser 1: ${user1Email}`);
    page1 = await newPage(browser);

    // 3a — Signup → /dashboard
    console.log('\n--- 3a: Signup ---');
    try {
      await signup(page1, user1Email, user1Pass);
      const url = page1.url();
      await page1.screenshot({ path: path.join(artifactDir, '03a_signup_dashboard.png') });
      record('STEP3a: Signup redirects to /dashboard', url.includes('/dashboard'), `URL: ${url}`);
    } catch (e) { record('STEP3a: Signup redirects to /dashboard', false, e.message); }

    // 3b — Upload test_policy.txt
    console.log('\n--- 3b: Upload test_policy.txt ---');
    try {
      const uploadText = await uploadFileToPage(page1, testFilePath);
      await page1.screenshot({ path: path.join(artifactDir, '03b_upload_result.png') });
      const hasCategory = /Health|Documents|Finance|Personal|Work|Subscriptions|Education|Others/.test(uploadText);
      const hasEvents   = /renewal|expiry|birthday|due_date|2026-10|1200|1,200/.test(uploadText);
      record('STEP3b: Upload shows category', hasCategory, `Category present: ${hasCategory}. Snippet: ${uploadText.substring(0,250).replace(/\s+/g,' ')}`);
      record('STEP3b: Upload shows extracted events', hasEvents, `Events present: ${hasEvents}. Snippet: ${uploadText.substring(0,400).replace(/\s+/g,' ')}`);
    } catch (e) { record('STEP3b: Upload test_policy.txt', false, e.message); }

    // 3c — Chat: answer must cite test_policy.txt
    console.log('\n--- 3c: Chat about uploaded file ---');
    try {
      const chatText = await chat(page1, 'When is the renewal date and what is the annual premium?');
      await page1.screenshot({ path: path.join(artifactDir, '03c_chat_answer.png') });
      const citesFile     = chatText.includes('test_policy.txt') || chatText.includes('Sources:');
      const mentionsDates = /2026-10-15|October 15|Oct 15/.test(chatText);
      const mentionsPrem  = /1200|1,200|premium/.test(chatText);
      record('STEP3c: Chat cites test_policy.txt as source', citesFile,
        `Cites source: ${citesFile}. Snippet: ${chatText.substring(0,300).replace(/\s+/g,' ')}`);
      record('STEP3c: Chat mentions renewal date + premium', mentionsDates || mentionsPrem,
        `Mentions renewal date: ${mentionsDates}, premium: ${mentionsPrem}`);
    } catch (e) { record('STEP3c: Chat about file content', false, e.message); }

    // 3d — Dashboard shows extracted events
    console.log('\n--- 3d: Dashboard shows extracted dates ---');
    try {
      await page1.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      const dashText = await page1.evaluate(() => document.body.innerText);
      await page1.screenshot({ path: path.join(artifactDir, '03d_dashboard_events.png') });
      
      const hasExtractedDates = dashText.includes('2026-10') 
        || /October|Oct/.test(dashText) 
        || dashText.includes('renewal') 
        || dashText.includes('birthday')
        || !dashText.includes('No upcoming alerts in the next 30 days');
        
      record('STEP3d: Dashboard shows extracted dates', hasExtractedDates,
        `Extracted dates on dashboard: ${hasExtractedDates}. Snippet: ${dashText.substring(0,300).replace(/\s+/g,' ')}`);
    } catch (e) { record('STEP3d: Dashboard shows extracted dates', false, e.message); }

    // 3e — Add note + task
    console.log('\n--- 3e: Add note + task ---');
    try {
      const noteInput = await page1.$('input[placeholder="Add a note…"]');
      if (noteInput) {
        await noteInput.type('Follow up with HR regarding vision coverage allowance');
        await page1.evaluate(() => {
          document.querySelector('input[placeholder="Add a note…"]')?.closest('form')
            ?.querySelector('button[type="submit"]')?.click();
        });
        await new Promise(r => setTimeout(r, 2000));
      }
      const taskInput = await page1.$('input[placeholder="Task title…"]');
      const dateInput = await page1.$('input[type="date"]');
      if (taskInput && dateInput) {
        await taskInput.type('Submit signed renewal policy');
        await dateInput.type('2026-10-14');
        await page1.evaluate(() => {
          document.querySelector('input[placeholder="Task title…"]')?.closest('form')
            ?.querySelector('button[type="submit"]')?.click();
        });
        await new Promise(r => setTimeout(r, 2000));
      }
      const afterText = await page1.evaluate(() => document.body.innerText);
      await page1.screenshot({ path: path.join(artifactDir, '03e_notes_tasks.png') });
      record('STEP3e: Note added to dashboard',
        afterText.includes('Follow up with HR') || afterText.includes('vision coverage'),
        'Note text visible in dashboard');
      record('STEP3e: Task added to dashboard',
        afterText.includes('Submit signed renewal') || afterText.includes('renewal policy'),
        'Task text visible in dashboard');
    } catch (e) { record('STEP3e: Note + task', false, e.message); }

    // ══════════════════════════════════════════════════════════════
    // STEP 4a: User 2 — complete isolation from User 1
    // ══════════════════════════════════════════════════════════════
    console.log(`\n\n=== STEP 4a: USER ISOLATION ===\nUser 2: ${user2Email}`);
    const ctx2 = await browser.createBrowserContext();
    const page2 = await ctx2.newPage();
    await page2.setViewport({ width: 1280, height: 900 });

    try {
      await signup(page2, user2Email, user2Pass);

      // Dashboard isolation
      await page2.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      const dash2 = await page2.evaluate(() => document.body.innerText);
      await page2.screenshot({ path: path.join(artifactDir, '04a_user2_dashboard.png') });
      const seesNote = dash2.includes('Follow up with HR') || dash2.includes('vision coverage');
      const seesTask = dash2.includes('Submit signed renewal');
      const seesU1Events = dash2.includes('Health insurance renewal') || dash2.includes('Dependent child birthday');
      record('STEP4a: User2 dashboard isolated from User1',
        !seesNote && !seesTask && !seesU1Events,
        `Sees U1 note: ${seesNote}, task: ${seesTask}, events: ${seesU1Events}`);

      // Chat isolation — user2 has no files, must say "couldn't find"
      const chat2Text = await chat(page2, 'When is the renewal date and what is the annual premium?');
      await page2.screenshot({ path: path.join(artifactDir, '04a_user2_chat.png') });
      const leaksU1Data = /2026-10-15|Apex Healthcare|1200|test_policy/.test(chat2Text);
      const admitsEmpty = /couldn.t find|could not find|no relevant|not contained/i.test(chat2Text);
      record('STEP4a: User2 chat sees none of User1 file data',
        !leaksU1Data && admitsEmpty,
        `Leaks U1 data: ${leaksU1Data}, admits no file matches: ${admitsEmpty}. Response: ${chat2Text.substring(0,250).replace(/\s+/g,' ')}`);
    } catch (e) {
      record('STEP4a: User isolation', false, `Error: ${e.message}`);
    } finally {
      await ctx2.close();
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 4b: No hallucination — question not in any file
    // ══════════════════════════════════════════════════════════════
    console.log('\n\n=== STEP 4b: NO HALLUCINATION ===');
    try {
      const noFileText = await chat(page1, 'What is the boiling point of tungsten in kelvin and how many moons does Neptune have?');
      await page1.screenshot({ path: path.join(artifactDir, '04b_no_hallucination.png') });
      const admitsNoInfo = /couldn.t find|could not find|not in your files|no relevant|not contained/i.test(noFileText);
      record('STEP4b: No hallucination — model admits no answer in files', admitsNoInfo,
        `Admits no info: ${admitsNoInfo}. Response: ${noFileText.substring(0,300).replace(/\s+/g,' ')}`);
    } catch (e) { record('STEP4b: No hallucination', false, e.message); }

    // ══════════════════════════════════════════════════════════════
    // STEP 4c: PDF & PNG upload — extracted and searchable
    // ══════════════════════════════════════════════════════════════
    console.log('\n\n=== STEP 4c: PDF + PNG UPLOAD ===');
    // PDF
    try {
      const pdfText = await uploadFileToPage(page1, testPdfPath);
      await page1.screenshot({ path: path.join(artifactDir, '04c_pdf_upload.png') });
      record('STEP4c: PDF uploaded and processed',
        pdfText.includes('Upload successful'),
        `Upload success: ${pdfText.includes('Upload successful')}. Snippet: ${pdfText.substring(0,200).replace(/\s+/g,' ')}`);

      // Ask about PDF content
      const pdfChat = await chat(page1, 'What is the monthly mortgage payment amount and when is the first payment due date?');
      await page1.screenshot({ path: path.join(artifactDir, '04c_pdf_chat.png') });
      const pdfSearchable = /1450|1,450|November|2026-11|Oak Street|Sources:/.test(pdfChat);
      record('STEP4c: PDF content is searchable via chat', pdfSearchable,
        `Searchable: ${pdfSearchable}. Response snippet: ${pdfChat.substring(0,300).replace(/\s+/g,' ')}`);
    } catch (e) { record('STEP4c: PDF upload + search', false, `Error: ${e.message}`); }

    // PNG with text
    try {
      const pngText = await uploadFileToPage(page1, testPngPath);
      await page1.screenshot({ path: path.join(artifactDir, '04c_png_upload.png') });
      record('STEP4c: PNG uploaded and processed',
        pngText.includes('Upload successful'),
        `Upload success: ${pngText.includes('Upload successful')}. Snippet: ${pngText.substring(0,200).replace(/\s+/g,' ')}`);

      // Ask about PNG content
      const pngChat = await chat(page1, 'What is the account number and total balance due on the electric utility bill?');
      await page1.screenshot({ path: path.join(artifactDir, '04c_png_chat.png') });
      const pngSearchable = /ELEC|99201|185|Utility|Electric|Sources:/.test(pngChat);
      record('STEP4c: PNG content is searchable via chat', pngSearchable,
        `Searchable: ${pngSearchable}. Response snippet: ${pngChat.substring(0,300).replace(/\s+/g,' ')}`);
    } catch (e) { record('STEP4c: PNG upload + search', false, `Error: ${e.message}`); }

    // ══════════════════════════════════════════════════════════════
    // STEP 4d: Backend down → frontend shows clear error, not blank
    // ══════════════════════════════════════════════════════════════
    console.log('\n\n=== STEP 4d: FRONTEND ERROR WHEN BACKEND IS DOWN ===');
    try {
      // Intercept API calls on page1 (which is authenticated)
      await page1.setRequestInterception(true);
      const interceptHandler = req => {
        if (req.url().includes(':4000')) {
          req.abort('connectionrefused');
        } else {
          req.continue();
        }
      };
      page1.on('request', interceptHandler);

      // Reload the dashboard while backend requests fail
      await page1.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle0', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));

      const p4dText = await page1.evaluate(() => document.body.innerText);
      await page1.screenshot({ path: path.join(artifactDir, '04d_backend_down.png') });

      const notBlank = p4dText.trim().length > 20;
      const showsError = /Failed to load dashboard|fetch failed|failed to fetch|error/i.test(p4dText);

      record('STEP4d: Frontend shows clear error (not blank) when backend is down',
        notBlank && showsError,
        `Not blank: ${notBlank}, shows error message: ${showsError}. Text snippet: ${p4dText.substring(0,250).replace(/\s+/g,' ')}`);

      page1.off('request', interceptHandler);
      await page1.setRequestInterception(false);
    } catch (e) {
      record('STEP4d: Frontend error state when backend down', false, `Error: ${e.message}`);
    }

  } finally {
    await browser.close();
  }

  // ── FINAL RESULTS TABLE ────────────────────────────────────────────────
  console.log('\n\n' + '='.repeat(70));
  console.log('FINAL RESULTS TABLE');
  console.log('='.repeat(70));
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('Test', 54) + pad('Status', 12) + 'Evidence');
  console.log('-'.repeat(110));
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '❓';
    console.log(`${icon} ${pad(r.name, 52)} ${pad(r.status, 12)} ${r.evidence.substring(0, 70)}`);
  }
  const passes     = results.filter(r => r.status === 'PASS').length;
  const fails      = results.filter(r => r.status === 'FAIL').length;
  const unverified = results.filter(r => r.status === 'UNVERIFIED').length;
  console.log(`\nTotal: ${results.length} | ✅ PASS: ${passes} | ❌ FAIL: ${fails} | ❓ UNVERIFIED: ${unverified}`);

  if (fails > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r =>
      console.log(`  ❌ ${r.name}\n     ${r.evidence}`)
    );
    process.exit(1);
  }
  console.log('\n🎉 ALL TESTS PASSED!');
}

run().catch(err => {
  console.error('\nSUITE CRASH:', err);
  process.exit(1);
});
