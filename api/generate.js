/**
 * ============================================================================
 *  ScriptForge AI — Vercel Serverless Function
 *  File: api/generate.js
 * ----------------------------------------------------------------------------
 *  ROLE
 *    1. Runs every generation call 100% server-side on the official Groq
 *       Cloud engine, so the Secure Access Key never reaches the browser.
 *    2. Uses a standard OpenAI-compatible fetch utility against Groq's
 *       endpoint:  https://api.groq.com/openai/v1/chat/completions
 *    3. Forces the engine to return a single raw JSON object containing a
 *       virality score, 3 hooks, 3 titles, a scene-by-scene script, plus a
 *       full creator kit (caption, thumbnail text, call to action, posting
 *       time, audience, series ideas, keywords and hashtags).
 *    4. Guarantees that any network or rate-limit failure surfaces as a
 *       CLEAN, user-friendly message — raw technical strings are logged
 *       server-side only and NEVER returned to the client.
 *
 *  ENGINE
 *    PRIMARY   : llama-3.3-70b-versatile
 *    FALLBACK  : llama-3.1-8b-instant   (auto-switch if the primary stumbles)
 *
 *  ACCESS KEY
 *    Read from process.env.GROQ_API_KEY — set it in the Vercel Dashboard
 *    under Settings → Environment Variables, then redeploy.
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// Groq configuration
// ----------------------------------------------------------------------------

/** Groq's official OpenAI-compatible base URL. */
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/** Groq chat completions endpoint (standard OpenAI format). */
const GROQ_CHAT_URL = GROQ_BASE_URL + "/chat/completions";

/** Primary text generation engine. */
const PRIMARY_MODEL = "llama-3.3-70b-versatile";

/** Automatic fallback engine if the primary errors out. */
const FALLBACK_MODEL = "llama-3.1-8b-instant";

/** The routing order used by the handler. */
const MODELS = [PRIMARY_MODEL, FALLBACK_MODEL];

/** Request timeout in ms — safely under Vercel's function cap. */
const REQUEST_TIMEOUT_MS = 55000;

/** Allowed language identifiers (matches the frontend toggle). */
const ALLOWED_LANGUAGES = ["english", "hinglish", "urdu"];

/** Human-readable language labels injected into the engine prompt. */
const LANGUAGE_LABELS = {
  english: "English",
  hinglish: "Hinglish (natural Hindi + English mix written in Roman/Latin script)",
  urdu: "Urdu / Hindi native script (اردو for Urdu audiences, हिन्दी for Hindi audiences)",
};

// ----------------------------------------------------------------------------
// System prompt — the complete contract with the engine
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
  "caption": "short catchy caption for the post",
  "thumbnailText": "bold 3-6 word thumbnail text",
  "callToAction": "one short line asking viewers to act",
  "bestPostTime": "e.g. Weekdays, 7-9 PM",
  "audience": "one line describing the target audience",
  "seriesIdeas": ["follow-up idea one", "follow-up idea two", "follow-up idea three"],
  "metadata": {
    "description": "keyword-rich description copy",
    "keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8", "#tag9", "#tag10"]
  }
}

HARD RULES — violations are unacceptable:

1. viralityScore: an integer from 75 to 99 (never below 75, never above 99). Calibrate honestly: 75-82 = solid, 83-90 = strong viral potential, 91-99 = exceptional and likely to blow up.

2. hooks: EXACTLY 3 distinct, high-retention opening hooks. Each must weaponize a curiosity gap, a bold claim, or a pattern interrupt within the first 8 words. Maximum 25 words each. Never repeat the same idea twice.

3. titles: EXACTLY 3 click-worthy title variations. Each needs a strong curiosity gap or emotional trigger. Maximum 12 words each. Optimize for click-through, but never promise something the script does not deliver.

