// content.js — được tiêm cùng shared.js NGAY SAU KHI người dùng chọn 1
// Tool/Kit trong popup (menu nằm trong popup.html, không phải ở đây).
// background.js tiêm xong sẽ gửi ngay message {type:"aicf:start",
// itemType, itemId} — content.js chỉ cần gửi ĐÚNG 1 tin nhắn (prompt của
// Tool, hoặc prompt gộp của cả Kit) vào ô nhập chat rồi DỪNG LẠI.
//
// KHÔNG chờ phản hồi, KHÔNG tìm/tải tệp đính kèm, KHÔNG hiện UI tiến
// trình gì cả — việc AI thực hiện prompt là chuyện của chính cuộc trò
// chuyện đó, extension không cần theo dõi hay can thiệp gì thêm sau khi
// đã gửi xong tin nhắn.

// QUAN TRỌNG: script này có thể được TIÊM LẶP LẠI nhiều lần vào CÙNG 1 tab
// (mỗi lần bấm icon 1 Tool/Kit khác) — isolated world của content script
// KHÔNG bị huỷ giữa các lần tiêm (chỉ mất khi trang tải lại). Vì vậy bọc
// TOÀN BỘ file (không chỉ phần đăng ký listener) trong 1 khối canh giữ —
// nếu không, các dòng `const` bên dưới sẽ bị khai báo lại ở lần tiêm thứ 2
// trở đi, gây lỗi thật đã gặp: SyntaxError "Identifier đã được khai báo",
// làm hỏng toàn bộ script. Không cần export gì ra window ở đây (khác
// shared.js) vì không có file nào khác gọi tới nội dung bên trong.
if (!window.__aicfContentLoaded) {
  window.__aicfContentLoaded = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "aicf:start") return;
    if (window.__aiChatFriendlyBusy) {
      console.warn("[aicf] " + "A run is already in progress on this page — please wait for it to finish.");
      return;
    }
    window.__aiChatFriendlyBusy = true;
    runItem(message.itemType, message.itemId).finally(() => {
      window.__aiChatFriendlyBusy = false;
    });
  });

