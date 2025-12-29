# BambiSleep Chat - Modular CSS Architecture

## Overview

This CSS codebase uses a **modular layered components system** based on CSS `@layer` to provide predictable cascade control without z-index conflicts.

## Architecture Principles

1. **CSS Layers over Z-Index**: Semantic layer names replace numeric z-index values
2. **Modular Components**: Each feature in its own file with clear responsibilities  
3. **Design Tokens**: Centralized variables for colors, spacing, typography
4. **Mobile-First**: Responsive design with progressive enhancement
5. **Performance**: Minimal specificity, optimized selectors, container queries

## File Structure

```
css/
├── style.css                    # Main orchestrator (imports only)
├── _variables.css               # Design tokens (colors, spacing, fonts)
├── _layers.css                  # Layer definitions & base positioning
│
├── components/                  # UI Components (@layer interface, dropdowns)
│   ├── buttons.css             # Buttons, states, animations
│   ├── chat.css                # Chat containers, messages, inputs
│   ├── aigf.css                # AI girlfriend mode styles
│   └── dropdowns.css           # Dropdown menus, configs, controls
│
├── effects/                     # Visual Effects (@layer base, background)
│   ├── glassmorphism.css       # Transparency, backdrop filters
│   ├── spirals.css             # Spiral animations, canvas
│   └── brainwave.css           # Brainwave visualizations
│
└── layout/                      # Layout & Responsive (@layer interface)
    └── mobile.css              # Mobile, tablet, desktop breakpoints
```

## Layer Order (Cascade Priority)

Defined in `_layers.css`:

```css
@layer base, background, interface, dropdowns, modals, overlays, debug;
```

1. **base** - CSS resets, foundational elements, variables
2. **background** - Visual effects (spirals, brainwaves, TTS text)
3. **interface** - Main UI components (chat, buttons, inputs)
4. **dropdowns** - Dropdown modals (highest priority for menus)
5. **modals** - Modal dialogs (alerts, confirmations)
6. **overlays** - Toast notifications, debug panels
7. **debug** - Development aids (always on top)

## Design Tokens

Located in `_variables.css`:

### Colors
- `--primary-color`, `--primary-alt` - Teal/cyan theme
- `--secondary-color`, `--secondary-alt` - Purple/magenta theme
- `--tertiary-color`, `--tertiary-alt` - Pink/teal theme
- `--button-color`, `--button-alt` - Hot pink accent
- `--nav-color`, `--nav-alt` - Navigation colors
- `--error` - Error state color

### Spacing
- `--spacing-xs` to `--spacing-xl` - 4px to 20px scale
- `--border-radius-sm` to `--border-radius-xl` - 4px to 16px

### Typography
- `--font-primary` - Audiowide, sans-serif fallbacks
- `--font-mono` - Courier New, monospace
- `--font-size-xs` to `--font-size-2xl` - 0.5rem to 2rem

### Effects
- `--blur-light`, `--blur-medium`, `--blur-heavy` - Backdrop filters
- `--shadow-sm`, `--shadow-md`, `--shadow-lg` - Box shadows
- `--transition-fast`, `--transition-medium`, `--transition-slow` - Animations

## Component Guide

### Adding a New Component

1. **Choose location**:
   - `components/` - UI elements (buttons, forms, cards)
   - `effects/` - Visual enhancements (animations, filters)
   - `layout/` - Responsive breakpoints, grid systems

2. **Create file**:
   ```css
   /**
    * Component Name
    * @layer interface
    * Component description
    */
   
   @layer interface {
       .my-component {
           /* Use design tokens */
           padding: var(--spacing-md);
           background: var(--primary-color);
           border-radius: var(--border-radius);
       }
   }
   ```

3. **Import in style.css**:
   ```css
   @import url("components/my-component.css");
   ```

### Modifying Colors/Spacing

**Don't hardcode values** - always use CSS variables from `_variables.css`:

```css
/* ✅ Good */
.element {
    background: var(--primary-color);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
}

/* ❌ Bad */
.element {
    background: #0c2a2a;
    padding: 12px;
    border-radius: 8px;
}
```

### Adjusting Stacking Order

**Use layers, not z-index**:

```css
/* ✅ Good - Dropdowns automatically on top */
@layer dropdowns {
    .my-dropdown {
        position: fixed;
        /* No z-index needed */
    }
}

/* ❌ Bad - Fragile z-index management */
.my-dropdown {
    position: fixed;
    z-index: 9999;
}
```

## Responsive Design

### Mobile Breakpoints

Located in `layout/mobile.css`:

```css
@media (pointer: coarse)           /* Touch devices */
@media (max-width: 768px)          /* Mobile */
@media (min-width: 768px) and (max-width: 1024px)  /* Tablet */
@media (min-width: 1920px)         /* Large desktop */
```

### Container Queries

Dropdowns use modern container queries:

```css
@container (max-width: 400px) {
    .dropdown-item { font-size: 0.85rem; }
}
```

## Performance Optimizations

1. **Minimal Specificity**: Flat selectors, avoid deep nesting
2. **Layer Isolation**: `isolation: isolate` prevents repaint cascades
3. **Container Type**: `container-type: inline-size` for efficient sizing
4. **Will-Change**: Applied to animated elements
5. **Backdrop Filters**: Used sparingly with fallbacks

## Migration from Old Architecture

### Before (style.css 1394 lines)
- All styles in one file
- Numeric z-index conflicts
- Hardcoded colors
- No clear component boundaries

### After (Modular)
- 11 focused files (100-300 lines each)
- Semantic layer names
- Design token system
- Clear component separation

## Troubleshooting

### Dropdowns Not Showing
- Check layer order in `_layers.css`
- Verify `.active` class on dropdown
- Inspect backdrop visibility in dev tools

### Colors Not Updating
- Check if value exists in `_variables.css`
- Verify CSS variable syntax: `var(--variable-name)`
- Clear browser cache

### Mobile Layout Issues
- Use dev tools device mode
- Check `pointer: coarse` media query
- Verify viewport meta tag in HTML

## Developer Workflow

1. **Start server**: `npm start` or `npm run dev`
2. **Edit component**: Modify relevant file in `components/`, `effects/`, or `layout/`
3. **Auto-reload**: Changes reflected immediately (no build step)
4. **Test layers**: Use browser dev tools → Styles → View cascade layers
5. **Validate**: Check console for CSS errors

## Browser Support

- **Modern browsers**: Full support (Chrome 99+, Firefox 97+, Safari 15.4+)
- **Legacy browsers**: Graceful degradation (no layers, fallback to specificity)
- **Mobile**: Optimized for iOS Safari, Chrome Mobile

## Best Practices

✅ **DO**:
- Use CSS variables for all values
- Declare layer in each component file
- Keep components under 300 lines
- Test on mobile viewport
- Use semantic class names

❌ **DON'T**:
- Hardcode colors or spacing
- Use numeric z-index
- Create deep selector nesting
- Mix layers in one file
- Override with `!important` (except glassmorphism overrides)

## Resources

- [CSS Layers Spec](https://www.w3.org/TR/css-cascade-5/#layering)
- [Container Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Container_Queries)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
