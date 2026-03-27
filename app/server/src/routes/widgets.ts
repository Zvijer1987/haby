import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../lib/auth.js';
import { nowIso } from '../lib/time.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const user = (req as any).authUser;
  const widgets = db.prepare(`SELECT * FROM widgets WHERE user_id = ? ORDER BY sort_order ASC, id ASC`).all(user.id) as any[];
  res.json({ widgets: widgets.map((w) => ({ ...w, config: JSON.parse(w.config_json || '{}') })) });
});

router.post('/', (req, res) => {
  const user = (req as any).authUser;
  const type = String(req.body?.type || 'current');
  const label = String(req.body?.label || 'Widget');
  const config = req.body?.config || {};
  const nextOrder = (db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS value FROM widgets WHERE user_id = ?`).get(user.id) as any).value + 1;
  db.prepare(`INSERT INTO widgets (user_id, type, label, config_json, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(user.id, type, label, JSON.stringify(config), nextOrder, nowIso());
  res.json({ ok: true });
});

router.put('/reorder', (req, res) => {
  const user = (req as any).authUser;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  const update = db.prepare(`UPDATE widgets SET sort_order = ? WHERE user_id = ? AND id = ?`);
  ids.forEach((id: number, index: number) => update.run(index, user.id, id));
  res.json({ ok: true });
});

router.put('/:id', (req, res) => {
  const user = (req as any).authUser;
  const label = String(req.body?.label || 'Widget');
  const config = req.body?.config || {};
  db.prepare(`UPDATE widgets SET label = ?, config_json = ? WHERE user_id = ? AND id = ?`)
    .run(label, JSON.stringify(config), user.id, Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const user = (req as any).authUser;
  db.prepare(`DELETE FROM widgets WHERE user_id = ? AND id = ?`).run(user.id, Number(req.params.id));
  res.json({ ok: true });
});

export default router;
