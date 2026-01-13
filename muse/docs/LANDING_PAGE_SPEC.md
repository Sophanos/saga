# Rhei Landing Page Spec

> Design brief for rhei.team landing page
> Philosophy: Calm, focused, no dopamine tricks
> Reference: iA Writer homepage structure

---

## iA Writer Pattern Analysis

```
┌─────────────────────────────────────────────────────────┐
│  SECTION STRUCTURE (alternating light/dark)             │
├─────────────────────────────────────────────────────────┤
│  1. Hero (light)      - Philosophical statement         │
│  2. Feature (dark)    - Direct question headline        │
│  3. Feature (light)   - Tool benefit + demo             │
│  4. Feature (dark)    - Tool benefit + demo             │
│  5. Comparison (dark) - "Why not X?" + side-by-side     │
│  6. Feature (light)   - Workflow benefit                │
│  7. Platform (dark)   - Device mockups                  │
│  8. Social proof      - Press logos + quotes            │
│  9. CTA (dark)        - Final call to action            │
└─────────────────────────────────────────────────────────┘

HEADLINE PATTERNS:
- Philosophical: "Imagine a place where all you can do is write."
- Direct question: "Did I write this? Was it Claude?"
- Benefit statement: "Style Check flags clichés, fillers, and clutter."
- Challenge: "Why not just use Word? It has more features."

LAYOUT PATTERNS:
- Big headline (40-60px)
- Editor mockup below
- Two-column explanation at bottom of section
```

---

## Animation Philosophy

```
┌─────────────────────────────────────────┐
│                                         │
│   Calm. Not flashy.                     │
│   Purposeful. Not decorative.           │
│   Subtle. Not distracting.              │
│                                         │
│   Like water flowing. Like breath.      │
│                                         │
└─────────────────────────────────────────┘
```

**Principles:**
- Animations guide attention, not grab it
- Easing: ease-out (natural deceleration)
- Duration: 300-600ms (never jarring)
- No bounce, no overshoot, no particle effects
- Inspired by: iA Writer, Linear, Notion (calm parts)

---

## Color Palette

```
Background:    #0A0A0B (near black)
Surface:       #141416 (cards, elevated)
Text:          #FAFAFA (primary)
Text muted:    #71717A (secondary)
Accent:        #3B82F6 (blue, links, CTAs)
Accent glow:   #3B82F6 / 20% opacity (subtle halos)

Flow gradient: #3B82F6 → #8B5CF6 → #EC4899
               (blue → purple → pink, like flowing water)
```

---

## Typography

```
Headings:      Inter or SF Pro Display
               Weight: 600-700
               Size: 48-72px (hero), 32-40px (sections)

Body:          Inter or SF Pro Text
               Weight: 400
               Size: 18-20px
               Line-height: 1.6

Mono:          JetBrains Mono or SF Mono
               For code examples, /commands
```

---

## Hero Section

### Layout
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Nav: [Logo]                    [Features] [Pricing] [→]│
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                                                         │
│         We notice. You focus.                           │
│                                                         │
│         Rhei remembers everything you wrote.            │
│         Catches contradictions before readers do.       │
│         Stays silent until you're ready.                │
│                                                         │
│                  [Start writing →]                      │
│                                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              [ Editor Demo Animation ]                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Hero Animation: "The Flow"

**Concept:** Subtle flowing gradient that responds to scroll, like water

```
Animation: flowGradient
├─ Background: radial gradient with 2-3 color stops
├─ Movement: slow drift (60s cycle), imperceptible
├─ On scroll: gradient shifts position slightly
├─ On hover (CTA): gentle pulse
└─ Performance: CSS only, no JS animation loop
```

**Text Animation:**

```
Animation: fadeUpStagger
├─ Each line fades in + moves up 20px
├─ Stagger: 100ms between lines
├─ Duration: 600ms per element
├─ Easing: cubic-bezier(0.16, 1, 0.3, 1)
└─ Trigger: on page load
```

