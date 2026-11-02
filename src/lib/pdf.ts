import { jsPDF } from 'jspdf';
import { DutyReport } from '../types';
import { hm, dm, dmy, KIND_LABELS } from './constants';
import { FONT_BVP_REGULAR, FONT_BVP_BOLD } from './fontsData';

export async function generateDutyReportPdf(r: DutyReport): Promise<void> {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait'
  });

  // Register TrueType fonts supporting complete Vietnamese Unicode
  doc.addFileToVFS('BeVietnamPro-Regular.ttf', FONT_BVP_REGULAR);
  doc.addFont('BeVietnamPro-Regular.ttf', 'BVP', 'normal');

  doc.addFileToVFS('BeVietnamPro-Bold.ttf', FONT_BVP_BOLD);
  doc.addFont('BeVietnamPro-Bold.ttf', 'BVP', 'bold');

  // Set default font
  doc.setFont('BVP', 'normal');

  // Page geometry
  const M = 15; // Left & Right margin (15mm)
  const PAGE_W = 210;
  const PAGE_H = 297;
  const W = PAGE_W - 2 * M; // 180mm printable width
  const FOOTER_Y = PAGE_H - 10;
  const MAX_Y = PAGE_H - 18;

  let y = 15;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > MAX_Y) {
      doc.addPage();
      y = 15;
    }
  };

  // 1. Header Information
  doc.setFont('BVP', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 38);
  doc.text('ĐƠN NGUYÊN CƠ XƯƠNG KHỚP', M, y);

  doc.setFont('BVP', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 100, 96);
  doc.text(`Lập lúc: ${hm(r.savedAt)} ${dmy(r.savedAt)}`, PAGE_W - M, y, { align: 'right' });

  y += 9;

  // Title
  doc.setFont('BVP', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 47, 42);
  doc.text('BÁO CÁO TRỰC', PAGE_W / 2, y, { align: 'center' });

  y += 5.5;
  doc.setFont('BVP', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 80, 76);
  doc.text(`Ngày trực: ${dmy(r.stats.start)}`, PAGE_W / 2, y, { align: 'center' });

  y += 7.5;

  // Personnel info
  doc.setFontSize(9.5);
  doc.setTextColor(23, 32, 29);
  doc.setFont('BVP', 'bold');
  doc.text('Bác sĩ trực:', M, y);
  doc.setFont('BVP', 'normal');
  doc.text(r.doctor, M + 23, y);

  if (r.nurse) {
    doc.setFont('BVP', 'bold');
    doc.text('Điều dưỡng trực:', 110, y);
    doc.setFont('BVP', 'normal');
    doc.text(r.nurse, 142, y);
  }

  y += 6;

  // 2. Shift 7 Metric Summary Table
  const c = r.stats;
  const cells = [
    { label: 'Cũ', val: c.cu },
    { label: 'Vào', val: c.vao },
    { label: 'Ra', val: c.ra },
    { label: 'Chuyển khoa', val: c.ck },
    { label: 'Chuyển viện', val: c.cv },
    { label: 'Còn', val: c.con },
    { label: 'Tiêm khớp', val: c.tiem },
  ];

  const cw = W / cells.length; // ~25.71mm per cell

  doc.setDrawColor(180, 205, 198);
  doc.setLineWidth(0.3);

  cells.forEach((cl, i) => {
    const x = M + i * cw;

    // Header box
    doc.setFillColor(236, 245, 242);
    doc.rect(x, y, cw, 6.5, 'FD');
    doc.setFont('BVP', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 47, 42);
    doc.text(cl.label, x + cw / 2, y + 4.5, { align: 'center' });

    // Value box
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y + 6.5, cw, 8.5, 'FD');
    doc.setFont('BVP', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(cl.label === 'Còn' ? 14 : 20, cl.label === 'Còn' ? 107 : 30, cl.label === 'Còn' ? 94 : 28);
    doc.text(String(cl.val), x + cw / 2, y + 12.8, { align: 'center' });
  });

  y += 15; // Move to bottom edge of metric table

  if (c.tiem > 0) {
    y += 4;
    doc.setFont('BVP', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 90, 86);
    doc.text(`* Thủ thuật trong ca: Tiêm khớp ${c.tiem} ca (Đã thực hiện: ${c.tiemDone} ca)`, M, y);
    y += 3;
  }

  y += 8.5; // Clear gap separating the table above from Section 1

  // Helper for crisp, aligned tables
  const renderTable = (
    title: string,
    cols: { label: string; width: number; align: 'left' | 'center' | 'right' }[],
    data: string[][]
  ) => {
    ensureSpace(18);

    // Section title
    doc.setFont('BVP', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 47, 42);
    doc.text(`${title} (${data.length})`, M, y);
    y += 1.8;

    // Accent line
    doc.setDrawColor(14, 107, 94);
    doc.setLineWidth(0.4);
    doc.line(M, y, M + W, y);
    y += 4.2;

    if (!data.length) {
      doc.setFont('BVP', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(110, 120, 116);
      doc.text('Không có.', M + 2, y);
      y += 6;
      return;
    }

    // Draw table header
    const drawHead = () => {
      doc.setFillColor(242, 245, 243);
      doc.rect(M, y - 3.5, W, 6, 'F');
      doc.setDrawColor(200, 210, 205);
      doc.setLineWidth(0.25);
      doc.rect(M, y - 3.5, W, 6, 'S');

      doc.setFont('BVP', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(45, 55, 50);

      let curX = M;
      cols.forEach((col) => {
        const textX =
          col.align === 'center'
            ? curX + col.width / 2
            : col.align === 'right'
            ? curX + col.width - 2
            : curX + 2;
        doc.text(col.label, textX, y + 0.8, { align: col.align });
        curX += col.width;
      });
      y += 4;
    };

    drawHead();

    // Draw rows
    data.forEach((row) => {
      // Calculate max lines needed for this row
      const cellLines = row.map((text, idx) => {
        const colW = cols[idx].width - 3;
        return doc.splitTextToSize(text || '—', colW);
      });
      const maxL = Math.max(...cellLines.map((l) => l.length), 1);
      const rowHeight = maxL * 4.2 + 2;

      // Check page break
      if (y + rowHeight > MAX_Y) {
        doc.addPage();
        y = 15;
        drawHead();
      }

      doc.setFont('BVP', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(25, 35, 30);

      let curX = M;
      cellLines.forEach((lines, idx) => {
        const col = cols[idx];
        const textX =
          col.align === 'center'
            ? curX + col.width / 2
            : col.align === 'right'
            ? curX + col.width - 2
            : curX + 2;
        doc.text(lines, textX, y + 1.2, { align: col.align });
        curX += col.width;
      });

      y += rowHeight - 1;
      doc.setDrawColor(225, 230, 227);
      doc.setLineWidth(0.2);
      doc.line(M, y, M + W, y);
      y += 2.2;
    });

    y += 2;
  };

  // Table 1: Inpatient admissions in shift
  renderTable(
    '1. BỆNH NHÂN VÀO VIỆN TRONG CA',
    [
      { label: 'TT', width: 10, align: 'center' },
      { label: 'Họ tên', width: 45, align: 'left' },
      { label: 'Tuổi', width: 14, align: 'center' },
      { label: 'Phòng', width: 18, align: 'center' },
      { label: 'Giờ vào', width: 28, align: 'center' },
      { label: 'Chẩn đoán / Lý do nhập viện', width: 65, align: 'left' },
    ],
    c.admits.map((a, i) => [
      String(i + 1),
      a.name,
      a.age ? String(a.age) : '—',
      a.room,
      `${hm(a.at)} ${dm(a.at)}`,
      a.note || '—'
    ])
  );

  // Table 2: Inpatient transfers in shift
  renderTable(
    '2. BỆNH NHÂN CHUYỂN KHOA / CHUYỂN VIỆN',
    [
      { label: 'TT', width: 10, align: 'center' },
      { label: 'Họ tên', width: 45, align: 'left' },
      { label: 'Tuổi', width: 14, align: 'center' },
      { label: 'Phòng', width: 18, align: 'center' },
      { label: 'Hình thức', width: 24, align: 'center' },
      { label: 'Giờ', width: 24, align: 'center' },
      { label: 'Nơi chuyển / Ghi chú', width: 45, align: 'left' },
    ],
    c.transfers.map((a, i) => [
      String(i + 1),
      a.name,
      a.age ? String(a.age) : '—',
      a.room,
      KIND_LABELS[a.kind] || a.kind,
      `${hm(a.at)} ${dm(a.at)}`,
      a.note || '—'
    ])
  );

  // 3. Clinical Evolution
  ensureSpace(20);
  doc.setFont('BVP', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 47, 42);
  doc.text('3. DIỄN BIẾN LÂM SÀNG BẤT THƯỜNG TRONG CA', M, y);
  y += 1.8;
  doc.setDrawColor(14, 107, 94);
  doc.setLineWidth(0.4);
  doc.line(M, y, M + W, y);
  y += 5;

  // Aggregate abnormal vitals and manual blocks
  const clinicalItems: { title: string; notes: string[] }[] = [];

  c.evs.forEach((e) => {
    let blk = clinicalItems.find((x) => x.title.includes(e.name));
    if (!blk) {
      blk = {
        title: `• [${e.room}] ${e.name}:`,
        notes: []
      };
      clinicalItems.push(blk);
    }
    blk.notes.push(
      `${hm(e.at)} ${dm(e.at)}: ${e.note || 'Bất thường dấu hiệu sinh tồn'}${e.vit ? ` (DHST: ${e.vit})` : ''}`
    );
    e.tx.forEach((t) => {
      blk?.notes.push(`→ Xử trí (${hm(t.at)}): ${t.text}`);
    });
  });

  r.blocks.forEach((b) => {
    const formattedNotes: string[] = [];
    b.notes.forEach((n) => {
      const timePrefix = typeof n === 'object' && n.time ? `[${n.time}] ` : '';
      const text = typeof n === 'object' ? n.text : n;
      if (text && text.trim()) {
        formattedNotes.push(`${timePrefix}${text.trim()}`);
      }
    });

    if (b.name || b.room || formattedNotes.length > 0) {
      clinicalItems.push({
        title: `• [${b.room || '—'}] ${b.name || '(Chưa rõ tên)'}:`,
        notes: formattedNotes
      });
    }
  });

  if (!clinicalItems.length) {
    doc.setFont('BVP', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(110, 120, 116);
    doc.text('Không có diễn biến bất thường trong ca trực.', M + 2, y);
    y += 8;
  } else {
    clinicalItems.forEach((ci) => {
      ensureSpace(12);
      doc.setFont('BVP', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(20, 30, 28);
      doc.text(ci.title, M + 2, y);
      y += 4.5;

      doc.setFont('BVP', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 50, 46);

      ci.notes.forEach((nt) => {
        const lines = doc.splitTextToSize(nt, W - 8);
        ensureSpace(lines.length * 4 + 1);
        doc.text(lines, M + 6, y);
        y += lines.length * 4 + 0.8;
      });
      y += 1.5;
    });
  }

  // 4. Signature Block
  ensureSpace(34);
  y += 5;

  const sigX = PAGE_W - M - 35; // Center of right signature block (~160mm)

  doc.setFont('BVP', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 90, 86);
  const nowD = new Date(r.savedAt);
  doc.text(`Ngày ${nowD.getDate()} tháng ${nowD.getMonth() + 1} năm ${nowD.getFullYear()}`, sigX, y, { align: 'center' });

  y += 4.5;
  doc.setFont('BVP', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 47, 42);
  doc.text('BÁC SĨ TRỰC', sigX, y, { align: 'center' });

  y += 4;
  doc.setFont('BVP', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110, 120, 116);
  doc.text('(Ký và ghi rõ họ tên)', sigX, y, { align: 'center' });

  y += 18;
  doc.setFont('BVP', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 47, 42);
  doc.text(r.doctor, sigX, y, { align: 'center' });

  // 5. Add Page Numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('BVP', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 150, 145);
    doc.text(`Trang ${p}/${totalPages}`, PAGE_W / 2, FOOTER_Y, { align: 'center' });
    doc.text('Đơn nguyên Cơ xương khớp', M, FOOTER_Y);
  }

  // Trigger browser download
  doc.save(`bao-cao-truc-${r.date}.pdf`);
}
