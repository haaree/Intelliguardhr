import React, { useState, useMemo } from 'react';
import { FileText, Download, Calendar, User } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AppData, UserRole, ReconciliationRecord, AuditQueueRecord } from '../types';

interface ManagerPDFReportProps {
  data: AppData;
  role: UserRole;
}

interface ViolationCounts {
  present: number;
  absent: number;
  offDay: number;
  workedOff: number;
  errors: number;
  lateEarly: number;
  lessThan4hrs: number;
  hours4to7: number;
  shiftDeviation: number;
  missingPunch: number;
  otherViolations: number;
}

// Extended record type for Manager PDF Report with all display fields
interface EnrichedRecord {
  employeeNumber: string;
  employeeName: string;
  date: string;
  jobTitle?: string;
  department?: string;
  subDepartment?: string;
  location?: string;
  reportingManager?: string;
  shift?: string;
  shiftStart?: string;
  inTime?: string;
  outTime?: string;
  totalHours?: string;
  absentStatus?: string;
  excelStatus?: string;
  finalStatus?: string;
  comments?: string;
  deviation?: string;
  lateBy?: string;
  earlyBy?: string;
  auditReason?: string;
  reviewStatus?: string;
}

interface ManagerData {
  managerName: string;
  legalEntity?: string;
  location?: string;
  department?: string;
  subDepartment?: string;
  violations: ViolationCounts;
  details: {
    present: EnrichedRecord[];
    absent: EnrichedRecord[];
    offDay: EnrichedRecord[];
    workedOff: EnrichedRecord[];
    errors: EnrichedRecord[];
    lateEarly: EnrichedRecord[];
    lessThan4hrs: EnrichedRecord[];
    hours4to7: EnrichedRecord[];
    shiftDeviation: EnrichedRecord[];
    missingPunch: EnrichedRecord[];
    otherViolations: EnrichedRecord[];
  };
}

