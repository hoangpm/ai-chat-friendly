// popup.js — chạy trong popup gốc của trình duyệt (KHÔNG có quyền truy
// cập DOM của trang AI chat trực tiếp — chỉ hiện danh sách rồi gửi lệnh
// cho background.js xử lý tiêm content script + chạy đúng Tool/Kit đã
// chọn trên tab đang mở).

function renderIconHtml(icon, fallback) {
  const value = icon || fallback;
  return typeof value === "string" && value.startsWith("data:image/")
    ? `<img src="${value}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" />`
    : aicfEscapeHtml(value);
}

async function init() {
  // Chỉ hiện Tool/Kit KHÔNG bị ẩn (enabled !== false — mặc định coi là
  // hiện nếu dữ liệu cũ chưa có trường này). Ẩn/hiện chỉnh trong Options,
  // không phải xoá — vẫn còn nguyên trong storage, chỉ không hiện ở đây.
  const allTools = await aicfLoadTools();
  const allKits = await aicfLoadKits();
  const tools = allTools.filter((t) => t.enabled !== false);
  const kits = allKits.filter((k) => k.enabled !== false);
  const list = document.getElementById("list");

  if (tools.length === 0 && kits.length === 0) {
    const hint = allTools.length + allKits.length > 0
      ? "All your Tools/Kits are hidden — go to ⚙️ Options to show some."
      : "No Tools or Kits yet — add some in ⚙️ Options.";
    list.innerHTML = `<div class="empty-hint">${aicfEscapeHtml(hint)}</div>`;
    return;
  }

  const kitsHtml = kits.map((k) => `
    <button class="item-card" data-type="kit" data-id="${k.id}">
      <span class="item-icon round">${renderIconHtml(k.icon, "🧩")}</span>
      <span class="item-text">
        <div class="item-title">${aicfEscapeHtml(k.name)}</div>
        <div class="item-desc">${k.toolIds.length} tool${k.toolIds.length === 1 ? "" : "s"} chained</div>
      </span>
      <span class="item-arrow">›</span>
    </button>`).join("");
  const toolsHtml = tools.map((t) => `
    <button class="item-card" data-type="tool" data-id="${t.id}">
      <span class="item-icon">${renderIconHtml(t.icon, "🔧")}</span>
      <span class="item-text">
        <div class="item-title">${aicfEscapeHtml(t.name)}</div>
      </span>
      <span class="item-arrow">›</span>
    </button>`).join("");

  list.innerHTML =
    (kits.length ? `<div class="section-label">Kits</div>${kitsHtml}` : "") +
    (tools.length ? `<div class="section-label">Tools</div>${toolsHtml}` : "");

  list.querySelectorAll(".item-card").forEach((card) => {
    card.addEventListener("click", async () => {
      const type = card.getAttribute("data-type");
      const id = card.getAttribute("data-id");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.runtime.sendMessage({ type: "aicf:run", tabId: tab.id, itemType: type, itemId: id });
      }
      window.close(); // đóng popup ngay — không cần chờ hay hiện tiến trình gì cả
    });
  });
}

document.getElementById("options-link").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

init();
