 (function() {
      const container = document.getElementById('guarani-cards');
      const placedLayer = document.getElementById('placed-cards-layer');
      const track = container ? container.querySelector('.guarani-cards-track') : null;
      const circles = document.querySelectorAll('.circle');
      let activeCircle = null;
      if (!container || !circles.length) {
        return;
      }

      function positionContainer(target) {
        const rect = target.getBoundingClientRect();
        const containerHeight = container.offsetHeight;
        const targetCenterY = window.scrollY + rect.top + rect.height / 2;
        let top = targetCenterY - containerHeight / 2;
        const minTop = window.scrollY + 8;
        const maxTop = window.scrollY + window.innerHeight - containerHeight - 8;

        if (maxTop >= minTop) {
          top = Math.max(minTop, Math.min(top, maxTop));
        }

        container.style.top = `${top}px`;
      }

      circles.forEach((circle) => {
        circle.addEventListener('click', () => {
          if (circle.dataset.wasDragged === 'true') {
            circle.dataset.wasDragged = 'false';
            return;
          }
          circles.forEach((item) => item.classList.remove('active'));
          circle.classList.add('active');
          activeCircle = circle;
          positionContainer(circle);
          container.classList.add('open');
          container.setAttribute('aria-hidden', 'false');
        });
      });

      function positionLayer(layerEl, target) {
        const rect = target.getBoundingClientRect();
        const layerWidth = layerEl.offsetWidth;
        const layerHeight = layerEl.offsetHeight;
        const offsetX = Number(layerEl.dataset.offsetX || 0);
        const offsetY = Number(layerEl.dataset.offsetY || 0);
        const left = window.scrollX + rect.left + rect.width / 2 - layerWidth / 2 + offsetX;
        const top = window.scrollY + rect.top + rect.height / 2 - layerHeight / 2 + offsetY;
        layerEl.style.left = `${left}px`;
        layerEl.style.top = `${top}px`;
      }

      function startDraggable(element, options = {}) {
        if (element.dataset.dragReady === 'true') {
          return;
        }
        element.dataset.dragReady = 'true';
        element.style.touchAction = 'none';
        const threshold = options.threshold ?? 4;
        let isPointerDown = false;
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let originLeft = 0;
        let originTop = 0;

        element.addEventListener('pointerdown', (event) => {
          if (event.button !== 0) {
            return;
          }
          event.preventDefault();
          isPointerDown = true;
          isDragging = false;
          startX = event.clientX;
          startY = event.clientY;
          originLeft = parseFloat(element.style.left) || element.offsetLeft;
          originTop = parseFloat(element.style.top) || element.offsetTop;
          element.setPointerCapture(event.pointerId);
          options.onStart?.(element);
        });

        element.addEventListener('pointermove', (event) => {
          if (!isPointerDown) {
            return;
          }
          const dx = event.clientX - startX;
          const dy = event.clientY - startY;
          if (!isDragging && Math.hypot(dx, dy) < threshold) {
            return;
          }
          if (!isDragging) {
            isDragging = true;
            element.classList.add('dragging');
            element.dataset.wasDragged = 'true';
          }
          element.style.left = `${originLeft + dx}px`;
          element.style.top = `${originTop + dy}px`;
          options.onMove?.(element);
        });

        const endDrag = (event) => {
          if (!isPointerDown) {
            return;
          }
          isPointerDown = false;
          if (isDragging) {
            element.classList.remove('dragging');
            options.onEnd?.(element);
          }
          if (event?.pointerId != null && element.hasPointerCapture(event.pointerId)) {
            element.releasePointerCapture(event.pointerId);
          }
        };

        element.addEventListener('pointerup', endDrag);
        element.addEventListener('pointercancel', endDrag);
      }

      function enableLayerDrag(layerEl) {
        startDraggable(layerEl, {
          onEnd: (el) => {
            const circleId = el.dataset.circleId;
            const circle = circleId ? document.getElementById(circleId) : null;
            if (!circle) {
              return;
            }
            const circleRect = circle.getBoundingClientRect();
            const circleCenterX = window.scrollX + circleRect.left + circleRect.width / 2;
            const circleCenterY = window.scrollY + circleRect.top + circleRect.height / 2;
            const layerCenterX = (parseFloat(el.style.left) || 0) + el.offsetWidth / 2;
            const layerCenterY = (parseFloat(el.style.top) || 0) + el.offsetHeight / 2;
            el.dataset.offsetX = Math.round(layerCenterX - circleCenterX);
            el.dataset.offsetY = Math.round(layerCenterY - circleCenterY);
          }
        });
      }

      function getOrCreateLayer(circle) {
        if (!placedLayer) {
          return null;
        }
        const id = circle.getAttribute('id');
        const existing = placedLayer.querySelector(`[data-circle-id="${id}"]`);
        if (existing) {
          enableLayerDrag(existing);
          return existing;
        }
        const layerEl = document.createElement('div');
        layerEl.className = 'selected-card-layer';
        layerEl.dataset.circleId = id || '';
        const img = document.createElement('img');
        img.alt = 'Card selecionado';
        img.draggable = false;
        layerEl.appendChild(img);
        placedLayer.appendChild(layerEl);
        enableLayerDrag(layerEl);
        return layerEl;
      }

      circles.forEach((circle) => {
        startDraggable(circle, {
          onMove: (el) => {
            if (!placedLayer) {
              return;
            }
            const layerEl = placedLayer.querySelector(`[data-circle-id="${el.id}"]`);
            if (layerEl) {
              positionLayer(layerEl, el);
            }
          },
          onEnd: (el) => {
            if (!placedLayer) {
              return;
            }
            const layerEl = placedLayer.querySelector(`[data-circle-id="${el.id}"]`);
            if (layerEl) {
              positionLayer(layerEl, el);
            }
          }
        });
      });

      function createCardElement(src, alt) {
        const card = document.createElement('img');
        card.className = 'guarani-card';
        card.src = src;
        card.alt = alt || 'Card';
        return card;
      }

      function notifyCardsUpdated() {
        if (!placedLayer) {
          return;
        }
        const count = Array.from(placedLayer.querySelectorAll('.selected-card-layer'))
          .filter((layerEl) => layerEl.dataset.cardSrc)
          .length;
        document.dispatchEvent(new CustomEvent('cards-updated', { detail: { count } }));
      }

      if (track) {
        track.addEventListener('click', (event) => {
          const card = event.target.closest('.guarani-card');
          if (!card || !activeCircle) {
            return;
          }
          const layerEl = getOrCreateLayer(activeCircle);
          if (!layerEl) {
            return;
          }
          const newSrc = card.getAttribute('src') || '';
          const newAlt = card.getAttribute('alt') || 'Card selecionado';
          const previousSrc = layerEl.dataset.cardSrc || '';
          const previousAlt = layerEl.dataset.cardAlt || '';

          if (previousSrc && previousSrc !== newSrc) {
            const restored = createCardElement(previousSrc, previousAlt || 'Card');
            track.appendChild(restored);
          }

          const img = layerEl.querySelector('img');
          if (img) {
            img.src = newSrc;
            img.alt = newAlt;
          }
          layerEl.dataset.cardSrc = newSrc;
          layerEl.dataset.cardAlt = newAlt;
          layerEl.dataset.offsetX = '0';
          layerEl.dataset.offsetY = '0';
          positionLayer(layerEl, activeCircle);
          layerEl.classList.add('open');
          layerEl.setAttribute('aria-hidden', 'false');
          card.remove();
          container.classList.remove('open');
          container.setAttribute('aria-hidden', 'true');
          notifyCardsUpdated();
        });
      }

      if (placedLayer) {
        const openSwap = (layerEl) => {
          const isMobile = window.matchMedia('(max-width: 767px)').matches;
          if (!isMobile && layerEl.dataset.wasDragged === 'true') {
            layerEl.dataset.wasDragged = 'false';
            return;
          }
          const circleId = layerEl.dataset.circleId;
          const circle = circleId ? document.getElementById(circleId) : null;
          if (!circle) {
            return;
          }
          circles.forEach((item) => item.classList.remove('active'));
          circle.classList.add('active');
          activeCircle = circle;
          positionContainer(circle);
          container.classList.add('open');
          container.setAttribute('aria-hidden', 'false');
        };

        placedLayer.addEventListener('pointerup', (event) => {
          const layerEl = event.target.closest('.selected-card-layer');
          if (!layerEl) {
            return;
          }
          openSwap(layerEl);
        });
      }

      window.addEventListener('resize', () => {
        if (!container.classList.contains('open')) {
          return;
        }
        const active = document.querySelector('.circle.active');
        if (active) {
          positionContainer(active);
        }
        if (placedLayer) {
          placedLayer.querySelectorAll('.selected-card-layer.open').forEach((layerEl) => {
            const circleId = layerEl.getAttribute('data-circle-id');
            const circle = circleId ? document.getElementById(circleId) : null;
            if (circle) {
              positionLayer(layerEl, circle);
            }
          });
        }
      });
    })();
