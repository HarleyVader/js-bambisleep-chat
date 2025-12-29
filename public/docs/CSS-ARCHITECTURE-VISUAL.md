# CSS Architecture - Visual Guide

## Cascade Flow (CSS Layers)

```
┌─────────────────────────────────────────────────────────┐
│                     Browser Rendering                     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 1: BASE                                          │
│  • CSS resets (_layers.css)                             │
│  • Root variables (_variables.css)                      │
│  • Foundational styles                                  │
│  Priority: LOWEST                                       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: BACKGROUND                                    │
│  • Spiral animations (effects/spirals.css)              │
│  • Brainwave effects (effects/brainwave.css)            │
│  • TTS text overlays (_layers.css)                      │
│  Priority: Low                                          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: INTERFACE                                     │
│  • Chat components (components/chat.css)                │
│  • Button components (components/buttons.css)           │
│  • AIGF components (components/aigf.css)                │
│  • Glassmorphism (effects/glassmorphism.css)            │
│  • Mobile layout (layout/mobile.css)                    │
│  Priority: Medium                                       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 4: DROPDOWNS                                     │
│  • Dropdown modals (components/dropdowns.css)           │
│  • Modal positioning (_layers.css)                      │
│  Priority: High                                         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 5: MODALS                                        │
│  • Alert dialogs (_layers.css)                          │
│  • Confirmation modals                                  │
│  Priority: Higher                                       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 6: OVERLAYS                                      │
│  • Toast notifications (_layers.css)                    │
│  • Error overlays                                       │
│  Priority: Very High                                    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 7: DEBUG                                         │
│  • Debug panels (_layers.css)                           │
│  • Development aids                                     │
│  Priority: HIGHEST (Always on top)                     │
└─────────────────────────────────────────────────────────┘
```

## File Import Order (style.css)

```
style.css (Orchestrator)
│
├─ 1. Fonts
│   └─ @import url("Google Fonts")
│
├─ 2. Foundation
│   ├─ @import url("_variables.css")     ← Design tokens
│   └─ @import url("_layers.css")        ← Layer definitions
│
├─ 3. Effects
│   ├─ @import url("effects/glassmorphism.css")
│   ├─ @import url("effects/spirals.css")
│   └─ @import url("effects/brainwave.css")
│
├─ 4. Components
│   ├─ @import url("components/buttons.css")
│   ├─ @import url("components/chat.css")
│   ├─ @import url("components/aigf.css")
│   └─ @import url("components/dropdowns.css")
│
└─ 5. Layout
    └─ @import url("layout/mobile.css")
```

## Component Dependencies

```
_variables.css (Design Tokens)
        ↓
        ├─→ components/buttons.css (Uses: --button-color, --spacing-*)
        ├─→ components/chat.css (Uses: --primary-color, --font-*)
        ├─→ components/aigf.css (Uses: --button-color, --tertiary-*)
        ├─→ components/dropdowns.css (Uses: --nav-alt, --border-radius)
        ├─→ effects/glassmorphism.css (Uses: --primary-color, etc.)
        ├─→ effects/spirals.css (Uses: --button-color, --border-radius)
        └─→ layout/mobile.css (Uses: --spacing-*, --font-size-*)
```

## Responsive Breakpoints

```
Mobile-First Approach:

┌────────────────┐
│ Base Styles    │  Default: Mobile (< 768px)
│ Mobile-first   │  Uses: --mobile-* variables
└────────────────┘
        ↓
┌────────────────┐
│ @media         │  Tablet (768px - 1024px)
│ (min: 768px)   │  Adjustments for tablet
│ (max: 1024px)  │
└────────────────┘
        ↓
┌────────────────┐
│ @media         │  Desktop (> 1024px)
│ (min: 1024px)  │  Default desktop layout
└────────────────┘
        ↓
┌────────────────┐
│ @media         │  Large Desktop (> 1920px)
│ (min: 1920px)  │  Optimized for large screens
└────────────────┘
```

## Touch vs. Pointer Detection

```
@media (pointer: coarse)     ← Touch devices (phones, tablets)
    ↓
    Applies:
    • Larger tap targets (min 44px)
    • Simplified animations
    • Hidden spiral (performance)
    • 16px font inputs (prevent iOS zoom)

@media (pointer: fine)       ← Mouse/trackpad devices
    ↓
    Applies:
    • Hover effects
    • Precise controls
    • Full animations
    • Desktop-optimized spacing
```

