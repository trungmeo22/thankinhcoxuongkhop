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

export interface DutyBlock {
  name: string;
  room: string;
  notes: string[];
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
}

