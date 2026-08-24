# Picture Call Logic and Formation Labels

**Last Reviewed:** 2026-08-13  
**Tags:** `#wd` `#picture` `#brevity`  
**Related:** [[../06_Summaries_And_Learning/WD_Picture_Summary|WD_Picture_Summary]] · sim `sc-02-wall-ladder`

## Picture Call Hierarchy

### Standard Format
```
"[CALLSIGN], [GROUP COUNT], [WAVES (if applicable)], [LABEL], [DIMENSIONS], [LOCATION], [ALTITUDE], [FILL-INS]"
```

**Hierarchy**:
1. **Callsign**: `"VADER"`
2. **Group Count**: `"THREE GROUPS"` (total number)
3. **Waves**: `"TWO WAVES"` (if multiple waves detected)
4. **Label**: `"WALL"` / `"LADDER"` / `"AZIMUTH"`
5. **Dimensions**: `"FIFTEEN WIDE"` / `"TWENTY DEEP"` (numeric only)
6. **Location**: `"BULLSEYE 045/60"`
7. **Altitude**: `"TWENTY THOUSAND"` or `"HIGH"`
8. **Fill-ins**: `"TRACK EAST, HOSTILE"`

---

## Wave Calls (Multiple Formations in Depth)

### Two-Wave Example
```
"VADER, THREE GROUPS, TWO WAVES. 
FIRST WAVE, TWO GROUPS AZIMUTH, FIFTEEN WIDE, BULLSEYE 045/60, TWENTY THOUSAND, BOGEY. 
SECOND WAVE, SINGLE GROUP, BULLSEYE 045/80, TWENTY-FIVE THOUSAND, BOGEY."
```

### Logic Breakdown:
- **Total Summary First**: `"THREE GROUPS, TWO WAVES"` primes pilot's SA
- **First Wave**: Leading/immediate threat described first
- **Second Wave**: Follow-on force (typically deeper in range)
- **Sequential Format**: Each wave gets complete description before moving to next

---

## Formation Labels

### WALL
**Definition**: 3+ groups separated **laterally** (azimuth separation).

**Geometry**: Groups side-by-side at similar range.

**Purpose**: Maximizes sensor coverage, prevents flanking.

**Example**: 
```
"TANGO, THREE GROUPS, WALL, THIRTY WIDE, BULLSEYE 270/45, THIRTY-FIVE THOUSAND, TRACK EAST, HOSTILE."
```

---

### LADDER
**Definition**: 3+ groups separated in **range** (depth).

**Geometry**: Groups aligned in line, extending toward/away from friendly forces.

**Purpose**: Exhaust defender missiles on lead group while trailing groups engage.

**Example**: 
```
"TANGO, FOUR GROUPS, TWO WAVES.
FIRST WAVE, TWO GROUPS LADDER, TWENTY DEEP, LEADING EDGE BULLSEYE 180/50, HIGH, HOSTILE.
SECOND WAVE, TWO GROUPS LADDER, FIFTEEN DEEP, LEADING EDGE BULLSEYE 180/80, HIGH, HOSTILE."
```

---

### AZIMUTH
**Definition**: 2+ groups separated laterally.

**Example**: 
```
"VADER, TWO GROUPS AZIMUTH, FIFTEEN WIDE, BULLSEYE 045/60, TWENTY THOUSAND, BOGEY."
```

---

### CHAMPAGNE
**Definition**: 3 groups - **2 in front, 1 behind**.

**Geometry**: Two lead elements with trailing single group.

**Example**: 
```
"TANGO, THREE GROUPS, CHAMPAGNE, LEAD GROUPS BULLSEYE 270/45, HIGH, HOSTILE."
```

---

### VIC
**Definition**: 3 groups - **1 in front, 2 behind**.

**Geometry**: Strong lead element with supporting wings.

**Example**: 
```
"TANGO, THREE GROUPS, VIC, LEAD GROUP BULLSEYE 180/50, HIGH, TRACK WEST, HOSTILE."
```

---

### BOX
**Definition**: 4 groups - **2 in front, 2 behind** in square/offset square.

**Example**: 
```
"TANGO, FOUR GROUPS, BOX, NORTH LEAD BULLSEYE 090/40, HIGH, HOSTILE."
```

---

### CAP
**Definition**: Group in **orbit** or at specific geographic point.

**Trigger**: Tracks maintaining zero ground speed or circular pattern.

**Example**: 
```
"TANGO, SINGLE GROUP, CAP BULLSEYE 180/30, MEDIUM, HOSTILE."
```

---

## Dimension Descriptors

### DEEP (Depth)
**Format**: Numeric only (e.g., `"TWENTY DEEP"`)

**Definition**: Distance (in NM) between nearest and farthest groups in range.

**Used for**: Ladder, Box formations.

---

### WIDE (Width)
**Format**: Numeric only (e.g., `"FIFTEEN WIDE"`)

**Definition**: Lateral distance (in NM) between outermost groups.

**Used for**: Wall, Azimuth formations.

---

### HEAVY (Weight)
**Definition**: Indicates which portion contains more entities.

**Example**: `"HEAVY NORTH"` (more aircraft in northern groups)

---

## Bogey Dope (Nearest Threat Request)

**Fighter Request**: `"RAPTOR, BOGEY DOPE"`

**WD Response**: `"BULLS 270/25, MEDIUM, HOT"`

**Format**: `"[BRAA], [ALTITUDE], [ASPECT]"`

**Logic**: WD calculates bearing, range, altitude, and aspect of **nearest group** relative to requesting aircraft.

---

*Sources: Research Document - Technical Architecture for High-Fidelity Tactical C2 Simulation, ALSSA Brevity Standards*
