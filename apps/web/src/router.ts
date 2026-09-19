import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/jobs" },
  {
    path: "/projects",
    name: "project_home",
    component: () => import("./views/project_home/index.vue"),
  },
  {
    path: "/templates/:id/annotate",
    name: "template_annotate",
    component: () => import("./views/template_annotate/index.vue"),
  },
  {
    path: "/packs/:id/rules",
    name: "rule_editor",
    component: () => import("./views/rule_editor/index.vue"),
  },
  {
    path: "/packs/:id/standards",
    name: "standard_lib",
    component: () => import("./views/standard_lib/index.vue"),
  },
  {
    path: "/jobs",
    name: "job_upload",
    component: () => import("./views/job_upload/index.vue"),
  },
  {
    path: "/pending",
    name: "pending_review",
    component: () => import("./views/pending_review/index.vue"),
  },
  {
    path: "/jobs/:id/findings",
    name: "check_findings",
    component: () => import("./views/check_findings/index.vue"),
  },
  {
    path: "/jobs/:id/volume",
    name: "volume_preview",
    component: () => import("./views/volume_preview/index.vue"),
  },
  {
    path: "/audit/:traceId",
    name: "audit_trace",
    component: () => import("./views/audit_trace/index.vue"),
  },
  {
    path: "/internal/agent-runtime",
    name: "agent_runtime_control",
    component: () => import("./views/agent_runtime_control/index.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  linkActiveClass: "active",
  linkExactActiveClass: "active",
});
