<script setup lang="ts">
import type { DocTypeView, TemplateView } from "../../services/types";

defineProps<{
  docTypes: DocTypeView[];
  templatesForDocType: TemplateView[];
  selectedDocTypeId: string;
  selectedTemplateId: string;
  hasMultipleTemplates: boolean;
  resolvedTemplateId: string | null;
  canUpload: boolean;
  busy: boolean;
  nextStatus: string;
  statusDict: Array<{ value: string; label: string }>;
  statusFilter: string;
  dictLabel: (items: Array<{ value: string; label: string }>, value: string) => string;
  templateLabel: (templateId: string | null) => string;
}>();

const emit = defineEmits<{
  "update:selectedDocTypeId": [value: string];
  "update:selectedTemplateId": [value: string];
  "update:statusFilter": [value: string];
  docTypeChange: [];
  openFilePicker: [];
  runFixture: [kind: "ok" | "reversed"];
  resetDemo: [];
  confirmNext: [];
}>();
</script>

<template>
  <div class="row-actions">
    <label class="filter-label">
      文档类型
      <select
        :value="selectedDocTypeId"
        @change="
          emit('update:selectedDocTypeId', ($event.target as HTMLSelectElement).value);
          emit('docTypeChange');
        "
      >
        <option value="">请选择</option>
        <option v-for="dt in docTypes" :key="dt.doc_type_id" :value="dt.doc_type_id">
          {{ dt.name }}
        </option>
      </select>
    </label>
    <label v-if="hasMultipleTemplates" class="filter-label">
      模板
      <select
        :value="selectedTemplateId"
        @change="emit('update:selectedTemplateId', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="tpl in templatesForDocType" :key="tpl.template_id" :value="tpl.template_id">
          {{ tpl.name }}
        </option>
      </select>
    </label>
    <slot name="file-input" />
    <button class="btn" :disabled="!canUpload" type="button" @click="emit('openFilePicker')">上传资料</button>
    <button class="btn ghost" :disabled="busy" type="button" @click="emit('runFixture', 'ok')">运行合规夹具</button>
    <button class="btn ghost" :disabled="busy" type="button" @click="emit('runFixture', 'reversed')">运行颠倒夹具</button>
    <button class="btn ghost" :disabled="busy" type="button" @click="emit('resetDemo')">重置演示</button>
    <button class="btn" :disabled="busy || !nextStatus" type="button" @click="emit('confirmNext')">
      同意下一步
      <template v-if="nextStatus">→ {{ dictLabel(statusDict, nextStatus) }}</template>
    </button>
    <label class="filter-label">
      状态
      <select
        :value="statusFilter"
        @change="emit('update:statusFilter', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">全部</option>
        <option v-for="item in statusDict" :key="item.value" :value="item.value">
          {{ item.label }}
        </option>
      </select>
    </label>
  </div>
  <p v-if="selectedDocTypeId" class="sub template-hint">
    <template v-if="resolvedTemplateId">将使用模板：{{ templateLabel(resolvedTemplateId) }}</template>
    <template v-else>该文档类型尚无模板，上传将仅绑定 doc_type_id。</template>
  </p>
</template>

<style scoped>
.template-hint {
  margin-top: -4px;
}
</style>
