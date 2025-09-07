# FluxFill - Quick Start Guide

## Loading the Extension

### 1. Enable Developer Mode
1. Open Chrome and navigate to `chrome://extensions/`
2. Toggle "Developer mode" in the top-right corner

### 2. Load the Extension
1. Click "Load unpacked"
2. Select the `dist` folder from this project
3. The extension should appear in your extensions list

### 3. Verify Installation
- Look for "Element Snapper" in your extensions
- Check that there are no error messages
- The extension icon should appear in your browser toolbar

## Basic Usage

### 1. Pick an Element
1. Click the extension icon to open the popup
2. Click "Pick Element" button
3. Click on any form field on the current page
4. A variable will be created automatically

### 2. Copy Values
1. Open the popup and go to "Variables" tab
2. Click "Copy from Page" to update variable values
3. Or click the copy icon next to any variable

### 3. Paste Values
1. Focus on any form field
2. A "Paste" button should appear if you have a recent copy
3. Click the paste button to fill the field

### 4. Create Profiles
1. Go to "Profiles" tab in the popup
2. Click "New Profile for This Page"
3. Add form fields to the profile
4. Use "Fill Form" to auto-fill all fields

## Testing the Extension

### Run Automated Tests
```bash
cd dist-tests
npm install -D @playwright/test
npx playwright install
npx playwright test
```

### Manual Testing Checklist

#### Core Functionality
- [ ] Extension loads without console errors
- [ ] Popup opens and displays all tabs
- [ ] Pick element creates variable with correct selector
- [ ] Copy from page updates variable value
- [ ] Paste button appears on form fields
- [ ] Floating panel shows/hides correctly
- [ ] Profile creation works
- [ ] Form filling with profiles works

#### Edge Cases
- [ ] Works on restricted pages (graceful degradation)
- [ ] Handles shadow DOM elements
- [ ] Works with dynamic content
- [ ] Handles rapid user interactions
- [ ] Memory usage stays reasonable

#### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility
- [ ] Focus management
- [ ] ARIA labels present

## Troubleshooting

### Common Issues

1. **Extension doesn't load**
   - Check Chrome console for errors
   - Verify manifest.json is valid
   - Ensure all required files are present

2. **Pick element doesn't work**
   - Check if content scripts are injected
   - Look for console errors
   - Try refreshing the page

3. **Paste button doesn't appear**
   - Ensure you have a recent copy (within 20 seconds)
   - Check if the field is editable
   - Verify the extension is enabled

4. **Floating panel issues**
   - Try refreshing the page
   - Check if another tab has the panel open
   - Look for console errors

### Debug Mode

1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Look for extension-related messages
4. Check for error messages

### Reset Extension

1. Go to `chrome://extensions/`
2. Click "Remove" on the extension
3. Reload the extension from the `dist` folder

## Known Limitations

1. **Cross-origin iframes**: Extension cannot access cross-origin iframe content
2. **Closed shadow roots**: Cannot access elements in closed shadow DOM
3. **Restricted pages**: chrome://, PDFs, Chrome Web Store pages
4. **Dynamic content**: May need manual refresh for heavily dynamic pages

## Support

If you encounter issues:
1. Check the console for error messages
2. Try refreshing the page
3. Reload the extension
4. Check the test suite for known issues

## Privacy

This extension:
- Stores data locally in your browser
- Does not send data to external servers
- Only accesses pages you explicitly interact with
- Respects Chrome's permission model
