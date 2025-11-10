// server.js — AI Tática v13 (Render + Realtime WebSocket)
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      "https://www.osinvictos.com.br",
      "https://osinvictos.com.br",
      "https://guaranifc.onrender.com",
      "localhost:10000",
      "*"
    ],
    methods: ["GET", "POST"]
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// === Configuração de diretórios ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Middleware ===
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// === Serve o frontend ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// === Constantes ===
const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 300;

const FORMATIONS = {
  // =========================
  // 4-4-2
  // =========================
"4-4-2": [
  // ====== DEFESA (4) ======
  // Lateral direito
  { id: 13, role: "lateral direito", prefferedZone:[500,  60] },

  // Zagueiro direito
  { id: 14,  role: "zagueiro central", prefferedZone:[500, 120] },

  // Zagueiro esquerdo
  { id: 15, role: "quarto zagueiro", prefferedZone:[500, 180] },

  // Lateral esquerdo
  { id: 18, role: "lateral esquerdo", prefferedZone:[500, 240] },

  // ====== MEIO CAMPO (4) ======
  // Meia direita (ponta / corredor)
  { id: 20, role: "meia direita", prefferedZone:[380,  90] },

  // Volante direito / meia central
  { id: 16, role: "volante direito", prefferedZone:[410, 150] },

  // Volante esquerdo / meia central
  { id: 17, role: "volante esquerdo", prefferedZone:[380, 150] },

  // Meia esquerda (ponta)
  { id: 21, role: "meia esquerda", prefferedZone:[380, 210] },

  // ====== ATAQUE (2) ======
  // Segundo atacante (mais móvel, flutua)
  { id: 19, role: "segundo atacante", prefferedZone:[300, 120] },

  // Centroavante (referência)
  { id: 22, role: "centroavante", prefferedZone:[270, 180] }
],

// =========================
// 4-1-4-1
// =========================
"4-1-4-1": [

  // ====== DEFESA (4) ======
  // Lateral direito
  { id: 13, role: "lateral direito", prefferedZone:[500,  60] },

  // Zagueiro direito
  { id: 14, role: "zagueiro direito", prefferedZone:[500, 120] },

  // Zagueiro esquerdo
  { id: 15, role: "zagueiro esquerdo", prefferedZone:[500, 180] },

  // Lateral esquerdo
  { id: 18, role: "lateral esquerdo", prefferedZone:[500, 240] },


  // ====== VOLANTE FIXO (1) ======
  // Primeiro volante — protege a defesa
  { id: 16, role: "primeiro volante", prefferedZone:[430, 150] },


  // ====== MEIO CAMPO (4) ======
  // Meia direita (ponta / corredor)
  { id: 20, role: "meia direita", prefferedZone:[360,  90] },

  // Meia central (camisa 10 / construção)
  { id: 19, role: "meia central", prefferedZone:[360, 150] },

  // Meia interior (equilíbrio / apoio ao volante)
  { id: 17, role: "meia interior", prefferedZone:[360, 190] },

  // Meia esquerda (ponta / amplitude)
  { id: 21, role: "meia esquerda", prefferedZone:[360, 240] },


  // ====== ATAQUE (1) ======
  // Centroavante (referência / pivô)
  { id: 22, role: "centroavante", prefferedZone:[270, 150] }
],

  // =========================
  // 4-3-3
  // =========================
"4-3-3": [
  // ====== DEFESA (4) ======
  // Lateral direito
  { id: 13, role: "lateral direito", prefferedZone:[500,  60] },

  // Zagueiro direito
  { id: 14, role: "zagueiro direito", prefferedZone:[500, 120] },

  // Zagueiro esquerdo
  { id: 15, role: "zagueiro esquerdo", prefferedZone:[500, 180] },

  // Lateral esquerdo
  { id: 18, role: "lateral esquerdo", prefferedZone:[500, 240] },

  // ====== MEIO CAMPO (3) ======
  // 1º volante — central, equilibra a saída
  { id: 16, role: "primeiro volante", prefferedZone:[430, 150] },

  // Meia interior direita — apoia construção
  { id: 20, role: "meia interior direita", prefferedZone:[390, 110] },

  // Meia interior esquerda — conecta com o ataque
  { id: 17, role: "meia interior esquerda", prefferedZone:[390, 190] },

  // ====== ATAQUE (3) ======
  // Ponta direita (velocidade / profundidade)
  { id: 19, role: "ponta direita", prefferedZone:[300,  80] },

  // Centroavante (referência)
  { id: 22, role: "centroavante", prefferedZone:[270, 150] },

  // Ponta esquerda (diagonal para dentro)
  { id: 21, role: "ponta esquerda", prefferedZone:[300, 220] }
]
,

  // =========================
  // 4-2-3-1
  // =========================
"4-2-3-1": [
  // ====== DEFESA (4) ======
  // Lateral direito
  { id: 13, role: "lateral direito", prefferedZone:[500,  60] },

  // Zagueiro direito
  { id: 14, role: "zagueiro direito", prefferedZone:[500, 120] },

  // Zagueiro esquerdo
  { id: 15, role: "zagueiro esquerdo", prefferedZone:[500, 180] },

  // Lateral esquerdo
  { id: 18, role: "lateral esquerdo", prefferedZone:[500, 240] },

  // ====== VOLANTES (2) ======
  // 1º volante — protege a zaga
  { id: 16, role: "primeiroo volante", prefferedZone:[430, 150] },

  // 2º volante — transição e condução
  { id: 17, role: "segundo volante", prefferedZone:[400, 150] },

  // ====== MEIAS (3) ======
  // Meia direita (ponta / corredor)
  { id: 20, role: "meia direita", prefferedZone:[330,  90] },

  // Meia central (camisa 10 — entrelinhas)
  { id: 19, role: "meia central", prefferedZone:[330, 150] },

  // Meia esquerda (ponta esquerda)
  { id: 21, role: "meia esquerda", prefferedZone:[330, 210] },

  // ====== ATAQUE (1) ======
  // Centroavante isolado (referência)
  { id: 22, role: "centroavante isolado", prefferedZone:[260, 150] }
],

"4-2-4": [
  // ====== DEFESA (4) ======
  // Lateral direito
  { id: 13, role: "lateral direito", prefferedZone:[500,  60] },

  // Zagueiro direito
  { id: 14, role: "zagueiro direito", prefferedZone:[500, 120] },

  // Zagueiro esquerdo
  { id: 15, role: "zagueiro esquerdo", prefferedZone:[500, 180] },

  // Lateral esquerdo
  { id: 18, role: "lateral esquerdo", prefferedZone:[500, 240] },

  // ====== VOLANTES (2) ======
  // Volante defensivo — protege a zaga
  { id: 16, role: "volante defensivo", prefferedZone:[420, 140] },

  // Volante construtor — faz saída e ligação
  { id: 17, role: "volante construtor", prefferedZone:[420, 180] },

  // ====== ATAQUE (4) ======
  // Extremo direito
  { id: 20, role: "extremo direito", prefferedZone:[300,  80] },

  // Segundo atacante — meia-atacante / falso 9
  { id: 19, role: "segundo atacante", prefferedZone:[300, 130] },

  // Centroavante (referência)
  { id: 22, role: "centroavante", prefferedZone:[270, 170] },

  // Extremo esquerdo
  { id: 21, role: "extremo esquerdo", prefferedZone:[300, 220] }
],

  // =========================
  // 3-5-2
  // =========================
"3-5-2": [
  // ====== DEFESA — 3 ZAGUEIROS ======
  // Zagueiro direito
  { id: 13, role: "zagueiro direito", prefferedZone:[500, 100] },

  // Zagueiro central
  { id: 14, role: "zagueiro central", prefferedZone:[500, 150] },

  // Zagueiro esquerdo
  { id: 15, role: "zagueiro esquerdo", prefferedZone:[500, 200] },

  // ====== MEIO CAMPO — 5 JOGADORES ======
  // Ala direita (camisa 7 ou 2 dependendo do modelo)
  { id: 20, role: "ala direita", prefferedZone:[400,  70] },

  // Volante (1º volante — proteção da zaga)
  { id: 16, role: "primeiro volante", prefferedZone:[420, 150] },

  // Meia central (camisa 10 — criação)
  { id: 19, role: "meia central", prefferedZone:[380, 150] },

  // Volante interno (2º volante — equilíbrio)
  { id: 17, role: "segundo volante", prefferedZone:[420, 200] },

  // Ala esquerda
  { id: 18, role: "ala esquerda", prefferedZone:[400, 230] },

  // ====== ATAQUE — DUPLA DE FRENTE ======
  // 2º atacante (mais móvel)
  { id: 21, role: "segundo atacante", prefferedZone:[300, 130] },

  // Centroavante (referência)
  { id: 22, role: "centroavante", prefferedZone:[260, 170] }
]
,

  // =========================
  // 5-4-1
  // =========================
"5-4-1": [
  // ====== DEFESA — LINHA DE 5 ======
  // Ala / Lateral direito (camisa 2)
  { id: 13, role: "ala lateral direito", prefferedZone:[500,  60] },

  // Zagueiro direito (camisa 3)
  { id: 14, role: "zagueiro direito", prefferedZone:[500, 120] },

  // Zagueiro central (camisa 4)
  { id: 15, role: "zagueiro central", prefferedZone:[500, 150] },

  // Zagueiro esquerdo (camisa 5 / volante recuado)
  { id: 16, role: "zagueiro esquerdo", prefferedZone:[500, 180] },

  // Ala / Lateral esquerdo (camisa 6 ou 8)
  { id: 17, role: "lateral esquerdo", prefferedZone:[500, 240] },

  // ====== MEIO CAMPO — LINHA DE 4 ======
  // Meia direita (ponta / corredor)
  { id: 20, role: "meia direita", prefferedZone:[370,  90] },

  // Volante interior (camisa 10)
  { id: 19, role: "volante interior", prefferedZone:[370, 140] },

  // Volante interior (camisa 8)
  { id: 21, role: "Volante interior", prefferedZone:[370, 190] },

  // Meia esquerda (ponta)
  { id: 18, role: "meia esquerda", prefferedZone:[370, 240] },

  // ====== ATAQUE — 1 ISOLADO ======
  // Centroavante (camisa 9)
  { id: 22, role: "centroavante", prefferedZone:[250, 150] }
],

"4-5-1": [
  // ====== DEFESA (4) ======
  // Lateral direito (camisa 2)
  { id: 13, role: "lateral direito", prefferedZone:[480,  60] },

  // Zagueiro direito (camisa 3)
  { id: 14, role: "zagueiro direito", prefferedZone:[480, 120] },

  // Zagueiro esquerdo (camisa 4)
  { id: 15, role: "zagueiro esquerdo", prefferedZone:[480, 180] },

  // Lateral esquerdo (camisa 6 / ala esquerda)
  { id: 18, role: "lateral esquerdo", prefferedZone:[480, 240] },

  // ====== MEIO CAMPO (5) ======
  // 1º volante (camisa 5) — protege a defesa
  { id: 16, role: "primeiro volante", prefferedZone:[420, 150] },

  // 2º volante (camisa 8) — transição e cobertura
  { id: 17, role: "segundo volante", prefferedZone:[390, 150] },

  // Meia direita (ponta / corredor)
  { id: 20, role: "meia direita", prefferedZone:[330,  90] },

  // Meia central (camisa 10 — armador)
  { id: 19, role: "meia central", prefferedZone:[330, 150] },

  // Meia esquerda (ponta esquerda / corredor)
  { id: 21, role: "meia esquerda", prefferedZone:[330, 210] },

  // ====== ATAQUE (1) ======
  // Centroavante (referência)
  { id: 22, role: "lateral direito", prefferedZone:[260, 150] }
],

"3-4-3": [
  // ====== DEFESA — 3 ZAGUEIROS ======
  // Zagueiro direito
  { id: 14, role: "zagueiro direito", prefferedZone:[520, 110] },

  // Zagueiro central
  { id: 15, role: "zegueiro central", prefferedZone:[520, 150] },

  // Zagueiro esquerdo
  { id: 16, role: "zagueiro esquerdo", prefferedZone:[520, 190] },

  // ====== MEIO — 4 (2 alas + 2 meias) ======
  // Ala direito (profundidade e amplitude)
  { id: 13, role: "ala direito", prefferedZone:[440,  70] },

  // Meia interior direita
  { id: 17, role: "meia interior direita", prefferedZone:[430, 130] },

  // Meia interior esquerda (camisa 10 / criação)
  { id: 19, role: "meia interior esquerda", prefferedZone:[430, 170] },

  // Ala esquerdo (profundidade e amplitude)
  { id: 18, role: "ala esquerdo", prefferedZone:[440, 230] },

  // ====== ATAQUE — TRIO ======
  // Extremo direito (ponta)
  { id: 20, role: "extremo direito", prefferedZone:[310,  90] },

  // Centroavante (referência)
  { id: 22, role: "centroavante", prefferedZone:[270, 150] },

  // Extremo esquerdo (ponta)
  { id: 21, role: "extremo esquerdo", prefferedZone:[310, 210] }
],

  // =========================
  // 5-3-2
  // =========================
"5-3-2": [
  // ====== DEFESA — LINHA DE 5 ======
  // Ala / Lateral direito
  { id: 13, role: "lateral direito", prefferedZone:[520,  70] },

  // Zagueiro direito
  { id: 14, role: "zagueiro direito", prefferedZone:[520, 120] },

  // Zagueiro central
  { id: 15, role: "zagueiro central", prefferedZone:[520, 150] },

  // Zagueiro esquerdo
  { id: 16, role: "zagueiro esquerdo", prefferedZone:[520, 180] },

  // Ala / Lateral esquerdo
  { id: 17, role: "lateral esquerdo", prefferedZone:[520, 230] },

  // ====== MEIO — TRIO CENTRAL ======
  // Meia interior direita
  { id: 20, role: "meia interior direita", prefferedZone:[400, 120] },

  // Meia central (camisa 10 — cria)
  { id: 19, role: "meia central", prefferedZone:[400, 150] },

  // Meia interior esquerda
  { id: 18, role: "meia interior esquerda", prefferedZone:[400, 180] },

  // ====== ATAQUE — DUPLA ======
  // Segundo atacante (movimenta, tabela)
  { id: 21, role: "segundo atacante", prefferedZone:[300, 130] },

  // Centroavante (referência)
  { id: 22, role: "centroavante", prefferedZone:[260, 170] }
]
};


