import { describe, expect, it } from 'vitest'
import { rollEncounter, rollNightHound } from '../ai'
import { LOCATIONS } from '../constants'
import { createInitialState } from '../state'
import type { GameState, Rng } from '../types'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(), ...overrides }
}

describe('rollNightHound 夜晚猎犬判定', () => {
  it('夜晚无火源且概率命中时生成猎犬', () => {
    const s = makeState({ phase: 'night' })
    const enemy = rollNightHound(s, () => 0) // 0 < 0.08
    expect(enemy).not.toBeNull()
    expect(enemy!.defId).toBe('hound')
  })

  it('夜晚无火源但概率未命中时平安', () => {
    const s = makeState({ phase: 'night' })
    expect(rollNightHound(s, () => 0.99)).toBeNull()
  })

  it('白天不会出现猎犬', () => {
    const s = makeState({ phase: 'day' })
    expect(rollNightHound(s, () => 0)).toBeNull()
  })

  it('夜晚有火源时不会出现猎犬', () => {
    const s = makeState({ phase: 'night', fire: { turnsLeft: 3, source: 'campfire' } })
    expect(rollNightHound(s, () => 0)).toBeNull()
  })
})

describe('rollEncounter 探索遭遇判定', () => {
  it('无敌人地点恒为 null', () => {
    const clearing = LOCATIONS.clearing
    expect(rollEncounter(clearing, () => 0)).toBeNull()
  })

  it('森林概率命中时遭遇该地点敌人', () => {
    const forest = LOCATIONS.forest
    const enemy = rollEncounter(forest, () => 0) // 0 < 0.1
    expect(enemy).not.toBeNull()
    expect(forest.enemies).toContain(enemy!.defId)
  })

  it('概率未命中时无遭遇', () => {
    const forest = LOCATIONS.forest
    expect(rollEncounter(forest, () => 0.99)).toBeNull()
  })
})
