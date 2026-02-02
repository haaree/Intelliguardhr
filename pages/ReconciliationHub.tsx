import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Search,
  ChevronDown,
  Lock,
  Unlock,
  Clock,
  Calendar,
  AlertTriangle,
  Users,
  UserX,
  FileDown,
  Eraser,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  CheckCircle2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { AppData, UserRole } from '../types.ts';
import * as XLSX from 'xlsx';

interface ReconciliationRecord {
  id: string;
  employeeNumber: string;
  employeeName: string;
  department: string;
  subDepartment: string;
  location: string;
  costCenter: string;
  legalEntity: string;
  reportingManager: string;
  date: string;
  shift: string;
  shiftStart: string;
  shiftEnd: string;
  inTime: string;
  outTime: string;
  totalHours: string;
  originalStatus: string;
  excelStatus?: string;
  finalStatus: string;
  comments: string;
  isReconciled: boolean;
  reconciledBy?: string;
  reconciledOn?: string;
  deviation?: string;
  lateBy?: string;
  earlyBy?: string;
}

interface ModuleStatus {
  name: string;
  total: number;
  reconciled: number;
  isComplete: boolean;
}

interface ReconciliationHubProps {
  data: AppData;
  onUpdate: (moduleData: Record<string, ReconciliationRecord[]>, moduleStatuses: Record<string, ModuleStatus>) => void;
  onFinalizeAll: () => void;
  role: UserRole;
  currentUser: string;
}

