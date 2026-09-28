const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// A client with no user JWT attached - only usable for auth.getUser() to verify
// a token. Never used for data queries, since it would run without RLS context.
const anonClient = createClient(env.supabaseUrl, env.supabaseAnonKey);

// Creates a per-request client that forwards the caller's JWT to Postgres.
// This is what makes RLS enforce automatically - every query this client runs
// carries auth.uid() = the actual logged-in user, so a bug in our route code
// (e.g. forgetting a WHERE user_id = ...) still can't leak another user's rows.
function clientForToken(accessToken) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { persistSession: false },
  });
}

module.exports = { anonClient, clientForToken };
