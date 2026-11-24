# Kids Activity Packs

Live: https://solve.maxbrostudio.com (also https://activities.maxbrostudio.com)

A static site (no build step) with activity packs and problem banks for:

- **Ayden** (age 8, 2nd grade) - `ayden.html`
- **Aarya** (Jr Kindergarten, unicorns) - `aarya.html`

## Features
- **Exams for the kids**: choose subjects, number of questions (5-30) and an optional timer (shown as a guide, never enforced), then press **Start Exam**. Questions are drawn at random from the question bank, preferring ones not seen in earlier exams.
- **No answers or hints during the exam**. The kid's answers save as they go (a refresh keeps the exam), and there is **one submission per exam**.
- **Review Exams** (`review.html`, for parents): a gradebook with score, percent and letter grade (A 90+, B 80+, C 70+, D 60+, F) for each exam. It also shows every answer given next to the correct answer, lets you mark drawing/tracing/movement activities as done or override any question, print the exam with an answer key, or delete it.
- **Paper exams**: print a randomly drawn exam with an optional answer key (behind the "For Mom" toggle).
- **Original pack**: every page of the original PDF packs, unchanged, as page images (`originals/*.svg`), each with a Done tick and its own Print button. Ayden's answer key page is inside a hidden "For Mom" section.
- Read-aloud (🔊) buttons on Aarya's questions.
- Exams and grades are stored in the browser's `localStorage`, so review them on the same device the kids use.

## Files
- `index.html`, `ayden.html`, `aarya.html`, `review.html`, `style.css`, `app.js`
- `data/ayden.js`, `data/aarya.js` - the question banks as data (`window.BANKS.ayden` / `.aarya`)
- `originals/` - original PDF pages as SVG

## Question counts
Ayden: chess 80 (40 knight forks + 40 mate-in-1, all verified with python-chess), Sudoku 32 (unique solutions), maths 230, science 45, music notes 55, word puzzles 90, reading passages 8 (39 questions), social studies 37, geography 35, Minecraft & Nintendo logic 65, projects 38.

Aarya: tracing 49, letters 70, counting 40, shapes 32, patterns 30, more or fewer 30, Spanish 32, day/night & growing 31, colouring & drawing 30, dance & animal moves 30.
