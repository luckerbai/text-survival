import { describe, expect, it } from 'vitest'
import {
  MAX_HEALTH,
  MAX_HUNGER,
  MAX_SANITY,
  PHASE_CONFIG,
  START_HEALTH,
  START_HUNGER,
  START_INVENTORY,
  START_SANITY,
  STARVE_DAMAGE,
} from '../constants'
import { advanceTurn, clamp, clampHealth, clampHunger, clampSanity, createInitialState, hasFire, isNight, kill, nextPhase } from '../state'

describe('clamp 数值收束', () => {
  it('正常值保持不变', () => {
    expect(clamp(50, 0, 100)).toBe(50)
  })
  it('低于下限收束到下界', () => {
    expect(clamp(-5, 0, 100)).toBe(0)
  })
  it('高于上限收束到上界', () => {
    expect(clamp(150, 0, 100)).toBe(100)
  })
  it('三数值的 clamp 使用各自上限', () => {
    expect(clampHealth(150)).toBe(MAX_HEALTH)
    expect(clampHunger(150)).toBe(MAX_HUNGER)
    expect(clampSanity(150)).toBe(MAX_SANITY)
  })
})

describe('createInitialState 初始状态', () => {
  it('初始数值与常量一致', () => {
    const s = createInitialState()
    expect(s.health).toBe(START_HEALTH)
    expect(s.hunger).toBe(START_HUNGER)
    expect(s.sanity).toBe(START_SANITY)
  })
  it('初始阶段为白天第 1 天', () => {
    const s = createInitialState()
    expect(s.day).toBe(1)
    expect(s.phase).toBe('day')
    expect(s.turnInPhase).toBe(0)
    expect(s.dead).toBe(false)
  })
  it('初始在营地、晴天、无火源、带初始补给', () => {
    const s = createInitialState()
    expect(s.location).toBe('clearing')
    expect(s.weather).toBe('clear')
    expect(s.fire).toBeNull()
    expect(s.inventory).toEqual(START_INVENTORY)
    expect(s.equipment).toEqual([])
  })
  it('每次创建生成不同 uid', () => {
    expect(createInitialState().uid).not.toBe(createInitialState().uid)
  })
})

describe('nextPhase 阶段顺序', () => {
  it('day → dusk → night → day 循环', () => {
    expect(nextPhase('day')).toBe('dusk')
    expect(nextPhase('dusk')).toBe('night')
    expect(nextPhase('night')).toBe('day')
  })
})

describe('advanceTurn 回合推进', () => {
  it('白天 4 回合后进入黄昏', () => {
    const s = createInitialState()
    for (let i = 0; i < PHASE_CONFIG.day.turns; i++) {
      advanceTurn(s)
    }
    expect(s.phase).toBe('dusk')
    expect(s.turnInPhase).toBe(0)
  })

  it('黄昏 1 回合后进入夜晚', () => {
    const s = createInitialState()
    for (let i = 0; i < PHASE_CONFIG.day.turns + PHASE_CONFIG.dusk.turns; i++) {
      advanceTurn(s)
    }
    expect(s.phase).toBe('night')
    expect(isNight(s)).toBe(true)
  })

  it('完整一天后 day+1 且回到白天', () => {
    const s = createInitialState()
    const total = PHASE_CONFIG.day.turns + PHASE_CONFIG.dusk.turns + PHASE_CONFIG.night.turns
    let result = { phaseChanged: false, newDay: false }
    for (let i = 0; i < total; i++) {
      result = advanceTurn(s)
    }
    expect(result.newDay).toBe(true)
    expect(s.day).toBe(2)
    expect(s.phase).toBe('day')
  })

  it('每回合按阶段配置扣减饥饿', () => {
    const s = createInitialState()
    advanceTurn(s)
    expect(s.hunger).toBe(START_HUNGER - PHASE_CONFIG.day.hungerPerTurn)
  })

  it('夜晚无火源时每回合额外损失理智', () => {
    const s = createInitialState()
    // 推进到夜晚
    const total = PHASE_CONFIG.day.turns + PHASE_CONFIG.dusk.turns
    for (let i = 0; i < total; i++) {
      advanceTurn(s)
    }
    const sanityBefore = s.sanity
    advanceTurn(s)
    expect(s.sanity).toBe(sanityBefore - PHASE_CONFIG.night.sanityPerTurn)
  })

  it('夜晚有火源时不损失基础理智', () => {
    const s = createInitialState()
    // 先推进到夜晚（此时无火，会有理智损失——不计入比较）
    const total = PHASE_CONFIG.day.turns + PHASE_CONFIG.dusk.turns
    for (let i = 0; i < total; i++) {
      advanceTurn(s)
    }
    // 夜晚点燃火源（模拟过夜前点燃营火）
    s.fire = { turnsLeft: 3, source: 'campfire' }
    const sanityBefore = s.sanity
    advanceTurn(s)
    // 火源在夜晚提供保护：sanity 不因无火惩罚而下降
    expect(s.sanity).toBe(sanityBefore)
  })

  it('火源每回合减少燃料，耗尽后熄灭', () => {
    const s = createInitialState()
    s.fire = { turnsLeft: 2, source: 'torch' }
    advanceTurn(s)
    expect(s.fire?.turnsLeft).toBe(1)
    advanceTurn(s)
    expect(s.fire).toBeNull()
    expect(hasFire(s)).toBe(false)
  })

  it('饥饿归零后每回合扣血', () => {
    const s = createInitialState()
    s.hunger = 0
    s.health = 50
    advanceTurn(s)
    expect(s.health).toBe(50 - STARVE_DAMAGE)
  })

  it('生命归零后进入死亡状态并记录天数', () => {
    const s = createInitialState()
    s.hunger = 100 // 排除饥饿扣血干扰
    s.health = 1
    // 夜晚无火惩罚理智（不影响生命），饥饿充足不扣血，因此需强制饥饿为 0 才会扣血——
    // 此处改为直接验证 kill 之外的死亡路径：把饥饿置 0，让扣血致死。
    s.hunger = 0
    for (let i = 0; i < 20; i++) {
      advanceTurn(s)
      if (s.dead) break
    }
    expect(s.dead).toBe(true)
    expect(s.health).toBe(0)
    expect(s.stats.deaths).toBe(1)
    expect(s.stats.daysSurvived).toBeGreaterThanOrEqual(1)
  })

  it('死亡后继续推进不产生变化', () => {
    const s = createInitialState()
    s.dead = true
    const snapshot = { ...s }
    const result = advanceTurn(s)
    expect(result.phaseChanged).toBe(false)
    expect(s.day).toBe(snapshot.day)
    expect(s.phase).toBe(snapshot.phase)
  })
})

describe('kill 击杀', () => {
  it('设置死亡状态与统计', () => {
    const s = createInitialState()
    kill(s, '被猎犬撕碎')
    expect(s.dead).toBe(true)
    expect(s.health).toBe(0)
    expect(s.stats.deaths).toBe(1)
    expect(s.log.at(-1)?.kind).toBe('system')
    expect(s.log.at(-1)?.text).toContain('你死了')
  })
  it('重复击杀不重复计数', () => {
    const s = createInitialState()
    kill(s, '第一次')
    kill(s, '第二次')
    expect(s.stats.deaths).toBe(1)
  })
})
