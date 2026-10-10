(function (root) {
  var REC_SIZE_KEY = 'synemar-web.recSize';
  var registry = new Map();
  var urlToFile = new Map();

  function fileKey(file) {
    return file.name + '|' + file.size + '|' + file.lastModified;
  }

  function registerFile(file) {
    if (!file) return '';
    var key = fileKey(file);
    var entry = registry.get(key);
    if (entry) return entry.url;
    var url = URL.createObjectURL(file);
    entry = { url: url, file: file };
    registry.set(key, entry);
    urlToFile.set(url, file);
    return url;
  }

  function pickFiles(accept, multiple) {
    return new Promise(function (resolve) {
      var input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = accept;
      if (multiple) input.multiple = true;
      input.style.display = 'none';
      document.body.appendChild(input);
      var settled = false;
      function done(files) {
        if (settled) return;
        settled = true;
        window.removeEventListener('focus', onFocus);
        input.remove();
        resolve(files ? Array.from(files) : []);
      }
      function onFocus() {
        setTimeout(function () {
          done(input.files && input.files.length ? input.files : []);
        }, 350);
      }
      input.addEventListener('change', function () { done(input.files); });
      window.addEventListener('focus', onFocus);
      input.click();
    });
  }

  function bytesToBase64(bytes) {
    var s = '';
    var CHUNK = 8192;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      s += String.fromCharCode.apply(null, bytes.slice(i, i + CHUNK));
    }
    return btoa(s);
  }

  function pictureToDataUrl(picture) {
    if (!picture || !picture.data || !picture.data.length) return null;
    var mime = picture.format || 'image/jpeg';
    if (String(mime).indexOf('data:') === 0) return 'data:' + mime + ';base64,' + bytesToBase64(picture.data);
    if (!/^image\//.test(mime)) mime = 'image/' + String(mime).replace(/^\./, '');
    return 'data:' + mime + ';base64,' + bytesToBase64(picture.data);
  }

  function parseFilenameMeta(fileName) {
    var base = String(fileName || '').replace(/\.[^.]+$/, '');
    var parts = base.split(/ - /);
    if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
      return { title: parts.slice(1).join(' - ').trim(), artist: parts[0].trim(), album: null };
    }
    return { title: base.trim() || String(fileName || ''), artist: null, album: null };
  }

  function readTags(file) {
    return new Promise(function (resolve) {
      var reader = root.jsmediatags;
      if (!reader || typeof reader.read !== 'function') { resolve(null); return; }
      var settled = false;
      function done(tags) {
        if (settled) return;
        settled = true;
        resolve(tags || null);
      }
      try {
        reader.read(file, {
          onSuccess: function (res) { done(res && res.tags); },
          onError: function () { done(null); }
        });
        setTimeout(function () { done(null); }, 8000);
      } catch (err) { done(null); }
    });
  }

  async function buildAudioPayload(file, url) {
    var buffer = null;
    try {
      buffer = await file.arrayBuffer();
    } catch (err) {
      return { error: 'Could not read that file.' };
    }
    var tags = await readTags(file);
    var meta = parseFilenameMeta(file.name);
    if (tags) {
      if (tags.title) meta.title = String(tags.title);
      var artist = tags.artist || tags.albumArtist;
      if (artist) meta.artist = String(artist);
      if (tags.album) meta.album = String(tags.album);
      var cover = pictureToDataUrl(tags.picture);
      if (cover) meta.coverDataUrl = cover;
    }
    return { buffer: buffer, meta: meta, fileName: file.name, path: url };
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      a.remove();
      URL.revokeObjectURL(url);
    }, 4000);
  }

  function stamp() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  }

  function loadRecSize() {
    try {
      var raw = localStorage.getItem(REC_SIZE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && o.w > 0 && o.h > 0) return { w: o.w, h: o.h };
    } catch (err) {}
    return null;
  }

  var recSize = loadRecSize();

  var api = {
    getPathForFile: function (file) {
      return registerFile(file);
    },
    selectAudio: async function () {
      var files = await pickFiles('audio/*', false);
      if (!files.length) return null;
      return buildAudioPayload(files[0], registerFile(files[0]));
    },
    readAudioFile: async function (path) {
      var file = urlToFile.get(path);
      if (!file) return { error: 'That file is no longer available — please add it again.' };
      return buildAudioPayload(file, path);
    },
    selectMultipleAudio: async function () {
      var files = await pickFiles('audio/*', true);
      return files.map(function (f) { return { path: registerFile(f), fileName: f.name }; });
    },
    selectMultipleVideo: async function () {
      var files = await pickFiles('video/*', true);
      return files.map(function (f) { return { path: registerFile(f), fileName: f.name }; });
    },
    savePlaylistFile: async function (json) {
      downloadBlob(new Blob([json], { type: 'application/json' }), 'synemar-playlist.json');
      return null;
    },
    openPlaylistFile: async function () {
      var files = await pickFiles('application/json,.json', false);
      if (!files.length) return null;
      try {
        return JSON.parse(await files[0].text());
      } catch (err) {
        return { error: 'Could not read playlist: ' + (err.message || err) };
      }
    },
    setFullscreen: async function (flag) {
      try {
        if (flag) {
          if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          }
        } else if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch (err) {}
    },
    isFullscreen: async function () {
      return !!document.fullscreenElement;
    },
    setContentSize: async function (w, h) {
      recSize = { w: w, h: h };
      try {
        localStorage.setItem(REC_SIZE_KEY, JSON.stringify(recSize));
      } catch (err) {}
    },
    recordingSize: function () {
      return recSize;
    },
    getAppIconSvg: async function () {
      return null;
    },
    setAppIconPng: function () {},
    saveRecording: async function (payload) {
      var ext = (payload && payload.ext) || 'webm';
      var blob = new Blob([payload.buf], { type: ext === 'mp4' ? 'video/mp4' : 'video/webm' });
      downloadBlob(blob, 'synemar-rec-' + stamp() + '.' + ext);
      return { ok: true };
    },
    onFullscreenChange: function (cb) {
      var handler = function () { cb(!!document.fullscreenElement); };
      document.addEventListener('fullscreenchange', handler);
      return function () { document.removeEventListener('fullscreenchange', handler); };
    },
    onMenuAction: function () {
      return function () {};
    },
    onOpenFile: function () {
      return function () {};
    },
    pruneDeadTracks: function (manager) {
      if (!manager || !manager.state || typeof manager.save !== 'function') return;
      var changed = false;
      ['audioTracks', 'videoTracks'].forEach(function (key) {
        var list = manager.state[key] || [];
        var kept = list.filter(function (t) { return t && urlToFile.has(t.path); });
        if (kept.length !== list.length) {
          manager.state[key] = kept;
          changed = true;
        }
      });
      if (changed) {
        manager.state.currentAudioIndex = kept_index(manager.state.currentAudioIndex, manager.state.audioTracks.length);
        manager.state.currentVideoIndex = kept_index(manager.state.currentVideoIndex, manager.state.videoTracks.length);
        manager.save();
      }
      function kept_index(index, length) {
        if (!length) return -1;
        if (typeof index !== 'number' || !isFinite(index)) return 0;
        return Math.max(0, Math.min(index, length - 1));
      }
    }
  };

  root.api = api;
  root.webApi = api;
})(typeof window !== 'undefined' ? window : this);
