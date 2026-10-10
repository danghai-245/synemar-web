(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./util'));
  } else {
    root.PlaylistEngine = factory(root.Util);
  }
})(typeof self !== 'undefined' ? self : this, function (Util) {
  const { trySafe } = Util;

  const IMAGE_MS_DEFAULT = 15000;

  function mediaUrl(p) {
    if (/^blob:/.test(p)) return p;
    return 'media://file/?path=' + encodeURIComponent(p);
  }

  function isVideoEl(el) {
    return !!el && el.tagName === 'VIDEO';
  }

  function hasReadyFrame(el) {
    try {
      return el.readyState === undefined || el.readyState >= 2;
    } catch (e) {
      return true;
    }
  }

  function canListen(el) {
    return typeof el.addEventListener === 'function' && typeof el.removeEventListener === 'function';
  }

  function setOpacity(el, v) {
    el.style.opacity = v;
  }

  function setLayer(el, on) {
    if (typeof el.classList !== 'undefined') {
      const has = el.classList.contains('video-in');
      if (on && !has) el.classList.add('video-in');
      else if (!on && has) el.classList.remove('video-in');
    }
  }

  function clearMediaEl(el) {
    if (isVideoEl(el)) {
      trySafe(() => el.pause());
      el.removeAttribute('src');
      trySafe(() => el.load());
    } else {
      el.removeAttribute('src');
    }
    setOpacity(el, 0);
    setLayer(el, false);
  }

  function normalizeTracks(tracks) {
    return (tracks || []).map((t) => {
      if (typeof t === 'string') return { path: t.trim(), kind: 'video' };
      return {
        path: String((t && t.path) || '').trim(),
        kind: t && t.kind === 'image' ? 'image' : 'video'
      };
    }).filter((t) => t.path);
  }

  function waitReady(el, timeoutMs, onReady, schedule, cancel) {
    if (hasReadyFrame(el)) {
      onReady();
      return;
    }
    let done = false;
    let timer = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (canListen(el)) el.removeEventListener('loadeddata', onData);
      cancel(timer);
      onReady();
    };
    function onData() { finish(); }
    if (canListen(el)) el.addEventListener('loadeddata', onData);
    timer = schedule(() => finish(), timeoutMs);
  }

  function createPlaylist(opts) {
    const slots = opts.slots;
    const crossfadeMs = opts.crossfadeMs;
    const imageMs = opts.imageMs || IMAGE_MS_DEFAULT;
    const schedule = opts.schedule || ((fn, ms) => setTimeout(fn, ms));
    const cancel = opts.cancel || ((t) => clearTimeout(t));
    const currentTime = opts.currentTime || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    const readiness = opts.waitReady || waitReady;

    let activeSlotIdx = 0;
    let activePlIdx = 0;
    let activeEl = null;
    let fade = null;
    let lastEndedAt = -Infinity;
    let currentList = [];
    let pendingEnded = false;
    let switching = false;
    let slotStartedAt = 0;

    function activeSlot() {
      return slots[activeSlotIdx];
    }

    function otherSlot() {
      return slots[1 - activeSlotIdx];
    }

    function stopSlot(slot) {
      clearMediaEl(slot.video);
      clearMediaEl(slot.img);
    }

    function showTrackInSlot(slot, track) {
      if (track.kind === 'image') {
        clearMediaEl(slot.video);
        slot.img.src = mediaUrl(track.path);
        return slot.img;
      }
      clearMediaEl(slot.img);
      slot.video.src = mediaUrl(track.path);
      slot.video.load();
      const pr = slot.video.play();
      if (pr) pr.catch(() => {});
      return slot.video;
    }

    function preloadTrackInSlot(slot, track) {
      const url = mediaUrl(track.path);
      if (track.kind === 'image') {
        if (slot.img.getAttribute('src') !== url) slot.img.src = url;
      } else if (slot.video.getAttribute('src') !== url) {
        slot.video.src = url;
        slot.video.load();
        trySafe(() => slot.video.pause());
      }
    }

    function prepareNext(list) {
      if (list.length < 2) return;
      preloadTrackInSlot(otherSlot(), list[(activePlIdx + 1) % list.length]);
    }

    function startPlaylist(tracks, startIndex) {
      fade = null;
      pendingEnded = false;
      switching = false;
      lastEndedAt = -Infinity;
      currentList = normalizeTracks(tracks);
      const list = currentList;
      if (!list.length) {
        slots.forEach(stopSlot);
        activeSlotIdx = 0;
        activePlIdx = 0;
        activeEl = null;
        return;
      }
      activePlIdx = (typeof startIndex === 'number' && startIndex >= 0 && startIndex < list.length)
        ? startIndex
        : Math.min(activePlIdx, list.length - 1);
      stopSlot(otherSlot());
      activeEl = showTrackInSlot(activeSlot(), list[activePlIdx]);
      setOpacity(activeEl, 1);
      setLayer(activeEl, false);
      slotStartedAt = currentTime();
      prepareNext(list);
    }

    function tick(now) {
      if (!fade) return;
      let t = (now - fade.start) / fade.dur;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      const inc = 1 - Math.pow(1 - t, 3);
      setOpacity(fade.inEl, inc);
      if (fade.outEl) setOpacity(fade.outEl, 1 - Math.pow(t, 3));
      if (t >= 1) {
        if (fade.outEl) clearMediaEl(fade.outEl);
        setLayer(fade.inEl, false);
        fade = null;
        if (pendingEnded) {
          pendingEnded = false;
          advance(currentList);
        }
      }
    }

    function advance(list) {
      currentList = list;
      if (!list.length) return;
      if (fade) {
        pendingEnded = true;
        lastEndedAt = -Infinity;
        return;
      }
      if (switching) return;
      if (list.length < 2) {
        const t = list[activePlIdx] || list[0];
        if (t.kind === 'video' && activeEl && isVideoEl(activeEl)) {
          activeEl.currentTime = 0;
          const pr = activeEl.play();
          if (pr) pr.catch(() => {});
        }
        slotStartedAt = currentTime();
        return;
      }
      const now = currentTime();
      if (now - lastEndedAt < crossfadeMs) return;
      lastEndedAt = now;
      const nextPl = (activePlIdx + 1) % list.length;
      const nextSlot = otherSlot();
      const oldEl = activeEl;
      preloadTrackInSlot(nextSlot, list[nextPl]);
      const nextEl = list[nextPl].kind === 'image' ? nextSlot.img : nextSlot.video;
      switching = true;
      readiness(nextEl, crossfadeMs, () => {
        switching = false;
        switchTo(nextEl, oldEl, list, nextPl);
      }, schedule, cancel);
    }

    function switchTo(nextEl, oldEl, list, nextPl) {
      if (isVideoEl(nextEl)) {
        const pr = nextEl.play();
        if (pr) pr.catch(() => {});
      }
      setOpacity(nextEl, 0);
      if (oldEl) setOpacity(oldEl, 1);
      setLayer(nextEl, true);
      fade = { inEl: nextEl, outEl: oldEl, start: currentTime(), dur: crossfadeMs };
      activeSlotIdx = 1 - activeSlotIdx;
      activePlIdx = nextPl;
      activeEl = nextEl;
      slotStartedAt = currentTime();
      prepareNext(list);
    }

    return {
      handleTrackEnded(tracks) {
        return advance(normalizeTracks(tracks));
      },
      startPlaylist(tracks, startIndex) {
        return startPlaylist(tracks, startIndex);
      },
      update(now) {
        tick(now);
        if (!fade && !pendingEnded && !switching && currentList.length) {
          const t = currentList[activePlIdx];
          if (!t) return;
          if (t.kind === 'image') {
            if (now - slotStartedAt > imageMs) advance(currentList);
          } else if (activeEl && activeEl.ended) {
            advance(currentList);
          }
        }
      },
      get currentIndex() {
        return activePlIdx;
      }
    };
  }

  return { createPlaylist, mediaUrl };
});
