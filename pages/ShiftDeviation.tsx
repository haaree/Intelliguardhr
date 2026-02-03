import React, { useState, useMemo } from 'react';
import { Calendar, Upload, FileDown, AlertCircle, TrendingUp, DollarSign, Users, CheckCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AppData } from '../types';

interface PlannedShift {
  employeeNumber: string;
  employeeName?: string;
  date: string;
  shift: string;
  department: string;
  location: string;
}

interface ShiftDeviation {
  employeeNumber: string;
  employeeName: string;
  date: string;
  plannedShift: string;
  actualShift: string;
  deviationType: 'wrong_shift' | 'unscheduled';
  department: string;
  location: string;
  inTime?: string;
  outTime?: string;
}

interface ShiftDeviationProps {
  data: AppData;
  role: string;
}

const ShiftDeviation: React.FC<ShiftDeviationProps> = ({ data, role }) => {
  const [plannedShifts, setPlannedShifts] = useState<PlannedShift[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState<string>('All');
  const [filterLocation, setFilterLocation] = useState<string>('All');

  const isAdmin = role === 'Admin' || role === 'SaaS_Admin' || role === 'Manager';

  // Calculate shift deviations
  const deviations = useMemo(() => {
    if (plannedShifts.length === 0) return [];

    const deviationList: ShiftDeviation[] = [];
    const plannedMap = new Map<string, PlannedShift>();

    // Create lookup map for planned shifts
    plannedShifts.forEach(ps => {
      const key = `${ps.employeeNumber}-${ps.date}`;
      plannedMap.set(key, ps);
    });

    // Check actual attendance against planned shifts
    data.attendance.forEach(att => {
      const key = `${att.employeeNumber}-${att.date}`;
      const planned = plannedMap.get(key);

      // Get employee name
      const employee = data.employees.find(e => e.employeeNumber === att.employeeNumber);
      const employeeName = employee?.employeeName || att.employeeName || 'Unknown';

      if (planned) {
        // Check if shifts match (normalize shift names)
        const plannedShiftNorm = planned.shift.trim().toUpperCase();
        const actualShiftNorm = (att.shift || '').trim().toUpperCase();

        if (plannedShiftNorm !== actualShiftNorm && att.shift) {
          // Wrong shift attended
          deviationList.push({
            employeeNumber: att.employeeNumber,
            employeeName,
            date: att.date,
            plannedShift: planned.shift,
            actualShift: att.shift,
            deviationType: 'wrong_shift',
            department: planned.department || att.department || 'N/A',
            location: planned.location || att.location || 'N/A',
            inTime: att.inTime,
            outTime: att.outTime
          });
        }
      } else {
        // Check if this is an unscheduled attendance (only if employee has other planned shifts this month)
        const hasPlannedShifts = plannedShifts.some(ps => ps.employeeNumber === att.employeeNumber);
        if (hasPlannedShifts && att.shift && att.status !== 'Absent') {
          deviationList.push({
            employeeNumber: att.employeeNumber,
            employeeName,
            date: att.date,
            plannedShift: 'Not Scheduled',
            actualShift: att.shift,
            deviationType: 'unscheduled',
            department: att.department || 'N/A',
            location: att.location || 'N/A',
            inTime: att.inTime,
            outTime: att.outTime
          });
        }
      }
    });

    return deviationList;
  }, [plannedShifts, data.attendance, data.employees]);

  // Filter deviations
  const filteredDeviations = useMemo(() => {
    return deviations.filter(d => {
      const matchDept = filterDepartment === 'All' || d.department === filterDepartment;
      const matchLoc = filterLocation === 'All' || d.location === filterLocation;
      return matchDept && matchLoc;
    });
  }, [deviations, filterDepartment, filterLocation]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalDeviations = filteredDeviations.length;
    const wrongShift = filteredDeviations.filter(d => d.deviationType === 'wrong_shift').length;
    const unscheduled = filteredDeviations.filter(d => d.deviationType === 'unscheduled').length;

    // Count unique employees with deviations
    const uniqueEmployees = new Set(filteredDeviations.map(d => d.employeeNumber)).size;

    // Calculate by department
    const byDepartment = new Map<string, number>();
    filteredDeviations.forEach(d => {
      byDepartment.set(d.department, (byDepartment.get(d.department) || 0) + 1);
    });

    // Calculate by shift type
    const byShift = new Map<string, number>();
    filteredDeviations.forEach(d => {
      byShift.set(d.actualShift, (byShift.get(d.actualShift) || 0) + 1);
    });

    // Estimated financial impact (assuming $50 per deviation as a placeholder)
    const estimatedImpact = totalDeviations * 50;

    return {
      totalDeviations,
      wrongShift,
      unscheduled,
      uniqueEmployees,
      byDepartment: Array.from(byDepartment.entries()).sort((a, b) => b[1] - a[1]),
      byShift: Array.from(byShift.entries()).sort((a, b) => b[1] - a[1]),
      estimatedImpact
    };
  }, [filteredDeviations]);

  // Handle Excel upload for planned shifts
  const handlePlannedShiftUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadStatus('Processing...');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const shifts: PlannedShift[] = [];
        let errors = 0;

        jsonData.forEach((row: any, index) => {
          const employeeNumber = String(row['Employee ID'] || row['Employee Number'] || row['EMP #'] || '').trim();
          const date = row['Date'];
          const shift = String(row['Shift'] || '').trim();
          const department = String(row['Department'] || '').trim();
          const location = String(row['Location'] || '').trim();

          if (!employeeNumber || !date || !shift) {
            errors++;
            return;
          }

          // Parse and format date
          let formattedDate = '';
          if (date instanceof Date) {
            formattedDate = date.toISOString().split('T')[0];
          } else if (typeof date === 'string') {
            formattedDate = new Date(date).toISOString().split('T')[0];
          } else if (typeof date === 'number') {
            // Excel serial date
            const excelEpoch = new Date(1899, 11, 30);
            const jsDate = new Date(excelEpoch.getTime() + date * 86400000);
            formattedDate = jsDate.toISOString().split('T')[0];
          }

          shifts.push({
            employeeNumber,
            date: formattedDate,
            shift,
            department,
            location
          });
        });

        setPlannedShifts(shifts);
        setUploadStatus(`✅ Loaded ${shifts.length} planned shifts successfully!${errors > 0 ? ` (${errors} rows skipped due to missing data)` : ''}`);
        setIsProcessing(false);

        // Auto-set selected month to first shift's month
        if (shifts.length > 0) {
          setSelectedMonth(shifts[0].date.slice(0, 7));
        }
      } catch (error) {
        console.error('Error parsing Excel:', error);
        setUploadStatus('❌ Error parsing Excel file. Please check the format.');
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  // Download template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Employee ID': 'ASP001',
        'Date': '2026-01-01',
        'Shift': 'G',
        'Department': 'Production',
        'Location': 'Mumbai'
      },
      {
        'Employee ID': 'ASP001',
        'Date': '2026-01-02',
        'Shift': 'G',
        'Department': 'Production',
        'Location': 'Mumbai'
      },
      {
        'Employee ID': 'ASP002',
        'Date': '2026-01-01',
        'Shift': 'N',
        'Department': 'Production',
        'Location': 'Mumbai'
      },
      {
        'Employee ID': 'ASP003',
        'Date': '2026-01-01',
        'Shift': 'G',
        'Department': 'Finance & Admin',
        'Location': 'Mumbai'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Employee ID
      { wch: 12 }, // Date
      { wch: 8 },  // Shift
      { wch: 20 }, // Department
      { wch: 15 }  // Location
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shift Schedule');

    XLSX.writeFile(wb, 'Shift_Schedule_Template.xlsx');
  };

  // Export deviation report
  const handleExportReport = () => {
    if (filteredDeviations.length === 0) {
      alert('No deviations to export');
      return;
    }

    const exportData = filteredDeviations.map(d => ({
      'Employee Number': d.employeeNumber,
      'Employee Name': d.employeeName,
      'Date': d.date,
      'Department': d.department,
      'Location': d.location,
      'Planned Shift': d.plannedShift,
      'Actual Shift': d.actualShift,
      'Deviation Type': d.deviationType === 'wrong_shift' ? 'Wrong Shift Attended' : 'Unscheduled Attendance',
      'In Time': d.inTime || '-',
      'Out Time': d.outTime || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shift Deviations');

    // Add summary sheet
    const summaryData = [
      { Metric: 'Total Deviations', Value: statistics.totalDeviations },
      { Metric: 'Wrong Shift Attended', Value: statistics.wrongShift },
      { Metric: 'Unscheduled Attendance', Value: statistics.unscheduled },
      { Metric: 'Unique Employees Affected', Value: statistics.uniqueEmployees },
      { Metric: 'Estimated Financial Impact ($)', Value: statistics.estimatedImpact },
      { Metric: '', Value: '' },
      { Metric: 'By Department', Value: '' },
      ...statistics.byDepartment.map(([dept, count]) => ({ Metric: dept, Value: count })),
      { Metric: '', Value: '' },
      { Metric: 'By Shift Type', Value: '' },
      ...statistics.byShift.map(([shift, count]) => ({ Metric: shift, Value: count }))
    ];

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    XLSX.writeFile(wb, `Shift_Deviation_Report_${selectedMonth}.xlsx`);
  };

  // Get unique values for filters
  const departments = ['All', ...new Set(deviations.map(d => d.department))];
  const locations = ['All', ...new Set(deviations.map(d => d.location))];

  // Group deviations by date for calendar view
  const deviationsByDate = useMemo(() => {
    const grouped = new Map<string, ShiftDeviation[]>();
    filteredDeviations.forEach(d => {
      if (!grouped.has(d.date)) {
        grouped.set(d.date, []);
      }
      grouped.get(d.date)!.push(d);
    });
    return grouped;
  }, [filteredDeviations]);

  // Generate calendar days for selected month
  const calendarDays = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const days: Date[] = [];

    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month - 1, d));
    }

    return days;
  }, [selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-8 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Calendar size={32} />
              Shift Deviation Analysis
            </h1>
            <p className="text-purple-100 font-medium text-sm mt-2">
              Track and analyze shift assignment vs actual attendance mismatches
            </p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
          <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
            <Upload size={20} />
            Upload Monthly Shift Schedule
          </h2>
          <div className="space-y-4">
            <div className="flex gap-3">
              <label className="flex-1 flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer font-black text-sm uppercase tracking-widest shadow-lg">
                <Upload size={18} />
                <span>Choose Excel File</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx, .xls"
                  onChange={handlePlannedShiftUpload}
                  disabled={isProcessing}
                />
              </label>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center space-x-2 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all font-black text-sm uppercase tracking-widest shadow-lg"
              >
                <Download size={18} />
                <span>Download Template</span>
              </button>
            </div>
            {uploadStatus && (
              <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                {uploadStatus}
              </div>
            )}
            <div className="text-xs text-slate-500 space-y-1">
              <p className="font-semibold">Required Excel columns:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Employee ID (or Employee Number or EMP #)</li>
                <li>Date</li>
                <li>Shift</li>
                <li>Department</li>
                <li>Location</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Dashboard */}
      {plannedShifts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border-2 border-red-200 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="text-red-600" size={24} />
              <span className="text-3xl font-black text-slate-900">{statistics.totalDeviations}</span>
            </div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Deviations</p>
          </div>

          <div className="bg-white rounded-2xl border-2 border-orange-200 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Users className="text-orange-600" size={24} />
              <span className="text-3xl font-black text-slate-900">{statistics.uniqueEmployees}</span>
            </div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Employees Affected</p>
          </div>

          <div className="bg-white rounded-2xl border-2 border-purple-200 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="text-purple-600" size={24} />
              <span className="text-3xl font-black text-slate-900">{statistics.wrongShift}</span>
            </div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Wrong Shift</p>
          </div>

          <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="text-emerald-600" size={24} />
              <span className="text-3xl font-black text-slate-900">${statistics.estimatedImpact}</span>
            </div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Est. Impact</p>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      {plannedShifts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex gap-4 items-center">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Department</label>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Location</label>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold"
                >
                  {locations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all font-black text-sm uppercase tracking-widest shadow-lg"
            >
              <FileDown size={18} />
              Export Report
            </button>
          </div>
        </div>
      )}

      {/* Detailed Breakdown */}
      {plannedShifts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* By Department */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
            <h3 className="text-lg font-black text-slate-900 mb-4">Deviations by Department</h3>
            <div className="space-y-2">
              {statistics.byDepartment.length > 0 ? (
                statistics.byDepartment.map(([dept, count]) => (
                  <div key={dept} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="font-semibold text-sm text-slate-700">{dept}</span>
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-black">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No deviations found</p>
              )}
            </div>
          </div>

          {/* By Shift Type */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
            <h3 className="text-lg font-black text-slate-900 mb-4">Deviations by Shift Type</h3>
            <div className="space-y-2">
              {statistics.byShift.length > 0 ? (
                statistics.byShift.map(([shift, count]) => (
                  <div key={shift} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="font-semibold text-sm text-slate-700">{shift}</span>
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-black">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No deviations found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deviation Records Table */}
      {plannedShifts.length > 0 && filteredDeviations.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-black text-slate-900">Detailed Deviation Records</h3>
            <p className="text-sm text-slate-500 mt-1">Showing {filteredDeviations.length} deviation(s)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Planned Shift</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Actual Shift</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDeviations.map((deviation, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{deviation.employeeName}</p>
                        <p className="text-xs text-slate-500">{deviation.employeeNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-medium">{deviation.date}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{deviation.department}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{deviation.location}</td>
                    <td className="px-4 py-3">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-black uppercase">
                        {deviation.plannedShift}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-black uppercase">
                        {deviation.actualShift}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                        deviation.deviationType === 'wrong_shift'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {deviation.deviationType === 'wrong_shift' ? 'Wrong Shift' : 'Unscheduled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {deviation.inTime || '-'} - {deviation.outTime || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {plannedShifts.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
          <Calendar className="mx-auto text-slate-400 mb-4" size={48} />
          <h3 className="text-xl font-black text-slate-900 mb-2">No Shift Schedule Uploaded</h3>
          <p className="text-slate-600 mb-6">Upload a monthly shift schedule Excel file to begin analyzing shift deviations.</p>
          {!isAdmin && (
            <p className="text-sm text-slate-500">Contact your administrator to upload shift schedules.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ShiftDeviation;
