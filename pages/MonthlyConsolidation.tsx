
import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Download,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Search,
  RefreshCw
} from 'lucide-react';
import { AppData, AttendanceRecord, UserRole } from '../types.ts';
import * as XLSX from 'xlsx';

interface MonthlyConsolidationProps {
  data: AppData;
  role: UserRole;
  onMarkReconciled?: () => void;
}

type AttendanceStatus = 'P' | 'HD' | 'A' | 'WO' | 'WOH' | 'H' | '-';

interface DayAttendance {
  date: string;
  status: AttendanceStatus;
  inTime: string;
  outTime: string;
  hoursWorked: number;
  isLate: boolean;
  isEarly: boolean;
  lateMinutes: number;
  earlyMinutes: number;
}

interface EmployeeMonthlyData {
  employeeNumber: string;
  employeeName: string;
  department: string;
  reportingManager: string;
  days: DayAttendance[];
  hasUnreconciledRecords: boolean;
  summary: {
    totalPresent: number;
    totalHalfDay: number;
    totalAbsent: number;
    totalWeeklyOff: number;
    totalWorkedOff: number;
    totalHoliday: number;
    workingDays: number;
    attendancePercentage: number;
    lateCount: number;
    earlyCount: number;
    totalShortageHours: number;
    totalWorkHoursActual: number; // InTime to OutTime
    totalWorkHoursShift: number;  // Shift Start to OutTime
  };
}

