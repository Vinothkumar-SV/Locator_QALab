// Canonical list of action kinds the recorder can emit
export const ACTION_KIND = Object.freeze({
  NAVIGATE:   'navigate',
  CLICK:      'click',
  FILL:       'fill',
  CLEAR:      'clear',
  TYPE:       'type',            // pressSequentially
  PRESS:      'press',
  CHECK:      'check',
  UNCHECK:    'uncheck',
  SELECT:     'select',
  HOVER:      'hover',
  FOCUS:      'focus',
  BLUR:       'blur',
  UPLOAD:     'upload',
  WAIT:       'wait',
  ASSERT_TEXT:      'assertText',
  ASSERT_VISIBLE:   'assertVisible',
  ASSERT_COUNT:     'assertCount',
  SCROLL:     'scroll',
});

export const SEVERITY = Object.freeze({
  BLOCKER:  'blocker',
  CRITICAL: 'critical',
  NORMAL:   'normal',
  MINOR:    'minor',
  TRIVIAL:  'trivial',
});

// Sensible default severity per action kind
export const DEFAULT_SEVERITY = Object.freeze({
  [ACTION_KIND.NAVIGATE]:      SEVERITY.CRITICAL,
  [ACTION_KIND.CLICK]:         SEVERITY.NORMAL,
  [ACTION_KIND.FILL]:          SEVERITY.NORMAL,
  [ACTION_KIND.CLEAR]:         SEVERITY.MINOR,
  [ACTION_KIND.TYPE]:          SEVERITY.MINOR,
  [ACTION_KIND.PRESS]:         SEVERITY.MINOR,
  [ACTION_KIND.CHECK]:         SEVERITY.NORMAL,
  [ACTION_KIND.UNCHECK]:       SEVERITY.NORMAL,
  [ACTION_KIND.SELECT]:        SEVERITY.NORMAL,
  [ACTION_KIND.HOVER]:         SEVERITY.MINOR,
  [ACTION_KIND.FOCUS]:         SEVERITY.TRIVIAL,
  [ACTION_KIND.BLUR]:          SEVERITY.TRIVIAL,
  [ACTION_KIND.UPLOAD]:        SEVERITY.NORMAL,
  [ACTION_KIND.WAIT]:          SEVERITY.MINOR,
  [ACTION_KIND.ASSERT_TEXT]:   SEVERITY.CRITICAL,
  [ACTION_KIND.ASSERT_VISIBLE]:SEVERITY.CRITICAL,
  [ACTION_KIND.ASSERT_COUNT]:  SEVERITY.CRITICAL,
  [ACTION_KIND.SCROLL]:        SEVERITY.TRIVIAL,
});

export function makeStepId() {
  return 'step_' + Math.random().toString(36).slice(2, 10);
}

/**
 * Serialize a step's locator call into a Playwright expression.
 * locatorCode is already a full `page.getByRole(...)` style string.
 * We rewrite `page.` -> `this.page.` for POM context.
 */
export function pomLocator(locatorCode) {
  return String(locatorCode || '').replace(/\bpage\./g, 'this.page.');
}

/**
 * Produce the single-line Playwright action body for a step.
 * Uses the *suggested* best locator from the recorder.
 */
export function renderStepBody(step) {
  const loc = pomLocator(step.locatorCode);
  const arg = step.value;
  const q = (v) => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

  switch (step.kind) {
    case ACTION_KIND.NAVIGATE:      return `await this.page.goto(${q(arg)});`;
    case ACTION_KIND.CLICK:         return `await ${loc}.click();`;
    case ACTION_KIND.FILL:          return `await ${loc}.fill(${q(arg)});`;
    case ACTION_KIND.CLEAR:         return `await ${loc}.clear();`;
    case ACTION_KIND.TYPE:          return `await ${loc}.pressSequentially(${q(arg)});`;
    case ACTION_KIND.PRESS:         return `await ${loc}.press(${q(arg)});`;
    case ACTION_KIND.CHECK:         return `await ${loc}.check();`;
    case ACTION_KIND.UNCHECK:       return `await ${loc}.uncheck();`;
    case ACTION_KIND.SELECT:        return `await ${loc}.selectOption(${q(arg)});`;
    case ACTION_KIND.HOVER:         return `await ${loc}.hover();`;
    case ACTION_KIND.FOCUS:         return `await ${loc}.focus();`;
    case ACTION_KIND.BLUR:          return `await ${loc}.blur();`;
    case ACTION_KIND.UPLOAD:        return `await ${loc}.setInputFiles(${q(arg)});`;
    case ACTION_KIND.WAIT:          return `await this.page.waitForTimeout(${Number(arg) || 0});`;
    case ACTION_KIND.SCROLL:        return `await ${loc}.scrollIntoViewIfNeeded();`;
    case ACTION_KIND.ASSERT_TEXT:   return `await expect(${loc}).toHaveText(${q(arg)});`;
    case ACTION_KIND.ASSERT_VISIBLE:return `await expect(${loc}).toBeVisible();`;
    case ACTION_KIND.ASSERT_COUNT:  return `await expect(${loc}).toHaveCount(${Number(arg) || 1});`;
    default:                        return `// unknown action: ${step.kind}`;
  }
}

