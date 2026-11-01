import { Patient, VitalRecord, ScheduleItem, DutyReport, DutyStats } from '../types';
import { isoDay, fromIso, DAY, HOUR, pad, num, VKEYS, hasVit, KIND_LABELS } from './constants';

export function demoPatients(now: number): Patient[] {
  const ins = [2, 1, 3, 1, 2, 0, 2, 3, 1, 2, 1, 2, 3, 2];
  const los = [4, 6, 3, 7, 5, 8, 4, 5, 6, 3];
  const names = [
    'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cúc', 'Phạm Minh Đức',
    'Hoàng Văn Em', 'Vũ Thị Gấm', 'Đỗ Thành Hải', 'Bùi Thị Kim',
    'Ngô Quang Lâm', 'Dương Thị Mai', 'Đinh Văn Nam', 'Lý Thị Oanh',
    'Phan Văn Phúc', 'Đoàn Thị Quyên', 'Trịnh Hữu Sang', 'Võ Thị Tâm',
    'Lương Thế Vinh', 'Cao Thị Xuân', 'Đặng Đình Yên', 'Hà Thị Bích'
  ];
  const ages = [67, 54, 72, 45, 61, 38, 70, 58, 49, 76, 63, 52, 81, 44, 59, 66, 71, 57, 48, 69];
  const rooms = ['P.301', 'P.302', 'P.303', 'P.304', 'P.305', 'P.306'];
  const notes = [
    'Thoái hóa khớp gối 2 bên gđ 3, tràn dịch nhẹ khớp P',
    'Viêm cột sống dính khớp, đau nhiều vùng cột sống thắt lưng',
    'Gout mạn tophi ngón 1 bàn chân P, đợt cấp',
    'Viêm khớp dạng thấp huyết thanh dương tính, DAS28 = 4.2',
    'Loãng xương nặng, đau lưng sau ngã nhẹ, theo dõi xẹp ĐS',
    'Hội chứng ống cổ tay 2 bên, tê bì bàn tay về đêm',
    'Viêm gân chóp xoay vai P, hạn chế vận động',
    'Đau thần kinh tọa T do thoát vị đĩa đệm L4-L5'
  ];
  const vs = [
    { pulse: '82', bp: '130/80', temp: '36.8', spo2: '98', rr: '18' },
    { pulse: '104', bp: '165/95', temp: '38.2', spo2: '97', rr: '20' },
    { pulse: '76', bp: '120/70', temp: '36.6', spo2: '98', rr: '18' },
    { pulse: '88', bp: '140/85', temp: '37.0', spo2: '96', rr: '19' }
  ];

  const start = fromIso(isoDay(now));
  const out: Patient[] = [];
  let id = 1;

  for (let d = 0; d < ins.length; d++) {
    const dayStart = start - (ins.length - 1 - d) * DAY;
    for (let j = 0; j < ins[d]; j++) {
      let at = dayStart + ((8 + (j * 3 + d) % 10) * HOUR);
      if (at > now) at = now - ((j + 1) * 1.5 * HOUR);
      const outAt = at + (los[id % los.length] * DAY);
      const initialV = vs[id % vs.length];
      const pName = names[(id - 1) % names.length];
      const pNote = notes[(id - 1) % notes.length];

      const p: Patient = {
        id,
        name: pName,
        age: String(ages[id % ages.length]),
        room: rooms[id % rooms.length],
        note: pNote,
        admitAt: at,
        status: outAt < now ? 'out' : 'in',
        outAt: outAt < now ? outAt : null,
        outKind: outAt < now ? (id % 4 === 0 ? 'ck' : id % 7 === 0 ? 'cv' : 'ra') : undefined,
        outNote: outAt < now ? (id % 4 === 0 ? 'Chuyển khoa Phục hồi chức năng tiếp tục tập' : 'Tình trạng ổn định, đỡ đau khớp, hẹn tái khám sau 2 tuần') : '',
        av: { ...initialV },
        ...initialV
      };

      out.push(p);
      id++;
    }
  }

  return out;
}

