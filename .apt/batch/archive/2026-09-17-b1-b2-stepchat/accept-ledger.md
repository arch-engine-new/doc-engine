# APT accept 台账

B-1 → B-1 → 未配置 llm.json 时助手不得以 [fake-llm 回显系统提示，须中文说明未配置；标准库对话不得展示无关 Job 的 fixture-reversed.json/findings；按收敛记录复现步骤达期望态 → packages/core-engine/test/（片内复现测试，feature 步先红后绿沉淀） → pending-acceptance（AI 自答）
B-2 → B-2 → 缺 llm.json 时回退 arch.config.json chat（glm-5.3-flash），createLlmProvider 不得落到 FakeLlmProvider；回复不以 [fake-llm 开头；loader 读取 chat 字段 → packages/agent-runtime/test/arch-chat-fallback.test.ts → pending-acceptance（inbox 已确认）
