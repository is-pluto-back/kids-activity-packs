// Kid-facing exam API: start, submit (once), and list my exams (results only after Mom releases them).
const C = require("./_lib/core.js");

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const kid = String(req.query.kid || "");
      if (!C.validKid(kid)) return C.send(res, 400, { error: "Unknown kid" });
      const exams = await C.listExams(kid);
      return C.send(res, 200, { exams: exams.map(ex => {
        const s = C.summary(ex);
        if (ex.status === "released") { const d = C.detail(ex); Object.assign(s, { score: ex.score, max: ex.max, percent: ex.percent, grade: ex.grade, note: ex.note || "", questions: d }); }
        return s;
      }) });
    }
    if (req.method !== "POST") return C.send(res, 405, { error: "Method not allowed" });
    const b = C.body(req); const e = b.exam || {};
    if (!C.validKid(e.kid) || !C.validId(e.id) || !e.id.startsWith(e.kid + "-")) return C.send(res, 400, { error: "Bad exam" });
    if (!Array.isArray(e.items) || !e.items.length || e.items.length > 40 || !e.items.every(id => C.INDEX[e.kid][id])) return C.send(res, 400, { error: "Bad questions" });
    const path = C.examPath(e.kid, e.id);
    const existing = await C.readJSON(path);
    const startedAt = existing ? existing.startedAt : (Number.isFinite(Date.parse(e.startedAt)) ? new Date(e.startedAt).toISOString() : new Date().toISOString());
    let number = existing ? existing.number : null;
    if (!number) number = (await C.listPaths(`exams/${e.kid}/`)).length + (existing ? 0 : 1);
    const base = existing || { id: e.id, kid: e.kid, number, title: `${C.KIDS[e.kid]}'s Exam #${number}`, subtitle: String(e.subtitle || "").slice(0, 200), cats: (e.cats || []).slice(0, 20), items: e.items, timeLimit: Number(e.timeLimit) || null, startedAt, status: "in_progress", responses: {}, overrides: {}, notes: {}, note: "" };
    if (b.action === "start") {
      if (!existing) await C.writeJSON(path, base);
      return C.send(res, 200, { ok: true, exam: C.summary(base) });
    }
    if (b.action === "submit") {
      if (existing && existing.status !== "in_progress") return C.send(res, 409, { error: "This exam was already submitted", exam: C.summary(existing) });
      const responses = {};
      for (const id of base.items) if (e.responses && Object.prototype.hasOwnProperty.call(e.responses, id)) { const v = e.responses[id]; responses[id] = typeof v === "string" ? v.slice(0, 200) : v; }
      const submittedAt = new Date().toISOString();
      const ex = Object.assign(base, { responses, submittedAt, status: "submitted", clientSubmittedAt: Number.isFinite(Date.parse(e.submittedAt)) ? new Date(e.submittedAt).toISOString() : null });
      ex.durationSec = Math.max(0, Math.round((Date.parse(ex.clientSubmittedAt || submittedAt) - Date.parse(ex.startedAt)) / 1000));
      C.scoreExam(ex);
      await C.writeJSON(path, ex);
      return C.send(res, 200, { ok: true, exam: C.summary(ex) });
    }
    return C.send(res, 400, { error: "Unknown action" });
  } catch (err) { console.error(err); return C.send(res, 500, { error: "Server error" }); }
};
