
import {supabase,isDemoMode,requireRole,getCurrentUserContext,signOut,showToast,monthLabel,formatStatus,getDemoRole} from './auth.js';

const rolesUrl='./data/kpi_roles.json';
const DEMO_PERIOD={id:'demo-jun-2026',month_start:'2026-06-01',status:'open'};
const DEMO_TEAM=[
  {id:'demo-op-01',full_name:'Operator Produksi A',roleId:'ops-operator',department:'Operations'},
  {id:'demo-op-02',full_name:'Operator Produksi B',roleId:'ops-operator',department:'Operations'},
  {id:'demo-qc-01',full_name:'Staff QC',roleId:'ops-qc',department:'Operations'},
  {id:'demo-gudang-01',full_name:'Staff Gudang',roleId:'ops-gudang',department:'Operations'},
  {id:'demo-head-01',full_name:'Kepala Produksi',roleId:'ops-head-prod',department:'Operations'}
];
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escapeHTML=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function getRoleMaster(){
  const response=await fetch(rolesUrl);
  if(!response.ok) throw new Error('KPI role master tidak dapat dimuat.');
  return response.json();
}
function getDemoCards(){ return JSON.parse(localStorage.getItem('pge_demo_cards')||'[]'); }
function setDemoCards(cards){ localStorage.setItem('pge_demo_cards',JSON.stringify(cards)); }
function findDemoCard(periodId,employeeId){ return getDemoCards().find(c=>c.period_id===periodId&&c.employee_id===employeeId); }
function saveDemoCard(card){ const cards=getDemoCards().filter(c=>!(c.period_id===card.period_id&&c.employee_id===card.employee_id)); cards.push(card); setDemoCards(cards); }

function navMarkup(active,context){
  return `<header class="app-header"><nav class="app-nav" aria-label="Portal navigation"><a class="brand" href="index.html"><span class="brand-mark">PGE</span><span><span class="brand-title">AOS / Performance Portal</span><span class="brand-sub">KPI Monthly Workflow</span></span></a><div class="nav-menu"><a href="index.html">Hub</a><a href="kpi.html">KPI Info</a><a class="${active==='team'?'active':''}" href="team-dashboard.html">Team</a><a class="${active==='review'?'active':''}" href="review.html">HR Review</a><a class="${active==='owner'?'active':''}" href="owner-dashboard.html">Owner</a><button type="button" id="logout-button" class="portal-link">Logout</button></div></nav></header>`;
}
function attachNav(context){
  const outlet=$('#portal-nav'); if(outlet) outlet.innerHTML=navMarkup(document.body.dataset.page||'',context);
  $('#logout-button')?.addEventListener('click',signOut);
  const label=$('#portal-user');
  if(label) label.textContent=context?.profile?.full_name||context?.user?.email||'User';
}
function statusPill(status){ return `<span class="status ${escapeHTML(status)}">${escapeHTML(formatStatus(status))}</span>`; }

