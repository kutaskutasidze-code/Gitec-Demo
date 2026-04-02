const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (!transporter && config.smtp.user && config.smtp.pass) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.warn('Email not configured — skipping send to', to);
    return null;
  }
  return t.sendMail({
    from: config.smtp.from,
    to,
    subject,
    html
  });
}

async function sendContactNotification({ name, email, message }) {
  return sendMail({
    to: 'info@gitec.ge',
    subject: `New contact message from ${name}`,
    html: `
      <h2>New Contact Message</h2>
      <p><strong>From:</strong> ${name} (${email})</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `
  });
}

async function sendOrderConfirmation({ order, items, userEmail }) {
  const itemRows = items.map(i =>
    `<tr><td>${i.productName}</td><td>${i.quantity}</td><td>₾${i.productPrice}</td><td>₾${i.subtotal}</td></tr>`
  ).join('');

  return sendMail({
    to: userEmail,
    subject: `GITEC — Order #${order.id} Confirmed`,
    html: `
      <h2>Thank you for your order!</h2>
      <p>Order #${order.id} has been placed successfully.</p>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><th>Product</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
        ${itemRows}
      </table>
      <p><strong>Shipping:</strong> ₾${order.shippingCost}</p>
      <p><strong>Total:</strong> ₾${order.total}</p>
      <p>We will notify you when your order ships.</p>
      <p>— GITEC Team</p>
    `
  });
}

module.exports = { sendMail, sendContactNotification, sendOrderConfirmation };
