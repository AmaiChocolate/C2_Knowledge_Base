/**
 * WD seat — puts the trainee in the loop and grades what they do (no DOM here; the
 * panel lives in wd_panel.js, and tests drive this class directly).
 *
 * With the seat enabled, blue fighters wait on the Weapons Director for:
 *   COMMIT     a flight holds CAP until committed (it will self-commit, and be marked
 *              down, if a hostile gets inside selfCommitNm)
 *   TARGETING  a flight engages only the groups it has been targeted on (it will sort
 *              itself, and be marked down, once a hostile is inside targetingRangeNm)
 * and the WD's PICTURE and THREAT calls are graded against scope truth with the same
 * engine as the Picture Trainer. Each function has an "auto" switch so a new WD can
 * take on one task at a time.
 */

/**
 * Grading standards. Commit and targeting ranges are mission-planned in the real world —
 * these are training defaults; change them here (or per scenario via `wdStandards`).
 */
const WD_STANDARDS = {
    pictureDueSec: 45,      // picture expected within this long of a new group appearing
    commitEarlyNm: 95,      // committing with the nearest hostile beyond this is early
    selfCommitNm: 40,       // fighters commit themselves inside this
    targetingRangeNm: 45,   // every group should be targeted before it is this close to a fighter
    threatNm: 15,           // an untargeted hostile this close to a fighter needs a THREAT call
    threatDueSec: 20,
    snapshotSec: 2,         // replay resolution
    weights: { picture: 30, commit: 20, targeting: 30, threat: 10, outcome: 10 }
};

class WdSeat {
    constructor(scope, deps) {
        this.scope = scope;
        this.pictureGen = deps.pictureGen;
        this.clusterer = deps.clusterer;
        this.grader = deps.grader;
        this.enabled = false;
        this.auto = { commit: false, targeting: false };
        this.standards = Object.assign({}, WD_STANDARDS);
        this.reset();
    }

    reset(standards) {
        this.standards = Object.assign({}, WD_STANDARDS, standards || {});
        this.startSimSec = this.scope.simTimeSec || 0;
        this.commits = {};          // lead id → { simT, rangeNm, verdict }
        this.commitDue = {};        // lead id → simT a hostile first got inside commit range
        this.targeting = {};        // lead id → [hostile ids]
        this.hostiles = {};         // hostile id → { callsign, targetedT, inRangeT, by }
        this.fighterSorted = {};    // lead id → simT the flight gave up waiting and sorted itself
        this.pictures = [];
        this.pictureTriggers = [];
        this.threats = [];          // { key, simT, blue, hostile, calledT, score }
        this.comm = [];
        this.frames = [];
        this.version = 0;
        this._maxGroups = 0;
        this._lastFrameT = -Infinity;
        this._pictureOpen = null;
    }

    now() {
        return (this.scope.simTimeSec || 0) - this.startSimSec;
    }

    setEnabled(on) {
        this.enabled = !!on;
        this.reset();
        if (this.scope.pilotAI) this.scope.pilotAI._blueSortPlanKey = null;
    }

    say(from, text) {
        this.comm.push({ simT: this.now(), from, text });
    }

    // ------------------------------------------------------------------ helpers

    ai() {
        return this.scope.pilotAI;
    }

    leadOf(track) {
        return this.ai().getBlueFlightLead(track) || track;
    }

    flightLeads() {
        return this.ai() ? this.ai().blueFlightLeads() : [];
    }

    aliveHostiles() {
        return this.ai() ? this.ai().aliveHostileFighters() : [];
    }

    blueFighters() {
        return (this.scope.truthTracks || []).filter(t => !t.hostile && t.type === 'fighter' && !t.isSplashed);
    }

    nearestHostileNm(track) {
        const hostiles = this.aliveHostiles();
        if (!hostiles.length) return Infinity;
        return this.ai().pickClosest(track, hostiles).range;
    }

