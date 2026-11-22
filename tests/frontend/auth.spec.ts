import { expect, test, type Page } from '@playwright/test';

// HTTP fixtures exercise the proposed contract, not a real authentication backend.
const patient = { id: 'test-patient', email: 'member@example.test', role: 'patient' };
const supervisor = { id: 'test-consultant', email: 'consultant@example.test', role: 'supervisor' };
const csrfToken = 'test-only-csrf';
const password = 'test-only-password';

async function guest(page: Page) {
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { user: null, csrfToken } }));
}
async function fillLogin(page: Page) {
  await page.getByLabel('Email address').fill(patient.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
}

test.beforeEach(async ({ page }) => { await guest(page); });

test('starts at login, switches role with keyboard, and does not duplicate existing-entry login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('radio', { name: 'User', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'User', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Consultant', exact: true })).toBeChecked();
  await expect(page).toHaveURL(/role=supervisor/);
  await expect(page.getByText('Continue with Existing Entry')).toHaveCount(0);
});

test('login/register/back navigation and consultant explanation work', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Register as New User' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('Consultant ID', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'About Consultant ID' }).click();
  await expect(page.getByText('Use the ID your consultant gave you.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'About Consultant ID' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'Continue with Existing Entry' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/register');
  await page.getByRole('link', { name: 'Back to login' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('invalid forms focus the first error and do not send credentials', async ({ page }) => {
  let requests = 0;
  page.on('request', (request) => { if (request.method() === 'POST') requests++; });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page.getByLabel('Email address')).toBeFocused();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await expect(page.getByText('Enter your password.')).toBeVisible();
  await page.goto('/register');
  await page.getByLabel('Email address').fill('invalid');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText('Use at least 8 characters for your password.')).toBeVisible();
  await expect(page.getByText('Enter the ID provided by your consultant.')).toBeVisible();
  expect(requests).toBe(0);
});

test('password toggle preserves content and supports keyboard', async ({ page }) => {
  await page.goto('/login');
  const input = page.getByLabel('Password', { exact: true });
  await input.fill(password);
  await expect(input).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).focus();
  await page.keyboard.press('Enter');
  await expect(input).toHaveAttribute('type', 'text');
  await expect(input).toHaveValue(password);
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(input).toHaveAttribute('type', 'password');
});

test('unconfigured services never fake login, registration, or password recovery', async ({ page }) => {
  await page.goto('http://127.0.0.1:3101/login');
  await fillLogin(page);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Account services are not connected yet');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Register as New User' }).click();
  await fillLogin(page);
  await page.getByLabel('Consultant ID', { exact: true }).fill('test-consultant');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not connected');
  await page.goto('http://127.0.0.1:3101/forgot-password');
  await page.getByLabel('Email address').fill(patient.email);
  await page.getByRole('button', { name: 'Send Reset Link' }).click();
  await expect(page.getByRole('alert')).toContainText('not connected');
});

test('login sends selected role and CSRF, disables duplicate submission, and signs out', async ({ page }) => {
  let count = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/auth/login', async (route) => {
    count++;
    expect(route.request().postDataJSON()).toEqual({ email: patient.email, password, role: 'supervisor' });
    expect(route.request().headers()['x-csrf-token']).toBe(csrfToken);
    await waiting;
    await route.fulfill({ json: { user: supervisor } });
  });
  await page.route('**/api/auth/logout', (route) => route.fulfill({ json: { status: 'signed_out' } }));
  await page.goto('/login?role=supervisor');
  await fillLogin(page);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Logging in…' })).toBeDisabled();
  await expect(page.getByLabel('Email address')).toBeDisabled();
  release();
  await expect(page).toHaveURL(/\/supervisor$/);
  await expect(page.getByRole('heading', { name: /My Patients/ })).toBeVisible();
  expect(count).toBe(1);
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page).toHaveURL(/\/login\?role=supervisor$/);
  expect(await page.evaluate(() => ({ ...localStorage, ...sessionStorage }))).toEqual({});
});

test('server role overrides the selected role; protected routes cannot elevate access', async ({ page }) => {
  await page.route('**/api/auth/login', (route) => route.fulfill({ json: { user: patient } }));
  await page.goto('/login?role=supervisor');
  await fillLogin(page);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page).toHaveURL(/\/patient$/);
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { user: patient, csrfToken } }));
  await page.goto('/supervisor/alerts');
  await expect(page).toHaveURL(/\/patient$/);
  await expect(page.getByRole('heading', { name: 'Your History' })).toBeVisible();
});

test('anonymous protected route redirects to login', async ({ page }) => {
  await page.goto('/supervisor/alerts');
  await expect(page).toHaveURL(/\/login\?role=supervisor$/);
  await expect(page.getByRole('radio', { name: 'Consultant', exact: true })).toBeChecked();
});

test('registration posts a consultant ID without a client privilege claim, then returns to login', async ({ page }) => {
  await page.route('**/api/auth/register', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email: patient.email, password, consultantId: 'test-consultant' });
    await route.fulfill({ status: 201, json: { status: 'created' } });
  });
  await page.goto('/register');
  await fillLogin(page);
  await page.getByLabel('Consultant ID', { exact: true }).fill(' test-consultant ');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status')).toContainText('Your account has been created');
});

test('invalid consultant record keeps registration open', async ({ page }) => {
  await page.route('**/api/auth/register', (route) => route.fulfill({ status: 422, json: {} }));
  await page.goto('/register');
  await fillLogin(page);
  await page.getByLabel('Consultant ID', { exact: true }).fill('unknown');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Consultant ID');
  await expect(page).toHaveURL(/\/register$/);
});

for (const scenario of ['unauthorized', 'network failure', 'malformed response'] as const) {
  test(`login handles ${scenario} without admitting a user`, async ({ page }) => {
    await page.route('**/api/auth/login', (route) => {
      if (scenario === 'network failure') return route.abort();
      if (scenario === 'unauthorized') return route.fulfill({ status: 401, json: {} });
      return route.fulfill({ json: { user: { ...patient, role: 'admin' } } });
    });
    await page.goto('/login');
    await fillLogin(page);
    await page.getByRole('button', { name: 'Log In', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Log In', exact: true })).toBeEnabled();
  });
}

test('recovery retains role and shows a non-enumerating message only after acceptance', async ({ page }) => {
  await page.route('**/api/auth/forgot-password', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email: supervisor.email, role: 'supervisor' });
    await route.fulfill({ status: 202, json: { status: 'accepted' } });
  });
  await page.goto('/login?role=supervisor');
  await page.getByRole('link', { name: 'Forgot Password?' }).click();
  await page.getByLabel('Email address').fill(supervisor.email);
  await page.getByRole('button', { name: 'Send Reset Link' }).click();
  await expect(page.getByRole('status')).toContainText('If an account matches');
  await page.getByRole('link', { name: 'Back to Log In' }).click();
  await expect(page.getByRole('radio', { name: 'Consultant', exact: true })).toBeChecked();
});

for (const size of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 390, height: 420 }, { width: 1440, height: 900 }]) {
  test(`forms fit and remain usable at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    for (const path of ['/login', '/register']) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      for (const field of await page.locator('.field').all()) {
        const box = await field.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      const button = page.getByRole('button', { name: path === '/login' ? 'Log In' : 'Register', exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
      await button.click();
      await expect(page.getByLabel('Email address')).toBeFocused();
    }
  });
}
