# BambiSleep Chat - Project Issues & Technical Debt

*Generated: October 25, 2025*
*Project Status: 93% Complete (Enterprise Grade)*

## 🚨 Critical Issues

### 1. Dropdown State Management Conflicts
**Priority: High** | **Component: UI/Dropdowns** | **Impact: User Experience**

**Issue:** Individual dropdown components maintain separate state systems instead of using unified `DropdownManager` state, causing:
- Dropdowns closing immediately after opening (<1 second)
- Inconsistent open/close behavior across components
- Race conditions between multiple dropdowns

**Files Affected:**
- `public/js/dropdowns.js` (DropdownManager)
- `public/js/dropdowns/*.js` (All dropdown components)

**Solution:** Unify all dropdown components to use `DropdownManager.state` instead of individual component states.

---

### 2. Mobile/Desktop Responsive Conflicts
**Priority: High** | **Component: CSS/Mobile** | **Impact: Mobile Users**

**Issue:** Mobile-specific styles interfere with desktop dropdown positioning and functionality:
- Touch-based styles override desktop hover states
- Viewport calculations conflict between mobile.css and layers.css
- @layer mobile not properly isolated

**Files Affected:**
- `public/css/mobile.css`
- `public/css/layers.css`
- `public/css/style.css` (@media queries)

**Solution:** Implement proper @layer mobile isolation and fix touch/pointer detection.

---

## ⚠️ High Priority Issues

### 3. Animation Timing Conflicts
**Priority: High** | **Component: CSS/Animations** | **Impact: Visual Polish**

**Issue:** Overlapping animations between dropdowns and main interface cause visual stuttering:
- Multiple concurrent animations (ttsPulse, aigfTriggerPulse, dropdownSlideIn)
- No central animation controller
- CSS layers not coordinating animation priority

**Solution:** Implement central animation controller using CSS layers priority system.

---

### 4. CSS Specificity Wars
**Priority: High** | **Component: CSS Architecture** | **Impact: Maintainability**

**Issue:** Excessive !important overrides bypass CSS layer system:
- 47 !important declarations across CSS files
- Inline styles bypassing layer cascade
- Specificity conflicts between component styles

**Files Affected:**
- `public/css/style.css` (multiple !important)
- `public/css/mobile.css` (viewport overrides)
- `public/css/buttons.css` (animation conflicts)

**Solution:** Replace !important with proper CSS layer priority cascade.

---

### 5. Event Handler Conflicts
**Priority: High** | **Component: JavaScript/Events** | **Impact: Functionality**

**Issue:** Multiple dropdowns handle same events simultaneously:
- Click events bubble to multiple handlers
- No proper event delegation through DropdownManager
- Race conditions in event processing

**Solution:** Implement centralized event delegation system.

---

## 🔧 Medium Priority Issues

### 6. TTS Error Handling Inconsistency
**Priority: Medium** | **Component: TTS/Audio** | **Impact: Error Recovery**

**Issue:** Inconsistent error handling between Kokoro TTS and fallback systems:
- Mixed error reporting patterns in `workers/kokoro.js`
- Legacy Web Speech API references remain in error paths
- Error context not properly chained

**Files Affected:**
- `workers/kokoro.js` (lines 51-100)
- `public/js/text2speech.js` (error handlers)
- `public/js/error-manager.js` (TTS error types)

---

### 7. Configuration Validation Gaps
**Priority: Medium** | **Component: Configuration** | **Impact: Development Experience**

**Issue:** Incomplete validation in `config/env.js`:
- Optional services show as "not configured" without clear guidance
- Missing validation for service URL format
- No auto-detection of common configuration errors

**Files Affected:**
- `config/env.js` (validation functions)
- `.env.example` (documentation gaps)

---

### 8. Resource Monitor Performance
**Priority: Medium** | **Component: Monitoring** | **Impact: Performance**

**Issue:** Resource monitor updates too frequently without throttling:
- Updates every frame during TTS playback
- No debouncing for DOM updates
- Memory usage tracking not optimized

**Files Affected:**
- `public/css/style.css` (.resource-monitor styles)
- Component integration points

---

## 🛠️ Low Priority Issues

