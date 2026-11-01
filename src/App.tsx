import React, { useState, useEffect, useRef } from 'react';
import { Patient, VitalRecord, ScheduleItem, DutyReport, DischargeKind } from './types';
import {
  auth,
  db,
  signOutStaff,
  savePatientToFirestore,
  deletePatientFromFirestore,
  saveRecToFirestore,
  deleteRecFromFirestore,
  saveSchedToFirestore,
  deleteSchedFromFirestore,
  saveReportToFirestore,
  deleteReportFromFirestore,
  saveSettingsToFirestore,
  handleFirestoreError
} from './lib/firebase';
import {
  collection,
  onSnapshot,
  doc,
  getDocs
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  getInitialLocalData,
  saveLocalData,
  isLocalAuthenticated,
  setLocalAuthenticated,
  DEMO_PATIENT_NAMES
} from './lib/storage';
import { uid, isIn, isOut, isoDay } from './lib/constants';
import { Header } from './components/Header';
import { Navigation, TabKey } from './components/Navigation';
import { DashboardTab } from './components/DashboardTab';
import { PatientsTab } from './components/PatientsTab';
import { VitalsTab } from './components/VitalsTab';
import { DutyTab } from './components/DutyTab';
import { ScheduleTab } from './components/ScheduleTab';

// Modals
import { AdmitModal } from './components/modals/AdmitModal';
import { RecordVitalsModal } from './components/modals/RecordVitalsModal';
import { OrderModal } from './components/modals/OrderModal';
import { DischargeModal } from './components/modals/DischargeModal';
import { PatientHistoryModal } from './components/modals/PatientHistoryModal';
import { ViewReportModal } from './components/modals/ViewReportModal';
import { LoginModal } from './components/modals/LoginModal';
import { SettingsModal } from './components/modals/SettingsModal';

