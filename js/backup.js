(function () {
  const BACKUP_VERSION = 1;
  const AUTO_BACKUP_KEY = "couple-auto-backup";
  const AUTO_BACKUP_META_KEY = "couple-auto-backup-meta";
  const PHOTO_DB = "couple-photos";
  const PHOTO_STORE = "photos";
  const PHOTO_BACKUP_STORE = "photos_backup";
  const PHOTO_DB_VERSION = 2;

  const STORAGE_KEYS = {
    dates: "couple-special-dates",
    menuCustom: "couple-menu-custom",
    menuOrders: "couple-menu-orders",
    homeProfile: "couple-home-profile",
  };

  let autoBackupTimer = null;

  function safeParse(raw, fallback) {
    try {
      if (raw == null) return fallback;
      const data = JSON.parse(raw);
      return data ?? fallback;
    } catch {
      return fallback;
    }
  }

  function getMeta() {
    return safeParse(localStorage.getItem(AUTO_BACKUP_META_KEY), {
      lastAutoBackup: null,
      lastExport: null,
      lastImport: null,
    });
  }

  function setMeta(patch) {
    const meta = { ...getMeta(), ...patch };
    localStorage.setItem(AUTO_BACKUP_META_KEY, JSON.stringify(meta));
    window.dispatchEvent(new CustomEvent("couple-backup-updated"));
    return meta;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function base64ToBlob(base64, mimeType) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || "image/jpeg" });
  }

  function openPhotoDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(PHOTO_DB, PHOTO_DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(PHOTO_STORE)) {
          const store = database.createObjectStore(PHOTO_STORE, { keyPath: "id" });
          store.createIndex("album", "album", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
        if (!database.objectStoreNames.contains(PHOTO_BACKUP_STORE)) {
          const backup = database.createObjectStore(PHOTO_BACKUP_STORE, { keyPath: "id" });
          backup.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
  }

  function idbGetAll(db, storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function idbPut(db, storeName, record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function idbClear(db, storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function readLocalData() {
    return {
      dates: safeParse(localStorage.getItem(STORAGE_KEYS.dates), []),
      menuCustom: safeParse(localStorage.getItem(STORAGE_KEYS.menuCustom), []),
      menuOrders: safeParse(localStorage.getItem(STORAGE_KEYS.menuOrders), []),
      homeProfile: safeParse(localStorage.getItem(STORAGE_KEYS.homeProfile), null),
    };
  }

  function writeLocalData(data) {
    if (Array.isArray(data.dates)) {
      localStorage.setItem(STORAGE_KEYS.dates, JSON.stringify(data.dates));
    }
    if (Array.isArray(data.menuCustom)) {
      localStorage.setItem(STORAGE_KEYS.menuCustom, JSON.stringify(data.menuCustom));
    }
    if (Array.isArray(data.menuOrders)) {
      localStorage.setItem(STORAGE_KEYS.menuOrders, JSON.stringify(data.menuOrders));
    }
    if (data.homeProfile && typeof data.homeProfile === "object") {
      localStorage.setItem(STORAGE_KEYS.homeProfile, JSON.stringify(data.homeProfile));
      window.CoupleHomeProfile?.apply?.(data.homeProfile);
      window.dispatchEvent(new CustomEvent("couple-home-profile-updated"));
    }
  }

  async function collectPhotosForExport() {
    const db = await openPhotoDB();
    const photos = await idbGetAll(db, PHOTO_STORE);
    const exported = [];
    for (const photo of photos) {
      exported.push({
        id: photo.id,
        title: photo.title,
        album: photo.album,
        mimeType: photo.mimeType || "image/jpeg",
        createdAt: photo.createdAt,
        base64: await blobToBase64(photo.blob),
      });
    }
    db.close();
    return exported;
  }

  async function collectAllData() {
    const local = readLocalData();
    let photos = [];
    try {
      photos = await collectPhotosForExport();
    } catch {
      photos = [];
    }
    return {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: { ...local, photos },
    };
  }

  async function restorePhotos(photos) {
    if (!Array.isArray(photos)) return;
    const db = await openPhotoDB();
    await idbClear(db, PHOTO_STORE);
    await idbClear(db, PHOTO_BACKUP_STORE);

    for (const item of photos) {
      const record = {
        id: item.id || `photo-${Date.now().toString(36)}`,
        title: item.title || "",
        album: item.album || "daily",
        mimeType: item.mimeType || "image/jpeg",
        createdAt: item.createdAt || new Date().toISOString(),
        blob: base64ToBlob(item.base64, item.mimeType),
      };
      await idbPut(db, PHOTO_STORE, record);
      await idbPut(db, PHOTO_BACKUP_STORE, record);
    }
    db.close();
  }

  async function restoreAllData(payload, options = { merge: false }) {
    if (!payload || payload.version !== BACKUP_VERSION) {
      throw new Error("备份文件版本不兼容");
    }
    const data = payload.data || payload;
    if (!options.merge) {
      writeLocalData({
        dates: Array.isArray(data.dates) ? data.dates : [],
        menuCustom: Array.isArray(data.menuCustom) ? data.menuCustom : [],
        menuOrders: Array.isArray(data.menuOrders) ? data.menuOrders : [],
      });
    } else {
      const current = readLocalData();
      writeLocalData({
        dates: Array.isArray(data.dates) ? data.dates : current.dates,
        menuCustom: Array.isArray(data.menuCustom) ? data.menuCustom : current.menuCustom,
        menuOrders: Array.isArray(data.menuOrders) ? data.menuOrders : current.menuOrders,
      });
    }
    if (Array.isArray(data.photos)) {
      await restorePhotos(data.photos);
    }
  }

  async function runAutoBackup() {
    try {
      const local = readLocalData();
      const payload = {
        version: BACKUP_VERSION,
        savedAt: new Date().toISOString(),
        ...local,
      };
      localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(payload));
      setMeta({ lastAutoBackup: payload.savedAt });

      await syncPhotoBackupStore();
      return true;
    } catch (e) {
      console.warn("自动备份失败", e);
      return false;
    }
  }

  function writeLocalData(data) {
    if (!data) return;
    if (Array.isArray(data.dates)) {
      localStorage.setItem(STORAGE_KEYS.dates, JSON.stringify(data.dates));
    }
    if (Array.isArray(data.menuCustom)) {
      localStorage.setItem(STORAGE_KEYS.menuCustom, JSON.stringify(data.menuCustom));
    }
    if (Array.isArray(data.menuOrders)) {
      localStorage.setItem(STORAGE_KEYS.menuOrders, JSON.stringify(data.menuOrders));
    }
    window.dispatchEvent(new CustomEvent("couple-backup-updated"));
  }

  function scheduleAutoBackup() {
    clearTimeout(autoBackupTimer);
    autoBackupTimer = setTimeout(() => {
      runAutoBackup();
      window.CoupleSync?.schedulePush?.();
    }, 1500);
  }

  async function syncPhotoBackupStore() {
    const db = await openPhotoDB();
    const photos = await idbGetAll(db, PHOTO_STORE);
    await idbClear(db, PHOTO_BACKUP_STORE);
    for (const photo of photos) {
      await idbPut(db, PHOTO_BACKUP_STORE, photo);
    }
    db.close();
  }

  async function recoverPhotosIfNeeded() {
    try {
      const db = await openPhotoDB();
      const photos = await idbGetAll(db, PHOTO_STORE);
      const backup = await idbGetAll(db, PHOTO_BACKUP_STORE);

      if (!photos.length && backup.length) {
        for (const photo of backup) {
          await idbPut(db, PHOTO_STORE, photo);
        }
      } else if (photos.length && !backup.length) {
        for (const photo of photos) {
          await idbPut(db, PHOTO_BACKUP_STORE, photo);
        }
      }
      db.close();
    } catch (e) {
      console.warn("照片恢复检查失败", e);
    }
  }

  function recoverLocalFromAutoBackup() {
    const auto = safeParse(localStorage.getItem(AUTO_BACKUP_KEY), null);
    if (!auto) return false;

    let recovered = false;
    for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
      const current = localStorage.getItem(storageKey);
      const parsed = safeParse(current, null);
      const broken = current != null && parsed === null && current !== "null";
      const empty = parsed == null || (Array.isArray(parsed) && !parsed.length);

      if ((broken || (empty && Array.isArray(auto[key]) && auto[key].length)) && Array.isArray(auto[key])) {
        localStorage.setItem(storageKey, JSON.stringify(auto[key]));
        recovered = true;
      }
    }
    return recovered;
  }

  async function exportToFile() {
    const payload = await collectAllData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `我们俩-备份-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMeta({ lastExport: new Date().toISOString() });
    return payload;
  }

  async function importFromFile(file) {
    const text = await file.text();
    const payload = safeParse(text, null);
    if (!payload) throw new Error("文件格式无效");
    await restoreAllData(payload);
    await runAutoBackup();
    setMeta({ lastImport: new Date().toISOString() });
  }

  async function getStorageStats() {
    const local = readLocalData();
    let photoCount = 0;
    let photoBackupCount = 0;
    try {
      const db = await openPhotoDB();
      photoCount = (await idbGetAll(db, PHOTO_STORE)).length;
      photoBackupCount = (await idbGetAll(db, PHOTO_BACKUP_STORE)).length;
      db.close();
    } catch {
      /* ignore */
    }
    const meta = getMeta();
    return {
      dates: local.dates.length,
      menuCustom: local.menuCustom.length,
      menuOrders: local.menuOrders.filter((o) => o.status === "pending").length,
      photos: photoCount,
      photoBackup: photoBackupCount,
      meta,
    };
  }

  async function initStability() {
    const localRecovered = recoverLocalFromAutoBackup();
    await recoverPhotosIfNeeded();
    await runAutoBackup();

    if (localRecovered) {
      window.dispatchEvent(new CustomEvent("couple-data-recovered"));
    }
  }

  window.CoupleBackup = {
    BACKUP_VERSION,
    scheduleAutoBackup,
    runAutoBackup,
    syncPhotoBackupStore,
    collectAllData,
    restoreAllData,
    exportToFile,
    importFromFile,
    getStorageStats,
    getMeta,
    initStability,
    readLocalData,
    writeLocalData,
  };

  window.CoupleBackupReady = initStability();
})();
