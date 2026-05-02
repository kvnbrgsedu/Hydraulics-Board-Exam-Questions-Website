const DATA_URL = "assets/data/questions.json";
const TERMS_CONCEPTS_URL = "assets/data/terms-concepts.json";
const FORMULA_SIDEBAR_URL = "assets/data/formula.json";

/** Resolve asset path so images work on GitHub Pages (site may be at /repo-name/) and locally */
function getAssetUrl(path) {
  if (!path) return path;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("//")) return path;
  const base = window.location.pathname.replace(/\/[^/]*$/, "") || "/";
  const basePath = base.endsWith("/") ? base : base + "/";
  return basePath + path.replace(/^\//, "");
}

// Canonical topic list: must match the "topic" field in questions.json for filtering
const ALL_TOPICS = [
  "Fluid Properties",
  "Pressure",
  "Dams",
  "Plane Gates",
  "Curved Gates",
  "Buoyancy",
  "Stability of Floating Bodies",
  "Rectilinear Translation",
  "Rotating Vessels",
  "Fundamentals of Fluid Flow",
  "Orifice",
  "Pipes",
  "Reservoir",
  "Open Channels",
  "Hydrodynamics"
];

const state = {
  year: "choose",
  batch: "all",
  topic: "choose",
  data: [],
  hierarchy: [],
  termsConcepts: {
    terms: [],
    concepts: [],
  },
  termsFilterMode: "all",
};

const formulaSidebarState = {
  topics: [],
  query: "",
  expandedTopics: new Set(),
  open: false,
  collapsed: false,
  favorites: new Set(),
  recent: [],
};

const grid = document.getElementById("question-grid");
const yearSelect = document.getElementById("year-select");
const batchSelect = document.getElementById("batch-select");
const topicSelect = document.getElementById("topic-select");
const resultsInfo = document.getElementById("results-info");
const emptyState = document.getElementById("empty-state");
const activeChips = document.getElementById("active-chips");
const clearFilters = document.getElementById("clear-filters");
const backToTop = document.getElementById("back-to-top");
const progressBar = document.getElementById("progress-bar");
const sidebar = document.getElementById("sidebar");
const hamburger = document.getElementById("hamburger");
const pinToggle = document.getElementById("pin-toggle");
const hideSidebarButton = document.getElementById("hide-sidebar");
const startTopic = document.getElementById("start-topic");
const startYear = document.getElementById("start-year");
const startReviewCards = document.querySelectorAll("[data-select-group]");
const termsFilter = document.getElementById("terms-filter");
const termsGrid = document.getElementById("terms-grid");
const conceptsGrid = document.getElementById("concepts-grid");
const termsSection = document.getElementById("terms-section");
const conceptsSection = document.getElementById("concepts-section");
const termsEmpty = document.getElementById("terms-empty");
const topNav = document.getElementById("top-nav");
const darkModeToggle = document.getElementById("dark-mode-toggle");
const navMenuBtn = document.getElementById("nav-menu-btn");
const navDrawer = document.getElementById("nav-drawer");
const navDrawerBackdrop = document.getElementById("nav-drawer-backdrop");

const DARK_MODE_STORAGE_KEY = "hydraulics-theme";
const FORMULA_FAVORITES_KEY = "formula-sidebar-favorites";
const FORMULA_RECENT_KEY = "formula-sidebar-recent";

const setDarkMode = (enabled) => {
  const root = document.documentElement;
  if (enabled) {
    root.setAttribute("data-theme", "dark");
    try { localStorage.setItem(DARK_MODE_STORAGE_KEY, "dark"); } catch (e) {}
  } else {
    root.removeAttribute("data-theme");
    try { localStorage.setItem(DARK_MODE_STORAGE_KEY, "light"); } catch (e) {}
  }
};

const toggleDarkMode = () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  setDarkMode(!isDark);
};

const syncHeaderSpacing = () => {
  if (!topNav) return;
  const headerHeight = Math.ceil(topNav.getBoundingClientRect().height);
  document.body.style.paddingTop = `${headerHeight}px`;
  document.documentElement.style.setProperty("--top-nav-height", `${headerHeight}px`);
};

const scrollToQuestionsSection = (behavior = "smooth") => {
  const questionsSection = document.getElementById("questions");
  if (!questionsSection) return;
  // Body already has top padding equal to fixed-header height via syncHeaderSpacing(),
  // so do not subtract header height again (that leaves part of home/hero visible).
  const targetTop = Math.max(
    0,
    Math.round(window.scrollY + questionsSection.getBoundingClientRect().top)
  );

  window.scrollTo({ top: targetTop, behavior });

  // Second-pass snap after transitions/layout settle so we land exactly at questions.
  setTimeout(() => {
    const exactTop = Math.max(
      0,
      Math.round(window.scrollY + questionsSection.getBoundingClientRect().top)
    );
    window.scrollTo({ top: exactTop, behavior: "auto" });
  }, 420);
};

const yearRange = Array.from({ length: 15 }, (_, i) => 2011 + i);
const SIDEBAR_PIN_KEY = "sidebarPinned";
const BATCH_STATE_KEY = "batchState";
let isPinned = false;

const isDesktop = () => window.matchMedia("(min-width: 1025px)").matches;
const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

const addListener = (element, eventName, handler) => {
  if (element) {
    element.addEventListener(eventName, handler);
  }
};

const setSidebarOpen = (open) => {
  if (!sidebar && !hamburger) {
    // Sidebar removed from markup — still toggle body state for compatibility
    document.body.classList.toggle("sidebar-open", open);
    return;
  }
  if (sidebar) sidebar.classList.toggle("open", open);
  if (hamburger) hamburger.classList.toggle("open", open);
  document.body.classList.toggle("sidebar-open", open);
  if (hamburger) hamburger.setAttribute("aria-expanded", open ? "true" : "false");
};

const loadPinnedPreference = () => false;

const syncPinToggle = () => {
  if (!pinToggle) return;
  pinToggle.checked = isPinned;
  pinToggle.disabled = !isDesktop();
};

const closeSidebarIfAutoHide = () => {};

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (match) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[match];
  });

// Allow safe HTML from JSON (admin-controlled content): bold, strong, br, lists, tables, and newlines
const allowBasicTags = (html) =>
  html
    .replace(/\n/g, "<br>")
    .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
    .replace(/&lt;b&gt;/gi, "<b>")
    .replace(/&lt;\/b&gt;/gi, "</b>")
    .replace(/&lt;p&gt;/gi, "<p>")
    .replace(/&lt;\/p&gt;/gi, "</p>")
    .replace(/&lt;ul&gt;/gi, "<ul>")
    .replace(/&lt;\/ul&gt;/gi, "</ul>")
    .replace(/&lt;ol&gt;/gi, "<ol>")
    .replace(/&lt;\/ol&gt;/gi, "</ol>")
    .replace(/&lt;li&gt;/gi, "<li>")
    .replace(/&lt;\/li&gt;/gi, "</li>")
    .replace(/&lt;strong&gt;/gi, "<strong>")
    .replace(/&lt;\/strong&gt;/gi, "</strong>")
    .replace(/&lt;em&gt;/gi, "<em>")
    .replace(/&lt;\/em&gt;/gi, "</em>")
    .replace(/&lt;sup&gt;/gi, "<sup>")
    .replace(/&lt;\/sup&gt;/gi, "</sup>")
    .replace(/&lt;sub&gt;/gi, "<sub>")
    .replace(/&lt;\/sub&gt;/gi, "</sub>")
    // Table elements (with optional style attribute) so reservoir/data tables render
    .replace(/&lt;(table|th|td)\s+style=&quot;([^&]*)&quot;&gt;/gi, "<$1 style=\"$2\">")
    .replace(/&lt;(thead|tbody|tr)&gt;/gi, "<$1>")
    .replace(/&lt;\/(table|thead|tbody|tr|th|td)&gt;/gi, "</$1>");

const buildHighlights = (text, query) => {
  if (!query.trim()) return allowBasicTags(escapeHtml(text));
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return allowBasicTags(escapeHtml(text));
  const regex = new RegExp(`(${terms.join("|")})`, "gi");
  const safeText = allowBasicTags(escapeHtml(text));

  // Avoid inserting <mark> inside MathJax delimiters since it can break rendering.
  // We only highlight non-math segments.
  const mathSegmentRegex =
    /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?:\\.|[^$\\])+\$)/g;

  const parts = safeText.split(mathSegmentRegex);
  return parts
    .map((part, idx) => {
      // Odd indexes are captured math segments due to split with capturing group.
      if (idx % 2 === 1) return part;
      return part.replace(regex, "<mark>$1</mark>");
    })
    .join("");
};

/**
 * Insert a horizontal divider between the problem statement and a numbered list (1., 2., 3.)
 * when the question uses the common "<br><br>1." format.
 */
const addQuestionDivider = (questionHtml) => {
  if (!questionHtml || typeof questionHtml !== "string") return questionHtml;
  // Only add once: before the first "1." that starts a numbered section.
  return questionHtml.replace(
    /<br\s*\/?>\s*<br\s*\/?>\s*(?=1\.)/i,
    `<br><hr class="question-divider"><br>`
  );
};

/**
 * Wrap numbered solution parts (1., 2., 3., ...) into separate containers.
 * This is purely presentational and preserves all existing text and LaTeX.
 */
const wrapNumberedSolutionSteps = (solutionBodyHtml) => {
  if (!solutionBodyHtml || typeof solutionBodyHtml !== "string") return solutionBodyHtml;

  const html = solutionBodyHtml.trim();
  const splitBr = (s) => String(s || "").split(/<br\s*\/?>/i);
  const stripTags = (s) => String(s || "").replace(/<[^>]*>/g, "");
  const trimLine = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const isMeaningful = (s) => !!trimLine(stripTags(s));
  const looksLikeAnswer = (s) => {
    const t = trimLine(stripTags(s));
    if (!t) return false;
    // Many final answers end with '=' line, or units, or "hp/kPa/m/s" etc.
    return t.includes("=") || /\\text\{|kPa|hp|m\^3|m\/s|kg|N|Pa\b|ft\b|psi\b/i.test(t);
  };
  const boxLastAnswerLine = (bodyHtml) => {
    const parts = splitBr(bodyHtml);
    // Find last meaningful line; prefer one that looks like an answer.
    let idx = -1;
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (!isMeaningful(parts[i])) continue;
      idx = i;
      if (looksLikeAnswer(parts[i])) break;
    }
    if (idx < 0) return bodyHtml;
    const line = parts[idx].trim();
    if (!line) return bodyHtml;
    if (/solution-card__final-answer\b/.test(line)) return bodyHtml; // avoid double boxing
    const alreadyStrong = /<\s*strong\b/i.test(line);
    const content = alreadyStrong ? line : `<strong>${line}</strong>`;
    const boxed = `<div class="solution-card__final-answer solution-card__final-answer--inline"><div class="solution-card__final-answer-content">${content}</div></div>`;
    parts[idx] = boxed;
    return parts.join("<br>");
  };

  // Detect presence of at least a "1." step near a line break or start.
  if (!/(^|<br\s*\/?>\s*<br\s*\/?>|<br\s*\/?>)\s*1\.\s*/i.test(html)) {
    // Single-answer (non-numbered) solutions: box the last meaningful line too.
    return boxLastAnswerLine(solutionBodyHtml);
  }

  const stepRegex = /(^|<br\s*\/?>\s*<br\s*\/?>|<br\s*\/?>)\s*(\d+)\.\s*/gi;
  const matches = Array.from(html.matchAll(stepRegex));
  if (!matches.length) return boxLastAnswerLine(solutionBodyHtml);

  const steps = [];
  let prefix = html.slice(0, matches[0].index || 0).trim();

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const stepNum = m[2];
    const start = (m.index || 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index || html.length) : html.length;
    const body = html.slice(start, end).trim();
    steps.push({ stepNum, body: boxLastAnswerLine(body) });
  }

  const prefixBlock = prefix
    ? `<div class="solution-step solution-step--prefix"><div class="solution-step__body">${prefix}</div></div>`
    : "";

  const stepBlocks = steps
    .map(
      (s) => `<div class="solution-step">
        <div class="solution-step__title"><span class="solution-step__num">${s.stepNum}.</span></div>
        <div class="solution-step__body">${s.body}</div>
      </div>`
    )
    .join("");

  return `<div class="solution-steps">${prefixBlock}${stepBlocks}</div>`;
};

/**
 * Parse solution HTML into Given, Required, and Solution sections.
 * Content and LaTeX are preserved exactly; only structure is detected for layout.
 */
