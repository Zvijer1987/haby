import type { HistoryPoint } from '../store/useStore';
import { toLocalDateString } from '../utils/date';

type ChartPoint = {
  value: number;
  label: string;
  expected: number;
  state: 'neutral' | 'partial' | 'done' | 'extra';
};

function iso(date: Date) {
  return toLocalDateString(date);
}

function buildSafeSeries(history: HistoryPoint[], targetLength = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const historyMap = new Map((history || []).map((point) => [point.date, point.value || 0]));

  return Array.from({ length: targetLength }, (_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (targetLength - 1 - idx));
    const key = iso(date);
    return {
      value: historyMap.get(key) || 0,
      label: String(date.getDate()).padStart(2, '0'),
    };
  });
}

function condenseSeries(history: HistoryPoint[], range: 7 | 14 | 30, expectedPerDay: number): ChartPoint[] {
  const raw = buildSafeSeries(history || [], range);
  const bucketCount = Math.min(7, raw.length);
  const bucketSize = Math.ceil(raw.length / bucketCount);
  const points: ChartPoint[] = [];

  for (let start = 0; start < raw.length; start += bucketSize) {
    const bucket = raw.slice(start, start + bucketSize);
    const value = bucket.reduce((sum, item) => sum + item.value, 0);
    const expected = Math.max(1, expectedPerDay) * bucket.length;
    let state: ChartPoint['state'] = 'neutral';
    if (value > expected) state = 'extra';
    else if (value >= expected) state = 'done';
    else if (value > 0) state = 'partial';
    points.push({
      value,
      label: bucket[bucket.length - 1]?.label || raw[raw.length - 1]?.label || '',
      expected,
      state,
    });
  }

  return points.slice(-7);
}

function getStateColor(state: ChartPoint['state'], color: string) {
  if (state === 'extra') return 'var(--extra)';
  if (state === 'done') return 'var(--chart-done)';
  if (state === 'neutral') return 'var(--chart-neutral)';
  return color;
}

function toPointY(value: number, max: number) {
  const baseY = 72;
  const maxHeight = 50;
  const minHeight = 5;
  if (value <= 0) return baseY - minHeight;
  return baseY - (minHeight + (value / Math.max(max, 1)) * (maxHeight - minHeight));
}

