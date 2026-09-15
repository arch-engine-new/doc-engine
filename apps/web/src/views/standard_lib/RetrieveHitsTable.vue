<script setup lang="ts">
import type { DictItem } from "../../services/http";
import type { RetrieveHitView } from "../../services/types";

defineProps<{
  hits: RetrieveHitView[];
  pathDict: DictItem[];
  dictLabel: (items: DictItem[], value: string) => string;
}>();

/** Layout units are not clauses; the citation column must stay empty-looking. */
function clauseLabel(hit: RetrieveHitView): string {
  if (hit.chunk_kind === "table" || hit.chunk_kind === "annex" || hit.clause_id == null) {
    return "—";
  }
  return hit.clause_id;
}

function pageLabel(hit: RetrieveHitView): string {
  if (hit.page_start === hit.page_end) return String(hit.page_start);
  return `${hit.page_start}–${hit.page_end}`;
}

function hitKey(hit: RetrieveHitView): string {
  return `${hit.unit_id}-${hit.retrieve_path}-${hit.page_start}-${hit.page_end}`;
}
</script>

<template>
  <table>
    <thead>
      <tr>
        <th>file_name</th>
        <th>页</th>
        <th>unit_id</th>
        <th>clause_id</th>
        <th>路径</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="hit in hits" :key="hitKey(hit)">
        <td>{{ hit.file_name }}</td>
        <td>{{ pageLabel(hit) }}</td>
        <td>{{ hit.unit_id }}</td>
        <td>{{ clauseLabel(hit) }}</td>
        <td>
          <span class="tag">{{ dictLabel(pathDict, hit.retrieve_path) }}</span>
        </td>
      </tr>
      <tr v-if="hits.length === 0">
        <td colspan="5">尚无命中。入库后检索条款号或问句。</td>
      </tr>
    </tbody>
  </table>
</template>