const parseSolutionSections = (solutionHtml) => {
  if (!solutionHtml || typeof solutionHtml !== "string") {
    return { given: "", required: "", solutionBody: solutionHtml || "" };
  }
  const s = solutionHtml;
  const givenLabel = /<strong>Given:<\/strong>\s*/i;
  const requiredLabel = /<strong>Required:<\/strong>\s*/i;
  const solutionLabel = /<strong>Solution:<\/strong>\s*/i;

  let given = "";
  let required = "";
  let solutionBody = s;

  const hasGiven = givenLabel.test(s);
  const hasRequired = requiredLabel.test(s);
  const hasSolution = solutionLabel.test(s);

  if (hasGiven) {
    const afterGiven = s.replace(givenLabel, "\x00").split("\x00")[1] || "";
    if (hasRequired) {
      const parts = afterGiven.split(requiredLabel);
      given = (parts[0] || "").replace(/<br\s*\/?>\s*$/i, "").trim();
      const afterRequired = (parts[1] || "").trim();
      if (hasSolution) {
        const solParts = afterRequired.split(solutionLabel);
        required = (solParts[0] || "").replace(/<br\s*\/?>\s*$/i, "").trim();
        solutionBody = (solParts[1] || "").trim();
      } else {
        required = afterRequired;
        solutionBody = "";
      }
    } else {
      if (hasSolution) {
        const parts = afterGiven.split(solutionLabel);
        given = (parts[0] || "").replace(/<br\s*\/?>\s*$/i, "").trim();
        solutionBody = (parts[1] || "").trim();
      } else {
        given = afterGiven.replace(/<br\s*\/?>\s*$/i, "").trim();
        solutionBody = "";
      }
    }
  } else if (hasRequired) {
    const afterRequired = s.replace(requiredLabel, "\x00").split("\x00")[1] || "";
    if (hasSolution) {
      const parts = afterRequired.split(solutionLabel);
      required = (parts[0] || "").replace(/<br\s*\/?>\s*$/i, "").trim();
      solutionBody = (parts[1] || "").trim();
    } else {
      required = afterRequired.replace(/<br\s*\/?>\s*$/i, "").trim();
      solutionBody = "";
    }
  } else if (hasSolution) {
    const parts = s.split(solutionLabel);
    solutionBody = (parts[1] || parts[0] || "").trim();
  }

  /** Turn br-separated block into bullet list HTML; content unchanged. */
  const toBulletList = (block) => {
    if (!block) return "";
    const items = block
      .split(/<br\s*\/?>/i)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!items.length) return "";
    return "<ul class=\"solution-list\">" + items.map((item) => "<li>" + item + "</li>").join("") + "</ul>";
  };

  const givenList = toBulletList(given);
  const requiredList = toBulletList(required);
  return {
    given: givenList,
    required: requiredList,
    solutionBody: solutionBody,
    hasGiven: !!givenList,
    hasRequired: !!requiredList,
  };
};

let mathTypesetRetryCount = 0;
let mathTypesetScheduled = false;
const pendingMathTargets = new Set();
const markMathTypeset = (target) => {
  if (!target || !(target instanceof Element)) return;
  target.setAttribute("data-math-typeset", "1");
};
const queueMathTypeset = (target) => {
  if (!target || !(target instanceof Element)) return;
  if (target.getAttribute("data-math-typeset") === "1") return;
  pendingMathTargets.add(target);
  scheduleMathTypeset();
};
const typesetMath = (targets = []) => {
  const validTargets = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
  // If MathJax v3 with typesetPromise is available, type only specific nodes.
  if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
    window.MathJax.typesetPromise(validTargets.length ? validTargets : undefined)
      .then(() => {
        mathTypesetRetryCount = 0;
        validTargets.forEach(markMathTypeset);
      })
      .catch(() => {});
    return;
  }
  // Fallback for environments where only MathJax.typeset exists.
  if (window.MathJax && typeof window.MathJax.typeset === "function") {
    try {
      if (validTargets.length) window.MathJax.typeset(validTargets);
      else window.MathJax.typeset();
      mathTypesetRetryCount = 0;
      validTargets.forEach(markMathTypeset);
      return;
    } catch (e) {}
  }
  // If MathJax is not yet ready, retry briefly.
  if (mathTypesetRetryCount < 40) {
    mathTypesetRetryCount += 1;
    setTimeout(scheduleMathTypeset, 250);
  }
};
const flushMathTypesetQueue = () => {
  mathTypesetScheduled = false;
  if (!pendingMathTargets.size) return;
  const targets = Array.from(pendingMathTargets).filter(
    (target) => target && target.isConnected && target.getAttribute("data-math-typeset") !== "1"
  );
  pendingMathTargets.clear();
  if (!targets.length) return;
  typesetMath(targets);
};
const scheduleMathTypeset = () => {
  if (mathTypesetScheduled) return;
  mathTypesetScheduled = true;
  requestAnimationFrame(() => {
    setTimeout(flushMathTypesetQueue, 0);
  });
};
const mathObserver =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            queueMathTypeset(entry.target);
            mathObserver.unobserve(entry.target);
          });
        },
        { rootMargin: "220px 0px", threshold: 0.01 }
      )
    : null;
const observeMathIn = (container) => {
  if (!container) return;
  const candidates = container.querySelectorAll(".card, .solution-content, .formula-card__math");
  candidates.forEach((candidate) => {
    if (candidate.getAttribute("data-math-observed") === "1") return;
    candidate.setAttribute("data-math-observed", "1");
    if (mathObserver) mathObserver.observe(candidate);
    else queueMathTypeset(candidate);
  });
};

const observer =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2 }
      )
    : null;

const renderSkeletons = () => {
  if (!grid) return;
  grid.innerHTML = "";
  for (let i = 0; i < 6; i += 1) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="skeleton"></div>`;
    grid.appendChild(card);
  }
};

const renderFilters = () => {
  // Build year lists from loaded data
  const allYears = Array.from(new Set((state.data || []).map((item) => item.year))).filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b));

  // Ensure home selects exist - use ALL_TOPICS so dropdown matches questions.json topic values
  if (startTopic) {
    // Populate home (start) topic select from canonical list (same as in questions data)
    startTopic.innerHTML =
      `<option value="choose">Choose Topic</option>` +
      `<option value="none">None</option>` +
      `<option value="all">All Topics</option>` +
      ALL_TOPICS.map((topic) => `<option value="${topic}">${topic}</option>`).join("");

    // Set to "choose" if no selection, otherwise use state value
    if (state.topic === "all" || state.topic === "choose" || !state.topic) {
      startTopic.value = state.topic === "all" ? "all" : "choose";
    } else {
      startTopic.value = state.topic;
    }
  }

  if (startYear) {
    // Populate home (start) year select
    startYear.innerHTML =
      `<option value="choose">Choose Year</option>` +
      `<option value="none">None</option>` +
      `<option value="all">All Years</option>` +
      (allYears.length ? allYears.map((year) => `<option value="${year}">${year}</option>`).join("") : yearRange.map((year) => `<option value="${year}">${year}</option>`).join(""));

    // Set to "choose" if no selection, otherwise use state value
    if (state.year === "all" || state.year === "choose" || !state.year) {
      startYear.value = state.year === "all" ? "all" : "choose";
    } else {
      startYear.value = state.year;
    }
  }

  // Populate sidebar selects if present (optional)
  if (yearSelect) {
    yearSelect.innerHTML = '<option value="all">All Years</option>' +
      (allYears.length ? allYears.map((y) => `<option value="${y}">${y}</option>`).join("") : yearRange.map((y) => `<option value="${y}">${y}</option>`).join(""));
  }

  if (batchSelect) {
    const batches = Array.from(new Set((state.data || []).map((item) => item.batch))).sort();
    batchSelect.innerHTML = `<option value="all">All Batches</option>` + batches.map((b) => `<option value="${b}">${b}</option>`).join("");
  }

  if (topicSelect) {
    topicSelect.innerHTML = `<option value="all">All Topics</option>` + ALL_TOPICS.map((t) => `<option value="${t}">${t}</option>`).join("");
  }
};

const updateActiveChips = () => {
  const chips = [];
  if (state.year !== "all" && state.year !== "choose") chips.push(`Year: ${state.year}`);
  if (state.batch !== "all") chips.push(`Batch: ${state.batch}`);
  if (state.topic !== "all" && state.topic !== "choose") chips.push(`Topic: ${state.topic}`);

  activeChips.innerHTML = chips
    .map((chip) => `<span class="chip">${chip}</span>`)
    .join("");
};

const filterData = () => {
  if (!state.data || !Array.isArray(state.data)) {
    console.warn("filterData: No data available");
    return [];
  }
  
  // CRITICAL: Always check dropdowns first to get the most current values
  const topicValue = startTopic ? startTopic.value : state.topic;
  const yearValue = startYear ? startYear.value : state.year;
  
  // Sync state from dropdowns (dropdowns are source of truth)
  if (topicValue === "all") {
    state.topic = "all";
  } else if (topicValue === "choose" || topicValue === "none") {
    state.topic = topicValue;
  } else if (topicValue) {
    state.topic = topicValue;
  }
  
  if (yearValue === "all") {
    state.year = "all";
  } else if (yearValue === "choose" || yearValue === "none") {
    state.year = yearValue;
  } else if (yearValue) {
    state.year = yearValue;
  }
  
  // If no valid selection, return empty array (show nothing)
  if ((state.topic === "choose" || state.topic === "none") && 
      (state.year === "choose" || state.year === "none")) {
    console.log("filterData: No selection made, returning empty array");
    return [];
  }
  
  // If both topic and year are "all", return all items
  if (state.topic === "all" && state.year === "all" && state.batch === "all") {
    console.log("filterData: Returning all", state.data.length, "items (both filters are 'all')");
    return state.data;
  }
  
  // Filter based on selections
  const filtered = state.data.filter((item) => {
    if (!item) return false;
    
    // Year matching
    let matchesYear = false;
    if (state.year === "all") {
      matchesYear = true;
    } else if (state.year === "choose" || state.year === "none") {
      matchesYear = true; // No year filter applied
    } else {
      matchesYear = String(item.year) === String(state.year);
    }
    
    // Topic matching
    let matchesTopic = false;
    if (state.topic === "all") {
      matchesTopic = true;
    } else if (state.topic === "choose" || state.topic === "none") {
      matchesTopic = true; // No topic filter applied
    } else {
      matchesTopic = String(item.topic) === String(state.topic);
    }
    
    // Batch matching
    const matchesBatch = state.batch === "all" ? true : String(item.batch) === String(state.batch);
    
    return matchesYear && matchesTopic && matchesBatch;
  });
  
  console.log("filterData: Filtered", filtered.length, "items from", state.data.length, "total (topic:", state.topic, "year:", state.year, ")");
  return filtered;
};

const buildHierarchy = (items) => {
  const map = {};
  (items || []).forEach((item) => {
    if (!item) return;
    const year = String(item.year || "Unknown").trim() || "Unknown";
    const topic = String(item.topic || "Uncategorized").trim() || "Uncategorized";
    if (!map[year]) {
      map[year] = { year, topics: {} };
    }
    if (!map[year].topics[topic]) {
      map[year].topics[topic] = { topic, questions: [] };
    }
    map[year].topics[topic].questions.push(item);
  });

  return Object.values(map)
    .sort((a, b) => {
      const yearA = parseInt(a.year, 10);
      const yearB = parseInt(b.year, 10);
      if (isNaN(yearA) || isNaN(yearB)) return a.year.localeCompare(b.year);
      return yearA - yearB;
    })
    .map((yearEntry) => ({
      year: yearEntry.year,
      topics: Object.values(yearEntry.topics).sort((a, b) =>
        a.topic.localeCompare(b.topic)
      ),
    }));
};

const buildCardHtml = (item, index = 0) => {
  const question = addQuestionDivider(allowBasicTags(escapeHtml(item.question || "")));
  const solution = item.solution;
  const yearTag = `${item.year} - ${item.batch}`;
  const safeYearTag = allowBasicTags(escapeHtml(yearTag));
  const safeTopic = allowBasicTags(escapeHtml(item.topic || ""));
  const questionImage = item.image
    ? `<div class="question-image-section">
         <img src="${getAssetUrl(item.image)}" alt="Question image" loading="lazy" />
         ${item.imageCaption ? `<span class="image-caption">${item.imageCaption}</span>` : ""}
       </div>`
    : "";

  const sections = parseSolutionSections(solution);

  // Special handling for Situation 28 with multiple solution images (insert into solution body)
  if (item.solutionImages && Array.isArray(item.solutionImages) && item.solutionImages.length > 0) {
    const imageTags = item.solutionImages.map((img, idx) =>
      `<div class="solution-image-section">
         <img src="${getAssetUrl(img)}" alt="Solution image ${idx + 1}" loading="lazy" />
       </div>`
    );
    for (let i = imageTags.length; i >= 1; i--) {
      const pattern = new RegExp(`(${i}\\.\\s)`, "g");
      sections.solutionBody = sections.solutionBody.replace(pattern, (match, numPart) => numPart + imageTags[i - 1]);
    }
  }

  const solutionImageContainer =
    item.solutionImage && (!item.solutionImages || !item.solutionImages.length)
      ? `<div class="solution-card__image-wrap">
           <div class="solution-image-section">
             <img src="${getAssetUrl(item.solutionImage)}" alt="Solution image" loading="lazy" />
             ${item.solutionImageCaption ? `<span class="image-caption">${item.solutionImageCaption}</span>` : ""}
           </div>
         </div>`
      : "";

  const givenRequiredRow =
    sections.hasGiven || sections.hasRequired
      ? `<div class="solution-card__given-required">
           <div class="solution-card__given-card">
             <div class="solution-card__section-title">Given</div>
             <div class="solution-card__section-body">${sections.hasGiven ? sections.given : "<ul class=\"solution-list\"><li>—</li></ul>"}</div>
           </div>
           <div class="solution-card__required-card">
             <div class="solution-card__section-title">Required</div>
             <div class="solution-card__section-body">${sections.hasRequired ? sections.required : "<ul class=\"solution-list\"><li>—</li></ul>"}</div>
           </div>
         </div>`
      : "";

  const solutionSectionBlock = sections.solutionBody
    ? `<div class="solution-card__solution-wrap">
         <div class="solution-card__solution-title">Solution</div>
         <div class="solution-section solution-content">${wrapNumberedSolutionSteps(sections.solutionBody)}</div>
       </div>`
    : "";

  return `
    <article class="card question-card" style="--stagger: ${index * 40}ms;">
      <div class="card__header">
        <span>${safeTopic}</span>
      </div>
      <div class="tags">
        <span class="tag" data-year="${item.year}" data-batch="${item.batch}">${safeYearTag}</span>
        <span class="tag" data-topic="${item.topic}">${safeTopic}</span>
      </div>
      <div class="question-content card__question">${question}</div>
      ${questionImage}
      <button type="button" class="btn btn--primary solution-toggle" aria-expanded="false">Show Answer</button>
      <div class="solution">
        <div class="solution-card">
          ${givenRequiredRow}
          ${solutionImageContainer}
          <div class="solution-card__solution-panel">
            ${solutionSectionBlock}
          </div>
        </div>
      </div>
    </article>
  `;
};

const renderTimeline = (items) => {
  resetGridViewClasses();
  grid.classList.add("timeline");
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.year]) acc[item.year] = {};
    if (!acc[item.year][item.batch]) acc[item.year][item.batch] = [];
    acc[item.year][item.batch].push(item);
    return acc;
  }, {});

  const years = Object.keys(grouped).sort();
  const batchOrder = ["April", "November"];
  let timelineIndex = 0;
  grid.innerHTML = years
    .map((year) => {
      const batches = grouped[year];
      const batchSections = batchOrder
        .filter((batch) => batches[batch])
        .map((batch) => {
          const count = batches[batch].length;
          return `
            <div class="batch-section">
              <div class="batch-header">
                <span>${batch} Board Exam</span>
                <span class="batch-meta">${count} questions</span>
              </div>
              <div class="batch-content open">
                <div class="year-grid grid">
                  ${batches[batch]
                    .map((item) => buildCardHtml(item, timelineIndex++))
                    .join("")}
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <section class="year-section">
          <div class="year-header reveal">
            <span class="year-badge">${year}</span>
            <div class="year-line"></div>
          </div>
          ${batchSections}
        </section>
      `;
    })
    .join("");
};

const resetGridViewClasses = () => {
  if (!grid) return;
  grid.classList.remove(
    "grid",
    "timeline",
    "hierarchical-view",
    "topic-only-view",
    "year-only-view",
    "full-hierarchy-view",
    "single-topic-view",
    "single-year-view",
    "topics-in-year-view",
    "years-with-topic-view",
    "topic-year-view"
  );
};

const renderGrid = (items) => {
  resetGridViewClasses();
  grid.classList.add("grid");
  const CHUNK_SIZE = 36;
  if (!Array.isArray(items) || items.length <= CHUNK_SIZE) {
    grid.innerHTML = (items || []).map((item, index) => buildCardHtml(item, index)).join("");
    return;
  }
  // Progressive chunk rendering prevents long main-thread stalls on large lists.
  grid.innerHTML = "";
  let index = 0;
  const appendChunk = () => {
    const end = Math.min(index + CHUNK_SIZE, items.length);
    const fragment = document.createDocumentFragment();
    for (let i = index; i < end; i += 1) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildCardHtml(items[i], i);
      if (wrapper.firstElementChild) fragment.appendChild(wrapper.firstElementChild);
    }
    grid.appendChild(fragment);
    observeMathIn(grid);
    index = end;
    if (index < items.length) {
      requestAnimationFrame(appendChunk);
    }
  };
  appendChunk();
};

// Helper function to add animation delay to card HTML
const addCardAnimation = (cardHtml, delay, qIndex) => {
  if (cardHtml.includes('style="')) {
    return cardHtml.replace(
      /style="[^"]*"/,
      `style="--question-index: ${qIndex}; animation-delay: ${delay}ms;"`
    );
  } else {
    return cardHtml.replace(
      'class="card',
      `style="--question-index: ${qIndex}; animation-delay: ${delay}ms;" class="card`
    );
  }
};

