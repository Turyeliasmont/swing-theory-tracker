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

// ---------------------------------------------------------------------
// EMOM schedule: which exercise runs in which minute.
//
// An EMOM block's "pattern" entries each say which minutes they cover:
//  - no block.cycleLength: entry.minute is "odd" or "even".
//  - block.cycleLength N: entry.minute is a 1-based position in an N-minute
//    cycle (minute 1 -> position 1, minute N+1 -> position 1 again...).
// Either shape can add optional entry.from / entry.to (1-based, inclusive)
// to limit the entry to part of the block, e.g. one exercise for odd
// minutes 1-10 and a different one for odd minutes 11-20. If several
// entries match a minute, the first one in the list wins.
// ---------------------------------------------------------------------

function emomEntryForMinute(block, minuteNum) {
  const key = block.cycleLength
    ? ((minuteNum - 1) % block.cycleLength) + 1
    : (minuteNum % 2 === 1 ? 'odd' : 'even');
  return (block.pattern || []).find((p) =>
    p.minute === key &&
    (p.from === undefined || minuteNum >= p.from) &&
    (p.to === undefined || minuteNum <= p.to)
  ) || null;
}

// Returns an array of block.totalMinutes strings: index 0 is minute 1.
function buildEmomSchedule(block) {
  const schedule = [];
  for (let m = 1; m <= block.totalMinutes; m++) {
    const entry = emomEntryForMinute(block, m);
    schedule.push(entry ? entry.exercise : '');
  }
  return schedule;
}
