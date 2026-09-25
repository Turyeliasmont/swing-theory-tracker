# Programs folder — how to add a new program

This folder holds the workout data. **Adding a new program never requires
touching any app code (the `.html`/`.css`/`.js` files).** You only touch two
things in this folder:

1. Add your new program's JSON data file here (e.g. `spring_block_data.json`).
2. Add its filename to the list in [`manifest.json`](manifest.json).

That's it. The app reads `manifest.json` on startup to find out which program
files exist, then loads each one.

```json
{
  "programs": [
    "iron_foundations_data.json",
    "spring_block_data.json"
  ]
}
```

Order in the list is the order programs appear on the picker screen.

## The program JSON schema

Use `iron_foundations_data.json` as your reference — copy it and edit it.
Below is what every field means. Anything marked **optional** can be omitted
entirely from your file.

### Top level

```json
{
  "program": { ... },
  "warmup": { ... },
  "weeks": [ ... ]
}
```

### `program`

```json
"program": {
  "name": "Iron Foundations",
  "format": "Straight sets + short circuits",
  "targetSessionMinutes": 32,
  "daysPerWeek": 4,
  "totalWeeks": 7,
  "note": "free text, optional — shown nowhere critical, just documentation"
}
```

Only `name` is actually used for display purposes (program picker title, and
recorded into your workout history). The rest are informational/optional —
keep them if you want a record of the program's design, or drop the ones you
don't care about (except `name`, which is required).

### `warmup`

Describes the 6-exercise warm-up run before a training session:
50 seconds of work, 10 seconds of rest, one exercise per interval, one round
through all 6 (auto-advancing timer, ~6 minutes total).

```json
"warmup": {
  "format": "free text, informational only",
  "fixed": ["Exercise A", "Exercise B", "Exercise C"],
  "rotatingPool": ["... all exercises that ever appear in rotationByDay, informational only"],
  "rotationByDay": {
    "Day 1": ["Exercise D", "Exercise E", "Exercise F"],
    "Day 2": ["Exercise G", "Exercise H", "Exercise I"]
  }
}
```

- `fixed` — exactly 3 exercises done every single day, in this order.
- `rotationByDay` — keyed by the day's `"day"` id (must match the `"day"`
  field used in that week's `days[]`, e.g. `"Day 1"`). Exactly 3 exercises
  for that specific day.
- The app's warm-up screen for a given day = `fixed` (3) + `rotationByDay[dayId]` (3) = 6 exercises, in that order.
- `rotatingPool` is not read by the app — it's just a human-readable summary
  of every exercise that appears somewhere in `rotationByDay`. Optional.

**Skipping warm-up for a week:** if a week's `"phase"` is exactly `"Deload"`,
the app skips the warm-up screen for every day in that week and goes
straight from the Day screen into the workout. This matches how Iron
Foundations' Week 7 (deload) works — no warm-up protocol, straight into
lighter training. If you don't want this, just don't use the phase name
`"Deload"` for that week.

### `weeks`

An array, one entry per week, **in program order** (the app doesn't sort
them — list them start to finish).

```json
{
  "week": 1,
  "phase": "Base",
  "progressionNote": "optional, free text — not read by the app",
  "days": [ ... ]
}
```

- `week` — the week number, shown in the UI ("Week 1").
- `phase` — free text label shown in the UI (e.g. "Base", "Build", "Peak",
  "Deload"). The one special value the app checks for is `"Deload"` (see
  above).
- `days` — array of day objects, in the order they should be trained.

### `days`

```json
{
  "day": "Day 1",
  "name": "Clean & Press",
  "closer": "optional — free text shown as a final note after the last block",
  "blocks": [ ... ]
}
```

- `day` — a short id. Must match a key in `warmup.rotationByDay` for warm-up
  lookup to work on training weeks. Doesn't have to be literally "Day N" —
  just needs to be consistent between `days[].day` and
  `warmup.rotationByDay`.
- `name` — the human-readable day title ("Clean & Press"), shown big in the
  UI.
- `closer` — optional. A short free-text line (e.g. "Full-body stretch")
  displayed after the last block on the workout screen. Omit it if the day
  has no closing note.
- `blocks` — ordered array of work blocks for the day. Rendered top to
  bottom in this order. Each block has a `"type"` that controls how it's
  displayed — see below.

### Blocks

