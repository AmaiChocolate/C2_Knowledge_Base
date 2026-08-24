# AI Pilot Behavior Architecture

## Overview
Hierarchical Behavior Architecture for realistic pilot simulation in the 2D tactical scope.

**Components**: Perception → Cognition → Action (closed-loop system)

## Implemented in simulator (2026-08-22)

### Blue BVR

Blue fighters (`pilot_ai.js`) run this BVR timeline (fighter **meld 80 / commit 50**):

| State | Trigger | Action |
|-------|---------|--------|
| **CAP** | Scenario start / recover | Hold assigned CAP (wing: PAIR ≤5 nm) |
| **MELD** | Nearest hostile ≤ **80 nm** | Intercept shaping; **FOX allowed** if TARGETED in NEZ |
| **COMMITTED** | Auto ≤ **commitNm (50)**; or **Commit** button | Crank-and-shoot shaping; **TARGETED** inside TAC RANGE (60 nm) |
| **WEZ** | Range **8–40 nm** + HOSTILE ID + ATA ≤ 40° | **FOX 3** after TARGETED (stern/trail OK for ARH) |
| **CRANK** | After FOX | ±50° F-pole (`crankSide` L/R); no re-shot until SKOSH |
| **SKOSH** | Pitbull / missile end | Beam/cold; reattack if ≤ **recommit (50 nm)** else CAP recover |

**Package SORT (sparse commit):** `ceil(N/3)` flight leads engage; max **3 contacts per shooter** (F-35 multi-target proxy). Example: 3 Su-30s → **one** lead (closer to picture) owns all three; the other flight stays CAP reserve. Wings do **not** auto-follow into meld/commit — release only on leaker / lead Winchester / lead DEFEND-or-down with coverage still needed (`wing_commit` with `*_release` phase). Timeline: `sort_assign`, `sort_retarget`, `untargeted`. ALSSA TARGETED = group ownership, not 1v1 pile-on.

**ALSSA employment gates:** `targeted` before `fox3`, shooter **ATA ≤ 40°** (nose on), FOX envelope **8–40 nm**, no FOX from CRANK/SKOSH. Target HOT/FLANK aspect is **not** required for AIM-120 (stern chase allowed). Inside FOX min with bandit still alive → **MERGE/guns** even if AIM-120s remain. `fox_hold` logged when geometry blocks shot (`ata_hold`, `inside_min_range`, etc.). **Shoot-then-crank:** pure pursuit until ATA passes, FOX, then F-pole crank (±50°).

**Ammo / wave doctrine:** `wave_hold` when Winchester or `<2` missiles and more hostiles than remaining missiles — hold CAP until wave cleared.

**Blue PAIR wingmen:** `RAPTOR12` / `VIPER22` hold ≤ **5 nm** of flight lead during **CAP** (`holdBlueFormation`). Formation releases when lead enters MELD or combat states; wings then run full BVR state machine.

**Commit policy (current):** auto-commit at fighter commit range. WD/role-gated commit comes later; Commit button already force-commits the selected blue fighter early.

**Missile terminal asymmetry (training proxy):** AIM-120 pitbull **8 nm** / turn **16°/s**; R-77 pitbull **10 nm** / turn **14°/s**. Red WEZ ranges unchanged.

### Red wave ingress (`wave_manager.js`)

Later red waves spawn dormant (no radar, no movement, no AI) until **hybrid release**:

- Timer: Wave 2 at **+90 s**, Wave 3 at **+180 s** (sc-02)
- Early: if `releaseIfPriorWaveDestroyed` and prior wave fully splashed

Timeline logs `wave_release` with ACC formation label (WALL / LADDER / PAIR). Wave depth ≥ **20 nm** between active waves for picture generator wave split.

### Red Flanker BVR (Su-30 training proxy)

See [[../03_Notes_And_Insights/Flanker_Adversary_Profile|Flanker_Adversary_Profile]]. Hostiles perceive blue fighters at **~40 nm** (F-35 VLO proxy) / HVAA at **~90 nm**, hold WALL/LADDER/PAIR on **INGRESS**, commit at **55 nm** (effective ~40 nm vs F-35 once perceived), shoot **R-77 @ 22** / **R-27 @ 32**, crank ±45°, then reattack or **PUSH_HVAA**.

