import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Category, Habit } from '../store/useStore';

const icons = [
  '⭐', '💧', '🚶', '🚴', '🏃', '🧘', '🧠',
  '📚', '💪', '🥗', '😴', '🎯', '👟', '🏋️',
  '🧗', '🪴', '🧃', '📝', '🧭', '🎵', '🫶',
  '☕', '🍵', '🥛', '🍎', '🥦', '🍳', '💊',
  '🛏️', '🧹', '🧺', '🧼', '🦷', '📖', '✍️'
];

const unitSuggestions = ['steps', 'km', 'm', 'minutes', 'liters', 'pages'];

export default function HabitModal({
  mode,
  entityType,
  initialHabit,
  categories,
  onClose,
  onSave,
  onArchive,
}: {
  mode: 'create' | 'edit';
  entityType: 'standard' | 'goal';
  initialHabit?: Habit | null;
  categories: Category[];
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
  onArchive?: () => Promise<void>;
}) {
  const initial = useMemo(() => initialHabit || {
    name: '',
    description: '',
    categoryId: null,
    period: 'daily',
    targetCount: entityType === 'goal' ? 10 : 1,
    expectedPerDay: 1,
    repeatable: false,
    icon: entityType === 'goal' ? '🎯' : '⭐',
    color: entityType === 'goal' ? '#fcd34d' : '#93c5fd',
    cardBackgroundType: 'color',
    cardBackgroundValue: '',
    cardOverlayOpacity: 0.14,
    showMiniCalendar: true,
    showChart: true,
    chartType: 'line',
    habitType: entityType,
    unitLabel: '',
  }, [initialHabit, entityType]);

  const [form, setForm] = useState<any>({
    ...initial,
    habitType: entityType,
    expectedPerDay: initial.expectedPerDay ?? 1,
    repeatable: Boolean(initial.repeatable),
  });

  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const isGoal = entityType === 'goal';
  const repeatableLabel = isGoal ? 'Repeatable Goal' : 'Repeatable Habit';

  async function handleSave() {
    if (!form.name?.trim() || saving) return;

    setSaving(true);

    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        description: String(form.description || '').trim(),
        targetCount: Math.max(1, Number(form.targetCount || 1)),
        expectedPerDay: Math.max(1, Number(form.expectedPerDay || 1)),
        repeatable: Boolean(form.repeatable),
        habitType: entityType,
        cardBackgroundType: 'color',
        cardBackgroundValue: form.color,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!onArchive || saving || archiving) return;

    setArchiving(true);

    try {
      await onArchive();
    } finally {
      setArchiving(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card habit-modal" onClick={(event) => event.stopPropagation()}>
        <div className="row-between">
          <h3>{mode === 'create' ? (isGoal ? '+ Add Goal' : '+ Add Habit') : (isGoal ? 'Edit Goal' : 'Edit Habit')}</h3>
          <button type="button" className="ghost-btn small-btn" onClick={onClose}>Close</button>
        </div>

        <label>
          Name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>

        <label>
          Description
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>

        <label>
          Category
          <select value={form.categoryId ?? ''} onChange={(event) => setForm({ ...form, categoryId: event.target.value ? Number(event.target.value) : null })}>
            <option value="">None</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>

        {isGoal ? (
          <div className="habit-field-row habit-field-row-three">
            <label>
              Goal target
              <input type="number" min="1" value={form.targetCount} onChange={(event) => setForm({ ...form, targetCount: Number(event.target.value || 1) })} />
            </label>

            <label>
              Expected per day (for extra)
              <input type="number" min="1" value={form.expectedPerDay ?? 1} onChange={(event) => setForm({ ...form, expectedPerDay: Number(event.target.value || 1) })} />
            </label>

            <label>
              Unit label
              <input list="unit-options" placeholder="Write any unit label" value={form.unitLabel} onChange={(event) => setForm({ ...form, unitLabel: event.target.value })} />
              <datalist id="unit-options">
                {unitSuggestions.map((unit) => <option key={unit} value={unit} />)}
              </datalist>
            </label>
          </div>
        ) : (
          <div className="habit-field-row habit-field-row-two">
            <label>
              Target amount
              <input type="number" min="1" value={form.targetCount} onChange={(event) => setForm({ ...form, targetCount: Number(event.target.value || 1) })} />
            </label>

            <label>
              Expected per day (for extra)
              <input type="number" min="1" value={form.expectedPerDay ?? 1} onChange={(event) => setForm({ ...form, expectedPerDay: Number(event.target.value || 1) })} />
            </label>
          </div>
        )}

        <div className="habit-toggle-row">
          <label>
            Period
            <div className="tiny-toggle">
              {(['daily', 'weekly', 'monthly'] as const).map((period) => (
                <span key={period} className={form.period === period ? 'active' : ''} onClick={() => setForm({ ...form, period })}>
                  {period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly'}
                </span>
              ))}
            </div>
          </label>
        </div>

        <label>
          Icon
          <div className="icon-grid">
            {icons.map((icon) => (
              <button
                key={icon}
                type="button"
                className={form.icon === icon ? 'icon-btn active-icon' : 'icon-btn'}
                onClick={() => setForm({ ...form, icon })}
              >
                {icon}
              </button>
            ))}
          </div>
        </label>

        <div>
          <div className="field-label">Color</div>
          <div className="color-row">
            <input className="color-picker-input" type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value, cardBackgroundType: 'color' })} />
            <div className="color-preview" style={{ background: `linear-gradient(135deg, ${form.color}22, ${form.color}55)` }} />
          </div>
        </div>

        <div className="habit-check-row">
          <label className="inline-check">
            <input type="checkbox" checked={form.showMiniCalendar} onChange={(event) => setForm({ ...form, showMiniCalendar: event.target.checked })} />
            Show mini calendar
          </label>
          <label className="inline-check">
            <input type="checkbox" checked={Boolean(form.repeatable)} onChange={(event) => setForm({ ...form, repeatable: event.target.checked })} />
            {repeatableLabel}
          </label>
        </div>

        <div className="inline-actions wrap-gap modal-submit-row">
          {mode === 'edit' && onArchive ? (
            <button type="button" className="ghost-btn" disabled={saving || archiving} onClick={handleArchive}>
              {archiving ? 'Archiving...' : 'Archive'}
            </button>
          ) : null}

          <button type="button" className="primary-btn" disabled={saving || archiving || !form.name?.trim()} onClick={handleSave}>
            {saving ? 'Saving...' : mode === 'create' ? (isGoal ? 'Create Goal' : 'Create Habit') : (isGoal ? 'Save Goal' : 'Save Habit')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
