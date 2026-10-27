/**
 * Hand-written content for the WD from Zero course: module list, lessons, and the
 * module 1 (brevity and call format) question bank.
 *
 * Everything here is paraphrased from kb/03_Notes_And_Insights/Picture_Call_Logic.md
 * (re-aligned to the ALSSA comm-standard extract) and the Picture Trainer's own rules.
 * That note is marked "needs your re-review", so every written item carries `src` and
 * the course shows an instructor-review banner. Do not add material from the
 * "Research Document" notes (Tactical_Range_Calls, ROE_Declarations): they disagree
 * with the ALSSA note.
 *
 * Lesson blocks: { h } heading, { p } paragraph, { ul: [] } list, { call } example call,
 * { note } aside. Text is plain: the page escapes it.
 */
const PCL = 'kb/03_Notes_And_Insights/Picture_Call_Logic.md';

const STAGES = {
    guided: { title: 'Guided', blurb: 'Multiple choice, measurements drawn on the scope.' },
    build: { title: 'Build the call', blurb: 'Type the pieces of the call: bearings, ranges, altitudes, labels.' },
    solo: { title: 'Solo', blurb: 'Make the whole call, measurements off. Compare and mark yourself honestly.' },
    check: { title: 'Check', blurb: 'Type what the scope shows.' },
    checkride: { title: 'Checkride', blurb: 'Twenty mixed calls, measurements off.', len: 20, pass: 17 }
};

