import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pull out just the part we know works - the PDF attachment code
const addPdfAttachmentToEscalation = () => {
  // Read the file
  const filePath = path.join(__dirname, 'functions', 'index.js');
  let content = fs.readFileSync(filePath, 'utf8');

  // Find the sendInvoiceEscalation function
  const functionStart = content.indexOf('exports.sendInvoiceEscalation');
  const functionEnd = content.indexOf('exports.', functionStart + 10);
  
  if (functionStart === -1) {
    console.error('Could not find sendInvoiceEscalation function');
    process.exit(1);
  }

  // Get the function code
  const functionCode = content.substring(functionStart, functionEnd > 0 ? functionEnd : undefined);
  
  // Check if function already has PDF attachment
  if (functionCode.includes('pdfBuffer')) {
    console.log('Function already seems to have PDF attachment logic. Skipping to avoid duplication.');
    return;
  }
  
  // Find where the msg object is defined in the function
  const msgDefinitionStart = functionCode.indexOf('const msg = {');
  if (msgDefinitionStart === -1) {
    console.error('Could not find msg object in sendInvoiceEscalation function');
    return;
  }
  
  // Find the msg object end
  const msgObjectEnd = functionCode.indexOf('};', msgDefinitionStart);
  if (msgObjectEnd === -1) {
    console.error('Could not find the end of msg object');
    return;
  }
  
  // Get the absolute positions in the file
  const absoluteMsgStart = functionStart + msgDefinitionStart;
  const absoluteMsgEnd = functionStart + msgObjectEnd;
  
  // Find the position to insert PDF generation code (right before msg object definition)
  const pdfGenerationCode = `
    // --- Add business details to HTML template ---
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
    
    // Add business details to the end of the HTML body
    escalationHtml = escalationHtml.replace('</body></html>', \`\${businessDetailsHtml}</body></html>\`);
    
    // --- PDF Attachment Logic ---
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
  
  // Add attachments property to msg object
  const msgObjectContent = content.substring(absoluteMsgStart, absoluteMsgEnd);
  const lastProperty = msgObjectContent.lastIndexOf(',');
  const needsComma = lastProperty < msgObjectContent.lastIndexOf('{');
  
  const attachmentCode = `${needsComma ? '' : ','}
      attachments: [
        {
          content: pdfBuffer.toString('base64'),
          filename: \`Invoice_\${invoice.invoiceNumber}.pdf\`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]`;
  
  // Insert the code
  const updatedContent = 
    content.substring(0, absoluteMsgStart) + 
    pdfGenerationCode + 
    content.substring(absoluteMsgStart, absoluteMsgEnd) + 
    attachmentCode + 
    content.substring(absoluteMsgEnd);
  
  // Write the updated content back to the file
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  
  console.log('Successfully added PDF attachment to sendInvoiceEscalation function!');
};

// Execute the function
addPdfAttachmentToEscalation(); 