const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const app = express();
const PORT = 3000;
const EXCEL_FILE = path.join(__dirname, 'database.xlsx');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const defaultData = {
  users: [
    { id: "u1", username: "jpa01", password: "password", role: "JPA", name: "JPA Supervisor" },
    { id: "u2", username: "ldp01", password: "password", role: "LDP", name: "LDP Officer" },
    { id: "u3", username: "admin01", password: "password", role: "Admin", name: "Discipline Admin" },
    { id: "u4", username: "teacher01", password: "password", role: "Admin", name: "Teacher / Admin" }
  ],
  students: [
    { id: "s1001", name: "Ammar Zafri Rizqullah Bin Mohd Yusof", noMaktab: "CB231068", className: "Form 4 Ibnu Khaldun", gender: "Male", status: "Active", currentDemerit: 0 },
    { id: "s1002", name: "Nur Aina Binti Ahmad", noMaktab: "CB231069", className: "Form 4 Ibnu Khaldun", gender: "Female", status: "Active", currentDemerit: 0 },
    { id: "s1003", name: "Muhammad Hakim Bin Razali", noMaktab: "CB231070", className: "Form 5 Al-Biruni", gender: "Male", status: "Active", currentDemerit: 0 },
    { id: "s1004", name: "Siti Khadijah Binti Ibrahim", noMaktab: "CB231071", className: "Form 5 Al-Biruni", gender: "Female", status: "Active", currentDemerit: 0 },
    { id: "s1005", name: "Haziq Daniel Bin Zulkifli", noMaktab: "CB231072", className: "Form 3 Al-Farabi", gender: "Male", status: "Active", currentDemerit: 0 },
    { id: "s1006", name: "Aina Sofea Binti Zainal", noMaktab: "CB231073", className: "Form 3 Al-Farabi", gender: "Female", status: "Active", currentDemerit: 0 },
    { id: "s1007", name: "Irfan Zaki Bin Harun", noMaktab: "CB231074", className: "Form 2 Al-Ghazali", gender: "Male", status: "Active", currentDemerit: 0 },
    { id: "s1008", name: "Puteri Liyana Binti Roslan", noMaktab: "CB231075", className: "Form 2 Al-Ghazali", gender: "Female", status: "Active", currentDemerit: 0 },
    { id: "s1009", name: "Danial Haqim Bin Rahman", noMaktab: "CB231076", className: "Form 1 Al-Khwarizmi", gender: "Male", status: "Active", currentDemerit: 0 },
    { id: "s1010", name: "Nurul Izzati Binti Kamal", noMaktab: "CB231077", className: "Form 1 Al-Khwarizmi", gender: "Female", status: "Active", currentDemerit: 0 },
    { id: "s1011", name: "Amirul Hakim Bin Azman", noMaktab: "CB231078", className: "Form 4 Ibnu Khaldun", gender: "Male", status: "Active", currentDemerit: 0 },
    { id: "s1012", name: "Syasya Nadira Binti Salleh", noMaktab: "CB231079", className: "Form 5 Al-Biruni", gender: "Female", status: "Active", currentDemerit: 0 }
  ],
  offences: [
    { id: "o1", title: "Pakaian Tidak Lengkap", category: "LDP", points: 5, enabled: true },
    { id: "o2", title: "Lambat Turun Roll Call", category: "LDP", points: 4, enabled: true },
    { id: "o3", title: "Menceroboh Asrama", category: "LDP", points: 12, enabled: true },
    { id: "o4", title: "Rambut Tidak Mengikut Peraturan", category: "LDP", points: 6, enabled: true },
    { id: "o5", title: "Bergaduh", category: "LDP", points: 15, enabled: true },
    { id: "o6", title: "Membazir Elektrik", category: "JPA", points: 4, enabled: true },
    { id: "o7", title: "Kiub / Bilik Kotor", category: "JPA", points: 3, enabled: true },
    { id: "o8", title: "Lewat Masuk Asrama", category: "JPA", points: 5, enabled: true },
    { id: "o9", title: "Tidak Ikut Jadual", category: "JPA", points: 6, enabled: true },
    { id: "o10", title: "Membawa Barang Larangan", category: "JPA", points: 10, enabled: true }
  ],
  reports: [],
  audit: []
};

function ensureExcelFile() {
  if (!fs.existsSync(EXCEL_FILE)) {
    writeExcel(defaultData);
    console.log('Created initial database.xlsx file');
  }
}

function readExcel() {
  ensureExcelFile();
  const wb = xlsx.readFile(EXCEL_FILE);
  const data = {
    users: xlsx.utils.sheet_to_json(wb.Sheets['Users'] || {}),
    students: xlsx.utils.sheet_to_json(wb.Sheets['Students'] || {}),
    offences: xlsx.utils.sheet_to_json(wb.Sheets['Offences'] || {}),
    reports: xlsx.utils.sheet_to_json(wb.Sheets['Reports'] || {}),
    audit: xlsx.utils.sheet_to_json(wb.Sheets['Audit'] || {})
  };

  // Coerce points and enabled flags to boolean/number
  data.offences.forEach(o => {
    o.points = Number(o.points || 0);
    o.enabled = o.enabled === true || String(o.enabled).toLowerCase() === 'true';
  });
  data.students.forEach(s => {
    s.currentDemerit = Number(s.currentDemerit || 0);
  });
  data.reports.forEach(r => {
    r.points = Number(r.points || 0);
  });

  return data;
}

function writeExcel(data) {
  const wb = xlsx.utils.book_new();

  const usersSheet = xlsx.utils.json_to_sheet(data.users || []);
  const studentsSheet = xlsx.utils.json_to_sheet(data.students || []);
  const offencesSheet = xlsx.utils.json_to_sheet(data.offences || []);
  const reportsSheet = xlsx.utils.json_to_sheet(data.reports || []);
  const auditSheet = xlsx.utils.json_to_sheet(data.audit || []);

  xlsx.utils.book_append_sheet(wb, usersSheet, 'Users');
  xlsx.utils.book_append_sheet(wb, studentsSheet, 'Students');
  xlsx.utils.book_append_sheet(wb, offencesSheet, 'Offences');
  xlsx.utils.book_append_sheet(wb, reportsSheet, 'Reports');
  xlsx.utils.book_append_sheet(wb, auditSheet, 'Audit');

  xlsx.writeFile(wb, EXCEL_FILE);
}

// API Routes
app.get('/api/data', (req, res) => {
  try {
    const data = readExcel();
    res.json(data);
  } catch (err) {
    console.error('Error reading excel:', err);
    res.status(500).json({ error: 'Failed to read database.xlsx' });
  }
});

app.post('/api/data', (req, res) => {
  try {
    const data = req.body;
    writeExcel(data);
    res.json({ success: true, message: 'Saved to database.xlsx successfully' });
  } catch (err) {
    console.error('Error writing excel:', err);
    res.status(500).json({ error: 'Failed to write to database.xlsx' });
  }
});

ensureExcelFile();

app.listen(PORT, () => {
  console.log(`Demerit BenTech Excel Server running at http://localhost:${PORT}`);
});