const MODULES = [
    {
        id: 'm0',
        title: 'Reading the scope',
        goal: 'Read symbols, tags, track direction and contacts; count groups with the 3 nm rule.',
        stages: ['guided', 'check'],
        lesson: [
            { p: 'Every card is a still of the scope. Before you can call a picture you have to read it. Throughout the course the threat comes from the west and raids track east.' },
            { h: 'Symbols' },
            { ul: [
                'Red diamond: hostile track. Green circle: friendly fighter.',
                'The short line with an arrowhead is the track\'s heading: where it is going.',
                'The fading dots behind a track are its radar plots over the last ~30 seconds, showing where it has been.',
                'BULLSEYE is the green crosshair: the reference point every BULLSEYE position is measured from.',
                'The dashed red line is the threat axis: the direction the threat comes from.'
            ] },
            { h: 'Data tags' },
            { p: 'The lead of each group carries a tag: callsign, BULLSEYE position and altitude.' },
            { call: 'BANDIT2\n266/97  30k' },
            { ul: [
                'Line 1: callsign.',
                'Line 2: BULLSEYE bearing / range. 266/97 is bearing 266°, 97 nm from BULLSEYE.',
                'Line 2, last: altitude in thousands of feet. 30k is thirty thousand.'
            ] },
            { h: 'Groups and contacts' },
            { ul: [
                'Contacts within 3 nm of each other are one GROUP.',
                'Wingmen sit under 2 nm from their lead and have no tag. Use Raid close-up to count them.',
                'A group of two is called TWO CONTACTS; three or more is HEAVY.'
            ] },
            { note: 'Grid squares and the scale bar (bottom right) give distance. The north arrow is top left.' }
        ]
    },
    {
        id: 'm1',
        title: 'Brevity and call format',
        goal: 'Know the order of a call and the words that go in each slot.',
        stages: ['guided', 'build'],
        lesson: [
            { h: 'Core information, in order' },
            { p: 'Every group is described in the same order:' },
            { call: 'total groups → location → altitude → track / aspect → declaration → fill-ins' },
            { h: 'Location: BULLSEYE or BRAA' },
            { ul: [
                'BULLSEYE 270/80: bearing / range from the BULLSEYE point. Used in pictures. Never shortened to "BULLS": it gets heard as BRAA.',
                'BRAA 275/45: bearing / range from one specific fighter. Used when the call is for that fighter: BRAA requests, BOGEY DOPE, SNAPLOCK, THREAT.'
            ] },
            { h: 'Altitude' },
            { p: 'To the nearest thousand feet, in words: THIRTY-TWO THOUSAND. Controllers do not substitute HIGH or LOW.' },
            { h: 'Track and aspect' },
            { ul: [
                'With a BULLSEYE call: a cardinal or sub-cardinal, such as TRACK EAST, TRACK SOUTHWEST.',
                'With a BRAA call, aspect to the fighter: HOT, FLANK, BEAM, DRAG (FLANK / BEAM / DRAG add a cardinal).',
                'An orbiting group: CAP replaces the track.',
                'If every group tracks the same way, say it once, after the label.'
            ] },
            { h: 'Declaration and fill-ins' },
            { ul: [
                'Declaration is required with a BULLSEYE or BRAA call: BOGEY, FRIENDLY, NEUTRAL, BANDIT or HOSTILE.',
                'Strength is a fill-in: TWO CONTACTS, or HEAVY for three or more. One contact is assumed, so say nothing.'
            ] },
            { h: 'Five ways to communicate a picture' },
            { ul: ['Core information', 'Traditional labels', 'LEADING EDGE', 'WAVES', 'PACKAGES'] },
            { call: 'WARRIOR, SINGLE GROUP BULLSEYE 180/30, TWENTY-TWO THOUSAND, CAP, HOSTILE.' }
        ]
    },
    {
        id: 'm2',
        title: 'Single group: BULLSEYE and BRAA',
        goal: 'Call one group off BULLSEYE, and answer a fighter\'s BOGEY DOPE in BRAA.',
        stages: ['guided', 'build', 'solo'],
        lesson: [
            { h: 'Single group picture' },
            { p: 'One known group: SINGLE GROUP, its BULLSEYE, altitude, track, declaration, and strength if more than one contact.' },
            { call: 'WARRIOR, SINGLE GROUP BULLSEYE 270/80, THIRTY THOUSAND, TRACK EAST, HOSTILE, TWO CONTACTS.' },
            { ul: [
                'The BULLSEYE position is the group\'s, read from the lead\'s tag (close enough: ±5° / ±3 nm).',
                'TRACK is the cardinal the heading arrow points to: EAST, NORTHEAST…',
                'Orbiting (the radar plots curve round): CAP instead of TRACK.'
            ] },
            { h: 'BOGEY DOPE: answer in BRAA' },
            { p: 'A fighter asks for the nearest group to itself. Answer to that fighter, in BRAA from that fighter, with aspect instead of track:' },
            { call: '"WARRIOR, VIPER21, BOGEY DOPE"\n"VIPER21, GROUP BRAA 275/45, THIRTY THOUSAND, HOT, HOSTILE"' },
            { ul: [
                'Bearing / range is from the fighter to the group. The measurement box shows it.',
                'Aspect is how the group is pointed relative to the fighter. The trainer\'s bands: HOT within 30° of pointing straight at it, FLANK to 60°, BEAM to 110°, DRAG beyond.',
                'FLANK, BEAM and DRAG carry the group\'s cardinal: FLANK NORTH.'
            ] }
        ]
    },
    {
        id: 'm3',
        title: 'Two groups: AZIMUTH or RANGE',
        goal: 'Label two groups, name them, give the dimension and the right anchors.',
        stages: ['guided', 'build', 'solo'],
        lesson: [
            { h: 'Measure along the threat axis' },
            { ul: [
                'WIDE is measured across the threat axis; DEEP is measured along it.',
                'The lead group is the one closest to the fighters.'
            ] },
            { h: 'AZIMUTH: wider than deep' },
            { call: 'WARRIOR, TWO GROUPS AZIMUTH TWENTY, TRACK EAST. NORTH GROUP BULLSEYE 285/92, THIRTY-TWO THOUSAND, HOSTILE. SOUTH GROUP BULLSEYE 265/90, THIRTY THOUSAND, HOSTILE.' },
            { ul: [
                'Groups are named by side across the threat axis: NORTH / SOUTH GROUP.',
                'Both are anchored (given a BULLSEYE) only when they are more than 10 nm apart; otherwise only the first.'
            ] },
            { h: 'RANGE: deeper than wide' },
            { call: 'WARRIOR, TWO GROUPS RANGE TWENTY, TRACK EAST. LEAD GROUP BULLSEYE 270/85, TWENTY-FIVE THOUSAND, HOSTILE. TRAIL GROUP, TWENTY-EIGHT THOUSAND, HOSTILE.' },
            { ul: [
                'LEAD GROUP (closest to the fighters) gets the BULLSEYE; TRAIL GROUP takes its position from the lead and the range.'
            ] },
            { note: 'On the cards, the blue brackets give WIDE and DEEP. Compare them: the bigger one decides the label.' }
        ]
    },
    {
        id: 'm4',
        title: 'Three or more: WALL, LADDER, CHAMPAGNE, VIC',
        goal: 'Pick the label from geometry and the 5 nm depth rule; voice the right dimensions and names.',
        stages: ['guided', 'build', 'solo'],
        lesson: [
            { h: 'The 5 nm depth rule' },
            { p: 'With three or more groups, total depth of 5 nm or less is a WALL. Deeper than that, look at how the groups are arranged.' },
            { h: 'Labels' },
            { ul: [
                'WALL: three or more abreast, depth ≤ 5 nm. Voice WIDE. Outer groups by side (NORTH / SOUTH), inner groups MIDDLE.',
                'LADDER: three or more in trail. Voice the total DEEP. LEAD, MIDDLE / SECOND, THIRD…, TRAIL.',
                'CHAMPAGNE: three groups, two abreast in front and one in trail. WIDE then DEEP. NORTH / SOUTH LEAD GROUP, TRAIL GROUP.',
                'VIC: three groups, one in front and two abreast in trail. DEEP then WIDE. LEAD GROUP, NORTH / SOUTH TRAIL GROUP.'
            ] },
            { call: 'WARRIOR, THREE GROUP WALL, THIRTY WIDE, TRACK EAST. NORTH GROUP BULLSEYE 285/92, THIRTY-TWO THOUSAND, HOSTILE. MIDDLE GROUP, THIRTY THOUSAND, HOSTILE. SOUTH GROUP BULLSEYE 255/90, THIRTY-TWO THOUSAND, HOSTILE, TWO CONTACTS.' },
            { call: 'WARRIOR, THREE GROUP VIC, FIFTEEN DEEP, TWENTY WIDE, TRACK EAST. LEAD GROUP BULLSEYE 270/80, TWENTY-EIGHT THOUSAND, HOSTILE. NORTH TRAIL GROUP, TWENTY-FIVE THOUSAND, HOSTILE. SOUTH TRAIL GROUP, TWENTY-EIGHT THOUSAND, HOSTILE.' },
            { h: 'Anchoring' },
            { p: 'Anchor the highest-priority group first: closest to the fighters, then most capable, highest, largest. With several abreast, anchor the outermost. Groups in trail take their position from the lead group and the dimension.' }
        ]
    },
    {
        id: 'm5',
        title: 'BOX, LEADING EDGE, WAVES, PACKAGES',
        goal: 'Call four-group boxes, split a deep raid into a leading edge and waves, and call packages.',
        stages: ['guided', 'build', 'solo'],
        lesson: [
            { h: 'BOX' },
            { p: 'Four groups: two abreast in front, two abreast behind. Voice WIDE, then DEEP. Names: NORTH / SOUTH LEAD GROUP in front, NORTH / SOUTH TRAIL GROUP behind.' },
            { h: 'LEADING EDGE and WAVES' },
            { p: 'Use them when the whole raid does not fit one label, to shorten a complicated picture, or to get the priority groups targeted quickly.' },
            { ul: [
                'Total groups first, then LEADING EDGE and a traditional label for the groups the fighters will employ on.',
                'Follow-on groups are waves: SECOND WAVE, THIRD WAVE, each with its own label.',
                'Give each wave its SEPARATION: the shortest distance along the threat axis back from the wave in front (the SEP bracket on the cards).'
            ] },
            { call: 'WARRIOR, EIGHT GROUPS, LEADING EDGE THREE GROUP CHAMPAGNE, FIFTEEN WIDE, TWELVE DEEP, TRACK EAST. NORTH LEAD GROUP BULLSEYE … SECOND WAVE SEPARATION THIRTY, FIVE GROUP WALL, FORTY WIDE.' },
            { note: 'How deep a leading edge runs is set in mission planning. This trainer breaks a wave at more than 25 nm of depth.' },
            { h: 'PACKAGES' },
            { p: 'Bodies of groups outside the briefed bounding limits are separate packages (waves differ from packages by their depth). Give the count and separation, a BULLSEYE for each package, then each package\'s own picture.' },
            { call: 'WARRIOR, TWO PACKAGES AZIMUTH SIXTY, NORTH PACKAGE BULLSEYE 290/100, SOUTH PACKAGE BULLSEYE 250/105.' },
            { note: 'Bounding limits are mission-planned. This trainer breaks packages at more than 40 nm across the threat axis.' }
        ]
    },
    {
        id: 'm6',
        title: 'Aspect and maneuvers',
        goal: 'Call a group that turns or splits after the picture, by the name it was given.',
        stages: ['guided', 'build', 'solo'],
        lesson: [
            { p: 'Groups keep flying after the picture, and they maneuver. Once the picture is called the group names are locked: a wall whose north group turns away is still NORTH / MIDDLE / SOUTH GROUP. Call the maneuver by the name the group already has; do not re-label or re-call the picture.' },
            { h: 'Format' },
            { call: '[group name], [aspect] [cardinal]' },
            { ul: [
                'Aspect is relative to the friendly fighters, in the same bands as BRAA. The trainer\'s bands: HOT within 30°, FLANK to 60°, BEAM to 110°, DRAG beyond. The cards\' readout gives each group\'s angle off the fighters.',
                'FLANK, BEAM and DRAG carry the new track direction. HOT stands alone.',
                'A lone group is just GROUP. In a packages picture the package name is part of the group\'s name.'
            ] },
            { call: 'WARRIOR, NORTH GROUP, FLANK NORTH\nWARRIOR, LEAD GROUP, DRAG WEST\nWARRIOR, NORTH GROUP, HOT' },
            { h: 'SPLIT' },
            { p: 'A group that divides into two groups more than 3 nm apart has split. Name the group as called, say SPLIT, then give each new group by its new name with BULLSEYE, altitude, track and declaration. The new names put the side across the threat axis in front of the old name (LEAD GROUP becomes NORTH LEAD GROUP and SOUTH LEAD GROUP).' },
            { call: 'WARRIOR, LEAD GROUP SPLIT. NORTH LEAD GROUP BULLSEYE 275/80, THIRTY THOUSAND, TRACK NORTHEAST, HOSTILE. SOUTH LEAD GROUP BULLSEYE 272/77, THIRTY THOUSAND, TRACK EAST, HOSTILE.' },
            { note: 'The source note asks for the maneuver and SPLIT formats to be checked against the ALSSA maneuver paragraph before treating them as doctrine.' }
        ]
    },
    {
        id: 'm7',
        title: 'Fighter requests: THREAT, BOGEY DOPE, MUSIC, STROBE',
        goal: 'Answer the fighter who asked, in the format the request needs.',
        stages: ['guided', 'build', 'solo'],
        lesson: [
            { h: 'THREAT' },
            { p: 'An unreported group meets the briefed THREAT criteria: call it to the closest fighter, in BRAA from that fighter.' },
            { call: 'RAPTOR12, THREAT GROUP BRAA 270/13, FIVE THOUSAND, HOT, HOSTILE' },
            { h: 'BOGEY DOPE' },
            { p: 'The nearest group to the fighter that asked, in BRAA from that fighter. It does not imply targeting.' },
            { call: '"WARRIOR, RAPTOR11, BOGEY DOPE"\n"RAPTOR11, GROUP BRAA 275/45, THIRTY THOUSAND, HOT, HOSTILE"' },
            { h: 'STROBE' },
            { p: 'Range, altitude, declaration and group name of the closest group along that bearing. Correlate within ±30°; answer CLEAN if nothing correlates.' },
            { call: '"RAPTOR11, STROBE 285"\n"RAPTOR11, STROBE RANGE THIRTY-SEVEN, TWENTY-FIVE THOUSAND, HOSTILE, LEAD GROUP"' },
            { h: 'MUSIC' },
            { p: 'Anchor the named group off BULLSEYE with altitude, track, declaration and fill-ins.' },
            { note: 'METALLICA [group] is informative: no response is required, and the fighter keeps targeting responsibility.' }
        ]
    },
    {
        id: 'm8',
        title: 'DCA flow: commit, targeting, THREAT',
        goal: 'Know what is due on the scope right now: hold, commit, target, or a THREAT call.',
        stages: ['guided', 'build', 'solo'],
        lesson: [
            { p: 'These stills come from the BC3 Scope Trainer, flown with the flights waiting on you at CAP. Each one asks what the WD owes the fighters at that moment.' },
            { h: 'The order things come due' },
            { ul: [
                'PICTURE: when new groups appear.',
                'COMMIT: when the nearest hostile is inside the commit window. "RAPTOR11, COMMIT".',
                'TARGETING: every group, closest first, before it gets close to a fighter. "RAPTOR11, TARGET NORTH GROUP".',
                'THREAT: when an untargeted hostile gets inside the threat range of a fighter, in BRAA to that fighter.'
            ] },
            { h: 'This trainer\'s standards' },
            { ul: [
                'Commit window: nearest hostile 95 to 50 nm from the flight lead. Beyond 95 is early; inside 50 is late. Inside 40 nm the fighters commit themselves.',
                'Targeting: every group before it is within 45 nm of a fighter. A flight with nothing targeted sorts itself at 45 nm.',
                'THREAT: an untargeted hostile inside 15 nm of a fighter, called within 20 seconds.'
            ] },
            { note: 'Commit and targeting ranges are mission-planned in the real world. These are the BC3 trainer\'s defaults (simulator/src/wd_seat.js): use your unit\'s criteria.' }
        ]
    },
    {
        id: 'm9',
        title: 'Checkride',
        goal: 'Twenty mixed calls from modules 2 to 8, measurements off.',
        stages: ['checkride'],
        lesson: [
            { p: 'The checkride mixes build-the-call and solo questions from every module from single group to DCA flow, with the measurements off. Use the Measure tool when you need a distance or bearing.' },
            { p: 'Pass at 17 of 20 (85%). Missed questions go into Review due like any other.' }
        ]
    }
];

