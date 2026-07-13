import quizData from "../data/questions.json";
import bridgeLogo from "./assets/bridge-logo.png";
import "./styles.css";

const app = document.querySelector("#app");
const LETTERS = ["A", "B", "C", "D"];
const SHAPES = ["triangle", "diamond", "circle", "square"];
const STORAGE_KEY = "bridge-automation-quiz-ranking-v1";

const state = {
  participant: "",
  questionIndex: 0,
  score: 0,
  correct: 0,
  answers: [],
  timerId: null,
  startedAt: 0,
  timeLeft: quizData.settings.defaultTimeLimitSeconds,
  locked: false,
  feedbackVisible: false,
};

function logoMarkup() {
  return `<img class="brand-logo" src="${bridgeLogo}" alt="Bridge & Co" />`;
}

function shell(content, className = "") {
  app.innerHTML = `
    <main class="app-shell ${className}">
      <div class="ambient ambient-one"></div>
      <div class="ambient ambient-two"></div>
      ${content}
    </main>
  `;
}

function getRanking() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRanking(result) {
  const ranking = [...getRanking(), result]
    .sort((a, b) => b.score - a.score || b.correct - a.correct || a.duration - b.duration)
    .slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ranking));
  return ranking;
}

function resetQuiz() {
  clearTimer();
  state.questionIndex = 0;
  state.score = 0;
  state.correct = 0;
  state.answers = [];
  state.locked = false;
  state.feedbackVisible = false;
}

function renderHome() {
  const ranking = getRanking();
  const best = ranking[0];

  shell(`
    <section class="home-card glass-panel">
      <header class="home-header">
        ${logoMarkup()}
        <span class="live-pill"><span></span> treinamento interativo</span>
      </header>

      <div class="hero-copy">
        <p class="eyebrow">DESAFIO FINAL</p>
        <h1>Do manual ao <span>autônomo.</span></h1>
        <p class="hero-description">
          Dez perguntas para testar sua visão de processo, arquitetura, desenvolvimento e operação.
        </p>
      </div>

      <form class="join-card" id="join-form">
        <label for="participant-name">Como devemos chamar você?</label>
        <div class="join-row">
          <input
            id="participant-name"
            name="participant"
            maxlength="32"
            autocomplete="name"
            placeholder="Digite seu nome"
            required
          />
          <button class="primary-button" type="submit">
            Começar desafio <span aria-hidden="true">→</span>
          </button>
        </div>
        <p class="helper-text">10 questões · 30 segundos cada · até 10.000 pontos</p>
      </form>

      <div class="home-stats" aria-label="Informações do quiz">
        <div><strong>10</strong><span>perguntas</span></div>
        <div><strong>04</strong><span>alternativas</span></div>
        <div><strong>30s</strong><span>por rodada</span></div>
        <div><strong>${best ? best.score.toLocaleString("pt-BR") : "—"}</strong><span>recorde local</span></div>
      </div>
    </section>
  `, "home-screen");

  document.querySelector("#join-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#participant-name");
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    state.participant = name;
    startQuiz();
  });
}

function startQuiz() {
  resetQuiz();
  state.startedAt = Date.now();
  renderQuestion();
}

