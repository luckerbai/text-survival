import { describe, expect, it } from 'vitest'
import { BARE_HANDS_DAMAGE, combatRound, fleeBattle, getPlayerDamage, spawnEnemy } from '../combat'
import { ENEMIES, EQUIPMENT } from '../constants'
import { createInitialState } from '../state'
import type { GameState, Rng } from '../types'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(), ...overrides }
}

/** 确定性 rng：依次返回给定值，耗尽后返回 0.99（miss） */
function seq(...vals: number[]): Rng {
  let i = 0
  return () => {
    const v = vals[i]
    i += 1
    return v === undefined ? 0.99 : v
  }
}

describe('combatRound 战斗回合', () => {
  it('徒手命中造成基础伤害，敌人反击', () => {
    const s = makeState()
    const battle = { enemy: spawnEnemy('spider') }
    const r = combatRound(s, battle, seq(0, 0)) // 玩家命中 + 敌人命中
    expect(r.playerDamage).toBe(BARE_HANDS_DAMAGE)
    expect(r.enemyDamage).toBe(ENEMIES.spider.damage)
    expect(battle.enemy.hp).toBe(ENEMIES.spider.hp - BARE_HANDS_DAMAGE)
    expect(r.enemyDied).toBe(false)
  })

  it('装备长矛提升伤害', () => {
    const s = makeState({ equipment: [{ uid: 'e1', defId: 'spear', durability: 14 }], equippedUid: 'e1' })
    expect(getPlayerDamage(s)).toBe(EQUIPMENT.spear.damage!)
    const battle = { enemy: spawnEnemy('spider') }
    combatRound(s, battle, seq(0, 0.99))
    expect(battle.enemy.hp).toBe(ENEMIES.spider.hp - EQUIPMENT.spear.damage!)
  })

  it('攻击落空时无伤害', () => {
    const s = makeState()
    const battle = { enemy: spawnEnemy('spider') }
    const hpBefore = battle.enemy.hp
    const r = combatRound(s, battle, seq(0.99, 0.99)) // 玩家 miss + 敌人 miss
    expect(r.playerDamage).toBe(0)
    expect(battle.enemy.hp).toBe(hpBefore)
    expect(s.health).toBe(100)
  })

  it('武器每回合消耗耐久，耐久归零断裂', () => {
    const s = makeState({ equipment: [{ uid: 'e1', defId: 'spear', durability: 1 }], equippedUid: 'e1' })
    const battle = { enemy: spawnEnemy('spider') }
    const r = combatRound(s, battle, seq(0, 0.99))
    expect(r.weaponBroken).toBe(true)
    expect(s.equipment).toHaveLength(0)
    expect(s.equippedUid).toBeNull()
  })

  it('击杀敌人：掉落 + kills + 解除战斗', () => {
    const s = makeState({ equipment: [{ uid: 'e1', defId: 'spear', durability: 14 }], equippedUid: 'e1' })
    const battle = { enemy: spawnEnemy('spider') }
    // 蜘蛛 hp 40，长矛 16/回合，3 回合击杀（16+16+16=48，但第一回合后 24，第二 8，第三 0）
    let last: ReturnType<typeof combatRound>
    for (let i = 0; i < 5; i++) {
      last = combatRound(s, battle, seq(0, 0.99))
      if (last.enemyDied) break
    }
    expect(s.battle).toBeNull()
    expect(s.stats.kills).toBe(1)
    expect(s.inventory.monster_meat).toBe(1)
    expect(s.stats.gathered).toBeGreaterThan(0)
  })

  it('敌人反击致死：进入死亡状态', () => {
    const s = makeState({ health: 5, equipment: [{ uid: 'e1', defId: 'spear', durability: 14 }], equippedUid: 'e1' })
    const battle = { enemy: spawnEnemy('hound') }
    combatRound(s, battle, seq(0, 0)) // 玩家命中 + 猎犬命中（12 伤 > 5 hp）
    expect(s.dead).toBe(true)
    expect(s.health).toBe(0)
    expect(s.stats.deaths).toBe(1)
    expect(s.log.at(-1)?.text).toContain('你死了')
  })
})

describe('fleeBattle 逃跑', () => {
  it('成功逃跑解除战斗', () => {
    const s = makeState()
    s.battle = { enemy: spawnEnemy('spider') }
    const r = fleeBattle(s, seq(0)) // 0 < 0.6 → 成功
    expect(r.success).toBe(true)
    expect(s.battle).toBeNull()
  })

  it('逃跑失败被追击受伤', () => {
    const s = makeState()
    s.battle = { enemy: spawnEnemy('spider') }
    const r = fleeBattle(s, seq(0.99, 0)) // 逃跑失败 + 敌人命中
    expect(r.success).toBe(false)
    expect(s.health).toBe(100 - ENEMIES.spider.damage)
    expect(s.battle).not.toBeNull()
  })

  it('逃跑失败且敌人未命中则无伤', () => {
    const s = makeState()
    s.battle = { enemy: spawnEnemy('spider') }
    const r = fleeBattle(s, seq(0.99, 0.99))
    expect(r.success).toBe(false)
    expect(s.health).toBe(100)
  })
})
