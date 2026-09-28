// ==UserScript==
// @name         Canvas File Bulk Downloader
// @namespace    local.canvas.file.downloader
// @version      3.1.0
// @homepageURL  https://github.com/amallar428/Userscripts
// @supportURL   https://github.com/amallar428/Userscripts/issues
// @updateURL    https://raw.githubusercontent.com/amallar428/Userscripts/main/Canvas/canvas-file-downloader.user.js
// @downloadURL  https://raw.githubusercontent.com/amallar428/Userscripts/main/Canvas/canvas-file-downloader.user.js
// @description  Browse, select, and bulk-download files from Canvas pages, modules, and the Files tab. Scan the current page for linked files, browse a module's file items, or grab a Files folder (optionally with subfolders); optionally limit to PDFs.
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

    .cfd-set-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #444; }
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

  let files = [];        // { name, url, kind, fileId?, relPath? }[]
  let isRunning = false;
  let modulesLoaded = false;

  const FILE_EXTENSIONS = [
    "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
    "csv", "txt", "zip", "png", "jpg", "jpeg", "gif", "svg"
  ];
  const EXT_PATTERN = new RegExp(`\\.(${FILE_EXTENSIONS.join("|")})(\\?|#|$)`, "i");

  const settings = {
    get pdfOnly() { return GM_getValue("pdfOnly", false); },
    set pdfOnly(v) { GM_setValue("pdfOnly", !!v); },
    get subfolders() { return GM_getValue("subfolders", true); },
    set subfolders(v) { GM_setValue("subfolders", !!v); }
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

        <div id="cfd-mode-row">
          <button type="button" class="cfd-small-btn" id="cfd-scan-page-btn">Scan current page</button>
          <button type="button" class="cfd-small-btn" id="cfd-scan-folder-btn" style="display:none">Scan this folder</button>
          <button type="button" class="cfd-small-btn" id="cfd-load-modules-btn">Browse modules</button>
        </div>

        <select id="cfd-module-select">
          <option value="">Loading modules…</option>
        </select>

        <div class="cfd-set-row">
          <input type="checkbox" id="cfd-pdf-only">
          <label for="cfd-pdf-only">PDFs only</label>
        </div>
        <div class="cfd-set-row" id="cfd-subfolders-row" style="display:none">
          <input type="checkbox" id="cfd-subfolders">
          <label for="cfd-subfolders">Include subfolders (keeps folder structure)</label>
        </div>
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

  // Pick the obvious mode for the page you're on.
  if (isModulesPage) {
    setTimeout(loadModules, 500);
  } else if (isFilesPage) {
    setTimeout(scanFilesFolder, 700);
  } else {
    setTimeout(scanCurrentPage, 700);
  }

  // The Files tab is a single-page app: clicking into a folder changes the URL
  // without reloading, so watch for that and rescan.
  if (isFilesPage) {
    let lastPath = location.pathname;
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
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
  async function collectFolder(folder, relDir, out, seengit Folders) {
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
      $("cfd-module-select").innerHTML =
        `<option value="">— choose a module —</option>` +
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
    files = [];
    resetProgress();
    syncSelectionUI();

    if (!moduleId) {
      $("cfd-panel-body").innerHTML = `<p class="cfd-hint">Select a module above to see its files.</p>`;
      return;
    }

    isRunning = true;
    $("cfd-panel-body").innerHTML = `<p class="cfd-hint">⏳ Loading files…</p>`;

    try {
      const items = await apiGetAll(`${origin}/api/v1/courses/${courseId}/modules/${moduleId}/items?include[]=content_details`);
      const fileItems = items.filter(item => item.type === "File" && item.content_id);

      if (!fileItems.length) {
        files = [];
        isRunning = false;
        $("cfd-panel-body").innerHTML = `<p class="cfd-hint">No file items found in this module.</p>`;
        return;
      }

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
      finishCollect("No downloadable files found in this module.");
    } catch (e) {
      isRunning = false;
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
    btn.textContent = n === 0 ? "⬇️ Download selected" : `⬇️ Download ${n} file${n !== 1 ? "s" : ""}`;
  }

  // ─────────────────────────────────────────────────────────────
  // Downloading
  // ─────────────────────────────────────────────────────────────

  async function downloadSelected() {
    if (isRunning) return;

    const selected = visibleFiles().filter(({ i }) => {
      const chk = $(`cfd-chk-${i}`);
      return chk && chk.checked;
    });
    if (!selected.length) return;

    isRunning = true;
    syncSelectionUI();
    $("cfd-progress-wrap").style.display = "block";
    $("cfd-progress-bar").style.width = "0%";

    let done = 0, saved = 0, failed = 0;

    for (const file of selected) {
      const st = $(`cfd-st-${file.i}`);
      if (st) st.textContent = "⬇️";
      setStatus(`Downloading ${done + 1} / ${selected.length}: ${file.name}`);

      try {
        await new Promise((resolve, reject) => {
          GM_download({
            url: file.url,
            name: file.relPath ? sanitizePath(file.relPath) : sanitizeFilename(file.name),
            saveAs: false,
            onload: resolve,
            onerror: e => reject(new Error((e && (e.error || e.details)) || "download error")),
            ontimeout: () => reject(new Error("Timed out"))
          });
        });
        saved++;
        if (st) st.textContent = "✅";
      } catch (e) {
        failed++;
        console.error("[Canvas downloader] Download failed:", file.name, e);
        if (st) { st.textContent = "❌"; st.title = e.message || String(e); }
      }

      done++;
      $("cfd-progress-bar").style.width = `${Math.round((done / selected.length) * 100)}%`;
      await sleep(600);
    }

    setStatus(`Done — ${saved} downloaded${failed ? `, ${failed} failed (hover ❌ for details)` : ""}.`);
    isRunning = false;
    syncSelectionUI();
  }

  function resetProgress() {
    setStatus("");
    $("cfd-progress-wrap").style.display = "none";
    $("cfd-progress-bar").style.width = "0%";
  }
})();