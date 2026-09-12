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
    return programs;
  }
};
