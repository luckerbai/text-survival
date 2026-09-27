<script setup lang="ts">
import { computed } from 'vue'
import { ENEMIES, LOCATIONS, MATERIALS, STRUCTURES, EQUIPMENT, REAL_SECONDS_PER_TURN } from '@/game/constants'
import { tryLoadSave, useGame } from './composables/useGame'
import ActionPanel from './components/ActionPanel.vue'
import BattlePanel from './components/BattlePanel.vue'
import CraftPanel from './components/CraftPanel.vue'
import DeathScreen from './components/DeathScreen.vue'
import InventoryPanel from './components/InventoryPanel.vue'
import LogStream from './components/LogStream.vue'
import SavePanel from './components/SavePanel.vue'
import StatusPanel from './components/StatusPanel.vue'

const { state, newGame } = useGame()

const phaseLabel = computed(() => {
  const map = { day: '白天', dusk: '黄昏', night: '夜晚' }
  return map[state.value.phase]
})

const phaseClass = computed(() => {
  if (state.value.phase === 'night') return 'text-indigo-300'
  if (state.value.phase === 'dusk') return 'text-orange-300'
  return 'text-amber-200'
})

const locationName = computed(() => LOCATIONS[state.value.location].name)
const weatherLabel = computed(() => (state.value.weather === 'rain' ? '🌧 下雨' : '☀ 晴天'))
const fireLabel = computed(() =>
  state.value.fire
    ? `火源 ${state.value.fire.source === 'torch' ? '火把' : STRUCTURES[state.value.fire.source as keyof typeof STRUCTURES]?.name ?? '营火'} · ${state.value.fire.turnsLeft} 回合`
    : '无火源',
)

// 恢复上次存档（仅在应用挂载时执行一次）
tryLoadSave()
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 顶栏 -->
    <header class="flex items-center justify-between border-b border-slate-700/60 bg-slate-900/80 px-4 py-2">
      <div class="flex items-baseline gap-3">
        <h1 class="text-lg font-bold tracking-widest text-amber-100">永夜荒原</h1>
        <span class="text-xs text-slate-400">Text Wilds · 文字生存</span>
      </div>
      <div class="flex items-center gap-4 text-sm">
        <span class="font-mono text-slate-300">第 <b class="text-amber-200">{{ state.day }}</b> 天</span>
        <span :class="phaseClass">{{ phaseLabel }}</span>
        <span>{{ weatherLabel }}</span>
        <span :class="state.fire ? 'text-amber-300' : 'text-red-400'" class="font-mono">{{ fireLabel }}</span>
        <span class="text-slate-400">{{ locationName }}</span>
        <span class="text-xs text-slate-500" data-tick-hint>⏳ 时间流逝 · {{ REAL_SECONDS_PER_TURN }}秒/回合</span>
      </div>
    </header>

    <!-- 主区三栏 -->
    <main class="grid flex-1 grid-cols-[280px_1fr_320px] gap-3 overflow-hidden p-3">
      <StatusPanel />
      <div class="flex min-h-0 flex-col gap-3">
        <ActionPanel />
        <LogStream class="flex-1" />
      </div>
      <div class="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <InventoryPanel />
        <CraftPanel />
      </div>
    </main>

    <!-- 底部工具 -->
    <footer class="border-t border-slate-700/60 bg-slate-900/80 px-4 py-2">
      <SavePanel />
    </footer>

    <!-- 战斗 / 死亡弹层 -->
    <BattlePanel v-if="state.battle && !state.dead" />
    <DeathScreen v-if="state.dead" :on-restart="newGame" />
  </div>
</template>
