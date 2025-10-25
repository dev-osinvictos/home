// server.js (v3.1) — OS INVICTOS
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();

// ===== middlewares =====
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(__dirname));

const server = http.createServer(app);

// ===== Socket.IO =====
const io = new Server(server, {
  transports: ["websocket", "polling"],
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
  console.log('🔌 Novo cliente conectado (socket id:', socket.id, ')');

  socket.on('move_circle', (data) => {
    // broadcast raw update to other clients
    socket.broadcast.emit('update_circle', data);
  });

  socket.on('path_draw', (data) => {
    socket.broadcast.emit('path_draw', data);
  });

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectado (socket id:', socket.id, ')');
  });
});

// ===== Tática / util =====
const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 300;
const CENTER_X = FIELD_WIDTH / 2;

function analyzeGreenPositions(green) {
  const valid = (green || []).filter(g => typeof g.left === 'number' && typeof g.top === 'number');
  if (valid.length === 0) return null;

  const xs = valid.map(p => p.left);
  const ys = valid.map(p => p.top);

  const avgX = xs.reduce((s,a) => s+a, 0)/xs.length;
  const avgY = ys.reduce((s,a) => s+a, 0)/ys.length;
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);

  const thirds = { defense:0, middle:0, attack:0 };
  const thirdW = FIELD_WIDTH/3;
  for (const p of valid) {
    if (p.left < thirdW) thirds.defense++;
    else if (p.left < 2*thirdW) thirds.middle++;
    else thirds.attack++;
  }

  return {
    avgX, avgY, spreadX, spreadY, thirds, count: valid.length
  };
}

function detectFormation(stats) {
  if (!stats) return '4-3-3';
  const { spreadY, spreadX, thirds, avgX } = stats;
  if (spreadY < 90 && spreadX < 250) return '3-5-2';
  if (thirds.attack >= 5 || avgX > CENTER_X + 70) return '4-2-3-1';
  if (spreadY > 180 || thirds.middle <= 3) return '4-4-2';
  return '4-3-3';
}

const FORMATIONS = {
  "4-3-3": [
    { id:13, zone:[60,120] },{ id:14, zone:[60,180] },
    { id:15, zone:[120,90] },{ id:16, zone:[120,210] },
    { id:17, zone:[200,100] },{ id:18, zone:[200,150] },{ id:19, zone:[200,200] },
    { id:20, zone:[300,80] },{ id:21, zone:[300,150] },{ id:22, zone:[300,220] }
  ],
  "3-5-2": [
    { id:13, zone:[80,120] },{ id:14, zone:[80,180] },{ id:15, zone:[80,150] },
    { id:16, zone:[160,90] },{ id:17, zone:[160,120] },{ id:18, zone:[160,180] },{ id:19, zone:[160,210] },
    { id:20, zone:[260,120] },{ id:21, zone:[260,180] },{ id:22, zone:[300,150] }
  ],
  "4-4-2": [
    { id:13, zone:[60,120] },{ id:14, zone:[60,180] },
    { id:15, zone:[120,90] },{ id:16, zone:[120,210] },
    { id:17, zone:[200,90] },{ id:18, zone:[200,130] },{ id:19, zone:[200,170] },{ id:20, zone:[200,210] },
    { id:21, zone:[300,130] },{ id:22, zone:[300,170] }
  ],
  "4-2-3-1": [
    { id:13, zone:[60,120] },{ id:14, zone:[60,180] },
    { id:15, zone:[120,90] },{ id:16, zone:[120,210] },
    { id:17, zone:[200,120] },{ id:18, zone:[200,180] },
    { id:19, zone:[240,100] },{ id:20, zone:[240,150] },{ id:21, zone:[240,200] },
    { id:22, zone:[300,150] }
  ]
};

// --- use este buildRedFromFormation para fixar goleiro no gol direito ---
const FIELD_LEFT = 20; // offset do campo na página (se o seu css usa left:20px para o gramado)

