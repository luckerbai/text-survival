import { expect, test } from '@playwright/test'
import { handleBattle, matCount, resetSave, safeClick } from './helpers'

/**
 * 核心路径 1：首夜生存 + 制作流程（制作火把 → 采集 → 制作斧头 → 撑过第一夜）
 * 选择器策略与 scripts/verify-core.mjs 同源（data-* 钩子 + 防御式点击）
 */
test.describe('核心路径 1：首夜生存与制作', () => {
  test('制作火把、斧头并撑过第一夜', async ({ page }) => {
    await page.goto('/')
    await resetSave(page)

    // 1) 制作火把（初始材料 grass2+wood2）
    for (let i = 0; i < 3; i++) {
      await handleBattle(page)
      if (await page.locator('button[data-recipe="torch"]').isEnabled().catch(() => false)) {
        await page.locator('button[data-recipe="torch"]').click({ timeout: 2500 }).catch(() => {})
        await page.waitForTimeout(150)
        break
      }
      await page.waitForTimeout(120)
    }
    expect(await page.locator('[data-equip="torch"]').count(), '背包应出现火把').toBeGreaterThan(0)

    // 2) 按需采集：wood 不足去森林，flint 不足去碎石坡
    for (let i = 0; i < 12; i++) {
      await handleBattle(page)
      const wood = await matCount(page, 'wood')
      const flint = await matCount(page, 'flint')
      if (wood >= 2 && flint >= 1) break
      const moved = wood < 2
        ? await safeClick(page, page.locator('[data-location="forest"]').first())
        : await safeClick(page, page.locator('[data-location="rocks"]').first())
      const collected = await safeClick(page, page.locator('[data-action="gather"]').first())
      await page.waitForTimeout(100)
    }
    expect(await matCount(page, 'wood'), '应采到木材≥2').toBeGreaterThanOrEqual(2)
    expect(await matCount(page, 'flint'), '应采到燧石≥1').toBeGreaterThanOrEqual(1)

    // 3) 制作斧头
    let crafted = false
    for (let i = 0; i < 6; i++) {
      await handleBattle(page)
      if (await page.locator('button[data-recipe="axe"]').isEnabled().catch(() => false)) {
        await page.locator('button[data-recipe="axe"]').click({ timeout: 2500 }).catch(() => {})
        await page.waitForTimeout(150)
        crafted = true
        break
      }
      await page.waitForTimeout(120)
    }
    expect(crafted, '应成功制作斧头').toBe(true)
    expect(await page.locator('[data-equip="axe"]').count(), '装备区应有斧头').toBeGreaterThan(0)

    // 4) 撑过第一夜：推进到夜晚 → 点燃火把 → 战斗/继续，直到第 2 天
    let day2 = false
    let lit = false
    for (let i = 0; i < 60; i++) {
      const dayText = (await page.locator('header').textContent()) ?? ''
      if (dayText.includes('第 2 天')) {
        day2 = true
        break
      }
      if (dayText.includes('夜晚') && !lit) {
        const lightBtn = page.locator('button[data-equip="torch"] button', { hasText: '点燃' })
        if (await lightBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await safeClick(page, lightBtn)
          lit = true
        }
      }
      if (await handleBattle(page)) {
        await page.waitForTimeout(100)
        continue
      }
      await safeClick(page, page.locator('[data-action="gather"]').first())
      await page.waitForTimeout(120)
    }
    expect(day2, '应进入第 2 天').toBe(true)
  })
})