/** Shown on the course home as the road ahead. */
const UPCOMING = [];

/** Module 1, guided: one rule per question. `a` is the index of the right choice. */
const M1_CHOICE = [
    { q: 'Contacts within how many nautical miles of each other form one GROUP?', choices: ['3 nm', '5 nm', '10 nm', '1 nm'], a: 0,
        why: 'A GROUP is contacts within 3 nm in azimuth and range of each other.' },
    { q: 'How is the reference point said on the radio?', choices: ['BULLSEYE', 'BULLS', 'Either BULLSEYE or BULLS', 'REFERENCE'], a: 0,
        why: 'BULLSEYE is never shortened to "BULLS" because it gets heard as BRAA.' },
    { q: 'When does a controller use BRAA instead of BULLSEYE?', choices: [
        'When the call is for one specific fighter: BRAA requests, BOGEY DOPE, SNAPLOCK, THREAT',
        'Whenever a group is within 20 nm of BULLSEYE',
        'In every picture call',
        'Only when the fighters ask for it by name'], a: 0,
        why: 'BRAA is bearing / range from one fighter, so it is used when the call is for that fighter.' },
    { q: 'A group is at 31,600 ft. How is its altitude called?', choices: ['THIRTY-TWO THOUSAND', 'HIGH', 'THIRTY-ONE THOUSAND', 'THIRTY-ONE THOUSAND SIX HUNDRED'], a: 0,
        why: 'Altitude goes to the nearest thousand feet; HIGH / LOW is not a substitute for it.' },
    { q: 'In a BULLSEYE call, how is the group\'s direction of travel given?', choices: ['TRACK EAST', 'HOT', 'HEADING ZERO-NINE-ZERO', 'EASTBOUND'], a: 0,
        why: 'BULLSEYE calls use TRACK + cardinal or sub-cardinal. HOT / FLANK / BEAM / DRAG go with BRAA.' },
    { q: 'In a BRAA call, how is the group\'s direction of travel given?', choices: ['Aspect: HOT, FLANK, BEAM or DRAG', 'TRACK + cardinal', 'Heading in degrees', 'Nothing, BRAA has no track'], a: 0,
        why: 'BRAA calls give aspect relative to that fighter.' },
    { q: 'A group is orbiting. What replaces its track?', choices: ['CAP', 'ORBIT', 'HOLDING', 'TRACK CIRCLE'], a: 0,
        why: 'CAP may replace track or aspect for an orbiting group.' },
    { q: 'Every group in a three-group wall tracks east. Where does TRACK EAST go?', choices: [
        'Once, after the label and dimensions',
        'After each group',
        'At the very end of the call',
        'It is left out because the label implies it'], a: 0,
        why: 'When every group tracks the same way, say it once after the label.' },
    { q: 'A group has two contacts. Which fill-in goes with it?', choices: ['TWO CONTACTS', 'HEAVY', 'PAIR', 'Nothing, two is assumed'], a: 0,
        why: 'Single contact is assumed. Say TWO CONTACTS for two, HEAVY for three or more.' },
    { q: 'What does HEAVY mean?', choices: [
        'A group of three or more contacts',
        'A formation weighted to one side',
        'A large aircraft type',
        'A group above forty thousand feet'], a: 0,
        why: 'HEAVY describes a group\'s strength (3+ contacts). A lopsided formation is WEIGHTED.' },
    { q: 'Which of these is a declaration?', choices: ['HOSTILE', 'HEAVY', 'HOT', 'CAP'], a: 0,
        why: 'Declarations: BOGEY, FRIENDLY, NEUTRAL, BANDIT, HOSTILE. One is required with a BULLSEYE or BRAA call.' },
    { q: 'Which is NOT one of the five ways to communicate a picture?', choices: ['SECTORS', 'LEADING EDGE', 'WAVES', 'PACKAGES'], a: 0,
        why: 'The five: core information, traditional labels, LEADING EDGE, WAVES, PACKAGES.' },
    { q: 'WIDE is measured…', choices: ['Across the threat axis', 'Along the threat axis', 'North to south', 'From BULLSEYE'], a: 0,
        why: 'WIDE is across the threat axis; DEEP is along it.' },
    { q: 'DEEP is measured…', choices: ['Along the threat axis', 'Across the threat axis', 'East to west', 'From the fighters'], a: 0,
        why: 'DEEP is along the threat axis.' },
    { q: 'Which group is the "lead" group?', choices: ['The one closest to the fighters', 'The one closest to BULLSEYE', 'The biggest one', 'The highest one'], a: 0,
        why: 'The lead group is the one closest to the fighters.' },
    { q: 'Which group is anchored (given a BULLSEYE) first?', choices: [
        'The highest priority: closest to the fighters, then most capable, highest, largest',
        'The northernmost',
        'The largest',
        'The one closest to BULLSEYE'], a: 0,
        why: 'Anchor priority: closest to the fighters → most capable → highest → largest.' },
    { q: 'Two groups abreast are each given a BULLSEYE when they are…', choices: ['More than 10 nm apart in azimuth', 'More than 3 nm apart', 'At different altitudes', 'Always'], a: 0,
        why: 'Groups abreast are each anchored only when more than 10 nm apart in azimuth.' },
    { q: 'Four or more groups fit no label. What is called?', choices: [
        'The total, then only the three highest-priority groups (core information)',
        'Every group with its BULLSEYE',
        'Only the closest group',
        'PICTURE CLEAN'], a: 0,
        why: 'With four or more groups and no label: give the total, then the three highest-priority groups.' },
    { q: 'What is the first item of core information?', choices: ['Total groups', 'Location', 'Altitude', 'Declaration'], a: 0,
        why: 'Order: total groups → location → altitude → track / aspect → declaration → fill-ins.' },
    { q: 'What comes right after altitude?', choices: ['Track or aspect', 'Declaration', 'Location', 'Strength (TWO CONTACTS)'], a: 0,
        why: 'Order: total groups → location → altitude → track / aspect → declaration → fill-ins.' }
];

