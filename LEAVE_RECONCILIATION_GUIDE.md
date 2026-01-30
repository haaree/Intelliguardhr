# Leave Reconciliation Module - User Guide

## Overview

The enhanced Leave Reconciliation module provides a comprehensive workflow for reconciling leave records with attendance data. It includes audit logging, status-based filtering, and selective reconciliation capabilities.

---

## Key Features

### 1. **Audit Logging**
- Every action is logged with timestamp, user, and details
- Complete audit trail of all reconciliation activities
- Track uploads, reconciliations, approvals, rejections, and status changes

### 2. **Status-Based Reconciliation**
- View all available leave statuses from uploaded Excel file
- Select specific statuses for reconciliation (Approved, Pending, Rejected, etc.)
- Only selected status records are reconciled against absent attendance

### 3. **Selective Push to Monthly Report**
- Only **APPROVED** reconciliations are pushed to monthly reports
- Other statuses (Matched, Unmatched, Rejected) remain blank in monthly report
- Clear tracking of what has been pushed vs pending

### 4. **Status Update Capability**
- Update final status of approved reconciliations before pushing
- Choose from: CL, PL, SL, CO, LOP, MEL, A
- Changes are tracked in audit logs

---

## Workflow

### Step 1: Upload Leave Records

1. Click **"Import Leaves"** button
2. Select Excel file with leave records
3. System extracts unique statuses from the file
4. Shows available statuses: Approved, Pending, Rejected, Applied, etc.

**Excel File Format:**
```
Employee Number | Employee Name | Department | Leave Types | From Date | To Date | Total Duration | Status | Reason
E001           | John Doe      | Engineering | CL          | 01-JAN-2024 | 02-JAN-2024 | 2 | Approved | Personal
```

### Step 2: Select Statuses for Review

After upload, you'll see a **Status Selection Panel** showing all available statuses from the uploaded file:

- Click individual status buttons to select/deselect
- Or use "Select All" / "Clear All" buttons
- Only records with selected statuses will be reconciled

**Example:**
```
Available Statuses: Approved, Pending, Rejected, Applied

You select: ✓ Approved  ✓ Pending

Result: Only "Approved" and "Pending" leave records will be matched against absent attendance
```

### Step 3: Run Reconciliation

1. Click **"Reconcile"** button
2. System matches selected leave records against absent attendance records
3. Matching criteria:
   - Employee Number must match
   - Attendance date must fall between leave From Date and To Date
4. Results shown with status:
   - **Matched**: Leave record found for absent day
   - **Unmatched**: No leave record found

### Step 4: Review and Approve/Reject

For each matched reconciliation:

1. **Review Details:**
   - Employee information
   - Date of absence
   - Leave type and status from Excel
   - Remarks showing leave reason

2. **Take Action:**
   - Click ✓ (Approve): Marks for inclusion in monthly report
   - Click ✗ (Reject): Record remains as Absent (A)

3. **Update Status (if needed):**
   - After approval, you can change the final status
   - Use dropdown to select: CL, PL, SL, CO, LOP, MEL, A
   - Change is logged in audit trail

### Step 5: Push to Monthly Report

1. Click **"Save & Push to Monthly"**
2. System shows confirmation:
   ```
   ✓ 25 approved reconciliations will be pushed to Monthly Report
   ✗ 10 other records will show as blank in Monthly Report
   ```
3. Confirm to proceed
4. Only **APPROVED** reconciliations update the monthly report
5. Records marked as `isPushedToMonthly: true`

---

## Reconciliation Statuses Explained

| Status | Meaning | Action Needed | Pushed to Monthly? |
|--------|---------|---------------|-------------------|
| **Matched** | Leave record found for absent day | Review & Approve/Reject | No |
| **Unmatched** | No leave record found | Investigate | No |
| **Approved** | Admin approved the reconciliation | Ready to push | Yes (when "Push to Monthly" clicked) |
| **Rejected** | Admin rejected the reconciliation | Remains as Absent | No |

---

## Statistics Dashboard

The module shows real-time statistics:

- **Total**: All reconciliation records
- **Matched**: Records with matching leave
- **Unmatched**: Records without matching leave
- **Approved**: Admin-approved reconciliations
- **Rejected**: Admin-rejected reconciliations
- **Pushed**: Records pushed to monthly report

---

## Filters and Search

### Search
- Search by Employee Number or Employee Name
- Real-time filtering as you type

### Status Filter
- Filter by: All, Matched, Unmatched, Approved, Rejected
- Quick view of specific reconciliation status

---

## Monthly Report Integration

### What Gets Pushed?

