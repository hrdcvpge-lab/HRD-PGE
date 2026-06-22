import { supabase, isDemoMode, requireRole, signOut, showToast, monthLabel, formatStatus } from './auth.js';

const rolesUrl = './data/kpi_roles.json';
const DEMO_PERIOD = { id: 'demo-jun-2026', month_start: '2026-06-01', status: 'open' };
const DEMO_ASSIGNMENTS_KEY = 'pge_demo_role_assignments_v2';
const DEMO_CARDS_KEY = 'pge_demo_cards_role_assignments_v2';
const DEMO_DEPARTMENTS = [
  'Operations',
  'Sales & Marketing',
  'Research & Development',
  'Finance, Accounting & Tax',
  'HRD GA'
];

const OPERATOR_STATIONS = [
  'Operator Cutting Bahan',
  'Operator Print & Cutting Gambar',
  'Operator Jahit / Rakit',
  'Operator Finishing / Trimming',
  'Operator Produksi Umum'
];

const SAMPLE_ASSIGNMENTS = [
  { id: 'sample-ops-admin', team_key: 'operations', department: 'Operations', full_name: 'Contoh Admin Produksi', role_id: 'ops-admin-ops' },
  { id: 'sample-ops-head', team_key: 'operations', department: 'Operations', full_name: 'Contoh Kepala Produksi', role_id: 'ops-head-prod' },
  { id: 'sample-ops-cut', team_key: 'operations', department: 'Operations', full_name: 'Contoh Operator Cutting', role_id: 'ops-operator', station: 'Operator Cutting Bahan' },
  { id: 'sample-ops-print', team_key: 'operations', department: 'Operations', full_name: 'Contoh Operator Print', role_id: 'ops-operator', station: 'Operator Print & Cutting Gambar' },
  { id: 'sample-ops-sew', team_key: 'operations', department: 'Operations', full_name: 'Contoh Operator Jahit', role_id: 'ops-operator', station: 'Operator Jahit / Rakit' },
  { id: 'sample-ops-finish', team_key: 'operations', department: 'Operations', full_name: 'Contoh Operator Finishing', role_id: 'ops-operator', station: 'Operator Finishing / Trimming' },
  { id: 'sample-ops-helper', team_key: 'operations', department: 'Operations', full_name: 'Contoh Helper Produksi', role_id: 'ops-helper' },
  { id: 'sample-ops-qc', team_key: 'operations', department: 'Operations', full_name: 'Contoh Staff QC', role_id: 'ops-qc' },
  { id: 'sample-ops-stock', team_key: 'operations', department: 'Operations', full_name: 'Contoh Staff Gudang', role_id: 'ops-gudang' },
  { id: 'sample-ops-delivery', team_key: 'operations', department: 'Operations', full_name: 'Contoh Staff Logistik', role_id: 'ops-logistik' },
  { id: 'sample-sm-head', team_key: 'sales_marketing', department: 'Sales & Marketing', full_name: 'Contoh Kepala S&M', role_id: 'sm-head' },
  { id: 'sample-sm-mkt', team_key: 'sales_marketing', department: 'Sales & Marketing', full_name: 'Contoh Staff Marketing', role_id: 'sm-marketing' },
  { id: 'sample-sm-sales', team_key: 'sales_marketing', department: 'Sales & Marketing', full_name: 'Contoh Staff Sales', role_id: 'sm-sales' },
  { id: 'sample-sm-content', team_key: 'sales_marketing', department: 'Sales & Marketing', full_name: 'Contoh Content Specialist', role_id: 'sm-sosmed' },
  { id: 'sample-rnd-head', team_key: 'rnd', department: 'Research & Development', full_name: 'Contoh Kepala R&D', role_id: 'rnd-head' },
  { id: 'sample-rnd-designer', team_key: 'rnd', department: 'Research & Development', full_name: 'Contoh Product Designer', role_id: 'rnd-designer' },
  { id: 'sample-rnd-tech', team_key: 'rnd', department: 'Research & Development', full_name: 'Contoh Technical Specialist', role_id: 'rnd-tech' },
  { id: 'sample-fat', team_key: 'fat', department: 'Finance, Accounting & Tax', full_name: 'Contoh FAT Generalist', role_id: 'fat-generalist' },
  { id: 'sample-hrd', team_key: 'hrd', department: 'HRD GA', full_name: 'Contoh HRD GA Generalist', role_id: 'hrd-generalist' }
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const canonical = value => String(value || '').trim().toLocaleLowerCase('id-ID');
const uid = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

let roleMasterPromise;
async function getRoleMaster() {
  if (!roleMasterPromise) {
    roleMasterPromise = fetch(rolesUrl).then(async response => {
      if (!response.ok) throw new Error('KPI role master tidak dapat dimuat. Pastikan data/kpi_roles.json tersedia.');
      return response.json();
    });
  }
  return roleMasterPromise;
}

function getDemoAssignments() {
  try { return JSON.parse(localStorage.getItem(DEMO_ASSIGNMENTS_KEY) || '[]'); } catch { return []; }
}
function setDemoAssignments(assignments) { localStorage.setItem(DEMO_ASSIGNMENTS_KEY, JSON.stringify(assignments)); }
function getDemoCards() {
  try { return JSON.parse(localStorage.getItem(DEMO_CARDS_KEY) || '[]'); } catch { return []; }
}
function setDemoCards(cards) { localStorage.setItem(DEMO_CARDS_KEY, JSON.stringify(cards)); }
function resetDemoData() {
  localStorage.removeItem(DEMO_ASSIGNMENTS_KEY);
  localStorage.removeItem(DEMO_CARDS_KEY);
}
function findDemoCard(periodId, employeeId) {
  return getDemoCards().find(card => card.period_id === periodId && card.employee_id === employeeId);
}
function saveDemoCard(card) {
  const cards = getDemoCards().filter(existing => !(existing.period_id === card.period_id && existing.employee_id === card.employee_id));
  cards.push(card);
  setDemoCards(cards);
}

function roleTemplate(roleId, roleMaster) {
  return roleMaster.find(role => role.id === roleId);
}
function displayRole(assignment, role) {
  if (!role) return assignment.current_role || 'Role tidak ditemukan';
  return assignment.station ? `${role.role} — ${assignment.station}` : role.role;
}
function makeDemoPerson(assignment, roleMaster, context = null) {
  const template = roleTemplate(assignment.role_id, roleMaster);
  if (!template) return null;
  const self = context?.workspaceType === 'self';
  return {
    id: assignment.id,
    employee_role_id: assignment.id,
    full_name: assignment.full_name,
    department: assignment.department,
    team_leader_name: self ? 'Self reporting · Owner review' : (context?.profile?.full_name || assignment.team_leader_name || 'Team Leader'),
    assignment: assignment,
    role: {
      ...template,
      templateRole: template.role,
      role: displayRole(assignment, template)
    }
  };
}
function allDemoPeople(roleMaster) {
  return getDemoAssignments().map(assignment => makeDemoPerson(assignment, roleMaster)).filter(Boolean);
}

function navMarkup(active) {
  return `<header class="app-header"><nav class="app-nav" aria-label="Portal navigation">
    <a class="brand" href="index.html"><span class="brand-mark">PGE</span><span><span class="brand-title">AOS / Performance Portal</span><span class="brand-sub">KPI Monthly Workflow</span></span></a>
    <div class="nav-menu"><a href="index.html">Hub</a><a href="kpi.html">KPI Info</a><a class="${active === 'team' ? 'active' : ''}" href="team-dashboard.html">Team</a><a class="${active === 'review' ? 'active' : ''}" href="review.html">HR Review</a><a class="${active === 'owner' ? 'active' : ''}" href="owner-dashboard.html">Owner</a><button type="button" id="logout-button" class="portal-link">Logout</button></div>
  </nav></header>`;
}
function attachNav(context) {
  const outlet = $('#portal-nav');
  if (outlet) outlet.innerHTML = navMarkup(document.body.dataset.page || '');
  $('#logout-button')?.addEventListener('click', signOut);
  const label = $('#portal-user');
  if (label) label.textContent = context?.profile?.full_name || context?.user?.email || 'User';
}
function statusPill(status) {
  return `<span class="status ${escapeHTML(status || 'draft')}">${escapeHTML(formatStatus(status || 'draft'))}</span>`;
}
function metricKey(metric, index) {
  return String(metric.id || metric.metric_id || `metric-${index + 1}`);
}

function metricForm(metric, index, entry = {}) {
  const target = metric.target || metric.target_text || '-';
  const phase = metric.phase || metric.title || `KPI ${index + 1}`;
  const weight = Number(metric.weight || 0).toFixed(2).replace(/\.00$/, '');
  const achievement = entry.achievement_percent ?? '';
  return `<article class="metric-card" data-metric-index="${index}" data-metric-id="${escapeHTML(metricKey(metric, index))}">
    <div class="metric-head"><div class="metric-no">${String(index + 1).padStart(2, '0')}</div><div><div class="metric-title">${escapeHTML(phase)}</div><div class="metric-meta">Target baseline: ${escapeHTML(target)}<br>Frekuensi: ${escapeHTML(metric.frequency || 'Bulanan')}</div></div><span class="weight-badge">${weight}%</span></div>
    <div class="metric-content"><div class="metric-target"><strong>Objective / Evidence</strong>${escapeHTML(metric.objective || '').replace(/\n/g, '<br>')}<br><br><strong>Bukti monitoring</strong>${escapeHTML(metric.evidence || 'Evidence link wajib saat submit.')}</div>
    <div class="metric-form"><div class="field"><label>Capaian (%)</label><input class="metric-input input-achievement" type="number" min="0" max="120" step="0.01" value="${escapeHTML(achievement)}" placeholder="0–120"></div><div class="field"><label>Actual / Ringkasan</label><input class="metric-input input-actual" value="${escapeHTML(entry.actual_summary || '')}" placeholder="Hasil aktual"></div><div class="field wide"><label>Evidence URL</label><input class="metric-input input-evidence" type="url" value="${escapeHTML(entry.evidence_url || '')}" placeholder="https://drive.google.com/... "></div><div class="field"><label>Root cause (bila &lt; target)</label><textarea class="input-root">${escapeHTML(entry.root_cause || '')}</textarea></div><div class="field"><label>Corrective action</label><textarea class="input-action">${escapeHTML(entry.corrective_action || '')}</textarea></div></div></div>
  </article>`;
}
function calculateScore(metrics, entries) {
  return metrics.reduce((total, metric, index) => total + (Number(entries[index]?.achievement_percent || 0) * Number(metric.weight || 0) / 100), 0);
}
function cardModalShell() {
  let modal = $('#card-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'card-modal';
  modal.className = 'modal';
  modal.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="card-modal-title"><div class="modal-head"><div><div class="modal-kicker" id="card-modal-kicker"></div><h2 id="card-modal-title"></h2></div><button class="modal-close" type="button" data-close-card>Close</button></div><div class="modal-body" id="card-modal-body"></div><div class="modal-actions" id="card-modal-actions"></div></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', event => { if (event.target === modal) closeCardModal(); });
  modal.querySelector('[data-close-card]').addEventListener('click', closeCardModal);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeCardModal(); });
  return modal;
}
function closeCardModal() { $('#card-modal')?.classList.remove('open'); }
function bindScorePreview(metrics) {
  const update = () => {
    const entries = $$('.metric-card').map(card => ({ achievement_percent: $('.input-achievement', card)?.value || 0 }));
    const score = calculateScore(metrics, entries);
    const scoreEl = $('#live-score');
    if (scoreEl) scoreEl.textContent = `${score.toFixed(2)}%`;
  };
  $$('.input-achievement').forEach(input => input.addEventListener('input', update));
  update();
}
function collectEntries(metrics) {
  return $$('.metric-card').map((card, index) => ({
    metric_template_id: card.dataset.metricId || metricKey(metrics[index], index),
    achievement_percent: Number($('.input-achievement', card).value || 0),
    actual_summary: $('.input-actual', card).value.trim(),
    evidence_url: $('.input-evidence', card).value.trim(),
    root_cause: $('.input-root', card).value.trim(),
    corrective_action: $('.input-action', card).value.trim()
  }));
}

