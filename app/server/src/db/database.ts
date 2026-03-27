import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = '/data';
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'haby.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
