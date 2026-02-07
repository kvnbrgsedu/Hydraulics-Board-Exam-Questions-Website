const DATA_URL = "assets/data/questions.json";
const FORMULA_URL = "assets/data/formulas.json";
const QUIZ_URL = "assets/data/quiz.json";

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
};

const grid = document.getElementById("question-grid");
const yearSelect = document.getElementById("year-select");
const batchSelect = document.getElementById("batch-select");
const topicList = document.getElementById("topic-list");
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
const topicToggle = document.getElementById("topic-toggle");
const hideSidebarButton = document.getElementById("hide-sidebar");
const startTopic = document.getElementById("start-topic");
const startYear = document.getElementById("start-year");
const startCta = document.getElementById("start-cta");
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
  grid.innerHTML = "";
  for (let i = 0; i < 6; i += 1) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="skeleton"></div>`;
    grid.appendChild(card);
  }
};

const renderFilters = () => {
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

  const topics = Array.from(
    new Set(state.data.map((item) => item.topic))
  ).sort();
  topicList.innerHTML = topics
    .map(
      (topic) =>
        `<button class="topic-pill" data-topic="${topic}">${topic}</button>`
    )
    .join("");

  startTopic.innerHTML =
    `<option value="all">All Topics</option>` +
    topics.map((topic) => `<option value="${topic}">${topic}</option>`).join("");

  startYear.innerHTML =
    `<option value="all">All Years</option>` +
    yearRange.map((year) => `<option value="${year}">${year}</option>`).join("");
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

const buildCardHtml = (item) => {
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
    <article class="card">
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
                  ${batches[batch].map((item) => buildCardHtml(item)).join("")}
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
  grid.innerHTML = items.map((item) => buildCardHtml(item)).join("");
};

const renderCards = () => {
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

const applyFilters = () => {
  renderCards();
};

const buildFormulaGroups = (formulas, query) => {
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
  const topics = Array.from(new Set(state.formulas.map((f) => f.topic))).sort();
  formulaTopic.innerHTML =
    `<option value="all">All Topics</option>` +
    topics.map((topic) => `<option value="${topic}">${topic}</option>`).join("");
};

const renderGlobalResults = (query) => {
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

const bindEvents = () => {
  yearSelect.addEventListener("change", (event) => {
    state.year = event.target.value;
    applyFilters();
    closeSidebarIfAutoHide();
  });

  batchSelect.addEventListener("change", (event) => {
    state.batch = event.target.value;
    applyFilters();
    closeSidebarIfAutoHide();
  });

  topicList.addEventListener("click", (event) => {
    const button = event.target.closest(".topic-pill");
    if (!button) return;
    state.topic = button.dataset.topic;
    document
      .querySelectorAll(".topic-pill")
      .forEach((pill) =>
        pill.classList.toggle("active", pill.dataset.topic === state.topic)
      );
    applyFilters();
    closeSidebarIfAutoHide();
  });

  topicToggle.addEventListener("click", () => {
    topicToggle.classList.toggle("collapsed");
    topicList.classList.toggle("collapsed");
  });

  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    applyFilters();
  });

  clearFilters.addEventListener("click", () => {
    state.year = "all";
    state.batch = "all";
    state.topic = "all";
    state.search = "";
    yearSelect.value = "all";
    batchSelect.value = "all";
    searchInput.value = "";
    document
      .querySelectorAll(".topic-pill")
      .forEach((pill) => pill.classList.remove("active"));
    applyFilters();
    closeSidebarIfAutoHide();
  });

  grid.addEventListener("click", (event) => {
    if (event.target.classList.contains("solution-toggle")) {
      const button = event.target;
      const solution = button.nextElementSibling;
      const isOpen = solution.classList.toggle("open");
      button.textContent = isOpen ? "Hide Solution" : "Show Solution";
    }

    if (event.target.classList.contains("tag")) {
      const { year, batch, topic } = event.target.dataset;
      if (year && batch) {
        state.year = year;
        state.batch = batch;
        yearSelect.value = year;
        batchSelect.value = batch;
      }
      if (topic) {
        state.topic = topic;
        document
          .querySelectorAll(".topic-pill")
          .forEach((pill) =>
            pill.classList.toggle("active", pill.dataset.topic === topic)
          );
      }
      applyFilters();
      closeSidebarIfAutoHide();
    }
  });

  window.addEventListener("scroll", () => {
    const scrollTop = document.documentElement.scrollTop;
    const scrollHeight =
      document.documentElement.scrollHeight -
      document.documentElement.clientHeight;
    const progress = scrollHeight ? (scrollTop / scrollHeight) * 100 : 0;
    progressBar.style.width = `${progress}%`;
    backToTop.classList.toggle("show", scrollTop > 300);
    document.querySelector(".hero").style.backgroundPositionY = `${
      scrollTop * 0.2
    }px`;
    topNav.classList.toggle("compact", scrollTop > 40);
    topNav.classList.toggle("scrolled", scrollTop > 120);
  });

  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  hamburger.addEventListener("click", () => {
    setSidebarOpen(!sidebar.classList.contains("open"));
  });

  hideSidebarButton.addEventListener("click", () => {
    isPinned = false;
    localStorage.setItem(SIDEBAR_PIN_KEY, "false");
    syncPinToggle();
    setSidebarOpen(false);
  });


  pinToggle.addEventListener("change", (event) => {
    isPinned = event.target.checked;
    localStorage.setItem(SIDEBAR_PIN_KEY, String(isPinned));
    if (isPinned && isDesktop()) {
      setSidebarOpen(true);
    } else if (!isPinned) {
      setSidebarOpen(false);
    }
  });

  sidebar.addEventListener("click", (event) => {
    if (event.target.tagName === "A") {
      closeSidebarIfAutoHide();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSidebarOpen(false);
    }
  });

  startCta.addEventListener("click", () => {
    state.topic = startTopic.value;
    state.year = startYear.value;
    yearSelect.value = state.year;
    document
      .querySelectorAll(".topic-pill")
      .forEach((pill) =>
        pill.classList.toggle("active", pill.dataset.topic === state.topic)
      );
    applyFilters();
    document.getElementById("questions").scrollIntoView({ behavior: "smooth" });
  });

  formulaSearch.addEventListener("input", filterFormulas);
  formulaTopic.addEventListener("change", filterFormulas);

  formulaGroups.addEventListener("click", (event) => {
    const header = event.target.closest(".formula-group__header");
    if (!header) return;
    const group = header.parentElement;
    group.classList.toggle("open");
    const indicator = header.querySelector("span");
    indicator.textContent = group.classList.contains("open") ? "-" : "+";
  });

  globalSearchToggle.addEventListener("click", () => {
    topNav.classList.toggle("search-open");
    if (topNav.classList.contains("search-open")) {
      globalSearchInput.focus();
    }
  });

  globalSearchInput.addEventListener("input", (event) => {
    renderGlobalResults(event.target.value);
  });

  globalSearchResults.addEventListener("click", (event) => {
    const item = event.target.closest(".global-search__item");
    if (!item) return;
    const target = item.dataset.target;
    document.querySelector(target).scrollIntoView({ behavior: "smooth" });
    topNav.classList.remove("search-open");
    globalSearchResults.classList.remove("show");
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document
        .querySelectorAll(".nav-link")
        .forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
    });
  });

  const sections = ["home", "questions", "quiz", "formulas", "about"];
  window.addEventListener("scroll", () => {
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

  document.addEventListener("click", (event) => {
    if (!globalSearch.contains(event.target) && event.target !== globalSearchToggle) {
      topNav.classList.remove("search-open");
      globalSearchResults.classList.remove("show");
    }
  });

  window.addEventListener("resize", () => {
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
  solutionPanel: document.getElementById("quiz-solution-panel"),
  solutionContent: document.getElementById("quiz-solution-content"),
  solutionToggle: document.getElementById("quiz-solution-toggle"),
  correctAnswer: document.getElementById("quiz-correct-answer"),
  finalAnswer: document.getElementById("quiz-final-answer"),
  nextBtn: document.getElementById("quiz-next-btn"),
  restartBtn: document.getElementById("quiz-restart-btn"),
  retryBtn: document.getElementById("quiz-retry-btn"),
  newTopicBtn: document.getElementById("quiz-new-topic-btn"),
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

const populateQuizTopics = () => {
  if (!quizState.questions.length) return;
  const topics = [...new Set(quizState.questions.map(q => q.topic))].sort();
  quizElements.topicSelect.innerHTML = 
    `<option value="all">All Topics (Random)</option>` +
    topics.map(topic => `<option value="${topic}">${topic}</option>`).join("");
};

const startQuiz = () => {
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
  
  quizElements.start.classList.add("hidden");
  quizElements.main.classList.remove("hidden");
  quizElements.header.classList.remove("hidden");
  quizElements.complete.classList.add("hidden");
  
  window.scrollTo({ top: 0, behavior: "smooth" });
  
  loadQuestion();
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
  quizElements.difficultyBadge.textContent = q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1);
  quizElements.hintText.textContent = q.hint;
  quizElements.unit.textContent = q.unit || "";
  quizElements.answerInput.value = "";
  quizElements.answerInput.disabled = false;
  quizElements.submitBtn.disabled = false;
  quizElements.nextBtn.disabled = true;
  
  // Hide elements
  quizElements.hint.classList.add("hidden");
  quizElements.feedback.classList.add("hidden");
  quizElements.solutionPanel.classList.add("hidden");
  quizElements.imageContainer.classList.add("hidden");
  quizElements.solutionImageContainer.classList.add("hidden");
  
  // Handle images
  if (q.image) {
    quizElements.image.src = q.image;
    quizElements.imageCaption.textContent = q.imageCaption || "";
    quizElements.imageContainer.classList.remove("hidden");
  }
  
  // Update progress and header
  quizElements.headerCurrent.textContent = quizState.currentIndex + 1;
  quizElements.headerCount.textContent = quizState.currentQuestions.length;
  quizElements.headerScore.textContent = quizState.score;
  quizElements.headerTotal.textContent = quizState.currentQuestions.length;
  
  const progress = ((quizState.currentIndex) / quizState.currentQuestions.length) * 100;
  quizElements.headerProgress.style.width = `${progress}%`;
  
  // Typeset math
  typesetMath();
  
  // Focus input
  setTimeout(() => quizElements.answerInput.focus(), 300);
};
const checkAnswer = () => {
  if (quizState.answered) return;
  
  const q = quizState.currentQuestions[quizState.currentIndex];
  const userAnswer = parseFloat(quizElements.answerInput.value);
  
  if (isNaN(userAnswer)) {
    alert("Please enter a valid numerical answer.");
    return;
  }
  
  const correct = Math.abs(userAnswer - q.answer) <= q.tolerance;
  quizState.answered = true;
  
  if (correct) {
    quizState.score++;
    showFeedback(true, "Correct!", "Excellent work! You've mastered this problem.");
  } else {
    const yourAnswer = userAnswer.toFixed(3);
    const correctAnswer = q.answer.toFixed(3);
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
  
  // Update progress
  const progress = ((quizState.currentIndex + 1) / quizState.currentQuestions.length) * 100;
  quizElements.headerProgress.style.width = `${progress}%`;
};

const showFeedback = (correct, message, detail = "") => {
  quizElements.feedback.classList.remove("hidden", "correct", "incorrect");
  quizElements.feedback.classList.add(correct ? "correct" : "incorrect");
  
  quizElements.feedbackIcon.textContent = correct ? "✓" : "✗";
  quizElements.feedbackMessage.textContent = message;
  quizElements.feedbackDetail.textContent = detail;
};

const showSolution = (q) => {
  quizElements.solutionContent.innerHTML = allowBasicTags(escapeHtml(q.solution))
    .replace(/\\n/g, '<br>');
  
  quizElements.correctAnswer.innerHTML = `${q.answer} ${q.unit}`.trim();
  quizElements.finalAnswer.classList.remove("hidden");
  
  if (q.solutionImage) {
    quizElements.solutionImage.src = q.solutionImage;
    quizElements.solutionImageCaption.textContent = q.solutionImageCaption || "";
    quizElements.solutionImageContainer.classList.remove("hidden");
  }
  
  quizElements.solutionPanel.classList.remove("hidden");
  
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
};

const bindQuizEvents = () => {
  quizElements.startBtn.addEventListener("click", startQuiz);
  
  quizElements.submitBtn.addEventListener("click", checkAnswer);
  
  quizElements.answerInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !quizState.answered) {
      checkAnswer();
    }
  });
  
  quizElements.hintBtn.addEventListener("click", () => {
    quizElements.hint.classList.toggle("hidden");
  });
  
  quizElements.solutionToggle.addEventListener("click", () => {
    quizElements.solutionPanel.classList.add("hidden");
  });
  
  quizElements.nextBtn.addEventListener("click", () => {
    quizState.currentIndex++;
    loadQuestion();
  });
  
  quizElements.restartBtn.addEventListener("click", () => {
    quizElements.main.classList.add("hidden");
    quizElements.header.classList.add("hidden");
    quizElements.start.classList.remove("hidden");
  });
  
  quizElements.headerBack.addEventListener("click", () => {
    quizElements.main.classList.add("hidden");
    quizElements.header.classList.add("hidden");
    quizElements.start.classList.remove("hidden");
  });
  
  quizElements.retryBtn.addEventListener("click", () => {
    startQuiz();
  });
  
  quizElements.newTopicBtn.addEventListener("click", () => {
    quizElements.complete.classList.add("hidden");
    quizElements.start.classList.remove("hidden");
  });
};

const initQuiz = async () => {
  try {
    const response = await fetch(QUIZ_URL);
    quizState.questions = await response.json();
    populateQuizTopics();
    bindQuizEvents();
  } catch (error) {
    console.error("Failed to load quiz questions:", error);
  }
};

const init = async () => {
  renderSkeletons();
  const response = await fetch(DATA_URL);
  const data = await response.json();
  const formulaResponse = await fetch(FORMULA_URL);
  const formulaData = await formulaResponse.json();
  state.data = data;
  state.formulas = formulaData;
  renderFilters();
  renderCards();
  renderFormulaFilters();
  filterFormulas();
  isPinned = loadPinnedPreference();
  if (!isDesktop()) {
    isPinned = false;
  }
  syncPinToggle();
  setSidebarOpen(isPinned && isDesktop());
  bindEvents();
  await initQuiz();
};

init();
