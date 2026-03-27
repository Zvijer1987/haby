import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../lib/auth.js';
import { addDaysLocalIso, localDate, nowIso, parseLocalDate, startOfMonthIso, startOfWeekIso, todayIso } from '../lib/time.js';

const router = Router();
router.use(requireAuth);

function periodStartIso(period: 'daily' | 'weekly' | 'monthly', dateIso = todayIso()) {
  if (period === 'weekly') return startOfWeekIso(dateIso);
  if (period === 'monthly') return startOfMonthIso(dateIso);
  return dateIso;
}

function nextPeriodStartIso(period: 'daily' | 'weekly' | 'monthly', startIso: string) {
  const start = parseLocalDate(startIso);
  if (period === 'weekly') {
    start.setDate(start.getDate() + 7);
    return localDate(start);
  }
  if (period === 'monthly') {
    return localDate(new Date(start.getFullYear(), start.getMonth() + 1, 1));
  }
  start.setDate(start.getDate() + 1);
  return localDate(start);
}

function periodLabel(period: 'daily' | 'weekly' | 'monthly') {
  if (period === 'weekly') return 'This Week';
  if (period === 'monthly') return 'This Month';
  return 'Today';
}

function periodDiff(period: 'daily' | 'weekly' | 'monthly', anchorIso: string, currentIso: string) {
  const anchor = parseLocalDate(periodStartIso(period, anchorIso));
  const current = parseLocalDate(periodStartIso(period, currentIso));
  if (period === 'monthly') return (current.getFullYear() - anchor.getFullYear()) * 12 + (current.getMonth() - anchor.getMonth());
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((current.getTime() - anchor.getTime()) / msPerDay);
  return period === 'weekly' ? Math.floor(diffDays / 7) : diffDays;
}

function suffix(period: 'daily' | 'weekly' | 'monthly', index: number) {
  if (period === 'weekly') return ` (Week ${index})`;
  if (period === 'monthly') return ` (Month ${index})`;
  return ` (Day ${index})`;
}

