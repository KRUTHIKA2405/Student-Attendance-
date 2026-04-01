import { saveRecord, getPendingRecords, markRecordsSynced } from './db.js';

const studentListEl = document.getElementById('studentList');
const statusBar = document.getElementById('statusBar');
const syncStatusEl = document.getElementById('sync-status');
const mappingBar = document.getElementById('mappingBar');
const attendanceChartCtx = document.getElementById('attendanceChart').getContext('2d');
const riskChartCtx = document.getElementById('riskChart').getContext('2d');

let students = [];
let riskModel = [];
let attendanceData = { present: 0, absent: 0, late: 0 };
let rfTrees = [];

async function fetchResource(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Fetch failed:' + url);
  return res.json();
}

function setSyncStatus(state, msg) {
  syncStatusEl.className = 'sync-status ' + state;
  statusBar.textContent = msg || 'Status: ' + state;
}

function scheduleSync() {
  if (navigator.serviceWorker && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then(reg => reg.sync.register('attendance-sync'))
      .catch(err => console.warn('Background sync not available:', err));
  }
}

function renderStudentRow(student) {
  const template = document.getElementById('studentRowTemplate');
  const clone = template.content.cloneNode(true);
  const row = clone.querySelector('.student-row');

  row.querySelector('.name').textContent = student.name;
  row.querySelector('.id').textContent = student.id;
  row.querySelector('.parent').textContent = student.parentName;
  row.querySelector('.phone').textContent = student.parentPhone;
  row.querySelector('.info').textContent = `Absences: ${student.absences} | Travel time: ${student.traveltime} | ID: ${student.id} | Parent: ${student.parentName} | Phone: ${student.parentPhone}`;

  const riskDot = row.querySelector('.student-risk');
  const riskVal = getRiskByAbsences(student.absences);
  const predictedG3 = student.G3 && student.G3 > 0 ? student.G3 : predictForest(student);
  const alertTag = getDropoutAlert(riskVal, predictedG3);

  row.querySelector('.student-risk').title = `Dropout Risk: ${riskVal}%`;
  riskDot.style.background = riskVal >= 60 ? 'var(--red)' : riskVal >= 30 ? 'var(--orange)' : 'var(--green)';
  row.querySelector('.student-risk').textContent = '';
  row.querySelector('.predicted-g3').textContent = predictedG3;
  row.querySelector('.risk-tag').textContent = alertTag;
  row.querySelector('.risk-tag').style.color = alertTag === 'HIGH' ? 'var(--red)' : alertTag === 'MEDIUM' ? 'var(--orange)' : 'var(--green)';

  function onMark(status) {
    row.querySelector('.latest').textContent = `${status} @ ${new Date().toLocaleTimeString()}`;
    attendanceData[status.toLowerCase()]++;
    updateCharts();
    const record = { studentId: student.id, status, timestamp: new Date().toISOString(), absences: student.absences, risk: riskVal };
    saveRecord(record).then(() => {
      setSyncStatus('orange', `Locally saved ${student.name}=${status}`);
      scheduleSync();
    }).catch(console.error);
  }

  row.querySelector('.mark.present').addEventListener('click', () => onMark('Present'));
  row.querySelector('.mark.absent').addEventListener('click', () => onMark('Absent'));
  row.querySelector('.mark.late').addEventListener('click', () => onMark('Late'));

  return clone;
}

function getRiskByAbsences(absences) {
  if (!riskModel.length) return 0;
  const row = riskModel.find(item => item.absences === absences);
  if (row) return row.risk;
  const closer = riskModel.reduce((best, item) => Math.abs(item.absences - absences) < Math.abs(best.absences - absences) ? item : best, riskModel[0]);
  return closer.risk;
}

function mean(valueList) {
  if (!valueList.length) return 0;
  return valueList.reduce((a, b) => a + b, 0) / valueList.length;
}

function variance(valueList) {
  const mu = mean(valueList);
  return valueList.reduce((sum, v) => sum + Math.pow(v - mu, 2), 0) / valueList.length;
}

