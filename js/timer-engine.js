// timer-engine.js — small generic timer helpers used by the warm-up,
// rest, EMOM, and session-stopwatch timers.

// Every setInterval id created anywhere in the app gets registered here so
// a single call to TimerRegistry.clearAll() can stop every running timer
// when the user navigates away mid-timer (e.g. taps "Exit" during warm-up).
const TimerRegistry = {
  ids: new Set(),

  track(id) {
    this.ids.add(id);
    return id;
  },

  clearAll() {
    this.ids.forEach((id) => clearInterval(id));
    this.ids.clear();
  }
};

// A one-shot countdown from `seconds` to 0, ticking once per second.
// onTick(remainingSeconds) fires immediately and then every second.
// onDone() fires once, when it reaches 0.
function createCountdown(seconds, onTick, onDone) {
  let remaining = seconds;
  let intervalId = null;

  function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      TimerRegistry.ids.delete(intervalId);
      intervalId = null;
    }
  }

  return {
    start() {
      onTick(remaining);
      intervalId = TimerRegistry.track(setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          stop();
          onTick(0);
          onDone();
        } else {
          onTick(remaining);
        }
      }, 1000));
    },
    stop,
    skipToEnd() {
      stop();
      onTick(0);
      onDone();
    }
  };
}

// A simple up-counting stopwatch, in whole seconds.
function createStopwatch() {
  let elapsed = 0;
  let intervalId = null;

  return {
    start() {
      intervalId = TimerRegistry.track(setInterval(() => {
        elapsed += 1;
      }, 1000));
    },
    stop() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        TimerRegistry.ids.delete(intervalId);
        intervalId = null;
      }
    },
    getElapsed() {
      return elapsed;
    }
  };
}

// Formats whole seconds as "M:SS" or "H:MM:SS" once past an hour.
function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}
