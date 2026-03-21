<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const props = withDefaults(
  defineProps<{
    message: string;
    type?: "success" | "error" | "warning";
    duration?: number;
  }>(),
  {
    type: "success",
    duration: 1000,
  },
);

const emit = defineEmits<{
  dismiss: [];
}>();

const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  // Small delay for enter animation
  requestAnimationFrame(() => {
    visible.value = true;
  });

  timer = setTimeout(() => {
    visible.value = false;
    // Wait for exit animation before emitting dismiss
    setTimeout(() => emit("dismiss"), 200);
  }, props.duration);
});

onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <Teleport to="body">
    <div
      class="toast"
      :class="[`toast--${type}`, { 'toast--visible': visible }]"
      role="alert"
      aria-live="polite"
    >
      {{ message }}
    </div>
  </Teleport>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  opacity: 0;
  transition:
    opacity 0.2s,
    transform 0.2s;
  z-index: 2000;
  pointer-events: none;
}

.toast--visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.toast--success {
  background: var(--feedback-success);
  color: var(--text-inverse);
}

.toast--error {
  background: var(--feedback-error);
  color: var(--text-inverse);
}

.toast--warning {
  background: var(--feedback-warning);
  color: var(--text-primary);
}
</style>