function splitRows(data, feature, threshold) {
  const left = [];
  const right = [];
  data.forEach(row => {
    if ((Number(row[feature]) || 0) <= threshold) left.push(row);
    else right.push(row);
  });
  return { left, right };
}

function buildTree(data, depth = 0, maxDepth = 5, minSize = 10) {
  const targets = data.map(r => Number(r.G3 || 0));
  const node = {};

  if (!data.length) {
    return { type: 'leaf', value: 0 };
  }

  node.value = mean(targets);

  if (depth >= maxDepth || data.length <= minSize || new Set(targets).size === 1) {
    node.type = 'leaf';
    return node;
  }

  let bestScore = Infinity;
  let bestFeature = null;
  let bestThreshold = null;
  let bestSplit = null;
  const features = ['absences', 'traveltime'];

  features.forEach(feature => {
    const values = Array.from(new Set(data.map(r => Number(r[feature] || 0))));
    values.sort((a, b) => a - b);

    values.forEach(threshold => {
      const { left, right } = splitRows(data, feature, threshold);
      if (!left.length || !right.length) return;

      const leftTargets = left.map(r => Number(r.G3 || 0));
      const rightTargets = right.map(r => Number(r.G3 || 0));
      const weightedVar = (leftTargets.length * variance(leftTargets) + rightTargets.length * variance(rightTargets)) / data.length;

      if (weightedVar < bestScore) {
        bestScore = weightedVar;
        bestFeature = feature;
        bestThreshold = threshold;
        bestSplit = { left, right };
      }
    });
  });

  if (!bestFeature || bestScore === Infinity) {
    node.type = 'leaf';
    return node;
  }

  node.type = 'node';
  node.feature = bestFeature;
  node.threshold = bestThreshold;
  node.left = buildTree(bestSplit.left, depth + 1, maxDepth, minSize);
  node.right = buildTree(bestSplit.right, depth + 1, maxDepth, minSize);
  return node;
}

function buildForest(data, nTrees = 12, maxDepth = 5, minSize = 8) {
  const forest = [];
  for (let i = 0; i < nTrees; i++) {
    const sample = [];
    for (let j = 0; j < data.length; j++) {
      sample.push(data[Math.floor(Math.random() * data.length)]);
    }
    forest.push(buildTree(sample, 0, maxDepth, minSize));
  }
  return forest;
}

function predictTree(tree, row) {
  if (!tree || tree.type === 'leaf') return tree ? tree.value : 0;
  const value = Number(row[tree.feature] || 0);
  if (value <= tree.threshold) return predictTree(tree.left, row);
  return predictTree(tree.right, row);
}

function predictForest(row) {
  if (!rfTrees.length) return 0;
  const all = rfTrees.map(tree => predictTree(tree, row));
  return parseFloat(mean(all).toFixed(1));
}

function getDropoutAlert(risk, predictedGrade) {
  if (risk >= 70 || predictedGrade <= 8) return 'HIGH';
  if (risk >= 45 || predictedGrade <= 12) return 'MEDIUM';
  return 'LOW';
}

let attendanceChart;
let riskChart;

