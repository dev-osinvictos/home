  (function () {
    const MOBILE_BREAKPOINT = 768;
    let isMobile = null;

    function detectMobile() {
      return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < MOBILE_BREAKPOINT;
    }

    function setFixedPos(el, left, top) {
      if (!el) return;
      el.style.position = "fixed";
      el.style.left = left;
      el.style.top = top;
      el.style.bottom = "";
    }

    function setHeight(el, height) {
      if (!el) return;
      el.style.height = height;
      el.style.maxHeight = height;
    }

    function applyLayout() {
      const nowMobile = detectMobile();
      if (isMobile === nowMobile) return;
      isMobile = nowMobile;
      if (isMobile) return; // mantém como está no mobile

      const listHeight = "450px";

      setFixedPos(document.getElementById("btn-criar-campo"), "400px", "70px");
      setFixedPos(document.getElementById("room-user-indicator"), "400px", "100px");
      setFixedPos(document.getElementById("nft-list-container"), "400px", "200px"); // Cards conquistados
      setFixedPos(document.getElementById("ai-analise-btn"), "400px", "30px");
      setFixedPos(document.getElementById("score-hud"), "470px", "30px");
      setHeight(document.getElementById("nft-list-container"), listHeight);
      setHeight(document.getElementById("nft-list-body"), listHeight);
    }

    document.addEventListener("DOMContentLoaded", applyLayout);
    window.addEventListener("resize", applyLayout);
  })();
