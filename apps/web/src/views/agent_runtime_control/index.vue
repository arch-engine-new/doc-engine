<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  getAgentRun,
  getAgentTrace,
  listAgentRuns,
  resumeAgentHitl,
  type AgentRunRow,
  type AgentTraceEvent,
} from "../../services/agent-runtime";

const runs = ref<AgentRunRow[]>([]);
const selectedRunId = ref("");
const trace = ref<AgentTraceEvent[]>([]);
const resumeToken = ref("");
const resumeDecision = ref('{"action":"approve"}');
const error = ref("");
const loading = ref(false);

async function loadRuns() {
  loading.value = true;
  error.value = "";
  try {
    runs.value = await listAgentRuns();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

async function loadTrace(runId: string) {
  selectedRunId.value = runId;
  trace.value = await getAgentTrace(runId);
}

async function submitResume() {
  if (!selectedRunId.value || !resumeToken.value) {
    error.value = "需要 runId 与 token";
    return;
  }
  let decision: unknown;
  try {
    decision = JSON.parse(resumeDecision.value);
  } catch {
    error.value = "decision 必须是合法 JSON";
    return;
  }
  await resumeAgentHitl(selectedRunId.value, resumeToken.value, decision);
  await loadRuns();
  if (selectedRunId.value) {
    await loadTrace(selectedRunId.value);
  }
}

onMounted(() => {
  void loadRuns();
});
</script>

<template>
  <main class="page">
    <header>
      <h1>Agent Runtime 控制面</h1>
      <p class="hint">内部调试页 — 不在产品 9 页导航中</p>
      <button type="button" @click="loadRuns">刷新 runs</button>
    </header>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading">加载中…</p>

    <section>
      <h2>Runs</h2>
      <table>
        <thead>
          <tr>
            <th>runId</th>
            <th>graphId</th>
            <th>threadId</th>
            <th>status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in runs" :key="run.runId">
            <td>{{ run.runId }}</td>
            <td>{{ run.graphId }}</td>
            <td>{{ run.threadId }}</td>
            <td>{{ run.status }}</td>
            <td><button type="button" @click="loadTrace(run.runId)">trace</button></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="selectedRunId">
      <h2>Trace — {{ selectedRunId }}</h2>
      <pre>{{ JSON.stringify(trace, null, 2) }}</pre>
    </section>

    <section>
      <h2>手动 resume HITL</h2>
      <label>
        token
        <input v-model="resumeToken" />
      </label>
      <label>
        decision (JSON)
        <textarea v-model="resumeDecision" rows="3" />
      </label>
      <button type="button" @click="submitResume">resume</button>
    </section>
  </main>
</template>

<style scoped>
.page {
  padding: 1.5rem;
  max-width: 1100px;
}
.hint {
  color: #666;
  font-size: 0.9rem;
}
.error {
  color: #c00;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  border: 1px solid #ddd;
  padding: 0.4rem 0.6rem;
  text-align: left;
}
label {
  display: block;
  margin: 0.5rem 0;
}
input,
textarea {
  width: 100%;
  max-width: 480px;
}
pre {
  background: #f6f6f6;
  padding: 0.75rem;
  overflow: auto;
}
</style>
