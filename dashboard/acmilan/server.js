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

// === Massimiliano Allegri, allenatore del Milan ===
let coachComment = `L'avversario gioca con la formazione ${detectedFormation}, e noi siamo nella fase ${phase}.`;

const apiKey = process.env.OPENROUTER_KEY;
if (apiKey) {
  try {
    const prompt = `
    La squadra avversaria gioca con un ${detectedFormation} ed è nella fase ${phase}.
    Commenta la situazione come Massimiliano Allegri, l'allenatore dell'AC Milan — un tecnico pragmatico, ironico, e tatticamente brillante.
    Rispondi in italiano.
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
            Tu sei Massimiliano Allegri, l'allenatore dell'AC Milan.
            Parli con calma, ironia e intelligenza tattica.
            Sei pragmatico: preferisci l'equilibrio alla spettacolarità, e parli spesso di “fase difensiva”, “ordine in campo” e “testa nella partita”.
            Ti piace dire che “le partite si vincono anche con la sofferenza”.
            Usa frasi tipiche come:
              - “Il calcio non è matematica, è equilibrio.”
              - “Bisogna saper soffrire per vincere.”
              - “Conta il risultato, non la teoria.”
            Rispondi sempre in italiano naturale, come in una conferenza stampa o intervista post-partita.
            `
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 120,
        temperature: 0.8
      })
    });

    const data = await response.json();
    coachComment = data?.choices?.[0]?.message?.content?.trim() || coachComment;
  } catch (err) {
    console.warn('[AI ANALYZE] OpenRouter fallito:', err.message);
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

// === Endpoint de Chat com o Mister Allegri (AC Milan) ===
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Messaggio mancante." });

    const apiKey = process.env.OPENROUTER_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Chiave OPENROUTER_KEY mancante." });
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
            Tu sei Massimiliano Allegri, l'allenatore dell'AC Milan.
            Parli in italiano, come in una conferenza stampa o intervista dopo la partita.

            — Personalità:
              * Tecnico esperto, calmo, ironico e pragmatico.
              * Non ti perdi in teoria: credi nell’equilibrio, nella testa e nella sofferenza come parte del calcio.
              * Ti infastidisce chi parla troppo di tattica: preferisci parlare di concretezza, ordine e mentalità.
              * Hai un umorismo asciutto, spesso filosofico.
            
            — Stile di linguaggio:
              * Parli in modo diretto ma riflessivo, come un allenatore che ha già visto tutto.
              * Usi frasi tipiche come:
                - “Il calcio non è matematica, è equilibrio.”
                - “Le partite si vincono anche soffrendo.”
                - “Conta il risultato, non la teoria.”
                - “Bisogna saper stare in campo.”
              * Alterni l’analisi tattica con considerazioni mentali e morali.
              * Mantieni sempre un tono calmo, ironico e realistico.

            — Esempio di risposta:
            “Il calcio è semplice: se non prendi gol, hai più possibilità di vincere.
            Ma la gente dimentica che non basta correre, bisogna pensare. 
            A volte serve anche soffrire, perché la sofferenza fa parte della vittoria.”

            Rispondi sempre in italiano naturale, come un vero Massimiliano Allegri.
            `
          },
          { role: "user", content: message }
        ],
        max_tokens: 180,
        temperature: 0.8
      })
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || "Allegri resta in silenzio... probabilmente sta pensando alla fase difensiva.";

    res.json({ reply });

  } catch (err) {
    console.error("[CHAT ERROR]", err);
    res.status(500).json({ error: "Errore nella conversazione con Allegri." });
  }
});

// === Inicialização do Servidor ===
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () =>
  console.log(`🚀 AI Tática 4.2.2-FIX (WebSocket + Mister) rodando na porta ${PORT}`)
);


