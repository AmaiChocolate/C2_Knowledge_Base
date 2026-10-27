/**
 * Grading: builds the answer from live scope truth and compares the student form to it.
 *
 * An answer key is { family, fields, anchors?, tolerances }. `family` selects which
 * form fields are shown and graded (ANSWER_FAMILIES); adding a drill type means adding
 * a family here and emitting its key from PictureGenerator.
 */
const FIELD_DEFS = {
    groupCount: { label: 'Total groups', kind: 'count' },
    waveCount: { label: 'Waves (blank if one)', kind: 'count' },
    leadingEdgeCount: { label: 'Leading edge groups (blank if no waves)', kind: 'count' },
    packageCount: { label: 'Packages', kind: 'count' },
    label: { label: 'Label', kind: 'label', placeholder: 'AZIMUTH, RANGE, WALL, LADDER, VIC…' },
    width: { label: 'Wide / azimuth (nm)', kind: 'nm' },
    depth: { label: 'Deep / range (nm)', kind: 'nm' },
    bullsBearing: { label: 'Anchor BULLSEYE bearing', kind: 'anchorBearing' },
    bullsRange: { label: 'Anchor BULLSEYE range (nm)', kind: 'anchorRange' },
    braaBearing: { label: 'BRAA bearing', kind: 'bearing' },
    braaRange: { label: 'BRAA range (nm)', kind: 'range' },
    strobeRange: { label: 'STROBE range (nm)', kind: 'range' },
    altitude: { label: 'Altitude (thousands ft)', kind: 'altitude', placeholder: '32 or THIRTY-TWO THOUSAND' },
    track: { label: 'Track direction', kind: 'word', placeholder: 'EAST, SOUTHWEST, CAP…' },
    aspect: { label: 'Aspect', kind: 'aspect', placeholder: 'HOT / FLANK / BEAM / DRAG' },
    groupName: { label: 'Group (name from your picture)', kind: 'name', placeholder: 'NORTH GROUP, LEAD GROUP…' },
    maneuver: { label: 'Maneuver', kind: 'aspect', placeholder: 'HOT / FLANK / BEAM / DRAG / SPLIT' },
    direction: { label: 'Direction (blank if HOT or SPLIT)', kind: 'cardinal', placeholder: 'NORTH, SOUTHWEST…' },
    splitBearing: { label: 'SPLIT: a new group\'s BULLSEYE bearing', kind: 'anchorBearing' },
    splitRange: { label: 'SPLIT: a new group\'s BULLSEYE range (nm)', kind: 'anchorRange' }
};

const ANSWER_FAMILIES = {
    picture: ['groupCount', 'waveCount', 'leadingEdgeCount', 'label', 'width', 'depth',
        'bullsBearing', 'bullsRange', 'altitude', 'track'],
    packages: ['packageCount', 'width', 'bullsBearing', 'bullsRange'],
    braa: ['braaBearing', 'braaRange', 'altitude', 'aspect'],
    music: ['bullsBearing', 'bullsRange', 'altitude', 'track'],
    strobe: ['strobeRange', 'altitude'],
    maneuver: ['groupName', 'maneuver', 'direction', 'splitBearing', 'splitRange']
};

class PictureGrader {
    constructor(pictureGen, clusterer) {
        this.pictureGen = pictureGen;
        this.clusterer = clusterer;
    }

    /** Answer for what is on the scope right now (dormant tracks are not on the scope). */
    buildAnswer(tracks, meta, orientation) {
        const visible = tracks.filter(t => !t.isDormant);
        const hostiles = visible.filter(t => t.hostile);
        const blues = visible.filter(t => !t.hostile && t.type === 'fighter');
        const groups = hostiles.every(t => t.groupId != null)
            ? this.clusterer.groupByTruth(hostiles)
            : this.clusterer.cluster(hostiles);

        return this.pictureGen.generatePicture(groups, null, Object.assign({}, meta || {}, {
            orientation,
            blues
        }));
    }

    /**
     * After the picture is called: the maneuver awaiting a call, by the name the group
     * was given in that picture. No answer key while nothing has visibly maneuvered.
     */
    buildManeuverAnswer(tracks, director) {
        const m = director.pending(tracks);
        if (!m) {
            const text = director.phase === 'done'
                ? 'All maneuvers called. Load the next scenario.'
                : 'No maneuver yet. The groups are still flying as called.';
            return { text, prompt: null, groups: [], formation: null, answerKey: null };
        }
        const groupOf = id => this.clusterer.groupByTruth(tracks.filter(t => t.hostile && !t.isDormant && t.groupId === id))[0];
        if (m.type === 'SPLIT') {
            const pieces = director.splitPieces(tracks).map(p => ({ group: groupOf(p.groupId), name: p.name }));
            return this.pictureGen.generateSplitCall(m.name, pieces);
        }
        return this.pictureGen.generateManeuverCall(groupOf(m.groupId), m, m.name, director.fighterReference(tracks));
    }