function metricForm(metric,index,entry={}){
  const target=metric.target||metric.target_text||'-';
  const phase=metric.phase||metric.title||`KPI ${index+1}`;
  const weight=Number(metric.weight||0).toFixed(2).replace(/\.00$/,'');
  const achievement=entry.achievement_percent ?? '';
  return `<article class="metric-card" data-metric-index="${index}" data-metric-id="${escapeHTML(metric.id||metric.metric_id||'')}">
    <div class="metric-head"><div class="metric-no">${String(index+1).padStart(2,'0')}</div><div><div class="metric-title">${escapeHTML(phase)}</div><div class="metric-meta">Target baseline: ${escapeHTML(target)}<br>Frekuensi: ${escapeHTML(metric.frequency||'Bulanan')}</div></div><span class="weight-badge">${weight}%</span></div>
    <div class="metric-content"><div class="metric-target"><strong>Objective / Evidence</strong>${escapeHTML(metric.objective||'').replace(/\n/g,'<br>')}<br><br><strong>Bukti monitoring</strong>${escapeHTML(metric.evidence||'Evidence link wajib saat submit.')}</div>
    <div class="metric-form"><div class="field"><label>Capaian (%)</label><input class="metric-input input-achievement" type="number" min="0" max="120" step="0.01" value="${escapeHTML(achievement)}" placeholder="0–120"></div><div class="field"><label>Actual / Ringkasan</label><input class="metric-input input-actual" value="${escapeHTML(entry.actual_summary||'')}" placeholder="Hasil aktual"></div><div class="field wide"><label>Evidence URL</label><input class="metric-input input-evidence" type="url" value="${escapeHTML(entry.evidence_url||'')}" placeholder="https://drive.google.com/... "></div><div class="field"><label>Root cause (bila < target)</label><textarea class="input-root">${escapeHTML(entry.root_cause||'')}</textarea></div><div class="field"><label>Corrective action</label><textarea class="input-action">${escapeHTML(entry.corrective_action||'')}</textarea></div></div></div></article>`;
}
function calculateScore(metrics,entries){
  return metrics.reduce((total,m,index)=>{const v=Number(entries[index]?.achievement_percent||0);return total+(v*Number(m.weight||0)/100)},0);
}
function cardModalShell(){
  let modal=$('#card-modal');
  if(modal) return modal;
  modal=document.createElement('div'); modal.id='card-modal'; modal.className='modal';
  modal.innerHTML='<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="card-modal-title"><div class="modal-head"><div><div class="modal-kicker" id="card-modal-kicker"></div><h2 id="card-modal-title"></h2></div><button class="modal-close" type="button" data-close-card>Close</button></div><div class="modal-body" id="card-modal-body"></div><div class="modal-actions" id="card-modal-actions"></div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeCardModal();});
  modal.querySelector('[data-close-card]').addEventListener('click',closeCardModal);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCardModal();});
  return modal;
}
function closeCardModal(){ $('#card-modal')?.classList.remove('open'); }
function bindScorePreview(metrics){
  const update=()=>{const entries=$$('.metric-card').map(card=>({achievement_percent:$('.input-achievement',card)?.value||0})); const score=calculateScore(metrics,entries); const scoreEl=$('#live-score'); if(scoreEl)scoreEl.textContent=`${score.toFixed(2)}%`;};
  $$('.input-achievement').forEach(input=>input.addEventListener('input',update)); update();
}
function collectEntries(metrics){
  return $$('.metric-card').map((card,index)=>({metric_template_id:card.dataset.metricId||metrics[index].id||metrics[index].metric_id,achievement_percent:Number($('.input-achievement',card).value||0),actual_summary:$('.input-actual',card).value.trim(),evidence_url:$('.input-evidence',card).value.trim(),root_cause:$('.input-root',card).value.trim(),corrective_action:$('.input-action',card).value.trim()}));
}

