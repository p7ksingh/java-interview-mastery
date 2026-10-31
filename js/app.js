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

// ===== TOPIC — Questions with expandable answers =====
function goTopic(ch,ti){
  var m=findC(ch),g=findG(ch);if(!m||!g||ti>=g.topics.length)return goCh(ch);
  var topic=g.topics[ti];
  title.innerHTML=crumb([['#/home','Home'],['#/chapter/'+ch,m.chapterTitle]])+esc(topic.title);
  acts.innerHTML='<span class="pill pill--dark">Topic '+(ti+1)+'/'+g.topics.length+'</span> <span class="pill pill--blue">'+topic.count+' Questions</span>'+
    (ti>0?' <button class="btn btn--sm btn--outline" data-go="#/chapter/'+ch+'/topic/'+(ti-1)+'">← Prev Topic</button>':'')+
    (ti<g.topics.length-1?' <button class="btn btn--sm btn--primary" data-go="#/chapter/'+ch+'/topic/'+(ti+1)+'">Next Topic →</button>':'');

  showLoad();
  loadCh(ch).then(function(data){
    var ans=data.answers||[];
    var idSet={};topic.ids.forEach(function(id){idSet[id]=1;});
    var tAns=ans.filter(function(a){return idSet[a.id];});

    var html='';
    tAns.forEach(function(a,qi){
      var rev=S.rev.has(a.id);
      var sec=a.sections||{};

      html+='<div class="qa-card" id="qa-'+qi+'">';
      html+='<div class="qa-card__head">';
      html+='<span class="badge badge--num">'+(qi+1)+'</span>';
      html+='<span class="pill pill--gray">'+esc(a.id)+'</span>';
      html+='<strong class="qa-card__q">'+esc(a.question)+'</strong>';
      html+='<button class="btn btn--sm '+(rev?'btn--green':'btn--outline')+'" data-rev="'+a.id+'">'+(rev?'✓':'☐')+'</button>';
      html+='</div>';

      // ANSWER — always visible
      html+='<div class="qa-card__answer">';

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

      html+='</div></div>';
    });

    body.innerHTML=html;
    bindC(body,'.copy-btn',function(b){cpCode(b);});
    bindC(body,'[data-rev]',function(btn){
      var id=btn.dataset.rev;
      if(S.rev.has(id))S.rev.delete(id);else S.rev.add(id);saveR();
      var on=S.rev.has(id);
      btn.className='btn btn--sm '+(on?'btn--green':'btn--outline');
      btn.textContent=on?'✓':'☐';
    });
    bindC(acts,'[data-go]',function(el){nav(el.dataset.go);});
    scrollTo(0,0);
  });
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
    acts.innerHTML='<button class="btn btn--sm '+(rev?'btn--green':'btn--outline')+'" id="clapBtn" data-qid="'+a.id+'">'+(rev?'✓ Reviewed':'Mark Reviewed')+'</button>';

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

    $('clapBtn').onclick=function(){var id=this.dataset.qid;if(S.rev.has(id))S.rev.delete(id);else S.rev.add(id);saveR();var on=S.rev.has(id);this.className='btn btn--sm '+(on?'btn--green':'btn--outline');this.textContent=on?'✓ Reviewed':'Mark Reviewed';};
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
function isDg(c){return (c.match(/[─│┌┐└┘├┤┬┴┼═║╔╗╚╝→←↑↓▶▼]/g)||[]).length>6;}
function dgBlk(c){return '<div class="diagram-wrap"><div class="diagram-bar">Diagram</div><pre class="diagram-art">'+esc(c)+'</pre></div>';}
function rDiag(t,k){if(/```/.test(t))return rMd(t);return '<div class="diagram-wrap"><div class="diagram-bar">'+(k||'Diagram')+'</div><pre class="diagram-art">'+esc(String(t))+'</pre></div>';}
var KW={};'abstract assert boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static super switch synchronized this throw throws transient try void volatile while var record sealed true false null'.split(' ').forEach(function(k){KW[k]=1;});
function hlC(c,l){var s=esc(c),st=[];function sh(cl,t){var tk='\x01'+st.length+'\x01';st.push('<span class="'+cl+'">'+t+'</span>');return tk;}var cu=!l||/^(java|js|ts|kotlin|go)$/.test(l);var ha=/^(bash|sh|yaml|yml|python|py)$/.test(l);if(cu){s=s.replace(/\/\*[\s\S]*?\*\//g,function(m){return sh('tk-cm',m);});s=s.replace(/\/\/[^\n]*/g,function(m){return sh('tk-cm',m);});}if(ha||l==='sql'){if(l==='sql')s=s.replace(/--[^\n]*/g,function(m){return sh('tk-cm',m);});s=s.replace(/#[^\n]*/g,function(m){return sh('tk-cm',m);});}s=s.replace(/"(?:\\.|[^"\\\n])*"/g,function(m){return sh('tk-str',m);});s=s.replace(/'(?:\\.|[^'\\\n])*'/g,function(m){return sh('tk-str',m);});s=s.replace(/@[A-Za-z_]\w*/g,function(m){return sh('tk-an',m);});s=s.replace(/\b\d[\d_.]*[fFdDlL]?\b/g,function(m){return sh('tk-num',m);});s=s.replace(/\b[A-Za-z_]\w*\b(\s*\()?/g,function(m,p){var w=p?m.slice(0,m.length-p.length).trim():m,tail=p||'';if(KW[w])return sh('tk-kw',w)+tail;if(tail)return sh('tk-fn',w)+tail;if(/^[A-Z]/.test(w))return sh('tk-ty',w);return m;});s=s.replace(/\x01(\d+)\x01/g,function(_,i){return st[+i];});return s;}
function cpCode(btn){var pre=btn.closest('.code-wrap').querySelector('pre'),code=pre.querySelector('code'),text=code?code.innerText:pre.innerText;(navigator.clipboard?navigator.clipboard.writeText(text):Promise.reject()).then(function(){btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy';},1500);}).catch(function(){var ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy';},1500);});}
})();