function ensureRepeatableHabitsForUser(userId: number) {
  const today = todayIso();
  const groups = db.prepare(`SELECT repeat_group FROM habits WHERE user_id = ? AND repeatable = 1 AND repeat_group <> '' GROUP BY repeat_group`).all(userId) as any[];
  for (const groupRow of groups) {
    const group = String(groupRow.repeat_group || '');
    if (!group) continue;
    const rows = db.prepare(`SELECT * FROM habits WHERE user_id = ? AND repeat_group = ? ORDER BY repeat_index ASC, id ASC`).all(userId, group) as any[];
    if (!rows.length) continue;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const anchor = String(first.repeat_anchor_date || first.created_at?.slice?.(0, 10) || today);
    const totalNeeded = periodDiff(first.period, anchor, today) + 1;
    let currentMax = Number(last.repeat_index || rows.length || 1);
    while (currentMax < totalNeeded) {
      const nextIndex = currentMax + 1;
      const nextOrder = (db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS value FROM habits WHERE user_id = ?`).get(userId) as any).value + 1;
      db.prepare(
        `INSERT INTO habits (
          user_id, name, description, category_id, period, target_count, expected_per_day, icon, color, visualization,
          allow_overcomplete, is_archived, created_at, updated_at, card_background_type, card_background_value,
          card_overlay_opacity, show_mini_calendar, show_chart, chart_type, habit_type, unit_label, sort_order,
          repeatable, repeat_group, repeat_index, repeat_base_name, repeat_anchor_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
      ).run(
        userId,
        `${first.repeat_base_name || first.name}${suffix(first.period, nextIndex)}`,
        first.description || '',
        first.category_id || null,
        first.period,
        Number(first.target_count || 1),
        Number(first.expected_per_day || 1),
        first.icon || '⭐',
        first.color || '#93c5fd',
        first.visualization || 'bar',
        Number(first.allow_overcomplete ?? 1),
        nowIso(),
        nowIso(),
        first.card_background_type || 'color',
        first.card_background_value || '#ffffff',
        Number(first.card_overlay_opacity ?? 0.14),
        Number(first.show_mini_calendar ?? 1),
        Number(first.show_chart ?? 1),
        first.chart_type || 'line',
        first.habit_type || 'standard',
        first.unit_label || '',
        nextOrder,
        group,
        nextIndex,
        first.repeat_base_name || first.name,
        anchor
      );
      currentMax = nextIndex;
    }
  }
}

function getProgress(habit: any) {
  const period = (habit.period || 'daily') as 'daily' | 'weekly' | 'monthly';
  const start = periodStartIso(period, todayIso());
  const next = nextPeriodStartIso(period, start);
  const amountRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM habit_entries WHERE habit_id = ? AND entry_date >= ? AND entry_date < ?`).get(habit.id, start, next) as any;
  const current = Number(amountRow.total || 0);
  const target = Number(habit.target_count || 1);
  const expectedPerDay = Math.max(1, Number(habit.expected_per_day || 1));
  const percent = Math.min(100, Math.round((current / Math.max(target, 1)) * 100));
  return {
    current,
    displayCurrent: current,
    target,
    remaining: Math.max(0, target - current),
    percent,
    isCompleted: current >= target,
    isOvercompleted: current > target,
    label: `${current} / ${target}${habit.unit_label ? ' ' + habit.unit_label : ''}`,
    periodStart: start,
    nextPeriodStart: next,
    periodLabel: periodLabel(period),
    today: todayIso(),
    extras: Math.max(0, current - expectedPerDay)
  };
}

function getStreaks(habitId: number) {
  const rows = db.prepare(`SELECT entry_date FROM habit_entries WHERE habit_id = ? ORDER BY entry_date DESC LIMIT 365`).all(habitId) as any[];
  const set = new Set(rows.map((row) => row.entry_date));
  let daily = 0;
  let cursorIso = todayIso();
  for (;;) {
    if (!set.has(cursorIso)) break;
    daily += 1;
    cursorIso = addDaysLocalIso(-1, cursorIso);
  }
  return { daily, weekly: Math.floor(daily / 7), monthly: Math.floor(daily / 30) };
}

function serializeHabit(row: any) {
  const categoryNameRow = row.category_id
    ? (db.prepare(`SELECT name FROM categories WHERE id = ?`).get(row.category_id) as any)
    : null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    categoryName: categoryNameRow?.name ?? null,
    period: row.period,
    targetCount: row.target_count,
    expectedPerDay: Number(row.expected_per_day || 1),
    repeatable: !!row.repeatable,
    repeatIndex: Number(row.repeat_index || 1),
    repeatGroup: row.repeat_group || '',
    repeatBaseName: row.repeat_base_name || row.name,
    repeatAnchorDate: row.repeat_anchor_date || row.created_at,
    icon: row.icon,
    color: row.color,
    visualization: row.visualization,
    allowOvercomplete: !!row.allow_overcomplete,
    isArchived: !!row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cardBackgroundType: row.card_background_type,
    cardBackgroundValue: row.card_background_value,
    cardOverlayOpacity: row.card_overlay_opacity,
    showMiniCalendar: !!row.show_mini_calendar,
    showChart: !!row.show_chart,
    chartType: row.chart_type,
    habitType: row.habit_type,
    unitLabel: row.unit_label,
    sortOrder: row.sort_order,
    progress: getProgress(row),
    streaks: getStreaks(row.id)
  };
}

router.get('/', (req, res) => {
  const user = (req as any).authUser;
  ensureRepeatableHabitsForUser(user.id);
  const rows = db.prepare(`SELECT * FROM habits WHERE user_id = ? ORDER BY is_archived ASC, sort_order ASC, id ASC`).all(user.id) as any[];
  res.json({ habits: rows.map(serializeHabit) });
});

router.get('/:id/history', (req, res) => {
  const user = (req as any).authUser;
  const rows = db.prepare(
    `SELECT e.entry_date AS date, e.amount AS value
     FROM habit_entries e JOIN habits h ON h.id = e.habit_id
     WHERE h.user_id = ? AND e.habit_id = ? ORDER BY e.entry_date ASC LIMIT 120`
  ).all(user.id, Number(req.params.id));
  res.json({ history: rows });
});

router.post('/:id/entries', (req, res) => {
  const user = (req as any).authUser;
  const habit = db.prepare(`SELECT * FROM habits WHERE user_id = ? AND id = ?`).get(user.id, Number(req.params.id)) as any;
  if (!habit) return res.status(404).json({ error: 'Habit not found' });
  const delta = Number(req.body?.amount ?? 1);
  const entryDate = String(req.body?.entryDate || todayIso());
  const currentRow = db.prepare(`SELECT amount FROM habit_entries WHERE habit_id = ? AND entry_date = ?`).get(habit.id, entryDate) as any;
  const nextAmount = Math.max(0, Number(currentRow?.amount || 0) + delta);
  db.prepare(
    `INSERT INTO habit_entries (habit_id, entry_date, amount, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(habit_id, entry_date) DO UPDATE SET amount = excluded.amount`
  ).run(habit.id, entryDate, nextAmount, nowIso());
  if (habit.repeatable) ensureRepeatableHabitsForUser(user.id);
  res.json({ ok: true });
});

router.post('/', (req, res) => {
  const user = (req as any).authUser;
  const body = req.body || {};
  const nextOrder = (db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS value FROM habits WHERE user_id = ?`).get(user.id) as any).value + 1;
  const repeatable = body.repeatable ? 1 : 0;
  const repeatGroup = repeatable ? `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : '';
  const repeatBaseName = String(body.name || '').trim();
  db.prepare(
    `INSERT INTO habits (
      user_id, name, description, category_id, period, target_count, expected_per_day, icon, color, visualization,
      allow_overcomplete, is_archived, created_at, updated_at, card_background_type, card_background_value,
      card_overlay_opacity, show_mini_calendar, show_chart, chart_type, habit_type, unit_label, sort_order,
      repeatable, repeat_group, repeat_index, repeat_base_name, repeat_anchor_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    user.id,
    body.name,
    body.description || '',
    body.categoryId || null,
    body.period || 'daily',
    Number(body.targetCount || 1),
    Math.max(1, Number(body.expectedPerDay || 1)),
    body.icon || '⭐',
    body.color || '#93c5fd',
    body.visualization || 'bar',
    nowIso(),
    nowIso(),
    body.cardBackgroundType || 'color',
    body.cardBackgroundValue || '#ffffff',
    Number(body.cardOverlayOpacity ?? 0.14),
    body.showMiniCalendar ? 1 : 0,
    body.showChart ? 1 : 0,
    body.chartType || 'line',
    body.habitType || 'standard',
    body.unitLabel || '',
    nextOrder,
    repeatable,
    repeatGroup,
    repeatBaseName,
    todayIso()
  );
  if (repeatable) ensureRepeatableHabitsForUser(user.id);
  res.json({ ok: true });
});