const ReconciliationHub: React.FC<ReconciliationHubProps> = ({
  data,
  onUpdate,
  onFinalizeAll,
  role,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'absent' | 'present' | 'workedoff' | 'offdays' | 'errors' | 'audit'>('absent');
  const [auditSubTab, setAuditSubTab] = useState<'lateearly' | 'under4hrs' | '4to7hrs' | 'shift' | 'missing' | 'other'>('lateearly');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showExceptionsOnly, setShowExceptionsOnly] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: keyof ReconciliationRecord | null; direction: 'asc' | 'desc' | null }>({
    key: null,
    direction: null
  });

  // Comprehensive filters like Logs Audit
  const [matrixFilters, setMatrixFilters] = useState({
    shift: 'All',
    department: 'All',
    costCenter: 'All',
    legalEntity: 'All',
    location: 'All',
    reportingManager: 'All',
    status: 'All'
  });

  // Module data states
  const [absentRecords, setAbsentRecords] = useState<ReconciliationRecord[]>([]);
  const [presentRecords, setPresentRecords] = useState<ReconciliationRecord[]>([]);
  const [workedOffRecords, setWorkedOffRecords] = useState<ReconciliationRecord[]>([]);
  const [offDaysRecords, setOffDaysRecords] = useState<ReconciliationRecord[]>([]);
  const [errorRecords, setErrorRecords] = useState<ReconciliationRecord[]>([]);
  const [auditRecords, setAuditRecords] = useState<ReconciliationRecord[]>([]);

  // Module completion states
  const [moduleStatuses, setModuleStatuses] = useState<Record<string, ModuleStatus>>({
    absent: { name: 'Absent', total: 0, reconciled: 0, isComplete: false },
    present: { name: 'Present', total: 0, reconciled: 0, isComplete: false },
    workedoff: { name: 'Worked Off', total: 0, reconciled: 0, isComplete: false },
    offdays: { name: 'Off Days', total: 0, reconciled: 0, isComplete: false },
    errors: { name: 'Errors', total: 0, reconciled: 0, isComplete: false },
    audit: { name: 'Audit Queue', total: 0, reconciled: 0, isComplete: false }
  });

  const isAdmin = role === 'Admin' || role === 'SaaS_Admin' || role === 'Manager';

  // Auto-update module statuses when records change
  useEffect(() => {
    const newModuleStatuses = {
      absent: {
        name: 'Absent',
        total: absentRecords.length,
        reconciled: absentRecords.filter(r => r.isReconciled).length,
        isComplete: absentRecords.length > 0 && absentRecords.every(r => r.isReconciled)
      },
      present: {
        name: 'Present',
        total: presentRecords.length,
        reconciled: presentRecords.filter(r => r.isReconciled).length,
        isComplete: presentRecords.length > 0 && presentRecords.every(r => r.isReconciled)
      },
      offdays: {
        name: 'Off Days',
        total: offDaysRecords.length,
        reconciled: offDaysRecords.filter(r => r.isReconciled).length,
        isComplete: offDaysRecords.length > 0 && offDaysRecords.every(r => r.isReconciled)
      },
      workedoff: {
        name: 'Worked Off',
        total: workedOffRecords.length,
        reconciled: workedOffRecords.filter(r => r.isReconciled).length,
        isComplete: workedOffRecords.length > 0 && workedOffRecords.every(r => r.isReconciled)
      },
      errors: {
        name: 'Errors',
        total: errorRecords.length,
        reconciled: errorRecords.filter(r => r.isReconciled).length,
        isComplete: errorRecords.length > 0 && errorRecords.every(r => r.isReconciled)
      },
      audit: {
        name: 'Audit Queue',
        total: auditRecords.length,
        reconciled: auditRecords.filter(r => r.isReconciled).length,
        isComplete: auditRecords.length > 0 && auditRecords.every(r => r.isReconciled)
      }
    };

    setModuleStatuses(newModuleStatuses);
  }, [absentRecords, presentRecords, offDaysRecords, workedOffRecords, errorRecords, auditRecords]);

  const formatDate = (date: any): string => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Initialize records from attendance data
  useMemo(() => {
    const absent: ReconciliationRecord[] = [];
    const present: ReconciliationRecord[] = [];
    const workedOff: ReconciliationRecord[] = [];
    const offDays: ReconciliationRecord[] = [];
    const errors: ReconciliationRecord[] = [];
    const audit: ReconciliationRecord[] = [];

    data.attendance.forEach(att => {
      const record: ReconciliationRecord = {
        id: `${att.employeeNumber}-${att.date}`,
        employeeNumber: att.employeeNumber,
        employeeName: att.employeeName,
        department: att.department || 'N/A',
        subDepartment: att.subDepartment || 'N/A',
        location: att.location || 'N/A',
        costCenter: att.costCenter || 'N/A',
        legalEntity: att.legalEntity || 'N/A',
        reportingManager: att.reportingManager || 'N/A',
        date: att.date,
        shift: att.shift || 'N/A',
        shiftStart: att.shiftStart || '00:00',
        shiftEnd: att.shiftEnd || '00:00',
        inTime: att.inTime || '00:00',
        outTime: att.outTime || '00:00',
        totalHours: att.totalHours || '00:00',
        originalStatus: att.status,
        finalStatus: att.status,
        comments: '',
        isReconciled: false,
        deviation: att.deviation,
        lateBy: att.lateBy,
        earlyBy: att.earlyBy
      };

      if (att.status === 'Absent' || att.status === 'A') {
        absent.push(record);
      } else if (att.status === 'Clean' || att.status === 'P' || att.status === 'Present') {
        present.push(record);
      } else if (att.status === 'Worked Off' || att.status === 'WOH') {
        workedOff.push(record);
      } else if (att.status === 'Weekly Off' || att.status === 'WO' || att.status === 'Holiday' || att.status === 'H') {
        offDays.push(record);
      } else if (att.status === 'ID Error' || att.status.includes('Error')) {
        errors.push(record);
      } else if (att.status === 'Audit' || att.status === 'Very Late' || att.deviation) {
        audit.push(record);
      }
    });

    setAbsentRecords(absent);
    setPresentRecords(present);
    setWorkedOffRecords(workedOff);
    setOffDaysRecords(offDays);
    setErrorRecords(errors);
    setAuditRecords(audit);

    setModuleStatuses({
      absent: { name: 'Absent', total: absent.length, reconciled: 0, isComplete: false },
      present: { name: 'Present', total: present.length, reconciled: 0, isComplete: false },
      workedoff: { name: 'Worked Off', total: workedOff.length, reconciled: 0, isComplete: false },
      offdays: { name: 'Off Days', total: offDays.length, reconciled: 0, isComplete: false },
      errors: { name: 'Errors', total: errors.length, reconciled: 0, isComplete: false },
      audit: { name: 'Audit Queue', total: audit.length, reconciled: 0, isComplete: false }
    });
  }, [data.attendance]);

  const getCurrentRecords = () => {
    switch (activeTab) {
      case 'absent': return absentRecords;
      case 'present': return presentRecords;
      case 'workedoff': return workedOffRecords;
      case 'offdays': return offDaysRecords;
      case 'errors': return errorRecords;
      case 'audit': return auditRecords;
      default: return [];
    }
  };

  // Get filter options from current records
  const matrixOptions = useMemo(() => {
    const currentRecords = getCurrentRecords();
    return {
      shift: ['All', ...new Set(currentRecords.map(r => r.shift))].filter(Boolean),
      department: ['All', ...new Set(currentRecords.map(r => r.department))].filter(Boolean),
      costCenter: ['All', ...new Set(currentRecords.map(r => r.costCenter))].filter(Boolean),
      legalEntity: ['All', ...new Set(currentRecords.map(r => r.legalEntity))].filter(Boolean),
      location: ['All', ...new Set(currentRecords.map(r => r.location))].filter(Boolean),
      reportingManager: ['All', ...new Set(currentRecords.map(r => r.reportingManager))].filter(Boolean),
      status: ['All', ...new Set(currentRecords.map(r => r.finalStatus))].filter(Boolean)
    };
  }, [activeTab, absentRecords, presentRecords, workedOffRecords, offDaysRecords, errorRecords, auditRecords]);

  // Excel upload for all modules
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>, module: 'absent' | 'present' | 'workedoff' | 'offdays' | 'errors' | 'audit') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        const wb = XLSX.read(dataBuffer, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];

        const excelMap = new Map<string, any>();
        jsonData.forEach(row => {
          const empNum = String(row['Employee Number'] || '').trim();
          const date = formatDate(row['Date']);
          const status = String(row['Final Status'] || row['Status'] || '').trim();
          if (empNum && date && status) {
            excelMap.set(`${empNum}-${date}`, row);
          }
        });

        let updatedCount = 0;

        if (module === 'absent') {
          const updated = absentRecords.map(rec => {
            const excelData = excelMap.get(rec.id);
            if (excelData) {
              updatedCount++;
              return {
                ...rec,
                excelStatus: String(excelData['Final Status'] || excelData['Status'] || '').trim(),
                finalStatus: String(excelData['Final Status'] || excelData['Status'] || rec.originalStatus).trim(),
                comments: String(excelData['Comments'] || rec.comments || '')
              };
            }
            return { ...rec, excelStatus: 'Not Found' };
          });
          setAbsentRecords(updated);
          alert(`Loaded ${updatedCount} absent records with Excel data!`);
        } else if (module === 'present') {
          const updated = presentRecords.map(rec => {
            const excelData = excelMap.get(rec.id);
            if (excelData) {
              updatedCount++;
              return {
                ...rec,
                excelStatus: String(excelData['Final Status'] || excelData['Status'] || '').trim(),
                finalStatus: String(excelData['Final Status'] || excelData['Status'] || rec.originalStatus).trim(),
                comments: String(excelData['Comments'] || rec.comments || '')
              };
            }
            return rec;
          });
          setPresentRecords(updated);
          alert(`Loaded ${updatedCount} present records with Excel data!`);
        } else if (module === 'workedoff') {
          const updated = workedOffRecords.map(rec => {
            const excelData = excelMap.get(rec.id);
            if (excelData) {
              updatedCount++;
              return {
                ...rec,
                excelStatus: String(excelData['Final Status'] || excelData['Status'] || '').trim(),
                finalStatus: String(excelData['Final Status'] || excelData['Status'] || rec.originalStatus).trim(),
                comments: String(excelData['Comments'] || rec.comments || '')
              };
            }
            return rec;
          });
          setWorkedOffRecords(updated);
          alert(`Loaded ${updatedCount} worked off records with Excel data!`);
        } else if (module === 'offdays') {
          const updated = offDaysRecords.map(rec => {
            const excelData = excelMap.get(rec.id);
            if (excelData) {
              updatedCount++;
              return {
                ...rec,
                excelStatus: String(excelData['Final Status'] || excelData['Status'] || '').trim(),
                finalStatus: String(excelData['Final Status'] || excelData['Status'] || rec.originalStatus).trim(),
                comments: String(excelData['Comments'] || rec.comments || '')
              };
            }
            return rec;
          });
          setOffDaysRecords(updated);
          alert(`Loaded ${updatedCount} off days records with Excel data!`);
        } else if (module === 'errors') {
          const updated = errorRecords.map(rec => {
            const excelData = excelMap.get(rec.id);
            if (excelData) {
              updatedCount++;
              return {
                ...rec,
                excelStatus: String(excelData['Final Status'] || excelData['Status'] || '').trim(),
                finalStatus: String(excelData['Final Status'] || excelData['Status'] || rec.originalStatus).trim(),
                comments: String(excelData['Comments'] || rec.comments || '')
              };
            }
            return rec;
          });
          setErrorRecords(updated);
          alert(`Loaded ${updatedCount} error records with Excel data!`);
        } else if (module === 'audit') {
          const updated = auditRecords.map(rec => {
            const excelData = excelMap.get(rec.id);
            if (excelData) {
              updatedCount++;
              return {
                ...rec,
                excelStatus: String(excelData['Final Status'] || excelData['Status'] || '').trim(),
                finalStatus: String(excelData['Final Status'] || excelData['Status'] || rec.originalStatus).trim(),
                comments: String(excelData['Comments'] || rec.comments || '')
              };
            }
            return rec;
          });
          setAuditRecords(updated);
          alert(`Loaded ${updatedCount} audit records with Excel data!`);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to import Excel file.");
      } finally {
        setIsProcessing(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleReconcile = (module: string, index: number) => {
    const updateRecords = (records: ReconciliationRecord[]) => {
      const updated = [...records];
      updated[index] = {
        ...updated[index],
        isReconciled: true,
        reconciledBy: currentUser,
        reconciledOn: formatDate(new Date())
      };
      return updated;
    };

    switch (module) {
      case 'absent':
        setAbsentRecords(updateRecords(absentRecords));
        break;
      case 'present':
        setPresentRecords(updateRecords(presentRecords));
        break;
      case 'workedoff':
        setWorkedOffRecords(updateRecords(workedOffRecords));
        break;
      case 'offdays':
        setOffDaysRecords(updateRecords(offDaysRecords));
        break;
      case 'errors':
        setErrorRecords(updateRecords(errorRecords));
        break;
      case 'audit':
        setAuditRecords(updateRecords(auditRecords));
        break;
    }
  };

  const handleSmartReconcile = () => {
    // Count records that can be auto-accepted
    const canAutoAccept = (record: ReconciliationRecord) => {
      const status = record.finalStatus || record.originalStatus;
      return status === 'Clean' ||
             status === 'Present' ||
             status === 'P' ||
             status === 'Weekly Off' ||
             status === 'WO' ||
             status === 'Holiday' ||
             status === 'H' ||
             status === 'Worked Off' ||
             status === 'WOH';
    };

    // Include ALL modules in the count
    const allRecords = [
      ...absentRecords,
      ...presentRecords,
      ...offDaysRecords,
      ...workedOffRecords,
      ...errorRecords,
      ...auditRecords
    ];

    const autoAcceptable = allRecords.filter(r => !r.isReconciled && canAutoAccept(r));
    const needsReview = allRecords.filter(r => !r.isReconciled && !canAutoAccept(r));
    const totalPending = allRecords.filter(r => !r.isReconciled).length;

    if (autoAcceptable.length === 0) {
      alert('No clean records to auto-accept. All clean records are already reconciled!');
      return;
    }

    const message = `Smart Reconcile will auto-accept ${autoAcceptable.length} clean records:\n\n` +
                   `✅ ${absentRecords.filter(r => !r.isReconciled && canAutoAccept(r)).length} from Absent module\n` +
                   `✅ ${presentRecords.filter(r => !r.isReconciled && canAutoAccept(r)).length} from Present module\n` +
                   `✅ ${offDaysRecords.filter(r => !r.isReconciled && canAutoAccept(r)).length} from Off Days module\n` +
                   `✅ ${workedOffRecords.filter(r => !r.isReconciled && canAutoAccept(r)).length} from Worked Off module\n` +
                   `✅ ${errorRecords.filter(r => !r.isReconciled && canAutoAccept(r)).length} from Errors module\n` +
                   `✅ ${auditRecords.filter(r => !r.isReconciled && canAutoAccept(r)).length} from Audit module\n\n` +
                   `⚠️  ${needsReview.length} records still need manual review\n\n` +
                   `This will reduce your workload from ${totalPending} to ${needsReview.length} records!\n\n` +
                   `Continue?`;

    if (!confirm(message)) {
      return;
    }

    setIsProcessing(true);

    // Auto-accept clean records across ALL modules
    const updateRecords = (recs: ReconciliationRecord[]) => {
      return recs.map(rec => {
        if (!rec.isReconciled && canAutoAccept(rec)) {
          return {
            ...rec,
            isReconciled: true,
            reconciledBy: currentUser,
            reconciledOn: formatDate(new Date())
          };
        }
        return rec;
      });
    };

    const updatedAbsent = updateRecords(absentRecords);
    const updatedPresent = updateRecords(presentRecords);
    const updatedOffDays = updateRecords(offDaysRecords);
    const updatedWorkedOff = updateRecords(workedOffRecords);
    const updatedErrors = updateRecords(errorRecords);
    const updatedAudit = updateRecords(auditRecords);

    setAbsentRecords(updatedAbsent);
    setPresentRecords(updatedPresent);
    setOffDaysRecords(updatedOffDays);
    setWorkedOffRecords(updatedWorkedOff);
    setErrorRecords(updatedErrors);
    setAuditRecords(updatedAudit);

    // Update module statuses
    const newModuleStatuses = {
      absent: {
        name: 'Absent',
        total: updatedAbsent.length,
        reconciled: updatedAbsent.filter(r => r.isReconciled).length,
        isComplete: updatedAbsent.every(r => r.isReconciled)
      },
      present: {
        name: 'Present',
        total: updatedPresent.length,
        reconciled: updatedPresent.filter(r => r.isReconciled).length,
        isComplete: updatedPresent.every(r => r.isReconciled)
      },
      offdays: {
        name: 'Off Days',
        total: updatedOffDays.length,
        reconciled: updatedOffDays.filter(r => r.isReconciled).length,
        isComplete: updatedOffDays.every(r => r.isReconciled)
      },
      workedoff: {
        name: 'Worked Off',
        total: updatedWorkedOff.length,
        reconciled: updatedWorkedOff.filter(r => r.isReconciled).length,
        isComplete: updatedWorkedOff.every(r => r.isReconciled)
      },
      errors: {
        name: 'Errors',
        total: updatedErrors.length,
        reconciled: updatedErrors.filter(r => r.isReconciled).length,
        isComplete: updatedErrors.every(r => r.isReconciled)
      },
      audit: {
        name: 'Audit Queue',
        total: updatedAudit.length,
        reconciled: updatedAudit.filter(r => r.isReconciled).length,
        isComplete: updatedAudit.every(r => r.isReconciled)
      }
    };

    setModuleStatuses(newModuleStatuses);

    // Update parent component
    const moduleData = {
      absent: updatedAbsent,
      present: updatedPresent,
      workedoff: updatedWorkedOff,
      offdays: updatedOffDays,
      errors: updatedErrors,
      audit: updatedAudit
    };
    onUpdate(moduleData, newModuleStatuses);

    setTimeout(() => {
      setIsProcessing(false);
      alert(`🎉 Smart Reconcile Complete!\n\n✅ Auto-accepted ${autoAcceptable.length} clean records\n⚠️  ${needsReview.length} records still need your review`);
    }, 500);
  };

  const handleAcceptAll = (module: string) => {
    const getRecords = () => {
      switch (module) {
        case 'absent': return absentRecords;
        case 'present': return presentRecords;
        case 'workedoff': return workedOffRecords;
        case 'offdays': return offDaysRecords;
        case 'errors': return errorRecords;
        case 'audit': return auditRecords;
        default: return [];
      }
    };

    const records = getRecords();
    const pendingCount = records.filter(r => !r.isReconciled).length;

    if (pendingCount === 0) {
      alert('All records are already reconciled!');
      return;
    }

    if (!confirm(`Accept all ${pendingCount} pending records?\n\nThis will mark all unreconciled records as accepted with their current final status.`)) {
      return;
    }

    const updateRecords = (recs: ReconciliationRecord[]) => {
      return recs.map(rec => {
        if (!rec.isReconciled) {
          return {
            ...rec,
            isReconciled: true,
            reconciledBy: currentUser,
            reconciledOn: formatDate(new Date())
          };
        }
        return rec;
      });
    };

    switch (module) {
      case 'absent':
        setAbsentRecords(updateRecords(absentRecords));
        break;
      case 'present':
        setPresentRecords(updateRecords(presentRecords));
        break;
      case 'workedoff':
        setWorkedOffRecords(updateRecords(workedOffRecords));
        break;
      case 'offdays':
        setOffDaysRecords(updateRecords(offDaysRecords));
        break;
      case 'errors':
        setErrorRecords(updateRecords(errorRecords));
        break;
      case 'audit':
        setAuditRecords(updateRecords(auditRecords));
        break;
    }

    alert(`✅ Accepted ${pendingCount} records!`);
  };

  const handleStatusChange = (module: string, index: number, newStatus: string) => {
    const updateRecords = (records: ReconciliationRecord[]) => {
      const updated = [...records];
      updated[index] = { ...updated[index], finalStatus: newStatus };
      return updated;
    };

    switch (module) {
      case 'absent':
        setAbsentRecords(updateRecords(absentRecords));
        break;
      case 'present':
        setPresentRecords(updateRecords(presentRecords));
        break;
      case 'workedoff':
        setWorkedOffRecords(updateRecords(workedOffRecords));
        break;
      case 'offdays':
        setOffDaysRecords(updateRecords(offDaysRecords));
        break;
      case 'errors':
        setErrorRecords(updateRecords(errorRecords));
        break;
      case 'audit':
        setAuditRecords(updateRecords(auditRecords));
        break;
    }
  };

  const handleCommentChange = (module: string, index: number, comment: string) => {
    const updateRecords = (records: ReconciliationRecord[]) => {
      const updated = [...records];
      updated[index] = { ...updated[index], comments: comment };
      return updated;
    };

    switch (module) {
      case 'absent':
        setAbsentRecords(updateRecords(absentRecords));
        break;
      case 'present':
        setPresentRecords(updateRecords(presentRecords));
        break;
      case 'workedoff':
        setWorkedOffRecords(updateRecords(workedOffRecords));
        break;
      case 'offdays':
        setOffDaysRecords(updateRecords(offDaysRecords));
        break;
      case 'errors':
        setErrorRecords(updateRecords(errorRecords));
        break;
      case 'audit':
        setAuditRecords(updateRecords(auditRecords));
        break;
    }
  };

  const handleMarkModuleComplete = (module: string) => {
    const getRecords = () => {
      switch (module) {
        case 'absent': return absentRecords;
        case 'present': return presentRecords;
        case 'workedoff': return workedOffRecords;
        case 'offdays': return offDaysRecords;
        case 'errors': return errorRecords;
        case 'audit': return auditRecords;
        default: return [];
      }
    };

    const records = getRecords();
    const reconciledCount = records.filter(r => r.isReconciled).length;

    if (reconciledCount < records.length) {
      if (!confirm(`Only ${reconciledCount} of ${records.length} records are reconciled.\n\nMark this module as complete anyway?`)) {
        return;
      }
    }

    setModuleStatuses(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        reconciled: reconciledCount,
        isComplete: true
      }
    }));

    alert(`${moduleStatuses[module].name} module marked as COMPLETE!`);
  };

  const handleFinalizeAll = () => {
    const incomplete = Object.entries(moduleStatuses).filter(([_, status]) => !status.isComplete);

    if (incomplete.length > 0) {
      alert(`Cannot finalize! The following modules are incomplete:\n\n${incomplete.map(([_, status]) => `- ${status.name}`).join('\n')}\n\nPlease complete all modules first.`);
      return;
    }

    if (confirm('Finalize ALL reconciliations?\n\nThis will:\n✓ Update attendance records\n✓ Enable monthly report generation\n✓ Lock all reconciliation data\n\nContinue?')) {
      // IMPORTANT: Only send reconciled records to the report
      const allData = {
        absent: absentRecords.filter(r => r.isReconciled),
        present: presentRecords.filter(r => r.isReconciled),
        workedoff: workedOffRecords.filter(r => r.isReconciled),
        offdays: offDaysRecords.filter(r => r.isReconciled),
        errors: errorRecords.filter(r => r.isReconciled),
        audit: auditRecords.filter(r => r.isReconciled)
      };

      onUpdate(allData, moduleStatuses);
      onFinalizeAll();
      alert('✅ All reconciliations finalized!\n\nMonthly report is now available.\n\nYou can now download the complete reconciled records.');
    }
  };

  const handleDownloadReconciledRecords = () => {
    // Helper function to convert time string to minutes
    const timeToMinutes = (timeStr: string): number => {
      if (!timeStr || timeStr === '-' || timeStr === 'NA' || timeStr === '00:00') return 0;
      const parts = timeStr.split(':');
      if (parts.length !== 2) return 0;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };

    // Combine all reconciled records from all modules
    const allReconciledRecords = [
      ...absentRecords.filter(r => r.isReconciled),
      ...presentRecords.filter(r => r.isReconciled),
      ...workedOffRecords.filter(r => r.isReconciled),
      ...offDaysRecords.filter(r => r.isReconciled),
      ...errorRecords.filter(r => r.isReconciled),
      ...auditRecords.filter(r => r.isReconciled)
    ];

    if (allReconciledRecords.length === 0) {
      alert('No reconciled records to download. Please finalize reconciliation first.');
      return;
    }

    // Sort by employee number, then by date
    allReconciledRecords.sort((a, b) => {
      if (a.employeeNumber !== b.employeeNumber) {
        return a.employeeNumber.localeCompare(b.employeeNumber);
      }
      return a.date.localeCompare(b.date);
    });

    // Calculate work hours for each record
    const exportData = allReconciledRecords.map(record => {
      const inMinutes = timeToMinutes(record.inTime);
      const outMinutes = timeToMinutes(record.outTime);
      const shiftStartMinutes = timeToMinutes(record.shiftStart);

      // Calculate InTime to OutTime work hours
      let workHoursActual = 0;
      if (inMinutes > 0 && outMinutes > 0) {
        workHoursActual = outMinutes > inMinutes
          ? (outMinutes - inMinutes) / 60
          : ((1440 - inMinutes) + outMinutes) / 60; // Handle overnight shifts
      }

      // Calculate Shift Start to OutTime work hours
      let workHoursShift = 0;
      if (shiftStartMinutes > 0 && outMinutes > 0) {
        workHoursShift = outMinutes > shiftStartMinutes
          ? (outMinutes - shiftStartMinutes) / 60
          : ((1440 - shiftStartMinutes) + outMinutes) / 60; // Handle overnight shifts
      }

      return {
        'Employee Number': record.employeeNumber,
        'Employee Name': record.employeeName,
        'Department': record.department,
        'Sub Department': record.subDepartment,
        'Location': record.location,
        'Cost Center': record.costCenter,
        'Legal Entity': record.legalEntity,
        'Reporting Manager': record.reportingManager,
        'Date': record.date,
        'Shift': record.shift,
        'Shift Start': record.shiftStart,
        'Shift End': record.shiftEnd,
        'In Time': record.inTime,
        'Out Time': record.outTime,
        'Total Hours (Gross)': record.totalHours,
        'Work Hours (InTime-OutTime)': workHoursActual > 0 ? workHoursActual.toFixed(2) : '-',
        'Work Hours (Shift-OutTime)': workHoursShift > 0 ? workHoursShift.toFixed(2) : '-',
        'Final Status': record.finalStatus,
        'Deviation': record.deviation || '-',
        'Late By': record.lateBy || '00:00',
        'Early By': record.earlyBy || '00:00',
        'Comments': record.comments || '-',
        'Reconciled By': record.reconciledBy || currentUser,
        'Reconciled On': record.reconciledOn || new Date().toLocaleDateString()
      };
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    const wscols = [
      { wch: 12 }, // Employee Number
      { wch: 25 }, // Employee Name
      { wch: 20 }, // Department
      { wch: 20 }, // Sub Department
      { wch: 15 }, // Location
      { wch: 12 }, // Cost Center
      { wch: 15 }, // Legal Entity
      { wch: 25 }, // Reporting Manager
      { wch: 12 }, // Date
      { wch: 8 },  // Shift
      { wch: 10 }, // Shift Start
      { wch: 10 }, // Shift End
      { wch: 10 }, // In Time
      { wch: 10 }, // Out Time
      { wch: 12 }, // Total Hours
      { wch: 18 }, // Work Hours Actual
      { wch: 18 }, // Work Hours Shift
      { wch: 12 }, // Final Status
      { wch: 30 }, // Deviation
      { wch: 10 }, // Late By
      { wch: 10 }, // Early By
      { wch: 30 }, // Comments
      { wch: 20 }, // Reconciled By
      { wch: 15 }  // Reconciled On
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, 'Reconciled Records');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Reconciled_Attendance_${timestamp}.xlsx`;

    // Download
    XLSX.writeFile(wb, filename);
  };

  const handleSort = (key: keyof ReconciliationRecord) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: null, direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  // Helper function to categorize audit records and determine occurrence count
  const categorizeAuditRecord = (record: ReconciliationRecord): 'lateearly' | 'under4hrs' | '4to7hrs' | 'shift' | 'missing' | 'other' => {
    const deviation = record.deviation || '';

    // Missing Punches - highest priority
    if (deviation.includes('Missing') || deviation.includes('Punch')) {
      return 'missing';
    }

    // Shift Deviations
    if (deviation.includes('Shift') || deviation.includes('Very Early')) {
      return 'shift';
    }

    // Check total work hours for hours-based categorization
    const totalHours = record.totalHours || '00:00';
    const [hoursStr, minutesStr] = totalHours.split(':');
    const totalWorkHours = parseFloat(hoursStr) + parseFloat(minutesStr || '0') / 60;

    // Hours-based categories (priority over frequency)
    if (totalWorkHours > 0 && totalWorkHours < 4) {
      return 'under4hrs';
    } else if (totalWorkHours >= 4 && totalWorkHours < 7) {
      return '4to7hrs';
    }

    // Check if it's a late/early violation
    const isLateOrEarly = (record.lateBy && record.lateBy !== '00:00') || (record.earlyBy && record.earlyBy !== '00:00');

    if (isLateOrEarly) {
      return 'lateearly';
    }

    return 'other';
  };

  // Helper function to get occurrence count for late/early violations
  const getOccurrenceCount = (record: ReconciliationRecord): number => {
    const employeeNumber = record.employeeNumber;
    const recordDate = new Date(record.date);
    const recordMonth = recordDate.getMonth();
    const recordYear = recordDate.getFullYear();

    // Count all late/early violations for this employee up to and including this date
    const violationsUpToThisDate = auditRecords.filter(r => {
      const rDate = new Date(r.date);
      const isLateOrEarly = (r.lateBy && r.lateBy !== '00:00') || (r.earlyBy && r.earlyBy !== '00:00');
      return r.employeeNumber === employeeNumber &&
             rDate.getMonth() === recordMonth &&
             rDate.getFullYear() === recordYear &&
             rDate <= recordDate &&
             isLateOrEarly &&
             categorizeAuditRecord(r) === 'lateearly';
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Find the index of this record in the sorted violations
    const index = violationsUpToThisDate.findIndex(r => r.id === record.id);
    return index + 1; // 1-indexed
  };

  const filteredRecords = useMemo(() => {
    const records = getCurrentRecords();
    let filtered = records.filter(r => {
      const matchSearch = r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchShift = matrixFilters.shift === 'All' || r.shift === matrixFilters.shift;
      const matchDept = matrixFilters.department === 'All' || r.department === matrixFilters.department;
      const matchCC = matrixFilters.costCenter === 'All' || r.costCenter === matrixFilters.costCenter;
      const matchLegal = matrixFilters.legalEntity === 'All' || r.legalEntity === matrixFilters.legalEntity;
      const matchLoc = matrixFilters.location === 'All' || r.location === matrixFilters.location;
      const matchManager = matrixFilters.reportingManager === 'All' || r.reportingManager === matrixFilters.reportingManager;
      const matchStatus = matrixFilters.status === 'All' || r.finalStatus === matrixFilters.status;

      // Additional filter for audit sub-tabs
      let matchAuditSubTab = true;
      if (activeTab === 'audit') {
        const category = categorizeAuditRecord(r);
        matchAuditSubTab = category === auditSubTab;
      }

      return matchSearch && matchShift && matchDept && matchCC && matchLegal && matchLoc && matchManager && matchStatus && matchAuditSubTab;
    });

    // Apply sorting
    if (sortConfig.key && sortConfig.direction) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key!];
        const bVal = b[sortConfig.key!];

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else if (activeTab === 'audit' && auditSubTab === 'lateearly') {
      // Sort by employee number for Late/Early sub-tab when no manual sort is applied
      filtered.sort((a, b) => {
        const aNum = a.employeeNumber;
        const bNum = b.employeeNumber;
        if (aNum < bNum) return -1;
        if (aNum > bNum) return 1;
        // If same employee, sort by date
        const aDate = new Date(a.date).getTime();
        const bDate = new Date(b.date).getTime();
        return aDate - bDate;
      });
    }

    return filtered;
  }, [activeTab, auditSubTab, searchTerm, matrixFilters, sortConfig, absentRecords, presentRecords, workedOffRecords, offDaysRecords, errorRecords, auditRecords]);

  // Excel Export with filters
  const handleExport = () => {
    if (!filteredRecords.length) return alert("No records to export.");

    const exportData = filteredRecords.map(r => ({
      'Employee Number': r.employeeNumber,
      'Employee Name': r.employeeName,
      'Department': r.department,
      'Sub Department': r.subDepartment,
      'Location': r.location,
      'Cost Center': r.costCenter,
      'Legal Entity': r.legalEntity,
      'Reporting Manager': r.reportingManager,
      'Date': r.date,
      'Shift': r.shift,
      'Shift Start': r.shiftStart,
      'Shift End': r.shiftEnd,
      'In Time': r.inTime,
      'Out Time': r.outTime,
      'Work Hours': r.totalHours,
      'Original Status': r.originalStatus,
      ...(activeTab === 'absent' ? { 'Excel Status': r.excelStatus || '-' } : {}),
      'Final Status': r.finalStatus,
      'Comments': r.comments,
      'Reconciled': r.isReconciled ? 'Yes' : 'No',
      'Reconciled By': r.reconciledBy || '-',
      'Reconciled On': r.reconciledOn || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab.toUpperCase());
    XLSX.writeFile(wb, `Intelliguard_Reconciliation_${activeTab.toUpperCase()}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Sub-tab specific export
  const handleSubTabExport = () => {
    const subTabRecords = filteredRecords.filter(r => categorizeAuditRecord(r) === auditSubTab);
    if (!subTabRecords.length) return alert("No records to export for this sub-tab.");

    const exportData = subTabRecords.map(r => {
      const baseData: any = {
        'Employee Number': r.employeeNumber,
        'Employee Name': r.employeeName,
        'Department': r.department,
        'Date': r.date,
        'Shift': r.shift,
        'In Time': r.inTime,
        'Out Time': r.outTime,
        'Work Hours': r.totalHours,
        'Late By': r.lateBy || '-',
        'Early By': r.earlyBy || '-',
        'Deviation': r.deviation || '-',
        'Original Status': r.originalStatus,
        'Final Status': r.finalStatus,
        'Comments': r.comments,
        'Reconciled': r.isReconciled ? 'Yes' : 'No'
      };

      // Add occurrence count for late/early sub-tab
      if (auditSubTab === 'lateearly') {
        const occurrenceCount = getOccurrenceCount(r);
        baseData['Occurrence'] = occurrenceCount === 1 ? '1st' : occurrenceCount === 2 ? '2nd' : `${occurrenceCount}rd+`;
      }

      return baseData;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);

    // Apply cell colors for late/early sub-tab
    if (auditSubTab === 'lateearly') {
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

      for (let row = 1; row <= range.e.r; row++) { // Start from 1 to skip header
        const record = subTabRecords[row - 1];
        if (record) {
          const occurrenceCount = getOccurrenceCount(record);
          let fillColor = '';

          if (occurrenceCount === 1) {
            fillColor = 'D4EDDA'; // Light green
          } else if (occurrenceCount === 2) {
            fillColor = 'FFF3CD'; // Light amber
          } else if (occurrenceCount >= 3) {
            fillColor = 'F8D7DA'; // Light red
          }

          // Apply fill color to all cells in the row
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            if (!ws[cellAddress]) continue;

            if (!ws[cellAddress].s) ws[cellAddress].s = {};
            ws[cellAddress].s.fill = {
              fgColor: { rgb: fillColor }
            };
          }
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, auditSubTab.toUpperCase());
    XLSX.writeFile(wb, `Audit_${auditSubTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Upload handler for sub-tab
  const handleSubTabUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

        // Update records based on uploaded data
        const updatedRecords = auditRecords.map(record => {
          const uploadedRecord = jsonData.find(
            (ur: any) =>
              ur['Employee Number'] === record.employeeNumber &&
              ur['Date'] === record.date
          );

          if (uploadedRecord) {
            return {
              ...record,
              finalStatus: uploadedRecord['Final Status'] || record.finalStatus,
              comments: uploadedRecord['Comments'] || record.comments,
              isReconciled: uploadedRecord['Reconciled'] === 'Yes',
              reconciledBy: uploadedRecord['Reconciled'] === 'Yes' ? currentUser : record.reconciledBy,
              reconciledOn: uploadedRecord['Reconciled'] === 'Yes' ? new Date().toISOString() : record.reconciledOn
            };
          }
          return record;
        });

        // Update module data
        const newModuleData = {
          absent: absentRecords,
          present: presentRecords,
          workedoff: workedOffRecords,
          offdays: offDaysRecords,
          errors: errorRecords,
          audit: updatedRecords
        };

        // Recalculate module statuses
        const newModuleStatuses = {
          ...moduleStatuses,
          audit: {
            name: 'Audit Queue',
            total: updatedRecords.length,
            reconciled: updatedRecords.filter(r => r.isReconciled).length,
            isComplete: updatedRecords.every(r => r.isReconciled)
          }
        };

        setAuditRecords(updatedRecords);
        setModuleStatuses(newModuleStatuses);
        onUpdate(newModuleData, newModuleStatuses);

        alert(`Successfully uploaded and updated ${jsonData.length} records.`);
      } catch (error) {
        alert('Error processing file. Please ensure it matches the exported format.');
      }
    };
    reader.readAsArrayBuffer(file);

    // Reset input
    event.target.value = '';
  };

  // Clear all filters
  const handleClearFilters = () => {
    setMatrixFilters({
      shift: 'All',
      department: 'All',
      costCenter: 'All',
      legalEntity: 'All',
      location: 'All',
      reportingManager: 'All',
      status: 'All'
    });
    setSearchTerm('');
  };

  const allModulesComplete = Object.values(moduleStatuses).every(status => status.isComplete);

  const tabConfig = [
    { id: 'absent', label: 'Absent', icon: UserX, color: 'rose' },
    { id: 'present', label: 'Present', icon: Users, color: 'emerald' },
    { id: 'workedoff', label: 'Worked Off', icon: Calendar, color: 'purple' },
    { id: 'offdays', label: 'Off Days', icon: Clock, color: 'blue' },
    { id: 'errors', label: 'Errors', icon: AlertTriangle, color: 'amber' },
    { id: 'audit', label: 'Audit Queue', icon: AlertCircle, color: 'orange' }
  ];

  const SortIcon = ({ colKey }: { colKey: keyof ReconciliationRecord }) => {
    if (sortConfig.key !== colKey) return <ArrowUpDown size={12} className="ml-1 opacity-30 group-hover:opacity-100 transition-opacity" />;
    if (sortConfig.direction === 'asc') return <ArrowUp size={12} className="ml-1 text-teal-400" />;
    if (sortConfig.direction === 'desc') return <ArrowDown size={12} className="ml-1 text-teal-400" />;
    return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
  };

  const SortableHeader = ({ label, colKey }: { label: string; colKey: keyof ReconciliationRecord }) => (
    <th
      onClick={() => handleSort(colKey)}
      className={`px-4 py-5 cursor-pointer group transition-colors hover:bg-slate-800 ${sortConfig.key === colKey ? 'text-teal-400' : ''}`}
    >
      <div className="flex items-center">
        {label}
        <SortIcon colKey={colKey} />
      </div>
    </th>
  );

  return (
    <div className={`${isFullScreen ? 'fixed inset-0 z-50 bg-slate-50 overflow-auto p-8' : ''} space-y-6 animate-in fade-in duration-500 pb-20`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <FileText className="text-teal-600" size={32} />
            Reconciliation Hub
          </h1>
          <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mt-1">
            Complete all modules to enable monthly report
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="flex items-center space-x-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-xl transition-all bg-slate-700 text-white hover:bg-slate-800"
          >
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            <span>{isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          <button
            onClick={handleSmartReconcile}
            disabled={isProcessing}
            className="flex items-center space-x-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-xl transition-all bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
          >
            <CheckCircle2 size={18} />
            <span>{isProcessing ? 'Processing...' : 'Smart Reconcile'}</span>
          </button>

          <button
            onClick={handleFinalizeAll}
            disabled={!allModulesComplete}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-xl transition-all ${
              allModulesComplete
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {allModulesComplete ? <Unlock size={18} /> : <Lock size={18} />}
            <span>Finalize All Reconciliations</span>
          </button>

          {data.isReconciliationComplete && (
            <button
              onClick={handleDownloadReconciledRecords}
              className="flex items-center space-x-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-xl transition-all bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
            >
              <FileDown size={18} />
              <span>Download Reconciled Records</span>
            </button>
          )}
        </div>
      </div>

      {/* Module Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {Object.entries(moduleStatuses).map(([key, status]) => (
          <div
            key={key}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              status.isComplete
                ? 'bg-emerald-50 border-emerald-200'
                : activeTab === key
                ? 'bg-white border-teal-300 shadow-lg'
                : 'bg-white border-slate-100 hover:border-slate-200'
            }`}
            onClick={() => setActiveTab(key as any)}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-slate-600 uppercase tracking-widest">{status.name}</p>
              {status.isComplete && <CheckCircle size={16} className="text-emerald-600" />}
            </div>
            <p className="text-2xl font-black text-slate-900">{status.total}</p>
            <p className="text-xs text-slate-500 mt-1">
              {status.reconciled} reconciled
            </p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white p-2 rounded-3xl border border-slate-100 shadow-xl">
        <div className="flex flex-wrap gap-2">
          {tabConfig.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const status = moduleStatuses[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  isActive
                    ? `bg-${tab.color}-600 text-white shadow-lg`
                    : `text-slate-600 hover:bg-slate-50`
                }`}
              >
                <Icon size={14} />
                {tab.label}
                <span className={`ml-1 px-2 py-0.5 rounded-md text-[9px] ${
                  isActive ? 'bg-white/20' : 'bg-slate-100'
                }`}>
                  {status.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Audit Sub-Tabs - Only show when Audit tab is active */}
      {activeTab === 'audit' && (
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xl space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex flex-wrap gap-2 flex-1">
              {[
                { id: 'lateearly', label: 'Late/Early Occurrences', color: 'blue', icon: '🕐', count: auditRecords.filter(r => !r.isReconciled && categorizeAuditRecord(r) === 'lateearly').length },
                { id: 'under4hrs', label: 'Worked < 4 Hours', color: 'rose', icon: '⏱️', count: auditRecords.filter(r => !r.isReconciled && categorizeAuditRecord(r) === 'under4hrs').length },
                { id: '4to7hrs', label: 'Worked 4-7 Hours', color: 'orange', icon: '⏰', count: auditRecords.filter(r => !r.isReconciled && categorizeAuditRecord(r) === '4to7hrs').length },
                { id: 'shift', label: 'Shift Deviations', color: 'violet', icon: '🟠', count: auditRecords.filter(r => !r.isReconciled && categorizeAuditRecord(r) === 'shift').length },
                { id: 'missing', label: 'Missing Punches', color: 'pink', icon: '🔴', count: auditRecords.filter(r => !r.isReconciled && categorizeAuditRecord(r) === 'missing').length },
                { id: 'other', label: 'Other Violations', color: 'slate', icon: '⚪', count: auditRecords.filter(r => !r.isReconciled && categorizeAuditRecord(r) === 'other').length },
              ].map((subTab: any) => {
                const isActive = auditSubTab === subTab.id;
                return (
                  <button
                    key={subTab.id}
                    onClick={() => setAuditSubTab(subTab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      isActive
                        ? `bg-${subTab.color}-100 border-2 border-${subTab.color}-500 text-${subTab.color}-700 shadow-md`
                        : `bg-slate-50 border-2 border-transparent text-slate-600 hover:bg-slate-100`
                    }`}
                  >
                    <span>{subTab.icon}</span>
                    {subTab.label}
                    <span className={`ml-1 px-2 py-0.5 rounded-md text-[9px] font-bold ${
                      isActive ? `bg-${subTab.color}-200` : 'bg-slate-200'
                    }`}>
                      {subTab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Upload/Download buttons for current sub-tab */}
            <div className="flex gap-2 ml-4">
              <button
                onClick={handleSubTabExport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-teal-600 text-white hover:bg-teal-700 transition-all shadow-lg"
              >
                <Download size={16} />
                <span>Download</span>
              </button>
              <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg cursor-pointer">
                <Upload size={16} />
                <span>Upload</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleSubTabUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Filters */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="md:col-span-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none text-[10px] font-black focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </div>
          {[
            { key: 'shift', label: 'Shift', opts: matrixOptions.shift },
            { key: 'department', label: 'Dept', opts: matrixOptions.department },
            { key: 'reportingManager', label: 'Manager', opts: matrixOptions.reportingManager },
            { key: 'location', label: 'Location', opts: matrixOptions.location },
            { key: 'legalEntity', label: 'Entity', opts: matrixOptions.legalEntity },
            { key: 'costCenter', label: 'CC', opts: matrixOptions.costCenter },
            { key: 'status', label: 'Status', opts: matrixOptions.status }
          ].map((f) => (
            <div key={f.key} className="relative">
              <select
                value={(matrixFilters as any)[f.key]}
                onChange={e => setMatrixFilters({ ...matrixFilters, [f.key]: e.target.value })}
                className={`w-full appearance-none bg-slate-50 border border-slate-100 text-[10px] font-black py-2.5 pl-3 pr-8 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer transition-all ${
                  (matrixFilters as any)[f.key] !== 'All' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'text-slate-600'
                }`}
              >
                {f.opts.map(opt => <option key={opt} value={opt}>{opt === 'All' ? `${f.label}: All` : opt}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={12} />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleClearFilters}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all text-xs font-bold"
          >
            <Eraser size={14} />
            <span>Clear Filters</span>
          </button>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xl">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="text-sm font-black text-slate-600">
            Showing {filteredRecords.length} of {getCurrentRecords().length} records
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 bg-white text-slate-900 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
            >
              <Download size={14} />
              <span>Export Filtered</span>
            </button>

            {isAdmin && (
              <label className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl cursor-pointer hover:bg-slate-800 transition-all font-black text-[10px] uppercase tracking-widest">
                <Upload size={14} />
                <span>Upload Excel</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => handleExcelUpload(e, activeTab as 'absent' | 'present' | 'workedoff' | 'offdays' | 'errors' | 'audit')}
                  disabled={isProcessing}
                />
              </label>
            )}

            {isAdmin && (
              <button
                onClick={() => handleAcceptAll(activeTab)}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
              >
                <CheckCircle2 size={14} />
                <span>Accept All</span>
              </button>
            )}

            <button
              onClick={() => handleMarkModuleComplete(activeTab)}
              disabled={moduleStatuses[activeTab].isComplete}
              className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={14} />
              <span>Mark Complete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-left table-auto border-collapse">
            <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
              <tr>
                <SortableHeader label="Emp #" colKey="employeeNumber" />
                <SortableHeader label="Name" colKey="employeeName" />
                <SortableHeader label="Department" colKey="department" />
                <SortableHeader label="Date" colKey="date" />
                <SortableHeader label="Shift" colKey="shift" />
                <SortableHeader label="Shift Start" colKey="shiftStart" />
                <SortableHeader label="In Time" colKey="inTime" />
                <SortableHeader label="Out Time" colKey="outTime" />
                <SortableHeader label="Work Hours" colKey="totalHours" />
                <SortableHeader label="Original" colKey="originalStatus" />
                <SortableHeader label="Excel Status" colKey="excelStatus" />
                <SortableHeader label="Final Status" colKey="finalStatus" />
                <th className="px-4 py-5">Comments</th>
                <th className="px-4 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-6 py-12 text-center">
                    <AlertCircle className="mx-auto text-slate-300 mb-3" size={48} />
                    <p className="text-sm font-bold text-slate-400">No records found</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, idx) => {
                  // Determine row color for late/early occurrences in audit sub-tab
                  let rowColorClass = '';
                  if (activeTab === 'audit' && auditSubTab === 'lateearly' && !record.isReconciled) {
                    const occurrenceCount = getOccurrenceCount(record);
                    if (occurrenceCount === 1) {
                      rowColorClass = 'bg-emerald-50/40'; // Green for 1st occurrence
                    } else if (occurrenceCount === 2) {
                      rowColorClass = 'bg-amber-50/40'; // Amber for 2nd occurrence
                    } else if (occurrenceCount >= 3) {
                      rowColorClass = 'bg-red-50/40'; // Red for 3rd+ occurrence (chronic)
                    }
                  }

                  return (
                  <tr key={record.id} className={`hover:bg-slate-50 transition-colors ${record.isReconciled ? 'bg-emerald-50/30' : rowColorClass}`}>
                    <td className="px-4 py-4 text-xs font-black text-slate-900">{record.employeeNumber}</td>
                    <td className="px-4 py-4 text-xs font-black text-teal-600">{record.employeeName}</td>
                    <td className="px-4 py-4 text-xs text-slate-700">{record.department}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-700">{record.date}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-700">{record.shift}</td>
                    <td className="px-4 py-4 text-xs font-bold text-indigo-600">{record.shiftStart}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-900">{record.inTime}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-900">{record.outTime}</td>
                    <td className="px-4 py-4 text-xs font-bold text-emerald-600 bg-emerald-50/20">{record.totalHours}</td>
                    <td className="px-4 py-4">
                      <span className="px-3 py-1 rounded-full text-[9px] font-black bg-slate-100 text-slate-700 uppercase">
                        {record.originalStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                        record.excelStatus === 'Not Found' ? 'bg-slate-100 text-slate-500' :
                        record.excelStatus ? 'bg-indigo-100 text-indigo-700' :
                        'bg-slate-50 text-slate-400'
                      }`}>
                        {record.excelStatus || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {!record.isReconciled && isAdmin ? (
                        <select
                          value={record.finalStatus}
                          onChange={(e) => handleStatusChange(activeTab, idx, e.target.value)}
                          className="px-3 py-1 text-[9px] font-black bg-slate-100 text-slate-700 rounded-lg border border-slate-200 cursor-pointer uppercase"
                        >
                          <optgroup label="Full Day">
                            <option value="P">P</option>
                            <option value="A">A</option>
                            <option value="CL">CL</option>
                            <option value="PL">PL</option>
                            <option value="ML">ML</option>
                            <option value="MEL">MEL</option>
                            <option value="CO">CO</option>
                            <option value="LOP">LOP</option>
                            <option value="WO">WO</option>
                            <option value="H">H</option>
                          </optgroup>
                          <optgroup label="Half Day Combinations">
                            <option value="P/A">P/A</option>
                            <option value="A/P">A/P</option>
                            <option value="P/CL">P/CL</option>
                            <option value="CL/P">CL/P</option>
                            <option value="P/PL">P/PL</option>
                            <option value="PL/P">PL/P</option>
                            <option value="P/ML">P/ML</option>
                            <option value="ML/P">ML/P</option>
                            <option value="P/CO">P/CO</option>
                            <option value="CO/P">CO/P</option>
                            <option value="P/LOP">P/LOP</option>
                            <option value="LOP/P">LOP/P</option>
                            <option value="A/CL">A/CL</option>
                            <option value="CL/A">CL/A</option>
                            <option value="A/PL">A/PL</option>
                            <option value="PL/A">PL/A</option>
                            <option value="A/ML">A/ML</option>
                            <option value="ML/A">ML/A</option>
                            <option value="A/CO">A/CO</option>
                            <option value="CO/A">CO/A</option>
                            <option value="A/LOP">A/LOP</option>
                            <option value="LOP/A">LOP/A</option>
                            <option value="CL/PL">CL/PL</option>
                            <option value="PL/CL">PL/CL</option>
                            <option value="CL/ML">CL/ML</option>
                            <option value="ML/CL">ML/CL</option>
                            <option value="CL/CO">CL/CO</option>
                            <option value="CO/CL">CO/CL</option>
                            <option value="CL/LOP">CL/LOP</option>
                            <option value="LOP/CL">LOP/CL</option>
                            <option value="PL/ML">PL/ML</option>
                            <option value="ML/PL">ML/PL</option>
                            <option value="PL/CO">PL/CO</option>
                            <option value="CO/PL">CO/PL</option>
                            <option value="PL/LOP">PL/LOP</option>
                            <option value="LOP/PL">LOP/PL</option>
                            <option value="ML/CO">ML/CO</option>
                            <option value="CO/ML">CO/ML</option>
                            <option value="ML/LOP">ML/LOP</option>
                            <option value="LOP/ML">LOP/ML</option>
                            <option value="CO/LOP">CO/LOP</option>
                            <option value="LOP/CO">LOP/CO</option>
                          </optgroup>
                        </select>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-700 uppercase">
                          {record.finalStatus}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {!record.isReconciled && isAdmin ? (
                        <input
                          type="text"
                          value={record.comments}
                          onChange={(e) => handleCommentChange(activeTab, idx, e.target.value)}
                          placeholder="Add comment..."
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      ) : (
                        <span className="text-xs text-slate-600">{record.comments || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 justify-center">
                        {!record.isReconciled && isAdmin ? (
                          <button
                            onClick={() => handleReconcile(activeTab, idx)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-xs font-bold"
                          >
                            <CheckCircle size={14} />
                            Accept
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle size={14} />
                            Done
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Completion Status */}
      {!allModulesComplete && (
        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200">
          <div className="flex items-start gap-4">
            <Lock className="text-amber-600 flex-shrink-0 mt-1" size={24} />
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">Monthly Report Locked</h3>
              <p className="text-sm text-slate-700">
                Complete all 6 reconciliation modules to unlock monthly report generation.
              </p>
              <p className="text-xs text-slate-600 mt-2">
                Incomplete modules: {Object.entries(moduleStatuses).filter(([_, s]) => !s.isComplete).map(([_, s]) => s.name).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {allModulesComplete && (
        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-200">
          <div className="flex items-start gap-4">
            <Unlock className="text-emerald-600 flex-shrink-0 mt-1" size={24} />
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">Ready to Finalize</h3>
              <p className="text-sm text-slate-700">
                All modules are complete! Click "Finalize All Reconciliations" to update attendance and enable monthly report.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReconciliationHub;
