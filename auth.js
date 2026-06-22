import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.PGE_CONFIG || {};
export const isDemoMode = Boolean(config.DEMO_MODE || !config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY);
export const supabase = isDemoMode ? null : createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export const ROLE_PRIORITY = ['owner','admin','hr','team_leader'];

export const DEMO_IDENTITIES = {
  ops_leader: {
    key:'ops_leader', profile:{full_name:'Kepala Produksi (Demo)'},
    user:{id:'demo-ops-leader',email:'kepala.produksi@pge.demo'}, roles:['team_leader'],
    department:'Operations', teamKey:'operations', workspaceType:'team', label:'Operations Team Leader'
  },
  sm_leader: {
    key:'sm_leader', profile:{full_name:'Kepala Sales & Marketing (Demo)'},
    user:{id:'demo-sm-leader',email:'head.sm@pge.demo'}, roles:['team_leader'],
    department:'Sales & Marketing', teamKey:'sales_marketing', workspaceType:'team', label:'Sales & Marketing Team Leader'
  },
  rnd_leader: {
    key:'rnd_leader', profile:{full_name:'Kepala R&D (Demo)'},
    user:{id:'demo-rnd-leader',email:'head.rnd@pge.demo'}, roles:['team_leader'],
    department:'Research & Development', teamKey:'rnd', workspaceType:'team', label:'R&D Team Leader'
  },
  fat_self: {
    key:'fat_self', profile:{full_name:'FAT Generalist (Demo)'},
    user:{id:'demo-fat-generalist',email:'fat@pge.demo'}, roles:['team_leader'],
    department:'Finance, Accounting & Tax', teamKey:'fat', workspaceType:'self', label:'Finance, Accounting & Tax Self Reporting'
  },
  hrd_self: {
    key:'hrd_self', profile:{full_name:'HRD GA Generalist (Demo)'},
    user:{id:'demo-hrd-generalist',email:'hrd@pge.demo'}, roles:['team_leader'],
    department:'HRD GA', teamKey:'hrd', workspaceType:'self', label:'HRD GA Self Reporting'
  },
  hr: {
    key:'hr', profile:{full_name:'HR Reviewer (Demo)'},
    user:{id:'demo-hr-reviewer',email:'hr.review@pge.demo'}, roles:['hr'],
    department:'All Departments', teamKey:null, workspaceType:'review', label:'HR Review'
  },
  owner: {
    key:'owner', profile:{full_name:'Owner / Management (Demo)'},
    user:{id:'demo-owner',email:'owner@pge.demo'}, roles:['owner'],
    department:'All Departments', teamKey:null, workspaceType:'owner', label:'Owner Dashboard'
  }
};

export function showToast(message){
  let el=document.getElementById('toast');
  if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent=message; el.classList.add('show');
  clearTimeout(window.__pgeToastTimer);
  window.__pgeToastTimer=setTimeout(()=>el.classList.remove('show'),4200);
}

export function monthLabel(dateString){
  const date=new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(date);
}

export function getDemoIdentity(){
  const key=localStorage.getItem('pge_demo_identity') || 'ops_leader';
  return DEMO_IDENTITIES[key] || DEMO_IDENTITIES.ops_leader;
}
export function setDemoIdentity(key){
  localStorage.setItem('pge_demo_identity', DEMO_IDENTITIES[key] ? key : 'ops_leader');
}
// Backward-compatible helpers for the earlier preview package.
export function setDemoRole(role){ setDemoIdentity(role==='owner'?'owner':role==='hr'?'hr':'ops_leader'); }
export function getDemoRole(){ return getDemoIdentity().roles[0]; }

export async function getCurrentUserContext(){
  if(isDemoMode){
    const identity=getDemoIdentity();
    return { demo:true, demoKey:identity.key, user:identity.user, profile:identity.profile, roles:identity.roles,
      department:identity.department, teamKey:identity.teamKey, workspaceType:identity.workspaceType, demoLabel:identity.label };
  }
  const {data:{session},error:sessionError}=await supabase.auth.getSession();
  if(sessionError) throw sessionError;
  if(!session) return null;
  const [{data:profile,error:profileError},{data:roleRows,error:roleError}] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email').eq('id',session.user.id).single(),
    supabase.from('user_roles').select('role').eq('user_id',session.user.id)
  ]);
  if(profileError) throw profileError;
  if(roleError) throw roleError;
  return { demo:false, user:session.user, profile, roles:(roleRows||[]).map(r=>r.role) };
}

export function resolveLanding(roles=[]){
  if(roles.includes('owner') || roles.includes('admin')) return 'owner-dashboard.html';
  if(roles.includes('hr')) return 'review.html';
  return 'team-dashboard.html';
}

export async function requireRole(allowed){
  const context=await getCurrentUserContext();
  if(!context){ window.location.replace('login.html'); return null; }
  if(!context.roles.some(role=>allowed.includes(role))){
    showToast('Akun ini tidak memiliki akses ke halaman tersebut.');
    window.setTimeout(()=>window.location.replace(resolveLanding(context.roles)),900);
    return null;
  }
  return context;
}

export async function signIn(email,password){
  if(isDemoMode){ showToast('Demo mode aktif. Pilih profil demo di bawah.'); return null; }
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error) throw error;
  return data;
}

export async function signOut(){
  if(!isDemoMode){ await supabase.auth.signOut(); }
  localStorage.removeItem('pge_demo_identity');
  window.location.replace('login.html');
}

export function formatStatus(status){
  return ({draft:'Draft',submitted:'Submitted',returned:'Returned',approved:'HR Approved',locked:'Locked'})[status] || status || 'Draft';
}
