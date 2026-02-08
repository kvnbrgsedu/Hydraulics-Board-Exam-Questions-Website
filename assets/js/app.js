const DATA_URL = "assets/data/questions.json";
const FORMULA_URL = "assets/data/formulas.json";
const QUIZ_URL = "assets/data/quiz.json";
const QUIZ_STORAGE_KEY = "quizProgressV2";

const state = {
  year: "choose",
  batch: "all",
  topic: "choose",
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
  if (stored === null) return true;
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
  
  // Add "All Years" option to sidebar yearSelect
  yearSelect.innerHTML = '<option value="all">All Years</option>';
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

  // Get available topics and years for synchronization
  const allTopics = Array.from(new Set(state.data.map((item) => item.topic))).sort();
  const allYears = Array.from(new Set(state.data.map((item) => item.year))).sort((a, b) => parseInt(a) - parseInt(b));
  
  topicSelect.innerHTML =
    `<option value="all">All Topics</option>` +
    allTopics.map((topic) => `<option value="${topic}">${topic}</option>`).join("");

  startTopic.innerHTML =
    `<option value="choose">Choose Topic</option>` +
    `<option value="none">None</option>` +
    `<option value="all">All Topics</option>` +
    allTopics.map((topic) => `<option value="${topic}">${topic}</option>`).join("");
  
  // Set to "choose" if no selection, otherwise use state value
  if (state.topic === "all" || state.topic === "choose" || !state.topic) {
    startTopic.value = state.topic === "all" ? "all" : "choose";
  } else {
    startTopic.value = state.topic;
  }

  startYear.innerHTML =
    `<option value="choose">Choose Year</option>` +
    `<option value="none">None</option>` +
    `<option value="all">All Years</option>` +
    yearRange.map((year) => `<option value="${year}">${year}</option>`).join("");
  
  // Set to "choose" if no selection, otherwise use state value
  if (state.year === "all" || state.year === "choose" || !state.year) {
    startYear.value = state.year === "all" ? "all" : "choose";
  } else {
    startYear.value = state.year;
  }
};