    /** Hostile groups as painted on the scope, each with the name the picture gives it. */
    scopeGroups() {
        const hostiles = (this.scope.tracks || []).filter(t => t.hostile && !t.isSplashed);
        if (!hostiles.length) return { groups: [], answer: null };
        const groups = this.clusterer.cluster(hostiles);
        const answer = this.pictureGen.generatePicture(groups, null, { orient: orientationFromTracks(hostiles) });
        const named = (answer.formation && answer.formation.named) || [];
        groups.forEach((g) => {
            const n = named.find(x => x.group === g);
            g.name = n && n.name !== 'GROUP' ? n.name : `GROUP ${alssaBullseye(g.centroid)}`;
            g.ids = g.tracks.map(t => String(t.id));
        });
        return { groups, answer };
    }

    groupOfTrack(trackId) {
        return this.scopeGroups().groups.find(g => g.ids.indexOf(String(trackId)) >= 0) || null;
    }

    // ---------------------------------------------------------- hooks for PilotAI

    /** May this blue fighter leave CAP? Called by PilotAI every tick it wants to. */
    blueCleared(track) {
        if (!this.enabled || this.auto.commit) return true;
        const lead = this.leadOf(track);
        const id = String(lead.id);
        if (this.commits[id]) return true;
        const r = this.nearestHostileNm(lead);
        if (r <= this.standards.selfCommitNm) {
            this.commits[id] = { simT: this.now(), rangeNm: r, verdict: 'fighter-initiated', callsign: lead.callsign };
            this.say(lead.callsign, `${lead.callsign} COMMITTING — hostile inside ${this.standards.selfCommitNm}, no commit from control`);
            return true;
        }
        return false;
    }

    manualTargeting() {
        return this.enabled && !this.auto.targeting;
    }

    /**
     * Overlay the WD's targeting on the auto SORT plan. A flight with WD targeting engages
     * exactly those contacts; a flight with none engages nothing until it sorts itself.
     */
    applyTargeting(assignments, leads, hostiles) {
        const live = new Set(hostiles.map(h => String(h.id)));
        const taken = new Set();
        leads.forEach((lead) => {
            const id = String(lead.id);
            const mine = (this.targeting[id] || []).filter(h => live.has(h));
            if (mine.length) {
                assignments[id] = mine;
                mine.forEach(h => taken.add(h));
            }
        });
        leads.forEach((lead) => {
            const id = String(lead.id);
            if ((this.targeting[id] || []).some(h => live.has(h))) return;
            if (!this.fighterSorted[id]) {
                const r = this.nearestHostileNm(lead);
                if (r > this.standards.targetingRangeNm) {
                    assignments[id] = [];
                    return;
                }
                this.fighterSorted[id] = this.now();
                this.say(lead.callsign, `${lead.callsign} SORTING — no targeting from control`);
            }
            // Fighter-sorted: take whatever nobody has been targeted on (nearest first).
            const free = hostiles.filter(h => !taken.has(String(h.id)));
            const pool = free.length ? free : hostiles;
            assignments[id] = pool
                .slice()
                .sort((a, b) => this.ai().braa(lead, a).range - this.ai().braa(lead, b).range)
                .slice(0, this.ai().maxContactsPerShooter || 3)
                .map(h => String(h.id));
            assignments[id].forEach(h => taken.add(h));
        });
        Object.keys(assignments).forEach((id) => {
            if (!leads.some(l => String(l.id) === id)) delete assignments[id];
        });
        return assignments;
    }

    /** Changes whenever the plan must be rebuilt for a reason other than who is alive. */
    planKey() {
        if (!this.manualTargeting()) return '';
        // Re-check each tick whether a waiting flight has reached self-sort range.
        this.flightLeads().forEach((lead) => {
            const id = String(lead.id);
            const targeted = (this.targeting[id] || []).length > 0;
            if (!targeted && !this.fighterSorted[id]
                && this.nearestHostileNm(lead) <= this.standards.targetingRangeNm) {
                this.version += 1;
            }
        });
        return `|wd${this.version}`;
    }

    // ------------------------------------------------------------------ WD calls

