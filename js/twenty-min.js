// twenty-min.js — the "20-Min Workouts" section: a small library of
// standalone workouts (workouts/twenty_min_workouts.json) that is completely
// separate from the program. It never reads or advances the program's
// week/day, and logs to its own history list (see storage.js).
//
// Flow: home (up next + all workouts) -> preview -> optional warm-up ->
// run (EMOM guide or AMRAP counter) -> log result -> summary.
//
// Everything here runs at click time, after app.js has loaded, so it can
// freely use App, screenEl, escapeHtml, renderWarmup, runEmom, etc.

function twentyMinWorkouts() {
  return App.twentyMin.workouts;
}

function findTwentyMinWorkout(id) {
  return twentyMinWorkouts().find((w) => w.id === id);
}

// The suggestion: the workout stored as "up next", or the first one.
function getSuggestedWorkout() {
  const list = twentyMinWorkouts();
  return list.find((w) => w.id === Storage.getNext20Id()) || list[0];
}

// The fixed rotation is just the order of the "workouts" array.
function workoutAfter(workout) {
  const list = twentyMinWorkouts();
  const i = list.findIndex((w) => w.id === workout.id);
  return list[(i + 1) % list.length];
}

function twentyMinFormat(block) {
  return `${block.type.toUpperCase()} ${block.totalMinutes}`;
}

// "7 rounds + 4 reps" / "completed" / "stopped early"
function twentyMinResultText(entry) {
  if (entry.rounds !== undefined) {
    const extra = entry.extraReps ? ` + ${entry.extraReps} reps` : '';
    return `${entry.rounds} round${entry.rounds === 1 ? '' : 's'}${extra}`;
  }
  return entry.completed ? 'completed' : 'stopped early';
}

// ---------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------

function twentyMinCardHtml(w, isNext) {
  return `
    <button class="program-card ${isNext ? 'active' : ''}" data-action="open-20min" data-id="${escapeHtml(w.id)}">
      ${isNext ? '<div class="program-card-badge">Up next</div>' : ''}
      <div class="program-card-name">${escapeHtml(w.name)}</div>
      <div class="program-card-meta">${escapeHtml(w.subtitle || twentyMinFormat(w.block))}</div>
    </button>
  `;
}

function render20MinHome() {
  resetTransientState();
  const list = twentyMinWorkouts();
  const suggested = getSuggestedWorkout();
  const rotation = list.concat(list[0]).map((w) => w.name).join(' → ');
  const others = list.filter((w) => w.id !== suggested.id).map((w) => twentyMinCardHtml(w, false)).join('');

  screenEl.innerHTML = `
    <div class="topbar">
      <button class="link-btn" data-action="go-picker">&lsaquo; Home</button>
      <button class="link-btn" data-action="open-20min-history">History</button>
    </div>
    <h1>${escapeHtml(App.twentyMin.section.name)}</h1>
    <p class="subtitle">Separate from your program. Rotation: ${escapeHtml(rotation)}</p>
    <div class="program-list">${twentyMinCardHtml(suggested, true)}</div>
    <h3>Or choose another</h3>
    <div class="program-list">${others}</div>
  `;
}

// ---------------------------------------------------------------------
// Preview + optional warm-up
// ---------------------------------------------------------------------

function render20MinPreview(id) {
  resetTransientState();
  const w = findTwentyMinWorkout(id);
  if (!w) {
    render20MinHome();
    return;
  }
  App.twentyMinId = id;

  screenEl.innerHTML = `
    <div class="topbar">
      <button class="link-btn" data-action="go-20min-home">&lsaquo; 20-Min Workouts</button>
      <span></span>
    </div>
    <h1>${escapeHtml(w.name)}</h1>
    <p class="subtitle">${escapeHtml(w.subtitle || '')}</p>
    ${renderPreviewBlock(w.block)}
    <button class="primary-btn big" data-action="start-20min-warmup">Warm up first (~6 min)</button>
    <button class="secondary-btn" data-action="skip-20min-warmup">Skip warm-up &mdash; go to workout</button>
  `;
}

