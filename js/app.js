// app.js — screens, navigation, and rendering for Swing Theory Tracker.
// This is the only file that knows about "screens"; storage.js, audio.js,
// wakelock.js, timer-engine.js and programs.js are all generic helpers.

const screenEl = document.getElementById('screen');

const App = {
  programs: [],       // all loaded program objects, each has __file
  activeFile: null,   // filename of the active program
  activeProgram: null,
  weekIndex: 0,
  dayIndex: 0,
  stopwatch: null,
  warmupExercises: null // cached for the current day, set when warm-up starts
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getActiveWeek() {
  return App.activeProgram.weeks[App.weekIndex];
}

function getActiveDay() {
  return getActiveWeek().days[App.dayIndex];
}

function isProgramComplete(program, position) {
  return position.weekIndex >= program.weeks.length;
}

// Stops every running timer and releases the wake lock. Called at the
// start of every screen render so leftover timers from a previous screen
// never keep running (and never keep beeping) in the background.
function resetTransientState() {
  TimerRegistry.clearAll();
  WakeLockCtl.release();
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

async function boot() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // offline support just won't be available — the app still works
    });
  }

  try {
    App.programs = await Programs.loadAll();
  } catch (err) {
    renderFatalError(err);
    return;
  }

  if (App.programs.length === 0) {
    renderFatalError(new Error('No programs found. Check programs/manifest.json.'));
    return;
  }

  App.twentyMin = await Programs.loadTwentyMin();

  renderPicker();
}

function renderFatalError(err) {
  screenEl.innerHTML = `
    <h1>Swing Theory Tracker</h1>
    <div class="error-box">
      <strong>Couldn't load your programs.</strong>
      <p>${escapeHtml(err.message)}</p>
      <p>Check that <code>programs/manifest.json</code> exists and lists valid
      program files, and that this page is being served over http(s) (not
      opened directly as a <code>file://</code> path).</p>
    </div>
  `;
}

// ---------------------------------------------------------------------
// Screen: Program picker
// ---------------------------------------------------------------------

function renderPicker() {
  resetTransientState();

  const cards = App.programs.map((program) => {
    const file = program.__file;
    const position = Storage.getPosition(file);
    const complete = isProgramComplete(program, position);
    const isActive = file === Storage.getActiveProgramFile();

    let progressText;
    if (complete) {
      progressText = 'Program complete';
    } else {
      const week = program.weeks[position.weekIndex];
      const day = week.days[position.dayIndex];
      progressText = `Week ${escapeHtml(week.week)} of ${program.weeks.length} — ${escapeHtml(day.name)}`;
    }

    return `
      <button class="program-card ${isActive ? 'active' : ''}" data-action="select-program" data-file="${escapeHtml(file)}">
        ${isActive ? '<div class="program-card-badge">Active</div>' : ''}
        <div class="program-card-name">${escapeHtml(program.program.name)}</div>
        <div class="program-card-meta">${escapeHtml(program.program.format || '')}${program.program.daysPerWeek ? ' · ' + escapeHtml(program.program.daysPerWeek) + 'x/week' : ''}</div>
        <div class="program-card-progress">${progressText}</div>
      </button>
    `;
  }).join('');

  const twentyMinCard = App.twentyMin
    ? `
      <button class="program-card twenty-min-card" data-action="go-20min-home">
        <div class="program-card-name">${escapeHtml(App.twentyMin.section.name)}</div>
        <div class="program-card-meta">${App.twentyMin.workouts.length} standalone workouts · separate from your program</div>
        <div class="program-card-progress">Up next: ${escapeHtml(getSuggestedWorkout().name)}</div>
      </button>`
    : '';

  screenEl.innerHTML = `
    <h1>Swing Theory Tracker</h1>
    <p class="subtitle">Choose your active program</p>
    <div class="program-list">${cards}${twentyMinCard}</div>
    <button class="secondary-btn" data-action="go-history">View History</button>
  `;
}

function selectProgram(file) {
  Storage.setActiveProgramFile(file);
  App.activeFile = file;
  App.activeProgram = App.programs.find((p) => p.__file === file);
  const position = Storage.getPosition(file);
  App.weekIndex = position.weekIndex;
  App.dayIndex = position.dayIndex;
  renderDay();
}

// ---------------------------------------------------------------------
// Screen: Day view (or Program Complete)
// ---------------------------------------------------------------------