async function getPeriods(){
  if(isDemoMode) return [DEMO_PERIOD];
  const {data,error}=await supabase.from('reporting_periods').select('*').order('month_start',{ascending:false}); if(error) throw error; return data||[];
}
async function getTeamData(context,roleMaster){
  if(isDemoMode) return DEMO_TEAM.map(e=>({...e,role:roleMaster.find(r=>r.id===e.roleId),employee_role_id:e.id}));
  const {data:assignments,error}=await supabase.from('team_assignments').select('employee_id').eq('team_leader_id',context.user.id).is('effective_to',null); if(error) throw error;
  const employeeIds=[...new Set([context.user.id,...(assignments||[]).map(a=>a.employee_id)])];
  const [{data:profiles,error:profileError},{data:roles,error:roleError}]=await Promise.all([
    supabase.from('profiles').select('id,full_name').in('id',employeeIds),
    supabase.from('employee_role_assignments').select('id,employee_id,role_definition:role_definitions(id,code,title,department:departments(name),capacity,reviewer_role,scope)').in('employee_id',employeeIds).is('ended_at',null)
  ]);
  if(profileError) throw profileError; if(roleError) throw roleError;
  return (roles||[]).map(er=>{const p=(profiles||[]).find(x=>x.id===er.employee_id)||{}; return {employee_role_id:er.id,id:er.employee_id,full_name:p.full_name||'Unnamed employee',role:{id:er.role_definition.id,code:er.role_definition.code,role:er.role_definition.title,department:er.role_definition.department?.name||'',capacity:er.role_definition.capacity,reviewer:er.role_definition.reviewer_role,scope:er.role_definition.scope}};});
}
async function getCardStatus(periodId,people){
  if(isDemoMode){return people.map(p=>findDemoCard(periodId,p.id)||{period_id:periodId,employee_id:p.id,status:'draft',calculated_score:null});}
  const ids=people.map(p=>p.employee_role_id);
  const {data,error}=await supabase.from('monthly_kpi_cards').select('id,period_id,employee_role_id,status,calculated_score,reviewer_note').eq('period_id',periodId).in('employee_role_id',ids); if(error) throw error;
  return data||[];
}
async function getMetricsForRole(role){
  if(isDemoMode) return role.metrics || [];
  const {data,error}=await supabase.from('metric_templates').select('*').eq('role_definition_id',role.id).eq('active',true).order('sort_order'); if(error) throw error; return data||[];
}
async function getCardEntries(cardId){
  if(isDemoMode) return getDemoCards().find(c=>c.id===cardId)?.entries||[];
  if(!cardId) return [];
  const {data,error}=await supabase.from('monthly_kpi_entries').select('*').eq('card_id',cardId); if(error) throw error; return data||[];
}
async function saveCard({context,period,person,metrics,status}){
  const entries=collectEntries(metrics);
  const missingActual=entries.some(e=>e.achievement_percent<0||e.achievement_percent>120||Number.isNaN(e.achievement_percent));
  if(missingActual) throw new Error('Capaian harus berada antara 0% sampai 120%.');
  if(status==='submitted' && entries.some(e=>!e.evidence_url)) throw new Error('Evidence URL wajib diisi sebelum submit untuk HR review.');
  if(isDemoMode){
    const old=findDemoCard(period.id,person.id)||{};
    const card={...old,id:old.id||`demo-card-${period.id}-${person.id}`,period_id:period.id,employee_id:person.id,employee_name:person.full_name,role_id:person.role.id,status,entries,calculated_score:calculateScore(metrics,entries),updated_at:new Date().toISOString(),team_leader_name:context.profile.full_name};
    saveDemoCard(card); return card;
  }
  const {data:card,error:cardError}=await supabase.from('monthly_kpi_cards').upsert({period_id:period.id,employee_role_id:person.employee_role_id,team_leader_id:context.user.id,status:status==='submitted'?'draft':status},{onConflict:'period_id,employee_role_id'}).select().single();
  if(cardError) throw cardError;
  const payload=entries.map(e=>({...e,card_id:card.id}));
  const {error:entriesError}=await supabase.from('monthly_kpi_entries').upsert(payload,{onConflict:'card_id,metric_template_id'}); if(entriesError) throw entriesError;
  if(status==='submitted'){const {error}=await supabase.rpc('submit_monthly_card',{p_card_id:card.id}); if(error) throw error;}
  return card;
}

