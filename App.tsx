
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import ProtectedRoute from './src/components/ProtectedRoute.tsx';
import LoginPage from './pages/LoginPage.tsx';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './pages/Dashboard.tsx';
import ProfileModal from './components/ProfileModal.tsx';
import LoadingOverlay from './components/LoadingOverlay.tsx';
import { Page, AppData, UserRole, AttendanceRecord, Shift } from './types.ts';
import { dataService } from './services/dataService.ts';
import { authService, AuthSession } from './services/authServiceSupabase.ts';

const EmployeeUpload = lazy(() => import('./pages/EmployeeUpload.tsx'));
const BiometricUpload = lazy(() => import('./pages/BiometricUpload.tsx'));
const AttendanceUpload = lazy(() => import('./pages/AttendanceUpload.tsx'));
const ReconciliationHub = lazy(() => import('./pages/ReconciliationHub.tsx'));
// Legacy components temporarily disabled
// const LeaveManagement = lazy(() => import('./pages/LeaveReconciliationOptimized.tsx'));
// const AuditQueue = lazy(() => import('./pages/AuditQueue.tsx'));
const MonthlyConsolidation = lazy(() => import('./pages/MonthlyConsolidation.tsx'));
const ShiftMatrix = lazy(() => import('./pages/ShiftMatrix.tsx'));

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [appData, setAppData] = useState<AppData>({
    employees: [],
    attendance: [],
    shifts: [],
    holidays: [],
    weeklyOffs: [0, 6],
    leaveRecords: [],
    leaveReconciliations: [],
    reconciliationRecords: [],
    auditQueue: [],
    auditLogs: [],
    isReconciliationComplete: false
  });
  
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return 0;
    const cleanTime = timeStr.toUpperCase().replace('NA', '00:00').trim();
    if (cleanTime === '00:00' || cleanTime === '') return 0;
    const parts = cleanTime.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  const minutesToTime = (totalMinutes: number) => {
    const absMins = Math.max(0, Math.round(totalMinutes));
    const h = Math.floor(absMins / 60).toString().padStart(2, '0');
    const m = (absMins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const diffMinutes = (start: number, end: number) => {
    if (end < start) return (end + 1440) - start;
    return end - start;
  };

  const parseFormattedDate = (dateStr: string): Date | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const monthIndex = months.indexOf(parts[1].toUpperCase());
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || monthIndex === -1 || isNaN(year)) return null;
    return new Date(year, monthIndex, day);
  };

  const recalculateAttendance = useCallback((currentData: AppData) => {
    if (!currentData.employees.length) return currentData.attendance;
    
    const shiftMap = new Map<string, Shift>();
    currentData.shifts.forEach(s => {
      shiftMap.set(s.id.toLowerCase(), s);
      shiftMap.set(s.label.toLowerCase(), s);
    });

    const holidayMap = new Map(currentData.holidays.map(h => [h.date.toUpperCase(), h]));
    const weeklyOffSet = new Set(currentData.weeklyOffs);
    const employeeMap = new Map(currentData.employees.map(e => [e.employeeNumber.toUpperCase(), e]));
    
    const sortedAttendance = [...currentData.attendance].sort((a, b) => {
      const dateA = parseFormattedDate(a.date)?.getTime() || 0;
      const dateB = parseFormattedDate(b.date)?.getTime() || 0;
      if (dateA !== dateB) return dateA - dateB;
      return a.employeeNumber.localeCompare(b.employeeNumber);
    });

    const punctualityOccasions = new Map<string, number>();

    return sortedAttendance.map(record => {
      const emp = employeeMap.get(record.employeeNumber.toUpperCase());
      const dateStr = record.date;
      const dateParts = dateStr.split('-');
      const monthKey = emp ? `${emp.employeeNumber.toUpperCase()}|${dateParts[1]}-${dateParts[2]}` : '';

      const dateObj = parseFormattedDate(dateStr);
      const dayOfWeek = dateObj ? dateObj.getDay() : -1;
      const isWeeklyOff = dayOfWeek !== -1 && weeklyOffSet.has(dayOfWeek);
      const holiday = holidayMap.get(dateStr.toUpperCase());
      const isHoliday = !!holiday;

      const rawIn = (record.inTime || '').toUpperCase().trim();
      const rawOut = (record.outTime || '').toUpperCase().trim();
      const validIn = rawIn !== '' && rawIn !== '00:00' && rawIn !== 'NA';
      const validOut = rawOut !== '' && rawOut !== '00:00' && rawOut !== 'NA';
      const hasFullPunch = validIn && validOut;
      const isSinglePunch = (validIn && !validOut) || (!validIn && validOut);
      const noPunches = !validIn && !validOut;

      let status = 'Clean'; 
      let deviationDetails = '-';
      let sStartStr = record.shiftStart || '00:00';
      let sEndStr = record.shiftEnd || '00:00';

      if (!emp) {
        status = 'ID Error';
        deviationDetails = 'ID Not Found in Master';
      } else if (emp.activeStatus !== 'Active') {
        status = 'ID Error';
        deviationDetails = 'Staff Inactive/Terminated';
      } else if (noPunches) {
        if (isHoliday) { status = 'Holiday'; deviationDetails = holiday.label; }
        else if (isWeeklyOff) { status = 'Weekly Off'; deviationDetails = 'Standard Weekly Off'; }
        else { status = 'Absent'; deviationDetails = 'No Punch Records'; }
      } else if (isSinglePunch) {
        status = 'Audit';
        deviationDetails = validIn ? 'Missing Out Punch' : 'Missing In Punch';
      } else if (hasFullPunch && (isHoliday || isWeeklyOff)) {
        status = 'Worked Off';
        deviationDetails = isHoliday ? `Worked on Holiday: ${holiday?.label}` : 'Worked on Weekly Off';
      } else if (hasFullPunch) {
        const rawShiftLabel = (record.shift || 'GS').toLowerCase();
        const shift = shiftMap.get(rawShiftLabel);

        if (!shift) {
          status = 'Audit';
          deviationDetails = `Undefined Shift: ${record.shift}`;
        } else {
          sStartStr = shift.startTime;
          sEndStr = shift.endTime;
          const sStart = timeToMinutes(sStartStr);
          const sEnd = timeToMinutes(sEndStr);
          const lIn = timeToMinutes(record.inTime);
          const lOut = timeToMinutes(record.outTime);

          const isLateIn = lIn > sStart;
          const isEarlyOut = lOut < sEnd;
          const isVeryEarlyIn = lIn < (sStart - (shift.earlyInThreshold || 0));

          const isWaiverCandidate = (isLateIn || isEarlyOut) && !(isLateIn && isEarlyOut) && !emp.shiftDeviationAllowed;
          let isEligibleForWaiverFlag = false;

          if (isWaiverCandidate && monthKey) {
            const currentCount = punctualityOccasions.get(monthKey) || 0;
            const allowed = shift.allowedLateCount || 2;
            if (currentCount < allowed) {
              isEligibleForWaiverFlag = true;
              punctualityOccasions.set(monthKey, currentCount + 1);
            }
          }

          if (isVeryEarlyIn) {
            status = 'Audit';
            deviationDetails = `Very Early In (${sStart - lIn}m)`;
          } else if (isLateIn || isEarlyOut) {
            status = 'Audit';
            const reason = isLateIn && isEarlyOut ? 'Double Violation (Late + Early)' : 
                           isLateIn ? `Late In (${lIn - sStart}m)` : `Early Out (${sEnd - lOut}m)`;
            
            if (isEligibleForWaiverFlag) {
              deviationDetails = `Audit Waiver Eligible (Occasion ${punctualityOccasions.get(monthKey)}/2) - ${reason}`;
            } else {
              deviationDetails = reason;
            }
          } else {
            status = 'Clean';
            deviationDetails = 'On Time';
          }
        }
      }

      const baseRecord: AttendanceRecord = {
        ...record,
        employeeName: emp?.fullName || record.employeeName,
        jobTitle: emp?.jobTitle || record.jobTitle,
        businessUnit: emp?.businessUnit || record.businessUnit,
        department: emp?.department || record.department,
        subDepartment: emp?.subDepartment || record.subDepartment,
        location: emp?.location || record.location,
        costCenter: emp?.costCenter || record.costCenter,
        reportingManager: emp?.reportingTo || record.reportingManager,
        legalEntity: emp?.legalEntity || record.legalEntity || 'N/A',
        status: status,
        deviation: deviationDetails,
        shiftStart: sStartStr,
        shiftEnd: sEndStr
      };

      if (hasFullPunch) {
        const sStart = timeToMinutes(baseRecord.shiftStart);
        const sEnd = timeToMinutes(baseRecord.shiftEnd);
        const lIn = timeToMinutes(record.inTime);
        const lOut = timeToMinutes(record.outTime);
        
        baseRecord.lateBy = (lIn > sStart) ? minutesToTime(lIn - sStart) : '00:00';
        baseRecord.earlyBy = (lOut < sEnd) ? minutesToTime(sEnd - lOut) : '00:00';
        
        const grossMinutes = diffMinutes(lIn, lOut);
        baseRecord.totalHours = minutesToTime(grossMinutes);
        
        const effectiveMinutes = Math.max(0, grossMinutes - 60);
        baseRecord.effectiveHours = minutesToTime(effectiveMinutes);
        
        baseRecord.overTime = (lOut > sEnd) ? minutesToTime(lOut - sEnd) : '00:00';
        baseRecord.totalShortHoursEffective = minutesToTime(Math.max(0, 480 - effectiveMinutes));
        baseRecord.totalShortHoursGross = minutesToTime(Math.max(0, 540 - grossMinutes));
      } else {
        baseRecord.totalHours = '00:00';
        baseRecord.effectiveHours = '00:00';
      }

      return baseRecord;
    });
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await dataService.getData();
        setAppData(data);
        const savedSession = localStorage.getItem('intelliguard_session');
        if (savedSession) {
          setSession(JSON.parse(savedSession));
          setCurrentPage('dashboard');
        }
      } catch (err) {
        console.error("Load failed", err);
      } finally {
        setIsLoading(false);
        document.body.classList.add('loaded');
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isLoading) { dataService.saveData(appData); }
  }, [appData, isLoading]);

  const handleLogin = async (email: string, securityKey: string) => {
    setLoginError(null);
    setIsAuthenticating(true);
    try {
      const result = await authService.verifyWhitelist(email, securityKey);
      if (!result || !result.authorized) {
        setLoginError(result?.error || "Identity Verification Failed.");
        setIsAuthenticating(false);
        return;
      }
      const matchedEmployee = appData.employees.find(e => e.email.toLowerCase() === email.toLowerCase());
      const newSession: AuthSession = {
        user: {
          email: email.toLowerCase(),
          role: result.role,
          name: matchedEmployee?.fullName || (result.bootstrap ? 'Bootstrap Admin' : 'System User'),
          id: matchedEmployee?.employeeNumber || 'SYSTEM'
        },
        token: 'neon-verified-token'
      };
      setSession(newSession);
      localStorage.setItem('intelliguard_session', JSON.stringify(newSession));
      setCurrentPage('dashboard');
    } catch (err) {
      setLoginError("Internal security error.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setSession(null);
    setCurrentPage('login');
  };

  if (isLoading) return <LoadingOverlay />;

  // Wrap the entire app with Supabase authentication
  return (
    <ProtectedRoute>
      {!session ? (
        <LoginPage
          onLogin={(role, email, key) => handleLogin(email, key || '')}
          onBack={() => {}}
          error={loginError}
          isAuthenticating={isAuthenticating}
        />
      ) : (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar 
        activePage={currentPage} 
        onNavigate={page => setCurrentPage(page as Page)} 
        onLogout={handleLogout}
        onOpenSecurity={() => setIsSecurityModalOpen(true)}
        role={session.user.role} 
      />
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-7xl mx-auto">
          <Suspense fallback={<LoadingOverlay message="Synchronizing Data Grid..." />}>
            {currentPage === 'dashboard' && <Dashboard data={appData} role={session.user.role} />}
            {currentPage === 'employees' && (
              <EmployeeUpload
                data={appData}
                onUpdate={emps => {
                  const updatedData = { ...appData, employees: emps };
                  setAppData({ ...updatedData, attendance: recalculateAttendance(updatedData) });
                }}
              />
            )}
            {currentPage === 'biometric' && (
              <BiometricUpload
                data={appData}
                onConsolidatedData={records => {
                  const mergedAttendance = [...appData.attendance, ...records];
                  const updatedData = { ...appData, attendance: mergedAttendance };
                  setAppData({ ...updatedData, attendance: recalculateAttendance(updatedData) });
                  setCurrentPage('attendance');
                }}
              />
            )}
            {currentPage === 'attendance' && (
              <AttendanceUpload
                data={appData}
                onUpdate={att => {
                  const updatedData = { ...appData, attendance: att };
                  setAppData({ ...updatedData, attendance: recalculateAttendance(updatedData) });
                }}
                role={session.user.role}
                onRecalculate={() => setAppData(prev => ({ ...prev, attendance: recalculateAttendance(prev) }))}
              />
            )}
            {currentPage === 'leave' && (
              <ReconciliationHub
                data={appData}
                onUpdate={(moduleData: any, moduleStatuses: any) => {
                  // Store all module data
                  setAppData({
                    ...appData,
                    reconciliationRecords: [
                      ...moduleData.absent,
                      ...moduleData.present,
                      ...moduleData.workedoff,
                      ...moduleData.offdays,
                      ...moduleData.errors,
                      ...moduleData.audit
                    ]
                  });
                }}
                onFinalizeAll={() => {
                  // Apply all reconciliation changes to attendance
                  const reconciledMap = new Map();
                  (appData.reconciliationRecords || []).forEach((rec: any) => {
                    if (rec.isReconciled) {
                      reconciledMap.set(`${rec.employeeNumber}-${rec.date}`, rec.finalStatus);
                    }
                  });

                  const updatedAttendance = appData.attendance.map(att => {
                    const key = `${att.employeeNumber}-${att.date}`;
                    const newStatus = reconciledMap.get(key);
                    return newStatus ? { ...att, status: newStatus } : att;
                  });

                  const updatedData = {
                    ...appData,
                    attendance: updatedAttendance,
                    isReconciliationComplete: true
                  };
                  setAppData({ ...updatedData, attendance: recalculateAttendance(updatedData) });
                }}
                role={session.user.role}
                currentUser={session.user.email}
              />
            )}
            {currentPage === 'audit-queue' && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8 bg-amber-50 rounded-3xl border border-amber-200">
                  <AlertTriangle className="mx-auto text-amber-600 mb-4" size={48} />
                  <h2 className="text-xl font-black text-slate-900 mb-2">Module Temporarily Unavailable</h2>
                  <p className="text-sm text-slate-600">The Audit Queue module is being optimized for better performance.</p>
                  <p className="text-xs text-slate-500 mt-2">Please use the Logs Audit page for now.</p>
                </div>
              </div>
            )}
            {currentPage === 'monthly' && (
              <MonthlyConsolidation
                data={appData}
                role={session.user.role}
                onMarkReconciled={() => {
                  setAppData(prev => ({
                    ...prev,
                    isReconciliationComplete: true
                  }));
                }}
              />
            )}
            {currentPage === 'shifts' && (
              <ShiftMatrix 
                data={appData} 
                onUpdate={shifts => {
                  const updatedData = { ...appData, shifts };
                  setAppData({ ...updatedData, attendance: recalculateAttendance(updatedData) });
                }} 
                onUpdateMasters={updates => {
                  const updatedData = { ...appData, ...updates };
                  setAppData({ ...updatedData, attendance: recalculateAttendance(updatedData) });
                }}
                role={session.user.role}
              />
            )}
          </Suspense>
        </div>
      </main>
      <ProfileModal isOpen={isSecurityModalOpen} email={session.user.email} onClose={() => setIsSecurityModalOpen(false)} />
        </div>
      )}
    </ProtectedRoute>
  );
};

export default App;
