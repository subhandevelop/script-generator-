# ⚡ ScriptForge AI — Viral Content Script Generator

A premium, fully automated **Content Script Generator SaaS** web app. Paste a
niche, pick a platform, and get a complete, ready-to-shoot campaign — 3
high-retention hooks, 3 viral titles, a scene-by-scene script with visual/audio
directions, a virality score, and high-ranking SEO metadata with 10 hashtags.

- **Frontend** — luxury cosmic-midnight SPA (glassmorphism, neon violet brand,
  sliding dashboard sidebar), optimized for Android WebView / APK conversion.
- **Backend** — secure Vercel serverless function that proxies OpenRouter so the
  API key never reaches the browser.
- **Model grid** — active 2026 free models with automatic failover.

---

## 📁 Directory structure

```
├── api/
│   └── generate.js       # Vercel serverless Node.js backend (OpenRouter proxy)
├── index.html            # Luxury responsive frontend UI
├── style.css             # Cosmic-midnight design system + sidebar
├── app.js                # State, theming, sidebar, secure API fetching
└── README.md             # Setup and deployment documentation
```

---

## 🚀 Deploy to Vercel (2–3 minutes)

### Option A — GitHub import (recommended)

1. Push this folder to a GitHub repo (keep the structure exactly as shown above).
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Vercel auto-detects the `api/` folder. Keep all default build settings.
4. Add the secret env var (see below), then click **Deploy**.

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel            # follow the prompts
vercel env add OPENROUTER_API_KEY   # paste your key
vercel --prod     # deploy to production
```

### 🔑 Environment variables (Vercel Dashboard → Settings → Environment Variables)

| Variable              | Required | Description                                                              |
| --------------------- | -------- | ------------------------------------------------------------------------ |
| `OPENROUTER_API_KEY`  | ✅ Yes   | Your OpenRouter API key. Used **only** server-side in `api/generate.js`. |
| `APP_URL`             | Optional | Your deployed URL, sent as `HTTP-Referer` for OpenRouter's leaderboard.  |

After adding a variable, **redeploy** so the function picks it up.

> 🆓 Get a key at [openrouter.ai/keys](https://openrouter.ai/keys). The three
> configured models are **free**, so generations cost `$0`.

---

## 🔐 Security architecture

```
Browser (app.js)  ──POST /api/generate──▶  Vercel Function (api/generate.js)
                                              │
                                              │  Bearer $OPENROUTER_API_KEY
                                              ▼
                                         OpenRouter API
```

- `app.js` never holds or calls any API key — it only posts the niche and
  options to `/api/generate`.
- The key is read from `process.env.OPENROUTER_API_KEY` at request time, which
  maps 1:1 to the Vercel Dashboard environment variables.
- A `GET /api/generate` status call returns the routing profile (model grid,
  key-configured flag, max duration) **without ever exposing the secret** — it
  powers the in-app "API Gateway Profiles" and "System Performance" panels.
- All model output is parsed and re-shaped server-side into a known-good JSON
  structure, then HTML-escaped again on the client to prevent XSS.
- CORS is enabled for browser clients; only `POST`, `GET`, and `OPTIONS` are
  allowed.

---

## 🤖 Active model grid (2026)

Routing lives in `api/generate.js`:

| Role | Model | Plan |
| --- | --- | --- |
| Primary | `nvidia/llama-3.1-nemotron-70b-instruct:free` | Free |
| Failover 1 | `meta-llama/llama-3.1-8b-instruct:free` | Free |
| Failover 2 | `google/gemma-2-9b-it:free` | Free |

Requests try the primary first, then cascade down the failover array. Every
attempt is logged; if all nodes fail, the response includes a descriptive
message and a targeted hint (401 invalid key, 402 no credits, 404 discontinued
node, 429 free-tier global rate limit, 408/504 timeout, 5xx upstream).

---

## 📡 API contract

**`GET /api/generate`** — gateway status (no secrets):

```json
{
  "success": true,
  "service": "ScriptForge AI — OpenRouter Gateway",
  "keyConfigured": true,
  "models": [
    { "id": "nvidia/llama-3.1-nemotron-70b-instruct:free", "role": "primary" },
    { "id": "meta-llama/llama-3.1-8b-instruct:free", "role": "failover" },
    { "id": "google/gemma-2-9b-it:free", "role": "failover" }
  ],
  "maxDurationSeconds": 60
}
```

**`POST /api/generate`** — generation.

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
  "model": "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "usedFallback": false,
  "attempts": [{ "model": "…", "status": 200 }],
  "generatedAt": "2026-08-17T00:00:00.000Z"
}
```

