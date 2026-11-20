/* IntegrityOS — no CDN, no dependencies, no external analytics. */
const $ = s => document.querySelector(s);
const app = $('#app');
const labels = {admin:'Адміністратор',leader:'Керівник',analyst:'Аналітик',participant:'Учасник'};
const nav = [
  ['dashboard','Огляд системи','◫'], ['survey','Пройти опитування','▤'],
  ['comparison','Порівняльний аналіз','⌁'], ['recommendations','План покращень','◎'],
  ['checklist','Контрольний чек-лист','☷'], ['reports','Звіти та експорт','▧'],
  ['method','Методика та безпека','◇'], ['integration','Інтеграція','⬡'],
  ['audit','Журнал дій','≡'], ['settings','Управління','⚙']
];
const state = {
  config:null,user:null,page:(location.hash.replace('#','')||'dashboard'),cycle:null,dashboard:null,
  evidence:[],actions:[],audit:[],public:null,modal:null,toast:'',busy:false,cohort:'personnel',step:0,answers:{},
  reportMinutes:{survey:4,manualExtra:180,autoSurvey:.4,autoExtra:25}
};
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n===null||n===undefined?'—':new Intl.NumberFormat('uk-UA',{maximumFractionDigits:1}).format(n);
const pct=n=>n==null?'—':`${fmt(n)}%`;
const cy=id=>(state.config?.cycles||[]).find(c=>c.id===Number(id));
const dim=id=>state.config.dimensions.find(d=>d.id===id);
const mood=x=>x==null?'muted':x>=75?'green':x>=55?'amber':'red';
const roleCan=(...a)=>state.user&&a.includes(state.user.role);
const badge=(txt,kind='neutral')=>`<span class="chip ${kind}">${h(txt)}</span>`;
const fmtdate=s=>s?new Date(s).toLocaleDateString('uk-UA'): '—';
const icons={clock:'◷',trend:'↗',shield:'⬡',flag:'⚑',check:'✓'};
function toast(t){state.toast=t;render();setTimeout(()=>{if(state.toast===t){state.toast='';const el=$('.toast');if(el)el.remove();}},4000)}
async function api(path,options={}){
  const resp=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...options});
  let body; try{body=await resp.json()}catch{body={error:`HTTP ${resp.status}`}}
  if(!resp.ok)throw Error(body.error||`HTTP ${resp.status}`);
  return body;
}
async function post(path,data){return api(path,{method:'POST',body:JSON.stringify(data)});}
function setPage(p){state.page=p;location.hash=p;state.modal=null;load();}
function cycleOptions(){return (state.config?.cycles||[]).map(c=>`<option value="${c.id}" ${Number(state.cycle)===c.id?'selected':''}>${h(c.title)} · ${h(c.period)}</option>`).join('')}
async function bootstrap(){
  try{
    state.config=await api('/api/config');state.cycle=state.config.cycles[0]?.id;
    state.user=(await api('/api/me')).user;
    if(!state.user&&!['survey','method'].includes(state.page))state.page='welcome';
    await load();
  }catch(e){app.innerHTML=`<div class="center-error">${h(e.message)}<button onclick="location.reload()">Спробувати знову</button></div>`;}
}
async function load(){
  state.busy=true;
  try{
    const p=state.page;
    if(p==='dashboard'||p==='comparison'||p==='recommendations'||p==='reports'){
      if(state.user?.role!=='participant' && state.user){
        state.dashboard=await api('/api/dashboard?cycle='+state.cycle);
        if(p==='recommendations')state.actions=(await api('/api/actions')).items;
      } else {state.public=await api('/api/public/summary?cycle='+state.cycle)}
    }
    if(p==='checklist'&&roleCan('admin','analyst','leader'))state.evidence=(await api('/api/evidence?cycle='+state.cycle)).items;
    if(p==='settings')state.config=await api('/api/config');
    if(p==='audit'&&roleCan('admin','analyst'))state.audit=(await api('/api/audit')).items;
  }catch(e){state.toast=e.message; if(e.message.includes('авторизація')){state.user=null;state.page='welcome';}}
  state.busy=false;render();
}
function ring(value,small=false){
  const r=small?42:73, size=small?112:190, center=size/2, stroke=small?10:13;
  const c=2*Math.PI*r, v=value??0;
  const color=v>=75?'#51d9b2':v>=55?'#f1b969':'#f18c8d';
  return `<div class="ring-wrap ${small?'small':''}"><svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Індекс ${fmt(value)} зі 100">
   <circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="#27344d" stroke-width="${stroke}"/>
   <circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" transform="rotate(-90 ${center} ${center})" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-v/100)}"/>
   </svg><div class="ring-text"><strong>${fmt(value)}</strong><small>/ 100</small></div></div>`;
}
function historyChart(items){
  if(!items?.length)return '<div class="empty-graph">Немає оцінювань для побудови динаміки</div>';
  const plotted=items.filter(i=>i.index!==null);
  if(!plotted.length)return '<div class="empty-graph">Недостатньо даних для графіка</div>';
  const x=i=>45+(plotted.length===1?.5:(i/(plotted.length-1)))*(620-80);
  const y=v=>170-v*1.35;
  let points=plotted.map((i,n)=>`${x(n)},${y(i.index)}`).join(' ');
  return `<svg class="line-svg" viewBox="0 0 620 220" preserveAspectRatio="none" role="img" aria-label="Динаміка індексу">
   ${[20,40,60,80,100].map(n=>`<line x1="38" y1="${y(n)}" x2="590" y2="${y(n)}" stroke="#263754" stroke-dasharray="3 5"/><text x="4" y="${y(n)+4}" fill="#8292ab" font-size="12">${n}</text>`).join('')}
   <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#51d9b2" stop-opacity=".28"/><stop offset="100%" stop-color="#51d9b2" stop-opacity="0"/></linearGradient></defs>
   <polygon points="${x(0)},178 ${points} ${x(plotted.length-1)},178" fill="url(#areaFill)"/>
   <polyline fill="none" stroke="#51d9b2" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>
   ${plotted.map((i,n)=>`<circle cx="${x(n)}" cy="${y(i.index)}" r="5" fill="#51d9b2" stroke="#162239" stroke-width="3"/><text x="${x(n)}" y="${y(i.index)-15}" text-anchor="middle" fill="#d4e8ee" font-size="13">${fmt(i.index)}</text><text x="${x(n)}" y="207" text-anchor="middle" fill="#9ca9bf" font-size="12">${h(i.cycle.period)}</text>`).join('')}
  </svg>`;
}
function horizontalBar(d){return `<div class="stat-row"><div class="stat-top"><span class="stat-label">${h(d.name)}</span><b>${fmt(d.score)} <small>/100</small></b></div><div class="bar"><div class="fill ${mood(d.score)}" style="width:${Math.max(0,d.score||0)}%"></div></div><div class="stat-sub">${h(d.short||'')}${d.score==null?'<span class="warn-inline">Недостатньо безпечних даних</span>':''}</div></div>`}
function formatWhy(s){return h(s)}
function renderTopbar(){return `<header class="topbar"><div class="breadcrumb"><span class="back-dot">⬡</span><span>IntegrityOS</span><span class="slash">/</span><strong>${h((nav.find(x=>x[0]===state.page)||['', 'Платформа'])[1])}</strong></div><div class="top-controls"><span class="demo-marker">● ДЕМОНСТРАЦІЙНІ ДАНІ</span>${state.user&&state.page!=='survey'?`<select class="cycle-select" id="cycle-select" aria-label="Цикл оцінювання">${cycleOptions()}</select>`:''}<div class="avatar" title="${h(state.user?.login||'Гість')}">${h(state.user?.login?.[0]?.toUpperCase()||'?')}</div></div></header>`}
function sidebar(){
  return `<aside class="sidebar"><div class="brand" data-nav="dashboard"><div class="brand-mark">✦</div><div><strong>INTEGRITY<span>OS</span></strong><small>СИСТЕМА ДОБРОЧЕСНОСТІ</small></div></div>
  <div class="side-caption">РОБОЧИЙ ПРОСТІР</div>
  <nav class="side-nav">${nav.filter(([p])=>{
    if(!state.user)return ['survey','method'].includes(p);
    if(state.user.role==='participant')return ['survey','method'].includes(p);
    if(p==='settings')return roleCan('admin');
    if(p==='audit')return roleCan('admin','analyst');
    return true;
  }).map(([p,t,ic])=>`<button class="nav-item ${state.page===p?'active':''}" data-nav="${p}"><span class="nav-glyph">${ic}</span>${h(t)}${p==='recommendations'&&state.actions.filter(a=>a.status==='in_progress').length?`<i>${state.actions.filter(a=>a.status==='in_progress').length}</i>`:''}</button>`).join('')}</nav>
  <div class="sidebar-bottom"><div class="privacy-box"><span>⬡</span><div><b>Privacy by Design</b><small>Без персональних відповідей та зовнішніх хмар</small></div></div><div class="profile"><div class="profile-icon">${h(state.user?.login?.[0]?.toUpperCase()||'?')}</div><div><b>${h(state.user?.login||'Гість')}</b><small>${h(labels[state.user?.role]||'Анонімний учасник')}</small></div>${state.user?'<button class="icon-btn" data-action="logout" title="Вийти">⏻</button>':''}</div></div></aside>`;
}
function frame(content){return `<div class="shell">${sidebar()}<main class="workspace">${renderTopbar()}<div class="content">${content}</div><footer class="footer"><span>© 2026 IntegrityOS · Демонстраційний MVP</span><span>Платформа розвитку, не покарання · Усі дані синтетичні</span></footer></main></div>${state.modal?modal():''}${state.toast?`<div class="toast">${h(state.toast)}</div>`:''}`}
function head(kicker,title,subtitle,right=''){return `<div class="page-head"><div><div class="eyebrow">${h(kicker)}</div><h1>${h(title)}</h1><p>${h(subtitle)}</p></div>${right?`<div class="head-action">${right}</div>`:''}</div>`}
function kpi(label,value,description,ic,style=''){return `<div class="kpi ${style}"><div class="kpi-icon">${ic}</div><div class="kpi-label">${h(label)}</div><div class="kpi-value">${value}</div><div class="kpi-foot">${description}</div></div>`}
function dashboard(){
  if(!state.dashboard)return `<div class="empty">Потрібно авторизуватися для перегляду повної аналітики.</div>`;
  const d=state.dashboard.current, history=state.dashboard.history;
  const histValues=history.map(i=>i.index).filter(v=>v!=null);
  const diff=histValues.length>1?histValues.at(-1)-histValues.at(-2):null;
  const weak=[...d.dimensions].filter(x=>x.score!=null).sort((a,b)=>a.score-b.score)[0];
  return head('АНАЛІТИЧНИЙ ЦЕНТР','Панель керівника','Ключові індикатори розвитку доброчесності установи',`<button class="btn accent" data-nav="survey">＋ Нове опитування</button>`)+
  `<div class="hero-grid"><section class="panel hero-score"><div class="overline">ЗАГАЛЬНИЙ ПОКАЗНИК</div><div class="hero-score-row">${ring(d.index)}<div class="hero-score-info"><div class="soft-label">INTEGRITY INDEX</div><h2>${h(d.level)}</h2><p>Інтегральна оцінка зрілості системи доброчесності</p>${badge(d.index===null?'Оцінювання триває':diff===null?'Базове оцінювання':`${diff>=0?'+':''}${fmt(diff)} п. до минулого циклу`,diff!=null&&diff<0?'danger':'success')}</div></div><div class="method-foot">Модель: 70% анонімне опитування · 30% контрольні індикатори</div></section>
  <section class="panel chart-panel"><div class="panel-title"><div><h3>Динаміка доброчесності</h3><p>Порівняння циклів оцінювання</p></div><span class="small-pill">2026</span></div>${historyChart(history)}</section></div>
  <div class="kpi-grid">${kpi('Учасники опитування',fmt(d.respondents),`Безпечно враховані групи`, '◉')}${kpi('Складові оцінювання',d.dimensions.length,'Прозора формула із вагами','▥')}${kpi('Зони уваги',d.dimensions.filter(x=>x.score!=null&&x.score<70).length,`Потрібні заходи розвитку`,'⚑','kpi-warning')}${kpi('Розбіжності',d.alerts.length,'Самооцінювання vs індикатори','⌁')}</div>
  <div class="two-col"><section class="panel"><div class="panel-title"><div><h3>Профіль компонентів</h3><p>Індекс за чотирма напрямами</p></div><button class="text-button" data-nav="comparison">Детальніше ↗</button></div>${d.dimensions.map(horizontalBar).join('')}</section>
  <section class="panel"><div class="panel-title"><div><h3>Сигнали для керівника</h3><p>Автоматично визначені точки уваги</p></div></div>
  <div class="insights">${weak?`<div class="insight"><div class="insight-icon amber">⚑</div><div><b>Найслабший напрям: ${h(weak.name)}</b><p>Значення ${fmt(weak.score)}/100. Рекомендовано запланувати заходи покращення.</p></div></div>`:''}${d.alerts.map(a=>`<div class="insight"><div class="insight-icon red">⌁</div><div><b>${h(a.label)}: розбіжність ${fmt(Math.abs(a.gap))} п.</b><p>${h(a.text)}. Потрібна додаткова перевірка.</p></div></div>`).join('')}
  ${d.suppressed_groups?`<div class="insight"><div class="insight-icon green">⬡</div><div><b>Анонімність під захистом</b><p>${d.suppressed_groups} груп приховано, оскільки в них менше ${state.config.min_group} відповідей.</p></div></div>`:''}${!weak&&!d.alerts.length?'<div class="empty">Критичних сигналів поки немає</div>':''}</div>
  <button class="btn subtle wide" data-nav="recommendations">Перейти до управлінських рекомендацій <span>↗</span></button></section></div>`;
}
function survey(){
  const current=state.config?.cycles.find(c=>c.is_open);
  const q=state.config.questions[state.step];
  if(!current)return head('ОПИТУВАННЯ','Анонімна оцінка','Наразі немає активного циклу оцінювання')+'<div class="panel padded">Зверніться до адміністратора.</div>';
  return head('ЦИФРОВИЙ ОПИТУВАЛЬНИК','Ваш голос має значення','Результати використовують для розвитку системи доброчесності, а не для оцінки окремих осіб')+
    `<div class="survey-layout"><div class="panel survey-main"><div class="survey-top"><div><div class="eyebrow">${h(current.title)}</div><h2>Анонімне самооцінювання</h2></div>${badge('Без персональних даних','success')}</div>
    <div class="survey-progress"><div class="progress-head"><span>Питання ${state.step+1} з ${state.config.questions.length}</span><b>${Math.round((state.step)/state.config.questions.length*100)}% завершено</b></div><div class="track"><div style="width:${state.step/state.config.questions.length*100}%"></div></div></div>
    <div class="question-section"><div class="q-number">ПИТАННЯ ${String(state.step+1).padStart(2,'0')} / ${state.config.questions.length}</div><h3>${h(q.title)}</h3><p>${h(q.hint)}</p><div class="answer-list">${state.config.scale.map((a,i)=>`<label class="answer ${state.answers[q.id]===i?'selected':''}"><input type="radio" name="answer" data-question="${q.id}" value="${i}" ${state.answers[q.id]===i?'checked':''}><span class="radio-view"></span><span>${h(a)}</span></label>`).join('')}</div></div>
    <div class="survey-actions"><button class="btn outline" data-action="survey-back" ${state.step===0?'disabled':''}>← Назад</button><button class="btn accent" data-action="survey-next" ${state.answers[q.id]===undefined?'disabled':''}>${state.step===state.config.questions.length-1?'Надіслати анонімно':'Наступне питання →'}</button></div></div>
    <div class="survey-side"><section class="panel padded"><div class="panel-title"><h3>Категорія учасника</h3></div><p class="helper">Оберіть лише широку категорію. ПІБ, підрозділ, IP і електронна пошта не збираються.</p><select id="survey-cohort" class="select-full">${state.config.cohorts.map(c=>`<option value="${c.id}" ${state.cohort===c.id?'selected':''}>${h(c.name)}</option>`).join('')}</select></section><section class="panel padded privacy-explainer"><div class="privacy-big">⬡</div><h3>Гарантія анонімності</h3><p>На сервер надходять лише бали за питаннями. Вони одразу додаються до групових сум. Окремі анкети не зберігаються.</p><p>Результати групи відображаються тільки після ${state.config.min_group} відповідей.</p></section></div></div>`;
}
function comparison(){
  if(!state.dashboard)return '<div class="empty">Доступно тільки для уповноважених ролей.</div>';
  const d=state.dashboard.current;
  return head('АНАЛІТИКА','Порівняльний аналіз','Зіставлення анонімних оцінок різних категорій та підтверджувальних індикаторів')+
  `<div class="kpi-grid">${kpi('Враховано відповідей',fmt(d.respondents),'Безпечні агреговані результати','◉')}${kpi('Порогова група',state.config.min_group,'Менші групи не відображаються','⬡')}${kpi('Проблемні відхилення',d.alerts.length,'Абсолютна розбіжність ≥ 20 пунктів','⌁')}${kpi('Останній індекс',fmt(d.index),'Зважений бал із 100','◫')}</div>
  <div class="panel full-panel"><div class="panel-title"><div><h3>Самооцінка проти контрольного чек-листа</h3><p>Різниця є сигналом для аналізу, не доказом порушення</p></div></div>
  <div class="table-scroll"><table><thead><tr><th>Компонент</th><th>Опитування (70%)</th><th>Чек-лист (30%)</th><th>Розбіжність</th><th>Підсумок</th></tr></thead><tbody>
  ${d.dimensions.map(x=>`<tr><td><span class="color-dot" style="background:${x.color}"></span><b>${h(x.name)}</b></td><td>${fmt(x.survey)}</td><td>${fmt(x.objective)}</td><td>${badge(x.gap==null?'—':`${x.gap>0?'+':''}${fmt(x.gap)} п.`,x.gap!=null&&Math.abs(x.gap)>=20?'danger':'neutral')}</td><td><b>${fmt(x.score)}</b></td></tr>`).join('')}</tbody></table></div></div>
  <div class="panel full-panel"><div class="panel-title"><div><h3>Порівняння груп учасників</h3><p>Для захисту анонімності малі групи виключені також із загального агрегату</p></div>${badge('k ≥ '+state.config.min_group,'success')}</div>
  <div class="table-scroll"><table><thead><tr><th>Категорія учасників</th><th>Відповідей</th>${d.dimensions.map(x=>`<th>${h(x.name)}</th>`).join('')}</tr></thead><tbody>
  ${d.groups.map(g=>`<tr><td><b>${h(g.name)}</b></td><td>${g.suppressed?badge('Приховано','danger'):g.count}</td>${d.dimensions.map(x=>`<td>${g.suppressed?'<span class="muted">🔒</span>':fmt(g.dimensions[x.id])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>
  <div class="notice"><strong>Про інтерпретацію:</strong> оцінки не можна використовувати для рейтингу або покарання керівників чи персоналу. Значення індикаторів демонстраційні, їх походження потребує підтвердження документами в реальному середовищі.</div>`;
}
function recs(){
  if(!state.dashboard)return '<div class="empty">Потрібна авторизація.</div>';
  const generated=state.dashboard.recommendations;
  const all=state.actions.filter(x=>x.cycle_id==state.cycle);
  return head('УПРАВЛІНСЬКІ РІШЕННЯ','Рекомендації та план дій','Зрозуміле правило → рішення посадової особи → відповідальний → перевірка наступним циклом')+
    `<div class="kpi-grid">${kpi('Автоматичні рекомендації',generated.length,'Сформовано за прозорими правилами','◇')}${kpi('Прийняті заходи',all.length,'Затверджено людиною','✓')}${kpi('У процесі',all.filter(x=>x.status==='in_progress').length,'Потребують виконання','◷')}${kpi('Виконано',all.filter(x=>x.status==='done').length,'Підлягають перевірці','⬡')}</div>
    <div class="section-split"><div class="section-title"><h2>Рекомендації системи</h2><p>Автоматична генерація без зовнішнього ШІ</p></div>${badge('Рішення затверджує людина','success')}</div>
    <div class="recommendation-grid">${generated.length?generated.map((r,i)=>`<section class="panel rec-card"><div class="rec-upper"><div class="rec-icon">${i+1}</div>${badge(r.priority,r.priority==='Критичний'?'danger':'warning')}</div><h3>${h(r.title)}</h3><p>${h(r.description)}</p><div class="rec-why"><b>Чому запропоновано:</b> ${formatWhy(r.why)}</div><div class="rec-target">Цільовий результат: ${h(r.target)}</div>${roleCan('admin','leader')?`<button class="btn accent wide" data-action="accept-rec" data-index="${i}">Прийняти в план дій ↗</button>`:'<span class="muted">Прийняття доступне керівнику</span>'}</section>`).join(''):'<div class="panel padded empty">За заданими демонстраційними правилами нових рекомендацій немає.</div>'}</div>
    <div class="section-split"><div class="section-title"><h2>Затверджений план дій</h2><p>Стан виконання та відповідальні за заходи</p></div></div>
    <div class="panel full-panel"><div class="table-scroll"><table><thead><tr><th>Захід</th><th>Відповідальний</th><th>Строк</th><th>Статус</th><th>Дія</th></tr></thead><tbody>${all.map(a=>`<tr><td><b>${h(a.title)}</b><small class="table-description">${h(a.target)}</small></td><td>${h(a.owner)}</td><td>${h(a.deadline)}</td><td>${badge(statusName(a.status),a.status==='done'?'success':a.status==='cancelled'?'danger':'warning')}</td><td>${roleCan('admin','leader')?`<button class="text-button" data-action="edit-action" data-id="${a.id}">Змінити ↗</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Ще немає прийнятих заходів</td></tr>'}</tbody></table></div></div>`;
}
function statusName(s){return ({accepted:'Затверджено',in_progress:'Виконується',done:'Виконано',cancelled:'Скасовано'})[s]||s}
function checklist(){
  const writable=roleCan('admin','analyst');
  const scores=Object.fromEntries(state.evidence.map(e=>[e.question_id,e]));
  return head('ІНСТИТУЦІЙНА ОЦІНКА','Контрольний чек-лист','Вибрані індикатори з додатка Б методичних рекомендацій НУОУ')+
  `<div class="notice"><strong>Демонстраційна модель.</strong> Статуси: впроваджено повністю (100), частково (50), підлягає впровадженню (0). Це не аудит і не підтвердження реальних фактів. Після зміни індикатора загальний індекс перераховується.</div>
  <div class="panel full-panel"><div class="table-scroll"><table><thead><tr><th>Індикатор</th><th>Джерело</th><th>Статус</th><th>Примітка до доказу</th><th></th></tr></thead><tbody>
  ${state.config.questions.map(q=>{const e=scores[q.id]||{score:0,note:''};return `<tr><td><b>${h(state.config.checklist[q.id].title)}</b></td><td><span class="source-code">${h(state.config.checklist[q.id].source)}</span></td><td><select class="tiny-select" id="score-${q.id}" ${!writable?'disabled':''}><option value="0" ${e.score===0?'selected':''}>Підлягає впровадженню</option><option value="50" ${e.score===50?'selected':''}>Впроваджено частково</option><option value="100" ${e.score===100?'selected':''}>Впроваджено повністю</option></select></td><td><input class="note-input" id="note-${q.id}" value="${h(e.note)}" ${!writable?'disabled':''} maxlength="500" placeholder="Документ / примітка (без персональних даних)"></td><td>${writable?`<button class="btn small outline" data-action="save-evidence" data-question="${q.id}">Зберегти</button>`:''}</td></tr>`}).join('')}</tbody></table></div></div>`;
}
function reports(){
  if(!state.dashboard)return '<div class="empty">Потрібна авторизація.</div>';
  const d=state.dashboard.current;
  const m=state.reportMinutes, n=d.respondents;
  const manual=Math.round(n*m.survey+m.manualExtra), automatic=Math.round(n*m.autoSurvey+m.autoExtra), saved=Math.max(0,manual-automatic), rel=manual?Math.round(saved/manual*100):0;
  const hr=v=>`${Math.floor(v/60)} год ${v%60} хв`;
  return head('ЗВІТНІСТЬ','Аналітичні звіти','Автоматичні результати для керівництва та експорт із демонстраційного середовища')+
  `<div class="two-col report-intro"><div class="panel padded"><div class="panel-title"><h3>Експорт результатів</h3></div><p>Без персональних відповідей. У звіт потрапляють лише безпечні узагальнені значення, методика розрахунку та рекомендації.</p>
  <div class="export-buttons"><a class="btn accent" href="/api/report.csv?cycle=${state.cycle}" download>↓ Експорт CSV</a><a class="btn outline" href="/api/report.json?cycle=${state.cycle}" download>↓ Експорт JSON</a><button class="btn outline" data-action="print">▧ Друк / PDF</button></div></div>
  <div class="panel padded"><div class="panel-title"><h3>Підсумок циклу</h3></div><div class="report-index">${ring(d.index,true)}<div><span class="soft-label">INTEGRITY INDEX</span><h2>${h(d.level)}</h2><p>${fmt(d.respondents)} безпечно агрегованих відповідей</p></div></div></div></div>
  <section class="panel padded"><div class="panel-title"><div><h3>Оцінка економії часу</h3><p>Змінювані припущення, не фактичний вимір</p></div>${badge('Модельний розрахунок')}</div>
  <div class="assumption-grid"><label>Ручна обробка 1 анкети, хв<input type="number" min="0" max="1000" step="0.5" data-assumption="survey" value="${m.survey}"></label><label>Ручне зведення та звіт, хв<input type="number" min="0" max="2000" step="1" data-assumption="manualExtra" value="${m.manualExtra}"></label><label>Автоматизований супровід 1 анкети, хв<input type="number" min="0" max="1000" step="0.5" data-assumption="autoSurvey" value="${m.autoSurvey}"></label><label>Перевірка автоматичного звіту, хв<input type="number" min="0" max="2000" step="1" data-assumption="autoExtra" value="${m.autoExtra}"></label></div>
  <div class="saving-grid"><div><span>Ручний процес</span><strong>${hr(manual)}</strong><div class="saving-bar"><div style="width:100%" class="fill muted-fill"></div></div></div><div><span>IntegrityOS</span><strong>${hr(automatic)}</strong><div class="saving-bar"><div style="width:${Math.min(100,Math.round(automatic/Math.max(1,manual)*100))}%" class="fill green"></div></div></div><div class="saved-result"><small>ПОТЕНЦІЙНА ЕКОНОМІЯ</small><strong>${hr(saved)}</strong><b>−${rel}% часу</b></div></div><p class="helper">Формули: вручну = N × час обробки анкети + час зведення; автоматизовано = N × супровід анкети + перевірка звіту. N = ${n}. Реальна економія потребує замірів.</p></section>
  <section class="panel padded printable"><h3>Управлінський висновок</h3><p>За результатами синтетичного оцінювання «${h(d.cycle.title)}» інтегральний показник становить <b>${fmt(d.index)} зі 100</b> (${h(d.level)}). Оцінювання охоплює ${n} відповідей із груп, які відповідають порогу анонімності. Пріоритетних напрямів для аналізу: ${state.dashboard.recommendations.length}. Рішення щодо управлінських дій ухвалює відповідальна особа.</p><p class="helper">Усі результати демонстраційні. Цей звіт не є офіційною оцінкою установи.</p></section>`;
}
function method(){return head('ПРОЗОРА АНАЛІТИКА','Методика та захист даних','Як працює Integrity Index, що обчислюється та чого система принципово не робить')+
  `<div class="two-col"><section class="panel padded"><div class="panel-title"><h3>Формула Integrity Index</h3>${badge('Демонстраційна методика')}</div><div class="formula">I = Σ w<sub>i</sub> × (0,7 × S<sub>i</sub> + 0,3 × E<sub>i</sub>)</div><p><b>S</b> — анонімні групові відповіді (оцінка 0–4, помножена на 25); <b>E</b> — чек-лист 0 / 50 / 100; <b>w</b> — вага компонента.</p><div class="weights-list">${state.config.dimensions.map(d=>`<div><span class="color-dot" style="background:${d.color}"></span><span>${h(d.name)}</span><strong>${d.weight*100}%</strong></div>`).join('')}</div><p class="helper">Показник недоступний, доки немає повного безпечного набору відповідей і контрольних індикаторів. Ця формула розроблена командою для MVP, не є офіційним стандартом НАЗК.</p></section>
  <section class="panel padded"><div class="panel-title"><h3>Модель зрілості</h3></div>${[['0–19','Початковий'],['20–39','Формується'],['40–59','Визначений'],['60–79','Керований'],['80–100','Оптимізований']].map((x,i)=>`<div class="stage"><span class="stage-color stage-${i}"></span><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}<p class="helper">Шкала та пороги — власна демонстраційна інтерпретація для пояснюваності індексу.</p></section></div>
  <div class="two-col"><section class="panel padded"><div class="panel-title"><h3>Як забезпечується анонімність</h3></div><ol class="steps"><li>Опитувальник не запитує ПІБ, телефон, email, звання чи конкретний підрозділ.</li><li>На сервері окремі відповіді <b>не зберігаються</b>: база містить лише підсумкову суму балів і лічильник.</li><li>Групи з кількістю відповідей менше <b>${state.config.min_group}</b> приховані й виключені із загальних розрахунків, щоб уникнути відновлення за різницею.</li><li>Публічний екран показує тільки сумарні безпечні значення, а не відповіді окремих учасників.</li><li>Рекомендації формуються за правилами, остаточне рішення залишається за керівником.</li></ol></section>
  <section class="panel padded"><div class="panel-title"><h3>Сценарії зловживання та запобіжники</h3></div><div class="risk-list"><div><b>Тиск на респондентів</b><p>Не зберігати індивідуальні анкети чи ідентифікатори.</p></div><div><b>Рейтинг командирів</b><p>Не оцінювати окремих посадових осіб і не використовувати індекс для покарання.</p></div><div><b>Малі вибірки</b><p>Порогове агрегування k ≥ ${state.config.min_group}; не показувати малі групи.</p></div><div><b>Прикрашені самооцінки</b><p>Зіставляти з чек-листом, позначати розбіжності та людську перевірку.</p></div><div><b>Підміна показників</b><p>Рольовий доступ до редагування індикаторів і журнал відповідальних дій.</p></div></div></section></div>
  <div class="notice"><b>Джерело моделі:</b> «Рекомендації щодо трансформації функціонування ВВНЗ (ВНП ЗВО) на засадах доброчесності…», НУОУ (2025), додатки Б і В. Питання скорочені й адаптовані для MVP. <a href="https://nuou.org.ua/assets/documents/recommendations_transform_dobrochesnist.pdf" target="_blank" rel="noopener noreferrer">Відкрити першоджерело ↗</a></div>`;
}
function integration(){return head('АРХІТЕКТУРА','Інтеграція та масштабування','Один вебмодуль, декілька каналів отримання показників і вихідні відкриті формати')+
 `<div class="panel padded"><div class="architecture"><div class="arch-row"><div class="arch-node source"><b>Цифрові анкети</b><span>API / опитування</span></div><div class="arch-node source"><b>Відомчий чек-лист</b><span>Контрольні індикатори</span></div><div class="arch-node source"><b>Реєстри навчань</b><span>Майбутня інтеграція</span></div></div><div class="arch-connector">↓ &nbsp; JSON API / перевірка прав доступу &nbsp; ↓</div><div class="arch-center"><div class="arch-logo">✦</div><b>INTEGRITYOS</b><span>Аналітика · Index Engine · Агрегати SQLite · RBAC</span></div><div class="arch-connector">↓ &nbsp; JSON, CSV, звіти, вбудований модуль &nbsp; ↓</div><div class="arch-row"><div class="arch-node dest"><b>Керівництво</b><span>Executive dashboard</span></div><div class="arch-node dest"><b>Уповноважені</b><span>План заходів</span></div><div class="arch-node dest"><b>Інші ІС</b><span>REST/JSON, CSV</span></div></div></div></div>
 <div class="two-col"><div class="panel padded"><h3>Поточний прототип</h3><p>HTTP/JSON API з авторизацією, SQLite для локального зберігання, фронтенд без CDN та хмарної залежності, експорт у CSV/JSON. Працює без інтернету після встановлення Python.</p></div><div class="panel padded"><h3>Масштабування до відомчого рішення</h3><p>Адаптер до відомчої SSO/LDAP, перенесення БД на PostgreSQL, HTTPS через внутрішній шлюз, журналювання доступу, погодження моделі загроз та сертифіковане середовище.</p></div></div><div class="notice">Назви конкретних відомчих систем не наведені: інтеграція можлива лише після узгодження API, прав доступу та власника інформаційної системи. Цей MVP не підключено до реальних джерел.</div>`;
}
function audit(){return head('ПІДЗВІТНІСТЬ','Журнал управлінських дій','Фіксуються зміни індикаторів, авторизації та статуси заходів. Анонімні відповіді не журналюються.')+
 `<div class="panel full-panel"><div class="table-scroll"><table><thead><tr><th>Дата й час (UTC)</th><th>Користувач</th><th>Дія</th><th>Деталі</th></tr></thead><tbody>${state.audit.map(a=>`<tr><td>${h(a.at.slice(0,19).replace('T',' '))}</td><td>${h(a.actor)}</td><td><span class="source-code">${h(a.action)}</span></td><td>${h(a.detail)}</td></tr>`).join('')}</tbody></table></div></div>`}
function settings(){return head('АДМІНІСТРУВАННЯ','Управління оцінюваннями','Створення циклів, відкриття та закриття опитувань, демонстраційні налаштування')+
 `<div class="two-col"><section class="panel padded"><h3>Створити цикл оцінювання</h3><form id="new-cycle" class="stacked-form"><label>Назва<input name="title" required maxlength="140" placeholder="Наприклад, Весняне оцінювання"></label><label>Період<input name="period" required maxlength="80" placeholder="2027 · I півріччя"></label><button class="btn accent">＋ Створити цикл</button></form></section>
 <section class="panel padded"><h3>Демонстраційні дані</h3><p>Усі значення штучні. Повторне завантаження демоданих поверне початкові два цикли, анкети, індикатори та зразок заходу.</p><button class="btn danger-btn" data-action="demo-reset">Скинути демонстраційну базу</button><p class="helper">Операція незворотна. Для презентації можна використовувати демобазу без інтернету.</p></section></div>
 <section class="panel padded"><h3>Наявні цикли</h3><div class="cycle-list">${state.config.cycles.map(c=>`<div class="cycle-item"><div><b>${h(c.title)}</b><p>${h(c.period)}</p></div><div>${badge(c.is_open?'Відкритий':'Закритий',c.is_open?'success':'neutral')} <button class="btn outline small" data-action="toggle-cycle" data-id="${c.id}" data-open="${c.is_open?0:1}">${c.is_open?'Закрити':'Відкрити'}</button></div></div>`).join('')}</div></section>`}
function welcome(){return `<div class="welcome"><div class="welcome-glow"></div><div class="welcome-content"><div class="welcome-mark">✦</div><div class="eyebrow">HACKATHON · INTEGRITY MANAGEMENT</div><h1>Система доброчесності,<br><span>яку можна виміряти.</span></h1><p>Єдина платформа оцінювання зрілості доброчесності, аналізу ризиків і прийняття управлінських рішень.</p><div class="demo-callout">◉ ВИКЛЮЧНО СИНТЕТИЧНІ ДАНІ · ДЕМОНСТРАЦІЙНИЙ ПРОТОТИП</div><div class="login-card"><h2>Увійти до системи</h2><form id="login-form"><label>Логін<input name="login" autocomplete="username" value="admin" required></label><label>Пароль<input name="password" type="password" autocomplete="current-password" value="Demo2026!" required></label><button class="btn accent wide">Увійти до панелі →</button></form><div class="login-div">Демонстраційні ролі</div><div class="login-roles">${[['admin','Адміністратор'],['leader','Керівник'],['analyst','Аналітик'],['participant','Учасник']].map(([key,val])=>`<button data-action="demo-login" data-login="${key}">${val}</button>`).join('')}</div><button class="text-button public-access" data-nav="survey">Пройти анонімне опитування без входу ↗</button></div><small class="welcome-foot">IntegrityOS · Офлайн вебплатформа · жодних зовнішніх сервісів</small></div><div class="welcome-visual"><div class="mock-window"><div class="mock-header"><span></span><span></span><span></span><b>EXECUTIVE DASHBOARD</b></div><div class="mock-main">${ring(68.4)}<div><small>INTEGRITY INDEX</small><h3>68.4 / 100</h3><p>Визначений рівень зрілості</p></div></div><div class="mock-bars">${[67,80,52,71].map((v,i)=>`<div><span style="width:${v}%" class="fill ${i===2?'amber':'green'}"></span></div>`).join('')}</div></div></div></div>`}
function modal(){
  if(!state.modal)return '';
  const m=state.modal;const isEdit=m.mode==='edit';const r=m.rec;
  return `<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" ><div class="modal-heading"><div><div class="eyebrow">${isEdit?'КОНТРОЛЬ ВИКОНАННЯ':'УПРАВЛІНСЬКЕ РІШЕННЯ'}</div><h2>${isEdit?'Змінити захід':'Прийняти рекомендацію'}</h2></div><button class="icon-btn" data-action="close-modal">✕</button></div><h3>${h(r.title)}</h3><p>${h(r.description)}</p><div class="rec-why">${h(r.why)}</div><form id="action-form" class="stacked-form"><label>Відповідальний (посада або робоча група)<input name="owner" required maxlength="120" value="${h(r.owner||'Уповноважений із запобігання корупції')}"></label><label>Строк виконання<input name="deadline" type="date" required value="${h(r.deadline||'2027-02-28')}"></label>${isEdit?`<label>Статус<select name="status">${['accepted','in_progress','done','cancelled'].map(x=>`<option value="${x}" ${r.status===x?'selected':''}>${statusName(x)}</option>`).join('')}</select></label>`:''}<button class="btn accent wide">${isEdit?'Зберегти зміни':'Затвердити і додати до плану'}</button></form><p class="helper">Дія записується до журналу; остаточне рішення завжди ухвалює людина.</p></div></div>`
}
function render(){
  const p=state.page;
  if(p==='welcome'){app.innerHTML=welcome();return}
  if(!state.user && !['survey','method'].includes(p)){app.innerHTML=welcome();return}
  const authorized=['dashboard','comparison','recommendations','checklist','reports','integration','audit','settings'];
  if(state.user?.role==='participant' && authorized.includes(p)){app.innerHTML=frame(`<div class="empty">Для цієї ролі доступне лише опитування та методика.</div>`);return}
  const renderers={dashboard, survey,comparison,recommendations:recs,checklist,reports,method,integration,audit,settings};
  app.innerHTML=frame(renderers[p]?renderers[p]():dashboard());
}
app.addEventListener('click',async ev=>{
  const navTarget=ev.target.closest('[data-nav]'); if(navTarget){setPage(navTarget.dataset.nav);return}
  if(ev.target.closest('.modal') && !ev.target.closest('.modal [data-action]'))return;
  const t=ev.target.closest('[data-action]');if(!t)return;
  const act=t.dataset.action;
  try{
    if(act==='demo-login'){const r=await post('/api/login',{login:t.dataset.login,password:'Demo2026!'});state.user=r.user;state.page=r.user.role==='participant'?'survey':'dashboard';location.hash=state.page;return load()}
    if(act==='logout'){await post('/api/logout',{});state.user=null;state.page='welcome';location.hash='welcome';return render()}
    if(act==='survey-back'){state.step=Math.max(0,state.step-1);return render()}
    if(act==='survey-next'){
      const q=state.config.questions[state.step];if(state.answers[q.id]===undefined)return;
      if(state.step<state.config.questions.length-1){state.step++;return render()}
      const active=state.config.cycles.find(c=>c.is_open);
      await post('/api/survey',{cycle_id:active.id,cohort:state.cohort,answers:state.answers});
      state.answers={};state.step=0;
      // No personal answer history is saved; this is a demo with no anti-duplicate guarantee.
      toast('Дякуємо! Анонімні бали додано тільки до групових агрегатів.');
      return;
    }
    if(act==='accept-rec'){state.modal={mode:'new',rec:state.dashboard.recommendations[Number(t.dataset.index)]};return render()}
    if(act==='edit-action'){const rec=state.actions.find(a=>a.id===Number(t.dataset.id));state.modal={mode:'edit',rec};return render()}
    if(act==='close-modal'){state.modal=null;return render()}
    if(act==='save-evidence'){
      const q=t.dataset.question;
      const val=Number($(`#score-${q}`).value),note=$(`#note-${q}`).value;
      await post('/api/evidence',{cycle_id:state.cycle,question_id:q,score:val,note});toast('Індикатор оновлено. Перерахунок відбудеться під час відкриття Dashboard.');return;
    }
    if(act==='print'){window.print();return}
    if(act==='demo-reset'){if(!confirm('Скинути всі зміни та повернути синтетичну демонстраційну базу?'))return;await post('/api/demo/reset',{});state.config=await api('/api/config');state.cycle=state.config.cycles[0]?.id;toast('Демонстраційну базу відновлено.');return load()}
    if(act==='toggle-cycle'){await post('/api/cycles/toggle',{id:Number(t.dataset.id),is_open:Number(t.dataset.open)});state.config=await api('/api/config');toast('Стан циклу змінено.');return load()}
  }catch(e){toast(e.message)}
});
app.addEventListener('change',ev=>{
  if(ev.target.id==='cycle-select'){state.cycle=Number(ev.target.value);return load()}
  if(ev.target.id==='survey-cohort'){state.cohort=ev.target.value;return}
  if(ev.target.matches('input[name="answer"]')){state.answers[ev.target.dataset.question]=Number(ev.target.value);render();return}
  if(ev.target.dataset.assumption){state.reportMinutes[ev.target.dataset.assumption]=Math.max(0,Number(ev.target.value)||0);render();return}
});
app.addEventListener('submit',async ev=>{
  ev.preventDefault();const form=ev.target;const data=Object.fromEntries(new FormData(form));
  try{
    if(form.id==='login-form'){
      const r=await post('/api/login',data);state.user=r.user;state.page=r.user.role==='participant'?'survey':'dashboard';location.hash=state.page;return load();
    }
    if(form.id==='new-cycle'){
      const r=await post('/api/cycles',data);state.config=await api('/api/config');state.cycle=r.id;toast('Новий цикл створено.');return load();
    }
    if(form.id==='action-form'){
      const m=state.modal;
      if(m.mode==='new'){
        await post('/api/actions',{...m.rec,cycle_id:state.cycle,owner:data.owner,deadline:data.deadline});
      } else {await post('/api/actions/update',{id:m.rec.id,...data})}
      state.modal=null;state.actions=(await api('/api/actions')).items;toast('Управлінське рішення збережено та зафіксовано в журналі.');return;
    }
  }catch(e){toast(e.message)}
});
window.addEventListener('hashchange',()=>{const p=location.hash.replace('#','');if(p&&p!==state.page){state.page=p;load()}});
bootstrap();
