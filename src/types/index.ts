export type ProcedureType = 'tiem' | 'dien';
export type DischargeKind = 'ra' | 'ck' | 'cv';

export interface VitalSignValues {
  pulse?: string;
  bp?: string;
  temp?: string;
  spo2?: string;
  rr?: string;
}

export interface Patient extends VitalSignValues {
  id: number;
  name: string;
  age: string;
  room: string;
  note: string;
  admitAt: number;
  status: 'in' | 'out';
  outAt?: number | null;
  outNote?: string;
  outKind?: DischargeKind;
  av?: VitalSignValues;
}

export interface TreatmentAction {
  id: number;
  at: number;
  text: string;
}

export interface VitalRecord extends VitalSignValues {
  id: number;
  pid: number;
  at: number;
  note: string;
  abn: boolean;
  tx: TreatmentAction[];
}

export interface ScheduleItem {
  id: number;
  type: ProcedureType;
  patientId: number;
  site: string;
  date: string;
  time: string;
  who: string;
  note: string;
  done: boolean;
}

export interface DutyNoteItem {
  time?: string;
  text: string;
}

export interface DutyBlock {
  name: string;
  room: string;
  notes: (string | DutyNoteItem)[];
}

export interface DutyShiftAdmit {
  name: string;
  age: string;
  room: string;
  at: number;
  note: string;
}

export interface DutyShiftTransfer {
  name: string;
  age: string;
  room: string;
  at: number;
  kind: DischargeKind;
  note: string;
}

export interface DutyShiftEvent {
  pid: number;
  name: string;
  room: string;
  at: number;
  note: string;
  vit: string;
  tx: TreatmentAction[];
}

export interface DutyStats {
  start: number;
  end: number;
  cu: number;
  vao: number;
  ra: number;
  ck: number;
  cv: number;
  con: number;
  tiem: number;
  tiemDone: number;
  admits: DutyShiftAdmit[];
  evs: DutyShiftEvent[];
  transfers: DutyShiftTransfer[];
}

export interface DutyReport {
  id: number;
  savedAt: number;
  date: string;
  doctor: string;
  nurse: string;
  stats: DutyStats;
  blocks: DutyBlock[];
  text: string;
}

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  loginEmail: string;
  passwordPrefix: string;
  recordDays: number;
  isCustomConfigured: boolean;
}

export interface DepartmentSettings {
  beds: number;
  rooms: string[];
  insulins?: string[];
}

export type GlucoseSlot = '06:00' | '11:00' | '17:00' | '21:00' | 'custom';

export interface GlucoseRecord {
  id: number;
  patientId: number;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:mm (e.g. 06:00, 11:00, 17:00, 21:00, or custom)
  slotType: GlucoseSlot;
  glucoseValue: string;  // e.g. "7.2" (mmol/L)
  insulinDose?: string;  // e.g. "4 UI"
  insulinType?: string;  // e.g. "Novorapid", "Mixtard 30", "Lantus"
  note?: string;         // e.g. "Trước ăn sáng", "Đói", etc.
  createdAt: number;
}


