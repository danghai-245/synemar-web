(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function create(opts) {
    const {
      settings, saveSettings, playAudioFile, addVideoFile, videoBg, audioEngine,
      getFullscreen, getScrubbing, audioExts, videoExts, imageExts
    } = opts;
    const body = document.body;
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));
    const settingsEl = $('#settings');
    const toastEl = $('#toast');

    let lastToastTimer = null;
    function toast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      clearTimeout(lastToastTimer);
      lastToastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
    }

    function updateSizeNote() {
      const el = $('#size-note');
      if (!el) return;
      const rs = window.api && window.api.recordingSize ? window.api.recordingSize() : null;
      el.textContent = rs
        ? `Recording size: ${rs.w} × ${rs.h} px (screen: ${window.innerWidth} × ${window.innerHeight})`
        : `Current window: ${window.innerWidth} × ${window.innerHeight} px (press F for fullscreen)`;
    }

    function fillRange(input) {
      const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
      input.style.setProperty('--fill', `${pct}%`);
    }

    function openSettings() { settingsEl.classList.remove('hidden'); }
    function closeSettings() {
      if (settingsEl.classList.contains('hidden')) return;
      settingsEl.classList.add('hidden');
    }
    function isSettingsOpen() { return !settingsEl.classList.contains('hidden'); }

    function toggleHideUi() {
      body.classList.toggle('hideui');
      const hidden = body.classList.contains('hideui');
      toast(hidden
        ? 'UI hidden (H to restore)'
        : 'UI shown' + (settings.showDock === false ? ' — Player controls: Settings (Ctrl+,) › Player controls' : ''));
    }

    async function openExternalPath(p, fileName) {
      if (!p || !window.api) return;
      const name = fileName || p.split(/[\\/]/).pop() || p;
      const dot = name.lastIndexOf('.');
      const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
      if (audioExts.includes(ext)) {
        await playAudioFile(p, name);
      } else if (videoExts.includes(ext)) {
        addVideoFile(p, name, 'video');
      } else if (imageExts.includes(ext)) {
        addVideoFile(p, name, 'image');
      } else {
        toast(`Can't use "${name}".`);
      }
    }

    async function handleDropped(file, filePath) {
      if (filePath) await openExternalPath(filePath, file.name);
      else toast(`Can't use "${file.name}".`);
    }

    function setupDrag(el, keyX, keyY, label) {
      let dragging = false, startX = 0, startY = 0, baseL = 0, baseT = 0, moved = false;
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        dragging = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        baseL = parseFloat(el.style.left) || settings[keyX];
        baseT = parseFloat(el.style.top) || settings[keyY];
        el.setPointerCapture(e.pointerId);
        el.classList.add('dragging');
        e.preventDefault();
      });
      el.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 3) moved = true;
        const x = Math.max(0, Math.min(100, baseL + ((e.clientX - startX) / window.innerWidth) * 100));
        const y = Math.max(0, Math.min(100, baseT + ((e.clientY - startY) / window.innerHeight) * 100));
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
      });
      const stop = () => {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('dragging');
        if (moved) {
          settings[keyX] = parseFloat(el.style.left) || settings[keyX];
          settings[keyY] = parseFloat(el.style.top) || settings[keyY];
          saveSettings();
          toast(`${label} position saved`);
        }
      };
      el.addEventListener('pointerup', stop);
      el.addEventListener('pointercancel', stop);
    }

    function setupDragDrop() {
      window.addEventListener('dragover', (e) => {
        e.preventDefault();
        const hasFiles = e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files');
        if (hasFiles) body.classList.add('dragging');
      });
      window.addEventListener('dragleave', (e) => {
        if (!e.relatedTarget) body.classList.remove('dragging');
      });
      window.addEventListener('drop', async (e) => {
        e.preventDefault();
        body.classList.remove('dragging');
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file) return;
        const filePath = window.api && window.api.getPathForFile ? window.api.getPathForFile(file) : '';
        await handleDropped(file, filePath || '');
      });
    }

    let hideTimer = null;
    function scheduleCursorHide() {
      clearTimeout(hideTimer);
      body.classList.remove('no-cursor');
      hideTimer = setTimeout(() => {
        if (audioEngine.state.playing && getFullscreen() && !getScrubbing()) body.classList.add('no-cursor');
      }, 2600);
    }

    $('#btn-settings').addEventListener('click', openSettings);
    $('#btn-settings-plain').addEventListener('click', openSettings);
    $('#btn-close-settings').addEventListener('click', closeSettings);
    settingsEl.addEventListener('click', (e) => {
      if (e.target !== settingsEl) return;
      if (!$('#color-picker-overlay').classList.contains('hidden')) return;
      closeSettings();
    });

    $$('.canvas-presets [data-size]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [w, h] = btn.dataset.size.split('x').map(Number);
        window.api.setContentSize(w, h);
        updateSizeNote();
        toast(`Recording size: ${w} × ${h}`);
      });
    });

    window.addEventListener('pointermove', scheduleCursorHide);

    return { toast, openSettings, closeSettings, isSettingsOpen, toggleHideUi, updateSizeNote, fillRange, setupDrag, setupDragDrop, openExternalPath, handleDropped };
  }

  return { create };
});