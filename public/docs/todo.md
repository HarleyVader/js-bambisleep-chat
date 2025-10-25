# BambiSleep Chat - Development TODO

*Generated: October 25, 2025*  
*Project Status: 93% Complete → Target: 100%*  
*Based on: [issues.md](.github/issues.md) & current codebase analysis*

## 🚨 Critical Tasks (Blocking 95% Completion)

### 1. Fix Dropdown State Management Race Conditions
**Priority: CRITICAL** | **Estimated Time: 4-6 hours** | **Complexity: High**

**Problem:** Multiple dropdown components maintain separate state systems causing immediate closing and race conditions.

**Tasks:**
- [ ] **Centralize State in DropdownManager**
  - Move all component states (`this.isEnabled`, `this.currentVoice`, etc.) to `DropdownManager.state`
  - Update `public/js/dropdowns.js` constructor to include centralized state object
  - Remove individual state properties from all dropdown components

- [ ] **Refactor Individual Components**
  - [ ] `public/js/dropdowns/ai-dropdown.js` - Remove `this.isEnabled`, `this.currentModel`
  - [ ] `public/js/dropdowns/tts-dropdown.js` - Remove `this.currentVoice`, `this.selectedVoices`
  - [ ] `public/js/dropdowns/spiral-dropdown.js` - Remove individual state tracking
  - [ ] `public/js/dropdowns/collar-dropdown.js` - Remove `this.collarSettings` state
  - [ ] `public/js/dropdowns/triggers-dropdown.js` - Centralize trigger state

- [ ] **Update State Access Patterns**
  - Replace `this.isEnabled` with `this.dropdownManager.getState(this.buttonId)`
  - Replace `this.currentVoice` with `this.dropdownManager.getComponentState('tts', 'voice')`
  - Add validation for state access in DropdownManager

**Files to Modify:**
- `public/js/dropdowns.js` (DropdownManager class)
- `public/js/dropdowns/*.js` (All component files)

**Testing Requirements:**
- Verify dropdowns stay open for >5 seconds
- Test rapid clicking doesn't cause race conditions
- Validate state persistence across dropdown operations

---

### 2. Implement Proper Mobile/Desktop Layer Isolation
**Priority: CRITICAL** | **Estimated Time: 3-4 hours** | **Complexity: Medium**

**Problem:** Mobile styles interfere with desktop dropdown functionality due to improper @layer isolation.

**Tasks:**
- [ ] **Add Mobile CSS Layer**
  - Add `mobile` layer to `@layer` declaration in `public/css/layers.css`
  - Update layer order: `@layer base, background, interface, mobile, modals, overlays, debug, dropdowns`

- [ ] **Wrap Mobile-Specific Styles**
  - Move all `@media (pointer: coarse)` styles to `@layer mobile`
  - Move all `@media (max-width: 768px)` styles to `@layer mobile`
  - Ensure touch-specific styles don't affect desktop

- [ ] **Fix Touch Detection Conflicts**
  - Update `public/css/mobile.css` to use proper layer isolation
  - Add desktop-specific overrides in `@layer interface`
  - Test touch vs mouse event handling

**Files to Modify:**
- `public/css/layers.css` (layer declaration)
- `public/css/mobile.css` (wrap in @layer mobile)
- `public/css/style.css` (move media queries to layers)

**Testing Requirements:**
- Test on actual mobile device
- Verify desktop dropdowns work normally
- Check responsive breakpoint behavior

---

## ⚠️ High Priority Tasks (Blocking 97% Completion)

### 3. Eliminate CSS !important Overrides
**Priority: HIGH** | **Estimated Time: 3-4 hours** | **Complexity: Medium**

**Problem:** 47+ `!important` declarations bypass CSS layer system causing specificity wars.

**Tasks:**
- [ ] **Audit and Replace !important Usage**
  - [ ] `public/css/style.css` - Replace 20+ !important with layer priority
  - [ ] `public/css/mobile.css` - Replace viewport !important overrides
  - [ ] `public/css/buttons.css` - Fix animation !important conflicts

- [ ] **Convert to Layer-Based Priority**
  - Replace `.tts-text-display` !important styles with @layer dropdowns rules
  - Move transparent background overrides to @layer background
  - Use layer cascade instead of specificity wars

- [ ] **Test Specificity Resolution**
  - Verify styles still work without !important
  - Check animation priorities remain correct
  - Validate no visual regressions

**Files to Modify:**
- `public/css/style.css` (lines 51, 56, 60, 64, 68, 72, 76, 80, 183-210)
- `public/css/mobile.css` (viewport overrides)
- `public/css/buttons.css` (animation priorities)

---

### 4. Implement Central Animation Controller
**Priority: HIGH** | **Estimated Time: 4-5 hours** | **Complexity: High**

**Problem:** Multiple concurrent animations (ttsPulse, aigfTriggerPulse, dropdownSlideIn) cause visual stuttering.

