
import React, { useState, useMemo } from 'react';
import {
  FileText,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  FileSpreadsheet,
  Loader2,
  Send,
  ChevronDown
} from 'lucide-react';
import { AppData, LeaveRecord, LeaveReconciliation, UserRole, AuditLogEntry } from '../types.ts';
import * as XLSX from 'xlsx';
import { auditLogService } from '../services/auditLogService.ts';

interface LeaveManagementProps {
  data: AppData;
  onUpdate: (leaves: LeaveRecord[], reconciliations: LeaveReconciliation[], logs: AuditLogEntry[]) => void;
  onPushToMonthly: () => void;
  role: UserRole;
  currentUser: string;
}

const LeaveManagement: React.FC<LeaveManagementProps> = ({ data, onUpdate, onPushToMonthly, role, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Matched' | 'Unmatched' | 'Approved' | 'Rejected'>('All');
  const [isProcessing, setIsProcessing] = useState(false);
  const [localLeaves, setLocalLeaves] = useState<LeaveRecord[]>(data.leaveRecords || []);
  const [localReconciliations, setLocalReconciliations] = useState<LeaveReconciliation[]>(data.leaveReconciliations || []);
  const [viewMode, setViewMode] = useState<'leaves' | 'reconciliation'>('leaves');

  const isAdmin = role === 'Admin' || role === 'SaaS_Admin';

  const formatDate = (date: any): string => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
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

  const handleLeaveUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const leaves: LeaveRecord[] = jsonData.map(row => ({
          employeeNumber: String(row['Employee Number'] || row['Employee ID'] || '').trim(),
          employeeName: String(row['Employee Name'] || row['Name'] || '').trim(),
          jobTitle: String(row['Job Title'] || '').trim(),
          businessUnit: String(row['Business Unit'] || '').trim(),
          department: String(row['Department'] || '').trim(),
          subDepartment: String(row['Sub Department'] || '').trim(),
          location: String(row['Location'] || '').trim(),
          costCenter: String(row['Cost Center'] || '').trim(),
          reportingManager: String(row['Reporting Manager'] || '').trim(),
          leaveType: String(row['Leave Types'] || row['Leave Type'] || 'LOP').trim(),
          fromDate: formatDate(row['From Date'] || row['Start Date']),
          fromSession: String(row['From Session'] || 'Full Day').trim(),
          toDate: formatDate(row['To Date'] || row['End Date']),
          toSession: String(row['To Session'] || 'Full Day').trim(),
          totalDuration: Number(row['Total Duration'] || row['Number of Days'] || row['Days'] || 1),
          unit: String(row['Unit'] || 'Days').trim(),
          requestedOn: formatDate(row['Requested on'] || row['Applied Date'] || new Date()),
          requestedBy: String(row['Requested by'] || row['Employee Name'] || '').trim(),
          note: String(row['Note'] || '').trim(),
          reason: String(row['Reason'] || row['Description'] || '-'),
          status: (row['Status'] || 'Applied') as any,
          lastActionTakenBy: String(row['Last Action Taken By'] || '').trim(),
          lastActionTakenOn: formatDate(row['Last Action Taken on'] || ''),
          nextApprover: String(row['Next Approver'] || '').trim()
        })).filter(l => l.employeeNumber);

        setLocalLeaves(leaves);
        alert(`Imported ${leaves.length} leave records successfully!`);
      } catch (err) {
        console.error(err);
        alert("Failed to import leave records. Please check the file format.");
      } finally {
        setIsProcessing(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleReconcile = () => {
    setIsProcessing(true);

    try {
      // Get all absent records from attendance
      const absentRecords = data.attendance.filter(r => r.status === 'Absent');
      const reconciliations: LeaveReconciliation[] = [];

      // Check each absent record against leave records
      absentRecords.forEach(absent => {
        const matchingLeave = localLeaves.find(leave => {
          if (leave.employeeNumber !== absent.employeeNumber) return false;

          const absentDate = parseFormattedDate(absent.date);
          const fromDate = parseFormattedDate(leave.fromDate);
          const toDate = parseFormattedDate(leave.toDate);

          if (!absentDate || !fromDate || !toDate) return false;

          return absentDate >= fromDate && absentDate <= toDate;
        });

        reconciliations.push({
          employeeNumber: absent.employeeNumber,
          employeeName: absent.employeeName,
          date: absent.date,
          absentInAttendance: true,
          leaveRecord: matchingLeave,
          reconciliationStatus: matchingLeave ? 'Matched' : 'Unmatched',
          finalStatus: matchingLeave ? matchingLeave.leaveType : 'A',
          remarks: matchingLeave
            ? `${matchingLeave.leaveType} - ${matchingLeave.reason}`
            : 'No leave record found'
        });
      });

      setLocalReconciliations(reconciliations);
      setViewMode('reconciliation');
      alert(`Reconciliation complete! Found ${reconciliations.filter(r => r.reconciliationStatus === 'Matched').length} matches out of ${reconciliations.length} absent records.`);
    } catch (err) {
      console.error(err);
      alert("Reconciliation failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = (reconciliation: LeaveReconciliation) => {
    const updated = localReconciliations.map(r =>
      r.employeeNumber === reconciliation.employeeNumber && r.date === reconciliation.date
        ? { ...r, reconciliationStatus: 'Approved' as const }
        : r
    );
    setLocalReconciliations(updated);
  };

  const handleReject = (reconciliation: LeaveReconciliation) => {
    const updated = localReconciliations.map(r =>
      r.employeeNumber === reconciliation.employeeNumber && r.date === reconciliation.date
        ? { ...r, reconciliationStatus: 'Rejected' as const, finalStatus: 'A', remarks: 'Leave rejected - remains Absent' }
        : r
    );
    setLocalReconciliations(updated);
  };

  const handleSaveAndPush = () => {
    if (confirm('Save reconciliations and update Monthly Report with approved leaves?')) {
      onUpdate(localLeaves, localReconciliations, []);
      onPushToMonthly();
      alert('Leave reconciliations saved and pushed to Monthly Report successfully!');
    }
  };

  const handleExportTemplate = () => {
    const templateData = [
      {
        'Employee Number': 'E001',
        'Employee Name': 'John Doe',
        'Job Title': 'Software Engineer',
        'Business Unit': 'Technology',
        'Department': 'Engineering',
        'Sub Department': 'Product Development',
        'Location': 'Mumbai',
        'Cost Center': 'CC001',
        'Reporting Manager': 'Jane Smith',
        'Leave Types': 'CL',
        'From Date': '01-JAN-2024',
        'From Session': 'Full Day',
        'To Date': '02-JAN-2024',
        'To Session': 'Full Day',
        'Total Duration': 2,
        'Unit': 'Days',
        'Requested on': '28-DEC-2023',
        'Requested by': 'John Doe',
        'Note': 'Personal work',
        'Reason': 'Personal',
        'Status': 'Approved',
        'Last Action Taken By': 'Jane Smith',
        'Last Action Taken on': '29-DEC-2023',
        'Next Approver': 'HR Team'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LeaveTemplate");
    XLSX.writeFile(wb, "Leave_Import_Template.xlsx");
  };

  const handleExport = () => {
    if (viewMode === 'leaves') {
      const ws = XLSX.utils.json_to_sheet(localLeaves.map(l => ({
        'Employee Number': l.employeeNumber,
        'Employee Name': l.employeeName,
        'Job Title': l.jobTitle,
        'Business Unit': l.businessUnit,
        'Department': l.department,
        'Sub Department': l.subDepartment,
        'Location': l.location,
        'Cost Center': l.costCenter,
        'Reporting Manager': l.reportingManager,
        'Leave Types': l.leaveType,
        'From Date': l.fromDate,
        'From Session': l.fromSession,
        'To Date': l.toDate,
        'To Session': l.toSession,
        'Total Duration': l.totalDuration,
        'Unit': l.unit,
        'Requested on': l.requestedOn,
        'Requested by': l.requestedBy,
        'Note': l.note,
        'Reason': l.reason,
        'Status': l.status,
        'Last Action Taken By': l.lastActionTakenBy,
        'Last Action Taken on': l.lastActionTakenOn,
        'Next Approver': l.nextApprover
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leave Records");
      XLSX.writeFile(wb, "Leave_Records.xlsx");
    } else {
      const ws = XLSX.utils.json_to_sheet(filteredReconciliations.map(r => ({
        'Employee Number': r.employeeNumber,
        'Employee Name': r.employeeName,
        'Date': r.date,
        'Leave Type': r.leaveRecord?.leaveType || 'N/A',
        'Reconciliation Status': r.reconciliationStatus,
        'Final Status': r.finalStatus,
        'Remarks': r.remarks
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reconciliation");
      XLSX.writeFile(wb, "Leave_Reconciliation.xlsx");
    }
  };

  const filteredReconciliations = useMemo(() => {
    return localReconciliations.filter(r => {
      const matchSearch = r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         r.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'All' || r.reconciliationStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [localReconciliations, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: localReconciliations.length,
      matched: localReconciliations.filter(r => r.reconciliationStatus === 'Matched').length,
      unmatched: localReconciliations.filter(r => r.reconciliationStatus === 'Unmatched').length,
      approved: localReconciliations.filter(r => r.reconciliationStatus === 'Approved').length,
      rejected: localReconciliations.filter(r => r.reconciliationStatus === 'Rejected').length
    };
  }, [localReconciliations]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <FileText className="text-teal-600" size={32} />
            Leave Management & Reconciliation
          </h1>
          <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mt-1">
            {localLeaves.length} Leave Records • {localReconciliations.length} Reconciliations
          </p>
        </div>

        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <button
            onClick={handleExportTemplate}
            className="flex items-center space-x-2 bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all font-black text-xs uppercase tracking-widest"
          >
            <Download size={14} />
            <span>Template</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center space-x-2 bg-white text-slate-900 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all font-black text-xs uppercase tracking-widest"
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          {isAdmin && (
            <>
              <button
                onClick={handleReconcile}
                disabled={localLeaves.length === 0 || isProcessing}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                <span>Reconcile</span>
              </button>

              <button
                onClick={handleSaveAndPush}
                disabled={localReconciliations.length === 0}
                className="flex items-center space-x-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl hover:bg-teal-700 transition-all font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <Send size={14} />
                <span>Save & Push to Monthly</span>
              </button>

              <label className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl cursor-pointer hover:bg-slate-800 transition-all font-black text-xs uppercase tracking-widest shadow-xl">
                {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                <span>Import Leaves</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleLeaveUpload}
                  disabled={isProcessing}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1 p-1 bg-slate-200/50 rounded-2xl w-fit">
          <button
            onClick={() => setViewMode('leaves')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              viewMode === 'leaves' ? 'bg-white text-teal-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:bg-white/50'
            }`}
          >
            <FileSpreadsheet size={14} />
            Leave Records
            <span className="ml-1 px-2 py-0.5 rounded-md text-[9px] border bg-slate-50 border-slate-200">
              {localLeaves.length}
            </span>
          </button>

          <button
            onClick={() => setViewMode('reconciliation')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              viewMode === 'reconciliation' ? 'bg-white text-teal-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:bg-white/50'
            }`}
          >
            <CheckCircle size={14} />
            Reconciliation
            <span className="ml-1 px-2 py-0.5 rounded-md text-[9px] border bg-slate-50 border-slate-200">
              {localReconciliations.length}
            </span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Only show in reconciliation view */}
      {viewMode === 'reconciliation' && localReconciliations.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100">
            <p className="text-xs font-black text-teal-600 uppercase tracking-widest">Matched</p>
            <p className="text-2xl font-black text-teal-700 mt-1">{stats.matched}</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
            <p className="text-xs font-black text-amber-600 uppercase tracking-widest">Unmatched</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{stats.unmatched}</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
            <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Approved</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{stats.approved}</p>
          </div>
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
            <p className="text-xs font-black text-rose-600 uppercase tracking-widest">Rejected</p>
            <p className="text-2xl font-black text-rose-700 mt-1">{stats.rejected}</p>
          </div>
        </div>
      )}

      {/* Filters - Only show in reconciliation view */}
      {viewMode === 'reconciliation' && (
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none text-xs font-black focus:ring-2 focus:ring-teal-500 transition-all"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="w-full appearance-none bg-slate-50 border border-slate-100 text-xs font-black py-2.5 pl-3 pr-8 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer transition-all"
              >
                <option value="All">Status: All</option>
                <option value="Matched">Matched</option>
                <option value="Unmatched">Unmatched</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={12} />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="overflow-auto max-h-[700px]">
          {viewMode === 'leaves' ? (
            <table className="w-full text-left table-auto border-collapse">
              <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
                <tr>
                  <th className="px-4 py-5">Employee #</th>
                  <th className="px-4 py-5">Name</th>
                  <th className="px-4 py-5">Job Title</th>
                  <th className="px-4 py-5">Business Unit</th>
                  <th className="px-4 py-5">Department</th>
                  <th className="px-4 py-5">Sub Dept</th>
                  <th className="px-4 py-5">Location</th>
                  <th className="px-4 py-5">Cost Center</th>
                  <th className="px-4 py-5">Manager</th>
                  <th className="px-4 py-5">Leave Type</th>
                  <th className="px-4 py-5">From Date</th>
                  <th className="px-4 py-5">From Session</th>
                  <th className="px-4 py-5">To Date</th>
                  <th className="px-4 py-5">To Session</th>
                  <th className="px-4 py-5 text-center">Duration</th>
                  <th className="px-4 py-5">Unit</th>
                  <th className="px-4 py-5">Requested On</th>
                  <th className="px-4 py-5">Requested By</th>
                  <th className="px-4 py-5">Note</th>
                  <th className="px-4 py-5">Reason</th>
                  <th className="px-4 py-5">Status</th>
                  <th className="px-4 py-5">Last Action By</th>
                  <th className="px-4 py-5">Last Action On</th>
                  <th className="px-4 py-5">Next Approver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={24} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <FileSpreadsheet className="text-slate-300" size={48} />
                        <p className="text-sm font-bold text-slate-400">No leave records imported yet</p>
                        <p className="text-xs text-slate-400">Upload an Excel file to get started</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  localLeaves.map((leave, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 text-xs font-black text-slate-900">{leave.employeeNumber}</td>
                      <td className="px-4 py-4 text-xs font-black text-teal-600">{leave.employeeName}</td>
                      <td className="px-4 py-4 text-xs text-slate-700">{leave.jobTitle}</td>
                      <td className="px-4 py-4 text-xs text-slate-700">{leave.businessUnit}</td>
                      <td className="px-4 py-4 text-xs text-slate-700">{leave.department}</td>
                      <td className="px-4 py-4 text-xs text-slate-700">{leave.subDepartment}</td>
                      <td className="px-4 py-4 text-xs text-slate-700">{leave.location}</td>
                      <td className="px-4 py-4 text-xs text-slate-700">{leave.costCenter}</td>
                      <td className="px-4 py-4 text-xs text-slate-700">{leave.reportingManager}</td>
                      <td className="px-4 py-4">
                        <span className="px-3 py-1 rounded-full text-[9px] font-black bg-indigo-100 text-indigo-700 uppercase">
                          {leave.leaveType}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-slate-700">{leave.fromDate}</td>
                      <td className="px-4 py-4 text-xs text-slate-600">{leave.fromSession}</td>
                      <td className="px-4 py-4 text-xs font-bold text-slate-700">{leave.toDate}</td>
                      <td className="px-4 py-4 text-xs text-slate-600">{leave.toSession}</td>
                      <td className="px-4 py-4 text-center text-sm font-black text-slate-900">{leave.totalDuration}</td>
                      <td className="px-4 py-4 text-xs text-slate-600">{leave.unit}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">{leave.requestedOn}</td>
                      <td className="px-4 py-4 text-xs text-slate-700">{leave.requestedBy}</td>
                      <td className="px-4 py-4 text-xs text-slate-600 max-w-xs truncate">{leave.note}</td>
                      <td className="px-4 py-4 text-xs text-slate-600 max-w-xs truncate">{leave.reason}</td>
                      <td className="px-4 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                          leave.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                          leave.status === 'Rejected' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-600">{leave.lastActionTakenBy}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">{leave.lastActionTakenOn}</td>
                      <td className="px-4 py-4 text-xs text-slate-700">{leave.nextApprover}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left table-auto border-collapse">
              <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
                <tr>
                  <th className="px-6 py-5">Employee #</th>
                  <th className="px-6 py-5">Name</th>
                  <th className="px-6 py-5">Date</th>
                  <th className="px-6 py-5">Leave Type</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5">Final Status</th>
                  <th className="px-6 py-5">Remarks</th>
                  {isAdmin && <th className="px-6 py-5 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReconciliations.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <AlertCircle className="text-slate-300" size={48} />
                        <p className="text-sm font-bold text-slate-400">No reconciliation data</p>
                        <p className="text-xs text-slate-400">Click "Reconcile" to match leave records with absent days</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredReconciliations.map((rec, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-xs font-black text-slate-900">{rec.employeeNumber}</td>
                      <td className="px-6 py-4 text-xs font-black text-teal-600">{rec.employeeName}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-700">{rec.date}</td>
                      <td className="px-6 py-4">
                        {rec.leaveRecord ? (
                          <span className="px-3 py-1 rounded-full text-[9px] font-black bg-indigo-100 text-indigo-700 uppercase">
                            {rec.leaveRecord.leaveType}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                          rec.reconciliationStatus === 'Matched' ? 'bg-teal-100 text-teal-700' :
                          rec.reconciliationStatus === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                          rec.reconciliationStatus === 'Rejected' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {rec.reconciliationStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full text-[9px] font-black bg-slate-100 text-slate-700 uppercase">
                          {rec.finalStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">{rec.remarks}</td>
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 justify-center">
                            {rec.reconciliationStatus === 'Matched' && (
                              <>
                                <button
                                  onClick={() => handleApprove(rec)}
                                  className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all"
                                  title="Approve"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => handleReject(rec)}
                                  className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all"
                                  title="Reject"
                                >
                                  <XCircle size={16} />
                                </button>
                              </>
                            )}
                            {rec.reconciliationStatus === 'Approved' && (
                              <span className="text-xs text-emerald-600 font-bold">✓ Approved</span>
                            )}
                            {rec.reconciliationStatus === 'Rejected' && (
                              <span className="text-xs text-rose-600 font-bold">✗ Rejected</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaveManagement;
