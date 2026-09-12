// storage.js — all localStorage access lives here.
// Everything is namespaced under "stt_" so this app never collides with
// anything else that might use localStorage on the same device.

const StorageKeys = {
  activeProgram: 'stt_activeProgram',
  positions: 'stt_positions',
  history: 'stt_history'
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
  }
};
