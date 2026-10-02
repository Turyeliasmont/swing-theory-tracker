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
  next20: 'stt_20min_next'
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
  }
};
