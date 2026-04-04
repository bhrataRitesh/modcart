import { Resend } from 'resend';
import { env } from '@modcart/config';

const resend = new Resend(env.RESEND_API_KEY || 're_mock_123');

export async function sendOrderConfirmation(email: string, orderDetails: { orderNumber: string, total: number }) {
  console.log(`📧 Sending order confirmation to ${email} for Order #${orderDetails.orderNumber}`);
  
  if (!env.RESEND_API_KEY) {
    console.log('⚠️ RESEND_API_KEY not set. Skipping real email.');
    return;
  }

  try {
    await resend.emails.send({
      from: 'Modcart <orders@modcart.shop>', // This should be configured domain
      to: email,
      subject: `Order Confirmation #${orderDetails.orderNumber}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px;">
          <h1 style="color: #2563eb;">Thank you for your order!</h1>
          <p>Hi there,</p>
          <p>We've received your order <strong>#${orderDetails.orderNumber}</strong> and it's being processed.</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Total:</strong> $${orderDetails.total.toFixed(2)}</p>
          </div>
          <p>You'll receive another email once your items have shipped.</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            If you have any questions, reply to this email or visit our support center.
          </p>
        </div>
      `,
    });
    console.log('✅ Email sent successfully');
  } catch (error) {
    console.error('❌ Failed to send email:', error);
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  console.log(`📧 Sending password reset email to ${email}`);

  if (!env.RESEND_API_KEY) {
    console.log(`⚠️ Mock Reset URL: ${resetUrl}`);
    return;
  }

  try {
    await resend.emails.send({
      from: 'Modcart <auth@modcart.shop>',
      to: email,
      subject: 'Reset your password',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>You requested a password reset. Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
          <p style="margin-top: 20px; color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('❌ Failed to send reset email:', error);
  }
}

export async function sendLowStockEmail(email: string, data: { productName: string, currentStock: number, threshold: number }) {
  console.log(`📧 Sending low stock alert to ${email} for ${data.productName}`);

  if (!env.RESEND_API_KEY) return;

  try {
    await resend.emails.send({
      from: 'Modcart Inventory <inventory@modcart.shop>',
      to: email,
      subject: `Low Stock Alert: ${data.productName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fee2e2; border-radius: 8px;">
          <h2 style="color: #991b1b;">Low Stock Alert</h2>
          <p>The following product is running low on stock:</p>
          <div style="background: #fef2f2; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <b style="font-size: 1.1rem;">${data.productName}</b><br/>
            <span style="color: #666;">Current Stock: <b>${data.currentStock}</b></span><br/>
            <span style="color: #666;">Alert Threshold: ${data.threshold}</span>
          </div>
          <p>Please restock soon to avoid missing out on sales.</p>
          <a href="${env.FRONTEND_URL}/vendor/inventory" style="display: inline-block; padding: 10px 20px; background: #991b1b; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Inventory</a>
        </div>
      `,
    });
  } catch (error) {
    console.error('❌ Failed to send low stock email:', error);
  }
}
