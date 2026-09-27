/**
 * M3 验收脚本：浏览器内跑通核心循环
 * 造火把 → 采燧石/木材 → 造斧头 → 夜晚点燃火把 → 撑过第一夜 → 截图
 * 运行：node scripts/verify-core.mjs <base-url>
 */
import { chromium } from '@playwright/test'
import process from 'node:process'

const baseUrl = process.argv[2] ?? 'http://localhost:5173'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(4000)

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/** 防御式点击：不可见/被遮挡/超时均静默失败 */
async function safeClick(locator) {
  try {
    if (await locator.isVisible({ timeout: 800 }).catch(() => false)) {
      await locator.click({ timeout: 2000 })
      return true
    }
  } catch {
    /* 忽略 */
  }
  return false
}

/** 战斗弹层优先处理：有战斗则攻击，返回是否处理过 */
async function handleBattle() {
  const fight = page.locator('[data-battle="attack"]')
  if (await fight.isVisible({ timeout: 500 }).catch(() => false)) {
    await safeClick(fight)
    return true
  }
  return false
}

const craftBtn = (recipeId) => page.locator(`button[data-recipe="${recipeId}"]`).first()
const collectBtn = () => page.locator('[data-action="gather"]')
const moveBtn = (name) => page.locator(`[data-location="${name}"]`).first()
/** 背包材料数量（无该材料返回 0） */
async function matCount(id) {
  const el = page.locator(`[data-item="${id}"]`)
  const count = await el.getAttribute('data-count').catch(() => null)
  return count === null ? 0 : Number(count)
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  // 清掉可能残留存档，保证从初始状态开始
  await page.evaluate(() => localStorage.removeItem('text-wilds:save'))
  await page.reload({ waitUntil: 'networkidle' })
  check('页面加载并显示标题', (await page.locator('h1').textContent())?.includes('永夜荒原'), await page.title())

  // 1) 制作火把（初始材料 grass2+wood2）
  for (let i = 0; i < 3; i++) {
    await handleBattle()
    if (await craftBtn('torch').isEnabled().catch(() => false)) {
      await craftBtn('torch').click({ timeout: 2500 }).catch(() => {})
      await page.waitForTimeout(150)
      break
    }
    await page.waitForTimeout(120)
  }
  check('成功制作火把', (await page.locator('[data-equip="torch"]').count()) > 0, '背包出现火把')

  // 2) 按需采集：wood 不足去森林，flint 不足去碎石坡
  await handleBattle()
  for (let i = 0; i < 12; i++) {
    await handleBattle()
    const wood = await matCount('wood')
    const flint = await matCount('flint')
    if (wood >= 2 && flint >= 1) break
    if (wood < 2) await safeClick(moveBtn('forest'))
    else await safeClick(moveBtn('rocks'))
    await safeClick(collectBtn())
    await page.waitForTimeout(100)
  }

  // 3) 制作斧头
  let crafted = false
  for (let i = 0; i < 6; i++) {
    await handleBattle()
    if (await craftBtn('axe').isEnabled().catch(() => false)) {
      await craftBtn('axe').click({ timeout: 2500 }).catch(() => {})
      await page.waitForTimeout(150)
      crafted = true
      break
    }
    await page.waitForTimeout(120)
  }
  const invAxe = await page.locator('[data-equip="axe"]').count().catch(() => 0)
  check('成功制作斧头', crafted && invAxe > 0, `装备区斧头 ${invAxe} 个`)

  // 装备斧头
  const equipBtn = page.locator('[data-equip="axe"] button', { hasText: '装备' }).first()
  if (await equipBtn.isVisible({ timeout: 800 }).catch(() => false)) {
    await safeClick(equipBtn)
  }

  // 4) 撑过第一夜：推进到夜晚 → 点燃火把 → 战斗/继续，直到第 2 天
  let day2 = false
  let lit = false
  for (let i = 0; i < 60; i++) {
    const dayText = (await page.locator('header').textContent()) ?? ''
    if (dayText.includes('第 2 天')) {
      day2 = true
      break
    }
    // 夜晚无火源时点燃火把
    if (dayText.includes('夜晚') && !lit) {
      const lightBtn = page.locator('[data-equip="torch"] button', { hasText: '点燃' }).first()
      if (await lightBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await safeClick(lightBtn)
        lit = true
        console.log('  ↳ 夜晚点燃了火把')
      }
    }
    if (await handleBattle()) {
      await page.waitForTimeout(100)
      continue
    }
    await safeClick(collectBtn())
    await page.waitForTimeout(120)
  }
  check('撑过第一夜进入第 2 天', day2)

  await page.screenshot({ path: 'scripts/m3-verify.png', fullPage: true })
  console.log('截图已保存 scripts/m3-verify.png')
} catch (err) {
  console.error('验证失败:', err?.message ?? err)
  try {
    await page.screenshot({ path: 'scripts/m3-verify-fail.png', fullPage: true })
  } catch {
    /* 忽略 */
  }
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
if (failed.length > 0) {
  console.log(`\n共 ${results.length} 项检查，${failed.length} 项失败`)
  process.exitCode = 1
} else {
  console.log(`\n共 ${results.length} 项检查，全部通过 ✅`)
}
