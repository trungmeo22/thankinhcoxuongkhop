import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Patient, VitalRecord, ScheduleItem, DutyReport, GlucoseRecord } from '../types';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/* Connect to Firestore (default) */
export const db = getFirestore(app);
export const auth = getAuth(app);

export const DEFAULT_STAFF_EMAIL = 'cxk@benhvien.vn';
export const DEFAULT_STAFF_PW = '12345678';

export async function ensureFirebaseAuth(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInWithEmailAndPassword(auth, DEFAULT_STAFF_EMAIL, DEFAULT_STAFF_PW);
    return cred.user;
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, DEFAULT_STAFF_EMAIL, DEFAULT_STAFF_PW);
        return newCred.user;
      } catch (createErr) {
        console.warn('Auto create staff account failed:', createErr);
      }
    }
    console.warn('Firebase staff auth sign-in notice:', err?.message || err);
    return null;
  }
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // silent catch
  }
}
testConnection();

// Authentication helpers
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signInWithStaffEmail(pw: string = DEFAULT_STAFF_PW) {
  return signInWithEmailAndPassword(auth, DEFAULT_STAFF_EMAIL, pw);
}

export async function signOutStaff() {
  return signOut(auth);
}

/**
 * Recursively cleans an object for Firestore by omitting any fields with `undefined` values.
 * Firestore throws errors if `undefined` values are written.
 */
export function cleanForFirestore<T>(data: T): any {
  if (data === null || data === undefined) {
    return null;
  }
  if (Array.isArray(data)) {
    return data.map((item) => cleanForFirestore(item));
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(data as Record<string, any>)) {
      if (val !== undefined) {
        cleaned[key] = cleanForFirestore(val);
      }
    }
    return cleaned;
  }
  return data;
}

// Data synchronization helpers
export async function savePatientToFirestore(p: Patient) {
  const path = `patients/${p.id}`;
  try {
    await setDoc(doc(db, 'patients', String(p.id)), cleanForFirestore(p));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deletePatientFromFirestore(id: number) {
  const path = `patients/${id}`;
  try {
    await deleteDoc(doc(db, 'patients', String(id)));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveRecToFirestore(r: VitalRecord) {
  const path = `recs/${r.id}`;
  try {
    await setDoc(doc(db, 'recs', String(r.id)), cleanForFirestore(r));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteRecFromFirestore(id: number) {
  const path = `recs/${id}`;
  try {
    await deleteDoc(doc(db, 'recs', String(id)));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveSchedToFirestore(s: ScheduleItem) {
  const path = `scheds/${s.id}`;
  try {
    await setDoc(doc(db, 'scheds', String(s.id)), cleanForFirestore(s));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteSchedFromFirestore(id: number) {
  const path = `scheds/${id}`;
  try {
    await deleteDoc(doc(db, 'scheds', String(id)));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveReportToFirestore(rep: DutyReport) {
  const path = `reports/${rep.id}`;
  try {
    await setDoc(doc(db, 'reports', String(rep.id)), cleanForFirestore(rep));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteReportFromFirestore(id: number) {
  const path = `reports/${id}`;
  try {
    await deleteDoc(doc(db, 'reports', String(id)));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveSettingsToFirestore(settings: { beds: number; rooms?: string[]; insulins?: string[]; doctors?: string[] }) {
  const path = 'settings/1';
  try {
    await setDoc(doc(db, 'settings', '1'), cleanForFirestore(settings), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveGlucoseToFirestore(g: GlucoseRecord) {
  const path = `glucose_records/${g.id}`;
  try {
    await setDoc(doc(db, 'glucose_records', String(g.id)), cleanForFirestore(g));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteGlucoseFromFirestore(id: number) {
  const path = `glucose_records/${id}`;
  try {
    await deleteDoc(doc(db, 'glucose_records', String(id)));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

