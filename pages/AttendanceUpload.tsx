
import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Calculator,
  Loader2,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Calendar,
  UserMinus,
  UserX,
  ChevronDown,
  Download,
  Briefcase,
  FileDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eraser
} from 'lucide-react';
import { AttendanceRecord, AppData, UserRole } from '../types.ts';
import * as XLSX from 'xlsx';

interface AttendanceUploadProps {
  data: AppData;
  onUpdate: (attendance: AttendanceRecord[]) => void;
  role: UserRole;
  onRecalculate?: () => void;
  onAutoAllot?: () => void;
}

type Category = 'all' | 'clean' | 'audit' | 'absent' | 'offdays' | 'workedOff' | 'errors';

interface SortConfig {
  key: keyof AttendanceRecord | 'shiftDuration';
  direction: 'asc' | 'desc' | null;
}

const AttendanceUpload: React.FC<AttendanceUploadProps> = ({ data, onUpdate, role, onRecalculate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<Category>('all');
  const [localAttendance, setLocalAttendance] = useState<AttendanceRecord[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [importSummary, setImportSummary] = useState<{ added: number; updated: number } | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: null });

  const [matrixFilters, setMatrixFilters] = useState({
    shift: 'All',
    department: 'All',
    costCenter: 'All',
    legalEntity: 'All',
    location: 'All',
    reportingManager: 'All',
    status: 'All'
  });

  useEffect(() => {
    if (!isDirty) {
      setLocalAttendance(data.attendance || []);
    }
  }, [data.attendance, isDirty]);

  useEffect(() => {
    if (isDirty) {
      setIsAutosaving(true);
      const timer = setTimeout(() => {
        onUpdate(localAttendance);
        setIsDirty(false);
        setIsAutosaving(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [localAttendance, isDirty, onUpdate]);

  const isAdmin = role === 'Admin' || role === 'SaaS_Admin';

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
    const absMins = Math.abs(totalMinutes);
    const h = Math.floor(absMins / 60).toString().padStart(2, '0');
    const m = (absMins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const diffMinutes = (start: number, end: number) => {
    if (end < start) return (end + 1440) - start;
    return end - start;
  };

  const parseDateForSort = (dateStr: string): number => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const parts = dateStr.split('-');
    if (parts.length !== 3) return 0;
    const day = parseInt(parts[0], 10);
    const month = months.indexOf(parts[1].toUpperCase());
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day).getTime();
  };

  const handleSort = (key: SortConfig['key']) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: 'date', direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  const matrixOptions = useMemo(() => {
    return {
      shift: ['All', ...new Set(localAttendance.map(r => r.shift))].filter(Boolean),
      department: ['All', ...new Set(localAttendance.map(r => r.department))].filter(Boolean),
      costCenter: ['All', ...new Set(localAttendance.map(r => r.costCenter))].filter(Boolean),
      legalEntity: ['All', ...new Set(localAttendance.map(r => r.legalEntity))].filter(Boolean),
      location: ['All', ...new Set(localAttendance.map(r => r.location))].filter(Boolean),
      reportingManager: ['All', ...new Set(localAttendance.map(r => r.reportingManager))].filter(Boolean),
      status: ['All', ...new Set(localAttendance.map(r => r.status))].filter(Boolean)
    };
  }, [localAttendance]);

  const categories = useMemo(() => {
    const filteredByMatrix = localAttendance.filter(r => {
      const matchSearch = (r.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (r.employeeNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchShift = matrixFilters.shift === 'All' || r.shift === matrixFilters.shift;
      const matchDept = matrixFilters.department === 'All' || r.department === matrixFilters.department;
      const matchCC = matrixFilters.costCenter === 'All' || r.costCenter === matrixFilters.costCenter;
      const matchLegal = matrixFilters.legalEntity === 'All' || r.legalEntity === matrixFilters.legalEntity;
      const matchLoc = matrixFilters.location === 'All' || r.location === matrixFilters.location;
      const matchManager = matrixFilters.reportingManager === 'All' || r.reportingManager === matrixFilters.reportingManager;
      const matchStatus = matrixFilters.status === 'All' || r.status === matrixFilters.status;
      return matchSearch && matchShift && matchDept && matchCC && matchLegal && matchLoc && matchManager && matchStatus;
    });

    // Apply Sorting
    if (sortConfig.direction) {
      filteredByMatrix.sort((a, b) => {
        let valA: any = a[sortConfig.key as keyof AttendanceRecord];
        let valB: any = b[sortConfig.key as keyof AttendanceRecord];

        // Handle Shift Duration Virtual Column
        if (sortConfig.key === 'shiftDuration') {
          valA = diffMinutes(timeToMinutes(a.shiftStart), timeToMinutes(a.shiftEnd));
          valB = diffMinutes(timeToMinutes(b.shiftStart), timeToMinutes(b.shiftEnd));
        }
        // Handle Date Sorting
        else if (sortConfig.key === 'date') {
          valA = parseDateForSort(a.date);
          valB = parseDateForSort(b.date);
        }
        // Handle Time/Duration Strings
        else if (['inTime', 'outTime', 'totalHours', 'effectiveHours', 'lateBy', 'earlyBy'].includes(sortConfig.key)) {
          valA = timeToMinutes(valA);
          valB = timeToMinutes(valB);
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const absent: AttendanceRecord[] = [];
    const offdays: AttendanceRecord[] = [];
    const workedOff: AttendanceRecord[] = [];
    const errors: AttendanceRecord[] = [];
    const audit: AttendanceRecord[] = [];
    const clean: AttendanceRecord[] = [];

    filteredByMatrix.forEach(r => {
      if (r.status === 'ID Error') errors.push(r);
      else if (r.status === 'Absent') absent.push(r);
      else if (r.status === 'Holiday' || r.status === 'Weekly Off') offdays.push(r);
      else if (r.status === 'Worked Off') workedOff.push(r);
      else if (r.status === 'Audit' || r.status === 'Shift Audit?' || r.status === 'Very Early' || r.status === 'Very Late') audit.push(r);
      else clean.push(r);
    });
    
    return { all: filteredByMatrix, audit, errors, offdays, absent, clean, workedOff };
  }, [localAttendance, searchTerm, matrixFilters, sortConfig]);

  const currentTabRecords = categories[activeTab];

  const formatTimeFromValue = (val: any): string => {
    if (val === undefined || val === null || val === '') return '00:00';
    if (typeof val === 'string') {
      const trimmed = val.trim().toUpperCase();
      if (trimmed === 'NA' || trimmed === '-' || trimmed === '') return '00:00';
      if (/^\d{1,2}:\d{2}$/.test(trimmed)) return trimmed.padStart(5, '0');
      if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed.substring(0, 5).padStart(5, '0');
      return trimmed;
    }
    if (typeof val === 'number') {
      const totalMinutes = Math.round(val * 24 * 60);
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return String(val);
  };

  const formatDate = (date: any): string => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handleExportTemplate = () => {
    const templateData = [
      { 'Employee Number': 'E001', 'Date': '01-JAN-2024', 'Shift': 'GS', 'In Time': '09:00', 'Out Time': '18:00' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AttendanceTemplate");
    XLSX.writeFile(wb, "Attendify_Attendance_Import_Template.xlsx");
  };

  const handleExport = () => {
    if (!currentTabRecords.length) return alert("No records to export.");
    const exportData = currentTabRecords.map(r => ({
      'Employee Number': r.employeeNumber,
      'Employee Name': r.employeeName,
      'Date': r.date,
      'Shift': r.shift,
      'In Time': r.inTime,
      'Out Time': r.outTime,
      'Status': r.status,
      'Deviation': r.deviation,
      'Total Hours': r.totalHours
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab.toUpperCase());
    XLSX.writeFile(wb, `Intelliguard_${activeTab}_Audit.xlsx`);
  };

  const handleAttendanceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const attMap = new Map<string, AttendanceRecord>();
        localAttendance.forEach(rec => {
          const key = `${rec.employeeNumber.toUpperCase()}|${rec.date.toUpperCase()}`;
          attMap.set(key, rec);
        });
        jsonData.forEach(row => {
          const empId = String(row['Employee Number'] || row['ID'] || row['Staff ID'] || '').trim();
          const rawDate = row['Date'] || row['Log Date'];
          if (!empId || !rawDate) return;
          const dateStr = formatDate(rawDate);
          const key = `${empId.toUpperCase()}|${dateStr.toUpperCase()}`;
          attMap.set(key, {
            employeeNumber: empId,
            employeeName: String(row['Employee Name'] || 'SYNC PENDING'),
            jobTitle: String(row['Job Title'] || 'N/A'),
            businessUnit: String(row['Business Unit'] || 'N/A'),
            department: String(row['Department'] || 'N/A'),
            subDepartment: String(row['Sub Department'] || 'N/A'),
            location: String(row['Location'] || 'N/A'),
            costCenter: String(row['Cost Center'] || 'N/A'),
            reportingManager: String(row['Reporting Manager'] || 'N/A'),
            legalEntity: String(row['Legal Entity'] || 'N/A'),
            date: dateStr,
            shift: String(row['Shift'] || 'GS'),
            shiftStart: formatTimeFromValue(row['Shift Start']),
            inTime: formatTimeFromValue(row['In Time'] || row['Clock In']),
            lateBy: formatTimeFromValue(row['Late By']),
            shiftEnd: formatTimeFromValue(row['Shift End']),
            outTime: formatTimeFromValue(row['Out Time'] || row['Clock Out']),
            earlyBy: formatTimeFromValue(row['Early By']),
            status: String(row['Status'] || 'Clean'),
            deviation: '-',
            effectiveHours: formatTimeFromValue(row['Effective Hours']),
            totalHours: formatTimeFromValue(row['Total Hours']),
            breakDuration: formatTimeFromValue(row['Break Duration'] || '01:00'),
            overTime: formatTimeFromValue(row['Over Time']),
            totalShortHoursEffective: formatTimeFromValue(row['Total Short Hours(Effective)']),
            totalShortHoursGross: formatTimeFromValue(row['Total Short Hours(Gross)'])
          });
        });
        setLocalAttendance(Array.from(attMap.values()));
        setIsDirty(true);
      } catch (err) {
        alert("Import failed.");
      } finally {
        setIsProcessing(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const SortIcon = ({ colKey }: { colKey: SortConfig['key'] }) => {
    if (sortConfig.key !== colKey) return <ArrowUpDown size={12} className="ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    if (sortConfig.direction === 'asc') return <ArrowUp size={12} className="ml-1 text-teal-400" />;
    if (sortConfig.direction === 'desc') return <ArrowDown size={12} className="ml-1 text-teal-400" />;
    return <ArrowUpDown size={12} className="ml-1 opacity-20" />;
  };

  const Header = ({ label, colKey, stickyClass }: { label: string; colKey: SortConfig['key']; stickyClass?: string }) => (
    <th 
      onClick={() => handleSort(colKey)}
      className={`px-6 py-5 cursor-pointer group transition-colors hover:bg-slate-800 ${stickyClass || ''} ${sortConfig.key === colKey ? 'text-teal-400' : ''}`}
    >
      <div className="flex items-center">
        {label}
        <SortIcon colKey={colKey} />
      </div>
    </th>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Calculator className="text-teal-600" size={32} />
            Attendance Logs Audit
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500 font-medium text-[10px] uppercase tracking-widest">
               Database: {localAttendance.length} Logs
            </p>
            {isAutosaving && <span className="text-[9px] font-black text-teal-600 uppercase tracking-widest bg-teal-50 px-2 py-0.5 rounded animate-pulse">Auto-Sync...</span>}
          </div>
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto flex-wrap gap-y-2">
          <button onClick={handleExportTemplate} className="flex items-center space-x-2 bg-white text-slate-600 border border-slate-200 px-6 py-2.5 rounded-xl hover:bg-slate-50 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm">
            <FileDown size={14} className="text-emerald-600" />
            <span>Template</span>
          </button>
          <button onClick={handleExport} className="flex items-center space-x-2 bg-white text-slate-900 border border-slate-200 px-6 py-2.5 rounded-xl hover:bg-slate-50 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm">
            <Download size={14} />
            <span>Export View</span>
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => {
                  if(confirm("Clear all attendance logs? This action cannot be undone.")) {
                    setLocalAttendance([]);
                    setIsDirty(true);
                  }
                }}
                className="flex items-center space-x-2 bg-rose-50 text-rose-600 border border-rose-100 px-6 py-2.5 rounded-xl hover:bg-rose-100 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
              >
                <Eraser size={14} />
                <span>Clear Logs</span>
              </button>
              <button onClick={onRecalculate} className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100">
                <RefreshCw size={14} />
                <span>Recalculate Logic</span>
              </button>
              <label className="flex items-center space-x-2 bg-slate-900 text-white px-8 py-2.5 rounded-xl cursor-pointer hover:bg-slate-800 transition-all font-black text-[10px] uppercase tracking-widest shadow-xl">
                {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <FileSpreadsheet size={14} />}
                <span>Import XLSX</span>
                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleAttendanceUpload} />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="md:col-span-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Search ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none text-[10px] font-black focus:ring-2 focus:ring-teal-500 transition-all" />
          </div>
          {[
            { key: 'shift', label: 'Shift', opts: matrixOptions.shift },
            { key: 'department', label: 'Dept', opts: matrixOptions.department },
            { key: 'reportingManager', label: 'Manager', opts: matrixOptions.reportingManager },
            { key: 'location', label: 'Location', opts: matrixOptions.location },
            { key: 'legalEntity', label: 'Entity', opts: matrixOptions.legalEntity },
            { key: 'costCenter', label: 'CC', opts: matrixOptions.costCenter },
            { key: 'status', label: 'Status', opts: matrixOptions.status },
          ].map((f) => (
            <div key={f.key} className="relative">
              <select value={(matrixFilters as any)[f.key]} onChange={e => setMatrixFilters({...matrixFilters, [f.key]: e.target.value})} className={`w-full appearance-none bg-slate-50 border border-slate-100 text-[10px] font-black py-2.5 pl-3 pr-8 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer transition-all ${ (matrixFilters as any)[f.key] !== 'All' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'text-slate-600' }`}>
                {f.opts.map(opt => <option key={opt} value={opt}>{opt === 'All' ? `${f.label}: All` : opt}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={12} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1 p-1 bg-slate-200/50 rounded-2xl w-fit overflow-x-auto max-w-full">
          {[
            { id: 'all', label: 'All Logs', icon: Filter, color: 'text-teal-600' },
            { id: 'clean', label: 'Clean Logs', icon: CheckCircle2, color: 'text-emerald-600' },
            { id: 'audit', label: 'Audit Queue', icon: ShieldAlert, color: 'text-amber-600' },
            { id: 'absent', label: 'Absent', icon: UserMinus, color: 'text-rose-900' },
            { id: 'workedOff', label: 'Worked Off', icon: Briefcase, color: 'text-indigo-600' },
            { id: 'offdays', label: 'Off Days', icon: Calendar, color: 'text-slate-400' },
            { id: 'errors', label: 'Errors', icon: UserX, color: 'text-slate-900' },
          ].map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id as Category)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === t.id ? `bg-white ${t.color} shadow-sm border border-slate-100` : 'text-slate-500 hover:bg-white/50'}`}>
              <t.icon size={14} /> {t.label}
              <span className={`ml-1 px-2 py-0.5 rounded-md text-[9px] border ${activeTab === t.id ? 'bg-slate-50 border-slate-200' : 'bg-slate-300 border-transparent text-slate-600'}`}>
                {categories[t.id as Category].length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden flex flex-col h-[700px]">
        <div className="overflow-auto flex-1 scrollbar-thin">
          <table className="w-full text-left table-auto min-w-max border-collapse">
            <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
              <tr>
                <Header label="Staff ID" colKey="employeeNumber" stickyClass="sticky left-0 bg-slate-900 z-50 border-r border-slate-800" />
                <Header label="Full Name" colKey="employeeName" stickyClass="sticky left-[100px] bg-slate-900 z-50 border-r border-slate-800" />
                <Header label="Date" colKey="date" stickyClass="sticky left-[300px] bg-slate-900 z-50 border-r border-slate-800" />
                <Header label="Shift" colKey="shift" />
                <Header label="In Time" colKey="inTime" />
                <Header label="Out Time" colKey="outTime" />
                <Header label="Shift Dur." colKey="shiftDuration" />
                <Header label="Actual Dur." colKey="totalHours" />
                <Header label="Status" colKey="status" />
                <Header label="Deviation Remarks" colKey="deviation" />
                <Header label="Entity" colKey="legalEntity" />
                <Header label="Location" colKey="location" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentTabRecords.map((rec) => {
                const sInMins = timeToMinutes(rec.shiftStart);
                const sOutMins = timeToMinutes(rec.shiftEnd);
                const hasSStart = typeof rec.shiftStart === 'string' && rec.shiftStart.includes(':');
                const hasSEnd = typeof rec.shiftEnd === 'string' && rec.shiftEnd.includes(':');
                const shiftDuration = (hasSStart && hasSEnd) ? minutesToTime(diffMinutes(sInMins, sOutMins)) : '00:00';
                const actualDuration = rec.totalHours || '00:00';

                return (
                  <tr key={`${rec.employeeNumber}|${rec.date}`} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 text-[10px] font-black text-slate-400">{rec.employeeNumber}</td>
                    <td className="px-6 py-4 sticky left-[100px] bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 text-[11px] font-black text-slate-900">{rec.employeeName}</td>
                    <td className="px-6 py-4 sticky left-[300px] bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 text-[11px] font-black text-teal-600 uppercase font-mono">{rec.date}</td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-700">{rec.shift}</td>
                    <td className="px-6 py-4 text-[11px] font-black text-slate-900">{rec.inTime || '00:00'}</td>
                    <td className="px-6 py-4 text-[11px] font-black text-slate-900">{rec.outTime || '00:00'}</td>
                    <td className="px-6 py-4 text-[10px] font-black text-indigo-600 bg-indigo-50/20">{shiftDuration}</td>
                    <td className={`px-6 py-4 text-[10px] font-black bg-emerald-50/20 text-emerald-700`}>{actualDuration}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight ${
                        rec.status === 'Clean' ? 'bg-emerald-100 text-emerald-700' : 
                        rec.status === 'Absent' ? 'bg-rose-900 text-white' :
                        rec.status === 'Worked Off' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                        rec.status === 'Holiday' || rec.status === 'Weekly Off' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                        rec.status === 'Very Early' ? 'bg-indigo-50 text-indigo-400 border border-indigo-100' :
                        rec.status === 'Very Late' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                        rec.status === 'Audit' || rec.status === 'Shift Audit?' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-[10px] font-black truncate max-w-[250px] ${rec.deviation?.includes('Waiver') ? 'text-teal-600 font-black italic' : 'text-slate-500'}`}>
                      {rec.deviation}
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">{rec.legalEntity}</td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">{rec.location}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendanceUpload;
