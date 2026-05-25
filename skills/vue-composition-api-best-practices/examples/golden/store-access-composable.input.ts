import { computed } from 'vue'
import { useAppStore } from '@/store/modules/app'

export function useThemeBridge() {
  const appStore = useAppStore()

  const theme = computed(() => appStore.theme)
  const isDark = computed(() => appStore.theme === 'dark')

  function toggleTheme() {
    appStore.setTheme(isDark.value ? 'light' : 'dark')
  }

  return {
    theme,
    isDark,
    toggleTheme
  }
}