**Perception honesty:** red commit and shot require the target in `perceivedTracks` — no god-mode fighter fallback. Unseen F-35s stay unseen until within VLO detect range (~40 nm).

**ARH defeat:** ECM is assist-only. Flankers need **unbroken notch + chaff ~5.0 s** (≈2 overlapping clouds) to defeat AIM-120; a single chaff burst is not enough.

| State | Trigger | Action |
|-------|---------|--------|
| **INGRESS** | Scenario start | Formation hold; lead presses east |
| **COMMITTED** | Blue fighter ≤ 55 nm | Pure pursuit |
| **WEZ** | R-77 ≤ 22 or R-27 ≤ 32 + ATA ≤ 40° + HOT/FLANK | Spawn missile; crank |
| **CRANK / SKOSH** | Post-shot | F-pole then beam |
| **PUSH_HVAA** | No fighter left / cold | Steer tanker / DAL |

**Out of scope still:** multi-group SORT UI, GCI for red, SAM layers, full loft kinematics.

---

## 1. Agentic AI Framework

### Perception Module (The "Eyes")
**Purpose**: Simulate realistic sensor limitations

**No "God Mode"**:
- Only see tracks within radar cone (±60° azimuth)
- Receive data via Link-16 (shared friendly tracks)
- Limited by radar range and altitude

**Implementation**:
```javascript
function getVisibleTracks(pilot, allTracks) {
    return allTracks.filter(track => {
        const bearing = calculateBearing(pilot.position, track.position);
        const relativeAzimuth = Math.abs(bearing - pilot.heading);
        const range = calculateRange(pilot.position, track.position);
        
        // Within radar cone and range
        return relativeAzimuth <= 60 && range <= pilot.radarRange;
    });
}
```

---

### Cognitive Module (The "Brain")
**Tool**: Behavior Trees (BT)

**Why BT over Scripts**:
- Modular and scalable
- Easy to debug for instructors
- Understandable logic flow

**Node Types**:

| Node Type | Logic Function | Application |
|-----------|----------------|-------------|
| **Selector** | Chooses first successful child | Prioritize: Self-Defense vs. Attack |
| **Sequence** | Complete all children in order | Engagement: Commit → Declare → Target → Shoot |
| **Decorator** | Add condition to node | "Is target within WEZ?" |
| **Task (Leaf)** | Actual action performed | Execute Crank at 50° off-nose |

---

### Action Module (The "Flying")
**Purpose**: Convert decisions into 2D movement

**Simplified 2D Kinematics**:
```javascript
// Update track position based on heading/speed
function updatePosition(track, deltaTime) {
    const radians = (track.heading - 90) * (Math.PI / 180);
    const distance = track.speed * deltaTime; // nm/sec
    
    track.x += distance * Math.cos(radians);
    track.y += distance * Math.sin(radians);
}

// Turn rate (degrees per second)
const TURN_RATE = 9; // ~3 G-force turn
```

**Advanced Option**: JSBSim (open-source flight dynamics engine)

---

## 2. Behavior Tree Structure

### BVR Engagement Tree

```
Root (Selector)
├── Self-Defense (Sequence)
│   ├── Detect Missile Lock? (Decorator)
│   ├── Execute NOTCH (Task)
│   └── Deploy Chaff (Task)
├── Attack (Sequence)
│   ├── Target Within WEZ? (Decorator)
│   ├── Fire Missile (Task)
│   ├── Execute CRANK (Task)
│   └── Wait for SKOSH (Task)
└── Patrol (Task)
```

---

## 3. Tactical Maneuvers

### CRANK (F-Pole)
**Trigger**: After firing missile

**Logic**:
1. Turn to place target at radar gimbal limit (50-60° off-nose)
2. Reduce closure rate
3. Force enemy missile to fly longer path

**Implementation**:
```javascript
function executeCrank(pilot, target, direction) {
    const targetBearing = calculateBearing(pilot.position, target.position);
    const crankAngle = 55; // degrees
    
    if (direction === 'LEFT') {
        pilot.heading = targetBearing - crankAngle;
    } else {
        pilot.heading = targetBearing + crankAngle;
    }
    
    pilot.state = 'CRANKING';
}
```

---

### SKOSH/Active Logic
**Trigger**: Missile reaches active range ("Pitbull")

