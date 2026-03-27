import { useEffect, useState } from 'react';
import { toLocalDateString } from '../utils/date';
import { apiDelete, apiGet, apiPost, apiPut, getHabitHistory } from '../api';

export type Habit = {
  id: number;
  name: string;
  description?: string;
  categoryId: number | null;
  categoryName: string | null;
  period: 'daily' | 'weekly' | 'monthly';
  expectedPerDay?: number;
  repeatable?: boolean;
  repeatIndex?: number;
  repeatGroup?: string;
  repeatBaseName?: string;
  repeatAnchorDate?: string;
  targetCount: number;
  icon: string;
  color: string;
  visualization: 'circle' | 'bar' | 'checkbox' | 'compact' | 'detailed';
  allowOvercomplete: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  cardBackgroundType: 'none' | 'color' | 'image';
  cardBackgroundValue: string;
  cardOverlayOpacity: number;
  showMiniCalendar: boolean;
  showChart: boolean;
  chartType: 'line' | 'column' | 'pie';
  habitType?: 'standard' | 'goal';
  unitLabel?: string;
  sortOrder?: number;
  progress: {
    current: number;
    displayCurrent: number;
    target: number;
    remaining: number;
    percent: number;
    isCompleted: boolean;
    isOvercompleted: boolean;
    label: string;
    periodStart: string;
    nextPeriodStart: string;
    periodLabel: string;
    today: string;
    extras: number;
  };
  streaks: { daily: number; weekly: number; monthly: number; };
};

export type Category = { id: number; name: string; is_builtin?: number; };
export type HistoryPoint = { date: string; value: number; };
export type AuthUser = { id: number; username: string; isAdmin: boolean; forcePasswordChange?: boolean; isDisabled?: boolean; createdAt: string; updatedAt: string; };
export type Widget = { id: number; type: string; label: string; config: any; sort_order?: number; };

function todayIso() {
  return toLocalDateString();
}

