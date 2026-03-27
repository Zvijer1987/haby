import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../lib/auth.js';
import { nowIso } from '../lib/time.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const user = (req as any).authUser;
  const categories = db.prepare(`SELECT id, name, is_builtin FROM categories WHERE user_id = ? ORDER BY name ASC`).all(user.id);
  res.json({ categories });
});

router.post('/', (req, res) => {
  const user = (req as any).authUser;
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  db.prepare(`INSERT INTO categories (user_id, name, is_builtin, created_at) VALUES (?, ?, 0, ?)`)
    .run(user.id, name, nowIso());
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const user = (req as any).authUser;
  db.prepare(`UPDATE habits SET category_id = NULL WHERE user_id = ? AND category_id = ?`).run(user.id, Number(req.params.id));
  db.prepare(`DELETE FROM categories WHERE user_id = ? AND id = ?`).run(user.id, Number(req.params.id));
  res.json({ ok: true });
});

export default router;
