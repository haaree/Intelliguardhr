# Quick Start Guide - Leave Reconciliation & Audit Queue

## 🚀 Quick Setup

### Prerequisites
1. Attendance data uploaded
2. Employee data uploaded
3. Admin/Manager access

---

## 📋 Leave Reconciliation - 5 Steps

### Step 1: Upload Leave Records
```
Click: "Import Leaves" → Select Excel file → Upload
```
**Result:** Shows available statuses (Approved, Pending, Rejected, etc.)

### Step 2: Select Statuses
```
Status Selection Panel → Click desired statuses → Select
```
**Example:** ✓ Approved  ✓ Pending

### Step 3: Reconcile
```
Click: "Reconcile"
```
**Result:** Shows Matched and Unmatched records

### Step 4: Review & Approve
```
For each match:
- Click ✓ to Approve
- Click ✗ to Reject
- (Optional) Update final status dropdown
```

### Step 5: Push to Monthly
```
Click: "Save & Push to Monthly" → Confirm
```
**Result:** Only approved records update monthly report

---

## ⚡ Audit Queue - 4 Steps

### Step 1: Auto-Populated Queue
```
Navigate to: "Audit Queue" page
```
**Result:** Automatically shows all attendance records flagged as "Audit"

### Step 2: Update Status
```
For each record:
- Select updated status from dropdown (P, HD, A, CL, etc.)
```
**Result:** Status changes to "Reviewed"

### Step 3: Approve
```
Click: ✓ Approve (or ✗ Reject)
```
**Result:** Status changes to "Approved" or "Rejected"

### Step 4: Push to Monthly
```
Click: "Save & Push to Monthly" → Confirm
```
**Result:** Only approved updates affect monthly report

---

## 📊 Status Meanings

### Leave Reconciliation Statuses
| Status | Meaning |
|--------|---------|
| **Matched** | Leave found for absent day |
| **Unmatched** | No leave found |
| **Approved** | Admin approved, ready to push |
| **Rejected** | Admin rejected, remains absent |

### Audit Queue Review Statuses
| Status | Meaning |
|--------|---------|
| **Pending Review** | Just entered queue |
| **Under Review** | Being worked on |
| **Reviewed** | Status updated |
| **Approved** | Ready to push to monthly |
| **Rejected** | Keep original status |

### Attendance Status Codes
| Code | Meaning |
|------|---------|
| **P** | Present |
| **HD** | Half Day |
| **A** | Absent |
| **WO** | Weekly Off |
| **H** | Holiday |
| **CL** | Casual Leave |
| **PL** | Privilege Leave |
| **SL** | Sick Leave |
| **LOP** | Loss of Pay |

---

## 🎯 Key Concepts

### What Gets Pushed to Monthly Report?

✅ **PUSHED:**
- Leave Reconciliation: **Approved** reconciliations with `isPushedToMonthly = true`
- Audit Queue: **Approved** records with updated status and `isPushedToMonthly = true`

❌ **NOT PUSHED:**
- Matched but not approved
- Rejected records
- Pending review records
- These remain **blank** or **original status**

---

## 🔍 Common Tasks

### Task: Approve a Leave
```
1. Go to: Leave Recon page
2. Upload leave Excel
3. Select "Approved" status
4. Click "Reconcile"
5. Click ✓ on matched records
6. Click "Save & Push to Monthly"
```

### Task: Fix Late Arrival
```
1. Go to: Audit Queue page
2. Find record (auto-populated)
3. Change status to "P" (Present)
4. Click ✓ Approve
5. Click "Save & Push to Monthly"
```

### Task: Mark Absence as Leave
```
1. Go to: Audit Queue page
2. Find absent record
3. Change status to "CL" or "PL"
4. Click ✓ Approve
5. Click "Save & Push to Monthly"
```

### Task: Reject Invalid Leave
```
1. Go to: Leave Recon page
2. Find matched record
3. Click ✗ Reject
4. (No push needed - rejected records don't affect monthly)
```

---

## ⚠️ Important Rules

### DO:
- ✓ Review each record before approving
- ✓ Check employee details and dates
- ✓ Update status if needed before pushing
- ✓ Push to monthly before month-end
- ✓ Export audit logs regularly

### DON'T:
- ✗ Push without reviewing
- ✗ Approve without verifying details
- ✗ Push multiple times unnecessarily
- ✗ Edit records after they're pushed
- ✗ Mix up leave reconciliation with audit queue

---

## 📈 Dashboard Statistics

### Leave Reconciliation Stats
- **Total**: All reconciliations
- **Matched**: Found leave for absent
- **Unmatched**: No leave found
- **Approved**: Approved for monthly
- **Rejected**: Not for monthly
- **Pushed**: Already in monthly report

### Audit Queue Stats
- **Total**: All in queue
- **Pending**: Awaiting review
- **In Review**: Being worked
- **Reviewed**: Status updated
- **Approved**: Approved for monthly
- **Rejected**: Keep original
- **Pushed**: Already in monthly report

