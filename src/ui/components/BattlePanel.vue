<script setup lang="ts">
import { computed } from 'vue'
import { ENEMIES } from '@/game/constants'
import { useGame } from '../composables/useGame'

const { state, dispatch } = useGame()

const enemy = computed(() => state.value.battle?.enemy)
const enemyDef = computed(() => (enemy.value ? ENEMIES[enemy.value.defId] : null))
const enemyHpPct = computed(() => {
  if (!enemy.value || !enemyDef.value) return 0
  return Math.max(0, Math.min(100, (enemy.value.hp / enemyDef.value.hp) * 100))
})
</script>

<template>
  <div class="overlay-panel" role="dialog" aria-label="战斗">
    <div class="w-full max-w-md rounded-2xl border border-red-800/50 bg-slate-900 p-6 shadow-2xl">
      <h2 class="mb-1 text-xl font-bold text-red-300">战斗！</h2>
      <p v-if="enemy && enemyDef" class="mb-4 text-sm text-slate-400">{{ enemyDef.desc }}</p>

      <div v-if="enemy && enemyDef" class="mb-4 rounded-lg border border-slate-700/50 bg-slate-800/50 p-3">
        <div class="mb-1 flex justify-between text-sm">
          <span class="text-slate-200">{{ enemyDef.name }}</span>
          <span class="font-mono text-red-300">{{ enemy.hp }} / {{ enemyDef.hp }}</span>
        </div>
        <div class="stat-bar">
          <div class="!bg-red-500" :style="{ width: `${enemyHpPct}%` }" />
        </div>
      </div>

      <div class="flex justify-center gap-3">
        <button class="action-btn border-red-500/50 bg-red-900/30 px-5 py-2.5 text-red-100 hover:bg-red-800/40" data-battle="attack" @click="dispatch({ type: 'fight' })">
          ⚔ 攻击
        </button>
        <button class="action-btn px-5 py-2.5" data-battle="flee" @click="dispatch({ type: 'flee' })">
          逃跑
        </button>
      </div>
      <p class="mt-3 text-center text-xs text-slate-500">攻击消耗武器耐久；逃跑有概率失败并挨打。</p>
    </div>
  </div>
</template>
