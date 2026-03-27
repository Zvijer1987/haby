type PointState = "neutral" | "partial" | "done" | "extra";

type CondensedPoint = {
  value: number;
  expected: number;
  label: string;
  state: PointState;
};

function buildSafeSeries(values: number[]) {
  return values.length ? values : [0, 0, 0, 0, 0, 0, 0];
}

function condenseSeries(values: number[], labels?: string[], expectedValues?: number[], bucketCount?: number) {
  const safeValues = buildSafeSeries(values);
  const safeLabels = labels && labels.length === safeValues.length ? labels : safeValues.map((_, index) => String(index + 1));
  const safeExpected = expectedValues && expectedValues.length === safeValues.length ? expectedValues : safeValues.map(() => 1);
  const preferredBuckets = Math.max(1, Math.min(bucketCount || 7, safeValues.length));
  const size = safeValues.length / preferredBuckets;

  return Array.from({ length: preferredBuckets }, (_, bucketIndex) => {
    const start = Math.floor(bucketIndex * size);
    const end = bucketIndex === preferredBuckets - 1 ? safeValues.length : Math.max(start + 1, Math.floor((bucketIndex + 1) * size));
    const bucketValues = safeValues.slice(start, end);
    const bucketLabels = safeLabels.slice(start, end);
    const bucketExpected = safeExpected.slice(start, end);
    const value = bucketValues.reduce((sum, item) => sum + item, 0);
    const expected = Math.max(1, bucketExpected.reduce((sum, item) => sum + item, 0));
    let state: PointState = "neutral";
    if (value > expected) state = "extra";
    else if (value >= expected) state = "done";
    else if (value > 0) state = "partial";
    const labelIndex = Math.min(bucketLabels.length - 1, Math.max(0, Math.floor((bucketLabels.length - 1) / 2)));
    return {
      value,
      expected,
      label: bucketLabels[labelIndex] || bucketLabels[bucketLabels.length - 1] || '',
      state,
    } satisfies CondensedPoint;
  });
}

function getStateColor(state: PointState, fallback?: string) {
  if (state === 'extra') return 'var(--extra)';
  if (state === 'done') return 'var(--chart-done)';
  if (state === 'neutral') return 'var(--chart-neutral)';
  return fallback || 'var(--accent)';
}

function toPointY(value: number, max: number) {
  const baseY = 72;
  const maxHeight = 50;
  const minHeight = 5;
  if (value <= 0) return baseY - minHeight;
  return baseY - (minHeight + (value / Math.max(max, 1)) * (maxHeight - minHeight));
}

