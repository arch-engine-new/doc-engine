<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { SignatureTaskView } from "../../services/types";

defineProps<{
  tasks: SignatureTaskView[];
  busy: boolean;
  tagClass: (status: string) => string;
  statusLabel: (status: string) => string;
}>();

const emit = defineEmits<{
  confirm: [task: SignatureTaskView];
}>();
</script>

<template>
  <section v-if="tasks.length === 0" class="card">
    <p class="muted">暂无待签资料。可在项目页生成并上传文档后查看。</p>
  </section>
  <section v-for="task in tasks" :key="task.task_id" class="card sig-card">
    <div class="sig-head">
      <h2 class="card-title">{{ task.role }}</h2>
      <span class="tag" :class="tagClass(task.status)">{{ statusLabel(task.status) }}</span>
    </div>
    <dl class="sig-meta">
      <div>
        <dt>签认人</dt>
        <dd>{{ task.assignee_label || "—" }}</dd>
      </div>
      <div>
        <dt>资料</dt>
        <dd>
          <span class="mono">{{ task.artifact_id }}</span>
          <RouterLink class="sig-link" :to="`/audit/${task.trace_id}`">审计</RouterLink>
        </dd>
      </div>
    </dl>
    <div class="row-actions">
      <button
        class="btn"
        type="button"
        :disabled="busy || task.status !== 'pending'"
        @click="emit('confirm', task)"
      >
        确认签字
      </button>
    </div>
  </section>
</template>

<style scoped>
.sig-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.sig-head .card-title {
  margin: 0;
}
.sig-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0 0 12px;
}
.sig-meta div {
  margin: 0;
}
.sig-meta dt {
  color: var(--apt-text-muted);
  font-size: 12px;
  margin-bottom: 4px;
}
.sig-meta dd {
  margin: 0;
  font-size: 13px;
}
.mono {
  font-family: var(--apt-font-mono), monospace;
  font-size: 12px;
}
.sig-link {
  margin-left: 8px;
  font-size: 12px;
}
@media (max-width: 720px) {
  .sig-meta {
    grid-template-columns: 1fr;
  }
}
</style>
