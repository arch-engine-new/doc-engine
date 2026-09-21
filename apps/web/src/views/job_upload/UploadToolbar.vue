<script setup lang="ts">
import { ref } from "vue";
import type { SkillCandidateView, SkillSummaryView } from "../../services/types";
import { joinSummaryLine } from "./skillConfirm";

const EMPTY_SUMMARY = "摘要未出";

defineProps<{
  canUploadSkill: boolean;
  canDryRun: boolean;
  canConfirm: boolean;
  fileTag: string;
  summary: SkillSummaryView | null;
  candidates: SkillCandidateView[];
  selectedSkillId: string;
}>();

const emit = defineEmits<{
  uploadFile: [file: File];
  dryRun: [];
  confirmSkill: [];
  "update:selectedSkillId": [value: string];
}>();

const skillFile = ref<HTMLInputElement | null>(null);

function openSkillPicker(): void {
  skillFile.value?.click();
}

function onFileChange(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  emit("uploadFile", file);
}
</script>

<template>
  <section class="card">
    <h2 class="card-title">表 Skill（默认）</h2>
    <p class="row-actions">
      <button class="btn" :disabled="!canUploadSkill" type="button" @click="openSkillPicker">
        上传资料
      </button>
      <input
        ref="skillFile"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.xlsx,application/pdf,image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        :disabled="!canUploadSkill"
        @change="onFileChange"
      />
      <span class="tag">{{ fileTag }}</span>
    </p>
    <p class="row-actions">
      <label class="filter-label">
        索引候选
        <select
          :value="selectedSkillId"
          @change="emit('update:selectedSkillId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">未点选（多条时确认会 409）</option>
          <option v-for="row in candidates" :key="row.skill_id" :value="row.skill_id">
            {{ row.canonical_name }}
          </option>
        </select>
      </label>
    </p>
    <aside class="skill-summary">
      <p class="muted">引擎摘要（来自草稿 JSON，不是最后一句聊天）</p>
      <p><strong>表名 / 别名</strong> — {{ joinSummaryLine(summary?.names, EMPTY_SUMMARY) }}</p>
      <p><strong>检查项</strong> — {{ joinSummaryLine(summary?.check_labels, EMPTY_SUMMARY) }}</p>
      <p><strong>会怎么修</strong> — {{ joinSummaryLine(summary?.fix_plain, EMPTY_SUMMARY) }}</p>
    </aside>
    <p class="row-actions">
      <button class="btn ghost" type="button" :disabled="!canDryRun" @click="emit('dryRun')">试跑</button>
      <button class="btn" type="button" :disabled="!canConfirm" @click="emit('confirmSkill')">
        确认完成并处理
      </button>
    </p>
    <p class="muted">试跑不写索引、不写台账。对话不能代替确认。rule_editor 的 DSL 闸门仍有效。</p>
  </section>
</template>

<style scoped>
.skill-summary {
  margin-top: 12px;
  padding: 12px 14px;
  background: var(--apt-surface);
  border: 1px solid var(--apt-border);
  border-radius: var(--apt-radius-md);
}
</style>
