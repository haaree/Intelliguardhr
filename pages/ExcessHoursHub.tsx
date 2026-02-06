import React, { useState, useMemo } from 'react';
import { Clock, Upload, Download, CheckCircle2, Filter, Search, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AppData, AttendanceRecord, UserRole } from '../types';

interface ExcessHoursHubProps {
  data: AppData;
  role: UserRole;
}

interface ExcessHoursRecord extends Omit<AttendanceRecord, 'excessHours'> {
  id: string;
  excessHours: number;
  finalPayableHours: number;
  isReconciled: boolean;
  reconciledBy?: string;
  reconciledOn?: string;
}

type ExcessCategory = 'present-under1' | 'present-1to2' | 'present-2to4' | 'present-4plus' |
                      'workedoff-under1' | 'workedoff-1to2' | 'workedoff-2to4' | 'workedoff-4plus';

const ExcessHoursHub: React.FC<ExcessHoursHubProps> = ({ data, role }) => {
  const [activeTab, setActiveTab] = useState<'present' | 'workedoff'>('present');
  const [activeSubTab, setActiveSubTab] = useState<ExcessCategory>('present-under1');
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({
    department: 'All',
    location: 'All',
    shift: 'All'
  });

  const isAdmin = role === 'SaaS_Admin' || role === 'Admin';
  const currentUser = 'Current User'; // This should come from session

  // Helper: Convert time string to minutes
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || timeStr === 'NA' || timeStr === '-' || timeStr === '') return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours * 60 + minutes;
  };

  // Helper: Convert minutes to hours
  const minutesToHours = (minutes: number): number => {
    return Math.round((minutes / 60) * 100) / 100;
  };

  // Calculate excess hours for each attendance record
  const excessHoursRecords = useMemo(() => {
    console.log('ExcessHours: Sample attendance records', data.attendance.slice(0, 5).map(att => ({
      date: att.date,
      status: att.status,
      shift: att.shift,
      inTime: att.inTime,
      outTime: att.outTime,
      shiftStart: att.shiftStart,
      shiftEnd: att.shiftEnd
    })));

    // Check what statuses exist
    const statuses = new Set(data.attendance.map(att => att.status));
    console.log('ExcessHours: All unique statuses found:', Array.from(statuses));

    return data.attendance
      .map((att, idx) => {
        // Only include Present (P) and Worked Off Holiday (WOH) statuses
        // Exclude: WO (weekly off not worked), H (holiday not worked), A (absent), etc.
        const isPresent = att.status === 'P';
        const isWorkedOff = att.status === 'WOH'; // Working on holiday/weekly off

        if (!isPresent && !isWorkedOff) return null;

        // Check if there's a punch
        const hasInTime = att.inTime && att.inTime !== 'NA' && att.inTime !== '-' && att.inTime !== '';
        const hasOutTime = att.outTime && att.outTime !== 'NA' && att.outTime !== '-' && att.outTime !== '';
        if (!hasInTime && !hasOutTime) return null;

        let excessMinutes = 0;
        let finalPayableMinutes = 0;

        if (isWorkedOff) {
          // For Worked Off: Calculate total hours worked (Out Time - Shift Start Time)
          const shiftStartMinutes = timeToMinutes(att.shiftStart);
          const outTimeMinutes = timeToMinutes(att.outTime);

          if (shiftStartMinutes > 0 && outTimeMinutes > 0) {
            excessMinutes = outTimeMinutes - shiftStartMinutes;
            finalPayableMinutes = excessMinutes; // All hours worked are payable
          }
        } else {
          // For Present Days: Calculate excess beyond shift end (Out Time - Shift End Time)
          const shiftEndMinutes = timeToMinutes(att.shiftEnd);
          const outTimeMinutes = timeToMinutes(att.outTime);

          if (shiftEndMinutes > 0 && outTimeMinutes > 0 && outTimeMinutes > shiftEndMinutes) {
            excessMinutes = outTimeMinutes - shiftEndMinutes;
            finalPayableMinutes = excessMinutes; // Excess hours are payable
          }
        }

        // Only include records with excess hours > 0
        if (excessMinutes === 0) return null;

        return {
          ...att,
          id: `${att.employeeNumber}-${att.date}-${idx}`,
          excessHours: minutesToHours(excessMinutes),
          finalPayableHours: minutesToHours(finalPayableMinutes),
          isReconciled: false,
          reconciledBy: undefined,
          reconciledOn: undefined
        } as ExcessHoursRecord;
      })
      .filter((rec): rec is ExcessHoursRecord => rec !== null);
  }, [data.attendance]);

  // Categorize records
  const categorizeRecord = (record: ExcessHoursRecord): ExcessCategory => {
    const isWorkedOff = record.status === 'WOH'; // Working on holiday/weekly off
    const hours = record.excessHours;

    if (isWorkedOff) {
      if (hours < 1) return 'workedoff-under1';
      if (hours < 2) return 'workedoff-1to2';
      if (hours < 4) return 'workedoff-2to4';
      return 'workedoff-4plus';
    } else {
      if (hours < 1) return 'present-under1';
      if (hours < 2) return 'present-1to2';
      if (hours < 4) return 'present-2to4';
      return 'present-4plus';
    }
  };

  // Split records by tab
  const { presentRecords, workedOffRecords } = useMemo(() => {
    const present: ExcessHoursRecord[] = [];
    const workedOff: ExcessHoursRecord[] = [];

    excessHoursRecords.forEach(rec => {
      const isWOH = rec.status === 'WOH'; // Working on holiday/weekly off
      if (isWOH) {
        workedOff.push(rec);
      } else {
        present.push(rec);
      }
    });

    return { presentRecords: present, workedOffRecords: workedOff };
  }, [excessHoursRecords]);

  // Get active records based on tab
  const activeRecords = activeTab === 'present' ? presentRecords : workedOffRecords;

  // Filter records by sub-tab and filters
  const filteredRecords = useMemo(() => {
    return activeRecords.filter(rec => {
      // Sub-tab filter
      const category = categorizeRecord(rec);
      if (category !== activeSubTab) return false;

      // Search filter
      const matchSearch = !searchText ||
        rec.employeeName.toLowerCase().includes(searchText.toLowerCase()) ||
        rec.employeeNumber.toLowerCase().includes(searchText.toLowerCase());

      // Other filters
      const matchDept = filters.department === 'All' || rec.department === filters.department;
      const matchLoc = filters.location === 'All' || rec.location === filters.location;
      const matchShift = filters.shift === 'All' || rec.shift === filters.shift;

      return matchSearch && matchDept && matchLoc && matchShift;
    });
  }, [activeRecords, activeSubTab, searchText, filters]);

  // Get filter options
  const filterOptions = useMemo(() => {
    return {
      departments: ['All', ...Array.from(new Set(activeRecords.map(r => r.department))).sort()],
      locations: ['All', ...Array.from(new Set(activeRecords.map(r => r.location))).sort()],
      shifts: ['All', ...Array.from(new Set(activeRecords.map(r => r.shift))).sort()]
    };
  }, [activeRecords]);

  // Handle Accept All
  const handleAcceptAll = () => {
    const pendingCount = filteredRecords.filter(r => !r.isReconciled).length;
    if (pendingCount === 0) {
      alert('All records in this category are already reconciled!');
      return;
    }

    if (!confirm(`Accept all ${pendingCount} pending excess hours records?\n\nThis will mark them as reviewed and accepted.`)) {
      return;
    }

    // In a real app, this would update the backend
    alert(`✅ Accepted ${pendingCount} excess hours records!`);
  };

  // Handle Excel Export
  const handleExport = () => {
    if (filteredRecords.length === 0) {
      alert('No records to export');
      return;
    }

    const isWorkedOff = activeTab === 'workedoff';

    const exportData = filteredRecords.map(rec => ({
      'Employee Number': rec.employeeNumber,
      'Employee Name': rec.employeeName,
      'Date': rec.date,
      'Department': rec.department,
      'Location': rec.location,
      'Shift': rec.shift,
      ...(isWorkedOff ? { 'Shift Start': rec.shiftStart } : { 'Shift End': rec.shiftEnd }),
      'Out Time': rec.outTime,
      'Excess Hours': rec.excessHours,
      'Final Payable Hours': rec.finalPayableHours,
      'Status': rec.status,
      'Reconciled': rec.isReconciled ? 'Yes' : 'No'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Excess Hours');

    const categoryLabel = activeSubTab.replace('-', '_');
    XLSX.writeFile(wb, `Excess_Hours_${categoryLabel}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Sub-tab configurations
  const presentSubTabs = [
    { id: 'present-under1', label: '< 1 Hour', color: 'green', icon: '🟢', count: presentRecords.filter(r => categorizeRecord(r) === 'present-under1').length },
    { id: 'present-1to2', label: '1-2 Hours', color: 'blue', icon: '🔵', count: presentRecords.filter(r => categorizeRecord(r) === 'present-1to2').length },
    { id: 'present-2to4', label: '2-4 Hours', color: 'amber', icon: '🟠', count: presentRecords.filter(r => categorizeRecord(r) === 'present-2to4').length },
    { id: 'present-4plus', label: '4+ Hours', color: 'rose', icon: '🔴', count: presentRecords.filter(r => categorizeRecord(r) === 'present-4plus').length }
  ];

  const workedOffSubTabs = [
    { id: 'workedoff-under1', label: '< 1 Hour', color: 'green', icon: '🟢', count: workedOffRecords.filter(r => categorizeRecord(r) === 'workedoff-under1').length },
    { id: 'workedoff-1to2', label: '1-2 Hours', color: 'blue', icon: '🔵', count: workedOffRecords.filter(r => categorizeRecord(r) === 'workedoff-1to2').length },
    { id: 'workedoff-2to4', label: '2-4 Hours', color: 'amber', icon: '🟠', count: workedOffRecords.filter(r => categorizeRecord(r) === 'workedoff-2to4').length },
    { id: 'workedoff-4plus', label: '4+ Hours', color: 'rose', icon: '🔴', count: workedOffRecords.filter(r => categorizeRecord(r) === 'workedoff-4plus').length }
  ];

  const activeSubTabs = activeTab === 'present' ? presentSubTabs : workedOffSubTabs;

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 p-8 overflow-auto">
      <div className="max-w-[98%] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Clock size={24} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">Excess Hours Reconciliation</h1>
                <p className="text-sm text-slate-500 font-medium">Review and reconcile excess working hours by category</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Tabs: Present Days vs Weekly Offs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-4 mb-6">
          <div className="flex gap-3">
            <button
              onClick={() => {
                setActiveTab('present');
                setActiveSubTab('present-under1');
              }}
              className={`flex-1 px-6 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                activeTab === 'present'
                  ? 'bg-slate-900 text-white shadow-xl'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Present Days Excess ({presentRecords.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('workedoff');
                setActiveSubTab('workedoff-under1');
              }}
              className={`flex-1 px-6 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                activeTab === 'workedoff'
                  ? 'bg-slate-900 text-white shadow-xl'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Worked Off Excess ({workedOffRecords.length})
            </button>
          </div>
        </div>

        {/* Sub-tabs for hours categories */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {activeSubTabs.map((subTab: any) => {
              const isActive = activeSubTab === subTab.id;
              return (
                <button
                  key={subTab.id}
                  onClick={() => setActiveSubTab(subTab.id as ExcessCategory)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    isActive
                      ? `bg-${subTab.color}-100 border-2 border-${subTab.color}-500 text-${subTab.color}-700 shadow-md`
                      : 'bg-slate-50 border-2 border-transparent text-slate-600 hover:bg-slate-100'
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
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              />
            </div>

            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="px-3 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
            >
              {filterOptions.departments.map(dept => (
                <option key={dept} value={dept}>{dept === 'All' ? 'All Departments' : dept}</option>
              ))}
            </select>

            <select
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              className="px-3 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
            >
              {filterOptions.locations.map(loc => (
                <option key={loc} value={loc}>{loc === 'All' ? 'All Locations' : loc}</option>
              ))}
            </select>

            <select
              value={filters.shift}
              onChange={(e) => setFilters({ ...filters, shift: e.target.value })}
              className="px-3 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
            >
              {filterOptions.shifts.map(shift => (
                <option key={shift} value={shift}>{shift === 'All' ? 'All Shifts' : shift}</option>
              ))}
            </select>

            <button
              onClick={() => setFilters({ department: 'All', location: 'All', shift: 'All' })}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-bold text-sm flex items-center justify-center gap-2"
            >
              <X size={14} />
              Clear Filters
            </button>
          </div>

          {isAdmin && (
            <div className="flex gap-3">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-black text-sm uppercase tracking-widest"
              >
                <Download size={16} />
                Export Excel
              </button>

              <button
                onClick={handleAcceptAll}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-black text-sm uppercase tracking-widest"
              >
                <CheckCircle2 size={16} />
                Accept All
              </button>
            </div>
          )}
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <p className="text-sm font-bold text-slate-700">
              Showing {filteredRecords.length} records
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Shift</th>
                  <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">
                    {activeTab === 'workedoff' ? 'Shift Start' : 'Shift End'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Out Time</th>
                  <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Excess Hours</th>
                  <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Payable Hours</th>
                  <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec, idx) => (
                  <tr key={rec.id} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-slate-900">{rec.employeeName}</div>
                      <div className="text-xs text-slate-500">{rec.employeeNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{rec.date}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{rec.department}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{rec.location}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">{rec.shift}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-700">
                      {activeTab === 'workedoff' ? rec.shiftStart : rec.shiftEnd}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-700">{rec.outTime}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-sm font-bold">
                        {rec.excessHours} hrs
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">
                        {rec.finalPayableHours} hrs
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        rec.status === 'WOH'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRecords.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Clock size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-bold">No excess hours records found for this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcessHoursHub;
