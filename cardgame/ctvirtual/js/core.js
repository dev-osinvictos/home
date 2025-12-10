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

window.notify = window.notifyTop;

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
  const id = i;
  el.style.position = el.style.position || "absolute";
  el.style.zIndex = "20";

  el.addEventListener("mousedown", (e) => {
    if (i === 24 && window.trainingBallLock) return;
    dragState[id].dragging = true;
    dragState[id].offsetX = e.offsetX;
    dragState[id].offsetY = e.offsetY;
    activeId = id;
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
let lastBallTouch = { time: null, by: null };
let autoShotPending = false;
let autoShotTimeout = null;
let lastAutoShotTs = 0;

function getElementCenter(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function distanceBetweenCenters(a, b) {
  if (!a || !b) return Infinity;
  const ca = getElementCenter(a);
  const cb = getElementCenter(b);
  const dx = ca.x - cb.x;
  const dy = ca.y - cb.y;
  return Math.hypot(dx, dy);
}

function getGoalCenter(goalId) {
  const goal = document.getElementById(goalId);
  const fieldRect = document.getElementById("background-square")?.getBoundingClientRect();
  const gr = goal?.getBoundingClientRect();
  if (!goal || !gr) return null;
  return {
    x: fieldRect ? gr.left - fieldRect.left + gr.width / 2 : parseFloat(goal.style.left) + (goal.offsetWidth || 0) / 2,
    y: fieldRect ? gr.top - fieldRect.top + gr.height / 2 : parseFloat(goal.style.top) + (goal.offsetHeight || 0) / 2
  };
}

// Posição inicial do goleiro do Guarani (circle23)
const gkGuarani = document.getElementById("circle23");
if (gkGuarani) {
  gkGuarani.style.left = "181px";
  gkGuarani.style.top = "15px";
  gkGuarani.style.setProperty("left", "181px", "important");
  gkGuarani.style.setProperty("top", "15px", "important");
}

// watchdog simples: mantém o GK no lugar esperado
setInterval(() => {
  const gk = document.getElementById("circle23");
  if (!gk) return;
  const left = parseFloat(gk.style.left) || 0;
  const top = parseFloat(gk.style.top) || 0;
  if (Math.abs(left - 181) > 5 || Math.abs(top - 15) > 5) {
    gk.style.left = "181px";
    gk.style.top = "15px";
    gk.style.setProperty("left", "181px", "important");
    gk.style.setProperty("top", "15px", "important");
  }
}, 400);

// === Função de movimento e impacto ===
function moveElement(id, x, y) {
  const el = circles[id];
  if (!el) return;

  // Ajuste do goleiro do Guarani (circle23): segue a linha X da bola e fica na pequena área superior
  let targetX = x;
  let targetY = y;
  if (id === 23) {
    targetX = 181;
    targetY = 15;
  }

  // 🟢 permite o movimento da bola localmente
  const oldX = parseFloat(el.style.left || 0);
  const oldY = parseFloat(el.style.top || 0);

  el.style.left = targetX + "px";
  el.style.top = targetY + "px";

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
    lastBallTouch = { time: now, by: id };

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
    autoShotPending = false;
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
    autoShotPending = false;
    return;            // evita disparar múltiplos gols no mesmo lance
  }

  // 🔄 AUTO-CHUTE: se a bola chega perto de um jogador branco, ele finaliza
  if (ballMoving && Date.now() - lastAutoShotTs > 600) {
    for (let i = 1; i <= 11; i++) {
      const p = document.getElementById("circle" + i);
      if (!p) continue;
      const dist = distanceBetweenCenters(ball, p);
      if (dist < 26) { // contato/passe
        triggerAutoShot();
        lastAutoShotTs = Date.now();
        break;
      }
    }
  }

  // envia posição ao servidor
  emitBallMove("circle24", bx, by, window.currentRoomCode);
}

// === Atualiza a física a cada frame ===
setInterval(updateBallPhysics, 30);

// ✅ Chute forçado ao gol direito (gol2-square) — usado após colisão + clique no aiBtn
window.kickBallToRightGoal = function kickBallToRightGoal() {
  const ball = document.getElementById("circle24");
  const goal = document.getElementById("gol2-square");
  if (!ball || !goal) return;

  const ballCenter = getElementCenter(ball);
  const goalCenter = getElementCenter(goal);

  const dx = goalCenter.x - ballCenter.x;
  const dy = goalCenter.y - ballCenter.y;
  const dist = Math.max(1, Math.hypot(dx, dy));

  // velocidade proporcional, suficientemente forte para alcançar o gol
  const speed = Math.min(24, dist * 0.35);
  ballVelocity.x = (dx / dist) * speed;
  ballVelocity.y = (dy / dist) * speed;
  ballMoving = true;
};

function strongGreenShot() {
  const ball = document.getElementById("circle24");
  const goal = document.getElementById("gol2-square");
  if (!ball || !goal) return;
  let attacker = null;
  let bestDist = Infinity;
  for (let i = 13; i <= 22; i++) {
    const el = document.getElementById("circle" + i);
    if (!el) continue;
    const d = distanceBetweenCenters(ball, el);
    if (d < bestDist) {
      bestDist = d;
      attacker = el;
    }
  }
  const ballCenter = getElementCenter(ball);
  const goalCenter = getElementCenter(goal);
  const dx = goalCenter.x - ballCenter.x;
  const dy = goalCenter.y - ballCenter.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const speed = Math.min(30, dist * 0.45);
  ballVelocity.x = (dx / dist) * speed;
  ballVelocity.y = (dy / dist) * speed;
  ballMoving = true;
}

function triggerAutoShot() {
  kickBallToRightGoal();
  autoShotPending = true;
  clearTimeout(autoShotTimeout);
  autoShotTimeout = setTimeout(() => {
    if (autoShotPending) {
      strongGreenShot();
      autoShotPending = false;
    }
  }, 1600);
}

// ===== AUTO CHUTE/PASSE APÓS AI BTN =====
function shootWithEchoes(goalId, speedBase = 20) {
  const ball = document.getElementById("circle24");
  const goalCenter = getGoalCenter(goalId);
  if (!ball || !goalCenter) return;

  const ballCenter = getElementCenter(ball);
  const dx = goalCenter.x - ballCenter.x;
  const dy = goalCenter.y - ballCenter.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const speeds = [speedBase, speedBase * 0.75, speedBase * 0.55];

  speeds.forEach((sp, idx) => {
    setTimeout(() => {
      ballVelocity.x = (dx / dist) * sp;
      ballVelocity.y = (dy / dist) * sp;
      ballMoving = true;
    }, idx * 350);
  });
}

function autoPossessionShoot() {
  const ball = document.getElementById("circle24");
  if (!ball) return;
  const lastId = lastBallTouch?.by ? Number(lastBallTouch.by) : null;

  const picker = () => {
    // fallback: pega o jogador mais próximo
    let best = null;
    let bestDist = Infinity;
    for (let i = 1; i <= 22; i++) {
      const el = document.getElementById("circle" + i);
      if (!el) continue;
      const d = distanceBetweenCenters(ball, el);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  };

  const ownerId = lastId || picker();
  if (!ownerId) return;
  const isGreen = ownerId >= 13;
  const goalId = isGreen ? "gol-square" : "gol2-square";
  const speed = isGreen ? 18 : 22;
  shootWithEchoes(goalId, speed);
}
window.autoPossessionShoot = autoPossessionShoot;

window.passBallToTarget = function passBallToTarget(targetEl) {
  const ball = document.getElementById("circle24");
  if (!ball || !targetEl) return;
  const ballCenter = getElementCenter(ball);
  const targetCenter = getElementCenter(targetEl);

  const dx = targetCenter.x - ballCenter.x;
  const dy = targetCenter.y - ballCenter.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const speed = Math.min(18, dist * 0.25);
  ballVelocity.x = (dx / dist) * speed;
  ballVelocity.y = (dy / dist) * speed;
  ballMoving = true;
};

window.chooseForwardTeammate = function chooseForwardTeammate(excludeId = null) {
  const ball = document.getElementById("circle24");
  if (!ball) return null;
  const ballCenter = getElementCenter(ball);
  let best = null;
  let bestDelta = 0;

  // time branco: círculos 1 a 11
  for (let i = 1; i <= 11; i++) {
    if (excludeId && String(excludeId) === String(i)) continue;
    const el = document.getElementById("circle" + i);
    if (!el) continue;
    const c = getElementCenter(el);
    // Campo orientado para o topo: quem está mais à frente tem Y menor
    const deltaY = ballCenter.y - c.y;
    if (deltaY > bestDelta) {
      bestDelta = deltaY;
      best = el;
    }
  }
  return best;
};

window.wasRecentBallTouch = function wasRecentBallTouch(ms = 2000) {
  if (!lastBallTouch.time) return false;
  return Date.now() - lastBallTouch.time <= ms;
};

window.consumeLastBallTouch = function consumeLastBallTouch() {
  lastBallTouch = { time: null, by: null };
};

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

// ============================================================
// ⚫ PEGAR POSIÇÕES DO TIME ADVERSÁRIO/TIME DE TREINO CAMPO ⚫
// ============================================================
function getOpponentPositions() {
  // detecta automaticamente se existe circleOpp1
  // ou usa circle1 a circle11 como ADVERSÁRIO/TIME DE TREINO!
  const black = [];
  for (let i = 1; i <= 11; i++) {
    let el = document.getElementById("circleOpp" + i);
    if (!el) el = document.getElementById("circle" + i); // fallback automático
    if (!el) continue;
    
    // pega estilos COMPUTADOS (o que realmente aparece na tela)
    const comp = window.getComputedStyle(el);
    const left = parseFloat(comp.left);
    const top  = parseFloat(comp.top);

    black.push({
      id: i,
      left: isNaN(left) ? 0 : left,
      top:  isNaN(top)  ? 0 : top
    });
  }
  return black;
}

// 🔥 Permitir usar pelo console:
if (typeof window !== "undefined") {
  window.getOpponentPositions = getOpponentPositions;
}


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
    if (!ball) return;

    const bx = parseFloat(ball.style.left);
    const by = parseFloat(ball.style.top);

    const goal = document.getElementById("gol-square");
    if (!goal) {
        console.warn("⚠️ gol-square não encontrado, chute cancelado.");
        return;
    }

    const fieldRect = document.getElementById("background-square")?.getBoundingClientRect();
    const gr = goal.getBoundingClientRect();

    // centro do gol em coordenadas do campo
    const targetX = fieldRect ? gr.left - fieldRect.left + gr.width / 2 : parseFloat(goal.style.left) + (goal.offsetWidth || 0) / 2;
    const targetY = fieldRect ? gr.top - fieldRect.top + gr.height / 2 : parseFloat(goal.style.top) + (goal.offsetHeight || 0) / 2;

    const vecX = targetX - bx;
    const vecY = targetY - by;
    const len = Math.hypot(vecX, vecY) || 1;

    const speed = 12;
    ballVelocity.x = (vecX / len) * speed;
    ballVelocity.y = (vecY / len) * speed;

    // leve rotação para efeito visual
    const spin = (Math.random() * 2 - 1) * 0.6;
    ball.style.transition = "transform 0.15s linear";
    ball.style.transform = `rotate(${spin}rad)`;

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

// Reorienta formações para o Guarani defender o gol do topo e atacar de cima para baixo.
function orientFormationTopBottom(formation, fieldRect) {
  const fw = fieldRect?.width || 600;
  const fh = fieldRect?.height || 300;
  const baseW = 600;
  const baseH = 300;

  return (formation || []).map(player => {
    const [origX, origY] = player.prefferedZone || [0, 0];

    // Profundidade vira eixo Y (topo→fundo) e invertida para defender no topo.
    const depthNorm = origX / baseW;
    const projectedTop = fh - (depthNorm * fh);

    // Lateralidade continua no eixo X, normalizada pelo height base.
    const lateralNorm = origY / baseH;
    const projectedLeft = lateralNorm * fw;

    const clampedLeft = Math.max(20, Math.min(fw - 20, projectedLeft));
    const clampedTop  = Math.max(20, Math.min(fh - 20, projectedTop));

    return { ...player, prefferedZone: [clampedLeft, clampedTop] };
  });
}


/**
 * Anima a transição entre duas formações (ex: 4-4-2 → 4-3-3)
 * usando uma curva Sheen & Ghain (ش غ).
 */
function animateFormationTransition(prefix, fromFormation, toFormation, phase = "transicao", mode = "match") {
  const field = document.getElementById("background-square");
  const rect = field.getBoundingClientRect();

  // Reorienta as zonas para a lógica topo→base (Guarani defendendo topo).
  const fromOriented = orientFormationTopBottom(fromFormation, rect);
  const toOriented = orientFormationTopBottom(toFormation, rect);
  
 const currentPos = {};
 document.querySelectorAll(`.${prefix}`).forEach(el => {
   const id = parseInt(el.id.replace(prefix, ""));
   currentPos[id] = {
     left: parseFloat(el.style.left),
     top:  parseFloat(el.style.top)
   };
 });

 // Gera a trajetória Sheen → Ghain → Diagonal
 const isTraining = mode === "training";
 const { path: sheenPath, speed } = window.generateSheenPath(
   isTraining ? 150 : 300,   // movimento mais curto no treino
   isTraining ? 30 : 50,     // menos oscilação
   phase,
   true
 );

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
    for (let i = 0; i < toOriented.length; i++) {
      const player = toOriented[i];
      const el = document.getElementById(prefix + player.id);
      if (!el) continue;

      const from = fromOriented.find(f => f.id === player.id);
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

// ======================================================
// 🔍 PEGAR POSIÇÕES DO GUARANI — GUARDIÃO DO VISION 🔰
// ======================================================
function getGuaraniPositions() {
  const green = [];
  for (let i = 13; i <= 23; i++) {
    const el = document.getElementById("circle" + i);
    if (!el) continue;

    green.push({
      id: i,
      left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0
    });
  }
  return green;
}

// ======================================================
// DETECTA ELO TÁTICO NO CAMPO (ZAGA / MEIO / ATAQUE)
// ======================================================
function detectEloFormation(players, maxDist = 60, orientation = "defense-bottom") {
  if (!players || players.length < 4) return null;

  // Ignora goleiro: menor top (defendendo topo)
  let filtered = players || [];
  let keeper = null;
  if (filtered.length > 10) {
    keeper = orientation === "defense-top"
      ? filtered.reduce((gk, p) => (p.top < gk.top ? p : gk), filtered[0])
      : filtered.reduce((gk, p) => (p.top > gk.top ? p : gk), filtered[0]);
    filtered = filtered.filter(p => p !== keeper);
  }

  const roles = { zaga: [], meio: [], ataque: [], keeper }; // AGORA FOI DECLARADO!
  const clusters = [];
  const visited = new Set();

  function bfsCluster(startIdx) {
    const queue = [players[startIdx]];
    const cluster = [];
    visited.add(startIdx);

    while (queue.length > 0) {
      const current = queue.shift();
      cluster.push(current);

      for (let i = 0; i < players.length; i++) {
        if (visited.has(i)) continue;
        const dx = players[i].left - current.left;
        const dy = players[i].top - current.top;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= maxDist) {
          visited.add(i);
          queue.push(players[i]);
        }
      }
    }
    return cluster;
  }

  // 🧊 monta clusters automáticos
  for (let i = 0; i < filtered.length; i++) {
    if (!visited.has(i)) {
      const cluster = bfsCluster(i);
      if (cluster.length >= 2) clusters.push(cluster);
    }
  }

// 📌 Coordenadas do campo (frações reais: 2/8 e 5/8)
const fieldEl = document.getElementById("background-square");
const FIELD_HEIGHT = fieldEl?.clientHeight || window.innerHeight || 300;
const DEF_LIMIT = FIELD_HEIGHT * (2/8);   // 75px
const MID_LIMIT = FIELD_HEIGHT * (5/8);   // 187.5px

clusters.forEach(cluster => {
  const avgY = cluster.reduce((s, p) => s + p.top, 0) / cluster.length;

  // 1️⃣ Primeiro identifica a ZONA
  let zone = "ATT";
  const defenseTop = orientation === "defense-top";
  if (defenseTop) {
    // Defesa no topo, ataque embaixo
    if (avgY < DEF_LIMIT)      zone = "DEF";
    else if (avgY < MID_LIMIT) zone = "MID";
    else zone = "ATT";
  } else {
    // Defesa embaixo, ataque em cima (padrão)
    if (avgY < DEF_LIMIT)      zone = "ATT";
    else if (avgY < MID_LIMIT) zone = "MID";
    else zone = "DEF";
  }

  // 2️⃣ Depois avalia TAMANHO do cluster
  if (zone === "DEF") {
    roles.zaga.push(...cluster);
  } 
  else if (zone === "MID") {
    roles.meio.push(...cluster);
  } 
  else {
    roles.ataque.push(...cluster);
  }
});


  return roles;
}

if (typeof window !== "undefined") {
  window.detectEloFormation = detectEloFormation;
}


// =====================================================
// INTERPRETA A FORMAÇÃO BASEADO NO ELO
// =====================================================
function interpretFormation(roles) {
  const z = roles.zaga?.length || 0;
  const m = roles.meio?.length || 0;
  const a = roles.ataque?.length || 0;

  // Reconhecimento automático de padrões profissionais
  if (z === 4 && m === 3 && a === 3) return "4-3-3";
  if (z === 4 && m === 2 && a === 4) return "4-1-4-1";
  if (z === 4 && m === 4 && a === 2) return "4-4-2";
  if (z === 4 && m === 3 && a === 2) return "4-1-3-2";  // sua formação atual!
  if (z === 3 && m === 5 && a === 2) return "3-5-2";
  if (z === 5 && m === 3 && a === 2) return "5-3-2";

  // Fallback moderno (não fica preso em 4-4-2)
  return `${z}-${m}-${a}`;
}

if (typeof window !== "undefined") {
  window.interpretFormation = interpretFormation;
}

// ==============================================================
// 1) ANÁLISE POR TERÇOS DO CAMPO – ESTRUTURA BÁSICA
// ==============================================================
function analyzeFieldThirds(players) {
  // Campo orientado VERTICAL — detecta se defesa está embaixo ou em cima
  const field = document.getElementById("background-square");
  const FIELD_HEIGHT = field?.clientHeight || window.innerHeight || 300;

  const VALID = [
    [4, 4, 2], [4, 1, 4, 1], [4, 3, 3], [4, 2, 3, 1], [4, 2, 4],
    [3, 5, 2], [5, 4, 1], [4, 5, 1], [3, 4, 3], [5, 3, 2]
  ];

  const scoreShape = (arr) => VALID.reduce((best, v) => {
    const minLen = Math.min(v.length, arr.length);
    let diff = 0;
    for (let i = 0; i < minLen; i++) diff += Math.abs(v[i] - arr[i]);
    diff += Math.abs(v.length - arr.length) * 2;
    return Math.min(best, diff);
  }, Infinity);

  const selectKeeper = (list, orientation) => {
    if (!list.length) return null;
    // Defesa embaixo => GK com maior top; defesa em cima => menor top
    const cmp = orientation === "defense-top"
      ? (a, b) => a.top < b.top
      : (a, b) => a.top > b.top;
    return list.reduce((gk, p) => (cmp(p, gk) ? p : gk), list[0]);
  };

  const buildShape = (orientation) => {
    let list = players || [];
    if (list.length > 10) {
      const keeper = selectKeeper(list, orientation);
      list = list.filter(p => p !== keeper);
    }
    const DEF_LIMIT = FIELD_HEIGHT * (2 / 8);
    const MID_LIMIT = FIELD_HEIGHT * (5 / 8);

    let def = 0, mid = 0, att = 0;
    if (orientation === "defense-top") {
      def = list.filter(p => p.top < DEF_LIMIT).length;
      mid = list.filter(p => p.top >= DEF_LIMIT && p.top < MID_LIMIT).length;
      att = list.filter(p => p.top >= MID_LIMIT).length;
    } else {
      // defesa embaixo (padrão)
      def = list.filter(p => p.top >= MID_LIMIT).length;
      mid = list.filter(p => p.top >= DEF_LIMIT && p.top < MID_LIMIT).length;
      att = list.filter(p => p.top < DEF_LIMIT).length;
    }
    return { def, mid, att, shape: `${def}-${mid}-${att}`, orientation };
  };

  const bottomShape = buildShape("defense-bottom");
  const topShape = buildShape("defense-top");

  const arrBottom = bottomShape.shape.split("-").map(Number);
  const arrTop = topShape.shape.split("-").map(Number);
  const scoreBottom = scoreShape(arrBottom);
  const scoreTop = scoreShape(arrTop);

  return scoreBottom <= scoreTop ? bottomShape : topShape;
}

// Agrupa linhas pelo eixo Y usando quantis (não depende de limiares fixos)
function countLinesByQuantiles(players, orientation = "defense-bottom") {
  let list = players || [];
  if (list.length === 0) return { def: 0, mid: 0, att: 0, shape: "0-0-0", orientation };

  // remove goleiro
  if (list.length > 10) {
    const keeper = orientation === "defense-top"
      ? list.reduce((gk, p) => (p.top < gk.top ? p : gk), list[0])
      : list.reduce((gk, p) => (p.top > gk.top ? p : gk), list[0]);
    list = list.filter(p => p !== keeper);
  }

  if (list.length === 0) return { def: 0, mid: 0, att: 0, shape: "0-0-0", orientation };

  // ordena por top (menor = mais alto no campo)
  const sorted = [...list].sort((a, b) => a.top - b.top);
  const n = sorted.length;
  const q1Idx = Math.floor(n / 3);
  const q2Idx = Math.floor((2 * n) / 3);

  const cut1 = (sorted[q1Idx]?.top + (sorted[q1Idx + 1]?.top || sorted[q1Idx]?.top)) / 2 || sorted[q1Idx]?.top || 0;
  const cut2 = (sorted[q2Idx]?.top + (sorted[q2Idx + 1]?.top || sorted[q2Idx]?.top)) / 2 || sorted[q2Idx]?.top || 0;

  const topBand = list.filter(p => p.top < cut1);
  const midBand = list.filter(p => p.top >= cut1 && p.top < cut2);
  const bottomBand = list.filter(p => p.top >= cut2);

  let def = 0, mid = 0, att = 0;
  if (orientation === "defense-top") {
    def = topBand.length;
    mid = midBand.length;
    att = bottomBand.length;
  } else {
    // defesa embaixo (padrão)
    def = bottomBand.length;
    mid = midBand.length;
    att = topBand.length;
  }

  return { def, mid, att, shape: `${def}-${mid}-${att}`, orientation };
}

window.countLinesByQuantiles = countLinesByQuantiles;

// Aproxima shape numérico para a formação válida mais próxima
function snapToValidShape(shapeStr) {
  const VALID = [
    "4-4-2", "4-1-4-1", "4-3-3", "4-2-3-1", "4-2-4",
    "3-5-2", "5-4-1", "4-5-1", "3-4-3", "5-3-2"
  ];
  const arr = shapeStr.split("-").map(Number);
  if (arr.some(isNaN)) return shapeStr;

  const dist = (a, b) => {
    const aArr = a.split("-").map(Number);
    const len = Math.max(aArr.length, b.length);
    let d = 0;
    for (let i = 0; i < len; i++) {
      const va = aArr[i] || 0;
      const vb = b[i] || 0;
      d += Math.abs(va - vb);
    }
    return d;
  };

  let best = shapeStr;
  let bestD = Infinity;
  for (const v of VALID) {
    const d = dist(v, arr);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}


window.analyzeFieldThirds = analyzeFieldThirds;


// ======================================================
// IDENTIFICA GOLEIRO: jogador mais recuado do time
// ======================================================
function findGoalkeeper(players) {
  if (!players || players.length === 0) return null;
  // Defesa no fundo: goleiro é quem está mais abaixo (maior top)
  return players.reduce((gk, p) => (p.top > gk.top ? p : gk), players[0]);
}

window.findGoalkeeper = findGoalkeeper;


// ==============================================================
// 2) SISTEMA TÁTICO HÍBRIDO – TERÇO + ELO + VISION
// ==============================================================
function detectHybridFormation(players) {
  if (window.isTrainingMode) {
  console.log("🚫 Híbrido desativado – modo treino!");
  return window.lastVisionFormation || "4-4-2";
  }
  if (!players || players.length < 4) return "indefinido";

  // 🧤 EXCLUIR O GOLEIRO DOS CÁLCULOS TÁTICOS
  const gk = findGoalkeeper(players);
  const playersNoGK = players.filter(p => p !== gk);
  console.log("🧤 Goleiro detectado:", gk);

  // 1️⃣ TERÇOS DO CAMPO – BASE (com detecção de orientação)
  const thirds = analyzeFieldThirds(playersNoGK);
  const thirdsSnap = snapToValidShape(thirds.shape);
  console.log("📊 Terços:", thirds.shape, "snap:", thirdsSnap, "ori:", thirds.orientation);

  // 1b) Quantis — para linhas reais (evita erro quando limiar fixo falha)
  const quantLines = countLinesByQuantiles(playersNoGK, thirds.orientation);
  const quantSnap = snapToValidShape(quantLines.shape);
  console.log("📊 Linhas (quantis):", quantLines.shape, "snap:", quantSnap, "ori:", quantLines.orientation);

  // 2️⃣ ELO – SE TIVER, USA COMO VOTO (NÃO MAIS PRIORIDADE)
  const roles = detectEloFormation(playersNoGK, 60, thirds.orientation);
  let eloFormation = null;
  if (roles && Object.values(roles).some(arr => arr.length > 0)) {
    eloFormation = interpretFormation(roles);
    console.log("🧠 ELO detectado:", eloFormation);
  }

  // 🏆 VOTAÇÃO ENTRE MÉTODOS
  const votes = {};
  const VALID_FORMATIONS = [
    '4-4-2', '4-1-4-1',
    '4-3-3', '4-2-3-1',
    '4-2-4', '3-5-2',
    '5-4-1', '4-5-1',
    '3-4-3', '5-3-2'
  ];

  const addVote = (form, weight) => {
    if (form && VALID_FORMATIONS.includes(form)) {
      votes[form] = (votes[form] || 0) + weight;
    }
  };

  // 👍 TERÇOS — peso 2
  addVote(thirdsSnap, 2);

  // 👍 Quantis — peso 2
  addVote(quantSnap, 2);

  // 👍 VISION — peso 2
  addVote(window.lastVisionFormation, 2);

  // 👍 ELO — peso 1 (se existir)
  if (eloFormation) addVote(eloFormation, 1);

  console.log("📊 VOTAÇÃO:", votes);

  // 🏆 Resultado final (quem tem mais votos)
  const bestFormation = Object.keys(votes)
    .sort((a, b) => votes[b] - votes[a])[0] || "4-4-2";

  console.log("🏆 Formação escolhida por votação:", bestFormation);
  if (typeof window !== "undefined") {
    window.lastVotedFormation = bestFormation;
  }

  return bestFormation;  // <-- AGORA É O ÚNICO return!!!
}


window.detectHybridFormation = detectHybridFormation;

function clearDebugVisual() {
  document.querySelectorAll(".debug-marker, .debug-line").forEach(el => el.remove());
  console.log("🧽 Debug visual LIMPO!");
  if (debugCleanupTimer) {
    clearTimeout(debugCleanupTimer);
    debugCleanupTimer = null;
  }
}

let debugCleanupTimer = null;
// ============================================================
// DEBUG VISUAL – sem quebrar drag – compatível com ELO
// ============================================================
function debugVisual(players) {
  const field = document.getElementById("background-square");
  if (!field) return;

  // Remove debug anterior
  document.querySelectorAll(".debug-marker, .debug-line").forEach(el => el.remove());

  // Remove goleiro (mais alto) para não contaminar setores/elos
  let list = players || [];
  if (list.length > 10) {
    const keeper = list.reduce((gk, p) => (p.top > gk.top ? p : gk), list[0]); // defesa embaixo
    list = list.filter(p => p !== keeper);
  }

  const FIELD_WIDTH = field.clientWidth || 300;
  const FIELD_HEIGHT = field.clientHeight || 600;

  // 🧠 NOVA DIVISÃO DO CAMPO VERTICAL — 2/8 - 3/8 - 3/8 (top→bottom)
  const DEF_LIMIT = FIELD_HEIGHT * (2/8);  // 75px
  const MID_LIMIT = FIELD_HEIGHT * (5/8);  // 187.5px

  // === DESENHA AS NOVAS LINHAS AMARELAS ===
  [DEF_LIMIT, MID_LIMIT].forEach(y => {
    const line = document.createElement("div");
    line.className = "debug-line";
    line.style.position = "absolute";
    line.style.left = "0px";
    line.style.top = y + "px";
    line.style.width = FIELD_WIDTH + "px";
    line.style.height = "2px";
    line.style.background = "rgba(255, 255, 0, 0.7)";
    field.appendChild(line);
  });

  // === MARCA TODOS OS JOGADORES COM SETOR ===
  list.forEach(player => {
    const label =
      player.top < DEF_LIMIT ? "ATQ" :      // topo = ataque
      player.top < MID_LIMIT ? "MEI" :
      "DEF";                               // fundo = defesa

    createMarker(player, "white", label);
  });

  // === LINHA MÉDIA DA ZAGA (Se existir Elo detectado) ===
  const elo = detectEloFormation(list, 45, "defense-bottom");
  if (elo) {
    // Zaga
    if (elo.zaga && elo.zaga.length >= 2) {
      const avgY = elo.zaga.reduce((s, p) => s + p.top, 0) / elo.zaga.length;
      const lineZ = document.createElement("div");
      lineZ.className = "debug-line";
      lineZ.style.position = "absolute";
      lineZ.style.left = "0px";
      lineZ.style.top = avgY + "px";
      lineZ.style.width = FIELD_WIDTH + "px";
      lineZ.style.height = "2px";
      lineZ.style.background = "rgba(255, 0, 0, 0.6)";
      field.appendChild(lineZ);

      elo.zaga.forEach(p => createMarker(p, "red", "ZAG"));
    }

    // Meio
    if (elo.meio && elo.meio.length >= 2) {
      const avgY = elo.meio.reduce((s, p) => s + p.top, 0) / elo.meio.length;
      const lineM = document.createElement("div");
      lineM.className = "debug-line";
      lineM.style.position = "absolute";
      lineM.style.left = "0px";
      lineM.style.top = avgY + "px";
      lineM.style.width = FIELD_WIDTH + "px";
      lineM.style.height = "2px";
      lineM.style.background = "rgba(0, 0, 255, 0.6)";
      field.appendChild(lineM);

      elo.meio.forEach(p => createMarker(p, "blue", "MEI"));
    }

    // Ataque
    if (elo.ataque && elo.ataque.length >= 2) {
      const avgY = elo.ataque.reduce((s, p) => s + p.top, 0) / elo.ataque.length;
      const lineA = document.createElement("div");
      lineA.className = "debug-line";
      lineA.style.position = "absolute";
      lineA.style.left = "0px";
      lineA.style.top = avgY + "px";
      lineA.style.width = FIELD_WIDTH + "px";
      lineA.style.height = "2px";
      lineA.style.background = "rgba(0, 255, 0, 0.6)";
      field.appendChild(lineA);

      elo.ataque.forEach(p => createMarker(p, "green", "ATQ"));
    }
  }

  // === FUNÇÃO AUXILIAR ===
  function createMarker(p, color, text) {
    const el = document.createElement("div");
    el.className = "debug-marker";
    el.style.position = "absolute";
    el.style.left = p.left + "px";
    el.style.top = p.top + "px";
    el.style.padding = "2px 6px";
    el.style.borderRadius = "8px";
    el.style.background = color;
    el.style.color = "black";
    el.style.fontSize = "10px";
    el.style.transform = "translate(-50%, -50%)";
    el.style.zIndex = 9999;
    el.innerText = text;
    field.appendChild(el);
  }

  // Auto-limpa debug 6s depois
  if (debugCleanupTimer) clearTimeout(debugCleanupTimer);
  debugCleanupTimer = setTimeout(() => {
    clearDebugVisual();
    debugCleanupTimer = null;
  }, 6000);
}

// Permite usar no console:
window.debugVisual = debugVisual;

function interpretFormation(roles) {
  const z = roles.zaga?.length || 0;
  const m = roles.meio?.length || 0;
  const a = roles.ataque?.length || 0;

  // 4-1-3-2 (variação moderna do 4-4-2 losango)
  if (z === 4 && m === 3 && a === 2) return "4-1-3-2";

  // 4-3-3 clássico
  if (z === 4 && m === 3 && a === 3) return "4-3-3";

  // 4-1-4-1
  if (z === 4 && m === 4 && a === 1) return "4-1-4-1";

  // fallback moderno
  return `${z}-${m}-${a}`;
}


// ======================================================
// 🧠 ANALISAR TÁTICA (CHAMA BACKEND /ai/analyze)
// Aceita string ("4-4-2") ou objeto { opponentFormation, trainingMode }
// ======================================================
async function analyzeFormation(config) {
  let payload = {};

  if (typeof config === "string") {
    // chamada antiga: analyzeFormation("4-4-2")
    payload.opponentFormation = config;
  } else if (config && typeof config === "object") {
    // chamada nova: analyzeFormation({ opponentFormation, trainingMode })
    payload = { ...config };
  }

  payload.tacticalRoles = circleTacticalState;
  payload.room = window.currentRoomCode || null;

  const res = await fetch("https://fifa26.onrender.com/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  return data;
}



// === Função: envia imagem do campo para análise visual (IA Vision) ===
async function sendVisionTactic() {
  try {
    const canvas = document.getElementById("trace-canvas") || document.querySelector("canvas");
    if (!canvas) {
      console.warn("❌ Canvas não encontrado.");
      return;
    }

    const isVertical = canvas.height > canvas.width; // novo campo em pé
    let fieldImage = null;

    // Se o canvas está em pé, cria um canvas auxiliar rotacionado (-90º) para o backend
    // continuar enxergando no layout horizontal antigo.
    if (isVertical) {
      const aux = document.createElement("canvas");
      aux.width = canvas.height;
      aux.height = canvas.width;
      const ctxAux = aux.getContext("2d");
      ctxAux.save();
      ctxAux.translate(0, aux.height);
      ctxAux.rotate(-Math.PI / 2);
      ctxAux.drawImage(canvas, 0, 0);
      ctxAux.restore();
      fieldImage = aux.toDataURL("image/png");
    } else {
      fieldImage = canvas.toDataURL("image/png");
    }

    // Converte coordenadas (left, top) para a orientação rotacionada
    const mapPoint = (p) => {
      if (!isVertical) return p;
      const newLeft = p.top;                    // Y vira X
      const newTop = canvas.width - p.left;     // X vira Y invertido
      return { ...p, left: newLeft, top: newTop };
    };

    const possession = typeof getCurrentPossession === "function"
      ? getCurrentPossession()
      : "verde";

    const ball = typeof getBall === "function" ? getBall() : null;

    console.log("📸 Enviando imagem do campo para análise visual...");
    console.log("🖼️ fieldImage:", fieldImage.substring(0, 100));

    const green = getGuaraniPositions();
    const black = getOpponentPositions();
    const greenMapped = green.map(mapPoint);
    const blackMapped = black.map(mapPoint);
    const ballMapped = ball ? mapPoint(ball) : null;

    const res = await fetch("https://fifa26.onrender.com/ai/vision-tactic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fieldImage,
        possession,
        ball: ballMapped,
        green: greenMapped,
        black: blackMapped,
        tacticalRoles: circleTacticalState,
        orientation: isVertical ? "vertical-rotated-90" : "horizontal"
      })
    });

    const data = await res.json();
    console.log("📊 Visão Tática (backend):", data);

    // 🟡 SALVAR POSIÇÕES DO TIME ADVERSÁRIO PRA DEBUG VISUAL
	window.lastBlackPositions = black;  // black já está pegado antes no código
	
	// 🧪 🔍 DEBUG VISUAL — marca clusters, setores e zaga detectada
	if (typeof debugVisual === "function") {
	console.log("🔍 Debug Visual ativado com lastBlackPositions");
		debugVisual(window.lastBlackPositions);
	} else {
		console.warn("⚠ debugVisual() não encontrada no escopo!");
	}

    // ✅ Move o Verde pela visão da IA
    if (Array.isArray(data.green) && data.green.length > 0) {
      animateTeam("circle", data.green);

      applyDynamicBlocks(
        data.green,
        data.phase?.toLowerCase() || "defesa",
        data.opponentFormation || "4-4-2"
      );
    }

	// 🆕 Move / Atualiza o adversário visualmente
	if (Array.isArray(data.black) && data.black.length > 0) {
	animateTeam("circleOpp", data.black);  // <--- ISSO FALTAVA!
	}

    return data;
  } catch (err) {
    console.error("❌ Erro ao enviar imagem para IA Vision:", err);
  }
}

    window.animateTeam = animateTeam;
    window.getOpponentPositions = getOpponentPositions;


    // Garantir que notify é global
if (typeof window !== "undefined") {
  window.notify = notify;
}


// ====== Expor funções da IA para o FRONT ======
if (typeof window !== "undefined") {
  if (typeof sendVisionTactic === "function")     window.sendVisionTactic     = sendVisionTactic;
  if (typeof getGuaraniPositions === "function")  window.getGuaraniPositions  = getGuaraniPositions;
  if (typeof analyzeFormation === "function")     window.analyzeFormation     = analyzeFormation;
  if (typeof detectEloFormation === "function")   window.detectEloFormation  = detectEloFormation;

  console.log("⚡ Funções IA disponíveis para o front-end");
}

// ============================================================
// ANALISAR FORMAÇÃO — ENVIA PARA O BACKEND /ai/analyze
// ============================================================
async function analyzeFormation() {
  // 1) Coleta os jogadores adversários (black)
  const black = getOpponentPositions();
  if (!black || black.length === 0) {
    console.warn("❌ analyzeFormation(): sem jogadores.");
    return null;
  }

  // 2) Detecta formação TÁTICA AVANÇADA (ELO + terços + GK)
  const hybridFormation = detectHybridFormation(black);
  console.log("🧠 Formação híbrida detectada:", hybridFormation);

  // 3) Monta o body do POST — envia também tacticalRoles se tiver
  const body = {
    opponentFormationVision: hybridFormation,
    tacticalRoles: window.circleTacticalState || {},
    black,
    ball: window.lastBallPosition || {},
    room: window.currentRoomCode || null
  };

  // 4) Envia para o backend (IA)
  try {
    const response = await fetch("https://fifa26.onrender.com/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    console.log("📊 IA Analyze:", data);

    // 5) Recebe resposta e aplica reação tática
    if (data.green) {
      applyGreenPositions(data.green); // mover time verde no campo
    }

// 🔕 pop-up do treinador desativado no treino e no modo normal
// if (data.coachComment) showCoachComment(data.coachComment);

    return data;
  } catch (err) {
    console.error("Erro ao chamar /ai/analyze:", err);
    return null;
  }
}

// MOVIMENTAR TIME VERDE (RESPONDER NO CAMPO)
function applyGreenPositions(greenAI) {
  greenAI.forEach(p => {
    const el = document.getElementById("circle" + p.id);
    if (el) {
      el.style.left = p.left + "px";
      el.style.top  = p.top  + "px";
    }
  });
}

// ❌ BLOQUEADO DEFINITIVAMENTE
function showCoachComment(text) {
  console.log("🧠 coachComment BLOQUEADO:", text);
}
