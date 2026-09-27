/**
 * 最小调试：e2e 中 safeClick 为何全部失败
 */
import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(8000)

await page.goto('http://127.0.0.1:4180', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.removeItem('text-wilds:save'))
await page.reload({ waitUntil: 'networkidle' })

const collect = page.getByRole('button', { name: '采集' })
console.log('collect count =', await collect.count())
console.log('collect visible =', await collect.isVisible().catch((e) => `ERR: ${e.message.split('\n')[0]}`))
console.log('collect text =', await collect.textContent().catch((e) => `ERR: ${e.message.split('\n')[0]}`))

const move = page.getByRole('button', { name: '幽暗森林' })
console.log('move count =', await move.count())
console.log('move visible =', await move.isVisible().catch((e) => `ERR: ${e.message.split('\n')[0]}`))

await collect.click({ timeout: 3000 })
await page.waitForTimeout(300)
const log = (await page.locator('main').textContent()) ?? ''
console.log('采集后日志:', log.replace(/\s+/g, ' ').slice(0, 120))

console.log('data-item 元素:', await page.locator('[data-item]').count())
const flint = page.locator('[data-item="flint"]')
console.log('flint 存在:', await flint.count(), 'count attr:', await flint.getAttribute('data-count').catch((e) => `ERR ${e.message.split('\n')[0]}`))
console.log('data-equip 元素:', await page.locator('[data-equip]').count())

await browser.close()