**Tasks:**
- [ ] **Create Animation Controller Class**
  - Create `public/js/animation-controller.js`
  - Implement animation queue and priority system
  - Add conflict resolution for simultaneous animations

- [ ] **Integrate with CSS Layers**
  - Use `@layer interface` for main UI animations
  - Use `@layer dropdowns` for dropdown animations
  - Use `@layer overlays` for notification animations

- [ ] **Coordinate Animation Timing**
  - Prevent overlapping TTS and trigger animations
  - Sequence dropdown open/close with other animations
  - Add animation cancellation for better UX

**Files to Create:**
- `public/js/animation-controller.js` (new file)

**Files to Modify:**
- `public/js/dropdowns.js` (integrate animation controller)
- `public/js/text2speech.js` (coordinate TTS animations)
- `public/css/buttons.css` (update animation declarations)

---

### 5. Centralize Event Handler System
**Priority: HIGH** | **Estimated Time: 2-3 hours** | **Complexity: Medium**

**Problem:** Multiple dropdowns handle same events simultaneously causing conflicts.

**Tasks:**
- [ ] **Implement Event Delegation in DropdownManager**
  - Move all click handlers to DropdownManager
  - Remove individual event listeners from components
  - Add proper event capture/bubble management

- [ ] **Add Event Conflict Resolution**
  - Implement event handler priority system
  - Prevent multiple handlers for same event type
  - Add event debugging and logging

- [ ] **Update Component Event Patterns**
  - Replace direct event listeners with event delegation
  - Use CustomEvent for component communication
  - Standardize event naming conventions

**Files to Modify:**
- `public/js/dropdowns.js` (centralize event handling)
- `public/js/dropdowns/*.js` (remove individual listeners)

---

## 🔧 Medium Priority Tasks (Blocking 99% Completion)

### 6. Standardize TTS Error Handling
**Priority: MEDIUM** | **Estimated Time: 2-3 hours** | **Complexity: Medium**

**Tasks:**
- [ ] **Unify Error Patterns in Kokoro Worker**
  - Standardize error response format in `workers/kokoro.js`
  - Remove legacy Web Speech API error references
  - Implement proper error cause chaining

- [ ] **Update TTS System Error Handling**
  - Update `public/js/text2speech.js` error handlers
  - Integrate with `public/js/error-manager.js`
  - Add proper error recovery mechanisms

- [ ] **Test Error Scenarios**
  - Test Kokoro service unavailable
  - Test audio playback failures
  - Test network timeout scenarios

**Files to Modify:**
- `workers/kokoro.js` (lines 51-100, error handling)
- `public/js/text2speech.js` (error handler integration)
- `public/js/error-manager.js` (TTS error types)

---

### 7. Enhance Configuration Validation
**Priority: MEDIUM** | **Estimated Time: 1-2 hours** | **Complexity: Low**

**Tasks:**
- [ ] **Add Missing Validations**
  - URL format validation in `config/env.js`
  - Port range validation (1-65535)
  - Service connectivity pre-checks

- [ ] **Improve Error Messages**
  - Add specific guidance for common misconfigurations
  - Include example values in error messages
  - Add auto-detection suggestions

- [ ] **Update Documentation**
  - Enhance `.env.example` with better examples
  - Add troubleshooting section to `config/README.md`

**Files to Modify:**
- `config/env.js` (validation functions)
- `.env.example` (documentation)
- `config/README.md` (troubleshooting)

---

### 8. Optimize Resource Monitor Performance
**Priority: MEDIUM** | **Estimated Time: 1-2 hours** | **Complexity: Low**

**Tasks:**
- [ ] **Add Update Throttling**
  - Implement debouncing for DOM updates
  - Reduce update frequency to 500ms intervals
  - Add animation frame optimization

- [ ] **Optimize Memory Tracking**
  - Cache DOM elements to reduce queries
  - Use CSS transforms instead of style changes
  - Add visibility-based update pausing

**Files to Modify:**
- Resource monitor integration points
- `public/css/style.css` (.resource-monitor styles)

---

## 🛠️ Low Priority Tasks (Polish for 100%)

### 9. Legacy Code Cleanup
**Priority: LOW** | **Estimated Time: 2-3 hours** | **Complexity: Low**

**Tasks:**
- [ ] **Remove Backward Compatibility Code**
  - [ ] `public/js/text2speech.js` (line 472, 913) - Remove legacy format support
  - [ ] `public/js/dropdowns/ai-dropdown.js` (line 292) - Remove legacy mode
  - [ ] `public/js/dropdowns/tts-dropdown.js` (line 481) - Remove diagnostic code

- [ ] **Standardize Debug Logging**
  - Consistent logging format across all files
  - Remove development-only console.log statements
  - Add proper debug level controls

**Files to Modify:**
- `public/js/text2speech.js`
- `public/js/dropdowns/ai-dropdown.js`
- `public/js/dropdowns/tts-dropdown.js`

---

### 10. Expand Test Coverage
**Priority: LOW** | **Estimated Time: 3-4 hours** | **Complexity: Medium**

