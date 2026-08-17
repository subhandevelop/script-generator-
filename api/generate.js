/**
 * ============================================================================
 *  ScriptForge AI — Vercel Serverless Function
 *  File: api/generate.js
 * ----------------------------------------------------------------------------
 *  ROLE
 *    1. Performs the OpenRouter API handshake 100% server-side so the
 *       OPENROUTER_API_KEY never reaches the browser (no key leakage).
 *    2. Routes requests across an active 2026 free-model grid with automatic
 *       failover, so a discontinued or rate-limited node never kills a request.
 *    3. Forces the model to return a single raw JSON object containing a
 *       virality score, 3 hooks, 3 titles, a scene-by-scene script and
 *       high-ranking SEO metadata.
 *    4. Doubles as a lightweight status endpoint (GET) so the client can
 *       render the "API Gateway Profiles" and "System Performance" panels
 *       without ever exposing the secret.
 *
 *  ACTIVE MODEL GRID (2026)
 *    PRIMARY  : nvidia/llama-3.1-nemotron-70b-instruct:free
 *    FAILOVER : meta-llama/llama-3.1-8b-instruct:free
 *    FAILOVER : google/gemma-2-9b-it:free
 *
 *  DEPLOYMENT
 *    Lives at /api/generate.js and deploys automatically as a serverless
 *    function. The API key is read from process.env.OPENROUTER_API_KEY —
 *    set it in the Vercel Dashboard under Settings → Environment Variables,
 *    then redeploy. An optional APP_URL is sent as the OpenRouter HTTP-Referer.
 *
 *  SECURITY MODEL
 *    • No secrets are ever hard-coded in the client bundle.
 *    • This function is the only code path that talks to OpenRouter.
 *    • Inputs are validated and sanitized before they touch the model.
 *    • The model's raw output is parsed and re-shaped defensively so the
 *      frontend only ever receives a known-good structure.
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

/** Primary router target — highest quality free instruct model. */
const PRIMARY_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct:free";

/**
 * Automated failover array — tried in order if the primary fails.
 * Both nodes are active free models as of 2026.
 */
const FAILOVER_MODELS = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-2-9b-it:free",
];

/** The complete routing order used by the handler. */
const ROUTE = [PRIMARY_MODEL, ...FAILOVER_MODELS];

/** OpenRouter chat completions endpoint. */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Request timeout in ms — stays safely under Vercel's function cap. */
const REQUEST_TIMEOUT_MS = 55000;

/** Allowed language identifiers (matches the frontend toggle). */
const ALLOWED_LANGUAGES = ["english", "hinglish", "urdu"];

/** Human-readable language labels injected into the model prompt. */
const LANGUAGE_LABELS = {
  english: "English",
  hinglish: "Hinglish (natural Hindi + English mix written in Roman/Latin script)",
  urdu: "Urdu / Hindi native script (اردو for Urdu audiences, हिन्दी for Hindi audiences)",
};

// ----------------------------------------------------------------------------
// System prompt — the complete contract with the model
// ----------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are ScriptForge AI, an elite short-form video strategist and viral scriptwriter whose scripts have generated hundreds of millions of views. You understand the psychology of the scroll: the first 1.5 seconds decide whether a video lives or dies.

YOUR ONLY TASK: return ONE valid JSON object. Nothing else. No markdown, no code fences, no preamble, no commentary. The very first character you output must be "{" and the very last must be "}".

Respond with EXACTLY this shape:

{
  "viralityScore": 87,
  "hooks": ["hook one", "hook two", "hook three"],
  "titles": ["title one", "title two", "title three"],
  "script": [
    {
      "scene": 1,
      "duration": "0:00 - 0:03",
      "visual": "camera, framing, props and B-roll directions",
      "audio": "music, sound effects and voice direction",
      "text_overlay": "exact on-screen caption",
      "dialogue": "exact spoken words"
    }
  ],
  "metadata": {
    "description": "keyword-rich description copy",
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8", "#tag9", "#tag10"]
  }
}

HARD RULES — violations are unacceptable:

1. viralityScore: an integer from 75 to 99 (never below 75, never above 99). Calibrate honestly: 75-82 = solid, 83-90 = strong viral potential, 91-99 = exceptional and likely to blow up.

2. hooks: EXACTLY 3 distinct, high-retention opening hooks. Each must weaponize a curiosity gap, a bold claim, or a pattern interrupt within the first 8 words. Maximum 25 words each. Never repeat the same idea twice.

3. titles: EXACTLY 3 click-worthy title variations. Each needs a strong curiosity gap or emotional trigger. Maximum 12 words each. Optimize for click-through, but never promise something the script does not deliver.

4. script: 6 to 10 scenes, scene-by-scene. Every scene object must contain all six keys: "scene" (integer starting at 1), "duration" (a "M:SS - M:SS" range; ranges must be sequential and roughly sum to the requested video length), "visual" (concrete shots, angles, framing, props, B-roll), "audio" (music bed, SFX, and voice direction such as pace, energy and pauses), "text_overlay" (the exact on-screen caption, short and punchy), "dialogue" (the exact words spoken as voiceover or to camera).

