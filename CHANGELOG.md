# Changelog


## v1.2.0

### Default first-run experience

- Replaced the old demo seed with a full default dashboard seed based on a real Haby setup.
- New first-time users now start with a complete dashboard layout instead of a minimal demo.
- Added a `defaultSeedApplied` marker so future updates do not reseed or overwrite existing user data.

### Backup and import

- Moved Export/Import into a dedicated Backup modal under the Control Panel.
- Added separate Export and Import views with preview information.
- Backup now includes widgets, widget order, widget configuration, dashboard settings, card positions, and banner size.
- Import now restores widgets and remaps card layout positions to newly imported habit and goal IDs.

### Dashboard and layout

- Added resizable dashboard banner height.
- Active Habits, Active Goals, and Archived sections now follow the resized banner layout.

### Widgets

- Habit and goal charts are now widget-only.
- Removed chart rendering from Habit and Goal cards.
- Remove Widgets still allows removing existing widgets, including widgets that were created before their source card was archived.
- Improved widget panel styling and hover behavior across modern and classic themes.

### Cards and modals

- Removed Show chart and Chart type controls from Add Habit, Add Goal, and Edit modals.
- Improved card minimum sizing so card action buttons fit in one row.
- Changed Goal card Save button styling to match Edit and Archive card actions.
- Account settings now opens with only the Profile section expanded by default.

### UI polish

- Added the new Modern theme.
- Improved classic theme borders for Info and Widgets panels.
- Refined modern and classic hover behavior for right-side panel controls.
- Updated default profile/icon assets.


## v1.1.1

### Fixed

- Fixed deleting repeatable habits and goals.
- Deleting a repeatable card now deletes the whole repeat group.
- Archived repeatable cards from the same group no longer recreate the deleted active card.

## v1.1.0

### Added

- Added more icons to the habit and goal icon picker.
- Icon picker now shows 5 rows of icons.

### Changed

- Repeatable habits and goals now use period-based names:
  - Daily: Habit name (Day 1), Habit name (Day 2), ...
  - Weekly: Habit name (Week 1), Habit name (Week 2), ...
  - Monthly: Habit name (Month 1), Habit name (Month 2), ...
- Repeatable cards now automatically archive the previous card from the same repeat group.
- Only the newest card from a repeat group remains active on the dashboard.
- Container runtime user changed from UID/GID 999 to the standard Node.js UID/GID 1000.

### Upgrade notes

Existing users updating from an older image may need to fix ownership of their mounted /data folder.

If you see:

    SqliteError: attempt to write a readonly database

Run:

    sudo docker stop haby
    sudo chown -R 1000:1000 /path/to/haby/data
    sudo chmod -R u+rwX,g+rwX /path/to/haby/data
    sudo docker start haby

This does not delete data. It only fixes ownership for the SQLite database and runtime files.
