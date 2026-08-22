// supabase-sync.js — đăng nhập Google (qua chrome.identity.launchWebAuthFlow,
// KHÔNG cần đăng ký extension với Google Cloud Console — Supabase xử lý
// toàn bộ phần OAuth với Google ở phía server của họ) và đồng bộ Tool/Kit
// lên bảng "aicf_configs" trên Supabase. Chỉ chạy trong context trang
// Options (không tiêm vào content.js — sync cloud chỉ cần làm ở đây).
//
// Yêu cầu: đã điền AICF_SUPABASE_URL + AICF_SUPABASE_ANON_KEY trong
// supabase-config.js, VÀ đã bật Google trong Supabase Authentication →
// Providers (xem README phần "Thiết lập Supabase").

const AICF_AUTH_STORAGE_KEY = "aicf_auth"; // { accessToken, refreshToken, expiresAt } — chỉ ở local, KHÔNG đồng bộ (token nhạy cảm)

function aicfSupabaseConfigured() {
  return !!(AICF_SUPABASE_URL && AICF_SUPABASE_ANON_KEY);
}

// ============================================================
// Đăng nhập / đăng xuất
// ============================================================
async function aicfSignInWithGoogle() {
  const redirectUri = chrome.identity.getRedirectURL(); // https://<extension-id>.chromiumapp.org/
  // Lưu ý: URL này dùng để ĐIỀU HƯỚNG TRÌNH DUYỆT TRỰC TIẾP (qua
  // chrome.identity.launchWebAuthFlow), không phải fetch() nên KHÔNG set
  // header tuỳ chỉnh được — vì vậy apikey bắt buộc phải nằm trong query
  // string, khác với các lời gọi fetch() khác bên dưới (dùng header).
  const authUrl =
    `${AICF_SUPABASE_URL}/auth/v1/authorize?provider=google` +
    `&apikey=${encodeURIComponent(AICF_SUPABASE_ANON_KEY)}` +
    `&redirect_to=${encodeURIComponent(redirectUri)}`;

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (url) => {
      if (chrome.runtime.lastError || !url) reject(new Error(chrome.runtime.lastError?.message || "Đăng nhập bị huỷ hoặc không có phản hồi."));
      else resolve(url);
    });
  });

  // Supabase trả token trong PHẦN HASH của URL redirect, dạng:
  // https://<ext-id>.chromiumapp.org/#access_token=...&refresh_token=...&expires_in=3600&...
  const hash = new URL(responseUrl).hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const expiresIn = Number(params.get("expires_in") || 3600);
  if (!accessToken) throw new Error("Không nhận được access token từ Supabase — kiểm tra lại đã bật Google trong Authentication → Providers chưa.");

  await chrome.storage.local.set({
    [AICF_AUTH_STORAGE_KEY]: { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 },
  });
  return accessToken;
}

async function aicfSignOut() {
  await chrome.storage.local.remove(AICF_AUTH_STORAGE_KEY);
}

async function aicfGetStoredAuth() {
  const res = await chrome.storage.local.get(AICF_AUTH_STORAGE_KEY);
  return res[AICF_AUTH_STORAGE_KEY] || null;
}

// Tự làm mới access token nếu đã/sắp hết hạn (chừa 60 giây) — Supabase
// access token thường sống 1 giờ.
async function aicfGetValidAccessToken() {
  const auth = await aicfGetStoredAuth();
  if (!auth) return null;
  if (auth.expiresAt - Date.now() > 60_000) return auth.accessToken;
  if (!auth.refreshToken) return null;

  const res = await fetch(`${AICF_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: AICF_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: auth.refreshToken }),
  });
  if (!res.ok) { await aicfSignOut(); return null; } // refresh token cũng hết hạn/bị thu hồi -> coi như đăng xuất
  const data = await res.json();
  await chrome.storage.local.set({
    [AICF_AUTH_STORAGE_KEY]: { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 },
  });
  return data.access_token;
}

async function aicfGetSupabaseUser(accessToken) {
  const res = await fetch(`${AICF_SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: AICF_SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  return res.json(); // { id, email, ... }
}

// ============================================================
// Đồng bộ config (đẩy lên / kéo về) — bảng "aicf_configs", xem SQL trong
// README để tạo bảng + Row Level Security (mỗi user chỉ đọc/ghi được đúng
// hàng của chính mình).
// ============================================================
async function aicfPushConfigToCloud(tools, kits) {
  const accessToken = await aicfGetValidAccessToken();
  if (!accessToken) throw new Error("Chưa đăng nhập.");
  const user = await aicfGetSupabaseUser(accessToken);
  if (!user) throw new Error("Không xác thực được người dùng — thử đăng nhập lại.");

  const res = await fetch(`${AICF_SUPABASE_URL}/rest/v1/aicf_configs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: AICF_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates", // upsert theo khoá chính user_id
    },
    body: JSON.stringify([{ user_id: user.id, tools, kits, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) throw new Error(`Đẩy config lên cloud thất bại (HTTP ${res.status}): ${await res.text()}`);
}

async function aicfPullConfigFromCloud() {
  const accessToken = await aicfGetValidAccessToken();
  if (!accessToken) throw new Error("Chưa đăng nhập.");
  const user = await aicfGetSupabaseUser(accessToken);
  if (!user) throw new Error("Không xác thực được người dùng — thử đăng nhập lại.");

  const res = await fetch(`${AICF_SUPABASE_URL}/rest/v1/aicf_configs?user_id=eq.${user.id}&select=tools,kits,updated_at`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: AICF_SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new Error(`Kéo config từ cloud thất bại (HTTP ${res.status}): ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null; // null nếu tài khoản này chưa từng đẩy config nào lên
}