async function getPeriods() {
  if (isDemoMode) return [DEMO_PERIOD];
  const { data, error } = await supabase.from('reporting_periods').select('*').order('month_start', { ascending: false });
  if (error) throw error;
  return data || [];
}
async function getTeamData(context, roleMaster) {
  if (isDemoMode) {
    return getDemoAssignments()
      .filter(assignment => assignment.team_key === context.teamKey)
      .map(assignment => makeDemoPerson(assignment, roleMaster, context))
      .filter(Boolean);
  }
  const { data: assignments, error } = await supabase.from('team_assignments').select('employee_id').eq('team_leader_id', context.user.id).is('effective_to', null);
  if (error) throw error;
  const employeeIds = [...new Set([context.user.id, ...(assignments || []).map(item => item.employee_id)])];
  const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
    supabase.from('profiles').select('id,full_name').in('id', employeeIds),
    supabase.from('employee_role_assignments').select('id,employee_id,role_definition:role_definitions(id,code,title,department:departments(name),capacity,reviewer_role,scope)').in('employee_id', employeeIds).is('ended_at', null)
  ]);
  if (profileError) throw profileError;
  if (roleError) throw roleError;
  return (roles || []).map(assignment => {
    const profile = (profiles || []).find(item => item.id === assignment.employee_id) || {};
    return {
      employee_role_id: assignment.id,
      id: assignment.employee_id,
      full_name: profile.full_name || 'Unnamed employee',
      role: {
        id: assignment.role_definition.id,
        code: assignment.role_definition.code,
        role: assignment.role_definition.title,
        department: assignment.role_definition.department?.name || '',
        capacity: assignment.role_definition.capacity,
        reviewer: assignment.role_definition.reviewer_role,
        scope: assignment.role_definition.scope
      }
    };
  });
}
async function getCardStatus(periodId, people) {
  if (isDemoMode) return people.map(person => findDemoCard(periodId, person.id) || { period_id: periodId, employee_id: person.id, status: 'draft', calculated_score: null });
  const ids = people.map(person => person.employee_role_id);
  if (!ids.length) return [];
  const { data, error } = await supabase.from('monthly_kpi_cards').select('id,period_id,employee_role_id,status,calculated_score,reviewer_note').eq('period_id', periodId).in('employee_role_id', ids);
  if (error) throw error;
  return data || [];
}
async function getMetricsForRole(role) {
  if (isDemoMode) return role.metrics || [];
  const { data, error } = await supabase.from('metric_templates').select('*').eq('role_definition_id', role.id).eq('active', true).order('sort_order');
  if (error) throw error;
  return data || [];
}
async function getCardEntries(cardId) {
  if (isDemoMode) return getDemoCards().find(card => card.id === cardId)?.entries || [];
  if (!cardId) return [];
  const { data, error } = await supabase.from('monthly_kpi_entries').select('*').eq('card_id', cardId);
  if (error) throw error;
  return data || [];
}

