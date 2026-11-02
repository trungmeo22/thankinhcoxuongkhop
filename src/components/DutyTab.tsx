import React, { useState, useEffect } from 'react';
import { Patient, VitalRecord, ScheduleItem, DutyReport, DutyStats, DutyBlock } from '../types';
import {
  fromIso,
  isoDay,
  HOUR,
  DAY,
  dmy,
  dm,
  hm,
  KIND_LABELS,
  vitalLine,
  uid,
  ageText,
  fold
} from '../lib/constants';
import { generateDutyReportPdf } from '../lib/pdf';
import { ExpandableDutyNoteLine } from './ExpandableDutyNoteLine';
import { FileText, Download, Copy, Check, Plus, Trash2, Edit3, X, Calendar, UserCheck, Search, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';

interface DutyTabProps {
  patients: Patient[];
  recs: VitalRecord[];
  scheds: ScheduleItem[];
  reports: DutyReport[];
  onSaveReport: (report: DutyReport) => void;
  onViewReport: (report: DutyReport) => void;
  onGoBack?: () => void;
}

export const DutyTab: React.FC<DutyTabProps> = ({
  patients,
  recs,
  scheds,
  reports,
  onSaveReport,
  onViewReport,
  onGoBack,
}) => {
  const now = Date.now();
  // Default duty date is from 07:00 yesterday if before 07:00, or today
  const defaultDate = isoDay(now - 7 * HOUR);

  const [dutyDate, setDutyDate] = useState(defaultDate);
  const [doctor, setDoctor] = useState('');
  const [nurse, setNurse] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<number | null>(null);

  // Search & Pagination for saved reports
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(3);

  interface DutyNoteEntry {
    time: string;
    text: string;
  }

  interface DutyBlockForm {
    name: string;
    room: string;
    notes: DutyNoteEntry[];
  }

  // Sorted list of current inpatients
  const currentInpatients = React.useMemo(() => {
    return patients
      .filter((p) => p.status === 'in')
      .sort((a, b) => {
        const rComp = String(a.room).localeCompare(String(b.room), 'vi', { numeric: true });
        if (rComp !== 0) return rComp;
        return a.name.localeCompare(b.name, 'vi');
      });
  }, [patients]);

  // Manual additional blocks for duty report
  const [blocks, setBlocks] = useState<DutyBlockForm[]>([
    { name: '', room: '', notes: [{ time: hm(now), text: '' }] }
  ]);

  // Calculate duty statistics for given date
  const calculateShiftStats = (dateIso: string): DutyStats => {
    const start = fromIso(dateIso) + 7 * HOUR;
    const end = start + DAY;
    const cap = Math.min(end, now);

    const presentAt = (p: Patient, t: number) => {
      return p.admitAt <= t && !(p.status === 'out' && (p.outAt || 0) <= t);
    };

    const cu = patients.filter((p) => presentAt(p, start)).length;
    const admits = patients
      .filter((p) => p.admitAt > start && p.admitAt <= cap)
      .sort((a, b) => a.admitAt - b.admitAt)
      .map((p) => ({
        name: p.name,
        age: p.age,
        room: p.room,
        at: p.admitAt,
        note: p.note || ''
      }));
    const vao = admits.length;

    const outsInShift = patients.filter(
      (p) => p.status === 'out' && (p.outAt || 0) > start && (p.outAt || 0) <= cap
    );

    const countKind = (k: 'ra' | 'ck' | 'cv') =>
      outsInShift.filter((p) => (p.outKind || 'ra') === k).length;

    const ra = countKind('ra');
    const ck = countKind('ck');
    const cv = countKind('cv');
    const con = cu + vao - ra - ck - cv;

    const shiftScheds = scheds.filter((x) => x.type === 'tiem' && x.date === dateIso);
    const tiem = shiftScheds.length;
    const tiemDone = shiftScheds.filter((x) => x.done).length;

    const transfers = outsInShift
      .filter((p) => p.outKind === 'ck' || p.outKind === 'cv')
      .sort((a, b) => (a.outAt || 0) - (b.outAt || 0))
      .map((p) => ({
        name: p.name,
        age: p.age,
        room: p.room,
        at: p.outAt || now,
        kind: p.outKind as 'ck' | 'cv',
        note: p.outNote || ''
      }));

    const evs = recs
      .filter((r) => r.abn && r.at > start && r.at <= cap)
      .sort((a, b) => a.at - b.at)
      .map((r) => {
        const p = patients.find((x) => x.id === r.pid);
        return {
          pid: r.pid,
          name: p ? p.name : 'Chưa rõ',
          room: p ? p.room : '',
          at: r.at,
          note: r.note,
          vit: vitalLine(r),
          tx: r.tx || []
        };
      });

    return {
      start,
      end,
      cu,
      vao,
      ra,
      ck,
      cv,
      con,
      tiem,
      tiemDone,
      admits,
      transfers,
      evs
    };
  };

  const currentStats = calculateShiftStats(dutyDate);
  const windowText = `Từ 07:00 ${dm(currentStats.start)} đến 07:00 ${dmy(currentStats.end)}`;

  // Block management
  const addBlock = () => {
    setBlocks([...blocks, { name: '', room: '', notes: [{ time: hm(Date.now()), text: '' }] }]);
  };

  const removeBlock = (index: number) => {
    if (blocks.length === 1) {
      setBlocks([{ name: '', room: '', notes: [{ time: hm(Date.now()), text: '' }] }]);
      return;
    }
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const updateBlockPatient = (index: number, name: string, room: string) => {
    const next = [...blocks];
    next[index] = { ...next[index], name, room };
    setBlocks(next);
  };

  const updateBlockRoom = (index: number, room: string) => {
    const next = [...blocks];
    next[index] = { ...next[index], room };
    setBlocks(next);
  };

  const addNoteLine = (blockIndex: number) => {
    const next = [...blocks];
    next[blockIndex].notes.push({ time: hm(Date.now()), text: '' });
    setBlocks(next);
  };

  const updateNoteTime = (blockIndex: number, noteIndex: number, time: string) => {
    const next = [...blocks];
    next[blockIndex].notes[noteIndex].time = time;
    setBlocks(next);
  };

  const updateNoteText = (blockIndex: number, noteIndex: number, text: string) => {
    const next = [...blocks];
    next[blockIndex].notes[noteIndex].text = text;
    setBlocks(next);
  };

  const removeNoteLine = (blockIndex: number, noteIndex: number) => {
    const next = [...blocks];
    if (next[blockIndex].notes.length === 1) {
      next[blockIndex].notes[0] = { time: hm(Date.now()), text: '' };
    } else {
      next[blockIndex].notes = next[blockIndex].notes.filter((_, i) => i !== noteIndex);
    }
    setBlocks(next);
  };

  // Autocomplete patient suggestions
  const activePatients = patients.filter((p) => p.status === 'in');

  const getSuggestions = (query: string) => {
    const qClean = fold(query.trim());
    if (!qClean) return [];
    return activePatients
      .filter((p) => fold(`${p.name} ${p.room}`).includes(qClean))
      .slice(0, 4);
  };

  // Generate plain text report
  const generateReportText = (r: DutyReport) => {
    const c = r.stats;
    const L: string[] = [];
    L.push('BÁO CÁO TRỰC – ĐƠN NGUYÊN CƠ XƯƠNG KHỚP');
    L.push(`Ngày trực: ${dmy(c.start)} (${windowText})`);
    L.push(`BS trực: ${r.doctor}${r.nurse ? ` · ĐD trực: ${r.nurse}` : ''}`);
    L.push(`Cũ: ${c.cu} | Vào: ${c.vao} | Ra: ${c.ra} | Chuyển khoa: ${c.ck} | Chuyển viện: ${c.cv} | Còn: ${c.con}`);
    L.push(`Tiêm khớp: ${c.tiem} ca${c.tiem ? ` (Đã làm: ${c.tiemDone})` : ''}`);
    L.push('');
    L.push(`1. BỆNH NHÂN VÀO VIỆN TRONG CA (${c.admits.length}):`);
    if (!c.admits.length) L.push('Không có.');
    c.admits.forEach((a, i) => {
      L.push(`${i + 1}. [${a.room}] ${a.name} (${a.age ? `${a.age}t` : ''}) – Vào: ${hm(a.at)} ${dm(a.at)}${a.note ? ` – ${a.note}` : ''}`);
    });
    L.push('');
    L.push(`2. BỆNH NHÂN CHUYỂN (${c.transfers.length}):`);
    if (!c.transfers.length) L.push('Không có.');
    c.transfers.forEach((a, i) => {
      L.push(`${i + 1}. [${a.room}] ${a.name} – ${KIND_LABELS[a.kind]} lúc ${hm(a.at)} ${dm(a.at)}${a.note ? ` – ${a.note}` : ''}`);
    });
    L.push('');
    L.push('3. DIỄN BIẾN LÂM SÀNG BẤT THƯỜNG:');
    if (!c.evs.length && !r.blocks.length) {
      L.push('Không có diễn biến đặc biệt.');
    } else {
      c.evs.forEach((e, i) => {
        L.push(`• [${e.room}] ${e.name}: ${e.note || 'Bất thường DHST'} (${e.vit})`);
        e.tx.forEach((t) => L.push(`  → Xử trí: ${t.text}`));
      });
      r.blocks.forEach((b) => {
        if (b.name || b.room || b.notes.length > 0) {
          L.push(`• [${b.room || '—'}] ${b.name}:`);
          b.notes.forEach((n) => {
            const timeStr = typeof n === 'object' && n.time ? `[${n.time}] ` : '';
            const textStr = typeof n === 'object' ? n.text : n;
            if (textStr && textStr.trim()) {
              L.push(`  - ${timeStr}${textStr.trim()}`);
            }
          });
        }
      });
    }
    return L.join('\n');
  };

  const handleSave = () => {
    if (!doctor.trim()) {
      setErr('Vui lòng nhập tên Bác sĩ trực.');
      return;
    }
    if (!dutyDate) {
      setErr('Vui lòng chọn ngày trực.');
      return;
    }
    setErr('');

    const cleanBlocks: DutyBlock[] = blocks
      .map((b) => ({
        name: b.name.trim(),
        room: b.room.trim(),
        notes: b.notes
          .filter((n) => n.text.trim())
          .map((n) => ({
            time: n.time.trim(),
            text: n.text.trim()
          }))
      }))
      .filter((b) => b.name || b.room || b.notes.length > 0);

    const reportId = editingId || uid();
    const stats = calculateShiftStats(dutyDate);

    const report: DutyReport = {
      id: reportId,
      savedAt: Date.now(),
      date: dutyDate,
      doctor: doctor.trim(),
      nurse: nurse.trim(),
      stats,
      blocks: cleanBlocks,
      text: ''
    };
    report.text = generateReportText(report);

    onSaveReport(report);
    setEditingId(null);
    setBlocks([{ name: '', room: '', notes: [{ time: hm(Date.now()), text: '' }] }]);
  };

  const handleEdit = (r: DutyReport) => {
    setEditingId(r.id);
    setDutyDate(r.date);
    setDoctor(r.doctor);
    setNurse(r.nurse);
    setBlocks(
      r.blocks.length
        ? r.blocks.map((b) => ({
            name: b.name || '',
            room: b.room || '',
            notes: b.notes.length
              ? b.notes.map((n) => {
                  if (typeof n === 'string') {
                    const match = n.match(/^\[(\d{1,2}:\d{2})\]\s*(.*)$/);
                    if (match) {
                      return { time: match[1], text: match[2] };
                    }
                    return { time: '', text: n };
                  }
                  return { time: n.time || '', text: n.text || '' };
                })
              : [{ time: hm(Date.now()), text: '' }]
          }))
        : [{ name: '', room: '', notes: [{ time: hm(Date.now()), text: '' }] }]
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadPdf = async (r: DutyReport) => {
    setPdfBusyId(r.id);
    try {
      await generateDutyReportPdf(r);
    } catch (e) {
      console.error('PDF error', e);
      alert('Có lỗi khi tạo file PDF.');
    } finally {
      setPdfBusyId(null);
    }
  };

  const handleCopyText = (r: DutyReport) => {
    navigator.clipboard.writeText(r.text || generateReportText(r));
    setCopiedId(r.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Filtered reports by search query (doctor, nurse, date, patient)
  const filteredReports = reports.filter((r) => {
    const q = fold(searchQuery.trim());
    if (!q) return true;
    const matchDoc = fold(r.doctor).includes(q);
    const matchNurse = fold(r.nurse).includes(q);
    const dateFormatted = dmy(fromIso(r.date));
    const dmFormatted = dm(fromIso(r.date));
    const matchDate =
      fold(r.date).includes(q) ||
      fold(dateFormatted).includes(q) ||
      fold(dmFormatted).includes(q);
    const matchPatient =
      r.stats.admits.some((a) => fold(a.name).includes(q) || fold(a.room).includes(q)) ||
      r.stats.transfers.some((t) => fold(t.name).includes(q) || fold(t.room).includes(q)) ||
      r.stats.evs.some((e) => fold(e.name).includes(q) || fold(e.room).includes(q)) ||
      r.blocks.some((b) => {
        const nameMatch = fold(b.name).includes(q) || fold(b.room).includes(q);
        const noteMatch = b.notes.some((n) => {
          const text = typeof n === 'object' ? n.text : n;
          return fold(text).includes(q);
        });
        return nameMatch || noteMatch;
      });
    return matchDoc || matchNurse || matchDate || matchPatient;
  });

  const displayedReports = filteredReports.slice(0, visibleCount);
  const hasMore = visibleCount < filteredReports.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Shift Form */}
      <div className="lg:col-span-7 bg-white p-4 md:p-5 rounded-2xl border border-[#DDE1DC] shadow-xs space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onGoBack && (
                <button
                  type="button"
                  onClick={onGoBack}
                  className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer mr-1"
                  title="Quay lại"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Quay lại</span>
                </button>
              )}
              <h2 className="text-base md:text-lg font-bold text-[#0F2F2A]">
                {editingId ? 'Sửa báo cáo trực' : 'Lập báo cáo trực lâm sàng'}
              </h2>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setDoctor('');
                  setNurse('');
                  setBlocks([{ name: '', room: '', notes: [''] }]);
                }}
                className="text-xs text-red-600 hover:underline font-semibold"
              >
                Hủy sửa
              </button>
            )}
          </div>
          <p className="text-xs text-[#56615C] mt-0.5">{windowText} · Số liệu tự động cập nhật</p>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#3A4540] mb-1">Ngày trực</label>
            <input
              type="date"
              value={dutyDate}
              onChange={(e) => setDutyDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3A4540] mb-1">Bác sĩ trực *</label>
            <input
              type="text"
              placeholder="VD: BS. Nguyễn Văn An"
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3A4540] mb-1">Điều dưỡng trực</label>
            <input
              type="text"
              placeholder="VD: ĐD. Trần Thị Bình"
              value={nurse}
              onChange={(e) => setNurse(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
            />
          </div>
        </div>

        {/* Stats Grid 7 Cells */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-center">
          {[
            { label: 'Cũ', val: currentStats.cu, bg: 'bg-[#F3F4F1] text-[#3A4540]' },
            { label: 'Vào', val: currentStats.vao, bg: 'bg-emerald-50 text-emerald-800' },
            { label: 'Ra', val: currentStats.ra, bg: 'bg-orange-50 text-orange-800' },
            { label: 'Chuyển khoa', val: currentStats.ck, bg: 'bg-blue-50 text-blue-800' },
            { label: 'Chuyển viện', val: currentStats.cv, bg: 'bg-purple-50 text-purple-800' },
            { label: 'Còn', val: currentStats.con, bg: 'bg-[#0E6B5E] text-white font-bold' },
            { label: 'Tiêm khớp', val: currentStats.tiem, bg: 'bg-teal-50 text-teal-800' }
          ].map((st, i) => (
            <div key={i} className={`p-2 rounded-xl ${st.bg}`}>
              <div className="text-[10px] font-semibold uppercase">{st.label}</div>
              <div className="text-xl font-bold mt-0.5">{st.val}</div>
            </div>
          ))}
        </div>

        {/* Section 1: Inpatient admits in shift */}
        <div className="border border-[#DDE1DC] rounded-xl overflow-hidden">
          <div className="px-3.5 py-2 bg-[#F3F4F1] font-bold text-xs text-[#0B5C51] flex items-center justify-between">
            <span>Bệnh nhân vào viện trong ca · {currentStats.admits.length}</span>
          </div>
          <div className="divide-y divide-[#EEF0ED] max-h-36 overflow-y-auto">
            {!currentStats.admits.length ? (
              <div className="p-3 text-xs text-[#56615C]">Không có bệnh nhân vào viện trong ca trực.</div>
            ) : (
              currentStats.admits.map((a, i) => (
                <div key={i} className="p-2.5 text-xs flex items-baseline gap-2">
                  <span className="text-[#8A948F] w-4">{i + 1}.</span>
                  <strong>{a.name}</strong>
                  <span className="text-[#56615C]">
                    {ageText(a)} · {a.room} · Vào {hm(a.at)} {dm(a.at)}
                  </span>
                  {a.note && <span className="text-[#2B3531] truncate flex-1">({a.note})</span>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 2: Transfers in shift */}
        <div className="border border-[#DDE1DC] rounded-xl overflow-hidden">
          <div className="px-3.5 py-2 bg-[#F3F4F1] font-bold text-xs text-[#0B5C51] flex items-center justify-between">
            <span>Bệnh nhân chuyển khoa / chuyển viện · {currentStats.transfers.length}</span>
          </div>
          <div className="divide-y divide-[#EEF0ED] max-h-32 overflow-y-auto">
            {!currentStats.transfers.length ? (
              <div className="p-3 text-xs text-[#56615C]">Không có bệnh nhân chuyển trong ca trực.</div>
            ) : (
              currentStats.transfers.map((a, i) => (
                <div key={i} className="p-2.5 text-xs flex items-baseline gap-2">
                  <span className="text-[#8A948F] w-4">{i + 1}.</span>
                  <strong>{a.name}</strong>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                    {KIND_LABELS[a.kind]}
                  </span>
                  <span className="text-[#56615C]">
                    {a.room} · {hm(a.at)} {dm(a.at)}
                  </span>
                  {a.note && <span className="text-[#2B3531] truncate flex-1">({a.note})</span>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 3: Abnormal clinical events in shift */}
        <div className="border border-[#E7C4AC] rounded-xl overflow-hidden">
          <div className="px-3.5 py-2 bg-[#FDF0E5] font-bold text-xs text-[#7E3204] flex items-center justify-between">
            <span>Diễn biến bất thường trong ca (từ hồ sơ DHST) · {currentStats.evs.length}</span>
          </div>
          <div className="divide-y divide-[#F5D8C4] max-h-40 overflow-y-auto">
            {!currentStats.evs.length ? (
              <div className="p-3 text-xs text-[#56615C]">
                Không có diễn biến bất thường được đánh dấu trong mục DHST.
              </div>
            ) : (
              currentStats.evs.map((e, i) => (
                <div key={i} className="p-2.5 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#7E3204]">{i + 1}. {e.name}</span>
                    <span className="text-[#56615C]">({e.room}) · {hm(e.at)} {dm(e.at)}</span>
                  </div>
                  <div className="text-[#17201D] pl-4">{e.note || 'Bất thường DHST'} ({e.vit})</div>
                  {e.tx.map((t) => (
                    <div key={t.id} className="text-emerald-800 font-medium pl-6 text-[11px]">
                      → Xử trí: {t.text}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 4: Manual additional notes with patient picker & auto-filled room */}
        <div className="border border-[#DDE1DC] rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-[#0B5C51]">Ghi thêm diễn biến lâm sàng</span>
            <button
              type="button"
              onClick={addBlock}
              className="text-xs text-[#0E6B5E] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm BN
            </button>
          </div>

          <div className="space-y-3">
            {blocks.map((b, bIdx) => {
              const selectedValue = b.name ? `${b.name}__${b.room}` : '';

              return (
                <div key={bIdx} className="p-3 rounded-xl bg-[#FAFBF9] border border-[#E6E9E5] space-y-2.5 relative">
                  {/* Row 1: Patient Selection Dropdown + Auto-filled Room + Delete */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#0E6B5E] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      {bIdx + 1}
                    </span>

                    {/* Dropdown selecting current inpatients */}
                    <div className="flex-1 min-w-[200px]">
                      <select
                        value={selectedValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            updateBlockPatient(bIdx, '', '');
                            return;
                          }
                          const pt = currentInpatients.find((p) => `${p.name}__${p.room}` === val);
                          if (pt) {
                            updateBlockPatient(bIdx, pt.name, pt.room);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#C3CAC4] text-xs font-semibold focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white cursor-pointer"
                      >
                        <option value="">-- Chọn bệnh nhân đang nằm viện ({currentInpatients.length}) --</option>
                        {currentInpatients.map((p) => (
                          <option key={p.id} value={`${p.name}__${p.room}`}>
                            P.{p.room} · {p.name} ({ageText(p)})
                          </option>
                        ))}
                        {b.name && !currentInpatients.some((p) => p.name === b.name) && (
                          <option value={selectedValue}>
                            [P.{b.room}] {b.name} (Đã xuất viện / Nhập tay)
                          </option>
                        )}
                      </select>
                    </div>

                    {/* Auto-filled Room */}
                    <div className="flex items-center gap-1 shrink-0" title="Phòng (tự động điền theo bệnh nhân đã chọn)">
                      <span className="text-[11px] text-gray-500 font-semibold">Phòng:</span>
                      <input
                        type="text"
                        placeholder="Phòng"
                        value={b.room}
                        onChange={(e) => updateBlockRoom(bIdx, e.target.value)}
                        className="w-16 px-2 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-bold text-[#0E6B5E] text-center focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
                      />
                    </div>

                    {/* Delete Block */}
                    <button
                      type="button"
                      onClick={() => removeBlock(bIdx)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded cursor-pointer transition-colors"
                      title="Xóa bệnh nhân này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Notes lines with Giờ diễn biến & Expandable Content */}
                  <div className="space-y-2 sm:pl-7">
                    {b.notes.map((n, nIdx) => (
                      <ExpandableDutyNoteLine
                        key={nIdx}
                        time={n.time}
                        text={n.text}
                        placeholder={`Diễn biến ${nIdx + 1}: đau khớp, sốt, đáp ứng thuốc, xử trí...`}
                        onTimeChange={(val) => updateNoteTime(bIdx, nIdx, val)}
                        onTextChange={(val) => updateNoteText(bIdx, nIdx, val)}
                        onAddLine={() => addNoteLine(bIdx)}
                        onRemoveLine={() => removeNoteLine(bIdx, nIdx)}
                        canRemove={b.notes.length > 1}
                      />
                    ))}

                    {/* Nút thêm diễn biến mới nằm ngay dưới diễn biến đã có */}
                    <button
                      type="button"
                      onClick={() => addNoteLine(bIdx)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[#0E6B5E]/60 hover:border-[#0E6B5E] text-[#0B5C51] hover:bg-emerald-50 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#0E6B5E]" />
                      <span>Thêm diễn biến mới</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {err && <p className="text-xs text-red-700 bg-red-50 p-2 rounded-lg">{err}</p>}

        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          {editingId ? 'Lưu thay đổi' : 'Lưu báo cáo trực'}
        </button>
      </div>

      {/* Right Column: Saved Reports */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#DDE1DC] shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEF0ED] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#0F2F2A]">
                Báo cáo trực đã lưu
              </h2>
              <p className="text-xs text-[#56615C]">
                {filteredReports.length === reports.length
                  ? `Tổng số ${reports.length} báo cáo · Hiển thị ${Math.min(visibleCount, reports.length)} cái`
                  : `Tìm thấy ${filteredReports.length} / ${reports.length} báo cáo`}
              </p>
            </div>
            {visibleCount > 3 && (
              <button
                type="button"
                onClick={() => setVisibleCount(3)}
                className="text-xs text-[#0E6B5E] hover:underline font-semibold flex items-center gap-1"
              >
                <ChevronUp className="w-3.5 h-3.5" /> Thu gọn
              </button>
            )}
          </div>

          {/* Search box by Doctor, Nurse, Date, Patient */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Tìm theo tên BS, ngày trực (VD: 01/11, 2026), tên BN..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(3);
              }}
              className="w-full pl-8.5 pr-8 py-2 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setVisibleCount(3);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!filteredReports.length ? (
            <div className="p-6 text-center text-xs text-[#56615C] bg-[#FAFBF9] rounded-xl border border-dashed border-[#DDE1DC]">
              {searchQuery ? 'Không tìm thấy báo cáo nào khớp với từ khóa.' : 'Chưa có báo cáo trực nào được lưu.'}
            </div>
          ) : (
            <>
              <div className="divide-y divide-[#EEF0ED]">
                {displayedReports.map((r) => (
                  <div key={r.id} className="py-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onViewReport(r)}
                        className="text-left group flex-1 min-w-0"
                      >
                        <div className="font-bold text-sm text-[#17201D] group-hover:text-[#0E6B5E] transition-colors truncate">
                          Trực ngày {dmy(fromIso(r.date))}
                        </div>
                        <div className="text-xs text-[#56615C] truncate mt-0.5">
                          BS. {r.doctor} {r.nurse ? `· ĐD. ${r.nurse}` : ''}
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(r)}
                          disabled={pdfBusyId === r.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#0E6B5E] bg-white hover:bg-[#E4F0EC] text-[#0B5C51] text-xs font-semibold transition-colors disabled:opacity-50"
                          title="Tải file PDF chuẩn in ấn"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{pdfBusyId === r.id ? 'Tạo...' : 'PDF'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyText(r)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors"
                          title="Sao chép toàn bộ nội dung báo cáo"
                        >
                          {copiedId === r.id ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEdit(r)}
                          className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors"
                          title="Sửa báo cáo này"
                        >
                          Sửa
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#56615C] flex flex-wrap gap-2 pt-1 border-t border-dashed border-[#EEF0ED]">
                      <span>Cũ: <strong>{r.stats.cu}</strong></span>
                      <span>Vào: <strong className="text-emerald-700">{r.stats.vao}</strong></span>
                      <span>Ra: <strong className="text-orange-700">{r.stats.ra}</strong></span>
                      <span>Còn: <strong className="text-emerald-800">{r.stats.con}</strong></span>
                      <span>Tiêm: <strong>{r.stats.tiem}</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              {/* "Xem thêm" button to load 3 more */}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 3)}
                  className="w-full py-2.5 mt-2 rounded-xl border border-[#0E6B5E] bg-emerald-50/50 hover:bg-[#E4F0EC] text-[#0B5C51] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>
                    Xem thêm ({Math.min(3, filteredReports.length - visibleCount)} / {filteredReports.length - visibleCount} báo cáo tiếp)
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
