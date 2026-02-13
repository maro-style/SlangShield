// SPDX-License-Identifier: MIT
// Copyright (c) 2026 MARO
// content.js — complete (Gmail/Outlook), English UI + top loading bar

function showNotification(message, persistent = false) {
  const notification = document.createElement("div");
  notification.className = "slangshield-notification";
  notification.textContent = message;
  document.body.appendChild(notification);

  if (!persistent) {
    setTimeout(() => notification.remove(), 3000);
    return null;
  }
  return notification;
}

// Indeterminate progress bar (UI only, not real %)
function showProgressBar() {
  let el = document.getElementById("slangshield-progress");
  if (el) return el;

  el = document.createElement("div");
  el.id = "slangshield-progress";
  el.className = "slangshield-progress";
  document.documentElement.appendChild(el);
  return el;
}

function hideProgressBar() {
  const el = document.getElementById("slangshield-progress");
  if (el) el.remove();
}

// Lightweight IT/EN detector (heuristic)
function detectLang(text) {
  const itWords = [
    "che","non","per","con","sono","della","questo","quello","anche","tutto","più","cosa",
    "perché","ma","come","grazie","buongiorno","salve","cordiali","resto","attesa","inviato",
    "allego","riscontro","gentile","spettabile","prego","scusi","scusa","ciao","oggetto"
  ];
  const low = ` ${String(text || "").toLowerCase()} `;
  let score = 0;
  for (const w of itWords) {
    if (low.includes(` ${w} `)) score++;
  }
  return score >= 2 ? "it" : "en";
}

// Finds nearest real editor (Gmail often focuses a child node)
function findNearestEditable(startEl) {
  let el = startEl;
  while (el && el !== document.documentElement) {
    if (el.tagName === "TEXTAREA") return el;
    if (el.isContentEditable) return el;
    el = el.parentElement;
  }
  return document.querySelector('div[role="textbox"][contenteditable="true"]');
}

function readText(editableEl) {
  return editableEl?.value !== undefined ? (editableEl.value || "") : (editableEl?.innerText || "");
}

function writeText(editableEl, value) {
  if (!editableEl) return;

  if (editableEl.value !== undefined) editableEl.value = value;
  else editableEl.innerText = value;

  editableEl.dispatchEvent(new Event("input", { bubbles: true }));
}

function formalizeEditable(editableEl) {
  const text = readText(editableEl);

  if (!text.trim()) {
    showNotification("⚠️ The field is empty.");
    return;
  }

  const loadingDiv = showNotification("⏳ Formalizing…", true);
  showProgressBar();

  const language = detectLang(text);

  let finished = false;
  const finish = (msg, isErr = false) => {
    if (finished) return;
    finished = true;

    if (loadingDiv) loadingDiv.remove();
    hideProgressBar();

    if (msg) showNotification(msg, false);
  };

  // Hard guard: always stop spinner/bar
  const guard = setTimeout(() => {
    finish("❌ Timeout: no response. Try again.", true);
  }, 25000);

  try {
    chrome.runtime.sendMessage({ action: "formalize", text, language }, (response) => {
      clearTimeout(guard);

      // Background unreachable / channel closed
      if (chrome.runtime.lastError) {
        finish(`❌ ${chrome.runtime.lastError.message}`, true);
        return;
      }

      const ok = response?.ok ?? response?.success;
      const out = response?.out ?? response?.formalizedText;
      const err = response?.error;

      if (ok && out) {
        writeText(editableEl, out);
        finish("✅ Done.");
      } else {
        finish(`❌ ${err || "Empty response / missing configuration."}`, true);
      }
    });
  } catch {
    clearTimeout(guard);
    finish("❌ Extension was updated. Refresh the page and try again.", true);
  }
}

// Triggered by shortcut (background → content message)
chrome.runtime.onMessage.addListener((request) => {
  if (request.action !== "triggerFormalize") return;

  const editable = findNearestEditable(document.activeElement);
  if (!editable) {
    showNotification("⚠️ Click inside the email body first.");
    return;
  }

  formalizeEditable(editable);
});

// Inject an inline button once per editor
function addFormalizeButton(editableEl) {
  if (!editableEl || editableEl.dataset.slangshieldAdded) return;
  editableEl.dataset.slangshieldAdded = "true";

  const button = document.createElement("button");
  button.textContent = "🛡️ Formalize";
  button.className = "slangshield-inline-btn";
  button.type = "button";

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    formalizeEditable(editableEl);
  });

  const container = editableEl.parentElement || editableEl;
  if (container && container.insertBefore) container.insertBefore(button, editableEl);
}

// Observe dynamic DOM updates (Gmail/Outlook)
const observer = new MutationObserver(() => {
  document
    .querySelectorAll('div[role="textbox"][contenteditable="true"]')
    .forEach(addFormalizeButton);

  document
    .querySelectorAll('div[contenteditable="true"][aria-label*="message" i]')
    .forEach(addFormalizeButton);

  document
    .querySelectorAll('textarea[name*="message" i], textarea[name*="body" i]')
    .forEach(addFormalizeButton);
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial scan
setTimeout(() => {
  document
    .querySelectorAll('div[role="textbox"][contenteditable="true"]')
    .forEach(addFormalizeButton);

  document.querySelectorAll("textarea").forEach(addFormalizeButton);
}, 1500);
