const express = require('express');
const cors = require('cors');
const env = require('./config/env');

const uploadRoute = require('./routes/upload');
const chatRoute = require('./routes/chat');
const dashboardRoute = require('./routes/dashboard');

const app = express();

// CORS: allow origins listed in FRONTEND_ORIGIN (comma-separated), plus localhost
// for local dev. Example .env entry: FRONTEND_ORIGIN=https://vault.vercel.app
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : []),
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser callers (curl, Puppeteer, Postman) with no Origin header
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/upload', uploadRoute);
app.use('/api/chat', chatRoute);
app.use('/api/dashboard', dashboardRoute);

// Last-resort error handler - keeps a stray thrown error from crashing the
// whole process mid-demo instead of just returning a clean 500.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(env.port, () => {
  console.log(`Vault backend listening on port ${env.port}`);
});
