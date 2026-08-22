// options.js — chạy trên trang options.html (context trang bình thường,
// có đầy đủ quyền chrome.storage, không cần message qua content script).

let tools = [];
let kits = [];
let editingToolId = null; // null = đang thêm mới
let editingKitId = null;
let kitDraftToolIds = []; // danh sách tool đã chọn (có thứ tự) khi đang sửa/thêm 1 Kit

// icon lưu trong Tool/Kit chủ yếu là emoji (chuỗi ngắn) — form giờ chỉ cho
// chọn qua bảng emoji có sẵn (đã bỏ upload ảnh riêng). Vẫn giữ khả năng
// NHẬN DIỆN đúng nếu 1 Tool/Kit cũ từng có icon dạng ảnh (data URL) từ
// trước khi bỏ tính năng này, để không vỡ hiển thị dữ liệu cũ.
function isImageIcon(icon) {
  return typeof icon === "string" && icon.startsWith("data:image/");
}
function renderIconHtml(icon, fallback) {
  const value = icon || fallback;
  return isImageIcon(value) ? `<img src="${value}" alt="" />` : aicfEscapeHtml(value);
}

const EMOJI_PALETTE = [
  "📝", "📊", "📎", "📄", "📋", "🗂️", "📌", "🔖",
  "✨", "🚀", "📚", "🧩", "🔧", "⚙️", "💡", "🎯",
  "📥", "📤", "🔍", "📈", "📉", "💾", "🗃️", "📁",
  "🏷️", "📃", "📑", "🧾", "🗒️", "📔", "🧮", "🖇️",
];

// Gắn logic chọn icon (emoji popover) cho 1 modal (Tool hoặc Kit) — dùng
// chung 1 hàm cho cả 2 vì thao tác giống hệt nhau.
function setupIconPicker(prefix, onChange) {
  const preview = document.getElementById(`${prefix}-icon-preview`);
  const hiddenInput = document.getElementById(`${prefix}-icon`);
  const emojiBtn = document.getElementById(`${prefix}-emoji-btn`);
  const emojiPopover = document.getElementById(`${prefix}-emoji-popover`);

  if (emojiPopover.childElementCount === 0) {
    emojiPopover.innerHTML = EMOJI_PALETTE.map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join("");
  }

  function setIcon(value) {
    hiddenInput.value = value;
    preview.innerHTML = renderIconHtml(value, "🔧");
    if (onChange) onChange(value);
  }

  emojiBtn.onclick = () => emojiPopover.classList.toggle("open");
  emojiPopover.querySelectorAll("[data-emoji]").forEach((btn) => {
    btn.onclick = () => {
      setIcon(btn.getAttribute("data-emoji"));
      emojiPopover.classList.remove("open");
    };
  });
  document.addEventListener("click", (e) => {
    if (!emojiPopover.contains(e.target) && e.target !== emojiBtn) emojiPopover.classList.remove("open");
  });

  return { setIcon };
}

async function init() {
  tools = await aicfLoadTools();
  kits = await aicfLoadKits();
  renderTools();
  renderKits();
  await renderSyncCard();
}

// ============================================================
// CLOUD SYNC (Supabase — tuỳ chọn, ẩn hoàn toàn nếu chưa cấu hình)
// ============================================================
async function renderSyncCard() {
  const card = document.getElementById("sync-card");
  const text = document.getElementById("sync-text");
  const btn = document.getElementById("sync-action-btn");
  if (!aicfSupabaseConfigured()) {
    card.style.display = "none";
    return;
  }
  card.style.display = "flex";

  const auth = await aicfGetStoredAuth();
  if (!auth) {
    text.innerHTML = `<span class="sync-status-dot off"></span>Not signed in — Tools/Kits only sync via your Chrome account, not across different Google accounts.`;
    btn.textContent = "Sign in with Google";
    btn.onclick = onSignInClick;
    return;
  }
  const user = await aicfGetSupabaseUser(auth.accessToken).catch(() => null);
  if (!user) {
    text.innerHTML = `<span class="sync-status-dot off"></span>Signed in, but session expired — please sign in again.`;
    btn.textContent = "Sign in with Google";
    btn.onclick = onSignInClick;
    return;
  }
  text.innerHTML = `<span class="sync-status-dot on"></span>Synced as <b>${aicfEscapeHtml(user.email || "")}</b> — Tools/Kits saved changes are pushed to the cloud automatically.`;
  btn.textContent = "Sign out";
  btn.onclick = onSignOutClick;
}

