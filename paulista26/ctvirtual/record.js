(() => {
  const targetField = document.getElementById('background-square');
  if (!targetField) {
    return;
  }

  const controls = document.createElement('div');
  controls.className = 'record-controls';
  controls.innerHTML = `
    <button type="button" class="record-btn" data-action="record" aria-label="Record">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="7"></circle>
      </svg>
    </button>
    <button type="button" class="record-btn" data-action="play" aria-label="Play" disabled>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <polygon points="9,7 19,12 9,17"></polygon>
      </svg>
    </button>
    <button type="button" class="record-btn" data-action="stop" aria-label="Stop" disabled>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="7" y="7" width="10" height="10"></rect>
      </svg>
    </button>
  `;
  document.body.appendChild(controls);

  const recordBtn = controls.querySelector('[data-action="record"]');
  const playBtn = controls.querySelector('[data-action="play"]');
  const stopBtn = controls.querySelector('[data-action="stop"]');

  const RECORD_LIMIT_MS = 40000;
  const RECORD_INTERVAL_MS = 200;

  let gif = null;
  let captureTimer = null;
  let recordStopTimer = null;
  let lastGifUrl = '';
  let isRecording = false;
  let frames = [];
  let recordStart = 0;
  let playing = false;
  let playIndex = 0;
  let playOffset = 0;
  let playStart = 0;
  let playRaf = null;

  function getCaptureRect() {
    const rect = targetField.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    };
  }

  async function captureFrame() {
    if (!window.html2canvas || !gif) {
      return;
    }
    const rect = getCaptureRect();
    const canvas = await window.html2canvas(document.body, {
      backgroundColor: null,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      scale: 1.5
    });
    gif.addFrame(canvas, { delay: RECORD_INTERVAL_MS, copy: true });

    frames.push({
      t: Date.now() - recordStart,
      positions: getCardPositions()
    });
  }

  function getCardPositions() {
    const cards = Array.from(document.querySelectorAll('.selected-card-layer'));
    return cards.map((card) => ({
      id: card.dataset.circleId || '',
      left: parseFloat(card.style.left) || card.offsetLeft,
      top: parseFloat(card.style.top) || card.offsetTop
    }));
  }

  function setButtonState() {
    recordBtn.disabled = false;
    stopBtn.disabled = !isRecording;
    playBtn.disabled = !frames.length || isRecording;
    recordBtn.title = isRecording ? 'Gravando' : 'Record';
  }

  function stopPlayback() {
    if (playRaf) {
      cancelAnimationFrame(playRaf);
    }
    playing = false;
    playIndex = 0;
    playOffset = 0;
    playStart = 0;
    playRaf = null;
    setButtonState();
  }

  function stopRecording() {
    if (!isRecording || !gif) {
      return;
    }
    isRecording = false;
    clearInterval(captureTimer);
    captureTimer = null;
    clearTimeout(recordStopTimer);
    recordStopTimer = null;
    setButtonState();
    gif.render();
  }

  function startRecording() {
    if (isRecording || !window.GIF) {
      return;
    }
    stopPlayback();
    frames = [];
    recordStart = Date.now();
    gif = new window.GIF({
      workers: 2,
      quality: 10,
      workerScript: 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js',
      width: Math.round(targetField.getBoundingClientRect().width),
      height: Math.round(targetField.getBoundingClientRect().height)
    });

    gif.on('finished', (blob) => {
      if (lastGifUrl) {
        URL.revokeObjectURL(lastGifUrl);
      }
      lastGifUrl = URL.createObjectURL(blob);
      playBtn.disabled = false;
      const file = new File([blob], 'guarani-time.gif', { type: 'image/gif' });
      const title = 'Guarani F.C. @PAULISTAO 2026';
      const text = 'Meu time escalado no CT Virtual';
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ title, text, files: [file] }).catch(() => {});
      } else {
        const link = document.createElement('a');
        link.href = lastGifUrl;
        link.download = 'guarani-time.gif';
        link.click();
      }
    });

    isRecording = true;
    setButtonState();
    captureFrame();
    captureTimer = setInterval(captureFrame, RECORD_INTERVAL_MS);
    recordStopTimer = setTimeout(stopRecording, RECORD_LIMIT_MS);
  }

  function applyFrame(frame) {
    frame.positions.forEach((pos) => {
      if (!pos.id) {
        return;
      }
      const el = document.querySelector(`.selected-card-layer[data-circle-id="${pos.id}"]`);
      if (!el) return;
      el.style.left = `${pos.left}px`;
      el.style.top = `${pos.top}px`;
    });
  }

  function playbackLoop(timestamp) {
    if (!playStart) playStart = timestamp - playOffset;
    const elapsed = timestamp - playStart;
    while (playIndex < frames.length && frames[playIndex].t <= elapsed) {
      applyFrame(frames[playIndex]);
      playIndex += 1;
    }
    if (playIndex >= frames.length) {
      stopPlayback();
      return;
    }
    playRaf = requestAnimationFrame(playbackLoop);
  }

  function startPlayback() {
    if (!frames.length || isRecording) return;
    playing = true;
    playIndex = 0;
    playStart = 0;
    playOffset = 0;
    setButtonState();
    playRaf = requestAnimationFrame(playbackLoop);
  }

  function playLastGif() {
    if (!lastGifUrl) {
      return;
    }
    window.open(lastGifUrl, '_blank');
  }

  recordBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    startRecording();
  });
  stopBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    }
    if (playing) {
      stopPlayback();
    }
  });
  playBtn.addEventListener('click', () => {
    if (playing) {
      return;
    }
    startPlayback();
  });

  setButtonState();
  window.recordTimePositions = startRecording;
})();
