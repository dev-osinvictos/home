// Lista global de cards conquistados
window.NFT_LIST = window.NFT_LIST || [];

const LOGIN_URL = "../login.html"; // ajuste se houver rota específica
const STORAGE_KEY = "ctv-stored-cards";
const LIST_KEY = "ctv-nft-list-cache";
const baseCards = [
  { id: 1, formation: "4-3-3" },
  { id: "1s", formation: "4-3-3", rarity: "signature" },
  { id: 2, formation: "4-3-3" },
  { id: 3, formation: "4-3-3" },
  { id: 4, formation: "4-3-3" },
  { id: 5, formation: "4-2-3-1" },
  { id: 6, formation: "3-4-3" },
  { id: 7, formation: "4-3-3" },
  { id: 8, formation: "3-4-3" }
];
const SIGNATURE_ELIGIBLE = new Set(["1"]);
const SIGNATURE_POWER_IDS = new Set(["1s"]);
const SIGNATURE_AD_URL = "https://pl28253335.effectivegatecpm.com/3c/b6/ab/3cb6ab24c18d774fcdba91549d345c7d";
const SIGNATURE_REQUIRED_VIEWS = 2;

const ui = {
  actionMenu: null,
  actionTitle: null,
  actionFeedback: null,
  loginModal: null,
  shareMenu: null,
  loginEmail: null,
  loginPassword: null,
  shareSelect: null,
  signatureModal: null,
  signatureProgress: null,
  signatureWatch: null,
  signatureClose: null,
  previewModal: null,
  previewImg: null
};

let selectedCardId = null;
let selectedCardImg = null;
let potCountdownTimer = null; // legado (timer removido)
let potCountdownValue = 0;
let potWaitTimeout = null;
let potHandshakeResolving = false;
window.cardPotActive = window.cardPotActive || false;
window.roomPotConfirmers = window.roomPotConfirmers || {};
let lastConfirmTs = 0;
const potChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("ctv-pot") : null;
window.roomPotOwners = window.roomPotOwners || {};
let touchCardId = null;
let signatureViews = 0;
let signatureTargetCard = null;

function getRoomConfirmers() {
  const key = getRoomKey();
  if (!window.roomPotConfirmers[key]) {
    window.roomPotConfirmers[key] = new Set();
  }
  return window.roomPotConfirmers[key];
}

function setPotActive(active) {
  window.cardPotActive = !!active;
  const aiBtn = document.getElementById("ai-analise-btn");
  if (aiBtn) {
    aiBtn.style.background = active ? "#c0392b" : "#1E90FF";
  }
  const evtName = active ? "pot:active" : "pot:inactive";
  window.dispatchEvent(new CustomEvent(evtName));
}

function addConfirmer(id) {
  if (!id) return;
  const set = getRoomConfirmers();
  set.add(id);
  lastConfirmTs = Date.now();
}

function emitPotEvent(type, payload) {
  const data = { type, ...payload };
  if (window.socket) {
    window.socket.emit(type, payload);
  }
  if (potChannel) {
    potChannel.postMessage({ room: payload?.room || null, ...data });
  }
}

function normalizeCardId(id) {
  return String(id).trim();
}

function dedupeIds(list = []) {
  const set = new Set(list.map(normalizeCardId));
  return Array.from(set);
}

function getSignatureUpgradeId(cardId) {
  const normalized = normalizeCardId(cardId);
  return SIGNATURE_ELIGIBLE.has(normalized) ? `${normalized}s` : null;
}

function isSignatureCard(cardId) {
  const normalized = normalizeCardId(cardId).toLowerCase();
  return SIGNATURE_POWER_IDS.has(normalized) || normalized.endsWith("s");
}

function persistList() {
  window.NFT_LIST = dedupeIds(window.NFT_LIST);
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(window.NFT_LIST));
  } catch (err) {
    console.warn("Não foi possível salvar a lista localmente:", err);
  }
  if (typeof window.saveUserCards === "function") {
    window.saveUserCards(window.NFT_LIST);
  }
}

function hydrateListFromStorage() {
  const email = (typeof window.getLoggedUser === "function" ? window.getLoggedUser()?.email : null) || localStorage.getItem("user_email") || null;
  let source = [];
  if (email && typeof window.getUserCards === "function") {
    source = window.getUserCards();
  } else {
    try {
      source = JSON.parse(localStorage.getItem(LIST_KEY) || "[]");
    } catch (err) {
      console.warn("Erro ao ler cache de cards:", err);
      source = [];
    }
  }
  window.NFT_LIST = dedupeIds(source);
}