router.put('/:id', (req, res) => {
  const user = (req as any).authUser;
  const body = req.body || {};
  const existing = db.prepare(`SELECT * FROM habits WHERE user_id = ? AND id = ?`).get(user.id, Number(req.params.id)) as any;
  if (!existing) return res.status(404).json({ error: 'Habit not found' });
  const repeatable = body.repeatable ? 1 : 0;
  const repeatGroup = existing.repeat_group || (repeatable ? `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : '');
  db.prepare(
    `UPDATE habits SET name = ?, description = ?, category_id = ?, period = ?, target_count = ?, expected_per_day = ?, icon = ?, color = ?,
      visualization = ?, card_background_type = ?, card_background_value = ?, card_overlay_opacity = ?,
      show_mini_calendar = ?, show_chart = ?, chart_type = ?, habit_type = ?, unit_label = ?, repeatable = ?, repeat_group = ?, repeat_base_name = ?, repeat_anchor_date = ?, updated_at = ?
      WHERE user_id = ? AND id = ?`
  ).run(
    body.name,
    body.description || '',
    body.categoryId || null,
    body.period || 'daily',
    Number(body.targetCount || 1),
    Math.max(1, Number(body.expectedPerDay || 1)),
    body.icon || '⭐',
    body.color || '#93c5fd',
    body.visualization || 'bar',
    body.cardBackgroundType || 'color',
    body.cardBackgroundValue || '#ffffff',
    Number(body.cardOverlayOpacity ?? 0.14),
    body.showMiniCalendar ? 1 : 0,
    body.showChart ? 1 : 0,
    body.chartType || 'line',
    body.habitType || 'standard',
    body.unitLabel || '',
    repeatable,
    repeatGroup,
    String(body.name || existing.repeat_base_name || existing.name),
    existing.repeat_anchor_date || todayIso(),
    nowIso(),
    user.id,
    Number(req.params.id)
  );
  if (repeatable) ensureRepeatableHabitsForUser(user.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const user = (req as any).authUser;
  db.prepare(`DELETE FROM habits WHERE user_id = ? AND id = ?`).run(user.id, Number(req.params.id));
  res.json({ ok: true });
});

router.post('/:id/archive', (req, res) => {
  const user = (req as any).authUser;
  db.prepare(`UPDATE habits SET is_archived = 1 WHERE user_id = ? AND id = ?`).run(user.id, Number(req.params.id));
  res.json({ ok: true });
});

router.post('/reorder', (req, res) => {
  const user = (req as any).authUser;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  const stmt = db.prepare(`UPDATE habits SET sort_order = ? WHERE user_id = ? AND id = ?`);
  ids.forEach((id: number, index: number) => stmt.run(index, user.id, id));
  res.json({ ok: true });
});

router.get('/export/all', (req, res) => {
  const user = (req as any).authUser;
  const categories = db.prepare(`SELECT name FROM categories WHERE user_id = ? ORDER BY name ASC`).all(user.id);
  const habits = db.prepare(`SELECT * FROM habits WHERE user_id = ? ORDER BY sort_order ASC`).all(user.id);
  const entries = db.prepare(
    `SELECT e.* FROM habit_entries e JOIN habits h ON h.id = e.habit_id WHERE h.user_id = ? ORDER BY e.entry_date ASC`
  ).all(user.id);
  const settings = db.prepare(`SELECT key, value FROM settings WHERE user_id = ?`).all(user.id);
  res.json({ categories, habits, entries, settings });
});

router.post('/import/preview', (req, res) => {
  const payload = req.body || {};
  const habits = Array.isArray(payload.habits) ? payload.habits : [];
  res.json({
    preview: {
      habits: habits.filter((h: any) => Number(h.is_archived ?? h.isArchived ?? 0) !== 1 && String(h.habit_type || h.habitType || 'standard') !== 'goal').length,
      goals: habits.filter((h: any) => Number(h.is_archived ?? h.isArchived ?? 0) !== 1 && String(h.habit_type || h.habitType || 'standard') === 'goal').length,
      archived: habits.filter((h: any) => Number(h.is_archived ?? h.isArchived ?? 0) === 1).length
    }
  });
});

router.post('/import/all', (req, res) => {
  const user = (req as any).authUser;
  const payload = req.body || {};
  db.prepare(`DELETE FROM habit_entries WHERE habit_id IN (SELECT id FROM habits WHERE user_id = ? )`).run(user.id);
  db.prepare(`DELETE FROM habits WHERE user_id = ?`).run(user.id);
  db.prepare(`DELETE FROM categories WHERE user_id = ? AND is_builtin = 0`).run(user.id);
  db.prepare(`DELETE FROM settings WHERE user_id = ?`).run(user.id);

  const categoryMap = new Map<string, number>();
  for (const category of (payload.categories || [])) {
    const categoryName = String(category?.name || '').trim();
    if (!categoryName) continue;
    const existing = db.prepare(`SELECT id FROM categories WHERE user_id = ? AND name = ?`).get(user.id, categoryName) as any;
    if (existing?.id) {
      categoryMap.set(categoryName, Number(existing.id));
      continue;
    }
    const result = db.prepare(`INSERT INTO categories (user_id, name, is_builtin, created_at) VALUES (?, ?, 0, ?)`)
      .run(user.id, categoryName, nowIso());
    categoryMap.set(categoryName, Number(result.lastInsertRowid));
  }


  const habitMap = new Map<number, number>();
  for (const habit of (payload.habits || [])) {
    const result = db.prepare(
      `INSERT INTO habits (user_id, name, description, category_id, period, target_count, expected_per_day, icon, color, visualization,
        allow_overcomplete, is_archived, created_at, updated_at, card_background_type, card_background_value,
        card_overlay_opacity, show_mini_calendar, show_chart, chart_type, habit_type, unit_label, sort_order,
        repeatable, repeat_group, repeat_index, repeat_base_name, repeat_anchor_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      user.id, habit.name, habit.description || '', habit.categoryName ? categoryMap.get(habit.categoryName) ?? null : null,
      habit.period || 'daily', Number(habit.target_count || habit.targetCount || 1), Number(habit.expected_per_day || habit.expectedPerDay || 1), habit.icon || '⭐', habit.color || '#93c5fd',
      habit.visualization || 'bar', Number(habit.allow_overcomplete ?? 1), Number(habit.is_archived ?? 0), habit.created_at || nowIso(), habit.updated_at || nowIso(),
      habit.card_background_type || habit.cardBackgroundType || 'color', habit.card_background_value || habit.cardBackgroundValue || '#ffffff',
      Number(habit.card_overlay_opacity ?? habit.cardOverlayOpacity ?? 0.14), Number(habit.show_mini_calendar ?? habit.showMiniCalendar ?? 1),
      Number(habit.show_chart ?? habit.showChart ?? 1), habit.chart_type || habit.chartType || 'line', habit.habit_type || habit.habitType || 'standard',
      habit.unit_label || habit.unitLabel || '', Number(habit.sort_order ?? habit.sortOrder ?? 0), Number(habit.repeatable ?? 0), habit.repeat_group || '', Number(habit.repeat_index ?? habit.repeatIndex ?? 1), habit.repeat_base_name || habit.name || '', habit.repeat_anchor_date || todayIso()
    );
    habitMap.set(habit.id, Number(result.lastInsertRowid));
  }

  for (const entry of (payload.entries || [])) {
    const nextHabitId = habitMap.get(entry.habit_id || entry.habitId);
    if (!nextHabitId) continue;
    db.prepare(`INSERT INTO habit_entries (habit_id, entry_date, amount, created_at) VALUES (?, ?, ?, ?)`)
      .run(nextHabitId, entry.entry_date || entry.entryDate, Number(entry.amount || 0), entry.created_at || nowIso());
  }

  for (const setting of (payload.settings || [])) {
    db.prepare(`INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)`)
      .run(user.id, setting.key, String(setting.value ?? ''));
  }

  ensureRepeatableHabitsForUser(user.id);
  res.json({ ok: true });
});

export default router;
