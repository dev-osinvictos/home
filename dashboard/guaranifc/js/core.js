/* ===== CORE de aprimoramento esportivo: movimento, socket, física e AI analyze ===== */

// === Utilitário: throttle ===
function throttle(fn, delay) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn(...args);
    }
  };
}

// === DIMENSÃO DO CAMPO (pegando pelo elemento #field ou fallback para viewport) ===
const field = document.getElementById("field") || document.body;
window.FIELD_WIDTH  = field.clientWidth  || window.innerWidth;
window.FIELD_HEIGHT = field.clientHeight || window.innerHeight;
const FIELD_RIGHT_GOAL_X = FIELD_WIDTH - 20; // ajuste conforme seu campo

function isGoalRight(ballEl) {
  const goalEl = document.getElementById("gol2-square");
  if (!ballEl || !goalEl) return false;

  const ball = ballEl.getBoundingClientRect();
  const goal = goalEl.getBoundingClientRect();

  const passedLine = ball.right >= goal.left;                // passou da linha do gol
  const withinPosts = ball.top >= goal.top && ball.bottom <= goal.bottom; // entre as traves

  return passedLine && withinPosts;
}

const circles = {};
const dragState = {};
let activeId = null;

let movedDuringDrag = false;

window.trainingBallLock = false;
window.trainingPlayMode = false;
window.trainingForceShot = false;

// === Inicializa círculos (jogadores) ===
for (let i = 1; i <= 24; i++) {
  const el = document.getElementById("circle" + i);
  circles[i] = el;
  dragState[i] = { dragging: false, offsetX: 0, offsetY: 0 };
  if (!el) continue;
  el.style.position = el.style.position || "absolute";
  el.style.zIndex = "20";

  el.addEventListener("mousedown", (e) => {
    if (i === 24 && window.trainingBallLock) return;
    dragState[i].dragging = true;
    dragState[i].offsetX = e.offsetX;
    dragState[i].offsetY = e.offsetY;
    activeId = i;
  });

  el.addEventListener("touchstart", (e) => {
    if (i === 24 && window.trainingBallLock) return;
    const touch = e.touches[0];
    const rect = el.getBoundingClientRect();
    dragState[i].dragging = true;
    dragState[i].offsetX = touch.clientX - rect.left;
    dragState[i].offsetY = touch.clientY - rect.top;
    activeId = i;
    e.preventDefault();
  }, { passive: false });
}

// === NOVO: Estado tático por jogador (D / M / A / número) ===
const circleTacticalState = {};
const circleOriginalNumber = {};

// === Inicializa labels originais ===
for (let i = 1; i <= 24; i++) {
  const el = document.getElementById("circle" + i);
  if (!el) continue;

// guarda o número original do círculo
  circleOriginalNumber[i] = el.textContent.trim() || "";
}

// === Ciclo de clique: Número → D → M → A → Número ===
function cycleTacticalRole(circleId) {
  const el = circles[circleId];
  if (!el) return;

  const current = circleTacticalState[circleId] || "NUM";

  let next;
  if (current === "NUM") next = "D";
  else if (current === "D") next = "M";
  else if (current === "M") next = "A";
  else next = "NUM";

  // salva estado
  circleTacticalState[circleId] = next;

  // renderiza text
  if (next === "NUM") {
    el.textContent = circleOriginalNumber[circleId];
    el.style.background = ""; // mantem seu estilo atual
  } else {
    el.textContent = next; // D / M / A
  }
}

// === Adiciona listeners (click) para cada círculo ===
for (let i = 1; i <= 24; i++) {
  const el = document.getElementById("circle" + i);
  if (!el) continue;

el.addEventListener("pointerup", (e) => {
  e.stopPropagation();

  if (movedDuringDrag) {
    movedDuringDrag = false;
    return;
  }

  if (i === 24) return;

  cycleTacticalRole(i);
});


}

// === Física da bola ===
const emitBallMove = throttle((id, left, top, room ) => {
	if (!window.currentRoomCode) return;
	socket.emit("ball-move", { id, left, top, room: window.currentRoomCode });
}, 50);

const ball = document.getElementById("circle24");

// === Detecção de colisão ===
function checkCollision(player, ball) {
  const pr = player.getBoundingClientRect();
  const br = ball.getBoundingClientRect();
  const dx = pr.left - br.left;
  const dy = pr.top - br.top;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < 30;
}

/* ===== MOVIMENTO, COLISÃO E FÍSICA AVANÇADA (FIFA MODE) ===== */

