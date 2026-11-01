# Hướng dẫn đưa webapp Đơn nguyên Cơ xương khớp lên mạng

Thời gian: khoảng 20–30 phút. Không cần cài phần mềm, chỉ cần trình duyệt trên máy tính.

Bạn sẽ làm 4 việc:

1. Tạo database trên **Supabase** (nơi lưu dữ liệu).
2. Tạo **mật khẩu dùng chung** cho đơn nguyên.
3. Điền thông tin kết nối vào file `config.js`.
4. Đưa thư mục web lên **Netlify** để có đường link dùng trên điện thoại và máy tính.

> Giao diện của Supabase và Netlify có thể thay đổi theo thời gian, nên tên nút có thể hơi khác. Hãy tìm mục có tên gần giống.

---

## Bước 1 – Tạo database trên Supabase

1. Vào **https://supabase.com** → **Start your project** → đăng nhập bằng tài khoản GitHub hoặc email.
2. Bấm **New project** và điền:
   - **Name**: `don-nguyen-cxk`
   - **Database Password**: bấm *Generate a password*, rồi **lưu lại** ở chỗ an toàn. App không dùng mật khẩu này, nhưng bạn cần nó khi quản trị database.
   - **Region**: chọn **Southeast Asia (Singapore)**, vùng gần Việt Nam nhất.
3. Bấm **Create new project** và chờ 1–2 phút.
4. Ở menu trái, vào **SQL Editor** → **New query**.
5. Mở file `schema.sql` (nằm trong thư mục này), copy **toàn bộ** nội dung, dán vào ô soạn thảo rồi bấm **Run**.
   Nếu thấy chữ *Success. No rows returned* là thành công.
6. Kiểm tra: vào **Table Editor**, thấy 6 bảng `patients`, `recs`, `scheds`, `reports`, `settings`, `audit_log` là đúng.

## Bước 2 – Tạo mật khẩu dùng chung

App không có tài khoản riêng cho từng người. Cả đơn nguyên dùng **một mật khẩu**.

1. Tắt chức năng tự đăng ký:
   - Vào **Authentication** → **Sign In / Providers** (có bản ghi là *Providers* hoặc *Settings*).
   - Tắt **Allow new users to sign up** → **Save**.
   - Bước này rất quan trọng. Nếu không tắt, người ngoài có thể tự tạo tài khoản để vào xem dữ liệu.
2. Tạo tài khoản dùng chung:
   - Vào **Authentication** → **Users** → **Add user** → **Create new user**.
   - **Email**: `cxk@benhvien.vn`. Có thể dùng email khác, nhưng phải điền đúng email đó vào `config.js` ở Bước 3.
   - **Password**: `cxk-123`. Phần `cxk-` app tự thêm vào, nên nhân viên chỉ cần gõ `123`.
   - Tích **Auto Confirm User** → **Create user**.

> ⚠️ **Về mật khẩu "123"**
> Ai có đường link app và đoán được "123" là xem được dữ liệu bệnh nhân. Sau khi chạy được, hãy đổi ngay sang mật khẩu dài hơn: vào app → **Tổng quan** → kéo xuống cuối trang → **Mật khẩu & đăng xuất**. Mật khẩu mới chỉ cần gõ trong app; app tự xử lý phần `cxk-`.

## Bước 3 – Điền thông tin kết nối vào `config.js`

1. Trong Supabase, vào **Project Settings** (bánh răng) → **API**. Một số bản có mục **Data API** hoặc **API Keys**.
2. Copy 2 thứ:
   - **Project URL**, có dạng `https://abcdxyz.supabase.co`.
   - Khóa **anon public**. Bản mới có thể gọi là **Publishable key**.
   - **Không** dùng khóa `service_role` hay `secret`.
3. Mở file `config.js` bằng Notepad (Windows) hoặc TextEdit (Mac) và sửa:

```js
SUPABASE_URL: 'https://abcdxyz.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOi...dán-khóa-anon...',
LOGIN_EMAIL: 'cxk@benhvien.vn',
```

4. Lưu file. Chỉ sửa phần nằm trong dấu nháy `'...'`.

> Khóa anon được phép nằm công khai trong trang web. Dữ liệu vẫn an toàn vì database chỉ cho người đã đăng nhập đọc và ghi (đã cài sẵn ở Bước 1).

## Bước 4 – Đưa lên mạng bằng Netlify

