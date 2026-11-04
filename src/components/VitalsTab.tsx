import React, { useState, useMemo } from 'react';
import { Patient, VitalRecord } from '../types';
import {
  isoDay,
  fromIso,
  DAY,
  dm,
  dmy,
  WDL,
  hm,
  byRoom,
  getVitals,
  hasVit,
  isOut,
  KIND_LABELS,
  fold,
} from '../lib/constants';
import { Plus, FileSpreadsheet, AlertTriangle, Calendar, ArrowLeft, Search, X, Camera, Copy, Check } from 'lucide-react';
import { VitalsTimelineTable } from './VitalsTimelineTable';

interface VitalsTabProps {
  patients: Patient[];
  recs: VitalRecord[];
  onOpenRecordModal: (p?: Patient) => void;
  onOpenPatientHistory: (p: Patient) => void;
  onAddTreatment?: (recordId: number, text: string) => void;
  onGoBack?: () => void;
}

export const VitalsTab: React.FC<VitalsTabProps> = ({
  patients,
  recs,
  onOpenRecordModal,
  onOpenPatientHistory,
  onAddTreatment,
  onGoBack,
}) => {
  const [selectedDate, setSelectedDate] = useState(isoDay(Date.now()));
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPids, setExpandedPids] = useState<Set<number>>(new Set());
  const [isQuickDailyReport, setIsQuickDailyReport] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  const toggleExpand = (pid: number) => {
    setExpandedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const getPatientFullTimeline = (p: Patient) => {
    const patientRecs = recs
      .filter((r) => r.pid === p.id)
      .map((r) => ({ ...r, isAdmit: false }));
    const admitRecord = {
      id: 0,
      pid: p.id,
      at: p.admitAt,
      pulse: p.av?.pulse || p.pulse,
      bp: p.av?.bp || p.bp,
      temp: p.av?.temp || p.temp,
      spo2: p.av?.spo2 || p.spo2,
      rr: p.av?.rr || p.rr,
      note: p.note,
      abn: false,
      tx: [],
      isAdmit: true,
    };
    return [...patientRecs, admitRecord].sort((a, b) => a.at - b.at);
  };

  const dStart = fromIso(selectedDate);
  const dEnd = dStart + DAY;
  const isToday = selectedDate === isoDay(Date.now());
  const dayTitle = `${isToday ? 'Hôm nay · ' : ''}${WDL[new Date(dStart).getDay()]}, ${dmy(dStart)}`;

  // Find all patients active on or before this day or with records on this day
  const relevantPatientIds = new Set<number>();
  patients.forEach((p) => {
    if (p.admitAt < dEnd && (p.status === 'in' || (p.outAt || 0) >= dStart)) {
      relevantPatientIds.add(p.id);
    }
  });
  recs.forEach((r) => {
    if (r.at >= dStart && r.at < dEnd) {
      relevantPatientIds.add(r.pid);
    }
  });

  const vPatients = patients
    .filter((p) => relevantPatientIds.has(p.id))
    .sort(byRoom);

  const qClean = fold(searchQuery.trim());
  const filteredPatients = vPatients.filter((p) => {
    if (!qClean) return true;
    return fold(`${p.name} ${p.room} ${p.doctor || ''}`).includes(qClean);
  });

  // Extract distinct rooms from filtered patients
  const displayedRooms = Array.from(new Set(filteredPatients.map((p) => p.room))).sort((a, b) =>
    a.localeCompare(b, 'vi', { numeric: true })
  );

  // Memoized daily vitals entries for the screenshot-ready quick report
  const dailyVitalsList = useMemo(() => {
    type DailyItem = {
      id: string | number;
      patient: Patient;
      at: number;
      pulse?: string;
      bp?: string;
      temp?: string;
      spo2?: string;
      rr?: string;
      note?: string;
      abn?: boolean;
      isAdmit?: boolean;
    };

    const items: DailyItem[] = [];

    // All vitals from recs in [dStart, dEnd)
    recs.forEach((r) => {
      if (r.at >= dStart && r.at < dEnd) {
        const patient = patients.find((p) => p.id === r.pid);
        if (patient) {
          items.push({
            id: r.id,
            patient,
            at: r.at,
            pulse: r.pulse,
            bp: r.bp,
            temp: r.temp,
            spo2: r.spo2,
            rr: r.rr,
            note: r.note,
            abn: r.abn,
            isAdmit: false,
          });
        }
      }
    });

    // Add admission records on this day
    patients.forEach((p) => {
      if (p.admitAt >= dStart && p.admitAt < dEnd && (hasVit(p.av) || p.pulse || p.bp)) {
        items.push({
          id: `admit-${p.id}`,
          patient: p,
          at: p.admitAt,
          pulse: p.av?.pulse || p.pulse,
          bp: p.av?.bp || p.bp,
          temp: p.av?.temp || p.temp,
          spo2: p.av?.spo2 || p.spo2,
          rr: p.av?.rr || p.rr,
          note: p.note,
          abn: false,
          isAdmit: true,
        });
      }
    });

    // Search query filter
    const searched = qClean
      ? items.filter((item) => {
          const matchTarget = `${item.patient.name} ${item.patient.room} ${item.patient.doctor || ''} ${item.note || ''}`;
          return fold(matchTarget).includes(qClean);
        })
      : items;

    // Sort by Room (numeric), then by time at
    return searched.sort((a, b) => {
      const roomComp = String(a.patient.room).localeCompare(String(b.patient.room), 'vi', { numeric: true });
      if (roomComp !== 0) return roomComp;
      return a.at - b.at;
    });
  }, [recs, patients, dStart, dEnd, qClean]);

  const handleCopyVitalsReport = () => {
    if (!dailyVitalsList.length) return;
    const lines = [
      `BÁO CÁO DHST & DIỄN BIẾN - KHOA CƠ XƯƠNG KHỚP`,
      `Ngày: ${dmy(dStart)} (${WDL[new Date(dStart).getDay()]})`,
      `----------------------------------------`
    ];

    dailyVitalsList.forEach((item, idx) => {
      const p = item.patient;
      const ageStr = p.age ? ` (${p.age}t)` : '';
      const vitParts: string[] = [];
      if (item.pulse) vitParts.push(`M:${item.pulse}`);
      if (item.bp) vitParts.push(`HA:${item.bp}`);
      if (item.temp) vitParts.push(`T:${item.temp}°`);
      if (item.spo2) vitParts.push(`SpO2:${item.spo2}%`);
      if (item.rr) vitParts.push(`NT:${item.rr}`);
      const vitStr = vitParts.length ? ` [${vitParts.join(' ')}]` : '';
      const noteStr = item.note ? ` (${item.note})` : '';
      const tagStr = item.isAdmit ? ` [Vào viện]` : '';
      lines.push(`${idx + 1}. P.${p.room} - ${p.name}${ageStr} ${hm(item.at)}${tagStr}:${vitStr}${noteStr}`);
    });

    lines.push(`----------------------------------------`);
    lines.push(`Tổng cộng: ${dailyVitalsList.length} lượt ghi nhận`);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyToast('Đã sao chép danh sách DHST vào bộ nhớ tạm!');
      setTimeout(() => setCopyToast(null), 3000);
    }).catch(() => {
      setCopyToast('Không thể tự động sao chép.');
      setTimeout(() => setCopyToast(null), 3000);
    });
  };

  // Helper to get day items for patient
  const getPatientDayRecords = (p: Patient) => {
    const list: Array<{
      at: number;
      pulse?: string;
      bp?: string;
      temp?: string;
      spo2?: string;
      rr?: string;
      note?: string;
      abn?: boolean;
      isAdmit?: boolean;
    }> = recs
      .filter((r) => r.pid === p.id && r.at >= dStart && r.at < dEnd)
      .map((r) => ({ ...r, isAdmit: false }));

    // Add admission record if admitted on this day
    if (p.av && p.admitAt >= dStart && p.admitAt < dEnd && hasVit(p.av)) {
      list.push({
        at: p.admitAt,
        ...p.av,
        note: p.note,
        abn: false,
        isAdmit: true
      });
    }

    return list.sort((a, b) => a.at - b.at);
  };

  return (
    <div className="space-y-4">
      {/* Search, Filter & Action Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-[#DDE1DC] shadow-xs space-y-2.5">
        {/* Row 1: Back (nếu có) + Search box + Nút Ghi DHST (vừa vặn 100% trên mobile, không bị đẩy ra ngoài) */}
        <div className="flex items-center gap-2">
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Quay lại"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Quay lại</span>
            </button>
          )}

          {/* Search Box */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên, bác sĩ, phòng..."
              className="w-full pl-8 pr-7 py-2 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-[#F9FAF9] focus:bg-white transition-colors placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Nút Ghi DHST */}
          <button
            type="button"
            onClick={() => onOpenRecordModal()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Ghi DHST</span>
          </button>
        </div>

        {/* Row 2: Ô thả xuống chọn Chế độ xem + Bộ chọn ngày (Không trượt ngang, không tràn viền) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2.5 border-t border-[#EEF0ED]">
          {/* Ô thả xuống chọn chế độ xem */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label className="text-[11px] font-bold text-gray-600 shrink-0 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-[#0E6B5E]" />
              <span>Chế độ:</span>
            </label>
            <select
              value={isQuickDailyReport ? 'quick' : 'rooms'}
              onChange={(e) => setIsQuickDailyReport(e.target.value === 'quick')}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl border border-[#C3CAC4] text-xs font-bold text-[#0F2F2A] bg-[#F9FAF9] focus:bg-white focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none transition-colors cursor-pointer"
            >
              <option value="rooms">📋 Xem theo từng phòng (Mặc định)</option>
              <option value="quick">📸 Danh sách nhanh trong ngày (Chụp màn hình)</option>
            </select>
          </div>

          {/* Bộ chọn ngày & Hôm nay */}
          <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 bg-[#F3F4F1] px-2.5 py-1 rounded-xl border border-[#DDE1DC] w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#56615C] shrink-0" />
                <span className="text-[11px] text-gray-500 font-medium">Ngày:</span>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#17201D] focus:outline-none cursor-pointer"
              />
            </div>

            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(isoDay(Date.now()))}
                className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-800 transition-colors cursor-pointer shrink-0"
                title="Về hôm nay"
              >
                Hôm nay
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast thông báo đã sao chép */}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F2F2A] text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* CHẾ ĐỘ BÁO CÁO NHANH TRONG NGÀY (CHỤP MÀN HÌNH) */}
      {isQuickDailyReport ? (
        <div className="bg-white rounded-2xl border-2 border-emerald-800/30 shadow-md overflow-hidden animate-in fade-in duration-150">
          {/* Header Báo Cáo Chụp Màn Hình */}
          <div className="bg-[#0F2F2A] text-white p-3 sm:p-4 flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                <h3 className="font-bold text-xs sm:text-sm tracking-wide uppercase text-emerald-100">
                  BÁO CÁO DHST & DIỄN BIẾN - KHOA CKX
                </h3>
              </div>
              <div className="text-[11px] sm:text-xs text-emerald-300 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Ngày: <strong className="text-white">{dmy(dStart)}</strong> ({WDL[new Date(dStart).getDay()]})</span>
                <span>·</span>
                <span>Tổng cộng: <strong className="text-white">{dailyVitalsList.length} lượt</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyVitalsReport}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold shadow-xs transition-colors cursor-pointer active:scale-95 whitespace-nowrap"
                title="Sao chép danh sách để gửi Zalo"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sao chép Zalo</span>
                <span className="sm:hidden">Sao chép</span>
              </button>
              <button
                type="button"
                onClick={() => setIsQuickDailyReport(false)}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-colors cursor-pointer"
                title="Đóng chế độ báo cáo nhanh"
              >
                ✕ Đóng
              </button>
            </div>
          </div>

          {/* Danh sách kết quả theo hàng ngang - xếp thứ tự dọc - chữ nhỏ gọn vừa hàng chụp ảnh */}
          {!dailyVitalsList.length ? (
            <div className="p-8 text-center text-xs text-gray-500 space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="font-semibold text-gray-700">
                Chưa có lượt đo DHST hoặc diễn biến nào trong ngày {dmy(dStart)}.
              </p>
              <button
                type="button"
                onClick={() => onOpenRecordModal()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0E6B5E] text-white text-xs font-bold active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ghi DHST ngay</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {dailyVitalsList.map((item, idx) => {
                const p = item.patient;
                const hasVitals = item.pulse || item.bp || item.temp || item.spo2;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 hover:bg-emerald-50/40 transition-colors whitespace-nowrap text-[10px] sm:text-[10.5px] ${
                      item.abn ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    {/* STT & Phòng & Tên & Tuổi & Giờ */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-gray-400 font-mono text-[9px] w-4 shrink-0 text-right">
                        {idx + 1}.
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[#0F2F2A] text-white font-bold text-[9px] shrink-0">
                        P.{p.room}
                      </span>
                      <strong className="text-gray-900 font-bold truncate max-w-[95px] sm:max-w-[135px]">
                        {p.name}
                      </strong>
                      {p.age && (
                        <span className="text-gray-500 font-medium shrink-0 text-[9px]">
                          ({p.age}t)
                        </span>
                      )}
                      <span className="text-gray-500 font-mono text-[9px] shrink-0">
                        {hm(item.at)}
                      </span>
                      {item.isAdmit && (
                        <span className="px-1 py-0.2 rounded bg-blue-100 text-blue-800 text-[8.5px] font-bold shrink-0">
                          Vào viện
                        </span>
                      )}
                    </div>

                    {/* Chỉ số DHST & Diễn biến */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                      {/* Vitals indicators */}
                      {hasVitals && (
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9.5px] font-semibold shrink-0 ${
                          item.abn
                            ? 'bg-amber-100 border-amber-300 text-amber-900'
                            : 'bg-gray-50 border-gray-200 text-gray-800'
                        }`}>
                          {item.pulse && <span>M:<strong>{item.pulse}</strong></span>}
                          {item.bp && <span>HA:<strong>{item.bp}</strong></span>}
                          {item.temp && <span>T:<strong>{item.temp}°</strong></span>}
                          {item.spo2 && <span>SpO2:<strong>{item.spo2}%</strong></span>}
                        </div>
                      )}

                      {/* Diễn biến / Note nếu có */}
                      {item.note && (
                        <span
                          className={`italic truncate max-w-[100px] sm:max-w-[170px] text-[9.5px] ${
                            item.abn ? 'text-amber-900 font-medium' : 'text-gray-600'
                          }`}
                          title={item.note}
                        >
                          ({item.note})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {dailyVitalsList.length > 0 && (
            <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[9.5px] text-gray-500">
              <span>Mẹo: Chụp ảnh màn hình danh sách này để gửi báo cáo trực</span>
              <span>Tổng: <strong>{dailyVitalsList.length}</strong> lượt</span>
            </div>
          )}
        </div>
      ) : (
        /* Rooms Cards (Chế độ xem theo phòng) */
        !filteredPatients.length ? (
        <div className="bg-white p-8 rounded-2xl border border-[#DDE1DC] shadow-xs text-center text-xs text-[#56615C]">
          {searchQuery.trim()
            ? `Không tìm thấy bệnh nhân phù hợp với từ khóa "${searchQuery}".`
            : `Không có bệnh nhân trong ngày ${dm(dStart)}.`}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRooms.map((rm) => {
            const roomPatients = filteredPatients.filter((p) => p.room === rm);
            return (
              <div key={rm} className="bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden">
                {/* Room Header Banner */}
                <div className="px-4 py-2.5 bg-[#0F2F2A] text-white flex items-center justify-between">
                  <span className="font-bold text-sm">Phòng {rm}</span>
                  <span className="text-xs text-emerald-200 font-medium">
                    {roomPatients.length} bệnh nhân
                  </span>
                </div>

                {/* Patient Rows inside room */}
                <div className="divide-y divide-[#E6E9E5]">
                  {roomPatients.map((p) => {
                    const isExpanded = expandedPids.has(p.id);
                    const fullTimeline = getPatientFullTimeline(p);
                    const ageStr = p.age ? `${String(p.age).trim()}t` : '';

                    return (
                      <div key={p.id} className="transition-colors">
                        {/* Collapsed / Summary Header Row: Tên bệnh nhân, tuổi (t), nút Thêm DHST */}
                        <div
                          onClick={() => toggleExpand(p.id)}
                          className={`px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2.5 cursor-pointer select-none transition-colors ${
                            isExpanded ? 'bg-emerald-50/50 border-b border-emerald-100' : 'bg-white hover:bg-gray-50/80'
                          }`}
                        >
                          {/* Left: Tên bệnh nhân & Tuổi viết tắt (t) */}
                          <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                            <strong className="text-sm text-[#0F2F2A] font-bold truncate">
                              {p.name}
                            </strong>
                            {ageStr && (
                              <span className="text-xs text-gray-500 shrink-0 font-medium">
                                ({ageStr})
                              </span>
                            )}
                          </div>

                          {/* Right: Nút Thêm DHST thu nhỏ bề ngang, không còn mũi tên */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenRecordModal(p);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#0E6B5E] bg-white hover:bg-emerald-50 text-[#0B5C51] text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-xs whitespace-nowrap shrink-0"
                            title="Thêm lần đo DHST cho bệnh nhân này"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm DHST</span>
                          </button>
                        </div>

                        {/* Expanded Section: Mở trực tiếp timeline trượt ngang */}
                        {isExpanded && (
                          <div className="p-2.5 sm:p-3.5 bg-[#FAFBF9] border-t border-[#EEF0ED] animate-in fade-in duration-150">
                            <VitalsTimelineTable
                              items={fullTimeline}
                              patient={p}
                              onAddVitals={() => onOpenRecordModal(p)}
                              onAddTreatment={onAddTreatment}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )
      )}
    </div>
  );
};