// Uses the warm-up of the program named in the data file (Iron Foundations
// v4), through the same warm-up timer the program uses.
async function startTwentyMinWarmup() {
  let exercises = null;
  try {
    const file = App.twentyMin.section.warmupFromProgram;
    let program = App.programs.find((p) => p.__file === file);
    if (!program) program = await Programs.loadProgramFile(file);
    exercises = buildWarmupExercises(null, program);
  } catch (err) {
    console.error('Could not load the warm-up:', err);
  }
  if (!exercises || exercises.length === 0) {
    render20MinRun();
    return;
  }
  renderWarmup({
    exercises,
    doneAction: 'begin-20min',
    exitAction: 'exit-20min-warmup',
    skipAllAction: 'skip-20min-warmup'
  });
}

// ---------------------------------------------------------------------
// Run: EMOM guide / AMRAP counter
// ---------------------------------------------------------------------

function render20MinRun() {
  resetTransientState();
  WakeLockCtl.acquire();

  const w = findTwentyMinWorkout(App.twentyMinId);
  const block = w.block;
  const isAmrap = block.type === 'amrap';
  App.run20 = { workout: w, started: false, startedAt: null, completed: false, rounds: 0 };

  const labelHtml = block.label ? `<h3>${escapeHtml(block.label)}</h3>` : '';
  const noteHtml = renderBlockNoteHtml(block);
  let bodyHtml;
  let footerHtml;

  if (isAmrap) {
    const items = (block.exercises || []).map((ex) => `<li>${escapeHtml(ex)}</li>`).join('');
    bodyHtml = `
      <section class="block">
        ${labelHtml}
        ${noteHtml}
        <div class="amrap-timer" id="amrap-timer">${formatDuration(block.totalMinutes * 60)}</div>
        <div class="amrap-status" id="amrap-status"></div>
        <button class="primary-btn big" id="run20-start" data-action="start-20min-timer">Start AMRAP (${block.totalMinutes} min)</button>
        <ol class="amrap-list">${items}</ol>
      </section>
    `;
    footerHtml = `
      <div class="workout-footer">
        <div class="amrap-count"><span id="amrap-rounds">0</span> rounds</div>
        <button class="primary-btn big amrap-plus" id="amrap-plus" data-action="amrap-plus" disabled>+1 round</button>
        <div class="footer-row">
          <button class="small-btn" id="amrap-minus" data-action="amrap-minus" disabled>Undo (&minus;1)</button>
          <button class="small-btn" data-action="finish-20min">Finish &amp; log</button>
        </div>
      </div>
    `;
  } else {
    bodyHtml = `
      <section class="block">
        ${labelHtml}
        ${noteHtml}
        <div class="emom-status emom-big" id="run20-status">
          <button class="primary-btn big" data-action="start-20min-timer">Start ${escapeHtml(twentyMinFormat(block))} (${block.totalMinutes} min)</button>
        </div>
      </section>
    `;
    footerHtml = `
      <div class="workout-footer">
        <button class="secondary-btn" data-action="finish-20min">Finish &amp; log result</button>
      </div>
    `;
  }

  screenEl.innerHTML = `
    <div class="topbar">
      <button class="link-btn" data-action="exit-20min">&lsaquo; Exit</button>
      <span></span>
    </div>
    <h1>${escapeHtml(w.name)}</h1>
    ${bodyHtml}
    ${footerHtml}
  `;
}

function startTwentyMinTimer() {
  const s = App.run20;
  if (!s || s.started) return;
  s.started = true;
  s.startedAt = Date.now();
  const block = s.workout.block;

  if (block.type === 'amrap') {
    document.getElementById('run20-start').remove();
    document.getElementById('amrap-plus').disabled = false;
    document.getElementById('amrap-minus').disabled = false;
    runAmrap(block, () => { s.completed = true; });
  } else {
    runEmom(block, document.getElementById('run20-status'), {
      onDone: () => { s.completed = true; }
    });
  }
}

