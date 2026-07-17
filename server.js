/**
 * QUIZ AO VIVO — estilo Kahoot
 * Servidor sem dependências externas. Requer apenas Node.js instalado.
 *
 * Como rodar:  node server.js   (ou clique duplo em iniciar.bat no Windows)
 *
 * Telas:
 *   http://SEU-IP:3000/        -> jogadores (celular, via QR Code)
 *   http://SEU-IP:3000/host    -> telão (projetar)
 *   http://SEU-IP:3000/admin   -> cadastro de perguntas
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const QUESTIONS_FILE = path.join(__dirname, 'questions.json');
const GRACE_MS = 1500; // tolerância de rede após o fim do tempo
// PIN do apresentador: protege o controle do jogo e a edição de perguntas.
// Na nuvem (Render), defina a variável de ambiente ADMIN_PIN com um PIN seu.
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

/* ------------------------------ Perguntas ------------------------------ */
let questions = [];
function loadQuestions() {
  try {
    const data = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8'));
    if (Array.isArray(data) && data.length) { questions = data; return; }
  } catch (e) { /* arquivo ainda não existe */ }
  questions = [{
    text: 'Pergunta de exemplo: qual é a capital do Brasil?',
    options: ['Rio de Janeiro', 'Brasília', 'São Paulo', 'Salvador'],
    correct: 1,
    duration: 20
  }];
}
function saveQuestions() {
  fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questions, null, 2), 'utf8');
}
function validateQuestions(list) {
  if (!Array.isArray(list) || !list.length) return 'Cadastre pelo menos 1 pergunta.';
  for (let i = 0; i < list.length; i++) {
    const q = list[i];
    if (!q || typeof q.text !== 'string' || !q.text.trim()) return `Pergunta ${i + 1}: texto vazio.`;
    if (!Array.isArray(q.options)) return `Pergunta ${i + 1}: alternativas inválidas.`;
    q.options = q.options.map(o => String(o || '').trim()).filter(o => o);
    if (q.options.length < 2) return `Pergunta ${i + 1}: preencha pelo menos 2 alternativas.`;
    if (q.options.length > 4) q.options = q.options.slice(0, 4);
    q.correct = Number(q.correct);
    if (!(q.correct >= 0 && q.correct < q.options.length)) return `Pergunta ${i + 1}: marque a alternativa correta.`;
    q.duration = Math.min(300, Math.max(5, Number(q.duration) || 20));
    q.text = q.text.trim();
  }
  return null;
}
loadQuestions();

/* ---------------------------- Estado do jogo --------------------------- */
let players = {}; // id -> { name, score, lastPoints, lastCorrect, lastOption }
let game = {
  state: 'lobby', // lobby | question | reveal | ranking | final
  index: -1,
  startedAt: 0,
  duration: 0,    // ms
  answers: {}     // playerId -> { option, elapsed }
};
let questionTimer = null;

function currentQuestion() { return questions[game.index] || null; }

