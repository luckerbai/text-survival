-- ============================================
-- Insert: 永夜荒原 Text Wilds（第 3 条真实项目）
-- 用途：在 Supabase SQL Editor 执行，为 projects 表填充新项目
-- ============================================

INSERT INTO projects (
  slug, title, summary, description, cover_url, role, duration,
  tech_stack, problem, solution, architecture, technical_decisions,
  engineering_checklist, performance_metrics, demo_url, github_url,
  status, featured, order_index
) VALUES (
  'text-survival',
  '永夜荒原 Text Wilds',
  '文字版饥荒生存游戏（Don''t Starve 风格，Web 交互版）——采集、制作、点燃火把、与猎犬搏斗，在理智与饥饿的夹缝中活过每一夜。',
  '一座永夜荒原上，你从篝火余烬旁醒来。白天前往森林/碎石坡/草甸/池塘采集资源或探索事件，黄昏决定去向，夜晚无火源时猎犬来袭——点火把或战斗求生。管理生命/饥饿/理智三维状态，制作斧头/火把/营火等 11 种配方，死亡结算后可重开或导出存档 JSON 备份，自动存档于浏览器 localStorage 支持导入恢复。引擎与 UI 严格分离，纯 TypeScript 游戏引擎 85 个单元测试全绿，Playwright 3 条 E2E 验证完整循环。',
  NULL,
  '独立开发者',
  '2026 Q3 — 2 周交付',
  ARRAY['Vue 3', 'TypeScript', 'Vite', 'Tailwind CSS', 'Vitest', 'Playwright'],
  '作品集需要一个能体现完整游戏引擎工程能力的真实项目：纯逻辑状态机、存档系统、战斗/AI/事件系统，且必须是可玩的产品而非 demo。',
  '引擎与 UI 分离：src/game 为纯 TypeScript 引擎（状态机/存档/战斗/AI/事件/行动，零框架依赖），src/ui 为 Vue 3 展示层；数值全部集中 constants.ts 单文件便于平衡调优；开局初始补给（草2/木2/燧石1）作为饥荒式新手保护；自动存档 + 导出/导入 JSON。',
  'UI 通过 dispatch(action) 单向驱动引擎：ActionPanel/BattlePanel/CraftPanel 等 8 个组件只发指令，useGame 组合式函数执行 doAction 并自动持久化，引擎纯函数可独立单测。',
  '[
    {"decision": "引擎与 UI 严格分离", "reason": "src/game 零框架依赖可移植可单测，UI 只做展示与指令分发"},
    {"decision": "数值集中 constants.ts", "reason": "昼夜节奏/敌人属性/配方/初始补给单文件管理，平衡调优只改一处"},
    {"decision": "行动统一 doAction 入口", "reason": "move/gather/craft/eat/rest/light/fight/flee 共用时间消耗与回合结算链，高内聚低耦合"},
    {"decision": "localStorage 自动存档 + JSON 导出/导入", "reason": "无后端零成本持久化，死亡结算可导出备份跨设备迁移"},
    {"decision": "data-* 钩子驱动 E2E", "reason": "Playwright 选择器与 UI 解耦，避免文案变更破坏测试"}
  ]',
  '[
    {"item": "85 个单元测试（Vitest），覆盖状态机/存档/战斗/AI/事件/行动"},
    {"item": "vue-tsc 严格类型检查 0 错误"},
    {"item": "Playwright E2E 3 条：首夜生存制作 / 完整游戏循环 / 最小诊断"},
    {"item": "GitHub Actions CI：type-check + test + build + e2e"}
  ]',
  '[
    {"metric": "bundle", "value": "96KB（gzip 36KB）", "note": "单页面无路由分割需求"},
    {"metric": "测试", "value": "85 tests / 6 files", "note": "引擎全绿"},
    {"metric": "E2E", "value": "3 specs 全过", "note": "完整游戏循环含死亡重开/存档迁移"}
  ]',
  'https://text-survival-pi.vercel.app',
  NULL,
  'published',
  true,
  2
);
