# ⚡ ScriptForge AI — Viral Campaign Studio

Drop a topic. Get hooks, titles, and a shoot-ready script in seconds.

A premium, fully automated **viral campaign studio**. Paste an idea, pick a
platform, and ScriptForge drafts a complete campaign — 3 high-retention hooks,
3 viral titles, a scene-by-scene script, thumbnail text, caption, engagement
kit, series ideas, keywords, and 10 hashtags — all with a virality score.

- **Frontend** — obsidian dark-mode SPA with a big-SaaS marketing layer,
  optimized for Android WebView / APK conversion.
- **Backend** — secure Vercel serverless function running every engine call
  server-side on **Groq Cloud**, so your Secure Access Key never reaches the
  browser.
- **Engine** — `llama-3.3-70b-versatile` with automatic fallback to
  `llama-3.1-8b-instant`.

---

## 📁 Directory structure

```
├── api/
│   └── generate.js       # Vercel serverless Node.js backend (Groq engine)
├── index.html            # Big-SaaS landing + studio UI
├── style.css             # Obsidian design system + marketing layer
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
vercel env add GROQ_API_KEY   # paste your key
vercel --prod     # deploy to production
```

### 🔑 Secure Access Key (Vercel → Settings → Environment Variables)

| Variable | Required | Notes |
| --- | --- | --- |
| `GROQ_API_KEY` | ✅ Yes | Your Groq Cloud key. Used **only** server-side in `api/generate.js`. |

After adding the variable, **redeploy** so the function picks it up.

> 🆓 Get a key at [console.groq.com/keys](https://console.groq.com/keys). The
> configured engines are free to use.

---

## 🔐 Security architecture

```
Browser (app.js)  ──POST /api/generate──▶  Vercel Function (api/generate.js)
                                              │
                                              │  Bearer $GROQ_API_KEY
                                              ▼
                                    Groq Cloud (OpenAI-compatible)
```

- `app.js` never holds or calls any key — it only posts the idea and options.
- The key is read at request time from `process.env.GROQ_API_KEY`.
- **No raw technical strings ever reach the UI.** The backend maps every
  failure (network, rate limit, auth, timeout) to a clean, user-friendly
  message; the frontend additionally drops any remaining detail and renders a
  friendly alert card.
- All engine output is parsed and re-shaped server-side into a known-good JSON
  structure, then HTML-escaped again on the client to prevent XSS.

---

## ⚙️ Engine configuration

| Role | Engine | Plan |
| --- | --- | --- |
| Primary | `llama-3.3-70b-versatile` | Free |
| Fallback | `llama-3.1-8b-instant` | Free |

Requests are sent to Groq's official OpenAI-compatible endpoint
`https://api.groq.com/openai/v1/chat/completions` with a standard payload:

```json
{
  "model": "llama-3.3-70b-versatile",
  "messages": [{ "role": "system", "content": "…" }, { "role": "user", "content": "…" }],
  "temperature": 0.85,
  "top_p": 0.95,
  "max_tokens": 3000
}
```

If the primary returns an HTTP error (401, 404, 429, 5xx…), the request
**silently** moves to the fallback engine. Only if both fail does the studio
show a clean alert card with a friendly message.

---

## 📡 Launch contract

**`POST /api/generate`** — launch a campaign.

Request body:

```json
{
  "niche": "5-minute home workouts for busy moms",
  "language": "english",
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
    "caption": "…",
    "thumbnailText": "…",
    "callToAction": "…",
    "bestPostTime": "…",
    "audience": "…",
    "seriesIdeas": ["…", "…", "…"],
    "metadata": { "description": "…", "keywords": ["…", "…"], "hashtags": ["#…", "…"] },
    "niche": "…", "language": "english", "tone": "…", "platform": "…", "duration": "…"
  },
  "usedFallback": false,
  "generatedAt": "2026-08-17T00:00:00.000Z"
}
```

Error response (clean, no raw strings):

```json
{
  "success": false,
  "error": "We're getting a lot of requests right now. Give it a few seconds and try again.",
  "retryable": true
}
```

---

## ✨ Feature map

| Feature | Where |
| --- | --- |
| Big-SaaS landing (hero, features, steps, FAQ, stats, footer) | `index.html` |
| Neon violet gear + bolt inline SVG logo | header / sidebar / footer |
| Platform brand palettes (TikTok, YouTube, Instagram, LinkedIn) | `app.js` → `PLATFORM_BRANDS` |
| Single-focus input + one high-energy CTA | `.generator-card` |
| Collapsible fine-tune panel | `#foldPanel` |
| Sliding History drawer (search + view/reload/discard) | `#sidebar` |
| Virality meter (animated SVG gauge + count-up) | `animateGauge()` |
| Hooks, titles, script, thumbnail, caption, engagement kit, series ideas, keywords & hashtags | `renderOutput()` |
| Section copy + "Copy Full Campaign" + "Copied ✓" | `handleCopy()` |
| On-device history | `localStorage` key `scriptforge.history.v1` |
| Homepage stats band (your campaigns + success rate) | `renderStats()` |
| Skeleton shimmer loading | `renderSkeleton()` |
| Clean user-friendly alert card (no raw errors) | `renderNotice()` |

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

---

## 📱 Android APK conversion (WebView)

Built mobile-first: no horizontal scroll, `viewport-fit=cover`, touch-optimized
inputs, `localStorage` history, and a clipboard fallback via
`document.execCommand`.

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init "ScriptForge" "com.yourco.scriptforge" --web-dir ./
npx cap add android
npx cap sync
# open ./android with Android Studio → Build → APK
```

Point the app at your deployed Vercel URL (HTTPS required for the Clipboard
API — `*.vercel.app` is already HTTPS).

---

## 🛠 Local development

```bash
npx serve .                 # static files
# or
python3 -m http.server 8000
```

> Opening `index.html` directly renders the full UI, but launching requires the
> serverless function — use `vercel dev`:

```bash
vercel dev        # serves the SPA and the /api/generate function on :3000
```

Without a deployed backend, the app offers a **"Load demo campaign"** button so
you can explore the full UI offline.

---

## 🧯 Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Your Secure Access Key isn't connected yet." | Add `GROQ_API_KEY` in Vercel → Settings → Environment Variables → redeploy. |
| "We're getting a lot of requests right now." | Groq's rate limit — wait a few seconds and launch again. |
| "The draft took too long." | Retry; or reduce the target video length. |
| "Connection lost" in the browser | You opened the file as a static page — deploy to Vercel or run `vercel dev`. |

---

Built for creators. Your ideas deserve an audience. 🚀
