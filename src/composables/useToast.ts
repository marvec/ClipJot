import { shallowRef } from "vue";

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
  duration: number;
}

const activeToasts = shallowRef<ToastMessage[]>([]);

export function useToast() {
  function show(
    message: string,
    type: ToastMessage["type"] = "success",
    duration?: number,
  ): void {
    const toast: ToastMessage = {
      id: crypto.randomUUID(),
      message,
      type,
      duration: duration ?? (type === "success" ? 1000 : 3000),
    };
    activeToasts.value = [...activeToasts.value, toast];
  }

  function dismiss(id: string): void {
    activeToasts.value = activeToasts.value.filter((t) => t.id !== id);
  }

  function success(message: string): void {
    show(message, "success");
  }

  function error(message: string): void {
    show(message, "error");
  }

  return {
    toasts: activeToasts,
    show,
    dismiss,
    success,
    error,
  };
}
