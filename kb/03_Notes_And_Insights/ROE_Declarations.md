# ROE Declarations and Identification Criteria

**Last Reviewed:** 2026-08-13  
**Tags:** `#roe` `#abm` `#wd`

## Declaration Types

### HOSTILE
**Definition**: Identified as enemy IAW theater ROE; clearance to fire is authorized.

**WD Requirements**:
- Track meets Positive Identification (PID) criteria
- Must cross-reference:
  - IFF/SIF codes (negative response or wrong code)
  - NCTR (Non-Cooperative Target Recognition)
  - POO (Point of Origin) - launched from known enemy territory
  - Visual ID (if available)

**Example**: `"RAPTOR, DECLARE BULLSEYE 180/40"`
**Response**: `"HOSTILE, BULLSEYE 180/40"`

---

### BANDIT
**Definition**: Positively identified as enemy aircraft, but clearance to fire is **not yet authorized**.

**WD Requirements**:
- Identification verified (same criteria as Hostile)
- ROE constraints prevent weapons release (e.g., outside designated engagement zone)

**Usage**: Track is enemy, but waiting for ROE clearance or geometry update.

---

### BOGEY
**Definition**: A radar or visual contact whose identity is **unknown**.

**WD Requirements**:
- Initial track detection without IFF response
- No visual ID
- Does not meet hostile criteria yet

**Example**: `"TANGO, PICTURE, THREE GROUPS, NORTH GROUP BULLSEYE 090/25, HIGH, TRACK WEST, BOGEY"`

---

### OUTLAW
**Definition**: Contact has passed a **Point of Origin (POO)** and is following a profile consistent with enemy tactics.

**WD Requirements**:
- Track history correlates with known adversary launch profiles
- Originated from hostile territory
- Aspect/altitude consistent with threat profile

**Usage**: Used when POO is the primary ID criterion (e.g., missile launch detected from enemy SAM site).

---

### FRIENDLY
**Definition**: Positively identified as friendly aircraft.

**WD Requirements**:
- Correct IFF/SIF Mode 4 response
- Correlated with flight plan or ATO
- Visual ID confirms friendly type

---

### UNABLE
**Definition**: Cannot provide a declaration due to insufficient data.

**Example**: `"RAPTOR, DECLARE BULLSEYE 200/30"`
**Response**: `"UNABLE, RECOMMEND VISUAL ID"`

---

## ID Matrix Integration

The **ID Matrix** (defined in SPINS) provides the hierarchy of identification methods:

1. **IFF/SIF Mode 4** (most reliable)
2. **NCTR** (radar signature analysis)
3. **POO** (geographic origin)
4. **Visual ID** (if within range)
5. **Correlation with ATO** (expected friendly positions)

WDs must **verify at least two criteria** before declaring "Hostile" in most ROE scenarios.

---

*Source: Research Document - Technical Architecture for High-Fidelity Tactical C2 Simulation*
