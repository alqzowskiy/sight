# Sight Globe — Enhanced Interactivity Plan

The globe is the centerpiece of Sight. Right now it's a beautiful 3D Earth with markers and static arcs. This plan turns it into **a living, interactive instrument** that tells the story of NovaPay's financial life in real time.

Every enhancement below has been chosen for one reason: it makes the globe **more alive**, **more useful**, or **more impressive**, without breaking what already works.

The enhancements are ordered by combination of **wow factor** and **implementation effort**. Start with the highest-impact ones.

---

## Hard constraints (do not violate)

- Performance stays at 60 fps. If anything stutters, scale it down
- No emojis on the globe
- All visuals match existing brand (white background, accent blue #2563EB, status colors)
- Globe canvas mechanics from cobe stay intact — extensions live as overlays
- Every new feature has a fallback (toggle off, or graceful degrade)
- No external assets — everything is computed in-browser

---

## Enhancement 1 — Animated Money Flow (top priority)

The globe should show money moving across the world **continuously**, even when the user isn't interacting. This is the single most important enhancement.

### What it looks like

Every 2-4 seconds, a "transaction" appears: a small glowing dot starts at one account marker, travels along an arc to another marker, and arrives with a small flash. The arc itself fades in and out, leaving the dot as the focus.

Visually:

```
   [EUR-Frankfurt]
         \
          \  ← thin glowing arc
           \
            ●  ← moving dot, leaves a fading trail
             \
              \
               [USD-NYC]
```

While the dot is in flight, a tiny label follows it: `$120K · SEPA`.

When the dot reaches the destination, the destination marker briefly pulses (one cycle of brightness, 400ms), and the arc fades away over 600ms.

### Data source — make it feel real

The animations should not be random noise. They should reflect **realistic transactions** based on real account relationships.

Create `lib/data/transaction-flows.ts`:

```typescript
export const TYPICAL_FLOWS = [
  { from: "eur-frankfurt", to: "eur-paris", weight: 8, channels: ["SEPA_INSTANT", "SEPA_STANDARD"], amounts: [50000, 1500000] },
  { from: "eur-paris", to: "eur-frankfurt", weight: 6, channels: ["SEPA_INSTANT"], amounts: [20000, 800000] },
  { from: "usd-nyc", to: "usd-sf", weight: 5, channels: ["ACH"], amounts: [100000, 2000000] },
  { from: "visa-eur", to: "eur-frankfurt", weight: 12, channels: ["VISA"], amounts: [5000, 200000] },
  { from: "mc-usd", to: "usd-nyc", weight: 10, channels: ["MASTERCARD"], amounts: [3000, 150000] },
  { from: "eur-frankfurt", to: "usd-nyc", weight: 3, channels: ["SWIFT"], amounts: [500000, 5000000] },
  { from: "gbp-london", to: "eur-frankfurt", weight: 4, channels: ["SWIFT"], amounts: [100000, 1200000] },
  { from: "sgd-singapore", to: "usd-nyc", weight: 2, channels: ["SWIFT"], amounts: [200000, 800000] },
  { from: "chf-zurich", to: "eur-frankfurt", weight: 3, channels: ["SWIFT"], amounts: [50000, 600000] },
  { from: "fx-hedging", to: "usd-nyc", weight: 2, channels: ["INTERNAL"], amounts: [100000, 500000] },
  // include reverse directions too
]

export function pickRandomFlow() {
  const totalWeight = TYPICAL_FLOWS.reduce((s, f) => s + f.weight, 0)
  let r = Math.random() * totalWeight
  for (const flow of TYPICAL_FLOWS) {
    r -= flow.weight
    if (r <= 0) return flow
  }
  return TYPICAL_FLOWS[0]
}
```

Weights make some flows much more common than others — Visa to operational accounts (frequent small clearings) versus SWIFT cross-border (rare large transfers). This creates realistic distribution patterns.

For amounts, sample log-normal between the min and max range of the flow:

```typescript
function sampleAmount(min, max) {
  const logMin = Math.log(min)
  const logMax = Math.log(max)
  return Math.exp(logMin + Math.random() * (logMax - logMin))
}
```

### Animation timing

- **Spawn rate:** new transaction every 2-4 seconds (jittered)
- **Travel duration:** 1000-1800ms based on channel:
  - SEPA Instant: 1000ms
  - SEPA Standard: 1200ms
  - VISA/MASTERCARD: 1400ms
  - SWIFT: 1800ms (the slowest channel takes the longest)
  - INTERNAL: 800ms
- **Arc fade in:** 200ms
- **Arc fade out after dot arrives:** 600ms
- **Destination pulse on arrival:** 400ms single cycle

The fact that SWIFT visually takes longer than SEPA is **a small teaching moment** — viewers absorb that channels have different speeds without being told.

### Visual style per channel

Different channels should look subtly different:

| Channel | Color | Style |
|---|---|---|
| SEPA_INSTANT | Bright accent blue | Solid line |
| SEPA_STANDARD | Soft accent blue | Solid line |
| VISA | Dark gray | Solid line |
| MASTERCARD | Dark gray | Solid line |
| SWIFT | Black, slightly thicker | Solid line |
| INTERNAL | Light gray | Dashed line |

Dots travelling along these arcs share the arc's color but slightly brighter and with a small glow.

### Implementation approach

The cobe globe renders the base sphere and static markers/arcs on canvas. The animated flow lives on **a separate SVG overlay** positioned on top of the canvas.

```typescript
function MoneyFlowOverlay({ globeWidth, globePhi, globeTheta }) {
  const [activeFlows, setActiveFlows] = useState<ActiveFlow[]>([])
  
  useEffect(() => {
    const spawnInterval = setInterval(() => {
      const flow = pickRandomFlow()
      const fromAccount = accounts.find(a => a.id === flow.from)
      const toAccount = accounts.find(a => a.id === flow.to)
      if (!fromAccount || !toAccount) return
      
      const newFlow: ActiveFlow = {
        id: nanoid(),
        from: fromAccount.location,
        to: toAccount.location,
        amount: sampleAmount(...flow.amounts),
        channel: flow.channels[Math.floor(Math.random() * flow.channels.length)],
        startedAt: Date.now(),
        duration: getDurationForChannel(flow.channel),
      }
      
      setActiveFlows(prev => [...prev, newFlow])
      
      setTimeout(() => {
        setActiveFlows(prev => prev.filter(f => f.id !== newFlow.id))
      }, newFlow.duration + 600)
    }, 2000 + Math.random() * 2000)
    
    return () => clearInterval(spawnInterval)
  }, [])
  
  return (
    <svg className="absolute inset-0 pointer-events-none">
      {activeFlows.map(flow => (
        <FlowParticle key={flow.id} flow={flow} globeProjection={...} />
      ))}
    </svg>
  )
}
```

For projecting `[lat, lng]` to screen pixels, you need to compute the same orthographic projection cobe uses. Either:

1. **Read cobe's internal phi/theta** through a ref, replicate the projection in JavaScript
2. **Render arcs through cobe itself** by mutating its `arcs` array — but cobe's arc API doesn't support dynamic addition/removal at high frequency

Option 1 is cleaner. The math:

```typescript
function projectToScreen(lat, lng, globePhi, globeTheta, globeWidth) {
  const phi = (lng * Math.PI) / 180 + globePhi
  const theta = (lat * Math.PI) / 180 + globeTheta
  
  const x = Math.cos(theta) * Math.cos(phi)
  const y = Math.sin(theta)
  const z = Math.cos(theta) * Math.sin(phi)
  
  if (z < 0) return null  // back side of globe
  
  const radius = globeWidth / 2
  return {
    x: globeWidth / 2 + x * radius * 0.9,
    y: globeWidth / 2 - y * radius * 0.9,
    visible: true,
  }
}
```

Track the rotation state of the globe via a ref that cobe updates each frame.

### Bezier curve for arc shape

Don't draw straight lines on the SVG. Bend them upward to mimic geographic arcs:

```typescript
function arcPath(from, to) {
  const mid = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2 - distance(from, to) * 0.4,
  }
  return `M ${from.x} ${from.y} Q ${mid.x} ${mid.y} ${to.x} ${to.y}`
}
```

The arc height is proportional to the distance — longer transfers visually arc higher, just like on cobe's own arcs.

### Particle along the arc

Use SVG `<animateMotion>` or compute manually:

```tsx
<circle r="3" fill={channelColor}>
  <animateMotion
    dur={`${flow.duration}ms`}
    fill="freeze"
    path={arcPathString}
  />
</circle>
```

Or with Motion (more control):

```tsx
const progress = useMotionValue(0)

useEffect(() => {
  animate(progress, 1, { duration: flow.duration / 1000, ease: "easeInOut" })
}, [])

const pointOnArc = useTransform(progress, (t) => evaluateBezier(t, from, mid, to))
```

### Label following the particle

A small label travels with the dot. Use `position: absolute` with transform from the same projection.

```tsx
<div
  className="absolute text-[10px] font-mono bg-black text-white px-1 py-0.5 rounded pointer-events-none"
  style={{ left: pointX, top: pointY - 18, opacity: progressOpacity }}
>
  ${formatCompact(flow.amount)} · {flow.channel.split("_")[0]}
</div>
```

Label fades in at 200ms, fades out at the destination.

### Performance limits

- Cap maximum simultaneous flows at 8. If more queued, skip them.
- Pause spawning when the user is dragging the globe (already a paused state in cobe)
- Pause when window is not focused
- Throttle the SVG re-render to requestAnimationFrame
- Use `transform: translateZ(0)` on overlay elements to encourage GPU compositing

### Toggle control

Add a small button in a corner of the globe area: "Live activity" with an on/off toggle. Default on. Some users (or for debugging) may want to turn it off.

When off: no new flows spawn, existing flows finish their animation.

---

## Enhancement 2 — Hover Insight Cards

When the user hovers over an account marker or an arc, show a beautifully formatted card with key information. This converts the globe from a pretty visualization into a **navigable data interface**.

### Account marker hover

When user hovers a marker, show a floating card next to it (offset by 16px, smart positioning to avoid edges):

```
┌─────────────────────────────────────┐
│  USD · NYC                           │
│  NovaPay USD · JPMorgan              │
│                                       │
│  $320,000                            │
│  Below min ($800,000)  ⚠ critical    │
│                                       │
│  ─────────────────────────────────   │
│                                       │
│  Recent activity (last 7d):           │
│  ↓ Outflows  -$1.4M                  │
│  ↑ Inflows   +$890K                  │
│                                       │
│  Next 3 days forecast:                │
│  ▼ Will drop to $180K by May 21      │
│  ◆ Confidence: 92%                   │
│                                       │
│  Press space to open detail panel    │
└─────────────────────────────────────┘
```

Card uses brand colors. Status badge on the right side. Numbers in Geist Mono.

Hover delay: 200ms (don't trigger on accidental flyovers). Hide on mouseleave with 100ms delay.

### Arc hover

When user hovers an arc (animated or static), show a card:

```
┌─────────────────────────────────────┐
│  Transfer in flight                   │
│                                       │
│  EUR-Frankfurt → USD-NYC             │
│  $1,200,000  ·  SWIFT                │
│                                       │
│  Initiated: 2 days ago                │
│  Expected settlement: today           │
│  Status: clearing                     │
└─────────────────────────────────────┘
```

For animated flow arcs, click on the arc pauses the animation briefly and shows the card. Click elsewhere unpauses.

### Implementation

Use Radix Tooltip or Popover for positioning logic, or roll your own with `getBoundingClientRect()` and viewport-aware placement.

Hover detection on canvas elements is tricky. You need to:
1. Compute on every mouse-move which screen pixel they're over
2. Reverse-project to globe coordinates
3. Find nearest marker within a threshold (e.g., 12px)
4. If hovering, show the card

For arcs, this is harder because they're curves. Approximation: hit-test the SVG overlay paths (browsers handle this natively).

For markers (drawn by cobe on canvas), maintain a parallel array of computed screen positions per frame and hit-test on mousemove.

---

## Enhancement 3 — Connection Web (Relationship Visualization)

When user **hovers an account card on the dashboard** or **clicks an account marker on the globe**, the globe enters "Focus mode":

- The selected marker is highlighted (larger, glowing ring)
- All accounts it has had transfers with in the last 30 days have **soft outline arcs** drawn to them
- All other markers dim to 30% opacity
- Tooltip near the selected marker shows: "Connected to 6 accounts"

The connections show **financial relationships at a glance**. You see which accounts feed each other.

### Data

Compute connections from the existing `transactions.parquet` or from `transaction-flows.ts`:

```typescript
export function getConnections(accountId: string): Array<{ to: string; weight: number }> {
  return TYPICAL_FLOWS
    .filter(f => f.from === accountId || f.to === accountId)
    .map(f => ({
      to: f.from === accountId ? f.to : f.from,
      weight: f.weight,
    }))
}
```

Stronger connections (more weight) draw with thicker lines.

### Visual

Connection arcs are different from money-flow arcs:
- Lighter color (gray, 40% opacity)
- No animation, just steady arcs
- Drawn only while in Focus mode
- Thickness proportional to historical transfer frequency

When user clicks elsewhere or presses Escape, exit Focus mode and arcs fade out over 400ms.

### Triggers

- Click on marker → enter Focus mode for that account
- Hover on account card in sidebar → enter Focus mode for that account (release on mouseleave)
- Press Escape → exit Focus mode
- Click on different marker → switch Focus mode to that account

---

## Enhancement 4 — Camera Auto-Focus

When something **significant** happens — a critical alert appears, a Sight Compass execution runs — the globe should **smoothly rotate** to bring the affected account into view.

### Triggers

- Alert appears for an account: globe rotates to center it (1.2s easing)
- User clicks "Execute Plan": globe rotates to show both source and destination
- Time Machine crosses a threshold where an account becomes critical: globe rotates to show the troubled account
- User clicks on an account card: globe rotates to that account

### Implementation

The cobe globe exposes `phi` and `theta` (rotation parameters). Animate them with easing:

```typescript
function focusOnAccount(accountId: string) {
  const account = accounts.find(a => a.id === accountId)
  const targetPhi = -(account.location[1] * Math.PI) / 180
  const targetTheta = (account.location[0] * Math.PI) / 180 - 0.2
  
  animate(currentPhi, targetPhi, {
    duration: 1.2,
    ease: cubicBezier(0.4, 0, 0.2, 1),
    onUpdate: (v) => { phiOffsetRef.current = v }
  })
  animate(currentTheta, targetTheta, {
    duration: 1.2,
    ease: cubicBezier(0.4, 0, 0.2, 1),
    onUpdate: (v) => { thetaOffsetRef.current = v }
  })
}
```

The current cobe component already has `phiOffsetRef` and `thetaOffsetRef` for drag offsets — reuse the same machinery.

### After-focus effect

After the rotation completes, the target marker gets a brief "spotlight" effect:

- A soft expanding circle rings out from the marker (200% size, fade to 0 opacity over 800ms)
- The marker itself pulses once

This makes the focus feel **intentional**, not random.

### Auto-rotation handling

When auto-focus triggers, pause the slow auto-rotation. After 3 seconds of no user interaction, resume auto-rotation from the new orientation.

---

## Enhancement 5 — Time-Aware Visual States

The globe should look subtly different depending on whether the user is viewing past, present, or future.

### Present (offset = 0)

Default state. Full saturation, normal opacity.

### Future (offset > 0)

- Slight desaturation on markers (lower saturation HSL, by about 15%)
- Top-right of globe area shows a subtle badge:
  ```
  ┌──────────────────┐
  │  ◆ FORECAST       │
  │  +5 days          │
  └──────────────────┘
  ```
- Money flow arcs become slightly faded (60% opacity) — these are "would happen" not "is happening"
- Recommended transfers appear with stronger visual weight (dashed accent-blue arcs)
- Critical markers pulse more intensely

### Past (offset < 0)

- Subtle cool tint overlay on the globe (slight blue cast on the dark side)
- Top-right badge:
  ```
  ┌──────────────────┐
  │  ◆ HISTORY        │
  │  7 days ago       │
  └──────────────────┘
  ```
- Money flow animation shows historical transactions (slightly slower)
- Recommended transfer arcs are hidden (we weren't predicting back then)
- Auto-rotation continues normally

### Implementation

These states are driven by the existing `timeStore.currentOffset`. Components subscribe and adjust styles.

Globe color tinting can be done via:
- A semi-transparent colored overlay div over the canvas
- Or by adjusting cobe's `glowColor` and `markerColor` props dynamically

---

## Enhancement 6 — Globe Mood (Health-Based Atmosphere)

The globe itself communicates the company's overall health through its atmosphere.

When Liquidity Score is computed and updated, adjust the globe's appearance:

| Liquidity Score | Visual effect |
|---|---|
| 90-100 (excellent) | Subtle white glow, brighter atmosphere |
| 70-89 (healthy) | Default appearance |
| 50-69 (watch) | No glow, neutral |
| 30-49 (stressed) | Very faint cool blue tint to the entire globe |
| 0-29 (critical) | Slight red tint, atmosphere pulses gently every 2 seconds |

This is **subtle**. Not a flashing red emergency. Just a feeling that something is off.

### Implementation

The cobe globe has a `glowColor` parameter as RGB. Animate it based on score:

```typescript
function computeGlowColor(score: number): [number, number, number] {
  if (score >= 90) return [0.94, 0.96, 1.0]  // white-blue
  if (score >= 70) return [0.94, 0.93, 0.91]  // default warm white
  if (score >= 50) return [0.92, 0.92, 0.92]  // neutral
  if (score >= 30) return [0.85, 0.88, 0.95]  // cool blue
  return [0.95, 0.85, 0.85]  // soft red
}
```

For pulsing in critical state: animate the glow alpha or use a separate radial gradient overlay.

---

## Enhancement 7 — Currency Cluster Highlighting

Filter chips above or beside the globe to highlight by currency:

```
[ All ]  [ EUR ]  [ USD ]  [ GBP ]  [ SGD ]  [ CHF ]
```

Click a currency: all non-matching markers dim to 15% opacity. Arcs involving the currency become more prominent.

This turns the globe into a **filter-able dataset**. You can see at a glance: "all EUR money lives in Frankfurt and Paris."

### Implementation

Simple — add a filter state. Pass it to the globe component which applies opacity adjustments per marker.

Multi-select: hold Shift and click multiple currencies to combine.

Same pattern for filtering by account type (Operational / Settlement / Reserve).

---

## Enhancement 8 — Globe Action Toolbar

A compact toolbar in the bottom-right of the globe area:

```
┌────────────────────────────┐
│  ◐  ⊙  ⟲  ⤢  ⓘ              │
└────────────────────────────┘
```

Icons (use Lucide):
- **Toggle Day/Night** — change cobe's `dark` parameter (0 = light, 1 = dark). Allows night-mode globe with darker oceans
- **Center on Selected** — re-centers the globe on the currently selected account
- **Reset Camera** — returns to default rotation
- **Fullscreen** — expands globe to full viewport, hides sidebars (Escape exits)
- **Info** — opens a small overlay explaining the globe legend (markers, arcs, colors)

Subtle, minimal, accessible. Doesn't distract from the globe but adds power-user control.

---

## Enhancement 9 — Performance Heat Indicator

A tiny indicator showing globe rendering performance:

```
60 fps ● smooth
```

In a corner, always visible. Drops to red if framerate suffers.

This is mostly for development, but on demo day it **reassures judges** that what they're seeing is real-time, not pre-rendered. A subtle technical signal.

Implementation: measure frame times in the animation loop, exponential moving average.

---

## Enhancement 10 — Pulse Effects on Significant Events

Three event types each get a distinct globe-wide visual:

### Alert fires (critical)

When a new critical alert appears:
- The affected marker grows briefly (scale 1.0 → 1.4 → 1.0 over 800ms)
- A red ring expands outward from the marker and fades (like a sonar ping)
- Subtle dim of all other markers for 600ms to emphasize the alert location

### Compass runs

When user clicks "Apply Compass":
- The globe momentarily desaturates and brightens
- Multiple arcs are drawn in quick succession (250ms apart)
- Each arc traces in with a leading particle
- After all arcs complete, the globe briefly glows accent-blue and returns to normal

### Crisis scenario activates

When a stress scenario is toggled on in Crisis Mode:
- The globe briefly tints red for 400ms then settles
- Affected markers re-render with new statuses

These effects are sound-track-like — they punctuate moments and make the dashboard feel cinematic.

---

## What to ship by priority

If you have limited time, build in this order:

**Must have:**
1. Enhancement 1 — Animated Money Flow (this is the wow)

**Should have:**
2. Enhancement 2 — Hover Insight Cards
3. Enhancement 4 — Camera Auto-Focus

**Nice to have:**
4. Enhancement 5 — Time-Aware Visual States
5. Enhancement 10 — Pulse Effects on Significant Events
6. Enhancement 6 — Globe Mood

**Power features:**
7. Enhancement 3 — Connection Web
8. Enhancement 7 — Currency Cluster Highlighting
9. Enhancement 8 — Globe Action Toolbar

**Polish:**
10. Enhancement 9 — Performance Heat Indicator

---

## File structure

```
/components/globe
  sight-globe.tsx              ← existing, the cobe wrapper
  money-flow-overlay.tsx       ← new, SVG overlay for animated flows
  globe-hover-card.tsx         ← new, popover for marker/arc hover
  globe-toolbar.tsx            ← new, action toolbar
  globe-mood.tsx               ← new, atmosphere effects
  globe-pulse.tsx              ← new, event-driven pulse animations
  
/lib/globe
  projection.ts                ← screen projection math
  flow-data.ts                 ← TYPICAL_FLOWS and helpers
  connections.ts               ← account relationships
```

---

## Visual style consistency

All these enhancements must match Sight's existing brand:

- Geist Mono for all numbers
- Accent blue #2563EB only for primary interactive elements (the dot color for SEPA, focus rings, etc.)
- Status colors used only for status (critical red, warning orange, success green)
- White background, black text, thin borders
- Rounded corners 4-8px max, no heavy shadows
- Animations smooth and intentional, never bouncy or playful

If anything starts to feel "fancy" rather than "professional", scale it back. The globe is a financial instrument, not a screensaver.

---

## Completion criteria

For Enhancement 1 alone:
- [ ] Money-flow particles spawn every 2-4 seconds
- [ ] Particles travel along Bezier curves between actual account locations
- [ ] Channel determines color and travel speed
- [ ] Labels follow particles with amount and channel
- [ ] Destination marker pulses on particle arrival
- [ ] Maximum 8 concurrent flows enforced
- [ ] Animation pauses when user drags globe
- [ ] Animation pauses when window unfocused
- [ ] Toggle on/off control in the globe area
- [ ] No frame drops at 60fps with all flows active

For full plan:
- [ ] All ten enhancements working in harmony
- [ ] Smooth performance even with multiple effects active
- [ ] Visual style consistent throughout
- [ ] Mobile fallback for under-1024px still works
- [ ] No console errors
- [ ] No emojis on the globe

---

## Why this matters

The globe is the **face of Sight**. It's what people see in the first 3 seconds of the demo. It's what they remember when describing the product to others.

Right now the globe is impressive but **static**. With these enhancements, the globe becomes:

- **Alive** — money flows continuously, even when no one is watching
- **Useful** — hover any element to learn more, click to navigate
- **Cinematic** — events have visual punctuation, the camera follows the story
- **Defensible** — every visual choice maps to real data

A judge looking at this dashboard sees a financial system in motion. Not a mockup. Not a portfolio piece. **A working product**.

Build it.