import type { Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'

/**
 * E2E 共享工具：防御式交互 + 确定性选择器
 * 沉淀自 scripts/verify-core.mjs / verify-loop.mjs 的验收策略
 */

/** 防御式点击：不可见/被遮挡/超时均静默失败，返回是否点击成功 */
export async function safeClick(page: Page, locator: ReturnType<Page['locator']>): Promise<boolean> {
  const sel = String(locator)
  const bodyNow = () => page.evaluate(() => (document.body ? document.body.innerText.slice(0, 12) : 'NOBODY')).catch(() => 'ERR')
  try {
    const before = await bodyNow()
    if (await locator.isVisible({ timeout: 800 }).catch(() => false)) {
      await locator.click({ timeout: 2500 })
      const after = await bodyNow()
      writeFileSync('test-results/click.log', `OK ${sel.slice(0, 60)} before=${before} after=${after}\n`, { flag: 'a' })
      return true
    }
    writeFileSync('test-results/click.log', `INV ${sel.slice(0, 60)} before=${before}\n`, { flag: 'a' })
  } catch (e) {
    writeFileSync('test-results/click.log', `ERR ${sel.slice(0, 60)} ${String(e).split('\n')[0].slice(0, 60)}\n`, { flag: 'a' })
  }
  return false
}

/** 战斗弹层优先处理：有战斗则攻击，返回是否处理过 */
export async function handleBattle(page: Page): Promise<boolean> {
  const fight = page.locator('[data-battle="attack"]')
  if (await fight.isVisible({ timeout: 500 }).catch(() => false)) {
    await safeClick(page, fight)
    return true
  }
  return false
}

/** 清掉本地存档，保证从初始状态开始（等待页面真正渲染完成） */
export async function resetSave(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.removeItem('text-wilds:save'))
  await page.reload({ waitUntil: 'load' })
  await page.locator('h1').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(300)
}

/** 背包材料数量（无该材料返回 0）——显式短超时，防止空元素无限等待（Playwright timeout:0 = 不超时） */
export async function matCount(page: Page, id: string): Promise<number> {
  const count = await page
    .locator(`[data-item="${id}"]`)
    .getAttribute('data-count', { timeout: 500 })
    .catch(() => null)
  return count === null ? 0 : Number(count)
}