async function onSignInClick() {
  const btn = document.getElementById("sync-action-btn");
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    await aicfSignInWithGoogle();
    await renderSyncCard();

    // QUAN TRỌNG: phân biệt rõ "pull lỗi" (mạng, hết hạn token...) với
    // "pull thành công nhưng cloud trống" — 2 trường hợp XỬ LÝ KHÁC NHAU.
    // Lỗi 1 lần đã từng khiến local (mặc định) bị đẩy đè lên cloud một
    // cách ÂM THẦM — tuyệt đối không lặp lại kiểu xử lý đó nữa.
    let cloud;
    try {
      cloud = await aicfPullConfigFromCloud();
    } catch (pullErr) {
      alert(
        "Signed in, but could NOT check your cloud config (network or auth issue): " + (pullErr.message || pullErr) +
        "\n\nYour LOCAL Tools/Kits on this device were NOT changed, and NOTHING was pushed to the cloud " +
        "— to avoid accidentally overwriting your real cloud data. Try again (e.g. reload this page) once the issue is resolved."
      );
      return; // dừng hẳn — không push, không đổi gì cả
    }

    if (cloud && (cloud.tools?.length || cloud.kits?.length)) {
      // Dùng modal riêng trong trang (không phải confirm() của trình duyệt)
      // — đã gặp thực tế trình duyệt CHẶN hộp thoại confirm() thứ 2 nếu gọi
      // liên tiếp quá nhanh, khiến người dùng không có cách chọn "giữ máy
      // này, ghi đè cloud". Modal riêng không có giới hạn này.
      await showSyncConflictModal(cloud);
    } else {
      // Pull THÀNH CÔNG và xác nhận cloud thật sự chưa có gì — an toàn để
      // đẩy config hiện tại lên làm bản đầu tiên.
      await aicfPushConfigToCloud(tools, kits);
    }
  } catch (err) {
    alert("Sign-in failed: " + (err.message || err));
  } finally {
    btn.disabled = false;
    await renderSyncCard();
  }
}

// Hiện modal cho người dùng chọn: tải từ cloud / giữ máy này (ghi đè cloud)
// / không làm gì. Trả về Promise, resolve khi người dùng đã xử lý xong.
function showSyncConflictModal(cloud) {
  return new Promise((resolve) => {
    const backdrop = document.getElementById("sync-conflict-backdrop");
    backdrop.classList.add("open");

    const loadBtn = document.getElementById("sync-conflict-load-btn");
    const pushBtn = document.getElementById("sync-conflict-push-btn");
    const cancelBtn = document.getElementById("sync-conflict-cancel-btn");

    function cleanup() {
      backdrop.classList.remove("open");
      loadBtn.onclick = null;
      pushBtn.onclick = null;
      cancelBtn.onclick = null;
    }

    loadBtn.onclick = async () => {
      tools = cloud.tools || [];
      kits = cloud.kits || [];
      await aicfSaveTools(tools);
      await aicfSaveKits(kits);
      renderTools();
      renderKits();
      cleanup();
      resolve();
    };
    pushBtn.onclick = async () => {
      await aicfPushConfigToCloud(tools, kits);
      cleanup();
      alert("Pushed your local Tools/Kits to the cloud.");
      resolve();
    };
    cancelBtn.onclick = () => {
      cleanup();
      resolve();
    };
  });
}

async function onSignOutClick() {
  await aicfSignOut();
  await renderSyncCard();
}

