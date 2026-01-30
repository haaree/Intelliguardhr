
import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from 'recharts';
import { AppData, UserRole } from '../types.ts';
import { User, Filter, SlidersHorizontal, Activity, CalendarDays, UserX, CheckCircle, Zap, ShieldAlert, Timer, FileWarning } from 'lucide-react';

interface DashboardProps {
  data: AppData;
  role: UserRole;
}

const Dashboard: React.FC<DashboardProps> = ({ data, role }) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const [filters, setFilters] = useState({
    businessUnit: 'All',
    department: 'All',
    location: 'All',
    band: 'All',
    jobTitle: 'All',
    costCenter: 'All',
    activeStatus: 'All',
    legalEntity: 'All'
  });

  const isEmployee = role === 'Employee';

  const filterOptions = useMemo(() => ({
    businessUnit: ['All', ...new Set(data.employees.map(e => e.businessUnit))].filter(Boolean),
    department: ['All', ...new Set(data.employees.map(e => e.department))].filter(Boolean),
    location: ['All', ...new Set(data.employees.map(e => e.location))].filter(Boolean),
    band: ['All', ...new Set(data.employees.map(e => e.band))].filter(Boolean),
    jobTitle: ['All', ...new Set(data.employees.map(e => e.jobTitle))].filter(Boolean),
    costCenter: ['All', ...new Set(data.employees.map(e => e.costCenter))].filter(Boolean),
    activeStatus: ['All', ...new Set(data.employees.map(e => e.activeStatus))].filter(Boolean),
    legalEntity: ['All', ...new Set(data.employees.map(e => e.legalEntity))].filter(Boolean),
  }), [data.employees]);

  const filteredData = useMemo(() => {
    const employees = data.employees.filter(emp => {
      const matchBU = filters.businessUnit === 'All' || emp.businessUnit === filters.businessUnit;
      const matchDept = filters.department === 'All' || emp.department === filters.department;
      const matchLoc = filters.location === 'All' || emp.location === filters.location;
      const matchBand = filters.band === 'All' || emp.band === filters.band;
      const matchJob = filters.jobTitle === 'All' || emp.jobTitle === filters.jobTitle;
      const matchCC = filters.costCenter === 'All' || emp.costCenter === filters.costCenter;
      const matchStatus = filters.activeStatus === 'All' || emp.activeStatus === filters.activeStatus;
      const matchEntity = filters.legalEntity === 'All' || emp.legalEntity === filters.legalEntity;
      return matchBU && matchDept && matchLoc && matchBand && matchJob && matchCC && matchStatus && matchEntity;
    });

    const empIds = new Set(employees.map(e => e.employeeNumber));
    const attendance = data.attendance.filter(a => empIds.has(a.employeeNumber));

    return { employees, attendance };
  }, [data, filters]);

  const getFilterLabel = () => {
    const activeFilters = Object.entries(filters).filter(([_, value]) => value !== 'All');
    if (activeFilters.length === 0) return 'Whole Company';
    const [key, value] = activeFilters[0];
    return value;
  };

  const filterLabel = getFilterLabel();

  const stats = isEmployee ? [
    { label: 'Clean Logs', value: data.attendance.filter(a => a.status === 'Clean').length, trend: 'Presence Validated', icon: CheckCircle, color: 'text-emerald-600' },
    { label: 'Audit Alerts', value: data.attendance.filter(a => a.status === 'Audit').length, trend: 'Needs Review', icon: ShieldAlert, color: 'text-amber-600' },
    { label: 'Very Late', value: data.attendance.filter(a => a.status === 'Very Late').length, trend: 'Punctuality Breach', icon: Activity, color: 'text-rose-600' },
    { label: 'Off Days', value: data.attendance.filter(a => a.status === 'Holiday' || a.status === 'Weekly Off').length, trend: 'Official Rest', icon: CalendarDays, color: 'text-slate-400' },
  ] : [
    { label: 'Total Staff', value: filteredData.employees.length, trend: filterLabel, icon: User, color: 'text-teal-600' },
    { label: 'Audit Queue', value: filteredData.attendance.filter(a => a.status === 'Audit').length, trend: 'Log Deviations', icon: ShieldAlert, color: 'text-amber-600', negative: true },
    { label: 'Clean Logs', value: filteredData.attendance.filter(a => a.status === 'Clean').length, trend: 'Full Compliance', icon: CheckCircle, color: 'text-emerald-600' },
    { label: 'Absent', value: filteredData.attendance.filter(a => a.status === 'Absent').length, trend: 'No Log Evidence', icon: UserX, color: 'text-rose-900' },
  ];

  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = days.map(day => ({ name: day, clean: 0, absent: 0, audit: 0 }));
    
    data.attendance.forEach(a => {
      const d = parseFormattedDate(a.date);
      if (d && !isNaN(d.getTime())) {
        const dayIdx = d.getDay();
        if (a.status === 'Clean' || a.status === 'Worked Off') counts[dayIdx].clean++;
        if (a.status === 'Absent') counts[dayIdx].absent++;
        if (a.status === 'Audit' || a.status === 'Very Late' || a.status === 'Very Early') counts[dayIdx].audit++;
      }
    });
    return counts;
  }, [data.attendance]);

  function parseFormattedDate(dateStr: string): Date | null {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const monthIndex = months.indexOf(parts[1].toUpperCase());
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || monthIndex === -1 || isNaN(year)) return null;
    return new Date(year, monthIndex, day);
  }

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-100">
             <div className="w-6 h-6 border-2 border-white rounded-sm"></div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              {isEmployee ? 'Personal Dashboard' : filterLabel === 'Whole Company' ? 'Workforce Intelligence' : filterLabel}
            </h1>
            <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mt-1">
              Audit Driven Reporting — {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        
        {!isEmployee && (
          <div className="w-full md:w-auto flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm space-x-2">
            <div className="flex items-center px-3 text-teal-600 border-r border-slate-100">
              <Filter size={16} />
            </div>
            <select value={filters.businessUnit} onChange={e => updateFilter('businessUnit', e.target.value)} className="text-[10px] font-black uppercase tracking-widest bg-slate-50 border-none rounded-xl focus:ring-teal-500 outline-none cursor-pointer p-2.5 min-w-[140px]">
              {filterOptions.businessUnit.map(bu => <option key={bu} value={bu}>{bu === 'All' ? 'All Units' : bu}</option>)}
            </select>
            <button 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`p-2.5 rounded-xl transition-all flex items-center space-x-2 ${showAdvancedFilters ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}`}
            >
              <SlidersHorizontal size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Advanced</span>
            </button>
          </div>
        )}
      </header>

      {!isEmployee && showAdvancedFilters && (
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl grid grid-cols-2 md:grid-cols-4 gap-6 animate-in slide-in-from-top-4 duration-300">
          {[
            { label: 'Department', key: 'department', opts: filterOptions.department },
            { label: 'Location', key: 'location', opts: filterOptions.location },
            { label: 'Level/Band', key: 'band', opts: filterOptions.band },
            { label: 'Cost Center', key: 'costCenter', opts: filterOptions.costCenter },
          ].map((f) => (
            <div key={f.key} className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{f.label}</label>
              <select value={(filters as any)[f.key]} onChange={updateFilter.bind(null, f.key as any)} className="w-full text-[10px] font-black bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer p-3 uppercase">
                {f.opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
            <div className={`absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity ${stat.color}`}>
              <stat.icon size={120} />
            </div>
            <div className="text-slate-400 text-[10px] uppercase tracking-widest font-black mb-3">{stat.label}</div>
            <div className="text-4xl font-black text-slate-900 mb-4">{stat.value}</div>
            <div className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 inline-flex items-center gap-2 rounded-lg border ${stat.negative ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
              <stat.icon size={12} />
              {stat.trend}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              <Activity className="text-teal-600" />
              Logs Audit Trend
            </h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">Daily distribution of clean logs vs audit flags</p>
          </div>
        </div>
        <div className="h-[450px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '20px'}} />
              <Bar dataKey="clean" fill="#0d9488" name="Clean" radius={[8, 8, 4, 4]} barSize={30} />
              <Bar dataKey="audit" fill="#f59e0b" name="Audit Needed" radius={[8, 8, 4, 4]} barSize={30} />
              <Bar dataKey="absent" fill="#f43f5e" name="Absent" radius={[8, 8, 4, 4]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
