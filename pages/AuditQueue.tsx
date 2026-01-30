
import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  Send,
  ChevronDown,
  Filter,
  Clock,
  Edit3
} from 'lucide-react';
import { AppData, AuditQueueRecord, UserRole, AuditLogEntry } from '../types.ts';
import * as XLSX from 'xlsx';
import { auditLogService } from '../services/auditLogService.ts';

interface AuditQueueProps {
  data: AppData;
  onUpdate: (auditQueue: AuditQueueRecord[], logs: AuditLogEntry[]) => void;
  onPushToMonthly: () => void;
  role: UserRole;
  currentUser: string;
}

const AuditQueue: React.FC<AuditQueueProps> = ({
  data,
  onUpdate,
  onPushToMonthly,
  role,
  currentUser
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending Review' | 'Under Review' | 'Reviewed' | 'Approved' | 'Rejected'>('All');
  const [isProcessing, setIsProcessing] = useState(false);
  const [localQueue, setLocalQueue] = useState<AuditQueueRecord[]>(data.auditQueue || []);
  const [localLogs, setLocalLogs] = useState<AuditLogEntry[]>(data.auditLogs || []);

  // Enhanced workflow states
  const [availableReviewStatuses, setAvailableReviewStatuses] = useState<string[]>([]);
  const [selectedReviewStatuses, setSelectedReviewStatuses] = useState<string[]>([]);
  const [showStatusSelection, setShowStatusSelection] = useState(false);

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

  const addAuditLog = (
    action: AuditLogEntry['action'],
    entityId: string,
    entityName: string,
    previousValue?: string,
    newValue?: string,
    details?: string
  ) => {
    const log = auditLogService.createLogEntry(
      'Audit Queue',
      action,
      'Audit Queue',
      entityId,
      entityName,
      currentUser,
      previousValue,
      newValue,
      details
    );
    setLocalLogs(prev => [...prev, log]);
  };

  // Auto-populate audit queue from attendance records with 'Audit' status
  useEffect(() => {
    if (localQueue.length === 0 && data.attendance.length > 0) {
      const auditRecords = data.attendance
        .filter(att => att.status === 'Audit' || att.deviation)
        .map(att => ({
          id: `${att.employeeNumber}-${att.date}`,
          employeeNumber: att.employeeNumber,
          employeeName: att.employeeName,
          date: att.date,
          department: att.department,
          location: att.location,
          currentStatus: att.status,
          deviation: att.deviation,
          auditReason: att.deviation || 'Flagged for manual review',
          reviewStatus: 'Pending Review' as const,
          remarks: '',
          isPushedToMonthly: false
        }));

      if (auditRecords.length > 0) {
        setLocalQueue(auditRecords);

        // Extract unique review statuses
        const statuses = Array.from(new Set(auditRecords.map(r => r.reviewStatus)));
        setAvailableReviewStatuses(statuses);
      }
    }
  }, [data.attendance, localQueue.length]);

  const handleUploadAuditRecords = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const auditRecords: AuditQueueRecord[] = jsonData.map(row => ({
          id: `${row['Employee Number'] || row['Employee ID']}-${formatDate(row['Date'])}`,
          employeeNumber: String(row['Employee Number'] || row['Employee ID'] || '').trim(),
          employeeName: String(row['Employee Name'] || row['Name'] || '').trim(),
          date: formatDate(row['Date']),
          department: String(row['Department'] || '').trim(),
          location: String(row['Location'] || '').trim(),
          currentStatus: String(row['Current Status'] || row['Status'] || 'Audit').trim(),
          deviation: String(row['Deviation'] || row['Deviation Details'] || '').trim(),
          auditReason: String(row['Audit Reason'] || row['Reason'] || 'Manual review required').trim(),
          reviewStatus: (row['Review Status'] || 'Pending Review') as any,
          updatedStatus: String(row['Updated Status'] || '').trim() || undefined,
          reviewedBy: String(row['Reviewed By'] || '').trim() || undefined,
          reviewedOn: row['Reviewed On'] ? formatDate(row['Reviewed On']) : undefined,
          remarks: String(row['Remarks'] || '').trim() || undefined,
          isPushedToMonthly: false
        })).filter(r => r.employeeNumber);

        setLocalQueue(prev => [...prev, ...auditRecords]);

        // Extract unique review statuses
        const statuses = Array.from(new Set(auditRecords.map(r => r.reviewStatus).filter(s => s)));
        setAvailableReviewStatuses(prev => Array.from(new Set([...prev, ...statuses])));
        setShowStatusSelection(true);

        // Add audit log
        addAuditLog(
          'Upload',
          'BULK',
          `${auditRecords.length} audit records`,
          undefined,
          `${auditRecords.length} records`,
          `Uploaded from ${file.name}`
        );

        alert(`Imported ${auditRecords.length} audit queue records successfully!\n\nAvailable Review Statuses: ${statuses.join(', ')}`);
      } catch (err) {
        console.error(err);
        alert("Failed to import audit records. Please check the file format.");
      } finally {
        setIsProcessing(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUpdateStatus = (record: AuditQueueRecord, newStatus: string) => {
    const updated = localQueue.map(r =>
      r.id === record.id
        ? {
            ...r,
            updatedStatus: newStatus,
            reviewStatus: 'Reviewed' as const,
            reviewedBy: currentUser,
            reviewedOn: formatDate(new Date()),
            remarks: `Status updated from ${r.currentStatus} to ${newStatus} by ${currentUser}`
          }
        : r
    );
    setLocalQueue(updated);

    // Add audit log
    addAuditLog(
      'Status Change',
      record.employeeNumber,
      record.employeeName,
      record.currentStatus,
      newStatus,
      `Date: ${record.date}, Reason: ${record.auditReason}`
    );
  };

  const handleApprove = (record: AuditQueueRecord) => {
    const updated = localQueue.map(r =>
      r.id === record.id
        ? {
            ...r,
            reviewStatus: 'Approved' as const,
            reviewedBy: currentUser,
            reviewedOn: formatDate(new Date()),
            remarks: r.remarks || `Approved by ${currentUser}`
          }
        : r
    );
    setLocalQueue(updated);

    // Add audit log
    addAuditLog(
      'Approve',
      record.employeeNumber,
      record.employeeName,
      record.reviewStatus,
      'Approved',
      `Date: ${record.date}, Updated Status: ${record.updatedStatus || 'N/A'}`
    );
  };

  const handleReject = (record: AuditQueueRecord) => {
    const updated = localQueue.map(r =>
      r.id === record.id
        ? {
            ...r,
            reviewStatus: 'Rejected' as const,
            reviewedBy: currentUser,
            reviewedOn: formatDate(new Date()),
            remarks: r.remarks || `Rejected by ${currentUser}`
          }
        : r
    );
    setLocalQueue(updated);

    // Add audit log
    addAuditLog(
      'Reject',
      record.employeeNumber,
      record.employeeName,
      record.reviewStatus,
      'Rejected',
      `Date: ${record.date}`
    );
  };

  const handleSaveAndPush = () => {
    const approvedCount = localQueue.filter(r => r.reviewStatus === 'Approved' && r.updatedStatus).length;
    const rejectedCount = localQueue.filter(r => r.reviewStatus === 'Rejected').length;
    const pendingCount = localQueue.filter(r => r.reviewStatus === 'Pending Review' || r.reviewStatus === 'Under Review').length;

    if (confirm(`Push audit updates to Monthly Report?\n\n✓ ${approvedCount} approved records will be updated with new status\n✗ ${rejectedCount} rejected records will remain with original status\n⏳ ${pendingCount} pending records will show as blank in Monthly Report\n\nProceed?`)) {
      // Mark approved records with updated status as pushed
      const updatedQueue = localQueue.map(r =>
        r.reviewStatus === 'Approved' && r.updatedStatus
          ? { ...r, isPushedToMonthly: true }
          : { ...r, isPushedToMonthly: false }
      );

      setLocalQueue(updatedQueue);
      onUpdate(updatedQueue, localLogs);

      // Add audit log
      addAuditLog(
        'Push to Monthly',
        'BULK',
        `${approvedCount} approved updates`,
        undefined,
        `Pushed to monthly report`,
        `Total: ${localQueue.length}, Approved: ${approvedCount}, Rejected: ${rejectedCount}, Pending: ${pendingCount}`
      );

      onPushToMonthly();
      alert(`Audit queue updates saved!\n\n✓ ${approvedCount} approved updates pushed to Monthly Report\n✗ ${rejectedCount + pendingCount} other records will show as blank in Monthly Report`);
    }
  };

  const handleExportTemplate = () => {
    const templateData = [
      {
        'Employee Number': 'E001',
        'Employee Name': 'John Doe',
        'Date': '15-JAN-2024',
        'Department': 'Engineering',
        'Location': 'Mumbai',
        'Current Status': 'Audit',
        'Deviation': 'Late In by 45 minutes',
        'Audit Reason': 'Exceeded late threshold',
        'Review Status': 'Pending Review',
        'Updated Status': '',
        'Reviewed By': '',
        'Reviewed On': '',
        'Remarks': ''
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AuditQueueTemplate");
    XLSX.writeFile(wb, "Audit_Queue_Template.xlsx");
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredQueue.map(r => ({
      'Employee Number': r.employeeNumber,
      'Employee Name': r.employeeName,
      'Date': r.date,
      'Department': r.department,
      'Location': r.location,
      'Current Status': r.currentStatus,
      'Deviation': r.deviation || '-',
      'Audit Reason': r.auditReason,
      'Review Status': r.reviewStatus,
      'Updated Status': r.updatedStatus || '-',
      'Reviewed By': r.reviewedBy || '-',
      'Reviewed On': r.reviewedOn || '-',
      'Pushed to Monthly': r.isPushedToMonthly ? 'Yes' : 'No',
      'Remarks': r.remarks || '-'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AuditQueue");
    XLSX.writeFile(wb, "Audit_Queue_Records.xlsx");
  };

  const filteredQueue = useMemo(() => {
    return localQueue.filter(r => {
      const matchSearch = r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         r.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'All' || r.reviewStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [localQueue, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: localQueue.length,
      pending: localQueue.filter(r => r.reviewStatus === 'Pending Review').length,
      underReview: localQueue.filter(r => r.reviewStatus === 'Under Review').length,
      reviewed: localQueue.filter(r => r.reviewStatus === 'Reviewed').length,
      approved: localQueue.filter(r => r.reviewStatus === 'Approved').length,
      rejected: localQueue.filter(r => r.reviewStatus === 'Rejected').length,
      pushed: localQueue.filter(r => r.isPushedToMonthly).length
    };
  }, [localQueue]);

  const toggleStatusSelection = (status: string) => {
    setSelectedReviewStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const selectAllStatuses = () => {
    setSelectedReviewStatuses(availableReviewStatuses);
  };

  const clearAllStatuses = () => {
    setSelectedReviewStatuses([]);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <AlertTriangle className="text-orange-600" size={32} />
            Audit Queue Management
          </h1>
          <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mt-1">
            {localQueue.length} Records in Queue • {stats.approved} Approved • {stats.pushed} Pushed to Monthly
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
                onClick={handleSaveAndPush}
                disabled={localQueue.length === 0}
                className="flex items-center space-x-2 bg-orange-600 text-white px-4 py-2.5 rounded-xl hover:bg-orange-700 transition-all font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <Send size={14} />
                <span>Save & Push to Monthly</span>
              </button>

              <label className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl cursor-pointer hover:bg-slate-800 transition-all font-black text-xs uppercase tracking-widest shadow-xl">
                {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                <span>Import Audit Records</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleUploadAuditRecords}
                  disabled={isProcessing}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Status Selection Panel */}
      {showStatusSelection && selectedReviewStatuses.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 rounded-3xl border border-orange-100 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <Filter className="text-orange-600" size={20} />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              Showing Records with Selected Statuses
            </h3>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            Currently displaying: {selectedReviewStatuses.join(', ')}
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
          <p className="text-xs font-black text-amber-600 uppercase tracking-widest">Pending</p>
          <p className="text-2xl font-black text-amber-700 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
          <p className="text-xs font-black text-blue-600 uppercase tracking-widest">In Review</p>
          <p className="text-2xl font-black text-blue-700 mt-1">{stats.underReview}</p>
        </div>
        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
          <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Reviewed</p>
          <p className="text-2xl font-black text-indigo-700 mt-1">{stats.reviewed}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
          <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Approved</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{stats.approved}</p>
        </div>
        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
          <p className="text-xs font-black text-rose-600 uppercase tracking-widest">Rejected</p>
          <p className="text-2xl font-black text-rose-700 mt-1">{stats.rejected}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
          <p className="text-xs font-black text-purple-600 uppercase tracking-widest">Pushed</p>
          <p className="text-2xl font-black text-purple-700 mt-1">{stats.pushed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none text-xs font-black focus:ring-2 focus:ring-orange-500 transition-all"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full appearance-none bg-slate-50 border border-slate-100 text-xs font-black py-2.5 pl-3 pr-8 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer transition-all"
            >
              <option value="All">Review Status: All</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Under Review">Under Review</option>
              <option value="Reviewed">Reviewed</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={12} />
          </div>
        </div>
      </div>

      {/* Audit Queue Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="overflow-auto max-h-[700px]">
          <table className="w-full text-left table-auto border-collapse">
            <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
              <tr>
                <th className="px-6 py-5">Employee #</th>
                <th className="px-6 py-5">Name</th>
                <th className="px-6 py-5">Date</th>
                <th className="px-6 py-5">Department</th>
                <th className="px-6 py-5">Current Status</th>
                <th className="px-6 py-5">Deviation</th>
                <th className="px-6 py-5">Audit Reason</th>
                <th className="px-6 py-5">Review Status</th>
                <th className="px-6 py-5">Updated Status</th>
                <th className="px-6 py-5">Reviewed By</th>
                <th className="px-6 py-5">Pushed</th>
                {isAdmin && <th className="px-6 py-5 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 12 : 11} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Clock className="text-slate-300" size={48} />
                      <p className="text-sm font-bold text-slate-400">No records in audit queue</p>
                      <p className="text-xs text-slate-400">Records flagged as 'Audit' will appear here automatically</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredQueue.map((record, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-xs font-black text-slate-900">{record.employeeNumber}</td>
                    <td className="px-6 py-4 text-xs font-black text-orange-600">{record.employeeName}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-700">{record.date}</td>
                    <td className="px-6 py-4 text-xs text-slate-700">{record.department}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-[9px] font-black bg-orange-100 text-orange-700 uppercase">
                        {record.currentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">{record.deviation || '-'}</td>
                    <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">{record.auditReason}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                        record.reviewStatus === 'Pending Review' ? 'bg-amber-100 text-amber-700' :
                        record.reviewStatus === 'Under Review' ? 'bg-blue-100 text-blue-700' :
                        record.reviewStatus === 'Reviewed' ? 'bg-indigo-100 text-indigo-700' :
                        record.reviewStatus === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {record.reviewStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {isAdmin && !record.isPushedToMonthly ? (
                        <select
                          value={record.updatedStatus || ''}
                          onChange={(e) => handleUpdateStatus(record, e.target.value)}
                          className="px-3 py-1 text-[9px] font-black bg-slate-100 text-slate-700 rounded-lg border border-slate-200 cursor-pointer uppercase"
                        >
                          <option value="">-- Select --</option>
                          <option value="P">P (Present)</option>
                          <option value="HD">HD (Half Day)</option>
                          <option value="A">A (Absent)</option>
                          <option value="WO">WO (Weekly Off)</option>
                          <option value="H">H (Holiday)</option>
                          <option value="CL">CL</option>
                          <option value="PL">PL</option>
                          <option value="SL">SL</option>
                          <option value="LOP">LOP</option>
                        </select>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black bg-slate-100 text-slate-700 uppercase">
                          {record.updatedStatus || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">{record.reviewedBy || '-'}</td>
                    <td className="px-6 py-4">
                      {record.isPushedToMonthly ? (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black bg-purple-100 text-purple-700 uppercase">
                          ✓ Yes
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black bg-slate-100 text-slate-500 uppercase">
                          No
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 justify-center">
                          {record.reviewStatus === 'Reviewed' && record.updatedStatus && (
                            <>
                              <button
                                onClick={() => handleApprove(record)}
                                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all"
                                title="Approve"
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button
                                onClick={() => handleReject(record)}
                                className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all"
                                title="Reject"
                              >
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                          {record.reviewStatus === 'Approved' && (
                            <span className="text-xs text-emerald-600 font-bold">✓ Approved</span>
                          )}
                          {record.reviewStatus === 'Rejected' && (
                            <span className="text-xs text-rose-600 font-bold">✗ Rejected</span>
                          )}
                          {(record.reviewStatus === 'Pending Review' || record.reviewStatus === 'Under Review') && (
                            <span className="text-xs text-amber-600 font-bold flex items-center gap-1">
                              <Edit3 size={12} />
                              Update Status
                            </span>
                          )}
                        </div>
                      </td>
                    )}
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

export default AuditQueue;
