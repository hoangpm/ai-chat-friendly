# AI Chat Friendly

Extension Chrome cho phép tự cấu hình các **Tool** (1 prompt, chủ yếu để
trích/lưu thông tin từ 1 thread AI chat ra file) và gộp nhiều Tool thành
**Kit** (chạy gộp thành 1 tin nhắn, tải nhiều file cùng lúc). Đặt tên nhại
theo PrintFriendly — cùng tinh thần "1 nút bấm, chọn cách xuất, xong".

## Cài đặt

1. Mở `chrome://extensions` → bật **Developer mode** → **Load unpacked** →
   chọn thư mục `ai-chat-friendly/`.
2. Mở 1 hội thoại trên nền tảng AI chat được hỗ trợ, bấm icon extension.
3. Bảng hiện danh sách Kit + Tool — bấm 1 mục để chạy.

## Cấu trúc dữ liệu

- **Tool** = `{ icon, name, promptTemplate (có {filename}), targetFilename, mimeType }`
  — 1 prompt duy nhất (không tự dịch VI/EN như bản trước — muốn nhiều
  ngôn ngữ, tạo nhiều Tool riêng, ví dụ "Summary VI" / "Summary EN").
- **Kit** = `{ icon, name, toolIds: [...] }` — danh sách Tool theo đúng
  thứ tự sẽ ghép vào 1 tin nhắn.
- Lưu trong `chrome.storage.local` (khoá `aicf_tools`, `aicf_kits`) — cần
  quyền `storage` (mới thêm từ bản này).

## 3 Tool + 2 Kit có sẵn khi cài lần đầu

| # | Tool | File đích (gốc) |
|---|---|---|
| 1 | Summary AI Chat | `1-summary.docx` |
| 2 | Extract AI Chat Data | `2-data.xlsx` |
| 3 | Download AI Chat Files | `3-files.zip` |

| Kit | Gồm |
|---|---|
| Export AI Chat Full | Tool 1 + 2 + 3 |
| Summary AI Chat Full | Tool 1 + 2 |

**Thứ tự hiện trên popup** (cố định theo đúng yêu cầu, không tự sắp xếp):
Kit Export Full → Kit Summary Full → Tool 1 → Tool 2 → Tool 3.

## Đặt tên file tự động

Mọi tên file (base name khai báo trong Tool, ví dụ `1-summary.docx`) đều
được tự động gắn tiền tố trước khi đưa vào prompt VÀ khi lưu về máy:

```
<tên-hội-thoại-đã-bỏ-dấu-nối-gạch>-<domain>_<tên-file-gốc>
```

Ví dụ hội thoại "Giải pháp cho OPC" trên chatgpt.com, Tool "Summary" →
file cuối cùng: `giai-phap-cho-opc-chatgpt.com_1-summary.docx`.

## Vì sao Kit gộp thành 1 tin nhắn thay vì chạy tuần tự từng Tool?

Bản trước (không có Kit) đã cho thấy rõ: việc "chờ đúng lúc 1 lượt trả lời
kết thúc" là phần dễ lỗi nhất trong toàn bộ hệ thống (timing, ảo hoá DOM,
trang tự cuộn...). Chạy N Tool tuần tự nghĩa là chịu rủi ro đó N lần. Gộp
prompt của cả Kit thành 1 tin nhắn dạng:

> Hãy thực hiện các lệnh sau, lần lượt theo đúng thứ tự: 1- \<prompt Tool
> 1\>; 2- \<prompt Tool 2\>; ...

— chỉ cần gửi 1 lần, chờ 1 lần, rồi tìm NHIỀU file trong CÙNG 1 câu trả
lời (phân biệt file nào của Tool nào qua đuôi file mong đợi của từng
Tool). Đơn giản và chắc chắn hơn hẳn.

**Đánh đổi:** phụ thuộc vào việc AI có thực sự làm đúng và đủ N lệnh
trong 1 lượt trả lời hay không — với hội thoại phức tạp/nhiều bước, AI có
thể bỏ sót 1 lệnh nào đó. Bước tải sẽ báo rõ tải được bao nhiêu / mong đợi
bao nhiêu file (ví dụ "Downloaded 2/3 files") thay vì báo lỗi mơ hồ.

## Trang Options (⚙️ trong popup)

Toàn bộ việc thêm/sửa/xoá/sắp xếp Tool và Kit làm ở đây — **popup không
cho chỉnh sửa gì** (chỉ để chạy). Sắp xếp thứ tự bằng nút ↑/↓ (không làm
kéo-thả — phức tạp và dễ vỡ hơn nhiều trong phạm vi 1 trang cấu hình đơn
giản, nút mũi tên đã đủ dùng).

