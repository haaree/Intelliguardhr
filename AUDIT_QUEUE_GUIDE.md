# Audit Queue Management Module - User Guide

## Overview

The Audit Queue Management module provides a comprehensive workflow for reviewing and updating attendance records that require manual verification. It automatically captures records flagged as "Audit" and allows administrators to review, update statuses, and push approved changes to monthly reports.

---

## Key Features

### 1. **Automatic Queue Population**
- Automatically captures attendance records with status = "Audit"
- Also captures records with deviations (late, early, etc.)
- No manual data entry needed for existing attendance issues

### 2. **Audit Logging**
- Complete audit trail of all queue operations
- Tracks uploads, status updates, approvals, rejections
- Records who did what and when

### 3. **Status Selection Workflow**
- View all available review statuses
- Select specific statuses for updating
- Filter queue by review status

### 4. **Selective Push to Monthly Report**
- Only **APPROVED** updates are pushed to monthly reports
- Rejected records remain with original status
- Pending records show as blank in monthly report
- Clear tracking of pushed vs pending updates

### 5. **Flexible Status Updates**
- Update attendance status for audit records
- Choose from: P, HD, A, WO, H, CL, PL, SL, LOP
- Changes tracked in audit logs

---

## Workflow

### Step 1: Audit Queue Auto-Population

**Automatic:**
- System scans attendance records on page load
- Identifies records with:
  - `status = "Audit"`
  - `deviation` field populated (late in, early out, etc.)
- Adds them to audit queue with status "Pending Review"

**Manual Upload (Optional):**
1. Click **"Import Audit Records"** button
2. Select Excel file with audit records
3. Records added to queue

**Excel File Format:**
```
Employee Number | Employee Name | Date | Department | Current Status | Deviation | Audit Reason | Review Status
E001 | John Doe | 15-JAN-2024 | Engineering | Audit | Late In by 45 min | Exceeded threshold | Pending Review
```

### Step 2: Review Audit Records

The queue displays all records requiring review:

**Record Information:**
- Employee Number & Name
- Date of the audit record
- Department & Location
- Current Status (usually "Audit")
- Deviation details
- Audit Reason (why flagged)
- Review Status

### Step 3: Update Status

For each audit record:

1. **Select New Status** from dropdown:
   - **P** - Present (if deviation acceptable)
   - **HD** - Half Day
   - **A** - Absent
   - **WO** - Weekly Off
   - **H** - Holiday
   - **CL** - Casual Leave
   - **PL** - Privilege Leave
   - **SL** - Sick Leave
   - **LOP** - Loss of Pay

2. **Review Status Auto-Updates** to "Reviewed"

3. **System Records:**
   - Updated Status
   - Reviewed By (current user)
   - Reviewed On (timestamp)
   - Remarks (auto-generated)

### Step 4: Approve or Reject

After updating status:

1. **Approve** (✓):
   - Marks record as "Approved"
   - Ready to push to monthly report
   - Updated status will be applied

2. **Reject** (✗):
   - Marks record as "Rejected"
   - Original status retained
   - Will NOT be pushed to monthly report

### Step 5: Push to Monthly Report

1. Click **"Save & Push to Monthly"**
2. System shows confirmation:
   ```
   ✓ 15 approved records will be updated with new status
   ✗ 5 rejected records will remain with original status
   ⏳ 10 pending records will show as blank in Monthly Report

   Proceed?
   ```
3. Confirm to proceed
4. Only **APPROVED** records with updated status are pushed
5. Records marked as `isPushedToMonthly: true`

---

## Review Statuses Explained

| Status | Meaning | Action Needed | Pushed to Monthly? |
|--------|---------|---------------|-------------------|
| **Pending Review** | Just entered queue | Update status | No |
| **Under Review** | Being worked on | Continue review | No |
| **Reviewed** | Status updated | Approve/Reject | No |
| **Approved** | Admin approved update | Ready to push | Yes (when "Push to Monthly" clicked) |
| **Rejected** | Admin rejected update | Remains original | No |

---

## Statistics Dashboard

Real-time statistics shown:

