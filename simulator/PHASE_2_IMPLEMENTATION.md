# Phase 2 Implementation Guide: Logic Engine

## Overview
Transition from visual representation to intelligent tactical logic. This phase implements the "Brain" of the simulator: automated grouping, aspect calculation, and tactical brevity generation.

---

## 1. Automated Grouping and Picture Labeling

### Track Grouping Algorithm: DBSCAN

**Why DBSCAN over K-Means**:
- No need to pre-specify number of groups
- Handles arbitrary shapes
- Identifies evolving formations

**Doctrinal Definition**: A **Group** is any number of contacts within **3 NM** in azimuth or range of each other.

**Implementation**:
```javascript
// DBSCAN clustering for track grouping
function clusterTracks(tracks, epsilon = 3, minPoints = 1) {
    const clusters = [];
    const visited = new Set();
    const noise = [];
    
    tracks.forEach((track, idx) => {
        if (visited.has(idx)) return;
        visited.add(idx);
        
        const neighbors = getNeighbors(track, tracks, epsilon);
        
        if (neighbors.length < minPoints) {
            noise.push(track);
        } else {
            const cluster = [track];
            expandCluster(track, neighbors, cluster, visited, tracks, epsilon, minPoints);
            clusters.push(cluster);
        }
    });
    
    return clusters;
}

function getNeighbors(track, tracks, epsilon) {
    return tracks.filter(other => {
        const distance = calculateDistance(track, other);
        return distance <= epsilon && distance > 0;
    });
}
```

---

### Picture Labeling Criteria

#### WALL (Azimuth Formation)
**Criteria**: Separation primarily **lateral** (3+ groups)

```javascript
function detectWall(groups) {
    if (groups.length < 3) return false;
    
    const bearings = groups.map(g => g.centroid.bearing);
    const ranges = groups.map(g => g.centroid.range);
    
    const bearingSpread = Math.max(...bearings) - Math.min(...bearings);
    const rangeSpread = Math.max(...ranges) - Math.min(...ranges);
    
    return bearingSpread > rangeSpread && bearingSpread > 20;
}
```

---

#### LADDER (Range Formation)
**Criteria**: Separation primarily in **range/depth** (3+ groups)

```javascript
function detectLadder(groups) {
    if (groups.length < 3) return false;
    
    const ranges = groups.map(g => g.centroid.range);
    const bearings = groups.map(g => g.centroid.bearing);
    
    const rangeSpread = Math.max(...ranges) - Math.min(...ranges);
    const bearingSpread = Math.max(...bearings) - Math.min(...bearings);
    
    return rangeSpread > bearingSpread && rangeSpread > 15;
}
```

---

#### VIC / CHAMPAGNE
**Criteria**: Analyze lead vs. trail groups

- **VIC**: 1 lead + 2 trail
- **CHAMPAGNE**: 2 lead + 1 trail

```javascript
function detectVicOrChampagne(groups) {
    if (groups.length !== 3) return { type: 'UNKNOWN' };
    
    // Sort by range
    const sorted = [...groups].sort((a, b) => a.centroid.range - b.centroid.range);
    
    const leadRange = sorted[0].centroid.range;
    const trailRange1 = sorted[1].centroid.range;
    const trailRange2 = sorted[2].centroid.range;
    
    // Check if first is significantly ahead
    if (leadRange + 15 < trailRange1) {
        // Check if trail elements are close together
        if (Math.abs(trailRange1 - trailRange2) < 10) {
            return { type: 'VIC', lead: sorted[0] };
        }
    }
    
    // Check if first two are significantly ahead
    if (Math.abs(leadRange - trailRange1) < 10 && trailRange1 + 15 < trailRange2) {
        return { type: 'CHAMPAGNE', lead: [sorted[0], sorted[1]] };
    }
    
    return { type: 'UNKNOWN' };
}
```

---

### Weighting Logic (Azimuth Thirds)

**Rule**: Formation is **WEIGHTED** if a group falls outside the middle third.

```javascript
function calculateWeight(groups) {
    if (groups.length < 3) return null;
    
    const bearings = groups.map(g => g.centroid.bearing);
    const minBearing = Math.min(...bearings);
    const maxBearing = Math.max(...bearings);
    const totalWidth = maxBearing - minBearing;
    
    const thirdWidth = totalWidth / 3;
    const middleStart = minBearing + thirdWidth;
    const middleEnd = maxBearing - thirdWidth;
    
    // Count groups in each third
    let northCount = 0, middleCount = 0, southCount = 0;
    
    groups.forEach(group => {
        if (group.centroid.bearing < middleStart) northCount++;
        else if (group.centroid.bearing > middleEnd) southCount++;
        else middleCount++;
    });
    
    if (northCount > southCount && northCount > middleCount) return 'HEAVY NORTH';
    if (southCount > northCount && southCount > middleCount) return 'HEAVY SOUTH';
    return null;
}
```

