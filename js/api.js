/**
 * GITEC API Client
 * Thin wrapper around fetch for backend communication.
 * Falls back to localStorage for guests (unauthenticated users).
 */
(function () {
  'use strict';

  var API_BASE = window.GITEC_API_BASE || '/api/v1';

  // Track auth state
  var currentUser = null;

  function isLoggedIn() {
    return currentUser !== null;
  }

  function getCurrentUser() {
    return currentUser;
  }

  // ============ CORE FETCH WRAPPER ============

  function api(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // send session cookie
    };
    if (body && method !== 'GET') {
      opts.body = JSON.stringify(body);
    }
    return fetch(API_BASE + path, opts).then(function (res) {
      if (res.status === 204) return null;
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || 'Request failed');
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  // ============ AUTH ============

  function register(email, password, fullName, phone, dateOfBirth) {
    return api('POST', '/auth/register', { email: email, password: password, fullName: fullName, phone: phone, dateOfBirth: dateOfBirth })
      .then(function (data) {
        currentUser = data.user;
        localStorage.setItem('gitec_user', JSON.stringify(data.user));
        return data;
      });
  }

  function login(email, password) {
    return api('POST', '/auth/login', { email: email, password: password })
      .then(function (data) {
        currentUser = data.user;
        localStorage.setItem('gitec_user', JSON.stringify(data.user));
        // Merge guest cart into server
        mergeGuestCart();
        return data;
      });
  }

  function logout() {
    return api('POST', '/auth/logout').then(function () {
      currentUser = null;
      localStorage.removeItem('gitec_user');
    });
  }

  function getMe() {
    return api('GET', '/auth/me').then(function (data) {
      currentUser = data.user;
      localStorage.setItem('gitec_user', JSON.stringify(data.user));
      return data;
    }).catch(function () {
      currentUser = null;
      localStorage.removeItem('gitec_user');
      return null;
    });
  }

  function forgotPassword(email) {
    return api('POST', '/auth/forgot-password', { email: email });
  }

  function resetPassword(token, password) {
    return api('POST', '/auth/reset-password', { token: token, password: password });
  }

  // ============ CART (server or localStorage) ============

  var LOCAL_CART_KEY = 'gitec_cart';

  function getLocalCart() {
    try { return JSON.parse(localStorage.getItem(LOCAL_CART_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveLocalCart(cart) {
    localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(cart));
  }

  function mergeGuestCart() {
    var local = getLocalCart();
    if (local.length === 0) return;
    var items = local.map(function (item) {
      return { productId: item.id, quantity: item.qty || 1 };
    });
    api('POST', '/cart/merge', { items: items }).then(function () {
      localStorage.removeItem(LOCAL_CART_KEY);
    }).catch(function () { /* silent fail */ });
  }

  function getCart() {
    if (!isLoggedIn()) {
      return Promise.resolve({
        items: getLocalCart().map(function (item) {
          return { product: item, quantity: item.qty || 1 };
        }),
        total: getLocalCart().reduce(function (s, i) { return s + i.price * (i.qty || 1); }, 0),
        count: getLocalCart().reduce(function (s, i) { return s + (i.qty || 1); }, 0)
      });
    }
    return api('GET', '/cart');
  }

  function addToCart(product) {
    if (!isLoggedIn()) {
      var cart = getLocalCart();
      var found = false;
      for (var i = 0; i < cart.length; i++) {
        if (cart[i].id === product.id) { cart[i].qty = (cart[i].qty || 1) + 1; found = true; break; }
      }
      if (!found) { product.qty = 1; cart.push(product); }
      saveLocalCart(cart);
      return Promise.resolve({ item: product });
    }
    return api('POST', '/cart', { productId: product.id, quantity: 1 });
  }

  function updateCartQty(productId, quantity) {
    if (!isLoggedIn()) {
      var cart = getLocalCart();
      for (var i = 0; i < cart.length; i++) {
        if (cart[i].id === productId) { cart[i].qty = Math.max(1, quantity); break; }
      }
      saveLocalCart(cart);
      return Promise.resolve();
    }
    return api('PATCH', '/cart/' + productId, { quantity: quantity });
  }

  function removeFromCart(productId) {
    if (!isLoggedIn()) {
      var cart = getLocalCart().filter(function (i) { return i.id !== productId; });
      saveLocalCart(cart);
      return Promise.resolve();
    }
    return api('DELETE', '/cart/' + productId);
  }

  function clearCart() {
    if (!isLoggedIn()) {
      localStorage.removeItem(LOCAL_CART_KEY);
      return Promise.resolve();
    }
    return api('DELETE', '/cart');
  }

  // ============ WISHLIST (server or localStorage) ============

  var LOCAL_WL_KEY = 'gitec_wishlist';

  function getLocalWishlist() {
    try { return JSON.parse(localStorage.getItem(LOCAL_WL_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveLocalWishlist(wl) {
    localStorage.setItem(LOCAL_WL_KEY, JSON.stringify(wl));
  }

  function getWishlist() {
    if (!isLoggedIn()) {
      return Promise.resolve({
        items: getLocalWishlist().map(function (item) { return { product: item }; }),
        count: getLocalWishlist().length
      });
    }
    return api('GET', '/wishlist');
  }

  function addToWishlist(product) {
    if (!isLoggedIn()) {
      var wl = getLocalWishlist();
      for (var i = 0; i < wl.length; i++) {
        if (wl[i].id === product.id) return Promise.resolve({ alreadyExists: true });
      }
      wl.push(product);
      saveLocalWishlist(wl);
      return Promise.resolve({ item: product });
    }
    return api('POST', '/wishlist', { productId: product.id });
  }

  function removeFromWishlist(productId) {
    if (!isLoggedIn()) {
      saveLocalWishlist(getLocalWishlist().filter(function (i) { return i.id !== productId; }));
      return Promise.resolve();
    }
    return api('DELETE', '/wishlist/' + productId);
  }

  // ============ ORDERS ============

  function createOrder(orderData) {
    return api('POST', '/orders', orderData);
  }

  function getOrders() {
    return api('GET', '/orders');
  }

  function getOrder(id) {
    return api('GET', '/orders/' + id);
  }

  // ============ CONTACT & NEWSLETTER ============

  function sendContact(name, email, message) {
    return api('POST', '/contact', { name: name, email: email, message: message });
  }

  function subscribeNewsletter(email) {
    return api('POST', '/newsletter/subscribe', { email: email });
  }

  // ============ PRODUCTS ============

  function getProducts(params) {
    var query = Object.keys(params || {}).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    return api('GET', '/products' + (query ? '?' + query : ''));
  }

  function getProduct(id) {
    return api('GET', '/products/' + id);
  }

  function getFeaturedProducts() {
    return api('GET', '/products/featured');
  }

  function getCategories() {
    return api('GET', '/categories');
  }

  // ============ INIT: restore user from session ============

  // Try to restore user from localStorage cache immediately (sync)
  var cached = localStorage.getItem('gitec_user');
  if (cached) {
    try { currentUser = JSON.parse(cached); } catch (e) { /* ignore */ }
  }

  // Verify session with server — store the promise so other code can await it
  var _readyPromise;
  if (currentUser) {
    _readyPromise = getMe().then(function () {
      _notifyReady();
    }).catch(function () {
      currentUser = null;
      localStorage.removeItem('gitec_user');
      _notifyReady();
    });
  } else {
    _readyPromise = Promise.resolve();
  }

  // Event system: fire 'gitec-auth-ready' when session verification completes
  var _readyFired = !currentUser; // if no cached user, already "ready"
  var _readyCallbacks = [];

  function _notifyReady() {
    _readyFired = true;
    // Dispatch DOM event for main.js to listen to
    document.dispatchEvent(new Event('gitec-auth-ready'));
    // Also call any registered callbacks
    _readyCallbacks.forEach(function (cb) { cb(); });
    _readyCallbacks = [];
  }

  // If no cached user, fire ready immediately
  if (_readyFired) {
    setTimeout(function () {
      document.dispatchEvent(new Event('gitec-auth-ready'));
    }, 0);
  }

  // ============ PUBLIC API ============

  window.GitecAPI = {
    // Auth
    register: register,
    login: login,
    logout: logout,
    getMe: getMe,
    forgotPassword: forgotPassword,
    resetPassword: resetPassword,
    isLoggedIn: isLoggedIn,
    getCurrentUser: getCurrentUser,

    // Cart
    getCart: getCart,
    addToCart: addToCart,
    updateCartQty: updateCartQty,
    removeFromCart: removeFromCart,
    clearCart: clearCart,

    // Wishlist
    getWishlist: getWishlist,
    addToWishlist: addToWishlist,
    removeFromWishlist: removeFromWishlist,

    // Orders
    createOrder: createOrder,
    getOrders: getOrders,
    getOrder: getOrder,

    // Contact & Newsletter
    sendContact: sendContact,
    subscribeNewsletter: subscribeNewsletter,

    // Products
    getProducts: getProducts,
    getProduct: getProduct,
    getFeaturedProducts: getFeaturedProducts,
    getCategories: getCategories
  };

})();
