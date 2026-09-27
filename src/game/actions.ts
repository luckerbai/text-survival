/**
 * 永夜荒原 Text Wilds — 玩家行动统一入口
 *
 * 时间行动（move/gather/explore/rest）消耗 1 回合并在结束时触发回合结算
 * （advanceTurn + 天气/幻觉/夜晚猎犬判定）；
 * 即时行动（craft/eat/light/fight/flee）不推进昼夜。
 */
import { ENEMIES, EQUIPMENT, LOCATIONS, MATERIALS, MAX_HEALTH, RECIPES, STRUCTURES } from './constants'
import { rollEncounter, rollNightHound } from './ai'
import { combatRound, fleeBattle } from './combat'
import { rollHallucination, rollTreasure, rollWeather } from './events'
import { advanceTurn, clampHealth, createUid, hasFire, isNight, kill } from './state'
import type { EquipmentDef, GameState, MaterialId, PlayerAction, Rng } from './types'

export interface ActionResult {
  ok: boolean
  message: string
  /** 附加信息（如战斗多行消息） */
  extra?: string[]
}

export type { PlayerAction }

/** 日志 id 递增（actions 层统一管理） */
let actionLogCounter = 0
export function resetActionLogCounter(): void {
  actionLogCounter = 0
}
function pushLog(state: GameState, text: string, kind: 'info' | 'good' | 'bad' | 'combat' | 'system' = 'info'): void {
  const lastId = state.log.length > 0 ? (state.log.at(-1)?.id ?? 0) : 0
  actionLogCounter = Math.max(actionLogCounter, lastId) + 1
  state.log.push({ id: actionLogCounter, day: state.day, phase: state.phase, text, kind })
}

/** 当前装备（工具/武器） */
export function getEquipped(state: GameState): EquipmentDef | null {
  if (!state.equippedUid) return null
  const instance = state.equipment.find((e) => e.uid === state.equippedUid)
  if (!instance) return null
  return EQUIPMENT[instance.defId]
}

/** 装备某种装备 */
export function equip(state: GameState, equipmentUid: string): ActionResult {
  const instance = state.equipment.find((e) => e.uid === equipmentUid)
  if (!instance) return { ok: false, message: '该装备不存在' }
  state.equippedUid = equipmentUid
  pushLog(state, `你装备了${EQUIPMENT[instance.defId].name}。`, 'info')
  return { ok: true, message: `已装备${EQUIPMENT[instance.defId].name}` }
}

/** 材料是否充足 */
export function hasMaterials(state: GameState, recipeId: string): boolean {
  const recipe = RECIPES.find((r) => r.id === recipeId)
  if (!recipe) return false
  return Object.entries(recipe.materials).every(([item, need]) => (state.inventory[item as MaterialId] ?? 0) >= (need ?? 0))
}

/** 回合结算（时间行动结束时调用） */
function endTurn(state: GameState, rng: Rng): void {
  advanceTurn(state)
  if (state.dead) return
  rollWeather(state, rng)
  rollHallucination(state, rng)
  // 夜晚无火 → 猎犬袭击判定
  if (!state.battle && isNight(state) && !hasFire(state)) {
    const hound = rollNightHound(state, rng)
    if (hound) {
      state.battle = { enemy: hound }
      pushLog(state, `黑暗中传来低吼——${ENEMIES[hound.defId].name}扑向了你！`, 'combat')
    }
  }
}

/** 采集一次（可选次数）；工具对匹配资源有加成 */
function gatherOnce(state: GameState, rng: Rng, times = 1): void {
  const loc = LOCATIONS[state.location]
  const equipped = getEquipped(state)
  const gained: Partial<Record<MaterialId, number>> = {}
  for (let i = 0; i < times; i++) {
    for (const entry of loc.gather) {
      if (rng() >= entry.chance) continue
      let count = entry.min + Math.floor(rng() * (entry.max - entry.min + 1))
      if (equipped?.id === 'axe' && entry.item === 'wood') count += 1
      if (equipped?.id === 'pickaxe' && (entry.item === 'flint' || entry.item === 'stone')) count += 1
      state.inventory[entry.item] = (state.inventory[entry.item] ?? 0) + count
      state.stats.gathered += count
      gained[entry.item] = (gained[entry.item] ?? 0) + count
    }
  }
  for (const [item, count] of Object.entries(gained)) {
    if ((count ?? 0) > 0) pushLog(state, `获得 ${MATERIALS[item as MaterialId].name} ×${count}`, 'good')
  }
}

