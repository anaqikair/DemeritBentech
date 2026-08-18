const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const JSON_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const defaultData = {
  users: [
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
    { id: "o1", title: "Ceroboh asrama", category: "LDP", points: 500, enabled: true },
    { id: "o2", title: "Gagal hadir ke perhimpunan pagi atau malam", category: "LDP", points: 300, enabled: true },
    { id: "o3", title: "Gagal hadir ke program rasmi maktab", category: "LDP", points: 300, enabled: true },
    { id: "o4", title: "Gagal hadir ke surau", category: "LDP", points: 300, enabled: true },
    { id: "o5", title: "Lewat kosongkan asrama", category: "LDP", points: 50, enabled: true },
    { id: "o6", title: "Lewat hadir ke mana program rasmi maktab", category: "LDP", points: 50, enabled: true },
    { id: "o7", title: "Pakaian", category: "LDP", points: 50, enabled: true },
    { id: "o8", title: "Kekemasan diri", category: "LDP", points: 50, enabled: true }
  ],
  reports: [],
  audit: []
};

function ensureJsonFile() {
  if (!fs.existsSync(JSON_FILE)) {
    writeJson(defaultData);
    console.log('Created initial data.json file');
  }
}

function readJson() {
  ensureJsonFile();
  const raw = fs.readFileSync(JSON_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeJson(data) {
  fs.writeFileSync(JSON_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// API Routes
app.get('/api/data', (req, res) => {
  try {
    const data = readJson();
    res.json(data);
  } catch (err) {
    console.error('Error reading json:', err);
    res.status(500).json({ error: 'Failed to read data.json' });
  }
});

app.post('/api/data', (req, res) => {
  try {
    const data = req.body;
    writeJson(data);
    res.json({ success: true, message: 'Saved to data.json successfully' });
  } catch (err) {
    console.error('Error writing json:', err);
    res.status(500).json({ error: 'Failed to write to data.json' });
  }
});

ensureJsonFile();

app.listen(PORT, () => {
  console.log(`Demerit BenTech JSON Server running at http://localhost:${PORT}`);
});
