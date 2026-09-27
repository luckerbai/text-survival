import { test } from '@playwright/test'
import { gotoGame } from './helpers'

test('最小诊断：goto 后页面状态', async ({ page }) => {
  await gotoGame(page)
  await page.waitForTimeout(3000)
  console.log('[EARLY] body:', (await page.locator('body').innerText().catch((e) => `ERR:${e.message.split('\n')[0]}`)).replace(/\s+/g, ' ').slice(0, 100))
  console.log('[EARLY] h1 count:', await page.locator('h1').count())
  console.log('[EARLY] collect count:', await page.getByRole('button', { name: '采集' }).count())
  await page.waitForTimeout(2000)
  console.log('[EARLY2] body ok:', (await page.locator('body').isVisible().catch((e) => `ERR:${e.message.split('\n')[0]}`)))
})