let lastSpoken = {}; // cooldown das falas
let ballVelocity = { x: 0, y: 0 }; // vetor de velocidade da bola
let ballMoving = false;

// === Função de movimento e impacto ===
function moveElement(id, x, y) {
  const el = circles[id];
  if (!el) return;

  // 🟥 impede o juiz (circle12) de movimentar a bola ou ter impacto
  if (id === 12) return;

  // 🟢 permite o movimento da bola localmente
  const oldX = parseFloat(el.style.left || 0);
  const oldY = parseFloat(el.style.top || 0);

  el.style.left = x + "px";
  el.style.top = y + "px";

  // Se for a bola, apenas emite o movimento e sai (sem colisão)
if (id === 24) {
    emitBallMove("circle24", x, y, window.currentRoomCode);

    // ✅ ATIVA física sempre que a bola for arrastada
    ballVelocity.x = 0;
    ballVelocity.y = 0;
    ballMoving = true;

    return;
}

  // detecta colisão jogador-bola
  if (checkCollision(el, ball)) {
    const now = Date.now();

    // fala uma vez por segundo
    if (!lastSpoken[id] || now - lastSpoken[id] > 1000) {
      speakPlayerNumber("circle" + id);
      lastSpoken[id] = now;
    }

    // === Cálculo do impacto proporcional à velocidade ===
    const vx = (x - oldX) * 0.6; // força (ajuste: 0.6–1.0)
    const vy = (y - oldY) * 0.6;
    
   // 🟩 AUTO-CHUTE DA IA (time verde)
   if (window.trainingForceShot && id >= 13 && id <= 23) {
       aiAutoKickTowardsLeftGoal(el);
       return;
   }
    
    ballVelocity.x = vx;
    ballVelocity.y = vy;
    ballMoving = true;
  }
}

// === Loop de física (inércia e atrito) ===
function updateBallPhysics() {
  if (!ballMoving) return;
  console.log("⬅️ Loop da bola rodando", ballVelocity);

  const ball = document.getElementById("circle24");
  if (!ball) return;

  let bx = parseFloat(ball.style.left || 0);
  let by = parseFloat(ball.style.top || 0);

  // aplica velocidade
  bx += ballVelocity.x;
  by += ballVelocity.y;

  // atrito (reduz a velocidade gradualmente)
  ballVelocity.x *= 0.94;
  ballVelocity.y *= 0.94;

  // se a velocidade for muito baixa, para a bola
  if (Math.abs(ballVelocity.x) < 0.05 && Math.abs(ballVelocity.y) < 0.05) {
    ballMoving = false;
  }

  // mantém dentro do campo (limites de tela)
  const field = document.getElementById("background-square"); // <-- usa o campo real
  const maxX = (field.clientWidth || window.innerWidth) - 40;
  const maxY = (field.clientHeight || window.innerHeight) - 40;
  bx = Math.max(0, Math.min(bx, maxX));
  by = Math.max(0, Math.min(by, maxY));

  // aplica posição
  ball.style.left = bx + "px";
  ball.style.top = by + "px";
  console.log("Posição da bola:", bx, by);

  // ✅ DETECÇÃO DE GOL (bola passou COMPLETAMENTE do gol direito)
  if (isGoalRight(ball)) {
    console.log("✅ GOL DETECTADO");

    window.dispatchEvent(
      new CustomEvent("goal:scored", { detail: { side: "right" } })
    );

    ballMoving = false; // para a bola após o gol
    return;            // evita disparar múltiplos gols no mesmo lance
  }

  // envia posição ao servidor
  emitBallMove("circle24", bx, by, window.currentRoomCode);
}

// === Atualiza a física a cada frame ===
setInterval(updateBallPhysics, 30);

// === Movimento dos jogadores (desktop + touch) ===
const emitPlayerMove = throttle((id, left, top, room) => {
  if (!window.currentRoomCode) {
    console.log("⛔ não está em sala, não emitir");
    return;
  }

  const payload = { id, left, top, room: window.currentRoomCode };
  console.log("🚀 ENVIANDO player-move:", payload);
  socket.emit("player-move", payload);
}, 40);


document.addEventListener("mousemove", (e) => {
  if (!activeId) return;
  movedDuringDrag = true;
  const i = activeId;
  const x = e.clientX - dragState[i].offsetX;
  const y = e.clientY - dragState[i].offsetY;
  moveElement(i, x, y);
  emitPlayerMove("circle" + i, x, y, window.currentRoomCode);
});