function renderNFTList() {
  const body = document.getElementById("nft-list-body");
  const countEl = document.getElementById("nft-count");
  if (countEl) countEl.textContent = window.NFT_LIST.length;
  if (!body) return;
  body.innerHTML = "";
  window.NFT_LIST.forEach((cardId) => {
    const link = document.createElement("button");
    link.type = "button";
    link.className = "nft-card";
    link.title = `Card ${cardId} – abrir ações`;
    link.setAttribute("aria-label", `Card ${cardId}`);
    link.dataset.cardId = cardId;
    const img = document.createElement("img");
    img.src = getCardImageUrl(cardId);
    img.alt = `Card ${cardId}`;
    img.loading = "lazy";

    link.addEventListener("click", (e) => {
      e.preventDefault();
      openCardActions(cardId, img.src);
    });

    link.appendChild(img);
    body.appendChild(link);
  });

  registerCardInteractivity();
}

function getCardImageUrl(cardId) {
  return `./cards/${cardId}.png`;
}

// === POT DE APOSTAS NA SALA PRIVADA ===
function getRoomKey() {
  return window.currentRoomCode || "public";
}

function getRoomPot() {
  window.roomCardPot = window.roomCardPot || {};
  const key = getRoomKey();
  window.roomCardPot[key] = window.roomCardPot[key] || [];
  return window.roomCardPot[key];
}

function getRoomOwners() {
  const key = getRoomKey();
  window.roomPotOwners[key] = window.roomPotOwners[key] || {};
  return window.roomPotOwners[key];
}

function setPotOutline(active) {
  const target = document.getElementById("room-user-indicator");
  if (!target) return;
  target.style.outline = active ? "2px dashed #ffd700" : "";
}

