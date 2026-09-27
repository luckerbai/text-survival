/**
 * 永夜荒原 — 游戏状态管理（UI 层唯一入口）
 * 引擎（game/）保持纯逻辑；此处负责响应式包装、行动派发与自动存档。
 */
import { ref } from 'vue'
import { doAction, equip as equipEngine } from '@/game/actions'
import { deserialize, loadFromStorage, saveToStorage, serialize } from '@/game/save'
import { createInitialState } from '@/game/state'
import type { GameState, PlayerAction } from '@/game/types'

const state = ref<GameState>(createInitialState())

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

  return { state, dispatch, equip, newGame, loadGame, exportJson, importJson, downloadSave }
}
