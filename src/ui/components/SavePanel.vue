<script setup lang="ts">
import { ref } from 'vue'
import { useGame } from '../composables/useGame'

const { newGame, downloadSave, importJson, loadGame } = useGame()
const fileInput = ref<HTMLInputElement | null>(null)
const importError = ref('')

function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const restored = importJson(String(reader.result))
      loadGame(restored)
      importError.value = ''
    } catch (err) {
      importError.value = err instanceof Error ? err.message : '存档无效'
    }
  }
  reader.readAsText(file)
  input.value = ''
}

function confirmNewGame() {
  if (window.confirm('确定要放弃当前进度，开始新的一局吗？')) {
    newGame()
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 text-xs">
    <button class="action-btn px-2.5 py-1" @click="confirmNewGame">🔄 新游戏</button>
    <button class="action-btn px-2.5 py-1" @click="downloadSave">⬇ 导出存档</button>
    <button class="action-btn px-2.5 py-1" @click="fileInput?.click()">⬆ 导入存档</button>
    <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="onFileChosen" />
    <span class="text-slate-500">自动存档于本地浏览器；可导出/导入 JSON 备份。</span>
    <span v-if="importError" class="text-red-400">导入失败：{{ importError }}</span>
  </div>
</template>