**Transition**: Crank → Beam/Cold

**Implementation**:
```javascript
function checkMissileActive(missile) {
    if (missile.rangeToTarget <= missile.activeRange) {
        missile.state = 'ACTIVE';
        missile.pilot.state = 'SKOSH';
        // Pilot can now turn cold
        executeBeamManeuver(missile.pilot);
    }
}
```

---

### BEAM/NOTCH / DEFEND (implemented 2026-08-22)

**Trigger**: Inbound missile inside platform detect range, or **ACTIVE** (pitbull).

**Override**: `DEFEND` BT branch runs **above** blue/red offensive BVR in `pilot_ai.js`.

**Aspect**: 70–110° relative to inbound missile bearing (beam/notch).

**Modes**: `NOTCH` → `BEAM` (post-pitbull) → `COLD` (drag) → `BREAK` (inside break range).

**Countermeasures**: Chaff dispense on first NOTCH/BEAM per salvo; ECM strength from `defensive_profiles.js` (F-35 strong, Flanker weak).

**Missile defeat** (`missile_model.evaluateDefeat`):
- SARH: sustained defender notch ~2 s → MISS
- ARH: sustained notch + chaff/ECM for profile duration → MISS

Profiles: [[../03_Notes_And_Insights/F35_Defensive_Profile|F35_Defensive_Profile]] · [[../03_Notes_And_Insights/Flanker_Adversary_Profile|Flanker_Adversary_Profile]]

---

## 4. Red Air Formation Logic

### Playbook System
**Concept**: Groups move together, not individually

**Lead/Wing Relationships**:

```javascript
class Formation {
    constructor(lead, wingmen, type) {
        this.lead = lead; // Lead aircraft
        this.wingmen = wingmen; // Array of wing aircraft
        this.type = type; // WALL, LADDER, VIC, etc.
    }
    
    updateFormation() {
        if (this.type === 'WALL') {
            // Wingmen maintain lateral offset
            this.wingmen[0].setOffset(this.lead, -10, 0); // 10nm left
            this.wingmen[1].setOffset(this.lead, +10, 0); // 10nm right
        } else if (this.type === 'LADDER') {
            // Wingmen maintain range offset
            this.wingmen[0].setOffset(this.lead, 0, -15); // 15nm behind
            this.wingmen[1].setOffset(this.lead, 0, -30); // 30nm behind
        }
    }
}
```

---

### Weighted Logic
**Scenario**: 3 groups, more aircraft on one side

**Implementation**:
```javascript
const formation = {
    northGroup: { count: 4, position: {...} },
    middleGroup: { count: 2, position: {...} },
    southGroup: { count: 2, position: {...} }
};

// Picture call: "WALL, HEAVY NORTH"
```

---

### Opponent Policy Pool
**Purpose**: Randomize strategies for unpredictability

**Policies**:
- **Aggressive**: Close quickly, shoot first
- **Elusive**: Maintain range, force commit delay
- **Mixed**: Some groups attack, others defend

**Implementation**:
```javascript
const opponentPolicies = ['AGGRESSIVE', 'ELUSIVE', 'MIXED'];
const selectedPolicy = opponentPolicies[Math.floor(Math.random() * opponentPolicies.length)];

redAirFormation.applyPolicy(selectedPolicy);
```

---

## 5. GCI Brevity Integration

### State Machine Response
**Concept**: AI state changes based on WD commands

**States**:
- `PATROL` → `COMMITTED` (on "Commit")
- `COMMITTED` → `PATROL` (on "Skip It")
- `ANY` → `RTB` (on Bingo fuel)

**Implementation**:
```javascript
function processGCICommand(pilot, command) {
    switch(command.type) {
        case 'COMMIT':
            pilot.state = 'COMMITTED';
            pilot.target = command.target;
            break;
        case 'SKIP_IT':
            pilot.state = 'PATROL';
            pilot.target = null;
            break;
        case 'RESET':
            pilot.resetToCAP();
            break;
    }
}
```

---

### Bogey Dope Response
**Trigger**: Pilot requests nearest threat

**Response**: Calculate BRAA to nearest hostile

