// ==UserScript==
// @name         Bulk Panopto Folder Downloader
// @namespace    local.panopto.folder.downloader
// @version      1.0.0
// @homepageURL  https://github.com/amallar428/Userscripts
// @supportURL   https://github.com/amallar428/Userscripts/issues
// @updateURL    https://raw.githubusercontent.com/amallar428/Userscripts/main/Panopto/panopto-folder-downloader.user.js
// @downloadURL  https://raw.githubusercontent.com/amallar428/Userscripts/main/Panopto/panopto-folder-downloader.user.js
// @description  Download every video (.mp4) and caption (.txt) in a Panopto folder into a folder you choose, hands-free.
// @author       local (delivery-info logic adapted from Panopto-Video-DL, MIT)
// @match        https://*.panopto.com/Panopto/Pages/Sessions/List.aspx*
// @match        https://*.panopto.eu/Panopto/Pages/Sessions/List.aspx*
// @match        https://*.panopto.com/Panopto/Pages/Viewer.aspx*
// @match        https://*.panopto.eu/Panopto/Pages/Viewer.aspx*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      panopto.com
// @connect      panopto.eu
// @connect      cloudfront.net
// @connect      akamaihd.net
// @connect      azureedge.net
// @connect      *
// ==/UserScript==

(function () {
  "use strict";

  // ─────────────────────────────────────────────────────────────
  // Styles
  // ─────────────────────────────────────────────────────────────

  GM_addStyle(`
    #ppd-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 999999;
      background: #2d6a4f; color: #fff; border: none; border-radius: 8px;
      padding: 11px 18px; font-size: 14px; font-weight: 650; cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.28); user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #ppd-fab:hover { background: #1b4332; }

    #ppd-panel {
      position: fixed; bottom: 76px; right: 28px; z-index: 999999;
      background: #fff; border: 1px solid #ddd; border-radius: 10px;
      width: 420px; max-height: 82vh; display: none; flex-direction: column;
      box-shadow: 0 8px 28px rgba(0,0,0,0.18);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px; overflow: hidden; color: #222;
    }
    #ppd-panel.open { display: flex; }
    #ppd-panel * { box-sizing: border-box; }

    #ppd-panel-header { padding: 13px 14px 10px; border-bottom: 1px solid #eee; flex-shrink: 0; }
    #ppd-panel-header h3 { margin: 0 0 8px; font-size: 14px; color: #222; }

    #ppd-settings {
      background: #f6faf7; border: 1px solid #e3ede6; border-radius: 6px;
      padding: 8px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px;
    }
    .ppd-set-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #444; }
    .ppd-set-row input[type=checkbox] { accent-color: #2d6a4f; cursor: pointer; margin: 0; }
    .ppd-set-row label { cursor: pointer; }
    #ppd-dir-label { flex: 1; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #ppd-subfolder { flex: 1; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; }

    .ppd-small-btn {
      flex: 1; padding: 6px 8px; border: 1px solid #ccc; border-radius: 5px;
      background: #fafafa; cursor: pointer; font-size: 12px; color: #333;
    }
    .ppd-small-btn:hover { background: #f2f2f2; }
    .ppd-small-btn.ppd-inline { flex: 0 0 auto; }

    #ppd-all-btn {
      width: 100%; padding: 8px; background: #2d6a4f; color: #fff; border: none;
      border-radius: 6px; font-size: 13px; font-weight: 650; cursor: pointer;
    }
    #ppd-all-btn:hover:not(:disabled) { background: #1b4332; }
    #ppd-all-btn:disabled { background: #bbb; cursor: not-allowed; }

    #ppd-mode-row { display: flex; gap: 8px; }

    #ppd-panel-body { flex: 1; overflow-y: auto; padding: 10px 14px; min-height: 72px; }

    #ppd-sel-bar {
      display: flex; align-items: center; gap: 8px; padding: 4px 2px 8px;
      border-bottom: 1px solid #eee; margin-bottom: 4px;
    }
    #ppd-sel-bar input { accent-color: #2d6a4f; cursor: pointer; }
    #ppd-sel-bar label { font-size: 12px; color: #555; cursor: pointer; flex: 1; }
    #ppd-sel-count { font-size: 12px; color: #2d6a4f; font-weight: 650; white-space: nowrap; }

    #ppd-file-list { list-style: none; margin: 0; padding: 0; }
    .ppd-file-row {
      display: flex; align-items: center; gap: 8px; padding: 6px 2px;
      border-bottom: 1px solid #f2f2f2; cursor: pointer;
    }
    .ppd-file-row:last-child { border-bottom: none; }
    .ppd-file-row:hover { background: #f3f9f5; border-radius: 4px; }
    .ppd-file-row input[type=checkbox] {
      flex-shrink: 0; width: 15px; height: 15px; accent-color: #2d6a4f; cursor: pointer;
    }
    .ppd-file-row label {
      flex: 1; cursor: pointer; color: #333; font-size: 12px; line-height: 1.35; word-break: break-word;
    }
    .ppd-file-row .ppd-file-kind { color: #888; font-size: 11px; margin-left: 4px; }
    .ppd-file-row .ppd-file-sub { display: block; color: #999; font-size: 11px; }
    .ppd-file-row .ppd-st { flex-shrink: 0; font-size: 13px; width: 18px; text-align: center; }

    #ppd-panel-footer { padding: 10px 14px; border-top: 1px solid #eee; flex-shrink: 0; }
    #ppd-status-text { font-size: 12px; color: #666; min-height: 16px; margin-bottom: 7px; word-break: break-word; }
    #ppd-progress-wrap { background: #eee; border-radius: 4px; height: 6px; margin-bottom: 8px; overflow: hidden; display: none; }
    #ppd-progress-bar { height: 100%; width: 0%; background: #2d6a4f; border-radius: 4px; transition: width 0.25s; }

    #ppd-dl-btn {
      width: 100%; padding: 8px; background: #fff; color: #2d6a4f; border: 1px solid #2d6a4f;
      border-radius: 6px; font-size: 13px; font-weight: 650; cursor: pointer;
    }
    #ppd-dl-btn:hover:not(:disabled) { background: #f3f9f5; }
    #ppd-dl-btn:disabled { color: #bbb; border-color: #ddd; cursor: not-allowed; }

    .ppd-hint { color: #999; font-size: 12px; text-align: center; padding: 20px 0; margin: 0; line-height: 1.4; }
  `);

  // ─────────────────────────────────────────────────────────────
  // State / constants
  // ─────────────────────────────────────────────────────────────

  const origin = location.origin;
  const isListPage = location.pathname.includes("/List.aspx");

  // "Folder mode" = File System Access API (Chrome / Edge / Opera): write into ANY folder you pick.
  // Otherwise (Firefox / Safari) fall back to GM_download into a subfolder of your Downloads folder.
  const FS_SUPPORTED = typeof window.showDirectoryPicker === "function";

  let files = [];      // { name, relPath, kind, sessionId, url?, text?, hls? }[]
  let isRunning = false;
  let lastFolderId = null;

  const settings = {
    get autoRun() { return GM_getValue("autoRun", false); },
    set autoRun(v) { GM_setValue("autoRun", !!v); },
    get captions() { return GM_getValue("captions", true); },
    set captions(v) { GM_setValue("captions", !!v); },
    get timestamps() { return GM_getValue("timestamps", false); },
    set timestamps(v) { GM_setValue("timestamps", !!v); },
    get numbering() { return GM_getValue("numbering", true); },
    set numbering(v) { GM_setValue("numbering", !!v); },
    get subfolder() { return GM_getValue("subfolder", "Panopto"); },
    set subfolder(v) { GM_setValue("subfolder", String(v || "")); }
  };

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function sanitizeFilename(name) {
    return String(name || "panopto_file")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/, "")
      .slice(0, 180) || "panopto_file";
  }

  function sanitizePath(path) {
    return String(path).split("/").map(sanitizeFilename).join("/");
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function getFolderId() {
    const hash = decodeURIComponent(location.hash || "");
    const m = hash.match(/folderID="?([0-9a-f-]{36})"?/i);
    if (m) return m[1];
    const q = new URLSearchParams(location.search).get("folderID");
    return q ? q.replace(/"/g, "") : null;
  }

  function getViewerSessionId() {
    const u = new URL(location.href);
    return u.searchParams.get("id") || u.searchParams.get("tid");
  }

  function isHls(url) {
    return /\.m3u8(\?|$)/.test(url) || /\.panobf\d+/.test(url);
  }

  function formatClock(val) {
    const pad = n => String(n).padStart(2, "0");
    return `${pad(Math.floor(val / 3600))}:${pad(Math.floor((val % 3600) / 60))}:${pad(Math.floor(val % 60))}`;
  }

  function captionsToTxt(entries) {
    return entries
      .filter(e => e && e.Caption)
      .map(e => settings.timestamps ? `[${formatClock(e.Time)}] ${e.Caption}` : e.Caption)
      .join("\n") + "\n";
  }

  // Same-origin JSON POST (Panopto endpoints accept the session cookie).
  async function postJson(path, body, form) {
    const response = await fetch(origin + path, {
      method: "POST",
      credentials: "include",
      headers: form
        ? { accept: "application/json, text/javascript, */*; q=0.01", "content-type": "application/x-www-form-urlencoded;charset=UTF-8" }
        : { accept: "application/json", "content-type": "application/json" },
      body: form ? body : JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function gmFetchBlob(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET", url,
        responseType: "blob",
        withCredentials: true,
        timeout: 30 * 60 * 1000,
        onload(r) {
          if (r.status >= 200 && r.status < 300 && r.response) resolve(r.response);
          else reject(new Error(`HTTP ${r.status}`));
        },
        onerror: () => reject(new Error("Network error")),
        ontimeout: () => reject(new Error("Timed out"))
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Panopto API
  // ─────────────────────────────────────────────────────────────

  // Lists every session in a folder via the same endpoint the folder page uses.
  async function listFolderSessions(folderId) {
    const sessions = [];
    let folderName = null;
    const pageSize = 100;

    for (let page = 0; page < 200; page++) {
      const data = await postJson("/Panopto/Services/Data.svc/GetSessions", {
        queryParameters: {
          query: null,
          sortColumn: 1,          // 1 = date
          sortAscending: true,    // oldest first, so lecture 1 comes first
          maxResults: pageSize,
          page,
          startDate: null,
          endDate: null,
          folderID: folderId,
          bookmarked: false,
          getFolderData: page === 0,
          isSharedWithMe: false,
          isSubscriptionsPage: false,
          includeArchived: true,
          includeArchivedStateCount: true,
          sessionListOnlyArchived: false,
          includePlaylists: false
        }
      });

      const d = data.d || data;
      if (page === 0) folderName = d.Folder?.Name || d.FolderData?.Name || d.FolderName || null;

      const results = d.Results || [];
      for (const r of results) {
        const id = r.DeliveryID || r.SessionID || r.Id;
        if (!id) continue;
        sessions.push({ id, name: r.SessionName || r.Name || id, duration: r.Duration });
      }

      const total = typeof d.TotalNumber === "number" ? d.TotalNumber : null;
      if (!results.length || (total != null && sessions.length >= total)) break;
    }

    return { sessions, folderName };
  }

  // Fallback if the API shape changed: scrape viewer links out of the page.
  function domFallbackSessions() {
    const seen = new Set();
    const out = [];
    document.querySelectorAll('a[href*="Viewer.aspx"][href*="id="]').forEach(a => {
      let id;
      try { id = new URL(a.getAttribute("href"), origin).searchParams.get("id"); } catch (_) { return; }
      if (!id || seen.has(id)) return;
      seen.add(id);
      const name = a.textContent.trim() || a.title || a.getAttribute("aria-label") || id;
      out.push({ id, name });
    });
    return out;
  }

  // Adapted from Panopto-Video-DL (MIT): resolve a session to its podcast mp4 + captions.
  async function getDeliveryInfo(sessionId) {
    const isTid = !isListPage && new URL(location.href).searchParams.has("tid") && !new URL(location.href).searchParams.has("id");
    const body = isTid
      ? `&tid=${sessionId}&isLiveNotes=false&refreshAuthCookie=true&isActiveBroadcast=false&isEditing=false&isKollectiveAgentInstalled=false&isEmbed=false&responseType=json`
      : `deliveryId=${sessionId}&isEmbed=true&responseType=json`;

    const data = await postJson("/Panopto/Pages/Viewer/DeliveryInfo.aspx", body, true);
    if (data.ErrorCode) throw new Error(data.ErrorMessage || `Panopto error ${data.ErrorCode}`);

    const streamUrl = data.Delivery?.PodcastStreams?.[0]?.StreamUrl
      || data.Delivery?.Streams?.find(s => s.StreamUrl && !isHls(s.StreamUrl))?.StreamUrl
      || data.Delivery?.Streams?.[0]?.StreamUrl;
    if (!streamUrl) throw new Error("Stream URL not ready yet");

    const captions = [];
    if (settings.captions) {
      for (const c of (data.Delivery?.AvailableCaptions || [])) {
        const lang = c.Language;
        const cbody = isTid
          ? `tid=${sessionId}&getCaptions=true&language=${lang}&responseType=json`
          : `deliveryId=${sessionId}&getCaptions=true&language=${lang}&responseType=json`;
        try {
          const entries = await postJson("/Panopto/Pages/Viewer/DeliveryInfo.aspx", cbody, true);
          if (Array.isArray(entries) && entries.length) captions.push({ lang, entries });
        } catch (e) {
          console.warn("[Panopto downloader] captions failed", sessionId, lang, e);
        }
      }
    }

    return { streamUrl, captions, title: data.Delivery?.SessionName };
  }

  // ─────────────────────────────────────────────────────────────
  // Remembering the chosen folder (IndexedDB can store a folder handle)
  // ─────────────────────────────────────────────────────────────

  function idb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("ppd-panopto-downloader", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGet(key) {
    const db = await idb();
    return new Promise((resolve, reject) => {
      const req = db.transaction("kv").objectStore("kv").get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    const db = await idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function pickDirectory() {
    const handle = await window.showDirectoryPicker({ id: "panopto-downloader", mode: "readwrite" });
    await idbSet("dir", handle);
    updateDirLabel(handle);
    return handle;
  }

  async function getDirHandle(interactive) {
    let handle = null;
    try { handle = await idbGet("dir"); } catch (_) {}

    if (!handle) return interactive ? pickDirectory() : null;

    let perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm === "granted") return handle;
    if (!interactive) return null;

    perm = await handle.requestPermission({ mode: "readwrite" });
    return perm === "granted" ? handle : null;
  }

  async function updateDirLabel(handle) {
    const label = $("ppd-dir-label");
    if (!label) return;
    if (!handle) {
      try { handle = await idbGet("dir"); } catch (_) {}
    }
    label.textContent = handle ? `📁 ${handle.name}` : "No folder chosen";
    label.title = handle ? handle.name : "";
  }

  // ─────────────────────────────────────────────────────────────
  // Saving a single file
  // ─────────────────────────────────────────────────────────────

  async function fileToBlob(file) {
    if (file.text != null) return new Blob([file.text], { type: "text/plain" });
    return gmFetchBlob(file.url);
  }

  // Returns "saved" or "skipped". Throws on failure.
  async function saveFile(file, dirHandle) {
    const relPath = sanitizePath(file.relPath || file.name);

    if (dirHandle) {
      const parts = relPath.split("/");
      const fileName = parts.pop();
      let dir = dirHandle;
      for (const seg of parts) dir = await dir.getDirectoryHandle(seg, { create: true });

      // Skip if a non-empty file with that name already exists (resume-friendly).
      try {
        const existing = await (await dir.getFileHandle(fileName)).getFile();
        if (existing.size > 0 && !file.overwrite) return "skipped";
      } catch (_) { /* doesn't exist yet */ }

      const blob = await fileToBlob(file);
      const fh = await dir.getFileHandle(fileName, { create: true });
      const writable = await fh.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    }

    // Fallback: GM_download into <Downloads>/<subfolder>/...
    const doneKey = file.sessionId ? `${file.sessionId}:${file.kind}` : null;
    const done = GM_getValue("downloadedIds", {});
    if (doneKey && done[doneKey] && !file.overwrite) return "skipped";

    const prefix = sanitizePath(settings.subfolder.replace(/^[\\/]+|[\\/]+$/g, ""));
    const name = prefix ? `${prefix}/${relPath}` : relPath;

    let url = file.url;
    let revoke = null;
    if (file.text != null) {
      url = URL.createObjectURL(new Blob([file.text], { type: "text/plain" }));
      revoke = url;
    }

    try {
      await new Promise((resolve, reject) => {
        GM_download({
          url, name,
          saveAs: false,
          conflictAction: "overwrite",
          onload: resolve,
          onerror: e => reject(new Error((e && (e.error || e.details)) || "download error")),
          ontimeout: () => reject(new Error("Timed out"))
        });
      });
    } finally {
      if (revoke) setTimeout(() => URL.revokeObjectURL(revoke), 10_000);
    }

    if (doneKey) {
      const latest = GM_getValue("downloadedIds", {});
      latest[doneKey] = Date.now();
      GM_setValue("downloadedIds", latest);
    }
    return "saved";
  }

  // ─────────────────────────────────────────────────────────────
  // DOM
  // ─────────────────────────────────────────────────────────────

  document.body.insertAdjacentHTML("beforeend", `
    <button id="ppd-fab">🎬 Panopto</button>

    <div id="ppd-panel">
      <div id="ppd-panel-header">
        <h3>🎬 Panopto Folder Downloader</h3>

        <div id="ppd-settings">
          ${FS_SUPPORTED ? `
            <div class="ppd-set-row">
              <span id="ppd-dir-label">No folder chosen</span>
              <button type="button" class="ppd-small-btn ppd-inline" id="ppd-pick-dir">Choose folder…</button>
            </div>
          ` : `
            <div class="ppd-set-row">
              <span>Downloads/</span>
              <input id="ppd-subfolder" type="text" placeholder="Panopto">
            </div>
          `}
          <div class="ppd-set-row">
            <input type="checkbox" id="ppd-auto">
            <label for="ppd-auto">Auto-download everything when I open a folder</label>
          </div>
          <div class="ppd-set-row">
            <input type="checkbox" id="ppd-captions">
            <label for="ppd-captions">Also save captions as .txt</label>
          </div>
          <div class="ppd-set-row">
            <input type="checkbox" id="ppd-timestamps">
            <label for="ppd-timestamps">Include [hh:mm:ss] timestamps in captions</label>
          </div>
          <div class="ppd-set-row">
            <input type="checkbox" id="ppd-numbering">
            <label for="ppd-numbering">Prefix files with 01, 02, … in date order</label>
          </div>
          <button type="button" id="ppd-all-btn">⚡ Download everything in this folder</button>
        </div>

        <div id="ppd-mode-row">
          <button type="button" class="ppd-small-btn" id="ppd-scan-btn">Scan folder (pick what to download)</button>
        </div>
      </div>

      <div id="ppd-panel-body">
        <p class="ppd-hint">Download the whole folder at once, or scan it and pick specific videos.</p>
      </div>

      <div id="ppd-panel-footer">
        <div id="ppd-status-text"></div>
        <div id="ppd-progress-wrap"><div id="ppd-progress-bar"></div></div>
        <button id="ppd-dl-btn" disabled>⬇️ Download selected</button>
      </div>
    </div>
  `);

  $("ppd-fab").addEventListener("click", () => $("ppd-panel").classList.toggle("open"));
  $("ppd-scan-btn").addEventListener("click", () => scanFolder());
  $("ppd-dl-btn").addEventListener("click", downloadSelected);
  $("ppd-all-btn").addEventListener("click", () => downloadAll(true));

  for (const [id, key] of [["ppd-auto", "autoRun"], ["ppd-captions", "captions"], ["ppd-timestamps", "timestamps"], ["ppd-numbering", "numbering"]]) {
    $(id).checked = settings[key];
    $(id).addEventListener("change", e => { settings[key] = e.target.checked; });
  }

  if (FS_SUPPORTED) {
    updateDirLabel();
    $("ppd-pick-dir").addEventListener("click", async () => {
      try { await pickDirectory(); } catch (e) {
        if (e.name !== "AbortError") setStatus(`❌ Couldn't choose folder: ${e.message}`);
      }
    });
  } else {
    $("ppd-subfolder").value = settings.subfolder;
    $("ppd-subfolder").addEventListener("change", e => { settings.subfolder = e.target.value.trim(); });
  }

  function setStatus(text) { $("ppd-status-text").textContent = text; }

  if (!isListPage) {
    $("ppd-all-btn").textContent = "⚡ Download this video";
    $("ppd-scan-btn").textContent = "Scan this video";
  }

  // Auto-run on folder open (and on in-page navigation between folders).
  function maybeAutoRun() {
    const fid = isListPage ? getFolderId() : getViewerSessionId();
    if (!fid || fid === lastFolderId) return;
    lastFolderId = fid;
    if (settings.autoRun) setTimeout(() => downloadAll(false), 1200);
  }
  maybeAutoRun();
  window.addEventListener("hashchange", () => { files = []; resetProgress(); maybeAutoRun(); });

  // ─────────────────────────────────────────────────────────────
  // Collecting files
  // ─────────────────────────────────────────────────────────────

  async function collectSessions() {
    if (!isListPage) {
      const id = getViewerSessionId();
      if (!id) throw new Error("Could not detect the video ID.");
      const title = document.title.replace(/\s*[-|–].*$/, "").trim();
      return { sessions: [{ id, name: title || id }], folderName: null };
    }

    const folderId = getFolderId();
    if (!folderId) throw new Error("Could not detect a folder ID in the URL — open a specific folder first.");

    try {
      const res = await listFolderSessions(folderId);
      if (res.sessions.length) return res;
    } catch (e) {
      console.warn("[Panopto downloader] Folder API failed, falling back to page scan:", e);
    }

    const sessions = domFallbackSessions();
    if (!sessions.length) throw new Error("No videos found (folder API and page scan both came up empty).");
    return { sessions, folderName: null };
  }

  async function collectAllFiles() {
    const { sessions, folderName } = await collectSessions();
    const folderTitle = sanitizeFilename(
      folderName
      || document.querySelector("#contentHeaderText, h1, [class*='folderName']")?.textContent.trim()
      || "Panopto"
    );

    const collected = [];
    const usedPaths = new Set();
    const hlsLinks = [];

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      setStatus(`Resolving ${i + 1} / ${sessions.length}: ${s.name}`);

      let info;
      try {
        info = await getDeliveryInfo(s.id);
      } catch (e) {
        console.warn("[Panopto downloader] Could not resolve", s.name, e);
        collected.push({ name: s.name, sessionId: s.id, kind: "ERROR", error: e.message, relPath: `${folderTitle}/${s.name}` });
        continue;
      }

      const prefix = settings.numbering && isListPage ? `${String(i + 1).padStart(2, "0")} ` : "";
      let base = sanitizeFilename(prefix + (s.name || info.title || s.id));
      let n = 2;
      while (usedPaths.has(`${folderTitle}/${base}`.toLowerCase())) base = sanitizeFilename(`${prefix}${s.name} (${n++})`);
      usedPaths.add(`${folderTitle}/${base}`.toLowerCase());

      if (isHls(info.streamUrl)) {
        hlsLinks.push(`${info.streamUrl}\t${base}`);
        collected.push({ name: base, sessionId: s.id, kind: "HLS", error: "HLS-only stream; link saved to panopto_hls_links.txt", relPath: `${folderTitle}/${base}.mp4` });
      } else {
        collected.push({ name: base, sessionId: s.id, kind: "MP4", url: info.streamUrl, relPath: `${folderTitle}/${base}.mp4`, sub: folderTitle });
      }

      for (const c of info.captions) {
        const suffix = info.captions.length > 1 ? `.${c.lang}` : "";
        collected.push({ name: `${base}${suffix}`, sessionId: s.id, kind: "TXT", text: captionsToTxt(c.entries), relPath: `${folderTitle}/${base}${suffix}.txt`, sub: folderTitle });
      }
    }

    if (hlsLinks.length) {
      collected.push({
        name: "panopto_hls_links", kind: "TXT", overwrite: true,
        text: hlsLinks.map(l => l.split("\t")[0]).join("\n") + "\n",
        relPath: `${folderTitle}/panopto_hls_links.txt`, sub: folderTitle
      });
    }

    return collected;
  }

  // ─────────────────────────────────────────────────────────────
  // Download ALL
  // ─────────────────────────────────────────────────────────────

  async function downloadAll(fromClick) {
    if (isRunning) return;

    let dirHandle = null;
    if (FS_SUPPORTED) {
      try {
        dirHandle = await getDirHandle(fromClick);
      } catch (e) {
        if (e.name !== "AbortError") setStatus(`❌ Folder access failed: ${e.message}`);
        return;
      }
      if (!dirHandle) {
        $("ppd-panel").classList.add("open");
        $("ppd-fab").textContent = "🎬 Click “Download everything” to resume";
        setStatus(fromClick
          ? "Folder permission was not granted."
          : "Chrome needs one click to re-allow access to your folder. Choose “Allow on every visit” to skip this next time.");
        return;
      }
    }

    isRunning = true;
    $("ppd-all-btn").disabled = true;
    resetProgress();
    $("ppd-panel").classList.add("open");
    $("ppd-panel-body").innerHTML = `<p class="ppd-hint">⏳ Collecting videos and captions…</p>`;

    try {
      files = await collectAllFiles();
    } catch (e) {
      $("ppd-panel-body").innerHTML = `<p class="ppd-hint">❌ ${escHtml(e.message)}</p>`;
      isRunning = false;
      $("ppd-all-btn").disabled = false;
      return;
    }

    if (!files.length) {
      $("ppd-panel-body").innerHTML = `<p class="ppd-hint">Nothing downloadable found here.</p>`;
      setStatus("");
      isRunning = false;
      $("ppd-all-btn").disabled = false;
      return;
    }

    renderChecklist({ showSub: true });
    isRunning = false; // runDownloads sets it again
    await runDownloads(files.map((f, i) => ({ ...f, i })), dirHandle);
    $("ppd-all-btn").disabled = false;
    $("ppd-fab").textContent = "🎬 Panopto";
  }

  // ─────────────────────────────────────────────────────────────
  // Scan (pick-and-choose) mode
  // ─────────────────────────────────────────────────────────────

  async function scanFolder() {
    if (isRunning) return;
    resetProgress();
    isRunning = true;
    $("ppd-panel-body").innerHTML = `<p class="ppd-hint">⏳ Collecting videos and captions…</p>`;

    try {
      files = await collectAllFiles();
    } catch (e) {
      $("ppd-panel-body").innerHTML = `<p class="ppd-hint">❌ ${escHtml(e.message)}</p>`;
      isRunning = false;
      return;
    }
    isRunning = false;

    if (!files.length) {
      $("ppd-panel-body").innerHTML = `<p class="ppd-hint">Nothing downloadable found here.</p>`;
      syncSelectionUI();
      return;
    }

    setStatus(`Found ${files.filter(f => f.kind === "MP4").length} video(s), ${files.filter(f => f.kind === "TXT").length} caption file(s).`);
    renderChecklist({ showSub: true });
  }

  // ─────────────────────────────────────────────────────────────
  // Checklist rendering
  // ─────────────────────────────────────────────────────────────

  function renderChecklist({ showSub = false } = {}) {
    $("ppd-panel-body").innerHTML = `
      <div id="ppd-sel-bar">
        <input type="checkbox" id="ppd-chk-all" checked>
        <label for="ppd-chk-all">Select all</label>
        <span id="ppd-sel-count">${files.length} / ${files.length}</span>
      </div>
      <ul id="ppd-file-list">
        ${files.map((f, i) => {
          const disabled = f.kind === "ERROR" || f.kind === "HLS";
          return `
          <li class="ppd-file-row">
            <input type="checkbox" id="ppd-chk-${i}" class="ppd-chk" ${disabled ? "disabled" : "checked"}>
            <label for="ppd-chk-${i}">
              ${escHtml(f.name)}
              <span class="ppd-file-kind">${escHtml(f.kind || "")}</span>
              ${showSub && f.sub ? `<span class="ppd-file-sub">${escHtml(f.sub)}</span>` : ""}
              ${f.error ? `<span class="ppd-file-sub" style="color:#c0392b">${escHtml(f.error)}</span>` : ""}
            </label>
            <span class="ppd-st" id="ppd-st-${i}">${disabled ? "⚠️" : ""}</span>
          </li>`;
        }).join("")}
      </ul>
    `;

    $("ppd-chk-all").addEventListener("change", e => {
      document.querySelectorAll(".ppd-chk:not(:disabled)").forEach(c => { c.checked = e.target.checked; });
      syncSelectionUI();
    });
    document.querySelectorAll(".ppd-chk").forEach(c => c.addEventListener("change", syncSelectionUI));
    document.querySelectorAll(".ppd-file-row").forEach(row => {
      row.addEventListener("click", e => {
        if (e.target.closest("input, label")) return;
        const chk = row.querySelector("input");
        if (chk.disabled) return;
        chk.checked = !chk.checked;
        syncSelectionUI();
      });
    });

    syncSelectionUI();
  }

  function syncSelectionUI() {
    const all = Array.from(document.querySelectorAll(".ppd-chk:not(:disabled)"));
    const n = all.filter(c => c.checked).length;

    const chkAll = $("ppd-chk-all");
    if (chkAll) {
      chkAll.indeterminate = n > 0 && n < all.length;
      chkAll.checked = all.length > 0 && n === all.length;
    }
    const countEl = $("ppd-sel-count");
    if (countEl) countEl.textContent = `${n} / ${all.length}`;

    const btn = $("ppd-dl-btn");
    btn.disabled = n === 0 || isRunning;
    btn.textContent = n === 0 ? "⬇️ Download selected" : `⬇️ Download ${n} file${n !== 1 ? "s" : ""}`;
  }

  // ─────────────────────────────────────────────────────────────
  // Downloading
  // ─────────────────────────────────────────────────────────────

  async function downloadSelected() {
    if (isRunning) return;

    const selected = files
      .map((f, i) => ({ ...f, i }))
      .filter(({ i }) => { const chk = $(`ppd-chk-${i}`); return chk && chk.checked && !chk.disabled; });
    if (!selected.length) return;

    let dirHandle = null;
    if (FS_SUPPORTED) {
      try {
        dirHandle = await getDirHandle(true);
      } catch (e) {
        if (e.name !== "AbortError") setStatus(`❌ Folder access failed: ${e.message}`);
        return;
      }
      if (!dirHandle) { setStatus("Folder permission was not granted."); return; }
    }

    await runDownloads(selected, dirHandle);
  }

  async function runDownloads(list, dirHandle) {
    isRunning = true;
    syncSelectionUI();
    $("ppd-progress-wrap").style.display = "block";
    $("ppd-progress-bar").style.width = "0%";

    let done = 0, saved = 0, skipped = 0, failed = 0;

    for (const file of list) {
      const st = $(`ppd-st-${file.i}`);
      if (file.kind === "ERROR" || file.kind === "HLS") { done++; continue; }

      if (st) st.textContent = "⬇️";
      setStatus(`Downloading ${done + 1} / ${list.length}: ${file.name}.${file.kind.toLowerCase()}`);

      try {
        const result = await saveFile(file, dirHandle);
        if (result === "skipped") { skipped++; if (st) { st.textContent = "⏭️"; st.title = "Already there"; } }
        else { saved++; if (st) st.textContent = "✅"; }
      } catch (e) {
        failed++;
        console.error("[Panopto downloader] Download failed:", file.name, e);
        if (st) { st.textContent = "❌"; st.title = e.message || String(e); }
      }

      done++;
      $("ppd-progress-bar").style.width = `${Math.round((done / list.length) * 100)}%`;
      await sleep(dirHandle ? 150 : 500);
    }

    const hls = list.filter(f => f.kind === "HLS").length;
    setStatus(`Done — ${saved} saved, ${skipped} already there${failed ? `, ${failed} failed (see ❌)` : ""}${hls ? `, ${hls} HLS-only (links in panopto_hls_links.txt)` : ""}.`);
    isRunning = false;
    syncSelectionUI();
  }

  function resetProgress() {
    setStatus("");
    $("ppd-progress-wrap").style.display = "none";
    $("ppd-progress-bar").style.width = "0%";
  }
})();