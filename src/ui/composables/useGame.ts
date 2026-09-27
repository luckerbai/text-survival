/**
 * 永夜荒原 — 游戏状态管理（UI 层唯一入口）
 * 引擎（game/）保持纯逻辑；此处负责响应式包装、行动派发与自动存档。
 */
import { ref } from 'vue'
import { doAction, equip as equipEngine } from '@/game/actions'
import { deserialize, loadFromStorage, saveToStorage, serialize } from '@/game/save'
import { createInitialState } from '@/game/state'
import { tick } from '@/game/time'
import type { GameState, PlayerAction } from '@/game/types'

const state = ref<GameState>(createInitialState())

// —— 时间自动流逝（小黑屋式）——
// 单页应用单实例：模块加载即启动世界计时。战斗/死亡时引擎自动暂停。
// URL 参数控制（用于测试与调试）：
//   ?tick=off  完全关闭自动流逝（E2E 确定性）
//   ?tick=fast 加速：每帧推进 1 回合（时间流逝 E2E 专用）
const TICK_INTERVAL_MS = 500
/** fast 模式每帧注入的现实毫秒（等效 1 回合/帧） */
const FAST_FRAME_MS = 8000

function tickerMode(): 'on' | 'off' | 'fast' {
  if (typeof window === 'undefined') return 'off'
  const mode = new URLSearchParams(window.location.search).get('tick')
  if (mode === 'off') return 'off'
  if (mode === 'fast') return 'fast'
  return 'on'
}

const mode = tickerMode()
if (mode !== 'off') {
  const frameMs = mode === 'fast' ? FAST_FRAME_MS : TICK_INTERVAL_MS
  setInterval(() => {
    const result = tick(state.value, frameMs)
    if (result.turns > 0 || result.battleStarted) {
      saveToStorage(state.value)
    }
  }, TICK_INTERVAL_MS)
}

/** 尝试恢复上次存档 */
export function tryLoadSave(): boolean {
  const saved = loadFromStorage()
  if (!saved) return false
  state.value = saved
  return true
}

export function useGame() {
  /** 派发行动并自动存档（返回引擎结果，UI 据此提示） */
  function dispatch(action: PlayerAction): ReturnType<typeof doAction> {
    const result = doAction(state.value, action)
    saveToStorage(state.value)
    return result
  }

  /** 装备物品（引擎独立行动，包装为响应式 + 存档） */
  function equip(uid: string): ReturnType<typeof doAction> {
    const result = equipEngine(state.value, uid)
    saveToStorage(state.value)
    return result
  }

  /** 新开一局 */
  function newGame(): void {
    state.value = createInitialState()
    saveToStorage(state.value)
  }

  /** 切换自动采集（小黑屋式挂机积累） */
  function toggleAutoGather(): boolean {
    state.value.autoGather = !state.value.autoGather
    saveToStorage(state.value)
    return state.value.autoGather
  }

  /** 读档（来自 localStorage 或导入文件） */
  function loadGame(s: GameState): void {
    state.value = s
    saveToStorage(state.value)
  }

  /** 导出存档为 JSON 字符串 */
  function exportJson(): string {
    return serialize(state.value)
  }

  /** 从 JSON 字符串导入（失败抛错由调用方处理） */
  function importJson(json: string): GameState {
    const restored = deserialize(json)
    state.value = restored
    saveToStorage(state.value)
    return restored
  }

  /** 导出存档并触发浏览器下载 */
  function downloadSave(): void {
    const json = serialize(state.value)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `text-wilds-save-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return { state, dispatch, equip, newGame, toggleAutoGather, loadGame, exportJson, importJson, downloadSave }
}
