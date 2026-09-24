import nodemailer from 'nodemailer';
import { formatItemVariationHtml } from './variation';

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpFrom = process.env.SMTP_FROM || `"Invincible Fitness" <${smtpUser}>`;
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

// ---------------------------------------------------------------------------
// Transporter
// ---------------------------------------------------------------------------

function getTransporter() {
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    tls: { rejectUnauthorized: false },
  });
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function formatDate(date) {
  return date
    ? new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

function buildItemRowsHTML(items) {
  return items
    .map(
      (item) => `
      <tr>
        <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:700;vertical-align:top;">
          ${item.productName}
          ${
            item.flavor || item.unitDisplay
              ? `<div style="font-size:11px;color:#64748b;font-weight:600;margin-top:4px;">
                  ${formatItemVariationHtml(item.flavor, item.unitDisplay, item.productName)}
                </div>`
              : ''
          }
        </td>
        <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;font-weight:700;text-align:center;vertical-align:top;">
          ${item.quantity}
        </td>
        <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;font-weight:600;text-align:right;vertical-align:top;">
          ₹${item.price.toLocaleString('en-IN')}
        </td>
        <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:800;text-align:right;vertical-align:top;">
          ₹${item.subtotal.toLocaleString('en-IN')}
        </td>
      </tr>`
    )
    .join('');
}

function buildItemsTable(items) {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
      <thead>
        <tr style="background-color:#f8fafc;border-bottom:2px solid #e2e8f0;">
          <th align="left"  style="padding:10px 16px;font-size:10px;color:#475569;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;">Product</th>
          <th align="center" style="padding:10px 16px;font-size:10px;color:#475569;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
          <th align="right"  style="padding:10px 16px;font-size:10px;color:#475569;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;">Price</th>
          <th align="right"  style="padding:10px 16px;font-size:10px;color:#475569;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${buildItemRowsHTML(items)}
      </tbody>
    </table>`;
}

function buildTotalsBox(data, totalLabel = 'Total Paid', totalColor = '#ea580c') {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0"
      style="margin-top:20px;background-color:#f8fafc;border-radius:14px;padding:18px;border:1px solid #e2e8f0;">
      <tr>
        <td style="font-size:13px;color:#64748b;font-weight:600;padding-bottom:8px;">Subtotal</td>
        <td align="right" style="font-size:13px;color:#0f172a;font-weight:700;padding-bottom:8px;">
          ₹${data.subtotal.toLocaleString('en-IN')}
        </td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#64748b;font-weight:600;padding-bottom:10px;">Express Doorstep Shipping</td>
        <td align="right" style="font-size:13px;color:#16a34a;font-weight:800;padding-bottom:10px;">FREE</td>
      </tr>
      <tr style="border-top:1px solid #cbd5e1;">
        <td style="font-size:15px;color:#0f172a;font-weight:900;padding-top:12px;">${totalLabel}</td>
        <td align="right" style="font-size:20px;color:${totalColor};font-weight:900;padding-top:12px;">
          ₹${data.totalAmount.toLocaleString('en-IN')}
        </td>
      </tr>
    </table>`;
}

function buildAddressPaymentCards(data, paymentStatusHtml) {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;">
      <tr>
        <td width="250" style="width:48%;vertical-align:top;background-color:#f8fafc;border-radius:14px;padding:20px;border:1px solid #e2e8f0;">
          <span style="display:block;font-size:10px;font-weight:900;color:#ea580c;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;">
            Delivery Address
          </span>
          <div style="font-size:13px;color:#0f172a;font-weight:800;">
            ${data.billing.firstName} ${data.billing.lastName}
          </div>
          <div style="font-size:12px;color:#475569;font-weight:500;line-height:1.5;margin-top:6px;">
            ${data.billing.address1}${data.billing.address2 ? `<br>${data.billing.address2}` : ''}<br>
            ${data.billing.city}, ${data.billing.state} - ${data.billing.postcode}<br>
            <span style="color:#0f172a;font-weight:700;">Phone:</span> ${data.billing.phone}
          </div>
        </td>
        <td width="16" style="width:4%;"></td>
        <td width="250" style="width:48%;vertical-align:top;background-color:#f8fafc;border-radius:14px;padding:20px;border:1px solid #e2e8f0;">
          <span style="display:block;font-size:10px;font-weight:900;color:#ea580c;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;">
            Payment Summary
          </span>
          <div style="font-size:12px;color:#0f172a;font-weight:700;">
            Method: <span style="color:#334155;font-weight:600;">
              ${data.paymentMethod === 'razorpay' ? 'Razorpay Online Payment' : data.paymentMethod}
            </span>
          </div>
          ${paymentStatusHtml}
        </td>
      </tr>
    </table>`;
}

function buildEmailShell({ logoUrl, headerAccentColor, bannerHtml, bodyHtml }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:40px 12px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0"
          style="background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color:#09090b;padding:28px 36px;text-align:center;border-bottom:2px solid ${headerAccentColor};">
              <img src="${logoUrl}" alt="Invincible Fitness"
                style="height:48px;max-height:48px;width:auto;margin:0 auto;display:block;" />
            </td>
          </tr>

          <!-- Banner -->
          ${bannerHtml}

          <!-- Body -->
          ${bodyHtml}

          <!-- Footer -->
          <tr>
            <td style="background-color:#09090b;padding:24px 36px;text-align:center;border-top:1px solid #18181b;">
              <p style="color:#cbd5e1;margin:0;font-size:11px;font-weight:500;">
                Invincible Fitness Store · Jalandhar, Punjab, India
              </p>
              <p style="color:#64748b;margin:8px 0 0 0;font-size:10px;font-weight:500;">
                © ${new Date().getFullYear()} Invincible Fitness. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 1. Order Confirmation Email (placed / paid)
// ---------------------------------------------------------------------------

function buildOrderInvoiceHTML(data) {
  const logoUrl = `${siteUrl}/invincible-logo.png`;

  const bannerHtml = `
    <tr>
      <td style="background-color:#f0fdf4;border-bottom:1px solid #dcfce7;padding:22px 36px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align:middle;width:36px;">
              <div style="width:32px;height:32px;background-color:#16a34a;border-radius:50%;text-align:center;line-height:32px;color:#ffffff;font-size:16px;font-weight:bold;">✓</div>
            </td>
            <td style="padding-left:14px;">
              <span style="font-size:10px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:1.5px;display:block;margin-bottom:2px;">
                Order Confirmed &amp; Processing
              </span>
              <h2 style="margin:0;font-size:16px;color:#0f172a;font-weight:900;">
                Thank you for your order, ${data.billing.firstName}!
              </h2>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  const bodyHtml = `
    <tr>
      <td style="padding:28px 36px 16px 36px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0"
          style="background-color:#f8fafc;border-radius:14px;padding:18px 20px;border:1px solid #e2e8f0;">
          <tr>
            <td style="vertical-align:top;">
              <span style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Order Number</span>
              <div style="font-size:17px;font-weight:900;color:#0f172a;margin-top:3px;">${data.orderNumber}</div>
            </td>
            <td align="right" style="vertical-align:top;">
              <span style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Order Date</span>
              <div style="font-size:13px;font-weight:700;color:#334155;margin-top:4px;">${formatDate(data.createdAt)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 36px 24px 36px;">
        <h3 style="margin:0 0 14px 0;font-size:11px;font-weight:900;color:#475569;text-transform:uppercase;letter-spacing:1.2px;">
          Itemized Order Summary
        </h3>
        ${buildItemsTable(data.items)}
        ${buildTotalsBox(data, 'Total Paid', '#ea580c')}
      </td>
    </tr>
    <tr>
      <td style="padding:0 36px 32px 36px;">
        ${buildAddressPaymentCards(
          data,
          `<div style="font-size:12px;color:#16a34a;font-weight:800;margin-top:6px;">Status: Payment Verified (PAID)</div>`
        )}
      </td>
    </tr>`;

  return buildEmailShell({
    logoUrl,
    headerAccentColor: '#ea580c',
    bannerHtml,
    bodyHtml,
  });
}

export async function sendOrderConfirmationEmail(data) {
  try {
    if (!data.billing.email?.trim()) {
      console.warn('No recipient email provided for order confirmation.');
      return false;
    }

    const htmlContent = buildOrderInvoiceHTML(data);

    if (!smtpPass) {
      console.log('--------------------------------------------------');
      console.log(`[SMTP SIMULATION] Order confirmation email for: ${data.billing.email}`);
      console.log(`Order: ${data.orderNumber} | Total: ₹${data.totalAmount}`);
      console.log('--------------------------------------------------');
      return true;
    }

    const info = await getTransporter().sendMail({
      from: smtpFrom,
      to: data.billing.email.trim(),
      subject: `Order Invoice #${data.orderNumber} — Invincible Fitness`,
      html: htmlContent,
    });
    console.log(`Order confirmation email sent to ${data.billing.email}. ID:`, info.messageId);
    return true;
  } catch (err) {
    console.error('Error sending order confirmation email:', err?.message || err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 2. Order Completed Email
// ---------------------------------------------------------------------------

function buildOrderCompletedHTML(data) {
  const logoUrl = `${siteUrl}/invincible-logo.png`;

  const bannerHtml = `
    <tr>
      <td style="background-color:#eff6ff;border-bottom:1px solid #dbeafe;padding:22px 36px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align:middle;width:36px;">
              <div style="width:32px;height:32px;background-color:#2563eb;border-radius:50%;text-align:center;line-height:32px;color:#ffffff;font-size:16px;font-weight:bold;">✓</div>
            </td>
            <td style="padding-left:14px;">
              <span style="font-size:10px;font-weight:800;color:#1e40af;text-transform:uppercase;letter-spacing:1.5px;display:block;margin-bottom:2px;">
                Order Completed
              </span>
              <h2 style="margin:0;font-size:16px;color:#0f172a;font-weight:900;">
                Your order has been delivered, ${data.billing.firstName}!
              </h2>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  const bodyHtml = `
    <tr>
      <td style="padding:28px 36px 8px 36px;">
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.6;">
          Great news! Your order <strong>#${data.orderNumber}</strong> has been marked as <strong>completed</strong>.
          We hope you enjoy your products. Thank you for shopping with Invincible Fitness!
        </p>
        <table width="100%" border="0" cellspacing="0" cellpadding="0"
          style="background-color:#f8fafc;border-radius:14px;padding:18px 20px;border:1px solid #e2e8f0;">
          <tr>
            <td style="vertical-align:top;">
              <span style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Order Number</span>
              <div style="font-size:17px;font-weight:900;color:#0f172a;margin-top:3px;">${data.orderNumber}</div>
            </td>
            <td align="right" style="vertical-align:top;">
              <span style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Order Date</span>
              <div style="font-size:13px;font-weight:700;color:#334155;margin-top:4px;">${formatDate(data.createdAt)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 36px 24px 36px;">
        <h3 style="margin:0 0 14px 0;font-size:11px;font-weight:900;color:#475569;text-transform:uppercase;letter-spacing:1.2px;">
          Itemized Order Summary
        </h3>
        ${buildItemsTable(data.items)}
        ${buildTotalsBox(data, 'Total Paid', '#2563eb')}
      </td>
    </tr>
    <tr>
      <td style="padding:0 36px 32px 36px;">
        ${buildAddressPaymentCards(
          data,
          `<div style="font-size:12px;color:#16a34a;font-weight:800;margin-top:6px;">Status: Order Completed</div>`
        )}
      </td>
    </tr>`;

  return buildEmailShell({
    logoUrl,
    headerAccentColor: '#2563eb',
    bannerHtml,
    bodyHtml,
  });
}

export async function sendOrderCompletedEmail(data) {
  try {
    if (!data.billing.email?.trim()) {
      console.warn('No recipient email provided for order completed notification.');
      return false;
    }

    const htmlContent = buildOrderCompletedHTML(data);

    if (!smtpPass) {
      console.log('--------------------------------------------------');
      console.log(`[SMTP SIMULATION] Order completed email for: ${data.billing.email}`);
      console.log(`Order: ${data.orderNumber} | Total: ₹${data.totalAmount}`);
      console.log('--------------------------------------------------');
      return true;
    }

    const info = await getTransporter().sendMail({
      from: smtpFrom,
      to: data.billing.email.trim(),
      subject: `Your Order #${data.orderNumber} is Completed — Invincible Fitness`,
      html: htmlContent,
    });
    console.log(`Order completed email sent to ${data.billing.email}. ID:`, info.messageId);
    return true;
  } catch (err) {
    console.error('Error sending order completed email:', err?.message || err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 3. Account Setup Email
// ---------------------------------------------------------------------------

function buildAccountSetupHTML(data) {
  const logoUrl = `${siteUrl}/invincible-logo.png`;
  const setupUrl = `${siteUrl}/set-password?token=${encodeURIComponent(data.token)}`;

  const bannerHtml = '';

  const bodyHtml = `
    <tr>
      <td style="padding:36px 36px 28px 36px;">
        <span style="font-size:10px;font-weight:800;color:#ea580c;text-transform:uppercase;letter-spacing:1.5px;display:block;margin-bottom:6px;">
          Welcome to Invincible Fitness
        </span>
        <h2 style="margin:0 0 16px 0;font-size:20px;color:#0f172a;font-weight:900;">
          Set Password for Your Account
        </h2>
        <p style="margin:0 0 16px 0;font-size:14px;color:#475569;line-height:1.6;">
          Hello <strong>${data.name || 'Customer'}</strong>,
        </p>
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.6;">
          Thank you for your recent order! An account has been created for you with your email
          <strong>${data.email}</strong>. Please click the secure link below to set your account
          password, view your order details, and manage your account.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${setupUrl}"
            style="display:inline-block;background-color:#ea580c;color:#ffffff;font-weight:800;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;box-shadow:0 4px 12px rgba(234,88,12,0.25);">
            Set Account Password →
          </a>
        </div>
        <p style="margin:24px 0 0 0;font-size:12px;color:#64748b;line-height:1.5;background-color:#f8fafc;padding:14px;border-radius:10px;border:1px solid #e2e8f0;">
          If the button above does not work, copy and paste this link into your browser:<br>
          <a href="${setupUrl}" style="color:#ea580c;word-break:break-all;font-weight:600;">${setupUrl}</a>
        </p>
      </td>
    </tr>`;

  return buildEmailShell({
    logoUrl,
    headerAccentColor: '#ea580c',
    bannerHtml,
    bodyHtml,
  });
}

export async function sendAccountSetupEmail(data) {
  try {
    if (!data.email?.trim()) {
      console.warn('No recipient email provided for account setup.');
      return false;
    }

    const htmlContent = buildAccountSetupHTML(data);

    if (!smtpPass) {
      const setupUrl = `${siteUrl}/set-password?token=${encodeURIComponent(data.token)}`;
      console.log('--------------------------------------------------');
      console.log(`[SMTP SIMULATION] Account setup email for: ${data.email}`);
      console.log(`Setup Link: ${setupUrl}`);
      console.log('--------------------------------------------------');
      return true;
    }

    const info = await getTransporter().sendMail({
      from: smtpFrom,
      to: data.email.trim(),
      subject: `Set Your Password — Invincible Fitness`,
      html: htmlContent,
    });
    console.log(`Account setup email sent to ${data.email}. ID:`, info.messageId);
    return true;
  } catch (err) {
    console.error('Error sending account setup email:', err?.message || err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 4. Password Reset Email
// ---------------------------------------------------------------------------

function buildPasswordResetHTML(data) {
  const logoUrl = `${siteUrl}/invincible-logo.png`;
  const resetUrl = `${siteUrl}/set-password?token=${encodeURIComponent(data.token)}`;

  const bannerHtml = '';

  const bodyHtml = `
    <tr>
      <td style="padding:36px 36px 28px 36px;">
        <span style="font-size:10px;font-weight:800;color:#ea580c;text-transform:uppercase;letter-spacing:1.5px;display:block;margin-bottom:6px;">
          Password Reset Request
        </span>
        <h2 style="margin:0 0 16px 0;font-size:20px;color:#0f172a;font-weight:900;">
          Reset Your Account Password
        </h2>
        <p style="margin:0 0 16px 0;font-size:14px;color:#475569;line-height:1.6;">
          Hello <strong>${data.name || 'Customer'}</strong>,
        </p>
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.6;">
          We received a request to reset the password for your Invincible Fitness account associated
          with <strong>${data.email}</strong>. Click the button below to choose a new password.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetUrl}"
            style="display:inline-block;background-color:#ea580c;color:#ffffff;font-weight:800;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;box-shadow:0 4px 12px rgba(234,88,12,0.25);">
            Reset Account Password →
          </a>
        </div>
        <p style="margin:24px 0 0 0;font-size:12px;color:#64748b;line-height:1.5;background-color:#f8fafc;padding:14px;border-radius:10px;border:1px solid #e2e8f0;">
          If the button above does not work, copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color:#ea580c;word-break:break-all;font-weight:600;">${resetUrl}</a>
        </p>
        <p style="margin:16px 0 0 0;font-size:11px;color:#94a3b8;line-height:1.4;">
          If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
      </td>
    </tr>`;

  return buildEmailShell({
    logoUrl,
    headerAccentColor: '#ea580c',
    bannerHtml,
    bodyHtml,
  });
}

export async function sendPasswordResetEmail(data) {
  try {
    if (!data.email?.trim()) {
      console.warn('No recipient email provided for password reset.');
      return false;
    }

    const htmlContent = buildPasswordResetHTML(data);

    if (!smtpPass) {
      const resetUrl = `${siteUrl}/set-password?token=${encodeURIComponent(data.token)}`;
      console.log('--------------------------------------------------');
      console.log(`[SMTP SIMULATION] Password reset email for: ${data.email}`);
      console.log(`Reset Link: ${resetUrl}`);
      console.log('--------------------------------------------------');
      return true;
    }

    const info = await getTransporter().sendMail({
      from: smtpFrom,
      to: data.email.trim(),
      subject: `Reset Your Password — Invincible Fitness`,
      html: htmlContent,
    });
    console.log(`Password reset email sent to ${data.email}. ID:`, info.messageId);
    return true;
  } catch (err) {
    console.error('Error sending password reset email:', err?.message || err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 5. Payment Failed Email
// ---------------------------------------------------------------------------

function buildPaymentFailedHTML(data) {
  const logoUrl = `${siteUrl}/invincible-logo.png`;
  const payUrl = `${siteUrl}/checkout?orderNumber=${encodeURIComponent(data.orderNumber)}`;

  const bannerHtml = `
    <tr>
      <td style="background-color:#fef2f2;border-bottom:1px solid #fee2e2;padding:22px 36px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align:middle;width:36px;">
              <div style="width:32px;height:32px;background-color:#dc2626;border-radius:50%;text-align:center;line-height:32px;color:#ffffff;font-size:16px;font-weight:bold;">✕</div>
            </td>
            <td style="padding-left:14px;">
              <span style="font-size:10px;font-weight:800;color:#991b1b;text-transform:uppercase;letter-spacing:1.5px;display:block;margin-bottom:2px;">
                Payment Failed / Action Required
              </span>
              <h2 style="margin:0;font-size:16px;color:#0f172a;font-weight:900;">
                Payment Unsuccessful for Order #${data.orderNumber}
              </h2>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  const bodyHtml = `
    <tr>
      <td style="padding:28px 36px 16px 36px;">
        <p style="margin:0 0 16px 0;font-size:14px;color:#334155;line-height:1.6;">
          Hello <strong>${data.billing.firstName}</strong>,
        </p>
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.6;">
          Your payment attempt for Order <strong>#${data.orderNumber}</strong> was unsuccessful or
          left incomplete. Your order details have been saved, but items will not be dispatched until
          payment is completed.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${payUrl}"
            style="display:inline-block;background-color:#dc2626;color:#ffffff;font-weight:800;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;box-shadow:0 4px 12px rgba(220,38,38,0.25);">
            Complete Payment Now →
          </a>
        </div>
        <table width="100%" border="0" cellspacing="0" cellpadding="0"
          style="background-color:#f8fafc;border-radius:14px;padding:18px 20px;border:1px solid #e2e8f0;margin-top:20px;">
          <tr>
            <td style="vertical-align:top;">
              <span style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Order Number</span>
              <div style="font-size:17px;font-weight:900;color:#0f172a;margin-top:3px;">${data.orderNumber}</div>
            </td>
            <td align="right" style="vertical-align:top;">
              <span style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Order Date</span>
              <div style="font-size:13px;font-weight:700;color:#334155;margin-top:4px;">${formatDate(data.createdAt)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 36px 24px 36px;">
        <h3 style="margin:0 0 14px 0;font-size:11px;font-weight:900;color:#475569;text-transform:uppercase;letter-spacing:1.2px;">
          Itemized Order Summary
        </h3>
        ${buildItemsTable(data.items)}
        ${buildTotalsBox(data, 'Total Amount Pending', '#dc2626')}
      </td>
    </tr>
    <tr>
      <td style="padding:0 36px 32px 36px;">
        ${buildAddressPaymentCards(
          data,
          `<div style="font-size:12px;color:#dc2626;font-weight:800;margin-top:6px;">Status: Payment Unsuccessful (FAILED)</div>`
        )}
      </td>
    </tr>`;

  return buildEmailShell({
    logoUrl,
    headerAccentColor: '#dc2626',
    bannerHtml,
    bodyHtml,
  });
}

export async function sendPaymentFailedEmail(data) {
  try {
    if (!data.billing.email?.trim()) {
      console.warn('No recipient email provided for payment failed notification.');
      return false;
    }

    const htmlContent = buildPaymentFailedHTML(data);

    if (!smtpPass) {
      console.log('--------------------------------------------------');
      console.log(`[SMTP SIMULATION] Payment failed email for: ${data.billing.email}`);
      console.log(`Order: ${data.orderNumber} | Retry: ${siteUrl}/checkout?orderNumber=${data.orderNumber}`);
      console.log('--------------------------------------------------');
      return true;
    }

    const info = await getTransporter().sendMail({
      from: smtpFrom,
      to: data.billing.email.trim(),
      subject: `Action Required: Payment Unsuccessful for Order #${data.orderNumber} — Invincible Fitness`,
      html: htmlContent,
    });
    console.log(`Payment failed email sent to ${data.billing.email}. ID:`, info.messageId);
    return true;
  } catch (err) {
    console.error('Error sending payment failed email:', err?.message || err);
    return false;
  }
}
