/**
 * Aspect Calculation Engine
 * Calculates target aspect and generates BRAA/BRAE calls
 */

class AspectCalculator {
    constructor() {
        this.aspectTypes = {
            HOT: 'HOT',
            FLANK: 'FLANK',
            BEAM: 'BEAM',
            DRAG: 'DRAG',
            COLD: 'COLD'
        };
    }

    /**
     * Calculate aspect from fighter to target
     * Returns { angle, side, classification }
     */
    calculateAspect(fighter, target) {
        // BB: Bandit Bearing (bearing from fighter to target)
        const BB = this.calculateBearing(fighter, target);

        // BR: Bandit Reciprocal (reverse of target's heading)
        const BR = (target.heading + 180) % 360;

        // Calculate aspect angle
        let aspectAngle = Math.abs(BR - BB);
        if (aspectAngle > 180) aspectAngle = 360 - aspectAngle;

        // Determine left/right
        let aspectSide = 'NEUTRAL';
        if (BB < BR) {
            aspectSide = BB + 180 < BR ? 'LEFT' : 'RIGHT';
        } else {
            aspectSide = BB < BR + 180 ? 'RIGHT' : 'LEFT';
        }

        // Classify aspect
        const classification = this.classifyAspect(aspectAngle);

        return {
            angle: Math.round(aspectAngle),
            side: aspectSide,
            classification
        };
    }

    classifyAspect(angle) {
        if (angle <= 20) return this.aspectTypes.HOT;
        if (angle <= 60) return this.aspectTypes.FLANK;
        if (angle <= 110) return this.aspectTypes.BEAM;
        if (angle <= 150) return this.aspectTypes.DRAG;
        return this.aspectTypes.COLD;
    }

    /**
     * Calculate BRAA from fighter to target group
     */
    calculateBRAA(fighter, targetGroup) {
        const centroid = targetGroup.centroid;

        const bearing = this.calculateBearing(fighter, {
            bearing: centroid.bearing,
            range: centroid.range
        });

        const range = this.calculateRange(fighter, {
            bearing: centroid.bearing,
            range: centroid.range
        });

        const altitude = Math.round(centroid.altitude / 1000);

        // Calculate aspect using lead track
        let aspect = this.aspectTypes.HOT;
        if (targetGroup.lead && targetGroup.lead.heading !== undefined) {
            const aspectData = this.calculateAspect(fighter, targetGroup.lead);
            aspect = aspectData.classification;
        }

        return {
            bearing: Math.round(bearing),
            range: Math.round(range),
            altitude,
            aspect,
            raw: {
                bearing,
                range,
                altitude: centroid.altitude
            }
        };
    }

    /**
     * Format BRAA as brevity call
     */
    formatBRAA(braa) {
        return `${braa.bearing} / ${braa.range}, ${braa.altitude}K, ${braa.aspect}`;
    }

    /**
     * Calculate bearing from point A to point B (in bullseye coordinates)
     */
    calculateBearing(fromPoint, toPoint) {
        // Convert bullseye coordinates to Cartesian
        const fromX = fromPoint.range * Math.cos((fromPoint.bearing - 90) * Math.PI / 180);
        const fromY = fromPoint.range * Math.sin((fromPoint.bearing - 90) * Math.PI / 180);

        const toX = toPoint.range * Math.cos((toPoint.bearing - 90) * Math.PI / 180);
        const toY = toPoint.range * Math.sin((toPoint.bearing - 90) * Math.PI / 180);

        const dx = toX - fromX;
        const dy = toY - fromY;

        let bearing = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (bearing < 0) bearing += 360;
        if (bearing >= 360) bearing -= 360;

        return bearing;
    }

    /**
     * Calculate range between two points
     */
    calculateRange(fromPoint, toPoint) {
        const fromX = fromPoint.range * Math.cos((fromPoint.bearing - 90) * Math.PI / 180);
        const fromY = fromPoint.range * Math.sin((fromPoint.bearing - 90) * Math.PI / 180);

        const toX = toPoint.range * Math.cos((toPoint.bearing - 90) * Math.PI / 180);
        const toY = toPoint.range * Math.sin((toPoint.bearing - 90) * Math.PI / 180);

        const dx = toX - fromX;
        const dy = toY - fromY;

        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate CUT (intercept geometry)
     */
    calculateCut(fighter, target) {
        if (!fighter.heading || !target.heading) return null;

        const BR = (target.heading + 180) % 360;
        const FH = fighter.heading;

        let cut = Math.abs(FH - BR);
        if (cut > 180) cut = 360 - cut;

        return Math.round(cut);
    }

    /**
     * Determine if intercept is STERN
     */
    isSternIntercept(fighter, target) {
        if (!fighter.heading || !target.heading) return false;

        const cut = this.calculateCut(fighter, target);
        const aspect = this.calculateAspect(fighter, target);

        // High cut + COLD/DRAG aspect = likely stern
        return cut > 150 && (aspect.classification === 'COLD' || aspect.classification === 'DRAG');
    }
}

window.AspectCalculator = AspectCalculator;
