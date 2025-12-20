    (function(){
      const menuBtn = document.getElementById('menu-button');
      const overlay = document.getElementById('menu-overlay');
      if(!menuBtn || !overlay) return;

      const loginLink = overlay.querySelector('.submenu[data-action="login"]');
      const faqLink = overlay.querySelector('.submenu[data-action="faq"]');

      function toggleMenu(forceClose = false){
        const expanded = menuBtn.getAttribute('aria-expanded') === 'true';
        const willOpen = forceClose ? false : !expanded;
        menuBtn.setAttribute('aria-expanded', String(willOpen));
        menuBtn.classList.toggle('open', willOpen);
        overlay.classList.toggle('open', willOpen);
        overlay.setAttribute('aria-hidden', String(!willOpen));
      }

      function getUser() {
        if (typeof window.getLoggedUser === 'function') return window.getLoggedUser();
        try { return JSON.parse(localStorage.getItem('ctv-user') || 'null'); } catch { return null; }
      }

      function updateAuthLink(user) {
        if (!loginLink) return;
        if (user) {
          loginLink.textContent = 'LOGOUT';
          loginLink.dataset.action = 'logout';
          loginLink.setAttribute('aria-label', 'Fazer logout e limpar cards');
        } else {
          loginLink.textContent = 'LOGIN';
          loginLink.dataset.action = 'login';
          loginLink.setAttribute('aria-label', 'Abrir login');
        }
      }

      function openLoginModal() {
        if (typeof window.openAuthModal === 'function') {
          window.openAuthModal();
        } else {
          const path = window.location.pathname.includes('ctvirtual') ? '../login.html' : './login.html';
          window.location.href = path;
        }
      }

      function openFaqPage() {
        const path = window.location.pathname.includes('ctvirtual') ? '../FAQ.html' : './FAQ.html';
        window.location.href = path;
      }

      function doLogout() {
        if (typeof window.logoutAndClearCards === 'function') {
          window.logoutAndClearCards();
        } else {
          localStorage.removeItem('ctv-user');
          localStorage.removeItem('ctv-user-cards');
          localStorage.removeItem('ctv-nft-list-cache');
        }
        updateAuthLink(null);
      }

      function handleAuthClick(e) {
        if (!loginLink) return;
        const action = loginLink.dataset.action || 'login';
        if (action === 'login') {
          e.preventDefault();
          openLoginModal();
          toggleMenu(true);
        } else if (action === 'logout') {
          e.preventDefault();
          doLogout();
          toggleMenu(true);
        }
      }

      if (loginLink) loginLink.addEventListener('click', handleAuthClick);
      if (faqLink) {
        faqLink.addEventListener('click', function(e) {
          e.preventDefault();
          openFaqPage();
          toggleMenu(true);
        });
      }

      document.addEventListener('auth:user', (ev) => {
        updateAuthLink(ev.detail);
      });

      updateAuthLink(getUser());

      menuBtn.addEventListener('click', () => toggleMenu());
      overlay.addEventListener('click', function(){
        if(overlay.classList.contains('open')) toggleMenu();
      });
      document.addEventListener('keydown', function(e){
        if(e.key === 'Escape' && overlay.classList.contains('open')) toggleMenu(true);
      });

      // sinaliza para outros scripts que o menu já gerencia login/logout
      window.__menuHandlesLogin = true;
    })();