---

## ✨ Feature map

| Feature | Where |
| --- | --- |
| Neon violet gear + bolt inline SVG logo | `index.html` header / sidebar / footer |
| Platform brand palettes (TikTok, YouTube, Instagram, LinkedIn) | `app.js` → `PLATFORM_BRANDS` + `applyBrand()` |
| Glowing platform indicator lamp + branded generate button | `#brandLamp`, `--brand-1/--brand-2` CSS vars |
| Sliding dashboard sidebar (burger → panel) | `#sidebar`, `#burgerBtn` in `app.js` |
| History tab with live search | `#historySearch` + `renderHistory()` |
| System Performance tab (live client + server metrics) | `renderPerformance()` |
| API Gateway Profiles tab (model grid + key status) | `renderProfiles()` via `GET /api/generate` |
| Virality meter (animated SVG gauge + count-up) | `animateGauge()` |
| Multi-language (English / Hinglish / Urdu–Hindi) | `#languageToggle` + system prompt |
| Section copy + "Copy Whole Campaign" + "Copied ✓" | `handleCopy()` |
| On-device history (view / reload / discard) | `localStorage` key `scriptforge.history.v1` |
| Local telemetry (generations, success rate, latency) | `localStorage` key `scriptforge.telemetry.v1` |
| Skeleton shimmer loading | `renderSkeleton()` |

---

## 🎨 Branding system

The canvas is **cosmic midnight `#030712`** with a neon violet brand
(`#7C3AED → #A855F7 → #E879F9`). Selecting a platform live-swaps the accent:

| Platform | Palette |
| --- | --- |
| TikTok | Cyan `#00f2fe` → Magenta `#fe0979` |
| YouTube Shorts | Crimson `#FF0000` |
| Instagram Reels | Sunset `#f9ce34` → `#ee2a7b` |
| LinkedIn | Corporate Blue `#0077b5` |

The glowing lamp beside the platform selector, its focus ring, and the generate
button all adopt the selected platform's colors in real time.

---

## 📱 Android APK conversion (WebView)

This SPA is built mobile-first (no horizontal scroll, `viewport-fit=cover`,
touch-optimized inputs, `localStorage` history/telemetry, clipboard fallback via
`document.execCommand`), so it wraps cleanly into a native app.

**Recommended — Capacitor:**

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init "ScriptForge" "com.yourco.scriptforge" --web-dir ./
npx cap add android
npx cap sync
# open ./android with Android Studio → Build → APK
```

Set the app to load your deployed Vercel URL. HTTPS is required for the
Clipboard API — your Vercel `*.vercel.app` URL is already HTTPS.

**Notes for WebView:**
- Keep the page served over HTTPS so `navigator.clipboard` works; the
  `execCommand` fallback covers older WebView builds.
- The app works offline up to the point of generation, and the history ledger
  plus telemetry work fully offline.

---

## 🛠 Local development

```bash
npx serve .                 # static files
# or
python3 -m http.server 8000
```

> Opening `index.html` directly (file://) will render the full UI, but
> generation requires the serverless function — use `vercel dev` to run the
> `/api/generate` endpoint locally:

```bash
vercel dev        # serves both the SPA and the API at http://localhost:3000
```

Without a deployed backend, the app offers a **"Load demo campaign"** button so
you can evaluate the full UI offline.

---

## 🧯 Troubleshooting

| Symptom | Fix |
| --- | --- |
| `OPENROUTER_API_KEY is not configured` | Add the env var in Vercel → Settings → Environment Variables → redeploy. |
| `All … models failed to respond` + 429 hint | Free-tier global rate limit — wait ~30s and retry, or add a funded key. |
| Function times out (504) | Upgrade Vercel plan for >10s function duration, or swap in a faster model. |
| "Could not reach the server" in browser | You opened `index.html` as a static file — deploy to Vercel or run `vercel dev`. |

---

Built for creators. Serverless, keyless on the client, and free to run. 🚀