async function saveCard({ context, period, person, metrics, status }) {
  const entries = collectEntries(metrics);
  if (entries.some(entry => entry.achievement_percent < 0 || entry.achievement_percent > 120 || Number.isNaN(entry.achievement_percent))) {
    throw new Error('Capaian harus berada antara 0% sampai 120%.');
  }
  if (status === 'submitted' && entries.some(entry => !entry.evidence_url)) {
    throw new Error('Evidence URL wajib diisi sebelum submit untuk HR review.');
  }
  if (isDemoMode) {
    const old = findDemoCard(period.id, person.id) || {};
    const now = new Date().toISOString();
    const card = {
      ...old,
      id: old.id || `demo-card-${period.id}-${person.id}`,
      period_id: period.id,
      employee_id: person.id,
      employee_name: person.full_name,
      department: person.role.department,
      role_id: person.role.id,
      role_title: person.role.role,
      role_template_title: person.role.templateRole || person.role.role,
      station: person.assignment?.station || '',
      status,
      entries,
      calculated_score: calculateScore(metrics, entries),
      updated_at: now,
      submitted_at: status === 'submitted' ? now : (old.submitted_at || null),
      team_leader_name: person.team_leader_name || context.profile.full_name
    };
    saveDemoCard(card);
    return card;
  }
  const { data: card, error: cardError } = await supabase.from('monthly_kpi_cards').upsert({
    period_id: period.id,
    employee_role_id: person.employee_role_id,
    team_leader_id: context.user.id,
    status: status === 'submitted' ? 'draft' : status
  }, { onConflict: 'period_id,employee_role_id' }).select().single();
  if (cardError) throw cardError;
  const payload = entries.map(entry => ({ ...entry, card_id: card.id }));
  const { error: entriesError } = await supabase.from('monthly_kpi_entries').upsert(payload, { onConflict: 'card_id,metric_template_id' });
  if (entriesError) throw entriesError;
  if (status === 'submitted') {
    const { error } = await supabase.rpc('submit_monthly_card', { p_card_id: card.id });
    if (error) throw error;
  }
  return card;
}

