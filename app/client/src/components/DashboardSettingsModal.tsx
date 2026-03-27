import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export const defaultDashboardBackground = '/default-dashboard.svg';

export default function DashboardSettingsModal({ title, description, background, opacity, onClose, onSave }: {
  title: string;
  description: string;
  background: string;
  opacity: string;
  onClose: () => void;
  onSave: (payload: { title: string; description: string; background: string; opacity: string }) => Promise<void>;
}) {
  const normalizedBackground = background && background !== defaultDashboardBackground ? background : '';
  const [form, setForm] = useState({ title, description, background: normalizedBackground, opacity });
  const previewBackground = form.background.trim() || defaultDashboardBackground;
  const previewStyle = useMemo(() => ({
    backgroundImage: `linear-gradient(rgba(255,255,255,0.34), rgba(255,255,255,0.34)), url(${previewBackground})`,
  }), [previewBackground]);

  return createPortal(
    <div className="modal-backdrop dashboard-modal-backdrop" onClick={onClose}>
      <div className="modal-card dashboard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Customize dashboard</h3>
          <button type="button" className="ghost-btn small-btn" onClick={onClose}>Close</button>
        </div>
        <div className="dashboard-preview" style={previewStyle}>
          <div className="dashboard-preview-copy">
            <strong>{form.title || 'Haby Dashboard'}</strong>
            <span>{form.description || 'Track habits, goals, charts, widgets, categories, and progress in one place.'}</span>
          </div>
        </div>
        <label>Dashboard title<input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
        <label>Description<textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} /></label>
        <label>Background image URL<input placeholder="Paste image URL or leave empty to use the default image" value={form.background} onChange={(e) => setForm((prev) => ({ ...prev, background: e.target.value }))} /></label>
        <label>
          Overlay opacity: {Number(form.opacity || '0.14').toFixed(2)}
          <input type="range" min="0.05" max="0.9" step="0.01" value={form.opacity} onChange={(e) => setForm((prev) => ({ ...prev, opacity: e.target.value }))} />
        </label>
        <div className="inline-actions wrap-gap">
          <button type="button" className="soft-btn" onClick={() => setForm((prev) => ({ ...prev, background: '' }))}>Use default image</button>
          <button type="button" className="ghost-btn" onClick={() => setForm((prev) => ({ ...prev, background: '', title: 'Haby Dashboard', description: 'Track habits, goals, charts, widgets, categories, and progress in one place.', opacity: '0.14' }))}>Reset fields</button>
          <button type="button" className="primary-btn" onClick={async () => {
            await onSave({
              title: form.title.trim() || 'Haby Dashboard',
              description: form.description.trim(),
              background: form.background.trim() || defaultDashboardBackground,
              opacity: form.opacity || '0.14',
            });
          }}>Save dashboard</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
