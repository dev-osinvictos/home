  // Missões de cards com recompensas táticas
  (() => {
    const cardEl = document.getElementById("card-placeholder");
    if (!cardEl) return;

    let finalMinimizeLock = false;

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

    const FORMATION_STRENGTH = {
      "4-4-2": 1,
      "5-4-1": 2,
      "4-3-3": 3,
      "4-1-4-1": 3,
      "4-2-3-1": 4,
      "4-2-2-2": 4,
      "3-4-3": 4,
      "3-4-2-1": 4,
      "3-5-2": 5
    };
    const DEFAULT_FORMATION_STRENGTH = 3;

    const cardDeck = [
      { id: 1, rarity: "p", formations: ["4-3-3", "3-4-3"] },
      { id: 2, rarity: "g", formations: ["4-3-3"] },
      { id: 3, rarity: "g", formations: ["4-3-3"] },
      { id: 4, rarity: "p", formations: ["4-3-3"] },
      { id: 5, rarity: "p", formations: ["4-2-3-1"] },
      { id: 6, rarity: "g", formations: ["3-4-3"] },
      { id: 7, rarity: "g", formations: ["4-3-3"] },
      { id: 8, rarity: "g", formations: ["3-4-3"] },
      { id: 9, rarity: "g", formations: ["4-2-3-1"] },
      { id: 10, rarity: "g", formations: ["4-3-3"] },
      { id: 11, rarity: "p", formations: ["4-4-2"] },
      { id: 12, rarity: "g", formations: ["3-4-3"] },
      { id: 13, rarity: "p", formations: ["4-2-3-1", "4-3-3"] },
      { id: 14, rarity: "p", formations: ["4-2-3-1", "5-4-1"] },
      { id: 15, rarity: "g", formations: ["4-3-3", "4-2-3-1"] },
      { id: 16, rarity: "p", formations: ["4-3-3"] },
      { id: 17, rarity: "g", formations: ["3-4-3", "3-5-2"] },
      { id: 18, rarity: "p", formations: ["3-4-2-1"] },
      { id: 19, rarity: "p", formations: ["4-3-3", "4-2-3-1"] },
      { id: 20, rarity: "p", formations: ["4-3-3", "3-4-2-1"] },
      { id: 21, rarity: "p", formations: ["4-3-3", "4-2-3-1"] },
      { id: 22, rarity: "p", formations: ["4-3-3"] },
      { id: 23, rarity: "p", formations: ["4-3-3", "4-2-3-1"] },
      { id: 24, rarity: "p", formations: ["4-2-3-1"] },
      { id: 25, rarity: "p", formations: ["4-4-2", "4-1-4-1"] },
      { id: 26, rarity: "p", formations: ["4-3-3", "4-2-3-1"] },
      { id: 27, rarity: "p", formations: ["4-3-3"] },
      { id: 28, rarity: "p", formations: ["4-1-4-1"] },
      { id: 29, rarity: "p", formations: ["4-3-3", "4-2-3-1"] },
      { id: 30, rarity: "p", formations: ["4-2-3-1"] },
      { id: 31, rarity: "p", formations: ["4-3-3"] },
      { id: 32, rarity: "p", formations: ["4-3-3", "4-2-3-1"] },
      { id: 33, rarity: "p", formations: ["4-3-3"] },
      { id: 34, rarity: "p", formations: ["3-4-3", "4-3-3"] },
      { id: 35, rarity: "p", formations: ["4-3-3", "4-2-3-1"] },
      { id: 36, rarity: "p", formations: ["4-3-3", "4-2-3-1"] },
      { id: 37, rarity: "p", formations: ["4-2-2-2"] },
      { id: 38, rarity: "p", formations: ["4-2-3-1"] },
      { id: 39, rarity: "p", formations: ["4-3-3", "3-4-2-1"] },
      { id: 40, rarity: "p", formations: ["4-3-3", "4-2-3-1"] },
      { id: 41, rarity: "p", formations: ["3-4-3"] },
      { id: 42, rarity: "p", formations: ["3-4-3", "3-5-2"] },
      { id: 43, rarity: "p", formations: ["4-2-3-1", "4-3-3"] },
      { id: 44, rarity: "p", formations: ["4-2-3-1"] }
    ];

    function normalizeFormation(raw) {
      const digits = (String(raw || "").match(/\d/g) || []);
      if (!digits.length) return String(raw || "").trim();
      return digits.join("-").replace(/-+/g, "-");
    }

    function computeTacticalStrength(formations = []) {
      const baseList = formations.map((f) => FORMATION_STRENGTH[f] ?? DEFAULT_FORMATION_STRENGTH);
      const base = baseList.length ? Math.max(...baseList) : DEFAULT_FORMATION_STRENGTH;
      return Math.max(1, Math.min(5, base));
    }

    function buildQuestion(id, formations, rarityLabel) {
      const label = formations.join(" / ");
      return `Qual esquema tático combate o ${label} do Card ${id} (${rarityLabel})?`;
    }

    const missions = cardDeck.map((card) => {
      const formations = card.formations.map(normalizeFormation);
      const rarity = card.rarity === "g" ? "gold" : "prata";
      const rarityShort = rarity === "gold" ? "GOLD" : "PRATA";
      return {
        id: card.id,
        rarity,
        formation: formations[0] || "4-3-3",
        formations,
        tacticalStrength: computeTacticalStrength(formations),
        question: buildQuestion(card.id, formations, rarityShort),
        rewards: card.id === 1 ? card1Rewards : standardRewards
      };
    });

    window.cardTacticalRanking = [...missions].sort((a, b) => {
      if (b.tacticalStrength !== a.tacticalStrength) {
        return b.tacticalStrength - a.tacticalStrength; // força tática (1 a 5) primeiro
      }
      if ((a.formations?.length || 1) !== (b.formations?.length || 1)) {
        return (b.formations?.length || 1) - (a.formations?.length || 1); // mais planos vence
      }
      if ((a.formations?.length || 1) > 1 && a.rarity !== b.rarity) {
        return a.rarity === "gold" ? -1 : 1; // desempate de multi plano: gold > prata
      }
      if (a.rarity !== b.rarity) {
        return a.rarity === "gold" ? -1 : 1;
      }
      return a.id - b.id;
    });

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
    let dragStartY = null;

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
      missionSelectWrap.style.left = "20px";
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
      label.style.touchAction = "none";
      label.style.userSelect = "none";
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

      let labelDragState = null;
      let labelHoldTimer = null;
      let ignoreLabelClick = false;

      const isMinimized = () => preview.style.display === "none";

      const setWrapPosition = (left, top) => {
        missionSelectWrap.style.right = "";
        missionSelectWrap.style.bottom = "";
        missionSelectWrap.style.left = `${left}px`;
        missionSelectWrap.style.top = `${top}px`;
      };

      const startLabelDrag = (e) => {
        if (!isMinimized()) return;
        if (e.button !== 0 && e.pointerType === "mouse") return;
        const rect = missionSelectWrap.getBoundingClientRect();
        labelDragState = {
          pointerId: e.pointerId,
          offsetX: e.clientX - rect.left,
          offsetY: e.clientY - rect.top,
          startX: e.clientX,
          startY: e.clientY
        };
        ignoreLabelClick = false;
        label.setPointerCapture(e.pointerId);
        labelHoldTimer = setTimeout(() => {
          ignoreLabelClick = true;
          setWrapPosition(rect.left, rect.top);
          missionSelectWrap.style.cursor = "grabbing";
        }, 180);
      };

      const moveLabelDrag = (e) => {
        if (!labelDragState || e.pointerId !== labelDragState.pointerId) return;
        const moved = Math.hypot(e.clientX - labelDragState.startX, e.clientY - labelDragState.startY);
        if (moved > 4 && labelHoldTimer) {
          clearTimeout(labelHoldTimer);
          labelHoldTimer = null;
        }
        if (!ignoreLabelClick) return;
        const rect = missionSelectWrap.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width;
        const maxTop = window.innerHeight - rect.height;
        const nextLeft = Math.min(Math.max(0, e.clientX - labelDragState.offsetX), Math.max(0, maxLeft));
        const nextTop = Math.min(Math.max(0, e.clientY - labelDragState.offsetY), Math.max(0, maxTop));
        setWrapPosition(nextLeft, nextTop);
      };

      const endLabelDrag = (e) => {
        if (!labelDragState || e.pointerId !== labelDragState.pointerId) return;
        if (labelHoldTimer) {
          clearTimeout(labelHoldTimer);
          labelHoldTimer = null;
        }
        try { label.releasePointerCapture(e.pointerId); } catch {}
        labelDragState = null;
        missionSelectWrap.style.cursor = "pointer";
      };

      label.addEventListener("pointerdown", startLabelDrag);
      label.addEventListener("pointermove", moveLabelDrag);
      label.addEventListener("pointerup", endLabelDrag);
      label.addEventListener("pointercancel", endLabelDrag);

      document.body.appendChild(missionSelectWrap);

      // Minimiza após 10s: esconde preview, mantém título + select
      setTimeout(() => {
        if (!missionSelectWrap) return;
        preview.style.display = "none";
        missionSelectWrap.style.padding = "6px";
        missionSelectWrap.style.gap = "4px";
      }, 10000);

      // Agenda sequências de maximizar/minimizar
      const togglePreviewTimed = (show) => {
        missionSelectWrap.style.padding = show ? "8px" : "6px";
        missionSelectWrap.style.gap = show ? "6px" : "4px";
        preview.style.display = show ? "block" : "none";
      };

      const schedulePreviewSequence = () => {
        const steps = [
          { t: 35, show: true },
          { t: 41, show: false },
          { t: 50, show: true },
          { t: 55, show: false, lock: true }
        ];
        steps.forEach(({ t, show, lock }) => {
          setTimeout(() => {
            if (!missionSelectWrap || finalMinimizeLock) return;
            togglePreviewTimed(show);
            if (lock) finalMinimizeLock = true;
          }, t * 1000);
        });
      };

      schedulePreviewSequence();

      // expõe para rearmar a sequência (ex.: ao fechar overlay de vitória)
      window.runMissionPreviewSequence = () => {
        finalMinimizeLock = false;
        schedulePreviewSequence();
      };

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
        if (ignoreLabelClick) {
          ignoreLabelClick = false;
          return;
        }
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
        const formationsLabel = (m.formations && m.formations.length)
          ? m.formations.join(" / ")
          : m.formation;
        opt.textContent = `Card ${m.id} — ${formationsLabel}`;
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
        if (!finalMinimizeLock) {
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

    // drag do "Card da Vez" com swipe rápido horizontal para trocar missão
    let swipePointerId = null;
    let dragMode = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let dragHoldTimer = null;
    let dragOriginRect = null;

    cardEl.style.touchAction = "none";

    const setCardPosition = (left, top) => {
      cardEl.style.setProperty("position", "fixed", "important");
      cardEl.style.setProperty("left", `${left}px`, "important");
      cardEl.style.setProperty("top", `${top}px`, "important");
      cardEl.style.setProperty("right", "auto", "important");
      cardEl.style.setProperty("bottom", "auto", "important");
    };

    cardEl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      swipePointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragMode = null;
      dragOriginRect = cardEl.getBoundingClientRect();
      dragOffsetX = e.clientX - dragOriginRect.left;
      dragOffsetY = e.clientY - dragOriginRect.top;
      cardEl.setPointerCapture(swipePointerId);
      dragHoldTimer = setTimeout(() => {
        dragMode = "dragging";
        setCardPosition(dragOriginRect.left, dragOriginRect.top);
        cardEl.style.cursor = "grabbing";
      }, 160);
    });
    cardEl.addEventListener("pointermove", (e) => {
      if (swipePointerId === null || e.pointerId !== swipePointerId) return;
      if (dragStartX === null || dragStartY === null) {
        dragStartX = e.clientX;
        dragStartY = e.clientY;
      }
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (!dragMode) {
        const dist = Math.hypot(dx, dy);
        if (dist < 6) return;
        const isSwipe = Math.abs(dx) > Math.abs(dy) * 1.3;
        if (isSwipe) {
          dragMode = "swipe";
          if (dragHoldTimer) clearTimeout(dragHoldTimer);
          dragHoldTimer = null;
        } else {
          dragMode = "dragging";
          if (dragHoldTimer) clearTimeout(dragHoldTimer);
          dragHoldTimer = null;
          setCardPosition(dragOriginRect.left, dragOriginRect.top);
          cardEl.style.cursor = "grabbing";
        }
      }

      if (dragMode === "swipe") {
        if (Math.abs(dx) > 10) {
          randomMission();
          dragStartX = e.clientX;
          dragStartY = e.clientY;
        }
        return;
      }

      if (dragMode === "dragging") {
        const rect = cardEl.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width;
        const maxTop = window.innerHeight - rect.height;
        const nextLeft = Math.min(Math.max(0, e.clientX - dragOffsetX), Math.max(0, maxLeft));
        const nextTop = Math.min(Math.max(0, e.clientY - dragOffsetY), Math.max(0, maxTop));
        setCardPosition(nextLeft, nextTop);
      }
    });
    const endSwipe = () => {
      dragStartX = null;
      dragStartY = null;
      dragMode = null;
      dragOriginRect = null;
      if (dragHoldTimer) {
        clearTimeout(dragHoldTimer);
        dragHoldTimer = null;
      }
      cardEl.style.cursor = "";
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
