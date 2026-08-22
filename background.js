// background.js — service worker (Manifest V3)
// Từ khi có popup.html (default_popup), bấm icon KHÔNG còn kích hoạt
// chrome.action.onClicked nữa (Chrome tự hiểu: đã có popup thì luôn mở
// popup, sự kiện onClicked không bao giờ bắn ra) — nên toàn bộ việc tiêm
// content script + chạy Tool/Kit giờ khởi động từ 1 MESSAGE do popup.js
// gửi tới đây, sau khi người dùng đã chọn xong trong popup.

const SUPPORTED_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "chat.qwen.ai",
  "chat.deepseek.com",
  "chat.z.ai",
  "gemini.google.com",
  "grok.com",
  "kimi.ai",
  "manus.im",
  "meta.ai",
];

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "aicf:open-options") {
    chrome.runtime.openOptionsPage();
    return;
  }
  if (message?.type === "aicf:run" && message.tabId) {
    handleRun(message.tabId, message.itemType, message.itemId);
  }
});

async function handleRun(tabId, itemType, itemId) {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    return; // tab đã đóng giữa chừng
  }
  if (!tab.url) return;
  let hostname = "";
  try {
    hostname = new URL(tab.url).hostname;
  } catch (e) {
    return;
  }

  if (!SUPPORTED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h))) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => alert("This extension doesn't support this site yet — please open a supported AI chat (ChatGPT, Claude, Gemini, Grok, DeepSeek, Qwen, Z.ai, Kimi, Manus, Meta AI) and try again."),
    });
    return;
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["shared.js", "content.js"] });
    // Gửi lệnh NGAY sau khi tiêm xong — content.js đăng ký sẵn listener
    // đồng bộ ngay đầu file (trước mọi await) nên chắc chắn đã sẵn sàng
    // nhận message vào đúng lúc executeScript() resolve xong.
    await chrome.tabs.sendMessage(tabId, { type: "aicf:start", itemType, itemId });
  } catch (err) {
    console.error("Could not run AI Chat Friendly:", err);
  }
}
