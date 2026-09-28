// ==UserScript==
// @name         Canvas Module PDF Bulk Downloader
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Browse, select, and download PDFs from any Canvas module
// @author       You
// @match        https://*.instructure.com/courses/*/modules*
// @match        https://*.canvas.com/courses/*/modules*
// @match        https://*.edu/courses/*/modules*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  // ── Styles ─────────────────────────────────────────────────────────────────
  GM_addStyle(`
    #cm-fab {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 99999;
      background: #E66000;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 11px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.28);
      transition: background 0.2s;
      user-select: none;
    }
    #cm-fab:hover { background: #c45500; }

    #cm-panel {
      position: fixed;
      bottom: 76px;
      right: 28px;
      z-index: 99999;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 10px;
      width: 340px;
      max-height: 80vh;
      display: none;
      flex-direction: column;
      box-shadow: 0 8px 28px rgba(0,0,0,0.18);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      overflow: hidden;
    }
    #cm-panel.open { display: flex; }

    #cm-panel-header {
      padding: 13px 14px 10px;
      border-bottom: 1px solid #eee;
      flex-shrink: 0;
    }
    #cm-panel-header h3 {
      margin: 0 0 8px;
      font-size: 14px;
      color: #222;
    }
    #cm-module-select {
      width: 100%;
      padding: 5px 7px;
      border: 1px solid #ccc;
      border-radius: 5px;
      font-size: 13px;
      color: #333;
    }

    #cm-panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 10px 14px;
      min-height: 60px;
    }

    /* ── File checklist ── */
    #cm-sel-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 2px 8px;
      border-bottom: 1px solid #eee;
      margin-bottom: 4px;
    }
    #cm-sel-bar input { accent-color: #E66000; cursor: pointer; }
    #cm-sel-bar label { font-size: 12px; color: #555; cursor: pointer; flex: 1; }
    #cm-sel-count { font-size: 12px; color: #E66000; font-weight: 600; white-space: nowrap; }

    #cm-file-list { list-style: none; margin: 0; padding: 0; }

    .cm-file-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 2px;
      border-bottom: 1px solid #f2f2f2;
      cursor: pointer;
    }
    .cm-file-row:last-child { border-bottom: none; }
    .cm-file-row:hover { background: #fdf6f0; border-radius: 4px; }
    .cm-file-row input[type=checkbox] {
      flex-shrink: 0;
      width: 15px;
      height: 15px;
      accent-color: #E66000;
      cursor: pointer;
    }
    .cm-file-row label {
      flex: 1;
      cursor: pointer;
      color: #333;
      font-size: 12px;
      line-height: 1.35;
      word-break: break-word;
    }
    .cm-file-row .cm-st {
      flex-shrink: 0;
      font-size: 13px;
      width: 16px;
      text-align: center;
    }

    /* ── Footer ── */
    #cm-panel-footer {
      padding: 10px 14px;
      border-top: 1px solid #eee;
      flex-shrink: 0;
    }
    #cm-status-text {
      font-size: 12px;
      color: #666;
      min-height: 16px;
      margin-bottom: 7px;
    }
    #cm-progress-wrap {
      background: #eee;
      border-radius: 4px;
      height: 6px;
      margin-bottom: 8px;
      overflow: hidden;
      display: none;
    }
    #cm-progress-bar {
      height: 100%;
      width: 0%;
      background: #E66000;
      border-radius: 4px;
      transition: width 0.3s;
    }
    #cm-dl-btn {
      width: 100%;
      padding: 8px;
      background: #E66000;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    #cm-dl-btn:hover:not(:disabled) { background: #c45500; }
    #cm-dl-btn:disabled { background: #bbb; cursor: not-allowed; }

    .cm-hint { color: #999; font-size: 12px; text-align: center; padding: 20px 0; margin: 0; }
  `);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const origin    = location.origin;
  const courseMatch = location.pathname.match(/\/courses\/(\d+)/);
  const courseId  = courseMatch ? courseMatch[1] : null;

  function apiGet(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url,
        headers: { Accept: 'application/json' },
        withCredentials: true,
        onload(r) {
          if (r.status >= 200 && r.status < 300) {
            try { resolve(JSON.parse(r.responseText)); }
            catch (e) { reject(new Error('JSON parse error')); }
          } else { reject(new Error(`HTTP ${r.status}`)); }
        },
        onerror: reject
      });
    });
  }

  async function apiGetAll(url) {
    let results = [];
    let next = url + (url.includes('?') ? '&' : '?') + 'per_page=100';
    while (next) {
      const r = await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET', url: next,
          headers: { Accept: 'application/json' },
          withCredentials: true,
          onload: resolve, onerror: reject
        });
      });
      results = results.concat(JSON.parse(r.responseText));
      const linkHeader = r.responseHeaders.match(/Link:([^\n]*)/i);
      const nextMatch  = linkHeader && linkHeader[1].match(/<([^>]+)>;\s*rel="next"/);
      next = nextMatch ? nextMatch[1] : null;
    }
    return results;
  }

  const sanitize = s => s.replace(/[/\\:*?"<>|]/g, '_').trim();
  const sleep    = ms => new Promise(r => setTimeout(r, ms));
  const $        = id => document.getElementById(id);

  // ── Build DOM ────────────────────────────────────────────────────────────
  document.body.insertAdjacentHTML('beforeend', `
    <button id="cm-fab">📥 PDFs</button>

    <div id="cm-panel">
      <div id="cm-panel-header">
        <h3>📥 Canvas PDF Downloader</h3>
        <select id="cm-module-select">
          <option value="">Loading modules…</option>
        </select>
      </div>
      <div id="cm-panel-body">
        <p class="cm-hint">Select a module above to see its PDFs.</p>
      </div>
      <div id="cm-panel-footer">
        <div id="cm-status-text"></div>
        <div id="cm-progress-wrap"><div id="cm-progress-bar"></div></div>
        <button id="cm-dl-btn" disabled>⬇️ Download selected</button>
      </div>
    </div>
  `);

  // ── State ─────────────────────────────────────────────────────────────────
  let pdfFiles  = [];   // { name, url }[] — PDFs found in the current module
  let isRunning = false;

  // ── Toggle panel ─────────────────────────────────────────────────────────
  $('cm-fab').addEventListener('click', () => $('cm-panel').classList.toggle('open'));

  // ── Load module list ──────────────────────────────────────────────────────
  (async () => {
    if (!courseId) {
      $('cm-module-select').innerHTML = '<option>Could not detect course ID</option>';
      return;
    }
    try {
      const modules = await apiGetAll(`${origin}/api/v1/courses/${courseId}/modules`);
      $('cm-module-select').innerHTML =
        '<option value="">— choose a module —</option>' +
        modules.map(m =>
          `<option value="${m.id}">${m.name}${m.items_count ? ` (${m.items_count})` : ''}</option>`
        ).join('');
    } catch (e) {
      $('cm-module-select').innerHTML = `<option>Error loading modules: ${e.message}</option>`;
    }
  })();

  // ── Module selection → fetch & show PDF checklist ─────────────────────────
  $('cm-module-select').addEventListener('change', async () => {
    const moduleId = $('cm-module-select').value;
    pdfFiles = [];
    resetProgress();
    $('cm-dl-btn').disabled = true;
    $('cm-dl-btn').textContent = '⬇️ Download selected';

    if (!moduleId) {
      $('cm-panel-body').innerHTML = '<p class="cm-hint">Select a module above to see its PDFs.</p>';
      return;
    }

    $('cm-panel-body').innerHTML = '<p class="cm-hint">⏳ Loading files…</p>';
    $('cm-status-text').textContent = '';

    try {
      const items = await apiGetAll(
        `${origin}/api/v1/courses/${courseId}/modules/${moduleId}/items?include[]=content_details`
      );
      const fileItems = items.filter(i => i.type === 'File');

      if (!fileItems.length) {
        $('cm-panel-body').innerHTML = '<p class="cm-hint">No file items found in this module.</p>';
        return;
      }

      $('cm-status-text').textContent = `Checking ${fileItems.length} file(s)…`;

      for (const item of fileItems) {
        try {
          const info = await apiGet(`${origin}/api/v1/files/${item.content_id}`);
          const isPdf = info['content-type'] === 'application/pdf' ||
            (info.filename || '').toLowerCase().endsWith('.pdf');
          if (isPdf) pdfFiles.push({ name: info.display_name || info.filename, url: info.url });
        } catch (_) { /* inaccessible — skip silently */ }
      }

      $('cm-status-text').textContent = '';

      if (!pdfFiles.length) {
        $('cm-panel-body').innerHTML = '<p class="cm-hint">No PDFs found in this module.</p>';
        return;
      }

      renderChecklist();

    } catch (e) {
      $('cm-panel-body').innerHTML = `<p class="cm-hint">❌ ${e.message}</p>`;
    }
  });

  // ── Render checklist ──────────────────────────────────────────────────────
  function renderChecklist() {
    $('cm-panel-body').innerHTML = `
      <div id="cm-sel-bar">
        <input type="checkbox" id="cm-chk-all" checked>
        <label for="cm-chk-all">Select all</label>
        <span id="cm-sel-count">${pdfFiles.length} / ${pdfFiles.length}</span>
      </div>
      <ul id="cm-file-list">
        ${pdfFiles.map((f, i) => `
          <li class="cm-file-row">
            <input type="checkbox" id="cm-chk-${i}" class="cm-chk" checked>
            <label for="cm-chk-${i}">${escHtml(f.name)}</label>
            <span class="cm-st" id="cm-st-${i}"></span>
          </li>
        `).join('')}
      </ul>
    `;

    syncSelectionUI();

    // Select-all checkbox
    $('cm-chk-all').addEventListener('change', e => {
      document.querySelectorAll('.cm-chk').forEach(c => { c.checked = e.target.checked; });
      syncSelectionUI();
    });

    // Individual checkboxes
    document.querySelectorAll('.cm-chk').forEach(c =>
      c.addEventListener('change', syncSelectionUI)
    );

    // Click anywhere on the row (outside label/checkbox) also toggles
    document.querySelectorAll('.cm-file-row').forEach(row =>
      row.addEventListener('click', e => {
        if (e.target.closest('input, label')) return;
        const chk = row.querySelector('input');
        chk.checked = !chk.checked;
        syncSelectionUI();
      })
    );
  }

  function syncSelectionUI() {
    const all     = document.querySelectorAll('.cm-chk');
    const checked = document.querySelectorAll('.cm-chk:checked');
    const n = checked.length;

    const chkAll = $('cm-chk-all');
    if (chkAll) {
      chkAll.indeterminate = n > 0 && n < all.length;
      chkAll.checked       = n === all.length;
    }

    const countEl = $('cm-sel-count');
    if (countEl) countEl.textContent = `${n} / ${all.length}`;

    const btn = $('cm-dl-btn');
    btn.disabled    = n === 0 || isRunning;
    btn.textContent = n === 0
      ? '⬇️ Download selected'
      : `⬇️ Download ${n} PDF${n !== 1 ? 's' : ''}`;
  }

  // ── Download selected ─────────────────────────────────────────────────────
  $('cm-dl-btn').addEventListener('click', async () => {
    if (isRunning) return;

    const selected = pdfFiles
      .map((f, i) => ({ ...f, i }))
      .filter(({ i }) => {
        const chk = $(`cm-chk-${i}`);
        return chk && chk.checked;
      });

    if (!selected.length) return;

    isRunning = true;
    $('cm-dl-btn').disabled = true;
    $('cm-progress-wrap').style.display = 'block';
    $('cm-progress-bar').style.width = '0%';

    let done = 0;
    for (const file of selected) {
      const st = $(`cm-st-${file.i}`);
      if (st) st.textContent = '⬇️';
      $('cm-status-text').textContent =
        `Downloading ${done + 1} / ${selected.length}: ${file.name}`;

      try {
        await new Promise((resolve, reject) => {
          GM_download({
            url: file.url,
            name: sanitize(file.name),
            saveAs: false,
            onload: resolve,
            onerror: reject,
            ontimeout: reject
          });
        });
        if (st) st.textContent = '✅';
      } catch (_) {
        if (st) st.textContent = '❌';
      }

      done++;
      $('cm-progress-bar').style.width = `${Math.round((done / selected.length) * 100)}%`;
      await sleep(600);
    }

    $('cm-status-text').textContent =
      `✅ Done — ${done} file${done !== 1 ? 's' : ''} downloaded.`;
    isRunning = false;
    syncSelectionUI();
  });

  // ── Utilities ─────────────────────────────────────────────────────────────
  function resetProgress() {
    $('cm-status-text').textContent = '';
    $('cm-progress-wrap').style.display = 'none';
    $('cm-progress-bar').style.width = '0%';
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();