**Tasks:**
- [ ] **Create UI Component Tests**
  - Create `tests/ui-components.test.js`
  - Add dropdown interaction testing
  - Add mobile responsive behavior validation

- [ ] **Add Animation Conflict Tests**
  - Test simultaneous animation scenarios
  - Verify animation timing coordination
  - Add performance regression testing

- [ ] **Enhance Stability Tests**
  - Add dropdown state management tests
  - Include event handler conflict tests
  - Add mobile/desktop compatibility tests

**Files to Create:**
- `tests/ui-components.test.js`
- `tests/animation-conflicts.test.js`

**Files to Modify:**
- `tests/stability.test.js` (add UI testing)

---

### 11. Complete Documentation
**Priority: LOW** | **Estimated Time: 2-3 hours** | **Complexity: Low**

**Tasks:**
- [ ] **Document Advanced Features**
  - Voice mixing syntax (af_bella+af_sky) in TTS guide
  - Error recovery patterns in troubleshooting
  - Component testing patterns for developers

- [ ] **Update API Documentation**
  - Document DropdownManager public API
  - Add animation controller usage examples
  - Include mobile development guidelines

**Files to Modify:**
- `public/docs/TTS-VOICE-GUIDE.md`
- `tests/TROUBLESHOOTING.md`
- `README.md` (advanced usage section)

---

### 12. CI/CD Environment Consistency
**Priority: LOW** | **Estimated Time: 1-2 hours** | **Complexity: Low**

**Tasks:**
- [ ] **Standardize Test Environments**
  - Unify timeout values between local and CI
  - Improve external service mocking
  - Enhance report generation consistency

- [ ] **Update CI Configuration**
  - Add UI component testing to CI pipeline
  - Include mobile testing environment
  - Add performance regression detection

**Files to Modify:**
- `.github/workflows/test.yml`
- `tests/environment.test.js`

---

## 📅 Implementation Timeline

### Week 1: Critical Issues (95% Target)
- **Day 1-2:** Dropdown state management refactor (Task 1)
- **Day 3:** Mobile/desktop layer isolation (Task 2)
- **Day 4-5:** CSS !important elimination (Task 3)

### Week 2: High Priority (97% Target)
- **Day 1-2:** Animation controller implementation (Task 4)
- **Day 3:** Event handler centralization (Task 5)

### Week 3: Medium Priority (99% Target)
- **Day 1:** TTS error handling standardization (Task 6)
- **Day 2:** Configuration validation enhancement (Task 7)
- **Day 3:** Resource monitor optimization (Task 8)

### Week 4: Polish & Testing (100% Target)
- **Day 1-2:** Legacy code cleanup & testing (Tasks 9-10)
- **Day 3:** Documentation completion (Task 11)
- **Day 4:** CI/CD consistency (Task 12)
- **Day 5:** Final validation and release prep

---

## 🧪 Testing Checklist

### Critical Path Testing
- [ ] Dropdown state persistence across sessions
- [ ] Mobile vs desktop dropdown behavior
- [ ] Animation conflict resolution
- [ ] Event handler race condition elimination

### Integration Testing
- [ ] TTS system error recovery
- [ ] Configuration validation edge cases
- [ ] Cross-browser compatibility
- [ ] Performance regression testing

### User Experience Validation
- [ ] Dropdown responsiveness (<100ms)
- [ ] Animation smoothness (60fps)
- [ ] Mobile touch interaction quality
- [ ] Error message clarity and actionability

---

## 🔗 Related Files

### Primary Development Files
- **Dropdowns:** `public/js/dropdowns.js`, `public/js/dropdowns/*.js`
- **CSS Architecture:** `public/css/layers.css`, `public/css/style.css`, `public/css/mobile.css`
- **Configuration:** `config/env.js`, `.env.example`
- **Testing:** `tests/stability.test.js`, `tests/environment.test.js`

### Documentation Files
- **Issues:** `.github/issues.md`
- **Architecture:** `.github/copilot-instructions.md`
- **Progress:** `public/docs/tree.md`
- **Troubleshooting:** `tests/TROUBLESHOOTING.md`

---

## 📊 Progress Tracking

| Task Category | Total Tasks | Completed | Remaining | % Complete |
|---------------|-------------|-----------|-----------|------------|
| Critical (1-2) | 2 | 0 | 2 | 0% |
| High Priority (3-5) | 3 | 0 | 3 | 0% |
| Medium Priority (6-8) | 3 | 0 | 3 | 0% |
| Low Priority (9-12) | 4 | 0 | 4 | 0% |
| **TOTAL** | **12** | **0** | **12** | **0%** |

**Current Project Completion:** 93%  
**Target Completion After TODO:** 100%  
**Estimated Total Effort:** 30-40 hours  
**Estimated Timeline:** 4 weeks (part-time development)

---

*Last Updated: October 25, 2025*  
*Next Review: Weekly during development*  
*Generated from: issues.md analysis + codebase audit*