export function demoRecs(pts: Patient[], now: number): VitalRecord[] {
  const recs: VitalRecord[] = [];
  let id = 100;
  const today0 = fromIso(isoDay(now));

  pts.forEach((p) => {
    if (p.status !== 'in') return;
    const bp = String(p.bp || '120/80').split('/');
    const b = {
      m: num(p.pulse) || 80,
      sy: num(bp[0]) || 125,
      di: num(bp[1]) || 78,
      t: num(p.temp) || 36.8,
      o: num(p.spo2) || 98,
      r: num(p.rr) || 18
    };
    const fever = b.t >= 38;
    let idx = 0;
    let last: VitalRecord | null = null;

    for (let dd = 3; dd >= 0; dd--) {
      const d0 = today0 - dd * DAY;
      [7, 15].forEach((h) => {
        const at = d0 + h * HOUR + ((p.id % 4) * 5 * 60000);
        if (at <= p.admitAt + HOUR || at > now) return;
        const j = (((p.id * 7 + idx * 3) % 5) - 2);
        const t = fever ? Math.max(36.8, b.t - idx * 0.3) : b.t + j * 0.1;

        const rec: VitalRecord = {
          id: id++,
          pid: p.id,
          at,
          pulse: String(Math.round(fever ? Math.max(84, b.m - idx * 4) : b.m + j * 2)),
          bp: `${b.sy + j * 3}/${b.di + j * 2}`,
          temp: t.toFixed(1),
          spo2: String(Math.min(99, b.o + (j > 0 ? 1 : 0))),
          rr: String(b.r + (j > 1 ? 1 : 0)),
          note: idx % 4 === 0 ? 'Bệnh nhân tỉnh táo, tiếp xúc tốt, đau khớp có giảm sau dùng NSAID' : '',
          abn: false,
          tx: []
        };
        recs.push(rec);
        last = rec;
        idx++;
      });
    }

    const back = (3 + (p.id % 6)) * HOUR + ((p.id % 3) * 17 * 60000);
    if (fever && now - back > p.admitAt + HOUR) {
      const at2 = now - back;
      const ev: VitalRecord = {
        id: id++,
        pid: p.id,
        at: at2,
        pulse: '108',
        bp: '150/90',
        temp: '38.6',
        spo2: '96',
        rr: '22',
        note: 'Sốt 38,6°C kèm rét run, đau sưng tăng khớp cổ tay P, khớp gối T.',
        abn: true,
        tx: [
          {
            id: id++,
            at: at2 + 10 * 60000,
            text: 'Paracetamol 1g truyền TM; chườm ấm; làm xét nghiệm CRP, Procalcitonin; cấy máu.'
          }
        ]
      };
      recs.push(ev);
      if (!last || (last as VitalRecord).at < at2) last = ev;
    }

    if (last) {
      VKEYS.forEach((k) => {
        if ((last as VitalRecord)[k]) {
          p[k] = (last as VitalRecord)[k];
        }
      });
    }
  });

  return recs;
}

export function demoScheds(pts: Patient[], now: number): ScheduleItem[] {
  const today = isoDay(now);
  const tomorrow = isoDay(now + DAY);
  const active = pts.filter((p) => p.status === 'in');
  const p1 = active[0]?.id || 1;
  const p2 = active[1]?.id || p1;
  const p3 = active[2]?.id || p1;
  const p4 = active[3]?.id || p1;

  return [
    {
      id: 1,
      type: 'tiem',
      patientId: p1,
      site: 'Khớp gối P',
      date: today,
      time: '08:30',
      who: 'BS. Tuấn',
      note: 'Tiêm Diprospan 1 ống dưới hướng dẫn siêu âm',
      done: true
    },
    {
      id: 2,
      type: 'tiem',
      patientId: p2,
      site: 'Khớp vai T',
      date: today,
      time: '09:45',
      who: 'BS. Lan',
      note: 'Tiêm Acid Hyaluronic dịch khớp nhân tạo',
      done: false
    },
    {
      id: 3,
      type: 'dien',
      patientId: p3,
      site: 'Chi trên 2 bên',
      date: today,
      time: '14:00',
      who: 'KTV. Hoàng',
      note: 'Khảo sát điện thần kinh cơ hội chứng ống cổ tay',
      done: false
    },
    {
      id: 4,
      type: 'tiem',
      patientId: p4,
      site: 'Khớp gối T',
      date: tomorrow,
      time: '08:15',
      who: 'BS. Tuấn',
      note: 'Hút dịch khớp làm xét nghiệm và tiêm Corticoid',
      done: false
    }
  ];
}