import { Plus } from 'lucide-react';
import { DEFAULT_ROOMS } from './lib/constants';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDemoUser, setIsDemoUser] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabKey>('dash');

  // Clinical State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [recs, setRecs] = useState<VitalRecord[]>([]);
  const [scheds, setScheds] = useState<ScheduleItem[]>([]);
  const [reports, setReports] = useState<DutyReport[]>([]);
  const [beds, setBeds] = useState<number>(30);
  const [rooms, setRooms] = useState<string[]>(DEFAULT_ROOMS);
  const [syncStatus, setSyncStatus] = useState<'ok' | 'saving' | 'err'>('ok');

  // Modals state
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [admitModalOpen, setAdmitModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [vitalsTargetPatient, setVitalsTargetPatient] = useState<Patient | null>(null);

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderTargetPatient, setOrderTargetPatient] = useState<Patient | null>(null);

  const [dischargeModalOpen, setDischargeModalOpen] = useState(false);
  const [dischargeTargetPatient, setDischargeTargetPatient] = useState<Patient | null>(null);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTargetPatient, setHistoryTargetPatient] = useState<Patient | null>(null);

  const [viewReportModalOpen, setViewReportModalOpen] = useState(false);
  const [viewTargetReport, setViewTargetReport] = useState<DutyReport | null>(null);

  const [initialShowDischarged, setInitialShowDischarged] = useState(false);

  // Time ticker
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setIsDemoUser(false);
      } else if (isLocalAuthenticated()) {
        setIsDemoUser(true);
      } else {
        setCurrentUser(null);
        setIsDemoUser(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isAuthenticated = Boolean(currentUser || isDemoUser);

  // Load initial local backup
  useEffect(() => {
    const local = getInitialLocalData();
    setPatients(local.patients || []);
    setRecs(local.recs || []);
    setScheds(local.scheds || []);
    setReports(local.reports || []);
    setBeds(local.beds || 30);
    if (local.rooms && local.rooms.length > 0) {
      setRooms(local.rooms);
    }
  }, []);

  // Connect to Firestore Realtime Listeners when authenticated with Firebase
  useEffect(() => {
    if (!currentUser) return;

    setSyncStatus('saving');

    const unsubs: (() => void)[] = [];

    // 1. Patients collection
    const unsubsPatients = onSnapshot(
      collection(db, 'patients'),
      (snapshot) => {
        const list: Patient[] = [];
        const demoToRemove: Patient[] = [];
        snapshot.forEach((doc) => {
          const p = doc.data() as Patient;
          if (DEMO_PATIENT_NAMES.has(p.name)) {
            demoToRemove.push(p);
          } else {
            list.push(p);
          }
        });

        // Clean out any legacy mockups from Firestore
        if (demoToRemove.length > 0) {
          demoToRemove.forEach((p) => {
            deletePatientFromFirestore(p.id).catch(() => {});
          });
        }

        setPatients(list);
        saveLocalData({ patients: list, recs, scheds, reports, beds, rooms });
        setSyncStatus('ok');
      },
      (err) => {
        console.warn('Patients snapshot error:', err);
        setSyncStatus('err');
      }
    );
    unsubs.push(unsubsPatients);

    // 2. Vital Records collection
    const unsubsRecs = onSnapshot(
      collection(db, 'recs'),
      (snapshot) => {
        const list: VitalRecord[] = [];
        const demoToRemove: VitalRecord[] = [];
        snapshot.forEach((doc) => {
          const r = doc.data() as VitalRecord;
          if (r.pid <= 27) {
            demoToRemove.push(r);
          } else {
            list.push(r);
          }
        });

        if (demoToRemove.length > 0) {
          demoToRemove.forEach((r) => {
            deleteRecFromFirestore(r.id).catch(() => {});
          });
        }

        setRecs(list);
      },
      (err) => {
        console.warn('Recs snapshot error:', err);
      }
    );
    unsubs.push(unsubsRecs);

    // 3. Scheds collection
    const unsubsScheds = onSnapshot(
      collection(db, 'scheds'),
      (snapshot) => {
        const list: ScheduleItem[] = [];
        const demoToRemove: ScheduleItem[] = [];
        snapshot.forEach((doc) => {
          const s = doc.data() as ScheduleItem;
          if (s.patientId <= 27 || s.id <= 50) {
            demoToRemove.push(s);
          } else {
            list.push(s);
          }
        });

        if (demoToRemove.length > 0) {
          demoToRemove.forEach((s) => {
            deleteSchedFromFirestore(s.id).catch(() => {});
          });
        }

        setScheds(list);
      },
      (err) => {
        console.warn('Scheds snapshot error:', err);
      }
    );
    unsubs.push(unsubsScheds);

    // 4. Reports collection
    const unsubsReports = onSnapshot(
      collection(db, 'reports'),
      (snapshot) => {
        const list: DutyReport[] = [];
        const demoToRemove: DutyReport[] = [];
        snapshot.forEach((doc) => {
          const rep = doc.data() as DutyReport;
          if (rep.id === 1) {
            demoToRemove.push(rep);
          } else {
            list.push(rep);
          }
        });

        if (demoToRemove.length > 0) {
          demoToRemove.forEach((rep) => {
            deleteReportFromFirestore(rep.id).catch(() => {});
          });
        }

        list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        setReports(list);
      },
      (err) => {
        console.warn('Reports snapshot error:', err);
      }
    );
    unsubs.push(unsubsReports);

    // 5. Settings document
    const unsubsSettings = onSnapshot(
      doc(db, 'settings', '1'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data) {
            if (typeof data.beds === 'number') {
              setBeds(data.beds);
            }
            if (Array.isArray(data.rooms) && data.rooms.length > 0) {
              setRooms(data.rooms);
            }
          }
        } else {
          saveSettingsToFirestore({ beds: 30, rooms: DEFAULT_ROOMS });
        }
      },
      (err) => {
        console.warn('Settings snapshot error:', err);
      }
    );
    unsubs.push(unsubsSettings);

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [currentUser]);

  // Auth actions
  const handleSignOut = async () => {
    try {
      await signOutStaff();
    } catch (e) {
      console.warn('Firebase signout warning:', e);
    }
    setLocalAuthenticated(false);
    setIsDemoUser(false);
    setCurrentUser(null);
  };

  const handleDemoLogin = () => {
    setLocalAuthenticated(true);
    setIsDemoUser(true);
  };

  // Clinical data updates
  const handleSavePatient = async (patientData: Partial<Patient>) => {
    setSyncStatus('saving');
    if (editingPatient) {
      const updated: Patient = {
        ...editingPatient,
        ...patientData,
      } as Patient;

      const next = patients.map((p) => (p.id === editingPatient.id ? updated : p));
      setPatients(next);

      if (currentUser) {
        await savePatientToFirestore(updated);
      } else {
        saveLocalData({ patients: next, recs, scheds, reports, beds });
      }
    } else {
      const newPt: Patient = {
        id: uid(),
        name: patientData.name || '',
        age: patientData.age || '',
        room: patientData.room || '',
        note: patientData.note || '',
        admitAt: patientData.admitAt || Date.now(),
        status: 'in',
        pulse: patientData.pulse,
        bp: patientData.bp,
        temp: patientData.temp,
        spo2: patientData.spo2,
        rr: patientData.rr,
        av: patientData.av,
      };

      const next = [newPt, ...patients];
      setPatients(next);

      if (currentUser) {
        await savePatientToFirestore(newPt);
      } else {
        saveLocalData({ patients: next, recs, scheds, reports, beds });
      }
    }
    setSyncStatus('ok');
    setAdmitModalOpen(false);
    setEditingPatient(null);
  };

  const handleSaveVitalRecord = async (record: VitalRecord, updatedVitals: Partial<Patient>) => {
    setSyncStatus('saving');
    const nextRecs = [record, ...recs];
    setRecs(nextRecs);

    const nextPts = patients.map((p) => {
      if (p.id !== record.pid) return p;
      return {
        ...p,
        ...updatedVitals,
      };
    });
    setPatients(nextPts);

    if (currentUser) {
      await saveRecToFirestore(record);
      const updatedPt = nextPts.find((p) => p.id === record.pid);
      if (updatedPt) {
        await savePatientToFirestore(updatedPt);
      }
    } else {
      saveLocalData({ patients: nextPts, recs: nextRecs, scheds, reports, beds });
    }

    setSyncStatus('ok');
    setVitalsModalOpen(false);
    setVitalsTargetPatient(null);
  };

  const handleAddTreatment = async (recordId: number, text: string) => {
    let targetRec: VitalRecord | null = null;
    const nextRecs = recs.map((r) => {
      if (r.id !== recordId) return r;
      targetRec = {
        ...r,
        tx: [...(r.tx || []), { id: uid(), at: Date.now(), text }],
      };
      return targetRec;
    });
    setRecs(nextRecs);

    if (currentUser && targetRec) {
      await saveRecToFirestore(targetRec);
    } else {
      saveLocalData({ patients, recs: nextRecs, scheds, reports, beds });
    }
  };

  const handleSaveSchedule = async (schedule: ScheduleItem) => {
    setSyncStatus('saving');
    const next = [...scheds, schedule];
    setScheds(next);

    if (currentUser) {
      await saveSchedToFirestore(schedule);
    } else {
      saveLocalData({ patients, recs, scheds: next, reports, beds });
    }

    setSyncStatus('ok');
    setOrderModalOpen(false);
    setOrderTargetPatient(null);
  };

  const handleToggleScheduleDone = async (id: number) => {
    let target: ScheduleItem | null = null;
    const next = scheds.map((s) => {
      if (s.id === id) {
        target = { ...s, done: !s.done };
        return target;
      }
      return s;
    });
    setScheds(next);

    if (currentUser && target) {
      await saveSchedToFirestore(target);
    } else {
      saveLocalData({ patients, recs, scheds: next, reports, beds });
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    const next = scheds.filter((s) => s.id !== id);
    setScheds(next);

    if (currentUser) {
      await deleteSchedFromFirestore(id);
    } else {
      saveLocalData({ patients, recs, scheds: next, reports, beds });
    }
  };

  const handleSaveDischarge = async (kind: DischargeKind, time: number, note: string) => {
    if (!dischargeTargetPatient) return;
    const targetId = dischargeTargetPatient.id;
    let updatedPt: Patient | null = null;

    const next = patients.map((p) => {
      if (p.id !== targetId) return p;
      updatedPt = {
        ...p,
        status: 'out' as const,
        outAt: time,
        outKind: kind,
        outNote: note,
      };
      return updatedPt;
    });
    setPatients(next);

    if (currentUser && updatedPt) {
      await savePatientToFirestore(updatedPt);
    } else {
      saveLocalData({ patients: next, recs, scheds, reports, beds });
    }

    setDischargeModalOpen(false);
    setDischargeTargetPatient(null);
  };

  const handleCancelDischarge = async (patientId: number) => {
    let updatedPt: Patient | null = null;
    const next = patients.map((p) => {
      if (p.id !== patientId) return p;
      updatedPt = {
        ...p,
        status: 'in' as const,
        outAt: null,
        outNote: '',
      };
      return updatedPt;
    });
    setPatients(next);

    if (currentUser && updatedPt) {
      await savePatientToFirestore(updatedPt);
    } else {
      saveLocalData({ patients: next, recs, scheds, reports, beds });
    }

    setDischargeModalOpen(false);
    setDischargeTargetPatient(null);
  };

  const handleSaveReport = async (report: DutyReport) => {
    setSyncStatus('saving');
    const exists = reports.some((r) => r.id === report.id);
    const next = exists
      ? reports.map((r) => (r.id === report.id ? report : r))
      : [report, ...reports];
    setReports(next);

    if (currentUser) {
      await saveReportToFirestore(report);
    } else {
      saveLocalData({ patients, recs, scheds, reports: next, beds });
    }
    setSyncStatus('ok');
  };

  const handleUpdateBeds = async (newBeds: number) => {
    setBeds(newBeds);
    if (currentUser) {
      await saveSettingsToFirestore({ beds: newBeds, rooms });
    } else {
      saveLocalData({ patients, recs, scheds, reports, beds: newBeds, rooms });
    }
  };

  const handleSaveSettings = async (newBeds: number, newRooms: string[]) => {
    setBeds(newBeds);
    setRooms(newRooms);
    if (currentUser) {
      await saveSettingsToFirestore({ beds: newBeds, rooms: newRooms });
    } else {
      saveLocalData({ patients, recs, scheds, reports, beds: newBeds, rooms: newRooms });
    }
    setSettingsModalOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E9F6F1]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#0E6B5E] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-[#0F2F2A]">Đang khởi động Đơn nguyên Cơ xương khớp...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginModal
        onSuccess={() => {}}
        onDemoLogin={handleDemoLogin}
      />
    );
  }

  const activeCount = patients.filter((p) => isIn(p, now)).length;
  const pendingScheduleCount = scheds.filter((s) => !s.done && s.date === isoDay(now)).length;

  return (
    <div className="min-h-screen bg-[#F3F4F1] flex flex-col antialiased">
      {/* Header */}
      <Header
        now={now}
        syncStatus={syncStatus}
        userEmail={currentUser?.email || (isDemoUser ? 'Tài khoản khách (Demo)' : null)}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      {/* Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activePatientCount={activeCount}
        pendingScheduleCount={pendingScheduleCount}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-3 md:px-4 py-5 flex-1 pb-24">
        {activeTab === 'dash' && (
          <DashboardTab
            patients={patients}
            scheds={scheds}
            beds={beds}
            onUpdateBeds={handleUpdateBeds}
            onGoToPatients={() => {
              setActiveTab('bn');
              setInitialShowDischarged(false);
            }}
            onGoToSchedule={() => setActiveTab('lich')}
            onOpenDischargedList={() => {
              setActiveTab('bn');
              setInitialShowDischarged(true);
            }}
            onSignOut={handleSignOut}
            userEmail={currentUser?.email || (isDemoUser ? 'Chế độ Demo / Nội bộ' : null)}
          />
        )}

        {activeTab === 'bn' && (
          <PatientsTab
            patients={patients}
            initialShowDischarged={initialShowDischarged}
            onOpenAdmit={() => {
              setEditingPatient(null);
              setAdmitModalOpen(true);
            }}
            onEditPatient={(p) => {
              setEditingPatient(p);
              setAdmitModalOpen(true);
            }}
            onOpenVitals={(p) => {
              setHistoryTargetPatient(p);
              setHistoryModalOpen(true);
            }}
            onOpenOrder={(p) => {
              setOrderTargetPatient(p);
              setOrderModalOpen(true);
            }}
            onOpenDischarge={(p) => {
              setDischargeTargetPatient(p);
              setDischargeModalOpen(true);
            }}
          />
        )}

        {activeTab === 'dhst' && (
          <VitalsTab
            patients={patients}
            recs={recs}
            onOpenRecordModal={(p) => {
              setVitalsTargetPatient(p || null);
              setVitalsModalOpen(true);
            }}
            onOpenPatientHistory={(p) => {
              setHistoryTargetPatient(p);
              setHistoryModalOpen(true);
            }}
          />
        )}

        {activeTab === 'truc' && (
          <DutyTab
            patients={patients}
            recs={recs}
            scheds={scheds}
            reports={reports}
            onSaveReport={handleSaveReport}
            onViewReport={(r) => {
              setViewTargetReport(r);
              setViewReportModalOpen(true);
            }}
          />
        )}

        {activeTab === 'lich' && (
          <ScheduleTab
            scheds={scheds}
            patients={patients}
            onOpenOrderModal={() => {
              setOrderTargetPatient(null);
              setOrderModalOpen(true);
            }}
            onToggleDone={handleToggleScheduleDone}
            onDeleteSchedule={handleDeleteSchedule}
          />
        )}
      </main>

      {/* Floating Action Button (+) for quick admission */}
      <button
        type="button"
        onClick={() => {
          setEditingPatient(null);
          setAdmitModalOpen(true);
        }}
        className="fixed right-5 bottom-5 z-30 w-14 h-14 rounded-full bg-[#E07B2E] hover:bg-[#D06C1F] text-[#1F0E02] flex items-center justify-center shadow-lg hover:shadow-xl transition-all focus:outline-none focus:ring-4 focus:ring-emerald-800/20 active:scale-95 cursor-pointer"
        title="Khai báo nhập viện"
        aria-label="Khai báo nhập viện"
      >
        <Plus className="w-7 h-7 stroke-[2.8]" />
      </button>

      {/* Modals */}
      {admitModalOpen && (
        <AdmitModal
          patient={editingPatient}
          rooms={rooms}
          onClose={() => {
            setAdmitModalOpen(false);
            setEditingPatient(null);
          }}
          onSave={handleSavePatient}
        />
      )}

      {vitalsModalOpen && (
        <RecordVitalsModal
          initialPatient={vitalsTargetPatient}
          patients={patients}
          onClose={() => {
            setVitalsModalOpen(false);
            setVitalsTargetPatient(null);
          }}
          onSave={handleSaveVitalRecord}
        />
      )}

      {orderModalOpen && (
        <OrderModal
          initialPatient={orderTargetPatient}
          patients={patients}
          scheds={scheds}
          onClose={() => {
            setOrderModalOpen(false);
            setOrderTargetPatient(null);
          }}
          onSave={handleSaveSchedule}
        />
      )}

      {dischargeModalOpen && dischargeTargetPatient && (
        <DischargeModal
          patient={dischargeTargetPatient}
          onClose={() => {
            setDischargeModalOpen(false);
            setDischargeTargetPatient(null);
          }}
          onSave={handleSaveDischarge}
          onCancelDischarge={handleCancelDischarge}
        />
      )}

      {historyModalOpen && historyTargetPatient && (
        <PatientHistoryModal
          patient={historyTargetPatient}
          recs={recs}
          onClose={() => {
            setHistoryModalOpen(false);
            setHistoryTargetPatient(null);
          }}
          onOpenRecordVitals={(p) => {
            setVitalsTargetPatient(p);
            setVitalsModalOpen(true);
          }}
          onAddTreatment={handleAddTreatment}
        />
      )}

      {viewReportModalOpen && viewTargetReport && (
        <ViewReportModal
          report={viewTargetReport}
          onClose={() => {
            setViewReportModalOpen(false);
            setViewTargetReport(null);
          }}
          onEdit={(r) => {
            setViewReportModalOpen(false);
            setActiveTab('truc');
          }}
        />
      )}

      {/* Department Settings Modal */}
      {settingsModalOpen && (
        <SettingsModal
          currentBeds={beds}
          currentRooms={rooms}
          patients={patients}
          onClose={() => setSettingsModalOpen(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
}