export function useStore() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [histories, setHistories] = useState<Record<number, HistoryPoint[]>>({});
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  async function load() {
    if (!authUser) {
      setHabits([]); setCategories([]); setHistories({}); setSettings({}); setWidgets([]); setLoading(false); return;
    }
    setLoading(true);
    const [habitRes, categoryRes, settingsRes, widgetsRes] = await Promise.all([
      apiGet('/api/habits'), apiGet('/api/categories'), apiGet('/api/settings'), apiGet('/api/widgets')
    ]);
    const nextHabits = habitRes.habits || [];
    setHabits(nextHabits);
    setCategories(categoryRes.categories || []);
    setSettings(settingsRes.settings || {});
    setWidgets(widgetsRes.widgets || []);
    const nextHistories: Record<number, HistoryPoint[]> = {};
    for (const habit of nextHabits) {
      const historyRes = await getHabitHistory(habit.id);
      nextHistories[habit.id] = historyRes.history || [];
    }
    setHistories(nextHistories);
    setLoading(false);
  }

  async function bootstrapAuth() {
    setBootstrapping(true);
    try {
      const res = await apiGet('/api/auth/me');
      setAuthUser(res.user || null);
    } catch {
      setAuthUser(null);
    } finally {
      setBootstrapping(false);
    }
  }

  useEffect(() => { bootstrapAuth(); }, []);
  useEffect(() => { if (!bootstrapping) load(); }, [authUser, bootstrapping]);

  async function login(username: string, password: string) {
    const res = await apiPost('/api/auth/login', { username, password });
    setAuthUser(res.user || null);
  }
  async function logout() { await apiPost('/api/auth/logout'); setAuthUser(null); }
  async function changeUsername(username: string) { const res = await apiPost('/api/auth/change-username', { username }); setAuthUser(res.user); }
  async function changePassword(currentPassword: string, newPassword: string) { const res = await apiPost('/api/auth/change-password', { currentPassword, newPassword }); if (res?.requiresReauth) setAuthUser(null); }
  async function listUsers() { const res = await apiGet('/api/auth/users'); return res.users || []; }
  async function createUserAccount(username: string, password: string, isAdmin = false) { await apiPost('/api/auth/users', { username, password, isAdmin }); }
  async function disableUserAccount(userId: number) { await apiPost(`/api/auth/users/${userId}/disable`); }
  async function enableUserAccount(userId: number) { await apiPost(`/api/auth/users/${userId}/enable`); }
  async function deleteUserAccount(userId: number) { await apiDelete(`/api/auth/users/${userId}`); }

  async function addEntry(habitId: number, amount = 1, entryDate?: string) {
    const date = entryDate || todayIso();
    const previousHistory = histories[habitId] || [];
    const currentValue = previousHistory.find((item) => item.date === date)?.value || 0;
    const nextValue = Math.max(0, currentValue + amount);

    setHistories((prev) => {
      const nextItems = [...(prev[habitId] || [])];
      const index = nextItems.findIndex((item) => item.date === date);
      if (index >= 0) nextItems[index] = { ...nextItems[index], value: nextValue };
      else nextItems.push({ date, value: nextValue });
      nextItems.sort((a, b) => a.date.localeCompare(b.date));
      return { ...prev, [habitId]: nextItems };
    });

    setHabits((prev) => prev.map((habit) => {
      if (habit.id !== habitId || date !== habit.progress.today) return habit;
      const target = habit.progress.target || habit.targetCount || 1;
      const expectedPerDay = Number(habit.expectedPerDay || 1);
      const current = nextValue;
      return {
        ...habit,
        progress: {
          ...habit.progress,
          current,
          displayCurrent: current,
          remaining: Math.max(0, target - current),
          percent: Math.max(0, Math.min(100, Math.round((current / Math.max(target, 1)) * 100))),
          isCompleted: current >= target,
          isOvercompleted: current > target,
          label: `${current} / ${target}${habit.unitLabel ? ` ${habit.unitLabel}` : ''}`,
          extras: Math.max(0, current - expectedPerDay),
        }
      };
    }));

    try {
      await apiPost(`/api/habits/${habitId}/entries`, { amount, entryDate: date });
    } catch (error) {
      await load();
      throw error;
    }
  }
  async function createHabit(data: any) { await apiPost('/api/habits', data); await load(); }
  async function updateHabit(id: number, data: any) { await apiPut(`/api/habits/${id}`, data); await load(); }
  async function deleteHabit(id: number) { await apiDelete(`/api/habits/${id}`); await load(); }
  async function archiveHabit(id: number) { await apiPost(`/api/habits/${id}/archive`); await load(); }
  async function reorderHabits(ids: number[]) { await apiPost('/api/habits/reorder', { ids }); setHabits((prev) => { const order = new Map(ids.map((id, index) => [id, index])); return [...prev].sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999)); }); }
  async function createCategory(name: string) { await apiPost('/api/categories', { name }); await load(); }
  async function deleteCategory(id: number) { await apiDelete(`/api/categories/${id}`); await load(); }
  async function saveSetting(key: string, value: string) { await apiPut(`/api/settings/${key}`, { value }); setSettings((prev) => ({ ...prev, [key]: value })); }
  async function exportData() { const data = await apiGet('/api/habits/export/all'); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); const stamp = new Date().toISOString().slice(0, 10); a.href = url; a.download = `haby-backup-${stamp}.json`; a.click(); URL.revokeObjectURL(url); }
  async function previewImportData(file: File) { const payload = JSON.parse(await file.text()); return apiPost('/api/habits/import/preview', payload); }
  async function importData(file: File) { const payload = JSON.parse(await file.text()); await apiPost('/api/habits/import/all', payload); await load(); }

  async function addWidget(type: string, label: string, config: any = {}) {
    await apiPost('/api/widgets', { type, label, config });
    const widgetsRes = await apiGet('/api/widgets');
    setWidgets(widgetsRes.widgets || []);
  }
  async function updateWidget(id: number, label: string, config: any) {
    setWidgets((prev) => prev.map((widget) => widget.id === id ? { ...widget, label, config } : widget));
    await apiPut(`/api/widgets/${id}`, { label, config });
  }
  async function deleteWidget(id: number) {
    setWidgets((prev) => prev.filter((widget) => widget.id !== id));
    await apiDelete(`/api/widgets/${id}`);
  }
  async function reorderWidgets(ids: number[]) {
    setWidgets((prev) => {
      const order = new Map(ids.map((id, index) => [id, index]));
      return [...prev].sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
    });
    await apiPut('/api/widgets/reorder', { ids });
  }

  return { habits, categories, histories, settings, widgets, loading, bootstrapping, authUser, login, logout, changeUsername, changePassword, listUsers, createUserAccount, disableUserAccount, enableUserAccount, deleteUserAccount, addEntry, createHabit, updateHabit, deleteHabit, archiveHabit, reorderHabits, createCategory, deleteCategory, saveSetting, exportData, previewImportData, importData, addWidget, updateWidget, deleteWidget, reorderWidgets };
}