// Đẩy config lên cloud sau mỗi lần lưu (nếu đã đăng nhập) — debounce nhẹ để
// không gửi request liên tục khi có nhiều thay đổi liền nhau (ví dụ vừa
// sửa Tool vừa sắp xếp lại thứ tự). Đây là đẩy dữ liệu người dùng VỪA TỰ
// SỬA (không phải dữ liệu mặc định) nên lỗi ở đây không có rủi ro ghi đè
// nhầm — nhưng vẫn cần BÁO RÕ trên giao diện (không chỉ console.error, dễ
// bị bỏ sót) để người dùng biết sync đang không hoạt động.
let aicfPushTimer = null;
function scheduleCloudPush() {
  if (!aicfSupabaseConfigured()) return;
  clearTimeout(aicfPushTimer);
  aicfPushTimer = setTimeout(async () => {
    const auth = await aicfGetStoredAuth();
    if (!auth) return;
    try {
      await aicfPushConfigToCloud(tools, kits);
      renderSyncCard(); // cập nhật lại trạng thái "đã đồng bộ" bình thường
    } catch (err) {
      console.error("[aicf] Cloud push failed:", err);
      const text = document.getElementById("sync-text");
      if (text) text.innerHTML = `<span class="sync-status-dot off"></span>⚠️ Last cloud sync failed: ${aicfEscapeHtml(err.message || String(err))} — your local changes are still saved on this device.`;
    }
  }, 800);
}

// Bọc 2 hàm lưu gốc (shared.js) để LUÔN kèm theo việc đẩy lên cloud khi có
// thay đổi — dùng thay cho aicfSaveTools/aicfSaveKits trực tiếp trong toàn
// bộ file này (content.js không cần biết gì về cloud, chỉ options.js).
async function saveToolsLocal(newTools) {
  const notSynced = await aicfSaveTools(newTools);
  scheduleCloudPush();
  return notSynced;
}
async function saveKitsLocal(newKits) {
  const notSynced = await aicfSaveKits(newKits);
  scheduleCloudPush();
  return notSynced;
}

// ============================================================
// RENDER
// ============================================================
function renderTools() {
  const list = document.getElementById("tools-list");
  if (tools.length === 0) {
    list.innerHTML = `<div class="empty-hint">No tools yet — add one below.</div>`;
    return;
  }
  list.innerHTML = tools.map((t, i) => {
    const enabled = t.enabled !== false; // mặc định bật nếu chưa có trường này (dữ liệu cũ)
    return `
    <div class="item-row ${enabled ? "" : "disabled"}">
      <label class="toggle-switch" title="${enabled ? "Shown" : "Hidden"} in the popup menu">
        <input type="checkbox" data-act="toggle" data-id="${t.id}" ${enabled ? "checked" : ""} />
        <span class="toggle-slider"></span>
      </label>
      <span class="item-icon">${renderIconHtml(t.icon, "🔧")}</span>
      <div class="item-main">
        <div class="item-name">${aicfEscapeHtml(t.name)}</div>
        <div class="item-sub">${aicfEscapeHtml(t.targetFilename || "")}</div>
      </div>
      <div class="item-actions">
        <button class="icon-btn" data-act="up" data-id="${t.id}" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
        <button class="icon-btn" data-act="down" data-id="${t.id}" ${i === tools.length - 1 ? "disabled" : ""} title="Move down">↓</button>
        <button class="icon-btn" data-act="edit-tool" data-id="${t.id}" title="Edit">✎</button>
        <button class="icon-btn danger" data-act="delete-tool" data-id="${t.id}" title="Delete">✕</button>
      </div>
    </div>
  `;
  }).join("");
  list.querySelectorAll('[data-act]:not([data-act="toggle"])').forEach((btn) => btn.addEventListener("click", onToolRowAction));
  list.querySelectorAll('[data-act="toggle"]').forEach((cb) => cb.addEventListener("change", onToolToggle));
}

