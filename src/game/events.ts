/**
 * 永夜荒原 Text Wilds — 随机事件（天气 / 低理智幻觉 / 探索宝箱）
 */
import { LOW_SANITY_EVENT_CHANCE, LOW_SANITY_THRESHOLD, MATERIALS } from './constants'
import { clampSanity } from './state'
import type { GameState, MaterialId, Rng } from './types'

/** 晴天 → 下雨概率（每回合） */
export const RAIN_START_CHANCE = 0.08
/** 下雨 → 晴天概率（每回合） */
export const RAIN_END_CHANCE = 0.3
/** 探索发现宝箱概率 */
export const TREASURE_CHANCE = 0.12
/** 幻觉：随机丢失物品概率（否则扣理智） */
export const HALLUCINATION_DROP_CHANCE = 0.5

/** 宝箱奖池（均匀抽取） */
export const TREASURE_POOL: Array<{ item: MaterialId; count: number }> = [
  { item: 'wood', count: 3 },
  { item: 'flint', count: 2 },
  { item: 'stone', count: 2 },
  { item: 'berries', count: 3 },
  { item: 'carrot', count: 2 },
  { item: 'raw_meat', count: 1 },
]

/** 天气切换（每回合调用一次） */
export function rollWeather(state: GameState, rng: Rng = Math.random): void {
  if (state.weather === 'clear') {
    if (rng() < RAIN_START_CHANCE) {
      state.weather = 'rain'
      state.log.push({
        id: nextLogId(state),
        day: state.day,
        phase: state.phase,
        text: '天空阴沉，雨点砸了下来。',
        kind: 'bad',
      })
    }
  } else if (rng() < RAIN_END_CHANCE) {
    state.weather = 'clear'
    state.log.push({
      id: nextLogId(state),
      day: state.day,
      phase: state.phase,
      text: '雨停了，阳光重新洒落。',
      kind: 'good',
    })
  }
}

/**
 * 低理智幻觉：sanity < 阈值时有概率触发。
 * 触发后随机：丢一件材料 或 再扣 5 理智。
 */
export function rollHallucination(state: GameState, rng: Rng = Math.random): void {
  if (state.sanity >= LOW_SANITY_THRESHOLD) return
  if (rng() >= LOW_SANITY_EVENT_CHANCE) return

  const droppable = Object.entries(state.inventory).filter(([, n]) => (n ?? 0) > 0) as Array<[MaterialId, number]>
  if (droppable.length > 0 && rng() < HALLUCINATION_DROP_CHANCE) {
    const [item] = droppable[Math.floor(rng() * droppable.length)] ?? []
    if (item) {
      state.inventory[item] = (state.inventory[item] ?? 1) - 1
      state.log.push({
        id: nextLogId(state),
        day: state.day,
        phase: state.phase,
        text: `恍惚间，你发现${MATERIALS[item].name}不见了……`,
        kind: 'bad',
      })
      return
    }
  }
  state.sanity = clampSanity(state.sanity - 5)
  state.log.push({
    id: nextLogId(state),
    day: state.day,
    phase: state.phase,
    text: '你的耳边响起低语，有什么东西在阴影里看着你。',
    kind: 'bad',
  })
}

/** 探索时宝箱判定 */
export function rollTreasure(rng: Rng = Math.random): { item: MaterialId; count: number } | null {
  if (rng() >= TREASURE_CHANCE) return null
  const idx = Math.floor(rng() * TREASURE_POOL.length)
  return TREASURE_POOL[idx] ?? null
}

/** 本地日志 id 推进（events 模块不依赖 state.ts 的 pushLog，独立维护） */
let eventLogCounter = 0
export function resetEventLogCounter(): void {
  eventLogCounter = 0
}
function nextLogId(state: GameState): number {
  const lastId = state.log.length > 0 ? (state.log.at(-1)?.id ?? 0) : 0
  eventLogCounter = Math.max(eventLogCounter, lastId) + 1
  return eventLogCounter
}
