/**
 * Staff Tracker Enterprise Client Application
 * Connects directly to Node.js/Express Backend REST APIs
 * Enforces 3-Tier Hierarchy: Admin, Cluster Manager, and Staff
 */

const API_BASE = '/api/v1';

let authToken = localStorage.getItem('staff_tracker_token') || null;
let currentUser = JSON.parse(localStorage.getItem('staff_tracker_user') || 'null');
let currentEmployee = JSON.parse(localStorage.getItem('staff_tracker_emp') || 'null');
let currentCluster = JSON.parse(localStorage.getItem('staff_tracker_cluster') || 'null');

let activeTravelSession = null;
let currentWaypointIndex = 0;

// Coordinate waypoints for simulation if browser geolocation is unavailable
const sampleWaypoints = [
  { latitude: 28.6139, longitude: 77.2090, accuracy: 12, speed: 7.2 },
  { latitude: 28.6250, longitude: 77.2180, accuracy: 10, speed: 8.5 },
  { latitude: 28.6360, longitude: 77.2290, accuracy: 14, speed: 9.1 },
  { latitude: 28.6480, longitude: 77.2400, accuracy: 11, speed: 8.8 },
  { latitude: 28.6600, longitude: 77.2520, accuracy: 15, speed: 7.9 },
];

// Helper: Toast notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Helper: Quick fill test login
function quickFill(email, password) {
  document.getElementById('login-id').value = email;
  document.getElementById('login-password').value = password;
}

// Modal helpers
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

// HTTP request helper with Bearer token
async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401 && authToken) {
        logout();
      }
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();

  if (authToken && currentUser) {
    renderAppForRole();
  } else {
    showLoginView();
  }
});

function setupEventListeners() {
  // Login Form
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginId = document.getElementById('login-id').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await apiRequest('/auth/login', 'POST', { loginId, password });
      authToken = res.data.token;
      currentUser = res.data.user;
      currentEmployee = res.data.employee;
      currentCluster = res.data.cluster;

      localStorage.setItem('staff_tracker_token', authToken);
      localStorage.setItem('staff_tracker_user', JSON.stringify(currentUser));
      localStorage.setItem('staff_tracker_emp', JSON.stringify(currentEmployee));
      localStorage.setItem('staff_tracker_cluster', JSON.stringify(currentCluster));

      showToast(`Welcome back, ${currentUser.employeeId}!`, 'success');
      renderAppForRole();
    } catch (err) {
      console.error(err);
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    logout();
  });

  // Seed DB button
  document.getElementById('btn-seed-db').addEventListener('click', async () => {
    try {
      const res = await apiRequest('/auth/seed', 'POST');
      showToast('Database seeded! You can now use any of the quick-login accounts.', 'success');
    } catch (err) {
      console.error(err);
    }
  });

  // Create Cluster Form
  document.getElementById('form-create-cluster').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('cluster-name').value;
    const code = document.getElementById('cluster-code').value;
    const city = document.getElementById('cluster-city').value;
    const state = document.getElementById('cluster-state').value;
    const description = document.getElementById('cluster-desc').value;

    try {
      await apiRequest('/clusters', 'POST', { name, code, city, state, description });
      showToast(`Cluster "${name}" created successfully!`, 'success');
      closeModal('modal-create-cluster');
      loadAdminClusters();
    } catch (err) {
      console.error(err);
    }
  });

  // Create Employee Form
  document.getElementById('form-create-employee').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('emp-name').value;
    const email = document.getElementById('emp-email').value;
    const mobileNumber = document.getElementById('emp-mobile').value;
    const password = document.getElementById('emp-password').value;
    const role = document.getElementById('emp-role').value;
    const department = document.getElementById('emp-dept').value;
    const designation = document.getElementById('emp-desig').value;
    const baseSalary = parseFloat(document.getElementById('emp-salary').value) || 28000;
    const perKmRate = parseFloat(document.getElementById('emp-km-rate').value) || 6.5;

    let clusterId = document.getElementById('emp-cluster-select').value;
    if (currentUser.role === 'CLUSTER_MANAGER' && (!clusterId || clusterId === '')) {
      clusterId = currentUser.assignedClusterIds[0];
    }

    try {
      const res = await apiRequest('/employees', 'POST', {
        fullName,
        email,
        mobileNumber,
        password,
        role,
        department,
        designation,
        clusterId: clusterId || null,
        baseSalary,
        perKmRate,
      });

      showToast(`Employee ${fullName} created with ID ${res.data.employee.employeeId}!`, 'success');
      closeModal('modal-create-employee');
      if (currentUser.role === 'ADMIN') loadAdminEmployees();
      if (currentUser.role === 'CLUSTER_MANAGER') loadMgrEmployees();
    } catch (err) {
      console.error(err);
    }
  });

  // Assign Manager to Cluster Form
  document.getElementById('form-assign-manager').addEventListener('submit', async (e) => {
    e.preventDefault();
    const clusterId = document.getElementById('assign-cluster-id').value;
    const managerId = document.getElementById('assign-manager-select').value;

    try {
      await apiRequest(`/clusters/${clusterId}/managers`, 'POST', { managerIds: [managerId] });
      showToast('Manager assigned to cluster successfully!', 'success');
      closeModal('modal-assign-manager');
      loadAdminClusters();
    } catch (err) {
      console.error(err);
    }
  });

  // Transfer Employee Form
  document.getElementById('form-transfer-employee').addEventListener('submit', async (e) => {
    e.preventDefault();
    const employeeId = document.getElementById('transfer-emp-id').value;
    const targetClusterId = document.getElementById('transfer-target-cluster').value;

    try {
      const res = await apiRequest('/clusters/transfer-employee', 'POST', { employeeId, targetClusterId });
      showToast(res.message, 'success');
      closeModal('modal-transfer-employee');
      loadAdminEmployees();
      loadAdminClusters();
    } catch (err) {
      console.error(err);
    }
  });

  // Staff Expense Claim Form
  document.getElementById('form-staff-claim').addEventListener('submit', async (e) => {
    e.preventDefault();
    const claimDate = document.getElementById('claim-date').value;
    const claimedDistanceKm = parseFloat(document.getElementById('claim-distance').value);
    const claimedAmount = parseFloat(document.getElementById('claim-amount').value);
    const tollAndParkingAmount = parseFloat(document.getElementById('claim-toll').value) || 0;
    const remarks = document.getElementById('claim-remarks').value;

    try {
      await apiRequest('/salary/claims', 'POST', {
        claimDate,
        claimedDistanceKm,
        claimedAmount,
        tollAndParkingAmount,
        remarks,
      });
      showToast('Travel claim submitted successfully!', 'success');
      document.getElementById('form-staff-claim').reset();
    } catch (err) {
      console.error(err);
    }
  });
}