- **Total**: All records in audit queue
- **Pending**: Records awaiting review
- **In Review**: Records being worked on
- **Reviewed**: Status updated, pending approval
- **Approved**: Admin-approved updates
- **Rejected**: Admin-rejected updates
- **Pushed**: Records pushed to monthly report

---

## Filters and Search

### Search
- Search by Employee Number or Employee Name
- Real-time filtering

### Review Status Filter
- Filter by: All, Pending Review, Under Review, Reviewed, Approved, Rejected
- Quick access to specific review stages

---

## Monthly Report Integration

### What Gets Pushed?

**Pushed to Monthly Report:**
- ✓ Approved audit updates with `isPushedToMonthly = true`
- ✓ Only records with `updatedStatus` defined
- Status changed from "Audit" to updated status (P, CL, etc.)

**NOT Pushed to Monthly Report:**
- ✗ Pending Review records
- ✗ Under Review records
- ✗ Reviewed but not approved
- ✗ Rejected records
- These remain **blank** or with **original status** in monthly report

### Example Scenario:

**Audit Queue:**
- 50 records flagged as "Audit"
- 40 reviewed and updated
- 30 approved
- 10 rejected
- 10 pending review

**Monthly Report Result:**
- 30 records show updated status (P, CL, etc.) ← Approved & Pushed
- 20 records remain as "Audit" or blank ← Rejected + Pending

---

## Audit Reasons (Common)

The system may flag records for various reasons:

| Audit Reason | Description |
|--------------|-------------|
| Late In | Exceeded late threshold (e.g., >15 min) |
| Early Out | Left before shift end |
| Missing Out Punch | Only In time recorded |
| Missing In Punch | Only Out time recorded |
| Double Deviation | Both late and early |
| Shift Mismatch | Wrong shift assigned |
| Very Late | Excessive lateness (e.g., >2 hours) |
| Undefined Shift | No shift reference found |
| Weekend Work | Worked on weekly off |
| Holiday Work | Worked on holiday |

---

## Audit Log Features

Every action is logged with:

- **Timestamp**: When action occurred
- **Module**: Audit Queue
- **Action**: Upload, Update, Approve, Reject, Push to Monthly
- **Entity**: Employee Number & Name
- **Previous Value**: Old status
- **New Value**: New status
- **Performed By**: User who made change
- **Details**: Audit reason, date, etc.

---

## Best Practices

### 1. Regular Queue Review
- Check audit queue daily
- Don't let records pile up
- Clear pending reviews promptly

### 2. Status Update Guidelines
- **P (Present)**: Use when deviation is acceptable
  - Example: Late due to approved permission
- **HD (Half Day)**: Use for partial day work
  - Example: Worked 4-6 hours
- **A (Absent)**: Use when no valid reason
  - Example: Unexplained absence
- **Leave Types (CL/PL/SL/LOP)**: Use when leave applied
  - Should ideally be handled via Leave Reconciliation
- **WO/H**: Use for correcting misclassified off days

### 3. Approval Workflow
- Review deviation details carefully
- Check audit reason
- Verify with employee/manager if needed
- Document decision in remarks

### 4. Batch Processing
- Group similar audit reasons
- Apply consistent rules
- Example: All "Late In <30 min" → P (Present)

### 5. Push Timing
- Push to monthly before month-end
- Coordinate with Leave Reconciliation
- Don't push multiple times unnecessarily

---

## Common Workflows

### Workflow 1: Approve Valid Late Arrival

**Scenario:** Employee late by 20 minutes but has permission

1. Find record in queue (Deviation: "Late In by 20 min")
2. Update status to **P** (Present)
3. Review status becomes "Reviewed"
4. Click ✓ Approve
5. Push to monthly report

**Result:** Record shows as Present in monthly report

---

### Workflow 2: Reject Invalid Early Departure

**Scenario:** Employee left early without approval

1. Find record in queue (Deviation: "Early Out by 1 hour")
2. Update status to **A** (Absent) or **HD** (Half Day)
3. Review status becomes "Reviewed"
4. Click ✗ Reject
5. Do NOT push to monthly report

**Result:** Record remains as Audit or original status

---

### Workflow 3: Correct Misclassified Leave

**Scenario:** Employee marked Absent but had applied leave

