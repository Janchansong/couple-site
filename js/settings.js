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

  renderStats();
  window.addEventListener("couple-backup-updated", renderStats);
})();
