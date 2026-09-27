<script setup lang="ts">
import { computed } from 'vue'
import { LOCATIONS } from '@/game/constants'
import { useGame } from '../composables/useGame'

const { state } = useGame()

const stats = computed(() => [
  {
    label: '生命',
    value: state.value.health,
    color: state.value.health < 30 ? '#ef4444' : '#22c55e',
  },
  {
    label: '饥饿',
    value: state.value.hunger,
    color: state.value.hunger < 30 ? '#f59e0b' : '#eab308',
  },
  {
    label: '理智',
    value: state.value.sanity,
    color: state.value.sanity < 30 ? '#a855f7' : '#60a5fa',
  },
])

const locationDesc = computed(() => LOCATIONS[state.value.location].desc)
const structuresLabel = computed(() => (state.value.structures.length > 0 ? `营地设施 ×${state.value.structures.length}` : '营地空空如也'))
</script>

<template>
  <aside class="flex flex-col gap-4 rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
    <div>
      <h2 class="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">生存状态</h2>
      <div class="space-y-3">
        <div v-for="s in stats" :key="s.label">
          <div class="mb-1 flex justify-between text-sm">
            <span>{{ s.label }}</span>
            <span class="font-mono" :style="{ color: s.color }">{{ s.value }}</span>
          </div>
          <div class="stat-bar">
            <div :style="{ width: `${s.value}%`, background: s.color }" />
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-lg border border-slate-700/40 bg-slate-800/40 p-3 text-sm leading-relaxed text-slate-300">
      <p class="mb-1 font-semibold text-slate-200">{{ LOCATIONS[state.location].name }}</p>
      <p class="text-slate-400">{{ locationDesc }}</p>
    </div>

    <div class="text-sm text-slate-400">
      <p>
        <span class="font-mono text-slate-300">{{ state.stats.daysSurvived }}</span> 天存活
        · 击杀 <span class="font-mono text-slate-300">{{ state.stats.kills }}</span>
        · 采集 <span class="font-mono text-slate-300">{{ state.stats.gathered }}</span>
      </p>
      <p class="mt-1 text-xs">{{ structuresLabel }}</p>
    </div>
  </aside>
</template>
