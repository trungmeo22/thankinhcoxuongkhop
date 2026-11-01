import React from 'react';
import { LayoutDashboard, Users, HeartPulse, FileText, CalendarClock, Syringe, Archive, ArrowLeft } from 'lucide-react';

export type TabKey = 'dash' | 'bn' | 'dhst' | 'duonghuyet' | 'truc' | 'lich' | 'cu';

interface NavigationProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  activePatientCount: number;
  dischargedCount?: number;
  pendingScheduleCount: number;
  todayGlucoseCount?: number;
  onBack?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  activePatientCount,
  dischargedCount = 0,
  pendingScheduleCount,
  todayGlucoseCount = 0,
  onBack,
}) => {
  const tabs = [
    { key: 'dash' as TabKey, label: 'Tổng quan', short: 'Tổng quan', icon: LayoutDashboard },
    { key: 'bn' as TabKey, label: 'Bệnh nhân', short: 'Bệnh nhân', badge: activePatientCount, icon: Users },
    { key: 'dhst' as TabKey, label: 'DHST/Diễn biến', short: 'DHST', icon: HeartPulse },
    { key: 'duonghuyet' as TabKey, label: 'Báo đường huyết', short: 'Đường huyết', badge: todayGlucoseCount, icon: Syringe },
    { key: 'truc' as TabKey, label: 'Báo cáo trực', short: 'Báo trực', icon: FileText },
    { key: 'lich' as TabKey, label: 'Lịch chỉ định', short: 'Lịch tiêm', badge: pendingScheduleCount, icon: CalendarClock },
    { key: 'cu' as TabKey, label: 'Bệnh nhân cũ', short: 'BN cũ', badge: dischargedCount, icon: Archive },
  ];

  const currentTab = tabs.find((t) => t.key === activeTab);
  const CurrentIcon = currentTab?.icon;

  return (
    <div className={`sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#DDE1DC] shadow-xs ${activeTab === 'dash' ? 'hidden md:block' : ''}`}>
      <div className="max-w-7xl mx-auto px-2 md:px-4">
        {/* Desktop View: Horizontal Tab Bar */}
        <nav className="hidden md:flex gap-1.5 py-1.5 justify-start" aria-label="Chức năng chính">
          {tabs.map((t) => {
            const isActive = activeTab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onSelectTab(t.key)}
                className={`min-h-[42px] px-3.5 lg:px-4 rounded-xl font-medium text-xs lg:text-sm whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0E6B5E] text-white font-semibold shadow-xs'
                    : 'text-[#3A4540] hover:bg-[#EEF0ED] hover:text-[#17201D]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#56615C]'}`} />
                <span>{t.label}</span>
                {Boolean(t.badge && t.badge > 0) && (
                  <span
                    className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold inline-flex items-center justify-center ${
                      isActive ? 'bg-[#F0A061] text-[#2A1404]' : 'bg-[#E4F0EC] text-[#0B5C51]'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Mobile View: Clean Back Bar when NOT on Dashboard */}
        {activeTab !== 'dash' && (
          <nav className="flex md:hidden items-center justify-between py-2 px-1 gap-2" aria-label="Thanh điều hướng di động">
            <button
              type="button"
              onClick={onBack || (() => onSelectTab('dash'))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E9F6F1] text-[#0E6B5E] border border-emerald-200 font-bold text-xs shadow-2xs hover:bg-[#D5EDE4] transition-all cursor-pointer active:scale-95 shrink-0"
              title="Quay lại trang trước"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Quay lại</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F2F2A] truncate">
              {CurrentIcon && <CurrentIcon className="w-4 h-4 text-[#0E6B5E] shrink-0" />}
              <span className="truncate">{currentTab?.label}</span>
            </div>

            <button
              type="button"
              onClick={() => onSelectTab('dash')}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 cursor-pointer shrink-0"
              title="Về trang Tổng quan"
            >
              Tổng quan
            </button>
          </nav>
        )}
      </div>
    </div>
  );
};
