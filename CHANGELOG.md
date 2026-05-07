# Changelog

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
