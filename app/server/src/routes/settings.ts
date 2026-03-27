import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const user = (req as any).authUser;
  const rows = db.prepare(`SELECT key, value FROM settings WHERE user_id = ?`).all(user.id) as any[];
  const settings: Record<string, string> = {};
  rows.forEach((row) => { settings[row.key] = row.value; });
  res.json({ settings });
});

router.put('/:key', (req, res) => {
  const user = (req as any).authUser;
  const key = String(req.params.key);
  const value = String(req.body?.value ?? '');
  db.prepare(`INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`)
    .run(user.id, key, value);
  res.json({ ok: true });
});

export default router;
