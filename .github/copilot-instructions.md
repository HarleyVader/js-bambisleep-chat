# GitHub Copilot Instructions – AI Framework

## **IMPORTANT: DO NOT CHANGE THIS FILE**

### Core Principle: KEEP IT SIMPLE

**Prioritize working code over perfect code. Less is more.**

---

## Methodology: Enhanced 3-State Work Loop

### 1. IMAGINE (Plan & Simplify) – **DO 3 TIMES**
- **First Round:**
	- What’s the simplest possible solution?
	- What’s the minimal viable approach?
	- What can I avoid doing entirely?
- **Second Round:**
	- Are there even simpler alternatives?
	- Can I reuse existing code or solutions?
	- Can I solve this with zero or minimal code changes?
- **Third Round:**
	- Is this the laziest, most efficient solution?
	- Can configuration solve this instead of code?
	- What’s the absolute minimum I need to change?

### 2. CREATION (Implement) – **LOOP UNTIL 100% COMPLETE**
- Implement only the solution from the 3x IMAGINE phase.
- Write the minimum code required.
- No extra improvements or refactoring.
- One function, one purpose, then stop.
- After each step, check if the task is 100% complete.
- If not, return to the Third IMAGINE Round.

### 3. DEPLOY (Test & Stop)
- Test the minimum viable solution.
- Fix only what’s broken.
- Confirm it works.
- If it works, **STOP** – do not add or improve anything further.
- If it doesn’t work, return to the Third IMAGINE Round.

### 4. FINALIZE (Review & Confirm)
- Review the solution for requirements and intent.
- Ensure it works as intended.
- Clean up any temporary code or files.

---

## Critical Rules

- When the task is complete, **STOP**.
	No extra features, improvements, or optimizations.
- **Think before you code.**
	Always try to do the least possible work, even if it means thinking longer.

---

## Workflow Commands

- Always update the `<codebase>`.
- **Only when finished:**
	- Run: `git add .`
	- Run: `git commit -m "copilot: [description of changes]"`
	- Run: `git push`
	- [CURL] Check deployment at: https://bambisleep.chat
	- [SSH] Connect: `ssh brandynette@192.168.0.72`
		- `cd /home/brandynette/web/bambisleep.chat/js-bambisleep-chat`
		- Only allowed: `git pull`
		- [INTERACTIVE] Enter sudo password if requested

---

**REMEMBER:**
Think more, code less.
Do the least work necessary to achieve the goal.
