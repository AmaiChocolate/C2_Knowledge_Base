/**
 * Staged red ingress waves — hybrid release (time delay or prior wave destroyed).
 */
const WaveManager = {
    initScenario(scope, waves) {
        scope.scenarioWaves = waves ? JSON.parse(JSON.stringify(waves)) : [];
        scope.releasedWaveIds = new Set();
    },

    getElapsedSec(scope) {
        const tl = scope.timeline;
        if (tl && tl.startedAt) return (Date.now() - tl.startedAt) / 1000;
        return 0;
    },

    findTracksByCallsign(scope, callsigns) {
        const tracks = scope.truthTracks || [];
        return (callsigns || []).map(cs => tracks.find(t =>
            String(t.callsign || '').toUpperCase() === String(cs).toUpperCase()
        )).filter(Boolean);
    },

    getPriorWave(scope, waveId) {
        const waves = scope.scenarioWaves || [];
        return waves.find(w => w.id === waveId - 1);
    },

    isWaveDestroyed(scope, wave) {
        const tracks = this.findTracksByCallsign(scope, wave.trackIds);
        if (!tracks.length) return false;
        return tracks.every(t => t.isSplashed);
    },

    shouldRelease(scope, wave, elapsedSec) {
        if (scope.releasedWaveIds.has(wave.id)) return false;
        if (elapsedSec >= (wave.releaseAtSec || 0)) return true;
        if (wave.releaseIfPriorWaveDestroyed && wave.id > 1) {
            const prior = this.getPriorWave(scope, wave.id);
            if (prior && this.isWaveDestroyed(scope, prior)) return true;
        }
        return false;
    },

    releaseWave(scope, wave) {
        if (scope.releasedWaveIds.has(wave.id)) return;
        scope.releasedWaveIds.add(wave.id);
        const tracks = this.findTracksByCallsign(scope, wave.trackIds);
        tracks.forEach(t => {
            t.isDormant = false;
            if (t.hostile && t.type === 'fighter') {
                t.tacticalState = 'INGRESS';
            }
        });
        if (scope.pilotAI) {
            scope.pilotAI._blueSortPlanKey = null;
        }
        const tl = scope.timeline;
        const label = wave.label || `WAVE ${wave.id}`;
        const form = wave.formation || '';
        const text = `${label} WAVE — ${form} (${tracks.length} groups)`.trim();
        if (tl && typeof tl.log === 'function') {
            tl.log('wave_release', {
                waveId: wave.id,
                label: wave.label,
                formation: wave.formation,
                count: tracks.length,
                text
            });
        }
    },

    update(scope) {
        const waves = scope.scenarioWaves || [];
        if (!waves.length) return;
        const elapsedSec = this.getElapsedSec(scope);
        waves.forEach(wave => {
            if (this.shouldRelease(scope, wave, elapsedSec)) {
                this.releaseWave(scope, wave);
            }
        });
    }
};

if (typeof window !== 'undefined') window.WaveManager = WaveManager;
