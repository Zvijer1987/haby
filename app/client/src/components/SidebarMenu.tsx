import { useEffect, useRef, useState } from 'react';
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
}) {
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [open, setOpen] = useState({ category: false, habit: false, goal: false, transfer: false });

  const categoryDropdownRef = useRef<HTMLDivElement | null>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState('');

  const selectedCategoryName = props.selectedCategory === 'all'
    ? 'All Categories'
    : toTitleCase(props.categories.find((category) => String(category.id) === props.selectedCategory)?.name || 'All Categories');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!categoryDropdownRef.current?.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  return (
    <div className={`panel stack-gap sidebar-panel ${props.panelClassName || ''}`.trim()}>
      <div className="category-dropdown" ref={categoryDropdownRef}>
        <div className="field-label">Category Filter</div>

        <button
          type="button"
          className={`category-dropdown-trigger ${categoryDropdownOpen ? 'open' : ''}`}
          onClick={() => setCategoryDropdownOpen((value) => !value)}
          aria-haspopup="listbox"
          aria-expanded={categoryDropdownOpen}
        >
          <span>{selectedCategoryName}</span>
          <span className="category-dropdown-caret">▾</span>
        </button>

        {categoryDropdownOpen ? (
          <div className="category-dropdown-menu" role="listbox">
            <button
              type="button"
              className={`category-dropdown-option ${props.selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => {
                props.setSelectedCategory('all');
                setCategoryDropdownOpen(false);
              }}
            >
              All Categories
            </button>

            {props.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`category-dropdown-option ${String(category.id) === props.selectedCategory ? 'active' : ''}`}
                onClick={() => {
                  props.setSelectedCategory(String(category.id));
                  setCategoryDropdownOpen(false);
                }}
              >
                {toTitleCase(category.name)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel-details">
        <button className="summary-btn" type="button" onClick={() => setOpen((prev) => ({ ...prev, category: !prev.category }))}>
          ▾ Add/Remove Category
        </button>
        {open.category ? (
          <div className="stack-gap inner-pad">
            <div className="category-create-anchor">
              <button
                type="button"
                className="soft-btn"
                onClick={() => {
                  setCategoryName('');
                  setCategoryError('');
                  setCategoryCreateOpen((value) => !value);
                }}
              >
                + Add Category
              </button>

              {categoryCreateOpen ? (
                <form
                  className="category-create-popover"
                  onSubmit={async (event) => {
                    event.preventDefault();

                    const cleanName = categoryName.trim();

                    if (!cleanName) {
                      setCategoryError('Category name is required.');
                      return;
                    }

                    setCategorySaving(true);

                    try {
                      setCategoryError('');
                      await props.onCreateCategory(cleanName);
                      setCategoryName('');
                      setCategoryCreateOpen(false);
                    } catch (error: any) {
                      setCategoryError(error?.message || 'Could not create category.');
                    } finally {
                      setCategorySaving(false);
                    }
                  }}
                >
                  <div className="row-between">
                    <div>
                      <div className="field-label">Category</div>
                      <h3 style={{ margin: 0 }}>Add Category</h3>
                    </div>

                    <button
                      type="button"
                      className="ghost-btn small-btn"
                      disabled={categorySaving}
                      onClick={() => setCategoryCreateOpen(false)}
                    >
                      Close
                    </button>
                  </div>

                  <label>
                    Category name
                    <input
                      autoFocus
                      value={categoryName}
                      placeholder="Example: Health"
                      onChange={(event) => setCategoryName(event.target.value)}
                    />
                  </label>

                  {categoryError ? <div className="error-box">{categoryError}</div> : null}

                  <div className="inline-actions modal-submit-row category-create-actions">
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={categorySaving}
                      onClick={() => setCategoryCreateOpen(false)}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="primary-btn category-create-submit"
                      disabled={categorySaving || !categoryName.trim()}
                    >
                      {categorySaving ? 'Saving...' : 'Create Category'}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
            {props.categories.map((category) => (
              <div className="list-row" key={category.id}>
                <span>{toTitleCase(category.name)}</span>
                <button type="button" className="danger-btn small-btn" onClick={() => props.onDeleteCategory(category.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel-details">
        <button className="summary-btn" type="button" onClick={() => setOpen((prev) => ({ ...prev, habit: !prev.habit }))}>
          ▾ Add/Remove Habit
        </button>
        {open.habit ? (
          <div className="stack-gap inner-pad">
            <button type="button" className="soft-btn" onClick={props.onCreateHabit}>
              + Add Habit
            </button>
            {props.habits.map((habit) => (
              <div className="list-row" key={habit.id}>
                <span>{toTitleCase(habit.name)}</span>
                <button type="button" className="danger-btn small-btn" onClick={() => props.onDeleteHabit(habit.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel-details">
        <button className="summary-btn" type="button" onClick={() => setOpen((prev) => ({ ...prev, goal: !prev.goal }))}>
          ▾ Add/Remove Goal
        </button>
        {open.goal ? (
          <div className="stack-gap inner-pad">
            <button type="button" className="soft-btn" onClick={props.onCreateGoal}>
              + Add Goal
            </button>
            {props.goals.map((goal) => (
              <div className="list-row" key={goal.id}>
                <span>{toTitleCase(goal.name)}</span>
                <button type="button" className="danger-btn small-btn" onClick={() => props.onDeleteGoal(goal.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel-details legacy-export-import-panel">
        <button className="summary-btn" type="button" onClick={() => setOpen((prev) => ({ ...prev, transfer: !prev.transfer }))}>
          ▾ Backup
        </button>
        {open.transfer ? (
          <div className="stack-gap inner-pad">
            <button
              type="button"
              className="soft-btn"
              onClick={async () => {
                setImportError('');
                await props.onExport();
              }}
            >
              Export Backup
            </button>

            <button type="button" className="soft-btn" onClick={() => importFileRef.current?.click()}>
              Preview Import
            </button>

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

                  <button type="button" className="ghost-btn small-btn" onClick={() => setImportPreview(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

    </div>
  );
}