function buildRedFromFormation(formationKey, stats, ball, green) {
  const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
  const red = [];

  // centroid of green (em coordenadas já absolutas recebidas)
  let centroidX = CENTER_X, centroidY = FIELD_HEIGHT/2;
  const valid = (green || []).filter(g => typeof g.left === 'number' && typeof g.top === 'number');
  if (valid.length > 0) {
    // se os dados green vieram em coordenadas de página (ex: 25..620), converte para coord relativas ao campo:
    // assumimos FIELD_LEFT offset; se green estiverem já relativas ao campo, isso ainda funciona.
    const xs = valid.map(p => p.left - FIELD_LEFT);
    const ys = valid.map(p => p.top - (isNaN(valid[0].top) ? 0 : 20)); // top offset se necessário (mantém cerca)
    const avgRelX = Math.round(xs.reduce((s,p)=>s+p,0)/xs.length);
    const avgRelY = Math.round(valid.reduce((s,p)=>s+p.top,0)/valid.length);
    centroidX = avgRelX;
    centroidY = Math.round(avgRelY);
  }

  // fase: **invertida** conforme teu pedido anterior (ataque da direita->esquerda)
  const phase = ball && typeof ball.left === 'number' ? ( (ball.left - FIELD_LEFT) > CENTER_X ? 'defesa' : 'ataque') : 'neutro';
  const push = phase === 'ataque' ? 30 : (phase === 'defesa' ? -20 : 0);

  for (const pos of formation) {
    const lateralShift = Math.max(-25, Math.min(25, Math.round((centroidY - FIELD_HEIGHT/2)/6)));
    const forwardShift = push + Math.round((centroidX - CENTER_X) / 12);

    // espelhamos a formação para o lado direito (o seu time ataca da direita para a esquerda)
    let relX = FIELD_WIDTH - pos.zone[0] + forwardShift - 30; // coordenada relativa ao campo (0..FIELD_WIDTH)
    let relY = pos.zone[1] + lateralShift + (Math.random()*12 - 6);

    // clamp
    relX = Math.max(20, Math.min(FIELD_WIDTH - 30, Math.round(relX)));
    relY = Math.max(20, Math.min(FIELD_HEIGHT - 20, Math.round(relY)));

    // converte para coordenadas absolutas na página
    const absX = FIELD_LEFT + relX;
    const absY = Math.round(relY + 20); // adiciona offset top do campo (20px) — geralmente a margem top do gramado
    red.push({ id: pos.id, left: absX, top: absY });
  }

  // goleiro: coloca no gol direito (abs)
  const GK_MARGIN = 20;
  const gkTop = (ball && typeof ball.top === 'number')
    ? Math.max(30, Math.min(FIELD_HEIGHT - 40, Math.round(ball.top - 20))) // ajusta top se bola vertical
    : Math.round(FIELD_HEIGHT/2);

  const gkAbsLeft = FIELD_LEFT + FIELD_WIDTH - GK_MARGIN; // ex: 20 + 600 - 20 = 600
  const gkAbsTop = Math.max(30, Math.min(FIELD_HEIGHT - 40, gkTop + 20)); // +20 para ajustar offset da página

  // garante que id 23 não colida com outro (sempre enviado primeiro)
  red.unshift({ id: 23, left: gkAbsLeft, top: gkAbsTop });

  return { red, phase };
}


// ===== Endpoint /ai/analyze =====
app.post('/ai/analyze', async (req, res) => {
  try {
    const body = req.body || {};
    // Expect green as array of {id,left,top} and ball as {left,top}
    const green = Array.isArray(body.green) ? body.green : [];
    const ball = body.ball || {};

    console.log('[AI ANALYZE] recebi:', { greenCount: green.length, ball });

    const stats = analyzeGreenPositions(green);
    const detectedFormation = detectFormation(stats);
    const { red, phase } = buildRedFromFormation(detectedFormation, stats, ball, green);

    // coach comment via OpenRouter if available
    let coachComment = 'Mudança tática efetuada.';
    const apiKey = process.env.OPENROUTER_KEY;

    if (apiKey) {
      try {
        const prompt = `A equipe adversária está jogando num ${detectedFormation}. A nossa equipa está na fase ${phase}. Em 1-2 frases, comenta a mudança tática como um treinador português sarcástico e direto.`;
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "Tu és um treinador português lendário, sarcástico, confiante e direto. Comenta decisões táticas em poucas frases." },
              { role: "user", content: prompt }
            ],
            max_tokens: 80,
            temperature: 0.8
          }),
          timeout: 8000
        });

        const data = await response.json();
        const remote = data?.choices?.[0]?.message?.content?.trim();
        if (remote && remote.length > 0) coachComment = remote;
        else console.warn('[AI ANALYZE] OpenRouter devolveu vazio, usando fallback.');
      } catch (err) {
        console.warn('[AI ANALYZE] erro OpenRouter:', err && err.message ? err.message : err);
      }
    }

    // local fallback if needed
    if (!coachComment || coachComment === 'Mudança tática efetuada.') {
      const phrases = [];
      if (detectedFormation === '3-5-2') phrases.push('Fechamos o meio: controlo e presença por dentro.');
      if (detectedFormation === '4-3-3') phrases.push('Subimos os extremos — pressão nas laterais.');
      if (detectedFormation === '4-4-2') phrases.push('Alinhamos duas linhas e vamos correr para cima.');
      if (detectedFormation === '4-2-3-1') phrases.push('Protegemos o meio e damos jogo ao 10.');
      if (phrases.length === 0) phrases.push('Organiza-te: compactamos e vamos pressionar.');

      const phaseComment = phase === 'ataque' ? 'Pressão alta — corta linhas.' : (phase === 'defesa' ? 'Recuamos e fechamos espaços.' : '');
      coachComment = `${phrases[0]} ${phaseComment}`.trim();
    }

    res.json({ red, coachComment, detectedFormation });
  } catch (err) {
    console.error('[AI ANALYZE] erro interno:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Erro interno na análise tática.' });
  }
});

// ===== Chat endpoint (manual) =====
app.post('/api/chat', async (req, res) => {
  const message = req.body?.message || '';
  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) {
    const simpleReply = `Treinador (local): "${message}" — Joga simples: passe curto e movimento.`;
    return res.json({ reply: simpleReply });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Tu és um treinador português lendário, sarcástico, confiante e direto." },
          { role: "user", content: message }
        ],
        max_tokens: 200,
        temperature: 0.9
      }),
      timeout: 10000
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "O mister não tem tempo pra conversa fiada.";
    res.json({ reply });
  } catch (err) {
    console.error('[API CHAT] erro OpenRouter:', err && err.message ? err.message : err);
    res.json({ reply: "O mister não respondeu... falha na ligação ao provider." });
  }
});

// ===== Start server =====
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🏟️  Servidor rodando na porta ${PORT} — IA Tática v3.1 ativa`);
});