function renderQuestion() {
  clearTimer();
  state.locked = false;
  state.feedbackVisible = false;
  state.timeLeft = quizData.settings.defaultTimeLimitSeconds;
  const question = quizData.questions[state.questionIndex];
  const progress = ((state.questionIndex + 1) / quizData.questions.length) * 100;

  shell(`
    <section class="quiz-layout">
      <header class="quiz-topbar">
        ${logoMarkup()}
        <div class="progress-meta">
          <span>Questão ${String(state.questionIndex + 1).padStart(2, "0")} de ${quizData.questions.length}</span>
          <div class="progress-track" aria-hidden="true">
            <div style="width: ${progress}%"></div>
          </div>
        </div>
        <div class="score-box">
          <span>PONTOS</span>
          <strong id="score-value">${state.score.toLocaleString("pt-BR")}</strong>
        </div>
      </header>

      <div class="question-stage">
        <div class="question-heading">
          <p class="eyebrow">${question.section}</p>
          <h2>${question.question}</h2>
        </div>

        <div class="timer-card" aria-label="Tempo restante">
          <div class="timer-ring" id="timer-ring">
            <span id="timer-value">${state.timeLeft}</span>
            <small>seg</small>
          </div>
        </div>

        <div class="options-grid" role="group" aria-label="Alternativas">
          ${question.options.map((option, index) => `
            <button class="option-card option-${index}" data-option="${index}" type="button">
              <span class="option-symbol"><i class="shape ${SHAPES[index]}"></i></span>
              <span class="option-copy">
                <small>${LETTERS[index]}</small>
                <strong>${option}</strong>
              </span>
              <kbd>${index + 1}</kbd>
            </button>
          `).join("")}
        </div>

        <div class="timer-track" aria-hidden="true">
          <div id="timer-progress"></div>
        </div>
      </div>

      <footer class="quiz-footer">
        <span>Participante: <strong>${escapeHtml(state.participant)}</strong></span>
        <span>Use as teclas <kbd>1</kbd>–<kbd>4</kbd> para responder</span>
      </footer>
      <div id="feedback-root"></div>
    </section>
  `, "quiz-screen");

  document.querySelectorAll("[data-option]").forEach((button) => {
    button.addEventListener("click", () => resolveAnswer(Number(button.dataset.option)));
  });

  state.questionStartedAt = performance.now();
  state.timerId = window.setInterval(updateTimer, 100);
  updateTimer();
}

function updateTimer() {
  if (state.locked) return;
  const limit = quizData.settings.defaultTimeLimitSeconds;
  const elapsed = (performance.now() - state.questionStartedAt) / 1000;
  state.timeLeft = Math.max(0, limit - elapsed);
  const seconds = Math.ceil(state.timeLeft);
  const ratio = state.timeLeft / limit;
  const timerValue = document.querySelector("#timer-value");
  const timerProgress = document.querySelector("#timer-progress");
  const timerRing = document.querySelector("#timer-ring");

  if (timerValue) timerValue.textContent = seconds;
  if (timerProgress) timerProgress.style.width = `${ratio * 100}%`;
  if (timerRing) {
    timerRing.style.setProperty("--timer-angle", `${ratio * 360}deg`);
    timerRing.classList.toggle("timer-warning", state.timeLeft <= 8);
  }

  if (state.timeLeft <= 0) resolveAnswer(-1);
}

function resolveAnswer(selectedIndex) {
  if (state.locked) return;
  state.locked = true;
  clearTimer();

  const question = quizData.questions[state.questionIndex];
  const isCorrect = selectedIndex === question.answerIndex;
  const limit = quizData.settings.defaultTimeLimitSeconds;
  const speedRatio = Math.max(0, state.timeLeft / limit);
  const earned = isCorrect
    ? Math.round(quizData.settings.defaultPoints * (0.5 + speedRatio * 0.5))
    : 0;

  state.score += earned;
  if (isCorrect) state.correct += 1;
  state.answers.push({
    question: state.questionIndex,
    selectedIndex,
    correct: isCorrect,
    earned,
    responseTime: limit - state.timeLeft,
  });

  document.querySelectorAll("[data-option]").forEach((button) => {
    const index = Number(button.dataset.option);
    button.disabled = true;
    if (index === question.answerIndex) button.classList.add("is-correct");
    if (index === selectedIndex && !isCorrect) button.classList.add("is-wrong");
    if (index !== question.answerIndex && index !== selectedIndex) button.classList.add("is-muted");
  });

  document.querySelector("#score-value").textContent = state.score.toLocaleString("pt-BR");
  renderFeedback({ question, isCorrect, earned, timedOut: selectedIndex < 0 });
}

function renderFeedback({ question, isCorrect, earned, timedOut }) {
  state.feedbackVisible = true;
  const isLast = state.questionIndex === quizData.questions.length - 1;
  const root = document.querySelector("#feedback-root");
  root.innerHTML = `
    <div class="feedback-backdrop"></div>
    <aside class="feedback-panel ${isCorrect ? "feedback-correct" : "feedback-wrong"}" aria-live="polite">
      <div class="feedback-status">
        <span class="feedback-icon">${isCorrect ? "✓" : timedOut ? "⌛" : "×"}</span>
        <div>
          <p>${isCorrect ? "RESPOSTA CORRETA" : timedOut ? "TEMPO ESGOTADO" : "QUASE LÁ"}</p>
          <h3>${isCorrect ? `+${earned.toLocaleString("pt-BR")} pontos` : `A resposta era ${question.answer}`}</h3>
        </div>
      </div>
      <p class="feedback-explanation">${question.explanation}</p>
      <button class="primary-button" id="continue-button" type="button">
        ${isLast ? "Ver meu resultado" : "Próxima pergunta"} <span aria-hidden="true">→</span>
      </button>
    </aside>
  `;
  window.setTimeout(() => root.classList.add("is-visible"), 20);
  document.querySelector("#continue-button").addEventListener("click", continueQuiz);
}

