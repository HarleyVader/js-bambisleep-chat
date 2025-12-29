# Dropdown Component Template

## Standard HTML Structure

All dropdowns MUST use this exact structure:

```html
<div class="dropdown">
    <button class="dropdown-btn toggle-button" id="unique-id" data-state="off">
        [Icon] [Name]
        <span class="status-indicator" id="unique-status">●</span>
    </button>
    <div class="dropdown-content" id="unique-content">
        <div class="dropdown-header">
            <h3>[Title]</h3>
            <p>[Description]</p>
        </div>
        
        <div class="dropdown-body">
            <!-- Content here -->
        </div>
    </div>
</div>
```

## Required CSS Classes

### Container
- `.dropdown` - Main wrapper (REQUIRED)

### Button
- `.dropdown-btn` - Button styling (REQUIRED)
- `.toggle-button` - On/off states (REQUIRED)
- `data-state="off|on"` - State attribute (REQUIRED)

### Content
- `.dropdown-content` - Content container (REQUIRED)
- `.dropdown-header` - Header section (OPTIONAL)
- `.dropdown-body` - Body content (OPTIONAL)

### Items
- `.dropdown-item` - Individual clickable items
- `.dropdown-section` - Section grouping
- `.dropdown-divider` - Visual separator

## Standard Button States

Use `data-state` attribute (handled by buttons.css):
- `data-state="off"` - Red pulse (inactive)
- `data-state="on"` - Green glow (active)

## Status Indicator

```html
<span class="status-indicator" id="unique-status">●</span>
```

Update color based on state:
- Inactive: `#666` (gray)
- Active: `#00ff00` (green)

## Example Implementation

```javascript
export class MyDropdown {
    constructor(dropdownManager) {
        this.dropdownManager = dropdownManager;
        this.buttonId = 'my-dropdown-btn';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadState();
    }

    setupEventListeners() {
        document.addEventListener('dropdownAction', (e) => {
            const { action, buttonId } = e.detail;
            if (buttonId === this.buttonId) {
                this.handleAction(action, e.detail);
            }
        });
    }

    updateState(isActive) {
        const btn = document.getElementById(this.buttonId);
        const status = document.getElementById(`${this.buttonId}-status`);
        
        if (btn) {
            btn.setAttribute('data-state', isActive ? 'on' : 'off');
        }
        
        if (status) {
            status.style.color = isActive ? '#00ff00' : '#666';
        }
    }
}
```

## CSS Layer Integration

All dropdown styles are in `@layer dropdowns`:
- Dropdowns always appear above interface layer
- Use `.dropdown-content` for modal centering
- No manual z-index values allowed

## DO NOT
- ❌ Use inline styles for positioning
- ❌ Create custom z-index values
- ❌ Use different class names than template
- ❌ Manually handle dropdown show/hide (use dropdownManager)
- ❌ Add `display:` styles in JavaScript

## DO
- ✅ Use standard classes from template
- ✅ Use `data-state` for button states
- ✅ Let CSS layers handle stacking
- ✅ Use dropdownManager for open/close
- ✅ Follow consistent naming conventions
