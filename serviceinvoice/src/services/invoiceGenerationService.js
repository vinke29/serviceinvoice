import { addInvoice, getClientsWithInvoicesToday, updateClientAfterInvoicing, getAgentConfig, getInvoices } from '../firebaseData';
import { messagingService } from './messagingService';
import { format, addWeeks, addMonths, isToday, parseISO } from 'date-fns';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { InvoiceGenerationEvents } from '../components/InvoiceGeneratedNotification';

class InvoiceGenerationService {
  constructor() {
    this.isRunning = false;
    // this.checkInterval = 24 * 60 * 60 * 1000; // Check once per day
    // For development/testing, use a shorter interval (every 30 seconds)
    this.checkInterval = 30 * 1000; // Use 30 seconds for testing
    this.processedClientsToday = new Set(); // Track clients already processed in this session
  }

  async start() {
    this.isRunning = true;
    console.log('InvoiceGenerationService started');
    // Check immediately and then schedule next checks
    await this.checkForInvoicesToGenerate();
    this.scheduleNextCheck();
  }

  stop() {
    this.isRunning = false;
    console.log('InvoiceGenerationService stopped');
  }

  scheduleNextCheck() {
    if (!this.isRunning) return;
    
    setTimeout(async () => {
      try {
        await this.checkForInvoicesToGenerate();
      } catch (error) {
        console.error('Error checking for invoices to generate:', error);
      }
      this.scheduleNextCheck();
    }, this.checkInterval);
  }

  async checkForInvoicesToGenerate() {
    const today = format(new Date(), 'yyyy-MM-dd');
    console.log(`[TEST] Checking for clients with next invoice date = ${today}`);
    
    const user = auth.currentUser;
    if (!user) {
      console.log('[TEST] No user logged in, skipping invoice generation check');
      return;
    }
    
    // Get clients with invoices due today from Firebase
    const clientsToInvoice = await getClientsWithInvoicesToday(user.uid);
    console.log(`[TEST] Found ${clientsToInvoice.length} clients with invoices due today:`, 
      clientsToInvoice.map(c => c.name || 'unnamed').join(', '));
    
    // Get all existing invoices to check for duplicates
    const existingInvoices = await getInvoices(user.uid);
    console.log(`[TEST] Found ${existingInvoices.length} existing invoices to check for duplicates`);
    
    // Create a map of clientId -> invoices created today for quick lookup
    const todayInvoicesByClientId = new Map();
    
    // Populate the map with today's invoices
    existingInvoices.forEach(invoice => {
      try {
        const invoiceDate = parseISO(invoice.date);
        if (isToday(invoiceDate) && invoice.clientId) {
          if (!todayInvoicesByClientId.has(invoice.clientId)) {
            todayInvoicesByClientId.set(invoice.clientId, []);
          }
          todayInvoicesByClientId.get(invoice.clientId).push(invoice);
        }
      } catch (e) {
        console.error('Error parsing invoice date:', e);
      }
    });
    
    console.log(`[TEST] Found ${todayInvoicesByClientId.size} clients with invoices already created today`);
    
    // Process each client that needs an invoice today
    for (const client of clientsToInvoice) {
      // Skip if we've already processed this client in this session
      if (this.processedClientsToday.has(client.id)) {
        console.log(`[TEST] Client ${client.name} (${client.id}) was already processed in this session, skipping.`);
        continue;
      }
      
      // Check if this client already has an invoice generated today
      const clientTodayInvoices = todayInvoicesByClientId.get(client.id) || [];
      if (clientTodayInvoices.length > 0) {
        console.log(`[TEST] Client ${client.name} (${client.id}) already has ${clientTodayInvoices.length} invoice(s) for today, skipping.`);
        
        // Add to processed set to avoid future processing
        this.processedClientsToday.add(client.id);
        continue;
      }
      
      // Generate invoice for this client
      await this.generateAndSendInvoice(client);
      
      // Mark this client as processed for this session
      this.processedClientsToday.add(client.id);
      console.log(`[TEST] Added client ${client.id} to processedClientsToday set. Total: ${this.processedClientsToday.size}`);
    }
  }