function rankedPlayers() {
  return Object.entries(players)
    .map(([id, p]) => ({ id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
}

function startQuestion(i) {
  const q = questions[i];
  if (!q) return;
  game.state = 'question';
  game.index = i;
  game.duration = (q.duration || 20) * 1000;
  game.startedAt = Date.now();
  game.answers = {};
  for (const p of Object.values(players)) {
    p.lastPoints = 0; p.lastCorrect = null; p.lastOption = null;
  }
  clearTimeout(questionTimer);
  questionTimer = setTimeout(endQuestion, game.duration + 400);
  broadcast();
}

function endQuestion() {
  if (game.state !== 'question') return;
  clearTimeout(questionTimer);
  const q = currentQuestion();
  for (const [pid, ans] of Object.entries(game.answers)) {
    const p = players[pid];
    if (!p) continue;
    p.lastOption = ans.option;
    p.lastCorrect = (ans.option === q.correct);
    if (p.lastCorrect) {
      // Pontuação estilo Kahoot: 500 base + até 500 pela velocidade
      const ratio = Math.max(0, (game.duration - ans.elapsed) / game.duration);
      p.lastPoints = 500 + Math.round(500 * ratio);
      p.score += p.lastPoints;
    } else {
      p.lastPoints = 0;
    }
  }
  for (const p of Object.values(players)) {
    if (p.lastCorrect === null) { p.lastCorrect = false; p.lastPoints = 0; }
  }
  game.state = 'reveal';
  broadcast();
}

function resetGame(clearScores) {
  clearTimeout(questionTimer);
  game = { state: 'lobby', index: -1, startedAt: 0, duration: 0, answers: {} };
  if (clearScores) {
    for (const p of Object.values(players)) {
      p.score = 0; p.lastPoints = 0; p.lastCorrect = null; p.lastOption = null;
    }
  }
  broadcast();
}

/* --------------------------------- SSE --------------------------------- */
let sseClients = []; // { res, playerId }

function stateFor(client) {
  const q = currentQuestion();
  const base = {
    state: game.state,
    playerCount: Object.keys(players).length,
    questionCount: questions.length
  };
  if (game.state === 'lobby') {
    base.players = rankedPlayers().map(p => p.name);
  }
  if (game.state === 'question' && q) {
    base.question = {
      index: game.index,
      total: questions.length,
      text: q.text,
      options: q.options,
      duration: game.duration,
      remaining: Math.max(0, game.duration - (Date.now() - game.startedAt))
    };
    base.answeredCount = Object.keys(game.answers).length;
  }
  if (game.state === 'reveal' && q) {
    const counts = q.options.map(() => 0);
    for (const a of Object.values(game.answers)) {
      if (counts[a.option] !== undefined) counts[a.option]++;
    }
    base.reveal = {
      index: game.index, total: questions.length,
      text: q.text, options: q.options, correct: q.correct, counts
    };
  }
  if (game.state === 'ranking' || game.state === 'final') {
    base.ranking = rankedPlayers().map((p, i) => ({ pos: i + 1, name: p.name, score: p.score }));
    base.isLast = game.index >= questions.length - 1;
    base.index = game.index;
    base.total = questions.length;
  }
  if (client && client.playerId && players[client.playerId]) {
    const p = players[client.playerId];
    const rank = rankedPlayers().findIndex(r => r.id === client.playerId) + 1;
    base.you = {
      name: p.name, score: p.score, rank,
      answered: game.answers[client.playerId] !== undefined,
      lastPoints: p.lastPoints, lastCorrect: p.lastCorrect, lastOption: p.lastOption
    };
  }
  return base;
}

function broadcast() {
  for (const c of sseClients) {
    try { c.res.write('data: ' + JSON.stringify(stateFor(c)) + '\n\n'); } catch (e) { /* ignora */ }
  }
}
setInterval(() => {
  for (const c of sseClients) { try { c.res.write(': ping\n\n'); } catch (e) { /* ignora */ } }
}, 25000);

/* ------------------------------- Rede/IP ------------------------------- */
function getLanIp() {
  const candidates = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of (list || [])) {
      if (i.family === 'IPv4' && !i.internal) candidates.push(i.address);
    }
  }
  return candidates.find(a => a.startsWith('192.168.')) ||
         candidates.find(a => a.startsWith('10.')) ||
         candidates.find(a => a.startsWith('172.')) ||
         candidates[0] || 'localhost';
}

/* ------------------------------ HTTP utils ----------------------------- */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 1e6) { reject(new Error('corpo muito grande')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};
function serveFile(res, file) {
  const full = path.join(PUBLIC_DIR, file);
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Não encontrado'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

/* ------------------------------- Servidor ------------------------------ */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  try {
    /* Health check (usado pelo Render para saber se o serviço está no ar) */
    if (req.method === 'GET' && (p === '/health' || p === '/healthz')) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('ok');
    }

    /* Páginas */
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return serveFile(res, 'player.html');
    if (req.method === 'GET' && p === '/host') return serveFile(res, 'host.html');
    if (req.method === 'GET' && p === '/admin') return serveFile(res, 'admin.html');
    if (req.method === 'GET' && p.startsWith('/lib/')) return serveFile(res, p.slice(1));

    /* SSE — eventos em tempo real */
    if (req.method === 'GET' && p === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        'Connection': 'keep-alive'
      });
      const client = { res, playerId: url.searchParams.get('playerId') || null };
      sseClients.push(client);
      res.write('data: ' + JSON.stringify(stateFor(client)) + '\n\n');
      req.on('close', () => { sseClients = sseClients.filter(c => c !== client); });
      return;
    }

    /* Info da rede (para o QR Code) — funciona local e na nuvem */
    if (req.method === 'GET' && p === '/api/info') {
      const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
      let host = String(req.headers.host || '');
      // acessado como localhost no próprio PC? mostra o IP da rede para o QR funcionar
      if (!host || host.startsWith('localhost') || host.startsWith('127.')) {
        host = getLanIp() + ':' + activePort;
      }
      const base = proto + '://' + host;
      return sendJson(res, 200, {
        ok: true,
        playerUrl: base + '/',
        hostUrl: base + '/host',
        adminUrl: base + '/admin',
        questionCount: questions.length
      });
    }

    /* Perguntas (admin) */
    if (req.method === 'GET' && p === '/api/questions') {
      return sendJson(res, 200, { ok: true, questions });
    }
    if (req.method === 'POST' && p === '/api/questions') {
      if (String(req.headers['x-pin'] || '') !== ADMIN_PIN) {
        return sendJson(res, 403, { ok: false, pin: true, error: 'PIN incorreto.' });
      }
      if (game.state !== 'lobby' && game.state !== 'final') {
        return sendJson(res, 400, { ok: false, error: 'Jogo em andamento. Volte ao lobby (reiniciar) antes de editar as perguntas.' });
      }
      const body = await readBody(req);
      const list = body.questions;
      const err = validateQuestions(list);
      if (err) return sendJson(res, 400, { ok: false, error: err });
      questions = list;
      saveQuestions();
      broadcast();
      return sendJson(res, 200, { ok: true, count: questions.length });
    }

    /* Entrada de jogador */
    if (req.method === 'POST' && p === '/api/join') {
      const body = await readBody(req);
      let name = String(body.name || '').trim().slice(0, 20);
      if (!name) return sendJson(res, 400, { ok: false, error: 'Digite um nome.' });
      let id = body.playerId && players[body.playerId] ? body.playerId : null;
      // reentrada automática: só reconecta se o jogador ainda existir; não cria um novo
      if (!id && body.rejoinOnly) return sendJson(res, 200, { ok: false, unknown: true });
      if (!id) {
        // nome duplicado ganha um número
        const names = new Set(Object.values(players).map(pl => pl.name.toLowerCase()));
        let finalName = name, n = 2;
        while (names.has(finalName.toLowerCase())) finalName = name + ' ' + (n++);
        id = crypto.randomBytes(8).toString('hex');
        players[id] = { name: finalName, score: 0, lastPoints: 0, lastCorrect: null, lastOption: null };
        name = finalName;
      } else {
        name = players[id].name;
      }
      broadcast();
      return sendJson(res, 200, { ok: true, playerId: id, name });
    }

    /* Resposta do jogador */
    if (req.method === 'POST' && p === '/api/answer') {
      const body = await readBody(req);
      const pid = body.playerId;
      const option = Number(body.option);
      if (!players[pid]) return sendJson(res, 400, { ok: false, error: 'Jogador não encontrado. Entre novamente.' });
      if (game.state !== 'question') return sendJson(res, 400, { ok: false, error: 'Fora do tempo de resposta.' });
      if (game.answers[pid]) return sendJson(res, 200, { ok: true, already: true });
      const q = currentQuestion();
      if (!(option >= 0 && option < q.options.length)) return sendJson(res, 400, { ok: false, error: 'Opção inválida.' });
      const elapsed = Date.now() - game.startedAt;
      if (elapsed > game.duration + GRACE_MS) return sendJson(res, 400, { ok: false, error: 'Tempo esgotado.' });
      game.answers[pid] = { option, elapsed: Math.min(elapsed, game.duration) };
      // todos responderam? encerra antes do tempo
      if (Object.keys(game.answers).length >= Object.keys(players).length) {
        endQuestion();
      } else {
        broadcast();
      }
      return sendJson(res, 200, { ok: true });
    }

    /* Controle do jogo (telão/admin) */
    if (req.method === 'POST' && p === '/api/game') {
      if (String(req.headers['x-pin'] || '') !== ADMIN_PIN) {
        return sendJson(res, 403, { ok: false, pin: true, error: 'PIN incorreto.' });
      }
      const body = await readBody(req);
      const action = body.action;
      if (action === 'start') {
        if (!questions.length) return sendJson(res, 400, { ok: false, error: 'Cadastre perguntas em /admin antes de iniciar.' });
        for (const pl of Object.values(players)) pl.score = 0;
        startQuestion(0);
      } else if (action === 'reveal') {
        endQuestion();
      } else if (action === 'ranking') {
        if (game.state === 'reveal') { game.state = 'ranking'; broadcast(); }
      } else if (action === 'next') {
        if (game.state === 'ranking' || game.state === 'reveal') {
          if (game.index >= questions.length - 1) { game.state = 'final'; broadcast(); }
          else startQuestion(game.index + 1);
        }
      } else if (action === 'reset') {
        resetGame(true);
      } else if (action === 'clearplayers') {
        players = {};
        resetGame(true);
      } else {
        return sendJson(res, 400, { ok: false, error: 'Ação desconhecida.' });
      }
      return sendJson(res, 200, { ok: true, state: game.state });
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
  } catch (e) {
    sendJson(res, 500, { ok: false, error: 'Erro interno: ' + e.message });
  }
});

/* Sobe o servidor; se a porta estiver ocupada, tenta a seguinte automaticamente */
let activePort = PORT;

function startServer(port, tentativas) {
  activePort = port;
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && tentativas > 0) {
      console.log('  Porta ' + port + ' ocupada, tentando a ' + (port + 1) + '...');
      startServer(port + 1, tentativas - 1);
    } else {
      console.error('');
      console.error('  ERRO ao iniciar o servidor: ' + err.message);
      console.error('  Feche outras janelas do Quiz que estejam abertas e tente de novo.');
      process.exit(1);
    }
  });
    server.listen(port, () => {
    const ip = getLanIp();
    console.log('');
    console.log('==============================================');
    console.log('  QUIZ AO VIVO rodando!');
    console.log('');
    console.log('  Telão (projetar):  http://' + ip + ':' + activePort + '/host');
    console.log('  Perguntas (admin): http://' + ip + ':' + activePort + '/admin');
    console.log('  Jogadores:         http://' + ip + ':' + activePort + '/');
    console.log('');
    console.log('  Os celulares devem estar no MESMO Wi-Fi.');
    console.log('  Para parar: feche esta janela ou Ctrl+C.');
    console.log('==============================================');
  });
}

startServer(PORT, 10);
