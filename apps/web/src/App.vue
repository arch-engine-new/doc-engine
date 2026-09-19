<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { demoNav, ensureDemoSession, loadDemoNav } from "./services/demo-session";

const route = useRoute();

const links = computed(() => {
  const templateTo = demoNav.templateId ? `/templates/${demoNav.templateId}/annotate` : "/projects";
  const rulesTo = demoNav.packId ? `/packs/${demoNav.packId}/rules` : "/projects";
  const standardsTo = demoNav.packId ? `/packs/${demoNav.packId}/standards` : "/projects";
  const volumeTo = demoNav.jobId ? `/jobs/${demoNav.jobId}/volume` : "/jobs";
  const auditTo = demoNav.traceId ? `/audit/${demoNav.traceId}` : "/jobs";
  return [
    { to: "/projects", label: "项目", match: (path: string) => path.startsWith("/projects") },
    { to: templateTo, label: "模板", match: (path: string) => path.includes("/annotate") },
    { to: rulesTo, label: "规则", match: (path: string) => path.endsWith("/rules") },
    { to: standardsTo, label: "标准库", match: (path: string) => path.endsWith("/standards") },
    { to: "/jobs", label: "任务", match: (path: string) => path === "/jobs" },
    { to: "/pending", label: "待审", match: (path: string) => path.startsWith("/pending") },
    { to: "/jobs", label: "检查", match: (path: string) => path.includes("/findings") },
    { to: volumeTo, label: "组卷", match: (path: string) => path.includes("/volume") },
    { to: auditTo, label: "审计", match: (path: string) => path.startsWith("/audit") },
  ];
});

onMounted(() => {
  loadDemoNav();
  void ensureDemoSession().catch(() => {
    /* page-level loaders surface API errors */
  });
});
</script>

<template>
  <nav class="app-nav">
    <span class="brand">工程资料核心引擎</span>
    <RouterLink
      v-for="link in links"
      :key="link.label"
      :to="link.to"
      :class="{ active: link.match(route.path) }"
    >
      {{ link.label }}
    </RouterLink>
  </nav>
  <RouterView />
</template>
