CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  reveal_blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('reset', 'verify')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_tokens_user_idx ON auth_tokens(user_id, kind);

CREATE TABLE IF NOT EXISTS secrets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'screentime',
  payload text NOT NULL,
  unlock_at timestamptz NOT NULL,
  reveal_count integer NOT NULL DEFAULT 0,
  last_revealed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS secrets_user_idx ON secrets(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_user_idx ON events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limits_key_idx ON rate_limits(key, created_at);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

ALTER TABLE secrets ADD COLUMN IF NOT EXISTS retrieval_seconds integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS passkeys (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key text NOT NULL,
  counter integer NOT NULL DEFAULT 0,
  transports text,
  label text NOT NULL DEFAULT 'Passkey',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS passkeys_user_idx ON passkeys(user_id);

CREATE TABLE IF NOT EXISTS passkey_challenges (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS retrievals (
  id uuid PRIMARY KEY,
  secret_id uuid NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  required_seconds integer NOT NULL,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'done', 'failed', 'used')),
  next_check_at timestamptz NOT NULL,
  challenge text,
  challenge_deadline timestamptz,
  checks_passed integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retrievals_secret_idx ON retrievals(secret_id, created_at DESC);
