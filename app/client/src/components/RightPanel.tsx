import { useMemo, useState } from 'react';
import { toLocalDateString } from '../utils/date';
import type { Habit, Widget } from '../store/useStore';
import OverallChart from './OverallChart';
import MonthlyMiniCalendar from './MonthlyMiniCalendar';

function toTitleCase(value: string) {
  return String(value || '').replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function isArchivedWidgetSource(habit: Habit) {
  const raw = habit as any;

  return Boolean(
    raw.isArchived ||
    raw.is_archived ||
    Number(raw.is_archived ?? 0) === 1
  );
}

function iso(date: Date) {
  return toLocalDateString(date);
}

function aggregateHistory(history: { date: string; value: number }[]) {
  const map = new Map<string, number>();
  for (const item of history || []) map.set(item.date, (map.get(item.date) || 0) + (item.value || 0));
  return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
}

function buildSeries(history: { date: string; value: number }[], days: number, expectedPerDay = 1) {
  const map = new Map(aggregateHistory(history).map((item) => [item.date, item.value || 0]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const values = Array.from({ length: days }, (_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - idx));
    return map.get(iso(date)) || 0;
  });

  const labels = Array.from({ length: days }, (_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - idx));
    return String(date.getDate());
  });

  const expectedValues = Array.from({ length: days }, () => Math.max(1, Number(expectedPerDay || 1)));

  return { values, labels, expectedValues };
}

function buildOverallExpectedSeries(
  habits: Habit[],
  histories: Record<number, { date: string; value: number }[]>,
  days: number,
) {
  const totals = new Map<string, number>();

  for (const habit of habits) {
    const expected = Math.max(1, Number(habit.expectedPerDay || habit.targetCount || 1));
    for (const point of histories[habit.id] || []) {
      totals.set(point.date, (totals.get(point.date) || 0) + expected);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - idx));
    return Math.max(1, totals.get(iso(date)) || 1);
  });
}

