<script setup lang="ts">
import type { EffectiveFieldBoxView } from "../../services/types";

defineProps<{
  inheritedFields: EffectiveFieldBoxView[];
}>();
</script>

<template>
  <aside class="annotate-side">
    <h2 class="card-title">继承基字段</h2>
    <p class="muted">来自 DocType 字段定义，标注页不可编辑。</p>
    <table>
      <thead>
        <tr>
          <th>field_key</th>
          <th>value_type</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="field in inheritedFields" :key="field.field_key">
          <td>{{ field.field_key }}</td>
          <td>{{ field.value_type }}</td>
        </tr>
        <tr v-if="inheritedFields.length === 0">
          <td colspan="2" class="muted">无继承基字段。可在项目页编辑 DocType 基字段。</td>
        </tr>
      </tbody>
    </table>
  </aside>
</template>

<style scoped>
.annotate-side {
  border-right: 1px solid var(--apt-border);
  padding-right: 12px;
}
.muted {
  color: var(--apt-text-muted);
  font-size: 13px;
}
</style>