  async generateAndSendInvoice(client) {
    try {
      // Skip if client is cancelled or on hold
      if (client.status === 'cancelled' || client.status === 'on_hold') {
        console.log(`Skipping invoice generation for ${client.name} - Status: ${client.status}`);
        return null;
      }

      const today = new Date();
      const invoiceDate = format(today, 'yyyy-MM-dd');
      
      // Get the agent config to use the global netDays setting if client doesn't have one
      const userId = client.userId;
      const agentConfig = await getAgentConfig(userId);
      const globalNetDays = agentConfig?.netDays ?? 7; // Default to 7 days if agent config not set
      const netDays = client.netDays ?? globalNetDays;
      
      // Generate invoice number using client ID and timestamp to ensure uniqueness
      const timestamp = Date.now();
      const invoiceNumber = `INV-${client.id.substring(0, 4)}-${timestamp.toString().substring(timestamp.toString().length - 4)}`;
      
      // Check for client.fee - if it doesn't exist, we need to look up the most recent invoice
      let amount = 0;
      let description = '';
      let billingFrequency = 'monthly';
      
      if (client.fee) {
        // Legacy clients with fee data
        amount = client.fee;
        billingFrequency = client.billingFrequency || 'monthly';
        description = `${billingFrequency.charAt(0).toUpperCase() + billingFrequency.slice(1)} service fee`;
      } else {
        // New clients without fee - look up most recent invoice
        const recentInvoices = await getInvoices(userId, { clientId: client.id });
        
        if (recentInvoices && recentInvoices.length > 0) {
          // Sort by date descending and get the most recent
          const sortedInvoices = [...recentInvoices].sort((a, b) => 
            new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
          );
          
          const mostRecent = sortedInvoices[0];
          amount = mostRecent.amount || 0;
          billingFrequency = mostRecent.billingFrequency || 'monthly';
          description = mostRecent.description || `${billingFrequency.charAt(0).toUpperCase() + billingFrequency.slice(1)} service fee`;
        } else {
          // No previous invoices and no fee - cannot generate
          console.error(`Cannot generate invoice for client ${client.name}: No fee information available`);
          return null;
        }
      }
      
      // Create invoice data
      const invoiceData = {
        clientId: client.id,
        clientName: client.name,
        invoiceNumber: invoiceNumber,
        amount: amount,
        description: description,
        billingFrequency: billingFrequency,
        date: invoiceDate,
        dueDate: this.calculateDueDate(invoiceDate, netDays),
        status: 'pending',
        isRecurring: billingFrequency !== 'one-time'
      };
      
      console.log(`[TEST] Generating invoice for client ${client.name} (${client.id}) with number ${invoiceNumber}`);
      
      // Save to Firebase
      const savedInvoice = await addInvoice(userId, invoiceData);

      // If this is a recurring invoice, schedule the next one
      if (invoiceData.isRecurring) {
        await this.scheduleNextInvoice(client, invoiceData);
      }
      
      // Get user profile data for email
      let userData = {};
      if (userId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            userData = userDoc.data();
          }
        } catch (userError) {
          console.error('Error fetching user data:', userError);
        }
      }
      
      // Send invoice email with user data
      await this.sendInvoiceEmail(client, savedInvoice, userData);
      
      // Update client's nextInvoiceDate and lastInvoiced date
      await this.updateClientAfterInvoicing(client, savedInvoice);
      
      console.log(`[TEST] Successfully generated and sent invoice ${invoiceNumber} for client ${client.name}`);
      
      // Notify the UI about the new invoice
      InvoiceGenerationEvents.notify({ 
        invoice: savedInvoice, 
        client 
      });
      
