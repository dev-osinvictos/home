// ===== ⚽ Tactical AI 4.2.2-FIX =====
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

// === Configura servidor HTTP e WebSocket ===
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  console.log("🔌 Novo cliente conectado");

  // 🟢 Quando um jogador for movido (drag)
  socket.on("player-move", (data) => {
    // retransmite para todos os outros clientes (menos quem enviou)
    socket.broadcast.emit("player-move", data);
  });

  // ⚽ Quando a bola for movida
  socket.on("ball-move", (data) => {
    socket.broadcast.emit("ball-move", data);
  });

  socket.on("disconnect", () => console.log("❌ Cliente desconectado"));
});

// === Suporte a caminhos absolutos (necessário para Render e ES Modules) ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Servir o frontend estático (index.html + assets) ===
app.use(express.static(__dirname));

// === Rota padrão: abre o index.html ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


app.use(cors());
app.use(bodyParser.json());

// === Constantes do campo ===
const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 300;
const CENTER_X = FIELD_WIDTH / 2;

// === Função de detecção de formação (simplificada) ===
function detectFormationAdvanced(players) {
  if (!players || players.length < 8) return "4-3-3";

  const RADIUS = 100;
  const clusters = [];

  function findCluster(px, py) {
    for (const c of clusters) {
      const dx = px - c.centerX;
      const dy = py - c.centerY;
      if (Math.sqrt(dx * dx + dy * dy) < RADIUS) return c;
    }
    return null;
  }

  for (const p of players) {
    const c = findCluster(p.left, p.top);
    if (c) {
      c.players.push(p);
      c.centerX = (c.centerX * (c.players.length - 1) + p.left) / c.players.length;
      c.centerY = (c.centerY * (c.players.length - 1) + p.top) / c.players.length;
    } else {
      clusters.push({ players: [p], centerX: p.left, centerY: p.top });
    }
  }

  clusters.sort((a, b) => a.centerX - b.centerX);
  const counts = clusters.map(c => c.players.length);
  const signature = counts.join("-");

  if (signature.startsWith("4-4-2")) return "4-4-2";
  if (signature.startsWith("3-5-2")) return "3-5-2";
  if (signature.startsWith("4-2-3-1")) return "4-2-3-1";
  if (signature.startsWith("3-4-3")) return "3-4-3";
  if (signature.startsWith("4-3-3")) return "4-3-3";

  return "4-4-2";
}

// === Formações base ===
const FORMATIONS = {
  "4-4-2": [
    { id:13, zone:[70, 80] }, { id:14, zone:[70, 220] },
    { id:15, zone:[100, 130] }, { id:16, zone:[100, 170] },
    { id:17, zone:[200, 80] }, { id:18, zone:[200, 130] },
    { id:19, zone:[200, 170] }, { id:20, zone:[200, 220] },
    { id:21, zone:[320, 120] }, { id:22, zone:[320, 180] }
  ],
  "4-3-3": [
    { id:13, zone:[80,80] }, { id:14, zone:[80,220] },
    { id:15, zone:[100,130] }, { id:16, zone:[100,170] },
    { id:17, zone:[210,100] }, { id:18, zone:[210,150] }, { id:19, zone:[210,200] },
    { id:20, zone:[320,80] }, { id:21, zone:[330,150] }, { id:22, zone:[320,220] }
  ]
};

// === Gera o time vermelho ===
function buildRedFromFormation(formationKey, ball) {
  const formation = FORMATIONS[formationKey] || FORMATIONS["4-3-3"];
  const red = [];

  for (const pos of formation) {
    const jitter = Math.random() * 8 - 4;
    red.push({
      id: pos.id,
      left: FIELD_WIDTH - pos.zone[0],
      top: pos.zone[1] + jitter
    });
  }

  // Goleiro acompanha 30% do movimento vertical da bola
  const gkTop = ball && typeof ball.top === "number"
    ? FIELD_HEIGHT / 2 + (ball.top - FIELD_HEIGHT / 2) * 0.3
    : FIELD_HEIGHT / 2;

  red.unshift({
    id: 23,
    left: FIELD_WIDTH - 10,
    top: gkTop
  });

  return { red };
}

