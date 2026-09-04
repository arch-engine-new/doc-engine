<script setup lang="ts">
import { RouterLink } from "vue-router";
import { dictLabel, type DictItem } from "../../services/http";
import type { JobView, ProposalView } from "../../services/types";

defineProps<{
  proposals: ProposalView[];
  jobs: JobView[];
  statusDict: DictItem[];
  selected: ProposalView | null;
  wording: string;
  busy: boolean;
  tagClass: (status: string) => string;
}>();

const emit = defineEmits<{
  select: [row: ProposalView];
  "update:wording": [value: string];
  saveWording: [];
  confirm: [];
}>();
</script>

<template>
  <section class="card">
    <table>
      <thead>
        <tr>
          <th>提案</th>
          <th>Job</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in proposals"
          :key="row.proposal_id"
          class="clickable"
          :class="{ 'is-selected': selected?.proposal_id === row.proposal_id }"
          @click="emit('select', row)"
        >
          <td>{{ row.proposal_id }}</td>
          <td>
            <RouterLink :to="`/jobs/${row.job_id}/findings`">{{ row.job_id }}</RouterLink>
          </td>
          <td>
            <span class="tag" :class="tagClass(row.status)">{{ dictLabel(statusDict, row.status) }}</span>
          </td>
        </tr>
        <tr v-if="proposals.length === 0">
          <td colspan="3">暂无待审提案。可从检查页「同意进入待审」，或运行颠倒夹具后重置演示。</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section v-if="selected" class="card">
    <p>建议措辞（可改）：</p>
    <textarea
      :value="wording"
      class="wording-box"
      rows="3"
      @input="emit('update:wording', ($event.target as HTMLTextAreaElement).value)"
    />
    <div class="row-actions">
      <button class="btn ghost" type="button" :disabled="busy" @click="emit('saveWording')">保存措辞</button>
      <button class="btn" type="button" :disabled="busy" @click="emit('confirm')">确认并开 Receipt</button>
    </div>
  </section>
</template>
