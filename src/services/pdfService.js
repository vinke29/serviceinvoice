import { jsPDF } from 'jspdf';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Initialize pdfMake with fonts properly
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;

// Helper to convert image URL to data URL
async function toDataURL(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

class PdfService {
  /**
   * Generates a PDF invoice that can be downloaded
   * @param {Object} invoice - The invoice data
   * @param {Object} client - The client data (optional)
   * @param {Object} agentConfig - Agent configuration (optional)
   * @returns {Promise<Blob>} PDF file as a Blob
   */
  async generateInvoicePdf(invoice, client = {}, agentConfig = {}) {
    return new Promise(async (resolve) => {
      try {
        console.log('Generating PDF with agent config:', JSON.stringify({
          ...agentConfig,
          logo: agentConfig.logo ? 'Logo exists (not showing full string)' : 'No logo'
        }, null, 2));
        
        // Format the invoice number
        const invoiceNumber = invoice.invoiceNumber || `INV-${invoice.id?.substring(0, 4).toUpperCase()}`;
        
        // Format dates
        const invoiceDate = this.formatDate(invoice.date || invoice.createdAt);
        const dueDate = this.formatDate(invoice.dueDate);
        
        // Parse line items from invoice if available
        const lineItems = invoice.lineItems || [{
          description: invoice.description || 'Service fee',
          quantity: 1,
          rate: invoice.amount,
          amount: invoice.amount
        }];
        
        // Calculate totals
        const subtotal = lineItems.reduce((total, item) => total + (parseFloat(item.amount) || 0), 0);
        const taxRate = invoice.taxRate || 0;
        const taxAmount = subtotal * (taxRate / 100) || 0;
        const total = subtotal + taxAmount;
        
        // Format currency
        const formatCurrency = (amount) => {
          return parseFloat(amount).toFixed(2);
        };

        // Process logo if available
        let logoDefinition = null;
        let logoData = agentConfig.logo;
        if (logoData && typeof logoData === 'string' && logoData.startsWith('http')) {
          try {
            logoData = await toDataURL(logoData);
          } catch (e) {
            console.warn('Failed to convert logo URL to data URL:', e);
            logoData = null;
          }
        }
        if (logoData) {
          logoDefinition = {
            image: logoData,
            width: 150,
            margin: [0, 0, 0, 10]
          };
        }
        
        // Document definition with logo
        const docDefinition = {
          pageSize: 'A4',
          pageMargins: [40, 40, 40, 60],
          content: [
            // Header with logo and company info
            {
              columns: [
                // Left column - company info with logo
                {
                  width: '50%',
                  stack: [
                    // Include logo if available
                    logoDefinition,
                    { text: agentConfig.companyName || 'BillieNow', style: 'companyName' },
                    { text: agentConfig.taxId ? `Business Number: ${agentConfig.taxId}` : '', style: 'companyDetail' },
                    { text: agentConfig.address || '', style: 'companyDetail' },
                    { text: agentConfig.phone || '', style: 'companyDetail' },
                    { text: agentConfig.email || '', style: 'companyDetail' },
                    { text: agentConfig.website || '', style: 'companyDetail' }
                  ].filter(item => item !== null) // Filter out null items (if no logo)
                },
                // Right column - invoice info
                {
                  width: '50%',
                  stack: [
                    { text: 'INVOICE', style: 'invoiceTitle' },
                    { text: invoiceNumber, style: 'invoiceNumber', margin: [0, 5, 0, 15] },
                    { 
                      columns: [
                        { text: 'DATE', style: 'label', width: '50%' },
                        { text: invoiceDate, style: 'value', width: '50%' }
                      ]
                    },
                    { 
                      columns: [
                        { text: 'DUE DATE', style: 'label', width: '50%' },
                        { text: dueDate, style: 'value', width: '50%' }
                      ],
                      margin: [0, 5, 0, 0]
                    },
                    { 
                      columns: [
                        { text: 'BALANCE DUE', style: 'label', width: '50%' },
                        { text: `USD $${formatCurrency(total)}`, style: 'value', width: '50%' }
                      ],
                      margin: [0, 5, 0, 0]
                    }
                  ],
                  alignment: 'right'
                }
              ],
              margin: [0, 0, 0, 30]
            },
            
            // Bill to section
            {
              stack: [
                { text: 'BILL TO', style: 'sectionHeader' },
                { text: client.name || invoice.clientName || '', style: 'clientName', margin: [0, 5, 0, 0] },
                { text: client.address || '', style: 'clientDetail' },
                { text: client.city && client.state ? `${client.city}, ${client.state}${client.zipCode ? ` ${client.zipCode}` : ''}` : '', style: 'clientDetail' },
                { text: client.email || '', style: 'clientDetail' },
                { text: client.phone || '', style: 'clientDetail' }
              ],
              margin: [0, 0, 0, 30]
            },
            
            // Line items table
            {
              table: {
                headerRows: 1,
                widths: taxRate > 0 ? ['*', 'auto', 'auto', 'auto', 'auto'] : ['*', 'auto', 'auto', 'auto'],
                body: [
                  // Header row
                  taxRate > 0 
                    ? [
                        { text: 'DESCRIPTION', style: 'tableHeader' }, 
                        { text: 'RATE', style: 'tableHeader', alignment: 'right' },
                        { text: 'QTY', style: 'tableHeader', alignment: 'right' },
                        { text: 'TAX', style: 'tableHeader', alignment: 'right' },
                        { text: 'AMOUNT', style: 'tableHeader', alignment: 'right' }
                      ]
                    : [
                        { text: 'DESCRIPTION', style: 'tableHeader' }, 
                        { text: 'RATE', style: 'tableHeader', alignment: 'right' },
                        { text: 'QTY', style: 'tableHeader', alignment: 'right' },
                        { text: 'AMOUNT', style: 'tableHeader', alignment: 'right' }
                      ],
                  
                  // Line items rows
                  ...lineItems.map(item => {
                    if (taxRate > 0) {
                      return [
                        { text: item.description || '', style: 'tableCell' },
                        { text: `$${formatCurrency(item.rate || item.amount)}`, style: 'tableCell', alignment: 'right' },
                        { text: item.quantity || 1, style: 'tableCell', alignment: 'right' },
                        { text: `${taxRate}%`, style: 'tableCell', alignment: 'right' },
                        { text: `$${formatCurrency(item.amount)}`, style: 'tableCell', alignment: 'right' }
                      ];
                    } else {
                      return [
                        { text: item.description || '', style: 'tableCell' },
                        { text: `$${formatCurrency(item.rate || item.amount)}`, style: 'tableCell', alignment: 'right' },
                        { text: item.quantity || 1, style: 'tableCell', alignment: 'right' },
                        { text: `$${formatCurrency(item.amount)}`, style: 'tableCell', alignment: 'right' }
                      ];
                    }
                  })
                ]
              },
              layout: {
                hLineWidth: function(i, node) {
                  return (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5;
                },
                vLineWidth: function() {
                  return 0;
                },
                hLineColor: function(i) {
                  return i === 1 ? '#666666' : '#EEEEEE';
                }
              },
              margin: [0, 0, 0, 20]
            },
            
            // Totals section
            {
              layout: 'noBorders',
              table: {
                widths: ['*', 'auto', 'auto'],
                body: [
                  [
                    {},
                    { text: 'SUBTOTAL', style: 'totalLabel', alignment: 'right' },
                    { text: `$${formatCurrency(subtotal)}`, style: 'totalValue', alignment: 'right' }
                  ],
                  taxRate > 0 ? [
                    {},
                    { text: `TAX (${taxRate}%)`, style: 'totalLabel', alignment: 'right' },
                    { text: `$${formatCurrency(taxAmount)}`, style: 'totalValue', alignment: 'right' }
                  ] : '',
                  [
                    {},
                    { text: 'TOTAL', style: 'grandTotalLabel', alignment: 'right' },
                    { text: `$${formatCurrency(total)}`, style: 'grandTotalValue', alignment: 'right' }
                  ],
                  invoice.paymentAmount ? [
                    {},
                    { text: 'PAYMENT', style: 'totalLabel', alignment: 'right' },
                    { text: `-$${formatCurrency(invoice.paymentAmount)}`, style: 'totalValue', alignment: 'right' }
                  ] : '',
                  invoice.paymentAmount ? [
                    {},
                    { text: 'BALANCE DUE', style: 'grandTotalLabel', alignment: 'right' },
                    { text: `USD $${formatCurrency(total - invoice.paymentAmount)}`, style: 'grandTotalValue', alignment: 'right' }
                  ] : ''
                ].filter(row => row !== '')
              }
            },
            
            // Payment information
            {
              stack: [
                agentConfig.paymentInstructions ? { 
                  text: agentConfig.paymentInstructions,
                  style: 'paymentInfo',
                  margin: [0, 30, 0, 0]
                } : '',
                
                agentConfig.venmoUsername ? { 
                  text: `Venmo: @${agentConfig.venmoUsername}`,
                  style: 'paymentInfo',
                  margin: [0, 10, 0, 0]
                } : '',
                
                agentConfig.lateFeePolicy ? { 
                  text: agentConfig.lateFeePolicy,
                  style: 'lateFee',
                  margin: [0, 15, 0, 0]
                } : {
                  text: agentConfig.netDays === 0
                    ? 'Payment is due immediately upon receipt.'
                    : `Payment is due within ${agentConfig.netDays || 7} days of invoice date.`,
                  style: 'lateFee',
                  margin: [0, 15, 0, 0]
                }
              ]
            },
            
            // Footer
            {
              text: 'Thank you for your business!',
              style: 'footer',
              margin: [0, 30, 0, 0]
            }
          ],
          styles: {
            companyName: {
              fontSize: 16,
              bold: true,
              color: '#333333',
              margin: [0, 0, 0, 5]
            },
            companyDetail: {
              fontSize: 9,
              color: '#666666',
              lineHeight: 1.2
            },
            invoiceTitle: {
              fontSize: 24,
              bold: true,
              color: '#4f46e5',
              alignment: 'right'
            },
            invoiceNumber: {
              fontSize: 12,
              bold: true,
              color: '#333333',
              alignment: 'right'
            },
            label: {
              fontSize: 9,
              bold: true,
              color: '#666666'
            },
            value: {
              fontSize: 10,
              color: '#333333'
            },
            sectionHeader: {
              fontSize: 12,
              bold: true,
              color: '#333333',
              margin: [0, 0, 0, 5]
            },
            clientName: {
              fontSize: 11,
              color: '#333333'
            },
            clientDetail: {
              fontSize: 9,
              color: '#666666',
              lineHeight: 1.2
            },
            tableHeader: {
              fontSize: 9,
              bold: true,
              color: '#333333',
              margin: [0, 10, 0, 10]
            },
            tableCell: {
              fontSize: 10,
              color: '#333333',
              margin: [0, 8, 0, 8]
            },
            totalLabel: {
              fontSize: 10,
              bold: false,
              color: '#666666',
              margin: [0, 5, 15, 5]
            },
            totalValue: {
              fontSize: 10,
              bold: false,
              color: '#333333',
              margin: [0, 5, 0, 5]
            },
            grandTotalLabel: {
              fontSize: 11,
              bold: true,
              color: '#333333',
              margin: [0, 5, 15, 5]
            },
            grandTotalValue: {
              fontSize: 11,
              bold: true,
              color: '#333333',
              margin: [0, 5, 0, 5]
            },
            paymentInfo: {
              fontSize: 10,
              color: '#333333',
              alignment: 'center'
            },
            lateFee: {
              fontSize: 9,
              italic: true,
              color: '#666666',
              alignment: 'center'
            },
            footer: {
              fontSize: 10,
              color: '#666666',
              alignment: 'center'
            }
          },
          defaultStyle: {
            font: 'Roboto'
          }
        };
        
        // Generate the PDF
        const pdfDoc = pdfMake.createPdf(docDefinition);
        
        // Get the blob and resolve the promise
        pdfDoc.getBlob((blob) => {
          resolve(blob);
        });
      } catch (error) {
        console.error('Error generating PDF with pdfMake:', error);
        // Fallback to direct jsPDF method if pdfMake fails
        this.generateFallbackPdf(invoice, client, agentConfig, resolve);
      }
    });
  }
  
  /**
   * Generate a fallback PDF if the pdfMake conversion fails
   * @private
   */
  generateFallbackPdf(invoice, client, agentConfig, resolve) {
    try {
      const doc = new jsPDF();
      
      // Format the invoice number
      const invoiceNumber = invoice.invoiceNumber || `INV-${invoice.id?.substring(0, 4).toUpperCase()}`;
      
      // Parse line items from invoice if available
      const lineItems = invoice.lineItems || [{
        description: invoice.description || 'Service fee',
        quantity: 1,
        rate: invoice.amount,
        amount: invoice.amount
      }];
      
      // Calculate totals
      const subtotal = lineItems.reduce((total, item) => total + (parseFloat(item.amount) || 0), 0);
      const taxRate = invoice.taxRate || 0;
      const taxAmount = subtotal * (taxRate / 100) || 0;
      const total = subtotal + taxAmount;
      
      // Add content to PDF
      doc.setFontSize(24);
      doc.setTextColor(79, 70, 229);
      doc.text('INVOICE', 150, 25, { align: 'right' });
      
      // Add logo if available
      let yOffset = 25;
      if (agentConfig.logo) {
        try {
          doc.addImage(agentConfig.logo, 'JPEG', 20, 15, 40, 20, undefined, 'FAST');
          yOffset = 45; // Move company info down if logo is added
        } catch (logoError) {
          console.error('Error adding logo to fallback PDF:', logoError);
        }
      }
      
      // Company info
      doc.setFontSize(16);
      doc.setTextColor(51, 51, 51);
      doc.text(agentConfig.companyName || 'BillieNow', 20, yOffset);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      if (agentConfig.businessNumber) {
        doc.text(`Business Number: ${agentConfig.businessNumber}`, 20, yOffset + 7);
      }
      if (agentConfig.address) {
        doc.text(agentConfig.address, 20, yOffset + 12);
      }
      if (agentConfig.phone) {
        doc.text(agentConfig.phone, 20, yOffset + 17);
      }
      if (agentConfig.email) {
        doc.text(agentConfig.email, 20, yOffset + 22);
      }
      
      // Invoice details
      doc.setFontSize(12);
      doc.setTextColor(51, 51, 51);
      doc.text(invoiceNumber, 150, 35, { align: 'right' });
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('DATE', 130, 45, { align: 'right' });
      doc.text('DUE DATE', 130, 52, { align: 'right' });
      doc.text('BALANCE DUE', 130, 59, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      doc.text(this.formatDate(invoice.date || invoice.createdAt), 150, 45, { align: 'right' });
      doc.text(this.formatDate(invoice.dueDate), 150, 52, { align: 'right' });
      doc.text(`USD $${total.toFixed(2)}`, 150, 59, { align: 'right' });
      
      // Client info
      doc.setFontSize(12);
      doc.setTextColor(51, 51, 51);
      doc.text('BILL TO', 20, 65);
      
      doc.setFontSize(11);
      doc.text(client.name || invoice.clientName || '', 20, 73);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      if (client.address) {
        doc.text(client.address, 20, 79);
      }
      if (client.city && client.state) {
        doc.text(`${client.city}, ${client.state}${client.zipCode ? ` ${client.zipCode}` : ''}`, 20, 85);
      }
      if (client.email) {
        doc.text(client.email, 20, 91);
      }
      if (client.phone) {
        doc.text(client.phone, 20, 97);
      }
      
      // Line items table
      const tableTop = 110;
      const colWidths = [90, 25, 20, 35];
      
      // Table header
      doc.setFillColor(245, 245, 245);
      doc.rect(20, tableTop, 170, 10, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(51, 51, 51);
      doc.setFont(undefined, 'bold');
      doc.text('DESCRIPTION', 25, tableTop + 7);
      doc.text('RATE', 115, tableTop + 7, { align: 'right' });
      doc.text('QTY', 140, tableTop + 7, { align: 'right' });
      doc.text('AMOUNT', 185, tableTop + 7, { align: 'right' });
      
      // Table rows
      doc.setFont(undefined, 'normal');
      let yPos = tableTop + 20;
      
      lineItems.forEach(item => {
        doc.setTextColor(51, 51, 51);
        doc.text(item.description || '', 25, yPos);
        doc.text(`$${(item.rate || item.amount).toFixed(2)}`, 115, yPos, { align: 'right' });
        doc.text(`${item.quantity || 1}`, 140, yPos, { align: 'right' });
        doc.text(`$${item.amount.toFixed(2)}`, 185, yPos, { align: 'right' });
        
        yPos += 15;
      });
      
      // Totals
      const totalsY = yPos + 10;
      doc.text('SUBTOTAL', 150, totalsY, { align: 'right' });
      doc.text(`$${subtotal.toFixed(2)}`, 185, totalsY, { align: 'right' });
      
      if (taxRate > 0) {
        doc.text(`TAX (${taxRate}%)`, 150, totalsY + 8, { align: 'right' });
        doc.text(`$${taxAmount.toFixed(2)}`, 185, totalsY + 8, { align: 'right' });
      }
      
      doc.setFont(undefined, 'bold');
      doc.text('TOTAL', 150, totalsY + (taxRate > 0 ? 16 : 8), { align: 'right' });
      doc.text(`$${total.toFixed(2)}`, 185, totalsY + (taxRate > 0 ? 16 : 8), { align: 'right' });
      
      if (invoice.paymentAmount) {
        doc.setFont(undefined, 'normal');
        doc.text('PAYMENT', 150, totalsY + (taxRate > 0 ? 24 : 16), { align: 'right' });
        doc.text(`-$${invoice.paymentAmount.toFixed(2)}`, 185, totalsY + (taxRate > 0 ? 24 : 16), { align: 'right' });
        
        doc.setFont(undefined, 'bold');
        doc.text('BALANCE DUE', 150, totalsY + (taxRate > 0 ? 32 : 24), { align: 'right' });
        doc.text(`USD $${(total - invoice.paymentAmount).toFixed(2)}`, 185, totalsY + (taxRate > 0 ? 32 : 24), { align: 'right' });
      }
      
      // Payment info and footer
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      
      let footerY = totalsY + (taxRate > 0 ? (invoice.paymentAmount ? 50 : 40) : (invoice.paymentAmount ? 42 : 32));
      
      if (agentConfig.paymentInstructions) {
        doc.text(agentConfig.paymentInstructions, 105, footerY, { align: 'center' });
        footerY += 8;
      }
      
      if (agentConfig.venmoUsername) {
        doc.text(`Venmo: @${agentConfig.venmoUsername}`, 105, footerY, { align: 'center' });
        footerY += 8;
      }
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'italic');
      const lateFeePolicyText = agentConfig.lateFeePolicy || (agentConfig.netDays === 0
        ? 'Payment is due immediately upon receipt.'
        : `Payment is due within ${agentConfig.netDays || 7} days of invoice date.`);
      
      doc.text(lateFeePolicyText, 105, footerY, { align: 'center' });
      footerY += 15;
      
      doc.setFont(undefined, 'normal');
      doc.text('Thank you for your business!', 105, footerY, { align: 'center' });
      
      // Convert to blob and resolve
      const pdfBlob = doc.output('blob');
      resolve(pdfBlob);
    } catch (error) {
      console.error('Error generating fallback PDF:', error);
      // Create a minimal PDF if all else fails
      const doc = new jsPDF();
      doc.text('Invoice', 105, 20, { align: 'center' });
      doc.text(`Invoice #: ${invoice.invoiceNumber || ''}`, 20, 40);
      doc.text(`Amount: $${invoice.amount || 0}`, 20, 50);
      doc.text(`Client: ${invoice.clientName || ''}`, 20, 60);
      const pdfBlob = doc.output('blob');
      resolve(pdfBlob);
    }
  }
  
  /**
   * Format a date string into a readable format
   * @param {string} dateString - Date string in ISO format
   * @returns {string} Formatted date
   */
  formatDate(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  }
  
  /**
   * Download the generated PDF
   * @param {Blob} pdfBlob - PDF blob data
   * @param {string} filename - Name for the downloaded file
   */
  downloadPdf(pdfBlob, filename) {
    // Create a URL for the blob
    const blobUrl = URL.createObjectURL(pdfBlob);
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'invoice.pdf';
    
    // Append to the document, click and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 100);
  }
}

export const pdfService = new PdfService(); 