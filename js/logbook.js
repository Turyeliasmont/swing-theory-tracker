// logbook.js — per-exercise logging for blocks that opt in with "log": true.
// (Everything here is opt-in: blocks without "log" render exactly as before.)
//
// Block fields:
//   log: true            straight_sets / circuit: a done checkbox + reps/load
//                        inputs for every set / round. emom: a "Completed"
//                        checkbox + optional total reps.
//   track: [...]         which inputs to show, from "reps" and "load".
//                        Default both; [] = only the checkbox / variant choice.
//   options: [{name, detail}]
//                        straight_sets only: pick ONE variant for the block.
// Circuit exercise entries may be an object instead of a string:
//   { "options": [{name, detail}], "target": "6-12", "label": "..." }
//   -> a variant choice in every round (chosen variant is saved with the set).
//
// What gets saved (Storage.getBlockLog / setBlockLog), per week/day/block:
//   { choice: "name",            // straight_sets block-level variant
//     done: true, reps: "87",    // emom only
//     cells: { "<round>.<entry>": { done, reps, load, unit, choice } } }
// Each block shows last week's value for the same set/round, taken from the
// nearest earlier week that has a log for that day and block.
//
// Runs at click time, after app.js has loaded, so it can use App,
// escapeHtml, getActiveDay, etc.

// Text for one circuit exercise entry (string, or object with options).
function exerciseText(entry) {
  if (typeof entry === 'string') return entry;
  const options = entry.options || [];
  const base = entry.label || options.map((o) => o.name).join(' or ');
  return entry.target ? `${base} — ${entry.target}` : base;
}

function logTrack(block) {
  return Array.isArray(block.track) ? block.track : ['reps', 'load'];
}

function readBlockLog(blockIndex) {
  return Storage.getBlockLog(App.activeFile, App.weekIndex, App.dayIndex, blockIndex);
}

function writeBlockLog(blockIndex, log) {
  Storage.setBlockLog(App.activeFile, App.weekIndex, App.dayIndex, blockIndex, log);
}

function logCellHasData(cell) {
  return !!(cell && (cell.done || cell.reps || cell.load || cell.choice));
}

function logHasData(log) {
  return !!(log && (log.done || log.reps || Object.values(log.cells || {}).some(logCellHasData)));
}

// The nearest earlier week with a log for this same day and block.
function findPreviousBlockLog(blockIndex) {
  for (let w = App.weekIndex - 1; w >= 0; w--) {
    const log = Storage.getBlockLog(App.activeFile, w, App.dayIndex, blockIndex);
    if (logHasData(log)) {
      return { weekNumber: App.activeProgram.weeks[w].week, log };
    }
  }
  return null;
}

// "12 @ 20 kg", "20 kg", "12 reps", "Gorilla Rows: 10 @ 22.5 kg", "done"
function describeLogCell(cell) {
  const unit = cell.unit || '';
  let text = '';
  if (cell.reps && cell.load) text = `${cell.reps} @ ${cell.load} ${unit}`.trim();
  else if (cell.reps) text = `${cell.reps} reps`;
  else if (cell.load) text = `${cell.load} ${unit}`.trim();
  else if (cell.done && !cell.choice) text = 'done';
  if (cell.choice) return text ? `${cell.choice}: ${text}` : cell.choice;
  return text;
}

function lastWeekHtml(prev, text) {
  return prev && text
    ? `<div class="last-week">Last week (W${escapeHtml(prev.weekNumber)}): ${escapeHtml(text)}</div>`
    : '';
}

function pillHtml(option, active, action) {
  return `<button type="button" class="pill${active ? ' active' : ''}" data-action="${action}" data-name="${escapeHtml(option.name)}" data-detail="${escapeHtml(option.detail || '')}">${escapeHtml(option.name)}</button>`;
}

