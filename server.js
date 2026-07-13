import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import QRCode from "qrcode";
import quizData from "./data/questions.json" with { type: "json" };

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

const game = { status: "lobby", questionIndex: -1, revealed: false, questionStartedAt: null, players: new Map() };

const publicState = () => ({
  status: game.status,
  questionIndex: game.questionIndex,
  revealed: game.revealed,
  totalQuestions: quizData.questions.length,
  playerCount: game.players.size,
  players: [...game.players.values()].map(({ id, name, score, correct, answer, earned }) => ({ id, name, score, correct, answer, earned })),
  question: game.questionIndex >= 0 ? {
    section: quizData.questions[game.questionIndex].section,
    question: quizData.questions[game.questionIndex].question,
    options: quizData.questions[game.questionIndex].options,
    ...(game.revealed ? {
      answerIndex: quizData.questions[game.questionIndex].answerIndex,
      explanation: quizData.questions[game.questionIndex].explanation,
    } : {}),
  } : null,
});

const broadcast = () => io.emit("game:state", publicState());

io.on("connection", (socket) => {
  socket.emit("game:state", publicState());

  socket.on("player:join", (rawName, done = () => {}) => {
    const name = String(rawName || "").trim().slice(0, 32);
    if (!name) return done({ ok: false, error: "Informe seu nome." });
    game.players.set(socket.id, { id: socket.id, name, score: 0, correct: 0, answer: null, earned: 0, answeredAt: null });
    socket.data.player = true;
    done({ ok: true, id: socket.id });
    broadcast();
  });

  socket.on("player:answer", (option, done = () => {}) => {
    const player = game.players.get(socket.id);
    if (!player || game.status !== "question" || game.revealed || player.answer !== null) return done({ ok: false });
    player.answer = Number(option);
    player.answeredAt = Date.now();
    done({ ok: true });
    broadcast();
  });

  socket.on("host:start", () => {
    game.players.forEach((p) => Object.assign(p, { score: 0, correct: 0, answer: null, earned: 0 }));
    game.status = "question"; game.questionIndex = 0; game.revealed = false; game.questionStartedAt = Date.now();
    broadcast();
  });

  socket.on("host:reveal", () => {
    if (game.status !== "question" || game.revealed) return;
    const q = quizData.questions[game.questionIndex];
    game.players.forEach((p) => {
      const responseSeconds = Math.min(30, Math.max(0, ((p.answeredAt || Date.now()) - game.questionStartedAt) / 1000));
      p.earned = p.answer === q.answerIndex ? Math.max(500, 1000 - Math.round(responseSeconds * 16)) : 0;
      if (p.earned) p.correct += 1;
      p.score += p.earned;
    });
    game.revealed = true;
    broadcast();
  });

  socket.on("host:next", () => {
    if (!game.revealed) return;
    if (game.questionIndex >= quizData.questions.length - 1) game.status = "finished";
    else {
      game.questionIndex += 1; game.revealed = false; game.questionStartedAt = Date.now();
      game.players.forEach((p) => Object.assign(p, { answer: null, earned: 0, answeredAt: null }));
    }
    broadcast();
  });

  socket.on("host:reset", () => {
    game.status = "lobby"; game.questionIndex = -1; game.revealed = false; game.questionStartedAt = null; game.players.clear();
    broadcast();
  });

  socket.on("disconnect", () => {
    if (socket.data.player) { game.players.delete(socket.id); broadcast(); }
  });
});

app.get("/health", (_, res) => res.json({ ok: true }));
app.get("/qr.png", async (req, res) => {
  const target = `${req.protocol}://${req.get("host")}/`;
  res.type("png").send(await QRCode.toBuffer(target, { width: 900, margin: 3, errorCorrectionLevel: "H" }));
});
app.use(express.static("dist"));
app.use((_, res) => res.sendFile(new URL("./dist/index.html", import.meta.url).pathname));

server.listen(port, "0.0.0.0", () => console.log(`Bridge Quiz na porta ${port}`));