1. Vào **https://app.netlify.com** và đăng ký hoặc đăng nhập (miễn phí).
2. Vào **Sites** → **Add new site** → **Deploy manually**, hoặc mở thẳng trang **https://app.netlify.com/drop**.
3. **Kéo cả thư mục `web`** (thư mục chứa `index.html`) thả vào khung.
4. Chờ vài giây. Netlify cho một đường link dạng `https://ten-ngau-nhien.netlify.app`.
5. Đổi tên cho dễ nhớ: **Site configuration** → **Change site name** → ví dụ `cxk-nghean` → link thành `https://cxk-nghean.netlify.app`.

**Khi cần cập nhật app** (ví dụ khi có bản sửa mới): vào site trên Netlify → **Deploys** → kéo thả thư mục `web` mới vào. Dữ liệu nằm ở Supabase nên không bị mất.

## Bước 5 – Dùng thử

1. Mở link, gõ mật khẩu `123` → **Vào**.
2. Bấm **Tổng quan** → kéo xuống ô **Tổng số giường** và sửa cho đúng.
3. Bấm nút **+** màu cam để khai báo thử một bệnh nhân. Mở link trên một điện thoại khác: bệnh nhân hiện ra ngay.
4. Góc trên, dưới ngày giờ, có chấm xanh **"Đã lưu"**:
   - Chấm vàng **"Đang lưu…"**: đang gửi dữ liệu lên.
   - Chấm đỏ: mất mạng. App tự thử lưu lại khi có mạng; đừng đóng trang khi đang đỏ.

**Đặt app ra màn hình chính điện thoại** để mở như một ứng dụng:

- iPhone (Safari): nút Chia sẻ → **Thêm vào MH chính**.
- Android (Chrome): menu ⋮ → **Thêm vào màn hình chính**.

---

## Sao lưu & khôi phục

- Mọi lần thêm, sửa, xóa đều được ghi vào bảng `audit_log`, gồm thời điểm và nội dung lúc đó. Nếu lỡ xóa nhầm, vào **Table Editor → audit_log** để tìm lại.
- Nên sao lưu định kỳ, ví dụ mỗi tuần: **Table Editor** → chọn từng bảng → **Export** → **CSV**.
- Kiểm tra gói Supabase đang dùng có sao lưu tự động không. Gói miễn phí có thể bị **tạm dừng nếu lâu không có ai dùng**; khi đó vào Supabase bấm **Restore** là chạy lại. Nếu dùng chính thức lâu dài, cân nhắc gói trả phí.

## Lưu ý về dữ liệu bệnh nhân

Đây là dữ liệu sức khỏe, thuộc nhóm dữ liệu cá nhân nhạy cảm. Trước khi nhập tên bệnh nhân thật:

- Hỏi ý kiến bộ phận pháp chế / CNTT của bệnh viện về việc lưu dữ liệu ở máy chủ ngoài (Supabase, vùng Singapore).
- Dùng mật khẩu đủ mạnh và chỉ chia sẻ link cho nhân viên đơn nguyên.
- Khi có người nghỉ việc hoặc chuyển khoa, đổi mật khẩu.

## Cấu trúc thư mục

```
web/
├── index.html      trang chính
├── config.js       ← thông tin kết nối (chỉ sửa file này)
├── app.js          giao diện + xử lý + đồng bộ dữ liệu
├── styles.css      giao diện
├── schema.sql      lệnh tạo database (chạy 1 lần ở Bước 1)
├── img/            4 ảnh nền minh họa
└── vendor/         thư viện đi kèm (không cần sửa)
```

## Gặp lỗi?

| Hiện tượng | Cách xử lý |
|---|---|
| Gõ đúng `123` mà báo "Sai mật khẩu" | Kiểm tra mật khẩu trong Supabase đúng là `cxk-123`, email trong `config.js` trùng email đã tạo, và đã tích *Auto Confirm User*. |
| "Không tải được dữ liệu" | Chưa chạy `schema.sql`, hoặc `SUPABASE_URL` / khóa anon trong `config.js` sai. |
| Máy khác không tự cập nhật | Chạy lại `schema.sql` (phần 4 bật cập nhật trực tiếp), rồi tải lại trang. |
| Trang trắng | Mở bằng Chrome hoặc Safari bản mới. Kiểm tra `config.js` không bị xóa mất dấu `'` hoặc dấu `,`. |
