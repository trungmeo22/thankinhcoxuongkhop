/* ====== CẤU HÌNH – chỉ cần sửa file này ======
 * Lấy 2 giá trị đầu trong Supabase: Project Settings → API
 *  - SUPABASE_URL      : "Project URL"
 *  - SUPABASE_ANON_KEY : khóa "anon public" (hoặc "Publishable key")
 * KHÔNG dán khóa "service_role"/"secret" vào đây.
 */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://XXXXXXXX.supabase.co',
  SUPABASE_ANON_KEY: 'DÁN_KHÓA_ANON_VÀO_ĐÂY',

  // Email của tài khoản dùng chung đã tạo trong Supabase → Authentication → Users
  LOGIN_EMAIL: 'cxk@benhvien.vn',

  // Mật khẩu thật trong Supabase = PASSWORD_PREFIX + mật khẩu gõ trong app.
  // Ví dụ: mật khẩu app "123"  →  đặt mật khẩu trong Supabase là "cxk-123"
  PASSWORD_PREFIX: 'cxk-',

  // Số ngày DHST/diễn biến được tải về máy khi mở app
  RECORD_DAYS: 180
};
