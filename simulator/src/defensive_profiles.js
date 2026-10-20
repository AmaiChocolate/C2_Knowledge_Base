/**
 * Platform defensive + ordnance profiles — unclassified training proxies.
 * See kb/03_Notes_And_Insights/F35_Defensive_Profile.md and Flanker_Adversary_Profile.md
 */
const DEFENSIVE_PROFILES = {
    F35: {
        label: 'F-35',
        detectSupportNm: 40,
        chaffBundles: 4,
        chaffDurationSec: 3,
        chaffEffectiveNm: 12,
        chaffDeployNm: 14,
        chaffRequiresActive: true,
        ecmStrength: 0.35,
        ecmAssistOnly: true,
        // One 3s cloud is enough if notch holds — blues survive terminal R-77 more often
        arhDefeatSecActive: 2.5,
        arhDefeatSecEcm: 5.0,
        maxLeadBleedSec: 4.0,
        breakNm: 12,
        notchMinDeg: 70,
        notchMaxDeg: 110,
        sarhDefeatSec: 2.0,
        coldSpeedFactor: 0.85,
        breakSpeedBoost: 200,
        maxBreakSpeed: 1100,
        turnRateDefend: 6.5,
        ordnance: { FOX3: 4, R77: 0, R27: 0 },
        mergeNm: 8,
        gunMaxNm: 0.45,
        gunAspectDeg: 30,
        gunTrackSec: 2.0,
        gunRounds: 180,
        tacRangeNm: 60,
        blueMeldNm: 80,
        foxMinNm: 8,
        foxMaxNm: 40,
        foxMaxAspectDeg: 60,
        foxMaxAtaDeg: 40,
        foxOuterNm: 30,
        crankShootDeg: 50,
        requireHostileDeclaration: true,
        recommitNm: 50,
        minMissilesForRecommit: 2,
        redDetectVsNm: 40,
        // Where between no-escape range (0) and max aero range (1) the first shot goes
        shotAggression: 0.25
    },
    SU30: {
        label: 'Su-30 Flanker',
        detectSupportNm: 25,
        chaffBundles: 3,
        chaffDurationSec: 2.5,
        chaffEffectiveNm: 8,
        chaffDeployNm: 10,
        chaffRequiresActive: true,
        ecmStrength: 0.15,
        ecmAssistOnly: true,
        // Needs ~2 overlapping 2.5s clouds (5s) — single burst cannot defeat AIM-120
        arhDefeatSecActive: 5.0,
        arhDefeatSecEcm: 8.0,
        maxLeadBleedSec: 4.0,
        breakNm: 15,
        notchMinDeg: 70,
        notchMaxDeg: 110,
        sarhDefeatSec: 2.0,
        coldSpeedFactor: 0.8,
        breakSpeedBoost: 180,
        maxBreakSpeed: 1000,
        turnRateDefend: 6.0,
        ordnance: { FOX3: 0, R77: 4, R27: 2 },
        mergeNm: 10,
        gunMaxNm: 0.55,
        gunAspectDeg: 40,
        gunTrackSec: 2.5,
        gunRounds: 150,
        // R-27 is thrown long to force blue defensive; R-77 is held to near no-escape
        r27Aggression: 0.6,
        r77Aggression: 0.1
    }
};

/**
 * Missile fly-out proxies — the single source for both the missile model
 * (ScopeEngine.spawnMissile) and the pilots' launch / defend decisions.
 */
const MISSILE_PROFILES = {
    FOX3: { type: 'FOX3', guidance: 'ACTIVE', speedKts: 1800, maxFlightSec: 70, activeNm: 8, turnRateDeg: 16, killNm: 1.2 },
    R77: { type: 'R77', guidance: 'ACTIVE', speedKts: 1800, maxFlightSec: 50, activeNm: 10, turnRateDeg: 14, killNm: 1.5 },
    R27: { type: 'FOX1', guidance: 'SARH', speedKts: 1800, maxFlightSec: 55, activeNm: 0, killNm: 1.5, sarhBreakDeg: 60, sarhBreakSec: 3 }
};

function getMissileProfile(type) {
    return MISSILE_PROFILES[ordnanceKey(type)];
}

/** Best speed (kts) and turn rate (deg/s) a track can use to run from a missile. */
function escapePerformance(track) {
    const cruise = track.cruiseSpeed || track.speed || 450;
    if (!track || track.type !== 'fighter') return { dashKts: cruise, turnRate: 1.5 };
    const p = getDefensiveProfile(track);
    return {
        dashKts: Math.min(cruise + (p.breakSpeedBoost || 200), p.maxBreakSpeed || 1100),
        turnRate: p.turnRateDefend || 6
    };
}

/**
 * Range a missile with `flightSec` of flight left can still close on a target that turns
 * tail now and runs: it closes at full speed while the target is turning through
 * `turnDeg`, then only at the speed difference.
 */
function missileNoEscapeNm(missile, target, turnDeg, flightSec) {
    const vm = missile.speedKts / 3600;
    const perf = escapePerformance(target);
    const tTurn = Math.max(0, turnDeg) / perf.turnRate;
    if (flightSec <= tTurn) return vm * flightSec + missile.killNm;
    return vm * tTurn + (vm - perf.dashKts / 3600) * (flightSec - tTurn) + missile.killNm;
}

/**
 * Launch envelope against a target at `targetAspectDeg` (0 = nose on the shooter).
 *   raeroNm — reaches a target that keeps doing what it is doing
 *   rneNm   — reaches a target that turns away and runs the moment it is fired on
 * 10% of flight time is held back for lead and turn losses.
 */
