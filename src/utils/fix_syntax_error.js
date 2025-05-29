import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the file
const filePath = path.join(__dirname, 'functions', 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

// Check for basic syntax issues
try {
  // Very basic syntax check using Function constructor
  // This won't catch all issues but might catch obvious ones
  new Function(content);
  console.log('No obvious syntax errors found. Checking for specific issues...');
} catch (error) {
  console.log('Syntax error detected:', error.message);
}

// Check for unbalanced brackets, braces, parentheses
const brackets = [];
const openingBrackets = { '{': '}', '(': ')', '[': ']' };
const closingBrackets = { '}': '{', ')': '(', ']': '[' };

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  
  if (openingBrackets[char]) {
    brackets.push({ char, index: i });
  } else if (closingBrackets[char]) {
    if (brackets.length === 0) {
      console.log(`Extra closing bracket ${char} at position ${i}`);
      // Fix: remove extra closing bracket
      content = content.substring(0, i) + content.substring(i + 1);
      i--; // Adjust index after deletion
    } else {
      const last = brackets.pop();
      if (openingBrackets[last.char] !== char) {
        console.log(`Mismatched brackets: ${last.char} at position ${last.index} and ${char} at position ${i}`);
        // Fix: replace the closing bracket with the correct one
        content = content.substring(0, i) + openingBrackets[last.char] + content.substring(i + 1);
      }
    }
  }
}

// Check for missing closing brackets
if (brackets.length > 0) {
  console.log('Missing closing brackets:');
  for (const bracket of brackets) {
    console.log(`${bracket.char} at position ${bracket.index} needs a ${openingBrackets[bracket.char]}`);
    // Add the missing closing bracket at the end
    content += openingBrackets[bracket.char];
  }
}

// Write the fixed content back to the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('Attempted to fix syntax errors. Please check the file manually before deploying again.'); 