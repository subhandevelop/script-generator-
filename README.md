# ⚡ ScriptForge AI — Viral Campaign Studio

Drop a topic. Get hooks, titles, and a shoot-ready script in seconds.

A premium, fully automated **viral campaign studio**. Paste an idea, pick a
platform, and ScriptForge drafts a complete campaign — 3 high-retention hooks,
3 viral titles, a scene-by-scene script with visual & audio directions, a
virality score, and ranking-ready description copy with 10 hashtags.

- **Frontend** — obsidian dark-mode SPA (glassmorphism, neon violet brand,
  sliding dashboard sidebar), optimized for Android WebView / APK conversion.
- **Backend** — secure Vercel serverless function that runs every engine call
  server-side, so your Secure Access Key never reaches the browser.
- **Smart-Core Failover** — if one engine stumbles, another steps in. Instantly.

---

## 📁 Directory structure

```
├── api/
│   └── generate.js       # Vercel serverless Node.js backend (Smart-Core router)
├── index.html            # Minimalist premium frontend UI
├── style.css             # Obsidian design system + sidebar + fold panel
├── app.js                # State, theming, sidebar, secure launching
└── README.md             # Setup and deployment documentation
```

---

## 🚀 Deploy to Vercel (2–3 minutes)

### Option A — GitHub import (recommended)

1. Push this folder to a GitHub repo (keep the structure exactly as shown above).
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Vercel auto-detects the `api/` folder. Keep all default build settings.
4. Add your Secure Access Key (see below), then click **Deploy**.

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel            # follow the prompts
vercel env add OPENROUTER_API_KEY   # paste your key
vercel --prod     # deploy to production
```

### 🔑 Secure Access Key (Vercel → Settings → Environment Variables)

The key is read **only** server-side in `api/generate.js`. Any of these names
work — set one and redeploy:

| Variable              | Required | Notes                                                            |
| --------------------- | -------- | ---------------------------------------------------------------- |
| `OPENROUTER_API_KEY`  | ✅ Yes   | Canonical name (recommended).                                    |
| `SECURE_ACCESS_KEY`   | Optional | Friendly alias — same value.                                     |
| `INTEGRATION_TOKEN`   | Optional | Friendly alias — same value.                                     |
| `APP_URL`             | Optional | Your deployed URL, sent as the referral source.                  |

> 🆓 Get a key at [openrouter.ai/keys](https://openrouter.ai/keys). Every engine
> in the Smart-Core chain is **free**, so campaigns cost `$0`.

---

## 🔐 Security architecture

```
Browser (app.js)  ──POST /api/generate──▶  Vercel Function (api/generate.js)
                                              │
                                              │  Bearer $SECURE_ACCESS_KEY
                                              ▼
                                         OpenRouter Engines
