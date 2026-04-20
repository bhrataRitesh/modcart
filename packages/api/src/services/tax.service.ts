import { prisma } from '@modcart/db';

export async function calculateTax(subtotal: number, shippingTotal: number, address: any) {
  // Find applicable tax rules
  const zones = await prisma.taxZone.findMany({
    include: { rules: { where: { isActive: true } } }
  });

  const applicableRules = [];

  for (const zone of zones) {
    for (const rule of zone.rules) {
      if (rule.country !== address.country) continue;
      if (rule.state && rule.state !== address.state) continue;
      if (rule.zipCode && rule.zipCode !== address.postalCode) continue;

      applicableRules.push(rule);
    }
  }

  // Sort by priority (higher priority first if needed, usually compound tax applies in order)
  applicableRules.sort((a, b) => a.priority - b.priority);

  let taxTotal = 0;
  const breakdown: any[] = [];

  for (const rule of applicableRules) {
    let baseAmount = subtotal;
    if (rule.appliesToShipping) {
      baseAmount += shippingTotal;
    }
    
    // Simplistic compounding: if priorities were different, we might add already calculated tax
    // For now, straight percentage on base
    const taxAmount = (baseAmount * rule.rate) / 100;
    taxTotal += taxAmount;
    
    breakdown.push({
      ruleId: rule.id,
      name: `${rule.rate}% - ${rule.country} ${rule.state || ''}`,
      rate: rule.rate,
      amount: taxAmount
    });
  }

  return {
    taxTotal: Number(taxTotal.toFixed(2)),
    breakdown
  };
}