// One set / round row: done checkbox, optional variant pills, inputs, and
// last week's value for the same row.
function logRowHtml({ key, text, cell, prev, track, options }) {
  cell = cell || {};
  const unit = cell.load ? (cell.unit || Storage.getUnit()) : Storage.getUnit();
  const prevCell = prev && prev.log.cells && prev.log.cells[key];

  let pillsHtml = '';
  if (options) {
    const chosen = options.find((o) => o.name === cell.choice) || options[0];
    pillsHtml = `
      <div class="pill-row">${options.map((o) => pillHtml(o, o.name === chosen.name, 'log-entry-choice')).join('')}</div>
      <div class="option-detail">${escapeHtml(chosen.detail || '')}</div>`;
  }

  const inputs = [];
  if (track.includes('reps')) {
    inputs.push(`<div class="log-field"><input class="log-input" data-field="reps" type="text" inputmode="numeric" placeholder="reps" value="${escapeHtml(cell.reps || '')}" aria-label="Reps"><span class="field-suffix">reps</span></div>`);
  }
  if (track.includes('load')) {
    inputs.push(`<div class="log-field"><input class="log-input" data-field="load" type="text" inputmode="decimal" placeholder="load" value="${escapeHtml(cell.load || '')}" aria-label="Load"><span class="unit-label">${unit}</span></div>`);
  }

  return `
    <div class="log-row${cell.done ? ' checked' : ''}" data-cell="${key}">
      <label class="log-line">
        <input type="checkbox" class="log-done"${cell.done ? ' checked' : ''}>
        <span>${escapeHtml(text)}</span>
      </label>
      ${pillsHtml}
      ${inputs.length ? `<div class="log-inputs">${inputs.join('')}</div>` : ''}
      ${lastWeekHtml(prev, prevCell ? describeLogCell(prevCell) : '')}
    </div>`;
}

// parts = { labelHtml, noteHtml, restBtnHtml } built by renderWorkoutBlock.
function renderLoggedStraightSets(block, blockIndex, parts) {
  const log = readBlockLog(blockIndex);
  const prev = findPreviousBlockLog(blockIndex);
  const track = logTrack(block);

  let headHtml;
  if (block.options) {
    const chosen = block.options.find((o) => o.name === log.choice) || block.options[0];
    headHtml = `
      <div class="pill-row">${block.options.map((o) => pillHtml(o, o.name === chosen.name, 'log-block-choice')).join('')}</div>
      <div class="option-detail">${escapeHtml(chosen.detail || '')}</div>`;
  } else {
    headHtml = `<div class="exercise-name">${escapeHtml(block.exercise)}</div>`;
  }

  const repsText = (block.reps === null || block.reps === undefined || block.reps === '')
    ? ''
    : `${escapeHtml(block.reps)} reps`;
  const rows = [];
  for (let s = 1; s <= block.sets; s++) {
    const key = `${s}.0`;
    rows.push(logRowHtml({
      key,
      text: `Set ${s}${repsText ? ' — ' + repsText : ''}`,
      cell: (log.cells || {})[key],
      prev,
      track
    }));
  }

  return `
    <section class="block" data-log-block="${blockIndex}">
      ${parts.labelHtml}
      ${headHtml}
      <div class="exercise-meta">${plural(block.sets, 'set')}${repsText ? ' × ' + repsText : ''}</div>
      ${parts.noteHtml}
      <div class="set-checklist">${rows.join('')}</div>
      ${parts.restBtnHtml}
    </section>`;
}

function renderLoggedCircuit(block, blockIndex, parts) {
  const log = readBlockLog(blockIndex);
  const prev = findPreviousBlockLog(blockIndex);
  const track = logTrack(block);
  const entries = block.exercises || [];

  const rounds = [];
  for (let r = 1; r <= block.rounds; r++) {
    const rows = entries.map((entry, e) => {
      const key = `${r}.${e}`;
      return logRowHtml({
        key,
        text: exerciseText(entry),
        cell: (log.cells || {})[key],
        prev,
        track,
        options: typeof entry === 'object' ? entry.options : null
      });
    }).join('');
    rounds.push(`
      <div class="round-group">
        <div class="round-title">Round ${r} of ${block.rounds}</div>
        ${rows}
      </div>`);
  }

  return `
    <section class="block" data-log-block="${blockIndex}">
      ${parts.labelHtml}
      ${parts.noteHtml}
      <div class="circuit-rounds">${rounds.join('')}</div>
      ${parts.restBtnHtml}
    </section>`;
}

// Extra controls under an EMOM timer: Completed + optional total reps.
function renderLoggedEmomExtras(block, blockIndex) {
  const log = readBlockLog(blockIndex);
  const prev = findPreviousBlockLog(blockIndex);
  let prevText = '';
  if (prev) {
    const bits = [];
    if (prev.log.done) bits.push('completed');
    if (prev.log.reps) bits.push(`${prev.log.reps} reps`);
    prevText = bits.join(' · ');
  }
  return `
    <div class="log-emom">
      <label class="log-line">
        <input type="checkbox" class="log-emom-done"${log.done ? ' checked' : ''}>
        <span>Completed</span>
      </label>
      <div class="log-inputs">
        <input class="log-input log-emom-reps" type="text" inputmode="numeric" placeholder="Total reps (optional)" value="${escapeHtml(log.reps || '')}" aria-label="Total reps">
      </div>
      ${lastWeekHtml(prev, prevText)}
    </div>`;
}

