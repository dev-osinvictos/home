// ==== Constantes do campo (o aprimoramento esportivo) ====
// window.FIELD_WIDTH = 600;
// window.FIELD_HEIGHT = 300;

// Usa o FIELD_WIDTH já criado no core.js
// Se não existir, usa fallback 600x300
const FIELD_WIDTH  = window.FIELD_WIDTH  ?? 600;
const FIELD_HEIGHT = window.FIELD_HEIGHT ?? 300;

// === Funções auxiliares ===
function makeVisionSnapshot() {
  const cw = 600, ch = 300;         // mesmo FIELD_WIDTH/HEIGHT do servidor
  const off = document.createElement("canvas");
  off.width = cw; off.height = ch;
  const g = off.getContext("2d");

  // === Campo básico ===
  g.fillStyle = "#2e7d32"; g.fillRect(0,0,cw,ch);         // gramado
  g.strokeStyle = "#ffffff"; g.lineWidth = 2;
  g.strokeRect(1,1,cw-2,ch-2);                             // linhas externas
  g.beginPath(); g.moveTo(cw/2,0); g.lineTo(cw/2,ch); g.stroke(); // linha do meio
  g.beginPath(); g.arc(cw/2, ch/2, 46, 0, Math.PI*2); g.stroke(); // círculo central

  // === Áreas (simplificadas) ===
  g.strokeRect(0, 75, 60, 150);                            // grande esquerda
  g.strokeRect(cw-60, 75, 60, 150);                        // grande direita
  g.strokeRect(0, 100, 20, 100);                           // pequena esquerda
  g.strokeRect(cw-20, 100, 20, 100);                       // pequena direita

  // === Coleta posições atuais ===
  const green = getGuaraniPositions();
  const black = getOpponentPositions();
  const ball  = getBall();

  // === Desenha ADVERSÁRIO (preto) ===
  g.fillStyle = "#111111";
  g.strokeStyle = "#ffffff";
  for (const p of black) {
  const invertedX = FIELD_WIDTH - (p.left - 20);  // ✅ agora p existe dentro do loop
  g.beginPath();
  g.arc(invertedX, p.top - 20, 13, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

  // === Desenha (verde claro) ===
  g.fillStyle = "#33FFCC";
  for (const p of green) {
    g.beginPath(); g.arc(p.left - 20, p.top - 20, 13, 0, Math.PI*2); g.fill();
  }

  // === Desenha BOLA ===
  g.fillStyle = "#ffffff";
  g.beginPath(); g.arc(ball.left - 20, ball.top - 20, 6, 0, Math.PI*2); g.fill();

  return off.toDataURL("image/png");
}

function getOpponentPositions() {
  const arr = [];

  for (let i = 1; i <= 11; i++) {
    const el = document.getElementById(`circle${i}`);
    if (el) {
      arr.push({
        id: i,
        left: parseInt(el.style.left || el.offsetLeft),
        top: parseInt(el.style.top || el.offsetTop)
      });
    }
  }

  return arr;
}

function getGuaraniPositions() {
  const arr = [];

  for (let i = 13; i <= 23; i++) {
    const el = document.getElementById(`circle${i}`);
    if (el) {
      arr.push({
        id: i,
        left: parseInt(el.style.left || el.offsetLeft),
        top: parseInt(el.style.top || el.offsetTop)
      });
    }
  }

  return arr;
}

  function getPositions(prefix) {
    const arr = [];
    for (let i = 2; i <= 11; i++) {
      const el = document.getElementById(prefix + i);
      if (el) {
        arr.push({
          id: i,
          left: parseInt(el.style.left || el.offsetLeft),
          top: parseInt(el.style.top || el.offsetTop)
        });
      }
    }
    return arr;
  }

  function getBall() {
    const el = document.getElementById('circle24');
    return {
      left: parseInt(el.style.left || el.offsetLeft),
      top: parseInt(el.style.top || el.offsetTop)
    };
  }

  function notify(msg, duration = 5000) {
    const n = document.getElementById('ai-notification');
    n.textContent = msg;
    n.style.display = 'block';
    clearTimeout(n.timer);
    n.timer = setTimeout(() => (n.style.display = 'none'), duration);
  }

  // === Pop-up do Careca, ===
function showAbelCommentPopup(commentText) {
  // remove instância anterior
  const old = document.getElementById("abel-comment-popup");
  if (old) old.remove();

  // cria container
  const popup = document.createElement("div");
  popup.id = "abel-comment-popup";

  // conteúdo com TÍTULO + BOTÃO FECHAR
  popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <strong style="font-size:11px;">🎙️ IA Head-coach</strong>
      <button id="close-abel-popup"
        style="background:transparent;border:none;color:#fff;font-size:14px;font-weight:bold;cursor:pointer;margin-left:8px;line-height:1;">×</button>
    </div>
    <div style="font-size:11px;line-height:1.4;text-align:justify;color:#fff;">${commentText}</div>
  `;

  // estilos inline (como os seus)
  Object.assign(popup.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    background: "rgba(0,102,204,0.95)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "10px",
    boxShadow: "0 0 10px rgba(0,0,0,0.4)",
    padding: "14px 18px",
    color: "#fff",
    fontFamily: "'Segoe UI', sans-serif",
    zIndex: "10003",
    width: "240px",
    maxWidth: "90vw",
    opacity: "0",
    transition: "opacity 0.6s ease",
    pointerEvents: "auto"
  });

  document.body.appendChild(popup);
  // fade-in
  requestAnimationFrame(() => popup.style.opacity = "1");

  // botão fechar
  popup.querySelector("#close-abel-popup").addEventListener("click", () => {
    popup.style.opacity = "0";
    setTimeout(() => popup.remove(), 500);
  });
}


// === Detecta posse de bola considerando lado do campo ===
// Guarani defende à DIREITA e ataca à ESQUERDA
function detectBallPossession(green, black, ball) {
  const field = document.getElementById('background-square');
  const rect = field.getBoundingClientRect();

  // Normaliza coordenadas para [0..FIELD_WIDTH]
  const bx = (ball.left - rect.left);
  const cx = rect.width / 2;

  // Distâncias mínimas
  const dGreen = Math.min(...green.map(p => Math.hypot(p.left - ball.left, p.top - ball.top)));
  const dBlack = Math.min(...black.map(p => Math.hypot(p.left - ball.left, p.top - ball.top)));

  // Peso leve pelo lado do campo (Verde ataca da direita->esquerda)
  const sideBias = bx > cx ? -8 : +8; // negativo favorece "verde" à esquerda

  return (dGreen + sideBias) < dBlack ? "verde" : "preto";
}

// E atualize getCurrentPossession para usar também o "black"
function getCurrentPossession() {
  const green = getGuaraniPositions();
  const black = getOpponentPositions();
  const ball  = getBall();
  return detectBallPossession(green, black, ball);
}

  // === Botão da Análise IA ===
  const aiBtn = document.getElementById('ai-analise-btn');

  aiBtn.addEventListener('click', async function() {
  aiBtn.disabled = true;
  aiBtn.textContent = "Analisando⚙️";
  notify("🤖 Careca, está avaliando o adversário e ajustando o Guarani...", 3000);

  const hudBox = document.getElementById("tactical-hud");
  const hudForm = document.getElementById("hud-formations");
  const hudPhase = document.getElementById("hud-phase");
  const hudBlock = document.getElementById("hud-block");

  try {
    const green = getGuaraniPositions(); 
    const black = getOpponentPositions();
    const ball = getBall();

    // === Detecção de posse (pela bola mais próxima) ===
    const closestGreen = Math.min(...green.map(p => Math.hypot(p.left - ball.left, p.top - ball.top)));
    const closestBlack = Math.min(...black.map(p => Math.hypot(p.left - ball.left, p.top - ball.top)));
    const fieldImage = makeVisionSnapshot();
    const possession = getCurrentPossession();

    const vision = await sendVisionTactic();
    console.log("🔎 Vision->Analyze: opponentFormationVision =", vision?.opponentFormation);

    // passa formação da visão para analyze()
    const res = await fetch("https://crflamengo.onrender.com/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        green,
        black,
        ball,
        possession,
        opponentFormationVision: vision?.opponentFormation || null
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();


    // === Atualiza HUD Tático ===
    hudForm.textContent = `Adversário: ${data.opponentFormation || "?"} | Guarani FC ${data.detectedFormation || "?"}`;
    hudPhase.textContent = `Fase: ${data.phase?.toUpperCase() || "?"}`;
    hudBlock.textContent = `Bloco: ${data.bloco || (data.phase === "ataque" ? "ALTO" : "BAIXO")} | Compactação: ${data.compactacao || "?"}`;
    hudBox.style.display = "block";
    hudBox.style.background = possession === "verde"
      ? "rgba(0,128,0,0.8)"
      : "rgba(50,50,50,0.8)";
    hudBox.style.borderColor = possession === "verde" ? "#00ff66" : "#999";
    hudBox.style.opacity = "1";

    // === Movimenta o para a nova formação sugerida pela IA Vision ===
if (data.green && data.detectedFormation && data.opponentFormation) {
  const fromFormation = FORMATIONS[data.lastFormation || "4-4-2"];
  const toFormation = FORMATIONS[data.detectedFormation || "4-3-3"];
  const phase = (data.phase || "transicao").toLowerCase();

  if (fromFormation && toFormation) {
    animateFormationTransition("circle", fromFormation, toFormation, phase);
  } else {
    animateTeam("circle", data.green, () => {
      applyDynamicBlocks(data.green, phase, data.opponentFormation);
    }, phase);
  }

  // Atualiza a referência da última formação
  data.lastFormation = data.detectedFormation;
}

    
    try {
      window.dispatchEvent(new CustomEvent("ia:analyze:done", { detail: data }));
    } catch(e) { console.warn("ia:analyze:done dispatch falhou", e); }


// === Exibe o comentário do Careca ===
if (data.coachComment) {
  // Se o comentário contém "Google Vision", atrasa 8.5s
  const delay = data.coachComment.includes("Google Vision") ? 8500 : 0;

  setTimeout(() => {
    showAbelCommentPopup(data.coachComment);
  }, delay);
}


    return data;

  } catch (err) {
    console.error("AI analyze error:", err);
    notify("❌ Erro na análise da IA!", 4000);
  } finally {
    aiBtn.disabled = false;
    aiBtn.textContent = "Análise IA";
    setTimeout(() => (hudBox.style.opacity = "0"), 15000);
  }
});
