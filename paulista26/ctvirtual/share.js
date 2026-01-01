(() => {
  const placedLayer = document.getElementById('placed-cards-layer');
  if (!placedLayer) {
    return;
  }

  const button = document.createElement('button');
  button.id = 'share-team';
  button.className = 'share-team';
  button.type = 'button';
  button.textContent = 'Compartilhar time';
  button.hidden = true;
  document.body.appendChild(button);

  const targetField = document.getElementById('background-square') ||
    document.getElementById('trace-canvas') ||
    document.body;

  function getPlacedCount() {
    return Array.from(placedLayer.querySelectorAll('.selected-card-layer'))
      .filter((layerEl) => layerEl.dataset.cardSrc)
      .length;
  }

  function updateButton() {
    button.hidden = getPlacedCount() < 11;
  }

  function getCaptureRect() {
    const elements = [
      targetField,
      document.querySelector('.tactics-panel'),
      ...document.querySelectorAll('.circle'),
      ...placedLayer.querySelectorAll('.selected-card-layer')
    ].filter(Boolean);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      minX = Math.min(minX, rect.left);
      minY = Math.min(minY, rect.top);
      maxX = Math.max(maxX, rect.right);
      maxY = Math.max(maxY, rect.bottom);
    });

    if (!Number.isFinite(minX)) {
      const rect = targetField.getBoundingClientRect();
      return rect;
    }

    const padding = 14;
    return {
      left: minX - padding,
      top: minY - padding,
      right: maxX + padding,
      bottom: maxY + padding
    };
  }

  async function captureFieldImage() {
    if (!window.html2canvas) {
      throw new Error('html2canvas nao carregado');
    }
    const rect = getCaptureRect();
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;
    const canvas = await window.html2canvas(document.body, {
      backgroundColor: null,
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width,
      height,
      scale: 2
    });
    return canvas;
  }

  async function shareImage() {
    button.disabled = true;
    button.textContent = 'Gerando imagem...';
    try {
      const canvas = await captureFieldImage();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        throw new Error('Falha ao gerar imagem');
      }
      const file = new File([blob], 'guarani-time.png', { type: 'image/png' });
      const title = 'Guarani F.C. @PAULISTAO 2026';
      const text = 'Meu time escalado no CT Virtual';
      const url = 'https://osinvictos.com.br/paulista26/ctvirtual/';
      const shareText = `${text} ${url}`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text: shareText, files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'guarani-time.png';
        link.click();
        URL.revokeObjectURL(url);
        alert(`Imagem salva. Compartilhe a imagem e o link: ${shareText}`);
        window.open('https://osinvictos.com.br/paulista26/ctvirtual/', '_blank');
      }
    } catch (error) {
      alert('Nao foi possivel gerar a imagem do time.');
    } finally {
      button.disabled = false;
      button.textContent = 'Compartilhar time';
    }
  }

  button.addEventListener('click', shareImage);
  document.addEventListener('cards-updated', updateButton);
  updateButton();
})();
