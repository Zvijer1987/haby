import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import LoginView from './components/LoginView';
import AccountPanel from './components/AccountPanel';
import SidebarMenu from './components/SidebarMenu';
import HabitCard from './components/HabitCard';
import HabitModal from './components/HabitModal';
import RightPanel from './components/RightPanel';
import HabyInfoPanel from './components/HabyInfoPanel';
import DashboardSettingsModal, { defaultDashboardBackground } from './components/DashboardSettingsModal';
import { useStore, type Habit } from './store/useStore';

function toTitleCase(value: string) {
  return String(value || '').replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

type LayoutItem = { x: number; y: number };
type DragState = {
  id: number;
  section: 'habit' | 'goal';
  key: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  previewX: number;
  previewY: number;
};

const SECTION_GAP = 16;
const SECTION_PADDING = 12;
const DESKTOP_UI_SCALE = 0.8;

function getUiScale() {
  if (typeof window === 'undefined') return 1;
  return window.innerWidth >= 901 ? DESKTOP_UI_SCALE : 1;
}

function toLayoutPx(value: number, scale = getUiScale()) {
  return value / scale;
}

function normalizeNameKey(prefix: 'habit' | 'goal', id: number) {
  return `${prefix}-${id}`;
}

function getCardWidth(item: Habit) {
  const visualCount = Number(Boolean(item.showChart)) + Number(Boolean(item.showMiniCalendar));
  if (visualCount === 0) return 410;
  if (visualCount === 1) return 330;
  return item.habitType === 'goal' ? 365 : 390;
}

function getEstimatedHeight(item: Habit) {
  const visualCount = Number(Boolean(item.showChart)) + Number(Boolean(item.showMiniCalendar));
  if (visualCount === 0) return item.habitType === 'goal' ? 210 : 200;
  if (visualCount === 1) return item.habitType === 'goal' ? 360 : 330;
  return item.habitType === 'goal' ? 520 : 470;
}

function normalizeDashboardBackground(value?: string, theme?: string) {
  const fallback = theme === 'dark' ? '/haby-dashboard-dark-v5.png' : defaultDashboardBackground;
  const next = (value || '').trim();
  if (!next) return fallback;
  if (next.startsWith('data:image/svg+xml')) return fallback;
  if (next === defaultDashboardBackground || next === '/haby-dashboard-dark-v5.png') return fallback;
  return next;
}

function parseLayoutSetting(raw?: string) {
  if (!raw) return {} as Record<string, LayoutItem>;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, LayoutItem>;
  } catch {}
  return {} as Record<string, LayoutItem>;
}