export default function RightPanel({
  widgets,
  habits,
  histories,
  selectedCategory,
  onAddWidget,
  onDeleteWidget,
  onReorderWidgets,
  onUpdateWidget,
}: {
  widgets: Widget[];
  habits: Habit[];
  histories: Record<number, { date: string; value: number }[]>;
  selectedCategory: string;
  onAddWidget: (type: string, label: string, config?: any) => Promise<void>;
  onDeleteWidget: (id: number) => Promise<void>;
  onReorderWidgets: (ids: number[]) => Promise<void>;
  onUpdateWidget: (id: number, label: string, config: any) => Promise<void>;
}) {
  const [selectedDate, setSelectedDate] = useState(() => iso(new Date()));

  const move = async (id: number, direction: -1 | 1) => {
    const index = widgets.findIndex((widget) => widget.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= widgets.length) return;

    const next = [...widgets];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);

    await onReorderWidgets(next.map((widget) => widget.id));
  };

  const filteredHabits = useMemo(
    () => habits.filter((habit) => selectedCategory === 'all' || String(habit.categoryId) === selectedCategory),
    [habits, selectedCategory],
  );

  const addWidgetHabits = useMemo(
    () => filteredHabits.filter((habit) => !habit.isArchived),
    [filteredHabits],
  );

  const selectedDoneItems = useMemo(
    () =>
      filteredHabits.flatMap((habit) => {
        const value = (histories[habit.id] || []).find((entry) => entry.date === selectedDate)?.value || 0;
        return value > 0 ? [{ id: habit.id, icon: habit.icon, name: habit.name, value }] : [];
      }),
    [filteredHabits, histories, selectedDate],
  );

  const aggregatedHistory = useMemo(
    () => aggregateHistory(filteredHabits.flatMap((habit) => histories[habit.id] || [])),
    [filteredHabits, histories],
  );

  const visibleWidgets = widgets
    .filter((widget) => widget.type !== 'current')
    .map((widget) => {
      if (widget.type === 'doneList' && widget.label === 'Done list') return { ...widget, label: 'Today List' };
      if (widget.type === 'history' && widget.label === 'Graph history') return { ...widget, label: 'Overall History' };
      return widget;
    });

  async function removeFirst(matcher: (widget: Widget) => boolean) {
    const found = visibleWidgets.find(matcher);
    if (found) await onDeleteWidget(found.id);
  }

  const widgetCatalog = [
    {
      key: 'history',
      label: 'Overall History',
      add: () => onAddWidget('history', 'Overall History', { type: 'column', days: 14 }),
      remove: () => removeFirst((widget) => widget.type === 'history'),
      exists: () => visibleWidgets.some((widget) => widget.type === 'history'),
    },
    {
      key: 'calendar',
      label: 'Calendar',
      add: () => onAddWidget('calendar', 'Calendar'),
      remove: () => removeFirst((widget) => widget.type === 'calendar'),
      exists: () => visibleWidgets.some((widget) => widget.type === 'calendar'),
    },
    {
      key: 'doneList',
      label: 'Today List',
      add: () => onAddWidget('doneList', 'Today List'),
      remove: () => removeFirst((widget) => widget.type === 'doneList'),
      exists: () => visibleWidgets.some((widget) => widget.type === 'doneList'),
    },
    ...filteredHabits.map((habit) => ({
      key: `habitChart-${habit.id}`,
      label: toTitleCase(habit.name),
      canAdd: !isArchivedWidgetSource(habit),
      add: () => onAddWidget('habitChart', toTitleCase(habit.name), { habitId: habit.id, type: habit.chartType, days: 30 }),
      remove: () => removeFirst((widget) => widget.type === 'habitChart' && widget.config?.habitId === habit.id),
      exists: () => visibleWidgets.some((widget) => widget.type === 'habitChart' && widget.config?.habitId === habit.id),
    })),
  ];

  const addableWidgets = widgetCatalog.filter((item) => ((item as any).canAdd ?? true) && !item.exists());
  const removableWidgets = widgetCatalog.filter((item) => item.exists());

  return (
    <div className="panel stack-gap right-panel" id="customize-widgets-panel">
      <div className="widgets-control-panel panel stack-gap sidebar-panel right-ghost-panel">
        <h3 className="widgets-panel-title">Widgets</h3>

        <details className="panel-details widgets-manage-accordion">
          <summary className="summary-btn widgets-summary-btn">Add Widgets</summary>
          <div className="inner-pad stack-gap widget-catalog-list">
            {addableWidgets.length ? (
              addableWidgets.map((item) => (
                <div key={item.key} className="list-row widget-catalog-row">
                  <span>{toTitleCase(item.label)}</span>
                  <div className="inline-actions">
                    <button type="button" className="soft-btn small-btn" onClick={item.add}>
                      Add
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="muted-text">All available widgets are already added.</div>
            )}
          </div>
        </details>

        <details className="panel-details widgets-manage-accordion">
          <summary className="summary-btn widgets-summary-btn">Remove Widgets</summary>
          <div className="inner-pad stack-gap widget-catalog-list">
            {removableWidgets.length ? (
              removableWidgets.map((item) => (
                <div key={item.key} className="list-row widget-catalog-row">
                  <span>{toTitleCase(item.label)}</span>
                  <div className="inline-actions">
                    <button type="button" className="danger-btn small-btn" onClick={item.remove}>
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="muted-text">No widgets are currently active.</div>
            )}
          </div>
        </details>
      </div>

      {visibleWidgets.map((widget) => {
        const history = widget.type === 'habitChart' ? histories[widget.config?.habitId] || [] : [];
        const habit =
          widget.type === 'habitChart'
            ? filteredHabits.find((item) => item.id === widget.config?.habitId) ||
              habits.find((item) => item.id === widget.config?.habitId)
            : undefined;

        const days = ([7, 14, 30].includes(widget.config?.days) ? widget.config.days : 14) as 7 | 14 | 30;
        const overallWindowDays = days === 30 ? 60 : days;
        const overallPointCount = days === 30 ? 14 : 7;
        const habitPointCount = days === 30 ? 14 : 7;

        const chartSeries =
          widget.type === 'history'
            ? {
                ...buildSeries(aggregatedHistory, overallWindowDays, 1),
                expectedValues: buildOverallExpectedSeries(filteredHabits, histories, overallWindowDays),
              }
            : buildSeries(history, days, habit?.expectedPerDay || habit?.targetCount || 1);

        return (
          <div key={widget.id} className="widget-shell">
            <div className="widget-config-row widget-header-row">
              <strong className="widget-label">{toTitleCase(widget.label)}</strong>
              <div className="inline-actions">
                <button type="button" className="ghost-btn small-btn" onClick={() => move(widget.id, -1)}>
                  ↑
                </button>
                <button type="button" className="ghost-btn small-btn" onClick={() => move(widget.id, 1)}>
                  ↓
                </button>
              </div>
            </div>

            {widget.type === 'history' || widget.type === 'habitChart' ? (
              <>
                <div className="widget-config-row compact-row">
                  <span>Type</span>
                  <div className="tiny-toggle small-toggle segmented-no-refresh">
                    {(['line', 'column', ...(widget.type === 'habitChart' ? ['pie'] : [])] as const).map((chartType) => (
                      <span
                        key={chartType}
                        className={(widget.config?.type || 'line') === chartType ? 'active' : ''}
                        onClick={() => onUpdateWidget(widget.id, widget.label, { ...widget.config, type: chartType })}
                      >
                        {chartType === 'pie' ? 'Pie' : chartType === 'column' ? 'Column' : 'Line'}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="widget-config-row compact-row">
                  <span>Range</span>
                  <div className="tiny-toggle small-toggle segmented-no-refresh">
                    {[7, 14, 30].map((dayCount) => (
                      <span
                        key={dayCount}
                        className={days === dayCount ? 'active' : ''}
                        onClick={() => onUpdateWidget(widget.id, widget.label, { ...widget.config, days: dayCount })}
                      >
                        {dayCount}D
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {widget.type === 'history' ? (
              <OverallChart
                title="Overall History"
                values={chartSeries.values}
                labels={chartSeries.labels}
                expectedValues={chartSeries.expectedValues}
                type={widget.config?.type === 'column' ? 'column' : 'line'}
                showTitle={false}
                pointCount={overallPointCount}
              />
            ) : null}

            {widget.type === 'calendar' ? (
              <div className="widget-card">
                <MonthlyMiniCalendar
                  history={aggregatedHistory}
                  target={1}
                  showMissedLegend={false}
                  variant="widget"
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  neutralMissed
                />
              </div>
            ) : null}

            {widget.type === 'doneList' ? (
              <div className="widget-card done-widget">
                <div className="muted-text">{selectedDate}</div>
                {selectedDoneItems.length ? (
                  selectedDoneItems.map((item) => (
                    <div key={item.id} className="done-row">
                      <span>{item.icon}</span>
                      <span>{toTitleCase(item.name)}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))
                ) : (
                  <div className="muted-text">No Completed Habits Or Goals For This Day.</div>
                )}
              </div>
            ) : null}

            {widget.type === 'habitChart' ? (
              <OverallChart
                title={toTitleCase(widget.label)}
                values={chartSeries.values}
                labels={chartSeries.labels}
                type={(widget.config?.type || 'line') === 'pie' ? 'pie' : widget.config?.type === 'column' ? 'column' : 'line'}
                color={habit?.color}
                target={habit?.targetCount || 1}
                current={habit?.progress?.current || 0}
                showTitle={false}
                expectedValues={chartSeries.expectedValues}
                pointCount={habitPointCount}
              />
            ) : null}

            <div className="widget-footer-actions">
              <button type="button" className="danger-btn small-btn" onClick={() => onDeleteWidget(widget.id)}>
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
