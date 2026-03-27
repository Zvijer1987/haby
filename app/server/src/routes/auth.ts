import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db/database.js';
import { clearSession, createSession, invalidateUserSessions, requireAdmin, requireAuth } from '../lib/auth.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { nowIso } from '../lib/time.js';
import { seedDefaultsForUser } from '../db/init.js';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

function serializeUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    isAdmin: !!row.is_admin,
    forcePasswordChange: !!row.force_password_change,
    isDisabled: !!row.is_disabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

router.post('/login', loginLimiter, async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as any;
  if (!row) return res.status(401).json({ error: 'Invalid credentials' });
  if (row.is_disabled) return res.status(403).json({ error: 'Account disabled' });
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  createSession(res, row.id);
  seedDefaultsForUser(row.id);
  res.json({ user: serializeUser(row) });
});

router.post('/logout', (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = (req as any).authUser;
  seedDefaultsForUser(user.id);
  res.json({ user });
});

router.post('/change-username', requireAuth, (req, res) => {
  const user = (req as any).authUser;
  const username = String(req.body?.username || '').trim();
  if (!username) return res.status(400).json({ error: 'Username required' });
  db.prepare(`UPDATE users SET username = ?, updated_at = ? WHERE id = ?`).run(username, nowIso(), user.id);
  const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id) as any;
  res.json({ user: serializeUser(updated) });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const user = (req as any).authUser;
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (!newPassword) return res.status(400).json({ error: 'New password required' });
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id) as any;
  const ok = await verifyPassword(currentPassword, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
  const hash = await hashPassword(newPassword);
  db.prepare(`UPDATE users SET password_hash = ?, force_password_change = 0, updated_at = ? WHERE id = ?`).run(hash, nowIso(), user.id);
  invalidateUserSessions(user.id);
  clearSession(req, res);
  res.json({ ok: true, requiresReauth: true });
});

router.get('/users', requireAuth, requireAdmin, (_req, res) => {
  const rows = db.prepare(`SELECT * FROM users ORDER BY username ASC`).all() as any[];
  res.json({ users: rows.map(serializeUser) });
});

router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const isAdmin = !!req.body?.isAdmin;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const hash = await hashPassword(password);
  const now = nowIso();
  const result = db.prepare(
    `INSERT INTO users (username, password_hash, is_admin, force_password_change, is_disabled, created_at, updated_at)
     VALUES (?, ?, ?, 0, 0, ?, ?)`
  ).run(username, hash, isAdmin ? 1 : 0, now, now);
  const userId = Number(result.lastInsertRowid);
  seedDefaultsForUser(userId);
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as any;
  res.json({ user: serializeUser(row) });
});

router.post('/users/:id/disable', requireAuth, requireAdmin, (req, res) => {
  db.prepare(`UPDATE users SET is_disabled = 1, updated_at = ? WHERE id = ?`).run(nowIso(), Number(req.params.id));
  invalidateUserSessions(Number(req.params.id));
  res.json({ ok: true });
});

router.post('/users/:id/enable', requireAuth, requireAdmin, (req, res) => {
  db.prepare(`UPDATE users SET is_disabled = 0, updated_at = ? WHERE id = ?`).run(nowIso(), Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM users WHERE id = ?`).run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