// === IA: Detector geométrico FIFA 2D ===
function detectOpponentFormationAdvanced(players) {
  if (!players || players.length < 8) return "4-4-2";

  const sortedByX = [...players].sort((a,b) => a.left - b.left);
  const noGK = sortedByX.slice(1); // drop leftmost

 const sorted = [...noGK].sort((a, b) => a.top - b.top);
  const lines = [];
  for (const p of sorted) {
    let line = lines.find(l => Math.abs(l.centerY - p.top) <= 50); // tolerância ligeiramente maior
    if (line) {
      line.players.push(p);
      line.centerY = (line.centerY * (line.players.length - 1) + p.top) / line.players.length;
    } else {
      lines.push({ players: [p], centerY: p.top });
    }
  }

  lines.sort((a, b) => a.centerY - b.centerY);
  const counts = lines.map(l => l.players.length);
  const signature = counts.join("-");

  // Mapeia assinaturas comuns (sem GK)
  if (["4-4-2","4-3-3","4-2-3-1","4-2-4","3-5-2","5-4-1","4-5-1","3-4-3", "5-3-2", "4-1-4-1"].includes(signature)) return signature;

  // Fallback por terços (sem GK) — menos enviesado
  const FIELD_THIRD = 600 / 3; // mantém coerente com seu FIELD_WIDTH
  const def = noGK.filter(p => p.left < FIELD_THIRD).length;
  const mid = noGK.filter(p => p.left >= FIELD_THIRD && p.left < FIELD_THIRD * 2).length;
  const att = noGK.filter(p => p.left >= FIELD_THIRD * 2).length;
  const shape = `${def}-${mid}-${att}`;

  if (def >= 5 && att <= 1) return "5-4-1";
  if (def === 4 && mid === 4 && att === 2) return "4-4-2";
  if (def === 4 && mid === 3 && att === 3) return "4-3-3";
  if (def === 4 && mid === 2 && att === 4) return "4-2-4";
  if (def === 3 && mid === 5 && att === 2) return "3-5-2";
  if (def === 4 && mid === 5 && att === 1) return "4-2-3-1";
  if (def === 5 && mid === 3 && att === 2) return "5-3-2";
  if (def === 4 && mid === 2 && att === 4) return "4-2-4";
  if (def === 3 && mid === 4 && att === 3) return "3-4-3";
  if (def === 5 && mid === 3 && att === 2) return "5-3-2";
  if (def === 4 && mid === 5 && att === 1) return "4-5-1";
  if (def === 5 && mid === 4 && att === 1) return "4-1-4-1";

  // Último fallback neutro (melhor que fixar 4-4-2)
  return "4-2-3-1";
}

