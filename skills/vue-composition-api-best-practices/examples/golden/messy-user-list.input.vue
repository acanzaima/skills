<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useUserStore } from '@/store/modules/user'

const keyword = ref('')
const users = ref<UserItem[]>([])
const page = ref(1)
const selectedUser = ref<UserItem | null>(null)
const loading = ref(false)

function selectUser(user: UserItem) {
  selectedUser.value = user
  emit('select', user.id)
}

const userStore = useUserStore()

const props = defineProps<{
  orgId: string
  pageSize?: number
}>()

const canCreate = computed(() => userStore.permissions.includes('user:create'))

async function loadUsers() {
  loading.value = true
  const res = await fetchUsers({
    orgId: props.orgId,
    keyword: keyword.value,
    page: page.value,
    pageSize: props.pageSize || 20
  })
  users.value = res.list
  loading.value = false
}

const emit = defineEmits<{
  select: [id: string]
}>()

function nextPage() {
  page.value++
  loadUsers()
}

function search() {
  page.value = 1
  loadUsers()
}

const hasUsers = computed(() => users.value.length > 0)

watch(() => props.orgId, () => {
  page.value = 1
  loadUsers()
})

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <section>
    <input v-model="keyword" @keyup.enter="search" />
    <button v-if="canCreate">Create</button>

    <p v-if="loading">Loading...</p>
    <ul v-else-if="hasUsers">
      <li v-for="user in users" :key="user.id" @click="selectUser(user)">
        {{ user.name }}
      </li>
    </ul>

    <button @click="nextPage">Next</button>
  </section>
</template>
