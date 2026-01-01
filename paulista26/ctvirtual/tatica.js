(() => {
  const circles = Array.from(document.querySelectorAll('.circle'));
  if (!circles.length) {
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'tactics-panel';
  panel.innerHTML = `
    <label class="tactics-label" for="tactics-select">ESQUEMA TÁTICO {Filosofia Carlos Alberto Silva}</label>
    <select id="tactics-select" class="tactics-select">
      <optgroup label="Com posse de bola">
        <option value="4-2-3-1">4-2-3-1</option>
        <option value="4-3-3" selected>4-3-3</option>
        <option value="4-1-4-1">4-1-4-1</option>
        <option value="4-2-4">4-2-4</option>
      </optgroup>
      <optgroup label="Sem posse de bola">
        <option value="4-5-1">4-5-1</option>
        <option value="4-4-2">4-4-2</option>
        <option value="4-3-3">4-3-3</option>
        <option value="5-4-1">5-4-1</option>
        <option value="5-3-2">5-3-2</option>
        <option value="4-1-4-1">4-1-4-1</option>
      </optgroup>
    </select>
    <div id="tactics-notes" class="tactics-notes"></div>
  `;
  document.body.appendChild(panel);

  const notesByFormation = {
    "4-2-3-1": [
      "infiltracao paciente",
      "controle do ritmo",
      "camisa 10 como organizador"
    ],
    "4-3-3": [
      "atacar half-spaces",
      "amplitude maxima",
      "postura base ofensiva"
    ],
    "4-1-4-1": [
      "ganhar o meio",
      "superioridade central",
      "ataque organizado"
    ],
    "4-2-4": [
      "atacar costas dos alas",
      "agressividade controlada",
      "momento de ruptura"
    ],
    "4-5-1": [
      "fechar o meio",
      "negar jogo interior"
    ],
    "4-4-2": [
      "espelhamento seguro",
      "encaixe no camisa 10"
    ],
    "5-4-1": [
      "cobrir dois atacantes",
      "bloco baixo compacto"
    ],
    "5-3-2": [
      "alas recuam",
      "protecao da area"
    ]
  };

  const layoutByFormation = {
    "4-2-3-1": [
      { ids: [2, 3, 4, 5], y: 480, minX: 60, maxX: 300 },
      { ids: [6, 7], y: 360, minX: 140, maxX: 220 },
      { ids: [8, 9, 10], y: 260, minX: 80, maxX: 280 },
      { ids: [11], y: 140, minX: 180, maxX: 180 }
    ],
    "4-3-3": [
      { ids: [2, 3, 4, 5], y: 480, minX: 60, maxX: 300 },
      { ids: [6, 7, 8], y: 320, minX: 90, maxX: 270 },
      { ids: [9, 10, 11], y: 140, minX: 90, maxX: 270 }
    ],
    "4-1-4-1": [
      { ids: [2, 3, 4, 5], y: 480, minX: 60, maxX: 300 },
      { ids: [6], y: 360, minX: 180, maxX: 180 },
      { ids: [7, 8, 9, 10], y: 260, minX: 70, maxX: 290 },
      { ids: [11], y: 140, minX: 180, maxX: 180 }
    ],
    "4-2-4": [
      { ids: [2, 3, 4, 5], y: 480, minX: 60, maxX: 300 },
      { ids: [6, 7], y: 340, minX: 140, maxX: 220 },
      { ids: [8, 9, 10, 11], y: 150, minX: 60, maxX: 300 }
    ],
    "4-5-1": [
      { ids: [2, 3, 4, 5], y: 480, minX: 60, maxX: 300 },
      { ids: [6, 7, 8, 9, 10], y: 320, minX: 60, maxX: 300 },
      { ids: [11], y: 150, minX: 180, maxX: 180 }
    ],
    "4-4-2": [
      { ids: [2, 3, 4, 5], y: 480, minX: 60, maxX: 300 },
      { ids: [6, 7, 8, 9], y: 320, minX: 70, maxX: 290 },
      { ids: [10, 11], y: 160, minX: 140, maxX: 220 }
    ],
    "5-4-1": [
      { ids: [2, 3, 4, 5, 6], y: 490, minX: 50, maxX: 310 },
      { ids: [7, 8, 9, 10], y: 320, minX: 70, maxX: 290 },
      { ids: [11], y: 150, minX: 180, maxX: 180 }
    ],
    "5-3-2": [
      { ids: [2, 3, 4, 5, 6], y: 490, minX: 50, maxX: 310 },
      { ids: [7, 8, 9], y: 320, minX: 100, maxX: 260 },
      { ids: [10, 11], y: 170, minX: 140, maxX: 220 }
    ]
  };

  function spreadPositions(ids, y, minX, maxX) {
    if (!ids.length) return [];
    if (ids.length === 1) {
      return [{ id: ids[0], x: minX, y }];
    }
    const step = (maxX - minX) / (ids.length - 1);
    return ids.map((id, index) => ({
      id,
      x: Math.round(minX + step * index),
      y
    }));
  }

  function applyFormation(name) {
    const layout = layoutByFormation[name];
    if (!layout) {
      return;
    }

    const circleById = {};
    circles.forEach((circle) => {
      const id = Number(circle.id.replace('circle', ''));
      if (!Number.isNaN(id)) {
        circleById[id] = circle;
      }
    });

    const positions = [];
    layout.forEach((line) => {
      positions.push(...spreadPositions(line.ids, line.y, line.minX, line.maxX));
    });

    if (circleById[1]) {
      circleById[1].style.left = '180px';
      circleById[1].style.top = '520px';
    }

    const verticalShift = -90;
    positions.forEach((pos) => {
      const circle = circleById[pos.id];
      if (!circle) return;
      circle.style.left = `${pos.x}px`;
      circle.style.top = `${pos.y + verticalShift}px`;
    });

    const placedLayer = document.getElementById('placed-cards-layer');
    if (placedLayer) {
      placedLayer.querySelectorAll('.selected-card-layer').forEach((layerEl) => {
        const circleId = layerEl.getAttribute('data-circle-id');
        const circle = circleId ? document.getElementById(circleId) : null;
        if (!circle) return;
        const rect = circle.getBoundingClientRect();
        const layerWidth = layerEl.offsetWidth;
        const layerHeight = layerEl.offsetHeight;
        const offsetX = Number(layerEl.dataset.offsetX || 0);
        const offsetY = Number(layerEl.dataset.offsetY || 0);
        const left = window.scrollX + rect.left + rect.width / 2 - layerWidth / 2 + offsetX;
        const top = window.scrollY + rect.top + rect.height / 2 - layerHeight / 2 + offsetY;
        layerEl.style.left = `${left}px`;
        layerEl.style.top = `${top}px`;
      });
    }

    const notes = document.getElementById('tactics-notes');
    if (notes) {
      const lines = notesByFormation[name] || [];
      notes.textContent = lines.join(" • ");
    }
  }

  const select = document.getElementById('tactics-select');
  if (select) {
    select.addEventListener('change', (event) => {
      applyFormation(event.target.value);
    });
  }

  applyFormation('4-3-3');
})();