function sampleTeamLeaderName(teamKey) {
  return ({
    operations: 'Contoh Kepala Produksi',
    sales_marketing: 'Contoh Kepala Sales & Marketing',
    rnd: 'Contoh Kepala R&D',
    fat: 'Self reporting · Owner review',
    hrd: 'Self reporting · Owner review'
  })[teamKey] || 'Team Leader';
}
export async function loadFullDemoScenario({ overwrite = true } = {}) {
  if (!isDemoMode) return;
  if (overwrite) resetDemoData();
  const master = await getRoleMaster();
  const assignments = SAMPLE_ASSIGNMENTS.map(item => ({ ...item, team_leader_name: sampleTeamLeaderName(item.team_key), created_at: new Date().toISOString() }));
  setDemoAssignments(assignments);
  const statuses = ['approved', 'submitted', 'approved', 'returned', 'approved', 'submitted', 'approved', 'submitted', 'approved', 'approved', 'submitted', 'approved', 'returned', 'approved', 'submitted', 'approved', 'approved', 'submitted', 'approved'];
  const bases = [99, 92, 98, 88, 103, 95, 91, 100, 97, 94, 96, 101, 89, 98, 93, 100, 95, 91, 99];
  const cards = assignments.map((assignment, index) => {
    const role = roleTemplate(assignment.role_id, master);
    const base = bases[index % bases.length];
    const entries = (role.metrics || []).map((metric, metricIndex) => {
      const achievement = Math.max(72, Math.min(120, base - metricIndex * 1.35 + ((index + metricIndex) % 3)));
      const below = achievement < 95;
      return {
        metric_template_id: metricKey(metric, metricIndex),
        achievement_percent: Number(achievement.toFixed(2)),
        actual_summary: `Rekap ${monthLabel(DEMO_PERIOD.month_start)}: monitoring ${metric.phase || 'KPI'} tercatat sesuai periode.`,
        evidence_url: `https://drive.google.com/demo/${assignment.id}/metric-${metricIndex + 1}`,
        root_cause: below ? 'Ada deviasi minor pada periode berjalan dan sudah dicatat dalam log monitoring.' : '',
        corrective_action: below ? 'PIC menjalankan tindakan korektif dan melakukan verifikasi ulang pada periode berikutnya.' : 'Monitoring rutin dan kontrol standar tetap dijalankan.'
      };
    });
    const status = statuses[index % statuses.length];
    return {
      id: `demo-card-${DEMO_PERIOD.id}-${assignment.id}`,
      period_id: DEMO_PERIOD.id,
      employee_id: assignment.id,
      employee_name: assignment.full_name,
      department: assignment.department,
      role_id: role.id,
      role_title: displayRole(assignment, role),
      role_template_title: role.role,
      station: assignment.station || '',
      status,
      entries,
      calculated_score: calculateScore(role.metrics, entries),
      updated_at: '2026-06-25T10:00:00.000Z',
      submitted_at: ['submitted', 'approved'].includes(status) ? '2026-06-25T10:00:00.000Z' : null,
      team_leader_name: assignment.team_leader_name,
      reviewer_note: status === 'returned' ? 'Mohon lengkapi bukti dan perjelas corrective action sebelum diajukan ulang.' : (status === 'approved' ? 'Bukti monitoring sudah diverifikasi.' : '')
    };
  });
  setDemoCards(cards);
  return cards;
}
export function clearFullDemoScenario() { resetDemoData(); }

function configureTeamPage(context, people) {
  const self = context.workspaceType === 'self';
  $('#workspace-kicker') && ($('#workspace-kicker').textContent = self ? 'Self Reporting Workspace' : 'Team Leader Workspace');
  const title = $('#workspace-title');
  if (title) title.innerHTML = self ? 'Your role.<br><em>One monthly scorecard.</em>' : 'Your team.<br><em>One monthly scorecard.</em>';
  const intro = $('#workspace-intro');
  if (intro) intro.textContent = self
    ? 'Tambahkan nama dan peran Anda terlebih dahulu. Setelah peran dipilih, sistem otomatis menampilkan KPI yang tepat untuk scorecard bulan berjalan.'
    : 'Tambahkan setiap anggota tim dengan nama dan peran aktifnya. Nama serta peran wajib dipilih sebelum KPI card dibuat; template KPI otomatis mengikuti peran tersebut.';
  const label = $('#assignment-label');
  if (label) label.textContent = self ? 'Assigned role' : 'Assigned employees';
  const note = $('#team-structure-note');
  if (note) {
    note.innerHTML = `<strong>Role assignment first</strong>${people.length
      ? `Saat ini ada <b>${people.length}</b> card aktif di <b>${escapeHTML(context.department)}</b>. Untuk Operator Produksi, fungsi kerja seperti cutting, print, jahit, atau finishing wajib dipilih agar KPI sama tetapi identitas perannya tetap berbeda.`
      : `Belum ada nama yang ditetapkan untuk <b>${escapeHTML(context.department)}</b>. Tambahkan nama dan role di panel berikut untuk membuat KPI card.`}`;
  }
}

function assignmentBuilderMarkup(context, roleMaster, people) {
  const departmentRoles = roleMaster.filter(role => role.department === context.department);
  const self = context.workspaceType === 'self';
  return `<section class="assignment-builder" aria-labelledby="assignment-builder-title">
    <div class="assignment-builder-head"><div><div class="kicker">Step 1 · role assignment</div><h2 id="assignment-builder-title">${self ? 'Set your current role.' : 'Add name, assign role, create KPI card.'}</h2><p>${self ? 'Masukkan nama Anda dan pilih peran aktif. KPI card akan memakai template peran tersebut.' : 'Gunakan satu baris untuk satu orang. Banyak operator boleh memakai template KPI yang sama, tetapi wajib dibedakan melalui nama dan fungsi/operator station.'}</p></div><div class="assignment-count"><strong>${people.length}</strong><span>active role cards</span></div></div>
    <form class="assignment-form" id="assignment-form" novalidate>
      <div class="field assignment-name"><label for="assignment-name">Nama karyawan <b class="required">*</b></label><input id="assignment-name" name="employee_name" autocomplete="name" required placeholder="Contoh: Siti Rahma"></div>
      <div class="field assignment-role"><label for="assignment-role">Current role / KPI template <b class="required">*</b></label><select id="assignment-role" name="role_id" required><option value="">Pilih role aktif…</option>${departmentRoles.map(role => `<option value="${escapeHTML(role.id)}">${escapeHTML(role.role)}</option>`).join('')}</select></div>
      <div class="field station-field hidden" id="station-field"><label for="assignment-station">Fungsi operator saat ini <b class="required">*</b></label><select id="assignment-station" name="station"><option value="">Pilih fungsi operator…</option>${OPERATOR_STATIONS.map(station => `<option value="${escapeHTML(station)}">${escapeHTML(station)}</option>`).join('')}</select></div>
      <div class="assignment-action"><button type="submit" class="primary-btn">Add KPI card →</button></div>
    </form>
    <div class="assignment-help"><span><b>* Wajib diisi.</b> Role menentukan template KPI. Untuk Operator Produksi, fungsi kerja menentukan label card—bukan bobot KPI—sehingga beberapa operator tetap dapat memakai KPI yang sama secara jelas.</span>${people.length ? '<button type="button" class="table-action" id="clear-department-assignments">Clear this department</button>' : ''}</div>
  </section>`;
}

