/**
 * 永夜荒原 Text Wilds — 全局数值与内容常量
 * 平衡参数集中于此文件，M5 调优只改这里。
 */
import type {
  DayPhase,
  EnemyDef,
  EnemyId,
  EquipmentDef,
  EquipmentId,
  LocationDef,
  LocationId,
  MaterialDef,
  MaterialId,
  PhaseConfig,
  Recipe,
  StructureDef,
  StructureId,
  Weather,
} from './types'

/** 存档 schema 版本（未来变更需迁移） */
export const STATE_VERSION = 1

/** 数值上限 */
export const MAX_HEALTH = 100
export const MAX_HUNGER = 100
export const MAX_SANITY = 100

/** 初始数值 */
export const START_HEALTH = 100
export const START_HUNGER = 75
export const START_SANITY = 80

/**
 * 初始补给：足够制作火把（草1+木2）或斧头（燧石1+木2）。
 * 保证第一晚有火源/武器二选一的生存路径（饥荒式新手保护）。
 */
export const START_INVENTORY: Partial<Record<MaterialId, number>> = { grass: 2, wood: 2, flint: 1 }

/** 饥饿归零后每回合扣血 */
export const STARVE_DAMAGE = 4

/** 理智低于该阈值进入低理智状态（幻觉事件概率提高） */
export const LOW_SANITY_THRESHOLD = 30
/** 低理智状态下每回合幻觉事件概率 */
export const LOW_SANITY_EVENT_CHANCE = 0.15

/** 昼夜阶段配置 */
export const PHASE_CONFIG: Record<DayPhase, PhaseConfig> = {
  day: { turns: 4, hungerPerTurn: 4, sanityPerTurn: 0, houndChancePerTurn: 0 },
  dusk: { turns: 1, hungerPerTurn: 4, sanityPerTurn: 0, houndChancePerTurn: 0.03 },
  night: { turns: 3, hungerPerTurn: 5, sanityPerTurn: 10, houndChancePerTurn: 0.08 },
}

/** 材料与食物表 */
export const MATERIALS: Record<MaterialId, MaterialDef> = {
  wood: { id: 'wood', name: '木材', desc: '随处可见的干木料，制作与燃料的基础材料。', category: 'material' },
  flint: { id: 'flint', name: '燧石', desc: '锋利的石片，可用于制作工具。', category: 'material' },
  grass: { id: 'grass', name: '草', desc: '韧性十足的野草，可编成绳索。', category: 'material' },
  stone: { id: 'stone', name: '石头', desc: '结实的石块，搭建与重击都靠它。', category: 'material' },
  berries: {
    id: 'berries',
    name: '浆果',
    desc: '酸甜的野果，填饱肚子但不管饱。',
    category: 'food',
    edible: { hunger: 12, health: 0, sanity: 0 },
  },
  carrot: {
    id: 'carrot',
    name: '胡萝卜',
    desc: '埋在地下的块茎，比浆果更能充饥。',
    category: 'food',
    edible: { hunger: 20, health: 2, sanity: 0 },
  },
  raw_meat: {
    id: 'raw_meat',
    name: '生肉',
    desc: '血淋淋的肉块。生吃会闹肚子，烤过才安全。',
    category: 'food',
    edible: { hunger: 20, health: -3, sanity: -2 },
  },
  cooked_meat: {
    id: 'cooked_meat',
    name: '熟肉',
    desc: '滋滋冒油的烤肉，最可靠的食物来源。',
    category: 'food',
    edible: { hunger: 30, health: 8, sanity: 2 },
  },
  monster_meat: {
    id: 'monster_meat',
    name: '怪物肉',
    desc: '散发恶臭的肉，来自蜘蛛。吃了会掉理智和生命。',
    category: 'food',
    edible: { hunger: 18, health: -12, sanity: -8 },
  },
  cooked_monster_meat: {
    id: 'cooked_monster_meat',
    name: '烤怪物肉',
    desc: '烤过的怪物肉依旧可疑，但至少没那么毒。',
    category: 'food',
    edible: { hunger: 25, health: -4, sanity: -4 },
  },
}

/** 装备表（工具 / 武器 / 光源） */
export const EQUIPMENT: Record<EquipmentId, EquipmentDef> = {
  axe: {
    id: 'axe',
    name: '斧头',
    desc: '砍树更快，也能用来砸人。',
    category: 'tool',
    maxDurability: 15,
    gatherPower: 2,
    damage: 10,
  },
  pickaxe: {
    id: 'pickaxe',
    name: '镐',
    desc: '凿石专用，开采燧石与石头。',
    category: 'tool',
    maxDurability: 15,
    gatherPower: 2,
    damage: 8,
  },
  dagger: {
    id: 'dagger',
    name: '匕首',
    desc: '轻巧的防身短刃。',
    category: 'weapon',
    maxDurability: 10,
    damage: 10,
  },
  spear: {
    id: 'spear',
    name: '长矛',
    desc: '削尖的木杆，比匕首更致命。',
    category: 'weapon',
    maxDurability: 14,
    damage: 16,
  },
  torch: {
    id: 'torch',
    name: '火把',
    desc: '驱散黑暗与恐惧。点燃后照亮 4 回合。',
    category: 'light',
    maxDurability: 4,
    fuel: 4,
    sanityPerTurn: -1,
    damage: 6,
  },
}

