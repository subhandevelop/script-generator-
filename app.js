/* ============================================================================
   ScriptForge AI — app.js
   Frontend state management, secure API fetching, platform brand theming,
   sliding dashboard sidebar (history / performance / gateway profiles), and
   all interactive outputs (virality meter, copy utilities, history ledger).
   ----------------------------------------------------------------------------
   SECURITY NOTES
   • The OpenRouter API key is NEVER present in this file. All model traffic
     goes through the Vercel serverless function at /api/generate.
   • All model/user text is HTML-escaped before injection to prevent XSS.
   • No third-party trackers. History & telemetry live only in localStorage.
   ========================================================================== */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  var HISTORY_KEY = "scriptforge.history.v1";
  var TELEMETRY_KEY = "scriptforge.telemetry.v1";
  var HISTORY_LIMIT = 40;
  var GAUGE_RADIUS = 84;
  var GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS; // ≈ 527.79

  var LANG_LABELS = {
    english: "English",
    hinglish: "Hinglish",
    urdu: "Urdu / Hindi",
  };

  var LANG_HINTS = {
    english: "Full output in natural English.",
    hinglish: "Natural Hindi + English mix written in Roman/Latin script.",
    urdu: "Output in the native script — اردو for Urdu audiences, हिन्दी for Hindi.",
  };

  // Authentic platform brand palettes (drives lamp, focus ring & button).
  var PLATFORM_BRANDS = {
    "YouTube Shorts": { a: "#FF0000", b: "#FF5A5A" },
    "TikTok": { a: "#00f2fe", b: "#fe0979" },
    "Instagram Reels": { a: "#f9ce34", b: "#ee2a7b" },
    "LinkedIn": { a: "#0077b5", b: "#00A0DC" },
  };

  // Client-side mirror of the server's model grid. Used only for display when
  // the gateway is unreachable (static preview); live server data takes
  // precedence whenever the GET status call succeeds.
  var MODEL_MIRROR = [
    { id: "nvidia/llama-3.1-nemotron-70b-instruct:free", role: "primary" },
    { id: "meta-llama/llama-3.1-8b-instruct:free", role: "failover" },
    { id: "google/gemma-2-9b-it:free", role: "failover" },
  ];

  // ---------------------------------------------------------------------------
  // DEMO CAMPAIGN — used ONLY when the user explicitly clicks "Load demo
  // campaign" after the server is unreachable. It never participates in the
  // live API flow; it exists so the full UI can be previewed offline / inside
  // a WebView APK before the backend is wired up.
  // ---------------------------------------------------------------------------
  var DEMO_DATA = {
    viralityScore: 93,
    hooks: [
      "Your belly fat isn't lazy — it's stuck in a cycle most trainers never tell you about.",
      "I stopped doing 100 crunches a day and lost 11 inches in 6 weeks. Here are the 3 moves that did it.",
      "If you have 5 minutes and a wall, you already own everything you need to transform your core.",
    ],
    titles: [
      "3 Moves That Melt Belly Fat Faster Than Crunches",
      "Busy Moms: The 5-Minute Core Fix (No Equipment)",
      "Why Your Abs Aren't Visible — And The 5-Minute Fix",
    ],
    script: [
      {
        scene: 1,
        duration: "0:00 - 0:03",
        visual: "Tight close-up of your face, dim room, red ring light, direct eye contact with the lens.",
        audio: "Deep bass whoosh into silence. Fast, urgent pace — no filler words.",
        text_overlay: "Your belly fat isn't lazy.",
        dialogue: "Your belly fat isn't lazy — it's stuck in a cycle nobody tells you about.",
      },
      {
        scene: 2,
        duration: "0:03 - 0:12",
        visual: "Cut to a wide shot in a bright living room. B-roll montage of the first exercise: dead bug.",
        audio: "Upbeat percussion loop. Steady, confident voiceover.",
        text_overlay: "Move 1: Dead Bug",
        dialogue: "Move one: the dead bug. Ten slow reps. It fires the deep core that crunches never touch.",
      },
      {
        scene: 3,
        duration: "0:12 - 0:22",
        visual: "Side angle, slow-motion of the second exercise: plank shoulder taps. Hips stay level.",
        audio: "Same percussion, snare accents on each tap.",
        text_overlay: "Move 2: Plank Taps",
        dialogue: "Move two: plank shoulder taps. Twelve reps. The shake you feel? That's your core waking up.",
      },
      {
        scene: 4,
        duration: "0:22 - 0:34",
        visual: "Front angle of the third exercise: wall sit with a torso twist. Overlay a 30-second timer.",
        audio: "Music swells slightly. Soft ticking SFX.",
        text_overlay: "Move 3: Wall Twist",
        dialogue: "Move three: wall sit with a torso twist. Thirty seconds. Squeeze through the obliques.",
      },
      {
        scene: 5,
        duration: "0:34 - 0:46",
        visual: "Fast jump-cuts of all three moves with on-screen checkmarks. Flash the full circuit.",
        audio: "Music peaks. Energetic, faster delivery.",
        text_overlay: "3 moves · 5 min · daily",
        dialogue: "Do these three moves for five minutes a day. That's it. No gym, no equipment, no excuses.",
      },
      {
        scene: 6,
        duration: "0:46 - 0:56",
        visual: "Back to close-up. Point at the follow button on screen. Nod once.",
        audio: "Music ducks under the voice. Warm, direct tone.",
        text_overlay: "Follow for part 2",
        dialogue: "The full 21-day plan drops tomorrow. Follow now so you don't miss part two.",
      },
    ],
    metadata: {
      description:
        "Lose belly fat in 5 minutes a day with these 3 no-equipment moves built for busy moms. No gym, no crunches — just science-backed core activation. Save this and start today.",
      hashtags: [
        "#shorts", "#viral", "#fyp", "#fitmom", "#homeworkout", "#bellyfat",
        "#coreworkout", "#weightlossjourney", "#momlife", "#noequipment",
      ],
    },
    niche: "5-minute home workouts for busy moms",
    language: "english",
    tone: "High-Energy",
    platform: "YouTube Shorts",
    duration: "60 seconds",
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  var state = {
    language: "english",
    current: null,
    loading: false,
    gateway: null, // GET /api/generate response (routing profile)
  };

  // ---------------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };

  var nicheInput = $("nicheInput");
  var charCount = $("charCount");
  var langHint = $("langHint");
  var platformSelect = $("platformSelect");
  var toneSelect = $("toneSelect");
  var durationSelect = $("durationSelect");
  var generateBtn = $("generateBtn");
  var generateBtnLabel = $("generateBtnLabel");
  var brandLamp = $("brandLamp");
  var statusArea = $("statusArea");
  var outputSection = $("outputSection");
  var gaugeFill = $("gaugeFill");
  var scoreValue = $("scoreValue");
  var scoreVerdict = $("scoreVerdict");
  var meterChips = $("meterChips");
  var hooksList = $("hooksList");
  var titlesList = $("titlesList");
  var scriptList = $("scriptList");
  var metadataDesc = $("metadataDesc");
  var hashtagsList = $("hashtagsList");
  var copyAllBtn = $("copyAllBtn");
  var toastEl = $("toast");

  // Sidebar
  var sidebar = $("sidebar");
  var sidebarBackdrop = $("sidebarBackdrop");
  var burgerBtn = $("burgerBtn");
  var sidebarClose = $("sidebarClose");
  var historySearch = $("historySearch");
  var historyList = $("historyList");
  var clearHistoryBtn = $("clearHistoryBtn");
  var metricsGrid = $("metricsGrid");
  var gatewayStatus = $("gatewayStatus");
  var refreshGatewayBtn = $("refreshGatewayBtn");
  var profilesList = $("profilesList");
  var keyStatus = $("keyStatus");

  // Header status pill
  var headerStatus = $("headerStatus");
  var headerStatusText = $("headerStatusText");

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /** HTML-escape untrusted text before injecting it into the DOM. */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Convert a #RRGGBB hex to an rgba() string. */
  function hexToRgba(hex, alpha) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "rgba(168,85,247," + alpha + ")";
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  /** Copy text to the clipboard with a legacy WebView fallback. */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      return false;
    }
  }

  /** Show a transient toast message. */
  var toastTimer = null;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2400);
  }

  /** Temporary "Copied ✓" state on a button. */
  function flashCopied(button, label) {
    var original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = label || "Copied ✓";
    button.classList.add("copied");
    setTimeout(function () {
      button.textContent = original;
      button.classList.remove("copied");
    }, 1800);
  }

  /** Format a timestamp as a human "time ago" string. */
  function timeAgo(iso) {
    var then = new Date(iso).getTime();
    var diff = Date.now() - then;
    if (!isFinite(diff)) return "";
    var sec = Math.round(diff / 1000);
    if (sec < 5) return "just now";
    if (sec < 60) return sec + "s ago";
    var min = Math.round(sec / 60);
    if (min < 60) return min + "m ago";
    var hr = Math.round(min / 60);
    if (hr < 24) return hr + "h ago";
    var day = Math.round(hr / 24);
    if (day < 7) return day + "d ago";
    return new Date(iso).toLocaleDateString();
  }

  /** Score → human verdict. */
  function verdictFor(score) {
    if (score >= 91) return "Exceptional — this concept is primed to blow up. 🚀";
    if (score >= 83) return "Strong viral potential — polish the hook and ship it. 🔥";
    return "Solid foundation — tighten the first 3 seconds to unlock more reach. 📈";
  }

  /** Short display name for a model id. */
  function shortModel(id) {
    var s = String(id || "").replace(":free", "");
    var parts = s.split("/");
    return parts.length > 1 ? parts[1] : s;
  }

  // ---------------------------------------------------------------------------
  // Platform brand theming
  // ---------------------------------------------------------------------------
  function applyBrand(platformKey) {
    var brand = PLATFORM_BRANDS[platformKey] || { a: "#A855F7", b: "#E879F9" };
    var root = document.documentElement;
    root.style.setProperty("--brand-1", brand.a);
    root.style.setProperty("--brand-2", brand.b);
    root.style.setProperty("--brand-1-soft", hexToRgba(brand.a, 0.16));
    brandLamp.style.background = "linear-gradient(135deg, " + brand.a + ", " + brand.b + ")";
    brandLamp.style.boxShadow = "0 0 0 3px " + hexToRgba(brand.a, 0.16) + ", 0 0 14px " + brand.a;
  }

  // ---------------------------------------------------------------------------
  // Character count
  // ---------------------------------------------------------------------------
  function updateCharCount() {
    var len = nicheInput.value.length;
    charCount.textContent = String(len);
    charCount.classList.remove("warn", "danger");
    if (len >= 300) charCount.classList.add("danger");
    else if (len >= 260) charCount.classList.add("warn");
  }

  // ---------------------------------------------------------------------------
  // Language toggle
  // ---------------------------------------------------------------------------
  function setLanguage(lang) {
    state.language = lang;
    var buttons = document.querySelectorAll("#languageToggle .seg");
    Array.prototype.forEach.call(buttons, function (btn) {
      var active = btn.getAttribute("data-lang") === lang;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    langHint.textContent = LANG_HINTS[lang] || "";
  }

  // ---------------------------------------------------------------------------
  // Sliding sidebar
  // ---------------------------------------------------------------------------
  function openSidebar() {
    sidebar.classList.add("open");
    sidebarBackdrop.classList.add("show");
    burgerBtn.classList.add("open");
    burgerBtn.setAttribute("aria-expanded", "true");
    sidebar.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    sidebarClose.focus();
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarBackdrop.classList.remove("show");
    burgerBtn.classList.remove("open");
    burgerBtn.setAttribute("aria-expanded", "false");
    sidebar.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function switchTab(tabName) {
    var tabs = document.querySelectorAll(".sidebar-tabs .stab");
    Array.prototype.forEach.call(tabs, function (t) {
      var active = t.getAttribute("data-tab") === tabName;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    var panels = document.querySelectorAll(".tab-panel");
    Array.prototype.forEach.call(panels, function (p) {
      p.hidden = p.getAttribute("data-panel") !== tabName;
    });
    if (tabName === "performance") renderPerformance();
    if (tabName === "profiles") renderProfiles();
  }

  // ---------------------------------------------------------------------------
  // Telemetry (localStorage)
  // ---------------------------------------------------------------------------
  function defaultTelemetry() {
    return {
      generations: 0,
      successes: 0,
      failures: 0,
      totalMs: 0,
      lastModel: null,
      lastFallback: false,
      lastError: null,
      lastAt: null,
    };
  }

  function loadTelemetry() {
    try {
      var raw = localStorage.getItem(TELEMETRY_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : defaultTelemetry();
    } catch (err) {
      return defaultTelemetry();
    }
  }

  function saveTelemetry(t) {
    try {
      localStorage.setItem(TELEMETRY_KEY, JSON.stringify(t));
    } catch (err) {
      /* storage unavailable — degrade gracefully */
    }
  }

  function recordSuccess(model, usedFallback, ms) {
    var t = loadTelemetry();
    t.generations += 1;
    t.successes += 1;
    t.totalMs += Math.max(0, ms || 0);
    t.lastModel = model || null;
    t.lastFallback = !!usedFallback;
    t.lastError = null;
    t.lastAt = new Date().toISOString();
    saveTelemetry(t);
  }

  function recordFailure(errMsg) {
    var t = loadTelemetry();
    t.generations += 1;
    t.failures += 1;
    t.lastError = errMsg || "Unknown error";
    t.lastAt = new Date().toISOString();
    saveTelemetry(t);
  }

  function storageUsageKB() {
    try {
      var total = 0;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        total += (k.length + (localStorage.getItem(k) || "").length) * 2;
      }
      return (total / 1024).toFixed(1);
    } catch (err) {
      return "0.0";
    }
  }

  // ---------------------------------------------------------------------------
  // Gateway profile (GET /api/generate)
  // ---------------------------------------------------------------------------
  function fetchGatewayProfile() {
    return fetch("/api/generate", { method: "GET", cache: "no-store" })
      .then(function (res) {
        return res.text().then(function (text) {
          var json = null;
          try { json = text ? JSON.parse(text) : null; } catch (err) { json = null; }
          if (!res.ok || !json || !json.success) throw new Error("gateway unreachable");
          return json;
        });
      })
      .then(function (json) {
        state.gateway = json;
        renderHeaderStatus();
        renderPerformance();
        renderProfiles();
        return json;
      })
      .catch(function () {
        state.gateway = null;
        renderHeaderStatus();
        renderPerformance();
        renderProfiles();
        return null;
      });
  }

  function renderHeaderStatus() {
    headerStatus.classList.remove("ok", "warn");
    if (state.gateway) {
      if (state.gateway.keyConfigured) {
        headerStatus.classList.add("ok");
        headerStatusText.textContent = "API Online · Key ✓";
      } else {
        headerStatus.classList.add("warn");
        headerStatusText.textContent = "API Online · Key missing";
      }
    } else {
      headerStatusText.textContent = "Static preview";
    }
  }

  function renderPerformance() {
    var t = loadTelemetry();
    var total = t.generations || 0;
    var successRate = total ? Math.round((t.successes / total) * 100) : 0;
    var avgMs = t.successes ? Math.round(t.totalMs / t.successes) : null;
    var avgSec = avgMs == null ? "—" : (avgMs / 1000).toFixed(1) + "s";

    var tiles = [
      { label: "Generations", value: String(total) },
      { label: "Success rate", value: successRate + "%" },
      { label: "Avg response", value: avgSec },
      { label: "Storage used", value: storageUsageKB() + " KB" },
      { label: "Last model", value: t.lastModel ? shortModel(t.lastModel) : "—", small: true },
      { label: "Last failover", value: t.lastFallback ? "Yes" : "No" },
    ];

    metricsGrid.innerHTML = tiles.map(function (m) {
      return (
        '<div class="metric-tile">' +
          '<span class="metric-label">' + esc(m.label) + "</span>" +
          '<span class="metric-value' + (m.small ? " small" : "") + '">' + esc(m.value) + "</span>" +
        "</div>"
      );
    }).join("");

    // Server status card
    if (state.gateway) {
      var lastErr = t.lastError ? '<div class="row"><span class="k">Last error</span><span class="v">' + esc(String(t.lastError).slice(0, 90)) + "</span></div>" : "";
      gatewayStatus.innerHTML =
        '<div class="row"><span class="k">Service</span><span class="v">' + esc(state.gateway.service || "OpenRouter Gateway") + "</span></div>" +
        '<div class="row"><span class="k">API key</span><span class="v">' + (state.gateway.keyConfigured ? '<span class="badge-ok">Configured</span>' : '<span class="badge-no">Missing</span>') + "</span></div>" +
        '<div class="row"><span class="k">Active models</span><span class="v">' + esc(String((state.gateway.models || []).length)) + "</span></div>" +
        '<div class="row"><span class="k">Max duration</span><span class="v">' + esc(String(state.gateway.maxDurationSeconds)) + "s</span></div>" +
        lastErr;
    } else {
      gatewayStatus.innerHTML =
        '<div class="row"><span class="k">Gateway</span><span class="v"><span class="badge-no">Unreachable</span></span></div>' +
        '<div class="row"><span class="k">Hint</span><span class="v">Deploy to Vercel and set OPENROUTER_API_KEY to go live.</span></div>';
    }
  }

  function renderProfiles() {
    var models = state.gateway && state.gateway.models && state.gateway.models.length
      ? state.gateway.models
      : MODEL_MIRROR;
    var t = loadTelemetry();

    profilesList.innerHTML = models.map(function (m) {
      var isPrimary = m.role === "primary";
      var live = t.lastModel === m.id;
      return (
        '<div class="profile-card' + (live ? " current" : "") + '">' +
          '<div class="profile-top">' +
            '<span class="profile-model">' + esc(m.id) + "</span>" +
            '<span class="role-badge ' + (isPrimary ? "role-primary" : "role-failover") + '">' + (isPrimary ? "Primary" : "Failover") + "</span>" +
          "</div>" +
          '<div class="profile-status' + (live ? " live" : "") + '">' +
            '<span class="dot"></span>' +
            (live ? "Last used for a live generation" : (isPrimary ? "Primary router target" : "Automated failover standby")) +
            '<span class="free">FREE</span>' +
          "</div>" +
        "</div>"
      );
    }).join("");

    if (state.gateway) {
      keyStatus.innerHTML =
        '<div class="row"><span class="k">OPENROUTER_API_KEY</span><span class="v">' +
        (state.gateway.keyConfigured ? '<span class="badge-ok">Configured</span>' : '<span class="badge-no">Not set</span>') +
        "</span></div>" +
        '<div class="row"><span class="k">Routing</span><span class="v">Server-side, in api/generate.js</span></div>' +
        '<div class="row"><span class="k">Secret exposure</span><span class="v">Never sent to the browser</span></div>';
    } else {
      keyStatus.innerHTML =
        '<div class="row"><span class="k">Gateway</span><span class="v"><span class="badge-no">Unreachable</span></span></div>' +
        '<div class="row"><span class="k">Profile source</span><span class="v">Offline mirror</span></div>';
    }
  }

  // ---------------------------------------------------------------------------
  // Loading / skeleton / error states
  // ---------------------------------------------------------------------------
  function setLoading(loading) {
    state.loading = loading;
    generateBtn.disabled = loading;
    if (loading) {
      generateBtnLabel.textContent = "Generating…";
      generateBtn.querySelector(".gen-icon").outerHTML =
        '<span class="spinner" aria-hidden="true"></span>';
    } else {
      generateBtnLabel.textContent = "Generate Viral Script";
      generateBtn.querySelector(".spinner").outerHTML =
        '<svg class="gen-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M13 2 4.5 14H11l-1.5 8L18.5 10H12l1-8z" fill="currentColor" /></svg>';
    }
  }

  function renderSkeleton() {
    statusArea.hidden = false;
    outputSection.hidden = true;
    statusArea.innerHTML =
      '<div class="glass card sk-card">' +
        '<div class="sk-top">' +
          '<div class="sk-gauge" aria-hidden="true"></div>' +
          '<div class="sk-lines">' +
            '<div class="sk-line shimmer w60"></div>' +
            '<div class="sk-line shimmer w80"></div>' +
            '<div class="sk-line shimmer w40"></div>' +
          '</div>' +
        '</div>' +
        '<div class="sk-label"><span class="dot"></span> Crafting hooks, script &amp; metadata…</div>' +
        '<div class="sk-block shimmer"></div>' +
        '<div class="sk-block shimmer"></div>' +
      '</div>';
  }

  function renderError(title, message, detail) {
    statusArea.hidden = false;
    outputSection.hidden = true;
    statusArea.innerHTML =
      '<div class="glass card status-card error">' +
        '<div class="status-title">⚠️ ' + esc(title) + '</div>' +
        '<p class="status-msg">' + esc(message) + '</p>' +
        (detail ? '<p class="status-detail">' + esc(detail) + '</p>' : "") +
        '<div class="status-actions">' +
          '<button type="button" class="btn-copy" id="retryBtn">↻ Try again</button>' +
          '<button type="button" class="btn-copy" id="demoBtn">Load demo campaign</button>' +
        '</div>' +
      '</div>';

    $("retryBtn").addEventListener("click", generate);
    $("demoBtn").addEventListener("click", function () {
      state.current = JSON.parse(JSON.stringify(DEMO_DATA));
      renderOutput(state.current);
      statusArea.hidden = true;
      toast("Showing demo campaign (offline preview)");
    });
  }

  function clearStatus() {
    statusArea.hidden = true;
    statusArea.innerHTML = "";
  }

  // ---------------------------------------------------------------------------
  // Generate
  // ---------------------------------------------------------------------------
  function generate() {
    var niche = nicheInput.value.trim();
    if (!niche) {
      toast("Enter a niche or topic first ✍️");
      nicheInput.focus();
      return;
    }
    if (state.loading) return;

    var payload = {
      niche: niche,
      language: state.language,
      tone: toneSelect.value,
      platform: platformSelect.value,
      duration: durationSelect.value,
    };

    var startedAt = Date.now();
    setLoading(true);
    renderSkeleton();

    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var json = null;
          try { json = text ? JSON.parse(text) : null; } catch (err) { json = null; }
          if (!res.ok || !json || !json.success) {
            var err = new Error((json && json.error) || "Request failed (HTTP " + res.status + ").");
            err.detail = (json && (json.detail || json.hint)) || null;
            err.notDeployed = (res.status === 404 || res.status === 405);
            throw err;
          }
          return json;
        });
      })
      .then(function (json) {
        state.current = json.data;
        renderOutput(state.current);
        pushHistory(state.current);
        recordSuccess(json.model, json.usedFallback, Date.now() - startedAt);
        clearStatus();
        renderPerformance();
        renderProfiles();
        window.scrollTo({ top: 0, behavior: "smooth" });
        toast("Campaign generated 🎉" + (json.usedFallback ? " (failover model)" : ""));
      })
      .catch(function (err) {
        recordFailure(err.message || "Request failed");
        renderPerformance();
        if (err instanceof TypeError) {
          renderError(
            "Could not reach the server",
            "This happens when the app is opened as a static file or the Vercel function is not deployed yet. Deploy the project and set OPENROUTER_API_KEY, then try again.",
            "You can still explore the full UI with the demo campaign below."
          );
        } else if (err.notDeployed) {
          renderError(
            "Backend not found",
            "The /api/generate endpoint is not reachable — the project isn't deployed to Vercel yet (or you are previewing the static files only).",
            "Deploy the repo to Vercel and set OPENROUTER_API_KEY. You can explore the full UI with the demo campaign below."
          );
        } else {
          renderError(
            err.message || "Something went wrong",
            "The generation failed. Please try again in a moment.",
            err.detail || null
          );
        }
      })
      .then(function () {
        setLoading(false);
      });
  }

  // ---------------------------------------------------------------------------
  // Rendering the output
  // ---------------------------------------------------------------------------
  function renderOutput(data) {
    var rtl = data.language === "urdu";

    // Virality meter
    animateGauge(data.viralityScore);
    scoreVerdict.textContent = verdictFor(data.viralityScore);

    meterChips.innerHTML = [
      chip(data.niche),
      chip(LANG_LABELS[data.language] || data.language),
      chip(data.platform),
      chip(data.duration),
    ].join("");

    // Hooks
    hooksList.innerHTML = (data.hooks || []).map(function (h, i) {
      return (
        '<li class="hook-item">' +
          '<span class="hook-num">' + (i + 1) + "</span>" +
          '<span class="hook-text">' + esc(h) + "</span>" +
          '<button type="button" class="btn-copy icon hook-copy" data-copy="hook:' + i + '" aria-label="Copy hook ' + (i + 1) + '">Copy</button>' +
        "</li>"
      );
    }).join("");

    // Titles
    titlesList.innerHTML = (data.titles || []).map(function (t, i) {
      return (
        '<li class="hook-item">' +
          '<span class="hook-num">' + (i + 1) + "</span>" +
          '<span class="hook-text">' + esc(t) + "</span>" +
          '<button type="button" class="btn-copy icon hook-copy" data-copy="title:' + i + '" aria-label="Copy title ' + (i + 1) + '">Copy</button>' +
        "</li>"
      );
    }).join("");

    // Script
    scriptList.innerHTML = (data.script || []).map(function (s, i) {
      return (
        '<div class="scene">' +
          '<div class="scene-head">' +
            '<span class="scene-badge">SCENE ' + esc(s.scene) + "</span>" +
            (s.duration ? '<span class="scene-duration">' + esc(s.duration) + "</span>" : "") +
            '<button type="button" class="btn-copy icon" data-copy="scene:' + i + '">Copy</button>' +
          "</div>" +
          '<div class="scene-body">' +
            sceneRow("🎬 Visual", s.visual) +
            sceneRow("🎵 Audio", s.audio) +
            sceneRow("💬 On-screen", s.text_overlay) +
            sceneRowDialogue("🗣️ Dialogue", s.dialogue) +
          "</div>" +
        "</div>"
      );
    }).join("");

    // Metadata
    metadataDesc.textContent = data.metadata.description || "";
    hashtagsList.innerHTML = (data.metadata.hashtags || []).map(function (h) {
      return '<span class="hashtag">' + esc(h) + "</span>";
    }).join("");

    // RTL for Urdu/Hindi native-script output
    ["hooksList", "titlesList", "scriptList", "metadataDesc"].forEach(function (id) {
      $(id).classList.toggle("rtl", rtl);
      $(id).setAttribute("dir", rtl ? "rtl" : "ltr");
    });

    outputSection.hidden = false;
  }

  function chip(text) {
    return '<span class="chip">' + esc(text) + "</span>";
  }

  function sceneRow(label, value) {
    if (!value) return "";
    return (
      '<div class="scene-row">' +
        '<span class="lbl">' + label + "</span>" +
        '<span class="val">' + esc(value) + "</span>" +
      "</div>"
    );
  }

  function sceneRowDialogue(label, value) {
    if (!value) return "";
    return (
      '<div class="scene-row dialogue">' +
        '<span class="lbl">' + label + "</span>" +
        '<span class="val">' + esc(value) + "</span>" +
      "</div>"
    );
  }

  // ---------------------------------------------------------------------------
  // Virality gauge animation
  // ---------------------------------------------------------------------------
  function animateGauge(score) {
    var clamped = Math.max(0, Math.min(100, Number(score) || 0));
    var targetOffset = GAUGE_CIRCUMFERENCE * (1 - clamped / 100);

    gaugeFill.style.strokeDasharray = String(GAUGE_CIRCUMFERENCE);
    gaugeFill.style.strokeDashoffset = String(GAUGE_CIRCUMFERENCE);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        gaugeFill.style.strokeDashoffset = String(targetOffset);
      });
    });

    countUp(scoreValue, 0, clamped, 1300);
  }

  function countUp(el, from, to, durationMs) {
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min(1, (ts - start) / durationMs);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------------------
  // Copy utilities
  // ---------------------------------------------------------------------------
  function formatScript(data) {
    return (data.script || []).map(function (s) {
      var lines = ["SCENE " + s.scene + (s.duration ? "  (" + s.duration + ")" : "")];
      if (s.visual) lines.push("🎬 Visual: " + s.visual);
      if (s.audio) lines.push("🎵 Audio: " + s.audio);
      if (s.text_overlay) lines.push("💬 On-screen: " + s.text_overlay);
      if (s.dialogue) lines.push("🗣️ Dialogue: " + s.dialogue);
      return lines.join("\n");
    }).join("\n\n");
  }

  function formatCampaign(data) {
    var out = [];
    out.push("🎬 VIRAL CAMPAIGN — " + data.niche);
    out.push("Language: " + (LANG_LABELS[data.language] || data.language) +
      " · Platform: " + data.platform + " · Duration: " + data.duration);
    out.push("Virality Score: " + data.viralityScore + "/99");
    out.push("");
    out.push("── HOOKS ──");
    (data.hooks || []).forEach(function (h, i) { out.push((i + 1) + ") " + h); });
    out.push("");
    out.push("── TITLES ──");
    (data.titles || []).forEach(function (t, i) { out.push((i + 1) + ") " + t); });
    out.push("");
    out.push("── SCRIPT ──");
    out.push(formatScript(data));
    out.push("");
    out.push("── METADATA ──");
    out.push("Description: " + (data.metadata.description || ""));
    out.push("Hashtags: " + (data.metadata.hashtags || []).join(" "));
    return out.join("\n");
  }

  function textForKey(key) {
    var d = state.current;
    if (!d) return "";
    var match = key.split(":");
    switch (match[0]) {
      case "hook": return (d.hooks && d.hooks[Number(match[1])]) || "";
      case "title": return (d.titles && d.titles[Number(match[1])]) || "";
      case "hooks": return (d.hooks || []).map(function (h, i) { return (i + 1) + ". " + h; }).join("\n");
      case "titles": return (d.titles || []).map(function (t, i) { return (i + 1) + ". " + t; }).join("\n");
      case "scene":
        var s = (d.script && d.script[Number(match[1])]);
        return s ? formatScript({ script: [s] }) : "";
      case "script": return formatScript(d);
      case "metadata":
        return "Description: " + (d.metadata.description || "") + "\nHashtags: " + (d.metadata.hashtags || []).join(" ");
      case "all": return formatCampaign(d);
      default: return "";
    }
  }

  function handleCopy(button, key) {
    var text = textForKey(key);
    if (!text) {
      toast("Nothing to copy yet");
      return;
    }
    copyText(text).then(function (ok) {
      if (ok) {
        flashCopied(button, key === "all" ? "Copied ✓ Whole campaign" : "Copied ✓");
      } else {
        toast("Clipboard blocked — copy manually");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // History ledger (localStorage)
  // ---------------------------------------------------------------------------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_LIMIT)));
    } catch (err) {
      /* storage full or unavailable (private mode) — degrade gracefully */
    }
  }

  function pushHistory(data) {
    var entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      niche: data.niche,
      language: data.language,
      platform: data.platform,
      duration: data.duration,
      tone: data.tone,
      createdAt: new Date().toISOString(),
      data: data,
    };
    var list = loadHistory();
    list.unshift(entry);
    saveHistory(list);
    renderHistory(historySearch.value);
  }

  function renderHistory(filterText) {
    var list = loadHistory();
    var q = String(filterText || "").trim().toLowerCase();

    if (!list.length) {
      historyList.innerHTML =
        '<div class="history-empty">No generations yet — your saved campaigns will appear here, stored privately on this device.</div>';
      return;
    }

    var filtered = q
      ? list.filter(function (item) {
          return String(item.niche || "").toLowerCase().indexOf(q) > -1;
        })
      : list;

    if (!filtered.length) {
      historyList.innerHTML =
        '<div class="history-empty">No results for “' + esc(q) + '”.</div>';
      return;
    }

    historyList.innerHTML = filtered.map(function (item) {
      return (
        '<div class="history-item" data-id="' + esc(item.id) + '">' +
          '<div class="history-niche">' + esc(item.niche) + "</div>" +
          '<div class="history-meta">' +
            '<span class="chip">' + esc(LANG_LABELS[item.language] || item.language) + "</span>" +
            '<span class="chip">' + esc(item.platform || "") + "</span>" +
            '<span class="chip">' + esc(item.duration || "") + "</span>" +
            '<span class="history-score">' + esc(item.data && item.data.viralityScore) + "/99</span>" +
            '<span class="history-time">' + esc(timeAgo(item.createdAt)) + "</span>" +
          "</div>" +
          '<div class="history-actions">' +
            '<button type="button" class="btn-copy icon" data-action="view" data-id="' + esc(item.id) + '">👁 View</button>' +
            '<button type="button" class="btn-copy icon" data-action="reload" data-id="' + esc(item.id) + '">↻ Reload</button>' +
            '<button type="button" class="btn-copy icon" data-action="discard" data-id="' + esc(item.id) + '">🗑 Discard</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function findHistoryItem(id) {
    var list = loadHistory();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function viewHistoryItem(id) {
    var item = findHistoryItem(id);
    if (!item) return;
    state.current = item.data;
    renderOutput(item.data);
    clearStatus();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("Loaded from history");
  }

  function reloadHistoryItem(id) {
    var item = findHistoryItem(id);
    if (!item) return;
    nicheInput.value = item.niche || "";
    if (item.language) setLanguage(item.language);
    if (item.platform && PLATFORM_BRANDS[item.platform]) {
      platformSelect.value = item.platform;
      applyBrand(item.platform);
    }
    setSelectIfExists(durationSelect, item.duration);
    setSelectIfExists(toneSelect, item.tone);
    updateCharCount();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("Regenerating with saved inputs…");
    generate();
  }

  function setSelectIfExists(selectEl, value) {
    if (!value) return;
    var option = selectEl.querySelector('option[value="' + value + '"]');
    if (option) selectEl.value = value;
  }

  function discardHistoryItem(id) {
    var list = loadHistory().filter(function (item) { return item.id !== id; });
    saveHistory(list);
    renderHistory(historySearch.value);
    toast("Removed from history");
  }

  function clearHistory() {
    saveHistory([]);
    renderHistory(historySearch.value);
    toast("History cleared");
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------
  function init() {
    nicheInput.addEventListener("input", updateCharCount);

    document.querySelectorAll("#languageToggle .seg").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLanguage(btn.getAttribute("data-lang"));
      });
    });

    platformSelect.addEventListener("change", function () {
      applyBrand(platformSelect.value);
    });

    generateBtn.addEventListener("click", generate);
    copyAllBtn.addEventListener("click", function () {
      handleCopy(copyAllBtn, "all");
    });

    // Sidebar controls
    burgerBtn.addEventListener("click", function () {
      sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
    });
    sidebarClose.addEventListener("click", closeSidebar);
    sidebarBackdrop.addEventListener("click", closeSidebar);

    document.querySelectorAll(".sidebar-tabs .stab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchTab(tab.getAttribute("data-tab"));
      });
    });

    historySearch.addEventListener("input", function () {
      renderHistory(historySearch.value);
    });
    clearHistoryBtn.addEventListener("click", clearHistory);
    refreshGatewayBtn.addEventListener("click", function () {
      toast("Refreshing server status…");
      fetchGatewayProfile();
    });

    // Delegated clicks for copy buttons and history actions.
    document.addEventListener("click", function (e) {
      var copyBtn = e.target.closest("[data-copy]");
      if (copyBtn) {
        handleCopy(copyBtn, copyBtn.getAttribute("data-copy"));
        return;
      }
      var actionBtn = e.target.closest("[data-action]");
      if (actionBtn) {
        var id = actionBtn.getAttribute("data-id");
        var action = actionBtn.getAttribute("data-action");
        if (action === "view") viewHistoryItem(id);
        else if (action === "reload") reloadHistoryItem(id);
        else if (action === "discard") discardHistoryItem(id);
      }
    });

    // Keyboard: Ctrl/Cmd + Enter generates; Esc closes the sidebar.
    nicheInput.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        generate();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sidebar.classList.contains("open")) closeSidebar();
    });

    // Initial brand + UI state
    applyBrand(platformSelect.value);
    updateCharCount();
    renderHistory("");
    fetchGatewayProfile();
  }

  // Boot when the DOM is ready (script is loaded at end of body anyway).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
