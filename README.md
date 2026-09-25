<h1 align="center">
  🔨 LocatorForge
</h1>

<p align="center">
  <strong>Inspect · Record · Forge production-ready Playwright tests</strong>
</p>

<p align="center">
  <a href="#-features"><img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square"></a>
  <a href="#-features"><img alt="Playwright" src="https://img.shields.io/badge/Playwright-Ready-2EAD33?style=flat-square"></a>
  <a href="#-features"><img alt="Allure" src="https://img.shields.io/badge/Allure-Annotated-orange?style=flat-square"></a>
  <a href="#-license"><img alt="License" src="https://img.shields.io/badge/License-MIT-green?style=flat-square"></a>
  <a href="#-contributing"><img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square"></a>
</p>

<p align="center">
  A Chrome extension that turns any web page into a Playwright test generator.<br/>
  <em>Inspect elements · Record real user journeys · Export Allure-annotated Page Objects.</em>
</p>

---

## 📖 Overview

**LocatorForge** is an enterprise-grade Chrome extension built for QA engineers, SDETs, and automation teams who want to move from *"I can see the element"* to *"I have a tested Page Object"* in seconds.

Most locator tools stop at *"here's an XPath."* LocatorForge gives you a **ranked, scored, actionable** list of Playwright locators, **records your clicks and keystrokes** as structured test steps, and **generates a fully annotated POM** with `@allure.step` decorators, severity metadata, and a `verifyAll()` method — all from a single browser session.

---

## ✨ Features

### 🔍 Intelligent Element Inspector
- **Real-time hover overlay** showing tag, ARIA role, and accessible name
- **Esc-to-cancel** inspection at any point
- Works on `http`, `https`, and `file://` pages
- Auto-injects its content script if missing — no page reload needed
- Handles cross-frame pages and dynamically rendered SPAs

### 🧠 Scored Locator Generation (13+ Strategies)
Every element yields a **ranked list of Playwright locators**, each scored 0–100:

| Priority | Strategy | Base Score |
|:--------:|----------|:----------:|
| 1 | `getByTestId(...)` | 100 |
| 2 | `getByRole(role, { name })` | 98 |
| 3 | `getByLabel(...)` | 96 |
| 4 | `getByAltText(...)` | 94 |
| 5 | `getByRole` (regex name) | 92 |
| 6 | `getByPlaceholder(...)` | 88 |
| 7 | `getByTitle(...)` | 86 |
| 8 | `getByText(..., { exact: true })` | 84 |
| 9 | `locator('#id')` | 82 |
| 10 | Scoped CSS | 78 |
| 11 | CSS Path | 65 |
| 12 | XPath (relative) | 50 |
| 13 | XPath (absolute) | 25 |

**Dynamic penalty engine** downgrades scores for:
- Long numeric IDs (`/\d{5,}/`)
- Hash-like segments (`/[a-f0-9]{12,}/`)
- `nth-of-type` chains
- Absolute `/html/...` paths

**Bonus:** unique-match locators get a `+5` boost.

### 🏷️ Quality Tiers
| Tier | Score | Meaning |
|------|:-----:|---------|
| 🟢 **BEST** | 90–100 | Use in production |
| 🔵 **GOOD** | 70–89 | Solid choice |
| 🟡 **FRAGILE** | 45–69 | Use with caution |
| 🔴 **AVOID** | 0–44 | Will break soon |

### 🎬 Action Recorder
Records every meaningful interaction and converts it to a structured Playwright step:

| Action | Captured From |
|--------|---------------|
| `navigate` | Full page load / SPA route change |
| `click` | Any clickable element |
| `fill` | Text inputs, textareas (debounced) |
| `select` | `<select>` dropdowns |
| `check` / `uncheck` | Checkboxes and radios |
| `upload` | File inputs |
| `press` | Special keys (Enter, Escape, etc.) |
| `hover` | Interactive elements only (long-press detection) |
| `assertVisible` | Toggleable asserts |
| `assertText` | Toggleable asserts |

- Live step list with **delete-per-step**
- Debounced `fill` steps — one per pause in typing, not per keystroke
- Auto-coalesces hover-then-click on the same element
- Persists through full-page navigations via `sessionStorage`