**Implementation**:
```javascript
function handleBogeyDope(pilot, allTracks) {
    const hostiles = allTracks.filter(t => t.hostile && isVisible(pilot, t));
    const nearest = hostiles.reduce((closest, track) => {
        const range = calculateRange(pilot.position, track.position);
        return range < closest.range ? track : closest;
    });
    
    const braa = calculateBRAA(pilot.position, nearest.position);
    const aspect = calculateAspect(pilot.heading, nearest.heading);
    
    return `BULLS ${braa.bearing}/${braa.range}, ${nearest.altitude/1000}K, ${aspect}`;
}
```

---

## 6. 2D Simplifications

### Altitude Handling
**Visual**: 2D top-down view only
**Logic**: Altitude still factored in calculations

**Effects**:
- **Look-down penalty**: Radar range reduced at low altitude
- **Missile range**: Longer at higher altitude
- **Energy state**: Higher altitude = more potential energy

**Implementation**:
```javascript
function calculateMissileRange(altitude) {
    const baseRange = 60; // nm at 30K feet
    const altitudeFactor = altitude / 30000;
    return baseRange * altitudeFactor;
}
```

---

## 7. HVAA Orbital Patterns (Tankers & ISR)

### Standard Racecourse Orbit Geometry

**Aircraft Types**: RC-135 Rivet Joint, KC-135 Tanker, E-3 AWACS

**Orbit Parameters**:
- **Pattern**: Left-hand racecourse
- **Leg Length**: Minimum 50 NM
- **Leg Separation**: 20 NM
- **Anchor Point**: Geographic point or NAVAID

---

### Turn Kinematics for "Heavy" Aircraft

**Standard Rate Turn (SRT)**:
- Small aircraft: 3°/second (2 minutes for 360°)

**Heavy Rate Turn**:
- Large aircraft (>250 kts): 1.5°/second (4 minutes for 360°)
- Bank angle: ~25 degrees

**Turn Radius Calculation**:
```javascript
// Rule of thumb: radius = 0.5% of ground speed
function calculateTurnRadius(groundSpeed) {
    return groundSpeed * 0.005; // nm
}

// Example: 300 kts → 1.5 nm radius
```

---

### Orbit State Machine

| State | Action | Transition Criteria |
|-------|--------|---------------------|
| **Leg 1 (Inbound)** | Move toward Anchor Point | Distance to anchor < 0.1 NM |
| **Turn 1** | Execute 180° left turn @ 1.5°/sec | Heading change == 180° |
| **Leg 2 (Outbound)** | Move reciprocal to Leg 1 | Elapsed time == Leg Duration |
| **Turn 2** | Execute 180° left turn @ 1.5°/sec | Heading change == 180° |

---

### Mathematical Implementation

#### Turn Logic (Semi-Circle)
```javascript
function executeTurn(aircraft, centerX, centerY, radius, turnRate, deltaTime) {
    // Increment angle by turn rate
    aircraft.turnAngle += turnRate * deltaTime; // degrees
    
    if (aircraft.turnAngle >= 180) {
        aircraft.state = 'LEG';
        aircraft.turnAngle = 0;
        return;
    }
    
    // Calculate position on arc
    const radians = (aircraft.initialHeading + aircraft.turnAngle) * (Math.PI / 180);
    aircraft.x = centerX + radius * Math.cos(radians);
    aircraft.y = centerY + radius * Math.sin(radians);
    
    // Update heading
    aircraft.heading = aircraft.initialHeading + aircraft.turnAngle;
}
```

#### Leg Logic (Straight Line)
```javascript
function executeOrbitLeg(aircraft, speed, deltaTime) {
    const radians = (aircraft.heading - 90) * (Math.PI / 180);
    const distance = speed * deltaTime; // nm
    
    aircraft.x += distance * Math.cos(radians);
    aircraft.y += distance * Math.sin(radians);
    
    // Check if leg complete
    aircraft.legTime += deltaTime;
    if (aircraft.legTime >= aircraft.legDuration) {
        aircraft.state = 'TURN';
        aircraft.legTime = 0;
        // Calculate turn center for next turn
        aircraft.turnCenter = calculateTurnCenter(aircraft);
    }
}
```

#### Haversine Distance (High Accuracy)
```javascript
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Earth radius in NM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}
```

---

### Brevity Command Integration

#### ANCHOR Command
**Format**: `"ANCHOR [Location]"`