function renderKits() {
  const list = document.getElementById("kits-list");
  if (kits.length === 0) {
    list.innerHTML = `<div class="empty-hint">No kits yet — add one below.</div>`;
    return;
  }
  list.innerHTML = kits.map((k, i) => {
    const enabled = k.enabled !== false;
    return `
    <div class="item-row ${enabled ? "" : "disabled"}">
      <label class="toggle-switch" title="${enabled ? "Shown" : "Hidden"} in the popup menu">
        <input type="checkbox" data-act="toggle" data-id="${k.id}" ${enabled ? "checked" : ""} />
        <span class="toggle-slider"></span>
      </label>
      <span class="item-icon round">${renderIconHtml(k.icon, "🧩")}</span>
      <div class="item-main">
        <div class="item-name">${aicfEscapeHtml(k.name)}</div>
        <div class="item-sub">${k.toolIds.length} tool${k.toolIds.length === 1 ? "" : "s"}: ${k.toolIds.map(idToToolName).join(" → ")}</div>
      </div>
      <div class="item-actions">
        <button class="icon-btn" data-act="up" data-id="${k.id}" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
        <button class="icon-btn" data-act="down" data-id="${k.id}" ${i === kits.length - 1 ? "disabled" : ""} title="Move down">↓</button>
        <button class="icon-btn" data-act="edit-kit" data-id="${k.id}" title="Edit">✎</button>
        <button class="icon-btn danger" data-act="delete-kit" data-id="${k.id}" title="Delete">✕</button>
      </div>
    </div>
  `;
  }).join("");
  list.querySelectorAll('[data-act]:not([data-act="toggle"])').forEach((btn) => btn.addEventListener("click", onKitRowAction));
  list.querySelectorAll('[data-act="toggle"]').forEach((cb) => cb.addEventListener("change", onKitToggle));
}

async function onToolToggle(e) {
  const id = e.currentTarget.getAttribute("data-id");
  const tool = tools.find((t) => t.id === id);
  if (!tool) return;
  tool.enabled = e.currentTarget.checked;
  await saveToolsLocal(tools);
  renderTools();
}
async function onKitToggle(e) {
  const id = e.currentTarget.getAttribute("data-id");
  const kit = kits.find((k) => k.id === id);
  if (!kit) return;
  kit.enabled = e.currentTarget.checked;
  await saveKitsLocal(kits);
  renderKits();
}

function idToToolName(id) {
  const t = tools.find((x) => x.id === id);
  return t ? t.name : "(deleted tool)";
}

// ============================================================
// TOOL: thao tác trên danh sách (lên/xuống/sửa/xoá)
// ============================================================
async function onToolRowAction(e) {
  const btn = e.currentTarget;
  const id = btn.getAttribute("data-id");
  const act = btn.getAttribute("data-act");
  const idx = tools.findIndex((t) => t.id === id);
  if (idx === -1) return;

  if (act === "up" && idx > 0) {
    [tools[idx - 1], tools[idx]] = [tools[idx], tools[idx - 1]];
    await saveToolsLocal(tools);
    renderTools();
  } else if (act === "down" && idx < tools.length - 1) {
    [tools[idx + 1], tools[idx]] = [tools[idx], tools[idx + 1]];
    await saveToolsLocal(tools);
    renderTools();
  } else if (act === "edit-tool") {
    openToolModal(tools[idx]);
  } else if (act === "delete-tool") {
    if (!confirm(`Delete tool "${tools[idx].name}"? Any kit using it will have it removed too.`)) return;
    tools.splice(idx, 1);
    await saveToolsLocal(tools);
    // dọn tham chiếu trong các Kit đang dùng tool này
    let kitsChanged = false;
    kits.forEach((k) => {
      const before = k.toolIds.length;
      k.toolIds = k.toolIds.filter((tid) => tid !== id);
      if (k.toolIds.length !== before) kitsChanged = true;
    });
    if (kitsChanged) await saveKitsLocal(kits);
    renderTools();
    renderKits();
  }
}

