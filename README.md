# 🎯 LocatorX Pro — Enterprise Playwright Locator Inspector

> A production-ready Chrome extension for QA teams: inspect any element, generate **scored, AI-ranked Playwright locators**, and export **Page Object Models** + **Allure-ready test setups**.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Playwright](https://img.shields.io/badge/Playwright-Ready-2EAD33)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

### 🔍 Intelligent Element Inspector
- **Real-time hover overlay** showing tag, ARIA role, and accessible name
- **Esc to cancel** any inspection
- Works on `http`, `https`, `file://`, and dynamically rendered SPAs
- Auto-injects content script if missing (no reload needed)

### 🧠 Scored Locator Generation (12+ Strategies)
Every element yields a ranked list of Playwright locators, each scored 0–100:

| Priority | Strategy | Base Score |
|---------|----------|-----------|
| 1 | `getByTestId` | 100 |
| 2 | `getByRole(role, { name })` | 98 |
| 3 | `getByRole` (regex name) | 92 |
| 4 | `getByLabel` | 96 |
| 5 | `getByAltText` | 94 |
| 6 | `getByPlaceholder` | 88 |
| 7 | `getByTitle` | 86 |
| 8 | `getByText` | 84 |
| 9 | `locator('#id')` | 82 |
| 10 | Scoped CSS | 78 |
| 11 | CSS Path | 65 |
| 12 | XPath (relative) | 50 |
| 13 | XPath (absolute) | 25 |

**Dynamic penalty engine** downgrades scores for:
- Long numeric IDs (`/\\d{5,}/`)
- Hash-like segments (`/[a-f0-9]{12,}/`)
- `nth-of-type` chains
- `/html/...` absolute paths

**Bonus:** Unique-match locators get a `+5` boost.

### 🏷️ Quality Tiers
- 🟢 **BEST** (90–100) — Use in production
- 🔵 **GOOD** (70–89) — Solid choice
- 🟡 **FRAGILE** (45–69) — Use with caution
- 🔴 **AVOID** (0–44) — Will break

### 📦 Page Object Model Export
- Collect elements across multiple page visits
- Auto-generates TypeScript POM with:
  - Typed `readonly` locators
  - `goto(url)` helper
  - `verifyAll()` — validates every locator resolves
  - JSDoc header with generation timestamp
- Deduplicates names automatically (`loginBtn`, `loginBtn2`, …)
- Escapes unsafe identifiers

### 🧪 Allure-Ready Test Setup
One-click generation of:
- Playwright config with list + HTML + Allure reporters
- Environment info captured per run
- Retries, traces, screenshots, videos
- Example spec using the generated POM
- Full CLI workflow (generate + open report)

### ⚙️ Enterprise Architecture
- **Manifest V3** with module service worker
- **Shared constants & messaging layer** (`src/shared/`)
- **Separated locator engine** (page context) from content shell
- **Retry-backed message passing** (2 retries, exponential delay)
- **Restricted-scheme guards** (`chrome://`, `about:`, etc.)
- **History tracking** — last 50 selections persisted with URL/title
- **Keyboard shortcut** — `Alt+Shift+L` to toggle inspector
- **Auto-inject content scripts** when missing
- **Esc-to-cancel** in inspector
- **Filter: unique-only** view
- **Copy shortcuts** — element summary, locator code, POM, Allure setup
- **Live test button** — re-verify a locator's match count without leaving the popup

---

## 📁 Project Structure

```
LocatorX/
├── manifest.json
├── README.md
└── src/
    ├── background/
    │   └── service-worker.js        # Lifecycle, storage router, commands
    ├── content/
    │   ├── locator-engine.js        # Scoring + strategy generation (page ctx)
    │   └── content.js               # Inspector overlay + message router
    ├── popup/
    │   ├── popup.html               # UI shell
    │   ├── popup.css                # Design system (design tokens + components)
    │   └── popup.js                 # Controller / renderer
    ├── shared/
    │   ├── constants.js             # MSG, STORAGE_KEYS, QUALITY, settings
    │   ├── messaging.js             # sendToActiveTab, ensureContentScript
    │   └── utils.js                 # escapeHtml, sanitizeIdentifier, debounce
    └── assets/
        └── icons/                   # 16 / 48 / 128 px icons
```

---

## 🚀 Installation (Developer Mode)

1. Clone the repo:
   ```bash
   git clone https://github.com/Vinothkumar-SV/Locator_QALab.git
   cd Locator_QALab
   ```
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top-right)
4. Click **Load unpacked** → select the project root
5. Pin the extension to your toolbar

---

## 🎬 Usage

### Basic Inspection
1. Navigate to any web page
2. Click the LocatorX icon → **🎯 Inspect Element**
3. Hover an element (see overlay) → click it
4. Popup reopens with ranked locators

### Build a POM
1. Inspect an element → click **+ Add Selected**
2. Repeat for multiple elements
3. Enter a class name (e.g., `LoginPage`)
4. Click **Generate POM** → **📋 Copy POM**

### Verify Locators
- Click **🧪 Test** on any locator to re-check its match count live
- Toggle **Unique only** to hide multi-match candidates

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+L` | Toggle inspector |
| `Esc` | Cancel inspection |

---

## 🧪 Example Generated Locators

```ts
page.getByTestId('submit-button')
page.getByRole('button', { name: 'Submit' })
page.getByLabel('Email address')
page.getByPlaceholder('Enter your password')
page.getByText('Sign in', { exact: true })
page.locator('#username')
page.locator('form#login input[type="email"]')
page.locator('xpath=//*[@id="app"]//button[2]')
```

---

## 🏗 Tech Stack

| Layer | Tech |
|-------|------|
| Extension | Manifest V3, ES Modules |
| Content | Vanilla JS, DOM APIs, XPath, CSS.escape |
| Background | Service Worker (module) |
| Popup | Vanilla JS, CSS custom properties |
| Storage | `chrome.storage.local` |
| Clipboard | `navigator.clipboard` |

---

## 🔒 Privacy & Permissions

- **`activeTab`** — inspect the current tab only after user action
- **`scripting`** — inject content scripts on-demand
- **`storage`** — persist POM & selection locally (never uploaded)
- **`clipboardWrite`** — copy locators/POM/setup
- **`<all_urls>`** — needed to inspect any site you visit

**No data leaves your browser.** No analytics, no telemetry, no external requests.

---

## 🗺 Roadmap

- [x] Scored locator generation
- [x] Page Object Model export
- [x] Allure-ready setup generator
- [x] History & keyboard shortcuts
- [ ] iframe / Shadow DOM inspection
- [ ] Selenium (Java/Python/C#) export
- [ ] Team-shared POM library (opt-in)
- [ ] Diff mode — compare locators before/after DOM changes
- [ ] CI export — GitHub Actions snippet

---

## 🤝 Contributing

```bash
git checkout -b feature/NewFeature
git commit -m "feat: add new feature"
git push origin feature/NewFeature
```

Open a Pull Request. All contributions welcome.

---

## 👨‍💻 Author

**Vinoth Kumar**
GitHub: [@Vinothkumar-SV](https://github.com/Vinothkumar-SV)

---

## 📄 License

MIT © Vinoth Kumar

---

## 🌟 Why LocatorX Pro?

Most locator tools stop at "here's an XPath." **LocatorX Pro gives you a ranked, scored, actionable list** — plus the POM and Allure scaffolding to ship it. It's built by QA engineers for QA engineers: minimal clicks, maximum signal, zero telemetry.

**Happy Testing! 🚀**