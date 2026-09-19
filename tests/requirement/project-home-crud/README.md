# Requirement tests — project_home CRUD

验收点来源：`designs/v0/project_home/page.logic.md`（update/delete 约束）

## AC-1 重命名

- **后端**：`packages/core-engine/test/http-adapter.test.ts` → `PATCH/DELETE /api/projects and /api/packs` → rename project/pack
- **前端**：`apps/web/src/views/project_home/index.vue` → `renameProject` / `renamePack` 调用 PATCH

## AC-2 删除

- **后端**：同上 describe → delete empty project/pack，列表 GET 不再返回
- **前端**：`deleteProject` / `deletePack` 调用 DELETE + `load()`

## AC-3 冲突守卫

- **后端**：delete project with packs → 409；delete pack with job → 409
- **规范包重命名**：禁 公路/水利/房建（`updateSpecPack` + 前端 `renamePack`）

运行：`cd packages/core-engine && npm test -- http-adapter`
