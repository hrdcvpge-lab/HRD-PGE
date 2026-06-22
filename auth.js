
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.PGE_CONFIG || {};
export const isDemoMode = Boolean(config.DEMO_MODE || !config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY);
export const supabase = isDemoMode ? null : createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export const ROLE_PRIORITY = ['owner','admin','hr','team_leader'];

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

export async function getCurrentUserContext(){
  if(isDemoMode) return { demo:true, user:{id:'demo-team-leader',email:'kepala.produksi@pge.demo'}, profile:{full_name:'Kepala Produksi (Demo)'}, roles:['team_leader'], department:'Operations' };
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
  if(!isDemoMode && !context.roles.some(role=>allowed.includes(role))){
    showToast('Akun ini tidak memiliki akses ke halaman tersebut.');
    window.setTimeout(()=>window.location.replace(resolveLanding(context.roles)),900);
    return null;
  }
  return context;
}

export async function signIn(email,password){
  if(isDemoMode){ showToast('Demo mode aktif. Pilih tombol preview sesuai peran di bawah.'); return null; }
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error) throw error;
  return data;
}

export async function signOut(){
  if(!isDemoMode){ await supabase.auth.signOut(); }
  localStorage.removeItem('pge_demo_role');
  window.location.replace('login.html');
}

export function setDemoRole(role){ localStorage.setItem('pge_demo_role',role); }
export function getDemoRole(){ return localStorage.getItem('pge_demo_role') || 'team_leader'; }

export function formatStatus(status){
  return ({draft:'Draft',submitted:'Submitted',returned:'Returned',approved:'HR Approved',locked:'Locked'})[status] || status || 'Draft';
}
