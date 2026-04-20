import PDFDocument from 'pdfkit';
import { prisma } from '@modcart/db';

export async function generateInvoicePDF(orderId: string): Promise<Buffer> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      items: true,
      shippingAddress: true,
      billingAddress: true,
    }
  });

  if (!order) {
    throw new Error('Order not found');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('INVOICE', { align: 'right' });
    doc.fontSize(10).text(`Order Number: ${order.orderNumber}`, { align: 'right' });
    doc.text(`Date: ${order.createdAt.toLocaleDateString()}`, { align: 'right' });
    doc.moveDown();

    // Addresses
    doc.fontSize(12).text('Billed To:');
    doc.fontSize(10);
    if (order.billingAddress) {
      doc.text(`${order.billingAddress.firstName} ${order.billingAddress.lastName}`);
      doc.text(order.billingAddress.line1);
      if (order.billingAddress.line2) doc.text(order.billingAddress.line2);
      doc.text(`${order.billingAddress.city}, ${order.billingAddress.state} ${order.billingAddress.postalCode}`);
      doc.text(order.billingAddress.country);
    } else {
      doc.text(order.guestEmail || order.user?.email || 'N/A');
    }
    
    doc.moveDown();
    
    // Items table
    doc.fontSize(12).text('Order Items', { underline: true });
    doc.moveDown();
    
    let yPosition = doc.y;
    doc.fontSize(10);
    doc.text('Item', 50, yPosition);
    doc.text('Qty', 300, yPosition, { width: 50, align: 'right' });
    doc.text('Price', 350, yPosition, { width: 70, align: 'right' });
    doc.text('Total', 420, yPosition, { width: 80, align: 'right' });
    
    doc.moveTo(50, yPosition + 15).lineTo(500, yPosition + 15).stroke();
    
    doc.moveDown();
    
    order.items.forEach(item => {
      yPosition = doc.y;
      doc.text(item.name, 50, yPosition, { width: 250 });
      doc.text(item.quantity.toString(), 300, yPosition, { width: 50, align: 'right' });
      doc.text(`$${item.price.toFixed(2)}`, 350, yPosition, { width: 70, align: 'right' });
      doc.text(`$${item.total.toFixed(2)}`, 420, yPosition, { width: 80, align: 'right' });
      doc.moveDown();
    });
    
    doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
    doc.moveDown();
    
    // Totals
    const subtotalY = doc.y;
    doc.text('Subtotal:', 350, subtotalY, { width: 70, align: 'right' });
    doc.text(`$${order.subtotal.toFixed(2)}`, 420, subtotalY, { width: 80, align: 'right' });
    doc.moveDown();
    
    const shippingY = doc.y;
    doc.text('Shipping:', 350, shippingY, { width: 70, align: 'right' });
    doc.text(`$${order.shippingTotal.toFixed(2)}`, 420, shippingY, { width: 80, align: 'right' });
    doc.moveDown();
    
    const taxY = doc.y;
    doc.text('Tax:', 350, taxY, { width: 70, align: 'right' });
    doc.text(`$${order.taxTotal.toFixed(2)}`, 420, taxY, { width: 80, align: 'right' });
    doc.moveDown();
    
    const totalY = doc.y;
    doc.fontSize(12).text('Total:', 350, totalY, { width: 70, align: 'right' });
    doc.text(`$${order.total.toFixed(2)}`, 420, totalY, { width: 80, align: 'right' });

    doc.end();
  });
}
