/* ============================================================================
   ScriptForge AI — app.js
   Frontend state management, secure API fetching, and all interactive output
   (virality meter, copy utilities, on-device history ledger).
   ----------------------------------------------------------------------------
   SECURITY NOTES
   • The OpenRouter API key is NEVER present in this file. All model traffic
     goes through the Vercel serverless function at /api/generate.
   • All model/user text is HTML-escaped before injection to prevent XSS.
   • No third-party trackers. History is stored only in browser localStorage.
   ========================================================================== */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  var HISTORY_KEY = "scriptforge.history.v1";
  var HISTORY_LIMIT = 30;
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

  // ---------------------------------------------------------------------------
  // SAMPLE DATA — used ONLY when the user explicitly clicks "Preview with sample
  // data" after the server is unreachable. It never participates in the live
  // API flow and is provided purely to preview the UI offline / inside a
  // WebView APK before the backend is wired up.
  // ---------------------------------------------------------------------------
  var SAMPLE_DATA = {
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
        visual: "Side angle, slow-motion of the second exercise: plank shoulder taps. Show the hips staying level.",
        audio: "Same percussion, snare accents on each tap.",
        text_overlay: "Move 2: Plank Taps",
        dialogue: "Move two: plank shoulder taps. Twelve reps. The shake you feel? That's your core waking up.",
      },
      {
        scene: 4,
        duration: "0:22 - 0:32",
        visual: "Front angle of the third exercise: wall sit with a twist. Overlay a 30-second timer.",
        audio: "Music swells slightly. Add a soft ticking SFX.",
        text_overlay: "Move 3: Wall Twist",
        dialogue: "Move three: wall sit with a torso twist. Thirty seconds. Squeeze through the obliques.",
      },
      {
        scene: 5,
        duration: "0:32 - 0:44",
        visual: "Fast jump-cuts of all three moves with on-screen checkmarks. Flash the full circuit on screen.",
        audio: "Music peaks. Energetic, faster delivery.",
        text_overlay: "3 moves · 5 min · daily",
        dialogue: "Do these three moves for five minutes a day. That's it. No gym, no equipment, no excuses.",
      },
      {
        scene: 6,
        duration: "0:44 - 0:54",
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
  var historyList = $("historyList");
  var clearHistoryBtn = $("clearHistoryBtn");
  var toastEl = $("toast");

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
          '<button type="button" class="btn-copy" id="sampleBtn">Preview with sample data</button>' +
        '</div>' +
      '</div>';

    $("retryBtn").addEventListener("click", generate);
    $("sampleBtn").addEventListener("click", function () {
      state.current = JSON.parse(JSON.stringify(SAMPLE_DATA));
      renderOutput(state.current);
      statusArea.hidden = true;
      toast("Showing sample output (demo data only)");
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
            // A 404/405 means the serverless endpoint is not deployed/routed.
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
        clearStatus();
        window.scrollTo({ top: 0, behavior: "smooth" });
        toast("Campaign generated 🎉");
      })
      .catch(function (err) {
        // TypeError → network failure (static preview / function not deployed).
        if (err instanceof TypeError) {
          renderError(
            "Could not reach the server",
            "This happens when the app is opened as a static file or the Vercel function is not deployed yet. Deploy the project and set OPENROUTER_API_KEY, then try again.",
            "You can still preview the full UI with sample data below."
          );
        } else if (err.notDeployed) {
          renderError(
            "Backend not found",
            "The /api/generate endpoint is not reachable — the project isn't deployed to Vercel yet (or you are previewing the static files only).",
            "Deploy the repo to Vercel and set OPENROUTER_API_KEY. You can preview the full UI with sample data below."
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
    renderHistory();
  }

  function renderHistory() {
    var list = loadHistory();
    if (!list.length) {
      historyList.innerHTML =
        '<div class="history-empty">No generations yet — your saved campaigns will appear here, stored privately on this device.</div>';
      return;
    }
    historyList.innerHTML = list.map(function (item) {
      return (
        '<div class="history-item" data-id="' + esc(item.id) + '">' +
          '<div class="history-main">' +
            '<div class="history-niche">' + esc(item.niche) + "</div>" +
            '<div class="history-meta">' +
              '<span class="chip">' + esc(LANG_LABELS[item.language] || item.language) + "</span>" +
              '<span class="chip">' + esc(item.platform || "") + "</span>" +
              '<span class="chip">' + esc(item.duration || "") + "</span>" +
              '<span class="history-time">' + esc(timeAgo(item.createdAt)) + "</span>" +
            "</div>" +
          "</div>" +
          '<span class="history-score">' + esc(item.data && item.data.viralityScore) + "/99</span>" +
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
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("Loaded from history");
  }

  function reloadHistoryItem(id) {
    var item = findHistoryItem(id);
    if (!item) return;
    nicheInput.value = item.niche || "";
    if (item.language) setLanguage(item.language);
    if (item.platform && platformSelect.querySelector('option[value="' + item.platform + '"]')) {
      platformSelect.value = item.platform;
    }
    if (item.duration && durationSelect.querySelector('option[value="' + item.duration + '"]')) {
      durationSelect.value = item.duration;
    }
    if (item.tone && toneSelect.querySelector('option[value="' + item.tone + '"]')) {
      toneSelect.value = item.tone;
    }
    updateCharCount();
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("Regenerating with saved inputs…");
    generate();
  }

  function discardHistoryItem(id) {
    var list = loadHistory().filter(function (item) { return item.id !== id; });
    saveHistory(list);
    renderHistory();
    toast("Removed from history");
  }

  function clearHistory() {
    saveHistory([]);
    renderHistory();
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

    generateBtn.addEventListener("click", generate);
    copyAllBtn.addEventListener("click", function () {
      handleCopy(copyAllBtn, "all");
    });
    clearHistoryBtn.addEventListener("click", clearHistory);

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

    // Keyboard shortcut: Ctrl/Cmd + Enter triggers generation.
    nicheInput.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        generate();
      }
    });

    updateCharCount();
    renderHistory();
  }

  // Boot when the DOM is ready (script is loaded at end of body anyway).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