// === Fase / Bloco / Compactação ===
function detectPhase(possession, opponentFormation) {

  // Quando a posse é do Guarani (verde), fase é ataque por padrão
  if (possession === "verde") {
    return { phase: "Ataque", bloco: "Alto", compactacao: "Larga" };
  }

  // ✅ Formações defensivas (bloco baixo, retranca)
  const blocoBaixo = ["5-4-1", "5-3-2", "4-5-1", "4-1-4-1"];
  
  // ✅ Formações equilibradas (bloco médio)
  const blocoMedio = ["4-4-2", "4-3-3", "3-5-2", "3-4-3"];
  
  // ✅ Formações ofensivas (linha alta, amplitude para contra-ataque)
  const blocoAlto = ["4-2-3-1", "4-2-4"];

  if (blocoBaixo.includes(opponentFormation)) {
    return { phase: "Defesa", bloco: "Baixo", compactacao: "Curta" };
  }

  if (blocoMedio.includes(opponentFormation)) {
    return { phase: "Transição", bloco: "Médio", compactacao: "Média" };
  }

  if (blocoAlto.includes(opponentFormation)) {
    return { phase: "Ataque", bloco: "Alto", compactacao: "Larga" };
  }

  // fallback padrão
  return { phase: "Defesa", bloco: "Baixo", compactacao: "Curta" };
}