// 1. Topic-Only View: "All Topics" selected + No Year Selected
// Shows all questions grouped by topic, with topic headers only (no year headers)
const renderTopicOnlyView = (items) => {
  resetGridViewClasses();
  grid.classList.add("hierarchical-view", "topic-only-view");
  
  const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  
  if (items.length === 0) {
    grid.innerHTML = "";
    return;
  }
  
  // Group by topic only - NO year grouping
  const grouped = items.reduce((acc, item) => {
    if (!item || !item.topic) return acc;
    const topic = item.topic;
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(item);
    return acc;
  }, {});

  // Sort topics in a logical order (alphabetically for consistency)
  const topics = Object.keys(grouped).sort();
  let questionIndex = 0;

  grid.innerHTML = topics
    .map((topic, topicIndex) => {
      const questions = grouped[topic];
      const count = questions.length;
      const topicDelay = topicIndex * 80 + 150;
      
      return `
        <section class="topic-section primary-section" style="--delay: ${topicDelay}ms">
          <div class="topic-header primary-header">
            <span class="topic-label">${escapeHtml(topic)}</span>
            <span class="topic-meta">${count} question${count === 1 ? "" : "s"}</span>
          </div>
          <div class="topic-content">
            <div class="questions-list">
              ${questions
                .map((item, qIndex) => {
                  const cardHtml = buildCardHtml(item, questionIndex++);
                  const questionDelay = topicDelay + qIndex * 30;
                  return addCardAnimation(cardHtml, questionDelay, qIndex);
                })
                .join("")}
            </div>
          </div>
        </section>
      `;
    })
    .join("");

  animateSections();
  restoreScrollPosition(scrollPosition);
};

// 2. Year-Only View: "All Years" selected (no topic headers) - Show year header then ALL questions from that year
const renderYearOnlyView = (items) => {
  if (!grid) return;
  resetGridViewClasses();
  grid.classList.add("hierarchical-view", "year-only-view");
  
  const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  
  // If no items, show empty state
  if (!items || items.length === 0) {
    grid.innerHTML = "";
    return;
  }
  
  // Group by year only - ensure ALL questions are included
  const grouped = items.reduce((acc, item) => {
    if (!item) return acc;
    const year = String(item.year || "").trim();
    if (!year) return acc; // Skip items without year
    if (!acc[year]) acc[year] = [];
    acc[year].push(item);
    return acc;
  }, {});

  const years = Object.keys(grouped).sort((a, b) => {
    const yearA = parseInt(a);
    const yearB = parseInt(b);
    if (isNaN(yearA) || isNaN(yearB)) return a.localeCompare(b);
    return yearA - yearB;
  });
  
  // If no years after grouping, show empty
  if (years.length === 0) {
    grid.innerHTML = "";
    return;
  }
  
  let questionIndex = 0;
  let totalQuestions = 0;

  grid.innerHTML = years
    .map((year, yearIndex) => {
      const questions = grouped[year];
      if (!questions || questions.length === 0) return "";
      
      const count = questions.length;
      totalQuestions += count;
      const yearDelay = yearIndex * 120 + 150;
      
      return `
        <section class="year-section hierarchical-year primary-section" data-year="${escapeHtml(year)}" style="--year-index: ${yearIndex}">
          <div class="year-header hierarchical-year-header primary-header reveal">
            <button class="year-toggle" aria-expanded="true" aria-label="Toggle ${escapeHtml(year)} questions">
              <span class="year-badge">${escapeHtml(year)}</span>
              <span class="year-toggle-icon">⌄</span>
            </button>
            <div class="year-line"></div>
          </div>
          <div class="year-content open">
            <div class="questions-grid">
              ${questions
                .map((item, qIndex) => {
                  if (!item) return "";
                  const cardHtml = buildCardHtml(item, questionIndex++);
                  const questionDelay = yearDelay + qIndex * 30;
                  return addCardAnimation(cardHtml, questionDelay, qIndex);
                })
                .filter(html => html) // Remove empty strings
                .join("")}
            </div>
          </div>
        </section>
      `;
    })
    .filter(html => html) // Remove empty year sections
    .join("");

  // Verify we rendered something
  if (!grid.innerHTML.trim()) {
    grid.innerHTML = "";
    return;
  }


  initYearToggles();
  animateSections();
  restoreScrollPosition(scrollPosition);
};

// 3. Full Hierarchy View: Both "All Topics" AND "All Years" selected - Show BOTH year and topic headers
const renderFullHierarchyView = (items) => {
  if (!grid) {
    console.error("renderFullHierarchyView: grid element not found");
    return;
  }
  
  const hierarchyInput = Array.isArray(items) && items[0] && Array.isArray(items[0].topics);
  const hierarchy = hierarchyInput ? items : buildHierarchy(items);
  console.log("renderFullHierarchyView: Called with", hierarchyInput ? "hierarchy" : "items");
  
  resetGridViewClasses();
  grid.classList.add("hierarchical-view", "full-hierarchy-view");
  
  const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  
  // If no items, show empty state
  if (!hierarchy || hierarchy.length === 0) {
    console.warn("renderFullHierarchyView: No items to render");
    grid.innerHTML = "";
    return;
  }
  
  console.log("renderFullHierarchyView: Processing", hierarchy.length, "years");
  
  let questionIndex = 0;
  let totalQuestions = 0;

  // Build the HTML structure: Year (Primary) → Topic (Secondary) → Questions
  grid.innerHTML = hierarchy
    .map((yearEntry, yearIndex) => {
      const topics = yearEntry.topics || [];
      const yearQuestionCount = topics.reduce(
        (sum, t) => sum + (t.questions ? t.questions.length : 0),
        0
      );
      totalQuestions += yearQuestionCount;

      const topicSections = topics
        .map((topicEntry, topicIndex) => {
          const questions = topicEntry.questions || [];
          if (!questions.length) return "";
          const count = questions.length;
          const topicDelay = yearIndex * 120 + topicIndex * 80 + 150;
          return `
            <section class="topic-section secondary-section" style="--delay: ${topicDelay}ms">
              <div class="topic-header secondary-header">
                <span class="topic-label">${escapeHtml(topicEntry.topic)}</span>
                <span class="topic-meta">${count} question${count === 1 ? "" : "s"}</span>
              </div>
              <div class="topic-content">
                <div class="questions-list">
                  ${questions
                    .map((item, qIndex) => {
                      const cardHtml = buildCardHtml(item, questionIndex++);
                      const questionDelay = topicDelay + qIndex * 30;
                      return addCardAnimation(cardHtml, questionDelay, qIndex);
                    })
                    .join("")}
                </div>
              </div>
            </section>
          `;
        })
        .filter(Boolean)
        .join("");

      if (!topicSections.trim()) return "";

      return `
        <section class="year-section hierarchical-year primary-section" data-year="${escapeHtml(yearEntry.year)}" style="--year-index: ${yearIndex}">
          <div class="year-header hierarchical-year-header primary-header reveal">
            <button class="year-toggle" aria-expanded="true" aria-label="Toggle ${escapeHtml(yearEntry.year)} questions">
              <span class="year-badge">${escapeHtml(yearEntry.year)}</span>
              <span class="year-toggle-icon">⌄</span>
            </button>
            <div class="year-line"></div>
          </div>
          <div class="year-content open">
            ${topicSections}
          </div>
        </section>
      `;
    })
    .filter(Boolean)
    .join("");

  // Verify we rendered something
  if (!grid.innerHTML.trim()) {
    console.error("renderFullHierarchyView: No HTML generated despite having", items.length, "items and", years.length, "years");
    console.error("renderFullHierarchyView: Grouped data sample:", years.slice(0, 3).map(year => ({
      year,
      topics: Object.keys(grouped[year]),
      questionCount: Object.values(grouped[year]).reduce((sum, arr) => sum + arr.length, 0)
    })));
    grid.innerHTML = '<div class="empty-state-message">No questions found. Please check your filters.</div>';
    return;
  }
  
  console.log("renderFullHierarchyView: Successfully rendered", years.length, "years with", totalQuestions, "total questions");
  
  // Ensure grid is visible
  grid.style.display = "block";
  grid.style.visibility = "visible";
  grid.style.opacity = "1";
  
  // Immediately mark all topic sections as visible for full hierarchy view
  requestAnimationFrame(() => {
    const topicSections = grid.querySelectorAll('.topic-section');
    console.log("renderFullHierarchyView: Found", topicSections.length, "topic sections in DOM");
    topicSections.forEach(section => {
      section.classList.add('is-visible');
    });
    
    // Also ensure topic headers are visible
    const topicHeaders = grid.querySelectorAll('.topic-header');
    console.log("renderFullHierarchyView: Found", topicHeaders.length, "topic headers in DOM");
    topicHeaders.forEach(header => {
      header.style.display = 'flex';
      header.style.visibility = 'visible';
      header.style.opacity = '1';
    });
    
    // Ensure year headers are visible
    const yearHeaders = grid.querySelectorAll('.hierarchical-year-header');
    console.log("renderFullHierarchyView: Found", yearHeaders.length, "year headers in DOM");
    yearHeaders.forEach(header => {
      header.style.display = 'flex';
      header.style.visibility = 'visible';
      header.style.opacity = '1';
    });
  });
  
  initYearToggles();
  animateSections();
  restoreScrollPosition(scrollPosition);
};

// 4. Single Topic View: Specific topic selected
const renderSingleTopicView = (items) => {
  resetGridViewClasses();
  grid.classList.add("hierarchical-view", "single-topic-view");
  
  const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  
  if (items.length === 0) {
    grid.innerHTML = "";
    return;
  }

  const topic = items[0].topic;
  let questionIndex = 0;
  const topicDelay = 150;

  grid.innerHTML = `
    <section class="topic-section primary-section" style="--delay: ${topicDelay}ms">
      <div class="topic-header primary-header">
        <span class="topic-label">${topic}</span>
        <span class="topic-meta">${items.length} question${items.length === 1 ? "" : "s"}</span>
      </div>
      <div class="topic-content">
        <div class="questions-list">
          ${items
            .map((item, qIndex) => {
              const cardHtml = buildCardHtml(item, questionIndex++);
              const questionDelay = topicDelay + qIndex * 30;
              return addCardAnimation(cardHtml, questionDelay, qIndex);
            })
            .join("")}
        </div>
      </div>
    </section>
  `;

  animateSections();
  restoreScrollPosition(scrollPosition);
};

