import React, { useState } from 'react';
import { Patient, DischargeKind } from '../types';
import { hm, dmy, ageText, KIND_LABELS, fold } from '../lib/constants';
import {
  Search,
  RotateCcw,
  Archive,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

interface OldPatientsTabProps {
  patients: Patient[];
  onRestorePatient: (patientId: number) => void;
  onOpenPatientDetail?: (patient: Patient) => void;
  onGoBack?: () => void;
}

export const OldPatientsTab: React.FC<OldPatientsTabProps> = ({
  patients,
  onRestorePatient,
  onOpenPatientDetail,
  onGoBack,
}) => {
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | DischargeKind>('all');
  const [displayLimit, setDisplayLimit] = useState(5);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  const now = Date.now();
  const qClean = fold(q.trim());

  // All discharged / transferred patients (status === 'out')
  const allDischarged = patients
    .filter((p) => p.status === 'out')
    .sort((a, b) => (b.outAt || 0) - (a.outAt || 0));

  // Filter by search query and kind
  const filtered = allDischarged.filter((p) => {
    if (kindFilter !== 'all' && (p.outKind || 'ra') !== kindFilter) {
      return false;
    }
    if (!qClean) return true;
    const matchStr = fold(`${p.name} ${p.room} ${p.age} ${KIND_LABELS[p.outKind || 'ra']}`);
    return matchStr.includes(qClean);
  });

  // If search query is active, show all matching results; otherwise respect displayLimit
  const isSearching = qClean.length > 0 || kindFilter !== 'all';
  const displayedPatients = isSearching ? filtered : filtered.slice(0, displayLimit);

  const handleRestore = (p: Patient) => {
    if (
      window.confirm(
        `Khôi phục bệnh nhân "${p.name}" (Phòng ${p.room}) trở lại danh sách đang điều trị?`
      )
    ) {
      onRestorePatient(p.id);
      setRestoreNotice(`Đã khôi phục thành công bệnh nhân "${p.name}" về phòng ${p.room}.`);
      setTimeout(() => setRestoreNotice(null), 4000);
    }
  };

  const handleLoadMore = () => {
    setDisplayLimit((prev) => prev + 5);
  };

  const handleShowAll = () => {
    setDisplayLimit(filtered.length);
  };

  const handleResetLimit = () => {
    setDisplayLimit(5);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#DDE1DC] shadow-xs">
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
          <div>
            <h2 className="text-base md:text-lg font-bold text-[#0F2F2A] flex items-center gap-2">
              <Archive className="w-5 h-5 text-[#0E6B5E]" />
              <span>Danh sách Bệnh nhân cũ (Đã ra viện)</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#0E6B5E] font-bold">
                {allDischarged.length} ca
              </span>
            </h2>
            <p className="text-xs text-[#56615C] mt-0.5">
              Hồ sơ lưu trữ đầy đủ lịch sử DHST, đường huyết & điều trị. Có thể khôi phục lại bất kỳ lúc nào nếu người bệnh tiếp tục điều trị.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Tìm theo tên, tuổi, phòng..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Restore Success Toast */}
      {restoreNotice && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0E6B5E] shrink-0" />
            <span>{restoreNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setRestoreNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setKindFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            kindFilter === 'all'
              ? 'bg-[#0E6B5E] text-white shadow-xs'
              : 'bg-white text-gray-700 border border-gray-300 hover:border-[#0E6B5E]'
          }`}
        >
          Tất cả ({allDischarged.length})
        </button>
        <button
          type="button"
          onClick={() => setKindFilter('ra')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            kindFilter === 'ra'
              ? 'bg-[#0E6B5E] text-white shadow-xs'
              : 'bg-white text-gray-700 border border-gray-300 hover:border-[#0E6B5E]'
          }`}
        >
          Ra viện ({allDischarged.filter((p) => (p.outKind || 'ra') === 'ra').length})
        </button>
        <button
          type="button"
          onClick={() => setKindFilter('ck')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            kindFilter === 'ck'
              ? 'bg-[#0E6B5E] text-white shadow-xs'
              : 'bg-white text-gray-700 border border-gray-300 hover:border-[#0E6B5E]'
          }`}
        >
          Chuyển khoa ({allDischarged.filter((p) => p.outKind === 'ck').length})
        </button>
        <button
          type="button"
          onClick={() => setKindFilter('cv')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            kindFilter === 'cv'
              ? 'bg-[#0E6B5E] text-white shadow-xs'
              : 'bg-white text-gray-700 border border-gray-300 hover:border-[#0E6B5E]'
          }`}
        >
          Chuyển viện ({allDischarged.filter((p) => p.outKind === 'cv').length})
        </button>
      </div>

      {/* Main List */}
      {!filtered.length ? (
        <div className="p-8 bg-white rounded-2xl border border-[#DDE1DC] text-center space-y-2 shadow-xs">
          <Archive className="w-8 h-8 mx-auto text-gray-400" />
          <h3 className="text-sm font-bold text-gray-800">
            {isSearching ? 'Không tìm thấy bệnh nhân cũ phù hợp' : 'Chưa có bệnh nhân nào ra viện'}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {isSearching
              ? 'Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.'
              : 'Khi người bệnh được báo ra viện hoặc chuyển khoa/chuyển viện, thông tin và toàn bộ lịch sử sẽ được lưu trữ an toàn tại đây.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden">
          {/* Table Header Summary */}
          <div className="p-3 bg-[#F9FAF9] border-b border-[#EEF0ED] flex items-center justify-between text-xs text-gray-600">
            <span className="font-semibold text-[#0F2F2A]">
              {isSearching
                ? `Kết quả tìm kiếm: ${filtered.length} ca`
                : `5 ca gần nhất (Đang hiển thị ${displayedPatients.length}/${filtered.length} ca)`}
            </span>
            <span className="text-[11px] text-gray-400 hidden sm:inline">
              Mỗi dòng gồm: Phòng · Tên · Tuổi · Khôi phục điều trị
            </span>
          </div>

          {/* Minimalist Patient Rows: Phòng · Tên · Tuổi · Actions */}
          <div className="divide-y divide-[#EEF0ED]">
            {displayedPatients.map((p) => {
              const kind = p.outKind || 'ra';
              const isPending = p.outAt != null && p.outAt > now;

              return (
                <div
                  key={p.id}
                  className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-[#F4F9F6] transition-colors"
                >
                  {/* Left: Room Badge, Name, Age */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Room Badge */}
                    <span className="px-2.5 py-1 rounded-xl bg-[#0F2F2A] text-white font-bold text-xs shrink-0 shadow-2xs">
                      {p.room}
                    </span>

                    {/* Name & Age */}
                    <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <strong className="text-sm text-[#0F2F2A] truncate">
                        {p.name}
                      </strong>
                      <span className="text-xs text-gray-500 shrink-0">
                        ({ageText(p)})
                      </span>

                      {/* Small Status Tag */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isPending
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {isPending ? 'Chờ ' : 'Đã '}
                        {KIND_LABELS[kind].toLowerCase()}
                        {p.outAt && ` · ${hm(p.outAt)} ${dmy(p.outAt)}`}
                      </span>
                    </div>
                  </div>

                  {/* Right Actions: Restore Button & View Detail Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Restore Button */}
                    <button
                      type="button"
                      onClick={() => handleRestore(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-[#0E6B5E] text-[#0B5C51] hover:text-white border border-emerald-200 font-bold text-xs transition-all shadow-2xs cursor-pointer active:scale-95"
                      title="Khôi phục bệnh nhân này trở lại điều trị"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Khôi phục</span>
                    </button>

                    {/* View Profile Button */}
                    {onOpenPatientDetail && (
                      <button
                        type="button"
                        onClick={() => onOpenPatientDetail(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
                        title="Xem lại hồ sơ bệnh án cũ"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Hồ sơ</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Footer Controls */}
          {!isSearching && filtered.length > 5 && (
            <div className="p-3 bg-[#FAFBF9] border-t border-[#EEF0ED] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-gray-500 text-[11px]">
                Đang hiển thị {displayedPatients.length} / tổng số {filtered.length} bệnh nhân cũ
              </span>

              <div className="flex items-center gap-2">
                {displayedPatients.length < filtered.length ? (
                  <>
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 text-[#0E6B5E] border border-[#0E6B5E] font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                    >
                      <span>Xem thêm 5 ca</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleShowAll}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <span>Xem tất cả ({filtered.length})</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleResetLimit}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <span>Thu gọn về 5 ca gần nhất</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