    commit(leadId) {
        const lead = this.flightLeads().find(l => String(l.id) === String(leadId));
        if (!lead) return null;
        const id = String(lead.id);
        if (this.commits[id]) {
            this.say('WD', `${lead.callsign}, COMMIT (already committed)`);
            return this.commits[id];
        }
        const r = this.nearestHostileNm(lead);
        const commitNm = this.scope.fighterCommitNm != null ? this.scope.fighterCommitNm : 50;
        let verdict = 'on time';
        if (!isFinite(r)) verdict = 'no hostiles';
        else if (r > this.standards.commitEarlyNm) verdict = 'early';
        else if (r < commitNm) verdict = 'late';
        this.commits[id] = { simT: this.now(), rangeNm: r, verdict, callsign: lead.callsign };
        this.say('WD', `${lead.callsign}, COMMIT`);
        this.say(lead.callsign, (this.targeting[id] || []).length
            ? `${lead.callsign} COMMIT`
            : `${lead.callsign} COMMIT, REQUEST TARGETING`);
        return this.commits[id];
    }

    /** Target a flight on a scope group (from scopeGroups / groupOfTrack). */
    target(leadId, group) {
        const lead = this.flightLeads().find(l => String(l.id) === String(leadId));
        if (!lead || !group) return false;
        const id = String(lead.id);
        // A group belongs to one flight at a time.
        Object.keys(this.targeting).forEach((other) => {
            this.targeting[other] = this.targeting[other].filter(h => group.ids.indexOf(h) < 0);
        });
        this.targeting[id] = (this.targeting[id] || []).concat(group.ids);
        group.ids.forEach((h) => {
            const rec = this.hostiles[h] || (this.hostiles[h] = {});
            if (rec.targetedT == null) rec.targetedT = this.now();
            rec.by = lead.callsign;
        });
        this.version += 1;
        this.say('WD', `${lead.callsign}, TARGET ${group.name}`);
        this.say(lead.callsign, `${lead.callsign} TARGETED ${group.name}`);
        return true;
    }

    /** Call when the WD starts composing a picture: truth is snapshotted so a slow typist is not graded on stale numbers. */
    openPicture() {
        this._pictureOpen = this.scopeGroups().answer;
        return this._pictureOpen;
    }

    /** Grade a picture against truth at open and at submit; the better one counts. */
    submitPicture(student) {
        const candidates = [this._pictureOpen, this.scopeGroups().answer].filter(a => a && a.answerKey);
        this._pictureOpen = null;
        if (!candidates.length) {
            this.say('WD', 'PICTURE (nothing on scope to grade)');
            return null;
        }
        const graded = candidates
            .map(a => ({ answer: a, result: this.grader.gradeStudent(student, a.answerKey) }))
            .sort((a, b) => b.result.score - a.result.score)[0];
        const record = {
            simT: this.now(),
            score: graded.result.score,
            details: graded.result.details,
            truth: graded.answer.text,
            student
        };
        this.pictures.push(record);
        this.say('WD', `PICTURE call — graded ${record.score}%`);
        return record;
    }

    /** BRAA answer key for a THREAT call from `blue` on `group`. */
    threatKey(blue, group) {
        const braa = Geo.bearingRange(blue, group.centroid);
        this.pictureGen.annotate(group, orientationFromTracks(group.tracks));
        return {
            family: 'braa',
            fields: {
                braaBearing: Geo.roundBearing(braa.bearing),
                braaRange: Math.round(braa.range),
                altitude: alssaAltitudeK(group.centroid.altitude),
                aspect: this.pictureGen.aspect(group, blue).split(' ')[0]
            },
            tolerances: this.pictureGen.rules.tolerances
        };
    }

    submitThreat(blueId, group, student) {
        const blue = this.blueFighters().find(b => String(b.id) === String(blueId));
        if (!blue || !group) return null;
        const key = this.threatKey(blue, group);
        const result = this.grader.gradeStudent(student, key);
        const flight = String(this.leadOf(blue).id);
        // Satisfies any open threat requirement for this flight against this group.
        this.threats
            .filter(t => t.calledT == null && t.flight === flight && group.ids.indexOf(t.hostileId) >= 0)
            .forEach((t) => { t.calledT = this.now(); t.score = result.score; });
        const record = { simT: this.now(), blue: blue.callsign, group: group.name, score: result.score, details: result.details, key };
        (this.threatCalls = this.threatCalls || []).push(record);
        this.say('WD', `${blue.callsign}, THREAT ${group.name} — graded ${result.score}%`);
        return record;
    }