4. script: 6 to 10 scenes, scene-by-scene. Every scene object must contain all six keys: "scene" (integer starting at 1), "duration" (a "M:SS - M:SS" range; ranges must be sequential and roughly sum to the requested video length), "visual" (concrete shots, angles, framing, props, B-roll), "audio" (music bed, SFX, and voice direction such as pace, energy and pauses), "text_overlay" (the exact on-screen caption, short and punchy), "dialogue" (the exact words spoken as voiceover or to camera).

5. caption: one short, catchy caption (1-2 sentences, max 30 words) that accompanies the post and invites comments.

6. thumbnailText: a bold 3-6 word thumbnail text in Title Case that stops the scroll on a feed.

7. callToAction: one short line (max 12 words) that tells the viewer exactly what to do (follow, save, comment, share).

8. bestPostTime: a realistic posting recommendation as a short phrase (e.g. "Weekdays, 7-9 PM").

9. audience: one line (max 15 words) describing exactly who this video is for.

10. seriesIdeas: EXACTLY 3 follow-up video ideas that extend this concept into a series. Max 15 words each.

11. metadata.description: 2 to 3 sentences (30-60 words) of high-ranking description copy. Front-load the main keywords, describe what the viewer will learn, and end with a call to action. Written in the same language as the script.

12. metadata.keywords: EXACTLY 5 search keywords or short phrases (lowercase, comma-free strings) that people actually type into the platform search bar.