const MonthlyConsolidation: React.FC<MonthlyConsolidationProps> = ({ data, role, onMarkReconciled }) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [reportingManagerFilter, setReportingManagerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'calendar' | 'summary' | 'workhours-actual' | 'workhours-shift'>('calendar');

  // Check if reconciliation is complete
  const isReconciled = data.isReconciliationComplete;

  // Map status codes to full names (matching ReconciliationHub)
  const mapStatusToFullName = (status: AttendanceStatus): string => {
    switch (status) {
      case 'P': return 'Present';
      case 'A': return 'Absent';
      case 'WO': return 'Weekly Off';
      case 'WOH': return 'Worked Off';
      case 'H': return 'Holiday';
      case 'HD': return 'Audit'; // Half day is treated as audit
      case '-': return '';
      default: return status;
    }
  };

  // Check if status matches filter
  const statusMatchesFilter = (status: AttendanceStatus): boolean => {
    if (statusFilter === 'All') return true;
    const fullName = mapStatusToFullName(status);

    // Handle multiple mappings
    if (statusFilter === 'Present' && (status === 'P' || fullName === 'Present' || fullName === 'Clean')) return true;
    if (statusFilter === 'Absent' && (status === 'A' || fullName === 'Absent')) return true;
    if (statusFilter === 'Worked Off' && (status === 'WOH' || fullName === 'Worked Off')) return true;
    if (statusFilter === 'Weekly Off' && (status === 'WO' || fullName === 'Weekly Off')) return true;
    if (statusFilter === 'Holiday' && (status === 'H' || fullName === 'Holiday')) return true;
    if (statusFilter === 'Audit' && (status === 'HD' || fullName === 'Audit')) return true;
    if (statusFilter === 'ID Error' && fullName.includes('Error')) return true;

    return fullName === statusFilter;
  };

  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || timeStr === '-' || timeStr === 'NA') return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  // Get color based on work hours
  const getWorkHoursColor = (hours: number): string => {
    if (hours === 0) return 'text-slate-400'; // No data
    if (hours > 0 && hours < 4) return 'text-rose-600';    // 0-4 hrs: Red
    if (hours >= 4 && hours < 7) return 'text-amber-600';  // 4-7 hrs: Amber
    if (hours >= 7 && hours <= 12) return 'text-emerald-600'; // 7-12 hrs: Green
    return 'text-purple-600'; // Beyond 12 hrs: Purple
  };

  const minutesToTime = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const m = (totalMinutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const parseFormattedDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const monthIndex = months.indexOf(parts[1].toUpperCase());
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || monthIndex === -1 || isNaN(year)) return null;
    return new Date(year, monthIndex, day);
  };

  const formatDateToDDMMMYYYY = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const isWeeklyOff = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    return data.weeklyOffs.includes(dayOfWeek);
  };

  const isHoliday = (dateStr: string): boolean => {
    return data.holidays.some(h => h.date.toUpperCase() === dateStr.toUpperCase());
  };

  const calculateAttendanceStatus = (
    record: AttendanceRecord | undefined,
    dateStr: string,
    date: Date,
    shiftStartMinutes: number,
    requiredHours: number,
    lateToleranceUsed: boolean,
    earlyToleranceUsed: boolean
  ): { status: AttendanceStatus; isLate: boolean; isEarly: boolean; lateMinutes: number; earlyMinutes: number; hoursWorked: number } => {

    const isWO = isWeeklyOff(date);
    const isHol = isHoliday(dateStr);

    // Check if record is marked as UNRECONCILED_ABSENT - show as blank
    if (record && record.status === 'UNRECONCILED_ABSENT') {
      return { status: '-', isLate: false, isEarly: false, lateMinutes: 0, earlyMinutes: 0, hoursWorked: 0 };
    }

    // If no record exists
    if (!record || !record.inTime) {
      if (isWO) return { status: 'WO', isLate: false, isEarly: false, lateMinutes: 0, earlyMinutes: 0, hoursWorked: 0 };
      if (isHol) return { status: 'H', isLate: false, isEarly: false, lateMinutes: 0, earlyMinutes: 0, hoursWorked: 0 };
      return { status: 'A', isLate: false, isEarly: false, lateMinutes: 0, earlyMinutes: 0, hoursWorked: 0 };
    }

    const inMinutes = timeToMinutes(record.inTime);
    const outMinutes = timeToMinutes(record.outTime);

    // Calculate hours worked (In time to Out time)
    let hoursWorked = 0;
    if (inMinutes > 0 && outMinutes > 0) {
      let workMinutes = 0;
      if (outMinutes >= inMinutes) {
        workMinutes = outMinutes - inMinutes;
      } else {
        // Crossing midnight
        workMinutes = (1440 - inMinutes) + outMinutes;
      }
      hoursWorked = workMinutes / 60;
    } else if (inMinutes > 0 && outMinutes === 0) {
      // Missing out punch - half day absent
      return { status: 'HD', isLate: false, isEarly: false, lateMinutes: 0, earlyMinutes: 0, hoursWorked: 0 };
    }

    // Check for late and early
    let isLate = false;
    let isEarly = false;
    let lateMinutes = 0;
    let earlyMinutes = 0;

    if (shiftStartMinutes > 0 && inMinutes > shiftStartMinutes) {
      lateMinutes = inMinutes - shiftStartMinutes;
      if (lateMinutes > 60 || (lateMinutes > 0 && lateToleranceUsed)) {
        isLate = true;
      }
    }

    // Early departure check (simplified - would need shift end time)
    // For now, we'll mark early if out time is significantly before expected
    if (hoursWorked < requiredHours) {
      const shortfall = requiredHours - hoursWorked;
      earlyMinutes = Math.floor(shortfall * 60);
      if (earlyMinutes > 60 || (earlyMinutes > 0 && earlyToleranceUsed)) {
        isEarly = true;
      }
    }

    // Late In & Early departure not allowed in the same day
    if (isLate && isEarly) {
      // Violates rule - mark as half day
      return { status: 'HD', isLate, isEarly, lateMinutes, earlyMinutes, hoursWorked };
    }

    // Worked on Weekly Off
    if (isWO && hoursWorked >= 4) {
      return { status: 'WOH', isLate: false, isEarly: false, lateMinutes: 0, earlyMinutes: 0, hoursWorked };
    }
    if (isWO) {
      return { status: 'WO', isLate: false, isEarly: false, lateMinutes: 0, earlyMinutes: 0, hoursWorked };
    }

    // Worked on Holiday
    if (isHol && hoursWorked >= 4) {
      return { status: 'WOH', isLate: false, isEarly: false, lateMinutes: 0, earlyMinutes: 0, hoursWorked };
    }
    if (isHol) {
      return { status: 'H', isLate: false, isEarly: false, lateMinutes: 0, earlyMinutes: 0, hoursWorked };
    }

    // Full Day Present: >= 8 hours
    if (hoursWorked >= 8 && !isLate && !isEarly) {
      return { status: 'P', isLate, isEarly, lateMinutes, earlyMinutes, hoursWorked };
    }

    // Half Day: 4-8 hours
    if (hoursWorked >= 4 && hoursWorked < 8) {
      return { status: 'HD', isLate, isEarly, lateMinutes, earlyMinutes, hoursWorked };
    }

    // Less than 4 hours but came - Half Day Absent
    if (hoursWorked > 0 && hoursWorked < 4) {
      return { status: 'HD', isLate, isEarly, lateMinutes, earlyMinutes, hoursWorked };
    }

    // Full Absent
    return { status: 'A', isLate, isEarly, lateMinutes, earlyMinutes, hoursWorked };
  };

  const consolidatedData = useMemo(() => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const employeeMap = new Map<string, EmployeeMonthlyData>();

    // Create a map of reconciled records with their finalStatus for quick lookup
    const reconciliationMap = new Map<string, { isReconciled: boolean; finalStatus: string }>();
    if (data.reconciliationRecords && Array.isArray(data.reconciliationRecords)) {
      data.reconciliationRecords.forEach((rec: any) => {
        const key = `${rec.employeeNumber}-${rec.date}`.toUpperCase();
        reconciliationMap.set(key, {
          isReconciled: rec.isReconciled || false,
          finalStatus: rec.finalStatus || rec.originalStatus || '-'
        });
      });
    }

    // Group ALL attendance by employee (we'll filter at day level)
    const attendanceByEmployee = new Map<string, AttendanceRecord[]>();
    data.attendance.forEach(record => {
      const recordDate = parseFormattedDate(record.date);
      if (recordDate && recordDate.getFullYear() === selectedYear && recordDate.getMonth() === selectedMonth) {
        if (!attendanceByEmployee.has(record.employeeNumber)) {
          attendanceByEmployee.set(record.employeeNumber, []);
        }
        attendanceByEmployee.get(record.employeeNumber)!.push(record);
      }
    });

    // Process each employee
    data.employees.forEach(employee => {
      const employeeRecords = attendanceByEmployee.get(employee.employeeNumber) || [];
      const recordMap = new Map<string, AttendanceRecord>();
      employeeRecords.forEach(r => recordMap.set(r.date.toUpperCase(), r));

      // Get employee's shift (simplified - using first shift or default)
      const shift = data.shifts.length > 0 ? data.shifts[0] : null;
      const shiftStartMinutes = shift ? timeToMinutes(shift.startTime) : 540; // Default 9 AM
      const requiredHours = 8; // Minimum hours for full day

      const days: DayAttendance[] = [];
      let hasUnreconciledRecords = false;

      // Process each day of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(selectedYear, selectedMonth, day);
        const dateStr = formatDateToDDMMMYYYY(date);
        const record = recordMap.get(dateStr.toUpperCase());

        // Look up reconciliation data for this employee-date
        const recordKey = `${employee.employeeNumber}-${dateStr}`.toUpperCase();
        const reconciliationData = reconciliationMap.get(recordKey);
        const isDayReconciled = reconciliationData?.isReconciled || false;

        // Track if employee has any unreconciled records
        if (record && !isDayReconciled && !data.isReconciliationComplete) {
          hasUnreconciledRecords = true;
        }

        // NEW LOGIC: Use ONLY reconciliation finalStatus, NO calculation
        let finalStatus = '-'; // Default to blank for unreconciled
        let hoursWorked = 0;
        let isLate = false;
        let isEarly = false;
        let lateMinutes = 0;
        let earlyMinutes = 0;

        // If reconciled, use the finalStatus from reconciliation
        if (isDayReconciled && reconciliationData) {
          finalStatus = reconciliationData.finalStatus;

          // Calculate work hours for display purposes only (not for status determination)
          if (record?.inTime && record?.outTime && record.inTime !== '-' && record.outTime !== '-') {
            const inMinutes = timeToMinutes(record.inTime);
            const outMinutes = timeToMinutes(record.outTime);
            if (inMinutes >= 0 && outMinutes >= 0) {
              hoursWorked = outMinutes > inMinutes
                ? (outMinutes - inMinutes) / 60
                : ((1440 - inMinutes) + outMinutes) / 60;
            }
          }
        }
        // If not reconciled, show blank (already set to '-')

        // If a specific status filter is selected and this day doesn't match, show blank
        let displayStatus: AttendanceStatus | '-' = finalStatus as AttendanceStatus | '-';
        if (statusFilter !== 'All' && finalStatus !== '-' && !statusMatchesFilter(finalStatus as AttendanceStatus)) {
          displayStatus = '-';
        }

        days.push({
          date: dateStr,
          status: displayStatus,
          inTime: record?.inTime || '-',
          outTime: record?.outTime || '-',
          hoursWorked,
          isLate,
          isEarly,
          lateMinutes,
          earlyMinutes
        });
      }

      // Calculate summary
      const totalPresent = days.filter(d => d.status === 'P').length;
      const totalHalfDay = days.filter(d => d.status === 'HD').length;
      const totalAbsent = days.filter(d => d.status === 'A').length;
      const totalWeeklyOff = days.filter(d => d.status === 'WO').length;
      const totalWorkedOff = days.filter(d => d.status === 'WOH').length;
      const totalHoliday = days.filter(d => d.status === 'H').length;
      const workingDays = daysInMonth - totalWeeklyOff - totalHoliday;
      const effectiveDaysPresent = totalPresent + (totalHalfDay * 0.5) + totalWorkedOff;
      const attendancePercentage = workingDays > 0 ? (effectiveDaysPresent / workingDays) * 100 : 0;
      const totalShortageHours = days.reduce((sum, d) => {
        if (d.hoursWorked > 0 && d.hoursWorked < 8) {
          return sum + (8 - d.hoursWorked);
        }
        return sum;
      }, 0);

      // Calculate total work hours (InTime to OutTime)
      const totalWorkHoursActual = employeeRecords.reduce((sum, record) => {
        if (record.inTime && record.outTime && record.inTime !== '-' && record.outTime !== '-') {
          const inMinutes = timeToMinutes(record.inTime);
          const outMinutes = timeToMinutes(record.outTime);
          if (inMinutes >= 0 && outMinutes >= 0) {
            const hours = outMinutes > inMinutes
              ? (outMinutes - inMinutes) / 60
              : ((1440 - inMinutes) + outMinutes) / 60; // Handle overnight shifts
            return sum + hours;
          }
        }
        return sum;
      }, 0);

      // Calculate total work hours (Shift Start to OutTime)
      const totalWorkHoursShift = employeeRecords.reduce((sum, record) => {
        if (record.outTime && record.outTime !== '-') {
          const outMinutes = timeToMinutes(record.outTime);
          if (outMinutes >= 0 && shift) {
            const hours = outMinutes > shiftStartMinutes
              ? (outMinutes - shiftStartMinutes) / 60
              : ((1440 - shiftStartMinutes) + outMinutes) / 60; // Handle overnight
            return sum + hours;
          }
        }
        return sum;
      }, 0);

      employeeMap.set(employee.employeeNumber, {
        employeeNumber: employee.employeeNumber,
        employeeName: employee.fullName,
        department: employee.department,
        reportingManager: employee.reportingTo || 'N/A',
        days,
        hasUnreconciledRecords,
        summary: {
          totalPresent,
          totalHalfDay,
          totalAbsent,
          totalWeeklyOff,
          totalWorkedOff,
          totalHoliday,
          workingDays,
          attendancePercentage: Math.round(attendancePercentage * 100) / 100,
          lateCount: 0, // No longer calculated from status legend
          earlyCount: 0, // No longer calculated from status legend
          totalShortageHours: Math.round(totalShortageHours * 100) / 100,
          totalWorkHoursActual: Math.round(totalWorkHoursActual * 100) / 100,
          totalWorkHoursShift: Math.round(totalWorkHoursShift * 100) / 100
        }
      });
    });

    return Array.from(employeeMap.values());
  }, [data, selectedYear, selectedMonth, statusFilter]);

  const filteredData = useMemo(() => {
    return consolidatedData.filter(emp => {
      const matchSearch = emp.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDept = departmentFilter === 'All' || emp.department === departmentFilter;
      const matchManager = reportingManagerFilter === 'All' || emp.reportingManager === reportingManagerFilter;

      // Status filter: check if employee has ANY day with the selected status
      const matchStatus = statusFilter === 'All' || emp.days.some(day => day.status === statusFilter);

      return matchSearch && matchDept && matchManager && matchStatus;
    });
  }, [consolidatedData, searchTerm, departmentFilter, reportingManagerFilter, statusFilter]);

  const departments = useMemo(() => {
    return ['All', ...new Set(data.employees.map(e => e.department))].filter(Boolean);
  }, [data.employees]);

  const reportingManagers = useMemo(() => {
    return ['All', ...new Set(data.employees.map(e => e.reportingTo))].filter(Boolean);
  }, [data.employees]);

  const handleExport = () => {
    if (filteredData.length === 0) {
      alert("No data to export.");
      return;
    }

    const monthName = new Date(selectedYear, selectedMonth).toLocaleString('en-US', { month: 'long' });
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

    // Calendar View Export
    const calendarRows = filteredData.map(emp => {
      const row: any = {
        'Employee Number': emp.employeeNumber,
        'Employee Name': emp.employeeName,
        'Department': emp.department
      };
      emp.days.forEach((day, idx) => {
        row[`Day ${idx + 1}`] = day.status;
      });
      return row;
    });

    // Summary Export
    const summaryRows = filteredData.map(emp => ({
      'Employee Number': emp.employeeNumber,
      'Employee Name': emp.employeeName,
      'Department': emp.department,
      'Clean Logs (P)': emp.summary.totalPresent,
      'Half Day (HD)': emp.summary.totalHalfDay,
      'Absent (A)': emp.summary.totalAbsent,
      'Weekly Off (WO)': emp.summary.totalWeeklyOff,
      'Worked Off (WOH)': emp.summary.totalWorkedOff,
      'Holiday (H)': emp.summary.totalHoliday,
      'Working Days': emp.summary.workingDays,
      'Attendance %': emp.summary.attendancePercentage,
      'Late Count': emp.summary.lateCount,
      'Early Count': emp.summary.earlyCount,
      'Shortage Hours': emp.summary.totalShortageHours
    }));

    const wb = XLSX.utils.book_new();
    const wsCalendar = XLSX.utils.json_to_sheet(calendarRows);
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsCalendar, "Calendar View");
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
    XLSX.writeFile(wb, `Monthly_Attendance_${monthName}_${selectedYear}.xlsx`);
  };

  const getStatusColor = (status: AttendanceStatus): string => {
    switch (status) {
      case 'P': return 'bg-emerald-100 text-emerald-700';
      case 'HD': return 'bg-amber-100 text-amber-700';
      case 'A': return 'bg-rose-100 text-rose-700';
      case 'WO': return 'bg-slate-100 text-slate-500';
      case 'WOH': return 'bg-purple-100 text-purple-700';
      case 'H': return 'bg-blue-100 text-blue-500';
      default: return 'bg-slate-50 text-slate-300';
    }
  };

  const monthName = new Date(selectedYear, selectedMonth).toLocaleString('en-US', { month: 'long' });
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

  // Count attendance records for selected month
  const attendanceCountForMonth = data.attendance.filter(record => {
    const recordDate = parseFormattedDate(record.date);
    return recordDate && recordDate.getFullYear() === selectedYear && recordDate.getMonth() === selectedMonth;
  }).length;

  // Calculate reconciliation statistics
  const totalReconciled = data.reconciliationRecords?.filter((r: any) => r.isReconciled).length || 0;
  const totalRecords = data.attendance.filter(record => {
    const recordDate = parseFormattedDate(record.date);
    return recordDate && recordDate.getFullYear() === selectedYear && recordDate.getMonth() === selectedMonth;
  }).length;

  // Show info banner if reconciliation is not complete
  const reconciliationBanner = !isReconciled && (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <Info className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Reconciliation In Progress</h3>
          <p className="text-xs text-slate-600 mb-2">
            Only showing reconciled records. Complete reconciliation modules to view all attendance data.
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-amber-600 font-bold">
              {totalReconciled} of {totalRecords} Records Reconciled ({Math.round((totalReconciled / totalRecords) * 100)}%)
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-600">
              Showing {filteredData.length} employees with reconciled data
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Calendar className="text-teal-600" size={32} />
            Monthly Attendance
          </h1>
          <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mt-1">
            {monthName} {selectedYear} • {filteredData.length} Employees • {attendanceCountForMonth} Attendance Records
          </p>
        </div>

        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <button
            onClick={() => {
              if (viewMode === 'calendar') setViewMode('summary');
              else if (viewMode === 'summary') setViewMode('workhours-actual');
              else if (viewMode === 'workhours-actual') setViewMode('workhours-shift');
              else setViewMode('calendar');
            }}
            className="flex items-center space-x-2 bg-white text-slate-600 border border-slate-200 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-all font-black text-xs uppercase tracking-widest"
          >
            <Filter size={18} />
            <span>
              {viewMode === 'calendar' ? 'Summary View' :
               viewMode === 'summary' ? 'Work Hours (Actual)' :
               viewMode === 'workhours-actual' ? 'Work Hours (Shift)' :
               'Calendar View'}
            </span>
          </button>

          <button
            onClick={() => window.location.reload()}
            className="flex items-center space-x-2 bg-white text-slate-600 border border-slate-200 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-all font-black text-xs uppercase tracking-widest"
          >
            <RefreshCw size={18} />
            <span>Reload</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center space-x-2 bg-teal-600 text-white px-6 py-3 rounded-2xl hover:bg-teal-700 transition-all font-black text-xs uppercase tracking-widest shadow-lg"
          >
            <Download size={18} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Reconciliation Status Banner */}
      {reconciliationBanner}

      {/* Month/Year Selector and Filters */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Month</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectedMonth === 0) {
                    setSelectedMonth(11);
                    setSelectedYear(selectedYear - 1);
                  } else {
                    setSelectedMonth(selectedMonth - 1);
                  }
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="flex-1 p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {new Date(2000, i).toLocaleString('en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (selectedMonth === 11) {
                    setSelectedMonth(0);
                    setSelectedYear(selectedYear + 1);
                  } else {
                    setSelectedMonth(selectedMonth + 1);
                  }
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {Array.from({ length: 10 }, (_, i) => currentDate.getFullYear() - 5 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Reporting Manager</label>
            <select
              value={reportingManagerFilter}
              onChange={(e) => setReportingManagerFilter(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {reportingManagers.map(manager => (
                <option key={manager} value={manager}>{manager}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="All">All Status</option>
              <option value="Absent">Absent</option>
              <option value="Present">Present / Clean</option>
              <option value="Worked Off">Worked Off</option>
              <option value="Weekly Off">Weekly Off</option>
              <option value="Holiday">Holiday</option>
              <option value="ID Error">ID Error</option>
              <option value="Audit">Audit</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Employee name/ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* No Data Warning */}
      {attendanceCountForMonth === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6">
          <div className="flex items-start gap-3">
            <Info className="text-amber-600 flex-shrink-0" size={24} />
            <div>
              <h3 className="text-sm font-black text-amber-900 uppercase tracking-widest mb-2">
                No Attendance Data Found for {monthName} {selectedYear}
              </h3>
              <p className="text-xs text-amber-800 mb-3">
                To generate monthly attendance report, please:
              </p>
              <ul className="list-disc list-inside text-xs text-amber-800 space-y-1">
                <li>Import biometric dumps in the <strong>Biometric</strong> module</li>
                <li>Map and consolidate the attendance records</li>
                <li>Push the consolidated data to <strong>Attendance</strong> module</li>
                <li>Return to this Monthly Report to view the consolidated attendance</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-3xl p-4 border border-teal-100">
        <h3 className="text-xs font-black text-teal-900 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Info size={16} />
          Status Legend
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
          {[
            { code: 'P', label: 'Clean Logs', color: 'emerald' },
            { code: 'HD', label: 'Half Day', color: 'amber' },
            { code: 'A', label: 'Absent', color: 'rose' },
            { code: 'WO', label: 'Weekly Off', color: 'slate' },
            { code: 'WOH', label: 'Worked Off', color: 'purple' },
            { code: 'H', label: 'Holiday', color: 'blue' }
          ].map(item => (
            <div key={item.code} className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded font-black bg-${item.color}-100 text-${item.color}-700`}>
                {item.code}
              </span>
              <span className="text-slate-600 font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="overflow-auto max-h-[800px]">
            <table className="w-full text-left table-auto border-collapse min-w-max">
              <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
                <tr>
                  <th className="px-4 py-4 sticky left-0 bg-slate-900 z-50 border-r border-slate-800">Emp #</th>
                  <th className="px-4 py-4 sticky left-[100px] bg-slate-900 z-50 border-r border-slate-800">Name</th>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <th key={i} className="px-2 py-4 text-center border-r border-slate-800">{i + 1}</th>
                  ))}
                  <th className="px-3 py-4 text-center bg-emerald-700 border-l-2 border-slate-800">P</th>
                  <th className="px-3 py-4 text-center bg-rose-700">A</th>
                  <th className="px-3 py-4 text-center bg-blue-700">CL</th>
                  <th className="px-3 py-4 text-center bg-purple-700">PL</th>
                  <th className="px-3 py-4 text-center bg-pink-700">ML</th>
                  <th className="px-3 py-4 text-center bg-amber-700">HD</th>
                  <th className="px-3 py-4 text-center bg-slate-700">WO</th>
                  <th className="px-3 py-4 text-center bg-indigo-700">H</th>
                  <th className="px-3 py-4 text-center bg-orange-700">CO</th>
                  <th className="px-3 py-4 text-center bg-red-700 border-r-2 border-slate-800">LOP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((emp, idx) => (
                  <tr key={emp.employeeNumber} className={`transition-colors group ${
                    emp.hasUnreconciledRecords
                      ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-500'
                      : 'hover:bg-slate-50'
                  }`}>
                    <td className={`px-4 py-3 sticky left-0 z-10 border-r border-slate-100 text-xs font-black text-slate-900 ${
                      emp.hasUnreconciledRecords ? 'bg-amber-50 group-hover:bg-amber-100' : 'bg-white group-hover:bg-slate-50'
                    }`}>
                      {emp.employeeNumber}
                    </td>
                    <td className={`px-4 py-3 sticky left-[100px] z-10 border-r border-slate-100 text-xs font-black ${
                      emp.hasUnreconciledRecords ? 'bg-amber-50 group-hover:bg-amber-100 text-amber-900' : 'bg-white group-hover:bg-slate-50 text-teal-600'
                    }`}>
                      {emp.employeeName}
                    </td>
                    {emp.days.map((day, dayIdx) => {
                      // Get shift information from attendance record for this day
                      const dayDate = new Date(selectedYear, selectedMonth, dayIdx + 1);
                      const dateStr = formatDateToDDMMMYYYY(dayDate);
                      const attendanceRecord = data.attendance.find(
                        r => r.employeeNumber === emp.employeeNumber && r.date.toUpperCase() === dateStr.toUpperCase()
                      );
                      const shift = attendanceRecord?.shift || 'N/A';
                      const inTime = day.inTime || '-';
                      const outTime = day.outTime || '-';
                      const hoursWorked = day.hoursWorked > 0 ? `${day.hoursWorked.toFixed(2)}h` : '-';

                      return (
                        <td key={dayIdx} className="px-2 py-3 text-center border-r border-slate-100">
                          <span
                            className={`px-2 py-1 rounded text-[10px] font-black ${getStatusColor(day.status)} cursor-help`}
                            title={`Shift: ${shift}\nIn: ${inTime}\nOut: ${outTime}\nHours: ${hoursWorked}`}
                          >
                            {day.status}
                          </span>
                        </td>
                      );
                    })}
                    {/* Status Totals Columns */}
                    <td className="px-3 py-3 text-center font-black text-sm border-l-2 border-slate-200 bg-emerald-50">
                      {emp.days.filter(d => d.status === 'P').length || '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-sm bg-rose-50">
                      {emp.days.filter(d => d.status === 'A').length || '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-sm bg-blue-50">
                      {emp.days.filter(d => d.status === 'CL' || d.status?.includes('CL')).length || '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-sm bg-purple-50">
                      {emp.days.filter(d => d.status === 'PL' || d.status?.includes('PL')).length || '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-sm bg-pink-50">
                      {emp.days.filter(d => d.status === 'ML' || d.status?.includes('ML')).length || '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-sm bg-amber-50">
                      {emp.days.filter(d => d.status === 'HD').length || '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-sm bg-slate-50">
                      {emp.days.filter(d => d.status === 'WO').length || '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-sm bg-indigo-50">
                      {emp.days.filter(d => d.status === 'H').length || '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-sm bg-orange-50">
                      {emp.days.filter(d => d.status === 'CO' || d.status?.includes('CO')).length || '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-sm bg-red-50 border-r-2 border-slate-200">
                      {emp.days.filter(d => d.status === 'LOP' || d.status?.includes('LOP')).length || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'summary' ? (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="overflow-auto max-h-[800px]">
            <table className="w-full text-left table-auto border-collapse">
              <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
                <tr>
                  <th className="px-6 py-5">Employee #</th>
                  <th className="px-6 py-5">Name</th>
                  <th className="px-6 py-5">Department</th>
                  <th className="px-6 py-5 text-center">Clean Logs</th>
                  <th className="px-6 py-5 text-center">Half Day</th>
                  <th className="px-6 py-5 text-center">Absent</th>
                  <th className="px-6 py-5 text-center">WO</th>
                  <th className="px-6 py-5 text-center">Worked Off</th>
                  <th className="px-6 py-5 text-center">Holiday</th>
                  <th className="px-6 py-5 text-center">Working Days</th>
                  <th className="px-6 py-5 text-center">Attendance %</th>
                  <th className="px-6 py-5 text-center">Late Count</th>
                  <th className="px-6 py-5 text-center">Early Count</th>
                  <th className="px-6 py-5 text-center">Shortage Hrs</th>
                  <th className="px-6 py-5 text-center">Total Hrs (Actual)</th>
                  <th className="px-6 py-5 text-center border-r border-slate-800">Total Hrs (Shift)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((emp) => (
                  <tr key={emp.employeeNumber} className={`transition-colors ${
                    emp.hasUnreconciledRecords
                      ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-500'
                      : 'hover:bg-slate-50'
                  }`}>
                    <td className="px-6 py-4 text-xs font-black text-slate-900">{emp.employeeNumber}</td>
                    <td className={`px-6 py-4 text-xs font-black ${
                      emp.hasUnreconciledRecords ? 'text-amber-900' : 'text-teal-600'
                    }`}>{emp.employeeName}</td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-700">{emp.department}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-emerald-600">{emp.summary.totalPresent}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-amber-600">{emp.summary.totalHalfDay}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-rose-600">{emp.summary.totalAbsent}</td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-slate-500">{emp.summary.totalWeeklyOff}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-purple-600">{emp.summary.totalWorkedOff}</td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-blue-500">{emp.summary.totalHoliday}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-slate-700">{emp.summary.workingDays}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-teal-600">{emp.summary.attendancePercentage}%</td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-orange-600">{emp.summary.lateCount}</td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-orange-600">{emp.summary.earlyCount}</td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-rose-500">{emp.summary.totalShortageHours.toFixed(2)}</td>
                    <td className={`px-6 py-4 text-center text-sm font-black ${getWorkHoursColor(emp.summary.totalWorkHoursActual)}`}>
                      {emp.summary.totalWorkHoursActual.toFixed(2)}
                    </td>
                    <td className={`px-6 py-4 text-center text-sm font-black border-r border-slate-100 ${getWorkHoursColor(emp.summary.totalWorkHoursShift)}`}>
                      {emp.summary.totalWorkHoursShift.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr className="font-black">
                  <td className="px-6 py-4 text-xs text-slate-900" colSpan={3}>TOTAL</td>
                  <td className="px-6 py-4 text-center text-sm text-emerald-600">{filteredData.reduce((sum, emp) => sum + emp.summary.totalPresent, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-amber-600">{filteredData.reduce((sum, emp) => sum + emp.summary.totalHalfDay, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-rose-600">{filteredData.reduce((sum, emp) => sum + emp.summary.totalAbsent, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-slate-500">{filteredData.reduce((sum, emp) => sum + emp.summary.totalWeeklyOff, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-purple-600">{filteredData.reduce((sum, emp) => sum + emp.summary.totalWorkedOff, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-blue-500">{filteredData.reduce((sum, emp) => sum + emp.summary.totalHoliday, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-slate-700">{filteredData.reduce((sum, emp) => sum + emp.summary.workingDays, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-teal-600">
                    {filteredData.length > 0 ? ((filteredData.reduce((sum, emp) => sum + emp.summary.attendancePercentage, 0) / filteredData.length).toFixed(2)) : '0.00'}%
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-orange-600">{filteredData.reduce((sum, emp) => sum + emp.summary.lateCount, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-orange-600">{filteredData.reduce((sum, emp) => sum + emp.summary.earlyCount, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-rose-500">{filteredData.reduce((sum, emp) => sum + emp.summary.totalShortageHours, 0).toFixed(2)}</td>
                  <td className={`px-6 py-4 text-center text-sm ${getWorkHoursColor(filteredData.reduce((sum, emp) => sum + emp.summary.totalWorkHoursActual, 0))}`}>
                    {filteredData.reduce((sum, emp) => sum + emp.summary.totalWorkHoursActual, 0).toFixed(2)}
                  </td>
                  <td className={`px-6 py-4 text-center text-sm border-r border-slate-100 ${getWorkHoursColor(filteredData.reduce((sum, emp) => sum + emp.summary.totalWorkHoursShift, 0))}`}>
                    {filteredData.reduce((sum, emp) => sum + emp.summary.totalWorkHoursShift, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : viewMode === 'workhours-actual' ? (
        /* Work Hours View - Actual (InTime to OutTime) */
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="overflow-auto max-h-[800px]">
            <table className="w-full text-left table-auto border-collapse">
              <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
                <tr>
                  <th className="px-6 py-5">Employee #</th>
                  <th className="px-6 py-5">Name</th>
                  <th className="px-6 py-5">Department</th>
                  <th className="px-6 py-5 text-center">Total Hours (InTime-OutTime)</th>
                  <th className="px-6 py-5 text-center">Clean Logs</th>
                  <th className="px-6 py-5 text-center">Half Day</th>
                  <th className="px-6 py-5 text-center">Absent</th>
                  <th className="px-6 py-5 text-center">Working Days</th>
                  <th className="px-6 py-5 text-center border-r border-slate-800">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((emp) => (
                  <tr key={emp.employeeNumber} className={`transition-colors ${
                    emp.hasUnreconciledRecords
                      ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-500'
                      : 'hover:bg-slate-50'
                  }`}>
                    <td className="px-6 py-4 text-xs font-black text-slate-900">{emp.employeeNumber}</td>
                    <td className={`px-6 py-4 text-xs font-black ${
                      emp.hasUnreconciledRecords ? 'text-amber-900' : 'text-teal-600'
                    }`}>{emp.employeeName}</td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-700">{emp.department}</td>
                    <td className={`px-6 py-4 text-center text-2xl font-black ${getWorkHoursColor(emp.summary.totalWorkHoursActual)}`}>
                      {emp.summary.totalWorkHoursActual.toFixed(2)} hrs
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-black text-emerald-600">{emp.summary.totalPresent}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-amber-600">{emp.summary.totalHalfDay}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-rose-600">{emp.summary.totalAbsent}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-slate-700">{emp.summary.workingDays}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-teal-600 border-r border-slate-100">{emp.summary.attendancePercentage}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr className="font-black">
                  <td className="px-6 py-4 text-xs text-slate-900" colSpan={3}>TOTAL</td>
                  <td className={`px-6 py-4 text-center text-2xl ${getWorkHoursColor(filteredData.reduce((sum, emp) => sum + emp.summary.totalWorkHoursActual, 0))}`}>
                    {filteredData.reduce((sum, emp) => sum + emp.summary.totalWorkHoursActual, 0).toFixed(2)} hrs
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-emerald-600">{filteredData.reduce((sum, emp) => sum + emp.summary.totalPresent, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-amber-600">{filteredData.reduce((sum, emp) => sum + emp.summary.totalHalfDay, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-rose-600">{filteredData.reduce((sum, emp) => sum + emp.summary.totalAbsent, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-slate-700">{filteredData.reduce((sum, emp) => sum + emp.summary.workingDays, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-teal-600 border-r border-slate-100">
                    {filteredData.length > 0 ? ((filteredData.reduce((sum, emp) => sum + emp.summary.attendancePercentage, 0) / filteredData.length).toFixed(2)) : '0.00'}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* Work Hours View - Shift Based (Shift Start to OutTime) */
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="overflow-auto max-h-[800px]">
            <table className="w-full text-left table-auto border-collapse">
              <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
                <tr>
                  <th className="px-6 py-5">Employee #</th>
                  <th className="px-6 py-5">Name</th>
                  <th className="px-6 py-5">Department</th>
                  <th className="px-6 py-5 text-center">Total Hours (Shift-OutTime)</th>
                  <th className="px-6 py-5 text-center">Clean Logs</th>
                  <th className="px-6 py-5 text-center">Half Day</th>
                  <th className="px-6 py-5 text-center">Absent</th>
                  <th className="px-6 py-5 text-center">Working Days</th>
                  <th className="px-6 py-5 text-center border-r border-slate-800">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((emp) => (
                  <tr key={emp.employeeNumber} className={`transition-colors ${
                    emp.hasUnreconciledRecords
                      ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-500'
                      : 'hover:bg-slate-50'
                  }`}>
                    <td className="px-6 py-4 text-xs font-black text-slate-900">{emp.employeeNumber}</td>
                    <td className={`px-6 py-4 text-xs font-black ${
                      emp.hasUnreconciledRecords ? 'text-amber-900' : 'text-teal-600'
                    }`}>{emp.employeeName}</td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-700">{emp.department}</td>
                    <td className={`px-6 py-4 text-center text-2xl font-black ${getWorkHoursColor(emp.summary.totalWorkHoursShift)}`}>
                      {emp.summary.totalWorkHoursShift.toFixed(2)} hrs
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-black text-emerald-600">{emp.summary.totalPresent}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-amber-600">{emp.summary.totalHalfDay}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-rose-600">{emp.summary.totalAbsent}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-slate-700">{emp.summary.workingDays}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-teal-600 border-r border-slate-100">{emp.summary.attendancePercentage}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr className="font-black">
                  <td className="px-6 py-4 text-xs text-slate-900" colSpan={3}>TOTAL</td>
                  <td className={`px-6 py-4 text-center text-2xl ${getWorkHoursColor(filteredData.reduce((sum, emp) => sum + emp.summary.totalWorkHoursShift, 0))}`}>
                    {filteredData.reduce((sum, emp) => sum + emp.summary.totalWorkHoursShift, 0).toFixed(2)} hrs
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-emerald-600">{filteredData.reduce((sum, emp) => sum + emp.summary.totalPresent, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-amber-600">{filteredData.reduce((sum, emp) => sum + emp.summary.totalHalfDay, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-rose-600">{filteredData.reduce((sum, emp) => sum + emp.summary.totalAbsent, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-slate-700">{filteredData.reduce((sum, emp) => sum + emp.summary.workingDays, 0)}</td>
                  <td className="px-6 py-4 text-center text-sm text-teal-600 border-r border-slate-100">
                    {filteredData.length > 0 ? ((filteredData.reduce((sum, emp) => sum + emp.summary.attendancePercentage, 0) / filteredData.length).toFixed(2)) : '0.00'}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyConsolidation;