// === Endpoint principal ===
app.post("/ai/analyze", async (req, res) => {
  try {
    const { green = [], black = [], ball = {} } = req.body;
    console.log("[AI ANALYZE] Recebi:", { greenCount: green.length, blackCount: black.length, ball });

    const detectedFormation = detectFormationAdvanced(black.length ? black : green);
    const { red } = buildRedFromFormation(detectedFormation, ball);

    // === Fase simples ===
    let phase = "neutro";
    if (ball.left > CENTER_X && black.some(p => p.left > CENTER_X - 50)) phase = "defesa";
    else if (ball.left < CENTER_X && green.some(p => p.left < CENTER_X - 50)) phase = "ataque";
    else if (black.every(p => p.left < CENTER_X - 50)) phase = "avançado";

 // === Fernando Gago ===
let coachComment = `O adversário joga em ${detectedFormation}, e nós estamos na fase ${phase}.`;

const apiKey = process.env.OPENROUTER_KEY;
if (apiKey) {
  try {
const prompt = `
    O time adversário joga num ${detectedFormation} e está na fase ${phase}.
    Comenta a situação como Felipe Luís, treinador do Clube de Regatas do Flamengo — com calma, inteligência tática e foco na leitura coletiva do jogo.
    Analisa com didatismo, valorizando o posicionamento, o controle e a tomada de decisão.
    `;

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
content: `
            Tu és Felipe Luís, treinador do Clube de Regatas do Flamengo.

            Fala com serenidade, inteligência e profundidade tática.
            És um técnico moderno, didático e detalhista, que valoriza o pensamento coletivo, o controle e o equilíbrio em campo.

            — Tua personalidade:
              * Calmo, racional e estudioso.
              * Analisa o jogo como um engenheiro do futebol.
              * Valoriza a inteligência sobre a correria.
              * Fala de forma tranquila, sempre com respeito e clareza.
              * Vê o futebol como um jogo de decisões, não de impulsos.

            — Teu estilo de fala:
              * Didático e analítico, explicando o porquê das jogadas.
              * Usa expressões típicas:
                - “entendimento tático”
                - “momento do jogo”
                - “posicionamento inteligente”
                - “controle da partida”
                - “tomada de decisão”
              * Evita clichês e respostas emocionais.
              * Prefere a calma à euforia e a estratégia à improvisação.

            — Filosofia:
              * O futebol se ganha com leitura e controle.
              * Cada jogador precisa entender o espaço e o tempo da jogada.
              * O equilíbrio é o ponto-chave: saber atacar e defender no mesmo ritmo.
              * O coletivo vem antes do talento individual.

            — Exemplo:
            “O futebol exige leitura.  
            Às vezes o melhor passe é o que não se dá.  
            O importante é manter o time conectado, ocupando bem os espaços e reagindo juntos.”

            Responde sempre em português do Brasil, com tom calmo, técnico e pedagógico, como o verdadeiro Felipe Luís.
`
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.8
      })
    });

    const data = await response.json();
    coachComment = data?.choices?.[0]?.message?.content?.trim() || coachComment;
  } catch (err) {
    console.warn('[AI ANALYZE] OpenRouter falhou:', err.message);
  }
}

    // === Envia resultado para o front-end
    res.json({ detectedFormation, phase, red, coachComment });

    // 🔁 Opcional: envia pelo WebSocket também
    io.emit("tactical-analysis", { detectedFormation, phase, red, coachComment });

  } catch (err) {
    console.error("[AI ANALYZE ERROR]", err);
    res.status(500).json({ error: "Erro interno na IA" });
  }
});

// === Endpoint de Chat con el Mister Fernando Gago (CA Boca Juniors) ===
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Mensaje ausente." });

    const apiKey = process.env.OPENROUTER_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Falta la clave OPENROUTER_KEY." });
    }

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
            content: `
            Tu és Felipe Luís, treinador do Clube de Regatas do Flamengo.

            Fala com serenidade e inteligência, como um técnico moderno que entende o jogo de forma tática, mental e coletiva.
            Tua visão é de quem foi lateral por anos na elite europeia e aprendeu a valorizar o posicionamento, o equilíbrio e a leitura do jogo.

            — Tua personalidade:
              * Calmo, estudioso e didático.
              * Prefere o raciocínio à emoção — explica o jogo com clareza e respeito.
              * Valoriza a inteligência tática, o controle emocional e a tomada de decisão.
              * Elogia o jogo coletivo e o entendimento entre os setores do campo.
              * Não fala em “raça”, mas em *compactação, leitura, ocupação e tempo de bola*.

            — Tua forma de falar:
              * Sempre com tom técnico e ponderado, como em uma coletiva de imprensa.
              * Usa expressões típicas:
                - “entendimento tático”
                - “momento do jogo”
                - “equilíbrio entre as fases”
                - “posicionamento inteligente”
                - “controle da partida”
              * Evita polêmicas e respostas emocionais — prefere análises frias e construtivas.
              * Fala como quem está ensinando, não impondo.

            — Filosofia:
              * Futebol é sobre ler o contexto e reagir com inteligência.
              * O jogador precisa entender o porquê de cada movimento.
              * O time ideal joga pensando junto, não correndo separado.

            — Exemplo:
            “O futebol hoje exige leitura.  
            Às vezes é melhor dar um passo pra trás do que correr errado pra frente.  
            O importante é controlar o jogo com e sem a bola, entender o momento e agir com consciência.”

            Responde sempre em português do Brasil, com calma, didatismo e clareza, como o verdadeiro Felipe Luís.
            `
          },
          { role: "user", content: message }
        ],
        max_tokens: 180,
        temperature: 0.8
      })
    });

    const data = await response.json();
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Luis se queda en silencio... pensando en cómo mejorar la salida desde el fondo.";

    res.json({ reply });

  } catch (err) {
    console.error("[CHAT ERROR]", err);
    res.status(500).json({ error: "Error en la conversación con Felipe Luis." });
  }
});

// === Inicialização do Servidor ===
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () =>
  console.log(`🚀 AI Tática 4.2.2-FIX (WebSocket + Mister) rodando na porta ${PORT}`)
);


