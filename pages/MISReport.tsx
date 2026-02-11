import React, { useState, useMemo } from 'react';
import { Download, FileText, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AppData, UserRole } from '../types';

interface MISReportProps {
  data: AppData;
  role: UserRole;
}

interface ShiftData {
  present: number;
  absent: number;
}

interface LocationData {
  legalEntity: string;
  location: string;
  approvedHeadcount: number;
  actualHeadcount: number;
  shifts: { [shiftName: string]: ShiftData };
  totalPresent: number;
  totalAbsent: number;
  absenteeismPercent: number;
}

const MISReport: React.FC<MISReportProps> = ({ data, role }) => {
  // Default to previous day and today
  const getYesterday = () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };

  const getToday = () => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getYesterday());
  const [endDate, setEndDate] = useState(getToday());
  const [selectedLocation, setSelectedLocation] = useState<string>('All');

  // Get unique shifts
  const shifts = useMemo(() => {
    const shiftSet = new Set<string>();
    if (data.shifts) {
      data.shifts.forEach(shift => shiftSet.add(shift.shiftName));
    }
    return Array.from(shiftSet).sort();
  }, [data.shifts]);

  // Get unique locations for filter
  const locations = useMemo(() => {
    const locSet = new Set<string>();
    if (data.employees) {
      data.employees.forEach(emp => locSet.add(emp.location));
    }
    return ['All', ...Array.from(locSet).sort()];
  }, [data.employees]);

  // Process MIS data
  const misData = useMemo((): LocationData[] => {
    const locationMap = new Map<string, LocationData>();

    // Get active employees grouped by location and legal entity
    const activeEmployees = (data.employees || []).filter(emp => {
      if (emp.activeStatus !== 'Active' && emp.activeStatus !== 'active') return false;
      if (selectedLocation !== 'All' && emp.location !== selectedLocation) return false;
      return true;
    });

    // Initialize location data with actual headcount
    activeEmployees.forEach(emp => {
      const key = `${emp.location}|${emp.legalEntity}`;

      if (!locationMap.has(key)) {
        locationMap.set(key, {
          legalEntity: emp.legalEntity,
          location: emp.location,
          approvedHeadcount: 0,
          actualHeadcount: 0,
          shifts: {},
          totalPresent: 0,
          totalAbsent: 0,
          absenteeismPercent: 0
        });
      }

      const locData = locationMap.get(key)!;
      locData.actualHeadcount += 1;

      // Initialize shift data
      shifts.forEach(shiftName => {
        if (!locData.shifts[shiftName]) {
          locData.shifts[shiftName] = { present: 0, absent: 0 };
        }
      });
    });

    // Get approved headcount from headcountData
    if (data.headcountData) {
      data.headcountData.forEach(hc => {
        const key = `${hc.location}|${hc.legalEntity}`;
        const locData = locationMap.get(key);
        if (locData) {
          locData.approvedHeadcount += hc.approvedHeadcount;
        }
      });
    }

    // Process reconciliation data for the date range
    if (data.reconciliationRecords) {
      const filteredReconciliation = data.reconciliationRecords.filter(rec => {
        const recDate = rec.date;
        if (recDate < startDate || recDate > endDate) return false;
        // Only include finalized/reconciled records
        if (!rec.isReconciled) return false;
        return true;
      });

      console.log(`MIS Report: Found ${filteredReconciliation.length} reconciled records for date range ${startDate} to ${endDate}`);

      filteredReconciliation.forEach(rec => {
        const employee = activeEmployees.find(emp => emp.employeeNumber === rec.employeeNumber);
        if (!employee) return;

        const key = `${employee.location}|${employee.legalEntity}`;
        const locData = locationMap.get(key);
        if (!locData) return;

        // Get employee's shift
        const empShift = employee.shift || 'General';

        if (!locData.shifts[empShift]) {
          locData.shifts[empShift] = { present: 0, absent: 0 };
        }

        // Determine if present or absent using finalStatus (reconciled status)
        const status = rec.finalStatus?.toUpperCase()?.trim() || '';

        // Check for Present status (more flexible matching)
        if (status === 'PRESENT' || status === 'P' || status.includes('PRESENT')) {
          locData.shifts[empShift].present += 1;
          locData.totalPresent += 1;
        }
        // Check for Absent status
        else if (status === 'ABSENT' || status === 'A' || status.includes('ABSENT')) {
          locData.shifts[empShift].absent += 1;
          locData.totalAbsent += 1;
        }
      });
    }

    // Calculate absenteeism percentage
    locationMap.forEach(locData => {
      const total = locData.totalPresent + locData.totalAbsent;
      if (total > 0) {
        locData.absenteeismPercent = (locData.totalAbsent / total) * 100;
      }
    });

    // Convert to array and sort by absenteeism (highest first)
    return Array.from(locationMap.values()).sort((a, b) =>
      b.absenteeismPercent - a.absenteeismPercent
    );
  }, [data.employees, data.headcountData, data.reconciliationRecords, data.shifts, startDate, endDate, shifts, selectedLocation]);

  // Calculate grand totals
  const grandTotals = useMemo(() => {
    const totals = {
      approvedHeadcount: 0,
      actualHeadcount: 0,
      shifts: {} as { [shiftName: string]: ShiftData },
      totalPresent: 0,
      totalAbsent: 0,
      absenteeismPercent: 0
    };

    shifts.forEach(shiftName => {
      totals.shifts[shiftName] = { present: 0, absent: 0 };
    });

    misData.forEach(loc => {
      totals.approvedHeadcount += loc.approvedHeadcount;
      totals.actualHeadcount += loc.actualHeadcount;
      totals.totalPresent += loc.totalPresent;
      totals.totalAbsent += loc.totalAbsent;

      shifts.forEach(shiftName => {
        if (loc.shifts[shiftName]) {
          totals.shifts[shiftName].present += loc.shifts[shiftName].present;
          totals.shifts[shiftName].absent += loc.shifts[shiftName].absent;
        }
      });
    });

    const total = totals.totalPresent + totals.totalAbsent;
    if (total > 0) {
      totals.absenteeismPercent = (totals.totalAbsent / total) * 100;
    }

    return totals;
  }, [misData, shifts]);

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('MIS Report - Attendance Summary', 14, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 22);

    // Prepare table data
    const headers: any[] = [
      [
        { content: 'Location', rowSpan: 2 },
        { content: 'Legal Entity', rowSpan: 2 },
        { content: 'Approved HC', rowSpan: 2 },
        { content: 'Actual HC', rowSpan: 2 },
        ...shifts.flatMap(shift => [{ content: shift, colSpan: 2 }]),
        { content: 'Total', colSpan: 2 },
        { content: 'Absenteeism %', rowSpan: 2 }
      ]
    ];

    const subHeaders = [
      '', '', '', '',
      ...shifts.flatMap(() => ['Present', 'Absent']),
      'Present', 'Absent',
      ''
    ];

    const body = misData.map(loc => [
      loc.location,
      loc.legalEntity,
      loc.approvedHeadcount,
      loc.actualHeadcount,
      ...shifts.flatMap(shift => [
        loc.shifts[shift]?.present || 0,
        loc.shifts[shift]?.absent || 0
      ]),
      loc.totalPresent,
      loc.totalAbsent,
      loc.absenteeismPercent.toFixed(2) + '%'
    ]);

    // Add totals row
    body.push([
      { content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold' } },
      grandTotals.approvedHeadcount,
      grandTotals.actualHeadcount,
      ...shifts.flatMap(shift => [
        grandTotals.shifts[shift]?.present || 0,
        grandTotals.shifts[shift]?.absent || 0
      ]),
      grandTotals.totalPresent,
      grandTotals.totalAbsent,
      grandTotals.absenteeismPercent.toFixed(2) + '%'
    ]);

    (doc as any).autoTable({
      head: [headers[0], subHeaders],
      body: body,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 30 }
      },
      tableWidth: 'auto'
    });

    doc.save(`MIS_Report_${startDate}_to_${endDate}.pdf`);
  };

  const handleExportExcel = () => {
    // Create headers
    const header1 = [
      'Location', 'Legal Entity', 'Approved HC', 'Actual HC',
      ...shifts.flatMap(shift => [shift, '']),
      'Total', '',
      'Absenteeism %'
    ];

    const header2 = [
      '', '', '', '',
      ...shifts.flatMap(() => ['Present', 'Absent']),
      'Present', 'Absent',
      ''
    ];

    const exportData = [header1, header2];

    // Add data rows
    misData.forEach(loc => {
      exportData.push([
        loc.location,
        loc.legalEntity,
        loc.approvedHeadcount,
        loc.actualHeadcount,
        ...shifts.flatMap(shift => [
          loc.shifts[shift]?.present || 0,
          loc.shifts[shift]?.absent || 0
        ]),
        loc.totalPresent,
        loc.totalAbsent,
        loc.absenteeismPercent.toFixed(2) + '%'
      ]);
    });

    // Add totals row
    exportData.push([
      'TOTAL',
      '',
      grandTotals.approvedHeadcount,
      grandTotals.actualHeadcount,
      ...shifts.flatMap(shift => [
        grandTotals.shifts[shift]?.present || 0,
        grandTotals.shifts[shift]?.absent || 0
      ]),
      grandTotals.totalPresent,
      grandTotals.totalAbsent,
      grandTotals.absenteeismPercent.toFixed(2) + '%'
    ]);

    const ws = XLSX.utils.aoa_to_sheet(exportData);

    // Merge cells for shift headers
    const merges = [];
    let colIndex = 4;
    shifts.forEach(() => {
      merges.push({
        s: { r: 0, c: colIndex },
        e: { r: 0, c: colIndex + 1 }
      });
      colIndex += 2;
    });
    // Merge Total header
    merges.push({
      s: { r: 0, c: colIndex },
      e: { r: 0, c: colIndex + 1 }
    });
    ws['!merges'] = merges;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MIS Report');
    XLSX.writeFile(wb, `MIS_Report_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 p-8 overflow-auto">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <FileText size={24} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">MIS Report</h1>
                <p className="text-sm text-slate-500 font-medium">Management Information System - Attendance Summary</p>
              </div>
            </div>
          </div>
        </div>

        {/* Date Range Selection and Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
                Start Date:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
                End Date:
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
                Location:
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              >
                {locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div className="ml-auto flex gap-3">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl hover:from-red-700 hover:to-rose-700 transition-all font-bold text-sm uppercase tracking-widest"
              >
                <Download size={18} />
                PDF
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-bold text-sm uppercase tracking-widest"
              >
                <Download size={18} />
                Excel
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-4">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Approved HC</p>
            <p className="text-2xl font-black text-blue-600">{grandTotals.approvedHeadcount}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-4">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Actual HC</p>
            <p className="text-2xl font-black text-green-600">{grandTotals.actualHeadcount}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-4">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Total Present</p>
            <p className="text-2xl font-black text-emerald-600">{grandTotals.totalPresent}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-4">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Absenteeism %</p>
            <p className="text-2xl font-black text-red-600">{grandTotals.absenteeismPercent.toFixed(2)}%</p>
          </div>
        </div>

        {/* MIS Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          {misData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <Users size={64} className="text-slate-300 mb-4" />
              <p className="text-xl font-bold text-slate-700 mb-2">No Data Available</p>
              <p className="text-sm text-slate-500 text-center">
                No attendance data found for the selected date range.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest border-r border-slate-700">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest border-r border-slate-700">Legal Entity</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest border-r border-slate-700">Approved HC</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest border-r border-slate-700">Actual HC</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest bg-green-800 border-r border-slate-700">Present</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest bg-red-800 border-r border-slate-700">Absent</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Absenteeism %</th>
                  </tr>
                </thead>
                <tbody>
                  {misData.map((loc, idx) => (
                    <tr key={`${loc.location}-${loc.legalEntity}`} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="px-4 py-3 text-sm font-bold text-slate-900 border-r border-slate-200">{loc.location}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700 border-r border-slate-200">{loc.legalEntity}</td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-blue-700 border-r border-slate-200">{loc.approvedHeadcount}</td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-green-700 border-r border-slate-200">{loc.actualHeadcount}</td>
                      <td className="px-4 py-3 text-center text-sm font-black text-green-700 bg-green-50 border-r border-slate-200">{loc.totalPresent}</td>
                      <td className="px-4 py-3 text-center text-sm font-black text-red-700 bg-red-50 border-r border-slate-200">{loc.totalAbsent}</td>
                      <td className="px-4 py-3 text-center text-sm font-black text-red-600">{loc.absenteeismPercent.toFixed(2)}%</td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-gradient-to-r from-slate-800 to-slate-900 text-white font-black">
                    <td colSpan={2} className="px-4 py-3 text-sm uppercase tracking-widest border-r border-slate-700">TOTAL</td>
                    <td className="px-4 py-3 text-center text-sm border-r border-slate-700">{grandTotals.approvedHeadcount}</td>
                    <td className="px-4 py-3 text-center text-sm border-r border-slate-700">{grandTotals.actualHeadcount}</td>
                    <td className="px-4 py-3 text-center text-sm bg-green-900 border-r border-slate-700">{grandTotals.totalPresent}</td>
                    <td className="px-4 py-3 text-center text-sm bg-red-900 border-r border-slate-700">{grandTotals.totalAbsent}</td>
                    <td className="px-4 py-3 text-center text-sm">{grandTotals.absenteeismPercent.toFixed(2)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MISReport;
