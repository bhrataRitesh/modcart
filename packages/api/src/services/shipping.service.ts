import { prisma } from '@modcart/db';

export async function calculateShipping(items: any[], shippingAddress: any) {
  // 1. Calculate total weight
  let totalWeight = 0;
  for (const item of items) {
    // If you pass product as part of item, we can fetch it or trust the payload
    // Assume we have to fetch product or trust passed weight
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { weight: true }
    });
    totalWeight += (product?.weight || 0) * item.quantity;
  }

  // 2. Find eligible shipping zones (naive match based on country / state)
  const zones = await prisma.shippingZone.findMany({
    where: {
       // Ideally we check if address.country is in `countries` array
       // Prisma doesn't perfectly support array overlaps in SQLite/MySQL, but this is Postgres
    },
    include: { methods: { where: { isActive: true } } }
  });
  
  // Filter zones in JS for simplicity
  const matchedZones = zones.filter(zone => {
    if (zone.countries.length > 0 && !zone.countries.includes(shippingAddress.country)) {
      return false;
    }
    if (zone.states.length > 0 && !zone.states.includes(shippingAddress.state)) {
      return false;
    }
    return true;
  });

  const availableMethods = [];

  for (const zone of matchedZones) {
    for (const method of zone.methods) {
      let finalRate = method.flatRate || 0;

      if (method.type === 'FREE') {
        finalRate = 0;
      } else if (method.type === 'WEIGHT_BASED' && method.weightRates) {
        // Parse weight rates Array
        const rates = method.weightRates as any[];
        // find applicable rate
        const applicable = rates.find(r => totalWeight >= r.minWeight && totalWeight <= r.maxWeight);
        if (applicable) {
          finalRate = applicable.rate;
        } else {
          continue; // method unsupported for this weight
        }
      }

      availableMethods.push({
        id: method.id,
        name: method.name,
        type: method.type,
        rate: finalRate,
        estimatedDays: 5, // mock estimation
      });
    }
  }

  return availableMethods;
}
