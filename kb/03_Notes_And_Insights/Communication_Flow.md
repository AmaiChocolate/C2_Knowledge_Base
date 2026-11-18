# Communication Flow: Check-In to Recovery

**Last Reviewed:** 2026-11-18: rewritten from ALSSA ACC, ATP 3-52.4 (09 OCT 2024). The previous version came from a "Research Document" and conflicted with ALSSA (HIGH for altitude, BULLS, wrong LOWDOWN, BOGEY DOPE and COMMIT formats); see [[../05_Tools_And_CrossReferences/ALSSA_ACC_2024_Review|ALSSA_ACC_2024_Review]]. Brackets are chapter and paragraph references.  
**Tags:** `#wd` `#comms` `#brevity`

## Transmission formats [II.3]

- **Directive**: the call sign of the entity being directed: `HORNET 2, TARGET NORTH GROUP.`
- **Interrogative**: `[entity spoken to], [speaker]`: `MIKE, EAGLE 11, DECLARE ADDITIONAL GROUP.`
- **Informative**: `[speaker]`: `EAGLE 11, FUEL YELLOW.` / `MAGIC, PICTURE CLEAN.`

## Communication priorities [II.2, table 1]

1. Flight safety and aircraft emergencies.
2. KILL verification (training: range training officer calls).
3. DEFENDING, SPIKE and THREAT calls.
4. Targeting SA requests (DECLARE, BOGEY DOPE) and responses to EA (STROBE).
5. PICTURE or fill-ins.
6. Tactical administration (WORDS updates).

## Check-in [II.4]

Purpose: contact, accountability, critical information before handoff to the final controller. TAC C2 verifies position and identity, routes the aircrew, and passes WORDS. Check-in items (table 2): positive friendly identification (IFF, PPLI, secure voice with radar correlation, authentication, ACO and sanctuary adherence), **ALPHA CHECK from BULLSEYE** (correlated within 3 nm), safety-of-flight information, WORDS, weather, and after the mission an inflight report.

Full aircrew check-in, **MNPOPCA** (table 3): Mission number, Number and type of aircraft, Position and altitude, Ordnance, PLAYTIME, Capabilities, Abort code.

```
Aircraft: "MISER, HORNET 1, MISSION NUMBER 5-1-1-1, CHECKING IN AS FRAGGED, REQUEST ALPHA CHECK DEPOT."
TAC C2:   "HORNET 1, MISER, CONTACT, ALPHA CHECK DEPOT 2-7-0/30."
```

- **AS FRAGGED**: performing as briefed; abbreviated check-in.
- **WITH EXCEPTIONS**: always report changes to number of aircraft, ordnance (WEAPONS YELLOW / RED or a changed load), PLAYTIME (FUEL YELLOW / RED), capabilities (TIMBER SOUR, JACKAL SOUR, GADGET BENT):

```
Aircraft: "MISER, EXXON 1, MISSION NUMBER 6-1-1-1, CHECKING IN WITH EXCEPTIONS, REQUEST ALPHA CHECK BULLSEYE."
TAC C2:   "EXXON 1, MISER, ALPHA CHECK BULLSEYE 2-7-0/30, CONTINUE WITH CHECK IN."
Aircraft: "EXXON 1, FRAG MINUS 30."
```

- Unable to contact on the check-in NET: CHATTERMARK procedures; at minimum get an ALPHA CHECK and WORDS from the final controller [II.5].

## WORDS [II.9]

Directive or interrogative call for mission information, numbered by ATO day (`WORDS ALPHA ALPHA ZERO-ONE`). Covers package, NET and timing changes, threat updates, threat warning condition or weapons control status, weather, CSAR. Passed digitally where possible. Aircraft add their current WORDS at check-in:

```
TAC C2:   "HORNET 1, GAMBLER, WORDS BRAVO ALPHA 0-2 NOW CURRENT."
Aircraft: "GAMBLER, HORNET 1 WITH WORDS BRAVO ALPHA 0-1."
TAC C2:   "HORNET 1, GAMBLER WORDS BRAVO ALPHA 0-2 TO FOLLOW. NEW THREAT AXIS 3-1-0,
           THREAT WARNING CONDITION RED, WEAPONS CONTROL STATUS TIGHT."
```

## LOWDOWN [III.2]

A request for the **tactical electromagnetic support picture or ground/surface picture** in an area of interest, with all factor ground and surface systems correlated in BULLSEYE format (MGRS, at least six digits, for Army and Marine rotary wing and UAS).

