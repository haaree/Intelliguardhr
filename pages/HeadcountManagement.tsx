import React, { useState, useMemo } from 'react';
import { Users, Upload, Download, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AppData, HeadcountData, UserRole } from '../types';

interface HeadcountManagementProps {
  data: AppData;
  onUpdate: (headcountData: HeadcountData[]) => void;
  role: UserRole;
}

const HeadcountManagement: React.FC<HeadcountManagementProps> = ({ data, onUpdate, role }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<HeadcountData>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLegalEntity, setSelectedLegalEntity] = useState<string>('All');

  const isAdmin = role === 'SaaS_Admin' || role === 'Admin';

  // Get unique legal entities
  const legalEntities = useMemo(() => {
    const entities = new Set<string>();
    data.headcountData.forEach(hc => entities.add(hc.legalEntity));
    return ['All', ...Array.from(entities).sort()];
  }, [data.headcountData]);

  // Get unique locations
  const locations = useMemo(() => {
    const locs = new Set<string>();
    data.headcountData.forEach(hc => {
      if (selectedLegalEntity === 'All' || hc.legalEntity === selectedLegalEntity) {
        locs.add(hc.location);
      }
    });
    return Array.from(locs).sort();
  }, [data.headcountData, selectedLegalEntity]);

  // Filtered data
  const filteredData = useMemo(() => {
    if (selectedLegalEntity === 'All') return data.headcountData;
    return data.headcountData.filter(hc => hc.legalEntity === selectedLegalEntity);
  }, [data.headcountData, selectedLegalEntity]);

  // Group data for matrix view
  interface MatrixCell {
    [location: string]: number;
  }

  interface MatrixRow {
    legalEntity: string;
    department: string;
    subDepartment: string;
    locations: MatrixCell;
    total: number;
  }

  const matrixData = useMemo((): MatrixRow[] => {
    const grouped = new Map<string, MatrixRow>();

    filteredData.forEach(hc => {
      const key = `${hc.legalEntity}|${hc.department}|${hc.subDepartment}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          legalEntity: hc.legalEntity,
          department: hc.department,
          subDepartment: hc.subDepartment,
          locations: {},
          total: 0
        });
      }

      const row = grouped.get(key)!;
      row.locations[hc.location] = hc.approvedHeadcount;
      row.total += hc.approvedHeadcount;
    });

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.legalEntity !== b.legalEntity) return a.legalEntity.localeCompare(b.legalEntity);
      if (a.department !== b.department) return a.department.localeCompare(b.department);
      return a.subDepartment.localeCompare(b.subDepartment);
    });
  }, [filteredData]);

  // Calculate column totals
  const columnTotals = useMemo(() => {
    const totals: { [location: string]: number } = {};
    locations.forEach(loc => totals[loc] = 0);

    filteredData.forEach(hc => {
      if (totals[hc.location] !== undefined) {
        totals[hc.location] += hc.approvedHeadcount;
      }
    });

    return totals;
  }, [filteredData, locations]);

  const grandTotal = useMemo(() => {
    return filteredData.reduce((sum, hc) => sum + hc.approvedHeadcount, 0);
  }, [filteredData]);

  // Add new headcount entry
  const handleAdd = () => {
    if (!editForm.legalEntity || !editForm.location || !editForm.department ||
        !editForm.subDepartment || !editForm.approvedHeadcount) {
      alert('Please fill all fields');
      return;
    }

    const newEntry: HeadcountData = {
      id: `hc_${Date.now()}`,
      legalEntity: editForm.legalEntity,
      location: editForm.location,
      department: editForm.department,
      subDepartment: editForm.subDepartment,
      approvedHeadcount: editForm.approvedHeadcount
    };

    onUpdate([...data.headcountData, newEntry]);
    setShowAddModal(false);
    setEditForm({});
  };

  // Update existing entry
  const handleUpdate = (id: string) => {
    const updated = data.headcountData.map(hc =>
      hc.id === id ? { ...hc, ...editForm } : hc
    );
    onUpdate(updated);
    setEditingId(null);
    setEditForm({});
  };

  // Delete entry
  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this headcount entry?')) return;
    const updated = data.headcountData.filter(hc => hc.id !== id);
    onUpdate(updated);
  };

  // Download Excel template
  const downloadTemplate = () => {
    const templateData = [
      ['Legal Entity', 'Location', 'Department', 'Sub Department', 'Approved Headcount'],
      ['SIS', 'Mumbai', 'IT', 'Development', 50],
      ['SIS', 'Delhi', 'IT', 'Development', 30],
      ['SIS', 'Mumbai', 'HR', 'Recruitment', 10]
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 20 }, // Legal Entity
      { wch: 20 }, // Location
      { wch: 25 }, // Department
      { wch: 25 }, // Sub Department
      { wch: 20 }  // Approved Headcount
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Headcount Template');
    XLSX.writeFile(wb, 'Headcount_Template.xlsx');
  };

  // Upload Excel
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Skip header row
        const newEntries: HeadcountData[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row[0] || !row[1] || !row[2] || !row[3] || !row[4]) continue;

          newEntries.push({
            id: `hc_${Date.now()}_${i}`,
            legalEntity: String(row[0]),
            location: String(row[1]),
            department: String(row[2]),
            subDepartment: String(row[3]),
            approvedHeadcount: Number(row[4])
          });
        }

        if (newEntries.length > 0) {
          onUpdate([...data.headcountData, ...newEntries]);
          alert(`Successfully imported ${newEntries.length} headcount entries`);
        }
      } catch (error) {
        alert('Error reading Excel file. Please check the format.');
        console.error(error);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset file input
  };

  // Export current data
  const handleExport = () => {
    const exportData = [
      ['Legal Entity', 'Location', 'Department', 'Sub Department', 'Approved Headcount'],
      ...filteredData.map(hc => [
        hc.legalEntity,
        hc.location,
        hc.department,
        hc.subDepartment,
        hc.approvedHeadcount
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 20 },
      { wch: 20 },
      { wch: 25 },
      { wch: 25 },
      { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Headcount Data');
    XLSX.writeFile(wb, `Headcount_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <p className="text-xl font-bold text-slate-700">Access Denied</p>
          <p className="text-sm text-slate-500 mt-2">Only administrators can access headcount management</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 p-8 overflow-auto">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Users size={24} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">Headcount Management</h1>
                <p className="text-sm text-slate-500 font-medium">Manage approved headcount by location and department</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm uppercase tracking-widest"
              >
                <Download size={18} />
                Template
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-bold text-sm uppercase tracking-widest cursor-pointer">
                <Upload size={18} />
                Upload Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-bold text-sm uppercase tracking-widest"
              >
                <Download size={18} />
                Export
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-bold text-sm uppercase tracking-widest"
              >
                <Plus size={18} />
                Add Entry
              </button>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
              Legal Entity:
            </label>
            <select
              value={selectedLegalEntity}
              onChange={(e) => setSelectedLegalEntity(e.target.value)}
              className="px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
            >
              {legalEntities.map(entity => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
            <div className="ml-auto text-sm font-bold text-slate-600">
              Total Entries: {filteredData.length} | Grand Total Headcount: {grandTotal}
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest sticky left-0 bg-slate-900">Legal Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Sub Department</th>
                  {locations.map(loc => (
                    <th key={loc} className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">{loc}</th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest bg-blue-900">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matrixData.map((row, idx) => (
                  <tr key={`${row.legalEntity}-${row.department}-${row.subDepartment}`} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900 sticky left-0 bg-inherit">{row.legalEntity}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{row.department}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{row.subDepartment}</td>
                    {locations.map(loc => (
                      <td key={loc} className="px-4 py-3 text-center text-sm font-bold text-slate-900">
                        {row.locations[loc] || '-'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center text-sm font-black text-blue-600 bg-blue-50">{row.total}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            const entry = filteredData.find(hc =>
                              hc.legalEntity === row.legalEntity &&
                              hc.department === row.department &&
                              hc.subDepartment === row.subDepartment
                            );
                            if (entry) {
                              setEditingId(entry.id);
                              setEditForm(entry);
                            }
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Column Totals Row */}
                <tr className="bg-gradient-to-r from-slate-800 to-slate-900 text-white font-black">
                  <td colSpan={3} className="px-4 py-3 text-sm uppercase tracking-widest">Total</td>
                  {locations.map(loc => (
                    <td key={loc} className="px-4 py-3 text-center text-sm">{columnTotals[loc]}</td>
                  ))}
                  <td className="px-4 py-3 text-center text-sm bg-blue-900">{grandTotal}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-black text-slate-900 mb-4">Add Headcount Entry</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Legal Entity</label>
                  <input
                    type="text"
                    value={editForm.legalEntity || ''}
                    onChange={(e) => setEditForm({ ...editForm, legalEntity: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Location</label>
                  <input
                    type="text"
                    value={editForm.location || ''}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Department</label>
                  <input
                    type="text"
                    value={editForm.department || ''}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Sub Department</label>
                  <input
                    type="text"
                    value={editForm.subDepartment || ''}
                    onChange={(e) => setEditForm({ ...editForm, subDepartment: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Approved Headcount</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.approvedHeadcount || ''}
                    onChange={(e) => setEditForm({ ...editForm, approvedHeadcount: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAdd}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-bold text-sm uppercase tracking-widest"
                >
                  <Save size={18} />
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditForm({});
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all font-bold text-sm uppercase tracking-widest"
                >
                  <X size={18} />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeadcountManagement;
