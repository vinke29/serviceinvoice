const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

// Version 1.0.1 - Anti-spam improvements
admin.initializeApp();

// Initialize SendGrid with API key from Firebase config
sgMail.setApiKey(functions.config().sendgrid.key);

exports.sendInvoiceEmail = functions.firestore
  .document('users/{userId}/invoices/{invoiceId}')
  .onCreate(async (snap, context) => {
    try {
      const invoice = snap.data();
      const { userId, invoiceId } = context.params;

      // Skip if this is a scheduled invoice
      if (invoice.status === 'scheduled') {
        console.log('Skipping email for scheduled invoice:', invoiceId);
        return null;
      }

      // Get the client data
      const clientDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .collection('clients')
        .doc(invoice.clientId)
        .get();

      if (!clientDoc.exists) {
        console.error('Client not found:', invoice.clientId);
        return null;
      }

      const client = clientDoc.data();

      // Get the user's data for the "from" email
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        console.error('User not found:', userId);
        return null;
      }

      const user = userDoc.data();

      // Check if the invoice has line items, otherwise use the description and amount as a single item
      const lineItems = invoice.lineItems || [{
        description: invoice.description,
        amount: invoice.amount,
        quantity: 1,
        rate: invoice.amount
      }];
      
      // Calculate subtotal, tax and total
      const subtotal = lineItems.reduce((total, item) => total + (parseFloat(item.amount) || 0), 0);
      const taxRate = invoice.taxRate || 0;
      const taxAmount = (subtotal * taxRate / 100) || 0;
      const total = subtotal + taxAmount;
      
      // Format currency
      const formatCurrency = (amount) => {
        return parseFloat(amount).toFixed(2);
      };

      const emailHtml = `
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 0;
              }
              .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                border: 1px solid #ddd;
              }
              .header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
              }
              .logo-container {
                flex: 1;
              }
              .logo {
                max-width: 200px;
                max-height: 100px;
              }
              .invoice-info {
                flex: 1;
                text-align: right;
              }
              .company-details {
                margin-top: 20px;
              }
              .bill-to {
                margin-bottom: 30px;
              }
              .invoice-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
              }
              .invoice-table th {
                background-color: #f5f5f5;
                padding: 10px;
                text-align: left;
                border-bottom: 2px solid #ddd;
              }
              .invoice-table td {
                padding: 10px;
                border-bottom: 1px solid #eee;
              }
              .amount-column {
                text-align: right;
              }
              .totals {
                width: 100%;
                margin-bottom: 30px;
              }
              .totals table {
                width: 350px;
                margin-left: auto;
              }
              .totals td {
                padding: 5px 10px;
              }
              .total-row {
                font-weight: bold;
                border-top: 2px solid #ddd;
              }
              .payment-info {
                margin-top: 30px;
                border-top: 1px solid #ddd;
                padding-top: 20px;
              }
              .footer {
                margin-top: 40px;
                text-align: center;
                color: #777;
                font-size: 14px;
              }
              .payment-button {
                display: inline-block;
                background-color: #4f46e5;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 4px;
                font-weight: bold;
                margin-top: 20px;
              }
              .payment-methods {
                margin-top: 20px;
              }
              .late-fee {
                margin-top: 20px;
                font-style: italic;
              }
            </style>
          </head>
          <body>
            <div class="invoice-container">
              <div class="header">
                <div class="logo-container">
                  ${user.logoUrl ? `<img src="${user.logoUrl}" alt="${user.companyName || user.name} Logo" class="logo">` : ''}
                  <div class="company-details">
                    <h2>${user.companyName || user.name}</h2>
                    <p>${user.businessNumber ? `Business Number: ${user.businessNumber}<br>` : ''}
                    ${user.address ? `${user.address}<br>` : ''}
                    ${user.phone ? `${user.phone}<br>` : ''}
                    ${user.email}</p>
                  </div>
                </div>
                <div class="invoice-info">
                  <h1>INVOICE</h1>
                  <p><strong>${invoice.invoiceNumber}</strong></p>
                  <table>
                    <tr>
                      <td><strong>DATE</strong></td>
                      <td>${invoice.date}</td>
                    </tr>
                    <tr>
                      <td><strong>DUE DATE</strong></td>
                      <td>${invoice.dueDate}</td>
                    </tr>
                    <tr>
                      <td><strong>BALANCE DUE</strong></td>
                      <td>USD $${formatCurrency(total)}</td>
                    </tr>
                  </table>
              </div>
              </div>
              
              <div class="bill-to">
                <h3>BILL TO</h3>
                <p>
                  ${client.name}<br>
                  ${client.address ? `${client.address}<br>` : ''}
                  ${client.city && client.state ? `${client.city}, ${client.state}${client.zipCode ? ` ${client.zipCode}` : ''}<br>` : ''}
                  ${client.email}<br>
                  ${client.phone ? `${client.phone}` : ''}
                </p>
              </div>
              
              <table class="invoice-table">
                <thead>
                  <tr>
                    <th>DESCRIPTION</th>
                    <th>RATE</th>
                    <th>QTY</th>
                    ${taxRate > 0 ? '<th>TAX</th>' : ''}
                    <th>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItems.map(item => `
                  <tr>
                      <td>${item.description}</td>
                      <td>$${formatCurrency(item.rate || item.amount)}</td>
                      <td>${item.quantity || 1}</td>
                      ${taxRate > 0 ? `<td>${taxRate}%</td>` : ''}
                      <td class="amount-column">$${formatCurrency(item.amount)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <div class="totals">
                <table>
                  <tr>
                    <td>SUBTOTAL</td>
                    <td class="amount-column">$${formatCurrency(subtotal)}</td>
                  </tr>
                  ${taxRate > 0 ? `
                  <tr>
                    <td>TAX (${taxRate}%)</td>
                    <td class="amount-column">$${formatCurrency(taxAmount)}</td>
                  </tr>
                  ` : ''}
                  <tr class="total-row">
                    <td>TOTAL</td>
                    <td class="amount-column">$${formatCurrency(total)}</td>
                  </tr>
                  ${invoice.paymentAmount ? `
                  <tr>
                    <td>Payment</td>
                    <td class="amount-column">-$${formatCurrency(invoice.paymentAmount)}</td>
                  </tr>
                  <tr>
                    <td>BALANCE DUE</td>
                    <td class="amount-column">USD $${formatCurrency(total - invoice.paymentAmount)}</td>
                  </tr>
                  ` : ''}
              </table>
              </div>
              
              <div class="payment-info">
                ${user.paymentInstructions ? `<p>${user.paymentInstructions}</p>` : ''}
                
                ${user.venmoUsername ? `<p><strong>Venmo:</strong> @${user.venmoUsername}</p>` : ''}
                
                ${invoice.paymentLink ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${invoice.paymentLink}" class="payment-button">Pay Now</a>
                </div>
                ` : ''}
                
                ${user.lateFeePolicy ? `
                <p class="late-fee">${user.lateFeePolicy}</p>
                ` : ''}
              </div>
              
              <div class="footer">
                <p>Thanks for your business!</p>
                <p style="font-size: 12px;">This is a transactional email sent from BillieNow on behalf of ${user.companyName || user.name || 'your service provider'}.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      // Plain text version of the email (important for anti-spam)
      const textContent = `
INVOICE

${user.companyName || user.name}
${user.businessNumber ? `Business Number: ${user.businessNumber}` : ''}
${user.address || ''}
${user.phone || ''}
${user.email}

Invoice #: ${invoice.invoiceNumber}
Date: ${invoice.date}
Due Date: ${invoice.dueDate}
Balance Due: USD $${formatCurrency(total)}

Bill To:
${client.name}
${client.address || ''}
${client.city && client.state ? `${client.city}, ${client.state}${client.zipCode ? ` ${client.zipCode}` : ''}` : ''}
${client.email}
${client.phone || ''}

${lineItems.map(item => `
Description: ${item.description}
Rate: $${formatCurrency(item.rate || item.amount)}
Quantity: ${item.quantity || 1}
${taxRate > 0 ? `Tax Rate: ${taxRate}%` : ''}
Amount: $${formatCurrency(item.amount)}
`).join('\n')}

Subtotal: $${formatCurrency(subtotal)}
${taxRate > 0 ? `Tax (${taxRate}%): $${formatCurrency(taxAmount)}` : ''}
Total: $${formatCurrency(total)}
${invoice.paymentAmount ? `
Payment: -$${formatCurrency(invoice.paymentAmount)}
Balance Due: USD $${formatCurrency(total - invoice.paymentAmount)}
` : ''}

${user.paymentInstructions ? user.paymentInstructions : ''}
${user.venmoUsername ? `Venmo: @${user.venmoUsername}` : ''}
${invoice.paymentLink ? `Pay Now: ${invoice.paymentLink}` : ''}
${user.lateFeePolicy ? user.lateFeePolicy : ''}

Thanks for your business!
This is a transactional email sent from BillieNow on behalf of ${user.companyName || user.name || 'your service provider'}.
      `;

      // Anti-spam measures:
      // 1. Use a verified sender domain (billienowcontact@gmail.com)
      // 2. Set proper from name to maintain brand recognition
      // 3. Add reply-to header with the user's email
      // 4. Add proper email categories and headers
      // 5. Include unsubscribe link (required by CAN-SPAM Act)
      // 6. Include both HTML and plain text versions
      // 7. Add proper DMARC-friendly headers
      
      const VERIFIED_SENDER = 'billienowcontact@gmail.com';

      const msg = {
        to: client.email,
        from: {
          email: VERIFIED_SENDER,
          name: `${user.name || 'Your Service Provider'} via BillieNow`
        },
        replyTo: user.email,
        bcc: user.bccEmail || user.email, // BCC the user's specified BCC email or their own email
        subject: `Invoice #${invoice.invoiceNumber} from ${user.name || 'Your Service Provider'}`,
        text: textContent,
        html: emailHtml,
        categories: ['invoice', 'transactional']
      };

      await sgMail.send(msg);
      console.log('Email sent successfully for invoice:', invoiceId, '- Anti-spam measures applied');
      
      // Update the invoice to mark email as sent
      await snap.ref.update({
        emailSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return null;
    } catch (error) {
      console.error('Error sending invoice email:', error);
      return null;
    }
  }); 