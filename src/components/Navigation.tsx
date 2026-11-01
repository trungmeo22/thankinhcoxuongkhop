import React from 'react';
import { LayoutDashboard, Users, HeartPulse, FileText, CalendarClock } from 'lucide-react';

export type TabKey = 'dash' | 'bn' | 'dhst' | 'truc' | 'lich';

interface NavigationProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  activePatientCount: number;
  pendingScheduleCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  activePatientCount,
  pendingScheduleCount,
}) => {
  const tabs = [
    { key: 'dash' as TabKey, label: 'Tổng quan', short: 'Tổng quan', icon: LayoutDashboard },
    { key: 'bn' as TabKey, label: 'Bệnh nhân', short: 'BN', badge: activePatientCount, icon: Users },
    { key: 'dhst' as TabKey, label: 'DHST/Diễn biến', short: 'DHST', icon: HeartPulse },
    { key: 'truc' as TabKey, label: 'Báo cáo trực', short: 'Trực', icon: FileText },
    { key: 'lich' as TabKey, label: 'Lịch chỉ định', short: 'Lịch', badge: pendingScheduleCount, icon: CalendarClock },
  ];

  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#DDE1DC] shadow-xs">
      <div className="max-w-7xl mx-auto px-2 md:px-4">
        <nav className="flex gap-1 py-1.5 overflow-x-auto no-scrollbar" aria-label="Chức năng chính">
          {tabs.map((t) => {
            const isActive = activeTab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onSelectTab(t.key)}
                className={`flex-1 md:flex-none min-h-[42px] px-3 md:px-5 rounded-xl font-medium text-xs md:text-sm whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0E6B5E] text-white font-semibold shadow-xs'
                    : 'text-[#3A4540] hover:bg-[#EEF0ED] hover:text-[#17201D]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#56615C]'}`} />
                <span className="hidden md:inline">{t.label}</span>
                <span className="md:hidden">{t.short}</span>
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
      </div>
    </div>
  );
};
