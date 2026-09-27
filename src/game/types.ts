/**
 * 永夜荒原 Text Wilds — 核心类型定义
 * 引擎纯逻辑层：不依赖任何 Vue/DOM，可独立单测。
 */

/** 材料 / 食物物品 ID */
export type MaterialId =
  | 'wood'
  | 'flint'
  | 'grass'
  | 'stone'
  | 'berries'
  | 'carrot'
  | 'raw_meat'
  | 'cooked_meat'
  | 'monster_meat'
  | 'cooked_monster_meat'

/** 可装备物品 ID（工具 / 武器 / 光源） */
export type EquipmentId = 'axe' | 'pickaxe' | 'dagger' | 'spear' | 'torch'

/** 营地结构 ID */
export type StructureId = 'campfire' | 'firepit' | 'trap' | 'sleeping_bag'

/** 任意物品 ID 的联合（用于配方结果） */
export type AnyItemId = MaterialId | EquipmentId | StructureId

/** 物品类别 */
export type ItemCategory = 'material' | 'food' | 'tool' | 'weapon' | 'light' | 'structure'

/** 材料 / 食物定义 */
export interface MaterialDef {
  id: MaterialId
  name: string
  desc: string
  category: 'material' | 'food'
  /** 食用效果（food 类别才有）：hunger/health/sanity 增量 */
  edible?: { hunger: number; health: number; sanity: number }
}

/** 装备定义（工具 / 武器 / 光源） */
export interface EquipmentDef {
  id: EquipmentId
  name: string
  desc: string
  category: 'tool' | 'weapon' | 'light'
  maxDurability: number
  /** 工具采集加成（tool） */
  gatherPower?: number
  /** 武器攻击力（weapon） */
  damage?: number
  /** 光源燃料回合数（light） */
  fuel?: number
  /** 点燃后每回合理智修正（light 点燃时生效） */
  sanityPerTurn?: number
}

/** 结构定义（营地内建造，常驻效果） */
export interface StructureDef {
  id: StructureId
  name: string
  desc: string
  category: 'structure'
  /** 建造后产生的效果类型 */
  effect: 'fire' | 'heal' | 'trap'
  /** fire：燃料回合数 */
  fuel?: number
  /** heal：休息时每回合恢复生命 */
  healPerTurn?: number
  /** trap：触发时对来袭敌人造成的伤害 */
  trapDamage?: number
}

/** 配方 */
export interface Recipe {
  id: string
  name: string
  desc: string
  /** 所需材料及数量 */
  materials: Partial<Record<MaterialId, number>>
  /** 产出（数量） */
  result: { id: AnyItemId; count: number }
  /** 是否需要点燃火源才能制作（烤制） */
  requiresFire?: boolean
}

/** 敌人定义 */
export interface EnemyDef {
  id: EnemyId
  name: string
  desc: string
  hp: number
  damage: number
  /** 每回合攻击命中概率 0-1 */
  hitChance: number
  /** 击杀掉落 */
  drops: Partial<Record<MaterialId, number>>
}

export type EnemyId = 'spider' | 'hound'

/** 地点定义 */
export interface LocationDef {
  id: LocationId
  name: string
  desc: string
  /** 每次采集的产出概率表 */
  gather: Array<{ item: MaterialId; chance: number; min: number; max: number }>
  /** 探索时遭遇敌人的概率 */
  enemyChance: number
  /** 可遭遇的敌人 */
  enemies: EnemyId[]
}

export type LocationId = 'clearing' | 'forest' | 'rocks' | 'meadow' | 'pond'

/** 昼夜阶段 */
export type DayPhase = 'day' | 'dusk' | 'night'

/** 天气 */
export type Weather = 'clear' | 'rain'

/** 各阶段回合配置 */
export interface PhaseConfig {
  turns: number
  hungerPerTurn: number
  /** 无火源时夜晚额外理智损失 */
  sanityPerTurn: number
  /** 猎犬袭击概率（每回合） */
  houndChancePerTurn: number
}

/** 装备实例（存在于背包，可装备/使用） */
export interface EquipmentInstance {
  uid: string
  defId: EquipmentId
  durability: number
}

/** 火源状态 */
export interface FireState {
  turnsLeft: number
  source: EquipmentId | StructureId
}

/** 玩家统计数据 */
export interface Stats {
  daysSurvived: number
  kills: number
  gathered: number
  crafted: number
  deaths: number
}

/** 敌人实例（遭遇/战斗中） */
export interface EnemyInstance {
  uid: string
  defId: EnemyId
  hp: number
}

/** 战斗状态（非空 = 玩家处于战斗中，行动受限） */
export interface BattleState {
  enemy: EnemyInstance
}

/** 玩家行动（引擎统一入口，由 UI 派发） */
export type PlayerAction =
  | { type: 'move'; to: LocationId }
  | { type: 'gather' }
  | { type: 'explore' }
  | { type: 'craft'; recipeId: string }
  | { type: 'eat'; item: MaterialId }
  | { type: 'rest' }
  | { type: 'light'; equipmentUid: string }
  | { type: 'fight' }
  | { type: 'flee' }

/** 日志条目 */
export interface LogEntry {
  id: number
  day: number
  phase: DayPhase
  text: string
  kind: 'info' | 'good' | 'bad' | 'combat' | 'system'
}

/** 游戏状态（可序列化） */
export interface GameState {
  version: number
  /** 存档实例唯一标识 */
  uid: string
  day: number
  phase: DayPhase
  turnInPhase: number
  health: number
  hunger: number
  sanity: number
  inventory: Partial<Record<MaterialId, number>>
  equipment: EquipmentInstance[]
  /** 当前装备的工具/武器 uid */
  equippedUid: string | null
  /** 已建造结构 */
  structures: StructureId[]
  fire: FireState | null
  location: LocationId
  weather: Weather
  log: LogEntry[]
  dead: boolean
  stats: Stats
  /** 非空 = 玩家正与敌人战斗 */
  battle: BattleState | null
}

/** 随机数函数（注入以便测试确定性） */
export type Rng = () => number