function logout() {
  authToken = null;
  currentUser = null;
  currentEmployee = null;
  currentCluster = null;
  localStorage.clear();
  showLoginView();
  showToast('You have been signed out.', 'info');
}

function showLoginView() {
  document.getElementById('view-login').style.display = 'block';
  document.getElementById('view-admin').style.display = 'none';
  document.getElementById('view-manager').style.display = 'none';
  document.getElementById('view-staff').style.display = 'none';
  document.getElementById('auth-header-container').style.display = 'none';
}

function renderAppForRole() {
  document.getElementById('view-login').style.display = 'none';
  document.getElementById('auth-header-container').style.display = 'flex';

  const nameElem = document.getElementById('user-display-name');
  const roleBadge = document.getElementById('user-role-badge');

  const displayName = currentEmployee ? currentEmployee.fullName : currentUser.email;
  nameElem.innerText = `${displayName} (${currentUser.employeeId})`;

  roleBadge.innerText = currentUser.role;
  roleBadge.className = 'role-pill ' + (
    currentUser.role === 'ADMIN' ? 'role-admin' :
    currentUser.role === 'CLUSTER_MANAGER' ? 'role-manager' : 'role-staff'
  );

  if (currentUser.role === 'ADMIN') {
    document.getElementById('view-admin').style.display = 'block';
    document.getElementById('view-manager').style.display = 'none';
    document.getElementById('view-staff').style.display = 'none';
    loadAdminDashboard();
  } else if (currentUser.role === 'CLUSTER_MANAGER') {
    document.getElementById('view-admin').style.display = 'none';
    document.getElementById('view-manager').style.display = 'block';
    document.getElementById('view-staff').style.display = 'none';
    loadManagerDashboard();
  } else if (currentUser.role === 'STAFF') {
    document.getElementById('view-admin').style.display = 'none';
    document.getElementById('view-manager').style.display = 'none';
    document.getElementById('view-staff').style.display = 'block';
    loadStaffDashboard();
  }
}

/* ====================================================================
   ADMIN PANEL LOGIC
   ==================================================================== */