function isTouchInsidePot(touch) {
  const target = document.getElementById("room-user-indicator");
  if (!target || !touch) return false;
  const rect = target.getBoundingClientRect();
  const { clientX: x, clientY: y } = touch;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function dropCardIntoPot(cardId, ownerId = window.socket?.id || "local") {
  if (!cardId) return;
  addCardToPot(cardId, ownerId);
  if (typeof notify === "function") {
    notify(`Card ${cardId} pronto para apostar. Clique OK para sinalizar.`, 2200);
  }
  // apenas sincroniza o card; sem ativar alerta vermelho ainda
  emitPotEvent("card-pot-added", {
    room: window.currentRoomCode || null,
    cardId,
    cardIds: [cardId],
    confirmed: false,
    by: ownerId
  });
  collapseNFTList();
}

function attachCardHandlers(el) {
  el.setAttribute("draggable", "true");
  el.addEventListener("dragstart", (e) => {
    const id = el.dataset.cardId;
    e.dataTransfer.setData("text/card-id", id);
    e.dataTransfer.effectAllowed = "copyMove";
  });

  // Suporte a arrastar para o pote em telas touch (ex.: Android)
  el.addEventListener(
    "touchstart",
    () => {
      touchCardId = el.dataset.cardId;
      setPotOutline(true);
    },
    { passive: true }
  );

  el.addEventListener(
    "touchmove",
    (e) => {
      if (!touchCardId) return;
      const touch = e.changedTouches?.[0];
      setPotOutline(isTouchInsidePot(touch));
    },
    { passive: true }
  );

  el.addEventListener(
    "touchend",
    (e) => {
      const touch = e.changedTouches?.[0];
      const inside = isTouchInsidePot(touch);
      setPotOutline(false);
      if (touchCardId && inside) {
        e.preventDefault();
        e.stopPropagation();
        dropCardIntoPot(touchCardId);
      }
      touchCardId = null;
    },
    { passive: false }
  );

  el.addEventListener(
    "touchcancel",
    () => {
      setPotOutline(false);
      touchCardId = null;
    },
    { passive: true }
  );
}

function registerCardInteractivity() {
  const body = document.getElementById("nft-list-body");
  if (!body) return;
  Array.from(body.querySelectorAll(".nft-card")).forEach((el) => attachCardHandlers(el));
}

function addCardToPot(cardId, ownerId = null) {
  const pot = getRoomPot();
  const normalized = normalizeCardId(cardId);
  if (!pot.includes(normalized)) {
    pot.push(normalized);
    const owners = getRoomOwners();
    owners[normalized] = ownerId || owners[normalized] || "desconhecido";
  }
  renderRoomPot();
  maybeResolvePot();
}

function maybeResolvePot() {
  const pot = getRoomPot();
  if (potHandshakeResolving) return;
  if (pot.length < 2) return;
  if (!window.cardPotActive) return;

  // se já houve OK e há 2 cards, resolve rápido
  resolvePotLocally();
}

function renderRoomPot() {
  const pot = getRoomPot();
  const potListEl = document.getElementById("room-pot-list");
  const titleEl = document.getElementById("room-user-title");
  if (potListEl) potListEl.textContent = pot.length ? pot.join(", ") : "(vazio)";
  if (titleEl && window.currentRoomCode) titleEl.textContent = `🔐 CT ${window.currentRoomCode}`;
  const statusEl = document.getElementById("room-pot-status");
  if (statusEl) statusEl.textContent = pot.length ? `${pot.length} CARD APOSTADO!` : "";
  const timerEl = document.getElementById("room-pot-timer");
  if (timerEl) timerEl.textContent = "";

  // mantém cor do botão conforme estado atual (sem ativar por ter card no pot)
  setPotActive(window.cardPotActive);
}
window.renderRoomPot = renderRoomPot;

function clearPotState(broadcast = false) {
  const key = getRoomKey();
  window.roomCardPot[key] = [];
  if (window.roomPotConfirmers[key]) {
    window.roomPotConfirmers[key].clear();
  }
  if (window.roomPotOwners[key]) {
    window.roomPotOwners[key] = {};
  }
  setPotActive(false);
  potHandshakeResolving = false;
  if (potCountdownTimer) clearInterval(potCountdownTimer);
  potCountdownTimer = null;
  potCountdownValue = 0;
  if (potWaitTimeout) clearTimeout(potWaitTimeout);
  potWaitTimeout = null;
  lastConfirmTs = 0;
  const statusEl = document.getElementById("room-pot-status");
  if (statusEl) statusEl.textContent = "";
  renderRoomPot();

  if (broadcast) {
    emitPotEvent("card-pot-reset", {
      room: window.currentRoomCode || null,
      by: window.socket?.id || "local"
    });
  }
}

function setupRoomPotDrop() {
  const target = document.getElementById("room-user-indicator");
  if (!target) return;

  target.addEventListener("dragover", (e) => {
    e.preventDefault();
    target.style.outline = "2px dashed #ffd700";
  });
  target.addEventListener("dragleave", () => {
    target.style.outline = "";
  });
  target.addEventListener("drop", (e) => {
    e.preventDefault();
    target.style.outline = "";
    const cardId = e.dataTransfer.getData("text/card-id");
    if (cardId) dropCardIntoPot(cardId);
  });

  const okBtn = document.getElementById("room-pot-ok");
  if (okBtn) {
    okBtn.addEventListener("click", () => {
      confirmRoomPot();
    });
  }
}

function resolvePotLocally() {
  const pot = getRoomPot();
  const confirmers = getRoomConfirmers();
  if (pot.length < 2) return; // precisa de 2 para fechar handshake
  if (confirmers.size < 2) return; // precisa de 2 confirmações
  if (potHandshakeResolving) return;
  potHandshakeResolving = true;
  setPotActive(true);

  const statusEl = document.getElementById("room-pot-status");
  // simples comparação: maior formação numérica vence (fallback)
  const numeric = (c) => parseInt(String(c).replace(/\D/g, ""), 10) || 0;
  const sorted = [...pot].sort((a, b) => numeric(b) - numeric(a));
  const winnerCard = sorted[0];
  const loserCards = sorted.slice(1);
  const owners = getRoomOwners();
  const myId = window.socket?.id || "local";
  const myCards = pot.filter((id) => owners[normalizeCardId(id)] === myId);
  const iWon = myCards.includes(winnerCard);
  const myLosingCard = myCards.find((c) => c !== winnerCard) || myCards[0];
  const collectedCards = [winnerCard, ...loserCards];
  const conqueredCard = loserCards[0] || winnerCard;

  if (statusEl) statusEl.textContent = `Resultado: Card ${winnerCard} venceu`;

  let msg;
  if (iWon) {
    msg = "Venceu! CARD CONQUISTADO.";
    collectedCards.forEach((id) => window.addCardToNFTList?.(id));
  } else if (myLosingCard) {
    msg = "Perdeu! ESTE CARD VENCEU.";
    window.removeCardFromList?.(myLosingCard);
  } else {
    msg = loserCards.length
      ? `Card ${winnerCard} venceu a aposta contra ${loserCards.join(", ")}!`
      : `Card ${winnerCard} conquistado!`;
  }

  if (typeof window.showVictoryOverlay === "function") {
    const front = iWon ? conqueredCard : winnerCard;
    const back = iWon ? winnerCard : (myLosingCard || loserCards[0] || winnerCard);
    window.showVictoryOverlay(msg, front, back);
  }

  if (window.socket) {
    window.socket.emit("card-pot-result", {
      room: window.currentRoomCode || null,
      winner: "player",
      winnerCard,
      pot
    });
  }

  clearPotState(true);
  potHandshakeResolving = false;
}

function confirmRoomPot() {
  const pot = getRoomPot();
  if (!pot.length) {
    notify?.("⚠️ Nenhum card no pote.", 2000);
    return;
  }
  addConfirmer(window.socket?.id || "local");
  const statusEl = document.getElementById("room-pot-status");
  if (statusEl) statusEl.textContent = pot.length < 2 ? "Aguardando adversário..." : "Fechando aposta...";
  if (potCountdownTimer) {
    clearInterval(potCountdownTimer);
    potCountdownTimer = null;
  }
  if (potWaitTimeout) clearTimeout(potWaitTimeout);

  emitPotEvent("card-pot-confirm", {
    room: window.currentRoomCode || null,
    cards: pot,
    by: window.socket?.id || "local"
  });
  // reaproveita o evento que já sabemos que o servidor propaga
  emitPotEvent("card-pot-added", {
    room: window.currentRoomCode || null,
    cardId: pot[0],
    cardIds: pot,
    confirmed: true,
    by: window.socket?.id || "local"
  });
  // ativa modo vermelho global somente na confirmação
  emitPotEvent("card-pot-alert", { room: window.currentRoomCode || null, by: window.socket?.id || "local" });
  setPotActive(true);

  // Se já houver 2+ cards no pote, fecha na hora
  if (pot.length >= 2) {
    resolvePotLocally();
  }
}
window.confirmRoomPot = confirmRoomPot;

function getCollectedKey() {
  const email =
    (typeof window.getLoggedUser === "function" ? window.getLoggedUser()?.email : null) ||
    localStorage.getItem("user_email") ||
    "anon";
  return `ctv-collected-${email}`;
}

function removeFromCollected(cardId) {
  const key = getCollectedKey();
  const current = Array.isArray(window.collectedCards) ? window.collectedCards : [];
  const normalized = normalizeCardId(cardId);
  const updated = current.filter((c) => normalizeCardId(c) !== normalized);
  window.collectedCards = updated;
  try {
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.warn("Não foi possível salvar collectedCards:", err);
  }
  window.dispatchEvent(new CustomEvent("cards:changed"));
}

function replaceCardInList(oldId, newId) {
  if (!oldId || !newId) return;
  const oldNorm = normalizeCardId(oldId);
  const newNorm = normalizeCardId(newId);
  let updated = window.NFT_LIST.map((id) => (normalizeCardId(id) === oldNorm ? newNorm : id));
  if (!updated.includes(newNorm)) updated.push(newNorm);
  window.NFT_LIST = dedupeIds(updated);
  persistList();
  renderNFTList();
  window.dispatchEvent(new CustomEvent("cards:changed"));
}
window.replaceCardInList = replaceCardInList;

window.addCardToNFTList = function addCardToNFTList(cardId) {
  if (!cardId) return;
  const normalized = normalizeCardId(cardId);
  if (!window.NFT_LIST.includes(normalized)) {
    window.NFT_LIST.push(normalized);
    persistList();
    renderNFTList();
    window.dispatchEvent(new CustomEvent("cards:changed"));
  }

  registerCardInteractivity();
};

function handlePotAdded(data) {
  if (!data) return;
  if (data.room && window.currentRoomCode && data.room !== window.currentRoomCode) return;
  const incomingCards = [];
  if (data.cardIds && Array.isArray(data.cardIds)) {
    incomingCards.push(...data.cardIds);
  } else if (data.cardId) {
    incomingCards.push(data.cardId);
  }
  if (incomingCards.length) {
    incomingCards.forEach((id) => addCardToPot(id, data.by || "remoto"));
    if (data.confirmed) setPotActive(true);
    if (data.confirmed) addConfirmer(data.by || "remoto");
    const statusEl = document.getElementById("room-pot-status");
    if (statusEl && !statusEl.textContent) statusEl.textContent = "Card aguardando aposta...";
    if (data.confirmed) {
      setPotActive(true);
      if (statusEl) statusEl.textContent = "Aposta iniciada. Aguarde adversário.";
    }
    notify?.(`Card${incomingCards.length > 1 ? "s" : ""} ${incomingCards.join(", ")} colocado(s) no pot do CT ${data.room || "público"}.`, 2000);
    maybeResolvePot();
  }
}

function handlePotAlert(data) {
  if (data?.room && window.currentRoomCode && data.room !== window.currentRoomCode) return;
  setPotActive(true);
  if (data?.by) addConfirmer(data.by);
  const statusEl = document.getElementById("room-pot-status");
  if (statusEl && !statusEl.textContent) statusEl.textContent = "Aguardando adversário...";
  if (statusEl && data?.by === (window.socket?.id || "local")) {
    statusEl.textContent = "Aposta iniciada! Arrasta um CARD para combater.";
  }
}

function handlePotConfirm(data) {
  if (data?.room && window.currentRoomCode && data.room !== window.currentRoomCode) return;
  const statusEl = document.getElementById("room-pot-status");
  if (statusEl) statusEl.textContent = "Adversário confirmou. Complete o pote!";
  setPotActive(true);
  addConfirmer(data?.by || "remoto");

  if (Array.isArray(data?.cards)) {
    data.cards.forEach((id) => addCardToPot(id));
  }

  maybeResolvePot();
}

function handlePotResult(data) {
  if (!data) return;
  const { winner, cardId, winnerCard, pot } = data;
  if (data.room && window.currentRoomCode && data.room !== window.currentRoomCode) return;
  const statusEl = document.getElementById("room-pot-status");
  if (statusEl) statusEl.textContent = `Resultado: ${winnerCard || cardId || "?"}`;
  const winning = winnerCard || cardId;
  const owners = getRoomOwners();
  const myId = window.socket?.id || "local";
  const myCards = Array.isArray(pot) ? pot.filter((id) => owners[normalizeCardId(id)] === myId) : [];
  const iWon = winning && myCards.includes(winning);
  const myLosingCard = myCards.find((c) => c !== winning) || myCards[0];
  const losers = Array.isArray(pot) ? pot.filter((c) => c !== winning) : [];
  const conqueredCard = losers[0] || winning;

  if (winning && typeof window.showVictoryOverlay === "function") {
    let msg;
    if (iWon) {
      msg = "Venceu! CARD CONQUISTADO.";
      window.addCardToNFTList?.(winning);
    } else if (myLosingCard) {
      msg = "Perdeu! ESTE CARD VENCEU.";
      window.removeCardFromList?.(myLosingCard);
    } else {
      msg = losers.length ? `Card ${winning} venceu a aposta contra ${losers.join(", ")}` : `Card ${winning} conquistado!`;
    }
    const front = iWon ? conqueredCard : winning;
    const back = iWon ? winning : (myLosingCard || losers[0] || winning);
    window.showVictoryOverlay(msg, front, back);
  }
  clearPotState(true);
}

// Recebe resultado de aposta via socket (se implementado no backend)
if (window.socket) {
  window.socket.on("card-pot-added", handlePotAdded);
  window.socket.on("card-pot-alert", handlePotAlert);
  window.socket.on("card-pot-confirm", handlePotConfirm);
  window.socket.on("card-pot-result", handlePotResult);
  window.socket.on("card-pot-reset", (data) => {
    if (data?.room && window.currentRoomCode && data.room !== window.currentRoomCode) return;
    clearPotState(false);
  });
}

// Fallback cross-aba/local via BroadcastChannel
if (potChannel) {
  potChannel.onmessage = (ev) => {
    const data = ev.data || {};
    if (data.room && window.currentRoomCode && data.room !== window.currentRoomCode) return;
    switch (data.type) {
      case "card-pot-added":
        handlePotAdded(data);
        break;
      case "card-pot-alert":
        handlePotAlert(data);
        break;
      case "card-pot-confirm":
        handlePotConfirm(data);
        break;
      case "card-pot-result":
        handlePotResult(data);
        break;
      case "card-pot-reset":
        clearPotState(false);
        break;
      default:
        break;
    }
  };
}

// Toggle minimizar/expandir
function setupNFTToggle() {
  const btn = document.getElementById("nft-toggle");
  const body = document.getElementById("nft-list-body");
  const title = document.getElementById("nft-list-title");
  const container = document.getElementById("nft-list-container");
  if (!btn || !body) return;

  const setExpanded = (expanded) => {
    body.style.display = expanded ? "flex" : "none";
    btn.textContent = expanded ? "▲" : "▼";
    btn.setAttribute("aria-expanded", String(expanded));
    if (container) container.classList.toggle("open", expanded);
  };

  // Abre automaticamente em telas desktop; mantém fechado no mobile.
  const isDesktop = window.innerWidth >= 768 && !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  setExpanded(isDesktop);

  btn.addEventListener("click", () => {
    const isOpen = btn.getAttribute("aria-expanded") === "true";
    setExpanded(!isOpen);
  });

  // Também expande ao clicar no título "Cards conquistados".
  if (title) {
    title.style.cursor = "pointer";
    title.addEventListener("click", () => {
      const isOpen = btn.getAttribute("aria-expanded") === "true";
      setExpanded(!isOpen);
    });
  }
}

function collapseNFTList() {
  const btn = document.getElementById("nft-toggle");
  const body = document.getElementById("nft-list-body");
  if (!btn || !body) return;
  body.style.display = "none";
  btn.textContent = "▼";
  btn.setAttribute("aria-expanded", "false");
}

function openCardActions(cardId, imgSrc) {
  selectedCardId = cardId;
  selectedCardImg = imgSrc || getCardImageUrl(cardId);
  if (!ui.actionMenu) return;
  ui.actionMenu.classList.add("open");
  ui.actionMenu.setAttribute("aria-hidden", "false");
  if (ui.actionTitle) ui.actionTitle.textContent = `Card ${cardId}`;
  const hint = isSignatureCard(cardId)
    ? "Card autografado: poder extra (acima do GOLD)."
    : "Guardar, apostar ou compartilhar o card.";
  setActionFeedback(hint);
}

function closeCardActions() {
  if (ui.actionMenu) {
    ui.actionMenu.classList.remove("open");
    ui.actionMenu.setAttribute("aria-hidden", "true");
  }
}

function setActionFeedback(msg) {
  if (ui.actionFeedback) ui.actionFeedback.textContent = msg || "";
}

function toggleModal(el, open) {
  if (!el) return;
  if (open) {
    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
  } else {
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
  }
}

async function persistCard(cardId, email, password) {
  const payload = { cardId, email, password };
  const endpoint = window.CARD_SAVE_ENDPOINT || "/api/cards/save";
  const storage = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
    storage.push({ cardId, email, ts: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    return true;
  } catch (err) {
    console.warn("Falha ao salvar remoto, usando fallback local:", err);
    if (!storage.find((c) => c.cardId === cardId && c.email === email)) {
      storage.push({ cardId, email, ts: Date.now() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    }
    return false;
  }
}

async function handleLoginSubmit() {
  if (!selectedCardId) return;
  const email = ui.loginEmail?.value.trim();
  const password = ui.loginPassword?.value.trim();
  if (!email || !password) {
    setActionFeedback("Preencha e-mail e senha para guardar.");
    return;
  }
  setActionFeedback("Salvando card...");
  const ok = await persistCard(selectedCardId, email, password);
  setActionFeedback(ok ? "Card guardado no cofre." : "Salvo localmente; revise conexão.");
  persistList();
  toggleModal(ui.loginModal, false);
}

function simulateBafinho(cardId) {
  const rank = ["3-4-3", "3-5-2", "4-2-3-1", "4-3-3", "4-4-2", "4-1-4-1", "5-3-2"];
  const playerCard = baseCards.find((c) => String(c.id) === String(cardId)) || baseCards[0];
  const botCard = baseCards[Math.floor(Math.random() * baseCards.length)];
  if (isSignatureCard(cardId)) {
    return { winner: "player", botCard };
  }
  const pv = rank.indexOf(playerCard.formation);
  const bv = rank.indexOf(botCard.formation);
  const winner = pv === bv ? Math.random() > 0.5 ? "player" : "bot" : pv > bv ? "player" : "bot";
  return { winner, botCard };
}

function removeCardFromList(cardId) {
  const normalized = normalizeCardId(cardId);
  window.NFT_LIST = window.NFT_LIST.filter((id) => normalizeCardId(id) !== normalized);
  persistList();
  renderNFTList();
  removeFromCollected(cardId);
  window.dispatchEvent(new CustomEvent("cards:changed"));
}

function pairWithOpponent(cardId) {
  return new Promise((resolve) => {
    let resolved = false;
    const fallback = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      resolve({ mode: "bot", opponent: "Bot Invicto" });
    }, 4000);

    if (window.socket) {
      const onMatch = (payload) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(fallback);
        resolve({
          mode: "p2p",
          opponent: payload?.opponent || "Adversário remoto"
        });
      };
      window.socket.once("card-bet-match", onMatch);
      window.socket.emit("card-bet-seek", { cardId }, (resp) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(fallback);
        resolve(resp || { mode: "p2p", opponent: "Jogador remoto" });
      });
    }
  });
}