/** Module 1, build: put the pieces in order. `parts` are listed in the right order. */
const M1_ORDER = [
    { q: 'Put core information in order.', parts: ['Total groups', 'Location', 'Altitude', 'Track / aspect', 'Declaration', 'Fill-ins'],
        why: 'Total groups → location → altitude → track / aspect → declaration → fill-ins.' },
    { q: 'Build this single group call.', parts: ['WARRIOR', 'SINGLE GROUP BULLSEYE 270/80', 'THIRTY THOUSAND', 'TRACK EAST', 'HOSTILE', 'TWO CONTACTS'],
        why: 'Callsign, then the group in core-information order; strength is the last fill-in.' },
    { q: 'Build the answer to "WARRIOR, VIPER21, BOGEY DOPE".', parts: ['VIPER21', 'GROUP BRAA 275/45', 'THIRTY THOUSAND', 'HOT', 'HOSTILE'],
        why: 'Answer to the fighter, in BRAA from the fighter, with aspect instead of track.' },
    { q: 'Build this two-group picture.', parts: ['WARRIOR', 'TWO GROUPS AZIMUTH TWENTY', 'TRACK EAST', 'NORTH GROUP BULLSEYE 285/92, THIRTY-TWO THOUSAND, HOSTILE', 'SOUTH GROUP BULLSEYE 265/90, THIRTY THOUSAND, HOSTILE'],
        why: 'Total groups and label with its dimension, a common track once, then each group.' },
    { q: 'Build this range picture.', parts: ['WARRIOR', 'TWO GROUPS RANGE TWENTY', 'TRACK EAST', 'LEAD GROUP BULLSEYE 270/85, TWENTY-FIVE THOUSAND, HOSTILE', 'TRAIL GROUP, TWENTY-EIGHT THOUSAND, HOSTILE'],
        why: 'The lead group (closest to the fighters) is anchored; the trail group takes its position from the lead.' }
];

/** Module 1, build: one part of each call breaks a rule. `bad` is the index of that part. */
const M1_ERROR = [
    { parts: ['WARRIOR', 'SINGLE GROUP BULLS 270/80', 'THIRTY THOUSAND', 'TRACK EAST', 'HOSTILE'], bad: 1,
        why: 'BULLSEYE is never shortened to BULLS because it gets heard as BRAA.' },
    { parts: ['WARRIOR', 'SINGLE GROUP BULLSEYE 270/80', 'HIGH', 'TRACK EAST', 'HOSTILE'], bad: 2,
        why: 'Altitude is given to the nearest thousand feet; HIGH / LOW is not a substitute.' },
    { parts: ['VIPER21', 'GROUP BRAA 275/45', 'THIRTY THOUSAND', 'TRACK EAST', 'HOSTILE'], bad: 3,
        why: 'A BRAA call gives aspect (HOT / FLANK / BEAM / DRAG), not TRACK.' },
    { parts: ['WARRIOR', 'SINGLE GROUP BULLSEYE 270/80', 'THIRTY THOUSAND', 'TRACK EAST', 'HOSTILE', 'HEAVY'], bad: 5, context: 'The group has two contacts.',
        why: 'HEAVY is three or more contacts. Two is TWO CONTACTS.' },
    { parts: ['WARRIOR', 'THREE GROUP WALL, THIRTY WIDE', 'HEAVY NORTH', 'TRACK EAST'], bad: 2,
        why: 'A lopsided formation is WEIGHTED (toward a side); HEAVY is a group\'s strength.' },
    { parts: ['WARRIOR', 'SINGLE GROUP BULLSEYE 180/30', 'TWENTY-TWO THOUSAND', 'TRACK CAP', 'HOSTILE'], bad: 3, context: 'The group is orbiting.',
        why: 'CAP replaces the track: "…TWENTY-TWO THOUSAND, CAP, HOSTILE".' }
];

module.exports = { PCL, STAGES, MODULES, UPCOMING, M1_CHOICE, M1_ORDER, M1_ERROR };
