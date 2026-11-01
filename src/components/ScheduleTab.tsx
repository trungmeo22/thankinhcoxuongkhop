import React, { useState } from 'react';
import { ScheduleItem, Patient, ProcedureType } from '../types';
import {
  isoDay,
  dayLabel,
  TYPE_LABELS,
  isOut
} from '../lib/constants';
import { Plus, Check, RotateCcw, Trash2, Calendar, Syringe, Zap } from 'lucide-react';

interface ScheduleTabProps {
  scheds: ScheduleItem[];
  patients: Patient[];
  onOpenOrderModal: () => void;
  onToggleDone: (id: number) => void;
  onDeleteSchedule: (id: number) => void;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  scheds,
  patients,
  onOpenOrderModal,
  onToggleDone,
  onDeleteSchedule,
}) => {
  const [filter, setFilter] = useState<'all' | ProcedureType>('all');
  const today = isoDay(Date.now());

  // Count active/pending
  const upcoming = scheds.filter((x) => x.date >= today || !x.done);
  const countAll = upcoming.filter((x) => !x.done).length;
  const countTiem = upcoming.filter((x) => !x.done && x.type === 'tiem').length;
  const countDien = upcoming.filter((x) => !x.done && x.type === 'dien').length;

  const filtered = upcoming
    .filter((x) => filter === 'all' || x.type === filter)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  // Group by date
  interface Grouped {
    date: string;
    label: string;
    isOverdue: boolean;
    items: ScheduleItem[];
  }

  const groups: Grouped[] = [];
  filtered.forEach((item) => {
    let g = groups[groups.length - 1];
    if (!g || g.date !== item.date) {
      g = {
        date: item.date,
        label: dayLabel(item.date, today),
        isOverdue: item.date < today,
        items: []
      };
      groups.push(g);
    }
    g.items.push(item);
  });

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#DDE1DC] shadow-xs">
        <div>
          <h2 className="text-base md:text-lg font-bold text-[#0F2F2A]">Lịch tiêm khớp & điện cơ</h2>
          <p className="text-xs text-[#56615C] mt-0.5">Sắp xếp theo ngày thực hiện · Đánh dấu khi hoàn thành thủ thuật</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filters */}
          <div className="flex items-center gap-1.5 bg-[#F3F4F1] p-1 rounded-xl border border-[#DDE1DC]">
            {[
              { key: 'all' as const, label: `Tất cả (${countAll})` },
              { key: 'tiem' as const, label: `Tiêm khớp (${countTiem})` },
              { key: 'dien' as const, label: `Điện cơ (${countDien})` },
            ].map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    active ? 'bg-white text-[#0B5C51] shadow-xs' : 'text-[#56615C] hover:text-[#17201D]'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenOrderModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm lịch</span>
          </button>
        </div>
      </div>

      {/* Schedule Items List */}
      {!groups.length ? (
        <div className="bg-white p-8 rounded-2xl border border-[#DDE1DC] shadow-xs text-center text-xs text-[#56615C]">
          Chưa có lịch chỉ định nào trong danh sách.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.date} className="space-y-2">
              <h3
                className={`text-xs font-bold px-2 py-1 flex items-center gap-1.5 ${
                  g.isOverdue ? 'text-red-700 bg-red-50 rounded-lg inline-block' : 'text-[#3A4540]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{g.label}</span>
              </h3>

              <div className="grid grid-cols-1 gap-2.5">
                {g.items.map((x) => {
                  const pt = patients.find((p) => p.id === x.patientId);
                  const ptDischarged = pt ? isOut(pt) : false;

                  return (
                    <div
                      key={x.id}
                      className={`p-3.5 md:p-4 rounded-2xl border transition-all flex flex-wrap items-center gap-3 ${
                        x.done
                          ? 'bg-[#F6F7F5] border-[#DDE1DC] opacity-75'
                          : 'bg-white border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E]/50'
                      }`}
                    >
                      {/* Time */}
                      <div className="w-14 text-center shrink-0">
                        <span className="text-lg font-bold text-[#0F2F2A]">{x.time}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-[200px] space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              x.type === 'tiem'
                                ? 'bg-[#DDEFE9] text-[#0B4F45]'
                                : 'bg-[#E3E7F8] text-[#2B3889]'
                            }`}
                          >
                            {TYPE_LABELS[x.type]}
                          </span>

                          <strong className="text-sm text-[#17201D]">
                            {pt ? `[${pt.room}] ${pt.name}` : '—'}
                          </strong>

                          {ptDischarged && (
                            <span className="text-[10px] text-gray-500 italic">
                              (Đã ra viện)
                            </span>
                          )}

                          {x.done && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> Đã thực hiện
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-[#2B3531]">
                          <strong>Vị trí:</strong> {x.site} · <strong>Người làm:</strong> {x.who || 'Chưa phân công'}
                        </div>

                        {x.note && (
                          <div className="text-xs text-[#56615C] italic">
                            Ghi chú: {x.note}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleDone(x.id)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            x.done
                              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {x.done ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" /> Đã thực hiện
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteSchedule(x.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Xóa chỉ định này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
