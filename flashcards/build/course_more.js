/**
 * WD from Zero, modules 5-7 and 9: BOX / LEADING EDGE / WAVES / PACKAGES, aspect and
 * maneuvers, fighter requests (THREAT, BOGEY DOPE, MUSIC, STROBE), and the checkride mix.
 */
const { SNAPSHOT, T, R, grader, pad3, fly, pictureMeasurements, maneuverMeasurements } = require('./harness');
const {
    CARDINALS, ASPECTS, TOL, LABEL_RULES,
    rngFor, shuffle, pick, strip, words, cardinalOf, reciprocal,
    questions, addScene, add, choice, fullCallChoice, errorSpot, soloCall, anchorField, eachRun, pictureRun
} = require('./course_lib');

const TRACK_OPTIONS = CARDINALS.map(c => `TRACK ${c}`).concat(['CAP']);
const trackValue = f => (f.track === 'CAP' ? 'CAP' : `TRACK ${f.track}`);
const fighterCallsigns = tracks => tracks.filter(t => !t.hostile && t.type === 'fighter').map(t => t.callsign);
const leadOfGroup = g => g.lead || g.tracks.find(t => !t.formationAnchor) || g.tracks[0];

// ------------------------------------------------------------------ module 5

function buildM5() {
    const LABELS = ['WALL', 'LADDER', 'CHAMPAGNE', 'VIC', 'BOX'];

    // BOX: two abreast in front, two abreast behind.
    pictureRun('m5', ['box'], 15, key => key.family === 'picture' && key.fields.label === 'BOX' && !key.fields.waveCount,
        ({ rng, base, f, named }) => {
            choice(rng, Object.assign(base('guided', 'label'), {
                prompt: 'Four groups. Which label?',
                why: 'BOX: two groups abreast in front, two abreast behind. Voice WIDE, then DEEP.'
            }), 'BOX', LABELS.filter(l => l !== 'BOX'));
            const target = pick(rng, named);
            const pool = ['NORTH LEAD GROUP', 'SOUTH LEAD GROUP', 'NORTH TRAIL GROUP', 'SOUTH TRAIL GROUP', 'LEAD GROUP', 'TRAIL GROUP', 'MIDDLE GROUP'];
            choice(rng, Object.assign(base('guided', 'name'), {
                prompt: `In this BOX, what is ${target.group.lead.callsign}'s group called?`,
                why: `BOX: NORTH / SOUTH LEAD GROUP in front, NORTH / SOUTH TRAIL GROUP behind. ${target.group.lead.callsign} is ${target.name}.`
            }), target.name, shuffle(rng, pool.filter(x => x !== target.name)));
        },
        (f, key) => [
            { k: 'groups', kind: 'num', label: 'Total groups', v: f.groupCount, tol: 0 },
            { k: 'label', kind: 'select', label: 'Label', options: LABELS, v: f.label },
            { k: 'wide', kind: 'num', label: 'WIDE (nm)', v: f.width, tol: TOL.dimensionNm },
            { k: 'deep', kind: 'num', label: 'DEEP (nm)', v: f.depth, tol: TOL.dimensionNm },
            anchorField(key, 'BULLSEYE of any group'),
            { k: 'track', kind: 'select', label: 'Track', options: TRACK_OPTIONS, v: trackValue(f) }
        ]);

    // LEADING EDGE and WAVES.
    pictureRun('m5', ['waves', 'leading_edge'], 15, key => key.family === 'picture' && key.fields.waveCount >= 2,
        ({ rng, base, f, text }) => {
            const n = f.groupCount;
            choice(rng, Object.assign(base('guided', 'total'), {
                prompt: 'How many groups in total?',
                why: `A wave picture opens with the total: ${words(n)} GROUPS. Count every tagged lead, all waves.`
            }), String(n), [n - 2, n - 1, n + 1, n + 2].filter(x => x > 1).map(String), { ordered: (a, b) => a - b });
            const w = f.waveCount;
            choice(rng, Object.assign(base('guided', 'waves'), {
                prompt: 'How many waves?',
                why: `Groups more than ${R.waveGapNm} nm apart along the threat axis (trainer value) are separate waves. There are ${w}: the leading edge and ${w - 1} follow-on.`
            }), String(w), ['1', '2', '3', '4'].filter(x => x !== String(w)), { ordered: (a, b) => a - b });
            const le = f.label || (f.leadingEdgeCount === 1 ? 'SINGLE GROUP' : null);
            if (le && LABEL_RULES[le]) {
                choice(rng, Object.assign(base('guided', 'le'), {
                    prompt: 'The leading edge is the wave closest to the fighters. Which label does it get?',
                    why: `LEADING EDGE ${f.leadingEdgeCount === 1 ? 'SINGLE GROUP' : `${words(f.leadingEdgeCount)} GROUP${f.leadingEdgeCount > 1 ? 'S' : ''} ${le}`}: ${LABEL_RULES[le]}.`
                }), le, ['AZIMUTH', 'RANGE', 'WALL', 'LADDER', 'CHAMPAGNE', 'VIC', 'BOX'].filter(x => x !== le).slice(0, 6), { max: 3 });
            }
            const sep = (text.match(/SECOND WAVE SEPARATION ([A-Z-]+)/) || [])[1];
            if (sep) {
                choice(rng, Object.assign(base('guided', 'sep'), {
                    prompt: 'How is the second wave introduced?',
                    why: 'Give its SEPARATION: the shortest distance along the threat axis back from the leading edge (the SEP bracket), then the wave\'s own label.'
                }), `SECOND WAVE SEPARATION ${sep}`, [`SECOND WAVE, ${sep} DEEP`, `SECOND WAVE, ${sep} WIDE`, 'SECOND WAVE, TRAIL GROUP']);
            }
        },
        (f, key) => [
            { k: 'groups', kind: 'num', label: 'Total groups', v: f.groupCount, tol: 0 },
            { k: 'waves', kind: 'num', label: 'Waves', v: f.waveCount, tol: 0 },
            { k: 'le', kind: 'num', label: 'Groups in the leading edge', v: f.leadingEdgeCount, tol: 0 },
            anchorField(key, 'BULLSEYE of a leading-edge group'),
            { k: 'track', kind: 'select', label: 'Track', options: TRACK_OPTIONS, v: trackValue(f) }
        ]);

    // PACKAGES.
    pictureRun('m5', ['packages'], 15, key => key.family === 'packages',
        ({ rng, base, f, text }) => {
            choice(rng, Object.assign(base('guided', 'count'), {
                prompt: 'How many packages?',
                why: `Bodies of groups more than ${R.packageGapNm} nm apart across the axis (trainer value) are separate packages: ${words(f.packageCount)} PACKAGES.`
            }), String(f.packageCount), ['1', '2', '3', '4'].filter(x => x !== String(f.packageCount)), { ordered: (a, b) => a - b });
            choice(rng, Object.assign(base('guided', 'sep'), {
                prompt: 'Which opening is correct?',
                why: `Open with the package count and the separation between them (the AZIMUTH bracket: ${f.width} nm), then a BULLSEYE for each package.`
            }), `TWO PACKAGES AZIMUTH ${words(f.width)}`, [`TWO PACKAGES AZIMUTH ${words(f.width + 10)}`, `TWO PACKAGES RANGE ${words(f.width)}`, `TWO GROUPS AZIMUTH ${words(f.width)}`]);
            const names = (text.match(/([A-Z]+) PACKAGE BULLSEYE/g) || []).map(s => s.replace(' BULLSEYE', ''));
            if (names.length === 2) {
                const right = `${names[0]} PACKAGE and ${names[1]} PACKAGE`.replace(/ PACKAGE PACKAGE/g, ' PACKAGE');
                choice(rng, Object.assign(base('guided', 'names'), {
                    prompt: 'What are the packages called?',
                    why: 'Packages are named by their side across the threat axis.'
                }), right, ['LEAD PACKAGE and TRAIL PACKAGE', 'FIRST PACKAGE and SECOND PACKAGE', 'EAST PACKAGE and WEST PACKAGE']);
            }
        },
        (f, key) => [
            { k: 'packages', kind: 'num', label: 'Packages', v: f.packageCount, tol: 0 },
            { k: 'sep', kind: 'num', label: 'Separation (nm)', v: f.width, tol: TOL.dimensionNm },
            anchorField(key, 'BULLSEYE of either package')
        ]);
}

