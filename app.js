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
  const fmtDate = t => new Date(t).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  // ---------- grading ----------
  const norm = s => String(s).toLowerCase().replace(/\b(am|pm|cents?|pounds?)\b/g, "").replace(/[.,]+$/g, "").replace(/\s+/g, " ").trim();
  const chessNorm = s => String(s).toLowerCase().replace(/[\s+#x\-=!?:]/g, "");
  const SELF = t => t === "open" || t === "trace";
  function grade(it, r) {
    // returns {pts, max, answered}
    const blank = r == null || r === "" || (Array.isArray(r) && r.every(x => x == null || x === ""));
    switch (it.type) {
      case "mc": case "shape": return { pts: r === it.answer ? 1 : 0, max: 1, answered: !blank };
      case "input": { const v = String(r || ""); const ok = !!v.trim() && it.answer.some(a => norm(a) === norm(v) || norm(a).replace(/\s/g, "") === norm(v).replace(/[\s,]/g, "")); return { pts: ok ? 1 : 0, max: 1, answered: !blank }; }
      case "chess": { const v = String(r || ""); const ok = !!v.trim() && (it.answer.some(a => chessNorm(a) === chessNorm(v)) || chessNorm(v) === it.answer[1].slice(2)); return { pts: ok ? 1 : 0, max: 1, answered: !blank }; }
      case "notes": { const v = String(r || "").replace(/[\s,\-]/g, "").toUpperCase(); return { pts: v && it.answer.some(a => a.replace(/\s/g, "").toUpperCase() === v) ? 1 : 0, max: 1, answered: !blank }; }
      case "sudoku": { const v = String(r || ""); const ok = v.length === 81 && v === it.answer[0]; return { pts: ok ? 1 : 0, max: 1, answered: !!v.replace(/0/g, "") && v !== it.puzzle }; }
      case "order": return { pts: Array.isArray(r) && r.every((x, i) => x === it.answer[i]) ? 1 : 0, max: 1, answered: !blank };
      case "reading": { const a = Array.isArray(r) ? r : []; return { pts: it.questions.filter((q, i) => a[i] === q.answer).length, max: it.questions.length, answered: a.some(x => x != null) }; }
      default: return { pts: 0, max: 0, answered: !!r, self: true }; // open / trace: Mom checks
    }
  }
  function letter(p) { return p >= 90 ? "A" : p >= 80 ? "B" : p >= 70 ? "C" : p >= 60 ? "D" : "F"; }
  function scoreExam(kid, ex) {
    let pts = 0, max = 0, answered = 0, selfDone = 0, selfTotal = 0;
    ex.results = {};
    for (const id of ex.items) {
      const it = index[kid][id]; if (!it) continue;
      let g = grade(it, ex.responses[id]);
      const ov = (ex.overrides || {})[id];
      if (SELF(it.type)) { selfTotal++; if (g.answered) selfDone++; if (ov != null) g = { pts: ov ? 1 : 0, max: 1, answered: g.answered, self: true, override: true }; }
      else if (ov != null) g = { pts: ov ? g.max || 1 : 0, max: g.max || 1, answered: g.answered, override: true };
      ex.results[id] = g; pts += g.pts; max += g.max; if (g.answered) answered++;
    }
    ex.score = pts; ex.max = max; ex.answered = answered; ex.selfDone = selfDone; ex.selfTotal = selfTotal;
    ex.percent = max ? Math.round(100 * pts / max) : null; ex.grade = max ? letter(ex.percent) : "-";
    return ex;
  }
  function answerText(it) {
    switch (it.type) {
      case "mc": return it.choices[it.answer];
      case "input": return it.explain || it.answer[0];
      case "chess": return it.explain;
      case "notes": return it.answer[0];
      case "order": return it.answer.map((n, i) => ORD[i] + " " + n).join(", ");
      case "shape": return it.shapes[it.answer];
      case "reading": return it.questions.map((q, i) => (i + 1) + ". " + q.choices[q.answer]).join("  ");
      case "sudoku": return "(see solution grid)";
      default: return "Mom checks";
    }
  }
  function responseText(it, r) {
    if (r == null || r === "") return "(no answer)";
    switch (it.type) {
      case "mc": return it.choices[r] != null ? it.choices[r] : "(no answer)";
      case "shape": return it.shapes[r] || "(no answer)";
      case "order": return r.map((n, i) => ORD[i] + " " + (n || "-")).join(", ");
      case "reading": return it.questions.map((q, i) => (i + 1) + ". " + (r[i] != null ? q.choices[r[i]] : "-")).join("  ");
      case "sudoku": { const filled = [...r].filter((c, i) => it.puzzle[i] === "0" && c !== "0").length; const right = [...r].filter((c, i) => it.puzzle[i] === "0" && c === it.answer[0][i]).length; const empty = [...it.puzzle].filter(c => c === "0").length; return `${filled}/${empty} squares filled, ${right} correct`; }
      case "open": case "trace": return r ? "Ticked 'I did it'" : "Not ticked";
      default: return String(r);
    }
  }

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
  function examPaperHTML(kid, ex, withKey) {
    const items = ex.items.map(id => index[kid][id]).filter(Boolean);
    let h = `<header class="phead"><h1>${esc(ex.title)}</h1><p>${esc(ex.subtitle)} • ${items.length} questions${ex.timeLimit ? " • Suggested time: " + ex.timeLimit + " minutes" : ""}</p><p>Name: ________________ Date: ____________ Score: ______</p></header>`;
    h += items.map((it, i) => printItem(it, i + 1)).join("");
    if (withKey) h += `<section class="pkey"><h2>Answer key - For Mom</h2><ol>${items.map(it => it.type === "sudoku" ? `<li>Sudoku solution:${sudokuHTML(it.puzzle, it.answer[0], true)}</li>` : `<li>${esc(answerText(it))}</li>`).join("")}</ol></section>`;
    return h;
  }
  function doPrint(html) {
    const pa = $("#print-area"); pa.innerHTML = html; document.body.classList.add("printing");
    const imgs = $$("img", pa);
    Promise.all(imgs.map(im => im.complete ? 1 : new Promise(r => { im.onload = im.onerror = r; }))).then(() => setTimeout(() => window.print(), 50));
  }
  window.addEventListener("afterprint", () => { document.body.classList.remove("printing"); const pa = $("#print-area"); if (pa) pa.innerHTML = ""; });

  // =====================================================================
  // KID PAGE: exam flow
  // =====================================================================
  function kidPage(KID) {
    const BANK = BANKS[KID]; const NAME = NAMES[KID];
    const S = { get: (k, d) => store.get(KID, k, d), set: (k, v) => store.set(KID, k, v), del: k => store.del(KID, k) };
    let current = S.get("current", null); // exam in progress
    let timerId = null;
    const selectedCats = () => $$("#cats input:checked").map(x => x.value);

    function renderCats() {
      const box = $("#cats"); box.innerHTML = ""; const saved = S.get("cats", Object.keys(BANK));
      for (const [k, c] of Object.entries(BANK)) box.append(el("label", { class: "chip" }, el("input", { type: "checkbox", value: k, checked: saved.includes(k) ? "" : false, onchange: () => S.set("cats", selectedCats()) }), " " + c.icon + " " + c.name + " ", el("span", { class: "count" }, "(" + c.items.length + ")")));
    }
    function stats() {
      const exams = S.get("exams", []);
      const p = $("#progress"); if (p) p.textContent = exams.length ? `${exams.length} exam${exams.length > 1 ? "s" : ""} submitted` : "Ready for your first exam?";
    }
    function startExam() {
      const cats = selectedCats(); if (!cats.length) { alert("Pick at least one subject first!"); return; }
      const n = +$("#howmany").value; const limit = +$("#timer").value || 0;
      const exams = S.get("exams", []);
      const seen = new Set(exams.flatMap(e => e.items));
      let per = cats.map(k => { const all = BANK[k].items.slice().sort(() => Math.random() - 0.5); const fresh = all.filter(i => !seen.has(i.id)); return fresh.length ? fresh.concat(all.filter(i => seen.has(i.id))) : all; });
      const out = []; while (out.length < n && per.some(a => a.length)) for (const a of per) if (a.length && out.length < n) out.push(a.shift());
      const items = out.sort(() => Math.random() - 0.5).map(i => i.id);
      const num = exams.length + 1;
      const subjects = cats.map(k => BANK[k].name.split(" - ")[0].replace(/ with .*$/, ""));
      current = { id: KID + "-" + Date.now(), kid: KID, number: num, title: `${NAME}'s Exam #${num}`, subtitle: subjects.length > 4 ? subjects.length + " subjects (mixed)" : subjects.join(", "), cats, items, timeLimit: limit || null, createdAt: Date.now(), startedAt: Date.now(), responses: {} };
      S.set("current", current); renderExam(); window.scrollTo({ top: $("#exam").offsetTop - 10, behavior: "smooth" });
    }
    function save() { S.set("current", current); updateAnswered(); }
    function setResp(id, v) { current.responses[id] = v; save(); }
    function updateAnswered() {
      if (!current) return;
      const n = current.items.filter(id => grade(index[KID][id], current.responses[id]).answered).length;
      const a = $("#answered"); if (a) a.textContent = `${n} of ${current.items.length} answered`;
      $$("#exam .qcard").forEach(c => c.classList.toggle("answered", grade(index[KID][c.dataset.id], current.responses[c.dataset.id]).answered));
    }
    function tick() {
      if (!current) return; const t = $("#timer-display"); if (!t) return;
      const el_ = (Date.now() - current.startedAt) / 1000;
      if (current.timeLimit) { const left = current.timeLimit * 60 - el_; t.textContent = left >= 0 ? "⏱ " + fmtTime(left) + " left" : "⏱ Time is up (+" + fmtTime(-left) + ") - you can still finish"; t.classList.toggle("over", left < 0); }
      else t.textContent = "⏱ " + fmtTime(el_);
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
          const x = el("input", { type: "text", class: "ans", "aria-label": "Your answer", placeholder: it.type === "chess" ? "Your move, e.g. Nf6" : "Your answer", inputmode: /^\d+$/.test(it.answer[0]) ? "numeric" : "text", autocomplete: "off", value: r || "" });
          x.addEventListener("input", () => setResp(it.id, x.value));
          body.append(el("div", { class: "row" }, x));
          break;
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
          body.append(el("div", { class: "order" }, [0, 1, 2, 3].map(i => el("label", {}, ORD[i] + ": ", (() => { const s = el("select", { "aria-label": ORD[i] }, el("option", { value: "" }, "-"), it.options.map(o => el("option", { value: o, selected: vals[i] === o ? "" : false }, o))); s.addEventListener("change", () => { vals[i] = s.value; setResp(it.id, vals.slice()); }); return s; })()))));
          break;
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
      box.append(el("div", { class: "panel examhead" },
        el("h2", {}, "📝 " + current.title),
        el("p", { class: "small" }, current.subtitle + " • " + items.length + " questions" + (current.timeLimit ? " • " + current.timeLimit + " minute timer (just a guide)" : "")),
        el("p", { class: "small" }, "Read each question carefully. You can change answers until you press Submit. You only get to submit once!")));
      box.append(el("div", { class: "examstatus" }, el("span", { id: "timer-display", class: "timer" }), el("span", { id: "answered", class: "answered" })));
      items.forEach((it, i) => box.append(qcard(it, i + 1)));
      box.append(el("div", { class: "panel submitbar" }, el("button", { type: "button", class: "btn big", onclick: submit }, "✅ Submit Exam"), el("button", { type: "button", class: "btn ghost", onclick: () => doPrint(examPaperHTML(KID, current, false)) }, "🖨️ Print exam paper")));
      updateAnswered(); tick(); timerId = setInterval(tick, 1000);
    }
    function submit() {
      if (!current) return;
      const unanswered = current.items.filter(id => !grade(index[KID][id], current.responses[id]).answered).length;
      if (!confirm((unanswered ? `${unanswered} question${unanswered > 1 ? "s are" : " is"} not answered yet.\n\n` : "") + "Submit your exam? You can only submit once.")) return;
      const ex = current; ex.submittedAt = Date.now(); ex.durationSec = Math.round((ex.submittedAt - ex.startedAt) / 1000);
      scoreExam(KID, ex);
      const exams = S.get("exams", []); exams.push(ex); S.set("exams", exams); S.del("current"); current = null; clearInterval(timerId);
      const box = $("#exam"); box.innerHTML = "";
      box.append(el("div", { class: "panel done-panel" }, el("div", { class: "bigemoji" }, "🎉"), el("h2", {}, "Exam submitted!"), el("p", {}, `You answered ${ex.answered} of ${ex.items.length} questions in ${fmtTime(ex.durationSec)}.`), el("p", {}, "Great work, " + NAME + "! Mom will review your exam and give you your grade."), el("button", { type: "button", class: "btn", onclick: () => { box.innerHTML = ""; $("#setup").hidden = false; window.scrollTo({ top: 0, behavior: "smooth" }); } }, "Start a new exam")));
      $("#setup").hidden = true; stats(); window.scrollTo({ top: box.offsetTop - 10, behavior: "smooth" });
    }
    function printBlank() {
      const cats = selectedCats(); if (!cats.length) { alert("Pick at least one subject first!"); return; }
      // build a paper exam without starting the on-screen exam
      const save_ = current; startExamDry();
      function startExamDry() {
        const n = +$("#howmany").value; const per = cats.map(k => BANK[k].items.slice().sort(() => Math.random() - 0.5));
        const out = []; while (out.length < n && per.some(a => a.length)) for (const a of per) if (a.length && out.length < n) out.push(a.shift());
        const ex = { title: `${NAME}'s Exam (paper)`, subtitle: cats.map(k => BANK[k].name.split(" - ")[0]).join(", "), items: out.map(i => i.id), timeLimit: +$("#timer").value || null };
        doPrint(examPaperHTML(KID, ex, $("#withkey") && $("#withkey").checked));
      }
      current = save_;
    }
    // originals
    $$(".orig").forEach(sec => {
      const key = "orig:" + sec.dataset.page; const cb = sec.querySelector(".tick input");
      if (cb) { cb.checked = !!S.get(key, false); sec.classList.toggle("solved", cb.checked); cb.addEventListener("change", () => { S.set(key, cb.checked); sec.classList.toggle("solved", cb.checked); }); }
      const pb = sec.querySelector(".print-one"); if (pb) pb.addEventListener("click", () => doPrint(`<img class="pagefull" src="${sec.querySelector("img").getAttribute("src")}" alt="">`));
    });
    const all = $("#print-all-orig"); if (all) all.addEventListener("click", () => doPrint($$(".orig:not(.key) img").map(i => `<img class="pagefull" src="${i.getAttribute("src")}" alt="">`).join("")));
    const keyb = $("#print-key-orig"); if (keyb) keyb.addEventListener("click", () => doPrint($$(".orig.key img").map(i => `<img class="pagefull" src="${i.getAttribute("src")}" alt="">`).join("")));
    // tabs
    const btns = $$(".tabs button");
    const show = id => { btns.forEach(b => b.setAttribute("aria-selected", b.dataset.tab === id)); $$(".tabpane").forEach(p => p.hidden = p.id !== id); S.set("tab", id); };
    btns.forEach(b => b.addEventListener("click", () => show(b.dataset.tab)));
    show(location.hash === "#original" ? "original" : S.get("tab", "exam-tab"));
    renderCats(); stats(); renderExam();
    $("#start").addEventListener("click", startExam);
    $("#all").addEventListener("click", () => { $$("#cats input").forEach(x => x.checked = true); S.set("cats", selectedCats()); });
    $("#none").addEventListener("click", () => { $$("#cats input").forEach(x => x.checked = false); S.set("cats", []); });
    $("#print-paper").addEventListener("click", printBlank);
  }

  // =====================================================================
  // PARENT PAGE: review exams
  // =====================================================================
  function reviewPage() {
    let kid = new URLSearchParams(location.search).get("kid") || store.get("review", "kid", "ayden");
    function render() {
      store.set("review", "kid", kid);
      $$(".kidtabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.kid === kid));
      const box = $("#review"); box.innerHTML = "";
      const exams = store.get(kid, "exams", []).slice().reverse();
      const cur = store.get(kid, "current", null);
      if (cur) box.append(el("div", { class: "panel inprog" }, el("b", {}, "In progress: "), `${cur.title} - started ${fmtDate(cur.startedAt)}, ${cur.items.length} questions. Not submitted yet.`));
      if (!exams.length) { box.append(el("p", { class: "empty" }, `No submitted exams for ${NAMES[kid]} on this device yet.`)); return; }
      const graded = exams.filter(e => e.max);
      const avg = graded.length ? Math.round(graded.reduce((a, e) => a + e.percent, 0) / graded.length) : null;
      box.append(el("div", { class: "panel" }, el("h2", {}, `${NAMES[kid]}: ${exams.length} exam${exams.length > 1 ? "s" : ""}`), avg != null ? el("p", {}, `Average: ${avg}% (${letter(avg)})`) : null,
        el("table", { class: "gradebook" }, el("thead", {}, el("tr", {}, ["Exam", "Score", "Grade"].map(h => el("th", {}, h)))),
          el("tbody", {}, exams.map(e => el("tr", {}, el("td", {}, el("a", { href: "#" + e.id, onclick: () => { const d = document.getElementById(e.id); if (d) d.open = true; } }, e.title), el("div", { class: "small" }, `${fmtDate(e.submittedAt)} • ${e.items.length} questions • ${fmtTime(e.durationSec)}`)), el("td", {}, e.max ? `${e.score}/${e.max} (${e.percent}%)` : "-"), el("td", {}, el("span", { class: "grade g" + e.grade }, e.grade))))))));
      exams.forEach(e => box.append(examDetail(e)));
    }
    function examDetail(e) {
      const d = el("details", { class: "panel examrev", id: e.id });
      d.append(el("summary", {}, el("span", { class: "grade g" + e.grade }, e.grade), ` ${e.title} - ${e.max ? e.score + "/" + e.max + " (" + e.percent + "%)" : "no auto-graded questions"} • ${fmtDate(e.submittedAt)}`));
      d.append(el("p", { class: "small" }, `${e.subtitle} • ${e.items.length} questions • answered ${e.answered} • took ${fmtTime(e.durationSec)}${e.timeLimit ? " (timer " + e.timeLimit + " min)" : ""}${e.selfTotal ? ` • ${e.selfDone}/${e.selfTotal} activities ticked "I did it" (mark them below)` : ""}`));
      const ol = el("ol", { class: "revlist" });
      e.items.forEach(id => {
        const it = index[kid][id]; if (!it) return; const g = e.results[id] || { pts: 0, max: 0 };
        const ok = g.max ? g.pts === g.max : null; const part = g.max && g.pts > 0 && g.pts < g.max;
        const li = el("li", { class: ok === null ? "self" : ok ? "ok" : part ? "part" : "no" });
        li.append(el("div", { class: "rq" }, el("b", {}, ok === null ? "📝 Mom to check" : ok ? "✅ Correct" : part ? `◐ ${g.pts}/${g.max}` : "❌ Incorrect"), g.override ? el("span", { class: "small" }, " (marked by Mom)") : null, " - ", it.q));
        if (it.type === "chess") li.append(boardEl(it.fen));
        if (it.type === "notes") li.append(el("div", { html: staffSVG(it.notes) }));
        if (it.pic) li.append(el("div", { class: "pic small-pic" }, it.pic));
        li.append(el("div", { class: "small" }, el("b", {}, "Answer given: "), responseText(it, e.responses[id])));
        if (it.type === "sudoku") li.append(el("div", { class: "small" }, el("b", {}, "Solution:")), el("div", { html: sudokuHTML(it.puzzle, it.answer[0], true) }));
        else if (!SELF(it.type)) li.append(el("div", { class: "small" }, el("b", {}, "Correct answer: "), answerText(it)));
        li.append(el("div", { class: "controls" },
          el("button", { type: "button", class: "btn tiny", onclick: () => override(e, id, true) }, SELF(it.type) ? "Mark done ✓" : "Mark correct"),
          el("button", { type: "button", class: "btn tiny ghost", onclick: () => override(e, id, false) }, SELF(it.type) ? "Mark not done" : "Mark wrong"),
          (e.overrides || {})[id] != null ? el("button", { type: "button", class: "btn tiny ghost", onclick: () => override(e, id, null) }, "Undo") : null));
        ol.append(li);
      });
      d.append(ol);
      d.append(el("div", { class: "controls" },
        el("button", { type: "button", class: "btn ghost", onclick: () => doPrint(examPaperHTML(kid, e, true)) }, "🖨️ Print this exam with answer key"),
        el("button", { type: "button", class: "btn ghost danger", onclick: () => { if (confirm("Delete " + e.title + "? This cannot be undone.")) { store.set(kid, "exams", store.get(kid, "exams", []).filter(x => x.id !== e.id)); render(); } } }, "Delete exam")));
      return d;
    }
    function override(e, id, val) {
      const exams = store.get(kid, "exams", []); const ex = exams.find(x => x.id === e.id); if (!ex) return;
      ex.overrides = ex.overrides || {}; if (val == null) delete ex.overrides[id]; else ex.overrides[id] = val;
      scoreExam(kid, ex); store.set(kid, "exams", exams); render(); const d = document.getElementById(ex.id); if (d) { d.open = true; d.scrollIntoView({ block: "start" }); }
    }
    $$(".kidtabs button").forEach(b => b.addEventListener("click", () => { kid = b.dataset.kid; render(); }));
    render();
  }

  const KID = document.body.dataset.kid;
  if (KID && BANKS[KID]) kidPage(KID);
  else if (document.body.dataset.page === "review") reviewPage();
})();