// === Contra-formação — Filosofia Carlos Alberto Silva ===
function chooseCounterFormation(opponentFormation, possession) {
  
  // Quando Guarani tem a bola → monta postura ofensiva organizada
  if (possession === "verde") {
    switch (opponentFormation) {

      case "5-4-1":
      case "5-3-2":
        // Retranca forte: precisamos de meia central conectando e amplitude
        return "4-2-3-1"; // construção paciente para infiltrar

      case "4-4-2":
        // Linha horizontal rígida → atacar half-spaces
        return "4-3-3";   // amplitude + extremos atacando profundidade

      case "4-3-3":
        // Espelho sem perder meio → cortar triangulação deles
        return "4-2-3-1";

      case "4-2-4":
        // Eles tiram meio → ganho numérico no meio
        return "4-1-4-1"; // controle total de meio de campo

      case "4-1-4-1":
        // Um volante só protegendo → atrair e infiltrar por dentro
        return "4-2-3-1"; // superioridade entrelinhas com camisa 10

      case "3-5-2":
        // 3 zagueiros: abrir campo
        return "4-3-3";  // amplitude máxima

      case "3-4-3":
        // Alas altos, espaço nas costas
        return "4-2-4";  // dois na última linha para atacar profundidade

      default:
        return "4-3-3";
    }
  }

  // Quando o Guarani está sem a bola → prioridade é equilíbrio e disciplina
  else {
    switch (opponentFormation) {

      case "4-3-3":
        // eles têm superioridade no meio → fechar corredor central
        return "4-5-1"; // marcação por zona com compactação curta

      case "4-2-3-1":
        // neutralizar meia central deles (camisa 10)
        return "4-4-2"; // 2 encaixes no volante/meia

      case "4-1-4-1":
        // volante deles constrói → tiramos linha de passe
        return "4-3-3"; // encaixe no volante e extremos fecham corredor

      case "4-4-2":
        // Espelho defensivo com disciplina
        return "4-4-2";

      case "3-5-2":
        // 2 atacantes deles → sempre sobra 1 nosso
        return "5-4-1"; // fecha com três zagueiros e alas baixos

      case "3-4-3":
        // alas altos, perigoso → proteger amplitude
        return "5-3-2"; // alas voltam, fecha corredor

      case "4-2-4":
        // eles sacrificam meio campo → transição mata
        return "4-1-4-1"; // volante controla transição

      default:
        return "4-4-2";
    }
  }
}


