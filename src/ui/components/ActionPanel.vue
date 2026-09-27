<script setup lang="ts">
import { computed } from 'vue'
import { LOCATIONS } from '@/game/constants'
import { hasMaterials } from '@/game/actions'
import { useGame } from '../composables/useGame'

const { state, dispatch } = useGame()

const inBattle = computed(() => state.value.battle !== null)
const isDead = computed(() => state.value.dead)

function act(type: 'gather' | 'explore' | 'rest') {
  dispatch({ type })
}
function move(to: keyof typeof LOCATIONS) {
  dispatch({ type: 'move', to })
}
</script>

<template>
  <section class="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3">
    <!-- 战斗中：战斗操作 -->
    <div v-if="inBattle && !isDead" class="flex flex-wrap gap-2">
      <button class="action-btn border-red-500/50 bg-red-900/30 text-red-200 hover:bg-red-800/40" @click="dispatch({ type: 'fight' })">
        攻击
      </button>
      <button class="action-btn" @click="dispatch({ type: 'flee' })">逃跑</button>
      <p class="w-full text-sm text-slate-400">战斗中！你的行动受限于战斗操作。</p>
    </div>

    <!-- 正常行动 -->
    <div v-else-if="!isDead" class="flex flex-wrap items-center gap-2">
      <button class="action-btn" data-action="gather" @click="act('gather')">采集</button>
      <button class="action-btn border-amber-500/40 text-amber-200 hover:bg-amber-900/30" data-action="explore" @click="act('explore')">
        探索
      </button>
      <button class="action-btn" data-action="rest" @click="act('rest')">休息</button>

      <span class="mx-2 h-5 w-px bg-slate-700" />

      <span class="text-xs text-slate-500">前往：</span>
      <button
        v-for="(loc, id) in LOCATIONS"
        :key="id"
        class="action-btn text-xs"
        :class="id === state.location ? 'border-amber-400/70 text-amber-300' : ''"
        :disabled="id === state.location"
        :data-location="id"
        @click="move(id as keyof typeof LOCATIONS)"
      >
        {{ loc.name }}
      </button>
    </div>

    <p v-else class="text-sm text-slate-500">你已死亡——点击下方按钮重开。</p>
  </section>
</template>
