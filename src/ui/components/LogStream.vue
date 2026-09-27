<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useGame } from '../composables/useGame'

const { state } = useGame()
const streamEl = ref<HTMLElement | null>(null)

watch(
  () => state.value.log.length,
  async () => {
    await nextTick()
    if (streamEl.value) {
      streamEl.value.scrollTop = streamEl.value.scrollHeight
    }
  },
  { flush: 'post' },
)

const kindColor = (kind: string) => {
  switch (kind) {
    case 'good':
      return 'text-emerald-300'
    case 'bad':
      return 'text-red-300'
    case 'combat':
      return 'text-orange-300'
    case 'system':
      return 'text-slate-500 italic'
    default:
      return 'text-slate-300'
  }
}
</script>

<template>
  <section class="log-stream flex min-h-0 flex-col overflow-y-auto rounded-xl border border-slate-700/50 bg-black/40 p-3">
    <div class="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">生存日志</div>
    <div ref="streamEl" class="flex-1 space-y-1 overflow-y-auto font-mono text-[13px] leading-relaxed">
      <p v-for="entry in state.log" :key="entry.id" class="whitespace-pre-wrap break-words" :class="kindColor(entry.kind)">
        <span class="mr-2 text-slate-600">[{{ entry.day }}日·{{ entry.phase === 'day' ? '昼' : entry.phase === 'dusk' ? '昏' : '夜' }}]</span>{{ entry.text }}
      </p>
      <p v-if="state.log.length === 0" class="text-slate-600">荒野的风吹过营地……你醒了过来。</p>
    </div>
  </section>
</template>