// === Monta o Verde (direita → esquerda) ===// === Monta o Verde (direita → esquerda) ===
// Inteligência posicional baseada em:
// - formação
// - fase (ataque/defesa)
// - posição da bola (através de "ball.left / ball.top")
// - Filosofia Carlos Alberto Silva (organização + superioridade no setor da bola)

function buildGreenFromFormation(formationKey, ball, phase = "defesa") {
  const formation = FORMATIONS[formationKey] || FORMATIONS["4-3-3"];
  const greenAI = [];

  const BALL_X = ball?.left ?? FIELD_WIDTH / 2;
  const BALL_Y = ball?.top ?? FIELD_HEIGHT / 2;

  let offsetX = 0;
  let compactY = 0;

  // Offset horizontal por formação (linha mais alta ou mais baixa)
  const offsetRules = {
    "4-1-4-1": 30,
    "4-2-3-1": 20,
    "4-4-2": 10,
    "4-3-3": 10,
    "3-5-2": 60,
    "4-2-4": 100,
    "5-4-1": 40,
    "5-3-2": 45,
    "3-4-3": 65
  };

  offsetX = offsetRules[formationKey] || 10;

  // Compactação vertical dependente da fase
  compactY = phase === "defesa" ? 40 : 0;

  for (const pos of formation) {
    const jitter = Math.random() * 4 - 2;

    // === Ajuste posicional no eixo X (compacta ou expande conforme fase)
    let baseX = phase === "ataque"
      ? pos.prefferedZone[0] - offsetX
      : pos.prefferedZone[0] + offsetX;

    // === Inteligência posicional: move o jogador na direção da bola
    const influence = formationKey === "4-1-4-1" && pos.id === 16
      ? 0.40 // volante da saída 3+1 se aproxima mais
      : 0.25 // os demais se movem menos

    baseX = baseX * (1 - influence) + BALL_X * influence;

    // === Compactação vertical (setor da bola)
    const baseY = pos.prefferedZone[1] + (BALL_Y - pos.prefferedZone[1]) * 0.20 - compactY;

    greenAI.push({
      id: pos.id,
      left: Math.max(20, Math.min(FIELD_WIDTH - 20, baseX)),
      top: Math.max(25, Math.min(FIELD_HEIGHT - 25, baseY + jitter))
    });
  }

  // === Goleiro fica alinhado com a bola e eixo do campo
  greenAI.push({
    id: 23,
    left: FIELD_WIDTH - 30,
    top: BALL_Y
  });

  return { greenAI };
}


