/* Java Interview Mastery — Dashboard Table Style */
(function(){
'use strict';
var DIR='data/',LS='jim.reviewed';
var S={ch:[],grp:null,total:0,idx:null,cache:{},rev:loadR()};
var $=function(id){return document.getElementById(id);};
var body=$('pageBody'),title=$('pageTitle'),acts=$('pageActions'),qnav=$('qnav');
var prevBtn=$('prevBtn'),nextBtn=$('nextBtn'),qnavPos=$('qnavPos'),searchIn=$('searchInput');

document.addEventListener('DOMContentLoaded',function(){
  wire();
  Promise.all([fetchJ(DIR+'chapters.json'),fetchJ(DIR+'chapters_grouped.json')]).then(function(r){
    S.ch=r[0].chapters||[];S.grp=r[1];S.total=r[0].totalAnswers||0;route();
  });
});
window.addEventListener('hashchange',route);

function route(){
  var h=location.hash.replace(/^#\/?/,''),p=h.split('/').filter(Boolean);
  qnav.hidden=true;
  if(!p.length||p[0]==='home')return goHome();
  if(p[0]==='chapter'&&p.length===2)return goCh(+p[1]);
  if(p[0]==='chapter'&&p.length===4&&p[2]==='topic')return goTopic(+p[1],+p[3]);
  if(p[0]==='chapter'&&p.length===5)return goQ(+p[1],+p[3],+p[4]);
  if(p[0]==='q')return goById(p[1]);
  if(p[0]==='search')return goSearch(decodeURIComponent(p.slice(1).join('/')));
  goHome();
}
function nav(h){if(location.hash===h)route();else location.hash=h;}

// ===== HOME — Chapter table =====
function goHome(){
  title.textContent='Interview Topics';
  acts.innerHTML='<span class="pill pill--blue">'+S.total.toLocaleString()+' Questions</span> <span class="pill pill--green">28 Chapters</span>';
  var html='<table class="tbl"><thead><tr>'+
    '<th style="width:60px">#</th>'+
    '<th>CHAPTER</th>'+
    '<th style="width:120px">TOPICS</th>'+
    '<th style="width:120px">QUESTIONS</th>'+
    '<th style="width:120px">STATUS</th>'+
    '</tr></thead><tbody>';
  S.ch.forEach(function(c){
    var g=findG(c.chapter),tc=g?g.topics.length:0;
    var revN=countR(c.chapter),done=revN===c.count;
    var statusPill=revN===0?'<span class="pill pill--gray">Not Started</span>':
      done?'<span class="pill pill--green">✓ Complete</span>':
      '<span class="pill pill--orange">'+revN+'/'+c.count+' Done</span>';
    html+='<tr data-go="#/chapter/'+c.chapter+'">'+
      '<td><span class="badge badge--num">'+pad(c.chapter)+'</span></td>'+
      '<td><strong>'+esc(c.chapterTitle)+'</strong></td>'+
      '<td><span class="pill pill--blue">'+tc+' topics</span></td>'+
      '<td>'+c.count+'</td>'+
      '<td>'+statusPill+'</td></tr>';
  });
  html+='</tbody></table>';
  html+=shareBar();
  body.innerHTML=html;
  bindC(body,'[data-go]',function(el){nav(el.dataset.go||el.closest('[data-go]').dataset.go);});
  scrollTo(0,0);
}

// ===== CHAPTER — Topic table =====
function goCh(num){
  var m=findC(num),g=findG(num);if(!m||!g)return goHome();
  title.innerHTML=crumb([['#/home','Home']])+esc(m.chapterTitle);
  acts.innerHTML='<span class="pill pill--dark">Ch '+pad(num)+'</span> <span class="pill pill--blue">'+g.topics.length+' Topics</span> <span class="pill pill--gray">'+m.count+' Qs</span>';

  var html='<table class="tbl"><thead><tr>'+
    '<th style="width:50px">#</th>'+
    '<th>TOPIC</th>'+
    '<th style="width:100px">QUESTIONS</th>'+
    '<th style="width:100px">RANGE</th>'+
    '<th style="width:110px">STATUS</th>'+
    '</tr></thead><tbody>';
  g.topics.forEach(function(t,i){
    var revN=0;t.ids.forEach(function(id){if(S.rev.has(id))revN++;});
    var statusPill=revN===0?'<span class="pill pill--gray">New</span>':
      revN===t.count?'<span class="pill pill--green">✓ Done</span>':
      '<span class="pill pill--orange">'+revN+'/'+t.count+'</span>';
    html+='<tr data-go="#/chapter/'+num+'/topic/'+i+'">'+
      '<td><span class="badge badge--num">'+(i+1)+'</span></td>'+
      '<td>'+esc(t.title)+'</td>'+
      '<td>'+t.count+'</td>'+
      '<td><span class="pill pill--gray">'+t.ids[0]+(t.count>1?' – '+t.ids[t.count-1]:'')+'</span></td>'+
      '<td>'+statusPill+'</td></tr>';
  });
  html+='</tbody></table>';
  body.innerHTML=html;
  bindC(body,'[data-go]',function(el){nav(el.dataset.go||el.closest('[data-go]').dataset.go);});

  // Preload question titles for better topic names
  loadIdx().then(function(idx){
    var map={};
    idx.forEach(function(it){var q=it.question;var seps=['—',' – ',' - ','(',','];for(var i=0;i<seps.length;i++){var p=q.indexOf(seps[i]);if(p>10&&p<80){q=q.slice(0,p);break;}}if(q.length>65)q=q.slice(0,62)+'...';map[it.id]=q.trim();});
    body.querySelectorAll('tbody tr').forEach(function(tr,i){
      if(i<g.topics.length){
        var t=g.topics[i],td=tr.querySelectorAll('td')[1];
        var bad=(t.title.match(/&/g)||[]).length>=2||t.title.length<8;
        if(bad&&map[t.ids[0]])td.innerHTML='<strong>'+esc(map[t.ids[0]])+'</strong>';
      }
    });
  });
  scrollTo(0,0);
}

// ===== TOPIC — Custom dropdown, one question at a time =====
function goTopic(ch,ti){
  var m=findC(ch),g=findG(ch);if(!m||!g||ti>=g.topics.length)return goCh(ch);
  var topic=g.topics[ti];
  title.innerHTML=crumb([['#/home','Home'],['#/chapter/'+ch,m.chapterTitle]])+esc(topic.title);
  acts.innerHTML='<span class="pill pill--dark">Topic '+(ti+1)+'/'+g.topics.length+'</span>'+
    (ti>0?' <button class="btn btn--sm btn--outline" data-go="#/chapter/'+ch+'/topic/'+(ti-1)+'">← Prev Topic</button>':'')+
    (ti<g.topics.length-1?' <button class="btn btn--sm btn--primary" data-go="#/chapter/'+ch+'/topic/'+(ti+1)+'">Next Topic →</button>':'');
  showLoad();
  loadCh(ch).then(function(data){
    var ans=data.answers||[],idSet={};topic.ids.forEach(function(id){idSet[id]=1;});
    var tAns=ans.filter(function(a){return idSet[a.id];});
    var cur=0;
    var html='';
    // Custom dropdown
    html+='<div class="cdd" id="cdd">';
    html+='<button class="cdd__btn" id="cddBtn"><span class="cdd__btn-text" id="cddText">'+esc(tAns[0].id)+' — '+esc(tAns[0].question)+'</span><span class="cdd__arrow">▾</span></button>';
    html+='<div class="cdd__list" id="cddList" hidden>';
    tAns.forEach(function(a,qi){
      var rev=S.rev.has(a.id);
      html+='<div class="cdd__item'+(qi===0?' cdd__item--active':'')+'" data-qi="'+qi+'">';
      html+='<span class="cdd__num">'+(qi+1)+'</span>';
      html+='<span class="cdd__id">'+esc(a.id)+'</span>';
      html+='<span class="cdd__q">'+esc(a.question)+'</span>';
      if(rev)html+='<span class="cdd__rev">✅</span>';
      html+='</div>';
    });
    html+='</div></div>';
    // Answer
    html+='<div id="qAnswer"></div>';
    // Nav
    html+='<div class="qnav-bottom"><button class="btn btn--sm btn--outline" id="qP">← Previous</button><span class="qnav-pos" id="qPos">1 / '+tAns.length+'</span><button class="btn btn--sm btn--primary" id="qN">Next →</button></div>';
    body.innerHTML=html;
    function show(idx){
      if(idx<0||idx>=tAns.length)return;cur=idx;var a=tAns[idx],rev=S.rev.has(a.id);
      // Update dropdown button text
      document.getElementById('cddText').textContent=a.id+' — '+a.question;
      // Update active item
      body.querySelectorAll('.cdd__item').forEach(function(it,i){it.classList.toggle('cdd__item--active',i===idx);});
      // Close dropdown
      document.getElementById('cddList').hidden=true;
      // Render answer
      var h='<div class="qa-single">';
      h+='<div class="qa-single__id">'+esc(a.id)+' · Question '+(idx+1)+' of '+tAns.length+'</div>';
      h+='<h2 class="qa-single__q">'+esc(a.question)+'</h2>';
      h+='<button class="rev-btn '+(rev?'rev-btn--done':'')+'" id="revBtn" data-qid="'+a.id+'" title="'+(rev?'Click to unmark':'Click to mark as reviewed')+'">'+(rev?'✅ Reviewed':'📝 Mark as Reviewed')+'</button>';
      h+='<div class="qa-single__body">'+renderOneAnswer(a)+'</div></div>';
      document.getElementById('qAnswer').innerHTML=h;
      document.getElementById('qP').disabled=idx===0;
      document.getElementById('qN').disabled=idx===tAns.length-1;
      document.getElementById('qPos').textContent=(idx+1)+' / '+tAns.length;
    }
    show(0);
    // Toggle dropdown
    document.getElementById('cddBtn').onclick=function(e){e.stopPropagation();var dl=document.getElementById('cddList');dl.hidden=!dl.hidden;};
    // Click item
    bindC(body,'.cdd__item',function(it){show(parseInt(it.dataset.qi,10));});
    // Click outside closes
    document.addEventListener('click',function(e){var dd=document.getElementById('cdd'),dl=document.getElementById('cddList');if(dl&&!dl.hidden&&dd&&!dd.contains(e.target))dl.hidden=true;});
    // Nav buttons
    document.getElementById('qP').onclick=function(){show(cur-1);window.scrollTo({top:0,behavior:'smooth'});};
    document.getElementById('qN').onclick=function(){show(cur+1);window.scrollTo({top:0,behavior:'smooth'});};
    // Review
    body.addEventListener('click',function(e){
      var rb=e.target.closest('#revBtn');
      if(rb){var id=rb.dataset.qid;if(S.rev.has(id))S.rev.delete(id);else S.rev.add(id);saveR();var on=S.rev.has(id);rb.className='rev-btn'+(on?' rev-btn--done':'');rb.textContent=on?'✅ Reviewed':'📝 Mark as Reviewed';rb.title=on?'Click to unmark':'Click to mark as reviewed';}
      var cp=e.target.closest('.copy-btn');if(cp)cpCode(cp);
    });
    // Keyboard
    var _kh=function(e){if(document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='SELECT')return;if(e.key==='ArrowLeft'&&cur>0){e.preventDefault();show(cur-1);window.scrollTo({top:0,behavior:'smooth'});}if(e.key==='ArrowRight'&&cur<tAns.length-1){e.preventDefault();show(cur+1);window.scrollTo({top:0,behavior:'smooth'});}};
    document.addEventListener('keydown',_kh);window.addEventListener('hashchange',function(){document.removeEventListener('keydown',_kh);},{once:true});
    bindC(acts,'[data-go]',function(el){nav(el.dataset.go);});scrollTo(0,0);
  });
}
function renderOneAnswer(a){
  var sec=a.sections||{},html='';
  if(sec.s1_definition){html+='<div class="sec sec--green"><div class="sec__head">📌 Definition</div>';var s1=sec.s1_definition;if(typeof s1==='string')html+=rMd(s1);else{if(s1.profdef)html+=rMd(s1.profdef);if(s1.analogy)html+='<p class="def-analogy">'+rI(s1.analogy)+'</p>';if(s1.oneliner)html+='<div class="def-oneliner">'+rI(s1.oneliner)+'</div>';}html+='</div>';}
  if(sec.s2_technical)html+='<div class="sec"><div class="sec__head">📖 Technical</div>'+rMd(sec.s2_technical)+'</div>';
  if(sec.s3_banking)html+='<div class="sec sec--orange"><div class="sec__head">🏦 Banking Scenario</div>'+rMd(sec.s3_banking)+'</div>';
  if(sec.s4a_structure||sec.s4d_java||sec.s4e_build){html+='<div class="sec sec--code"><div class="sec__head">💻 Code</div>';if(sec.s4a_structure)html+='<h4>Structure</h4>'+rMd(sec.s4a_structure);if(sec.s4d_java)html+='<h4>Java</h4>'+rMd(sec.s4d_java);if(sec.s4e_build)html+='<h4>Build & Run</h4>'+rMd(sec.s4e_build);html+='</div>';}
  if(sec.s5_journey||sec.s5b_flow||sec.s5c_hld||sec.s5d_lld){html+='<div class="sec"><div class="sec__head">📈 Data Journey</div>';if(sec.s5_journey)html+=rMd(sec.s5_journey);if(sec.s5b_flow)html+='<h4>Flow</h4>'+rMd(sec.s5b_flow);if(sec.s5c_hld)html+='<h4>HLD</h4>'+rDiag(sec.s5c_hld,'HLD');if(sec.s5d_lld)html+='<h4>LLD</h4>'+rDiag(sec.s5d_lld,'LLD');html+='</div>';}
  if(sec.s6_takeaway)html+='<div class="sec sec--green"><div class="sec__head">✅ Takeaway</div><div class="takeaway">'+rMd(sec.s6_takeaway)+'</div></div>';
  html+=shareBar(a.question,'https://javabypankaj.netlify.app/#/q/'+a.id);
  return html;
}
// ===== QUESTION — Full article =====
function goQ(ch,ti,qi){
  var m=findC(ch),g=findG(ch);if(!m||!g||ti>=g.topics.length)return goCh(ch);
  var topic=g.topics[ti];
  showLoad();
  loadCh(ch).then(function(data){
    var ans=data.answers||[];
    var idSet={};topic.ids.forEach(function(id){idSet[id]=1;});
    var tAns=ans.filter(function(a){return idSet[a.id];});
    if(qi<0||qi>=tAns.length)return goTopic(ch,ti);
    var a=tAns[qi],rev=S.rev.has(a.id),sec=a.sections||{};

    title.innerHTML=crumb([['#/home','Home'],['#/chapter/'+ch,m.chapterTitle],['#/chapter/'+ch+'/topic/'+ti,topic.title]])+esc(a.id);
    acts.innerHTML='<button class="rev-btn '+(rev?'rev-btn--done':'')+'" id="clapBtn" data-qid="'+a.id+'" title="'+(rev?'Click to unmark':'Click to mark as reviewed')+'">'+(rev?'✅ Reviewed':'📝 Mark as Reviewed')+'</button>';

    var html='<div class="article">';
    html+='<div class="article__id">'+esc(a.id)+' · Chapter '+pad(ch)+' · '+esc(m.chapterTitle)+' · Topic: '+esc(topic.title)+'</div>';
    html+='<h2 class="article__title">'+esc(a.question)+'</h2>';

    if(sec.s1_definition){
      html+='<div class="sec sec--green"><div class="sec__head">📌 Definition</div>';
      var s1=sec.s1_definition;
      if(typeof s1==='string')html+=rMd(s1);
      else{if(s1.profdef)html+=rMd(s1.profdef);if(s1.analogy)html+='<p class="def-analogy">'+rI(s1.analogy)+'</p>';if(s1.oneliner)html+='<div class="def-oneliner">'+rI(s1.oneliner)+'</div>';}
      html+='</div>';
    }
    if(sec.s2_technical){html+='<div class="sec"><div class="sec__head">📖 Technical</div>'+rMd(sec.s2_technical)+'</div>';}
    if(sec.s3_banking){html+='<div class="sec sec--orange"><div class="sec__head">🏦 Banking Scenario</div>'+rMd(sec.s3_banking)+'</div>';}
    if(sec.s4a_structure||sec.s4d_java||sec.s4e_build){
      html+='<div class="sec sec--code"><div class="sec__head">💻 Code</div>';
      if(sec.s4a_structure)html+='<h4>Structure</h4>'+rMd(sec.s4a_structure);
      if(sec.s4d_java)html+='<h4>Java</h4>'+rMd(sec.s4d_java);
      if(sec.s4e_build)html+='<h4>Build & Run</h4>'+rMd(sec.s4e_build);
      html+='</div>';
    }
    if(sec.s5_journey||sec.s5b_flow||sec.s5c_hld||sec.s5d_lld){
      html+='<div class="sec"><div class="sec__head">📈 Data Journey</div>';
      if(sec.s5_journey)html+=rMd(sec.s5_journey);
      if(sec.s5b_flow)html+='<h4>Flow</h4>'+rMd(sec.s5b_flow);
      if(sec.s5c_hld)html+='<h4>HLD</h4>'+rDiag(sec.s5c_hld,'HLD');
      if(sec.s5d_lld)html+='<h4>LLD</h4>'+rDiag(sec.s5d_lld,'LLD');
      html+='</div>';
    }
    if(sec.s6_takeaway){html+='<div class="sec sec--green"><div class="sec__head">✅ Takeaway</div><div class="takeaway">'+rMd(sec.s6_takeaway)+'</div></div>';}
    html+='</div>';
    body.innerHTML=html;

    $('clapBtn').onclick=function(){var id=this.dataset.qid;if(S.rev.has(id))S.rev.delete(id);else S.rev.add(id);saveR();var on=S.rev.has(id);this.className='rev-btn'+(on?' rev-btn--done':'');this.textContent=on?'✅ Reviewed':'📝 Mark as Reviewed';this.title=on?'Click to unmark':'Click to mark as reviewed';};
    bindC(body,'.copy-btn',function(b){cpCode(b);});
    bindC(acts,'[data-go]',function(el){nav(el.dataset.go);});

    qnav.hidden=false;
    prevBtn.disabled=qi===0;nextBtn.disabled=qi===tAns.length-1;
    qnavPos.textContent=(qi+1)+' / '+tAns.length;
    prevBtn.onclick=function(){if(qi>0)nav('#/chapter/'+ch+'/'+ti+'/'+(qi-1));};
    nextBtn.onclick=function(){if(qi<tAns.length-1)nav('#/chapter/'+ch+'/'+ti+'/'+(qi+1));};
    scrollTo(0,0);
  });
}

function goById(id){
  showLoad();loadIdx().then(function(idx){
    var h=null;for(var i=0;i<idx.length;i++){if(idx[i].id===id){h=idx[i];break;}}
    if(!h){body.innerHTML='<div class="empty"><div class="empty__icon">🔍</div><div class="empty__title">Not found</div></div>';return;}
    var g=findG(h.chapter);if(g){for(var ti=0;ti<g.topics.length;ti++){var ids=g.topics[ti].ids;for(var qi=0;qi<ids.length;qi++){if(ids[qi]===id){nav('#/chapter/'+h.chapter+'/'+ti+'/'+qi);return;}}}}
    nav('#/chapter/'+h.chapter);
  });
}

function goSearch(q){
  if(!q||!q.trim())return goHome();
  title.innerHTML=crumb([['#/home','Home']])+'Search Results';
  acts.innerHTML='';showLoad();
  loadIdx().then(function(idx){
    var res=fuzzy(q,idx).slice(0,80);
    if(!res.length){body.innerHTML='<div class="empty"><div class="empty__icon">🔍</div><div class="empty__title">No results for "'+esc(q)+'"</div></div>';return;}
    var html='<p style="margin-bottom:12px;color:#999">'+res.length+' results for "'+esc(q)+'"</p><table class="tbl"><thead><tr><th style="width:80px">ID</th><th>QUESTION</th><th style="width:80px">CH</th></tr></thead><tbody>';
    res.forEach(function(r){html+='<tr data-go="#/q/'+r.id+'"><td><span class="pill pill--gray">'+esc(r.id)+'</span></td><td>'+hl(r.question,q)+'</td><td>'+pad(r.chapter)+'</td></tr>';});
    html+='</tbody></table>';
    body.innerHTML=html;
    bindC(body,'[data-go]',function(el){nav(el.dataset.go||el.closest('[data-go]').dataset.go);});
  });
}

// ===== Helpers =====
function crumb(items){return '<span class="crumb">'+items.map(function(i){return '<a data-go="'+i[0]+'">'+esc(i[1])+'</a>';}).join(' <span>›</span> ')+' › </span>';}
function wire(){
  searchIn.addEventListener('input',debounce(function(){var q=searchIn.value.trim();if(q)nav('#/search/'+encodeURIComponent(q));else nav('#/home');},250));
  searchIn.addEventListener('keydown',function(e){if(e.key==='Escape'){searchIn.value='';searchIn.blur();nav('#/home');}});
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K')){e.preventDefault();searchIn.focus();searchIn.select();}
    if(!qnav.hidden&&document.activeElement.tagName!=='INPUT'){if(e.key==='ArrowLeft'&&!prevBtn.disabled){e.preventDefault();prevBtn.click();}if(e.key==='ArrowRight'&&!nextBtn.disabled){e.preventDefault();nextBtn.click();}}
  });
  // Click breadcrumb links
  document.addEventListener('click',function(e){var a=e.target.closest('[data-go]');if(a&&a.dataset.go)nav(a.dataset.go);});
}
function fetchJ(u){return fetch(u,{cache:'force-cache'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();});}
function findC(n){n=+n;for(var i=0;i<S.ch.length;i++){if(+S.ch[i].chapter===n)return S.ch[i];}return null;}
function findG(n){if(!S.grp)return null;n=+n;for(var i=0;i<S.grp.chapters.length;i++){if(+S.grp.chapters[i].chapter===n)return S.grp.chapters[i];}return null;}
function loadCh(n){var k=String(n);if(S.cache[k])return Promise.resolve(S.cache[k]);var m=findC(n);if(!m)return Promise.reject('no');return fetchJ(DIR+(m.file||'ch'+pad(n)+'.json')).then(function(d){S.cache[k]=d;return d;});}
function loadIdx(){if(S.idx)return Promise.resolve(S.idx);return fetchJ(DIR+'search-index.json').then(function(d){S.idx=Array.isArray(d)?d:d.index||[];return S.idx;});}
function loadR(){try{var r=localStorage.getItem(LS);return new Set(r?JSON.parse(r):[]);}catch(e){return new Set();}}
function saveR(){try{localStorage.setItem(LS,JSON.stringify(Array.from(S.rev)));}catch(e){}}
function countR(ch){var d=S.cache[String(ch)];if(!d||!d.answers)return 0;var n=0;d.answers.forEach(function(a){if(S.rev.has(a.id))n++;});return n;}
function showLoad(){body.innerHTML='<div class="loader"><div class="loader__spin"></div></div>';}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function pad(n){n=String(n);return n.length<2?'0'+n:n;}
function bindC(c,s,fn){c.addEventListener('click',function(e){var n=e.target.closest(s);if(n&&c.contains(n))fn(n,e);});}
function debounce(fn,ms){var t;return function(){clearTimeout(t);var c=this,a=arguments;t=setTimeout(function(){fn.apply(c,a);},ms);};}
function fuzzy(q,idx){var ql=q.toLowerCase().trim(),tk=ql.split(/\s+/).filter(Boolean),sc=[];for(var i=0;i<idx.length;i++){var h=(idx[i].question+' '+(idx[i].chapterTitle||'')+' '+idx[i].id).toLowerCase(),s=0,p=h.indexOf(ql);if(p!==-1)s+=120-Math.min(p,60);var all=true;for(var j=0;j<tk.length;j++){if(h.indexOf(tk[j])!==-1)s+=20;else all=false;}if(all&&tk.length>1)s+=25;if(s>0)sc.push({item:idx[i],score:s});}sc.sort(function(a,b){return b.score-a.score;});return sc.map(function(x){return x.item;});}
function hl(t,q){var s=esc(t);var tk=q.toLowerCase().split(/\s+/).filter(Boolean).map(function(t){return t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');});if(!tk.length)return s;return s.replace(new RegExp('('+tk.join('|')+')','ig'),'<mark>$1</mark>');}

// Markdown
function rMd(md){if(!md)return '';md=String(md);var bl=[];md=md.replace(/```([a-zA-Z0-9+#-]*)\n([\s\S]*?)```/g,function(_,l,c){var t='\0B'+bl.length+'\0';bl.push({l:(l||'').toLowerCase(),c:c.replace(/\n$/,'')});return t;});md=esc(md);md=md.replace(/`([^`\n]+)`/g,'<code>$1</code>');md=md.replace(/\*\*([^*]+)\*\*/g,'<strong class="kw">$1</strong>');md=bFmt(md);md=md.replace(/\0B(\d+)\0/g,function(_,i){var b=bl[+i];return isDg(b.c)?dgBlk(b.c):cdBlk(b.c,b.l);});md=autoHL(md);return md;}
function rI(t){var s=esc(String(t));s=s.replace(/`([^`\n]+)`/g,'<code>$1</code>');s=s.replace(/\*\*([^*]+)\*\*/g,'<strong class="kw">$1</strong>');s=autoHL(s);return s;}

// Auto-highlight important Java/tech keywords in prose
function autoHL(html){
  var terms=[
    'thread-safe','immutable','synchronized','volatile','atomic','deadlock','race condition',
    'heap','stack','metaspace','garbage collection','GC','JIT','bytecode','classloader',
    'BigDecimal','null','NullPointerException','OutOfMemoryError','StackOverflowError',
    'HashMap','ConcurrentHashMap','ArrayList','LinkedList','TreeMap','HashSet',
    'Spring Boot','Kafka','Redis','Docker','Kubernetes','microservice','REST API',
    'ACID','transaction','isolation','propagation','rollback','commit',
    'JPA','Hibernate','lazy loading','eager loading','N\\+1','caching',
    'O\\(1\\)','O\\(n\\)','O\\(log n\\)','O\\(n log n\\)','O\\(n²\\)',
    'singleton','factory','observer','strategy','builder pattern',
    'final','static','abstract','interface','extends','implements',
    'try-with-resources','checked exception','unchecked exception',
    'CompletableFuture','ExecutorService','ReentrantLock','CountDownLatch',
    'Stream API','Optional','lambda','functional interface','Predicate','Consumer','Supplier',
    'idempotent','circuit breaker','load balancer','rate limiting','sharding','replication',
    'index','B-tree','primary key','foreign key','JOIN','GROUP BY',
    'JWT','OAuth2','CSRF','XSS','SQL injection','authentication','authorization',
    'HLD','LLD','CAP theorem','eventual consistency','strong consistency',
    'publish-subscribe','event-driven','saga pattern','CQRS','outbox pattern'
  ];
  // Only highlight in text nodes (not inside tags)
  var re=new RegExp('(?<![<\\/\\w])\\b('+terms.join('|')+')\\b(?![^<]*>)','gi');
  html=html.replace(re,function(m){return '<mark class="hl">'+m+'</mark>';});
  return html;
}
function bFmt(s){var ln=s.split('\n'),o=[],i=0;while(i<ln.length){var L=ln[i];if(/^\0B\d+\0$/.test(L.trim())){o.push(L.trim());i++;continue;}if(!L.trim()){i++;continue;}if(/^\s*[-*]\s+/.test(L)){var ul=[];while(i<ln.length&&/^\s*[-*]\s+/.test(ln[i])){ul.push('<li>'+ln[i].replace(/^\s*[-*]\s+/,'')+' </li>');i++;}o.push('<ul>'+ul.join('')+'</ul>');continue;}if(/^\s*\d+\.\s+/.test(L)){var ol=[];while(i<ln.length&&/^\s*\d+\.\s+/.test(ln[i])){ol.push('<li>'+ln[i].replace(/^\s*\d+\.\s+/,'')+' </li>');i++;}o.push('<ol>'+ol.join('')+'</ol>');continue;}if(/^\s*---+\s*$/.test(L)){i++;continue;}var p=[L];i++;while(i<ln.length&&ln[i].trim()&&!/^\s*[-*]\s+/.test(ln[i])&&!/^\s*\d+\.\s+/.test(ln[i])&&!/^\0B\d+\0$/.test(ln[i].trim())){p.push(ln[i]);i++;}o.push('<p>'+p.join('<br>')+'</p>');}return o.join('\n');}

function cdBlk(c,l){return '<div class="code-wrap"><div class="code-bar"><span>'+(l||'text')+'</span><button class="copy-btn">Copy</button></div><pre><code>'+hlC(c,l)+'</code></pre></div>';}
function isDg(c){
  // Only treat as diagram if it has MANY box-drawing chars AND no typical code patterns
  var boxChars=(c.match(/[─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬]/g)||[]).length;
  var hasCode=/\b(class|public|private|void|return|import|package|new|if|for|while|try|catch|function|var|let|const)\b/.test(c);
  if(hasCode) return false;
  return boxChars > 10;
}
function dgBlk(c){return '<div class="code-wrap"><div class="code-bar"><span>diagram</span><button class="copy-btn">Copy</button></div><pre><code>'+esc(c)+'</code></pre></div>';}
function rDiag(t,k){if(/```/.test(t))return rMd(t);return '<div class="code-wrap"><div class="code-bar"><span>'+(k||'diagram')+'</span><button class="copy-btn">Copy</button></div><pre><code>'+esc(String(t))+'</code></pre></div>';}
var KW={};'abstract assert boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static super switch synchronized this throw throws transient try void volatile while var record sealed true false null'.split(' ').forEach(function(k){KW[k]=1;});
function hlC(c,l){var s=esc(c),st=[];function sh(cl,t){var tk='\x01'+st.length+'\x01';st.push('<span class="'+cl+'">'+t+'</span>');return tk;}var cu=!l||/^(java|js|ts|kotlin|go)$/.test(l);var ha=/^(bash|sh|yaml|yml|python|py)$/.test(l);if(cu){s=s.replace(/\/\*[\s\S]*?\*\//g,function(m){return sh('tk-cm',m);});s=s.replace(/\/\/[^\n]*/g,function(m){return sh('tk-cm',m);});}if(ha||l==='sql'){if(l==='sql')s=s.replace(/--[^\n]*/g,function(m){return sh('tk-cm',m);});s=s.replace(/#[^\n]*/g,function(m){return sh('tk-cm',m);});}s=s.replace(/"(?:\\.|[^"\\\n])*"/g,function(m){return sh('tk-str',m);});s=s.replace(/'(?:\\.|[^'\\\n])*'/g,function(m){return sh('tk-str',m);});s=s.replace(/@[A-Za-z_]\w*/g,function(m){return sh('tk-an',m);});s=s.replace(/\b\d[\d_.]*[fFdDlL]?\b/g,function(m){return sh('tk-num',m);});s=s.replace(/\b[A-Za-z_]\w*\b(\s*\()?/g,function(m,p){var w=p?m.slice(0,m.length-p.length).trim():m,tail=p||'';if(KW[w])return sh('tk-kw',w)+tail;if(tail)return sh('tk-fn',w)+tail;if(/^[A-Z]/.test(w))return sh('tk-ty',w);return m;});s=s.replace(/\x01(\d+)\x01/g,function(_,i){return st[+i];});return s;}
function cpCode(btn){var wrap=btn.closest('.code-wrap');if(!wrap)return;var pre=wrap.querySelector('pre'),code=pre.querySelector('code'),text=code?code.innerText:pre.innerText;(navigator.clipboard?navigator.clipboard.writeText(text):Promise.reject()).then(function(){btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy';},1500);}).catch(function(){var ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy';},1500);});}

// ===== SMART ANALYTICS =====
var _lastPage = '', _pageStart = Date.now();

function trackEvent(type, data) {
  var payload = { type: type, page: location.hash || '#/home' };
  if (data) for (var k in data) payload[k] = data[k];
  // Send time spent on previous page
  if (_lastPage && type === 'pageview') {
    payload.timeSpent = Math.round((Date.now() - _pageStart) / 1000);
  }
  _lastPage = payload.page;
  _pageStart = Date.now();
  // Fire and forget
  try {
    navigator.sendBeacon('/api/track', JSON.stringify(payload));
  } catch(e) {
    fetch('/api/track', { method: 'POST', body: JSON.stringify(payload), headers: {'Content-Type':'application/json'} }).catch(function(){});
  }
}

// Track page views on every route change
var _origRoute = route;
route = function() {
  _origRoute();
  var hash = location.hash || '#/home';
  var parts = hash.replace(/^#\/?/,'').split('/').filter(Boolean);
  var evtData = {};
  if (parts[0] === 'chapter' && parts[1]) evtData.chapter = parts[1];
  if (parts[2] === 'topic' && parts[3]) evtData.topic = parts[3];
  if (parts.length === 5) {
    evtData.question = parts[1] + '/' + parts[3] + '/' + parts[4];
    trackEvent('question', evtData);
  } else {
    trackEvent('pageview', evtData);
  }
};

// Track time spent when leaving
window.addEventListener('beforeunload', function() {
  var timeSpent = Math.round((Date.now() - _pageStart) / 1000);
  if (timeSpent > 2) {
    try {
      navigator.sendBeacon('/api/track', JSON.stringify({ type: 'timeupdate', page: location.hash || '#/home', timeSpent: timeSpent }));
    } catch(e) {}
  }
});

// Live counter — update every 30 seconds
function updateLiveCount() {
  fetch('/api/live').then(function(r){return r.json();}).then(function(d){
    var el = document.getElementById('liveCount');
    if (el) el.textContent = d.count || 0;
  }).catch(function(){});
}
updateLiveCount();
setInterval(updateLiveCount, 30000);

// Analytics dashboard route
var _origRoute2 = route;
route = function() {
  var hash = location.hash || '';
  if (hash.indexOf('#/analytics') === 0) {
    var key = new URLSearchParams(hash.split('?')[1] || '').get('key');
    if (key === 'pankaj2026') {
      showAnalytics();
      return;
    }
  }
  _origRoute2();
};

function showAnalytics() {
  var title = document.getElementById('pageTitle');
  var acts = document.getElementById('pageActions');
  var body = document.getElementById('pageBody');
  title.textContent = '📊 Analytics Dashboard';
  acts.innerHTML = '<span class="pill pill--blue">Admin Only</span> <span class="pill pill--green" id="refreshTimer">↻ 10s</span> <button class="btn btn--sm btn--primary" id="refreshStats">↻ Refresh Now</button>';
  body.innerHTML = '<div class="loader"><div class="loader__spin"></div></div>';

  loadAnalytics(body);

  setTimeout(function(){
    var rb = document.getElementById('refreshStats');
    if(rb) rb.onclick = function(){ loadAnalytics(body); _countdown = 10; };
  }, 100);

  // Auto-refresh every 10s with countdown
  var _countdown = 10;
  var _tick = setInterval(function(){
    _countdown--;
    var te = document.getElementById('refreshTimer');
    if(te) te.textContent = '↻ ' + _countdown + 's';
    if(_countdown <= 0){
      _countdown = 10;
      loadAnalytics(body);
    }
  }, 1000);
  window.addEventListener('hashchange', function(){ clearInterval(_tick); }, {once:true});
}

function loadAnalytics(body) {
  fetch('/api/track?stats=true').then(function(r){return r.json();}).then(function(s){
    var html = '';

    // === TOP STATS CARDS ===
    html += '<div class="a-grid4">';
    html += aCard('👁 Total Views', s.totalViews || 0, '#4A90D9');
    html += aCard('👤 Unique Visitors', s.uniqueVisitors || 0, '#8e44ad');
    html += aCard('🟢 Live Now', s.liveNow || 0, '#27ae60');
    html += aCard('⏱ Time Spent', formatTime(s.totalTimeSpent || 0), '#e67e22');
    html += '</div>';

    // === DAILY VISITORS BAR CHART ===
    if (s.days && Object.keys(s.days).length > 0) {
      html += aSection('📅 Daily Visitors', barChart(s.days, '#4A90D9', true));
    }

    // === HOURLY ACTIVITY ===
    if (s.hours) {
      var hourData = {};
      for (var h = 0; h < 24; h++) hourData[h + ':00'] = s.hours[h] || 0;
      html += aSection('🕐 Activity by Hour (UTC)', barChart(hourData, '#6366f1', false));
    }

    // === CHAPTER POPULARITY ===
    if (s.chapters && Object.keys(s.chapters).length > 0) {
      html += aSection('📚 Chapter Popularity', hBarChart(s.chapters, '#4A90D9'));
    }

    // === TOP QUESTIONS ===
    if (s.questions && Object.keys(s.questions).length > 0) {
      var topQ = {};
      Object.keys(s.questions).sort(function(a,b){return s.questions[b]-s.questions[a];}).slice(0,15).forEach(function(k){ topQ[k] = s.questions[k]; });
      html += aSection('🔥 Most Opened Questions', hBarChart(topQ, '#e74c3c'));
    }

    // === COUNTRIES ===
    if (s.countries && Object.keys(s.countries).length > 0) {
      html += aSection('🌍 Visitors by Country', hBarChart(s.countries, '#27ae60'));
    }

    // === DEVICES & BROWSERS (side by side) ===
    html += '<div class="a-grid2">';
    if (s.devices) {
      html += '<div class="a-box"><h3 class="a-box__title">📱 Devices</h3>' + donutBars(s.devices, ['#4A90D9','#e67e22','#27ae60']) + '</div>';
    }
    if (s.browsers) {
      html += '<div class="a-box"><h3 class="a-box__title">🌐 Browsers</h3>' + donutBars(s.browsers, ['#4A90D9','#e74c3c','#f39c12','#27ae60','#8e44ad']) + '</div>';
    }
    html += '</div>';

    // === REFERRERS ===
    if (s.referers && Object.keys(s.referers).length > 0) {
      html += aSection('🔗 Traffic Sources', hBarChart(s.referers, '#8e44ad'));
    }

    body.innerHTML = html;
  }).catch(function(e) {
    body.innerHTML = '<div class="empty"><div class="empty__icon">⚠️</div><div class="empty__title">Could not load: '+e.message+'</div></div>';
  });
}

// === Chart helpers ===
function aCard(label, value, color) {
  return '<div class="a-stat" style="border-top:3px solid '+color+'"><div class="a-stat__val" style="color:'+color+'">'+value+'</div><div class="a-stat__label">'+label+'</div></div>';
}

function aSection(title, content) {
  return '<div class="a-box"><h3 class="a-box__title">'+title+'</h3>'+content+'</div>';
}

// Vertical bar chart
function barChart(data, color, sortByKey) {
  var keys = Object.keys(data);
  if (sortByKey) keys.sort();
  var max = 0;
  keys.forEach(function(k){ if(data[k]>max) max=data[k]; });
  if (!max) return '<p style="color:#999">No data yet</p>';

  var html = '<div class="bar-chart">';
  keys.forEach(function(k) {
    var val = data[k];
    var pct = Math.round(val / max * 100);
    html += '<div class="bar-col">';
    html += '<div class="bar-val">'+val+'</div>';
    html += '<div class="bar-fill" style="height:'+pct+'%;background:'+color+'"></div>';
    html += '<div class="bar-label">'+esc(String(k).slice(-5))+'</div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// Horizontal bar chart
function hBarChart(data, color) {
  var keys = Object.keys(data).sort(function(a,b){return data[b]-data[a];});
  var max = data[keys[0]] || 1;

  var html = '<div class="hbar-chart">';
  keys.forEach(function(k) {
    var val = data[k];
    var pct = Math.round(val / max * 100);
    html += '<div class="hbar-row">';
    html += '<div class="hbar-label" title="'+esc(k)+'">'+esc(String(k).slice(0,30))+'</div>';
    html += '<div class="hbar-track"><div class="hbar-fill" style="width:'+pct+'%;background:'+color+'"></div></div>';
    html += '<div class="hbar-val">'+val+'</div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// Donut-style percentage bars (for devices/browsers)
function donutBars(data, colors) {
  var keys = Object.keys(data).sort(function(a,b){return data[b]-data[a];});
  var total = 0;
  keys.forEach(function(k){ total += data[k]; });
  if (!total) return '<p style="color:#999">No data</p>';

  var html = '<div class="donut-bars">';
  keys.forEach(function(k, i) {
    var val = data[k];
    var pct = Math.round(val / total * 100);
    var col = colors[i % colors.length];
    html += '<div class="donut-row">';
    html += '<div class="donut-color" style="background:'+col+'"></div>';
    html += '<div class="donut-label">'+esc(k)+'</div>';
    html += '<div class="donut-track"><div class="donut-fill" style="width:'+pct+'%;background:'+col+'"></div></div>';
    html += '<div class="donut-val">'+pct+'% <span style="color:#999">('+val+')</span></div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function formatTime(sec) {
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.round(sec/60) + 'm';
  return Math.round(sec/3600) + 'h ' + Math.round((sec%3600)/60) + 'm';
}

// ===== EMAIL POPUP =====
(function(){
  var shown = localStorage.getItem('jim.popup.shown');
  if (shown) return;

  // Show after 30 seconds
  setTimeout(function(){
    if (localStorage.getItem('jim.popup.shown')) return;
    var overlay = document.getElementById('popupOverlay');
    if (overlay) { overlay.hidden = false; overlay.style.display = 'flex'; }
  }, 30000);

  // Close button + "No thanks" + click overlay
  function closePopup() {
    var ov = document.getElementById('popupOverlay');
    if (ov) ov.style.display = 'none';
    localStorage.setItem('jim.popup.shown', '1');
  }
  document.addEventListener('click', function(e){
    if (e.target.id === 'popupClose' || e.target.id === 'popupSkip' || e.target.id === 'popupOverlay') {
      closePopup();
    }
  });

  // Subscribe form
  var form = document.getElementById('subscribeForm');
  if (form) form.addEventListener('submit', function(e){
    e.preventDefault();
    var email = document.getElementById('subEmail').value.trim();
    var msg = document.getElementById('subMsg');
    var btn = form.querySelector('button');
    btn.textContent = 'Sending...';
    btn.disabled = true;

    fetch('/api/subscribe', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: email, source: 'popup' })
    }).then(function(r){ return r.json(); }).then(function(d){
      msg.hidden = false;
      if (d.ok) {
        msg.className = 'popup__msg ok';
        msg.textContent = d.msg || 'Subscribed! Welcome aboard.';
        localStorage.setItem('jim.popup.shown', '1');
        form.style.display = 'none';
        // Auto-close after 2 seconds
        setTimeout(function(){
          closePopup();
        }, 2000);
      } else {
        msg.className = 'popup__msg err';
        msg.textContent = d.error || 'Something went wrong.';
        btn.textContent = 'Subscribe';
        btn.disabled = false;
      }
    }).catch(function(){
      msg.hidden = false;
      msg.className = 'popup__msg err';
      msg.textContent = 'Network error. Try again.';
      btn.textContent = 'Subscribe';
      btn.disabled = false;
    });
  });
})();

// ===== SHARE BUTTONS =====
function shareBar(pageTitle, pageUrl) {
  if (!pageUrl) pageUrl = 'https://javabypankaj.netlify.app/';
  if (!pageTitle) pageTitle = 'Java Interview Mastery — 2,506 Questions';
  var encodedUrl = encodeURIComponent(pageUrl);
  var encodedTitle = encodeURIComponent(pageTitle);

  return '<div class="share-bar">' +
    '<span class="share-bar__label">Share:</span>' +
    '<a class="share-btn share-btn--in" href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl + '" target="_blank">in LinkedIn</a>' +
    '<a class="share-btn share-btn--tw" href="https://twitter.com/intent/tweet?text=' + encodedTitle + '&url=' + encodedUrl + '" target="_blank">𝕏 Twitter</a>' +
    '<a class="share-btn share-btn--wa" href="https://wa.me/?text=' + encodedTitle + '%20' + encodedUrl + '" target="_blank">💬 WhatsApp</a>' +
    '<button class="share-btn" onclick="copyLink()">📋 Copy Link</button>' +
    '</div>';
}

window.copyLink = function() {
  var url = 'https://javabypankaj.netlify.app/' + (location.hash || '');
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function(){
    alert('Link copied!');
  }).catch(function(){
    var ta = document.createElement('textarea'); ta.value = url; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    alert('Link copied!');
  });
};
})();
