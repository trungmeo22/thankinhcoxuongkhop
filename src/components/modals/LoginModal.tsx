import React, { useState } from 'react';
import { Activity, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { getLocalPassword } from '../../lib/storage';
import { ensureFirebaseAuth } from '../../lib/firebase';

interface LoginModalProps {
  onSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = password.trim();
    if (!entered) {
      setErr('Vui lòng nhập mật khẩu.');
      return;
    }

    setBusy(true);
    setErr('');

    const savedPassword = getLocalPassword();
    if (entered === '123' || entered === savedPassword) {
      try {
        await ensureFirebaseAuth();
      } catch (authErr) {
        console.warn('Firebase staff auth notice:', authErr);
      }
      setBusy(false);
      onSuccess();
    } else {
      setBusy(false);
      setErr('Mật khẩu không chính xác.');
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

        {/* Password Login Form */}
        <div className="pt-2">
          <form onSubmit={handlePasswordLogin} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-[#3A4540] mb-1.5">
                Mật khẩu truy cập
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErr('');
                  }}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#C3CAC4] text-xs focus:ring-2 focus:ring-[#0E6B5E]/30 focus:border-[#0E6B5E] focus:outline-none font-medium"
                  autoFocus
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {err && (
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <span>{busy ? 'Đang mở hệ thống...' : 'Đăng nhập vào hệ thống'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