function removeDemoAssignment(id) {
  setDemoAssignments(getDemoAssignments().filter(assignment => assignment.id !== id));
  setDemoCards(getDemoCards().filter(card => card.employee_id !== id));
}

export async function initTeamDashboard() {
  const context = await requireRole(['team_leader']);
  if (!context) return;
  attachNav(context);
  $('#portal-user').textContent = context.profile.full_name + (isDemoMode ? ' · Demo' : '');
  const [roleMaster, periods] = await Promise.all([getRoleMaster(), getPeriods()]);
  const periodSelect = $('#period-select');
  periodSelect.innerHTML = periods.map(period => `<option value="${period.id}">${escapeHTML(monthLabel(period.month_start))} · ${escapeHTML(period.status)}</option>`).join('');
  let activePeriod = periods[0] || DEMO_PERIOD;
  let people = [];

  const renderBuilder = () => {
    const outlet = $('#assignment-builder');
    if (!outlet) return;
    if (!isDemoMode) {
      outlet.innerHTML = `<section class="assignment-builder"><div class="assignment-builder-head"><div><div class="kicker">Role assignment</div><h2>Live role assignment is managed by HR/Admin.</h2><p>Setelah Supabase aktif, Team Leader hanya melihat anggota yang sudah ditetapkan HR/Admin. Form pengaturan nama dan peran demo tidak ditampilkan di mode produksi.</p></div></div></section>`;
      return;
    }
    outlet.innerHTML = assignmentBuilderMarkup(context, roleMaster, people);
    const form = $('#assignment-form', outlet);
    const roleSelect = $('#assignment-role', outlet);
    const stationField = $('#station-field', outlet);
    const stationSelect = $('#assignment-station', outlet);
    const syncStation = () => {
      const isOperator = roleSelect.value === 'ops-operator';
      stationField.classList.toggle('hidden', !isOperator);
      stationSelect.required = isOperator;
      if (!isOperator) stationSelect.value = '';
    };
    roleSelect.addEventListener('change', syncStation);
    syncStation();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const name = $('#assignment-name', form).value.trim();
      const roleId = roleSelect.value;
      const station = stationSelect.value;
      const role = roleTemplate(roleId, roleMaster);
      if (!name || !role) {
        showToast('Nama karyawan dan current role wajib diisi.');
        return;
      }
      if (roleId === 'ops-operator' && !station) {
        showToast('Pilih fungsi operator untuk membedakan card Operator Produksi.');
        stationSelect.focus();
        return;
      }
      const duplicates = getDemoAssignments().filter(assignment => assignment.team_key === context.teamKey && canonical(assignment.full_name) === canonical(name));
      if (duplicates.length) {
        showToast('Nama tersebut sudah memiliki role card di departemen ini. Gunakan nama yang berbeda atau hapus card lama terlebih dahulu.');
        return;
      }
      const assignment = {
        id: uid('demo-person'),
        team_key: context.teamKey,
        department: context.department,
        full_name: name,
        role_id: roleId,
        station: roleId === 'ops-operator' ? station : '',
        team_leader_name: context.workspaceType === 'self' ? 'Self reporting · Owner review' : context.profile.full_name,
        created_at: new Date().toISOString()
      };
      setDemoAssignments([...getDemoAssignments(), assignment]);
      form.reset();
      showToast(`${name} berhasil ditambahkan dengan role ${displayRole(assignment, role)}.`);
      await render();
    });
    $('#clear-department-assignments', outlet)?.addEventListener('click', async () => {
      if (!confirm(`Hapus semua assignment dan KPI card demo untuk ${context.department}?`)) return;
      const ids = new Set(getDemoAssignments().filter(assignment => assignment.team_key === context.teamKey).map(assignment => assignment.id));
      setDemoAssignments(getDemoAssignments().filter(assignment => assignment.team_key !== context.teamKey));
      setDemoCards(getDemoCards().filter(card => !ids.has(card.employee_id)));
      showToast(`Role assignment ${context.department} dihapus dari demo.`);
      await render();
    });
  };

  async function render() {
    people = await getTeamData(context, roleMaster);
    configureTeamPage(context, people);
    renderBuilder();
    const cards = await getCardStatus(activePeriod.id, people);
    const statusByEmployee = new Map(cards.map(card => [isDemoMode ? card.employee_id : card.employee_role_id, card]));
    $('#team-grid').innerHTML = people.map(person => {
      const card = statusByEmployee.get(isDemoMode ? person.id : person.employee_role_id) || {};
      const score = card.calculated_score == null ? '—' : `${Number(card.calculated_score).toFixed(2)}%`;
      const station = person.assignment?.station ? `<div class="card-station">${escapeHTML(person.assignment.station)}</div>` : '';
      const remove = isDemoMode ? `<button class="card-remove" type="button" data-remove-assignment="${escapeHTML(person.id)}" aria-label="Hapus role card ${escapeHTML(person.full_name)}">Remove</button>` : '';
      return `<article class="team-card"><div class="card-topline"><div class="card-dept">${escapeHTML(person.role.department)}</div>${remove}</div><h3>${escapeHTML(person.full_name)}</h3><div class="card-role">${escapeHTML(person.role.role)}</div>${station}<div class="card-footer"><div>${statusPill(card.status || 'draft')}<br><span class="muted">Score: ${score}</span></div><button class="table-action" data-open-card="${escapeHTML(person.employee_role_id || person.id)}">Open Card</button></div></article>`;
    }).join('') || `<div class="empty"><strong>Belum ada card.</strong><br>Isi <em>Nama karyawan</em> dan pilih <em>Current role</em> di panel Role Assignment di atas. Setelah ditambahkan, KPI card akan menyesuaikan template KPI role tersebut.</div>`;
    const total = people.length;
    const submitted = cards.filter(card => ['submitted', 'approved', 'locked'].includes(card.status)).length;
    const returned = cards.filter(card => card.status === 'returned').length;
    const approved = cards.filter(card => ['approved', 'locked'].includes(card.status)).length;
    $('#team-total').textContent = total;
    $('#team-submitted').textContent = submitted;
    $('#team-returned').textContent = returned;
    $('#team-approved').textContent = approved;
    $$('[data-open-card]').forEach(button => button.addEventListener('click', () => openCard(button.dataset.openCard)));
    $$('[data-remove-assignment]').forEach(button => button.addEventListener('click', async () => {
      const person = people.find(item => item.id === button.dataset.removeAssignment);
      if (!person) return;
      if (!confirm(`Hapus ${person.full_name} dari role ${person.role.role}? Semua data card demo untuk orang ini juga akan dihapus.`)) return;
      removeDemoAssignment(person.id);
      showToast('Role card demo dihapus.');
      await render();
    }));
  }

  async function openCard(key) {
    const person = people.find(item => (item.employee_role_id || item.id) === key);
    if (!person) return;
    const existing = (await getCardStatus(activePeriod.id, [person]))[0] || {};
    const metrics = await getMetricsForRole(person.role);
    const existingEntries = existing.id ? await getCardEntries(existing.id) : (isDemoMode ? (existing.entries || []) : []);
    const byMetric = new Map(existingEntries.map(entry => [entry.metric_template_id, entry]));
    const modal = cardModalShell();
    $('#card-modal-kicker').textContent = `${person.role.department} · ${person.role.code || ''} · ${monthLabel(activePeriod.month_start)}`;
    $('#card-modal-title').textContent = `${person.full_name} — ${person.role.role}`;
    const readOnly = existing.status === 'locked';
    $('#card-modal-body').innerHTML = `<div class="assignment-summary"><div><span>Employee</span><strong>${escapeHTML(person.full_name)}</strong></div><div><span>Current role</span><strong>${escapeHTML(person.role.role)}</strong></div>${person.assignment?.station ? `<div><span>Operator function</span><strong>${escapeHTML(person.assignment.station)}</strong></div>` : ''}</div><div class="score-banner"><div><span>Estimated weighted score</span><strong id="live-score">0.00%</strong></div><div class="right"><span>Reviewer</span><br>${escapeHTML(person.role.reviewer || 'HR')}</div></div><div class="notice"><strong>Input rule</strong>Masukkan capaian (%) berdasarkan bukti monitoring. Pada fase awal ini, Team Leader memilih nilai capaian 0–120%; bobot aktif dan total skor dihitung otomatis. Setelah formula per KPI disahkan, field ini dapat dihitung langsung dari angka aktual.</div>${metrics.map((metric, index) => metricForm(metric, index, byMetric.get(metricKey(metric, index)) || {})).join('')}`;
    $('#card-modal-actions').innerHTML = readOnly
      ? `<div class="helper">Card ini sudah <b>Locked</b> dan tidak dapat diubah.</div><div class="action-group"><button type="button" class="secondary-btn" data-close-card>Close</button></div>`
      : `<div class="helper">Status saat ini: ${statusPill(existing.status || 'draft')} · Bukti URL wajib sebelum submit ke HR. Card yang sudah locked tidak dapat diedit.</div><div class="action-group"><button type="button" class="secondary-btn" data-save-draft>Save Draft</button><button type="button" class="primary-btn" data-submit-card>Submit for HR Review</button></div>`;
    modal.classList.add('open');
    bindScorePreview(metrics);
    if (readOnly) {
      $$('.metric-card input,.metric-card textarea').forEach(element => element.setAttribute('disabled', 'disabled'));
      $('[data-close-card]', '#card-modal-actions')?.addEventListener('click', closeCardModal);
      return;
    }
    $('[data-save-draft]')?.addEventListener('click', async () => {
      try {
        await saveCard({ context, period: activePeriod, person, metrics, status: 'draft' });
        showToast('Draft KPI tersimpan.');
        closeCardModal();
        await render();
      } catch (error) { showToast(error.message || String(error)); }
    });
    $('[data-submit-card]')?.addEventListener('click', async () => {
      try {
        await saveCard({ context, period: activePeriod, person, metrics, status: 'submitted' });
        showToast('KPI card dikirim ke HR untuk review.');
        closeCardModal();
        await render();
      } catch (error) { showToast(error.message || String(error)); }
    });
  }

  periodSelect.addEventListener('change', async () => {
    activePeriod = periods.find(period => period.id === periodSelect.value) || activePeriod;
    await render();
  });
  await render();
}

