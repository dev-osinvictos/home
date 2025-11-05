// === Popup da camisa Invicto ===
function popupInvicto() {
  const popup = document.getElementById("popup-invicto");
  if (!popup) {
    console.error("❌ popup-invicto não encontrado no DOM.");
    return;
  }
  popup.classList.add("show");
}

// fechar popup
document.addEventListener("DOMContentLoaded", () => {

  const closeBtn = document.getElementById("close-popup-invicto");
  const logo = document.getElementById("logo-container");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.getElementById("popup-invicto").classList.remove("show");
    });
  }

  if (logo) {
    logo.style.cursor = "pointer";
    logo.addEventListener("click", popupInvicto);
  }
});

