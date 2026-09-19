<script setup lang="ts">
import type { RetrieveHitView } from "../../services/types";

const props = defineProps<{
  hit: RetrieveHitView;
}>();

/** Empty ledger text is shown as 无标题 / 无正文; never invent a heading or body. */
function headingText(): string {
  const value = props.hit.heading;
  return value && value.length > 0 ? value : "无标题";
}

function bodyText(): string {
  const value = props.hit.body;
  return value && value.length > 0 ? value : "无正文";
}
</script>

<template>
  <section class="card">
    <h2 class="card-title">{{ headingText() }}</h2>
    <p>{{ bodyText() }}</p>
  </section>
</template>