document.addEventListener("touchmove", (e) => {
  if (!activeId) return;
  movedDuringDrag = true;
  const i = activeId;
  const touch = e.touches[0];
  const x = touch.clientX - dragState[i].offsetX;
  const y = touch.clientY - dragState[i].offsetY;
  moveElement(i, x, y);
  emitPlayerMove("circle" + i, x, y, window.currentRoomCode);
  e.preventDefault();
}, { passive: false });

function endDrag() {
  if (activeId) {
    dragState[activeId].dragging = false;
    activeId = null;
  }
  // reset mover detector
  movedDuringDrag = false;
}

document.addEventListener("mouseup", endDrag);
document.addEventListener("touchend", endDrag);

const canvas = document.getElementById("trace-canvas");
const ctx = canvas?.getContext("2d", { willReadFrequently: true });

 // ================================================
 // === IA FINALIZA TREINO (verde corre e chuta) ===
 // ================================================
 window.triggerAITreinoFinisher = function () {
     if (!window.trainingPlayMode) return;

     const ball = document.getElementById("circle24");
     const bx = parseFloat(ball.style.left);
     const by = parseFloat(ball.style.top);

     // seleciona só jogadores VERDES (13 a 23)
     const green = [];
     for (let i = 13; i <= 23; i++) {
         const el = document.getElementById("circle" + i);
         if (!el) continue;
         green.push({
             id: i,
             el,
             x: parseFloat(el.style.left),
             y: parseFloat(el.style.top)
         });
     }

     // encontra o mais próximo da bola
     let best = null;
     let bestDist = 99999;
     for (const p of green) {
          const d = Math.hypot(p.x - bx, p.y - by);
        if (d < bestDist) {
             bestDist = d;
             best = p;
         }
     }
     if (!best) return;

     // jogador verde corre até a bola
     const steps = 28;
     const dur = 380;
     let n = 0;
     const stepX = (bx - best.x) / steps;
     const stepY = (by - best.y) / steps;

     const interval = setInterval(() => {
         n++;
         best.x += stepX;
         best.y += stepY;
		 moveElement(best.id, best.x, best.y);

         if (n >= steps) {
             clearInterval(interval);
             aiKickBallLeft();
         }
     }, dur / steps);
 };

 // IA chuta a bola para o GOL DA ESQUERDA
 function aiKickBallLeft() {
     const ball = document.getElementById("circle24");
     if (!ball) return;

     // força inicial do chute → direção esquerda
	 aiAutoKickTowardsLeftGoal();
	 
	 // após a bola ser chutada
	 setTimeout(() => {
     window.trainingForceShot = false;
   }, 800);
 }

function aiAutoKickTowardsLeftGoal(playerEl) {
    const ball = document.getElementById("circle24");
    const bx = parseFloat(ball.style.left);
    const by = parseFloat(ball.style.top);

    const goal = document.getElementById("gol-square");
    if (!goal) {
        console.warn("⚠️ gol-square não encontrado, chute cancelado.");
        return;
    }
    const gr = goal.getBoundingClientRect();
    const br = ball.getBoundingClientRect();

    // centro do gol
    const goalY = gr.top + (gr.height / 2);

    // direção do chute
    const dx = -1; // esquerda
    const dy = (goalY - br.top) * 0.06; // ajusta trajetória vertical

    // força do chute
    ballVelocity.x = dx * 14;
    ballVelocity.y = dy;
    ballMoving = true;
}
   
function animateTeam(prefix, positions, onComplete, phase = "defesa") {
  const fieldRect = document.getElementById("background-square").getBoundingClientRect();

  // === Caminho ondulado baseado na fase ===
  const { path: sheenPath, speed } = generateSheenPath(550, 150, phase);

  let frame = 0;
  const totalFrames = sheenPath.length;

  const interval = setInterval(() => {
    const point = sheenPath[frame];
    if (!point) {
      clearInterval(interval);
      if (onComplete) onComplete();
      return;
    }

    positions.forEach((p, idx) => {
      const el = document.getElementById(prefix + p.id);
      if (!el) return;

      const offsetY = Math.sin((frame / 6) + idx / 2) * 5;
      const offsetX = Math.cos((frame / 10) + idx / 3) * 2;

      moveElement(p.id, point.x + offsetX, point.y + offsetY);
    });

    frame++;
  }, speed);
}


/**
 * Anima a transição entre duas formações (ex: 4-4-2 → 4-3-3)
 * usando uma curva Sheen & Ghain (ش غ).
 */
