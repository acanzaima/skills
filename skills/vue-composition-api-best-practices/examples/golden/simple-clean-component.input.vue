<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  label: string
  count: number
}>()

const emit = defineEmits<{
  confirm: [value: number]
}>()

const step = ref(1)
const doubleCount = computed(() => props.count * 2)

function confirm() {
  emit('confirm', props.count + step.value)
}
</script>

<template>
  <section>
    <h3>{{ label }}</h3>
    <p>{{ doubleCount }}</p>
    <button type="button" @click="step++">+</button>
    <button type="button" @click="confirm">Confirm</button>
  </section>
</template>