// ============================================================
// Cấu hình theo từng nền tảng + tiện ích cơ bản (giữ nguyên, đã kiểm
// chứng qua MHTML thật / test trực tiếp — xem README).
// ============================================================
  function slugify(str) {
    let s = (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    s = s.replace(/đ/g, "d").replace(/Đ/g, "D");
    s = s.toLowerCase();
    s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || "chat";
  }
  function getConversationTitle() {
    return (document.title || "chat").replace(/\s*[-–]\s*ChatGPT\s*$/i, "").trim();
  }
  // Tiền tố tự động gắn vào MỌI tên file trước khi gửi trong prompt và khi
  // lưu về máy — dạng "<tên-hội-thoại-đã-slug>-<domain>_<tên-file-gốc>".
  function computeFinalFilename(baseFilename) {
    return `${slugify(getConversationTitle())}-${location.hostname}_${baseFilename}`;
  }

  const PLATFORM_INPUT_SELECTORS = {
    "chatgpt.com": "#prompt-textarea",
    "chat.openai.com": "#prompt-textarea",
    "claude.ai": '[data-testid="chat-input"]',
    "gemini.google.com": '[aria-label="Enter a prompt for Gemini"]',
    "chat.qwen.ai": "textarea.message-input-textarea",
    "chat.deepseek.com": 'textarea[placeholder="Message DeepSeek"]',
    "chat.z.ai": "#chat-input",
    "www.kimi.ai": '.chat-input-editor[role="textbox"]',
    "kimi.ai": '.chat-input-editor[role="textbox"]',
    "manus.im": ".tiptap.ProseMirror",
    "www.meta.ai": '[data-testid="composer-input"]',
    "grok.com": '[aria-label="Ask Grok anything"]',
  };
  const PLATFORM_SEND_SELECTORS = {
    "chatgpt.com": '[data-testid="send-button"]',
    "chat.openai.com": '[data-testid="send-button"]',
    "claude.ai": '[data-testid="chat-input-send"]',
    "gemini.google.com": 'button[aria-label="Send message"]',
    "chat.qwen.ai": 'button[aria-label="Send"]',
    "chat.z.ai": "#send-message-button",
    "www.kimi.ai": ".send-button-container",
    "kimi.ai": ".send-button-container",
    "www.meta.ai": '[data-testid="composer-send-button"]',
    // chat.deepseek.com, manus.im, grok.com: không có selector nút gửi ổn
    // định (class tự sinh / nút chỉ hiện khi có chữ) — dùng phím Enter.
  };

  // ============================================================
  // Chờ trang yên tĩnh trước khi gửi (đề phòng AI vẫn đang viết dở phản
  // hồi trước đó), tìm ô nhập chat/nút gửi, gửi tin — không còn theo dõi
  // gì SAU khi gửi nữa (không chờ phản hồi, không tìm/tải tệp đính kèm).
  // ============================================================
  function getStreamingSignal() {
    return document.body.textContent.length;
  }
  async function waitForStreamingToFinish() {
    let prev = getStreamingSignal();
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 700));
      const cur = getStreamingSignal();
      if (cur === prev) return;
      prev = cur;
    }
  }

  function findChatInput() {
    const known = PLATFORM_INPUT_SELECTORS[location.hostname];
    const candidates = [
      ...(known ? [() => document.querySelector(known)] : []),
      () => document.querySelector("#prompt-textarea"),
      () => document.querySelector('div[contenteditable="true"][role="textbox"]'),
      () => document.querySelector('form textarea:not([disabled])'),
      () => document.querySelector('form [contenteditable="true"]'),
      () => document.querySelector('textarea:not([disabled])'),
      () => document.querySelector('[contenteditable="true"]'),
    ];
    for (const get of candidates) {
      try {
        const el = get();
        if (el) return el;
      } catch (e) { /* thử mẫu tiếp theo */ }
    }
    return null;
  }
  function findSendButton() {
    const known = PLATFORM_SEND_SELECTORS[location.hostname];
    const candidates = [
      ...(known ? [() => document.querySelector(known)] : []),
      () => document.querySelector('[data-testid="send-button"]'),
      () => document.querySelector('button[aria-label*="Send" i]'),
      () => document.querySelector('button[aria-label*="Gửi" i]'),
      () => document.querySelector('button[type="submit"]'),
    ];
    for (const get of candidates) {
      try {
        const el = get();
        if (el && !el.disabled) return el;
      } catch (e) { /* thử mẫu tiếp theo */ }
    }
    return null;
  }
  async function sendChatMessage(text) {
    const input = findChatInput();
    if (!input) { console.warn("[ai-chat-friendly] Chat input not found."); return false; }
    input.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
    await new Promise((r) => setTimeout(r, 300));
    const sendBtn = findSendButton();
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
    } else {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 500));
    return true;
  }

  // ============================================================
  // QUY TRÌNH CHÍNH — chỉ gửi đúng 1 (hoặc 1 prompt gộp) tin nhắn vào ô
  // nhập chat rồi DỪNG LẠI. Không chờ phản hồi, không tìm/tải file — việc
  // đó để AI tự làm trong chính cuộc trò chuyện, extension không theo dõi.
  // ============================================================
  async function runItem(itemType, itemId) {
    await waitForStreamingToFinish();
    const tools = await aicfLoadTools();
    if (itemType === "tool") {
      const tool = tools.find((t) => t.id === itemId);
      if (!tool) { console.warn("[aicf] Tool no longer exists."); return; }
      await runSingleToolFlow(tool);
    } else if (itemType === "kit") {
      const kits = await aicfLoadKits();
      const kit = kits.find((k) => k.id === itemId);
      if (!kit) { console.warn("[aicf] Kit no longer exists."); return; }
      await runKitFlow(kit, tools);
    }
  }

  async function runSingleToolFlow(tool) {
    const prompt = tool.targetFilename
      ? tool.promptTemplate.split("{filename}").join(computeFinalFilename(tool.targetFilename))
      : tool.promptTemplate;
    const sent = await sendChatMessage(prompt);
    if (!sent) console.warn(`[aicf] "${tool.name}": could not find the chat input box on this page.`);
  }

  // Gộp prompt của mọi Tool trong Kit thành 1 tin nhắn duy nhất, gửi 1 lần.
  async function runKitFlow(kit, allTools) {
    const kitTools = kit.toolIds.map((id) => allTools.find((t) => t.id === id)).filter(Boolean);
    if (kitTools.length === 0) { console.warn(`[aicf] Kit "${kit.name}" has no valid tools.`); return; }

    const numberedParts = kitTools.map((t, i) => {
      const p = t.targetFilename
        ? t.promptTemplate.split("{filename}").join(computeFinalFilename(t.targetFilename))
        : t.promptTemplate;
      return `${i + 1}- ${p}`;
    });
    const combinedPrompt = `Hãy thực hiện các lệnh sau, lần lượt theo đúng thứ tự: ${numberedParts.join("; ")}.`;

    const sent = await sendChatMessage(combinedPrompt);
    if (!sent) console.warn(`[aicf] "${kit.name}": could not find the chat input box on this page.`);
  }
}
