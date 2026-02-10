# Excess Hours PDF Report - Debug Checklist

## Changes Implemented (Commit: 39ad1e5)

### ✅ 1. Serial Numbers (S.No)
**Location**: Line 1596
```typescript
index + 1, // Serial number
```
**What to verify in PDF**:
- First column should be labeled "S.No"
- Values should start from 1, 2, 3, etc. for each table
- Serial numbers should reset for each section (Present Days, Worked Off Days)

---

### ✅ 2. Department & Sub Department Moved to Header
**Location**: Lines 1508-1546
```typescript
// Build header text with Department and Sub Department
const headerLines: string[] = [];

// First line: Legal Entity and Location
const line1Parts: string[] = [];
if (unit.legalEntity && unit.legalEntity !== 'Unknown') {
  line1Parts.push(`Legal Entity: ${unit.legalEntity}`);
}
if (unit.location && unit.location !== 'Unknown') {
  line1Parts.push(`Location: ${unit.location}`);
}

// Second line: Department and Sub Department
const line2Parts: string[] = [];
if (unit.department && unit.department !== 'Unknown') {
  line2Parts.push(`Department: ${unit.department}`);
}
if (unit.subDepartment && unit.subDepartment !== 'Unknown') {
  line2Parts.push(`Sub Department: ${unit.subDepartment}`);
}
```

**What to verify in PDF**:
- Above each table section, you should see:
  - Line 1: "Legal Entity: [Name] | Location: [Name]"
  - Line 2: "Department: [Name] | Sub Department: [Name]"
- Header text wraps within page margins (no overflow)
- NO "Dept" or "Sub Dept" columns in the table

---

### ✅ 3. Header Text Wrapping
**Location**: Lines 1536-1546
```typescript
// Render header lines with wrapping
if (headerLines.length > 0) {
  const maxWidth = pageWidth - 28; // Account for margins
  headerLines.forEach(line => {
    const wrappedLines = doc.splitTextToSize(line, maxWidth);
    wrappedLines.forEach((wrappedLine: string) => {
      doc.text(wrappedLine, 14, yPos);
      yPos += 5;
    });
  });
  yPos += 3; // Extra spacing after header
}
```

**What to verify in PDF**:
- Long text wraps to next line instead of being cut off
- Proper spacing between header lines
- All text visible within page boundaries

---

### ✅ 4. Removed Columns from Table
**Location**: Lines 1601-1602, 1612
```typescript
// rec.department || '-',  // Moved to header
// rec.subDepartment || '-',  // Moved to header
// rec.calculationMethod,  // Removed to save space (implicit from section title)
```

**What to verify in PDF**:
- Table should have **17 columns** (not 20):
  1. S.No
  2. Emp ID
  3. Name
  4. Date
  5. Job Title
  6. Location (kept)
  7. Status
  8. Shift
  9. Shift Start
  10. Shift End
  11. In Time
  12. Out Time
  13. Total Hrs
  14. Excess Hrs
  15. Over 16
  16. OT Form
  17. Final OT Hrs

- **Removed columns** (should NOT appear):
  - ❌ Dept
  - ❌ Sub Dept
  - ❌ Calculation Method

---

### ✅ 5. Table Column Headers
**Location**: Line 1594
```typescript
head: [['S.No', 'Emp ID', 'Name', 'Date', 'Job Title', 'Location', 'Status', 'Shift', 'Shift Start', 'Shift End', 'In Time', 'Out Time', 'Total Hrs', 'Excess Hrs', 'Over 16', 'OT Form', 'Final OT Hrs']]
```

**What to verify in PDF**:
- Header row should have exactly these column names
- "S.No" should be the first column
- No "Dept", "Sub Dept", or "Calculation" columns

---

### ✅ 6. Font Size and Styling
**Location**: Lines 1618-1619
```typescript
styles: { fontSize: 6, cellPadding: 1.5 },
```

**What to verify in PDF**:
- Table text should be readable (font size 6, increased from 5)
- Adequate padding between cell content and borders
- Orange/amber header background color (RGB: 217, 119, 6)

---