async function loadAdminDashboard() {
  try {
    const res = await apiRequest('/reports/dashboard');
    const d = res.data;
    document.getElementById('admin-metric-clusters').innerText = d.clustersCount;
    document.getElementById('admin-metric-employees').innerText = d.totalEmployees;
    document.getElementById('admin-metric-present').innerText = d.presentToday;
    document.getElementById('admin-metric-absent').innerText = d.absentToday;
    document.getElementById('admin-metric-travelling').innerText = d.currentlyTravelling;
    document.getElementById('admin-metric-km').innerText = `${d.totalKmTravelledToday} km`;

    loadAdminClusters();
  } catch (err) {
    console.error(err);
  }
}

function switchAdminTab(tab) {
  document.querySelectorAll('#view-admin .tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach((c) => (c.style.display = 'none'));

  event.currentTarget.classList.add('active');
  document.getElementById(`admin-tab-${tab}`).style.display = 'block';

  if (tab === 'clusters') loadAdminClusters();
  if (tab === 'employees') loadAdminEmployees();
  if (tab === 'attendance') loadAdminAttendance();
  if (tab === 'fleet') loadAdminFleet();
  if (tab === 'salary') loadAdminSalary();
}

async function loadAdminClusters() {
  const tbody = document.getElementById('admin-clusters-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading clusters...</td></tr>';

  try {
    const res = await apiRequest('/clusters');
    const clusters = res.data;

    // Populate cluster select dropdowns in modals
    populateClusterSelects(clusters);

    if (clusters.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No clusters created yet. Click "+ Create New Cluster" above.</td></tr>';
      return;
    }

    tbody.innerHTML = clusters.map((c) => {
      const managers = (c.managerIds && c.managerIds.length > 0)
        ? c.managerIds.map((m) => `<span class="badge" style="background:#334155; padding:2px 6px; border-radius:4px; font-size:11px;">${m.employeeId}</span>`).join(' ')
        : '<span style="color:var(--text-muted); font-size:12px;">No managers assigned</span>';

      return `
        <tr>
          <td><strong style="color:var(--primary);">${c.code}</strong></td>
          <td><strong>${c.name}</strong><br><small style="color:var(--text-muted);">${c.description || ''}</small></td>
          <td>${c.city || '-'}, ${c.state || '-'}</td>
          <td>${managers}</td>
          <td><strong style="color:var(--emerald);">${c.employeeCount || 0}</strong> staff</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="promptAssignManager('${c._id}', '${c.name}')">+ Assign Manager</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--rose); text-align:center;">Failed to load clusters: ${err.message}</td></tr>`;
  }
}

async function promptAssignManager(clusterId, clusterName) {
  document.getElementById('assign-cluster-id').value = clusterId;
  document.getElementById('assign-cluster-name-display').innerText = `Assigning to: ${clusterName}`;

  const select = document.getElementById('assign-manager-select');
  select.innerHTML = '<option value="">Loading managers...</option>';
  openModal('modal-assign-manager');

  try {
    const res = await apiRequest('/clusters/managers/list');
    select.innerHTML = '<option value="">Select a manager...</option>' +
      res.data.map((m) => `<option value="${m._id}">${m.employeeId} (${m.email})</option>`).join('');
  } catch (err) {
    console.error(err);
  }
}

function populateClusterSelects(clusters) {
  const options = '<option value="">Select cluster...</option>' +
    clusters.map((c) => `<option value="${c._id}">${c.name} (${c.code})</option>`).join('');

  const filterSelect = document.getElementById('admin-employee-cluster-filter');
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="">All Clusters</option>' +
      clusters.map((c) => `<option value="${c._id}">${c.name}</option>`).join('');
  }

  const modalSelect = document.getElementById('emp-cluster-select');
  if (modalSelect) modalSelect.innerHTML = options;

  const transferSelect = document.getElementById('transfer-target-cluster');
  if (transferSelect) transferSelect.innerHTML = options;
}

async function loadAdminEmployees() {
  const tbody = document.getElementById('admin-employees-tbody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Loading employees...</td></tr>';

  const clusterId = document.getElementById('admin-employee-cluster-filter').value;
  const endpoint = clusterId ? `/employees?clusterId=${clusterId}` : '/employees';

  try {
    const res = await apiRequest(endpoint);
    const employees = res.data;

    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No employees found.</td></tr>';
      return;
    }

    tbody.innerHTML = employees.map((emp) => `
      <tr>
        <td><strong>${emp.employeeId}</strong></td>
        <td>${emp.fullName}<br><small style="color:var(--text-muted);">${emp.mobileNumber}</small></td>
        <td><span class="role-pill ${emp.userId?.role === 'CLUSTER_MANAGER' ? 'role-manager' : 'role-staff'}">${emp.userId?.role || 'STAFF'}</span></td>
        <td>${emp.clusterId ? `${emp.clusterId.name}` : '<span style="color:var(--amber);">Unassigned</span>'}</td>
        <td>${emp.department} - ${emp.designation}</td>
        <td>₹${emp.baseSalary?.toLocaleString()}</td>
        <td>₹${emp.perKmRate} / km</td>
        <td><span class="metric-badge" style="background:rgba(16,185,129,0.2); color:#34d399;">${emp.accountStatus}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--rose); text-align:center;">Failed to load employees</td></tr>`;
  }
}

async function loadAdminAttendance() {
  const dateInput = document.getElementById('admin-attendance-date');
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  const tbody = document.getElementById('admin-attendance-tbody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Loading attendance...</td></tr>';

  try {
    const res = await apiRequest(`/attendance/monitor?date=${dateInput.value}`);
    const { present, absent } = res.data;

    const rows = [];
    present.forEach((p) => {
      const a = p.attendance;
      rows.push(`
        <tr>
          <td><strong>${p.employeeId}</strong></td>
          <td>${p.fullName}</td>
          <td>${p.clusterId ? p.clusterId.code : '-'}</td>
          <td><span class="metric-badge" style="background:rgba(16,185,129,0.2); color:#34d399;">${a.status}</span></td>
          <td>${new Date(a.checkInTime).toLocaleTimeString()}</td>
          <td>${a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString() : '<span style="color:var(--amber);">Still Working</span>'}</td>
          <td>${(a.totalWorkingMinutes / 60).toFixed(1)} hrs</td>
          <td>${a.lateMinutes > 0 ? `<span style="color:var(--rose); font-weight:700;">+${a.lateMinutes} min late</span>` : 'On Time'}</td>
        </tr>
      `);
    });

    absent.forEach((ab) => {
      rows.push(`
        <tr style="opacity: 0.65;">
          <td><strong>${ab.employeeId}</strong></td>
          <td>${ab.fullName}</td>
          <td>${ab.clusterId ? ab.clusterId.code : '-'}</td>
          <td><span class="metric-badge" style="background:rgba(244,63,94,0.2); color:#f43f5e;">ABSENT</span></td>
          <td>--:--</td>
          <td>--:--</td>
          <td>0 hrs</td>
          <td>-</td>
        </tr>
      `);
    });

    tbody.innerHTML = rows.join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--rose); text-align:center;">Failed to load attendance</td></tr>`;
  }
}

async function loadAdminFleet() {
  const tbody = document.getElementById('admin-fleet-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading live fleet...</td></tr>';

  try {
    const res = await apiRequest('/travel/live-fleet');
    const fleet = res.data;

    if (fleet.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No active field officers right now.</td></tr>';
      return;
    }

    tbody.innerHTML = fleet.map((f) => {
      const session = f.activeTravelSession;
      const isTravelling = f.isTravelling && session;
      const coords = session && session.currentLocation
        ? `${session.currentLocation.latitude.toFixed(4)}°, ${session.currentLocation.longitude.toFixed(4)}°`
        : '-';

      return `
        <tr>
          <td><strong>${f.fullName}</strong> (${f.employeeId})</td>
          <td>${f.clusterId ? f.clusterId.code : '-'}</td>
          <td>
            ${isTravelling
              ? '<span style="color:var(--emerald); font-weight:700;"><span class="pulse-indicator"></span>FIELD TRAVEL ACTIVE</span>'
              : '<span style="color:var(--text-muted);">STATIONARY / IDLE</span>'}
          </td>
          <td><code>${coords}</code></td>
          <td>${session && session.currentLocation ? (session.currentLocation.speed * 3.6).toFixed(1) + ' km/h' : '-'}</td>
          <td>${session && session.currentLocation?.batteryLevel ? session.currentLocation.batteryLevel + '%' : '85%'}</td>
          <td><strong style="color:var(--primary);">${session ? session.totalDistanceKm : 0} km</strong></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--rose); text-align:center;">Failed to load live fleet</td></tr>`;
  }
}

async function generateSalary() {
  const monthInput = document.getElementById('admin-salary-month');
  if (!monthInput.value) {
    showToast('Please select a month first (YYYY-MM)', 'error');
    return;
  }

  try {
    const res = await apiRequest('/salary/generate', 'POST', { monthYear: monthInput.value });
    showToast(res.message, 'success');
    loadAdminSalary();
  } catch (err) {
    console.error(err);
  }
}

async function loadAdminSalary() {
  const monthInput = document.getElementById('admin-salary-month');
  if (!monthInput.value) {
    const now = new Date();
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const tbody = document.getElementById('admin-salary-tbody');
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Loading salary records...</td></tr>';

  try {
    const res = await apiRequest(`/salary?monthYear=${monthInput.value}`);
    const records = res.data;

    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No salary calculations for this month yet. Click "Run Payroll Calculation".</td></tr>';
      return;
    }

    tbody.innerHTML = records.map((r) => `
      <tr>
        <td><strong>${r.employeeId}</strong></td>
        <td>${r.monthYear}</td>
        <td>₹${r.baseSalary?.toLocaleString()}</td>
        <td>${r.presentDays} / ${r.totalWorkingDays} days</td>
        <td>${r.totalDistanceKm} km</td>
        <td>₹${r.travelAllowanceAmount?.toLocaleString()}</td>
        <td>₹${r.grossEarnings?.toLocaleString()}</td>
        <td><strong style="color:var(--emerald);">₹${r.netPayable?.toLocaleString()}</strong></td>
        <td><span class="metric-badge" style="background:rgba(59,130,246,0.2); color:#60a5fa;">${r.status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="color:var(--rose); text-align:center;">Failed to load salary records</td></tr>`;
  }
}

function exportData(type) {
  const token = authToken;
  const url = `${API_BASE}/reports/export/${type}`;
  window.open(url + `?token=${token}`, '_blank');
  showToast(`Downloading ${type.toUpperCase()} report...`, 'info');
}

/* ====================================================================
   CLUSTER MANAGER PANEL LOGIC
   ==================================================================== */

async function loadManagerDashboard() {
  try {
    const res = await apiRequest('/reports/dashboard');
    const d = res.data;
    document.getElementById('mgr-metric-employees').innerText = d.totalEmployees;
    document.getElementById('mgr-metric-present').innerText = d.presentToday;
    document.getElementById('mgr-metric-absent').innerText = d.absentToday;
    document.getElementById('mgr-metric-travelling').innerText = d.currentlyTravelling;
    document.getElementById('mgr-metric-km').innerText = `${d.totalKmTravelledToday} km`;

    const clusterNames = currentCluster ? currentCluster.map((c) => c.name).join(', ') : 'Assigned Cluster';
    document.getElementById('manager-scope-notice').innerText = `Restricted View: Scoped strictly to your cluster [${clusterNames}]`;

    loadMgrEmployees();
  } catch (err) {
    console.error(err);
  }
}

function switchMgrTab(tab) {
  document.querySelectorAll('#view-manager .tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.mgr-tab-content').forEach((c) => (c.style.display = 'none'));

  event.currentTarget.classList.add('active');
  document.getElementById(`mgr-tab-${tab}`).style.display = 'block';

  if (tab === 'staff') loadMgrEmployees();
  if (tab === 'attendance') loadMgrAttendance();
  if (tab === 'fleet') loadMgrFleet();
  if (tab === 'claims') loadMgrClaims();
}

async function loadMgrEmployees() {
  const tbody = document.getElementById('mgr-employees-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading your cluster staff...</td></tr>';

  try {
    const res = await apiRequest('/employees');
    const employees = res.data;

    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No employees in your cluster yet.</td></tr>';
      return;
    }

    tbody.innerHTML = employees.map((emp) => `
      <tr>
        <td><strong>${emp.employeeId}</strong></td>
        <td>${emp.fullName}</td>
        <td><strong style="color:var(--primary);">${emp.clusterId?.name || '-'}</strong></td>
        <td>${emp.designation} (${emp.department})</td>
        <td>${emp.mobileNumber}</td>
        <td><span class="metric-badge" style="background:rgba(16,185,129,0.2); color:#34d399;">${emp.accountStatus}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--rose); text-align:center;">Failed to load cluster employees</td></tr>`;
  }
}

async function loadMgrAttendance() {
  const dateInput = document.getElementById('mgr-attendance-date');
  if (!dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];

  const tbody = document.getElementById('mgr-attendance-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading cluster attendance...</td></tr>';

  try {
    const res = await apiRequest(`/attendance/monitor?date=${dateInput.value}`);
    const { present, absent } = res.data;

    const rows = [];
    present.forEach((p) => {
      const a = p.attendance;
      rows.push(`
        <tr>
          <td><strong>${p.employeeId}</strong></td>
          <td>${p.fullName}</td>
          <td><span class="metric-badge" style="background:rgba(16,185,129,0.2); color:#34d399;">${a.status}</span></td>
          <td>${new Date(a.checkInTime).toLocaleTimeString()}</td>
          <td>${a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString() : '<span style="color:var(--amber);">Active</span>'}</td>
          <td>${(a.totalWorkingMinutes / 60).toFixed(1)} hrs</td>
          <td>${a.lateMinutes > 0 ? `<span style="color:var(--rose);">+${a.lateMinutes} min late</span>` : 'On Time'}</td>
        </tr>
      `);
    });

    absent.forEach((ab) => {
      rows.push(`
        <tr style="opacity: 0.65;">
          <td><strong>${ab.employeeId}</strong></td>
          <td>${ab.fullName}</td>
          <td><span class="metric-badge" style="background:rgba(244,63,94,0.2); color:#f43f5e;">ABSENT</span></td>
          <td>--:--</td>
          <td>--:--</td>
          <td>0 hrs</td>
          <td>-</td>
        </tr>
      `);
    });

    tbody.innerHTML = rows.join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--rose); text-align:center;">Failed to load attendance</td></tr>`;
  }
}

async function loadMgrFleet() {
  const tbody = document.getElementById('mgr-fleet-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading cluster fleet...</td></tr>';

  try {
    const res = await apiRequest('/travel/live-fleet');
    const fleet = res.data;

    if (fleet.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No field staff travelling right now.</td></tr>';
      return;
    }

    tbody.innerHTML = fleet.map((f) => {
      const s = f.activeTravelSession;
      return `
        <tr>
          <td><strong>${f.fullName}</strong> (${f.employeeId})</td>
          <td>
            ${f.isTravelling && s
              ? '<span style="color:var(--emerald); font-weight:700;"><span class="pulse-indicator"></span>ON FIELD TRAVEL</span>'
              : '<span style="color:var(--text-muted);">STATIONARY</span>'}
          </td>
          <td><code>${s?.currentLocation ? `${s.currentLocation.latitude.toFixed(4)}°, ${s.currentLocation.longitude.toFixed(4)}°` : '-'}</code></td>
          <td>${s?.currentLocation ? (s.currentLocation.speed * 3.6).toFixed(1) + ' km/h' : '-'}</td>
          <td>${s?.currentLocation?.batteryLevel ? s.currentLocation.batteryLevel + '%' : '90%'}</td>
          <td><strong style="color:var(--primary);">${s ? s.totalDistanceKm : 0} km</strong></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--rose); text-align:center;">Failed to load fleet</td></tr>`;
  }
}

async function loadMgrClaims() {
  const tbody = document.getElementById('mgr-claims-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading claims...</td></tr>';

  try {
    const res = await apiRequest('/salary/claims');
    const claims = res.data;

    if (claims.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No claims submitted in your cluster.</td></tr>';
      return;
    }

    tbody.innerHTML = claims.map((c) => `
      <tr>
        <td><strong>${c.employeeId}</strong></td>
        <td>${c.claimDate}</td>
        <td>${c.claimedDistanceKm} km</td>
        <td><strong>₹${c.claimedAmount}</strong></td>
        <td>${c.remarks}</td>
        <td><span class="metric-badge" style="background:${c.status === 'APPROVED' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}; color:${c.status === 'APPROVED' ? '#34d399' : '#f59e0b'};">${c.status}</span></td>
        <td>
          ${c.status === 'PENDING'
            ? `<button class="btn btn-emerald btn-sm" onclick="reviewClaim('${c._id}', 'APPROVED')">Approve</button>
               <button class="btn btn-rose btn-sm" onclick="reviewClaim('${c._id}', 'REJECTED')">Reject</button>`
            : '<span style="color:var(--text-muted); font-size:12px;">Reviewed</span>'}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--rose); text-align:center;">Failed to load claims</td></tr>`;
  }
}

async function reviewClaim(id, status) {
  try {
    await apiRequest(`/salary/claims/${id}`, 'PUT', { status, reviewNotes: `Decision by ${currentUser.employeeId}` });
    showToast(`Claim marked as ${status}`, 'success');
    loadMgrClaims();
  } catch (err) {
    console.error(err);
  }
}

/* ====================================================================
   STAFF PANEL LOGIC
   ==================================================================== */

async function loadStaffDashboard() {
  const sub = document.getElementById('staff-header-sub');
  const clusterName = currentCluster ? currentCluster.name : 'Corporate';
  sub.innerText = `Field Officer: ${currentEmployee?.fullName || ''} | Assigned Cluster: ${clusterName}`;

  try {
    const res = await apiRequest('/attendance/today');
    const d = res.data;

    const badge = document.getElementById('staff-att-status-badge');
    const btnCheckIn = document.getElementById('btn-staff-checkin');
    const btnCheckOut = document.getElementById('btn-staff-checkout');

    if (d.isCheckedIn) {
      badge.innerText = d.isCheckedOut ? 'CHECKED OUT' : 'CHECKED IN (ON DUTY)';
      badge.style.background = d.isCheckedOut ? 'rgba(100,116,139,0.2)' : 'rgba(16,185,129,0.2)';
      badge.style.color = d.isCheckedOut ? '#94a3b8' : '#34d399';

      btnCheckIn.disabled = true;
      btnCheckOut.disabled = d.isCheckedOut;

      document.getElementById('staff-checkin-time-val').innerText = new Date(d.attendance.checkInTime).toLocaleTimeString();
      document.getElementById('staff-checkout-time-val').innerText = d.attendance.checkOutTime
        ? new Date(d.attendance.checkOutTime).toLocaleTimeString()
        : '--:--';

      document.getElementById('staff-working-duration-val').innerText = `${(d.attendance.totalWorkingMinutes / 60).toFixed(1)} hrs`;
    } else {
      badge.innerText = 'NOT CHECKED IN';
      badge.style.background = 'rgba(244,63,94,0.2)';
      badge.style.color = '#f43f5e';

      btnCheckIn.disabled = false;
      btnCheckOut.disabled = true;
    }

    // Active Travel status
    if (d.activeTravelSession) {
      activeTravelSession = d.activeTravelSession;
      setTravelState(true, activeTravelSession.totalDistanceKm);
    } else {
      activeTravelSession = null;
      setTravelState(false, 0);
    }

    loadStaffHistory();
  } catch (err) {
    console.error(err);
  }
}

function setTravelState(isActive, distanceKm = 0) {
  const badge = document.getElementById('staff-travel-status-badge');
  const btnStart = document.getElementById('btn-staff-start-travel');
  const btnStop = document.getElementById('btn-staff-stop-travel');
  const btnCoords = document.getElementById('btn-staff-send-coords');
  const distVal = document.getElementById('staff-live-distance');

  distVal.innerText = `${(distanceKm || 0).toFixed(2)} km`;

  if (isActive) {
    badge.innerHTML = '<span class="pulse-indicator"></span>TRACKING ACTIVE';
    badge.style.background = 'rgba(16,185,129,0.2)';
    badge.style.color = '#34d399';

    btnStart.disabled = true;
    btnStop.disabled = false;
    btnCoords.disabled = false;
  } else {
    badge.innerText = 'IDLE';
    badge.style.background = 'rgba(100,116,139,0.2)';
    badge.style.color = '#94a3b8';

    btnStart.disabled = false;
    btnStop.disabled = true;
    btnCoords.disabled = true;
  }
}

function getDeviceGpsCoords(fallbackIndex = 0) {
  return new Promise((resolve) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 12,
            speed: pos.coords.speed || 0,
            address: 'Mobile Device GPS Fix',
          });
        },
        (err) => {
          console.warn('Mobile GPS fallback to cluster HQ:', err.message);
          resolve({
            ...sampleWaypoints[fallbackIndex],
            address: 'Cluster Branch HQ',
          });
        },
        { enableHighAccuracy: true, timeout: 4000 }
      );
    } else {
      resolve({
        ...sampleWaypoints[fallbackIndex],
        address: 'Cluster Branch HQ',
      });
    }
  });
}

async function staffCheckIn() {
  const coords = await getDeviceGpsCoords(0);
  const deviceIdentifier = navigator.userAgent.includes('Mobile') ? 'Mobile-Phone-Browser' : 'Web-Terminal-Client';

  try {
    const res = await apiRequest('/attendance/check-in', 'POST', {
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: coords.address,
      deviceId: deviceIdentifier,
    });
    showToast('Check-in confirmed successfully!', 'success');
    loadStaffDashboard();
  } catch (err) {
    console.error(err);
  }
}

async function staffCheckOut() {
  const coords = await getDeviceGpsCoords(sampleWaypoints.length - 1);
  const deviceIdentifier = navigator.userAgent.includes('Mobile') ? 'Mobile-Phone-Browser' : 'Web-Terminal-Client';

  try {
    await apiRequest('/attendance/check-out', 'POST', {
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: coords.address,
      deviceId: deviceIdentifier,
    });
    showToast('Check-out completed for today!', 'success');
    loadStaffDashboard();
  } catch (err) {
    console.error(err);
  }
}

async function staffStartTravel() {
  const coords = await getDeviceGpsCoords(0);
  try {
    const res = await apiRequest('/travel/start', 'POST', {
      latitude: coords.latitude,
      longitude: coords.longitude,
      purpose: 'Field Inspection & Client Visit',
    });
    activeTravelSession = res.data;
    setTravelState(true, 0);
    showToast('Field travel started. GPS breadcrumb recording is active!', 'success');
  } catch (err) {
    console.error(err);
  }
}

async function staffSimulateWaypoint() {
  if (!activeTravelSession) return;
  currentWaypointIndex = (currentWaypointIndex + 1) % sampleWaypoints.length;
  const waypoint = {
    ...sampleWaypoints[currentWaypointIndex],
    timestamp: new Date().toISOString(),
    batteryLevel: 82,
    isCharging: false,
  };

  try {
    const res = await apiRequest('/travel/location-batch', 'POST', {
      sessionId: activeTravelSession._id,
      points: [waypoint],
    });

    const newDist = res.data.totalDistanceKm;
    activeTravelSession.totalDistanceKm = newDist;
    document.getElementById('staff-live-distance').innerText = `${newDist.toFixed(2)} km`;
    showToast(`GPS Point logged: +${res.message}`, 'success');
  } catch (err) {
    console.error(err);
  }
}

async function staffStopTravel() {
  if (!activeTravelSession) return;
  const coords = sampleWaypoints[currentWaypointIndex];

  try {
    const res = await apiRequest('/travel/stop', 'POST', {
      sessionId: activeTravelSession._id,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    showToast(`Field travel completed. Total distance: ${res.data.totalDistanceKm} km`, 'success');
    activeTravelSession = null;
    setTravelState(false, 0);
    loadStaffDashboard();
  } catch (err) {
    console.error(err);
  }
}

function switchStaffTab(tab) {
  document.querySelectorAll('#view-staff .tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.staff-tab-content').forEach((c) => (c.style.display = 'none'));

  event.currentTarget.classList.add('active');
  document.getElementById(`staff-tab-${tab}`).style.display = 'block';

  if (tab === 'history') loadStaffHistory();
  if (tab === 'slips') loadStaffSlips();
}

async function loadStaffHistory() {
  const tbody = document.getElementById('staff-history-tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading attendance history...</td></tr>';

  try {
    const res = await apiRequest('/attendance/history');
    const logs = res.data;

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No attendance history found.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map((l) => `
      <tr>
        <td><strong>${l.date}</strong></td>
        <td><span class="metric-badge" style="background:rgba(16,185,129,0.2); color:#34d399;">${l.status}</span></td>
        <td>${new Date(l.checkInTime).toLocaleTimeString()}</td>
        <td>${l.checkOutTime ? new Date(l.checkOutTime).toLocaleTimeString() : '<span style="color:var(--amber);">Active</span>'}</td>
        <td>${(l.totalWorkingMinutes / 60).toFixed(1)} hrs</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--rose); text-align:center;">Failed to load attendance history</td></tr>`;
  }
}

async function loadStaffSlips() {
  const tbody = document.getElementById('staff-slips-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading salary slips...</td></tr>';

  try {
    const res = await apiRequest('/salary/my-slips');
    const slips = res.data;

    if (slips.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No salary slips available yet.</td></tr>';
      return;
    }

    tbody.innerHTML = slips.map((s) => `
      <tr>
        <td><strong>${s.monthYear}</strong></td>
        <td>₹${s.baseSalary?.toLocaleString()}</td>
        <td>${s.presentDays} days</td>
        <td>${s.totalDistanceKm} km</td>
        <td>₹${s.travelAllowanceAmount?.toLocaleString()}</td>
        <td><strong style="color:var(--emerald);">₹${s.netPayable?.toLocaleString()}</strong></td>
        <td><span class="metric-badge" style="background:rgba(59,130,246,0.2); color:#60a5fa;">${s.status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--rose); text-align:center;">Failed to load salary slips</td></tr>`;
  }
}
