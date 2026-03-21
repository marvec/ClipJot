import { ref } from "vue"
import type { ToolId } from "../types/tools"

// Module-level singleton for active tool
const activeTool = ref<ToolId>("pen")

export function useToolStore() {
  function setTool(tool: ToolId): void {
    activeTool.value = tool
  }

  return {
    activeTool,
    setTool,
  }
}
