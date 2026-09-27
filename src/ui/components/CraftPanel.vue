<script setup lang="ts">
import { computed } from 'vue'
import { EQUIPMENT, MATERIALS, RECIPES, STRUCTURES } from '@/game/constants'
import { hasMaterials } from '@/game/actions'
import { useGame } from '../composables/useGame'
import type { AnyItemId } from '@/game/types'

const { state, dispatch } = useGame()

const resultName = (id: AnyItemId): string => {
  if (id in MATERIALS) return MATERIALS[id as keyof typeof MATERIALS].name
  if (id in EQUIPMENT) return EQUIPMENT[id as keyof typeof EQUIPMENT].name
  if (id in STRUCTURES) return STRUCTURES[id as keyof typeof STRUCTURES].name
  return String(id)
}

const resultKindLabel = (id: AnyItemId): string => {
  if (id in MATERIALS) return '材料'
  if (id in EQUIPMENT) return EQUIPMENT[id as keyof typeof EQUIPMENT].category === 'light' ? '光源' : '工具'
  if (id in STRUCTURES) return '结构'
  return ''
}

function canCraft(recipeId: string): boolean {
  return hasMaterials(state.value, recipeId)
}

function needsFire(recipeId: string): boolean {
  const r = RECIPES.find((x) => x.id === recipeId)
  return r?.requiresFire === true
}

function craft(recipeId: string) {
  dispatch({ type: 'craft', recipeId })
}
</script>

<template>
  <section class="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3">
    <h2 class="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">制作</h2>
    <div class="space-y-1.5">
      <div
        v-for="recipe in RECIPES"
        :key="recipe.id"
        class="flex items-center justify-between gap-2 rounded-lg border border-slate-700/40 bg-slate-800/40 px-2 py-1.5"
      >
        <div class="min-w-0">
          <p class="flex items-center gap-2 text-sm text-slate-200">
            {{ resultName(recipe.result.id) }}
            <span class="rounded bg-slate-700/60 px-1 text-[10px] text-slate-400">{{ resultKindLabel(recipe.result.id) }}</span>
          </p>
          <p class="truncate font-mono text-xs text-slate-500">
            <template v-for="([item, need], i) in Object.entries(recipe.materials)" :key="item">
              {{ i > 0 ? ' + ' : '' }}{{ MATERIALS[item as keyof typeof MATERIALS].name }} ×{{ need }}
            </template>
            <span v-if="needsFire(recipe.id)" class="ml-1 text-orange-400/80">[需火源]</span>
          </p>
        </div>
        <button
          class="action-btn shrink-0 px-2.5 py-1 text-xs"
          :data-recipe="recipe.id"
          :disabled="!canCraft(recipe.id)"
          :title="recipe.desc"
          @click="craft(recipe.id)"
        >
          制作
        </button>
      </div>
    </div>
    <p class="mt-2 text-[11px] leading-relaxed text-slate-500">提示：营地需要火源才能烤制食物；夜晚无火会被猎犬袭击。</p>
  </section>
</template>
