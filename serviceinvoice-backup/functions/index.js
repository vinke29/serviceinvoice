// Updated on: May 15, 2025 - 1:15pm
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

admin.initializeApp();

// Initialize SendGrid with API key
sgMail.setApiKey(functions.config().sendgrid.key);

// Fixed verified sender email address
const VERIFIED_SENDER_EMAIL = 'billienowcontact@gmail.com'; // New dedicated sender email
const APP_NAME = 'BillieNow'; // Your app/service name

// Auto-create user document when a new user signs up
exports.createUserDocument = functions.auth.user().onCreate(async (user) => {
  try {
    const { uid, email, displayName } = user;
    
    // Create a user document with default fields
    const userData = {
      name: displayName || email.split('@')[0] || 'New User',
      email: email,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    console.log(`Creating new user document for ${uid}:`, userData);
    
    // Add the user document
    await admin.firestore().collection('users').doc(uid).set(userData);
    
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
      const invoice = snap.data();
      const { userId, invoiceId } = context.params;

      console.log('Processing invoice:', invoiceId, 'for user:', userId);
      console.log('Invoice data:', JSON.stringify(invoice));

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
      console.log('Client data:', JSON.stringify(client));

      // Get the user's data for the "from" email
      let userDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .get();

      // If user document doesn't exist, try to create it from Firebase Auth
      if (!userDoc.exists) {
        console.log('User document not found, trying to create it from Auth data...');
        try {
          const userRecord = await admin.auth().getUser(userId);
          
          // Create a user document with auth data
          const userData = {
            name: userRecord.displayName || userRecord.email.split('@')[0] || 'Your Service Provider',
            email: userRecord.email,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          await admin.firestore().collection('users').doc(userId).set(userData);
          console.log('Created user document from Auth data:', userId);
          
          // Get the newly created user document
          userDoc = await admin.firestore().collection('users').doc(userId).get();
        } catch (authError) {
          console.error('Error getting/creating user from Auth:', authError);
          return null;
        }
      }

      if (!userDoc.exists) {
        console.error('User not found and could not be created:', userId);
        return null;
      }

      const user = userDoc.data();
      console.log('User data:', JSON.stringify(user));
      
      // Handle address components
      const addressLine = user.address ? `${user.address}${user.city ? `, ${user.city}` : ''}${user.state ? `, ${user.state}` : ''}${user.zip ? ` ${user.zip}` : ''}` : '';
      
      // Format image URL and handling
      let logoHtml = '';
      if (user.logo) {
        // Use img tag for logo URL
        logoHtml = `<img src="${user.logo}" alt="${user.companyName || user.name}" style="max-width: 150px; max-height: 60px; display: block; margin-bottom: 15px;">`;
      } else {
        // If no logo, use company initial as fallback
        const initial = (user.companyName || user.name || 'B').charAt(0).toUpperCase();
        logoHtml = `<div style="width: 60px; height: 60px; border-radius: 50%; background-color: #2c5282; color: white; font-size: 30px; font-weight: bold; text-align: center; line-height: 60px; margin-bottom: 15px;">${initial}</div>`;
      }

      const emailHtml = `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Invoice ${invoice.invoiceNumber || ''}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; background-color: #f7f7f7;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7f7f7;">
            <tr>
              <td align="center" style="padding: 20px 0;">
                <!-- Main Container -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                  <!-- Header Section with Logo and Title -->
                  <tr>
                    <td style="padding: 0;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="background-color: #2c5282; padding: 20px 30px; border-radius: 6px 6px 0 0; color: white;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="padding: 0;">
                                  <h1 style="margin: 0; font-size: 24px; font-weight: bold;">INVOICE #${invoice.invoiceNumber}</h1>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Business Info Section -->
                  <tr>
                    <td style="padding: 30px 30px 20px 30px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="vertical-align: top;">
                            ${logoHtml}
                            <h2 style="margin: 0 0 5px 0; font-size: 20px; color: #2c5282;">${user.companyName || user.name || 'Your Business'}</h2>
                            ${user.taxId ? `<p style="margin: 0 0 3px 0; font-size: 13px; color: #666;">Business Number: ${user.taxId}</p>` : ''}
                            ${addressLine ? `<p style="margin: 0 0 3px 0; font-size: 13px; color: #666;">${addressLine}</p>` : ''}
                            ${user.phone ? `<p style="margin: 0 0 3px 0; font-size: 13px; color: #666;">${user.phone}</p>` : ''}
                            ${user.email ? `<p style="margin: 0 0 3px 0; font-size: 13px; color: #666;">${user.email}</p>` : ''}
                            ${user.website ? `<p style="margin: 0 0 3px 0; font-size: 13px; color: #666;">${user.website}</p>` : ''}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Invoice Details Section -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 4px;">
                        <tr>
                          <td style="padding: 15px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td width="33%" style="vertical-align: top; padding-right: 10px;">
                                  <p style="margin: 0 0 5px 0; font-size: 13px; color: #666;">Date:</p>
                                  <p style="margin: 0; font-size: 14px; font-weight: bold;">${invoice.date}</p>
                                </td>
                                <td width="33%" style="vertical-align: top; padding-right: 10px;">
                                  <p style="margin: 0 0 5px 0; font-size: 13px; color: #666;">Due Date:</p>
                                  <p style="margin: 0; font-size: 14px; font-weight: bold;">${invoice.dueDate}</p>
                                </td>
                                <td width="33%" style="vertical-align: top;">
                                  <p style="margin: 0 0 5px 0; font-size: 13px; color: #666;">Invoice #:</p>
                                  <p style="margin: 0; font-size: 14px; font-weight: bold;">${invoice.invoiceNumber}</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Bill To Section -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 4px;">
                        <tr>
                          <td style="padding: 15px;">
                            <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #2c5282;">BILL TO:</p>
                            <p style="margin: 0 0 3px 0; font-size: 14px;">${client.name}</p>
                            ${client.address ? `<p style="margin: 0 0 3px 0; font-size: 14px;">${client.address}</p>` : ''}
                            ${client.email ? `<p style="margin: 0 0 3px 0; font-size: 14px;">${client.email}</p>` : ''}
                            ${client.phone ? `<p style="margin: 0 0 3px 0; font-size: 14px;">${client.phone}</p>` : ''}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Invoice Items Table -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                        <tr>
                          <th style="text-align: left; padding: 10px; font-size: 14px; font-weight: bold; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">Description</th>
                          <th style="text-align: right; padding: 10px; font-size: 14px; font-weight: bold; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">Amount</th>
                        </tr>
                        <tr>
                          <td style="text-align: left; padding: 10px; font-size: 14px; border-bottom: 1px solid #e2e8f0;">${invoice.description}</td>
                          <td style="text-align: right; padding: 10px; font-size: 14px; border-bottom: 1px solid #e2e8f0;">$${invoice.amount}</td>
                        </tr>
                        <tr>
                          <td style="text-align: right; padding: 10px; font-size: 14px; font-weight: bold; background-color: #f8fafc;">Total:</td>
                          <td style="text-align: right; padding: 10px; font-size: 14px; font-weight: bold; background-color: #f8fafc;">$${invoice.amount}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Payment Instructions -->
                  ${user.paymentInstructions ? 
                    `<tr>
                      <td style="padding: 0 30px 20px 30px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #e6f7ff; border-left: 4px solid #2c5282; border-radius: 4px;">
                          <tr>
                            <td style="padding: 15px;">
                              <p style="margin: 0; font-size: 14px; color: #2c5282;">${user.paymentInstructions}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>` : ''}
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 30px 30px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                      <p style="margin: 0 0 5px 0; font-size: 13px; color: #666;">Thank you for your business!</p>
                      <p style="margin: 0; font-size: 13px; color: #666;">If you have any questions, please contact ${user.name} at ${user.email}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      // Construct the from name to include the user's name
      const fromName = `${user.name} via ${APP_NAME}`;
      
      const msg = {
        to: client.email,
        from: {
          email: VERIFIED_SENDER_EMAIL,
          name: fromName
        },
        replyTo: user.email,
        bcc: user.email,
        subject: `Invoice #${invoice.invoiceNumber || 'New'} from ${user.name}`,
        html: emailHtml,
      };

      console.log('Preparing to send email with message:', JSON.stringify({
        to: msg.to,
        from: msg.from,
        replyTo: msg.replyTo,
        bcc: msg.bcc,
        subject: msg.subject
      }));

      try {
        await sgMail.send(msg);
        console.log('Email sent successfully for invoice:', invoiceId);
        
        // Update the invoice to mark email as sent
        await snap.ref.update({
          emailSent: true,
          emailSentAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (sendError) {
        console.error('SendGrid error details:', JSON.stringify(sendError.response?.body || sendError, null, 2));
        throw sendError; // Re-throw to be caught by outer try/catch
      }

      return null;
    } catch (error) {
      console.error('Error sending invoice email:', error);
      return null;
    }
  }); 