    gradeStudent(student, answerKey) {
        if (!answerKey) return { score: 0, points: 0, max: 0, pass: false, details: [] };

        const tol = answerKey.tolerances;
        const fields = answerKey.fields || {};
        const anchor = this.matchAnchor(student, answerKey);
        const details = [];

        (ANSWER_FAMILIES[answerKey.family] || []).forEach(id => {
            const def = FIELD_DEFS[id];
            const got = student[id];
            let expected = fields[id];
            let ok;

            switch (def.kind) {
                case 'count':
                    ok = this.numberMatches(got, expected, 0, true);
                    break;
                case 'nm':
                    ok = this.numberMatches(got, expected, tol.dimensionNm, true);
                    break;
                case 'range':
                    ok = this.numberMatches(got, expected, tol.rangeNm, false);
                    break;
                case 'bearing':
                    ok = this.bearingMatches(got, expected, tol.bearingDeg);
                    break;
                case 'anchorBearing':
                    // No anchor (a track maneuver): the field stays blank.
                    expected = anchor ? anchor.bearing : null;
                    ok = anchor ? this.bearingMatches(got, expected, tol.bearingDeg) : this.numberMatches(got, null, 0, true);
                    break;
                case 'anchorRange':
                    expected = anchor ? anchor.range : null;
                    ok = anchor
                        ? this.numberMatches(got, expected, anchor.isCap ? tol.capRangeNm : tol.rangeNm, false)
                        : this.numberMatches(got, null, 0, true);
                    break;
                case 'altitude': {
                    if (anchor) expected = anchor.altitudeK;
                    const k = alssaParseAltitudeK(got);
                    ok = !isNaN(k) && Math.abs(k - expected) <= tol.altitudeK;
                    break;
                }
                case 'aspect':
                    // "FLANK NORTHEAST" is graded on the aspect word.
                    ok = !!expected && this.normalizeWord(got).startsWith(this.normalizeWord(expected));
                    break;
                case 'label':
                    ok = this.normalizeLabel(got) === this.normalizeLabel(expected);
                    break;
                case 'name':
                    ok = this.normalizeLabel(got) === this.normalizeLabel(expected);
                    break;
                case 'cardinal':
                    ok = this.cardinalMatches(got, expected, answerKey.heading, tol.directionDeg);
                    break;
                default:
                    ok = this.normalizeWord(got) === this.normalizeWord(expected);
            }

            details.push({ field: def.label, ok, expected: this.displayExpected(def, expected, anchor), got });
        });

        const points = details.filter(d => d.ok).length;
        const max = details.length;
        const score = max ? Math.round((points / max) * 100) : 0;
        return { score, points, max, details, pass: score >= 70 };
    }

    /**
     * Any group in the called picture is a legitimate anchor; grade bearing, range and
     * altitude against the one the student appears to have anchored (else the priority anchor).
     */
    matchAnchor(student, answerKey) {
        const anchors = answerKey.anchors;
        if (!anchors || !anchors.length) return null;
        const tol = answerKey.tolerances;
        const bearing = student.bullsBearing != null ? student.bullsBearing : student.splitBearing;
        const range = student.bullsRange != null ? student.bullsRange : student.splitRange;
        return anchors.find(a => (
            this.bearingMatches(bearing, a.bearing, tol.bearingDeg)
            && this.numberMatches(range, a.range, a.isCap ? tol.capRangeNm : tol.rangeNm, false)
        )) || anchors[0];
    }

    /** `blankWhenNull`: when the answer has no such element the student must leave it blank (or 0). */
    numberMatches(got, expected, tolerance, blankWhenNull) {
        const g = alssaParseNumber(got);
        if (expected == null) return blankWhenNull && (isNaN(g) ? String(got || '').trim() === '' : g === 0);
        return !isNaN(g) && Math.abs(g - expected) <= tolerance;
    }

    /**
     * Any cardinal whose centre is within the direction tolerance of the true heading -
     * a group on 250 may be called WEST or SOUTHWEST. Blank when there is no direction (HOT).
     */
    cardinalMatches(got, expected, heading, tolerance) {
        const word = this.normalizeWord(got);
        if (expected == null) return word === '';
        const short = { N: 'NORTH', NE: 'NORTHEAST', E: 'EAST', SE: 'SOUTHEAST', S: 'SOUTH', SW: 'SOUTHWEST', W: 'WEST', NW: 'NORTHWEST' };
        const idx = CARDINALS_8.indexOf(short[word] || word);
        if (idx < 0) return false;
        const truth = heading != null ? heading : CARDINALS_8.indexOf(expected) * 45;
        return Geo.angleDiff(idx * 45, truth) <= tolerance;
    }

    bearingMatches(got, expected, tolerance) {
        const g = alssaParseNumber(got);
        return !isNaN(g) && expected != null && Geo.angleDiff(g, expected) <= tolerance;
    }

    normalizeWord(val) {
        return String(val || '').toUpperCase().replace(/\b(TRACK|GROUPS?)\b/g, '').replace(/[^A-Z]/g, '');
    }

    normalizeLabel(val) {
        const word = this.normalizeWord(val);
        return (word === 'NONE' || word === 'SINGLE' || word === 'UNKNOWN') ? '' : word;
    }

    displayExpected(def, expected, anchor) {
        if (expected == null || expected === '') return '(blank)';
        if (def.kind === 'anchorBearing' && anchor) return `${String(expected).padStart(3, '0')} (${anchor.name})`;
        if (def.kind === 'bearing') return String(expected).padStart(3, '0');
        return String(expected);
    }

    formatGradeReport(result) {
        if (!result.details.length) return '<p class="muted">Nothing to grade.</p>';
        const esc = s => String(s == null || s === '' ? '(blank)' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        let html = `<p><strong>Score: ${result.score}%</strong> (${result.pass ? 'PASS' : 'NEEDS WORK'})</p><ul>`;
        result.details.forEach(d => {
            html += `<li style="color:${d.ok ? '#6f6' : '#f66'}">${esc(d.field)}: `
                + `${d.ok ? 'OK' : `expected ${esc(d.expected)}, got ${esc(d.got)}`}</li>`;
        });
        html += '</ul>';
        return html;
    }
}

if (typeof window !== 'undefined') {
    window.FIELD_DEFS = FIELD_DEFS;
    window.ANSWER_FAMILIES = ANSWER_FAMILIES;
    window.PictureGrader = PictureGrader;
}
