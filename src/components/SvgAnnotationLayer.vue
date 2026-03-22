<script setup lang="ts">
import type {
  Annotation,
  RectAnnotation as RectAnnotationType,
  EllipseAnnotation as EllipseAnnotationType,
  ArrowAnnotation as ArrowAnnotationType,
  LineAnnotation as LineAnnotationType,
  CalloutAnnotation as CalloutAnnotationType,
  TextAnnotation as TextAnnotationType,
} from "../types/annotations"
import { useSelection } from "../composables/useSelection"
import { useTextEditing } from "../composables/useTextEditing"
import { getAnnotationBounds } from "../types/annotations"
import SelectionHandles from "./SelectionHandles.vue"
import RectAnnotation from "./annotations/RectAnnotation.vue"
import EllipseAnnotation from "./annotations/EllipseAnnotation.vue"
import ArrowAnnotation from "./annotations/ArrowAnnotation.vue"
import LineAnnotation from "./annotations/LineAnnotation.vue"
import CalloutAnnotation from "./annotations/CalloutAnnotation.vue"
import TextAnnotation from "./annotations/TextAnnotation.vue"

defineProps<{
  annotations: Annotation[]
  imageWidth: number
  imageHeight: number
}>()

const emit = defineEmits<{
  "start-text-editing": [id: string]
}>()

const { editingAnnotationId } = useTextEditing()

function onStartTextEditing(id: string): void {
  emit("start-text-editing", id)
}

const { selectedIds, select } = useSelection()

function onAnnotationSelect(id: string, additive: boolean): void {
  select(id, additive)
}

function getSelectedAnnotation(
  id: string,
  annotations: Annotation[],
): Annotation | undefined {
  return annotations.find((a) => a.id === id)
}
</script>

<template>
  <svg
    class="svg-annotation-layer"
    :viewBox="`0 0 ${imageWidth} ${imageHeight}`"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- Render each annotation based on type -->
    <g v-for="annotation in annotations" :key="annotation.id">
      <!-- Rectangle annotation -->
      <RectAnnotation
        v-if="annotation.type === 'rect'"
        :annotation="annotation as RectAnnotationType"
        @select="onAnnotationSelect"
      />

      <!-- Ellipse annotation -->
      <EllipseAnnotation
        v-else-if="annotation.type === 'ellipse'"
        :annotation="annotation as EllipseAnnotationType"
        @select="onAnnotationSelect"
      />

      <!-- Arrow annotation (quadratic Bezier with arrowhead) -->
      <ArrowAnnotation
        v-else-if="annotation.type === 'arrow'"
        :annotation="annotation as ArrowAnnotationType"
      />

      <!-- Line annotation (simple straight line) -->
      <LineAnnotation
        v-else-if="annotation.type === 'line'"
        :annotation="annotation as LineAnnotationType"
      />

      <!-- Callout annotation (numbered circle) -->
      <CalloutAnnotation
        v-else-if="annotation.type === 'callout'"
        :annotation="annotation as CalloutAnnotationType"
      />

      <!-- Text annotation (rich text box) -->
      <TextAnnotation
        v-else-if="annotation.type === 'text'"
        :annotation="annotation as TextAnnotationType"
        :is-editing="editingAnnotationId === annotation.id"
        @select="onAnnotationSelect"
        @start-editing="onStartTextEditing"
      />
    </g>

    <!-- Selection handles for selected annotations -->
    <template v-for="id in selectedIds" :key="'handles-' + id">
      <SelectionHandles
        v-if="getSelectedAnnotation(id, annotations)"
        :annotation="getSelectedAnnotation(id, annotations)!"
        :bounds="
          getAnnotationBounds(getSelectedAnnotation(id, annotations)!)
        "
      />
    </template>
  </svg>
</template>

<style scoped>
.svg-annotation-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}
</style>
