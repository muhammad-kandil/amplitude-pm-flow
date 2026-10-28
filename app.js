/* Amplitude PM Flow — app logic
   Sources: "The PM Flow for Amplitude" deck (July 2026), KB: PM guide to tag features, data-testid protocol,
   End-to-End Use Case Guide, governance articles. */
(function(){
'use strict';
const CFG = window.PM_FLOW_CONFIG || {};
const KB='https://kb.alefed.com/docs/';
const LINKS={pm:KB+'amplitude-pm-guide-to-tag-features',e2e:KB+'amplitude-end-to-end-use-case-guide',all:KB+'all-about-amplitude',
  cohorts:KB+'cohorts-general',replay:KB+'session-replays-general',dash:KB+'how-to-navigate-and-access-the-dashboards',
  govEvents:KB+'governance-in-organising-the-autocapture-events-for-features',govSpaces:KB+'governance-in-organising-and-managing-spaces-charts-and-visuals',
  govCohorts:KB+'governance-in-creating-and-organising-cohorts-and-metrics',dict:KB+'amplitude-dictionary',dev:'https://alefeducation.atlassian.net/wiki/x/QoACGAE'};

/* ---------------- reference data ---------------- */
const PRODUCT_LINES=['Core','Pathways','Gamified Assessments','Mobile & Connect','Student','Teacher','Admin'];
const ROLES=['Teacher','Student','Parent','Admin','Principal'];
const TENANTS=['UAE MOE (ADEK / NCE)','Private schools','Indonesia (IDN)'];
const MOMENTS=[
  {v:'opened',l:'Opened it'},{v:'started',l:'Started'},{v:'created',l:'Created'},{v:'submitted',l:'Submitted'},{v:'saved',l:'Saved'},
  {v:'completed',l:'Completed'},{v:'joined',l:'Joined'},{v:'edited',l:'Edited'},{v:'deleted',l:'Deleted'},{v:'file-uploaded',l:'Uploaded a file'},
  {v:'exported',l:'Exported'},{v:'shared',l:'Shared / invited'},{v:'notification-received',l:'Got a notification'},{v:'question-answered',l:'Answered a question'},
  {v:'result-viewed',l:'Saw the result'},{v:'failed',l:'Hit an error'},{v:'dismissed',l:'Dismissed it'},{v:'retried',l:'Retried'},
];
const VERB={opened:'open',started:'start',created:'create',submitted:'submit',saved:'save',completed:'complete',joined:'join',edited:'edit',deleted:'delete',
  'file-uploaded':'upload a file in',exported:'export from',shared:'share','notification-received':'get the notification for','question-answered':'answer a question in',
  'result-viewed':'see the result of',failed:'hit an error in',dismissed:'dismiss',retried:'retry'};
const EL_TYPES=[{v:'btn',l:'Button'},{v:'link',l:'Link'},{v:'toggle',l:'Toggle / checkbox'},{v:'dropdown',l:'Dropdown'},{v:'input',l:'Text field'}];
const PROPS=['grade','subject','tenant','school-id','class-id','assessment-type','language','entry-point','attempt-number','score','duration-seconds','status','error-code','item-count'];
const CATEGORICAL=['grade','subject','tenant','school-id','assessment-type','language','entry-point','status'];
const QTYPES=[{v:'count',l:'How many (per week)',how:'Segmentation · Uniques · weekly'},{v:'share',l:'What % of active users',how:'Segmentation · Active % · last week'},
  {v:'funnel',l:'Where do they drop off',how:'Funnel · steps in order · within 1 hour'},{v:'time',l:'How long does it take',how:'Funnel · Time to convert · median'},
  {v:'retention',l:'Do they come back',how:'Retention · weekly · 4 weeks'},{v:'breakdown',l:'Which group most',how:'Data table · grouped by a property'}];
const GOES_WRONG=[
  ['The element never appears in the stream','It is a div, not a button. Autocapture only sees real interactive elements.'],
  ['Funnel numbers doubled overnight','Event bubbling. A button inside a link fires twice.'],
  ['A property reads undefined','It lives in application state and nobody emitted it.'],
  ['A chart that worked last month reads zero','Someone renamed a class, a name tag, or the button copy.'],
  ['Arabic or Indonesian users missing from every chart','The chart keys on English button text, not the name tag.'],
  ['Works in NPRD, silent in production','The production build strips data-testid.'],
];
const DEMO_CHECKS=[['appeared','Did it appear?','If not, it is not a real interactive element.'],['once','Did it appear once?','Twice means event bubbling. Your funnel silently doubles.'],
  ['props','Are properties populated?','undefined is a bug, not a rounding error.'],['stable','Is the name tag there?','If only the English button text distinguishes it, the Arabic release breaks the chart.']];

/* ---------------- steps ---------------- */
const STEPS=[
  {k:'gate',   g:'Epic',       t:'Gate'},
  {k:'feature',g:'Discovery',  t:'The feature'},
  {k:'who',    g:'Discovery',  t:'Who uses it'},
  {k:'journey',g:'Discovery',  t:'The journey'},
  {k:'hidden', g:'Discovery',  t:'What the page can\'t see'},
  {k:'questions',g:'Discovery',t:'The questions'},
  {k:'jira',   g:'Refinement', t:'Jira story'},
  {k:'dev',    g:'Sprint',     t:'Developer handover'},
  {k:'demo',   g:'Demo',       t:'Demo day'},
  {k:'build',  g:'Release',    t:'Build in Amplitude'},
  {k:'release',g:'Release',    t:'Released'},
];

/* ---------------- storage ---------------- */
const blankData=()=>({gate:null,feature:'',productLine:null,roles:[],tenants:[],journey:[],compare:[],
  qOff:[],custom:[],jira:{pasted:false,key:''},dev:{},demo:{},build:{},released:false,releasedAt:null,step:0});
const newFeature=()=>({id:uid(),title:'',owner_email:Store.user?Store.user.email:'local',data:blankData(),status:'0',updated_at:new Date().toISOString()});
const uid=()=>(crypto.randomUUID?crypto.randomUUID():'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,8));

const Store={
  mode:'local', user:null, sb:null, LKEY:'pm-bible-features',
  async init(){
    if(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY&&window.supabase){
      this.mode='cloud';
      this.sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
      const {data}=await this.sb.auth.getSession(); this.user=data.session?data.session.user:null; await this.refreshAdmin();
      this.sb.auth.onAuthStateChange(async(_e,session)=>{const was=!!this.user; this.user=session?session.user:null; if(was!==!!this.user){ await this.refreshAdmin(); App.view=this.user?'list':'signin'; App.cur=null; App.render(); }});
    }
    return this;
  },
  isAdmin:false,
  async refreshAdmin(){ this.isAdmin=false; if(!this.user) return; try{ const {data}=await this.sb.from('admins').select('email').limit(1); this.isAdmin=!!(data&&data.length); }catch(e){} },
  normEmail(local){ const dom=(CFG.ALLOWED_EMAIL_DOMAIN||'').toLowerCase(); let v=(local||'').trim().toLowerCase().replace(/\s+/g,''); if(v.includes('@')) v=v.split('@')[0]; return dom?v+'@'+dom:v; },
  // Returns 'in' when the email+password match an existing account, or 'none' when they don't (nothing is created).
  async signIn(email,password){
    if(!password||password.length<8) throw new Error('Password needs at least 8 characters.');
    const r=await this.sb.auth.signInWithPassword({email,password});
    if(!r.error) return 'in';
    if(/invalid login credentials/i.test(r.error.message)) return 'none';
    throw r.error;
  },
  // Only called after the person confirmed the address on screen.
  async createAccount(email,password){
    const s=await this.sb.auth.signUp({email,password});
    if(s.error){ if(/already registered/i.test(s.error.message)) throw new Error('This email already has an account, so the password was wrong. Ask an admin to reset it.'); throw s.error; }
    if(!s.data.session) throw new Error('Account created but not signed in — check that “Confirm email” is off in Supabase.');
    return 'new';
  },
  async signInMicrosoft(){ const {error}=await this.sb.auth.signInWithOAuth({provider:'azure',options:{scopes:'email openid profile',redirectTo:location.origin+location.pathname}}); if(error) throw error; },
  async signOut(){ await this.sb.auth.signOut(); },
  _local(){ try{ return JSON.parse(localStorage.getItem(this.LKEY)||'[]'); }catch(e){ return []; } },
  _setLocal(arr){ try{ localStorage.setItem(this.LKEY,JSON.stringify(arr)); }catch(e){} },
  async list(){
    if(this.mode==='local') return this._local().sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
    const {data,error}=await this.sb.from('features').select('*').eq('owner',this.user.id).order('updated_at',{ascending:false});
    if(error) throw error; return data;
  },
  async listAll(){
    if(this.mode==='local') return this._local();
    const {data,error}=await this.sb.from('features').select('*').order('updated_at',{ascending:false});
    if(error) throw error; return data;
  },
  async save(f){
    f.updated_at=new Date().toISOString();
    if(this.mode==='local'){ const arr=this._local(); const i=arr.findIndex(x=>x.id===f.id); if(i>=0) arr[i]=f; else arr.push(f); this._setLocal(arr); return; }
    if(!f.owner_email||f.owner_email==='local') f.owner_email=this.user.email;
    const row={id:f.id,owner:f.owner||this.user.id,owner_email:f.owner_email,title:f.title,status:f.status,data:f.data,updated_at:f.updated_at};
    const {error}=await this.sb.from('features').upsert(row); if(error) throw error;
  },
  async remove(id){
    if(this.mode==='local'){ this._setLocal(this._local().filter(x=>x.id!==id)); return; }
    const {error}=await this.sb.from('features').delete().eq('id',id); if(error) throw error;
  }
};

/* ---------------- names (Alef conventions) ---------------- */
const kebab=s=>(s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const N={
  slug:d=>kebab(d.feature)||'feature',
  F:d=>d.feature.trim()||'(feature)',
  role:d=>d.roles[0]||'User',
  Rs:d=>N.role(d).toLowerCase()+'s',
  r1:d=>N.role(d).toLowerCase(),
  label:m=>(MOMENTS.find(x=>x.v===m.v)||{l:m.v}).l,
  ev:(d,m)=>(d.roles.length>1&&m.role?kebab(m.role)+'-':'')+N.slug(d)+'-'+m.v,
  tid:(d,m)=>N.slug(d)+'-'+m.v+'-'+(m.el||'btn'),
  dash:d=>`[${d.productLine||'Product Line'}] ${N.F(d)}`,
  folder:d=>`${d.productLine||'Product line'} Space › ${N.F(d)}`,
  cohorts:d=>{const scope=d.tenants.length?' – '+d.tenants.map(t=>t.split(' (')[0]).join(' + '):''; return [...(d.roles.length?d.roles:['User']).map(r=>`[Persona] Target ${r}s${scope}`),`[Team] ${N.F(d)} – Adopters`,`[Team] ${N.F(d)} – Non-adopters`];},
  recipe:(d,m)=>{ const a=`[Amplitude] Element Clicked · Element Hierarchy contains ${N.tid(d,m)}`, b=`code event ${N.ev(d,m)}`;
    return m.where==='page'?a:m.where==='code'?b:`${a}  —or—  ${b} (ask dev which)`; }
};

/* suggested questions */
function suggested(d){
  const ms=d.journey; if(!ms.length) return [];
  const a=ms[0], z=ms[ms.length-1], fail=ms.find(m=>m.v==='failed'), out=[];
  const R=N.Rs(d), F=N.F(d);
  out.push({id:'adopt',t:`How many ${R} ${VERB[a.v]} ${F} each week?`,how:QTYPES[0].how,ev:[a]});
  out.push({id:'share',t:`What % of active ${R} ${VERB[a.v]} ${F}?`,how:QTYPES[1].how,ev:[a]});
  if(ms.length>1){
    out.push({id:'funnel',t:`Where do ${R} drop off between “${N.label(a)}” and “${N.label(z)}”?`,how:`Funnel · ${ms.length} steps in this order · within 1 hour`,ev:ms});
    out.push({id:'time',t:`How long does it take a ${N.r1(d)} from “${N.label(a)}” to “${N.label(z)}”?`,how:QTYPES[3].how,ev:[a,z]});
  }
  out.push({id:'retain',t:`Do ${R} who ${VERB[z.v]} ${F} come back the next week?`,how:QTYPES[4].how,ev:[z]});
  const cat=d.compare.filter(p=>CATEGORICAL.includes(p));
  if(cat.length) out.push({id:'break',t:`Which ${cat.slice(0,3).join(' / ')} uses ${F} most?`,how:`Data table · grouped by ${cat[0]}`,ev:[z]});
  if(fail) out.push({id:'fail',t:`How often do ${R} hit an error in ${F}?`,how:'Segmentation · Event totals per user',ev:[fail]});
  if(d.tenants.length>1) out.push({id:'tenant',t:`Does ${F} behave the same across ${d.tenants.map(t=>t.split(' (')[0]).join(' and ')}?`,how:'Any chart · segment by tenant',ev:[a]});
  return out;
}
function allQuestions(d){
  const ms=d.journey, a=ms[0], z=ms[ms.length-1];
  const sug=suggested(d).filter(q=>!d.qOff.includes(q.id));
  const cus=d.custom.map(c=>{const qt=QTYPES.find(x=>x.v===c.type)||QTYPES[0]; const ev=!ms.length?[]:c.type==='funnel'?ms:c.type==='time'?[a,z]:c.type==='retention'?[z]:[a]; return {id:c.id,t:c.text,how:qt.how,ev,custom:true};});
  return [...sug,...cus];
}

/* ---------------- generated texts ---------------- */
function qText(d){ return allQuestions(d).map((q,i)=>`${i+1}. ${q.t}`).join('\n'); }
function jiraText(d){
  const L=[];
  L.push(`Summary: Amplitude tracking — ${N.F(d)}`);
  L.push('');
  L.push('## Why');
  L.push(`So we can answer these questions after release (each one is a chart):`);
  allQuestions(d).forEach((q,i)=>L.push(`${i+1}. ${q.t}`));
  L.push('');
  L.push(`Gate: Trackable · Product line: ${d.productLine||'-'} · Users: ${d.roles.join(', ')||'-'}${d.tenants.length?' · Live in: '+d.tenants.join(', '):''}`);
  L.push('');
  L.push('## Acceptance criteria');
  L.push('Every moment below is instrumented in ONE of two ways. (A) a real button / link / input on the page gets a stable data-testid. (B) when the page cannot see it, the code emits the Amplitude event.');
  d.journey.forEach((m,i)=>{
    const A=`(A) data-testid ends with \`${N.slug(d)}-${m.v}-${m.el||'btn'}\` — full id per the data-testid protocol: feature-page-group-action-suffix`;
    const B=`(B) code event \`${N.ev(d,m)}\`${(m.props&&m.props.length)?' with properties: '+m.props.join(', '):''}`;
    const line = m.where==='page'?A : m.where==='code'?B : `${A}  OR  ${B} — developer decides`;
    L.push(`- [ ] ${i+1}. ${N.label(m)}${d.roles.length>1&&m.role?' ('+m.role+')':''} → ${line}`);
  });
  const extra=d.journey.filter(m=>m.where!=='code'&&m.props&&m.props.length);
  if(extra.length){ L.push(''); L.push('Properties the page cannot see must be sent with the event:'); extra.forEach(m=>L.push(`- ${N.label(m)}: ${m.props.join(', ')}`)); }
  if(d.compare.length){ L.push(''); L.push(`Properties to add on every event above (for breakdowns): ${d.compare.join(', ')}`); }
  L.push('');
  L.push('## Rules');
  L.push('- [ ] Real `<button>` / `<a>` / `<input>` elements. A div, canvas or iframe is invisible to autocapture.');
  L.push('- [ ] data-testid is unique on the page, lowercase kebab-case, suffix matches behaviour (-btn, -link, -toggle, -dropdown, -input).');
  L.push('- [ ] One event per click (no bubbling doubles: a button inside a link fires twice).');
  L.push('- [ ] Every property has a value. `undefined` is a bug.');
  L.push('- [ ] data-testid stays in the production build.');
  L.push('- [ ] Every new code event has a description in Amplitude Data.');
  L.push('- [ ] Never rename or remove a data-testid without telling the PM. Tests fail loudly; dashboards fail silently.');
  L.push('');
  L.push('## Definition of done');
  L.push('- [ ] PM verified every moment above in the Amplitude event stream on demo day (test account), before release.');
  L.push('');
  L.push(`Labels: amplitude, trackable${d.productLine?', '+kebab(d.productLine):''}`);
  L.push(`Reference: ${LINKS.pm}`);
  return L.join('\n');
}
function demoText(d){
  const L=['Demo day — test account logged in, Amplitude event stream open (Users → look up the test account).','Click everything, not just the happy path. For each moment:','',
  '  [ ] Did it appear?            if not, it is not a real interactive element',
  '  [ ] Did it appear once?       twice = event bubbling, the funnel silently doubles',
  '  [ ] Are properties populated? undefined is a bug',
  '  [ ] Is the name tag there?    the chart must key on the data-testid, never on English button text','','Look for:'];
  d.journey.forEach((m,i)=>L.push(`  ${i+1}. ${N.label(m)}  →  ${N.recipe(d,m)}`));
  L.push('','Anything that fails goes back now, while it is a fifteen-minute fix.');
  return L.join('\n');
}
function buildText(d){
  const L=[`Dashboard: ${N.dash(d)}`,`Where: ${N.folder(d)}  (folders max 2 levels deep)`,'',`Cohorts first (ask ${CFG.CONTACTS?CFG.CONTACTS.cohorts:'the analytics team'}):`];
  N.cohorts(d).forEach(c=>L.push(`  • ${c}`));
  L.push('','Charts (title = the question):');
  allQuestions(d).forEach((q,i)=>{L.push(`  ${i+1}. ${q.t}`);L.push(`     ${q.how}`);q.ev.forEach(m=>L.push(`     ${N.recipe(d,m)}`));L.push(`     Segment: [Persona] Target ${N.role(d)}s${d.tenants.length>1?' · split by tenant':''}`);});
  L.push('','Add a text tile: what the numbers can and cannot tell you (clicks are not confirmations; short history for new tenants).');
  L.push('Done means: someone who is not you opens the link and answers the questions.');
  return L.join('\n');
}
function finalChecks(d){
  return [
    {t:'The epic says Trackable or Not needed',on:!!d.gate},
    {t:'Five questions are written on the epic',on:allQuestions(d).length>=5},
    {t:'Each question has its events and properties',on:d.journey.length>0&&allQuestions(d).length>0},
    {t:'Properties sorted: on the page, or in state',on:d.journey.length>0&&d.journey.every(m=>!!m.where)},
    {t:'The developer knows what they must emit (Jira story)',on:!!d.jira.pasted},
    {t:'Every interactive element has a data-testid',on:!!d.dev.testids},
    {t:'I walked the demo with the event stream open',on:demoDone(d)},
    {t:'Every name is lowercase kebab-case',on:d.journey.length>0},
    {t:'Adopter and non-adopter cohorts exist',on:!!d.build.cohorts},
    {t:'A dashboard is live and correctly named',on:!!(d.build.dashboard&&d.build.shared)},
  ];
}
const demoDone=d=>d.journey.length>0&&d.journey.every(m=>DEMO_CHECKS.every(c=>d.demo[m.id+':'+c[0]]));
function stepDone(d,i){
  switch(STEPS[i].k){
    case 'gate': return !!d.gate;
    case 'feature': return !!(d.feature.trim()&&d.productLine);
    case 'who': return d.roles.length>0&&d.tenants.length>0;
    case 'journey': return d.journey.length>0;
    case 'hidden': return d.journey.length>0&&d.journey.every(m=>!!m.where);
    case 'questions': return allQuestions(d).length>=5;
    case 'jira': return !!d.jira.pasted;
    case 'dev': return ['testids','events','promise'].every(k=>d.dev[k]);
    case 'demo': return demoDone(d);
    case 'build': return ['cohorts','charts','dashboard','shared'].every(k=>d.build[k]);
    case 'release': return !!d.released;
  }
}
function statusOf(d){ if(d.gate==='no') return 'not-needed'; if(d.released) return 'released'; const i=STEPS.findIndex((s,i)=>!stepDone(d,i)); return String(i<0?STEPS.length-1:i); }
function statusLabel(s){ if(s==='not-needed') return 'Not needed'; if(s==='released') return 'Released'; const i=+s; return STEPS[i]?`At: ${STEPS[i].t}`:'In progress'; }

/* ---------------- UI helpers ---------------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),1800);}
async function copyText(txt,btn){let ok=false;try{await navigator.clipboard.writeText(txt);ok=true;}catch(e){try{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();ok=document.execCommand('copy');document.body.removeChild(ta);}catch(e2){}}
  if(btn){const old=btn.textContent;btn.classList.add('did');btn.textContent=ok?'Copied':'Select & copy';setTimeout(()=>{btn.classList.remove('did');btn.textContent=old;},1500);} toast(ok?'Copied':'Could not copy — select the text and copy it');}
const chips=(list,sel,attr,cls='')=>`<div class="choices">${list.map(v=>`<button class="choice ${cls} ${sel.includes(v)?'on':''}" data-${attr}="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
const head=(e,t,w,dw)=>`<div class="card-head"><div class="eyebrow">${e}</div><h2>${t}</h2>${w?`<p class="why">${w}</p>`:''}${dw?`<div class="done-when"><b>Done when</b> ${dw}</div>`:''}</div>`;
const check=(attr,key,on,t,s)=>`<button class="check ${on?'on':''}" data-${attr}="${esc(key)}"><span class="cb"></span><span><span class="ct">${t}</span>${s?`<span class="cs">${s}</span>`:''}</span></button>`;
const kit=(k,t,s,txt)=>`<div class="kit"><div class="kit-head"><div><span class="kt">${t}</span><span class="ks">${s}</span></div><button class="copy" data-copy="${k}">Copy</button></div><div class="out">${esc(txt)}</div></div>`;

/* ---------------- screens ---------------- */
const Screens={
  gate(d){ return head('Step 1 · On the epic','Does a student, teacher or admin see something they can act on?','Ticking boxes on features nobody sees wastes your time and corrupts the feature map. An honest map depends on PMs marking “Not needed” honestly.','you have written the answer on the epic.')+
    `<div class="card-body"><div class="choices">
      <button class="choice big yes ${d.gate==='yes'?'on':''}" data-gate="yes"><span class="ttl">Yes → Trackable</span><span class="sub">A screen, a button, a notification. Write “Amplitude: Trackable” on the epic and continue.</span></button>
      <button class="choice big no ${d.gate==='no'?'on':''}" data-gate="no"><span class="ttl">No → Not needed</span><span class="sub">Backend, security, pipelines, infrastructure. Write “Amplitude: Not needed” on the epic. Nothing else applies.</span></button></div>
      ${d.gate==='no'?`<div class="note ok"><b>Done.</b> This feature is marked Not needed on the map. Give it a name below so it is listed, then stop.</div><div class="q"><div class="label">Feature name</div><div class="field"><input id="fname" type="text" placeholder="e.g. Redshift to Fabric migration" value="${esc(d.feature)}" autocomplete="off"></div></div>`:''}
    </div>`; },
  feature(d){ return head('Step 2 · Discovery','Name the feature','The only thing you type. Every event, name tag, cohort and dashboard name is built from it.','the name and the product line are set.')+
    `<div class="card-body">
      <div class="q"><div class="label">Feature name</div><div class="hint">As it appears on the epic. Short.</div><div class="field"><input id="fname" type="text" placeholder="e.g. Gamified Assessments" value="${esc(d.feature)}" autocomplete="off"><span class="gen" id="slugOut">${N.slug(d)}</span></div></div>
      <div class="q"><div class="label">Product line</div><div class="hint">This is the Amplitude space the dashboard lives in.</div>${chips(PRODUCT_LINES,[d.productLine],'pl')}</div>
      ${d.feature.trim()&&d.productLine?`<div class="note">Dashboard will be <code>${esc(N.dash(d))}</code> in <code>${esc(N.folder(d))}</code>.</div>`:''}
    </div>`; },
  who(d){ return head('Step 3 · Discovery','Who uses it, and where is it live?','Charts are written for one main persona. Amplitude is switched on per tenant, so a feature live in one tenant only has data from that tenant.','at least one role and one tenant are picked.')+
    `<div class="card-body">
      <div class="q"><div class="label">Who acts on it?</div><div class="hint">Pick every role that sees a surface. The first one you tap is the main persona.</div>${chips(ROLES,d.roles,'role')}</div>
      <div class="q"><div class="label">Where is it live?</div>${chips(TENANTS,d.tenants,'tenant')}</div>
      ${d.tenants.length>1?`<div class="note">More than one tenant: every chart will be split by tenant, and a tenant-comparison question is added.</div>`:''}
    </div>`; },
  journey(d){ return head('Step 4 · Discovery','What does the user do, in order?','Each moment becomes one event. The first is how they get in; the last is the outcome you care about. If you cannot name the chart it feeds, you do not need the moment.','the journey has at least one moment (four to six is typical).')+
    `<div class="card-body">
      <div class="q"><div class="label">Tap to add a moment</div><div class="choices">${MOMENTS.map(x=>`<button class="choice" data-add="${x.v}">${x.l}</button>`).join('')}</div></div>
      ${d.journey.length?`<div class="order">${d.journey.map((m,i)=>`<div class="step"><span class="idx">${i+1}</span><span class="t">${esc(N.label(m))}</span><span class="gen">${esc(N.ev(d,m))}</span><span class="tools"><button class="icon-btn" data-mv="${i}:-1" aria-label="Move up">↑</button><button class="icon-btn" data-mv="${i}:1" aria-label="Move down">↓</button><button class="icon-btn" data-rm="${i}" aria-label="Remove">✕</button></span>
        ${d.roles.length>1?`<div class="row"><span class="rl">Who does it</span>${d.roles.map(r=>`<button class="choice sm ${m.role===r?'on':''}" data-mrole="${i}:${esc(r)}">${esc(r)}</button>`).join('')}</div>`:''}</div>`).join('')}</div>`:`<div class="note">Start with “Opened it”, then the outcome.</div>`}
      <div class="note"><b>Naming rule.</b> Events are <code>[feature]-[action]</code>, lowercase kebab-case${d.roles.length>1?', prefixed by the role when more than one persona is involved':''}. Already applied above.</div>
    </div>`; },
  hidden(d){ return head('Step 5 · Before refinement','What can the page see?','The only question that gets expensive later. A click, a page view or a form submit is on the page and needs only a name tag. Anything the page cannot see must be emitted by the developer — that is the whole developer ticket.','every moment has an answer. “Not sure” is a valid answer: the developer decides at refinement.')+
    `<div class="card-body">${d.journey.length?`<div class="order">${d.journey.map((m,i)=>`<div class="step"><span class="idx">${i+1}</span><span class="t">${esc(N.label(m))}</span>
      <div class="row"><span class="rl">The page…</span>
        <button class="choice sm yes ${m.where==='page'?'on':''}" data-mwhere="${i}:page">sees it (a real button, link, view or submit)</button>
        <button class="choice sm no ${m.where==='code'?'on':''}" data-mwhere="${i}:code">cannot see it (happens in the code, a notification, mobile)</button>
        <button class="choice sm maybe ${m.where==='unsure'?'on':''}" data-mwhere="${i}:unsure">not sure — ask the developer</button></div>
      ${m.where==='page'?`<div class="row"><span class="rl">Element type</span>${EL_TYPES.map(e=>`<button class="choice sm ${(m.el||'btn')===e.v?'on':''}" data-mel="${i}:${e.v}">${e.l} <code>-${e.v}</code></button>`).join('')}</div>`:''}
      <div class="row"><span class="rl">Extra properties</span>${PROPS.map(p=>`<button class="choice sm ${(m.props||[]).includes(p)?'on':''}" data-mprop="${i}:${p}">${p}</button>`).join('')}</div>
      <div class="row"><span class="rl">Generated</span><span class="gen">${esc(m.where==='code'?N.ev(d,m):N.tid(d,m))}</span></div></div>`).join('')}</div>`:`<div class="note warn">Add the journey first (step 4).</div>`}
      <div class="q"><div class="label">Compare by <span class="hint" style="font-weight:400">(optional)</span></div><div class="hint">Breakdowns you will want on the dashboard. These become a property on every event.</div>${chips(CATEGORICAL,d.compare,'cmp','sm')}</div>
    </div>`; },
  questions(d){ const sug=suggested(d);
    return head('Step 6 · Written on the epic','The questions','Not events. Each one is a chart title. If a question would not change a decision you make, switch it off. Add your own; five or six in total is the rule.',`at least five questions are on. You have <b>${allQuestions(d).length}</b>.`)+
    `<div class="card-body">
      ${sug.length?`<div class="q"><div class="label">Suggested from your journey</div><div class="order">${sug.map(q=>`<div class="qrow ${d.qOff.includes(q.id)?'off':''}" data-q="${q.id}"><span class="cb"></span><span class="qt">${esc(q.t)}</span><span></span><span class="qm"><span class="tag acc">${esc(q.how)}</span></span></div>`).join('')}</div></div>`:`<div class="note warn">Add the journey first (step 4) and the suggestions appear here.</div>`}
      <div class="q"><div class="label">Your own questions</div>
        ${d.custom.length?`<div class="order">${d.custom.map((c,i)=>`<div class="qrow"><span class="cb"></span><span class="qt">${esc(c.text)}</span><button class="icon-btn" data-rmq="${i}" aria-label="Remove">✕</button><span class="qm"><span class="tag acc">${esc((QTYPES.find(x=>x.v===c.type)||QTYPES[0]).how)}</span><span class="tag">your question</span></span></div>`).join('')}</div>`:''}
        <div class="field"><input id="cq" type="text" class="wide" placeholder="Write the question as a chart title, e.g. How many teachers turn an assessment into a game each week?" autocomplete="off"></div>
        <div class="hint">What kind of answer is it? Tap one, then Add.</div>
        <div class="choices">${QTYPES.map(t=>`<button class="choice sm ${App.cqType===t.v?'on':''}" data-cqtype="${t.v}">${t.l}</button>`).join('')}</div>
        <div><button class="btn" id="addq">Add question</button></div></div>
      <div class="kit"><div class="kit-head"><div><span class="kt">Paste onto the epic</span><span class="ks">Questions, numbered, as they will appear on the dashboard.</span></div><button class="copy" data-copy="q">Copy</button></div><div class="out">${esc(qText(d))}</div></div>
    </div>`; },
  jira(d){ return head('Step 7 · At refinement, before the story is pointed','The Jira story for the developer','Paste this into the story at refinement. Ask at refinement and the answer is cheap; ask at code review and you are asking for a new ticket, a new sprint, and a conversation about priority. Twenty seconds of questions to the developer: “can you get these from the page, or do they live in the code?”, “is anything on this screen not a real button?”, “is this shipping to mobile?”','the story is in Jira with these acceptance criteria.')+
    `<div class="card-body">
      ${kit('jira','Jira story — generated','Summary, Why, Acceptance criteria (one per moment), Rules, Definition of done. Jira converts the Markdown when you paste it into the description.',jiraText(d))}
      <div class="q"><div class="label">Jira key <span class="hint" style="font-weight:400">(optional)</span></div><div class="field"><input id="jkey" type="text" placeholder="e.g. CORE-1234" value="${esc(d.jira.key)}" autocomplete="off"></div></div>
      ${check('tog','jira.pasted',d.jira.pasted,'The story is in Jira with these acceptance criteria','Acceptance criteria, not a comment. The developer reads it while pointing.')}
      <div class="note"><b>If the developer says a moment lives in the code</b>, go back to step 5 and mark it “cannot see it”. The story updates itself.</div>
    </div>`; },
  dev(d){ const page=d.journey.filter(m=>m.where!=='code'), code=d.journey.filter(m=>m.where!=='page');
    return head('Step 8 · Sprint','What the developer owes you','Three things. That is the whole contract. Tick each one when the pull request shows it.','all three are ticked.')+
    `<div class="card-body"><div class="checks">
      ${check('dev','testids',d.dev.testids,'A stable name tag on every interactive element',`data-testid, unique on the page, lowercase kebab-case, suffix matches behaviour. ${page.length?'Expected: '+page.map(m=>'<code>…'+esc(m.v+'-'+(m.el||'btn'))+'</code>').join(' '):''}`)}
      ${check('dev','events',d.dev.events,'The state properties, as code events',`One event per trigger, carrying what the page cannot see. ${code.length?'Expected: '+code.map(m=>'<code>'+esc(N.ev(d,m))+'</code>').join(' '):'None needed — every moment is on the page.'}`)}
      ${check('dev','promise',d.dev.promise,'A promise','Never rename or remove a data-testid without telling you. Two things consume it now: the test suite and Amplitude. A test fails loudly. A dashboard fails silently.')}
    </div>
    <div class="q"><div class="label">The data-testid protocol (for the developer)</div><div class="tbl-wrap"><table class="tbl"><tr><th>Pattern</th><th>Suffixes</th><th>Rules</th></tr>
      <tr><td><code>feature-pagename-componentgroup-action-suffix</code><br><span class="hint">e.g. <code>auth-login-credentials-email-input</code></span></td><td><code>-btn</code> actions · <code>-link</code> navigation · <code>-toggle</code> switches · <code>-dropdown</code> selects · <code>-input</code> text</td><td>Every interactive element gets one · lowercase + kebab-case · suffix matches behaviour · unique on the page · kept in the production build</td></tr></table></div>
      <div class="links"><a href="${LINKS.pm}" target="_blank" rel="noopener">Dev checklist (KB)</a><a href="${LINKS.dev}" target="_blank" rel="noopener">Implementation dev docs</a><a href="${LINKS.govEvents}" target="_blank" rel="noopener">Event governance</a></div></div>
    </div>`; },
  demo(d){ return head('Step 9 · Demo day, not release day','Walk the demo with the event stream open','Test account logged in, Amplitude event stream beside it. Forty-five minutes. Click everything, not the happy path. Anything that fails goes back now, while it is a fifteen-minute fix instead of a retrofit ticket.','all four checks are ticked for every moment.')+
    `<div class="card-body">
      <div class="note"><b>How:</b> Amplitude → Users → look up the test account → Event stream. For a click, open the event and confirm <code>Element Hierarchy</code> contains the name tag. For a code event, confirm the exact name and that every property has a value.</div>
      ${d.journey.length?d.journey.map((m,i)=>`<div class="q"><div class="label">${i+1} · ${esc(N.label(m))} <span class="gen">${esc(m.where==='code'?N.ev(d,m):N.tid(d,m))}</span></div><div class="checks">${DEMO_CHECKS.map(c=>check('demo',m.id+':'+c[0],d.demo[m.id+':'+c[0]],c[1],c[2])).join('')}</div></div>`).join(''):`<div class="note warn">No journey yet (step 4).</div>`}
      ${kit('demo','Demo-day sheet','Print or keep open beside the event stream.',demoText(d))}
      <div class="q"><div class="label">What goes wrong — none of these throw an error</div><div class="tbl-wrap"><table class="tbl"><tr><th>What you see</th><th>What is happening</th></tr>${GOES_WRONG.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table></div></div>
    </div>`; },
  build(d){ return head('Step 10 · No developer dependency from here','Cohorts, then charts, then one dashboard','Build the cohorts first. Without the adopter / non-adopter comparison you cannot claim the feature did anything.','someone who is not you opened the link and answered the questions.')+
    `<div class="card-body"><div class="checks">
      ${check('build','cohorts',d.build.cohorts,'Cohorts exist',`One per role, one adopter, one non-adopter. Ask <b>${esc(CFG.CONTACTS?CFG.CONTACTS.cohorts:'the analytics team')}</b>. ${N.cohorts(d).map(c=>'<code>'+esc(c)+'</code>').join(' ')}`)}
      ${check('build','charts',d.build.charts,'Charts built, one per question','Title = the question. Recipes below. Segmentation (is anyone using it?), Funnel (where do they drop?), Retention (do they come back?), Data table (how does it differ by tenant and grade?).')}
      ${check('build','dashboard',d.build.dashboard,'Dashboard named and placed',`<code>${esc(N.dash(d))}</code> in <code>${esc(N.folder(d))}</code>. Folders no more than two levels deep. Add a text tile saying what the numbers can and cannot tell you.`)}
      ${check('build','shared',d.build.shared,'Someone who is not you opened the link and answered the questions','That is the definition of done.')}
    </div>
    ${kit('build','Build plan — generated','Cohort names, chart titles, the exact Amplitude recipe per chart.',buildText(d))}
    <div class="note"><b>Clicks are clicks, not confirmations.</b> A “Create” click counts even if the save failed. If a question needs the confirmed outcome, that moment must be a code event (step 5).</div>
    <div class="links"><a href="${LINKS.govSpaces}" target="_blank" rel="noopener">Spaces & charts governance</a><a href="${LINKS.govCohorts}" target="_blank" rel="noopener">Cohort governance</a><a href="${LINKS.cohorts}" target="_blank" rel="noopener">Cohorts</a><a href="${LINKS.replay}" target="_blank" rel="noopener">Session replay</a><a href="${LINKS.dash}" target="_blank" rel="noopener">Finding dashboards</a><a href="${LINKS.dict}" target="_blank" rel="noopener">Dictionary</a></div>
    </div>`; },
  release(d){ const c=finalChecks(d), n=c.filter(x=>x.on).length;
    return head('Step 11 · Before you call the feature released','The checklist',`${n} of ${c.length} items are ticked from what you did in the steps. An unticked item points at the step to finish.`,'all ten are ticked and you have pressed Released.')+
    `<div class="card-body"><div class="checks">${c.map(x=>`<div class="check auto ${x.on?'on':''}"><span class="cb"></span><span><span class="ct">${esc(x.t)}</span></span></div>`).join('')}</div>
    ${check('tog','released',d.released,'Released','Set a reminder for one month from today: go back and look. Did the number move? That is the loop closing, and the only reason any of this happened.')}
    ${d.released&&d.releasedAt?`<div class="note ok">Released ${esc(new Date(d.releasedAt).toLocaleDateString())}. Check the dashboard on <b>${esc(new Date(new Date(d.releasedAt).getTime()+30*864e5).toLocaleDateString())}</b>.</div>`:''}
    <div class="q"><div class="label">Who to ask</div><div class="contacts"><div class="contact"><b>${esc(CFG.CONTACTS?CFG.CONTACTS.cohorts:'Analytics')}</b><span>Cohorts and Session Replay setup</span></div><div class="contact"><b>${esc(CFG.CONTACTS?CFG.CONTACTS.governance:'Governance')}</b><span>Governance, naming, the feature map</span></div><div class="contact"><b>Quotas</b><span>300k MTU/month · 10,000 session replays/month</span></div></div></div>
    </div>`; }
};

/* ---------------- app ---------------- */
const App={
  view:'list', cur:null, features:[], all:[], cqType:'count', saveTimer:null, saveState:'',
  async start(){
    await Store.init();
    this.view = Store.mode==='cloud' && !Store.user ? 'signin' : 'list';
    await this.render();
  },
  async loadList(){ try{ this.features=await Store.list(); }catch(e){ this.features=[]; toast('Could not load features: '+e.message); } },
  async loadAll(){ try{ this.all=await Store.listAll(); }catch(e){ this.all=[]; toast('Could not load the map: '+e.message); } },
  touch(){ const f=this.cur; f.title=f.data.feature.trim()||'(untitled)'; f.status=statusOf(f.data); this.saveState='Saving…'; this.renderSave();
    clearTimeout(this.saveTimer); this.saveTimer=setTimeout(()=>this.flush(f),600);
    if(!this.maxTimer) this.maxTimer=setTimeout(()=>this.flush(f),2500); },
  async flush(f){ f=f||this.cur; clearTimeout(this.saveTimer); clearTimeout(this.maxTimer); this.saveTimer=null; this.maxTimer=null; if(!f) return;
    try{ await Store.save(f); this.saveState='Saved'; }catch(e){ this.saveState='Not saved: '+e.message; } this.renderSave(); },
  renderSave(){ const el=$('#saveState'); if(el){ el.textContent=this.saveState; el.className='savestate'+(this.saveState==='Saved'?' ok':''); } },
  async render(){
    const top=$('#topbar');
    const acct = Store.mode==='cloud' ? (Store.user?`${Store.isAdmin?'<span class="pill" style="color:var(--accent);border-color:var(--accent-line)">Admin</span>':''}<span class="pill">${esc(Store.user.email)}</span><button class="linkbtn" id="signout">Sign out</button>`:'') : `<span class="pill" title="Add Supabase keys in config.js to turn on sign-in">Saving in this browser only</span>`;
    top.innerHTML=`<div class="brand"><div class="mark">A</div><div><h1>Amplitude PM Flow</h1><small>From the gate on the epic to a dashboard nobody has to explain</small></div></div>
      <div class="tabs">${this.view!=='signin'?`<button class="tab ${this.view==='list'?'on':''}" data-view="list">My features</button>${(Store.isAdmin||Store.mode==='local')?`<button class="tab ${this.view==='map'?'on':''}" data-view="map">Feature map</button>`:''}`:''}${this.view==='feature'?`<span class="savestate" id="saveState">${esc(this.saveState)}</span>`:''}</div>
      <div class="acct">${acct}</div>`;
    top.querySelectorAll('[data-view]').forEach(b=>b.onclick=async()=>{if(this.cur&&this.saveTimer) await this.flush(); this.view=b.dataset.view;this.cur=null;this.render();});
    const so=$('#signout'); if(so) so.onclick=async()=>{await Store.signOut(); this.view='signin'; this.cur=null; this.render();};
    const main=$('#main');
    if(this.view==='signin') return this.renderSignin(main);
    if(this.view==='list'){ await this.loadList(); return this.renderList(main); }
    if(this.view==='map'){ await this.loadAll(); return this.renderMap(main); }
    return this.renderFeature(main);
  },
  renderSignin(main){
    const dom=CFG.ALLOWED_EMAIL_DOMAIN||'company.com'; let last=''; try{ last=localStorage.getItem('pm-flow-last-email')||''; }catch(e){}
    const local=last.includes('@')?last.split('@')[0]:last;
    main.innerHTML=`<div class="signin"><h2>Sign in</h2><p>Your work email and a password of your choice.</p>
      <div class="field" style="flex-direction:column;align-items:stretch;gap:8px">
        <div style="display:flex;align-items:center;gap:0;border:1.5px solid var(--line);border-radius:10px;overflow:hidden"><input id="email" type="text" style="border:0;border-radius:0;flex:1;min-width:0" placeholder="firstname.lastname" value="${esc(local)}" autocomplete="username" autocapitalize="off" spellcheck="false"><span style="padding:0 12px;color:var(--muted);white-space:nowrap;background:var(--bg);align-self:stretch;display:flex;align-items:center">@${esc(dom)}</span></div>
        <input id="pw" type="password" class="wide" placeholder="Password (8+ characters)" autocomplete="current-password"></div>
      <div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn primary" id="signBtn">Sign in</button><span class="status" id="signMsg"></span></div>
      <div id="createBox" hidden style="margin-top:18px;padding:14px;border:1px solid var(--warn);border-radius:12px;background:var(--warn-soft)">
        <div style="font-weight:600">No account matches that email and password.</div>
        <div class="hint" style="margin:6px 0 10px">If this is your first time, check the address below carefully, repeat the password and create the account. If you already have an account, the password was wrong.</div>
        <div class="gen" id="confirmEmail" style="font-size:15px;margin-bottom:10px"></div>
        <input id="pw2" type="password" class="wide" placeholder="Repeat the password" autocomplete="new-password" style="width:100%;margin-bottom:10px">
        <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="createBtn">Yes, create my account</button><button class="btn" id="fixBtn">Let me fix the email</button></div></div>
      ${CFG.MICROSOFT_SSO?`<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)"><button class="btn" id="msBtn">Continue with Microsoft 365</button></div>`:''}</div>`;
    const msg=$('#signMsg'), box=$('#createBox');
    const go=async()=>{const em=Store.normEmail($('#email').value), pw=$('#pw').value; if(!em.split('@')[0]||!pw) return; box.hidden=true;
      try{ msg.textContent='Signing in…'; const r=await Store.signIn(em,pw); if(r==='in'){ msg.textContent='Signed in.'; try{localStorage.setItem('pm-flow-last-email',em);}catch(e){} } else { msg.textContent=''; $('#confirmEmail').textContent=em; $('#pw2').value=''; box.hidden=false; $('#pw2').focus(); } }
      catch(e){ msg.textContent=e.message; }};
    $('#signBtn').onclick=go; $('#pw').onkeydown=e=>{if(e.key==='Enter')go();}; $('#email').onkeydown=e=>{if(e.key==='Enter')$('#pw').focus();};
    $('#fixBtn').onclick=()=>{box.hidden=true; $('#email').focus(); $('#email').select();};
    $('#createBtn').onclick=async()=>{const em=Store.normEmail($('#email').value), pw=$('#pw').value, pw2=$('#pw2').value; if(pw!==pw2){ msg.textContent='The two passwords differ.'; return; }
      try{ msg.textContent='Creating…'; await Store.createAccount(em,pw); try{localStorage.setItem('pm-flow-last-email',em);}catch(e){} msg.textContent='Account created.'; }catch(e){ msg.textContent=e.message; box.hidden=true; }};
    const ms=$('#msBtn'); if(ms) ms.onclick=async()=>{ try{ await Store.signInMicrosoft(); }catch(e){ msg.textContent=e.message; } };
  },
  renderList(main){
    const rows=this.features.map(f=>{const d=f.data; const n=STEPS.length; const cur=statusOf(d);
      return `<button class="frow" data-open="${f.id}"><span class="ft">${esc(f.title||'(untitled)')}</span><span class="fm"><span class="tag ${cur==='released'?'acc':''}">${esc(statusLabel(f.status))}</span>${d.productLine?`<span>${esc(d.productLine)}</span>`:''}<span>updated ${esc(new Date(f.updated_at).toLocaleDateString())}</span></span>
        <span class="prog" aria-hidden="true">${STEPS.map((s,i)=>`<i class="${d.gate==='no'?(i===0?'d':''):stepDone(d,i)?'d':(String(i)===cur?'c':'')}"></i>`).join('')}</span></button>`;}).join('');
    main.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:20px 0 14px"><div><h2 style="font-size:22px">My features</h2><p class="status">Each feature keeps its own place in the flow. Open one to continue.</p></div><button class="btn primary" id="newF">+ New feature</button></div>
      ${rows?`<div class="list">${rows}</div>`:`<div class="empty">No features yet. Start with the one you are shipping next.</div>`}`;
    $('#newF').onclick=async()=>{const f=newFeature(); this.cur=f; this.view='feature'; this.saveState=''; await this.render();};
    main.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{this.cur=this.features.find(x=>x.id===b.dataset.open); this.cur.data=Object.assign(blankData(),this.cur.data); this.view='feature'; this.saveState='Saved'; this.render();});
  },
  renderMap(main){
    const by={}; this.all.forEach(f=>{const s=f.status==='not-needed'?'Not needed':f.status==='released'?'Released':'In progress'; by[s]=(by[s]||0)+1;});
    const rows=this.all.map(f=>`<tr data-openany="${f.id}" style="cursor:pointer"><td><b>${esc(f.title||'(untitled)')}</b></td><td>${esc(f.data&&f.data.productLine||'')}</td><td>${esc(f.data&&(f.data.roles||[]).join(', ')||'')}</td><td>${esc(statusLabel(f.status))}</td><td>${esc(f.owner_email||'')}</td><td>${esc(new Date(f.updated_at).toLocaleDateString())}</td></tr>`).join('');
    main.innerHTML=`<div style="margin:20px 0 14px"><h2 style="font-size:22px">Feature map</h2><p class="status">Every feature anyone has run through the flow, with where it stands. Admins only. ${Store.mode==='local'?'Local mode: only this browser’s features.':''}</p></div>
      <div class="stat-row" style="margin-bottom:14px"><div class="stat"><div class="v">${this.all.length}</div><div class="l">features</div></div><div class="stat"><div class="v">${by['Released']||0}</div><div class="l">released with a dashboard</div></div><div class="stat"><div class="v">${by['In progress']||0}</div><div class="l">in progress</div></div><div class="stat"><div class="v">${by['Not needed']||0}</div><div class="l">not needed</div></div></div>
      ${rows?`<div class="card" style="padding:4px 8px"><div class="tbl-wrap"><table class="tbl"><tr><th>Feature</th><th>Product line</th><th>Users</th><th>Status</th><th>Owner</th><th>Updated</th></tr>${rows}</table></div></div><p class="status" style="margin-top:8px">Tap a row to open it.</p>`:`<div class="empty">Nothing on the map yet.</div>`}`;
    main.querySelectorAll('[data-openany]').forEach(r=>r.onclick=()=>{this.cur=this.all.find(x=>x.id===r.dataset.openany); this.cur.data=Object.assign(blankData(),this.cur.data); this.view='feature'; this.saveState='Saved'; this.render();});
  },
  renderFeature(main){
    const f=this.cur, d=f.data, i=d.step;
    const notNeeded=d.gate==='no';
    const rail=STEPS.map((s,j)=>{const grp=(j===0||STEPS[j-1].g!==s.g)?`<div class="group">${s.g}</div>`:''; const locked=notNeeded&&j>0; return grp+`<button class="${j===i?'cur':''} ${stepDone(d,j)?'done':''} ${locked?'locked':''}" data-i="${j}" ${locked?'disabled':''}><span class="n">${stepDone(d,j)?'✓':j+1}</span><span class="t">${s.t}</span></button>`;}).join('');
    const done=stepDone(d,i), last=i===STEPS.length-1;
    main.innerHTML=`<div class="shell"><nav class="rail" id="rail" aria-label="Steps">${rail}<div class="group">&nbsp;</div><button data-back-list><span class="n">←</span><span class="t">All features</span></button><button data-delete><span class="n">✕</span><span class="t" style="color:var(--bad)">Delete this feature</span></button></nav>
      <section class="card" id="card">${Screens[STEPS[i].k](d)}
      <div class="card-foot"><button class="btn" id="back" ${i===0?'disabled':''}>← Back</button><span class="status ${done?'ok':''}">${done?'✓ Step complete':(notNeeded?'':'Not finished yet — you can still move on')}</span><button class="btn primary" id="next" ${(last||notNeeded)?'disabled':''}>${last?'End of the flow':'Next →'}</button></div></section></div>`;
    main.querySelectorAll('#rail [data-i]').forEach(b=>b.onclick=()=>this.goto(+b.dataset.i));
    $('#back').onclick=()=>this.goto(i-1); $('#next').onclick=()=>this.goto(i+1);
    main.querySelector('[data-back-list]').onclick=async()=>{if(this.saveTimer) await this.flush(); this.view='list';this.cur=null;this.render();};
    const del=main.querySelector('[data-delete]'); del.onclick=async()=>{ if(!del.dataset.arm){ del.dataset.arm='1'; del.querySelector('.t').textContent='Tap again to delete'; setTimeout(()=>{delete del.dataset.arm; del.querySelector('.t').textContent='Delete this feature';},2500); return; } try{ await Store.remove(f.id); toast('Deleted'); this.view='list'; this.cur=null; this.render(); }catch(e){ toast('Could not delete: '+e.message); } };
    this.wire(main);
  },
  goto(j){ this.cur.data.step=Math.max(0,Math.min(STEPS.length-1,j)); this.touch(); this.renderFeature($('#main')); window.scrollTo({top:0}); },
  upd(fn){ fn(this.cur.data); this.touch(); this.renderFeature($('#main')); },
  wire(main){
    const d=this.cur.data, card=$('#card'), U=fn=>this.upd(fn);
    card.querySelectorAll('[data-gate]').forEach(b=>b.onclick=()=>U(x=>{x.gate=b.dataset.gate;}));
    const fi=$('#fname'); if(fi){ fi.oninput=()=>{d.feature=fi.value; const s=$('#slugOut'); if(s) s.textContent=N.slug(d); this.touch();}; fi.onblur=()=>this.renderFeature(main); fi.onkeydown=e=>{if(e.key==='Enter')fi.blur();}; }
    const jk=$('#jkey'); if(jk){ jk.oninput=()=>{d.jira.key=jk.value; this.touch();}; }
    card.querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>U(x=>{x.productLine=b.dataset.pl;}));
    card.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>U(x=>{const r=b.dataset.role; x.roles=x.roles.includes(r)?x.roles.filter(v=>v!==r):[...x.roles,r];}));
    card.querySelectorAll('[data-tenant]').forEach(b=>b.onclick=()=>U(x=>{const r=b.dataset.tenant; x.tenants=x.tenants.includes(r)?x.tenants.filter(v=>v!==r):[...x.tenants,r];}));
    card.querySelectorAll('[data-cmp]').forEach(b=>b.onclick=()=>U(x=>{const r=b.dataset.cmp; x.compare=x.compare.includes(r)?x.compare.filter(v=>v!==r):[...x.compare,r];}));
    card.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>U(x=>{x.journey.push({id:uid().slice(0,8),v:b.dataset.add,where:null,el:'btn',props:[],role:x.roles[0]||null});}));
    card.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>U(x=>{x.journey.splice(+b.dataset.rm,1);}));
    card.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>U(x=>{const [i,s]=b.dataset.mv.split(':').map(Number); const j=i+s; if(j<0||j>=x.journey.length) return; [x.journey[i],x.journey[j]]=[x.journey[j],x.journey[i]];}));
    card.querySelectorAll('[data-mrole]').forEach(b=>b.onclick=()=>U(x=>{const [i,r]=b.dataset.mrole.split(':'); x.journey[+i].role=r;}));
    card.querySelectorAll('[data-mwhere]').forEach(b=>b.onclick=()=>U(x=>{const [i,w]=b.dataset.mwhere.split(':'); x.journey[+i].where=w;}));
    card.querySelectorAll('[data-mel]').forEach(b=>b.onclick=()=>U(x=>{const [i,e]=b.dataset.mel.split(':'); x.journey[+i].el=e;}));
    card.querySelectorAll('[data-mprop]').forEach(b=>b.onclick=()=>U(x=>{const [i,p]=b.dataset.mprop.split(':'); const m=x.journey[+i]; m.props=m.props||[]; m.props=m.props.includes(p)?m.props.filter(v=>v!==p):[...m.props,p];}));
    card.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>U(x=>{const id=b.dataset.q; x.qOff=x.qOff.includes(id)?x.qOff.filter(v=>v!==id):[...x.qOff,id];}));
    card.querySelectorAll('[data-rmq]').forEach(b=>b.onclick=e=>{e.stopPropagation(); U(x=>{x.custom.splice(+b.dataset.rmq,1);});});
    card.querySelectorAll('[data-cqtype]').forEach(b=>b.onclick=()=>{this.cqType=b.dataset.cqtype; card.querySelectorAll('[data-cqtype]').forEach(o=>o.classList.toggle('on',o===b));});
    const addq=$('#addq'); if(addq){ const add=()=>{const t=$('#cq').value.trim(); if(!t) return toast('Write the question first'); U(x=>{x.custom.push({id:'c'+uid().slice(0,8),text:t,type:this.cqType});});}; addq.onclick=add; $('#cq').onkeydown=e=>{if(e.key==='Enter')add();}; }
    card.querySelectorAll('[data-tog]').forEach(b=>b.onclick=()=>U(x=>{const k=b.dataset.tog; if(k==='jira.pasted') x.jira.pasted=!x.jira.pasted; else if(k==='released'){ x.released=!x.released; x.releasedAt=x.released?new Date().toISOString():null; } else x[k]=!x[k];}));
    card.querySelectorAll('[data-dev]').forEach(b=>b.onclick=()=>U(x=>{x.dev[b.dataset.dev]=!x.dev[b.dataset.dev];}));
    card.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>U(x=>{x.demo[b.dataset.demo]=!x.demo[b.dataset.demo];}));
    card.querySelectorAll('[data-build]').forEach(b=>b.onclick=()=>U(x=>{x.build[b.dataset.build]=!x.build[b.dataset.build];}));
    card.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copyText(({q:qText,jira:jiraText,demo:demoText,build:buildText})[b.dataset.copy](d),b));
  }
};
window.PMFlow={App,Store,STEPS,N,suggested,allQuestions,jiraText,demoText,buildText,finalChecks,statusOf,blankData};
document.addEventListener('DOMContentLoaded',()=>App.start());
window.addEventListener('pagehide',()=>{ if(App.cur&&App.saveTimer) App.flush(); });
})();
