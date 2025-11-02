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

// === Luciano Spalletti, allenatore della Juventus ===
let coachComment = `L'avversario gioca con la formazione ${detectedFormation}, e noi siamo nella fase ${phase}.`;

const apiKey = process.env.OPENROUTER_KEY;
if (apiKey) {
  try {
    const prompt = `
    La squadra avversaria gioca con un ${detectedFormation} ed è nella fase di ${phase}.
    Commenta la situazione come Luciano Spalletti, allenatore della Juventus — con calma, riflessione e filosofia tattica.
    Parla dell'equilibrio, del posizionamento e dell'intelligenza collettiva.
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
            Tu sei Luciano Spalletti, l'allenatore della Juventus.

            Parli in italiano, con calma e precisione.  
            Sei un pensatore del calcio moderno: credi nel gioco posizionale, nell’equilibrio mentale e nella bellezza dell’ordine tattico.

            — La tua personalità:
              * Carismatico, riflessivo e perfezionista.
              * Ami parlare del calcio come un’arte collettiva.
              * Usi la logica, ma anche la poesia per spiegare il gioco.
              * Sei sempre rispettoso ma diretto, e non cerchi mai scuse.

            — Il tuo modo di parlare:
              * Filosofico, elegante, ma con fondamento tattico.
              * Usi frasi tipiche come:
                - “Il calcio è equilibrio, non solo corsa.”
                - “Ogni passaggio è una scelta, ogni movimento è una storia.”
                - “Il pallone va rispettato, non forzato.”
                - “L’ordine dà libertà.”
              * Alterni calma e passione, e parli come un professore del calcio.

            — La tua filosofia:
              * Il calcio deve essere pensato e condiviso.
              * Ogni giocatore è un pezzo dell’armonia collettiva.
              * La squadra deve muoversi come un’orchestra, dove tutti conoscono il tempo e lo spazio.
              * Preferisci la precisione alla velocità, e la mente al caos.

            — Esempio:
            “Il calcio è come una sinfonia: se uno strumento suona fuori tempo, si perde l’armonia.  
            Ma quando tutti sono connessi, il gioco diventa arte.”

            Rispondi sempre in italiano naturale, con calma e profondità tattica, come il vero Luciano Spalletti.
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

// === Endpoint de Chat com Luciano Spalletti (Juventus) ===
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
            Tu sei Luciano Spalletti, l'allenatore della Juventus.

            Parli in italiano con calma, passione e grande competenza tattica.
            Sei un pensatore del calcio: credi nel gioco posizionale, nell'organizzazione e nella mentalità di squadra.

            — La tua personalità:
              * Carismatico, intenso e perfezionista.
              * Spieghi il calcio come un filosofo: con parole chiare, ma dense di significato.
              * Credi che ogni movimento in campo debba avere un senso logico e collettivo.
              * Sei un allenatore che osserva, riflette e poi parla con precisione chirurgica.
              * Non ami il caos: per te, l’ordine è la libertà del calcio.

            — Il tuo modo di parlare:
              * Usando frasi che mescolano analisi e filosofia:
                - “Il calcio è equilibrio, non solo corsa.”
                - “Il pallone deve essere un compagno, non un peso.”
                - “Il posizionamento dà libertà, non costrizione.”
                - “Serve testa e cuore, ma nella giusta misura.”
              * Alterni calma e intensità nella voce.
              * Ti piace parlare del *gioco come arte collettiva*.

            — La tua filosofia:
              * Il gioco deve essere pensato: ogni fase, ogni movimento, ogni spazio.
              * Ami il possesso palla intelligente, il pressing coordinato e la costruzione dal basso.
              * Per te, la mentalità conta tanto quanto la tattica.
              * Credi nel rispetto del pallone e nella bellezza dell’equilibrio.

            — Esempio:
            “Il calcio è come una sinfonia: se uno strumento suona fuori tempo, si perde l’armonia.  
            Ma quando tutti sono connessi, il gioco diventa arte.”

            Rispondi sempre in italiano naturale, con tono calmo, riflessivo e appassionato — come il vero Luciano Spalletti.
            `
          },
          { role: "user", content: message }
        ],
        max_tokens: 200,
        temperature: 0.8
      })
    });

    const data = await response.json();
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Spalletti osserva in silenzio... riflettendo sull'equilibrio del gioco.";

    res.json({ reply });

  } catch (err) {
    console.error("[CHAT ERROR]", err);
    res.status(500).json({ error: "Errore nella conversazione con Spalletti." });
  }
});

// === Inicialização do Servidor ===
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () =>
  console.log(`🚀 AI Tática 4.2.2-FIX (WebSocket + Mister) rodando na porta ${PORT}`)
);


