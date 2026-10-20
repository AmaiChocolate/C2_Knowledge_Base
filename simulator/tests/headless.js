/**
 * Headless BC3 Scope Trainer — loads the real browser scripts into a VM with a stub
 * DOM so engagements can be run to completion on the sim clock, deterministically.
 *
 *     const { loadSimulator } = require('./headless');
 *     const sim = loadSimulator({ seed: 1 });
 *     sim.load('sc-01-single-commit');
 *     sim.run(900);                 // sim seconds
 *     sim.events()                  // timeline events with simT
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/** Object that absorbs any property access, call or assignment (stands in for DOM nodes). */
function blackHole() {
    const fn = function () {};
    const proxy = new Proxy(fn, {
        get(target, prop) {
            if (prop === Symbol.toPrimitive) return () => 0;
            if (prop === 'toString') return () => '';
            if (prop === 'length') return 0;
            if (prop === 'width' || prop === 'height') return 800;
            if (prop === 'forEach') return () => {};
            if (prop === 'then') return undefined;
            if (prop in target) return target[prop];
            return proxy;
        },
        set(target, prop, value) { target[prop] = value; return true; },
        apply() { return proxy; },
        construct() { return proxy; }
    });
    return proxy;
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function loadSimulator(opts = {}) {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script src="([^"?]+)[^"]*"><\/script>/g)]
        .map(m => m[1])
        .filter(src => !/^https?:/.test(src));

    // Seeded Math.random so missile Pk rolls replay exactly.
    const seededMath = Object.create(Math);
    seededMath.random = mulberry32(opts.seed != null ? opts.seed : 1);

    const listeners = {};
    const sandbox = {
        console: opts.verbose ? console : { log() {}, warn() {}, error: console.error },
        Math: seededMath,
        document: {
            getElementById: () => blackHole(),
            querySelector: () => blackHole(),
            querySelectorAll: () => [],
            createElement: () => blackHole(),
            addEventListener() {},
            body: blackHole()
        },
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        requestAnimationFrame() {},
        setInterval() {},
        setTimeout() {},
        fetch: () => Promise.reject(new Error('headless')),
        alert() {},
        performance: { now: () => 0 }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    scripts.forEach(src => {
        const file = path.join(ROOT, src);
        vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    });
    (listeners.DOMContentLoaded || []).forEach(fn => fn());

    const get = expr => vm.runInContext(expr, sandbox);
    const scope = get('scope');

    return {
        scope,
        sandbox,
        load(id) {
            get(`applyScenario(window.SCENARIO_BANK[${JSON.stringify(id)}])`);
            return this;
        },
        /** Advance `seconds` of sim time in fixed steps; `each(scope)` runs after every step. */
        run(seconds, each, dt = 0.1) {
            const steps = Math.round(seconds / dt);
            for (let i = 0; i < steps; i++) {
                scope.updateSimulation(dt, scope.simTimeSec * 1000);
                if (each && each(scope) === false) break;
            }
            return this;
        },
        events() {
            return scope.timeline.events;
        },
        tracks() {
            return scope.truthTracks;
        }
    };
}

module.exports = { loadSimulator };
