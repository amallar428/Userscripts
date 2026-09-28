// ==UserScript==
// @name         Canvas File Bulk Downloader
// @namespace    local.canvas.file.downloader
// @version      3.4.0
// @homepageURL  https://github.com/amallar428/Userscripts
// @supportURL   https://github.com/amallar428/Userscripts/issues
// @updateURL    https://raw.githubusercontent.com/amallar428/Userscripts/main/Canvas/canvas-file-downloader.user.js
// @downloadURL  https://raw.githubusercontent.com/amallar428/Userscripts/main/Canvas/canvas-file-downloader.user.js
// @description  Bulk-download files from Canvas pages, modules, and the Files tab straight into a folder you choose (no Save dialogs). Scan a page for linked files, browse a module or all modules (per-module subfolders or flat), or grab a Files folder with subfolders; tick what you want and let it rip. Optional PDFs-only filter.
// @author       local
// @match        https://*.instructure.com/courses/*
// @match        https://canvas.mit.edu/courses/*
// @match        https://*.edu/courses/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      *
// ==/UserScript==

(function () {
  "use strict";

  // The @match list is deliberately broad (any *.edu/courses/*), so bail out
  // unless this actually looks like a Canvas page.
  const looksLikeCanvas =
    location.hostname.endsWith(".instructure.com") ||
    document.body.classList.contains("ic-app") ||
    !!document.getElementById("application") ||
    !!document.querySelector('meta[name="csrf-token"]');
  if (!looksLikeCanvas) return;

  // Only run on pages where there is something to collect.
  const path = location.pathname;
  const isPagePage = /\/courses\/\d+\/pages\//.test(path);
  const isModuleItemPage = /\/courses\/\d+\/modules\/items\/\d+/.test(path);
  const isModulesPage = /\/courses\/\d+\/modules\/?$/.test(path);
  const isFilesPage = /\/courses\/\d+\/files(\/|$)/.test(path);
  if (!isPagePage && !isModuleItemPage && !isModulesPage && !isFilesPage) return;

  // ─────────────────────────────────────────────────────────────
  // Styles
  // ─────────────────────────────────────────────────────────────

  GM_addStyle(`
    #cfd-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 999999;
      background: #a31f34; color: #fff; border: none; border-radius: 8px;
      padding: 11px 18px; font-size: 14px; font-weight: 650; cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.28); user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #cfd-fab:hover { background: #86182a; }

    #cfd-panel {
      position: fixed; bottom: 76px; right: 28px; z-index: 999999;
      background: #fff; border: 1px solid #ddd; border-radius: 10px;
      width: 380px; max-height: 80vh; display: none; flex-direction: column;
      box-shadow: 0 8px 28px rgba(0,0,0,0.18);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px; overflow: hidden; color: #222;
    }
    #cfd-panel.open { display: flex; }
    #cfd-panel * { box-sizing: border-box; }

    #cfd-panel-header { padding: 13px 14px 10px; border-bottom: 1px solid #eee; flex-shrink: 0; }
    #cfd-panel-header h3 { margin: 0 0 8px; font-size: 14px; color: #222; }

    #cfd-mode-row { display: flex; gap: 8px; margin-bottom: 8px; }
    .cfd-small-btn {
      flex: 1; padding: 6px 8px; border: 1px solid #ccc; border-radius: 5px;
      background: #fafafa; cursor: pointer; font-size: 12px; color: #333;
    }
    .cfd-small-btn:hover { background: #f2f2f2; }
    .cfd-small-btn.active { background: #fff7f8; border-color: #a31f34; color: #a31f34; }

    #cfd-module-select {
      width: 100%; padding: 6px 7px; border: 1px solid #ccc; border-radius: 5px;
      font-size: 13px; color: #333; display: none; margin-bottom: 8px;
    }

    #cfd-settings {
      background: #fff7f8; border: 1px solid #f0dfe2; border-radius: 6px;
      padding: 8px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px;
    }
    .cfd-set-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #444; }
    .cfd-small-btn.cfd-inline { flex: 0 0 auto; }
    #cfd-dir-label { flex: 1; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #cfd-subfolder { flex: 1; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; }

    .cfd-set-row input[type=checkbox] { accent-color: #a31f34; cursor: pointer; margin: 0; }
    .cfd-set-row label { cursor: pointer; }

    #cfd-panel-body { flex: 1; overflow-y: auto; padding: 10px 14px; min-height: 72px; }

    #cfd-sel-bar {
      display: flex; align-items: center; gap: 8px; padding: 4px 2px 8px;
      border-bottom: 1px solid #eee; margin-bottom: 4px;
    }
    #cfd-sel-bar input { accent-color: #a31f34; cursor: pointer; }
    #cfd-sel-bar label { font-size: 12px; color: #555; cursor: pointer; flex: 1; }
    #cfd-sel-count { font-size: 12px; color: #a31f34; font-weight: 650; white-space: nowrap; }

    #cfd-file-list { list-style: none; margin: 0; padding: 0; }
    .cfd-file-row {
      display: flex; align-items: center; gap: 8px; padding: 6px 2px;
      border-bottom: 1px solid #f2f2f2; cursor: pointer;
    }
    .cfd-file-row:last-child { border-bottom: none; }
    .cfd-file-row:hover { background: #fff7f8; border-radius: 4px; }
    .cfd-file-row input[type=checkbox] {
      flex-shrink: 0; width: 15px; height: 15px; accent-color: #a31f34; cursor: pointer;
    }
    .cfd-file-row label {
      flex: 1; cursor: pointer; color: #333; font-size: 12px; line-height: 1.35; word-break: break-word;
    }
    .cfd-file-row .cfd-file-kind { color: #888; font-size: 11px; margin-left: 4px; }
    .cfd-file-row .cfd-st { flex-shrink: 0; font-size: 13px; width: 18px; text-align: center; }

    #cfd-panel-footer { padding: 10px 14px; border-top: 1px solid #eee; flex-shrink: 0; }
    #cfd-status-text { font-size: 12px; color: #666; min-height: 16px; margin-bottom: 7px; word-break: break-word; }
    #cfd-progress-wrap { background: #eee; border-radius: 4px; height: 6px; margin-bottom: 8px; overflow: hidden; display: none; }
    #cfd-progress-bar { height: 100%; width: 0%; background: #a31f34; border-radius: 4px; transition: width 0.25s; }

    #cfd-dl-btn {
      width: 100%; padding: 8px; background: #a31f34; color: #fff; border: none;
      border-radius: 6px; font-size: 13px; font-weight: 650; cursor: pointer;
    }
    #cfd-dl-btn:hover:not(:disabled) { background: #86182a; }
    #cfd-dl-btn:disabled { background: #bbb; cursor: not-allowed; }

    .cfd-hint { color: #999; font-size: 12px; text-align: center; padding: 20px 0; margin: 0; line-height: 1.4; }
  `);

  // ─────────────────────────────────────────────────────────────
  // State / constants
  // ─────────────────────────────────────────────────────────────

  const origin = location.origin;
  const courseMatch = path.match(/\/courses\/(\d+)/);
  const courseId = courseMatch ? courseMatch[1] : null;

  // "Folder mode" = File System Access API (Chrome / Edge / Opera): write into ANY
  // folder you pick, no Save dialogs. Otherwise (Firefox / Safari) fall back to
  // GM_download into a subfolder of your Downloads folder.
  const FS_SUPPORTED = typeof window.showDirectoryPicker === "function";

  let files = [];        // { name, url, kind, fileId?, relPath? }[]
  let isRunning = false;
  let modulesLoaded = false;
  let moduleList = [];   // { id, name }[] once loaded

  const FILE_EXTENSIONS = [
    "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
    "csv", "txt", "zip", "png", "jpg", "jpeg", "gif", "svg"
  ];
  const EXT_PATTERN = new RegExp(`\\.(${FILE_EXTENSIONS.join("|")})(\\?|#|$)`, "i");

  const settings = {
    get pdfOnly() { return GM_getValue("pdfOnly", false); },
    set pdfOnly(v) { GM_setValue("pdfOnly", !!v); },
    get subfolders() { return GM_getValue("subfolders", true); },
    set subfolders(v) { GM_setValue("subfolders", !!v); },
    get moduleSubfolders() { return GM_getValue("moduleSubfolders", true); },
    set moduleSubfolders(v) { GM_setValue("moduleSubfolders", !!v); },
    get downloadsSubfolder() { return GM_getValue("downloadsSubfolder", "Canvas"); },
    set downloadsSubfolder(v) { GM_setValue("downloadsSubfolder", String(v || "")); }
  };

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function sanitizeFilename(name) {
    return String(name || "canvas_file")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/, "")
      .slice(0, 180) || "canvas_file";
  }

  function sanitizePath(p) {
    return String(p).split("/").map(sanitizeFilename).join("/");
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function getExtension(nameOrUrl) {
    const clean = String(nameOrUrl || "").split("?")[0].split("#")[0];
    const m = clean.match(/\.([A-Za-z0-9]{2,5})$/);
    return m ? m[1].toLowerCase() : "";
  }

  function kindOf(name, contentType) {
    const ext = getExtension(name);
    if (ext) return ext.toUpperCase();
    if (contentType === "application/pdf") return "PDF";
    return "FILE";
  }

  function isPdf(file) {
    return file.kind === "PDF";
  }

  // Same-origin download URL. info.url from the API may redirect to a signed
  // external URL that can expire; this one stays on the Canvas host.
  function canvasDownloadUrl(fileId) {
    return `${origin}/files/${fileId}/download?download_frd=1`;
  }

  function forceDownloadUrl(url) {
    if (url.includes("/files/") && !url.includes("download=")) {
      return url + (url.includes("?") ? "&download=1" : "?download=1");
    }
    return url;
  }

  function setStatus(text) { $("cfd-status-text").textContent = text; }

  function gmFetchBlob(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET", url,
        responseType: "blob",
        withCredentials: true,
        timeout: 10 * 60 * 1000,
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
  // Remembering the chosen folder (IndexedDB can store a folder handle)
  // ─────────────────────────────────────────────────────────────

  function idb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("cfd-canvas-downloader", 1);
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
    const handle = await window.showDirectoryPicker({ id: "canvas-downloader", mode: "readwrite" });
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
    const label = $("cfd-dir-label");
    if (!label) return;
    if (!handle) { try { handle = await idbGet("dir"); } catch (_) {} }
    label.textContent = handle ? `📁 ${handle.name}` : "No folder chosen";
    label.title = handle ? handle.name : "";
  }

  // ─────────────────────────────────────────────────────────────
  // Saving a single file. Returns "saved" or "skipped"; throws on failure.
  // ─────────────────────────────────────────────────────────────

  async function saveFile(file, dirHandle) {
    const relPath = file.relPath ? sanitizePath(file.relPath) : sanitizeFilename(file.name);

    if (dirHandle) {
      const parts = relPath.split("/");
      const fileName = parts.pop();
      let dir = dirHandle;
      for (const seg of parts) dir = await dir.getDirectoryHandle(seg, { create: true });

      // Already there and non-empty → skip, so re-running is cheap.
      try {
        const existing = await (await dir.getFileHandle(fileName)).getFile();
        if (existing.size > 0) return "skipped";
      } catch (_) { /* doesn't exist yet */ }

      const blob = await gmFetchBlob(file.url);
      const fh = await dir.getFileHandle(fileName, { create: true });
      const writable = await fh.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    }

    // Fallback: GM_download into <Downloads>/<subfolder>/..., remembering
    // what's been fetched by Canvas file id so re-runs skip it.
    const doneKey = file.fileId ? `file:${file.fileId}` : null;
    const done = GM_getValue("downloadedIds", {});
    if (doneKey && done[doneKey]) return "skipped";

    const prefix = sanitizePath(settings.downloadsSubfolder.replace(/^[\\/]+|[\\/]+$/g, ""));
    const name = prefix ? `${prefix}/${relPath}` : relPath;

    await new Promise((resolve, reject) => {
      GM_download({
        url: file.url, name,
        saveAs: false,
        conflictAction: "overwrite",
        onload: resolve,
        onerror: e => reject(new Error((e && (e.error || e.details)) || "download error")),
        ontimeout: () => reject(new Error("Timed out"))
      });
    });

    if (doneKey) {
      const latest = GM_getValue("downloadedIds", {});
      latest[doneKey] = Date.now();
      GM_setValue("downloadedIds", latest);
    }
    return "saved";
  }

  // ─────────────────────────────────────────────────────────────
  // Canvas API
  // ─────────────────────────────────────────────────────────────

  function apiGetRaw(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET", url,
        headers: { Accept: "application/json" },
        withCredentials: true,
        onload: resolve,
        onerror: () => reject(new Error("Network error"))
      });
    });
  }

  async function apiGet(url) {
    const r = await apiGetRaw(url);
    if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
    try { return JSON.parse(r.responseText); }
    catch (_) { throw new Error("JSON parse error"); }
  }

  // Follows the Link: rel="next" header until every page is collected.
  async function apiGetAll(url) {
    let results = [];
    let next = url + (url.includes("?") ? "&" : "?") + "per_page=100";
    while (next) {
      const r = await apiGetRaw(next);
      if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
      results = results.concat(JSON.parse(r.responseText));
      const linkHeader = r.responseHeaders.match(/Link:([^\n]*)/i);
      const nextMatch = linkHeader && linkHeader[1].match(/<([^>]+)>;\s*rel="next"/);
      next = nextMatch ? nextMatch[1] : null;
    }
    return results;
  }

  async function fileFromId(fileId, fallbackName) {
    const info = await apiGet(`${origin}/api/v1/files/${fileId}`);
    const name = info.display_name || info.filename || fallbackName || `canvas_file_${fileId}`;
    return { name, url: canvasDownloadUrl(fileId), kind: kindOf(name, info["content-type"]), fileId: String(fileId) };
  }

  // ─────────────────────────────────────────────────────────────
  // DOM
  // ─────────────────────────────────────────────────────────────

  document.body.insertAdjacentHTML("beforeend", `
    <button id="cfd-fab">📥 Files</button>

    <div id="cfd-panel">
      <div id="cfd-panel-header">
        <h3>📥 Canvas File Downloader</h3>

        <div id="cfd-settings">
          ${FS_SUPPORTED ? `
            <div class="cfd-set-row">
              <span id="cfd-dir-label">No folder chosen</span>
              <button type="button" class="cfd-small-btn cfd-inline" id="cfd-pick-dir">Choose folder…</button>
            </div>
          ` : `
            <div class="cfd-set-row">
              <span>Downloads/</span>
              <input id="cfd-subfolder" type="text" placeholder="Canvas">
            </div>
          `}
          <div class="cfd-set-row">
            <input type="checkbox" id="cfd-pdf-only">
            <label for="cfd-pdf-only">PDFs only</label>
          </div>
          <div class="cfd-set-row" id="cfd-subfolders-row" style="display:none">
            <input type="checkbox" id="cfd-subfolders">
            <label for="cfd-subfolders">Include subfolders (keeps folder structure)</label>
          </div>
          <div class="cfd-set-row" id="cfd-module-subfolders-row" style="display:none">
            <input type="checkbox" id="cfd-module-subfolders">
            <label for="cfd-module-subfolders">One subfolder per module (untick for a flat download)</label>
          </div>
        </div>

        <div id="cfd-mode-row">
          <button type="button" class="cfd-small-btn" id="cfd-scan-page-btn">Scan current page</button>
          <button type="button" class="cfd-small-btn" id="cfd-scan-folder-btn" style="display:none">Scan this folder</button>
          <button type="button" class="cfd-small-btn" id="cfd-load-modules-btn">Browse modules</button>
        </div>

        <select id="cfd-module-select">
          <option value="">Loading modules…</option>
        </select>
      </div>

      <div id="cfd-panel-body">
        <p class="cfd-hint">Scan this page for linked files, grab a Files folder, or browse a module.</p>
      </div>

      <div id="cfd-panel-footer">
        <div id="cfd-status-text"></div>
        <div id="cfd-progress-wrap"><div id="cfd-progress-bar"></div></div>
        <button id="cfd-dl-btn" disabled>⬇️ Download selected</button>
      </div>
    </div>
  `);

  $("cfd-fab").addEventListener("click", () => $("cfd-panel").classList.toggle("open"));
  $("cfd-scan-page-btn").addEventListener("click", scanCurrentPage);
  $("cfd-scan-folder-btn").addEventListener("click", scanFilesFolder);
  $("cfd-load-modules-btn").addEventListener("click", loadModules);
  $("cfd-module-select").addEventListener("change", loadSelectedModuleFiles);
  $("cfd-dl-btn").addEventListener("click", downloadSelected);

  $("cfd-module-subfolders").checked = settings.moduleSubfolders;
  $("cfd-module-subfolders").addEventListener("change", e => {
    settings.moduleSubfolders = e.target.checked;
    if ($("cfd-module-select").value === "__all__") loadSelectedModuleFiles();
  });

  if (FS_SUPPORTED) {
    updateDirLabel();
    $("cfd-pick-dir").addEventListener("click", async () => {
      try { await pickDirectory(); } catch (e) {
        if (e.name !== "AbortError") setStatus(`❌ Couldn't choose folder: ${e.message}`);
      }
    });
  } else {
    $("cfd-subfolder").value = settings.downloadsSubfolder;
    $("cfd-subfolder").addEventListener("change", e => { settings.downloadsSubfolder = e.target.value.trim(); });
  }

  $("cfd-pdf-only").checked = settings.pdfOnly;
  $("cfd-pdf-only").addEventListener("change", e => {
    settings.pdfOnly = e.target.checked;
    if (files.length) renderChecklist(); // re-filter what's already collected
  });

  if (isFilesPage) {
    $("cfd-scan-page-btn").style.display = "none";
    $("cfd-scan-folder-btn").style.display = "";
    $("cfd-subfolders-row").style.display = "";
    $("cfd-subfolders").checked = settings.subfolders;
    $("cfd-subfolders").addEventListener("change", e => {
      settings.subfolders = e.target.checked;
      scanFilesFolder();
    });
  }

  // Pick the obvious mode for the page you're on (lists only; nothing is
  // downloaded until you say so).
  setTimeout(() => {
    if (isModulesPage) loadModules();
    else if (isFilesPage) scanFilesFolder();
    else scanCurrentPage();
  }, 700);

  // The Files tab is a single-page app: clicking into a folder changes the URL
  // without reloading, so watch for that and rescan.
  if (isFilesPage) {
    let lastPath = location.pathname;
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        files = [];
        if (!isRunning) scanFilesFolder();
      }
    }, 800);
  }

  function setMode(mode) {
    $("cfd-scan-page-btn").classList.toggle("active", mode === "page");
    $("cfd-scan-folder-btn").classList.toggle("active", mode === "folder");
    $("cfd-load-modules-btn").classList.toggle("active", mode === "modules");
    $("cfd-module-select").style.display = mode === "modules" ? "block" : "none";
  }

  // ─────────────────────────────────────────────────────────────
  // Page scanning mode
  // ─────────────────────────────────────────────────────────────

  function extractCanvasFileId(url) {
    try {
      const m = new URL(url).pathname.match(/\/files\/(\d+)/);
      return m ? m[1] : null;
    } catch (_) { return null; }
  }

  function extractModuleItemId(url) {
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\/courses\/\d+\/modules\/items\/(\d+)/);
      if (m) return m[1];
      return u.searchParams.get("module_item_id");
    } catch (_) { return null; }
  }

  function looksLikeFileLink(a) {
    const href = a.href || "";
    const text = (a.textContent || "").trim();
    if (a.closest("#cfd-panel")) return false;       // ignore our own UI
    if (/\/files\/\d+/.test(href)) return true;       // a Canvas file, not the Files tab or a folder
    if (extractModuleItemId(href)) return true;       // a module item; resolved via API below
    return EXT_PATTERN.test(href) || EXT_PATTERN.test(text);
  }

  function inferFilenameFromAnchor(a, index) {
    const text = (a.textContent || "").trim();
    if (text && text.length < 220) return sanitizeFilename(text);
    try {
      const last = decodeURIComponent(new URL(a.href).pathname.split("/").filter(Boolean).pop() || "");
      if (last) return sanitizeFilename(last);
    } catch (_) {}
    return `canvas_file_${String(index).padStart(2, "0")}`;
  }

  async function resolveLink(anchor, index) {
    const href = anchor.href;
    const fallbackName = inferFilenameFromAnchor(anchor, index);

    // Case 1: direct Canvas file link
    const fileId = extractCanvasFileId(href);
    if (fileId) return fileFromId(fileId, fallbackName);

    // Case 2: module item link → look up what it points at
    const moduleItemId = extractModuleItemId(href);
    if (moduleItemId && courseId) {
      const item = await apiGet(`${origin}/api/v1/courses/${courseId}/modules/items/${moduleItemId}`);
      if (item.type === "File" && item.content_id) return fileFromId(item.content_id, item.title || fallbackName);
      return null; // a page, assignment, link, etc.
    }

    // Case 3: ordinary external link that looks like a file
    return {
      name: fallbackName,
      url: forceDownloadUrl(href),
      kind: kindOf(fallbackName) !== "FILE" ? kindOf(fallbackName) : kindOf(href)
    };
  }

  async function scanCurrentPage() {
    if (isRunning) return;
    isRunning = true;
    setMode("page");
    resetProgress();

    const candidates = Array.from(document.querySelectorAll("a[href]")).filter(looksLikeFileLink);
    $("cfd-panel-body").innerHTML = `<p class="cfd-hint">⏳ Resolving ${candidates.length} possible file link(s)…</p>`;

    const seen = new Set();
    const collected = [];
    for (const a of candidates) {
      try {
        const resolved = await resolveLink(a, collected.length + 1);
        if (!resolved || !resolved.url) continue;
        const key = resolved.fileId ? `id:${resolved.fileId}` : `${resolved.name}::${resolved.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(resolved);
      } catch (e) {
        console.warn("[Canvas downloader] Could not resolve link:", a.href, e);
      }
    }

    files = collected;
    isRunning = false;
    finishCollect("No downloadable file links found on this page.");
  }

  // ─────────────────────────────────────────────────────────────
  // Files-tab folder mode
  // ─────────────────────────────────────────────────────────────

  // /courses/:id/files                      → course root folder
  // /courses/:id/files/folder/A/B%20C       → folder at path "A/B C"
  function currentFolderPath() {
    const m = location.pathname.match(/\/courses\/\d+\/files(?:\/folder\/(.*))?/);
    if (!m) return null;
    return (m[1] || "").split("/").filter(Boolean).map(seg => {
      try { return decodeURIComponent(seg); } catch (_) { return seg; }
    });
  }

  async function resolveFolder(segments) {
    const encoded = segments.map(encodeURIComponent).join("/");
    const chain = await apiGet(`${origin}/api/v1/courses/${courseId}/folders/by_path${encoded ? "/" + encoded : ""}`);
    if (!Array.isArray(chain) || !chain.length) throw new Error("Folder not found");
    return chain[chain.length - 1];
  }

  // Collects files in a folder, descending into subfolders when asked.
  // relDir is the path relative to the folder the user is looking at.
  async function collectFolder(folder, relDir, out, seenFolders) {
    if (seenFolders.has(folder.id)) return;
    seenFolders.add(folder.id);
    setStatus(`Reading ${relDir || folder.name || "folder"}…`);

    const items = await apiGetAll(`${origin}/api/v1/folders/${folder.id}/files`);
    for (const info of items) {
      const name = info.display_name || info.filename || `canvas_file_${info.id}`;
      out.push({
        name,
        relPath: relDir ? `${relDir}/${name}` : name,
        url: canvasDownloadUrl(info.id),
        kind: kindOf(name, info["content-type"]),
        fileId: String(info.id)
      });
    }

    if (!settings.subfolders) return;
    const subs = await apiGetAll(`${origin}/api/v1/folders/${folder.id}/folders`);
    for (const sub of subs) {
      await collectFolder(sub, relDir ? `${relDir}/${sub.name}` : sub.name, out, seenFolders);
    }
  }

  async function scanFilesFolder() {
    if (isRunning) return;
    const segments = currentFolderPath();
    if (segments == null || !courseId) {
      $("cfd-panel-body").innerHTML = `<p class="cfd-hint">Open a course's Files tab to use this.</p>`;
      return;
    }

    isRunning = true;
    setMode("folder");
    resetProgress();
    files = [];
    syncSelectionUI();
    $("cfd-panel-body").innerHTML = `<p class="cfd-hint">⏳ Reading folder…</p>`;

    try {
      const folder = await resolveFolder(segments);
      const collected = [];
      await collectFolder(folder, "", collected, new Set());
      files = collected;
      isRunning = false;
      finishCollect(settings.subfolders
        ? "This folder (and its subfolders) has no files."
        : "This folder has no files. Tick “Include subfolders” to look deeper.");
    } catch (e) {
      isRunning = false;
      $("cfd-panel-body").innerHTML = `<p class="cfd-hint">❌ ${escHtml(e.message)}</p>`;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Module browsing mode
  // ─────────────────────────────────────────────────────────────

  async function loadModules() {
    setMode("modules");
    resetProgress();

    if (!courseId) {
      $("cfd-module-select").innerHTML = `<option>Could not detect course ID</option>`;
      return;
    }
    if (modulesLoaded) {
      $("cfd-panel-body").innerHTML = `<p class="cfd-hint">Select a module above to see its files.</p>`;
      return;
    }

    $("cfd-panel-body").innerHTML = `<p class="cfd-hint">⏳ Loading modules…</p>`;
    try {
      const modules = await apiGetAll(`${origin}/api/v1/courses/${courseId}/modules`);
      moduleList = modules.map(m => ({ id: m.id, name: m.name }));
      $("cfd-module-select").innerHTML =
        `<option value="">— choose a module —</option>` +
        `<option value="__all__">All modules on this page (recursive)</option>` +
        modules.map(m =>
          `<option value="${escHtml(m.id)}">${escHtml(m.name)}${m.items_count ? ` (${m.items_count})` : ""}</option>`
        ).join("");
      modulesLoaded = true;
      $("cfd-panel-body").innerHTML = `<p class="cfd-hint">Select a module above to see its files.</p>`;
    } catch (e) {
      $("cfd-module-select").innerHTML = `<option>Error loading modules</option>`;
      $("cfd-panel-body").innerHTML = `<p class="cfd-hint">❌ Error loading modules: ${escHtml(e.message)}</p>`;
    }
  }

  async function loadSelectedModuleFiles() {
    if (isRunning) return;
    const moduleId = $("cfd-module-select").value;
    $("cfd-module-subfolders-row").style.display = moduleId === "__all__" ? "" : "none";
    files = [];
    resetProgress();
    syncSelectionUI();

    if (!moduleId) {
      $("cfd-panel-body").innerHTML = `<p class="cfd-hint">Select a module above to see its files.</p>`;
      return;
    }

    if (moduleId === "__all__") return scanAllModules();

    isRunning = true;
    $("cfd-panel-body").innerHTML = `<p class="cfd-hint">⏳ Loading files…</p>`;

    try {
      const items = await apiGetAll(`${origin}/api/v1/courses/${courseId}/modules/${moduleId}/items?include[]=content_details`);
      const fileItems = items.filter(item => item.type === "File" && item.content_id);

      const collected = [];
      for (let i = 0; i < fileItems.length; i++) {
        const item = fileItems[i];
        setStatus(`Checking ${i + 1} / ${fileItems.length}: ${item.title || item.content_id}`);
        try {
          collected.push(await fileFromId(item.content_id, item.title));
        } catch (e) {
          console.warn("[Canvas downloader] Skipping inaccessible file:", item.title, e);
        }
      }
      files = collected;
      isRunning = false;
      finishCollect("No file items found in this module.");
    } catch (e) {
      isRunning = false;
      $("cfd-panel-body").innerHTML = `<p class="cfd-hint">❌ ${escHtml(e.message)}</p>`;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // All modules on this page, recursively
  // ─────────────────────────────────────────────────────────────

  // Modules as rendered on /modules: <div class="context_module" id="context_module_123">
  // with items <li class="context_module_item ..." id="context_module_item_456">.
  // Reading the DOM means "what you see is what you get"; the API is only the
  // fallback if the page is somehow empty.
  function modulesOnPage() {
    const out = [];
    document.querySelectorAll('.context_module[id^="context_module_"]').forEach(el => {
      const id = el.id.replace("context_module_", "");
      if (!/^\d+$/.test(id)) return;
      const nameEl = el.querySelector(".ig-header-title .name, .ig-header-title, .name");
      const name = (el.getAttribute("aria-label") || (nameEl && nameEl.textContent) || `Module ${id}`).trim();
      const itemIds = Array.from(el.querySelectorAll('.context_module_item[id^="context_module_item_"]'))
        .map(li => li.id.replace("context_module_item_", ""))
        .filter(x => /^\d+$/.test(x));
      out.push({ id, name, itemIds });
    });
    return out;
  }

  // Files linked from inside a Canvas Page (wiki page) body.
  async function filesInPage(pageUrl) {
    const page = await apiGet(`${origin}/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`);
    const doc = new DOMParser().parseFromString(page.body || "", "text/html");
    const ids = new Set();
    doc.querySelectorAll("a[href], img[src]").forEach(el => {
      const id = extractCanvasFileId(el.getAttribute("href") || el.getAttribute("src") || "");
      if (id) ids.add(id);
    });
    return { title: page.title || pageUrl, fileIds: Array.from(ids) };
  }

  async function scanAllModules() {
    if (isRunning) return;
    isRunning = true;
    resetProgress();
    files = [];
    syncSelectionUI();
    $("cfd-panel-body").innerHTML = `<p class="cfd-hint">⏳ Walking every module on this page…</p>`;

    const collected = [];
    const seenIds = new Set();
    const usedNames = new Set();
    let itemErrors = 0;

    function add(f, dir) {
      const idKey = dir ? `${dir}/${f.fileId}` : f.fileId;
      if (seenIds.has(idKey)) return;
      seenIds.add(idKey);
      let rel = dir ? `${dir}/${f.name}` : f.name;
      if (!dir) {
        // Flat: different files sharing a name get (2), (3)…
        const ext = getExtension(f.name);
        const stem = ext ? f.name.slice(0, -(ext.length + 1)) : f.name;
        let n = 2;
        while (usedNames.has(rel.toLowerCase())) rel = ext ? `${stem} (${n++}).${ext}` : `${stem} (${n++})`;
        usedNames.add(rel.toLowerCase());
      }
      f.relPath = rel;
      collected.push(f);
    }

    try {
      let modules = modulesOnPage();
      if (!modules.length) {
        // Not on /modules (or the page hasn't rendered them): fall back to the API list.
        if (!moduleList.length) {
          const apiModules = await apiGetAll(`${origin}/api/v1/courses/${courseId}/modules`);
          moduleList = apiModules.map(m => ({ id: m.id, name: m.name }));
        }
        modules = moduleList.map(m => ({ id: String(m.id), name: m.name, itemIds: null }));
      }

      for (let mi = 0; mi < modules.length; mi++) {
        const mod = modules[mi];
        const dir = settings.moduleSubfolders ? sanitizeFilename(mod.name) : "";

        // Item ids from the DOM, or from the API when the DOM had none.
        let items;
        if (mod.itemIds && mod.itemIds.length) {
          items = mod.itemIds.map(id => ({ id }));
        } else {
          items = await apiGetAll(`${origin}/api/v1/courses/${courseId}/modules/${mod.id}/items`);
        }

        for (let ii = 0; ii < items.length; ii++) {
          setStatus(`Module ${mi + 1} / ${modules.length} “${mod.name}” — item ${ii + 1} / ${items.length}`);
          try {
            // A DOM-sourced item only has an id; fetch its details.
            const item = items[ii].type ? items[ii]
              : await apiGet(`${origin}/api/v1/courses/${courseId}/modules/items/${items[ii].id}`);

            if (item.type === "File" && item.content_id) {
              add(await fileFromId(item.content_id, item.title), dir);
            } else if (item.type === "Page" && item.page_url) {
              // Recurse one level: files linked from inside the page.
              const { title, fileIds } = await filesInPage(item.page_url);
              for (const fid of fileIds) {
                try { add(await fileFromId(fid, title), dir); }
                catch (e) { itemErrors++; console.warn("[Canvas downloader] file in page failed:", title, fid, e); }
              }
            }
            // Assignments, quizzes, external links etc. are skipped.
          } catch (e) {
            itemErrors++;
            console.warn("[Canvas downloader] module item failed:", mod.name, items[ii].id, e);
          }
        }
      }

      files = collected;
      isRunning = false;
      finishCollect("No files in any module on this page.");
      if (itemErrors) setStatus(`${$("cfd-status-text").textContent} ${itemErrors} item(s) couldn't be read (see console).`);
    } catch (e) {
      isRunning = false;
      console.error("[Canvas downloader] scanAllModules failed:", e);
      $("cfd-panel-body").innerHTML = `<p class="cfd-hint">❌ ${escHtml(e.message)}</p>`;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Checklist rendering
  // ─────────────────────────────────────────────────────────────

  function visibleFiles() {
    return files
      .map((f, i) => ({ ...f, i }))
      .filter(f => !settings.pdfOnly || isPdf(f));
  }

  function finishCollect(emptyMessage) {
    if (!files.length) {
      $("cfd-panel-body").innerHTML = `<p class="cfd-hint">${escHtml(emptyMessage)}</p>`;
      setStatus("");
      syncSelectionUI();
      return;
    }
    const pdfs = files.filter(isPdf).length;
    setStatus(`Found ${files.length} file(s)${pdfs !== files.length ? `, ${pdfs} PDF(s)` : ""}.`);
    renderChecklist();
  }

  function renderChecklist() {
    const list = visibleFiles();
    if (!list.length) {
      $("cfd-panel-body").innerHTML = `<p class="cfd-hint">${files.length} file(s) found, but none are PDFs. Untick “PDFs only” to see them.</p>`;
      syncSelectionUI();
      return;
    }

    $("cfd-panel-body").innerHTML = `
      <div id="cfd-sel-bar">
        <input type="checkbox" id="cfd-chk-all" checked>
        <label for="cfd-chk-all">Select all</label>
        <span id="cfd-sel-count">${list.length} / ${list.length}</span>
      </div>
      <ul id="cfd-file-list">
        ${list.map(f => `
          <li class="cfd-file-row">
            <input type="checkbox" id="cfd-chk-${f.i}" class="cfd-chk" checked>
            <label for="cfd-chk-${f.i}">
              ${escHtml(f.relPath || f.name)}
              <span class="cfd-file-kind">${escHtml(f.kind || "")}</span>
            </label>
            <span class="cfd-st" id="cfd-st-${f.i}"></span>
          </li>`).join("")}
      </ul>
    `;

    $("cfd-chk-all").addEventListener("change", e => {
      document.querySelectorAll(".cfd-chk").forEach(c => { c.checked = e.target.checked; });
      syncSelectionUI();
    });
    document.querySelectorAll(".cfd-chk").forEach(c => c.addEventListener("change", syncSelectionUI));
    document.querySelectorAll(".cfd-file-row").forEach(row => {
      row.addEventListener("click", e => {
        if (e.target.closest("input, label")) return;
        const chk = row.querySelector("input");
        chk.checked = !chk.checked;
        syncSelectionUI();
      });
    });

    syncSelectionUI();
  }

  function syncSelectionUI() {
    const all = Array.from(document.querySelectorAll(".cfd-chk"));
    const n = all.filter(c => c.checked).length;

    const chkAll = $("cfd-chk-all");
    if (chkAll) {
      chkAll.indeterminate = n > 0 && n < all.length;
      chkAll.checked = all.length > 0 && n === all.length;
    }
    const countEl = $("cfd-sel-count");
    if (countEl) countEl.textContent = `${n} / ${all.length}`;

    const btn = $("cfd-dl-btn");
    btn.disabled = n === 0 || isRunning;
    btn.textContent = n === 0 ? "⬇️ Download selected" : `⬇️ Download ${n} file${n !== 1 ? "s" : ""} to folder`;
  }

  // ─────────────────────────────────────────────────────────────
  // Downloading
  // ─────────────────────────────────────────────────────────────

  // Uses the remembered folder, or asks you to pick one the first time.
  async function acquireDir() {
    if (!FS_SUPPORTED) return { ok: true, dirHandle: null };
    try {
      const dirHandle = await getDirHandle(true);
      if (dirHandle) return { ok: true, dirHandle };
    } catch (e) {
      if (e.name !== "AbortError") setStatus(`❌ Folder access failed: ${e.message}`);
      return { ok: false };
    }
    $("cfd-panel").classList.add("open");
    setStatus("Folder permission was not granted.");
    return { ok: false };
  }

  async function downloadSelected() {
    if (isRunning) return;
    const selected = visibleFiles().filter(({ i }) => {
      const chk = $(`cfd-chk-${i}`);
      return chk && chk.checked;
    });
    if (!selected.length) return;

    const { ok, dirHandle } = await acquireDir();
    if (!ok) return;
    await runDownloads(selected, dirHandle);
  }

  async function runDownloads(list, dirHandle) {
    isRunning = true;
    syncSelectionUI();
    $("cfd-progress-wrap").style.display = "block";
    $("cfd-progress-bar").style.width = "0%";

    let done = 0, saved = 0, skipped = 0, failed = 0;

    for (const file of list) {
      const st = $(`cfd-st-${file.i}`);
      if (st) st.textContent = "⬇️";
      setStatus(`Downloading ${done + 1} / ${list.length}: ${file.relPath || file.name}`);

      try {
        const result = await saveFile(file, dirHandle);
        if (result === "skipped") { skipped++; if (st) { st.textContent = "⏭️"; st.title = "Already there"; } }
        else { saved++; if (st) st.textContent = "✅"; }
      } catch (e) {
        failed++;
        console.error("[Canvas downloader] Download failed:", file.name, e);
        if (st) { st.textContent = "❌"; st.title = e.message || String(e); }
      }

      done++;
      $("cfd-progress-bar").style.width = `${Math.round((done / list.length) * 100)}%`;
      await sleep(dirHandle ? 150 : 600);
    }

    setStatus(`Done — ${saved} saved, ${skipped} already there${failed ? `, ${failed} failed (hover ❌ for details)` : ""}.`);
    isRunning = false;
    syncSelectionUI();
  }

  function resetProgress() {
    setStatus("");
    $("cfd-progress-wrap").style.display = "none";
    $("cfd-progress-bar").style.width = "0%";
  }
})();