    // -------------------------------------------------------------- per-tick watch

    update() {
        if (!this.enabled || !this.ai()) return;
        const t = this.now();
        const S = this.standards;
        const hostiles = this.aliveHostiles();
        const blues = this.blueFighters();
        const commitNm = this.scope.fighterCommitNm != null ? this.scope.fighterCommitNm : 50;

        // New group on the scope → a picture is due.
        const groupCount = this.scopeGroups().groups.length;
        if (groupCount > this._maxGroups) {
            this.pictureTriggers.push({ simT: t, groups: groupCount });
            this._maxGroups = groupCount;
        }

        this.flightLeads().forEach((lead) => {
            const id = String(lead.id);
            if (this.commitDue[id] == null && this.nearestHostileNm(lead) <= commitNm) this.commitDue[id] = t;
        });

        hostiles.forEach((h) => {
            const id = String(h.id);
            const rec = this.hostiles[id] || (this.hostiles[id] = {});
            rec.callsign = h.callsign;
            if (rec.inRangeT == null && blues.length
                && this.ai().pickClosest(h, blues).range <= S.targetingRangeNm) {
                rec.inRangeT = t;
            }
        });

        // THREAT: a hostile inside threat range of a fighter whose flight is not targeted on it.
        blues.forEach((b) => {
            const flight = String(this.leadOf(b).id);
            const owned = this.manualTargeting()
                ? (this.targeting[flight] || [])
                : ((this.ai()._blueSortPlan && this.ai()._blueSortPlan.assignments[flight]) || []);
            hostiles.forEach((h) => {
                if (owned.indexOf(String(h.id)) >= 0) return;
                if (this.ai().braa(b, h).range > S.threatNm) return;
                const key = `${flight}>${h.id}`;
                if (this.threats.some(x => x.key === key)) return;
                this.threats.push({
                    key, flight, hostileId: String(h.id), simT: t,
                    blue: b.callsign, hostile: h.callsign, calledT: null, score: null
                });
            });
        });

        if (t - this._lastFrameT >= S.snapshotSec) {
            this._lastFrameT = t;
            this.frames.push({
                simT: t,
                tracks: (this.scope.truthTracks || [])
                    .filter(x => !x.isDormant && !x.isSplashed)
                    .map(x => ({
                        id: x.id, callsign: x.callsign, bearing: x.bearing, range: x.range,
                        altitude: x.altitude, heading: x.heading, speed: x.speed, hostile: x.hostile,
                        type: x.type, affiliation: x.affiliation, declaration: x.declaration,
                        airframe: x.airframe, tacticalState: x.tacticalState
                    }))
            });
        }
    }

    frameAt(simT) {
        if (!this.frames.length) return null;
        let best = this.frames[0];
        for (const f of this.frames) {
            if (f.simT <= simT) best = f;
            else break;
        }
        return best;
    }

    // -------------------------------------------------------------------- debrief

    debrief() {
        const S = this.standards;
        const fighters = (this.scope.truthTracks || []).filter(t => t.type === 'fighter');
        const sections = {};
        const mean = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

        // Pictures: accuracy of the first picture after each trigger, scaled by how late it was.
        const pictureItems = this.pictureTriggers.map((trig) => {
            const pic = this.pictures.find(p => p.simT >= trig.simT);
            if (!pic) return { simT: trig.simT, what: `${trig.groups} group(s) on scope`, verdict: 'no picture', score: 0 };
            const late = pic.simT - trig.simT;
            const factor = late <= S.pictureDueSec ? 1 : Math.max(0.5, 1 - 0.5 * (late - S.pictureDueSec) / S.pictureDueSec);
            return {
                simT: pic.simT,
                what: `${trig.groups} group(s) on scope`,
                verdict: `${pic.score}% accurate, ${Math.round(late)} s after new group${late > S.pictureDueSec ? ' (late)' : ''}`,
                score: Math.round(pic.score * factor),
                truth: pic.truth,
                misses: pic.details.filter(d => !d.ok).map(d => `${d.field}: expected ${d.expected}, got ${d.got || '(blank)'}`)
            };
        });
        sections.picture = { items: pictureItems, score: mean(pictureItems.map(i => i.score)) };

        // Commit: only flights that actually had a hostile reach commit range (or were committed).
        const commitScore = { 'on time': 100, early: 70, late: 50, 'fighter-initiated': 0, 'no hostiles': 50 };
        const commitItems = [];
        if (!this.auto.commit) {
            this.flightLeads().concat(fighters.filter(f => !f.hostile && f.isSplashed && this.commits[String(f.id)]))
                .forEach((lead) => {
                    const id = String(lead.id);
                    const c = this.commits[id];
                    if (!c && this.commitDue[id] == null) return;
                    const verdict = c ? c.verdict : 'never committed';
                    commitItems.push({
                        simT: c ? c.simT : this.commitDue[id],
                        what: lead.callsign,
                        verdict: c && isFinite(c.rangeNm) ? `${verdict} — nearest hostile ${Math.round(c.rangeNm)} nm` : verdict,
                        score: c ? commitScore[c.verdict] : 0
                    });
                });
        }
        sections.commit = { items: commitItems, score: mean(commitItems.map(i => i.score)) };

        // Targeting: every hostile that got inside targeting range of a fighter.
        const targetItems = [];
        if (!this.auto.targeting) {
            Object.keys(this.hostiles).forEach((id) => {
                const h = this.hostiles[id];
                if (h.inRangeT == null && h.targetedT == null) return;
                let verdict = 'targeted in time';
                let score = 100;
                if (h.targetedT == null) { verdict = 'never targeted — fighters sorted themselves'; score = 0; }
                else if (h.inRangeT != null && h.targetedT > h.inRangeT) {
                    verdict = `targeted ${Math.round(h.targetedT - h.inRangeT)} s after reaching ${S.targetingRangeNm} nm`;
                    score = 50;
                }
                targetItems.push({
                    simT: h.targetedT != null ? h.targetedT : h.inRangeT,
                    what: `${h.callsign}${h.by ? ` → ${h.by}` : ''}`,
                    verdict,
                    score
                });
            });
        }
        sections.targeting = { items: targetItems, score: mean(targetItems.map(i => i.score)) };

        // Threat calls that were required.
        const threatItems = this.threats.map((t) => {
            const late = t.calledT != null ? t.calledT - t.simT : null;
            const made = late != null && late <= S.threatDueSec;
            return {
                simT: t.simT,
                what: `${t.hostile} inside ${S.threatNm} nm of ${t.blue}`,
                verdict: late == null ? 'no THREAT call' : `called after ${Math.round(late)} s, ${t.score}% accurate${made ? '' : ' (late)'}`,
                score: late == null ? 0 : Math.round(t.score * (made ? 1 : 0.5))
            };
        });
        sections.threat = { items: threatItems, score: mean(threatItems.map(i => i.score)) };

        // Outcome.
        const blueLost = fighters.filter(f => !f.hostile && f.isSplashed).length;
        const redLost = fighters.filter(f => f.hostile && f.isSplashed).length;
        const redTotal = fighters.filter(f => f.hostile).length;
        const hvaaLost = (this.scope.truthTracks || [])
            .filter(t => !t.hostile && t.type !== 'fighter' && t.isSplashed).length;
        sections.outcome = {
            items: [{
                simT: this.now(),
                what: `${redLost} of ${redTotal} hostiles splashed`,
                verdict: `${blueLost} blue lost, ${hvaaLost} HVAA lost`,
                score: hvaaLost ? 0 : Math.max(0, 100 - 34 * blueLost)
            }],
            score: hvaaLost ? 0 : Math.max(0, 100 - 34 * blueLost)
        };

        // Weighted over the sections that had anything to grade.
        let total = 0;
        let weight = 0;
        Object.keys(S.weights).forEach((k) => {
            if (sections[k].score == null) return;
            total += sections[k].score * S.weights[k];
            weight += S.weights[k];
        });

        return {
            overall: weight ? Math.round(total / weight) : null,
            durationSec: this.now(),
            sections,
            standards: S,
            auto: Object.assign({}, this.auto),
            comm: this.comm.slice()
        };
    }
}

if (typeof window !== 'undefined') {
    window.WD_STANDARDS = WD_STANDARDS;
    window.WdSeat = WdSeat;
}
