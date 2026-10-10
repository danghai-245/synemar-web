(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./playlist'));
  } else {
    root.VideoBg = factory(root.PlaylistEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (PlaylistEngine) {
  function create(opts) {
    const {
      manager, slots, crossfadeMs, imageMs, toast
    } = opts;

    const playlist = PlaylistEngine.createPlaylist({ slots, crossfadeMs, imageMs });
    let appliedListKey = null;

    function trackList() {
      return manager.state.videoTracks.map((t) => ({
        path: t.path,
        kind: t.kind === 'image' ? 'image' : 'video'
      }));
    }

    function hasVideos() {
      return trackList().length > 0;
    }

    function apply() {
      const list = trackList();
      document.body.classList.toggle('has-vid', list.length > 0);
      if (!list.length) {
        appliedListKey = null;
        playlist.startPlaylist([]);
        return;
      }
      const key = JSON.stringify(list) + '#' + manager.state.currentVideoIndex;
      if (key !== appliedListKey) {
        appliedListKey = key;
        playlist.startPlaylist(list, manager.state.currentVideoIndex);
      }
    }

    function handleTrackEnded() {
      playlist.handleTrackEnded(trackList());
    }

    slots.forEach((slot) => {
      [slot.video, slot.img].forEach((el) => {
        el.addEventListener('error', () => {
          if (hasVideos()) toast('Could not load one of the background files.');
        });
      });
      slot.video.addEventListener('ended', handleTrackEnded);
    });

    return {
      hasVideos,
      apply,
      update(now) {
        playlist.update(now);
      }
    };
  }

  return { create };
});
