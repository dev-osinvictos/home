  // Missões de cards com recompensas táticas
  (() => {
    const cardEl = document.getElementById("card-placeholder");
    if (!cardEl) return;

    const standardRewards = {
      "4-3-3":   { pts: 3, goals: 3 },
      "4-2-3-1": { pts: 2, goals: 2 },
      "4-1-4-1": { pts: 2, goals: 1 },
      "5-3-2":   { pts: 1, goals: 0 }
    };
    const card1Rewards = {
      "4-2-3-1": { pts: 3, goals: 3 },
      "4-4-2":   { pts: 2, goals: 2 },
      "4-1-4-1": { pts: 2, goals: 1 },
      "3-5-2":   { pts: 1, goals: 1 }
    };

    const missions = [
      { id: 1, formation: "4-3-3", question: "Qual esquema tático combate o 4-3-3 (Marcelo Bielsa)?", rewards: card1Rewards },
      { id: 2, formation: "4-3-3", question: "Qual esquema tático combate o 4-3-3 do Card 2?", rewards: standardRewards },
      { id: 3, formation: "4-3-3", question: "Qual esquema tático combate o 4-3-3 do Card 3?", rewards: standardRewards },
      { id: 4, formation: "4-3-3", question: "Qual esquema tático combate o 4-3-3 do Card 4?", rewards: standardRewards },
      { id: 5, formation: "4-2-3-1", question: "Qual esquema tático combate o 4-2-3-1 do Card 5?", rewards: standardRewards },
      { id: 6, formation: "3-4-3", question: "Qual esquema tático combate o 3-4-3 do Card 6?", rewards: standardRewards },
      { id: 7, formation: "4-3-3", question: "Qual esquema tático combate o 4-3-3 do Card 7?", rewards: standardRewards },
      { id: 8, formation: "3-4-3", question: "Qual esquema tático combate o 3-4-3 do Card 8?", rewards: standardRewards }
    ];

    const notifyFn = typeof notify === "function" ? notify : (msg) => alert(msg);
    const updateScore = (ptsAdd, goalsAdd) => {
      const star = document.getElementById("points-value");
      const goals = document.getElementById("goals-value");
      const curPts = parseInt(star?.textContent || "0", 10) || 0;
      const curGoals = parseInt(goals?.textContent || "0", 10) || 0;
      const newPts = curPts + ptsAdd;
      const newGoals = curGoals + goalsAdd;
      if (star) star.textContent = newPts;
      if (goals) goals.textContent = newGoals;
      localStorage.setItem("inv_pts", String(newPts));
      localStorage.setItem("inv_goals", String(newGoals));
      if (window.state) {
        window.state.points = newPts;
        window.state.goals = newGoals;
      }
      if (typeof window.saveUserScore === "function") {
        window.saveUserScore(newPts, newGoals);
      }
    };
    // expõe para outras lógicas (ex.: IA tática / aiBtn)
    window.updateScoreFromCard = updateScore;
    window.missionsData = missions;
    let missionTimer = null;
    let answerOptions = ["4-3-3", "4-2-3-1", "4-1-4-1", "5-3-2"];
    let answerUI = null;
    let missionSelectWrap = null;
    let missionSelect = null;
    let dragStartX = null;

    function currentEmail() {
      const u = typeof window.getLoggedUser === "function" ? window.getLoggedUser() : null;
      return (u?.email || localStorage.getItem("user_email") || "anon").trim() || "anon";
    }

    function loadCollected() {
      const key = `ctv-collected-${currentEmail()}`;
      try {
        const arr = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    }

    function saveCollected(list) {
      const key = `ctv-collected-${currentEmail()}`;
      localStorage.setItem(key, JSON.stringify(Array.from(new Set((list || []).map((c) => String(c))))));
    }

    const collected = (window.collectedCards = loadCollected());

    function getAvailableMissions() {
      const conquered = new Set([
        ...(window.NFT_LIST || []),
        ...(collected || []),
      ].map((c) => String(c)));
      return missions.filter((m) => !conquered.has(String(m.id)));
    }

    function triggerVictoryIfDone() {
      const remaining = getAvailableMissions();
      if (!remaining.length) {
        if (typeof window.showVictoryOverlay === "function") {
          window.showVictoryOverlay("Você conquistou todos os cards! 🏆");
        } else {
          alert("Você conquistou todos os cards! 🏆");
        }
        return true;
      }
      return false;
    }

    function ensureAnswerUI() {
      if (answerUI) return;
      const wrap = document.createElement("div");
      wrap.id = "mission-answer-wrap";
      wrap.style.position = "fixed";
      wrap.style.right = "20px";
      wrap.style.bottom = "5px";
      wrap.style.transform = "rotate(180deg)";
      wrap.style.color = "#000000ff";
      wrap.style.fontWeight = "400";
      wrap.style.cursor = "pointer";
      wrap.style.zIndex = "250000";
      wrap.style.userSelect = "none";

      const select = document.createElement("select");
      select.id = "mission-answer-select";
      select.style.position = "fixed";
      select.style.left = "26px";
      select.style.bottom = "180px";
      select.style.zIndex = "16000";
      select.style.background = "#0f0f0f";
      select.style.color = "#fff";
      select.style.padding = "6px 8px";
      select.style.border = "1px solid #444";
      select.style.borderRadius = "6px";
      select.style.display = "none";

      wrap.addEventListener("click", () => {
        select.style.display = "block";
      });

      select.addEventListener("change", () => {
        if (!select.value) return;
        handleMissionAnswer(select.value);
        select.value = "";
        select.style.display = "none";
      });

      document.body.appendChild(wrap);
      document.body.appendChild(select);
      answerUI = { wrap, select };
    }

    function updateAnswerUIOptions(opts = []) {
      answerOptions = opts.length ? opts : answerOptions;
      if (!answerUI) return;
      answerUI.wrap.textContent = `R. ${answerOptions.join(" | ")}`;
      answerUI.select.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Selecione a formação";
      answerUI.select.appendChild(placeholder);
      answerOptions.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        answerUI.select.appendChild(o);
      });
    }

    function ensureMissionSelector() {
      if (missionSelectWrap) return;
      missionSelectWrap = document.createElement("div");
      missionSelectWrap.id = "mission-selector";
      missionSelectWrap.style.position = "fixed";
      missionSelectWrap.style.left = "5px";
      missionSelectWrap.style.right = "";
      missionSelectWrap.style.bottom = "10px";
      missionSelectWrap.style.zIndex = "200100";
      missionSelectWrap.style.background = "rgba(0,0,0,0.75)";
      missionSelectWrap.style.color = "#fff";
      missionSelectWrap.style.padding = "8px";
      missionSelectWrap.style.border = "1px solid #444";
      missionSelectWrap.style.borderRadius = "8px";
      missionSelectWrap.style.fontSize = "13px";
      missionSelectWrap.style.display = "flex";
      missionSelectWrap.style.flexDirection = "column";
      missionSelectWrap.style.gap = "6px";

      const label = document.createElement("button");
      label.textContent = "Card da Vez";
      label.style.fontWeight = "700";
      label.style.background = "transparent";
      label.style.color = "#fff";
      label.style.border = "none";
      label.style.cursor = "pointer";
      label.style.padding = "0";
      label.style.textAlign = "left";
      label.style.fontSize = "13px";
      missionSelectWrap.appendChild(label);

      missionSelect = document.createElement("select");
      missionSelect.style.background = "#0f0f0f";
      missionSelect.style.color = "#fff";
      missionSelect.style.border = "1px solid #444";
      missionSelect.style.borderRadius = "6px";
      missionSelect.style.padding = "6px 8px";
      missionSelect.style.fontSize = "13px";
      missionSelect.addEventListener("change", () => {
        const id = Number(missionSelect.value);
        const mission = missions.find((m) => m.id === id);
        if (mission) setMission(mission, false);
      });
      missionSelectWrap.appendChild(missionSelect);

      const preview = document.createElement("div");
      preview.id = "mission-preview";
      preview.style.width = "120px";
      preview.style.height = "180px";
      preview.style.backgroundSize = "cover";
      preview.style.backgroundPosition = "center";
      preview.style.borderRadius = "8px";
      preview.style.border = "1px solid #555";
      preview.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
      preview.style.transition = "opacity 200ms ease";
      missionSelectWrap.appendChild(preview);

      document.body.appendChild(missionSelectWrap);

      // Minimiza após 10s: esconde preview, mantém título + select
      setTimeout(() => {
        if (!missionSelectWrap) return;
        preview.style.display = "none";
        missionSelectWrap.style.padding = "6px";
        missionSelectWrap.style.gap = "4px";
      }, 10000);

      // atualiza opções quando os cards mudarem (ganho/perda)
      window.addEventListener("cards:changed", () => {
        populateMissionSelect(window.currentMissionCard?.id);
      });
      window.addEventListener("auth:user", () => {
        window.collectedCards = loadCollected();
        populateMissionSelect(window.currentMissionCard?.id);
      });

      function togglePreview(force) {
        const isHidden = preview.style.display === "none";
        const show = typeof force === "boolean" ? force : isHidden;
        missionSelectWrap.style.padding = show ? "8px" : "6px";
        missionSelectWrap.style.gap = show ? "6px" : "4px";
        preview.style.display = show ? "block" : "none";
      }

      // Maximiza/minimiza apenas ao clicar no título para não conflitar com swipe
      label.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePreview();
      });

      // Minimiza após 10s
      setTimeout(() => togglePreview(false), 10000);
    }

    function populateMissionSelect(currentId) {
      if (!missionSelect) return;
      missionSelect.innerHTML = "";

      const available = getAvailableMissions();
      const list = available.length ? available : missions;

      list.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = `Card ${m.id} — ${m.formation}`;
        missionSelect.appendChild(opt);
      });
      if (currentId && list.find((m) => String(m.id) === String(currentId))) {
        missionSelect.value = String(currentId);
      }
    }

    function handleMissionAnswer() {
      if (!window.currentMissionCard) return;
      updateScore(1, 3); // +1 ponto (estrela) e +3 gols
      notifyFn(
        "Resposta certa! Monte o time Invicto (branco) && clique na Engrenagem (icone)\n*Para ganhar o CARD* *=igual=bold"
      );
      if (!collected.includes(window.currentMissionCard.id)) {
        collected.push(window.currentMissionCard.id);
        saveCollected(collected);
      }
      missionTimer = null;
      startMission(); // dispara próxima missão
    }

    function setMission(mission, updateSelect = true) {
      window.currentMissionCard = mission;
      const imgUrl = `url('./cards/${mission.id}.png')`;
      const prev = document.getElementById("mission-preview");
      if (prev) prev.style.backgroundImage = imgUrl;
      if (updateSelect) populateMissionSelect(mission.id);
      updateAnswerUIOptions(Object.keys(mission.rewards || {}));
      // maximiza ao trocar e minimiza após 6s
      if (missionSelectWrap) {
        const preview = document.getElementById("mission-preview");
        missionSelectWrap.style.padding = "8px";
        missionSelectWrap.style.gap = "6px";
        if (preview) preview.style.display = "block";
        setTimeout(() => {
          missionSelectWrap.style.padding = "6px";
          missionSelectWrap.style.gap = "4px";
          if (preview) preview.style.display = "none";
        }, 6000);
      }
    }

    function randomMission() {
      if (triggerVictoryIfDone()) return;
      const available = getAvailableMissions();
      const mission = available[Math.floor(Math.random() * available.length)];
      setMission(mission, true);
    }

    const startMission = () => {
      if (missionTimer) {
        clearTimeout(missionTimer);
        missionTimer = null;
      }
      ensureMissionSelector();
      ensureAnswerUI();
      randomMission();
    };

    // expõe para o aiBtn poder chamar nova missão após reconhecimento da formação
    window.startCardMission = startMission;

    // swipe estilo Tinder para trocar missão (funciona em mouse/touch)
    let swipePointerId = null;
    cardEl.addEventListener("pointerdown", (e) => {
      swipePointerId = e.pointerId;
      dragStartX = e.clientX;
      cardEl.setPointerCapture(swipePointerId);
    });
    cardEl.addEventListener("pointermove", (e) => {
      if (swipePointerId === null || e.pointerId !== swipePointerId) return;
      if (dragStartX === null) dragStartX = e.clientX;
      const delta = e.clientX - dragStartX;
      if (Math.abs(delta) > 8) {
        randomMission();
        dragStartX = e.clientX; // evita disparo múltiplo em um mesmo movimento longo
      }
    });
    const endSwipe = () => {
      dragStartX = null;
      if (swipePointerId !== null) {
        try { cardEl.releasePointerCapture(swipePointerId); } catch {}
      }
      swipePointerId = null;
    };
    cardEl.addEventListener("pointerup", endSwipe);
    cardEl.addEventListener("pointercancel", endSwipe);
    cardEl.addEventListener("pointerleave", endSwipe);

    startMission();
  })();
