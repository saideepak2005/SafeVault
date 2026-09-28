/**
 * Storage Security Isolation & Unsupported File Type Test
 * Tests:
 * 1. User 2 cannot download or access a signed URL for User 1's files in the 'files' bucket (RLS enforcement).
 * 2. Uploading an unsupported file type (.zip) returns a clean response, not a process crash.
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { createClient } = require('../vault-backend/node_modules/@supabase/supabase-js');

// Read backend .env for credentials
let envPath = 's:\\projects\\supabase\\vault-backend\\.env';
if (!existsSync(envPath)) {
  envPath = path.resolve('../vault-backend/.env');
}

const envContent = readFileSync(envPath, 'utf8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
}

const supabaseUrl = envVars.SUPABASE_URL;
const supabaseAnonKey = envVars.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, supabaseAnonKey);

function clientWithToken(token) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

async function run() {
  console.log('='.repeat(65));
  console.log('STORAGE SECURITY ISOLATION & UNSUPPORTED FILE TYPE TEST');
  console.log('='.repeat(65));

  const ts = Date.now();
  const u1Email = `sec_user1_${ts}@test.example`;
  const u1Pass = 'StorageTestPass1!';
  const u2Email = `sec_user2_${ts}@test.example`;
  const u2Pass = 'StorageTestPass2!';

  // 1. Sign up User 1
  console.log(`\n1. Signing up User 1: ${u1Email}`);
  const { data: u1Data, error: u1Err } = await anonClient.auth.signUp({
    email: u1Email,
    password: u1Pass,
  });
  if (u1Err || !u1Data.session) {
    throw new Error(`User 1 signup failed: ${u1Err?.message}`);
  }
  const user1 = u1Data.user;
  const token1 = u1Data.session.access_token;
  const sb1 = clientWithToken(token1);
  console.log(`User 1 created: ID=${user1.id}`);

  // 2. User 1 uploads a file to 'files' bucket
  const user1FilePath = `${user1.id}/confidential_record.txt`;
  const fileContent = Buffer.from('CONFIDENTIAL: User 1 financial statement details.');
  console.log(`\n2. User 1 uploading file: ${user1FilePath}`);
  const { data: uploadData, error: uploadErr } = await sb1.storage
    .from('files')
    .upload(user1FilePath, fileContent, { contentType: 'text/plain', upsert: true });

  if (uploadErr) {
    throw new Error(`User 1 upload failed: ${uploadErr.message}`);
  }
  console.log(`File uploaded successfully: ${uploadData.path}`);

  // User 1 verifies they can download their own file
  const { data: selfDownload, error: selfErr } = await sb1.storage.from('files').download(user1FilePath);
  if (selfErr || !selfDownload) {
    throw new Error(`User 1 self-download failed: ${selfErr?.message}`);
  }
  console.log('User 1 verified: can download own file.');

  // 3. Sign up User 2
  console.log(`\n3. Signing up User 2: ${u2Email}`);
  const { data: u2Data, error: u2Err } = await anonClient.auth.signUp({
    email: u2Email,
    password: u2Pass,
  });
  if (u2Err || !u2Data.session) {
    throw new Error(`User 2 signup failed: ${u2Err?.message}`);
  }
  const user2 = u2Data.user;
  const token2 = u2Data.session.access_token;
  const sb2 = clientWithToken(token2);
  console.log(`User 2 created: ID=${user2.id}`);

  // 4. User 2 attempts to download User 1's file
  console.log(`\n4. User 2 attempting to DOWNLOAD User 1's file: ${user1FilePath}`);
  const { data: u2Download, error: u2DownloadErr } = await sb2.storage.from('files').download(user1FilePath);

  let downloadBlocked = false;
  if (u2DownloadErr) {
    downloadBlocked = true;
    console.log(`User 2 download was REJECTED as expected: ${u2DownloadErr.message}`);
  } else if (!u2Download || u2Download.size === 0) {
    downloadBlocked = true;
    console.log('User 2 download returned empty/null data.');
  } else {
    console.error('SECURITY FAILURE: User 2 was able to download User 1 file!');
  }

  // 5. User 2 attempts to create a signed URL for User 1's file
  console.log(`\n5. User 2 attempting to CREATE SIGNED URL for User 1's file: ${user1FilePath}`);
  const { data: u2Signed, error: u2SignedErr } = await sb2.storage.from('files').createSignedUrl(user1FilePath, 60);

  let signedUrlBlocked = false;
  if (u2SignedErr) {
    signedUrlBlocked = true;
    console.log(`User 2 createSignedUrl was REJECTED by policy: ${u2SignedErr.message}`);
  } else if (u2Signed?.signedUrl) {
    // If Supabase creates a signed URL without validating up-front, the GET request to the URL must fail (RLS enforcement on fetch)
    console.log('User 2 received signed URL, testing HTTP GET request to verify token authorization...');
    const urlRes = await fetch(u2Signed.signedUrl);
    if (!urlRes.ok || urlRes.status === 400 || urlRes.status === 403 || urlRes.status === 404) {
      signedUrlBlocked = true;
      console.log(`Signed URL HTTP request returned ${urlRes.status} (Access Denied / Not Found as expected).`);
    } else {
      const leakedBody = await urlRes.text();
      console.error(`SECURITY FAILURE: Signed URL returned ${urlRes.status} with content: ${leakedBody}`);
    }
  } else {
    signedUrlBlocked = true;
    console.log('User 2 signed URL generation returned empty.');
  }

  const crossUserAccessBlocked = downloadBlocked && signedUrlBlocked;
  console.log('\n-------------------------------------------------------------');
  console.log(`ITEM 5 RESULT: Cross-User Storage Access Blocked: ${crossUserAccessBlocked ? 'PASS' : 'FAIL'}`);
  console.log(`- Direct Download Blocked: ${downloadBlocked ? 'YES (PASS)' : 'NO (FAIL)'}`);
  console.log(`- Signed URL Access Blocked: ${signedUrlBlocked ? 'YES (PASS)' : 'NO (FAIL)'}`);
  console.log('-------------------------------------------------------------');

  // 6. Test backend "unsupported file type" path (.zip)
  console.log('\n6. Testing backend upload with unsupported file type (backup.zip)...');
  const zipBuffer = Buffer.from('PK\x03\x04\x14\x00\x00\x00\x08\x00DummyZipFileContentForTestingOnly');
  const blob = new Blob([zipBuffer], { type: 'application/zip' });
  const form = new FormData();
  form.append('file', blob, 'backup.zip');

  const uploadRes = await fetch('http://localhost:4000/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
    body: form,
  });

  const uploadJson = await uploadRes.json();
  const serverHealthy = uploadRes.status === 200 || uploadRes.status === 201;
  const noCrash = !uploadJson.error || uploadJson.file;

  console.log(`Upload status code: ${uploadRes.status}`);
  console.log('Response body:', JSON.stringify(uploadJson, null, 2));

  // Health check to verify backend didn't crash
  const healthRes = await fetch('http://localhost:4000/health');
  const healthJson = await healthRes.json();
  const isHealthy = healthJson.status === 'ok';
  console.log(`Backend health after .zip upload: ${isHealthy ? 'OK (healthy)' : 'FAILED'}`);

  const unsupportedCleanHandling = serverHealthy && isHealthy;
  console.log('-------------------------------------------------------------');
  console.log(`ITEM 6 RESULT: Unsupported File Type Clean Handling: ${unsupportedCleanHandling ? 'PASS' : 'FAIL'}`);
  console.log(`- HTTP Status: ${uploadRes.status} (clean handled)`);
  console.log(`- Categorized cleanly as: "${uploadJson.file?.category}" (stored without crash)`);
  console.log(`- Backend alive: ${isHealthy}`);
  console.log('-------------------------------------------------------------');

  if (!crossUserAccessBlocked || !unsupportedCleanHandling) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('\nTEST ERROR:', err);
  process.exit(1);
});
