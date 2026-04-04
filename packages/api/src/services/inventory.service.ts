import { prisma } from '@modcart/db';
import { sendLowStockEmail } from './email.service';

export async function adjustStock(params: {
  productId: string;
  variantId?: string;
  change: number;
  reason: 'RESTOCK' | 'ORDER_SALE' | 'RETURN' | 'MANUAL_ADJUSTMENT' | 'CANCELLATION';
  referenceId?: string;
}) {
  const { productId, variantId, change, reason, referenceId } = params;

  return await prisma.$transaction(async (tx) => {
    let previousStock = 0;
    let newStock = 0;
    let threshold = 0;
    let vendorId = '';
    let productName = '';

    if (variantId) {
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true }
      });
      if (!variant) throw new Error('Variant not found');
      previousStock = variant.stockQty;
      newStock = previousStock + change;
      threshold = variant.product.lowStockAlert;
      vendorId = variant.product.vendorId;
      productName = `${variant.product.name} (${variant.sku})`;

      await tx.productVariant.update({
        where: { id: variantId },
        data: { stockQty: newStock }
      });
    } else {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error('Product not found');
      previousStock = product.stockQty;
      newStock = previousStock + change;
      threshold = product.lowStockAlert;
      vendorId = product.vendorId;
      productName = product.name;

      await tx.product.update({
        where: { id: productId },
        data: { stockQty: newStock }
      });
    }

    // Log Event
    await tx.stockEvent.create({
      data: {
        productId,
        variantId,
        change,
        previousStock,
        newStock,
        reason,
        referenceId
      }
    });

    // Check low stock alert
    if (change < 0 && newStock <= threshold) {
      const vendor = await tx.vendorProfile.findUnique({
        where: { id: vendorId },
        include: { user: true }
      });
      if (vendor?.user?.email) {
        await sendLowStockEmail(vendor.user.email, {
          productName,
          currentStock: newStock,
          threshold
        });
      }
    }

    return newStock;
  });
}