export default function HabitChart({ history, type, color, range = 7, target = 1, expectedPerDay = 1 }: { history: HistoryPoint[]; type: 'line' | 'column' | 'pie'; color: string; range?: 7 | 14 | 30; target?: number; expectedPerDay?: number }) {
  const points = condenseSeries(history || [], range, expectedPerDay);
  const max = Math.max(...points.map((item) => Math.max(item.value, item.expected)), Math.max(1, expectedPerDay), 1);

  if (type === 'pie') {
    const total = Math.max(0, points.reduce((sum, item) => sum + item.value, 0));
    const totalExpected = Math.max(1, target);
    const elapsedBuckets = Math.max(1, points.filter((item) => item.value > 0).length || points.length);
    const dailyExpected = Math.max(1, expectedPerDay || 1);
    const currentExpected = Math.min(totalExpected, dailyExpected * elapsedBuckets);
    const baseProgress = Math.min(total, currentExpected);
    const doneProgress = Math.max(0, Math.min(total, totalExpected) - baseProgress);
    const extra = Math.max(0, total - totalExpected);
    const remaining = Math.max(0, totalExpected - Math.min(total, totalExpected));
    const innerRadius = 28;
    const outerRadius = 36;
    const innerCircumference = 2 * Math.PI * innerRadius;
    const outerCircumference = 2 * Math.PI * outerRadius;
    const safeTarget = Math.max(1, totalExpected);
    const baseArc = innerCircumference * (baseProgress / safeTarget);
    const doneArc = innerCircumference * (doneProgress / safeTarget);
    const extraArc = outerCircumference * Math.min(extra / safeTarget, 1);
    return (
      <div className="chart-shell line-chart-shell">
        <svg className="mini-line compact-chart pie-chart-large" viewBox="0 0 100 100" aria-label="Habit chart pie" preserveAspectRatio="xMidYMid meet">
          <circle cx="50" cy="50" r={innerRadius} fill="none" stroke="rgba(148, 163, 184, 0.16)" strokeWidth="12" />
          <circle cx="50" cy="50" r={outerRadius} fill="none" stroke="rgba(148, 163, 184, 0.12)" strokeWidth="6" />
          {baseProgress > 0 ? (
            <circle cx="50" cy="50" r={innerRadius} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${baseArc} ${innerCircumference}`} transform="rotate(-90 50 50)" />
          ) : null}
          {doneProgress > 0 ? (
            <circle cx="50" cy="50" r={innerRadius} fill="none" stroke="var(--chart-done)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${doneArc} ${innerCircumference}`} strokeDashoffset={-baseArc} transform="rotate(-90 50 50)" />
          ) : null}
          {extra > 0 ? (
            <circle cx="50" cy="50" r={outerRadius} fill="none" stroke="var(--extra)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${extraArc} ${outerCircumference}`} transform="rotate(-90 50 50)" />
          ) : null}
          <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">{total}</text>
          <text x="50" y="61" textAnchor="middle" fontSize="8" fill="currentColor">of {totalExpected}</text>
        </svg>
        <div className="legend-row">
          <span className="legend-dot" style={{ background: color }} /> Progress
          <span className="legend-dot done" /> Done
          <span className="legend-dot extra" /> Extra
          {remaining > 0 ? <><span className="legend-dot missed" /> Remaining</> : null}
        </div>
      </div>
    );
  }

  if (type === 'column') {
    return (
      <div className="chart-shell compact-chart">
        <div className="mini-columns compact-bars rectangular-bars dynamic-bars" aria-label="Habit chart columns">
          {points.map((item, index) => {
            const minHeight = 8;
            const height = item.value <= 0 ? minHeight : minHeight + (item.value / Math.max(max, 1)) * (100 - minHeight);
            return (
              <span key={index} className="dynamic-bar-shell">
                <span className={`dynamic-bar state-${item.state}`} style={{ height: `${Math.min(100, Math.max(minHeight, height))}%`, background: getStateColor(item.state, color) }} />
              </span>
            );
          })}
        </div>
        <div className="chart-axis-labels seven-labels">
          {points.map((item, index) => <span key={`${item.label}-${index}`}>{item.label || '\u00A0'}</span>)}
        </div>
      </div>
    );
  }

  return (
    <div className="chart-shell line-chart-shell">
      <svg className="mini-line compact-chart" viewBox="0 0 100 80" aria-label="Habit chart line" preserveAspectRatio="none">
        <polyline fill="none" stroke="rgba(148, 163, 184, 0.22)" strokeWidth="1.5" points="8,72 92,72" />
        {points.map((item, index) => {
          if (index === 0) return null;
          const prev = points[index - 1];
          const x1 = 8 + ((index - 1) / Math.max(points.length - 1, 1)) * 84;
          const x2 = 8 + (index / Math.max(points.length - 1, 1)) * 84;
          const y1 = toPointY(prev.value, max);
          const y2 = toPointY(item.value, max);
          const segmentState = item.state === 'extra' || prev.state === 'extra' ? 'extra' : item.state === 'done' || prev.state === 'done' ? 'done' : item.state === 'neutral' && prev.state === 'neutral' ? 'neutral' : 'partial';
          return <line key={`segment-${index}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={getStateColor(segmentState, color)} strokeWidth="2.2" strokeLinecap="round" />;
        })}
        {points.map((item, index) => {
          const x = 8 + (index / Math.max(points.length - 1, 1)) * 84;
          const y = toPointY(item.value, max);
          return <circle key={`point-${index}`} cx={x} cy={y} r="1.8" fill={getStateColor(item.state, color)} />;
        })}
      </svg>
      <div className="chart-axis-labels seven-labels">
        {points.map((item, index) => <span key={`${item.label}-${index}`}>{item.label || '\u00A0'}</span>)}
      </div>
    </div>
  );
}
