import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\91996\\.gemini\\antigravity\\brain\\c6a4994c-8db0-4bc4-b4e0-c7b13e9fe8b9';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('1. Visiting Landing Page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(artifactDir, 'screenshot_landing.png') });
  console.log('Saved screenshot_landing.png');

  console.log('2. Visiting Sign Up Page...');
  await page.goto('http://localhost:3000/signup', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(artifactDir, 'screenshot_signup.png') });
  console.log('Saved screenshot_signup.png');

  console.log('3. Submitting Sign Up Form with test user...');
  await page.type('input[type="email"]', 'testuser_' + Date.now() + '@example.com');
  await page.type('input[type="password"]', 'VaultPassword123!');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(artifactDir, 'screenshot_signup_submitted.png') });
  console.log('Saved screenshot_signup_submitted.png');

  console.log('4. Visiting Log In Page...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(artifactDir, 'screenshot_login.png') });
  console.log('Saved screenshot_login.png');

  console.log('5. Visiting Upload Page (unauthenticated redirects to login)...');
  await page.goto('http://localhost:3000/upload', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(artifactDir, 'screenshot_upload_redirect.png') });
  console.log('Saved screenshot_upload_redirect.png, current url:', page.url());

  console.log('6. Visiting Chat Page (unauthenticated redirects to login)...');
  await page.goto('http://localhost:3000/chat', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(artifactDir, 'screenshot_chat_redirect.png') });
  console.log('Saved screenshot_chat_redirect.png, current url:', page.url());

  console.log('7. Visiting Dashboard Page (unauthenticated redirects to login)...');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(artifactDir, 'screenshot_dashboard_redirect.png') });
  console.log('Saved screenshot_dashboard_redirect.png, current url:', page.url());

  await browser.close();
  console.log('Finished Puppeteer run successfully');
}

run().catch(err => {
  console.error('Puppeteer run error:', err);
  process.exit(1);
});