function renderDay() {
  resetTransientState();

  const position = { weekIndex: App.weekIndex, dayIndex: App.dayIndex };
  if (isProgramComplete(App.activeProgram, position)) {
    renderProgramComplete();
    return;
  }

  const week = getActiveWeek();
  const day = getActiveDay();

  const weekOptions = App.activeProgram.weeks.map((w, i) =>
    `<option value="${i}" ${i === App.weekIndex ? 'selected' : ''}>Week ${escapeHtml(w.week)} — ${escapeHtml(w.phase || '')}</option>`
  ).join('');

  const dayOptions = week.days.map((d, i) =>
    `<option value="${i}" ${i === App.dayIndex ? 'selected' : ''}>${escapeHtml(d.day)} — ${escapeHtml(d.name)}</option>`
  ).join('');

  screenEl.innerHTML = `
    <div class="topbar">
      <button class="link-btn" data-action="go-picker">&lsaquo; Programs</button>
      <button class="link-btn" data-action="go-history">History</button>
    </div>
    <h1>${escapeHtml(App.activeProgram.program.name)}</h1>
    <div class="day-card">
      <div class="day-week-label">Week ${escapeHtml(week.week)} — ${escapeHtml(week.phase || '')}</div>
      <div class="day-name">${escapeHtml(day.name)}</div>
      <div class="day-id-label">${escapeHtml(day.day)}</div>
    </div>

    ${renderProgressionCueHtml(day)}

    <details class="jump-panel">
      <summary>Jump to a different week/day</summary>
      <div class="jump-row">
        <label for="jump-week">Week</label>
        <select id="jump-week">${weekOptions}</select>
      </div>
      <div class="jump-row">
        <label for="jump-day">Day</label>
        <select id="jump-day">${dayOptions}</select>
      </div>
      <button class="secondary-btn" data-action="jump-go">Go to this week/day</button>
    </details>

    ${renderDayPreview(week, day)}

    <button class="primary-btn big" data-action="start-day">Start Workout</button>
  `;

  const weekSelect = document.getElementById('jump-week');
  const daySelect = document.getElementById('jump-day');
  weekSelect.addEventListener('change', () => {
    const w = App.activeProgram.weeks[parseInt(weekSelect.value, 10)];
    daySelect.innerHTML = w.days.map((d, i) =>
      `<option value="${i}">${escapeHtml(d.day)} — ${escapeHtml(d.name)}</option>`
    ).join('');
  });
}

// Read-only breakdown of the whole session (warm-up + every block + closer),
// shown on the Day view before "Start Workout". Mirrors the wording of the
// actual warm-up/workout screens so the preview matches what you'll see.

function renderPreviewWarmup(week, day) {
  if (week.phase === 'Deload') {
    return `
      <section class="block">
        <h3>Warm-up</h3>
        <div class="exercise-meta">No warm-up this week — deload week.</div>
      </section>
    `;
  }
  const exercises = buildWarmupExercises(day);
  const items = exercises.map((ex) => `<li>${escapeHtml(ex)}</li>`).join('');
  return `
    <section class="block">
      <h3>Warm-up</h3>
      <div class="exercise-meta">50s work / 10s rest · ${exercises.length} exercises</div>
      <ol class="preview-list">${items}</ol>
    </section>
  `;
}

// Label for one EMOM pattern entry in the preview. Entries limited to part
// of the block (from/to) list their exact minutes, e.g. "Minutes 1, 3, 5,
// 7, 9"; otherwise "Odd minute" / "Even minute" / "Minute 2".
function emomPatternEntryLabel(block, p) {
  if (p.from !== undefined || p.to !== undefined) {
    const minutes = [];
    for (let m = 1; m <= block.totalMinutes; m++) {
      if (emomEntryForMinute(block, m) === p) minutes.push(m);
    }
    return `Minutes ${minutes.join(', ')}`;
  }
  return typeof p.minute === 'number'
    ? `Minute ${p.minute}`
    : `${p.minute.charAt(0).toUpperCase()}${p.minute.slice(1)} minute`;
}

function renderBlockNoteHtml(block) {
  return block.note ? `<div class="block-note">${escapeHtml(block.note)}</div>` : '';
}

// A day-level progression instruction (e.g. "add a set this week"),
// deliberately styled in red so it reads as distinct from the block-level
// "note" field (which stays the neutral accent color).
function renderProgressionCueHtml(day) {
  return day.progressionCue
    ? `<div class="progression-cue">${escapeHtml(day.progressionCue)}</div>`
    : '';
}

