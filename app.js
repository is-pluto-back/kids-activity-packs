/* Kids Activity Packs - problem bank, shuffle, solve, tick-off, print. No build step. */
(function () {
  "use strict";
  const KID = document.body.dataset.kid;
  if (!KID) return;
  const BANK = window.BANK || {};
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("kap:" + KID + ":" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("kap:" + KID + ":" + k, JSON.stringify(v)); } catch (e) {} }
  };
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") n.className = v; else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LETTERS = "ABCDEFGH";
  let done = LS.get("done", {});
  const byId = {};
  for (const [ck, c] of Object.entries(BANK)) for (const it of c.items) { it.cat = ck; byId[it.id] = it; }

  // ---------- helpers ----------
  const norm = s => String(s).toLowerCase().replace(/\b(am|pm|cents?|pounds?)\b/g, "").replace(/[.,]+$/g, "").replace(/\s+/g, " ").trim();
  const chessNorm = s => String(s).toLowerCase().replace(/[\s+#x\-=!?:]/g, "");
  function speak(text, lang) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.rate = 0.85; if (lang) u.lang = lang;
    speechSynthesis.speak(u);
  }
  function markDone(it, card, ok) {
    if (ok) { done[it.id] = true; LS.set("done", done); card.classList.add("solved"); const t = card.querySelector(".tick input"); if (t) t.checked = true; }
    renderProgress();
  }
  function feedback(card, ok, msg) {
    const f = card.querySelector(".feedback");
    f.textContent = ok ? (msg || "Correct! 🎉") : (msg || "Not quite - try again! 💪");
    f.className = "feedback " + (ok ? "good" : "bad");
  }

  // ---------- visual builders ----------
  const PIECES = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙", k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  function boardEl(fen) {
    const rows = fen.split(" ")[0].split("/");
    const g = el("div", { class: "board", role: "img", "aria-label": "Chess board" });
    rows.forEach((row, ri) => {
      let fi = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { for (let i = 0; i < +ch; i++) { g.append(sq(ri, fi, "")); fi++; } }
        else { g.append(sq(ri, fi, ch)); fi++; }
      }
    });
    function sq(r, f, p) {
      const d = el("div", { class: "sq " + ((r + f) % 2 ? "dark" : "light") + (p && p === p.toUpperCase() ? " w" : " b") }, p ? PIECES[p] : "");
      if (f === 0) d.append(el("span", { class: "rank" }, 8 - r));
      if (r === 7) d.append(el("span", { class: "file" }, "abcdefgh"[f]));
      return d;
    }
    return g;
  }
  function pieceList(fen) {
    const names = { k: "King", q: "Queen", r: "Rook", b: "Bishop", n: "Knight", p: "Pawn" };
    const w = [], b = [];
    fen.split(" ")[0].split("/").forEach((row, ri) => { let fi = 0; for (const ch of row) { if (/\d/.test(ch)) fi += +ch; else { (ch === ch.toUpperCase() ? w : b).push(names[ch.toLowerCase()] + " " + "abcdefgh"[fi] + (8 - ri)); fi++; } } });
    return el("p", { class: "small" }, "White: " + w.join(", ") + " • Black: " + b.join(", "));
  }
  function staffSVG(steps) {
    const W = 90 + steps.length * 60, base = 90, h = 10; // h = half space
    let s = `<svg class="staff" viewBox="0 0 ${W} 130" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Notes on a treble staff">`;
    for (let i = 0; i < 5; i++) s += `<line x1="5" x2="${W - 5}" y1="${base - i * 2 * h}" y2="${base - i * 2 * h}" stroke="#333" stroke-width="1.5"/>`;
    s += `<text x="6" y="${base + 10}" font-size="80" font-family="'Noto Music','Apple Symbols','Segoe UI Symbol',serif">𝄞</text>`;
    steps.forEach((st, i) => {
      const x = 100 + i * 60, y = base - st * h;
      if (st <= -2) s += `<line x1="${x - 16}" x2="${x + 16}" y1="${base + 2 * h}" y2="${base + 2 * h}" stroke="#333" stroke-width="1.5"/>`;
      if (st >= 10) s += `<line x1="${x - 16}" x2="${x + 16}" y1="${base - 10 * h}" y2="${base - 10 * h}" stroke="#333" stroke-width="1.5"/>`;
      s += `<ellipse cx="${x}" cy="${y}" rx="11" ry="8" transform="rotate(-20 ${x} ${y})" fill="#222"/>`;
      const up = st < 4; s += up ? `<line x1="${x + 10}" x2="${x + 10}" y1="${y}" y2="${y - 55}" stroke="#222" stroke-width="2"/>` : `<line x1="${x - 10}" x2="${x - 10}" y1="${y}" y2="${y + 55}" stroke="#222" stroke-width="2"/>`;
      s += `<text x="${x}" y="125" text-anchor="middle" font-size="13" fill="#888">${i + 1}</text>`;
    });
    return s + "</svg>";
  }
  function shapeSVG(t, c) {
    const a = `fill="${c}" stroke="#333" stroke-width="3"`;
    const body = {
      circle: `<circle cx="50" cy="50" r="38" ${a}/>`, square: `<rect x="14" y="14" width="72" height="72" ${a}/>`,
      triangle: `<polygon points="50,10 90,88 10,88" ${a}/>`, rectangle: `<rect x="5" y="28" width="90" height="46" ${a}/>`,
      star: `<polygon points="50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38" ${a}/>`,
      heart: `<path d="M50 88 C10 60 5 35 25 20 C38 11 48 20 50 30 C52 20 62 11 75 20 C95 35 90 60 50 88Z" ${a}/>`,
      oval: `<ellipse cx="50" cy="50" rx="44" ry="28" ${a}/>`, diamond: `<polygon points="50,6 90,50 50,94 10,50" ${a}/>`
    }[t];
    return `<svg viewBox="0 0 100 100" width="90" height="90" role="img" aria-label="${t}">${body}</svg>`;
  }
  function traceSVG(text) {
    const w = Math.max(300, text.length * 78);
    return `<svg class="trace" viewBox="0 0 ${w} 140" role="img" aria-label="Trace ${esc(text)}"><line x1="0" x2="${w}" y1="30" y2="30" stroke="#9ad" stroke-width="2"/><line x1="0" x2="${w}" y1="72" y2="72" stroke="#9ad" stroke-dasharray="8 8" stroke-width="2"/><line x1="0" x2="${w}" y1="114" y2="114" stroke="#9ad" stroke-width="2"/><text x="10" y="114" font-family="'Andika','Comic Sans MS','Trebuchet MS',sans-serif" font-size="118" fill="none" stroke="#b9a3d9" stroke-width="3" stroke-dasharray="6 6" letter-spacing="6">${esc(text)}</text></svg>`;
  }
  function answerText(it) {
    switch (it.type) {
      case "mc": return it.choices[it.answer];
      case "input": return it.explain || it.answer[0];
      case "chess": return it.explain;
      case "notes": return it.answer[0];
      case "order": return it.answer.map((n, i) => (i + 1) + ". " + n).join("  ");
      case "shape": return it.shapes[it.answer];
      case "reading": return it.questions.map((q, i) => (i + 1) + ". " + q.choices[q.answer]).join("  ");
      case "sudoku": return null;
      default: return "(Done when finished)";
    }
  }

  // ---------- interactive card ----------
  function card(it, num) {
    const c = el("article", { class: "card" + (done[it.id] ? " solved" : ""), "data-id": it.id });
    const cat = BANK[it.cat];
    const head = el("div", { class: "card-head" },
      el("span", { class: "num" }, num ? "#" + num : ""),
      el("span", { class: "tag" }, cat.icon + " " + cat.name + (it.sub ? " • " + it.sub : "")),
      el("label", { class: "tick", title: "Tick when finished" }, el("input", { type: "checkbox", checked: done[it.id] ? "" : false, onchange: e => { if (e.target.checked) done[it.id] = true; else delete done[it.id]; LS.set("done", done); c.classList.toggle("solved", e.target.checked); renderProgress(); } }), " Done"));
    c.append(head);
    const q = el("p", { class: "q" }, it.q);
    if (it.say) q.append(" ", el("button", { class: "say", type: "button", title: "Read it to me", onclick: () => speak(it.lang === "es" ? it.word : it.say, it.lang === "es" ? "es-ES" : "en-US") }, "🔊"));
    c.append(q);
    const fb = el("p", { class: "feedback", "aria-live": "polite" });
    const body = el("div", { class: "body" });
    c.append(body);
    if (it.pic) body.append(el("div", { class: "pic" + (it.pic.length > 14 ? " many" : "") }, it.pic));
    if (it.type === "mc") {
      const row = el("div", { class: "choices" + (it.big ? " big" : "") });
      it.choices.forEach((ch, i) => row.append(el("button", { type: "button", class: "choice", onclick: e => { const ok = i === it.answer; e.currentTarget.classList.add(ok ? "right" : "wrong"); feedback(c, ok); markDone(it, c, ok); } }, (it.big ? "" : LETTERS[i] + ". ") + ch)));
      body.append(row);
    } else if (it.type === "shape") {
      const row = el("div", { class: "choices big" });
      it.shapes.forEach((s, i) => row.append(el("button", { type: "button", class: "choice", html: shapeSVG(s, it.colors[i]), onclick: e => { const ok = i === it.answer; e.currentTarget.classList.add(ok ? "right" : "wrong"); feedback(c, ok); markDone(it, c, ok); } })));
      body.append(row);
    } else if (it.type === "input" || it.type === "chess" || it.type === "notes") {
      if (it.type === "chess") { body.append(boardEl(it.fen), pieceList(it.fen)); }
      if (it.type === "notes") body.append(el("div", { html: staffSVG(it.notes) }));
      const inpEl = el("input", { type: "text", class: "ans", "aria-label": "Your answer", placeholder: it.type === "chess" ? "e.g. Nf6" : "Your answer", inputmode: /^\d+$/.test(it.answer[0]) ? "numeric" : "text", autocomplete: "off" });
      const check = () => {
        const v = inpEl.value; if (!v.trim()) return;
        let ok;
        if (it.type === "chess") ok = it.answer.some(a => chessNorm(a) === chessNorm(v)) || chessNorm(v) === chessNorm(it.answer[1]).slice(2) ;
        else if (it.type === "notes") ok = it.answer.some(a => a.replace(/\s/g, "").toUpperCase() === v.replace(/[\s,\-]/g, "").toUpperCase());
        else ok = it.answer.some(a => norm(a) === norm(v) || norm(a).replace(/\s/g, "") === norm(v).replace(/[\s,]/g, ""));
        feedback(c, ok, ok && it.type === "chess" ? "Correct! " + it.explain : null); markDone(it, c, ok);
      };
      inpEl.addEventListener("keydown", e => { if (e.key === "Enter") check(); });
      body.append(el("div", { class: "row" }, inpEl, el("button", { type: "button", class: "btn", onclick: check }, "Check")));
      if (it.hint) body.append(el("p", { class: "small" }, "Hint: " + it.hint));
    } else if (it.type === "sudoku") {
      const g = el("div", { class: "sudoku" });
      [...it.puzzle].forEach((ch, i) => {
        const r = Math.floor(i / 9), col = i % 9;
        const cls = "cell" + (col % 3 === 2 && col < 8 ? " br" : "") + (r % 3 === 2 && r < 8 ? " bb" : "");
        g.append(ch !== "0" ? el("div", { class: cls + " given" }, ch) : el("input", { class: cls, maxlength: "1", inputmode: "numeric", "aria-label": "row " + (r + 1) + " column " + (col + 1), "data-i": i }));
      });
      const check = () => {
        let wrong = 0, empty = 0;
        g.querySelectorAll("input").forEach(x => { const want = it.answer[0][+x.dataset.i]; x.classList.remove("wrongc"); if (!x.value) empty++; else if (x.value !== want) { wrong++; x.classList.add("wrongc"); } });
        const ok = !wrong && !empty; feedback(c, ok, ok ? "Solved! 🎉" : wrong ? wrong + " square(s) need another look (shown in red)." : "No mistakes so far - " + empty + " squares to go!"); markDone(it, c, ok);
      };
      body.append(g, el("button", { type: "button", class: "btn", onclick: check }, "Check my Sudoku"));
    } else if (it.type === "order") {
      const sels = [0, 1, 2, 3].map(i => el("select", { "aria-label": ["1st", "2nd", "3rd", "4th"][i] }, el("option", { value: "" }, "-"), it.options.map(o => el("option", { value: o }, o))));
      body.append(el("div", { class: "order" }, sels.map((s, i) => el("label", {}, ["1st", "2nd", "3rd", "4th"][i] + ": ", s))));
      body.append(el("button", { type: "button", class: "btn", onclick: () => { const ok = sels.every((s, i) => s.value === it.answer[i]); feedback(c, ok); markDone(it, c, ok); } }, "Check"));
    } else if (it.type === "reading") {
      body.append(el("div", { class: "passage" }, it.passage.split("\n").map(p => el("p", {}, p))));
      let right = new Set();
      it.questions.forEach((qq, qi) => {
        const row = el("div", { class: "choices" });
        qq.choices.forEach((ch, i) => row.append(el("button", { type: "button", class: "choice", onclick: e => { const ok = i === qq.answer; e.currentTarget.classList.add(ok ? "right" : "wrong"); if (ok) right.add(qi); const all = right.size === it.questions.length; feedback(c, ok, ok ? (all ? "All questions right! 🎉" : "Correct! Keep going.") : null); if (all) markDone(it, c, true); } }, LETTERS[i] + ". " + ch)));
        body.append(el("p", { class: "subq" }, (qi + 1) + ". " + qq.q), row);
      });
      body.append(el("p", { class: "subq" }, "Bonus: How did the main character feel at the end, and why? Tell Mom!"));
    } else if (it.type === "trace") {
      body.append(el("div", { class: "trace-wrap", html: traceSVG(it.text) }), el("p", { class: "small" }, "Print this page and trace it with a pencil, or trace it with your finger on the screen!"));
      body.append(el("button", { type: "button", class: "btn", onclick: () => { feedback(c, true, "Great tracing! ⭐"); markDone(it, c, true); } }, "I traced it!"));
    } else {
      if (it.box) body.append(el("div", { class: "drawbox" }, "Draw here (on the printed page)"));
      body.append(el("button", { type: "button", class: "btn", onclick: () => { feedback(c, true, "Awesome! ⭐"); markDone(it, c, true); } }, "I did it!"));
    }
    c.append(fb);
    return c;
  }

  // ---------- print worksheet ----------
  function printItem(it, n) {
    let h = `<div class="pitem"><div class="pq"><b>${n}.</b> ${esc(it.q)}</div>`;
    if (it.pic) h += `<div class="pic${it.pic.length > 14 ? " many" : ""}">${esc(it.pic)}</div>`;
    switch (it.type) {
      case "mc": h += `<div class="pchoices">${it.choices.map((c, i) => `<span>○ ${it.big ? "" : LETTERS[i] + ". "}${esc(c)}</span>`).join("")}</div>`; break;
      case "shape": h += `<div class="pchoices">${it.shapes.map((s, i) => `<span>○ ${shapeSVG(s, "#fff")}</span>`).join("")}</div>`; break;
      case "input": h += `<div class="line">Answer: ____________________</div>`; break;
      case "chess": h += boardEl(it.fen).outerHTML + pieceList(it.fen).outerHTML + `<div class="line">Your move: ______ to ______</div>`; break;
      case "notes": h += staffSVG(it.notes) + `<div class="line">Answer: ____________________</div>`; break;
      case "sudoku": h += `<div class="sudoku">${[...it.puzzle].map((ch, i) => { const r = Math.floor(i / 9), c = i % 9; return `<div class="cell${c % 3 === 2 && c < 8 ? " br" : ""}${r % 3 === 2 && r < 8 ? " bb" : ""}${ch !== "0" ? " given" : ""}">${ch !== "0" ? ch : ""}</div>`; }).join("")}</div>`; break;
      case "order": h += `<div class="line">Racers: ${it.options.join(", ")}<br>1st: ________ 2nd: ________ 3rd: ________ 4th: ________</div>`; break;
      case "reading": h += `<div class="passage">${it.passage.split("\n").map(p => `<p>${esc(p)}</p>`).join("")}</div>` + it.questions.map((q, i) => `<div class="pq">${i + 1}. ${esc(q.q)}</div><div class="pchoices">${q.choices.map((c, j) => `<span>○ ${LETTERS[j]}. ${esc(c)}</span>`).join("")}</div>`).join(""); break;
      case "trace": h += traceSVG(it.text) + traceSVG(it.text); break;
      default: h += it.box ? `<div class="drawbox tall"></div>` : `<div class="line">☐ I did it!</div>`;
    }
    return h + "</div>";
  }
  function printSheet(items, withKey) {
    const title = document.title.split("|")[0].trim();
    let h = `<header class="phead"><h1>${esc(title)}</h1><p>Name: ________________ Date: ____________ • Tick each one when you finish!</p></header>`;
    h += items.map((it, i) => printItem(it, i + 1)).join("");
    if (withKey) {
      h += `<section class="pkey"><h2>Answer key - For Mom</h2><ol>${items.map(it => { if (it.type === "sudoku") { const s = it.answer[0]; return `<li>Sudoku solution:<div class="sudoku small">${[...s].map((ch, i) => { const r = Math.floor(i / 9), c = i % 9; return `<div class="cell${c % 3 === 2 && c < 8 ? " br" : ""}${r % 3 === 2 && r < 8 ? " bb" : ""}">${ch}</div>`; }).join("")}</div></li>`; } return `<li>${esc(answerText(it))}</li>`; }).join("")}</ol></section>`;
    }
    doPrint(h);
  }
  function doPrint(html) {
    const pa = $("#print-area"); pa.innerHTML = html; document.body.classList.add("printing");
    const imgs = [...pa.querySelectorAll("img")];
    Promise.all(imgs.map(im => im.complete ? 1 : new Promise(r => { im.onload = im.onerror = r; }))).then(() => setTimeout(() => window.print(), 50));
  }
  window.addEventListener("afterprint", () => { document.body.classList.remove("printing"); $("#print-area").innerHTML = ""; });

  // ---------- practice UI ----------
  let current = LS.get("set", []).map(id => byId[id]).filter(Boolean);
  function selectedCats() { return [...document.querySelectorAll("#cats input:checked")].map(x => x.value); }
  function renderCats() {
    const box = $("#cats"); box.innerHTML = "";
    const saved = LS.get("cats", Object.keys(BANK));
    for (const [k, c] of Object.entries(BANK)) {
      box.append(el("label", { class: "chip" }, el("input", { type: "checkbox", value: k, checked: saved.includes(k) ? "" : false, onchange: () => LS.set("cats", selectedCats()) }), " " + c.icon + " " + c.name + " ", el("span", { class: "count", "data-cat": k })));
    }
  }
  function renderProgress() {
    let tot = 0, dn = 0;
    for (const [k, c] of Object.entries(BANK)) {
      const d = c.items.filter(i => done[i.id]).length; tot += c.items.length; dn += d;
      const s = document.querySelector(`.count[data-cat="${k}"]`); if (s) s.textContent = `(${d}/${c.items.length})`;
    }
    const p = $("#progress"); if (p) p.textContent = `${dn} of ${tot} problems done`;
    const setDone = current.filter(i => done[i.id]).length;
    const sp = $("#set-progress"); if (sp) sp.textContent = current.length ? `This set: ${setDone}/${current.length} done` : "";
  }
  function shuffle() {
    const cats = selectedCats(); if (!cats.length) { alert("Pick at least one category first!"); return; }
    const n = +$("#howmany").value; const fresh = $("#fresh").checked;
    let pool = cats.flatMap(k => BANK[k].items);
    if (fresh) { const f = pool.filter(i => !done[i.id]); if (f.length) pool = f; }
    // spread across categories: round-robin from shuffled per-category lists
    const per = cats.map(k => pool.filter(i => i.cat === k).sort(() => Math.random() - 0.5)).filter(a => a.length);
    const out = []; while (out.length < n && per.some(a => a.length)) for (const a of per) if (a.length && out.length < n) out.push(a.pop());
    current = out.sort(() => Math.random() - 0.5); LS.set("set", current.map(i => i.id)); renderSet();
    $("#set").scrollIntoView({ behavior: "smooth" });
  }
  function renderSet() {
    const s = $("#set"); s.innerHTML = "";
    if (!current.length) { s.append(el("p", { class: "empty" }, "Pick categories above and press Shuffle! 🎲")); renderProgress(); return; }
    current.forEach((it, i) => s.append(card(it, i + 1)));
    renderProgress();
  }
  // ---------- originals ----------
  function setupOriginals() {
    document.querySelectorAll(".orig").forEach(sec => {
      const key = "orig:" + sec.dataset.page; const cb = sec.querySelector(".tick input");
      if (cb) { cb.checked = !!LS.get(key, false); sec.classList.toggle("solved", cb.checked); cb.addEventListener("change", () => { LS.set(key, cb.checked); sec.classList.toggle("solved", cb.checked); }); }
      const pb = sec.querySelector(".print-one"); if (pb) pb.addEventListener("click", () => doPrint(`<img class="pagefull" src="${sec.querySelector("img").getAttribute("src")}" alt="">`));
    });
    const all = $("#print-all-orig"); if (all) all.addEventListener("click", () => doPrint([...document.querySelectorAll(".orig:not(.key) img")].map(i => `<img class="pagefull" src="${i.getAttribute("src")}" alt="">`).join("")));
    const keyb = $("#print-key-orig"); if (keyb) keyb.addEventListener("click", () => doPrint([...document.querySelectorAll(".orig.key img")].map(i => `<img class="pagefull" src="${i.getAttribute("src")}" alt="">`).join("")));
  }
  // tabs
  function tabs() {
    const btns = document.querySelectorAll(".tabs button");
    const show = id => { btns.forEach(b => b.setAttribute("aria-selected", b.dataset.tab === id)); document.querySelectorAll(".tabpane").forEach(p => p.hidden = p.id !== id); LS.set("tab", id); };
    btns.forEach(b => b.addEventListener("click", () => show(b.dataset.tab)));
    show(location.hash === "#original" ? "original" : LS.get("tab", "practice"));
  }
  renderCats(); tabs(); setupOriginals(); renderSet();
  $("#shuffle").addEventListener("click", shuffle);
  $("#all").addEventListener("click", () => { document.querySelectorAll("#cats input").forEach(x => x.checked = true); LS.set("cats", selectedCats()); });
  $("#none").addEventListener("click", () => { document.querySelectorAll("#cats input").forEach(x => x.checked = false); LS.set("cats", []); });
  $("#print-set").addEventListener("click", () => { if (!current.length) { alert("Shuffle a set first!"); return; } printSheet(current, $("#withkey").checked); });
  $("#reset").addEventListener("click", () => { if (confirm("Clear all ticks and progress for this pack?")) { done = {}; LS.set("done", done); renderSet(); } });
})();
