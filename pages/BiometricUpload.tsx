
import React, { useState, useMemo } from 'react';
import {
  Search,
  Loader2,
  Fingerprint,
  FileSpreadsheet,
  Eraser,
  Download,
  FileDown,
  Info,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { AppData, AttendanceRecord } from '../types.ts';
import * as XLSX from 'xlsx';

interface BiometricUploadProps {
  data: AppData;
  onConsolidatedData: (records: AttendanceRecord[]) => void;
}

interface RawBiometricRecord {
  [key: string]: any;
}

interface ColumnMapping {
  biometricId: string;
  name: string;
  date: string;
  inTime: string;
  outTime: string;
  device: string;
  direction: string;
}

interface ConsolidatedRecord extends AttendanceRecord {
  device?: string;
}

const BiometricUpload: React.FC<BiometricUploadProps> = ({ data, onConsolidatedData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawData, setRawData] = useState<RawBiometricRecord[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    biometricId: '',
    name: '',
    date: '',
    inTime: '',
    outTime: '',
    device: '',
    direction: ''
  });
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [consolidatedRecords, setConsolidatedRecords] = useState<ConsolidatedRecord[]>([]);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    matched: number;
    unmatched: number;
    unmatchedBiometrics: string[];
    format: 'single-row' | 'dual-row' | 'unknown';
    batchNumber: number;
  } | null>(null);
  const [totalBatches, setTotalBatches] = useState(0);

  const formatDate = (date: any): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      // Try parsing string formats
      const dateStr = String(date).trim();
      return dateStr;
    }
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatTime = (time: any): string => {
    if (!time) return '';
    if (typeof time === 'string') {
      const cleaned = time.trim().toUpperCase();
      if (cleaned === 'NA' || cleaned === 'N/A' || cleaned === '-') return '';
      return time.trim();
    }

    // Handle Excel time format (fraction of a day)
    if (typeof time === 'number' && time < 1) {
      const totalMinutes = Math.round(time * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Handle Date object
    if (time instanceof Date) {
      return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    }

    return String(time);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws) as RawBiometricRecord[];

        if (jsonData.length === 0) {
          alert("No data found in the file.");
          setIsProcessing(false);
          return;
        }

        // Extract column headers
        const columns = Object.keys(jsonData[0]);
        setAvailableColumns(columns);
        setRawData(jsonData);

        // Auto-detect common column names
        const autoMapping: ColumnMapping = {
          biometricId: columns.find(c =>
            /bio.*id|bio.*num|employee.*id|emp.*id|staff.*id|id|badge/i.test(c)
          ) || '',
          name: columns.find(c =>
            /name|employee.*name/i.test(c)
          ) || '',
          date: columns.find(c =>
            /date|attendance.*date|punch.*date/i.test(c)
          ) || '',
          inTime: columns.find(c =>
            /in.*time|check.*in|first.*punch|entry.*time|time.*in/i.test(c)
          ) || '',
          outTime: columns.find(c =>
            /out.*time|check.*out|last.*punch|exit.*time|time.*out/i.test(c)
          ) || '',
          device: columns.find(c =>
            /device|terminal|machine|location/i.test(c)
          ) || '',
          direction: columns.find(c =>
            /direction|type|status|in.*out/i.test(c)
          ) || ''
        };

        setColumnMapping(autoMapping);
        setShowMappingModal(true);
        setIsProcessing(false);

      } catch (err) {
        console.error(err);
        alert("Failed to read file. Please ensure it's a valid Excel/CSV file.");
        setIsProcessing(false);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const detectFormatAndConsolidate = () => {
    if (!columnMapping.biometricId || !columnMapping.date) {
      alert("Please map at least Biometric ID and Date columns.");
      return;
    }

    setIsProcessing(true);

    try {
      // Determine format based on presence of both In and Out times
      const hasInTime = columnMapping.inTime && rawData.some(row => row[columnMapping.inTime]);
      const hasOutTime = columnMapping.outTime && rawData.some(row => row[columnMapping.outTime]);
      const hasDirection = columnMapping.direction && rawData.some(row => row[columnMapping.direction]);

      let format: 'single-row' | 'dual-row' | 'unknown' = 'unknown';

      if (hasInTime && hasOutTime && !hasDirection) {
        format = 'single-row';
      } else if (hasDirection) {
        format = 'dual-row';
      }

      // Create biometric to employee mapping
      const bioToEmpMap = new Map<string, any>();
      data.employees.forEach(emp => {
        if (emp.biometricNumber) {
          bioToEmpMap.set(emp.biometricNumber.trim().toUpperCase(), emp);
        }
      });

      let consolidated: ConsolidatedRecord[] = [];
      const unmatchedBiometrics = new Set<string>();
      let matchedCount = 0;

      if (format === 'single-row') {
        // Format 1: In & Out in same row
        rawData.forEach(row => {
          const bioId = String(row[columnMapping.biometricId] || '').trim();
          if (!bioId) return;

          const bioKey = bioId.toUpperCase();
          const employee = bioToEmpMap.get(bioKey);
          const dateVal = formatDate(row[columnMapping.date]);
          const inTimeVal = columnMapping.inTime ? formatTime(row[columnMapping.inTime]) : '';
          const outTimeVal = columnMapping.outTime ? formatTime(row[columnMapping.outTime]) : '';
          const deviceVal = columnMapping.device ? String(row[columnMapping.device] || '') : '';

          if (employee) {
            matchedCount++;
            consolidated.push({
              employeeNumber: employee.employeeNumber,
              employeeName: employee.fullName,
              jobTitle: employee.jobTitle,
              businessUnit: employee.businessUnit,
              department: employee.department,
              subDepartment: employee.subDepartment,
              location: employee.location,
              costCenter: employee.costCenter,
              reportingManager: employee.reportingTo,
              legalEntity: employee.legalEntity,
              date: dateVal,
              shift: '',
              shiftStart: '',
              inTime: inTimeVal,
              lateBy: '',
              shiftEnd: '',
              outTime: outTimeVal,
              earlyBy: '',
              status: '',
              effectiveHours: '',
              totalHours: '',
              breakDuration: '',
              overTime: '',
              totalShortHoursEffective: '',
              totalShortHoursGross: '',
              device: deviceVal
            });
          } else {
            unmatchedBiometrics.add(bioId);
          }
        });
      } else if (format === 'dual-row') {
        // Format 2: In & Out in separate rows with direction
        const punchMap = new Map<string, { in?: string; out?: string; device?: string }>();

        rawData.forEach(row => {
          const bioId = String(row[columnMapping.biometricId] || '').trim();
          if (!bioId) return;

          const dateVal = formatDate(row[columnMapping.date]);
          const direction = columnMapping.direction ? String(row[columnMapping.direction] || '').toLowerCase() : '';
          const timeVal = columnMapping.inTime ? formatTime(row[columnMapping.inTime]) :
                         columnMapping.outTime ? formatTime(row[columnMapping.outTime]) : '';
          const deviceVal = columnMapping.device ? String(row[columnMapping.device] || '') : '';

          const key = `${bioId}|${dateVal}`;

          if (!punchMap.has(key)) {
            punchMap.set(key, {});
          }

          const record = punchMap.get(key)!;

          // Detect direction
          if (direction.includes('in') || direction.includes('entry') || direction === 'i') {
            record.in = timeVal;
            record.device = deviceVal;
          } else if (direction.includes('out') || direction.includes('exit') || direction === 'o') {
            record.out = timeVal;
            if (!record.device) record.device = deviceVal;
          } else {
            // If no clear direction, use time comparison (earlier = in, later = out)
            if (!record.in) {
              record.in = timeVal;
              record.device = deviceVal;
            } else if (!record.out) {
              record.out = timeVal;
            }
          }
        });

        // Convert map to consolidated records
        punchMap.forEach((punches, key) => {
          const [bioId, dateVal] = key.split('|');
          const bioKey = bioId.toUpperCase();
          const employee = bioToEmpMap.get(bioKey);

          if (employee) {
            matchedCount++;
            consolidated.push({
              employeeNumber: employee.employeeNumber,
              employeeName: employee.fullName,
              jobTitle: employee.jobTitle,
              businessUnit: employee.businessUnit,
              department: employee.department,
              subDepartment: employee.subDepartment,
              location: employee.location,
              costCenter: employee.costCenter,
              reportingManager: employee.reportingTo,
              legalEntity: employee.legalEntity,
              date: dateVal,
              shift: '',
              shiftStart: '',
              inTime: punches.in || '',
              lateBy: '',
              shiftEnd: '',
              outTime: punches.out || '',
              earlyBy: '',
              status: '',
              effectiveHours: '',
              totalHours: '',
              breakDuration: '',
              overTime: '',
              totalShortHoursEffective: '',
              totalShortHoursGross: '',
              device: punches.device || ''
            });
          } else {
            unmatchedBiometrics.add(bioId);
          }
        });
      }

      // Append new records to existing consolidated records
      setConsolidatedRecords(prev => [...prev, ...consolidated]);
      const newBatchNumber = totalBatches + 1;
      setTotalBatches(newBatchNumber);
      setImportSummary({
        total: rawData.length,
        matched: matchedCount,
        unmatched: unmatchedBiometrics.size,
        unmatchedBiometrics: Array.from(unmatchedBiometrics),
        format,
        batchNumber: newBatchNumber
      });
      setShowMappingModal(false);

    } catch (err) {
      console.error(err);
      alert("Error processing data. Please check your column mappings.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportTemplate = () => {
    const template1 = [
      {
        'Format 1 - Single Row': '',
        'Biometric ID': '12345',
        'Name': 'John Doe',
        'Date': '01-JAN-2024',
        'In Time': '09:00',
        'Out Time': '18:00',
        'Device': 'Terminal 1'
      }
    ];

    const template2 = [
      {
        'Format 2 - Dual Row': '',
        'Biometric ID': '12345',
        'Name': 'John Doe',
        'Date': '01-JAN-2024',
        'Time': '09:00',
        'Direction': 'IN',
        'Device': 'Terminal 1'
      },
      {
        'Format 2 - Dual Row': '',
        'Biometric ID': '12345',
        'Name': 'John Doe',
        'Date': '01-JAN-2024',
        'Time': '18:00',
        'Direction': 'OUT',
        'Device': 'Terminal 1'
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(template1);
    const ws2 = XLSX.utils.json_to_sheet(template2);
    XLSX.utils.book_append_sheet(wb, ws1, "Format 1");
    XLSX.utils.book_append_sheet(wb, ws2, "Format 2");
    XLSX.writeFile(wb, "Biometric_Import_Templates.xlsx");
  };

  const handleExportConsolidated = () => {
    if (consolidatedRecords.length === 0) {
      alert("No consolidated data to export.");
      return;
    }

    const exportRows = consolidatedRecords.map(rec => ({
      'Employee Number': rec.employeeNumber,
      'Employee Name': rec.employeeName,
      'Date': rec.date,
      'In Time': rec.inTime,
      'Out Time': rec.outTime,
      'Device': rec.device || '',
      'Job Title': rec.jobTitle,
      'Business Unit': rec.businessUnit,
      'Department': rec.department,
      'Sub Department': rec.subDepartment,
      'Location': rec.location,
      'Cost Center': rec.costCenter,
      'Reporting Manager': rec.reportingManager,
      'Legal Entity': rec.legalEntity
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consolidated");
    XLSX.writeFile(wb, `Biometric_Consolidated_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePushToAttendance = () => {
    if (consolidatedRecords.length === 0) {
      alert("No consolidated records to push.");
      return;
    }
    onConsolidatedData(consolidatedRecords);
    alert(`Successfully pushed ${consolidatedRecords.length} records to Attendance module for processing.`);
  };

  const filtered = useMemo(() => {
    return consolidatedRecords.filter(rec =>
      (rec.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.employeeNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [consolidatedRecords, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Fingerprint className="text-teal-600" size={32} />
            Biometric Consolidation
          </h1>
          <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mt-1">
            Import & Map Biometric Device Dumps
          </p>
        </div>

        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <button
            onClick={handleExportTemplate}
            className="flex items-center space-x-2 bg-white text-slate-600 border border-slate-200 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-all font-black text-xs uppercase tracking-widest"
          >
            <FileDown size={18} />
            <span>Templates</span>
          </button>

          <button
            onClick={handleExportConsolidated}
            disabled={consolidatedRecords.length === 0}
            className={`flex items-center space-x-2 px-4 py-3 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${
              consolidatedRecords.length > 0
                ? 'bg-white text-teal-600 border border-teal-100 hover:bg-teal-50'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            <Download size={18} />
            <span>Export</span>
          </button>

          <button
            onClick={handlePushToAttendance}
            disabled={consolidatedRecords.length === 0}
            className={`flex items-center space-x-2 px-6 py-3 rounded-2xl transition-all font-black text-xs uppercase tracking-widest shadow-lg ${
              consolidatedRecords.length > 0
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 size={18} />
            <span>Push to Attendance</span>
          </button>

          <button
            onClick={() => {
              if(confirm("Clear all biometric data? This action cannot be undone.")) {
                setRawData([]);
                setConsolidatedRecords([]);
                setImportSummary(null);
                setShowMappingModal(false);
                setTotalBatches(0);
              }
            }}
            className="flex items-center space-x-2 bg-rose-50 text-rose-600 border border-rose-100 px-4 py-3 rounded-2xl hover:bg-rose-100 transition-all font-black text-xs uppercase tracking-widest"
          >
            <Eraser size={18} />
            <span>Clear</span>
          </button>

          <label className={`flex items-center space-x-2 bg-slate-900 text-white px-8 py-3 rounded-2xl cursor-pointer hover:bg-slate-800 transition-all shadow-xl ${isProcessing ? 'opacity-50' : ''}`}>
            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
            <span className="font-bold text-xs uppercase tracking-widest">Import Biometric</span>
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} disabled={isProcessing} />
          </label>
        </div>
      </div>

      {/* Column Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-gradient-to-r from-teal-600 to-cyan-600 p-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <ArrowRight size={24} />
                  Map Your Columns
                </h2>
                <button
                  onClick={() => setShowMappingModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-all"
                >
                  <X className="text-white" size={20} />
                </button>
              </div>
              <p className="text-teal-100 text-sm mt-2">
                {rawData.length} records detected. Map columns to consolidate attendance data.
              </p>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { key: 'biometricId', label: 'Biometric ID', required: true, description: 'Unique employee biometric identifier' },
                  { key: 'name', label: 'Employee Name', required: false, description: 'Employee name (optional)' },
                  { key: 'date', label: 'Date', required: true, description: 'Attendance date' },
                  { key: 'inTime', label: 'In Time', required: false, description: 'Check-in time (or single Time column)' },
                  { key: 'outTime', label: 'Out Time', required: false, description: 'Check-out time' },
                  { key: 'device', label: 'Device', required: false, description: 'Terminal/device name' },
                  { key: 'direction', label: 'Direction', required: false, description: 'IN/OUT indicator (for dual-row format)' }
                ].map(field => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      {field.label}
                      {field.required && <span className="text-rose-500">*</span>}
                    </label>
                    <select
                      value={(columnMapping as any)[field.key]}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
                    >
                      <option value="">-- Select Column --</option>
                      {availableColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">{field.description}</p>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <h3 className="text-xs font-black text-amber-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Info size={16} />
                  Format Detection
                </h3>
                <ul className="space-y-1 text-xs text-amber-800">
                  <li><strong>Format 1:</strong> If you have In Time and Out Time columns (no Direction), system uses single-row format</li>
                  <li><strong>Format 2:</strong> If you have Direction column (IN/OUT), system consolidates separate punch records</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={detectFormatAndConsolidate}
                  disabled={!columnMapping.biometricId || !columnMapping.date || isProcessing}
                  className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    columnMapping.biometricId && columnMapping.date && !isProcessing
                      ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Process & Consolidate
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowMappingModal(false)}
                  className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {importSummary && (
        <div className={`px-6 py-4 rounded-3xl shadow-xl flex flex-col gap-3 animate-in slide-in-from-right-4 duration-500 ${
          importSummary.unmatched > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-teal-600'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {importSummary.unmatched > 0 ? (
                <AlertCircle className="text-amber-600" size={20} />
              ) : (
                <Info className="text-white" size={20} />
              )}
              <div>
                <span className={`text-sm font-black uppercase tracking-widest block ${
                  importSummary.unmatched > 0 ? 'text-amber-900' : 'text-white'
                }`}>
                  {consolidatedRecords.length} Total Records | Batch #{importSummary.batchNumber}: {importSummary.matched} Matched | {importSummary.unmatched} Unmatched
                </span>
                <span className={`text-xs font-bold ${
                  importSummary.unmatched > 0 ? 'text-amber-700' : 'text-teal-100'
                }`}>
                  Format: {importSummary.format === 'single-row' ? 'Single Row (In & Out same row)' :
                           importSummary.format === 'dual-row' ? 'Dual Row (Separate In/Out punches)' :
                           'Auto-detected'}
                  {totalBatches > 1 && ` • ${totalBatches} batches imported`}
                </span>
              </div>
            </div>
            <button
              onClick={() => setImportSummary(null)}
              className={`p-1 rounded-full transition-all ${
                importSummary.unmatched > 0 ? 'hover:bg-amber-200' : 'hover:bg-white/20'
              }`}
            >
              <X size={16} className={importSummary.unmatched > 0 ? 'text-amber-600' : 'text-white'} />
            </button>
          </div>

          {importSummary.unmatched > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-amber-200">
              <p className="text-xs font-black text-amber-900 uppercase tracking-widest mb-2">
                Unmatched Biometric Numbers:
              </p>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-auto">
                {importSummary.unmatchedBiometrics.map((bioNum, idx) => (
                  <span key={idx} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-mono">
                    {bioNum}
                  </span>
                ))}
              </div>
              <p className="text-xs text-amber-700 mt-3 font-medium">
                Please update Employee Master with these biometric numbers before importing again.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search consolidated records by Employee ID/Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-3xl outline-none text-sm font-black shadow-sm"
        />
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden flex flex-col h-[700px]">
        <div className="overflow-auto flex-1 scrollbar-thin">
          <table className="w-full text-left table-auto min-w-max border-collapse">
            <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
              <tr>
                <th className="px-6 py-5 sticky left-0 bg-slate-900 z-50 border-r border-slate-800">Employee Number</th>
                <th className="px-6 py-5 sticky left-[150px] bg-slate-900 z-50 border-r border-slate-800">Employee Name</th>
                <th className="px-6 py-5">Date</th>
                <th className="px-6 py-5">In Time</th>
                <th className="px-6 py-5">Out Time</th>
                <th className="px-6 py-5">Device</th>
                <th className="px-6 py-5">Job Title</th>
                <th className="px-6 py-5">Business Unit</th>
                <th className="px-6 py-5">Department</th>
                <th className="px-6 py-5">Location</th>
                <th className="px-6 py-5 border-r border-slate-800">Cost Center</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((rec, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 text-xs font-black text-slate-900">
                    {rec.employeeNumber}
                  </td>
                  <td className="px-6 py-4 sticky left-[150px] bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 text-xs font-black text-teal-600">
                    {rec.employeeName}
                  </td>
                  <td className="px-6 py-4 text-[10px] font-mono text-slate-600 uppercase">{rec.date}</td>
                  <td className="px-6 py-4 text-[10px] font-mono text-emerald-600 font-bold">{rec.inTime || '-'}</td>
                  <td className="px-6 py-4 text-[10px] font-mono text-rose-600 font-bold">{rec.outTime || '-'}</td>
                  <td className="px-6 py-4 text-[10px] font-medium text-slate-500">{rec.device || '-'}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-700">{rec.jobTitle}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-800">{rec.businessUnit}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-900">{rec.department}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-600">{rec.location}</td>
                  <td className="px-6 py-4 text-[10px] font-medium text-slate-500 border-r border-slate-100">{rec.costCenter}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-8 py-32 text-center text-slate-300 font-black uppercase tracking-[0.2em] text-xs bg-slate-50/30">
                    {consolidatedRecords.length === 0 ? 'Import biometric dump to begin' : 'No results for this search'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-3xl p-6 border border-teal-100">
        <h3 className="text-xs font-black text-teal-900 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Info size={16} />
          How It Works
        </h3>
        <ul className="space-y-2 text-xs text-slate-700">
          <li className="flex items-start gap-2">
            <span className="text-teal-600 font-black">1.</span>
            <span>Import biometric device dump (Excel/CSV) - supports both single-row and dual-row formats</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-teal-600 font-black">2.</span>
            <span>Map columns: Biometric ID, Date are required. Map In Time, Out Time, or Direction based on your format</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-teal-600 font-black">3.</span>
            <span>System auto-detects format and consolidates In/Out punches from separate rows if applicable</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-teal-600 font-black">4.</span>
            <span>Biometric IDs are mapped to employees - review matched/unmatched statistics</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-teal-600 font-black">5.</span>
            <span>Push consolidated data to Attendance module for shift assignment and calculations</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default BiometricUpload;
