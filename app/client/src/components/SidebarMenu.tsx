import { useRef, useState } from 'react';
import type { Category, Habit } from '../store/useStore';

function toTitleCase(value: string) {
  return String(value || '').replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

export default function SidebarMenu(props: {
  panelClassName?: string;
  categories: Category[];
  habits: Habit[];
  goals: Habit[];
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  onCreateCategory: (name: string) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
  onCreateHabit: () => void;
  onCreateGoal: () => void;
  onDeleteHabit: (id: number) => Promise<void>;
  onDeleteGoal: (id: number) => Promise<void>;
  onExport: () => Promise<void>;
  onImportPreview: (file: File) => Promise<any>;
  onImportConfirm: (file: File) => Promise<void>;
  theme: string;
  setTheme: (next: string) => void;
}) {
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [open, setOpen] = useState({ category: false, habit: false, goal: false, transfer: false });

  return (
    <div className={`panel stack-gap sidebar-panel ${props.panelClassName || ''}`.trim()}>
      <div>
        <div className="field-label">Category Filter</div>
        <select className="select-input" value={props.selectedCategory} onChange={(e) => props.setSelectedCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {props.categories.map((category) => <option key={category.id} value={String(category.id)}>{toTitleCase(category.name)}</option>)}
        </select>
      </div>

      <div>
        <div className="field-label">Theme</div>
        <div className="tiny-toggle segmented-no-refresh">
          <span className={props.theme === 'light' ? 'active' : ''} onClick={() => props.setTheme('light')}>Light</span>
          <span className={props.theme === 'dark' ? 'active' : ''} onClick={() => props.setTheme('dark')}>Dark</span>
        </div>
      </div>

      <div className="panel-details">
        <button className="summary-btn" type="button" onClick={() => setOpen((prev) => ({ ...prev, category: !prev.category }))}>▾ Add/Remove Category</button>
        {open.category ? (
          <div className="stack-gap inner-pad">
            <button type="button" className="soft-btn" onClick={async () => { const name = window.prompt('Category Name'); if (name?.trim()) await props.onCreateCategory(name.trim()); }}>+ Add Category</button>
            {props.categories.map((category) => <div className="list-row" key={category.id}><span>{toTitleCase(category.name)}</span><button type="button" className="danger-btn small-btn" onClick={() => props.onDeleteCategory(category.id)}>Remove</button></div>)}
          </div>
        ) : null}
      </div>

      <div className="panel-details">
        <button className="summary-btn" type="button" onClick={() => setOpen((prev) => ({ ...prev, habit: !prev.habit }))}>▾ Add/Remove Habit</button>
        {open.habit ? (
          <div className="stack-gap inner-pad">
            <button type="button" className="soft-btn" onClick={props.onCreateHabit}>+ Add Habit</button>
            {props.habits.map((habit) => <div className="list-row" key={habit.id}><span>{toTitleCase(habit.name)}</span><button type="button" className="danger-btn small-btn" onClick={() => props.onDeleteHabit(habit.id)}>Remove</button></div>)}
          </div>
        ) : null}
      </div>

      <div className="panel-details">
        <button className="summary-btn" type="button" onClick={() => setOpen((prev) => ({ ...prev, goal: !prev.goal }))}>▾ Add/Remove Goal</button>
        {open.goal ? (
          <div className="stack-gap inner-pad">
            <button type="button" className="soft-btn" onClick={props.onCreateGoal}>+ Add Goal</button>
            {props.goals.map((goal) => <div className="list-row" key={goal.id}><span>{toTitleCase(goal.name)}</span><button type="button" className="danger-btn small-btn" onClick={() => props.onDeleteGoal(goal.id)}>Remove</button></div>)}
          </div>
        ) : null}
      </div>

      <div className="panel-details">
        <button className="summary-btn" type="button" onClick={() => setOpen((prev) => ({ ...prev, transfer: !prev.transfer }))}>▾ Export/Import</button>
        {open.transfer ? (
          <div className="stack-gap inner-pad">
            <button type="button" className="soft-btn" onClick={async () => { setImportError(''); await props.onExport(); }}>Export Backup</button>
            <button type="button" className="soft-btn" onClick={() => importFileRef.current?.click()}>Preview Import</button>
            <input
              ref={importFileRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setImportError('');
                  try {
                    const preview = await props.onImportPreview(file);
                    setImportPreview({ file, ...(preview.preview || {}) });
                  } catch (error: any) {
                    setImportError(error?.message || 'Preview import failed.');
                  }
                  e.currentTarget.value = '';
                }
              }}
            />
            {importError ? <div className="error-box">{importError}</div> : null}
            {importPreview ? (
              <div className="note-box">
                <div>Habits: {importPreview.habits}</div>
                <div>Goals: {importPreview.goals}</div>
                <div>Archived: {importPreview.archived}</div>
                <div className="inline-actions wrap-gap">
                  <button
                    type="button"
                    className="primary-btn small-btn"
                    disabled={importBusy}
                    onClick={async () => {
                      setImportBusy(true);
                      try {
                        setImportError('');
                        await props.onImportConfirm(importPreview.file);
                        setImportPreview(null);
                      } catch (error: any) {
                        setImportError(error?.message || 'Import failed.');
                      } finally {
                        setImportBusy(false);
                      }
                    }}
                  >
                    {importBusy ? 'Importing...' : 'Confirm Import'}
                  </button>
                  <button type="button" className="ghost-btn small-btn" onClick={() => setImportPreview(null)}>Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