## Icon vuông (Tool) / tròn (Kit)

Theo đúng yêu cầu: icon của Tool hiển thị trong khung vuông bo nhẹ góc,
icon của Kit hiển thị trong khung tròn — giúp phân biệt nhanh "1 việc đơn"
và "1 nhóm việc" khi nhìn lướt qua danh sách.

## Nền tảng hỗ trợ

Kế thừa nguyên vẹn từ bản "AI Chat Summarizer & File Downloader": ChatGPT,
Claude, Gemini, Grok, DeepSeek, Qwen, Z.ai, Kimi, Manus, Meta AI — toàn bộ
selector đã kiểm chứng qua MHTML thật/test trực tiếp giữ nguyên không đổi,
chỉ thay đổi phần kiến trúc Tool/Kit và giao diện.

## Bản 4.1.0 — bộ chọn icon (emoji/upload ảnh) + polish giao diện

Xác nhận: phần lõi (chạy Tool/Kit) đã hoạt động đúng qua test thật. Cập
nhật lần này chỉ về UI/UX, không đổi logic chạy:

- **Bộ chọn icon mới** (trang Options, cả 2 modal Tool và Kit): ô xem
  trước + nút "Emoji" (bảng 32 emoji thường dùng, bấm chọn) + nút "Upload"
  (chọn ảnh riêng, tự động crop vuông + resize còn 64×64px trước khi lưu
  — giữ dung lượng `chrome.storage.local` ở mức tối thiểu, vài KB/icon).
  Icon giờ có thể là emoji HOẶC ảnh tuỳ chọn, tự nhận diện đúng cách hiển
  thị (ảnh dùng `<img>`, emoji dùng text) ở cả danh sách Options lẫn menu
  popup.
- **Polish giao diện**: bảng màu tinh tế hơn (đổ bóng nhẹ, gradient mờ ở
  header, transition mượt khi hover thẻ), đồng bộ phong cách giữa popup
  và trang Options.

## Bản 5.1.0 — bỏ tích hợp prompts.chat, giữ lại phần {filename} tuỳ chọn

Bản 5.0.0 từng thêm tính năng duyệt/nhập prompt từ kho `prompts.chat`
(github.com/f/prompts.chat) — theo yêu cầu, đã **gỡ bỏ hoàn toàn** tính
năng này (bớt 1 quyền `host_permissions`, bớt ~100 dòng code parser CSV
không còn dùng tới).

**Vẫn giữ lại**: tên file đích (`targetFilename`) của Tool giờ là **tuỳ
chọn** — không còn bắt buộc phải điền, và không còn cảnh báo nếu prompt
thiếu `{filename}`. Nếu 1 Tool không có tên file đích, quy trình chạy chỉ
còn 2 bước (gửi yêu cầu + chờ phản hồi), bỏ hẳn bước tải file. Thay đổi
này độc lập với việc tích hợp prompts.chat (vẫn hữu ích cho bất kỳ Tool
nào không tạo ra file, dù nhập tay hay từ nguồn khác).

## Bản 5.2.0 — Tool/Kit tự đồng bộ nhiều máy (chrome.storage.sync)

Theo yêu cầu: cấu hình Tool/Kit giờ dùng chung 1 tài khoản Chrome/Google sẽ
**tự đồng bộ giữa các máy** — không cần backend riêng, không cần đăng
nhập gì thêm ngoài chính Chrome đã đăng nhập sẵn.

**Cách hoạt động:** đổi từ `chrome.storage.local` sang `chrome.storage.sync`.
Nhưng `sync` có giới hạn ngặt hơn hẳn `local`:

| | `local` (bản cũ) | `sync` (bản này) |
|---|---|---|
| Tổng dung lượng | ~10MB | ~100KB |
| Giới hạn mỗi mục | không có | **8KB/mục** |
| Đồng bộ nhiều máy | ❌ | ✅ |

Giới hạn 8KB/mục là vấn đề thật nếu lưu cả mảng Tool/Kit gộp chung 1 mục
như thiết kế cũ (chỉ vài Tool có prompt dài hoặc icon ảnh upload là vượt
ngay). Đã thiết kế lại: **mỗi Tool/Kit lưu thành 1 mục sync riêng** (dễ
nằm gọn dưới 8KB hơn nhiều so với gộp chung), cộng 1 mục "thứ tự" nhỏ gọn
riêng để biết thứ tự hiển thị.

