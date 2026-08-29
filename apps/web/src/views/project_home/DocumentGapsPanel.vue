<script setup lang="ts">
import type { DocumentGapView, ProjectView } from "../../services/types";

defineProps<{
  project: ProjectView;
  gaps: DocumentGapView[];
  busy: boolean;
  isFillingGap: (gap: DocumentGapView) => boolean;
}>();

const emit = defineEmits<{
  fillGap: [project: ProjectView, gap: DocumentGapView];
}>();
</script>

<template>
  <section v-if="gaps.length > 0" class="card gaps-card">
    <h2 class="gaps-title">{{ project.name }} — 缺表清单</h2>
    <ul class="gaps-list">
      <li v-for="gap in gaps" :key="`${gap.pack_id}:${gap.doc_type_id}`" class="gap-row">
        <span class="gap-label">{{ gap.label }}</span>
        <button
          class="btn ghost"
          type="button"
          :disabled="busy || isFillingGap(gap)"
          @click="emit('fillGap', project, gap)"
        >
          {{ isFillingGap(gap) ? "补表中…" : "补表" }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.gaps-card {
  margin-bottom: 16px;
}
.gaps-title {
  font-size: 1rem;
  margin: 0 0 8px;
}
.gaps-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.gap-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--apt-border, #e2e6ea);
}
.gap-row:last-child {
  border-bottom: none;
}
.gap-label {
  color: var(--apt-text, #1a1f24);
}
</style>
