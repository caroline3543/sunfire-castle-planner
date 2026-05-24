# 🏰 Sunfire Castle Rally Planner

Alliance leader tool for Sunfire Castle battle planning. Built for State 3543.

## Deploy to Vercel (5 minutes)

### Option A — GitHub + Vercel (recommended, auto-deploys on update)

1. Create a free account at [github.com](https://github.com)
2. Create a new repository called `rally-planner` (set to Private if you prefer)
3. Upload this entire folder to the repository
4. Create a free account at [vercel.com](https://vercel.com)
5. Click **Add New Project** → Import your GitHub repo
6. Vercel auto-detects Vite. Click **Deploy**
7. Done — you'll get a URL like `rally-planner.vercel.app`

To update the app later: edit files in GitHub → Vercel redeploys automatically.

### Option B — Vercel CLI (fastest)

```bash
npm install -g vercel
cd rally-planner
npm install
vercel
```

Follow the prompts. Live in under 2 minutes.

### Option C — Drag and drop (no account needed temporarily)

```bash
npm install
npm run build
```

Drag the `dist/` folder to [vercel.com/new](https://vercel.com/new).

---

## Custom domain (optional)

1. In Vercel dashboard → your project → **Settings → Domains**
2. Add your domain e.g. `rally.state3543.com`
3. Point your DNS CNAME to `cname.vercel-dns.com`
4. HTTPS is automatic

---

## Local development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`

---

## Install as app on iPhone

1. Open your Vercel URL in Safari
2. Tap the Share button
3. Tap **Add to Home Screen**
4. Name it "Rally Planner" → Add

It will sit on your home screen like a native app and work offline.

---

Built for State 3543 · Whiteout Survival
