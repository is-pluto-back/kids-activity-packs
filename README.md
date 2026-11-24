# Kids Activity Packs

Live: https://solve.maxbrostudio.com (also https://activities.maxbrostudio.com)

A static site (no build step) with activity packs and problem banks for:

- **Ayden** (age 8, 2nd grade) - `ayden.html`
- **Aarya** (Jr Kindergarten, unicorns) - `aarya.html`

## Features
- **Problem bank**: pick categories, press **Shuffle** for a random mixed set.
- **Solve in the browser** with instant answer checking (multiple choice, typed answers, chess moves, Sudoku grids, note names, Mario Kart ordering, reading passages).
- **Tick-off progress** saved in `localStorage` on each device.
- **Print worksheet** of the shuffled set, with an optional answer key (behind a "For Mom" toggle on Ayden's page).
- **Original pack**: every page of the original PDF packs, unchanged, as page images (`originals/*.svg`), each with a Done tick and its own Print button. Ayden's answer key page is inside a hidden "For Mom" section.
- Read-aloud (🔊) buttons on Aarya's activities.

## Files
- `index.html`, `ayden.html`, `aarya.html`, `style.css`, `app.js`
- `data/ayden.js`, `data/aarya.js` - the problem banks as data (`window.BANK`)
- `originals/` - original PDF pages as SVG

## Problem counts
Ayden: chess 80 (40 knight forks + 40 mate-in-1, all verified with python-chess), Sudoku 32 (unique solutions), maths 230, science 45, music notes 55, word puzzles 90, reading passages 8 (39 questions), social studies 37, geography 35, Minecraft & Nintendo logic 65, projects 38.

Aarya: tracing 49, letters 70, counting 40, shapes 32, patterns 30, more or fewer 30, Spanish 32, day/night & growing 31, colouring & drawing 30, dance & animal moves 30.
