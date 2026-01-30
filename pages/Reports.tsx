
import React, { useState, useMemo } from 'react';
import { 
  Download, 
  Printer, 
  PieChart as PieIcon,
  BarChart3 as BarIcon,
  ChevronDown,
  Layers,
  Activity,
  UserCheck,
  ClipboardCheck,
  Search
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { AppData, UserRole } from '../types.ts';

interface ReportsProps {
  data: AppData;
  role: UserRole;
}

const Reports: React.FC<ReportsProps> = ({ data, role }) => {
  const [filters, setFilters] = useState({
    bu: 'All',
    dept: 'All',
    loc: 'All',
    status: 'All'
  });
  const [searchTerm, setSearchTerm] = useState('');

  const isManager = role === 'Manager';

  const options = useMemo(() => ({
    bu: ['All', ...new Set(data.employees.map(e => e.businessUnit))].filter(Boolean),
    dept: ['All', ...new Set(data.employees.map(e => e.department))].filter(Boolean),
    loc: ['All', ...new Set(data.employees.map(e => e.location))].filter(Boolean),
    status: ['All', 'Clean', 'Deviation']
  }), [data.employees]);
  
  const displayEmployees = useMemo(() => {
    return data.employees.filter(emp => {
      const matchManager = isManager ? emp.department === 'Engineering' : true;
      const matchBU = filters.bu === 'All' || emp.businessUnit === filters.bu;
      const matchDept = filters.dept === 'All' || emp.department === filters.dept;
      const matchLoc = filters.loc === 'All' || emp.location === filters.loc;
      const matchSearch = emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || emp.employeeNumber.includes(searchTerm);
      
      const attRecords = data.attendance.filter(r => r.employeeNumber === emp.employeeNumber);
      const hasDeviation = attRecords.some(r => r.status !== 'Present' || r.lateBy !== '00:00');
      const matchStatus = filters.status === 'All' ? true : (filters.status === 'Clean' ? !hasDeviation : hasDeviation);

      return matchManager && matchBU && matchDept && matchLoc && matchSearch && matchStatus;
    });
  }, [data.employees, data.attendance, isManager, filters, searchTerm]);

  // Data Integrity Score Card
  const dataQualityData = useMemo(() => {
    const total = data.attendance.length || 1;
    const deviations = data.attendance.filter(r => r.status !== 'Present' || r.lateBy !== '00:00').length;
    const clean = total - deviations;
    
    return [
      { name: 'Clean Records', value: clean, color: '#10b981' },
      { name: 'Deviations', value: deviations, color: '#f43f5e' },
    ];
  }, [data.attendance]);

  // Attendance Scores by Dept
  const deptPerformance = useMemo(() => {
    return options.dept.filter(d => d !== 'All').map(dept => {
      const records = data.attendance.filter(r => r.department === dept);
      const cleanCount = records.filter(r => r.status === 'Present' && r.lateBy === '00:00').length;
      const score = records.length ? Math.round((cleanCount / records.length) * 100) : 0;
      return { name: dept, score };
    }).sort((a, b) => b.score - a.score);
  }, [data.attendance, options.dept]);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
            <Activity className="text-indigo-600" />
            Attendance Intelligence Audit
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">
            Analyzing workforce performance based on unique ID + Date ingestion.
          </p>
        </div>
        <div className="flex space-x-3 w-full md:w-auto">
          <button className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all font-black uppercase text-xs tracking-widest">
            <Download size={18} />
            <span>Generate Full Report</span>
          </button>
          <button className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all">
            <Printer size={20} />
          </button>
        </div>
      </div>

      {/* Global Filter Matrix */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-50 pb-4">
          <div className="flex items-center space-x-3 text-indigo-600">
            <Layers size={18} />
            <span className="text-xs font-black uppercase tracking-widest">Master Audit Filters</span>
          </div>
          <button 
            onClick={() => setFilters({ bu: 'All', dept: 'All', loc: 'All', status: 'All' })}
            className="text-[9px] font-black text-slate-400 uppercase hover:text-indigo-600 transition-colors"
          >
            Clear View
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search Staff ID or Name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-xs font-black"
            />
          </div>
          {['bu', 'dept', 'loc', 'status'].map((f) => (
            <div key={f} className="relative">
              <select 
                value={(filters as any)[f]}
                onChange={e => setFilters({...filters, [f]: e.target.value})}
                className="w-full appearance-none bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-700 py-3 pl-4 pr-10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                {(options as any)[f].map((opt: string) => <option key={opt} value={opt}>{opt === 'All' ? `${f.toUpperCase()}: All` : opt}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Integrity Chart */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-center space-x-2 mb-8">
            <PieIcon size={18} className="text-indigo-600" />
            <h3 className="font-black text-xs text-slate-900 uppercase tracking-widest">Clean Data vs Deviations</h3>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataQualityData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value">
                  {dataQualityData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', fontSize: '12px', fontWeight: 'bold'}} />
                <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', paddingTop: '20px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* performance Chart */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm lg:col-span-2">
          <div className="flex items-center space-x-2 mb-8">
            <BarIcon size={18} className="text-indigo-600" />
            <h3 className="font-black text-xs text-slate-900 uppercase tracking-widest">Punctuality Score by Dept (%)</h3>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#64748b'}} width={80} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                <Bar dataKey="score" fill="#4f46e5" radius={[0, 8, 8, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-900 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4 text-white">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
              <ClipboardCheck size={24} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="font-black text-lg uppercase tracking-widest leading-none">Clean Data Verification Table</h3>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em] mt-1">Audit of {displayEmployees.length} unique staff records</p>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="bg-slate-50 text-slate-400 text-[9px] uppercase font-black tracking-[0.15em] border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Staff ID</th>
                <th className="px-8 py-5">Full Name</th>
                <th className="px-8 py-5">Department</th>
                <th className="px-8 py-5">Location</th>
                <th className="px-8 py-5 text-center">Status Category</th>
                <th className="px-8 py-5 text-right">Avg Effective Hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayEmployees.length > 0 ? displayEmployees.map((emp) => {
                const attRecords = data.attendance.filter(r => r.employeeNumber === emp.employeeNumber);
                const hasDev = attRecords.some(r => r.status !== 'Present' || r.lateBy !== '00:00');
                
                return (
                  <tr key={emp.employeeNumber} className="hover:bg-indigo-50/20 transition-all">
                    <td className="px-8 py-5 text-[10px] font-black text-slate-400 whitespace-nowrap">{emp.employeeNumber}</td>
                    <td className="px-8 py-5 text-sm font-black text-slate-800 whitespace-nowrap">{emp.fullName}</td>
                    <td className="px-8 py-5 text-[11px] font-black text-indigo-600 whitespace-nowrap">{emp.department}</td>
                    <td className="px-8 py-5 text-[11px] font-bold text-slate-400 whitespace-nowrap">{emp.location}</td>
                    <td className="px-8 py-5 text-center whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${!hasDev ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {!hasDev ? 'Clean Data' : 'Requires Cleanup'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right font-black text-slate-800 whitespace-nowrap">8.4 Hrs</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-8 py-24 text-center">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      No matching records for current filter set.
                    </p>
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

export default Reports;