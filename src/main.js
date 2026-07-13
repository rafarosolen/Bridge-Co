import { io } from "socket.io-client";
import bridgeLogo from "./assets/bridge-logo.png";
import "./styles.css";

const socket = io();
const app = document.querySelector("#app");
const hostMode = new URLSearchParams(location.search).has("host");
const LETTERS = ["A", "B", "C", "D"];
let state = null;
let playerId = sessionStorage.getItem("bridge-player-id");
let connectionTimer = null;

const escapeHtml = (value = "") => value.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const logo = () => `<img class="brand-logo" src="${bridgeLogo}" alt="Bridge & Co">`;
const shell = (content, cls = "") => { app.innerHTML = `<main class="app-shell ${cls}"><div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>${content}</main>`; };

function renderConnectionError() {
  if (state) return;
  shell(`<section class="mobile-card glass-panel centered">${logo()}<p class="eyebrow">CONEXÃO MULTIPLAYER</p><h1>Servidor indisponível.</h1><p>O quiz foi publicado como site estático. Configure-o no Render como <strong>Web Service · Node</strong> para ativar o painel do host e os celulares.</p><button class="primary-button" onclick="location.reload()">Tentar novamente</button></section>`, "player-screen");
}

connectionTimer = window.setTimeout(renderConnectionError, 5000);
socket.on("connect", () => { if (playerId) playerId = socket.id; });
socket.on("connect_error", () => { if (!connectionTimer) connectionTimer = window.setTimeout(renderConnectionError, 1200); });
socket.on("game:state", (next) => { state = next; render(); });

function render() {
  if (!state) return;
  hostMode ? renderHost() : renderPlayer();
}

function renderHost() {
  const ranked = [...state.players].sort((a, b) => b.score - a.score || b.correct - a.correct);
  if (state.status === "lobby") {
    shell(`<section class="host-lobby glass-panel">
      <header class="host-header">${logo()}<span class="live-pill"><span></span> PAINEL DO HOST</span></header>
      <div class="host-lobby-grid"><div><p class="eyebrow">ENTRADA AO VIVO</p><h1>Teste seu<br><span>conhecimento.</span></h1><p class="hero-description">Abra a câmera do celular, aponte para o código e informe seu nome.</p><button id="start" class="primary-button" ${state.playerCount ? "" : "disabled"}>Iniciar com ${state.playerCount} participante${state.playerCount === 1 ? "" : "s"}</button></div>
      <div class="qr-panel"><img src="/qr.png" alt="QR Code para entrar no quiz"><strong>bridge-automation-quiz.onrender.com</strong></div></div>
      <div class="player-strip">${state.players.length ? state.players.map(p => `<span>${escapeHtml(p.name)}</span>`).join("") : "<em>Aguardando participantes…</em>"}</div>
    </section>`, "host-screen");
    document.querySelector("#start")?.addEventListener("click", () => socket.emit("host:start"));
    return;
  }
  if (state.status === "finished") return renderPodium(ranked);
  const q = state.question;
  const answered = state.players.filter(p => p.answer !== null).length;
  const counts = q.options.map((_, i) => state.players.filter(p => p.answer === i).length);
  shell(`<section class="host-game">
    <header class="quiz-topbar">${logo()}<div class="progress-meta"><span>QUESTÃO ${state.questionIndex + 1} DE ${state.totalQuestions}</span><div class="progress-track"><div style="width:${((state.questionIndex + 1) / state.totalQuestions) * 100}%"></div></div></div><div class="score-box"><span>RESPOSTAS</span><strong>${answered}/${state.playerCount}</strong></div></header>
    <div class="host-question"><p class="eyebrow">${q.section}</p><h2>${q.question}</h2></div>
    <div class="host-options">${q.options.map((o, i) => `<div class="host-option option-${i} ${state.revealed && i === q.answerIndex ? "winner" : ""}"><b>${LETTERS[i]}</b><span>${o}</span>${state.revealed ? `<strong>${counts[i]}</strong>` : `<strong class="hidden-count" aria-label="Votos ocultos">•</strong>`}</div>`).join("")}</div>
    ${state.revealed ? `<div class="reveal-board"><div><span>ACERTARAM</span><strong>${state.players.filter(p => p.earned > 0).length}</strong></div><div class="answer-names">${state.players.filter(p => p.earned > 0).sort((a,b)=>b.earned-a.earned).map(p => `<span>✓ ${escapeHtml(p.name)} <b>+${p.earned}</b></span>`).join("") || "Ninguém acertou esta rodada"}</div><button id="next" class="primary-button">${state.questionIndex === state.totalQuestions - 1 ? "Ver pódio" : "Próxima pergunta"} →</button></div>` : `<div class="host-controls"><span>${answered === state.playerCount && state.playerCount ? "Todos responderam!" : "Respostas chegando em tempo real…"}</span><button id="reveal" class="primary-button">Revelar resposta</button></div>`}
  </section>`, "host-screen");
  document.querySelector("#reveal")?.addEventListener("click", () => socket.emit("host:reveal"));
  document.querySelector("#next")?.addEventListener("click", () => socket.emit("host:next"));
}

