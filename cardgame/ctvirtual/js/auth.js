(() => {
  const USER_KEY = "ctv-user";
  const CARDS_KEY = "ctv-user-cards";
  const NEWS_CACHE_KEY = "ctv-newsletter-cache";
  const SCORES_KEY = "ctv-user-scores";
  const newsletterEndpoint = window.NEWSLETTER_ENDPOINT || "/api/newsletter";

  let user = null;

  const els = {
    modal: null,
    name: null,
    email: null,
    password: null,
    newsletter: null,
    submit: null,
    close: null,
    logout: null,
    feedback: null
  };

  function loadUser() {
    if (user) return user;
    try {
      const stored = localStorage.getItem(USER_KEY);
      user = stored ? JSON.parse(stored) : null;
    } catch (err) {
      console.warn("Erro ao carregar usuário:", err);
      user = null;
    }
    return user;
  }

  function currentEmail() {
    const u = loadUser();
    return (u?.email || localStorage.getItem("user_email") || "").trim();
  }

  function saveUser(data) {
    user = { ...data, ts: Date.now() };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (data?.email) {
      localStorage.setItem("user_email", data.email);
      window.currentUserEmail = data.email;
    }
    document.dispatchEvent(new CustomEvent("auth:user", { detail: user }));
  }

  function clearUser() {
    user = null;
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("user_email");
    window.currentUserEmail = null;
    document.dispatchEvent(new CustomEvent("auth:user", { detail: null }));
  }

  function resetSessionCardsUI() {
    window.NFT_LIST = [];
    if (typeof window.renderNFTList === "function") {
      window.renderNFTList();
    }
    const countEl = document.getElementById("nft-count");
    if (countEl) countEl.textContent = "0";
  }

  function getUserCards() {
    const email = currentEmail();
    if (!email) {
      // fallback: retorna lista antiga global
      try {
        const legacy = localStorage.getItem(CARDS_KEY);
        if (!legacy) return [];
        const parsed = JSON.parse(legacy);
        return Array.isArray(parsed) ? dedupeList(parsed) : [];
      } catch {
        return [];
      }
    }

    try {
      const stored = localStorage.getItem(CARDS_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // migração: antigo formato array global
        return dedupeList(parsed);
      }
      if (parsed && typeof parsed === "object" && parsed[email]) {
        return dedupeList(parsed[email]);
      }
      return [];
    } catch {
      return [];
    }
  }

  function saveUserCards(cards) {
    if (!cards) return;
    const email = currentEmail();
    if (!email) {
      // mantém compatibilidade antiga se não houver email
      const unique = dedupeList(cards);
      localStorage.setItem(CARDS_KEY, JSON.stringify(unique));
      return;
    }

    let map = {};
    try {
      const stored = JSON.parse(localStorage.getItem(CARDS_KEY) || "{}");
      map = stored && typeof stored === "object" ? stored : {};
    } catch {
      map = {};
    }

    map[email] = dedupeList(cards);
    localStorage.setItem(CARDS_KEY, JSON.stringify(map));
  }

  function loadScores() {
    try {
      return JSON.parse(localStorage.getItem(SCORES_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveScores(map) {
    localStorage.setItem(SCORES_KEY, JSON.stringify(map || {}));
  }

  function getUserScore(email) {
    if (!email) return null;
    const scores = loadScores();
    return scores[email] || null;
  }

  function saveUserScore(points, goals) {
    const u = loadUser();
    if (!u?.email) return;
    const scores = loadScores();
    scores[u.email] = {
      points: Number(points) || 0,
      goals: Number(goals) || 0,
    };
    saveScores(scores);
  }

  function applyUserScore(email) {
    const sc = getUserScore(email);
    if (!sc) return;
    localStorage.setItem("inv_pts", String(sc.points || 0));
    localStorage.setItem("inv_goals", String(sc.goals || 0));
    if (window.state) {
      window.state.points = Number(sc.points || 0);
      window.state.goals = Number(sc.goals || 0);
    }
    const pv = document.getElementById("points-value");
    const gv = document.getElementById("goals-value");
    if (pv) pv.textContent = sc.points || 0;
    if (gv) gv.textContent = sc.goals || 0;
  }

  function dedupeList(list = []) {
    return Array.from(new Set((list || []).map((c) => String(c).trim())));
  }

  async function subscribeNewsletter(email, name) {
    if (!email) return;
    try {
      const res = await fetch(newsletterEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cacheNewsletter(email);
      return true;
    } catch (err) {
      console.warn("Newsletter offline/cache:", err);
      cacheNewsletter(email);
      return false;
    }
  }

  function cacheNewsletter(email) {
    const cached = JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || "[]");
    if (!cached.includes(email)) {
      cached.push(email);
      localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(cached));
    }
  }

  function toggleModal(show) {
    if (!els.modal) return;
    if (show) {
      els.modal.classList.add("open");
      els.modal.setAttribute("aria-hidden", "false");
    } else {
      els.modal.classList.remove("open");
      els.modal.setAttribute("aria-hidden", "true");
    }
  }

  function setFeedback(msg) {
    if (els.feedback) els.feedback.textContent = msg || "";
  }

  async function handleSubmit() {
    const name = els.name?.value.trim();
    const email = els.email?.value.trim();
    const password = els.password?.value.trim();
    const wantsNewsletter = !!els.newsletter?.checked;

    if (!email) {
      setFeedback("Informe um e-mail para entrar.");
      return;
    }

    saveUser({ name, email, password: password || undefined });

    // mescla cards já salvos com os da sessão antes de persistir
    const existingCards = getUserCards();
    const sessionCards = Array.isArray(window.NFT_LIST) ? window.NFT_LIST : [];
    const mergedCards = dedupeList([...(existingCards || []), ...(sessionCards || [])]);
    window.NFT_LIST = mergedCards;
    if (typeof window.saveUserCards === "function") {
      window.saveUserCards(mergedCards);
    }
    if (typeof window.renderNFTList === "function") {
      window.renderNFTList();
    }

    // restaura/usa o score salvo desse usuário (se existir)
    applyUserScore(email);

    if (wantsNewsletter) {
      setFeedback("Salvando e inscrevendo na mala direta...");
      await subscribeNewsletter(email, name);
    }

    setFeedback("✅ Login salvo. Seus cards ficarão guardados neste dispositivo.");
    toggleModal(false);

    // se o login foi feito na HOME, redireciona para o CT Virtual
    const isCT = window.location.pathname.includes("/ctvirtual/");
    if (!isCT) {
      window.location.href = "./ctvirtual/index.html";
    }
  }

  function fillFromUser() {
    const u = loadUser();
    if (!u) return;
    if (els.name) els.name.value = u.name || "";
    if (els.email) els.email.value = u.email || "";
    if (els.password) els.password.value = u.password || "";
  }

  function setupModal() {
    els.modal = document.getElementById("auth-modal");
    els.name = document.getElementById("auth-name");
    els.email = document.getElementById("auth-email");
    els.password = document.getElementById("auth-password");
    els.newsletter = document.getElementById("auth-newsletter");
    els.submit = document.getElementById("auth-submit");
    els.close = document.getElementById("auth-close");
    els.logout = document.getElementById("auth-logout");
    els.feedback = document.getElementById("auth-feedback");

    if (els.submit) els.submit.addEventListener("click", handleSubmit);
    if (els.close) els.close.addEventListener("click", () => toggleModal(false));
    if (els.logout) {
      els.logout.addEventListener("click", () => {
        clearUser();
        resetSessionCardsUI(); // limpa apenas a sessão visível, preservando dados gravados
        setFeedback("Sessão encerrada. Faça login para carregar seus cards.");
        toggleModal(false);
      });
    }
    if (els.modal) {
      els.modal.addEventListener("click", (e) => {
        if (e.target === els.modal) toggleModal(false);
      });
    }
  }

  function setupMenuShortcut() {
    if (window.__menuHandlesLogin) return; // menu.js já controla login/logout
    const trigger = document.querySelector('.submenu[data-action="login"]');
    if (trigger) {
      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        openAuthModal();
      });
    }
  }

  function openAuthModal() {
    fillFromUser();
    setFeedback("");
    toggleModal(true);
  }

  // API global
  window.getLoggedUser = loadUser;
  window.getUserCards = getUserCards;
  window.saveUserCards = saveUserCards;
  window.openAuthModal = openAuthModal;
  window.saveUserScore = saveUserScore;
  window.getUserScore = getUserScore;
  window.logoutAndClearCards = () => {
    clearUser();
    resetSessionCardsUI();
  };

  document.addEventListener("DOMContentLoaded", () => {
    setupModal();
    setupMenuShortcut();
    fillFromUser();
  });
})();
