import React, { useState, useMemo } from 'react';
import { Patient, GlucoseRecord } from '../types';
import { isoDay, isIn, DAY, fromIso, dmy } from '../lib/constants';
import { DepartmentGlucoseModal } from './modals/DepartmentGlucoseModal';
import { GlucoseRecordModal } from './modals/GlucoseRecordModal';
import { GlucoseTimelineTable } from './GlucoseTimelineTable';
import {
  Syringe,
  Plus,
  Calendar,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Edit2,
  Trash2,
  Bed,
  CheckCircle2,
  AlertTriangle,
  History,
  FileText,
  ArrowLeft
} from 'lucide-react';

interface GlucoseTabProps {
  patients: Patient[];
  glucoseRecords: GlucoseRecord[];
  insulins?: string[];
  onSaveGlucoseRecord: (record: GlucoseRecord) => void;
  onDeleteGlucoseRecord: (id: number) => void;
  onOpenPatientDetail?: (p: Patient) => void;
  onGoBack?: () => void;
}

export const GlucoseTab: React.FC<GlucoseTabProps> = ({
  patients,
  glucoseRecords,
  insulins,
  onSaveGlucoseRecord,
  onDeleteGlucoseRecord,
  onOpenPatientDetail,
  onGoBack,
}) => {
  const now = Date.now();
  const todayStr = isoDay(now);

  const [q, setQ] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'tested' | 'untested'>('all');
  const [showDischarged, setShowDischarged] = useState<boolean>(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Modals state
  const [deptModalOpen, setDeptModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<GlucoseRecord | null>(null);
  const [preselectedPid, setPreselectedPid] = useState<number | undefined>(undefined);
  const [preselectedDate, setPreselectedDate] = useState<string | undefined>(undefined);

  // Group all glucose records by patientId
  const recordsByPatient = useMemo(() => {
    const map: Record<number, GlucoseRecord[]> = {};
    glucoseRecords.forEach((r) => {
      if (!map[r.patientId]) {
        map[r.patientId] = [];
      }
      map[r.patientId].push(r);
    });

    // Sort each patient's records descending by date, then ascending by time
    Object.keys(map).forEach((pidStr) => {
      const pid = Number(pidStr);
      map[pid].sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return a.time.localeCompare(b.time);
      });
    });

    return map;
  }, [glucoseRecords]);

  // Patients list (in-patients or both)
  const availablePatients = useMemo(() => {
    let list = patients;
    if (!showDischarged) {
      list = list.filter((p) => isIn(p, now));
    }
    return list.slice().sort((a, b) => {
      const inA = isIn(a, now);
      const inB = isIn(b, now);
      if (inA !== inB) return inA ? -1 : 1;
      return String(a.room).localeCompare(String(b.room), 'vi', { numeric: true });
    });
  }, [patients, showDischarged, now]);

  // Filter patients by search & filterMode
  const filteredPatients = useMemo(() => {
    const qClean = q.trim().toLowerCase();
    return availablePatients.filter((p) => {
      const pRecords = recordsByPatient[p.id] || [];
      const hasTests = pRecords.length > 0;

      if (filterMode === 'tested' && !hasTests) return false;
      if (filterMode === 'untested' && hasTests) return false;

      if (!qClean) return true;
      return (
        p.name.toLowerCase().includes(qClean) ||
        p.room.toLowerCase().includes(qClean) ||
        (p.note && p.note.toLowerCase().includes(qClean))
      );
    });
  }, [availablePatients, recordsByPatient, q, filterMode]);

  // Stats
  const totalTestsCount = glucoseRecords.length;
  const testedPatientsCount = useMemo(() => {
    return availablePatients.filter((p) => (recordsByPatient[p.id] || []).length > 0).length;
  }, [availablePatients, recordsByPatient]);

  const toggleExpand = (pid: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedIds(new Set(filteredPatients.map((p) => p.id)));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleOpenAddForPatient = (pid: number, dateStr?: string) => {
    setPreselectedPid(pid);
    setPreselectedDate(dateStr);
    setDeptModalOpen(true);
  };

  const getGlucoseBadgeColor = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (val < 3.9) return 'bg-red-50 text-red-700 border-red-300 font-bold';
    if (val <= 7.2) return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
    if (val <= 10.0) return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
    return 'bg-purple-50 text-purple-800 border-purple-300 font-bold';
  };

  const formatSlotLabel = (record: GlucoseRecord) => {
    if (record.slotType === '06:00') return '6h (Sáng)';
    if (record.slotType === '11:00') return '11h (Trưa)';
    if (record.slotType === '17:00') return '17h (Chiều)';
    if (record.slotType === '21:00') return '21h (Tối)';
    return `${record.time} (Khác)`;
  };

  const formatDateDisplay = (dateStr: string) => {
    if (dateStr === todayStr) return `Hôm nay · ${dmy(fromIso(dateStr))}`;
    const yestStr = isoDay(now - DAY);
    if (dateStr === yestStr) return `Hôm qua · ${dmy(fromIso(dateStr))}`;
    return dmy(fromIso(dateStr));
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="bg-white p-4 rounded-2xl border border-[#DDE1DC] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer mr-0.5"
              title="Quay lại"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Quay lại</span>
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#0E6B5E] flex items-center justify-center font-bold">
            <Syringe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-[#0F2F2A] leading-tight">
              Báo đường huyết
            </h2>
          </div>
        </div>

        {/* Nút Thêm mới toàn khoa */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPreselectedPid(undefined);
              setPreselectedDate(undefined);
              setDeptModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm kết quả test</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Search & Filter Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-[#DDE1DC] shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Tìm theo tên bệnh nhân, số phòng..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white font-medium"
            />
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-[#0E6B5E] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tất cả ({availablePatients.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('tested')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === 'tested'
                  ? 'bg-[#0E6B5E] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Đã có test ({testedPatientsCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('untested')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === 'untested'
                  ? 'bg-[#0E6B5E] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Chưa test ({availablePatients.length - testedPatientsCount})
            </button>
          </div>

          {/* Expand / Collapse All buttons */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-2.5 py-1 text-[11px] font-semibold text-[#0E6B5E] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-emerald-200"
              title="Mở rộng tất cả lịch sử bệnh nhân"
            >
              Mở rộng tất cả
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer border border-gray-200"
              title="Thu gọn tất cả"
            >
              Thu gọn tất cả
            </button>
          </div>
        </div>

        {/* Subline: Stats & Discharged Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EEF0ED] text-xs text-gray-500">
          <div className="flex items-center gap-3">
            <span>
              Hiển thị: <strong>{filteredPatients.length}</strong> bệnh nhân
            </span>
            <span>·</span>
            <span>
              Tổng lượt test toàn khoa: <strong className="text-emerald-800">{totalTestsCount}</strong>
            </span>
          </div>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-gray-600 hover:text-gray-900">
            <input
              type="checkbox"
              checked={showDischarged}
              onChange={(e) => setShowDischarged(e.target.checked)}
              className="rounded text-[#0E6B5E] focus:ring-[#0E6B5E]"
            />
            <span>Xem cả bệnh nhân đã xuất viện</span>
          </label>
        </div>
      </div>

      {/* Patient Cards List */}
      <div className="space-y-3">
        {!filteredPatients.length ? (
          <div className="p-8 bg-white rounded-2xl border border-[#DDE1DC] text-center text-xs text-gray-500 space-y-2">
            <History className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="font-semibold text-gray-700">Không tìm thấy bệnh nhân nào phù hợp với bộ lọc.</p>
            <p className="text-gray-400">Hãy thử đổi từ khóa tìm kiếm hoặc bấm nút "Thêm kết quả test".</p>
          </div>
        ) : (
          filteredPatients.map((p) => {
            const pRecords = recordsByPatient[p.id] || [];
            const hasTests = pRecords.length > 0;
            const isExpanded = expandedIds.has(p.id);

            // Group records by date (descending)
            const datesMap: Record<string, GlucoseRecord[]> = {};
            pRecords.forEach((r) => {
              if (!datesMap[r.date]) {
                datesMap[r.date] = [];
              }
              datesMap[r.date].push(r);
            });
            const dateList = Object.keys(datesMap).sort().reverse();

            // Latest test record
            const latestRecord = pRecords.length > 0 ? pRecords[0] : null;

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden transition-all hover:border-[#0E6B5E]/40"
              >
                {/* Collapsed / Summary Header Row (Click to toggle expansion) */}
                <div
                  onClick={() => toggleExpand(p.id)}
                  className={`p-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                    isExpanded ? 'bg-emerald-50/50 border-b border-emerald-100' : 'bg-white hover:bg-gray-50/80'
                  }`}
                >
                  {/* Left: Room Badge, Name, Age, Note */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <span className="px-2.5 py-1 rounded-xl bg-[#0F2F2A] text-white font-bold text-xs shrink-0 shadow-xs">
                      {p.room}
                    </span>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm text-[#0F2F2A]">{p.name}</strong>
                        {p.age && <span className="text-xs text-gray-500">({p.age}t)</span>}
                        {p.status === 'out' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-gray-200 text-gray-700">
                            Đã xuất viện
                          </span>
                        )}
                        {hasTests ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-bold">
                            {pRecords.length} lần test · {dateList.length} ngày
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-medium">
                            Chưa có lần test nào
                          </span>
                        )}
                      </div>

                      {p.note && (
                        <p className="text-[11px] text-[#56615C] truncate max-w-md sm:max-w-lg mt-0.5">
                          {p.note}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Middle / Right: Latest Test Snippet & Action Buttons */}
                  <div className="flex items-center gap-2.5 flex-wrap ml-auto">
                    {/* Latest test snippet (if any) */}
                    {latestRecord && (
                      <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>{latestRecord.date === todayStr ? 'Hôm nay' : dmy(fromIso(latestRecord.date))} {latestRecord.time}:</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg border text-xs ${getGlucoseBadgeColor(latestRecord.glucoseValue)}`}>
                          {latestRecord.glucoseValue} mmol/L
                        </span>
                        {latestRecord.insulinDose && (
                          <span className="text-[11px] font-semibold text-sky-800 flex items-center gap-1">
                            <Syringe className="w-3 h-3 text-sky-600" />
                            {latestRecord.insulinDose} UI {latestRecord.insulinType ? `(${latestRecord.insulinType})` : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Quick Add Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAddForPatient(p.id);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#0E6B5E] bg-white hover:bg-emerald-50 text-[#0B5C51] text-xs font-semibold transition-colors cursor-pointer active:scale-95 shadow-xs"
                      title="Thêm lần test cho bệnh nhân này"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm test</span>
                    </button>

                    {/* Open Patient Profile */}
                    {onOpenPatientDetail && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPatientDetail(p);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors cursor-pointer"
                        title="Xem đầy đủ hồ sơ bệnh nhân"
                      >
                        Hồ sơ
                      </button>
                    )}

                    {/* Expand/Collapse Indicator */}
                    <div className="flex items-center gap-1 pl-1 text-xs font-semibold text-[#0E6B5E]">
                      <span className="hidden md:inline">{isExpanded ? 'Thu gọn' : 'Xem lịch sử'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#0E6B5E]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Section: Full Test History Across All Dates in One Timeline */}
                {isExpanded && (
                  <div className="p-3 sm:p-4 bg-[#FAFBF9] border-t border-[#EEF0ED] animate-in fade-in duration-150">
                    <GlucoseTimelineTable
                      records={pRecords}
                      patientName={p.name}
                      onEditRecord={(rec) => setEditingRecord(rec)}
                      onDeleteRecord={(id) => onDeleteGlucoseRecord(id)}
                      onAddTest={(dateStr) => handleOpenAddForPatient(p.id, dateStr)}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Thêm mới cho toàn khoa / cho bệnh nhân */}
      {deptModalOpen && (
        <DepartmentGlucoseModal
          patients={patients}
          initialPatientId={preselectedPid}
          initialDate={preselectedDate}
          insulinList={insulins}
          onClose={() => {
            setDeptModalOpen(false);
            setPreselectedPid(undefined);
            setPreselectedDate(undefined);
          }}
          onSave={(record) => {
            onSaveGlucoseRecord(record);
            // Tự động mở rộng bệnh nhân vừa được ghi nhận test
            setExpandedIds((prev) => new Set([...prev, record.patientId]));
            setDeptModalOpen(false);
            setPreselectedPid(undefined);
            setPreselectedDate(undefined);
          }}
        />
      )}

      {/* Modal Sửa lần test cụ thể */}
      {editingRecord && (
        <GlucoseRecordModal
          initialRecord={editingRecord}
          patientId={editingRecord.patientId}
          patientName={patients.find((p) => p.id === editingRecord.patientId)?.name || 'Bệnh nhân'}
          patientRoom={patients.find((p) => p.id === editingRecord.patientId)?.room || ''}
          insulinList={insulins}
          onClose={() => setEditingRecord(null)}
          onSave={(rec) => {
            onSaveGlucoseRecord(rec);
            setEditingRecord(null);
          }}
        />
      )}
    </div>
  );
};
