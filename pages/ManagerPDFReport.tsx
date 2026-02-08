import React, { useState, useMemo } from 'react';
import { FileText, Download, Calendar, User } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppData, UserRole, ReconciliationRecord, AuditQueueRecord } from '../types';

interface ManagerPDFReportProps {
  data: AppData;
  role: UserRole;
}

interface ViolationCounts {
  absent: number;
  workedOff: number;
  errors: number;
  lateEarly: number;
  lessThan4hrs: number;
  hours4to7: number;
  shiftDeviation: number;
  missingPunch: number;
  otherViolations: number;
}

interface ManagerData {
  managerName: string;
  violations: ViolationCounts;
  details: {
    absent: ReconciliationRecord[];
    workedOff: ReconciliationRecord[];
    errors: AuditQueueRecord[];
    lateEarly: AuditQueueRecord[];
    lessThan4hrs: AuditQueueRecord[];
    hours4to7: AuditQueueRecord[];
    shiftDeviation: ReconciliationRecord[];
    missingPunch: AuditQueueRecord[];
    otherViolations: AuditQueueRecord[];
  };
}

const ManagerPDFReport: React.FC<ManagerPDFReportProps> = ({ data, role }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedManager, setSelectedManager] = useState('All');

  const isAdmin = role === 'SaaS_Admin' || role === 'Admin';

  // Get unique managers from reconciliation records
  const managers = useMemo(() => {
    const managerSet = new Set<string>();

    // From reconciliation records
    data.reconciliationRecords?.forEach(rec => {
      if (rec.reportingManager) managerSet.add(rec.reportingManager);
    });

    // From audit queue
    data.auditQueue.forEach(rec => {
      const employee = data.employees.find(e => e.employeeNumber === rec.employeeNumber);
      if (employee?.reportingTo) managerSet.add(employee.reportingTo);
    });

    return ['All', ...Array.from(managerSet).sort()];
  }, [data]);

  // Helper: Parse hours from time string
  const parseHours = (timeStr: string): number => {
    if (!timeStr || timeStr === 'NA' || timeStr === '-') return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours + minutes / 60;
  };

  // Categorize audit queue record
  const categorizeAuditRecord = (record: AuditQueueRecord): string => {
    const reason = record.auditReason?.toLowerCase() || '';

    if (reason.includes('late') || reason.includes('early')) return 'lateEarly';
    if (reason.includes('missing') || reason.includes('punch')) return 'missingPunch';
    if (reason.includes('error') || reason.includes('id')) return 'errors';

    // Check for short hours
    if (reason.includes('short') || reason.includes('hour')) {
      // Try to extract hours from the record or reason
      // This is a simplified check - adjust based on your actual data
      return 'otherViolations';
    }

    return 'otherViolations';
  };

  // Process data for selected manager and date range
  const managerReportData = useMemo((): ManagerData[] => {
    if (!fromDate || !toDate) return [];

    const reports = new Map<string, ManagerData>();

    // Process reconciliation records
    const reconRecords = data.reconciliationRecords || [];
    reconRecords.forEach(rec => {
      // Date filter
      if (rec.date < fromDate || rec.date > toDate) return;

      // Manager filter
      const manager = rec.reportingManager || 'Unknown';
      if (selectedManager !== 'All' && manager !== selectedManager) return;

      // Initialize manager data if needed
      if (!reports.has(manager)) {
        reports.set(manager, {
          managerName: manager,
          violations: {
            absent: 0,
            workedOff: 0,
            errors: 0,
            lateEarly: 0,
            lessThan4hrs: 0,
            hours4to7: 0,
            shiftDeviation: 0,
            missingPunch: 0,
            otherViolations: 0
          },
          details: {
            absent: [],
            workedOff: [],
            errors: [],
            lateEarly: [],
            lessThan4hrs: [],
            hours4to7: [],
            shiftDeviation: [],
            missingPunch: [],
            otherViolations: []
          }
        });
      }

      const managerData = reports.get(manager)!;

      // Categorize by status
      const status = rec.finalStatus || rec.absentStatus;

      if (status === 'A') {
        managerData.violations.absent++;
        managerData.details.absent.push(rec);
      } else if (status === 'WOH') {
        managerData.violations.workedOff++;
        managerData.details.workedOff.push(rec);
      }

      // Check for shift deviation (if excelStatus doesn't match absentStatus)
      if (rec.excelStatus && rec.absentStatus && rec.excelStatus !== rec.absentStatus) {
        managerData.violations.shiftDeviation++;
        managerData.details.shiftDeviation.push(rec);
      }
    });

    // Process audit queue
    data.auditQueue.forEach(rec => {
      // Date filter
      if (rec.date < fromDate || rec.date > toDate) return;

      // Get manager from employee data
      const employee = data.employees.find(e => e.employeeNumber === rec.employeeNumber);
      const manager = employee?.reportingTo || 'Unknown';

      // Manager filter
      if (selectedManager !== 'All' && manager !== selectedManager) return;

      // Initialize manager data if needed
      if (!reports.has(manager)) {
        reports.set(manager, {
          managerName: manager,
          violations: {
            absent: 0,
            workedOff: 0,
            errors: 0,
            lateEarly: 0,
            lessThan4hrs: 0,
            hours4to7: 0,
            shiftDeviation: 0,
            missingPunch: 0,
            otherViolations: 0
          },
          details: {
            absent: [],
            workedOff: [],
            errors: [],
            lateEarly: [],
            lessThan4hrs: [],
            hours4to7: [],
            shiftDeviation: [],
            missingPunch: [],
            otherViolations: []
          }
        });
      }

      const managerData = reports.get(manager)!;
      const category = categorizeAuditRecord(rec);

      if (category === 'lateEarly') {
        managerData.violations.lateEarly++;
        managerData.details.lateEarly.push(rec);
      } else if (category === 'missingPunch') {
        managerData.violations.missingPunch++;
        managerData.details.missingPunch.push(rec);
      } else if (category === 'errors') {
        managerData.violations.errors++;
        managerData.details.errors.push(rec);
      } else {
        managerData.violations.otherViolations++;
        managerData.details.otherViolations.push(rec);
      }
    });

    return Array.from(reports.values()).sort((a, b) =>
      a.managerName.localeCompare(b.managerName)
    );
  }, [data, fromDate, toDate, selectedManager]);

  // Generate PDF for a single manager
  const generatePDF = (managerData: ManagerData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Manager Attendance Violations Report', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Report Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Manager: ${managerData.managerName}`, 14, yPos);
    yPos += 6;
    doc.text(`Period: ${fromDate} to ${toDate}`, 14, yPos);
    yPos += 6;
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, yPos);
    yPos += 10;

    // Summary Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Violations Summary', 14, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [['Violation Type', 'Count']],
      body: [
        ['Absent', managerData.violations.absent],
        ['Worked Off Days', managerData.violations.workedOff],
        ['Errors', managerData.violations.errors],
        ['Late & Early Occurrence', managerData.violations.lateEarly],
        ['Worked Less than 4 hours', managerData.violations.lessThan4hrs],
        ['Worked 4-7 hours', managerData.violations.hours4to7],
        ['Shift Deviation', managerData.violations.shiftDeviation],
        ['Missing Punch', managerData.violations.missingPunch],
        ['Other Violations', managerData.violations.otherViolations]
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Detailed Sections
    const addDetailSection = (title: string, records: any[], isAudit: boolean = false) => {
      if (records.length === 0) return;

      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, yPos);
      yPos += 5;

      if (isAudit) {
        autoTable(doc, {
          startY: yPos,
          head: [['Employee', 'Date', 'Reason', 'Status']],
          body: records.map((rec: AuditQueueRecord) => [
            `${rec.employeeName} (${rec.employeeNumber})`,
            rec.date,
            rec.auditReason,
            rec.reviewStatus
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 }
        });
      } else {
        autoTable(doc, {
          startY: yPos,
          head: [['Employee', 'Date', 'Absent Status', 'Final Status']],
          body: records.map((rec: ReconciliationRecord) => [
            `${rec.employeeName} (${rec.employeeNumber})`,
            rec.date,
            rec.absentStatus,
            rec.finalStatus
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 }
        });
      }

      yPos = (doc as any).lastAutoTable.finalY + 10;
    };

    // Add all detail sections
    addDetailSection('Absent Records', managerData.details.absent);
    addDetailSection('Worked Off Days', managerData.details.workedOff);
    addDetailSection('Errors', managerData.details.errors, true);
    addDetailSection('Late & Early Occurrence', managerData.details.lateEarly, true);
    addDetailSection('Worked Less than 4 Hours', managerData.details.lessThan4hrs, true);
    addDetailSection('Worked 4-7 Hours', managerData.details.hours4to7, true);
    addDetailSection('Shift Deviation', managerData.details.shiftDeviation);
    addDetailSection('Missing Punch', managerData.details.missingPunch, true);
    addDetailSection('Other Violations', managerData.details.otherViolations, true);

    // Save PDF
    const fileName = `Manager_Report_${managerData.managerName.replace(/\s+/g, '_')}_${fromDate}_to_${toDate}.pdf`;
    doc.save(fileName);
  };

  // Generate individual PDF
  const handleIndividualPDF = () => {
    if (!fromDate || !toDate) {
      alert('Please select both from and to dates');
      return;
    }

    if (selectedManager === 'All') {
      alert('Please select a specific manager for individual PDF');
      return;
    }

    const managerData = managerReportData.find(m => m.managerName === selectedManager);
    if (!managerData) {
      alert('No data found for selected manager in the date range');
      return;
    }

    generatePDF(managerData);
  };

  // Generate bulk PDFs
  const handleBulkPDF = () => {
    if (!fromDate || !toDate) {
      alert('Please select both from and to dates');
      return;
    }

    if (managerReportData.length === 0) {
      alert('No data found for the selected date range');
      return;
    }

    // Generate PDF for each manager
    managerReportData.forEach((managerData, index) => {
      setTimeout(() => {
        generatePDF(managerData);
      }, index * 500); // Delay to prevent browser blocking multiple downloads
    });

    alert(`Generating ${managerReportData.length} PDF reports. Please allow multiple downloads in your browser.`);
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
              <FileText size={24} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">Manager PDF Reports</h1>
              <p className="text-sm text-slate-500 font-medium">Generate comprehensive violation reports by manager</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-6">
          <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
            <Calendar size={20} />
            Select Report Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                Manager
              </label>
              <select
                value={selectedManager}
                onChange={(e) => setSelectedManager(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              >
                {managers.map(mgr => (
                  <option key={mgr} value={mgr}>{mgr}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {fromDate && toDate && managerReportData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <User size={24} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Managers</p>
                  <p className="text-2xl font-black text-slate-900">{managerReportData.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
                  <FileText size={24} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Total Violations</p>
                  <p className="text-2xl font-black text-slate-900">
                    {managerReportData.reduce((sum, m) =>
                      sum + Object.values(m.violations).reduce((s, v) => s + v, 0), 0
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Calendar size={24} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Date Range</p>
                  <p className="text-sm font-black text-slate-900">{fromDate} to {toDate}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Download Actions */}
        {isAdmin && fromDate && toDate && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-6">
            <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <Download size={20} />
              Download Reports
            </h2>
            <div className="flex gap-3">
              <button
                onClick={handleIndividualPDF}
                disabled={selectedManager === 'All'}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                  selectedManager === 'All'
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg'
                }`}
              >
                <Download size={18} />
                Download Individual PDF
              </button>

              <button
                onClick={handleBulkPDF}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-black text-sm uppercase tracking-widest shadow-lg"
              >
                <Download size={18} />
                Download Bulk PDFs
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Individual PDF: Select a specific manager. Bulk PDF: Downloads PDFs for all managers in the date range.
            </p>
          </div>
        )}

        {/* Manager Violation Summary Table */}
        {fromDate && toDate && managerReportData.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <p className="text-sm font-bold text-slate-700">
                Manager Violations Summary ({managerReportData.length} managers)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Manager</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Absent</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Worked Off</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Errors</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Late/Early</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">&lt;4 hrs</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">4-7 hrs</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Shift Dev</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Missing</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Other</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {managerReportData.map((manager, idx) => {
                    const total = Object.values(manager.violations).reduce((sum, v) => sum + v, 0);
                    return (
                      <tr key={manager.managerName} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="px-4 py-3 text-sm font-bold text-slate-900">{manager.managerName}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.absent}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.workedOff}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.errors}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.lateEarly}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.lessThan4hrs}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.hours4to7}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.shiftDeviation}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.missingPunch}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.otherViolations}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-sm font-bold">
                            {total}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {fromDate && toDate && managerReportData.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-12 text-center">
            <FileText size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-bold text-slate-500">No data found for the selected date range and manager</p>
            <p className="text-sm text-slate-400 mt-2">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerPDFReport;
