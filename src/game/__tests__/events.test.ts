import { describe, expect, it } from 'vitest'
import { rollHallucination, rollTreasure, rollWeather, TREASURE_POOL } from '../events'
import { createInitialState } from '../state'
import type { GameState, Rng } from '../types'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(), ...overrides }
}

/** 确定性 rng */
function seq(...vals: number[]): Rng {
  let i = 0
  return () => {
    const v = vals[i]
    i += 1
    return v === undefined ? 0.99 : v
  }
}

describe('rollWeather 天气切换', () => {
  it('晴天概率命中时开始下雨', () => {
    const s = makeState()
    rollWeather(s, seq(0)) // 0 < 0.08
    expect(s.weather).toBe('rain')
  })

  it('晴天概率未命中时保持晴天', () => {
    const s = makeState()
    rollWeather(s, seq(0.99))
    expect(s.weather).toBe('clear')
  })

  it('雨天概率命中时转晴', () => {
    const s = makeState({ weather: 'rain' })
    rollWeather(s, seq(0)) // 0 < 0.3
    expect(s.weather).toBe('clear')
  })

  it('雨天概率未命中时继续下雨', () => {
    const s = makeState({ weather: 'rain' })
    rollWeather(s, seq(0.99))
    expect(s.weather).toBe('rain')
  })
})

describe('rollHallucination 低理智幻觉', () => {
  it('理智正常时不触发', () => {
    const s = makeState({ sanity: 80 })
    rollHallucination(s, seq(0))
    expect(s.log).toHaveLength(0)
  })

  it('低理智且概率命中时触发', () => {
    const s = makeState({ sanity: 20 })
    rollHallucination(s, seq(0)) // 0 < 0.15 触发；无物品可丢 → 扣 5 理智
    expect(s.sanity).toBe(15)
    expect(s.log).toHaveLength(1)
  })

  it('有物品时幻觉随机丢失一件材料', () => {
    const s = makeState({ sanity: 20, inventory: { wood: 1 } })
    rollHallucination(s, seq(0, 0.4)) // 触发 + 丢物品分支（0.4 < 0.5）
    expect(s.inventory.wood).toBe(0)
  })

  it('低理智但概率未命中时不触发', () => {
    const s = makeState({ sanity: 20 })
    rollHallucination(s, seq(0.99))
    expect(s.log).toHaveLength(0)
    expect(s.sanity).toBe(20)
  })
})

describe('rollTreasure 探索宝箱', () => {
  it('概率命中时从奖池返回奖励', () => {
    const t = rollTreasure(() => 0) // 0 < 0.12
    expect(t).not.toBeNull()
    expect(TREASURE_POOL.map((p) => p.item)).toContain(t!.item)
    expect(t!.count).toBeGreaterThan(0)
  })

  it('概率未命中时返回 null', () => {
    expect(rollTreasure(() => 0.99)).toBeNull()
  })
})
