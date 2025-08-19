-- Tabela principal de tokens
CREATE TABLE IF NOT EXISTS tokens (
  address TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL,
  symbol TEXT,
  name TEXT,
  last_hype INTEGER DEFAULT 0,
  last_safety INTEGER DEFAULT 0,
  last_seen INTEGER NOT NULL -- epoch ms
);

-- Registro de buscas (para ranking por hits/janela)
CREATE TABLE IF NOT EXISTS searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_searches_ts ON searches(ts);
CREATE INDEX IF NOT EXISTS idx_searches_addr ON searches(address);
