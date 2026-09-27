import { describe, expect, it, beforeEach } from 'vitest'
import { REAL_SECONDS_PER_TURN } from '../constants'
import { createInitialState, kill } from '../state'
import { resetTimeBuffer, setTimeBuffer, tick } from '../time'
import type { GameState } from '../types'

const MS_PER_TURN = REAL_SECONDS_PER_TURN * 1000

beforeEach(() => {
  resetTimeBuffer()
})

describe('tick 时间自动流逝', () => {
  it('不足 1 回合的时间不推进', () => {
    const s = createInitialState()
    const hunger0 = s.hunger
    const r = tick(s, MS_PER_TURN - 1)
    expect(r.turns).toBe(0)
    expect(r.phaseChanged).toBe(false)
    expect(s.hunger).toBe(hunger0)
  })

  it('恰好 1 回合推进并结算饥饿', () => {
    const s = createInitialState()
    const r = tick(s, MS_PER_TURN)
    expect(r.turns).toBe(1)
    expect(s.hunger).toBe(75 - 4) // day 阶段每回合 -4
  })

  it('多回合一次推进（2 回合）', () => {
    const s = createInitialState()
    const r = tick(s, MS_PER_TURN * 2)
    expect(r.turns).toBe(2)
    expect(s.hunger).toBe(75 - 8)
  })

  it('完整一昼夜（8 回合）跨入第 2 天', () => {
    const s = createInitialState()
    const r = tick(s, MS_PER_TURN * 8)
    expect(r.turns).toBe(8)
    expect(s.day).toBe(2)
    expect(r.newDay).toBe(true)
  })

  it('阶段切换被上报', () => {
    const s = createInitialState()
    // day 4 回合后进入 dusk
    const r = tick(s, MS_PER_TURN * 4)
    expect(r.turns).toBe(4)
    expect(r.phaseChanged).toBe(true)
    expect(s.phase).toBe('dusk')
  })

  it('时间残差跨帧累积，不丢失不足 1 回合的部分', () => {
    const s = createInitialState()
    const r1 = tick(s, MS_PER_TURN * 0.5)
    expect(r1.turns).toBe(0)
    const r2 = tick(s, MS_PER_TURN * 0.5)
    expect(r2.turns).toBe(1)
  })

  it('setTimeBuffer 可注入残差', () => {
    const s = createInitialState()
    setTimeBuffer(MS_PER_TURN * 0.75)
    const r = tick(s, MS_PER_TURN * 0.25)
    expect(r.turns).toBe(1)
  })

  it('战斗进行中暂停流逝', () => {
    const s = createInitialState()
    s.battle = { enemy: { uid: 'e1', defId: 'hound', hp: 60 } }
    const r = tick(s, MS_PER_TURN * 3)
    expect(r.turns).toBe(0)
    expect(s.hunger).toBe(75)
  })

  it('死亡后不再推进', () => {
    const s = createInitialState()
    kill(s, '测试死亡')
    const r = tick(s, MS_PER_TURN * 3)
    expect(r.turns).toBe(0)
  })

  it('夜晚无火源时猎犬可能自然来袭', () => {
    const s: GameState = { ...createInitialState(), phase: 'night', turnInPhase: 0, fire: null }
    // rng 恒 0 → rollNightHound 必定命中（0 < 0.08）
    const r = tick(s, MS_PER_TURN, () => 0)
    expect(r.turns).toBe(1)
    expect(r.battleStarted).toBe(true)
    expect(s.battle).not.toBeNull()
    expect(s.battle?.enemy.defId).toBe('hound')
  })

  it('夜晚有火源时猎犬不会来袭', () => {
    const s: GameState = { ...createInitialState(), phase: 'night', turnInPhase: 0, fire: { turnsLeft: 3, source: 'torch' } }
    const r = tick(s, MS_PER_TURN, () => 0)
    expect(r.turns).toBe(1)
    expect(r.battleStarted).toBe(false)
    expect(s.battle).toBeNull()
  })

  it('猎犬触发后立即暂停后续流逝', () => {
    const s: GameState = { ...createInitialState(), phase: 'night', turnInPhase: 0, fire: null }
    // 一次性注入 3 回合的时间，但第 1 回合猎犬来袭后应停止
    const r = tick(s, MS_PER_TURN * 3, () => 0)
    expect(r.turns).toBe(1)
    expect(r.battleStarted).toBe(true)
  })

  it('autoGather 默认关闭', () => {
    expect(createInitialState().autoGather).toBe(false)
  })

  it('自动采集开启时每回合静默产出当前地点资源', () => {
    const s = createInitialState()
    s.autoGather = true
    const grass0 = s.inventory.grass ?? 0
    // rng 恒 0：clearing 草 70% 命中，产出 1~2 中取 1
    const r = tick(s, MS_PER_TURN, () => 0)
    expect(r.turns).toBe(1)
    expect(s.inventory.grass ?? 0).toBe(grass0 + 1)
    expect(s.stats.gathered).toBeGreaterThan(0)
  })

  it('自动采集关闭时不产出', () => {
    const s = createInitialState()
    const grass0 = s.inventory.grass ?? 0
    tick(s, MS_PER_TURN, () => 0)
    expect(s.inventory.grass ?? 0).toBe(grass0)
  })

  it('自动采集不写日志（静默，背包数字自己涨）', () => {
    const s = createInitialState()
    s.autoGather = true
    const logLen = s.log.length
    tick(s, MS_PER_TURN, () => 0)
    expect(s.log.length).toBe(logLen)
  })
})