### ✅ 7. Column Widths
**Location**: Lines 1620-1638
```typescript
columnStyles: {
  0: { cellWidth: 8 },  // S.No
  1: { cellWidth: 12 }, // Emp ID
  2: { cellWidth: 25 }, // Name
  3: { cellWidth: 15 }, // Date
  4: { cellWidth: 20 }, // Job Title
  5: { cellWidth: 15 }, // Location
  6: { cellWidth: 10 }, // Status
  7: { cellWidth: 10 }, // Shift
  8: { cellWidth: 12 }, // Shift Start
  9: { cellWidth: 12 }, // Shift End
  10: { cellWidth: 10 }, // In Time
  11: { cellWidth: 10 }, // Out Time
  12: { cellWidth: 12 }, // Total Hrs
  13: { cellWidth: 12 }, // Excess Hrs
  14: { cellWidth: 10 }, // Over 16
  15: { cellWidth: 12 }, // OT Form
  16: { cellWidth: 15 }  // Final OT Hrs
}
```

**What to verify in PDF**:
- Columns should have appropriate widths (not too cramped or too wide)
- Employee Name column (25) should be wider than others
- S.No column (8) should be narrow
- Table should fit comfortably in landscape orientation

---

## How to Test

1. **Generate an Excess Hours PDF**:
   - Select a Manager
   - Choose a date range
   - Click "Download Excess Hours PDF"

2. **Open the PDF and check**:
   - Page 1 should start directly with organizational unit headers (no overall summary)
   - Each organizational unit section should have:
     - Multi-line header with Legal Entity, Location, Department, Sub Department
     - Two sections: "Present Days" and "Worked Off Days"
     - Each section has a table with 17 columns starting with S.No

3. **Verify Each Checklist Item** above

---

## Expected PDF Structure

```
Excess Hours Report
Manager: [Manager Name]
Period: [Date Range]
Generated: [Date]

[--- Organizational Unit 1 ---]
Legal Entity: ABC Corp | Location: New York
Department: Engineering | Sub Department: Software Development

Present Days - Excess Hours (>9 hrs beyond shift end)
┌──────┬──────────┬─────────────┬────────┬──────────┬──────────┬────────┐
│ S.No │ Emp ID   │ Name        │ Date   │ Job Title│ Location │ ...    │
├──────┼──────────┼─────────────┼────────┼──────────┼──────────┼────────┤
│  1   │ E001     │ John Doe    │ 01-FEB │ Engineer │ NY       │ ...    │
│  2   │ E002     │ Jane Smith  │ 02-FEB │ Manager  │ NY       │ ...    │
└──────┴──────────┴─────────────┴────────┴──────────┴──────────┴────────┘

Worked Off Days - Excess Hours
┌──────┬──────────┬─────────────┬────────┬──────────┬──────────┬────────┐
│ S.No │ Emp ID   │ Name        │ Date   │ Job Title│ Location │ ...    │
├──────┼──────────┼─────────────┼────────┼──────────┼──────────┼────────┤
│  1   │ E003     │ Bob Jones   │ 03-FEB │ Lead     │ NY       │ ...    │
└──────┴──────────┴─────────────┴────────┴──────────┴──────────┴────────┘

[--- New Page: Organizational Unit 2 ---]
Legal Entity: XYZ Ltd | Location: London
Department: Sales | Sub Department: Enterprise

[... continues ...]
```

---

## Common Issues to Look For

❌ **Issue 1**: Serial numbers not showing
- Check: First column should be labeled "S.No" with values 1, 2, 3...

❌ **Issue 2**: Department still showing in table
- Check: Table should NOT have "Dept" or "Sub Dept" columns
- Check: Department info should only appear in the header above the table

❌ **Issue 3**: Header text cut off
- Check: Long department/entity names should wrap to next line
- Check: All header text should be visible

❌ **Issue 4**: Table too wide or overlapping
- Check: All 17 columns should fit in landscape mode
- Check: No horizontal scrolling needed

❌ **Issue 5**: Calculation Method column still present
- Check: Table should have 17 columns, not 19
- Check: No "Calculation" or "Calculation Method" header

---

## Files Changed

- `pages/ManagerPDFReport.tsx` (Lines 1488-1640)

## Commit Hash

`39ad1e5` - "Improve Excess Hours report layout and reduce table width"
