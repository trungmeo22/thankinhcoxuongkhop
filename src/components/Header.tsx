import React, { useState, useEffect } from 'react';
import { Activity, ExternalLink, RefreshCw, AlertCircle, Building2, Settings } from 'lucide-react';
import { WDL, dmy, hm } from '../lib/constants';

interface HeaderProps {
  now: number;
  syncStatus: 'ok' | 'saving' | 'err';
  userEmail?: string | null;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ now, syncStatus, userEmail, onOpenSettings }) => {
  const [scene, setScene] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setScene((prev) => (prev + 1) % 4);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const scenes = ['/img/scene1.svg', '/img/scene2.svg', '/img/scene3.svg', '/img/scene4.svg'];
  const nowD = new Date(now);
  const nowStr = `${WDL[nowD.getDay()]}, ${dmy(now)} · ${hm(now)}`;

  return (
    <header className="relative overflow-hidden bg-[#E9F6F1] border-b border-[#DDE1DC] py-2 sm:py-2.5 px-3 sm:px-4 z-20">
      {/* Cycling background scene illustrations */}
      {scenes.map((src, idx) => (
        <img
          key={src}
          src={src}
          alt=""
          className={`hero-scene ${scene === idx ? 'hero-scene-active' : ''}`}
        />
      ))}

      <div className="relative max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Status: 1 single clean line on mobile */}
        <div className="flex items-center gap-2 sm:gap-3 bg-white/92 backdrop-blur-md rounded-xl sm:rounded-2xl px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-xs border border-emerald-950/10 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-[#0F2F2A] flex items-center justify-center flex-none text-[#E6F2EE] shadow-inner">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-xs sm:text-sm md:text-base text-[#0F2F2A] truncate leading-none">
              Đơn nguyên Cơ xương khớp
            </span>

            {/* Sync Status Indicator */}
            <span
              className="inline-flex items-center gap-1 flex-none"
              title={
                syncStatus === 'ok'
                  ? `Đã kết nối Firebase${userEmail ? ` (${userEmail})` : ''}`
                  : syncStatus === 'saving'
                  ? 'Đang đồng bộ...'
                  : 'Lỗi kết nối Firebase'
              }
            >
              {syncStatus === 'ok' ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              ) : syncStatus === 'saving' ? (
                <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
              ) : (
                <AlertCircle className="w-3 h-3 text-red-600" />
              )}
              <span className="hidden md:inline text-[11px] font-medium text-emerald-800">
                {syncStatus === 'ok' ? 'Đã kết nối' : syncStatus === 'saving' ? 'Đang lưu' : 'Mất kết nối'}
              </span>
            </span>

            {/* Date time on larger screens */}
            <span className="hidden lg:inline text-xs text-[#56615C] border-l border-gray-300 pl-2">
              {nowStr}
            </span>
          </div>
        </div>

        {/* Action Buttons: Settings & Switch to Khoa Nội Tổng Hợp */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-none">
          {/* Settings Button */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/90 hover:bg-white text-[#0F2F2A] text-xs sm:text-sm font-semibold shadow-xs border border-emerald-900/10 transition-all hover:shadow cursor-pointer"
              title="Cài đặt công suất giường và danh mục phòng bệnh"
            >
              <Settings className="w-4 h-4 text-[#0E6B5E]" />
              <span className="hidden md:inline">Cài đặt</span>
            </button>
          )}

          {/* Switch to Khoa Nội Tổng Hợp app */}
          <a
            href="https://l-b-o-trung.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs sm:text-sm font-semibold shadow-xs transition-all hover:shadow cursor-pointer"
            title="Chuyển sang ứng dụng Khoa Nội Tổng hợp (l-b-o-trung.vercel.app)"
          >
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Khoa Nội Tổng hợp</span>
            <span className="sm:hidden text-xs">Khoa Nội</span>
            <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
          </a>
        </div>
      </div>
    </header>
  );
};
