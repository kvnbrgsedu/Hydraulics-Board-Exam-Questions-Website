(() => {
  if (!document.body.classList.contains("quiz-page")) return;
  if (!document.getElementById("aq-config")) return;

  const TOPICS = [
    "Fluid Properties",
    "Pressure",
    "Dams",
    "Plane Gates",
    "Curved Gates",
    "Buoyancy",
    "Stability of Floating Bodies",
    "Rectilinear Translation",
    "Rotating Vessel",
    "Fundamentals of Fluid Flow",
    "Orifice",
    "Pipes",
    "Reservoir",
    "Open Channels",
    "Hydrodynamics",
  ];

  const DIFFICULTY_COLORS = {
    easy: "aq-difficulty--easy",
    medium: "aq-difficulty--medium",
    hard: "aq-difficulty--hard",
  };

  const el = {
    back: document.getElementById("quiz-page-back"),
    config: document.getElementById("aq-config"),
    topicChips: document.getElementById("aq-topic-chips"),
    randomTopicsBtn: document.getElementById("aq-random-topics-btn"),
    termsConceptsBtn: document.getElementById("aq-terms-concepts-btn"),
    difficulty: document.getElementById("aq-difficulty"),
    difficultyGroup: document.getElementById("aq-difficulty-group"),
    count: document.getElementById("aq-item-count"),
    examMode: document.getElementById("aq-exam-mode"),
    startBtn: document.getElementById("aq-start-btn"),
    downloadBtn: document.getElementById("aq-download-btn"),
    quiz: document.getElementById("aq-quiz"),
    results: document.getElementById("aq-results"),
    progressText: document.getElementById("aq-progress-text"),
    progressBar: document.getElementById("aq-progress-bar"),
    timer: document.getElementById("aq-timer"),
    scoreInline: document.getElementById("aq-score-inline"),
    topicBadge: document.getElementById("aq-topic-badge"),
    difficultyBadge: document.getElementById("aq-difficulty-badge"),
    questionTitle: document.getElementById("aq-question-title"),
    questionText: document.getElementById("aq-question-text"),
    questionImage: document.getElementById("aq-question-image"),
    answerInput: document.getElementById("aq-answer-input"),
    answerUnit: document.getElementById("aq-answer-unit"),
    submitBtn: document.getElementById("aq-submit-btn"),
    nextBtn: document.getElementById("aq-next-btn"),
    feedback: document.getElementById("aq-feedback"),
    solution: document.getElementById("aq-solution"),
    startModal: document.getElementById("aq-start-modal"),
    confirmStart: document.getElementById("aq-confirm-start"),
    cancelStart: document.getElementById("aq-cancel-start"),
  };

  const state = {
    compQuestions: [],
    termQuestions: [],
    termsMode: false,
    selectedTopics: new Set(),
    useRandomTopics: false,
    quizItems: [],
    answers: [],
    index: 0,
    score: 0,
    isAnswered: false,
    examMode: false,
    timerId: null,
    startedAt: null,
    elapsedSec: 0,
  };

  const normalize = (v) => String(v || "").trim().toLowerCase();
  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (match) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[match];
    });

  const parseNumeric = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return NaN;
    const fractionMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
    if (fractionMatch) {
      const a = Number(fractionMatch[1]);
      const b = Number(fractionMatch[2]);
      if (!b) return NaN;
      return a / b;
    }
    return Number.parseFloat(trimmed);
  };

  const allowBasicTags = (html) =>
    String(html || "")
      .replace(/\n/g, "<br>")
      .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
      .replace(/&lt;(\/?(?:b|strong|em|sup|sub|ul|ol|li|p))&gt;/gi, "<$1>");

  const toDisplayHtml = (value) => allowBasicTags(escapeHtml(value));
  const toQuestionHtml = (value) =>
    escapeHtml(value)
      .replace(/\s+/g, " ")
      .trim();

  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const randomPick = (arr, count) => shuffle(arr).slice(0, count);
  const getAvailableTopics = () => {
    const topics = new Set();
    const list = state.termsMode ? state.termQuestions : state.compQuestions;
    list.forEach((q) => q?.topic && topics.add(q.topic));
    return Array.from(topics);
  };

  const extractLastNumber = (solution) => {
    const text = String(solution || "").replace(/<[^>]+>/g, " ");
    const matches = text.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi);
    if (!matches || !matches.length) return null;
    const last = Number(matches[matches.length - 1]);
    return Number.isFinite(last) ? last : null;
  };

  const inferTopicFromText = (text) => {
    const v = normalize(text);
    if (v.includes("archimedes") || v.includes("metacenter") || v.includes("floating")) return "Buoyancy";
    if (v.includes("bernoulli") || v.includes("flow")) return "Fundamentals of Fluid Flow";
    if (v.includes("surface tension") || v.includes("specific weight")) return "Fluid Properties";
    if (v.includes("pressure")) return "Pressure";
    if (v.includes("channel")) return "Open Channels";
    if (v.includes("hydrodynamics")) return "Hydrodynamics";
    return TOPICS[Math.floor(Math.random() * TOPICS.length)];
  };

  const inferDifficultyForComputation = (qText) => {
    const lines = String(qText || "").split("<br>").length;
    if (lines >= 6) return "hard";
    if (lines >= 4) return "hard";
    return "medium";
  };

  const showModal = (show) => el.startModal.classList.toggle("hidden", !show);

  const formatTime = (sec) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const stopTimer = () => {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
  };

  const startTimer = () => {
    stopTimer();
    state.elapsedSec = 0;
    el.timer.textContent = "00:00";
    el.timer.classList.toggle("hidden", !state.examMode);
    if (!state.examMode) return;
    state.timerId = setInterval(() => {
      state.elapsedSec += 1;
      el.timer.textContent = formatTime(state.elapsedSec);
    }, 1000);
  };

  const setDifficultyBadge = (difficulty) => {
    el.difficultyBadge.className = "aq-badge";
    el.difficultyBadge.classList.add(DIFFICULTY_COLORS[difficulty] || "");
    el.difficultyBadge.textContent = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  };

  const compareAnswer = (question, userInput) => {
    if (question.answerType === "numeric") {
      const num = parseNumeric(userInput);
      if (!Number.isFinite(num)) return { correct: false, detail: "Enter a valid numeric value." };
      const tol = Number.isFinite(question.tolerance) ? question.tolerance : 0.01;
      const correct = Math.abs(num - question.correctAnswer) <= tol;
      return {
        correct,
        detail: `Your answer: ${num} | Correct: ${question.correctAnswer} (tol ±${tol})`,
      };
    }

    // Text answers: accept equivalent alternatives (case/spacing/punctuation).
    const normalizeText = (value) =>
      String(value || "")
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[.·•,:;!?\u00B4'"]+$/g, ""); // drop trailing punctuation

    const user = normalizeText(userInput);
    const expected = normalizeText(question.correctAnswer);
    const userFold = user.toLowerCase();
    const expectedFold = expected.toLowerCase();

    const alternativesRaw = Array.isArray(question.alternatives) ? question.alternatives : [];
    const alternatives = [expected, ...alternativesRaw.map(normalizeText)].filter(Boolean);
    const alternativesFold = alternatives.map((a) => a.toLowerCase());

    const correct =
      user === expected ||
      userFold === expectedFold ||
      alternatives.includes(user) ||
      alternativesFold.includes(userFold);
    return {
      correct,
      detail: `Your answer: ${userInput || "(blank)"} | Correct: ${question.correctAnswer}`,
    };
  };

  const renderQuestion = () => {
    const total = state.quizItems.length;
    const q = state.quizItems[state.index];
    if (!q) return;

    const progress = ((state.index + 1) / total) * 100;
    el.progressText.textContent = `Question ${state.index + 1} of ${total}`;
    el.progressBar.style.width = `${progress}%`;
    el.scoreInline.textContent = `Score: ${state.score}`;
    if (state.termsMode) {
      el.topicBadge.textContent = "Terms/Concepts";
      el.difficultyBadge.classList.add("hidden");
      el.questionTitle.textContent = "Terms / Concepts";
    } else {
      el.topicBadge.textContent = q.topic;
      el.difficultyBadge.classList.remove("hidden");
      setDifficultyBadge(q.difficulty);
      el.questionTitle.textContent = q.answerType === "numeric" ? "Computation Problem" : "Term / Concept";
    }
    el.questionText.innerHTML = toQuestionHtml(q.question);
    el.answerInput.placeholder = q.answerType === "numeric" ? "Enter numeric answer" : "Enter short text answer";
    if (q.units) {
      el.answerUnit.textContent = q.units;
      el.answerUnit.classList.remove("hidden");
    } else {
      el.answerUnit.textContent = "";
      el.answerUnit.classList.add("hidden");
    }
    el.answerInput.value = "";
    el.answerInput.disabled = false;
    el.submitBtn.disabled = false;
    el.nextBtn.disabled = true;
    el.feedback.className = "aq-feedback hidden";
    el.feedback.textContent = "";
    el.solution.classList.add("hidden");

    if (q.image) {
      el.questionImage.src = q.image;
      el.questionImage.classList.remove("hidden");
    } else {
      el.questionImage.classList.add("hidden");
    }

    state.isAnswered = false;
    if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise();
  };

  const renderResults = () => {
    const total = state.quizItems.length;
    const accuracy = total ? Math.round((state.score / total) * 100) : 0;

    const items = state.quizItems
      .map((q, idx) => {
        const result = state.answers[idx];
        const cls = result?.correct ? "aq-result--correct" : "aq-result--wrong";
        return `
          <article class="aq-result-item ${cls}">
            <h4>${idx + 1}. ${escapeHtml(q.question).slice(0, 180)}</h4>
            <p><strong>Your Answer:</strong> ${escapeHtml(result?.userInput || "(blank)")} ${result?.correct ? "✅" : "❌"}</p>
            <p><strong>Correct Answer:</strong> ${escapeHtml(String(q.correctAnswer))} ✅</p>
            <details>
              <summary>View explanation</summary>
              <div>${toDisplayHtml(q.explanation || "No explanation provided.")}</div>
            </details>
          </article>
        `;
      })
      .join("");

    el.results.innerHTML = `
      <div class="aq-results__header">
        <h2>Results</h2>
        <p>Score: <strong>${state.score} / ${total}</strong></p>
        <p>Accuracy: <strong>${accuracy}%</strong></p>
        ${state.examMode ? `<p>Time: <strong>${formatTime(state.elapsedSec)}</strong></p>` : ""}
        <div class="aq-actions">
          <button id="aq-review-mistakes" class="btn btn--ghost">Review Mistakes Only</button>
          <button id="aq-retake-btn" class="btn btn--primary">Retake</button>
        </div>
      </div>
      <div class="aq-result-list">${items}</div>
    `;

    if (accuracy >= 80) {
      el.results.classList.add("aq-confetti");
      setTimeout(() => el.results.classList.remove("aq-confetti"), 1600);
    }

    const reviewBtn = document.getElementById("aq-review-mistakes");
    const retakeBtn = document.getElementById("aq-retake-btn");

    reviewBtn?.addEventListener("click", () => {
      el.results.querySelectorAll(".aq-result-item").forEach((item) => {
        item.classList.toggle("hidden", item.classList.contains("aq-result--correct"));
      });
    });
    retakeBtn?.addEventListener("click", () => {
      el.results.classList.add("hidden");
      el.quiz.classList.add("hidden");
      el.config.classList.remove("hidden");
    });

    el.quiz.classList.add("hidden");
    el.results.classList.remove("hidden");
  };

  const submitAnswer = () => {
    if (state.isAnswered) return;
    const q = state.quizItems[state.index];
    const userInput = el.answerInput.value;
    const result = compareAnswer(q, userInput);

    if (result.correct) state.score += 1;
    state.answers[state.index] = { userInput, correct: result.correct };
    state.isAnswered = true;
    el.answerInput.disabled = true;
    el.submitBtn.disabled = true;
    el.nextBtn.disabled = false;

    el.feedback.className = `aq-feedback ${result.correct ? "aq-feedback--correct" : "aq-feedback--wrong"}`;
    el.feedback.innerHTML = `<strong>${result.correct ? "Correct" : "Incorrect"}</strong><p>${escapeHtml(result.detail)}</p>`;

    if (!state.examMode) {
      el.solution.classList.remove("hidden");
      el.solution.innerHTML = `
        <p><strong>Correct Answer:</strong> ${escapeHtml(String(q.correctAnswer))}</p>
        <div><strong>Explanation:</strong> ${toDisplayHtml(q.explanation || "No explanation available.")}</div>
      `;
      if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise();
    }
    el.scoreInline.textContent = `Score: ${state.score}`;
  };

  const nextQuestion = () => {
    if (!state.isAnswered) return;
    state.index += 1;
    if (state.index >= state.quizItems.length) {
      stopTimer();
      renderResults();
      return;
    }
    renderQuestion();
  };

  const selectedTopicsArray = () => {
    const availableTopics = getAvailableTopics();
    const topicSource = availableTopics.length ? availableTopics : TOPICS;
    if (!state.selectedTopics.size) {
      const randomCount = Math.max(1, Math.min(4, topicSource.length));
      return randomPick(topicSource, randomCount);
    }
    const selected = Array.from(state.selectedTopics).filter((t) => topicSource.includes(t));
    if (selected.length) return selected;
    const randomCount = Math.max(1, Math.min(4, topicSource.length));
    return randomPick(topicSource, randomCount);
  };

  const syncTopicSelectionUI = () => {
    const chips = el.topicChips.querySelectorAll(".aq-chip");
    chips.forEach((chip) => {
      const topic = chip.dataset.topic;
      const isSelected = state.selectedTopics.has(topic);
      chip.classList.toggle("is-selected", isSelected);
    });
    if (el.randomTopicsBtn) {
      el.randomTopicsBtn.classList.toggle("is-selected", state.useRandomTopics);
    }
  };

  const syncCountOptions = () => {
    if (!el.count) return;

    const current = Number(el.count.value) || 10;
    if (state.termsMode) {
      el.count.innerHTML =
        '<option value="5">5</option>' +
        '<option value="10">10</option>' +
        '<option value="15">15</option>' +
        '<option value="20" selected>20</option>';
      el.count.value = String(Math.min(20, Math.max(5, current)));
    } else {
      el.count.innerHTML = '<option value="5">5</option><option value="10" selected>10</option>';
      el.count.value = String(Math.min(10, Math.max(5, current)));
    }
  };

  const syncModeUI = () => {
    if (el.termsConceptsBtn) el.termsConceptsBtn.classList.toggle("is-selected", state.termsMode);

    // Topic chips mode
    syncTopicSelectionUI();

    // Difficulty visibility
    if (el.difficultyGroup) el.difficultyGroup.classList.toggle("hidden", state.termsMode);
    if (el.difficulty) el.difficulty.disabled = state.termsMode;

    syncCountOptions();
  };

  const applyRandomTopicSelection = () => {
    const availableTopics = getAvailableTopics();
    const topicSource = availableTopics.length ? availableTopics : TOPICS;
    const randomCount = Math.max(1, Math.min(4, topicSource.length));
    const pickedTopics = randomPick(topicSource, randomCount);
    state.useRandomTopics = true;
    state.selectedTopics = new Set(pickedTopics);
    syncTopicSelectionUI();
  };

  const filterByDifficulty = (arr, value) => arr.filter((q) => q.difficulty === value);

  const buildPool = () => {
    const rawCount = Number(el.count.value) || 10;
    if (state.termsMode) {
      const itemCount = Math.min(20, rawCount);
      const topics = selectedTopicsArray();
      const filtered = state.termQuestions.filter((q) => topics.includes(q.topic));
      const merged = filtered.length ? filtered : state.termQuestions;
      return shuffle(merged).slice(0, itemCount);
    }

    const topics = selectedTopicsArray();
    const difficulty = el.difficulty.value;
    const itemCount = Math.min(10, rawCount);

    const compPool = state.compQuestions.filter((q) => topics.includes(q.topic));
    let merged = filterByDifficulty(compPool, difficulty);

    // Safety fallback: if topic filter produced no items, use all matching computation questions.
    if (!merged.length) {
      merged = filterByDifficulty(state.compQuestions, difficulty);
    }

    return shuffle(merged).slice(0, itemCount);
  };

  const prepareAndStartQuiz = () => {
    const pool = buildPool();
    if (!pool.length) {
      alert("No quiz items found for this selection. Try different topics/difficulty.");
      return;
    }

    state.quizItems = pool;
    state.answers = new Array(pool.length);
    state.index = 0;
    state.score = 0;
    state.examMode = el.examMode.checked;

    startTimer();
    el.config.classList.add("hidden");
    el.results.classList.add("hidden");
    el.quiz.classList.remove("hidden");
    renderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const buildPdf = async () => {
    const setDownloadStatus = (text, { busy = false } = {}) => {
      if (!el.downloadBtn) return;
      el.downloadBtn.dataset.prevText = el.downloadBtn.dataset.prevText || el.downloadBtn.textContent || "";
      el.downloadBtn.textContent = text;
      el.downloadBtn.disabled = busy;
      if (!busy) {
        window.setTimeout(() => {
          if (!el.downloadBtn) return;
          const prev = el.downloadBtn.dataset.prevText || "Download PDF";
          el.downloadBtn.textContent = prev;
        }, 1400);
      }
    };

    const pool = buildPool();
    if (!pool.length) {
      setDownloadStatus("No items to export");
      return;
    }

    // No popups: always include answer key page.
    const includeKey = true;
    const jsPdfApi = window.jspdf?.jsPDF;
    if (!jsPdfApi) {
      setDownloadStatus("PDF library missing");
      return;
    }

    // Deterministic PDF builder (does not rely on jsPDF.html/jsSnapshot capture).
    // This guarantees equations become actual images inside the PDF.
    const doc = new jsPdfApi({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 40;
    const marginY = 40;
    const timestamp = Date.now();

    const ptPerPx = 72 / 96; // ~0.75
    const maxContentWidth = pageWidth - marginX * 2;
    const lineHeight = 15;
    const contentWidthPx = Math.max(520, Math.floor(maxContentWidth / ptPerPx));
    const pageHeightPx = Math.floor(pageHeight / ptPerPx);
    const marginXPx = Math.floor(marginX / ptPerPx);
    const marginYPx = Math.floor(marginY / ptPerPx);

    const getSvgMathJax = (() => {
      let cached = null;
      return () => {
        if (cached) return cached;
        cached = new Promise((resolve, reject) => {
          const iframe = document.createElement("iframe");
          iframe.style.position = "fixed";
          iframe.style.left = "-99999px";
          iframe.style.top = "0";
          iframe.style.width = "10px";
          iframe.style.height = "10px";
          iframe.setAttribute("aria-hidden", "true");
          document.body.appendChild(iframe);

          const doc = iframe.contentDocument;
          if (!doc) {
            iframe.remove();
            reject(new Error("PDF MathJax iframe document unavailable"));
            return;
          }

          doc.open();
          doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <script>
      window.MathJax = {
        tex: { inlineMath: [['\\\\(','\\\\)']], displayMath: [['\\\\[','\\\\]']], },
        svg: { fontCache: 'none' }
      };
    </script>
    <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
  </head>
  <body></body>
</html>`);
          doc.close();

          const maxWaitMs = 10000;
          const start = Date.now();
          const tick = () => {
            const mj = iframe.contentWindow?.MathJax;
            if (mj?.startup?.promise) {
              mj.startup.promise
                .then(() => resolve({ iframe, mj }))
                .catch((e) => reject(e));
              return;
            }
            if (Date.now() - start > maxWaitMs) {
              iframe.remove();
              reject(new Error("Timed out loading MathJax SVG renderer"));
              return;
            }
            setTimeout(tick, 60);
          };
          tick();
        });
        return cached;
      };
    })();

    const autoInjectMathDelimiters = (rawText) => {
      const input = String(rawText || "");

      const applyRules = (chunk) => {
        let text = chunk;
        // Only replace LaTeX thin-space outside math mode (we skip math segments entirely below).
        text = text.replace(/\\,/g, " ");

        // Wrap variable assignments like h=6 m, SG = 0.8, P = 3000 Pa
        text = text.replace(
          /\b([A-Za-z](?:_[A-Za-z0-9]+)?\s*=\s*-?\d+(?:\.\d+)?(?:\s*[A-Za-z%°]+(?:\^-?\d+)?)?)\b/g,
          "\\($1\\)"
        );

        // Wrap common unit exponent tokens like m^3, s^-1
        text = text.replace(/\b([A-Za-z]+(?:\^-?\d+))\b/g, "\\($1\\)");

        // Wrap simple arithmetic fragments that include units
        text = text.replace(
          /\b(\d+(?:\.\d+)?\s*(?:[+\-*/=]\s*\d+(?:\.\d+)?)+(?:\s*[A-Za-z%°]+(?:\^-?\d+)?)?)\b/g,
          "\\($1\\)"
        );
        return text;
      };

      // Split the input into "math" and "non-math" segments so we never inject inside existing
      // MathJax delimiters (this prevents broken partial delimiters like "\)\").
      const mathRegex =
        /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|(?:\$\$[\s\S]*?\$\$)|(?:\$[^$\n]+?\$)/g;

      let out = "";
      let lastIndex = 0;
      let match;
      while ((match = mathRegex.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (start > lastIndex) {
          out += applyRules(input.slice(lastIndex, start));
        }
        out += match[0]; // keep existing math untouched
        lastIndex = end;
      }
      if (lastIndex < input.length) {
        out += applyRules(input.slice(lastIndex));
      }
      return out;
    };

    const tokenizeLatex = (rawText) => {
      const text = autoInjectMathDelimiters(rawText);
      const regex = /\\\((.*?)\\\)|\\\[(.*?)\\\]|(?:\$\$(.*?)\$\$)|(?:\$([^$\n]+)\$)/gs;
      const tokens = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
        }
        const inlineTex = match[1];
        const bracketDisplayTex = match[2];
        const dollarDisplayTex = match[3];
        const singleDollarInlineTex = match[4];
        if (bracketDisplayTex !== undefined) tokens.push({ type: "eq", latex: bracketDisplayTex, display: true });
        else if (dollarDisplayTex !== undefined) tokens.push({ type: "eq", latex: dollarDisplayTex, display: true });
        else if (singleDollarInlineTex !== undefined) tokens.push({ type: "eq", latex: singleDollarInlineTex, display: false });
        else tokens.push({ type: "eq", latex: inlineTex, display: false });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) tokens.push({ type: "text", value: text.slice(lastIndex) });
      return tokens;
    };

    const renderLatexToSvgMarkup = async (latex, displayMode) => {
      const { mj } = await getSvgMathJax();
      const node = await mj.tex2svgPromise(latex, { display: !!displayMode });
      const svg = node.querySelector("svg");
      if (!svg) throw new Error("No SVG returned from MathJax");
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const serializer = new XMLSerializer();
      return serializer.serializeToString(svg);
    };

    const svgMarkupToPngData = async (svgMarkup, scale = 2) => {
      const svgB64 = btoa(unescape(encodeURIComponent(svgMarkup)));
      const svgUri = `data:image/svg+xml;base64,${svgB64}`;

      const vb = svgMarkup.match(/viewBox="([^"]+)"/)?.[1];
      const vbParts = vb ? vb.split(/[ ,]+/).map((x) => parseFloat(x)) : [];
      const vbW = vbParts[2];
      const vbH = vbParts[3];

      const widthAttr = svgMarkup.match(/width="([^"]+)"/)?.[1];
      const heightAttr = svgMarkup.match(/height="([^"]+)"/)?.[1];
      const wFallback = widthAttr ? parseFloat(widthAttr) : vbW || 200;
      const hFallback = heightAttr ? parseFloat(heightAttr) : vbH || 50;

      const img = new Image();
      img.decoding = "async";
      img.src = svgUri;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Failed to load SVG for rasterization"));
      });

      const wpx = img.width || Math.round(wFallback);
      const hpx = img.height || Math.round(hFallback);

      // Clamp pixel dimensions to prevent huge bitmaps that cause jsPDF to render as black boxes.
      const maxPx = 1400;
      const safeScale = Math.min(
        scale,
        maxPx / Math.max(1, wpx),
        maxPx / Math.max(1, hpx)
      );

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(wpx * safeScale));
      canvas.height = Math.max(1, Math.round(hpx * safeScale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pngDataUrl = canvas.toDataURL("image/png");

      return {
        pngDataUrl,
        widthPt: canvas.width * ptPerPx,
        heightPt: canvas.height * ptPerPx,
      };
    };

    const eqCache = new Map();
    const renderEqImage = async (latex, display) => {
      const key = `${display ? "d" : "i"}:${latex}`;
      if (eqCache.has(key)) return eqCache.get(key);
      const svgMarkup = await renderLatexToSvgMarkup(latex, display);
      // Lower base raster scale to keep inline equations small.
      const baseScale = display ? 1.0 : 0.7;
      const png = await svgMarkupToPngData(svgMarkup, baseScale);
      eqCache.set(key, png);
      return png;
    };

    const waitImages = async (root) => {
      const imgs = Array.from(root.querySelectorAll("img"));
      if (!imgs.length) return;
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) return resolve();
              img.onload = resolve;
              img.onerror = resolve;
            })
        )
      );
    };

    const renderDomToPng = async (node, scale = 2) => {
      if (!window.html2canvas) throw new Error("html2canvas missing");
      await waitImages(node);
      const canvas = await window.html2canvas(node, {
        scale,
        backgroundColor: "#ffffff",
        useCORS: false,
        logging: false,
      });
      return {
        png: canvas.toDataURL("image/png"),
        widthPx: canvas.width,
        heightPx: canvas.height,
      };
    };

    const getTopicsLabel = () => {
      if (state.termsMode) {
        const sel = Array.from(state.selectedTopics);
        return sel.length ? sel.join(", ") : "Terms/Concepts (All)";
      }
      const sel = Array.from(state.selectedTopics);
      if (sel.length) return sel.join(", ");
      return "Random Topics";
    };

    const addPageHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("HYDRAULICS QUIZ ENGINE", pageWidth / 2, marginY, { align: "center" });
      doc.setDrawColor(0);
      doc.setLineWidth(0.8);
      doc.line(marginX, marginY + 10, pageWidth - marginX, marginY + 10);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(11);
      doc.text(
        "Solve all items, showing calculations, and enter numerical answers with the correct units.",
        marginX,
        marginY + 30
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Topic/s: ${getTopicsLabel()}`, marginX, marginY + 52);
    };

    const addAnswerKeyPage = async () => {
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("ANSWER KEY", pageWidth / 2, marginY + 10, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);

      let yKey = marginY + 40;
      const maxY = pageHeight - marginY;
      for (let i = 0; i < pool.length; i++) {
        const q = pool[i];
        const line = `${i + 1}) ${q.correctAnswer}${q.units ? " " + q.units : ""}`;
        const lines = doc.splitTextToSize(line, maxContentWidth);
        for (const l of lines) {
          if (yKey > maxY) {
            doc.addPage();
            yKey = marginY + 20;
          }
          doc.text(l, marginX, yKey);
          yKey += 16;
        }
      }
    };

    const ensurePageSpace = (neededPt) => {
      // y is the current baseline; when adding big images, we compare using baseline.
      // If it doesn't fit, add a page.
      if (y + neededPt > pageHeight - marginY) {
        doc.addPage();
        x = marginX;
        y = marginY + lineHeight;
      }
    };

    const drawWrappedText = (text, maxWidthPt, xStart, yBaseline, fontSizePt) => {
      doc.setFontSize(fontSizePt);
      const words = String(text || "")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean);

      let cx = xStart;
      let cy = yBaseline;
      const drawSpaceWidth = doc.getTextWidth(" ");

      for (let i = 0; i < words.length; i++) {
        const w = doc.getTextWidth(words[i] + (i === words.length - 1 ? "" : " "));
        if (cx + w > xStart + maxWidthPt && i > 0) {
          cx = xStart;
          cy += lineHeight;
        }
        doc.text(words[i], cx, cy);
        cx += doc.getTextWidth(words[i]) + drawSpaceWidth;

        if (cy > pageHeight - marginY - lineHeight) {
          doc.addPage();
          cx = xStart;
          cy = marginY + lineHeight;
        }
      }

      return cy;
    };

    // Page 1 header + questions box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0);
    doc.setFont("helvetica", "normal");
    addPageHeader();

    // Box/table area for questions
    const boxTop = marginY + 70;
    const boxLeft = marginX;
    const boxWidth = maxContentWidth;
    const boxBottomMargin = 28;
    const boxHeight = pageHeight - boxTop - boxBottomMargin;
    doc.setLineWidth(0.8);
    doc.rect(boxLeft, boxTop, boxWidth, boxHeight);

    // Render each question as an image block and place inside the box (paginate if needed)
    if (!window.html2canvas) {
      setDownloadStatus("Renderer missing");
      return;
    }

    setDownloadStatus("Generating…", { busy: true });

    const hiddenRoot = document.createElement("div");
    hiddenRoot.style.position = "fixed";
    hiddenRoot.style.left = "-10000px";
    hiddenRoot.style.top = "0";
    hiddenRoot.style.width = `${contentWidthPx}px`;
    hiddenRoot.style.background = "#ffffff";
    hiddenRoot.style.color = "#111111";
    hiddenRoot.style.filter = "none";
    hiddenRoot.style.padding = "0";
    hiddenRoot.style.margin = "0";
    hiddenRoot.style.pointerEvents = "none";
    hiddenRoot.style.zIndex = "-1";
    document.body.appendChild(hiddenRoot);

    let cursorY = boxTop + 14;
    let currentPageHasBox = true;

    const ensureQuestionsPage = () => {
      if (currentPageHasBox) return;
      addPageHeader();
      doc.rect(boxLeft, boxTop, boxWidth, boxHeight);
      cursorY = boxTop + 14;
      currentPageHasBox = true;
    };

    for (let qi = 0; qi < pool.length; qi++) {
      const q = pool[qi];
      const tokens = tokenizeLatex(String(q.question || ""));

      const qDiv = document.createElement("div");
      qDiv.style.width = `${contentWidthPx}px`;
      qDiv.style.fontFamily = "Poppins, Arial, sans-serif";
      qDiv.style.fontSize = "13px";
      qDiv.style.lineHeight = "1.65";
      qDiv.style.whiteSpace = "pre-wrap";
      qDiv.style.wordBreak = "break-word";
      qDiv.style.margin = "0";
      qDiv.style.padding = "0";
      qDiv.style.background = "#ffffff";
      qDiv.style.color = "#111111";

      const prefix = document.createElement("span");
      prefix.style.fontWeight = "700";
      prefix.textContent = `${qi + 1}) `;
      qDiv.appendChild(prefix);

      for (let ti = 0; ti < tokens.length; ti++) {
        const t = tokens[ti];
        if (t.type === "text") {
          const span = document.createElement("span");
          span.textContent = t.value;
          qDiv.appendChild(span);
        } else if (t.type === "eq") {
          try {
            const eq = await renderEqImage(t.latex, t.display);
            const img = document.createElement("img");
            img.src = eq.pngDataUrl;
            img.alt = t.latex;
            if (t.display) {
              img.style.display = "block";
              img.style.maxWidth = "100%";
              img.style.margin = "6px 0";
            } else {
              img.style.display = "inline-block";
              img.style.verticalAlign = "middle";
              img.style.maxWidth = "100%";
              img.style.height = "0.95em";
              img.style.width = "auto";
              img.style.margin = "0 2px";
            }
            qDiv.appendChild(img);
          } catch (e) {
            const span = document.createElement("span");
            span.textContent = String(t.latex);
            qDiv.appendChild(span);
          }
        }
      }

      hiddenRoot.appendChild(qDiv);
      const rendered = await renderDomToPng(qDiv, 2);
      const imgDataUrl = rendered.png;

      const wPt = boxWidth - 20;
      const hPt = (rendered.heightPx / Math.max(1, rendered.widthPx)) * wPt;

      // If it doesn't fit in the current box, start a new page with a new box.
      if (cursorY + hPt > boxTop + boxHeight - 10) {
        doc.addPage();
        currentPageHasBox = false;
        ensureQuestionsPage();
      }

      doc.addImage(imgDataUrl, "PNG", boxLeft + 10, cursorY, wPt, hPt);
      cursorY += hPt + 10;

      hiddenRoot.removeChild(qDiv);
    }

    document.body.removeChild(hiddenRoot);

    // Answer key on Page 2+
    if (includeKey) {
      await addAnswerKeyPage();
    }

    // Add page numbers
    const pageCount = doc.getNumberOfPages();
    for (let pi = 1; pi <= pageCount; pi++) {
      doc.setPage(pi);
      doc.setFontSize(10);
      doc.text(`Page ${pi} of ${pageCount}`, pageWidth - marginX, pageHeight - 14, { align: "right" });
    }

    doc.save(`hydraulics-quiz-${timestamp}.pdf`);
    if (el.downloadBtn) {
      el.downloadBtn.disabled = false;
      const prev = el.downloadBtn.dataset.prevText || "Download PDF";
      el.downloadBtn.textContent = prev;
    }
  };

  const createTopicChips = () => {
    el.topicChips.innerHTML = TOPICS.map(
      (topic) => `<button class="aq-chip" type="button" data-topic="${topic}">${topic}</button>`
    ).join("");

    el.topicChips.querySelectorAll(".aq-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const topic = chip.dataset.topic;
        state.useRandomTopics = false;
        if (state.selectedTopics.has(topic)) {
          state.selectedTopics.delete(topic);
        } else {
          state.selectedTopics.add(topic);
        }
        syncTopicSelectionUI();
      });
    });
    syncTopicSelectionUI();
  };

  const loadData = async () => {
    const [qRes, tRes] = await Promise.all([
      fetch("assets/data/quiz.json"),
      fetch("assets/data/terms-concepts.json"),
    ]);
    const quizQuestions = await qRes.json();
    const termsConcepts = await tRes.json();

    state.compQuestions = quizQuestions
      .map((q, i) => {
        const ans = Number(q.answer);
        if (!Number.isFinite(ans)) return null;
        return {
          id: `comp-${q.id || i + 1}`,
          source: "computation",
          topic: TOPICS.includes(q.topic) ? q.topic : inferTopicFromText(q.question),
          difficulty: normalize(q.difficulty),
          question: q.question,
          image: q.image || "",
          answerType: "numeric",
          correctAnswer: ans,
          tolerance: Number.isFinite(Number(q.tolerance)) ? Number(q.tolerance) : 0.01,
          units: q.units || "",
          explanation: q.solution || q.explanation_correct || "",
        };
      })
      .filter(Boolean);

    const terms = (termsConcepts.terms || []).map((item, idx) => ({
      id: `term-${idx + 1}`,
      source: "term",
      topic: inferTopicFromText(`${item.term} ${item.definition}`),
      difficulty: "easy",
      question: item.definition,
      answerType: "text",
      correctAnswer: item.term,
      explanation: `${item.term}: ${item.definition}`,
    }));

    const concepts = (termsConcepts.concepts || []).map((item, idx) => ({
      id: `concept-${idx + 1}`,
      source: "concept",
      topic: inferTopicFromText(item.question),
      difficulty: "medium",
      question: item.question,
      answerType: "text",
      correctAnswer: item.answer,
      explanation: `Concept answer: ${item.answer}`,
    }));

    state.termQuestions = [...terms, ...concepts];
  };

  const bind = () => {
    el.back?.addEventListener("click", () => (window.location.href = "index.html#home"));
    el.randomTopicsBtn.addEventListener("click", () => {
      applyRandomTopicSelection();
    });

    el.termsConceptsBtn?.addEventListener("click", () => {
      state.termsMode = !state.termsMode;
      if (state.termsMode) {
        state.useRandomTopics = false;
        state.selectedTopics.clear();
      }
      syncModeUI();
    });

    el.startBtn.addEventListener("click", () => showModal(true));
    el.confirmStart.addEventListener("click", () => {
      showModal(false);
      prepareAndStartQuiz();
    });
    el.cancelStart.addEventListener("click", () => showModal(false));
    el.downloadBtn.addEventListener("click", buildPdf);
    el.submitBtn.addEventListener("click", submitAnswer);
    el.nextBtn.addEventListener("click", nextQuestion);
    el.answerInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !state.isAnswered) submitAnswer();
    });
  };

  const init = async () => {
    createTopicChips();
    bind();
    syncModeUI();
    try {
      await loadData();
    } catch (error) {
      console.error("Failed to initialize advanced quiz engine.", error);
      alert("Failed to load quiz datasets.");
    }
  };

  init();
})();