async function getReviewRows(periodId) {
  if (isDemoMode) {
    return getDemoCards().filter(card => card.period_id === periodId).map(card => ({
      ...card,
      department_name: card.department || '—',
      role_title: card.role_title || '—',
      full_name: card.employee_name,
      card_id: card.id
    }));
  }
  const { data, error } = await supabase.from('monthly_card_overview').select('*').eq('period_id', periodId).order('department_name').order('employee_name');
  if (error) throw error;
  return data || [];
}
async function getReviewDetail(row) {
  if (isDemoMode) {
    const master = await getRoleMaster();
    const role = roleTemplate(row.role_id, master);
    return { row, person: { full_name: row.employee_name, role }, metrics: role?.metrics || [], entries: row.entries || [] };
  }
  const [{ data: entries, error: entryError }, { data: metrics, error: metricError }] = await Promise.all([
    supabase.from('monthly_kpi_entries').select('*, metric:metric_templates(*)').eq('card_id', row.card_id),
    supabase.from('metric_templates').select('*').eq('role_definition_id', row.role_definition_id).eq('active', true).order('sort_order')
  ]);
  if (entryError) throw entryError;
  if (metricError) throw metricError;
  return { row, metrics: metrics || [], entries: entries || [] };
}
async function reviewCard(row, action, note) {
  if (isDemoMode) {
    const cards = getDemoCards();
    const index = cards.findIndex(card => card.id === (row.id || row.card_id));
    if (index >= 0) {
      cards[index].status = action === 'approve' ? 'approved' : 'returned';
      cards[index].reviewer_note = note;
      cards[index].reviewed_at = new Date().toISOString();
      setDemoCards(cards);
    }
    return;
  }
  const { error } = await supabase.rpc('review_monthly_card', { p_card_id: row.card_id, p_action: action === 'approve' ? 'approve' : 'return', p_note: note });
  if (error) throw error;
}
function setupDemoDataActions(render) {
  const load = $('#load-demo-scenario');
  const reset = $('#reset-demo-scenario');
  if (!isDemoMode) { load?.remove(); reset?.remove(); return; }
  load?.addEventListener('click', async () => {
    if (!confirm('Muat contoh organisasi lengkap untuk 5 departemen? Assignment dan KPI card demo saat ini akan diganti.')) return;
    await loadFullDemoScenario({ overwrite: true });
    showToast('Contoh role assignment dan KPI Juni 2026 berhasil dimuat.');
    await render();
  });
  reset?.addEventListener('click', async () => {
    if (!confirm('Hapus semua role assignment dan data KPI demo?')) return;
    clearFullDemoScenario();
    showToast('Role assignment dan data KPI demo dihapus.');
    await render();
  });
}

