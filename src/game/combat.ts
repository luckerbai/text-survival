/**
 * 永夜荒原 Text Wilds — 战斗结算（玩家先手 → 敌人反击，单回合）
 */
import { ENEMIES, EQUIPMENT } from './constants'
import { clampHealth, createUid, kill } from './state'
import type { BattleState, EnemyDef, EnemyId, EnemyInstance, GameState, Rng } from './types'

/** 徒手攻击力 */
export const BARE_HANDS_DAMAGE = 6
/** 玩家命中率 */
export const PLAYER_HIT_CHANCE = 0.8
/** 逃跑成功率 */
export const FLEE_CHANCE = 0.6

/** 生成敌人实例 */
export function spawnEnemy(defId: EnemyId): EnemyInstance {
  const def = ENEMIES[defId]
  return { uid: createUid(), defId, hp: def.hp }
}

/** 当前玩家武器伤害（徒手兜底） */
export function getPlayerDamage(state: GameState): number {
  const equipped = state.equipment.find((e) => e.uid === state.equippedUid)
  if (!equipped) return BARE_HANDS_DAMAGE
  return EQUIPMENT[equipped.defId].damage ?? BARE_HANDS_DAMAGE
}

/** 当前装备名（用于战斗文案） */
export function getWeaponName(state: GameState): string {
  const equipped = state.equipment.find((e) => e.uid === state.equippedUid)
  if (!equipped) return '拳头'
  const def = EQUIPMENT[equipped.defId]
  if (def.damage === undefined) return def.name
  return def.name
}

export interface CombatRoundResult {
  playerDamage: number
  enemyDamage: number
  enemyDied: boolean
  playerDied: boolean
  enemyHp: number
  weaponBroken: boolean
  messages: string[]
}

/** 敌人掉落入包 */
function applyDrops(state: GameState, enemyDef: EnemyDef): void {
  for (const [item, count] of Object.entries(enemyDef.drops)) {
    const n = count ?? 0
    if (n <= 0) continue
    state.inventory[item as keyof GameState['inventory']] = (state.inventory[item as keyof GameState['inventory']] ?? 0) + n
    state.stats.gathered += n
  }
}

/**
 * 执行一次战斗回合：
 * 玩家先手（命中 PLAYER_HIT_CHANCE），敌人存活则按 hitChance 反击。
 * 击杀 → 掉落 + kills+1 + 解除战斗；玩家死亡 → kill()。
 * 装备武器（非火把）每回合消耗 1 耐久。
 */
export function combatRound(state: GameState, battle: BattleState, rng: Rng = Math.random): CombatRoundResult {
  const enemy = battle.enemy
  const enemyDef = ENEMIES[enemy.defId]
  const messages: string[] = []
  let playerDamage = 0
  let enemyDamage = 0
  let weaponBroken = false

  // 玩家攻击
  if (rng() < PLAYER_HIT_CHANCE) {
    playerDamage = getPlayerDamage(state)
    enemy.hp = Math.max(0, enemy.hp - playerDamage)
    messages.push(`你挥出${getWeaponName(state)}，命中造成 ${playerDamage} 伤害。`)

    // 武器耐久（火把作为武器时仅消耗耐久，光源燃料独立计）
    const equipped = state.equipment.find((e) => e.uid === state.equippedUid)
    if (equipped) {
      equipped.durability -= 1
      if (equipped.durability <= 0) {
        weaponBroken = true
        messages.push(`${EQUIPMENT[equipped.defId].name}断裂了！`)
        state.equipment = state.equipment.filter((e) => e.uid !== equipped.uid)
        if (state.equippedUid === equipped.uid) state.equippedUid = null
      }
    }
  } else {
    messages.push('你的攻击落空了。')
  }

  // 敌人死亡
  if (enemy.hp <= 0) {
    applyDrops(state, enemyDef)
    state.stats.kills += 1
    state.battle = null
    messages.push(`你击杀了${enemyDef.name}！`)
    return {
      playerDamage,
      enemyDamage: 0,
      enemyDied: true,
      playerDied: false,
      enemyHp: 0,
      weaponBroken,
      messages,
    }
  }

  // 敌人反击
  if (rng() < enemyDef.hitChance) {
    enemyDamage = enemyDef.damage
    state.health = clampHealth(state.health - enemyDamage)
    messages.push(`${enemyDef.name}反击，造成了 ${enemyDamage} 伤害。`)
  } else {
    messages.push(`${enemyDef.name}的扑击被你躲开了。`)
  }

  let playerDied = false
  if (state.health <= 0) {
    playerDied = true
    kill(state, `被${enemyDef.name}击杀`)
  }

  return {
    playerDamage,
    enemyDamage,
    enemyDied: false,
    playerDied,
    enemyHp: enemy.hp,
    weaponBroken,
    messages,
  }
}

/** 逃跑：成功解除战斗；失败则敌人白打一次（可能致死） */
export function fleeBattle(state: GameState, rng: Rng = Math.random): { success: boolean; messages: string[] } {
  if (!state.battle) return { success: true, messages: [] }
  const enemyDef = ENEMIES[state.battle.enemy.defId]
  const messages: string[] = []

  if (rng() < FLEE_CHANCE) {
    state.battle = null
    messages.push(`你挣脱了${enemyDef.name}，逃离了战斗。`)
    return { success: true, messages }
  }

  // 逃跑失败：挨一下
  if (rng() < enemyDef.hitChance) {
    const dmg = enemyDef.damage
    state.health = clampHealth(state.health - dmg)
    messages.push(`逃跑时${enemyDef.name}追了上来，咬了你一口（-${dmg}）。`)
    if (state.health <= 0) {
      kill(state, `在逃跑途中被${enemyDef.name}击杀`)
    }
  } else {
    messages.push('逃跑失败，但你险险躲过了追击。')
  }
  return { success: false, messages }
}