/** 制作：扣材料 → 产出（工具/武器入背包、结构建造并自动点燃火源、材料入库存） */
function doCraft(state: GameState, recipeId: string): ActionResult {
  const recipe = RECIPES.find((r) => r.id === recipeId)
  if (!recipe) return { ok: false, message: '未知配方' }
  if (recipe.requiresFire && !hasFire(state)) {
    return { ok: false, message: '需要在火源旁才能烤制' }
  }
  for (const [item, need] of Object.entries(recipe.materials)) {
    const key = item as MaterialId
    if ((state.inventory[key] ?? 0) < (need ?? 0)) {
      return { ok: false, message: `材料不足：需要 ${MATERIALS[key].name} ×${need}` }
    }
  }
  for (const [item, need] of Object.entries(recipe.materials)) {
    const key = item as MaterialId
    state.inventory[key] = (state.inventory[key] ?? 0) - (need ?? 0)
  }

  const result = recipe.result
  if (result.id in MATERIALS) {
    const key = result.id as MaterialId
    state.inventory[key] = (state.inventory[key] ?? 0) + result.count
  } else if (result.id in EQUIPMENT) {
    const def = EQUIPMENT[result.id as keyof typeof EQUIPMENT]
    state.equipment.push({ uid: createUid(), defId: result.id as never, durability: def.maxDurability })
  } else if (result.id in STRUCTURES) {
    const def = STRUCTURES[result.id as keyof typeof STRUCTURES]
    state.structures.push(result.id as never)
    // 火源类结构建造后立即点燃
    if (def.effect === 'fire' && def.fuel !== undefined) {
      state.fire = { turnsLeft: def.fuel, source: result.id as never }
      pushLog(state, `${def.name}燃起了火焰。`, 'good')
    } else if (def.effect === 'trap') {
      pushLog(state, `你在营地边缘布置了${def.name}。`, 'info')
    } else if (def.effect === 'heal') {
      pushLog(state, `${def.name}铺好了。`, 'info')
    }
  }
  state.stats.crafted += 1
  pushLog(state, `制作了 ${recipe.name}。`, 'good')
  return { ok: true, message: `制作了 ${recipe.name}` }
}

/** 进食（即时行动） */
function doEat(state: GameState, item: MaterialId): ActionResult {
  const def = MATERIALS[item]
  if (!def.edible) return { ok: false, message: '这东西不能吃' }
  if ((state.inventory[item] ?? 0) <= 0) return { ok: false, message: `没有${def.name}了` }
  state.inventory[item] = (state.inventory[item] ?? 0) - 1
  state.hunger = Math.min(100, state.hunger + def.edible.hunger)
  state.health = clampHealth(state.health + def.edible.health)
  state.sanity = Math.min(100, state.sanity + def.edible.sanity)
  pushLog(state, `吃下${def.name}。`, 'good')
  return { ok: true, message: `吃下${def.name}` }
}

/** 休息（时间行动） */
function doRest(state: GameState, rng: Rng): ActionResult {
  const hasSleepingBag = state.structures.includes('sleeping_bag')
  const heal = hasSleepingBag ? 18 : 8
  state.health = clampHealth(state.health + heal)
  pushLog(state, `你躺下休息，恢复了 ${heal} 生命。${hasSleepingBag ? '睡袋让你睡得更安稳。' : ''}`, 'good')
  endTurn(state, rng)
  return { ok: true, message: `休息了 1 回合，恢复 ${heal} 生命` }
}

