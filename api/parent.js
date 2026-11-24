// Parent API: PIN setup/login (salted PBKDF2 hash in private Blob), review, notes, overrides, release, delete.
const C = require("./_lib/core.js");
const KEYPAGE = require("./_lib/keypage.js");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PIN_RE = /^\d{4,8}$/;

module.exports = async (req, res) => {
  try {
    let cfg = await C.readJSON(C.CONFIG);
    if (req.method === "GET") return C.send(res, 200, { pinSet: !!cfg });
    if (req.method !== "POST") return C.send(res, 405, { error: "Method not allowed" });
    const b = C.body(req);
    if (b.action === "setup") {
      if (cfg) return C.send(res, 409, { error: "A parent PIN is already set" });
      if (!PIN_RE.test(String(b.pin || ""))) return C.send(res, 400, { error: "PIN must be 4 to 8 digits" });
      cfg = C.newConfig(b.pin); await C.writeJSON(C.CONFIG, cfg);
      return C.send(res, 200, { token: C.sign(cfg) });
    }
    if (b.action === "login") {
      if (!cfg) return C.send(res, 409, { error: "No PIN set yet", pinSet: false });
      if (cfg.lockUntil && cfg.lockUntil > Date.now()) return C.send(res, 429, { error: "Too many tries. Wait a few minutes and try again." });
      if (!C.checkPin(cfg, String(b.pin || ""))) {
        cfg.fails = (cfg.fails || 0) + 1; if (cfg.fails >= 5) { cfg.lockUntil = Date.now() + 5 * 60e3; cfg.fails = 0; }
        await C.writeJSON(C.CONFIG, cfg); await sleep(800);
        return C.send(res, 401, { error: "Wrong PIN" });
      }
      if (cfg.fails || cfg.lockUntil) { cfg.fails = 0; cfg.lockUntil = 0; await C.writeJSON(C.CONFIG, cfg); }
      return C.send(res, 200, { token: C.sign(cfg) });
    }
    // everything below needs a valid parent session
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!C.verify(cfg, token)) return C.send(res, 401, { error: "Please enter the parent PIN", pinSet: !!cfg });
    const kid = String(b.kid || "");
    if (b.action === "keypage") return C.send(res, 200, KEYPAGE);
    if (b.action === "reset") {
      if (!C.checkPin(cfg, String(b.pin || ""))) { await sleep(800); return C.send(res, 401, { error: "Wrong PIN" }); }
      await C.removePaths([C.CONFIG]);
      return C.send(res, 200, { ok: true });
    }
    if (!C.validKid(kid)) return C.send(res, 400, { error: "Unknown kid" });
    if (b.action === "list") {
      const exams = await C.listExams(kid);
      return C.send(res, 200, { exams: exams.map(ex => Object.assign(C.summary(ex), ex.status === "in_progress" ? {} : { score: ex.score, max: ex.max, percent: ex.percent, grade: ex.grade, answered: ex.answered, selfTotal: ex.selfTotal, selfDone: ex.selfDone, note: ex.note || "", questions: C.detail(ex) })) });
    }
    if (!C.validId(b.id)) return C.send(res, 400, { error: "Bad exam id" });
    const path = C.examPath(kid, b.id); const ex = await C.readJSON(path);
    if (!ex) return C.send(res, 404, { error: "Exam not found" });
    if (b.action === "delete") { await C.removePaths([path]); return C.send(res, 200, { ok: true }); }
    if (ex.status === "in_progress") return C.send(res, 409, { error: "This exam has not been submitted yet" });
    if (b.action === "override") {
      if (!ex.items.includes(b.qid)) return C.send(res, 400, { error: "Bad question" });
      ex.overrides = ex.overrides || {}; if (b.value == null) delete ex.overrides[b.qid]; else ex.overrides[b.qid] = !!b.value;
    } else if (b.action === "note") {
      const text = String(b.text || "").slice(0, 1000);
      if (b.qid) { if (!ex.items.includes(b.qid)) return C.send(res, 400, { error: "Bad question" }); ex.notes = ex.notes || {}; if (text) ex.notes[b.qid] = text; else delete ex.notes[b.qid]; }
      else ex.note = text;
    } else if (b.action === "release") {
      if (b.value === false) { ex.status = "submitted"; ex.releasedAt = null; }
      else { ex.status = "released"; ex.releasedAt = new Date().toISOString(); }
    } else return C.send(res, 400, { error: "Unknown action" });
    ex.reviewedAt = new Date().toISOString();
    C.scoreExam(ex); await C.writeJSON(path, ex);
    return C.send(res, 200, { ok: true, exam: Object.assign(C.summary(ex), { score: ex.score, max: ex.max, percent: ex.percent, grade: ex.grade, answered: ex.answered, selfTotal: ex.selfTotal, selfDone: ex.selfDone, note: ex.note || "", questions: C.detail(ex) }) });
  } catch (err) { console.error(err); return C.send(res, 500, { error: "Server error" }); }
};