/** 结构表 */
export const STRUCTURES: Record<StructureId, StructureDef> = {
  campfire: {
    id: 'campfire',
    name: '营火',
    desc: '简易火堆，提供 6 回合光亮。',
    category: 'structure',
    effect: 'fire',
    fuel: 6,
  },
  firepit: {
    id: 'firepit',
    name: '石火塘',
    desc: '石头围成的火塘，提供 10 回合光亮，比营火持久。',
    category: 'structure',
    effect: 'fire',
    fuel: 10,
  },
  trap: {
    id: 'trap',
    name: '捕兽夹',
    desc: '布置在营地边缘，对来袭敌人造成 40 伤害。',
    category: 'structure',
    effect: 'trap',
    trapDamage: 40,
  },
  sleeping_bag: {
    id: 'sleeping_bag',
    name: '睡袋',
    desc: '躺下休息，每回合恢复 10 生命。',
    category: 'structure',
    effect: 'heal',
    healPerTurn: 10,
  },
}

/** 配方表 */
export const RECIPES: Recipe[] = [
  {
    id: 'axe',
    name: '斧头',
    desc: '砍树更快，也能用来砸人。',
    materials: { flint: 1, wood: 2 },
    result: { id: 'axe', count: 1 },
  },
  {
    id: 'pickaxe',
    name: '镐',
    desc: '凿石专用。',
    materials: { flint: 2, wood: 3 },
    result: { id: 'pickaxe', count: 1 },
  },
  {
    id: 'dagger',
    name: '匕首',
    desc: '轻巧的防身短刃。',
    materials: { flint: 1, stone: 1 },
    result: { id: 'dagger', count: 1 },
  },
  {
    id: 'spear',
    name: '长矛',
    desc: '更致命的武器。',
    materials: { flint: 2, wood: 3 },
    result: { id: 'spear', count: 1 },
  },
  {
    id: 'torch',
    name: '火把',
    desc: '夜晚的救命稻草。',
    materials: { grass: 1, wood: 2 },
    result: { id: 'torch', count: 1 },
  },
  {
    id: 'campfire',
    name: '营火',
    desc: '简易火堆，6 回合光亮。',
    materials: { grass: 2, wood: 4 },
    result: { id: 'campfire', count: 1 },
  },
  {
    id: 'firepit',
    name: '石火塘',
    desc: '更持久的火源，10 回合。',
    materials: { stone: 4, wood: 6 },
    result: { id: 'firepit', count: 1 },
  },
  {
    id: 'trap',
    name: '捕兽夹',
    desc: '营地防御，40 伤害。',
    materials: { grass: 2, wood: 2 },
    result: { id: 'trap', count: 1 },
  },
  {
    id: 'sleeping_bag',
    name: '睡袋',
    desc: '恢复生命的休憩之所。',
    materials: { grass: 4, wood: 2 },
    result: { id: 'sleeping_bag', count: 1 },
  },
  {
    id: 'cooked_meat',
    name: '烤肉',
    desc: '把生肉烤熟。需要在火源旁。',
    materials: { raw_meat: 1 },
    result: { id: 'cooked_meat', count: 1 },
    requiresFire: true,
  },
  {
    id: 'cooked_monster_meat',
    name: '烤怪物肉',
    desc: '怪物肉烤熟后毒性减弱。需要在火源旁。',
    materials: { monster_meat: 1 },
    result: { id: 'cooked_monster_meat', count: 1 },
    requiresFire: true,
  },
]

/** 敌人表 */
export const ENEMIES: Record<EnemyId, EnemyDef> = {
  spider: {
    id: 'spider',
    name: '蜘蛛',
    desc: '八条腿的掠食者，栖息在森林深处。',
    hp: 40,
    damage: 8,
    hitChance: 0.55,
    drops: { monster_meat: 1 },
  },
  hound: {
    id: 'hound',
    name: '猎犬',
    desc: '深夜来袭的噩梦，成群出现。',
    hp: 60,
    damage: 12,
    hitChance: 0.6,
    drops: { raw_meat: 1 },
  },
}

/** 地点表（营地 clearing 为出生点） */
export const LOCATIONS: Record<LocationId, LocationDef> = {
  clearing: {
    id: 'clearing',
    name: '营地空地',
    desc: '你的落脚点，篝火的余烬还散落在泥土上。',
    gather: [{ item: 'grass', chance: 0.7, min: 1, max: 2 }],
    enemyChance: 0,
    enemies: [],
  },
  forest: {
    id: 'forest',
    name: '幽暗森林',
    desc: '密集的树木遮蔽天光，传来细碎的爬行声。',
    gather: [
      { item: 'wood', chance: 0.85, min: 1, max: 2 },
      { item: 'berries', chance: 0.35, min: 1, max: 2 },
    ],
    enemyChance: 0.1,
    enemies: ['spider'],
  },
  rocks: {
    id: 'rocks',
    name: '碎石坡',
    desc: '裸露的岩层，燧石与石块散落其间。',
    gather: [
      { item: 'flint', chance: 0.6, min: 1, max: 1 },
      { item: 'stone', chance: 0.7, min: 1, max: 2 },
    ],
    enemyChance: 0.05,
    enemies: ['spider'],
  },
  meadow: {
    id: 'meadow',
    name: '草甸',
    desc: '开阔的草地，间或可见野生胡萝卜。',
    gather: [
      { item: 'grass', chance: 0.8, min: 1, max: 2 },
      { item: 'carrot', chance: 0.45, min: 1, max: 2 },
    ],
    enemyChance: 0.08,
    enemies: ['spider'],
  },
  pond: {
    id: 'pond',
    name: '池塘',
    desc: '静谧的水面，岸边浆果丛生。',
    gather: [
      { item: 'berries', chance: 0.4, min: 1, max: 2 },
      { item: 'carrot', chance: 0.3, min: 1, max: 1 },
    ],
    enemyChance: 0.06,
    enemies: ['spider'],
  },
}

/** 初始地点 */
export const START_LOCATION: LocationId = 'clearing'

/** 初始天气 */
export const START_WEATHER: Weather = 'clear'
