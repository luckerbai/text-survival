/**
 * 永夜荒原 Text Wilds — 敌人生成与袭击判定（AI）
 */
import { PHASE_CONFIG } from './constants'
import { spawnEnemy } from './combat'
import { hasFire } from './state'
import type { EnemyInstance, GameState, LocationDef, Rng } from './types'

/**
 * 夜晚袭击判定：夜晚且无火源时，按阶段配置概率出现猎犬。
 * 返回 null = 平安无事。
 */
export function rollNightHound(state: GameState, rng: Rng = Math.random): EnemyInstance | null {
  if (state.phase !== 'night' || hasFire(state)) return null
  if (rng() < PHASE_CONFIG.night.houndChancePerTurn) {
    return spawnEnemy('hound')
  }
  return null
}

/**
 * 探索遭遇判定：按地点敌人概率 roll，命中则随机选一种该地点的敌人。
 */
export function rollEncounter(location: LocationDef, rng: Rng = Math.random): EnemyInstance | null {
  if (location.enemyChance <= 0 || location.enemies.length === 0) return null
  if (rng() < location.enemyChance) {
    const idx = Math.floor(rng() * location.enemies.length)
    const pick = location.enemies[idx]
    if (!pick) return null
    return spawnEnemy(pick)
  }
  return null
}
