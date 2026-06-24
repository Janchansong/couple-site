(function () {
  const ORDERS_KEY = "couple-menu-orders";
  const CUSTOM_MENU_KEY = "couple-menu-custom";

  const DEFAULT_MENU = [
    { id: "tomato-egg", name: "番茄炒蛋", emoji: "🍅", category: "home" },
    { id: "potato-pork", name: "土豆炖排骨", emoji: "🥔", category: "home" },
    { id: "fish", name: "清蒸鲈鱼", emoji: "🐟", category: "home" },
    { id: "tofu", name: "麻婆豆腐", emoji: "🌶️", category: "home" },
    { id: "chicken", name: "可乐鸡翅", emoji: "🍗", category: "home" },
    { id: "veg", name: "蒜蓉西兰花", emoji: "🥦", category: "home" },
    { id: "egg-fried-rice", name: "蛋炒饭", emoji: "🍚", category: "stir" },
    { id: "beef", name: "小炒黄牛肉", emoji: "🥩", category: "stir" },
    { id: "noodles", name: "葱油拌面", emoji: "🍜", category: "stir" },
    { id: "dumpling", name: "手工水饺", emoji: "🥟", category: "stir" },
    { id: "soup-tomato", name: "番茄蛋花汤", emoji: "🍲", category: "soup" },
    { id: "soup-wonton", name: "小馄饨", emoji: "🥣", category: "soup" },
    { id: "soup-corn", name: "玉米排骨汤", emoji: "🌽", category: "soup" },
    { id: "cake", name: "红糖糍粑", emoji: "🍡", category: "sweet" },
    { id: "fruit", name: "切水果拼盘", emoji: "🍓", category: "sweet" },
    { id: "milk-tea", name: "自制奶茶", emoji: "🧋", category: "drink" },
    { id: "lemon", name: "柠檬蜂蜜水", emoji: "🍋", category: "drink" },
  ];

  const CATEGORIES = [
    { id: "all", label: "全部" },
    { id: "home", label: "家常菜" },
    { id: "stir", label: "小炒主食" },
    { id: "soup", label: "汤羹" },
    { id: "sweet", label: "甜点" },
    { id: "drink", label: "饮品" },
  ];

  const EMOJI_OPTIONS = ["🍽️", "🍖", "🥘", "🍲", "🥗", "🍜", "🍚", "🥟", "🍗", "🐟", "🦐", "🥩", "🍳", "🥦", "🍅", "🌶️", "🍰", "🧋", "🍓", "✨"];

  let cart = [];
  let activeCategory = "all";

  function loadCustomMenu() {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_MENU_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveCustomMenu(items) {
    localStorage.setItem(CUSTOM_MENU_KEY, JSON.stringify(items));
    window.CoupleBackup?.scheduleAutoBackup();
  }

  function getMenu() {
    return [...DEFAULT_MENU, ...loadCustomMenu()];
  }

  function loadOrders() {
    try {
      return JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveOrders(orders) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    window.CoupleBackup?.scheduleAutoBackup();
  }

  function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.hidden = true;
    }, 2600);
  }

  function cartKey(item) {
    return item.id || `custom:${item.name}`;
  }

  function renderCategories() {
    const el = document.getElementById("menu-categories");
    if (!el) return;
    el.innerHTML = CATEGORIES.map(
      (cat) =>
        `<button class="filter-btn${cat.id === activeCategory ? " active" : ""}" data-category="${cat.id}">${cat.label}</button>`
    ).join("");

    el.querySelectorAll("[data-category]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.category;
        renderCategories();
        renderMenuGrid();
      });
    });
  }

  function renderMenuGrid() {
    const el = document.getElementById("menu-grid");
    if (!el) return;

    const menu = getMenu();
    const items =
      activeCategory === "all"
        ? menu
        : menu.filter((item) => item.category === activeCategory);

    if (!items.length) {
      el.innerHTML = '<p class="menu-grid-empty">这个分类还没有菜，去「管理菜单」添加吧</p>';
      return;
    }

    el.innerHTML = items
      .map((item) => {
        const inCart = cart.find((c) => cartKey(c) === item.id);
        const qty = inCart ? inCart.qty : 0;
        const customTag = item.custom ? '<span class="menu-custom-tag">自建</span>' : "";
        return `
          <article class="menu-item${qty ? " in-cart" : ""}${item.custom ? " menu-item-custom" : ""}" data-id="${item.id}">
            <span class="menu-item-emoji">${item.emoji}</span>
            <h3 class="menu-item-name">${item.name}${customTag}</h3>
            <div class="menu-item-actions">
              ${
                qty
                  ? `<div class="qty-control">
                      <button type="button" class="qty-btn" data-action="minus" data-id="${item.id}" aria-label="减少">−</button>
                      <span class="qty-num">${qty}</span>
                      <button type="button" class="qty-btn" data-action="plus" data-id="${item.id}" aria-label="增加">+</button>
                    </div>`
                  : `<button type="button" class="btn btn-primary btn-sm" data-action="add" data-id="${item.id}">点这个</button>`
              }
            </div>
          </article>`;
      })
      .join("");

    el.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleMenuAction(btn));
    });
  }

  function handleMenuAction(btn) {
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const item = getMenu().find((m) => m.id === id);
    if (!item) return;

    const key = item.id;
    const existing = cart.find((c) => cartKey(c) === key);

    if (action === "add" || action === "plus") {
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({ id: item.id, name: item.name, emoji: item.emoji, qty: 1 });
      }
    } else if (action === "minus" && existing) {
      existing.qty -= 1;
      if (existing.qty <= 0) {
        cart = cart.filter((c) => cartKey(c) !== key);
      }
    }

    renderCart();
    renderMenuGrid();
  }

  function addOneOffDish(name) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const key = `custom:${trimmed}`;
    const existing = cart.find((c) => cartKey(c) === key);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ name: trimmed, emoji: "✨", qty: 1 });
    }

    renderCart();
    renderMenuGrid();
    showToast(`已加入订单：${trimmed}`);
  }

  function addMenuItem(name, emoji, category) {
    const trimmed = name.trim();
    if (!trimmed) return false;

    const menu = getMenu();
    if (menu.some((item) => item.name === trimmed)) {
      showToast("这道菜已经在菜单里了");
      return false;
    }

    const dish = {
      id: `user-${Date.now().toString(36)}`,
      name: trimmed,
      emoji: emoji.trim() || "🍽️",
      category,
      custom: true,
      createdAt: new Date().toISOString(),
    };

    const custom = loadCustomMenu();
    custom.push(dish);
    saveCustomMenu(custom);

    renderMenuGrid();
    renderManageList();
    showToast(`「${trimmed}」已加入菜单`);
    return true;
  }

  function removeMenuItem(id) {
    const custom = loadCustomMenu();
    const dish = custom.find((item) => item.id === id);
    if (!dish) return;

    const next = custom.filter((item) => item.id !== id);
    saveCustomMenu(next);

    cart = cart.filter((c) => c.id !== id);
    renderCart();
    renderMenuGrid();
    renderManageList();
    showToast(`「${dish.name}」已从菜单移除`);
  }

  function renderManageList() {
    const el = document.getElementById("custom-menu-list");
    if (!el) return;

    const custom = loadCustomMenu();
    if (!custom.length) {
      el.innerHTML = '<li class="manage-empty">还没有自定义菜品，上方添加第一道吧</li>';
      return;
    }

    el.innerHTML = custom
      .map((item) => {
        const cat = CATEGORIES.find((c) => c.id === item.category);
        return `
          <li class="manage-dish-item">
            <span class="manage-dish-emoji">${item.emoji}</span>
            <div class="manage-dish-info">
              <strong>${item.name}</strong>
              <span>${cat?.label || "未分类"}</span>
            </div>
            <button type="button" class="btn-delete" data-delete="${item.id}" aria-label="删除 ${item.name}">删除</button>
          </li>`;
      })
      .join("");

    el.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("确定从菜单中删除这道菜吗？")) {
          removeMenuItem(btn.dataset.delete);
        }
      });
    });
  }

  function initManageForm() {
    const categorySelect = document.getElementById("new-dish-category");
    if (categorySelect) {
      categorySelect.innerHTML = CATEGORIES.filter((c) => c.id !== "all")
        .map((c) => `<option value="${c.id}">${c.label}</option>`)
        .join("");
    }

    const picker = document.getElementById("emoji-picker");
    const emojiInput = document.getElementById("new-dish-emoji");
    if (picker && emojiInput) {
      picker.innerHTML = EMOJI_OPTIONS.map(
        (e) => `<button type="button" class="emoji-option" data-emoji="${e}">${e}</button>`
      ).join("");
      picker.querySelectorAll(".emoji-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          emojiInput.value = btn.dataset.emoji;
        });
      });
    }

    document.getElementById("add-menu-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("new-dish-name")?.value || "";
      const emoji = document.getElementById("new-dish-emoji")?.value || "🍽️";
      const category = document.getElementById("new-dish-category")?.value || "home";

      if (addMenuItem(name, emoji, category)) {
        e.target.reset();
        if (emojiInput) emojiInput.value = "🍽️";
      }
    });
  }

  function renderCart() {
    const list = document.getElementById("cart-list");
    const submitBtn = document.getElementById("submit-order");
    const bar = document.getElementById("cart-bar");
    const barCount = document.getElementById("cart-bar-count");
    if (!list) return;

    const total = cart.reduce((sum, item) => sum + item.qty, 0);

    if (bar) bar.hidden = total === 0;
    if (barCount) barCount.textContent = String(total);
    if (submitBtn) submitBtn.disabled = total === 0;

    if (total === 0) {
      list.innerHTML = '<li class="cart-empty">还没有选菜哦</li>';
      return;
    }

    list.innerHTML = cart
      .map((item) => {
        const key = cartKey(item);
        return `
          <li class="cart-item">
            <span class="cart-item-emoji">${item.emoji || "🍽️"}</span>
            <span class="cart-item-name">${item.name}</span>
            <div class="qty-control qty-control-sm">
              <button type="button" class="qty-btn" data-cart-minus="${key}" aria-label="减少">−</button>
              <span class="qty-num">${item.qty}</span>
              <button type="button" class="qty-btn" data-cart-plus="${key}" aria-label="增加">+</button>
            </div>
          </li>`;
      })
      .join("");

    list.querySelectorAll("[data-cart-minus]").forEach((btn) => {
      btn.addEventListener("click", () => updateCartQty(btn.dataset.cartMinus, -1));
    });
    list.querySelectorAll("[data-cart-plus]").forEach((btn) => {
      btn.addEventListener("click", () => updateCartQty(btn.dataset.cartPlus, 1));
    });
  }

  function updateCartQty(key, delta) {
    const item = cart.find((c) => cartKey(c) === key);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter((c) => cartKey(c) !== key);
    }
    renderCart();
    renderMenuGrid();
  }

  function submitOrder() {
    if (!cart.length) return;

    const noteEl = document.getElementById("order-note");
    const orders = loadOrders();
    const order = {
      id: Date.now().toString(36),
      items: cart.map((c) => ({ name: c.name, emoji: c.emoji, qty: c.qty })),
      note: noteEl?.value.trim() || "",
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    orders.unshift(order);
    saveOrders(orders);

    cart = [];
    if (noteEl) noteEl.value = "";

    renderCart();
    renderMenuGrid();
    renderKitchen();
    updatePendingBadge();
    showToast("已提交！老公去厨房啦 🍳");
  }

  function formatTime(iso) {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `今天 ${time}`;
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) + " " + time;
  }

  function renderKitchen() {
    const el = document.getElementById("kitchen-list");
    if (!el) return;

    const pending = loadOrders().filter((o) => o.status === "pending");

    if (!pending.length) {
      el.innerHTML = '<p class="kitchen-empty">暂无待做订单，等老婆点菜吧 🍽️</p>';
      return;
    }

    el.innerHTML = pending
      .map(
        (order) => `
        <article class="kitchen-order">
          <div class="kitchen-order-head">
            <time>${formatTime(order.createdAt)}</time>
            <button type="button" class="btn btn-primary btn-sm" data-done="${order.id}">已完成 ✓</button>
          </div>
          <ul class="kitchen-items">
            ${order.items
              .map(
                (item) =>
                  `<li><span>${item.emoji || "🍽️"}</span> ${item.name}${item.qty > 1 ? ` × ${item.qty}` : ""}</li>`
              )
              .join("")}
          </ul>
          ${order.note ? `<p class="kitchen-note">备注：${order.note}</p>` : ""}
        </article>`
      )
      .join("");

    el.querySelectorAll("[data-done]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const orders = loadOrders();
        const target = orders.find((o) => o.id === btn.dataset.done);
        if (target) {
          target.status = "done";
          saveOrders(orders);
          renderKitchen();
          updatePendingBadge();
          showToast("搞定！老婆会开心的 😊");
        }
      });
    });
  }

  function updatePendingBadge() {
    const badge = document.getElementById("pending-badge");
    if (!badge) return;
    const count = loadOrders().filter((o) => o.status === "pending").length;
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  function initViewTabs() {
    const tabs = document.querySelectorAll(".menu-tab");
    const orderView = document.getElementById("order-view");
    const kitchenView = document.getElementById("kitchen-view");
    const manageView = document.getElementById("manage-view");

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const view = tab.dataset.view;
        tabs.forEach((t) => {
          t.classList.toggle("active", t === tab);
          t.setAttribute("aria-selected", String(t === tab));
        });
        orderView?.classList.toggle("hidden", view !== "order");
        kitchenView?.classList.toggle("hidden", view !== "kitchen");
        manageView?.classList.toggle("hidden", view !== "manage");
        if (view === "kitchen") renderKitchen();
        if (view === "manage") renderManageList();
      });
    });
  }

  function initEvents() {
    document.getElementById("submit-order")?.addEventListener("click", submitOrder);

    document.getElementById("clear-cart")?.addEventListener("click", () => {
      if (!cart.length) return;
      cart = [];
      renderCart();
      renderMenuGrid();
      showToast("菜单已清空");
    });

    document.getElementById("custom-dish-add")?.addEventListener("click", () => {
      const input = document.getElementById("custom-dish-input");
      if (input) {
        addOneOffDish(input.value);
        input.value = "";
      }
    });

    document.getElementById("custom-dish-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addOneOffDish(e.target.value);
        e.target.value = "";
      }
    });

    document.getElementById("cart-bar-toggle")?.addEventListener("click", () => {
      document.getElementById("menu-cart")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  renderCategories();
  renderMenuGrid();
  renderCart();
  renderKitchen();
  renderManageList();
  initManageForm();
  updatePendingBadge();
  initViewTabs();
  initEvents();

  window.addEventListener("couple-cloud-synced", () => {
    renderKitchen();
    renderManageList();
    updatePendingBadge();
  });
})();
