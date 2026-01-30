# Leave Reconciliation - Optimized System Guide

## Overview

The new Leave Reconciliation system automatically identifies all absent records from Logs Audit and allows you to upload an Excel file to reconcile them. Only reconciled records appear in the Monthly Report - unreconciled absences show as **BLANK**.

---

## 🎯 Key Features

### 1. **Auto-Detection of Absent Records**
- System automatically finds all attendance records with status = "Absent" or "A"
- No manual selection needed - all absences are ready for reconciliation

### 2. **Excel Upload with Status Comparison**
- Upload Excel with employee details and status
- System matches Excel data with absent records
- Shows both "Absent Status" (from attendance) and "Excel Status" (from file) side-by-side

### 3. **Accept or Override Status**
- Accept the Excel status as-is
- Or override with a different status and add comments
- Flexible dropdown: CL, PL, SL, CO, LOP, MEL, A, HD

### 4. **Smart Monthly Report Integration**
- **Reconciled records** → Show with final status in Monthly Report
- **Unreconciled records** → Show as **BLANK** (not "A") in Monthly Report
- Clear distinction between what's processed vs pending

---

## 📋 Excel File Format

### Required Columns:

| Column Name | Description | Example |
|-------------|-------------|---------|
| **Employee Number** | Unique employee ID | E001 |
| **Employee Name** | Full name | John Doe |
| **Job Title** | Position | Software Engineer |
| **Business Unit** | Business division | Technology |
| **Department** | Department name | Engineering |
| **Sub Department** | Sub-division | Product Development |
| **Location** | Work location | Mumbai |
| **Cost Center** | Cost center code | CC001 |
| **Reporting Manager** | Manager name | Jane Smith |
| **Date** | Absence date | 15-JAN-2024 |
| **Status** | Leave status | CL |

### Sample Excel Data:
```
Employee Number | Employee Name | Date        | Status | Department
E001           | John Doe      | 15-JAN-2024 | CL     | Engineering
E002           | Jane Smith    | 16-JAN-2024 | PL     | HR
E003           | Bob Wilson    | 15-JAN-2024 | LOP    | Operations
```

### Download Template:
Click **"Template"** button on Leave Recon page to download pre-formatted Excel template.

---

## 🚀 Complete Workflow

### Step 1: Navigate to Leave Reconciliation
```
Login → Sidebar → "Leave Recon"
```

**What You'll See:**
- System shows: **"X Absent Records • 0 Loaded • 0 Reconciled"**
- Instruction panel explaining the workflow
- Blue info box showing number of absent records found

### Step 2: Upload Excel File
```
Click "Upload Excel" → Select file → Open
```

**What Happens:**
1. System reads your Excel file
2. Extracts all unique statuses (CL, PL, SL, etc.)
3. Matches Excel records with absent attendance records by:
   - Employee Number
   - Date
4. Shows results in table

**Alert Message:**
```
Loaded 45 absent records!

Available Statuses: CL, PL, SL, LOP
```

### Step 3: Review Statistics Dashboard
After upload, you'll see 5 stat cards:

| Stat | Meaning |
|------|---------|
| **Total** | Total absent records loaded |
| **Reconciled** | Records you've accepted/overridden |
| **Pending** | Records awaiting your action |
| **Matched** | Records found in your Excel |
| **Not Found** | Records missing from Excel |

**Example:**
```
Total: 45 | Reconciled: 0 | Pending: 45 | Matched: 38 | Not Found: 7
```

### Step 4: Review Each Record

For each row in the table, you'll see:

| Column | Shows | Color Code |
|--------|-------|------------|
| **Emp #** | Employee Number | Black |
| **Name** | Employee Name | Teal |
| **Department** | Department | Gray |
| **Date** | Absence Date | Bold Gray |
| **Absent Status** | Always "A" | Red Badge |
| **Excel Status** | Status from file | Indigo Badge or Gray (Not Found) |
| **Final Status** | Dropdown to override | Editable Dropdown |
| **Comments** | Your notes | Text Input |
| **Actions** | Accept button | Green Button |

