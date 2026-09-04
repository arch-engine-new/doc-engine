<script setup lang="ts">
import type { SignatureTaskView } from "../../services/types";

defineProps<{
  task: SignatureTaskView;
  signerName: string;
  busy: boolean;
}>();

const emit = defineEmits<{
  "update:signerName": [value: string];
  submit: [];
  close: [];
}>();
</script>

<template>
  <section class="card dialog-panel">
    <p><strong>确认签字 — {{ task.role }}</strong></p>
    <p class="muted">资料 {{ task.artifact_id }}</p>
    <label class="filter-label">
      签字人姓名
      <input
        :value="signerName"
        type="text"
        class="grow"
        placeholder="如：张监理"
        @input="emit('update:signerName', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('submit')"
      />
    </label>
    <div class="row-actions">
      <button class="btn" type="button" :disabled="busy" @click="emit('submit')">提交签字</button>
      <button class="btn ghost" type="button" :disabled="busy" @click="emit('close')">取消</button>
    </div>
  </section>
</template>
