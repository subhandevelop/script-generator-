# ⚡ ScriptForge AI — Viral Content Script Generator

A premium, fully automated **Content Script Generator SaaS** web app. Paste a
niche, pick a language, and get a complete, ready-to-shoot campaign — 3
high-retention hooks, 3 viral titles, a scene-by-scene script with visual/audio
directions, a virality score, and high-ranking SEO metadata with 10 hashtags.

- **Frontend** — ultra-premium responsive SPA (glassmorphism, dark mode),
  optimized for Android WebView / APK conversion.
- **Backend** — secure Vercel serverless function that proxies OpenRouter so the
  API key never reaches the browser.
- **Model** — `nvidia/llama-3.1-nemotron-70b-instruct:free` with automatic
  fallback to `meta-llama/llama-3-8b-instruct:free`.

---

## 📁 Directory structure

```
├── api/
│   └── generate.js       # Vercel serverless Node.js backend (OpenRouter proxy)
├── index.html            # Ultra-premium responsive frontend UI
├── style.css             # Glassmorphism & custom utility styles
├── app.js                # Frontend state management & secure API fetching
└── README.md             # Setup and deployment documentation
```

> Tailwind is loaded via CDN for rapid utility prototyping. The shipped UI is
> fully self-contained in `style.css`, so it renders **pixel-identically**
> inside an Android WebView APK even before the CDN/fonts finish loading.

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

> 🆓 Get a key at [openrouter.ai/keys](https://openrouter.ai/keys). The two
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
- All model output is parsed and re-shaped server-side into a known-good JSON
  structure, then HTML-escaped again on the client to prevent XSS.
- CORS is enabled for browser clients; only `POST` and `OPTIONS` are allowed.

---

## 📡 API contract

**`POST /api/generate`**

Request body (JSON):

```json
{
  "niche": "5-minute home workouts for busy moms",
  "language": "english",          // "english" | "hinglish" | "urdu"
  "tone": "High-Energy",
  "platform": "YouTube Shorts",
  "duration": "60 seconds"
}
```

Response (JSON):

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
  "generatedAt": "2026-08-17T00:00:00.000Z"
}
```

---

## ✨ Feature map

| Feature | Where |
| --- | --- |
| Virality meter (animated SVG gauge + count-up) | `app.js` → `animateGauge()` |
| Multi-language (English / Hinglish / Urdu–Hindi) | `#languageToggle` + system prompt |
| Section copy + "Copy Whole Campaign" + "Copied ✓" | `app.js` → `handleCopy()` |
| On-device history ledger (view / reload / discard) | `localStorage` key `scriptforge.history.v1` |
| Skeleton shimmer loading | `app.js` → `renderSkeleton()` |
| Ad placeholder slots (header bottom + output footer) | `#ad-header`, `#ad-output` |

### Monetization — where to paste your ad code

Two **non-breaking** placeholder containers are hard-coded and clearly marked:

1. **Header bottom banner** — in `index.html`, inside `#ad-header` (the
   `.ad-placeholder` block directly below the header).
2. **Output footer banner** — in `index.html`, inside `#ad-output` (shown after
   the SEO metadata block when a campaign is generated).

Replace the placeholder markup inside those containers with your AdMob / AdSense
/ Unity banner snippet. The slots are sized for **728×90** (tablet/desktop) and
**320×50** (mobile).

---

## 🤖 Customizing models & prompt

- **Models** — edit `PRIMARY_MODEL` / `FALLBACK_MODEL` at the top of
  `api/generate.js`. Any OpenRouter model slug works.
- **System prompt** — edit the `SYSTEM_PROMPT` template literal in
  `api/generate.js` to change tone, schema, or rules.
- **Timeout** — `maxDuration = 60` is exported. On the free Vercel (Hobby) plan
  the function is capped at ~10s by default; upgrade to Pro or swap in a faster
  model if you hit timeouts.

---

## 📱 Android APK conversion (WebView)

This SPA is built mobile-first (no horizontal scroll, `viewport-fit=cover`,
touch-optimized inputs, `localStorage` history, clipboard fallback via
`document.execCommand`), so it wraps cleanly into a native app.

**Recommended — Capacitor:**

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init "ScriptForge" "com.yourco.scriptforge" --web-dir ./
npx cap add android
npx cap sync
# open ./android with Android Studio → Build → APK
```

Set the app to load your deployed Vercel URL (e.g. in `capacitor.config` or a
`window.location` redirect in `MainActivity`). HTTPS is required for the
Clipboard API — your Vercel `*.vercel.app` URL is already HTTPS.

**Notes for WebView:**
- Keep the page served over HTTPS so `navigator.clipboard` works; the
  `execCommand` fallback covers older WebView builds.
- The app works offline up to the point of generation (generation needs the
  backend), and the history ledger works fully offline.

---

## 🛠 Local development

```bash
# Serve the static files
npx serve .
# or
python3 -m http.server 8000
```

> Opening `index.html` directly (file://) will render the full UI, but
> generation requires the serverless function — use `vercel dev` to run the
> `/api/generate` endpoint locally:

```bash
vercel dev        # serves both the SPA and the API at http://localhost:3000
```

Without a deployed backend, the app offers a **"Preview with sample data"**
button so you can evaluate the full UI offline.

---

## 🧯 Troubleshooting

| Symptom | Fix |
| --- | --- |
| `OPENROUTER_API_KEY is not configured` | Add the env var in Vercel → Settings → Environment Variables → redeploy. |
| `All configured models failed` | Free models can be rate-limited; wait a moment and retry, or change `PRIMARY_MODEL`/`FALLBACK_MODEL`. |
| Function times out (504) | Upgrade Vercel plan for >10s function duration, or use a faster model. |
| "Could not reach the server" in browser | You opened `index.html` as a static file — deploy to Vercel or run `vercel dev`. |

---

Built for creators. Serverless, keyless on the client, and free to run. 🚀
