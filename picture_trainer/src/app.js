/**
 * Picture Call Trainer — app wiring.
 */
(function () {
    const state = {
        category: 'wall',
        variation: 1,
        orientation: 'EW',
        seed: null,
        meta: null,
        bullsRef: { bearing: 0, range: 0 },
        answer: null,
        gradedMode: false
    };

    const pictureGen = new PictureGenerator({ callsign: 'TANGO' });
    const clusterer = new TrackClusterer(3, 1);
    const grader = new PictureGrader(pictureGen, clusterer);

    const scope = new ScopeRenderer('tacScope');
    const anim = new AnimationEngine(scope);
    scope.setAnimationEngine(anim);

    const els = {
        category: document.getElementById('categorySelect'),
        variation: document.getElementById('variationSelect'),
        statusBulls: document.getElementById('statusBulls'),
        statusScenario: document.getElementById('statusScenario'),
        statusOrient: document.getElementById('statusOrient'),
        revealPanel: document.getElementById('revealPanel'),
        scorePanel: document.getElementById('scorePanel'),
        studentForm: document.getElementById('studentForm'),
        pictureFields: document.getElementById('pictureFields'),
        braaFields: document.getElementById('braaFields'),
        eaFields: document.getElementById('eaFields'),
        modeHint: document.getElementById('modeHint')
    };

    function initCategoryPicker() {
        SCENARIO_CATEGORIES.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.label;
            els.category.appendChild(opt);
        });
        els.category.value = state.category;
        refreshVariationList();
    }

    function refreshVariationList() {
        els.variation.innerHTML = '';
        const rand = document.createElement('option');
        rand.value = 'random';
        rand.textContent = 'Random (1–15)';
        els.variation.appendChild(rand);
        for (let i = 1; i <= VARIATIONS_PER_CATEGORY; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = `Variation ${i}`;
            els.variation.appendChild(opt);
        }
        els.variation.value = String(state.variation);
    }

    function resolveLoadParams() {
        const cat = els.category.value;
        let variation = els.variation.value;
        let seed;
        if (variation === 'random') {
            const rng = mulberry32(Date.now() & 0xffffffff);
            const pick = pickRandomVariation(rng);
            seed = pick.seed;
            variation = pick.variation;
        } else {
            seed = categorySeed(cat, parseInt(variation, 10));
        }
        return { category: cat, variation: parseInt(variation, 10), seed };
    }

    function loadScenario(opts = {}) {
        const params = resolveLoadParams();
        state.category = params.category;
        state.variation = params.variation;
        state.seed = opts.newSeed ? (params.seed + Date.now()) % 2147483647 : params.seed;
        state.orientation = document.querySelector('input[name="orientation"]:checked')?.value || 'EW';

        const rng = mulberry32(state.seed);
        state.bullsRef = randomBullseye(rng);

        const scenario = generateScenario({
            category: state.category,
            seed: state.seed,
            orientation: state.orientation,
            bullsBearing: state.bullsRef.bearing,
            bullsRange: state.bullsRef.range
        });

        state.meta = scenario.meta;
        scope.tracks = scenario.tracks;
        scope.orientation = state.orientation;
        scope.selectedTrack = null;
        anim.reset(scope.tracks, scenario.motionScript);

        state.answer = grader.buildAnswer(scope.tracks, state.meta, state.orientation);

        updateStatus();
        updateFormMode();
        hideReveal();
        els.scorePanel.innerHTML = '<p class="muted">Submit your picture call to grade.</p>';
    }

    function updateStatus() {
        const catLabel = SCENARIO_CATEGORIES.find(c => c.id === state.category)?.label || state.category;
        els.statusBulls.textContent = `BULLSEYE (reference) ${state.bullsRef.bearing}/${state.bullsRef.range}`;
        els.statusScenario.textContent = `${catLabel} · var ${state.variation} · seed ${state.seed}`;
        els.statusOrient.textContent = getOrientation(state.orientation).label;
    }

    function setFieldsetEnabled(container, enabled) {
        container.querySelectorAll('input, select, textarea').forEach(el => {
            el.disabled = !enabled;
        });
    }

    function updateFormMode() {
        const mode = state.meta?.mode;
        const showPicture = !mode || mode === 'leading_edge' || mode === 'packages' || mode === 'cap';
        const showBraa = mode === 'threat' || mode === 'bogey_dope';
        const showEa = mode === 'ea';
        els.pictureFields.style.display = showPicture ? 'block' : 'none';
        els.braaFields.style.display = showBraa ? 'block' : 'none';
        els.eaFields.style.display = showEa ? 'block' : 'none';
        setFieldsetEnabled(els.pictureFields, showPicture);
        setFieldsetEnabled(els.braaFields, showBraa);
        setFieldsetEnabled(els.eaFields, showEa);

        if (mode === 'threat') {
            els.modeHint.textContent = 'Threat mode — respond with BRAA from nearest blue fighter, not bulls.';
        } else if (mode === 'bogey_dope') {
            els.modeHint.textContent = 'Bogey Dope drill — BRAA + track fill-in from blue fighter.';
        } else if (mode === 'ea') {
            els.modeHint.textContent = 'EA drill — identify MUSIC/STROBE/METALLICA and group bulls location.';
        } else if (mode === 'packages') {
            els.modeHint.textContent = 'Packages — two geographic packages; picture each sub-package.';
        } else if (mode === 'leading_edge') {
            els.modeHint.textContent = 'Leading Edge — total groups shown; call only the nearest subset.';
        } else {
            els.modeHint.textContent = 'ALSSA picture — word counts (THREE GROUPS), BULLSEYE location, TRACK fill-in, HOSTILE.';
        }
    }

    function hideReveal() {
        els.revealPanel.innerHTML = '<p class="muted">Click Reveal Answer when ready to check.</p>';
    }

    function showReveal() {
        if (!state.answer) return;
        els.revealPanel.innerHTML = `
            <p class="call-text">${escapeHtml(state.answer.text)}</p>
            <pre class="answer-key">${escapeHtml(JSON.stringify(state.answer.answerKey, null, 2))}</pre>
        `;
    }

    function readStudentForm() {
        const fd = new FormData(els.studentForm);
        const mode = state.meta?.mode;
        return {
            groupCount: fd.get('groupCount'),
            waveCount: fd.get('waveCount'),
            label: mode === 'ea' ? fd.get('eaLabel') : fd.get('label'),
            dimensions: fd.get('dimensions'),
            bullsBearing: fd.get('bullsBearing'),
            bullsRange: fd.get('bullsRange'),
            altitudeBlock: fd.get('altitudeBlock'),
            fillIns: fd.get('fillIns'),
            braaBearing: fd.get('braaBearing'),
            braaRange: fd.get('braaRange')
        };
    }

    function submitGrade() {
        if (!state.answer?.answerKey) return;
        const student = readStudentForm();
        const result = grader.gradeStudent(student, state.answer.answerKey);
        els.scorePanel.innerHTML = grader.formatGradeReport(result);
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function bindControls() {
        document.getElementById('btnLoad').addEventListener('click', () => loadScenario());
        document.getElementById('btnNewSeed').addEventListener('click', () => loadScenario({ newSeed: true }));
        els.category.addEventListener('change', () => {
            state.category = els.category.value;
            loadScenario();
        });
        els.variation.addEventListener('change', loadScenario);

        document.querySelectorAll('input[name="orientation"]').forEach(r => {
            r.addEventListener('change', loadScenario);
        });

        document.getElementById('btnMeasure').addEventListener('click', (e) => {
            scope.measureModeActive = !scope.measureModeActive;
            e.target.classList.toggle('active', scope.measureModeActive);
        });

        document.getElementById('chkTrail').addEventListener('change', (e) => {
            scope.showTrail = e.target.checked;
        });
        document.getElementById('chkPlots').addEventListener('change', (e) => {
            scope.showPlots = e.target.checked;
        });

        document.querySelectorAll('[data-speed]').forEach(btn => {
            btn.addEventListener('click', () => {
                const mult = parseFloat(btn.dataset.speed);
                anim.setSpeed(mult);
                document.querySelectorAll('[data-speed]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        document.getElementById('btnResetView').addEventListener('click', () => scope.resetView());
        document.getElementById('btnReveal').addEventListener('click', showReveal);
        document.getElementById('btnSubmit').addEventListener('click', (e) => {
            e.preventDefault();
            submitGrade();
        });

        document.getElementById('btnClearForm').addEventListener('click', () => {
            els.studentForm.reset();
            hideReveal();
            els.scorePanel.innerHTML = '<p class="muted">Submit your picture call to grade.</p>';
        });
    }

    initCategoryPicker();
    bindControls();
    loadScenario();
})();
