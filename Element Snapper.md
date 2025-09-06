Element Snapper — Mission, Plan & Build Guide (MVP → v1)

Purpose: A privacy-first Chrome extension that lets users capture values from web page elements and paste saved variables into target forms with one click. Think Grammarly’s “overlay + popup” control, but for DOM elements and form data.

1) Mission & Principles
Mission

Give users a fast, safe way to pick DOM elements, remember them across similar URLs, and automate copy/paste into forms.

Principles

Privacy first: No external servers. All data stays in chrome.storage.local (or sync if explicitly enabled later).

User intent only: Never auto-act on sensitive pages without a click. Clear feedback on every operation.

Resilient selectors: Prefer stable attributes; avoid brittle classes.

Simple first: “Click → capture” and “Click → paste” are the core loops.

Extensible: Clean architecture to add deeper shadow DOM, iframe routing, or export/import later.

2) Scope
In Scope (MVP)

Select elements via a Picker Overlay and store selectors by relaxed URL pattern.

Variables: CRUD + manual copy from a saved selector on the current page.

Auto-copy window (e.g., mark a var “live” for N minutes).

Profiles: mappings targetSelector → (variable|literal); Paste to page fires input/change.

Shallow shadow DOM resolution; same-origin iframes via all_frames: true.

Clear errors on non-scriptable pages (chrome://, PDFs, Web Store).

Out of Scope (for MVP)

Cross-origin iframes, deep shadow recursion, multi-browser packaging, cloud sync, team sharing.

3) User Stories

As a user, I can pick an element on a page and save its selector + value under a site pattern.

As a user, I can copy from page later on a sibling URL and update a chosen variable.

As a user, I can CRUD variables and set auto-copy windows.

As a user, I can build a profile mapping variables or literals to target selectors.

As a user, I can paste a profile to fill forms and see success/warnings per field.

4) System Architecture

manifest.json (MV3): permissions: storage, activeTab, scripting, alarms, tabs; content script on <all_urls> with all_frames: true.

Service Worker (service_worker.js):

Injects picker.js.

Forwards GET_SNAPSHOT and PASTE_PROFILE between popup and content.

Manages alarms for auto-copy expiry.

Content Script (content.js):

Exposes window.__ES_UTILS__ = { robustSelector, getElementValue }.

Resolves selectors (document → shallow shadow roots).

Reads/sets values and dispatches input/change.

Picker (picker.js): overlay to capture element; prefers content helpers; click → send {selector, url, value}.

Popup UI (popup.html/css/js):

Tabs: Variables, Sites, Profiles.

Variables CRUD + auto-copy.

Sites list & editable URL patterns.

Profiles: per-row Pick (selector), Variable dropdown, Literal fallback; Paste button.

5) Data Model
type Var = { id: string; name: string; value?: string; autoCopyUntil?: number };
type ElementRef = { selector: string; note?: string; createdAt: number };
type Site = { id: string; title: string; urlPattern: string; elements: ElementRef[] };
type Mapping = { selector: string; varName?: string; value?: string }; // value is literal if varName empty
type Profile = { id: string; name: string; mappings: Mapping[] };

// chrome.storage.local keys:
VARS:    Record<string, Var>
SITES:   Record<string, Site>
PROFILES:Record<string, Profile>

6) Key Algorithms
6.1 Robust Selector Generation

Prefer stable attributes: id (no long digits), name, data-testid, role → tag + attributes.

Fallback path (≤5 nodes): tag + up to 2 filtered classes (no long digits, < 40 chars), add :nth-of-type when siblings share tag.

Avoid chained deep paths unless necessary.

6.2 URL Patterning (for cross-page reuse)

Convert origin + pathname into a relaxed pattern:

Replace numeric/UUID-ish segments with *.

Append /* to allow deeper paths.

E.g., https://shop.com/admin/orders/12345 → https://shop.com/admin/orders/*/*.