function missileEnvelope(type, target, targetAspectDeg) {
    const m = getMissileProfile(type);
    const flightSec = m.maxFlightSec * 0.9;
    const vm = m.speedKts / 3600;
    const vt = (target.currentSpeed || target.speed || 450) / 3600;
    const ta = Math.max(0, Math.min(180, targetAspectDeg));
    return {
        raeroNm: (vm + vt * Math.cos(ta * Math.PI / 180)) * flightSec + m.killNm,
        rneNm: missileNoEscapeNm(m, target, 180 - ta, flightSec)
    };
}

/** Normalize missile type string to ordnance key. */
function ordnanceKey(type) {
    const t = String(type || 'FOX3').toUpperCase();
    if (t === 'FOX1' || t === 'R27') return 'R27';
    if (t === 'R77') return 'R77';
    return 'FOX3';
}

function getDefensiveProfile(track) {
    const af = String(track && track.airframe ? track.airframe : '').toUpperCase();
    if (af === 'SU30' || af === 'SU-30' || af === 'FLANKER') return DEFENSIVE_PROFILES.SU30;
    if (af === 'F35' || af === 'F-35') return DEFENSIVE_PROFILES.F35;
    if (track && track.hostile) return DEFENSIVE_PROFILES.SU30;
    return DEFENSIVE_PROFILES.F35;
}

function getBlueEmploymentProfile(track) {
    const p = getDefensiveProfile(track);
    return {
        tacRangeNm: p.tacRangeNm != null ? p.tacRangeNm : 60,
        blueMeldNm: p.blueMeldNm != null ? p.blueMeldNm : null,
        foxMinNm: p.foxMinNm != null ? p.foxMinNm : 8,
        foxMaxNm: p.foxMaxNm != null ? p.foxMaxNm : 40,
        foxMaxAspectDeg: p.foxMaxAspectDeg != null ? p.foxMaxAspectDeg : 60,
        foxMaxAtaDeg: p.foxMaxAtaDeg != null ? p.foxMaxAtaDeg : 40,
        foxOuterNm: p.foxOuterNm != null ? p.foxOuterNm : 30,
        crankShootDeg: p.crankShootDeg != null ? p.crankShootDeg : 50,
        requireHostileDeclaration: p.requireHostileDeclaration !== false,
        recommitNm: p.recommitNm != null ? p.recommitNm : 50,
        minMissilesForRecommit: p.minMissilesForRecommit != null ? p.minMissilesForRecommit : 2,
        redDetectVsNm: p.redDetectVsNm != null ? p.redDetectVsNm : 40
    };
}

function initDefensiveStores(track) {
    initAircraftStores(track);
}

/** Init stores only once per sortie unless explicitly reset. */
function ensureAircraftStores(track) {
    if (!track || track._storesInitialized) return;
    initAircraftStores(track);
}

/** Full reset — scenario load only. */
function initAircraftStores(track) {
    const p = getDefensiveProfile(track);
    const base = p.ordnance || { FOX3: 0, R77: 0, R27: 0 };
    track.ordnance = Object.assign({}, base);
    track.ordnanceMax = Object.assign({}, base);
    track.chaffRemaining = p.chaffBundles;
    track.chaffMax = p.chaffBundles;
    track.chaffUntil = 0;
    track.chaffUntilSim = null;
    track.defendNotchTimer = 0;
    track.defendArhTimer = 0;
    track.winchesterLogged = false;
    track.gunSolutionSec = 0;
    track.gunRoundsRemaining = p.gunRounds != null ? p.gunRounds : 0;
    track.hasTargeted = false;
    track._storesInitialized = true;
}

function canFireOrdnance(track, type) {
    if (!track || !track.ordnance) return false;
    const key = ordnanceKey(type);
    return (track.ordnance[key] || 0) > 0;
}

/**
 * @returns {{ ok: boolean, key: string, remaining: number, low: boolean }}
 */
function consumeOrdnance(track, type) {
    const key = ordnanceKey(type);
    if (!track.ordnance || (track.ordnance[key] || 0) <= 0) {
        return { ok: false, key, remaining: 0, low: false };
    }
    track.ordnance[key] -= 1;
    const remaining = track.ordnance[key];
    return { ok: true, key, remaining, low: remaining === 1 };
}

function hasBvrOrdnance(track) {
    if (!track || !track.ordnance) return false;
    const o = track.ordnance;
    return (o.FOX3 || 0) > 0 || (o.R77 || 0) > 0 || (o.R27 || 0) > 0;
}

if (typeof window !== 'undefined') {
    window.DEFENSIVE_PROFILES = DEFENSIVE_PROFILES;
    window.MISSILE_PROFILES = MISSILE_PROFILES;
    window.getMissileProfile = getMissileProfile;
    window.escapePerformance = escapePerformance;
    window.missileNoEscapeNm = missileNoEscapeNm;
    window.missileEnvelope = missileEnvelope;
    window.getDefensiveProfile = getDefensiveProfile;
    window.getBlueEmploymentProfile = getBlueEmploymentProfile;
    window.initDefensiveStores = initDefensiveStores;
    window.ensureAircraftStores = ensureAircraftStores;
    window.initAircraftStores = initAircraftStores;
    window.ordnanceKey = ordnanceKey;
    window.canFireOrdnance = canFireOrdnance;
    window.consumeOrdnance = consumeOrdnance;
    window.hasBvrOrdnance = hasBvrOrdnance;
}
