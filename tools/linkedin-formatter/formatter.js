(() => {
  "use strict";

  const STORAGE_KEY = "clir.linkedinFormatter.draft.v1";
  const input = document.getElementById("postInput");
  const preview = document.getElementById("previewContent");
  const charCount = document.getElementById("charCount");
  const wordCount = document.getElementById("wordCount");
  const lineCount = document.getElementById("lineCount");
  const saveState = document.getElementById("saveState");
  const copyBtn = document.getElementById("copyBtn");
  const copyFeedback = document.getElementById("copyFeedback");
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");
  const emojiPanel = document.getElementById("emojiPanel");
  const emojiGrid = document.getElementById("emojiGrid");
  let saveTimer = null;
  let history = [""];
  let historyIndex = 0;
  let lastInputValue = "";
  let currentFont = "inherit";
  let lastSelection = { start: 0, end: 0 };
  let feedbackTimer = null;

  const emojiList = ["😀","😂","🥹","😍","🤔","🙌","👏","💪","🔥","✨","🚀","💡","🎯","📌","📈","💼","🧠","❤️","💚","🙏","✅","❌","➡️","👇","👀","🌱","⭐","💬","📝","🤝","🎉","☕","🌍","⚡","🛠️","💯","😊","😎","🫶","📣","🔑","🏆","💭","📚","🎁","🌟","🤩","🧩","🗣️","💻","🧑‍💻","📊","🧪","🧵","💸","🕒","🛑","🫡","🌈","🧘"];

  const maps = {
    bold: { upper: 0x1D400, lower: 0x1D41A, digits: 0x1D7CE },
    italic: { upper: 0x1D434, lower: 0x1D44E },
    script: { upper: 0x1D4D0, lower: 0x1D4EA },
    mono: { upper: 0x1D670, lower: 0x1D68A, digits: 0x1D7F6 }
  };
  const exceptions = {
    italic: { h: "ℎ" },
    script: { B: "ℬ", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ", e: "ℯ", g: "ℊ", o: "ℴ" }
  };

  function stylize(text, style) {
    const map = maps[style];
    if (!map) return text;
    return Array.from(text).map(ch => {
      if (exceptions[style] && exceptions[style][ch]) return exceptions[style][ch];
      const cp = ch.codePointAt(0);
      if (ch >= "A" && ch <= "Z" && map.upper) return String.fromCodePoint(map.upper + cp - 65);
      if (ch >= "a" && ch <= "z" && map.lower) return String.fromCodePoint(map.lower + cp - 97);
      if (ch >= "0" && ch <= "9" && map.digits) return String.fromCodePoint(map.digits + cp - 48);
      return ch;
    }).join("");
  }

  function updateCounts() {
    const text = input.value;
    charCount.textContent = String(text.length);
    const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
    wordCount.textContent = String(words);
    const lines = text.length ? text.split("\n").length : 1;
    lineCount.textContent = `${lines} ${lines === 1 ? "line" : "lines"}`;
  }

  function updatePreview() {
    const value = input.value;
    preview.textContent = value || "Your formatted post will appear here as you write.";
    preview.classList.toggle("is-empty", !value);
    preview.classList.toggle("font-serif", currentFont === "serif");
    preview.classList.toggle("font-mono", currentFont === "mono");
    updateCounts();
  }

  function updateHistoryButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= history.length - 1;
  }

  function recordHistory(value) {
    if (value === lastInputValue) return;
    history = history.slice(0, historyIndex + 1);
    history.push(value);
    if (history.length > 100) history.shift();
    historyIndex = history.length - 1;
    lastInputValue = value;
    updateHistoryButtons();
  }

  function setSaveMessage(message, state = "") {
    saveState.classList.toggle("saving", state === "saving");
    saveState.innerHTML = `<span class="save-dot"></span> ${message}`;
  }

  function persistDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        text: input.value,
        font: currentFont,
        updatedAt: new Date().toISOString()
      }));
      setSaveMessage("Saved locally");
    } catch (error) {
      setSaveMessage("Local save unavailable");
      copyFeedback.textContent = "Your browser prevented local saving. You can still copy your post before leaving this page.";
    }
  }

  function scheduleSave() {
    setSaveMessage("Saving…", "saving");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(persistDraft, 250);
  }

  function restoreDraft() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (typeof parsed.text === "string") input.value = parsed.text;
      if (["inherit", "serif", "mono"].includes(parsed.font)) currentFont = parsed.font;
      document.querySelectorAll(".font-option").forEach(button => {
        button.classList.toggle("active", button.dataset.font === currentFont);
      });
    } catch (error) {
      // Ignore malformed or blocked saved data; the editor remains usable.
    }
  }

  function rememberSelection() {
    lastSelection = { start: input.selectionStart, end: input.selectionEnd };
  }

  function applyFormat(style) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (start === end) {
      copyFeedback.textContent = "Select the text you want to style, then choose a formatting option.";
      input.focus();
      return;
    }
    const selected = input.value.slice(start, end);
    const transformed = stylize(selected, style);
    input.setRangeText(transformed, start, end, "select");
    input.focus();
    lastInputValue = history[historyIndex];
    recordHistory(input.value);
    updatePreview();
    scheduleSave();
  }

  function insertTextAtSelection(text) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.setRangeText(text, start, end, "end");
    input.focus();
    recordHistory(input.value);
    updatePreview();
    scheduleSave();
  }

  function showCopyFeedback(message, isError = false) {
    copyFeedback.textContent = message;
    copyFeedback.style.color = isError ? "#bd3c48" : "";
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      copyFeedback.textContent = "Formatting uses Unicode characters where possible, so styles can carry over when pasted into LinkedIn.";
      copyFeedback.style.color = "";
    }, 4500);
  }

  async function copyPost() {
    const text = input.value;
    if (!text) {
      showCopyFeedback("Write something first, then copy your post.", true);
      input.focus();
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showCopyFeedback("Copied. Paste your post into LinkedIn when you're ready.");
    } catch (error) {
      input.focus();
      input.select();
      const success = document.execCommand("copy");
      input.setSelectionRange(lastSelection.start, lastSelection.end);
      showCopyFeedback(success ? "Copied. Paste your post into LinkedIn when you're ready." : "Copy was blocked by the browser. Select the text and copy it manually.", !success);
    }
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    input.value = history[historyIndex];
    lastInputValue = input.value;
    updatePreview();
    updateHistoryButtons();
    scheduleSave();
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    input.value = history[historyIndex];
    lastInputValue = input.value;
    updatePreview();
    updateHistoryButtons();
    scheduleSave();
  }

  function clearDraft() {
    if (!input.value) return;
    const confirmed = window.confirm("Clear your current draft? This also updates the locally saved draft.");
    if (!confirmed) return;
    input.value = "";
    recordHistory(input.value);
    updatePreview();
    scheduleSave();
    input.focus();
  }

  function toggleEmojiPicker() {
    emojiPanel.hidden = !emojiPanel.hidden;
    if (!emojiPanel.hidden) {
      const first = emojiGrid.querySelector("button");
      if (first) first.focus();
    }
  }

  document.querySelectorAll("[data-format]").forEach(button => {
    button.addEventListener("click", () => applyFormat(button.dataset.format));
  });

  emojiList.forEach(emoji => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = emoji;
    button.setAttribute("aria-label", `Insert ${emoji}`);
    button.addEventListener("click", () => {
      insertTextAtSelection(emoji);
      emojiPanel.hidden = true;
    });
    emojiGrid.appendChild(button);
  });

  input.addEventListener("input", () => {
    recordHistory(input.value);
    updatePreview();
    scheduleSave();
  });
  input.addEventListener("select", rememberSelection);
  input.addEventListener("keyup", rememberSelection);
  input.addEventListener("click", rememberSelection);

  document.getElementById("emojiToggle").addEventListener("click", toggleEmojiPicker);
  document.getElementById("closeEmoji").addEventListener("click", () => {
    emojiPanel.hidden = true;
    document.getElementById("emojiToggle").focus();
  });
  copyBtn.addEventListener("click", copyPost);
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);
  document.getElementById("clearBtn").addEventListener("click", clearDraft);

  document.querySelectorAll(".font-option").forEach(button => {
    button.addEventListener("click", () => {
      currentFont = button.dataset.font;
      document.querySelectorAll(".font-option").forEach(option => option.classList.toggle("active", option === button));
      updatePreview();
      scheduleSave();
    });
  });

  document.addEventListener("keydown", event => {
    const mod = event.metaKey || event.ctrlKey;
    if (!mod) {
      if (event.key === "Escape" && !emojiPanel.hidden) {
        emojiPanel.hidden = true;
        document.getElementById("emojiToggle").focus();
      }
      return;
    }
    const key = event.key.toLowerCase();
    if (event.shiftKey && key === "b") { event.preventDefault(); applyFormat("bold"); }
    else if (event.shiftKey && key === "i") { event.preventDefault(); applyFormat("italic"); }
    else if (event.shiftKey && key === "s") { event.preventDefault(); applyFormat("script"); }
    else if (event.shiftKey && key === "m") { event.preventDefault(); applyFormat("mono"); }
    else if (event.shiftKey && key === "e") { event.preventDefault(); toggleEmojiPicker(); }
    else if (key === "z" && event.shiftKey) { event.preventDefault(); redo(); }
    else if (key === "z") { event.preventDefault(); undo(); }
    else if (key === "y") { event.preventDefault(); redo(); }
  });

  restoreDraft();
  lastInputValue = input.value;
  history = [input.value];
  historyIndex = 0;
  updatePreview();
  updateHistoryButtons();
  setSaveMessage("Saved locally");
})();
