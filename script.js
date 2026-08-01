const DATA_KEY = 'demerit_bentech_state_v2';
const SESSION_KEY = 'demerit_bentech_session_v2';

const state = {
  loaded: false,
  appMeta: {},
  users: [],
  students: [],
  offences: [],
  reports: [],
  audit: [],
  session: null,
  selectedStudentId: null,
  selectedReportId: null,
  ui: {
    currentView: 'overview',
    search: '',
    reportFilter: 'all',
    activeCategory: 'all'
  }
};

const ROLE_LABEL = { JPA: 'JPA', LDP: 'LDP', Admin: 'Admin' };

const els = {};
function byId(id){ return document.getElementById(id); }
function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

function uuid(prefix='id'){
  return prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}
function nowISO(){ return new Date().toISOString(); }
function pad(n){ return String(n).padStart(2,'0'); }
function formatDate(iso){
  if(!iso) return '-';
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function initials(name=''){
  return name.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
}
function scoreLabel(points){
  if(points >= 50) return {text:'Critical', cls:'bad'};
  if(points >= 25) return {text:'Watchlist', cls:'warn'};
  return {text:'Normal', cls:'good'};
}
function statusClass(s){ return String(s||'').toLowerCase(); }

function saveState(){
  const exportable = {
    users: state.users,
    students: state.students,
    offences: state.offences,
    reports: state.reports,
    audit: state.audit,
    appMeta: state.appMeta
  };
  localStorage.setItem(DATA_KEY, JSON.stringify(exportable));
}
function saveSession(){
  if(state.session) localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
  else localStorage.removeItem(SESSION_KEY);
}
function loadLocalState(){
  try{
    const raw = localStorage.getItem(DATA_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed.students) && parsed.students.length > 0){
        Object.assign(state, {
          users: parsed.users || [],
          students: parsed.students || [],
          offences: parsed.offences || [],
          reports: parsed.reports || [],
          audit: parsed.audit || [],
          appMeta: parsed.appMeta || {}
        });
        return true;
      }
    }
  }catch(e){}
  return false;
}
function loadSession(){
  try{
    const raw = localStorage.getItem(SESSION_KEY);
    if(raw) state.session = JSON.parse(raw);
  }catch(e){}
}

function roleOffenceList(role){
  return state.offences.filter(o => o.enabled !== false && o.category === role);
}
function roleCanManageAll(role){ return role === 'Admin'; }
function roleCanSeeAll(role){ return role === 'Admin'; }

function seedFromData(){
  // from loaded json when no local state exists
  return fetch('data.json', {cache:'no-store'})
    .then(r => r.json())
    .then(d => {
      state.appMeta = d.app || {};
      state.users = d.users || [];
      state.students = d.students || [];
      state.offences = d.offences || [];
      state.reports = d.reports || [];
      state.audit = d.audit || [];
      ensureScoreSync();
      saveState();
    });
}

function ensureScoreSync(){
  // Recompute student current demerit from approved reports to keep data consistent
  const approved = state.reports.filter(r => r.status === 'Approved');
  const totals = new Map(state.students.map(s => [s.id, 0]));
  approved.forEach(r => totals.set(r.studentId, (totals.get(r.studentId) || 0) + Number(r.points || 0)));
  state.students.forEach(s => { s.currentDemerit = totals.get(s.id) || 0; });
}

function pushAudit(action){
  state.audit.unshift({id: uuid('a'), user: state.session?.username || 'system', action, time: nowISO()});
  state.audit = state.audit.slice(0, 200);
  saveState();
}

function getUser(){
  if(!state.session) return null;
  return state.users.find(u => u.username === state.session.username) || null;
}

function loginHandler(){
  const role = els.loginRole?.value || 'Admin';
  const username = els.loginUsername?.value.trim() || '';
  const password = els.loginPassword?.value || '';
  const remember = byId('loginRememberMe')?.checked || false;

  if(!username || !password){
    alert('Please enter both username and password.');
    return;
  }

  const user = state.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if(!user){
    alert('Invalid credentials: Username not found.');
    return;
  }

  if(user.password && user.password !== password){
    alert('Invalid credentials: Password incorrect.');
    return;
  }

  if(user.role !== role){
    alert(`Role mismatch: User "@${user.username}" is registered as "${user.role}", not "${role}". Please select role "${user.role}".`);
    return;
  }

  state.session = { username: user.username, role: user.role, remember };
  saveSession();
  route(user.role === 'Admin' ? 'overview' : 'reports');
  showApp();
}

function quickDemoLogin(role, username, password){
  if(els.loginRole) els.loginRole.value = role;
  if(els.loginUsername) els.loginUsername.value = username;
  if(els.loginPassword) els.loginPassword.value = password;
  if(byId('loginRememberMe')) byId('loginRememberMe').checked = true;
  loginHandler();
}
window.quickDemoLogin = quickDemoLogin;

function logout(){
  state.session = null;
  state.selectedStudentId = null;
  state.selectedReportId = null;
  saveSession();
  hideApp();
}