// Counts down block.totalMinutes (clock-based, like runEmom). The round
// counter is a plain number on App.run20, changed by amrapAdjust.
function runAmrap(block, onDone) {
  const timerEl = document.getElementById('amrap-timer');
  const statusEl = document.getElementById('amrap-status');
  const totalSeconds = block.totalMinutes * 60;
  const startMs = Date.now();
  let shownLeft = -1;

  function tick() {
    const elapsed = Math.floor((Date.now() - startMs) / 1000);
    const left = Math.max(0, totalSeconds - elapsed);
    if (left !== shownLeft) {
      shownLeft = left;
      timerEl.textContent = formatDuration(left);
      timerEl.classList.toggle('urgent', left > 0 && left <= 10);
    }
    if (left === 0) {
      clearInterval(intervalId);
      TimerRegistry.ids.delete(intervalId);
      AudioCue.doneCue();
      timerEl.classList.add('done');
      statusEl.textContent = "Time! Finish & log your rounds.";
      onDone();
    }
  }

  AudioCue.doneCue();
  const intervalId = TimerRegistry.track(setInterval(tick, 250));
  tick();
}

function amrapAdjust(delta) {
  const s = App.run20;
  if (!s || !s.started) return;
  s.rounds = Math.max(0, s.rounds + delta);
  document.getElementById('amrap-rounds').textContent = s.rounds;
  if (delta > 0 && navigator.vibrate) navigator.vibrate(30);
}

function exitTwentyMin() {
  const s = App.run20;
  if (s && s.started && !window.confirm('Leave without logging this workout?')) return;
  render20MinPreview(App.twentyMinId);
}

function finishTwentyMin() {
  const s = App.run20;
  if (!s) return;
  if (!s.started) {
    exitTwentyMin();
    return;
  }
  if (!s.completed && !window.confirm('The timer is still running. Finish and log now?')) return;
  render20MinResult();
}

// ---------------------------------------------------------------------
// Log result + summary
// ---------------------------------------------------------------------

function render20MinResult() {
  const s = App.run20;
  const w = s.workout;
  const block = w.block;
  const totalSeconds = block.totalMinutes * 60;
  s.durationSeconds = s.completed
    ? totalSeconds
    : Math.min(totalSeconds, Math.floor((Date.now() - s.startedAt) / 1000));
  resetTransientState();

  const resultFields = block.type === 'amrap'
    ? `
      <label class="field-label" for="res-rounds">Rounds completed</label>
      <input class="field-input" id="res-rounds" type="number" inputmode="numeric" min="0" value="${s.rounds}" />
      <label class="field-label" for="res-extra">Extra reps in the unfinished round (optional)</label>
      <input class="field-input" id="res-extra" type="number" inputmode="numeric" min="0" placeholder="0" />
    `
    : `<p class="subtitle">${s.completed
        ? `Completed all ${block.totalMinutes} minutes.`
        : `Stopped early at ${formatDuration(s.durationSeconds)}.`}</p>`;

  screenEl.innerHTML = `
    <h1>Log result</h1>
    <p class="subtitle">${escapeHtml(w.name)} · ${escapeHtml(twentyMinFormat(block))} · ${formatDuration(s.durationSeconds)}</p>
    ${resultFields}
    <label class="field-label" for="res-notes">Notes (optional)</label>
    <textarea class="field-input" id="res-notes" rows="3" placeholder="Weights used, how it felt..."></textarea>
    <button class="primary-btn big" data-action="save-20min-result">Save result</button>
    <button class="secondary-btn" data-action="discard-20min">Don't log this workout</button>
  `;
}

