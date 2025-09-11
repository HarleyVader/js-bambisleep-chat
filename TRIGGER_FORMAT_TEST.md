# **TRIGGER** Formatting Test

## Test Messages for Enhanced Trigger Formatting

Use these test messages in the chat to verify the new **TRIGGER** formatting works correctly:

### Test Cases:

1. **Single Enhanced Trigger:**
   - `This is a test with **BAMBI SLEEP** trigger formatting`
   - Expected: "BAMBI SLEEP" appears in hot pink with pulsing animation

2. **Multiple Enhanced Triggers:**
   - `**GOOD GIRL** and **BLANK** and **MINDLESS** state`
   - Expected: All three triggers in hot pink with enhanced effects

3. **Mixed Formatting:**
   - `Regular bambi trigger and **ENHANCED TRIGGER** together`
   - Expected: "bambi" in regular trigger style, "ENHANCED TRIGGER" in hot pink

4. **Edge Cases:**
   - `**SINGLE** word trigger`
   - `**MULTI WORD TRIGGER** with spaces`
   - `Text with **TRIGGER** in middle of sentence`

### Visual Effects Expected:

- ✅ **TRIGGER** text appears in hot pink color (--button-color CSS variable)
- ✅ Text has glowing text-shadow effect
- ✅ Pulsing animation (triggerPulse keyframe)
- ✅ Enhanced screen flash effect (more intense than regular triggers)
- ✅ Enhanced audio effect (higher frequency, longer duration)
- ✅ Asterisks (**) are removed from display
- ✅ Text size slightly larger (1.1em) with letter spacing

### CSS Classes Applied:

- `.enhanced-trigger` - For **TRIGGER** format
- `.trigger-text` - For regular trigger words

### Processing Order:

1. First: Process **TRIGGER** patterns with `processEnhancedTriggers()`
2. Second: Process regular trigger words with existing logic
3. All text is HTML escaped for security

### Regex Pattern Used:

```javascript
const enhancedTriggerRegex = /\*\*([A-Z][A-Z\s]*[A-Z])\*\*/g;
```

This pattern matches:
- `**` (opening asterisks)
- `[A-Z]` (starts with capital letter)
- `[A-Z\s]*` (followed by capitals and spaces)
- `[A-Z]` (ends with capital letter)
- `**` (closing asterisks)