async function startBetFlow() {
  if (!selectedCardId) return;
  setActionFeedback("Buscando adversário...");
  const opponent = await pairWithOpponent(selectedCardId);
  setActionFeedback(`Match: ${opponent.opponent}. Rodada relâmpago...`);
  const result = simulateBafinho(selectedCardId);

  if (result.winner === "player") {
    const wonCardId = opponent.mode === "bot" ? result.botCard?.id : null;
    if (wonCardId) {
      addCardToNFTList?.(wonCardId);
      setActionFeedback(`🏆 Você venceu ${opponent.opponent}! Card ${wonCardId} conquistado.`);
    } else {
      setActionFeedback(`🏆 Você venceu ${opponent.opponent}!`);
    }
    if (window.socket && opponent.mode === "p2p") {
      window.socket.emit("card-bet-result", {
        cardId: selectedCardId,
        winner: "player"
      });
    }
  } else {
    setActionFeedback(`❌ Derrota para ${opponent.opponent}. Card perdido.`);
    removeCardFromList(selectedCardId);
    if (window.socket && opponent.mode === "p2p") {
      window.socket.emit("card-bet-result", {
        cardId: selectedCardId,
        winner: "bot"
      });
    }
  }
}

async function shareCard() {
  if (!selectedCardId) return;
  const dest = ui.shareSelect?.value || "story";
  const url = selectedCardImg || getCardImageUrl(selectedCardId);
  const text = `Card ${selectedCardId} do CT Virtual`;

  const openInstagram = () => {
    if (dest === "story") {
      window.open(`https://www.instagram.com/create/story/?media=${encodeURIComponent(url)}`, "_blank");
    } else if (dest === "dm") {
      window.open("https://www.instagram.com/direct/new/", "_blank");
    } else {
      window.open(`https://www.instagram.com/?url=${encodeURIComponent(url)}`, "_blank");
    }
  };

  try {
    if (navigator.share) {
      await navigator.share({ title: "Card Invicto", text, url });
      setActionFeedback("Compartilhado pelo Web Share.");
    } else {
      openInstagram();
      setActionFeedback("Abrindo Instagram com o card.");
    }
    await navigator.clipboard?.writeText(url);
  } catch (err) {
    console.warn("Share falhou, usando fallback:", err);
    openInstagram();
    setActionFeedback("Link copiado para compartilhar no Instagram.");
  } finally {
    toggleModal(ui.shareMenu, false);
  }
}