/** 前往新地点（时间行动） */
function doMove(state: GameState, to: PlayerAction & { type: 'move' }, rng: Rng): ActionResult {
  if (!(to.to in LOCATIONS)) return { ok: false, message: '未知地点' }
  state.location = to.to
  pushLog(state, `你前往${LOCATIONS[to.to].name}。`, 'info')
  endTurn(state, rng)
  return { ok: true, message: `已到达${LOCATIONS[to.to].name}` }
}

/** 采集（时间行动） */
function doGather(state: GameState, rng: Rng): ActionResult {
  gatherOnce(state, rng, 1)
  endTurn(state, rng)
  return { ok: true, message: '采集完毕' }
}

/** 探索（时间行动）：风险与收益并存 */
function doExplore(state: GameState, rng: Rng): ActionResult {
  const loc = LOCATIONS[state.location]
  const enemy = rollEncounter(loc, rng)
  if (enemy) {
    state.battle = { enemy }
    pushLog(state, `你在${loc.name}深处惊动了${ENEMIES[enemy.defId].name}！`, 'combat')
    endTurn(state, rng)
    return { ok: true, message: `遭遇${ENEMIES[enemy.defId].name}` }
  }
  const treasure = rollTreasure(rng)
  if (treasure) {
    state.inventory[treasure.item] = (state.inventory[treasure.item] ?? 0) + treasure.count
    state.stats.gathered += treasure.count
    pushLog(state, `你发现了一个小包裹：${MATERIALS[treasure.item].name} ×${treasure.count}！`, 'good')
  }
  gatherOnce(state, rng, 2)
  endTurn(state, rng)
  return { ok: true, message: '探索完毕' }
}

/** 点燃火把（即时行动） */
function doLight(state: GameState, equipmentUid: string): ActionResult {
  const instance = state.equipment.find((e) => e.uid === equipmentUid)
  if (!instance || EQUIPMENT[instance.defId].category !== 'light') {
    return { ok: false, message: '只能点燃火把' }
  }
  if (hasFire(state)) return { ok: false, message: '已有火源在燃烧' }
  const def = EQUIPMENT[instance.defId]
  state.fire = { turnsLeft: def.fuel ?? 4, source: 'torch' }
  pushLog(state, '你点燃了火把，火光驱散黑暗。', 'good')
  return { ok: true, message: '火把已点燃' }
}

/** 战斗中攻击（不消耗昼夜回合） */
function doFight(state: GameState, rng: Rng): ActionResult {
  if (!state.battle) return { ok: false, message: '当前没有敌人' }
  const result = combatRound(state, state.battle, rng)
  for (const m of result.messages) pushLog(state, m, 'combat')
  if (result.weaponBroken) pushLog(state, '武器损坏了。', 'bad')
  return { ok: true, message: result.messages.join(' ') }
}

/** 战斗中逃跑（不消耗昼夜回合） */
function doFlee(state: GameState, rng: Rng): ActionResult {
  if (!state.battle) return { ok: false, message: '当前没有敌人' }
  const result = fleeBattle(state, rng)
  for (const m of result.messages) pushLog(state, m, 'combat')
  return { ok: true, message: result.messages.join(' ') }
}

/** 行动总入口 */
export function doAction(state: GameState, action: PlayerAction, rng: Rng = Math.random): ActionResult {
  if (state.dead) return { ok: false, message: '你已经死了……' }

  switch (action.type) {
    case 'move':
      return doMove(state, action, rng)
    case 'gather':
      return doGather(state, rng)
    case 'explore':
      return doExplore(state, rng)
    case 'craft':
      return doCraft(state, action.recipeId)
    case 'eat':
      return doEat(state, action.item)
    case 'rest':
      return doRest(state, rng)
    case 'light':
      return doLight(state, action.equipmentUid)
    case 'fight':
      return doFight(state, rng)
    case 'flee':
      return doFlee(state, rng)
    default:
      return { ok: false, message: '未知行动' }
  }
}
