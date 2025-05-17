import { messagingService } from './messagingService'

class AIAgentService {
  constructor() {
    this.isRunning = false
    this.config = null
    this.reminders = new Map() // Store active reminders
  }

  async start(config) {
    this.config = config
    this.isRunning = true
    await this.processInvoices()
  }

  stop() {
    this.isRunning = false
  }

  async processInvoices() {
    while (this.isRunning) {
      try {
        // Get all pending invoices
        const pendingInvoices = await this.getPendingInvoices()
        
        for (const invoice of pendingInvoices) {
          await this.processInvoice(invoice)
        }

        // Wait for the next check (e.g., every hour)
        await new Promise(resolve => setTimeout(resolve, 3600000))
      } catch (error) {
        console.error('Error processing invoices:', error)
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 300000))
      }
    }
  }

  async getPendingInvoices() {
    // This would be replaced with actual API call to get pending invoices
    return [
      {
        id: 1,
        clientName: 'John Smith',
        email: 'john@example.com',
        phone: '555-0123',
        amount: 150,
        dueDate: '2024-03-15',
        status: 'Pending',
        lastReminder: null,
        reminderCount: 0
      }
    ]
  }

  async processInvoice(invoice) {
    const today = new Date()
    const dueDate = new Date(invoice.dueDate)
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
    const daysOverdue = Math.max(0, -daysUntilDue)

    // Check if we should send initial reminder
    if (daysUntilDue === this.config.initialReminderDays) {
      await this.sendInitialReminder(invoice)
    }
    // Check if we should send follow-up
    else if (daysOverdue > 0) {
      const daysSinceLastReminder = invoice.lastReminder
        ? Math.ceil((today - new Date(invoice.lastReminder)) / (1000 * 60 * 60 * 24))
        : Infinity

      if (daysSinceLastReminder >= this.config.followUpIntervalDays) {
        if (invoice.reminderCount < this.config.maxFollowUps) {
          await this.sendFollowUpReminder(invoice, daysOverdue)
        } else if (daysOverdue >= this.config.escalationThresholdDays) {
          await this.sendEscalationMessage(invoice, daysOverdue)
        }
      }
    }
  }

  async sendInitialReminder(invoice) {
    const message = messagingService.formatMessage(this.config.templates.initial, {
      clientName: invoice.clientName,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      invoiceNumber: invoice.id
    })

    if (this.config.useEmail) {
      await messagingService.sendEmail(
        invoice.email,
        'Invoice Reminder',
        message
      )
    }

    if (this.config.useSMS) {
      await messagingService.sendSMS(invoice.phone, message)
    }

    // Update invoice reminder status
    await this.updateInvoiceReminder(invoice.id, {
      lastReminder: new Date().toISOString(),
      reminderCount: 1
    })
  }

  async sendFollowUpReminder(invoice, daysOverdue) {
    const message = messagingService.formatMessage(this.config.templates.followUp, {
      clientName: invoice.clientName,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      invoiceNumber: invoice.id,
      daysOverdue
    })

    if (this.config.useEmail) {
      await messagingService.sendEmail(
        invoice.email,
        'Invoice Follow-up',
        message
      )
    }

    if (this.config.useSMS) {
      await messagingService.sendSMS(invoice.phone, message)
    }

    // Update invoice reminder status
    await this.updateInvoiceReminder(invoice.id, {
      lastReminder: new Date().toISOString(),
      reminderCount: invoice.reminderCount + 1
    })
  }

  async sendEscalationMessage(invoice, daysOverdue) {
    const message = messagingService.formatMessage(this.config.templates.escalation, {
      clientName: invoice.clientName,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      invoiceNumber: invoice.id,
      daysOverdue
    })

    if (this.config.useEmail) {
      await messagingService.sendEmail(
        invoice.email,
        'Urgent: Invoice Overdue',
        message
      )
    }

    if (this.config.useSMS) {
      await messagingService.sendSMS(invoice.phone, message)
    }

    // Update invoice reminder status
    await this.updateInvoiceReminder(invoice.id, {
      lastReminder: new Date().toISOString(),
      reminderCount: invoice.reminderCount + 1,
      escalated: true
    })
  }

  async updateInvoiceReminder(invoiceId, update) {
    // This would be replaced with actual API call to update invoice
    console.log('Updating invoice reminder:', { invoiceId, update })
  }
}

export const aiAgentService = new AIAgentService() 