Matching: segment-aware; * matches one segment; trailing /* allows suffix.

6.3 Selector Resolution

Try document.querySelector(css); if null, scan shallow shadowRoot.querySelector(css) for all hosts in frame.

6.4 Value Read/Write

Read: input/textarea (checkbox/radio handled), select, contenteditable, fallback to textContent.trim().

Write: set value/checked; dispatch input then change bubbling events.

7) UI Flows
7.1 Capture

Popup → Pick Element.

Overlay highlights; click any element.

Background receives PICKER_RESULT { selector, url, value }.

Popup stores selector under a relaxed site pattern and creates a variable with captured value.

7.2 Copy From Page

Popup → Copy from page.

Choose a variable to update.

Choose a selector filtered by current URL pattern (fallback to show all if none match).

Background asks content for value; popup updates variable.

7.3 Profiles → Paste

Create a Profile.

For each mapping row: Pick the target selector, choose Variable or type a Literal.

Paste to page → background forwards to content; content fills, events fire.

Popup shows per-field warnings if any selector couldn’t be resolved.

8) Permissions & Security

Permissions: storage, activeTab, scripting, alarms, tabs; host permissions <all_urls>.

Safe pages: Detect errors on chrome://, Web Store, PDF viewer; show friendly alert.

No background network: Keep offline (unless user opts into export/import later).

9) Error Handling & UX

Clear errors when:

Injection fails in non-scriptable pages.

Selector doesn’t resolve on current page.

No matching site pattern (fallback: show all selectors, then suggest pattern edit).

Visual state:

Auto-copy shows “auto until HH:MM:SS”.

Paste result can show “warnings” for failed selectors.

10) Testing & Acceptance

Acceptance Tests

Pick on /orders/123 → copy on /orders/456 updates variable with fresh value.

Selectors persist and resolve in shallow shadow DOM.

Profiles paste all mappings; React/Vue fields update.

Non-scriptable tab shows clear error message.

Manual Tests

Inputs: text, email, number, checkbox, radio (by name), select, textarea, contenteditable.

SPAs: ensure element resolution after route changes (re-pick if needed).

Iframes: same-origin forms work (thanks to all_frames: true).

11) File Structure
/extension
  manifest.json
  service_worker.js
  content.js
  picker.js
  popup.html
  popup.css
  popup.js
  /icons
    16.png 32.png 48.png 128.png

12) Work Plan (for Claude)

Treat each section as a separate task. After each task, run a quick smoke test in Chrome.

Task A — Scaffold (Manifest + Icons)

Create MV3 manifest with declared permissions and content scripts.

Add placeholder icons.

DoD: Extension loads (no errors) in chrome://extensions → Load unpacked.

Task B — Content Helpers

Implement robustSelector, getElementValue, setElementValue, resolveSelector with shallow shadow scan.

Expose via window.__ES_UTILS__.

Implement message handlers for RESOLVE_ELEMENT_AND_VALUE, PASTE_PROFILE_MAPPINGS.

DoD: Console snippets prove read/write works on various fields.

Task C — Picker Overlay

Implement overlay that highlights and captures clicked element.

Prefer __ES_UTILS__ helpers; fallback logic identical to content helpers.

Supports click without prior mousemove; supports shallow shadow DOM.

DoD: Click → receives {selector, url, value} reliably.

Task D — Background Worker

Inject picker on demand.

Forward popup messages to content (GET_SNAPSHOT, PASTE_PROFILE).

Manage alarms for auto-copy expiry.

DoD: Picker injects; forwarding works; alarm clears autoCopyUntil.

Task E — Popup UI

Tabs: Variables, Sites, Profiles.

Variables CRUD + auto-copy button.

Sites list with editable pattern.

Profiles with rows: Pick, Variable dropdown, and Literal field. Paste fills and fires events.

DoD: All CRUD persists to storage; UI re-renders without errors.

Task F — URL Patterning & Matching

Implement toPatternFromUrl and matchesPattern.

Use pattern on capture; filter selectors by active tab on Copy from page (fallback to all if none).

DoD: Copy works across sibling URLs with different IDs.

Task G — Error States & Alerts

Handle non-scriptable pages, selector miss, paste partial failures.

Surface clear alerts.

DoD: Human-readable alerts displayed; no silent failures.

13) Coding Standards

Plain JS, no external libs.

Small pure functions for selector/value logic.

Defensive coding around chrome.runtime.lastError.

No top-level awaits in service worker; wrap async ops in listeners.

Use pointer-events: none on picker overlay/box; very high z-index.

14) Prompts for Claude (per file)

Manifest

Create manifest.json for MV3 with permissions storage, activeTab, scripting, alarms, tabs, host <all_urls>. Add content_scripts with content.js at document_idle, all_frames: true. Background service_worker.js. Icons 16/32/48/128. Return complete JSON.

Content

Implement content.js exposing window.__ES_UTILS__ = { robustSelector, getElementValue }. Add resolveSelector, setElementValue. Support read/write for input, textarea, select, checkbox, radio (by name), contenteditable; dispatch input/change. Handle messages RESOLVE_ELEMENT_AND_VALUE and PASTE_PROFILE_MAPPINGS and return { ok, value/results }. Include shallow shadow DOM scan.

Picker

Implement picker.js overlay that highlights under cursor and, on click, captures the element even if the mouse didn’t move. Prefer window.__ES_UTILS__ helpers; otherwise use identical fallback logic. Send one message: PICKER_RESULT { selector, url: location.href, value }. Use pointer-events: none overlay; ESC cancels; no duplicates.

Service Worker

Implement service_worker.js that injects picker.js (INJECT_PICKER), forwards GET_SNAPSHOT and PASTE_PROFILE, returns friendly errors on non-scriptable pages, and manages alarms to clear autoCopyUntil by var id.

Popup

Build popup.html/css/js with tabs (Variables/Sites/Profiles). Variables CRUD + auto-copy; Sites (title + urlPattern + selectors count); Profiles with per-row Pick, Variable dropdown, and Literal field. Add “Copy from page” that filters selectors by active URL pattern (fallback to all) and updates selected variable via GET_SNAPSHOT. Add “Paste to page” building mappings preferring varName, then literal; show per-selector warnings.

15) Roadmap (post-MVP)

Options page: export/import, storage.sync toggle.

Deep shadow DOM recursion (breadth-limited for perf).

Iframe routing (cross-origin opt-in via host permissions).

Bulk pick (auto-enumerate visible inputs).

Selector healing (retry with neighbor labels; AI assist later).

16) Definition of Done (MVP)

Installable extension with no console errors.

Pick → copy across sibling URLs works.

Profiles paste with correct events (verified on React/Vue pages).

All CRUD persists; auto-copy expires via alarms.

Clear user-facing error messages; no silent failures.