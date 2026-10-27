/**
 * Flash-card deck UI: filter, shuffle, flip, mark got / missed.
 * Each card is drawn once as a still SVG (CardRender): nothing animates.
 */
(function () {
    const DECK = window.FLASHCARD_DECK;
    const MISSED_KEY = 'pictureFlashcards.missed';

    const TASKS = {
        picture: 'Call the picture.',
        packages: 'Call the picture.',
        braa: 'Answer the fighter in BRAA.',
        music: 'Answer the fighter\'s MUSIC call.',
        strobe: 'Answer the fighter\'s STROBE call.',
        maneuver: 'A group has maneuvered since the picture above was called. Make the call.'
    };
    const THREAT_TASK = 'Make the THREAT call to the closest fighter (BRAA).';

    const FIELD_LABELS = {
        groupCount: 'Groups',
        packageCount: 'Packages',
        waveCount: 'Waves',
        leadingEdgeCount: 'Leading edge groups',
        label: 'Label',
        width: 'Wide (nm)',
        depth: 'Deep (nm)',
        braa: 'BRAA',
        strobeRange: 'Strobe range (nm)',
        altitude: 'Altitude',
        track: 'Track',
        aspect: 'Aspect',
        groupName: 'Group',
        maneuver: 'Maneuver',
        direction: 'Direction'
    };

    const $ = id => document.getElementById(id);
    const els = {
        category: $('selCategory'),
        kind: $('selKind'),
        orient: $('selOrient'),
        order: $('selOrder'),
        missedOnly: $('chkMissed'),
        deckStatus: $('deckStatus'),
        meta: $('cardMeta'),
        count: $('cardCount'),
        progress: $('progressBar'),
        task: $('cardTask'),
        prompt: $('cardPrompt'),
        context: $('cardContext'),
        contextList: $('contextList'),
        scope: $('scope'),
        measure: $('btnMeasure'),
        flip: $('btnFlip'),
        got: $('btnGot'),
        miss: $('btnMiss'),
        answer: $('answer'),
        answerCall: $('answerCall'),
        breakdown: $('answerBreakdown'),
        tips: $('answerTips'),
        done: $('deckDone'),
        doneSummary: $('doneSummary')
    };

    const state = {
        cards: [],
        index: 0,
        flipped: false,
        view: 'scope',
        showGiven: loadPref('showMeasurements', true),
        measuring: false,
        measurePts: [],
        renderView: null,
        results: new Map(),   // card id -> 'got' | 'miss' for this pass
        missed: loadMissed()
    };

    const categoryLabel = id => (DECK.categories.find(c => c.id === id) || { label: id }).label;

    // Browser storage is a convenience only: the deck works the same without it.
    function loadMissed() {
        try {
            return new Set(JSON.parse(localStorage.getItem(MISSED_KEY) || '[]'));
        } catch (_) {
            return new Set();
        }
    }

    function loadPref(name, fallback) {
        try {
            const v = localStorage.getItem(`pictureFlashcards.${name}`);
            return v == null ? fallback : v === 'true';
        } catch (_) {
            return fallback;
        }
    }

    function savePref(name, value) {
        try {
            localStorage.setItem(`pictureFlashcards.${name}`, String(value));
        } catch (_) { /* private window or blocked storage */ }
    }

    function saveMissed() {
        try {
            localStorage.setItem(MISSED_KEY, JSON.stringify([...state.missed]));
        } catch (_) { /* private window or blocked storage */ }
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function initFilters() {
        const all = document.createElement('option');
        all.value = 'all';
        all.textContent = 'All categories';
        els.category.appendChild(all);
        DECK.categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.label;
            els.category.appendChild(opt);
        });
    }

    function filteredCards(missedOnly) {
        const cat = els.category.value;
        const kind = els.kind.value;
        const orient = els.orient.value;
        return DECK.cards.filter(c => (cat === 'all' || c.cat === cat)
            && (kind === 'all' || c.kind === kind)
            && (orient === 'all' || c.o === orient)
            && (!missedOnly || state.missed.has(c.id)));
    }

    function shuffle(list) {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function startDeck(opts = {}) {
        const missedOnly = opts.missedOnly != null ? opts.missedOnly : els.missedOnly.checked;
        let cards = opts.cards || filteredCards(missedOnly);
        if (els.order.value === 'shuffle') cards = shuffle(cards);
        state.cards = cards;
        state.index = 0;
        state.results = new Map();
        updateDeckStatus();
        if (!cards.length) {
            showEmpty(missedOnly);
            return;
        }
        showCard();
    }

    function updateDeckStatus() {
        const total = DECK.cards.length;
        const missed = state.missed.size;
        els.deckStatus.textContent = `${state.cards.length} cards in this deck · ${total} in all`
            + (missed ? ` · ${missed} on your missed list` : '');
    }

    function showEmpty(missedOnly) {
        els.done.hidden = true;
        els.answer.hidden = true;
        els.meta.textContent = '';
        els.count.textContent = '';
        els.task.textContent = missedOnly
            ? 'No missed cards match these filters. Clear "Missed cards only" to study everything.'
            : 'No cards match these filters.';
        els.prompt.hidden = true;
        els.context.hidden = true;
        els.scope.innerHTML = '';
        setActionsVisible(false);
    }

    function setActionsVisible(on) {
        document.querySelectorAll('#cardArea > .card-actions button, .scope-tools button').forEach(b => {
            b.disabled = !on;
        });
    }

    function current() {
        return state.cards[state.index];
    }

    function showCard() {
        const card = current();
        state.flipped = false;
        state.measurePts = [];
        els.done.hidden = true;
        setActionsVisible(true);

        const kindLabel = card.kind === 'maneuver' ? `Maneuver ${card.id.split('-m')[1]}` : 'Picture';
        els.meta.textContent = `${categoryLabel(card.cat)} #${card.v} · ${card.o === 'EW' ? 'E/W' : 'N/S'} · ${kindLabel}`;
        els.count.textContent = `Card ${state.index + 1} of ${state.cards.length}`;
        els.progress.style.width = `${(state.index / state.cards.length) * 100}%`;

        els.task.textContent = card.cat === 'threat' ? THREAT_TASK : (TASKS[card.key.family] || TASKS.picture);
        els.prompt.hidden = !card.prompt || card.cat === 'threat';
        els.prompt.textContent = card.prompt || '';
        els.context.hidden = !card.context;
        els.contextList.innerHTML = (card.context || []).map(c => `<li>${esc(c)}</li>`).join('');

        drawScope();
        renderAnswer(card);
        els.answer.hidden = true;
        els.flip.hidden = false;
        els.got.hidden = true;
        els.miss.hidden = true;
        $('btnPrev').disabled = state.index === 0;
    }

    function drawScope() {
        const card = current();
        if (!card) return;
        // Draw at the box's real width so tags stay readable on a phone instead of shrinking.
        const width = Math.max(340, Math.min(800, Math.round(els.scope.clientWidth || 800)));
        const out = CardRender.render(card, { view: state.view, measurements: state.showGiven, width, height: Math.round(width * (width < 600 ? 1 : 0.7)) });
        state.renderView = out.view;
        els.scope.innerHTML = out.svg;
        els.scope.classList.toggle('measuring', state.measuring);
        drawMeasure();
    }

    function drawMeasure() {
        const layer = els.scope.querySelector('.measure-layer');
        if (!layer) return;
        const v = state.renderView;
        const [a, b] = state.measurePts;
        layer.innerHTML = b ? CardRender.measureSvg(v, a, b) : (a ? CardRender.pointSvg(v, a) : '');
    }

    function sayCall(text) {
        // One sentence per line reads like the call is voiced.
        return text.replace(/\.\s+/g, '.\n').split('\n').map(s => `<span>${esc(s)}</span>`).join('');
    }

    function renderAnswer(card) {
        els.answerCall.innerHTML = sayCall(card.answer);
        const f = card.key.fields;
        const rows = [];
        const add = (label, value, wide) => rows.push(
            `<div${wide ? ' class="wide"' : ''}><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`);
        ['groupCount', 'packageCount', 'waveCount', 'leadingEdgeCount', 'label', 'width', 'depth'].forEach(k => {
            if (f[k] != null) add(FIELD_LABELS[k], f[k]);
        });
        if (f.braaBearing != null) add(FIELD_LABELS.braa, `${String(f.braaBearing).padStart(3, '0')}/${f.braaRange}`);
        if (f.strobeRange != null) add(FIELD_LABELS.strobeRange, f.strobeRange);
        if (f.altitude != null) add(FIELD_LABELS.altitude, `${f.altitude}k`);
        ['track', 'aspect', 'groupName', 'maneuver', 'direction'].forEach(k => {
            if (f[k] != null) add(FIELD_LABELS[k], f[k]);
        });
        // The key accepts any group as the anchor; list only the ones the call actually anchors.
        (card.key.anchors || []).filter(a => card.answer.includes(`${a.name} BULLSEYE`)).forEach(a => {
            add(card.key.family === 'maneuver' ? 'New group' : 'Anchor',
                `${a.name} BULLSEYE ${a.b}${a.a != null ? `, ${a.a}k` : ''}`, true);
        });
        els.breakdown.innerHTML = rows.join('');
        els.tips.innerHTML = (card.tips || []).map(t => `<li>${esc(t)}</li>`).join('');
    }

    function flip() {
        if (!current() || state.flipped) return;
        state.flipped = true;
        els.answer.hidden = false;
        els.flip.hidden = true;
        els.got.hidden = false;
        els.miss.hidden = false;
        els.got.focus();
    }

    function mark(result) {
        const card = current();
        if (!card || !state.flipped) return;
        state.results.set(card.id, result);
        if (result === 'miss') state.missed.add(card.id);
        else state.missed.delete(card.id);
        saveMissed();
        next();
    }

    function next() {
        if (!state.cards.length) return;
        if (state.index >= state.cards.length - 1) {
            finish();
            return;
        }
        state.index += 1;
        showCard();
        window.scrollTo(0, 0);
    }

    function prev() {
        if (state.index === 0) return;
        state.index -= 1;
        showCard();
    }

    function finish() {
        const got = [...state.results.values()].filter(r => r === 'got').length;
        const missed = [...state.results.values()].filter(r => r === 'miss').length;
        const skipped = state.cards.length - got - missed;
        els.progress.style.width = '100%';
        els.answer.hidden = true;
        els.done.hidden = false;
        els.flip.hidden = true;
        els.got.hidden = true;
        els.miss.hidden = true;
        els.doneSummary.textContent = `Got ${got} · missed ${missed}` + (skipped ? ` · skipped ${skipped}` : '')
            + ` of ${state.cards.length}.`;
        $('btnReviewMissed').disabled = missed === 0;
        updateDeckStatus();
    }

    function reviewMissed() {
        const ids = new Set([...state.results.entries()].filter(([, r]) => r === 'miss').map(([id]) => id));
        startDeck({ cards: DECK.cards.filter(c => ids.has(c.id)) });
    }

    function setView(view) {
        state.view = view;
        state.measurePts = [];
        document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        drawScope();
    }

    function toggleGiven() {
        state.showGiven = !state.showGiven;
        savePref('showMeasurements', state.showGiven);
        $('btnGiven').classList.toggle('active', state.showGiven);
        drawScope();
    }

    function toggleMeasure() {
        state.measuring = !state.measuring;
        state.measurePts = [];
        els.measure.classList.toggle('active', state.measuring);
        els.scope.classList.toggle('measuring', state.measuring);
        drawMeasure();
    }

    function onScopeClick(e) {
        if (!state.measuring) return;
        const svg = els.scope.querySelector('svg');
        const r = svg.getBoundingClientRect();
        const v = state.renderView;
        const x = (e.clientX - r.left) * (v.width / r.width);
        const y = (e.clientY - r.top) * (v.height / r.height);
        const pt = CardRender.toWorld(v, x, y);
        state.measurePts = state.measurePts.length === 1 ? [state.measurePts[0], pt] : [pt];
        drawMeasure();
    }

    /** PNG of what is on screen now (view and any measurement), for slides or handouts. */
    function saveImage() {
        const card = current();
        const svg = els.scope.querySelector('svg');
        if (!card || !svg) return;
        const v = state.renderView;
        const img = new Image();
        const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = v.width * 2;
            canvas.height = v.height * 2;
            const ctx = canvas.getContext('2d');
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, v.width, v.height);
            const name = `${card.id}${state.view === 'raid' ? '-raid' : ''}.png`;
            const done = blob => {
                const a = document.createElement('a');
                a.download = name;
                a.href = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png');
                document.body.appendChild(a);
                a.click();
                a.remove();
                if (blob) setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            };
            if (canvas.toBlob) canvas.toBlob(done, 'image/png');
            else done(null);
        };
        img.src = url;
    }

    function onKey(e) {
        if (e.target.closest('select, input, textarea') || e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key === ' ' || e.key === 'Enter') {
            if (e.target.tagName === 'BUTTON' && e.key === 'Enter') return;
            e.preventDefault();
            flip();
        } else if (e.key === '1') mark('got');
        else if (e.key === '2') mark('miss');
        else if (e.key === 'ArrowRight') next();
        else if (e.key === 'ArrowLeft') prev();
        else if (e.key === 'v' || e.key === 'V') setView(state.view === 'scope' ? 'raid' : 'scope');
        else if (e.key === 'm' || e.key === 'M') toggleGiven();
        else if (e.key === 'Escape' && state.measurePts.length) {
            state.measurePts = [];
            drawMeasure();
        }
    }

    function bind() {
        $('btnStart').addEventListener('click', () => startDeck());
        [els.category, els.kind, els.orient, els.order, els.missedOnly].forEach(el => el.addEventListener('change', () => startDeck()));
        els.flip.addEventListener('click', flip);
        els.got.addEventListener('click', () => mark('got'));
        els.miss.addEventListener('click', () => mark('miss'));
        $('btnNext').addEventListener('click', next);
        $('btnPrev').addEventListener('click', prev);
        $('btnReviewMissed').addEventListener('click', reviewMissed);
        $('btnRestart').addEventListener('click', () => startDeck());
        document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
        els.measure.addEventListener('click', toggleMeasure);
        $('btnGiven').addEventListener('click', toggleGiven);
        $('btnGiven').classList.toggle('active', state.showGiven);
        $('btnSave').addEventListener('click', saveImage);
        els.scope.addEventListener('click', onScopeClick);
        document.addEventListener('keydown', onKey);
        let lastWidth = els.scope.clientWidth;
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (els.scope.clientWidth === lastWidth) return;
                lastWidth = els.scope.clientWidth;
                state.measurePts = [];
                drawScope();
            }, 200);
        });
    }

    initFilters();
    bind();
    // The whole scope is too small to read on a phone; start zoomed on the raid there.
    if (els.scope.clientWidth < 600) setView('raid');
    startDeck();
})();
