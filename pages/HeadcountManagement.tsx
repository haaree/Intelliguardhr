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
  const [editingRow, setEditingRow] = useState<{ legalEntity: string; department: string; subDepartment: string } | null>(null);
  const [editForm, setEditForm] = useState<Partial<HeadcountData>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLegalEntity, setSelectedLegalEntity] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [locationApprovals, setLocationApprovals] = useState<{ [location: string]: number }>({});
  const [uploadedData, setUploadedData] = useState<HeadcountData[] | null>(null);

  const isAdmin = role === 'SaaS_Admin' || role === 'Admin';

  // Custom sort order for legal entities
  const legalEntityOrder = [
    'ASP ASP Unit I - Pillaipakkam',
    'ASP - Unit II - Irumbedu',
    'Babaa Enterprises - Vengadu'
  ];

  const sortLegalEntities = (a: string, b: string): number => {
    const indexA = legalEntityOrder.indexOf(a);
    const indexB = legalEntityOrder.indexOf(b);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  };

  // Calculate actual headcount from active employees
  const actualHeadcount = useMemo(() => {
    if (!data.employees || data.employees.length === 0) {
      return new Map<string, number>();
    }

    const activeEmployees = data.employees.filter(emp =>
      emp.activeStatus === 'Active' || emp.activeStatus === 'active'
    );

    const grouped = new Map<string, number>();
    activeEmployees.forEach(emp => {
      const key = `${emp.legalEntity}|${emp.location}|${emp.department}|${emp.subDepartment}`;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    return grouped;
  }, [data.employees]);

  // Get unique legal entities from both employees and headcount data
  const legalEntities = useMemo(() => {
    const entities = new Set<string>();
    if (data.employees) {
      data.employees.forEach(emp => entities.add(emp.legalEntity));
    }
    if (data.headcountData) {
      data.headcountData.forEach(hc => entities.add(hc.legalEntity));
    }
    return ['All', ...Array.from(entities).sort(sortLegalEntities)];
  }, [data.employees, data.headcountData]);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set<string>();
    if (data.employees) {
      data.employees.forEach(emp => {
        if ((selectedLegalEntity === 'All' || emp.legalEntity === selectedLegalEntity) &&
            (selectedLocation === 'All' || emp.location === selectedLocation)) {
          depts.add(emp.department);
        }
      });
    }
    if (data.headcountData) {
      data.headcountData.forEach(hc => {
        if ((selectedLegalEntity === 'All' || hc.legalEntity === selectedLegalEntity) &&
            (selectedLocation === 'All' || hc.location === selectedLocation)) {
          depts.add(hc.department);
        }
      });
    }
    return ['All', ...Array.from(depts).sort()];
  }, [data.employees, data.headcountData, selectedLegalEntity, selectedLocation]);

  // Get unique locations (not filtered - show all locations as columns)
  const allLocations = useMemo(() => {
    const locs = new Set<string>();
    if (data.employees) {
      data.employees.forEach(emp => locs.add(emp.location));
    }
    if (data.headcountData) {
      data.headcountData.forEach(hc => locs.add(hc.location));
    }
    return Array.from(locs).sort();
  }, [data.employees, data.headcountData]);

  // Get unique locations for filter dropdown
  const locations = useMemo(() => {
    const locs = new Set<string>();
    if (data.employees) {
      data.employees.forEach(emp => {
        if (selectedLegalEntity === 'All' || emp.legalEntity === selectedLegalEntity) {
          locs.add(emp.location);
        }
      });
    }
    if (data.headcountData) {
      data.headcountData.forEach(hc => {
        if (selectedLegalEntity === 'All' || hc.legalEntity === selectedLegalEntity) {
          locs.add(hc.location);
        }
      });
    }
    return ['All', ...Array.from(locs).sort()];
  }, [data.employees, data.headcountData, selectedLegalEntity]);

  // Filtered data
  const filteredData = useMemo(() => {
    if (!data.headcountData) return [];
    return data.headcountData.filter(hc => {
      if (selectedLegalEntity !== 'All' && hc.legalEntity !== selectedLegalEntity) return false;
      if (selectedLocation !== 'All' && hc.location !== selectedLocation) return false;
      if (selectedDepartment !== 'All' && hc.department !== selectedDepartment) return false;
      return true;
    });
  }, [data.headcountData, selectedLegalEntity, selectedLocation, selectedDepartment]);

  // Group data for matrix view
  interface MatrixCell {
    [location: string]: {
      approved: number;
      actual: number;
      variance: number;
    };
  }

  interface MatrixRow {
    legalEntity: string;
    department: string;
    subDepartment: string;
    locations: MatrixCell;
    approvedTotal: number;
    actualTotal: number;
    varianceTotal: number;
  }

  const matrixData = useMemo((): MatrixRow[] => {
    const grouped = new Map<string, MatrixRow>();

    // First, process actual headcount from employees
    const activeEmployees = (data.employees || []).filter(emp => {
      if (emp.activeStatus !== 'Active' && emp.activeStatus !== 'active') return false;
      if (selectedLegalEntity !== 'All' && emp.legalEntity !== selectedLegalEntity) return false;
      if (selectedLocation !== 'All' && emp.location !== selectedLocation) return false;
      if (selectedDepartment !== 'All' && emp.department !== selectedDepartment) return false;
      return true;
    });

    activeEmployees.forEach(emp => {
      const key = `${emp.legalEntity}|${emp.department}|${emp.subDepartment}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          legalEntity: emp.legalEntity,
          department: emp.department,
          subDepartment: emp.subDepartment,
          locations: {},
          approvedTotal: 0,
          actualTotal: 0,
          varianceTotal: 0
        });
      }

      const row = grouped.get(key)!;
      if (!row.locations[emp.location]) {
        row.locations[emp.location] = { approved: 0, actual: 0, variance: 0 };
      }
      row.locations[emp.location].actual += 1;
      row.actualTotal += 1;
    });

    // Then, add approved headcount from headcountData
    filteredData.forEach(hc => {
      const key = `${hc.legalEntity}|${hc.department}|${hc.subDepartment}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          legalEntity: hc.legalEntity,
          department: hc.department,
          subDepartment: hc.subDepartment,
          locations: {},
          approvedTotal: 0,
          actualTotal: 0,
          varianceTotal: 0
        });
      }

      const row = grouped.get(key)!;
      if (!row.locations[hc.location]) {
        row.locations[hc.location] = { approved: 0, actual: 0, variance: 0 };
      }
      row.locations[hc.location].approved = hc.approvedHeadcount;
      row.approvedTotal += hc.approvedHeadcount;
    });

    // Calculate variance for each location and row
    grouped.forEach(row => {
      allLocations.forEach(loc => {
        if (row.locations[loc]) {
          row.locations[loc].variance = row.locations[loc].approved - row.locations[loc].actual;
        }
      });
      row.varianceTotal = row.approvedTotal - row.actualTotal;
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const legalEntityCompare = sortLegalEntities(a.legalEntity, b.legalEntity);
      if (legalEntityCompare !== 0) return legalEntityCompare;
      if (a.department !== b.department) return a.department.localeCompare(b.department);
      return a.subDepartment.localeCompare(b.subDepartment);
    });
  }, [data.employees, filteredData, selectedLegalEntity, selectedLocation, selectedDepartment, allLocations]);

  // Calculate column totals
  const columnTotals = useMemo(() => {
    const totals: { [location: string]: { approved: number; actual: number; variance: number } } = {};
    allLocations.forEach(loc => totals[loc] = { approved: 0, actual: 0, variance: 0 });

    matrixData.forEach(row => {
      allLocations.forEach(loc => {
        if (row.locations[loc]) {
          totals[loc].approved += row.locations[loc].approved;
          totals[loc].actual += row.locations[loc].actual;
          totals[loc].variance += row.locations[loc].variance;
        }
      });
    });

    return totals;
  }, [matrixData, allLocations]);

  const grandTotals = useMemo(() => {
    return {
      approved: matrixData.reduce((sum, row) => sum + row.approvedTotal, 0),
      actual: matrixData.reduce((sum, row) => sum + row.actualTotal, 0),
      variance: matrixData.reduce((sum, row) => sum + row.varianceTotal, 0)
    };
  }, [matrixData]);

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
          setUploadedData(newEntries);
        }
      } catch (error) {
        alert('Error reading Excel file. Please check the format.');
        console.error(error);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset file input
  };

  const handleSaveUpload = () => {
    if (uploadedData) {
      onUpdate([...data.headcountData, ...uploadedData]);
      alert(`Successfully imported ${uploadedData.length} headcount entries`);
      setUploadedData(null);
    }
  };

  const handleCancelUpload = () => {
    setUploadedData(null);
  };

  // Export current data
  const handleExport = () => {
    // Create header row with location columns
    const headerRow1 = ['Legal Entity', 'Department', 'Sub Department'];
    const headerRow2 = ['', '', ''];

    allLocations.forEach(loc => {
      headerRow1.push(loc, '', '');
      headerRow2.push('Approved', 'Actual', 'Variance');
    });
    headerRow1.push('Total', '', '');
    headerRow2.push('Approved', 'Actual', 'Variance');

    const exportData = [headerRow1, headerRow2];

    // Add data rows
    matrixData.forEach(row => {
      const dataRow = [row.legalEntity, row.department, row.subDepartment];
      allLocations.forEach(loc => {
        const cell = row.locations[loc];
        dataRow.push(
          cell ? cell.approved : 0,
          cell ? cell.actual : 0,
          cell ? cell.variance : 0
        );
      });
      dataRow.push(row.approvedTotal, row.actualTotal, row.varianceTotal);
      exportData.push(dataRow);
    });

    // Add totals row
    const totalsRow = ['Total', '', ''];
    allLocations.forEach(loc => {
      totalsRow.push(
        columnTotals[loc]?.approved || 0,
        columnTotals[loc]?.actual || 0,
        columnTotals[loc]?.variance || 0
      );
    });
    totalsRow.push(grandTotals.approved, grandTotals.actual, grandTotals.variance);
    exportData.push(totalsRow);

    const ws = XLSX.utils.aoa_to_sheet(exportData);

    // Merge cells for location headers
    const merges = [];
    let colIndex = 3; // Start after Legal Entity, Department, Sub Department
    allLocations.forEach(() => {
      merges.push({
        s: { r: 0, c: colIndex },
        e: { r: 0, c: colIndex + 2 }
      });
      colIndex += 3;
    });
    // Merge Total header
    merges.push({
      s: { r: 0, c: colIndex },
      e: { r: 0, c: colIndex + 2 }
    });
    ws['!merges'] = merges;

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

        {/* Upload Confirmation */}
        {uploadedData && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-black text-yellow-900">
                  {uploadedData.length} entries ready to import
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Click "Save" to confirm or "Cancel" to discard
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveUpload}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-bold text-sm uppercase tracking-widest"
                >
                  <Save size={18} />
                  Save
                </button>
                <button
                  onClick={handleCancelUpload}
                  className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold text-sm uppercase tracking-widest"
                >
                  <X size={18} />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
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
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
                Location:
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              >
                {locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
                Department:
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="ml-auto text-sm font-bold text-slate-600">
              Approved: {grandTotals.approved} | Actual: {grandTotals.actual} | Variance: {grandTotals.variance}
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          {matrixData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <Users size={64} className="text-slate-300 mb-4" />
              <p className="text-xl font-bold text-slate-700 mb-2">No Data Available</p>
              <p className="text-sm text-slate-500 mb-6 text-center">
                No active employees found. Upload employee data or add headcount entries to get started.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-bold text-sm uppercase tracking-widest"
              >
                <Plus size={18} />
                Add Approved Headcount
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                <tr>
                  <th rowSpan={2} className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest sticky left-0 bg-slate-900 border-r border-slate-700">Legal Entity</th>
                  <th rowSpan={2} className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest border-r border-slate-700">Department</th>
                  <th rowSpan={2} className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest border-r border-slate-700">Sub Department</th>
                  {allLocations.map(loc => (
                    <th key={loc} colSpan={3} className="px-4 py-2 text-center text-xs font-black uppercase tracking-widest border-r border-slate-700">{loc}</th>
                  ))}
                  <th colSpan={3} className="px-4 py-2 text-center text-xs font-black uppercase tracking-widest bg-blue-900 border-r border-slate-700">Total</th>
                  <th rowSpan={2} className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Actions</th>
                </tr>
                <tr>
                  {allLocations.map(loc => (
                    <React.Fragment key={loc}>
                      <th className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide bg-purple-800 border-r border-slate-700">Approved</th>
                      <th className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide bg-green-800 border-r border-slate-700">Actual</th>
                      <th className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide bg-blue-800 border-r border-slate-700">Variance</th>
                    </React.Fragment>
                  ))}
                  <th className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide bg-purple-900 border-r border-slate-700">Approved</th>
                  <th className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide bg-green-900 border-r border-slate-700">Actual</th>
                  <th className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide bg-blue-900 border-r border-slate-700">Variance</th>
                </tr>
              </thead>
              <tbody>
                {matrixData.map((row, idx) => (
                  <tr key={`${row.legalEntity}-${row.department}-${row.subDepartment}`} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900 sticky left-0 bg-inherit border-r border-slate-200">{row.legalEntity}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700 border-r border-slate-200">{row.department}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700 border-r border-slate-200">{row.subDepartment}</td>
                    {allLocations.map(loc => {
                      const cell = row.locations[loc];
                      const variance = cell ? cell.variance : 0;
                      const varianceColor = variance > 0 ? 'text-green-700' : variance < 0 ? 'text-red-700' : 'text-slate-700';
                      return (
                        <React.Fragment key={loc}>
                          <td className="px-2 py-3 text-center text-sm font-bold text-purple-700 bg-purple-50 border-r border-slate-200">
                            {cell ? (cell.approved || '-') : '-'}
                          </td>
                          <td className="px-2 py-3 text-center text-sm font-bold text-green-700 bg-green-50 border-r border-slate-200">
                            {cell ? cell.actual : '-'}
                          </td>
                          <td className={`px-2 py-3 text-center text-sm font-bold ${varianceColor} bg-blue-50 border-r border-slate-200`}>
                            {cell ? cell.variance : '-'}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-2 py-3 text-center text-sm font-black text-purple-700 bg-purple-100 border-r border-slate-200">{row.approvedTotal}</td>
                    <td className="px-2 py-3 text-center text-sm font-black text-green-700 bg-green-100 border-r border-slate-200">{row.actualTotal}</td>
                    <td className={`px-2 py-3 text-center text-sm font-black ${row.varianceTotal > 0 ? 'text-green-700' : row.varianceTotal < 0 ? 'text-red-700' : 'text-slate-700'} bg-blue-100 border-r border-slate-200`}>{row.varianceTotal}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          setEditingRow({
                            legalEntity: row.legalEntity,
                            department: row.department,
                            subDepartment: row.subDepartment
                          });
                          // Populate current approved values for each location
                          const approvals: { [location: string]: number } = {};
                          allLocations.forEach(loc => {
                            const existing = data.headcountData?.find(hc =>
                              hc.legalEntity === row.legalEntity &&
                              hc.department === row.department &&
                              hc.subDepartment === row.subDepartment &&
                              hc.location === loc
                            );
                            approvals[loc] = existing?.approvedHeadcount || 0;
                          });
                          setLocationApprovals(approvals);
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                        title="Edit Approved Headcount"
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Column Totals Row */}
                <tr className="bg-gradient-to-r from-slate-800 to-slate-900 text-white font-black">
                  <td colSpan={3} className="px-4 py-3 text-sm uppercase tracking-widest border-r border-slate-700">Total</td>
                  {allLocations.map(loc => (
                    <React.Fragment key={loc}>
                      <td className="px-2 py-3 text-center text-sm bg-purple-900 border-r border-slate-700">{columnTotals[loc]?.approved || 0}</td>
                      <td className="px-2 py-3 text-center text-sm bg-green-900 border-r border-slate-700">{columnTotals[loc]?.actual || 0}</td>
                      <td className="px-2 py-3 text-center text-sm bg-blue-900 border-r border-slate-700">{columnTotals[loc]?.variance || 0}</td>
                    </React.Fragment>
                  ))}
                  <td className="px-2 py-3 text-center text-sm bg-purple-950 border-r border-slate-700">{grandTotals.approved}</td>
                  <td className="px-2 py-3 text-center text-sm bg-green-950 border-r border-slate-700">{grandTotals.actual}</td>
                  <td className="px-2 py-3 text-center text-sm bg-blue-950 border-r border-slate-700">{grandTotals.variance}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingRow && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-black text-slate-900 mb-2">Edit Approved Headcount</h2>
              <p className="text-sm text-slate-600 mb-4">
                {editingRow.legalEntity} | {editingRow.department} | {editingRow.subDepartment}
              </p>

              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-300">
                      <th className="px-4 py-2 text-left text-xs font-black text-slate-700 uppercase">Location</th>
                      <th className="px-4 py-2 text-center text-xs font-black text-purple-700 uppercase">Approved</th>
                      <th className="px-4 py-2 text-center text-xs font-black text-green-700 uppercase">Actual</th>
                      <th className="px-4 py-2 text-center text-xs font-black text-blue-700 uppercase">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allLocations.map(loc => {
                      const actual = matrixData.find(row =>
                        row.legalEntity === editingRow.legalEntity &&
                        row.department === editingRow.department &&
                        row.subDepartment === editingRow.subDepartment
                      )?.locations[loc]?.actual || 0;

                      const approved = locationApprovals[loc] || 0;
                      const variance = approved - actual;
                      const varianceColor = variance > 0 ? 'text-green-700' : variance < 0 ? 'text-red-700' : 'text-slate-700';

                      return (
                        <tr key={loc} className="border-b border-slate-200">
                          <td className="px-4 py-3 text-sm font-bold text-slate-900">{loc}</td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="0"
                              value={locationApprovals[loc] || 0}
                              onChange={(e) => setLocationApprovals({
                                ...locationApprovals,
                                [loc]: parseInt(e.target.value) || 0
                              })}
                              className="w-24 px-3 py-2 border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:outline-none text-sm font-bold text-center bg-purple-50"
                            />
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-green-700 bg-green-50">{actual}</td>
                          <td className={`px-4 py-3 text-center text-sm font-bold ${varianceColor} bg-blue-50`}>{variance}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (!editingRow) return;

                    // Update or create headcount entries for each location
                    const updatedData = [...(data.headcountData || [])];

                    allLocations.forEach(loc => {
                      const approvedValue = locationApprovals[loc] || 0;
                      const existingIndex = updatedData.findIndex(hc =>
                        hc.legalEntity === editingRow.legalEntity &&
                        hc.department === editingRow.department &&
                        hc.subDepartment === editingRow.subDepartment &&
                        hc.location === loc
                      );

                      if (existingIndex >= 0) {
                        // Update existing
                        updatedData[existingIndex] = {
                          ...updatedData[existingIndex],
                          approvedHeadcount: approvedValue
                        };
                      } else if (approvedValue > 0) {
                        // Create new entry only if approved value is > 0
                        updatedData.push({
                          id: `hc_${Date.now()}_${loc}`,
                          legalEntity: editingRow.legalEntity,
                          location: loc,
                          department: editingRow.department,
                          subDepartment: editingRow.subDepartment,
                          approvedHeadcount: approvedValue
                        });
                      }
                    });

                    onUpdate(updatedData);
                    setEditingRow(null);
                    setLocationApprovals({});
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-bold text-sm uppercase tracking-widest"
                >
                  <Save size={18} />
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setEditingRow(null);
                    setLocationApprovals({});
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

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-black text-slate-900 mb-4">Add Approved Headcount Entry</h2>
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