```

- `app.js` never holds or calls any key — it only posts the idea and options.
- The key is read at request time from `process.env.OPENROUTER_API_KEY` (with
  `SECURE_ACCESS_KEY` / `INTEGRATION_TOKEN` aliases), matching Vercel's
  dashboard environment variables 1:1.
- A `GET /api/generate` status call returns the Smart-Core chain (engines,
  key-connected flag, response window) **without ever exposing the secret** —
  it powers the in-app Creator Studio and Performance panels.
- All engine output is parsed and re-shaped server-side into a known-good JSON
  structure, then HTML-escaped again on the client to prevent XSS.
- CORS is enabled for browser clients; only `POST`, `GET`, and `OPTIONS` are
  allowed.

---

## ⚙️ Smart-Core Failover chain

| Role | Engine | Plan |
| --- | --- | --- |
| Lead | `nvidia/llama-3.1-nemotron-70b-instruct:free` | Free |
| Backup | `meta-llama/llama-3.1-8b-instruct:free` | Free |
| Backup | `google/gemma-2-9b-it:free` | Free |
| Dynamic | `openrouter/free` | Free |

Every launch tries the **Lead** engine first. If it returns an HTTP error (404,
401, 429, 5xx…), the request **silently** moves down the chain to the next
engine — the creator never sees an interruption. The final `openrouter/free`
entry is the dynamic default: it routes to whatever free engine OpenRouter has
live at that moment, so a discontinued node can never take the studio offline.

Only if *every* engine fails does the studio show a friendly note, with a
creator-friendly hint (invalid key, no credit, engines busy, etc.).

---

## 📡 Launch contract

**`GET /api/generate`** — studio status (no secrets):

```json
{
  "success": true,
  "service": "ScriptForge AI — Content Engine",
  "accessKeyConnected": true,
  "smartCore": true,
  "engines": [
    { "id": "nvidia/llama-3.1-nemotron-70b-instruct:free", "role": "lead" },
    { "id": "meta-llama/llama-3.1-8b-instruct:free", "role": "backup" },
    { "id": "google/gemma-2-9b-it:free", "role": "backup" },
    { "id": "openrouter/free", "role": "dynamic" }
  ],
  "responseWindowSeconds": 60
}
```

**`POST /api/generate`** — launch a campaign.

Request body:

```json
{
  "niche": "5-minute home workouts for busy moms",
  "language": "english",          // "english" | "hinglish" | "urdu"
  "tone": "High-Energy",
  "platform": "YouTube Shorts",
  "duration": "60 seconds"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "viralityScore": 93,
    "hooks": ["…", "…", "…"],
    "titles": ["…", "…", "…"],
    "script": [
      { "scene": 1, "duration": "0:00 - 0:03", "visual": "…", "audio": "…", "text_overlay": "…", "dialogue": "…" }
    ],
    "metadata": { "description": "…", "hashtags": ["#…", "…"] },
    "niche": "…", "language": "english", "tone": "…", "platform": "…", "duration": "…"
  },
  "engine": "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "usedBackup": false,
  "attempts": [{ "engine": "…", "status": 200 }],
  "generatedAt": "2026-08-17T00:00:00.000Z"
}
```

---

## ✨ Feature map

| Feature | Where |
| --- | --- |
| Neon violet gear + bolt inline SVG logo | `index.html` header / sidebar / footer |
| Platform brand palettes (TikTok, YouTube, Instagram, LinkedIn) | `app.js` → `PLATFORM_BRANDS` + `applyBrand()` |
| Glowing platform lamp + branded launch button | `#brandLamp`, `--brand-1/--brand-2` CSS vars |
| Single-focus input + one high-energy CTA | `.generator-card` |
| Collapsible fine-tune panel (language, platform, tone, length) | `#foldPanel` + `toggleFold()` |
| Sliding dashboard sidebar | `#sidebar`, `#burgerBtn` |
| History tab with live search | `#historySearch` + `renderHistory()` |
| Performance tab (campaigns, success, speed, storage) | `renderPerformance()` |
| Creator Studio tab (Smart-Core chain + key status) | `renderStudio()` via `GET /api/generate` |
| Smart-Core Failover (lead → backup → dynamic) | `api/generate.js` → `ROUTE` |
| Virality meter (animated SVG gauge + count-up) | `animateGauge()` |
| Multi-language (English / Hinglish / Urdu–Hindi) | `#languageToggle` + system prompt |
| Section copy + "Copy Full Campaign" + "Copied ✓" | `handleCopy()` |
| On-device history (view / reload / discard) | `localStorage` key `scriptforge.history.v1` |
| Local telemetry (campaigns, success, latency) | `localStorage` key `scriptforge.telemetry.v1` |
| Skeleton shimmer loading | `renderSkeleton()` |

---

## 🎨 Branding system

The canvas is **obsidian `#050507`** with a neon violet brand
(`#7C3AED → #A855F7 → #E879F9`). Selecting a platform live-swaps the accent:

| Platform | Palette |
| --- | --- |
| TikTok | Cyan `#00f2fe` → Magenta `#fe0979` |
| YouTube Shorts | Crimson `#FF0000` |
| Instagram Reels | Sunset `#f9ce34` → `#ee2a7b` |
| LinkedIn | Corporate Blue `#0077b5` |

The glowing lamp beside the platform selector, its focus ring, and the launch
button all adopt the selected platform's colors in real time.

---

## 📱 Android APK conversion (WebView)

Built mobile-first: no horizontal scroll, `viewport-fit=cover`, touch-optimized
inputs, `localStorage` history/telemetry, and a clipboard fallback via
`document.execCommand`.

**Recommended — Capacitor:**

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init "ScriptForge" "com.yourco.scriptforge" --web-dir ./
npx cap add android
npx cap sync
# open ./android with Android Studio → Build → APK
```

Point the app at your deployed Vercel URL (HTTPS is required for the Clipboard
API — `*.vercel.app` is already HTTPS). The history ledger and telemetry work
fully offline.

---

## 🛠 Local development

```bash
npx serve .                 # static files
# or
python3 -m http.server 8000
```

> Opening `index.html` directly renders the full UI, but launching requires the
> serverless function — use `vercel dev` to run it locally:

```bash
vercel dev        # serves the SPA and the /api/generate function on :3000
```

Without a deployed backend, the app offers a **"Load demo campaign"** button so
you can explore the full UI offline.

---

## 🧯 Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Your Secure Access Key isn't connected yet." | Add the key in Vercel → Settings → Environment Variables → redeploy. |
| "Every engine is busy right now." | Free engines are at capacity — wait a moment and launch again. |
| Launch times out | Upgrade the Vercel plan for longer function duration, or use a faster engine. |
| "Connection lost" in the browser | You opened the file as a static page — deploy to Vercel or run `vercel dev`. |

---

Built for creators. Your ideas deserve an audience. 🚀