function normalizeSavedLayout(item: any) {
  if (!item || typeof item !== 'object') return null;
  const x = Number(item.x);
  const y = Number(item.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if ('w' in item || 'h' in item) {
    return { x: Math.max(0, x * 40), y: Math.max(0, y * 40) };
  }
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

function sortByLayout(items: Habit[], existing: Record<string, LayoutItem>, prefix: 'habit' | 'goal') {
  return [...items].sort((a, b) => {
    const la = existing[normalizeNameKey(prefix, a.id)] || { x: 0, y: Number.MAX_SAFE_INTEGER };
    const lb = existing[normalizeNameKey(prefix, b.id)] || { x: 0, y: Number.MAX_SAFE_INTEGER };
    return la.y - lb.y || la.x - lb.x || (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id;
  });
}

function layoutWithDefaults(items: Habit[], existing: Record<string, LayoutItem>, prefix: 'habit' | 'goal', sectionWidth: number) {
  const ordered = sortByLayout(items, existing, prefix);
  const next: Record<string, LayoutItem> = {};
  const usableWidth = Math.max(320, sectionWidth - SECTION_PADDING * 2);
  const occupied: Array<{ x: number; y: number; width: number; height: number }> = [];

  function overlaps(x: number, y: number, width: number, height: number) {
    return occupied.some((box) => !(x + width + SECTION_GAP <= box.x || box.x + box.width + SECTION_GAP <= x || y + height + SECTION_GAP <= box.y || box.y + box.height + SECTION_GAP <= y));
  }

  function placeFirstFree(width: number, height: number) {
    const step = 24;
    for (let y = 0; y < 6000; y += step) {
      for (let x = 0; x <= Math.max(0, usableWidth - width); x += step) {
        if (!overlaps(x, y, width, height)) return { x, y };
      }
    }
    const bottom = occupied.reduce((max, box) => Math.max(max, box.y + box.height), 0);
    return { x: 0, y: bottom + SECTION_GAP };
  }

  for (const item of ordered) {
    const key = normalizeNameKey(prefix, item.id);
    const width = getCardWidth(item);
    const height = getEstimatedHeight(item);
    const saved = normalizeSavedLayout(existing[key]);
    if (saved) {
      next[key] = saved;
      occupied.push({ x: saved.x, y: saved.y, width, height });
      continue;
    }
    const placed = placeFirstFree(width, height);
    next[key] = placed;
    occupied.push({ x: placed.x, y: placed.y, width, height });
  }

  return next;
}

function clampToSection(rawX: number, rawY: number, section: HTMLDivElement, width: number, height: number) {
  const maxX = Math.max(0, section.clientWidth - width);
  return {
    x: Math.max(0, Math.min(rawX, maxX)),
    y: Math.max(0, rawY),
    width,
    height,
  };
}

function isExpiredRepeatableItem(item: Habit) {
  if (!item.repeatable) return false;
  return item.progress?.nextPeriodStart ? item.progress.nextPeriodStart <= item.progress.today : false;
}

function normalizeRepeatBaseName(value?: string) {
  return String(value || '')
    .replace(/\s*\((day|week|month)\s+\d+\)\s*$/i, '')
    .trim()
    .toLowerCase();
}

function getComparableRepeatKey(item: Habit) {
  return [
    normalizeRepeatBaseName(item.repeatBaseName || item.name),
    item.habitType || 'standard',
    item.period || 'daily',
    item.repeatable ? 'repeatable' : 'single',
    Number(item.targetCount || 1),
    Number(item.expectedPerDay || 1),
    item.unitLabel || '',
    String(item.categoryId || ''),
  ].join('::');
}

function getGroupedRepeatItems(item: Habit, allItems: Habit[]) {
  if (!item.repeatable) return [item];
  const key = getComparableRepeatKey(item);
  return allItems.filter((candidate) => getComparableRepeatKey(candidate) === key);
}

function mergeGroupHistory(items: Habit[], histories: Record<number, { date: string; value: number }[]>) {
  const map = new Map<string, number>();
  for (const item of items) {
    for (const point of histories[item.id] || []) {
      map.set(point.date, (map.get(point.date) || 0) + (point.value || 0));
    }
  }
  return Array.from(map.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getCardChartConfig(item: Habit, groupedItems: Habit[], histories: Record<number, { date: string; value: number }[]>) {
  return { showChart: false as const, range: 7 as const, history: histories[item.id] || [] };
}

export default function App() {
  const store = useStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; entityType: 'standard' | 'goal'; habit?: Habit | null } | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [dashboardResizeHeight, setDashboardResizeHeight] = useState<number | null>(null);
  const [sectionOpen, setSectionOpen] = useState({ habits: true, goals: true, archived: false });
  const [habitLayout, setHabitLayout] = useState<Record<string, LayoutItem>>({});
  const [goalLayout, setGoalLayout] = useState<Record<string, LayoutItem>>({});
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [sectionWidths, setSectionWidths] = useState({ habit: 1080, goal: 1080 });
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const habitSectionRef = useRef<HTMLDivElement | null>(null);
  const goalSectionRef = useRef<HTMLDivElement | null>(null);
  const dashboardHeroRef = useRef<HTMLDivElement | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const theme = store.settings.theme || 'light';
  const uiStyle = store.settings.uiStyle || 'classic';
  const dashboardOpacity = Number(store.settings.dashboardOpacity || '0.14');
  const savedDashboardHeroHeight = Math.min(360, Math.max(96, Number(store.settings.dashboardHeroHeight || '132')));
  const dashboardHeroHeight = dashboardResizeHeight ?? savedDashboardHeroHeight;
  const background = normalizeDashboardBackground(store.settings.dashboardBackground, theme);
  const dashboardBackgroundMode = store.settings.dashboardBackgroundMode || 'center';
  const dashboardBackgroundPositionX = store.settings.dashboardBackgroundPositionX || '50';
  const dashboardBackgroundPositionY = store.settings.dashboardBackgroundPositionY || '50';
  const dashboardBackgroundZoom = store.settings.dashboardBackgroundZoom || '100';
  const overlayAlpha = theme === 'dark'
    ? Math.min(0.68, 0.28 + (1 - dashboardOpacity) * 0.36)
    : Math.min(0.82, 0.14 + (1 - dashboardOpacity) * 0.42);

  const dashboardStyle = {
    backgroundImage: theme === 'dark'
      ? `linear-gradient(rgba(5,11,23,${overlayAlpha}), rgba(5,11,23,${overlayAlpha})), url(${background})`
      : `linear-gradient(rgba(255,255,255,${overlayAlpha}), rgba(255,255,255,${overlayAlpha})), url(${background})`,
    backgroundSize: dashboardBackgroundMode === 'stretch'
      ? '100% 100%'
      : dashboardBackgroundMode === 'align'
        ? `${Math.min(200, Math.max(50, Number(dashboardBackgroundZoom || '100')))}% auto`
        : 'cover',
    backgroundPosition: dashboardBackgroundMode === 'align'
      ? `${Number(dashboardBackgroundPositionX || '50')}% ${Number(dashboardBackgroundPositionY || '50')}%`
      : 'center center',
    backgroundRepeat: 'no-repeat',
    height: `${dashboardHeroHeight}px`,
    minHeight: `${dashboardHeroHeight}px`,
    '--dashboard-hero-height': `${dashboardHeroHeight}px`,
  } as CSSProperties;

  useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-dark', 'ui-classic', 'ui-modern');
    document.body.classList.add(
      theme === 'dark' ? 'theme-dark' : 'theme-light',
      uiStyle === 'modern' ? 'ui-modern' : 'ui-classic',
    );

    return () => {
      document.body.classList.remove('theme-light', 'theme-dark', 'ui-classic', 'ui-modern');
    };
  }, [theme, uiStyle]);


  const filteredItems = useMemo(() => store.habits.filter((habit) => selectedCategory === 'all' || String(habit.categoryId) === selectedCategory), [store.habits, selectedCategory]);
  const archivedItems = useMemo(() => filteredItems.filter((item) => item.isArchived || isExpiredRepeatableItem(item)), [filteredItems]);
  const activeItems = useMemo(() => filteredItems.filter((item) => !item.isArchived && !isExpiredRepeatableItem(item)), [filteredItems]);
  const activeHabitsBase = useMemo(() => activeItems.filter((item) => item.habitType !== 'goal'), [activeItems]);
  const activeGoalsBase = useMemo(() => activeItems.filter((item) => item.habitType === 'goal'), [activeItems]);
  const archivedItemsSorted = useMemo(() => [...archivedItems].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id), [archivedItems]);

  useEffect(() => { setHabitLayout(parseLayoutSetting(store.settings.habitLayout)); }, [store.settings.habitLayout]);
  useEffect(() => { setGoalLayout(parseLayoutSetting(store.settings.goalLayout)); }, [store.settings.goalLayout]);

  useLayoutEffect(() => {
    const refresh = () => {
      setSectionWidths({
        habit: habitSectionRef.current?.clientWidth || 1080,
        goal: goalSectionRef.current?.clientWidth || 1080,
      });
    };
    refresh();
    window.addEventListener('resize', refresh);
    return () => window.removeEventListener('resize', refresh);
  }, []);

  const normalizedHabitLayout = useMemo(() => layoutWithDefaults(activeHabitsBase, habitLayout, 'habit', sectionWidths.habit), [activeHabitsBase, habitLayout, sectionWidths.habit]);
  const normalizedGoalLayout = useMemo(() => layoutWithDefaults(activeGoalsBase, goalLayout, 'goal', sectionWidths.goal), [activeGoalsBase, goalLayout, sectionWidths.goal]);
  const activeHabits = useMemo(() => sortByLayout(activeHabitsBase, normalizedHabitLayout, 'habit'), [activeHabitsBase, normalizedHabitLayout]);
  const activeGoals = useMemo(() => sortByLayout(activeGoalsBase, normalizedGoalLayout, 'goal'), [activeGoalsBase, normalizedGoalLayout]);

  useEffect(() => {
    const expiredIds = store.habits
      .filter((item) => item.repeatable && !item.isArchived && isExpiredRepeatableItem(item))
      .map((item) => item.id);
    if (!expiredIds.length) return;
    void Promise.all(expiredIds.map((id) => store.archiveHabit(id)));
  }, [store.habits]);

  useEffect(() => {
    if (!dragging) return;

    function onPointerMove(event: PointerEvent) {
      if (!dragging) return;
      const section = dragging.section === 'habit' ? habitSectionRef.current : goalSectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const offsetX = dragging.offsetX ?? 0;
      const offsetY = dragging.offsetY ?? 0;
        const scale = getUiScale();
        const next = clampToSection(
          toLayoutPx(event.clientX - rect.left, scale) - offsetX,
          toLayoutPx(event.clientY - rect.top, scale) - offsetY,
          section,
          dragging.width,
          dragging.height
        );

      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = requestAnimationFrame(() => {
        setDragging((prev) => prev ? { ...prev, previewX: next.x, previewY: next.y } : prev);
        dragFrameRef.current = null;
      });
    }

    async function onPointerUp() {
      const finalDrag = dragging;
      setDragging(null);
      if (!finalDrag) return;
      const nextItem = { x: Math.round(finalDrag.previewX), y: Math.round(finalDrag.previewY) };
      if (finalDrag.section === 'habit') {
        const next = { ...normalizedHabitLayout, [finalDrag.key]: nextItem };
        setHabitLayout(next);
        await store.saveSetting('habitLayout', JSON.stringify(next));
      } else {
        const next = { ...normalizedGoalLayout, [finalDrag.key]: nextItem };
        setGoalLayout(next);
        await store.saveSetting('goalLayout', JSON.stringify(next));
      }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
    };
  }, [dragging, normalizedHabitLayout, normalizedGoalLayout, store]);

  function beginDashboardResize(event: any) {
    const hero = dashboardHeroRef.current;
    if (!hero) return;

    const heroElement = hero;
    const startY = Number(event.clientY || 0);
    const startHeight = heroElement.getBoundingClientRect().height || dashboardHeroHeight;
    let latestHeight = Math.round(startHeight);

    document.body.classList.add('dashboard-resizing');

    function applyHeight(clientY: number) {
      const delta = clientY - startY;
      latestHeight = Math.round(Math.min(360, Math.max(96, startHeight + delta)));

      heroElement.style.setProperty('--dashboard-hero-height', `${latestHeight}px`);
      heroElement.style.height = `${latestHeight}px`;
      heroElement.style.minHeight = `${latestHeight}px`;

      setDashboardResizeHeight(latestHeight);
    }

    function onMouseMove(mouseEvent: MouseEvent) {
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      applyHeight(mouseEvent.clientY);
    }

    function onMouseUp(mouseEvent: MouseEvent) {
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();

      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('mouseup', onMouseUp, true);
      document.body.classList.remove('dashboard-resizing');

      heroElement.style.setProperty('--dashboard-hero-height', `${latestHeight}px`);
      heroElement.style.height = `${latestHeight}px`;
      heroElement.style.minHeight = `${latestHeight}px`;

      void store.saveSetting('dashboardHeroHeight', String(latestHeight)).finally(() => {
        setDashboardResizeHeight(null);
      });
    }

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);

    event.preventDefault();
    event.stopPropagation();
  }

  function updateCardHeight(key: string, height: number) {
    setCardHeights((prev) => (prev[key] === height ? prev : { ...prev, [key]: height }));
  }

  function beginCardDrag(event: ReactPointerEvent<HTMLElement>, habit: Habit, section: 'habit' | 'goal') {
    if ((event.target as HTMLElement).closest('button, input, textarea, select, summary, a, label')) return;
    const sectionEl = section === 'habit' ? habitSectionRef.current : goalSectionRef.current;
    const cardEl = event.currentTarget as HTMLElement;
    if (!sectionEl) return;
      const sectionRect = sectionEl.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();
      const scale = getUiScale();
      const cardX = toLayoutPx(cardRect.left - sectionRect.left, scale);
      const cardY = toLayoutPx(cardRect.top - sectionRect.top, scale);
      const cardWidth = toLayoutPx(cardRect.width, scale);
      const cardHeight = toLayoutPx(cardRect.height, scale);
      const next = clampToSection(cardX, cardY, sectionEl, cardWidth, cardHeight);
      setDragging({
        id: habit.id,
        section,
        key: normalizeNameKey(section, habit.id),
        offsetX: toLayoutPx(event.clientX - cardRect.left, scale),
        offsetY: toLayoutPx(event.clientY - cardRect.top, scale),
        width: cardWidth,
        height: cardHeight,
        previewX: next.x,
        previewY: next.y,
      });
    cardEl.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

    function getSectionMinHeight(layout: Record<string, LayoutItem>, section: 'habit' | 'goal', items: Habit[]) {
      const scale = getUiScale();
      const bottoms = items.map((item) => {
        const key = normalizeNameKey(section, item.id);
        const pos = layout[key] || { x: 0, y: 0 };
        const estimated = getEstimatedHeight(item);
        const measured = cardHeights[key] || 0;
        const normalizedMeasured = measured > 0 ? toLayoutPx(measured, scale) : 0;
        const actual = Math.max(estimated, normalizedMeasured);
        return pos.y + actual;
      });
      return Math.max(480, ...bottoms) + 64;
    }

  if (store.bootstrapping || store.loading) return <div className="app-loading">Loading Haby...</div>;
  if (!store.authUser) return <LoginView onLogin={store.login} />;

  return (
    <div className={`app-shell ${theme === 'dark' ? 'theme-dark' : 'theme-light'} ${uiStyle === 'modern' ? 'ui-modern' : 'ui-classic'}`}>
      <div className="layout-grid">
        <div className="left-column stack-gap">
          <AccountPanel
            theme={theme}
            setTheme={(next) => { void store.saveSetting('theme', next); }}
            uiStyle={uiStyle}
            setUiStyle={(next) => { void store.saveSetting('uiStyle', next); }}
            user={store.authUser}
            profilePicture={store.settings.profilePicture || '/Haby_profile.png'}
            onSaveProfilePicture={(value) => store.saveSetting('profilePicture', value)}
            onLogout={store.logout}
            onChangeUsername={store.changeUsername}
            onChangePassword={store.changePassword}
            onListUsers={store.listUsers}
            onCreateUser={store.createUserAccount}
            onDisableUser={store.disableUserAccount}
            onEnableUser={store.enableUserAccount}
            onDeleteUser={store.deleteUserAccount}
            onBackupExport={store.exportData}
            onBackupImportPreview={store.previewImportData}
            onBackupImportConfirm={store.importData}
          />
          <SidebarMenu
            categories={store.categories}
            habits={activeHabitsBase}
            goals={activeGoalsBase}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            onCreateCategory={store.createCategory}
            onDeleteCategory={store.deleteCategory}
            onCreateHabit={() => setModal({ mode: 'create', entityType: 'standard' })}
            onCreateGoal={() => setModal({ mode: 'create', entityType: 'goal' })}
            onDeleteHabit={store.deleteHabit}
            onDeleteGoal={store.deleteHabit}
            onExport={store.exportData}
            onImportPreview={store.previewImportData}
            onImportConfirm={store.importData}
          />
        </div>

        <main className="center-column stack-gap main-sections">

          <div ref={dashboardHeroRef} className="dashboard-hero dashboard-hero-has-image dashboard-hero-fresh" style={dashboardStyle}>
                  <div>
                    <h1>{store.settings.dashboardTitle || 'Haby Dashboard'}</h1>
                    <p>{store.settings.dashboardDescription || 'Track habits, goals, charts, widgets, categories, and progress in one place.'}</p>
                  </div>
                  <button type="button" className="soft-btn small-btn" onClick={() => setDashboardOpen(true)}>Customize</button>
                  <div
                    className="dashboard-resize-handle"
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize dashboard banner"
                    onMouseDown={beginDashboardResize}
                  />
                </div>
          
          
          <section className="section-block section-collapsible">
            <div className="section-head section-head-row">
              <button type="button" className="section-toggle" onClick={() => setSectionOpen((prev) => ({ ...prev, habits: !prev.habits }))}>
                <span className="section-toggle-copy"><span className="section-toggle-caret">{sectionOpen.habits ? '▾' : '▸'}</span><h2>Active Habits</h2></span>
                <span className="section-count-pill">{activeHabits.length}</span>
              </button>
              <button type="button" className="primary-btn small-btn" onClick={() => setModal({ mode: 'create', entityType: 'standard' })}>+ Add Habit</button>
            </div>

            {sectionOpen.habits ? (
              <div
                className={`canvas-placement-grid pixel-placement-grid ${dragging?.section === 'habit' ? 'dragging-active' : ''}`}
                ref={habitSectionRef}
                style={{ minHeight: getSectionMinHeight(normalizedHabitLayout, 'habit', activeHabits) } as CSSProperties}
              >
                {dragging?.section === 'habit' ? (
                  <>
                    <div className="placement-grid-overlay" />
                    <div
                      className="placement-drop-preview"
                      style={{ left: dragging.previewX, top: dragging.previewY, width: dragging.width, height: dragging.height }}
                    />
                  </>
                ) : null}
                {activeHabits.map((habit) => {
                  const key = normalizeNameKey('habit', habit.id);
                  const layoutItem = normalizedHabitLayout[key] || { x: 0, y: 0 };
                  const groupedItems = getGroupedRepeatItems(habit, store.habits);
                  const cardChart = getCardChartConfig(habit, groupedItems, store.histories);
                  return (
                    <HabitCard
                      key={habit.id}
                      layoutKey={key}
                      isDragging={dragging?.key === key}
                      onMeasure={updateCardHeight}
                      cardStyle={{ left: layoutItem.x, top: layoutItem.y, width: getCardWidth(habit), position: 'absolute' }}
                      habit={{ ...habit, name: toTitleCase(habit.name), description: habit.description }}
                      history={store.histories[habit.id] || []}
                      chartHistory={cardChart.history}
                      chartRange={cardChart.range}
                      chartVisible={cardChart.showChart}
                      onIncrement={async (amount = 1) => store.addEntry(habit.id, amount)}
                      onDecrement={async () => store.addEntry(habit.id, -1)}
                      onEdit={() => setModal({ mode: 'edit', entityType: 'standard', habit })}
                      onArchive={() => store.archiveHabit(habit.id)}
                      onDelete={() => store.deleteHabit(habit.id)}
                      onPointerStart={(event) => beginCardDrag(event, habit, 'habit')}
                    />
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className="section-block section-collapsible">
            <div className="section-head section-head-row">
              <button type="button" className="section-toggle" onClick={() => setSectionOpen((prev) => ({ ...prev, goals: !prev.goals }))}>
                <span className="section-toggle-copy"><span className="section-toggle-caret">{sectionOpen.goals ? '▾' : '▸'}</span><h2>Active Goals</h2></span>
                <span className="section-count-pill">{activeGoals.length}</span>
              </button>
              <button type="button" className="primary-btn small-btn" onClick={() => setModal({ mode: 'create', entityType: 'goal' })}>+ Add Goal</button>
            </div>

            {sectionOpen.goals ? (
              <div
                className={`canvas-placement-grid pixel-placement-grid ${dragging?.section === 'goal' ? 'dragging-active' : ''}`}
                ref={goalSectionRef}
                style={{ minHeight: getSectionMinHeight(normalizedGoalLayout, 'goal', activeGoals) } as CSSProperties}
              >
                {dragging?.section === 'goal' ? (
                  <>
                    <div className="placement-grid-overlay" />
                    <div
                      className="placement-drop-preview"
                      style={{ left: dragging.previewX, top: dragging.previewY, width: dragging.width, height: dragging.height }}
                    />
                  </>
                ) : null}
                {activeGoals.map((habit) => {
                  const key = normalizeNameKey('goal', habit.id);
                  const layoutItem = normalizedGoalLayout[key] || { x: 0, y: 0 };
                  const groupedItems = getGroupedRepeatItems(habit, store.habits);
                  const cardChart = getCardChartConfig(habit, groupedItems, store.histories);
                  return (
                    <HabitCard
                      key={habit.id}
                      layoutKey={key}
                      isDragging={dragging?.key === key}
                      onMeasure={updateCardHeight}
                      cardStyle={{ left: layoutItem.x, top: layoutItem.y, width: getCardWidth(habit), position: 'absolute' }}
                      habit={{ ...habit, name: toTitleCase(habit.name), description: habit.description }}
                      history={store.histories[habit.id] || []}
                      chartHistory={cardChart.history}
                      chartRange={cardChart.range}
                      chartVisible={cardChart.showChart}
                      onIncrement={async (amount = 1) => store.addEntry(habit.id, amount)}
                      onDecrement={async () => store.addEntry(habit.id, -1)}
                      onEdit={() => setModal({ mode: 'edit', entityType: 'goal', habit })}
                      onArchive={() => store.archiveHabit(habit.id)}
                      onDelete={() => store.deleteHabit(habit.id)}
                      onPointerStart={(event) => beginCardDrag(event, habit, 'goal')}
                    />
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className="section-block section-collapsible">
            <div className="section-head section-head-row">
              <button type="button" className="section-toggle" onClick={() => setSectionOpen((prev) => ({ ...prev, archived: !prev.archived }))}>
                <span className="section-toggle-copy"><span className="section-toggle-caret">{sectionOpen.archived ? '▾' : '▸'}</span><h2>Archived</h2></span>
                <span className="section-count-pill">{archivedItemsSorted.length}</span>
              </button>
            </div>
            {sectionOpen.archived ? (
              <div className="habit-grid">
                {archivedItemsSorted.length ? archivedItemsSorted.map((habit) => {
                  const groupedItems = getGroupedRepeatItems(habit, store.habits);
                  const cardChart = getCardChartConfig(habit, groupedItems, store.histories);
                  return (
                    <HabitCard
                      key={`archived-${habit.id}`}
                      layoutKey={`archived-${habit.id}`}
                      onMeasure={() => {}}
                      cardStyle={{ position: 'relative' }}
                      habit={{ ...habit, name: toTitleCase(habit.name), description: habit.description }}
                      history={store.histories[habit.id] || []}
                      chartHistory={cardChart.history}
                      chartRange={cardChart.range}
                      chartVisible={cardChart.showChart}
                      onIncrement={async (amount = 1) => store.addEntry(habit.id, amount)}
                      onDecrement={async () => store.addEntry(habit.id, -1)}
                      onEdit={() => setModal({ mode: 'edit', entityType: habit.habitType === 'goal' ? 'goal' : 'standard', habit })}
                      onArchive={() => store.archiveHabit(habit.id)}
                      onDelete={() => store.deleteHabit(habit.id)}
                      onPointerStart={() => {}}
                    />
                  );
                }) : <div className="muted-text">No archived habits or goals yet.</div>}
              </div>
            ) : null}
          </section>
        </main>
        <div className="haby-right-stack">

          <HabyInfoPanel />


          <RightPanel

            widgets={store.widgets}

            habits={store.habits}

            histories={store.histories}

            selectedCategory={selectedCategory}

            onAddWidget={store.addWidget}

            onDeleteWidget={store.deleteWidget}

            onReorderWidgets={store.reorderWidgets}

            onUpdateWidget={store.updateWidget}

          />

        </div>
      </div>

      {modal ? (
        <HabitModal
          mode={modal.mode}
          entityType={modal.entityType}
          initialHabit={modal.habit}
          categories={store.categories}
          onClose={() => setModal(null)}
          onArchive={modal.mode === 'edit' && modal.habit ? async () => {
            await store.archiveHabit(modal.habit!.id);
            setModal(null);
          } : undefined}
          onSave={async (payload) => {
            if (modal.mode === 'create') await store.createHabit(payload);
            else if (modal.habit) await store.updateHabit(modal.habit!.id, payload);
            setModal(null);
          }}
        />
      ) : null}

      {dashboardOpen ? (
        <DashboardSettingsModal
          title={store.settings.dashboardTitle || 'Haby Dashboard'}
          description={store.settings.dashboardDescription || 'Track habits, goals, charts, widgets, categories, and progress in one place.'}
          background={normalizeDashboardBackground(store.settings.dashboardBackground, theme)}
          opacity={String(store.settings.dashboardOpacity || '0.14')}
          mode={store.settings.dashboardBackgroundMode || 'center'}
          positionX={store.settings.dashboardBackgroundPositionX || '50'}
          positionY={store.settings.dashboardBackgroundPositionY || '50'}
          zoom={store.settings.dashboardBackgroundZoom || '100'}
          theme={theme}
          onClose={() => setDashboardOpen(false)}
          onSave={async ({ title, description, background: nextBackground, opacity, mode, positionX, positionY, zoom }) => {
            await Promise.all([
              store.saveSetting('dashboardTitle', title),
              store.saveSetting('dashboardDescription', description),
              store.saveSetting('dashboardBackground', normalizeDashboardBackground(nextBackground, theme)),
              store.saveSetting('dashboardOpacity', opacity),
              store.saveSetting('dashboardBackgroundMode', mode),
              store.saveSetting('dashboardBackgroundPositionX', positionX),
              store.saveSetting('dashboardBackgroundPositionY', positionY),
              store.saveSetting('dashboardBackgroundZoom', zoom),
            ]);
            setDashboardOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
