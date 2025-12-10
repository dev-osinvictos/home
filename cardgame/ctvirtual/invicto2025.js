// =============================================================
// ===== FUNÇÃO SEGURA PARA ESPERAR O DOM CARREGAR =============
// =============================================================
function onReady(fn) {
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn);
}

// =============================================================
// ====== MARKETPLACE + API ====================================
// =============================================================
async function setupMarketplace() {
  const marketBtn = document.getElementById("btn-market");
  const popupMarket = document.getElementById("popup-market");
  const closeMarket = document.getElementById("close-market");
  const marketItemsDiv = document.getElementById("market-items");
  const balanceBtn = document.getElementById("btn-show-gols-balance");

  if (!marketBtn || !popupMarket) return;

  marketBtn.addEventListener("click", async () => {
    popupMarket.style.display = "flex";
    console.log("🛒 Abrindo marketplace...");

    try {
      const res = await fetch("http://localhost:8080/api/market");
      const items = await res.json();
      marketItemsDiv.innerHTML = "";

      items.forEach(item => {
        const card = document.createElement("div");
        card.style.cssText = `
          background:#222;padding:10px;border:1px solid #333;
          border-radius:8px;margin-bottom:12px;
        `;
        card.innerHTML = `
          <b>${item.title}</b><br>
          <small>${item.description || ""}</small><br>
          <span style="color:#ffd700;font-weight:700;">${item.price_tokens} ✨</span><br><br>
          <button class="ai-button buy-btn" data-id="${item.id}" style="width:100%">
            Comprar
          </button>
        `;
        marketItemsDiv.appendChild(card);
      });

      document.querySelectorAll(".buy-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          const email = prompt("Seu e-mail para confirmar compra:");

          const res = await fetch("http://localhost:8080/api/market/buy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, item_id: id })
          });

          alert(res.ok ? "Compra realizada!" : "Falha na compra");
        });
      });

    } catch (err) {
      console.error("⚠ Erro API MARKET:", err);
      marketItemsDiv.innerHTML = `<div style="color:red;">Erro ao carregar marketplace!</div>`;
    }
  });

  closeMarket?.addEventListener("click", () => {
    popupMarket.style.display = "none";
  });

  if (balanceBtn) {
    balanceBtn.addEventListener("click", () => getGolsBalance());
  }

  console.log("✔ Marketplace pronto!");
}

// =============================================================
// ======= BALANCE GOLS ========================================
// =============================================================
async function getGolsBalance() {
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const user = accounts[0];

    const contract = new ethers.Contract(GOLS_ADDRESS, GOLS_ABI, new ethers.providers.Web3Provider(window.ethereum));
    const bal = await contract.balanceOf(user);
    alert(`Você tem ${ethers.utils.formatEther(bal)} GOLS`);
  } catch (err) {
    console.error("⚠ Erro ao pegar saldo:", err);
    alert("Erro ao conectar MetaMask!");
  }
}

// =============================================================
// ====== INICIAR TODOS OS SISTEMAS ============================
// =============================================================
onReady(() => {
  console.log("DOM pronto, iniciando sistemas...");
  setupMarketplace();
});
