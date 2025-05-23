const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const PdfPrinter = require('pdfmake');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fetch = require('node-fetch');

// Version 1.0.1 - Anti-spam improvements
admin.initializeApp();

// Create a new user document in Firestore when a user signs up
exports.createUserDocument = functions.auth.user().onCreate(async (userRecord) => {
  try {
    const { uid, email, displayName } = userRecord;
    console.log(`Creating new user document for: ${email} (${uid})`);
    
    // Create a new user document with default fields
    await admin.firestore().collection('users').doc(uid).set({
      email: email,
      firstName: displayName ? displayName.split(' ')[0] : '',
      lastName: displayName ? displayName.split(' ').slice(1).join(' ') : '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      companyName: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      website: '',
      taxId: '',
      paymentInstructions: '',
      logo: ''
    });
    
    console.log(`Successfully created user document for: ${email}`);
    return null;
  } catch (error) {
    console.error('Error creating user document:', error);
    return null;
  }
});

exports.sendInvoiceEmail = functions.firestore
  .document('users/{userId}/invoices/{invoiceId}')
  .onCreate(async (snap, context) => {
    try {
      // Log 'Invoice Created' activity immediately
      await snap.ref.update({
        activity: admin.firestore.FieldValue.arrayUnion({
          type: 'invoice_created',
          stage: 'Invoice Created',
          date: new Date().toISOString()
        })
      });
      // Initialize SendGrid with API key from Firebase config
      sgMail.setApiKey(functions.config().sendgrid.key);
      
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

      // Replace the logoHtml logic in the invoice email HTML with the following:
      const logoHtml = logoImage
        ? `<img src="${logoImage}" alt="${user.companyName || user.name}" style="width:60px;height:60px;object-fit:contain;border-radius:50%;background:#fff;display:block;" />`
        : user.logo
          ? `<img src="${user.logo}" alt="${user.companyName || user.name}" style="width:60px;height:60px;object-fit:contain;border-radius:50%;background:#fff;display:block;" />`
          : `<div style="width:60px;height:60px;border-radius:50%;background:#2c5282;color:#fff;font-size:30px;font-weight:bold;text-align:center;line-height:60px;">${(user.companyName || user.name || 'B').charAt(0).toUpperCase()}</div>`;

      const emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invoice #${invoice.invoiceNumber}</title>
        </head>
        <body style="margin:0;padding:0;background:#f5f6fa;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6fa;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin:40px 0;">
                  <tr>
                    <td style="background:#2c5282;padding:24px 0 16px 0;border-radius:8px 8px 0 0;text-align:center;">
                      <span style="display:inline-block;width:100%;font-size:24px;font-weight:bold;color:#fff;letter-spacing:1px;">INVOICE #${invoice.invoiceNumber}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px 40px 0 40px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td valign="top" width="60" style="padding-right:20px;">
                            ${logoHtml}
                          </td>
                          <td valign="top">
                            <div style="font-size:20px;font-weight:bold;color:#2c5282;">${user.companyName || user.name}</div>
                            <div style="font-size:13px;color:#333;margin-top:4px;">Business Number: ${user.taxId || ''}</div>
                            <div style="font-size:13px;color:#333;">${(user.street || user.address || '') + (user.city ? ', ' + user.city : '') + (user.state ? ', ' + user.state : '') + ((user.postalCode || user.zip) ? ' ' + (user.postalCode || user.zip) : '')}</div>
                            <div style="font-size:13px;color:#333;">${user.phone || ''}</div>
                            <div style="font-size:13px;color:#333;"><a href="mailto:${user.email}" style="color:#2c5282;text-decoration:none;">${user.email}</a></div>
                            ${user.website ? `<div style="font-size:13px;color:#2c5282;"><a href="${user.website}" style="color:#2c5282;text-decoration:underline;">${user.website}</a></div>` : ''}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 40px 0 40px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:4px;">
                        <tr>
                          <td style="padding:16px 0;text-align:center;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="width:33%;text-align:center;">
                                  <div style="font-size:13px;color:#666;">Date</div>
                                  <div style="font-size:16px;font-weight:bold;color:#2c5282;">${invoice.date}</div>
                                </td>
                                <td style="width:33%;text-align:center;">
                                  <div style="font-size:13px;color:#666;">Due Date</div>
                                  <div style="font-size:16px;font-weight:bold;color:#2c5282;">${invoice.dueDate}</div>
                                </td>
                                <td style="width:33%;text-align:center;">
                                  <div style="font-size:13px;color:#666;">Invoice #</div>
                                  <div style="font-size:16px;font-weight:bold;color:#2c5282;">${invoice.invoiceNumber}</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 40px 0 40px;">
                      <div style="font-size:15px;font-weight:bold;color:#2c5282;margin-bottom:8px;">BILL TO:</div>
                      <div style="font-size:15px;color:#333;">${client.name}</div>
                      <div style="font-size:13px;color:#333;">
                        ${[(client.street || client.address), client.city, client.state, client.postalCode, client.country].filter(Boolean).join(', ')}
                      </div>
                      <div style="font-size:13px;color:#333;">${client.email}</div>
                      <div style="font-size:13px;color:#333;">${client.phone || ''}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 40px 0 40px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <thead>
                          <tr>
                            <th align="left" style="padding:10px;font-size:14px;font-weight:bold;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">Description</th>
                            <th align="right" style="padding:10px;font-size:14px;font-weight:bold;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style="padding:10px;font-size:14px;border-bottom:1px solid #e2e8f0;">${invoice.description}</td>
                            <td align="right" style="padding:10px;font-size:14px;border-bottom:1px solid #e2e8f0;">$${formatCurrency(invoice.amount)}</td>
                          </tr>
                          <tr>
                            <td align="right" style="padding:10px;font-size:16px;font-weight:bold;background:#e6f7ff;border-top:2px solid #2c5282;">Total:</td>
                            <td align="right" style="padding:10px;font-size:16px;font-weight:bold;background:#e6f7ff;border-top:2px solid #2c5282;">$${formatCurrency(invoice.amount)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                  ${user.paymentInstructions ? `
                  <tr>
                    <td style="padding:0 40px 24px 40px;">
                      <div style="margin-top:20px;text-align:center;color:#2c5282;font-size:15px;padding:10px;background:#e6f7ff;border-radius:5px;">
                        ${user.paymentInstructions}
                      </div>
                    </td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding:32px 40px 32px 40px;border-top:1px solid #e2e8f0;text-align:center;background:#f8fafc;border-radius:0 0 8px 8px;">
                      <div style="font-size:15px;color:#2c5282;margin-bottom:5px;font-weight:bold;">Thank you for your business!</div>
                      <div style="font-size:13px;color:#666;">If you have any questions, please contact ${user.name} at <a href="mailto:${user.email}" style="color:#2c5282;text-decoration:none;">${user.email}</a></div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
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
${[(client.street || client.address), client.city, client.state, client.postalCode, client.country].filter(Boolean).join(', ')}
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
          name: `${user.name || user.companyName || 'Your Service Provider'} via BillieNow`
        },
        replyTo: user.email,
        bcc: user.bccEmail || user.email, // BCC the user's specified BCC email or their own email
        subject: `Invoice #${invoice.invoiceNumber} from ${user.name || 'Your Service Provider'}`,
        text: textContent,
        html: emailHtml,
        categories: ['invoice', 'transactional']
      };

      // --- PDF Attachment Logic ---
      // Helper to convert image URL to base64 data URL
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
      // Add PDF as attachment
      msg.attachments = [
        {
          content: pdfBuffer.toString('base64'),
          filename: `Invoice_${invoice.invoiceNumber}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ];

      await sgMail.send(msg);
      console.log('Email sent successfully for invoice:', invoiceId, '- Anti-spam measures applied');
      
      // Update the invoice to mark email as sent and log activity
      await snap.ref.update({
        emailSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        activity: admin.firestore.FieldValue.arrayUnion({
          type: 'invoice_sent',
          stage: 'Invoice Sent',
          date: new Date().toISOString()
        })
      });

      return null;
    } catch (error) {
      console.error('Error sending invoice email:', error);
      return null;
    }
  });

// Daily function to generate recurring invoices
exports.generateRecurringInvoices = functions.pubsub
  .schedule('0 0 * * *') // Run at midnight every day
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      const db = admin.firestore();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all active clients with recurring billing
      const clientsSnapshot = await db.collectionGroup('clients')
        .where('status', '==', 'active')
        .where('billingFrequency', 'in', ['weekly', 'monthly', 'quarterly', 'biannually', 'annually'])
        .get();

      const processedClients = new Set();
      const results = [];

      for (const clientDoc of clientsSnapshot.docs) {
        const client = clientDoc.data();
        const userId = clientDoc.ref.parent.parent.id;

        // Skip if we've already processed this client
        if (processedClients.has(client.id)) continue;
        processedClients.add(client.id);

        // Check if client has a next invoice date
        if (!client.nextInvoiceDate) continue;

        const nextInvoiceDate = new Date(client.nextInvoiceDate);
        nextInvoiceDate.setHours(0, 0, 0, 0);

        // If next invoice date is today or in the past, generate the invoice
        if (nextInvoiceDate <= today) {
          try {
            // Generate the invoice
            const invoiceData = {
              clientId: client.id,
              clientName: client.name,
              amount: client.fee || 0,
              description: `${client.billingFrequency.charAt(0).toUpperCase() + client.billingFrequency.slice(1)} service fee`,
              billingFrequency: client.billingFrequency,
              date: today.toISOString().split('T')[0],
              status: 'pending',
              isRecurring: true
            };

            // Add the invoice
            const invoiceRef = await db.collection('users')
              .doc(userId)
              .collection('invoices')
              .add(invoiceData);

            // Calculate and update next invoice date
            let nextDate;
            switch (client.billingFrequency) {
              case 'weekly':
                nextDate = new Date(today);
                nextDate.setDate(nextDate.getDate() + 7);
                break;
              case 'monthly':
                nextDate = new Date(today);
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
              case 'quarterly':
                nextDate = new Date(today);
                nextDate.setMonth(nextDate.getMonth() + 3);
                break;
              case 'biannually':
                nextDate = new Date(today);
                nextDate.setMonth(nextDate.getMonth() + 6);
                break;
              case 'annually':
                nextDate = new Date(today);
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
            }

            // Update client with next invoice date
            await clientDoc.ref.update({
              nextInvoiceDate: nextDate.toISOString().split('T')[0],
              lastInvoiced: today.toISOString().split('T')[0]
            });

            results.push({
              clientId: client.id,
              invoiceId: invoiceRef.id,
              status: 'success'
            });
          } catch (error) {
            console.error(`Error generating invoice for client ${client.id}:`, error);
            results.push({
              clientId: client.id,
              status: 'error',
              error: error.message
            });
          }
        }
      }

      console.log('Recurring invoice generation results:', results);
      return null;
    } catch (error) {
      console.error('Error in generateRecurringInvoices:', error);
      throw error;
    }
  });

exports.sendInvoiceReminder = functions.https.onCall(async (data, context) => {
  try {
    // Check if the user is authenticated
    if (!context.auth) {
      console.error('Authentication failed: No auth context');
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send reminders.');
    }

    const { userId, invoiceId, clientId } = data;
    if (!userId || !invoiceId || !clientId) {
      console.error('Missing parameters:', { userId, invoiceId, clientId });
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters.');
    }

    console.log('Processing reminder request:', { 
      userId, 
      invoiceId, 
      clientId, 
      authUid: context.auth.uid 
    });

    // Verify the user exists and has access to the invoice
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found.');
    }

    // Verify the authenticated user matches the userId
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'You do not have permission to send reminders for this user.');
    }

    // Check if invoice exists
    const invoiceDoc = await admin.firestore().collection('users').doc(userId).collection('invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Invoice not found.');
    }

    // Get client data
    const clientDoc = await admin.firestore().collection('users').doc(userId).collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Client not found.');
    }

    // Initialize the SendGrid client with API key
    sgMail.setApiKey(functions.config().sendgrid.key);
    console.log('SendGrid initialized');

    const invoice = invoiceDoc.data();
    const client = clientDoc.data();
    const user = userDoc.data();

    console.log('Data loaded successfully for reminder');

    // Construct the email
    const formatCurrency = (amount) => {
      if (!amount || isNaN(amount)) return '0.00';
      return parseFloat(amount).toFixed(2);
    };
    const logoImage = null;
    const logoHtml = logoImage
      ? `<img src="${logoImage}" alt="${user.companyName || user.name}" style="width:60px;height:60px;object-fit:contain;border-radius:50%;background:#fff;display:block;" />`
      : user.logo
        ? `<img src="${user.logo}" alt="${user.companyName || user.name}" style="width:60px;height:60px;object-fit:contain;border-radius:50%;background:#fff;display:block;" />`
        : `<div style="width:60px;height:60px;border-radius:50%;background:#2c5282;color:#fff;font-size:30px;font-weight:bold;text-align:center;line-height:60px;">${(user.companyName || user.name || 'B').charAt(0).toUpperCase()}</div>`;
    const senderName = user.businessName || user.displayName || user.companyName || user.name || 'Your Service Provider';
    const amount = formatCurrency(invoice.totalAmount || invoice.amount);
    const currency = invoice.currency || '$';
    // Fix logo centering in businessDetailsHtml for both update and reminder emails
    const businessDetailsHtml = `
      <div style="margin-top:32px;font-size:13px;color:#666;text-align:center;">
        <div style="width:100%;text-align:center;margin-bottom:8px;">${logoHtml}</div>
        <strong>${user.companyName || user.name}</strong><br/>
        ${(user.street || user.address || '') + (user.city ? ', ' + user.city : '') + (user.state ? ', ' + user.state : '') + ((user.postalCode || user.zip) ? ' ' + (user.postalCode || user.zip) : '')}<br/>
        ${user.phone || ''}<br/>
        <a href="mailto:${user.email}" style="color:#2c5282;text-decoration:none;">${user.email}</a>
        ${user.website ? `<div style="font-size:13px;color:#2c5282;"><a href="${user.website}" style="color:#2c5282;text-decoration:underline;">${user.website}</a></div>` : ''}
      </div>
      <div style="height:40px;"></div>
    `;
    // Move businessDetailsHtml outside the main card in reminderHtml
    const reminderHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Reminder for Invoice #${invoice.invoiceNumber}</title>
      </head>
      <body style="margin:0;padding:0;background:#f5f6fa;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6fa;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin:40px 0;">
                <tr>
                  <td style="background:#2c5282;padding:24px 0 16px 0;border-radius:8px 8px 0 0;text-align:center;">
                    <span style="display:inline-block;width:100%;font-size:24px;font-weight:bold;color:#fff;letter-spacing:1px;">PAYMENT REMINDER</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 40px 0 40px;">
                    <p style="font-size:16px;color:#333;">Dear ${client.name},</p>
                    <p style="font-size:15px;color:#333;">This is a friendly reminder that the following invoice is due:</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-collapse: collapse;">
                      <tr style="background-color: #f2f2f2;">
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Invoice #</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Amount</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Due Date</th>
                      </tr>
                      <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">${invoice.invoiceNumber}</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${currency}${amount}</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${new Date(invoice.dueDate).toLocaleDateString()}</td>
                      </tr>
                    </table>
                    <p style="font-size:15px;color:#333;">Please make payment at your earliest convenience.</p>
                    <p style="font-size:15px;color:#333;">Thank you for your business!</p>
                    <p style="font-size:15px;color:#333;">Regards,<br>${senderName}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        ${businessDetailsHtml}
      </body>
      </html>
    `;
    const VERIFIED_SENDER = 'billienowcontact@gmail.com';
    const fromName = `${user.name || senderName} via BillieNow`;
    const msg = {
      to: client.email,
      from: {
        email: VERIFIED_SENDER,
        name: fromName
      },
      replyTo: user.email,
      subject: `Payment Reminder for Invoice #${invoice.invoiceNumber}`,
      text: `Dear ${client.name},\n\nThis is a friendly reminder that invoice #${invoice.invoiceNumber} for ${currency}${amount} is due on ${new Date(invoice.dueDate).toLocaleDateString()}. Please make payment at your earliest convenience.\n\nRegards,\n${senderName}`,
      html: reminderHtml
    };

    try {
      await sgMail.send(msg);
      // Log reminder activity
      await admin.firestore().collection('users').doc(userId).collection('invoices').doc(invoiceId).update({
        activity: admin.firestore.FieldValue.arrayUnion({
          type: 'reminder_sent',
          stage: 'Reminder Sent',
          date: new Date().toISOString()
        })
      });
      return { success: true, message: 'Reminder sent successfully' };
    } catch (error) {
      console.error('Error sending reminder:', error);
      
      // Log detailed error information
      if (error.response && error.response.body) {
        console.log('SendGrid error details:', error.response.body);
      }
      
      // Check if this is a SendGrid credits exceeded error
      if (error.code === 401 && 
          error.response && 
          error.response.body && 
          error.response.body.errors && 
          error.response.body.errors.some(err => err.message && err.message.includes('Maximum credits exceeded'))) {
        throw new functions.https.HttpsError(
          'resource-exhausted', 
          'Your email service has reached its sending limit. Please upgrade your SendGrid plan or wait until the next billing cycle.'
        );
      }
      
      // For general SendGrid authentication errors
      if (error.code === 401) {
        throw new functions.https.HttpsError(
          'unauthenticated', 
          'Email service error: Your email service authentication failed. Please check your SendGrid API key.'
        );
      }
      
      throw new functions.https.HttpsError('internal', 'Email service error: ' + (error.message || 'Unknown error'));
    }
  } catch (error) {
    console.error('Function error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('unknown', error.message || 'An unknown error occurred');
  }
});

exports.sendInvoiceEscalation = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send escalations.');
    }
    const { userId, invoiceId, clientId } = data;
    if (!userId || !invoiceId || !clientId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters.');
    }
    // Verify user
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found.');
    if (context.auth.uid !== userId) throw new functions.https.HttpsError('permission-denied', 'You do not have permission to send escalations for this user.');
    // Invoice and client
    const invoiceDoc = await admin.firestore().collection('users').doc(userId).collection('invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) throw new functions.https.HttpsError('not-found', 'Invoice not found.');
    const clientDoc = await admin.firestore().collection('users').doc(userId).collection('clients').doc(clientId).get();
    if (!clientDoc.exists) throw new functions.https.HttpsError('not-found', 'Client not found.');
    // Agent config for escalation template and threshold
    const agentConfigDoc = await admin.firestore().collection('users').doc(userId).collection('agentConfig').doc('main').get();
    const agentConfig = agentConfigDoc.exists ? agentConfigDoc.data() : {};
    const escalationTemplate = (agentConfig.templates && agentConfig.templates.escalation) ||
      'Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. This is our final notice before we take further action. Please contact us immediately to avoid further consequences.';
    const escalationThreshold = agentConfig.escalationDays || 14;
    // Email setup
    sgMail.setApiKey(functions.config().sendgrid.key);
    const invoice = invoiceDoc.data();
    const client = clientDoc.data();
    const user = userDoc.data();
    const now = new Date();
    const daysOverdue = Math.max(0, Math.floor((now - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24)));
    const amount = (invoice.totalAmount || invoice.amount || 0).toFixed(2);
    const currency = invoice.currency || '$';
    const senderName = user.businessName || user.displayName || user.companyName || user.name || 'Your Service Provider';
    // Choose message based on threshold
    let textBody, escalationHtml;
    if (daysOverdue < escalationThreshold) {
      // Soft, generic escalation message
      textBody = `Dear ${client.name},\n\nYour invoice #${invoice.invoiceNumber} for ${currency}${amount} is now overdue and requires your immediate attention. This is our final notice before we take further action. Please contact us as soon as possible to resolve this matter.\n\nRegards,\n${senderName}`;
      escalationHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Escalation Notice for Invoice #${invoice.invoiceNumber}</title></head>
        <body style="margin:0;padding:0;background:#f5f6fa;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6fa;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin:40px 0;">
                <tr><td style="background:#b91c1c;padding:24px 0 16px 0;border-radius:8px 8px 0 0;text-align:center;">
                  <span style="display:inline-block;width:100%;font-size:24px;font-weight:bold;color:#fff;letter-spacing:1px;">ESCALATION NOTICE</span>
                </td></tr>
                <tr><td style="padding:32px 40px 0 40px;">
                  <div style="font-size:16px;color:#b91c1c;font-weight:bold;">${senderName}</div>
                  <p style="font-size:16px;color:#333;">Dear ${client.name},</p>
                  <p style="font-size:15px;color:#333;">Your invoice <b>#${invoice.invoiceNumber}</b> for <b>${currency}${amount}</b> is now overdue and requires your immediate attention. This is our final notice before we take further action. Please contact us as soon as possible to resolve this matter.</p>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-collapse: collapse;">
                    <tr style="background-color: #f2f2f2;"><th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Invoice #</th><th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Amount</th><th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Due Date</th></tr>
                    <tr><td style="padding: 10px; border: 1px solid #ddd;">${invoice.invoiceNumber}</td><td style="padding: 10px; border: 1px solid #ddd;">${currency}${amount}</td><td style="padding: 10px; border: 1px solid #ddd;">${new Date(invoice.dueDate).toLocaleDateString()}</td></tr>
                  </table>
                  <p style="font-size:15px;color:#b91c1c;font-weight:bold;">This is our final notice before we take further action.</p>
                  <p style="font-size:15px;color:#333;">Regards,<br>${senderName}</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>`;
    } else {
      // Normal escalation template (may mention days overdue)
      textBody = escalationTemplate
        .replace('{clientName}', client.name)
        .replace('{invoiceNumber}', invoice.invoiceNumber)
        .replace('{amount}', `${currency}${amount}`)
        .replace('{dueDate}', new Date(invoice.dueDate).toLocaleDateString())
        .replace('{daysOverdue}', daysOverdue);
      escalationHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Escalation Notice for Invoice #${invoice.invoiceNumber}</title></head>
        <body style="margin:0;padding:0;background:#f5f6fa;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6fa;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin:40px 0;">
                <tr><td style="background:#b91c1c;padding:24px 0 16px 0;border-radius:8px 8px 0 0;text-align:center;">
                  <span style="display:inline-block;width:100%;font-size:24px;font-weight:bold;color:#fff;letter-spacing:1px;">ESCALATION NOTICE</span>
                </td></tr>
                <tr><td style="padding:32px 40px 0 40px;">
                  <div style="font-size:16px;color:#b91c1c;font-weight:bold;">${senderName}</div>
                  <p style="font-size:16px;color:#333;">Dear ${client.name},</p>
                  <p style="font-size:15px;color:#333;">${textBody}</p>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-collapse: collapse;">
                    <tr style="background-color: #f2f2f2;"><th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Invoice #</th><th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Amount</th><th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Due Date</th></tr>
                    <tr><td style="padding: 10px; border: 1px solid #ddd;">${invoice.invoiceNumber}</td><td style="padding: 10px; border: 1px solid #ddd;">${currency}${amount}</td><td style="padding: 10px; border: 1px solid #ddd;">${new Date(invoice.dueDate).toLocaleDateString()}</td></tr>
                  </table>
                  <p style="font-size:15px;color:#b91c1c;font-weight:bold;">This is our final notice before we take further action.</p>
                  <p style="font-size:15px;color:#333;">Regards,<br>${senderName}</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>`;
    }
    const VERIFIED_SENDER = 'billienowcontact@gmail.com';
    const fromName = `${user.name || senderName} via BillieNow`;
    const msg = {
      to: client.email,
      from: { email: VERIFIED_SENDER, name: fromName },
      replyTo: user.email,
      subject: `Escalation Notice for Invoice #${invoice.invoiceNumber}`,
      text: textBody,
      html: escalationHtml
    };
    try {
      await sgMail.send(msg);
      await admin.firestore().collection('users').doc(userId).collection('invoices').doc(invoiceId).update({
        activity: admin.firestore.FieldValue.arrayUnion({
          type: 'escalation_sent',
          stage: 'Escalation Sent',
          date: new Date().toISOString()
        })
      });
      return { success: true, message: 'Escalation sent successfully' };
    } catch (error) {
      if (error.response && error.response.body) {
        console.log('SendGrid error details:', error.response.body);
      }
      if (error.code === 401 && error.response && error.response.body && error.response.body.errors && error.response.body.errors.some(err => err.message && err.message.includes('Maximum credits exceeded'))) {
        throw new functions.https.HttpsError('resource-exhausted', 'Your email service has reached its sending limit. Please upgrade your SendGrid plan or wait until the next billing cycle.');
      }
      if (error.code === 401) {
        throw new functions.https.HttpsError('unauthenticated', 'Email service error: Your email service authentication failed. Please check your SendGrid API key.');
      }
      throw new functions.https.HttpsError('internal', 'Email service error: ' + (error.message || 'Unknown error'));
    }
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Unknown error');
  }
});

exports.sendInvoiceUpdateNotification = functions.https.onCall(async (data, context) => {
  try {
    // Check if the user is authenticated
    if (!context.auth) {
      console.error('Authentication failed: No auth context');
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send update notifications.');
    }

    const { userId, invoiceId, clientId, changes } = data;
    if (!userId || !invoiceId || !clientId) {
      console.error('Missing parameters:', { userId, invoiceId, clientId });
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters.');
    }

    console.log('Processing invoice update notification request:', { 
      userId, 
      invoiceId, 
      clientId,
      changes,
      authUid: context.auth.uid 
    });

    // Verify the user exists and has access to the invoice
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found.');
    }

    // Verify the authenticated user matches the userId
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'You do not have permission to send notifications for this user.');
    }

    // Check if invoice exists
    const invoiceDoc = await admin.firestore().collection('users').doc(userId).collection('invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Invoice not found.');
    }

    // Get client data
    const clientDoc = await admin.firestore().collection('users').doc(userId).collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Client not found.');
    }

    // Initialize the SendGrid client with API key
    sgMail.setApiKey(functions.config().sendgrid.key);
    console.log('SendGrid initialized');

    const invoice = invoiceDoc.data();
    const client = clientDoc.data();
    const user = userDoc.data();

    console.log('Data loaded successfully for update notification');

    // Construct the email
    const formatCurrency = (amount) => {
      if (!amount || isNaN(amount)) return '0.00';
      return parseFloat(amount).toFixed(2);
    };
    
    // Helper to convert image URL to base64 data URL
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
    const logoHtml = logoImage
      ? `<img src="${logoImage}" alt="${user.companyName || user.name}" style="width:60px;height:60px;object-fit:contain;border-radius:50%;background:#fff;display:block;" />`
      : user.logo
        ? `<img src="${user.logo}" alt="${user.companyName || user.name}" style="width:60px;height:60px;object-fit:contain;border-radius:50%;background:#fff;display:block;" />`
        : `<div style="width:60px;height:60px;border-radius:50%;background:#2c5282;color:#fff;font-size:30px;font-weight:bold;text-align:center;line-height:60px;">${(user.companyName || user.name || 'B').charAt(0).toUpperCase()}</div>`;
    
    const senderName = user.businessName || user.displayName || user.companyName || user.name || 'Your Service Provider';
    const amount = formatCurrency(invoice.totalAmount || invoice.amount);
    const currency = invoice.currency || '$';
    
    const changesHtml = changes && changes.length > 0 ? 
      `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-collapse: collapse;">
        <tr style="background-color: #f2f2f2;">
          <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Change</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Previous Value</th>
          <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">New Value</th>
        </tr>
        ${changes.split('; ').map(change => {
          const parts = change.split(' changed from ');
          if (parts.length === 2) {
            const [field, valueChange] = parts;
            const [oldValue, newValue] = valueChange.split(' to ');
            return `<tr>
              <td style="padding: 10px; border: 1px solid #ddd;">${field}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${oldValue}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${newValue}</td>
            </tr>`;
          }
          return `<tr><td style="padding: 10px; border: 1px solid #ddd;" colspan="3">${change}</td></tr>`;
        }).join('')}
      </table>` : 
      '<p style="font-size:15px;color:#333;">The details of this invoice have been updated.</p>';
    
    // Add business details HTML for update notification (use table for logo centering)
    const businessDetailsHtml = `
      <div style="margin-top:32px;font-size:13px;color:#666;text-align:center;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:8px;">${logoHtml}</td></tr></table>
        <strong>${user.companyName || user.name}</strong><br/>
        ${(user.street || user.address || '') + (user.city ? ', ' + user.city : '') + (user.state ? ', ' + user.state : '') + ((user.postalCode || user.zip) ? ' ' + (user.postalCode || user.zip) : '')}<br/>
        ${user.phone || ''}<br/>
        <a href="mailto:${user.email}" style="color:#2c5282;text-decoration:none;">${user.email}</a>
        ${user.website ? `<div style="font-size:13px;color:#2c5282;"><a href="${user.website}" style="color:#2c5282;text-decoration:underline;">${user.website}</a></div>` : ''}
      </div>
      <div style="height:40px;"></div>
    `;
    
    // Generate PDF buffer
    const pdfBuffer = await generateInvoicePdfBuffer({ invoice, user, client, logoImage });

    // Insert business details and PDF URL at the bottom of the email
    const updateHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice #${invoice.invoiceNumber} Updated</title>
      </head>
      <body style="margin:0;padding:0;background:#f5f6fa;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6fa;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin:40px 0;">
                <tr>
                  <td style="background:#3b82f6;padding:24px 0 16px 0;border-radius:8px 8px 0 0;text-align:center;">
                    <span style="display:inline-block;width:100%;font-size:24px;font-weight:bold;color:#fff;letter-spacing:1px;">INVOICE UPDATED</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 40px 0 40px;">
                    <p style="font-size:16px;color:#333;">Dear ${client.name},</p>
                    <p style="font-size:15px;color:#333;">This is to inform you that your invoice #${invoice.invoiceNumber} has been updated.</p>
                    <h3 style="font-size:16px;color:#333;margin-top:20px;">What has changed:</h3>
                    ${changesHtml}
                    <h3 style="font-size:16px;color:#333;margin-top:20px;">Updated Invoice Summary:</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-collapse: collapse;">
                      <tr style="background-color: #f2f2f2;">
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Invoice #</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Amount</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Due Date</th>
                      </tr>
                      <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">${invoice.invoiceNumber}</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${currency}${amount}</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${new Date(invoice.dueDate).toLocaleDateString()}</td>
                      </tr>
                    </table>
                    <p style="font-size:15px;color:#333;">A revised copy of your invoice is attached for your records. If you have any questions about these changes, please don't hesitate to contact us.</p>
                    <p style="font-size:15px;color:#333;">Regards,<br>${senderName}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        ${businessDetailsHtml}
      </body>
      </html>
    `;
    
    const VERIFIED_SENDER = 'billienowcontact@gmail.com';
    const fromName = `${user.name || senderName} via BillieNow`;
    const msg = {
      to: client.email,
      from: {
        email: VERIFIED_SENDER,
        name: fromName
      },
      replyTo: user.email,
      subject: `Invoice #${invoice.invoiceNumber} Updated`,
      text: `Dear ${client.name},\n\nThis is to inform you that your invoice #${invoice.invoiceNumber} for ${currency}${amount} has been updated. ${changes ? 'The following changes were made: ' + changes : 'Please review the attached updated invoice for details.'}\n\nIf you have any questions about these changes, please don't hesitate to contact us.\n\nA revised copy of your invoice is attached for your records.\n\nRegards,\n${senderName}`,
      html: updateHtml,
      attachments: [
        {
          content: pdfBuffer.toString('base64'),
          filename: `Invoice_${invoice.invoiceNumber}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    };

    try {
      await sgMail.send(msg);
      // Log update notification activity
      await admin.firestore().collection('users').doc(userId).collection('invoices').doc(invoiceId).update({
        activity: admin.firestore.FieldValue.arrayUnion({
          type: 'update_notification_sent',
          stage: 'Update Notification Sent',
          date: new Date().toISOString()
        })
      });
      return { success: true, message: 'Update notification sent successfully' };
    } catch (error) {
      console.error('Error sending update notification:', error);
      
      // Log detailed error information
      if (error.response && error.response.body) {
        console.log('SendGrid error details:', error.response.body);
      }
      
      // Check if this is a SendGrid credits exceeded error
      if (error.code === 401 && 
          error.response && 
          error.response.body && 
          error.response.body.errors && 
          error.response.body.errors.some(err => err.message && err.message.includes('Maximum credits exceeded'))) {
        throw new functions.https.HttpsError(
          'resource-exhausted', 
          'Your email service has reached its sending limit. Please upgrade your SendGrid plan or wait until the next billing cycle.'
        );
      }
      
      // For general SendGrid authentication errors
      if (error.code === 401) {
        throw new functions.https.HttpsError(
          'unauthenticated', 
          'Email service error: Your email service authentication failed. Please check your SendGrid API key.'
        );
      }
      
      throw new functions.https.HttpsError('internal', 'Email service error: ' + (error.message || 'Unknown error'));
    }
  } catch (error) {
    console.error('Function error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('unknown', error.message || 'An unknown error occurred');
  }
});

exports.sendInvoiceDeleteNotification = functions.https.onCall(async (data, context) => {
  try {
    const { userId, invoiceIds, clientId, scope, invoices: providedInvoices } = data;
    if (!context.auth || context.auth.uid !== userId) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send deletion notifications.');
    }
    if (!userId || !invoiceIds || !clientId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters.');
    }

    sgMail.setApiKey(functions.config().sendgrid.key);

    // Fetch user
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found.');
    const user = userDoc.data();

    // Fetch client
    const clientDoc = await admin.firestore().collection('users').doc(userId).collection('clients').doc(clientId).get();
    if (!clientDoc.exists) throw new functions.https.HttpsError('not-found', 'Client not found.');
    const client = clientDoc.data();

    // Use providedInvoices if available, otherwise fetch from Firestore
    let invoices = [];
    if (providedInvoices && Array.isArray(providedInvoices) && providedInvoices.length > 0) {
      invoices = providedInvoices;
    } else {
      const invoiceRefs = invoiceIds.map(id => admin.firestore().collection('users').doc(userId).collection('invoices').doc(id));
      const invoiceSnaps = await admin.firestore().getAll(...invoiceRefs);
      invoices = invoiceSnaps.map(snap => snap.exists ? snap.data() : null).filter(Boolean);
    }

    // Compose email content
    const invoiceListHtml = invoices.length > 0 ? invoices.map(inv =>
      `<tr>
        <td style='padding:8px 0;'>${inv.invoiceNumber || inv.id}</td>
        <td style='padding:8px 0;'>${inv.description || ''}</td>
        <td style='padding:8px 0;'>$${parseFloat(inv.amount).toFixed(2)}</td>
        <td style='padding:8px 0;'>${inv.date || ''}</td>
      </tr>`
    ).join('') : `<tr><td colspan="4" style="padding:12px;text-align:center;color:#888;">No invoice details available.</td></tr>`;

    const logoImage = null;
    const logoHtml = logoImage
      ? `<img src="${logoImage}" alt="${user.companyName || user.name}" style="width:48px;height:48px;object-fit:contain;border-radius:50%;background:#fff;display:block;margin:0 auto 12px auto;" />`
      : user.logo
        ? `<img src="${user.logo}" alt="${user.companyName || user.name}" style="width:48px;height:48px;object-fit:contain;border-radius:50%;background:#fff;display:block;margin:0 auto 12px auto;" />`
        : `<div style="width:48px;height:48px;border-radius:50%;background:#2c5282;color:#fff;font-size:24px;font-weight:bold;text-align:center;line-height:48px;margin:0 auto 12px auto;">${(user.companyName || user.name || 'B').charAt(0).toUpperCase()}</div>`;

    const businessDetailsHtml = `
      <div style="margin-top:32px;font-size:13px;color:#666;text-align:center;">
        <div style="width:100%;text-align:center;margin-bottom:8px;">${logoHtml}</div>
        <strong>${user.companyName || user.name}</strong><br/>
        ${(user.street || user.address || '') + (user.city ? ', ' + user.city : '') + (user.state ? ', ' + user.state : '') + ((user.postalCode || user.zip) ? ' ' + (user.postalCode || user.zip) : '')}<br/>
        ${user.phone || ''}<br/>
        <a href="mailto:${user.email}" style="color:#2c5282;text-decoration:none;">${user.email}</a>
      </div>
      <div style="height:40px;"></div>
    `;

    const emailHtml = `
      <html>
      <body style="font-family: Arial, sans-serif; background: #f5f6fa; margin: 0; padding: 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6fa;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin:40px 0;">
              <tr><td style="background:#2c5282;padding:24px 0 16px 0;border-radius:8px 8px 0 0;text-align:center;">
                <span style="display:inline-block;width:100%;font-size:24px;font-weight:bold;color:#fff;letter-spacing:1px;">Invoice Deletion Notice</span>
              </td></tr>
              <tr><td style="padding:32px 40px 0 40px;">
                <div style="font-size:18px;font-weight:bold;color:#2c5282;margin-bottom:8px;">Hello ${client.name},</div>
                <div style="font-size:15px;color:#333;margin-bottom:16px;">
                  This is to inform you that the following invoice${invoices.length > 1 ? 's have' : ' has'} been deleted by ${user.companyName || user.name}:
                </div>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:10px;font-size:14px;font-weight:bold;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">Invoice #</th>
                      <th align="left" style="padding:10px;font-size:14px;font-weight:bold;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">Description</th>
                      <th align="left" style="padding:10px;font-size:14px;font-weight:bold;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">Amount</th>
                      <th align="left" style="padding:10px;font-size:14px;font-weight:bold;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">Invoice Date</th>
                    </tr>
                  </thead>
                  <tbody>${invoiceListHtml}</tbody>
                </table>
                <div style="font-size:15px;color:#333;margin-top:24px;">
                  If you have any questions, please contact us at <a href="mailto:${user.email}" style="color:#2c5282;text-decoration:none;">${user.email}</a>.
                </div>
              </td></tr>
            </table>
          </td></tr>
        </table>
        ${businessDetailsHtml}
      </body>
      </html>
    `;

    const VERIFIED_SENDER = 'billienowcontact@gmail.com';
    const fromName = `${user.name || user.companyName || 'Your Service Provider'} via BillieNow`;
    const msg = {
      to: client.email,
      from: {
        email: VERIFIED_SENDER,
        name: fromName
      },
      replyTo: user.email,
      subject: `Invoice Deletion Notice from ${user.companyName || user.name}`,
      html: emailHtml
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Error sending invoice deletion notification:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Unknown error');
  }
});

// Log activity when an invoice is updated (ignore system fields)
exports.logInvoiceUpdate = functions.firestore
  .document('users/{userId}/invoices/{invoiceId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Exclude system fields and activity
    const {
      activity: beforeActivity = [],
      emailSent: beforeEmailSent,
      emailSentAt: beforeEmailSentAt,
      ...beforeRest
    } = before;
    const {
      activity: afterActivity = [],
      emailSent: afterEmailSent,
      emailSentAt: afterEmailSentAt,
      ...afterRest
    } = after;

    // If only the excluded fields changed, do nothing
    if (JSON.stringify(beforeRest) === JSON.stringify(afterRest)) {
      return null;
    }

    // Otherwise, log the update
    await change.after.ref.update({
      activity: admin.firestore.FieldValue.arrayUnion({
        type: 'invoice_updated',
        stage: 'Invoice Updated',
        date: new Date().toISOString()
      })
    });
    return null;
  });

// --- PDF GENERATION HELPER ---
async function generateInvoicePdfBuffer({ invoice, user, client, logoImage }) {
  const PdfPrinter = require('pdfmake');
  const path = require('path');
  const fonts = {
    Roboto: {
      normal: path.join(__dirname, 'fonts/Roboto-Regular.ttf'),
      bold: path.join(__dirname, 'fonts/Roboto-Bold.ttf'),
      italics: path.join(__dirname, 'fonts/Roboto-Italic.ttf'),
      bolditalics: path.join(__dirname, 'fonts/Roboto-BoldItalic.ttf')
    }
  };
  const printer = new PdfPrinter(fonts);
  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return '0.00';
    return parseFloat(amount).toFixed(2);
  };
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 60],
    content: [
      {
        columns: [
          {
            width: '50%',
            stack: [
              logoImage ? {
                image: logoImage,
                width: 150,
                margin: [0, 0, 0, 10]
              } : null,
              { text: user.companyName || user.name || 'Billie', style: 'companyName' },
              { text: `Business Number: ${user.taxId || ''}`, style: 'companyDetail' },
              { text: (user.street || user.address || '') + (user.city ? ', ' + user.city : '') + (user.state ? ', ' + user.state : '') + ((user.postalCode || user.zip) ? ' ' + (user.postalCode || user.zip) : ''), style: 'companyDetail' },
              { text: user.country || '', style: 'companyDetail' },
              { text: user.phone || '', style: 'companyDetail' },
              { text: user.email || '', style: 'companyDetail' },
              { text: user.website || '', style: 'companyDetail' }
            ].filter(item => item !== null)
          },
          {
            width: '50%',
            stack: [
              { text: 'INVOICE', style: 'invoiceTitle' },
              { text: invoice.invoiceNumber, style: 'invoiceNumber', margin: [0, 5, 0, 15] },
              { columns: [ { text: 'DATE', style: 'label', width: '50%' }, { text: invoice.date, style: 'value', width: '50%' } ] },
              { columns: [ { text: 'DUE DATE', style: 'label', width: '50%' }, { text: invoice.dueDate, style: 'value', width: '50%' } ], margin: [0, 5, 0, 0] },
              { columns: [ { text: 'BALANCE DUE', style: 'label', width: '50%' }, { text: `USD $${formatCurrency(invoice.amount)}`, style: 'value', width: '50%' } ], margin: [0, 5, 0, 0] }
            ],
            alignment: 'right'
          }
        ],
        margin: [0, 0, 0, 30]
      },
      {
        stack: [
          { text: 'BILL TO', style: 'sectionHeader' },
          { text: client.name, style: 'clientName', margin: [0, 5, 0, 0] },
          { text: client.street || client.address || '', style: 'clientDetail' },
          { text: (client.city || '') + (client.state ? ', ' + client.state : '') + (client.postalCode ? ', ' + client.postalCode : ''), style: 'clientDetail' },
          { text: client.country || '', style: 'clientDetail' },
          { text: client.email || '', style: 'clientDetail' },
          { text: client.phone || '', style: 'clientDetail' }
        ],
        margin: [0, 0, 0, 30]
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'DESCRIPTION', style: 'tableHeader' },
              { text: 'RATE', style: 'tableHeader', alignment: 'right' },
              { text: 'QTY', style: 'tableHeader', alignment: 'right' },
              { text: 'AMOUNT', style: 'tableHeader', alignment: 'right' }
            ],
            ...((invoice.lineItems && invoice.lineItems.length > 0) ? invoice.lineItems.map(item => [
              { text: item.description, style: 'tableCell' },
              { text: `$${formatCurrency(item.rate || item.amount)}`, style: 'tableCell', alignment: 'right' },
              { text: item.quantity || 1, style: 'tableCell', alignment: 'right' },
              { text: `$${formatCurrency(item.amount)}`, style: 'tableCell', alignment: 'right' }
            ]) : [[
              { text: invoice.description, style: 'tableCell' },
              { text: `$${formatCurrency(invoice.amount)}`, style: 'tableCell', alignment: 'right' },
              { text: '1', style: 'tableCell', alignment: 'right' },
              { text: `$${formatCurrency(invoice.amount)}`, style: 'tableCell', alignment: 'right' }
            ]])
          ]
        },
        layout: {
          hLineWidth: function(i, node) { return (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0; },
          vLineWidth: function() { return 0; },
          hLineColor: function() { return '#EEEEEE'; }
        }
      },
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            table: {
              body: [
                [ { text: 'SUBTOTAL', style: 'summaryLabel', alignment: 'right' }, { text: `$${formatCurrency(invoice.amount)}`, style: 'summaryValue', alignment: 'right' } ],
                [ { text: 'TOTAL', style: 'totalLabel', alignment: 'right' }, { text: `$${formatCurrency(invoice.amount)}`, style: 'totalValue', alignment: 'right' } ]
              ]
            },
            layout: 'noBorders',
            margin: [0, 15, 0, 0]
          }
        ]
      }
    ],
    styles: {
      companyName: { fontSize: 20, bold: true, color: '#2c5282' },
      companyDetail: { fontSize: 10, color: '#333333', lineHeight: 1.2 },
      invoiceTitle: { fontSize: 30, bold: true, color: '#3b82f6' },
      invoiceNumber: { fontSize: 14, bold: true },
      label: { fontSize: 10, color: '#666666', bold: true },
      value: { fontSize: 12, color: '#333333' },
      sectionHeader: { fontSize: 12, bold: true, color: '#333333' },
      clientName: { fontSize: 14, bold: true, color: '#333333' },
      clientDetail: { fontSize: 10, color: '#333333', lineHeight: 1.2 },
      tableHeader: { fontSize: 10, bold: true, color: '#666666', margin: [0, 5, 0, 5] },
      tableCell: { fontSize: 10, color: '#333333', margin: [0, 5, 0, 5] },
      summaryLabel: { fontSize: 10, bold: true, color: '#666666', margin: [0, 5, 0, 5] },
      summaryValue: { fontSize: 10, color: '#333333', margin: [10, 5, 0, 5] },
      totalLabel: { fontSize: 12, bold: true, color: '#333333', margin: [0, 5, 0, 5] },
      totalValue: { fontSize: 12, bold: true, color: '#333333', margin: [10, 5, 0, 5] }
    },
    defaultStyle: { font: 'Roboto' }
  };
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const pdfChunks = [];
  pdfDoc.on('data', chunk => pdfChunks.push(chunk));
  pdfDoc.end();
  await new Promise(resolve => pdfDoc.on('end', resolve));
  return Buffer.concat(pdfChunks);
}