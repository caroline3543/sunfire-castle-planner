# 🏰 WOS Alliance Manager

Player database and event management tool for Whiteout Survival alliances. Built for State 3543.

## What's included

- **Player database** — WOS FID lookup, full profile fields, battle stats
- **WOS profile lookup** — unofficial, optional, all data manually editable
- **Export / Import** — full JSON export with version tracking
- **Seed data** — paste an export into `/src/data/defaultData.json` to hardcode your roster
- **PWA** — installable on iPhone and Android, works offline

## Data architecture

```
/src/data/defaultData.json   ← hardcoded seed data (commit this with your roster)
localStorage                 ← live app state, auto-saved on every change
Export JSON                  ← download snapshot, paste into defaultData.json to persist
```

### Version migration

All exports include a `_version` field. The `dataManager.js` `migrateIfNeeded()` function
handles schema upgrades — add cases there as the data model evolves.

### Export schema

```json
{
  "_version": "1.0.0",
  "_exported": "2024-01-15T10:30:00.000Z",
  "settings": { "allianceName": "", "allianceTag": "", "stateId": "3543" },
  "players": [...],
  "events": [],
  "schedules": [],
  "svs": { "seasons": [] },
  "notes": [],
  "lastUpdated": "2024-01-15T10:30:00.000Z"
}
```

## Deploy to Vercel

```bash
# Option A — drag and drop
npm install && npm run build
# Drag dist/ to vercel.com/new

# Option B — CLI
npm install -g vercel
vercel

# Option C — GitHub auto-deploy
# Push to GitHub, import repo in Vercel dashboard
```

**Root Directory:** leave blank (files are at repo root)

## Local development

```bash
npm install
npm run dev
# → http://localhost:5173
```

## Install as iPhone app

1. Open your Vercel URL in Safari
2. Share → Add to Home Screen
3. Done — works offline, no app store needed

---

Built for State 3543 · Whiteout Survival