---

## 🔧 Filters & Search

### Search
```
Type in search box → Filters by Employee Number or Name
```

### Status Filter
```
Dropdown → Select status → Shows only that status
```

### Date Range (Future)
```
Currently shows all records
```

---

## 💾 Data Files

### Leave Reconciliation Excel Format
```
Required Columns:
- Employee Number
- Employee Name
- Leave Types (CL, PL, etc.)
- From Date (DD-MMM-YYYY)
- To Date (DD-MMM-YYYY)
- Status (Approved, Pending, etc.)
- Reason
```

### Audit Queue Excel Format
```
Required Columns:
- Employee Number
- Employee Name
- Date (DD-MMM-YYYY)
- Department
- Current Status
- Deviation
- Audit Reason
- Review Status
```

### Download Templates
```
Click: "Template" button on each page
```

---

## 🚨 Troubleshooting

### No Matches Found
**Problem:** Reconciliation shows 0 matches
**Solution:**
- Check date format (DD-MMM-YYYY)
- Verify employee numbers match
- Ensure selected status in leave records
- Verify absent records exist

### Status Not Updating
**Problem:** Can't change status
**Solution:**
- Check if already pushed (`isPushedToMonthly = true`)
- Verify admin permissions
- Refresh page

### Records Not in Monthly Report
**Problem:** Approved records not showing
**Solution:**
- Click "Save & Push to Monthly"
- Verify status is "Approved"
- Check `isPushedToMonthly` flag
- Recalculate monthly report

### Audit Queue Empty
**Problem:** No records auto-populated
**Solution:**
- Upload attendance data first
- Ensure some records have status "Audit"
- Check for deviation field
- Refresh page

---

## 📞 Support

### Documentation
- Full Guide: [LEAVE_RECONCILIATION_GUIDE.md](LEAVE_RECONCILIATION_GUIDE.md)
- Audit Queue: [AUDIT_QUEUE_GUIDE.md](AUDIT_QUEUE_GUIDE.md)
- Technical: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

### Getting Help
1. Check user guides
2. Review troubleshooting section
3. Export audit logs for analysis
4. Contact system administrator

---

## 🎓 Best Practices

### Daily Routine
1. **Morning:** Check audit queue for new records
2. **Review:** Update statuses for flagged items
3. **Approve:** Process reviewed records
4. **Push:** Update monthly report

### Weekly Routine
1. **Upload:** Import leave records
2. **Reconcile:** Match with attendance
3. **Review:** Approve/reject matches
4. **Export:** Download audit logs

### Month-End Routine
1. **Final Review:** Check all pending items
2. **Push:** Finalize monthly updates
3. **Export:** Generate reports
4. **Archive:** Save audit logs

---

## ⌨️ Keyboard Shortcuts (Future)

Currently not implemented. Use mouse/touch interactions.

---

## 📱 Mobile Access

Currently optimized for desktop. Mobile responsive design coming soon.

---

## 🔐 Permissions

### Who Can Do What?

| Action | SaaS Admin | Admin | Manager | Employee |
|--------|------------|-------|---------|----------|
| Upload | ✓ | ✓ | ✓ | - |
| Reconcile | ✓ | ✓ | ✓ | - |
| Approve/Reject | ✓ | ✓ | ✓ | - |
| Update Status | ✓ | ✓ | ✓ | - |
| Push to Monthly | ✓ | ✓ | ✓ | - |
| View All | ✓ | ✓ | ✓ | - |
| View Own | ✓ | ✓ | ✓ | ✓ |
| Export | ✓ | ✓ | ✓ | - |

---

## 🎉 Quick Tips

💡 **Tip 1:** Use "Select All" for status selection if you want to reconcile all leaves

💡 **Tip 2:** Export before and after pushing to monthly for records

💡 **Tip 3:** Audit queue auto-refreshes - just navigate to the page

💡 **Tip 4:** Statistics update in real-time as you approve/reject

💡 **Tip 5:** Use search to quickly find specific employees

💡 **Tip 6:** Filter by status to focus on specific review stages

💡 **Tip 7:** Coordinate Leave Recon and Audit Queue to avoid conflicts

💡 **Tip 8:** Push to monthly before month-end for accurate reports

💡 **Tip 9:** Check audit logs to see who did what and when

💡 **Tip 10:** Use templates for consistent data format

---

## 📋 Cheat Sheet

### Leave Reconciliation
```
Upload → Select Statuses → Reconcile → Approve → Push
```

### Audit Queue
```
Auto-Populate → Update Status → Approve → Push
```

### Remember
```
Only APPROVED + PUSHED = In Monthly Report
Everything else = Blank or Original Status
```

---

**Version:** 1.0.0
**Last Updated:** 2026-01-30
**Status:** ✅ Ready to Use
