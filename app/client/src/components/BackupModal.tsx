import { useState } from 'react';
import { createPortal } from 'react-dom';

type BackupMode = 'export' | 'import';

function buildLocalImportPreview(payload: any) {
  const habits = Array.isArray(payload?.habits) ? payload.habits : [];
  const settings = Array.isArray(payload?.settings) ? payload.settings : [];
  const widgets = Array.isArray(payload?.widgets) ? payload.widgets : [];

  return {
    habits: habits.filter((h: any) => Number(h.is_archived ?? h.isArchived ?? 0) !== 1 && String(h.habit_type || h.habitType || 'standard') !== 'goal').length,
    goals: habits.filter((h: any) => Number(h.is_archived ?? h.isArchived ?? 0) !== 1 && String(h.habit_type || h.habitType || 'standard') === 'goal').length,
    archived: habits.filter((h: any) => Number(h.is_archived ?? h.isArchived ?? 0) === 1).length,
    settings: settings.length,
    widgets: widgets.length,
  };
}

export default function BackupModal({
  onClose,
  onExport,
  onImportPreview,
  onImportConfirm,
}: {
  onClose: () => void;
  onExport: () => Promise<void>;
  onImportPreview: (file: File) => Promise<any>;
  onImportConfirm: (file: File) => Promise<void>;
}) {
  const [mode, setMode] = useState<BackupMode>('export');
  const [file, setFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const backupFileInputId = 'haby-backup-file-input';

  const exportSections = [
    {
      title: 'Core data',
      items: [
        'Categories',
        'Habits',
        'Goals',
        'Archived cards',
        'History entries',
      ],
    },
    {
      title: 'Layout and dashboard',
      items: [
        'Card positions',
        'Dashboard settings',
        'Dashboard banner size',
        'Theme and UI style',
      ],
    },
    {
      title: 'Widgets',
      items: [
        'Widgets',
        'Widget order',
        'Widget configuration',
      ],
    },
  ];

  async function handleExport() {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      await onExport();
      setMessage('Backup export started.');
    } catch (err: any) {
      setError(err?.message || 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImportPreview(nextFile: File | null) {
    setFile(nextFile);
    setImportPreview(null);
    setError('');
    setMessage('');

    if (!nextFile) return;

    setBusy(true);

    try {
      const payload = JSON.parse(await nextFile.text());
      const localPreview = buildLocalImportPreview(payload);

      setImportPreview(localPreview);

      try {
        await onImportPreview(nextFile);
      } catch {
        // Local preview is enough for the modal.
        // Backend validation still happens when Import backup is confirmed.
      }
    } catch (err: any) {
      setError(err?.message || 'Could not read backup file.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImportConfirm() {
    if (!file) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await onImportConfirm(file);
      setMessage('Backup import completed.');
    } catch (err: any) {
      setError(err?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop backup-modal-backdrop" onClick={onClose}>
      <div className="modal-card backup-modal" onClick={(event) => event.stopPropagation()}>
        <div className="row-between">
          <div>
            <div className="field-label">Haby backup</div>
            <h3 style={{ margin: 0 }}>Backup</h3>
          </div>

          <button type="button" className="ghost-btn small-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="backup-mode-row" role="group" aria-label="Backup mode">
          <button
            type="button"
            className={mode === 'export' ? 'active' : ''}
            onClick={() => {
              setMode('export');
              setError('');
              setMessage('');
            }}
          >
            Export
          </button>

          <button
            type="button"
            className={mode === 'import' ? 'active' : ''}
            onClick={() => {
              setMode('import');
              setError('');
              setMessage('');
            }}
          >
            Import
          </button>
        </div>

        {mode === 'export' ? (
          <div className="backup-preview-card">
            <div className="field-label">Export preview</div>
            <h4>Backup will include</h4>

            <div className="backup-preview-sections">
              {exportSections.map((section) => (
                <section key={section.title} className="backup-preview-section">
                  <h5>{section.title}</h5>

                  <ul className="backup-preview-list">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <button type="button" className="primary-btn" disabled={busy} onClick={handleExport}>
              {busy ? 'Exporting...' : 'Export backup'}
            </button>
          </div>
        ) : (
          <div className="backup-preview-card">
            <div className="field-label">Import preview</div>
            <h4>Select backup file</h4>

            <div className="backup-file-picker-row">
              <label className="ghost-btn small-btn backup-file-picker-btn" htmlFor={backupFileInputId}>
                Choose backup file
              </label>

              <span className="backup-file-name">
                {file?.name || 'No file selected'}
              </span>

              <input
                id={backupFileInputId}
                className="backup-file-input"
                type="file"
                accept="application/json,.json"
                onChange={(event) => void handleImportPreview(event.target.files?.[0] || null)}
              />
            </div>

            {importPreview ? (
              <div className="backup-import-preview">
                <div className="backup-preview-grid">
                  <span>Habits</span>
                  <strong>{importPreview.habits ?? 0}</strong>

                  <span>Goals</span>
                  <strong>{importPreview.goals ?? 0}</strong>

                  <span>Archived</span>
                  <strong>{importPreview.archived ?? 0}</strong>

                  <span>Settings</span>
                  <strong>{importPreview.settings ?? 0}</strong>

                  <span>Widgets</span>
                  <strong>{importPreview.widgets ?? 0}</strong>
                </div>

                <div className="note-box">
                  Import replaces current habits, goals, history, settings, and widgets with the selected backup data.
                </div>

                <button type="button" className="primary-btn" disabled={busy || !file} onClick={handleImportConfirm}>
                  {busy ? 'Importing...' : 'Import backup'}
                </button>
              </div>
            ) : (
              <div className="muted-text">Choose a Haby backup JSON file to see import preview.</div>
            )}
          </div>
        )}

        {message ? <div className="note-box">{message}</div> : null}
        {error ? <div className="error-box">{error}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