function renderPreviewBlock(block) {
  const labelHtml = block.label ? `<h3>${escapeHtml(block.label)}</h3>` : '';
  const noteHtml = renderBlockNoteHtml(block);

  if (block.type === 'straight_sets') {
    const repsText = (block.reps === null || block.reps === undefined || block.reps === '')
      ? ''
      : `${escapeHtml(block.reps)} reps`;
    return `
      <section class="block">
        ${labelHtml}
        <div class="exercise-name">${escapeHtml(block.exercise)}</div>
        <div class="exercise-meta">${block.sets} sets${repsText ? ' × ' + repsText : ''}</div>
        ${noteHtml}
      </section>
    `;
  }

  if (block.type === 'circuit') {
    const items = (block.exercises || []).map((ex) => `<li>${escapeHtml(ex)}</li>`).join('');
    return `
      <section class="block">
        ${labelHtml}
        <div class="exercise-meta">${block.rounds} rounds</div>
        <ul class="preview-list">${items}</ul>
        ${noteHtml}
      </section>
    `;
  }

  if (block.type === 'emom') {
    const items = (block.pattern || [])
      .map((p) => `<li><strong>${escapeHtml(emomPatternEntryLabel(block, p))}:</strong> ${escapeHtml(p.exercise)}</li>`)
      .join('');
    return `
      <section class="block">
        ${labelHtml}
        <div class="exercise-meta">${block.totalMinutes} min total</div>
        <ul class="preview-list">${items}</ul>
        ${noteHtml}
      </section>
    `;
  }

  if (block.type === 'amrap') {
    const items = (block.exercises || []).map((ex) => `<li>${escapeHtml(ex)}</li>`).join('');
    return `
      <section class="block">
        ${labelHtml}
        <div class="exercise-meta">${block.totalMinutes} min · as many rounds as possible, in this order</div>
        <ol class="preview-list">${items}</ol>
        ${noteHtml}
      </section>
    `;
  }

  return `<section class="block"><em>Unknown block type: ${escapeHtml(block.type)}</em></section>`;
}

function renderDayPreview(week, day) {
  const warmupHtml = renderPreviewWarmup(week, day);
  const blocksHtml = day.blocks.map(renderPreviewBlock).join('');
  const closerHtml = day.closer ? `<div class="closer-note">${escapeHtml(day.closer)}</div>` : '';
  return `${warmupHtml}${blocksHtml}${closerHtml}`;
}

function jumpToSelection() {
  const weekSelect = document.getElementById('jump-week');
  const daySelect = document.getElementById('jump-day');
  App.weekIndex = parseInt(weekSelect.value, 10);
  App.dayIndex = parseInt(daySelect.value, 10);
  Storage.setPosition(App.activeFile, { weekIndex: App.weekIndex, dayIndex: App.dayIndex });
  renderDay();
}

function renderProgramComplete() {
  resetTransientState();
  screenEl.innerHTML = `
    <div class="topbar">
      <button class="link-btn" data-action="go-picker">&lsaquo; Programs</button>
      <button class="link-btn" data-action="go-history">History</button>
    </div>
    <div class="summary-card">
      <div class="big-check">\u{1F3C1}</div>
      <h2>Program complete!</h2>
      <p>You finished every week of ${escapeHtml(App.activeProgram.program.name)}.</p>
    </div>
    <button class="secondary-btn" data-action="restart-program">Restart This Program</button>
    <button class="secondary-btn" data-action="go-picker">Back to Programs</button>
  `;
}

function restartProgram() {
  App.weekIndex = 0;
  App.dayIndex = 0;
  Storage.setPosition(App.activeFile, { weekIndex: 0, dayIndex: 0 });
  renderDay();
}

// ---------------------------------------------------------------------
// Screen: Warm-up
// ---------------------------------------------------------------------

function buildWarmupExercises(day, program = App.activeProgram) {
  const warmup = program.warmup;
  // Two warm-up shapes: a fixed "sequence" (same 6 exercises every day, no
  // rotation), or the older "fixed" + "rotationByDay" pool (3 fixed + 3
  // that vary by day). Whichever the program uses, just read it.
  if (warmup.sequence) {
    return warmup.sequence;
  }
  const fixed = warmup.fixed || [];
  const rotating = (warmup.rotationByDay && day && warmup.rotationByDay[day.day]) || [];
  return fixed.concat(rotating);
}

