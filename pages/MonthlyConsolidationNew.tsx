
import React, { useState, useMemo } from 'react';
import { Calendar, Download, Filter, ChevronLeft, ChevronRight, Search, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { AppData, UserRole } from '../types.ts';
import * as XLSX from 'xlsx';

interface MonthlyConsolidationNewProps {
  data: AppData;
  role: UserRole;
}

interface DayStatus {
  date: string;
  status: string;
}

interface EmployeeReport {
  employeeNumber: string;
  employeeName: string;
  department: string;
  legalEntity: string;
  costCenter: string;
  location: string;
  reportingManager: string;
  shift: string;
  days: DayStatus[];
  statusCounts: Record<string, number>;
  total: number;
}

const MonthlyConsolidationNew: React.FC<MonthlyConsolidationNewProps> = ({ data, role }) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [legalEntityFilter, setLegalEntityFilter] = useState('All');
  const [costCenterFilter, setCostCenterFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [reportingManagerFilter, setReportingManagerFilter] = useState('All');
  const [shiftFilter, setShiftFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showReconciledOnly, setShowReconciledOnly] = useState(true);

  // Get month name
  const monthName = new Date(selectedYear, selectedMonth).toLocaleString('en-US', { month: 'long' });

  // Get days in selected month
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

  // Format date to DD-MMM-YYYY
  const formatDateToDDMMMYYYY = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Build report data
  const reportData = useMemo(() => {
    // Safety check
    if (!data || !data.employees || !Array.isArray(data.employees)) {
      return [];
    }

    // Create reconciliation map for quick lookup
    const reconciliationMap = new Map<string, { finalStatus: string; isReconciled: boolean }>();

    if (data.reconciliationRecords && Array.isArray(data.reconciliationRecords)) {
      data.reconciliationRecords.forEach((rec: any) => {
        // Include all records (both reconciled and unreconciled) based on filter
        if (!showReconciledOnly || rec.isReconciled === true) {
          const key = `${rec.employeeNumber}-${rec.date}`.toUpperCase();
          reconciliationMap.set(key, {
            finalStatus: rec.finalStatus || '-',
            isReconciled: rec.isReconciled === true
          });
        }
      });
    }

    // Get unique employees
    const employeeMap = new Map<string, EmployeeReport>();

    // Initialize employees from employee master
    data.employees.forEach(emp => {
      // Get employee's attendance records for metadata
      const empAttendance = data.attendance.filter(att => att.employeeNumber === emp.employeeNumber);
      const sampleRecord = empAttendance[0];

      const days: DayStatus[] = [];
      const statusCounts: Record<string, number> = {};

      // Build days array for the month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(selectedYear, selectedMonth, day);
        const dateStr = formatDateToDDMMMYYYY(date);
        const recordKey = `${emp.employeeNumber}-${dateStr}`.toUpperCase();

        const reconData = reconciliationMap.get(recordKey);
        const status = reconData?.finalStatus || '-';

        days.push({
          date: dateStr,
          status: status
        });

        // Count statuses (exclude blanks)
        if (status !== '-') {
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        }
      }

      // Calculate total (sum of all status counts)
      const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

      employeeMap.set(emp.employeeNumber, {
        employeeNumber: emp.employeeNumber,
        employeeName: emp.fullName,  // Employee interface uses 'fullName' not 'employeeName'
        department: emp.department,
        legalEntity: sampleRecord?.legalEntity || 'N/A',
        costCenter: sampleRecord?.costCenter || 'N/A',
        location: sampleRecord?.location || 'N/A',
        reportingManager: emp.reportingTo || 'N/A',
        shift: sampleRecord?.shift || 'N/A',
        days,
        statusCounts,
        total
      });
    });

    return Array.from(employeeMap.values());
  }, [data, selectedYear, selectedMonth, daysInMonth, showReconciledOnly]);

  // Get all unique statuses dynamically from reconciliation data
  const allStatuses = useMemo(() => {
    const statusSet = new Set<string>();

    reportData.forEach(emp => {
      emp.days.forEach(day => {
        if (day.status !== '-') {
          statusSet.add(day.status);
        }
      });
    });

    return Array.from(statusSet).sort();
  }, [reportData]);

  // Filter options
  const departments = useMemo(() => {
    if (!data?.employees) return ['All'];
    return ['All', ...new Set(data.employees.map(e => e.department))].filter(Boolean);
  }, [data?.employees]);

  const legalEntities = useMemo(() => {
    if (!data?.attendance) return ['All'];
    return ['All', ...new Set(data.attendance.map(r => r.legalEntity))].filter(Boolean);
  }, [data?.attendance]);

  const costCenters = useMemo(() => {
    if (!data?.attendance) return ['All'];
    return ['All', ...new Set(data.attendance.map(r => r.costCenter))].filter(Boolean);
  }, [data?.attendance]);

  const locations = useMemo(() => {
    if (!data?.attendance) return ['All'];
    return ['All', ...new Set(data.attendance.map(r => r.location))].filter(Boolean);
  }, [data?.attendance]);

  const reportingManagers = useMemo(() => {
    if (!data?.employees) return ['All'];
    return ['All', ...new Set(data.employees.map(e => e.reportingTo))].filter(Boolean);
  }, [data?.employees]);

  const shifts = useMemo(() => {
    if (!data?.attendance) return ['All'];
    return ['All', ...new Set(data.attendance.map(r => r.shift))].filter(Boolean);
  }, [data?.attendance]);

  // Filtered data
  const filteredData = useMemo(() => {
    return reportData.filter(emp => {
      const matchSearch = (emp.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (emp.employeeNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchDept = departmentFilter === 'All' || emp.department === departmentFilter;
      const matchLegalEntity = legalEntityFilter === 'All' || emp.legalEntity === legalEntityFilter;
      const matchCostCenter = costCenterFilter === 'All' || emp.costCenter === costCenterFilter;
      const matchLocation = locationFilter === 'All' || emp.location === locationFilter;
      const matchManager = reportingManagerFilter === 'All' || emp.reportingManager === reportingManagerFilter;
      const matchShift = shiftFilter === 'All' || emp.shift === shiftFilter;
      const matchStatus = statusFilter === 'All' || emp.days.some(day => day.status === statusFilter);

      return matchSearch && matchDept && matchLegalEntity && matchCostCenter &&
             matchLocation && matchManager && matchShift && matchStatus;
    });
  }, [reportData, searchTerm, departmentFilter, legalEntityFilter, costCenterFilter,
      locationFilter, reportingManagerFilter, shiftFilter, statusFilter]);

  // Export to Excel
  const handleExport = () => {
    if (filteredData.length === 0) {
      alert("No data to export.");
      return;
    }

    const exportData = filteredData.map(emp => {
      const row: any = {
        'Employee Number': emp.employeeNumber,
        'Employee Name': emp.employeeName,
        'Department': emp.department,
        'Legal Entity': emp.legalEntity,
        'Cost Center': emp.costCenter,
        'Location': emp.location,
        'Reporting Manager': emp.reportingManager,
        'Shift': emp.shift
      };

      // Add day columns
      emp.days.forEach((day, idx) => {
        row[`Day ${idx + 1}`] = day.status;
      });

      // Add status count columns
      allStatuses.forEach(status => {
        row[status] = emp.statusCounts[status] || 0;
      });

      row['Total'] = emp.total;

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `Monthly_Consolidation_${monthName}_${selectedYear}.xlsx`);
  };

  // Show message if no data
  if (!data || !data.employees || data.employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Calendar className="text-slate-300" size={64} />
        <h2 className="text-2xl font-bold text-slate-600">No Employee Data Available</h2>
        <p className="text-slate-500">Please upload employee data to view the monthly consolidation report.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Calendar className="text-teal-600" size={32} />
            Monthly Consolidation Report
          </h1>
          <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mt-1">
            {monthName} {selectedYear} • {filteredData.length} Employees
          </p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center space-x-2 bg-teal-600 text-white px-6 py-3 rounded-2xl hover:bg-teal-700 transition-all font-black text-xs uppercase tracking-widest shadow-lg"
        >
          <Download size={18} />
          <span>Export</span>
        </button>
      </div>

      {/* Filters & Selection */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-lg">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Filter size={16} className="text-teal-600" />
          Filters & Selection
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Month/Year Selector */}
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
                className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <ChevronLeft size={18} />
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
                className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <ChevronRight size={18} />
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
              {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
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

          {/* Legal Entity Filter */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Legal Entity</label>
            <select
              value={legalEntityFilter}
              onChange={(e) => setLegalEntityFilter(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {legalEntities.map(le => (
                <option key={le} value={le}>{le}</option>
              ))}
            </select>
          </div>

          {/* Cost Center Filter */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Cost Center</label>
            <select
              value={costCenterFilter}
              onChange={(e) => setCostCenterFilter(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {costCenters.map(cc => (
                <option key={cc} value={cc}>{cc}</option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Location</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Reporting Manager Filter */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Reporting Manager</label>
            <select
              value={reportingManagerFilter}
              onChange={(e) => setReportingManagerFilter(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {reportingManagers.map(rm => (
                <option key={rm} value={rm}>{rm}</option>
              ))}
            </select>
          </div>

          {/* Shift Filter */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Shift</label>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {shifts.map(shift => (
                <option key={shift} value={shift}>{shift}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="All">All Status</option>
              {allStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Employee Search */}
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

        {/* Reconciliation Toggle */}
        <div className="mt-4 flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReconciledOnly(!showReconciledOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                showReconciledOnly
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {showReconciledOnly ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              {showReconciledOnly ? 'Reconciled Only' : 'All Records'}
            </button>
            <span className="text-xs text-slate-600">
              {showReconciledOnly ? 'Showing only reconciled records' : 'Showing all records (including unreconciled)'}
            </span>
          </div>
          <div className="text-xs font-bold text-slate-700">
            Total Records: {filteredData.reduce((sum, emp) => sum + emp.total, 0)}
          </div>
        </div>
      </div>

      {/* Unreconciled Records Alert */}
      {!showReconciledOnly && data.reconciliationRecords && (() => {
        const unreconciledCount = data.reconciliationRecords.filter((rec: any) => rec.isReconciled !== true).length;
        return unreconciledCount > 0 ? (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-black text-amber-900 text-sm mb-1">
                {unreconciledCount} Unreconciled Record{unreconciledCount !== 1 ? 's' : ''} Found
              </h4>
              <p className="text-xs text-amber-800">
                These records exist in the system but have not been marked as reconciled.
                They are included in the counts above but may need attention.
              </p>
              <button
                onClick={() => {
                  const unreconciled = data.reconciliationRecords!.filter((rec: any) => rec.isReconciled !== true);
                  const details = unreconciled.map((rec: any) =>
                    `${rec.employeeNumber} - ${rec.employeeName || 'Unknown'} - ${rec.date} - Status: ${rec.finalStatus || rec.originalStatus || 'N/A'}`
                  ).join('\n');
                  alert(`Unreconciled Records (${unreconciledCount}):\n\n${details}`);
                }}
                className="mt-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all font-bold text-xs uppercase tracking-wider"
              >
                View Details
              </button>
            </div>
          </div>
        ) : null;
      })()}

      {/* Calendar Report Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden">
        <div className="overflow-auto max-h-[700px]">
          <table className="w-full text-left table-auto border-collapse min-w-max">
            <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
              <tr>
                <th className="px-4 py-4 sticky left-0 bg-slate-900 z-50 border-r border-slate-800">Emp #</th>
                <th className="px-4 py-4 sticky left-[100px] bg-slate-900 z-50 border-r border-slate-800">Name</th>

                {/* Day columns with day of week */}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const date = new Date(selectedYear, selectedMonth, i + 1);
                  const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
                  return (
                    <th key={i} className="px-2 py-4 text-center border-r border-slate-800">
                      <div className="text-[7px] text-slate-400 mb-0.5">{dayAbbr}</div>
                      <div>{i + 1}</div>
                    </th>
                  );
                })}

                {/* Status count columns */}
                {allStatuses.map(status => (
                  <th key={status} className="px-3 py-4 text-center bg-slate-800 border-l border-slate-700">
                    {status}
                  </th>
                ))}

                {/* Total column */}
                <th className="px-3 py-4 text-center bg-teal-700 border-l-2 border-slate-800">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map(emp => (
                <tr key={emp.employeeNumber} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 sticky left-0 z-10 bg-white border-r border-slate-100 text-xs font-black text-slate-900">
                    {emp.employeeNumber}
                  </td>
                  <td className="px-4 py-3 sticky left-[100px] z-10 bg-white border-r border-slate-100 text-xs font-black text-teal-600">
                    {emp.employeeName}
                  </td>

                  {/* Day status cells */}
                  {emp.days.map((day, dayIdx) => (
                    <td key={dayIdx} className="px-2 py-3 text-center border-r border-slate-100">
                      <span className="text-xs font-bold text-slate-700">
                        {day.status === '-' ? '' : day.status}
                      </span>
                    </td>
                  ))}

                  {/* Status count cells */}
                  {allStatuses.map(status => (
                    <td key={status} className="px-3 py-3 text-center font-black text-sm border-l border-slate-200 bg-slate-50">
                      {emp.statusCounts[status] || '-'}
                    </td>
                  ))}

                  {/* Total cell */}
                  <td className="px-3 py-3 text-center font-black text-lg bg-teal-50 border-l-2 border-slate-200">
                    {emp.total || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthlyConsolidationNew;
