import React, { useState } from 'react';
import { DutyReport } from '../../types';
import { dmy, dm, hm, KIND_LABELS } from '../../lib/constants';
import { generateDutyReportPdf } from '../../lib/pdf';
import { X, Download, Copy, Check, Edit, FileText } from 'lucide-react';

interface ViewReportModalProps {
  report: DutyReport;
  onClose: () => void;
  onEdit: (r: DutyReport) => void;
}

export const ViewReportModal: React.FC<ViewReportModalProps> = ({
  report,
  onClose,
  onEdit,
}) => {
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const c = report.stats;
  const windowText = `Từ 07:00 ${dm(c.start)} đến 07:00 ${dmy(c.end)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(report.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePdf = async () => {
    setPdfBusy(true);
    try {
      await generateDutyReportPdf(report);
    } catch (e) {
      console.error(e);
      alert('Có lỗi khi tạo file PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#DDE1DC] p-5 my-8 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between pb-3 border-b border-[#EEF0ED]">
          <div>
            <h2 className="text-base md:text-lg font-bold text-[#0F2F2A]">
              Báo cáo trực ngày {dmy(c.start)}
            </h2>
            <p className="text-xs text-[#56615C]">
              {windowText} · Lập lúc {hm(report.savedAt)} {dm(report.savedAt)}
            </p>
            <p className="text-xs font-medium text-[#17201D] mt-0.5">
              BS trực: <strong>{report.doctor}</strong> {report.nurse ? `· ĐD trực: ${report.nurse}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 7 Metric stats cards */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-center">
          {[
            { label: 'Cũ', val: c.cu, bg: 'bg-[#F3F4F1] text-[#3A4540]' },
            { label: 'Vào', val: c.vao, bg: 'bg-emerald-50 text-emerald-800' },
            { label: 'Ra', val: c.ra, bg: 'bg-orange-50 text-orange-800' },
            { label: 'Chuyển khoa', val: c.ck, bg: 'bg-blue-50 text-blue-800' },
            { label: 'Chuyển viện', val: c.cv, bg: 'bg-purple-50 text-purple-800' },
            { label: 'Còn', val: c.con, bg: 'bg-[#0E6B5E] text-white font-bold' },
            { label: 'Tiêm khớp', val: c.tiem, bg: 'bg-teal-50 text-teal-800' }
          ].map((st, i) => (
            <div key={i} className={`p-2 rounded-xl ${st.bg}`}>
              <div className="text-[10px] font-semibold uppercase">{st.label}</div>
              <div className="text-xl font-bold mt-0.5">{st.val}</div>
            </div>
          ))}
        </div>

        <div className="space-y-3.5 max-h-[55vh] overflow-y-auto pr-1 text-xs">
          {/* Section: Admits */}
          <div className="border border-[#DDE1DC] rounded-xl overflow-hidden">
            <div className="px-3.5 py-2 bg-[#F3F4F1] font-bold text-xs text-[#0B5C51]">
              Bệnh nhân vào viện trong ca ({c.admits.length})
            </div>
            <div className="divide-y divide-[#EEF0ED]">
              {!c.admits.length ? (
                <div className="p-2.5 text-gray-500">Không có.</div>
              ) : (
                c.admits.map((a, i) => (
                  <div key={i} className="p-2.5 flex items-baseline gap-2">
                    <span className="text-gray-400 w-4">{i + 1}.</span>
                    <strong>{a.name}</strong>
                    <span className="text-gray-500">{a.age}t · {a.room} · Vào {hm(a.at)} {dm(a.at)}</span>
                    {a.note && <span className="text-gray-700 flex-1 truncate">({a.note})</span>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Transfers */}
          <div className="border border-[#DDE1DC] rounded-xl overflow-hidden">
            <div className="px-3.5 py-2 bg-[#F3F4F1] font-bold text-xs text-[#0B5C51]">
              Bệnh nhân chuyển ({c.transfers.length})
            </div>
            <div className="divide-y divide-[#EEF0ED]">
              {!c.transfers.length ? (
                <div className="p-2.5 text-gray-500">Không có.</div>
              ) : (
                c.transfers.map((a, i) => (
                  <div key={i} className="p-2.5 flex items-baseline gap-2">
                    <span className="text-gray-400 w-4">{i + 1}.</span>
                    <strong>{a.name}</strong>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                      {KIND_LABELS[a.kind]}
                    </span>
                    <span className="text-gray-500">{a.room} · {hm(a.at)} {dm(a.at)}</span>
                    {a.note && <span className="text-gray-700 flex-1 truncate">({a.note})</span>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Clinical Evolution */}
          <div className="border border-[#DDE1DC] rounded-xl p-3.5 space-y-2">
            <div className="font-bold text-xs text-[#0B5C51]">Diễn biến lâm sàng</div>
            {!c.evs.length && !report.blocks.length ? (
              <div className="text-gray-500">Không có diễn biến đặc biệt.</div>
            ) : (
              <div className="space-y-2.5">
                {c.evs.map((e, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="font-semibold text-gray-900">• [{e.room}] {e.name}:</div>
                    <div className="pl-4 text-gray-700">{e.note || 'Bất thường DHST'} ({e.vit})</div>
                    {e.tx.map((t) => (
                      <div key={t.id} className="pl-6 text-emerald-800">
                        → Xử trí: {t.text}
                      </div>
                    ))}
                  </div>
                ))}

                {report.blocks.map((b, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="font-semibold text-gray-900">• [{b.room || '—'}] {b.name}:</div>
                    {b.notes.map((n, ni) => {
                      const timePrefix = typeof n === 'object' && n.time ? `[${n.time}] ` : '';
                      const text = typeof n === 'object' ? n.text : n;
                      return <div key={ni} className="pl-4 text-gray-700">- {timePrefix}{text}</div>;
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[#EEF0ED]">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép văn bản'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(report);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#0E6B5E] text-[#0B5C51] hover:bg-[#E4F0EC] text-xs font-semibold transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Sửa</span>
          </button>

          <button
            type="button"
            onClick={handlePdf}
            disabled={pdfBusy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{pdfBusy ? 'Đang tạo...' : 'Tải file PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
