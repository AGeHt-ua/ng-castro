-- CASTRO: Empire — стан гравців і кеш перевірки ролі
CREATE TABLE IF NOT EXISTS empire (
  user_id    TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  avatar     TEXT,
  cash       REAL NOT NULL DEFAULT 0,
  earned     REAL NOT NULL DEFAULT 0,
  levels     TEXT NOT NULL DEFAULT '{}',
  hq         INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS empire_earned ON empire (earned DESC);

CREATE TABLE IF NOT EXISTS access_cache (
  user_id    TEXT PRIMARY KEY,
  ok         INTEGER NOT NULL,
  checked_at INTEGER NOT NULL
);
