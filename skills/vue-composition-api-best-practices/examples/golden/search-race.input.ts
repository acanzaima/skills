import { ref } from 'vue'

export function useSuggestion(
  fetcher: (keyword: string, signal: AbortSignal) => Promise<string[]>
) {
  const suggestions = ref<string[]>([])
  const loading = ref(false)
  let controller: AbortController | null = null

  async function search(keyword: string) {
    if (!keyword.trim()) {
      suggestions.value = []
      return
    }

    controller?.abort()
    controller = new AbortController()
    loading.value = true

    try {
      suggestions.value = await fetcher(keyword, controller.signal)
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        suggestions.value = []
      }
    } finally {
      loading.value = false
    }
  }

  return { suggestions, loading, search }
}
