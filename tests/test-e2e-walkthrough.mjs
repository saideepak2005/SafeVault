import puppeteer from 'puppeteer-core';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\91996\\.gemini\\antigravity\\brain\\c6a4994c-8db0-4bc4-b4e0-c7b13e9fe8b9';
const testFilePath = 'S:\\projects\\supabase\\test_policy.txt';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER PAGE ERROR:', err));

  const testEmail = `vault_user_${Date.now()}@gmail.com`;
  const testPassword = 'VaultPassword2026!';

  console.log(`\n=== 1. SIGN UP A FRESH USER: ${testEmail} ===`);
  await page.goto('http://localhost:3000/signup', { waitUntil: 'networkidle0' });
  await page.type('input[type="email"]', testEmail);
  await page.type('input[type="password"]', testPassword);
  
  await page.screenshot({ path: path.join(artifactDir, '01_signup_filled.png') });
  console.log('Saved 01_signup_filled.png');

  await page.click('button[type="submit"]');

  // Wait for redirect to /dashboard
  console.log('Waiting for redirect to /dashboard...');
  await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 15000 });
  console.log('Current URL after signup:', page.url());
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, '02_initial_dashboard.png') });
  console.log('Saved 02_initial_dashboard.png');

  console.log('\n=== 2. UPLOAD TEST DOCUMENT ===');
  await page.goto('http://localhost:3000/upload', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) throw new Error('File input element not found');
  await fileInput.uploadFile(testFilePath);

  console.log('Uploaded test file, waiting for backend processing (classification, embedding, storage)...');
  await page.waitForFunction(() => document.body.innerText.includes('Upload successful'), { timeout: 60000 });

  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, '03_upload_result.png') });
  console.log('Saved 03_upload_result.png');

  console.log('\n=== 3. CHAT WITH UPLOADED FILE ===');
  await page.goto('http://localhost:3000/chat', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  const chatInput = await page.$('input[placeholder*="Ask"]');
  if (!chatInput) throw new Error('Chat input not found');
  await chatInput.type('When is the renewal date and how much is the annual premium?');
  
  await page.click('button[type="submit"]');
  console.log('Chat question submitted, waiting for vector retrieval + LLM answer...');

  // Wait for assistant reply with sources
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return text.includes('Sources:') || text.includes('test_policy.txt');
  }, { timeout: 60000 });

  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, '04_chat_answer_with_sources.png') });
  console.log('Saved 04_chat_answer_with_sources.png');

  console.log('\n=== 4. DASHBOARD - EVENTS, NOTES, AND TASKS ===');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2500));

  // Add a manual note
  console.log('Adding manual note...');
  const noteInput = await page.$('input[placeholder="Add a note…"]');
  if (noteInput) {
    await noteInput.type('Follow up with HR regarding vision coverage allowance');
    await page.evaluate(() => {
      const noteInput = document.querySelector('input[placeholder="Add a note…"]');
      const form = noteInput?.closest('form');
      form?.querySelector('button[type="submit"]')?.click();
    });
    await new Promise(r => setTimeout(r, 2000));
  }

  // Add a manual task
  console.log('Adding manual task...');
  const taskTitleInput = await page.$('input[placeholder="Task title…"]');
  const taskDateInput = await page.$('input[type="date"]');
  if (taskTitleInput && taskDateInput) {
    await taskTitleInput.type('Submit signed renewal policy');
    await taskDateInput.type('2026-10-14');
    await page.evaluate(() => {
      const taskInput = document.querySelector('input[placeholder="Task title…"]');
      const form = taskInput?.closest('form');
      form?.querySelector('button[type="submit"]')?.click();
    });
    await new Promise(r => setTimeout(r, 2000));
  }

  // Toggle the task checkbox
  console.log('Toggling task completion...');
  await page.evaluate(() => {
    const checkbox = document.querySelector('input[type="checkbox"]');
    checkbox?.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: path.join(artifactDir, '05_dashboard_with_all_sections.png') });
  console.log('Saved 05_dashboard_with_all_sections.png');

  await browser.close();
  console.log('\n=== E2E WALKTHROUGH TEST COMPLETED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('\nE2E WALKTHROUGH ERROR:', err);
  process.exit(1);
});
