/**
 * 永夜荒原 Text Wilds — 存档序列化 / 校验 / 存储
 */
import { MAX_HEALTH, MAX_HUNGER, MAX_SANITY, STATE_VERSION } from './constants'
import { clampHealth, clampHunger, clampSanity, setLogCounter } from './state'
import type { GameState, MaterialId } from './types'

export const STORAGE_KEY = 'text-wilds:save'

/** 存档校验错误 */
export class SaveValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SaveValidationError'
  }
}

/** 序列化为 JSON 字符串 */
export function serialize(state: GameState): string {
  return JSON.stringify(state)
}

/** 基本类型守卫 */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * 反序列化并校验。
 * 校验失败抛 SaveValidationError（不静默返回 null，调用方决定处理方式）。
 */
export function deserialize(json: string): GameState {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new SaveValidationError('存档不是有效的 JSON')
  }
  if (!isRecord(raw)) {
    throw new SaveValidationError('存档结构无效')
  }
  if (raw.version !== STATE_VERSION) {
    throw new SaveValidationError(`存档版本 ${String(raw.version)} 与当前版本 ${STATE_VERSION} 不兼容`)
  }
  if (!isRecord(raw.inventory)) {
    throw new SaveValidationError('存档缺少 inventory')
  }
  if (!Array.isArray(raw.equipment)) {
    throw new SaveValidationError('存档缺少 equipment')
  }
  if (!Array.isArray(raw.structures)) {
    throw new SaveValidationError('存档缺少 structures')
  }
  if (!Array.isArray(raw.log)) {
    throw new SaveValidationError('存档缺少 log')
  }
  if (!isRecord(raw.stats)) {
    throw new SaveValidationError('存档缺少 stats')
  }
  if (!isNumber(raw.health) || !isNumber(raw.hunger) || !isNumber(raw.sanity)) {
    throw new SaveValidationError('存档数值缺失')
  }

  const state: GameState = {
    version: STATE_VERSION,
    uid: typeof raw.uid === 'string' ? raw.uid : 'unknown',
    day: isNumber(raw.day) ? raw.day : 1,
    phase: raw.phase === 'day' || raw.phase === 'dusk' || raw.phase === 'night' ? raw.phase : 'day',
    turnInPhase: isNumber(raw.turnInPhase) ? raw.turnInPhase : 0,
    // 数值统一收束到合法范围，防御损坏存档
    health: clampHealth(raw.health),
    hunger: clampHunger(raw.hunger),
    sanity: clampSanity(raw.sanity),
    inventory: raw.inventory as Partial<Record<MaterialId, number>>,
    equipment: raw.equipment,
    equippedUid: typeof raw.equippedUid === 'string' ? raw.equippedUid : null,
    structures: raw.structures,
    fire: isRecord(raw.fire)
      ? { turnsLeft: isNumber(raw.fire.turnsLeft) ? raw.fire.turnsLeft : 0, source: (raw.fire.source as never) ?? 'campfire' }
      : null,
    location: typeof raw.location === 'string' ? (raw.location as never) : 'clearing',
    weather: raw.weather === 'rain' ? 'rain' : 'clear',
    autoGather: raw.autoGather === true,
    log: raw.log,
    dead: raw.dead === true,
    battle: isRecord(raw.battle) && isRecord(raw.battle.enemy)
      ? {
          enemy: {
            uid: typeof raw.battle.enemy.uid === 'string' ? raw.battle.enemy.uid : 'enemy',
            defId: raw.battle.enemy.defId === 'spider' || raw.battle.enemy.defId === 'hound' ? raw.battle.enemy.defId : 'spider',
            hp: isNumber(raw.battle.enemy.hp) ? Math.max(0, raw.battle.enemy.hp) : 0,
          },
        }
      : null,
    stats: {
      daysSurvived: isNumber(raw.stats.daysSurvived) ? raw.stats.daysSurvived : 0,
      kills: isNumber(raw.stats.kills) ? raw.stats.kills : 0,
      gathered: isNumber(raw.stats.gathered) ? raw.stats.gathered : 0,
      crafted: isNumber(raw.stats.crafted) ? raw.stats.crafted : 0,
      deaths: isNumber(raw.stats.deaths) ? raw.stats.deaths : 0,
    },
  }

  // 恢复日志计数器，避免新日志 id 碰撞
  let maxId = 0
  for (const entry of state.log) {
    if (isNumber(entry.id) && entry.id > maxId) maxId = entry.id
  }
  setLogCounter(maxId)

  return state
}

/** 写入 localStorage（不可用时静默降级） */
export function saveToStorage(state: GameState, key: string = STORAGE_KEY): boolean {
  try {
    localStorage.setItem(key, serialize(state))
    return true
  } catch {
    return false
  }
}

/** 从 localStorage 读取（无存档返回 null，损坏返回 null 并擦除） */
export function loadFromStorage(key: string = STORAGE_KEY): GameState | null {
  try {
    const json = localStorage.getItem(key)
    if (!json) return null
    return deserialize(json)
  } catch {
    try {
      localStorage.removeItem(key)
    } catch {
      // 忽略清理失败
    }
    return null
  }
}
