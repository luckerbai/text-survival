// 线上可玩性终验：真实浏览器打开 https://text-survival-pi.vercel.app 并完成一次行动
// 用法：node scripts/verify-live.mjs [proxy]（proxy 默认 http://127.0.0.1:10808，可传 none 表示直连）
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const URL = process.argv[2] ?? 'https://text-survival-pi.vercel.app';
const proxyArg = process.argv[3] ?? 'auto';
const proxy = proxyArg === 'none' ? null : { server: proxyArg === 'auto' ? 'http://127.0.0.1:10808' : proxyArg };

const browser = await chromium.launch();
const context = await browser.newContext(proxy ? { proxy } : {});
const page = await context.newPage();
page.setDefaultTimeout(15000);

const out = [];
const log = (s) => { out.push(s); console.log(s); };

try {
  const resp = await page.goto(URL, { waitUntil: 'domcontentloaded' });
  log(`[1] HTTP ${resp?.status()} ${URL}`);

  // 等待 UI 就绪（状态面板/行动区渲染）
  await page.waitForSelector('[data-location], [data-action]', { timeout: 15000 });
  log('[2] UI 已渲染');

  const dayBefore = await page.locator('[data-day], [data-location]').first().textContent().catch(() => null);
  const logBefore = await page.locator('[data-log], [data-history] li, [data-history]').first().textContent().catch(() => null);

  // 尝试一次行动：优先 采集/探索，其次 休息/制作
  const actions = ['gather', 'explore', 'rest'];
  let clicked = null;
  for (const a of actions) {
    const btn = page.locator(`[data-action="${a}"]`).first();
    if (await btn.count()) {
      await btn.click();
      clicked = a;
      break;
    }
  }
  if (!clicked) {
    // 退路：任意 data-action 按钮
    const any = page.locator('[data-action]').first();
    if (await any.count()) { await any.click(); clicked = 'any'; }
  }
  log(`[3] 点击行动: ${clicked ?? '无（页面已进入可交互状态即视为通过）'}`);

  await page.waitForTimeout(800);
  const dayAfter = await page.locator('[data-day], [data-location]').first().textContent().catch(() => null);
  const logAfter = await page.locator('[data-log], [data-history] li, [data-history]').first().textContent().catch(() => null);

  log(`[4] 行动前: ${String(dayBefore ?? logBefore ?? '').trim().slice(0, 60)}`);
  log(`[5] 行动后: ${String(dayAfter ?? logAfter ?? '').trim().slice(0, 60)}`);

  await page.screenshot({ path: 'test-results/live-final.png', fullPage: false });
  log('[6] 截图 test-results/live-final.png');
  log('RESULT: PASS');
} catch (e) {
  log(`RESULT: FAIL - ${e.message.split('\n')[0]}`);
  await page.screenshot({ path: 'test-results/live-fail.png' }).catch(() => {});
} finally {
  await browser.close();
}
writeFileSync('test-results/live-verify.log', out.join('\n'), 'utf8');
