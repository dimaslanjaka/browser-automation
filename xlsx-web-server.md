# XLSX Web Server

A Node.js web server that renders XLSX files from the `.cache/sheets` folder as interactive web pages using Nunjucks templating.

## Features

- 📊 **Web-based XLSX viewer** - View spreadsheets directly in your browser
- 🎨 **Nunjucks templating** - Clean separation of logic and presentation
- 🔍 **Multi-sheet support** - Navigate between different sheets with tabs
- 📱 **Responsive design** - Works on desktop and mobile devices
- 🎯 **Interactive tables** - Hover effects and easy navigation
- 📈 **JSON API** - Access sheet data programmatically
- 🚀 **Fast rendering** - Efficient XLSX to HTML conversion
- 🛠️ **Template reloading** - Automatic template updates in development

## Quick Start

1. **Download sheets first** (if you haven't already):
   ```bash
   node google-sheet-api.js
   ```

2. **Start the web server**:
   ```bash
   yarn serve-xlsx
   # or for background with logging
   yarn serve-xlsx-bg
   # or directly
   node xlsx-web-server.js
   ```

3. **Open in browser**:
   ```
   http://localhost:3000
   ```

## Template Structure

The server uses Nunjucks templates located in the `templates/` directory:

```
templates/
├── base.njk          # Base template with common styles and layout
├── file-list.njk     # Main page showing available XLSX files
├── xlsx-viewer.njk   # XLSX file viewer with sheet navigation
└── error.njk         # Error page template
```

### Template Features

- **Clean separation** - Logic in JavaScript, presentation in Nunjucks
- **Template inheritance** - All pages extend the base template
- **Custom filters** - Including a `number` filter for formatting large numbers
- **Responsive design** - Mobile-friendly layout and navigation
- **Error handling** - User-friendly error pages for common issues

## Available Endpoints

### Web Interface
- `http://localhost:3000/` - File list and main page
- `http://localhost:3000/view/filename.xlsx` - View specific XLSX file

### JSON API
- `http://localhost:3000/api/sheet/filename.xlsx` - Get all sheets as JSON
- `http://localhost:3000/api/sheet/filename.xlsx/SheetName` - Get specific sheet as JSON

## File Structure

```
.cache/
  sheets/
    ├── spreadsheet-{ID}.xlsx     # Main spreadsheet file
    ├── sheet-{name}-{id}.csv     # Individual CSV files
    └── ...
templates/
    ├── base.njk                  # Base template
    ├── file-list.njk            # File listing page
    ├── xlsx-viewer.njk          # XLSX viewer page
    └── error.njk                # Error page
tmp/
    └── xlsx-server.log          # Server logs (when using background mode)
```

## Customization

### Modifying Templates

1. **Edit templates** in the `templates/` directory
2. **Restart server** or use development mode for auto-reload
3. **Add new styles** in `base.njk` or create specific template blocks

### Template Variables

#### file-list.njk
```javascript
{
  files: [
    {
      name: "spreadsheet-123.xlsx",
      path: "/view/spreadsheet-123.xlsx",
      sizeKB: 156
    }
  ]
}
```

#### xlsx-viewer.njk
```javascript
{
  filename: "spreadsheet-123.xlsx",
  sheetNames: ["Sheet1", "Sheet2"],
  sheets: [
    {
      name: "Sheet1",
      htmlTable: "<table>...</table>"
    }
  ]
}
```

#### error.njk
```javascript
{
  errorTitle: "File Not Found",
  errorMessage: "The file was not found.",
  suggestions: ["Check file name", "Try again"]
}
```

## Development

### Logging
- Use `yarn serve-xlsx-bg` to run in background with logging to `tmp/xlsx-server.log`
- Use `start-xlsx-server.cmd` on Windows for background execution with logs

### Template Development
- Templates automatically reload when changed (watch: true)
- Error pages provide helpful debugging information
- Check `tmp/xlsx-server.log` for detailed server logs

## API Access
```javascript
// Get all sheet data
fetch('/api/sheet/spreadsheet-123.xlsx')
  .then(response => response.json())
  .then(data => console.log(data));

// Get specific sheet
fetch('/api/sheet/spreadsheet-123.xlsx/Sheet1')
  .then(response => response.json())
  .then(data => console.log(data));
```

## Troubleshooting

1. **No files showing?**
   - Make sure you've run `node google-sheet-api.js` first
   - Check that `.cache/sheets/` directory exists and contains `.xlsx` files

2. **Server won't start?**
   - Ensure you've installed dependencies: `yarn install`
   - Check that port 3000 isn't already in use
   - Review logs in `tmp/xlsx-server.log`

3. **Template errors?**
   - Check template syntax in the `templates/` directory
   - Look for Nunjucks-specific errors in server logs
   - Ensure template variables match expected structure

4. **File not found errors?**
   - Verify the XLSX file exists in `.cache/sheets/`
   - Check file permissions
   - Use the error page suggestions for guidance

## Dependencies

- **express** - Web server framework
- **nunjucks** - Templating engine
- **xlsx** - XLSX file parsing
- **fs** - File system operations
- **path** - Path utilities

## Browser Compatibility

- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers

Enjoy your template-powered XLSX viewer! 🎉