### Step 5: Accept or Override Status

**Option A: Accept Excel Status**
```
1. Leave "Final Status" as-is (pre-filled from Excel)
2. Optionally add comment
3. Click "Accept" button
4. Row turns green and shows "✓ Reconciled"
```

**Option B: Override Status**
```
1. Change "Final Status" dropdown to different value
2. Add mandatory comment explaining why
3. Click "Accept" button
4. Row turns green with your overridden status
```

**Option C: For "Not Found" Records**
```
1. Excel Status shows "Not Found" in gray
2. Final Status defaults to "A" (Absent)
3. You can override to appropriate status
4. Add comment: "No leave application found - mark as LOP"
5. Click "Accept"
```

### Step 6: Use Filters (Optional)

**Search Filter:**
```
Type employee name or number → Results filter instantly
```

**Status Filter:**
```
Dropdown: "Excel Status: All"
Options: All, CL, PL, SL, LOP, Not Found
→ Shows only records with selected Excel status
```

### Step 7: Push to Monthly Report
```
After reconciling desired records:
1. Click "Push to Monthly" button
2. Confirmation popup shows:
   ✓ 35 reconciled records will be updated
   ⚠ 10 unreconciled records will show as BLANK
3. Click OK
4. Success message confirms push
```

---

## 📊 Monthly Report Behavior

### Before Reconciliation Push:
All absent records show as **"A"** in Monthly Report

### After Reconciliation Push:

| Scenario | Monthly Report Shows |
|----------|---------------------|
| Reconciled with CL | **"CL"** |
| Reconciled with PL | **"PL"** |
| Reconciled with LOP | **"LOP"** |
| NOT Reconciled | **BLANK** (not "A") |

### Example:
```
Employee: John Doe
Date: 15-JAN-2024

Scenario 1: Reconciled as CL
→ Monthly Report shows: CL

Scenario 2: Not Reconciled
→ Monthly Report shows: (blank cell)
```

---

## 💡 Best Practices

### 1. **Prepare Excel File Carefully**
```
✓ Use DD-MMM-YYYY format for dates (15-JAN-2024)
✓ Ensure Employee Numbers match exactly
✓ Include all required columns
✓ Use standard status codes (CL, PL, SL, CO, LOP, MEL)
✗ Don't use custom status codes
✗ Don't leave Employee Number blank
```

### 2. **Review Before Accepting**
```
✓ Check if Excel status makes sense
✓ Verify date matches employee's absence
✓ Add comments for any overrides
✓ Double-check "Not Found" records
```

### 3. **Handle "Not Found" Records**
```
These are absent records not in your Excel:
- Verify if leave was actually applied
- Check with HR/Manager
- Mark as appropriate status (LOP if no leave)
- Add clear comment
```

### 4. **Use Comments Effectively**
```
Good Comments:
✓ "Approved by manager via email"
✓ "Medical emergency - verbal approval"
✓ "Leave application submitted late"
✓ "Changed from CL to LOP - exceeds quota"

Bad Comments:
✗ "ok"
✗ "done"
✗ (blank)
```

### 5. **Reconcile Incrementally**
```
Don't wait to reconcile all at once:
1. Reconcile clear cases first
2. Flag unclear ones for investigation
3. Push reconciled batch to monthly
4. Continue with remaining records
```

---

## 🔍 Common Scenarios

### Scenario 1: Employee on Casual Leave
```
Attendance: Absent (A)
Excel: CL
Action: Accept as CL
Comment: "Approved casual leave"
Result: Monthly shows "CL"
```

### Scenario 2: Unapproved Absence
```
Attendance: Absent (A)
Excel: Not Found
Action: Override to LOP
Comment: "No leave application - mark as LOP"
Result: Monthly shows "LOP"
```

### Scenario 3: Wrong Leave Type in Excel
```
Attendance: Absent (A)
Excel: CL
Action: Override to PL
Comment: "Should be PL not CL - verified with HR"
Result: Monthly shows "PL"
```

### Scenario 4: Pending Investigation
```
Attendance: Absent (A)
Excel: Not Found
Action: Do NOT reconcile yet
Comment: N/A
Result: Monthly shows BLANK (until reconciled)
```

