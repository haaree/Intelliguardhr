import React, { useState, useMemo } from 'react';
import { Clock, Download, Filter, X, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AppData, UserRole } from '../types';

interface ExcessHoursReportProps {
  data: AppData;
  role: UserRole;
}

interface EmployeeExcessData {
  employeeNumber: string;
  employeeName: string;
  department: string;
  location: string;
  costCenter: string;
  reportingManager: string;
  legalEntity: string;
  otEligible: boolean;
  days: {
    date: string;
    excessHours: number;
    shiftEnd: string;
    outTime: string;
    status: string;
  }[];
  totalExcessHours: number;
}

const ExcessHoursReport: React.FC<ExcessHoursReportProps> = ({ data, role }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [filters, setFilters] = useState({
    department: 'All',
    location: 'All',
    reportingManager: 'All',
    legalEntity: 'All',
    searchText: ''
  });

  const [showFilters, setShowFilters] = useState(false);

  // Helper function to convert time string (HH:MM) to minutes
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || timeStr === 'NA' || timeStr === '-') return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper function to convert minutes to hours with 2 decimal places
  const minutesToHours = (minutes: number): number => {
    return Math.round((minutes / 60) * 100) / 100;
  };

  // Generate calendar data
  const reportData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dates = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    });

    // Get unique employees from attendance
    const employeeMap = new Map<string, EmployeeExcessData>();

    data.attendance.forEach(att => {
      const attDate = att.date;
      if (!attDate.startsWith(selectedMonth)) return;

      const employee = data.employees.find(e => e.employeeNumber === att.employeeNumber);
      if (!employee) return;

      // Check if employee has biometric punch (inTime or outTime exists)
      const hasPunch = att.inTime && att.inTime !== 'NA' && att.inTime !== '-';
      if (!hasPunch) return; // Skip days without punch

      if (!employeeMap.has(att.employeeNumber)) {
        employeeMap.set(att.employeeNumber, {
          employeeNumber: att.employeeNumber,
          employeeName: att.employeeName,
          department: att.department,
          location: att.location,
          costCenter: att.costCenter,
          reportingManager: att.reportingManager,
          legalEntity: att.legalEntity,
          otEligible: employee.otEligible || false,
          days: dates.map(date => ({
            date,
            excessHours: 0,
            shiftEnd: '-',
            outTime: '-',
            status: '-'
          })),
          totalExcessHours: 0
        });
      }

      const empData = employeeMap.get(att.employeeNumber)!;
      const dayIndex = dates.indexOf(attDate);

      if (dayIndex !== -1) {
        // Calculate excess hours: outTime - shiftEnd
        const shiftEndMinutes = timeToMinutes(att.shiftEnd);
        const outTimeMinutes = timeToMinutes(att.outTime);

        let excessMinutes = 0;
        if (shiftEndMinutes > 0 && outTimeMinutes > 0 && outTimeMinutes > shiftEndMinutes) {
          excessMinutes = outTimeMinutes - shiftEndMinutes;
        }

        empData.days[dayIndex] = {
          date: attDate,
          excessHours: minutesToHours(excessMinutes),
          shiftEnd: att.shiftEnd,
          outTime: att.outTime,
          status: att.status
        };

        empData.totalExcessHours += minutesToHours(excessMinutes);
        empData.totalExcessHours = Math.round(empData.totalExcessHours * 100) / 100;
      }
    });

    return Array.from(employeeMap.values());
  }, [data, selectedMonth]);

  // Apply filters
  const filteredData = useMemo(() => {
    return reportData.filter(emp => {
      const matchDept = filters.department === 'All' || emp.department === filters.department;
      const matchLoc = filters.location === 'All' || emp.location === filters.location;
      const matchManager = filters.reportingManager === 'All' || emp.reportingManager === filters.reportingManager;
      const matchEntity = filters.legalEntity === 'All' || emp.legalEntity === filters.legalEntity;
      const matchSearch = !filters.searchText ||
        emp.employeeName.toLowerCase().includes(filters.searchText.toLowerCase()) ||
        emp.employeeNumber.toLowerCase().includes(filters.searchText.toLowerCase());

      return matchDept && matchLoc && matchManager && matchEntity && matchSearch;
    });
  }, [reportData, filters]);

  // Calculate day-wise totals
  const dayTotals = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, i) => {
      const dayTotal = filteredData.reduce((sum, emp) => sum + emp.days[i].excessHours, 0);
      return Math.round(dayTotal * 100) / 100;
    });
  }, [filteredData, selectedMonth]);

  // Get unique filter values
  const filterOptions = useMemo(() => {
    return {
      departments: ['All', ...Array.from(new Set(reportData.map(e => e.department))).sort()],
      locations: ['All', ...Array.from(new Set(reportData.map(e => e.location))).sort()],
      managers: ['All', ...Array.from(new Set(reportData.map(e => e.reportingManager))).sort()],
      entities: ['All', ...Array.from(new Set(reportData.map(e => e.legalEntity))).sort()]
    };
  }, [reportData]);

  // Export to Excel
  const handleExport = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const exportData = filteredData.map(emp => {
      const row: any = {
        'Employee Number': emp.employeeNumber,
        'Employee Name': emp.employeeName,
        'Department': emp.department,
        'Location': emp.location,
        'Cost Center': emp.costCenter,
        'Reporting Manager': emp.reportingManager,
        'Legal Entity': emp.legalEntity,
        'OT Eligible': emp.otEligible ? 'Yes' : 'No'
      };

      // Add day columns
      emp.days.forEach((day, idx) => {
        row[`${idx + 1}`] = day.excessHours > 0 ? day.excessHours : '';
      });

      row['Total'] = emp.totalExcessHours;

      return row;
    });

    // Add totals row
    const totalsRow: any = {
      'Employee Number': '',
      'Employee Name': '',
      'Department': '',
      'Location': '',
      'Cost Center': '',
      'Reporting Manager': '',
      'Legal Entity': '',
      'OT Eligible': 'TOTAL'
    };

    dayTotals.forEach((total, idx) => {
      totalsRow[`${idx + 1}`] = total > 0 ? total : '';
    });

    totalsRow['Total'] = Math.round(dayTotals.reduce((sum, t) => sum + t, 0) * 100) / 100;

    exportData.push(totalsRow);

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Excess Hours');

    XLSX.writeFile(wb, `Excess_Hours_Report_${selectedMonth}.xlsx`);
  };

  // Get color based on excess hours
  const getHoursColor = (hours: number) => {
    if (hours === 0) return 'bg-slate-50 text-slate-400';
    if (hours < 2) return 'bg-green-50 text-green-700 font-semibold';
    if (hours < 4) return 'bg-amber-50 text-amber-700 font-semibold';
    return 'bg-rose-50 text-rose-700 font-bold';
  };

  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 p-8 overflow-auto">
      <div className="max-w-[98%] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Clock size={24} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">Excess Hours Report</h1>
                <p className="text-sm text-slate-500 font-medium">Day-wise excess hours based on shift end time</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-xl hover:border-slate-300 transition-all font-bold text-sm text-slate-700"
              >
                <Filter size={16} />
                Filters {showFilters && <X size={14} />}
              </button>

              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all font-black text-sm uppercase tracking-widest shadow-lg"
              >
                <Download size={16} />
                Export Excel
              </button>
            </div>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              Select Month:
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none font-semibold"
              />
            </label>

            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl">
              <Info size={14} className="text-blue-600" />
              <span className="text-xs font-semibold text-blue-800">
                Showing {filteredData.length} employees for {monthName}
              </span>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-6">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Department</label>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
                >
                  {filterOptions.departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Location</label>
                <select
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
                >
                  {filterOptions.locations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Reporting Manager</label>
                <select
                  value={filters.reportingManager}
                  onChange={(e) => setFilters({ ...filters, reportingManager: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
                >
                  {filterOptions.managers.map(mgr => (
                    <option key={mgr} value={mgr}>{mgr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Legal Entity</label>
                <select
                  value={filters.legalEntity}
                  onChange={(e) => setFilters({ ...filters, legalEntity: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
                >
                  {filterOptions.entities.map(entity => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Name or ID"
                  value={filters.searchText}
                  onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
                />
              </div>
            </div>

            <button
              onClick={() => setFilters({ department: 'All', location: 'All', reportingManager: 'All', legalEntity: 'All', searchText: '' })}
              className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-bold text-sm"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
          <div className="flex items-center gap-6 text-xs font-bold">
            <span className="text-slate-600">Legend:</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-50 border border-green-200 rounded"></div>
              <span className="text-slate-700">0-2 hrs</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-50 border border-amber-200 rounded"></div>
              <span className="text-slate-700">2-4 hrs</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-rose-50 border border-rose-200 rounded"></div>
              <span className="text-slate-700">4+ hrs</span>
            </div>
            <div className="ml-4 flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-black">OT</span>
              <span className="text-slate-700">= OT Eligible</span>
            </div>
          </div>
        </div>

        {/* Calendar Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900">
                  <th className="sticky left-0 z-20 bg-slate-900 px-4 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest border-r border-slate-700">
                    Employee
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest border-r border-slate-700">Dept</th>
                  <th className="px-3 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest border-r border-slate-700">Location</th>
                  <th className="px-3 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest border-r border-slate-700">Manager</th>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <th key={i} className="px-2 py-3 text-center text-[10px] font-black text-white uppercase border-r border-slate-700">
                      {i + 1}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-[10px] font-black text-white uppercase tracking-widest bg-indigo-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((emp, empIdx) => (
                  <tr key={emp.employeeNumber} className={empIdx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-3 border-r border-slate-200">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-xs font-bold text-slate-900">{emp.employeeName}</div>
                          <div className="text-[10px] text-slate-500">{emp.employeeNumber}</div>
                        </div>
                        {emp.otEligible && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-black">OT</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600 border-r border-slate-200">{emp.department}</td>
                    <td className="px-3 py-3 text-xs text-slate-600 border-r border-slate-200">{emp.location}</td>
                    <td className="px-3 py-3 text-xs text-slate-600 border-r border-slate-200">{emp.reportingManager}</td>
                    {emp.days.map((day, dayIdx) => (
                      <td
                        key={dayIdx}
                        className={`px-2 py-3 text-center text-xs border-r border-slate-200 ${getHoursColor(day.excessHours)} group relative`}
                        title={day.excessHours > 0 ? `Shift End: ${day.shiftEnd}\nOut Time: ${day.outTime}\nExcess: ${day.excessHours} hrs` : ''}
                      >
                        {day.excessHours > 0 ? day.excessHours : ''}
                        {day.excessHours > 0 && (
                          <div className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl whitespace-nowrap z-30">
                            <div className="font-bold">Shift End: {day.shiftEnd}</div>
                            <div className="font-bold">Out Time: {day.outTime}</div>
                            <div className="font-bold text-amber-300">Excess: {day.excessHours} hrs</div>
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center text-sm font-black text-indigo-700 bg-indigo-50">
                      {emp.totalExcessHours}
                    </td>
                  </tr>
                ))}

                {/* Totals Row */}
                <tr className="bg-slate-900 text-white font-black">
                  <td className="sticky left-0 z-10 bg-slate-900 px-4 py-3 text-xs uppercase tracking-widest border-r border-slate-700" colSpan={4}>
                    TOTAL (Day-wise)
                  </td>
                  {dayTotals.map((total, idx) => (
                    <td key={idx} className="px-2 py-3 text-center text-xs border-r border-slate-700">
                      {total > 0 ? total : ''}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center text-sm bg-indigo-700">
                    {Math.round(dayTotals.reduce((sum, t) => sum + t, 0) * 100) / 100}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {filteredData.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Clock size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-bold">No excess hours data found for selected filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcessHoursReport;
