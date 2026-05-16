import { useState } from 'react';
import { createPortal } from 'react-dom';

const HABY_VERSION = '1.2.0';

const CHANGELOG_ITEMS = [
  {
    version: 'v1.2.0',
    label: 'Current version',
    sections: [
      {
        title: 'Default first-run experience',
        items: [
          'Replaced the old demo seed with a full default dashboard seed based on a real Haby setup.',
          'New first-time users now start with a complete dashboard layout instead of a minimal demo.',
          'Added a defaultSeedApplied marker so future updates do not reseed or overwrite existing user data.',
        ],
      },
      {
        title: 'Backup and import',
        items: [
          'Moved Export/Import into a dedicated Backup modal under the Control Panel.',
          'Added separate Export and Import views with preview information.',
          'Backup now includes widgets, widget order, widget configuration, dashboard settings, card positions, and banner size.',
          'Import now restores widgets and remaps card layout positions to newly imported habit and goal IDs.',
        ],
      },
      {
        title: 'Dashboard and layout',
        items: [
          'Added resizable dashboard banner height.',
          'Active Habits, Active Goals, and Archived sections now follow the resized banner layout.',
        ],
      },
      {
        title: 'Widgets',
        items: [
          'Habit and goal charts are now widget-only.',
          'Removed chart rendering from Habit and Goal cards.',
          'Remove Widgets still allows removing existing widgets, including widgets that were created before their source card was archived.',
          'Improved widget panel styling and hover behavior across modern and classic themes.',
        ],
      },
      {
        title: 'Cards and modals',
        items: [
          'Removed Show chart and Chart type controls from Add Habit, Add Goal, and Edit modals.',
          'Improved card minimum sizing so card action buttons fit in one row.',
          'Changed Goal card Save button styling to match Edit and Archive card actions.',
          'Account settings now opens with only the Profile section expanded by default.',
        ],
      },
      {
        title: 'UI polish',
        items: [
          'Added the new Modern theme.',
          'Improved classic theme borders for Info and Widgets panels.',
          'Refined modern and classic hover behavior for right-side panel controls.',
          'Updated default profile/icon assets.',
        ],
      },
    ],
  },
  {
    version: 'v1.1.1',
    label: 'Previous version',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Fixed deleting repeatable habits and goals.',
          'Deleting a repeatable card now deletes the whole repeat group.',
          'Archived repeatable cards from the same group no longer recreate the deleted active card.',
        ],
      },
    ],
  },
  {
    version: 'v1.1.0',
    label: 'Previous version',
    sections: [
      {
        title: 'Added',
        items: [
          'Added more icons to the habit and goal icon picker.',
          'Icon picker now shows 5 rows of icons.',
        ],
      },
      {
        title: 'Changed',
        items: [
          'Repeatable habits and goals now use period-based names.',
          'Repeatable cards now automatically archive the previous card from the same repeat group.',
          'Only the newest card from a repeat group remains active on the dashboard.',
          'Container runtime user changed from UID/GID 999 to the standard Node.js UID/GID 1000.',
        ],
      },
      {
        title: 'Upgrade notes',
        items: [
          'Existing users updating from an older image may need to fix ownership of their mounted /data folder if SQLite reports a readonly database.',
        ],
      },
    ],
  },
];

function GitHubIcon() {
  return (
    <svg className="haby-info-svg-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.75C6.9 2.75 2.75 6.9 2.75 12c0 4.08 2.65 7.54 6.33 8.77.46.08.63-.2.63-.44v-1.57c-2.57.56-3.11-1.1-3.11-1.1-.42-1.08-1.03-1.37-1.03-1.37-.84-.57.06-.56.06-.56.93.07 1.42.96 1.42.96.83 1.41 2.17 1 2.7.77.08-.6.32-1 .58-1.23-2.05-.23-4.21-1.03-4.21-4.58 0-1.01.36-1.84.95-2.49-.1-.23-.41-1.17.09-2.45 0 0 .78-.25 2.55.95A8.84 8.84 0 0 1 12 7.35c.79 0 1.58.11 2.32.31 1.77-1.2 2.55-.95 2.55-.95.5 1.28.19 2.22.09 2.45.59.65.95 1.48.95 2.49 0 3.56-2.16 4.35-4.22 4.58.33.29.63.86.63 1.73v2.57c0 .24.17.53.64.44A9.26 9.26 0 0 0 21.25 12c0-5.1-4.15-9.25-9.25-9.25Z" />
    </svg>
  );
}

function ChecklistPaperIcon() {
  return (
    <svg className="haby-info-svg-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5H16.2L20 7.3V19.5C20 20.05 19.55 20.5 19 20.5H5C4.45 20.5 4 20.05 4 19.5V4.5C4 3.95 4.45 3.5 5 3.5H7Z" />
      <path d="M16.2 3.5V7.3H20" />
      <path d="M7.2 10.3L8.35 11.45L10.55 8.85" />
      <path d="M12.5 10.2H16.7" />
      <path d="M7.2 15.4L8.35 16.55L10.55 13.95" />
      <path d="M12.5 15.3H16.7" />
    </svg>
  );
}

export default function HabyInfoPanel() {
  const [changesOpen, setChangesOpen] = useState(false);

  function openGitHubLink() {
    window.open(
      'https://github.com/Zvijer1987/haby',
      '_blank',
      'noopener,noreferrer',
    );
  }

  function openDonationLink() {
    window.open(
      'https://paypal.me/vladimir1987ri?locale.x=en_US&country.x=HR',
      '_blank',
      'noopener,noreferrer',
    );
  }

  return (
    <>
      <div className="haby-info-panel panel stack-gap sidebar-panel right-ghost-panel">
        <h3 className="haby-info-title">Info</h3>

        <div className="haby-info-actions">
          <button
            type="button"
            className="summary-btn haby-info-row"
            onClick={() => setChangesOpen(true)}
          >
            <ChecklistPaperIcon />
            <span>Changelog</span>
          </button>

                      <button
              type="button"
              className="summary-btn haby-info-row"
              onClick={openGitHubLink}
            >
              <GitHubIcon />
              <span>Visit github.com</span>
            </button>

<button
            type="button"
            className="summary-btn haby-info-row"
            onClick={openDonationLink}
          >
            <span className="haby-coffee-icon" aria-hidden="true">☕</span>
            <span>Buy me a coffe</span>
          </button>
        </div>

        <div className="haby-version-copy">Version 1.2.0</div>
      </div>

      {changesOpen
        ? createPortal(
            <div className="modal-backdrop haby-changes-backdrop" onClick={() => setChangesOpen(false)}>
              <div className="modal-card haby-changes-modal" onClick={(event) => event.stopPropagation()}>
                <div className="row-between haby-changes-head">
                  <div>
                    <div className="field-label">Haby changelog</div>
                    <h3>What&apos;s new</h3>
                  </div>

                  <button type="button" className="ghost-btn small-btn" onClick={() => setChangesOpen(false)}>
                    Close
                  </button>
                </div>

                <div className="haby-changelog-list">
                  {CHANGELOG_ITEMS.map((release) => (
                    <section key={release.version} className="haby-release-card">
                      <div className="haby-release-title-row">
                        <h4>{release.version}</h4>
                        <span>{release.label}</span>
                      </div>

                      {release.sections.map((section) => (
                        <div key={`${release.version}-${section.title}`} className="haby-release-section">
                          <h5>{section.title}</h5>
                          <ul>
                            {section.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
