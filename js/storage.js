// storage.js — all localStorage access lives here.
// Everything is namespaced under "stt_" so this app never collides with
// anything else that might use localStorage on the same device.

const StorageKeys = {
  activeProgram: 'stt_activeProgram',
  positions: 'stt_positions',
  history: 'stt_history',
  // 20-Min Workouts are separate from the program: their own history list
  // and their own "up next" pointer, so they never touch program progress.
  history20: 'stt_history_20min',
  next20: 'stt_20min_next',
  // Per-exercise logs (reps / load / completed / chosen variant) for blocks
  // with "log": true. Shape: { [programFile]: { [weekIndex]: { [dayIndex]:
  // { [blockIndex]: blockLog } } } } -- see js/logbook.js.
  logs: 'stt_logs',
  unit: 'stt_unit'
};

const Storage = {
  getActiveProgramFile() {
    return localStorage.getItem(StorageKeys.activeProgram);
  },

  setActiveProgramFile(filename) {
    localStorage.setItem(StorageKeys.activeProgram, filename);
  },

  getPositions() {
    try {
      return JSON.parse(localStorage.getItem(StorageKeys.positions) || '{}');
    } catch (e) {
      return {};
    }
  },

  getPosition(filename) {
    const positions = this.getPositions();
    return positions[filename] || { weekIndex: 0, dayIndex: 0 };
  },

  setPosition(filename, position) {
    const positions = this.getPositions();
    positions[filename] = position;
    localStorage.setItem(StorageKeys.positions, JSON.stringify(positions));
  },

  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(StorageKeys.history) || '[]');
    } catch (e) {
      return [];
    }
  },

  addHistoryEntry(entry) {
    const history = this.getHistory();
    history.unshift(entry);
    localStorage.setItem(StorageKeys.history, JSON.stringify(history));
  },

  getHistory20() {
    try {
      return JSON.parse(localStorage.getItem(StorageKeys.history20) || '[]');
    } catch (e) {
      return [];
    }
  },

  addHistory20(entry) {
    const history = this.getHistory20();
    history.unshift(entry);
    localStorage.setItem(StorageKeys.history20, JSON.stringify(history));
  },

  getNext20Id() {
    return localStorage.getItem(StorageKeys.next20);
  },

  setNext20Id(id) {
    localStorage.setItem(StorageKeys.next20, id);
  },

  getAllLogs() {
    try {
      return JSON.parse(localStorage.getItem(StorageKeys.logs) || '{}');
    } catch (e) {
      return {};
    }
  },

  getBlockLog(file, weekIndex, dayIndex, blockIndex) {
    const logs = this.getAllLogs();
    const w = logs[file] && logs[file][weekIndex];
    const d = w && w[dayIndex];
    return (d && d[blockIndex]) || {};
  },

  setBlockLog(file, weekIndex, dayIndex, blockIndex, blockLog) {
    const logs = this.getAllLogs();
    logs[file] = logs[file] || {};
    logs[file][weekIndex] = logs[file][weekIndex] || {};
    logs[file][weekIndex][dayIndex] = logs[file][weekIndex][dayIndex] || {};
    logs[file][weekIndex][dayIndex][blockIndex] = blockLog;
    localStorage.setItem(StorageKeys.logs, JSON.stringify(logs));
  },

  getUnit() {
    return localStorage.getItem(StorageKeys.unit) === 'lb' ? 'lb' : 'kg';
  },

  setUnit(unit) {
    localStorage.setItem(StorageKeys.unit, unit === 'lb' ? 'lb' : 'kg');
  }
};
