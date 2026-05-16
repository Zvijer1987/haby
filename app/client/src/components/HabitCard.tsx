import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import MonthlyMiniCalendar from './MonthlyMiniCalendar';
import type { Habit, HistoryPoint } from '../store/useStore';

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
  const num = Number.parseInt(value, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function tintColor(hex: string, alpha = 0.12) {
  const { r, g, b } = hexToRgb(hex || '#93c5fd');
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function HabitCard({ habit, history, onIncrement, onDecrement, onEdit, onArchive, onDelete, onPointerStart, cardStyle, layoutKey, onMeasure, isDragging, chartRange = 7, chartHistory, chartVisible }: {
  habit: Habit;
  history: HistoryPoint[];
  onIncrement: (amount?: number) => Promise<void>;
  onDecrement: () => Promise<void>;
  onEdit: () => void;
  onArchive?: () => Promise<void>;
  onDelete: () => Promise<void>;
  onPointerStart: (event: ReactPointerEvent<HTMLElement>) => void;
  cardStyle?: CSSProperties;
  layoutKey: string;
  onMeasure: (key: string, height: number) => void;
  isDragging?: boolean;
  chartRange?: 7 | 14 | 30;
  chartHistory?: HistoryPoint[];
  chartVisible?: boolean;
}) {
  const [goalInput, setGoalInput] = useState('');
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = cardRef.current;
    if (!element) return;
    const report = () => onMeasure(layoutKey, Math.ceil(element.getBoundingClientRect().height));
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [layoutKey, onMeasure, habit.showMiniCalendar, habit.chartType, habit.progress.current, chartVisible, chartRange, chartHistory]);

  const cardBackground = habit.cardBackgroundType === 'image'
    ? `linear-gradient(rgba(255,255,255,${1 - habit.cardOverlayOpacity}), rgba(255,255,255,${1 - habit.cardOverlayOpacity})), url(${habit.cardBackgroundValue})`
    : habit.cardBackgroundType === 'color'
      ? tintColor(habit.color, 0.14)
      : habit.cardBackgroundValue || tintColor(habit.color, 0.08);

  const style = {
    background: cardBackground,
    borderColor: habit.color,
    opacity: isDragging ? 0.28 : 1,
    ...cardStyle,
  } as CSSProperties;

  const goalPercent = habit.habitType === 'goal' && habit.targetCount > 0
    ? Math.max(0, Math.min(100, Math.round((habit.progress.current / habit.targetCount) * 100)))
    : 0;

  const hasVisual = habit.showMiniCalendar;
  const visualWidthClass = useMemo(() => hasVisual ? 'habit-card-wide' : 'habit-card-compact', [hasVisual]);
  const goalUnit = habit.unitLabel || 'unit';

  return (
    <article
      ref={cardRef}
      data-layout-key={layoutKey}
      className={`habit-card ${visualWidthClass} ${isDragging ? 'habit-card-dragging' : ''}`}
      style={style}
      onPointerDown={onPointerStart}
    >
      <div className="row-between habit-card-top">
        <div className="habit-heading">
          <div className="habit-icon">{habit.icon}</div>
          <div>
            <h3>{habit.name}</h3>
            <p className="muted-text">{habit.description}</p>
          </div>
        </div>
      </div>

      <div className="muted-text card-progress-copy">{habit.progress.label}</div>

      {habit.habitType === 'goal' ? (
        <>
          <div className="goal-progress-track" aria-label="Goal progress bar">
            <div className="goal-progress-fill" style={{ width: `${goalPercent}%`, background: habit.color }} />
          </div>
          <div className="goal-input-row compact-goal-row content-width-block">
            <input
              className="goal-number"
              type="number"
              inputMode="decimal"
              placeholder="Add amount"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
            />
            <span className="unit-pill">{goalUnit}</span>
            <button
              type="button"
              className="ghost-btn small-btn goal-save-btn"
              onClick={async () => {
                const amount = Number(goalInput);
                if (!Number.isFinite(amount) || amount <= 0) return;
                await onIncrement(amount);
                setGoalInput('');
              }}
            >
              Save
            </button>
          </div>
        </>
      ) : null}
      {habit.showMiniCalendar ? <MonthlyMiniCalendar history={history} target={habit.targetCount} expectedPerDay={habit.expectedPerDay} createdAt={habit.createdAt} variant="card" /> : null}

      <div className="card-footer-actions content-width-block">
        {habit.habitType === 'goal' ? null : (
          <>
            <button type="button" className="success-btn small-btn" onClick={() => onIncrement(1)}>+1</button>
            <button type="button" className="ghost-btn small-btn" onClick={() => onDecrement()}>-1</button>
          </>
        )}
        <button type="button" className="ghost-btn small-btn" onClick={onEdit}>Edit</button>
        {onArchive ? <button type="button" className="ghost-btn small-btn" onClick={() => onArchive()}>Archive</button> : null}
        <button type="button" className="danger-btn small-btn" onClick={() => onDelete()}>Delete</button>
      </div>
    </article>
  );
}