export async function initReviewDashboard() {
  const context = await requireRole(['hr', 'owner', 'admin']);
  if (!context) return;
  attachNav(context);
  $('#portal-user').textContent = context.profile.full_name + (isDemoMode ? ' · Demo' : '');
  const periods = await getPeriods();
  let activePeriod = periods[0] || DEMO_PERIOD;
  const select = $('#period-select');
  select.innerHTML = periods.map(period => `<option value="${period.id}">${escapeHTML(monthLabel(period.month_start))} · ${escapeHTML(period.status)}</option>`).join('');
  const departmentFilter = $('#review-department-filter');
  async function render() {
    const allRows = await getReviewRows(activePeriod.id);
    const selected = departmentFilter?.value || 'all';
    const rows = selected === 'all' ? allRows : allRows.filter(row => (row.department_name || row.department) === selected);
    const byStatus = status => rows.filter(row => row.status === status).length;
    $('#review-total').textContent = rows.length;
    $('#review-submitted').textContent = byStatus('submitted');
    $('#review-returned').textContent = byStatus('returned');
    $('#review-approved').textContent = rows.filter(row => ['approved', 'locked'].includes(row.status)).length;
    $('#review-table-body').innerHTML = rows.map(row => `<tr><td>${escapeHTML(row.department_name || row.department || '—')}</td><td><strong>${escapeHTML(row.employee_name || row.full_name || '—')}</strong><br><span class="muted">${escapeHTML(row.role_title || '')}</span></td><td>${escapeHTML(row.team_leader_name || '—')}</td><td>${statusPill(row.status)}</td><td>${row.calculated_score == null ? '—' : Number(row.calculated_score).toFixed(2) + '%'}</td><td>${row.submitted_at ? new Date(row.submitted_at).toLocaleDateString('id-ID') : '—'}</td><td><button class="table-action" data-review-card="${escapeHTML(row.card_id || row.id)}">Review</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Belum ada KPI card pada periode ini.</td></tr>';
    $$('[data-review-card]').forEach(button => button.addEventListener('click', () => openReview(allRows.find(row => (row.card_id || row.id) === button.dataset.reviewCard))));
  }
  async function openReview(row) {
    if (!row) return;
    const detail = await getReviewDetail(row);
    const modal = cardModalShell();
    $('#card-modal-kicker').textContent = `HR Review · ${row.department_name || row.department || ''} · ${monthLabel(activePeriod.month_start)}`;
    $('#card-modal-title').textContent = `${row.employee_name || row.full_name} — Review KPI`;
    const byMetric = new Map(detail.entries.map(entry => [entry.metric_template_id, entry]));
    $('#card-modal-body').innerHTML = `<div class="assignment-summary"><div><span>Employee</span><strong>${escapeHTML(row.employee_name || row.full_name || '—')}</strong></div><div><span>Current role</span><strong>${escapeHTML(row.role_title || '')}</strong></div></div><div class="score-banner"><div><span>Calculated monthly score</span><strong>${Number(row.calculated_score || 0).toFixed(2)}%</strong></div><div class="right"><span>Status</span><br>${statusPill(row.status)}</div></div>${detail.metrics.map((metric, index) => metricForm(metric, index, byMetric.get(metricKey(metric, index)) || {})).join('')}<div class="panel"><h3>HR Reviewer Note</h3><textarea class="review-note" id="review-note" placeholder="Catatan review, data yang perlu diperbaiki, atau alasan approval…">${escapeHTML(row.reviewer_note || '')}</textarea></div>`;
    $$('.metric-card input,.metric-card textarea').forEach(element => element.setAttribute('disabled', 'disabled'));
    const locked = row.status === 'locked';
    $('#card-modal-actions').innerHTML = locked
      ? `<div class="helper">Card ini telah dikunci Owner dan tidak dapat diubah.</div><div class="action-group"><button class="secondary-btn" data-close-card>Close</button></div>`
      : `<div class="helper">HR memeriksa bukti, capaian, root cause, dan corrective action. Return mengirim card kembali ke Team Leader.</div><div class="action-group"><button class="secondary-btn" data-return-card>Return for Revision</button><button class="primary-btn" data-approve-card>Approve</button></div>`;
    modal.classList.add('open');
    if (locked) {
      $('[data-close-card]', '#card-modal-actions')?.addEventListener('click', closeCardModal);
      return;
    }
    $('[data-return-card]').addEventListener('click', async () => {
      try { await reviewCard(row, 'return', $('#review-note').value.trim()); showToast('KPI card dikembalikan ke Team Leader.'); closeCardModal(); await render(); } catch (error) { showToast(error.message || String(error)); }
    });
    $('[data-approve-card]').addEventListener('click', async () => {
      try { await reviewCard(row, 'approve', $('#review-note').value.trim()); showToast('KPI card disetujui HR.'); closeCardModal(); await render(); } catch (error) { showToast(error.message || String(error)); }
    });
  }
  departmentFilter?.addEventListener('change', render);
  select.addEventListener('change', async () => { activePeriod = periods.find(period => period.id === select.value) || activePeriod; await render(); });
  setupDemoDataActions(render);
  await render();
}

async function getOwnerSummary(periodId) {
  if (isDemoMode) {
    const rows = await getReviewRows(periodId);
    return DEMO_DEPARTMENTS.map(departmentName => {
      const departmentRows = rows.filter(row => (row.department_name || row.department) === departmentName);
      const approved = departmentRows.filter(row => ['approved', 'locked'].includes(row.status));
      return {
        department_name: departmentName,
        total_cards: departmentRows.length,
        submitted_cards: departmentRows.filter(row => ['submitted', 'approved', 'locked'].includes(row.status)).length,
        approved_cards: approved.length,
        returned_cards: departmentRows.filter(row => row.status === 'returned').length,
        average_score: approved.length ? approved.reduce((sum, row) => sum + Number(row.calculated_score || 0), 0) / approved.length : null
      };
    });
  }
  const { data, error } = await supabase.from('monthly_department_summary').select('*').eq('period_id', periodId).order('department_name');
  if (error) throw error;
  return data || [];
}
async function lockPeriod(periodId) {
  if (isDemoMode) {
    const cards = getDemoCards().filter(card => card.period_id === periodId);
    const incomplete = cards.filter(card => ['draft', 'submitted', 'returned'].includes(card.status));
    if (incomplete.length) throw new Error(`Belum bisa lock: ${incomplete.length} card masih Draft, Submitted, atau Returned.`);
    setDemoCards(getDemoCards().map(card => card.period_id === periodId ? { ...card, status: 'locked', locked_at: new Date().toISOString() } : card));
    return;
  }
  const { error } = await supabase.rpc('lock_reporting_period', { p_period_id: periodId });
  if (error) throw error;
}
async function exportXlsx(periodId, periodLabel) {
  let rows = [];
  if (isDemoMode) {
    rows = (await getReviewRows(periodId)).flatMap(card => (card.entries || []).map(entry => ({
      Period: periodLabel,
      Department: card.department_name || card.department,
      Employee: card.employee_name,
      Role: card.role_title,
      'Operator Function': card.station || '',
      Team_Leader: card.team_leader_name,
      Status: card.status,
      Score: card.calculated_score,
      'Metric ID': entry.metric_template_id,
      'Achievement %': entry.achievement_percent,
      'Actual Summary': entry.actual_summary,
      'Evidence URL': entry.evidence_url,
      'Root Cause': entry.root_cause,
      'Corrective Action': entry.corrective_action,
      'HR Reviewer Note': card.reviewer_note || ''
    })));
  } else {
    const { data, error } = await supabase.from('monthly_entry_export_view').select('*').eq('period_id', periodId);
    if (error) throw error;
    rows = data || [];
  }
  if (!rows.length) { showToast('Belum ada data KPI untuk diekspor.'); return; }
  if (!window.XLSX) { showToast('Library Excel belum termuat. Coba refresh halaman.'); return; }
  const workbook = window.XLSX.utils.book_new();
  const detail = window.XLSX.utils.json_to_sheet(rows);
  window.XLSX.utils.book_append_sheet(workbook, detail, 'KPI Monthly Detail');
  const summary = await getOwnerSummary(periodId);
  const summarySheet = window.XLSX.utils.json_to_sheet(summary.map(row => ({
    Department: row.department_name,
    'Total Cards': row.total_cards,
    Submitted: row.submitted_cards,
    Approved: row.approved_cards,
    Returned: row.returned_cards,
    'Average Score': row.average_score == null ? '' : Number(row.average_score).toFixed(2) + '%'
  })));
  window.XLSX.utils.book_append_sheet(workbook, summarySheet, 'Department Summary');
  window.XLSX.writeFile(workbook, `PGE_KPI_Monthly_Report_${periodLabel.replace(/\s+/g, '_')}.xlsx`);
}
export async function initOwnerDashboard() {
  const context = await requireRole(['owner', 'admin']);
  if (!context) return;
  attachNav(context);
  $('#portal-user').textContent = context.profile.full_name + (isDemoMode ? ' · Demo' : '');
  const periods = await getPeriods();
  let activePeriod = periods[0] || DEMO_PERIOD;
  const select = $('#period-select');
  select.innerHTML = periods.map(period => `<option value="${period.id}">${escapeHTML(monthLabel(period.month_start))} · ${escapeHTML(period.status)}</option>`).join('');
  async function render() {
    const rows = await getOwnerSummary(activePeriod.id);
    const total = rows.reduce((sum, row) => sum + Number(row.total_cards || 0), 0);
    const approved = rows.reduce((sum, row) => sum + Number(row.approved_cards || 0), 0);
    const returned = rows.reduce((sum, row) => sum + Number(row.returned_cards || 0), 0);
    const averageRows = rows.filter(row => row.average_score != null);
    const average = averageRows.length ? averageRows.reduce((sum, row) => sum + Number(row.average_score), 0) / averageRows.length : 0;
    $('#owner-total').textContent = total;
    $('#owner-approved').textContent = approved;
    $('#owner-returned').textContent = returned;
    $('#owner-score').textContent = `${average.toFixed(2)}%`;
    $('#owner-table-body').innerHTML = rows.map(row => `<tr><td><strong>${escapeHTML(row.department_name)}</strong></td><td>${row.total_cards || 0}</td><td>${row.submitted_cards || 0}</td><td>${row.approved_cards || 0}</td><td>${row.returned_cards || 0}</td><td>${row.average_score == null ? '—' : Number(row.average_score).toFixed(2) + '%'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Belum ada data.</td></tr>';
  }
  $('#lock-period').addEventListener('click', async () => {
    if (!confirm(`Lock periode ${monthLabel(activePeriod.month_start)}? Card yang locked tidak dapat diedit.`)) return;
    try { await lockPeriod(activePeriod.id); showToast('Periode berhasil dikunci.'); await render(); } catch (error) { showToast(error.message || String(error)); }
  });
  $('#export-report').addEventListener('click', () => exportXlsx(activePeriod.id, monthLabel(activePeriod.month_start)));
  select.addEventListener('change', async () => { activePeriod = periods.find(period => period.id === select.value) || activePeriod; await render(); });
  setupDemoDataActions(render);
  await render();
}
