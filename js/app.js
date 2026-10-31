/* ==========================================================================
   Java Interview Mastery — app.js
   Vanilla JS single-page app. No frameworks. Static-site friendly.
   Medium.com-style rendering. Data loading logic unchanged:
   fetches data/chapters.json, data/search-index.json, data/chNN.json.
   Features: chapter lazy-loading, section tabs, fuzzy search w/ debounce,
   hash routing, syntax highlighting, copy-to-clipboard, keyboard nav,
   localStorage progress (mark as reviewed), mobile drawer, back-to-top.
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------- Config / State ------------------------- */
  var DATA_DIR = 'data/';
  var PAGE_SIZE = 25;                 // questions rendered per "page" (lazy render)
  var LS_REVIEWED = 'jim.reviewed';   // Set of reviewed question ids

  var state = {
    chapters: [],          // from chapters.json
    totalAnswers: 0,
    searchIndex: null,     // lazily loaded array
    chapterCache: {},      // { "1": {answers:[...]} }
    reviewed: loadReviewed(),
    renderLimit: PAGE_SIZE // current number of questions shown in chapter view
  };

  /* ----------------------------- DOM refs ------------------------------- */
  var el = {
    content: byId('content'),
    chapterNav: byId('chapterNav'),
    searchInput: byId('searchInput'),
    sidebar: byId('sidebar'),
    backdrop: byId('sidebarBackdrop'),
    menuToggle: byId('menuToggle'),
    scrollTop: byId('scrollTop')
  };

  function byId(id) { return document.getElementById(id); }

  /* ============================== Bootstrap ============================= */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    wireGlobalEvents();
    loadChapters()
      .then(function () {
        renderChapterNav();
        route();                 // render based on current hash
      })
      .catch(function (err) {
        renderError('Failed to load chapters.json', err);
      });
  }

  /* ============================ Data loading =========================== */
  function loadChapters() {
    return fetchJSON(DATA_DIR + 'chapters.json').then(function (data) {
      state.chapters = data.chapters || [];
      state.totalAnswers = data.totalAnswers || 0;
    });
  }

  // Lazy-loaded search index (only fetched on first search)
  function loadSearchIndex() {
    if (state.searchIndex) return Promise.resolve(state.searchIndex);
    return fetchJSON(DATA_DIR + 'search-index.json').then(function (data) {
      state.searchIndex = Array.isArray(data) ? data : (data.index || []);
      return state.searchIndex;
    });
  }

  // Lazy-loaded chapter data with in-memory cache
  function loadChapter(chapterNum) {
    var key = String(chapterNum);
    if (state.chapterCache[key]) return Promise.resolve(state.chapterCache[key]);
    var meta = findChapter(chapterNum);
    if (!meta) return Promise.reject(new Error('Unknown chapter ' + chapterNum));
    var file = meta.file || ('ch' + pad2(chapterNum) + '.json');
    return fetchJSON(DATA_DIR + file).then(function (data) {
      state.chapterCache[key] = data;
      return data;
    });
  }

  function fetchJSON(url) {
    return fetch(url, { cache: 'force-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return res.json();
    });
  }

  function findChapter(num) {
    num = Number(num);
    for (var i = 0; i < state.chapters.length; i++) {
      if (Number(state.chapters[i].chapter) === num) return state.chapters[i];
    }
    return null;
  }

  /* ============================== Routing ============================== */
  // Routes:  #/home   #/chapter/1   #/search/<query>   #/q/177
  window.addEventListener('hashchange', route);

  function route() {
    var hash = location.hash.replace(/^#\/?/, '');  // strip "#" or "#/"
    var parts = hash.split('/').filter(Boolean);

    closeDrawer();

    if (!parts.length || parts[0] === 'home') {
      setActiveNav('home');
      renderHome();
      return;
    }
    if (parts[0] === 'chapter') {
      state.renderLimit = PAGE_SIZE;
      renderChapter(Number(parts[1]));
      return;
    }
    if (parts[0] === 'search') {
      var q = decodeURIComponent(parts.slice(1).join('/'));
      if (el.searchInput.value !== q) el.searchInput.value = q;
      renderSearch(q);
      return;
    }
    if (parts[0] === 'q') {
      openQuestionById(parts[1]);
      return;
    }
    // unknown → home
    renderHome();
  }

  function navigate(hash) {
    if (location.hash === hash) route();  // force re-render on same hash
    else location.hash = hash;
  }

  /* ============================= Home view ============================= */
  function renderHome() {
    var reviewedCount = state.reviewed.size;
    var pct = state.totalAnswers ? Math.round((reviewedCount / state.totalAnswers) * 100) : 0;

    var rows = state.chapters.map(function (c) {
      var revInCh = countReviewedInChapter(c.chapter);
      var w = c.count ? Math.round((revInCh / c.count) * 100) : 0;
      return (
        '<button class="chapter-row" data-chapter="' + c.chapter + '">' +
          '<div class="chapter-row__meta">' +
            '<span class="chapter-row__num">Chapter ' + pad2(c.chapter) + '</span>' +
            '<span class="chapter-row__dot">·</span>' +
            '<span>' + c.count + ' questions</span>' +
          '</div>' +
          '<div class="chapter-row__title">' + escapeHtml(c.chapterTitle) + '</div>' +
          '<div class="chapter-row__sub">' +
            '<span class="chapter-row__bar"><span style="width:' + w + '%"></span></span>' +
            '<span>' + revInCh + ' reviewed</span>' +
          '</div>' +
        '</button>'
      );
    }).join('');

    el.content.innerHTML =
      '<section class="hero">' +
        '<h1>Java Interview <span class="accent">Mastery</span></h1>' +
        '<p>' + state.totalAnswers.toLocaleString() + ' real interview questions across ' +
          state.chapters.length + ' chapters — professional definitions, banking-domain ' +
          'examples, runnable code and HLD/LLD diagrams.</p>' +
      '</section>' +
      '<div class="stats-row">' +
        statBox(state.totalAnswers.toLocaleString(), 'Questions') +
        statBox(String(state.chapters.length), 'Chapters') +
        statBox(reviewedCount.toLocaleString(), 'Reviewed') +
        statBox(pct + '%', 'Progress') +
      '</div>' +
      '<div class="chapter-list">' +
        '<p class="section-label">All chapters</p>' +
        rows +
      '</div>';

    // animate progress bars
    requestAnimationFrame(function () {
      var bars = el.content.querySelectorAll('.chapter-row__bar > span');
      bars.forEach(function (b) { b.style.width = b.style.width; });
    });

    bindDelegated(el.content, '.chapter-row', function (node) {
      navigate('#/chapter/' + node.getAttribute('data-chapter'));
    });

    document.title = 'Java Interview Mastery — 2,506 Questions with Industry Answers';
    scrollToTop(true);
  }

  function statBox(num, label) {
    return '<div class="stat"><div class="stat__num">' + num +
           '</div><div class="stat__label">' + label + '</div></div>';
  }

  /* ============================ Chapter view =========================== */
  function renderChapter(chapterNum) {
    var meta = findChapter(chapterNum);
    if (!meta) { renderError('Chapter ' + chapterNum + ' not found.'); return; }

    setActiveNav('chapter', chapterNum);
    document.title = meta.chapterTitle + ' — Java Interview Mastery';
    showLoading('Loading Chapter ' + chapterNum + ' — ' + meta.chapterTitle + '…');

    loadChapter(chapterNum).then(function (data) {
      var answers = data.answers || [];
      renderChapterAnswers(meta, answers);
    }).catch(function (err) {
      renderError('Could not load chapter ' + chapterNum, err);
    });
  }

  function renderChapterAnswers(meta, answers) {
    var shown = answers.slice(0, state.renderLimit);
    var html =
      '<div class="page-head">' +
        '<span class="eyebrow">Chapter ' + pad2(meta.chapter) + '</span>' +
        '<h1>' + escapeHtml(meta.chapterTitle) + '</h1>' +
        '<p>' + answers.length + ' questions · ' +
          countReviewedInChapter(meta.chapter) + ' reviewed</p>' +
      '</div>';

    html += '<div class="qlist">' + shown.map(function (a) { return questionCardHtml(a); }).join('') + '</div>';

    if (answers.length > state.renderLimit) {
      html += '<div class="load-more-wrap"><button class="load-more" id="loadMore">Show more (' +
        (answers.length - state.renderLimit) + ' remaining)</button></div>';
    }

    el.content.innerHTML = html;
    enhanceContent(el.content);

    var lm = byId('loadMore');
    if (lm) {
      lm.addEventListener('click', function () {
        state.renderLimit += PAGE_SIZE;
        renderChapterAnswers(meta, answers);
      });
    }
    scrollToTop(true);
  }

  /* ========================= Question card HTML ======================== */
  function questionCardHtml(ans, opts) {
    opts = opts || {};
    var id = ans.id;
    var reviewed = state.reviewed.has(id);
    var sections = ans.sections || {};
    var tabs = buildTabs(sections);

    var tabBtns = tabs.map(function (t, i) {
      return '<button class="tab' + (i === 0 ? ' is-active' : '') +
        '" data-tab="' + t.key + '">' + t.label + '</button>';
    }).join('');

    var panels = tabs.map(function (t, i) {
      return '<div class="tab-panel' + (i === 0 ? ' is-active' : '') +
        '" data-panel="' + t.key + '">' + t.html + '</div>';
    }).join('');

    var openClass = opts.open ? ' is-open' : '';
    var revClass = reviewed ? ' is-reviewed' : '';

    return (
      '<article class="qcard' + openClass + revClass + '" id="qcard-' + id + '" data-qid="' + id + '">' +
        '<div class="qcard__header" data-toggle>' +
          '<span class="qcard__meta-id">' + escapeHtml(id) + '</span>' +
          '<h2 class="qcard__q">' + escapeHtml(ans.question) + '</h2>' +
          '<span class="qcard__chevron" aria-hidden="true">⌄</span>' +
        '</div>' +
        '<div class="qcard__body"><div class="qcard__body-inner">' +
          '<div class="answer-toolbar">' +
            '<button class="clap-btn' + (reviewed ? ' is-reviewed' : '') +
              '" data-review="' + id + '">' +
              '<span class="clap-icon">' + (reviewed ? '✓' : '👏') + '</span>' +
              '<span class="clap-label">' + (reviewed ? 'Reviewed' : 'Mark as reviewed') + '</span>' +
            '</button>' +
          '</div>' +
          '<div class="qcard__content">' +
            '<div class="tabs" role="tablist">' + tabBtns + '</div>' +
            panels +
          '</div>' +
        '</div></div>' +
      '</article>'
    );
  }

  // Map raw section fields → 6 logical tabs (S1..S6)
  function buildTabs(sections) {
    var tabs = [];

    // S1 — Definition (object with profdef / oneliner / analogy)
    var s1 = sections.s1_definition;
    if (s1) {
      var s1html = '';
      if (typeof s1 === 'string') {
        s1html = renderMarkdown(s1);
      } else {
        if (s1.profdef)  s1html += subsection('Professional definition', renderMarkdown(s1.profdef));
        if (s1.oneliner) s1html += callout('💡', renderInline(s1.oneliner));
        if (s1.analogy)  s1html += subsection('In simple words (banking analogy)', renderMarkdown(s1.analogy));
      }
      tabs.push({ key: 's1', label: 'Definition', html: s1html });
    }

    if (sections.s2_technical)
      tabs.push({ key: 's2', label: 'Technical', html: renderMarkdown(sections.s2_technical) });

    if (sections.s3_banking)
      tabs.push({ key: 's3', label: 'Banking', html: renderMarkdown(sections.s3_banking) });

    // S4 — Code (structure + java + build)
    var s4 = '';
    if (sections.s4a_structure) s4 += subsection('Project structure', renderMarkdown(sections.s4a_structure));
    if (sections.s4d_java)      s4 += subsection('Java code', renderMarkdown(sections.s4d_java));
    if (sections.s4e_build)     s4 += subsection('Build &amp; run', renderMarkdown(sections.s4e_build));
    if (s4) tabs.push({ key: 's4', label: 'Code', html: s4 });

    // S5 — Data Journey (journey + flow + hld + lld)
    var s5 = '';
    if (sections.s5_journey) s5 += subsection('Data journey', renderMarkdown(sections.s5_journey));
    if (sections.s5b_flow)   s5 += subsection('Flow', renderMarkdown(sections.s5b_flow));
    if (sections.s5c_hld)    s5 += subsection('HLD — High-Level Design', renderDiagram(sections.s5c_hld, 'HLD'));
    if (sections.s5d_lld)    s5 += subsection('LLD — Low-Level Design', renderDiagram(sections.s5d_lld, 'LLD'));
    if (s5) tabs.push({ key: 's5', label: 'Data Journey', html: s5 });

    if (sections.s6_takeaway)
      tabs.push({ key: 's6', label: 'Takeaway', html: renderMarkdown(sections.s6_takeaway) });

    if (!tabs.length) tabs.push({ key: 'na', label: 'Answer', html: '<p class="text-faint">No content.</p>' });
    return tabs;
  }

  function subsection(title, html) {
    return '<div class="subsection"><h4 class="subsection__title">' + title + '</h4>' + html + '</div>';
  }
  function callout(icon, html) {
    return '<div class="callout"><span class="callout__icon">' + icon +
      '</span><div>' + html + '</div></div>';
  }

  /* ============================= Search view =========================== */
  function renderSearch(query) {
    setActiveNav(null);
    document.title = 'Search: ' + query + ' — Java Interview Mastery';

    if (!query || !query.trim()) { renderHome(); return; }
    showLoading('Searching…');

    loadSearchIndex().then(function (index) {
      var results = fuzzySearch(query, index).slice(0, 100);
      if (!results.length) {
        el.content.innerHTML = emptyState('🔍', 'No results for “' + escapeHtml(query) + '”',
          'Try a different keyword or browse chapters from the sidebar.');
        return;
      }
      var html = '<div class="page-head">' +
        '<span class="eyebrow">Search</span>' +
        '<h1>Results</h1>' +
        '<p class="result-count">' + results.length + ' match' + (results.length === 1 ? '' : 'es') +
        ' for “' + escapeHtml(query) + '”</p></div>';

      html += results.map(function (r) {
        return (
          '<article class="result-row" data-open-q="' + r.id + '">' +
            '<div class="result-row__meta">' +
              '<span class="result-row__chapter">CH ' + pad2(r.chapter) + ' · ' +
                escapeHtml(r.chapterTitle || '') + '</span>' +
              '<span class="chapter-row__dot">·</span>' +
              '<span class="mono">' + escapeHtml(r.id) + '</span>' +
            '</div>' +
            '<div class="result-row__q">' + highlight(r.question, query) + '</div>' +
          '</article>'
        );
      }).join('');

      el.content.innerHTML = html;
      bindDelegated(el.content, '[data-open-q]', function (node) {
        navigate('#/q/' + node.getAttribute('data-open-q'));
      });
      scrollToTop(true);
    }).catch(function (err) {
      renderError('Search failed', err);
    });
  }

  // Lightweight fuzzy/relevance scoring (subsequence + token match)
  function fuzzySearch(query, index) {
    var q = query.toLowerCase().trim();
    var tokens = q.split(/\s+/).filter(Boolean);
    var scored = [];
    for (var i = 0; i < index.length; i++) {
      var item = index[i];
      var hay = (item.question + ' ' + (item.chapterTitle || '') + ' ' + item.id).toLowerCase();
      var score = scoreMatch(hay, q, tokens);
      if (score > 0) scored.push({ item: item, score: score });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.map(function (s) { return s.item; });
  }

  function scoreMatch(hay, q, tokens) {
    var score = 0;
    // exact phrase
    var idx = hay.indexOf(q);
    if (idx !== -1) score += 120 - Math.min(idx, 60);
    // all tokens present
    var allTokens = true;
    for (var i = 0; i < tokens.length; i++) {
      if (hay.indexOf(tokens[i]) !== -1) score += 20;
      else allTokens = false;
    }
    if (allTokens && tokens.length > 1) score += 25;
    // subsequence (fuzzy) bonus on the phrase
    if (score === 0 && isSubsequence(q.replace(/\s+/g, ''), hay)) score += 8;
    return score;
  }

  function isSubsequence(needle, hay) {
    var j = 0;
    for (var i = 0; i < hay.length && j < needle.length; i++) {
      if (hay[i] === needle[j]) j++;
    }
    return j === needle.length;
  }

  /* ==================== Open single question by id ===================== */
  function openQuestionById(id) {
    if (!id) { renderHome(); return; }
    // need to know which chapter this id lives in → use search index
    showLoading('Loading question ' + id + '…');
    loadSearchIndex().then(function (index) {
      var hit = null;
      for (var i = 0; i < index.length; i++) {
        if (index[i].id === id) { hit = index[i]; break; }
      }
      if (!hit) { renderError('Question ' + id + ' not found.'); return; }
      return loadChapter(hit.chapter).then(function (data) {
        var ans = (data.answers || []).filter(function (a) { return a.id === id; })[0];
        if (!ans) { renderError('Question ' + id + ' not found in chapter.'); return; }
        setActiveNav('chapter', hit.chapter);
        document.title = ans.question.slice(0, 60) + ' — Java Interview Mastery';

        var back = '<div class="back-link" data-route="#/chapter/' + hit.chapter + '">' +
          '← ' + escapeHtml(hit.chapterTitle || ('Chapter ' + hit.chapter)) + '</div>';

        el.content.innerHTML = back + questionCardHtml(ans, { open: true });
        enhanceContent(el.content);

        bindDelegated(el.content, '[data-route]', function (node) {
          navigate(node.getAttribute('data-route'));
        });
        // smooth scroll to the card
        var card = byId('qcard-' + id);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }).catch(function (err) {
      renderError('Could not open question ' + id, err);
    });
  }

  /* ===================== Content enhancement / events ================== */
  // Wire up toggles, tabs, review buttons, highlight + copy inside a container
  function enhanceContent(container) {
    // expand / collapse
    bindDelegated(container, '[data-toggle]', function (node) {
      var card = node.closest('.qcard');
      if (card) card.classList.toggle('is-open');
    });

    // section tabs
    container.addEventListener('click', function (e) {
      var tab = e.target.closest('.tab');
      if (!tab) return;
      var wrap = tab.closest('.qcard__content');
      if (!wrap) return;
      var key = tab.getAttribute('data-tab');
      wrap.querySelectorAll('.tab').forEach(function (t) {
        t.classList.toggle('is-active', t === tab);
      });
      wrap.querySelectorAll('.tab-panel').forEach(function (p) {
        p.classList.toggle('is-active', p.getAttribute('data-panel') === key);
      });
    });

    // reviewed toggle
    bindDelegated(container, '[data-review]', function (node) {
      var qid = node.getAttribute('data-review');
      toggleReviewed(qid, node);
    });

    // copy buttons
    bindDelegated(container, '.code-copy', function (node) {
      copyCode(node);
    });
  }

  /* ========================= Markdown rendering ======================== */
  // Renders a subset of markdown: fenced code blocks, inline code, bold,
  // lists, tables, paragraphs. Fenced blocks get syntax highlight + copy btn.
  function renderMarkdown(md) {
    if (md == null) return '';
    md = String(md);

    // 1. Extract fenced code blocks first (protect from other transforms)
    var blocks = [];
    md = md.replace(/```([a-zA-Z0-9+#-]*)\n([\s\S]*?)```/g, function (_, lang, code) {
      var token = '\u0000CB' + blocks.length + '\u0000';
      blocks.push({ lang: (lang || '').toLowerCase(), code: code.replace(/\n$/, '') });
      return token;
    });

    // 2. Escape remaining HTML
    md = escapeHtml(md);

    // 3. Inline formatting
    md = inlineFormat(md);

    // 4. Block structure (paragraphs, lists, tables) on the escaped text
    md = blockFormat(md);

    // 5. Re-insert code blocks (rendered)
    md = md.replace(/\u0000CB(\d+)\u0000/g, function (_, i) {
      var b = blocks[Number(i)];
      return isDiagramCode(b.code, b.lang) ? diagramBlock(b.code) : codeBlock(b.code, b.lang);
    });

    return md;
  }

  // Inline-only (no block wrapping) — for one-liners inside callouts
  function renderInline(text) {
    return inlineFormat(escapeHtml(String(text)));
  }

  function inlineFormat(s) {
    // inline code `...`
    s = s.replace(/`([^`\n]+)`/g, function (_, c) { return '<code>' + c + '</code>'; });
    // bold **...**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return s;
  }

  function blockFormat(s) {
    var lines = s.split('\n');
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      // skip protected code tokens as their own block
      if (/^\u0000CB\d+\u0000$/.test(line.trim())) { out.push(line.trim()); i++; continue; }

      // blank
      if (!line.trim()) { i++; continue; }

      // table (line with | and a following |---| separator)
      if (line.indexOf('|') !== -1 && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].indexOf('-') !== -1) {
        var tbl = [];
        var header = line;
        i += 2; // skip header + separator
        while (i < lines.length && lines[i].indexOf('|') !== -1 && lines[i].trim()) {
          tbl.push(lines[i]); i++;
        }
        out.push(renderTable(header, tbl));
        continue;
      }

      // unordered list
      if (/^\s*[-*]\s+/.test(line)) {
        var ul = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          ul.push('<li>' + lines[i].replace(/^\s*[-*]\s+/, '') + '</li>'); i++;
        }
        out.push('<ul>' + ul.join('') + '</ul>');
        continue;
      }

      // ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        var ol = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          ol.push('<li>' + lines[i].replace(/^\s*\d+\.\s+/, '') + '</li>'); i++;
        }
        out.push('<ol>' + ol.join('') + '</ol>');
        continue;
      }

      // heading (#, ##, ###)
      var hm = line.match(/^(#{1,4})\s+(.*)$/);
      if (hm) {
        var lvl = Math.min(hm[1].length + 1, 4);
        out.push('<h' + lvl + '>' + hm[2] + '</h' + lvl + '>');
        i++;
        continue;
      }

      // horizontal rule
      if (/^\s*---+\s*$/.test(line)) { i++; continue; }

      // paragraph (gather consecutive non-structural lines)
      var para = [line];
      i++;
      while (i < lines.length && lines[i].trim() &&
             !/^\s*[-*]\s+/.test(lines[i]) &&
             !/^\s*\d+\.\s+/.test(lines[i]) &&
             !/^(#{1,4})\s+/.test(lines[i]) &&
             !/^\u0000CB\d+\u0000$/.test(lines[i].trim()) &&
             lines[i].indexOf('|') === -1) {
        para.push(lines[i]); i++;
      }
      out.push('<p>' + para.join('<br>') + '</p>');
    }

    return out.join('\n');
  }

  function renderTable(headerLine, rows) {
    function cells(l) {
      return l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
    }
    var th = cells(headerLine).map(function (c) { return '<th>' + c + '</th>'; }).join('');
    var body = rows.map(function (r) {
      return '<tr>' + cells(r).map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<table><thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  /* ===================== Code block + highlighting ===================== */
  function codeBlock(code, lang) {
    var highlighted = highlightCode(code, lang);
    var label = lang || 'text';
    return (
      '<div class="code-block">' +
        '<div class="code-block__bar">' +
          '<span class="code-block__lang">' + escapeHtml(label) + '</span>' +
        '</div>' +
        '<pre><button class="code-copy" type="button">Copy</button><code>' +
          highlighted + '</code></pre>' +
      '</div>'
    );
  }

  // Detect ASCII HLD/LLD art — lots of box-drawing chars → render as diagram
  function isDiagramCode(code, lang) {
    if (lang && /^(java|bash|sh|json|yaml|yml|xml|sql|js|javascript|ts|properties|kotlin|groovy|dockerfile|python|py)$/.test(lang)) return false;
    var boxChars = (code.match(/[─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬▶▼◀▲→←↑↓╌╎]/g) || []).length;
    return boxChars > 6;
  }

  function diagramBlock(code) {
    return (
      '<div class="diagram">' +
        '<div class="diagram__head"><span class="diagram__label">Diagram</span></div>' +
        '<pre class="diagram__art">' + escapeHtml(code) + '</pre>' +
      '</div>'
    );
  }

  // Basic syntax highlighter — keywords, types, strings, numbers, comments.
  // Operates on already-escaped text; protects strings/comments via tokens.
  var JAVA_KEYWORDS = ('abstract assert boolean break byte case catch char class const continue default do ' +
    'double else enum extends final finally float for goto if implements import instanceof int interface ' +
    'long native new package private protected public return short static strictfp super switch synchronized ' +
    'this throw throws transient try void volatile while var record sealed permits yield true false null').split(' ');

  var KW_SET = {};
  JAVA_KEYWORDS.forEach(function (k) { KW_SET[k] = true; });

  function highlightCode(code, lang) {
    var esc = escapeHtml(code);

    // language families that use //, /* */, # comments and "strings"
    var isCurly = !lang || /^(java|js|javascript|ts|typescript|kotlin|groovy|c|cpp|cs|go|rust|php)$/.test(lang);
    var isHash = /^(bash|sh|shell|yaml|yml|python|py|ruby|properties|dockerfile)$/.test(lang);
    var isSql = lang === 'sql';

    var store = [];
    function stash(cls, text) {
      var tok = '\u0001' + store.length + '\u0001';
      store.push('<span class="' + cls + '">' + text + '</span>');
      return tok;
    }

    // comments
    if (isCurly) {
      esc = esc.replace(/\/\*[\s\S]*?\*\//g, function (m) { return stash('tok-comment', m); });
      esc = esc.replace(/\/\/[^\n]*/g, function (m) { return stash('tok-comment', m); });
    }
    if (isHash || isSql) {
      if (isSql) esc = esc.replace(/--[^\n]*/g, function (m) { return stash('tok-comment', m); });
      esc = esc.replace(/#[^\n]*/g, function (m) { return stash('tok-comment', m); });
    }

    // strings (double, single, backtick)  — note: already HTML-escaped so quotes are literal
    esc = esc.replace(/"(?:\\.|[^"\\\n])*"/g, function (m) { return stash('tok-string', m); });
    esc = esc.replace(/'(?:\\.|[^'\\\n])*'/g, function (m) { return stash('tok-string', m); });

    // annotations @Foo
    esc = esc.replace(/@[A-Za-z_]\w*/g, function (m) { return stash('tok-type', m); });

    // numbers
    esc = esc.replace(/\b\d[\d_.]*[fFdDlL]?\b/g, function (m) { return stash('tok-number', m); });

    // identifiers → keywords / types / function calls
    esc = esc.replace(/\b[A-Za-z_]\w*\b(\s*\()?/g, function (m, paren) {
      var word = paren ? m.slice(0, m.length - paren.length).trim() : m;
      var tail = paren || '';
      if (KW_SET[word]) return stash('tok-keyword', word) + tail;
      if (tail) return stash('tok-fn', word) + tail;          // function call
      if (/^[A-Z]/.test(word)) return stash('tok-type', word); // Type-like
      return m;
    });

    // restore stashed tokens
    esc = esc.replace(/\u0001(\d+)\u0001/g, function (_, i) { return store[Number(i)]; });
    return esc;
  }

  function copyCode(btn) {
    var pre = btn.closest('pre');
    if (!pre) return;
    var codeEl = pre.querySelector('code');
    var text = codeEl ? codeEl.innerText : pre.innerText;
    var done = function () {
      var old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    if (cb) cb();
  }

  function renderDiagram(text, kind) {
    // The source may be a fenced block already — renderMarkdown handles that.
    // If it is raw ASCII without fences, wrap directly.
    if (/```/.test(text)) return renderMarkdown(text);
    return (
      '<div class="diagram">' +
        '<div class="diagram__head"><span class="diagram__label">' + (kind || 'Diagram') +
          '</span></div>' +
        '<pre class="diagram__art">' + escapeHtml(String(text)) + '</pre>' +
      '</div>'
    );
  }

  /* ============================ Sidebar nav ============================ */
  function renderChapterNav() {
    var html = state.chapters.map(function (c) {
      return (
        '<div class="nav-item" data-route="#/chapter/' + c.chapter + '" data-chapter="' + c.chapter + '">' +
          '<span class="nav-item__text">' + pad2(c.chapter) + '. ' + escapeHtml(c.chapterTitle) + '</span>' +
          '<span class="count">' + c.count + '</span>' +
        '</div>'
      );
    }).join('');
    el.chapterNav.innerHTML = html;

    bindDelegated(el.chapterNav, '[data-route]', function (node) {
      navigate(node.getAttribute('data-route'));
    });
    // also wire the static Home nav item
    bindDelegated(el.sidebar, '[data-route="#/home"]', function () { navigate('#/home'); });
  }

  function setActiveNav(type, chapterNum) {
    var items = el.sidebar.querySelectorAll('.nav-item');
    items.forEach(function (it) { it.classList.remove('is-active'); });
    if (type === 'home') {
      var home = el.sidebar.querySelector('[data-route="#/home"]');
      if (home) home.classList.add('is-active');
    } else if (type === 'chapter' && chapterNum != null) {
      var ch = el.sidebar.querySelector('[data-chapter="' + chapterNum + '"]');
      if (ch) ch.classList.add('is-active');
    }
  }

  /* ========================= Progress (localStorage) =================== */
  function loadReviewed() {
    try {
      var raw = localStorage.getItem(LS_REVIEWED);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) { return new Set(); }
  }
  function saveReviewed() {
    try { localStorage.setItem(LS_REVIEWED, JSON.stringify(Array.from(state.reviewed))); } catch (e) {}
  }
  function toggleReviewed(id, btn) {
    if (state.reviewed.has(id)) state.reviewed.delete(id);
    else state.reviewed.add(id);
    saveReviewed();
    var on = state.reviewed.has(id);
    if (btn) {
      btn.classList.toggle('is-reviewed', on);
      var icon = btn.querySelector('.clap-icon');
      var label = btn.querySelector('.clap-label');
      if (icon) icon.textContent = on ? '✓' : '👏';
      if (label) label.textContent = on ? 'Reviewed' : 'Mark as reviewed';
      var card = btn.closest('.qcard');
      if (card) card.classList.toggle('is-reviewed', on);
    }
  }
  function countReviewedInChapter(chapterNum) {
    var data = state.chapterCache[String(chapterNum)];
    if (!data || !data.answers) {
      // fall back to search index if loaded
      if (state.searchIndex) {
        var n = 0;
        state.searchIndex.forEach(function (it) {
          if (Number(it.chapter) === Number(chapterNum) && state.reviewed.has(it.id)) n++;
        });
        return n;
      }
      return 0;
    }
    var count = 0;
    data.answers.forEach(function (a) { if (state.reviewed.has(a.id)) count++; });
    return count;
  }

  /* ========================= Global events / UX ======================= */
  function wireGlobalEvents() {
    // search w/ debounce
    el.searchInput.addEventListener('input', debounce(function () {
      var q = el.searchInput.value.trim();
      if (q) navigate('#/search/' + encodeURIComponent(q));
      else navigate('#/home');
    }, 220));

    el.searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { el.searchInput.value = ''; el.searchInput.blur(); navigate('#/home'); }
    });

    // Ctrl/Cmd + K → focus search
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        el.searchInput.focus();
        el.searchInput.select();
      }
      if (e.key === '/' && document.activeElement !== el.searchInput) {
        e.preventDefault(); el.searchInput.focus();
      }
    });

    // mobile drawer
    el.menuToggle.addEventListener('click', toggleDrawer);
    el.backdrop.addEventListener('click', closeDrawer);

    // back to top
    el.scrollTop.addEventListener('click', function () { scrollToTop(false); });
    window.addEventListener('scroll', throttle(function () {
      el.scrollTop.classList.toggle('is-visible', window.scrollY > 500);
    }, 150));
  }

  function toggleDrawer() {
    var open = el.sidebar.classList.toggle('is-open');
    el.backdrop.hidden = false;
    el.backdrop.classList.toggle('is-visible', open);
    el.menuToggle.setAttribute('aria-expanded', String(open));
    if (!open) setTimeout(function () { el.backdrop.hidden = true; }, 200);
  }
  function closeDrawer() {
    el.sidebar.classList.remove('is-open');
    el.backdrop.classList.remove('is-visible');
    el.menuToggle.setAttribute('aria-expanded', 'false');
    setTimeout(function () { el.backdrop.hidden = true; }, 200);
  }

  function scrollToTop(instant) {
    window.scrollTo({ top: 0, behavior: instant ? 'auto' : 'smooth' });
  }

  /* ============================== Helpers ============================== */
  function showLoading(msg) {
    el.content.innerHTML = '<div class="loading"><div class="spinner" role="status"></div><span>' +
      escapeHtml(msg || 'Loading…') + '</span></div>';
  }
  function emptyState(icon, title, sub) {
    return '<div class="empty"><div class="empty__icon">' + icon + '</div>' +
      '<div class="empty__title">' + title + '</div>' +
      '<div>' + escapeHtml(sub || '') + '</div></div>';
  }
  function renderError(msg, err) {
    if (err && window.console) console.error(msg, err);
    el.content.innerHTML = emptyState('⚠️', escapeHtml(msg),
      (err && err.message ? err.message : 'If you opened this file directly, try serving it over http (e.g. python3 -m http.server).'));
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function highlight(text, query) {
    var safe = escapeHtml(text);
    var tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
      .map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    if (!tokens.length) return safe;
    var re = new RegExp('(' + tokens.join('|') + ')', 'ig');
    return safe.replace(re, '<mark>$1</mark>');
  }

  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  function bindDelegated(container, selector, handler) {
    container.addEventListener('click', function (e) {
      var node = e.target.closest(selector);
      if (node && container.contains(node)) handler(node, e);
    });
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }
  function throttle(fn, wait) {
    var last = 0, timer;
    return function () {
      var now = Date.now(), ctx = this, args = arguments;
      var remain = wait - (now - last);
      if (remain <= 0) { last = now; fn.apply(ctx, args); }
      else { clearTimeout(timer); timer = setTimeout(function () { last = Date.now(); fn.apply(ctx, args); }, remain); }
    };
  }
})();