// Runs the 50s/10s warm-up timer. With no options it's the program's warm-up
// for the active day (ending in "Begin Workout" -> begin-workout). The
// 20-Min Workouts pass their own exercises and actions:
//   exercises, doneAction (button when finished), exitAction (top-left Exit),
//   skipAllAction (optional extra "Skip warm-up" button).
function renderWarmup(opts = {}) {
  resetTransientState();
  WakeLockCtl.acquire();

  const exercises = opts.exercises || buildWarmupExercises(getActiveDay());
  const doneAction = opts.doneAction || 'begin-workout';
  const exitAction = opts.exitAction || 'exit-warmup';
  App.warmupSkipAllAction = opts.skipAllAction || null;

  // Flatten into a sequence of steps: work(50s), rest(10s), for each exercise.
  const steps = [];
  exercises.forEach((exercise, i) => {
    steps.push({ type: 'work', exercise, seconds: 50, index: i });
    steps.push({ type: 'rest', exercise, nextExercise: exercises[i + 1] || null, seconds: 10, index: i });
  });

  screenEl.innerHTML = `
    <div class="topbar">
      <button class="link-btn" data-action="${exitAction}">&lsaquo; Exit</button>
      <span></span>
    </div>
    <div class="timer-focus" id="warmup-focus"></div>
  `;

  runWarmupSteps(steps, 0, doneAction);
}

function runWarmupSteps(steps, stepIndex, doneAction) {
  const focusEl = document.getElementById('warmup-focus');
  if (!focusEl) return; // user navigated away

  if (stepIndex >= steps.length) {
    AudioCue.doneCue();
    focusEl.innerHTML = `
      <div class="timer-phase-label">Warm-up complete</div>
      <div class="timer-exercise-name">Ready to work</div>
      <button class="primary-btn big" data-action="${doneAction}">Begin Workout</button>
    `;
    return;
  }

  const skipAllHtml = App.warmupSkipAllAction
    ? `<button class="small-btn" data-action="${App.warmupSkipAllAction}">Skip warm-up</button>`
    : '';

  const step = steps[stepIndex];
  const total = steps.length;

  if (step.type === 'work') {
    AudioCue.cue();
    focusEl.innerHTML = `
      <div class="timer-phase-label">Work</div>
      <div class="timer-exercise-name">${escapeHtml(step.exercise)}</div>
      <div class="timer-countdown" id="warmup-countdown">${step.seconds}</div>
      <div class="timer-sub">Exercise ${step.index + 1} of ${Math.ceil(total / 2)}</div>
      <div class="timer-controls">
        <button class="small-btn" data-action="skip-warmup-step">Skip</button>
        ${skipAllHtml}
      </div>
    `;
  } else {
    AudioCue.restCue();
    const nextLabel = step.nextExercise ? `Next: ${step.nextExercise}` : 'Next: Begin Workout';
    focusEl.innerHTML = `
      <div class="timer-phase-label rest">Rest</div>
      <div class="timer-exercise-name">${escapeHtml(nextLabel)}</div>
      <div class="timer-countdown" id="warmup-countdown">${step.seconds}</div>
      <div class="timer-sub">Exercise ${step.index + 1} of ${Math.ceil(total / 2)}</div>
      <div class="timer-controls">
        <button class="small-btn" data-action="skip-warmup-step">Skip</button>
        ${skipAllHtml}
      </div>
    `;
  }

  const countdownEl = document.getElementById('warmup-countdown');
  const countdown = createCountdown(
    step.seconds,
    (remaining) => { if (countdownEl) countdownEl.textContent = remaining; },
    () => runWarmupSteps(steps, stepIndex + 1, doneAction)
  );
  countdown.start();

  App.currentWarmupSkip = () => countdown.skipToEnd();
}

// ---------------------------------------------------------------------
// Screen: Workout
// ---------------------------------------------------------------------

