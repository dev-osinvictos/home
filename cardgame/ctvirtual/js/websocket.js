const socket = io("https://fifa26.onrender.com", {
  transports: ["websocket"],   //  fix --force; força WS, evita polling
  secure: true,
  reconnection: true
});

window.socket = socket;


socket.on("connect", () => {
  console.log("📡 Conectado ao servidor WebSocket");

  // ⚠️ NUNCA zere o PIN aqui!
  // Se já tem um PIN (ex.: a aba reconectou), reentra automaticamente.
  if (window.currentRoomCode) {
    console.log("🔄 Reentrando na sala privada:", window.currentRoomCode);
    socket.emit("join-room", window.currentRoomCode);
  }
});


  socket.on("disconnect", () => {
    console.log("🔌 Desconectado do servidor");
  });

  // 🔴 Quando o servidor emitir uma nova análise tática
  socket.on("tactical-analysis", (data) => {
    console.log("📊 Atualização tática recebida:", data);

    // Atualiza jogadores (ex: time verde/red)
    if (data.red) {
      for (const p of data.red) {
        const el = document.getElementById("circle" + p.id);
        if (el) {
          el.style.transition = "left 1s ease, top 1s ease";
          el.style.left = p.left + "px";
          el.style.top = p.top + "px";
        }
      }
    }
  });

// === Live Sync ** RECEBE MOVIMENTO DE JOGADORES DA SALA PRIVADA ===
socket.on("player-move", (data) => {

  console.log("🔔 RECEBIDO player-move:", data);

  // ignorar eventos da sala pública
  if (!window.currentRoomCode || data.room !== window.currentRoomCode) {
    console.log("⛔ ignorado (sala diferente)");
    return;
  }

  const el = document.getElementById(data.id);
  if (!el) {
    console.warn("❓ elemento não encontrado:", data.id);
    return;
  }

  // ❌ Nunca mover o goleiro do Guarani (circle23) via socket
  if (data.id === "circle23" || data.id === 23) {
    el.style.left = "181px";
    el.style.top = "15px";
    el.style.setProperty("left", "181px", "important");
    el.style.setProperty("top", "15px", "important");
    return;
  }

  el.style.left = data.left + "px";
  el.style.top  = data.top  + "px";
});

// ==== RECEBE path_draw da sala ====
socket.on("path_draw", (data) => {

  if (!window.currentRoomCode || data.room !== window.currentRoomCode) {
    console.log("⛔ path ignorado (outra sala)");
    return;
  }

  const canvas = document.getElementById("trace-canvas");
  const ctx = canvas.getContext("2d");

  ctx.beginPath();
  for (let i = 0; i < data.path.length; i++) {
      const [x, y] = data.path[i];
      (i === 0 ? ctx.moveTo : ctx.lineTo)(x, y);
  }
  ctx.strokeStyle = "#ff3333";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.closePath();
});


socket.on("ball-move", (data) => {
  if (data.room !== window.currentRoomCode) return;
  const el = document.getElementById(data.id);
  if (el) {
    el.style.transition = "left 0.2s linear, top 0.2s linear";
    el.style.left = data.left + "px";
    el.style.top = data.top + "px";
  }
  // ✅ GOLEIRO FIXO NA PEQUENA ÁREA SUPERIOR
  const gk = document.getElementById("circle23");
  if (gk) {
    gk.style.transition = "none";
    gk.style.left = "181px";
    gk.style.top = "15px";
    gk.style.setProperty("left", "181px", "important");
    gk.style.setProperty("top", "15px", "important");
  }
});

// ✅ Quando entrar na sala, atualiza o indicador
socket.on("joined-room", (roomCode) => {
  console.log("✅ Joined-room:", roomCode);
  window.currentRoomCode = roomCode; // garante PIN global sincronizado

  const box = document.getElementById("room-user-indicator");
  const title = document.getElementById("room-user-title");
  if (box) box.style.display = "flex";
  if (title) title.textContent = `🔐 CT ${roomCode} 👥 1`;
  else if (box) box.textContent = `🔐 CT ${roomCode} 👥 1`;
  if (typeof renderRoomPot === "function") renderRoomPot();
});

// ✅ Quando o servidor mandar o total de pessoas conectadas
socket.on("room-user-count", (total) => {
  const box = document.getElementById("room-user-indicator");
  const title = document.getElementById("room-user-title");
  if (box) box.style.display = "flex";
  if (title) title.textContent = `🔐 CT ${window.currentRoomCode || ""} 👥 ${total}`;
  else if (box) box.textContent = `🔐 CT ${window.currentRoomCode || ""} 👥 ${total}`;
});

socket.on("supertrunfo-result", (data) => {
  const rules = data.ruleset || "4 quesitos: tática(3pts) + vitórias + ano recente + clubes";
  const card1 = data.yourCard || data.p1?.card || {};
  const card2 = data.enemyCard || data.p2?.card || {};
  const scores = data.scores || {};
  const sc1 = scores.p1 || scores.you || {};
  const sc2 = scores.p2 || scores.opponent || {};

  const breakdown = scores ? `
    ⚖️ Total: ${sc1.total || 0} x ${sc2.total || 0}
    🎯 Tático: ${sc1.tactical || 0} x ${sc2.tactical || 0}
    ✅ Vitórias: ${sc1.wins || 0} x ${sc2.wins || 0}
    📅 Ano título: ${sc1.title_year || 0} x ${sc2.title_year || 0}
    👔 Clubes: ${sc1.club_career || 0} x ${sc2.club_career || 0}
  ` : "";

  const msg = `
    🎮 SUPER-TRUNFO RESULTADO\n
    Card 1: ${card1.name || "?"}
    Card 2: ${card2.name || "?"}
    Regras: ${rules}${breakdown}
    🏆 VENCEDOR: ${data.winner}
  `;
  alert(msg);
});
