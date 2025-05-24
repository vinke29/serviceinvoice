import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the file
const filePath = path.join(__dirname, 'functions', 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

// Locate the sendInvoiceEscalation function
const escalationFunctionStartIndex = content.indexOf('exports.sendInvoiceEscalation');
if (escalationFunctionStartIndex === -1) {
  console.error('Could not find sendInvoiceEscalation function');
  process.exit(1);
}

// Fix the HTML templates to ensure logo is properly embedded
// Find both templates that need to be fixed
const softTemplateStart = content.indexOf('escalationHtml = `', escalationFunctionStartIndex);
const softTemplateEnd = content.indexOf('`;</body></html>', softTemplateStart) + 15;
const normalTemplateStart = content.indexOf('escalationHtml = `', softTemplateEnd);
const normalTemplateEnd = content.indexOf('`;</body></html>', normalTemplateStart) + 15;

if (softTemplateStart === -1 || normalTemplateStart === -1) {
  console.error('Could not find the HTML template sections in the escalation function');
  process.exit(1);
}

// The issue might be that the logo is embedded after the HTML is generated
// Let's modify the templates to include a placeholder for the business details that will be replaced
const fixedSoftTemplate = content.substring(softTemplateStart, softTemplateEnd)
  .replace('</body></html>', '<!-- BUSINESS_DETAILS --></body></html>');

const fixedNormalTemplate = content.substring(normalTemplateStart, normalTemplateEnd)
  .replace('</body></html>', '<!-- BUSINESS_DETAILS --></body></html>');

// Update the content with fixed templates
let updatedContent = content.substring(0, softTemplateStart) + 
  fixedSoftTemplate + 
  content.substring(softTemplateEnd, normalTemplateStart) + 
  fixedNormalTemplate + 
  content.substring(normalTemplateEnd);

// Now update the business details insertion to use the placeholder
const businessDetailsInsertionPattern = 'escalationHtml = escalationHtml.replace(\'</body></html>\', `${businessDetailsHtml}</body></html>`);';
const fixedBusinessDetailsInsertion = 'escalationHtml = escalationHtml.replace(\'<!-- BUSINESS_DETAILS -->\', businessDetailsHtml);';

// Find and replace the business details insertion
const businessDetailsInsertionIndex = updatedContent.indexOf(businessDetailsInsertionPattern);
if (businessDetailsInsertionIndex !== -1) {
  updatedContent = updatedContent.substring(0, businessDetailsInsertionIndex) + 
    fixedBusinessDetailsInsertion + 
    updatedContent.substring(businessDetailsInsertionIndex + businessDetailsInsertionPattern.length);
}

// Write the updated content back to the file
fs.writeFileSync(filePath, updatedContent, 'utf8');

console.log('Successfully fixed the logo display in escalation emails!'); 