```css
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero-line {
  animation: fadeUp 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
}
.hero-line:nth-child(1) { animation-delay: 0ms; }
.hero-line:nth-child(2) { animation-delay: 100ms; }
.hero-line:nth-child(3) { animation-delay: 200ms; }
```

---

## Editor Demo Animation

**Concept:** Show Flow Mode in action - typing, then contradiction appears

```
┌─────────────────────────────────────────────────────────┐
│  ○ ○ ○                    chapter-3.md              ⋯   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Marcus stepped into the light, his brown eyes          │
│  narrowing against the glare.                           │
│                                        ───────          │
│                                        underline        │
│                                        appears          │
│                                                         │
│  ┌─────────────────────────────────────┐                │
│  │ ⚠ Marcus has blue eyes (Ch 2, ln 47)│                │
│  │                                     │                │
│  │ [Ignore] [Fix] [Update canon]       │                │
│  └─────────────────────────────────────┘                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Sequence:**

```
Timeline: editorDemo (loop: true, delay: 3s between loops)
│
├─ 0.0s   Editor appears (fade in)
├─ 0.5s   Cursor appears, blinking
├─ 1.0s   Text types: "Marcus stepped into the light, his "
│         (typewriter effect, 40ms per char)
├─ 2.5s   Text types: "brown eyes"
├─ 3.0s   Pause (user "realizes")
├─ 3.5s   Underline animates under "brown eyes"
│         (width: 0 → 100%, 300ms, ease-out)
├─ 4.0s   Tooltip fades in from below (opacity + translateY)
├─ 5.5s   Pause (let user read)
├─ 6.0s   "Fix" button highlights (subtle pulse)
├─ 6.5s   Click animation on "Fix"
├─ 7.0s   "brown" → "blue" (crossfade, 200ms)
├─ 7.5s   Underline fades out
├─ 8.0s   Tooltip fades out
├─ 9.0s   Hold final state
└─ 12.0s  Reset and loop
```

**CSS for typewriter:**

```css
.typewriter {
  overflow: hidden;
  border-right: 2px solid #3B82F6;
  white-space: nowrap;
  animation:
    typing 2s steps(40, end),
    blink 0.75s step-end infinite;
}

@keyframes typing {
  from { width: 0 }
  to { width: 100% }
}

@keyframes blink {
  50% { border-color: transparent }
}
```

---

## Feature Sections

### Section 1: Flow Mode

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────────┐                                       │
│  │              │     100% focused.                     │
│  │  [Animation: │     Just write.                       │
│  │   Focus      │                                       │
│  │   dimming]   │     Flow Mode dims everything but     │
│  │              │     your current sentence. Rhei       │
│  │              │     watches quietly.                  │
│  └──────────────┘                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Animation: focusDimming**

```
Sequence:
├─ Show paragraph of text
├─ Cursor moves to middle sentence
├─ Other sentences fade to 30% opacity (400ms, ease-out)
├─ Current sentence stays 100%
├─ Subtle glow behind current sentence
├─ Cursor blinks, types a few characters
├─ Hold, then cursor moves to next sentence
└─ Dim/focus transitions (loop)
```

---

### Section 2: Coherence

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     Never forget                 ┌──────────────┐       │
│     what you wrote.              │              │       │
│                                  │ [Animation:  │       │
│     Marcus has blue eyes         │  Entity      │       │
│     in chapter 2? Rhei           │  linking]    │       │
│     remembers.                   │              │       │
│                                  └──────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Animation: entityLinking**

```
Sequence:
├─ Show two text snippets (Ch 2 and Ch 15)
├─ "Marcus" highlights in both (simultaneous)
├─ Connecting line draws between them (SVG path animation)
├─ Entity card appears: "Marcus: blue eyes, 32 years old..."
├─ Line pulses once (subtle)
└─ Hold, then reset
```

```css
.connecting-line {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: drawLine 800ms ease-out forwards;
}