// ------------------------------------------------------------------ module 6

const MANEUVER_CATS = ['azimuth', 'range', 'wall', 'ladder', 'champagne', 'vic', 'box', 'random'];

function buildM6() {
    eachRun(MANEUVER_CATS, 8, ({ o, run, rng, id }) => {
        const { scope, anim, director, recorder } = run;
        const picture = grader.buildAnswer(scope.tracks, { mode: null }, o);
        if (!picture.answerKey || !director.commit(picture, anim.simTime)) return;
        anim.resumeRun();
        const history = [strip(picture.text)];
        const names = picture.named.map(n => n.name);

        while (director.phase === 'maneuvers') {
            const seen = fly(anim, recorder, 240, () => !!director.pending(scope.tracks) || director.phase !== 'maneuvers');
            if (!seen || director.phase !== 'maneuvers') break;
            const m = director.pending(scope.tracks);
            let answer = null;
            for (let waited = 0; waited < SNAPSHOT.settleMaxSec; waited += 5) {
                if (waited >= SNAPSHOT.settleSec) {
                    answer = grader.buildManeuverAnswer(scope.tracks, director);
                    if (answer.answerKey && answer.answerKey.fields.maneuver === m.type) break;
                    answer = null;
                }
                if (anim.paused) break;
                fly(anim, recorder, 5);
            }
            if (!answer || !answer.answerKey || answer.answerKey.fields.maneuver !== m.type) break;
            const n = director.called + 1;
            const text = strip(answer.text);
            const key = answer.answerKey;
            const f = key.fields;
            const ms = maneuverMeasurements(scope.tracks, director);
            const sc = addScene(`m6-${id}-m${n}`, run.orient, scope.tracks.filter(t => !t.isDormant), recorder, ms, false);
            const lead = scope.tracks.find(t => t.id === m.leadId) || scope.tracks.find(t => t.id === m.parentLeadId);
            const ref = director.fighterReference(scope.tracks);
            const offDeg = lead ? Math.round(T.Geo.angleDiff(lead.heading, T.Geo.bearingRange(lead, ref).bearing)) : null;
            const others = names.filter(x => x !== f.groupName);
            const ctx = { fields: f, offDeg, trackCardinal: lead ? cardinalOf(lead.heading) : 'EAST', groupName: f.groupName, otherName: others[0] };
            const base = (s, k) => ({ id: `m6-${id}-m${n}-${k}`, m: 'm6', s, sc, call: text, ctx: history.slice() });
            const callsign = lead ? lead.callsign : '';

            if (others.length) {
                choice(rng, Object.assign(base('guided', 'which'), {
                    prompt: 'Which group has maneuvered? Use the names from the picture above.',
                    why: `${f.groupName} (${callsign}): its radar plots bend away and the readout puts it furthest off the fighters. Keep the name it was given in the picture.`
                }), f.groupName, shuffle(rng, others));
            }
            if (f.maneuver === 'SPLIT') {
                choice(rng, Object.assign(base('guided', 'what'), {
                    prompt: `What has ${f.groupName} done?`,
                    why: 'One contact has moved more than 3 nm from the rest: the group has split into two groups.'
                }), 'SPLIT', ['FLANK', 'BEAM', 'DRAG'], { ordered: (a, b) => ['SPLIT', 'FLANK', 'BEAM', 'DRAG'].indexOf(a) - ['SPLIT', 'FLANK', 'BEAM', 'DRAG'].indexOf(b) });
                const pieces = key.anchors.map(a => a.name);
                choice(rng, Object.assign(base('guided', 'pieces'), {
                    prompt: `What are the two new groups called?`,
                    why: `Put the side across the threat axis in front of the old name: ${pieces.join(' and ')}.`
                }), pieces.join(' and '), [`${f.groupName} ONE and ${f.groupName} TWO`, 'LEAD GROUP and TRAIL GROUP', 'NORTH GROUP and SOUTH GROUP', 'EAST GROUP and WEST GROUP'].filter(x => x !== pieces.join(' and ')));
            } else {
                choice(rng, Object.assign(base('guided', 'aspect'), {
                    prompt: `${f.groupName} has turned. What is its aspect to the fighters?`,
                    why: `It is ${offDeg}° off pointing at the fighters (readout). HOT to ${R.aspectDeg.hot}°, FLANK to ${R.aspectDeg.flank}°, BEAM to ${R.aspectDeg.beam}°, DRAG beyond: ${f.maneuver}.`
                }), f.maneuver, ASPECTS.filter(a => a !== f.maneuver), { ordered: (a, b) => ASPECTS.indexOf(a) - ASPECTS.indexOf(b) });
                if (f.direction) {
                    choice(rng, Object.assign(base('guided', 'dir'), {
                        prompt: `${f.groupName} is ${f.maneuver}. Which direction goes after it?`,
                        why: `FLANK, BEAM and DRAG carry the cardinal the group now tracks: its arrow points ${f.direction}.`
                    }), f.direction, [reciprocal(f.direction), CARDINALS[(CARDINALS.indexOf(f.direction) + 2) % 8], CARDINALS[(CARDINALS.indexOf(f.direction) + 6) % 8]]);
                }
            }
            fullCallChoice(rng, base('guided', 'call'), text, ctx);
            errorSpot(rng, base('guided', 'err'), text, ctx);

            const fields = [
                { k: 'group', kind: 'select', label: 'Group', options: names.filter((x, i, a) => a.indexOf(x) === i), v: f.groupName },
                { k: 'maneuver', kind: 'select', label: 'Maneuver', options: ASPECTS.concat(['SPLIT']), v: f.maneuver },
                { k: 'dir', kind: 'select', label: 'Direction', options: ['(none)'].concat(CARDINALS), v: f.direction || '(none)' }
            ];
            if (f.maneuver === 'SPLIT') fields.push(anchorField(key, 'BULLSEYE of either new group'));
            if (fields[0].options.includes(f.groupName)) {
                add(Object.assign(base('build', 'fields'), {
                    t: 'fields', prompt: 'Build the maneuver call.', fields,
                    why: f.maneuver === 'SPLIT'
                        ? 'A SPLIT gives no direction; each new group gets its own BULLSEYE.'
                        : `${f.maneuver}${f.direction ? ` ${f.direction}` : ''}: aspect off the fighters, then the cardinal it tracks (none after HOT).`
                }));
            }
            soloCall(base('solo', 'solo'), text, 'A group has maneuvered since the picture above. Make the call.');

            history.push(text);
            if (f.maneuver === 'SPLIT') key.anchors.forEach(a => names.push(a.name));
            director.markCalled(anim.simTime, scope.tracks);
            if (anim.paused) break;
        }
    });
}

