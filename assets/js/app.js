const DATA_URL = "assets/data/questions.json";
const FORMULA_URL = "assets/data/formulas.json";
const QUIZ_URL = "assets/data/quiz.json";
const QUIZ_STORAGE_KEY = "quizProgressV2";

const state = {
  year: "all",
  batch: "all",
  topic: "all",
  search: "",
  data: [],
  formulas: [],
};

const quizState = {
  questions: [],
  currentIndex: 0,
  score: 0,
  answered: false,
  selectedTopic: "all",
  selectedDifficulty: "all",
  currentQuestions: [],
  scoredQuestions: new Set(),
};

const grid = document.getElementById("question-grid");
const yearSelect = document.getElementById("year-select");
const batchSelect = document.getElementById("batch-select");
const topicSelect = document.getElementById("topic-select");
const searchInput = document.getElementById("search-input");
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
const formulaSearch = document.getElementById("formula-search");
const formulaTopic = document.getElementById("formula-topic");
const formulaGroups = document.getElementById("formula-groups");
const formulaEmpty = document.getElementById("formula-empty");
const topNav = document.getElementById("top-nav");
const globalSearchToggle = document.getElementById("global-search-toggle");
const globalSearch = document.getElementById("global-search");
const globalSearchInput = document.getElementById("global-search-input");
const globalSearchResults = document.getElementById("global-search-results");

const yearRange = Array.from({ length: 15 }, (_, i) => 2011 + i);
const SIDEBAR_PIN_KEY = "sidebarPinned";
const BATCH_STATE_KEY = "batchState";
let isPinned = true;

const isDesktop = () => window.matchMedia("(min-width: 1025px)").matches;
const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

const addListener = (element, eventName, handler) => {
  if (element) {
    element.addEventListener(eventName, handler);
  }
};

const randomBetween = (min, max, step = 1, decimals = 3) => {
  const steps = Math.floor((max - min) / step);
  const value = min + Math.floor(Math.random() * (steps + 1)) * step;
  return Number(value.toFixed(decimals));
};

const formatNumber = (value, decimals = 3) => Number(value.toFixed(decimals));

const parseNumericInput = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return NaN;
  const fractionMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (denominator === 0) return NaN;
    return numerator / denominator;
  }
  return Number.parseFloat(trimmed);
};

const setSidebarOpen = (open) => {
  sidebar.classList.toggle("open", open);
  hamburger.classList.toggle("open", open);
  document.body.classList.toggle("sidebar-open", open);
  hamburger.setAttribute("aria-expanded", open ? "true" : "false");
};

const loadPinnedPreference = () => {
  const stored = localStorage.getItem(SIDEBAR_PIN_KEY);
  if (stored === null) return false;
  return stored === "true";
};

const syncPinToggle = () => {
  pinToggle.checked = isPinned;
  pinToggle.disabled = !isDesktop();
};

const closeSidebarIfAutoHide = () => {
  if (!isPinned || !isDesktop()) {
    setSidebarOpen(false);
  }
};

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

const allowBasicTags = (html) =>
  html
    .replace(/&lt;br&gt;/gi, "<br>")
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
    .replace(/&lt;\/sub&gt;/gi, "</sub>");

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
  return safeText.replace(regex, "<mark>$1</mark>");
};

const typesetMath = () => {
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise();
  }
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
  if (!yearSelect || !batchSelect || !topicSelect || !startTopic || !startYear) return;
  yearRange.forEach((year) => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = year;
    yearSelect.appendChild(option);
  });

  const batches = Array.from(
    new Set(state.data.map((item) => item.batch))
  ).sort();
  batches.forEach((batch) => {
    const option = document.createElement("option");
    option.value = batch;
    option.textContent = batch;
    batchSelect.appendChild(option);
  });

  const topics = Array.from(new Set(state.data.map((item) => item.topic))).sort();
  topicSelect.innerHTML =
    `<option value="all">All Topics</option>` +
    topics.map((topic) => `<option value="${topic}">${topic}</option>`).join("");

  startTopic.innerHTML =
    `<option value="all">All Topics</option>` +
    topics.map((topic) => `<option value="${topic}">${topic}</option>`).join("");
  startTopic.value = state.topic;

  startYear.innerHTML =
    `<option value="all">All Years</option>` +
    yearRange.map((year) => `<option value="${year}">${year}</option>`).join("");
  startYear.value = state.year;
};

const updateActiveChips = () => {
  const chips = [];
  if (state.year !== "all") chips.push(`Year: ${state.year}`);
  if (state.batch !== "all") chips.push(`Batch: ${state.batch}`);
  if (state.topic !== "all") chips.push(`Topic: ${state.topic}`);
  if (state.search.trim()) chips.push(`Search: "${state.search.trim()}"`);

  activeChips.innerHTML = chips
    .map((chip) => `<span class="chip">${chip}</span>`)
    .join("");
};

const filterData = () =>
  state.data.filter((item) => {
    const matchesYear = state.year === "all" || item.year === state.year;
    const matchesBatch = state.batch === "all" || item.batch === state.batch;
    const matchesTopic = state.topic === "all" || item.topic === state.topic;
    const query = state.search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      item.question.toLowerCase().includes(query) ||
      item.topic.toLowerCase().includes(query) ||
      `${item.year} ${item.batch}`.toLowerCase().includes(query);
    return matchesYear && matchesBatch && matchesTopic && matchesSearch;
  });