// ---------------------------------------------------------------------
// Saving (reads the row from the DOM, writes the whole cell)
// ---------------------------------------------------------------------

function saveLogRow(rowEl) {
  const blockEl = rowEl.closest('[data-log-block]');
  const blockIndex = parseInt(blockEl.dataset.logBlock, 10);
  const block = getActiveDay().blocks[blockIndex];
  const log = readBlockLog(blockIndex);
  log.cells = log.cells || {};

  const cell = {};
  if (rowEl.querySelector('.log-done').checked) cell.done = true;
  const reps = rowEl.querySelector('[data-field="reps"]');
  if (reps && reps.value.trim()) cell.reps = reps.value.trim();
  const load = rowEl.querySelector('[data-field="load"]');
  if (load && load.value.trim()) {
    // Spanish keyboards type a comma for decimals.
    cell.load = load.value.trim().replace(',', '.');
    cell.unit = rowEl.querySelector('.unit-label').textContent;
  }
  const activePill = rowEl.querySelector('.pill.active');
  if (activePill) cell.choice = activePill.dataset.name;
  else if (block.options) cell.choice = log.choice || block.options[0].name;

  const hasValues = cell.done || cell.reps || cell.load;
  if (hasValues || activePill) log.cells[rowEl.dataset.cell] = cell;
  else delete log.cells[rowEl.dataset.cell];
  writeBlockLog(blockIndex, log);
}

function saveLogEmom(emomEl) {
  const blockIndex = parseInt(emomEl.closest('[data-log-block]').dataset.logBlock, 10);
  const log = readBlockLog(blockIndex);
  if (emomEl.querySelector('.log-emom-done').checked) log.done = true;
  else delete log.done;
  const reps = emomEl.querySelector('.log-emom-reps').value.trim();
  if (reps) log.reps = reps;
  else delete log.reps;
  writeBlockLog(blockIndex, log);
}

function logContainer(el) {
  return el.closest('.log-row') || el.closest('.log-emom');
}

function saveLogContainer(container) {
  if (container.classList.contains('log-row')) saveLogRow(container);
  else saveLogEmom(container);
}

// Typing in a reps / load field.
function onLogInput(input) {
  const container = logContainer(input);
  if (container) saveLogContainer(container);
}

// Ticking a done / Completed checkbox.
function onLogDoneChange(checkbox) {
  const container = logContainer(checkbox);
  if (!container) return;
  if (container.classList.contains('log-row')) container.classList.toggle('checked', checkbox.checked);
  saveLogContainer(container);
}

// Tapping a variant pill. kind: 'block' (one choice for the whole
// straight_sets block) or 'entry' (a choice for one set / round).
function onLogPill(pill, kind) {
  const row = pill.closest('.pill-row');
  row.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p === pill));

  if (kind === 'block') {
    const blockEl = pill.closest('[data-log-block]');
    const blockIndex = parseInt(blockEl.dataset.logBlock, 10);
    blockEl.querySelector('.option-detail').textContent = pill.dataset.detail;
    const log = readBlockLog(blockIndex);
    log.choice = pill.dataset.name;
    writeBlockLog(blockIndex, log);
  } else {
    const logRow = pill.closest('.log-row');
    logRow.querySelector('.option-detail').textContent = pill.dataset.detail;
    saveLogRow(logRow);
  }
}

// Called when an EMOM timer runs out: tick "Completed" for the user.
function markEmomLogDone(blockIndex) {
  const emomEl = document.querySelector(`[data-log-block="${blockIndex}"] .log-emom`);
  if (!emomEl) return;
  const box = emomEl.querySelector('.log-emom-done');
  if (!box.checked) {
    box.checked = true;
    saveLogEmom(emomEl);
  }
}

// ---------------------------------------------------------------------
// kg / lb
// ---------------------------------------------------------------------

function dayHasLoadLogging(day) {
  return day.blocks.some((b) => b.log && b.type !== 'emom' && logTrack(b).includes('load'));
}

function unitToggleHtml(day) {
  return dayHasLoadLogging(day)
    ? `<button class="link-btn" data-action="toggle-unit">Units: ${Storage.getUnit()}</button>`
    : '<span></span>';
}

// Switches the default unit. Rows that already have a load keep the unit
// they were saved with; empty rows pick up the new one.
function toggleUnit(button) {
  const unit = Storage.getUnit() === 'kg' ? 'lb' : 'kg';
  Storage.setUnit(unit);
  button.textContent = `Units: ${unit}`;
  document.querySelectorAll('.log-row').forEach((row) => {
    const load = row.querySelector('[data-field="load"]');
    if (load && !load.value.trim()) row.querySelector('.unit-label').textContent = unit;
  });
}
