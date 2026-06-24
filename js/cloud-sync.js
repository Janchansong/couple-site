(function () {
  const ROOM_KEY = "couple-sync-room";
  const URL_KEY = "couple-sync-url";
  const FIREBASE_KEY = "couple-sync-firebase";
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

  function getBuiltIn() {
    return window.CoupleSyncConfig || {};
  }

  function applyBuiltInConfig() {
    const cfg = getBuiltIn();
    if (!cfg.enabled) return;
    if (cfg.room) localStorage.setItem(ROOM_KEY, cfg.room);
    if (cfg.syncUrl) localStorage.setItem(URL_KEY, cfg.syncUrl.replace(/\/$/, ""));
    if (cfg.firebaseUrl) localStorage.setItem(FIREBASE_KEY, cfg.firebaseUrl.replace(/\/$/, ""));
  }

  function getConfig() {
    const cfg = getBuiltIn();
    return {
      room: (localStorage.getItem(ROOM_KEY) || cfg.room || "").trim(),
      url: (localStorage.getItem(URL_KEY) || cfg.syncUrl || "").trim().replace(/\/$/, ""),
      firebase: (localStorage.getItem(FIREBASE_KEY) || cfg.firebaseUrl || "").trim().replace(/\/$/, ""),
    };
  }

  function getProvider() {
    const { firebase, url } = getConfig();
    if (firebase.length > 12) return "firebase";
    if (url.length > 8) return "rest";
    return "none";
  }

  function setConfig(room, url, firebase) {
    if (room != null) localStorage.setItem(ROOM_KEY, room.trim());
    if (url != null) localStorage.setItem(URL_KEY, url.trim().replace(/\/$/, ""));
    if (firebase != null) localStorage.setItem(FIREBASE_KEY, firebase.trim().replace(/\/$/, ""));
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
    const { room } = getConfig();
    return room.length >= 4 && getProvider() !== "none";
  }

  function mergeById(localArr, remoteArr) {
    const map = new Map();

    function ts(item) {
      return new Date(item.updatedAt || item.completedAt || item.createdAt || 0).getTime();
    }

    function pickNewer(prev, item) {
      const t = ts(item);
      const pt = ts(prev);
      if (t > pt) return item;
      if (t < pt) return prev;
      if (item.status === "done" && prev.status !== "done") return item;
      if (prev.status === "done" && item.status !== "done") return prev;
      return item;
    }

    const all = [...(localArr || []), ...(remoteArr || [])];
    for (const item of all) {
      if (!item?.id) continue;
      const prev = map.get(item.id);
      map.set(item.id, prev ? pickNewer(prev, item) : item);
    }
    return [...map.values()];
  }

  function mergeData(local, remote) {
    const homeProfile = window.CoupleHomeProfile?.mergeProfiles
      ? CoupleHomeProfile.mergeProfiles(local.homeProfile, remote.homeProfile)
      : remote.homeProfile || local.homeProfile;
    const siteContent = window.CoupleSiteContent?.mergeContent
      ? CoupleSiteContent.mergeContent(local.siteContent, remote.siteContent)
      : remote.siteContent || local.siteContent;
    if (siteContent?.hero && homeProfile) {
      siteContent.hero = CoupleHomeProfile.mergeProfiles(homeProfile, siteContent.hero);
    } else if (homeProfile && siteContent) {
      siteContent.hero = homeProfile;
    }
    return {
      dates: mergeById(local.dates, remote.dates),
      menuCustom: mergeById(local.menuCustom, remote.menuCustom),
      menuOrders: mergeById(local.menuOrders, remote.menuOrders),
      homeProfile: siteContent?.hero || homeProfile,
      siteContent,
    };
  }

  function payloadTimestamp(local) {
    const stamps = [
      local?.siteContent?.updatedAt,
      local?.homeProfile?.updatedAt,
      ...(local?.menuOrders || []).map((o) => o.updatedAt || o.completedAt || o.createdAt),
      ...(local?.dates || []).map((d) => d.updatedAt || d.createdAt),
      ...(local?.menuCustom || []).map((m) => m.updatedAt || m.createdAt),
    ]
      .filter(Boolean)
      .map((t) => new Date(t).getTime())
      .filter((t) => !Number.isNaN(t));
    if (stamps.length) return new Date(Math.max(...stamps)).toISOString();
    return new Date(0).toISOString();
  }

  function shouldApplyRemote(remote) {
    if (!remote?.updatedAt) return false;

    const meta = getMeta();
    const lastApplied = meta.lastAppliedRemote ? new Date(meta.lastAppliedRemote).getTime() : 0;
    const remoteAt = new Date(remote.updatedAt).getTime();

    if (remote.deviceId && remote.deviceId !== getDeviceId()) return true;
    if (remoteAt > lastApplied) return true;

    if (Array.isArray(remote.menuOrders) && remote.menuOrders.some((o) => o.status === "pending")) {
      return true;
    }

    const local = window.CoupleBackup?.readLocalData?.() || {};
    const localContent = local.siteContent || window.CoupleSiteContent?.load?.() || {};
    const remoteContentAt = remote.siteContent?.updatedAt
      ? new Date(remote.siteContent.updatedAt).getTime()
      : 0;
    const localContentAt = localContent.updatedAt ? new Date(localContent.updatedAt).getTime() : 0;
    if (remoteContentAt > localContentAt) return true;

    const localHero = local.homeProfile || window.CoupleHomeProfile?.load?.() || {};
    const remoteHeroAt = remote.homeProfile?.updatedAt
      ? new Date(remote.homeProfile.updatedAt).getTime()
      : 0;
    const localHeroAt = localHero.updatedAt ? new Date(localHero.updatedAt).getTime() : 0;
    if (remoteHeroAt > localHeroAt) return true;

    return false;
  }

  function buildPayload() {
    const local = window.CoupleBackup?.readLocalData?.() || {
      dates: [],
      menuCustom: [],
      menuOrders: [],
      homeProfile: null,
      siteContent: null,
    };
    const siteContent = local.siteContent || window.CoupleSiteContent?.load?.() || null;
    const hero = siteContent?.hero || local.homeProfile || window.CoupleHomeProfile?.load?.() || null;
    const payloadContent = siteContent ? { ...siteContent, hero } : hero ? { hero, updatedAt: hero.updatedAt || new Date().toISOString() } : null;
    const stamp = payloadTimestamp({
      siteContent: payloadContent,
      homeProfile: hero,
      menuOrders: local.menuOrders,
      dates: local.dates,
      menuCustom: local.menuCustom,
    });
    return {
      version: 1,
      updatedAt: stamp,
      deviceId: getDeviceId(),
      dates: local.dates || [],
      menuCustom: local.menuCustom || [],
      menuOrders: local.menuOrders || [],
      homeProfile: hero,
      siteContent: payloadContent,
    };
  }

  function applyRemote(remote) {
    if (!remote || !window.CoupleBackup?.writeLocalData) return false;
    const local = window.CoupleBackup.readLocalData();
    const merged = mergeData(local, remote);
    window.CoupleBackup.writeLocalData(merged);
    window.CoupleBackup.scheduleAutoBackup?.();
    window.dispatchEvent(new CustomEvent("couple-dates-updated"));
    window.dispatchEvent(new CustomEvent("couple-home-profile-updated"));
    window.dispatchEvent(new CustomEvent("couple-site-content-updated"));
    window.dispatchEvent(new CustomEvent("couple-cloud-synced"));
    return true;
  }

  function firebaseEndpoint(room) {
    const { firebase } = getConfig();
    return `${firebase}/couple/${encodeURIComponent(room)}.json`;
  }

  function restEndpoint(room, method) {
    const { url } = getConfig();
    return `${url}/${encodeURIComponent(room)}`;
  }

  async function fetchRemote() {
    const { room } = getConfig();
    const provider = getProvider();

    if (provider === "firebase") {
      const res = await fetch(firebaseEndpoint(room), { cache: "no-store" });
      if (!res.ok) throw new Error(`拉取失败 (${res.status})`);
      const remote = await res.json();
      return remote && typeof remote === "object" ? remote : null;
    }

    const res = await fetch(restEndpoint(room), { method: "GET", cache: "no-store" });
    if (!res.ok) throw new Error(`拉取失败 (${res.status})`);
    return await res.json();
  }

  async function uploadRemote(payload) {
    const { room } = getConfig();
    const provider = getProvider();

    if (provider === "firebase") {
      const res = await fetch(firebaseEndpoint(room), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`上传失败 (${res.status})`);
      return;
    }

    const res = await fetch(restEndpoint(room), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`上传失败 (${res.status})`);
  }

  async function pull() {
    if (!isEnabled() || pushing) return false;
    setMeta({ status: "pulling" });
    try {
      const remote = await fetchRemote();
      if (!remote?.updatedAt) {
        setMeta({ status: "idle", lastPull: new Date().toISOString(), lastError: null });
        return false;
      }

      if (shouldApplyRemote(remote)) {
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
    pushing = true;
    setMeta({ status: "pushing" });
    try {
      const local = window.CoupleBackup?.readLocalData?.() || {};
      let payload = buildPayload();

      try {
        const remote = await fetchRemote();
        if (remote?.updatedAt) {
          payload = {
            ...mergeData(local, remote),
            version: 1,
            updatedAt: new Date().toISOString(),
            deviceId: getDeviceId(),
          };
          const mergedLocal = {
            siteContent: payload.siteContent,
            homeProfile: payload.homeProfile,
            menuOrders: payload.menuOrders,
            dates: payload.dates,
            menuCustom: payload.menuCustom,
          };
          payload.updatedAt = payloadTimestamp(mergedLocal);
        }
      } catch {
        /* 远端暂无数据 */
      }

      await uploadRemote(payload);

      window.CoupleBackup?.writeLocalData?.({
        dates: payload.dates,
        menuCustom: payload.menuCustom,
        menuOrders: payload.menuOrders,
        homeProfile: payload.homeProfile,
        siteContent: payload.siteContent,
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
    getProvider,
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