function renderWorkoutBlock(block, blockIndex) {
  const labelHtml = block.label ? `<h3>${escapeHtml(block.label)}</h3>` : '';
  const noteHtml = renderBlockNoteHtml(block);
  const restBtnHtml = block.restSeconds
    ? `<button class="rest-btn" data-action="start-rest" data-rest="${block.restSeconds}" data-restid="rest-${blockIndex}">Start Rest (${block.restSeconds}s)</button>
       <div id="rest-${blockIndex}"></div>`
    : '';

  if (block.type === 'straight_sets') {
    const repsText = (block.reps === null || block.reps === undefined || block.reps === '')
      ? ''
      : `${escapeHtml(block.reps)} reps`;
    const rows = [];
    for (let s = 1; s <= block.sets; s++) {
      rows.push(`
        <label class="set-row">
          <input type="checkbox" class="set-checkbox" />
          <span>Set ${s}${repsText ? ' — ' + repsText : ''}</span>
        </label>
      `);
    }
    return `
      <section class="block">
        ${labelHtml}
        <div class="exercise-name">${escapeHtml(block.exercise)}</div>
        <div class="exercise-meta">${block.sets} sets${repsText ? ' × ' + repsText : ''}</div>
        ${noteHtml}
        <div class="set-checklist">${rows.join('')}</div>
        ${restBtnHtml}
      </section>
    `;
  }

  if (block.type === 'circuit') {
    const rounds = [];
    for (let r = 1; r <= block.rounds; r++) {
      const exRows = (block.exercises || []).map((ex) => `
        <label class="set-row">
          <input type="checkbox" class="set-checkbox" />
          <span>${escapeHtml(ex)}</span>
        </label>
      `).join('');
      rounds.push(`
        <div class="round-group">
          <div class="round-title">Round ${r} of ${block.rounds}</div>
          ${exRows}
        </div>
      `);
    }
    return `
      <section class="block">
        ${labelHtml}
        ${noteHtml}
        <div class="circuit-rounds">${rounds.join('')}</div>
        ${restBtnHtml}
      </section>
    `;
  }

  if (block.type === 'emom') {
    return `
      <section class="block" data-emom-block="${blockIndex}">
        ${labelHtml}
        ${noteHtml}
        <div class="emom-status" id="emom-status-${blockIndex}">
          <button class="primary-btn" data-action="start-emom" data-block="${blockIndex}">
            Start EMOM (${block.totalMinutes} min)
          </button>
        </div>
      </section>
    `;
  }

  return `<section class="block"><em>Unknown block type: ${escapeHtml(block.type)}</em></section>`;
}

function renderWorkout() {
  WakeLockCtl.acquire();

  const day = getActiveDay();

  const blocksHtml = day.blocks.map((block, i) => renderWorkoutBlock(block, i)).join('');
  const closerHtml = day.closer ? `<div class="closer-note">${escapeHtml(day.closer)}</div>` : '';

  screenEl.innerHTML = `
    <div class="topbar">
      <button class="link-btn" data-action="exit-workout">&lsaquo; Exit</button>
      <span></span>
    </div>
    <h1>${escapeHtml(day.name)}</h1>
    ${renderProgressionCueHtml(day)}
    ${blocksHtml}
    ${closerHtml}
    <div class="workout-footer">
      <div class="stopwatch-bar" id="stopwatch-display">0:00</div>
      <button class="primary-btn big" data-action="finish-workout">Finish Workout</button>
    </div>
  `;

  const display = document.getElementById('stopwatch-display');
  const tickDisplay = () => { if (display) display.textContent = formatDuration(App.stopwatch.getElapsed()); };
  App.stopwatchDisplayInterval = TimerRegistry.track(setInterval(tickDisplay, 1000));
  tickDisplay();
}

function beginWorkout() {
  resetTransientState();
  App.stopwatch = createStopwatch();
  App.stopwatch.start();
  renderWorkout();
}

function handleSetCheckboxChange(checkbox) {
  const row = checkbox.closest('.set-row');
  if (row) row.classList.toggle('checked', checkbox.checked);
}

function startRestTimer(button) {
  const seconds = parseInt(button.dataset.rest, 10);
  const targetId = button.dataset.restid;
  const container = document.getElementById(targetId);
  if (!container) return;

  button.disabled = true;
  const originalText = button.textContent;
  AudioCue.restCue();

  const countdown = createCountdown(
    seconds,
    (remaining) => { container.textContent = remaining > 0 ? `Rest: ${remaining}s` : ''; },
    () => {
      AudioCue.doneCue();
      button.disabled = false;
      button.textContent = originalText;
      container.textContent = '';
    }
  );
  countdown.start();
}

