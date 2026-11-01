import React, { useState } from 'react';
import { Activity, Lock, Mail, AlertCircle, Sparkles } from 'lucide-react';
import { signInWithGoogle, signInWithStaffEmail } from '../../lib/firebase';

interface LoginModalProps {
  onSuccess: () => void;
  onDemoLogin: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onSuccess, onDemoLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const handleGoogleLogin = async () => {
    setBusy(true);
    setErr('');
    try {
      await signInWithGoogle();
      onSuccess();
    } catch (e: any) {
      console.error(e);
      setErr(e.message || 'Không thể đăng nhập bằng Google.');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErr('Vui lòng nhập mật khẩu.');
      return;
    }

    setBusy(true);
    setErr('');
    try {
      await signInWithStaffEmail(password.trim());
      onSuccess();
    } catch (e: any) {
      console.error(e);
      setErr('Sai thông tin đăng nhập hoặc tài khoản chưa được cấp quyền.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#E9F6F1]">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-[#DDE1DC] p-6 space-y-4">
        {/* Brand Logo */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#0F2F2A] text-white flex items-center justify-center shadow-md">
            <Activity className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-xl font-bold text-[#0F2F2A]">Đơn nguyên Cơ xương khớp</h1>
          <p className="text-xs text-[#56615C]">
            Hệ thống quản lý điều trị & Báo cáo trực lâm sàng
          </p>
        </div>

        {/* Google Sign In Button */}
        <div className="pt-2 space-y-2.5">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={busy}
            className="w-full py-2.5 px-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-xs flex items-center justify-center gap-2.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Đăng nhập bằng tài khoản Google</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-2 text-[10px] text-gray-400 uppercase font-medium">hoặc dùng mật khẩu chung</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-[#3A4540] mb-1">
                Mật khẩu chung khoa / đơn nguyên
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Mật khẩu đơn nguyên (123 hoặc mật khẩu tài khoản)"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErr('');
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#C3CAC4] text-xs focus:ring-2 focus:ring-[#0E6B5E]/30 focus:border-[#0E6B5E] focus:outline-none"
                  autoFocus
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {err && (
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-red-50 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {busy ? 'Đang xác thực...' : 'Vào bằng mật khẩu'}
            </button>
          </form>

          <div className="pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onDemoLogin}
              className="w-full py-2 text-xs text-[#0B5C51] hover:bg-emerald-50 rounded-xl font-semibold transition-colors flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Vào nhanh (Khách / Chế độ nội bộ)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
