
export type UserRole = 'SaaS_Admin' | 'Admin' | 'Manager' | 'Employee';

export interface Employee {
  employeeNumber: string;
  fullName: string;
  email: string;
  dateOfJoining: string;
  jobTitle: string;
  businessUnit: string;
  department: string;
  subDepartment: string;
  location: string;
  costCenter: string;
  legalEntity: string;
  band: string;
  reportingTo: string;
  dottedLineManager: string;
  activeStatus: string;
  resignationDate: string;
  leftDate: string;
  contractId: string;
  excludeFromWorkhoursCalculation: boolean; // WH Excl
  otEligible: boolean; // OT
  compOffEligible: boolean; // CompOff
  lateExemption: boolean; // Late Exm
  shiftDeviationAllowed: boolean; // Dev Allow
  status: string; // Employment Status (e.g. Permanent, Contract)
  biometricNumber: string;
}

export interface AttendanceRecord {
  employeeNumber: string;
  employeeName: string;
  jobTitle: string;
  businessUnit: string;
  department: string;
  subDepartment: string;
  location: string;
  costCenter: string;
  reportingManager: string;
  legalEntity: string;
  date: string;
  shift: string;
  shiftStart: string;
  inTime: string;
  lateBy: string;
  shiftEnd: string;
  outTime: string;
  earlyBy: string;
  status: string;
  effectiveHours: string;
  totalHours: string;
  breakDuration: string;
  overTime: string;
  totalShortHoursEffective: string;
  totalShortHoursGross: string;
  excessHours?: string;
  deviation?: string;
  permissionStatus?: string;
}

export interface Shift {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  earlyInThreshold: number; 
  lateThreshold: number;    // Represents "Late In" (minutes)
  allowedLateCount: number; // Represents "Allowed Late" (occasions)
  earlyThreshold: number;   
  workhoursFormula: string;
  shiftDeviationStats: string;
  permissionLogic: string;
  allowedPermission: number;
  excessHoursLogic: string;
  otEligibilityLogic: string;
  otPayableLogic: string;
}

export interface Holiday {
  date: string;
  label: string;
}

export interface LeaveRecord {
  employeeNumber: string;
  employeeName: string;
  jobTitle: string;
  businessUnit: string;
  department: string;
  subDepartment: string;
  location: string;
  costCenter: string;
  reportingManager: string;
  leaveType: string; // CL, PL, CO, LOP, MEL
  fromDate: string;
  fromSession: string; // Full Day, First Half, Second Half
  toDate: string;
  toSession: string; // Full Day, First Half, Second Half
  totalDuration: number;
  unit: string; // Days
  requestedOn: string;
  requestedBy: string;
  note: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Applied';
  lastActionTakenBy: string;
  lastActionTakenOn: string;
  nextApprover: string;
}

export interface LeaveReconciliation {
  employeeNumber: string;
  employeeName: string;
  date: string;
  absentInAttendance: boolean;
  leaveRecord?: LeaveRecord;
  reconciliationStatus: 'Matched' | 'Unmatched' | 'Approved' | 'Rejected';
  finalStatus: string; // CL, SL, PL, LOP, A (Absent)
  remarks: string;
  isPushedToMonthly?: boolean; // Track if reconciliation has been pushed to monthly report
}

export interface ReconciliationRecord {
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
  absentStatus: string; // A = Absent from attendance
  excelStatus: string; // Status from uploaded Excel
  finalStatus: string; // User-accepted or overridden status
  comments: string;
  isReconciled: boolean; // Whether user has accepted/overridden
}

export interface HeadcountData {
  id: string; // Unique identifier
  legalEntity: string;
  location: string;
  department: string;
  subDepartment: string;
  approvedHeadcount: number;
}

export interface AuditQueueRecord {
  id: string; // Unique identifier
  employeeNumber: string;
  employeeName: string;
  date: string;
  department: string;
  location: string;
  currentStatus: string; // Current audit status from attendance
  deviation?: string; // Deviation details
  auditReason: string; // Why this record is in audit queue
  reviewStatus: 'Pending Review' | 'Under Review' | 'Reviewed' | 'Approved' | 'Rejected';
  updatedStatus?: string; // New status after review
  reviewedBy?: string; // Who reviewed the record
  reviewedOn?: string; // When it was reviewed
  remarks?: string;
  isPushedToMonthly?: boolean; // Track if update has been pushed to monthly report
}

export interface AuditLogEntry {
  id: string; // Unique identifier
  timestamp: string; // ISO timestamp
  module: 'Leave Reconciliation' | 'Audit Queue' | 'Attendance' | 'Employee' | 'System';
  action: 'Upload' | 'Reconcile' | 'Approve' | 'Reject' | 'Update' | 'Push to Monthly' | 'Status Change';
  entityType: 'Leave Record' | 'Reconciliation' | 'Audit Queue' | 'Attendance Record';
  entityId: string; // Employee number or record ID
  entityName: string; // Employee name or record description
  previousValue?: string; // Previous state/status
  newValue?: string; // New state/status
  performedBy: string; // User who performed the action
  details?: string; // Additional context
}

export interface AppData {
  employees: Employee[];
  attendance: AttendanceRecord[];
  shifts: Shift[];
  holidays: Holiday[];
  weeklyOffs: number[]; // 0 for Sunday, 1 for Monday, etc.
  leaveRecords: LeaveRecord[];
  leaveReconciliations: LeaveReconciliation[];
  reconciliationRecords?: ReconciliationRecord[]; // New optimized reconciliation
  auditQueue: AuditQueueRecord[];
  auditLogs: AuditLogEntry[];
  isReconciliationComplete?: boolean; // Flag to enable/disable monthly report
  headcountData: HeadcountData[];
}

export type Page = 'landing' | 'login' | 'dashboard' | 'employees' | 'biometric' | 'attendance' | 'monthly' | 'shifts' | 'leave' | 'audit-queue' | 'reports' | 'shift-deviation' | 'excess-hours' | 'manager-pdf' | 'headcount' | 'mis-report';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