// ---------------------------------------------------------------
// === CLASSIFICAÇÃO TÁTICA POR TERÇOS DO CAMPO (DEF / MID / ATT)
// ---------------------------------------------------------------
function classifyByThird(players){
  const DEF_LIMIT = FIELD_WIDTH / 3;       // 1º terço (defesa)
  const MID_LIMIT = (FIELD_WIDTH / 3) * 2; // 2º terço (meio)

  let def = 0, mid = 0, att = 0;

  for (const p of players) {
    if (p.left < DEF_LIMIT) def++;
    else if (p.left < MID_LIMIT) mid++;
    else att++;
  }

  return { def, mid, att };
}


// ---------------------------------------------------------------
// === DEDUÇÃO DA FORMAÇÃO com base na distribuição numérica
// ---------------------------------------------------------------
function detectFormationByThirds(def, mid, att){
  if (def === 4 && mid === 4 && att === 2) return "4-4-2";
  if (def === 4 && mid === 3 && att === 3) return "4-3-3";
  if (def === 4 && mid === 2 && att === 3) return "4-2-3-1";
  if (def === 3 && mid === 5 && att === 2) return "3-5-2";
  if (def === 3 && mid === 4 && att === 3) return "3-4-3";
  if (def === 5 && mid === 4 && att === 1) return "5-4-1";
  if (def === 5 && mid === 3 && att === 2) return "5-3-2";
  if (def === 4 && mid === 2 && att === 4) return "4-2-4";
  if (def === 4 && mid === 5 && att === 1) return "4-5-1";
  if (def === 4 && mid === 5 && att === 1) return "4-1-4-1";

  return "UNKNOWN";
}


    // --- DETECTA PRESSÃO NA ÁREA DEFENSIVA ---
    function emergencyBlockIfUnderPressure(ball, blackPlayers) {
    // Verde defende À DIREITA do campo
    const AREA_GOLEIRO_X = FIELD_WIDTH - 90;  // ~ Grande Área (ajuste fino se quiser)

    // Se a bola estiver dentro dessa área
    const ballInArea = ball.left >= AREA_GOLEIRO_X;

    // Algum adversário colidindo / muito próximo da bola?
    const blackClose = blackPlayers.some(p => {
      return Math.hypot(p.left - ball.left, p.top - ball.top) < 35; // colisão / pressão
    });

    if (!ballInArea || !blackClose) return null;

    console.log("🚨 Pressão na área detectada! Guarani fecha duas linhas de 3.");

    // --- Monta duas linhas de 3 dentro da área ---
    const LINE_X = FIELD_WIDTH - 45; // quase em cima do goleiro

    const emergency = [
    // Linha 1 (mais à frente)
    { id: 16, left: LINE_X - 15, top: FIELD_HEIGHT / 2 - 45 },
    { id: 14, left: LINE_X - 15, top: FIELD_HEIGHT / 2 },
    { id: 15, left: LINE_X - 15, top: FIELD_HEIGHT / 2 + 45 },

    // Linha 2 (mais próxima do goleiro)
    { id: 13, left: LINE_X, top: FIELD_HEIGHT / 2 - 45 },
    { id: 18, left: LINE_X, top: FIELD_HEIGHT / 2 },
    { id: 17, left: LINE_X, top: FIELD_HEIGHT / 2 + 45 },

    // Goleiro parado na linha central
    { id: 23, left: FIELD_WIDTH - 30, top: FIELD_HEIGHT / 2 }
  ];

  return emergency;
}

// === Fala do Treinador ===
let lastFormation = "";
let lastPhase = "";
function abelSpeech(opponentFormation, detectedFormation, phase, bloco, compactacao) {
  const intro = ["Repara comigo:", "É claro o que está acontecendo:", "Eles mudaram o jogo:", "A gente sabe como reagir:"];
  const corpo = [`Eles estão num ${opponentFormation}, e nós estamos num ${detectedFormation}.`, `Adaptamos pro ${detectedFormation} contra o ${opponentFormation}.`];
  const contexto = [`Fase ${phase.toLowerCase()}, bloco ${bloco.toLowerCase()}, compactação ${compactacao.toLowerCase()}.`];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  return `${pick(intro)} ${pick(corpo)} ${pick(contexto)}`;
}