export async function initTeamDashboard(){
  const context=await requireRole(['team_leader','hr','owner','admin']); if(!context)return;
  attachNav(context); $('#portal-user').textContent=context.profile.full_name + (isDemoMode?' · Demo':'');
  const [roleMaster,periods]=await Promise.all([getRoleMaster(),getPeriods()]);
  const periodSelect=$('#period-select');
  periodSelect.innerHTML=periods.map(p=>`<option value="${p.id}">${escapeHTML(monthLabel(p.month_start))} · ${escapeHTML(p.status)}</option>`).join('');
  let people=await getTeamData(context,roleMaster);
  let activePeriod=periods[0]||DEMO_PERIOD;
  async function render(){
    const cards=await getCardStatus(activePeriod.id,people);
    const statusByEmployee=new Map(cards.map(c=>[isDemoMode?c.employee_id:c.employee_role_id,c]));
    $('#team-grid').innerHTML=people.map(person=>{const card=statusByEmployee.get(isDemoMode?person.id:person.employee_role_id)||{};const score=card.calculated_score==null?'—':`${Number(card.calculated_score).toFixed(2)}%`;return `<article class="team-card"><div class="card-dept">${escapeHTML(person.role.department)}</div><h3>${escapeHTML(person.full_name)}</h3><div class="card-role">${escapeHTML(person.role.role)}</div><div class="card-footer"><div>${statusPill(card.status||'draft')}<br><span class="muted">Score: ${score}</span></div><button class="table-action" data-open-card="${escapeHTML(person.employee_role_id||person.id)}">Open Card</button></div></article>`;}).join('')||'<div class="empty">Belum ada anggota tim yang terhubung. HR/Admin perlu membuat team assignment di Supabase.</div>';
    const total=people.length,submitted=cards.filter(c=>['submitted','approved','locked'].includes(c.status)).length,returned=cards.filter(c=>c.status==='returned').length,approved=cards.filter(c=>['approved','locked'].includes(c.status)).length;
    $('#team-total').textContent=total; $('#team-submitted').textContent=submitted; $('#team-returned').textContent=returned; $('#team-approved').textContent=approved;
    $$('[data-open-card]').forEach(btn=>btn.addEventListener('click',()=>openCard(btn.dataset.openCard)));
  }
  async function openCard(key){
    const person=people.find(p=>(p.employee_role_id||p.id)===key); if(!person)return;
    const existing=(await getCardStatus(activePeriod.id,[person]))[0]||{};
    const metrics=await getMetricsForRole(person.role);
    const existingEntries=existing.id?await getCardEntries(existing.id):(isDemoMode?(existing.entries||[]):[]);
    const byMetric=new Map(existingEntries.map(e=>[e.metric_template_id,e]));
    const modal=cardModalShell();
    $('#card-modal-kicker').textContent=`${person.role.department} · ${person.role.code||''} · ${monthLabel(activePeriod.month_start)}`;
    $('#card-modal-title').textContent=`${person.full_name} — ${person.role.role}`;
    $('#card-modal-body').innerHTML=`<div class="score-banner"><div><span>Estimated weighted score</span><strong id="live-score">0.00%</strong></div><div class="right"><span>Reviewer</span><br>${escapeHTML(person.role.reviewer||'HR')}</div></div><div class="notice"><strong>Input rule</strong>Masukkan capaian (%) berdasarkan bukti monitoring. Pada fase awal ini, Team Leader memilih nilai capaian 0–120%; bobot aktif dan total skor dihitung otomatis. Setelah master formula per KPI disahkan, field ini dapat dihitung langsung dari angka aktual.</div>${metrics.map((m,i)=>metricForm(m,i,byMetric.get(m.id)||{})).join('')}`;
    $('#card-modal-actions').innerHTML=`<div class="helper">Status saat ini: ${statusPill(existing.status||'draft')} · Bukti URL wajib sebelum submit ke HR. Card yang sudah locked tidak dapat diedit.</div><div class="action-group"><button type="button" class="secondary-btn" data-save-draft>Save Draft</button><button type="button" class="primary-btn" data-submit-card>Submit for HR Review</button></div>`;
    modal.classList.add('open'); bindScorePreview(metrics);
    $('[data-save-draft]').addEventListener('click',async()=>{try{await saveCard({context,period:activePeriod,person,metrics,status:'draft'});showToast('Draft KPI tersimpan.');closeCardModal();await render();}catch(err){showToast(err.message||String(err));}});
    $('[data-submit-card]').addEventListener('click',async()=>{try{await saveCard({context,period:activePeriod,person,metrics,status:'submitted'});showToast('KPI card dikirim ke HR untuk review.');closeCardModal();await render();}catch(err){showToast(err.message||String(err));}});
  }
  periodSelect.addEventListener('change',async()=>{activePeriod=periods.find(p=>p.id===periodSelect.value)||activePeriod;await render();});
  await render();
}

