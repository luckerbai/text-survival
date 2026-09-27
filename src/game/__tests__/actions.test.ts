import { describe, expect, it } from 'vitest'
import { doAction, equip, hasMaterials } from '../actions'
import { EQUIPMENT, LOCATIONS, MATERIALS } from '../constants'
import { createInitialState } from '../state'
import type { GameState, MaterialId, Rng } from '../types'

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

/** 便捷：给初始状态注入材料 */
function withMaterials(s: GameState, items: Partial<Record<MaterialId, number>>): GameState {
  s.inventory = { ...s.inventory, ...items }
  return s
}

describe('doAction: move 移动', () => {
  it('移动到新地点并消耗回合', () => {
    const s = makeState()
    const r = doAction(s, { type: 'move', to: 'forest' }, seq(0.99))
    expect(r.ok).toBe(true)
    expect(s.location).toBe('forest')
    // 时间行动推进回合：白天第 1 回合 → 第 2 回合
    expect(s.turnInPhase).toBe(1)
  })

  it('非法地点被拒绝', () => {
    const s = makeState()
    const r = doAction(s, { type: 'move', to: 'moon' as never }, seq(0.99))
    expect(r.ok).toBe(false)
    expect(s.location).toBe('clearing')
  })
})

describe('doAction: gather 采集', () => {
  it('营地采集产出草', () => {
    const s = makeState()
    const before = s.inventory.grass ?? 0
    // rng 序列：chance=0 命中, count=0(→+1), 天气/幻觉/猎犬均 0.99 不触发
    const r = doAction(s, { type: 'gather' }, seq(0, 0, 0.99, 0.99, 0.99))
    expect(r.ok).toBe(true)
    expect(s.inventory.grass).toBe(before + 1)
    expect(s.stats.gathered).toBe(1)
  })

  it('概率不命中时无产出', () => {
    const s = makeState()
    const before = s.inventory.grass ?? 0
    doAction(s, { type: 'gather' }, seq(0.99)) // 0.99 < 0.7 false
    expect(s.inventory.grass ?? 0).toBe(before)
  })

  it('装备斧头采集木材获得加成', () => {
    const s = makeState({ equipment: [{ uid: 'a1', defId: 'axe', durability: 15 }], equippedUid: 'a1' })
    s.location = 'forest'
    const before = s.inventory.wood ?? 0
    // chance=0 命中 wood, count=0(→基础1, 斧头加成→+2), 浆果 chance=0.99 跳过, 天气/幻觉/猎犬 0.99
    doAction(s, { type: 'gather' }, seq(0, 0, 0.99, 0.99, 0.99, 0.99))
    expect(s.inventory.wood).toBe(before + 2)
  })
})

describe('doAction: explore 探索', () => {
  it('森林探索遭遇蜘蛛', () => {
    const s = makeState()
    s.location = 'forest'
    const r = doAction(s, { type: 'explore' }, seq(0)) // 遭遇判定 0 < 0.1 命中
    expect(r.ok).toBe(true)
    expect(r.message).toContain('蜘蛛')
    expect(s.battle).not.toBeNull()
    expect(s.battle!.enemy.defId).toBe('spider')
  })

  it('安全地点探索无遭遇可发现宝箱', () => {
    const s = makeState()
    // clearing：enemyChance=0 → 跳过遭遇；宝箱 rng 0 < 0.12 → 命中（奖池第一项 wood×3）
    const r = doAction(s, { type: 'explore' }, seq(0, 0, 0.99, 0.99))
    expect(r.ok).toBe(true)
    expect(s.battle).toBeNull()
    expect(s.inventory.wood).toBeGreaterThanOrEqual(3)
  })
})

describe('doAction: craft 制作', () => {
  it('材料充足时制作斧头并扣除材料', () => {
    const s = withMaterials(makeState(), { flint: 1, wood: 2 })
    const r = doAction(s, { type: 'craft', recipeId: 'axe' })
    expect(r.ok).toBe(true)
    expect(s.equipment).toHaveLength(1)
    expect(s.equipment[0].defId).toBe('axe')
    expect(s.inventory.flint).toBe(0)
    expect(s.inventory.wood).toBe(0)
    expect(s.stats.crafted).toBe(1)
  })

  it('材料不足时拒绝制作', () => {
    const s = withMaterials(makeState(), { flint: 1 })
    // 初始补给 grass2+wood2+flint1 造不了营火（草2+木4）
    const r = doAction(s, { type: 'craft', recipeId: 'campfire' })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('材料不足')
    expect(s.structures).not.toContain('campfire')
  })

  it('hasMaterials 正确反映材料是否足够', () => {
    const s = withMaterials(makeState(), { flint: 2, wood: 3 })
    expect(hasMaterials(s, 'axe')).toBe(true)
    expect(hasMaterials(s, 'spear')).toBe(true)
    expect(hasMaterials(s, 'campfire')).toBe(false)
  })

  it('烤制食物需要火源', () => {
    const s = withMaterials(makeState(), { raw_meat: 1 })
    const r = doAction(s, { type: 'craft', recipeId: 'cooked_meat' })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('火源')

    // 点燃火源后可烤制
    s.fire = { turnsLeft: 5, source: 'campfire' }
    const r2 = doAction(s, { type: 'craft', recipeId: 'cooked_meat' })
    expect(r2.ok).toBe(true)
    expect(s.inventory.raw_meat).toBe(0)
    expect(s.inventory.cooked_meat).toBe(1)
  })

  it('建造营火自动点燃', () => {
    const s = withMaterials(makeState(), { grass: 2, wood: 4 })
    const r = doAction(s, { type: 'craft', recipeId: 'campfire' })
    expect(r.ok).toBe(true)
    expect(s.structures).toContain('campfire')
    expect(s.fire).not.toBeNull()
    expect(s.fire!.source).toBe('campfire')
    expect(s.fire!.turnsLeft).toBe(EQUIPMENT ? 6 : 6) // STRUCTURES.campfire.fuel = 6
  })

  it('未知配方被拒绝', () => {
    const s = makeState()
    const r = doAction(s, { type: 'craft', recipeId: 'nuclear_reactor' })
    expect(r.ok).toBe(false)
  })
})

