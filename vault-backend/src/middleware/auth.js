const { anonClient, clientForToken } = require('../config/supabaseClient');

// Expects: Authorization: Bearer <supabase_access_token>
// The frontend gets this token from supabase.auth.signInWithPassword() (or signUp),
// then sends it on every API call. See README for how to get a test token with curl.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization: Bearer <token> header' });
  }

  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = data.user;
  req.token = token;
  req.supabase = clientForToken(token); // every query made with this client is RLS-scoped
  next();
}

module.exports = { requireAuth };
