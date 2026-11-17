// programs.js — loads the list of programs from programs/manifest.json,
// then loads each program's JSON data file. This is the only code that
// needs to know the file layout of the /programs folder; adding a new
// program never requires changing this file (see programs/README.md).

const Programs = {
  async loadManifest() {
    const res = await fetch('programs/manifest.json', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Could not load programs/manifest.json (HTTP ' + res.status + ')');
    }
    const data = await res.json();
    if (!Array.isArray(data.programs)) {
      throw new Error('programs/manifest.json is missing a "programs" array');
    }
    return data.programs;
  },

  async loadProgramFile(filename) {
    const res = await fetch('programs/' + filename, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Could not load programs/' + filename + ' (HTTP ' + res.status + ')');
    }
    const data = await res.json();
    data.__file = filename;
    return data;
  },

  // The 20-Min Workouts library (workouts/twenty_min_workouts.json). Loaded
  // at boot so it gets cached for offline use on first visit. Returns null
  // on any failure -- the rest of the app works fine without it.
  async loadTwentyMin() {
    try {
      const res = await fetch('workouts/twenty_min_workouts.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data.workouts) && data.workouts.length > 0 ? data : null;
    } catch (err) {
      console.error('Could not load 20-Min Workouts:', err);
      return null;
    }
  },

  // Loads every program listed in the manifest. Programs that fail to load
  // (bad JSON, missing file) are skipped with a console warning rather than
  // breaking the whole picker screen.
  async loadAll() {
    const filenames = await this.loadManifest();
    const programs = [];
    for (const filename of filenames) {
      try {
        programs.push(await this.loadProgramFile(filename));
      } catch (err) {
        console.error('Skipping program file "' + filename + '":', err);
      }
    }
    await this.resolveBorrowedWarmups(programs);
    return programs;
  },

  // A program can reuse another program's warm-up instead of repeating it:
  //   "warmup": { "fromProgram": "iron_foundations_v4_data.json" }
  // That program doesn't have to be listed in the manifest (archived ones
  // work). Only the in-memory copy is changed; no file is touched.
  async resolveBorrowedWarmups(programs) {
    for (const program of programs) {
      const from = program.warmup && program.warmup.fromProgram;
      if (!from) continue;
      try {
        const source = programs.find((p) => p.__file === from) || await this.loadProgramFile(from);
        program.warmup = Object.assign({}, source.warmup);
      } catch (err) {
        console.error('Could not borrow the warm-up from "' + from + '":', err);
        program.warmup = {};
      }
    }
  }
};
