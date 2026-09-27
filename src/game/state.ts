/**
 * 永夜荒原 Text Wilds — 游戏状态工厂与回合推进状态机
 */
import { MAX_HEALTH, MAX_HUNGER, MAX_SANITY, PHASE_CONFIG, START_HEALTH, START_HUNGER, START_INVENTORY, START_LOCATION, START_SANITY, START_WEATHER, STATE_VERSION, STARVE_DAMAGE } from './constants'
import type { DayPhase, GameState, LogEntry, Stats } from './types'

/** 数值上下限收束 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clampHealth(v: number): number {
  return clamp(v, 0, MAX_HEALTH)
}

export function clampHunger(v: number): number {
  return clamp(v, 0, MAX_HUNGER)
}

export function clampSanity(v: number): number {
  return clamp(v, 0, MAX_SANITY)
}

/** 阶段顺序：day → dusk → night → day */
const PHASE_ORDER: DayPhase[] = ['day', 'dusk', 'night']

/** 生成唯一 id（存档实例与装备实例共用） */
export function createUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 日志计数器（进程内自增，避免碰撞；序列化时以当前最大值恢复） */
let logCounter = 0

export function resetLogCounter() {
  logCounter = 0
}

/** 归位日志计数器（读档时从存档最大 id 恢复） */
export function setLogCounter(n: number): void {
  logCounter = Math.max(0, Math.floor(n))
}

export function pushLog(state: GameState, text: string, kind: LogEntry['kind'] = 'info'): void {
  const lastId = state.log.length > 0 ? (state.log.at(-1)?.id ?? 0) : 0
  logCounter = Math.max(logCounter, lastId) + 1
  state.log.push({ id: logCounter, day: state.day, phase: state.phase, text, kind })
}

/** 初始统计 */
export function createInitialStats(): Stats {
  return { daysSurvived: 0, kills: 0, gathered: 0, crafted: 0, deaths: 0 }
}

/** 创建初始游戏状态 */
export function createInitialState(): GameState {
  return {
    version: STATE_VERSION,
    uid: createUid(),
    day: 1,
    phase: 'day',
    turnInPhase: 0,
    health: START_HEALTH,
    hunger: START_HUNGER,
    sanity: START_SANITY,
    inventory: { ...START_INVENTORY },
    equipment: [],
    equippedUid: null,
    structures: [],
    fire: null,
    location: START_LOCATION,
    weather: START_WEATHER,
    autoGather: false,
    log: [],
    dead: false,
    stats: createInitialStats(),
    battle: null,
  }
}

/** 当前阶段配置（从常量取） */
export function getPhaseConfig(phase: DayPhase) {
  return PHASE_CONFIG[phase]
}

/** 下一阶段（跨天则返回 day+1） */
export function nextPhase(phase: DayPhase): DayPhase {
  const idx = PHASE_ORDER.indexOf(phase)
  return PHASE_ORDER[(idx + 1) % PHASE_ORDER.length]
}

/** 判断是否处于夜晚 */
export function isNight(state: GameState): boolean {
  return state.phase === 'night'
}

/** 判断当前是否有火源（任何来源） */
export function hasFire(state: GameState): boolean {
  return state.fire !== null
}

/**
 * 推进一回合：阶段计时 + 数值结算 + 火源计时 + 死亡判定
 * 返回是否发生了阶段切换（UI 可用于提示）。
 */
export function advanceTurn(state: GameState): { phaseChanged: boolean; newDay: boolean } {
  if (state.dead) {
    return { phaseChanged: false, newDay: false }
  }

  const cfg = getPhaseConfig(state.phase)
  const prevPhase = state.phase
  const prevDay = state.day

  // 1. 阶段回合推进
  state.turnInPhase += 1

  // 2. 火源计时
  if (state.fire) {
    state.fire.turnsLeft -= 1
    if (state.fire.turnsLeft <= 0) {
      pushLog(state, `${state.fire.source === 'torch' ? '火把' : '火源'}熄灭了，黑暗重新包围了你。`, 'bad')
      state.fire = null
    }
  }

  // 3. 数值结算
  state.hunger = clampHunger(state.hunger - cfg.hungerPerTurn)
  let sanityDelta = cfg.sanityPerTurn

  // 夜晚无火源：额外理智惩罚（cfg.sanityPerTurn 即为惩罚量，仅在无火时施加）
  if (state.phase === 'night' && !hasFire(state)) {
    sanityDelta = cfg.sanityPerTurn
  } else if (state.phase === 'night') {
    sanityDelta = 0
  }
  // 雨天轻微掉理智（不叠加惩罚时的补充）
  if (state.weather === 'rain') {
    sanityDelta += 1
  }
  state.sanity = clampSanity(state.sanity - sanityDelta)

  // 饥饿归零扣血
  if (state.hunger <= 0) {
    state.health = clampHealth(state.health - STARVE_DAMAGE)
  }

  // 4. 阶段切换
  let phaseChanged = false
  let newDay = false
  if (state.turnInPhase >= cfg.turns) {
    const next = nextPhase(state.phase)
    state.phase = next
    state.turnInPhase = 0
    phaseChanged = true
    if (next === 'day') {
      state.day += 1
      newDay = true
      pushLog(state, `—— 第 ${state.day} 天，晨光刺破黑暗 ——`, 'system')
    } else if (next === 'dusk') {
      pushLog(state, '太阳西沉，黄昏降临。黑夜将至……', 'bad')
    } else {
      pushLog(state, '夜幕降临。黑暗中有东西在游走……', 'bad')
    }
  }

  // 5. 死亡判定
  if (state.health <= 0) {
    state.dead = true
    state.stats.daysSurvived = state.day
    state.stats.deaths += 1
    pushLog(state, '你倒下了。黑暗吞没了最后的意识……', 'system')
  }

  return { phaseChanged, newDay: newDay || prevDay !== state.day }
}

/** 死亡（被敌人/事件击杀时调用） */
export function kill(state: GameState, reason: string): void {
  if (state.dead) return
  state.health = 0
  state.dead = true
  state.stats.daysSurvived = state.day
  state.stats.deaths += 1
  pushLog(state, `你死了：${reason}`, 'system')
}
