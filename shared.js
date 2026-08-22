// shared.js — dùng chung giữa content.js (chạy trong tab AI chat) và
// options.js (trang cấu hình riêng). Định nghĩa cấu trúc dữ liệu Tool/Kit,
// giá trị mặc định, và các hàm đọc/ghi chrome.storage.local.
//
// LƯU Ý: file này khai báo các hàm/hằng số ở CẤP TOÀN CỤC (không bọc trong
// IIFE) — để content.js (tiêm cùng lúc qua files: ["shared.js","content.js"])
// và options.html (nạp qua <script src="shared.js">) đều dùng lại được.

// Bọc toàn bộ trong 1 khối canh giữ — vì file này có thể được TIÊM LẶP
// LẠI nhiều lần vào CÙNG 1 tab (mỗi lần chạy 1 Tool/Kit từ popup),
// nhưng isolated world của content script KHÔNG bị xoá giữa các lần
// tiêm (chỉ mất khi trang tải lại) — nếu không canh giữ, các dòng
// `const` bên dưới sẽ bị khai báo lại ở lần tiêm thứ 2 trở đi, gây lỗi
// "Identifier đã được khai báo" (SyntaxError, làm hỏng toàn bộ script).
if (!window.__aicfSharedLoaded) {
  window.__aicfSharedLoaded = true;

// ============================================================
// LƯU TRỮ — dùng chrome.storage.SYNC (không phải local) để Tool/Kit tự
// đồng bộ giữa các máy cùng đăng nhập 1 tài khoản Google/Chrome. Đổi từ
// local sang sync đòi hỏi thiết kế lại cách lưu vì sync có giới hạn ngặt:
//   - QUOTA_BYTES_PER_ITEM: 8.192 byte/MỖI MỤC (không phải tổng)
//   - QUOTA_BYTES: 102.400 byte tổng, MAX_ITEMS: 512
// Nếu gộp cả mảng Tool/Kit vào 1 mục duy nhất như bản cũ (storage.local),
// chỉ cần vài Tool có prompt dài hoặc icon ảnh upload là vượt 8KB ngay.
// Giải pháp: mỗi Tool/Kit lưu THÀNH 1 MỤC RIÊNG (key = id), cộng thêm 1
// mục "thứ tự" nhỏ gọn (chỉ chứa danh sách id) để biết thứ tự hiển thị.
// Icon dạng ẢNH upload (data:image/...) khá nặng (có thể 2-8KB tuỳ ảnh) —
// giữ riêng trong storage.LOCAL (không đồng bộ được, xem README), phần
// còn lại của Tool/Kit (tên, prompt...) vẫn đồng bộ qua sync bình thường.
// ============================================================

const AICF_ORDER_KEYS = { TOOLS: "aicf_tool_order", KITS: "aicf_kit_order" };
function aicfToolKey(id) { return `aicf_tool_${id}`; }
function aicfKitKey(id) { return `aicf_kit_${id}`; }
function aicfLocalIconKey(id) { return `aicf_icon_${id}`; }

// 3 Tool có sẵn khi cài lần đầu — {filename} sẽ được thay bằng tên file đã
// gắn tiền tố "<tên-hội-thoại>-<domain>_" ngay trước khi gửi (xem
// computeFinalFilename trong content.js).
const AICF_DEFAULT_TOOLS = [
  {
    id: "tool-summary",
    icon: "📝",
    name: "Summary AI Chat",
    promptTemplate: "Hãy tóm tắt toàn bộ nội dung trao đổi trong thread này, lưu ra file {filename} và đưa cho tôi tải về.",
    targetFilename: "1-summary.docx",
  },
  {
    id: "tool-extract",
    icon: "📊",
    name: "Extract AI Chat Data",
    promptTemplate:
      "Hãy trích các bảng (table) và các số liệu ở từng mục trong cuộc trò chuyện này ra 1 file Excel tên là {filename}, " +
      "sao cho mỗi bảng hoặc số liệu ở mỗi mục nằm trên một sheet riêng biệt, rồi đưa cho tôi tải về.",
    targetFilename: "2-data.xlsx",
  },
  {
    id: "tool-download",
    icon: "📎",
    name: "Download AI Chat Files",
    promptTemplate:
      "Liệt kê tất cả các file bạn đã tạo ra trong cuộc trò chuyện này (không bao gồm các file {filename} nếu có), " +
      "rồi gộp tất cả các file đó vào 1 file duy nhất tên là {filename} và đưa cho tôi tải về.",
    targetFilename: "3-files.zip",
  },
];

// 2 Kit có sẵn — thứ tự toolIds là thứ tự sẽ ghép vào prompt gộp.
const AICF_DEFAULT_KITS = [
  {
    id: "kit-export-full",
    icon: "🚀",
    name: "Export AI Chat Full",
    toolIds: ["tool-summary", "tool-extract", "tool-download"],
  },
  {
    id: "kit-summary-full",
    icon: "📚",
    name: "Summary AI Chat Full",
    toolIds: ["tool-summary", "tool-extract"],
  },
];

// Thứ tự hiện trên menu popup: Kit "Export Full" -> Kit "Summary Full" ->
// Tool 1 -> Tool 2 -> Tool 3 (đúng yêu cầu, không tự sắp xếp lại).
function aicfGenId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Đọc danh sách theo đúng thứ tự lưu, tự động ghép icon ảnh (nếu có) từ
// storage.local vào lại object trước khi trả về — phần code gọi hàm này
// (content.js/options.js) không cần biết gì về việc tách sync/local.
async function aicfLoadEntities(orderKey, keyFn, defaults, saveFn) {
  const orderRes = await chrome.storage.sync.get(orderKey);
  const order = orderRes[orderKey];
  if (!Array.isArray(order) || order.length === 0) {
    await saveFn(defaults);
    return defaults.slice();
  }
  const itemKeys = order.map(keyFn);
  const itemsRes = await chrome.storage.sync.get(itemKeys);
  const iconKeys = order.map(aicfLocalIconKey);
  const localIconsRes = await chrome.storage.local.get(iconKeys).catch(() => ({}));
  const list = [];
  for (const id of order) {
    const item = itemsRes[keyFn(id)];
    if (!item) continue; // mục bị thiếu (vd. lỗi đồng bộ giữa chừng) — bỏ qua thay vì crash
    const localIcon = localIconsRes[aicfLocalIconKey(id)];
    list.push(localIcon ? { ...item, icon: localIcon } : item);
  }
  return list;
}

// Ghi danh sách: mỗi entity thành 1 mục sync riêng + 1 mục "thứ tự". Icon
// dạng ảnh tách ra lưu ở local (không đồng bộ), thay bằng icon placeholder
// trong bản ghi sync để các máy khác vẫn hiển thị được gì đó hợp lý. Nếu
// 1 mục (thường do prompt quá dài) vượt quá 8KB, KHÔNG làm mất dữ liệu —
// tự động lưu mục đó vào local thay vì sync, và báo cho người dùng biết
// qua giá trị trả về (mảng tên các mục không đồng bộ được).
async function aicfSaveEntities(entities, orderKey, keyFn, iconFallback) {
  const oldOrderRes = await chrome.storage.sync.get(orderKey);
  const oldOrder = oldOrderRes[orderKey] || [];
  const newOrder = entities.map((e) => e.id);
  const removedIds = oldOrder.filter((id) => !newOrder.includes(id));

  const localWrites = {};
  const localRemoveKeys = removedIds.map(aicfLocalIconKey);
  const syncRemoveKeys = removedIds.map(keyFn);
  const notSynced = [];

  if (syncRemoveKeys.length) await chrome.storage.sync.remove(syncRemoveKeys).catch(() => {});

  for (const entity of entities) {
    const isImageIcon = typeof entity.icon === "string" && entity.icon.startsWith("data:image/");
    const toSync = { ...entity };
    if (isImageIcon) {
      localWrites[aicfLocalIconKey(entity.id)] = entity.icon;
      toSync.icon = iconFallback; // máy khác chưa có ảnh sẽ thấy icon mặc định này
    } else {
      localRemoveKeys.push(aicfLocalIconKey(entity.id));
    }
    try {
      await chrome.storage.sync.set({ [keyFn(entity.id)]: toSync });
    } catch (err) {
      // Rất có thể do vượt QUOTA_BYTES_PER_ITEM (8KB) — thường gặp với
      // prompt rất dài. Không làm mất dữ liệu: lưu tạm vào local (chỉ máy
      // này thấy được) thay vì đồng bộ, và báo lại cho người gọi biết.
      await chrome.storage.local.set({ [keyFn(entity.id)]: toSync }).catch(() => {});
      notSynced.push(entity.name || entity.id);
    }
  }
  await chrome.storage.sync.set({ [orderKey]: newOrder });
  if (localRemoveKeys.length) await chrome.storage.local.remove(localRemoveKeys).catch(() => {});
  if (Object.keys(localWrites).length) await chrome.storage.local.set(localWrites).catch(() => {});
  return notSynced;
}

async function aicfLoadTools() {
  const synced = await aicfLoadEntities(AICF_ORDER_KEYS.TOOLS, aicfToolKey, AICF_DEFAULT_TOOLS, aicfSaveTools);
  // Bù các mục từng bị rơi xuống local (vượt 8KB) — vẫn hiện đủ trên MÁY
  // NÀY, chỉ là không đồng bộ được sang máy khác.
  const order = (await chrome.storage.sync.get(AICF_ORDER_KEYS.TOOLS))[AICF_ORDER_KEYS.TOOLS] || [];
  const missingIds = order.filter((id) => !synced.find((t) => t.id === id));
  if (missingIds.length) {
    const localFallback = await chrome.storage.local.get(missingIds.map(aicfToolKey)).catch(() => ({}));
    for (const id of missingIds) {
      const item = localFallback[aicfToolKey(id)];
      if (item) synced.splice(order.indexOf(id), 0, item);
    }
  }
  return synced;
}
async function aicfSaveTools(tools) {
  return aicfSaveEntities(tools, AICF_ORDER_KEYS.TOOLS, aicfToolKey, "🔧");
}
async function aicfLoadKits() {
  const synced = await aicfLoadEntities(AICF_ORDER_KEYS.KITS, aicfKitKey, AICF_DEFAULT_KITS, aicfSaveKits);
  const order = (await chrome.storage.sync.get(AICF_ORDER_KEYS.KITS))[AICF_ORDER_KEYS.KITS] || [];
  const missingIds = order.filter((id) => !synced.find((k) => k.id === id));
  if (missingIds.length) {
    const localFallback = await chrome.storage.local.get(missingIds.map(aicfKitKey)).catch(() => ({}));
    for (const id of missingIds) {
      const item = localFallback[aicfKitKey(id)];
      if (item) synced.splice(order.indexOf(id), 0, item);
    }
  }
  return synced;
}
async function aicfSaveKits(kits) {
  return aicfSaveEntities(kits, AICF_ORDER_KEYS.KITS, aicfKitKey, "🧩");
}

function aicfEscapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Gán tường minh vào window — vì các hàm trên nằm TRONG khối canh giữ
// (block scope), nếu không gán tường minh thì content.js/options.js/
// popup.js (chạy sau, ở "file"/script khác) sẽ không đọc được các tên này
// dù cùng chung 1 global scope của trang/tab. Chỉ export đúng những gì
// thật sự được dùng ở nơi khác — phần còn lại là chi tiết nội bộ.
window.aicfGenId = aicfGenId;
window.aicfLoadTools = aicfLoadTools;
window.aicfSaveTools = aicfSaveTools;
window.aicfLoadKits = aicfLoadKits;
window.aicfSaveKits = aicfSaveKits;
window.aicfEscapeHtml = aicfEscapeHtml;
}
