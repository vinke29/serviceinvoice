const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

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
                            ${{
                              logoHtml: user.logo
                                ? `<img src="${user.logo}" alt="${user.companyName || user.name}" style="width:60px;height:60px;object-fit:contain;border-radius:50%;background:#fff;display:block;" />`
                                : `<div style="width:60px;height:60px;border-radius:50%;background:#2c5282;color:#fff;font-size:30px;font-weight:bold;text-align:center;line-height:60px;">
                                    ${(user.companyName || user.name || 'B').charAt(0).toUpperCase()}
                                  </div>`
                            }.logoHtml}
                          </td>
                          <td valign="top">
                            <div style="font-size:20px;font-weight:bold;color:#2c5282;">${user.companyName || user.name}</div>
                            <div style="font-size:13px;color:#333;margin-top:4px;">Business Number: ${user.taxId || ''}</div>
                            <div style="font-size:13px;color:#333;">${user.address || ''}${user.city ? ', ' + user.city : ''}${user.state ? ', ' + user.state : ''}${user.zip ? ' ' + user.zip : ''}</div>
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
                      <div style="font-size:13px;color:#333;">${client.address || ''}</div>
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
    const logoHtml = user.logo
      ? `<img src="${user.logo}" alt="${user.companyName || user.name}" style="width:60px;height:60px;object-fit:contain;border-radius:50%;background:#fff;display:block;" />`
      : `<div style="width:60px;height:60px;border-radius:50%;background:#2c5282;color:#fff;font-size:30px;font-weight:bold;text-align:center;line-height:60px;">
          ${(user.companyName || user.name || 'B').charAt(0).toUpperCase()}
        </div>`;
    const senderName = user.businessName || user.displayName || user.companyName || user.name || 'Your Service Provider';
    const amount = formatCurrency(invoice.totalAmount || invoice.amount);
    const currency = invoice.currency || '$';
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
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="top" width="60" style="padding-right:20px;">
                          ${logoHtml}
                        </td>
                        <td valign="top">
                          <div style="font-size:20px;font-weight:bold;color:#2c5282;">${senderName}</div>
                          <div style="font-size:13px;color:#333;margin-top:4px;">Business Number: ${user.taxId || ''}</div>
                          <div style="font-size:13px;color:#333;">${user.address || ''}${user.city ? ', ' + user.city : ''}${user.state ? ', ' + user.state : ''}${user.zip ? ' ' + user.zip : ''}</div>
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
      </body>
      </html>
    `;
    const msg = {
      to: client.email,
      from: 'billienowcontact@gmail.com',
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