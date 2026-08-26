const fs = require('fs');
const path = require('path');

function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('❌ Error: Please provide a file path.');
    console.log('Usage: node scripts/convert-wix-urls.js <path-to-file>');
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Error: File not found at path "${absolutePath}"`);
    process.exit(1);
  }

  console.log(`📂 Reading file from: ${absolutePath}`);
  const content = fs.readFileSync(absolutePath, 'utf8');

  // Regex to match: 
  // wix:image://v1/<mediaId>/<filename>#originWidth=<w>&originHeight=<h>
  // or wix:image://v1/<mediaId>/<filename>
  // or wix:image://v1/<mediaId>
  const wixRegex = /wix:image:\/\/v1\/([^\/\s"#\\]+)(?:\/[^\/\s"#\\]+)?(?:#[^\/\s"\\]*)?/g;

  let matchCount = 0;
  const replacedContent = content.replace(wixRegex, (match, mediaId) => {
    matchCount++;
    return `https://static.wixstatic.com/media/${mediaId}`;
  });

  if (matchCount === 0) {
    console.log('ℹ️ No Wix image references found in the file.');
    process.exit(0);
  }

  // Create a backup of the original file
  const backupPath = `${absolutePath}.bak`;
  fs.writeFileSync(backupPath, content, 'utf8');
  console.log(`💾 Original backup saved to: ${backupPath}`);

  // Save the converted content
  fs.writeFileSync(absolutePath, replacedContent, 'utf8');
  console.log(`✅ Successfully converted ${matchCount} Wix image references!`);
  console.log(`📁 Converted file saved to: ${absolutePath}`);
}

main();
