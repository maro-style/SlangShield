// SPDX-License-Identifier: MIT
// Copyright (c) 2026 MARO
// background.js (MV3 service worker) 

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "formalize-text") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { action: "triggerFormalize" }, () => {
    if (chrome.runtime.lastError) {
      console.error("tabs.sendMessage error:", chrome.runtime.lastError.message);
    }
  });
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action !== "formalize") return;

  (async () => {
    const out = await formalizeText(req.text || "", req.language || "en");
    sendResponse({ ok: true, out });
  })().catch((e) => {
    sendResponse({ ok: false, error: String(e?.message || e) });
  });

  // Keep the channel open for async sendResponse. [web:247]
  return true;
});

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["provider", "apiKey", "model", "baseUrl"], resolve);
  });
}

async function fetchWithTimeout(url, options, timeoutMs = 25000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function readErrorBody(resp) {
  try {
    const t = await resp.text();
    return t ? ` — ${t.slice(0, 500)}` : "";
  } catch {
    return "";
  }
}

function buildPrompt(text, language) {
  const targetLanguage = language === "it" ? "Italian" : "English";

  return `R
Rewrite the text into very formal corporate email language.

Critical rules:
- Do NOT translate. Keep the same language as the input (${targetLanguage}).
- Preserve meaning and facts. Do not add new details.
- Keep formatting reasonable (paragraphs ok). No headings, no bullet lists unless already present in the input.
- Output ONLY the rewritten email body text (no commentary, no prefaces).
- Do NOT output any email headers or metadata: no Subject/Oggetto, no “Subject:”, no “Oggetto:”, no “Re:”, no “R:”, no “FW/Fwd:”, no From/To/Cc/Bcc/Date.
- If the input contains a subject line, remove it from the output and rewrite only the body content.
- The first character of your output must be the first character of the email body (e.g., greeting or first sentence). Do not start with labels like “Subject:” / “Oggetto:”.


TEXT:
${text}`;
}

async function formalizeText(text, language) {
  const cfg = await getConfig();
  const provider = (cfg.provider || "gemini").trim();
  const apiKey = (cfg.apiKey || "").trim();
  const model = (cfg.model || "").trim();
  const baseUrl = (cfg.baseUrl || "").trim();

  if (!apiKey) throw new Error("API key is not configured (open the extension popup).");
  if (!model) throw new Error("Model is not configured (open the extension popup).");
  if (provider === "openai_compat" && !baseUrl) throw new Error("Custom Base URL is missing (open the extension popup).");

  const prompt = buildPrompt(text, language);
  return callProviderWithContinuation({ provider, apiKey, model, baseUrl, prompt, language });
}

async function callProviderWithContinuation({ provider, apiKey, model, baseUrl, prompt, language }) {
  const continuePrompt =
    "Continue exactly where you stopped. Output only the remaining text, no explanation.";

  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const r1 = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2500 }
      })
    });

    if (!r1.ok) throw new Error(`Gemini HTTP ${r1.status}${await readErrorBody(r1)}`);
    const j1 = await r1.json();

    const cand1 = j1?.candidates?.[0];
    const text1 = cand1?.content?.parts?.map((p) => p?.text || "").join("").trim() || "";
    const reason1 = cand1?.finishReason;
    const truncated = reason1 && String(reason1).toUpperCase().includes("MAX_TOKENS");
    if (!truncated) return text1;

    const r2 = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: prompt }] },
          { role: "model", parts: [{ text: text1 }] },
          { role: "user", parts: [{ text: continuePrompt }] }
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2500 }
      })
    });

    if (!r2.ok) return text1;
    const j2 = await r2.json();
    const cand2 = j2?.candidates?.[0];
    const text2 = cand2?.content?.parts?.map((p) => p?.text || "").join("").trim() || "";

    return (text1 + "\n" + text2).trim();
  }

  if (provider === "openai" || provider === "openai_compat") {
    const root = provider === "openai_compat" ? baseUrl.replace(/\/+$/, "") : "https://api.openai.com/v1";
    const url = `${root}/chat/completions`;

    const r1 = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2500
      })
    });

    if (!r1.ok) throw new Error(`OpenAI-compatible HTTP ${r1.status}${await readErrorBody(r1)}`);
    const j1 = await r1.json();

    const text1 = j1?.choices?.[0]?.message?.content?.trim() || "";
    const finish1 = j1?.choices?.[0]?.finish_reason;
    if (finish1 !== "length") return text1;

    const r2 = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: prompt },
          { role: "assistant", content: text1 },
          { role: "user", content: continuePrompt }
        ],
        temperature: 0.3,
        max_tokens: 2500
      })
    });

    if (!r2.ok) return text1;
    const j2 = await r2.json();
    const text2 = j2?.choices?.[0]?.message?.content?.trim() || "";

    return (text1 + "\n" + text2).trim();
  }

  if (provider === "anthropic") {
    const url = "https://api.anthropic.com/v1/messages";

    const r1 = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!r1.ok) throw new Error(`Anthropic HTTP ${r1.status}${await readErrorBody(r1)}`);
    const j1 = await r1.json();

    const blocks1 = j1?.content || [];
    const text1 = blocks1.map((b) => b?.text || "").join("").trim();
    const stop1 = j1?.stop_reason;
    if (stop1 !== "max_tokens") return text1;

    const r2 = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        messages: [
          { role: "user", content: prompt },
          { role: "assistant", content: text1 },
          { role: "user", content: continuePrompt }
        ]
      })
    });

    if (!r2.ok) return text1;
    const j2 = await r2.json();

    const blocks2 = j2?.content || [];
    const text2 = blocks2.map((b) => b?.text || "").join("").trim();

    return (text1 + "\n" + text2).trim();
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
