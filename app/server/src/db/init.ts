import { db } from './database.js';
import { schemaSql } from './schema.js';
import { hashPassword } from '../lib/password.js';
import { nowIso, todayIso } from '../lib/time.js';

const defaultBackground = '/default-dashboard.svg';

const demoCategories = ['Health', 'Movement', 'Focus', 'Recovery'];

const demoHabits = [
  // Demo habits: four cards that show the main habit card combinations.
  { name: 'Water intake', description: 'A daily hydration habit with a column chart and a mini calendar.', categoryName: 'Health', icon: '💧', color: '#86efac', chartType: 'column', showMiniCalendar: true, showChart: true, habitType: 'standard', targetCount: 12, expectedPerDay: 12 },
  { name: 'Focus block', description: 'A focused work habit with a line chart and a mini calendar.', categoryName: 'Focus', icon: '🧠', color: '#c4b5fd', chartType: 'line', showMiniCalendar: true, showChart: true, habitType: 'standard', targetCount: 4, expectedPerDay: 4 },
  { name: 'Mobility session', description: 'A recovery habit that keeps the mini calendar visible without a chart.', categoryName: 'Recovery', icon: '🧘', color: '#fcd34d', chartType: 'line', showMiniCalendar: true, showChart: false, habitType: 'standard', targetCount: 2, expectedPerDay: 2 },
  { name: 'Daily vitamins', description: 'A simple daily habit card without a chart or mini calendar.', categoryName: 'Health', icon: '💊', color: '#93c5fd', chartType: 'column', showMiniCalendar: false, showChart: false, habitType: 'standard', targetCount: 1, expectedPerDay: 1 },

  // Demo goals: four cards with a visual mix for first-run discovery.
  { name: 'Daily steps', description: 'A bigger numeric goal with a line chart and mini calendar.', categoryName: 'Movement', icon: '👟', color: '#67e8f9', chartType: 'line', showMiniCalendar: true, showChart: true, habitType: 'goal', targetCount: 10000, unitLabel: 'steps', expectedPerDay: 10000 },
  { name: 'Bike distance', description: 'A distance goal that highlights the column chart layout.', categoryName: 'Movement', icon: '🚴', color: '#f9a8d4', chartType: 'column', showMiniCalendar: false, showChart: true, habitType: 'goal', targetCount: 25, unitLabel: 'km', expectedPerDay: 25 },
  { name: 'Reading time', description: 'A time-based goal that uses the pie chart view.', categoryName: 'Focus', icon: '📚', color: '#93c5fd', chartType: 'pie', showMiniCalendar: false, showChart: true, habitType: 'goal', targetCount: 60, unitLabel: 'min', expectedPerDay: 60 },
  { name: 'Sleep target', description: 'A clean goal card with a calendar-first layout.', categoryName: 'Recovery', icon: '🌙', color: '#a5b4fc', chartType: 'line', showMiniCalendar: true, showChart: false, habitType: 'goal', targetCount: 8, unitLabel: 'hours', expectedPerDay: 8 },

  // Demo archived card so the archive section is visible on first run.
  { name: 'Archived stretch routine', description: 'An archived sample card so the archive section is visible immediately.', categoryName: 'Recovery', icon: '🗂️', color: '#cbd5e1', chartType: 'column', showMiniCalendar: false, showChart: false, habitType: 'standard', targetCount: 7, expectedPerDay: 7, isArchived: true }
];

export async function initDatabase() {
  db.exec(schemaSql);
  ensureColumn('habits', 'expected_per_day', "REAL NOT NULL DEFAULT 1");
  ensureColumn('habits', 'repeatable', "INTEGER NOT NULL DEFAULT 0");
  ensureColumn('habits', 'repeat_group', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('habits', 'repeat_index', "INTEGER NOT NULL DEFAULT 1");
  ensureColumn('habits', 'repeat_base_name', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('habits', 'repeat_anchor_date', "TEXT NOT NULL DEFAULT ''");
  await ensureDefaultUser();
  ensureSeedForAllUsers();
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
  const now = nowIso();

  for (const categoryName of demoCategories) {
    db.prepare(
      `INSERT OR IGNORE INTO categories (user_id, name, is_builtin, created_at) VALUES (?, ?, 1, ?)`
    ).run(userId, categoryName, now);
  }

  const categoryRows = db.prepare(`SELECT id, name FROM categories WHERE user_id = ?`).all(userId) as any[];
  const categoryMap = new Map(categoryRows.map((row) => [row.name, row.id]));

  const habitCount = db.prepare(`SELECT COUNT(*) AS count FROM habits WHERE user_id = ?`).get(userId) as any;
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
            const seedAmount = typeof habit.seedAmount === 'number'
        ? habit.seedAmount
        : (habit.habitType === 'standard' ? Math.max(1, Math.round(habit.targetCount * 0.35)) : Math.round(habit.targetCount * 0.6));
      db.prepare(`INSERT INTO habit_entries (habit_id, entry_date, amount, created_at) VALUES (?, ?, ?, ?)`)
        .run(habitId, todayIso(), seedAmount, now);
    });
  }

  const defaults = [
    ['theme', 'light'],
    ['dashboardOpacity', '0.14'],
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