### 📦 Allure-Annotated POM Export
- **`@allure.step("...")`** decorator on every action method
- **`@allure.suite`**, **`@allure.epic`**, **`@allure.feature`**, **`@allure.story`** at class level
- **`@allure.severity`** per method derived from the action kind
- **`runRecordedJourney()`** — replays every step in order
- **`verifyAll()`** — asserts every locator resolves
- **`goto(url)`** helper with JSDoc
- Auto-deduplicated property and method names (`emailInput`, `emailInput2`, …)
- Escapes unsafe identifiers

### 🧪 Allure-Annotated Test Generator
Generates a complete `*.spec.ts` with:
- `allure.epic` / `allure.feature` / `allure.story` / `allure.severity` in `beforeEach`
- `allure.owner`, `allure.tag`, `allure.link` metadata
- **`test.step(...)`** wrapper for every recorded action
- **Environment info attachment** (baseURL, browser, OS, node version)
- **`verifyAll()`** soft-assert block at the end
- Works with or without TypeScript decorators

### ⚙️ Enterprise Architecture
- **Manifest V3** with module service worker
- **Shared constants & messaging layer** (`src/shared/`)
- **Separated locator engine** (page context) from content shell
- **Retry-backed message passing** with exponential backoff
- **Restricted-scheme guards** (`chrome://`, `edge://`, Web Store)
- **Selection history** — last 50 inspected elements with URL + title
- **Keyboard shortcut** — `Alt+Shift+L` to toggle inspector
- **Esc-to-cancel** during inspection or recording

---

## 📸 Screenshots

> _Add screenshots to `docs/screenshots/` and reference them here._

| View | Preview |
|------|---------|
| Inspector Overlay | `docs/screenshots/inspector.png` |
| Locator List | `docs/screenshots/locators.png` |
| Recorder Panel | `docs/screenshots/recorder.png` |
| Generated POM | `docs/screenshots/pom.png` |
| Allure Report | `docs/screenshots/allure.png` |

---

## 🚀 Installation

### Option 1 — Chrome Web Store
> _Coming soon._

### Option 2 — Developer Mode (recommended for now)

1. Clone the repository:
   ```bash
   git clone https://github.com/Vinothkumar-SV/Locator_QALab.git
   cd Locator_QALab
   ```

2. Open Chrome and navigate to:
   ```
   chrome://extensions
   ```

3. Enable **Developer mode** (toggle in the top-right).

4. Click **Load unpacked** and select the project root.

5. Pin **LocatorForge** to your toolbar.

6. **Reload any already-open tabs** (`Ctrl+Shift+R`) so the content script is injected fresh.

---

## 🎬 Usage

