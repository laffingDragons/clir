(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const KEY = "clir.linkedinFormatter.draft.v2", MAX = 3000;
  const input = $("postInput"), preview = $("previewContent"), seeMore = $("seeMore"), card = $("previewCard");
  const fb = $("copyFeedback"), undoBtn = $("undoBtn"), redoBtn = $("redoBtn"), saveState = $("saveState");
  const FEEDBACK = "Styles use Unicode characters, so they carry over when pasted into LinkedIn.";
  let hist = [""], hi = 0, last = "", device = "mobile", expanded = false, saveT, fbT, tab = "hooks";

  /* ---------- Unicode maps ---------- */
  const M = {
    bold: [0x1D400, 0x1D41A, 0x1D7CE], italic: [0x1D434, 0x1D44E], bolditalic: [0x1D468, 0x1D482],
    sansbold: [0x1D5D4, 0x1D5EE, 0x1D7EC], sansitalic: [0x1D608, 0x1D622], script: [0x1D4D0, 0x1D4EA], mono: [0x1D670, 0x1D68A, 0x1D7F6]
  };
  const EX = { italic: { h: "ℎ" } };
  // reverse lookup so styles can be cleared or swapped
  const REV = new Map();
  Object.entries(M).forEach(([, [u, l, d]]) => {
    for (let i = 0; i < 26; i++) { REV.set(u + i, String.fromCharCode(65 + i)); REV.set(l + i, String.fromCharCode(97 + i)); }
    if (d) for (let i = 0; i < 10; i++) REV.set(d + i, String(i));
  });
  REV.set(0x210E, "h");
  const plain = t => Array.from(t).map(c => REV.get(c.codePointAt(0)) ?? c).filter(c => c !== "\u0332" && c !== "\u0336").join("");
  function stylize(text, style) {
    const t = plain(text);
    if (style === "plain") return t;
    if (style === "underline") return Array.from(t).map(c => c.trim() ? c + "\u0332" : c).join("");
    if (style === "strike") return Array.from(t).map(c => c.trim() ? c + "\u0336" : c).join("");
    const m = M[style]; if (!m) return t;
    return Array.from(t).map(c => {
      if (EX[style]?.[c]) return EX[style][c];
      const p = c.codePointAt(0);
      if (c >= "A" && c <= "Z") return String.fromCodePoint(m[0] + p - 65);
      if (c >= "a" && c <= "z") return String.fromCodePoint(m[1] + p - 97);
      if (c >= "0" && c <= "9" && m[2]) return String.fromCodePoint(m[2] + p - 48);
      return c;
    }).join("");
  }

  /* ---------- Content library ---------- */
  const LIB = {
    hooks: [
      ["Contrarian", "Unpopular opinion: [common advice] is quietly killing your career."],
      ["Number", "I spent 3 years doing [X]. Here are 7 lessons I wish I knew on day 1:"],
      ["Story", "Last year I got rejected 41 times. The 42nd 'no' changed everything."],
      ["Mistake", "The biggest mistake I see [role] make? They [mistake]."],
      ["Question", "What would you do if you could only ship one feature this month?"],
      ["Result", "We grew [metric] by 212% in 90 days without paid ads. Here's the playbook:"],
      ["Myth", "Stop saying you 'don't have time'. You have priorities."],
      ["Curiosity", "Nobody talks about this part of building a startup."]
    ],
    templates: [
      ["Listicle", "[Hook line]\n\n1️⃣ [Point one]\n2️⃣ [Point two]\n3️⃣ [Point three]\n\nWhich one hit home for you?"],
      ["Story arc", "[Surprising result]\n\nHere's what happened:\n\n• The problem\n• What I tried\n• What worked\n\nThe lesson: [one line]"],
      ["Framework", "My simple framework for [goal]:\n\n➤ Step 1: [x]\n➤ Step 2: [y]\n➤ Step 3: [z]\n\nSave this for later."],
      ["Engineering", "Shipped [feature] this week.\n\nStack: [tools]\nBiggest win: [win]\nBiggest mistake: [mistake]\n\nWhat would you have done differently?"],
      ["Founder update", "Month [N] building [product]:\n\n✅ [Win]\n✅ [Win]\n❌ [Miss]\n\nNext month: [goal]"],
      ["Job search", "I'm open to [role] roles.\n\nWhat I bring:\n• [skill]\n• [skill]\n• [skill]\n\nIntros and referrals welcome 🙏"]
    ],
    ctas: [
      ["Engage", "What's your take? Tell me in the comments 👇"],
      ["Save", "♻️ Repost to help someone in your network.\n💾 Save this for later."],
      ["Follow", "Follow me for more posts on [topic]."],
      ["Lead", "Want the full checklist? Comment 'CHECKLIST' and I'll send it."],
      ["Book", "Open to a quick chat? Send me a DM."],
      ["Poll", "Agree or disagree? Vote with 👍 or 💬."]
    ]
  };
  function renderLib() {
    const g = $("libGrid"); g.innerHTML = "";
    LIB[tab].forEach(([label, body], i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "lib-item"; b.style.animationDelay = i * 45 + "ms";
      b.innerHTML = `<small></small><span></span>`; b.firstChild.textContent = label; b.lastChild.textContent = body;
      b.onclick = () => insertLib(body); g.appendChild(b);
    });
  }
  function insertLib(body) {
    if (tab === "hooks") input.value = body + (input.value ? "\n\n" + input.value : "");
    else if (tab === "templates" && !input.value.trim()) input.value = body;
    else input.value += (input.value && !input.value.endsWith("\n") ? "\n\n" : "") + body;
    commit(); input.focus(); msg("Inserted. Replace the [brackets] with your details.");
  }

  /* ---------- Analytics ---------- */
  const TAGS = [
    ["#Leadership", "Huge", /lead|manage|team/i], ["#Marketing", "Huge", /market|brand|growth|seo/i], ["#CareerAdvice", "Huge", /career|job|hire|interview|resume/i],
    ["#Entrepreneurship", "Huge", /founder|startup|business|build/i], ["#ArtificialIntelligence", "Huge", /\bai\b|genai|llm|gpt|claude/i], ["#WebDevelopment", "Popular", /react|next\.?js|frontend|web|code|developer/i],
    ["#Productivity", "Popular", /productiv|habit|focus|time/i], ["#PersonalBranding", "Popular", /brand|linkedin|content|audience/i], ["#SaaS", "Popular", /saas|product|b2b/i],
    ["#Startups", "Popular", /startup|founder|fund/i], ["#SoftwareEngineering", "Niche", /engineer|software|stack|dev/i], ["#BuildInPublic", "Niche", /shipped|building|launch|month/i]
  ];
  const wc = t => t.trim() ? t.trim().split(/\s+/u).length : 0;
  function hookScore(text) {
    const first = plain(text.trim().split("\n")[0] || ""); if (!first) return [0, "Start writing", "Your first line decides who clicks “see more”."];
    let s = 30, tip = "";
    const len = first.length;
    if (len <= 60) s += 25; else if (len <= 110) s += 15; else tip = "Shorten line one to under ~110 characters.";
    if (/\d/.test(first)) s += 12; else tip = tip || "Add a specific number.";
    if (/\?$/.test(first)) s += 8;
    if (/(mistake|never|stop|nobody|secret|truth|unpopular|lesson|why|how|without|failed|rejected)/i.test(first)) s += 15;
    if (/^(i'?m (excited|thrilled|happy|proud)|hello|hi everyone|great|happy to)/i.test(first)) { s -= 20; tip = "Openers like “I'm excited” are scrolled past."; }
    if (text.includes("\n\n") || text.split("\n").length > 3) s += 10;
    s = Math.max(5, Math.min(100, s));
    return [s, s >= 75 ? "Strong hook" : s >= 50 ? "Decent hook" : "Weak hook", tip || (s >= 75 ? "Nice. Make sure it fits above the fold." : "Try a number, a bold claim or a question.")];
  }
  function renderStats() {
    const t = input.value, n = t.length;
    $("charCount").textContent = n; $("wordCount").textContent = wc(t);
    const sec = Math.round(wc(t) / 238 * 60); $("readTime").textContent = sec < 60 ? sec + "s" : Math.ceil(sec / 60) + " min";
    const lines = t ? t.split("\n").length : 1; $("lineCount").textContent = lines + (lines === 1 ? " line" : " lines");
    const bar = $("limitBar"); bar.style.width = Math.min(100, n / MAX * 100) + "%"; bar.className = n >= MAX ? "max" : n > MAX * .9 ? "warn" : "";
    const [s, label, tip] = hookScore(t), ring = $("scoreRing");
    ring.style.setProperty("--s", s); ring.style.setProperty("--c", s >= 75 ? "#22a06b" : s >= 50 ? "#e0a12c" : "#e5484d");
    $("scoreNum").textContent = s; $("scoreLabel").textContent = label; $("scoreTip").textContent = tip;
    const found = TAGS.filter(x => x[2].test(plain(t))); const show = (found.length ? found : TAGS.filter(x => x[1] === "Huge")).slice(0, 6);
    const list = $("tagList"); const sig = show.map(x => x[0]).join();
    if (list.dataset.sig !== sig) {
      list.dataset.sig = sig; list.innerHTML = "";
      show.forEach((x, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "tag"; b.style.animationDelay = i * 40 + "ms"; b.innerHTML = `${x[0]} <em>${x[1].toUpperCase()}</em>`;
        b.onclick = () => { input.value += (/\s$|^$/.test(input.value) ? "" : " ") + x[0]; commit(); }; list.appendChild(b); });
    }
  }

  /* ---------- Preview (see-more truncation: ~3 lines / 140 chars mobile, 210 desktop) ---------- */
  function renderPreview() {
    const t = input.value; preview.classList.toggle("is-empty", !t);
    if (!t) { preview.textContent = "Your post will appear here as you write."; seeMore.hidden = true; return; }
    const limit = device === "mobile" ? 140 : 210, maxLines = 3;
    const lines = t.split("\n"); let cut = t, truncated = false;
    if (lines.length > maxLines) { cut = lines.slice(0, maxLines).join("\n"); truncated = true; }
    if (cut.length > limit) { cut = cut.slice(0, limit).replace(/\s+\S*$/, ""); truncated = true; }
    preview.textContent = expanded || !truncated ? t : cut + "…";
    seeMore.hidden = !truncated || expanded;
  }

  /* ---------- State ---------- */
  function msg(text, err) { fb.textContent = text; fb.style.color = err ? "#e5484d" : ""; clearTimeout(fbT); fbT = setTimeout(() => { fb.textContent = FEEDBACK; fb.style.color = ""; }, 4200); }
  function setSave(text, saving) { saveState.classList.toggle("saving", !!saving); saveState.innerHTML = `<span class="save-dot"></span> ${text}`; }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify({ text: input.value, badge: $("badgeOpt").checked })); setSave("Saved locally"); } catch { setSave("Local save unavailable"); } }
  function refresh() { renderStats(); renderPreview(); setSave("Saving…", true); clearTimeout(saveT); saveT = setTimeout(persist, 250); }
  function record() { const v = input.value; if (v === last) return; hist = hist.slice(0, hi + 1); hist.push(v); if (hist.length > 100) hist.shift(); hi = hist.length - 1; last = v; histBtns(); }
  function histBtns() { undoBtn.disabled = hi <= 0; redoBtn.disabled = hi >= hist.length - 1; }
  function commit() { record(); expanded = false; refresh(); }
  function jump(d) { const n = hi + d; if (n < 0 || n >= hist.length) return; hi = n; input.value = hist[hi]; last = input.value; histBtns(); refresh(); }

  /* ---------- Actions ---------- */
  function applyFormat(style, btn) {
    const s = input.selectionStart, e = input.selectionEnd;
    if (s === e) { msg("Select the text you want to style first.", true); input.focus(); return; }
    input.setRangeText(stylize(input.value.slice(s, e), style), s, e, "select"); input.focus(); commit();
    if (btn) { btn.classList.remove("flash"); void btn.offsetWidth; btn.classList.add("flash"); }
  }
  function applyList(kind) {
    const v = input.value; let s = v.lastIndexOf("\n", input.selectionStart - 1) + 1, e = v.indexOf("\n", input.selectionEnd); if (e < 0) e = v.length;
    const NUM = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"]; let i = 0;
    const out = v.slice(s, e).split("\n").map(l => {
      const body = l.replace(/^\s*(?:[•➤✅]|\d+\.|(?:[1-9]️⃣|🔟))\s*/u, ""); if (!body.trim()) return l;
      return (kind === "1" ? NUM[Math.min(i++, 9)] : kind) + " " + body;
    }).join("\n");
    input.setRangeText(out, s, s + (e - s), "select"); input.focus(); commit();
  }
  function output() {
    let t = input.value;
    if ($("badgeOpt").checked && t.trim()) t += "\n\n—\nFormatted with LinkedIn Text Formatter · clir.co.in/tools/linkedin-formatter";
    return t;
  }
  async function copyPost() {
    if (!input.value) { msg("Write something first, then copy your post.", true); input.focus(); return; }
    let ok = true;
    try { await navigator.clipboard.writeText(output()); } catch { const ta = document.createElement("textarea"); ta.value = output(); document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); ta.remove(); }
    const b = $("copyBtn");
    if (ok) { b.textContent = "Copied ✓"; b.classList.add("done"); setTimeout(() => { b.textContent = "Copy formatted post"; b.classList.remove("done"); }, 1800); msg("Copied. Paste it into LinkedIn."); }
    else msg("Copy was blocked. Select the text and copy manually.", true);
  }
  function exportTxt() {
    if (!input.value) return msg("Nothing to export yet.", true);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([output()], { type: "text/plain" })); a.download = "linkedin-post.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  /* ---------- Wiring ---------- */
  document.querySelectorAll("[data-format]").forEach(b => b.onclick = () => applyFormat(b.dataset.format, b));
  document.querySelectorAll("[data-list]").forEach(b => b.onclick = () => applyList(b.dataset.list));
  document.querySelectorAll("[data-device]").forEach(b => b.onclick = () => {
    device = b.dataset.device; expanded = false;
    document.querySelectorAll("[data-device]").forEach(x => x.classList.toggle("active", x === b));
    card.className = "preview-card is-" + device; renderPreview();
  });
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; document.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("active", x === b)); renderLib(); });
  seeMore.onclick = () => { expanded = true; renderPreview(); };
  input.addEventListener("input", commit);
  $("badgeOpt").onchange = persist;
  $("copyBtn").onclick = copyPost; $("txtBtn").onclick = exportTxt; undoBtn.onclick = () => jump(-1); redoBtn.onclick = () => jump(1);
  $("clearBtn").onclick = () => { if (input.value && confirm("Clear your current draft?")) { input.value = ""; commit(); input.focus(); } };

  const emojis = "😀😂🥹😍🤔🙌👏💪🔥✨🚀💡🎯📌📈💼🧠❤️💚🙏✅❌➡️👇👀🌱⭐💬📝🤝🎉☕🌍⚡🛠️💯😎🫶📣🔑🏆💭📚🌟🧩💻📊🧪🧵💸🕒".match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu);
  emojis.forEach(em => { const b = document.createElement("button"); b.type = "button"; b.textContent = em; b.setAttribute("aria-label", "Insert " + em);
    b.onclick = () => { input.setRangeText(em, input.selectionStart, input.selectionEnd, "end"); $("emojiPanel").hidden = true; input.focus(); commit(); }; $("emojiGrid").appendChild(b); });
  const togglePanel = () => { $("emojiPanel").hidden = !$("emojiPanel").hidden; };
  $("emojiToggle").onclick = togglePanel; $("closeEmoji").onclick = () => { $("emojiPanel").hidden = true; $("emojiToggle").focus(); };

  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape" && !$("emojiPanel").hidden) { $("emojiPanel").hidden = true; return; }
    const mod = ev.metaKey || ev.ctrlKey; if (!mod) return; const k = ev.key.toLowerCase();
    const map = { b: "bold", i: "italic", s: "script", m: "mono" };
    if (ev.shiftKey && map[k]) { ev.preventDefault(); applyFormat(map[k]); }
    else if (ev.shiftKey && k === "e") { ev.preventDefault(); togglePanel(); }
    else if (document.activeElement === input && k === "z") { ev.preventDefault(); jump(ev.shiftKey ? 1 : -1); }
    else if (document.activeElement === input && k === "y") { ev.preventDefault(); jump(1); }
  });

  /* theme */
  $("themeToggle").onclick = () => {
    const d = document.documentElement, n = d.dataset.theme === "dark" ? "light" : "dark"; d.dataset.theme = n;
    try { localStorage.setItem("clir.theme", n); } catch {}
    document.querySelector('meta[name="theme-color"]').content = n === "dark" ? "#0f1117" : "#f0f2f5";
  };

  /* scroll reveal */
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .08 }) : null;
  document.querySelectorAll(".reveal").forEach(el => io ? io.observe(el) : el.classList.add("in"));

  /* ads: init each slot once; fail silently so layout never breaks */
  window.addEventListener("load", () => document.querySelectorAll("ins.adsbygoogle").forEach(() => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {} }));

  /* init */
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) { if (typeof s.text === "string") input.value = s.text; $("badgeOpt").checked = !!s.badge; } } catch {}
  last = input.value; hist = [last]; hi = 0; renderLib(); renderStats(); renderPreview(); histBtns(); setSave("Saved locally");
})();