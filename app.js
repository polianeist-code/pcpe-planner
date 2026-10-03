(() => {
  'use strict';
  const D = window.PCPE_DATA;
  const KEY = 'pcpePlannerStateV1';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const todayISO = () => new Date().toISOString().slice(0,10);
  const localDate = iso => { const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d); };
  const isoDate = date => { const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; };
  const fmtDate = iso => localDate(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const addDays = (iso,n) => { const d=localDate(iso); d.setDate(d.getDate()+n); return isoDate(d); };
  const daysBetween = (a,b) => Math.ceil((localDate(b)-localDate(a))/86400000);
  const defaultState = () => ({
    cargo:'agente', topics:{}, sessions:[], answers:{}, mocks:[],
    settings:{studentName:'',weeklyGoal:24.5},
    timer:{elapsed:0,running:false,startedAt:null}
  });
  let state = loadState();
  let questionSession = {questions:[],index:0,correct:0,total:0};
  let timerInterval = null;

  function loadState(){
    try { const raw=localStorage.getItem(KEY); if(!raw) return defaultState(); return {...defaultState(),...JSON.parse(raw)}; }
    catch(e){ return defaultState(); }
  }
  function saveState(){ localStorage.setItem(KEY,JSON.stringify(state)); }
  function toast(msg){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2400); }
  function visibleSubjects(cargo=state.cargo){ return D.subjects.filter(s=>s.common || s.cargo===cargo); }
  function subjectById(id){ return D.subjects.find(s=>s.id===id); }
  function cargoLabel(c){ return c==='escrivao'?'Escrivão':'Agente'; }

  // Navigation
  const pageNames={dashboard:'Dashboard',cronograma:'Cronograma de estudos',edital:'Edital & progresso',questoes:'Questões',simulados:'Simulados',historico:'Histórico',config:'Configurações'};
  $$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>goPage(btn.dataset.page)));
  $$('[data-goto]').forEach(btn=>btn.addEventListener('click',()=>goPage(btn.dataset.goto)));
  function goPage(name){
    $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
    $$('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${name}`));
    $('#pageTitle').textContent=pageNames[name]||name;
    $('#sidebar').classList.remove('open');
    window.scrollTo({top:0,behavior:'smooth'});
    if(name==='simulados') renderMocks();
    if(name==='historico') renderHistory();
  }
  $('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));

  // Cargo
  $('#cargoSelect').value=state.cargo;
  $('#cargoSelect').addEventListener('change',e=>{ state.cargo=e.target.value; saveState(); renderAll(); toast(`Plano ajustado para ${cargoLabel(state.cargo)}.`); });

  // Shared subject selects
  function fillSubjectSelects(){
    const list=visibleSubjects();
    ['#subjectFilter','#questionSubject','#timerSubject','#manualSubject'].forEach(sel=>{
      const el=$(sel); if(!el) return;
      const current=el.value;
      const prefix=sel==='#subjectFilter'?'<option value="all">Todas as matérias</option>':'';
      el.innerHTML=prefix+list.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
      if([...el.options].some(o=>o.value===current)) el.value=current;
    });
    $('#mockCargo').value=state.cargo;
  }

  // Dashboard
  function renderDashboard(){
    const now=todayISO();
    const left=Math.max(0,daysBetween(now,D.meta.examDate));
    $('#daysLeft').textContent=left;
    const prog=overallProgress();
    $('#overallPct').textContent=`${prog}%`;
    $('#overallRadial').style.setProperty('--p',prog);
    const totalMin=state.sessions.reduce((a,s)=>a+(+s.minutes||0),0);
    const ws=startOfWeek(new Date());
    const weekMin=state.sessions.filter(s=>localDate(s.date)>=ws).reduce((a,s)=>a+(+s.minutes||0),0);
    $('#statHours').textContent=formatHours(totalMin);
    $('#statWeekHours').textContent=`${formatHours(weekMin)} nesta semana`;
    const ans=Object.values(state.answers); const correct=ans.filter(a=>a.correct).length;
    $('#statQuestions').textContent=ans.length;
    $('#statAccuracy').textContent=ans.length?`${Math.round(correct/ans.length*100)}% de acerto`:'— de acerto';
    $('#statPages').textContent=state.sessions.reduce((a,s)=>a+(+s.pages||0),0);
    $('#statMocks').textContent=state.mocks.length;
    const avg=state.mocks.length?state.mocks.reduce((a,m)=>a+(+m.objective||0),0)/state.mocks.length:null;
    $('#statMockAvg').textContent=avg!==null?`média ${avg.toFixed(1)}/60`:'sem média ainda';
    renderTodayPlan(); renderReviewQueue(); renderWeakPoints(); renderSubjectProgress();
  }
  function startOfWeek(d){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); const day=x.getDay(); const diff=(day===0?-6:1-day); x.setDate(x.getDate()+diff); x.setHours(0,0,0,0); return x; }
  function formatHours(min){ const h=min/60; return h>=10?`${h.toFixed(0)}h`:`${h.toFixed(1).replace('.',',')}h`; }
  function overallProgress(){
    const subs=visibleSubjects(); let total=0,done=0;
    subs.forEach(s=>s.topics.forEach((_,i)=>{ total++; if(state.topics[`${s.id}::${i}`]?.completed) done++; }));
    return total?Math.round(done/total*100):0;
  }
  function currentWeek(){ const now=localDate(todayISO()); return D.weeks.find(w=>now>=localDate(w.start)&&now<=localDate(w.end)) || null; }
  function renderTodayPlan(){
    const el=$('#todayPlan'); const now=localDate(todayISO()); const day=now.getDay();
    if(now<localDate(D.meta.startDate)){ el.innerHTML='<div class="today-empty" style="grid-column:1/-1">O plano começa em <strong>05/10/2026</strong>. Use o fim de semana para preparar materiais, criar o caderno de erros e fazer um diagnóstico leve.</div>'; return; }
    if(now>localDate(D.meta.examDate)){ el.innerHTML='<div class="today-empty" style="grid-column:1/-1">A data prevista da prova já passou. Seu histórico permanece salvo para consulta.</div>'; return; }
    let blocks=[];
    if(day>=1&&day<=5) blocks=D.weeklyTemplate.weekday[day-1].blocks;
    else if(day===6) blocks=D.weeklyTemplate.saturday;
    else blocks=D.weeklyTemplate.sunday;
    el.innerHTML=blocks.map(b=>`<div class="today-block"><time>${b[0]}–${b[1]}</time><strong>${esc(cargoize(b[2]))}</strong></div>`).join('');
    const cw=currentWeek();
    if(day===0&&cw) el.insertAdjacentHTML('beforeend',`<div class="today-block"><time>Discursiva</time><strong>${esc(cw.essay)}</strong></div>`);
  }
  function reviewItems(){
    const now=todayISO(), out=[];
    visibleSubjects().forEach(s=>s.topics.forEach((topic,i)=>{
      const key=`${s.id}::${i}`, rec=state.topics[key]; if(!rec?.completed||!rec.completedAt)return;
      [['d7',7],['d30',30]].forEach(([type,days])=>{ const due=addDays(rec.completedAt,days); if(due<=now&&!rec[type]) out.push({key,type,due,subject:s.name,topic,overdue:daysBetween(due,now)}); });
    }));
    return out.sort((a,b)=>a.due.localeCompare(b.due));
  }
  function renderReviewQueue(){
    const items=reviewItems(); $('#reviewCount').textContent=items.length;
    $('#reviewQueue').innerHTML=items.length?items.slice(0,6).map(r=>`<div class="review-item"><div><strong>${esc(r.subject)} · ${r.type.toUpperCase()}</strong><small>${esc(r.topic)} · ${r.overdue>0?`${r.overdue}d atrasada`:'vence hoje'}</small></div><button data-review="${r.key}|${r.type}">Concluir</button></div>`).join(''):'<div class="empty-state">Nenhuma revisão vencida. Ao concluir um tópico, D+7 e D+30 serão geradas automaticamente.</div>';
    $$('[data-review]').forEach(b=>b.addEventListener('click',()=>{ const [key,type]=b.dataset.review.split('|'); state.topics[key][type]=true; saveState(); renderDashboard(); renderSyllabus(); toast('Revisão registrada.'); }));
  }
  function aggregateAnswers(){
    const map={}; Object.values(state.answers).forEach(a=>{ const k=a.subject; map[k]??={n:0,c:0}; map[k].n++; if(a.correct)map[k].c++; }); return map;
  }
  function renderWeakPoints(){
    const agg=aggregateAnswers(), weak=[];
    Object.entries(agg).forEach(([id,v])=>{ if(v.n>=3){ const pct=Math.round(v.c/v.n*100); if(pct<75) weak.push({label:subjectById(id)?.name||id,pct,n:v.n}); }});
    const mockWeak={}; state.mocks.forEach(m=>(m.weak||'').split(',').map(x=>x.trim()).filter(Boolean).forEach(x=>mockWeak[x]=(mockWeak[x]||0)+1));
    Object.entries(mockWeak).forEach(([x,n])=>weak.push({label:x,pct:null,n,fromMock:true}));
    weak.sort((a,b)=>(a.pct??0)-(b.pct??0));
    $('#weakPoints').innerHTML=weak.length?weak.slice(0,6).map(w=>`<div class="weak-item ${w.pct!==null&&w.pct<60?'priority-high':'priority-mid'}"><div><strong>${esc(w.label)}</strong><small>${w.fromMock?`marcado em ${w.n} simulado(s)`:`${w.pct}% em ${w.n} questão(ões)`}</small></div><span>↗</span></div>`).join(''):'<div class="empty-state">Ainda não há dados suficientes. Responda questões e registre simulados para o diagnóstico aparecer.</div>';
  }
  function renderSubjectProgress(){
    $('#subjectProgress').innerHTML=visibleSubjects().map(s=>{ let d=0;s.topics.forEach((_,i)=>{if(state.topics[`${s.id}::${i}`]?.completed)d++;});const pct=Math.round(d/s.topics.length*100);return `<div class="progress-row"><strong>${esc(s.name)}</strong><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><span>${pct}%</span></div>`; }).join('');
  }

  // Schedule
  function cargoize(text){
    if(text.includes('Agente: Contabilidade | Escrivão: Arquivologia')) return state.cargo==='agente'?'Contabilidade Geral':'Noções de Arquivologia';
    return text;
  }
  function includeForCargo(text){ if(text.startsWith('Agente:')) return state.cargo==='agente'; if(text.startsWith('Escrivão:')) return state.cargo==='escrivao'; return true; }
  function stripCargo(text){ return text.replace(/^Agente:\s*/,'').replace(/^Escrivão:\s*/,''); }
  function renderWeeklyTemplate(){
    const box=$('#weeklyTemplate');
    let html=D.weeklyTemplate.weekday.map(d=>`<div class="template-day"><h4>${d.day}</h4>${d.blocks.map(b=>`<div class="template-slot"><b>${b[0]}</b>${esc(cargoize(b[2]))}</div>`).join('')}</div>`).join('');
    html+=`<div class="template-day weekend"><h4>Sábado · ~6h líquidas</h4>${D.weeklyTemplate.saturday.map(b=>`<div class="template-slot"><b>${b[0]}</b>${esc(cargoize(b[2]))}</div>`).join('')}</div>`;
    html+=`<div class="template-day weekend"><h4>Domingo · simulado + discursiva</h4>${D.weeklyTemplate.sunday.map(b=>`<div class="template-slot"><b>${b[0]}</b>${esc(cargoize(b[2]))}</div>`).join('')}</div>`;
    if(state.cargo==='escrivao') html+=`<div class="template-day weekend" style="border-color:#d9c9ff;background:#faf8ff"><h4>Diferença do Escrivão</h4><div class="template-slot"><b>Matéria</b>Arquivologia no lugar de Contabilidade.</div><div class="template-slot"><b>Da sem. 9</b>3 treinos de digitação/semana, 10 min cada, retirados do bloco final de questões/revisão.</div><div class="template-slot"><b>Meta</b>Precisão primeiro; depois velocidade. Simular texto contínuo em qualquer teclado.</div></div>`;
    box.innerHTML=html;
  }
  function renderWeeks(phase='all'){
    const now=todayISO();
    $('#weekList').innerHTML=D.weeks.filter(w=>phase==='all'||w.phase===phase).map(w=>{
      const isCurrent=now>=w.start&&now<=w.end;
      const items=w.items.filter(includeForCargo).map(stripCargo);
      const typing=state.cargo==='escrivao'&&w.number>=9?'<p><strong>Digitação:</strong> 3 × 10 min na semana; precisão e ritmo.</p>':'';
      return `<details class="week-card ${isCurrent?'current':''}" data-phase="${w.phase}" data-week="${w.number}" ${isCurrent?'open':''}><summary><div class="week-no">SEM ${String(w.number).padStart(2,'0')}</div><div class="week-summary"><h3>${esc(w.title)}</h3><p>${fmtDate(w.start)} → ${fmtDate(w.end)}</p></div><div class="week-chevron">⌄</div></summary><div class="week-body"><div class="week-focus"><span class="eyebrow">FOCO DA SEMANA</span><ul>${items.map(x=>`<li>${esc(cargoize(x))}</li>`).join('')}</ul></div><div class="sunday-box"><h4>Domingo</h4><p><strong>Simulado:</strong> ${esc(w.mock)}</p><p><strong>Discursiva:</strong> ${esc(w.essay)}</p>${typing}${w.phase==='final'?'<p><strong>Regra:</strong> nenhum conteúdo novo.</p>':''}</div></div></details>`;
    }).join('');
  }
  $('#toggleTemplate').addEventListener('click',()=>{ const el=$('#weeklyTemplate'); el.style.display=el.style.display==='none'?'grid':'none'; });
  $$('#phaseFilter button').forEach(b=>b.addEventListener('click',()=>{ $$('#phaseFilter button').forEach(x=>x.classList.toggle('active',x===b)); renderWeeks(b.dataset.phase); }));
  $('#jumpCurrent').addEventListener('click',()=>{ const cw=currentWeek(); if(!cw){toast('Ainda não há semana ativa.');return;} const el=$(`[data-week="${cw.number}"]`); if(el){el.open=true;el.scrollIntoView({behavior:'smooth',block:'center'});} else {renderWeeks('all');setTimeout(()=>{const x=$(`[data-week="${cw.number}"]`);if(x){x.open=true;x.scrollIntoView({behavior:'smooth',block:'center'});}},50);} });

  // Syllabus
  function renderSyllabus(){
    const q=$('#topicSearch').value.trim().toLowerCase(), filter=$('#subjectFilter').value;
    const html=visibleSubjects().filter(s=>filter==='all'||s.id===filter).map(s=>{
      const rows=s.topics.map((topic,i)=>({topic,i})).filter(x=>!q||x.topic.toLowerCase().includes(q)||s.name.toLowerCase().includes(q));
      if(!rows.length)return'';
      let done=0;s.topics.forEach((_,i)=>{if(state.topics[`${s.id}::${i}`]?.completed)done++;});
      return `<section class="subject-card"><div class="subject-head"><div><h3>${esc(s.name)}</h3><p>${s.group} · ${done}/${s.topics.length} concluídos</p></div><div class="subject-meta"><span class="weight-chip">peso ${esc(s.weight)}</span>${!s.common?`<span class="cargo-chip">${cargoLabel(s.cargo)}</span>`:''}</div></div><div class="topic-list">${rows.map(({topic,i})=>topicRow(s,topic,i)).join('')}</div></section>`;
    }).join('');
    $('#syllabusList').innerHTML=html||'<div class="empty-state">Nenhum assunto encontrado.</div>';
    $$('.topic-check').forEach(cb=>cb.addEventListener('change',onTopicCheck));
  }
  function topicRow(s,topic,i){
    const key=`${s.id}::${i}`, rec=state.topics[key], comp=!!rec?.completed;
    let meta=comp&&rec.completedAt?`Concluído em ${fmtDate(rec.completedAt)}`:'Ainda não concluído';
    let chips='';
    if(comp&&rec.completedAt){ [['d7',7],['d30',30]].forEach(([t,n])=>{const due=addDays(rec.completedAt,n),done=rec[t],dueNow=due<=todayISO()&&!done; chips+=`<span class="review-chip ${done?'done':dueNow?'due':''}">${t.toUpperCase()} ${done?'✓':fmtDate(due).slice(0,5)}</span>`;}); }
    return `<label class="topic-row"><input class="topic-check" type="checkbox" data-key="${key}" ${comp?'checked':''}><div class="topic-title"><strong>${esc(topic)}</strong><small>${meta}</small></div><div class="topic-actions">${chips}</div></label>`;
  }
  function onTopicCheck(e){
    const key=e.target.dataset.key;
    if(e.target.checked) state.topics[key]={completed:true,completedAt:todayISO(),d7:false,d30:false};
    else delete state.topics[key];
    saveState(); renderSyllabus(); renderDashboard();
  }
  $('#topicSearch').addEventListener('input',renderSyllabus); $('#subjectFilter').addEventListener('change',renderSyllabus);

  // Questions
  function deterministicRotate(arr,n){ const x=arr.slice(); const k=((n%x.length)+x.length)%x.length; return x.slice(k).concat(x.slice(0,k)); }
  function generateQuestions(subjectId){
    const facts=D.questionFacts[subjectId]||[]; const out=[];
    const pickOthers=(idx,field,offset)=>{
      const others=facts.filter((_,j)=>j!==idx); const picked=[];
      for(let k=0;k<Math.min(4,others.length);k++) picked.push(others[(idx+offset+k)%others.length][field]);
      return picked;
    };
    facts.forEach((f,i)=>{
      const pool1=[f[1],...pickOthers(i,1,1)];
      let opts1=deterministicRotate(pool1,(i*2+1)%5); out.push({id:`${subjectId}-def-${i}`,subject:subjectId,topic:f[0],prompt:`Assinale a alternativa que define corretamente “${f[0]}”.`,options:opts1,answer:opts1.indexOf(f[1]),explanation:f[2]});
      const pool2=[f[0],...pickOthers(i,0,3)];
      let opts2=deterministicRotate(pool2,(i*3+2)%5); out.push({id:`${subjectId}-rev-${i}`,subject:subjectId,topic:f[0],prompt:`Qual conceito corresponde à descrição: “${f[1]}”?`,options:opts2,answer:opts2.indexOf(f[0]),explanation:f[2]});
    });
    return out.slice(0,30);
  }
  function renderQuestionSourceOptions(){
    const qs=$('#questionSubject'); qs.innerHTML=visibleSubjects().map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  }
  $('#startQuestions').addEventListener('click',()=>{
    const sid=$('#questionSubject').value, mode=$('#questionMode').value;
    let qs=generateQuestions(sid);
    if(mode==='unseen') qs=qs.filter(q=>!state.answers[q.id]);
    if(mode==='wrong') qs=qs.filter(q=>state.answers[q.id]&&!state.answers[q.id].correct);
    questionSession={questions:qs,index:0,correct:0,total:0}; renderQuestion();
  });
  function renderQuestion(){
    const area=$('#questionArea'), qs=questionSession.questions;
    if(!qs.length){ area.innerHTML='<div class="empty-state">Não há questões para este filtro. Selecione “Bateria de 30” ou responda mais questões primeiro.</div>'; return; }
    const q=qs[questionSession.index], saved=state.answers[q.id];
    const letters=['A','B','C','D','E'];
    area.innerHTML=`<article class="question-card"><div class="question-top"><span class="question-counter">Questão ${questionSession.index+1} de ${qs.length}</span><span class="question-topic">${esc(q.topic)}</span></div><h3>${esc(q.prompt)}</h3><div class="options">${q.options.map((o,i)=>`<label class="option ${saved?(i===q.answer?'correct':saved.selected===i&&!saved.correct?'wrong':''):''}"><input type="radio" name="qopt" value="${i}" ${saved?.selected===i?'checked':''} ${saved?'disabled':''}><span><strong>${letters[i]}.</strong> ${esc(o)}</span></label>`).join('')}</div><div class="explanation ${saved?'show':''}" id="qExplanation"><strong>${saved?(saved.correct?'Resposta correta.':'Resposta incorreta.'):'Comentário'}</strong> ${saved?esc(q.explanation):''}</div><div class="question-footer"><button class="secondary-btn" id="prevQ" ${questionSession.index===0?'disabled':''}>← Anterior</button>${saved?`<button class="primary-btn" id="nextQ">${questionSession.index===qs.length-1?'Encerrar':'Próxima →'}</button>`:'<button class="primary-btn" id="confirmQ">Responder</button>'}</div></article>`;
    $('#prevQ')?.addEventListener('click',()=>{questionSession.index--;renderQuestion();});
    $('#confirmQ')?.addEventListener('click',()=>confirmQuestion(q));
    $('#nextQ')?.addEventListener('click',()=>{ if(questionSession.index>=qs.length-1){toast('Bateria concluída.'); questionSession.index=0;} else questionSession.index++; renderQuestion(); });
  }
  function confirmQuestion(q){
    const checked=$('input[name="qopt"]:checked'); if(!checked){toast('Marque uma alternativa antes de responder.');return;}
    const selected=+checked.value, correct=selected===q.answer;
    state.answers[q.id]={selected,correct,date:todayISO(),subject:q.subject,topic:q.topic}; saveState();
    questionSession.total++; if(correct)questionSession.correct++;
    $('#questionSessionScore').textContent=`${questionSession.correct}/${questionSession.total}`;
    renderQuestion(); renderDashboard();
  }
  function renderOfficialSources(){
    $('#officialSources').innerHTML=D.officialSources.map(s=>`<a class="source-card" href="${esc(s.url)}" target="_blank" rel="noopener"><strong>${esc(s.label)}</strong><span>${s.type==='local'?'Arquivo incluído no site':'Fonte oficial externa'} ↗</span></a>`).join('');
  }

  // Timer
  function effectiveElapsed(){ if(!state.timer.running)return state.timer.elapsed||0; return (state.timer.elapsed||0)+Math.floor((Date.now()-state.timer.startedAt)/1000); }
  function fmtTime(sec){ sec=Math.max(0,Math.floor(sec)); const h=String(Math.floor(sec/3600)).padStart(2,'0'),m=String(Math.floor(sec%3600/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0'); return `${h}:${m}:${s}`; }
  function updateTimerUI(){ const t=fmtTime(effectiveElapsed()); $('#timerDisplay').textContent=t; $('#timerMini').textContent=t; }
  function startTimerTick(){ clearInterval(timerInterval); timerInterval=setInterval(updateTimerUI,1000); updateTimerUI(); }
  $('#timerOpen').addEventListener('click',()=>openModal('timerModal'));
  $('#timerStart').addEventListener('click',()=>{ if(!state.timer.running){state.timer.running=true;state.timer.startedAt=Date.now();saveState();startTimerTick();} });
  $('#timerPause').addEventListener('click',()=>{ if(state.timer.running){state.timer.elapsed=effectiveElapsed();state.timer.running=false;state.timer.startedAt=null;saveState();updateTimerUI();} });
  $('#timerReset').addEventListener('click',()=>{ if(confirm('Zerar o cronômetro atual?')){state.timer={elapsed:0,running:false,startedAt:null};saveState();updateTimerUI();} });
  $('#timerFinish').addEventListener('click',()=>{
    const sec=effectiveElapsed(), minutes=Math.max(1,Math.round(sec/60));
    const sid=$('#timerSubject').value; if(!sid){toast('Selecione a matéria.');return;}
    state.sessions.unshift({id:cryptoId(),date:todayISO(),subject:sid,topic:$('#timerTopic').value.trim(),minutes,pages:+$('#timerPages').value||0,questions:+$('#timerQ').value||0,correct:+$('#timerCorrect').value||0,wrong:+$('#timerWrong').value||0,source:'timer'});
    state.timer={elapsed:0,running:false,startedAt:null}; saveState(); updateTimerUI(); closeModal('timerModal'); renderDashboard(); renderHistory(); clearTimerForm(); toast('Sessão salva no histórico.');
  });
  function clearTimerForm(){ ['#timerTopic','#timerPages','#timerQ','#timerCorrect','#timerWrong'].forEach((s,i)=>$(s).value=i===0?'':'0'); }

  // Mocks
  $('#addMockBtn').addEventListener('click',()=>{ $('#mockDate').value=todayISO(); $('#mockCargo').value=state.cargo; const cw=currentWeek(); $('#mockEssayTopic').value=cw?.essay||''; openModal('mockModal'); });
  $('#saveMock').addEventListener('click',()=>{
    const obj=+$('#mockObjective').value, essay=+$('#mockEssay').value;
    if(!Number.isFinite(obj)||obj<0||obj>60){toast('Informe a objetiva entre 0 e 60.');return;}
    if(!Number.isFinite(essay)||essay<0||essay>30){toast('Informe a discursiva entre 0 e 30.');return;}
    state.mocks.push({id:cryptoId(),date:$('#mockDate').value||todayISO(),cargo:$('#mockCargo').value,objective:obj,essay,minutes:+$('#mockMinutes').value||0,weak:$('#mockWeak').value.trim(),essayTopic:$('#mockEssayTopic').value.trim(),notes:$('#mockNotes').value.trim()});
    state.mocks.sort((a,b)=>a.date.localeCompare(b.date)); saveState(); closeModal('mockModal'); renderMocks();renderDashboard();toast('Simulado registrado.');
  });
  function renderMocks(){
    const ms=state.mocks;
    if(!ms.length){ ['#mockBest','#mockAvg','#essayAvg','#mockLast'].forEach(x=>$(x).textContent='—'); $('#mockLastDate').textContent='sem registro'; $('#mockChart').innerHTML='<div class="empty-state" style="width:100%;align-self:center">Registre o primeiro simulado para visualizar a evolução.</div>'; $('#mockTable').innerHTML='<div class="empty-state">Nenhum simulado registrado.</div>'; return; }
    const best=Math.max(...ms.map(m=>+m.objective||0)), avg=ms.reduce((a,m)=>a+(+m.objective||0),0)/ms.length, eavg=ms.reduce((a,m)=>a+(+m.essay||0),0)/ms.length,last=ms[ms.length-1];
    $('#mockBest').textContent=best;$('#mockAvg').textContent=avg.toFixed(1);$('#essayAvg').textContent=eavg.toFixed(1);$('#mockLast').textContent=`${last.objective}/60`;$('#mockLastDate').textContent=fmtDate(last.date);
    $('#mockChart').innerHTML=ms.slice(-12).map(m=>`<div class="chart-bar-wrap"><div class="chart-bar" style="height:${Math.max(4,(m.objective/60)*100)}%"><span>${m.objective}</span></div><small>${fmtDate(m.date).slice(0,5)}</small></div>`).join('');
    $('#mockTable').innerHTML=`<table class="data-table"><thead><tr><th>Data</th><th>Cargo</th><th>Objetiva</th><th>Discursiva</th><th>Tempo</th><th>Pontos fracos</th><th></th></tr></thead><tbody>${[...ms].reverse().map(m=>`<tr><td>${fmtDate(m.date)}</td><td>${cargoLabel(m.cargo)}</td><td><strong>${m.objective}/60</strong></td><td>${m.essay}/30</td><td>${m.minutes?`${m.minutes} min`:'—'}</td><td>${esc(m.weak||'—')}</td><td class="table-actions"><button data-del-mock="${m.id}">Excluir</button></td></tr>`).join('')}</tbody></table>`;
    $$('[data-del-mock]').forEach(b=>b.addEventListener('click',()=>{if(confirm('Excluir este simulado?')){state.mocks=state.mocks.filter(m=>m.id!==b.dataset.delMock);saveState();renderMocks();renderDashboard();}}));
  }

  // History
  $('#manualSessionBtn').addEventListener('click',()=>openModal('manualSessionModal'));
  $('#saveManualSession').addEventListener('click',()=>{
    const min=+$('#manualMinutes').value;if(!min||min<1){toast('Informe os minutos líquidos.');return;}
    state.sessions.unshift({id:cryptoId(),date:todayISO(),subject:$('#manualSubject').value,topic:$('#manualTopic').value.trim(),minutes:min,pages:+$('#manualPages').value||0,questions:(+$('#manualCorrect').value||0)+(+$('#manualWrong').value||0),correct:+$('#manualCorrect').value||0,wrong:+$('#manualWrong').value||0,source:'manual'}); saveState(); closeModal('manualSessionModal'); renderHistory();renderDashboard();toast('Sessão adicionada.');
  });
  function renderHistory(){
    const ss=state.sessions;
    $('#historyTable').innerHTML=ss.length?`<table class="data-table"><thead><tr><th>Data</th><th>Matéria</th><th>Assunto</th><th>Tempo</th><th>Páginas</th><th>Questões</th><th>Acertos/Erros</th><th></th></tr></thead><tbody>${ss.map(s=>`<tr><td>${fmtDate(s.date)}</td><td><strong>${esc(subjectById(s.subject)?.name||s.subject)}</strong></td><td>${esc(s.topic||'—')}</td><td>${s.minutes} min</td><td>${s.pages||0}</td><td>${s.questions||0}</td><td>${s.correct||0}/${s.wrong||0}</td><td class="table-actions"><button data-del-session="${s.id}">Excluir</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">Nenhuma sessão registrada ainda.</div>';
    $$('[data-del-session]').forEach(b=>b.addEventListener('click',()=>{if(confirm('Excluir esta sessão?')){state.sessions=state.sessions.filter(s=>s.id!==b.dataset.delSession);saveState();renderHistory();renderDashboard();}}));
  }

  // Settings and backups
  function renderSettings(){ $('#studentName').value=state.settings.studentName||''; $('#weeklyGoal').value=state.settings.weeklyGoal||24.5; }
  $('#saveSettings').addEventListener('click',()=>{state.settings.studentName=$('#studentName').value.trim();state.settings.weeklyGoal=+$('#weeklyGoal').value||24.5;saveState();toast('Preferências salvas.');});
  $('#exportData').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`pcpe-planner-backup-${todayISO()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);});
  $('#importData').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const obj=JSON.parse(r.result);state={...defaultState(),...(obj.state||obj)};saveState();renderAll();toast('Backup importado.');}catch(err){toast('Arquivo JSON inválido.');}};r.readAsText(f);e.target.value='';});
  $('#resetData').addEventListener('click',()=>{if(confirm('Tem certeza? Isso apagará todo o progresso deste navegador.')){localStorage.removeItem(KEY);state=defaultState();renderAll();toast('Dados locais reiniciados.');}});

  // Modals
  function openModal(id){ const el=$('#'+id);el.classList.add('open');el.setAttribute('aria-hidden','false'); }
  function closeModal(id){ const el=$('#'+id);el.classList.remove('open');el.setAttribute('aria-hidden','true'); }
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
  $$('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id);}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.modal-backdrop.open').forEach(m=>closeModal(m.id));});

  function cryptoId(){ return (self.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`); }

  function renderAll(){
    $('#cargoSelect').value=state.cargo; fillSubjectSelects(); renderQuestionSourceOptions(); renderDashboard(); renderWeeklyTemplate(); renderWeeks(); renderSyllabus(); renderOfficialSources(); renderMocks(); renderHistory(); renderSettings(); updateTimerUI();
  }

  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
  startTimerTick(); renderAll();
})();