function route(view){
  const role = state.session?.role;
  // If JPA/LDP and view is overview/students/settings, default to 'reports'
  if(role !== 'Admin' && ['overview','students','offences','users','audit','settings'].includes(view)){
    view = 'reports';
  }

  state.ui.currentView = view;
  qsa('.nav button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  qsa('.view-stack').forEach(v => v.classList.add('hidden'));
  const map = {
    overview:'viewOverview', students:'viewStudents', reports:'viewReports', personal:'viewPersonal',
    offences:'viewOffences', users:'viewUsers', audit:'viewAudit', settings:'viewSettings'
  };
  const el = byId(map[view] || 'viewReports');
  if(el) el.classList.remove('hidden');

  const titles = {
    overview: ['Overview', 'Latest discipline activity and rankings.'],
    students: ['Students', 'Search students and view discipline history.'],
    reports: ['Report Offence', 'Submit and record student discipline offences.'],
    personal: ['Personal Info', 'Summary of submitted reports and activity statistics.'],
    offences: ['Offences', 'Manage discipline offences and demerit values.'],
    users: ['Users', 'Manage accounts and roles.'],
    audit: ['Audit Log', 'Track every important action.'],
    settings: ['Settings', 'System tools and data controls.']
  };
  const [title, sub] = titles[view] || titles.reports;
  byId('pageTitle').textContent = title;
  byId('pageSub').textContent = sub;
  byId('currentViewPill').textContent = title;
  render();
}

function showApp(){
  byId('loginView').classList.add('hidden');
  byId('mainView').classList.remove('hidden');
  const user = getUser();
  byId('userName').textContent = user ? (user.name || user.username) : 'User';
  byId('userRole').textContent = state.session?.role || '';
  byId('userAvatar').textContent = initials(user?.name || user?.username || 'U');
  buildNav();
  render();
}
function hideApp(){
  byId('mainView').classList.add('hidden');
  byId('loginView').classList.remove('hidden');
}

function buildLoginRoles(){
  els.loginRole.innerHTML = '';
  ['JPA','LDP','Admin'].forEach(r=>{
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    els.loginRole.appendChild(opt);
  });
}

function buildNav(){
  const role = state.session?.role;
  let links = [];

  if(role === 'Admin'){
    links = [
      ['overview', 'Overview'],
      ['students', 'Students'],
      ['reports', 'Reports'],
      ['offences', 'Offences'],
      ['users', 'Users'],
      ['audit', 'Audit'],
      ['settings', 'Settings']
    ];
  } else {
    // For JPA and LDP: only "Report Offence" and "Personal Info" (My Activity)
    links = [
      ['reports', 'Report Offence'],
      ['personal', 'Personal Info']
    ];
  }

  els.navTabs.innerHTML = '';
  links.forEach(([id,label])=>{
    const b = document.createElement('button');
    b.dataset.view = id;
    b.textContent = label;
    if(state.ui.currentView === id) b.classList.add('active');
    b.addEventListener('click', ()=>route(id));
    els.navTabs.appendChild(b);
  });
}

function statCards(){
  const pending = state.reports.filter(r=>r.status==='Pending').length;
  const approved = state.reports.filter(r=>r.status==='Approved').length;
  const rejected = state.reports.filter(r=>r.status==='Rejected').length;
  const critical = state.students.filter(s=>Number(s.currentDemerit||0) >= 50).length;
  const top = [...state.students].sort((a,b)=>Number(b.currentDemerit||0)-Number(a.currentDemerit||0))[0];

  return `
    <div class="grid-4">
      <div class="metric"><div class="kicker">Students</div><div class="value">${state.students.length}</div><div class="label">Loaded from JSON</div></div>
      <div class="metric"><div class="kicker">Pending</div><div class="value">${pending}</div><div class="label">Awaiting review</div></div>
      <div class="metric"><div class="kicker">Approved</div><div class="value">${approved}</div><div class="label">Official records</div></div>
      <div class="metric"><div class="kicker">Critical</div><div class="value">${critical}</div><div class="label">High demerit students</div></div>
    </div>
    <div class="grid-3">
      <div class="card">
        <div class="space-between"><div><div class="kicker">Top Demerit</div><h3 class="title">${top ? top.name : '-'}</h3></div><span class="badge ${top ? scoreLabel(top.currentDemerit).cls : ''}">${top ? top.currentDemerit : 0}</span></div>
        <div class="help">${top ? top.className : ''}</div>
      </div>
      <div class="card">
        <div class="kicker">Repeat Offences</div>
        <h3 class="title">${repeatOffenceCount()}</h3>
        <div class="help">Students with 2+ approved reports</div>
      </div>
      <div class="card">
        <div class="kicker">Today</div>
        <h3 class="title">${todayReports().length} reports</h3>
        <div class="help">Created in this demo</div>
      </div>
    </div>`;
}

function todayReports(){
  const today = new Date().toISOString().slice(0,10);
  return state.reports.filter(r => String(r.createdAt||'').slice(0,10) === today);
}
function repeatOffenceCount(){
  const counts = new Map();
  state.reports.filter(r=>r.status==='Approved').forEach(r=>{
    counts.set(r.studentId, (counts.get(r.studentId)||0)+1);
  });
  return [...counts.values()].filter(v=>v>=2).length;
}

function renderOverview(){
  const topStudents = [...state.students]
    .sort((a,b)=>(b.currentDemerit||0)-(a.currentDemerit||0))
    .slice(0,5);

  const offenceCounts = new Map();
  state.reports.forEach(r => {
    if(r.status !== 'Approved') return;
    const off = state.offences.find(o=>o.id===r.offenceId);
    const key = off ? off.title : 'Unknown';
    offenceCounts.set(key, (offenceCounts.get(key)||0)+1);
  });
  const offenceRows = [...offenceCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxOff = Math.max(1, ...offenceRows.map(x=>x[1]));

  const classMap = new Map();
  state.students.forEach(s=>{
    classMap.set(s.className, (classMap.get(s.className)||0)+1);
  });
  const classes = [...classMap.entries()].slice(0,6);

  byId('viewOverview').innerHTML = `
    ${statCards()}
    <div class="grid-2">
      <div class="card">
        <div class="section-head">
          <div>
            <h3>Top Demerit Ranking</h3>
            <p>Students with the highest current demerit.</p>
          </div>
          <button class="btn btn-sm btn-ghost" id="goStudentsBtn">Open Students</button>
        </div>
        <div class="list" style="margin-top:14px">
          ${topStudents.map((s,i)=>`
            <div class="list-item">
              <div class="item-top">
                <div>
                  <div class="item-title">#${i+1} ${s.name}</div>
                  <div class="muted small">${s.noMaktab} • ${s.className}</div>
                </div>
                <div class="chips">
                  <span class="badge ${scoreLabel(s.currentDemerit).cls}">${s.currentDemerit} pts</span>
                  <span class="chip">${scoreLabel(s.currentDemerit).text}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="card">
        <div class="section-head">
          <div>
            <h3>Most Common Violations</h3>
            <p>Based on approved reports.</p>
          </div>
        </div>
        <div class="bar-chart" style="margin-top:14px">
          ${offenceRows.length ? offenceRows.map(([name,val])=>`
            <div class="bar-row">
              <strong>${name}</strong>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8,(val/maxOff)*100)}%"></div></div>
              <span>${val}</span>
            </div>
          `).join('') : '<div class="muted">No approved reports yet.</div>'}
        </div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>Reports by Class</h3>
        <div class="stack" style="margin-top:14px">
          ${classes.map(([name,val])=>`
            <div class="space-between">
              <div>${name}</div>
              <strong>${val}</strong>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="card">
        <h3>Quick Status</h3>
        <div class="row" style="margin-top:12px">
          <div class="ring"><div>${state.reports.filter(r=>r.status==='Approved').length}</div></div>
          <div class="stack">
            <div><span class="badge good">Approved</span> ${state.reports.filter(r=>r.status==='Approved').length}</div>
            <div><span class="badge warn">Pending</span> ${state.reports.filter(r=>r.status==='Pending').length}</div>
            <div><span class="badge bad">Rejected</span> ${state.reports.filter(r=>r.status==='Rejected').length}</div>
          </div>
        </div>
      </div>
    </div>
  `;
  const btn = byId('goStudentsBtn');
  if(btn) btn.onclick = ()=>route('students');
}

function studentMatches(s, q){
  q = q.toLowerCase().trim();
  if(!q) return true;
  return [s.name, s.noMaktab, s.className, s.id].join(' ').toLowerCase().includes(q);
}
function filteredStudents(){
  const q = state.ui.search || '';
  return state.students.filter(s=>studentMatches(s, q));
}

function renderStudents(){
  const list = filteredStudents()
    .sort((a,b)=>(b.currentDemerit||0)-(a.currentDemerit||0));

  byId('viewStudents').innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="section-head">
          <div>
            <h3>Search Student</h3>
            <p>Select a student to view their individual overview & demerit records.</p>
          </div>
          <span class="chip">${list.length} results</span>
        </div>
        <div class="searchbar" style="margin-top:14px">
          <input id="studentSearchInput" placeholder="Type name / No. Maktab..." value="${escapeHtml(state.ui.search)}" />
          <button class="btn btn-primary" id="clearSearchBtn">Clear</button>
        </div>
        <div class="search-results" id="studentResults" style="margin-top:14px"></div>
      </div>
      <div class="card">
        <div class="section-head">
          <div>
            <h3>Individual Student Overview</h3>
            <p>Comprehensive report breakdown for selected student.</p>
          </div>
          ${state.selectedStudentId ? '<button class="btn btn-sm btn-ghost" id="openProfileBtn">Full Modal</button>' : ''}
        </div>
        <div id="studentPreview" style="margin-top:14px"></div>
      </div>
    </div>
  `;

  const selectStudent = (id) => {
    state.selectedStudentId = id;
    const student = state.students.find(s=>s.id===id);
    const preview = byId('studentPreview');
    if(preview && student){
      preview.innerHTML = studentPreview(student);
    }
    qsa('.search-card', byId('studentResults')).forEach(card=>{
      card.classList.toggle('selected', card.dataset.id === id);
    });
  };

  const updateResultsOnly = () => {
    const list = filteredStudents().sort((a,b)=>(b.currentDemerit||0)-(a.currentDemerit||0));
    const results = byId('studentResults');
    if(!results) return;
    results.innerHTML = list.length ? list.map(s=>studentSearchCard(s)).join('') : `<div class="muted">No students found.</div>`;
    qsa('.search-card', results).forEach(card=>{
      card.addEventListener('click', ()=>selectStudent(card.dataset.id));
    });
  };

  const searchInput = byId('studentSearchInput');
  if(searchInput){
    searchInput.oninput = e => {
      state.ui.search = e.target.value;
      updateResultsOnly();
    };
  }
  if(byId('clearSearchBtn')){
    byId('clearSearchBtn').onclick = ()=>{ 
      state.ui.search = ''; 
      if(searchInput) searchInput.value = '';
      updateResultsOnly(); 
    };
  }
  if(byId('openProfileBtn')) byId('openProfileBtn').onclick = ()=>openStudentProfile(state.selectedStudentId);

  const student = state.students.find(s=>s.id===state.selectedStudentId) || filteredStudents()[0] || null;
  if(student){
    state.selectedStudentId = student.id;
    byId('studentPreview').innerHTML = studentPreview(student);
  }else{
    byId('studentPreview').innerHTML = `<div class="muted">Select a student to see profile.</div>`;
  }
  updateResultsOnly();
}

function studentSearchCard(s){
  const score = scoreLabel(s.currentDemerit);
  return `
    <div class="search-card ${state.selectedStudentId===s.id ? 'selected':''}" data-id="${s.id}">
      <div class="space-between">
        <div>
          <div class="item-title">${escapeHtml(s.name)}</div>
          <div class="muted small">${escapeHtml(s.noMaktab)} • ${escapeHtml(s.className)}</div>
        </div>
        <span class="badge ${score.cls}">${s.currentDemerit || 0} pts</span>
      </div>
      <div class="help">${s.gender || ''} • ${s.status || ''}</div>
    </div>
  `;
}
function studentPreview(s){
  const history = state.reports.filter(r=>r.studentId===s.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const approved = history.filter(r=>r.status==='Approved');
  const pending = history.filter(r=>r.status==='Pending');
  const rejected = history.filter(r=>r.status==='Rejected');
  const score = scoreLabel(s.currentDemerit||0);

  return `
    <div class="detail-card">
      <div class="space-between">
        <div class="row">
          <div class="portrait">${initials(s.name)}</div>
          <div>
            <div class="item-title">${escapeHtml(s.name)}</div>
            <div class="muted small">${escapeHtml(s.noMaktab)} • ${escapeHtml(s.className)}</div>
          </div>
        </div>
        <span class="badge ${score.cls}">${s.currentDemerit || 0} points</span>
      </div>
      <div class="hr"></div>
      <div class="grid-3">
        <div class="metric"><div class="kicker">Approved</div><div class="value">${approved.length}</div><div class="label">Confirmed offences</div></div>
        <div class="metric"><div class="kicker">Pending</div><div class="value">${pending.length}</div><div class="label">Under review</div></div>
        <div class="metric"><div class="kicker">Rejected</div><div class="value">${rejected.length}</div><div class="label">Dismissed</div></div>
      </div>
      <div class="hr"></div>
      <div class="grid-3">
        <div><div class="kicker">Status</div><strong>${escapeHtml(s.status || '-')}</strong></div>
        <div><div class="kicker">Gender</div><strong>${escapeHtml(s.gender || '-')}</strong></div>
        <div><div class="kicker">Risk Category</div><strong>${score.text}</strong></div>
      </div>
      <div class="hr"></div>
      <div class="space-between">
        <div>
          <div class="kicker">Offence Breakdown & History</div>
          <p class="help">Detailed record of reports submitted for ${escapeHtml(s.name.split(' ')[0])}.</p>
        </div>
      </div>
      <div class="list" style="margin-top:12px; max-height: 400px; overflow-y: auto;">
        ${history.length ? history.map(r=>{
          const off = state.offences.find(o=>o.id===r.offenceId);
          return `
            <div class="list-item">
              <div class="item-top">
                <div>
                  <div class="item-title">${escapeHtml(off?.title || 'Unknown offence')}</div>
                  <div class="muted small">${formatDate(r.createdAt)} • ${escapeHtml(r.reporterRole)} (${escapeHtml(r.reportedBy)})</div>
                </div>
                <span class="badge ${r.status==='Approved'?'good':r.status==='Pending'?'warn':'bad'}">${r.status} (${r.points} pts)</span>
              </div>
              <div class="help" style="margin-top:4px;">${escapeHtml(r.remarks || 'No remarks provided.')}</div>
            </div>
          `;
        }).join('') : '<div class="muted">No offences recorded for this student.</div>'}
      </div>
    </div>
  `;
}

function openStudentProfile(id){
  state.selectedStudentId = id;
  route('students');
  renderStudents();
  openModal(studentProfileModal(id));
}

function reportForm(role){
  const offences = roleOffenceList(role);
  const isHidden = state.ui.hideReportForm || false;
  return `
    <div class="card">
      <div class="section-head">
        <div>
          <h3>Create Report</h3>
          <p>${role === 'Admin' ? 'Admin can create any report.' : `Create ${role} discipline reports.`}</p>
        </div>
        <div class="row">
          <span class="chip">${role}</span>
          <button class="btn btn-sm btn-ghost" id="toggleReportFormBtn">${isHidden ? '▼ Show Form' : '▲ Hide Form'}</button>
        </div>
      </div>
      <div class="form-grid ${isHidden ? 'hidden' : ''}" style="margin-top:14px">
        <div class="full">
          <label>Search Student<input id="reportStudentSearch" placeholder="Name / No. Maktab"></label>
          <div id="reportSearchResults" class="search-results"></div>
        </div>
        <div>
          <label>Offence<select id="reportOffenceSelect">${offences.map(o=>`<option value="${o.id}">${escapeHtml(o.title)} (${o.points} pts)</option>`).join('')}</select></label>
          <div class="help">Only active offences for this role are shown.</div>
        </div>
        <div>
          <label>Current Student<input id="reportSelectedStudent" disabled placeholder="Select a student first"></label>
        </div>
        <div class="full">
          <label>Remarks<textarea id="reportRemarks" placeholder="Write time, place, witness, notes..."></textarea></label>
        </div>
        <div class="full row">
          <button class="btn btn-primary" id="submitReportBtn">Submit Report</button>
          <span class="help">Saved as Pending first.</span>
        </div>
      </div>
    </div>
  `;
}

function reportRow(r){
  const student = state.students.find(s=>s.id===r.studentId);
  const offence = state.offences.find(o=>o.id===r.offenceId);
  const status = statusClass(r.status);
  return `
    <tr>
      <td>${escapeHtml(student?.name || '-') }<div class="help">${escapeHtml(student?.noMaktab || '')}</div></td>
      <td>${escapeHtml(offence?.title || '-')}<div class="help">${r.points || 0} pts</div></td>
      <td>${escapeHtml(r.reporterRole || '-')}<div class="help">${escapeHtml(r.reportedBy || '')}</div></td>
      <td><span class="status ${status}">${escapeHtml(r.status || '-')}</span></td>
      <td>${formatDate(r.createdAt)}</td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-ghost" data-action="view-report" data-id="${r.id}">View</button>
          ${state.session?.role === 'Admin' && r.status === 'Pending' ? `<button class="btn btn-sm btn-primary" data-action="approve" data-id="${r.id}">Approve</button><button class="btn btn-sm btn-danger" data-action="reject" data-id="${r.id}">Reject</button>` : ''}
          ${state.session?.role === 'Admin' ? `<button class="btn btn-sm btn-ghost" data-action="edit" data-id="${r.id}">Edit</button>` : ''}
        </div>
      </td>
    </tr>
  `;
}

function approveAllPending(){
  const pendingReports = state.reports.filter(r => r.status === 'Pending');
  if(pendingReports.length === 0){
    alert('No pending reports to approve.');
    return;
  }
  if(!confirm(`Approve all ${pendingReports.length} pending report(s)?`)) return;
  pendingReports.forEach(r => {
    r.status = 'Approved';
    r.updatedAt = nowISO();
  });
  ensureScoreSync();
  saveState();
  pushAudit(`Approved all ${pendingReports.length} pending reports`);
  renderReports();
  alert(`Successfully approved ${pendingReports.length} pending report(s)!`);
}

function renderReports(){
  const role = state.session?.role;
  const canSeeAll = roleCanSeeAll(role);
  const canManage = role === 'Admin';
  const mine = state.reports.filter(r => r.reportedBy === state.session?.username);
  const pending = state.reports.filter(r => r.status === 'Pending');
  const shown = canSeeAll ? state.reports : mine;

  byId('viewReports').innerHTML = `
    <div class="grid-2">
      <div class="card">${reportForm(role)}</div>
      <div class="stack">
        <div class="card">
          <div class="section-head">
            <div>
              <h3>Report Summary</h3>
              <p>Pending / approved / rejected counts.</p>
            </div>
            ${canManage && pending.length > 0 ? `<button class="btn btn-sm btn-primary" id="approveAllBtn">Approve All (${pending.length})</button>` : ''}
          </div>
          <div class="grid-3" style="margin-top:12px">
            <div class="metric"><div class="kicker">Pending</div><div class="value">${pending.length}</div><div class="label">Needs review</div></div>
            <div class="metric"><div class="kicker">Mine</div><div class="value">${mine.length}</div><div class="label">My submissions</div></div>
            <div class="metric"><div class="kicker">All</div><div class="value">${state.reports.length}</div><div class="label">Total records</div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-head">
        <div>
          <h3>${canSeeAll ? 'All Reports' : 'My Reports'}</h3>
          <p>${canManage ? 'Admin can manage every report.' : 'Only your own reports are visible here.'}</p>
        </div>
        <div class="row">
          <button class="btn btn-sm btn-ghost ${state.ui.reportFilter==='all' ? 'active':''}" data-filter="all">All</button>
          <button class="btn btn-sm btn-ghost ${state.ui.reportFilter==='pending' ? 'active':''}" data-filter="pending">Pending</button>
          <button class="btn btn-sm btn-ghost ${state.ui.reportFilter==='approved' ? 'active':''}" data-filter="approved">Approved</button>
          <button class="btn btn-sm btn-ghost ${state.ui.reportFilter==='rejected' ? 'active':''}" data-filter="rejected">Rejected</button>
        </div>
      </div>
      <div class="table-wrap" style="margin-top:14px">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Offence</th>
              <th>Reporter</th>
              <th>Status</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="reportTableBody"></tbody>
        </table>
      </div>
    </div>
  `;

  byId('toggleReportFormBtn')?.addEventListener('click', ()=>{
    state.ui.hideReportForm = !state.ui.hideReportForm;
    renderReports();
  });

  byId('approveAllBtn')?.addEventListener('click', approveAllPending);

  if(!state.ui.hideReportForm){
    wireReportForm();
  }
  const body = byId('reportTableBody');
  let items = shown.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if(state.ui.reportFilter !== 'all') items = items.filter(r => r.status.toLowerCase() === state.ui.reportFilter);
  body.innerHTML = items.length ? items.map(reportRow).join('') : `<tr><td colspan="6" class="muted">No reports found.</td></tr>`;

  qsa('[data-filter]').forEach(btn=>btn.classList.toggle('active', btn.dataset.filter===state.ui.reportFilter));
  qsa('[data-filter]').forEach(btn=>btn.onclick = ()=>{ state.ui.reportFilter = btn.dataset.filter; renderReports(); });

  body.onclick = (e)=>{
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if(action === 'view-report') openReportModal(id);
    if(action === 'approve') changeReportStatus(id, 'Approved');
    if(action === 'reject') changeReportStatus(id, 'Rejected');
    if(action === 'edit' && role==='Admin') openEditReportModal(id);
  };
}

function wireReportForm(){
  const searchInput = byId('reportStudentSearch');
  const resultsBox = byId('reportSearchResults');
  const selectedBox = byId('reportSelectedStudent');
  let filtered = state.students.slice().sort((a,b)=>b.currentDemerit-a.currentDemerit);

  function renderResults(q=''){
    q = q.toLowerCase().trim();
    const list = state.students.filter(s=>studentMatches(s, q)).slice(0,8);
    resultsBox.innerHTML = list.map(s=>`
      <div class="search-card ${state.selectedStudentId===s.id ? 'selected':''}" data-id="${s.id}">
        <div class="space-between">
          <div>
            <div class="item-title">${escapeHtml(s.name)}</div>
            <div class="muted small">${escapeHtml(s.noMaktab)} • ${escapeHtml(s.className)}</div>
          </div>
          <span class="badge">${s.currentDemerit || 0} pts</span>
        </div>
      </div>
    `).join('') || '<div class="muted">No student found.</div>';
    qsa('.search-card', resultsBox).forEach(card=>{
      card.addEventListener('click', ()=>{
        state.selectedStudentId = card.dataset.id;
        renderResults(searchInput.value);
        const s = state.students.find(x=>x.id===state.selectedStudentId);
        selectedBox.value = s ? `${s.name} • ${s.noMaktab}` : '';
      });
    });
    const s = state.students.find(x=>x.id===state.selectedStudentId);
    selectedBox.value = s ? `${s.name} • ${s.noMaktab}` : '';
  }
  renderResults(state.ui.search || '');
  searchInput.oninput = e => renderResults(e.target.value);
  byId('submitReportBtn').onclick = ()=>{
    const studentId = state.selectedStudentId;
    if(!studentId){ alert('Select a student first.'); return; }
    const offenceId = byId('reportOffenceSelect').value;
    const off = state.offences.find(o=>o.id===offenceId);
    const report = {
      id: uuid('r'),
      studentId,
      offenceId,
      points: Number(off?.points || 0),
      reportedBy: state.session.username,
      reporterRole: state.session.role,
      remarks: byId('reportRemarks').value.trim(),
      status: 'Pending',
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    state.reports.unshift(report);
    state.selectedStudentId = studentId;
    byId('reportRemarks').value = '';
    ensureScoreSync();
    saveState();
    pushAudit(`Created report ${report.id} for ${studentId}`);
    render();
    alert('Report submitted as Pending.');
  };
}

function renderOffences(){
  const role = state.session?.role;
  const categories = ['LDP','JPA'];
  byId('viewOffences').innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="section-head">
          <div>
            <h3>Offence Management</h3>
            <p>Create and update offence names and demerit values.</p>
          </div>
        </div>
        <div class="form-grid" style="margin-top:14px">
          <div>
            <label>Category
              <select id="offCategory">${categories.map(c=>`<option ${state.ui.activeCategory===c?'selected':''} value="${c}">${c}</option>`).join('')}</select>
            </label>
          </div>
          <div>
            <label>Offence Name<input id="offName" placeholder="Example: Pakaian Tidak Lengkap"></label>
          </div>
          <div>
            <label>Points<input id="offPoints" type="number" min="0" step="1" value="5"></label>
          </div>
          <div>
            <label>Status<select id="offEnabled"><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
          </div>
          <div class="full row">
            <button class="btn btn-primary" id="addOffenceBtn">Add Offence</button>
            <span class="help">Admin only.</span>
          </div>
        </div>
      </div>
      <div class="card">
        <h3>Offence Library</h3>
        <div class="help">Used in report forms for JPA and LDP.</div>
        <div class="list" style="margin-top:14px" id="offenceList"></div>
      </div>
    </div>
  `;
  byId('offCategory').onchange = e => state.ui.activeCategory = e.target.value;
  byId('addOffenceBtn').onclick = ()=>{
    if(role !== 'Admin'){ alert('Admin only.'); return; }
    const title = byId('offName').value.trim();
    const category = byId('offCategory').value;
    const points = Number(byId('offPoints').value || 0);
    const enabled = byId('offEnabled').value === 'true';
    if(!title){ alert('Enter offence name.'); return; }
    state.offences.unshift({id: uuid('o'), title, category, points, enabled});
    saveState();
    pushAudit(`Added offence "${title}"`);
    renderOffences();
  };

  const box = byId('offenceList');
  box.innerHTML = state.offences
    .filter(o => role==='Admin' ? true : o.category===role)
    .map(o=>`
      <div class="list-item">
        <div class="item-top">
          <div>
            <div class="item-title">${escapeHtml(o.title)}</div>
            <div class="muted small">${o.category} • ${o.points} points</div>
          </div>
          <div class="chips">
            <span class="badge ${o.enabled===false ? 'warn':'good'}">${o.enabled===false ? 'Disabled' : 'Enabled'}</span>
          </div>
        </div>
        ${role === 'Admin' ? `
        <div class="actions" style="margin-top:12px">
          <button class="btn btn-sm btn-ghost" data-action="toggle-off" data-id="${o.id}">${o.enabled===false ? 'Enable' : 'Disable'}</button>
          <button class="btn btn-sm btn-danger" data-action="del-off" data-id="${o.id}">Delete</button>
        </div>` : ''}
      </div>
    `).join('');

  box.onclick = e => {
    const btn = e.target.closest('button[data-action]');
    if(!btn || state.session?.role !== 'Admin') return;
    const offId = btn.dataset.id;
    const off = state.offences.find(x=>x.id===offId);
    if(!off) return;

    if(btn.dataset.action === 'toggle-off'){
      off.enabled = !off.enabled;
      saveState(); 
      pushAudit(`Toggled offence ${off.title}`); 
      renderOffences();
    }

    if(btn.dataset.action === 'del-off'){
      if(confirm(`Are you sure you want to delete offence "${off.title}"?`)){
        state.offences = state.offences.filter(x => x.id !== offId);
        saveState(); 
        pushAudit(`Deleted offence ${off.title}`); 
        renderOffences();
      }
    }
  };
}

function renderUsers(){
  const role = state.session?.role;
  const users = state.users;
  byId('viewUsers').innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h3>User Management</h3>
        <div class="help">Create accounts and assign roles.</div>
        <div class="form-grid" style="margin-top:14px">
          <div><label>Full Name<input id="newUserName" placeholder="New user name"></label></div>
          <div><label>Username<input id="newUserUsername" placeholder="username"></label></div>
          <div><label>Password<input id="newUserPassword" placeholder="password" type="text"></label></div>
          <div><label>Role<select id="newUserRole"><option>JPA</option><option>LDP</option><option>Admin</option></select></label></div>
          <div class="full row">
            <button class="btn btn-primary" id="addUserBtn">Add User</button>
            <span class="help">Admin only.</span>
          </div>
        </div>
      </div>
      <div class="card">
        <h3>Accounts</h3>
        <div id="userList" class="list" style="margin-top:14px"></div>
      </div>
    </div>
  `;
  const list = byId('userList');
  list.innerHTML = users.map(u=>`
    <div class="list-item">
      <div class="item-top">
        <div>
          <div class="item-title">${escapeHtml(u.name || u.username)}</div>
          <div class="muted small">@${escapeHtml(u.username)}</div>
        </div>
        <span class="badge">${u.role}</span>
      </div>
    </div>
  `).join('');

  byId('addUserBtn').onclick = ()=>{
    if(role !== 'Admin'){ alert('Admin only.'); return; }
    const name = byId('newUserName').value.trim();
    const username = byId('newUserUsername').value.trim();
    const password = byId('newUserPassword').value.trim();
    const newRole = byId('newUserRole').value;
    if(!name || !username || !password){ alert('Fill all fields.'); return; }
    if(state.users.some(u=>u.username===username)){ alert('Username already exists.'); return; }
    state.users.unshift({id: uuid('u'), name, username, password, role:newRole});
    saveState(); pushAudit(`Added user ${username}`); renderUsers();
  };
}

function renderAudit(){
  byId('viewAudit').innerHTML = `
    <div class="card">
      <div class="section-head">
        <div>
          <h3>Audit Trail</h3>
          <p>Important activity log for transparency.</p>
        </div>
      </div>
      <div class="list" style="margin-top:14px">
        ${state.audit.length ? state.audit.map(a=>`
          <div class="list-item">
            <div class="item-top">
              <div>
                <div class="item-title">${escapeHtml(a.action)}</div>
                <div class="muted small">${escapeHtml(a.user)} • ${formatDate(a.time)}</div>
              </div>
            </div>
          </div>
        `).join('') : '<div class="muted">Audit log empty.</div>'}
      </div>
    </div>
  `;
}

function renderSettings(){
  const dbSize = new Blob([JSON.stringify({students:state.students,offences:state.offences,reports:state.reports}, null, 2)]).size;
  byId('viewSettings').innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h3>System Tools</h3>
        <div class="stack" style="margin-top:14px">
          <button class="btn btn-ghost" id="seedDemoDataBtn">Load Default Clean Data</button>
          <button class="btn btn-danger" id="resetLocalDataBtn">Reset Local Storage</button>
          <button class="btn btn-ghost" id="recalcBtn">Recalculate Student Points</button>
          <button class="btn btn-ghost" id="clearSearchStateBtn">Clear Search / Selection</button>
        </div>
      </div>
      <div class="card">
        <h3>Data Snapshot</h3>
        <div class="stack" style="margin-top:14px">
          <div><span class="tag">Students</span> ${state.students.length}</div>
          <div><span class="tag">Offences</span> ${state.offences.length}</div>
          <div><span class="tag">Reports</span> ${state.reports.length}</div>
          <div><span class="tag">Audit</span> ${state.audit.length}</div>
          <div class="help">Approx. local dataset size: ${Math.round(dbSize/1024)} KB</div>
        </div>
      </div>
    </div>
  `;
  byId('seedDemoDataBtn').onclick = ()=>seedDemo();
  byId('resetLocalDataBtn').onclick = ()=>resetLocal();
  byId('recalcBtn').onclick = ()=>{
    ensureScoreSync();
    saveState();
    pushAudit('Recalculated student points');
    render();
    alert('Student points recalculated.');
  };
  byId('clearSearchStateBtn').onclick = ()=>{
    state.ui.search = '';
    state.selectedStudentId = null;
    saveState();
    render();
  };
}

function renderPersonal(){
  const username = state.session?.username;
  const user = getUser();
  const myReports = state.reports.filter(r => r.reportedBy === username);
  const pendingCount = myReports.filter(r => r.status === 'Pending').length;
  const approvedCount = myReports.filter(r => r.status === 'Approved').length;
  const rejectedCount = myReports.filter(r => r.status === 'Rejected').length;

  byId('viewPersonal').innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="section-head">
          <div>
            <h3>Officer Profile</h3>
            <p>Your account information & role.</p>
          </div>
          <span class="chip">${escapeHtml(state.session?.role || '')}</span>
        </div>
        <div class="user-chip" style="margin-top:16px; padding:16px;">
          <div class="avatar" style="width:48px; height:48px; font-size:1.2rem;">${initials(user?.name || username)}</div>
          <div>
            <strong style="font-size:1.1rem">${escapeHtml(user?.name || username)}</strong>
            <p style="margin-top:4px; font-size:0.9rem">Username: @${escapeHtml(username)}</p>
            <p style="margin-top:2px; font-size:0.85rem; color:var(--muted)">Role: ${escapeHtml(state.session?.role)} Officer</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-head">
          <div>
            <h3>My Submission Statistics</h3>
            <p>Summary of offences reported by you.</p>
          </div>
        </div>
        <div class="grid-3" style="margin-top:16px">
          <div class="metric"><div class="kicker">Total Sent</div><div class="value">${myReports.length}</div><div class="label">Reports submitted</div></div>
          <div class="metric"><div class="kicker">Approved</div><div class="value">${approvedCount}</div><div class="label">Official records</div></div>
          <div class="metric"><div class="kicker">Pending</div><div class="value">${pendingCount}</div><div class="label">Under review</div></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-head">
        <div>
          <h3>My Submitted Reports</h3>
          <p>History of all reports sent by your account.</p>
        </div>
        <span class="chip">${myReports.length} Total</span>
      </div>
      <div class="table-wrap" style="margin-top:14px">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Offence</th>
              <th>Status</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${myReports.length ? myReports.map(r => {
              const student = state.students.find(s=>s.id===r.studentId);
              const offence = state.offences.find(o=>o.id===r.offenceId);
              return `
                <tr>
                  <td>${escapeHtml(student?.name || '-')}<div class="help">${escapeHtml(student?.noMaktab || '')}</div></td>
                  <td>${escapeHtml(offence?.title || '-')}<div class="help">${r.points || 0} pts</div></td>
                  <td><span class="status ${statusClass(r.status)}">${escapeHtml(r.status || '-')}</span></td>
                  <td>${formatDate(r.createdAt)}</td>
                  <td><button class="btn btn-sm btn-ghost" onclick="openReportModal('${r.id}')">View Details</button></td>
                </tr>
              `;
            }).join('') : '<tr><td colspan="5" class="muted">You have not submitted any reports yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function render(){
  ensureScoreSync();
  saveState();
  const role = state.session?.role;
  qsa('.nav button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === state.ui.currentView));
  if(state.ui.currentView === 'overview') renderOverview();
  if(state.ui.currentView === 'students') renderStudents();
  if(state.ui.currentView === 'reports') renderReports();
  if(state.ui.currentView === 'personal') renderPersonal();
  if(state.ui.currentView === 'offences') renderOffences();
  if(state.ui.currentView === 'users') renderUsers();
  if(state.ui.currentView === 'audit') renderAudit();
  if(state.ui.currentView === 'settings') renderSettings();

  // Role-based tab access
  const allowed = {
    JPA: ['reports','personal'],
    LDP: ['reports','personal'],
    Admin: ['overview','students','reports','offences','users','audit','settings']
  };
  qsa('.nav button').forEach(btn=>{
    btn.style.display = allowed[role]?.includes(btn.dataset.view) ? '' : 'none';
  });
}

function changeReportStatus(id, status){
  const r = state.reports.find(x=>x.id===id);
  if(!r) return;
  r.status = status;
  r.updatedAt = nowISO();
  ensureScoreSync();
  saveState();
  pushAudit(`${status} report ${id}`);
  render();
}

function openReportModal(id){
  const r = state.reports.find(x=>x.id===id);
  if(!r) return;
  const student = state.students.find(s=>s.id===r.studentId);
  const off = state.offences.find(o=>o.id===r.offenceId);
  openModal(`
    <div class="modal">
      <div class="modal-head">
        <div>
          <div class="kicker">Report Detail</div>
          <h3 class="title">${escapeHtml(r.id)}</h3>
          <p class="help">Recorded on ${formatDate(r.createdAt)}</p>
        </div>
        <button class="btn btn-ghost close-x" data-close>✕</button>
      </div>
      <div class="modal-grid" style="margin-top:16px">
        <div class="detail-card">
          <div class="space-between">
            <div class="row">
              <div class="portrait">${initials(student?.name || 'S')}</div>
              <div>
                <div class="item-title">${escapeHtml(student?.name || '-')}</div>
                <div class="muted small">${escapeHtml(student?.noMaktab || '')} • ${escapeHtml(student?.className || '')}</div>
              </div>
            </div>
            <span class="status ${statusClass(r.status)}">${escapeHtml(r.status || '')}</span>
          </div>
          <div class="hr"></div>
          <div class="grid-3">
            <div><div class="kicker">Offence</div><strong>${escapeHtml(off?.title || '-')}</strong></div>
            <div><div class="kicker">Points</div><strong>${r.points || 0}</strong></div>
            <div><div class="kicker">Reporter</div><strong>${escapeHtml(r.reporterRole || '-')}</strong></div>
          </div>
          <div class="hr"></div>
          <div><div class="kicker">Remarks</div><p>${escapeHtml(r.remarks || '-')}</p></div>
        </div>
        <div class="detail-card">
          <div class="kicker">Actions</div>
          <div class="stack" style="margin-top:14px">
            ${state.session?.role === 'Admin' ? `<button class="btn btn-primary" data-action-modal="approve" data-id="${r.id}">Approve</button><button class="btn btn-danger" data-action-modal="reject" data-id="${r.id}">Reject</button><button class="btn btn-ghost" data-action-modal="edit" data-id="${r.id}">Edit Report</button>` : '<div class="help">Admin controls appear here.</div>'}
            <button class="btn btn-ghost" data-action-modal="view-student" data-id="${student?.id || ''}">Open Student Profile</button>
          </div>
          <div class="hr"></div>
          <div class="help">Audit trail is automatically updated when changes are made.</div>
        </div>
      </div>
    </div>
  `, {
    approve: ()=>{ closeModal(); changeReportStatus(id,'Approved'); },
    reject: ()=>{ closeModal(); changeReportStatus(id,'Rejected'); },
    edit: ()=>{ closeModal(); openEditReportModal(id); },
    'view-student': ()=>{ closeModal(); if(student) openStudentProfile(student.id); }
  });
}

function openEditReportModal(id){
  const r = state.reports.find(x=>x.id===id);
  if(!r) return;
  const student = state.students.find(s=>s.id===r.studentId);
  openModal(`
    <div class="modal">
      <div class="modal-head">
        <div>
          <div class="kicker">Edit Report</div>
          <h3 class="title">${escapeHtml(r.id)}</h3>
        </div>
        <button class="btn btn-ghost close-x" data-close>✕</button>
      </div>
      <div class="form-grid" style="margin-top:16px">
        <div class="full">
          <label>Student<input value="${escapeHtml(student?.name || '')}" disabled></label>
        </div>
        <div>
          <label>Points<input id="editPoints" type="number" value="${r.points || 0}"></label>
        </div>
        <div>
          <label>Status<select id="editStatus">
            <option ${r.status==='Pending'?'selected':''}>Pending</option>
            <option ${r.status==='Approved'?'selected':''}>Approved</option>
            <option ${r.status==='Rejected'?'selected':''}>Rejected</option>
          </select></label>
        </div>
        <div class="full">
          <label>Remarks<textarea id="editRemarks">${escapeHtml(r.remarks || '')}</textarea></label>
        </div>
        <div class="full row">
          <button class="btn btn-primary" id="saveEditBtn">Save Changes</button>
        </div>
      </div>
    </div>
  `, {
    save: ()=>{}
  });
  byId('saveEditBtn').onclick = ()=>{
    r.points = Number(byId('editPoints').value || 0);
    r.status = byId('editStatus').value;
    r.remarks = byId('editRemarks').value.trim();
    r.updatedAt = nowISO();
    ensureScoreSync();
    saveState();
    pushAudit(`Edited report ${r.id}`);
    closeModal();
    render();
  };
}

function openModal(content, handlers={}){
  const host = byId('modalHost');
  host.classList.remove('hidden');
  host.innerHTML = content;
  host.onclick = (e)=>{
    if(e.target === host || e.target.hasAttribute('data-close')){
      closeModal();
      return;
    }
    const btn = e.target.closest('[data-action-modal]');
    if(btn){
      const fn = handlers[btn.dataset.actionModal];
      if(fn) fn();
    }
  };
}
function closeModal(){
  const host = byId('modalHost');
  host.classList.add('hidden');
  host.innerHTML = '';
}
function studentProfileModal(id){
  const s = state.students.find(x=>x.id===id);
  if(!s) return '';
  const history = state.reports.filter(r=>r.studentId===id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return `
    <div class="modal">
      <div class="modal-head">
        <div>
          <div class="kicker">Student Profile</div>
          <h3 class="title">${escapeHtml(s.name)}</h3>
          <p class="help">${escapeHtml(s.noMaktab)} • ${escapeHtml(s.className)}</p>
        </div>
        <button class="btn btn-ghost close-x" data-close>✕</button>
      </div>
      <div class="modal-grid" style="margin-top:16px">
        <div class="detail-card">
          <div class="space-between">
            <div class="row">
              <div class="portrait">${initials(s.name)}</div>
              <div>
                <div class="item-title">${escapeHtml(s.name)}</div>
                <div class="muted small">${escapeHtml(s.noMaktab)} • ${escapeHtml(s.className)}</div>
              </div>
            </div>
            <span class="badge ${scoreLabel(s.currentDemerit||0).cls}">${s.currentDemerit || 0} pts</span>
          </div>
          <div class="hr"></div>
          <div class="grid-3">
            <div><div class="kicker">Status</div><strong>${escapeHtml(s.status || '-')}</strong></div>
            <div><div class="kicker">Gender</div><strong>${escapeHtml(s.gender || '-')}</strong></div>
            <div><div class="kicker">Risk</div><strong>${scoreLabel(s.currentDemerit||0).text}</strong></div>
          </div>
        </div>
        <div class="detail-card">
          <div class="kicker">History</div>
          <div class="list" style="margin-top:12px; max-height:56vh; overflow:auto">
            ${history.length ? history.map(r=>{
              const o = state.offences.find(x=>x.id===r.offenceId);
              return `<div class="list-item">
                <div class="item-top">
                  <div>
                    <div class="item-title">${escapeHtml(o?.title || 'Unknown')}</div>
                    <div class="muted small">${formatDate(r.createdAt)} • ${escapeHtml(r.reporterRole)}</div>
                  </div>
                  <span class="badge ${r.status==='Approved'?'good':r.status==='Pending'?'warn':'bad'}">${r.points} pts</span>
                </div>
              </div>`;
            }).join('') : '<div class="muted">No history found.</div>'}
          </div>
        </div>
      </div>
    </div>
  `;
}
function escapeHtml(str=''){
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function exportJson(){
  const blob = new Blob([JSON.stringify({
    app: state.appMeta,
    users: state.users,
    students: state.students,
    offences: state.offences,
    reports: state.reports,
    audit: state.audit
  }, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'demerit-bentech-export.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

function seedDemo(){
  localStorage.removeItem(DATA_KEY);
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}

function resetLocal(){
  if(!confirm('Reset local prototype data?')) return;
  localStorage.removeItem(DATA_KEY);
  localStorage.removeItem(SESSION_KEY);
  alert('Local data cleared. Reloading.');
  location.reload();
}

function quickSearch(){
  route('students');
  byId('studentSearchInput')?.focus();
}

async function boot(){
  els.loginRole = byId('loginRole');
  els.loginUsername = byId('loginUsername');
  els.loginPassword = byId('loginPassword');
  els.navTabs = byId('navTabs');

  buildLoginRoles();

  const handleEnter = (e) => { if(e.key === 'Enter') loginHandler(); };
  els.loginUsername?.addEventListener('keydown', handleEnter);
  els.loginPassword?.addEventListener('keydown', handleEnter);

  // Sync username field based on selected role dropdown to make demo easy
  els.loginRole?.addEventListener('change', (e) => {
    const r = e.target.value;
    const defaultUser = state.users.find(u => u.role === r);
    if(defaultUser && !els.loginUsername.value){
      els.loginUsername.value = defaultUser.username;
      els.loginPassword.value = defaultUser.password || 'password';
    }
  });

  byId('loginBtn')?.addEventListener('click', loginHandler);
  byId('logoutBtn')?.addEventListener('click', logout);
  byId('exportBtn')?.addEventListener('click', exportJson);
  byId('quickSearchBtn')?.addEventListener('click', quickSearch);
  byId('seedBtn')?.addEventListener('click', seedDemo);
  byId('resetBtn')?.addEventListener('click', resetLocal);
  byId('modalHost')?.addEventListener('click', (e)=>{ if(e.target.id === 'modalHost') closeModal(); });

  const localFound = loadLocalState();
  if(!localFound) await seedFromData();
  loadSession();
  ensureScoreSync();
  saveState();

  if(state.appMeta?.name){
    byId('subtitleText').textContent = `${state.appMeta.subtitle || 'System'} • ${state.appMeta.version || ''}`;
  }

  // Only auto-open app if 'Remember me' was checked during login
  if(state.session && state.session.remember && state.users.find(u=>u.username===state.session.username)){
    showApp();
    route(state.session.role === 'Admin' ? 'overview' : 'reports');
  }else{
    state.session = null;
    saveSession();
    hideApp();
  }
}

document.addEventListener('DOMContentLoaded', boot);
