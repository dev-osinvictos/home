const coachChat     = document.getElementById('chat-container');
const chatHeader    = document.getElementById('chat-header');
const chatBody      = document.getElementById('chat-body');
const chatInputArea = document.getElementById('chat-input-area');
const chatInput     = document.getElementById('chat-input');
const chatSend      = document.getElementById('chat-send');

// === Layout padrão do chat (conversa para aprimoramento esportivo) ===
const DEFAULT_CHAT_STYLE = {
  position: "fixed",
  bottom: "20px",
  right: "50px",
  left: "",
  top: "",
  width: "300px",
  height: "70vh"
};

function dockChat() {
  Object.assign(coachChat.style, DEFAULT_CHAT_STYLE);
  chatBody.style.display = "block";
  chatInputArea.style.display = "flex";
  chatOpen = true;
}

let chatOpen = false;

function openChat() {
  dockChat();
}

function minimizeChat() {
  // diminui o container (visual do header apenas)
  coachChat.style.height = "48px";     // ✅ só cabeçalho
  chatBody.style.display = "none";      // esconde histórico
  chatInputArea.style.display = "none"; // esconde input
  chatOpen = false;
}


// ✅ inicia minimizado
minimizeChat();

chatHeader.addEventListener("click", () => {
  if (chatOpen) minimizeChat();
  else openChat();
});


// ----------------------------------------------------
// 3. Funções de Chat e API (Permanece quase igual)
// ----------------------------------------------------
const url_render = 'https://guaranifc.onrender.com';

function appendMessage(sender, text){
    // ... (sua função appendMessage)
    const msg = document.createElement("div");
    msg.style.marginBottom = "8px";
    msg.innerHTML = sender === "user"
        ? `<div style="text-align:right;"><span style="background:#0066cc;padding:6px 10px;border-radius:8px;display:inline-block;">${text}</span></div>`
        : `<div style="text-align:left;"><span style="background:#333;padding:6px 10px;border-radius:8px;display:inline-block;">${text}</span></div>`;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
}

chatSend.addEventListener("click", async ()=>{
  const message = chatInput.value.trim();
  if (!message) return;

  appendMessage("user", message);
  chatInput.value = "";

  try {

    const res = await fetch(`https://guaranifc.onrender.com/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    appendMessage("bot", data.reply || "O Careca, ficou em silêncio...");
    
    // ✅ Depois da resposta: volta ao estado original (aberto e dockado)
    dockChat();
    chatBody.scrollTop = chatBody.scrollHeight;
    
    // ✅ Se o Careca, retornou uma formação, aciona IA Tática
    if (data.formationRequested){
      console.log("⚽ Comando tático do chat:", data.formationRequested);
      window.dispatchEvent(new CustomEvent("coach:help-requested"));

fetch(`${url_render}/ai/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        manualFormation: data.formationRequested,
        possession: "vermelho",
        opponentFormationVision: null
    })
})
.then(res => res.json())
.then(result => {
  // === Bloqueia interações e aplica fade no campo ===
  const field = document.getElementById("background-square");
  if (field) {
    document.body.style.pointerEvents = "none";
    field.style.transition = "opacity 0.3s ease";
    field.style.opacity = "0.8";
  }

  // === O bloco de formação (mantém seu código atual) ===
  if (result.green) {
    console.log("🎯 Treinador solicitou nova formação:", data.formationRequested);
    const formationKey = data.formationRequested || result.detectedFormation || "4-4-2";
    const formationBase = window.FORMATIONS?.[formationKey];
    const formationPositions = (formationBase || []).map(p => ({
      id: p.id,
      left: (p.prefferedZone && p.prefferedZone[0]) || (p.left ?? 300),
      top: (p.prefferedZone && p.prefferedZone[1]) || (p.top ?? 150)
    }));

    const prevKey = window.lastFormation || null;
    if (prevKey && window.FORMATIONS && window.FORMATIONS[prevKey]) {
      try {
        animateFormationTransition(
          "circle",
          window.FORMATIONS[prevKey],
          window.FORMATIONS[formationKey],
          (result.phase || "transicao").toLowerCase()
        );
      } catch (err) {
        console.warn("animateFormationTransition falhou, fallback para animateTeam:", err);
        animateTeam("circle", formationPositions);
      }
    } else {
      animateTeam("circle", formationPositions);
    }

    const phase = (result.phase || "transicao").toLowerCase();
    applyDynamicBlocks(formationPositions, phase, result.opponentFormation || "4-4-2");

    const hud = document.getElementById("hud-formations");
    if (hud) hud.innerText = `Adversário: ${result.opponentFormation || "?"} | Guarani FC: ${formationKey}`;
    window.lastFormation = formationKey;
  }

  // === Libera interações e restaura opacidade ===
  setTimeout(() => {
    if (field) field.style.opacity = "1";
    document.body.style.pointerEvents = "auto";
  }, 500);
})
.catch(e => {
  appendMessage("bot", "Erro de comunicação com o Careca.");
  console.error(e);
});


chatInput.addEventListener("keydown", (e)=>{
  if(e.key === "Enter"){
    chatSend.click();
  }
});

let lastGoalTime = 0;

window.addEventListener("goal:scored", (ev) => {
  const now = Date.now();
  if (now - lastGoalTime < 2000) return; // evita spam de gol
  lastGoalTime = now;

  appendMessage("bot", "GOOOOOOOOOOOOOOOOOL DO BUGRE!!! 💚⚽");
});


// expande o chat quando o teclado aparece (mobile)
chatInput.addEventListener("focus", () => {
  openChat();
  setTimeout(() => {
    chatBody.scrollTop = chatBody.scrollHeight;
  }, 350);
});

let keyboardMode = false;

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    if (!chatOpen) return;

    const viewportH = window.visualViewport.height;
    const totalH = window.innerHeight;
    const kbHeight = totalH - viewportH;
    const keyboardOpen = kbHeight > 120; // limiar típico

    if (keyboardOpen) {
      keyboardMode = true;
      // ocupa área útil acima do teclado
      Object.assign(coachChat.style, {
        position: "fixed",
        left: "0px",
        right: "0px",
        top: "0px",
        bottom: kbHeight + "px",
        width: "100vw",
        height: viewportH + "px"
      });
      chatBody.style.height = (viewportH - 90) + "px";
    } else if (keyboardMode) {
      keyboardMode = false;
      // ✅ teclado fechou → volta ao dock padrão
      dockChat();
    }
  });
}

