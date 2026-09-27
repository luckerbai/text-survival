import { describe, expect, it } from 'vitest'
import { PHASE_CONFIG, STATE_VERSION } from '../constants'
import { deserialize, SaveValidationError, serialize } from '../save'
import { advanceTurn, createInitialState } from '../state'

describe('serialize / deserialize 存档往返', () => {
  it('序列化后反序列化状态等价', () => {
    const s = createInitialState()
    s.inventory = { wood: 3, flint: 1 }
    s.day = 3
    s.phase = 'night'
    const restored = deserialize(serialize(s))
    expect(restored).toEqual(s)
  })

  it('携带装备实例往返一致', () => {
    const s = createInitialState()
    s.equipment = [{ uid: 'e1', defId: 'axe', durability: 10 }]
    s.equippedUid = 'e1'
    const restored = deserialize(serialize(s))
    expect(restored.equipment).toEqual([{ uid: 'e1', defId: 'axe', durability: 10 }])
    expect(restored.equippedUid).toBe('e1')
  })

  it('日志 id 在往返后继续自增不碰撞', () => {
    const s = createInitialState()
    // 推进到黄昏产生"太阳西沉"日志
    for (let i = 0; i < PHASE_CONFIG.day.turns; i++) {
      advanceTurn(s)
    }
    const lastId = s.log.at(-1)!.id
    const restored = deserialize(serialize(s))
    // 读档后再推进一回合（黄昏→夜晚，产生"夜幕降临"日志），id 必须大于恢复前最大 id
    advanceTurn(restored)
    const newId = restored.log.at(-1)!.id
    expect(newId).toBeGreaterThan(lastId)
    // 且日志列表已追加而非覆盖
    expect(restored.log.length).toBeGreaterThan(s.log.length)
  })
})

describe('deserialize 校验', () => {
  it('非法 JSON 抛 SaveValidationError', () => {
    expect(() => deserialize('not-json{{{')).toThrow(SaveValidationError)
  })

  it('版本不兼容抛 SaveValidationError', () => {
    const s = createInitialState()
    const json = serialize(s).replace(`"version":${STATE_VERSION}`, `"version":${STATE_VERSION + 1}`)
    expect(() => deserialize(json)).toThrow(/版本/)
  })

  it('缺失核心字段抛 SaveValidationError', () => {
    expect(() => deserialize(JSON.stringify({ version: STATE_VERSION }))).toThrow(SaveValidationError)
    expect(() => deserialize(JSON.stringify({ version: STATE_VERSION, inventory: {} }))).toThrow(SaveValidationError)
  })

  it('越界数值被收束到合法范围（防御损坏存档）', () => {
    const s = createInitialState()
    const raw = JSON.parse(serialize(s)) as Record<string, unknown>
    raw.health = 999
    raw.sanity = -50
    const restored = deserialize(JSON.stringify(raw))
    expect(restored.health).toBe(100)
    expect(restored.sanity).toBe(0)
  })

  it('autoGather 往返一致（开）', () => {
    const s = createInitialState()
    s.autoGather = true
    const restored = deserialize(serialize(s))
    expect(restored.autoGather).toBe(true)
  })

  it('旧存档（无 autoGather 字段）读档时补默认 false', () => {
    const s = createInitialState()
    const raw = JSON.parse(serialize(s)) as Record<string, unknown>
    delete raw.autoGather
    const restored = deserialize(JSON.stringify(raw))
    expect(restored.autoGather).toBe(false)
  })

  it('损坏的 phase 回退为 day', () => {
    const s = createInitialState()
    const raw = JSON.parse(serialize(s)) as Record<string, unknown>
    raw.phase = 'midnight'
    const restored = deserialize(JSON.stringify(raw))
    expect(restored.phase).toBe('day')
  })
})
