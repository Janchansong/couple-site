(function () {
  const ROOM_KEY = "couple-sync-room";
  const URL_KEY = "couple-sync-url";
  const META_KEY = "couple-sync-meta";
  const DEVICE_KEY = "couple-sync-device-id";

  let pushTimer = null;
  let pollTimer = null;
  let pushing = false;

  function safeParse(raw, fallback) {
    try {
      if (raw == null) return fallback;
      return JSON.parse(raw) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "d-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function applyBuiltInConfig() {
    const cfg = window.CoupleSyncConfig;
    if (!cfg?.enabled) return;
    if (cfg.room) localStorage.setItem(ROOM_KEY, cfg.room);
    if (cfg.syncUrl) localStorage.setItem(URL_KEY, cfg.syncUrl.replace(/\/$/, ""));
  }

  function getConfig() {
    const cfg = window.CoupleSyncConfig || {};
    return {
      room: (localStorage.getItem(ROOM_KEY) || cfg.room || "").trim(),
      url: (localStorage.getItem(URL_KEY) || cfg.syncUrl || "").trim().replace(/\/$/, ""),
    };
  }

  function setConfig(room, url) {
    if (room != null) localStorage.setItem(ROOM_KEY, room.trim());
    if (url != null) localStorage.setItem(URL_KEY, url.trim().replace(/\/$/, ""));
    restart();
    window.dispatchEvent(new CustomEvent("couple-sync-config-changed"));
  }

  function getMeta() {
    return safeParse(localStorage.getItem(META_KEY), {
      lastPull: null,
      lastPush: null,
      lastError: null,
      status: "idle",
    });
  }

  function setMeta(patch) {
    const meta = { ...getMeta(), ...patch };
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    window.dispatchEvent(new CustomEvent("couple-sync-updated", { detail: meta }));
    return meta;
  }

  function isEnabled() {
    const { room, url } = getConfig();
    return room.length >= 4 && url.length > 8;
  }

  function mergeById(localArr, remoteArr) {
    const map = new Map();
    const all = [...(localArr || []), ...(remoteArr || [])];
    for (const item of all) {
      if (!item?.id) continue;
      const prev = map.get(item.id);
      const t = new Date(item.updatedAt || item.createdAt || 0).getTime();
      const pt = prev ? new Date(prev.updatedAt || prev.createdAt || 0).getTime() : 0;
      if (!prev || t >= pt) map.set(item.id, item);
    }
    return [...map.values()];
  }

  function mergeData(local, remote) {
    return {
      dates: mergeById(local.dates, remote.dates),
      menuCustom: mergeById(local.menuCustom, remote.menuCustom),
      menuOrders: mergeById(local.menuOrders, remote.menuOrders),
    };
  }

  function buildPayload() {
    const local = window.CoupleBackup?.readLocalData?.() || {
      dates: [],
      menuCustom: [],
      menuOrders: [],
    };
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      deviceId: getDeviceId(),
      dates: local.dates || [],
      menuCustom: local.menuCustom || [],
      menuOrders: local.menuOrders || [],
    };
  }

  function applyRemote(remote) {
    if (!remote || !window.CoupleBackup?.writeLocalData) return false;
    const local = window.CoupleBackup.readLocalData();
    const merged = mergeData(local, remote);
    window.CoupleBackup.writeLocalData(merged);
    window.CoupleBackup.scheduleAutoBackup?.();
    window.dispatchEvent(new CustomEvent("couple-dates-updated"));
    window.dispatchEvent(new CustomEvent("couple-cloud-synced"));
    return true;
  }

  async function pull() {
    if (!isEnabled() || pushing) return false;
    const { room, url } = getConfig();
    setMeta({ status: "pulling" });
    try {
      const res = await fetch(`${url}/${encodeURIComponent(room)}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`拉取失败 (${res.status})`);
      const remote = await res.json();
      if (!remote?.updatedAt) {
        setMeta({ status: "idle", lastPull: new Date().toISOString(), lastError: null });
        return false;
      }

      const local = window.CoupleBackup?.readLocalData?.() || {};
      const hasRemoteOrders =
        Array.isArray(remote.menuOrders) &&
        remote.menuOrders.some((o) => o.status === "pending");
      const remoteNewer =
        new Date(remote.updatedAt).getTime() >
        new Date(buildPayload().updatedAt).getTime();
      const fromOther = remote.deviceId && remote.deviceId !== getDeviceId();

      if (fromOther || remoteNewer || hasRemoteOrders) {
        const changed = applyRemote(remote);
        setMeta({
          status: "idle",
          lastPull: new Date().toISOString(),
          lastAppliedRemote: remote.updatedAt,
          lastError: null,
        });
        return changed;
      }

      setMeta({ status: "idle", lastPull: new Date().toISOString(), lastError: null });
      return false;
    } catch (err) {
      setMeta({
        status: "error",
        lastError: err.message || "同步失败",
      });
      return false;
    }
  }

  async function push() {
    if (!isEnabled()) return false;
    const { room, url } = getConfig();
    pushing = true;
    setMeta({ status: "pushing" });
    try {
      const local = window.CoupleBackup?.readLocalData?.() || {};
      let payload = buildPayload();

      try {
        const res = await fetch(`${url}/${encodeURIComponent(room)}`, { cache: "no-store" });
        if (res.ok) {
          const remote = await res.json();
          if (remote?.updatedAt) {
            payload = {
              ...mergeData(local, remote),
              version: 1,
              updatedAt: new Date().toISOString(),
              deviceId: getDeviceId(),
            };
          }
        }
      } catch {
        /* 远端暂无数据，直接上传本地 */
      }

      const putRes = await fetch(`${url}/${encodeURIComponent(room)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!putRes.ok) throw new Error(`上传失败 (${putRes.status})`);

      window.CoupleBackup?.writeLocalData?.({
        dates: payload.dates,
        menuCustom: payload.menuCustom,
        menuOrders: payload.menuOrders,
      });

      setMeta({
        status: "idle",
        lastPush: new Date().toISOString(),
        lastAppliedRemote: payload.updatedAt,
        lastError: null,
      });
      return true;
    } catch (err) {
      setMeta({
        status: "error",
        lastError: err.message || "上传失败",
      });
      return false;
    } finally {
      pushing = false;
    }
  }

  function schedulePush() {
    if (!isEnabled()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      push();
    }, 600);
  }

  function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function restart() {
    clearInterval(pollTimer);
    if (!isEnabled()) {
      setMeta({ status: "disabled" });
      return;
    }
    pull();
    pollTimer = setInterval(() => {
      pull();
    }, 3000);
  }

  function init() {
    applyBuiltInConfig();
    window.addEventListener("couple-backup-updated", schedulePush);
    window.addEventListener("couple-data-recovered", schedulePush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && isEnabled()) pull();
    });
    restart();
  }

  window.CoupleSync = {
    getConfig,
    setConfig,
    getMeta,
    isEnabled,
    pull,
    push,
    schedulePush,
    generateRoomCode,
    restart,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