const updateActiveChips = () => {
  const chips = [];
  if (state.year !== "all" && state.year !== "choose") chips.push(`Year: ${state.year}`);
  if (state.batch !== "all") chips.push(`Batch: ${state.batch}`);
  if (state.topic !== "all" && state.topic !== "choose") chips.push(`Topic: ${state.topic}`);
  if (state.search.trim()) chips.push(`Search: "${state.search.trim()}"`);

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
  if (state.topic === "all" && state.year === "all" && state.batch === "all" && !state.search.trim()) {
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
    
    // Search matching
    const query = state.search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      (item.question && item.question.toLowerCase().includes(query)) ||
      (item.topic && item.topic.toLowerCase().includes(query)) ||
      `${item.year || ""} ${item.batch || ""}`.toLowerCase().includes(query);
    
    return matchesYear && matchesTopic && matchesBatch && matchesSearch;
  });
  
  console.log("filterData: Filtered", filtered.length, "items from", state.data.length, "total (topic:", state.topic, "year:", state.year, ")");
  return filtered;
};

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
  grid.classList.remove("grid");
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
            <div class="questions-grid">
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
  
  grid.classList.remove("grid");
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
  
  console.log("renderFullHierarchyView: Called with", items ? items.length : 0, "items");
  
  grid.classList.remove("grid");
  grid.classList.add("hierarchical-view", "full-hierarchy-view");
  
  const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  
  // If no items, show empty state
  if (!items || items.length === 0) {
    console.warn("renderFullHierarchyView: No items to render");
    grid.innerHTML = "";
    return;
  }
  
  console.log("renderFullHierarchyView: Processing", items.length, "items");
  
  // Group by year, then by topic - ensure ALL questions are included
  const grouped = items.reduce((acc, item) => {
    // Skip invalid items - but be more lenient with validation
    if (!item) return acc;
    const year = String(item.year || "").trim();
    const topic = String(item.topic || "").trim();
    if (!year || !topic) {
      return acc; // Only skip if both are missing
    }
    if (!acc[year]) acc[year] = {};
    if (!acc[year][topic]) acc[year][topic] = [];
    acc[year][topic].push(item);
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
    console.warn("renderFullHierarchyView: No years found after grouping", items.length, "items");
    console.warn("renderFullHierarchyView: Sample items:", items.slice(0, 3));
    grid.innerHTML = "";
    return;
  }
  
  console.log("renderFullHierarchyView: Found", years.length, "years:", years);
  
  let questionIndex = 0;
  let totalQuestions = 0;

  // Build the HTML structure: Year (Primary) → Topic (Secondary) → Questions
  grid.innerHTML = years
    .map((year, yearIndex) => {
      const topics = Object.keys(grouped[year]).sort();
      
      // Count total questions in this year
      const yearQuestionCount = topics.reduce((sum, topic) => sum + grouped[year][topic].length, 0);
      totalQuestions += yearQuestionCount;
      
      // Build topic sections for this year
      const topicSections = topics
        .map((topic, topicIndex) => {
          const questions = grouped[year][topic];
          if (!questions || questions.length === 0) return "";
          
          const count = questions.length;
          const topicDelay = yearIndex * 120 + topicIndex * 80 + 150;
          
          return `
            <section class="topic-section secondary-section" style="--delay: ${topicDelay}ms">
              <div class="topic-header secondary-header">
                <span class="topic-label">${escapeHtml(topic)}</span>
                <span class="topic-meta">${count} question${count === 1 ? "" : "s"}</span>
              </div>
              <div class="topic-content">
                <div class="questions-grid">
                  ${questions
                    .map((item, qIndex) => {
                      if (!item) return "";
                      const cardHtml = buildCardHtml(item, questionIndex++);
                      const questionDelay = topicDelay + qIndex * 30;
                      return addCardAnimation(cardHtml, questionDelay, qIndex);
                    })
                    .filter(html => html) // Remove empty strings
                    .join("")}
                </div>
              </div>
            </section>
          `;
        })
        .filter(html => html) // Remove empty topic sections
        .join("");

      // If no topic sections, skip this year
      if (!topicSections.trim()) {
        return "";
      }

      return `
        <section class="year-section hierarchical-year primary-section" data-year="${year}" style="--year-index: ${yearIndex}">
          <div class="year-header hierarchical-year-header primary-header reveal">
            <button class="year-toggle" aria-expanded="true" aria-label="Toggle ${year} questions">
              <span class="year-badge">${escapeHtml(year)}</span>
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
    .filter(html => html) // Remove empty year sections
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
  grid.classList.remove("grid");
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
        <div class="questions-grid">
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
  grid.classList.remove("grid");
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
        <div class="questions-grid">
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
  grid.classList.remove("grid");
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
                  <div class="questions-grid">
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
  grid.classList.remove("grid");
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
                <div class="questions-grid">
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
  grid.classList.remove("grid");
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
            <div class="questions-grid">
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
    // Ensure we have items to render
    const itemsToRender = items && Array.isArray(items) ? items : [];
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
      
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      requestAnimationFrame(() => {
        window.scrollTo({
          top: currentScroll,
          behavior: "auto"
        });
      });
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

const renderCards = () => {
  if (!grid || !resultsInfo || !emptyState || !activeChips) return;
  const filtered = filterData();
  const isAllView =
    (state.year === "all" || state.topic === "all") &&
    state.batch === "all" &&
    !state.search.trim();
  const isFullHierarchicalView = 
    state.year === "all" &&
    state.topic === "all" &&
    state.batch === "all" &&
    !state.search.trim();

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
      emptyMessage.textContent = "Try adjusting your filters or search keywords.";
    }
    
    // Fade out before clearing
    grid.style.opacity = "0";
    grid.style.transition = "opacity 0.3s ease";
    setTimeout(() => {
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
    
    // Always use hierarchical view when appropriate, even if filtered is empty
    // The hierarchical view functions handle empty states internally
    if (shouldUseHierarchical) {
      console.log("renderCards: Using hierarchical view with", filtered.length, "items");
      console.log("renderCards: isAllTopics:", isAllTopics, "isAllYears:", isAllYears);
      renderHierarchicalView(filtered);
  } else {
      console.log("renderCards: Using grid view with", filtered.length, "items");
    renderGrid(filtered);
  }

    // Fade in new content
  requestAnimationFrame(() => {
      grid.style.opacity = "1";
      
      typesetMath();
      
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
  // CRITICAL: Always sync state from dropdowns to ensure consistency
  // This ensures that when "all" is selected in dropdowns, state is also "all"
  if (startTopic) {
    const dropdownValue = startTopic.value;
    // Sync state to match dropdown, especially for "all" selections
    if (dropdownValue === "all") {
      state.topic = "all";
    } else if (dropdownValue === "choose" || dropdownValue === "none") {
      state.topic = dropdownValue;
    } else if (dropdownValue && dropdownValue !== state.topic) {
      state.topic = dropdownValue;
    }
  }
  
  if (startYear) {
    const dropdownValue = startYear.value;
    // Sync state to match dropdown, especially for "all" selections
    if (dropdownValue === "all") {
      state.year = "all";
    } else if (dropdownValue === "choose" || dropdownValue === "none") {
      state.year = dropdownValue;
    } else if (dropdownValue && dropdownValue !== state.year) {
      state.year = dropdownValue;
    }
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
      // Enable scrolling
      document.body.style.overflow = 'auto';
      // Smooth scroll to content zone after a brief delay
      setTimeout(() => {
        questionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          document.body.style.overflow = 'hidden';
        }
      }, 500);
    }
  }
  
  syncStartSelectCards();
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
    groups.forEach((group) => {
      group.classList.remove("open");
      const trigger = group.querySelector(".home-select__trigger");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
    document.body.classList.remove("home-select-open");
    // Scroll back to top of home screen when dropdown closes
    if (document.body.classList.contains("home-page")) {
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

// Global sync functions for dropdown synchronization
let syncTopicDropdown, syncYearDropdown;

const bindEvents = () => {
  // Function to sync topic dropdown - ALWAYS show all topics from entire dataset
  syncTopicDropdown = () => {
    if (!state.data.length) return;
    
    // ALWAYS show all topics from entire dataset, regardless of current selection
    // This allows users to select any topic even if it doesn't exist in the selected year
    // The filtering will happen when displaying results, not when showing dropdown options
    const availableTopics = Array.from(new Set(state.data.map((item) => item.topic))).sort();
    
    // Get current selections from dropdowns (not state) to preserve user's actual selections
    const currentTopicFromState = state.topic;
    const currentTopicFromDropdown = startTopic ? startTopic.value : (topicSelect ? topicSelect.value : currentTopicFromState);
    
    // Use the dropdown value if it's a specific topic, otherwise use state
    const currentTopic = (currentTopicFromDropdown !== "choose" && currentTopicFromDropdown !== "none" && currentTopicFromDropdown !== "all") 
      ? currentTopicFromDropdown 
      : currentTopicFromState;
    
    const topicOptions = `<option value="all">All Topics</option>` +
      availableTopics.map((topic) => `<option value="${topic}">${topic}</option>`).join("");
    
    if (topicSelect) {
      const previousValue = topicSelect.value;
      topicSelect.innerHTML = topicOptions;
      // Restore selection if still available, otherwise keep "all"
      // Don't modify state - state is managed by handleStartSelection and sidebar handlers
      if (currentTopic !== "all" && currentTopic !== "choose" && currentTopic !== "none" && availableTopics.includes(currentTopic)) {
        topicSelect.value = currentTopic;
      } else if (currentTopic === "all") {
        topicSelect.value = "all";
      } else {
        // If current selection is not available, default to "all" for the dropdown
        // But don't modify state - let the calling function handle state updates
        topicSelect.value = "all";
      }
    }
    
    if (startTopic) {
      const startTopicOptions = 
        `<option value="choose">Choose Topic</option>` +
        `<option value="none">None</option>` +
        `<option value="all">All Topics</option>` +
        availableTopics.map((topic) => `<option value="${topic}">${topic}</option>`).join("");
      const previousValue = startTopic.value;
      startTopic.innerHTML = startTopicOptions;
      // Restore selection if still available
      // Prioritize preserving the user's actual selection from the dropdown
      if (previousValue === "all") {
        startTopic.value = "all";
        // Preserve "all" in state
        if (state.topic !== "all") {
          state.topic = "all";
        }
      } else if (previousValue !== "choose" && previousValue !== "none" && availableTopics.includes(previousValue)) {
        startTopic.value = previousValue;
        // Update state to match the preserved selection
        if (state.topic !== previousValue) {
          state.topic = previousValue;
        }
      } else if (currentTopic === "all") {
        startTopic.value = "all";
        if (state.topic !== "all") {
          state.topic = "all";
        }
      } else if (currentTopic !== "choose" && currentTopic !== "none" && availableTopics.includes(currentTopic)) {
        startTopic.value = currentTopic;
      } else {
        // Preserve "choose" or "none" if that was the previous value
        startTopic.value = (previousValue === "choose" || previousValue === "none") ? previousValue : "choose";
      }
      
      // Rebuild custom dropdown menu if it exists
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
      
      // CRITICAL: Always preserve "all" if it was selected, regardless of other conditions
      // Check previousValue first, then state, then dropdown value
      if (previousValue === "all" || state.year === "all" || currentYearFromDropdown === "all") {
        startYear.value = "all";
        // Preserve "all" in state
        state.year = "all";
      } else if (previousValue !== "choose" && previousValue !== "none" && availableYears.includes(previousValue)) {
        startYear.value = previousValue;
        // Update state to match the preserved selection
        if (state.year !== previousValue) {
          state.year = previousValue;
        }
      } else if (currentYear !== "choose" && currentYear !== "none" && currentYear !== "all" && availableYears.includes(currentYear)) {
        startYear.value = currentYear;
        if (state.year !== currentYear) {
          state.year = currentYear;
        }
      } else {
        // Preserve "choose" or "none" if that was the previous value
        startYear.value = (previousValue === "choose" || previousValue === "none") ? previousValue : "choose";
        if (previousValue === "choose" || previousValue === "none") {
          state.year = previousValue;
        }
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

  addListener(searchInput, "input", (event) => {
    updateSidebarSearch(event.target.value);
  });

  addListener(clearFilters, "click", () => {
    // Reset to "choose" state to lock the home screen
    state.year = "choose";
    state.batch = "all";
    state.topic = "choose";
    state.search = "";
    
    // Reset sidebar dropdowns
    if (yearSelect) yearSelect.value = "all";
    if (batchSelect) batchSelect.value = "all";
    if (topicSelect) topicSelect.value = "all";
    if (searchInput) searchInput.value = "";
    
    // Reset home dropdowns to "choose" (placeholder state)
    if (startTopic) {
      startTopic.value = "choose";
      // Update the custom dropdown trigger text
      const topicGroup = startTopic.closest(".home-select-group");
      if (topicGroup) {
        const trigger = topicGroup.querySelector(".home-select__trigger");
        if (trigger) {
          const valueSpan = trigger.querySelector(".home-select__value");
          if (valueSpan) {
            valueSpan.textContent = "Choose Topic";
          }
        }
      }
    }
    if (startYear) {
      startYear.value = "choose";
      // Update the custom dropdown trigger text
      const yearGroup = startYear.closest(".home-select-group");
      if (yearGroup) {
        const trigger = yearGroup.querySelector(".home-select__trigger");
        if (trigger) {
          const valueSpan = trigger.querySelector(".home-select__value");
          if (valueSpan) {
            valueSpan.textContent = "Choose Year";
          }
        }
      }
    }
    
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

  const handleStartSelection = (event) => {
    if (!startTopic || !startYear) return;
    
    // Read current values from both dropdowns (source of truth)
    const topicValue = startTopic.value;
    const yearValue = startYear.value;
    
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
    syncTopicDropdown();
    syncYearDropdown();
    
    // After syncing, preserve the user's selection
    // Re-read dropdown values to ensure they weren't changed by sync
    const finalTopicValue = startTopic.value;
    const finalYearValue = startYear.value;
    
    // Update state to match final dropdown values
    if (finalTopicValue !== state.topic) {
      state.topic = finalTopicValue;
    }
    if (finalYearValue !== state.year) {
      state.year = finalYearValue;
    }
    
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
    const questionsSection = document.getElementById("questions");
    if (questionsSection && !document.body.classList.contains("home-locked")) {
      questionsSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  addListener(startTopic, "change", (event) => handleStartSelection(event));
  addListener(startYear, "change", (event) => handleStartSelection(event));

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
      // Sync dropdowns after data loads
      if (syncTopicDropdown && syncYearDropdown) {
        syncTopicDropdown();
        syncYearDropdown();
      }
      
      // CRITICAL: Initialize home dropdowns AFTER renderFilters populates the select options
      // This ensures the custom dropdown menu is properly populated on first load
      initHomeDropdowns();
      
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
  
  // Initialize home page state
  if (document.body.classList.contains("home-page")) {
    // Ensure Question Viewing Zone is hidden initially
    const questionsSection = document.querySelector('.questions-section');
    if (questionsSection) {
      questionsSection.classList.remove('is-active');
    }
    // Ensure scrolling is disabled initially
    document.body.style.overflow = 'hidden';
  }
  
  updateHomeLock();
  updateHomeViewFromHash();
  addListener(window, "hashchange", updateHomeViewFromHash);
  initHomeBackground();
  initPageBackground();
  // IMPORTANT: initHomeDropdowns MUST run AFTER renderFilters populates the select elements
  // Otherwise the custom dropdown menu will be empty on first load
  // It will be called after renderFilters() in the hasQuestionUI block

  await initQuiz();
};

init();