5. metadata.description: 2 to 3 sentences (30-60 words) of high-ranking description copy. Front-load the main keywords, describe what the viewer will learn, and end with a call to action. Written in the same language as the script.

6. metadata.hashtags: EXACTLY 10 viral hashtags. Blend 3-4 broad reach tags (#shorts, #viral, #fyp, #trending) with 6-7 niche-specific tags. Each begins with "#" and contains no spaces.

7. LANGUAGE: write every field in the language specified in the user's request. For "Hinglish" use a natural Hindi-English mix in Roman/Latin script. For "Urdu / Hindi" use the native script.

8. SPECIFICITY: use concrete numbers, names, timestamps and sensory details. Never write vague filler like "something interesting happens".

9. VALID JSON: double quotes for all keys and strings, escape internal double quotes, no trailing commas, no comments.
`;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Sets permissive CORS headers so the SPA can call the function. */
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/** Builds the user prompt from validated request fields. */
function buildUserPrompt({ niche, language, tone, platform, duration }) {
  return [
    "Create a complete, viral short-form video campaign.",
    "",
    `TOPIC / NICHE: ${niche}`,
    `LANGUAGE: ${LANGUAGE_LABELS[language] || "English"}`,
    `TONE: ${tone}`,
    `PLATFORM: ${platform}`,
    `TARGET DURATION: ${duration}`,
    "",
    "Write for a real audience that is one thumb-swipe away from scrolling past.",
    "Make the hook impossible to ignore and hold retention high to the final frame.",
    "Remember: output ONLY the JSON object. No markdown, no commentary.",
  ].join("\n");
}

/** Strips markdown code fences the model may have wrapped around the JSON. */
function stripCodeFences(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * Parses the model output into an object. Tries a direct parse first, then
 * falls back to extracting the first balanced { ... } block, so minor stray
 * text around the JSON does not break the pipeline.
 */
function parseModelJson(text) {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    /* fall through to block extraction */
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (err) {
      /* give up */
    }
  }
  return null;
}

/**
 * Re-shapes the raw model output into a guaranteed-safe structure so the
 * frontend never has to guess about missing or malformed fields.
 */
function sanitizeResult(raw, meta) {
  const asStr = (v, fb = "") => (typeof v === "string" && v.trim() ? v.trim() : fb);
  const asNum = (v, fb) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };

  let score = Math.round(asNum(raw && raw.viralityScore, 88));
  if (score < 75) score = 75;
  if (score > 99) score = 99;

  const hooks = Array.isArray(raw && raw.hooks)
    ? raw.hooks.map((h) => asStr(h)).filter(Boolean).slice(0, 3)
    : [];

  const titles = Array.isArray(raw && raw.titles)
    ? raw.titles.map((t) => asStr(t)).filter(Boolean).slice(0, 3)
    : [];

  const script = Array.isArray(raw && raw.script)
    ? raw.script
        .map((s, i) => ({
          scene: i + 1,
          duration: asStr(s && s.duration),
          visual: asStr(s && s.visual),
          audio: asStr(s && s.audio),
          text_overlay: asStr(s && s.text_overlay),
          dialogue: asStr(s && s.dialogue),
        }))
        .filter((s) => s.visual || s.dialogue || s.audio || s.text_overlay)
    : [];

  const hashtags = Array.isArray(raw && raw.metadata && raw.metadata.hashtags)
    ? raw.metadata.hashtags
        .map((h) => asStr(h).replace(/[,\s]+$/, ""))
        .filter(Boolean)
        .map((h) => (h.startsWith("#") ? h : "#" + h))
        .filter((h, i, a) => a.indexOf(h) === i)
        .slice(0, 10)
    : [];

  return {
    viralityScore: score,
    hooks,
    titles,
    script,
    metadata: {
      description: asStr(raw && raw.metadata && raw.metadata.description),
      hashtags,
    },
    // Echo the request context so the UI can render summary chips.
    niche: meta.niche,
    language: meta.language,
    tone: meta.tone,
    platform: meta.platform,
    duration: meta.duration,
  };
}

/** Human-readable guidance for common upstream HTTP statuses. */
function hintForStatus(status) {
  switch (status) {
    case 401:
      return "The OPENROUTER_API_KEY was rejected (401). Regenerate your key at openrouter.ai/keys and update the Vercel environment variable, then redeploy.";
    case 402:
      return "The OpenRouter account has no available credits (402). Top up the account or switch to a free-tier plan.";
    case 403:
      return "Access denied (403). This key may not be authorized for the requested model.";
    case 404:
      return "A model endpoint returned 404 — that node has been discontinued. This app already targets active free models; report this so the grid can be updated.";
    case 408:
    case 504:
      return "The upstream model timed out. Free models can be slow under heavy load — retry in a few seconds.";
    case 429:
      return "OpenRouter's free-tier global rate limit was hit (429). Wait ~30 seconds and retry, or add a funded key to remove the cap.";
    case 500:
    case 502:
    case 503:
      return `OpenRouter is having upstream issues (HTTP ${status}). Retry shortly.`;
    default:
      return `Unexpected upstream response (HTTP ${status}). Retry in a moment.`;
  }
}

/**
 * Calls a single model on OpenRouter and returns the assistant message
 * content. Throws a descriptive error (with `.status`) on any failure so the
 * caller can decide whether to continue down the failover array.
 */
async function callModel(model, messages, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
        "HTTP-Referer": process.env.APP_URL || "https://scriptforge.vercel.app",
        "X-Title": "ScriptForge AI",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.85,
        top_p: 0.95,
        max_tokens: 2500,
      }),
      signal: controller.signal,
    });

    const text = await upstream.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (err) {
      payload = null;
    }

    if (!upstream.ok) {
      const message =
        (payload && payload.error && payload.error.message) ||
        text.slice(0, 300) ||
        "HTTP " + upstream.status;
      const error = new Error("HTTP " + upstream.status + ": " + message);
      error.status = upstream.status;
      throw error;
    }

    const content =
      payload &&
      payload.choices &&
      payload.choices[0] &&
      payload.choices[0].message &&
      payload.choices[0].message.content;
    if (!content) {
      throw new Error("OpenRouter returned an empty completion.");
    }
    return content;
  } catch (err) {
    if (err && err.name === "AbortError") {
      const error = new Error("Timed out after " + Math.round(REQUEST_TIMEOUT_MS / 1000) + "s.");
      error.status = 408;
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ----------------------------------------------------------------------------
// Vercel function configuration + handler
// ----------------------------------------------------------------------------

/** Ask Vercel for a longer execution window (free models can be slow). */
export const maxDuration = 60;

export default async function handler(req, res) {
  setCors(res);

  // CORS preflight for browser-based clients.
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // --------------------------------------------------------------------------
  // GET — gateway status / routing profile (no secrets exposed).
  // Used by the client's "API Gateway Profiles" and "System Performance" tabs.
  // --------------------------------------------------------------------------
  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      service: "ScriptForge AI — OpenRouter Gateway",
      keyConfigured: Boolean(process.env.OPENROUTER_API_KEY),
      models: ROUTE.map((id) => ({
        id,
        role: id === PRIMARY_MODEL ? "primary" : "failover",
      })),
      maxDurationSeconds: maxDuration,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed. Use POST to generate, or GET for gateway status.",
    });
  }

  // --------------------------------------------------------------------------
  // POST — generation
  // --------------------------------------------------------------------------

  // Parse the request body (Vercel auto-parses JSON; handle strings too).
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (err) {
    return res.status(400).json({ success: false, error: "Invalid JSON body." });
  }

  // Validate the only required field: the niche/topic.
  const niche = String((body && body.niche) || "").trim();
  if (!niche) {
    return res.status(400).json({ success: false, error: "The 'niche' field is required." });
  }
  if (niche.length > 400) {
    return res.status(400).json({
      success: false,
      error: "The 'niche' field is too long (max 400 characters).",
    });
  }

  // Validate/sanitize the optional fields.
  const language = ALLOWED_LANGUAGES.includes(body && body.language) ? body.language : "english";
  const tone = String((body && body.tone) || "High-Energy").trim().slice(0, 60);
  const platform = String((body && body.platform) || "YouTube Shorts").trim().slice(0, 60);
  const duration = String((body && body.duration) || "60 seconds").trim().slice(0, 40);

  // The secret lives ONLY on the server.
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "OPENROUTER_API_KEY is not configured on the server.",
      hint: "Add it in Vercel → Settings → Environment Variables, then redeploy.",
    });
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt({ niche, language, tone, platform, duration }) },
  ];

  // Try the primary model, then cascade down the failover array.
  let rawText = null;
  let usedModel = null;
  let usedFallback = false;
  let lastStatus = 0;
  const attempts = [];

  for (const model of ROUTE) {
    try {
      rawText = await callModel(model, messages, apiKey);
      usedModel = model;
      usedFallback = model !== PRIMARY_MODEL;
      attempts.push({ model, status: 200 });
      break;
    } catch (err) {
      lastStatus = (err && err.status) || 0;
      const message = (err && err.message) || "Unknown upstream error";
      attempts.push({ model, status: lastStatus, error: message });
    }
  }

  if (!rawText) {
    return res.status(502).json({
      success: false,
      error: `All ${ROUTE.length} configured models failed to respond.`,
      detail: attempts.map((a) => `${a.model} → ${a.error || "HTTP " + a.status}`).join(" | "),
      hint: hintForStatus(lastStatus),
      attempts,
    });
  }

  const parsed = parseModelJson(rawText);
  if (!parsed) {
    return res.status(502).json({
      success: false,
      error: "The model returned output that could not be parsed as JSON.",
      detail: stripCodeFences(rawText).slice(0, 400),
    });
  }

  const data = sanitizeResult(parsed, { niche, language, tone, platform, duration });

  return res.status(200).json({
    success: true,
    data,
    model: usedModel,
    usedFallback,
    attempts,
    generatedAt: new Date().toISOString(),
  });
}
