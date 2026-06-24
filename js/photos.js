(function () {
  const DB_NAME = "couple-photos";
  const DB_VERSION = 2;
  const STORE = "photos";
  const BACKUP_STORE = "photos_backup";

  const ALBUMS = {
    daily: "日常",
    travel: "旅行",
    food: "美食",
    anniversary: "纪念日",
    other: "其他",
  };

  let db = null;
  let allPhotos = [];
  let filteredPhotos = [];
  let activeAlbum = "all";
  let lightboxIndex = -1;
  let objectUrls = new Map();

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

  function openDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(STORE)) {
          const store = database.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("album", "album", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
        if (!database.objectStoreNames.contains(BACKUP_STORE)) {
          const backup = database.createObjectStore(BACKUP_STORE, { keyPath: "id" });
          backup.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      req.onsuccess = () => {
        db = req.result;
        resolve(db);
      };
    });
  }

  function getAllPhotos() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function addPhoto(record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE, BACKUP_STORE], "readwrite");
      tx.objectStore(STORE).add(record);
      tx.objectStore(BACKUP_STORE).put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
    });
  }

  function deletePhoto(id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE, BACKUP_STORE], "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.objectStore(BACKUP_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function revokeUrl(id) {
    const url = objectUrls.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrls.delete(id);
    }
  }

  function getPhotoUrl(photo) {
    if (!objectUrls.has(photo.id)) {
      objectUrls.set(photo.id, URL.createObjectURL(photo.blob));
    }
    return objectUrls.get(photo.id);
  }

  function compressImage(file, maxSize = 1600, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("压缩失败"));
          },
          "image/jpeg",
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("无法读取图片"));
      };

      img.src = url;
    });
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  }

  function applyFilter() {
    filteredPhotos =
      activeAlbum === "all"
        ? [...allPhotos]
        : allPhotos.filter((p) => p.album === activeAlbum);
    filteredPhotos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function renderGallery() {
    const grid = document.getElementById("photo-grid");
    const countEl = document.getElementById("photo-count");
    if (!grid) return;

    applyFilter();

    if (countEl) {
      countEl.textContent = filteredPhotos.length
        ? `共 ${filteredPhotos.length} 张照片`
        : "";
    }

    if (!filteredPhotos.length) {
      grid.innerHTML =
        activeAlbum === "all"
          ? '<p class="photo-grid-empty">还没有照片，上传第一张吧</p>'
          : '<p class="photo-grid-empty">这个分类还没有照片</p>';
      return;
    }

    grid.innerHTML = filteredPhotos
      .map(
        (photo, index) => `
        <button type="button" class="photo-card" data-index="${index}" aria-label="${photo.title || "查看照片"}">
          <img src="${getPhotoUrl(photo)}" alt="${photo.title || ""}" loading="lazy">
          <div class="photo-card-overlay">
            ${photo.title ? `<span class="photo-card-title">${photo.title}</span>` : ""}
            <span class="photo-card-album">${ALBUMS[photo.album] || "其他"}</span>
          </div>
        </button>`
      )
      .join("");

    grid.querySelectorAll(".photo-card").forEach((btn) => {
      btn.addEventListener("click", () => openLightbox(Number(btn.dataset.index)));
    });
  }

  function renderHomePhotos() {
    const grid = document.getElementById("home-photos-grid");
    if (!grid) return;

    const recent = [...allPhotos]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4);

    if (!recent.length) {
      grid.innerHTML =
        '<p class="home-photos-empty">还没有照片，<a href="photos.html">去相册上传</a>吧</p>';
      return;
    }

    grid.innerHTML = recent
      .map(
        (photo) => `
        <a href="photos.html" class="home-photo-item">
          <img src="${getPhotoUrl(photo)}" alt="${photo.title || "我们的照片"}" loading="lazy">
        </a>`
      )
      .join("");
  }

  async function handleFiles(files) {
    if (!files.length) return;

    const album = document.getElementById("upload-album")?.value || "daily";
    const caption = document.getElementById("upload-caption")?.value.trim() || "";
    const progressEl = document.getElementById("upload-progress");
    const progressFill = document.getElementById("progress-fill");
    const progressText = document.getElementById("progress-text");

    progressEl?.classList.remove("hidden");

    let done = 0;
    const total = files.length;

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;

      try {
        progressText.textContent = `正在处理 ${done + 1} / ${total}…`;
        const blob = await compressImage(file);
        const record = {
          id: `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          title: caption || file.name.replace(/\.[^.]+$/, ""),
          album,
          blob,
          mimeType: "image/jpeg",
          createdAt: new Date().toISOString(),
        };
        await addPhoto(record);
        allPhotos.push(record);
        done += 1;
        if (progressFill) progressFill.style.width = `${(done / total) * 100}%`;
      } catch {
        showToast(`「${file.name}」上传失败`);
      }
    }

    progressEl?.classList.add("hidden");
    if (progressFill) progressFill.style.width = "0";

    if (done > 0) {
      showToast(`成功上传 ${done} 张照片 🎉`);
      window.CoupleBackup?.scheduleAutoBackup();
      renderGallery();
      renderHomePhotos();
      window.dispatchEvent(new CustomEvent("couple-photos-updated"));
    }
  }

  function openLightbox(index) {
    lightboxIndex = index;
    const photo = filteredPhotos[index];
    if (!photo) return;

    const dialog = document.getElementById("photo-lightbox");
    const img = document.getElementById("lightbox-img");
    const caption = document.getElementById("lightbox-caption");
    const meta = document.getElementById("lightbox-meta");

    if (img) {
      img.src = getPhotoUrl(photo);
      img.alt = photo.title || "";
    }
    if (caption) caption.textContent = photo.title || "无说明";
    if (meta) meta.textContent = `${ALBUMS[photo.album] || "其他"} · ${formatDate(photo.createdAt)}`;

    dialog?.showModal();
  }

  function navigateLightbox(delta) {
    if (!filteredPhotos.length) return;
    lightboxIndex = (lightboxIndex + delta + filteredPhotos.length) % filteredPhotos.length;
    openLightbox(lightboxIndex);
  }

  async function removeCurrentPhoto() {
    const photo = filteredPhotos[lightboxIndex];
    if (!photo || !confirm("确定删除这张照片吗？")) return;

    await deletePhoto(photo.id);
    revokeUrl(photo.id);
    allPhotos = allPhotos.filter((p) => p.id !== photo.id);
    document.getElementById("photo-lightbox")?.close();
    window.CoupleBackup?.scheduleAutoBackup();
    renderGallery();
    renderHomePhotos();
    window.dispatchEvent(new CustomEvent("couple-photos-updated"));
    showToast("照片已删除");
  }

  function initUpload() {
    const zone = document.getElementById("upload-zone");
    const input = document.getElementById("photo-input");
    const camera = document.getElementById("photo-camera");
    const btn = document.getElementById("upload-btn");
    const cameraBtn = document.getElementById("upload-camera");

    const bindFileInput = (el) => {
      el?.addEventListener("change", () => {
        if (el.files?.length) handleFiles([...el.files]);
        el.value = "";
      });
    };

    btn?.addEventListener("click", (e) => {
      e.stopPropagation();
      input?.click();
    });
    cameraBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      camera?.click();
    });

    bindFileInput(input);
    bindFileInput(camera);

    zone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("drag-over");
    });
    zone?.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone?.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      if (e.dataTransfer?.files) handleFiles([...e.dataTransfer.files]);
    });
  }

  function initFilters() {
    document.querySelectorAll("#photo-filters .filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeAlbum = btn.dataset.album;
        document.querySelectorAll("#photo-filters .filter-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        renderGallery();
      });
    });
  }

  function initLightbox() {
    const dialog = document.getElementById("photo-lightbox");
    document.getElementById("lightbox-close")?.addEventListener("click", () => dialog?.close());
    document.getElementById("lightbox-prev")?.addEventListener("click", () => navigateLightbox(-1));
    document.getElementById("lightbox-next")?.addEventListener("click", () => navigateLightbox(1));
    document.getElementById("lightbox-delete")?.addEventListener("click", removeCurrentPhoto);

    dialog?.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });

    document.addEventListener("keydown", (e) => {
      if (!dialog?.open) return;
      if (e.key === "ArrowLeft") navigateLightbox(-1);
      if (e.key === "ArrowRight") navigateLightbox(+1);
      if (e.key === "Escape") dialog.close();
    });
  }

  async function init() {
    try {
      if (window.CoupleBackupReady) await window.CoupleBackupReady;
      await openDB();
      allPhotos = await getAllPhotos();
      initUpload();
      initFilters();
      initLightbox();
      renderGallery();
      renderHomePhotos();
    } catch {
      showToast("相册加载失败，请刷新重试");
    }
  }

  init();

  window.CouplePhotos = { refresh: init };
})();