**Icon dạng ảnh upload không đồng bộ được** (giữ trong `storage.local`,
chỉ máy đó thấy) — vì ảnh khá nặng so với hạn mức 8KB, trong khi máy khác
vẫn thấy Tool/Kit đó bình thường, chỉ là icon hiện về emoji mặc định (🔧
cho Tool, 🧩 cho Kit) thay vì ảnh riêng bạn đã upload. Icon dạng emoji vẫn
đồng bộ bình thường (nhẹ, không vấn đề gì).

**Nếu 1 Tool/Kit có prompt quá dài (vượt 8KB, hiếm gặp):** không bị mất dữ
liệu — tự động lưu lại ở `storage.local` (chỉ máy này), kèm thông báo rõ
ràng ngay khi lưu, để bạn biết Tool/Kit đó cần rút gọn prompt nếu muốn nó
đồng bộ sang máy khác.

**Đã kiểm thử độc lập** bằng cách giả lập đúng `chrome.storage` (đúng giới
hạn 8KB/mục thật) trong Node — xác nhận cả 5 kịch bản: seed mặc định, sửa
lưu bình thường, icon ảnh tách đúng chỗ, prompt siêu dài không mất dữ liệu
(rơi xuống local), và xoá dọn sạch không sót mục nào.

## Bản 6.0.0 — Cloud Sync qua Supabase (đăng nhập Google)

Tool/Kit giờ có thể đồng bộ qua **tài khoản Google riêng của bạn** (không
phụ thuộc tài khoản Chrome/Google đang đăng nhập trình duyệt như
`chrome.storage.sync`) — dùng Supabase làm backend (miễn phí ở quy mô cá
nhân, không cần tự vận hành server).

**Tuỳ chọn, không bắt buộc:** nếu chưa cấu hình Supabase, khối "Cloud
Sync" ở đầu trang Options tự ẩn đi — mọi thứ khác chạy bình thường như
trước (Tool/Kit vẫn đồng bộ qua `chrome.storage.sync` theo tài khoản
Chrome, không cần đăng nhập gì thêm).

### Thiết lập (làm 1 lần)

