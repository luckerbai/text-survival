import { expect, test } from '@playwright/test'
import { gotoGame, matCount, resetSave, safeClick } from './helpers'

/**
 * 核心路径 4：时间自动流逝（小黑屋式）
 * 关键断言：玩家不点击任何按钮，世界也在自己走——
 * 饥饿随时间下降、昼夜自动轮转。使用 ?tick=fast（每帧 1 回合）。
 */
test.describe('时间自动流逝', () => {
  test('不操作时饥饿下降、昼夜自动轮转', async ({ page }) => {
    await gotoGame(page, 'fast')
    await resetSave(page)

    const readHunger = async (): Promise<number | null> => {
      const text = await page.locator('aside').textContent().catch(() => null)
      const m = text?.match(/饥饿[：:\s]*(\d+)/)
      return m ? Number(m[1]) : null
    }

    const h0 = await readHunger()
    expect(h0, '应读到初始饥饿').not.toBeNull()

    // 不做任何操作，让世界自己走 5 秒（fast 下 ≈ 10 回合 → 超过一昼夜）
    await page.waitForTimeout(5000)

    const h1 = await readHunger()
    expect(h1, '饥饿应随时间下降').toBeLessThan(h0 as number)

    const header = (await page.locator('header').textContent()) ?? ''
    const log = (await page.locator('[data-log]').textContent()) ?? ''
    const advanced = header.includes('第 2 天') || log.includes('夜幕降临') || log.includes('太阳西沉') || log.includes('第 2 天')
    expect(advanced, '昼夜应自动轮转（出现阶段切换或新的一天）').toBe(true)
  })

  test('开启自动采集后挂机产出资源（背包数字自己涨）', async ({ page }) => {
    await gotoGame(page, 'fast')
    await resetSave(page)

    // 开启自动采集
    const toggle = page.locator('[data-auto-gather]').first()
    await toggle.waitFor({ state: 'visible', timeout: 5000 })
    await safeClick(page, toggle)

    const grass0 = await matCount(page, 'grass')
    // 挂机 4 秒（fast ≈ 8 回合）：自动采集每回合产出，草必然增长
    await page.waitForTimeout(4000)
    const grass1 = await matCount(page, 'grass')

    expect(grass1, '挂机后草应增长').toBeGreaterThan(grass0)
  })
})
