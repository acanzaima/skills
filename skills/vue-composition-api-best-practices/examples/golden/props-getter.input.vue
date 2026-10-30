<script setup lang="ts">
import { ref, toValue, watch } from 'vue'
import type { MaybeRef } from 'vue'

const { count = 0 } = defineProps<{ count?: number }>()
watch(count, value => console.log(value))
const doubled = useDouble(count)

function useDouble(source: MaybeRef<number>) {
  const result = ref(0)
  watch(() => toValue(source), value => { result.value = value * 2 }, { immediate: true })
  return result
}
</script>

<template><output>{{ doubled }}</output></template>
