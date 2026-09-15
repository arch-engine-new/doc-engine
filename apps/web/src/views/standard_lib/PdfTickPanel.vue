<script setup lang="ts">
import type { IngestTickPageView } from "../../services/types";

defineProps<{
  busy: boolean;
  ingestRunId: string;
  pages: IngestTickPageView[];
  tickDone: boolean;
}>();

const emit = defineEmits<{
  fileChange: [file: File];
  tick: [];
}>();

function onFileChange(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) emit("fileChange", file);
}

/** pending=warn, ok=ok, OCR/index failures=bad — matches global .tag tokens. */
function tagClass(status: string): string {
  if (status === "ok" || status === "done") return "ok";
  if (status === "pending") return "warn";
  if (status === "ocr_error" || status === "index_error") return "bad";
  return "";
}
</script>

<template>
  <div>
    <div class="row-actions">
      <label class="filter-label">
        PDF
        <input type="file" accept="application/pdf" :disabled="busy" @change="onFileChange" />
      </label>
      <button class="btn ghost" type="button" :disabled="busy || !ingestRunId || tickDone" @click="emit('tick')">
        处理一页
      </button>
      <span v-if="ingestRunId" class="tag">run {{ ingestRunId }}</span>
      <span v-if="tickDone" class="tag ok">tick 完成</span>
    </div>
    <div v-if="pages.length > 0" class="row-actions">
      <span v-for="page in pages" :key="`p-${page.page_no}`" class="tag" :class="tagClass(page.status)">
        页 {{ page.page_no }} · {{ page.status }}
      </span>
    </div>
  </div>
</template>
