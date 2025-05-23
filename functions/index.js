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

      console.log('Data loaded successfully for reminder');

      // Define all variables needed for the email template
      const senderName = user.businessName || user.displayName || user.companyName || user.name || 'Your Service Provider';
      const amount = formatCurrency(invoice.totalAmount || invoice.amount);
      const currency = invoice.currency || '$';
      
      // Define format currency helper
      function formatCurrency(amount) {
        if (!amount || isNaN(amount)) return '0.00';
        return parseFloat(amount).toFixed(2);
      }
      
      // Add business details HTML for footer
      const businessDetailsHtml = `
        <div style="margin-top:32px;font-size:13px;color:#666;text-align:center;">
          ${user.logo ? `<img src="${user.logo}" alt="${user.companyName || user.name}" style="width:48px;height:48px;object-fit:contain;border-radius:50%;background:#fff;display:block;margin:0 auto 12px auto;" />` : `<div style="width:48px;height:48px;border-radius:50%;background:#2c5282;color:#fff;font-size:24px;font-weight:bold;text-align:center;line-height:48px;margin:0 auto 12px auto;">${(user.companyName || user.name || 'B').charAt(0).toUpperCase()}</div>`}
          <strong>${user.companyName || user.name}</strong><br/>
          ${(user.street || user.address || '') + (user.city ? ', ' + user.city : '') + (user.state ? ', ' + user.state : '') + ((user.postalCode || user.zip) ? ' ' + (user.postalCode || user.zip) : '')}<br/>
          ${user.phone || ''}<br/>
          <a href="mailto:${user.email}" style="color:#2c5282;text-decoration:none;">${user.email}</a>
        </div>
        <div style="height:40px;"></div>
      `;
      
      const reminderHtml = `
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
                        ${(client.street || client.address || '4125 Ponce de Leon') +
                          (user.city ? ', ' + user.city : ', Coral Gables') +
                          (user.state ? ', ' + user.state : ', Florida') +
                          ((user.postalCode || user.zip) ? ' ' + (user.postalCode || user.zip) : ' 33146')}
                        <br>
                        ${user.country || 'United States'}<br>
                        ${user.phone || '+13129530404'}<br>
                        ${user.email || 'ignacio+72@gmail.com'}<br>
                        ${user.website || 'https://billienow.com/profile'}
                      </div>
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
        subject: `Invoice #${invoice.invoiceNumber}`,
        text: `Dear ${client.name},\n\nPlease find attached your invoice #${invoice.invoiceNumber} for ${currency}${amount}. The invoice is due on ${new Date(invoice.dueDate).toLocaleDateString()}.\n\nRegards,\n${senderName}`,
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

    try {
      await sgMail.send(msg);
        // Log update notification activity
      await admin.firestore().collection('users').doc(userId).collection('invoices').doc(invoiceId).update({
        activity: admin.firestore.FieldValue.arrayUnion({
          type: 'reminder_sent',
          stage: 'Reminder Sent',
          date: new Date().toISOString()
        })
      });
        return { success: true, message: 'Invoice reminder sent successfully' };
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

    const logoHtml = user.logo
      ? `<img src="${user.logo}" alt="${user.companyName || user.name}" style="width:48px;height:48px;object-fit:contain;border-radius:50%;background:#fff;display:block;margin:0 auto 12px auto;" />`
      : `<div style="width:48px;height:48px;border-radius:50%;background:#2c5282;color:#fff;font-size:24px;font-weight:bold;text-align:center;line-height:48px;margin:0 auto 12px auto;">${(user.companyName || user.name || 'B').charAt(0).toUpperCase()}</div>`;

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
                <div style="margin-top:32px;font-size:13px;color:#666;text-align:center;">
                  ${logoHtml}
                  <strong>${user.companyName || user.name}</strong><br/>
                  ${(user.street || user.address || '') + (user.city ? ', ' + user.city : '') + (user.state ? ', ' + user.state : '') + ((user.postalCode || user.zip) ? ' ' + (user.postalCode || user.zip) : '')}<br/>
                  ${user.phone || ''}<br/>
                  <a href="mailto:${user.email}" style="color:#2c5282;text-decoration:none;">${user.email}</a>
                </div>
                <div style="height:40px;"></div>
              </td></tr>
            </table>
          </td></tr>
        </table>
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

// Helper to convert image URL to base64 data URL (reuse if already defined)
async function urlToBase64(url) {
  const response = await fetch(url);
  const buffer = await response.buffer();
  return 'data:image/png;base64,' + buffer.toString('base64');
}