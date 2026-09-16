(() => {
  const STORAGE_KEY = 'sermonTrainerStudy';
  const BACKUP_VERSION = 1;

  function nowLabel() {
    return new Intl.DateTimeFormat('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    }).format(new Date());
  }

  function fileDate() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  function slug(text) {
    return String(text || 'sermon-study')
      .trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'sermon-study';
  }

  function collectStudy() {
    const data = {};
    ids.forEach(id => {
      const el = document.getElementById(id);
      data[id] = el ? el.value : '';
    });
    data.scriptures = Array.isArray(scriptures) ? [...scriptures] : [];
    data._backup = {
      app: 'Sermon Trainer',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString()
    };
    return data;
  }

  function setStatus(message) {
    const el = document.getElementById('saveStatus');
    if (el) el.textContent = message;
    const backupStatus = document.getElementById('backupStatus');
    if (backupStatus) backupStatus.textContent = message;
  }

  const originalSave = save;
  save = function enhancedSave() {
    originalSave();
    const stamp = `Saved locally ${nowLabel()}`;
    localStorage.setItem('sermonTrainerLastSaved', new Date().toISOString());
    setStatus(stamp);
  };

  function saveNow() {
    save();
  }

  function exportStudyBackup() {
    save();
    const data = collectStudy();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slug(data.title)}-${fileDate()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`Backup exported ${nowLabel()}`);
  }

  function currentStudyHasWork() {
    return ids.some(id => {
      const el = document.getElementById(id);
      return el && String(el.value || '').trim();
    }) || (Array.isArray(scriptures) && scriptures.length > 0);
  }

  function applyImportedStudy(data) {
    ids.forEach(id => {
      if (Object.prototype.hasOwnProperty.call(data, id)) {
        const el = document.getElementById(id);
        if (el) el.value = data[id] == null ? '' : String(data[id]);
      }
    });
    scriptures = Array.isArray(data.scriptures)
      ? data.scriptures.filter(x => typeof x === 'string').slice(0, 200)
      : [];
    renderScriptures();
    save();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStatus(`Backup restored ${nowLabel()}`);
  }

  function importStudyBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ''));
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('The selected file is not a Sermon Trainer study backup.');
        }
        const title = String(data.title || 'Untitled study');
        const exportedAt = data._backup?.exportedAt
          ? new Date(data._backup.exportedAt).toLocaleString('en-AU')
          : 'date unknown';
        const message = currentStudyHasWork()
          ? `Import “${title}” (backup: ${exportedAt})? This will replace the study currently open in this browser.`
          : `Import “${title}” (backup: ${exportedAt})?`;
        if (!confirm(message)) return;
        applyImportedStudy(data);
      } catch (error) {
        alert(error.message || 'Unable to import this backup file.');
      }
    };
    reader.readAsText(file);
  }

  function buildUi() {
    const actions = document.querySelector('.actions');
    if (actions) {
      const saveBtn = document.createElement('button');
      saveBtn.className = 'secondary';
      saveBtn.textContent = 'Save Now';
      saveBtn.addEventListener('click', saveNow);

      const exportBtn = document.createElement('button');
      exportBtn.className = 'secondary';
      exportBtn.textContent = 'Export Backup';
      exportBtn.addEventListener('click', exportStudyBackup);

      const importBtn = document.createElement('button');
      importBtn.className = 'secondary';
      importBtn.textContent = 'Import Backup';

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json,application/json';
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', event => {
        importStudyBackup(event.target.files?.[0]);
        event.target.value = '';
      });
      importBtn.addEventListener('click', () => fileInput.click());

      actions.prepend(importBtn);
      actions.prepend(exportBtn);
      actions.prepend(saveBtn);
      actions.appendChild(fileInput);
    }

    const content = document.querySelector('.content');
    if (content) {
      const card = document.createElement('div');
      card.className = 'card no-print';
      card.innerHTML = `
        <h2>Save, Backup & Restore</h2>
        <p class="hint">Your study saves automatically in this browser. For work that continues over several weeks, export a backup regularly. You can import the latest backup on another device or browser and continue working.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" id="backupSaveBtn">Save Now</button>
          <button type="button" class="brown" id="backupExportBtn">Export Study Backup</button>
          <button type="button" class="outline" id="backupImportBtn">Import Study Backup</button>
        </div>
        <p id="backupStatus" class="tiny" style="margin-top:10px">Local storage is device/browser specific. Keep your exported JSON backup somewhere you can find it again.</p>`;
      content.insertBefore(card, content.firstChild);
      card.querySelector('#backupSaveBtn').addEventListener('click', saveNow);
      card.querySelector('#backupExportBtn').addEventListener('click', exportStudyBackup);
      card.querySelector('#backupImportBtn').addEventListener('click', () => {
        const input = actions?.querySelector('input[type="file"]');
        if (input) input.click();
      });
    }

    if (!document.getElementById('eduAppsFooter')) {
      const footer = document.createElement('footer');
      footer.id = 'eduAppsFooter';
      footer.className = 'no-print';
      footer.style.cssText = 'max-width:1280px;margin:0 auto 32px;padding:0 18px;text-align:center;color:#667085;font-size:13px;';
      footer.innerHTML = 'Developed and maintained by <strong>EDU Apps Plus</strong> &nbsp;•&nbsp; <a href="mailto:enquiries@eduappsplus.com.au" style="color:#5f6f52;text-decoration:none;font-weight:700">enquiries@eduappsplus.com.au</a>';
      document.body.appendChild(footer);
    }

    const last = localStorage.getItem('sermonTrainerLastSaved');
    if (last) {
      const d = new Date(last);
      if (!Number.isNaN(d.getTime())) setStatus(`Last saved locally ${new Intl.DateTimeFormat('en-AU', { day:'2-digit', month:'short', hour:'numeric', minute:'2-digit' }).format(d)}`);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUi);
  } else {
    buildUi();
  }
})();
