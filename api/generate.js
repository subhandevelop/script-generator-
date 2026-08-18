export const runtime = 'edge';

/**
 * ============================================================================
 *  ScriptForge AI — Vercel Edge Function (OpenAI-compatible Groq engine)
 *  File: api/generate.js
 * ----------------------------------------------------------------------------
 *  WHY EDGE RUNTIME
 *    `export const runtime = 'edge'` runs this route on Vercel's Edge network,
 *    which is NOT subject to the ~10-second serverless gateway limit that
 *    kills Node functions on the Hobby plan. Combined with the fast engine
 *    below (~2-3s per draft), the response pipeline never gets cut off.
 *    (For plain Vercel projects this is also enabled via vercel.json.)
 *
 *  ENGINE — strictly bound
 *    MODEL       : llama-3.1-8b-instant   (fast, free, ~2-3s completions)
 *    MAX TOKENS  : 1200                   (completion loop finishes instantly)
 *    ENDPOINT    : https://api.groq.com/openai/v1/chat/completions
 *
 *  ACCESS KEY
 *    Read strictly from process.env.GROQ_API_KEY (exact name — no aliases).
 *    Set it in the Vercel Dashboard → Settings → Environment Variables, then
 *    redeploy. Available to Edge Functions via process.env.
 *
 *  CLEAN JSON DELIVERY + HEALTHY 200
 *    Every outcome of a campaign launch returns HTTP 200 with a well-formed
 *    envelope: { success: true, data } on success, or
 *    { success: false, error: "<friendly message>", retryable: true } when an
 *    upstream network/engine exception occurs. Raw technical strings are
 *    logged server-side only and NEVER returned to the client, so the UI
 *    always shows a clean, user-friendly alert card.
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// Engine configuration
// ----------------------------------------------------------------------------

/** Groq's official OpenAI-compatible base URL. */
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/** Groq chat completions endpoint (standard OpenAI format). */
const GROQ_CHAT_URL = GROQ_BASE_URL + "/chat/completions";

/** Target engine — strictly bound, fast enough to finish well under any limit. */
const ENGINE_MODEL = "llama-3.1-8b-instant";

/**
 * Token cap — guarantees the completion loop returns inside 2-3 seconds.
 * 1200 tokens is comfortably enough for the full campaign JSON.
 */
const MAX_TOKENS = 1200;

/** Per-call timeout (ms). Safety guard only — the fast engine never hits it. */
const REQUEST_TIMEOUT_MS = 8000;

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

/** CORS headers attached to every response so the SPA can read the body. */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Clean JSON delivery.
 * Response.json() is the native Web-standard equivalent of NextResponse.json()
 * from 'next/server'. If this project is migrated to Next.js App Router, the
 * one-line swap is:
 *   import { NextResponse } from 'next/server';
 *   return NextResponse.json(payload, { status, headers: CORS_HEADERS });
 */
function jsonResponse(payload, status) {
  return Response.json(payload, {
    status: status || 200,
    headers: CORS_HEADERS,
  });
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
 * back to extracting the first balanced { ... } block.
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

/** Re-shapes raw engine output into a guaranteed-safe structure. */
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
    niche: meta.niche,
    language: meta.language,
    tone: meta.tone,
    platform: meta.platform,
    duration: meta.duration,
  };
}

/** Maps an upstream HTTP status to a CLEAN, user-friendly message. */
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
 * Calls Groq's OpenAI-compatible chat completions with the strictly-bound
 * engine and the 1200-token cap. Throws a clean Error on any failure; raw
 * upstream detail is only logged server-side.
 */
async function callEngine(messages, apiKey) {
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
        model: ENGINE_MODEL, // strictly llama-3.1-8b-instant
        messages,
        temperature: 0.85,
        top_p: 0.95,
        max_tokens: MAX_TOKENS, // 1200 → completion finishes in ~2-3s
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
// Edge function handler
// ----------------------------------------------------------------------------

export default async function handler(request) {
  // CORS preflight.
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { success: false, error: "This action isn't allowed here. Launch a campaign to begin." },
      405
    );
  }

  // Wrap the entire pipeline so ANY unexpected error still returns a clean,
  // well-formed 200 envelope instead of a 502.
  try {
    // Parse the request body.
    let body;
    try {
      body = await request.json();
    } catch (err) {
      const text = await request.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch (err2) {
        body = null;
      }
    }

    // Validate the only required field: the niche/topic.
    const niche = String((body && body.niche) || "").trim();
    if (!niche) {
      return jsonResponse({ success: false, error: "Tell us your video idea first." }, 200);
    }
    if (niche.length > 400) {
      return jsonResponse(
        { success: false, error: "That idea is a little long — keep it under 400 characters." },
        200
      );
    }

    // Validate/sanitize the optional fields.
    const language = ALLOWED_LANGUAGES.includes(body && body.language) ? body.language : "english";
    const tone = String((body && body.tone) || "High-Energy").trim().slice(0, 60);
    const platform = String((body && body.platform) || "YouTube Shorts").trim().slice(0, 60);
    const duration = String((body && body.duration) || "60 seconds").trim().slice(0, 40);

    // The secret lives ONLY on the server — exact variable name.
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return jsonResponse(
        {
          success: false,
          error: "Your Secure Access Key isn't connected yet.",
          hint: "Add GROQ_API_KEY in your hosting dashboard (Vercel → Settings → Environment Variables), then redeploy.",
          retryable: true,
        },
        200
      );
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt({ niche, language, tone, platform, duration }) },
    ];

    // Single, strictly-bound engine call. Upstream failures are caught below
    // and returned as a friendly 200 — never a 502.
    let rawText;
    try {
      rawText = await callEngine(messages, apiKey);
    } catch (err) {
      return jsonResponse(
        { success: false, error: friendlyError((err && err.status) || 0), retryable: true },
        200
      );
    }

    const parsed = parseModelJson(rawText);
    if (!parsed) {
      return jsonResponse(
        { success: false, error: "The engine drafted something unexpected. Try launching again.", retryable: true },
        200
      );
    }

    const data = sanitizeResult(parsed, { niche, language, tone, platform, duration });

    return jsonResponse(
      {
        success: true,
        data,
        generatedAt: new Date().toISOString(),
      },
      200
    );
  } catch (err) {
    // Top-level safety net — keep the status code healthy at 200 and never
    // leak raw technical strings to the client.
    console.error("[ScriptForge] Unhandled handler error:", err && err.message ? err.message : err);
    return jsonResponse(
      { success: false, error: "Something went wrong. Please try again.", retryable: true },
      200
    );
  }
}
