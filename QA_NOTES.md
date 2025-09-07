# FluxFill QA & Hardening Notes

## Overview
Comprehensive QA pass on Chrome MV3 extension build to ensure robustness, consistency, and shippability.

## File Structure Analysis
```
dist/
├── content.js
├── icons/
│   ├── icon16.png
│   ├── icon32.png  
│   ├── icon48.png
│   ├── icon64.png
│   ├── icon128.png
│   └── icon256.png
├── manifest.json
├── page-overlay.js
├── picker.js
├── popup.css
├── popup.html
├── popup.js
├── service_worker.js
└── src/ (legacy files - should be cleaned up)
    ├── background.js
    ├── content.js
    ├── page-overlay.js
    ├── popup.html
    └── popup.js
```

## Issues Found & Fixes Applied

### 1. Manifest Validation (MV3)
- [ ] Check manifest.json structure
- [ ] Validate permissions are minimal
- [ ] Ensure all referenced files exist
- [ ] Content script includes page-overlay.js

### 2. File Reference Integrity
- [ ] Service worker script injection includes both content.js and page-overlay.js
- [ ] Popup HTML references exist
- [ ] Icon paths are valid

### 3. Messaging Graph & Timeouts
- [ ] Map all message handlers and senders
- [ ] Add PING/PONG handshake
- [ ] Wrap sendMessage with timeouts/retries
- [ ] Normalize message names

### 4. Content & Overlay Parity
- [ ] Unify selector resolution strategy
- [ ] Shadow DOM support
- [ ] Consistent resolver usage

### 5. Overlay Controls
- [ ] Multiple controls per element support
- [ ] Adaptive placement logic
- [ ] Corner positioning algorithm

### 6. Floating Panel
- [ ] Drag within viewport bounds
- [ ] Snap to edges functionality
- [ ] Keyboard nudging (Alt+Arrow)
- [ ] State persistence
- [ ] Cross-tab following

### 7. Popup State & UX
- [ ] Fix overlayEnabled TDZ issue
- [ ] State sync with background
- [ ] Replace blocking prompts

### 8. Storage Schema
- [ ] Validate storage keys
- [ ] Fix object spread syntax
- [ ] Add migration handler

### 9. Error Handling & UX
- [ ] Toast notifications
- [ ] ARIA-live announcements
- [ ] Console error context

### 10. Performance & Leaks
- [ ] RAF throttling for repositioning
- [ ] Event listener cleanup
- [ ] Observer management

### 11. Security & Privacy
- [ ] No eval/Function constructor
- [ ] Sanitized DOM writes
- [ ] Local-only operation

### 12. Icons & Packaging
- [ ] All required icons present
- [ ] Release zip creation
- [ ] Clean build artifacts

## Commits Made
(Will be updated as fixes are applied)

## Final Status
- Extension loaded successfully: [ ]
- All features functional: [ ]
- Ready for Web Store: [ ]