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
        formFamily: null
    };

    const pictureGen = new PictureGenerator({ callsign: 'TANGO' });
    const clusterer = new TrackClusterer(PICTURE_RULES.groupNm, 1);
    const grader = new PictureGrader(pictureGen, clusterer);

    const scope = new ScopeRenderer('tacScope');
    const anim = new AnimationEngine(scope);
    scope.setAnimationEngine(anim);

    const els = {
        category: document.getElementById('categorySelect'),
        variation: document.getElementById('variationSelect'),
        statusClock: document.getElementById('statusClock'),
        statusScenario: document.getElementById('statusScenario'),
        statusOrient: document.getElementById('statusOrient'),
        revealPanel: document.getElementById('revealPanel'),
        scorePanel: document.getElementById('scorePanel'),
        studentForm: document.getElementById('studentForm'),
        formFields: document.getElementById('formFields'),
        modeHint: document.getElementById('modeHint'),
        promptLine: document.getElementById('promptLine'),
        btnPause: document.getElementById('btnPause')
    };

    const MODE_HINTS = {
        picture: 'ALSSA picture — total groups, label and dimensions, anchor BULLSEYE, altitude, track. Leave fields blank when they do not apply.',
        packages: 'Packages — number of packages, azimuth separation, and the BULLSEYE of either package.',
        braa: 'Respond in BRAA format from the named fighter — not bullseye.',
        music: 'MUSIC — anchor the named group off BULLSEYE with altitude and track.',
        strobe: 'STROBE — range and altitude of the closest group along the fighter\'s strobe bearing (±30°).'
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
        rand.textContent = `Random (1–${VARIATIONS_PER_CATEGORY})`;
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
        const category = els.category.value;
        if (els.variation.value === 'random') {
            return pickRandomVariation(mulberry32(Date.now() & 0xffffffff), category);
        }
        const variation = parseInt(els.variation.value, 10);
        return { category, variation, seed: categorySeed(category, variation) };
    }

    function loadScenario(opts = {}) {
        const params = resolveLoadParams();
        state.category = params.category;
        state.variation = params.variation;
        state.seed = opts.newSeed === true ? (params.seed + Date.now()) % 2147483647 : params.seed;
        state.orientation = document.querySelector('input[name="orientation"]:checked')?.value || 'EW';

        const scenario = generateScenario({
            category: state.category,
            seed: state.seed,
            orientation: state.orientation
        });

        state.meta = scenario.meta;
        scope.tracks = scenario.tracks;
        scope.orientation = state.orientation;
        scope.selectedTrack = null;
        anim.reset(scope.tracks, scenario.motionScript);

        const answer = currentAnswer();
        buildForm(answer.answerKey ? answer.answerKey.family : 'picture');
        updateStatus();
        refreshLive();
        hideReveal();
        resetScore();
    }

    /** Truth moves with the tracks, so the answer is always computed from the scope as it is now. */
    function currentAnswer() {
        return grader.buildAnswer(scope.tracks, state.meta, state.orientation);
    }

    function buildForm(family) {
        state.formFamily = family;
        els.formFields.innerHTML = '';
        (ANSWER_FAMILIES[family] || []).forEach(id => {
            const def = FIELD_DEFS[id];
            const label = document.createElement('label');
            label.textContent = `${def.label} `;
            const input = document.createElement('input');
            input.name = id;
            input.autocomplete = 'off';
            if (def.placeholder) input.placeholder = def.placeholder;
            label.appendChild(input);
            els.formFields.appendChild(label);
        });
        els.modeHint.textContent = MODE_HINTS[family] || MODE_HINTS.picture;
    }

    function updateStatus() {
        const catLabel = SCENARIO_CATEGORIES.find(c => c.id === state.category)?.label || state.category;
        els.statusScenario.textContent = `${catLabel} · var ${state.variation} · seed ${state.seed}`;
        els.statusOrient.textContent = getOrientation(state.orientation).label;
    }

    /** Clock, pause state and the fighter's request (its bearings change as tracks move). */
    function refreshLive() {
        const t = Math.floor(anim.simTime);
        const clock = `T+${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        let suffix = '';
        if (anim.paused) suffix = anim.runComplete ? ' · RUN COMPLETE (frozen)' : ' · PAUSED';
        els.statusClock.textContent = clock + suffix;
        els.btnPause.textContent = anim.paused ? 'Resume' : 'Pause';
        els.btnPause.classList.toggle('active', anim.paused);

        const prompt = state.meta ? currentAnswer().prompt : null;
        els.promptLine.hidden = !prompt;
        if (prompt && els.promptLine.textContent !== prompt) els.promptLine.textContent = prompt;
    }

    function hideReveal() {
        els.revealPanel.innerHTML = '<p class="muted">Click Reveal Answer when ready to check.</p>';
    }

    function resetScore() {
        els.scorePanel.innerHTML = '<p class="muted">Submit your call to grade.</p>';
    }

    function showReveal() {
        const answer = currentAnswer();
        els.revealPanel.innerHTML = `<p class="call-text">${escapeHtml(answer.text)}</p>`
            + '<p class="muted">Answer is for the scope as it is right now — pause first if you are still measuring.</p>';
    }

    function submitGrade() {
        const answer = currentAnswer();
        if (!answer.answerKey) return;
        const student = Object.fromEntries(new FormData(els.studentForm).entries());
        const result = grader.gradeStudent(student, answer.answerKey);
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
        els.category.addEventListener('change', () => loadScenario());
        els.variation.addEventListener('change', () => loadScenario());

        document.querySelectorAll('input[name="orientation"]').forEach(r => {
            r.addEventListener('change', () => loadScenario());
        });

        els.btnPause.addEventListener('click', () => {
            anim.paused = !anim.paused;
            refreshLive();
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
        document.getElementById('chkCallsigns').addEventListener('change', (e) => {
            scope.showCallsigns = e.target.checked;
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
        els.studentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitGrade();
        });

        document.getElementById('btnClearForm').addEventListener('click', () => {
            els.studentForm.reset();
            hideReveal();
            resetScore();
        });
    }

    initCategoryPicker();
    bindControls();
    loadScenario();
    setInterval(refreshLive, 250);
})();