// The one EMOM runner, used by program days and by 20-Min Workouts.
// Draws into statusEl: "Minute N of M", the current exercise, a 60s
// countdown, and a "Next exercise" line that is visible from second 0 of
// every minute (the whole minute -> exercise list is built up front by
// buildEmomSchedule). In the last 10s of a minute the Next line is
// highlighted. In the last minute the Next line says "Next: <afterLabel>"
// (the next block, if the EMOM is part of a longer session) or
// "Next: Finish".
// Time comes from the clock (Date.now), not from counting ticks, so the
// timer stays correct even if the phone throttles it for a moment.
function runEmom(block, statusEl, { afterLabel = null, onDone = null } = {}) {
  const schedule = buildEmomSchedule(block);
  const totalMinutes = block.totalMinutes;
  const totalSeconds = totalMinutes * 60;
  const startMs = Date.now();

  statusEl.innerHTML = `
    <div class="emom-minute"></div>
    <div class="emom-exercise"></div>
    <div class="emom-countdown"></div>
    <div class="emom-next"></div>
  `;
  const minuteEl = statusEl.querySelector('.emom-minute');
  const exerciseEl = statusEl.querySelector('.emom-exercise');
  const countdownEl = statusEl.querySelector('.emom-countdown');
  const nextEl = statusEl.querySelector('.emom-next');

  function nextText(minuteNum) {
    if (minuteNum >= totalMinutes) {
      return afterLabel ? `Next: ${afterLabel}` : 'Next: Finish';
    }
    return `Next exercise: ${schedule[minuteNum]}`;
  }

  let shownMinute = 0;
  let shownSeconds = -1;

  function tick() {
    const elapsed = Math.floor((Date.now() - startMs) / 1000);

    if (elapsed >= totalSeconds) {
      clearInterval(intervalId);
      TimerRegistry.ids.delete(intervalId);
      AudioCue.doneCue();
      statusEl.innerHTML = `<div class="emom-done">EMOM complete ✓</div>`;
      if (onDone) onDone();
      return;
    }

    const minuteNum = Math.floor(elapsed / 60) + 1;
    if (minuteNum !== shownMinute) {
      if (shownMinute !== 0) AudioCue.cue();
      shownMinute = minuteNum;
      minuteEl.textContent = `Minute ${minuteNum} of ${totalMinutes}`;
      exerciseEl.textContent = schedule[minuteNum - 1];
      nextEl.textContent = nextText(minuteNum);
    }

    const secondsLeft = 60 - (elapsed % 60);
    if (secondsLeft !== shownSeconds) {
      shownSeconds = secondsLeft;
      countdownEl.textContent = secondsLeft;
      nextEl.classList.toggle('urgent', secondsLeft <= 10);
    }
  }

  AudioCue.doneCue();
  const intervalId = TimerRegistry.track(setInterval(tick, 250));
  tick();
}

// Program-day wrapper: finds the block and what comes after it.
function startEmomTimer(button) {
  const blockIndex = parseInt(button.dataset.block, 10);
  const day = getActiveDay();
  const block = day.blocks[blockIndex];
  const statusEl = document.getElementById('emom-status-' + blockIndex);
  if (!statusEl || !block) return;

  const nextBlock = day.blocks[blockIndex + 1];
  runEmom(block, statusEl, {
    afterLabel: nextBlock ? (nextBlock.label || nextBlock.exercise || 'next block') : null
  });
}

// ---------------------------------------------------------------------
// Screen: Finish summary
// ---------------------------------------------------------------------

function finishWorkout() {
  App.stopwatch.stop();
  const durationSeconds = App.stopwatch.getElapsed();

  const week = getActiveWeek();
  const day = getActiveDay();

  Storage.addHistoryEntry({
    program: App.activeProgram.program.name,
    programFile: App.activeFile,
    week: week.week,
    day: day.day,
    dayName: day.name,
    date: new Date().toISOString(),
    durationSeconds
  });

  let nextDayIndex = App.dayIndex + 1;
  let nextWeekIndex = App.weekIndex;
  if (nextDayIndex >= week.days.length) {
    nextDayIndex = 0;
    nextWeekIndex += 1;
  }

  App.weekIndex = nextWeekIndex;
  App.dayIndex = nextDayIndex;
  Storage.setPosition(App.activeFile, { weekIndex: nextWeekIndex, dayIndex: nextDayIndex });

  renderFinishSummary(durationSeconds);
}

