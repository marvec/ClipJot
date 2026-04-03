import { ref, watch } from "vue"

const STORAGE_KEY = "clipjot-copy-save-count"

function loadCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== null) {
      const parsed = parseInt(raw, 10)
      if (!isNaN(parsed) && parsed >= 0) return parsed
    }
  } catch {
    // Silently ignore storage errors
  }
  return 0
}

// Module-level singleton
const count = ref(loadCount())

watch(count, (v) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(v))
  } catch {
    // Silently ignore storage errors (quota, private browsing)
  }
})

export function useCopyStats() {
  function increment(): void {
    count.value++
  }
  return { count, increment }
}