// 5. Single Year View: Specific year selected
const renderSingleYearView = (items) => {
  resetGridViewClasses();
  grid.classList.add("hierarchical-view", "single-year-view");
  
  const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  
  if (items.length === 0) {
    grid.innerHTML = "";
    return;
  }

  const year = items[0].year;
  let questionIndex = 0;
  const yearDelay = 150;

  grid.innerHTML = `
    <section class="year-section hierarchical-year primary-section" data-year="${year}" style="--year-index: 0">
      <div class="year-header hierarchical-year-header primary-header reveal">
        <button class="year-toggle" aria-expanded="true" aria-label="Toggle ${year} questions">
          <span class="year-badge">${year}</span>
          <span class="year-toggle-icon">⌄</span>
        </button>
        <div class="year-line"></div>
      </div>
      <div class="year-content open">
        <div class="questions-list">
          ${items
            .map((item, qIndex) => {
              const cardHtml = buildCardHtml(item, questionIndex++);
              const questionDelay = yearDelay + qIndex * 30;
              return addCardAnimation(cardHtml, questionDelay, qIndex);
            })
            .join("")}
        </div>
      </div>
    </section>
  `;

  initYearToggles();
  animateSections();
  restoreScrollPosition(scrollPosition);
};

// Render topics within a specific year (All Topics + Specific Year)
const renderTopicsInYearView = (items) => {
  resetGridViewClasses();
  grid.classList.add("hierarchical-view", "topics-in-year-view");
  
  const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  
  if (items.length === 0) {
    grid.innerHTML = "";
    return;
  }

  const year = items[0].year;
  
  // Group by topic within the year
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.topic]) acc[item.topic] = [];
    acc[item.topic].push(item);
    return acc;
  }, {});

  const topics = Object.keys(grouped).sort();
  let questionIndex = 0;
  const yearDelay = 150;

  grid.innerHTML = `
    <section class="year-section hierarchical-year primary-section" data-year="${year}" style="--year-index: 0">
      <div class="year-header hierarchical-year-header primary-header reveal">
        <button class="year-toggle" aria-expanded="true" aria-label="Toggle ${year} questions">
          <span class="year-badge">${year}</span>
          <span class="year-toggle-icon">⌄</span>
        </button>
        <div class="year-line"></div>
      </div>
      <div class="year-content open">
        ${topics
          .map((topic, topicIndex) => {
            const questions = grouped[topic];
            const count = questions.length;
            const topicDelay = yearDelay + topicIndex * 80;
            return `
              <section class="topic-section secondary-section" style="--delay: ${topicDelay}ms">
                <div class="topic-header secondary-header">
                  <span class="topic-label">${topic}</span>
                  <span class="topic-meta">${count} question${count === 1 ? "" : "s"}</span>
                </div>
                <div class="topic-content">
                  <div class="questions-list">
                    ${questions
                      .map((item, qIndex) => {
                        const cardHtml = buildCardHtml(item, questionIndex++);
                        const questionDelay = topicDelay + qIndex * 30;
                        return addCardAnimation(cardHtml, questionDelay, qIndex);
                      })
                      .join("")}
                  </div>
                </div>
              </section>
            `;
          })
          .join("")}
      </div>
    </section>
  `;

  restoreScrollPosition(scrollPosition);
  initYearToggles();
  animateSections();
};

// Render years with a specific topic (All Years + Specific Topic)
const renderYearsWithTopicView = (items) => {
  resetGridViewClasses();
  grid.classList.add("hierarchical-view", "years-with-topic-view");
  
  const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  
  if (items.length === 0) {
    grid.innerHTML = "";
    return;
  }

  const topic = items[0].topic;
  
  // Group by year
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.year]) acc[item.year] = [];
    acc[item.year].push(item);
    return acc;
  }, {});

  const years = Object.keys(grouped).sort((a, b) => parseInt(a) - parseInt(b));
  let questionIndex = 0;

  grid.innerHTML = years
    .map((year, yearIndex) => {
      const questions = grouped[year];
      const count = questions.length;
      const yearDelay = yearIndex * 120 + 150;
      
      return `
        <section class="year-section hierarchical-year primary-section" data-year="${year}" style="--year-index: ${yearIndex}">
          <div class="year-header hierarchical-year-header primary-header reveal">
            <button class="year-toggle" aria-expanded="true" aria-label="Toggle ${year} questions">
              <span class="year-badge">${year}</span>
              <span class="year-toggle-icon">⌄</span>
            </button>
            <div class="year-line"></div>
          </div>
          <div class="year-content open">
            <section class="topic-section secondary-section" style="--delay: ${yearDelay + 50}ms">
              <div class="topic-header secondary-header">
                <span class="topic-label">${topic}</span>
                <span class="topic-meta">${count} question${count === 1 ? "" : "s"}</span>
              </div>
              <div class="topic-content">
                <div class="questions-list">
                  ${questions
                    .map((item, qIndex) => {
                      const cardHtml = buildCardHtml(item, questionIndex++);
                      const questionDelay = yearDelay + qIndex * 30;
                      return addCardAnimation(cardHtml, questionDelay, qIndex);
                    })
                    .join("")}
                </div>
              </div>
            </section>
          </div>
        </section>
      `;
    })
    .join("");

  initYearToggles();
  animateSections();
  restoreScrollPosition(scrollPosition);
};

// Main render function that detects state and calls appropriate renderer
const renderTopicAndYearView = (items) => {
  resetGridViewClasses();
  grid.classList.add("hierarchical-view", "topic-year-view");
  
  const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  
  if (items.length === 0) {
    grid.innerHTML = "";
    return;
  }

  const year = items[0].year;
  const topic = items[0].topic;
  let questionIndex = 0;
  const yearDelay = 150;
  const topicDelay = 200;

  grid.innerHTML = `
    <section class="year-section hierarchical-year primary-section" data-year="${year}" style="--year-index: 0">
      <div class="year-header hierarchical-year-header primary-header reveal">
        <button class="year-toggle" aria-expanded="true" aria-label="Toggle ${year} questions">
          <span class="year-badge">${year}</span>
          <span class="year-toggle-icon">⌄</span>
        </button>
        <div class="year-line"></div>
      </div>
      <div class="year-content open">
        <section class="topic-section secondary-section" style="--delay: ${topicDelay}ms">
          <div class="topic-header secondary-header">
            <span class="topic-label">${topic}</span>
            <span class="topic-meta">${items.length} question${items.length === 1 ? "" : "s"}</span>
          </div>
          <div class="topic-content">
            <div class="questions-list">
              ${items
                .map((item, qIndex) => {
                  const cardHtml = buildCardHtml(item, questionIndex++);
                  const questionDelay = topicDelay + qIndex * 30;
                  // keep animation helper but render as stacked list
                  return addCardAnimation(cardHtml, questionDelay, qIndex);
                })
                .join("")}
            </div>
          </div>
        </section>
      </div>
    </section>
  `;

  restoreScrollPosition(scrollPosition);
  initYearToggles();
  animateSections();
};

const renderHierarchicalView = (items) => {
  // CRITICAL: Always check dropdowns first, then state as fallback
  // This ensures we get the most up-to-date selection values
  const topicValue = startTopic ? startTopic.value : (state.topic || "choose");
  const yearValue = startYear ? startYear.value : (state.year || "choose");
  
  // Sync state from dropdowns if they differ (defensive)
  if (topicValue === "all" && state.topic !== "all") {
    state.topic = "all";
  } else if (topicValue !== "choose" && topicValue !== "none" && topicValue !== state.topic) {
    state.topic = topicValue;
  }
  
  if (yearValue === "all" && state.year !== "all") {
    state.year = "all";
  } else if (yearValue !== "choose" && yearValue !== "none" && yearValue !== state.year) {
    state.year = yearValue;
  }
  
  // Determine selection types - check both state and dropdown values
  // This ensures we catch all cases, even if state hasn't synced yet
  const isAllTopics = state.topic === "all" || topicValue === "all";
  const isAllYears = state.year === "all" || yearValue === "all";
  const isNoTopicSelection = state.topic === "choose" || state.topic === "none" || !state.topic;
  const isNoYearSelection = state.year === "choose" || state.year === "none" || !state.year;
  const isSpecificTopic = state.topic && state.topic !== "all" && state.topic !== "choose" && state.topic !== "none";
  const isSpecificYear = state.year && state.year !== "all" && state.year !== "choose" && state.year !== "none";

  console.log("renderHierarchicalView: isAllTopics:", isAllTopics, "isAllYears:", isAllYears, "isNoTopicSelection:", isNoTopicSelection, "isNoYearSelection:", isNoYearSelection);

  // Case 1: Both "All Topics" AND "All Years" selected → Full hierarchy (Year → Topic → Questions)
  if (isAllTopics && isAllYears) {
    // Force state to "all" if not already set (defensive)
    if (state.topic !== "all") {
      state.topic = "all";
      if (startTopic) startTopic.value = "all";
    }
    if (state.year !== "all") {
      state.year = "all";
      if (startYear) startYear.value = "all";
    }
    // Ensure we have items to render; fall back to full dataset if filter returned empty
    const itemsToRender =
      items && Array.isArray(items) && items.length
        ? items
        : (state.data && Array.isArray(state.data) ? state.data : []);
    console.log("renderHierarchicalView: Rendering full hierarchy with", itemsToRender.length, "items");
    console.log("renderHierarchicalView: State - topic:", state.topic, "year:", state.year);
    console.log("renderHierarchicalView: Dropdown - topic:", topicValue, "year:", yearValue);
    // Always render full hierarchy view, even if items is empty (will show empty state)
    renderFullHierarchyView(itemsToRender);
    return;
  } 
  
  // Case 2: "All Topics" selected with a specific year → Show topics within that year
  if (isAllTopics && isSpecificYear) {
    renderTopicsInYearView(items);
    return;
  }
  
  // Case 3: "All Years" selected with a specific topic → Show years with that topic
  if (isAllYears && isSpecificTopic) {
    renderYearsWithTopicView(items);
    return;
  }
  
  // Case 4: BOTH specific topic AND specific year selected → Year + Topic view
  if (isSpecificTopic && isSpecificYear) {
    renderTopicAndYearView(items);
    return;
  }
  
  // Case 5: "All Topics" selected + No Year Selected (choose/none) → Topic-only view
  // This shows all questions grouped by topic, with topic headers only
  if (isAllTopics && isNoYearSelection) {
    console.log("renderHierarchicalView: All Topics + No Year - rendering topic-only view");
    renderTopicOnlyView(items);
    return;
  }
  
  // Case 6: "All Topics" selected (no specific year filter) → Topic-only view (fallback)
  if (isAllTopics) {
    console.log("renderHierarchicalView: All Topics - rendering topic-only view");
    renderTopicOnlyView(items);
    return;
  } 
  
  // Case 7: "All Years" selected (no topic filter) → Year-only view
  if (isAllYears) {
    // Force state to "all" if not already set (defensive)
    if (state.year !== "all") {
      state.year = "all";
      if (startYear) startYear.value = "all";
    }
    // Ensure we have items to render
    const itemsToRender = items && Array.isArray(items) ? items : [];
    renderYearOnlyView(itemsToRender);
    return;
  } 
  
  // Case 8: Specific topic selected → Single topic view
  if (isSpecificTopic) {
    renderSingleTopicView(items);
    return;
  } 
  
  // Case 9: Specific year selected → Single year view
  if (isSpecificYear) {
    renderSingleYearView(items);
    return;
  } 
  
  // Fallback: Regular grid view
  renderGrid(items);
};

// Helper functions
const initYearToggles = () => {
  document.querySelectorAll(".year-toggle").forEach((toggle) => {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const section = toggle.closest(".year-section");
      const content = section.querySelector(".year-content");
      const isOpen = content.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen);
      const icon = toggle.querySelector(".year-toggle-icon");
      if (icon) {
        icon.style.transform = isOpen ? "rotate(0deg)" : "rotate(-90deg)";
      }
    });
  });
};

const animateSections = () => {
  requestAnimationFrame(() => {
    document.querySelectorAll(".topic-section").forEach((section, index) => {
      const delay = section.style.getPropertyValue("--delay") || `${150 + index * 50}ms`;
      setTimeout(() => {
        section.classList.add("is-visible");
      }, parseInt(delay));
    });
    
    document.querySelectorAll(".year-header.reveal, .hierarchical-year-header.reveal").forEach((header) => {
      if (!observer) {
        header.classList.add("is-visible");
        return;
      }
      observer.observe(header);
    });
  });
};

const restoreScrollPosition = (scrollPosition) => {
  setTimeout(() => {
    if (scrollPosition > 0) {
      window.scrollTo({
        top: scrollPosition,
        behavior: "auto"
      });
    }
  }, 50);
};

