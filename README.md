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

## Nền tảng hỗ trợ

Kế thừa nguyên vẹn từ bản "AI Chat Summarizer & File Downloader": ChatGPT,
Claude, Gemini, Grok, DeepSeek, Qwen, Z.ai, Kimi, Manus, Meta AI — toàn bộ
selector đã kiểm chứng qua MHTML thật/test trực tiếp giữ nguyên không đổi,
chỉ thay đổi phần kiến trúc Tool/Kit và giao diện.


