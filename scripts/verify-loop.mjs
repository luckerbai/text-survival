/**
 * M4 验收脚本：完整游戏循环
 * 饥饿致死 → 死亡结算 → 重新开始 → 导出存档 → 导入存档 → 刷新恢复
 * 运行：node scripts/verify-loop.mjs <base-url>
 */
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import process from 'node:process'

const baseUrl = process.argv[2] ?? 'http://localhost:5173'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(5000)

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function safeClick(locator) {
  try {
    if (await locator.isVisible({ timeout: 800 }).catch(() => false)) {
      await locator.click({ timeout: 2500 })
      return true
    }
  } catch {
    /* 忽略 */
  }
  return false
}

async function handleBattle() {
  const fight = page.locator('[data-battle="attack"]')
  if (await fight.isVisible({ timeout: 500 }).catch(() => false)) {
    await safeClick(fight)
    return true
  }
  return false
}

let downloadedPath = null
page.on('download', (download) => {
  downloadedPath = download.path()
})

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  // 清掉可能残留存档，保证从初始状态开始
  await page.evaluate(() => localStorage.removeItem('text-wilds:save'))
  await page.reload({ waitUntil: 'networkidle' })
  console.log('· 已清存档并加载初始状态')

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
    if (await handleBattle()) {
      await page.waitForTimeout(80)
      continue
    }
    const clicked = await safeClick(page.locator('[data-action="gather"]'))
    await page.waitForTimeout(80)
    if (i % 10 === 0) {
      const aside = (await page.locator('aside').textContent()) ?? ''
      const header = (await page.locator('header').textContent()) ?? ''
      console.log(`  ↳ 回合#${i} clicked=${clicked} header=${header.replace(/\s+/g, ' ').slice(0, 26)} hp=${(aside.match(/生命(\d+)/) ?? [])[1]}`)
    }
    if (i === 1 || i === 5) {
      await page.screenshot({ path: `scripts/m4-debug-${i}.png` })
      console.log(`  ↳ 调试截图 m4-debug-${i}.png`)
    }
  }
  console.log(`· 死亡循环结束 died=${died}`)
  check('饥饿/战斗致死出现死亡结算', died)

  // 2) 死亡统计可见
  const daysText = (await page.locator('[aria-label="死亡结算"]').textContent()) ?? ''
  check('死亡结算展示存活天数', /存活天数/.test(daysText), daysText.replace(/\s+/g, ' ').slice(0, 40))

  // 3) 导出死亡存档（死亡结算弹层内按钮）
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => [null]),
    safeClick(page.locator('[data-death-export]')),
  ])
  await page.waitForTimeout(400)
  downloadedPath = download && download.path ? await download.path() : null
  console.log(`· download.path = ${downloadedPath}`)
  let json = ''
  if (downloadedPath) {
    try {
      json = readFileSync(downloadedPath, 'utf-8')
    } catch (e) {
      console.log(`· 读取下载文件失败: ${e.message}`)
    }
  }
  check('导出死亡存档为有效 JSON', downloadedPath !== null && json.includes('"version":1') && json.includes('"dead":true'))

  // 4) 重新开始 → 状态重置
  await safeClick(page.locator('[data-restart]'))
  await page.waitForTimeout(300)
  const headerAfterRestart = (await page.locator('header').textContent()) ?? ''
  const hpAfterRestart = (await page.locator('aside').textContent()) ?? ''
  check(
    '重新开始后回到第 1 天且生命恢复',
    headerAfterRestart.includes('第 1 天') && hpAfterRestart.includes('100'),
    headerAfterRestart.replace(/\s+/g, ' ').slice(0, 30),
  )

  // 5) 导入刚才的死亡存档 → 死亡弹层重现
  if (downloadedPath) {
    await page.setInputFiles('input[type="file"]', downloadedPath)
    await page.waitForTimeout(400)
  }
  const deathAgain = await page.locator('[aria-label="死亡结算"]').isVisible().catch(() => false)
  check('导入死亡存档后死亡结算重现', deathAgain)

  // 6) 刷新页面 → 自动恢复存档（仍是死亡状态）
  await page.reload({ waitUntil: 'networkidle' })
  const deathAfterReload = await page.locator('[aria-label="死亡结算"]').isVisible().catch(() => false)
  check('刷新后从本地存档自动恢复', deathAfterReload)
} catch (err) {
  console.error('验证失败:', err?.message ?? err)
  try {
    await page.screenshot({ path: 'scripts/m4-verify-fail.png', fullPage: true })
  } catch {
    /* 忽略 */
  }
  process.exitCode = 1
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
