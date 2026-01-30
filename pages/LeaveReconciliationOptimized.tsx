import React, { useState, useMemo } from 'react';
import {
  FileText,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Search,
  Send,
  Edit3,
  ChevronDown
} from 'lucide-react';
import { AppData, UserRole, AuditLogEntry } from '../types.ts';
import * as XLSX from 'xlsx';

interface ReconciliationRecord {
  employeeNumber: string;
  employeeName: string;
  jobTitle: string;
  businessUnit: string;
  department: string;
  subDepartment: string;
  location: string;
  costCenter: string;
  reportingManager: string;
  date: string;
  absentStatus: string; // Status from attendance (A = Absent)
  excelStatus: string; // Status from uploaded Excel
  finalStatus: string; // User-accepted or overridden status
  comments: string;
  isReconciled: boolean; // Whether user has accepted/overridden
}

interface LeaveReconciliationOptimizedProps {
  data: AppData;
  onUpdate: (reconciliations: ReconciliationRecord[], logs: AuditLogEntry[]) => void;
  onPushToMonthly: () => void;
  role: UserRole;
  currentUser: string;
}

const LeaveReconciliationOptimized: React.FC<LeaveReconciliationOptimizedProps> = ({
  data,
  onUpdate,
  onPushToMonthly,
  role,
  currentUser
}) => {
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const isAdmin = role === 'Admin' || role === 'SaaS_Admin' || role === 'Manager';

  const formatDate = (date: any): string => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Get all absent records from attendance
  const absentRecords = useMemo(() => {
    return data.attendance.filter(att => att.status === 'Absent' || att.status === 'A');
  }, [data.attendance]);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        // Create a map of Excel data by Employee Number + Date
        const excelMap = new Map<string, any>();
        const statuses = new Set<string>();

        jsonData.forEach(row => {
          const empNum = String(row['Employee Number'] || '').trim();
          const date = formatDate(row['Date']);
          const status = String(row['Status'] || '').trim();

          if (empNum && date && status) {
            excelMap.set(`${empNum}-${date}`, row);
            statuses.add(status);
          }
        });

        setAvailableStatuses(Array.from(statuses));

        // Match absent records with Excel data
        const matched: ReconciliationRecord[] = absentRecords.map(absent => {
          const key = `${absent.employeeNumber}-${absent.date}`;
          const excelData = excelMap.get(key);

          return {
            employeeNumber: absent.employeeNumber,
            employeeName: absent.employeeName,
            jobTitle: excelData?.['Job Title'] || absent.jobTitle || '-',
            businessUnit: excelData?.['Business Unit'] || absent.businessUnit || '-',
            department: excelData?.['Department'] || absent.department || '-',
            subDepartment: excelData?.['Sub Department'] || absent.subDepartment || '-',
            location: excelData?.['Location'] || absent.location || '-',
            costCenter: excelData?.['Cost Center'] || absent.costCenter || '-',
            reportingManager: excelData?.['Reporting Manager'] || absent.reportingManager || '-',
            date: absent.date,
            absentStatus: 'A', // From attendance
            excelStatus: excelData ? String(excelData['Status'] || '-').trim() : 'Not Found',
            finalStatus: excelData ? String(excelData['Status'] || 'A').trim() : 'A',
            comments: '',
            isReconciled: false
          };
        });

        setReconciliations(matched);
        alert(`Loaded ${matched.length} absent records!\n\nAvailable Statuses: ${Array.from(statuses).join(', ')}`);
      } catch (err) {
        console.error(err);
        alert("Failed to import Excel file. Please check the format.");
      } finally {
        setIsProcessing(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAcceptStatus = (index: number) => {
    const updated = [...reconciliations];
    updated[index].isReconciled = true;
    // Keep finalStatus as is (from Excel)
    setReconciliations(updated);
  };

  const handleOverrideStatus = (index: number, newStatus: string) => {
    const updated = [...reconciliations];
    updated[index].finalStatus = newStatus;
    updated[index].isReconciled = true;
    setReconciliations(updated);
  };

  const handleCommentChange = (index: number, comment: string) => {
    const updated = [...reconciliations];
    updated[index].comments = comment;
    setReconciliations(updated);
  };

  const handlePushToMonthly = () => {
    const reconciledCount = reconciliations.filter(r => r.isReconciled).length;
    const unreconciledCount = reconciliations.length - reconciledCount;

    if (reconciledCount === 0) {
      alert('Please reconcile at least one record before pushing to monthly report.');
      return;
    }

    if (confirm(
      `Push reconciliation to Monthly Report?\n\n` +
      `✓ ${reconciledCount} reconciled records will be updated\n` +
      `⚠ ${unreconciledCount} unreconciled records will show as BLANK in monthly report\n\n` +
      `Continue?`
    )) {
      onUpdate(reconciliations, []);
      onPushToMonthly();
      alert(`Reconciliation completed!\n\n✓ ${reconciledCount} records pushed to Monthly Report\n⚠ ${unreconciledCount} records remain blank`);
    }
  };

  const handleExportTemplate = () => {
    const templateData = [{
      'Employee Number': 'E001',
      'Employee Name': 'John Doe',
      'Job Title': 'Software Engineer',
      'Business Unit': 'Technology',
      'Department': 'Engineering',
      'Sub Department': 'Product Development',
      'Location': 'Mumbai',
      'Cost Center': 'CC001',
      'Reporting Manager': 'Jane Smith',
      'Date': '15-JAN-2024',
      'Status': 'CL'
    }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Leave_Reconciliation_Template.xlsx");
  };

  const handleExport = () => {
    const exportData = filteredReconciliations.map(r => ({
      'Employee Number': r.employeeNumber,
      'Employee Name': r.employeeName,
      'Job Title': r.jobTitle,
      'Department': r.department,
      'Date': r.date,
      'Absent Status': r.absentStatus,
      'Excel Status': r.excelStatus,
      'Final Status': r.finalStatus,
      'Comments': r.comments,
      'Reconciled': r.isReconciled ? 'Yes' : 'No'
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reconciliation");
    XLSX.writeFile(wb, "Leave_Reconciliation.xlsx");
  };

  const filteredReconciliations = useMemo(() => {
    return reconciliations.filter(r => {
      const matchSearch = r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         r.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'All' || r.excelStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [reconciliations, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: reconciliations.length,
      reconciled: reconciliations.filter(r => r.isReconciled).length,
      pending: reconciliations.filter(r => !r.isReconciled).length,
      matched: reconciliations.filter(r => r.excelStatus !== 'Not Found').length,
      notFound: reconciliations.filter(r => r.excelStatus === 'Not Found').length
    };
  }, [reconciliations]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <FileText className="text-teal-600" size={32} />
            Leave Reconciliation
          </h1>
          <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mt-1">
            {absentRecords.length} Absent Records • {reconciliations.length} Loaded • {stats.reconciled} Reconciled
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
            disabled={reconciliations.length === 0}
            className="flex items-center space-x-2 bg-white text-slate-900 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all font-black text-xs uppercase tracking-widest disabled:opacity-50"
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          {isAdmin && (
            <>
              <button
                onClick={handlePushToMonthly}
                disabled={reconciliations.length === 0 || stats.reconciled === 0}
                className="flex items-center space-x-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl hover:bg-teal-700 transition-all font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <Send size={14} />
                <span>Push to Monthly</span>
              </button>

              <label className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl cursor-pointer hover:bg-slate-800 transition-all font-black text-xs uppercase tracking-widest shadow-xl">
                <Upload size={14} />
                <span>Upload Excel</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelUpload}
                  disabled={isProcessing}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Instructions */}
      {reconciliations.length === 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-3xl border border-blue-100">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">How to Use:</h3>
          <ol className="text-sm text-slate-700 space-y-2 ml-4 list-decimal">
            <li>System automatically identifies <strong>{absentRecords.length} absent records</strong> from Logs Audit</li>
            <li>Upload Excel file with columns: Employee Number, Date, Status (and other details)</li>
            <li>Review each record - Excel status will be shown against Absent status</li>
            <li>Accept the status or override it with a comment</li>
            <li>Click "Push to Monthly" to update monthly reports</li>
            <li>Only reconciled records will appear in monthly report, others show as BLANK</li>
          </ol>
        </div>
      )}

      {/* Statistics */}
      {reconciliations.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
            <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Reconciled</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{stats.reconciled}</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
            <p className="text-xs font-black text-amber-600 uppercase tracking-widest">Pending</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100">
            <p className="text-xs font-black text-teal-600 uppercase tracking-widest">Matched</p>
            <p className="text-2xl font-black text-teal-700 mt-1">{stats.matched}</p>
          </div>
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
            <p className="text-xs font-black text-rose-600 uppercase tracking-widest">Not Found</p>
            <p className="text-2xl font-black text-rose-700 mt-1">{stats.notFound}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {reconciliations.length > 0 && (
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
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-100 text-xs font-black py-2.5 pl-3 pr-8 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer transition-all"
              >
                <option value="All">Excel Status: All</option>
                {availableStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
                <option value="Not Found">Not Found</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={12} />
            </div>
          </div>
        </div>
      )}

      {/* Reconciliation Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="overflow-auto max-h-[700px]">
          <table className="w-full text-left table-auto border-collapse">
            <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
              <tr>
                <th className="px-4 py-5">Emp #</th>
                <th className="px-4 py-5">Name</th>
                <th className="px-4 py-5">Department</th>
                <th className="px-4 py-5">Date</th>
                <th className="px-4 py-5">Absent Status</th>
                <th className="px-4 py-5">Excel Status</th>
                <th className="px-4 py-5">Final Status</th>
                <th className="px-4 py-5">Comments</th>
                <th className="px-4 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reconciliations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="text-slate-300" size={48} />
                      <p className="text-sm font-bold text-slate-400">No data loaded</p>
                      <p className="text-xs text-slate-400">
                        {absentRecords.length > 0
                          ? `${absentRecords.length} absent records found. Upload Excel to start reconciliation.`
                          : 'No absent records found in attendance data.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredReconciliations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <p className="text-sm font-bold text-slate-400">No records match your filters</p>
                  </td>
                </tr>
              ) : (
                filteredReconciliations.map((record, idx) => (
                  <tr key={idx} className={`hover:bg-slate-50 transition-colors ${record.isReconciled ? 'bg-emerald-50/30' : ''}`}>
                    <td className="px-4 py-4 text-xs font-black text-slate-900">{record.employeeNumber}</td>
                    <td className="px-4 py-4 text-xs font-black text-teal-600">{record.employeeName}</td>
                    <td className="px-4 py-4 text-xs text-slate-700">{record.department}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-700">{record.date}</td>
                    <td className="px-4 py-4">
                      <span className="px-3 py-1 rounded-full text-[9px] font-black bg-rose-100 text-rose-700 uppercase">
                        {record.absentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                        record.excelStatus === 'Not Found'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {record.excelStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {!record.isReconciled && isAdmin ? (
                        <select
                          value={record.finalStatus}
                          onChange={(e) => handleOverrideStatus(reconciliations.indexOf(record), e.target.value)}
                          className="px-3 py-1 text-[9px] font-black bg-slate-100 text-slate-700 rounded-lg border border-slate-200 cursor-pointer uppercase"
                        >
                          <option value="CL">CL</option>
                          <option value="PL">PL</option>
                          <option value="SL">SL</option>
                          <option value="CO">CO</option>
                          <option value="LOP">LOP</option>
                          <option value="MEL">MEL</option>
                          <option value="A">A</option>
                          <option value="HD">HD</option>
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
                          onChange={(e) => handleCommentChange(reconciliations.indexOf(record), e.target.value)}
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
                            onClick={() => handleAcceptStatus(reconciliations.indexOf(record))}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-xs font-bold"
                            title="Accept Status"
                          >
                            <CheckCircle size={14} />
                            Accept
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle size={14} />
                            Reconciled
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeaveReconciliationOptimized;
