import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { handleBattle, resetSave, safeClick } from './helpers'

/** 核心路径 2：死亡 → 重开 → 存档导出/导入 → 刷新恢复 */
test.describe('核心路径 2：完整游戏循环', () => {
  test('饥饿致死、死亡结算、重开、导出导入存档、刷新恢复', async ({ page }) => {
    await page.goto('/')
    await resetSave(page)

    // 1) 反复行动直到死亡（饥饿耗尽扣血 / 战斗）
    let died = false
    for (let i = 0; i < 80; i++) {
      const deathVisible = await page
        .locator('[aria-label="死亡结算"]')
        .isVisible({ timeout: 500 })
        .catch(() => false)
      if (deathVisible) {
        died = true
        break
      }
      if (await handleBattle(page)) {
        await page.waitForTimeout(80)
        continue
      }
      await safeClick(page, page.locator('[data-action="gather"]'))
      await page.waitForTimeout(80)
    }
    expect(died, '应出现死亡结算').toBe(true)

    // 2) 死亡统计可见
    const daysText = (await page.locator('[aria-label="死亡结算"]').textContent()) ?? ''
    expect(daysText).toContain('存活天数')

    // 3) 导出死亡存档（死亡结算弹层内按钮）
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      safeClick(page, page.locator('[data-death-export]')),
    ])
    await page.waitForTimeout(400)
    const path = download ? await download.path() : null
    const json = path ? readFileSync(path, 'utf-8') : ''
    expect(path, '应触发下载').not.toBeNull()
    expect(json).toContain('"version":1')
    expect(json).toContain('"dead":true')

    // 4) 重新开始 → 状态重置
    await safeClick(page, page.locator('[data-restart]'))
    await page.waitForTimeout(300)
    await expect(page.locator('header')).toContainText('第 1 天')
    await expect(page.locator('aside')).toContainText('100')

    // 5) 导入刚才的死亡存档 → 死亡弹层重现
    if (path) {
      await page.setInputFiles('input[type="file"]', path)
      await page.waitForTimeout(400)
    }
    await expect(page.locator('[aria-label="死亡结算"]')).toBeVisible()

    // 6) 刷新页面 → 自动恢复存档（仍是死亡状态）
    await page.reload({ waitUntil: 'load' })
    await page.locator('body').waitFor({ state: 'visible', timeout: 30_000 })
    await expect(page.locator('[aria-label="死亡结算"]')).toBeVisible()
  })
})
