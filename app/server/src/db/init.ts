import { db } from './database.js';
import { schemaSql } from './schema.js';
import { hashPassword } from '../lib/password.js';
import { nowIso, todayIso } from '../lib/time.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultSeedPath = path.join(__dirname, 'default-seed.json');

function readDefaultSeed() {
  if (!fs.existsSync(defaultSeedPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(defaultSeedPath, 'utf8'));
  } catch (error) {
    console.error('Failed to read default-seed.json:', error);
    return null;
  }
}

function remapLayoutSettingValue(value: any, habitMap: Map<number, number>) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : value;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return String(value ?? '{}');
    }

    const next: Record<string, any> = {};

    for (const [key, position] of Object.entries(parsed)) {
      const cleanKey = String(key);
      const match = cleanKey.match(/^(.*?)(\d+)$/);

      if (!match) {
        next[cleanKey] = position;
        continue;
      }

      const prefix = match[1];
      const oldId = Number(match[2]);
      const newId = habitMap.get(oldId);

      if (!newId) {
        next[cleanKey] = position;
        continue;
      }

      next[`${prefix}${newId}`] = position;
    }

    return JSON.stringify(next);
  } catch {
    return String(value ?? '{}');
  }
}

function seedFromDefaultBackup(userId: number) {
  const payload = readDefaultSeed();
  if (!payload) return false;

  const now = nowIso();

  const seedTransaction = db.transaction((targetUserId: number, backupPayload: any) => {
    const categoryMap = new Map<string, number>();

    for (const category of (backupPayload.categories || [])) {
      const categoryName = String(category?.name || '').trim();
      if (!categoryName) continue;

      const existing = db.prepare(`SELECT id FROM categories WHERE user_id = ? AND name = ?`).get(targetUserId, categoryName) as any;

      if (existing?.id) {
        categoryMap.set(categoryName, Number(existing.id));
        continue;
      }

      const result = db.prepare(
        `INSERT INTO categories (user_id, name, is_builtin, created_at) VALUES (?, ?, 1, ?)`
      ).run(targetUserId, categoryName, category?.created_at || category?.createdAt || now);

      categoryMap.set(categoryName, Number(result.lastInsertRowid));
    }

    const habitMap = new Map<number, number>();

    for (const habit of (backupPayload.habits || [])) {
      const categoryName = String(habit?.categoryName || habit?.category_name || '').trim();

      const result = db.prepare(
        `INSERT INTO habits (
          user_id, name, description, category_id, period, target_count, expected_per_day, icon, color, visualization,
          allow_overcomplete, is_archived, created_at, updated_at, card_background_type,
          card_background_value, card_overlay_opacity, show_mini_calendar, show_chart,
          chart_type, habit_type, unit_label, sort_order, repeatable, repeat_group, repeat_index, repeat_base_name, repeat_anchor_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        targetUserId,
        habit?.name || 'Habit',
        habit?.description || '',
        categoryName ? categoryMap.get(categoryName) ?? null : null,
        habit?.period || 'daily',
        Number(habit?.target_count ?? habit?.targetCount ?? 1),
        Number(habit?.expected_per_day ?? habit?.expectedPerDay ?? 1),
        habit?.icon || '⭐',
        habit?.color || '#93c5fd',
        habit?.visualization || 'bar',
        Number(habit?.allow_overcomplete ?? habit?.allowOvercomplete ?? 1),
        Number(habit?.is_archived ?? habit?.isArchived ?? 0),
        habit?.created_at || habit?.createdAt || now,
        habit?.updated_at || habit?.updatedAt || now,
        habit?.card_background_type || habit?.cardBackgroundType || 'color',
        habit?.card_background_value || habit?.cardBackgroundValue || '#ffffff',
        Number(habit?.card_overlay_opacity ?? habit?.cardOverlayOpacity ?? 0.14),
        Number(habit?.show_mini_calendar ?? habit?.showMiniCalendar ?? 1),
        Number(habit?.show_chart ?? habit?.showChart ?? 1),
        habit?.chart_type || habit?.chartType || 'line',
        habit?.habit_type || habit?.habitType || 'standard',
        habit?.unit_label || habit?.unitLabel || '',
        Number(habit?.sort_order ?? habit?.sortOrder ?? 0),
        Number(habit?.repeatable ?? 0),
        habit?.repeat_group || habit?.repeatGroup || '',
        Number(habit?.repeat_index ?? habit?.repeatIndex ?? 1),
        habit?.repeat_base_name || habit?.repeatBaseName || habit?.name || '',
        habit?.repeat_anchor_date || habit?.repeatAnchorDate || todayIso()
      );

      if (habit?.id !== undefined && habit?.id !== null) {
        habitMap.set(Number(habit.id), Number(result.lastInsertRowid));
      }
    }

    for (const entry of (backupPayload.entries || [])) {
      const oldHabitId = Number(entry?.habit_id || entry?.habitId);
      const nextHabitId = habitMap.get(oldHabitId);

      if (!nextHabitId) continue;

      db.prepare(`INSERT INTO habit_entries (habit_id, entry_date, amount, created_at) VALUES (?, ?, ?, ?)`)
        .run(
          nextHabitId,
          entry?.entry_date || entry?.entryDate || todayIso(),
          Number(entry?.amount || 0),
          entry?.created_at || entry?.createdAt || now
        );
    }

    for (const setting of (backupPayload.settings || [])) {
      const key = String(setting?.key || '').trim();
      if (!key) continue;

      let value = String(setting?.value ?? '');

      if (key === 'habitLayout' || key === 'goalLayout') {
        value = remapLayoutSettingValue(value, habitMap);
      }

      db.prepare(`INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)`)
        .run(targetUserId, key, value);
    }

    for (const widget of (backupPayload.widgets || [])) {
      const type = String(widget?.type || 'current');
      const label = String(widget?.label || 'Widget');
      const configJson = typeof widget?.config_json === 'string'
        ? widget.config_json
        : typeof widget?.configJson === 'string'
          ? widget.configJson
          : JSON.stringify(widget?.config || {});

      db.prepare(`INSERT INTO widgets (user_id, type, label, config_json, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(
          targetUserId,
          type,
          label,
          configJson,
          Number(widget?.sort_order ?? widget?.sortOrder ?? 0),
          widget?.created_at || widget?.createdAt || now
        );
    }
  });

  seedTransaction(userId, payload);
  return true;
}

const defaultBackground = '/haby-dashboard-light-v5.png';

const demoCategories = ['Health', 'Movement', 'Focus', 'Recovery'];

type DemoHabitSeed = {
  name: string;
  description: string;
  categoryName: string;
  icon: string;
  color: string;
  chartType: 'line' | 'column' | 'pie';
  showMiniCalendar: boolean;
  showChart: boolean;
  habitType: 'standard' | 'goal';
  targetCount: number;
  expectedPerDay: number;
  unitLabel?: string;
  isArchived?: boolean;
  seedAmount?: number;
};

const demoHabits: DemoHabitSeed[] = [
  // Demo habits: four cards that show the main habit card combinations.
  {
    name: 'Water intake',
    description: 'A daily hydration habit with a column chart and a mini calendar.',
    categoryName: 'Health',
    icon: '💧',
    color: '#86efac',
    chartType: 'column',
    showMiniCalendar: true,
    showChart: true,
    habitType: 'standard',
    targetCount: 12,
    expectedPerDay: 12
  },
  {
    name: 'Focus block',
    description: 'A focused work habit with a line chart and a mini calendar.',
    categoryName: 'Focus',
    icon: '🧠',
    color: '#c4b5fd',
    chartType: 'line',
    showMiniCalendar: true,
    showChart: true,
    habitType: 'standard',
    targetCount: 4,
    expectedPerDay: 4
  },
  {
    name: 'Mobility session',
    description: 'A recovery habit that keeps the mini calendar visible without a chart.',
    categoryName: 'Recovery',
    icon: '🧘',
    color: '#fcd34d',
    chartType: 'line',
    showMiniCalendar: true,
    showChart: false,
    habitType: 'standard',
    targetCount: 2,
    expectedPerDay: 2
  },
  {
    name: 'Daily vitamins',
    description: 'A simple daily habit card without a chart or mini calendar.',
    categoryName: 'Health',
    icon: '💊',
    color: '#93c5fd',
    chartType: 'column',
    showMiniCalendar: false,
    showChart: false,
    habitType: 'standard',
    targetCount: 1,
    expectedPerDay: 1
  },

  // Demo goals: four cards with a visual mix for first-run discovery.
  {
    name: 'Daily steps',
    description: 'A bigger numeric goal with a line chart and mini calendar.',
    categoryName: 'Movement',
    icon: '👟',
    color: '#67e8f9',
    chartType: 'line',
    showMiniCalendar: true,
    showChart: true,
    habitType: 'goal',
    targetCount: 10000,
    unitLabel: 'steps',
    expectedPerDay: 10000
  },
  {
    name: 'Bike distance',
    description: 'A distance goal that highlights the column chart layout.',
    categoryName: 'Movement',
    icon: '🚴',
    color: '#f9a8d4',
    chartType: 'column',
    showMiniCalendar: false,
    showChart: true,
    habitType: 'goal',
    targetCount: 25,
    unitLabel: 'km',
    expectedPerDay: 25
  },
  {
    name: 'Reading time',
    description: 'A time-based goal that uses the pie chart view.',
    categoryName: 'Focus',
    icon: '📚',
    color: '#93c5fd',
    chartType: 'pie',
    showMiniCalendar: false,
    showChart: true,
    habitType: 'goal',
    targetCount: 60,
    unitLabel: 'min',
    expectedPerDay: 60
  },
  {
    name: 'Sleep target',
    description: 'A clean goal card with a calendar-first layout.',
    categoryName: 'Recovery',
    icon: '🌙',
    color: '#a5b4fc',
    chartType: 'line',
    showMiniCalendar: true,
    showChart: false,
    habitType: 'goal',
    targetCount: 8,
    unitLabel: 'hours',
    expectedPerDay: 8
  },

  // Demo archived card so the archive section is visible on first run.
  {
    name: 'Archived stretch routine',
    description: 'An archived sample card so the archive section is visible immediately.',
    categoryName: 'Recovery',
    icon: '🗂️',
    color: '#cbd5e1',
    chartType: 'column',
    showMiniCalendar: false,
    showChart: false,
    habitType: 'standard',
    targetCount: 7,
    expectedPerDay: 7,
    isArchived: true
  }
];

export async function initDatabase() {
  db.exec(schemaSql);
  ensureColumn('habits', 'expected_per_day', 'REAL NOT NULL DEFAULT 1');
  ensureColumn('habits', 'repeatable', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('habits', 'repeat_group', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('habits', 'repeat_index', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('habits', 'repeat_base_name', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('habits', 'repeat_anchor_date', "TEXT NOT NULL DEFAULT ''");
  await ensureDefaultUser();
  ensureSeedForAllUsers();
  applyForcedV122VisualLayout();
}



function applyForcedV122VisualLayout() {
  const users = db.prepare(`SELECT id FROM users ORDER BY id ASC`).all() as any[];

  for (const user of users) {
    const userId = Number(user.id);

    const marker = db.prepare(`SELECT value FROM settings WHERE user_id = ? AND key = ?`)
      .get(userId, 'forcedVisualLayoutV122Applied') as any;

    const defaultSeedMarker = db.prepare(`SELECT value FROM settings WHERE user_id = ? AND key = ?`)
      .get(userId, 'defaultSeedApplied') as any;

    if (marker?.value === 'true') continue;

    // Fresh default-seed users already have the intended v1.2.x card positions.
    // Do not delete habitLayout / goalLayout for them.
    if (defaultSeedMarker?.value === 'true') {
      db.prepare(`INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)`)
        .run(userId, 'forcedVisualLayoutV122Applied', 'true');
      continue;
    }

    const visualSettings = [
      ['theme', 'light'],
      ['uiStyle', 'modern'],
      ['dashboardOpacity', '0.14'],
      ['dashboardBackground', '/haby-dashboard-light-v5.png'],
      ['dashboardBackgroundMode', 'center'],
      ['dashboardBackgroundPositionX', '50'],
      ['dashboardBackgroundPositionY', '50'],
      ['dashboardBackgroundZoom', '100'],
      ['dashboardHeroHeight', '298'],
      ['dashboardTitle', 'Haby Dashboard'],
      ['dashboardDescription', 'Track habits, goals, charts, widgets, categories, and progress in one place.'],
      ['forcedVisualLayoutV122Applied', 'true'],
    ];

    for (const [key, value] of visualSettings) {
      db.prepare(`INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)`)
        .run(userId, key, value);
    }

    // Clear only saved card positions so upgraded users get the new visual placement.
    db.prepare(`DELETE FROM settings WHERE user_id = ? AND key IN (?, ?)`)
      .run(userId, 'habitLayout', 'goalLayout');

    // Charts are widget-only. This prevents old show_chart values from affecting card layout.
    db.prepare(`UPDATE habits SET show_chart = 0, updated_at = ? WHERE user_id = ?`)
      .run(nowIso(), userId);
  }
}


function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function ensureSeedForAllUsers() {
  const users = db.prepare(`SELECT id FROM users ORDER BY id ASC`).all() as any[];
  users.forEach((user) => seedDefaultsForUser(Number(user.id)));
}

async function ensureDefaultUser() {
  const count = db.prepare(`SELECT COUNT(*) AS count FROM users`).get() as any;
  if (count.count > 0) return;

  const now = nowIso();
  const hash = await hashPassword('Haby');
  const userRes = db.prepare(
    `INSERT INTO users (username, password_hash, is_admin, force_password_change, is_disabled, created_at, updated_at)
     VALUES (?, ?, 1, 1, 0, ?, ?)`
  ).run('Haby', hash, now, now);
  const userId = Number(userRes.lastInsertRowid);
  seedDefaultsForUser(userId);
}

export function seedDefaultsForUser(userId: number) {
  const habitCount = db.prepare(`SELECT COUNT(*) AS count FROM habits WHERE user_id = ?`).get(userId) as any;
  const seedMarker = db.prepare(`SELECT value FROM settings WHERE user_id = ? AND key = ?`).get(userId, 'defaultSeedApplied') as any;

  if (!habitCount.count && seedMarker?.value !== 'true' && seedFromDefaultBackup(userId)) {
    db.prepare(`INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)`)
      .run(userId, 'defaultSeedApplied', 'true');

    return;
  }

  const now = nowIso();

  for (const categoryName of demoCategories) {
    db.prepare(
      `INSERT OR IGNORE INTO categories (user_id, name, is_builtin, created_at) VALUES (?, ?, 1, ?)`
    ).run(userId, categoryName, now);
  }

  const categoryRows = db.prepare(`SELECT id, name FROM categories WHERE user_id = ?`).all(userId) as any[];
  const categoryMap = new Map(categoryRows.map((row) => [row.name, row.id]));

  if (!habitCount.count) {
    demoHabits.forEach((habit, index) => {
      const result = db.prepare(
        `INSERT INTO habits (
          user_id, name, description, category_id, period, target_count, expected_per_day, icon, color, visualization,
          allow_overcomplete, is_archived, created_at, updated_at, card_background_type,
          card_background_value, card_overlay_opacity, show_mini_calendar, show_chart,
          chart_type, habit_type, unit_label, sort_order, repeatable, repeat_group, repeat_index, repeat_base_name, repeat_anchor_date
        ) VALUES (?, ?, ?, ?, 'daily', ?, ?, ?, ?, 'bar', 1, ?, ?, ?, 'color', ?, ?, ?, ?, ?, ?, ?, ?, 0, '', 1, ?, ?)`
      ).run(
        userId,
        habit.name,
        habit.description,
        categoryMap.get(habit.categoryName) ?? null,
        habit.targetCount,
        habit.expectedPerDay,
        habit.icon,
        habit.color,
        habit.isArchived ? 1 : 0,
        now,
        now,
        '#ffffff',
        0.14,
        habit.showMiniCalendar ? 1 : 0,
        habit.showChart ? 1 : 0,
        habit.chartType,
        habit.habitType,
        habit.unitLabel || '',
        index,
        habit.name,
        todayIso()
      );

      const habitId = Number(result.lastInsertRowid);
      const seedAmount =
        typeof habit.seedAmount === 'number'
          ? habit.seedAmount
          : habit.habitType === 'standard'
            ? Math.max(1, Math.round(habit.targetCount * 0.35))
            : Math.round(habit.targetCount * 0.6);

      db.prepare(`INSERT INTO habit_entries (habit_id, entry_date, amount, created_at) VALUES (?, ?, ?, ?)`)
        .run(habitId, todayIso(), seedAmount, now);
    });
  }

  const defaults = [
    ['theme', 'light'],
    ['uiStyle', 'classic'],
    ['dashboardOpacity', '0.14'],
    ['dashboardBackgroundMode', 'center'],
    ['dashboardBackgroundPositionX', '50'],
    ['dashboardBackgroundPositionY', '50'],
    ['dashboardBackgroundZoom', '100'],
    ['dashboardDescription', 'Track habits, goals, charts, widgets, categories, and progress in one place.'],
    ['dashboardBackground', defaultBackground]
  ];

  defaults.forEach(([key, value]) => {
    db.prepare(`INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)`).run(userId, key, value);
  });

  const widgetCount = db.prepare(`SELECT COUNT(*) AS count FROM widgets WHERE user_id = ?`).get(userId) as any;
  if (!widgetCount.count) {
    const widgets = [
      { type: 'calendar', label: 'Calendar', config: {} },
      { type: 'history', label: 'Overall history', config: { type: 'column', days: 30 } },
      { type: 'doneList', label: 'Today list', config: {} }
    ];

    widgets.forEach((widget, index) => {
      db.prepare(
        `INSERT INTO widgets (user_id, type, label, config_json, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(userId, widget.type, widget.label, JSON.stringify(widget.config), index, now);
    });
  }
}