const buildCardHtml = (item, index = 0) => {
  const question = buildHighlights(item.question, state.search);
  const solution = buildHighlights(item.solution, state.search);
  const yearTag = `${item.year} - ${item.batch}`;
  const questionImage = item.image
    ? `<div class="card__image show">
         <img src="${item.image}" alt="Question figure" loading="lazy" />
         ${item.imageCaption ? `<span class="image-caption">${item.imageCaption}</span>` : ""}
       </div>`
    : `<div class="card__image"></div>`;
  const solutionImage = item.solutionImage
    ? `<div class="card__image show">
         <img src="${item.solutionImage}" alt="Solution figure" loading="lazy" />
         ${item.solutionImageCaption ? `<span class="image-caption">${item.solutionImageCaption}</span>` : ""}
       </div>`
    : "";
  const finalAnswer = item.finalAnswer
    ? `<div class="final-answer">
         <span>Final Answer</span>
         <p>${buildHighlights(item.finalAnswer, state.search)}</p>
       </div>`
    : "";

  return `
    <article class="card question-card" style="--stagger: ${index * 40}ms;">
      <div class="card__header">
        <span>Question ${item.number}</span>
        <span>${item.topic}</span>
      </div>
      <div class="card__meta">${item.year} • ${item.batch}</div>
      <div class="card__question">${question}</div>
      ${questionImage}
      <button class="btn btn--primary solution-toggle">Show Solution</button>
      <div class="solution">
        <div class="solution-content">${solution}</div>
        ${solutionImage}
        ${finalAnswer}
      </div>
      <div class="tags">
        <span class="tag" data-year="${item.year}" data-batch="${
    item.batch
  }">${yearTag}</span>
        <span class="tag" data-topic="${item.topic}">${item.topic}</span>
      </div>
    </article>
  `;
};

