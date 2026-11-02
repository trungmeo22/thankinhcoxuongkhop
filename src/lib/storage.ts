import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Patient, VitalRecord, ScheduleItem, DutyReport, AppConfig, GlucoseRecord } from '../types';
import { DEFAULT_INSULINS, DEFAULT_DOCTORS } from './constants';

declare global {
  interface Window {
    APP_CONFIG?: {
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
      LOGIN_EMAIL?: string;
      PASSWORD_PREFIX?: string;
      RECORD_DAYS?: number;
    };
  }
}

const DEFAULT_CONFIG: AppConfig = {
  supabaseUrl: 'https://XXXXXXXX.supabase.co',
  supabaseAnonKey: '',
  loginEmail: 'cxk@benhvien.vn',
  passwordPrefix: 'cxk-',
  recordDays: 180,
  isCustomConfigured: false,
};

export function loadAppConfig(): AppConfig {
  try {
    const saved = localStorage.getItem('cxk_app_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        isCustomConfigured: isValidSupabaseUrl(parsed.supabaseUrl) && Boolean(parsed.supabaseAnonKey && parsed.supabaseAnonKey.length > 20),
      };
    }
  } catch (e) {
    console.warn('Could not read cxk_app_config from localStorage', e);
  }

  // Check window.APP_CONFIG
  if (typeof window !== 'undefined' && window.APP_CONFIG) {
    const w = window.APP_CONFIG;
    const url = w.SUPABASE_URL || DEFAULT_CONFIG.supabaseUrl;
    const key = w.SUPABASE_ANON_KEY || DEFAULT_CONFIG.supabaseAnonKey;
    const isConfigured = isValidSupabaseUrl(url) && Boolean(key && !key.includes('DÁN_KHÓA_ANON'));
    return {
      supabaseUrl: url,
      supabaseAnonKey: key,
      loginEmail: w.LOGIN_EMAIL || DEFAULT_CONFIG.loginEmail,
      passwordPrefix: w.PASSWORD_PREFIX || DEFAULT_CONFIG.passwordPrefix,
      recordDays: w.RECORD_DAYS || DEFAULT_CONFIG.recordDays,
      isCustomConfigured: isConfigured,
    };
  }

  return DEFAULT_CONFIG;
}

export function saveAppConfig(cfg: Partial<AppConfig>): AppConfig {
  const current = loadAppConfig();
  const updated: AppConfig = {
    ...current,
    ...cfg,
  };
  updated.isCustomConfigured = isValidSupabaseUrl(updated.supabaseUrl) && Boolean(updated.supabaseAnonKey && updated.supabaseAnonKey.length > 20);
  try {
    localStorage.setItem('cxk_app_config', JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save config', e);
  }
  return updated;
}

export function isValidSupabaseUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith('https://') && !url.includes('XXXXXXXX') && url.includes('.supabase.co');
}

export interface AppStateData {
  patients: Patient[];
  recs: VitalRecord[];
  scheds: ScheduleItem[];
  reports: DutyReport[];
  glucoseRecords?: GlucoseRecord[];
  beds: number;
  rooms?: string[];
  insulins?: string[];
  doctors?: string[];
}

const LOCAL_STORAGE_KEY = 'cxk_local_database_v2';
const LOCAL_PW_KEY = 'cxk_local_auth_password';
const LOCAL_SESSION_KEY = 'cxk_local_authenticated';

export function getLocalPassword(): string {
  return localStorage.getItem(LOCAL_PW_KEY) || '123';
}

export function setLocalPassword(pw: string) {
  localStorage.setItem(LOCAL_PW_KEY, pw);
}

export function isLocalAuthenticated(): boolean {
  return localStorage.getItem(LOCAL_SESSION_KEY) === 'true';
}

export function setLocalAuthenticated(auth: boolean) {
  if (auth) {
    localStorage.setItem(LOCAL_SESSION_KEY, 'true');
  } else {
    localStorage.removeItem(LOCAL_SESSION_KEY);
  }
}

export function getInitialLocalData(): AppStateData {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.patients)) {
        // Filter out any lingering demo mockup patients by name
        const cleanPatients = parsed.patients.filter(
          (p: Patient) => p && !DEMO_PATIENT_NAMES.has(p.name)
        );
        const cleanRecs = Array.isArray(parsed.recs)
          ? parsed.recs.filter((r: VitalRecord) => r.pid > 27)
          : [];
        const cleanScheds = Array.isArray(parsed.scheds)
          ? parsed.scheds.filter((s: ScheduleItem) => s.patientId > 27)
          : [];
        const cleanReports = Array.isArray(parsed.reports)
          ? parsed.reports.filter((rep: DutyReport) => rep.id !== 1)
          : [];
        const cleanGlucose = Array.isArray(parsed.glucoseRecords)
          ? parsed.glucoseRecords
          : [];

        if (!parsed.rooms || !parsed.rooms.length) {
          parsed.rooms = ['P.301', 'P.302', 'P.303', 'P.304', 'P.305', 'P.306'];
        }

        const cleanInsulins = Array.isArray(parsed.insulins) && parsed.insulins.length > 0
          ? parsed.insulins
          : [...DEFAULT_INSULINS];

        const cleanDoctors = Array.isArray(parsed.doctors) && parsed.doctors.length > 0
          ? parsed.doctors
          : [...DEFAULT_DOCTORS];

        return {
          patients: cleanPatients,
          recs: cleanRecs,
          scheds: cleanScheds,
          reports: cleanReports,
          glucoseRecords: cleanGlucose,
          beds: parsed.beds || 30,
          rooms: parsed.rooms,
          insulins: cleanInsulins,
          doctors: cleanDoctors,
        };
      }
    }
  } catch (e) {
    console.warn('Could not parse local data', e);
  }

  const data: AppStateData = {
    patients: [],
    recs: [],
    scheds: [],
    reports: [],
    glucoseRecords: [],
    beds: 30,
    rooms: ['P.301', 'P.302', 'P.303', 'P.304', 'P.305', 'P.306'],
    insulins: [...DEFAULT_INSULINS],
    doctors: [...DEFAULT_DOCTORS],
  };
  saveLocalData(data);
  return data;
}

export const DEMO_PATIENT_NAMES = new Set([
  'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cúc', 'Phạm Minh Đức',
  'Hoàng Văn Em', 'Vũ Thị Gấm', 'Đỗ Thành Hải', 'Bùi Thị Kim',
  'Ngô Quang Lâm', 'Dương Thị Mai', 'Đinh Văn Nam', 'Lý Thị Oanh',
  'Phan Văn Phúc', 'Đoàn Thị Quyên', 'Trịnh Hữu Sang', 'Võ Thị Tâm',
  'Lương Thế Vinh', 'Cao Thị Xuân', 'Đặng Đình Yên', 'Hà Thị Bích'
]);

export function saveLocalData(data: Partial<AppStateData>) {
  try {
    let existing: any = {};
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      try {
        existing = JSON.parse(raw);
      } catch {}
    }
    const merged = { ...existing, ...data };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.error('Failed to persist local database to storage', e);
  }
}

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(config: AppConfig): SupabaseClient | null {
  if (!config.isCustomConfigured) {
    return null;
  }
  if (!supabaseClient) {
    try {
      supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'cxk-auth',
        },
      });
    } catch (e) {
      console.error('Error creating Supabase client:', e);
      return null;
    }
  }
  return supabaseClient;
}

export function resetSupabaseClient() {
  supabaseClient = null;
}
