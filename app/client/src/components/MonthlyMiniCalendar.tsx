import type { HistoryPoint } from '../store/useStore';
import { parseLocalDate, toLocalDateString } from '../utils/date';

function getMonthDays(baseDate: Date) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, idx) => {
    const date = new Date(year, month, idx + 1);
    return {
      iso: toLocalDateString(date),
      day: idx + 1,
    };
  });
}

function normalizeIsoDate(value?: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = parseLocalDate(value);
  if (!parsed) return null;
  return toLocalDateString(parsed);
}

export default function MonthlyMiniCalendar({
  history = [],
  target = 1,
  expectedPerDay,
  createdAt,
  showMissedLegend = true,
  variant = 'widget',
  selectedDate,
  onSelectDate,
  neutralMissed = false,
}: {
  history?: HistoryPoint[];
  target?: number;
  expectedPerDay?: number;
  createdAt?: string;
  showMissedLegend?: boolean;
  variant?: 'card' | 'widget';
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  neutralMissed?: boolean;
}) {
  const now = new Date();
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const startOffset = ((new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7);
  const map = new Map(history.map((point) => [point.date, point.value]));
  const cells = getMonthDays(now);
  const createdIso = normalizeIsoDate(createdAt);
  const todayIso = toLocalDateString(now);
  const extraThreshold = Math.max(1, Number(expectedPerDay || target || 1));

  return (
    <div className={`mini-calendar-block ${variant === 'card' ? 'mini-calendar-card-variant' : 'mini-calendar-widget-variant'}`}>
      <div className="calendar-title">{monthLabel}</div>
      <div className="calendar-head-row">{dayNames.map((name, index) => <span key={`${name}-${index}`}>{name}</span>)}</div>
      <div className="calendar-grid compact-grid">
        {Array.from({ length: startOffset }).map((_, idx) => <span key={`blank-${idx}`} className="day-pill blank" aria-hidden="true" />)}
        {cells.map((cell) => {
          const value = Number(map.get(cell.iso) || 0);
          const isBeforeCreation = Boolean(createdIso && cell.iso < createdIso);
          const isFuture = cell.iso > todayIso;
          const isSelected = selectedDate === cell.iso;

          let className = 'neutral';
          if (!isBeforeCreation && !isFuture) {
            if (value === 0) className = neutralMissed ? 'neutral' : 'missed';
            else className = value > extraThreshold ? 'extra' : 'done';
          }

          return (
            <button
              key={cell.iso}
              type="button"
              className={`day-pill ${className} ${isSelected ? 'selected' : ''}`}
              title={`${cell.iso} · ${value}`}
              onClick={() => onSelectDate?.(cell.iso)}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
      <div className="legend-row">
        <span className="legend-dot done" /> Done
        <span className="legend-dot extra" /> Extra
        {showMissedLegend ? <><span className="legend-dot missed" /> Missed</> : null}
      </div>
    </div>
  );
}
