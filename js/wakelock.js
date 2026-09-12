// wakelock.js — keeps the screen on during a workout using the Screen
// Wake Lock API. If the browser doesn't support it, every call here is a
// silent no-op — nothing about the workout depends on it working.

const WakeLockCtl = {
  sentinel: null,
  wanted: false,

  async acquire() {
    this.wanted = true;
    try {
      if ('wakeLock' in navigator) {
        this.sentinel = await navigator.wakeLock.request('screen');
        this.sentinel.addEventListener('release', () => {
          this.sentinel = null;
        });
      }
    } catch (e) {
      // unsupported, denied, or not allowed right now — ignore
      this.sentinel = null;
    }
  },

  async release() {
    this.wanted = false;
    try {
      if (this.sentinel) {
        await this.sentinel.release();
      }
    } catch (e) {
      // ignore
    }
    this.sentinel = null;
  }
};

// The wake lock is automatically released by the browser when the tab is
// hidden (e.g. phone screen auto-locks briefly, or the user switches apps).
// Re-acquire it when the page becomes visible again, but only if we still
// want it (i.e. a warm-up or workout is in progress).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && WakeLockCtl.wanted && !WakeLockCtl.sentinel) {
    WakeLockCtl.acquire();
  }
});
