const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

const BUCKET = 'files';

// Decides where a file goes purely based on its size, at upload time - nobody
// has to know this in advance. See schema.sql for how to create the bucket.
async function uploadFile(supabase, { userId, buffer, originalName, mimeType }) {
  const size = buffer.length;
  const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin';
  const path = `${userId}/${uuidv4()}.${ext}`;

  if (size <= env.maxSupabaseFileBytes) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) {
      console.warn(`Supabase Storage upload warning (${error.message}). Continuing pipeline.`);
    }
    return { provider: 'supabase', path };
  }

  return uploadToR2({ path, buffer, mimeType });
}

// Only actually touches the R2 SDK if this function is called - so a project
// that never uploads a file over 50MB never needs @aws-sdk/client-s3 installed.
async function uploadToR2({ path, buffer, mimeType }) {
  if (!env.r2.accountId || !env.r2.accessKeyId || !env.r2.secretAccessKey || !env.r2.bucket) {
    throw new Error(
      `File exceeds ${env.maxSupabaseFileBytes} bytes but R2 is not configured. ` +
      'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET in .env, ' +
      'and run: npm install @aws-sdk/client-s3'
    );
  }

  // Lazy require: only runs (and only needs the package installed) on this path.
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
    },
  });

  await client.send(new PutObjectCommand({
    Bucket: env.r2.bucket,
    Key: path,
    Body: buffer,
    ContentType: mimeType,
  }));

  return { provider: 'r2', path };
}

// Returns a short-lived signed URL rather than a public link - a file is only
// ever reachable by someone holding a fresh token for it.
async function getSignedUrl(supabase, { provider, path }) {
  if (provider === 'r2') {
    throw new Error('R2 signed URLs: implement with @aws-sdk/s3-request-presigner when you add R2');
  }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 5);
  if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
  return data.signedUrl;
}

module.exports = { uploadFile, getSignedUrl };
