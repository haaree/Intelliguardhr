import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Settings2, 
  Save, 
  Trash2, 
  Plus, 
  Calendar, 
  Clock, 
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  Eraser
} from 'lucide-react';
import { Shift, Holiday, AppData } from '../types.ts';
import * as XLSX from 'xlsx';

interface ShiftMatrixProps {
  data: AppData;
  onUpdate: (shifts: Shift[]) => void;
  onUpdateMasters: (updates: Partial<AppData>) => void;
  role: string;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ShiftMatrix: React.FC<ShiftMatrixProps> = ({ data, onUpdate, onUpdateMasters, role }) => {
  const [activeTab, setActiveTab] = useState<'shifts' | 'holidays' | 'weekly'>('shifts');
  const [isImporting, setIsImporting] = useState(false);
  
  // Local staging states to handle "Save" functionality
  const [localShifts, setLocalShifts] = useState<Shift[]>([]);
  const [localHolidays, setLocalHolidays] = useState<Holiday[]>([]);
  const [localWeeklyOffs, setLocalWeeklyOffs] = useState<number[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  // Initialize local states from props
  useEffect(() => {
    setLocalShifts(data.shifts);
    setLocalHolidays(data.holidays);
    setLocalWeeklyOffs(data.weeklyOffs);
    setIsDirty(false);
  }, [data, activeTab]);

  const handleSave = () => {
    if (activeTab === 'shifts') {
      onUpdate(localShifts);
    } else if (activeTab === 'holidays') {
      onUpdateMasters({ holidays: localHolidays });
    } else if (activeTab === 'weekly') {
      onUpdateMasters({ weeklyOffs: localWeeklyOffs });
    }
    setIsDirty(false);
    alert(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} configuration saved successfully.`);
  };

  const handleClearTab = () => {
    const tabName = activeTab === 'shifts' ? 'Shifts' : activeTab === 'holidays' ? 'Holidays' : 'Weekly Offs';
    if (confirm(`Are you sure you want to clear all ${tabName}? This will reset the staging data. You must click SAVE to finalize the deletion.`)) {
      if (activeTab === 'shifts') setLocalShifts([]);
      else if (activeTab === 'holidays') setLocalHolidays([]);
      else if (activeTab === 'weekly') setLocalWeeklyOffs([]);
      setIsDirty(true);
    }
  };

  // Shift logic with new policy defaults
  const addManualShift = () => {
    const count = localShifts.length + 1;
    const newId = `S${count}`;
    const newShift: Shift = {
      id: newId,
      label: newId, 
      startTime: '09:00',
      endTime: '18:00',
      earlyInThreshold: 45, // Default: 45 mins
      lateThreshold: 60,    // Default: 60 mins
      allowedLateCount: 2,  // Default: 2 occasions (combined Late/Early Out)
      earlyThreshold: 60,   // Default: 60 mins
      workhoursFormula: '',
      shiftDeviationStats: '',
      permissionLogic: '',
      allowedPermission: 0,
      excessHoursLogic: '',
      otEligibilityLogic: '',
      otPayableLogic: ''
    };
    setLocalShifts([...localShifts, newShift]);
    setIsDirty(true);
  };

  const handleShiftUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];

        const newShifts: Shift[] = jsonData.map((row, idx) => {
          const id = row['Shift ID'] || row['ID'] || row['ShiftID'] || row['ShiftNo'] || `S${idx + 1}`;
          const label = row['Label'] || row['Shift Name'] || row['ShiftName'] || id; 
          
          return {
            id: String(id).trim(),
            label: String(label).trim(),
            startTime: String(row['Start Time'] || row['In Time'] || '09:00').trim(),
            endTime: String(row['End Time'] || row['Out Time'] || '18:00').trim(),
            earlyInThreshold: Number(row['Early In Threshold'] || row['Early In (m)'] || 45),
            lateThreshold: Number(row['Late In Threshold'] || row['Late In (m)'] || 60),
            allowedLateCount: Number(row['Allowed Late'] || row['Allowed Late (Qty)'] || 2),
            earlyThreshold: Number(row['Early Out Threshold'] || row['Early Out (m)'] || 60),
            workhoursFormula: '',
            shiftDeviationStats: '',
            permissionLogic: '',
            allowedPermission: 0,
            excessHoursLogic: '',
            otEligibilityLogic: '',
            otPayableLogic: ''
          };
        });
        setLocalShifts([...localShifts, ...newShifts]);
        setIsDirty(true);
        alert(`Successfully imported ${newShifts.length} shifts. Click SAVE to finalize.`);
      } catch (err) {
        alert("Shift upload failed. Check format.");
      } finally {
        setIsImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const updateLocalShift = (id: string, field: keyof Shift, value: any) => {
    setLocalShifts(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    setIsDirty(true);
  };

  const deleteLocalShift = (id: string) => {
    if (window.confirm(`Delete shift ${id}?`)) {
      setLocalShifts(prev => prev.filter(s => s.id !== id));
      setIsDirty(true);
    }
  };

  // Holiday logic
  const [newHoliday, setNewHoliday] = useState({ date: '', label: '' });
  
  const addHoliday = () => {
    if (!newHoliday.date || !newHoliday.label) return;
    const d = new Date(newHoliday.date);
    const formatted = `${d.getDate().toString().padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
    setLocalHolidays([...localHolidays, { date: formatted, label: newHoliday.label }]);
    setNewHoliday({ date: '', label: '' });
    setIsDirty(true);
  };

  const handleHolidayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];

        const newHolidays: Holiday[] = jsonData.map(row => {
          let dateStr = '';
          const rawDate = row['Date'] || row['Holiday Date'];
          if (rawDate instanceof Date) {
            dateStr = `${rawDate.getDate().toString().padStart(2, '0')}-${MONTHS[rawDate.getMonth()]}-${rawDate.getFullYear()}`;
          } else {
            const d = new Date(rawDate);
            dateStr = isNaN(d.getTime()) ? String(rawDate) : `${d.getDate().toString().padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
          }
          return { date: dateStr, label: String(row['Holiday Name'] || 'Holiday') };
        });
        setLocalHolidays([...localHolidays, ...newHolidays]);
        setIsDirty(true);
        alert(`Loaded ${newHolidays.length} holidays. Click SAVE to finalize.`);
      } catch (err) {
        alert("Holiday upload failed.");
      } finally {
        setIsImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const deleteLocalHoliday = (index: number) => {
    setLocalHolidays(prev => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  // Weekly Off logic
  const toggleLocalWeeklyOff = (dayIdx: number) => {
    setLocalWeeklyOffs(prev => prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx]);
    setIsDirty(true);
  };

  const isAdmin = role === 'SaaS_Admin' || role === 'Admin';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Settings2 className="text-teal-600" size={32} />
            Settings Matrix
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Configure shift IDs, labels, yearly holidays, and standard weekly offs.
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && (
            <button 
              onClick={handleClearTab}
              className="flex items-center space-x-2 bg-rose-50 text-rose-600 border border-rose-100 px-6 py-3 rounded-2xl hover:bg-rose-100 transition-all font-black text-xs uppercase tracking-widest"
            >
              <Eraser size={18} />
              <span>Clear Tab</span>
            </button>
          )}

          {isAdmin && isDirty && (
            <button 
              onClick={handleSave}
              className="flex items-center space-x-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg animate-bounce"
            >
              <Save size={18} />
              <span className="font-bold text-xs uppercase tracking-widest">Save Changes</span>
            </button>
          )}

          {activeTab === 'shifts' && isAdmin && (
            <div className="flex gap-2">
              <label className="flex items-center space-x-2 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
                <FileSpreadsheet size={18} className="text-emerald-600" />
                <span className="font-bold text-xs uppercase tracking-widest">Upload CSV/XLS</span>
                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleShiftUpload} />
              </label>
              <button 
                onClick={addManualShift}
                className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-3 rounded-2xl hover:bg-slate-800 transition-all shadow-lg"
              >
                <Plus size={18} />
                <span className="font-bold text-xs uppercase tracking-widest">Add New Shift</span>
              </button>
            </div>
          )}
          {activeTab === 'holidays' && isAdmin && (
            <label className="flex items-center space-x-2 bg-teal-600 text-white px-6 py-3 rounded-2xl hover:bg-teal-700 transition-all shadow-lg cursor-pointer">
              <Upload size={18} />
              <span className="font-bold text-xs uppercase tracking-widest">Bulk Import Holidays</span>
              <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleHolidayUpload} />
            </label>
          )}
        </div>
      </header>

      <div className="flex items-center space-x-1 p-1 bg-slate-200/50 rounded-2xl w-fit">
        {[
          { id: 'shifts', label: 'Shift Matrix', icon: Clock },
          { id: 'holidays', label: 'Holiday Master', icon: Calendar },
          { id: 'weekly', label: 'Weekly Offs', icon: CalendarDays },
        ].map((t) => (
          <button 
            key={t.id}
            onClick={() => setActiveTab(t.id as any)} 
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === t.id ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden min-h-[500px]">
        {activeTab === 'shifts' && (
          <div className="overflow-auto scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest sticky top-0 z-20">
                <tr>
                  <th className="px-6 py-5 border-r border-slate-800 text-center">Action</th>
                  <th className="px-6 py-5">Shift ID</th>
                  <th className="px-6 py-5">Label (Display Name)</th>
                  <th className="px-6 py-5">Start Time</th>
                  <th className="px-6 py-5">End Time</th>
                  <th className="px-6 py-5 text-center text-teal-300">Early In (m)</th>
                  <th className="px-6 py-5 text-center text-rose-300">Late In (m)</th>
                  <th className="px-6 py-5 text-center text-indigo-300">Allowed Occasions (Qty)</th>
                  <th className="px-6 py-5 text-center text-amber-300">Early Out (m)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localShifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 border-r border-slate-100 text-center">
                      <button 
                        onClick={() => deleteLocalShift(shift.id)} 
                        className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        value={shift.id}
                        onChange={(e) => updateLocalShift(shift.id, 'id', e.target.value)}
                        className="bg-slate-50 p-2 rounded-lg font-black text-xs w-24 outline-none border border-transparent focus:border-teal-300"
                        placeholder="ID"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        value={shift.label}
                        onChange={(e) => updateLocalShift(shift.id, 'label', e.target.value)}
                        className="bg-slate-50 p-2 rounded-lg font-bold text-xs w-48 outline-none border border-transparent focus:border-teal-300"
                        placeholder="Label"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input type="time" value={shift.startTime} onChange={e => updateLocalShift(shift.id, 'startTime', e.target.value)} className="text-xs font-bold p-2 rounded bg-slate-50 outline-none" />
                    </td>
                    <td className="px-6 py-4">
                      <input type="time" value={shift.endTime} onChange={e => updateLocalShift(shift.id, 'endTime', e.target.value)} className="text-xs font-bold p-2 rounded bg-slate-50 outline-none" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input type="number" value={shift.earlyInThreshold} onChange={e => updateLocalShift(shift.id, 'earlyInThreshold', parseInt(e.target.value) || 0)} className="w-16 text-xs font-black p-2 text-center bg-teal-50 text-teal-600 rounded outline-none" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input type="number" value={shift.lateThreshold} onChange={e => updateLocalShift(shift.id, 'lateThreshold', parseInt(e.target.value) || 0)} className="w-16 text-xs font-black p-2 text-center bg-rose-50 text-rose-600 rounded outline-none" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input type="number" value={shift.allowedLateCount || 0} onChange={e => updateLocalShift(shift.id, 'allowedLateCount', parseInt(e.target.value) || 0)} className="w-16 text-xs font-black p-2 text-center bg-indigo-50 text-indigo-600 rounded outline-none" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input type="number" value={shift.earlyThreshold} onChange={e => updateLocalShift(shift.id, 'earlyThreshold', parseInt(e.target.value) || 0)} className="w-16 text-xs font-black p-2 text-center bg-amber-50 text-amber-600 rounded outline-none" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-8 border-t border-slate-50 bg-slate-50/30">
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Policy Reference:</p>
               <ul className="text-[10px] font-bold text-slate-500 space-y-1">
                 <li>• Late In / Early Out threshold defaults to 60 minutes.</li>
                 <li>• Early In threshold defaults to 45 minutes.</li>
                 <li>• Allowed Occasions (Qty) represents a monthly combined cap for Late/Early violations.</li>
               </ul>
            </div>
            <div className="p-8 flex justify-end">
              <button 
                onClick={handleSave} 
                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50"
                disabled={!isDirty}
              >
                Save Shift Matrix
              </button>
            </div>
          </div>
        )}

        {activeTab === 'holidays' && (
          <div className="p-8 space-y-8">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col md:flex-row items-end gap-4 max-w-2xl">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Date</label>
                <input 
                  type="date" 
                  value={newHoliday.date}
                  onChange={e => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-white p-3 rounded-xl border border-slate-200 text-xs font-black outline-none"
                />
              </div>
              <div className="flex-[2] space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Holiday Occasion</label>
                <input 
                  type="text" 
                  placeholder="e.g. Christmas Day"
                  value={newHoliday.label}
                  onChange={e => setNewHoliday(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full bg-white p-3 rounded-xl border border-slate-200 text-xs font-black outline-none"
                />
              </div>
              <button 
                onClick={addHoliday}
                className="bg-teal-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-teal-700 transition-all"
              >
                Add
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {localHolidays.map((h, idx) => (
                <div key={`${h.date}-${idx}`} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center font-black text-[10px]">
                      H
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">{h.label}</div>
                      <div className="text-[10px] font-bold text-slate-400 font-mono">{h.date}</div>
                    </div>
                  </div>
                  <button onClick={() => deleteLocalHoliday(idx)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-600 transition-all p-2">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end pt-8">
              <button 
                onClick={handleSave} 
                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50"
                disabled={!isDirty}
              >
                Save Holiday Master
              </button>
            </div>
          </div>
        )}

        {activeTab === 'weekly' && (
          <div className="p-8 space-y-6">
            <div className="max-w-xl">
              <h3 className="text-lg font-black text-slate-900 mb-2">Weekly Off Schedule</h3>
              <p className="text-sm text-slate-500 mb-8">Selected days are automatically marked as Weekly Off.</p>
              
              <div className="space-y-3">
                {DAYS_OF_WEEK.map((day, idx) => {
                  const isActive = localWeeklyOffs.includes(idx);
                  return (
                    <button 
                      key={day}
                      onClick={() => toggleLocalWeeklyOff(idx)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isActive ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300'}`}
                    >
                      <span className="font-black text-sm uppercase tracking-widest">{day}</span>
                      {isActive ? <CheckCircle2 size={20} className="text-teal-600" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="flex justify-end pt-8">
              <button 
                onClick={handleSave} 
                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50"
                disabled={!isDirty}
              >
                Save Weekly Off Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftMatrix;