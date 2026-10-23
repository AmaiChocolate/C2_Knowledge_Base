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
    const maneuvers = new ManeuverDirector();
    anim.maneuvers = maneuvers;

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
        btnPause: document.getElementById('btnPause'),
        chkManeuvers: document.getElementById('chkManeuvers')
    };

    const MODE_HINTS = {
        picture: 'ALSSA picture — total groups, label and dimensions, anchor BULLSEYE, altitude, track. Leave fields blank when they do not apply.',
        packages: 'Packages — number of packages, azimuth separation, and the BULLSEYE of either package.',
        braa: 'Respond in BRAA format from the named fighter — not bullseye.',
        music: 'MUSIC — anchor the named group off BULLSEYE with altitude and track.',
        strobe: 'STROBE — range and altitude of the closest group along the fighter\'s strobe bearing (±30°).',
        maneuver: 'Maneuver — the picture is called, so do not re-label it. Name the group as you called it, then HOT / FLANK / BEAM / DRAG and the cardinal it is now tracking. For a SPLIT, give the BULLSEYE of either new group.'
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
        maneuvers.reset(state.meta, els.chkManeuvers.checked);

        const answer = currentAnswer();
        buildForm(answer.answerKey ? answer.answerKey.family : 'picture');
        updateStatus();
        refreshLive();
        hideReveal();
        resetScore();
    }

    /** Truth moves with the tracks, so the answer is always computed from the scope as it is now. */
    function currentAnswer() {
        if (maneuvers.phase !== 'picture') return grader.buildManeuverAnswer(scope.tracks, maneuvers);
        return grader.buildAnswer(scope.tracks, state.meta, state.orientation);
    }

    /**
     * The picture has been called (submitted or revealed): lock its group names and
     * move on to maneuvers. A run frozen at the stop line resumes so they can happen.
     */
    function commitPicture(answer) {
        if (!maneuvers.commit(answer, anim.simTime)) return;
        anim.resumeRun();
        els.studentForm.reset();
        buildForm('maneuver');
    }

    /** One maneuver has been called: grade or reveal it, then wait for the next. */
    function maneuverCalled() {
        maneuvers.markCalled(anim.simTime, scope.tracks);
        els.studentForm.reset();
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

        const prompt = state.meta ? (maneuverStatus() || currentAnswer().prompt) : null;
        els.promptLine.hidden = !prompt;
        if (prompt && els.promptLine.textContent !== prompt) els.promptLine.textContent = prompt;
    }

    function maneuverStatus() {
        if (maneuvers.phase === 'picture') return null;
        if (maneuvers.phase === 'done') {
            return maneuvers.called ? 'All maneuvers called — load the next scenario.' : 'No group could maneuver clear of the others this run.';
        }
        const n = `${maneuvers.called + 1} of ${maneuvers.planned}`;
        return maneuvers.pending(scope.tracks)
            ? `Maneuver ${n}: a group has changed track — call it.`
            : `Picture called — watch for maneuvers (${n}).`;
    }

    function hideReveal() {
        els.revealPanel.innerHTML = '<p class="muted">Click Reveal Answer when ready to check.</p>';
    }

    function resetScore() {
        els.scorePanel.innerHTML = '<p class="muted">Submit your call to grade.</p>';
    }

    function showReveal() {
        const answer = currentAnswer();
        const family = answer.answerKey && answer.answerKey.family;
        els.revealPanel.innerHTML = `<p class="call-text">${escapeHtml(answer.text)}</p>`
            + (maneuvers.phase !== 'picture' ? '' : '<p class="muted">Answer is for the scope as it is right now — pause first if you are still measuring.</p>');
        if (maneuvers.phase === 'picture') commitPicture(answer);
        else if (family === 'maneuver') maneuverCalled();
    }

    function submitGrade() {
        const answer = currentAnswer();
        if (!answer.answerKey) {
            if (maneuvers.phase !== 'picture') els.scorePanel.innerHTML = `<p class="muted">${escapeHtml(answer.text)}</p>`;
            return;
        }
        const student = Object.fromEntries(new FormData(els.studentForm).entries());
        const result = grader.gradeStudent(student, answer.answerKey);
        els.scorePanel.innerHTML = grader.formatGradeReport(result);
        if (maneuvers.phase === 'picture') {
            commitPicture(answer);
        } else {
            // Show the call: after a SPLIT the new group names are needed for what comes next.
            els.revealPanel.innerHTML = `<p class="call-text">${escapeHtml(answer.text)}</p>`;
            maneuverCalled();
        }
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
        document.getElementById('chkContacts').addEventListener('change', (e) => {
            scope.showContacts = e.target.checked;
        });
        // Takes effect for the picture not yet called; a run already in maneuvers carries on.
        els.chkManeuvers.addEventListener('change', (e) => {
            maneuvers.enabled = e.target.checked;
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
