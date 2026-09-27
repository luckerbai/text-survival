<script setup lang="ts">
import { computed } from 'vue'
import { useGame } from '../composables/useGame'

const props = defineProps<{ onRestart: () => void }>()
const { state, downloadSave } = useGame()

const stats = computed(() => state.value.stats)
const finalDay = computed(() => Math.max(state.value.day - 1, 0))
const lastLog = computed(() => {
  const logs = state.value.log
  return logs.length > 0 ? logs[logs.length - 1].text : ''
})
</script>

<template>
  <div class="overlay-panel" role="dialog" aria-label="死亡结算">
    <div class="w-full max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 p-8 text-center shadow-2xl">
      <p class="text-sm tracking-widest text-slate-500 uppercase">你倒在了第</p>
      <p class="mt-1 text-6xl font-black text-red-400">{{ finalDay }}</p>
      <p class="text-sm text-slate-400">天</p>

      <p class="mt-2 text-base text-slate-300">{{ lastLog }}</p>

      <div class="mt-6 grid grid-cols-4 gap-2">
        <div class="rounded-lg border border-slate-700/40 bg-slate-800/40 p-2">
          <p class="font-mono text-2xl text-amber-200">{{ stats.daysSurvived }}</p>
          <p class="text-xs text-slate-500">存活天数</p>
        </div>
        <div class="rounded-lg border border-slate-700/40 bg-slate-800/40 p-2">
          <p class="font-mono text-2xl text-red-300">{{ stats.kills }}</p>
          <p class="text-xs text-slate-500">击杀</p>
        </div>
        <div class="rounded-lg border border-slate-700/40 bg-slate-800/40 p-2">
          <p class="font-mono text-2xl text-emerald-300">{{ stats.gathered }}</p>
          <p class="text-xs text-slate-500">采集</p>
        </div>
        <div class="rounded-lg border border-slate-700/40 bg-slate-800/40 p-2">
          <p class="font-mono text-2xl text-sky-300">{{ stats.crafted }}</p>
          <p class="text-xs text-slate-500">制作</p>
        </div>
      </div>

      <div class="mt-6 flex justify-center gap-3">
        <button class="action-btn border-slate-600/50 bg-slate-800/40 px-4 py-2.5 text-slate-200 hover:bg-slate-700/40" data-death-export title="导出当前死亡存档为 JSON 备份" @click="downloadSave">
          导出存档
        </button>
        <button class="action-btn border-amber-400/50 bg-amber-900/30 px-6 py-2.5 text-amber-100 hover:bg-amber-800/40" data-restart @click="onRestart">
          重新开始
        </button>
      </div>
    </div>
  </div>
</template>