### Scenario 5: Half Day Leave
```
Attendance: Absent (A)
Excel: HD
Action: Accept as HD
Comment: "Half day casual leave"
Result: Monthly shows "HD"
```

---

## 📈 Statistics Interpretation

### Healthy Reconciliation:
```
Total: 50 | Reconciled: 45 | Pending: 5 | Matched: 48 | Not Found: 2

✓ 90% reconciled
✓ 96% matched with Excel
✓ Only 4% need investigation
```

### Needs Attention:
```
Total: 50 | Reconciled: 10 | Pending: 40 | Matched: 20 | Not Found: 30

⚠ Only 20% reconciled
⚠ 60% not found in Excel
→ Action: Upload complete Excel file
```

---

## ⚠️ Important Notes

### 1. **Blank vs "A" in Monthly Report**
```
OLD SYSTEM:
- Unreconciled → Shows "A"
- Reconciled → Shows leave status

NEW SYSTEM:
- Unreconciled → Shows BLANK
- Reconciled → Shows leave status

Why? Blank indicates "pending review", not confirmed absence
```

### 2. **Cannot Un-Reconcile**
```
Once you click "Accept", the record is marked as reconciled.
To change:
1. Don't push to monthly yet
2. Re-upload Excel with corrected data
3. Process will reset
```

### 3. **Push is One-Way**
```
After pushing to monthly:
- Changes are applied to attendance
- Cannot bulk undo
- Individual attendance records can be edited manually
```

### 4. **Status Codes**
```
Standard Codes:
- CL = Casual Leave
- PL = Privilege Leave
- SL = Sick Leave
- CO = Compensatory Off
- LOP = Loss of Pay
- MEL = Maternity/Paternity Leave
- A = Absent
- HD = Half Day
```

---

## 🛠️ Troubleshooting

### Issue: No Absent Records Found
```
Problem: System shows "0 Absent Records"
Cause: No attendance records with status = "Absent"
Solution:
1. Check Logs Audit page
2. Ensure attendance is uploaded
3. Verify status field shows "Absent" or "A"
```

### Issue: Excel Upload Fails
```
Problem: Error message on upload
Cause: Invalid file format
Solution:
1. Download template
2. Copy your data to template
3. Ensure date format: DD-MMM-YYYY
4. Check all required columns present
```

### Issue: Zero Matches
```
Problem: All records show "Not Found"
Cause: Employee Number or Date mismatch
Solution:
1. Check Employee Numbers in Excel match attendance exactly
2. Verify date format matches
3. Look for extra spaces or formatting issues
```

### Issue: Can't Override Status
```
Problem: Dropdown disabled
Cause: Record already reconciled
Solution:
1. Reconciled records lock automatically
2. Re-upload Excel to reset if needed
3. Or edit in Logs Audit page directly
```

---

## 📤 Export Options

### 1. **Export Template**
```
Button: "Template"
Purpose: Download Excel template
Use: Format your data correctly
```

### 2. **Export Reconciliation**
```
Button: "Export"
Purpose: Download current reconciliation state
Includes:
- All columns from screen
- Reconciliation status
- Comments
Use: For record-keeping or audit
```

---

## 🎓 Training Checklist

Before using the system, ensure you:
- [ ] Understand absent vs reconciled vs blank
- [ ] Know how to format Excel file
- [ ] Can use status dropdown
- [ ] Know when to add comments
- [ ] Understand push to monthly effect
- [ ] Can interpret statistics
- [ ] Know how to handle "Not Found" records

---

## 📞 Support

### Quick Reference:
1. **Template** → Download Excel format
2. **Upload Excel** → Load leave data
3. **Review** → Check each record
4. **Accept/Override** → Reconcile
5. **Push to Monthly** → Apply changes

### Remember:
✅ Reconciled records appear in monthly report
❌ Unreconciled records show as BLANK

---

**Version:** 2.0 (Optimized)
**Date:** 2026-01-30
**Status:** ✅ Production Ready