const renderTimeline = (items) => {
  grid.classList.remove("grid");
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

const renderGrid = (items) => {
  grid.classList.remove("timeline");
  grid.classList.add("grid");
  grid.innerHTML = items.map((item, index) => buildCardHtml(item, index)).join("");
};

const renderCards = () => {
  if (!grid || !resultsInfo || !emptyState || !activeChips) return;
  const filtered = filterData();
  const isAllView =
    state.year === "all" &&
    state.batch === "all" &&
    state.topic === "all" &&
    !state.search.trim();

  updateActiveChips();
  resultsInfo.textContent = isAllView
    ? `${filtered.length} questions grouped by year.`
    : `${filtered.length} question${filtered.length === 1 ? "" : "s"} found.`;
  emptyState.classList.toggle("hidden", filtered.length > 0);

  if (filtered.length === 0) {
    grid.innerHTML = "";
    return;
  }

  if (isAllView) {
    renderTimeline(filtered);
  } else {
    renderGrid(filtered);
  }

  typesetMath();
  requestAnimationFrame(() => {
    document.querySelectorAll(".year-header.reveal").forEach((header) => {
      if (!observer) {
        header.classList.add("is-visible");
        return;
      }
      observer.observe(header);
    });
  });
};

const getLoadErrorMessage = (label) => {
  const base = `Unable to load ${label}.`;
  if (window.location.protocol === "file:") {
    return `${base} Open the site with a local server (not file://).`;
  }
  return `${base} Please check your network and refresh.`;
};

const applyFilters = () => {
  renderCards();
  updateHomeLock();
};

const syncStartSelectCards = () => {
  if (!startReviewCards.length) return;
  startReviewCards.forEach((card) => {
    const select = card.querySelector("select");
    if (!select) return;
    card.classList.toggle("has-selection", select.value !== "all");
  });
};

const updateHomeLock = () => {
  if (!document.body.classList.contains("home-page")) return;
  const hasSelection = state.topic !== "all" || state.year !== "all";
  const shouldLock = !hasSelection && !document.body.classList.contains("home-show-all");
  document.body.classList.toggle("home-locked", shouldLock);
  syncStartSelectCards();
};

const initHomeBackground = () => {
  if (!document.body.classList.contains("home-page")) return;
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

const updateHomeViewFromHash = () => {
  if (!document.body.classList.contains("home-page")) return;
  const hash = window.location.hash;
  const showAll = hash === "#formulas" || hash === "#about";
  document.body.classList.toggle("home-show-all", showAll);
  if (showAll) {
    document.body.classList.remove("home-locked");
  } else {
    updateHomeLock();
  }
};

const clearGlobalSearchResults = () => {
  if (!globalSearchResults) return;
  globalSearchResults.classList.remove("show");
  globalSearchResults.innerHTML = "";
};

const updateSidebarSearch = (value) => {
  state.search = value ?? "";
  applyFilters();
};

const buildFormulaGroups = (formulas, query) => {
  if (!formulaGroups) return;
  const grouped = formulas.reduce((acc, formula) => {
    if (!acc[formula.topic]) acc[formula.topic] = [];
    acc[formula.topic].push(formula);
    return acc;
  }, {});

  const topics = Object.keys(grouped).sort();
  formulaGroups.innerHTML = topics
    .map((topic) => {
      const cards = grouped[topic]
        .map(
          (item) => `
            <div class="formula-card">
              <div class="formula-card__formula">${item.formula}</div>
              <p>${buildHighlights(item.description, query)}</p>
            </div>
          `
        )
        .join("");

      return `
        <article class="formula-group">
          <div class="formula-group__header">
            <h3>${topic}</h3>
            <span>+</span>
          </div>
          <div class="formula-group__content">
            ${cards}
          </div>
        </article>
      `;
    })
    .join("");
};

const filterFormulas = () => {
  if (!formulaSearch || !formulaTopic || !formulaGroups || !formulaEmpty) return;
  const query = formulaSearch.value.trim().toLowerCase();
  const topic = formulaTopic.value;
  const filtered = state.formulas.filter((item) => {
    const matchesTopic = topic === "all" || item.topic === topic;
    const matchesQuery =
      !query ||
      item.description.toLowerCase().includes(query) ||
      item.formula.toLowerCase().includes(query) ||
      item.topic.toLowerCase().includes(query);
    return matchesTopic && matchesQuery;
  });

  buildFormulaGroups(filtered, query);
  formulaEmpty.classList.toggle("hidden", filtered.length > 0);
  typesetMath();
};

const renderFormulaFilters = () => {
  if (!formulaTopic) return;
  const topics = Array.from(new Set(state.formulas.map((f) => f.topic))).sort();
  formulaTopic.innerHTML =
    `<option value="all">All Topics</option>` +
    topics.map((topic) => `<option value="${topic}">${topic}</option>`).join("");
};

const renderGlobalResults = (query) => {
  if (!globalSearchResults) return;
  if (!query.trim()) {
    globalSearchResults.classList.remove("show");
    globalSearchResults.innerHTML = "";
    return;
  }

  const matches = [];
  state.data.forEach((item) => {
    const haystack = `${item.question} ${item.topic} ${item.year} ${item.batch}`;
    if (haystack.toLowerCase().includes(query.toLowerCase())) {
      matches.push({
        label: `Q${item.number} - ${item.topic}`,
        detail: item.question,
        target: "#questions",
        type: "question",
      });
    }
  });

  state.formulas.forEach((item) => {
    const haystack = `${item.description} ${item.topic} ${item.formula}`;
    if (haystack.toLowerCase().includes(query.toLowerCase())) {
      matches.push({
        label: `${item.topic} Formula`,
        detail: item.description,
        target: "#formulas",
        type: "formula",
      });
    }
  });

  globalSearchResults.innerHTML = matches
    .slice(0, 8)
    .map(
      (item) => `
        <div class="global-search__item" data-target="${item.target}">
          <strong>${buildHighlights(item.label, query)}</strong>
          <div>${buildHighlights(item.detail, query)}</div>
        </div>
      `
    )
    .join("");
  if (!matches.length) {
    globalSearchResults.innerHTML = `
      <div class="global-search__item">
        <strong>No matches found</strong>
        <div>Try another keyword or topic.</div>
      </div>
    `;
  }
  globalSearchResults.classList.toggle("show", true);
};

const loadQuestionsData = async () => {
  if (state.data.length) return;
  const response = await fetch(DATA_URL);
  state.data = await response.json();
};

const loadFormulaData = async () => {
  if (state.formulas.length) return;
  const response = await fetch(FORMULA_URL);
  state.formulas = await response.json();
};

const bindEvents = () => {
  addListener(yearSelect, "change", (event) => {
    state.year = event.target.value;
    if (startYear) startYear.value = state.year;
    applyFilters();
    closeSidebarIfAutoHide();
  });

  addListener(batchSelect, "change", (event) => {
    state.batch = event.target.value;
    applyFilters();
    closeSidebarIfAutoHide();
  });

  addListener(topicSelect, "change", (event) => {
    state.topic = event.target.value;
    if (startTopic) startTopic.value = state.topic;
    applyFilters();
    closeSidebarIfAutoHide();
  });

  addListener(searchInput, "input", (event) => {
    updateSidebarSearch(event.target.value);
  });

  addListener(clearFilters, "click", () => {
    state.year = "all";
    state.batch = "all";
    state.topic = "all";
    state.search = "";
    if (yearSelect) yearSelect.value = "all";
    if (batchSelect) batchSelect.value = "all";
    if (topicSelect) topicSelect.value = "all";
    if (searchInput) searchInput.value = "";
    if (startTopic) startTopic.value = "all";
    if (startYear) startYear.value = "all";
    applyFilters();
    closeSidebarIfAutoHide();
  });

  addListener(grid, "click", (event) => {
    if (event.target.classList.contains("solution-toggle")) {
      const button = event.target;
      const solution = button.nextElementSibling;
      const isOpen = solution.classList.toggle("open");
      button.textContent = isOpen ? "Hide Solution" : "Show Solution";
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

  addListener(hamburger, "click", () => {
    if (sidebar) setSidebarOpen(!sidebar.classList.contains("open"));
  });

  addListener(hideSidebarButton, "click", () => {
    isPinned = false;
    localStorage.setItem(SIDEBAR_PIN_KEY, "false");
    syncPinToggle();
    setSidebarOpen(false);
  });

  addListener(pinToggle, "change", (event) => {
    isPinned = event.target.checked;
    localStorage.setItem(SIDEBAR_PIN_KEY, String(isPinned));
    if (isPinned && isDesktop()) {
      setSidebarOpen(true);
    } else if (!isPinned) {
      setSidebarOpen(false);
    }
  });

  addListener(sidebar, "click", (event) => {
    if (event.target.tagName === "A") {
      closeSidebarIfAutoHide();
    }
  });

  addListener(document, "keydown", (event) => {
    if (event.key === "Escape") {
      setSidebarOpen(false);
    }
  });

  const handleStartSelection = () => {
    if (!startTopic || !startYear || !yearSelect) return;
    state.topic = startTopic.value;
    state.year = startYear.value;
    yearSelect.value = state.year;
    if (topicSelect) topicSelect.value = state.topic;
    applyFilters();
    const questionsSection = document.getElementById("questions");
    if (questionsSection && !document.body.classList.contains("home-locked")) {
      questionsSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  addListener(startTopic, "change", handleStartSelection);
  addListener(startYear, "change", handleStartSelection);

  addListener(formulaSearch, "input", filterFormulas);
  addListener(formulaTopic, "change", filterFormulas);

  addListener(formulaGroups, "click", (event) => {
    const header = event.target.closest(".formula-group__header");
    if (!header) return;
    const group = header.parentElement;
    group.classList.toggle("open");
    const indicator = header.querySelector("span");
    if (indicator) {
      indicator.textContent = group.classList.contains("open") ? "-" : "+";
    }
  });

  addListener(globalSearchToggle, "click", () => {
    if (!topNav) return;
    topNav.classList.toggle("search-open");
    if (topNav.classList.contains("search-open") && globalSearchInput) {
      globalSearchInput.focus();
      if (globalSearchInput.value.trim()) {
        renderGlobalResults(globalSearchInput.value);
      }
    } else {
      clearGlobalSearchResults();
    }
  });

  addListener(globalSearchInput, "input", (event) => {
    renderGlobalResults(event.target.value);
  });

  addListener(globalSearchResults, "click", (event) => {
    const item = event.target.closest(".global-search__item");
    if (!item) return;
    const target = item.dataset.target;
    const targetElement = document.querySelector(target);
    if (targetElement) targetElement.scrollIntoView({ behavior: "smooth" });
    if (topNav) topNav.classList.remove("search-open");
    clearGlobalSearchResults();
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document
        .querySelectorAll(".nav-link")
        .forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
      updateHomeViewFromHash();
    });
  });

  const sections = ["home", "questions", "quiz", "formulas", "about"];
  addListener(window, "scroll", () => {
    if (document.body.classList.contains("quiz-page")) return;
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

  addListener(document, "click", (event) => {
    if (!globalSearch || !globalSearchToggle || !topNav || !globalSearchResults) return;
    if (!globalSearch.contains(event.target) && event.target !== globalSearchToggle) {
      topNav.classList.remove("search-open");
      clearGlobalSearchResults();
    }
  });

  addListener(window, "resize", () => {
    if (!isDesktop()) {
      isPinned = false;
      setSidebarOpen(false);
    } else {
      isPinned = loadPinnedPreference();
      if (isPinned) {
        setSidebarOpen(true);
      }
    }
    syncPinToggle();
  });
};

// ========== QUIZ FUNCTIONALITY ==========

const quizElements = {
  pageBack: document.getElementById("quiz-page-back"),
  header: document.getElementById("quiz-header"),
  headerCurrent: document.getElementById("quiz-h-current"),
  headerCount: document.getElementById("quiz-h-count"),
  headerScore: document.getElementById("quiz-h-score"),
  headerTotal: document.getElementById("quiz-h-total"),
  headerProgress: document.getElementById("quiz-h-progress"),
  headerBack: document.getElementById("quiz-back-btn"),
  start: document.getElementById("quiz-start"),
  main: document.getElementById("quiz-main"),
  complete: document.getElementById("quiz-complete"),
  topicSelect: document.getElementById("quiz-topic-select"),
  difficultySelect: document.getElementById("quiz-difficulty-select"),
  startBtn: document.getElementById("quiz-start-btn"),
  resumeBtn: document.getElementById("quiz-resume-btn"),
  question: document.getElementById("quiz-question"),
  topic: document.getElementById("quiz-topic"),
  difficultyBadge: document.getElementById("quiz-difficulty-badge"),
  hintBtn: document.getElementById("quiz-hint-btn"),
  hint: document.getElementById("quiz-hint"),
  hintText: document.getElementById("quiz-hint-text"),
  answerInput: document.getElementById("quiz-answer-input"),
  unit: document.getElementById("quiz-unit"),
  submitBtn: document.getElementById("quiz-submit-btn"),
  feedback: document.getElementById("quiz-feedback"),
  feedbackIcon: document.getElementById("quiz-feedback-icon"),
  feedbackMessage: document.getElementById("quiz-feedback-message"),
  feedbackDetail: document.getElementById("quiz-feedback-detail"),
  mistakeHint: document.getElementById("quiz-mistake-hint"),
  solutionPanel: document.getElementById("quiz-solution-panel"),
  solutionContent: document.getElementById("quiz-solution-content"),
  solutionToggle: document.getElementById("quiz-solution-toggle"),
  keyFormula: document.getElementById("quiz-key-formula"),
  keyFormulaText: document.getElementById("quiz-key-formula-text"),
  correctAnswer: document.getElementById("quiz-correct-answer"),
  finalAnswer: document.getElementById("quiz-final-answer"),
  nextBtn: document.getElementById("quiz-next-btn"),
  restartBtn: document.getElementById("quiz-restart-btn"),
  retryProblemBtn: document.getElementById("quiz-retry-problem-btn"),
  retryBtn: document.getElementById("quiz-retry-btn"),
  newTopicBtn: document.getElementById("quiz-new-topic-btn"),
  cardProgress: document.getElementById("quiz-card-progress"),
  cardCounter: document.getElementById("quiz-card-counter"),
  finalScore: document.getElementById("final-score"),
  finalTotal: document.getElementById("final-total"),
  scorePercentage: document.getElementById("score-percentage"),
  scoreRating: document.getElementById("score-rating"),
  imageContainer: document.getElementById("quiz-image-container"),
  image: document.getElementById("quiz-image"),
  imageCaption: document.getElementById("quiz-image-caption"),
  solutionImageContainer: document.getElementById("quiz-solution-image-container"),
  solutionImage: document.getElementById("quiz-solution-image"),
  solutionImageCaption: document.getElementById("quiz-solution-image-caption"),
};

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const difficultyLabels = {
  easy: "Easy",
  medium: "Moderate",
  hard: "Board-level",
};

const topicFormulaMap = {
  "Pipe Flow": "Q = A × V",
  "Open Channel Flow": "Fr = V / √(g × y)",
  "Pump Calculations": "P = (ρ × g × Q × H) / η",
  "Fluid Properties": "γ = ρ × g",
  "Hydrostatics": "p = γ × h",
};

const generateDynamicQuestions = () => {
  const questions = [];
  const pipeDiameter = randomBetween(0.2, 0.6, 0.05, 3);
  const pipeVelocity = randomBetween(1.5, 3.5, 0.1, 3);
  const pipeArea = (Math.PI * pipeDiameter ** 2) / 4;
  const pipeFlow = pipeArea * pipeVelocity * 1000;
  questions.push({
    id: `dyn-pipe-${pipeDiameter}-${pipeVelocity}`,
    topic: "Pipe Flow",
    difficulty: "medium",
    question: `A ${formatNumber(pipeDiameter * 1000, 0)}-mm diameter pipe carries water at a velocity of ${formatNumber(pipeVelocity, 2)} m/s. Calculate the flow rate in L/s.`,
    hint: "Use Q = A × V and convert m³/s to L/s.",
    solution: `Given:\n- Diameter, D = ${formatNumber(pipeDiameter * 1000, 0)} mm = ${formatNumber(pipeDiameter, 3)} m\n- Velocity, V = ${formatNumber(pipeVelocity, 2)} m/s\n\nStep 1: Area\n$$A = \\frac{\\pi D^2}{4} = ${formatNumber(pipeArea, 4)} \\text{ m}^2$$\n\nStep 2: Flow\n$$Q = A \\times V = ${formatNumber(pipeArea, 4)} \\times ${formatNumber(pipeVelocity, 2)} = ${formatNumber(pipeArea * pipeVelocity, 4)} \\text{ m}^3/\\text{s}$$\n\nStep 3: Convert\n$$Q = ${formatNumber(pipeFlow, 1)} \\text{ L/s}$$`,
    answer: formatNumber(pipeFlow, 1),
    tolerance: 0.5,
    unit: "L/s",
    keyFormula: "Q = A × V",
  });

  const depth = randomBetween(1.0, 3.0, 0.25, 2);
  const velocity = randomBetween(1.5, 4.0, 0.1, 2);
  const froude = velocity / Math.sqrt(9.81 * depth);
  questions.push({
    id: `dyn-froude-${depth}-${velocity}`,
    topic: "Open Channel Flow",
    difficulty: "hard",
    question: `A rectangular channel flows at depth ${formatNumber(depth, 2)} m with velocity ${formatNumber(velocity, 2)} m/s. Compute the Froude number.`,
    hint: "Use Fr = V / √(g × y).",
    solution: `Given:\n- Depth, y = ${formatNumber(depth, 2)} m\n- Velocity, V = ${formatNumber(velocity, 2)} m/s\n\n$$Fr = \\frac{V}{\\sqrt{g y}} = \\frac{${formatNumber(velocity, 2)}}{\\sqrt{9.81 \\times ${formatNumber(depth, 2)}}} = ${formatNumber(froude, 3)}$$`,
    answer: formatNumber(froude, 3),
    tolerance: 0.02,
    unit: "",
    keyFormula: "Fr = V / √(g × y)",
  });

  const flow = randomBetween(0.03, 0.08, 0.005, 3);
  const head = randomBetween(18, 35, 1, 2);
  const efficiency = randomBetween(0.65, 0.85, 0.05, 2);
  const power = (1000 * 9.81 * flow * head) / efficiency / 1000;
  questions.push({
    id: `dyn-pump-${flow}-${head}`,
    topic: "Pump Calculations",
    difficulty: "medium",
    question: `A pump delivers ${formatNumber(flow * 1000, 1)} L/s against a head of ${formatNumber(head, 1)} m with efficiency ${formatNumber(efficiency * 100, 0)}%. Calculate the input power in kW.`,
    hint: "Power = (ρ g Q H) / η.",
    solution: `Given:\n- Q = ${formatNumber(flow, 3)} m³/s\n- H = ${formatNumber(head, 1)} m\n- η = ${formatNumber(efficiency, 2)}\n\n$$P = \\frac{1000 \\times 9.81 \\times ${formatNumber(flow, 3)} \\times ${formatNumber(head, 1)}}{${formatNumber(efficiency, 2)}} = ${formatNumber(power, 2)} \\text{ kW}$$`,
    answer: formatNumber(power, 2),
    tolerance: 0.2,
    unit: "kW",
    keyFormula: "P = (ρ × g × Q × H) / η",
  });

  const density = randomBetween(780, 1050, 10, 0);
  const specificWeight = density * 9.81;
  questions.push({
    id: `dyn-weight-${density}`,
    topic: "Fluid Properties",
    difficulty: "easy",
    question: `Compute the specific weight of a fluid with density ${density} kg/m³.`,
    hint: "γ = ρ × g.",
    solution: `$$\\gamma = ${density} \\times 9.81 = ${formatNumber(specificWeight, 1)} \\text{ N/m}^3$$`,
    answer: formatNumber(specificWeight, 1),
    tolerance: 1,
    unit: "N/m³",
    keyFormula: "γ = ρ × g",
  });

  const depthPressure = randomBetween(8, 25, 1, 0);
  const pressure = depthPressure * 9.81;
  questions.push({
    id: `dyn-pressure-${depthPressure}`,
    topic: "Hydrostatics",
    difficulty: "easy",
    question: `Find the hydrostatic pressure at a depth of ${depthPressure} m in water. Provide answer in kPa.`,
    hint: "p = γ × h (γ = 9.81 kN/m³).",
    solution: `$$p = 9.81 \\times ${depthPressure} = ${formatNumber(pressure, 2)} \\text{ kPa}$$`,
    answer: formatNumber(pressure, 2),
    tolerance: 0.5,
    unit: "kPa",
    keyFormula: "p = γ × h",
  });

  return questions;
};

const saveQuizProgress = () => {
  if (!quizState.currentQuestions.length) return;
  const payload = {
    selectedTopic: quizState.selectedTopic,
    selectedDifficulty: quizState.selectedDifficulty,
    currentIndex: quizState.currentIndex,
    score: quizState.score,
    questionIds: quizState.currentQuestions.map((q) => String(q.id)),
    questions: quizState.currentQuestions,
    scoredQuestionIds: Array.from(quizState.scoredQuestions || []).map((id) => String(id)),
    timestamp: Date.now(),
  };
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(payload));
};

const loadQuizProgress = () => {
  const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const clearQuizProgress = () => {
  localStorage.removeItem(QUIZ_STORAGE_KEY);
};

const populateQuizTopics = () => {
  if (!quizState.questions.length || !quizElements.topicSelect) return;
  const topics = [...new Set(quizState.questions.map(q => q.topic))].sort();
  quizElements.topicSelect.innerHTML = 
    `<option value="all">All Topics (Random)</option>` +
    topics.map(topic => `<option value="${topic}">${topic}</option>`).join("");
};

const exitQuizToStart = () => {
  if (quizElements.main) quizElements.main.classList.add("hidden");
  if (quizElements.header) quizElements.header.classList.add("hidden");
  if (quizElements.complete) quizElements.complete.classList.add("hidden");
  if (quizElements.start) quizElements.start.classList.remove("hidden");
  saveQuizProgress();
  if (quizElements.resumeBtn) quizElements.resumeBtn.classList.remove("hidden");
};

const updateProgressUI = (isAnswered = false) => {
  const total = quizState.currentQuestions.length || 0;
  const current = Math.min(quizState.currentIndex + (isAnswered ? 1 : 0), total);
  const percent = total ? (current / total) * 100 : 0;
  if (quizElements.headerCurrent) quizElements.headerCurrent.textContent = quizState.currentIndex + 1;
  if (quizElements.headerCount) quizElements.headerCount.textContent = total;
  if (quizElements.headerScore) quizElements.headerScore.textContent = quizState.score;
  if (quizElements.headerTotal) quizElements.headerTotal.textContent = total;
  if (quizElements.headerProgress) quizElements.headerProgress.style.width = `${percent}%`;
  if (quizElements.cardProgress) quizElements.cardProgress.style.width = `${percent}%`;
  if (quizElements.cardCounter) {
    quizElements.cardCounter.textContent = `Question ${quizState.currentIndex + 1} of ${total}`;
  }
};

const resetAnswerUI = () => {
  if (quizElements.hint) quizElements.hint.classList.add("hidden");
  if (quizElements.feedback) quizElements.feedback.classList.add("hidden");
  if (quizElements.solutionPanel) quizElements.solutionPanel.classList.add("hidden");
  if (quizElements.imageContainer) quizElements.imageContainer.classList.add("hidden");
  if (quizElements.solutionImageContainer) quizElements.solutionImageContainer.classList.add("hidden");
  if (quizElements.finalAnswer) quizElements.finalAnswer.classList.add("hidden");
  if (quizElements.keyFormula) quizElements.keyFormula.classList.add("hidden");
  if (quizElements.mistakeHint) quizElements.mistakeHint.classList.add("hidden");
  if (quizElements.solutionToggle) quizElements.solutionToggle.textContent = "−";
};

const setSolutionVisibility = (visible) => {
  if (!quizElements.solutionPanel || !quizElements.solutionToggle) return;
  quizElements.solutionPanel.classList.toggle("hidden", !visible);
  quizElements.solutionToggle.textContent = visible ? "−" : "+";
};

const getKeyFormula = (q) => q.keyFormula || topicFormulaMap[q.topic] || "";

const restoreQuizSession = (saved) => {
  if (!saved || !quizElements.start) return false;
  let restored = Array.isArray(saved.questions) ? saved.questions : [];
  if (!restored.length) {
    const lookup = new Map(quizState.questions.map((q) => [String(q.id), q]));
    restored = (saved.questionIds || [])
      .map((id) => lookup.get(String(id)))
      .filter(Boolean);
  }
  if (!restored.length) return false;

  quizState.currentQuestions = restored;
  quizState.currentIndex = Math.min(saved.currentIndex || 0, restored.length - 1);
  quizState.score = saved.score || 0;
  quizState.selectedTopic = saved.selectedTopic || "all";
  quizState.selectedDifficulty = saved.selectedDifficulty || "all";
  quizState.scoredQuestions = new Set(saved.scoredQuestionIds || []);
  quizState.answered = false;

  if (quizElements.topicSelect) quizElements.topicSelect.value = quizState.selectedTopic;
  if (quizElements.difficultySelect) quizElements.difficultySelect.value = quizState.selectedDifficulty;

  quizElements.start.classList.add("hidden");
  quizElements.main.classList.remove("hidden");
  quizElements.header.classList.remove("hidden");
  quizElements.complete.classList.add("hidden");
  loadQuestion();
  return true;
};

const startQuiz = () => {
  if (!quizElements.start || !quizElements.main) return;
  quizState.selectedTopic = quizElements.topicSelect.value;
  quizState.selectedDifficulty = quizElements.difficultySelect.value;
  
  let filtered = quizState.questions.filter(q => {
    const topicMatch = quizState.selectedTopic === "all" || q.topic === quizState.selectedTopic;
    const difficultyMatch = quizState.selectedDifficulty === "all" || q.difficulty === quizState.selectedDifficulty;
    return topicMatch && difficultyMatch;
  });
  
  if (filtered.length === 0) {
    alert("No questions available for this combination. Please select different options.");
    return;
  }
  
  quizState.currentQuestions = shuffleArray(filtered).slice(0, 10);
  quizState.currentIndex = 0;
  quizState.score = 0;
  quizState.answered = false;
  quizState.scoredQuestions = new Set();
  clearQuizProgress();
  if (quizElements.resumeBtn) quizElements.resumeBtn.classList.add("hidden");
  
  quizElements.start.classList.add("hidden");
  quizElements.main.classList.remove("hidden");
  quizElements.header.classList.remove("hidden");
  quizElements.complete.classList.add("hidden");
  
  window.scrollTo({ top: 0, behavior: "smooth" });
  
  loadQuestion();
  saveQuizProgress();
};

const loadQuestion = () => {
  if (quizState.currentIndex >= quizState.currentQuestions.length) {
    showComplete();
    return;
  }
  
  const q = quizState.currentQuestions[quizState.currentIndex];
  quizState.answered = false;
  
  // Reset UI
  quizElements.question.innerHTML = allowBasicTags(escapeHtml(q.question));
  quizElements.topic.textContent = q.topic;
  quizElements.difficultyBadge.textContent = difficultyLabels[q.difficulty] || q.difficulty;
  quizElements.hintText.textContent = q.hint;
  quizElements.unit.textContent = q.unit || "";
  quizElements.answerInput.value = "";
  quizElements.answerInput.disabled = false;
  quizElements.submitBtn.disabled = false;
  quizElements.nextBtn.disabled = true;
  if (quizElements.retryProblemBtn) quizElements.retryProblemBtn.disabled = true;
  
  // Hide elements
  resetAnswerUI();
  
  // Handle images
  if (q.image) {
    quizElements.image.src = q.image;
    quizElements.imageCaption.textContent = q.imageCaption || "";
    quizElements.imageContainer.classList.remove("hidden");
  }
  
  // Update progress and header
  updateProgressUI(false);
  
  // Typeset math
  typesetMath();
  
  // Focus input
  setTimeout(() => quizElements.answerInput.focus(), 300);
  saveQuizProgress();
};
const checkAnswer = () => {
  if (quizState.answered) return;
  
  const q = quizState.currentQuestions[quizState.currentIndex];
  const userAnswer = parseNumericInput(quizElements.answerInput.value);
  
  if (isNaN(userAnswer)) {
    alert("Please enter a valid numerical answer. You can use decimals, fractions (a/b), or scientific notation.");
    return;
  }
  
  const correct = Math.abs(userAnswer - q.answer) <= q.tolerance;
  quizState.answered = true;
  
  if (correct) {
    if (!quizState.scoredQuestions.has(String(q.id))) {
      quizState.score++;
      quizState.scoredQuestions.add(String(q.id));
    }
    showFeedback(true, "Correct!", "Excellent work! You've mastered this problem.");
  } else {
    const yourAnswer = formatNumber(userAnswer, 3);
    const correctAnswer = formatNumber(q.answer, 3);
    showFeedback(false, "Incorrect", `Your answer: ${yourAnswer} | Correct: ${correctAnswer}`);
  }
  
  // Update score display in header
  quizElements.headerScore.textContent = quizState.score;
  
  // Show solution
  showSolution(q);
  
  // Disable input and submit
  quizElements.answerInput.disabled = true;
  quizElements.submitBtn.disabled = true;
  quizElements.nextBtn.disabled = false;
  if (quizElements.retryProblemBtn) {
    quizElements.retryProblemBtn.disabled = correct;
  }
  
  // Update progress
  updateProgressUI(true);
  saveQuizProgress();
};

const showFeedback = (correct, message, detail = "") => {
  quizElements.feedback.classList.remove("hidden", "correct", "incorrect");
  quizElements.feedback.classList.add(correct ? "correct" : "incorrect");
  
  quizElements.feedbackIcon.textContent = correct ? "✓" : "✗";
  quizElements.feedbackMessage.textContent = message;
  quizElements.feedbackDetail.textContent = detail;

  if (quizElements.mistakeHint) {
    if (correct) {
      quizElements.mistakeHint.classList.add("hidden");
      quizElements.mistakeHint.textContent = "";
    } else {
      quizElements.mistakeHint.textContent = "Review the key formula and check unit conversions before retrying.";
      quizElements.mistakeHint.classList.remove("hidden");
    }
  }
};

const showSolution = (q) => {
  quizElements.solutionContent.innerHTML = allowBasicTags(escapeHtml(q.solution))
    .replace(/\\n/g, '<br>');
  
  const keyFormula = getKeyFormula(q);
  if (quizElements.keyFormula && quizElements.keyFormulaText) {
    if (keyFormula) {
      quizElements.keyFormulaText.innerHTML = allowBasicTags(escapeHtml(keyFormula));
      quizElements.keyFormula.classList.remove("hidden");
    } else {
      quizElements.keyFormula.classList.add("hidden");
    }
  }

  quizElements.correctAnswer.innerHTML = `${q.answer} ${q.unit}`.trim();
  quizElements.finalAnswer.classList.remove("hidden");
  
  if (q.solutionImage) {
    quizElements.solutionImage.src = q.solutionImage;
    quizElements.solutionImageCaption.textContent = q.solutionImageCaption || "";
    quizElements.solutionImageContainer.classList.remove("hidden");
  }
  
  setSolutionVisibility(true);
  
  // Typeset math in solution
  typesetMath();
};

const showComplete = () => {
  quizElements.main.classList.add("hidden");
  quizElements.header.classList.add("hidden");
  quizElements.complete.classList.remove("hidden");
  
  quizElements.finalScore.textContent = quizState.score;
  quizElements.finalTotal.textContent = quizState.currentQuestions.length;
  
  const percentage = Math.round((quizState.score / quizState.currentQuestions.length) * 100);
  quizElements.scorePercentage.textContent = `${percentage}%`;
  
  // Show rating based on percentage
  let rating = "Great Job!";
  if (percentage === 100) rating = "Perfect Score! 🌟";
  else if (percentage >= 80) rating = "Excellent! 🎯";
  else if (percentage >= 60) rating = "Good Work! 💪";
  else if (percentage >= 40) rating = "Keep Practicing! 📚";
  else rating = "Try Again! 🚀";
  
  quizElements.scoreRating.textContent = rating;
  
  // Animate progress circle
  const circleFill = document.getElementById("score-circle__fill");
  if (circleFill) {
    const circumference = 283; // 2 * PI * 45
    const dashOffset = circumference - (percentage / 100) * circumference;
    circleFill.style.strokeDashoffset = dashOffset;
  }
  
  window.scrollTo({ top: 0, behavior: "smooth" });
  clearQuizProgress();
};

const bindQuizEvents = () => {
  addListener(quizElements.startBtn, "click", startQuiz);
  addListener(quizElements.submitBtn, "click", checkAnswer);
  addListener(quizElements.answerInput, "keypress", (e) => {
    if (e.key === "Enter" && !quizState.answered) {
      checkAnswer();
    }
  });
  addListener(quizElements.hintBtn, "click", () => {
    if (quizElements.hint) quizElements.hint.classList.toggle("hidden");
  });
  addListener(quizElements.solutionToggle, "click", () => {
    if (!quizElements.solutionPanel) return;
    const isHidden = quizElements.solutionPanel.classList.contains("hidden");
    setSolutionVisibility(isHidden);
  });
  addListener(quizElements.nextBtn, "click", () => {
    quizState.currentIndex++;
    loadQuestion();
  });
  addListener(quizElements.restartBtn, "click", exitQuizToStart);
  addListener(quizElements.headerBack, "click", exitQuizToStart);
  addListener(quizElements.retryBtn, "click", startQuiz);
  addListener(quizElements.retryProblemBtn, "click", () => {
    quizState.answered = false;
    quizElements.answerInput.disabled = false;
    quizElements.submitBtn.disabled = false;
    quizElements.nextBtn.disabled = true;
    if (quizElements.retryProblemBtn) quizElements.retryProblemBtn.disabled = true;
    if (quizElements.feedback) quizElements.feedback.classList.add("hidden");
    setSolutionVisibility(false);
    if (quizElements.mistakeHint) quizElements.mistakeHint.classList.add("hidden");
    quizElements.answerInput.focus();
    saveQuizProgress();
  });
  addListener(quizElements.newTopicBtn, "click", () => {
    if (quizElements.complete) quizElements.complete.classList.add("hidden");
    if (quizElements.start) quizElements.start.classList.remove("hidden");
    clearQuizProgress();
  });
  addListener(quizElements.pageBack, "click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "index.html#questions";
    }
  });
  addListener(quizElements.resumeBtn, "click", () => {
    const saved = loadQuizProgress();
    restoreQuizSession(saved);
  });
};

const initQuiz = async () => {
  try {
    if (!quizElements.start) return;
    const response = await fetch(QUIZ_URL);
    const staticQuestions = await response.json();
    const dynamicQuestions = generateDynamicQuestions();
    quizState.questions = [...staticQuestions, ...dynamicQuestions];
    populateQuizTopics();
    bindQuizEvents();
    const saved = loadQuizProgress();
    if (saved && quizElements.resumeBtn) {
      quizElements.resumeBtn.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Failed to load quiz questions:", error);
  }
};

const init = async () => {
  const hasQuestionUI = Boolean(grid && resultsInfo);
  const hasFormulaUI = Boolean(formulaGroups && formulaTopic);

  if (hasQuestionUI) {
    try {
      renderSkeletons();
      await loadQuestionsData();
      renderFilters();
      renderCards();
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

  if (hasFormulaUI) {
    try {
      await loadFormulaData();
      renderFormulaFilters();
      filterFormulas();
    } catch (error) {
      console.error("Failed to load formulas:", error);
      if (formulaEmpty) {
        formulaEmpty.querySelector("h3").textContent = "Formulas unavailable";
        formulaEmpty.querySelector("p").textContent = getLoadErrorMessage("formulas");
        formulaEmpty.classList.remove("hidden");
      }
      if (formulaGroups) formulaGroups.innerHTML = "";
    }
  }

  if (globalSearchInput && (!state.data.length || !state.formulas.length)) {
    try {
      await Promise.all([loadQuestionsData(), loadFormulaData()]);
    } catch (error) {
      console.error("Failed to load global search data:", error);
    }
  }

  isPinned = loadPinnedPreference();
  if (!isDesktop()) {
    isPinned = false;
  }
  syncPinToggle();
  setSidebarOpen(isPinned && isDesktop());

  bindEvents();
  updateHomeLock();
  updateHomeViewFromHash();
  addListener(window, "hashchange", updateHomeViewFromHash);
  initHomeBackground();

  await initQuiz();
};

init();
