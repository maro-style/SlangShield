// SPDX-License-Identifier: MIT
// Copyright (c) 2026 MARO
document.addEventListener("DOMContentLoaded", () => {
  const providerEl = document.getElementById("provider");
  const apiKeyEl = document.getElementById("apiKey");
  const modelEl = document.getElementById("model");
  const baseUrlEl = document.getElementById("baseUrl");
  const customBox = document.getElementById("customBox");
  const saveBtn = document.getElementById("save");
  const statusEl = document.getElementById("status");
  const openGeminiKey = document.getElementById("openGeminiKey");

  const DEFAULTS = {
    gemini: { model: "gemini-1.5-flash" },
    openai: { model: "gpt-4o-mini" },
    anthropic: { model: "claude-3-5-sonnet-latest" },
    openai_compat: { model: "gpt-4o-mini", baseUrl: "http://localhost:4000/v1" }
  };

  function setStatus(msg, isErr = false) {
    statusEl.textContent = msg;
    statusEl.style.color = isErr ? "#b00020" : "#0b6b2f";
  }

  function refreshCustomVisibility() {
    customBox.style.display = providerEl.value === "openai_compat" ? "block" : "none";
  }

  function applyProviderDefaultsIfEmpty() {
    const p = providerEl.value;
    if (!modelEl.value.trim()) modelEl.value = DEFAULTS[p]?.model || "";
    if (p === "openai_compat" && baseUrlEl && !baseUrlEl.value.trim()) {
      baseUrlEl.value = DEFAULTS[p]?.baseUrl || "";
    }
  }

  providerEl.addEventListener("change", () => {
    refreshCustomVisibility();
    applyProviderDefaultsIfEmpty();
  });

  openGeminiKey.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "https://aistudio.google.com/app/apikey" });
  });

  chrome.storage.sync.get(["provider", "apiKey", "model", "baseUrl"], (res) => {
    if (chrome.runtime.lastError) {
      setStatus(`Storage error: ${chrome.runtime.lastError.message}`, true);
      return;
    }

    providerEl.value = res.provider || "gemini";
    apiKeyEl.value = res.apiKey || "";
    modelEl.value = res.model || "";
    if (baseUrlEl) baseUrlEl.value = res.baseUrl || "";

    refreshCustomVisibility();
    applyProviderDefaultsIfEmpty();

    setStatus(res.apiKey ? "Configuration loaded." : "Enter your settings and click Save.");
  });

  saveBtn.addEventListener("click", () => {
    const provider = providerEl.value;
    const apiKey = apiKeyEl.value.trim();
    const model = modelEl.value.trim();
    const baseUrl = (baseUrlEl?.value || "").trim();

    if (!apiKey) return setStatus("API key is empty.", true);
    if (!model) return setStatus("Model is empty.", true);
    if (provider === "openai_compat" && !baseUrl) return setStatus("Base URL is empty.", true);

    chrome.storage.sync.set({ provider, apiKey, model, baseUrl }, () => {
      if (chrome.runtime.lastError) {
        setStatus(`Save error: ${chrome.runtime.lastError.message}`, true);
        return;
      }
      setStatus("Saved.");
      setTimeout(() => window.close(), 400);
    });
  });
});
