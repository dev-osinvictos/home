// ==========================
//  OS INVICTOS SERVER ⚽
//  Integra campo tático + AI + Chat do "Treinador Português"
// ==========================

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();

// ======= ⚙️ CORS GLOBAL =======
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // ✅ Permite tudo
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

const server = http.createServer(app);

// ======= ⚽ Socket.IO =======
const io = new Server(server, {
  transports: ["websocket", "polling"], // força compatibilidade com Render
  cors: {
    origin: "*", // ✅ libera todos os domínios
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('🔌 Novo cliente conectado');

  socket.on('move_circle', (data) => {
    socket.broadcast.emit('update_circle', data);
  });

  socket.on('path_draw', (data) => {
    socket.broadcast.emit('path_draw', data);
  });

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectado');
  });
});

// ======= 🤖 AI Análise =======
app.post('/ai/analyze', (req, res) => {
  const { ball, green } = req.body;
  const red = [];

  for (let i = 0; i < 10; i++) {
    const g = green[i];
    if (g) {
      red.push({
        id: 13 + i,
        left: 600 - g.left,
        top: g.top
      });
    }
  }

  red[8] = {
    id: 21,
    left: ball.left - 9,
    top: ball.top
  };

  res.json({ red });
});

// ======= 🧠 Chat (OpenRouter) =======
app.post('/api/chat', async (req, res) => {
  const message = req.body.message;
  const apiKey = process.env.OPENROUTER_KEY;

  if (!apiKey) {
    return res.status(500).json({ reply: "Erro interno: OPENROUTER_KEY não configurada." });
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
          {
            role: "system",
            content:
              "Tu és um treinador português lendário, sarcástico, confiante e direto. Foste campeão no Porto, Chelsea, Inter, Real Madrid e Manchester United. Fala com autoridade, ironia e sempre como se fosses o centro das atenções."
          },
          { role: "user", content: message }
        ],
        max_tokens: 200,
        temperature: 0.9
      }),
    });

    const data = await response.json();
    const reply =
      data.choices?.[0]?.message?.content?.trim() ||
      "O mister não tem tempo pra conversa fiada.";
    res.json({ reply });
  } catch (err) {
    console.error("Erro no OpenRouter:", err);
    res.json({ reply: "O mister não respondeu... deve estar irritado com o árbitro." });
  }
});

// ======= 🚀 Start =======
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🏟️  Servidor rodando na porta ${PORT}`);
});