function continueQuiz() {
  if (state.questionIndex < quizData.questions.length - 1) {
    state.questionIndex += 1;
    renderQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  clearTimer();
  const duration = Math.round((Date.now() - state.startedAt) / 1000);
  const result = {
    name: state.participant,
    score: state.score,
    correct: state.correct,
    total: quizData.questions.length,
    duration,
    createdAt: new Date().toISOString(),
  };
  const ranking = saveRanking(result);
  const position = ranking.findIndex((entry) => entry.createdAt === result.createdAt) + 1;
  renderResult(result, ranking, position);
}

function renderResult(result, ranking, position) {
  const accuracy = Math.round((result.correct / result.total) * 100);
  const topThree = ranking.slice(0, 3);
  const medals = ["1º", "2º", "3º"];

  shell(`
    <section class="result-card glass-panel">
      <header class="result-header">
        ${logoMarkup()}
        <span class="live-pill"><span></span> desafio concluído</span>
      </header>

      <div class="result-hero">
        <div class="result-badge">${position === 1 ? "★" : position}</div>
        <p class="eyebrow">RESULTADO FINAL</p>
        <h1>Mandou bem, <span>${escapeHtml(result.name)}</span>.</h1>
        <p>Você concluiu a jornada do processo manual à operação automatizada.</p>
      </div>

      <div class="result-metrics">
        <div><span>Pontuação</span><strong>${result.score.toLocaleString("pt-BR")}</strong></div>
        <div><span>Acertos</span><strong>${result.correct}/${result.total}</strong></div>
        <div><span>Aproveitamento</span><strong>${accuracy}%</strong></div>
        <div><span>Posição local</span><strong>#${position}</strong></div>
      </div>

      <section class="leaderboard">
        <div class="section-title">
          <div><p class="eyebrow">RANKING LOCAL</p><h2>Pódio da sessão</h2></div>
          <button class="text-button" id="clear-ranking" type="button">Limpar ranking</button>
        </div>
        <div class="leaderboard-list">
          ${topThree.map((entry, index) => `
            <div class="leader-row ${entry.createdAt === result.createdAt ? "is-current" : ""}">
              <span class="medal medal-${index + 1}">${medals[index]}</span>
              <strong>${escapeHtml(entry.name)}</strong>
              <span>${entry.correct}/${entry.total} acertos</span>
              <b>${entry.score.toLocaleString("pt-BR")}</b>
            </div>
          `).join("") || `<p class="empty-ranking">Ainda não há resultados nesta sessão.</p>`}
        </div>
      </section>

      <div class="result-actions">
        <button class="secondary-button" id="home-button" type="button">Voltar ao início</button>
        <button class="primary-button" id="retry-button" type="button">Jogar novamente <span>↻</span></button>
      </div>
    </section>
  `, "result-screen");

  document.querySelector("#retry-button").addEventListener("click", startQuiz);
  document.querySelector("#home-button").addEventListener("click", renderHome);
  document.querySelector("#clear-ranking").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    renderHome();
  });
}

function clearTimer() {
  if (state.timerId) window.clearInterval(state.timerId);
  state.timerId = null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("keydown", (event) => {
  if (state.feedbackVisible && event.key === "Enter") {
    document.querySelector("#continue-button")?.click();
    return;
  }
  if (state.locked || !document.querySelector(".quiz-screen")) return;
  const key = event.key.toUpperCase();
  const index = ["1", "2", "3", "4"].indexOf(key) >= 0
    ? Number(key) - 1
    : LETTERS.indexOf(key);
  if (index >= 0) document.querySelector(`[data-option="${index}"]`)?.click();
});

renderHome();
