/**
 * Mission event timeline for light scoring / debrief replay data.
 */
class MissionTimeline {
    constructor() {
        this.events = [];
        this.startedAt = null;
    }

    start(scenarioId) {
        this.events = [];
        this.startedAt = Date.now();
        this.log('mission_start', { scenarioId: scenarioId || null });
    }

    log(type, detail = {}) {
        const t = this.startedAt ? Date.now() - this.startedAt : 0;
        this.events.push({ t, type, ...detail, at: new Date().toISOString() });
    }

    logPicture(text) {
        this.log('picture', { text });
    }

    logCommit(trackId, callsign) {
        this.log('commit', { trackId, callsign });
    }

    logFox3(trackId, callsign, detail = {}) {
        this.log('fox3', { trackId, callsign, ...detail });
    }

    logSkosh(trackId, callsign, detail = {}) {
        this.log('skosh', { trackId, callsign, ...detail });
    }

    logSplash(trackId, callsign, detail = {}) {
        this.log('splash', { trackId, callsign, ...detail });
    }

    logCapRecover(trackId, callsign) {
        this.log('cap_recover', { trackId, callsign });
    }

    logDeclaration(trackId, declaration) {
        this.log('declaration', { trackId, declaration });
    }

    logRadarMode(mode) {
        this.log('radar_mode', { mode });
    }

    toJSON() {
        return {
            startedAt: this.startedAt,
            events: this.events
        };
    }

    download(filename) {
        const blob = new Blob([JSON.stringify(this.toJSON(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename || `timeline-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    summaryHtml() {
        const pictures = this.events.filter(e => e.type === 'picture').length;
        const commits = this.events.filter(e => e.type === 'commit').length;
        const decls = this.events.filter(e => e.type === 'declaration').length;
        const fox = this.events.filter(e => e.type === 'fox3').length;
        const skosh = this.events.filter(e => e.type === 'skosh').length;
        const splashEvents = this.events.filter(e => e.type === 'splash');
        const splash = splashEvents.length;
        const splashBlue = splashEvents.filter(e => e.shooterHostile === false).length;
        const splashRed = splashEvents.filter(e => e.shooterHostile === true).length;
        const melds = this.events.filter(e => e.type === 'meld').length;
        const chaff = this.events.filter(e => e.type === 'chaff').length;
        const pitbull = this.events.filter(e => e.type === 'pitbull').length;
        const defeats = this.events.filter(e => e.type === 'missile_defeat').length;
        const winchester = this.events.filter(e => e.type === 'winchester').length;
        const gunKills = this.events.filter(e => e.type === 'gun_kill').length;
        const pursuitAbort = this.events.filter(e => e.type === 'pursuit_abort').length;
        const waveRelease = this.events.filter(e => e.type === 'wave_release').length;
        const wingCommit = this.events.filter(e => e.type === 'wing_commit').length;
        const foxFromMeld = this.events.filter(e => e.type === 'fox_from_meld').length;
        const waveHold = this.events.filter(e => e.type === 'wave_hold').length;
        const targeted = this.events.filter(e => e.type === 'targeted').length;
        const foxHoldEvents = this.events.filter(e => e.type === 'fox_hold');
        const foxHold = foxHoldEvents.length;
        const foxHoldReasons = {};
        foxHoldEvents.forEach(e => {
            const r = e.reason || 'unknown';
            foxHoldReasons[r] = (foxHoldReasons[r] || 0) + 1;
        });
        const foxHoldReasonStr = Object.keys(foxHoldReasons).length
            ? Object.keys(foxHoldReasons).map(k => `${k}:${foxHoldReasons[k]}`).join(' · ')
            : 'none';
        const ordEmpty = this.events.filter(e => e.type === 'ordnance_empty').length;
        const sortAssign = this.events.filter(e => e.type === 'sort_assign').length;
        const sortRetarget = this.events.filter(e => e.type === 'sort_retarget').length;
        const untargeted = this.events.filter(e => e.type === 'untargeted').length;
        return `<p>Events: ${this.events.length}</p>
            <p>Pictures logged: ${pictures}</p>
            <p>Meld: ${melds} · Commits: ${commits} · TARGETED: ${targeted} · FOX3: ${fox} · SKOSH: ${skosh} · SPLASH: ${splash} (blue:${splashBlue} / red:${splashRed})</p>
            <p>CHAFF: ${chaff} · PITBULL: ${pitbull} · MSL DEFEAT: ${defeats} · GUN KILL: ${gunKills}</p>
            <p>SORT assign: ${sortAssign} · SORT retarget: ${sortRetarget} · UNTARGETED: ${untargeted} · Wing commit: ${wingCommit}</p>
            <p>FOX hold: ${foxHold} [${foxHoldReasonStr}] · Winchester: ${winchester} · Pursuit abort: ${pursuitAbort} · Wave release: ${waveRelease} · FOX from MELD: ${foxFromMeld} · Wave hold: ${waveHold} · Ordnance empty: ${ordEmpty}</p>
            <p>Declarations: ${decls}</p>`;
    }
}

if (typeof window !== 'undefined') window.MissionTimeline = MissionTimeline;
