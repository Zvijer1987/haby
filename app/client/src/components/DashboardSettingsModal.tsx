import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const defaultDashboardBackground = '/haby-dashboard-light-v5.png';
export const defaultDashboardBackgroundDark = '/haby-dashboard-dark-v5.png';

type DashboardBackgroundMode = 'center' | 'stretch' | 'align';

function getDefaultBackground(theme: string) {
  return theme === 'dark' ? defaultDashboardBackgroundDark : defaultDashboardBackground;
}

function backgroundSizeForMode(mode: DashboardBackgroundMode, zoom: string) {
  if (mode === 'stretch') return '100% 100%';
  if (mode === 'align') return `${Math.min(200, Math.max(50, Number(zoom || '100')))}% auto`;
  return 'cover';
}

function backgroundPositionForMode(mode: DashboardBackgroundMode, x: string, y: string) {
  if (mode === 'align') return `${Number(x || '50')}% ${Number(y || '50')}%`;
  return 'center center';
}

export default function DashboardSettingsModal({
  title,
  description,
  background,
  opacity,
  mode,
  positionX,
  positionY,
  zoom,
  theme,
  onClose,
  onSave,
}: {
  title: string;
  description: string;
  background: string;
  opacity: string;
  mode: string;
  positionX: string;
  positionY: string;
  zoom: string;
  theme: string;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    description: string;
    background: string;
    opacity: string;
    mode: string;
    positionX: string;
    positionY: string;
    zoom: string;
  }) => Promise<void>;
}) {
  const defaultBackground = getDefaultBackground(theme);
  const normalizedBackground = background || defaultBackground;

  const [form, setForm] = useState({
    title,
    description,
    background: normalizedBackground,
    opacity,
    mode: (mode || 'center') as DashboardBackgroundMode,
    positionX: positionX || '50',
    positionY: positionY || '50',
    zoom: zoom || '100',
  });

  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const previewBackground = form.background.trim() || defaultBackground;

  const previewStyle = useMemo(() => {
    const overlay = theme === 'dark'
      ? `linear-gradient(rgba(5,11,23,${Number(form.opacity || '0.14')}), rgba(5,11,23,${Number(form.opacity || '0.14')}))`
      : `linear-gradient(rgba(255,255,255,${Number(form.opacity || '0.14')}), rgba(255,255,255,${Number(form.opacity || '0.14')}))`;

    return {
      backgroundImage: `${overlay}, url(${previewBackground})`,
      backgroundSize: backgroundSizeForMode(form.mode, form.zoom),
      backgroundPosition: backgroundPositionForMode(form.mode, form.positionX, form.positionY),
      backgroundRepeat: 'no-repeat',
    };
  }, [previewBackground, form.mode, form.positionX, form.positionY, form.zoom, form.opacity, theme]);

  function updateMode(nextMode: DashboardBackgroundMode) {
    setForm((prev) => ({
      ...prev,
      mode: nextMode,
      positionX: nextMode === 'align' ? prev.positionX : '50',
      positionY: nextMode === 'align' ? prev.positionY : '50',
      zoom: nextMode === 'align' ? prev.zoom : '100',
    }));
  }

  function handleUploadImage(file: File | null) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';

      if (!result) return;

      setForm((prev) => ({
        ...prev,
        background: result,
        mode: 'center',
        positionX: '50',
        positionY: '50',
        zoom: '100',
      }));
    };

    reader.readAsDataURL(file);
  }

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

        <label>
          Dashboard title
          <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
        </label>

        <label>
          Description
          <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
        </label>

        <label>
          Background image URL
          <input
            placeholder={`Paste image URL or path, for example ${defaultBackground}`}
            value={form.background}
            onChange={(e) => setForm((prev) => ({ ...prev, background: e.target.value }))}
          />
        </label>

        <div className="dashboard-background-mode-row">
          <div>
            <div className="field-label">Display mode</div>
            <div className="dashboard-mode-toggle" role="group" aria-label="Dashboard background display mode">
              <button
                type="button"
                className={form.mode === 'center' ? 'active' : ''}
                onClick={() => updateMode('center')}
              >
                Center
              </button>

              <button
                type="button"
                className={form.mode === 'stretch' ? 'active' : ''}
                onClick={() => updateMode('stretch')}
              >
                Stretch
              </button>

              <button
                type="button"
                className={form.mode === 'align' ? 'active' : ''}
                onClick={() => updateMode('align')}
              >
                Align
              </button>
            </div>
          </div>
        </div>

        {form.mode === 'align' ? (
          <div className="dashboard-align-grid">
            <label>
              Position X: {form.positionX}%
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={form.positionX}
                onChange={(e) => setForm((prev) => ({ ...prev, positionX: e.target.value }))}
              />
            </label>

            <label>
              Position Y: {form.positionY}%
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={form.positionY}
                onChange={(e) => setForm((prev) => ({ ...prev, positionY: e.target.value }))}
              />
            </label>

            <label>
              Zoom: {form.zoom}%
              <input
                type="range"
                min="50"
                max="200"
                step="1"
                value={form.zoom}
                onChange={(e) => setForm((prev) => ({ ...prev, zoom: e.target.value }))}
              />
            </label>
          </div>
        ) : null}

        <label>
          Overlay opacity: {Number(form.opacity || '0.14').toFixed(2)}
          <input
            type="range"
            min="0.05"
            max="0.9"
            step="0.01"
            value={form.opacity}
            onChange={(e) => setForm((prev) => ({ ...prev, opacity: e.target.value }))}
          />
        </label>

        <div className="inline-actions wrap-gap">
          <button
            type="button"
            className="soft-btn"
            onClick={() => setForm((prev) => ({
              ...prev,
              background: defaultBackground,
              mode: 'center',
              positionX: '50',
              positionY: '50',
              zoom: '100',
            }))}
          >
            Use default image
          </button>

          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(event) => {
              handleUploadImage(event.target.files?.[0] || null);
              event.target.value = '';
            }}
          />

          <button
            type="button"
            className="soft-btn"
            onClick={() => uploadInputRef.current?.click()}
          >
            Upload image
          </button>

          <button
            type="button"
            className="ghost-btn"
            onClick={() => setForm({
              title: 'Haby Dashboard',
              description: 'Track habits, goals, charts, widgets, categories, and progress in one place.',
              background: defaultBackground,
              opacity: '0.14',
              mode: 'center',
              positionX: '50',
              positionY: '50',
              zoom: '100',
            })}
          >
            Reset fields
          </button>

          <button
            type="button"
            className="primary-btn"
            onClick={async () => {
              await onSave({
                title: form.title.trim() || 'Haby Dashboard',
                description: form.description.trim(),
                background: form.background.trim() || defaultBackground,
                opacity: form.opacity || '0.14',
                mode: form.mode || 'center',
                positionX: form.positionX || '50',
                positionY: form.positionY || '50',
                zoom: form.zoom || '100',
              });
            }}
          >
            Save dashboard
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