async function onKitRowAction(e) {
  const btn = e.currentTarget;
  const id = btn.getAttribute("data-id");
  const act = btn.getAttribute("data-act");
  const idx = kits.findIndex((k) => k.id === id);
  if (idx === -1) return;

  if (act === "up" && idx > 0) {
    [kits[idx - 1], kits[idx]] = [kits[idx], kits[idx - 1]];
    await saveKitsLocal(kits);
    renderKits();
  } else if (act === "down" && idx < kits.length - 1) {
    [kits[idx + 1], kits[idx]] = [kits[idx], kits[idx + 1]];
    await saveKitsLocal(kits);
    renderKits();
  } else if (act === "edit-kit") {
    openKitModal(kits[idx]);
  } else if (act === "delete-kit") {
    if (!confirm(`Delete kit "${kits[idx].name}"?`)) return;
    kits.splice(idx, 1);
    await saveKitsLocal(kits);
    renderKits();
  }
}

// ============================================================
// MODAL: Add/Edit Tool
// ============================================================
function openToolModal(tool) {
  editingToolId = tool ? tool.id : null;
  document.getElementById("tool-modal-title").textContent = tool ? "Edit Tool" : "Add Tool";
  toolIconPicker.setIcon(tool ? tool.icon : "📝");
  document.getElementById("tool-name").value = tool ? tool.name : "";
  document.getElementById("tool-prompt").value = tool ? tool.promptTemplate : "";
  document.getElementById("tool-filename").value = tool ? tool.targetFilename : "";
  document.getElementById("tool-modal-backdrop").classList.add("open");
}
function closeToolModal() {
  document.getElementById("tool-modal-backdrop").classList.remove("open");
}
async function saveToolFromModal() {
  const name = document.getElementById("tool-name").value.trim();
  const promptTemplate = document.getElementById("tool-prompt").value.trim();
  const targetFilename = document.getElementById("tool-filename").value.trim(); // tuỳ chọn — có thể để trống
  const icon = document.getElementById("tool-icon").value || "📝";
  if (!name || !promptTemplate) {
    alert("Please fill in name and prompt.");
    return;
  }
  // Không còn bắt buộc/cảnh báo về {filename} — nhiều prompt (ví dụ prompt
  // nhập vai/persona) không hề tạo ra file nào cả, đó
  // là điều bình thường, không phải lỗi cần xác nhận lại.
  // (targetFilename chỉ dùng để thay vào chỗ {filename} trong prompt —
  // extension không tự tải file nào cả nên không cần đoán mimeType nữa.)

  if (editingToolId) {
    const t = tools.find((x) => x.id === editingToolId);
    Object.assign(t, { name, promptTemplate, targetFilename, icon });
  } else {
    tools.push({ id: aicfGenId("tool"), icon, name, promptTemplate, targetFilename, enabled: true });
  }
  const notSynced = await saveToolsLocal(tools);
  renderTools();
  closeToolModal();
  if (notSynced.length) {
    alert(`Saved, but too large to sync across devices (over 8KB): ${notSynced.join(", ")}. It's still saved on this device only — try a shorter prompt if you want it to sync.`);
  }
}

