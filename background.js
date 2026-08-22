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

// ============================================================
// Bật/tắt icon extension theo đúng tab đang xem — chỉ bật (bấm được, mở
// được popup.html) khi tab hiện tại là 1 trong SUPPORTED_HOSTS, tắt (xám
// đi, không bấm được, không hiện popup) với mọi trang khác. Cần khai báo
// host_permissions cho đúng các domain trong SUPPORTED_HOSTS (xem
// manifest.json) để tab.url có giá trị trong các sự kiện dưới đây — với
// tab KHÔNG thuộc các domain đó, url sẽ rỗng (không có quyền đọc), tự
// động rơi vào nhánh "disable" — đúng ý muốn, không cần quyền "tabs" rộng
// hơn.
// ============================================================
function isSupportedHostname(hostname) {
  return !!hostname && SUPPORTED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
}

// Trong lúc 1 tab đang điều hướng, chrome.tabs.onUpdated bắn ra NHIỀU lần
// liên tiếp (loading rồi complete) — mỗi lần đều gọi hàm này. Vì
// chrome.action.enable()/disable() chạy bất đồng bộ và không được xếp
// hàng, 1 lệnh gọi CŨ (ứng với URL cũ/tạm thời lúc đang tải) có thể
// resolve SAU 1 lệnh gọi MỚI hơn (ứng với URL thật sự cuối cùng) và ghi
// đè nhầm kết quả — đây chính là lỗi đã gặp: rời trang trắng (disabled)
// sang gmail.com lại bị bật nhầm. Khắc phục bằng 1 số thứ tự riêng cho
// từng tab: mỗi lần gọi tăng số thứ tự lên, và CHỈ lệnh gọi có số thứ tự
// MỚI NHẤT (tại thời điểm chuẩn bị ghi kết quả) mới được phép thật sự gọi
// enable/disable — kết quả từ các lệnh gọi cũ hơn bị âm thầm bỏ qua dù
// chúng có resolve muộn cỡ nào. Đồng thời luôn đọc lại chrome.tabs.get()
// mới nhất ngay tại thời điểm áp dụng thay vì tin vào đối tượng "tab" mà
// sự kiện truyền vào (có thể đã là ảnh chụp cũ do đua thời điểm sự kiện).
const aicfActionSeq = new Map(); // tabId -> số thứ tự lần gọi gần nhất

async function updateActionForTab(tabId) {
  if (typeof tabId !== "number") return;
  const seq = (aicfActionSeq.get(tabId) || 0) + 1;
  aicfActionSeq.set(tabId, seq);

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    return; // tab đã đóng giữa chừng
  }
  if (aicfActionSeq.get(tabId) !== seq) return; // đã có lần gọi mới hơn, kết quả này đã lỗi thời — bỏ qua

  let hostname = "";
  try {
    hostname = tab.url ? new URL(tab.url).hostname : "";
  } catch (e) { /* url không hợp lệ (vd. chrome://...) — coi như không hỗ trợ */ }
  try {
    if (isSupportedHostname(hostname)) {
      await chrome.action.enable(tabId);
    } else {
      await chrome.action.disable(tabId);
    }
  } catch (e) { /* tab đã đóng giữa chừng — bỏ qua */ }
}

async function updateAllTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => updateActionForTab(tab.id)));
}

// Mặc định TẮT cho mọi tab mới/chưa từng xét tới (vd. tab vừa mở, trước
// khi kịp điều hướng) — chỉ tab nào khớp SUPPORTED_HOSTS mới được bật lại
// qua updateActionForTab bên dưới.
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable();
  updateAllTabs();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.action.disable();
  updateAllTabs();
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  updateActionForTab(tabId);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") updateActionForTab(tabId);
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

  if (!isSupportedHostname(hostname)) {
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
