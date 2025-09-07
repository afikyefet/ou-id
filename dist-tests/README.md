# FluxFill - Test Suite

This directory contains smoke tests and fixtures for the FluxFill Chrome extension.

## Test Structure

```
dist-tests/
├── fixtures/           # Test HTML pages
├── tests/             # Playwright test files
├── playwright.config.js
└── README.md          # This file
```

## Running Tests

### Prerequisites

1. Install Playwright:
```bash
npm install -D @playwright/test
npx playwright install
```

2. Load the extension:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

### Run Tests

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/smoke.spec.ts

# Run with UI mode
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed
```

## Test Coverage

### Smoke Tests (`tests/smoke.spec.ts`)

1. **Extension Loading**
   - Extension loads without console errors
   - Popup opens and displays correctly
   - Content scripts inject properly

2. **Basic Functionality**
   - Pick element → create variable → paste value
   - Floating panel shows/hides correctly
   - Profile creation and form filling

3. **Edge Cases**
   - Shadow DOM elements
   - Rapid user interactions
   - Form validation

### Fixtures (`fixtures/`)

1. **basic-forms.html** - Standard HTML forms
2. **shadow-dom.html** - Shadow DOM test page
3. **complex-forms.html** - Advanced form scenarios

## Manual QA Checklist

### Core Functionality
- [ ] Extension loads without console errors
- [ ] Popup opens and displays all tabs
- [ ] Pick element creates variable with correct selector
- [ ] Copy from page updates variable value
- [ ] Paste button appears on form fields
- [ ] Floating panel shows/hides correctly
- [ ] Profile creation works
- [ ] Form filling with profiles works

### Edge Cases
- [ ] Works on restricted pages (graceful degradation)
- [ ] Handles shadow DOM elements
- [ ] Works with dynamic content
- [ ] Handles rapid user interactions
- [ ] Memory usage stays reasonable

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility
- [ ] Focus management
- [ ] ARIA labels present

### Performance
- [ ] No memory leaks
- [ ] Responsive UI
- [ ] Efficient DOM scanning
- [ ] Proper event cleanup

## Known Limitations

1. **Cross-origin iframes**: Extension cannot access cross-origin iframe content
2. **Closed shadow roots**: Cannot access elements in closed shadow DOM
3. **Restricted pages**: chrome://, PDFs, Chrome Web Store pages
4. **Dynamic content**: May need manual refresh for heavily dynamic pages

## Troubleshooting

### Common Issues

1. **Tests fail to find elements**
   - Check if extension is loaded
   - Verify content scripts are injected
   - Check browser console for errors

2. **Permission errors**
   - Ensure extension has required permissions
   - Check manifest.json configuration

3. **Selector issues**
   - Verify selector-utils.js is loaded
   - Check for shadow DOM conflicts

### Debug Mode

Run tests with debug output:
```bash
npx playwright test --debug
```

Check extension console:
- Open DevTools on test page
- Look for extension-related errors
- Check Network tab for failed requests