// ============================================================
// MODAL: Add/Edit Kit
// ============================================================
function openKitModal(kit) {
  editingKitId = kit ? kit.id : null;
  document.getElementById("kit-modal-title").textContent = kit ? "Edit Kit" : "Add Kit";
  kitIconPicker.setIcon(kit ? kit.icon : "🧩");
  document.getElementById("kit-name").value = kit ? kit.name : "";
  kitDraftToolIds = kit ? kit.toolIds.slice() : [];
  renderKitToolPicker();
  renderKitSelectedOrder();
  document.getElementById("kit-modal-backdrop").classList.add("open");
}
function closeKitModal() {
  document.getElementById("kit-modal-backdrop").classList.remove("open");
}
function renderKitToolPicker() {
  const box = document.getElementById("kit-tool-picker");
  if (tools.length === 0) {
    box.innerHTML = `<div class="empty-hint">No tools available — add a Tool first.</div>`;
    return;
  }
  box.innerHTML = tools.map((t) => `
    <label class="tool-picker-row">
      <input type="checkbox" data-tool-id="${t.id}" ${kitDraftToolIds.includes(t.id) ? "checked" : ""} />
      <span>${aicfEscapeHtml(t.icon)} ${aicfEscapeHtml(t.name)}</span>
    </label>
  `).join("");
  box.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.getAttribute("data-tool-id");
      if (cb.checked) {
        if (!kitDraftToolIds.includes(id)) kitDraftToolIds.push(id);
      } else {
        kitDraftToolIds = kitDraftToolIds.filter((x) => x !== id);
      }
      renderKitSelectedOrder();
    });
  });
}
function renderKitSelectedOrder() {
  const box = document.getElementById("kit-selected-order");
  if (kitDraftToolIds.length === 0) {
    box.innerHTML = `<div class="empty-hint">No tools selected yet.</div>`;
    return;
  }
  box.innerHTML = kitDraftToolIds.map((id, i) => `
    <div class="selected-order-row">
      <span>${i + 1}. ${aicfEscapeHtml(idToToolName(id))}</span>
      <span style="flex:1"></span>
      <button class="icon-btn" data-move="up" data-id="${id}" ${i === 0 ? "disabled" : ""}>↑</button>
      <button class="icon-btn" data-move="down" data-id="${id}" ${i === kitDraftToolIds.length - 1 ? "disabled" : ""}>↓</button>
    </div>
  `).join("");
  box.querySelectorAll("[data-move]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const dir = btn.getAttribute("data-move");
      const i = kitDraftToolIds.indexOf(id);
      if (dir === "up" && i > 0) [kitDraftToolIds[i - 1], kitDraftToolIds[i]] = [kitDraftToolIds[i], kitDraftToolIds[i - 1]];
      if (dir === "down" && i < kitDraftToolIds.length - 1) [kitDraftToolIds[i + 1], kitDraftToolIds[i]] = [kitDraftToolIds[i], kitDraftToolIds[i + 1]];
      renderKitSelectedOrder();
    });
  });
}
async function saveKitFromModal() {
  const name = document.getElementById("kit-name").value.trim();
  const icon = document.getElementById("kit-icon").value || "🧩";
  if (!name) { alert("Please enter a kit name."); return; }
  if (kitDraftToolIds.length === 0) { alert("Please select at least 1 tool for this kit."); return; }

  if (editingKitId) {
    const k = kits.find((x) => x.id === editingKitId);
    Object.assign(k, { name, icon, toolIds: kitDraftToolIds.slice() });
  } else {
    kits.push({ id: aicfGenId("kit"), icon, name, toolIds: kitDraftToolIds.slice(), enabled: true });
  }
  const notSynced = await saveKitsLocal(kits);
  renderKits();
  closeKitModal();
  if (notSynced.length) {
    alert(`Saved, but too large to sync across devices (over 8KB): ${notSynced.join(", ")}. It's still saved on this device only.`);
  }
}

// ============================================================
// Wire up buttons + khởi động
// ============================================================
const toolIconPicker = setupIconPicker("tool");
const kitIconPicker = setupIconPicker("kit");

document.getElementById("add-tool-btn").addEventListener("click", () => openToolModal(null));
document.getElementById("tool-cancel-btn").addEventListener("click", closeToolModal);
document.getElementById("tool-save-btn").addEventListener("click", saveToolFromModal);

document.getElementById("add-kit-btn").addEventListener("click", () => openKitModal(null));
document.getElementById("kit-cancel-btn").addEventListener("click", closeKitModal);
document.getElementById("kit-save-btn").addEventListener("click", saveKitFromModal);

// Tab Toolkits / About — chuyển panel hiển thị, không tải lại gì cả.
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

init();
