const fs = require('fs');
const path = require('path');

// Path to glide-data-grid CSS
const gdgCssPath = path.join(__dirname, 'node_modules/@glideapps/glide-data-grid/dist/index.css');
const gdgDir = path.dirname(gdgCssPath);

// Read and resolve @imports
function resolveImports(cssContent, baseDir) {
  return cssContent.replace(/@import\s+["']([^"']+)["'];?/g, (match, importPath) => {
    try {
      const fullPath = path.join(baseDir, importPath);
      if (fs.existsSync(fullPath)) {
        let importedCss = fs.readFileSync(fullPath, 'utf8');
        // Recursively resolve nested imports
        importedCss = resolveImports(importedCss, path.dirname(fullPath));
        return `/* Inlined from: ${importPath} */\n${importedCss}\n`;
      }
    } catch (e) {
      console.warn(`Warning: Could not resolve import: ${importPath}`);
    }
    return ''; // Remove unresolved imports
  });
}

// Read glide-data-grid CSS and resolve imports
let gdgCss = fs.readFileSync(gdgCssPath, 'utf8');
gdgCss = resolveImports(gdgCss, gdgDir);

// Read our custom CSS
const customCss = fs.readFileSync(path.join(__dirname, 'src/DataGrid.css'), 'utf8');

// Combine and write
const combined = `/* Glide Data Grid Styles (bundled) */\n${gdgCss}\n\n/* Sofisoft DataGrid Styles */\n${customCss}`;

// Ensure dist folder exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

fs.writeFileSync(path.join(__dirname, 'dist/styles.css'), combined);
console.log('✅ CSS bundled successfully!');