<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import HeavyChart from '@/components/HeavyChart.vue'
import EmptyState from '@/components/EmptyState.vue'

const props = defineProps<{
  userId: string
  enabled: boolean
}>()

const activeComponent = ref(HeavyChart)
const width = ref(window.innerWidth)
const user = ref<UserProfile | null>(null)
const loading = ref(false)

const profile = computed(() => {
  loadUser()
  return user.value
})

watch(() => props.enabled, (enabled) => {
  activeComponent.value = enabled ? HeavyChart : EmptyState
})

watch(() => props.userId, () => {
  loadUser()
})

async function loadUser() {
  loading.value = true
  const res = await fetch(`/api/users/${props.userId}`)
  user.value = await res.json()
  loading.value = false
}

onMounted(() => {
  window.addEventListener('resize', () => {
    width.value = window.innerWidth
  })
  loadUser()
})
</script>
