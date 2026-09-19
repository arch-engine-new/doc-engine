<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import StepChat from "../../components/StepChat.vue";
import { demoNav, ensureDemoSession, rememberDemoNav } from "../../services/demo-session";
import { errorMessage, http } from "../../services/http";
import { prettyJson, type AuditEventView, type ChatMessageView, type ChatThreadView } from "../../services/types";

const route = useRoute();
const router = useRouter();

const events = ref<AuditEventView[]>([]);
const threads = ref<ChatThreadView[]>([]);
const messages = ref<ChatMessageView[]>([]);
const error = ref("");

const traceId = computed(() => String(route.params.traceId ?? ""));

const chatLines = computed(() =>
  messages.value.map((row) => ({
    role: (row.role === "operator" || row.role === "user" ? "user" : "assistant") as "user" | "assistant",
    body: `[${threads.value.find((t) => t.thread_id === row.thread_id)?.step ?? "chat"}] ${row.body}`,
  })),
);

function persistedLabel(eventType: string): string {
  return eventType === "receipt" ? "已落库" : "事件（无 Receipt 不算落库）";
}

function tagClass(eventType: string): string {
  if (eventType === "receipt") return "ok";
  if (eventType === "finding") return "warn";
  return "";
}

async function load() {
  error.value = "";
  try {
    const [traceRes, chatRes] = await Promise.all([
      http<{ events: AuditEventView[] }>(`/api/audit/${traceId.value}`),
      http<{ threads: ChatThreadView[]; messages: ChatMessageView[] }>(`/api/audit/${traceId.value}/chats`),
    ]);
    events.value = traceRes.events;
    threads.value = chatRes.threads;
    messages.value = chatRes.messages;
    rememberDemoNav({ traceId: traceId.value });
    if (events.value.length === 0 && messages.value.length === 0) {
      const ids = await ensureDemoSession();
      if (ids.traceId && ids.traceId !== traceId.value && ids.traceId !== "demo") {
        await router.replace(`/audit/${ids.traceId}`);
      }
    }
  } catch (err) {
    try {
      const ids = await ensureDemoSession();
      if (ids.traceId && ids.traceId !== traceId.value && ids.traceId !== "demo") {
        await router.replace(`/audit/${ids.traceId}`);
        return;
      }
    } catch {
      /* fall through to surface original error */
    }
    error.value = errorMessage(err);
  }
}

onMounted(() => {
  void load();
});

watch(traceId, () => {
  void load();
});
</script>

<template>
  <div class="wrap">
    <h1>审计追踪</h1>
    <p class="sub">
      同一 trace_id 串起 Job / 抽取 / 规则版本 / Finding / 对话。仅 event_type=receipt 展示为已落库。本页只读，不发送会改变结论的对话。验收 A9。
    </p>
    <p class="sub">trace_id={{ traceId || demoNav.traceId }}</p>
    <p v-if="error" class="sub">{{ error }}</p>
    <section class="card timeline">
      <div v-for="ev in events" :key="`${ev.seq}-${ev.event_type}`" class="ev">
        <time>{{ ev.created_at }}</time>
        <span class="tag" :class="tagClass(ev.event_type)">{{ ev.event_type }}</span>
        <span class="tag" :class="ev.event_type === 'receipt' ? 'ok' : ''">{{ persistedLabel(ev.event_type) }}</span>
        <div class="muted">ref={{ ev.ref_id ?? "—" }} · seq={{ ev.seq }}</div>
        <pre class="extract">{{ prettyJson(ev.payload_json) }}</pre>
      </div>
      <p v-if="events.length === 0" class="muted">无审计事件。请从任务列表打开真实 trace_id。</p>
    </section>
    <section class="card">
      <h2 class="card-title">本步对话（只读）</h2>
      <p v-if="threads.length === 0" class="muted">尚无 ConversationThread。</p>
      <div v-for="thread in threads" :key="thread.thread_id">
        <p>
          <span class="tag">{{ thread.step }}</span>
          <span class="muted"> {{ thread.thread_id }}</span>
        </p>
        <p
          v-for="(msg, i) in messages.filter((row) => row.thread_id === thread.thread_id)"
          :key="`${thread.thread_id}-${i}`"
          class="muted"
        >
          {{ msg.role }}：{{ msg.body }}
        </p>
      </div>
    </section>
  </div>
  <StepChat :trace-id="traceId" step="audit" readonly :messages="chatLines" />
</template>
