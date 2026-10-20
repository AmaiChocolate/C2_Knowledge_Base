/**
 * WD seat panel — comm buttons, call forms, comm log, and the scored debrief with replay.
 * All grading lives in wd_seat.js; this file is only the DOM.
 */
(function () {
    let seat = null;
    let flightId = null;
    let replaying = false;
    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const clock = (t) => {
        const s = Math.max(0, Math.floor(t));
        return `T+${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };

    function selectedGroup() {
        const sel = seat.scope.selectedTrack;
        if (!sel || !sel.hostile) return null;
        return seat.groupOfTrack(sel.id);
    }

    function renderFlights() {
        const leads = seat.flightLeads();
        if (!leads.some(l => String(l.id) === String(flightId))) flightId = leads.length ? String(leads[0].id) : null;
        $('wdFlights').innerHTML = leads.map(l => (
            `<label><input type="radio" name="wdFlight" value="${esc(l.id)}"${String(l.id) === String(flightId) ? ' checked' : ''}> ${esc(l.callsign)}</label>`
        )).join('') || '<em>No blue flights</em>';
        $('wdFlights').querySelectorAll('input').forEach((r) => {
            r.addEventListener('change', () => { flightId = r.value; });
        });
    }

    function renderComm() {
        const box = $('wdComm');
        const html = seat.comm.slice(-40).map(c => (
            `<div class="${c.from === 'WD' ? 'wd-me' : 'wd-them'}">${clock(c.simT)} ${esc(c.from)}: ${esc(c.text)}</div>`
        )).join('');
        if (box.dataset.html !== html) {
            box.dataset.html = html;
            box.innerHTML = html || '<em>No calls yet.</em>';
            box.scrollTop = box.scrollHeight;
        }
    }

    function refresh(rebuild) {
        if (!seat) return;
        $('wdEnable').checked = seat.enabled;
        $('wdBody').hidden = !seat.enabled;
        if (!seat.enabled) return;
        if (rebuild) {
            renderFlights();
            closeForm();
            $('wdDebrief').hidden = true;
            replaying = false;
        } else if (!$('wdFlights').children.length) {
            renderFlights();
        }
        const S = seat.standards;
        const commitNm = seat.scope.fighterCommitNm != null ? seat.scope.fighterCommitNm : 50;
        const g = selectedGroup();
        $('wdStatus').innerHTML = `${clock(seat.now())}${seat.scope.paused ? ' · PAUSED' : ''}<br>`
            + `Commit ${S.commitEarlyNm}–${commitNm} nm · target by ${S.targetingRangeNm} nm · picture ≤ ${S.pictureDueSec} s<br>`
            + `Selected: ${g ? esc(g.name) : '<em>click a hostile track</em>'}`;
        $('wdPauseBtn').textContent = seat.scope.paused ? 'Resume' : 'Pause';
        $('wdCommitBtn').disabled = seat.auto.commit;
        $('wdTargetBtn').disabled = seat.auto.targeting;
        renderComm();
    }

    function closeForm() {
        $('wdForm').hidden = true;
        $('wdForm').innerHTML = '';
    }

    function openForm(title, fieldIds, extraHtml, onSubmit) {
        const form = $('wdForm');
        form.innerHTML = `<div class="wd-form-title">${esc(title)}</div>${extraHtml || ''}`
            + fieldIds.map((id) => {
                const def = FIELD_DEFS[id];
                return `<label>${esc(def.label)} <input name="${id}" autocomplete="off" placeholder="${esc(def.placeholder || '')}"></label>`;
            }).join('')
            + '<div class="wd-row"><button type="submit">Transmit</button><button type="button" id="wdFormCancel">Cancel</button></div>';
        form.hidden = false;
        form.onsubmit = (e) => {
            e.preventDefault();
            onSubmit(Object.fromEntries(new FormData(form).entries()));
            closeForm();
            refresh();
        };
        $('wdFormCancel').addEventListener('click', closeForm);
        const first = form.querySelector('input');
        if (first) first.focus();
    }

    function openPicture() {
        const answer = seat.openPicture();
        const family = answer && answer.answerKey ? answer.answerKey.family : 'picture';
        openForm('PICTURE — leave blank what does not apply', ANSWER_FAMILIES[family] || ANSWER_FAMILIES.picture, '',
            student => seat.submitPicture(student));
    }

    function openThreat() {
        const group = selectedGroup();
        if (!group) {
            seat.say('SIM', 'Click the hostile track you are calling the threat on first.');
            return refresh();
        }
        const blues = seat.blueFighters();
        const pick = `<label>To fighter <select name="blueId">${blues.map(b => `<option value="${esc(b.id)}">${esc(b.callsign)}</option>`).join('')}</select></label>`;
        openForm(`THREAT ${group.name} — BRAA from the fighter you choose`, ANSWER_FAMILIES.braa, pick,
            (student) => seat.submitThreat(student.blueId, selectedGroup() || group, student));
    }

    // ------------------------------------------------------------------- debrief

    const cls = score => (score >= 80 ? 'wd-good' : (score >= 50 ? 'wd-mid' : 'wd-bad'));

    function showDebrief() {
        const d = seat.debrief();
        seat.scope.paused = true;
        const titles = { picture: 'Pictures', commit: 'Commit', targeting: 'Targeting', threat: 'Threat calls', outcome: 'Outcome' };
        let html = `<h3>WD debrief — ${d.overall == null ? 'nothing graded' : `${d.overall}%`}</h3>`
            + `<p>${clock(d.durationSec)} flown. Click a row to jump the scope to that moment; drag the slider to replay.</p>`
            + `<input type="range" id="wdScrub" min="0" max="${Math.floor(d.durationSec)}" value="${Math.floor(d.durationSec)}" step="2">`
            + '<p id="wdScrubLabel" class="wd-truth"></p>';
        Object.keys(titles).forEach((k) => {
            const sec = d.sections[k];
            const auto = (k === 'commit' && d.auto.commit) || (k === 'targeting' && d.auto.targeting);
            html += `<h4>${titles[k]} — ${auto ? 'auto (not graded)' : (sec.score == null ? 'nothing to grade' : `<span class="${cls(sec.score)}">${Math.round(sec.score)}%</span>`)}`
                + ` <span class="wd-truth">weight ${d.standards.weights[k]}</span></h4>`;
            if (!sec.items.length) return;
            html += '<table>' + sec.items.map(i => (
                `<tr class="wd-jump" data-t="${Math.floor(i.simT)}"><td>${clock(i.simT)}</td><td>${esc(i.what)}</td>`
                + `<td class="${cls(i.score)}">${esc(i.verdict)}</td></tr>`
                + (i.truth ? `<tr><td></td><td colspan="2" class="wd-truth">Truth: ${esc(i.truth)}${(i.misses || []).map(m => `<br>✗ ${esc(m)}`).join('')}</td></tr>` : '')
            )).join('') + '</table>';
        });
        html += '<div class="wd-row"><button type="button" id="wdResumeBtn">Resume mission</button></div>';
        const box = $('wdDebrief');
        box.innerHTML = html;
        box.hidden = false;
        replaying = true;

        const scrubTo = (t) => {
            const frame = seat.frameAt(t);
            if (!frame) return;
            seat.scope.tracks = frame.tracks.map(x => Object.assign({ history: [] }, x));
            seat.scope.selectedTrack = null;
            $('wdScrub').value = t;
            $('wdScrubLabel').textContent = `Scope shows truth at ${clock(frame.simT)}`;
        };
        $('wdScrub').addEventListener('input', e => scrubTo(Number(e.target.value)));
        box.querySelectorAll('.wd-jump').forEach((row) => {
            row.addEventListener('click', () => scrubTo(Number(row.dataset.t)));
        });
        $('wdResumeBtn').addEventListener('click', () => {
            replaying = false;
            box.hidden = true;
            seat.scope.paused = false;
        });
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ---------------------------------------------------------------------- init

    window.initWdPanel = function (wdSeat) {
        seat = wdSeat;
        $('wdEnable').addEventListener('change', (e) => {
            seat.setEnabled(e.target.checked);
            refresh(true);
            if (typeof updatePictureSuggestion === 'function') updatePictureSuggestion();
        });
        $('wdAutoCommit').addEventListener('change', (e) => { seat.auto.commit = e.target.checked; refresh(); });
        $('wdAutoTarget').addEventListener('change', (e) => {
            seat.auto.targeting = e.target.checked;
            seat.version += 1;
            refresh();
        });
        $('wdCommitBtn').addEventListener('click', () => { if (flightId) seat.commit(flightId); refresh(); });
        $('wdTargetBtn').addEventListener('click', () => {
            const group = selectedGroup();
            if (!group) seat.say('SIM', 'Click a hostile track to pick the group, then TARGET.');
            else if (flightId) seat.target(flightId, group);
            refresh();
        });
        $('wdPictureBtn').addEventListener('click', openPicture);
        $('wdThreatBtn').addEventListener('click', openThreat);
        $('wdPauseBtn').addEventListener('click', () => {
            if (replaying) return;
            seat.scope.paused = !seat.scope.paused;
            refresh();
        });
        $('wdDebriefBtn').addEventListener('click', showDebrief);
        setInterval(() => refresh(false), 500);
        refresh(true);
    };

    window.refreshWdPanel = refresh;
})();
