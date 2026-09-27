/**
 * 永夜荒原 Text Wilds — 时间自动流逝（小黑屋式）
 *
 * 现实时间按 REAL_SECONDS_PER_TURN 换算为游戏回合，由 UI 定时器驱动：
 * 玩家不点击任何行动时，世界也会自己走——饥饿/理智随时间演化、
 * 昼夜自动轮转、火源自然熄灭、夜晚无火时猎犬可能来袭。
 *
 * 设计约束：
 * - tick 是纯函数：给定状态与真实毫秒，推进若干回合并返回变化摘要；
 *   不触碰 localStorage / DOM。
 * - 战斗（state.battle）与死亡时暂停流逝，避免"战斗中饿死/死后世界继续走"。
 * - 时间残差（不足 1 回合的部分）在模块级累积，跨行动保留，
 *   避免 500ms 轮询误差导致每回合都差一点。
 * - 不写入存档：刷新页面后残差清零，最多损失不足 1 回合的时间，可接受。
 */
import { ENEMIES, LOCATIONS, REAL_SECONDS_PER_TURN } from './constants'
import { rollNightHound } from './ai'
import { advanceTurn, pushLog } from './state'
import type { GameState, Rng } from './types'

/** 每回合对应的毫秒数 */
const MS_PER_TURN = REAL_SECONDS_PER_TURN * 1000

/** 时间残差（毫秒），模块级累积 */
let timeBufferMs = 0

/** 测试用：清空时间残差 */
export function resetTimeBuffer(): void {
  timeBufferMs = 0
}

/** 测试用：直接注入残差（便于验证部分回合累积） */
export function setTimeBuffer(ms: number): void {
  timeBufferMs = Math.max(0, ms)
}

export interface TickResult {
  /** 本帧实际推进的回合数 */
  turns: number
  /** 任一回合发生阶段切换（白天→黄昏→夜晚） */
  phaseChanged: boolean
  /** 任一回合跨入新的一天 */
  newDay: boolean
  /** 本帧是否触发了遭遇战（夜晚猎犬） */
  battleStarted: boolean
}

const NO_OP: TickResult = { turns: 0, phaseChanged: false, newDay: false, battleStarted: false }

/**
 * 静默采集（自动采集用）：按当前地点产出表 roll 一次并直接入背包。
 * 与 actions.gatherOnce 同构，但不写日志（挂机产出不刷屏，背包数字自己涨）。
 */
function silentGather(state: GameState, rng: Rng): void {
  const loc = LOCATIONS[state.location]
  for (const entry of loc.gather) {
    if (rng() >= entry.chance) continue
    const count = entry.min + Math.floor(rng() * (entry.max - entry.min + 1))
    state.inventory[entry.item] = (state.inventory[entry.item] ?? 0) + count
    state.stats.gathered += count
  }
}

/**
 * 推进时间流逝。由 UI 定时器周期性调用（建议 500ms 一帧）。
 * 战斗进行中或已死亡时不做任何推进。
 */
export function tick(state: GameState, realMs: number, rng: Rng = Math.random): TickResult {
  if (state.dead || state.battle) return NO_OP

  timeBufferMs += realMs
  if (timeBufferMs < MS_PER_TURN) return NO_OP

  let turns = 0
  let phaseChanged = false
  let newDay = false
  let battleStarted = false

  while (timeBufferMs >= MS_PER_TURN) {
    timeBufferMs -= MS_PER_TURN

    const result = advanceTurn(state)
    phaseChanged = phaseChanged || result.phaseChanged
    newDay = newDay || result.newDay
    turns += 1

    if (state.dead) break

    // 自动采集：开启时每回合静默产出（挂机积累，小黑屋式）
    if (state.autoGather) {
      silentGather(state, rng)
    }

    // 夜晚无火源：猎犬自然来袭（与玩家行动的 endTurn 判定一致）
    if (state.phase === 'night' && !state.battle) {
      const hound = rollNightHound(state, rng)
      if (hound) {
        state.battle = { enemy: hound }
        pushLog(state, `黑暗中传来低吼——${ENEMIES[hound.defId].name}扑向了你！`, 'combat')
        battleStarted = true
        break
      }
    }
  }

  return { turns, phaseChanged, newDay, battleStarted }
}
