(function () {
  function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.hidden = true;
    }, 3000);
  }

  function formatTime(iso) {
    if (!iso) return "暂无";
    return new Date(iso).toLocaleString("zh-CN");
  }

  async function renderStats() {
    const list = document.getElementById("stats-list");
    const metaEl = document.getElementById("backup-meta");
    if (!list || !window.CoupleBackup) return;

    const stats = await CoupleBackup.getStorageStats();
    list.innerHTML = `
      <li><span>特殊日期</span><strong>${stats.dates} 条</strong></li>
      <li><span>自定义菜单</span><strong>${stats.menuCustom} 道</strong></li>
      <li><span>待做订单</span><strong>${stats.menuOrders} 单</strong></li>
      <li><span>照片</span><strong>${stats.photos} 张</strong></li>
      <li><span>照片备份副本</span><strong>${stats.photoBackup} 张</strong></li>
    `;

    if (metaEl) {
      metaEl.innerHTML = `
        上次自动备份：${formatTime(stats.meta.lastAutoBackup)}<br>
        上次导出：${formatTime(stats.meta.lastExport)}<br>
        上次恢复：${formatTime(stats.meta.lastImport)}
      `;
    }
  }

  document.getElementById("btn-export")?.addEventListener("click", async () => {
    try {
      const data = await CoupleBackup.exportToFile();
      const count = data.data.photos?.length || 0;
      showToast(`备份已下载（含 ${count} 张照片）`);
      renderStats();
    } catch {
      showToast("导出失败，请重试");
    }
  });

  document.getElementById("btn-import")?.addEventListener("click", () => {
    document.getElementById("import-file")?.click();
  });

  document.getElementById("import-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("恢复备份将覆盖当前所有数据，确定继续吗？")) {
      e.target.value = "";
      return;
    }
    try {
      await CoupleBackup.importFromFile(file);
      showToast("恢复成功！页面即将刷新…");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      showToast(err.message || "恢复失败，请检查文件");
    }
    e.target.value = "";
  });

  document.getElementById("btn-auto-backup")?.addEventListener("click", async () => {
    const ok = await CoupleBackup.runAutoBackup();
    showToast(ok ? "自动备份完成" : "备份失败");
    renderStats();
  });

  function renderSyncStatus() {
    const el = document.getElementById("sync-status");
    if (!el || !window.CoupleSync) return;
    const meta = CoupleSync.getMeta();
    const { room, url } = CoupleSync.getConfig();
    if (!CoupleSync.isEnabled()) {
      el.innerHTML = '⚠️ <strong>云同步未连接</strong> — 老婆点的菜你看不到。请双击运行 <code>解决同步.bat</code>（约 5 分钟，只需做一次）。';
      el.className = "sync-status sync-status-error";
      return;
    }
    const parts = [`同步码：${room}`];
    if (CoupleSync.getProvider?.() === "firebase") {
      parts.push("方式：Firebase 云同步");
    } else {
      parts.push(`服务器：${url}`);
    }
    if (meta.lastPush) parts.push(`上次上传：${formatTime(meta.lastPush)}`);
    if (meta.lastPull) parts.push(`上次拉取：${formatTime(meta.lastPull)}`);
    if (meta.status === "error" && meta.lastError) {
      el.textContent = parts.join(" · ") + ` · 错误：${meta.lastError}`;
      el.className = "sync-status sync-status-error";
    } else if (CoupleSync.isEnabled()) {
      el.textContent = parts.join(" · ") + " · 已开启（约每 8 秒自动同步）";
      el.className = "sync-status sync-status-ok";
    } else {
      el.textContent = parts.join(" · ");
      el.className = "sync-status";
    }
  }

  function loadSyncForm() {
    if (!window.CoupleSync) return;
    const { room, url } = CoupleSync.getConfig();
    const roomEl = document.getElementById("sync-room");
    const urlEl = document.getElementById("sync-url");
    if (roomEl) roomEl.value = room;
    if (urlEl) urlEl.value = url;
    renderSyncStatus();
  }

  document.getElementById("btn-gen-room")?.addEventListener("click", () => {
    const roomEl = document.getElementById("sync-room");
    if (roomEl && window.CoupleSync) {
      roomEl.value = CoupleSync.generateRoomCode();
    }
  });

  document.getElementById("btn-save-sync")?.addEventListener("click", () => {
    const room = document.getElementById("sync-room")?.value || "";
    const url = document.getElementById("sync-url")?.value || "";
    if (room.trim().length < 4) {
      showToast("同步码至少 4 位");
      return;
    }
    if (!url.trim()) {
      showToast("请填写同步服务器地址");
      return;
    }
    CoupleSync.setConfig(room, url);
    showToast("云同步已开启");
    renderSyncStatus();
  });

  document.getElementById("btn-sync-now")?.addEventListener("click", async () => {
    if (!CoupleSync?.isEnabled()) {
      showToast("请先保存同步配置");
      return;
    }
    showToast("正在同步…");
    await CoupleSync.push();
    const pulled = await CoupleSync.pull();
    showToast(pulled ? "已同步最新数据" : "同步完成");
    renderSyncStatus();
    renderStats();
  });

  window.addEventListener("couple-sync-updated", renderSyncStatus);
  window.addEventListener("couple-cloud-synced", () => {
    renderStats();
    showToast("收到对方更新");
  });

  let bgDraft = CoupleBackground?.load?.() || { mode: "default", overlay: 0.42 };

  function renderBgPreview() {
    const preview = document.getElementById("bg-preview");
    if (!preview || !window.CoupleBackground) return;
    const style = CoupleBackground.getPreviewStyle(bgDraft);
    Object.assign(preview.style, style);
    const overlay = document.getElementById("bg-overlay");
    const overlayVal = document.getElementById("bg-overlay-val");
    const pct = Math.round((bgDraft.overlay ?? 0.42) * 100);
    if (overlay) overlay.value = String(pct);
    if (overlayVal) overlayVal.textContent = pct + "%";
    document.querySelectorAll(".bg-preset-btn").forEach((btn) => {
      btn.classList.toggle("active", bgDraft.mode === "preset" && bgDraft.preset === btn.dataset.preset);
    });
  }

  function initBackgroundUI() {
    const presetsEl = document.getElementById("bg-presets");
    if (!presetsEl || !window.CoupleBackground) return;

    presetsEl.innerHTML = CoupleBackground.PRESETS.map(
      (p) =>
        `<button type="button" class="bg-preset-btn" data-preset="${p.id}">
          <span class="bg-preset-swatch" style="background:${p.swatch}"></span>
          ${p.label}
        </button>`
    ).join("");

    presetsEl.querySelectorAll(".bg-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        bgDraft = { mode: "preset", preset: btn.dataset.preset, overlay: bgDraft.overlay ?? 0.42 };
        CoupleBackground.apply(bgDraft);
        renderBgPreview();
      });
    });

    document.getElementById("bg-overlay")?.addEventListener("input", (e) => {
      const pct = Number(e.target.value);
      bgDraft.overlay = pct / 100;
      document.getElementById("bg-overlay-val").textContent = pct + "%";
      CoupleBackground.apply(bgDraft);
      renderBgPreview();
    });

    document.getElementById("btn-bg-color")?.addEventListener("click", () => {
      const color = document.getElementById("bg-color")?.value;
      if (!color) return;
      bgDraft = { mode: "color", color, overlay: bgDraft.overlay ?? 0.42 };
      CoupleBackground.apply(bgDraft);
      renderBgPreview();
    });

    document.getElementById("btn-bg-upload")?.addEventListener("click", () => {
      document.getElementById("bg-image")?.click();
    });

    document.getElementById("bg-image")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        showToast("正在处理图片…");
        const dataUrl = await CoupleBackground.compressImage(file, 1600, 0.72);
        bgDraft = { mode: "image", image: dataUrl, overlay: bgDraft.overlay ?? 0.42 };
        CoupleBackground.apply(bgDraft);
        renderBgPreview();
        showToast("图片已加载，记得点保存");
      } catch {
        showToast("图片处理失败");
      }
      e.target.value = "";
    });

    document.getElementById("btn-bg-save")?.addEventListener("click", () => {
      CoupleBackground.save(bgDraft);
      showToast("背景已保存");
    });

    document.getElementById("btn-bg-reset")?.addEventListener("click", () => {
      bgDraft = { mode: "default", overlay: 0.42 };
      CoupleBackground.save(bgDraft);
      renderBgPreview();
      showToast("已恢复默认背景");
    });

    const saved = CoupleBackground.load();
    if (saved.color) {
      const colorInput = document.getElementById("bg-color");
      if (colorInput) colorInput.value = saved.color;
    }
    bgDraft = { ...saved };
    renderBgPreview();
  }

  initBackgroundUI();

  function loadHomeProfileForm() {
    if (!window.CoupleHomeProfile) return;
    const p = CoupleHomeProfile.load();
    document.getElementById("hp-label").value = p.label || "";
    document.getElementById("hp-name-him").value = p.nameHim || "";
    document.getElementById("hp-name-her").value = p.nameHer || "";
    document.getElementById("hp-avatar-him").value = p.avatarHim || "";
    document.getElementById("hp-avatar-her").value = p.avatarHer || "";
    document.getElementById("hp-subtitle").value = p.subtitle || "";
    document.getElementById("hp-desc").value = p.desc || "";
  }

  document.getElementById("btn-hp-save")?.addEventListener("click", () => {
    if (!window.CoupleHomeProfile) return;
    CoupleHomeProfile.save({
      label: document.getElementById("hp-label")?.value.trim(),
      nameHim: document.getElementById("hp-name-him")?.value.trim(),
      nameHer: document.getElementById("hp-name-her")?.value.trim(),
      avatarHim: document.getElementById("hp-avatar-him")?.value.trim(),
      avatarHer: document.getElementById("hp-avatar-her")?.value.trim(),
      subtitle: document.getElementById("hp-subtitle")?.value.trim(),
      desc: document.getElementById("hp-desc")?.value.trim(),
    });
    showToast("首页已保存，返回首页查看");
  });

  document.getElementById("btn-hp-reset")?.addEventListener("click", () => {
    if (!window.CoupleHomeProfile) return;
    if (!confirm("恢复默认首页文字？")) return;
    CoupleHomeProfile.save({ ...CoupleHomeProfile.DEFAULTS });
    loadHomeProfileForm();
    showToast("已恢复默认");
  });

  loadHomeProfileForm();
  window.addEventListener("couple-home-profile-updated", loadHomeProfileForm);

  document.getElementById("btn-auth-save")?.addEventListener("click", () => {
    const pwd = document.getElementById("auth-new-password")?.value || "";
    const confirm = document.getElementById("auth-confirm-password")?.value || "";
    if (pwd.length < 2) {
      showToast("密码至少 2 位");
      return;
    }
    if (pwd !== confirm) {
      showToast("两次密码不一致");
      return;
    }
    if (window.CoupleAuth?.setPassword(pwd)) {
      showToast("密码已更新（本机）");
      document.getElementById("auth-new-password").value = "";
      document.getElementById("auth-confirm-password").value = "";
    }
  });

  document.getElementById("btn-auth-logout")?.addEventListener("click", () => {
    window.CoupleAuth?.logout?.();
  });

  renderStats();
  loadSyncForm();
  window.addEventListener("couple-backup-updated", renderStats);
})();
