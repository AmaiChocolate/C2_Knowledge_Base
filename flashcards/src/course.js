/**
 * WD from Zero: course runner.
 *
 * Modules unlock in order. Each module's stages take support away step by step
 * (guided → build → solo); a stage is passed with PASS_SCORE of RUN_LENGTH in one run
 * (a stage may set its own `len` and `pass`, as the checkride does).
 * Every answer also feeds a Leitner schedule, so missed questions come back in
 * "Review due" sessions after 0, 1, 3, 7 and 14 days.
 *
 * Progress lives in this browser's storage when it is allowed; Export / Import moves it
 * between machines (NIPR profiles can be wiped).
 */
(function () {
    const COURSE = window.WD_COURSE;
    const STORE_KEY = 'wdFromZero.v1';
    const RUN_LENGTH = 10;
    const PASS_SCORE = 9;          // 85% of 10, rounded up
    const REVIEW_LENGTH = 15;
    const BOX_DAYS = [0, 1, 3, 7, 14];
    const DAY_MS = 24 * 3600 * 1000;

    const app = document.getElementById('app');
    const modules = COURSE.modules;
    const scenes = COURSE.scenes;
    const bank = {};
    COURSE.questions.forEach(q => {
        (bank[`${q.m}.${q.s}`] = bank[`${q.m}.${q.s}`] || []).push(q);
    });
    const byId = new Map(COURSE.questions.map(q => [q.id, q]));
    // The build stores a scene's call, earlier calls and request once; questions on it share them.
    COURSE.questions.forEach(q => {
        const sc = q.sc && scenes[q.sc];
        if (sc) ['call', 'ctx', 'req', 'info'].forEach(k => { if (q[k] === undefined && sc[k] !== undefined) q[k] = sc[k]; });
    });
    const runLength = s => s.len || RUN_LENGTH;
    const passScore = s => s.pass || PASS_SCORE;

    // ---------------------------------------------------------------- progress

    let storageOk = true;
    let progress = loadProgress();

    function emptyProgress() {
        return { v: 1, stages: {}, items: {}, unlockAll: false };
    }

    function loadProgress() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            return raw ? Object.assign(emptyProgress(), JSON.parse(raw)) : emptyProgress();
        } catch (_) {
            storageOk = false;
            return emptyProgress();
        }
    }

    function saveProgress() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(progress));
            storageOk = true;
        } catch (_) {
            storageOk = false;
        }
    }

    const stageKey = (m, s) => `${m.id}.${s.id}`;
    const stageRec = key => progress.stages[key] || {};
    const passed = (m, s) => !!stageRec(stageKey(m, s)).passed;
    const moduleDone = m => m.stages.every(s => passed(m, s));

    function stageOpen(mi, si) {
        if (progress.unlockAll) return true;
        if (si > 0) return passed(modules[mi], modules[mi].stages[si - 1]);
        return mi === 0 || moduleDone(modules[mi - 1]);
    }

    function openStageKeys() {
        const keys = [];
        modules.forEach((m, mi) => m.stages.forEach((s, si) => {
            if (stageOpen(mi, si)) keys.push(stageKey(m, s));
        }));
        return keys;
    }

    function dueItems() {
        const now = Date.now();
        const open = new Set(openStageKeys());
        return Object.keys(progress.items)
            .filter(id => byId.has(id) && open.has(`${byId.get(id).m}.${byId.get(id).s}`))
            .filter(id => progress.items[id].due <= now && progress.items[id].wrong > 0)
            .sort((a, b) => progress.items[a].due - progress.items[b].due);
    }

    /** Leitner: right moves a box up (longer gap), wrong goes back to box 1 (due now). */
    function record(q, ok) {
        const it = progress.items[q.id] || { box: 0, right: 0, wrong: 0, due: 0 };
        it.box = ok ? Math.min((it.box || 0) + 1, BOX_DAYS.length) : 1;
        it.due = Date.now() + BOX_DAYS[it.box - 1] * DAY_MS;
        if (ok) it.right += 1;
        else it.wrong += 1;
        it.seen = Date.now();
        progress.items[q.id] = it;
        saveProgress();
    }

    // ----------------------------------------------------------------- helpers

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function shuffle(list) {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    const pad3 = n => String(Math.round(n)).padStart(3, '0');
    const angleDiff = (a, b) => {
        const d = Math.abs(((a - b) % 360 + 360) % 360);
        return d > 180 ? 360 - d : d;
    };

    /** A call voiced one sentence per line. */
    function callHtml(text) {
        return `<div class="call-text answer-call">${text.replace(/\.\s+/g, '.\n').split('\n').map(s => `<span>${esc(s)}</span>`).join('')}</div>`;
    }

    // ------------------------------------------------------------------- home

    function renderHome() {
        state = { name: 'home' };
        const due = dueItems().length;
        const html = [];
        html.push(`<section class="panel review-banner">
            <strong>Instructor review needed.</strong> Lessons and module 1 are paraphrased from
            <code>${esc(COURSE.reviewSource)}</code>, which is marked "needs your re-review". Scope questions come from the
            Picture Trainer's answer engine. Module 8 grades commit, targeting and THREAT timing with the BC3 Scope Trainer's
            training defaults, not your unit's criteria. Check the content against the ALSSA publication before relying on it.
        </section>`);
        if (!storageOk) {
            html.push('<section class="panel warn">This browser is not saving progress. Use <b>Export progress</b> before you close the page.</section>');
        }
        html.push(`<section class="panel review-row">
            <div><h2>Review due</h2><p class="muted">${due ? `${due} question${due > 1 ? 's' : ''} you missed are due again.` : 'Nothing due. Missed questions come back here after 0, 1, 3, 7 and 14 days.'}</p></div>
            <button type="button" class="primary" data-act="review" ${due ? '' : 'disabled'}>Review ${due ? `(${Math.min(due, REVIEW_LENGTH)})` : ''}</button>
        </section>`);

        modules.forEach((m, mi) => {
            const open = stageOpen(mi, 0);
            const done = moduleDone(m);
            html.push(`<section class="panel module ${open ? '' : 'locked'} ${done ? 'done' : ''}">
                <div class="module-head">
                    <span class="module-num">${mi}</span>
                    <div>
                        <h2>${esc(m.title)} ${done ? '<span class="badge good">Complete</span>' : ''}</h2>
                        <p class="muted">${esc(m.goal)}</p>
                    </div>
                </div>
                <div class="stage-row">
                    <button type="button" data-act="lesson" data-m="${mi}" ${open ? '' : 'disabled'}>Lesson</button>
                    ${m.stages.map((s, si) => {
                        const rec = stageRec(stageKey(m, s));
                        const can = stageOpen(mi, si);
                        const tag = rec.passed ? `✓ ${rec.best}/${runLength(s)}` : rec.best != null ? `best ${rec.best}/${runLength(s)}` : can ? 'open' : 'locked';
                        return `<button type="button" class="stage ${rec.passed ? 'passed' : ''}" data-act="stage" data-m="${mi}" data-s="${si}" ${can ? '' : 'disabled'} title="${esc(s.blurb)}">
                            <span>${si + 1}. ${esc(s.title)}</span><small>${tag}</small></button>`;
                    }).join('')}
                </div>
            </section>`);
        });
        if (COURSE.upcoming.length) {
            html.push(`<section class="panel upcoming"><h2>Coming next</h2><ol start="${modules.length}">
                ${COURSE.upcoming.map(u => `<li>${esc(u.title)}</li>`).join('')}</ol></section>`);
        }
        html.push(`<section class="panel tools">
            <label class="toggle"><input type="checkbox" data-act="unlock" ${progress.unlockAll ? 'checked' : ''}> Unlock every stage (instructors, or to test out)</label>
            <div class="btn-row">
                <button type="button" data-act="export">Export progress</button>
                <button type="button" data-act="import">Import progress</button>
                <button type="button" data-act="reset">Reset progress</button>
            </div>
            <p class="muted">A stage is passed at ${PASS_SCORE} of ${RUN_LENGTH} in one run (85%; the checkride is 17 of 20). Passing a module's last stage opens the next module.</p>
            <div id="transfer"></div>
        </section>`);
        app.innerHTML = html.join('');
        window.scrollTo(0, 0);
    }

    // ----------------------------------------------------------------- lesson

    function renderLesson(mi) {
        const m = modules[mi];
        state = { name: 'lesson', mi };
        const blocks = m.lesson.map(b => {
            if (b.h) return `<h3>${esc(b.h)}</h3>`;
            if (b.p) return `<p>${esc(b.p)}</p>`;
            if (b.ul) return `<ul>${b.ul.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
            if (b.call) return `<pre class="call-text lesson-call">${esc(b.call)}</pre>`;
            if (b.note) return `<p class="note">${esc(b.note)}</p>`;
            return '';
        }).join('');
        const next = m.stages.findIndex((s, si) => stageOpen(mi, si) && !passed(m, s));
        const si = next >= 0 ? next : 0;
        app.innerHTML = `<section class="panel lesson">
            <p class="crumb"><a href="#" data-act="home">Course</a> › Module ${mi}</p>
            <h2>${esc(m.title)}</h2>
            <p class="goal">${esc(m.goal)}</p>
            ${blocks}
            <div class="btn-row">
                <button type="button" class="primary" data-act="stage" data-m="${mi}" data-s="${si}">Start: ${esc(m.stages[si].title)}</button>
                <button type="button" data-act="home">Back to course</button>
            </div>
        </section>`;
        window.scrollTo(0, 0);
    }

    // -------------------------------------------------------------------- run

    let state = { name: 'home' };

    /** Missed-and-due first, then never seen, then least recently seen. */
    function pickQuestions(pool, n) {
        const now = Date.now();
        const rank = q => {
            const it = progress.items[q.id];
            if (it && it.wrong && it.due <= now && it.box <= 1) return 0;
            if (!it) return 1;
            return 2;
        };
        const sorted = shuffle(pool).sort((a, b) => rank(a) - rank(b)
            || ((progress.items[a.id] || {}).seen || 0) - ((progress.items[b.id] || {}).seen || 0));
        return shuffle(sorted.slice(0, n));
    }

    function startStage(mi, si) {
        const m = modules[mi];
        const s = m.stages[si];
        const pool = bank[stageKey(m, s)] || [];
        startRun({ kind: 'stage', mi, si, title: `Module ${mi} · ${m.title}: ${s.title}`, questions: pickQuestions(pool, runLength(s)) });
    }

    function startReview() {
        const qs = dueItems().slice(0, REVIEW_LENGTH).map(id => byId.get(id));
        startRun({ kind: 'review', title: 'Review due', questions: shuffle(qs) });
    }

    function startRun(run) {
        state = Object.assign({ name: 'run', index: 0, results: [], view: 'scope', given: true, measuring: false, pts: [] }, run);
        renderQuestion();
    }

    function current() {
        return state.questions[state.index];
    }

    function renderQuestion() {
        const q = current();
        state.answered = false;
        state.view = q.view || 'scope';
        state.given = !q.noMs;
        state.measuring = false;
        state.pts = [];
        state.order = [];
        const score = state.results.filter(Boolean).length;
        const scene = q.sc ? scenes[q.sc] : null;
        app.innerHTML = `<section class="panel run" data-qid="${esc(q.id)}">
            <div class="run-head">
                <span class="crumb"><a href="#" data-act="quit">Quit</a> · ${esc(state.title)}</span>
                <span>Question ${state.index + 1} of ${state.questions.length} · ${score} right</span>
            </div>
            <div class="progress"><div style="width:${(state.index / state.questions.length) * 100}%"></div></div>
            ${q.info ? `<p class="info">${esc(q.info)}</p>` : ''}
            ${q.req ? `<p class="call-text prompt">"${esc(q.req)}"</p>` : ''}
            ${q.ctx ? `<details class="context" open><summary>Already called</summary><ol>${q.ctx.map(c => `<li>${esc(c)}</li>`).join('')}</ol></details>` : ''}
            <p class="card-task">${esc(q.prompt)}</p>
            ${scene ? scopeTools(scene) : ''}
            <div id="answerArea">${answerWidget(q)}</div>
            <div id="feedback"></div>
        </section>`;
        if (scene) drawScope();
        const first = app.querySelector('#answerArea input, #answerArea select');
        if (first && window.innerWidth > 700) first.focus();
        window.scrollTo(0, 0);
    }

    function scopeTools(scene) {
        return `<div class="scope-tools">
            <div class="seg" role="group" aria-label="View">
                <button type="button" data-act="view" data-v="scope">Full scope</button>
                <button type="button" data-act="view" data-v="raid">Raid close-up</button>
            </div>
            ${scene.ms ? '<button type="button" data-act="given">Measurements</button>' : ''}
            <button type="button" data-act="measure" title="Click two points to read bearing / range">Measure tool</button>
        </div>
        <div id="scope" class="scope"></div>`;
    }

    function drawScope() {
        const q = current();
        const el = document.getElementById('scope');
        if (!el) return;
        const width = Math.max(340, Math.min(800, Math.round(el.clientWidth || 800)));
        const out = CardRender.render(scenes[q.sc], { view: state.view, measurements: state.given, width, height: Math.round(width * (width < 600 ? 1 : 0.62)) });
        state.renderView = out.view;
        el.innerHTML = out.svg;
        el.classList.toggle('measuring', state.measuring);
        app.querySelectorAll('[data-act="view"]').forEach(b => b.classList.toggle('active', b.dataset.v === state.view));
        const g = app.querySelector('[data-act="given"]');
        if (g) g.classList.toggle('active', state.given);
        app.querySelector('[data-act="measure"]').classList.toggle('active', state.measuring);
        drawMeasure();
    }

    function drawMeasure() {
        const layer = document.querySelector('#scope .measure-layer');
        if (!layer) return;
        const [a, b] = state.pts;
        layer.innerHTML = b ? CardRender.measureSvg(state.renderView, a, b) : (a ? CardRender.pointSvg(state.renderView, a) : '');
    }

    function onScopeClick(e) {
        if (!state.measuring) return;
        const svg = document.querySelector('#scope svg');
        const r = svg.getBoundingClientRect();
        const v = state.renderView;
        const pt = CardRender.toWorld(v, (e.clientX - r.left) * (v.width / r.width), (e.clientY - r.top) * (v.height / r.height));
        state.pts = state.pts.length === 1 ? [state.pts[0], pt] : [pt];
        drawMeasure();
    }

    // ---------------------------------------------------------- answer widgets

    function answerWidget(q) {
        if (q.t === 'choice') {
            return `<div class="choices ${q.long ? 'long' : ''}">${q.choices.map((c, i) => `<button type="button" class="choice" data-act="choose" data-i="${i}">
                <kbd>${i + 1}</kbd> <span>${esc(c)}</span></button>`).join('')}</div>`;
        }
        if (q.t === 'error') {
            return `<div class="chips">${q.parts.map((p, i) => `<button type="button" class="chip" data-act="choose" data-i="${i}">${esc(p)}</button>`).join('')}</div>`;
        }
        if (q.t === 'order') {
            state.pool = shuffledOrder(q.parts.length);
            return orderWidget(q);
        }
        if (q.t === 'fields') {
            return `<form class="fields" data-act="fields">${q.fields.map(fieldInput).join('')}
                <div class="btn-row"><button type="submit" class="primary">Check</button></div></form>`;
        }
        if (q.t === 'call') {
            return `<label class="call-input">Say it out loud or type it (optional)
                <textarea rows="3" placeholder="WARRIOR, …"></textarea></label>
                <div class="btn-row"><button type="button" class="primary" data-act="reveal">Show the answer</button></div>`;
        }
        return '';
    }

    /** A shuffle that is never already in order. */
    function shuffledOrder(n) {
        const idx = [...Array(n).keys()];
        let s = shuffle(idx);
        for (let tries = 0; tries < 5 && s.every((v, i) => v === i); tries++) s = shuffle(idx);
        return s;
    }

    function orderWidget(q) {
        const placed = new Set(state.order);
        return `<p class="muted">Tap the pieces in the order they are said. Tap a placed piece to take it back.</p>
            <div class="order-line">${state.order.length ? state.order.map((i, k) => `<button type="button" class="chip placed" data-act="unplace" data-k="${k}">${esc(q.parts[i])}</button>`).join('') : '<span class="muted">…</span>'}</div>
            <div class="chips">${state.pool.filter(i => !placed.has(i)).map(i => `<button type="button" class="chip" data-act="place" data-i="${i}">${esc(q.parts[i])}</button>`).join('')}</div>
            <div class="btn-row"><button type="button" class="primary" data-act="checkOrder" ${state.order.length === q.parts.length ? '' : 'disabled'}>Check</button></div>`;
    }

    function fieldInput(f) {
        const id = `f-${f.k}`;
        if (f.kind === 'select') {
            return `<label>${esc(f.label)}<select id="${id}" name="${f.k}"><option value="">-</option>${f.options.map(o => `<option>${esc(o)}</option>`).join('')}</select></label>`;
        }
        if (f.kind === 'anchor') {
            return `<fieldset class="anchor"><legend>${esc(f.label)}</legend>
                <label>Bearing<input name="${f.k}.b" inputmode="numeric" autocomplete="off" placeholder="270"></label>
                <label>Range (nm)<input name="${f.k}.r" inputmode="numeric" autocomplete="off" placeholder="80"></label>
                <label>Altitude (k ft)<input name="${f.k}.a" inputmode="numeric" autocomplete="off" placeholder="30"></label></fieldset>`;
        }
        const ph = f.v === null || /blank/.test(f.label) ? 'blank if not voiced' : '';
        return `<label>${esc(f.label)}${f.hint ? ` <small class="muted">(${esc(f.hint)})</small>` : ''}<input id="${id}" name="${f.k}" inputmode="numeric" autocomplete="off" placeholder="${ph}"></label>`;
    }

    // ---------------------------------------------------------------- grading

    function parseNum(s) {
        const m = String(s || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
        return m ? parseFloat(m[0]) : NaN;
    }

    const parseAlt = s => {
        const n = parseNum(s);
        return n >= 1000 ? n / 1000 : n;
    };

    function gradeFields(q, form) {
        const data = new FormData(form);
        return q.fields.map(f => {
            if (f.kind === 'select') {
                const got = data.get(f.k) || '';
                return { label: f.label, ok: got === f.v, expect: f.v, got: got || '-' };
            }
            if (f.kind === 'anchor') {
                const b = parseNum(data.get(`${f.k}.b`));
                const r = parseNum(data.get(`${f.k}.r`));
                const a = parseAlt(data.get(`${f.k}.a`));
                const hit = f.anchors.find(x => angleDiff(b, x.b) <= f.tolB && Math.abs(r - x.r) <= (x.cap ? f.tolCapR : f.tolR) && Math.abs(a - x.a) <= f.tolA);
                const show = x => `${x.name} ${pad3(x.b)}/${x.r}, ${x.a}k`;
                return {
                    label: f.label, ok: !!hit,
                    expect: f.anchors.length > 1 ? `any of: ${f.anchors.map(show).join(' · ')}` : show(f.anchors[0]),
                    got: [b, r, a].some(Number.isNaN) ? 'incomplete' : `${pad3(b)}/${r}, ${a}k`,
                    tol: `±${f.tolB}° / ±${f.tolR} nm / ±${f.tolA}k`
                };
            }
            const raw = (data.get(f.k) || '').trim();
            if (f.v === null) return { label: f.label, ok: raw === '', expect: 'blank (not voiced)', got: raw || 'blank' };
            const n = f.k === 'alt' ? parseAlt(raw) : parseNum(raw);
            const ok = f.kind === 'bearing' ? angleDiff(n, f.v) <= f.tol : Math.abs(n - f.v) <= f.tol;
            return {
                label: f.label, ok: !Number.isNaN(n) && ok,
                expect: f.kind === 'bearing' ? pad3(f.v) : String(f.v),
                got: raw || '-', tol: f.tol ? `±${f.tol}` : ''
            };
        });
    }

    function finishQuestion(ok, detailHtml) {
        const q = current();
        if (state.answered) return;
        state.answered = true;
        state.results.push(ok);
        record(q, ok);
        app.querySelectorAll('#answerArea button, #answerArea input, #answerArea select, #answerArea textarea').forEach(el => { el.disabled = true; });
        const last = state.index >= state.questions.length - 1;
        document.getElementById('feedback').innerHTML = `<div class="feedback ${ok ? 'ok' : 'bad'}">
            <h3>${ok ? '✓ Correct' : '✗ Not quite'}</h3>
            ${detailHtml || ''}
            ${q.why ? `<p>${esc(q.why)}</p>` : ''}
            ${q.call ? `<p class="muted">The full call:</p>${callHtml(q.call)}` : ''}
            ${q.src ? `<p class="muted small">Source: ${esc(q.src)}</p>` : ''}
            <div class="btn-row"><button type="button" class="primary" data-act="next">${last ? 'Finish' : 'Next'} <kbd>Enter</kbd></button></div>
        </div>`;
        const nextBtn = app.querySelector('[data-act="next"]');
        if (nextBtn) nextBtn.focus({ preventScroll: true });
        document.getElementById('feedback').scrollIntoView({ block: 'nearest' });
    }

    function onChoose(i) {
        const q = current();
        if (state.answered) return;
        const ok = i === q.a;
        const buttons = app.querySelectorAll('[data-act="choose"]');
        buttons.forEach((b, k) => {
            if (k === q.a) b.classList.add('right');
            else if (k === i) b.classList.add('wrong');
        });
        const detail = q.t === 'error' ? `<p>The wrong part: <b>${esc(q.parts[q.a])}</b></p>` : ok ? '' : `<p>Answer: <b>${esc(q.choices[q.a])}</b></p>`;
        finishQuestion(ok, q.long ? '' : detail);
    }

    function onCheckOrder() {
        const q = current();
        const ok = state.order.every((v, i) => v === i);
        finishQuestion(ok, ok ? '' : `<p>In order:</p><ol class="small">${q.parts.map(p => `<li>${esc(p)}</li>`).join('')}</ol>`);
    }

    function onFields(form) {
        const q = current();
        const res = gradeFields(q, form);
        const ok = res.every(r => r.ok);
        const rows = res.map(r => `<tr class="${r.ok ? 'ok' : 'bad'}"><td>${r.ok ? '✓' : '✗'}</td><td>${esc(r.label)}</td><td>${esc(r.got)}</td><td>${esc(r.expect)}${r.tol ? ` <small class="muted">${esc(r.tol)}</small>` : ''}</td></tr>`).join('');
        finishQuestion(ok, `<table class="grade"><thead><tr><th></th><th>Field</th><th>You</th><th>Answer</th></tr></thead><tbody>${rows}</tbody></table>`);
    }

    /** Solo calls are self-marked against the answer. */
    function onReveal() {
        const q = current();
        const typed = (app.querySelector('#answerArea textarea') || {}).value || '';
        app.querySelector('#answerArea').innerHTML = `${typed.trim() ? `<p class="muted">You said:</p><div class="call-text answer-call mine">${esc(typed)}</div>` : ''}
            <p class="muted">The call:</p>${callHtml(q.call)}
            <p>Did you get every piece: groups, label, dimensions, BULLSEYE / BRAA, altitude, track, declaration, fill-ins?</p>
            <div class="btn-row"><button type="button" class="good" data-act="self" data-ok="1">Got it all <kbd>1</kbd></button>
            <button type="button" class="bad" data-act="self" data-ok="0">Missed something <kbd>2</kbd></button></div>`;
        state.revealed = true;
    }

    function onSelf(ok) {
        const q = current();
        state.revealed = false;
        const call = q.call;
        q.call = null;           // already on screen
        finishQuestion(ok, '');
        q.call = call;
    }

    function next() {
        if (state.index >= state.questions.length - 1) return renderResult();
        state.index += 1;
        renderQuestion();
    }

    function renderResult() {
        const right = state.results.filter(Boolean).length;
        const total = state.questions.length;
        let headline = `${right} of ${total}`;
        let nextBtn = '';
        if (state.kind === 'stage') {
            const m = modules[state.mi];
            const s = m.stages[state.si];
            const key = stageKey(m, s);
            const rec = Object.assign({ runs: 0 }, progress.stages[key]);
            rec.runs += 1;
            rec.best = Math.max(rec.best || 0, right);
            const pass = right >= passScore(s) && total >= runLength(s);
            if (pass) rec.passed = true;
            progress.stages[key] = rec;
            saveProgress();
            headline += pass ? ': stage passed' : `. ${passScore(s)} needed to pass.`;
            const ns = state.si + 1 < m.stages.length ? [state.mi, state.si + 1] : state.mi + 1 < modules.length ? [state.mi + 1, 0] : null;
            if (pass && ns) {
                nextBtn = ns[1] === 0
                    ? `<button type="button" class="primary" data-act="lesson" data-m="${ns[0]}">Next module: ${esc(modules[ns[0]].title)}</button>`
                    : `<button type="button" class="primary" data-act="stage" data-m="${ns[0]}" data-s="${ns[1]}">Next: ${esc(modules[ns[0]].stages[ns[1]].title)}</button>`;
            }
            if (!pass) nextBtn = `<button type="button" class="primary" data-act="stage" data-m="${state.mi}" data-s="${state.si}">Try the stage again</button>`;
        }
        const missed = state.questions.filter((q, i) => !state.results[i]);
        app.innerHTML = `<section class="panel result">
            <h2>${esc(state.title)}</h2>
            <p class="score">${headline}</p>
            ${missed.length ? `<h3>Missed (these come back in Review due)</h3><ul class="missed">${missed.map(q => `<li><b>${esc(q.prompt)}</b>${q.why ? `<br><span class="muted">${esc(q.why)}</span>` : ''}</li>`).join('')}</ul>` : '<p>Clean run.</p>'}
            <div class="btn-row">${nextBtn}<button type="button" data-act="home">Back to course</button></div>
        </section>`;
        window.scrollTo(0, 0);
    }

    // --------------------------------------------------------- export / import

    function encode(obj) {
        return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    }

    function decode(text) {
        return JSON.parse(decodeURIComponent(escape(atob(text.trim()))));
    }

    function showTransfer(mode) {
        const box = document.getElementById('transfer');
        if (mode === 'export') {
            box.innerHTML = `<p>Copy this code and keep it (email it to yourself, or save it in a text file). Import it on any machine to carry on.</p>
                <textarea readonly rows="4">${esc(encode(progress))}</textarea>`;
            box.querySelector('textarea').select();
        } else {
            box.innerHTML = `<p>Paste a progress code. It replaces the progress in this browser.</p>
                <textarea rows="4" id="importCode"></textarea>
                <div class="btn-row"><button type="button" class="primary" data-act="doImport">Import</button></div>`;
        }
    }

    function doImport() {
        try {
            const data = decode(document.getElementById('importCode').value);
            if (!data || typeof data.stages !== 'object' || typeof data.items !== 'object') throw new Error('not a progress code');
            progress = Object.assign(emptyProgress(), data);
            saveProgress();
            renderHome();
        } catch (e) {
            document.getElementById('transfer').insertAdjacentHTML('beforeend', '<p class="warn">That code could not be read. Copy the whole code and try again.</p>');
        }
    }

    // ----------------------------------------------------------------- events

    app.addEventListener('click', e => {
        if (e.target.closest('#scope')) {
            onScopeClick(e);
            return;
        }
        const el = e.target.closest('[data-act]');
        if (!el || el.disabled) return;
        const act = el.dataset.act;
        if (el.tagName === 'A') e.preventDefault();
        if (act === 'home' || act === 'quit') renderHome();
        else if (act === 'lesson') renderLesson(+el.dataset.m);
        else if (act === 'stage') startStage(+el.dataset.m, +el.dataset.s);
        else if (act === 'review') startReview();
        else if (act === 'choose') onChoose(+el.dataset.i);
        else if (act === 'place') {
            state.order.push(+el.dataset.i);
            document.getElementById('answerArea').innerHTML = orderWidget(current());
        } else if (act === 'unplace') {
            state.order.splice(+el.dataset.k, 1);
            document.getElementById('answerArea').innerHTML = orderWidget(current());
        } else if (act === 'checkOrder') onCheckOrder();
        else if (act === 'reveal') onReveal();
        else if (act === 'self') onSelf(el.dataset.ok === '1');
        else if (act === 'next') next();
        else if (act === 'view') {
            state.view = el.dataset.v;
            state.pts = [];
            drawScope();
        } else if (act === 'given') {
            state.given = !state.given;
            drawScope();
        } else if (act === 'measure') {
            state.measuring = !state.measuring;
            state.pts = [];
            drawScope();
        } else if (act === 'export' || act === 'import') showTransfer(act);
        else if (act === 'doImport') doImport();
        else if (act === 'reset') {
            if (window.confirm('Erase all course progress in this browser?')) {
                progress = emptyProgress();
                saveProgress();
                renderHome();
            }
        }
    });

    app.addEventListener('change', e => {
        if (e.target.dataset.act === 'unlock') {
            progress.unlockAll = e.target.checked;
            saveProgress();
            renderHome();
        }
    });

    app.addEventListener('submit', e => {
        e.preventDefault();
        if (e.target.dataset.act === 'fields' && !state.answered) onFields(e.target);
    });

    document.addEventListener('keydown', e => {
        if (state.name !== 'run' || e.altKey || e.ctrlKey || e.metaKey) return;
        // A focused button already acts on Enter / Space by itself.
        if ((e.key === 'Enter' || e.key === ' ') && e.target.tagName === 'BUTTON') return;
        const typing = e.target.closest('input, textarea, select');
        const q = current();
        if (state.answered && (e.key === 'Enter' || (e.key === ' ' && !typing))) {
            e.preventDefault();
            next();
        } else if (!state.answered && !typing && q.t === 'choice' && /^[1-9]$/.test(e.key) && +e.key <= q.choices.length) {
            onChoose(+e.key - 1);
        } else if (!state.answered && !typing && state.revealed && (e.key === '1' || e.key === '2')) {
            onSelf(e.key === '1');
        } else if (!typing && (e.key === 'v' || e.key === 'V') && q.sc) {
            state.view = state.view === 'scope' ? 'raid' : 'scope';
            drawScope();
        }
    });

    let lastWidth = 0;
    window.addEventListener('resize', () => {
        const el = document.getElementById('scope');
        if (!el || el.clientWidth === lastWidth) return;
        lastWidth = el.clientWidth;
        drawScope();
    });

    renderHome();
})();