### Basic Inspection
1. Navigate to any `https://` page (e.g. https://playwright.dev).
2. Click the LocatorForge icon → **🎯 Inspect Element**.
3. Hover any element — a purple outline and dark overlay label appear.
4. Click it — the popup reopens with the ranked locator list.
5. Press **Esc** during inspection to cancel.

### Build a POM from Inspected Elements
1. Inspect an element → click **+ Add Selected**.
2. Repeat for every element you need.
3. Enter a **Class name** (e.g. `LoginPage`).
4. Click **⚙ Generate POM** → **📋 Copy POM**.

### Record & Generate a Full Journey
1. In the popup, scroll to **🎬 Action Recorder**.
2. Enter a **Class name** (e.g. `LoginPage`) in the POM card above.
3. Click **⏺ Record**.
4. Interact with the page:
   - Type in fields → each pause = one `fill` step.
   - Click buttons, check boxes, pick dropdowns, upload files.
   - Navigate between pages → captured automatically.
5. Click **⏹ Stop**.
6. Remove unwanted steps with the **✕** button.
7. Click **⚙ Generate POM + Allure** for the Page Object.
8. Click **🧪 Generate Test** for a full Playwright spec.
9. Copy either with the buttons below each textarea.

### Verify Locators Live
- Click **🧪 Test** on any locator to re-count matching elements on the live page.
- Toggle **Unique only** to hide multi-match candidates.

---

## 📁 Project Structure

```
LocatorForge/
├── manifest.json
├── README.md
├── LICENSE
├── docs/
│   └── screenshots/
└── src/
    ├── background/
    │   └── service-worker.js        # Lifecycle, storage router, commands
    ├── content/
    │   ├── locator-engine.js        # Scored strategy generation (page ctx)
    │   ├── action-recorder.js       # Records user interactions
    │   └── content.js               # Inspector + message router
    ├── popup/
    │   ├── popup.html               # UI shell
    │   ├── popup.css                # Design tokens + components
    │   └── popup.js                 # Controller / renderer / generators
    ├── shared/
    │   ├── constants.js             # MSG, STORAGE_KEYS, QUALITY, settings
    │   ├── messaging.js             # sendToActiveTab, ensureContentScript
    │   ├── action-model.js          # Action kinds, severity, renderers
    │   └── utils.js                 # escapeHtml, sanitizeIdentifier, debounce
    └── assets/
        └── icons/                   # 16 / 48 / 128 px icons
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+L` | Toggle inspector |
| `Esc` | Cancel inspection or stop recording |

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

## 📦 Example Generated POM

```ts
import { Page, Locator, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';

/**
 * LoginPage
 * Auto-generated by LocatorForge · 2025-01-15
 *
 * @allure.suite LocatorX Recorded Flows
 * @allure.epic LocatorForge
 * @allure.feature LoginPage
 * @allure.story Recorded user journey
 *
 * Recorded steps:
 *   - 1. Navigate to https://example.com/login
 *   - 2. Fill "Email" with "user@example.com"
 *   - 3. Fill "Password" with "secret123"
 *   - 4. Click "Sign in"
 *   - 5. Assert "Welcome" is visible
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInBtn: Locator;
  readonly welcomeText: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput   = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.signInBtn    = page.getByRole('button', { name: 'Sign in' });
    this.welcomeText  = page.getByText('Welcome');
  }

  @allure.step('Navigate to {url}')
  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  @allure.step('Fill "Email" with "user@example.com"')
  async fillEmail(): Promise<void> {
    await this.emailInput.fill('user@example.com');
  }

  @allure.step('Fill "Password" with "secret123"')
  async fillPassword(): Promise<void> {
    await this.passwordInput.fill('secret123');
  }

  @allure.step('Click "Sign in"')
  async clickSignIn(): Promise<void> {
    await this.signInBtn.click();
  }

  @allure.step('Assert "Welcome" is visible')
  async expectWelcomeVisible(): Promise<void> {
    await expect(this.welcomeText).toBeVisible();
  }

  @allure.step('Run recorded journey')
  async runRecordedJourney(): Promise<void> {
    await this.fillEmail();
    await this.fillPassword();
    await this.clickSignIn();
    await this.expectWelcomeVisible();
  }

  @allure.step('Verify all locators resolve')
  async verifyAll(): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    results['emailInput']   = await this.emailInput.count();
    results['passwordInput'] = await this.passwordInput.count();
    results['signInBtn']    = await this.signInBtn.count();
    results['welcomeText']  = await this.welcomeText.count();
    return results;
  }
}
```

---

## 📊 Example Generated Test

```ts
import { test, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { Severity } from 'allure-js-commons';
import { LoginPage } from '../pages/LoginPage';

test.describe('LocatorForge Recorded Flows', () => {
  test.beforeEach(async () => {
    await allure.epic('LocatorForge');
    await allure.feature('LoginPage');
    await allure.story('Recorded user journey');
    await allure.severity(Severity.CRITICAL);
    await allure.owner('LocatorForge');
    await allure.tag('recorded');
    await allure.tag('playwright');
  });

  test('Recorded user journey', async ({ page }, testInfo) => {
    const pom = new LoginPage(page);

    await allure.step('Attach environment info', async () => {
      await testInfo.attach('environment', {
        body: JSON.stringify({
          baseURL: testInfo.project.use.baseURL,
          browser: testInfo.project.name,
          os: process.platform,
          node: process.version,
        }, null, 2),
        contentType: 'application/json',
      });
    });

    await test.step('2. Fill "Email" with "user@example.com"', async () => {
      await page.getByLabel('Email').fill('user@example.com');
    });

    // ... more steps ...

    await allure.step('Verify every locator resolves', async () => {
      const counts = await pom.verifyAll();
      for (const [name, count] of Object.entries(counts)) {
        await allure.step(`Verify "${name}" resolves`, async () => {
          expect.soft(count, `${name} should resolve`).toBeGreaterThan(0);
        });
      }
    });
  });
});
```

---

## 🏗 Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Manifest V3, ES Modules |
| Content | Vanilla JS, DOM APIs, XPath, `CSS.escape` |
| Background | Service Worker (module) |
| Popup | Vanilla JS, CSS custom properties |
| Storage | `chrome.storage.local`, `sessionStorage` |
| Clipboard | `navigator.clipboard` |
| Target frameworks | Playwright + Allure |

---

## 🔒 Privacy & Permissions

| Permission | Why it's needed |
|------------|-----------------|
| `activeTab` | Inspect the current tab only after a user action |
| `scripting` | Inject content scripts on-demand |
| `storage` | Persist POM items & selections locally |
| `clipboardWrite` | Copy locators, POMs, and setups |
| `tabs` | Query the active tab & read its URL |
| `webNavigation` | Broadcast inspector messages across frames |
| `<all_urls>` | Needed to inspect any site you visit |

> **No data leaves your browser.** No analytics. No telemetry. No external network requests. Everything is generated locally in the page context and stored in `chrome.storage.local`.

---

## 🗺 Roadmap

### ✅ Shipped
- [x] Scored locator generation (13 strategies)
- [x] Quality tiers + dynamic penalty engine
- [x] Real-time hover overlay with ARIA info
- [x] Esc-to-cancel inspector
- [x] Action recorder (click, fill, select, check, upload, press, hover, navigate)
- [x] Debounced fill + hover-coalescing
- [x] Allure-annotated POM generator
- [x] Allure-annotated test generator
- [x] Page Object Model export with `verifyAll()`
- [x] Allure-ready Playwright config generator
- [x] Selection history (last 50)
- [x] Keyboard shortcut (`Alt+Shift+L`)

### 🚧 In Progress
- [ ] iframe & cross-frame inspection
- [ ] Shadow DOM piercing via `composedPath()`
- [ ] Selenium (Java / Python / C#) export

### 🎯 Planned
- [ ] Cypress export
- [ ] Diff mode — compare locators before/after DOM changes
- [ ] Team-shared POM library (opt-in)
- [ ] CI snippets (GitHub Actions, GitLab CI)
- [ ] Assertion builder UI (visual author of `expect()` calls)
- [ ] Network request recorder → API test stubs
- [ ] Screenshot-on-step for Allure attachments

---

## 🤝 Contributing

Contributions are welcome from the QA community.

```bash
# Fork the repo, then:
git clone https://github.com/<your-username>/Locator_QALab.git
cd Locator_QALab
git checkout -b feature/AmazingFeature

# Make changes, then:
git add .
git commit -m "feat: add amazing feature"
git push origin feature/AmazingFeature
```

Open a Pull Request against `main`. Please include:
- A clear description of the change
- Screenshots or a short GIF for UI changes
- Reference to the related issue (if any)

### Development tips
- After editing source files: `chrome://extensions` → **↻ Reload** LocatorForge, then hard-reload your test tab (`Ctrl+Shift+R`).
- Open the **popup console** via right-click → **Inspect popup**.
- Watch for the `[LocatorForge]` prefix in the page console to confirm the content script loaded.

---

## 👨‍💻 Author

**Vinoth Kumar**

- GitHub: [@Vinothkumar-SV](https://github.com/Vinothkumar-SV)
- Project: [Locator_QALab](https://github.com/Vinothkumar-SV/Locator_QALab)

---

## ⭐ Support

If LocatorForge saves you time:

- ⭐ Star the [repository](https://github.com/Vinothkumar-SV/Locator_QALab)
- 🐛 [Report bugs](https://github.com/Vinothkumar-SV/Locator_QALab/issues)
- 💡 [Suggest features](https://github.com/Vinothkumar-SV/Locator_QALab/issues)
- 📣 Share it with fellow QA engineers

---

## 📄 License

Licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

```
MIT License

Copyright (c) 2025 Vinoth Kumar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🌟 Why LocatorForge?

Most tools stop at *"here's an XPath."* LocatorForge gives you a **ranked, scored, actionable list** — plus the **Page Object** and **Allure scaffolding** to actually ship it.

Built by QA engineers for QA engineers:

- 🎯 **Minimal clicks** — from inspect to POM in seconds
- 📊 **Maximum signal** — every locator carries a health score
- 🔒 **Zero telemetry** — your data never leaves your browser
- 🧪 **Playwright-first** — built on the modern locator APIs
- ✨ **Allure-native** — reports look like a human wrote them

> **Inspect. Record. Forge.**

Happy Testing! 🚀