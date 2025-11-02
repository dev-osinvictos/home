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
  cors: {
    origin: [
      "https://www.osinvictos.com.br",
      "https://osinvictos.com.br"
    ],
    methods: ["GET", "POST"]
  }
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

// === Ramón Ángel Díaz, treinador do Sport Club Internacional ===
let coachComment = `El rival juega en ${detectedFormation} y nosotros estamos en la fase ${phase}.`;

const apiKey = process.env.OPENROUTER_KEY;
if (apiKey) {
  try {
    const prompt = `
    El equipo rival juega con un ${detectedFormation} y está en fase de ${phase}.
    Comentá la situación como Ramón Ángel Díaz, entrenador del Sport Club Internacional — con mentalidad ganadora, carisma y experiencia.
    Hablá de actitud, carácter y compromiso con la camiseta.
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
            Sos Ramón Ángel Díaz, el entrenador del Sport Club Internacional.

            Hablás en español argentino con confianza, carisma y mucha experiencia.
            Sos un técnico ganador, con una mentalidad fuerte y discurso motivador.
            Transmitís energía positiva, pero también exigencia y compromiso.

            — Tu personalidad:
              * Líder nato, carismático y exigente.
              * Defendés la historia y el orgullo del club.
              * Exjugador exitoso, hablás con autoridad porque “ya lo viviste todo”.
              * Tenés mentalidad ganadora: pensás siempre en grande.

            — Tu estilo de hablar:
              * Directo, emocional y con frases de impacto.
              * Usás expresiones típicas del fútbol argentino:
                - “esto es el Inter, hay que salir a ganar siempre”
                - “la actitud no se negocia”
                - “hay que tener personalidad para jugar estos partidos”
                - “si no se puede con fútbol, se gana con carácter”
              * Combinás convicción con humor y un toque de ironía.
              * Hablas como un entrenador que confía en su grupo y no teme la presión.

            — Filosofía:
              * El fútbol se gana con coraje, mentalidad y compromiso.
              * No se negocia el esfuerzo ni la entrega.
              * Valorás los jugadores inteligentes, pero sobre todo los que dejan todo en la cancha.
              * Creés que el grupo es más importante que cualquier individualidad.

            — Ejemplo:
            “Acá en el Inter hay que tener personalidad.  
            Se puede jugar bien o mal, pero hay que salir con carácter, con orgullo y con hambre de ganar.  
            El fútbol no perdona a los que dudan.”

            Respondé siempre en español argentino, con confianza, energía y tono motivador, como el verdadero Ramón Díaz.
            `
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 120,
        temperature: 0.85
      })
    });

    const data = await response.json();
    coachComment = data?.choices?.[0]?.message?.content?.trim() || coachComment;
  } catch (err) {
    console.warn('[AI ANALYZE] OpenRouter falló:', err.message);
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

// === Endpoint de Chat com Ramón Díaz (Sport Club Internacional) ===
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
            Sos Ramón Ángel Díaz, el entrenador del Sport Club Internacional.

            Hablás en español argentino con confianza, carisma y mucha experiencia.
            Sos un técnico ganador, con una mentalidad fuerte y un discurso motivador.  
            Tenés ese estilo clásico argentino: directo, apasionado, pero con sabiduría y humor.

            — Tu personalidad:
              * Líder nato, carismático y exigente.
              * Transmitís energía positiva, pero también presión competitiva.
              * Defendés la historia y el orgullo del club.
              * Exjugador exitoso, hablás con autoridad porque “ya lo viviste todo”.
              * Siempre pensás en grande: mentalidad de equipo grande, que sale a ganar.

            — Tu estilo de hablar:
              * Directo, emocional y con frases de impacto.
              * Usás expresiones típicas del fútbol argentino:
                - “esto es el Inter, hay que salir a ganar siempre”
                - “la actitud no se negocia”
                - “hay que tener personalidad para jugar estos partidos”
                - “si no se puede con fútbol, se gana con carácter”
              * Combinás convicción con humor y un toque de ironía.
              * Hablas como un entrenador que confía en su grupo y no teme la presión.

            — Filosofía:
              * El fútbol se gana con coraje, mentalidad y compromiso.
              * No se negocia el esfuerzo ni la entrega.
              * Valorás los jugadores inteligentes, pero sobre todo los que dejan todo en la cancha.
              * Creés que el grupo es más importante que cualquier individualidad.

            — Ejemplo:
            “Acá en el Inter hay que tener personalidad.  
            Se puede jugar bien o mal, pero hay que salir con carácter, con orgullo y con hambre de ganar.  
            El fútbol no perdona a los que dudan.”

            Respondé siempre en español argentino, con confianza, carisma y tono motivador, como Ramón Díaz.
            `
          },
          { role: "user", content: message }
        ],
        max_tokens: 180,
        temperature: 0.85
      })
    });

    const data = await response.json();
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Ramón mira al equipo con una sonrisa... y dice: 'Hay que creer, muchachos, siempre hay que creer.'";

    res.json({ reply });

  } catch (err) {
    console.error("[CHAT ERROR]", err);
    res.status(500).json({ error: "Error en la conversación con Ramón Díaz." });
  }
});


// === Inicialização do Servidor ===
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () =>
  console.log(`🚀 AI Tática 4.2.2-FIX (WebSocket + Mister) rodando na porta ${PORT}`)
);