// === Endpoint IA ===
app.post("/ai/analyze", async (req, res) => {
  try {
    const { green = [], black = [], ball = {}, possession = "preto" } = req.body;
    const opponentFormation = (req.body.opponentFormationVision && req.body.opponentFormationVision !== "null")
    ? req.body.opponentFormationVision
    : detectOpponentFormationAdvanced(black);
    let detectedFormation = chooseCounterFormation(opponentFormation, possession);

    // ==== NOVO: se o Guarani já tem jogadores no campo, deduz via terços ====
    if (green && green.length > 0){
      const { def, mid, att } = classifyByThird(green);
      const viaThirds = detectFormationByThirds(def, mid, att);
      if (viaThirds !== "UNKNOWN") detectedFormation = viaThirds;
    }


    // ✅ prioridade: comando manual vindo do chat
    if (req.body.manualFormation){
       detectedFormation = req.body.manualFormation;
    }

    const { greenAI } = buildGreenFromFormation(detectedFormation, ball, possession === "verde" ? "ataque" : "defesa");
    const { phase, bloco, compactacao } = detectPhase(possession, opponentFormation);

    let coachComment = "";
    if (opponentFormation !== lastFormation || phase !== lastPhase) {
      coachComment = abelSpeech(opponentFormation, detectedFormation, phase, bloco, compactacao);
      lastFormation = opponentFormation;
      lastPhase = phase;
    }
    // ✅ Checa defesa de emergência
    const emergency = emergencyBlockIfUnderPressure(ball, black);
    if (emergency) {
      return res.json({
        opponentFormation,
        detectedFormation,
        phase: "defesa",
        bloco: "BAIXO",
        compactacao: "ULTRA",
        green: emergency,
        coachComment: "Calma! Fechamos duas linhas de três dentro da área!"
        });
      }

    res.json({ opponentFormation, detectedFormation, phase, bloco, compactacao, coachComment, green: greenAI });
  } catch (err) {
    console.error("Erro /ai/analyze", err);
    res.status(500).json({ error: "Erro interno IA", details: err.message });
  }
});

// === IA VISUAL + AÇÃO TÁTICA REAL ===
app.post("/ai/vision-tactic", async (req, res) => {
  try {
    const { fieldImage, ball, green, black } = req.body;

    console.log("📸 Enviando imagem para Google Vision...");

    let players = [];
    let ballDetected = false;

    try {
      const [result] = await client.objectLocalization({
        image: { content: fieldImage } // base64
      });

      const objects = result.localizedObjectAnnotations ?? [];

      console.log("🧠 Google detectou:", objects.map(o => o.name));

      players = objects
        .filter(o => o.name === "Person")
        .map(o => ({
          x: Math.round(o.boundingPoly.normalizedVertices[0].x * 600),
          y: Math.round(o.boundingPoly.normalizedVertices[0].y * 300)
        }));

      ballDetected = objects.some(o => o.name === "Sports ball");

    } catch (visionErr) {
      console.warn("⚠️ Erro no Google Vision, ativando fallback...");
    }

    // ✅ FALLBACK: se Vision detectou poucos jogadores (< 6), usa o desenho (black)
    if (players.length < 6) {
      console.log(`⚠️ Vision detectou só ${players.length} jogadores → usando FALLBACK geométrico`);
      players = black; // usa as coordenadas que vieram do front
    }

    // ✅ aplica seu algoritmo tático existente
    const { def, mid, att } = classifyByThird(players);
    // ✅ usa let, pois pode mudar no fallback

	let formationOpponent = detectFormationByThirds(def, mid, att);

	// ✅ FALLBACK quando retorna UNKNOWN ou vazio
	if (!formationOpponent || formationOpponent === "UNKNOWN") {
	console.log("⚠️ Formação indeterminada → usando fallback avançado");
	formationOpponent = detectOpponentFormationAdvanced(players) ?? "4-4-2";
	}


	return res.json({
	opponentFormation: formationOpponent,
	playersDetected: players.length,
	ballDetected,
	coachComment:
    players.length < 6
      ? "Fallback ativado (geométrico)."
      : "Formação detectada via Google Vision."
	});

  } catch (err) {
    console.error("❌ Erro Vision:", err);
    res.status(500).json({ error: "Falha no Vision", details: err.message });
  }
});