---

## 2. Aspect Calculation Engine

### Target Aspect (TA) Formula

**Components**:
- **BR** (Bandit Reciprocal): Reverse of bandit's heading
- **BB** (Bandit Bearing): Bearing from fighter to bandit

**Formula**: `TA = |BR - BB|`

**Implementation**:
```javascript
function calculateAspect(fighter, target) {
    // BB: Bearing from fighter to target
    const BB = calculateBearing(fighter.position, target.position);
    
    // BR: Reciprocal of target's heading
    const BR = (target.heading + 180) % 360;
    
    // Calculate aspect angle
    let aspectAngle = Math.abs(BR - BB);
    if (aspectAngle > 180) aspectAngle = 360 - aspectAngle;
    
    // Determine left/right
    const aspectSide = (BB < BR) ? 'LEFT' : 'RIGHT';
    
    return { angle: aspectAngle, side: aspectSide };
}
```

---

### Aspect Classification

| Aspect Term | Angular Range | Definition |
|-------------|---------------|------------|
| **HOT** | 0° - 20° | Target heading toward fighter |
| **FLANK** | 30° - 60° | Target stabilized at offset angle |
| **BEAM** | 70° - 110° | Target perpendicular to fighter |
| **DRAG** | 120° - 150° | Target maneuvering away (from tail) |
| **COLD** | 160° - 180° | Target heading away from fighter |

**Implementation**:
```javascript
function classifyAspect(aspectAngle) {
    if (aspectAngle <= 20) return 'HOT';
    if (aspectAngle <= 60) return 'FLANK';
    if (aspectAngle <= 110) return 'BEAM';
    if (aspectAngle <= 150) return 'DRAG';
    return 'COLD';
}
```

---

## 3. BRAA and BRAE Implementation

### BRAA Calculation

**Components**:
- **B**earing: Magnetic bearing from fighter to target
- **R**ange: Slant range in NM
- **A**ltitude: Target altitude (thousands)
- **A**spect: HOT/FLANK/BEAM/COLD

```javascript
function calculateBRAA(fighter, targetGroup) {
    const centroid = targetGroup.centroid;
    
    const bearing = calculateBearing(fighter.position, centroid.position);
    const range = calculateRange(fighter.position, centroid.position);
    const altitude = Math.round(centroid.altitude / 1000);
    const aspect = calculateAspect(fighter, targetGroup.lead);
    const aspectClass = classifyAspect(aspect.angle);
    
    return {
        bearing: Math.round(bearing),
        range: Math.round(range),
        altitude,
        aspect: aspectClass,
        raw: aspect
    };
}
```

---

### BRAE (with Echelon Fill-in)

**Echelon**: Describes trailer displacement behind leader (~45° offset)

```javascript
function calculateBRAE(fighter, targetGroup) {
    const braa = calculateBRAA(fighter, targetGroup);
    
    if (targetGroup.tracks.length > 1) {
        const echelon = determineEchelon(targetGroup.tracks);
        return { ...braa, echelon };
    }
    
    return braa;
}

function determineEchelon(tracks) {
    if (tracks.length !== 2) return null;
    
    const [lead, trail] = tracks;
    const bearing = calculateBearing(lead.position, trail.position);
    const offset = Math.abs(bearing - lead.heading);
    
    if (offset >= 30 && offset <= 60) {
        return bearing > lead.heading ? 'ECHELON RIGHT' : 'ECHELON LEFT';
    }
    return null;
}
```

---

## 4. Tactical Range Calls

### Event Trigger System

**Trigger Thresholds**: Fire calls at specific range milestones

```javascript
const RANGE_THRESHOLDS = {
    COMMIT: 60,      // Commit decision range
    STEERING: 45,    // Provide steering
    IN_RANGE: 30,    // Within WEZ
    THREAT: 15,      // Close-in threat
    MERGE: 5         // Visual merge
};

function checkRangeTriggers(fighter, target, previousRange, currentRange) {
    const triggers = [];
    
    Object.entries(RANGE_THRESHOLDS).forEach(([event, threshold]) => {
        if (previousRange > threshold && currentRange <= threshold) {
            triggers.push(event);
        }
    });
    
    return triggers;
}
```