function setupActionMenu() {
  ui.actionMenu = document.getElementById("card-action-menu");
  ui.actionTitle = document.getElementById("card-action-title");
  ui.actionFeedback = document.getElementById("card-action-feedback");
  const closeBtn = document.getElementById("card-action-close");

  if (closeBtn) closeBtn.addEventListener("click", closeCardActions);
  if (ui.actionMenu) {
    ui.actionMenu.addEventListener("click", (e) => {
      const btn = e.target.closest(".card-action-btn");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "view") {
        showPreview();
      } else if (action === "save") {
        toggleModal(ui.loginModal, true);
      } else if (action === "bet") {
        startBetFlow();
      } else if (action === "signature") {
        startSignatureFlow();
      } else if (action === "share") {
        toggleModal(ui.shareMenu, true);
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (!ui.actionMenu || !ui.actionMenu.classList.contains("open")) return;
    if (e.target.closest("#card-action-menu") || e.target.closest(".nft-card")) return;
    closeCardActions();
  });
}

function setupLoginModal() {
  ui.loginModal = document.getElementById("card-login-modal");
  ui.loginEmail = document.getElementById("card-login-email");
  ui.loginPassword = document.getElementById("card-login-password");
  const submit = document.getElementById("card-login-submit");
  const cancel = document.getElementById("card-login-cancel");

  if (submit) submit.addEventListener("click", handleLoginSubmit);
  if (cancel) cancel.addEventListener("click", () => toggleModal(ui.loginModal, false));
}

function setupShareMenu() {
  ui.shareMenu = document.getElementById("card-share-menu");
  ui.shareSelect = document.getElementById("card-share-dest");
  const confirm = document.getElementById("card-share-confirm");
  const cancel = document.getElementById("card-share-cancel");

  if (confirm) confirm.addEventListener("click", shareCard);
  if (cancel) cancel.addEventListener("click", () => toggleModal(ui.shareMenu, false));
}

function setupSignatureModal() {
  ui.signatureModal = document.getElementById("signature-modal");
  ui.signatureProgress = document.getElementById("signature-progress");
  ui.signatureWatch = document.getElementById("signature-watch");
  ui.signatureClose = document.getElementById("signature-close");

  if (ui.signatureWatch) ui.signatureWatch.addEventListener("click", handleSignatureWatch);
  if (ui.signatureClose) ui.signatureClose.addEventListener("click", () => toggleModal(ui.signatureModal, false));
  updateSignatureProgress();
}

function updateSignatureProgress() {
  if (ui.signatureProgress) {
    ui.signatureProgress.textContent = `${signatureViews}/${SIGNATURE_REQUIRED_VIEWS} anúncios assistidos`;
  }
  if (ui.signatureWatch) {
    ui.signatureWatch.disabled = signatureViews >= SIGNATURE_REQUIRED_VIEWS;
  }
}

function startSignatureFlow() {
  if (!selectedCardId) return;
  if (isSignatureCard(selectedCardId)) {
    setActionFeedback("Este card já está autografado e é mais forte que GOLD.");
    return;
  }
  const upgradeId = getSignatureUpgradeId(selectedCardId);
  if (!upgradeId) {
    setActionFeedback("Autógrafo disponível apenas para o Card 1 nesta fase.");
    return;
  }
  if (signatureTargetCard !== selectedCardId) {
    signatureViews = 0;
  }
  signatureTargetCard = selectedCardId;
  updateSignatureProgress();
  toggleModal(ui.signatureModal, true);
  setActionFeedback("Assista a 2 anúncios Adsterra para liberar o autógrafo.");
}

function openAdsterraPopup(step) {
  try {
    const win = window.open(SIGNATURE_AD_URL, "_blank", "noopener");
    if (!win) console.warn(`Popup do anúncio ${step} bloqueado`);
    return !!win;
  } catch (err) {
    console.warn("Falha ao abrir anúncio Adsterra:", err);
    return false;
  }
}

function handleSignatureWatch() {
  if (!signatureTargetCard) {
    setActionFeedback("Selecione um card para liberar o autógrafo.");
    return;
  }
  if (signatureViews >= SIGNATURE_REQUIRED_VIEWS) {
    setActionFeedback("Autógrafo já liberado para este card.");
    return;
  }
  const step = signatureViews + 1;
  const opened = openAdsterraPopup(step);
  signatureViews = Math.min(signatureViews + 1, SIGNATURE_REQUIRED_VIEWS);
  updateSignatureProgress();
  setActionFeedback(opened ? `Anúncio ${step}/2 aberto. Volte após assistir.` : "Ative pop-ups para assistir ao anúncio.");
  if (signatureViews >= SIGNATURE_REQUIRED_VIEWS) {
    setTimeout(completeSignatureReward, 1200);
  }
}

function completeSignatureReward() {
  if (!signatureTargetCard) return;
  const upgradeId = getSignatureUpgradeId(signatureTargetCard);
  if (!upgradeId) return;
  replaceCardInList(signatureTargetCard, upgradeId);
  selectedCardId = upgradeId;
  selectedCardImg = getCardImageUrl(upgradeId);
  // trava a UI no estado concluído
  signatureViews = SIGNATURE_REQUIRED_VIEWS;
  signatureTargetCard = null;
  updateSignatureProgress();
  toggleModal(ui.signatureModal, false);
  const msg = `🏆 Autógrafo conquistado! Card ${upgradeId.toUpperCase()} é mais forte que GOLD.`;
  setActionFeedback(msg);
  if (typeof window.showVictoryOverlay === "function") {
    window.showVictoryOverlay(msg, upgradeId);
  }
}

function setupPreview() {
  ui.previewModal = document.getElementById("card-preview-modal");
  ui.previewImg = document.getElementById("card-preview-img");
  if (!ui.previewModal) return;
  ui.previewModal.addEventListener("click", (e) => {
    if (e.target === ui.previewModal) toggleModal(ui.previewModal, false);
  });
}

function showPreview() {
  if (!selectedCardId || !ui.previewModal || !ui.previewImg) return;
  ui.previewImg.src = selectedCardImg || getCardImageUrl(selectedCardId);
  ui.previewImg.alt = `Card ${selectedCardId}`;
  toggleModal(ui.previewModal, true);
}

// Exposto para outras lógicas (ex.: IA/overlay)
window.renderNFTList = renderNFTList;

document.addEventListener("DOMContentLoaded", () => {
  hydrateListFromStorage();
  setupNFTToggle();
  setupActionMenu();
  setupLoginModal();
  setupShareMenu();
  setupSignatureModal();
  setupPreview();
  setupRoomPotDrop();
  renderNFTList();
  renderRoomPot();
});

document.addEventListener("auth:user", () => {
  hydrateListFromStorage();
  renderNFTList();
  renderRoomPot();
});
