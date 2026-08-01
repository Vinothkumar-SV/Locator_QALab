# Testleaf LocatorX — Phase 1

Chrome-only Playwright locator inspector.

## Features
- Click-to-inspect with element highlighting
- Playwright locator generation:
  - getByRole
  - getByLabel
  - getByTestId
  - getByPlaceholder
  - getByText
  - CSS / ID
  - XPath
- Match-count validation
- Locator Health Score (0–100)
- BEST / GOOD / FRAGILE / AVOID ranking
- Copy and Test actions
- POM collector and TypeScript Page Object generation
- Allure-ready Playwright setup snippet

## Install in Chrome
1. Extract this folder.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `testleaf-locatorx-phase1` folder.
6. Open or reload any normal `http://` or `https://` web page.
7. Pin **Testleaf LocatorX**.
8. Open the extension and click **Inspect Element**.
9. Hover over the page and click an element.
10. Re-open the extension to see generated locators.

Chrome internal pages such as `chrome://settings` cannot be inspected by extensions.

## POM
Inspect an element, reopen LocatorX, click **Add Selected**, repeat for more elements, then click **Generate POM**.

## Allure
Click **Generate Setup** to get the npm install command, Playwright reporter configuration, sample test, and report commands.

## Phase 1 notes
This is an offline/local MVP. Locator scoring is deterministic and heuristic-based. Complex cross-origin iframe inspection and advanced Shadow DOM traversal are candidates for later phases.