let renderToken = 0;
const renderCards = () => {
  if (!grid || !resultsInfo || !emptyState || !activeChips) return;
  const currentToken = ++renderToken;
  let filtered = filterData();
  const allSelected =
    (startTopic?.value === "all" || state.topic === "all") &&
    (startYear?.value === "all" || state.year === "all");
  if (allSelected && state.data && state.data.length) {
    filtered = state.data;
  }
  const isAllView =
    (state.year === "all" || state.topic === "all") &&
    state.batch === "all";
  const isFullHierarchicalView = 
    state.year === "all" &&
    state.topic === "all" &&
    state.batch === "all";

  updateActiveChips();
  
  if (isFullHierarchicalView) {
    resultsInfo.textContent = `${filtered.length} questions grouped by year and topic.`;
  } else if (isAllView) {
    resultsInfo.textContent = `${filtered.length} question${filtered.length === 1 ? "" : "s"} found.`;
  } else {
    resultsInfo.textContent = `${filtered.length} question${filtered.length === 1 ? "" : "s"} found.`;
  }
  
  // Show/hide empty state based on results
  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    // Update empty state message
    const emptyTitle = emptyState.querySelector("h3");
    const emptyMessage = emptyState.querySelector("p");
    if (emptyTitle) {
      emptyTitle.textContent = "No results found";
    }
    if (emptyMessage) {
      emptyMessage.textContent = "Try adjusting your topic/year filters.";
    }
    
    // Fade out before clearing
    grid.style.opacity = "0";
    grid.style.transition = "opacity 0.3s ease";
    setTimeout(() => {
      if (currentToken !== renderToken) return;
    grid.innerHTML = "";
      grid.style.opacity = "1";
      grid.style.transition = "";
    }, 300);
    return;
  } else {
    emptyState.classList.add("hidden");
  }

  // Fade out current content before rendering new content
  const wasHierarchical = grid.classList.contains("hierarchical-view");
  const currentOpacity = grid.style.opacity || "1";
  grid.style.opacity = "0";
  grid.style.transition = "opacity 0.25s ease";
  
  setTimeout(() => {
    if (currentToken !== renderToken) return;
    // Determine if we should use hierarchical view
    // CRITICAL: Always check dropdowns FIRST since they are the source of truth
    // This ensures that when user selects "All Topics" then "All Years" (or vice versa),
    // OR when page first loads with "all" selected, the correct view is rendered
    const topicValue = startTopic ? startTopic.value : (state.topic || "choose");
    const yearValue = startYear ? startYear.value : (state.year || "choose");
    
    // CRITICAL: Always sync state from dropdowns (dropdowns are source of truth)
    // This is especially important on first load when state might not be synced
    if (topicValue === "all") {
      state.topic = "all";
    } else if (topicValue === "choose" || topicValue === "none") {
      // Only update to "choose" if state is also "choose" or undefined
      // This prevents overwriting a valid state value
      if (state.topic === "choose" || state.topic === "none" || !state.topic) {
        state.topic = topicValue;
      }
  } else {
      state.topic = topicValue;
    }
    
    if (yearValue === "all") {
      state.year = "all";
    } else if (yearValue === "choose" || yearValue === "none") {
      // Only update to "choose" if state is also "choose" or undefined
      if (state.year === "choose" || state.year === "none" || !state.year) {
        state.year = yearValue;
      }
    } else {
      state.year = yearValue;
    }
    
    console.log("renderCards: After sync - state.topic:", state.topic, "state.year:", state.year, "dropdown topic:", topicValue, "dropdown year:", yearValue);
    
    // Determine selection types - check both state and dropdown values
    const isAllTopics = state.topic === "all" || topicValue === "all";
    const isAllYears = state.year === "all" || yearValue === "all";
    const isSpecificTopic = state.topic && state.topic !== "all" && state.topic !== "choose" && state.topic !== "none";
    const isSpecificYear = state.year && state.year !== "all" && state.year !== "choose" && state.year !== "none";
    
    const shouldUseHierarchical = 
      isAllTopics || 
      isAllYears || 
      isSpecificTopic || 
      isSpecificYear;
    let usedFullHierarchy = false;
    if ((topicValue === "all" || state.topic === "all") && (yearValue === "all" || state.year === "all")) {
      state.topic = "all";
      state.year = "all";
      renderFullHierarchyView(state.hierarchy && state.hierarchy.length ? state.hierarchy : state.data);
      usedFullHierarchy = true;
    }

    // Always use hierarchical view when appropriate, even if filtered is empty
    // The hierarchical view functions handle empty states internally
    if (!usedFullHierarchy && shouldUseHierarchical) {
      console.log("renderCards: Using hierarchical view with", filtered.length, "items");
      console.log("renderCards: isAllTopics:", isAllTopics, "isAllYears:", isAllYears);
      renderHierarchicalView(filtered);
  } else if (!usedFullHierarchy) {
      console.log("renderCards: Using grid view with", filtered.length, "items");
    renderGrid(filtered);
  }

    // Fade in new content
  requestAnimationFrame(() => {
      grid.style.opacity = "1";
      
      observeMathIn(grid);
      
      // Animate year headers
      document.querySelectorAll(".year-header.reveal, .hierarchical-year-header.reveal").forEach((header) => {
      if (!observer) {
        header.classList.add("is-visible");
        return;
      }
      observer.observe(header);
    });
      
      // Animate topic sections with proper delays (handled in renderHierarchicalView)
      // Questions animate automatically via CSS
    });
  }, 250);
};

const getLoadErrorMessage = (label) => {
  const base = `Unable to load ${label}.`;
  if (window.location.protocol === "file:") {
    return `${base} Open the site with a local server (not file://).`;
  }
  return `${base} Please check your network and refresh.`;
};

const applyFilters = () => {
  // CRITICAL: Always sync state from dropdowns (source of truth)
  if (startTopic) {
    const dropdownValue = startTopic.value;
    state.topic = dropdownValue === "none" ? "choose" : dropdownValue;
  }
  
  if (startYear) {
    const dropdownValue = startYear.value;
    state.year = dropdownValue === "none" ? "choose" : dropdownValue;
  }
  
  console.log("applyFilters: State after sync - topic:", state.topic, "year:", state.year);
  const filtered = filterData();
  console.log("applyFilters: Filtered", filtered.length, "items (total:", state.data ? state.data.length : 0, ")");
  
  renderCards();
  updateHomeLock();
};

const syncStartSelectCards = () => {
  if (!startReviewCards.length) return;
  startReviewCards.forEach((card) => {
    const select = card.querySelector("select");
    if (!select) return;
    // Has selection if value is not "choose", "all", or "none"
    card.classList.toggle("has-selection", select.value !== "all" && select.value !== "choose" && select.value !== "none");
  });
};

const updateHomeLock = () => {
  if (!document.body.classList.contains("home-page")) return;
  // Has selection if topic or year is "all" or a specific value (but not "choose")
  // "all" is a valid selection that should unlock the home screen
  const hasSelection = (state.topic === "all" || (state.topic !== "choose" && state.topic !== "none" && state.topic)) || 
                       (state.year === "all" || (state.year !== "choose" && state.year !== "none" && state.year));
  const shouldLock = !hasSelection && !document.body.classList.contains("home-show-all");
  document.body.classList.toggle("home-locked", shouldLock);
  
  // Show/hide Question Viewing Zone
  const questionsSection = document.querySelector('.questions-section');
  if (questionsSection) {
    if (hasSelection) {
      // Activate Question Viewing Zone with animation
      questionsSection.classList.add('is-active');
      document.body.classList.add('content-zone-active');
      // Enable vertical scrolling only; keep horizontal axis locked on mobile.
      document.body.style.overflowY = 'auto';
      document.body.style.overflowX = 'hidden';
      // Smooth scroll to content zone after a brief delay
      setTimeout(() => {
        scrollToQuestionsSection("smooth");
      }, 100);
    } else {
      // Deactivate Question Viewing Zone with animation
      questionsSection.classList.remove('is-active');
      document.body.classList.remove('content-zone-active');
      // Scroll to top smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Disable scrolling after animation
      setTimeout(() => {
        if (!questionsSection.classList.contains('is-active')) {
          document.body.style.overflowY = 'hidden';
          document.body.style.overflowX = 'hidden';
        }
      }, 500);
    }
  }
  
  syncStartSelectCards();

  renderBottomNav();
};

const getBottomNavYearList = () => {
  if (!state.data || !state.data.length) return [];
  return Array.from(new Set(state.data.map((item) => item.year)))
    .filter(Boolean)
    .sort((a, b) => parseInt(String(a), 10) - parseInt(String(b), 10));
};

const renderBottomNav = () => {
  const dock = document.getElementById("questions-bottom-dock");
  const nav = document.getElementById("questions-bottom-nav");
  const topicScroll = document.getElementById("bottom-nav-topic-scroll");
  const yearScroll = document.getElementById("bottom-nav-year-scroll");
  if (!nav || !topicScroll || !yearScroll) return;
  if (!startTopic || !startYear) return;

  const locked = document.body.classList.contains("home-locked");
  if (
    locked ||
    document.body.classList.contains("home-show-all") ||
    !state.data ||
    !state.data.length
  ) {
    if (dock) dock.hidden = true;
    return;
  }

  if (dock) dock.hidden = false;

  const topicOrder = ["all", ...ALL_TOPICS];
  const years = getBottomNavYearList();
  const yearOrder = ["all", ...years];

  const tv = startTopic.value;
  const yv = startYear.value;

  topicScroll.innerHTML = topicOrder
    .map((t) => {
      const label = t === "all" ? "All" : escapeHtml(t);
      const isActive = tv === t;
      const title = t === "all" ? "All topics" : t;
      return `<button type="button" class="questions-bottom-nav__pill pill-nav-btn btn--ripple ${isActive ? "is-active" : ""}" data-topic="${escapeHtml(t)}" title="${escapeHtml(title)}">${label}</button>`;
    })
    .join("");

  yearScroll.innerHTML = yearOrder
    .map((y) => {
      const label = y === "all" ? "All" : String(y);
      const isActive = String(yv) === String(y);
      const title = y === "all" ? "All years" : `View ${y} questions`;
      return `<button type="button" class="questions-bottom-nav__pill pill-nav-btn btn--ripple ${isActive ? "is-active" : ""}" data-year="${String(y)}" title="${escapeHtml(title)}">${label}</button>`;
    })
    .join("");

  requestAnimationFrame(() => {
    topicScroll.querySelector(".is-active")?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
    yearScroll.querySelector(".is-active")?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  });
};

