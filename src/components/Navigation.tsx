import React from 'react';
import { LayoutDashboard, Users, HeartPulse, FileText, CalendarClock, Syringe, Archive } from 'lucide-react';

export type TabKey = 'dash' | 'bn' | 'dhst' | 'duonghuyet' | 'truc' | 'lich' | 'cu';

interface NavigationProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  activePatientCount: number;
  dischargedCount?: number;
  pendingScheduleCount: number;
  todayGlucoseCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  activePatientCount,
  dischargedCount = 0,
  pendingScheduleCount,
  todayGlucoseCount = 0,
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

  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#DDE1DC] shadow-xs">
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

        {/* Mobile View: 4-column Grid (No horizontal scrolling!) */}
        <nav className="grid grid-cols-4 gap-1.5 py-1.5 md:hidden" aria-label="Chức năng chính trên di động">
          {tabs.map((t) => {
            const isActive = activeTab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onSelectTab(t.key)}
                className={`min-h-[38px] px-0.5 py-1 rounded-xl text-[10px] sm:text-[11px] font-semibold flex items-center justify-center gap-0.5 sm:gap-1 transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[#0E6B5E] text-white border-[#0E6B5E] shadow-xs'
                    : 'bg-[#F9FAF9] text-[#3A4540] border-[#DDE1DC] hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-[#56615C]'}`} />
                <span className="truncate">{t.short}</span>
                {Boolean(t.badge && t.badge > 0) && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
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
      </div>
    </div>
  );
};
