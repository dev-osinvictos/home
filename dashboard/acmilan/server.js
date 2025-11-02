// ===== ⚽ Tactical Squad Scout 4.2.3 - LiveSync Final =====
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
    origin: ["https://www.osinvictos.com.br"],
    methods: ["GET", "POST"]
  }
});

// === Caminhos absolutos ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Middleware e rotas estáticas ===
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// === Rota padrão ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// === Buffer global de paths (memória volátil) ===
const MAX_STORED_PATHS = 200;
const recentPaths = []; // { id, path, color, ts }

io.on("connection", (socket) => {
  console.log("🔌 Novo cliente conectado:", socket.id);

  // envia paths existentes ao novo cliente
  if (recentPaths.length) socket.emit("existing_paths", recentPaths);

  // --- Movimento dos jogadores ---
  socket.on("player-move", (data) => socket.broadcast.emit("player-move", data));
  socket.on("ball-move", (data) => socket.broadcast.emit("ball-move", data));

  // --- Desenho parcial (em tempo real) ---
  socket.on("path_draw_partial", (payload) => {
    try {
      if (!payload || !Array.isArray(payload.segment) || payload.segment.length < 1) return;
      const segment = payload.segment.slice(-200);
      const out = {
        id: socket.id,
        segment,
        color: payload.color || "#ff3333",
        ts: Date.now(),
        last: !!payload.last,
      };
      socket.broadcast.emit("path_draw_partial", out);
    } catch (e) {
      console.warn("[PATH_DRAW_PARTIAL]", e.message);
    }
  });

  // --- Desenho final (persistente) ---
  socket.on("path_draw", (payload) => {
    try {
      if (!payload || !Array.isArray(payload.path) || payload.path.length < 2) return;
      const item = {
        id: socket.id,
        path: payload.path.slice(0, 1000),
        color: payload.color || "#ff3333",
        ts: Date.now(),
      };
      recentPaths.push(item);
      if (recentPaths.length > MAX_STORED_PATHS) recentPaths.shift();
      socket.broadcast.emit("path_draw", item);
    } catch (e) {
      console.warn("[PATH_DRAW]", e.message);
    }
  });

  // --- Limpeza do campo (canvas clear) ---
  socket.on("path_clear", () => {
    recentPaths.length = 0;
    io.emit("path_clear");
  });

  socket.on("disconnect", () => {
    console.log("❌ Cliente desconectado:", socket.id);
  });
});

// === Inicialização do Servidor ===
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Tactical Squad Scout 4.2.3 - LiveSync rodando na porta ${PORT}`);
});