---

### CUT Calculation

**Formula**: `Cut = |FH - BR|`

- **FH**: Fighter Heading
- **BR**: Bandit Reciprocal
- **Zero Cut**: Most efficient closure

```javascript
function calculateCut(fighter, target) {
    const BR = (target.heading + 180) % 360;
    const FH = fighter.heading;
    
    let cut = Math.abs(FH - BR);
    if (cut > 180) cut = 360 - cut;
    
    return Math.round(cut);
}

function getCutDescription(cutAngle) {
    if (cutAngle <= 5) return 'ZERO CUT';
    return `${cutAngle} CUT`;
}
```

---

### STERN Intercept Detection

**Criteria**: Fighter will roll out behind target

```javascript
function detectSternIntercept(fighter, target, range) {
    const cut = calculateCut(fighter, target);
    const aspect = calculateAspect(fighter, target);
    
    // If cut is high and aspect is COLD/DRAG, likely stern
    if (cut > 150 && (aspect === 'COLD' || aspect === 'DRAG')) {
        return true;
    }
    
    return false;
}
```

---

## 5. Wave Logic Integration

### Wave Separation Detection

**Criteria**: Groups separated significantly in **range/depth**

```javascript
function detectWaves(groups, waveThreshold = 25) {
    if (groups.length < 2) return null;
    
    // Sort by range
    const sorted = [...groups].sort((a, b) => a.centroid.range - b.centroid.range);
    
    const waves = [];
    let currentWave = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
        const rangeGap = sorted[i].centroid.range - sorted[i-1].centroid.range;
        
        if (rangeGap > waveThreshold) {
            waves.push(currentWave);
            currentWave = [sorted[i]];
        } else {
            currentWave.push(sorted[i]);
        }
    }
    
    waves.push(currentWave);
    
    return waves.length > 1 ? waves : null;
}
```

---

### Wave Picture Call Format

**Format**: Total groups/waves → First Wave → Second Wave

```javascript
function generateWavePicture(waves, bullseye) {
    const totalGroups = waves.flat().length;
    let pictureCall = `"TANGO, ${totalGroups} GROUPS, ${waves.length} WAVES. `;
    
    waves.forEach((wave, idx) => {
        const waveNum = idx + 1;
        const waveLabel = waveNum === 1 ? 'FIRST WAVE' : `WAVE ${waveNum}`;
        
        const waveFormation = detectFormation(wave);
        const leadingEdge = wave.reduce((closest, g) => 
            g.centroid.range < closest.centroid.range ? g : closest
        );
        
        pictureCall += `${waveLabel}, ${wave.length} GROUPS`;
        if (waveFormation.type !== 'UNKNOWN') {
            pictureCall += `, ${waveFormation.type}`;
        }
        pictureCall += `, LEADING EDGE BULLSEYE ${leadingEdge.centroid.bearing}/${leadingEdge.centroid.range}`;
        pictureCall += `, ${getAltitudeBlock(leadingEdge.centroid.altitude)}, HOSTILE. `;
    });
    
    return pictureCall.trim() + '"';
}
```

---

## Physics-Based AI Reactions

### Spike Detection and Evasion

**Trigger**: AI detects radar lock or missile launch

```javascript
function handleSpikeDetection(aiTarget, threat) {
    const range = calculateRange(aiTarget.position, threat.position);
    
    if (range <= aiTarget.spikeThreshold) {
        // Execute defensive maneuver
        const aspect = calculateAspect(threat, aiTarget);
        
        if (aspect.angle < 60) {
            // Threat is HOT/FLANK - execute BEAM
            executeBeamManeuver(aiTarget, threat);
        } else {
            // Threat is BEAM/COLD - execute NOTCH
            executeNotchManeuver(aiTarget, threat);
        }
    }
}
```

---

## Summary: Phase 2 Enhancements

**Core Components**:
1. ✅ DBSCAN clustering for automated grouping
2. ✅ Picture labeling (Wall, Ladder, Vic, Champagne, Weight)
3. ✅ Aspect calculation engine (Hot/Flank/Beam/Drag/Cold)
4. ✅ BRAA/BRAE implementation
5. ✅ Tactical range triggers and Cut calculations
6. ✅ Wave detection and formatting
7. ✅ AI evasion logic

**Result**: The simulator transitions from a **static display** to a **reactive tactical tool** that enforces correct WD/ABM decision-making.

---

*Phase 2 Architecture Date: 2026-02-01*
*Author: User (Tactical Logic SME)*