function saveTwentyMinResult() {
  const s = App.run20;
  if (!s) return;
  const w = s.workout;
  const block = w.block;

  const entry = {
    workoutId: w.id,
    name: w.name,
    format: twentyMinFormat(block),
    date: new Date().toISOString(),
    durationSeconds: s.durationSeconds,
    completed: s.completed
  };

  if (block.type === 'amrap') {
    entry.rounds = Math.max(0, parseInt(document.getElementById('res-rounds').value, 10) || 0);
    const extra = parseInt(document.getElementById('res-extra').value, 10);
    if (extra > 0) entry.extraReps = extra;
  }
  const notes = document.getElementById('res-notes').value.trim();
  if (notes) entry.notes = notes;

  Storage.addHistory20(entry);
  // The suggestion only moves on when a workout was actually completed
  // (timer ran out), and it continues from the workout just done -- so if
  // you picked a different one than suggested, the rotation carries on
  // from there.
  if (s.completed) Storage.setNext20Id(workoutAfter(w).id);

  App.run20 = null;
  render20MinSummary(entry);
}

function render20MinSummary(entry) {
  resetTransientState();
  screenEl.innerHTML = `
    <div class="summary-card">
      <div class="big-check">✅</div>
      <h2>${escapeHtml(entry.name)} logged</h2>
      <div class="summary-duration">${formatDuration(entry.durationSeconds)}</div>
      <p>${escapeHtml(entry.format)} · ${escapeHtml(twentyMinResultText(entry))}</p>
      <p>Up next: <strong>${escapeHtml(getSuggestedWorkout().name)}</strong></p>
    </div>
    <button class="primary-btn big" data-action="go-20min-home">Back to 20-Min Workouts</button>
  `;
}

function render20MinHistoryRows() {
  const history = Storage.getHistory20();
  if (history.length === 0) {
    return `<div class="empty-state">No 20-min workouts logged yet.</div>`;
  }
  return `<div class="history-list">${history.map((entry) => {
    const date = new Date(entry.date);
    const dateStr = isNaN(date.getTime())
      ? entry.date
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const notesHtml = entry.notes ? `<div class="history-row-meta">${escapeHtml(entry.notes)}</div>` : '';
    return `
      <div class="history-row">
        <div>
          <div class="history-row-main">${escapeHtml(entry.name)} <span class="history-tag">20-MIN</span></div>
          <div class="history-row-meta">${dateStr} · ${escapeHtml(entry.format)} · ${escapeHtml(twentyMinResultText(entry))}</div>
          ${notesHtml}
        </div>
        <div class="history-row-duration">${formatDuration(entry.durationSeconds)}</div>
      </div>
    `;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------------
// Click actions (called from the delegated handler in app.js)
// ---------------------------------------------------------------------

function handleTwentyMinAction(action, el) {
  switch (action) {
    case 'go-20min-home':
      render20MinHome();
      break;
    case 'open-20min':
      render20MinPreview(el.dataset.id);
      break;
    case 'start-20min-warmup':
      startTwentyMinWarmup();
      break;
    case 'skip-20min-warmup':
    case 'begin-20min':
      render20MinRun();
      break;
    case 'exit-20min-warmup':
      render20MinPreview(App.twentyMinId);
      break;
    case 'start-20min-timer':
      startTwentyMinTimer();
      break;
    case 'amrap-plus':
      amrapAdjust(1);
      break;
    case 'amrap-minus':
      amrapAdjust(-1);
      break;
    case 'exit-20min':
      exitTwentyMin();
      break;
    case 'finish-20min':
      finishTwentyMin();
      break;
    case 'save-20min-result':
      saveTwentyMinResult();
      break;
    case 'discard-20min':
      if (window.confirm('Nothing will be logged. Discard this workout?')) {
        App.run20 = null;
        render20MinHome();
      }
      break;
    case 'open-20min-history':
      App.historyFrom = '20min';
      renderHistory('20min');
      break;
    default:
      break;
  }
}