// === Socket.IO realtime ===
io.on("connection", (socket) => {

  console.log("🟢 Novo cliente conectado:", socket.id);

  socket.on("join-room", async (room) => {
    console.log("📥 SERVER RECEBEU join-room:", room);

    // sai de todas as salas antes de entrar na nova
    [...socket.rooms]
      .filter(r => r !== socket.id)
      .forEach(r => socket.leave(r));

    socket.join(room);
    socket.emit("joined-room", room);

    const clients = await io.in(room).fetchSockets();
    io.to(room).emit("room-user-count", clients.length);

    console.log("📤 ENVIANDO room-user-count:", clients.length);
  });

  // ✅ movimento de players
socket.on("player-move", (data) => {
  console.log("📤 SERVER recebeu player-move:", data);

  if (!data.room) {
    console.log("⛔ ignorado (sem room)");
    return;
  }

  socket.to(data.room).emit("player-move", data);
});


  // ✅ movimento da bola
  socket.on("ball-move", (data) => {
    if (!data.room) return;
    socket.to(data.room).emit("ball-move", data);
  });

  // ✅ desenho tático
  socket.on("path_draw", (data) => {
    if (!data.room) return;
    socket.to(data.room).emit("path_draw", data);
  });


socket.on("disconnect", async () => {
  console.log("🔴 DISCONNECT:", socket.id);

  // quando desconectar, atualiza o contador da(s) sala(s)
  for (const r of socket.rooms) {
    if (r !== socket.id) {
      const clients = await io.in(r).fetchSockets();
      io.to(r).emit("room-user-count", clients.length);
    }
  }
});
});// ✅ Socket real-time para aprimoramento esportivo

// === Endpoint de chat do Careca (usando OpenAI) ===


const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!groq.apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY ausente no servidor" });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile", // 🔥 rápido e gratuito
      temperature: 0.8,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `
Você é CARECA, ex-centroavante do Guarani, camisa 9.
Mentalidade de artilheiro: simples, direto e eficaz.
Pensa como finalizador: atacar espaço, antecipar, decidir rápido.
Explica o porquê das escolhas táticas.
Use linguagem de boleiro, mas com inteligência.
`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "O Careca ficou em silêncio...";

    // Detecta formação no texto do usuário
    function extractFormation(text) {
      const regex = /\b(4-4-2|4-3-3|4-2-3-1|3-5-2|5-4-1|4-5-1|4-2-4|3-4-3|5-3-2)\b/gi;
      return text.match(regex)?.[0] ?? null;
    }

    res.json({
      reply,
      formationRequested: extractFormation(message) || null
    });

  } catch (err) {
    console.error("Erro no /api/chat:", err);
    res.status(500).json({
      error: "Falha na comunicação com o Groq",
      details: err.message
    });
  }
});




// ===============================================
// ✅ SISTEMA DE RANKING (em memória por enquanto)
// ===============================================

const rankingStore = []; // { name, email, hash, points, goals, ts }

// Função simples pra "hash" da senha (base64 só para demo)
function hashPass(s) {
  return Buffer.from(s).toString("base64");
}

// Verifica se a pontuação está dentro do período solicitado
function isWithinRange(timestamp, range) {
  const now = new Date();

  if (range === "daily") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return timestamp >= start.getTime();
  }

  if (range === "weekly") {
    const first = now.getDate() - now.getDay() + 1; // 2a feira
    const start = new Date(now.getFullYear(), now.getMonth(), first);
    return timestamp >= start.getTime();
  }

  if (range === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return timestamp >= start.getTime();
  }

  return true;
}

/**
 * ✅ Salva pontuação no ranking
 * Body esperado:
 * {
 *   name: "Fulano",
 *   email: "a@b.com",
 *   pass: "123",
 *   points: 12,
 *   goals: 7
 * }
 */
app.post("/ranking/score", (req, res) => {
  const { name, email, pass, points, goals } = req.body;

  if (!name || !email || !pass) {
    return res.status(400).json({ error: "Nome, email e senha são obrigatórios." });
  }

  const hash = hashPass(pass);

  let user = rankingStore.find(u => u.email === email);

  if (!user) {
    // cria novo
    user = {
      name,
      email,
      hash,
      points: Number(points || 0),
      goals: Number(goals || 0),
      ts: Date.now()
    };
    rankingStore.push(user);
  } else {
    // usuário já existe → verifica senha
    if (user.hash !== hash) {
      return res.status(403).json({ error: "Senha incorreta para este usuário" });
    }

    // permite atualizar nome + pontuação
    user.name = name;
    user.points = Number(points || 0);
    user.goals = Number(goals || 0);
    user.ts = Date.now();
  }

  res.json({ ok: true });
});

/**
 * ✅ Lista ranking
 * GET /ranking?range=daily
 * GET /ranking?range=weekly
 * GET /ranking?range=monthly
 */
app.get("/ranking", (req, res) => {
  const range = req.query.range || "daily";

  const filtered = rankingStore
    .filter(user => isWithinRange(user.ts, range))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.goals - a.goals;
    })
    .slice(0, 50); // limite (top 50)

  res.json({ top: filtered });
});


// === Inicializa Render ===
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => console.log(`✅ AI TÁTICA v13 + Realtime rodando na porta ${PORT}`));
