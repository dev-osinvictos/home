  socket.on("connect", () => {
    console.log("📡 Conectado ao servidor WebSocket");
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

// === Sincroniza jogadores em tempo real ===
socket.on("player-move", (data) => {
  const el = document.getElementById(data.id);
  if (el) {
    el.style.transition = "left 0.3s linear, top 0.3s linear";
    el.style.left = data.left + "px";
    el.style.top = data.top + "px";
  }
});

socket.on("ball-move", (data) => {
  const el = document.getElementById(data.id);
  if (el) {
    el.style.transition = "left 0.2s linear, top 0.2s linear";
    el.style.left = data.left + "px";
    el.style.top = data.top + "px";
  }
  // ✅ GOLEIRO DO PALMEIRAS SEGUE A BOLA NO EIXO Y
  const gk = document.getElementById("circle23");
  if (gk) {
    const targetY = data.top - 20; // ajusta centralização visual
    gk.style.left = "565px";       // fixa na trave (lado direito, seu campo é 600px)
    gk.style.transition = "top 0.25s ease-out";
    gk.style.top = `${targetY}px`;
  }
});