async function getReviewRows(periodId){
  if(isDemoMode){return getDemoCards().filter(c=>c.period_id===periodId).map(c=>({...c,department:'Operations',role_title:DEMO_TEAM.find(p=>p.id===c.employee_id)?.roleId||'',full_name:c.employee_name,team_leader_name:c.team_leader_name||'Kepala Produksi (Demo)'}));}
  const {data,error}=await supabase.from('monthly_card_overview').select('*').eq('period_id',periodId).order('department_name').order('employee_name');if(error)throw error;return data||[];
}
async function getReviewDetail(row){
  if(isDemoMode){const person=DEMO_TEAM.find(p=>p.id===row.employee_id);const master=await getRoleMaster();const role=master.find(r=>r.id===person.roleId);return {row,person:{full_name:row.employee_name,role},metrics:role.metrics,entries:row.entries||[]};}
  const [{data:entries,error:entryError},{data:metrics,error:metricError}]=await Promise.all([
    supabase.from('monthly_kpi_entries').select('*, metric:metric_templates(*)').eq('card_id',row.card_id),
    supabase.from('metric_templates').select('*').eq('role_definition_id',row.role_definition_id).eq('active',true).order('sort_order')
  ]);if(entryError)throw entryError;if(metricError)throw metricError;return {row,metrics:metrics||[],entries:entries||[]};
}
async function reviewCard(row,action,note){
  if(isDemoMode){const cards=getDemoCards();const i=cards.findIndex(c=>c.id===row.id||c.id===row.card_id);if(i>=0){cards[i].status=action==='approve'?'approved':'returned';cards[i].reviewer_note=note;setDemoCards(cards);}return;}
  const {error}=await supabase.rpc('review_monthly_card',{p_card_id:row.card_id,p_action:action==='approve'?'approve':'return',p_note:note});if(error)throw error;
}
export async function initReviewDashboard(){
  const context=await requireRole(['hr','owner','admin']);if(!context)return;attachNav(context);$('#portal-user').textContent=context.profile.full_name+(isDemoMode?' · Demo':'');
  const periods=await getPeriods();let activePeriod=periods[0]||DEMO_PERIOD;const select=$('#period-select');select.innerHTML=periods.map(p=>`<option value="${p.id}">${escapeHTML(monthLabel(p.month_start))} · ${escapeHTML(p.status)}</option>`).join('');
  async function render(){const rows=await getReviewRows(activePeriod.id);const byStatus=s=>rows.filter(r=>r.status===s).length;$('#review-total').textContent=rows.length;$('#review-submitted').textContent=byStatus('submitted');$('#review-returned').textContent=byStatus('returned');$('#review-approved').textContent=rows.filter(r=>['approved','locked'].includes(r.status)).length;$('#review-table-body').innerHTML=rows.map(row=>`<tr><td>${escapeHTML(row.department_name||row.department||'—')}</td><td><strong>${escapeHTML(row.employee_name||row.full_name||'—')}</strong><br><span class="muted">${escapeHTML(row.role_title||'')}</span></td><td>${escapeHTML(row.team_leader_name||'—')}</td><td>${statusPill(row.status)}</td><td>${row.calculated_score==null?'—':Number(row.calculated_score).toFixed(2)+'%'}</td><td>${row.submitted_at?new Date(row.submitted_at).toLocaleDateString('id-ID'):'—'}</td><td><button class="table-action" data-review-card="${escapeHTML(row.card_id||row.id)}">Review</button></td></tr>`).join('')||'<tr><td colspan="7" class="muted">Belum ada KPI card pada periode ini.</td></tr>';$$('[data-review-card]').forEach(btn=>btn.addEventListener('click',()=>openReview(rows.find(r=>(r.card_id||r.id)===btn.dataset.reviewCard))));}
  async function openReview(row){if(!row)return;const detail=await getReviewDetail(row);const modal=cardModalShell();$('#card-modal-kicker').textContent=`HR Review · ${row.department_name||row.department||''} · ${monthLabel(activePeriod.month_start)}`;$('#card-modal-title').textContent=`${row.employee_name||row.full_name} — Review KPI`;const byMetric=new Map(detail.entries.map(e=>[e.metric_template_id,e]));$('#card-modal-body').innerHTML=`<div class="score-banner"><div><span>Calculated monthly score</span><strong>${Number(row.calculated_score||0).toFixed(2)}%</strong></div><div class="right"><span>Status</span><br>${statusPill(row.status)}</div></div>${detail.metrics.map((m,i)=>metricForm(m,i,byMetric.get(m.id)||{})).join('')}<div class="panel"><h3>HR Reviewer Note</h3><textarea class="review-note" id="review-note" placeholder="Catatan review, data yang perlu diperbaiki, atau alasan approval…">${escapeHTML(row.reviewer_note||'')}</textarea></div>`;$$('.metric-card input,.metric-card textarea').forEach(el=>el.setAttribute('disabled','disabled'));$('#card-modal-actions').innerHTML=`<div class="helper">HR memeriksa bukti, capaian, root cause, dan corrective action. Return mengirim card kembali ke Team Leader.</div><div class="action-group"><button class="secondary-btn" data-return-card>Return for Revision</button><button class="primary-btn" data-approve-card>Approve</button></div>`;modal.classList.add('open');$('[data-return-card]').addEventListener('click',async()=>{try{await reviewCard(row,'return',$('#review-note').value.trim());showToast('KPI card dikembalikan ke Team Leader.');closeCardModal();await render();}catch(err){showToast(err.message||String(err));}});$('[data-approve-card]').addEventListener('click',async()=>{try{await reviewCard(row,'approve',$('#review-note').value.trim());showToast('KPI card disetujui HR.');closeCardModal();await render();}catch(err){showToast(err.message||String(err));}});}
  select.addEventListener('change',async()=>{activePeriod=periods.find(p=>p.id===select.value)||activePeriod;await render();});await render();
}

