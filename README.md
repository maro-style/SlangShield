# SlangShield
<p align="center">
  <img src="assets/SlangShield.jpg" alt="SlangShield logo" width="160">
</p>

SlangShield is a Chrome/Chromium extension that turns informal/slangy drafts into **formal corporate email language** (IT/EN) using the LLM provider you choose.

It's vibe coded, I have great ideas without the coding capability, don't break my balls. 


## Features
- One-click / one-shortcut formalization for Gmail and Outlook Web.
- Supports multiple providers:
  - Gemini
  - OpenAI
  - Anthropic (Claude)
  - Custom OpenAI-compatible (`/chat/completions`)
- Indeterminate top loading bar + on-page status notifications.
- Continuation pass to reduce truncated outputs on long drafts.

## Installation (Developer mode)
1. Download this repository (Code → Download ZIP) and unzip it.
2. Open Chrome and go to: `chrome://extensions/`
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder that contains `manifest.json`.

After reloading the extension, refresh Gmail/Outlook tabs to re-inject the content script.

## Setup
Click the extension icon to open the settings popup and configure:
- Provider
- API key
- Model
- (Custom only) Base URL

### Gemini API key
Get a Gemini API key here:
https://aistudio.google.com/app/apikey

Paste it into the popup and click **Save**.

## Usage
- Click inside the email body, then press:
  - Windows/Linux: `Ctrl+Shift+F`
  - macOS: `Cmd+Shift+F`
- Or click the **🛡️ Formalize** button injected near the editor.

The extension detects whether the input is Italian or English and rewrites in the **same** language (no translation).

## Screenshots

### English
**Slang → Formal**
![English slang](<screenshots/Example Eng Slang.png>)
![English formal](<screenshots/Example Eng Formal.png>)

### Italian
**Slang → Formale**
![Italian slang](<screenshots/Esempio Ita Slang.png>)
![Italian formal](<screenshots/Esempio Ita Formale.png>)


## Troubleshooting
### “Extension context invalidated”
This happens if the extension was reloaded while Gmail/Outlook was open.
Refresh the page (F5 / Cmd+R) and try again.

### Stuck on “Formalizing…”
- Check your provider settings (API key/model) in the popup.
- Inspect logs: `chrome://extensions` → your extension → Service worker → Inspect.

### Custom provider not working
If your custom Base URL is not `localhost`, add your domain to `host_permissions` in `manifest.json`, then reload the extension.

## Security notes
Your draft text is sent to the configured provider API for rewriting.
API keys are stored in `chrome.storage.sync` (your browser profile).

## License
GNU GPL v3.0 © 2026 maro
