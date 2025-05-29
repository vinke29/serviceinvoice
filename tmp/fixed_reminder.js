const VERIFIED_SENDER = 'billienowcontact@gmail.com';
const fromName = `${user.name || senderName} via BillieNow`;

// Generate PDF for attachment
console.log('Generating PDF for invoice attachment');
let logoImage = null;
if (user.logo && typeof user.logo === 'string' && user.logo.startsWith('http')) {
  try {
    // Using the same urlToBase64 helper as in the sendInvoiceEmail function
    const urlToBase64 = async (url) => {
      const response = await fetch(url);
      const buffer = await response.buffer();
      return 'data:image/png;base64,' + buffer.toString('base64');
    };
    logoImage = await urlToBase64(user.logo);
  } catch (error) {
    console.warn('Error converting logo to base64:', error);
    // Continue without logo
  }
}

// Generate the PDF buffer using the generateInvoicePdfBuffer function
const pdfBuffer = await generateInvoicePdfBuffer({ 
  invoice, 
  user, 
  client, 
  logoImage 
});
console.log('PDF generated successfully');

const msg = {
  to: client.email,
  from: {
    email: VERIFIED_SENDER,
    name: fromName
  },
  replyTo: user.email,
  subject: `Payment Reminder for Invoice #${invoice.invoiceNumber}`,
  text: `Dear ${client.name},\n\nThis is a friendly reminder that invoice #${invoice.invoiceNumber} for ${currency}${amount} is due on ${new Date(invoice.dueDate).toLocaleDateString()}. Please make payment at your earliest convenience.\n\nRegards,\n${senderName}`,
  html: reminderHtml,
  attachments: [
    {
      content: pdfBuffer.toString('base64'),
      filename: `Invoice_${invoice.invoiceNumber}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment'
    }
  ]
}; 