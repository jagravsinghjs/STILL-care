import { expect, test, type Page } from '@playwright/test';

// Test HTTP fixtures only; production has no demonstration/session fallback data.
const account = { id: 'test-account', email: 'patient@example.test', role: 'patient' };
const session = { id: 'saved-session', started_at: '2026-11-22T10:00:00Z', ended_at: '2026-11-22T10:15:00Z', turn_count: 1, mean_score: 70 };
const detail = { ...session, messages: [{ id: 'turn', role: 'patient', text: 'My actual saved words', timestamp: '2026-11-22T10:01:00Z' }, { id: 'reply', role: 'assistant', text: 'My saved reply', timestamp: null }], conversation_complete: true, graph_available: false, report: { summary: 'The persisted summary', message: 'The persisted closing message', timeline: [{ seconds: 5, score: 4 }, { seconds: 20, score: 7 }] } };
async function history(page: Page, sessions: unknown[] = []) {
  await page.route('**/api/intelligence/patient/sessions', (route) => route.fulfill({ json: { sessions } }));
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { user: account, csrfToken: 'test-only-token' } }));
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('new user has genuinely empty history and login never creates a session', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', (request) => { if (request.method() !== 'GET') mutations.push(request.url()); });
  await history(page);
  await page.goto('/login');
  await expect(page).toHaveURL(/\/patient$/);
  await expect(page.getByText('No sessions yet.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your journey starts here.' })).toBeVisible();
  await expect(page.locator('.session-entry')).toHaveCount(0);
  await expect(page.locator('.distress-dot')).toHaveCount(0);
  await expect(page.locator('time')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'New Session', exact: true })).toBeVisible();
  expect(mutations).toEqual([]);
});

test('persisted sessions have model bands and remain unselected until clicked', async ({ page }) => {
  await history(page, [session, { ...session, id: 'moderate', mean_score: 50 }, { ...session, id: 'low', mean_score: 20 }, { ...session, id: 'unknown', mean_score: null }, { ...session, id: 'invalid', mean_score: 130 }]);
  let details = 0;
  await page.route('**/api/intelligence/patient/sessions/saved-session', (route) => { details++; return route.fulfill({ json: detail }); });
  await page.goto('/patient');
  await expect(page.locator('.session-entry')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Select a session' })).toBeVisible();
  expect(details).toBe(0);
  await expect(page.getByText('Not assessed', { exact: true })).toHaveCount(2);
  await expect(page.getByText('High distress', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Low distress', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Moderate distress', { exact: true })).toHaveCount(1);
  await page.locator('.session-entry').first().click();
  await expect(page.locator('.session-entry').first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('My actual saved words')).toBeVisible();
  await expect(page.getByText('My saved reply')).toBeVisible();
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await expect(page.getByText('The persisted summary')).toBeVisible();
  await expect(page.getByText('Average monitoring score: 70.0 / 100.')).toBeVisible();
  await expect(page.getByRole('img', { name: /Distress over time/ })).toBeVisible();
});

test('history failure is retryable and never presented as no sessions', async ({ page }) => {
  await page.route('**/api/intelligence/patient/sessions', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/patient');
  await expect(page.getByRole('alert')).toContainText('couldn’t load');
  await expect(page.getByText('No sessions yet.', { exact: true })).toHaveCount(0);
  await expect(page.locator('.session-entry')).toHaveCount(0);
  await history(page);
  await page.getByRole('button', { name: 'Try Again' }).click();
  await expect(page.getByText('No sessions yet.', { exact: true })).toBeVisible();
});

test('loading is distinct from empty; missing reports and replies are explicit', async ({ page }) => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/intelligence/patient/sessions', async (route) => { await wait; await route.fulfill({ json: { sessions: [session] } }); });
  await page.route('**/api/intelligence/patient/sessions/saved-session', (route) => route.fulfill({ json: { ...detail, messages: [detail.messages[0]], conversation_complete: false, report: null } }));
  await page.goto('/patient');
  await expect(page.getByText('Loading your sessions…')).toBeVisible();
  await expect(page.getByText('No sessions yet.', { exact: true })).toHaveCount(0);
  release();
  await page.locator('.session-entry').click();
  await expect(page.getByText('Some assistant replies are unavailable.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await expect(page.getByText('A written report is not available for this session yet.')).toBeVisible();
});

test('refresh retrieves newly persisted records exactly once', async ({ page }) => {
  await history(page);
  await page.goto('/patient');
  await expect(page.getByText('No sessions yet.', { exact: true })).toBeVisible();
  await history(page, [session]);
  await page.getByRole('button', { name: 'Refresh history' }).click();
  await expect(page.locator('.session-entry')).toHaveCount(1);
  await page.getByRole('button', { name: 'Refresh history' }).click();
  await expect(page.locator('.session-entry')).toHaveCount(1);
});

test('new session and consultant controls do not fabricate unavailable services', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', (request) => { if (request.method() !== 'GET') mutations.push(request.url()); });
  await history(page);
  await page.goto('/patient');
  await page.getByRole('link', { name: 'New Session', exact: true }).click();
  await expect(page).toHaveURL(/\/patient\/session\/new$/);
  await expect(page.getByText('No session has been started.', { exact: false })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Talk to Consultant' }).click();
  await expect(page.getByText('No message has been sent.', { exact: false })).toBeVisible();
  expect(mutations).toEqual([]);
});

test('profile shows only authenticated account info; successful logout clears access', async ({ page }) => {
  await page.route('**/profiles/patient', r => r.fulfill({json:{name:'',text:'',photo_available:false,supervisor:null,assignment_status:'none'}}));
  await history(page);
  await page.route('**/api/auth/logout', (route) => route.fulfill({ json: { status: 'signed_out' } }));
  await page.goto('/patient');
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByText(account.email)).toBeVisible();
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?role=patient$/);
  expect(await page.evaluate(() => ({ ...localStorage, ...sessionStorage }))).toEqual({});
});

test('expired API session redirects to login, no retained patient content', async ({ page }) => {
  await page.route('**/api/intelligence/patient/sessions', (route) => route.fulfill({ status: 401, json: {} }));
  await page.goto('/patient');
  await expect(page).toHaveURL(/\/login\?role=patient$/);
  await expect(page.locator('.patient-shell')).toHaveCount(0);
});

test('failed detail can be retried and never invents report content', async ({ page }) => {
  await history(page, [session]);
  await page.route('**/api/intelligence/patient/sessions/saved-session', (route) => route.fulfill({ status: 404, json: {} }));
  await page.goto('/patient');
  await page.locator('.session-entry').click();
  await expect(page.getByRole('alert')).toContainText('not available');
  await page.route('**/api/intelligence/patient/sessions/saved-session', (route) => route.fulfill({ json: detail }));
  await page.getByRole('button', { name: 'Try Again' }).click();
  await expect(page.getByText('My actual saved words')).toBeVisible();
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 844, height: 390 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`dashboard remains usable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await history(page, [session]);
    await page.goto('/patient');
    await expect(page.locator('.session-entry')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New Session', exact: true })).toBeVisible();
    const left = await page.locator('.history-panel').boundingBox();
    const right = await page.locator('.session-viewer').boundingBox();
    if (viewport.width >= 844) expect(right!.x).toBeGreaterThan(left!.x + left!.width);
    else expect(right!.y).toBeGreaterThan(left!.y);
  });
}
