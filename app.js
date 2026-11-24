/* Kids Activity Packs - exams from a problem bank: start, answer, submit once; parents review and grade. No build step. */
(function () {
  "use strict";
  const BANKS = window.BANKS || {};
  const NAMES = { ayden: "Ayden", aarya: "Aarya" };
  const store = {
    get(kid, k, d) { try { const v = localStorage.getItem("kap:" + kid + ":" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(kid, k, v) { try { localStorage.setItem("kap:" + kid + ":" + k, JSON.stringify(v)); } catch (e) {} },
    del(kid, k) { try { localStorage.removeItem("kap:" + kid + ":" + k); } catch (e) {} }
  };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") n.className = v; else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LETTERS = "ABCDEFGH";
  const ORD = ["1st", "2nd", "3rd", "4th"];
  const index = {};
  for (const [kid, bank] of Object.entries(BANKS)) { index[kid] = {}; for (const [ck, c] of Object.entries(bank)) for (const it of c.items) { it.cat = ck; index[kid][it.id] = it; } }
  const fmtTime = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), x = s % 60; return m + ":" + String(x).padStart(2, "0"); };
  const TZ = "America/Chicago";
  const fmtDate = t => t ? new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(t)) + " CT" : "";
  const dayOf = t => t ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t)) : "";
  const api = async (path, opts) => { const r = await fetch(path, Object.assign({ headers: { "Content-Type": "application/json" } }, opts)); let j = {}; try { j = await r.json(); } catch (e) {} if (!r.ok) { const err = new Error(j.error || ("HTTP " + r.status)); err.status = r.status; err.data = j; throw err; } return j; };

  // ---------- visual builders ----------
  const PIECES = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙", k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  function boardEl(fen) {
    const g = el("div", { class: "board", role: "img", "aria-label": "Chess board" });
    fen.split(" ")[0].split("/").forEach((row, ri) => { let fi = 0; for (const ch of row) { if (/\d/.test(ch)) { for (let i = 0; i < +ch; i++) g.append(sq(ri, fi++, "")); } else g.append(sq(ri, fi++, ch)); } });
    function sq(r, f, p) {
      const d = el("div", { class: "sq " + ((r + f) % 2 ? "dark" : "light") + (p && p === p.toUpperCase() ? " w" : " b") }, p ? PIECES[p] : "");
      if (f === 0) d.append(el("span", { class: "rank" }, 8 - r));
      if (r === 7) d.append(el("span", { class: "file" }, "abcdefgh"[f]));
      return d;
    }
    return g;
  }
  function pieceList(fen) {
    const names = { k: "King", q: "Queen", r: "Rook", b: "Bishop", n: "Knight", p: "Pawn" }; const w = [], b = [];
    fen.split(" ")[0].split("/").forEach((row, ri) => { let fi = 0; for (const ch of row) { if (/\d/.test(ch)) fi += +ch; else { (ch === ch.toUpperCase() ? w : b).push(names[ch.toLowerCase()] + " " + "abcdefgh"[fi] + (8 - ri)); fi++; } } });
    return el("p", { class: "small" }, "White: " + w.join(", ") + " • Black: " + b.join(", "));
  }
  function staffSVG(steps) {
    const W = 90 + steps.length * 60, base = 90, h = 10;
    let s = `<svg class="staff" viewBox="0 0 ${W} 130" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Notes on a treble staff">`;
    for (let i = 0; i < 5; i++) s += `<line x1="5" x2="${W - 5}" y1="${base - i * 2 * h}" y2="${base - i * 2 * h}" stroke="#333" stroke-width="1.5"/>`;
    s += `<text x="6" y="${base + 10}" font-size="80" font-family="'Noto Music','Apple Symbols','Segoe UI Symbol',serif">𝄞</text>`;
    steps.forEach((st, i) => {
      const x = 100 + i * 60, y = base - st * h;
      if (st <= -2) s += `<line x1="${x - 16}" x2="${x + 16}" y1="${base + 2 * h}" y2="${base + 2 * h}" stroke="#333" stroke-width="1.5"/>`;
      if (st >= 10) s += `<line x1="${x - 16}" x2="${x + 16}" y1="${base - 10 * h}" y2="${base - 10 * h}" stroke="#333" stroke-width="1.5"/>`;
      s += `<ellipse cx="${x}" cy="${y}" rx="11" ry="8" transform="rotate(-20 ${x} ${y})" fill="#222"/>`;
      s += st < 4 ? `<line x1="${x + 10}" x2="${x + 10}" y1="${y}" y2="${y - 55}" stroke="#222" stroke-width="2"/>` : `<line x1="${x - 10}" x2="${x - 10}" y1="${y}" y2="${y + 55}" stroke="#222" stroke-width="2"/>`;
      s += `<text x="${x}" y="125" text-anchor="middle" font-size="13" fill="#888">${i + 1}</text>`;
    });
    return s + "</svg>";
  }
  function shapeSVG(t, c) {
    const a = `fill="${c}" stroke="#333" stroke-width="3"`;
    const body = { circle: `<circle cx="50" cy="50" r="38" ${a}/>`, square: `<rect x="14" y="14" width="72" height="72" ${a}/>`, triangle: `<polygon points="50,10 90,88 10,88" ${a}/>`, rectangle: `<rect x="5" y="28" width="90" height="46" ${a}/>`, star: `<polygon points="50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38" ${a}/>`, heart: `<path d="M50 88 C10 60 5 35 25 20 C38 11 48 20 50 30 C52 20 62 11 75 20 C95 35 90 60 50 88Z" ${a}/>`, oval: `<ellipse cx="50" cy="50" rx="44" ry="28" ${a}/>`, diamond: `<polygon points="50,6 90,50 50,94 10,50" ${a}/>` }[t];
    return `<svg viewBox="0 0 100 100" width="90" height="90" role="img" aria-label="${t}">${body}</svg>`;
  }
  function traceSVG(text) {
    const w = Math.max(300, text.length * 78);
    return `<svg class="trace" viewBox="0 0 ${w} 140" role="img" aria-label="Trace ${esc(text)}"><line x1="0" x2="${w}" y1="30" y2="30" stroke="#9ad" stroke-width="2"/><line x1="0" x2="${w}" y1="72" y2="72" stroke="#9ad" stroke-dasharray="8 8" stroke-width="2"/><line x1="0" x2="${w}" y1="114" y2="114" stroke="#9ad" stroke-width="2"/><text x="10" y="114" font-family="'Andika','Comic Sans MS','Trebuchet MS',sans-serif" font-size="118" fill="none" stroke="#b9a3d9" stroke-width="3" stroke-dasharray="6 6" letter-spacing="6">${esc(text)}</text></svg>`;
  }
  function sudokuHTML(puz, sol, small) {
    return `<div class="sudoku${small ? " small" : ""}">${[...puz].map((ch, i) => { const r = Math.floor(i / 9), c = i % 9; const v = sol ? sol[i] : (ch !== "0" ? ch : ""); return `<div class="cell${c % 3 === 2 && c < 8 ? " br" : ""}${r % 3 === 2 && r < 8 ? " bb" : ""}${ch !== "0" ? " given" : ""}">${v}</div>`; }).join("")}</div>`;
  }
  function speak(text, lang) { if (!("speechSynthesis" in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.85; if (lang) u.lang = lang; speechSynthesis.speak(u); }

  function isAnswered(it, r) {
    if (r == null || r === "" || r === false) return false;
    if (Array.isArray(r)) return r.some(x => x != null && x !== "");
    if (it.type === "sudoku") return typeof r === "string" && r.length === 81 && r !== it.puzzle;
    return true;
  }
  // ---------- printing ----------
  function printItem(it, n) {
    let h = `<div class="pitem"><div class="pq"><b>${n}.</b> ${esc(it.q)}</div>`;
    if (it.pic) h += `<div class="pic${it.pic.length > 14 ? " many" : ""}">${esc(it.pic)}</div>`;
    switch (it.type) {
      case "mc": h += `<div class="pchoices">${it.choices.map((c, i) => `<span>○ ${it.big ? "" : LETTERS[i] + ". "}${esc(c)}</span>`).join("")}</div>`; break;
      case "shape": h += `<div class="pchoices">${it.shapes.map(s => `<span>○ ${shapeSVG(s, "#fff")}</span>`).join("")}</div>`; break;
      case "input": h += `<div class="line">Answer: ____________________</div>`; break;
      case "chess": h += boardEl(it.fen).outerHTML + pieceList(it.fen).outerHTML + `<div class="line">Your move: ______ to ______</div>`; break;
      case "notes": h += staffSVG(it.notes) + `<div class="line">Answer: ____________________</div>`; break;
      case "sudoku": h += sudokuHTML(it.puzzle); break;
      case "order": h += `<div class="line">Racers: ${it.options.join(", ")}<br>1st: ________ 2nd: ________ 3rd: ________ 4th: ________</div>`; break;
      case "reading": h += `<div class="passage">${it.passage.split("\n").map(p => `<p>${esc(p)}</p>`).join("")}</div>` + it.questions.map((q, i) => `<div class="pq">${i + 1}. ${esc(q.q)}</div><div class="pchoices">${q.choices.map((c, j) => `<span>○ ${LETTERS[j]}. ${esc(c)}</span>`).join("")}</div>`).join(""); break;
      case "trace": h += traceSVG(it.text) + traceSVG(it.text); break;
      default: h += it.box ? `<div class="drawbox tall"></div>` : `<div class="line">☐ I did it!</div>`;
    }
    return h + "</div>";
  }
  // key: optional array of {n, correctAnswer, solution, puzzle} from the parent API
  function examPaperHTML(kid, ex, key) {
    const items = ex.items.map(id => index[kid][id]).filter(Boolean);
    let h = `<header class="phead"><h1>${esc(ex.title)}</h1><p>${esc(ex.subtitle || "")} • ${items.length} questions${ex.timeLimit ? " • Suggested time: " + ex.timeLimit + " minutes" : ""}${ex.startedAt ? " • " + esc(fmtDate(ex.startedAt)) : ""}</p><p>Name: ________________ Date: ____________ Score: ______</p></header>`;
    h += items.map((it, i) => printItem(it, i + 1)).join("");
    if (key) h += `<section class="pkey"><h2>Answer key - For Mom</h2><ol>${key.map(q => q.solution ? `<li>Sudoku solution:${sudokuHTML(q.puzzle, q.solution, true)}</li>` : `<li>${esc(q.correctAnswer || "Mom checks")}</li>`).join("")}</ol></section>`;
    return h;
  }
  function doPrint(html) {
    const pa = $("#print-area"); pa.innerHTML = html; document.body.classList.add("printing");
    const imgs = $$("img", pa);
    Promise.all(imgs.map(im => im.complete ? 1 : new Promise(r => { im.onload = im.onerror = r; }))).then(() => setTimeout(() => window.print(), 50));
  }
  window.addEventListener("afterprint", () => { document.body.classList.remove("printing"); const pa = $("#print-area"); if (pa) pa.innerHTML = ""; });

  // shared: render one reviewed question (kid released view + parent view)
  function resultItem(q, extra) {
    const li = el("li", { class: q.state });
    const icon = { ok: "✅", no: "❌", part: "◐", done: "✅", notdone: "⬜", self: "📝" }[q.state] || "";
    li.append(el("div", { class: "rq" }, el("b", {}, icon + " " + q.label), " - ", q.q));
    if (q.fen) li.append(boardEl(q.fen));
    if (q.notes) li.append(el("div", { html: staffSVG(q.notes) }));
    if (q.pic) li.append(el("div", { class: "pic small-pic" }, q.pic));
    li.append(el("div", { class: "small" }, el("b", {}, "Your answer: "), q.yourAnswer));
    if (q.solution) li.append(el("div", { class: "small" }, el("b", {}, "Solution:")), el("div", { html: sudokuHTML(q.puzzle, q.solution, true) }));
    else if (q.correctAnswer) li.append(el("div", { class: "small" }, el("b", {}, "Correct answer: "), q.correctAnswer));
    if (q.note && !extra) li.append(el("div", { class: "momnote" }, "💬 Mom: " + q.note));
    if (extra) li.append(extra(q));
    return li;
  }
  function dateFilterEl(onChange) {
    const from = el("input", { type: "date", "aria-label": "From date" }), to = el("input", { type: "date", "aria-label": "To date" });
    const wrap = el("div", { class: "controls datefilter" }, el("label", {}, "From ", from), el("label", {}, "To ", to), el("button", { type: "button", class: "btn tiny ghost", onclick: () => { from.value = ""; to.value = ""; onChange(); } }, "All dates"));
    from.addEventListener("change", onChange); to.addEventListener("change", onChange);
    wrap.match = t => { const d = dayOf(t); return (!from.value || d >= from.value) && (!to.value || d <= to.value); };
    return wrap;
  }

  // =====================================================================
  // KID PAGE: exam flow + My Exams history
  // =====================================================================
  function kidPage(KID) {
    const BANK = BANKS[KID]; const NAME = NAMES[KID];
    const S = { get: (k, d) => store.get(KID, k, d), set: (k, v) => store.set(KID, k, v), del: k => store.del(KID, k) };
    let current = S.get("current", null);
    let timerId = null; let serverExams = null; let filter;
    const selectedCats = () => $$("#cats input:checked").map(x => x.value);
    function renderCats() {
      const box = $("#cats"); box.innerHTML = ""; const saved = S.get("cats", Object.keys(BANK));
      for (const [k, c] of Object.entries(BANK)) box.append(el("label", { class: "chip" }, el("input", { type: "checkbox", value: k, checked: saved.includes(k) ? "" : false, onchange: () => S.set("cats", selectedCats()) }), " " + c.icon + " " + c.name + " ", el("span", { class: "count" }, "(" + c.items.length + ")")));
    }
    // ----- outbox (offline queue) -----
    const outbox = () => S.get("outbox", []);
    function queue(action, exam) { const o = outbox().filter(x => !(x.exam.id === exam.id && x.action === action)); o.push({ action, exam }); S.set("outbox", o); }
    async function flush() {
      let o = outbox(); if (!o.length) return;
      const keep = [];
      for (const m of o) {
        try { await api("/api/exams", { method: "POST", body: JSON.stringify(m) }); }
        catch (e) { if (e.status && e.status < 500 && e.status !== 429) { /* rejected permanently (e.g. already submitted) */ } else keep.push(m); }
      }
      S.set("outbox", keep); if (keep.length !== o.length) loadHistory();
    }
    window.addEventListener("online", flush); setInterval(flush, 30000);
    // ----- history -----
    async function loadHistory() {
      try { serverExams = (await api("/api/exams?kid=" + KID)).exams; S.set("history-cache", serverExams); $("#offline-note").hidden = true; }
      catch (e) { serverExams = S.get("history-cache", []); $("#offline-note").hidden = false; }
      renderHistory();
    }
    function renderHistory() {
      const box = $("#history-list"); if (!box) return; box.innerHTML = "";
      const pending = outbox().filter(m => m.action === "submit").map(m => Object.assign({}, m.exam, { status: "pending" }));
      const ids = new Set((serverExams || []).map(e => e.id));
      let list = pending.filter(p => !ids.has(p.id)).concat(serverExams || []);
      if (current && !list.some(e => e.id === current.id)) list.unshift(Object.assign({}, current, { status: "in_progress_local" }));
      list = list.filter(e => e.status !== "in_progress" || (current && current.id === e.id));
      list.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
      list = list.filter(e => filter.match(e.startedAt));
      if (!list.length) { box.append(el("p", { class: "empty small" }, "No exams yet for these dates.")); return; }
      for (const e of list) {
        const st = e.status === "released" ? ["✨ Results are ready!", "released"] : e.status === "submitted" ? ["⏳ Waiting for Mom to review", "waiting"] : e.status === "pending" ? ["📶 Saved on this device - will send when online", "waiting"] : ["✏️ In progress", "inprog"];
        const card_ = el("details", { class: "panel histcard " + st[1] });
        card_.append(el("summary", {}, e.status === "released" ? el("span", { class: "grade g" + e.grade }, e.grade) : null, el("span", {}, el("b", {}, e.title || (NAME + "'s Exam")), el("br"), el("span", { class: "small" }, "Started " + fmtDate(e.startedAt) + (e.submittedAt ? " • Submitted " + fmtDate(e.submittedAt) : "") + " • " + (e.count || (e.items || []).length) + " questions")), el("span", { class: "badge" }, st[0])));
        if (e.status === "released") {
          card_.append(el("p", { class: "score" }, `Score: ${e.max ? e.score + " / " + e.max + " (" + e.percent + "%)" : "-"} • Grade: ${e.grade}`));
          if (e.note) card_.append(el("div", { class: "momnote big" }, "💬 Mom says: " + e.note));
          const ol = el("ol", { class: "revlist" }); (e.questions || []).forEach(q => ol.append(resultItem(q))); card_.append(ol);
        } else if (e.status === "submitted" || e.status === "pending") card_.append(el("p", {}, "Mom hasn't reviewed this exam yet. Your results will show here when she releases them."));
        else card_.append(el("p", {}, "Scroll down to keep going with this exam."));
        box.append(card_);
      }
    }
    function startExam() {
      const cats = selectedCats(); if (!cats.length) { alert("Pick at least one subject first!"); return; }
      const n = +$("#howmany").value; const limit = +$("#timer").value || 0;
      const seen = new Set(S.get("seen", []));
      const per = cats.map(k => { const all = BANK[k].items.slice().sort(() => Math.random() - 0.5); const fresh = all.filter(i => !seen.has(i.id)); return fresh.length ? fresh.concat(all.filter(i => seen.has(i.id))) : all; });
      const out = []; while (out.length < n && per.some(a => a.length)) for (const a of per) if (a.length && out.length < n) out.push(a.shift());
      const items = out.sort(() => Math.random() - 0.5).map(i => i.id);
      S.set("seen", [...seen, ...items].slice(-2000));
      const subjects = cats.map(k => BANK[k].name.split(" - ")[0].replace(/ with .*$/, ""));
      const num = (serverExams || []).length + 1;
      current = { id: KID + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8), kid: KID, title: `${NAME}'s Exam #${num}`, subtitle: subjects.length > 4 ? subjects.length + " subjects (mixed)" : subjects.join(", "), cats, items, timeLimit: limit || null, startedAt: new Date().toISOString(), responses: {} };
      S.set("current", current);
      api("/api/exams", { method: "POST", body: JSON.stringify({ action: "start", exam: current }) }).then(r => { if (current && r.exam) { current.title = r.exam.title; S.set("current", current); const h = $("#exam-title"); if (h) h.textContent = "📝 " + current.title; } }).catch(() => queue("start", current));
      renderExam(); renderHistory(); window.scrollTo({ top: $("#exam").offsetTop - 10, behavior: "smooth" });
    }
    function save() { S.set("current", current); updateAnswered(); }
    function setResp(id, v) { current.responses[id] = v; save(); }
    function updateAnswered() {
      if (!current) return;
      const n = current.items.filter(id => isAnswered(index[KID][id], current.responses[id])).length;
      const a = $("#answered"); if (a) a.textContent = `${n} of ${current.items.length} answered`;
      $$("#exam .qcard").forEach(c => c.classList.toggle("answered", isAnswered(index[KID][c.dataset.id], current.responses[c.dataset.id])));
    }
    function tick() {
      if (!current) return; const t = $("#timer-display"); if (!t) return;
      const secs = (Date.now() - Date.parse(current.startedAt)) / 1000;
      if (current.timeLimit) { const left = current.timeLimit * 60 - secs; t.textContent = left >= 0 ? "⏱ " + fmtTime(left) + " left" : "⏱ Time is up (+" + fmtTime(-left) + ") - you can still finish"; t.classList.toggle("over", left < 0); }
      else t.textContent = "⏱ " + fmtTime(secs);
    }
    function qcard(it, num) {
      const r = current.responses[it.id];
      const c = el("article", { class: "card qcard", "data-id": it.id });
      c.append(el("div", { class: "card-head" }, el("span", { class: "num" }, "Question " + num), el("span", { class: "tag" }, BANK[it.cat].icon + " " + BANK[it.cat].name), el("span", { class: "status" })));
      const q = el("p", { class: "q" }, it.q.replace(/^Riddle: /, ""));
      if (it.say) q.append(" ", el("button", { class: "say", type: "button", title: "Read it to me", onclick: () => speak(it.lang === "es" ? it.word : it.say, it.lang === "es" ? "es-ES" : "en-US") }, "🔊"));
      c.append(q);
      const body = el("div", { class: "body" }); c.append(body);
      if (it.pic) body.append(el("div", { class: "pic" + (it.pic.length > 14 ? " many" : "") }, it.pic));
      const pickRow = (labels, isHTML, onPick, sel) => {
        const row = el("div", { class: "choices" + (it.big || isHTML ? " big" : "") });
        labels.forEach((lab, i) => { const b = el("button", { type: "button", class: "choice" + (sel === i ? " picked" : ""), "aria-pressed": sel === i ? "true" : "false", onclick: () => { $$(".choice", row).forEach(x => { x.classList.remove("picked"); x.setAttribute("aria-pressed", "false"); }); b.classList.add("picked"); b.setAttribute("aria-pressed", "true"); onPick(i); } }); if (isHTML) b.innerHTML = lab; else b.textContent = (it.big ? "" : LETTERS[i] + ". ") + lab; row.append(b); });
        return row;
      };
      switch (it.type) {
        case "mc": body.append(pickRow(it.choices, false, i => setResp(it.id, i), r)); break;
        case "shape": body.append(pickRow(it.shapes.map((s, i) => shapeSVG(s, it.colors[i])), true, i => setResp(it.id, i), r)); break;
        case "input": case "chess": case "notes": {
          if (it.type === "chess") body.append(boardEl(it.fen), pieceList(it.fen));
          if (it.type === "notes") body.append(el("div", { html: staffSVG(it.notes) }));
          const numeric = it.sub && /Adding|Subtracting|Repeated|Groups|Word problems|Money|Skip|Riddles|maths/i.test(it.sub) || /How many/.test(it.q);
          const x = el("input", { type: "text", class: "ans", "aria-label": "Your answer", placeholder: it.type === "chess" ? "Your move, e.g. Nf6" : "Your answer", inputmode: numeric ? "numeric" : "text", autocomplete: "off", value: r || "" });
          x.addEventListener("input", () => setResp(it.id, x.value));
          body.append(el("div", { class: "row" }, x)); break;
        }
        case "sudoku": {
          const g = el("div", { class: "sudoku" }); const cur = (r && r.length === 81) ? r : it.puzzle;
          [...it.puzzle].forEach((ch, i) => {
            const row = Math.floor(i / 9), col = i % 9; const cls = "cell" + (col % 3 === 2 && col < 8 ? " br" : "") + (row % 3 === 2 && row < 8 ? " bb" : "");
            if (ch !== "0") g.append(el("div", { class: cls + " given" }, ch));
            else { const inp = el("input", { class: cls, maxlength: "1", inputmode: "numeric", "aria-label": "row " + (row + 1) + " column " + (col + 1), "data-i": i, value: cur[i] !== "0" ? cur[i] : "" }); inp.addEventListener("input", () => { inp.value = inp.value.replace(/[^1-9]/g, ""); const arr = [...it.puzzle]; $$("input", g).forEach(y => { arr[+y.dataset.i] = y.value || "0"; }); setResp(it.id, arr.join("")); }); g.append(inp); }
          });
          body.append(g); break;
        }
        case "order": {
          const vals = Array.isArray(r) ? r.slice() : ["", "", "", ""];
          body.append(el("div", { class: "order" }, [0, 1, 2, 3].map(i => el("label", {}, ORD[i] + ": ", (() => { const s = el("select", { "aria-label": ORD[i] }, el("option", { value: "" }, "-"), it.options.map(o => el("option", { value: o, selected: vals[i] === o ? "" : false }, o))); s.addEventListener("change", () => { vals[i] = s.value; setResp(it.id, vals.slice()); }); return s; })())))); break;
        }
        case "reading": {
          body.append(el("div", { class: "passage" }, it.passage.split("\n").map(p => el("p", {}, p))));
          const vals = Array.isArray(r) ? r.slice() : it.questions.map(() => null);
          it.questions.forEach((qq, qi) => { body.append(el("p", { class: "subq" }, (qi + 1) + ". " + qq.q)); const row = el("div", { class: "choices" }); qq.choices.forEach((ch, i) => { const b = el("button", { type: "button", class: "choice" + (vals[qi] === i ? " picked" : ""), onclick: () => { $$(".choice", row).forEach(x => x.classList.remove("picked")); b.classList.add("picked"); vals[qi] = i; setResp(it.id, vals.slice()); } }, LETTERS[i] + ". " + ch); row.append(b); }); body.append(row); });
          break;
        }
        case "trace": body.append(el("div", { class: "trace-wrap", html: traceSVG(it.text) })); // falls through
        default: {
          if (it.box) body.append(el("div", { class: "drawbox" }, "Draw on the printed exam paper"));
          body.append(el("label", { class: "chip didit" }, el("input", { type: "checkbox", checked: r ? "" : false, onchange: e => setResp(it.id, e.target.checked) }), " I did it!"));
        }
      }
      return c;
    }
    function renderExam() {
      const box = $("#exam"); box.innerHTML = ""; clearInterval(timerId);
      $("#setup").hidden = !!current;
      if (!current) return;
      const items = current.items.map(id => index[KID][id]).filter(Boolean);
      box.append(el("div", { class: "panel examhead" }, el("h2", { id: "exam-title" }, "📝 " + current.title),
        el("p", { class: "small" }, current.subtitle + " • " + items.length + " questions" + (current.timeLimit ? " • " + current.timeLimit + " minute timer (just a guide)" : "") + " • Started " + fmtDate(current.startedAt)),
        el("p", { class: "small" }, "Read each question carefully. You can change answers until you press Submit. You only get to submit once!")));
      box.append(el("div", { class: "examstatus" }, el("span", { id: "timer-display", class: "timer" }), el("span", { id: "answered", class: "answered" })));
      items.forEach((it, i) => box.append(qcard(it, i + 1)));
      box.append(el("div", { class: "panel submitbar" }, el("button", { type: "button", class: "btn big", id: "submit", onclick: submit }, "✅ Submit Exam"), el("button", { type: "button", class: "btn ghost", onclick: () => doPrint(examPaperHTML(KID, current, null)) }, "🖨️ Print exam paper")));
      updateAnswered(); tick(); timerId = setInterval(tick, 1000);
    }
    async function submit() {
      if (!current) return;
      const unanswered = current.items.filter(id => !isAnswered(index[KID][id], current.responses[id])).length;
      if (!confirm((unanswered ? `${unanswered} question${unanswered > 1 ? "s are" : " is"} not answered yet.\n\n` : "") + "Submit your exam? You can only submit once.")) return;
      const ex = Object.assign({}, current, { submittedAt: new Date().toISOString() });
      const btn = $("#submit"); if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      let sent = false, msg = "";
      try { await api("/api/exams", { method: "POST", body: JSON.stringify({ action: "submit", exam: ex }) }); sent = true; }
      catch (e) { if (e.status === 409) { sent = true; msg = "This exam was already submitted."; } else if (e.status && e.status < 500) { if (btn) { btn.disabled = false; btn.textContent = "✅ Submit Exam"; } alert("Could not submit: " + e.message); return; } else queue("submit", ex); }
      S.del("current"); current = null; clearInterval(timerId);
      const box = $("#exam"); box.innerHTML = "";
      box.append(el("div", { class: "panel done-panel" }, el("div", { class: "bigemoji" }, "🎉"), el("h2", {}, "Exam submitted!"),
        el("p", {}, msg || (sent ? `Sent to Mom on ${fmtDate(ex.submittedAt)}.` : "No internet right now - your exam is saved on this device and will be sent automatically.")),
        el("p", {}, "Great work, " + NAME + "! Mom will review your exam. You'll see your results under My Exams after she releases them."),
        el("button", { type: "button", class: "btn", onclick: () => { box.innerHTML = ""; $("#setup").hidden = false; window.scrollTo({ top: 0, behavior: "smooth" }); } }, "Start a new exam")));
      $("#setup").hidden = true; await loadHistory(); window.scrollTo({ top: box.offsetTop - 10, behavior: "smooth" });
    }
    function printBlank() {
      const cats = selectedCats(); if (!cats.length) { alert("Pick at least one subject first!"); return; }
      const n = +$("#howmany").value; const per = cats.map(k => BANK[k].items.slice().sort(() => Math.random() - 0.5));
      const out = []; while (out.length < n && per.some(a => a.length)) for (const a of per) if (a.length && out.length < n) out.push(a.shift());
      doPrint(examPaperHTML(KID, { title: `${NAME}'s Exam (paper)`, subtitle: cats.map(k => BANK[k].name.split(" - ")[0]).join(", "), items: out.map(i => i.id), timeLimit: +$("#timer").value || null }, null));
    }
    // originals
    $$(".orig").forEach(sec => {
      const key = "orig:" + sec.dataset.page; const cb = sec.querySelector(".tick input");
      if (cb) { cb.checked = !!S.get(key, false); sec.classList.toggle("solved", cb.checked); cb.addEventListener("change", () => { S.set(key, cb.checked); sec.classList.toggle("solved", cb.checked); }); }
      const pb = sec.querySelector(".print-one"); if (pb) pb.addEventListener("click", () => doPrint(`<img class="pagefull" src="${sec.querySelector("img").getAttribute("src")}" alt="">`));
    });
    const all = $("#print-all-orig"); if (all) all.addEventListener("click", () => doPrint($$(".orig img").map(i => `<img class="pagefull" src="${i.getAttribute("src")}" alt="">`).join("")));
    const btns = $$(".tabs button");
    const show = id => { btns.forEach(b => b.setAttribute("aria-selected", b.dataset.tab === id)); $$(".tabpane").forEach(p => p.hidden = p.id !== id); S.set("tab", id); if (id === "history-tab") loadHistory(); };
    btns.forEach(b => b.addEventListener("click", () => show(b.dataset.tab)));
    filter = dateFilterEl(renderHistory); $("#history-filter").append(filter);
    renderCats(); renderExam();
    show(location.hash === "#original" ? "original" : location.hash === "#my-exams" ? "history-tab" : S.get("tab", "exam-tab"));
    loadHistory().then(flush);
    $("#start").addEventListener("click", startExam);
    $("#all").addEventListener("click", () => { $$("#cats input").forEach(x => x.checked = true); S.set("cats", selectedCats()); });
    $("#none").addEventListener("click", () => { $$("#cats input").forEach(x => x.checked = false); S.set("cats", []); });
    $("#print-paper").addEventListener("click", printBlank);
    $("#refresh-history").addEventListener("click", loadHistory);
  }

  // =====================================================================
  // PARENT PAGE: PIN gate + review, notes, release
  // =====================================================================
  function reviewPage() {
    let kid = new URLSearchParams(location.search).get("kid") || store.get("review", "kid", "ayden");
    let token = sessionStorage.getItem("kap:parent:token") || "";
    let exams = []; let filter;
    const authed = (body) => api("/api/parent", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body) });
    const gate = $("#gate"), main = $("#review-main");
    async function boot() {
      if (token) { main.hidden = false; gate.hidden = true; return loadList(); }
      main.hidden = true; gate.hidden = false; gate.innerHTML = "";
      let status; try { status = await api("/api/parent"); } catch (e) { gate.append(el("p", { class: "panel" }, "Can't reach the server right now. Check the internet connection and reload.")); return; }
      const pin = el("input", { type: "password", inputmode: "numeric", autocomplete: status.pinSet ? "current-password" : "new-password", pattern: "[0-9]*", maxlength: "8", class: "ans pin", "aria-label": "Parent PIN", placeholder: "PIN" });
      const pin2 = el("input", { type: "password", inputmode: "numeric", autocomplete: "new-password", pattern: "[0-9]*", maxlength: "8", class: "ans pin", "aria-label": "Repeat PIN", placeholder: "Repeat PIN" });
      const msg = el("p", { class: "feedback bad", "aria-live": "polite" });
      const go = async () => {
        msg.textContent = "";
        if (!/^\d{4,8}$/.test(pin.value)) { msg.textContent = "Use 4 to 8 digits."; return; }
        if (!status.pinSet && pin.value !== pin2.value) { msg.textContent = "The two PINs don't match."; return; }
        try { const r = await api("/api/parent", { method: "POST", body: JSON.stringify({ action: status.pinSet ? "login" : "setup", pin: pin.value }) }); token = r.token; sessionStorage.setItem("kap:parent:token", token); pin.value = pin2.value = ""; boot(); }
        catch (e) { msg.textContent = e.message; if (e.status === 409) boot(); }
      };
      [pin, pin2].forEach(x => x.addEventListener("keydown", e => { if (e.key === "Enter") go(); }));
      gate.append(el("div", { class: "panel gatepanel" }, el("div", { class: "bigemoji" }, "🔒"),
        el("h2", {}, status.pinSet ? "Enter the parent PIN" : "Create a parent PIN"),
        el("p", { class: "small" }, status.pinSet ? "Only grown-ups can review exams and release results." : "First time here: choose a 4-8 digit PIN that the kids don't know. You'll need it every time you review exams."),
        el("div", { class: "pinrow" }, pin, status.pinSet ? null : pin2), el("button", { type: "button", class: "btn big", onclick: go }, status.pinSet ? "Unlock" : "Save PIN"), msg));
      pin.focus();
    }
    async function loadList() {
      store.set("review", "kid", kid);
      $$(".kidtabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.kid === kid));
      const box = $("#review"); box.innerHTML = "<p class='small'>Loading…</p>";
      try { exams = (await authed({ action: "list", kid })).exams; }
      catch (e) { if (e.status === 401) { token = ""; sessionStorage.removeItem("kap:parent:token"); return boot(); } box.innerHTML = ""; box.append(el("p", { class: "panel" }, "Couldn't load exams: " + e.message)); return; }
      render();
    }
    function render(openId) {
      const box = $("#review"); box.innerHTML = "";
      const list = exams.filter(e => filter.match(e.startedAt));
      const done = list.filter(e => e.status !== "in_progress" && e.max);
      const avg = done.length ? Math.round(done.reduce((a, e) => a + e.percent, 0) / done.length) : null;
      const toReview = exams.filter(e => e.status === "submitted").length;
      box.append(el("div", { class: "panel" }, el("h2", {}, `${NAMES[kid]}: ${list.length} exam${list.length === 1 ? "" : "s"}` + (list.length !== exams.length ? ` (of ${exams.length})` : "")),
        el("p", {}, (toReview ? `🔔 ${toReview} waiting for your review. ` : "") + (avg != null ? `Average: ${avg}% (${avg >= 90 ? "A" : avg >= 80 ? "B" : avg >= 70 ? "C" : avg >= 60 ? "D" : "F"})` : "")),
        list.length ? el("table", { class: "gradebook" }, el("thead", {}, el("tr", {}, ["Exam", "Score", "Grade"].map(h => el("th", {}, h)))),
          el("tbody", {}, list.map(e => el("tr", {}, el("td", {}, el("a", { href: "#" + e.id, onclick: () => { const d = document.getElementById(e.id); if (d) d.open = true; } }, e.title), el("div", { class: "small" }, `Started ${e.startedAtChicago}${e.submittedAtChicago ? " • Submitted " + e.submittedAtChicago : ""} • ${e.count} questions`), el("div", { class: "small statusline" }, statusText(e))),
            el("td", {}, e.max ? `${e.score}/${e.max} (${e.percent}%)` : "-"), el("td", {}, e.status === "in_progress" ? "" : el("span", { class: "grade g" + e.grade }, e.grade)))))) : el("p", { class: "small" }, "No exams for these dates.")));
      list.forEach(e => box.append(examDetail(e, e.id === openId)));
    }
    const statusText = e => e.status === "released" ? "✅ Released to " + NAMES[kid] + " " + (e.releasedAtChicago || "") : e.status === "submitted" ? "🔔 Waiting for your review" : "✏️ In progress (not submitted yet)";
    async function act(e, body) {
      try { const r = await authed(Object.assign({ kid, id: e.id }, body)); const i = exams.findIndex(x => x.id === e.id); if (r.exam) exams[i] = r.exam; else if (body.action === "delete") exams.splice(i, 1); render(e.id); const d = document.getElementById(e.id); if (d) d.scrollIntoView({ block: "start" }); }
      catch (err) { if (err.status === 401) { token = ""; sessionStorage.removeItem("kap:parent:token"); return boot(); } alert(err.message); }
    }
    function examDetail(e, open) {
      const d = el("details", { class: "panel examrev", id: e.id, open: open ? "" : false });
      d.append(el("summary", {}, e.status === "in_progress" ? null : el("span", { class: "grade g" + e.grade }, e.grade), el("span", {}, ` ${e.title} - ${e.status === "in_progress" ? "in progress" : e.max ? e.score + "/" + e.max + " (" + e.percent + "%)" : "no auto-graded questions"}`), el("span", { class: "badge" }, statusText(e))));
      d.append(el("p", { class: "small" }, `${e.subtitle} • ${e.count} questions • Started ${e.startedAtChicago}${e.submittedAtChicago ? " • Submitted " + e.submittedAtChicago : ""}${e.durationSec != null ? " • took " + fmtTime(e.durationSec) : ""}${e.timeLimit ? " (timer " + e.timeLimit + " min)" : ""}${e.selfTotal ? ` • ${e.selfDone}/${e.selfTotal} activities ticked "I did it" - mark them below` : ""}`));
      if (e.status === "in_progress") { d.append(el("button", { type: "button", class: "btn ghost danger", onclick: () => { if (confirm("Delete " + e.title + "?")) act(e, { action: "delete" }); } }, "Delete")); return d; }
      const ol = el("ol", { class: "revlist" });
      e.questions.forEach(q => ol.append(resultItem(q, q => {
        const isSelf = q.type === "open" || q.type === "trace";
        const note = el("input", { type: "text", class: "ans notein", placeholder: "Note for " + NAMES[kid] + " (optional)", value: q.note || "", maxlength: "300" });
        note.addEventListener("change", () => act(e, { action: "note", qid: q.id, text: note.value }));
        return el("div", { class: "controls" },
          el("button", { type: "button", class: "btn tiny", onclick: () => act(e, { action: "override", qid: q.id, value: true }) }, isSelf ? "Mark done ✓" : "Mark correct"),
          el("button", { type: "button", class: "btn tiny ghost", onclick: () => act(e, { action: "override", qid: q.id, value: false }) }, isSelf ? "Mark not done" : "Mark wrong"),
          /marked by Mom/.test(q.label) ? el("button", { type: "button", class: "btn tiny ghost", onclick: () => act(e, { action: "override", qid: q.id, value: null }) }, "Undo") : null, note);
      })));
      d.append(ol);
      const overall = el("textarea", { class: "ans overall", rows: "2", placeholder: "Overall note for " + NAMES[kid] + " (shown with the results)", maxlength: "1000" }, e.note || "");
      d.append(el("label", { class: "small" }, "Mom's note"), overall, el("div", { class: "controls" }, el("button", { type: "button", class: "btn tiny ghost", onclick: () => act(e, { action: "note", text: overall.value }) }, "Save note")));
      d.append(el("div", { class: "controls releasebar" },
        e.status === "released" ? el("button", { type: "button", class: "btn ghost", onclick: () => act(e, { action: "release", value: false }) }, "↩️ Hide results from " + NAMES[kid]) : el("button", { type: "button", class: "btn big release", onclick: async () => { if (overall.value !== (e.note || "")) await act(e, { action: "note", text: overall.value }); const cur = exams.find(x => x.id === e.id) || e; act(cur, { action: "release", value: true }); } }, "📤 Release to " + NAMES[kid]),
        el("button", { type: "button", class: "btn ghost", onclick: () => doPrint(examPaperHTML(kid, { title: e.title, subtitle: e.subtitle, items: e.questions.map(q => q.id), timeLimit: e.timeLimit, startedAt: e.startedAt }, e.questions)) }, "🖨️ Print with answer key"),
        el("button", { type: "button", class: "btn ghost danger", onclick: () => { if (confirm("Delete " + e.title + "? This cannot be undone.")) act(e, { action: "delete" }); } }, "Delete exam")));
      return d;
    }
    async function showKeyPage() {
      const box = $("#keypage"); box.innerHTML = "<p class='small'>Loading…</p>";
      try { const k = await authed({ action: "keypage" }); const url = URL.createObjectURL(new Blob([k.svg], { type: "image/svg+xml" })); box.innerHTML = ""; box.append(el("img", { src: url, alt: k.title, class: "keyimg" }), el("details", {}, el("summary", {}, "Show the text of this page"), el("pre", { class: "small", style: "white-space:pre-wrap" }, k.text)), el("button", { type: "button", class: "btn ghost", onclick: () => doPrint(`<img class="pagefull" src="${url}" alt="">`) }, "🖨️ Print the answer key")); }
      catch (e) { box.innerHTML = ""; box.append(el("p", {}, e.message)); }
    }
    async function resetPin() {
      const p = prompt("To change the PIN, enter the CURRENT parent PIN. You'll then create a new one."); if (!p) return;
      try { await authed({ action: "reset", pin: p }); token = ""; sessionStorage.removeItem("kap:parent:token"); alert("PIN cleared. Create a new PIN now."); boot(); } catch (e) { alert(e.message); }
    }
    $$(".kidtabs button").forEach(b => b.addEventListener("click", () => { kid = b.dataset.kid; loadList(); }));
    filter = dateFilterEl(() => render()); $("#review-filter").append(filter);
    $("#lock").addEventListener("click", () => { token = ""; sessionStorage.removeItem("kap:parent:token"); boot(); });
    $("#change-pin").addEventListener("click", resetPin);
    $("#refresh").addEventListener("click", loadList);
    $("#keypage-btn").addEventListener("click", showKeyPage);
    boot();
  }

  const KID = document.body.dataset.kid;
  if (KID && BANKS[KID]) kidPage(KID);
  else if (document.body.dataset.page === "review") reviewPage();
})();