## Design Token Hierarchy

```
:root (CSS Variables)
│
├─ Colors
│   ├─ --primary-color (#0c2a2aE6)
│   ├─ --primary-alt (#15aab5E6)
│   ├─ --secondary-color (#40002fE6)
│   ├─ --secondary-alt (#cc0174E6)
│   ├─ --tertiary-color (#720241e6)
│   ├─ --tertiary-alt (#02b893E6)
│   ├─ --button-color (#df0471E6)
│   ├─ --button-alt (#110000E6)
│   ├─ --nav-color (#0a2626E6)
│   ├─ --nav-alt (#17dbd8E6)
│   ├─ --transparent (#124141E6)
│   └─ --error (#ff3333E6)
│
├─ Spacing (4px scale)
│   ├─ --spacing-xs (4px)
│   ├─ --spacing-sm (8px)
│   ├─ --spacing-md (12px)
│   ├─ --spacing-lg (16px)
│   └─ --spacing-xl (20px)
│
├─ Border Radius
│   ├─ --border-radius (8px)
│   ├─ --border-radius-sm (4px)
│   ├─ --border-radius-lg (12px)
│   └─ --border-radius-xl (16px)
│
├─ Typography
│   ├─ --font-primary ("Audiowide", sans-serif)
│   ├─ --font-mono ("Courier New", monospace)
│   ├─ --font-size-xs (0.5rem)
│   ├─ --font-size-sm (0.6rem)
│   ├─ --font-size-md (0.75rem)
│   ├─ --font-size-lg (1rem)
│   ├─ --font-size-xl (1.215rem)
│   └─ --font-size-2xl (2rem)
│
├─ Effects
│   ├─ --blur-light (blur(8px))
│   ├─ --blur-medium (blur(16px))
│   ├─ --blur-heavy (blur(20px))
│   ├─ --shadow-sm (0 4px 16px rgba(...))
│   ├─ --shadow-md (0 8px 32px rgba(...))
│   └─ --shadow-lg (0 20px 60px rgba(...))
│
└─ Transitions
    ├─ --transition-fast (0.2s ease)
    ├─ --transition-medium (0.3s ease)
    └─ --transition-slow (0.4s cubic-bezier(...))
```

## Component Interaction Flow

```
User Action (Click dropdown button)
        ↓
JavaScript adds .active class
        ↓
┌──────────────────────────────────────┐
│ Dropdown Activation Sequence         │
├──────────────────────────────────────┤
│ 1. .dropdown.active::before          │
│    → Backdrop appears (@layer drop)  │
│    → Background: rgba(0,0,0,0.7)     │
│    → Backdrop-filter: blur(4px)      │
├──────────────────────────────────────┤
│ 2. .dropdown-content                 │
│    → Position: fixed (centered)      │
│    → Transform: translate(-50%,-50%) │
│    → Opacity: 0 → 1 (transition)     │
│    → Visibility: hidden → visible    │
├──────────────────────────────────────┤
│ 3. Animation: fadeIn (0.2s)          │
│    → Smooth entrance effect          │
└──────────────────────────────────────┘
        ↓
Dropdown appears centered on screen
(Layer priority ensures it's above chat)
```

## Performance Optimization Points

```
1. Layer Isolation
   isolation: isolate
   └─> Prevents repaint cascades

2. Container Queries
   @container (max-width: 400px)
   └─> Efficient responsive sizing

3. Will-Change
   will-change: opacity, visibility
   └─> GPU acceleration for animations

4. Backdrop Filters
   backdrop-filter: blur(8px)
   └─> Applied sparingly, with -webkit- prefix

5. Contain Property
   contain: layout style
   └─> Limits style recalculation scope
```

## Decision Tree: Where to Add New Styles

```
Need to add new styles?
        ↓
┌───────────────────────────┐
│ What type of component?   │
└───────────────────────────┘
        ↓
        ├─ UI Element (button, input, card)?
        │       ↓
        │   components/ directory
        │   └─> @layer interface
        │
        ├─ Visual Effect (animation, filter)?
        │       ↓
        │   effects/ directory
        │   └─> @layer background
        │
        ├─ Responsive Layout?
        │       ↓
        │   layout/ directory
        │   └─> @layer interface
        │
        ├─ Design Token (color, spacing)?
        │       ↓
        │   _variables.css
        │   └─> @layer base :root
        │
        └─ Positioning Logic?
                ↓
            _layers.css
            └─> Appropriate @layer
```
