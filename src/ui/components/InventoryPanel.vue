<script setup lang="ts">
import { computed } from 'vue'
import { EQUIPMENT, MATERIALS } from '@/game/constants'
import { useGame } from '../composables/useGame'

const { state, dispatch, equip } = useGame()

/** 背包材料（数量 > 0） */
const materials = computed(() =>
  (Object.entries(state.value.inventory) as Array<[keyof typeof MATERIALS, number]>)
    .filter(([, n]) => n > 0)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
)

/** 是否可食用 */
function isEdible(id: keyof typeof MATERIALS): boolean {
  return MATERIALS[id].edible !== undefined
}

function eat(id: keyof typeof MATERIALS) {
  dispatch({ type: 'eat', item: id })
}

function equipItem(uid: string) {
  equip(uid)
}

function lightTorch(uid: string) {
  dispatch({ type: 'light', equipmentUid: uid })
}
</script>

<template>
  <section class="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3">
    <h2 class="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">背包</h2>

    <!-- 装备 -->
    <div v-if="state.equipment.length > 0" class="mb-3 space-y-1.5">
      <p class="text-xs text-slate-500">装备</p>
      <div
        v-for="eq in state.equipment"
        :key="eq.uid"
        class="flex items-center justify-between rounded-lg border border-slate-700/40 bg-slate-800/40 px-2 py-1.5 text-sm"
        :class="eq.uid === state.equippedUid ? 'border-amber-400/60' : ''"
        :data-equip="eq.defId"
      >
        <div>
          <span class="text-slate-200">{{ EQUIPMENT[eq.defId].name }}</span>
          <span class="ml-2 font-mono text-xs text-slate-500">耐久 {{ eq.durability }}/{{ EQUIPMENT[eq.defId].maxDurability }}</span>
        </div>
        <div class="flex gap-1">
          <button
            v-if="EQUIPMENT[eq.defId].category !== 'light'"
            class="action-btn px-2 py-0.5 text-xs"
            :disabled="eq.uid === state.equippedUid"
            @click="equipItem(eq.uid)"
          >
            {{ eq.uid === state.equippedUid ? '已装备' : '装备' }}
          </button>
          <button
            v-if="EQUIPMENT[eq.defId].category === 'light'"
            class="action-btn px-2 py-0.5 text-xs"
            :disabled="state.fire !== null"
            @click="lightTorch(eq.uid)"
          >
            {{ state.fire ? '已点燃' : '点燃' }}
          </button>
        </div>
      </div>
    </div>
    <p v-else class="mb-2 text-xs text-slate-500">没有工具。去收集燧石和木材，制作斧头吧。</p>

    <!-- 材料 -->
    <div class="grid grid-cols-3 gap-1.5">
      <button
        v-for="[id, n] in materials"
        :key="id"
        class="flex flex-col items-center rounded-lg border border-slate-700/40 bg-slate-800/40 px-2 py-1.5 text-xs transition-colors hover:border-amber-400/50"
        :class="isEdible(id) ? 'cursor-pointer' : 'cursor-default'"
        :disabled="!isEdible(id)"
        :title="MATERIALS[id].desc"
        :data-item="id"
        :data-count="n"
        @click="isEdible(id) && eat(id)"
      >
        <span class="text-slate-200">{{ MATERIALS[id].name }}</span>
        <span class="font-mono text-amber-200">×{{ n }}</span>
        <span v-if="isEdible(id)" class="text-[10px] text-emerald-400">可食用</span>
      </button>
    </div>
    <p v-if="materials.length === 0" class="text-xs text-slate-500">背包空空如也。</p>
  </section>
</template>
