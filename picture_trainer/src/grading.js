/**
 * Grading — reveal answer + field compare (ALSSA-aware parsing).
 */
class PictureGrader {
    constructor(pictureGen, clusterer) {
        this.pictureGen = pictureGen;
        this.clusterer = clusterer;
    }

    buildAnswer(tracks, meta, orientation) {
        const hostiles = tracks.filter(t => t.hostile);
        const blues = tracks.filter(t => !t.hostile && t.type === 'fighter');
        const groups = this.clusterer.cluster(hostiles);

        const picMeta = Object.assign({}, meta || {}, {
            orientation,
            trackFillIn: getOrientation(orientation).trackFillIn
        });

        if (meta && meta.mode === 'leading_edge') {
            picMeta.leadingEdgeCount = meta.leadingEdgeCount;
        }
        if (meta && meta.mode === 'threat') {
            const threatTrack = hostiles.find(t => t.isThreat) || hostiles[hostiles.length - 1];
            const threatGroup = groups.find(g => g.tracks.some(t => t.id === threatTrack.id)) || groups[0];
            const nearestBlue = blues.reduce((a, b) => {
                const da = this.braaDist(a, threatGroup.centroid);
                const db = this.braaDist(b, threatGroup.centroid);
                return da < db ? a : b;
            }, blues[0]);
            picMeta.nearestBlue = nearestBlue;
            picMeta.braa = this.pictureGen.calcBraa(nearestBlue, threatGroup.centroid);
            if (threatGroup) threatGroup.isThreat = true;
        }
        if (meta && meta.mode === 'bogey_dope') {
            const targetGroup = this.pictureGen.findLeadingEdge(groups);
            const nearestBlue = blues[0];
            picMeta.nearestBlue = nearestBlue;
            picMeta.targetGroup = targetGroup;
            picMeta.braa = this.pictureGen.calcBraa(nearestBlue, targetGroup.centroid);
        }
        if (meta && meta.mode === 'ea') {
            picMeta.eaType = meta.eaType || 'MUSIC';
        }

        return this.pictureGen.generatePicture(groups, null, picMeta);
    }

    braaDist(from, centroid) {
        const dx = centroid.range * Math.cos(centroid.bearing * Math.PI / 180)
            - from.range * Math.cos(from.bearing * Math.PI / 180);
        const dy = centroid.range * Math.sin(centroid.bearing * Math.PI / 180)
            - from.range * Math.sin(from.bearing * Math.PI / 180);
        return Math.sqrt(dx * dx + dy * dy);
    }

    gradeStudent(student, answerKey) {
        if (!answerKey) return { score: 0, details: [{ field: 'answer', ok: false, msg: 'No answer key' }] };

        const details = [];
        let pts = 0;
        let max = 0;

        const check = (field, got, expected, exact) => {
            max += 1;
            let ok = false;
            if (expected == null || expected === '') {
                ok = got == null || got === '';
            } else if (exact) {
                ok = String(got || '').toUpperCase() === String(expected).toUpperCase();
            } else {
                ok = String(got || '').toUpperCase().includes(String(expected).toUpperCase());
            }
            if (ok) pts += 1;
            details.push({ field, ok, expected, got });
        };

        const checkNum = (field, got, expected, tol) => {
            max += 1;
            const g = alssaParseNumber(got);
            const e = alssaParseNumber(expected);
            const ok = !isNaN(g) && !isNaN(e) && Math.abs(g - e) <= tol;
            if (ok) pts += 1;
            details.push({ field, ok, expected: e, got: g });
        };

        const checkAltitude = (got, answerKey) => {
            max += 1;
            const gotU = String(got || '').trim().toUpperCase();
            const block = alssaFormatAltitude(answerKey.altitudeFt, true);
            const thousands = alssaFormatAltitude(answerKey.altitudeFt, false);
            const ok = gotU === String(answerKey.altitudeBlock || '').toUpperCase()
                || gotU === block
                || gotU === thousands
                || (answerKey.altitudeFt && gotU.includes(String(Math.round(answerKey.altitudeFt / 1000))));
            if (ok) pts += 1;
            details.push({ field: 'altitudeBlock', ok, expected: answerKey.altitudeBlock, got });
        };

        if (answerKey.mode === 'threat' || answerKey.mode === 'bogey_dope') {
            checkNum('braaBearing', student.braaBearing, answerKey.braaBearing, 5);
            checkNum('braaRange', student.braaRange, answerKey.braaRange, 3);
            checkAltitude(student.altitudeBlock, answerKey);
            check('fillIns', student.fillIns, answerKey.fillIns, false);
        } else if (answerKey.mode === 'ea') {
            check('label', student.label, answerKey.label, true);
            checkNum('bullsBearing', student.bullsBearing, answerKey.bullsBearing, 5);
            checkNum('bullsRange', student.bullsRange, answerKey.bullsRange, 3);
        } else {
            checkNum('groupCount', student.groupCount, answerKey.groupCount, 0);
            if (answerKey.waveCount != null) {
                checkNum('waveCount', student.waveCount, answerKey.waveCount, 0);
            }
            check('label', student.label, answerKey.label, true);
            if (answerKey.dimensionNm != null) {
                const gotDim = alssaParseDimensionNm(student.dimensions);
                checkNum('dimensions', gotDim, answerKey.dimensionNm, 2);
            }
            checkNum('bullsBearing', student.bullsBearing, answerKey.bullsBearing, 5);
            checkNum('bullsRange', student.bullsRange, answerKey.bullsRange, 3);
            checkAltitude(student.altitudeBlock, answerKey);
            if (answerKey.fillIns) {
                check('fillIns (track)', student.fillIns, answerKey.trackFillIn || 'TRACK', false);
                check('fillIns (declaration)', student.fillIns, 'HOSTILE', false);
            }
        }

        const pct = max ? Math.round((pts / max) * 100) : 0;
        return { score: pct, points: pts, max, details, pass: pct >= 70 };
    }

    formatGradeReport(result) {
        if (!result.details.length) return 'No submission.';
        let html = `<p><strong>Score: ${result.score}%</strong> (${result.pass ? 'PASS' : 'NEEDS WORK'})</p><ul>`;
        result.details.forEach(d => {
            html += `<li style="color:${d.ok ? '#6f6' : '#f66'}">${d.field}: ${d.ok ? 'OK' : `expected ${d.expected}, got ${d.got}`}</li>`;
        });
        html += '</ul>';
        return html;
    }
}

if (typeof window !== 'undefined') window.PictureGrader = PictureGrader;