async function getOwnerSummary(periodId){
  if(isDemoMode){const rows=await getReviewRows(periodId);const departments=['Operations','Sales & Marketing','Research & Development','Finance, Accounting & Tax','HRD GA'];return departments.map(d=>{const rs=rows.filter(r=>(r.department_name||r.department)===d);const approved=rs.filter(r=>['approved','locked'].includes(r.status));return{department_name:d,total_cards:rs.length,submitted_cards:rs.filter(r=>['submitted','approved','locked'].includes(r.status)).length,approved_cards:approved.length,returned_cards:rs.filter(r=>r.status==='returned').length,average_score:approved.length?approved.reduce((s,r)=>s+Number(r.calculated_score||0),0)/approved.length:null};});}
  const {data,error}=await supabase.from('monthly_department_summary').select('*').eq('period_id',periodId).order('department_name');if(error)throw error;return data||[];
}
async function lockPeriod(periodId){if(isDemoMode){showToast('Demo mode: periode ditandai locked pada preview saja.');return;}const {error}=await supabase.rpc('lock_reporting_period',{p_period_id:periodId});if(error)throw error;}
async function exportXlsx(periodId,periodLabel){
  let rows=[];
  if(isDemoMode){rows=getDemoCards().filter(c=>c.period_id===periodId).flatMap(c=>c.entries.map(e=>({Period:periodLabel,Department:'Operations',Employee:c.employee_name,Status:c.status,Score:c.calculated_score,'Metric ID':e.metric_template_id,'Achievement %':e.achievement_percent,'Actual Summary':e.actual_summary,'Evidence URL':e.evidence_url,'Root Cause':e.root_cause,'Corrective Action':e.corrective_action})));}
  else {const {data,error}=await supabase.from('monthly_entry_export_view').select('*').eq('period_id',periodId);if(error)throw error;rows=data||[];}
  if(!rows.length){showToast('Belum ada data KPI untuk diekspor.');return;}
  if(!window.XLSX){showToast('Library Excel belum termuat. Coba refresh halaman.');return;}
  const wb=window.XLSX.utils.book_new();const ws=window.XLSX.utils.json_to_sheet(rows);window.XLSX.utils.book_append_sheet(wb,ws,'KPI Monthly Detail');window.XLSX.writeFile(wb,`PGE_KPI_Monthly_Report_${periodLabel.replace(/\s+/g,'_')}.xlsx`);
}
export async function initOwnerDashboard(){
  const context=await requireRole(['owner','admin']);if(!context)return;attachNav(context);$('#portal-user').textContent=context.profile.full_name+(isDemoMode?' · Demo':'');
  const periods=await getPeriods();let activePeriod=periods[0]||DEMO_PERIOD;const select=$('#period-select');select.innerHTML=periods.map(p=>`<option value="${p.id}">${escapeHTML(monthLabel(p.month_start))} · ${escapeHTML(p.status)}</option>`).join('');
  async function render(){const rows=await getOwnerSummary(activePeriod.id);const total=rows.reduce((s,r)=>s+Number(r.total_cards||0),0);const approved=rows.reduce((s,r)=>s+Number(r.approved_cards||0),0);const returned=rows.reduce((s,r)=>s+Number(r.returned_cards||0),0);const avgRows=rows.filter(r=>r.average_score!=null);const avg=avgRows.length?avgRows.reduce((s,r)=>s+Number(r.average_score),0)/avgRows.length:0;$('#owner-total').textContent=total;$('#owner-approved').textContent=approved;$('#owner-returned').textContent=returned;$('#owner-score').textContent=`${avg.toFixed(2)}%`;$('#owner-table-body').innerHTML=rows.map(r=>`<tr><td><strong>${escapeHTML(r.department_name)}</strong></td><td>${r.total_cards||0}</td><td>${r.submitted_cards||0}</td><td>${r.approved_cards||0}</td><td>${r.returned_cards||0}</td><td>${r.average_score==null?'—':Number(r.average_score).toFixed(2)+'%'}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">Belum ada data.</td></tr>';}
  $('#lock-period').addEventListener('click',async()=>{if(!confirm(`Lock periode ${monthLabel(activePeriod.month_start)}? Card yang locked tidak dapat diedit.`))return;try{await lockPeriod(activePeriod.id);showToast('Periode berhasil dikunci.');await render();}catch(err){showToast(err.message||String(err));}});$('#export-report').addEventListener('click',()=>exportXlsx(activePeriod.id,monthLabel(activePeriod.month_start)));select.addEventListener('change',async()=>{activePeriod=periods.find(p=>p.id===select.value)||activePeriod;await render();});await render();
}
