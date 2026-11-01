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
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Patient, VitalRecord, ScheduleItem, DutyReport } from '../types';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/* CRITICAL: Passing firestoreDatabaseId is required by Firebase in this environment */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

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
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Authentication helpers
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signInWithStaffEmail(pw: string) {
  const email = 'cxk@benhvien.vn';
  return signInWithEmailAndPassword(auth, email, pw);
}

export async function signOutStaff() {
  return signOut(auth);
}

// Data synchronization helpers
export async function savePatientToFirestore(p: Patient) {
  const path = `patients/${p.id}`;
  try {
    await setDoc(doc(db, 'patients', String(p.id)), p);
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
    await setDoc(doc(db, 'recs', String(r.id)), r);
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
    await setDoc(doc(db, 'scheds', String(s.id)), s);
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
    await setDoc(doc(db, 'reports', String(rep.id)), rep);
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

export async function saveSettingsToFirestore(settings: { beds: number; rooms?: string[] }) {
  const path = 'settings/1';
  try {
    await setDoc(doc(db, 'settings', '1'), settings, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
