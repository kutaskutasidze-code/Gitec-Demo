document.addEventListener('DOMContentLoaded', function () {

  /* ====================================================
     MOBILE MENU
     ==================================================== */
  var menuToggle = document.querySelector('.mobile-menu-toggle');
  var navMenu = document.querySelector('.nav-menu');
  var menuClose = document.querySelector('.mobile-menu-close');
  var overlay = document.createElement('div');
  overlay.className = 'mobile-menu-overlay';
  document.body.appendChild(overlay);

  function openMenu() {
    navMenu.classList.add('open');
    overlay.classList.add('active');
    menuToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    navMenu.classList.remove('open');
    overlay.classList.remove('active');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', openMenu);
  }
  if (menuClose) {
    menuClose.addEventListener('click', closeMenu);
  }
  overlay.addEventListener('click', closeMenu);

  navMenu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 768) closeMenu();
  });

  /* ====================================================
     0. RECENTLY VIEWED
     ==================================================== */
  var RV_KEY = 'gitec_recently_viewed';

  function getRecentlyViewed() {
    try { return JSON.parse(sessionStorage.getItem(RV_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveRecentlyViewed(item) {
    var items = getRecentlyViewed();
    // Remove duplicate by title
    items = items.filter(function (i) { return i.title !== item.title; });
    // Add to front
    items.unshift(item);
    // Max 10
    if (items.length > 10) items = items.slice(0, 10);
    sessionStorage.setItem(RV_KEY, JSON.stringify(items));
  }

  function renderRecentlyViewed() {
    var section = document.getElementById('recently-viewed');
    if (!section) return;
    var scroll = section.querySelector('.recently-scroll');
    if (!scroll) return;
    var items = getRecentlyViewed();
    if (items.length === 0) { section.style.display = 'none'; return; }
    scroll.innerHTML = '';
    items.forEach(function (item) {
      var a = document.createElement('a');
      a.className = 'recently-item';
      a.href = item.href || 'product.html';
      a.innerHTML = '<img src="' + item.img + '" alt=""><p>' + item.title + '</p>';
      scroll.appendChild(a);
    });
    section.style.display = '';
  }

  // Track clicks on product cards
  document.addEventListener('click', function (e) {
    var link = e.target.closest('.product-card a[href^="product.html"]');
    if (!link) return;
    var card = link.closest('.product-card');
    if (!card) return;
    var imgEl = card.querySelector('.product-img img');
    var titleEl = card.querySelector('.product-title a');
    if (!imgEl || !titleEl) return;
    saveRecentlyViewed({
      img: imgEl.src,
      title: titleEl.textContent.trim(),
      href: link.getAttribute('href') || 'product.html'
    });
  });

  renderRecentlyViewed();

  /* ====================================================
     0.5 TOAST NOTIFICATION SYSTEM
     ==================================================== */
  function showToast(message, type) {
    // type: 'success', 'info', 'warning'
    var toast = document.createElement('div');
    toast.className = 'gitec-toast ' + (type || 'success');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.remove(); }, 300);
    }, 2500);
  }

  /* ====================================================
     0.6 CART SYSTEM (uses GitecAPI when available)
     ==================================================== */
  var CART_KEY = 'gitec_cart';
  var _api = window.GitecAPI || null;

  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch(e) { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateHeaderCounts();
  }

  function addToCart(product) {
    if (_api) {
      _api.addToCart(product).then(function() {
        updateHeaderCounts();
      }).catch(function() { /* silent */ });
    }
    // Always update localStorage too (guest fallback + instant UI)
    var cart = getCart();
    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === product.id) { existing = cart[i]; break; }
    }
    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      product.qty = 1;
      cart.push(product);
    }
    saveCart(cart);
    showToast(product.name + ' added to cart', 'success');
  }

  function removeFromCart(id) {
    if (_api && _api.isLoggedIn()) {
      _api.removeFromCart(id).then(function() { updateHeaderCounts(); }).catch(function() {});
    }
    var cart = getCart().filter(function(item) { return item.id !== id; });
    saveCart(cart);
  }

  function updateCartQty(id, qty) {
    if (_api && _api.isLoggedIn()) {
      _api.updateCartQty(id, qty).catch(function() {});
    }
    var cart = getCart();
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) { cart[i].qty = Math.max(1, qty); break; }
    }
    saveCart(cart);
  }

  function getCartCount() {
    return getCart().reduce(function(sum, item) { return sum + (item.qty || 1); }, 0);
  }

  function getCartTotal() {
    return getCart().reduce(function(sum, item) { return sum + item.price * (item.qty || 1); }, 0);
  }

  /* ====================================================
     0.7 WISHLIST SYSTEM (uses GitecAPI when available)
     ==================================================== */
  var WL_KEY = 'gitec_wishlist';

  function getWishlist() {
    try { return JSON.parse(localStorage.getItem(WL_KEY)) || []; }
    catch(e) { return []; }
  }

  function saveWishlist(wl) {
    localStorage.setItem(WL_KEY, JSON.stringify(wl));
    updateHeaderCounts();
  }

  function addToWishlist(product) {
    var wl = getWishlist();
    for (var i = 0; i < wl.length; i++) {
      if (wl[i].id === product.id) {
        showToast('Already in wishlist', 'info');
        return;
      }
    }
    if (_api && _api.isLoggedIn()) {
      _api.addToWishlist(product).catch(function() {});
    }
    wl.push(product);
    saveWishlist(wl);
    showToast(product.name + ' added to wishlist', 'success');
  }

  function removeFromWishlist(id) {
    if (_api && _api.isLoggedIn()) {
      _api.removeFromWishlist(id).catch(function() {});
    }
    var wl = getWishlist().filter(function(item) { return item.id !== id; });
    saveWishlist(wl);
  }

  function getWishlistCount() {
    return getWishlist().length;
  }

  /* ====================================================
     0.8 HEADER BADGE UPDATES
     ==================================================== */
  function updateHeaderCounts() {
    var cartCounts = document.querySelectorAll('.header-action .count');
    var cartCount = getCartCount();
    var wlCount = getWishlistCount();
    // Cart is the last .count, wishlist is the second
    if (cartCounts.length >= 2) {
      cartCounts[0].textContent = wlCount;
      cartCounts[1].textContent = cartCount;
    }
  }
  updateHeaderCounts();

  /* ====================================================
     0.9 EXTRACT PRODUCT DATA FROM CARD
     ==================================================== */
  function extractProductFromCard(card) {
    var titleEl = card.querySelector('.product-title a');
    var priceEl = card.querySelector('.product-price .current');
    var imgEl = card.querySelector('.product-img img');
    var catEl = card.querySelector('.product-category');
    if (!titleEl) return null;
    var priceText = priceEl ? priceEl.textContent.replace(/[^\d.]/g, '') : '0';
    return {
      id: parseInt(card.dataset.productId) || 0,
      name: titleEl.textContent.trim(),
      price: parseFloat(priceText),
      image: imgEl ? imgEl.src : '',
      category: catEl ? catEl.textContent.trim() : ''
    };
  }

  /* ====================================================
     1. STICKY HEADER SHADOW
     ==================================================== */
  var header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', function () {
      header.classList.toggle('scrolled', window.scrollY > 10);
    });
  }

  /* ====================================================
     2. HERO SLIDER
     ==================================================== */
  var slides = document.querySelector('.hero-slides');
  var dots = document.querySelectorAll('.hero-dot');
  var prevBtn = document.querySelector('.hero-arrow.prev');
  var nextBtn = document.querySelector('.hero-arrow.next');
  var current = 0;
  var total = document.querySelectorAll('.hero-slide').length;

  function goTo(i) {
    if (!slides || total === 0) return;
    current = (i + total) % total;
    slides.style.transform = 'translateX(-' + current * 100 + '%)';
    dots.forEach(function (d, idx) { d.classList.toggle('active', idx === current); });
  }

  if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); });
  dots.forEach(function (d, i) { d.addEventListener('click', function () { goTo(i); }); });

  if (total > 1) {
    setInterval(function () { goTo(current + 1); }, 5000);
  }

  /* ====================================================
     3. QUANTITY CONTROLS
     ==================================================== */
  document.querySelectorAll('.qty-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = this.parentElement.querySelector('input');
      var v = parseInt(input.value) || 1;
      if (this.classList.contains('minus')) { input.value = Math.max(1, v - 1); }
      else { input.value = v + 1; }
    });
  });

  /* ====================================================
     4. ADD-TO-CART FEEDBACK (with real cart functionality)
     ==================================================== */
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.add-to-cart');
    if (!btn) return;
    e.preventDefault();
    var card = btn.closest('.product-card');
    if (card) {
      var product = extractProductFromCard(card);
      if (product) addToCart(product);
    }
    // Visual feedback
    var orig = btn.innerHTML;
    btn.innerHTML = '&#10003; Added';
    btn.style.background = '#22c55e';
    setTimeout(function() { btn.innerHTML = orig; btn.style.background = ''; }, 1200);
  });

  /* ====================================================
     4.1 WISHLIST BUTTON HANDLER
     ==================================================== */
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.product-action-btn[title="Wishlist"]');
    if (!btn) return;
    e.preventDefault();
    var card = btn.closest('.product-card');
    if (card) {
      var product = extractProductFromCard(card);
      if (product) addToWishlist(product);
    }
  });

  /* ====================================================
     4.2 SEARCH FUNCTIONALITY
     ==================================================== */
  var searchBar = document.querySelector('.search-bar');
  if (searchBar) {
    var searchInput = searchBar.querySelector('input');
    var searchBtn = searchBar.querySelector('button');

    function doSearch() {
      var query = searchInput.value.trim();
      if (query) {
        window.location.href = 'category.html?search=' + encodeURIComponent(query);
      }
    }

    if (searchBtn) searchBtn.addEventListener('click', function(e) { e.preventDefault(); doSearch(); });
    if (searchInput) searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
    });
  }

  /* ====================================================
     4.3 NEWSLETTER HANDLER
     ==================================================== */
  document.querySelectorAll('.footer-nl-form').forEach(function(form) {
    form.onsubmit = null;
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var input = this.querySelector('input[type="email"]');
      if (input && input.value.trim()) {
        if (_api) {
          _api.subscribeNewsletter(input.value.trim()).then(function(data) {
            showToast(data.message || 'Successfully subscribed!', 'success');
            input.value = '';
          }).catch(function(err) {
            showToast(err.message || 'Subscription failed', 'warning');
          });
        } else {
          showToast('Successfully subscribed!', 'success');
          input.value = '';
        }
      } else {
        showToast('Please enter your email', 'warning');
      }
    });
  });

  /* ====================================================
     4.4 LOGIN/REGISTER HANDLER
     ==================================================== */
  var loginForm = document.querySelector('.auth-form');
  if (loginForm) {
    var authForms = document.querySelectorAll('.auth-form');
    authForms.forEach(function(form) {
      form.onsubmit = null;
      form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Detect login vs register by checking for #reg-name field
        var regNameEl = document.getElementById('reg-name');
        var isRegister = regNameEl && this.contains(regNameEl);

        var email, password, fullName, phone;

        if (isRegister) {
          fullName = (document.getElementById('reg-name').value || '').trim();
          email = (document.getElementById('reg-email').value || '').trim();
          password = document.getElementById('reg-password').value || '';
          var confirm = document.getElementById('reg-confirm').value || '';
          phone = (document.getElementById('reg-phone').value || '').trim();
          var dobDayEl = document.getElementById('reg-dob-day');
          var dobMonthEl = document.getElementById('reg-dob-month');
          var dobYearEl = document.getElementById('reg-dob-year');
          var dobDay = dobDayEl ? dobDayEl.value : '';
          var dobMonth = dobMonthEl ? dobMonthEl.value : '';
          var dobYear = dobYearEl ? dobYearEl.value : '';
          var dob = dobDay && dobMonth && dobYear ? dobDay + '/' + dobMonth + '/' + dobYear : '';
          var termsCheckbox = document.getElementById('reg-terms');

          if (!fullName || !email || !password || !phone || !dob) {
            showToast('Please fill in all fields', 'warning');
            return;
          }
          if (termsCheckbox && !termsCheckbox.checked) {
            showToast('You must agree to the terms and conditions', 'warning');
            return;
          }
          if (password !== confirm) {
            showToast('Passwords do not match', 'warning');
            return;
          }
          if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'warning');
            return;
          }
        } else {
          email = (document.getElementById('login-email').value || '').trim();
          password = document.getElementById('login-password').value || '';
          fullName = '';

          if (!email || !password) {
            showToast('Please fill in all fields', 'warning');
            return;
          }
        }

        if (_api) {
          var action = isRegister
            ? _api.register(email, password, fullName, phone, dob)
            : _api.login(email, password);

          action.then(function(data) {
            showToast(isRegister ? 'Account created!' : 'Login successful!', 'success');
            setTimeout(function() { window.location.href = 'index.html'; }, 1000);
          }).catch(function(err) {
            showToast(err.message || 'Authentication failed', 'warning');
          });
        } else {
          localStorage.setItem('gitec_user', JSON.stringify({ email: email, fullName: fullName || 'User' }));
          showToast('Login successful! (Demo Mode)', 'success');
          setTimeout(function() { window.location.href = 'index.html'; }, 1000);
        }
      });
    });
  }

  // Update header when auth state is confirmed
  function updateAuthHeader() {
    var loggedIn = (_api && _api.isLoggedIn()) || localStorage.getItem('gitec_user');
    var loginAction = document.querySelector('.header-action[href="login.html"]');
    if (loginAction && loggedIn) {
      var span = loginAction.querySelector('span');
      if (span) span.textContent = t('My Account');
      loginAction.setAttribute('href', 'account.html');
    }
  }

  // Run immediately for cached state, and again when server confirms
  updateAuthHeader();
  document.addEventListener('gitec-auth-ready', updateAuthHeader);

  /* ====================================================
     5. VIEW TOGGLE (category page)
     ==================================================== */
  var grid = document.querySelector('.products-grid');
  document.querySelectorAll('.view-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.view-btn').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      if (grid) {
        if (this.dataset.cols === 'list') {
          grid.classList.add('list-view');
          grid.style.gridTemplateColumns = '1fr';
          // Build list layout for each card
          grid.querySelectorAll('.product-card').forEach(function (card) {
            if (card.querySelector('.list-buy')) return;
            var actions = card.querySelector('.product-actions');
            // Hide original action buttons
            actions.querySelectorAll('.product-action-btn').forEach(function (b) { b.style.display = 'none'; });

            // Add description in product-info from data-description
            var info = card.querySelector('.product-info');
            var desc = card.dataset.description || '';
            if (desc) {
              var descDiv = document.createElement('div');
              descDiv.className = 'product-desc';
              descDiv.textContent = desc;
              info.appendChild(descDiv);
            }

            // Price + Add to Cart wrapper
            var buyDiv = document.createElement('div');
            buyDiv.className = 'list-buy';
            var priceEl = card.querySelector('.product-price .current');
            var pDiv = document.createElement('div');
            pDiv.className = 'list-price';
            pDiv.textContent = priceEl ? priceEl.textContent : '';
            buyDiv.appendChild(pDiv);
            var cartBtn = document.createElement('button');
            cartBtn.className = 'list-cart-btn';
            cartBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg> ' + t('Add to Cart');
            buyDiv.appendChild(cartBtn);
            actions.appendChild(buyDiv);

            // Icon buttons (compare + wishlist)
            var iconsDiv = document.createElement('div');
            iconsDiv.className = 'list-icons';
            iconsDiv.innerHTML = '<button title="Compare"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/></svg><span class="btn-label">Compare</span></button><button title="Wishlist"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span class="btn-label">Wishlist</span></button>';
            actions.appendChild(iconsDiv);
          });
        } else {
          grid.classList.remove('list-view');
          // Restore original and remove list elements
          grid.querySelectorAll('.product-card').forEach(function (card) {
            card.querySelectorAll('.product-action-btn').forEach(function (b) { b.style.display = ''; });
          });
          grid.querySelectorAll('.list-buy, .list-icons, .product-desc').forEach(function (el) {
            el.parentNode.removeChild(el);
          });
          if (this.dataset.cols === '3') grid.style.gridTemplateColumns = 'repeat(3,1fr)';
          else grid.style.gridTemplateColumns = 'repeat(4,1fr)';
        }
      }
    });
  });

  /* ====================================================
     6. LANGUAGE SWITCHING  (EN / GE)
     ==================================================== */
  var translations = {
    // Header & Nav
    'Search products...': '\u10DE\u10E0\u10DD\u10D3\u10E3\u10E5\u10E2\u10D8\u10E1 \u10EB\u10D8\u10D4\u10D1\u10D0...',
    'Login / Register': '\u10E8\u10D4\u10E1\u10D5\u10DA\u10D0 / \u10E0\u10D4\u10D2\u10D8\u10E1\u10E2\u10E0\u10D0\u10EA\u10D8\u10D0',
    'Wishlist': '\u10E1\u10E3\u10E0\u10D5\u10D8\u10DA\u10D4\u10D1\u10D8',
    'Cart': '\u10D9\u10D0\u10DA\u10D0\u10D7\u10D0',
    'All Categories': '\u10E7\u10D5\u10D4\u10DA\u10D0 \u10D9\u10D0\u10E2\u10D4\u10D2\u10DD\u10E0\u10D8\u10D0',
    'Home': '\u10DB\u10D7\u10D0\u10D5\u10D0\u10E0\u10D8',
    'Computers': '\u10D9\u10DD\u10DB\u10DE\u10D8\u10E3\u10E2\u10D4\u10E0\u10D4\u10D1\u10D8',
    'PC Components': '\u10D9\u10DD\u10DB\u10DE\u10DD\u10DC\u10D4\u10DC\u10E2\u10D4\u10D1\u10D8',
    'Notebooks': '\u10DC\u10DD\u10E3\u10D7\u10D1\u10E3\u10E5\u10D4\u10D1\u10D8',
    'Monitors': '\u10DB\u10DD\u10DC\u10D8\u10E2\u10DD\u10E0\u10D4\u10D1\u10D8',
    'Audio': '\u10D0\u10E3\u10D3\u10D8\u10DD',
    'Keyboards/Mice': '\u10D9\u10DA\u10D0\u10D5\u10D8\u10D0\u10E2\u10E3\u10E0\u10D0/\u10DB\u10D0\u10E3\u10E1\u10D8',
    'Accessories': '\u10D0\u10E5\u10E1\u10D4\u10E1\u10E3\u10D0\u10E0\u10D4\u10D1\u10D8',
    'Contact': '\u10D9\u10DD\u10DC\u10E2\u10D0\u10E5\u10E2\u10D8',
    'My Account': '\u10E9\u10D4\u10DB\u10D8 \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8',
    // Hero
    'New Arrival': '\u10D0\u10EE\u10D0\u10DA\u10D8',
    'RTX 50 Series Now Available in Georgia': 'RTX 50 \u10E1\u10D4\u10E0\u10D8\u10D0 \u10E3\u10D9\u10D5\u10D4 \u10EE\u10D4\u10DA\u10DB\u10D8\u10E1\u10D0\u10EC\u10D5\u10D3\u10DD\u10DB\u10D8\u10D0 \u10E1\u10D0\u10E5\u10D0\u10E0\u10D7\u10D5\u10D4\u10DA\u10DD\u10E8\u10D8',
    'Next-gen performance for gaming, streaming, and AI workloads. Pre-built systems and standalone cards in stock.': '\u10D0\u10EE\u10D0\u10DA\u10D8 \u10D7\u10D0\u10DD\u10D1\u10D8\u10E1 \u10DE\u10E0\u10DD\u10D3\u10E3\u10E5\u10E2\u10D8\u10D5\u10DD\u10D1\u10D0 \u10D2\u10D4\u10D8\u10DB\u10D8\u10DC\u10D2\u10D8\u10E1, \u10E1\u10E2\u10E0\u10D8\u10DB\u10D8\u10DC\u10D2\u10D8\u10E1 \u10D3\u10D0 AI-\u10E1\u10D7\u10D5\u10D8\u10E1. \u10D0\u10EC\u10E7\u10DD\u10D1\u10D8\u10DA\u10D8 \u10E1\u10D8\u10E1\u10E2\u10D4\u10DB\u10D4\u10D1\u10D8 \u10D3\u10D0 \u10D5\u10D8\u10D3\u10D4\u10DD \u10D1\u10D0\u10E0\u10D0\u10D7\u10D4\u10D1\u10D8 \u10DB\u10D0\u10E0\u10D0\u10D2\u10E8\u10D8\u10D0.',
    'Shop Now': '\u10E7\u10D8\u10D3\u10D5\u10D0',
    'Gaming PCs': '\u10E1\u10D0\u10D7\u10D0\u10DB\u10D0\u10E8\u10DD \u10D9\u10DD\u10DB\u10DE\u10D8\u10E3\u10E2\u10D4\u10E0\u10D4\u10D1\u10D8',
    'Custom Gaming Rigs Built to Dominate': '\u10DB\u10DD\u10E0\u10D2\u10D4\u10D1\u10E3\u10DA\u10D8 \u10E1\u10D0\u10D7\u10D0\u10DB\u10D0\u10E8\u10DD \u10E1\u10D8\u10E1\u10E2\u10D4\u10DB\u10D4\u10D1\u10D8',
    'Hand-assembled systems with premium components. Backed by local warranty and technical support.': '\u10EE\u10D4\u10DA\u10D8\u10D7 \u10D0\u10EC\u10E7\u10DD\u10D1\u10D8\u10DA\u10D8 \u10E1\u10D8\u10E1\u10E2\u10D4\u10DB\u10D4\u10D1\u10D8 \u10DE\u10E0\u10D4\u10DB\u10D8\u10E3\u10DB \u10D9\u10DD\u10DB\u10DE\u10DD\u10DC\u10D4\u10DC\u10E2\u10D4\u10D1\u10D8\u10D7. \u10D0\u10D3\u10D2\u10D8\u10DA\u10DD\u10D1\u10E0\u10D8\u10D5\u10D8 \u10D2\u10D0\u10E0\u10D0\u10DC\u10E2\u10D8\u10D0 \u10D3\u10D0 \u10E2\u10D4\u10E5\u10DC\u10D8\u10D9\u10E3\u10E0\u10D8 \u10DB\u10EE\u10D0\u10E0\u10D3\u10D0\u10ED\u10D4\u10E0\u10D0.',
    'Explore Builds': '\u10DC\u10D0\u10EE\u10D4\u10D7 \u10D0\u10EC\u10E7\u10DD\u10D1\u10D4\u10D1\u10D8',
    'Thermal Grizzly': 'Thermal Grizzly',
    'Keep Your System Cool Under Pressure': '\u10D2\u10D0\u10D0\u10D2\u10E0\u10D8\u10DA\u10D4\u10D7 \u10E1\u10D8\u10E1\u10E2\u10D4\u10DB\u10D0 \u10DB\u10D0\u10E5\u10E1\u10D8\u10DB\u10D0\u10DA\u10E3\u10E0\u10D8 \u10D3\u10D0\u10E2\u10D5\u10D8\u10E0\u10D7\u10D5\u10D8\u10E1\u10D0\u10E1',
    'Premium thermal solutions from Thermal Grizzly. Paste, pads, and direct-die kits for enthusiast builders.': 'Thermal Grizzly-\u10E1 \u10DE\u10E0\u10D4\u10DB\u10D8\u10E3\u10DB \u10D7\u10D4\u10E0\u10DB\u10E3\u10DA\u10D8 \u10D2\u10D0\u10D3\u10D0\u10EC\u10E7\u10D5\u10D4\u10E2\u10D4\u10D1\u10D8. \u10DE\u10D0\u10E1\u10E2\u10D0, \u10DE\u10D0\u10D3\u10D4\u10D1\u10D8 \u10D3\u10D0 \u10D3\u10D0\u10D8\u10E0\u10D4\u10E5\u10E2 \u10D3\u10D0\u10D8 \u10D9\u10DD\u10DB\u10DE\u10DA\u10D4\u10E5\u10E2\u10D4\u10D1\u10D8.',
    'Shop Cooling': '\u10D2\u10D0\u10D2\u10E0\u10D8\u10DA\u10D4\u10D1\u10D0',
    // Index sections
    'Featured Products': '\u10E0\u10E9\u10D4\u10E3\u10DA\u10D8 \u10DE\u10E0\u10DD\u10D3\u10E3\u10E5\u10E2\u10D4\u10D1\u10D8',
    'New Arrivals': '\u10D0\u10EE\u10D0\u10DA\u10D8 \u10DE\u10E0\u10DD\u10D3\u10E3\u10E5\u10E2\u10D4\u10D1\u10D8',
    'Shop by Category': '\u10D9\u10D0\u10E2\u10D4\u10D2\u10DD\u10E0\u10D8\u10D4\u10D1\u10D8',
    'View All': '\u10E7\u10D5\u10D4\u10DA\u10D0',
    'Add to Cart': '\u10D9\u10D0\u10DA\u10D0\u10D7\u10D0\u10E8\u10D8',
    'In Stock': '\u10DB\u10D0\u10E0\u10D0\u10D2\u10E8\u10D8\u10D0',
    'Pre-order': '\u10EC\u10D8\u10DC\u10D0\u10E1\u10EC\u10D0\u10E0\u10D8 \u10E8\u10D4\u10D9\u10D5\u10D4\u10D7\u10D0',
    // Footer
    "Georgia's go-to destination for computer hardware, gaming systems, and professional tech.": '\u10E1\u10D0\u10E5\u10D0\u10E0\u10D7\u10D5\u10D4\u10DA\u10DD\u10E1 \u10DB\u10D7\u10D0\u10D5\u10D0\u10E0\u10D8 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8 \u10D9\u10DD\u10DB\u10DE\u10D8\u10E3\u10E2\u10D4\u10E0\u10E3\u10DA\u10D8 \u10E2\u10D4\u10E5\u10DC\u10D8\u10D9\u10D8\u10E1, \u10E1\u10D0\u10D7\u10D0\u10DB\u10D0\u10E8\u10DD \u10E1\u10D8\u10E1\u10E2\u10D4\u10DB\u10D4\u10D1\u10D8\u10E1 \u10D3\u10D0 \u10DE\u10E0\u10DD\u10E4\u10D4\u10E1\u10D8\u10DD\u10DC\u10D0\u10DA\u10E3\u10E0\u10D8 \u10E2\u10D4\u10E5\u10DC\u10D8\u10D9\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1.',
    'Follow us': '\u10D2\u10D0\u10DB\u10DD\u10D2\u10D5\u10E7\u10D4\u10D5\u10D8\u10D7',
    'Information': '\u10D8\u10DC\u10E4\u10DD\u10E0\u10DB\u10D0\u10EA\u10D8\u10D0',
    'Contact Us': '\u10D3\u10D0\u10D2\u10D5\u10D8\u10D9\u10D0\u10D5\u10E8\u10D8\u10E0\u10D3\u10D8\u10D7',
    'Conditions of Use': '\u10D2\u10D0\u10DB\u10DD\u10E7\u10D4\u10DC\u10D4\u10D1\u10D8\u10E1 \u10DE\u10D8\u10E0\u10DD\u10D1\u10D4\u10D1\u10D8',
    'Privacy Notice': '\u10D9\u10DD\u10DC\u10E4\u10D8\u10D3\u10D4\u10DC\u10EA\u10D8\u10D0\u10DA\u10E3\u10E0\u10DD\u10D1\u10D0',
    'Return Policy': '\u10D3\u10D0\u10D1\u10E0\u10E3\u10DC\u10D4\u10D1\u10D8\u10E1 \u10DE\u10DD\u10DA\u10D8\u10E2\u10D8\u10D9\u10D0',
    'Shipping Info': '\u10DB\u10D8\u10EC\u10DD\u10D3\u10D4\u10D1\u10D8\u10E1 \u10D8\u10DC\u10E4\u10DD\u10E0\u10DB\u10D0\u10EA\u10D8\u10D0',
    'Warranty Info': '\u10D2\u10D0\u10E0\u10D0\u10DC\u10E2\u10D8\u10D8\u10E1 \u10D8\u10DC\u10E4\u10DD\u10E0\u10DB\u10D0\u10EA\u10D8\u10D0',
    'About Us': '\u10E9\u10D5\u10D4\u10DC \u10E8\u10D4\u10E1\u10D0\u10EE\u10D4\u10D1',
    'Orders': '\u10E8\u10D4\u10D9\u10D5\u10D4\u10D7\u10D4\u10D1\u10D8',
    'Addresses': '\u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D4\u10D1\u10D8',
    'Shopping Cart': '\u10E1\u10D0\u10E7\u10D8\u10D3\u10DA\u10DD \u10D9\u10D0\u10DA\u10D0\u10D7\u10D0',
    'Customer Service': '\u10DB\u10DD\u10DB\u10E1\u10D0\u10EE\u10E3\u10E0\u10D4\u10D1\u10D0',
    'Search': '\u10EB\u10D8\u10D4\u10D1\u10D0',
    'Blog': '\u10D1\u10DA\u10DD\u10D2\u10D8',
    'Recently Viewed': '\u10D1\u10DD\u10DA\u10DD\u10E1 \u10DC\u10D0\u10DC\u10D0\u10EE\u10D8',
    'Compare Products': '\u10DE\u10E0\u10DD\u10D3\u10E3\u10E5\u10E2\u10D4\u10D1\u10D8\u10E1 \u10E8\u10D4\u10D3\u10D0\u10E0\u10D4\u10D1\u10D0',
    'New Products': '\u10D0\u10EE\u10D0\u10DA\u10D8 \u10DE\u10E0\u10DD\u10D3\u10E3\u10E5\u10E2\u10D4\u10D1\u10D8',
    'Sign up for our newsletter': '\u10D2\u10D0\u10DB\u10DD\u10D8\u10EC\u10D4\u10E0\u10D4\u10D7 \u10E1\u10D8\u10D0\u10EE\u10DA\u10D4\u10D4\u10D1\u10D8',
    'Enter your email here...': '\u10E8\u10D4\u10D8\u10E7\u10D5\u10D0\u10DC\u10D4\u10D7 \u10D4\u10DA.\u10E4\u10DD\u10E1\u10E2\u10D0...',
    'Subscribe': '\u10D2\u10D0\u10DB\u10DD\u10EC\u10D4\u10E0\u10D0',
    // Product page
    'Description': '\u10D0\u10E6\u10EC\u10D4\u10E0\u10D0',
    'Specifications': '\u10E1\u10DE\u10D4\u10EA\u10D8\u10E4\u10D8\u10D9\u10D0\u10EA\u10D8\u10D4\u10D1\u10D8',
    'Customer Reviews': '\u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10DA\u10D8\u10E1 \u10E8\u10D4\u10E4\u10D0\u10E1\u10D4\u10D1\u10D4\u10D1\u10D8',
    'Related Products': '\u10DB\u10E1\u10D2\u10D0\u10D5\u10E1\u10D8 \u10DE\u10E0\u10DD\u10D3\u10E3\u10E5\u10E2\u10D4\u10D1\u10D8',
    'Share:': '\u10D2\u10D0\u10D0\u10D6\u10D8\u10D0\u10E0\u10D4:',
    'Pay in 12 installments:': '\u10D2\u10D0\u10D3\u10D0\u10D8\u10EE\u10D0\u10D3\u10D4\u10D7 12 \u10D7\u10D5\u10D4\u10E8\u10D8:',
    // Cart page
    'Your cart is empty': '\u10D7\u10E5\u10D5\u10D4\u10DC\u10D8 \u10D9\u10D0\u10DA\u10D0\u10D7\u10D0 \u10EA\u10D0\u10E0\u10D8\u10D4\u10DA\u10D8\u10D0',
    'Browse our products and add items to your cart.': '\u10D3\u10D0\u10D0\u10D7\u10D5\u10D0\u10DA\u10D8\u10D4\u10E0\u10D4\u10D7 \u10DE\u10E0\u10DD\u10D3\u10E3\u10E5\u10E2\u10D4\u10D1\u10D8 \u10D3\u10D0 \u10D3\u10D0\u10D0\u10DB\u10D0\u10E2\u10D4\u10D7 \u10D9\u10D0\u10DA\u10D0\u10D7\u10D0\u10E8\u10D8.',
    'Continue Shopping': '\u10E7\u10D8\u10D3\u10D5\u10D8\u10E1 \u10D2\u10D0\u10D2\u10E0\u10EB\u10D4\u10DA\u10D4\u10D1\u10D0',
    'Subtotal': '\u10EF\u10D0\u10DB\u10D8',
    'Shipping': '\u10DB\u10D8\u10EC\u10DD\u10D3\u10D4\u10D1\u10D0',
    'Total': '\u10E1\u10E3\u10DA',
    'Proceed to Checkout': '\u10E8\u10D4\u10D9\u10D5\u10D4\u10D7\u10D8\u10E1 \u10D2\u10D0\u10E4\u10DD\u10E0\u10DB\u10D4\u10D1\u10D0',
    'Free': '\u10E3\u10E4\u10D0\u10E1\u10DD',
    'Order placed successfully!': '\u10E8\u10D4\u10D9\u10D5\u10D4\u10D7\u10D0 \u10EC\u10D0\u10E0\u10DB\u10D0\u10E2\u10D4\u10D1\u10D8\u10D7 \u10D2\u10D0\u10E4\u10DD\u10E0\u10DB\u10D3\u10D0!',
    'Thank you for your purchase. (Demo Mode)': '\u10DB\u10D0\u10D3\u10DA\u10DD\u10D1\u10D0 \u10E8\u10D4\u10DC\u10D0\u10EB\u10D4\u10DC\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1. (\u10D3\u10D4\u10DB\u10DD \u10E0\u10D4\u10DF\u10D8\u10DB\u10D8)',
    'Back to Home': '\u10DB\u10D7\u10D0\u10D5\u10D0\u10E0\u10D6\u10D4 \u10D3\u10D0\u10D1\u10E0\u10E3\u10DC\u10D4\u10D1\u10D0',
    // Wishlist page
    'My Wishlist': '\u10E9\u10D4\u10DB\u10D8 \u10E1\u10E3\u10E0\u10D5\u10D8\u10DA\u10D4\u10D1\u10D8',
    'Your wishlist is empty': '\u10D7\u10E5\u10D5\u10D4\u10DC\u10D8 \u10E1\u10E3\u10E0\u10D5\u10D8\u10DA\u10D4\u10D1\u10D8 \u10EA\u10D0\u10E0\u10D8\u10D4\u10DA\u10D8\u10D0',
    'Browse our products and save items you love.': '\u10D3\u10D0\u10D0\u10D7\u10D5\u10D0\u10DA\u10D8\u10D4\u10E0\u10D4\u10D7 \u10DE\u10E0\u10DD\u10D3\u10E3\u10E5\u10E2\u10D4\u10D1\u10D8 \u10D3\u10D0 \u10E8\u10D4\u10D8\u10DC\u10D0\u10EE\u10D4\u10D7 \u10E0\u10D0\u10EA \u10DB\u10DD\u10D2\u10EC\u10DD\u10DC\u10D7.',
    // Login page
    'Login': '\u10E8\u10D4\u10E1\u10D5\u10DA\u10D0',
    'Register': '\u10E0\u10D4\u10D2\u10D8\u10E1\u10E2\u10E0\u10D0\u10EA\u10D8\u10D0',
    'Email Address': '\u10D4\u10DA.\u10E4\u10DD\u10E1\u10E2\u10D0',
    'you@example.com': 'you@example.com',
    'Password': '\u10DE\u10D0\u10E0\u10DD\u10DA\u10D8',
    'Enter your password': '\u10E8\u10D4\u10D8\u10E7\u10D5\u10D0\u10DC\u10D4\u10D7 \u10DE\u10D0\u10E0\u10DD\u10DA\u10D8',
    'Remember me': '\u10D3\u10D0\u10DB\u10D0\u10EE\u10E1\u10DD\u10D5\u10E0\u10D4',
    'Forgot password?': '\u10D3\u10D0\u10D2\u10D0\u10D5\u10D8\u10EC\u10E7\u10D3\u10D0 \u10DE\u10D0\u10E0\u10DD\u10DA\u10D8?',
    'or': '\u10D0\u10DC',
    "Don't have an account? Create one": '\u10D0\u10E0 \u10D2\u10D0\u10E5\u10D5\u10D7 \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8? \u10E8\u10D4\u10E5\u10DB\u10D4\u10DC\u10D8\u10D7',
    'Full Name': '\u10E1\u10E0\u10E3\u10DA\u10D8 \u10E1\u10D0\u10EE\u10D4\u10DA\u10D8',
    'John Doe': '\u10D2\u10D8\u10DD\u10E0\u10D2\u10D8 \u10D2\u10D8\u10DD\u10E0\u10D2\u10D0\u10EB\u10D4',
    'Create a password': '\u10E8\u10D4\u10E5\u10DB\u10D4\u10DC\u10D8\u10D7 \u10DE\u10D0\u10E0\u10DD\u10DA\u10D8',
    'Confirm Password': '\u10D3\u10D0\u10D0\u10D3\u10D0\u10E1\u10E2\u10E3\u10E0\u10D4\u10D7 \u10DE\u10D0\u10E0\u10DD\u10DA\u10D8',
    'Confirm your password': '\u10D3\u10D0\u10D0\u10D3\u10D0\u10E1\u10E2\u10E3\u10E0\u10D4\u10D7 \u10D7\u10E5\u10D5\u10D4\u10DC\u10D8 \u10DE\u10D0\u10E0\u10DD\u10DA\u10D8',
    'Already have an account? Sign in': '\u10E3\u10D9\u10D5\u10D4 \u10D2\u10D0\u10E5\u10D5\u10D7 \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8? \u10E8\u10D4\u10D3\u10D8\u10D7',
    // Contact page
    'Our Office': '\u10E9\u10D5\u10D4\u10DC\u10D8 \u10DD\u10E4\u10D8\u10E1\u10D8',
    'Phone': '\u10E2\u10D4\u10DA\u10D4\u10E4\u10DD\u10DC\u10D8',
    'Email': '\u10D4\u10DA.\u10E4\u10DD\u10E1\u10E2\u10D0',
    'Working Hours': '\u10E1\u10D0\u10DB\u10E3\u10E8\u10D0\u10DD \u10E1\u10D0\u10D0\u10D7\u10D4\u10D1\u10D8',
    'Banking Information': '\u10E1\u10D0\u10D1\u10D0\u10DC\u10D9\u10DD \u10D8\u10DC\u10E4\u10DD\u10E0\u10DB\u10D0\u10EA\u10D8\u10D0',
    'Send us a message': '\u10DB\u10DD\u10D2\u10D5\u10EC\u10D4\u10E0\u10D4\u10D7 \u10E8\u10D4\u10E2\u10E7\u10DD\u10D1\u10D8\u10DC\u10D4\u10D1\u10D0',
    'Your Name *': '\u10D7\u10E5\u10D5\u10D4\u10DC\u10D8 \u10E1\u10D0\u10EE\u10D4\u10DA\u10D8 *',
    'Enter your name': '\u10E8\u10D4\u10D8\u10E7\u10D5\u10D0\u10DC\u10D4\u10D7 \u10E1\u10D0\u10EE\u10D4\u10DA\u10D8',
    'Your Email *': '\u10D7\u10E5\u10D5\u10D4\u10DC\u10D8 \u10D4\u10DA.\u10E4\u10DD\u10E1\u10E2\u10D0 *',
    'Enter your email': '\u10E8\u10D4\u10D8\u10E7\u10D5\u10D0\u10DC\u10D4\u10D7 \u10D4\u10DA.\u10E4\u10DD\u10E1\u10E2\u10D0',
    'Your Message *': '\u10D7\u10E5\u10D5\u10D4\u10DC\u10D8 \u10E8\u10D4\u10E2\u10E7\u10DD\u10D1\u10D8\u10DC\u10D4\u10D1\u10D0 *',
    'How can we help you?': '\u10E0\u10D8\u10D7 \u10E8\u10D4\u10D2\u10D5\u10D8\u10EB\u10DA\u10D8\u10D0 \u10D3\u10D0\u10D2\u10D4\u10EE\u10DB\u10D0\u10E0\u10DD\u10D7?',
    'Send Message': '\u10D2\u10D0\u10D2\u10D6\u10D0\u10D5\u10DC\u10D0',
    'Sent!': '\u10D2\u10D0\u10D2\u10D6\u10D0\u10D5\u10DC\u10D8\u10DA\u10D8\u10D0!',
    // Category page sidebar
    'Categories': '\u10D9\u10D0\u10E2\u10D4\u10D2\u10DD\u10E0\u10D8\u10D4\u10D1\u10D8',
    'Cases': '\u10D9\u10DD\u10E0\u10DE\u10E3\u10E1\u10D4\u10D1\u10D8',
    'Cooling': '\u10D2\u10D0\u10D2\u10E0\u10D8\u10DA\u10D4\u10D1\u10D0',
    'Motherboards': '\u10D3\u10D4\u10D3\u10D0\u10DE\u10DA\u10D0\u10E2\u10D4\u10D1\u10D8',
    'Graphics Cards': '\u10D5\u10D8\u10D3\u10D4\u10DD \u10D1\u10D0\u10E0\u10D0\u10D7\u10D4\u10D1\u10D8',
    'Processors': '\u10DE\u10E0\u10DD\u10EA\u10D4\u10E1\u10DD\u10E0\u10D4\u10D1\u10D8',
    'Memory': '\u10DB\u10D4\u10EE\u10E1\u10D8\u10D4\u10E0\u10D4\u10D1\u10D0',
    'Keyboards': '\u10D9\u10DA\u10D0\u10D5\u10D8\u10D0\u10E2\u10E3\u10E0\u10D4\u10D1\u10D8',
    'Mice': '\u10DB\u10D0\u10E3\u10E1\u10D4\u10D1\u10D8',
    'Mousepads': '\u10DB\u10D0\u10E3\u10E1\u10DE\u10D0\u10D3\u10D4\u10D1\u10D8',
    'UPS': 'UPS',
    'Thermal Compound': '\u10D7\u10D4\u10E0\u10DB\u10E3\u10DA\u10D8 \u10DE\u10D0\u10E1\u10E2\u10D0',
    'Price Range': '\u10E4\u10D0\u10E1\u10D8\u10E1 \u10D3\u10D8\u10D0\u10DE\u10D0\u10D6\u10DD\u10DC\u10D8',
    'Min': '\u10DB\u10D8\u10DC',
    'Max': '\u10DB\u10D0\u10E5\u10E1',
    'Brand': '\u10D1\u10E0\u10D4\u10DC\u10D3\u10D8',
    'Showing': '\u10DC\u10D0\u10E9\u10D5\u10D4\u10DC\u10D4\u10D1\u10D8\u10D0',
    'products': '\u10DE\u10E0\u10DD\u10D3\u10E3\u10E5\u10E2\u10D8',
    'Sort by: Popularity': '\u10E1\u10DD\u10E0\u10E2\u10D8\u10E0\u10D4\u10D1\u10D0: \u10DE\u10DD\u10DE\u10E3\u10DA\u10D0\u10E0\u10DD\u10D1\u10D8\u10D7',
    'Price: Low to High': '\u10E4\u10D0\u10E1\u10D8: \u10D3\u10D0\u10D1\u10DA\u10D8\u10D3\u10D0\u10DC \u10DB\u10D0\u10E6\u10DA\u10D0',
    'Price: High to Low': '\u10E4\u10D0\u10E1\u10D8: \u10DB\u10D0\u10E6\u10DA\u10D8\u10D3\u10D0\u10DC \u10D3\u10D0\u10D1\u10DA\u10D0',
    'Apply Filter': '\u10D2\u10D0\u10E4\u10D8\u10DA\u10E2\u10D5\u10E0\u10D0',
    'Customer Rating': '\u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10DA\u10D8\u10E1 \u10E0\u10D4\u10D8\u10E2\u10D8\u10DC\u10D2\u10D8',
    'All ratings': '\u10E7\u10D5\u10D4\u10DA\u10D0 \u10E0\u10D4\u10D8\u10E2\u10D8\u10DC\u10D2\u10D8',
    'Deals': '\u10E4\u10D0\u10E1\u10D3\u10D0\u10D9\u10DA\u10D4\u10D1\u10D4\u10D1\u10D8',
    'On Sale Only': '\u10DB\u10EE\u10DD\u10DA\u10DD\u10D3 \u10E4\u10D0\u10E1\u10D3\u10D0\u10D9\u10DA\u10D4\u10D1\u10E3\u10DA\u10D8',
    'Use Case': '\u10D2\u10D0\u10DB\u10DD\u10E7\u10D4\u10DC\u10D4\u10D1\u10D0',
    'Gaming': '\u10D2\u10D4\u10D8\u10DB\u10D8\u10DC\u10D2\u10D8',
    'Office / Business': '\u10DD\u10E4\u10D8\u10E1\u10D8 / \u10D1\u10D8\u10D6\u10DC\u10D4\u10E1\u10D8',
    'PC Building': '\u10D9\u10DD\u10DB\u10DE\u10D8\u10E3\u10E2\u10D4\u10E0\u10D8\u10E1 \u10D0\u10EC\u10E7\u10DD\u10D1\u10D0',
    'Networking': '\u10E5\u10E1\u10D4\u10DA\u10D8',
    'Availability': '\u10EE\u10D4\u10DA\u10DB\u10D8\u10E1\u10D0\u10EC\u10D5\u10D3\u10DD\u10DB\u10DD\u10D1\u10D0',
    'Show more': '\u10DB\u10D4\u10E2\u10D8',
    'Show less': '\u10DC\u10D0\u10D9\u10DA\u10D4\u10D1\u10D8'
  };

  // Build reverse map
  var reverseTranslations = {};
  Object.keys(translations).forEach(function (en) {
    reverseTranslations[translations[en]] = en;
  });

  var currentLang = document.documentElement.classList.contains('lang-ge') ? 'ge' : 'en';

  // Helper: translate a string if Georgian is active
  function t(en) {
    if (currentLang === 'ge' && translations[en]) return translations[en];
    return en;
  }

  function swapTextNodes(el, map) {
    // Swap placeholder for inputs
    if (el.tagName === 'INPUT' && el.placeholder) {
      var ph = el.placeholder;
      if (map[ph]) el.placeholder = map[ph];
    }
    // Swap <option> text
    if (el.tagName === 'OPTION') {
      var txt = el.textContent.trim();
      if (map[txt]) el.textContent = map[txt];
      return;
    }
    // Walk child nodes
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType === 3) { // text node
        var trimmed = node.textContent.trim();
        if (map[trimmed]) {
          node.textContent = node.textContent.replace(trimmed, map[trimmed]);
        }
      } else if (node.nodeType === 1) {
        // Skip SVGs and counts
        if (node.tagName === 'SVG' || node.classList.contains('count')) continue;
        swapTextNodes(node, map);
      }
    }
  }

  var langLinks = document.querySelectorAll('.lang-switch a');
  langLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var clicked = this.textContent.trim();
      var isGe = clicked === '\uD83C\uDDEC\uD83C\uDDEA';
      var isEn = clicked === '\uD83C\uDDFA\uD83C\uDDF8';
      if ((isEn && currentLang === 'en') || (isGe && currentLang === 'ge')) return;

      langLinks.forEach(function (l) { l.classList.remove('active'); });
      this.classList.add('active');

      var map = isGe ? translations : reverseTranslations;
      currentLang = isGe ? 'ge' : 'en';
      localStorage.setItem('gitec_lang', currentLang);
      document.documentElement.classList.toggle('lang-ge', isGe);

      swapTextNodes(document.body, map);
    });
  });

  // Set active flag indicator on page load
  function setActiveLangFlag() {
    langLinks.forEach(function (l) { l.classList.remove('active'); });
    if (currentLang === 'ge') {
      var geLink = document.querySelector('.lang-switch a[title="\u10E5\u10D0\u10E0\u10D7\u10E3\u10DA\u10D8"]');
      if (geLink) geLink.classList.add('active');
    } else {
      var enLink = document.querySelector('.lang-switch a[title="English"]');
      if (enLink) enLink.classList.add('active');
    }
  }
  setActiveLangFlag();

  // Restore Georgian translations on page load
  if (currentLang === 'ge') {
    try { swapTextNodes(document.body, translations); } catch (e) {}
    setTimeout(function () { try { swapTextNodes(document.body, translations); } catch (e) {} }, 300);
    setTimeout(function () { try { swapTextNodes(document.body, translations); } catch (e) {} }, 800);
    setTimeout(function () { try { swapTextNodes(document.body, translations); } catch (e) {} }, 1500);
  }

  /* ====================================================
     7. SIDEBAR FILTERING & SORTING (category page)
     ==================================================== */
  // === NAV HASH ROUTING ===
  var navAllowedCategories = null; // null = show all, array = restrict to these categories
  var isCategoryPage = window.location.pathname.indexOf('category.html') !== -1;
  var isContactPage = window.location.pathname.indexOf('contact.html') !== -1;
  var isProductPage = window.location.pathname.indexOf('product.html') !== -1;
  var isCartPage = window.location.pathname.indexOf('cart.html') !== -1;
  var isWishlistPage = window.location.pathname.indexOf('wishlist.html') !== -1;
  var isIndexPage = !isCategoryPage && !isContactPage && !isProductPage && !isCartPage && !isWishlistPage;

  var navLinks = document.querySelectorAll('.nav-menu a');

  // Hash to category mapping
  var hashCategoryMap = {
    'computers': null,
    'pc-components': ['graphics cards','processors','motherboards','memory','cooling','power supplies','thermal'],
    'notebooks': ['notebooks'],
    'monitors': ['monitors'],
    'audio': ['audio'],
    'keyboards-mice': ['keyboards','mice','mousepads'],
    'accessories': ['accessories','mousepads'],
  };

  // Hash to display name mapping
  var hashDisplayMap = {
    'computers': 'Computers',
    'pc-components': 'PC Components',
    'notebooks': 'Notebooks',
    'monitors': 'Monitors',
    'audio': 'Audio',
    'keyboards-mice': 'Keyboards/Mice',
    'accessories': 'Accessories'
  };

  // Set active nav link based on context
  function setActiveNav() {
    navLinks.forEach(function(l) { l.classList.remove('active'); });

    if (isIndexPage) {
      navLinks.forEach(function(l) {
        if (l.textContent.trim() === 'Home') l.classList.add('active');
      });
    } else if (isContactPage) {
      navLinks.forEach(function(l) {
        if (l.textContent.trim() === 'Contact') l.classList.add('active');
      });
    } else if (isCategoryPage) {
      var hash = window.location.hash.replace('#', '');
      if (hash && hashDisplayMap[hash]) {
        navLinks.forEach(function(l) {
          if (l.textContent.trim() === hashDisplayMap[hash]) l.classList.add('active');
        });
      }
      // If no hash, no nav link is active (showing all)
    }
  }

  // Apply nav filter based on hash (only on category page)
  function applyNavFilter() {
    if (!isCategoryPage) return;

    var hash = window.location.hash.replace('#', '');

    // Update navAllowedCategories used by applyFilters()
    if (hash && hash in hashCategoryMap) {
      navAllowedCategories = hashCategoryMap[hash];
    } else {
      navAllowedCategories = null; // show all
    }

    // Update breadcrumb
    var breadcrumbCurrent = document.querySelector('.breadcrumb .current');
    if (breadcrumbCurrent) {
      breadcrumbCurrent.textContent = (hash && hashDisplayMap[hash]) ? hashDisplayMap[hash] : 'All Products';
    }

    // Update active nav
    setActiveNav();

    // Re-apply all filters
    if (typeof applyFilters === 'function') {
      applyFilters();
    }
  }

  // Nav link click handling on category page
  if (isCategoryPage) {
    navLinks.forEach(function(link) {
      var href = link.getAttribute('href');
      // Only intercept links that point to category.html with a hash
      if (href && href.indexOf('category.html#') !== -1) {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          var newHash = href.split('#')[1] || '';
          window.location.hash = newHash;
        });
      }
      // Also intercept plain category.html link (All Categories button or nav)
      if (href === 'category.html') {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          window.location.hash = '';
          // Need to manually trigger since setting hash to '' doesn't fire hashchange
          applyNavFilter();
        });
      }
    });

    // Also handle the All Categories button
    var allCatBtn = document.querySelector('.nav-categories-btn');
    if (allCatBtn) {
      allCatBtn.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.hash = '';
        applyNavFilter();
      });
    }
  }

  // Listen for hash changes
  window.addEventListener('hashchange', function() {
    applyNavFilter();
  });

  // Initial setup
  setActiveNav();

  /* ====================================================
     8. DYNAMIC CART PAGE
     ==================================================== */
  if (isCartPage) {
    var cartContainer = document.querySelector('.cart-items');
    var cartSummary = document.querySelector('.cart-summary');

    function renderCart() {
      var cart = getCart();
      if (!cartContainer) return;

      if (cart.length === 0) {
        cartContainer.innerHTML = '<div class="empty-state"><h2>' + t('Your cart is empty') + '</h2><p>' + t('Browse our products and add items to your cart.') + '</p><a href="category.html" class="hero-btn">' + t('Continue Shopping') + ' &#8594;</a></div>';
        if (cartSummary) cartSummary.style.display = 'none';
        return;
      }

      if (cartSummary) cartSummary.style.display = '';

      var html = '';
      cart.forEach(function(item) {
        html += '<div class="cart-item" data-id="' + item.id + '">' +
          '<a href="product.html?id=' + item.id + '"><img src="' + item.image + '" alt="' + item.name + '"></a>' +
          '<div class="cart-item-info">' +
            '<a href="product.html?id=' + item.id + '" class="cart-item-title">' + item.name + '</a>' +
            '<div class="cart-item-price">&#8382; ' + item.price.toLocaleString() + '</div>' +
          '</div>' +
          '<div class="cart-item-qty">' +
            '<button class="qty-btn minus">-</button>' +
            '<input type="number" value="' + (item.qty || 1) + '" min="1">' +
            '<button class="qty-btn plus">+</button>' +
          '</div>' +
          '<div class="cart-item-total">&#8382; ' + (item.price * (item.qty || 1)).toLocaleString() + '</div>' +
          '<a href="#" class="cart-item-remove" title="Remove">&times;</a>' +
        '</div>';
      });
      cartContainer.innerHTML = html;

      // Update summary
      var subtotal = getCartTotal();
      var shipping = subtotal >= 499 ? 0 : 6;
      var total2 = subtotal + shipping;

      var subtotalEl = document.querySelector('.summary-subtotal');
      var shippingEl = document.querySelector('.summary-shipping');
      var totalEl = document.querySelector('.summary-total');
      if (subtotalEl) subtotalEl.textContent = '\u20BE ' + subtotal.toLocaleString();
      if (shippingEl) shippingEl.textContent = shipping === 0 ? t('Free') : '\u20BE ' + shipping;
      if (totalEl) totalEl.textContent = '\u20BE ' + total2.toLocaleString();

      // Bind qty and remove handlers
      cartContainer.querySelectorAll('.qty-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var item = this.closest('.cart-item');
          var id = parseInt(item.dataset.id);
          var input = item.querySelector('input');
          var v = parseInt(input.value) || 1;
          if (this.classList.contains('minus')) v = Math.max(1, v - 1);
          else v++;
          input.value = v;
          updateCartQty(id, v);
          renderCart();
        });
      });

      cartContainer.querySelectorAll('.cart-item-remove').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          var id = parseInt(this.closest('.cart-item').dataset.id);
          removeFromCart(id);
          renderCart();
          showToast('Item removed from cart', 'info');
        });
      });
    }

    renderCart();

    // Checkout button
    var checkoutBtn = document.querySelector('.btn-checkout');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (getCart().length === 0) {
          showToast('Your cart is empty', 'warning');
          return;
        }

        // If logged in with API, redirect to checkout page
        if (_api && _api.isLoggedIn()) {
          window.location.href = 'checkout.html';
          return;
        }

        // If not logged in, prompt to login first
        if (_api && !_api.isLoggedIn()) {
          showToast('Please login to checkout', 'warning');
          setTimeout(function() { window.location.href = 'login.html'; }, 1000);
          return;
        }

        // Fallback demo mode
        saveCart([]);
        cartContainer.innerHTML = '<div class="empty-state"><h2>' + t('Order placed successfully!') + '</h2><p>' + t('Thank you for your purchase. (Demo Mode)') + '</p><a href="index.html" class="hero-btn">' + t('Back to Home') + ' &#8594;</a></div>';
        if (cartSummary) cartSummary.style.display = 'none';
        showToast('Order placed! (Demo Mode)', 'success');
      });
    }
  }

  /* ====================================================
     9. DYNAMIC WISHLIST PAGE
     ==================================================== */
  if (isWishlistPage) {
    var wlContainer = document.querySelector('.wishlist-items');

    function renderWishlist() {
      var wl = getWishlist();
      if (!wlContainer) return;

      if (wl.length === 0) {
        wlContainer.innerHTML = '<div class="empty-state"><h2>' + t('Your wishlist is empty') + '</h2><p>' + t('Browse our products and save items you love.') + '</p><a href="category.html" class="hero-btn">' + t('Shop Now') + ' &#8594;</a></div>';
        return;
      }

      var html = '';
      wl.forEach(function(item) {
        html += '<div class="wishlist-item" data-id="' + item.id + '">' +
          '<a href="product.html?id=' + item.id + '"><img src="' + item.image + '" alt="' + item.name + '"></a>' +
          '<div class="wishlist-item-info">' +
            '<a href="product.html?id=' + item.id + '" class="wishlist-item-title">' + item.name + '</a>' +
            '<div class="wishlist-item-price">&#8382; ' + item.price.toLocaleString() + '</div>' +
          '</div>' +
          '<div class="wishlist-item-actions">' +
            '<button class="add-to-cart-from-wl">' + t('Add to Cart') + '</button>' +
            '<a href="#" class="wishlist-item-remove" title="Remove">&times;</a>' +
          '</div>' +
        '</div>';
      });
      wlContainer.innerHTML = html;

      // Bind handlers
      wlContainer.querySelectorAll('.add-to-cart-from-wl').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var item = this.closest('.wishlist-item');
          var id = parseInt(item.dataset.id);
          var wl = getWishlist();
          var product = null;
          for (var i = 0; i < wl.length; i++) {
            if (wl[i].id === id) { product = wl[i]; break; }
          }
          if (product) {
            addToCart(product);
            removeFromWishlist(id);
            renderWishlist();
          }
        });
      });

      wlContainer.querySelectorAll('.wishlist-item-remove').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          var id = parseInt(this.closest('.wishlist-item').dataset.id);
          removeFromWishlist(id);
          renderWishlist();
          showToast('Removed from wishlist', 'info');
        });
      });
    }

    renderWishlist();
  }

  /* ====================================================
     10. DYNAMIC PRODUCT PAGE
     ==================================================== */
  if (isProductPage) {
    var urlParams = new URLSearchParams(window.location.search);
    var productId = urlParams.get('id');

    if (productId !== null) {
      fetch('js/products.json')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          var id = parseInt(productId);
          var product = null;
          for (var i = 0; i < data.products.length; i++) {
            if (data.products[i].id === id) { product = data.products[i]; break; }
          }
          if (!product) return;

          // Update page title
          document.title = product.name + ' \u2014 GITEC';

          // Update breadcrumb
          var breadcrumbCurrent = document.querySelector('.breadcrumb .current');
          if (breadcrumbCurrent) breadcrumbCurrent.textContent = product.name;

          // Update product details
          var nameEl = document.querySelector('.product-detail h1');
          if (nameEl) nameEl.textContent = product.name;

          var descEl = document.querySelector('.product-detail .detail-desc');
          if (descEl) descEl.textContent = product.description;

          var priceEl = document.querySelector('.detail-price .current');
          if (priceEl) priceEl.innerHTML = '&#8382; ' + product.price.toLocaleString();

          var catEl = document.querySelector('.detail-category');
          if (catEl) catEl.textContent = product.category;

          // Update availability
          var stockEl = document.querySelector('.detail-stock');
          if (stockEl) {
            if (product.availability === 'instock') {
              stockEl.textContent = t('In Stock');
              stockEl.className = 'detail-stock in-stock';
            } else {
              stockEl.textContent = t('Pre-order');
              stockEl.className = 'detail-stock preorder';
            }
          }

          // Update main image
          var mainImg = document.querySelector('.gallery-main img');
          if (mainImg) mainImg.src = product.image;

          // Update thumbnails - show just the main image
          var thumbs = document.querySelector('.gallery-thumbs');
          if (thumbs) {
            thumbs.innerHTML = '<div class="gallery-thumb active"><img src="' + product.image + '" alt=""></div>';
          }

          // Update rating stars
          var starsEl = document.querySelector('.detail-rating');
          if (starsEl) {
            var starsHtml = '';
            for (var s = 0; s < 5; s++) {
              starsHtml += s < product.rating ? '\u2605' : '\u2606';
            }
            // Keep existing review count text if any
            var reviewSpan = starsEl.querySelector('span');
            starsEl.innerHTML = starsHtml;
            if (reviewSpan) starsEl.appendChild(reviewSpan);
          }

          // Wire up Add to Cart button on product page
          var addBtn = document.querySelector('.btn-cart-big');
          if (addBtn) {
            // Remove old listeners by cloning
            var newBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newBtn, addBtn);
            newBtn.addEventListener('click', function(e) {
              e.preventDefault();
              addToCart({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                category: product.category
              });
              var orig = this.innerHTML;
              this.innerHTML = '&#10003; Added';
              this.style.background = '#22c55e';
              var el = this;
              setTimeout(function() { el.innerHTML = orig; el.style.background = ''; }, 1200);
            });
          }

          // Wire up Wishlist button on product page
          var wlBtn = document.querySelector('.btn-wishlist');
          if (wlBtn) {
            var newWlBtn = wlBtn.cloneNode(true);
            wlBtn.parentNode.replaceChild(newWlBtn, wlBtn);
            newWlBtn.addEventListener('click', function(e) {
              e.preventDefault();
              addToWishlist({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                category: product.category
              });
            });
          }

          // Save to recently viewed
          saveRecentlyViewed({
            img: product.image,
            title: product.name,
            href: 'product.html?id=' + product.id
          });

          // Re-apply Georgian if active (async content was just rendered in English)
          if (currentLang === 'ge') {
            swapTextNodes(document.body, translations);
          }

        }).catch(function(err) { console.error('Failed to load product:', err); });
    }
  }

  /* ====================================================
     11. CATEGORY PAGE FILTERING (rest only applies to category page)
     ==================================================== */
  var productsGrid = document.querySelector('.products-grid');
  if (!productsGrid) return; // rest only applies to category page

  var allCards = Array.prototype.slice.call(productsGrid.querySelectorAll('.product-card'));
  var toolbarLeft = document.querySelector('.toolbar-left');

  // --- State ---
  var activeCategory = null;  // lowercase string or null
  var priceMin = 0;
  var priceMax = Infinity;
  var activeBrands = [];      // array of lowercase brand keys
  var minRating = 0;          // 0 = all, 3/4/5 = minimum star rating
  var saleOnly = false;       // true = show only sale items
  var activeAvailability = []; // ['instock','preorder'] or subset
  var activeUseCases = [];    // ['gaming','office','building','networking'] or subset
  var currentPage = 1;
  var perPage = 16;
  var paginationEl = document.querySelector('.pagination');
  // --- Brand map: checkbox label text -> data-brand value ---
  var brandMap = {
    'palit': 'palit',
    'sapphire': 'sapphire',
    'intel': 'intel',
    'maxsun': 'maxsun',
    'kingston': 'kingston',
    'lenovo': 'lenovo',
    'biostar': 'biostar',
    'arctic': 'arctic',
    'apc': 'apc',
    'gigabyte': 'gigabyte',
    'asus': 'asus',
    'lian li': 'lianli',
    'logitech': 'logitech',
    'dell': 'dell',
    'patriot': 'patriot',
    'razer': 'razer',
    'aoc': 'aoc',
    'acer': 'acer',
    'benq': 'benq',
    'bequiet!': 'bequiet',
    'g.skill': 'gskill',
    'thermalright': 'thermalright',
    'tp-link': 'tplink',
    'grandstream': 'grandstream',
    'thermal grizzly': 'thermalgrizzly',
    '1stplayer': '1stplayer'
  };

  // --- Category map: sidebar text -> data-category value ---
  var categoryMap = {
    'graphics cards': 'graphics cards',
    'processors': 'processors',
    'motherboards': 'motherboards',
    'memory': 'memory',
    'monitors': 'monitors',
    'cooling': 'cooling',
    'power supplies': 'power supplies',
    'cases': 'cases',
    'ups': 'ups',
    'networking': 'networking',
    'thermal': 'thermal',
    'accessories': 'accessories',
    'keyboards': 'keyboards',
    'mice': 'mice',
    'mousepads': 'mousepads',
    'audio': 'audio',
    'notebooks': 'notebooks'
  };

  function applyFilters() {
    var visibleCount = 0;
    allCards.forEach(function (card) {
      var show = true;
      var cat = card.dataset.category;
      var brand = card.dataset.brand;
      var price = parseFloat(card.dataset.price);

      // Nav-level category filter
      if (navAllowedCategories !== null && navAllowedCategories.indexOf(cat) === -1) show = false;

      // Sidebar category filter
      if (activeCategory && cat !== activeCategory) show = false;

      // Price filter
      if (price < priceMin || price > priceMax) show = false;

      // Brand filter
      if (activeBrands.length > 0 && activeBrands.indexOf(brand) === -1) show = false;

      // Rating filter
      if (minRating > 0) {
        var rating = parseInt(card.dataset.rating) || 0;
        if (rating < minRating) show = false;
      }

      // Sale filter
      if (saleOnly && card.dataset.sale !== 'true') show = false;

      // Availability filter
      if (activeAvailability.length > 0 && activeAvailability.indexOf(card.dataset.availability) === -1) show = false;

      // Use Case filter (OR within, AND with others)
      if (activeUseCases.length > 0 && activeUseCases.indexOf(card.dataset.use) === -1) show = false;

      card.dataset.filtered = show ? 'true' : 'false';
      if (show) visibleCount++;
    });

    currentPage = 1;
    applyPagination();
  }

  function applyPagination() {
    // Collect filtered cards in current DOM order
    var filtered = [];
    allCards.forEach(function (card) {
      if (card.dataset.filtered === 'true') filtered.push(card);
    });

    var total3 = filtered.length;
    var totalPages = Math.ceil(total3 / perPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    var start = (currentPage - 1) * perPage;
    var end = start + perPage;

    // Hide all, then show only current page slice
    allCards.forEach(function (card) { card.style.display = 'none'; });
    for (var i = start; i < end && i < total3; i++) {
      filtered[i].style.display = '';
    }

    // Update toolbar
    updateToolbarCount(start + 1, Math.min(end, total3), total3);

    // Rebuild pagination buttons
    if (paginationEl) {
      paginationEl.innerHTML = '';
      if (totalPages <= 1) return;

      // Prev button
      if (currentPage > 1) {
        var prev = document.createElement('button');
        prev.className = 'page-btn';
        prev.innerHTML = '&#8249;';
        prev.addEventListener('click', function () { currentPage--; applyPagination(); window.scrollTo(0, productsGrid.offsetTop - 100); });
        paginationEl.appendChild(prev);
      }

      // Page numbers
      for (var p = 1; p <= totalPages; p++) {
        var btn = document.createElement('button');
        btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
        btn.textContent = p;
        (function (page) {
          btn.addEventListener('click', function () { currentPage = page; applyPagination(); window.scrollTo(0, productsGrid.offsetTop - 100); });
        })(p);
        paginationEl.appendChild(btn);
      }

      // Next button
      if (currentPage < totalPages) {
        var next = document.createElement('button');
        next.className = 'page-btn';
        next.innerHTML = '&#8250;';
        next.addEventListener('click', function () { currentPage++; applyPagination(); window.scrollTo(0, productsGrid.offsetTop - 100); });
        paginationEl.appendChild(next);
      }
    }

    // Re-apply Georgian translation if active
    if (currentLang === 'ge') {
      swapTextNodes(productsGrid, translations);
    }
  }

  function updateToolbarCount(from, to, total3) {
    if (!toolbarLeft) return;
    var showLabel = (currentLang === 'ge') ? '\u10DC\u10D0\u10E9\u10D5\u10D4\u10DC\u10D4\u10D1\u10D8\u10D0' : 'Showing';
    var prodLabel = (currentLang === 'ge') ? '\u10DE\u10E0\u10DD\u10D3\u10E3\u10E5\u10E2\u10D8' : 'products';
    toolbarLeft.innerHTML = showLabel + ' <b>' + from + '-' + to + '</b> of <b>' + total3 + '</b> ' + prodLabel;
  }

  // Apply initial nav filter from URL hash
  applyNavFilter();

  // Search param handling
  var searchParam = new URLSearchParams(window.location.search).get('search');
  if (searchParam) {
    var searchLower = searchParam.toLowerCase();
    allCards.forEach(function(card) {
      var name = (card.querySelector('.product-title a') || {}).textContent || '';
      var desc = card.dataset.description || '';
      if (name.toLowerCase().indexOf(searchLower) === -1 && desc.toLowerCase().indexOf(searchLower) === -1) {
        card.dataset.filtered = 'false';
      }
    });
    applyPagination();
    // Update breadcrumb
    var bc = document.querySelector('.breadcrumb .current');
    if (bc) bc.textContent = 'Search: "' + searchParam + '"';
    // Update search input
    var si = document.querySelector('.search-bar input');
    if (si) si.value = searchParam;
  }

  // --- Category sidebar clicks ---
  var sidebarCats = document.querySelectorAll('.sidebar-categories a:not(.categories-toggle)');
  sidebarCats.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      // Extract category text (strip the count span)
      var rawText = this.childNodes[0].textContent.trim().toLowerCase();
      var mapped = categoryMap[rawText] || rawText;

      if (activeCategory === mapped) {
        // Deselect
        activeCategory = null;
        this.classList.remove('active');
      } else {
        sidebarCats.forEach(function (l) { l.classList.remove('active'); });
        activeCategory = mapped;
        this.classList.add('active');
        // Auto-expand if selected category is hidden
        if (catsMore && catsMore.contains(this) && catsMore.style.display === 'none') {
          catsMore.style.display = '';
          if (catsToggle) catsToggle.textContent = t('Show less');
        }
      }
      applyFilters();
    });
  });

  // --- Price filter ---
  var filterBtn = document.querySelector('.filter-btn');
  if (filterBtn) {
    filterBtn.addEventListener('click', function () {
      var inputs = document.querySelectorAll('.price-range input');
      priceMin = parseFloat(inputs[0].value) || 0;
      priceMax = parseFloat(inputs[1].value) || Infinity;
      if (priceMax === 0) priceMax = Infinity;
      applyFilters();
    });
  }

  // --- Brand filter ---
  var brandCheckboxes = document.querySelectorAll('.sidebar-check input[type="checkbox"]');
  // Only bind to the brand section (3rd sidebar-block)
  var brandBlock = document.getElementById('filter-brand');
  if (brandBlock) {
    var brandChecks = brandBlock.querySelectorAll('.sidebar-check');
    brandChecks.forEach(function (label) {
      var checkbox = label.querySelector('input');
      checkbox.addEventListener('change', function () {
        // Extract brand name from the label text
        var labelText = '';
        for (var i = 0; i < label.childNodes.length; i++) {
          var n = label.childNodes[i];
          if (n.nodeType === 3) labelText += n.textContent;
        }
        labelText = labelText.trim().toLowerCase();
        var brandKey = brandMap[labelText] || labelText;

        if (this.checked) {
          if (activeBrands.indexOf(brandKey) === -1) activeBrands.push(brandKey);
        } else {
          activeBrands = activeBrands.filter(function (b) { return b !== brandKey; });
        }
        applyFilters();
      });
    });
  }

  // --- Categories "Show more" toggle ---
  var catsMore = document.querySelector('.categories-more');
  var catsToggle = document.querySelector('.categories-toggle');
  if (catsToggle && catsMore) {
    catsToggle.addEventListener('click', function (e) {
      e.preventDefault();
      var isHidden = catsMore.style.display === 'none';
      catsMore.style.display = isHidden ? '' : 'none';
      var less = (currentLang === 'ge') ? '\u10DC\u10D0\u10D9\u10DA\u10D4\u10D1\u10D8' : 'Show less';
      var more = (currentLang === 'ge') ? '\u10DB\u10D4\u10E2\u10D8' : 'Show more';
      this.textContent = isHidden ? less : more;
    });
  }

  // --- Brands "Show more" toggle ---
  var brandsMore = document.querySelector('.brands-more');
  var brandsToggle = document.querySelector('.brands-toggle');
  if (brandsToggle && brandsMore) {
    brandsToggle.addEventListener('click', function (e) {
      e.preventDefault();
      var isHidden = brandsMore.style.display === 'none';
      brandsMore.style.display = isHidden ? '' : 'none';
      var less = (currentLang === 'ge') ? '\u10DC\u10D0\u10D9\u10DA\u10D4\u10D1\u10D8' : 'Show less';
      var more = (currentLang === 'ge') ? '\u10DB\u10D4\u10E2\u10D8' : 'Show more';
      this.textContent = isHidden ? less : more;
    });
  }

  // --- Pre-select brand from URL ?brand= param ---
  var urlParams2 = new URLSearchParams(window.location.search);
  var brandParam = urlParams2.get('brand');
  if (brandParam && brandBlock) {
    var brandLower = brandParam.toLowerCase();
    activeBrands.push(brandLower);
    var brandChecks2 = brandBlock.querySelectorAll('.sidebar-check');
    brandChecks2.forEach(function (label) {
      var labelText = '';
      for (var i = 0; i < label.childNodes.length; i++) {
        var n = label.childNodes[i];
        if (n.nodeType === 3) labelText += n.textContent;
      }
      labelText = labelText.trim().toLowerCase();
      var brandKey = brandMap[labelText] || labelText;
      if (brandKey === brandLower) {
        var cb = label.querySelector('input');
        if (cb) cb.checked = true;
        // Auto-expand "Show more" if selected brand is hidden
        if (brandsMore && brandsMore.contains(label) && brandsMore.style.display === 'none') {
          brandsMore.style.display = '';
          if (brandsToggle) brandsToggle.textContent = t('Show less');
        }
      }
    });
    applyFilters();
  }

  // --- Availability filter ---
  var availBlock = document.getElementById('filter-availability');
  if (availBlock) {
    var availChecks = availBlock.querySelectorAll('.sidebar-check input');
    availChecks.forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        activeAvailability = [];
        availChecks.forEach(function (cb) {
          if (cb.checked) {
            var text = '';
            for (var i = 0; i < cb.parentNode.childNodes.length; i++) {
              var n = cb.parentNode.childNodes[i];
              if (n.nodeType === 3) text += n.textContent;
            }
            text = text.trim().toLowerCase();
            if (text.indexOf('pre') !== -1) activeAvailability.push('preorder');
            else activeAvailability.push('instock');
          }
        });
        // Both or neither checked = show all
        if (activeAvailability.length === 0 || activeAvailability.length === 2) activeAvailability = [];
        applyFilters();
      });
    });
  }

  // --- Rating filter ---
  var ratingRadios = document.querySelectorAll('#filter-rating input[name="rating"]');
  ratingRadios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      minRating = parseInt(this.value) || 0;
      applyFilters();
    });
  });

  // --- Sale filter ---
  var saleCheckbox = document.getElementById('sale-only');
  if (saleCheckbox) {
    saleCheckbox.addEventListener('change', function () {
      saleOnly = this.checked;
      applyFilters();
    });
  }

  // --- Use Case filter ---
  var useBlock = document.getElementById('filter-usecase');
  if (useBlock) {
    var useChecks = useBlock.querySelectorAll('.sidebar-check input');
    useChecks.forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        activeUseCases = [];
        useChecks.forEach(function (cb) {
          if (cb.checked) activeUseCases.push(cb.value);
        });
        applyFilters();
      });
    });
  }

  // --- Sorting ---
  var sortSelect = document.querySelector('.toolbar-right select');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      var val = this.selectedIndex;
      // 0 = popularity (original order), 1 = price low-high, 2 = price high-low, 3 = name A-Z, 4 = newest
      var sorted = allCards.slice();

      if (val === 1) {
        sorted.sort(function (a, b) { return parseFloat(a.dataset.price) - parseFloat(b.dataset.price); });
      } else if (val === 2) {
        sorted.sort(function (a, b) { return parseFloat(b.dataset.price) - parseFloat(a.dataset.price); });
      } else if (val === 3) {
        sorted.sort(function (a, b) {
          var nameA = (a.querySelector('.product-title a') || {}).textContent || '';
          var nameB = (b.querySelector('.product-title a') || {}).textContent || '';
          return nameA.localeCompare(nameB);
        });
      }
      // Re-append in sorted order
      sorted.forEach(function (card) { productsGrid.appendChild(card); });
      applyFilters();
    });
  }


});
