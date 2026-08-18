/* ============================================================================
   ScriptForge AI — app.js
   Frontend state management, secure campaign launching, platform brand
   theming, sliding History drawer, and all interactive outputs (virality
   meter, hooks, titles, script, thumbnail, engagement kit, series ideas,
   keywords & hashtags, copy utilities, history).
   ----------------------------------------------------------------------------
   SECURITY NOTES
   • The Secure Access Key is NEVER present in this file. All engine traffic
     goes through the Vercel serverless function at /api/generate (Groq).
   • All engine/user text is HTML-escaped before injection to prevent XSS.
   • Error cards show ONLY clean, user-friendly messages — the backend never
     returns raw technical strings, and this file never renders them either.
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

  // Authentic platform brand palettes (drives lamp, focus ring & launch button).
  var PLATFORM_BRANDS = {
    "YouTube Shorts": { a: "#FF0000", b: "#FF5A5A" },
    "TikTok": { a: "#00f2fe", b: "#fe0979" },
    "Instagram Reels": { a: "#f9ce34", b: "#ee2a7b" },
    "LinkedIn": { a: "#0077b5", b: "#00A0DC" },
  };

  // ---------------------------------------------------------------------------
  // DEMO CAMPAIGN — used ONLY when the user explicitly clicks "Load demo
  // campaign" after the studio is unreachable. It never participates in the
  // live flow; it exists so the full UI can be previewed offline.
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
    caption: "No gym, no equipment, just 5 minutes. Save this for tomorrow morning 💪",
    thumbnailText: "Lose Belly Fat in 5 Minutes",
    callToAction: "Follow for the full 21-day plan",
    bestPostTime: "Weekdays, 7–9 PM",
    audience: "Busy moms who want results without a gym",
    seriesIdeas: [
      "The 5-Minute Arms Routine You Can Do Anywhere",
      "What I Eat in a Day for Lean Energy",
      "The Dead Bug Mistake Costing You Results",
    ],
    metadata: {
      description:
        "Lose belly fat in 5 minutes a day with these 3 no-equipment moves built for busy moms. No gym, no crunches — just science-backed core activation. Save this and start today.",
      keywords: ["belly fat workout", "5 minute core", "no equipment abs", "mom fitness", "home workout"],
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
  };

  // ---------------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };

  var nicheInput = $("nicheInput");
  var charCount = $("charCount");
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
  var thumbnailText = $("thumbnailText");
  var captionText = $("captionText");
  var ctaText = $("ctaText");
  var bestTimeText = $("bestTimeText");
  var audienceText = $("audienceText");
  var seriesList = $("seriesList");
  var metadataDesc = $("metadataDesc");
  var keywordsList = $("keywordsList");
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
  var openHistoryLink = $("openHistoryLink");

  // Stats band
  var statCampaigns = $("statCampaigns");
  var statSuccess = $("statSuccess");

  // Fine-tune fold
  var foldPanel = $("foldPanel");
  var foldHead = $("foldHead");

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
    if (score >= 91) return "Exceptional — this one's primed to blow up. 🚀";
    if (score >= 83) return "Strong potential — polish the hook and ship it. 🔥";
    return "Solid start — tighten the first 3 seconds. 📈";
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
  }

  // ---------------------------------------------------------------------------
  // Fine-tune fold
  // ---------------------------------------------------------------------------
  function toggleFold(force) {
    var open = typeof force === "boolean" ? force : !foldPanel.classList.contains("open");
    foldPanel.classList.toggle("open", open);
    foldHead.setAttribute("aria-expanded", open ? "true" : "false");
  }

  // ---------------------------------------------------------------------------
  // Sliding sidebar (history)
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

  // ---------------------------------------------------------------------------
  // Telemetry (localStorage) — drives the homepage stats band
  // ---------------------------------------------------------------------------
  function defaultTelemetry() {
    return {
      campaigns: 0,
      successes: 0,
      stumbles: 0,
      totalMs: 0,
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

  function recordSuccess(ms) {
    var t = loadTelemetry();
    t.campaigns += 1;
    t.successes += 1;
    t.totalMs += Math.max(0, ms || 0);
    saveTelemetry(t);
    renderStats();
  }

  function recordStumble() {
    var t = loadTelemetry();
    t.campaigns += 1;
    t.stumbles += 1;
    saveTelemetry(t);
    renderStats();
  }

  function renderStats() {
    var t = loadTelemetry();
    var total = t.campaigns || 0;
    var rate = total ? Math.round((t.successes / total) * 100) + "%" : "—";
    statCampaigns.textContent = String(total);
    statSuccess.textContent = rate;
  }

  // ---------------------------------------------------------------------------
  // Loading / skeleton / clean alert states
  // ---------------------------------------------------------------------------
  function setLoading(loading) {
    state.loading = loading;
    generateBtn.disabled = loading;
    if (loading) {
      generateBtnLabel.textContent = "Drafting…";
      generateBtn.querySelector(".gen-icon").outerHTML =
        '<span class="spinner" aria-hidden="true"></span>';
    } else {
      generateBtnLabel.textContent = "Launch Viral Campaign";
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
        '<div class="sk-label"><span class="dot"></span> Crafting hooks, script &amp; description…</div>' +
        '<div class="sk-block shimmer"></div>' +
        '<div class="sk-block shimmer"></div>' +
      '</div>';
  }

  /**
   * CLEAN alert card — shows only a friendly title + message. Never renders
   * raw technical strings (the backend already filters them out; this layer
   * deliberately drops any remaining detail for failure cases).
   */
  function renderNotice(title, message) {
    statusArea.hidden = false;
    outputSection.hidden = true;
    statusArea.innerHTML =
      '<div class="glass card status-card">' +
        '<div class="status-title">' + esc(title) + '</div>' +
        '<p class="status-msg">' + esc(message) + '</p>' +
        '<div class="status-actions">' +
          '<button type="button" class="btn-copy" id="retryBtn">↻ Try again</button>' +
          '<button type="button" class="btn-copy" id="demoBtn">Load demo campaign</button>' +
        '</div>' +
      '</div>';

    $("retryBtn").addEventListener("click", launch);
    $("demoBtn").addEventListener("click", function () {
      state.current = JSON.parse(JSON.stringify(DEMO_DATA));
      renderOutput(state.current);
      statusArea.hidden = true;
      toast("Showing a demo campaign");
    });
  }

  function clearStatus() {
    statusArea.hidden = true;
    statusArea.innerHTML = "";
  }

  // ---------------------------------------------------------------------------
  // Launch campaign
  // ---------------------------------------------------------------------------
  function launch() {
    var niche = nicheInput.value.trim();
    if (!niche) {
      toast("Tell us your video idea first ✍️");
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
            var err = new Error("launch_failed");
            err.friendly = (json && json.error) || "Something went wrong. Please try again.";
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
        recordSuccess(Date.now() - startedAt);
        clearStatus();
        window.scrollTo({ top: 0, behavior: "smooth" });
        toast("Campaign ready 🎉");
      })
      .catch(function (err) {
        recordStumble();
        if (err instanceof TypeError) {
          // Network failure (static preview / no connection).
          renderNotice(
            "Connection lost",
            "We couldn't reach the studio. Check your connection and try again."
          );
        } else if (err.notDeployed) {
          renderNotice(
            "Studio offline",
            "This workspace isn't connected to a live engine yet. Connect it and launch again."
          );
        } else {
          renderNotice(
            "That didn't go through",
            err.friendly || "Something went wrong. Please try again."
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

    // Thumbnail + caption
    thumbnailText.textContent = data.thumbnailText || "Your video deserves a bold thumbnail";
    captionText.textContent = data.caption || "";

    // Engagement kit
    ctaText.textContent = data.callToAction || "—";
    bestTimeText.textContent = data.bestPostTime || "—";
    audienceText.textContent = data.audience || "—";

    // Series ideas
    seriesList.innerHTML = (data.seriesIdeas || []).map(function (idea, i) {
      return (
        '<li class="hook-item">' +
          '<span class="hook-num">' + (i + 1) + "</span>" +
          '<span class="hook-text">' + esc(idea) + "</span>" +
        "</li>"
      );
    }).join("");

    // Description + keywords + hashtags
    metadataDesc.textContent = data.metadata.description || "";
    keywordsList.innerHTML = (data.metadata.keywords || []).map(function (k) {
      return '<span class="keyword">' + esc(k) + "</span>";
    }).join("");
    hashtagsList.innerHTML = (data.metadata.hashtags || []).map(function (h) {
      return '<span class="hashtag">' + esc(h) + "</span>";
    }).join("");

    // RTL for Urdu/Hindi native-script output
    [
      "hooksList", "titlesList", "scriptList", "thumbnailText", "captionText",
      "seriesList", "metadataDesc",
    ].forEach(function (id) {
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
      " · Platform: " + data.platform + " · Length: " + data.duration);
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
    out.push("── THUMBNAIL & CAPTION ──");
    out.push("Thumbnail: " + (data.thumbnailText || ""));
    out.push("Caption: " + (data.caption || ""));
    out.push("");
    out.push("── ENGAGEMENT KIT ──");
    out.push("Call to action: " + (data.callToAction || ""));
    out.push("Best time to post: " + (data.bestPostTime || ""));
    out.push("Audience: " + (data.audience || ""));
    out.push("");
    out.push("── NEXT VIDEO IDEAS ──");
    (data.seriesIdeas || []).forEach(function (s, i) { out.push((i + 1) + ") " + s); });
    out.push("");
    out.push("── DESCRIPTION & HASHTAGS ──");
    out.push("Description: " + (data.metadata.description || ""));
    out.push("Keywords: " + (data.metadata.keywords || []).join(", "));
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
      case "thumb":
        return "Thumbnail: " + (d.thumbnailText || "") + "\nCaption: " + (d.caption || "");
      case "kit":
        return "Call to action: " + (d.callToAction || "") +
          "\nBest time to post: " + (d.bestPostTime || "") +
          "\nAudience: " + (d.audience || "");
      case "series": return (d.seriesIdeas || []).map(function (s, i) { return (i + 1) + ". " + s; }).join("\n");
      case "metadata":
        return "Description: " + (d.metadata.description || "") +
          "\nKeywords: " + (d.metadata.keywords || []).join(", ") +
          "\nHashtags: " + (d.metadata.hashtags || []).join(" ");
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
        flashCopied(button, key === "all" ? "Copied ✓ Full campaign" : "Copied ✓");
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
      /* storage full or unavailable — degrade gracefully */
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
        '<div class="history-empty">Nothing here yet. Launch your first campaign.</div>';
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
    toast("Drafting again with saved inputs…");
    launch();
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
  // Smooth scroll helper for nav links
  // ---------------------------------------------------------------------------
  function scrollToTarget(selector) {
    var el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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

    generateBtn.addEventListener("click", launch);
    copyAllBtn.addEventListener("click", function () {
      handleCopy(copyAllBtn, "all");
    });

    // Fine-tune fold
    foldHead.addEventListener("click", function () {
      toggleFold();
    });

    // Sidebar controls
    burgerBtn.addEventListener("click", function () {
      sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
    });
    sidebarClose.addEventListener("click", closeSidebar);
    sidebarBackdrop.addEventListener("click", closeSidebar);
    if (openHistoryLink) {
      openHistoryLink.addEventListener("click", function (e) {
        e.preventDefault();
        openSidebar();
      });
    }

    historySearch.addEventListener("input", function () {
      renderHistory(historySearch.value);
    });
    clearHistoryBtn.addEventListener("click", clearHistory);

    // Smooth-scroll for all [data-scroll] buttons/links.
    document.querySelectorAll("[data-scroll]").forEach(function (el) {
      el.addEventListener("click", function () {
        scrollToTarget(el.getAttribute("data-scroll"));
      });
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

    // Keyboard: Ctrl/Cmd + Enter launches; Esc closes the sidebar.
    nicheInput.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        launch();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sidebar.classList.contains("open")) closeSidebar();
    });

    // Initial brand + UI state
    applyBrand(platformSelect.value);
    updateCharCount();
    renderHistory("");
    renderStats();
  }

  // Boot when the DOM is ready (script is loaded at end of body anyway).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