13. metadata.hashtags: EXACTLY 10 viral hashtags. Blend 3-4 broad reach tags (#shorts, #viral, #fyp, #trending) with 6-7 niche-specific tags. Each begins with "#" and contains no spaces.

14. LANGUAGE: write every field in the language specified in the user's request. For "Hinglish" use a natural Hindi-English mix in Roman/Latin script. For "Urdu / Hindi" use the native script.

15. SPECIFICITY: use concrete numbers, names, timestamps and sensory details. Never write vague filler like "something interesting happens".

16. VALID JSON: double quotes for all keys and strings, escape internal double quotes, no trailing commas, no comments.
`;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Sets permissive CORS headers so the SPA can call the function. */
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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

/** Strips markdown code fences the engine may have wrapped around the JSON. */
function stripCodeFences(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * Parses engine output into an object. Tries a direct parse first, then falls
 * back to extracting the first balanced { ... } block, so minor stray text
 * around the JSON does not break the pipeline.
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
 * Re-shapes raw engine output into a guaranteed-safe structure so the
 * frontend never has to guess about missing or malformed fields.
 */
function sanitizeResult(raw, meta) {
  const asStr = (v, fb = "") => (typeof v === "string" && v.trim() ? v.trim() : fb);
  const asNum = (v, fb) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };
  const asList = (v, cap) =>
    Array.isArray(v) ? v.map((x) => asStr(x)).filter(Boolean).slice(0, cap) : [];

  let score = Math.round(asNum(raw && raw.viralityScore, 88));
  if (score < 75) score = 75;
  if (score > 99) score = 99;

  const hooks = asList(raw && raw.hooks, 3);
  const titles = asList(raw && raw.titles, 3);
  const seriesIdeas = asList(raw && raw.seriesIdeas, 3);

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

  const keywords = asList(raw && raw.metadata && raw.metadata.keywords, 5);

  const hashtags = asList(raw && raw.metadata && raw.metadata.hashtags, 10)
    .map((h) => (h.startsWith("#") ? h : "#" + h))
    .filter((h, i, a) => a.indexOf(h) === i);

  return {
    viralityScore: score,
    hooks,
    titles,
    script,
    caption: asStr(raw && raw.caption),
    thumbnailText: asStr(raw && raw.thumbnailText),
    callToAction: asStr(raw && raw.callToAction),
    bestPostTime: asStr(raw && raw.bestPostTime),
    audience: asStr(raw && raw.audience),
    seriesIdeas,
    metadata: {
      description: asStr(raw && raw.metadata && raw.metadata.description),
      keywords,
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

/**
 * Maps an upstream HTTP status to a CLEAN, user-friendly message.
 * Raw technical details are never included.
 */
function friendlyError(status) {
  switch (status) {
    case 401:
      return "Your access key was rejected. Check your key and try again.";
    case 403:
      return "Your key doesn't have access to this engine. Check your account and retry.";
    case 404:
      return "The engine couldn't be reached. Please try again shortly.";
    case 408:
    case 504:
      return "The draft took too long. Please try again.";
    case 429:
      return "We're getting a lot of requests right now. Give it a few seconds and try again.";
    case 500:
    case 502:
    case 503:
      return "The service hit a snag. Please try again in a moment.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/**
 * Calls a single engine on Groq (OpenAI-compatible chat completions) and
 * returns the assistant message content. Throws a descriptive error (with
 * `.status`) on any failure; the raw upstream message is only used for
 * server-side logging, never for the client response.
 */
async function callEngine(engineId, messages, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: engineId,
        messages,
        temperature: 0.85,
        top_p: 0.95,
        max_tokens: 3000,
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
      // Log the raw detail server-side only.
      console.error("[ScriptForge] Groq error (" + upstream.status + "):", message);
      const error = new Error(friendlyError(upstream.status));
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
      throw new Error("The engine returned an empty draft.");
    }
    return content;
  } catch (err) {
    if (err && err.name === "AbortError") {
      const error = new Error("The draft took too long. Please try again.");
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

/** Ask Vercel for a longer execution window. */
export const maxDuration = 60;

export default async function handler(req, res) {
  setCors(res);

  // CORS preflight for browser-based clients.
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "This action isn't allowed here. Launch a campaign to begin.",
    });
  }

  // Parse the request body (Vercel auto-parses JSON; handle strings too).
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (err) {
    return res.status(400).json({ success: false, error: "That request didn't come through clearly. Try again." });
  }

  // Validate the only required field: the niche/topic.
  const niche = String((body && body.niche) || "").trim();
  if (!niche) {
    return res.status(400).json({ success: false, error: "Tell us your video idea first." });
  }
  if (niche.length > 400) {
    return res.status(400).json({
      success: false,
      error: "That idea is a little long — keep it under 400 characters.",
    });
  }

  // Validate/sanitize the optional fields.
  const language = ALLOWED_LANGUAGES.includes(body && body.language) ? body.language : "english";
  const tone = String((body && body.tone) || "High-Energy").trim().slice(0, 60);
  const platform = String((body && body.platform) || "YouTube Shorts").trim().slice(0, 60);
  const duration = String((body && body.duration) || "60 seconds").trim().slice(0, 40);

  // The secret lives ONLY on the server.
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "Your Secure Access Key isn't connected yet.",
      hint: "Add GROQ_API_KEY in your hosting dashboard (Vercel → Settings → Environment Variables), then redeploy.",
    });
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt({ niche, language, tone, platform, duration }) },
  ];

  // Try the primary engine, then automatically fall back to the secondary.
  let rawText = null;
  let usedModel = null;
  let usedFallback = false;
  let lastStatus = 0;

  for (const model of MODELS) {
    try {
      rawText = await callEngine(model, messages, apiKey);
      usedModel = model;
      usedFallback = model !== PRIMARY_MODEL;
      break;
    } catch (err) {
      lastStatus = (err && err.status) || 0;
      // Raw detail stays in the server log only.
      console.error("[ScriptForge] Engine failed:", model, err && err.message);
    }
  }

  if (!rawText) {
    // Clean, user-friendly alert — no raw technical strings leaked.
    return res.status(502).json({
      success: false,
      error: friendlyError(lastStatus),
      retryable: true,
    });
  }

  const parsed = parseModelJson(rawText);
  if (!parsed) {
    return res.status(502).json({
      success: false,
      error: "The engine drafted something unexpected. Try launching again.",
      retryable: true,
    });
  }

  const data = sanitizeResult(parsed, { niche, language, tone, platform, duration });

  return res.status(200).json({
    success: true,
    data,
    usedFallback,
    generatedAt: new Date().toISOString(),
  });
}