@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}
```

---

### Section 3: Knowledge PRs

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────────┐                                       │
│  │              │     Approve before                    │
│  │ [Animation:  │     it's canon.                       │
│  │  PR diff     │                                       │
│  │  review]     │     Changed a character's backstory?  │
│  │              │     Review the ripple effects.        │
│  └──────────────┘     Merge when ready.                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Animation: prReview**

```
Sequence:
├─ Show diff view: "- blue eyes" / "+ green eyes"
├─ "Affected" section expands below
├─ 3 items fade in staggered: "Ch 2", "Ch 7", "Ch 15"
├─ Checkmark animates next to each (SVG stroke)
├─ "Merge" button pulses
├─ Click → all items collapse into "✓ Merged"
└─ Reset
```

---

### Section 4: Quick Start

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     /widget and go.              ┌──────────────┐       │
│                                  │              │       │
│     No setup wizard.             │ [Animation:  │       │
│     No onboarding wall.          │  Command     │       │
│     Type a command.              │  palette]    │       │
│     Start creating.              │              │       │
│                                  └──────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Animation: commandPalette**

```
Sequence:
├─ Command palette appears (scale 0.95 → 1, fade in)
├─ Cursor in input
├─ Types: "/character" (typewriter, fast)
├─ Dropdown filters in real-time
├─ Selects "Create character"
├─ Form slides in
├─ Quick fill: "Marcus", "32", "blue eyes"
├─ "Create" → success animation (checkmark)
└─ Palette closes (scale 1 → 0.95, fade out)
```

---

### Section 5: No Dopamine

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────────────────────────────────────────┐       │
│  │                                              │       │
│  │   No streaks.  No badges.  No notifications. │       │
│  │   ─────────    ─────────   ───────────────   │       │
│  │   [struck]     [struck]    [struck]          │       │
│  │                                              │       │
│  │   Just calm tools that help you write.       │       │
│  │                                              │       │
│  └──────────────────────────────────────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Animation: strikethrough**

```
Sequence:
├─ "No streaks." appears
├─ Line draws through "streaks" (left to right, 300ms)
├─ Pause 200ms
├─ "No badges." appears
├─ Line draws through "badges"
├─ Pause 200ms
├─ "No notifications." appears
├─ Line draws through "notifications"
├─ Pause 500ms
├─ Bottom line fades in: "Just calm tools..."
└─ Hold
```

```css
.strikethrough {
  position: relative;
}

.strikethrough::after {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 0;
  height: 2px;
  background: currentColor;
  animation: strike 300ms ease-out forwards;
}

@keyframes strike {
  to { width: 100%; }
}
```

---

## Scroll Animations

**Trigger:** Elements animate when entering viewport (IntersectionObserver)

```
Default entrance:
├─ opacity: 0 → 1
├─ transform: translateY(30px) → translateY(0)
├─ duration: 600ms
├─ easing: cubic-bezier(0.16, 1, 0.3, 1)
└─ threshold: 0.2 (20% visible)
```

**Stagger for lists:**
```
├─ Each item: +100ms delay
├─ Max 5 items staggered
└─ Items 6+ animate together
```

---

## Micro-interactions

### Buttons

```
Hover:
├─ background lightens 10%
├─ transform: translateY(-2px)
├─ box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3)
└─ duration: 200ms

Click:
├─ transform: translateY(0) scale(0.98)
└─ duration: 100ms
```

### Links

```
Hover:
├─ color transitions to accent
├─ underline draws left-to-right
└─ duration: 200ms
```

### Cards

```
Hover:
├─ border-color: accent / 50%
├─ transform: translateY(-4px)
├─ box-shadow increases
└─ duration: 300ms
```

---

## Navigation

```
┌─────────────────────────────────────────────────────────┐
│  [ῥεῖ Rhei]          Features  Pricing  Docs    [→ App] │
└─────────────────────────────────────────────────────────┘
```

**Scroll behavior:**
```
├─ Initially transparent
├─ On scroll (>100px): background blur + subtle border
├─ Transition: 300ms
└─ Logo stays visible always
```

```css
.nav {
  backdrop-filter: blur(0);
  background: transparent;
  border-bottom: 1px solid transparent;
  transition: all 300ms ease;
}