### 9. Legacy Code Cleanup
**Priority: Low** | **Component: Code Quality** | **Impact: Maintainability**

**Issue:** Remaining legacy code patterns after v0.3.0 refactor:
- Legacy format support in TTS system
- Backward compatibility code in AI dropdown
- Debug logging inconsistencies

**Files Affected:**
- `public/js/text2speech.js` (line 472, 913)
- `public/js/dropdowns/ai-dropdown.js` (line 292)
- `public/js/dropdowns/tts-dropdown.js` (line 481)

---

### 10. Documentation Completeness
**Priority: Low** | **Component: Documentation** | **Impact: Developer Experience**

**Issue:** Missing documentation for advanced features:
- Voice mixing syntax (af_bella+af_sky) not documented
- Error recovery patterns not covered
- Testing patterns for new components

**Files Affected:**
- `public/docs/*.md` (API documentation)
- `README.md` (advanced usage)

---

## 🧪 Testing & Validation Issues

### 11. Test Coverage Gaps
**Priority: Medium** | **Component: Testing** | **Impact: Quality Assurance**

**Issue:** Missing test coverage for critical UI components:
- Dropdown interactions not tested
- Mobile responsive behavior not validated
- Animation conflicts not covered in stability tests

**Files Affected:**
- `tests/stability.test.js` (UI testing gaps)
- Missing: `tests/ui-components.test.js`

---

### 12. CI/CD Environment Consistency
**Priority: Low** | **Component: CI/CD** | **Impact: Deployment**

**Issue:** Environment inconsistencies between local and CI:
- External service mocking in CI mode
- Different timeout values for tests
- Report generation differences

**Files Affected:**
- `.github/workflows/test.yml`
- `tests/environment.test.js`

---

## 📊 Technical Debt Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|---------|-----|-------|
| UI/UX | 2 | 3 | 1 | 2 | 8 |
| Architecture | 0 | 1 | 2 | 1 | 4 |
| Performance | 0 | 0 | 1 | 0 | 1 |
| Testing | 0 | 0 | 1 | 1 | 2 |
| Documentation | 0 | 0 | 0 | 1 | 1 |
| **Total** | **2** | **4** | **5** | **5** | **16** |

---

## 🚀 Completion Roadmap

### Phase 1: Critical Fixes (Target: 95% Complete)
- [ ] Fix dropdown state management conflicts
- [ ] Resolve mobile/desktop responsive conflicts
- [ ] Complete CSS layer system implementation

### Phase 2: High Priority (Target: 97% Complete)
- [ ] Implement animation timing controller
- [ ] Eliminate CSS specificity wars
- [ ] Centralize event handler system

### Phase 3: Polish & Testing (Target: 99% Complete)
- [ ] Complete TTS error handling standardization
- [ ] Expand test coverage for UI components
- [ ] Performance optimization for resource monitor

### Phase 4: Maintenance (Target: 100% Complete)
- [ ] Legacy code cleanup
- [ ] Documentation completion
- [ ] CI/CD environment consistency

---

## 📋 Issue Templates

### Bug Report Template
```markdown
**Component:** [UI/Backend/TTS/AI/Testing]
**Priority:** [Critical/High/Medium/Low]
**Environment:** [Development/Production/CI]

**Description:**
Brief description of the issue

**Reproduction Steps:**
1. Step 1
2. Step 2
3. Expected vs Actual result

**Files Affected:**
- `path/to/file.js` (specific lines if known)

**Proposed Solution:**
Brief description of potential fix
```

### Feature Request Template
```markdown
**Component:** [UI/Backend/TTS/AI/Testing]
**Priority:** [High/Medium/Low]

**Description:**
What feature should be added and why

**Use Case:**
How would this feature be used

**Implementation Notes:**
Technical considerations or constraints
```

---

## 🔗 Related Documentation

- [CHANGELOG.md](../CHANGELOG.md) - Version history and changes
- [copilot-instructions.md](copilot-instructions.md) - Development patterns
- [docs/tree.md](../public/docs/tree.md) - File completion tracking
- [tests/TROUBLESHOOTING.md](../tests/TROUBLESHOOTING.md) - Testing issues

---

*Last Updated: October 25, 2025*
*Next Review: November 1, 2025*