function initCharts() {
  attendanceChart = new Chart(attendanceChartCtx, {
    type: 'bar', data: {
      labels: ['Present', 'Absent', 'Late'],
      datasets: [{ label: 'Students', data: [attendanceData.present, attendanceData.absent, attendanceData.late], backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'] }]
    }, options: { responsive: true, plugins: { legend: { display: false } } }
  });

  const x = riskModel.map(r => r.absences);
  const y = riskModel.map(r => r.risk);
  riskChart = new Chart(riskChartCtx, {
    type: 'line', data: { labels: x, datasets: [{ label: 'Dropout risk (%)', data: y, borderColor: '#2563eb', backgroundColor: '#bfdbfe', fill: true }] }, options: { responsive: true }
  });
}

function updateCharts() {
  if (attendanceChart) {
    attendanceChart.data.datasets[0].data = [attendanceData.present, attendanceData.absent, attendanceData.late];
    attendanceChart.update();
  }
}

function renderAllStudents() {
  studentListEl.innerHTML = '';
  attendanceData = { present: 0, absent: 0, late: 0 };
  students.forEach(s => studentListEl.appendChild(renderStudentRow(s)));
  updateCharts();
}

async function loadStudents(sourceUrl, sourceName) {
  const payload = await fetchResource(sourceUrl);
  students = payload;
  mappingBar.textContent = `UCI mapping source: ${sourceName} | absences → absences, traveltime → traveltime`;
  setSyncStatus('orange', `Loaded ${students.length} records from ${sourceName}`);

  // Train random forest on UCI history (absences/traveltime -> G3).
  const trainFiles = students.filter(s => typeof s.G3 === 'number' && s.G3 >= 0);
  if (trainFiles.length > 0) {
    rfTrees = buildForest(trainFiles, 14, 5, 8);
    console.info('Random Forest trained on', trainFiles.length, 'samples');
  } else {
    rfTrees = [];
    console.warn('No G3 training data available for forest');
  }

  renderAllStudents();
}

async function loadApp() {
  try {
    riskModel = await fetchResource('risk-data.json');
    await loadStudents('mock-data.json', 'local sample');

    setSyncStatus('red', 'Offline or not synced yet');
    initCharts();
    navigator.onLine ? setSyncStatus('orange', 'Online and pending sync') : setSyncStatus('red', 'Offline');

    const tabAttendance = document.getElementById('tabAttendance');
    const tabAnalytics = document.getElementById('tabAnalytics');
    const panelAttendance = document.getElementById('panelAttendance');
    const panelAnalytics = document.getElementById('panelAnalytics');

    const showPanel = panelId => {
      if (panelId === 'attendance') {
        panelAttendance.classList.remove('hidden');
        panelAnalytics.classList.add('hidden');
        tabAttendance.classList.add('active');
        tabAnalytics.classList.remove('active');
      } else {
        panelAttendance.classList.add('hidden');
        panelAnalytics.classList.remove('hidden');
        tabAttendance.classList.remove('active');
        tabAnalytics.classList.add('active');
      }
      setSyncStatus('orange', `${panelId === 'attendance' ? 'Showing Attendance view' : 'Showing Analytics view'}`);
      if (attendanceChart) attendanceChart.resize();
      if (riskChart) riskChart.resize();
    };

    tabAttendance.addEventListener('click', () => showPanel('attendance'));
    tabAnalytics.addEventListener('click', () => showPanel('analytics'));
  

    window.addEventListener('online', () => {
      setSyncStatus('orange', 'Back online, syncing...'); flushPending();
    });
    window.addEventListener('offline', () => setSyncStatus('red', 'Offline'));

    document.getElementById('navigatorSync').addEventListener('click', flushPending);
    document.getElementById('loadUci').addEventListener('click', () => loadStudents('mock-data.json', 'UCI merged sample'));
    document.getElementById('scanQr').addEventListener('click', () => alert('QR scan not implemented in this demo; use a real mobile camera API to integrate.'));

    if (navigator.serviceWorker && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(() => navigator.serviceWorker.ready.then(reg => reg.sync.register('attendance-sync')).catch(console.warn));
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'SYNC_NOW') flushPending();
      });
    }
  } catch (err) {
    console.error(err);
    statusBar.textContent = 'Critical load error: ' + err.message;
  }
}

async function flushPending() {
  setSyncStatus('orange', 'Syncing pending records...');
  const pending = await getPendingRecords();
  if (!pending.length) {
    setSyncStatus('green', 'All data synced');
    return;
  }

  try {
    // simulate network push; if real backend, replace URL here
    await fetch('https://jsonplaceholder.typicode.com/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
    await markRecordsSynced(pending.map(r => r.id));
    setSyncStatus('green', `Synced ${pending.length} records`);
  } catch (err) {
    console.warn('Sync failed:', err);
    setSyncStatus('orange', 'Sync failed, retry when online');
  }
}

loadApp();