1. Find record in queue
2. Update status to **CL** (Casual Leave)
3. Review status becomes "Reviewed"
4. Click ✓ Approve
5. Push to monthly report

**Result:** Record shows as CL in monthly report

**Note:** Better to handle via Leave Reconciliation module

---

## Troubleshooting

### Issue: Records Not Auto-Populating

**Possible Causes:**
- No attendance records with status "Audit"
- Attendance not uploaded yet
- Deviation field empty

**Solution:**
- Upload attendance data first
- Check attendance records for "Audit" status
- Verify deviation logic in attendance processing

### Issue: Cannot Update Status

**Possible Causes:**
- Record already pushed to monthly
- Not logged in as admin
- Record locked

**Solution:**
- Check `isPushedToMonthly` flag
- Verify admin permissions
- Contact system administrator

### Issue: Updates Not Reflecting in Monthly Report

**Possible Causes:**
- Not approved
- Not pushed yet
- Updated status field empty

**Solution:**
- Approve the audit record
- Click "Save & Push to Monthly"
- Ensure status was updated before approval

---

## Data Model

### AuditQueueRecord Interface

```typescript
{
  id: string; // Unique identifier
  employeeNumber: string;
  employeeName: string;
  date: string;
  department: string;
  location: string;
  currentStatus: string; // Current audit status
  deviation?: string; // Deviation details
  auditReason: string; // Why flagged
  reviewStatus: 'Pending Review' | 'Under Review' | 'Reviewed' | 'Approved' | 'Rejected';
  updatedStatus?: string; // New status after review
  reviewedBy?: string; // Who reviewed
  reviewedOn?: string; // When reviewed
  remarks?: string;
  isPushedToMonthly?: boolean; // NEW: Track push status
}
```

### AuditLogEntry Interface

```typescript
{
  id: string;
  timestamp: string;
  module: 'Audit Queue';
  action: 'Upload' | 'Update' | 'Approve' | 'Reject' | 'Push to Monthly';
  entityType: 'Audit Queue';
  entityId: string;
  entityName: string;
  previousValue?: string;
  newValue?: string;
  performedBy: string;
  details?: string;
}
```

---

## Export Options

### Export Audit Queue
- Exports all queue records
- Includes review status, updated status, pushed status
- Format: Excel (.xlsx)

### Export Template
- Download sample Excel template
- Use for bulk importing audit records
- Includes all required columns

---

## Permissions

| Role | View Queue | Update Status | Approve/Reject | Push to Monthly |
|------|------------|---------------|----------------|-----------------|
| **SaaS Admin** | ✓ | ✓ | ✓ | ✓ |
| **Admin** | ✓ | ✓ | ✓ | ✓ |
| **Manager** | ✓ | ✓ | ✓ | ✓ |
| **Employee** | View Own | - | - | - |

---

## Integration with Leave Reconciliation

Both modules work together:

### Audit Queue
- Handles attendance status corrections
- Fixes deviations, wrong punches
- Updates daily attendance issues

### Leave Reconciliation
- Handles leave applications
- Matches leaves with absences
- Updates leave-related statuses

### Coordination
1. Run **Attendance Upload** first
2. Run **Leave Reconciliation** for absent days with leaves
3. Run **Audit Queue** for other deviations
4. Push both to monthly report
5. Monthly report shows combined updates

---

## Reporting

### Audit Queue Reports

Generate reports for:

1. **Pending Reviews**
   - All records awaiting review
   - Grouped by department/location

2. **Approved Updates**
   - All approved changes
   - Compare original vs updated status

3. **Rejected Records**
   - All rejected audit records
   - Reasons for rejection

4. **Push History**
   - What was pushed when
   - By whom

---

## Summary

The Audit Queue Management module provides:

✅ **Automatic capture** - Records flagged as "Audit" auto-populate
✅ **Flexible updates** - Choose appropriate status for each record
✅ **Approval workflow** - Review and approve before pushing
✅ **Selective pushing** - Only approved updates affect monthly report
✅ **Complete audit trail** - Every action logged
✅ **Integration ready** - Works seamlessly with Leave Reconciliation

This ensures accurate attendance correction while maintaining full control and transparency over the audit process.