function renderFinishSummary(durationSeconds) {
  resetTransientState();
  screenEl.innerHTML = `
    <div class="summary-card">
      <div class="big-check">✅</div>
      <h2>Workout complete</h2>
      <div class="summary-duration">${formatDuration(durationSeconds)}</div>
      <p>Nice work.</p>
    </div>
    <button class="primary-btn big" data-action="go-day">Continue</button>
  `;
}

// ---------------------------------------------------------------------
// Screen: History
// ---------------------------------------------------------------------

// kind: 'program' (default) or '20min'. The two lists are stored separately
// so 20-min sessions never mix into program progress.
function renderHistory(kind = 'program') {
  resetTransientState();
  const history = Storage.getHistory();

  const tabsHtml = App.twentyMin
    ? `<div class="tab-row">
         <button class="tab-btn ${kind === 'program' ? 'active' : ''}" data-action="history-tab" data-kind="program">Program</button>
         <button class="tab-btn ${kind === '20min' ? 'active' : ''}" data-action="history-tab" data-kind="20min">20-Min</button>
       </div>`
    : '';

  const rowsHtml = kind === '20min'
    ? render20MinHistoryRows()
    : history.length === 0
    ? `<div class="empty-state">No workouts logged yet.</div>`
    : `<div class="history-list">${history.map((entry) => {
        const date = new Date(entry.date);
        const dateStr = isNaN(date.getTime()) ? entry.date : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        return `
          <div class="history-row">
            <div>
              <div class="history-row-main">${escapeHtml(entry.program)}</div>
              <div class="history-row-meta">${dateStr} · Week ${escapeHtml(entry.week)}, ${escapeHtml(entry.day)}${entry.dayName ? ' — ' + escapeHtml(entry.dayName) : ''}</div>
            </div>
            <div class="history-row-duration">${formatDuration(entry.durationSeconds)}</div>
          </div>
        `;
      }).join('')}</div>`;

  screenEl.innerHTML = `
    <div class="topbar">
      <button class="link-btn" data-action="go-back-from-history">&lsaquo; Back</button>
      <span></span>
    </div>
    <h1>History</h1>
    ${tabsHtml}
    ${rowsHtml}
  `;
}

// ---------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------

function goPicker() {
  renderPicker();
}

function goDay() {
  renderDay();
}

function goHistory() {
  App.historyFrom = null;
  renderHistory();
}

function goBackFromHistory() {
  if (App.historyFrom === '20min') {
    render20MinHome();
  } else if (App.activeProgram) {
    renderDay();
  } else {
    renderPicker();
  }
}

function startDay() {
  const week = getActiveWeek();
  if (week.phase === 'Deload') {
    // Deload weeks skip the warm-up protocol entirely (see programs/README.md).
    beginWorkout();
  } else {
    renderWarmup();
  }
}

// ---------------------------------------------------------------------
// Event delegation
// ---------------------------------------------------------------------

screenEl.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  switch (action) {
    case 'select-program':
      selectProgram(actionEl.dataset.file);
      break;
    case 'go-picker':
      goPicker();
      break;
    case 'go-history':
      goHistory();
      break;
    case 'go-back-from-history':
      goBackFromHistory();
      break;
    case 'go-day':
      goDay();
      break;
    case 'start-day':
      startDay();
      break;
    case 'jump-go':
      jumpToSelection();
      break;
    case 'restart-program':
      restartProgram();
      break;
    case 'exit-warmup':
      renderDay();
      break;
    case 'skip-warmup-step':
      if (App.currentWarmupSkip) App.currentWarmupSkip();
      break;
    case 'begin-workout':
      beginWorkout();
      break;
    case 'exit-workout':
      if (App.stopwatch) App.stopwatch.stop();
      renderDay();
      break;
    case 'start-rest':
      startRestTimer(actionEl);
      break;
    case 'start-emom':
      startEmomTimer(actionEl);
      break;
    case 'finish-workout':
      finishWorkout();
      break;
    case 'history-tab':
      renderHistory(actionEl.dataset.kind);
      break;
    default:
      // 20-Min Workouts screens (js/twenty-min.js) handle their own actions.
      handleTwentyMinAction(action, actionEl);
      break;
  }
});

screenEl.addEventListener('change', (e) => {
  if (e.target.matches('input.set-checkbox')) {
    handleSetCheckboxChange(e.target);
  }
});

boot();