const bindBottomNav = () => {
  const nav = document.getElementById("questions-bottom-nav");
  if (!nav) return;

  addListener(nav, "click", (event) => {
    const topicPill = event.target.closest("[data-topic].questions-bottom-nav__pill");
    if (topicPill && topicPill.dataset.topic !== undefined) {
      if (!startTopic) return;
      startTopic.value = topicPill.dataset.topic;
      startTopic.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    const yearPill = event.target.closest("[data-year].questions-bottom-nav__pill");
    if (yearPill && yearPill.dataset.year !== undefined) {
      if (!startYear) return;
      startYear.value = yearPill.dataset.year;
      startYear.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  const collapseBtn = document.getElementById("bottom-nav-collapse");
  addListener(collapseBtn, "click", () => {
    const collapsed = nav.classList.toggle("questions-bottom-nav--collapsed");
    if (collapseBtn) {
      collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      const icon = collapseBtn.querySelector(".questions-bottom-nav__collapse-icon");
      if (icon) icon.textContent = collapsed ? "+" : "−";
    }
  });
};

const initHomeBackground = () => {
  if (!document.body.classList.contains("home-page")) return;
  
  // Load fog background Lottie animation
  const fogAnimationContainer = document.getElementById("fog-animation");
  if (fogAnimationContainer && window.lottie && !fogAnimationContainer.hasChildNodes()) {
    try {
      lottie.loadAnimation({
        container: fogAnimationContainer,
        renderer: "svg",
        loop: true,
        autoplay: true,
        path: "assets/images/Fog Background Decoration.json",
      });
    } catch (error) {
      console.error("Failed to load fog background animation:", error);
    }
  }
  
  const particlesContainer = document.querySelector(".home-particles");
  if (particlesContainer && !particlesContainer.childElementCount) {
    const count = 18;
    for (let i = 0; i < count; i += 1) {
      const dot = document.createElement("span");
      dot.className = "home-particle";
      const size = 3 + Math.random() * 3;
      const left = Math.random() * 100;
      const duration = 16 + Math.random() * 10;
      const delay = Math.random() * 6;
      dot.style.setProperty("--size", `${size}px`);
      dot.style.left = `${left}%`;
      dot.style.setProperty("--duration", `${duration}s`);
      dot.style.setProperty("--delay", `${delay}s`);
      particlesContainer.appendChild(dot);
    }
  }

  let rafId = null;
  const handleMove = (event) => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      const x = (event.clientX / window.innerWidth - 0.5) * 12;
      const y = (event.clientY / window.innerHeight - 0.5) * 8;
      document.body.style.setProperty("--flow-x", `${x}px`);
      document.body.style.setProperty("--flow-y", `${y}px`);
      rafId = null;
    });
  };
  window.addEventListener("mousemove", handleMove);

  const content = document.querySelector(".content");
  if (content) {
    content.addEventListener("mouseenter", () => document.body.classList.add("home-pause"));
    content.addEventListener("mouseleave", () => document.body.classList.remove("home-pause"));
  }
};

const initHomeDropdowns = () => {
  if (!document.body.classList.contains("home-page")) return;
  const groups = document.querySelectorAll(".home-select-group");
  if (!groups.length) return;

  const closeAll = () => {
    const wasOpen = Array.from(groups).some((group) =>
      group.classList.contains("open")
    );
    groups.forEach((group) => {
      group.classList.remove("open");
      const trigger = group.querySelector(".home-select__trigger");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
    document.body.classList.remove("home-select-open");
    // Scroll back to top of home screen when dropdown closes
    if (wasOpen && document.body.classList.contains("home-page")) {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  };

  groups.forEach((group) => {
    if (group.querySelector(".home-select__trigger")) return;
    const select = group.querySelector("select");
    if (!select) return;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "home-select__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `
      <span class="home-select__value">${select.options[select.selectedIndex].text}</span>
      <span class="home-select__chevron">⌄</span>
    `;

    const menu = document.createElement("div");
    menu.className = "home-select__menu";
    menu.setAttribute("role", "listbox");

    // Skip the first "choose" option, only show selectable options
    let menuIndex = 0;
    Array.from(select.options).forEach((option) => {
      // Skip the "choose" placeholder option
      if (option.value === "choose") return;
      
      const item = document.createElement("button");
      item.type = "button";
      item.className = "home-select__option";
      item.setAttribute("role", "option");
      item.dataset.value = option.value;
      item.style.setProperty("--delay", `${menuIndex * 40}ms`);
      menuIndex++;
      item.innerHTML = `
        <span class="home-select__icon"></span>
        <span class="home-select__label-text">${option.text}</span>
        <span class="home-select__check"></span>
      `;
      if (option.selected) {
        item.classList.add("selected");
        item.setAttribute("aria-selected", "true");
      }
      menu.appendChild(item);
    });

    const updateSelection = (value) => {
      // If "none" is selected, convert to "choose" to show placeholder text
      if (value === "none") {
        select.value = "choose";
        // Display the placeholder text ("Choose Topic" or "Choose Year")
        const chooseOption = Array.from(select.options).find(opt => opt.value === "choose");
        trigger.querySelector(".home-select__value").textContent = chooseOption ? chooseOption.text : "Choose";
      } else {
        select.value = value;
        trigger.querySelector(".home-select__value").textContent =
          select.options[select.selectedIndex].text;
      }
      
      // Update menu items - none should be selected when value is "choose"
      menu.querySelectorAll(".home-select__option").forEach((item) => {
        // Only mark as selected if the actual select value matches (not "choose")
        const isSelected = select.value !== "choose" && item.dataset.value === select.value;
        item.classList.toggle("selected", isSelected);
        item.setAttribute("aria-selected", isSelected ? "true" : "false");
      });
      // Has selection if value is not "choose", "all", or "none"
      const actualValue = select.value;
      group.classList.toggle("has-selection", actualValue !== "all" && actualValue !== "choose" && actualValue !== "none");
    };

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = group.classList.toggle("open");
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.classList.toggle("home-select-open", isOpen);
      
      if (!isOpen) {
        // Dropdown is closing - scroll back to top
        menu.classList.remove("menu-upward");
        if (document.body.classList.contains("home-page")) {
          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });
        }
        return;
      }
      
      // Dropdown is opening - close other dropdowns
      groups.forEach((other) => {
        if (other !== group) {
          other.classList.remove("open");
          const otherTrigger = other.querySelector(".home-select__trigger");
          if (otherTrigger) otherTrigger.setAttribute("aria-expanded", "false");
        }
      });
      
      // Always display below - remove upward positioning
      menu.classList.remove("menu-upward");
      
      // Scroll down to show dropdown with extra space below
      requestAnimationFrame(() => {
        // Wait for menu to render
        setTimeout(() => {
          const triggerRect = trigger.getBoundingClientRect();
          const menuRect = menu.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
          
          // Calculate target scroll position to show dropdown with extra space below
          const menuBottom = triggerRect.bottom + menuRect.height;
          const extraSpace = 100; // Extra space below dropdown
          const targetScrollTop = currentScrollTop + (menuBottom - viewportHeight) + extraSpace;
          
          // Scroll to show dropdown with extra space
          window.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: "smooth"
          });
        }, 100); // Small delay to ensure menu is fully rendered
      });
    });

    menu.addEventListener("click", (event) => {
      event.stopPropagation(); // Prevent event from bubbling to document
      const item = event.target.closest(".home-select__option");
      if (!item) return;
      
      const selectedValue = item.dataset.value;
      updateSelection(selectedValue);
      group.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      document.body.classList.remove("home-select-open");
      
      // Scroll back to top when option is selected
      if (document.body.classList.contains("home-page")) {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
      
      // Trigger change event to update filters
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    group.appendChild(trigger);
    group.appendChild(menu);
    updateSelection(select.value);
    
    // Store references for rebuilding menu when options change
    group._select = select;
    group._trigger = trigger;
    group._menu = menu;
    group._updateSelection = updateSelection;
    
    // Function to rebuild menu when options change
    // Note: Click handler is already attached to menu element, so we don't need to re-attach it
    const rebuildMenu = () => {
      menu.innerHTML = "";
      let menuIndex = 0;
      Array.from(select.options).forEach((option) => {
        // Skip the "choose" placeholder option
        if (option.value === "choose") return;
        
        const item = document.createElement("button");
        item.type = "button";
        item.className = "home-select__option";
        item.setAttribute("role", "option");
        item.dataset.value = option.value;
        item.style.setProperty("--delay", `${menuIndex * 40}ms`);
        menuIndex++;
        item.innerHTML = `
          <span class="home-select__icon"></span>
          <span class="home-select__label-text">${option.text}</span>
          <span class="home-select__check"></span>
        `;
        if (option.selected) {
          item.classList.add("selected");
          item.setAttribute("aria-selected", "true");
        }
        menu.appendChild(item);
      });
      
      // Update selection display (click handler is already attached to menu, no need to re-attach)
      updateSelection(select.value);
    };
    
    // Store rebuild function
    group._rebuildMenu = rebuildMenu;
  });

  // Close dropdowns when clicking outside, but not when clicking inside the menu
  document.addEventListener("click", (event) => {
    const clickedInside = event.target.closest(".home-select-group");
    if (!clickedInside) {
      closeAll();
    }
  });
  
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAll();
  });
};

const initPageBackground = () => {
  if (document.body.classList.contains("home-page")) return;
  
  const bgContainer = document.getElementById("page-bg-animation");
  if (bgContainer && window.lottie && !bgContainer.hasChildNodes()) {
    lottie.loadAnimation({
      container: bgContainer,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: "assets/images/Background01.json",
    });
  }
};

const updateHomeViewFromHash = () => {
  if (!document.body.classList.contains("home-page")) return;
  const hash = window.location.hash;
  const showAll = hash === "#about";
  document.body.classList.toggle("home-show-all", showAll);
  if (showAll) {
    document.body.classList.remove("home-locked");
    renderBottomNav();
  } else {
    updateHomeLock();
  }
};

const renderTermsConcepts = () => {
  if (
    !termsGrid ||
    !conceptsGrid ||
    !termsSection ||
    !conceptsSection ||
    !termsFilter ||
    !termsEmpty
  ) {
    return;
  }

  const mode = state.termsFilterMode || "all";
  const terms = state.termsConcepts?.terms || [];
  const concepts = state.termsConcepts?.concepts || [];
  const filteredTerms = terms;
  const filteredConcepts = concepts;

  const showTerms = mode === "all" || mode === "terms";
  const showConcepts = mode === "all" || mode === "concepts";
  termsSection.classList.toggle("hidden", !showTerms);
  conceptsSection.classList.toggle("hidden", !showConcepts);

  termsGrid.innerHTML = filteredTerms
    .map(
      (item, index) => `
        <article class="term-card" style="--stagger: ${index * 32}ms;">
          <h3 class="term-card__title">${allowBasicTags(escapeHtml(item.term || ""))}</h3>
          <p class="term-card__definition">${allowBasicTags(escapeHtml(item.definition || ""))}</p>
          <span class="term-card__year">${allowBasicTags(escapeHtml(item.year || "—"))}</span>
        </article>
      `
    )
    .join("");

  conceptsGrid.innerHTML = filteredConcepts
    .map(
      (item, index) => `
        <article class="concept-card" style="--stagger: ${index * 32}ms;">
          <p class="concept-card__question">${allowBasicTags(escapeHtml(item.question || ""))}</p>
          <p class="concept-card__answer"><strong>${allowBasicTags(escapeHtml(item.answer || ""))}</strong></p>
          <span class="concept-card__year">${allowBasicTags(escapeHtml(item.year || "—"))}</span>
        </article>
      `
    )
    .join("");

  const visibleCount =
    (showTerms ? filteredTerms.length : 0) + (showConcepts ? filteredConcepts.length : 0);
  termsEmpty.classList.toggle("hidden", visibleCount > 0);

  termsFilter.querySelectorAll("[data-mode]").forEach((btn) => {
    const selected = btn.dataset.mode === mode;
    btn.classList.toggle("is-active", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
  });

  requestAnimationFrame(() => {
    document.querySelectorAll(".term-card, .concept-card").forEach((card) => {
      card.classList.add("is-visible");
    });
  });
};

const loadQuestionsData = async () => {
  if (state.data.length) return;
  const response = await fetch(DATA_URL);
  state.data = await response.json();
  state.hierarchy = buildHierarchy(state.data);
};

const loadTermsConceptsData = async () => {
  if (
    (state.termsConcepts?.terms?.length || 0) > 0 ||
    (state.termsConcepts?.concepts?.length || 0) > 0
  ) {
    return;
  }
  const response = await fetch(TERMS_CONCEPTS_URL);
  const payload = await response.json();
  state.termsConcepts = {
    terms: Array.isArray(payload.terms) ? payload.terms : [],
    concepts: Array.isArray(payload.concepts) ? payload.concepts : [],
  };
};

const debounce = (fn, delay = 180) => {
  let timeoutId = null;
  return (...args) => {
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), delay);
  };
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const loadFormulaSidebarData = async () => {
  if (formulaSidebarState.topics.length) return formulaSidebarState.topics;
  const response = await fetch(FORMULA_SIDEBAR_URL);
  const payload = await response.json();
  const grouped = Array.isArray(payload) ? payload : [];
  formulaSidebarState.topics = ALL_TOPICS.map((topic) => {
    const match = grouped.find((entry) => entry.topic === topic);
    const formulas = Array.isArray(match?.formulas) ? match.formulas : [];
    return {
      topic,
      formulas: formulas.map((item, index) => ({
        id: `${topic}-${index}`,
        title: item.title || "Untitled",
        formula: item.formula || "",
      })),
    };
  });
  return formulaSidebarState.topics;
};

const formulaSidebarMarkup = () => `
  <button class="formula-fab" id="formula-sidebar-toggle" type="button" aria-label="Open formula sidebar" title="Open Formula Sidebar">
    <span class="formula-fab__icon">∑</span>
  </button>
  <div class="formula-sidebar-backdrop" id="formula-sidebar-backdrop" aria-hidden="true"></div>
  <aside class="formula-sidebar formula-sidebar--hidden" id="formula-sidebar" aria-label="Formula sidebar">
    <header class="formula-sidebar__header">
      <button class="formula-sidebar__logo-btn" id="formula-sidebar-logo" type="button" aria-label="Toggle formula sidebar">
        <span class="formula-sidebar__logo">∑</span>
      </button>
      <div class="formula-sidebar__title-wrap">
        <h3>Formula Library</h3>
        <small>Hydraulics quick review</small>
      </div>
      <div class="formula-sidebar__header-actions">
        <button class="formula-sidebar__icon-btn" id="formula-hide-btn" type="button" title="Hide">✕</button>
      </div>
    </header>
    <div class="formula-sidebar__search-wrap">
      <span class="formula-sidebar__search-icon">⌕</span>
      <input id="formula-sidebar-search" class="formula-sidebar__search" type="text" placeholder="Search title, formula, topic..." />
    </div>
    <div class="formula-sidebar__meta" id="formula-sidebar-meta"></div>
    <div class="formula-sidebar__body" id="formula-sidebar-body"></div>
  </aside>
  <div class="formula-toast" id="formula-toast" role="status" aria-live="polite"></div>
`;

const setFormulaSidebarMode = (mode) => {
  const sidebar = document.getElementById("formula-sidebar");
  const backdrop = document.getElementById("formula-sidebar-backdrop");
  const toggleBtn = document.getElementById("formula-sidebar-toggle");
  if (!sidebar || !backdrop) return;
  const mobile = window.matchMedia("(max-width: 768px)").matches;
  sidebar.classList.toggle("formula-sidebar--open", mode === "open");
  sidebar.classList.remove("formula-sidebar--collapsed");
  sidebar.classList.toggle("formula-sidebar--hidden", mode === "hidden");
  backdrop.classList.toggle("is-visible", mobile && mode !== "hidden");
  document.body.classList.toggle("formula-layout-open", !mobile && mode === "open");
  document.body.classList.remove("formula-layout-collapsed");
  formulaSidebarState.open = mode !== "hidden";
  formulaSidebarState.collapsed = false;
  if (toggleBtn) {
    toggleBtn.classList.toggle("is-hidden", mode === "open");
  }
};

const showFormulaToast = (message) => {
  const toast = document.getElementById("formula-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 1700);
};

const loadFormulaSidebarPrefs = () => {
  try {
    const favorites = JSON.parse(localStorage.getItem(FORMULA_FAVORITES_KEY) || "[]");
    const recent = JSON.parse(localStorage.getItem(FORMULA_RECENT_KEY) || "[]");
    formulaSidebarState.favorites = new Set(Array.isArray(favorites) ? favorites : []);
    formulaSidebarState.recent = Array.isArray(recent) ? recent.slice(0, 8) : [];
  } catch (error) {
    formulaSidebarState.favorites = new Set();
    formulaSidebarState.recent = [];
  }
};

const persistFormulaSidebarPrefs = () => {
  try {
    localStorage.setItem(FORMULA_FAVORITES_KEY, JSON.stringify(Array.from(formulaSidebarState.favorites)));
    localStorage.setItem(FORMULA_RECENT_KEY, JSON.stringify(formulaSidebarState.recent.slice(0, 8)));
  } catch (error) {}
};

const buildFormulaSearchHighlight = (value, query) => {
  if (!query) return escapeHtml(value);
  const safeQuery = escapeRegExp(query.trim());
  if (!safeQuery) return escapeHtml(value);
  const regex = new RegExp(`(${safeQuery})`, "ig");
  return escapeHtml(value).replace(regex, "<mark>$1</mark>");
};

const normalizeFormulaExpression = (value) => {
  let normalized = String(value || "").trim();
  if (!normalized) return "";
  // Convert only the first division to fraction form.
  // If denominator contains another division, keep "/" inside denominator.
  const firstDivisionPattern = /([A-Za-z0-9_.^()+\-]+)\s*\/\s*(.+)/;
  normalized = normalized.replace(firstDivisionPattern, "\\frac{$1}{$2}");
  const greekMap = ["rho", "gamma", "mu", "nu", "eta", "theta", "sigma", "tau", "pi"];
  greekMap.forEach((token) => {
    const tokenRegex = new RegExp(`\\b${token}\\b`, "gi");
    normalized = normalized.replace(tokenRegex, `\\${token}`);
  });
  normalized = normalized.replace(/sqrt\(([^)]+)\)/gi, "\\sqrt{$1}");
  normalized = normalized
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" \\quad ");

  return normalized;
};

const formatFormulaForRender = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "\\(\\)";

  // Render each <br>-separated line as its own math expression so visible line breaks appear.
  const lines = raw
    .split(/<br\s*\/?>/i)
    .map((line) => line.trim())
    .filter(Boolean);

  const renderedLines = lines.map((line) => {
    if (/\\\(|\\\[|\$\$|\$/.test(line)) return line;
    const normalized = normalizeFormulaExpression(line);
    return `\\( ${normalized} \\)`;
  });

  return renderedLines.join("<br>");
};

const filterFormulaTopics = () => {
  const query = formulaSidebarState.query.trim().toLowerCase();
  return formulaSidebarState.topics
    .map((topicEntry) => {
      const filteredFormulas = topicEntry.formulas.filter((item) => {
        if (!query) return true;
        const haystack = `${item.title} ${item.formula} ${topicEntry.topic}`.toLowerCase();
        return haystack.includes(query);
      });
      return { ...topicEntry, formulas: filteredFormulas };
    })
    .filter((topicEntry) => topicEntry.formulas.length > 0 || !query);
};

const renderFormulaSidebar = () => {
  const body = document.getElementById("formula-sidebar-body");
  const meta = document.getElementById("formula-sidebar-meta");
  if (!body || !meta) return;

  const filteredTopics = filterFormulaTopics();
  const totalResults = filteredTopics.reduce((sum, item) => sum + item.formulas.length, 0);
  meta.textContent = formulaSidebarState.query.trim()
    ? `${totalResults} result${totalResults === 1 ? "" : "s"}`
    : `${totalResults} formula${totalResults === 1 ? "" : "s"}`;

  if (!filteredTopics.length || totalResults === 0) {
    body.innerHTML = `<div class="formula-sidebar__empty">No results found. Try another keyword.</div>`;
    return;
  }

  const query = formulaSidebarState.query.trim();
  body.innerHTML = filteredTopics
    .map((topicEntry, topicIndex) => {
      const topicId = `topic-${topicEntry.topic.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
      const isExpanded = formulaSidebarState.expandedTopics.has(topicEntry.topic);
      const formulasHtml = topicEntry.formulas
        .map((item, formulaIndex) => {
          const itemId = `${topicId}-${formulaIndex}`;
          const favorite = formulaSidebarState.favorites.has(itemId);
          return `
            <article class="formula-card" style="--stagger:${formulaIndex * 30}ms" data-formula-id="${itemId}">
              <div class="formula-card__head">
                <h4>${buildFormulaSearchHighlight(item.title, query)}</h4>
                <button class="formula-card__star ${favorite ? "is-active" : ""}" data-action="favorite" data-id="${itemId}" title="Favorite">★</button>
              </div>
              <div class="formula-card__math">${formatFormulaForRender(item.formula)}</div>
              <div class="formula-card__foot">
                <button data-action="copy" data-copy="${escapeHtml(item.formula)}">Copy</button>
              </div>
            </article>
          `;
        })
        .join("");
      return `
        <section class="formula-topic ${isExpanded ? "is-open" : ""}" style="--topic-stagger:${topicIndex * 45}ms">
          <button class="formula-topic__head" data-action="topic-toggle" data-topic="${escapeHtml(topicEntry.topic)}">
            <span>${buildFormulaSearchHighlight(topicEntry.topic, query)} (${topicEntry.formulas.length})</span>
            <strong>${isExpanded ? "−" : "+"}</strong>
          </button>
          <div class="formula-topic__content">${isExpanded ? formulasHtml : ""}</div>
        </section>
      `;
    })
    .join("");

  observeMathIn(body);
};

const initFormulaSidebar = async () => {
  if (document.getElementById("formula-sidebar")) return;
  document.body.insertAdjacentHTML("beforeend", formulaSidebarMarkup());
  loadFormulaSidebarPrefs();
  // Default to collapsed topics; user opens each topic with the + control.
  formulaSidebarState.expandedTopics.clear();

  try {
    await loadFormulaSidebarData();
  } catch (error) {
    const body = document.getElementById("formula-sidebar-body");
    if (body) body.innerHTML = `<div class="formula-sidebar__empty">Formula data failed to load.</div>`;
  }
  renderFormulaSidebar();

  const toggleBtn = document.getElementById("formula-sidebar-toggle");
  const logoBtn = document.getElementById("formula-sidebar-logo");
  const hideBtn = document.getElementById("formula-hide-btn");
  const backdrop = document.getElementById("formula-sidebar-backdrop");
  const search = document.getElementById("formula-sidebar-search");
  const body = document.getElementById("formula-sidebar-body");
  const updateQuery = debounce((value) => {
    formulaSidebarState.query = value || "";
    renderFormulaSidebar();
  }, 140);

  const navBrand = document.querySelector(".top-nav__brand");
  const navActions = document.querySelector(".top-nav__actions");
  const darkModeBtn = document.getElementById("dark-mode-toggle");
  let wasMobileViewport = window.matchMedia("(max-width: 768px)").matches;
  const placeFormulaToggleByViewport = () => {
    if (!toggleBtn) return;
    if (window.matchMedia("(max-width: 768px)").matches && navActions) {
      if (darkModeBtn) navActions.insertBefore(toggleBtn, darkModeBtn);
      else navActions.prepend(toggleBtn);
      toggleBtn.classList.add("formula-fab--mobile-header");
      return;
    }
    if (navBrand) {
      const brandText = navBrand.querySelector("span");
      if (brandText) navBrand.insertBefore(toggleBtn, brandText);
      else navBrand.prepend(toggleBtn);
      toggleBtn.classList.remove("formula-fab--mobile-header");
    }
  };
  placeFormulaToggleByViewport();
  // Small-device default: keep formula sidebar hidden until user taps icon.
  if (wasMobileViewport) {
    setFormulaSidebarMode("hidden");
  }

  addListener(toggleBtn, "click", () => {
    setFormulaSidebarMode(formulaSidebarState.open ? "hidden" : "open");
  });
  addListener(logoBtn, "click", () => {
    setFormulaSidebarMode(formulaSidebarState.open ? "hidden" : "open");
  });
  addListener(hideBtn, "click", () => setFormulaSidebarMode("hidden"));
  addListener(backdrop, "click", () => setFormulaSidebarMode("hidden"));
  addListener(search, "input", (event) => updateQuery(event.target.value));
  addListener(body, "click", async (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;
    if (action === "topic-toggle") {
      const topic = actionTarget.dataset.topic;
      if (!topic) return;
      if (formulaSidebarState.expandedTopics.has(topic)) formulaSidebarState.expandedTopics.delete(topic);
      else formulaSidebarState.expandedTopics.add(topic);
      renderFormulaSidebar();
      return;
    }
    if (action === "copy") {
      const formula = actionTarget.dataset.copy || "";
      if (!formula) return;
      try {
        await navigator.clipboard.writeText(formula);
        showFormulaToast("Formula copied");
      } catch (error) {
        showFormulaToast("Copy failed");
      }
      const card = actionTarget.closest(".formula-card");
      if (card?.dataset.formulaId) {
        formulaSidebarState.recent = [card.dataset.formulaId, ...formulaSidebarState.recent.filter((id) => id !== card.dataset.formulaId)].slice(0, 8);
        persistFormulaSidebarPrefs();
      }
      return;
    }
    if (action === "favorite") {
      const id = actionTarget.dataset.id;
      if (!id) return;
      if (formulaSidebarState.favorites.has(id)) formulaSidebarState.favorites.delete(id);
      else formulaSidebarState.favorites.add(id);
      persistFormulaSidebarPrefs();
      renderFormulaSidebar();
    }
  });

  addListener(window, "resize", () => {
    placeFormulaToggleByViewport();
    const isMobileViewport = window.matchMedia("(max-width: 768px)").matches;
    if (isMobileViewport && !wasMobileViewport) {
      // Switched desktop -> mobile: reset to hidden by default
      setFormulaSidebarMode("hidden");
      wasMobileViewport = isMobileViewport;
      return;
    }
    wasMobileViewport = isMobileViewport;
    const currentMode = formulaSidebarState.open
      ? "open"
      : "hidden";
    setFormulaSidebarMode(currentMode);
  });

  addListener(document, "keydown", (event) => {
    const target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      const opening = !formulaSidebarState.open;
      setFormulaSidebarMode(opening ? "open" : "hidden");
      if (opening && search) search.focus();
    }
  });
};

// Global sync functions for dropdown synchronization
let syncTopicDropdown, syncYearDropdown;

const bindEvents = () => {
  // Function to sync topic dropdown - use ALL_TOPICS so options match questions.json "topic" field for filtering
  syncTopicDropdown = () => {
    if (!state.data.length) return;
    
    // Use canonical topic list so dropdown values exactly match item.topic when filtering
    const currentTopicFromState = state.topic;
    const currentTopicFromDropdown = startTopic ? startTopic.value : (topicSelect ? topicSelect.value : currentTopicFromState);
    const currentTopic = (currentTopicFromDropdown !== "choose" && currentTopicFromDropdown !== "none" && currentTopicFromDropdown !== "all")
      ? currentTopicFromDropdown
      : currentTopicFromState;
    
    const topicOptions = `<option value="all">All Topics</option>` +
      ALL_TOPICS.map((topic) => `<option value="${topic}">${topic}</option>`).join("");
    
    if (topicSelect) {
      const previousValue = topicSelect.value;
      topicSelect.innerHTML = topicOptions;
      if (currentTopic !== "all" && currentTopic !== "choose" && currentTopic !== "none" && ALL_TOPICS.includes(currentTopic)) {
        topicSelect.value = currentTopic;
      } else if (currentTopic === "all") {
        topicSelect.value = "all";
      } else {
        topicSelect.value = "all";
      }
    }
    
    if (startTopic) {
      const startTopicOptions =
        `<option value="choose">Choose Topic</option>` +
        `<option value="none">None</option>` +
        `<option value="all">All Topics</option>` +
        ALL_TOPICS.map((topic) => `<option value="${topic}">${topic}</option>`).join("");
      const previousValue = startTopic.value;
      startTopic.innerHTML = startTopicOptions;
      if (previousValue === "all") {
        startTopic.value = "all";
        if (state.topic !== "all") state.topic = "all";
      } else if (previousValue !== "choose" && previousValue !== "none" && ALL_TOPICS.includes(previousValue)) {
        startTopic.value = previousValue;
        if (state.topic !== previousValue) state.topic = previousValue;
      } else if (currentTopic === "all") {
        startTopic.value = "all";
        if (state.topic !== "all") state.topic = "all";
      } else if (currentTopic !== "choose" && currentTopic !== "none" && ALL_TOPICS.includes(currentTopic)) {
        startTopic.value = currentTopic;
      } else {
        startTopic.value = (previousValue === "choose" || previousValue === "none") ? previousValue : "choose";
      }
      
      const topicGroup = document.querySelector('.home-select-group[data-select-group="topic"]');
      if (topicGroup && topicGroup._rebuildMenu) {
        topicGroup._rebuildMenu();
      }
    }
  };

  // Function to sync year dropdown - ALWAYS show all years from entire dataset
  syncYearDropdown = () => {
    if (!state.data.length) return;
    
    // ALWAYS show all years from entire dataset, regardless of current selection
    // This allows users to select any year even if it doesn't have the selected topic
    // The filtering will happen when displaying results, not when showing dropdown options
    const availableYears = Array.from(new Set(state.data.map((item) => item.year))).sort((a, b) => parseInt(a) - parseInt(b));
    
    // Get current selections from dropdowns (not state) to preserve user's actual selections
    const currentYearFromState = state.year;
    const currentYearFromDropdown = startYear ? startYear.value : (yearSelect ? yearSelect.value : currentYearFromState);
    
    // Use the dropdown value if it's a specific year, otherwise use state
    const currentYear = (currentYearFromDropdown !== "choose" && currentYearFromDropdown !== "none" && currentYearFromDropdown !== "all") 
      ? currentYearFromDropdown 
      : currentYearFromState;
    
    const yearOptions = `<option value="all">All Years</option>` +
      availableYears.map((year) => `<option value="${year}">${year}</option>`).join("");
    
    if (yearSelect) {
      const previousValue = yearSelect.value;
      yearSelect.innerHTML = yearOptions;
      // Restore selection if still available, otherwise keep "all"
      // Don't modify state - state is managed by handleStartSelection and sidebar handlers
      if (currentYear !== "all" && currentYear !== "choose" && currentYear !== "none" && availableYears.includes(currentYear)) {
        yearSelect.value = currentYear;
      } else if (currentYear === "all") {
        yearSelect.value = "all";
      } else {
        // If current selection is not available, default to "all" for the dropdown
        // But don't modify state - let the calling function handle state updates
        yearSelect.value = "all";
      }
    }
    
    if (startYear) {
      const startYearOptions = 
        `<option value="choose">Choose Year</option>` +
        `<option value="none">None</option>` +
        `<option value="all">All Years</option>` +
        availableYears.map((year) => `<option value="${year}">${year}</option>`).join("");
      const previousValue = startYear.value;
      startYear.innerHTML = startYearOptions;
      
      const candidateYear = currentYearFromDropdown || previousValue || currentYearFromState;
      const isCandidateAll = candidateYear === "all";
      const isCandidateSpecific = candidateYear !== "choose" && candidateYear !== "none" && candidateYear !== "all" && availableYears.includes(candidateYear);

      if (isCandidateAll) {
        startYear.value = "all";
      } else if (isCandidateSpecific) {
        startYear.value = candidateYear;
      } else if (previousValue === "choose" || previousValue === "none") {
        startYear.value = previousValue;
      } else {
        startYear.value = "choose";
      }
      
      // Rebuild custom dropdown menu if it exists
      const yearGroup = document.querySelector('.home-select-group[data-select-group="year"]');
      if (yearGroup && yearGroup._rebuildMenu) {
        yearGroup._rebuildMenu();
      }
    }
  };

  addListener(yearSelect, "change", (event) => {
    const newYear = event.target.value;
    state.year = newYear;
    
    // Sync with home dropdown
    if (startYear) {
      // Map "all" to "all", specific years stay as is
      if (newYear === "all") {
        startYear.value = "all";
      } else {
        startYear.value = newYear;
      }
      // Update visual state
      syncStartSelectCards();
    }
    
    // Sync topic dropdown based on selected year (updates available topics)
    syncTopicDropdown();
    
    // Apply filters immediately
    applyFilters();
    updateHomeLock();
    closeSidebarIfAutoHide();
  });

  addListener(batchSelect, "change", (event) => {
    state.batch = event.target.value;
    applyFilters();
    closeSidebarIfAutoHide();
  });

  addListener(topicSelect, "change", (event) => {
    const newTopic = event.target.value;
    state.topic = newTopic;
    
    // Sync with home dropdown
    if (startTopic) {
      // Map "all" to "all", specific topics stay as is
      if (newTopic === "all") {
        startTopic.value = "all";
      } else {
        startTopic.value = newTopic;
      }
      // Update visual state
      syncStartSelectCards();
    }
    
    // Sync year dropdown based on selected topic (updates available years)
    syncYearDropdown();
    
    // Apply filters immediately
    applyFilters();
    updateHomeLock();
    closeSidebarIfAutoHide();
  });

  addListener(clearFilters, "click", () => {
    // Reset to "choose" state to lock the home screen
    state.year = "choose";
    state.batch = "all";
    state.topic = "choose";
    
    // Reset sidebar dropdowns
    if (yearSelect) yearSelect.value = "all";
    if (batchSelect) batchSelect.value = "all";
    if (topicSelect) topicSelect.value = "all";
    
    // Reset home dropdowns to "choose" (placeholder state)
    if (startTopic) startTopic.value = "choose";
    if (startYear) startYear.value = "choose";
    
    // Clear questions grid and results
    if (grid) grid.innerHTML = "";
    if (resultsInfo) resultsInfo.textContent = "";
    
    // Reset home dropdown visual state
    syncStartSelectCards();
    
    // Update home lock state (this will handle Question Viewing Zone visibility and scrolling)
    updateHomeLock();
    
    closeSidebarIfAutoHide();
  });

  addListener(grid, "click", (event) => {
    const solutionButton = event.target.closest(".solution-toggle");
    if (solutionButton) {
      event.preventDefault();
      event.stopPropagation();
      const button = solutionButton;
      const solution = button.nextElementSibling;
      const isOpen = solution.classList.toggle("open");
      button.textContent = isOpen ? "Hide Answer" : "Show Answer";
      button.setAttribute("aria-expanded", String(isOpen));
      if (isOpen && solution) {
        observeMathIn(solution);
      }
    }

    if (event.target.classList.contains("tag")) {
      const { year, batch, topic } = event.target.dataset;
      if (year && batch && yearSelect && batchSelect) {
        state.year = year;
        state.batch = batch;
        yearSelect.value = year;
        batchSelect.value = batch;
        if (startYear) startYear.value = year;
      }
      if (topic) {
        state.topic = topic;
        if (topicSelect) topicSelect.value = topic;
        if (startTopic) startTopic.value = topic;
      }
      applyFilters();
      closeSidebarIfAutoHide();
    }
  });

  addListener(window, "scroll", () => {
    const scrollTop = document.documentElement.scrollTop;
    const scrollHeight =
      document.documentElement.scrollHeight -
      document.documentElement.clientHeight;
    const progress = scrollHeight ? (scrollTop / scrollHeight) * 100 : 0;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (backToTop) backToTop.classList.toggle("show", scrollTop > 300);
    const hero = document.querySelector(".hero");
    if (hero) {
      hero.style.backgroundPositionY = `${scrollTop * 0.2}px`;
    }
    if (topNav) {
      topNav.classList.toggle("compact", scrollTop > 40);
      topNav.classList.toggle("scrolled", scrollTop > 120);
    }
  });

  addListener(backToTop, "click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Sidebar and its controls were removed from the UI; related listeners dropped.

  const handleStartSelection = (event) => {
    if (!startTopic || !startYear) return;
    
    // Read current values from both dropdowns (source of truth)
    const topicValue = startTopic.value;
    const yearValue = startYear.value;
    const requestedTopic = topicValue;
    const requestedYear = yearValue;
    const previousTopic = topicValue;
    const previousYear = yearValue;
    
    // Handle "none" selection - convert to "choose"
    if (topicValue === "none") {
      startTopic.value = "choose";
      state.topic = "choose";
    } else {
      state.topic = topicValue;
    }
    
    if (yearValue === "none") {
      startYear.value = "choose";
      state.year = "choose";
    } else {
      state.year = yearValue;
    }
    
    console.log("handleStartSelection: State updated - topic:", state.topic, "year:", state.year);
    
    // Sync dropdowns to update available options
    // Avoid rebuilding home selects on home change to prevent value resets
    const isHomeChange = event && (event.target === startTopic || event.target === startYear);
    if (!isHomeChange) {
      syncTopicDropdown();
      syncYearDropdown();
    }
    
    // After syncing, preserve the user's selection
    // Re-read dropdown values to ensure they weren't changed by sync
    let finalTopicValue = startTopic.value;
    let finalYearValue = startYear.value;
    
    // Force user selection to persist even if sync rebuilt options
    const topicExists = requestedTopic && Array.from(startTopic.options).some(opt => opt.value === requestedTopic);
    const yearExists = requestedYear && Array.from(startYear.options).some(opt => opt.value === requestedYear);

    if (requestedTopic === "all" || (requestedTopic && requestedTopic !== "choose" && requestedTopic !== "none" && topicExists)) {
      startTopic.value = requestedTopic;
      finalTopicValue = requestedTopic;
    } else if (previousTopic === "all") {
      // Preserve existing "all" selection when the other dropdown changes
      startTopic.value = "all";
      finalTopicValue = "all";
    }

    if (requestedYear === "all" || (requestedYear && requestedYear !== "choose" && requestedYear !== "none" && yearExists)) {
      startYear.value = requestedYear;
      finalYearValue = requestedYear;
    } else if (previousYear === "all") {
      // Preserve existing "all" selection when the other dropdown changes
      startYear.value = "all";
      finalYearValue = "all";
    }
    
    // Update state to match final dropdown values (after forced all)
    // Normalize "none" back to "choose" to avoid blocking filters
    const normalizedTopic = finalTopicValue === "none" ? "choose" : finalTopicValue;
    const normalizedYear = finalYearValue === "none" ? "choose" : finalYearValue;
    state.topic = normalizedTopic;
    state.year = normalizedYear;
    
    console.log("handleStartSelection: Final state - topic:", state.topic, "year:", state.year);
    
    
    
    // Sync with sidebar filters - update sidebar dropdowns to match home dropdowns
    // Convert "choose" to "all" only for sidebar compatibility, but keep "choose" in state for filtering
    if (state.year === "all" || (state.year !== "choose" && state.year !== "none")) {
      if (yearSelect) {
    yearSelect.value = state.year;
      }
    } else if (state.year === "choose" || state.year === "none") {
      // Reset sidebar year filter to "all" when home dropdown is reset
      // But keep state.year as "choose" so filtering works correctly
      if (yearSelect) yearSelect.value = "all";
      // Don't change state.year - keep it as "choose" for proper filtering
    }
    
    if (state.topic === "all" || (state.topic !== "choose" && state.topic !== "none")) {
      if (topicSelect) {
        topicSelect.value = state.topic;
      }
    } else if (state.topic === "choose" || state.topic === "none") {
      // Reset sidebar topic filter to "all" when home dropdown is reset
      // But keep state.topic as "choose" so filtering works correctly
      if (topicSelect) topicSelect.value = "all";
      // Don't change state.topic - keep it as "choose" for proper filtering
    }
    
    // Update dropdown visual state
    syncStartSelectCards();
    
    // Apply filters and update home lock immediately
    // filterData treats "choose" as "all" (match everything), so filtering will work correctly
    applyFilters();
    updateHomeLock();
    
    // Scroll to questions if unlocked
    if (!document.body.classList.contains("home-locked")) {
      scrollToQuestionsSection("smooth");
    }
  };

  addListener(startTopic, "change", (event) => handleStartSelection(event));
  addListener(startYear, "change", (event) => handleStartSelection(event));

  addListener(termsFilter, "click", (event) => {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    state.termsFilterMode = button.dataset.mode || "all";
    renderTermsConcepts();
  });

  addListener(darkModeToggle, "click", () => {
    toggleDarkMode();
  });

  if (navMenuBtn && navDrawer && navDrawerBackdrop) {
    addListener(navMenuBtn, "click", () => {
      const open = document.body.classList.toggle("nav-drawer-open");
      navMenuBtn.setAttribute("aria-expanded", open);
      navMenuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      navDrawer.setAttribute("aria-hidden", !open);
    });
    addListener(navDrawerBackdrop, "click", () => {
      document.body.classList.remove("nav-drawer-open");
      navMenuBtn.setAttribute("aria-expanded", "false");
      navMenuBtn.setAttribute("aria-label", "Open menu");
      navDrawer.setAttribute("aria-hidden", "true");
    });
    navDrawer.querySelectorAll(".nav-drawer__link").forEach((link) => {
      addListener(link, "click", () => {
        document.body.classList.remove("nav-drawer-open");
        if (navMenuBtn) navMenuBtn.setAttribute("aria-expanded", "false");
        navDrawer.setAttribute("aria-hidden", "true");
      });
    });
  }

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document
        .querySelectorAll(".nav-link")
        .forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
      updateHomeViewFromHash();
    });
  });

  const sections = ["home", "questions", "about"];
  addListener(window, "scroll", () => {
    const scrollPos = window.scrollY + 140;
    let current = "home";
    sections.forEach((id) => {
      const section = document.getElementById(id);
      if (section && section.offsetTop <= scrollPos) {
        current = id;
      }
    });
    document.querySelectorAll(".nav-link").forEach((item) => {
      item.classList.toggle("active", item.getAttribute("href") === `#${current}`);
    });
  });

  addListener(window, "resize", () => {
    if (!isDesktop()) {
      isPinned = false;
      setSidebarOpen(false);
    } else {
      document.body.classList.remove("nav-drawer-open");
      if (navMenuBtn) navMenuBtn.setAttribute("aria-expanded", "false");
      if (navDrawer) navDrawer.setAttribute("aria-hidden", "true");
      isPinned = loadPinnedPreference();
      if (isPinned) {
        setSidebarOpen(true);
      }
    }
    syncPinToggle();
    syncHeaderSpacing();
  });

  addListener(window, "pageshow", syncHeaderSpacing);

  bindBottomNav();
};

const init = async () => {
  const hasQuestionUI = Boolean(grid && resultsInfo);
  const hasTermsUI = Boolean(
    termsGrid &&
      conceptsGrid &&
      termsSection &&
      conceptsSection &&
      termsFilter &&
      termsEmpty
  );

  if (hasQuestionUI) {
    try {
    // Populate filters immediately with hardcoded topics
    renderFilters();
    
    // Then load data in background
    renderSkeletons();
      await loadQuestionsData();
    // Update filters with loaded data (years, batches, etc)
    renderFilters();
      // Sync dropdowns after data loads
      if (syncTopicDropdown && syncYearDropdown) {
        syncTopicDropdown();
        syncYearDropdown();
      }
      
      // CRITICAL: Sync state from dropdowns before initial render
      // This ensures that if dropdowns are set to "all", state is also "all"
      if (startTopic) {
        const topicValue = startTopic.value;
        if (topicValue === "all") {
          state.topic = "all";
        } else if (topicValue !== "choose" && topicValue !== "none") {
          state.topic = topicValue;
        }
      }
      
      if (startYear) {
        const yearValue = startYear.value;
        if (yearValue === "all") {
          state.year = "all";
        } else if (yearValue !== "choose" && yearValue !== "none") {
          state.year = yearValue;
        }
      }
      
      console.log("init: Initial state after sync - topic:", state.topic, "year:", state.year);
      
      // Call applyFilters instead of renderCards directly
      // This ensures state is synced from dropdowns before rendering
      applyFilters();
    } catch (error) {
      console.error("Failed to load questions:", error);
      if (resultsInfo) {
        resultsInfo.textContent = getLoadErrorMessage("questions");
      }
      if (emptyState) {
        emptyState.querySelector("h3").textContent = "Questions unavailable";
        emptyState.querySelector("p").textContent = getLoadErrorMessage("questions");
        emptyState.classList.remove("hidden");
      }
      if (grid) grid.innerHTML = "";
    }
  }

  if (hasTermsUI) {
    try {
      await loadTermsConceptsData();
      renderTermsConcepts();
    } catch (error) {
      console.error("Failed to load terms and concepts:", error);
      if (termsEmpty) {
        termsEmpty.querySelector("h3").textContent = "Terms unavailable";
        termsEmpty.querySelector("p").textContent = getLoadErrorMessage("terms and concepts");
        termsEmpty.classList.remove("hidden");
      }
      if (termsGrid) termsGrid.innerHTML = "";
      if (conceptsGrid) conceptsGrid.innerHTML = "";
    }
  }

  isPinned = false;
  syncPinToggle();
  setSidebarOpen(false);

  bindEvents();
  await initFormulaSidebar();
  
  // Initialize home page state
  if (document.body.classList.contains("home-page")) {
    // Ensure Question Viewing Zone is hidden initially
    const questionsSection = document.querySelector('.questions-section');
    if (questionsSection) {
      questionsSection.classList.remove('is-active');
    }
    // Ensure scrolling is disabled initially
    document.body.style.overflowY = 'hidden';
    document.body.style.overflowX = 'hidden';
  }
  
  updateHomeLock();
  updateHomeViewFromHash();
  addListener(window, "hashchange", updateHomeViewFromHash);
  initHomeBackground();
  initPageBackground();
  syncHeaderSpacing();
  // IMPORTANT: initHomeDropdowns MUST run AFTER renderFilters populates the select elements
  // Otherwise the custom dropdown menu will be empty on first load
  // It will be called after renderFilters() in the hasQuestionUI block

};

init();
