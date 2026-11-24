// Shared server logic: storage (private Vercel Blob), grading, parent auth.
const crypto = require("crypto");
const { put, get, list, del } = require("@vercel/blob");
const BANKS = require("./banks.js");

const KIDS = { ayden: "Ayden", aarya: "Aarya" };
const INDEX = {};
for (const [kid, bank] of Object.entries(BANKS)) { INDEX[kid] = {}; for (const [ck, c] of Object.entries(bank)) for (const it of c.items) { it.cat = ck; INDEX[kid][it.id] = it; } }
const TZ = "America/Chicago";
const chicago = iso => iso ? new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) + " CT" : null;
const chicagoDay = iso => iso ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)) : null;

// ---------- storage ----------
async function readJSON(pathname) {
  try {
    const r = await get(pathname, { access: "private", useCache: false });
    if (!r || !r.stream) return null;
    const txt = await new Response(r.stream).text();
    return JSON.parse(txt);
  } catch (e) { if (/not.?found|404/i.test(String(e && (e.message || e.name)))) return null; throw e; }
}
async function writeJSON(pathname, obj) {
  await put(pathname, JSON.stringify(obj), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
}
async function listPaths(prefix) {
  const out = []; let cursor;
  do { const r = await list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs.map(b => b.pathname)); cursor = r.hasMore ? r.cursor : null; } while (cursor);
  return out;
}
async function removePaths(paths) { if (paths.length) await del(paths); }
const examPath = (kid, id) => `exams/${kid}/${id}.json`;
async function listExams(kid) {
  const paths = await listPaths(`exams/${kid}/`);
  const exams = (await Promise.all(paths.map(readJSON))).filter(Boolean);
  return exams.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

// ---------- grading ----------
const ORD = ["1st", "2nd", "3rd", "4th"];
const norm = s => String(s).toLowerCase().replace(/\b(am|pm|cents?|pounds?)\b/g, "").replace(/[.,]+$/g, "").replace(/\s+/g, " ").trim();
const chessNorm = s => String(s).toLowerCase().replace(/[\s+#x\-=!?:]/g, "");
const SELF = t => t === "open" || t === "trace";
function isAnswered(it, r) {
  if (r == null || r === "" || r === false) return false;
  if (Array.isArray(r)) return r.some(x => x != null && x !== "");
  if (it.type === "sudoku") return typeof r === "string" && r.length === 81 && r !== it.puzzle;
  return true;
}
function grade(it, r) {
  const answered = isAnswered(it, r);
  switch (it.type) {
    case "mc": case "shape": return { pts: r === it.answer ? 1 : 0, max: 1, answered };
    case "input": { const v = String(r || ""); const ok = !!v.trim() && it.answer.some(a => norm(a) === norm(v) || norm(a).replace(/\s/g, "") === norm(v).replace(/[\s,]/g, "")); return { pts: ok ? 1 : 0, max: 1, answered }; }
    case "chess": { const v = String(r || ""); const ok = !!v.trim() && (it.answer.some(a => chessNorm(a) === chessNorm(v)) || chessNorm(v) === it.answer[1].slice(2)); return { pts: ok ? 1 : 0, max: 1, answered }; }
    case "notes": { const v = String(r || "").replace(/[\s,\-]/g, "").toUpperCase(); return { pts: v && it.answer.some(a => a.replace(/\s/g, "").toUpperCase() === v) ? 1 : 0, max: 1, answered }; }
    case "sudoku": { const v = String(r || ""); return { pts: v.length === 81 && v === it.answer[0] ? 1 : 0, max: 1, answered }; }
    case "order": return { pts: Array.isArray(r) && r.every((x, i) => x === it.answer[i]) ? 1 : 0, max: 1, answered };
    case "reading": { const a = Array.isArray(r) ? r : []; return { pts: it.questions.filter((q, i) => a[i] === q.answer).length, max: it.questions.length, answered }; }
    default: return { pts: 0, max: 0, answered, self: true };
  }
}
const letter = p => p >= 90 ? "A" : p >= 80 ? "B" : p >= 70 ? "C" : p >= 60 ? "D" : "F";
function answerText(it) {
  switch (it.type) {
    case "mc": return it.choices[it.answer];
    case "input": return it.explain || it.answer[0];
    case "chess": return it.explain;
    case "notes": return it.answer[0];
    case "order": return it.answer.map((n, i) => ORD[i] + " " + n).join(", ");
    case "shape": return it.shapes[it.answer];
    case "reading": return it.questions.map((q, i) => (i + 1) + ". " + q.choices[q.answer]).join("  ");
    case "sudoku": return "See the solution grid";
    default: return null;
  }
}
function responseText(it, r) {
  if (!isAnswered(it, r)) return SELF(it.type) ? "Not ticked" : "(no answer)";
  switch (it.type) {
    case "mc": return it.choices[r] != null ? it.choices[r] : "(no answer)";
    case "shape": return it.shapes[r] || "(no answer)";
    case "order": return r.map((n, i) => ORD[i] + " " + (n || "-")).join(", ");
    case "reading": return it.questions.map((q, i) => (i + 1) + ". " + (r[i] != null ? q.choices[r[i]] : "-")).join("  ");
    case "sudoku": { const empty = [...it.puzzle].filter(c => c === "0").length; const filled = [...r].filter((c, i) => it.puzzle[i] === "0" && c !== "0").length; const right = [...r].filter((c, i) => it.puzzle[i] === "0" && c === it.answer[0][i]).length; return `${filled}/${empty} squares filled, ${right} correct`; }
    case "open": case "trace": return "Ticked 'I did it'";
    default: return String(r);
  }
}
function scoreExam(ex) {
  let pts = 0, max = 0, answered = 0, selfTotal = 0, selfDone = 0;
  ex.results = {};
  for (const id of ex.items) {
    const it = INDEX[ex.kid][id]; if (!it) continue;
    let g = grade(it, (ex.responses || {})[id]);
    const ov = (ex.overrides || {})[id];
    if (SELF(it.type)) { selfTotal++; if (g.answered) selfDone++; if (ov != null) g = { pts: ov ? 1 : 0, max: 1, answered: g.answered, self: true, override: true }; }
    else if (ov != null) g = { pts: ov ? (g.max || 1) : 0, max: g.max || 1, answered: g.answered, override: true };
    ex.results[id] = g; pts += g.pts; max += g.max; if (g.answered) answered++;
  }
  Object.assign(ex, { score: pts, max, answered, selfTotal, selfDone, percent: max ? Math.round(100 * pts / max) : null });
  ex.grade = max ? letter(ex.percent) : "-";
  return ex;
}
function label(it, g) {
  if (g.self) return g.override ? (g.pts ? "Done (marked by Mom)" : "Not done (marked by Mom)") : "Mom to check";
  if (!g.max) return "";
  const base = g.pts === g.max ? "Correct" : g.pts > 0 ? `${g.pts}/${g.max}` : "Incorrect";
  return g.override ? base + " (marked by Mom)" : base;
}
// detailed per-question view; withSolutions adds sudoku solution etc. (used for parent and released kid view)
function detail(ex) {
  scoreExam(ex);
  return ex.items.map((id, i) => {
    const it = INDEX[ex.kid][id]; if (!it) return null; const g = ex.results[id];
    return { n: i + 1, id, type: it.type, q: it.q, cat: it.cat, label: label(it, g), state: g.self ? (g.override ? (g.pts ? "done" : "notdone") : "self") : g.pts === g.max ? "ok" : g.pts > 0 ? "part" : "no", pts: g.pts, max: g.max,
      yourAnswer: responseText(it, (ex.responses || {})[id]), correctAnswer: answerText(it), solution: it.type === "sudoku" ? it.answer[0] : undefined, puzzle: it.type === "sudoku" ? it.puzzle : undefined,
      fen: it.fen, notes: it.notes, pic: it.pic, note: (ex.notes || {})[id] || "" };
  }).filter(Boolean);
}
function summary(ex) {
  return { id: ex.id, kid: ex.kid, number: ex.number, title: ex.title, subtitle: ex.subtitle, count: ex.items.length, timeLimit: ex.timeLimit || null, status: ex.status,
    startedAt: ex.startedAt, startedAtChicago: chicago(ex.startedAt), startedDay: chicagoDay(ex.startedAt), submittedAt: ex.submittedAt || null, submittedAtChicago: chicago(ex.submittedAt), durationSec: ex.durationSec || null,
    reviewedAt: ex.reviewedAt || null, releasedAt: ex.releasedAt || null, releasedAtChicago: chicago(ex.releasedAt) };
}

// ---------- parent auth ----------
const CONFIG = "config/parent.json";
const pbkdf2 = (pin, salt) => crypto.pbkdf2Sync(String(pin), Buffer.from(salt, "hex"), 210000, 32, "sha256").toString("hex");
function sign(cfg, hours = 12) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + hours * 3600e3, v: cfg.version })).toString("base64url");
  const mac = crypto.createHmac("sha256", Buffer.from(cfg.secret, "hex")).update(payload).digest("base64url");
  return payload + "." + mac;
}
function verify(cfg, token) {
  if (!cfg || !token || !token.includes(".")) return false;
  const [payload, mac] = token.split(".");
  const want = crypto.createHmac("sha256", Buffer.from(cfg.secret, "hex")).update(payload).digest("base64url");
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return false;
  try { const p = JSON.parse(Buffer.from(payload, "base64url").toString()); return p.exp > Date.now() && p.v === cfg.version; } catch (e) { return false; }
}
function checkPin(cfg, pin) {
  const h = pbkdf2(pin, cfg.salt);
  return crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(cfg.hash, "hex"));
}
function newConfig(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: pbkdf2(pin, salt), algo: "pbkdf2-sha256-210000", secret: crypto.randomBytes(32).toString("hex"), version: crypto.randomBytes(6).toString("hex"), createdAt: new Date().toISOString(), fails: 0, lockUntil: 0 };
}

// ---------- http helpers ----------
function send(res, code, obj) { res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "application/json; charset=utf-8"); res.status(code).send(JSON.stringify(obj)); }
function body(req) { if (req.body && typeof req.body === "object") return req.body; try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; } }
const validKid = k => Object.prototype.hasOwnProperty.call(KIDS, k);
const validId = id => typeof id === "string" && /^(ayden|aarya)-\d{10,16}-[a-z0-9]{4,12}$/.test(id);

module.exports = { KIDS, INDEX, BANKS, chicago, chicagoDay, readJSON, writeJSON, listPaths, removePaths, examPath, listExams, scoreExam, detail, summary, isAnswered, CONFIG, sign, verify, checkPin, newConfig, send, body, validKid, validId };
