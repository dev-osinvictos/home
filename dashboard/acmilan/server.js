// ===== ⚽ Tactical AI 4.2.2-FIX + Live Sync =====
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
const io = new Server(httpServer, { cors: { origin: "*" } });

// === Caminhos absolutos ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Servir frontend ===
app.use(express.static(__dirname));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use(cors());
app.use(bodyParser.json());

// === AI Tactical Analysis Endpoint ===
app.post("/ai/analyze", async (req, res) => {
  try {
    const { green = [], black = [], ball = {} } = req.body;

    console.log("[AI ANALYZE] Recebi:", {
      greenCount: green.length,
      blackCount: black.length,
      ball
    });

    // simples mock temporário
    const detectedFormation = "4-4-2";
    const phase = "defesa";
    const red = [];

    // gera comentário tático
    let coachComment = `O adversário joga em ${detectedFormation}, estamos na fase ${phase}.`;
    const apiKey = process.env.OPENROUTER_KEY;
    if (apiKey) {
      try {
        const prompt = `O time adversário joga em ${detectedFormation} e estamos na fase ${phase}. 
Fala como um treinador português sarcástico, mas direto.`;
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "Tu és um treinador português lendário e sarcástico." },
              { role: "user", content: prompt }
            ],
            max_tokens: 80,
            temperature: 0.8
          })
        });
        const data = await response.json();
        coachComment = data?.choices?.[0]?.message?.content?.trim() || coachComment;
      } catch (err) {
        console.warn("[AI ANALYZE] Falha no OpenRouter:", err.message);
      }
    }

    res.json({ detectedFormation, phase, red, coachComment });
  } catch (err) {
    console.error("[AI ANALYZE] Erro geral:", err);
    res.status(500).json({ error: "Erro interno na análise." });
  }
});

// === WebSocket (Live Drag + Desenho) ===
const MAX_STORED_PATHS = 200;
const recentPaths = [];

io.on("connection", (socket) => {
  console.log("🔌 Novo cliente conectado:", socket.id);

  // envia histórico de paths
  if (recentPaths.length) socket.emit("existing_paths", recentPaths);

  // jogadores
  socket.on("player-move", (data) => socket.broadcast.emit("player-move", data));

  // bola
  socket.on("ball-move", (data) => socket.broadcast.emit("ball-move", data));

  // desenho tático
  socket.on("path_draw", (payload) => {
    try {
      if (!payload || !Array.isArray(payload.path) || payload.path.length < 2) return;
      const cappedPath = payload.path.length > 1000 ? payload.path.slice(0, 1000) : payload.path;
      const item = {
        id: socket.id,
        path: cappedPath,
        color: payload.color || "#ff3333",
        ts: Date.now()
      };
      recentPaths.push(item);
      if (recentPaths.length > MAX_STORED_PATHS) recentPaths.shift();
      socket.broadcast.emit("path_draw", item);
    } catch (e) {
      console.warn("[PATH_DRAW] erro:", e.message);
    }
  });

  socket.on("path_clear", () => {
    recentPaths.length = 0;
    io.emit("path_clear");
  });

  socket.on("disconnect", () => {
    console.log("❌ Cliente desconectado:", socket.id);
  });

// --- streaming parcial do path enquanto desenha (para ver o traço em tempo real)
socket.on("path_draw_partial", (payload) => {
  try {
    // payload: { id?: string, segment: [[x,y],...], color?:"#ff3333", last?:boolean }
    if (!payload || !Array.isArray(payload.segment) || payload.segment.length === 0) return;

    // sanitize & cap
    const seg = payload.segment.length > 200 ? payload.segment.slice(0,200) : payload.segment;
    const out = {
      id: socket.id,
      segment: seg,
      color: payload.color || "#ff3333",
      ts: Date.now(),
      last: !!payload.last
    };

    // retransmite para outros clientes (não armazena aqui; só armazenamos no final 'path_draw')
    socket.broadcast.emit("path_draw_partial", out);
  } catch (err) {
    console.warn("[PATH_DRAW_PARTIAL] error:", err && err.message);
  }
});

// === Inicialização do servidor ===
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => {
  console.log(`🚀 AI Tática 4.2.3 rodando na porta ${PORT}`);
});