function animateFormationTransition(prefix, fromFormation, toFormation, phase = "transicao") {
  const field = document.getElementById("background-square");
  const rect = field.getBoundingClientRect();

  // Gera a trajetória Sheen → Ghain → Diagonal
  const { path: sheenPath, speed } = window.generateSheenPath(300, 50, phase, true);

  const fieldCenterX = rect.width / 2;
  const totalFrames = sheenPath.length;
  let frame = 0;

  const interval = setInterval(() => {
    const point = sheenPath[frame];
    if (!point) {
      clearInterval(interval);
      return;
    }

    // Interpola cada jogador entre as formações
    for (let i = 0; i < toFormation.length; i++) {
      const player = toFormation[i];
      const el = document.getElementById(prefix + player.id);
      if (!el) continue;

      const from = fromFormation.find(f => f.id === player.id);
      if (!from) continue;

      const progress = frame / totalFrames;
      const lerpX = from.prefferedZone[0] + (player.prefferedZone[0] - from.prefferedZone[0]) * progress;
      const lerpY = from.prefferedZone[1] + (player.prefferedZone[1] - from.prefferedZone[1]) * progress;

      // Oscilação leve durante movimento
      const offsetX = Math.cos((frame / 8) + i / 2) * 3;
      const offsetY = Math.sin((frame / 8) + i / 3) * 3;

      // Recentrar o time (Carlos Alberto Silva Style)
      const centerOffsetX = 0; // fieldCenterX - 300; // 600/2 - referência base
	
	  moveElement(player.id, (lerpX + point.x / 10 + offsetX), (lerpY + point.y / 10 + offsetY));

    }

    frame++;
  }, speed);
}

window.animateFormationTransition = animateFormationTransition;



// === 🟢 BLOCO TÁTICO DINÂMICO (MOVE O TIME TODO) ===
function applyDynamicBlocks(greenPlayers, phase, opponentFormation) {
  let blockOffsetX = 0;
  switch ((phase || "").toLowerCase()) {
    case "ataque":    blockOffsetX = -80; break;
    case "defesa":    blockOffsetX =  80; break;
    case "transicao": blockOffsetX = -40; break;
  }
  if (opponentFormation === "4-4-2" || opponentFormation === "5-4-1") blockOffsetX = -100;
  else if (opponentFormation === "4-3-3" || opponentFormation === "4-2-3-1") blockOffsetX = 100;

  console.log(`🟢 Bloco aplicado: fase=${phase}, offset=${blockOffsetX}px`);

  greenPlayers.forEach(p => {
    const el = document.getElementById(`circle${p.id}`);
    if (!el) return;
    const newX = p.left + blockOffsetX;
	const fieldRect = document.getElementById("background-square").getBoundingClientRect();
    moveElement(p.id, p.left, p.top);
    p.left = Math.max(20, Math.min(580, newX));
  });
}

// === Função: envia imagem do campo para análise visual (IA Vision) ===
async function sendVisionTactic() {
  try {
    const canvas = document.querySelector("canvas");
    if (!canvas) {
      console.warn("❌ Canvas não encontrado.");
      return;
    }

    const fieldImage = canvas.toDataURL("image/png");
    const possession = typeof getCurrentPossession === "function"
      ? getCurrentPossession()
      : "verde";

    const ball = typeof getBall === "function" ? getBall() : null;

    console.log("📸 Enviando imagem do campo para análise visual...");
    console.log("🖼️ fieldImage:", fieldImage.substring(0, 100));

    const green = getGuaraniPositions();
    const black = getOpponentPositions();

    const res = await fetch("https://guaranifc.onrender.com/ai/vision-tactic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldImage, possession, ball, green, black, tacticalRoles: circleTacticalState })
    });

    const data = await res.json();
    console.log("📊 Visão Tática (backend):", data);

    // ✅ Move o Verde pela visão da IA
    if (Array.isArray(data.green) && data.green.length > 0) {
      animateTeam("circle", data.green);

      applyDynamicBlocks(
        data.green,
        data.phase?.toLowerCase() || "defesa",
        data.opponentFormation || "4-4-2"
      );
    }

    // ✅ Abre popup do treinador
    if (data.coachComment && typeof showAbelCommentPopup === "function") {
      showAbelCommentPopup(data.coachComment);
    }
    
    return data;
  } catch (err) {
    console.error("❌ Erro ao enviar imagem para IA Vision:", err);
  }
}

    window.animateTeam = animateTeam;
