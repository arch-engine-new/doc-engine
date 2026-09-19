<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { errorMessage, http } from "../services/http";

interface ChatLine {
  role: "user" | "assistant";
  body: string;
}

/** Minimal RetrieveHit fields for /api/chat pack context (not Job findings). */
interface StepChatHit {
  clause_id: string | null;
  unit_id: string;
  file_name: string;
}

interface StepChatProps {
  traceId?: string;
  packId?: string;
  step: string;
  readonly?: boolean;
  messages?: ChatLine[];
  hits?: StepChatHit[];
}

const props = withDefaults(defineProps<StepChatProps>(), {
  readonly: false,
  messages: () => [],
  hits: () => [],
});

const body = ref("");
const log = ref<ChatLine[]>([]);
const error = ref("");
const sending = ref(false);

const HITL_FALLBACK =
  "已记下（HITL）。本步对话不写 Receipt、不提交、不取消 blocking，也不推进 Job 状态。确认下一步请用页面上的独立按钮。";

const canSend = computed(() => Boolean(props.traceId || props.packId));

const stepNote = computed(() => {
  const notes: Record<string, string> = {
    uploaded: "文件已上传。可以问识别策略；同意后才进入质检。",
    inspecting: "质检结果可追问。同意后才进入抽取。",
    extracting: "可就抽取 JSON 提问。同意后才进入规则检查。",
    checking: "可问不合哪条、下一步做什么。对话不能取消 blocking。",
    pending: "可改检查意见措辞。确认提案才出 Receipt，不能在对话里确认。",
    pending_review: "可改检查意见措辞。确认提案才出 Receipt，不能在对话里确认。",
    previewed: "可讨论分组。提交不对认知层开放。",
    check_findings: "可就本份抽取/Finding 提问。对话不能取消 blocking。",
    configure: "可问如何建空规范包。对话不预置公路/水利/房建条文。",
    project_home: "可问如何建空规范包。对话不预置公路/水利/房建条文。",
    annotate: "可问该框字段含义。保存 FieldBox 必须点页面按钮，对话不能保存。",
    template_annotate: "可问该框字段含义。保存 FieldBox 必须点页面按钮，对话不能保存。",
    rule_draft: "口语只生成 DSL 草稿，不能直接 publish。",
    rule_editor: "口语只生成 DSL 草稿，不能直接 publish。",
    retrieve: "可就命中条款/引用链提问。对话不写条款号、不替代硬规则。",
    standard_lib: "可就命中条款/引用链提问。对话不写条款号、不替代硬规则。",
    volume_preview: "可讨论分组。对话不能 submit。",
    audit: "只读回放本步对话。审计页不发送会改变结论的语句。",
  };
  return notes[props.step] ?? "可以就本页结果提问。HITL 不写库、不跳过硬规则、不 submit。";
});

function seed() {
  if (props.readonly) {
    log.value = props.messages.length > 0 ? [...props.messages] : [{ role: "assistant", body: stepNote.value }];
    return;
  }
  log.value = [{ role: "assistant", body: stepNote.value }];
}

watch(
  () => [props.traceId, props.packId, props.step, props.readonly, props.messages],
  () => {
    seed();
    error.value = "";
  },
  { deep: true },
);

onMounted(() => {
  document.body.classList.add("has-step-chat");
  seed();
});

onUnmounted(() => {
  document.body.classList.remove("has-step-chat");
});

async function send() {
  error.value = "";
  if (props.readonly) return;
  if (!canSend.value) {
    error.value = "需要 pack_id 或 trace_id 才能发送本步对话";
    return;
  }
  const text = body.value.trim();
  if (!text) return;
  sending.value = true;
  const traceId = props.traceId || (props.packId ? `pack:${props.packId}` : "");
  try {
    const res = (await http("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        trace_id: traceId,
        pack_id: props.packId,
        step: props.step,
        body: text,
        hits: props.hits,
      }),
    })) as { assistant_reply?: string };
    log.value.push({ role: "user", body: text });
    log.value.push({
      role: "assistant",
      body: res.assistant_reply?.trim() || HITL_FALLBACK,
    });
    body.value = "";
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    sending.value = false;
  }
}

/** Enter 发送；Shift+Enter 换行（常见聊天框习惯）。 */
function onInputKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  void send();
}
</script>

<template>
  <aside class="step-chat" aria-label="本步对话">
    <div class="step-chat-head">
      <strong>本步对话</strong>
      <span class="tag">{{ step }}</span>
      <div class="step-chat-meta">step={{ step }}</div>
      <div class="step-chat-meta">{{ traceId || packId || "尚无 trace_id" }}</div>
    </div>
    <p class="step-chat-note">
      <template v-if="readonly">只读。审计页不发送会改变结论的对话。</template>
      <template v-else>HITL 仅落消息，不确认提案、不发布、不提交、不取消 blocking、不保存标注框。</template>
    </p>
    <div class="step-chat-log">
      <div
        v-for="(msg, i) in log"
        :key="i"
        class="step-chat-msg"
        :class="msg.role === 'user' ? 'user' : 'assistant'"
      >
        {{ msg.body }}
      </div>
    </div>
    <p v-if="error" class="step-chat-note">{{ error }}</p>
    <form v-if="!readonly" class="step-chat-form" @submit.prevent="send">
      <textarea
        v-model="body"
        rows="3"
        placeholder="就本步提问…（Enter 发送，Shift+Enter 换行）"
        @keydown="onInputKeydown"
      />
      <button class="btn" type="submit" :disabled="!canSend || sending">发送</button>
    </form>
  </aside>
</template>