const ManagerPDFReport: React.FC<ManagerPDFReportProps> = ({ data, role }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedManager, setSelectedManager] = useState('All');
  const [selectedLegalEntity, setSelectedLegalEntity] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedSubDepartment, setSelectedSubDepartment] = useState('All');

  const isAdmin = role === 'SaaS_Admin' || role === 'Admin';

  // Get unique managers from attendance records
  const managers = useMemo(() => {
    const managerSet = new Set<string>();

    // From attendance records
    data.attendance.forEach(att => {
      if (att.reportingManager) managerSet.add(att.reportingManager);
    });

    return ['All', ...Array.from(managerSet).sort()];
  }, [data]);

  // Get unique legal entities
  const legalEntities = useMemo(() => {
    const entitySet = new Set<string>();
    data.attendance.forEach(att => {
      if (att.legalEntity) entitySet.add(att.legalEntity);
    });
    return ['All', ...Array.from(entitySet).sort()];
  }, [data]);

  // Get unique locations
  const locations = useMemo(() => {
    const locationSet = new Set<string>();
    data.attendance.forEach(att => {
      if (att.location) locationSet.add(att.location);
    });
    return ['All', ...Array.from(locationSet).sort()];
  }, [data]);

  // Get unique departments
  const departments = useMemo(() => {
    const deptSet = new Set<string>();
    data.attendance.forEach(att => {
      if (att.department) deptSet.add(att.department);
    });
    return ['All', ...Array.from(deptSet).sort()];
  }, [data]);

  // Get unique sub departments
  const subDepartments = useMemo(() => {
    const subDeptSet = new Set<string>();
    data.attendance.forEach(att => {
      if (att.subDepartment) subDeptSet.add(att.subDepartment);
    });
    return ['All', ...Array.from(subDeptSet).sort()];
  }, [data]);

  // Helper: Parse hours from time string
  const parseHours = (timeStr: string): number => {
    if (!timeStr || timeStr === 'NA' || timeStr === '-') return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours + minutes / 60;
  };

  // Helper: Convert DD-MMM-YYYY to YYYY-MM-DD format
  const convertDDMMMYYYYtoYYYYMMDD = (dateStr: string): string => {
    // Input format: '01-FEB-2026'
    // Output format: '2026-02-01'
    const monthMap: { [key: string]: string } = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
      'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
      'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
    };

    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr; // Return as-is if format is unexpected

    const day = parts[0];
    const month = monthMap[parts[1].toUpperCase()] || '01';
    const year = parts[2];

    return `${year}-${month}-${day}`;
  };

  // Helper: Format date to DD/MMM/YYYY
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Categorize audit queue record
  const categorizeAuditRecord = (record: AuditQueueRecord): string => {
    const reason = record.auditReason?.toLowerCase() || '';

    if (reason.includes('late') || reason.includes('early')) return 'lateEarly';
    if (reason.includes('missing') || reason.includes('punch')) return 'missingPunch';
    if (reason.includes('error') || reason.includes('id')) return 'errors';

    // Check for short hours - lookup attendance record to get actual hours
    if (reason.includes('short') || reason.includes('hour')) {
      const attRecord = data.attendance.find(
        att => att.employeeNumber === record.employeeNumber && att.date === record.date
      );

      if (attRecord) {
        const effectiveHours = parseHours(attRecord.effectiveHours);
        if (effectiveHours > 0 && effectiveHours < 4) return 'lessThan4hrs';
        if (effectiveHours >= 4 && effectiveHours < 7) return 'hours4to7';
      }
    }

    return 'otherViolations';
  };

  // Process data for selected manager and date range
  // This creates detailed reports with entity/location/dept breakdown for PDF/Excel
  const detailedManagerReportData = useMemo((): ManagerData[] => {
    if (!fromDate || !toDate) return [];

    const reports = new Map<string, ManagerData>();

    data.attendance.forEach(att => {
      // Date filter - attendance dates are in DD-MMM-YYYY format (e.g., '01-FEB-2026')
      // Convert to YYYY-MM-DD for comparison
      const recordDate = att.date;
      const normalizedDate = convertDDMMMYYYYtoYYYYMMDD(recordDate);

      // Filter by date range
      if (normalizedDate < fromDate || normalizedDate > toDate) {
        return;
      }

      // Get employee details for filters
      const employee = data.employees.find(e => e.employeeNumber === att.employeeNumber);

      // Entity filters
      if (selectedLegalEntity !== 'All' && employee?.legalEntity !== selectedLegalEntity) return;
      if (selectedLocation !== 'All' && att.location !== selectedLocation) return;
      if (selectedDepartment !== 'All' && att.department !== selectedDepartment) return;
      if (selectedSubDepartment !== 'All' && att.subDepartment !== selectedSubDepartment) return;

      // Manager filter
      const manager = att.reportingManager || 'Unknown';
      if (selectedManager !== 'All' && manager !== selectedManager) {
        return;
      }

      // Create a unique key based on selected filters
      // This allows grouping by legal entity, location, dept, subdept when "All" is selected
      const legalEntity = employee?.legalEntity || 'Unknown';
      const location = att.location || 'Unknown';
      const department = att.department || 'Unknown';
      const subDepartment = att.subDepartment || 'Unknown';

      let reportKey = manager;
      if (selectedLegalEntity === 'All') reportKey += `|${legalEntity}`;
      if (selectedLocation === 'All') reportKey += `|${location}`;
      if (selectedDepartment === 'All') reportKey += `|${department}`;
      if (selectedSubDepartment === 'All') reportKey += `|${subDepartment}`;

      // Initialize manager data if needed
      if (!reports.has(reportKey)) {
        reports.set(reportKey, {
          managerName: manager,
          legalEntity: selectedLegalEntity === 'All' ? legalEntity : selectedLegalEntity,
          location: selectedLocation === 'All' ? location : selectedLocation,
          department: selectedDepartment === 'All' ? department : selectedDepartment,
          subDepartment: selectedSubDepartment === 'All' ? subDepartment : selectedSubDepartment,
          violations: {
            present: 0,
            absent: 0,
            offDay: 0,
            workedOff: 0,
            errors: 0,
            lateEarly: 0,
            lessThan4hrs: 0,
            hours4to7: 0,
            shiftDeviation: 0,
            missingPunch: 0,
            otherViolations: 0
          },
          details: {
            present: [],
            absent: [],
            offDay: [],
            workedOff: [],
            errors: [],
            lateEarly: [],
            lessThan4hrs: [],
            hours4to7: [],
            shiftDeviation: [],
            missingPunch: [],
            otherViolations: []
          }
        });
      }

      const managerData = reports.get(reportKey)!;

      // Look up reconciliation record for this employee and date to get Excel upload status
      const reconRecord = data.reconciliationRecords?.find(
        rec => rec.employeeNumber === att.employeeNumber && rec.date === att.date
      );

      // Create an enriched record from attendance for display
      const enrichedRec: EnrichedRecord = {
        employeeNumber: att.employeeNumber,
        employeeName: att.employeeName,
        date: att.date,
        jobTitle: att.jobTitle || employee?.jobTitle || '-',
        location: att.location,
        department: att.department,
        subDepartment: att.subDepartment,
        reportingManager: att.reportingManager,
        shift: att.shift || '-',
        shiftStart: att.shiftStart || '-',
        inTime: att.inTime || '-',
        outTime: att.outTime || '-',
        totalHours: att.totalHours || '00:00',
        absentStatus: att.status,
        excelStatus: reconRecord?.excelStatus || '-',
        finalStatus: reconRecord?.finalStatus || att.status,
        comments: reconRecord?.comments || att.deviation || '',
        deviation: att.deviation || '',
        lateBy: att.lateBy,
        earlyBy: att.earlyBy
      };

      // Get the attendance status to categorize records - matching Reconciliation Hub exactly
      const attStatus = att.status || '';
      const deviation = att.deviation || '';

      // Categorize records using the EXACT same logic as Reconciliation Hub (lines 247-259)
      if (attStatus === 'Absent' || attStatus === 'A') {
        managerData.details.absent.push(enrichedRec);
        managerData.violations.absent++;
      } else if (attStatus === 'Clean' || attStatus === 'P' || attStatus === 'Present') {
        managerData.details.present.push(enrichedRec);
        managerData.violations.present++;
      } else if (attStatus === 'Worked Off' || attStatus === 'WOH') {
        managerData.details.workedOff.push(enrichedRec);
        managerData.violations.workedOff++;
      } else if (attStatus === 'Weekly Off' || attStatus === 'WO' || attStatus === 'Holiday' || attStatus === 'H') {
        managerData.details.offDay.push(enrichedRec);
        managerData.violations.offDay++;
      } else if (attStatus === 'ID Error' || attStatus.includes('Error')) {
        managerData.details.errors.push(enrichedRec);
        managerData.violations.errors++;
      } else if (attStatus === 'Audit' || attStatus === 'Very Late' || deviation) {
        // This is an audit record - sub-categorize it using categorizeAuditRecord logic
        // Missing Punches - highest priority
        if (deviation.includes('Missing') || deviation.includes('Punch')) {
          managerData.details.missingPunch.push(enrichedRec);
          managerData.violations.missingPunch++;
        }
        // Shift Deviations
        else if (deviation.includes('Shift') || deviation.includes('Very Early')) {
          managerData.details.shiftDeviation.push(enrichedRec);
          managerData.violations.shiftDeviation++;
        }
        // Check total work hours for hours-based categorization
        else {
          const totalHours = att.totalHours || '00:00';
          const [hoursStr, minutesStr] = totalHours.split(':');
          const totalWorkHours = parseFloat(hoursStr) + parseFloat(minutesStr || '0') / 60;

          // Hours-based categories (priority over frequency)
          if (totalWorkHours > 0 && totalWorkHours < 4) {
            managerData.details.lessThan4hrs.push(enrichedRec);
            managerData.violations.lessThan4hrs++;
          } else if (totalWorkHours >= 4 && totalWorkHours < 7) {
            managerData.details.hours4to7.push(enrichedRec);
            managerData.violations.hours4to7++;
          } else {
            // Check if it's a late/early violation
            const lateBy = att.lateBy || '00:00';
            const earlyBy = att.earlyBy || '00:00';
            const isLateOrEarly = (lateBy && lateBy !== '00:00') || (earlyBy && earlyBy !== '00:00');

            if (isLateOrEarly) {
              managerData.details.lateEarly.push(enrichedRec);
              managerData.violations.lateEarly++;
            } else {
              // All other violations (working > 16 hours, or other deviations)
              managerData.details.otherViolations.push(enrichedRec);
              managerData.violations.otherViolations++;
            }
          }
        }
      }
    });

    return Array.from(reports.values()).sort((a, b) =>
      a.managerName.localeCompare(b.managerName)
    );
  }, [data, fromDate, toDate, selectedManager, selectedLegalEntity, selectedLocation, selectedDepartment, selectedSubDepartment]);

  // Consolidated data for GUI display - aggregate by manager name only
  const managerReportData = useMemo((): ManagerData[] => {
    if (!detailedManagerReportData.length) return [];

    const consolidated = new Map<string, ManagerData>();

    detailedManagerReportData.forEach(report => {
      const managerName = report.managerName;

      if (!consolidated.has(managerName)) {
        consolidated.set(managerName, {
          managerName,
          legalEntity: undefined,
          location: undefined,
          department: undefined,
          subDepartment: undefined,
          violations: {
            present: 0,
            absent: 0,
            offDay: 0,
            workedOff: 0,
            errors: 0,
            lateEarly: 0,
            lessThan4hrs: 0,
            hours4to7: 0,
            shiftDeviation: 0,
            missingPunch: 0,
            otherViolations: 0
          },
          details: {
            present: [],
            absent: [],
            offDay: [],
            workedOff: [],
            errors: [],
            lateEarly: [],
            lessThan4hrs: [],
            hours4to7: [],
            shiftDeviation: [],
            missingPunch: [],
            otherViolations: []
          }
        });
      }

      const consolidatedData = consolidated.get(managerName)!;

      // Aggregate violation counts
      consolidatedData.violations.present += report.violations.present;
      consolidatedData.violations.absent += report.violations.absent;
      consolidatedData.violations.offDay += report.violations.offDay;
      consolidatedData.violations.workedOff += report.violations.workedOff;
      consolidatedData.violations.errors += report.violations.errors;
      consolidatedData.violations.lateEarly += report.violations.lateEarly;
      consolidatedData.violations.lessThan4hrs += report.violations.lessThan4hrs;
      consolidatedData.violations.hours4to7 += report.violations.hours4to7;
      consolidatedData.violations.shiftDeviation += report.violations.shiftDeviation;
      consolidatedData.violations.missingPunch += report.violations.missingPunch;
      consolidatedData.violations.otherViolations += report.violations.otherViolations;
    });

    return Array.from(consolidated.values()).sort((a, b) =>
      a.managerName.localeCompare(b.managerName)
    );
  }, [detailedManagerReportData]);

  // Generate consolidated PDF for a manager (includes all entity/location/dept combinations)
  const generateConsolidatedPDF = (managerReports: ManagerData[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;
    const managerName = managerReports[0].managerName;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Attendance Report Summary', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Report Details - Only show Manager and Period in header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Manager: ${managerName}`, 14, yPos);
    yPos += 6;
    doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, yPos);
    yPos += 6;
    doc.text(`Generated: ${formatDate(new Date().toISOString().split('T')[0])}`, 14, yPos);
    yPos += 10;

    // Overall Summary Table (aggregated across all entities/locations/depts)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Overall Summary', 14, yPos);
    yPos += 5;

    // Calculate aggregated totals
    const aggregated = {
      present: 0,
      absent: 0,
      offDay: 0,
      workedOff: 0,
      errors: 0,
      lateEarly: 0,
      lessThan4hrs: 0,
      hours4to7: 0,
      shiftDeviation: 0,
      missingPunch: 0,
      otherViolations: 0
    };

    managerReports.forEach(report => {
      aggregated.present += report.violations.present;
      aggregated.absent += report.violations.absent;
      aggregated.offDay += report.violations.offDay;
      aggregated.workedOff += report.violations.workedOff;
      aggregated.errors += report.violations.errors;
      aggregated.lateEarly += report.violations.lateEarly;
      aggregated.lessThan4hrs += report.violations.lessThan4hrs;
      aggregated.hours4to7 += report.violations.hours4to7;
      aggregated.shiftDeviation += report.violations.shiftDeviation;
      aggregated.missingPunch += report.violations.missingPunch;
      aggregated.otherViolations += report.violations.otherViolations;
    });

    const total = Object.values(aggregated).reduce((sum, v) => sum + v, 0);

    autoTable(doc, {
      startY: yPos,
      head: [['Violation Type', 'Count']],
      body: [
        ['Present', aggregated.present],
        ['Absent', aggregated.absent],
        ['Off Day', aggregated.offDay],
        ['Worked Off', aggregated.workedOff],
        ['Errors', aggregated.errors],
        ['Late & Early Occurrence', aggregated.lateEarly],
        ['Worked < 4 hours', aggregated.lessThan4hrs],
        ['Worked 4-7 hours', aggregated.hours4to7],
        ['Shift Deviation', aggregated.shiftDeviation],
        ['Missing Punch', aggregated.missingPunch],
        ['Others', aggregated.otherViolations]
      ],
      foot: [['Total', total]],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Now process each organizational unit (entity/location/dept combination)
    managerReports.forEach((managerData, reportIndex) => {
      // Add page break before each new organizational unit (except first)
      if (reportIndex > 0) {
        doc.addPage();
        yPos = 20;
      }

      // Section header showing the organizational context
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const contextParts: string[] = [];
      if (managerData.legalEntity && managerData.legalEntity !== 'Unknown') {
        contextParts.push(managerData.legalEntity);
      }
      if (managerData.location && managerData.location !== 'Unknown') {
        contextParts.push(managerData.location);
      }
      if (managerData.department && managerData.department !== 'Unknown') {
        contextParts.push(managerData.department);
      }
      if (managerData.subDepartment && managerData.subDepartment !== 'Unknown') {
        contextParts.push(managerData.subDepartment);
      }

      if (contextParts.length > 0) {
        doc.text(contextParts.join(' - '), 14, yPos);
        yPos += 8;
      }

      // Summary for this organizational unit
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', 14, yPos);
      yPos += 5;

      const unitTotal = managerData.violations.present +
                        managerData.violations.absent +
                        managerData.violations.offDay +
                        managerData.violations.workedOff +
                        managerData.violations.errors +
                        managerData.violations.lateEarly +
                        managerData.violations.lessThan4hrs +
                        managerData.violations.hours4to7 +
                        managerData.violations.shiftDeviation +
                        managerData.violations.missingPunch +
                        managerData.violations.otherViolations;

      autoTable(doc, {
        startY: yPos,
        head: [['Violation Type', 'Count']],
        body: [
          ['Present', managerData.violations.present],
          ['Absent', managerData.violations.absent],
          ['Off Day', managerData.violations.offDay],
          ['Worked Off', managerData.violations.workedOff],
          ['Errors', managerData.violations.errors],
          ['Late & Early Occurrence', managerData.violations.lateEarly],
          ['Worked < 4 hours', managerData.violations.lessThan4hrs],
          ['Worked 4-7 hours', managerData.violations.hours4to7],
          ['Shift Deviation', managerData.violations.shiftDeviation],
          ['Missing Punch', managerData.violations.missingPunch],
          ['Others', managerData.violations.otherViolations]
        ],
        foot: [['Total', unitTotal]],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Detailed Sections for this organizational unit
      const addDetailSection = (title: string, records: any[], isAudit: boolean = false) => {
        if (records.length === 0) return;

        // Check if we need a new page
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, yPos);
        yPos += 5;

        if (isAudit) {
          // Audit records should show shift details, deviation, late/early info
          autoTable(doc, {
            startY: yPos,
            head: [['Employee ID', 'Employee Name', 'Date', 'Dept', 'Sub Dept', 'Shift', 'Shift Start', 'In Time', 'Out Time', 'Work Hrs', 'Deviation', 'Late By', 'Early By', 'Keka Status']],
            body: records.map((rec: any) => [
              rec.employeeNumber,
              rec.employeeName,
              rec.date,
              rec.department || '-',
              rec.subDepartment || '-',
              rec.shift || '-',
              rec.shiftStart || '-',
              rec.inTime || '-',
              rec.outTime || '-',
              rec.totalHours || '-',
              rec.deviation || '-',
              rec.lateBy || '-',
              rec.earlyBy || '-',
              rec.excelStatus || '-'
            ]),
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246], textColor: 255 },
            styles: { fontSize: 5.5 },
            margin: { left: 14, right: 14 }
          });
        } else {
          autoTable(doc, {
            startY: yPos,
            head: [['Employee ID', 'Employee Name', 'Date', 'Department', 'Sub Department', 'Shift', 'Shift Start', 'In Time', 'Out Time', 'Work Hours', 'Keka Status']],
            body: records.map((rec: any) => [
              rec.employeeNumber,
              rec.employeeName,
              rec.date,
              rec.department || '-',
              rec.subDepartment || '-',
              rec.shift || '-',
              rec.shiftStart || '-',
              rec.inTime || '-',
              rec.outTime || '-',
              rec.totalHours || '-',
              rec.excelStatus || '-'
            ]),
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246], textColor: 255 },
            styles: { fontSize: 6 },
            margin: { left: 14, right: 14 }
          });
        }

        yPos = (doc as any).lastAutoTable.finalY + 10;
      };

      // Add all detail sections for this unit (excluding Present and Off Day to save pages)
      addDetailSection('Absent', managerData.details.absent);
      addDetailSection('Worked Off', managerData.details.workedOff);
      addDetailSection('Errors', managerData.details.errors, true);
      addDetailSection('Late & Early Occurrence', managerData.details.lateEarly, true);
      addDetailSection('Worked < 4 Hours', managerData.details.lessThan4hrs, true);
      addDetailSection('Worked 4-7 Hours', managerData.details.hours4to7, true);
      addDetailSection('Shift Deviation', managerData.details.shiftDeviation, true);
      addDetailSection('Missing Punch', managerData.details.missingPunch, true);
      addDetailSection('Others', managerData.details.otherViolations, true);
    });

    // Save consolidated PDF
    const fileName = `Manager_Report_${managerName.replace(/\s+/g, '_')}_${fromDate}_to_${toDate}.pdf`;
    doc.save(fileName);
  };

  // Generate individual PDF
  const handleIndividualPDF = () => {
    if (!fromDate || !toDate) {
      alert('Please select both from and to dates');
      return;
    }

    if (selectedManager === 'All') {
      alert('Please select a specific manager for individual PDF');
      return;
    }

    // Get all detailed reports for this manager (all entity/location/dept combinations)
    const managerReports = detailedManagerReportData.filter(m => m.managerName === selectedManager);
    if (managerReports.length === 0) {
      alert('No data found for selected manager in the date range');
      return;
    }

    // Generate single consolidated PDF with all organizational units
    generateConsolidatedPDF(managerReports);
  };

  // Generate bulk PDFs
  const handleBulkPDF = () => {
    if (!fromDate || !toDate) {
      alert('Please select both from and to dates');
      return;
    }

    if (detailedManagerReportData.length === 0) {
      alert('No data found for the selected date range');
      return;
    }

    // Group reports by manager name
    const reportsByManager = new Map<string, ManagerData[]>();
    detailedManagerReportData.forEach(report => {
      const existing = reportsByManager.get(report.managerName) || [];
      existing.push(report);
      reportsByManager.set(report.managerName, existing);
    });

    // Generate one consolidated PDF per manager
    const managers = Array.from(reportsByManager.entries());
    managers.forEach(([managerName, reports], index) => {
      setTimeout(() => {
        generateConsolidatedPDF(reports);
      }, index * 500); // Delay to prevent browser blocking multiple downloads
    });

    alert(`Generating ${managers.length} PDF reports (one per manager). Please allow multiple downloads in your browser.`);
  };

  // Generate consolidated Excel for a manager (includes all entity/location/dept combinations)
  const generateConsolidatedExcel = (managerReports: ManagerData[]) => {
    const wb = XLSX.utils.book_new();
    const managerName = managerReports[0].managerName;

    // Overall Summary Sheet (aggregated across all entities/locations/depts)
    const aggregated = {
      present: 0,
      absent: 0,
      offDay: 0,
      workedOff: 0,
      errors: 0,
      lateEarly: 0,
      lessThan4hrs: 0,
      hours4to7: 0,
      shiftDeviation: 0,
      missingPunch: 0,
      otherViolations: 0
    };

    managerReports.forEach(report => {
      aggregated.present += report.violations.present;
      aggregated.absent += report.violations.absent;
      aggregated.offDay += report.violations.offDay;
      aggregated.workedOff += report.violations.workedOff;
      aggregated.errors += report.violations.errors;
      aggregated.lateEarly += report.violations.lateEarly;
      aggregated.lessThan4hrs += report.violations.lessThan4hrs;
      aggregated.hours4to7 += report.violations.hours4to7;
      aggregated.shiftDeviation += report.violations.shiftDeviation;
      aggregated.missingPunch += report.violations.missingPunch;
      aggregated.otherViolations += report.violations.otherViolations;
    });

    const total = Object.values(aggregated).reduce((sum, v) => sum + v, 0);

    const summaryData: any[] = [
      ['Attendance Report Summary'],
      [],
      ['Manager:', managerName],
      ['Period:', `${formatDate(fromDate)} to ${formatDate(toDate)}`],
      ['Generated:', formatDate(new Date().toISOString().split('T')[0])],
      [],
      ['Overall Summary (All Units)'],
      ['Violation Type', 'Count'],
      ['Present', aggregated.present],
      ['Absent', aggregated.absent],
      ['Off Day', aggregated.offDay],
      ['Worked Off', aggregated.workedOff],
      ['Errors', aggregated.errors],
      ['Late & Early Occurrence', aggregated.lateEarly],
      ['Worked < 4 hours', aggregated.lessThan4hrs],
      ['Worked 4-7 hours', aggregated.hours4to7],
      ['Shift Deviation', aggregated.shiftDeviation],
      ['Missing Punch', aggregated.missingPunch],
      ['Others', aggregated.otherViolations],
      [],
      ['Total', total]
    ];

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Overall Summary');

    // Now create sheets for each organizational unit
    managerReports.forEach((managerData, unitIndex) => {
      // Build context label for sheet naming
      const contextParts: string[] = [];
      if (managerData.legalEntity && managerData.legalEntity !== 'Unknown') {
        contextParts.push(managerData.legalEntity);
      }
      if (managerData.location && managerData.location !== 'Unknown') {
        contextParts.push(managerData.location);
      }
      if (managerData.department && managerData.department !== 'Unknown') {
        contextParts.push(managerData.department);
      }
      if (managerData.subDepartment && managerData.subDepartment !== 'Unknown') {
        contextParts.push(managerData.subDepartment);
      }

      const unitLabel = contextParts.length > 0 ? contextParts.join('-') : `Unit${unitIndex + 1}`;
      const safeUnitLabel = unitLabel.substring(0, 25); // Excel sheet name limit

      // Unit summary
      const unitTotal = managerData.violations.present +
                        managerData.violations.absent +
                        managerData.violations.offDay +
                        managerData.violations.workedOff +
                        managerData.violations.errors +
                        managerData.violations.lateEarly +
                        managerData.violations.lessThan4hrs +
                        managerData.violations.hours4to7 +
                        managerData.violations.shiftDeviation +
                        managerData.violations.missingPunch +
                        managerData.violations.otherViolations;

      const unitSummaryData: any[] = [
        [contextParts.join(' - ')],
        [],
        ['Summary'],
        ['Violation Type', 'Count'],
        ['Present', managerData.violations.present],
        ['Absent', managerData.violations.absent],
        ['Off Day', managerData.violations.offDay],
        ['Worked Off', managerData.violations.workedOff],
        ['Errors', managerData.violations.errors],
        ['Late & Early Occurrence', managerData.violations.lateEarly],
        ['Worked < 4 hours', managerData.violations.lessThan4hrs],
        ['Worked 4-7 hours', managerData.violations.hours4to7],
        ['Shift Deviation', managerData.violations.shiftDeviation],
        ['Missing Punch', managerData.violations.missingPunch],
        ['Others', managerData.violations.otherViolations],
        [],
        ['Total', unitTotal]
      ];

      const unitSummaryWs = XLSX.utils.aoa_to_sheet(unitSummaryData);
      XLSX.utils.book_append_sheet(wb, unitSummaryWs, `${safeUnitLabel}-Summary`);

      // Helper function to add detail sheet for this unit
      const addDetailSheet = (sheetName: string, records: any[], isAudit: boolean = false) => {
        if (records.length === 0) return;

        let data: any[][] = [];

        // Create sheet name with unit prefix
        const finalSheetName = `${safeUnitLabel}-${sheetName}`.substring(0, 31); // Excel sheet name limit

        // Add context as first rows in the sheet
        const headerRows: any[][] = [
          ['Context:', contextParts.join(' - ')],
          []
        ];

        if (isAudit) {
          // Audit records should include shift details and deviation info
          data = [
            ...headerRows,
            ['Employee ID', 'Employee Name', 'Date', 'Job Title', 'Department', 'Sub Department', 'Shift', 'Shift Start', 'In Time', 'Out Time', 'Work Hours', 'Deviation', 'Late By', 'Early By', 'Keka Status', 'Final Status'],
            ...records.map((rec: any) => [
              rec.employeeNumber,
              rec.employeeName,
              rec.date,
              rec.jobTitle || '-',
              rec.department || '-',
              rec.subDepartment || '-',
              rec.shift || '-',
              rec.shiftStart || '-',
              rec.inTime || '-',
              rec.outTime || '-',
              rec.totalHours || '-',
              rec.deviation || '-',
              rec.lateBy || '-',
              rec.earlyBy || '-',
              rec.excelStatus || '-',
              rec.finalStatus || '-'
            ])
          ];
        } else {
          data = [
            ...headerRows,
            ['Employee ID', 'Employee Name', 'Date', 'Job Title', 'Department', 'Sub Department', 'Shift', 'Shift Start', 'In Time', 'Out Time', 'Work Hours', 'Absent Status', 'Keka Status', 'Final Status', 'Comments'],
            ...records.map((rec: any) => [
              rec.employeeNumber,
              rec.employeeName,
              rec.date,
              rec.jobTitle,
              rec.department || '-',
              rec.subDepartment || '-',
              rec.shift || '-',
              rec.shiftStart || '-',
              rec.inTime || '-',
              rec.outTime || '-',
              rec.totalHours || '-',
              rec.absentStatus,
              rec.excelStatus,
              rec.finalStatus,
              rec.comments
            ])
          ];
        }

        const ws = XLSX.utils.aoa_to_sheet(data);

        // Set column widths
        const colWidths = isAudit
          ? [{ wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }]
          : [{ wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }];
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
      };

      // Add all detail sheets for this organizational unit
      addDetailSheet('Absent', managerData.details.absent);
      addDetailSheet('WorkedOff', managerData.details.workedOff);
      addDetailSheet('Errors', managerData.details.errors, true);
      addDetailSheet('LateEarly', managerData.details.lateEarly, true);
      addDetailSheet('Less4hrs', managerData.details.lessThan4hrs, true);
      addDetailSheet('4-7hrs', managerData.details.hours4to7, true);
      addDetailSheet('ShiftDev', managerData.details.shiftDeviation, true);
      addDetailSheet('MissPunch', managerData.details.missingPunch, true);
      addDetailSheet('Others', managerData.details.otherViolations, true);
    });

    // Save Excel file
    const fileName = `Manager_Report_${managerName.replace(/\s+/g, '_')}_${fromDate}_to_${toDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Generate individual Excel (consolidated for all org units of a manager)
  const handleIndividualExcel = () => {
    if (!fromDate || !toDate) {
      alert('Please select both from and to dates');
      return;
    }

    if (selectedManager === 'All') {
      alert('Please select a specific manager for individual Excel');
      return;
    }

    // Get all detailed reports for this manager
    const managerReports = detailedManagerReportData.filter(m => m.managerName === selectedManager);
    if (managerReports.length === 0) {
      alert('No data found for the selected manager');
      return;
    }

    // Generate one consolidated Excel with all organizational units
    generateConsolidatedExcel(managerReports);
  };

  // Generate bulk Excel files (one consolidated file per manager)
  const handleBulkExcel = () => {
    if (!fromDate || !toDate) {
      alert('Please select both from and to dates');
      return;
    }

    if (detailedManagerReportData.length === 0) {
      alert('No data found for the selected date range');
      return;
    }

    // Group reports by manager name
    const reportsByManager = new Map<string, ManagerData[]>();
    detailedManagerReportData.forEach(report => {
      const existing = reportsByManager.get(report.managerName) || [];
      existing.push(report);
      reportsByManager.set(report.managerName, existing);
    });

    // Generate one consolidated Excel per manager
    const managers = Array.from(reportsByManager.entries());
    managers.forEach(([managerName, reports], index) => {
      setTimeout(() => {
        generateConsolidatedExcel(reports);
      }, index * 500); // Delay to prevent browser blocking multiple downloads
    });

    alert(`Generating ${managers.length} consolidated Excel reports (one per manager). Please allow multiple downloads in your browser.`);
  };

  // Helper function to convert time string to minutes
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || timeStr === '-' || timeStr === 'NA') return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Generate Excess Hours Report for Manager (with organizational breakdown)
  const handleExcessHoursReport = () => {
    if (!fromDate || !toDate) {
      alert('Please select both from and to dates');
      return;
    }

    if (selectedManager === 'All') {
      alert('Please select a specific manager for Excess Hours report');
      return;
    }

    // Group excess hours data by organizational unit (like Manager PDF logic)
    const orgUnitMap = new Map<string, any[]>();

    data.attendance.forEach(att => {
      const normalizedDate = convertDDMMMYYYYtoYYYYMMDD(att.date);
      if (normalizedDate < fromDate || normalizedDate > toDate) return;

      const manager = att.reportingManager || 'Unknown';
      if (manager !== selectedManager) return;

      // Get employee details for filters
      const employee = data.employees.find(e => e.employeeNumber === att.employeeNumber);

      // Apply entity filters
      if (selectedLegalEntity !== 'All' && employee?.legalEntity !== selectedLegalEntity) return;
      if (selectedLocation !== 'All' && att.location !== selectedLocation) return;
      if (selectedDepartment !== 'All' && att.department !== selectedDepartment) return;
      if (selectedSubDepartment !== 'All' && att.subDepartment !== selectedSubDepartment) return;

      // Create organizational unit key (same logic as Manager PDF)
      const legalEntity = employee?.legalEntity || 'Unknown';
      const location = att.location || 'Unknown';
      const department = att.department || 'Unknown';
      const subDepartment = att.subDepartment || 'Unknown';

      let orgKey = manager;
      if (selectedLegalEntity === 'All') orgKey += `|${legalEntity}`;
      if (selectedLocation === 'All') orgKey += `|${location}`;
      if (selectedDepartment === 'All') orgKey += `|${department}`;
      if (selectedSubDepartment === 'All') orgKey += `|${subDepartment}`;

      // Process excess hours calculation
      const attStatus = att.status || '';
      const isPresent = attStatus === 'P' || attStatus === 'Present' || attStatus === 'Clean';
      const isWorkedOff = attStatus === 'WOH' || attStatus === 'Worked Off';

      // Skip if not Present or Worked Off
      if (!isPresent && !isWorkedOff) return;

      // Check if there's valid punch data
      const hasOutTime = att.outTime && att.outTime !== 'NA' && att.outTime !== '-' && att.outTime !== '';
      if (!hasOutTime) return;

      let excessMinutes = 0;
      let calculationMethod = '';

      if (isPresent) {
        // Present days: Calculate excess based on Shift End time to Out time
        // Only include if excess > 9 hours (540 minutes)
        const shiftEndMinutes = timeToMinutes(att.shiftEnd);
        const outTimeMinutes = timeToMinutes(att.outTime);

        if (outTimeMinutes > shiftEndMinutes) {
          excessMinutes = outTimeMinutes - shiftEndMinutes;

          // Only include if excess > 9 hours
          if (excessMinutes <= 540) return; // Skip if not more than 9 hours
          calculationMethod = 'Out Time - Shift End (>9 hrs)';
        } else {
          return; // No excess
        }
      } else if (isWorkedOff) {
        // Worked Off days: Calculate from Shift Start time to Out time
        const shiftStartMinutes = timeToMinutes(att.shiftStart);
        const outTimeMinutes = timeToMinutes(att.outTime);

        if (outTimeMinutes > shiftStartMinutes) {
          excessMinutes = outTimeMinutes - shiftStartMinutes;
          calculationMethod = 'Out Time - Shift Start';
        } else {
          return; // No excess
        }
      }

      // Also check "Others" category (>16 hours)
      const totalHours = att.totalHours || '00:00';
      const [hoursStr, minutesStr] = totalHours.split(':');
      const totalWorkHours = parseFloat(hoursStr) + parseFloat(minutesStr || '0') / 60;

      const excessHours = (excessMinutes / 60).toFixed(2);

      const excessRecord = {
        employeeNumber: att.employeeNumber,
        employeeName: att.employeeName,
        date: att.date,
        jobTitle: att.jobTitle,
        department: att.department,
        subDepartment: att.subDepartment,
        location: att.location,
        legalEntity: legalEntity,
        status: attStatus,
        shift: att.shift,
        shiftStart: att.shiftStart,
        shiftEnd: att.shiftEnd,
        inTime: att.inTime,
        outTime: att.outTime,
        totalHours: att.totalHours,
        excessHours: excessHours,
        excessMinutes: excessMinutes,
        calculationMethod: calculationMethod,
        isOver16Hours: totalWorkHours > 16 ? 'Yes' : 'No',
        employeeOTForm: '', // To be filled manually
        finalPayableOTHours: '' // To be filled manually
      };

      // Add to organizational unit
      if (!orgUnitMap.has(orgKey)) {
        orgUnitMap.set(orgKey, []);
      }
      orgUnitMap.get(orgKey)!.push(excessRecord);
    });

    // Convert to array and prepare data structure
    const orgUnits = Array.from(orgUnitMap.entries()).map(([key, records]) => {
      const parts = key.split('|');
      return {
        manager: parts[0],
        legalEntity: selectedLegalEntity === 'All' ? (parts[1] || 'Unknown') : selectedLegalEntity,
        location: selectedLocation === 'All' ? (parts[selectedLegalEntity === 'All' ? 2 : 1] || 'Unknown') : selectedLocation,
        department: selectedDepartment === 'All' ? (parts[selectedLegalEntity === 'All' ? (selectedLocation === 'All' ? 3 : 2) : (selectedLocation === 'All' ? 2 : 1)] || 'Unknown') : selectedDepartment,
        subDepartment: selectedSubDepartment === 'All' ? (parts[parts.length - 1] || 'Unknown') : selectedSubDepartment,
        records: records.sort((a, b) => {
          const nameCompare = a.employeeName.localeCompare(b.employeeName);
          if (nameCompare !== 0) return nameCompare;
          return a.date.localeCompare(b.date);
        })
      };
    });

    if (orgUnits.length === 0 || orgUnits.every(u => u.records.length === 0)) {
      alert('No excess hours records found for the selected criteria');
      return;
    }

    // Flatten all records from all organizational units
    const excessHoursData: any[] = [];
    orgUnits.forEach(unit => {
      excessHoursData.push(...unit.records);
    });

    // Create Excel workbook
    const wb = XLSX.utils.book_new();

    // Overall Summary sheet (aggregated across all organizational units) - DISABLED to save space
    // const summaryData: any[] = [
    //   ['Excess Hours Report'],
    //   [],
    //   ['Manager:', selectedManager],
    //   ['Period:', `${formatDate(fromDate)} to ${formatDate(toDate)}`],
    //   ['Generated:', formatDate(new Date().toISOString().split('T')[0])],
    //   [],
    //   ['Overall Summary (All Units)'],
    //   ['Total Records:', excessHoursData.length],
    //   ['Present Days (>9 hrs):', excessHoursData.filter(r => r.status === 'P' || r.status === 'Present' || r.status === 'Clean').length],
    //   ['Worked Off Days:', excessHoursData.filter(r => r.status === 'WOH' || r.status === 'Worked Off').length],
    //   ['Over 16 Hours:', excessHoursData.filter(r => r.isOver16Hours === 'Yes').length],
    //   [],
    //   ['Note:'],
    //   ['- Present days: Excess calculated as Out Time - Shift End Time (only >9 hours included)'],
    //   ['- Worked Off days: Calculated as Out Time - Shift Start Time'],
    //   ['- Over 16 Hours: Flagged in "Others" category'],
    //   [],
    //   ['Organizational Units:', orgUnits.length]
    // ];

    // const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    // XLSX.utils.book_append_sheet(wb, summaryWs, 'Overall Summary');

    // Create sheets for each organizational unit (like Manager PDF)
    orgUnits.forEach((unit, unitIndex) => {
      if (unit.records.length === 0) return;

      // Build context label for sheet naming
      const contextParts: string[] = [];
      if (unit.legalEntity && unit.legalEntity !== 'Unknown') {
        contextParts.push(unit.legalEntity);
      }
      if (unit.location && unit.location !== 'Unknown') {
        contextParts.push(unit.location);
      }
      if (unit.department && unit.department !== 'Unknown') {
        contextParts.push(unit.department);
      }
      if (unit.subDepartment && unit.subDepartment !== 'Unknown') {
        contextParts.push(unit.subDepartment);
      }

      const unitLabel = contextParts.length > 0 ? contextParts.join('-') : `Unit${unitIndex + 1}`;
      const safeUnitLabel = unitLabel.substring(0, 25); // Excel sheet name limit

      // Unit summary stats - DISABLED to save space
      // const presentRecords = unit.records.filter(r => r.status === 'P' || r.status === 'Present' || r.status === 'Clean');
      // const workedOffRecords = unit.records.filter(r => r.status === 'WOH' || r.status === 'Worked Off');
      // const over16Records = unit.records.filter(r => r.isOver16Hours === 'Yes');

      // Unit summary data - just context header and details
      const unitSummaryData: any[] = [
        [contextParts.join(' - ')],
        [],
        // ['Unit Summary'],
        // ['Total Records:', unit.records.length],
        // ['Present Days (>9 hrs):', presentRecords.length],
        // ['Worked Off Days:', workedOffRecords.length],
        // ['Over 16 Hours:', over16Records.length],
        // [],
        // ['Details'],
        ['Employee ID', 'Employee Name', 'Date', 'Job Title', 'Department', 'Sub Department', 'Location', 'Status', 'Shift', 'Shift Start', 'Shift End', 'In Time', 'Out Time', 'Total Hours', 'Excess Hours', 'Calculation Method', 'Over 16 Hrs', 'Employee OT Form', 'Final Payable OT Hours'],
        ...unit.records.map(rec => [
          rec.employeeNumber,
          rec.employeeName,
          rec.date,
          rec.jobTitle || '-',
          rec.department || '-',
          rec.subDepartment || '-',
          rec.location || '-',
          rec.status,
          rec.shift || '-',
          rec.shiftStart || '-',
          rec.shiftEnd || '-',
          rec.inTime || '-',
          rec.outTime || '-',
          rec.totalHours || '-',
          rec.excessHours,
          rec.calculationMethod,
          rec.isOver16Hours,
          rec.employeeOTForm || '',
          rec.finalPayableOTHours || ''
        ])
      ];

      const unitWs = XLSX.utils.aoa_to_sheet(unitSummaryData);

      // Set column widths
      unitWs['!cols'] = [
        { wch: 12 }, // Employee ID
        { wch: 25 }, // Employee Name
        { wch: 12 }, // Date
        { wch: 20 }, // Job Title
        { wch: 20 }, // Department
        { wch: 20 }, // Sub Department
        { wch: 15 }, // Location
        { wch: 10 }, // Status
        { wch: 10 }, // Shift
        { wch: 12 }, // Shift Start
        { wch: 12 }, // Shift End
        { wch: 10 }, // In Time
        { wch: 10 }, // Out Time
        { wch: 12 }, // Total Hours
        { wch: 12 }, // Excess Hours
        { wch: 35 }, // Calculation Method
        { wch: 12 }, // Over 16 Hrs
        { wch: 18 }, // Employee OT Form
        { wch: 22 }  // Final Payable OT Hours
      ];

      XLSX.utils.book_append_sheet(wb, unitWs, safeUnitLabel);
    });

    // Save the file
    const fileName = `Excess_Hours_${selectedManager.replace(/\s+/g, '_')}_${fromDate}_to_${toDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Generate Excess Hours PDF Report (with organizational breakdown)
  const generateExcessHoursPDF = () => {
    if (!fromDate || !toDate) {
      alert('Please select both from and to dates');
      return;
    }

    if (selectedManager === 'All') {
      alert('Please select a specific manager for Excess Hours PDF');
      return;
    }

    // Use the SAME logic as Excel to group by organizational units
    const orgUnitMap = new Map<string, any[]>();

    data.attendance.forEach(att => {
      const normalizedDate = convertDDMMMYYYYtoYYYYMMDD(att.date);
      if (normalizedDate < fromDate || normalizedDate > toDate) return;

      const manager = att.reportingManager || 'Unknown';
      if (manager !== selectedManager) return;

      // Get employee details for filters
      const employee = data.employees.find(e => e.employeeNumber === att.employeeNumber);

      // Apply entity filters
      if (selectedLegalEntity !== 'All' && employee?.legalEntity !== selectedLegalEntity) return;
      if (selectedLocation !== 'All' && att.location !== selectedLocation) return;
      if (selectedDepartment !== 'All' && att.department !== selectedDepartment) return;
      if (selectedSubDepartment !== 'All' && att.subDepartment !== selectedSubDepartment) return;

      // Create organizational unit key (same logic as Excel)
      const legalEntity = employee?.legalEntity || 'Unknown';
      const location = att.location || 'Unknown';
      const department = att.department || 'Unknown';
      const subDepartment = att.subDepartment || 'Unknown';

      let orgKey = manager;
      if (selectedLegalEntity === 'All') orgKey += `|${legalEntity}`;
      if (selectedLocation === 'All') orgKey += `|${location}`;
      if (selectedDepartment === 'All') orgKey += `|${department}`;
      if (selectedSubDepartment === 'All') orgKey += `|${subDepartment}`;

      // Process excess hours calculation
      const attStatus = att.status || '';
      const normalizedStatus = attStatus.toUpperCase();

      const isPresent = normalizedStatus === 'P' || normalizedStatus === 'PRESENT' || normalizedStatus === 'CLEAN';
      const isWorkedOff = normalizedStatus === 'WOH' || normalizedStatus === 'WORKED OFF';

      if (!isPresent && !isWorkedOff) return;

      const hasOutTime = att.outTime && att.outTime !== 'NA' && att.outTime !== '-' && att.outTime !== '';
      if (!hasOutTime) return;

      let excessMinutes = 0;
      let calculationMethod = '';

      if (isPresent) {
        const shiftEndMinutes = timeToMinutes(att.shiftEnd);
        const outTimeMinutes = timeToMinutes(att.outTime);

        if (outTimeMinutes > shiftEndMinutes) {
          excessMinutes = outTimeMinutes - shiftEndMinutes;
          if (excessMinutes <= 540) return; // Skip if not more than 9 hours
          calculationMethod = 'Out Time - Shift End (>9 hrs)';
        } else {
          return;
        }
      } else if (isWorkedOff) {
        const shiftStartMinutes = timeToMinutes(att.shiftStart);
        const outTimeMinutes = timeToMinutes(att.outTime);

        if (outTimeMinutes > shiftStartMinutes) {
          excessMinutes = outTimeMinutes - shiftStartMinutes;
          calculationMethod = 'Out Time - Shift Start';
        } else {
          return;
        }
      }

      const totalHours = att.totalHours || '00:00';
      const [hoursStr, minutesStr] = totalHours.split(':');
      const totalWorkHours = parseFloat(hoursStr) + parseFloat(minutesStr || '0') / 60;
      const excessHours = (excessMinutes / 60).toFixed(2);

      const excessRecord = {
        employeeNumber: att.employeeNumber,
        employeeName: att.employeeName,
        date: att.date,
        jobTitle: att.jobTitle,
        department: att.department,
        subDepartment: att.subDepartment,
        location: att.location,
        legalEntity: legalEntity,
        status: attStatus,
        shift: att.shift,
        shiftStart: att.shiftStart,
        shiftEnd: att.shiftEnd,
        inTime: att.inTime,
        outTime: att.outTime,
        totalHours: att.totalHours,
        excessHours: excessHours,
        excessMinutes: excessMinutes,
        calculationMethod: calculationMethod,
        isOver16Hours: totalWorkHours > 16 ? 'Yes' : 'No',
        employeeOTForm: '',
        finalPayableOTHours: ''
      };

      if (!orgUnitMap.has(orgKey)) {
        orgUnitMap.set(orgKey, []);
      }
      orgUnitMap.get(orgKey)!.push(excessRecord);
    });

    // Convert to array
    const orgUnits = Array.from(orgUnitMap.entries()).map(([key, records]) => {
      const parts = key.split('|');
      return {
        manager: parts[0],
        legalEntity: selectedLegalEntity === 'All' ? (parts[1] || 'Unknown') : selectedLegalEntity,
        location: selectedLocation === 'All' ? (parts[selectedLegalEntity === 'All' ? 2 : 1] || 'Unknown') : selectedLocation,
        department: selectedDepartment === 'All' ? (parts[selectedLegalEntity === 'All' ? (selectedLocation === 'All' ? 3 : 2) : (selectedLocation === 'All' ? 2 : 1)] || 'Unknown') : selectedDepartment,
        subDepartment: selectedSubDepartment === 'All' ? (parts[parts.length - 1] || 'Unknown') : selectedSubDepartment,
        records: records.sort((a, b) => {
          const nameCompare = a.employeeName.localeCompare(b.employeeName);
          if (nameCompare !== 0) return nameCompare;
          return a.date.localeCompare(b.date);
        })
      };
    });

    if (orgUnits.length === 0 || orgUnits.every(u => u.records.length === 0)) {
      alert('No excess hours records found for the selected criteria');
      return;
    }

    // Note: Overall summary disabled to save space
    // Flatten for overall stats (kept for potential future use)
    // const excessHoursData: any[] = [];
    // orgUnits.forEach(unit => {
    //   excessHoursData.push(...unit.records);
    // });

    // const presentRecords = excessHoursData.filter(rec =>
    //   rec.status.toUpperCase() === 'P' || rec.status.toUpperCase() === 'PRESENT' || rec.status.toUpperCase() === 'CLEAN'
    // );
    // const workedOffRecords = excessHoursData.filter(rec =>
    //   rec.status.toUpperCase() === 'WOH' || rec.status.toUpperCase() === 'WORKED OFF'
    // );

    // Generate PDF
    const doc = new jsPDF('landscape'); // Use landscape for more columns
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Excess Hours Report', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Report Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Manager: ${selectedManager}`, 14, yPos);
    yPos += 6;
    doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, yPos);
    yPos += 6;
    doc.text(`Generated: ${formatDate(new Date().toISOString().split('T')[0])}`, 14, yPos);
    yPos += 10;

    // Overall Summary - DISABLED to save space
    // doc.setFontSize(12);
    // doc.setFont('helvetica', 'bold');
    // doc.text('Summary', 14, yPos);
    // yPos += 5;

    // autoTable(doc, {
    //   startY: yPos,
    //   head: [['Category', 'Count']],
    //   body: [
    //     ['Present Days (>9 hrs beyond shift end)', presentRecords.length],
    //     ['Worked Off Days', workedOffRecords.length],
    //     ['Over 16 Hours', excessHoursData.filter(r => r.isOver16Hours === 'Yes').length],
    //     ['Total Records', excessHoursData.length]
    //   ],
    //   theme: 'grid',
    //   headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: 'bold' }, // Amber color
    //   styles: { fontSize: 9 }
    // });

    // yPos = (doc as any).lastAutoTable.finalY + 10;

    // Process each organizational unit (same structure as Manager PDF)
    orgUnits.forEach((unit, unitIndex) => {
      if (unit.records.length === 0) return;

      // Add page break before each new organizational unit (except first - now always add since no overall summary)
      if (unitIndex > 0) {
        doc.addPage('landscape');
        yPos = 20;
      }

      // Section header showing the organizational context
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const contextParts: string[] = [];
      if (unit.legalEntity && unit.legalEntity !== 'Unknown') {
        contextParts.push(unit.legalEntity);
      }
      if (unit.location && unit.location !== 'Unknown') {
        contextParts.push(unit.location);
      }
      if (unit.department && unit.department !== 'Unknown') {
        contextParts.push(unit.department);
      }
      if (unit.subDepartment && unit.subDepartment !== 'Unknown') {
        contextParts.push(unit.subDepartment);
      }

      if (contextParts.length > 0) {
        doc.text(contextParts.join(' - '), 14, yPos);
        yPos += 8;
      }

      // Unit summary - DISABLED to save space
      const unitPresentRecords = unit.records.filter(r =>
        r.status.toUpperCase() === 'P' || r.status.toUpperCase() === 'PRESENT' || r.status.toUpperCase() === 'CLEAN'
      );
      const unitWorkedOffRecords = unit.records.filter(r =>
        r.status.toUpperCase() === 'WOH' || r.status.toUpperCase() === 'WORKED OFF'
      );

      // doc.setFontSize(12);
      // doc.setFont('helvetica', 'bold');
      // doc.text('Unit Summary', 14, yPos);
      // yPos += 5;

      // autoTable(doc, {
      //   startY: yPos,
      //   head: [['Category', 'Count']],
      //   body: [
      //     ['Present Days (>9 hrs)', unitPresentRecords.length],
      //     ['Worked Off Days', unitWorkedOffRecords.length],
      //     ['Over 16 Hours', unit.records.filter(r => r.isOver16Hours === 'Yes').length],
      //     ['Total', unit.records.length]
      //   ],
      //   theme: 'grid',
      //   headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: 'bold' },
      //   styles: { fontSize: 9 }
      // });

      // yPos = (doc as any).lastAutoTable.finalY + 10;

      // Detail sections for this unit
      const addUnitSection = (title: string, records: any[]) => {
        if (records.length === 0) return;

        // Check if we need a new page
        if (yPos > 170) {
          doc.addPage('landscape');
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          head: [['Emp ID', 'Name', 'Date', 'Job Title', 'Dept', 'Sub Dept', 'Location', 'Status', 'Shift', 'Shift Start', 'Shift End', 'In Time', 'Out Time', 'Total Hrs', 'Excess Hrs', 'Calculation', 'Over 16', 'OT Form', 'Final OT Hrs']],
          body: records.map((rec: any) => [
            rec.employeeNumber,
            rec.employeeName,
            rec.date,
            rec.jobTitle || '-',
            rec.department || '-',
            rec.subDepartment || '-',
            rec.location || '-',
            rec.status,
            rec.shift || '-',
            rec.shiftStart || '-',
            rec.shiftEnd || '-',
            rec.inTime || '-',
            rec.outTime || '-',
            rec.totalHours || '-',
            rec.excessHours,
            rec.calculationMethod,
            rec.isOver16Hours,
            rec.employeeOTForm || '',
            rec.finalPayableOTHours || ''
          ]),
          theme: 'striped',
          headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 5 },
          margin: { left: 14, right: 14 }
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      };

      // Add category sections for this organizational unit
      addUnitSection('Present Days - Excess Hours (>9 hrs beyond shift end)', unitPresentRecords);
      addUnitSection('Worked Off Days - Excess Hours', unitWorkedOffRecords);
    });

    // Save PDF
    const fileName = `Excess_Hours_${selectedManager.replace(/\s+/g, '_')}_${fromDate}_to_${toDate}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
              <FileText size={24} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">Manager PDF Reports</h1>
              <p className="text-sm text-slate-500 font-medium">Generate comprehensive reports by manager</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-6">
          <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
            <Calendar size={20} />
            Select Report Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                Manager
              </label>
              <select
                value={selectedManager}
                onChange={(e) => setSelectedManager(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              >
                {managers.map(mgr => (
                  <option key={mgr} value={mgr}>{mgr}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                Legal Entity
              </label>
              <select
                value={selectedLegalEntity}
                onChange={(e) => setSelectedLegalEntity(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              >
                {legalEntities.map(entity => (
                  <option key={entity} value={entity}>{entity}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              >
                {locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                Sub Department
              </label>
              <select
                value={selectedSubDepartment}
                onChange={(e) => setSelectedSubDepartment(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-semibold"
              >
                {subDepartments.map(subDept => (
                  <option key={subDept} value={subDept}>{subDept}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {fromDate && toDate && managerReportData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <User size={24} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Managers</p>
                  <p className="text-2xl font-black text-slate-900">{managerReportData.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
                  <FileText size={24} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Total</p>
                  <p className="text-2xl font-black text-slate-900">
                    {managerReportData.reduce((sum, m) =>
                      sum + Object.values(m.violations).reduce((s, v) => s + v, 0), 0
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Calendar size={24} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Date Range</p>
                  <p className="text-sm font-black text-slate-900">{fromDate} to {toDate}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Download Actions */}
        {isAdmin && fromDate && toDate && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-6">
            <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <Download size={20} />
              Download Reports
            </h2>

            {/* PDF Downloads */}
            <div className="mb-4">
              <p className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2">PDF Reports</p>
              <div className="flex gap-3">
                <button
                  onClick={handleIndividualPDF}
                  disabled={selectedManager === 'All'}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                    selectedManager === 'All'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg'
                  }`}
                >
                  <Download size={18} />
                  Download Individual PDF
                </button>

                <button
                  onClick={handleBulkPDF}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-black text-sm uppercase tracking-widest shadow-lg"
                >
                  <Download size={18} />
                  Download Bulk PDFs
                </button>
              </div>
            </div>

            {/* Excel Downloads */}
            <div>
              <p className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Excel Reports</p>
              <div className="flex gap-3">
                <button
                  onClick={handleIndividualExcel}
                  disabled={selectedManager === 'All'}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                    selectedManager === 'All'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg'
                  }`}
                >
                  <Download size={18} />
                  Download Individual Excel
                </button>

                <button
                  onClick={handleBulkExcel}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl hover:from-teal-700 hover:to-cyan-700 transition-all font-black text-sm uppercase tracking-widest shadow-lg"
                >
                  <Download size={18} />
                  Download Bulk Excel
                </button>
              </div>
            </div>

            {/* Excess Hours Report */}
            <div className="mt-4">
              <p className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Excess Hours Report</p>
              <div className="flex gap-3">
                <button
                  onClick={generateExcessHoursPDF}
                  disabled={selectedManager === 'All'}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                    selectedManager === 'All'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 shadow-lg'
                  }`}
                >
                  <Download size={18} />
                  Download Excess Hours PDF
                </button>

                <button
                  onClick={handleExcessHoursReport}
                  disabled={selectedManager === 'All'}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                    selectedManager === 'All'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-yellow-600 to-amber-600 text-white hover:from-yellow-700 hover:to-amber-700 shadow-lg'
                  }`}
                >
                  <Download size={18} />
                  Download Excess Hours Excel
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Includes: Present days (&gt;9 hrs beyond shift end) & Worked Off days (Shift start to Out time)
              </p>
            </div>

            <p className="text-xs text-slate-500 mt-3">
              Individual: Select a specific manager. Bulk: Downloads reports for all managers in the date range.
            </p>
          </div>
        )}

        {/* Manager Summary Table */}
        {fromDate && toDate && managerReportData.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <p className="text-sm font-bold text-slate-700">
                Manager Summary ({managerReportData.length} managers)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Reporting</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Present</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Absent</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Off Day</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Worked Off</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Errors</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Late/Early</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">&lt;4 hrs</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">4-7 hrs</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Shift Dev</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Missing</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Others</th>
                    <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {managerReportData.map((manager, idx) => {
                    const total = Object.values(manager.violations).reduce((sum, v) => sum + v, 0);

                    return (
                      <tr key={`${manager.managerName}-${idx}`} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="px-4 py-3 text-sm font-bold text-slate-900">{manager.managerName}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.present}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.absent}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.offDay}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.workedOff}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.errors}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.lateEarly}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.lessThan4hrs}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.hours4to7}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.shiftDeviation}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.missingPunch}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{manager.violations.otherViolations}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-sm font-bold">
                            {total}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-bold">
                  <tr>
                    <td className="px-4 py-3 text-sm text-slate-900 font-black">TOTAL</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-900">{managerReportData.reduce((sum: number, m: ManagerData) => sum + m.violations.present, 0)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-900">{managerReportData.reduce((sum: number, m: ManagerData) => sum + m.violations.absent, 0)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-900">{managerReportData.reduce((sum: number, m: ManagerData) => sum + m.violations.offDay, 0)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-900">{managerReportData.reduce((sum: number, m: ManagerData) => sum + m.violations.workedOff, 0)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-900">{managerReportData.reduce((sum: number, m: ManagerData) => sum + m.violations.errors, 0)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-900">{managerReportData.reduce((sum: number, m: ManagerData) => sum + m.violations.lateEarly, 0)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-900">{managerReportData.reduce((sum: number, m: ManagerData) => sum + m.violations.lessThan4hrs, 0)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-900">{managerReportData.reduce((sum: number, m: ManagerData) => sum + m.violations.hours4to7, 0)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-900">{managerReportData.reduce((sum: number, m: ManagerData) => sum + m.violations.shiftDeviation, 0)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-900">{managerReportData.reduce((sum: number, m: ManagerData) => sum + m.violations.missingPunch, 0)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-900">{managerReportData.reduce((sum: number, m: ManagerData) => sum + m.violations.otherViolations, 0)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-3 py-1 bg-rose-200 text-rose-900 rounded-lg text-sm font-black">
                        {managerReportData.reduce((sum: number, m: ManagerData) => sum + (Object.values(m.violations) as number[]).reduce((s: number, v: number) => s + v, 0), 0)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {fromDate && toDate && managerReportData.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-12 text-center">
            <FileText size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-bold text-slate-500">No Violation Data Found</p>
            <p className="text-sm text-slate-400 mt-2">
              No reconciliation records or audit queue items found for the selected date range and manager.
            </p>
            <div className="mt-6 text-left max-w-2xl mx-auto bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-black text-blue-900 uppercase tracking-widest mb-2">Data Requirements:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span><strong>Reconciliation Records:</strong> Visit the Reconciliation Report to reconcile attendance data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span><strong>Audit Queue:</strong> Items flagged for review (late/early, missing punch, errors)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span><strong>Date Range:</strong> Ensure the selected dates match your reconciled data period</span>
                </li>
              </ul>
            </div>
            <p className="text-xs text-slate-400 mt-4">
              Open browser console (F12) to see detailed data availability information
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerPDFReport;
