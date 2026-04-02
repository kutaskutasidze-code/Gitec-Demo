(function () {
  'use strict';

  // ========== CONFIG ==========
  var CHAT_API_URL = '/api/chat';

  // ========== STATE ==========
  var isOpen = false;
  var messages = [];
  var productData = null;
  var isLoading = false;

  // ========== SESSION PERSISTENCE ==========
  var CHAT_VERSION = 6; // Bump this to clear stale sessions when code changes

  function saveSession() {
    try {
      sessionStorage.setItem('gitec_chat_version', String(CHAT_VERSION));
      sessionStorage.setItem('gitec_chat_messages', JSON.stringify(messages));
      sessionStorage.setItem('gitec_chat_open', isOpen ? '1' : '0');
      var container = document.getElementById('chat-messages');
      if (container) sessionStorage.setItem('gitec_chat_html', container.innerHTML);
    } catch (e) { /* quota exceeded or private mode */ }
  }

  function restoreSession() {
    try {
      // Clear stale sessions from older code versions
      var savedVersion = parseInt(sessionStorage.getItem('gitec_chat_version') || '0', 10);
      if (savedVersion < CHAT_VERSION) {
        sessionStorage.removeItem('gitec_chat_messages');
        sessionStorage.removeItem('gitec_chat_html');
        sessionStorage.removeItem('gitec_chat_open');
        return;
      }
      var saved = sessionStorage.getItem('gitec_chat_messages');
      if (saved) messages = JSON.parse(saved);
      var html = sessionStorage.getItem('gitec_chat_html');
      if (html) {
        var container = document.getElementById('chat-messages');
        if (container) container.innerHTML = html;
      }
      if (sessionStorage.getItem('gitec_chat_open') === '1') {
        isOpen = true;
        var panel = document.getElementById('chat-panel');
        var toggle = document.getElementById('chat-toggle');
        if (panel) panel.classList.add('open');
        if (toggle) toggle.classList.add('active');
      }
    } catch (e) { /* parse error */ }
  }

  // ========== CATEGORY ALIASES (prefix-matched for Georgian morphology) ==========
  // Georgian stems: use shortest unique prefix so plurals/cases match
  // e.g., 'კლავიატურ' matches კლავიატურა, კლავიატურები, კლავიატურას, etc.
  var CATEGORY_ALIASES = {
    'gpu': 'graphics cards', 'gpus': 'graphics cards', 'video card': 'graphics cards',
    'graphics card': 'graphics cards',
    'cpu': 'processors', 'cpus': 'processors', 'processor': 'processors',
    'ram': 'memory',
    'keyboard': 'keyboards',
    'mouse': 'mice',
    'monitor': 'monitors',
    'laptop': 'notebooks',
    'case': 'cases',
    'cooler': 'cooling', 'fan': 'cooling', 'cooling': 'cooling', 'aio': 'cooling',
    'motherboard': 'motherboards', 'mobo': 'motherboards',
    'headset': 'audio', 'headphones': 'audio',
    'router': 'networking', 'wifi': 'networking',
    'mousepad': 'mousepads', 'pad': 'mousepads',
    'thermal': 'thermal compound', 'paste': 'thermal compound',
    'ups': 'ups',
    'notebook': 'notebooks'
  };

  // Georgian stem → English category (prefix matching handles morphology)
  var GE_CATEGORY_STEMS = {
    'ვიდეო ბარათ': 'graphics cards', 'ვიდეო კარტ': 'graphics cards', 'გრაფიკულ': 'graphics cards',
    'პროცესორ': 'processors',
    'მეხსიერებ': 'memory',
    'კლავიატურ': 'keyboards',
    'მაუს': 'mice',
    'მონიტორ': 'monitors', 'ეკრან': 'monitors',
    'ლეპტოპ': 'notebooks', 'ნოუთბუქ': 'notebooks',
    'კორპუს': 'cases', 'ქეის': 'cases',
    'გაგრილებ': 'cooling', 'გამაგრილებ': 'cooling',
    'დედაპლატ': 'motherboards', 'დედა პლატ': 'motherboards',
    'ყურსასმენ': 'audio', 'აუდიო': 'audio',
    'როუტერ': 'networking', 'ქსელ': 'networking',
    'მაუსპად': 'mousepads',
    'თერმო': 'thermal compound', 'თერმულ': 'thermal compound'
  };

  // Georgian tech/shopping terms → English product field values
  var GE_TERM_MAP = {
    'სათამაშო': 'gaming', 'გეიმინგ': 'gaming', 'გეიმერ': 'gaming',
    'საოფისე': 'office', 'ოფის': 'office', 'ბიზნეს': 'office',
    'აწყობ': 'building', 'კომპიუტერის აწყობ': 'building',
    'იაფ': 'budget', 'ბიუჯეტ': 'budget', 'ხელმისაწვდომ': 'budget',
    'ძვირ': 'premium', 'პრემიუმ': 'premium'
  };

  // Product-intent keywords — if present, this IS a product query (overrides store detection)
  var PRODUCT_INTENT_KEYWORDS = ['მაჩვენე', 'მინდა', 'გაქვთ', 'გაქვს', 'შემარჩიე', 'შემთავაზე', 'მირჩიე', 'იყიდება', 'მოძებნე', 'არჩევა', 'recommend', 'show me', 'suggest'];

  // ========== FIELD WEIGHTS ==========
  var FIELD_WEIGHTS = {
    name: 5,
    brand: 4,
    category: 3,
    use: 2,
    description: 1
  };

  // ========== SEARCH ENGINE ==========
  function searchProducts(query, maxResults) {
    maxResults = maxResults || 5;
    if (!productData || !productData.products) {
      return { results: [], isProductQuery: false };
    }

    var rawQuery = query.toLowerCase().trim();
    var STOP_WORDS = ['the', 'for', 'and', 'with', 'my', 'your', 'this', 'that', 'from', 'have', 'has', 'are', 'was', 'were', 'will', 'can', 'could', 'would', 'should', 'what', 'which', 'who', 'how', 'does', 'is', 'it', 'its', 'me', 'do', 'to', 'of', 'in', 'on', 'at', 'an', 'or', 'but', 'not', 'no', 'so', 'if', 'up', 'out', 'all', 'get', 'got', 'be', 'been', 'being'];
    var words = rawQuery.split(/\s+/).filter(function (w) { return w.length > 1 && STOP_WORDS.indexOf(w) === -1; });

    // Extract numbers for price matching
    var numbers = [];
    for (var n = 0; n < words.length; n++) {
      var num = parseFloat(words[n]);
      if (!isNaN(num) && num > 10) numbers.push(num);
    }

    // Expand words with category aliases and track which categories were requested
    var expandedWords = words.slice();
    var requestedCategories = [];

    // Helper: add alias target to expanded words and requested categories
    function addAlias(target) {
      var t = target.toLowerCase();
      requestedCategories.push(t);
      var tw = t.split(/\s+/);
      for (var k = 0; k < tw.length; k++) {
        if (expandedWords.indexOf(tw[k]) === -1) expandedWords.push(tw[k]);
      }
    }

    // Check English exact aliases
    for (var a = 0; a < words.length; a++) {
      if (CATEGORY_ALIASES[words[a]]) addAlias(CATEGORY_ALIASES[words[a]]);
      if (a < words.length - 1) {
        var twoWord = words[a] + ' ' + words[a + 1];
        if (CATEGORY_ALIASES[twoWord]) addAlias(CATEGORY_ALIASES[twoWord]);
      }
    }

    // Check Georgian stems (prefix matching — handles plurals, cases, etc.)
    for (var stem in GE_CATEGORY_STEMS) {
      if (!GE_CATEGORY_STEMS.hasOwnProperty(stem)) continue;
      if (rawQuery.indexOf(stem) !== -1) {
        addAlias(GE_CATEGORY_STEMS[stem]);
      }
    }

    // Expand Georgian tech terms to English equivalents
    for (var geTerm in GE_TERM_MAP) {
      if (!GE_TERM_MAP.hasOwnProperty(geTerm)) continue;
      if (rawQuery.indexOf(geTerm) !== -1) {
        var enTerm = GE_TERM_MAP[geTerm];
        if (expandedWords.indexOf(enTerm) === -1) expandedWords.push(enTerm);
      }
    }

    var scored = [];

    for (var i = 0; i < productData.products.length; i++) {
      var p = productData.products[i];
      var score = 0;

      // Score each field separately with weights
      var fields = {
        name: (p.name || '').toLowerCase(),
        brand: (p.brand || '').toLowerCase(),
        category: (p.category || '').toLowerCase(),
        use: (p.use || '').toLowerCase(),
        description: (p.description || '').toLowerCase()
      };

      for (var w = 0; w < expandedWords.length; w++) {
        var word = expandedWords[w];
        for (var field in fields) {
          if (!fields.hasOwnProperty(field)) continue;
          var val = fields[field];
          var weight = FIELD_WEIGHTS[field];

          // Split field value into individual words for matching
          var fieldWords = val.split(/[\s,.\-\/]+/);

          var matched = false;
          for (var fw = 0; fw < fieldWords.length; fw++) {
            if (fieldWords[fw] === word) {
              // Exact word match
              score += weight * 2;
              matched = true;
              break;
            } else if (fieldWords[fw].indexOf(word) === 0) {
              // Prefix match
              score += weight * 1.5;
              matched = true;
              break;
            }
          }
          if (!matched && val.indexOf(word) !== -1) {
            // Substring match anywhere in field
            score += weight * 1;
          }
        }
      }

      // Price range bonus
      for (var pn = 0; pn < numbers.length; pn++) {
        var target = numbers[pn];
        if (p.price >= target * 0.8 && p.price <= target * 1.2) {
          score += 3;
        }
      }

      // Category intent boost — if user explicitly asked for a category, strongly prefer matching products
      for (var rc = 0; rc < requestedCategories.length; rc++) {
        if ((p.category || '').toLowerCase() === requestedCategories[rc]) {
          score += 15;
        }
      }

      if (score > 0) scored.push({ product: p, score: score });
    }

    scored.sort(function (a, b) { return b.score - a.score; });
    var results = scored.slice(0, maxResults);

    // Detect product-intent signals (overrides store detection)
    var hasProductIntent = false;
    for (var pi = 0; pi < PRODUCT_INTENT_KEYWORDS.length; pi++) {
      if (rawQuery.indexOf(PRODUCT_INTENT_KEYWORDS[pi]) !== -1) { hasProductIntent = true; break; }
    }
    // Category stem match is also a strong product intent signal
    if (requestedCategories.length > 0) hasProductIntent = true;

    // Detect store-related queries (only if no product intent)
    var storeKeywords = ['საათ', 'სამუშაო', 'მისამართ', 'ტელეფონ', 'განვადებ', 'ბანკ', 'გარანტი', 'დაბრუნებ', 'მიწოდება', 'გადახდ', 'კომპანი', 'hours', 'address', 'phone', 'location', 'where', 'when', 'open', 'close', 'delivery', 'shipping', 'payment', 'warranty', 'guarantee', 'return', 'refund', 'about', 'company', 'who are', 'founded'];
    var isStoreQuery = false;
    if (!hasProductIntent) {
      for (var sq = 0; sq < storeKeywords.length; sq++) {
        if (rawQuery.indexOf(storeKeywords[sq]) !== -1) { isStoreQuery = true; break; }
      }
    }

    return {
      results: results,
      isProductQuery: !isStoreQuery && (hasProductIntent || (results.length > 0 && results[0].score >= 4))
    };
  }

  // ========== PROMPT CONSTRUCTION ==========

  // Build a compact version of the full catalog (name, price, category, brand, availability, use)
  function buildCompactCatalog(data) {
    var lines = [];
    for (var i = 0; i < data.products.length; i++) {
      var p = data.products[i];
      var stock = p.availability === 'instock' ? 'მარაგშია' : 'წინასწარი შეკვეთა';
      lines.push(p.name + ' | ₾' + p.price + ' | ' + p.category + ' | ' + p.brand + ' | ' + stock);
    }
    return lines.join('\n');
  }

  function buildBasePrompt(data) {
    return 'შენ ხარ GITEC-ის პროფესიონალი კონსულტანტი. ისაუბრე თავაზიანად და პროფესიონალურად, როგორც გამოცდილი სპეციალისტი.\n\n' +
      'წესები:\n' +
      '- უპასუხე მაქსიმუმ 3-4 ხაზით. არასოდეს დაწერო გრძელი პასუხი. თუ ბევრი პროდუქტია, ჩამოთვალე მხოლოდ 2-3 საუკეთესო ვარიანტი.\n' +
      '- პირდაპირ შესთავაზე რაც გვაქვს, ფასებით.\n' +
      '- ისაუბრე პროფესიონალურად და პატივისცემით.\n' +
      '- ქართულად უპასუხე, თუ ინგლისურად არ გეკითხებიან.\n' +
      '- შესთავაზე მხოლოდ ის პროდუქტები, რომლებიც ქვემოთ მოცემულ კატალოგშია. არ მოიგონო პროდუქტი რომელიც კატალოგში არ არის.\n' +
      '- თუ რაღაც არ გვაქვს კატალოგში, თქვი პირდაპირ: "სამწუხაროდ, ეს პროდუქტი ჩვენთან არ მოიძებნა" და შესთავაზე ალტერნატივა კატალოგიდან.\n' +
      '- არ გაგზავნო სხვა მაღაზიაში. ჩვენი პროდუქტები შესთავაზე.\n' +
      '- ფასები ლარშია (₾).\n' +
      '- თუ კომპიუტერის აწყობაში ეხმარები, კატალოგიდან შეარჩიე კომპონენტები.\n' +
      '- მიწოდების, გარანტიის, დაბრუნების შეკითხვებზე უპასუხე ქვემოთ მოცემული ინფორმაციის მიხედვით.\n\n' +
      'STORE INFO:\n' +
      JSON.stringify(data.store, null, 0) + '\n\n' +
      'BANKING INFO:\n' +
      JSON.stringify(data.banking, null, 0) + '\n\n' +
      'DELIVERY INFO:\n' +
      '- თბილისში: 2 სამუშაო დღე, შეკვეთა 14:30-მდე, ფასი ₾6-დან\n' +
      '- რეგიონებში: 2-4 სამუშაო დღე, ფასი ₾8-დან\n' +
      '- ₾499+ შეკვეთაზე მიწოდება უფასოა\n' +
      '- მიწოდება მხოლოდ სამუშაო დღეებში (შაბათ-კვირას და უქმეებზე არა)\n\n' +
      'WARRANTY INFO:\n' +
      '- სისტემური ბლოკები და კომპონენტები: 1 წელი\n' +
      '- მონიტორები: 1-3 წელი (მწარმოებლის მიხედვით)\n' +
      '- UPS: 1 წელი\n' +
      '- კვების ბლოკები: 1 თვე\n' +
      '- კლავიატურა, მაუსი, დინამიკები, ყურსასმენი, ვებკამერა: 1 კვირა\n' +
      '- შეკეთება: 5 სამუშაო დღე ავტორიზებულ სერვის ცენტრში (თამარაშვილის 13ა)\n\n' +
      'RETURNS INFO:\n' +
      '- 14 კალენდარული დღე, მიზეზის მითითების გარეშე\n' +
      '- უკან დაბრუნების ტრანსპორტირება მყიდველის ხარჯით\n' +
      '- ორიგინალი შეფუთვა უნდა იყოს ხელუხლებელი\n' +
      '- არ ბრუნდება: ინდივიდუალური შეკვეთით დამზადებული, გახსნილი ჰიგიენური/დალუქული პროდუქცია, ფიზიკურად დაზიანებული ნივთები\n' +
      '- იურიდიულ პირებზე დაბრუნების უფლება არ ვრცელდება\n\n' +
      'ABOUT GITEC:\n' +
      '- დაარსდა 2007 წლის მაისში\n' +
      '- საქართველოს პირველი ინტერნეტ მაღაზია (2010 წლის დეკემბრიდან)\n' +
      '- წარმოდგენილია ბათუმში, ქუთაისში, რუსთავში, ფოთში\n' +
      '- საცალო და საბითუმო ვაჭრობა, კორპორატიული მომსახურება, ქსელის დაპროექტება და მონტაჟი\n\n' +
      'FULL PRODUCT CATALOG (' + data.products.length + ' products):\n' +
      buildCompactCatalog(data);
  }

  function buildContextualPrompt(data, retrievedProducts) {
    var base = buildBasePrompt(data);

    if (retrievedProducts && retrievedProducts.length > 0) {
      var products = [];
      for (var i = 0; i < retrievedProducts.length; i++) {
        products.push(retrievedProducts[i].product);
      }
      return base + '\n\n' +
        'BEST MATCHES for the customer\'s query (full details):\n' +
        JSON.stringify(products, null, 0) + '\n\n' +
        'Recommend these products first. You also have the full catalog above if the customer needs something else.';
    }

    return base;
  }

  // ========== BUILD WIDGET DOM ==========
  function createWidget() {
    var widget = document.createElement('div');
    widget.id = 'chat-widget';

    widget.innerHTML =
      '<button id="chat-toggle" title="Chat with us" aria-label="Open chat">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>' +
      '</button>' +
      '<div id="chat-panel">' +
      '<div class="chat-header">' +
      '<div class="chat-header-info">' +
      '<div class="chat-header-dot"></div>' +
      '<span>GITEC ასისტენტი</span>' +
      '</div>' +
      '<button class="chat-close" aria-label="Close chat">&times;</button>' +
      '</div>' +
      '<div class="chat-messages" id="chat-messages">' +
      '<div class="chat-msg bot">' +
      '<div class="chat-bubble">გამარჯობა! რით შემიძლია დაგეხმაროთ?</div>' +
      '</div>' +
      '</div>' +
      '<div class="chat-input-wrap">' +
      '<input type="text" id="chat-input" placeholder="იკითხეთ პროდუქტების შესახებ..." autocomplete="off">' +
      '<button id="chat-send" aria-label="Send message">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>' +
      '</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(widget);

    document.getElementById('chat-toggle').addEventListener('click', toggleChat);
    widget.querySelector('.chat-close').addEventListener('click', toggleChat);
    document.getElementById('chat-send').addEventListener('click', handleSend);
    document.getElementById('chat-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  // ========== TOGGLE CHAT ==========
  function toggleChat() {
    isOpen = !isOpen;
    var panel = document.getElementById('chat-panel');
    var toggle = document.getElementById('chat-toggle');
    panel.classList.toggle('open', isOpen);
    toggle.classList.toggle('active', isOpen);
    if (isOpen) {
      document.getElementById('chat-input').focus();
    }
    saveSession();
  }

  // ========== SEND MESSAGE ==========
  function handleSend() {
    if (isLoading) return;
    var input = document.getElementById('chat-input');
    var text = input.value.trim();
    if (!text) return;

    input.value = '';
    appendMessage('user', text);
    messages.push({ role: 'user', parts: [{ text: text }] });

    isLoading = true;

    // Step 1: Search for relevant products
    var search = searchProducts(text, 5);

    // Step 2: Show retrieval cards if product query
    if (search.isProductQuery && search.results.length > 0) {
      appendRetrievalCards(search.results);
    }

    // Step 3: Build contextual prompt (always pass search results if any — LLM has full catalog too)
    var contextualPrompt = buildContextualPrompt(
      productData,
      search.results.length > 0 ? search.results : null
    );

    // Step 4: Show typing indicator
    appendMessage('bot', '...', true);

    // Step 5: Call server proxy (keys stay server-side)
    var chain = callChatProxy(contextualPrompt)
      .catch(function (err) {
        console.warn('API proxy failed, using local search:', err.message);
        return formatLocalReply(search);
      });

    chain.then(function (reply) {
      removeTyping();
      appendMessage('bot', reply);
      messages.push({ role: 'model', parts: [{ text: reply }] });
      isLoading = false;
      saveSession();
    }).catch(function (err) {
      removeTyping();
      appendMessage('bot', 'სამწუხაროდ, შეცდომა მოხდა. დაგვიკავშირდით: 032 291 34 56');
      isLoading = false;
      saveSession();
      console.error('All fallbacks failed:', err);
    });
  }

  // ========== FORMAT LOCAL REPLY ==========
  function formatLocalReply(search) {
    if (search.results && search.results.length > 0) {
      var reply = 'აი რა მოიძებნა:\n';
      var count = Math.min(search.results.length, 3);
      for (var k = 0; k < count; k++) {
        var item = search.results[k].product;
        var stock = item.availability === 'instock' ? '✓' : 'წინასწარი შეკვეთა';
        reply += '- **' + item.name + '** — ₾ ' + item.price.toLocaleString() + ' (' + stock + ')\n';
      }
      return reply;
    }

    // No search results — show a category overview from actual product data
    if (productData && productData.products) {
      var cats = {};
      for (var i = 0; i < productData.products.length; i++) {
        var c = productData.products[i].category;
        cats[c] = (cats[c] || 0) + 1;
      }
      var reply2 = 'ჩვენთან ხელმისაწვდომია ' + productData.products.length + ' პროდუქტი შემდეგ კატეგორიებში:\n';
      for (var cat in cats) {
        if (cats.hasOwnProperty(cat)) {
          reply2 += '- **' + cat + '** (' + cats[cat] + ')\n';
        }
      }
      reply2 += '\nდაწერეთ კატეგორიის სახელი მეტი ინფორმაციისთვის.';
      return reply2;
    }

    return 'სამწუხაროდ, მონაცემები ვერ ჩაიტვირთა. დაგვიკავშირდით: 032 291 34 56 ან info@gitec.ge';
  }

  // ========== APPEND MESSAGE ==========
  function appendMessage(role, text, isTyping) {
    var container = document.getElementById('chat-messages');
    var div = document.createElement('div');
    div.className = 'chat-msg ' + (role === 'user' ? 'user' : 'bot');
    if (isTyping) div.classList.add('typing');

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    if (isTyping) {
      bubble.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
    } else {
      bubble.innerHTML = formatMessage(text);
    }

    div.appendChild(bubble);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // ========== APPEND RETRIEVAL CARDS ==========
  function appendRetrievalCards(results) {
    var container = document.getElementById('chat-messages');
    var div = document.createElement('div');
    div.className = 'chat-msg bot retrieval-msg';

    var retrieval = document.createElement('div');
    retrieval.className = 'chat-retrieval';

    // Header
    var header = document.createElement('div');
    header.className = 'retrieval-header';
    header.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' +
      '<span>მოიძებნა ' + results.length + ' პროდუქტი</span>';
    retrieval.appendChild(header);

    // Cards container
    var cards = document.createElement('div');
    cards.className = 'retrieval-cards';

    for (var i = 0; i < results.length; i++) {
      var p = results[i].product;
      var card = document.createElement('a');
      card.className = 'retrieval-card';
      card.href = 'product.html?id=' + p.id;
      card.style.animationDelay = (i * 100) + 'ms';

      var stockClass = p.availability === 'instock' ? 'in-stock' : 'preorder';
      var stockText = p.availability === 'instock' ? 'მარაგშია' : 'წინასწარი შეკვეთა';

      card.innerHTML =
        '<div class="retrieval-card-img">' +
        '<img src="' + p.image + '" alt="' + p.name + '" loading="lazy">' +
        '</div>' +
        '<div class="retrieval-card-info">' +
        '<div class="retrieval-card-name">' + p.name + '</div>' +
        '<div class="retrieval-card-price">₾ ' + p.price.toLocaleString() + '</div>' +
        '<div class="retrieval-card-stock ' + stockClass + '">' + stockText + '</div>' +
        '</div>';

      cards.appendChild(card);
    }

    retrieval.appendChild(cards);
    div.appendChild(retrieval);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() {
    var typing = document.querySelector('.chat-msg.typing');
    if (typing) typing.remove();
  }

  function formatMessage(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n- /g, '<br>• ')
      .replace(/\n\* /g, '<br>• ')
      .replace(/\n/g, '<br>');
  }

  // ========== CALL SERVER PROXY ==========
  function callChatProxy(contextualPrompt) {
    return fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages,
        systemPrompt: contextualPrompt
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Chat proxy returned ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.text) return data.text;
        throw new Error(data.error || 'No response from server');
      });
  }

  // ========== LOAD PRODUCT DATA & INIT ==========
  function init() {
    createWidget();
    restoreSession();

    var scriptPath = '';
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf('chatbot.js') !== -1) {
        // Strip chatbot.js and any query string (e.g., ?v=5) to get the base path
        scriptPath = scripts[i].src.replace(/chatbot\.js.*$/, '');
        break;
      }
    }

    function onData(data) {
      productData = data;
    }
    function onFail() {
      productData = { products: [], store: {}, banking: [] };
    }

    var jsonUrl = scriptPath + 'products.json';
    if (window.fetch && window.location.protocol !== 'file:') {
      fetch(jsonUrl).then(function (res) { return res.json(); }).then(onData).catch(onFail);
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', jsonUrl, true);
      xhr.onload = function () {
        if (xhr.status === 200 || xhr.status === 0) {
          try { onData(JSON.parse(xhr.responseText)); } catch (e) { onFail(); }
        } else { onFail(); }
      };
      xhr.onerror = onFail;
      xhr.send();
    }
  }

  // ========== START ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