function renderPodium(ranked) {
  shell(`<section class="podium glass-panel"><header class="host-header">${logo()}<span class="live-pill"><span></span> RESULTADO FINAL</span></header><p class="eyebrow">PÓDIO DO TREINAMENTO</p><h1>Treinamento de <span>Automação Bridge.</span></h1><div class="podium-list">${ranked.slice(0, 10).map((p, i) => `<div class="rank rank-${i + 1}"><b>${i + 1}</b><span>${escapeHtml(p.name)}<small>${p.correct}/${state.totalQuestions} acertos</small></span><strong>${p.score.toLocaleString("pt-BR")}</strong></div>`).join("")}</div><button id="reset" class="secondary-button">Nova turma</button></section>`, "host-screen result-screen");
  document.querySelector("#reset").addEventListener("click", () => socket.emit("host:reset"));
}

function renderPlayer() {
  const me = state.players.find(p => p.id === socket.id);
  if (!me) {
    shell(`<section class="mobile-card glass-panel">${logo()}<p class="eyebrow">TREINAMENTO INTERATIVO</p><h1>Entre no desafio.</h1><form id="join"><input id="name" maxlength="32" placeholder="Digite seu nome" required><button class="primary-button">Entrar no jogo →</button></form><p class="helper-text">Aguarde o host iniciar a primeira pergunta.</p></section>`, "player-screen");
    document.querySelector("#join").addEventListener("submit", (e) => { e.preventDefault(); socket.emit("player:join", document.querySelector("#name").value, (r) => { if (r.ok) { playerId = r.id; sessionStorage.setItem("bridge-player-id", r.id); } }); });
    return;
  }
  if (state.status === "lobby") return shell(`<section class="mobile-card glass-panel centered">${logo()}<div class="waiting-pulse"></div><h1>Você está dentro!</h1><p>Olá, <strong>${escapeHtml(me.name)}</strong>. Olhe para a tela principal.</p></section>`, "player-screen");
  if (state.status === "finished") return shell(`<section class="mobile-card glass-panel centered">${logo()}<p class="eyebrow">RESULTADO FINAL</p><h1>${me.score.toLocaleString("pt-BR")} pontos</h1><p>${me.correct} de ${state.totalQuestions} respostas corretas.</p></section>`, "player-screen");
  const q = state.question;
  if (state.revealed) return shell(`<section class="mobile-card glass-panel centered result-${me.earned ? "correct" : "wrong"}">${logo()}<div class="result-icon">${me.earned ? "✓" : "×"}</div><h1>${me.earned ? "Você acertou!" : "Não foi desta vez"}</h1><strong class="earned">${me.earned ? `+${me.earned} pontos` : `${me.score.toLocaleString("pt-BR")} pontos`}</strong><p>${q.explanation}</p></section>`, "player-screen");
  shell(`<section class="mobile-quiz"><header>${logo()}<span>${me.score.toLocaleString("pt-BR")} pts</span></header><p class="eyebrow">QUESTÃO ${state.questionIndex + 1}/${state.totalQuestions}</p><h2>${q.question}</h2>${me.answer !== null ? `<div class="answered"><div class="waiting-pulse"></div><h3>Resposta enviada!</h3><p>Olhe para a tela principal.</p></div>` : `<div class="mobile-options">${q.options.map((o, i) => `<button data-answer="${i}" class="option-${i}"><b>${LETTERS[i]}</b><span>${o}</span></button>`).join("")}</div>`}</section>`, "player-screen");
  document.querySelectorAll("[data-answer]").forEach(btn => btn.addEventListener("click", () => socket.emit("player:answer", Number(btn.dataset.answer))));
}