**Action**: Proceed to specified point and establish orbit

```javascript
function processAnchorCommand(aircraft, location) {
    aircraft.state = 'TRANSIT';
    aircraft.targetAnchor = location;
    aircraft.heading = calculateBearing(aircraft.position, location);
}
```

---

#### ROLEX Command
**Format**: `"ROLEX PLUS 2"` (delay by 2 minutes)

**Action**: Adjust mission timeline

```javascript
function processRolexCommand(aircraft, deltaMinutes) {
    aircraft.scheduleOffset += deltaMinutes;
    
    // Delay state transitions
    if (aircraft.state === 'LEG') {
        aircraft.legDuration += deltaMinutes;
    }
}
```

---

#### RETROGRADE Command
**Format**: `"RETROGRADE"`

**Action**: Break orbit and fly away from threat axis

```javascript
function processRetrogradeCommand(aircraft, threatBearing) {
    // Calculate escape heading (opposite of threat)
    const escapeHeading = (threatBearing + 180) % 360;
    
    aircraft.state = 'RETROGRADE';
    aircraft.heading = escapeHeading;
    aircraft.speed += 50; // Increase speed to escape
    
    // Cancel orbit pattern
    aircraft.orbitActive = false;
}
```

---

### Complete HVAA Orbit Class

```javascript
class HVAAOrbit {
    constructor(anchorPoint, legLength, speed, callsign) {
        this.anchorPoint = anchorPoint;
        this.legLength = legLength; // NM
        this.speed = speed; // knots
        this.callsign = callsign;
        
        this.state = 'LEG1'; // LEG1, TURN1, LEG2, TURN2
        this.heading = 0;
        this.turnRate = 1.5; // degrees/second (heavy aircraft)
        this.turnRadius = this.speed * 0.005;
        this.legDuration = (this.legLength / this.speed) * 3600; // seconds
        
        this.position = { ...anchorPoint };
        this.legTime = 0;
        this.turnAngle = 0;
    }
    
    update(deltaTime) {
        switch(this.state) {
            case 'LEG1':
            case 'LEG2':
                this.executeOrbitLeg(deltaTime);
                break;
            case 'TURN1':
            case 'TURN2':
                this.executeTurn(deltaTime);
                break;
        }
    }
    
    executeOrbitLeg(deltaTime) {
        const radians = (this.heading - 90) * (Math.PI / 180);
        const distance = this.speed * (deltaTime / 3600); // convert to NM
        
        this.position.x += distance * Math.cos(radians);
        this.position.y += distance * Math.sin(radians);
        
        this.legTime += deltaTime;
        
        // Transition to turn
        if (this.legTime >= this.legDuration) {
            this.state = this.state === 'LEG1' ? 'TURN1' : 'TURN2';
            this.legTime = 0;
            this.turnAngle = 0;
        }
    }
    
    executeTurn(deltaTime) {
        this.turnAngle += this.turnRate * deltaTime;
        
        if (this.turnAngle >= 180) {
            // Complete turn
            this.heading = (this.heading + 180) % 360;
            this.state = this.state === 'TURN1' ? 'LEG2' : 'LEG1';
            this.turnAngle = 0;
            return;
        }
        
        // Calculate position on arc
        const turnCenter = this.calculateTurnCenter();
        const radians = (this.heading + this.turnAngle - 90) * (Math.PI / 180);
        
        this.position.x = turnCenter.x + this.turnRadius * Math.cos(radians);
        this.position.y = turnCenter.y + this.turnRadius * Math.sin(radians);
    }
    
    calculateTurnCenter() {
        // Left-hand turn: center is 90° left of current heading
        const centerBearing = (this.heading - 90 + 360) % 360;
        const radians = (centerBearing - 90) * (Math.PI / 180);
        
        return {
            x: this.position.x + this.turnRadius * Math.cos(radians),
            y: this.position.y + this.turnRadius * Math.sin(radians)
        };
    }
}
```

---

## Reference Sources
- AFTTP 3-1 Series (Tactical Maneuvers)
- Behavior Trees in Robotics and AI (Michele Colledanchise)
- JSBSim Flight Dynamics Engine (open-source)

---

*Architecture Date: 2026-02-01*
*Author: User (AI Behavior SME)*
