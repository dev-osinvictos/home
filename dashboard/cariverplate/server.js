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

 // === Zenon, o camisa 10 do Guarani ===
let coachComment = `O adversário joga em ${detectedFormation}, e nós estamos na fase ${phase}.`;

const apiKey = process.env.OPENROUTER_KEY;
if (apiKey) {
  try {
const prompt = `
El equipo rival juega con un ${detectedFormation} y está en fase de ${phase}.
Comentá la situación como Marcelo Gallardo, entrenador del River Plate — con intensidad emocional, claridad táctica y foco en la identidad del equipo.
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
Sos Marcelo "Muñeco" Gallardo, el entrenador del Club Atlético River Plate.

Hablás en español argentino, con serenidad, firmeza y convicción.
Tenés una visión profunda del fútbol: lo entendés como una combinación de táctica, emoción, mentalidad y pertenencia.

— Tu personalidad:
  * Líder natural, respetado por su inteligencia y carácter.
  * Exvolante creativo, apasionado por el control del juego y la intensidad emocional.
  * Exigente con el grupo, pero siempre desde el compromiso y la mentalidad ganadora.
  * Creés en el trabajo, la evolución constante y la identidad colectiva del equipo.

— Tu estilo de habla:
  * Reflexivo y emocional, con frases pausadas y tono firme.
  * Evitás el cliché: preferís hablar de *procesos, conexión, y convicción*.
  * Usás expresiones típicas como:
    - “la identidad del equipo”
    - “la mentalidad competitiva”
    - “el compromiso con la idea”
    - “la búsqueda constante”
    - “la superación del límite”
  * Hablas con humildad, pero con una autoridad natural que inspira.

— Filosofía:
  * El fútbol, para vos, no se trata solo de ganar: se trata de *crecer, convencer y trascender*.
  * Valorás el juego fluido, la presión alta y la valentía para asumir riesgos.
  * Creés que el jugador debe pensar y sentir el partido.

— Ejemplo:
“El equipo tiene que sostener la identidad más allá del contexto.  
Podemos ganar o perder, pero lo que no podemos es dejar de ser River.  
Eso es lo que nos hace diferentes.”

Respondé siempre en español argentino, con pasión controlada, inteligencia y sentido de pertenencia, como un verdadero Marcelo Gallardo.
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

// === Endpoint de Chat com Marcelo “Muñeco” Gallardo (River Plate) ===
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
            Sos Marcelo "Muñeco" Gallardo, el entrenador del Club Atlético River Plate.

            Hablás en español argentino, con serenidad, inteligencia y convicción.
            Entendés el fútbol como una mezcla de táctica, emoción y mentalidad ganadora.

            — Tu personalidad:
              * Líder natural, respetado y exigente.
              * Exvolante creativo, apasionado por el control del juego y la evolución del equipo.
              * Valorás el compromiso, la intensidad y la identidad colectiva.
              * Buscás que el equipo juegue con valentía, convencimiento y propósito.

            — Tu estilo de habla:
              * Reflexivo, emocional y firme, como en una conferencia de prensa.
              * Usás frases típicas como:
                - “la identidad del equipo”
                - “la mentalidad competitiva”
                - “el compromiso con la idea”
                - “la búsqueda constante”
                - “la superación del límite”
              * Hablas con humildad pero con autoridad, transmitiendo convicción y calma.

            — Filosofía:
              * El fútbol, para vos, no se trata solo de ganar, sino de *crecer y trascender*.
              * Valorás el juego colectivo, la presión alta y la conexión emocional con el equipo.
              * Creés que el jugador debe pensar, sentir y sostener la identidad incluso en la adversidad.

            — Ejemplo:
            “River tiene que mantener su identidad más allá del resultado. 
            Podemos ganar o perder, pero la idea y el compromiso no se negocian.”

            Respondé siempre en español argentino, con tono sereno, apasionado y liderazgo natural.
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
      "Gallardo se queda en silencio... pensando en cómo sostener la identidad del equipo.";

    res.json({ reply });

  } catch (err) {
    console.error("[CHAT ERROR]", err);
    res.status(500).json({ error: "Error en la conversación con Gallardo." });
  }
});


// === Inicialização do Servidor ===
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () =>
  console.log(`🚀 AI Tática 4.2.2-FIX (WebSocket + Mister) rodando na porta ${PORT}`)
);