**Bước 1 — Tạo project Supabase**
1. Vào [supabase.com](https://supabase.com) → tạo tài khoản (miễn phí) →
   **New project**.
2. Sau khi tạo xong, vào **Settings → API** → copy 2 giá trị:
   - **Project URL**
   - **Project API keys** → dòng **anon public** (KHÔNG copy dòng
     `service_role`)
3. Dán 2 giá trị đó vào file `supabase-config.js` (2 dòng `AICF_SUPABASE_URL`
   và `AICF_SUPABASE_ANON_KEY`).

**Bước 2 — Chạy SQL tạo bảng**
1. Vào **SQL Editor** → **New query**.
2. Dán toàn bộ nội dung file `supabase-schema.sql` (đi kèm extension) →
   **Run**.

**Bước 3 — Tạo Google OAuth Client (trên Google Cloud Console)**
1. Vào [Google Cloud Console](https://console.cloud.google.com) → tạo 1
   project (hoặc dùng project có sẵn) → **APIs & Services → Credentials**.
2. **Create Credentials → OAuth client ID** → chọn loại **Web application**.
3. Ở mục **Authorized redirect URIs**, dán ĐÚNG URL mà Supabase yêu cầu —
   xem ở Bước 4 bên dưới (Supabase hiển thị sẵn URL chính xác cần dán vào
   đây, không cần tự đoán).
4. Copy **Client ID** và **Client Secret** vừa tạo.

**Bước 4 — Bật Google trong Supabase**
1. Trong Supabase project → **Authentication → Providers → Google** →
   bật lên.
2. Trang này sẽ HIỆN SẴN đúng "Callback URL" cần dán vào Google Cloud
   Console ở Bước 3.3 — copy đúng URL đó (dạng
   `https://<project-ref>.supabase.co/auth/v1/callback`).
3. Dán **Client ID** + **Client Secret** (lấy ở Bước 3.4) vào ô tương ứng
   → **Save**.

**Bước 5 — Cho phép extension redirect về (QUAN TRỌNG, hay bị bỏ sót)**
1. Mở `chrome://extensions`, bật Developer mode, tìm ID của extension này
   (chuỗi ký tự dài dưới tên extension).
2. URL redirect của extension có dạng: `https://<ID-vừa-copy>.chromiumapp.org/`
3. Vào Supabase → **Authentication → URL Configuration → Redirect URLs**
   → thêm đúng URL ở bước 2 vào danh sách cho phép → **Save**.

Xong 5 bước trên, reload lại extension (vì đã sửa `supabase-config.js`),
mở trang Options → khối "Cloud Sync" sẽ hiện nút **"Sign in with Google"**.

### Vì sao có 2 URL redirect khác nhau (Google Cloud vs Supabase)?

Đây là điểm dễ nhầm nhất khi setup — luồng đăng nhập đi qua **2 chặng
redirect**:

1. Extension → Supabase (`/auth/v1/authorize`) → **Google** (màn hình đăng
   nhập thật) → quay lại **Supabase** (`/auth/v1/callback` — URL khai báo ở
   Bước 3.3, phía Google Cloud Console).
2. Supabase xử lý xong → redirect tiếp về **extension**
   (`https://<ID>.chromiumapp.org/` — URL khai báo ở Bước 5, phía Supabase).

Khai báo nhầm URL ở sai nơi (ví dụ dán URL chromiumapp.org vào Google Cloud
Console) sẽ khiến đăng nhập thất bại ở chặng đầu tiên.

### Cách hoạt động sau khi đăng nhập

- Đăng nhập lần đầu: nếu tài khoản cloud đã có sẵn Tool/Kit (từ máy khác
  từng đăng nhập), hỏi có muốn tải về không (tránh ghi đè âm thầm dữ liệu
  đang có trên máy hiện tại).
- Sau đó, mỗi lần thêm/sửa/xoá/sắp xếp Tool/Kit → tự động đẩy lên Supabase
  (có debounce nhẹ ~800ms, tránh gửi liên tục khi thao tác nhanh).
- Đăng xuất: chỉ xoá token đăng nhập trên máy này — dữ liệu trên Supabase
  không bị xoá, đăng nhập lại vẫn thấy đủ.
- Token đăng nhập lưu trong `chrome.storage.local` (không đồng bộ qua
  `chrome.storage.sync`, vì token nhạy cảm — không nên để trôi nổi qua
  nhiều thiết bị theo cách đó).

### Giới hạn trung thực của phần Cloud Sync

- **Chưa test thật với tài khoản Supabase/Google Cloud thật** — cần bạn
  tự tạo project + OAuth app rồi test, vì mình không thể tự tạo tài khoản
  cloud thay bạn. Nếu gặp lỗi cụ thể (thường là do khai báo nhầm 1 trong
  2 redirect URL ở trên), gửi lại thông báo lỗi + bước đang làm để mình
  soát lại.
- **Không xử lý xung đột (conflict) khi 2 máy cùng sửa gần như đồng thời**
  — máy nào lưu SAU sẽ ghi đè máy lưu TRƯỚC (last-write-wins đơn giản,
  không merge thông minh).
- **Chỉ hỗ trợ Google** ở bản này — Facebook/dịch vụ khác cần đăng ký OAuth
  app riêng, làm sau nếu cần.

## Bản 6.0.1 — điền config thật, vá lỗi thiếu apikey ở /authorize

Đã điền `Project URL` + khoá **publishable** (`sb_publishable_...`) thật
vào `supabase-config.js`. **Không dùng mật khẩu PostgreSQL/connection
string** được cung cấp kèm — extension chạy phía trình duyệt chỉ cần
Project URL + khoá công khai, không bao giờ nên nhúng mật khẩu database
trực tiếp vào code client-side.

**Phát hiện quan trọng khi soát lại:** `sb_publishable_...` là định dạng
khoá MỚI của Supabase (thay dần khoá JWT `anon` cũ dạng `eyJ...`, sẽ
deprecated cuối 2026). Về cơ bản dùng thay thế được ngay, nhưng có 1 khác
biệt hành vi so với khoá cũ: **endpoint `/auth/v1/authorize` bắt buộc phải
có `apikey` trong QUERY STRING** (không thể gửi qua header vì đây là URL
điều hướng trình duyệt trực tiếp, không phải `fetch()`) — bản trước thiếu
mất tham số này. Đã vá. Các lời gọi `fetch()` còn lại (refresh token, lấy
thông tin user, đọc/ghi config) vốn đã đúng sẵn (gửi `apikey` qua header
riêng, không nhét khoá publishable vào `Authorization` — đúng lỗi phổ biến
nhất được ghi nhận khi dùng khoá mới này trong Chrome extension).

**Vẫn cần bạn hoàn tất setup và test thật** — mình đã điền config, vá lỗi
đã phát hiện được qua soát code, nhưng chưa (và không thể) tự bấm nút
"Sign in with Google" để kiểm chứng toàn bộ luồng. Hoàn tất Bước 3-5 trong
mục "Bản 6.0.0" phía trên (Google OAuth Client + bật Google provider +
khai báo Redirect URL) rồi test — báo lại lỗi cụ thể (nếu có) kèm bước
đang làm.

## Bản 6.1.0 — vá lỗi NGHIÊM TRỌNG: có thể ghi đè mất config cloud thật

**Phát hiện qua báo cáo thực tế**: khi đăng nhập trên 1 máy/trình duyệt
mới, nếu bước "kéo config từ cloud về" thất bại vì **bất kỳ lý do gì**
(lỗi mạng thoáng qua, token vừa hết hạn...), code cũ **âm thầm coi như
cloud trống** và tự động đẩy config MẶC ĐỊNH của máy hiện tại lên, **ghi
đè lên config thật đã có sẵn trên cloud** — không có cảnh báo nào cho
người dùng biết.

**Đã sửa triệt để:**
- Phân biệt rõ "pull lỗi" (mạng, xác thực...) với "pull thành công nhưng
  cloud thật sự trống" — 2 trường hợp giờ xử lý khác hẳn nhau.
- **Pull lỗi → dừng hẳn, không đổi gì, không đẩy gì lên cloud cả** — chỉ
  hiện thông báo lỗi rõ ràng, để người dùng tự thử lại.
- Chỉ đẩy config lên cloud khi: (a) xác nhận chắc chắn cloud trống, hoặc
  (b) người dùng **xác nhận rõ ràng 2 lần liên tiếp** ý muốn ghi đè cloud
  bằng config của máy hiện tại (trước đây chỉ cần 1 lần "Cancel" ở hộp
  thoại đầu là tự động đẩy đè, khá dễ bấm nhầm).
- Đẩy config nền sau mỗi lần lưu Tool/Kit (không phải lúc đăng nhập) giờ
  cũng hiện cảnh báo ngay trên khối Cloud Sync nếu thất bại, thay vì chỉ
  ghi vào Console (rất dễ bị bỏ sót).

**Nếu bạn từng gặp đúng tình huống này trước khi có bản vá:** kiểm tra lại
bảng `aicf_configs` trong Supabase Table Editor xem config có bị ghi đè
mất không — nếu Brave/thiết bị gốc vẫn còn giữ config thật (chưa kịp sync
lại sau sự cố), đăng nhập lại trên đó và dùng nút xác nhận đẩy lên cloud
(giờ đã an toàn hơn) để khôi phục.

## Bản 6.2.0 — thay chuỗi confirm() bằng modal riêng (phát hiện qua thực tế)

**Sự cố gặp phải:** ở bản 6.1.0, khi đăng nhập mà cloud đã có dữ liệu,
người dùng bấm "Cancel" ở hộp thoại đầu (không load bản cloud) — nhưng hộp
thoại thứ 2 ("giữ máy này, ghi đè cloud?") **không hiện ra**. Nguyên nhân
gần như chắc chắn: trình duyệt (Chrome/Edge/Brave đều dựa Chromium) có cơ
chế **tự chặn `confirm()`/`alert()` gọi liên tiếp quá nhanh** trên cùng 1
trang — đây là giới hạn bảo mật có thật của trình duyệt, không phải lỗi
logic trong code.

**Đã sửa tận gốc:** bỏ hẳn chuỗi `confirm()`, thay bằng 1 modal riêng ngay
trong trang (giống các modal Add/Edit Tool/Kit đã có) với 3 lựa chọn rõ
ràng hiện cùng lúc: **"⬇️ Load from cloud"**, **"⬆️ Keep mine, overwrite
cloud"**, **"✋ Do nothing for now"** — không còn phụ thuộc cơ chế dialog
gốc của trình duyệt, không còn rủi ro bị chặn.

## Bản 7.0.0 — chuyển sang popup gốc của trình duyệt (tham khảo PrintFriendly)

Thay đổi kiến trúc lớn nhất kể từ bản 3.0.0 — theo đúng 5 yêu cầu UI/UX:

1. **Bỏ hẳn upload icon riêng** — trang Options giờ chỉ cho chọn icon qua
   bảng emoji có sẵn (32 emoji), không còn nút "Upload". (Icon dạng ảnh từ
   trước khi có thay đổi này vẫn hiển thị đúng nếu đã tồn tại sẵn.)
2. **Bấm icon → popup hiện NGAY DƯỚI icon** — không còn tự vẽ bảng nổi ở
   giữa trang bằng content script nữa. Dùng cơ chế `action.default_popup`
   gốc của trình duyệt (`popup.html`) — trình duyệt tự định vị đúng vị trí,
   không cần tự tính toán toạ độ.
3. **Tự đóng khi click ra ngoài** — hành vi mặc định của popup gốc trình
   duyệt (giống PrintFriendly), không cần tự bắt sự kiện click-outside.
4. **Không còn bảng tiến trình** — bấm 1 Tool/Kit trong popup, popup đóng
   ngay lập tức, việc chạy tiếp tục ở nền. Chỉ còn 1 **toast nhỏ góc dưới
   phải màn hình** (giống thông báo hệ thống), tự ẩn sau ~6 giây, đủ để
   biết đang chạy/xong/lỗi mà không chiếm màn hình.
5. **Cỡ chữ to hơn** trên toàn bộ trang Options (tăng ~1.5-2px mỗi chỗ) và
   popup mới (dùng cỡ 15-16px cho tiêu đề mục, tham khảo đúng tỉ lệ chữ
   của PrintFriendly trong ảnh mẫu).

### Thay đổi kỹ thuật đứng sau

- **`popup.html` + `popup.js`** (mới) — chỉ hiện danh sách Kit/Tool, gửi
  message `{type:"aicf:run", tabId, itemType, itemId}` cho `background.js`
  rồi tự đóng ngay (`window.close()`) — không tự thao tác DOM trang AI
  chat được (popup chạy trong context riêng, tách biệt trang).
- **`background.js`** — bỏ `chrome.action.onClicked` (không còn bắn ra khi
  đã khai báo `default_popup` — đây là quy tắc của Chrome, không phải lựa
  chọn). Thay bằng lắng nghe message từ popup, tiêm `shared.js`+`content.js`
  vào đúng tab, rồi gửi tiếp message `{type:"aicf:start", itemType, itemId}`
  cho content script.
- **`content.js`** — bỏ toàn bộ phần vẽ menu/bảng tiến trình (Shadow DOM),
  thay bằng 1 listener `chrome.runtime.onMessage` đăng ký NGAY ĐẦU file
  (có canh giữ `window.__aicfListenerRegistered` để không tích luỹ nhiều
  listener trùng nhau qua các lần tiêm lặp lại vào cùng 1 tab — isolated
  world của content script không bị huỷ giữa các lần tiêm, chỉ mất khi
  trang tải lại). Toàn bộ logic lõi (dò nền tảng, gửi tin, chờ phản hồi,
  tìm/tải file) giữ nguyên không đổi.

## Bản 7.1.0 — bỏ hẳn toast, đổi bộ icon mới

1. **Bỏ hẳn toast** (bản 7.0.0 dùng toast nhỏ góc dưới thay cho bảng tiến
   trình cũ) — theo yêu cầu, giờ chạy hoàn toàn im lặng, không hiện bất kỳ
   UI nào trên trang khi Tool/Kit đang chạy. Vẫn giữ log qua `console.log`/
   `console.error` (chỉ hiện trong DevTools, F12 → Console → lọc `[aicf]`)
   để có thể debug khi cần, nhưng người dùng bình thường không thấy gì cả
   — đúng tinh thần "chọn xong, chạy nền, không làm phiền" như PrintFriendly.
2. **Đổi bộ icon mới** (icon16/32/48/128.png do người dùng cung cấp, đã
   xác nhận đúng kích thước từng file trước khi thay, không cần resize).

## Bản 7.1.1 — icon tiêu đề dùng ảnh thật thay vì emoji cứng

Tiêu đề "AI Chat Friendly" ở cả popup và trang Options trước đó dùng emoji
💾 cứng trong text (không liên quan gì tới icon extension thật) — nên khi
đổi icon extension ở bản 7.1.0, 2 chỗ tiêu đề này vẫn hiện emoji cũ. Đã
thay bằng `<img>` trỏ thẳng tới `icons/icon32.png` — giờ đổi icon extension
sẽ tự động phản ánh đúng ở cả 2 nơi.

## Bản 7.1.2 — vá lỗi SyntaxError khi chạy nhiều Tool/Kit liên tiếp

**Phát hiện qua trang `chrome://extensions` → Errors** (cảm ơn đã gửi ảnh
chụp — không tự phát hiện được nếu không có bằng chứng thật):

```
Uncaught SyntaxError: Identifier 'AICF_ORDER_KEYS' has already been declared
Uncaught SyntaxError: Identifier 'FILE_EXT_RE' has already been declared
```

**Nguyên nhân:** mỗi lần chạy 1 Tool/Kit, `background.js` tiêm lại
`shared.js` + `content.js` vào tab. Isolated world của content script
**không bị xoá giữa các lần tiêm** (chỉ mất khi trang tải lại trình duyệt)
— nên lần tiêm thứ 2 trở đi, các dòng `const AICF_ORDER_KEYS = ...`,
`const FILE_EXT_RE = ...` bị khai báo lại trong đúng world đã có sẵn biến
đó, gây `SyntaxError` làm hỏng toàn bộ script (Tool/Kit vẫn chạy được lần
đầu, nhưng lần 2 trở đi trên cùng tab sẽ lỗi ngầm).

Bản 7.0.0 đã có canh giữ (`window.__aicfListenerRegistered`) nhưng **chỉ
bọc đúng phần đăng ký listener** — các dòng `const` khác ở cấp cao nhất
vẫn không được bảo vệ.

**Đã sửa đúng:** bọc **TOÀN BỘ nội dung** mỗi file (`shared.js` và
`content.js`) trong 1 khối canh giữ duy nhất (`if (!window.__aicfXxxLoaded)`),
không chỉ riêng phần listener. Vì `const`/`function` khai báo bên trong 1
khối `{ }` sẽ bị giới hạn phạm vi trong khối đó (không tự thoát ra ngoài
được) — với `shared.js` (cần dùng lại từ `content.js`/`options.js`/`popup.js`),
đã thêm gán tường minh `window.aicfLoadTools = aicfLoadTools;` (và 5 hàm
khác) ngay trước khi đóng khối, để các file khác vẫn gọi được bình thường
không cần đổi cú pháp gì ở nơi gọi.

**Đã kiểm thử độc lập** bằng cách mô phỏng đúng kịch bản lỗi thật (tiêm
`shared.js`+`content.js` 3 lần liên tiếp vào cùng 1 "trang" giả lập,
không "tải lại" giữa các lần) — xác nhận không còn lỗi, và các hàm vẫn gọi
trực tiếp (không cần tiền tố `window.`) bình thường.

**Nhân tiện:** cũng đổi phần lớn `console.error` sang `console.warn` cho
các trường hợp "Tool/Kit không tìm thấy file/phản hồi" — đây là **kết quả
bình thường có thể xảy ra** (không phải lỗi code), nhưng Chrome coi mọi
`console.error` là "Error" và liệt vào trang `chrome://extensions` →
Errors, gây nhiễu. Giữ nguyên đúng 1 chỗ dùng `console.error` thật sự (lỗi
`fetch()` ném ngoại lệ thật trong `tryFetchAttachmentBytes`).

## Bản 8.0.0 — tinh gọn triệt để: chỉ gửi prompt, không theo dõi gì thêm

Kịch bản sử dụng đã thay đổi: extension giờ **chỉ cần gửi đúng prompt vào ô
nhập chat**, để AI tự chạy — không cần chờ phản hồi, không cần tìm/tải tệp
đính kèm, không cần biết kết quả ra sao. Rà soát và cắt bỏ toàn bộ code chỉ
phục vụ cho phần "theo dõi tiến trình + kết quả" đã không còn cần thiết:

**Đã xoá hoàn toàn** (từ `content.js`, ~500 dòng → còn ~190 dòng):
- `KNOWN_MESSAGE_SELECTORS` + `getKnownMessageSelector` — chỉ dùng để nhận
  diện 1 lượt tin nhắn (phục vụ chờ phản hồi, giờ không cần).
- `captureBeforeState`, `waitForNewReply` — toàn bộ cơ chế chờ AI trả lời.
- `findAttachmentCandidates` + 3 hàm phụ trợ (`findArtifactRowCandidates`,
  `findFileTileCandidates`, `specificLabelFor`), `isRealDownloadTarget`,
  `getTurnWrapper` — toàn bộ cơ chế dò tệp đính kèm trong câu trả lời.
- `tryFetchAttachmentBytes`, `downloadBlob`, `fileMatchReFor` — toàn bộ cơ
  chế tải file về máy.
- `FILE_EXT_RE`, `DOWNLOAD_WORD_RE`, `ENTITY_CHIP_SELECTOR` — hằng số chỉ
  phục vụ việc dò tệp đính kèm ở trên.
- `absoluteUrl` — chỉ dùng bởi `tryFetchAttachmentBytes` đã xoá.
- `mimeType` khỏi cấu trúc dữ liệu Tool (`shared.js`) và `guessMimeType`
  khỏi `options.js` — chỉ có ý nghĩa khi tự tải file, giờ là dữ liệu chết.

**Đã đơn giản hoá:**
- `waitForStreamingToFinish`/`getStreamingSignal` — trước đây ưu tiên dùng
  selector riêng từng nền tảng (qua `KNOWN_MESSAGE_SELECTORS`) để đo chính
  xác độ dài tin nhắn cuối; giờ luôn dùng cách tổng quát (đo độ dài text
  cả trang) vì không còn cần độ chính xác cao cho việc theo dõi kết quả —
  chỉ cần biết trang có đang "yên tĩnh" trước khi gửi hay không.
- `runSingleToolFlow`/`runKitFlow` — rút gọn còn đúng 2-3 dòng: build
  prompt (thay `{filename}` nếu có), gọi `sendChatMessage()`, xong.

**Vẫn giữ nguyên** (còn cần thiết): `slugify`/`getConversationTitle`/
`computeFinalFilename` (đặt tên file nhắc tới trong prompt),
`PLATFORM_INPUT_SELECTORS`/`PLATFORM_SEND_SELECTORS` (tìm đúng ô nhập/nút
gửi từng nền tảng — đã kiểm chứng qua MHTML thật, không đụng tới),
`findChatInput`/`findSendButton`/`sendChatMessage` (logic gửi tin lõi).

**Lợi ích thực tế ngoài việc gọn code:** giảm hẳn số điểm có thể phát sinh
lỗi "không cần thiết" (ví dụ các cảnh báo `console.warn` về "không tìm
thấy tệp đính kèm"/"không có phản hồi" từng thấy ở trang Errors — giờ các
tình huống đó không còn tồn tại vì extension không còn chờ/tìm gì sau khi
gửi tin nhắn nữa).

## Bản 8.1.0 — công tắc ẩn/hiện Tool/Kit trên popup (không xoá)

Theo yêu cầu: trang Options giờ có 1 **công tắc bật/tắt** cạnh mỗi Tool/Kit
— tắt đi thì Tool/Kit đó **biến mất khỏi menu popup** (đỡ danh sách dài,
nhiều mục ít dùng), nhưng **vẫn còn nguyên** trong Options (không xoá dữ
liệu, không mất prompt đã soạn) — bật lại bất kỳ lúc nào là hiện lại ngay.

- Item bị tắt hiển thị mờ đi (xám icon) ngay trong danh sách Options, dễ
  phân biệt với item đang bật.
- Dữ liệu cũ (Tool/Kit tạo trước bản này, chưa có trường `enabled`) mặc
  định coi là **đang bật** — không bị ẩn bất ngờ sau khi cập nhật.
- Kit tham chiếu tới 1 Tool đã bị tắt vẫn chạy bình thường khi tự nó được
  gọi — "tắt" chỉ ảnh hưởng việc có hiện trực tiếp trên popup hay không,
  không ảnh hưởng việc Tool đó có dùng được bên trong Kit hay không.
- Nếu tắt hết toàn bộ Tool/Kit, popup hiện gợi ý rõ ràng ("All your
  Tools/Kits are hidden — go to ⚙️ Options to show some.") thay vì trống
  trơn khó hiểu.

## Bản 8.1.1 — tăng chiều cao popup, vừa đủ 2 Kit + 3 Tool không cuộn

Tính lại đúng chiều cao cần thiết cho danh sách 2 Kit + 3 Tool (2 nhãn mục
+ 5 thẻ item + khoảng cách + padding ≈ 426px) — chiều cao cũ (420px) thiếu
sát nút, đủ để trình duyệt tạo thanh cuộn dù chỉ thiếu vài pixel. Tăng lên
480px (có khoảng dư an toàn cho chênh lệch nhỏ giữa các hệ điều hành/font).
Danh sách dài hơn 5 mục vẫn tự cuộn bình thường (không bỏ hẳn giới hạn
chiều cao, tránh popup phình to vô hạn nếu sau này có nhiều Tool/Kit).

## Giới hạn trung thực

- **Đây là bản viết lại kiến trúc lớn nhất từ trước tới giờ, CHƯA qua test
  thật.** Rất nên test kỹ, đặc biệt phần Kit (cơ chế hoàn toàn mới, chưa
  có bằng chứng thực tế nào) trước khi tin tưởng hoàn toàn.
- Trang Options không có bước "khôi phục 3 Tool + 2 Kit mặc định" nếu lỡ
  xoá hết — cần cài lại extension (xoá dữ liệu `chrome.storage.local`) nếu
  muốn quay về trạng thái ban đầu.
- Kéo-thả không được hỗ trợ (dùng ↑/↓) — nếu danh sách Tool/Kit dài, sắp
  xếp lại có thể hơi chậm tay so với kéo-thả thật.
