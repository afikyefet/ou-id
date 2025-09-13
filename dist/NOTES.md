iOS UI Redesign Notes (dist-only)

Scope delivered
- Visual overrides in `ui-ios.css` loaded after `popup.css`.
- Minimal HTML wrap in `popup.html` (`.ios-shell`, segmented tabs) without changing IDs/classes used by logic.
- Overlay visual tokens updated in `page-overlay.js` (variables and CSS only; no logic touched).
- `ui-bridge.js` adds ARIA/tooltip polish and syncs pressed state for overlay/floating toggles.

Design tokens
- Font: -apple-system, SF Pro, Inter, system-ui, sans-serif
- Grid: 8pt; key steps 12, 16, 24
- Radius: 12 (panel), 10 (cards), 8 (controls)
- Shadow: soft; focus ring 2px accent
- Colors: bg #F7F7F9, surface #FFFFFF, text #111, secondary #6B7280, primary #0A84FF, danger #FF3B30

Parity checklist
- Tabs: switching works via existing handlers; ARIA roles mirrored.
- Variables
  - List renders, edit/save/delete works
  - Add variable form works
  - Auto timer: start/extend/stop prompts behave
  - Copy from Page flow, alerts and recent copy integration OK
- Sites
  - List renders, edit/save/delete works
  - Active URL shows and truncates correctly
- Profiles
  - New Profile for This Page works; opens editor
  - Edit modal: pick selector, select variable, remove input
  - Fill Form across mapped selectors
- Overlay
  - Page Controls toggle updates on-page overlay
  - Floating Vars toggle shows/hides panel; theme button cycles
  - Copy indicator and paste buttons align; recent paste chip shows on focus
- Notifications
  - Popup notifications render
  - Overlay toasts animate at bottom; success/error styles

QA smoke
- Zero console errors in popup and content pages
- Keyboard: Tab/Shift+Tab focus rings visible; arrow nav for tabs
- Contrast: labels/text on white >= AA; muted text uses rgba(60,60,67,0.6)

Notes
- All message types, IDs, classes, data-* hooks preserved.
- No new libraries or build steps added; dist-only edits.
- If a site uses strict CSP, overlay still injects inline <style> as before.


