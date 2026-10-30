<script setup lang="ts">
const count = defineModel<number>('count', { default: 1 })
const props = withDefaults(defineProps<{ labels?: string[] }>(), {
  labels: ['one']
})
</script>

<template>
  <input type="number" v-model="count" />
  <span>{{ props.labels.join(',') }}</span>
</template>
