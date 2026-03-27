export const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  force_password_change INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, name),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category_id INTEGER,
  period TEXT NOT NULL DEFAULT 'daily',
  target_count INTEGER NOT NULL DEFAULT 1,
  expected_per_day REAL NOT NULL DEFAULT 1,
  repeatable INTEGER NOT NULL DEFAULT 0,
  repeat_group TEXT NOT NULL DEFAULT '',
  repeat_index INTEGER NOT NULL DEFAULT 1,
  repeat_base_name TEXT NOT NULL DEFAULT '',
  repeat_anchor_date TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '⭐',
  color TEXT NOT NULL DEFAULT '#7dd3fc',
  visualization TEXT NOT NULL DEFAULT 'bar',
  allow_overcomplete INTEGER NOT NULL DEFAULT 1,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  card_background_type TEXT NOT NULL DEFAULT 'color',
  card_background_value TEXT NOT NULL DEFAULT '#ffffff',
  card_overlay_opacity REAL NOT NULL DEFAULT 0.14,
  show_mini_calendar INTEGER NOT NULL DEFAULT 1,
  show_chart INTEGER NOT NULL DEFAULT 1,
  chart_type TEXT NOT NULL DEFAULT 'line',
  habit_type TEXT NOT NULL DEFAULT 'standard',
  unit_label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CHECK(target_count >= 1 AND target_count <= 1000000000)
);

CREATE TABLE IF NOT EXISTS habit_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL,
  entry_date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(habit_id, entry_date),
  FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY(user_id, key),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;
