<script setup lang="ts">
import { ref } from "vue";
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
  tickAll: [];
}>();

const selectedName = ref("");

function onFileChange(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  selectedName.value = file.name;
  emit("fileChange", file);
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
        选择规范 PDF
        <input type="file" accept="application/pdf" :disabled="busy" @change="onFileChange" />
      </label>
      <span v-if="selectedName" class="tag">已选 {{ selectedName }}</span>
      <button class="btn" type="button" :disabled="busy || !ingestRunId || tickDone" @click="emit('tickAll')">
        处理全部页
      </button>
      <button class="btn ghost" type="button" :disabled="busy || !ingestRunId || tickDone" @click="emit('tick')">
        处理一页
      </button>
      <span v-if="ingestRunId" class="tag">已登记，请逐页处理</span>
      <span v-if="tickDone" class="tag ok">全部页处理完</span>
    </div>
    <div v-if="pages.length > 0" class="row-actions">
      <span v-for="page in pages" :key="`p-${page.page_no}`" class="tag" :class="tagClass(page.status)">
        页 {{ page.page_no }} · {{ page.status }}
      </span>
    </div>
  </div>
</template>