export default function OverallChart({
  title,
  values,
  labels,
  type,
  color,
  showTitle = true,
  target = 1,
  current,
  expectedValues,
  pointCount,
}: {
  title: string;
  values: number[];
  labels?: string[];
  type: 'line' | 'column' | 'pie';
  color?: string;
  showTitle?: boolean;
  target?: number;
  current?: number;
  expectedValues?: number[];
  pointCount?: number;
}) {
  const points = condenseSeries(values, labels, expectedValues, pointCount);
  const max = Math.max(...points.map((item) => Math.max(item.value, item.expected)), 1);
  const stroke = color || 'var(--accent)';
  const labelCount = Math.max(points.length, 1);
  const isDense = labelCount > 10;

  const chartBody = type === 'pie'
    ? (() => {
        const total = typeof current === 'number' ? current : values.reduce((sum, value) => sum + value, 0);
        const effectiveTarget = Math.max(1, target);
        const completed = Math.min(total, effectiveTarget);
        const extra = Math.max(0, total - effectiveTarget);
        const circumference = 2 * Math.PI * 28;
        const completedArc = circumference * (completed / Math.max(effectiveTarget + extra, 1));
        const extraArc = circumference * (extra / Math.max(effectiveTarget + extra, 1));
        return (
          <svg className="mini-line large pie-chart-large" viewBox="0 0 100 100" aria-label={title} preserveAspectRatio="xMidYMid meet">
            <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(148, 163, 184, 0.16)" strokeWidth="12" />
            <circle cx="50" cy="50" r="28" fill="none" stroke="var(--chart-done)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${completedArc} ${circumference}`} transform="rotate(-90 50 50)" />
            {extra > 0 ? <circle cx="50" cy="50" r="28" fill="none" stroke="var(--extra)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${extraArc} ${circumference}`} strokeDashoffset={-completedArc} transform="rotate(-90 50 50)" /> : null}
            <text x="50" y="45" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">{total}</text>
            <text x="50" y="58" textAnchor="middle" fontSize="8" fill="currentColor">of {effectiveTarget}</text>
          </svg>
        );
      })()
    : type === 'column'
      ? (
        <svg className={`mini-line large chart-svg-clamped overall-columns-svg ${isDense ? 'dense-widget-chart' : ''}`} viewBox="0 0 100 80" aria-label={title} preserveAspectRatio="none">
          <line x1="6" y1="72" x2="94" y2="72" stroke="rgba(148, 163, 184, 0.22)" strokeWidth="1.2" />
          {points.map((item, index) => {
            const minHeight = 6;
            const chartHeight = 52;
            const valueHeight = item.value <= 0 ? minHeight : minHeight + (item.value / Math.max(max, 1)) * (chartHeight - minHeight);
            const slotWidth = 84 / labelCount;
            const barWidth = Math.max(1.8, Math.min(4.9, slotWidth * 0.35));
            const x = 8 + index * slotWidth + (slotWidth - barWidth) / 2;
            const y = 72 - Math.min(chartHeight, Math.max(minHeight, valueHeight));
            return (
              <rect
                key={`bar-${index}`}
                x={x}
                y={y}
                width={barWidth}
                height={72 - y}
                rx={0.8}
                fill={getStateColor(item.state, stroke)}
              />
            );
          })}
        </svg>
      )
      : (
        <svg className={`mini-line large chart-svg-clamped ${isDense ? 'dense-widget-chart' : ''}`} viewBox="0 0 100 80" aria-label={title} preserveAspectRatio="none">
          <polyline fill="none" stroke="rgba(148, 163, 184, 0.22)" strokeWidth="1.2" points="8,72 92,72" />
          {points.map((item, index) => {
            if (index === 0) return null;
            const prev = points[index - 1];
            const x1 = 8 + ((index - 1) / Math.max(points.length - 1, 1)) * 84;
            const x2 = 8 + (index / Math.max(points.length - 1, 1)) * 84;
            const y1 = toPointY(prev.value, max);
            const y2 = toPointY(item.value, max);
            const segmentState = item.state === 'extra' || prev.state === 'extra' ? 'extra' : item.state === 'done' || prev.state === 'done' ? 'done' : item.state === 'neutral' && prev.state === 'neutral' ? 'neutral' : 'partial';
            return <line key={`segment-${index}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={getStateColor(segmentState, stroke)} strokeWidth="2.2" strokeLinecap="round" />;
          })}
          {points.map((item, index) => {
            const x = 8 + (index / Math.max(points.length - 1, 1)) * 84;
            const y = toPointY(item.value, max);
            return <circle key={`point-${index}`} cx={x} cy={y} r="1.8" fill={getStateColor(item.state, stroke)} />;
          })}
        </svg>
      );

  return (
    <div className="widget-card chart-widget-card">
      {showTitle ? <div className="row-between"><strong>{title}</strong></div> : null}
      {chartBody}
      {type !== 'pie' ? (
        <div className={`chart-axis-labels widget-axis-labels ${isDense ? 'compressed' : ''}`} style={{ ['--label-count' as any]: labelCount }}>
          {points.map((item, index) => <span key={`${item.label}-${index}`}>{item.label || '\u00A0'}</span>)}
        </div>
      ) : null}
    </div>
  );
}