**Pushed to Monthly Report:**
- ✓ Approved reconciliations with `isPushedToMonthly = true`
- Status updated from "Absent" to final status (CL, PL, etc.)

**NOT Pushed to Monthly Report:**
- ✗ Matched but not approved
- ✗ Unmatched records
- ✗ Rejected reconciliations
- These remain **blank** or as **Absent** in monthly report

### Example:

**Scenario:**
- 100 absent attendance records
- 80 matched with leave records
- 60 approved
- 20 rejected
- 20 unmatched

**Monthly Report Result:**
- 60 records show leave status (CL, PL, etc.) ← Approved & Pushed
- 40 records remain blank/absent ← Rejected + Unmatched

---

## Audit Log Features

Every action is logged with:

- **Timestamp**: When action occurred
- **Module**: Leave Reconciliation
- **Action**: Upload, Reconcile, Approve, Reject, Status Change, Push to Monthly
- **Entity**: Employee Number & Name
- **Previous Value**: Old status
- **New Value**: New status
- **Performed By**: User who made the change
- **Details**: Additional context

**Export Audit Logs:**
- All logs stored in `appData.auditLogs`
- Can be exported for compliance and reporting

---

## Best Practices

### 1. Status Selection
- Review the statuses shown after upload
- Only select statuses that are ready for reconciliation
- Example: Don't reconcile "Rejected" leaves if they shouldn't be counted

### 2. Approval Workflow
- Review each matched record before approving
- Check the leave reason and dates
- Verify employee department and location

### 3. Status Updates
- Update status before pushing to monthly report
- Common updates:
  - Change generic leave to specific type (LOP → CL)
  - Correct misclassified leaves

### 4. Push to Monthly
- Only push when all approvals are complete
- Review the confirmation message
- Records cannot be un-pushed once confirmed

### 5. Audit Trail
- Regularly export audit logs
- Review logs for compliance
- Track who approved what and when

---

## Troubleshooting

### Issue: No Matches Found

**Possible Causes:**
- Date format mismatch
- Employee Number mismatch
- No absent records in attendance
- Wrong status selected

**Solution:**
- Check Excel file format
- Verify employee numbers match exactly
- Ensure attendance data is uploaded
- Select correct leave statuses

### Issue: Status Not Updating

**Possible Causes:**
- Record already pushed to monthly
- Not approved yet
- Permissions issue

**Solution:**
- Check if `isPushedToMonthly = true`
- Approve the reconciliation first
- Verify admin access

### Issue: Records Showing as Blank in Monthly Report

**Expected Behavior:**
- Only approved & pushed reconciliations appear
- Other records intentionally remain blank

**To Fix:**
- Review and approve the reconciliations
- Run "Save & Push to Monthly" again

---

## Data Model

### LeaveReconciliation Interface

```typescript
{
  employeeNumber: string;
  employeeName: string;
  date: string;
  absentInAttendance: boolean;
  leaveRecord?: LeaveRecord;
  reconciliationStatus: 'Matched' | 'Unmatched' | 'Approved' | 'Rejected';
  finalStatus: string; // CL, SL, PL, LOP, A
  remarks: string;
  isPushedToMonthly?: boolean; // NEW: Track push status
}
```

### AuditLogEntry Interface

```typescript
{
  id: string;
  timestamp: string;
  module: 'Leave Reconciliation';
  action: 'Upload' | 'Reconcile' | 'Approve' | 'Reject' | 'Status Change' | 'Push to Monthly';
  entityType: 'Reconciliation';
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

### Export Leave Records
- Exports all uploaded leave data
- Includes all fields from Excel
- Format: Excel (.xlsx)

### Export Reconciliation
- Exports reconciliation results
- Shows matching status, final status, pushed status
- Format: Excel (.xlsx)

### Export Template
- Download sample Excel template
- Use for formatting your leave data
- Includes all required columns

---

## Permissions

| Role | Upload | Reconcile | Approve/Reject | Update Status | Push to Monthly |
|------|--------|-----------|----------------|---------------|-----------------|
| **SaaS Admin** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Admin** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Manager** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Employee** | View Only | - | - | - | - |

---

## Summary

The enhanced Leave Reconciliation module provides:

✅ **Status-based filtering** - Choose which leave statuses to reconcile
✅ **Selective pushing** - Only approved records update monthly report
✅ **Complete audit trail** - Every action logged
✅ **Flexible status updates** - Correct leave types before pushing
✅ **Clear reporting** - Know exactly what was pushed vs pending

This ensures accurate leave tracking while maintaining full control and transparency over the reconciliation process.
