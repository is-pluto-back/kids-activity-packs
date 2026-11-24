# Kids Activity Packs

Live: https://solve.maxbrostudio.com (also https://activities.maxbrostudio.com)

A static site (no build step) with activity packs and problem banks for:

- **Ayden** (age 8, 2nd grade) - `ayden.html`
- **Aarya** (Jr Kindergarten, unicorns) - `aarya.html`

## Features
- **Exams for the kids**: choose subjects, number of questions (5-30) and an optional timer (shown as a guide, never enforced), then press **Start Exam**. No answers or hints are shown during the exam, and there is one submission per exam.
- **Saved online with date and time**: the start and the submission are stored server-side (Vercel Functions in `api/` + a private Vercel Blob store) with timestamps shown in Central Time. If the device is offline, the exam is queued in `localStorage` and sent automatically later.
- **My Exams** (kid): every exam, newest first, with a date filter. Shows "Waiting for Mom to review" until Mom releases results, then right/wrong per question, the correct answers, Mom's notes, the score and the letter grade.
- **Review Exams** (`review.html`, parent PIN): Mom creates a 4-8 digit PIN on her first visit (stored only as a salted PBKDF2 hash). She can then review exams from any device, newest first with a date filter. For each exam she sees the answers given next to the correct ones, can mark activities done or override answers, add per-question and overall notes, **Release to kid**, print with an answer key, or delete it.
- **Answer data stays on the server**: the public question files (`data/*.js`) contain no answers. Grading happens in `api/`, and answers reach the browser only through the PIN-protected parent API or after Mom releases an exam.
- **Original pack**: every page of the original PDF packs, unchanged (`originals/*.svg`). Ayden's original answer page is served only to a signed-in parent.

## Files
- `index.html`, `ayden.html`, `aarya.html`, `review.html`, `style.css`, `app.js`
- `data/ayden.js`, `data/aarya.js` - public question banks without answers
- `api/exams.js` (kid: start/submit/list), `api/parent.js` (PIN, review, notes, release), `api/_lib/` (grading, storage, full banks with answers)
- Storage: private Vercel Blob store `kids-activity-packs-exams` (env `BLOB_READ_WRITE_TOKEN`)
- Forgot the PIN? In the Vercel dashboard: Storage > kids-activity-packs-exams > Browser, delete `config/parent.json`, then set a new PIN on the Review page.
- `originals/` - original PDF pages as SVG

## Question counts
Ayden: chess 80 (40 knight forks + 40 mate-in-1, all verified with python-chess), Sudoku 32 (unique solutions), maths 230, science 45, music notes 55, word puzzles 90, reading passages 8 (39 questions), social studies 37, geography 35, Minecraft & Nintendo logic 65, projects 38.

Aarya: tracing 49, letters 70, counting 40, shapes 32, patterns 30, more or fewer 30, Spanish 32, day/night & growing 31, colouring & drawing 30, dance & animal moves 30.
