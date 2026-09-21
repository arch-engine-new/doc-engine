<script setup lang="ts">
import type { DocTypeView } from "../../services/types";

defineProps<{
  docTypes: DocTypeView[];
  selectedDocTypeId: string;
  busy: boolean;
  canLegacyFixture: boolean;
  canConfirmNext: boolean;
  nextStatus: string;
  nextStatusLabel: string;
}>();

const emit = defineEmits<{
  "update:selectedDocTypeId": [value: string];
  runFixture: [kind: "ok" | "reversed"];
  confirmNext: [];
  resetDemo: [];
}>();
</script>

<template>
  <section class="card">
    <h2 class="card-title">旧夹具（legacy）</h2>
    <p class="row-actions">
      <label class="filter-label">
        DocType
        <select
          :value="selectedDocTypeId"
          @change="emit('update:selectedDocTypeId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">未选</option>
          <option v-for="dt in docTypes" :key="dt.doc_type_id" :value="dt.doc_type_id">
            {{ dt.name }}
          </option>
        </select>
      </label>
      <button class="btn ghost" type="button" :disabled="!canLegacyFixture" @click="emit('runFixture', 'ok')">
        合规夹具
      </button>
      <button class="btn ghost" type="button" :disabled="!canLegacyFixture" @click="emit('runFixture', 'reversed')">
        颠倒夹具
      </button>
      <button class="btn ghost" type="button" :disabled="!canConfirmNext" @click="emit('confirmNext')">
        同意下一步
        <template v-if="nextStatus">→ {{ nextStatusLabel }}</template>
      </button>
      <button class="btn ghost" type="button" :disabled="busy" @click="emit('resetDemo')">重置演示</button>
    </p>
    <p class="muted">须先选 DocType。skill Job 调同意下一步返回 409。</p>
  </section>
</template>