describe('doAction: eat 进食', () => {
  it('吃浆果恢复饥饿', () => {
    const s = withMaterials(makeState(), { berries: 2 })
    const r = doAction(s, { type: 'eat', item: 'berries' })
    expect(r.ok).toBe(true)
    expect(s.hunger).toBe(75 + MATERIALS.berries.edible!.hunger)
    expect(s.inventory.berries).toBe(1)
  })

  it('吃生肉掉生命', () => {
    const s = withMaterials(makeState(), { raw_meat: 1 })
    doAction(s, { type: 'eat', item: 'raw_meat' })
    expect(s.health).toBe(100 + MATERIALS.raw_meat.edible!.health)
  })

  it('非食物不可食用', () => {
    const s = withMaterials(makeState(), { wood: 3 })
    const r = doAction(s, { type: 'eat', item: 'wood' })
    expect(r.ok).toBe(false)
  })

  it('没有食物时报错', () => {
    const s = makeState()
    const r = doAction(s, { type: 'eat', item: 'berries' })
    expect(r.ok).toBe(false)
  })
})

describe('doAction: rest 休息', () => {
  it('休息恢复生命并消耗回合', () => {
    const s = makeState({ health: 50 })
    const r = doAction(s, { type: 'rest' }, seq(0.99))
    expect(r.ok).toBe(true)
    expect(s.health).toBe(58)
    expect(s.turnInPhase).toBe(1)
  })

  it('睡袋恢复更多', () => {
    const s = makeState({ health: 50, structures: ['sleeping_bag'] })
    doAction(s, { type: 'rest' }, seq(0.99))
    expect(s.health).toBe(68)
  })
})

describe('doAction: light 点燃火把', () => {
  it('点燃火把产生火源', () => {
    const s = makeState({ equipment: [{ uid: 't1', defId: 'torch', durability: 4 }] })
    const r = doAction(s, { type: 'light', equipmentUid: 't1' })
    expect(r.ok).toBe(true)
    expect(s.fire).not.toBeNull()
    expect(s.fire!.source).toBe('torch')
  })

  it('已有火源时不能重复点燃', () => {
    const s = makeState({ equipment: [{ uid: 't1', defId: 'torch', durability: 4 }], fire: { turnsLeft: 3, source: 'campfire' } })
    const r = doAction(s, { type: 'light', equipmentUid: 't1' })
    expect(r.ok).toBe(false)
  })

  it('非火把装备不能点燃', () => {
    const s = makeState({ equipment: [{ uid: 'a1', defId: 'axe', durability: 15 }] })
    const r = doAction(s, { type: 'light', equipmentUid: 'a1' })
    expect(r.ok).toBe(false)
  })
})

describe('doAction: fight / flee 战斗', () => {
  it('无敌人时不能攻击', () => {
    const s = makeState()
    const r = doAction(s, { type: 'fight' })
    expect(r.ok).toBe(false)
  })

  it('战斗中攻击造成伤害', () => {
    const s = makeState()
    s.battle = { enemy: { uid: 'sp1', defId: 'spider', hp: 40 } }
    const r = doAction(s, { type: 'fight' }, seq(0, 0.99)) // 命中 + 敌人 miss
    expect(r.ok).toBe(true)
    expect(s.battle!.enemy.hp).toBe(40 - 6)
  })

  it('战斗中逃跑', () => {
    const s = makeState()
    s.battle = { enemy: { uid: 'sp1', defId: 'spider', hp: 40 } }
    const r = doAction(s, { type: 'flee' }, seq(0)) // 0 < 0.6 成功
    expect(r.ok).toBe(true)
    expect(s.battle).toBeNull()
  })
})

describe('doAction: 死亡状态', () => {
  it('死亡后任何行动被拒绝', () => {
    const s = makeState({ dead: true })
    const r = doAction(s, { type: 'gather' })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('已经死了')
  })
})

describe('equip 装备', () => {
  it('装备已有武器', () => {
    const s = makeState({ equipment: [{ uid: 'a1', defId: 'axe', durability: 15 }] })
    const r = equip(s, 'a1')
    expect(r.ok).toBe(true)
    expect(s.equippedUid).toBe('a1')
  })

  it('装备不存在的武器报错', () => {
    const s = makeState()
    const r = equip(s, 'ghost')
    expect(r.ok).toBe(false)
  })
})

describe('回合推进联动', () => {
  it('夜晚无火源行动后可能遭遇猎犬', () => {
    const s = makeState({ phase: 'night', turnInPhase: 0 })
    // rng 序列：采集 chance=0 count=0, 天气 0.99, 幻觉（理智高不消费）, 猎犬判定 0 → 命中
    const r = doAction(s, { type: 'gather' }, seq(0, 0, 0.99, 0))
    expect(r.ok).toBe(true)
    expect(s.battle).not.toBeNull()
    expect(s.battle!.enemy.defId).toBe('hound')
  })

  it('夜晚有火源时行动后不遭猎犬', () => {
    const s = makeState({ phase: 'night', turnInPhase: 0, fire: { turnsLeft: 3, source: 'campfire' } })
    doAction(s, { type: 'gather' }, seq(0.99, 0.99, 0.99))
    expect(s.battle).toBeNull()
  })
})