.nav.scrolled {
  backdrop-filter: blur(12px);
  background: rgba(10, 10, 11, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
```

---

## Footer

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ῥεῖ Rhei                                               │
│  Panta Rhei — everything flows.                         │
│                                                         │
│  Product        Company        Legal                    │
│  Features       About          Privacy                  │
│  Pricing        Blog           Terms                    │
│  Docs           Careers                                 │
│                                                         │
│  © 2026 Rhei · Made for writers who remember.           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Mobile Considerations

```
Breakpoints:
├─ Desktop: > 1024px
├─ Tablet: 768px - 1024px
└─ Mobile: < 768px

Mobile adjustments:
├─ Hero text: 32-40px (not 48-72px)
├─ Animations: reduced motion respected
├─ Editor demo: simplified or static image
├─ Nav: hamburger menu
└─ Sections: single column
```

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Tech Stack (suggested)

```
Framework:     Next.js 14 (App Router)
Styling:       Tailwind CSS + CSS variables
Animations:    Framer Motion or CSS-only
Icons:         Lucide
Fonts:         Inter (Google Fonts) or SF Pro (system)
Hosting:       Vercel
```

---

## Assets Needed

```
├─ Logo: ῥεῖ symbol + "Rhei" wordmark (SVG)
├─ Editor mockup: dark theme, realistic
├─ Diff view mockup: PR-style
├─ Command palette mockup
├─ OG image: 1200x630px
└─ Favicon: ῥεῖ symbol
```

---

## Copy Checklist

| Section | Headline | Subhead |
|---------|----------|---------|
| Hero | We notice. You focus. | Rhei remembers everything... |
| Flow | 100% focused. Just write. | Flow Mode dims everything... |
| Coherence | Never forget what you wrote. | Marcus has blue eyes... |
| PRs | Approve before it's canon. | Changed a character's backstory... |
| Quick Start | /widget and go. | No setup wizard... |
| No Dopamine | No streaks. No badges. | Just calm tools... |
| CTA | Start writing | Your story's memory awaits. |

---

## Full Page Structure (iA Writer style)

### Section 1: Hero (Light)
**Pattern:** Philosophical statement

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Imagine a place where your story                       │
│  remembers itself. Where you write                      │
│  forward, and nothing falls behind.                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │  [Editor mockup: clean, focused, minimal]       │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Focus Mode keeps you in flow.        We notice, you    │
│  It highlights the sentence you're    focus. Rhei       │
│  working on and fades everything      watches silently  │
│  else.                                and surfaces      │
│                                       signals when      │
│                                       you're done.      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Headline options:**
- "Imagine a place where your story remembers itself."
- "Write forward. Nothing falls behind."
- "Your world. Perfectly remembered."

---

### Section 2: Authorship/AI (Dark)
**Pattern:** Direct question (addresses the AI elephant in the room)

```
┌─────────────────────────────────────────────────────────┐
│  CONSISTENCY                                     [dark] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Did you contradict yourself?                           │
│  Rhei knows. It tracks every character,                 │
│  every fact, every decision you made.                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │  Marcus stepped into the light, his brown eyes │    │
│  │  narrowing against the glare.     ───────────  │    │
│  │                                                 │    │
│  │  ┌─────────────────────────────────┐           │    │
│  │  │ ⚠ Marcus has blue eyes (Ch 2)  │           │    │
│  │  │ [Ignore] [Fix] [Update canon]  │           │    │
│  │  └─────────────────────────────────┘           │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Never forget a detail. Your           Caught before    │
│  characters, places, timelines—        readers find     │
│  all tracked as you write. Blue        them. Every      │
│  eyes in chapter 2? Rhei remembers.    contradiction    │
│  Even when you don't.                  flagged silently.│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Headline options:**
- "Did you contradict yourself? Rhei knows."
- "Was that brown eyes or blue? Rhei remembers."
- "Plot holes? Caught before your readers find them."

---

### Section 3: Flow Mode (Light)
**Pattern:** Tool benefit + demo

```
┌─────────────────────────────────────────────────────────┐
│  FOCUS                                          [light] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  100% focused. AI that knows                            │
│  when to shut up.                                       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │  [dimmed] Down the rabbit hole Alice fell...   │    │
│  │                                                 │    │
│  │  "I must actually be getting somewhere         │    │
│  │   near the center of the earth."               │    │
│  │                                                 │    │
│  │  [dimmed] Would the fall never end?...         │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Flow Mode dims distractions.         No interruptions. │
│  One sentence at a time. Your         Signals collect   │
│  current thought, front and center.   silently. Review  │
│  Everything else fades.               when you're done. │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Section 4: Knowledge PRs (Dark)
**Pattern:** Tool benefit + demo

```
┌─────────────────────────────────────────────────────────┐
│  VERSION CONTROL                                 [dark] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Your world has version control.                        │
│  Review changes before they're canon.                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Knowledge PR #47                               │    │
│  │  ───────────────────────────────────────────    │    │
│  │  - Marcus: blue eyes                            │    │
│  │  + Marcus: green eyes                           │    │
│  │                                                 │    │
│  │  Affected:                                      │    │
│  │  ✓ Chapter 2 (description)                     │    │
│  │  ✓ Chapter 7 (mirror scene)                    │    │
│  │  ✓ Chapter 15 (recognition)                    │    │
│  │                                                 │    │
│  │  [Reject]              [Merge →]                │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Changed a backstory? See the          Roll back        │
│  ripple effects. Every reference,      anytime. Your    │
│  every mention, every implication.     world, your      │
│  Approve when ready.                   control.         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Section 5: Comparison (Dark)
**Pattern:** Challenge + side-by-side

```
┌─────────────────────────────────────────────────────────┐
│                                                  [dark] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Why not just use Scrivener?                            │
│  It has more features. Let's look                       │
│  at the difference:                                     │
│                                                         │
├───────────────────────┬─────────────────────────────────┤
│                       │                                 │
│  ┌─────────────────┐  │  ┌─────────────────┐            │
│  │                 │  │  │                 │            │
│  │  [Rhei editor]  │  │  │  [Scrivener]    │            │
│  │  Clean, focused │  │  │  Corkboard,     │            │
│  │  AI watching    │  │  │  index cards,   │            │
│  │                 │  │  │  outlines...    │            │
│  └─────────────────┘  │  └─────────────────┘            │
│                       │                                 │
├───────────────────────┴─────────────────────────────────┤
│                                                         │
│  Rhei has fewer features, by         Scrivener is       │
│  design. No corkboard. No index      powerful. But      │
│  cards. Just write. We track your    power isn't focus. │
│  world silently. Catch errors        We chose calm      │
│  before readers do.                  over features.     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Alternative comparisons:**
- "Why not just use Notion? It has AI too."
- "Why not just use Word? Everyone has it."

---

### Section 6: Quick Start (Light)
**Pattern:** Workflow benefit

```
┌─────────────────────────────────────────────────────────┐
│  GETTING STARTED                                [light] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  /widget and go.                                        │
│  No setup wizard. No onboarding wall.                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  ┌───────────────────────────────────────────┐  │    │
│  │  │ /character                            ⌘K  │  │    │
│  │  ├───────────────────────────────────────────┤  │    │
│  │  │ → Create character                        │  │    │
│  │  │   List characters                         │  │    │
│  │  │   Search characters                       │  │    │
│  │  └───────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Type a command. Get a result.        Configure later.  │
│  That's it. No account required       Or never. Rhei    │
│  to try. No credit card. Just         works out of the  │
│  start writing.                       box.              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Section 7: Platform (Dark)
**Pattern:** Device mockups

```
┌─────────────────────────────────────────────────────────┐
│  CROSS PLATFORM                                  [dark] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Web. Mac. Mobile.                                      │
│  Your story, everywhere.                                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│      ┌─────────┐    ┌───┐    ┌───────┐                  │
│      │ MacBook │    │ 📱│    │ iPad  │                  │
│      │         │    │   │    │       │                  │
│      └─────────┘    └───┘    └───────┘                  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Start on web. No download.          Sync everywhere.   │
│  Continue on Mac with the native     Your characters,   │
│  app. Pick up on mobile. Your        your facts, your   │
│  world follows you.                  decisions—always   │
│                                      with you.          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Section 8: No Dopamine (Dark)
**Pattern:** Philosophy statement

```
┌─────────────────────────────────────────────────────────┐
│  PHILOSOPHY                                      [dark] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  No streaks. No badges.                                 │
│  No notifications begging                               │
│  for attention.                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│     ██████████  streaks     ← struck through            │
│     ██████████  badges      ← struck through            │
│     ██████████  notifications ← struck through          │
│                                                         │
│     Just calm tools that help you write.                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  We don't gamify your writing.       We don't want you  │
│  We don't ping you constantly.       addicted. We want  │
│  We don't track your "writing        you writing. Then  │
│  streak."                            we want you to     │
│                                      close the app.     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Section 9: Social Proof (Light)
**Pattern:** Press logos + quotes

```
┌─────────────────────────────────────────────────────────┐
│                                                 [light] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  What writers are saying                                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  "Finally, an AI tool that doesn't    "I caught three   │
│   try to write for me. It just        timeline errors   │
│   remembers what I wrote."            in my 400-page    │
│                                       manuscript.       │
│   — Author Name                       In seconds."      │
│     Novelist                                            │
│                                       — Author Name     │
│                                         Screenwriter    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Press logo] [Press logo] [Press logo] [Press logo]    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Section 10: Final CTA (Dark)
**Pattern:** Simple, confident

```
┌─────────────────────────────────────────────────────────┐
│                                                  [dark] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                                                         │
│            Your story's memory awaits.                  │
│                                                         │
│               [Start writing →]                         │
│                                                         │
│            Free to try. No credit card.                 │
│                                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Full Copy Document

### Headlines (final picks)

| Section | Headline |
|---------|----------|
| Hero | Imagine a place where your story remembers itself. |
| Consistency | Did you contradict yourself? Rhei knows. |
| Flow | 100% focused. AI that knows when to shut up. |
| Version | Your world has version control. |
| Compare | Why not just use Scrivener? It has more features. |
| Start | /widget and go. |
| Platform | Web. Mac. Mobile. Your story, everywhere. |
| Philosophy | No streaks. No badges. No notifications. |
| CTA | Your story's memory awaits. |

### Two-column explanations

| Section | Left column | Right column |
|---------|-------------|--------------|
| Hero | Focus Mode keeps you in flow. It highlights the sentence you're working on and fades everything else. | We notice, you focus. Rhei watches silently and surfaces signals when you're done. |
| Consistency | Never forget a detail. Your characters, places, timelines—all tracked as you write. Blue eyes in chapter 2? Rhei remembers. Even when you don't. | Caught before readers find them. Every contradiction flagged silently. |
| Flow | Flow Mode dims distractions. One sentence at a time. Your current thought, front and center. | No interruptions. Signals collect silently. Review when you're done. |
| Version | Changed a backstory? See the ripple effects. Every reference, every mention. Approve when ready. | Roll back anytime. Your world, your control. |
| Compare | Rhei has fewer features, by design. No corkboard. No index cards. Just write. We track your world silently. | Scrivener is powerful. But power isn't focus. We chose calm over features. |
| Start | Type a command. Get a result. That's it. No account required to try. | Configure later. Or never. Rhei works out of the box. |
| Platform | Start on web. No download. Continue on Mac with the native app. Pick up on mobile. | Sync everywhere. Your characters, your facts, your decisions—always with you. |
| Philosophy | We don't gamify your writing. We don't ping you constantly. We don't track your "writing streak." | We don't want you addicted. We want you writing. Then we want you to close the app. |

---

## References

- [iA Writer](https://ia.net/writer) — calm, focused, typography-first
- [Linear](https://linear.app) — smooth animations, dark theme
- [Raycast](https://raycast.com) — command palette UX
- [Notion](https://notion.so) — clean layout, subtle motion
