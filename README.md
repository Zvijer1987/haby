<p align="center">
  <img src="docs/screenshots/haby-icon-48.png" width="48" height="48" alt="Haby icon" />
</p>

# Haby

Haby is a self-hosted habit and goal tracker built for private, homelab-friendly deployments. It combines daily habits, progress goals, lightweight widgets, and a clean dashboard into a single containerized app.

![Haby light theme](docs/screenshots/light-theme.png)
![Haby dark theme](docs/screenshots/dark-theme.png)

## Features

- Multi-user authentication with an admin-managed user list
- Default first-run account with forced password change
- Separate habit and goal cards
- Optional mini calendar and mini chart on each card
- Line, column, and pie card charts
- Right-side widgets for overall history, today list, and calendar views
- Card archiving and archived section support
- Import preview before full import
- Local SQLite persistence in a single `/data` volume
- Docker-first deployment with a production example compose file

## First-run account

The initial first-run account is:

- **Username:** `Haby`
- **Password:** `Haby`

You are prompted to change the password after the first login.

## Demo layout on first run

Haby seeds a curated default dashboard for first-time use and for new users:

Habit cards

- 5 active habit cards.
- Mixed card layouts with mini calendars, compact cards, repeatable cards, and different visual styles.
- Charts are widget-only, so habit cards stay focused on daily tracking.

Goal cards

- 4 active goal cards.
- Goal examples include steps, distance, sleep, and reading progress.
- Goal cards use progress bars, units, mini calendars, and compact layouts.

Archive

- 2 archived sample cards.
- The archive section is visible immediately on first run.

Widgets

- Calendar
- Today List
- Overall History
- Goal/card chart widget example

## Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Express + TypeScript
- **Database:** SQLite
- **Container:** Multi-stage Docker build

## Repository structure

```text
.
├── app/
│   ├── client/              # React frontend
│   └── server/              # Express backend
├── compose.yaml.example     # Example Docker Compose file
├── Dockerfile               # Production multi-stage image
├── .env.example             # Optional runtime environment example
├── SECURITY.md              # Security policy and hardening notes
└── docs/
    └── screenshots/         # README screenshots
```

## Local development

```bash
npm install --prefix app
npm install --prefix app/client
npm install --prefix app/server
npm run dev --prefix app/server
npm run dev --prefix app/client
```

## Docker image

Pull the latest image from Docker Hub:

```bash
docker pull zvijer1987/haby:latest
```

## Docker Compose

A commented production example is included in [`compose.yaml.example`](compose.yaml.example).

Quick start:

```bash
cp compose.yaml.example compose.yaml
mkdir -p data
docker compose up -d
```

## Runtime data

Haby stores persistent runtime data in `/data` inside the container. The mounted directory contains:

- the SQLite database
- uploaded profile pictures
- user settings and persisted application state

## Import and export

- Export downloads a dated JSON backup file
- Import runs a preview first
- Import can restore habits, goals, archived cards, entries, categories, and settings

## Security notes

- Change the default password immediately after the first login
- Do not expose Haby directly to the public internet without an authenticated reverse proxy
- Run behind HTTPS when used outside a trusted LAN
- Keep the `/data` volume private and backed up
- Review [`SECURITY.md`](SECURITY.md) before publishing or opening access

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for repository conventions and contribution notes.

## Update notes - v1.1.0
### Runtime user change

The container now runs as the standard Node.js user:

- UID: 1000
- GID: 1000

This is better for most self-hosted bind mount setups where the mounted data folder is owned by the normal host user.

Existing users who update from an older image may need to fix ownership of their mounted /data folder if they see this SQLite error:

SqliteError: attempt to write a readonly database

For bind-mounted data folders, run:

    sudo docker stop haby
    sudo chown -R 1000:1000 /path/to/haby/data
    sudo chmod -R u+rwX,g+rwX /path/to/haby/data
    sudo docker start haby

Example for a local ./data folder:

    sudo docker stop haby
    sudo chown -R 1000:1000 ./data
    sudo chmod -R u+rwX,g+rwX ./data
    sudo docker start haby

New installations using a normal user-owned bind mount should work without extra permission changes.