- Passed at a **briefed time** (e.g. 5 minutes before execution) and **immediately followed by a roll call**. Aircraft not on the NET for it get it at check-in, as part of WORDS.
- Format: core information; PICTURE format if the ground picture meets PICTURE criteria and a `MEZ PICTURE` or `LOWDOWN PICTURE` is requested. Long-range SAMs not in the PICTURE are passed as core information.
- An aircrew may request it within communication priorities; allow 30 to 60 seconds to compile.
- Digital (Link 16, tactical chat) or voice. Gives changes to the briefed order of battle: new systems, systems moved a tactically significant distance, systems assessed DOWN. May include LRAD / MRAD systems ACTIVE or AWAKE, SHORAD ACTIVE or AWAKE in the last hour, MOVERS / ROTATORS meeting reporting criteria.
- Order for tactical SAMs and MOVERS: **closest MEZ to friendly forces, closest MEZ to friendly axis of attack or ingress routes, most lethal**.
- Not required for every mission set (e.g. DCA in a permissive environment).

```
"GOLIATH, LOWDOWN. SA TWENTY AWAKE BULLSEYE 0-9-0/10, HQ-9 ACTIVE BULLSEYE 0-8-5/13,
 FIFTEEN ACTIVE BULLSEYE 0-7-5/14, ROTATOR BULLSEYE 2-6-0/11. HOSTILE CONVOY BULLSEYE 2-7-0/10 TRACK EAST."
```

## Roll call [III.1]

The mission commander (MC) confirms forces by a TAC C2 update or a roll call at a predetermined time, flights answering in a set order:

```
MC:  "PACKAGE BRAVO WHISKEY, ROLL CALL."
FLs: "EAGLE", "VIPER WITH EXCEPTIONS", "BONES", "GROWL", "MOJO".
MC:  "VIPER GO WITH EXCEPTIONS."   VIPER: "VIPER MINUS 2."
```

Roll calls also follow a LOWDOWN, new WORDS, a timing change, a weather plan change, a suspected loss, key enabler fallout, a CHATTERMARK to a new NET, and the return.

## Air picture, COMMIT and targeting

- **SMA PICTURE** (enemy special mission aircraft) after fighter check-in, before the initial picture [IV.11].
- **PICTURE**: core information before COMMIT; traditional labels or LEADING EDGE after. Formats in [[Picture_Call_Logic|Picture_Call_Logic]].
- **COMMIT** [V.3]: criteria are mission-planned. With controller authority: `WARRIOR, TEN GROUPS, GROUP ROCK 2-5-0/45, THIRTY-FIVE THOUSAND, TRACK EAST, HOSTILE, RAPTOR COMMIT.` → `RAPTOR 1.` Without it: `…, RECOMMEND RAPTOR COMMIT.`
- **TAC RANGE** [V.4]: default 60 nm, closest fighter to closest group: `EAGLE 11, NORTH GROUP TAC RANGE.`
- **Targeting** [V.5]: `HORNET 2, TARGET NORTH GROUP.` / fighter `RAMBO 2, TARGETED WEST GROUP` (with BULLSEYE without a data link). Controllers QC targeting that does not correlate.
- **UNTARGETED** fill-in for a priority group not targeted inside targeting range [IV.2.c].
- **BOGEY DOPE / BRAA** [V.11]: `MIKE, EAGLE 11 BOGEY DOPE NORTH GROUP.` → `EAGLE 11, NORTH GROUP BRAA 2-1-0/28, THIRTY-EIGHT THOUSAND, HOT, HOSTILE.`
- **DECLARE** [V.7]: `DARKSTAR, VIPER 1, DECLARE BULLSEYE 2-3-0/12, TWELVE THOUSAND.` → BULLSEYE, altitude, track, declaration, fill-ins.
- **THREAT** [V.17]: default 35 nm, independent of aspect: `HEAT 31, ADDITIONAL GROUP THREAT, BRAA 1-2-5/35, THIRTY-FIVE THOUSAND, HOT, HOSTILE.`

## Fuel and weapons status [III.6]

GREEN assumed. YELLOW: approaching too little to continue; RED: too little to continue. Aircraft must report YELLOW; TAC C2 arranges relief before RED is called on the primary NET: `RAMBO 01, FUEL RED, WEAPONS GREEN.`

## Inflight report and recovery [II.11–12]

- **INFLTREP** on check-out or before RTB: call sign, mission number, known blue attrition, mission results, red tactics observed, state and intentions. Read back `COPY (CALLSIGN MISSION NUMBER), LINE 3 DETAILS.`
- **Returning forces**: verify squawks before friendly MEZ entry, collect results, run wounded bird / battle damage / hung ordnance procedures, pass home-plate weather and status.

---

*Source: ALSSA ACC, ATP 3-52.4 / MCRP 3-20F.10 / NTTP 6-02.9 / AFTTP 3-2.8, 09 OCT 2024, Distribution A. Paraphrased.*
