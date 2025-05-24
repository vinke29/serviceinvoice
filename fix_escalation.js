import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the file
const filePath = path.join(__dirname, 'functions', 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

// Insert the business details and PDF logic
const insertBeforePattern = 'const VERIFIED_SENDER = \'billienowcontact@gmail.com\';';
const insertAfterPattern = 'msg = {';

// Find the occurrence in the sendInvoiceEscalation function
const escalationFunctionStartIndex = content.indexOf('exports.sendInvoiceEscalation');
if (escalationFunctionStartIndex === -1) {
  console.error('Could not find sendInvoiceEscalation function');
  process.exit(1);
}

// Search for "const VERIFIED_SENDER" after that index
const fromVerifiedSenderIndex = content.indexOf(insertBeforePattern, escalationFunctionStartIndex);
if (fromVerifiedSenderIndex === -1) {
  console.error('Could not find VERIFIED_SENDER in sendInvoiceEscalation function');
  process.exit(1);
}

// Search for msg object beginning after that
const msgObjectStart = content.indexOf(insertAfterPattern, fromVerifiedSenderIndex);
if (msgObjectStart === -1) {
  console.error('Could not find msg object in sendInvoiceEscalation function');
  process.exit(1);
}

// Code to insert after the escalationHtml declaration
const businessDetailsCode = `
    // --- Business Details Block (consistent with other emails) ---
    let logoHtmlEscalation = '';
    if (user.logo && typeof user.logo === 'string' && user.logo.startsWith('http')) {
      logoHtmlEscalation = \`<img src="\${user.logo}" alt="\${user.companyName || user.name}" style="width:60px;height:60px;object-fit:contain;border-radius:50%;background:#fff;display:block;" />\`;
    } else {
      logoHtmlEscalation = \`<div style="width:60px;height:60px;border-radius:50%;background:#2c5282;color:#fff;font-size:30px;font-weight:bold;text-align:center;line-height:60px;">\${(user.companyName || user.name || 'B').charAt(0).toUpperCase()}</div>\`;
    }
    const businessDetailsHtml = \`
      <div style="margin-top:32px;font-size:13px;color:#666;text-align:center;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:8px;">\${logoHtmlEscalation}</td></tr></table>
        <strong>\${user.companyName || user.name}</strong><br/>
        \${(user.street || user.address || '') + (user.city ? ', ' + user.city : '') + (user.state ? ', ' + user.state : '') + ((user.postalCode || user.zip) ? ' ' + (user.postalCode || user.zip) : '')}<br/>
        \${user.phone || ''}<br/>
        <a href="mailto:\${user.email}" style="color:#2c5282;text-decoration:none;">\${user.email}</a>
        \${user.website ? \`<div style="font-size:13px;color:#2c5282;"><a href="\${user.website}" style="color:#2c5282;text-decoration:underline;">\${user.website}</a></div>\` : ''}
      </div>
      <div style="height:40px;"></div>
    \`;
    // Insert business details into escalationHtml
    escalationHtml = escalationHtml.replace('</body></html>', \`\${businessDetailsHtml}</body></html>\`);

    // --- PDF Attachment Logic (consistent with other emails) ---
    async function urlToBase64(url) {
      const response = await fetch(url);
      const buffer = await response.buffer();
      return 'data:image/png;base64,' + buffer.toString('base64');
    }
    let logoImage = null;
    if (user.logo && typeof user.logo === 'string' && user.logo.startsWith('http')) {
      try {
        logoImage = await urlToBase64(user.logo);
      } catch (e) {
        logoImage = null;
      }
    }
    // Generate PDF buffer
    const pdfBuffer = await generateInvoicePdfBuffer({ invoice, user, client, logoImage });

    `;

// Find the location to insert the business details code
const fromNameVerifiedSenderLine = content.substring(fromVerifiedSenderIndex, msgObjectStart).trim().split('\n').length;
const insertBusinessDetailsPosition = fromVerifiedSenderIndex + content.substring(fromVerifiedSenderIndex, msgObjectStart).lastIndexOf('\n') + 1;

// Insert the business details and PDF logic
const updatedContent = 
  content.substring(0, insertBusinessDetailsPosition) + 
  businessDetailsCode + 
  content.substring(insertBusinessDetailsPosition);

// Find where to update the msg object to include attachments
const msgObjectStartChar = msgObjectStart + insertAfterPattern.length;
const closingBracketIndex = updatedContent.indexOf('};', msgObjectStartChar);
if (closingBracketIndex === -1) {
  console.error('Could not find closing bracket of msg object');
  process.exit(1);
}

// Check if msg needs to have a comma added before attachments
const msgObjectContent = updatedContent.substring(msgObjectStartChar, closingBracketIndex);
const needsComma = !msgObjectContent.trim().endsWith(',');

// Construct the attachment code
const attachmentCode = `${needsComma ? ',' : ''}
      attachments: [
        {
          content: pdfBuffer.toString('base64'),
          filename: \`Invoice_\${invoice.invoiceNumber}.pdf\`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]`;

// Update the msg object
const finalContent = 
  updatedContent.substring(0, closingBracketIndex) + 
  attachmentCode + 
  updatedContent.substring(closingBracketIndex);

// Write back to file
fs.writeFileSync(filePath, finalContent, 'utf8');

console.log('Successfully updated sendInvoiceEscalation function with business details and PDF attachment!'); 