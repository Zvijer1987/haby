import { nanoid } from 'nanoid';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../db/database.js';
import { addDays, nowIso } from './time.js';

export type SessionUser = {
  id: number;
  username: string;
  isAdmin: boolean;
  forcePasswordChange: boolean;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
};

function useSecureCookies() {
  return process.env.COOKIE_SECURE === 'true';
}

export function createSession(res: Response, userId: number) {
  const id = nanoid(40);
  db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
  ).run(id, userId, nowIso(), addDays(30));

  res.cookie('haby_session', id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookies(),
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

export function clearSession(req: Request, res: Response) {
  const sid = req.cookies?.haby_session;
  if (sid) db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sid);
  res.clearCookie('haby_session', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookies()
  });
}

export function getAuthUser(req: Request): SessionUser | null {
  const sid = req.cookies?.haby_session;
  if (!sid) return null;
  const row = db.prepare(
    `SELECT u.id, u.username, u.is_admin, u.force_password_change, u.is_disabled, u.created_at, u.updated_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`
  ).get(sid, nowIso()) as any;
  if (!row) return null;
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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (user.isDisabled) return res.status(403).json({ error: 'Account disabled' });
  (req as any).authUser = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).authUser as SessionUser | undefined;
  if (!user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

export function invalidateUserSessions(userId: number) {
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
}
