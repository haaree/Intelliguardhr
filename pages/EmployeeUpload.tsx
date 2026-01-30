
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Loader2,
  Users2,
  FileSpreadsheet,
  Eraser,
  RefreshCw,
  Check,
  X,
  Download,
  FileDown,
  Filter,
  ChevronDown,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { Employee, AppData } from '../types.ts';
import * as XLSX from 'xlsx';

interface EmployeeUploadProps {
  data: AppData;
  onUpdate: (employees: Employee[]) => void;
}

const EmployeeUpload: React.FC<EmployeeUploadProps> = ({ data, onUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'Active' | 'Inactive'>('Active');
  const [isUploading, setIsUploading] = useState(false);
  const [localEmployees, setLocalEmployees] = useState<Employee[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [importSummary, setImportSummary] = useState<{ added: number; updated: number } | null>(null);

  // Advanced Filter State
  const [advancedFilters, setAdvancedFilters] = useState({
    businessUnit: 'All',
    department: 'All',
    location: 'All',
    band: 'All',
    legalEntity: 'All'
  });

  useEffect(() => {
    if (!isDirty) {
      setLocalEmployees(data.employees || []);
    }
  }, [data.employees, isDirty]);

  useEffect(() => {
    if (isDirty) {
      setIsAutosaving(true);
      const timer = setTimeout(() => {
        onUpdate(localEmployees);
        setIsDirty(false);
        setIsAutosaving(false);
      }, 1500); 
      return () => clearTimeout(timer);
    }
  }, [localEmployees, isDirty, onUpdate]);

  const filterOptions = useMemo(() => ({
    businessUnit: ['All', ...new Set(localEmployees.map(e => e.businessUnit))].filter(Boolean),
    department: ['All', ...new Set(localEmployees.map(e => e.department))].filter(Boolean),
    location: ['All', ...new Set(localEmployees.map(e => e.location))].filter(Boolean),
    band: ['All', ...new Set(localEmployees.map(e => e.band))].filter(Boolean),
    legalEntity: ['All', ...new Set(localEmployees.map(e => e.legalEntity))].filter(Boolean),
  }), [localEmployees]);

  const filtered = useMemo(() => {
    return localEmployees.filter(e => {
      const matchTab = activeTab === 'Active' ? e.activeStatus === 'Active' : e.activeStatus !== 'Active';
      const matchSearch = (e.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.employeeNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchBU = advancedFilters.businessUnit === 'All' || e.businessUnit === advancedFilters.businessUnit;
      const matchDept = advancedFilters.department === 'All' || e.department === advancedFilters.department;
      const matchLoc = advancedFilters.location === 'All' || e.location === advancedFilters.location;
      const matchBand = advancedFilters.band === 'All' || e.band === advancedFilters.band;
      const matchEntity = advancedFilters.legalEntity === 'All' || e.legalEntity === advancedFilters.legalEntity;

      return matchTab && matchSearch && matchBU && matchDept && matchLoc && matchBand && matchEntity;
    });
  }, [localEmployees, activeTab, searchTerm, advancedFilters]);

  const formatDate = (date: any): string => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const parseBool = (val: any) => {
    if (val === undefined || val === null) return false;
    if (typeof val === 'boolean') return val;
    const s = String(val).toLowerCase().trim();
    return s === 'yes' || s === 'y' || s === 'true' || s === '1';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setImportSummary(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
        
        // Use a Map to ensure employeeNumber uniqueness (Case-Insensitive check)
        const currentMap = new Map<string, Employee>();
        localEmployees.forEach(emp => {
          currentMap.set(emp.employeeNumber.toUpperCase().trim(), emp);
        });

        let added = 0;
        let updated = 0;

        jsonData.forEach((row: any) => {
          const rawId = String(row['Employee Number'] || row['ID'] || row['Staff ID'] || '').trim();
          if (!rawId) return;

          const empIdKey = rawId.toUpperCase();
          const isUpdate = currentMap.has(empIdKey);
          
          if (isUpdate) updated++; else added++;

          currentMap.set(empIdKey, {
            employeeNumber: rawId, // Keep original casing for display if preferred, or use rawId.toUpperCase()
            fullName: row['Full Name'] || row['Name'] || (isUpdate ? currentMap.get(empIdKey)!.fullName : 'New Employee'),
            email: row['Email'] || (isUpdate ? currentMap.get(empIdKey)!.email : ''),
            dateOfJoining: formatDate(row['Date of Joining'] || row['DOJ'] || (isUpdate ? currentMap.get(empIdKey)!.dateOfJoining : '')),
            jobTitle: row['Job Title'] || (isUpdate ? currentMap.get(empIdKey)!.jobTitle : ''),
            businessUnit: row['Business Unit'] || (isUpdate ? currentMap.get(empIdKey)!.businessUnit : ''),
            department: row['Department'] || (isUpdate ? currentMap.get(empIdKey)!.department : ''),
            subDepartment: row['Sub Department'] || (isUpdate ? currentMap.get(empIdKey)!.subDepartment : ''),
            location: row['Location'] || (isUpdate ? currentMap.get(empIdKey)!.location : ''),
            costCenter: row['Cost Center'] || (isUpdate ? currentMap.get(empIdKey)!.costCenter : ''),
            legalEntity: row['Legal Entity'] || (isUpdate ? currentMap.get(empIdKey)!.legalEntity : ''),
            band: row['Band'] || (isUpdate ? currentMap.get(empIdKey)!.band : ''),
            reportingTo: row['Reporting To'] || (isUpdate ? currentMap.get(empIdKey)!.reportingTo : ''),
            dottedLineManager: row['Dotted Line Manager'] || (isUpdate ? currentMap.get(empIdKey)!.dottedLineManager : ''),
            activeStatus: row['Active Status'] || (isUpdate ? currentMap.get(empIdKey)!.activeStatus : 'Active'),
            resignationDate: formatDate(row['Resignation Date'] || (isUpdate ? currentMap.get(empIdKey)!.resignationDate : null)),
            leftDate: formatDate(row['Left Date'] || (isUpdate ? currentMap.get(empIdKey)!.leftDate : null)),
            contractId: row['Contract ID'] || (isUpdate ? currentMap.get(empIdKey)!.contractId : ''),
            excludeFromWorkhoursCalculation: parseBool(row['WH Excl'] || row['Exclude From Workhours'] || (isUpdate ? currentMap.get(empIdKey)!.excludeFromWorkhoursCalculation : false)),
            otEligible: parseBool(row['OT'] || row['OT Eligible'] || (isUpdate ? currentMap.get(empIdKey)!.otEligible : false)),
            compOffEligible: parseBool(row['CompOff'] || row['Comp Off Eligible'] || (isUpdate ? currentMap.get(empIdKey)!.compOffEligible : false)),
            lateExemption: parseBool(row['Late Exm'] || row['Late Exemption'] || (isUpdate ? currentMap.get(empIdKey)!.lateExemption : false)),
            shiftDeviationAllowed: parseBool(row['Dev Allow'] || row['Shift Deviation'] || (isUpdate ? currentMap.get(empIdKey)!.shiftDeviationAllowed : false)),
            status: row['Status'] || (isUpdate ? currentMap.get(empIdKey)!.status : 'Permanent'),
            biometricNumber: row['Biometric Number'] || (isUpdate ? currentMap.get(empIdKey)!.biometricNumber : '')
          });
        });

        setLocalEmployees(Array.from(currentMap.values()));
        setIsDirty(true);
        setImportSummary({ added, updated });
        setTimeout(() => setImportSummary(null), 5000); // Clear summary after 5s
      } catch (err) {
        console.error(err);
        alert("Import failed. Please ensure the file matches the required template.");
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportTemplate = () => {
    const headers = [
      {
        'Employee Number': '',
        'Full Name': '',
        'Email': '',
        'Date of Joining': 'DD-MMM-YYYY',
        'Job Title': '',
        'Business Unit': '',
        'Department': '',
        'Sub Department': '',
        'Location': '',
        'Cost Center': '',
        'Legal Entity': '',
        'Band': '',
        'Reporting To': '',
        'Dotted Line Manager': '',
        'Active Status': 'Active/Inactive',
        'WH Excl': 'Yes/No',
        'OT': 'Yes/No',
        'CompOff': 'Yes/No',
        'Late Exm': 'Yes/No',
        'Dev Allow': 'Yes/No',
        'Biometric Number': ''
      }
    ];
    const ws = XLSX.utils.json_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Employee_Import_Template.xlsx");
  };

  const handleExportData = () => {
    if (filtered.length === 0) {
      alert("No matching data to export for current filter.");
      return;
    }
    const exportRows = filtered.map(emp => ({
      'Employee Number': emp.employeeNumber,
      'Full Name': emp.fullName,
      'Email': emp.email,
      'Date of Joining': emp.dateOfJoining,
      'Job Title': emp.jobTitle,
      'Business Unit': emp.businessUnit,
      'Department': emp.department,
      'Sub Department': emp.subDepartment,
      'Location': emp.location,
      'Cost Center': emp.costCenter,
      'Legal Entity': emp.legalEntity,
      'Band': emp.band,
      'Reporting To': emp.reportingTo,
      'Dotted Line Manager': emp.dottedLineManager,
      'Active Status': emp.activeStatus,
      'WH Excl': emp.excludeFromWorkhoursCalculation ? 'Yes' : 'No',
      'OT': emp.otEligible ? 'Yes' : 'No',
      'CompOff': emp.compOffEligible ? 'Yes' : 'No',
      'Late Exm': emp.lateExemption ? 'Yes' : 'No',
      'Dev Allow': emp.shiftDeviationAllowed ? 'Yes' : 'No',
      'Biometric Number': emp.biometricNumber
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, `Employee_Filtered_Database_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const resetFilters = () => {
    setAdvancedFilters({
      businessUnit: 'All',
      department: 'All',
      location: 'All',
      band: 'All',
      legalEntity: 'All'
    });
    setSearchTerm('');
  };

  const hasActiveAdvancedFilters = Object.values(advancedFilters).some(v => v !== 'All');

  const StatusTick = ({ val }: { val: boolean }) => (
    <div className="flex justify-center">
      {val ? <Check className="text-teal-600" size={14} strokeWidth={3} /> : <X className="text-slate-200" size={14} />}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users2 className="text-teal-600" size={32} />
            Employee Database
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500 font-medium text-xs uppercase tracking-widest">
              Filtered View: {filtered.length} / Total: {localEmployees.length}
            </p>
            {isAutosaving && (
              <span className="flex items-center gap-1 text-[10px] text-teal-600 font-black uppercase tracking-widest bg-teal-50 px-2 py-0.5 rounded animate-pulse">
                <RefreshCw size={10} className="animate-spin" />
                Auto-syncing...
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto flex-wrap gap-y-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Quick Search ID/Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-xs font-black shadow-sm"
            />
          </div>

          <button 
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center space-x-2 px-5 py-3 rounded-2xl transition-all font-black text-xs uppercase tracking-widest border shadow-sm ${showAdvancedFilters ? 'bg-slate-900 text-white border-slate-900' : hasActiveAdvancedFilters ? 'bg-teal-50 text-teal-600 border-teal-200' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            <SlidersHorizontal size={18} />
            <span className="hidden lg:inline">Filters</span>
          </button>
          
          <button 
            onClick={handleExportTemplate}
            className="flex items-center space-x-2 bg-white text-slate-600 border border-slate-200 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-all font-black text-xs uppercase tracking-widest"
          >
            <FileDown size={18} />
            <span className="hidden lg:inline">Template</span>
          </button>

          <button 
            onClick={handleExportData}
            className="flex items-center space-x-2 bg-white text-teal-600 border border-teal-100 px-4 py-3 rounded-2xl hover:bg-teal-50 transition-all font-black text-xs uppercase tracking-widest"
          >
            <Download size={18} />
            <span className="hidden lg:inline">Export Filtered</span>
          </button>

          <button 
            onClick={() => { if(confirm("Clear master database? This action cannot be undone.")) { setLocalEmployees([]); setIsDirty(true); } }}
            className="flex items-center space-x-2 bg-rose-50 text-rose-600 border border-rose-100 px-4 py-3 rounded-2xl hover:bg-rose-100 transition-all font-black text-xs uppercase tracking-widest"
          >
            <Eraser size={18} />
            <span className="hidden lg:inline">Clear Table</span>
          </button>

          <label className={`flex items-center space-x-2 bg-slate-900 text-white px-8 py-3 rounded-2xl cursor-pointer hover:bg-slate-800 transition-all shadow-xl ${isUploading ? 'opacity-50' : ''}`}>
            {isUploading ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
            <span className="font-bold text-xs uppercase tracking-widest">Import Master</span>
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {importSummary && (
        <div className="bg-teal-600 text-white px-6 py-4 rounded-3xl shadow-xl flex items-center justify-between animate-in slide-in-from-right-4 duration-500">
          <div className="flex items-center gap-3">
            <Info size={20} />
            <span className="text-sm font-black uppercase tracking-widest">
              Import Success: {importSummary.added} New Entries Added, {importSummary.updated} Existing Entries Updated.
            </span>
          </div>
          <button onClick={() => setImportSummary(null)} className="p-1 hover:bg-white/20 rounded-full transition-all">
            <X size={16} />
          </button>
        </div>
      )}

      {showAdvancedFilters && (
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
              <Filter size={14} />
              Advanced Data Matrix
            </h3>
            <button onClick={resetFilters} className="text-[10px] font-black text-rose-600 uppercase tracking-widest hover:bg-rose-50 px-3 py-1 rounded-lg transition-all">
              Reset All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { label: 'Business Unit', key: 'businessUnit', opts: filterOptions.businessUnit },
              { label: 'Department', key: 'department', opts: filterOptions.department },
              { label: 'Location', key: 'location', opts: filterOptions.location },
              { label: 'Band', key: 'band', opts: filterOptions.band },
              { label: 'Legal Entity', key: 'legalEntity', opts: filterOptions.legalEntity },
            ].map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{f.label}</label>
                <div className="relative">
                  <select 
                    value={(advancedFilters as any)[f.key]} 
                    onChange={e => setAdvancedFilters({...advancedFilters, [f.key]: e.target.value})}
                    className={`w-full appearance-none text-[10px] font-black bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer p-3 uppercase pr-10 ${ (advancedFilters as any)[f.key] !== 'All' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'text-slate-700' }`}
                  >
                    {f.opts.map(opt => <option key={opt} value={opt}>{opt === 'All' ? `All ${f.label}s` : opt}</option>)}
                  </select>
                  <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${ (advancedFilters as any)[f.key] !== 'All' ? 'text-teal-400' : 'text-slate-400' }`} size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1 p-1 bg-slate-200/50 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('Active')} 
            className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'Active' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Active ({localEmployees.filter(e => e.activeStatus === 'Active').length})
          </button>
          <button 
            onClick={() => setActiveTab('Inactive')} 
            className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'Inactive' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Inactive ({localEmployees.filter(e => e.activeStatus !== 'Active').length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden flex flex-col h-[700px]">
        <div className="overflow-auto flex-1 scrollbar-thin">
          <table className="w-full text-left table-auto min-w-max border-collapse">
            <thead className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest sticky top-0 z-40">
              <tr>
                <th className="px-6 py-5 sticky left-0 bg-slate-900 z-50 border-r border-slate-800">Employee Number</th>
                <th className="px-6 py-5 sticky left-[150px] bg-slate-900 z-50 border-r border-slate-800">Full Name</th>
                <th className="px-6 py-5">Email</th>
                <th className="px-6 py-5">Date of Joining</th>
                <th className="px-6 py-5">Job Title</th>
                <th className="px-6 py-5">Business Unit</th>
                <th className="px-6 py-5">Department</th>
                <th className="px-6 py-5">Sub Department</th>
                <th className="px-6 py-5">Location</th>
                <th className="px-6 py-5">Cost Center</th>
                <th className="px-6 py-5">Legal Entity</th>
                <th className="px-6 py-5">Band</th>
                <th className="px-6 py-5">Reporting To</th>
                <th className="px-6 py-5">Dotted Line Manager</th>
                <th className="px-6 py-5">Active Status</th>
                <th className="px-6 py-5">Contract ID</th>
                <th className="px-6 py-5 text-center">WH Excl</th>
                <th className="px-6 py-5 text-center">OT</th>
                <th className="px-6 py-5 text-center">CompOff</th>
                <th className="px-6 py-5 text-center">Late Exm</th>
                <th className="px-6 py-5 text-center">Dev Allow</th>
                <th className="px-6 py-5 border-r border-slate-800">Biometric Number</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(emp => (
                <tr key={emp.employeeNumber} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 text-xs font-black text-slate-900">
                    {emp.employeeNumber}
                  </td>
                  <td className="px-6 py-4 sticky left-[150px] bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 text-xs font-black text-teal-600">
                    {emp.fullName}
                  </td>
                  <td className="px-6 py-4 text-[10px] font-medium text-slate-500">{emp.email}</td>
                  <td className="px-6 py-4 text-[10px] font-mono text-slate-400 uppercase">{emp.dateOfJoining}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-700">{emp.jobTitle}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-800">{emp.businessUnit}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-900">{emp.department}</td>
                  <td className="px-6 py-4 text-[10px] font-medium text-slate-500">{emp.subDepartment}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-600">{emp.location}</td>
                  <td className="px-6 py-4 text-[10px] font-medium text-slate-500">{emp.costCenter}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-500">{emp.legalEntity}</td>
                  <td className="px-6 py-4 text-[10px] font-black text-indigo-600 uppercase">{emp.band}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-700">{emp.reportingTo}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-700">{emp.dottedLineManager}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter ${emp.activeStatus === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {emp.activeStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] font-mono text-slate-400">{emp.contractId}</td>
                  <td className="px-6 py-4"><StatusTick val={emp.excludeFromWorkhoursCalculation} /></td>
                  <td className="px-6 py-4"><StatusTick val={emp.otEligible} /></td>
                  <td className="px-6 py-4"><StatusTick val={emp.compOffEligible} /></td>
                  <td className="px-6 py-4"><StatusTick val={emp.lateExemption} /></td>
                  <td className="px-6 py-4"><StatusTick val={emp.shiftDeviationAllowed} /></td>
                  <td className="px-6 py-4 text-[10px] font-mono text-slate-700 border-r border-slate-100">{emp.biometricNumber}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={22} className="px-8 py-32 text-center text-slate-300 font-black uppercase tracking-[0.2em] text-xs bg-slate-50/30">
                    No results for this view
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeUpload;