// ------------------------------------------------------------------ module 7

const REQUEST_CATS = ['azimuth', 'range', 'wall', 'ladder', 'champagne', 'vic', 'random'];

function braaFields(key, fighter) {
    return [
        { k: 'brg', kind: 'bearing', label: `BRAA bearing from ${fighter}`, v: key.fields.braaBearing, tol: TOL.bearingDeg },
        { k: 'rng', kind: 'num', label: 'BRAA range (nm)', v: key.fields.braaRange, tol: TOL.rangeNm },
        { k: 'alt', kind: 'num', label: 'Altitude (thousands of ft)', v: key.fields.altitude, tol: TOL.altitudeK },
        { k: 'aspect', kind: 'select', label: 'Aspect', options: ASPECTS.concat(['CAP']), v: key.fields.aspect }
    ];
}

function buildM7() {
    // THREAT: a pop-up group meets THREAT criteria; call it to the closest fighter.
    eachRun(['threat'], 15, ({ o, run, tracks, rng, id }) => {
        const meta = run.scenario.meta;
        const ans = grader.buildAnswer(tracks, meta, o);
        if (!ans.answerKey || ans.answerKey.family !== 'braa') return;
        const text = strip(ans.text);
        const fighter = text.split(',')[0];
        const ms = pictureMeasurements(ans, meta, run.orient, tracks);
        const sc = addScene(`m7-${id}-t`, run.orient, tracks, run.recorder, ms, true);
        const base = (s, k) => ({ id: `m7-${id}-t-${k}`, m: 'm7', s, sc, call: text, info: 'A pop-up group meets THREAT criteria.' });
        const nearest = ms && ms.rows && ms.rows[0];
        choice(rng, Object.assign(base('guided', 'who'), {
            prompt: 'Which fighter gets the THREAT call?',
            why: `The closest fighter: ${nearest ? nearest.trim().replace(/\s+/g, ' ') : fighter} (readout). THREAT calls go in BRAA from that fighter.`
        }), fighter, shuffle(rng, fighterCallsigns(tracks).filter(c => c !== fighter)));
        const aspect = (text.match(/, (HOT|FLANK [A-Z]+|BEAM [A-Z]+|DRAG [A-Z]+), HOSTILE/) || [])[1];
        if (aspect) {
            const c = aspect.split(' ')[1] || 'EAST';
            choice(rng, Object.assign(base('guided', 'aspect'), {
                prompt: `What is the THREAT group's aspect to ${fighter}?`,
                why: `${aspect}: the group's heading relative to the bearing to ${fighter}.`
            }), aspect, ['HOT', `FLANK ${c}`, `BEAM ${c}`, `DRAG ${c}`]);
        }
        fullCallChoice(rng, base('guided', 'call'), text, { fields: ans.answerKey.fields, trackCardinal: 'WEST' });
        errorSpot(rng, base('guided', 'err'), text, { fields: ans.answerKey.fields, trackCardinal: 'WEST' });
        add(Object.assign(base('build', 'fields'), {
            t: 'fields', prompt: 'Build the THREAT call.',
            fields: [{ k: 'who', kind: 'select', label: 'Fighter', options: fighterCallsigns(tracks), v: fighter }].concat(braaFields(ans.answerKey, 'that fighter')),
            why: 'THREAT: to the closest fighter, BRAA from that fighter, altitude, aspect, declaration.'
        }));
        soloCall(base('solo', 'solo'), text, 'Make the THREAT call.');
    });

    // BOGEY DOPE, MUSIC and STROBE on ordinary pictures, asked by a random fighter.
    eachRun(REQUEST_CATS, 6, ({ o, run, tracks, groups, rng, id }) => {
        const fighters = tracks.filter(t => !t.hostile && t.type === 'fighter');
        if (!fighters.length || !groups.length) return;
        ['bogey_dope', 'ea_music', 'ea_strobe'].forEach(mode => {
            const asker = pick(rng, fighters);
            const meta = { mode, requesterId: asker.id };
            const ans = grader.buildAnswer(tracks, meta, o);
            const key = ans.answerKey;
            if (!key || !ans.prompt) return;
            const text = strip(ans.text);
            const req = strip(ans.prompt);
            const ms = pictureMeasurements(ans, meta, run.orient, tracks);
            const sc = addScene(`m7-${id}-${mode}`, run.orient, tracks, run.recorder, ms, true);
            const base = (s, k) => ({ id: `m7-${id}-${mode}-${k}`, m: 'm7', s, sc, call: text, req });
            const ctx = { fields: key.fields, trackCardinal: 'WEST' };
            const byRange = groups.map(g => ({ g, r: T.Geo.distance(asker, g.centroid), b: T.Geo.bearingRange(asker, g.centroid).bearing }))
                .sort((a, b) => a.r - b.r);
            const leadNames = byRange.map(x => leadOfGroup(x.g).callsign);

            if (mode === 'bogey_dope') {
                if (byRange.length > 1 && byRange[1].r - byRange[0].r > 3) {
                    choice(rng, Object.assign(base('guided', 'which'), {
                        prompt: `Which group do you give ${asker.callsign}?`,
                        why: `BOGEY DOPE asks for the nearest group to that fighter: ${leadNames[0]}'s group at ${Math.round(byRange[0].r)} nm (readout).`
                    }), leadNames[0], leadNames.slice(1, 4));
                }
                fullCallChoice(rng, base('guided', 'call'), text, ctx);
                add(Object.assign(base('build', 'fields'), {
                    t: 'fields', prompt: 'Build the BOGEY DOPE answer.', fields: braaFields(key, asker.callsign),
                    why: `BRAA from ${asker.callsign} to the nearest group, altitude, aspect.`
                }));
                soloCall(base('solo', 'solo'), text, 'Answer the fighter.');
            } else if (mode === 'ea_music') {
                choice(rng, Object.assign(base('guided', 'format'), {
                    prompt: 'How do you answer MUSIC?',
                    why: 'MUSIC: anchor the named group off BULLSEYE with altitude, track and declaration.'
                }), 'BULLSEYE, altitude, track, declaration', ['BRAA from the fighter', 'Range and altitude only', 'CLEAN']);
                fullCallChoice(rng, base('guided', 'call'), text, ctx);
                add(Object.assign(base('build', 'fields'), {
                    t: 'fields', prompt: 'Build the MUSIC answer.',
                    fields: [anchorField(key, 'BULLSEYE of the named group'),
                        { k: 'track', kind: 'select', label: 'Track', options: TRACK_OPTIONS, v: key.fields.track === 'CAP' ? 'CAP' : `TRACK ${key.fields.track}` }],
                    why: 'Anchor the group the fighter named, off BULLSEYE.'
                }));
                soloCall(base('solo', 'solo'), text, 'Answer the fighter.');
            } else {
                const strobe = Number((req.match(/STROBE (\d{3})/) || [])[1]);
                const along = byRange.filter(x => T.Geo.angleDiff(x.b, strobe) <= R.strobeCorrelationDeg);
                if (along.length && byRange.length > 1) {
                    const target = leadOfGroup(along[0].g).callsign;
                    choice(rng, Object.assign(base('guided', 'which'), {
                        prompt: `Which group answers ${asker.callsign}'s STROBE ${pad3(strobe)}?`,
                        why: `The closest group within ${R.strobeCorrelationDeg}° of the strobe bearing: ${target}'s group, bearing ${pad3(along[0].b)} at ${Math.round(along[0].r)} nm.`
                    }), target, leadNames.filter(x => x !== target).slice(0, 3));
                }
                fullCallChoice(rng, base('guided', 'call'), text, ctx);
                add(Object.assign(base('build', 'fields'), {
                    t: 'fields', prompt: 'Build the STROBE answer.',
                    fields: [
                        { k: 'rng', kind: 'num', label: 'STROBE range (nm)', v: key.fields.strobeRange, tol: TOL.rangeNm },
                        { k: 'alt', kind: 'num', label: 'Altitude (thousands of ft)', v: key.fields.altitude, tol: TOL.altitudeK }
                    ],
                    why: `Range and altitude of the closest group within ${R.strobeCorrelationDeg}° of the strobe, then declaration and its name.`
                }));
                soloCall(base('solo', 'solo'), text, 'Answer the fighter.');
            }
        });
    });
}

// ------------------------------------------------------------------ module 9

const CHECKRIDE_PER_MODULE = 36;

/** The checkride re-asks build and solo questions from modules 2-8 with measurements off. */
function buildM9() {
    const rng = rngFor('checkride');
    ['m2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'].forEach(m => {
        const pool = questions.filter(q => q.m === m && (q.s === 'build' || q.s === 'solo') && q.t !== 'order');
        shuffle(rng, pool).slice(0, CHECKRIDE_PER_MODULE).forEach(q => {
            add(Object.assign({}, q, { id: `m9-${q.id}`, m: 'm9', s: 'checkride', noMs: 1 }));
        });
    });
}

module.exports = { buildM5, buildM6, buildM7, buildM9 };