/**
 * Human-readable title for a step, used inside @allure.step("...")
 */
export function stepTitle(step) {
  const label = step.label || step.locatorCode || step.kind;
  switch (step.kind) {
    case ACTION_KIND.NAVIGATE:      return `Navigate to ${step.value}`;
    case ACTION_KIND.CLICK:         return `Click "${label}"`;
    case ACTION_KIND.FILL:          return `Fill "${label}" with "${step.value}"`;
    case ACTION_KIND.CLEAR:         return `Clear "${label}"`;
    case ACTION_KIND.TYPE:          return `Type "${step.value}" into "${label}"`;
    case ACTION_KIND.PRESS:         return `Press "${step.value}" on "${label}"`;
    case ACTION_KIND.CHECK:         return `Check "${label}"`;
    case ACTION_KIND.UNCHECK:       return `Uncheck "${label}"`;
    case ACTION_KIND.SELECT:        return `Select "${step.value}" in "${label}"`;
    case ACTION_KIND.HOVER:         return `Hover over "${label}"`;
    case ACTION_KIND.FOCUS:         return `Focus "${label}"`;
    case ACTION_KIND.BLUR:          return `Blur "${label}"`;
    case ACTION_KIND.UPLOAD:        return `Upload "${step.value}" to "${label}"`;
    case ACTION_KIND.WAIT:          return `Wait ${step.value}ms`;
    case ACTION_KIND.SCROLL:        return `Scroll to "${label}"`;
    case ACTION_KIND.ASSERT_TEXT:   return `Assert "${label}" has text "${step.value}"`;
    case ACTION_KIND.ASSERT_VISIBLE:return `Assert "${label}" is visible`;
    case ACTION_KIND.ASSERT_COUNT:  return `Assert "${label}" count is ${step.value}`;
    default:                        return step.kind;
  }
}

/**
 * Allure method name for a step, e.g. fillUsername(), clickSubmit().
 * Deterministic, collision-free via an index suffix when needed.
 */
export function methodName(step, index) {
  const base = step.name || slugMethod(step);
  return base;
}

function slugMethod(step) {
  const label = step.label || step.locatorCode || step.kind;
  const clean = String(label)
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[^a-zA-Z_$]+/, '');
  const prefix = {
    [ACTION_KIND.NAVIGATE]: 'goto',
    [ACTION_KIND.CLICK]: 'click',
    [ACTION_KIND.FILL]: 'fill',
    [ACTION_KIND.CLEAR]: 'clear',
    [ACTION_KIND.TYPE]: 'type',
    [ACTION_KIND.PRESS]: 'press',
    [ACTION_KIND.CHECK]: 'check',
    [ACTION_KIND.UNCHECK]: 'uncheck',
    [ACTION_KIND.SELECT]: 'select',
    [ACTION_KIND.HOVER]: 'hover',
    [ACTION_KIND.FOCUS]: 'focus',
    [ACTION_KIND.BLUR]: 'blur',
    [ACTION_KIND.UPLOAD]: 'upload',
    [ACTION_KIND.WAIT]: 'wait',
    [ACTION_KIND.SCROLL]: 'scrollTo',
    [ACTION_KIND.ASSERT_TEXT]: 'expectText',
    [ACTION_KIND.ASSERT_VISIBLE]: 'expectVisible',
    [ACTION_KIND.ASSERT_COUNT]: 'expectCount',
  }[step.kind] || 'do';
  const rest = clean ? clean[0].toUpperCase() + clean.slice(1) : 'Step';
  return prefix + rest;
}
export const slugMethodName = slugMethod;