      return savedInvoice;
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw error;
    }
  }
  
  calculateDueDate(invoiceDate, netDays) {
    const date = new Date(invoiceDate);
    if (netDays === 0) {
      return format(date, 'yyyy-MM-dd');
    }
    date.setDate(date.getDate() + netDays);
    return format(date, 'yyyy-MM-dd');
  }
  
  async sendInvoiceEmail(client, invoice, userData = {}) {
    const subject = `Invoice #${invoice.invoiceNumber} from ${userData.companyName || userData.name || 'Billie'}`;
    
    // Handle address components
    const addressLine = userData.address ? `${userData.address}${userData.city ? `, ${userData.city}` : ''}${userData.state ? `, ${userData.state}` : ''}${userData.zip ? ` ${userData.zip}` : ''}` : '';
    
    // Add logo image if available
    let logoImg = '';
    if (userData.logo) {
      // Add logo with max dimensions for email clients
      logoImg = `<img src="${userData.logo}" alt="${userData.companyName || 'Your Business'}" style="max-width: 150px; max-height: 80px;">`;
    }
    
    const emailBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <div style="flex: 1;">
                ${logoImg}
                <div style="margin-top: 10px;">
                  <h2 style="margin: 0; color: #333; font-size: 16px;">${userData.companyName || userData.name || 'Your Business'}</h2>
                  ${userData.taxId ? `<p style="margin: 3px 0; font-size: 12px; color: #666;">Business Number: ${userData.taxId}</p>` : ''}
                  ${addressLine ? `<p style="margin: 3px 0; font-size: 12px; color: #666;">${addressLine}</p>` : ''}
                  ${userData.phone ? `<p style="margin: 3px 0; font-size: 12px; color: #666;">${userData.phone}</p>` : ''}
                  ${userData.email ? `<p style="margin: 3px 0; font-size: 12px; color: #666;">${userData.email}</p>` : ''}
                  ${userData.website ? `<p style="margin: 3px 0; font-size: 12px; color: #666;">${userData.website}</p>` : ''}
                </div>
              </div>
              <div style="flex: 1; text-align: right;">
                <h1 style="color: #4f46e5; margin: 0;">INVOICE</h1>
              </div>
            </div>
            
            <div style="margin-bottom: 20px;">
              <p><strong>Invoice #:</strong> ${invoice.invoiceNumber}</p>
              <p><strong>Date:</strong> ${invoice.date}</p>
              <p><strong>Due Date:</strong> ${invoice.dueDate}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
              <p><strong>Bill To:</strong></p>
              <p>${client.name}</p>
              <p>${client.address || ''}</p>
              <p>${client.email || ''}</p>
              <p>${client.phone || ''}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 10px; text-align: left; border-bottom: 1px solid #eaeaea;">Description</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 1px solid #eaeaea;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #eaeaea;">${invoice.description}</td>
                  <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eaeaea;">$${invoice.amount}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td style="padding: 10px; text-align: right; font-weight: bold;">Total:</td>
                  <td style="padding: 10px; text-align: right; font-weight: bold;">$${invoice.amount}</td>
                </tr>
              </tfoot>
            </table>
            
            ${userData.paymentInstructions ? 
              `<div style="margin-top: 20px; text-align: center; color: #333; font-size: 14px; padding: 10px; background-color: #f9f9f9; border-radius: 5px;">
                <p style="margin: 5px 0">${userData.paymentInstructions}</p>
              </div>` : ''}
            
            <div style="margin-top: 30px; text-align: center; color: #6b7280; font-size: 14px;">
              <p>Thank you for your business!</p>
              <p>If you have any questions, please contact us.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    // This client-side email simulation is just for development/preview
    // Actual emails are sent by the Firebase Cloud Function 'sendInvoiceEmail'
    // when the invoice document is created in Firestore
    console.log('📧 Email would be sent by Firebase Cloud Function.');
    console.log('Client-side email simulation:');
    
    return await messagingService.sendEmail(
      client.email,
      subject,
      emailBody
    );
  }
  
  async updateClientAfterInvoicing(client, invoice = null) {
    const today = new Date();
    const lastInvoiced = format(today, 'yyyy-MM-dd');
    
    // Get billing frequency from invoice if available, or from client as fallback
    let billingFrequency;
    if (invoice && invoice.billingFrequency) {
      billingFrequency = invoice.billingFrequency;
    } else if (client.billingFrequency) {
      billingFrequency = client.billingFrequency;
    } else {
      // Look up most recent invoice for this client
      const recentInvoices = await getInvoices(client.userId, { clientId: client.id });
      if (recentInvoices && recentInvoices.length > 0) {
        const sortedInvoices = [...recentInvoices].sort((a, b) => 
          new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
        );
        const mostRecent = sortedInvoices[0];
        billingFrequency = mostRecent.billingFrequency || 'monthly';
      } else {
        billingFrequency = 'monthly'; // Default
      }
    }
    
    // If this is a one-time charge, we don't set a next invoice date
    if (billingFrequency === 'one-time') {
      return await updateClientAfterInvoicing(client.userId, client.id, {
        lastInvoiced,
        nextInvoiceDate: '' // Clear the next invoice date for one-time charges
      });
    }
    
    // Calculate next invoice date based on billing frequency
    let nextInvoiceDate;
    
    switch (billingFrequency) {
      case 'weekly':
        nextInvoiceDate = format(addWeeks(today, 1), 'yyyy-MM-dd');
        break;
      case 'monthly':
        nextInvoiceDate = format(addMonths(today, 1), 'yyyy-MM-dd');
        break;
      case 'quarterly':
        nextInvoiceDate = format(addMonths(today, 3), 'yyyy-MM-dd');
        break;
      case 'biannually':
        nextInvoiceDate = format(addMonths(today, 6), 'yyyy-MM-dd');
        break;
      case 'annually':
        nextInvoiceDate = format(addMonths(today, 12), 'yyyy-MM-dd');
        break;
      default:
        nextInvoiceDate = format(addMonths(today, 1), 'yyyy-MM-dd'); // Default to monthly
    }
    
    const updates = {
      lastInvoiced,
      nextInvoiceDate
    };
    
    return await updateClientAfterInvoicing(client.userId, client.id, updates);
  }

  // New method to schedule the next invoice
  async scheduleNextInvoice(client, currentInvoice) {
    try {
      const nextDate = this.calculateNextInvoiceDate(new Date(currentInvoice.date), currentInvoice.billingFrequency);
      if (!nextDate) return null;

      const nextInvoiceData = {
        ...currentInvoice,
        date: format(nextDate, 'yyyy-MM-dd'),
        dueDate: this.calculateDueDate(format(nextDate, 'yyyy-MM-dd'), client.netDays || 7),
        status: 'scheduled',
        invoiceNumber: `INV-SCHED-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      // Only schedule if the next date is within the next 12 months
      const twelveMonthsFromNow = addMonths(new Date(), 12);
      if (nextDate <= twelveMonthsFromNow) {
        await addInvoice(client.userId, nextInvoiceData);
      }
    } catch (error) {
      console.error('Error scheduling next invoice:', error);
    }
  }
}

export const invoiceGenerationService = new InvoiceGenerationService(); 