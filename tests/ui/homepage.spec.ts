import { test, expect } from '@playwright/test';

test('Sawaka homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/localhost:3000/);
});
