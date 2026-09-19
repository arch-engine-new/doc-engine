/**
 * 本步对话：挂在 9 页工作台右侧，不新增路由。
 * 线程键 = trace_id + step。产出只进 HITL/Proposal，不写库。
 */
(function () {
  const step = document.body.getAttribute("data-step") || "idle";
  const trace = document.body.getAttribute("data-trace") || "trc_local";
  const STEP_LABEL = {
    configure: "配置",
    annotate: "标注",
    rule_draft: "规则草稿",
    retrieve: "标准检索",
    uploaded: "已上传",
    inspecting: "质检",
    extracting: "抽取/识别",
    checking: "规则检查",
    pending: "待审",
    previewed: "组卷预览",
    audit: "审计",
    idle: "本步",
  };
  const SEED = {
    extracting:
      "抽取结果：编号=SH-002，日期A=2026-08-20，日期B=2026-08-01。日期A晚于日期B。你可以问「这像哪条」或「下一步做什么」。",
    checking:
      "R2 blocking。命中 STD-FIX.4.2.1（v2024，图路径 CITES）。对话不能取消 blocking，只能解释、改措辞、确认是否进入待审。",
    pending:
      "本步可改检查意见措辞。确认后才出 Receipt。不能在对话里 submit 组卷。",
    retrieve:
      "可以自然语言问条款。命中后点表格行打开详情读 heading 与 body。对话须引用正文，不得只回 clause_id。复杂引用请切到图查询。",
    annotate: "可以问某个框该标成什么字段。保存框仍要你点「保存」。",
    rule_draft: "口语只能生成 DSL 草稿，正反例闸门通过才能发布。",
    previewed: "预览可讨论分组是否合理。提交按钮不对认知层开放。",
    inspecting: "质检通过/失败都可以问「要不要继续抽取」。同意后才进入下一步。",
    uploaded: "文件已上传。可以问识别策略，确认后进入质检。",
    configure: "可以问如何建空规范包。系统不预置公路条文。",
    audit: "只读本 trace 上各步对话摘要，不能在审计页改结论。",
  };

  document.body.classList.add("has-step-chat");

  const root = document.createElement("aside");
  root.className = "step-chat";
  root.setAttribute("aria-label", "本步对话");
  root.innerHTML =
    '<div class="step-chat-head">' +
    '<strong>本步对话</strong>' +
    '<span class="tag">' +
    (STEP_LABEL[step] || step) +
    "</span>" +
    '<div class="step-chat-meta">trace ' +
    trace +
    " · " +
    step +
    "</div>" +
    "</div>" +
    '<p class="step-chat-note">每步识别/检查后都可对话。不写库、不跳过硬规则、不 submit。同意「下一步」才推进。</p>' +
    '<div class="step-chat-log" id="step-chat-log"></div>' +
    '<form class="step-chat-form" id="step-chat-form">' +
    '<textarea name="q" rows="3" placeholder="用自然语言问本步结果，或说下一步怎么做…" required></textarea>' +
    '<button class="btn" type="submit">发送</button>' +
    "</form>";
  document.body.appendChild(root);

  const log = root.querySelector("#step-chat-log");
  function bubble(role, text) {
    const el = document.createElement("div");
    el.className = "step-chat-msg " + role;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  bubble("assistant", SEED[step] || "可以就本页结果提问，或确认是否进入下一步。");

  root.querySelector("#step-chat-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const box = e.target.q;
    const text = String(box.value || "").trim();
    if (!text) return;
    bubble("user", text);
    box.value = "";
    var reply =
      "已记下（HITL）。本步不会直接改抽取 JSON 或取消 blocking。若你确认下一步，中台才推进状态；正式落库仍要 Receipt。";
    var hit = window.__aptSelectedHit;
    if (step === "retrieve" && hit && hit.heading && hit.body) {
      reply =
        "引用「" +
        hit.heading +
        "」\n" +
        hit.body +
        "\n出处 " +
        hit.file_name +
        " · " +
        (hit.clause_id || "—") +
        " · " +
        hit.unit_id +
        "。不得只报 clause_id。";
    }
    bubble("assistant", reply);
  });
})();