export function demoReports(pts: Patient[], now: number): DutyReport[] {
  const doctors = ['BS. Nguyễn Thị Lan', 'BS. Trần Văn Minh', 'BS. Lê Hoàng Tuấn', 'BS. Phạm Mai Hương', 'BS. Đỗ Đức Cường'];
  const nurses = ['ĐD. Vũ Thị Hằng', 'ĐD. Bùi Văn Nam', 'ĐD. Trịnh Thu Hà', 'ĐD. Ngô Thị Yến', 'ĐD. Lê Văn Khoa'];
  const reports: DutyReport[] = [];

  for (let d = 1; d <= 5; d++) {
    const shiftStart = fromIso(isoDay(now - d * DAY)) + 7 * HOUR;
    const shiftEnd = shiftStart + DAY;
    const dateStr = isoDay(shiftStart);

    const admits = [
      {
        name: `BN. Nguyễn Văn ${String.fromCharCode(65 + d)}`,
        age: `${50 + d}`,
        room: `P.30${(d % 6) + 1}`,
        at: shiftStart + (3 + d) * HOUR,
        note: d % 2 === 0 ? 'Thoái hóa khớp gối tràn dịch cấp' : 'Đợt cấp Gout mạn tophi'
      }
    ];

    const transfers = d % 2 === 0 ? [
      {
        name: `BN. Trần Thị ${String.fromCharCode(75 + d)}`,
        age: `${60 + d}`,
        room: 'P.302',
        at: shiftStart + 8 * HOUR,
        kind: 'ck' as const,
        note: 'Chuyển khoa Phục hồi chức năng tiếp tục điều trị'
      }
    ] : [];

    const evs = [
      {
        pid: 10 + d,
        name: `BN. Lê Hoàng ${String.fromCharCode(80 + d)}`,
        room: `P.30${((d + 2) % 6) + 1}`,
        at: shiftStart + 14 * HOUR,
        note: 'Đau buốt tăng nhiều khớp vai P về đêm, hạn chế vận động',
        vit: 'Mạch 86 l/p, HA 135/85 mmHg, Nhiệt 37.2 °C',
        tx: [
          {
            id: 900 + d,
            at: shiftStart + 14.2 * HOUR,
            text: 'Chườm mát khớp vai, uống Meloxicam 7.5mg x 1 viên sau ăn'
          }
        ]
      }
    ];

    const stats: DutyStats = {
      start: shiftStart,
      end: shiftEnd,
      cu: 22 - d,
      vao: admits.length,
      ra: 2,
      ck: transfers.length,
      cv: 0,
      con: 22 - d + admits.length - 2 - transfers.length,
      tiem: 3,
      tiemDone: 3,
      admits,
      transfers,
      evs
    };

    const rep: DutyReport = {
      id: 5000 + d,
      savedAt: shiftEnd + 30 * 60000,
      date: dateStr,
      doctor: doctors[(d - 1) % doctors.length],
      nurse: nurses[(d - 1) % nurses.length],
      stats,
      blocks: [
        {
          name: `BN. Đỗ Thị ${String.fromCharCode(70 + d)}`,
          room: `P.30${(d % 6) + 1}`,
          notes: ['Người bệnh đáp ứng tốt với đợt tiêm khớp gối, đi lại đỡ cứng khớp buổi sáng.']
        }
      ],
      text: ''
    };

    reports.push(rep);
  }

  return reports;
}