Every block has `"type"` set to one of `straight_sets`, `circuit`, or
`emom`. All three support:

- an optional `"label"` — a small heading shown above the block, e.g.
  "Main lift", "Accessory circuit", "Arms", "Core".
- an optional `"note"` — free text shown to the athlete on both the Day
  preview and the workout screen (e.g. load guidance, a self-regulated
  progression rule, a form cue). Use it for anything the athlete actually
  needs to read before or during the block — it's shown, not just stored.
  Omit it if a block needs no extra context.

#### `straight_sets`

A single exercise done for a fixed number of sets.

```json
{
  "type": "straight_sets",
  "label": "Main lift",
  "exercise": "Double KB Clean & Press",
  "reps": 5,
  "sets": 5,
  "restSeconds": 90
}
```

- `exercise` — exercise name.
- `reps` — can be a number (`5`), a string (`"3/side"`), or `null` if not
  applicable (the app just won't print a reps line).
- `sets` — how many sets; the app renders this many tappable checklist rows.
- `restSeconds` — **optional**. If present, each set row gets a "Start rest"
  button that runs a countdown timer for that many seconds. If omitted, no
  rest button is shown. The rest timer is never forced/auto-started.

#### `circuit`

A group of exercises repeated for a number of rounds.

```json
{
  "type": "circuit",
  "label": "Accessory circuit",
  "rounds": 4,
  "exercises": ["6/side Reverse Lunge", "8/side Single-Arm Row", "10 Push-ups"],
  "restSeconds": 60
}
```

- `exercises` — ordered list of exercise strings for one round (reps/sides
  are just baked into the string, e.g. `"6/side Reverse Lunge"`).
- `rounds` — how many times to repeat the full list. The app renders this as
  round-by-round checklists.
- `restSeconds` — **optional**, same rest-button behavior as `straight_sets`.
  Iron Foundations doesn't use this on circuit blocks, but the app supports
  it if you want it on a future program.

#### `emom`

"Every Minute On the Minute" — a fully automatic timer block. Two pattern
shapes are supported; pick whichever fits the rotation you're writing.

**Odd/even (2-minute alternation)** — omit `cycleLength` entirely:

```json
{
  "type": "emom",
  "label": "EMOM 10",
  "totalMinutes": 10,
  "pattern": [
    { "minute": "odd", "exercise": "8 Swings" },
    { "minute": "even", "exercise": "Max Push-ups" }
  ]
}
```

Minute numbering starts at 1, so minute 1 is `"odd"`, minute 2 is
`"even"`, minute 3 is `"odd"` again, and so on. Needs exactly one `"odd"`
and one `"even"` entry.

**Longer rotations (3+ minutes)** — add `"cycleLength"` and switch
`pattern[].minute` to 1-based integers instead of `"odd"`/`"even"`:

```json
{
  "type": "emom",
  "label": "EMOM 12",
  "totalMinutes": 12,
  "cycleLength": 3,
  "pattern": [
    { "minute": 1, "exercise": "12-15 KB Swings" },
    { "minute": 2, "exercise": "6/side Single-Arm Row" },
    { "minute": 3, "exercise": "30s Farmer March" }
  ]
}
```

With `cycleLength: 3`, minute 1 → position 1, minute 2 → position 2,
minute 3 → position 3, minute 4 → position 1 again, and so on — one
`pattern` entry per position, numbered 1 through `cycleLength`.
`totalMinutes` doesn't need to be an exact multiple of `cycleLength`; it'll
just stop mid-cycle if it isn't.

- `totalMinutes` — how long the EMOM runs, in minutes, either shape.
- The timer runs automatically start to finish: 60-second countdown per
  minute, an audio cue at the start of each new minute, and the active
  exercise name shown big. No pausing needed — it's designed to just run.
- The Day preview lists every `pattern` entry in the order you wrote them,
  labeled "Odd minute"/"Even minute" or "Minute 1"/"Minute 2"/... to match
  whichever shape you used.

## Quick checklist for a new program file

1. Copy `iron_foundations_data.json` to a new filename in this folder.
2. Edit `program.name` and everything under `weeks`.
3. Make sure every `days[].day` id used in `warmup.rotationByDay` actually
   exists, and vice versa.
4. Add the new filename to `manifest.json`.
5. Reload the app — it'll show up on the program picker.
