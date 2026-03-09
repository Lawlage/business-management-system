import { expect, test } from '@playwright/test'

test('dashboard renders default widgets', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Most Important Renewals')).toBeVisible()
  await expect(page.getByText('Low Stock Alerts')).toBeVisible()
})
