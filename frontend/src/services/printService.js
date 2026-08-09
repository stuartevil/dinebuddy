/**
 * Utility Service for printing KOT (Kitchen Order Tickets) and Customer Bills/Receipts
 * optimized for 80mm / 58mm POS Thermal Printers (Hewlett Packard, Epson, Xprinter, etc.)
 */

function executePrint(htmlContent) {
  return new Promise((resolve) => {
    // Remove existing print iframe if present
    const existingIframe = document.getElementById('dinebuddy-print-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    // Create a new hidden iframe for print generation
    const iframe = document.createElement('iframe');
    iframe.id = 'dinebuddy-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Trigger window.print() once content renders
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error("Thermal print error:", e);
        }
        resolve();
      }, 250);
    };

    // Backup trigger fallback
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        // ignore fallback errors
      }
      resolve();
    }, 500);
  });
}

/**
 * Print Kitchen Order Ticket (KOT)
 * @param {Object} order Order object containing id, items, table_number, created_at, notes
 * @param {Object} restaurant Restaurant object containing name, etc.
 */
export const printKOT = (order, restaurant = {}) => {
  const restaurantName = restaurant.name || 'YOUR RESTAURANT NAME';
  const orderNum = order.order_number || (order.id ? `KOT-${order.id}` : `KOT-${Date.now().toString().slice(-4)}`);
  const tableNum = order.table_number || order.table || 'Takeaway';
  const orderTime = order.created_at
    ? new Date(order.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    : new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  const items = order.items || [];
  const notes = order.notes || order.special_instructions || '';

  const itemsHtml = items.map(item => {
    const qty = item.quantity || item.qty || 1;
    const name = item.name || item.menu_item_name || 'Item';
    const instructions = item.special_instructions || item.note || '';
    return `
      <tr>
        <td style="font-weight: bold; width: 45px; vertical-align: top; font-size: 14px;">${qty}x</td>
        <td style="vertical-align: top;">
          <div style="font-weight: bold; font-size: 13px;">${name}</div>
          ${instructions ? `<div style="font-size: 11px; font-style: italic; color: #222; margin-top: 2px;">(${instructions})</div>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>KOT - ${orderNum}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0mm 0.2in 0mm 0mm;
        }
        body {
          width: 76mm;
          margin: 0 auto;
          padding: 8px 0.2in 8px 4px;
          padding-right: 0.2in;
          font-family: 'Courier New', Courier, monospace, sans-serif;
          font-size: 13px;
          color: #000;
          line-height: 1.25;
          background: #fff;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 6px;
          margin-bottom: 6px;
        }
        .title {
          font-size: 16px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 2px;
        }
        .subtitle {
          font-size: 12px;
          font-weight: bold;
        }
        .meta-table {
          width: 100%;
          font-size: 12px;
          margin-bottom: 6px;
          border-bottom: 1px dashed #000;
          padding-bottom: 4px;
        }
        .meta-table td {
          padding: 2px 0;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 8px;
        }
        .items-table th {
          border-bottom: 1px solid #000;
          text-align: left;
          font-size: 12px;
          padding-bottom: 4px;
        }
        .items-table td {
          padding: 4px 0;
        }
        .double-divider {
          border-top: 2px double #000;
          margin: 8px 0;
        }
        .notes-box {
          border: 1px dashed #000;
          padding: 5px 6px;
          font-size: 11px;
          margin-top: 6px;
          background: #fcfcfc;
        }
        .footer {
          text-align: center;
          font-size: 11px;
          margin-top: 8px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">*** K O T ***</div>
        <div class="subtitle">${restaurantName}</div>
      </div>

      <table class="meta-table">
        <tr>
          <td><strong>KOT #:</strong> ${orderNum}</td>
          <td style="text-align: right;"><strong>Time:</strong> ${orderTime}</td>
        </tr>
        <tr>
          <td colspan="2"><strong>Type / Table:</strong> ${tableNum}</td>
        </tr>
      </table>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 45px;">QTY</th>
            <th>ITEM &amp; INSTRUCTIONS</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      ${notes ? `<div class="notes-box"><strong>KITCHEN NOTE:</strong> ${notes}</div>` : ''}

      <div class="double-divider"></div>
      <div class="footer">--- KITCHEN COPY ---</div>
    </body>
    </html>
  `;

  return executePrint(html);
};

/**
 * Print Customer Final Bill / Receipt
 * @param {Object} bill Bill/Order object containing total, items, table_number, discount, etc.
 * @param {Object} restaurant Restaurant metadata containing name, address, phone, gstin
 */
export const printBill = (bill, restaurant = {}) => {
  const restaurantName = restaurant.name || 'YOUR RESTAURANT NAME';
  const address = restaurant.address ? `${restaurant.address}${restaurant.city ? `, ${restaurant.city}` : ''}` : '';
  const phone = restaurant.phone || '';
  const gstin = restaurant.gstin || restaurant.tax_id || '';

  const billNum = bill.order_number || (bill.id ? `BILL-${bill.id}` : `BILL-${Date.now().toString().slice(-4)}`);
  const tableNum = bill.table_number || bill.table || 'Takeaway';
  const billTime = bill.created_at
    ? new Date(bill.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    : new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  const items = bill.items || [];

  const subtotal = parseFloat(bill.subtotal || items.reduce((s, i) => s + (parseFloat(i.price || i.unit_price || 0) * (i.quantity || i.qty || 1)), 0) || 0);
  const gst = parseFloat(bill.gst || bill.tax || (subtotal * 0.05) || 0);
  const discount = parseFloat(bill.discount || 0);
  const total = parseFloat(bill.total || (subtotal + gst - discount) || 0);
  const paymentMethod = (bill.payment_method || 'CASH').toUpperCase();
  const paymentStatus = (bill.payment_status || (bill.status && bill.status !== 'cancelled') ? 'PAID' : 'PAID').toUpperCase();

  const itemsHtml = items.map(item => {
    const qty = item.quantity || item.qty || 1;
    const name = item.name || item.menu_item_name || 'Item';
    const price = parseFloat(item.price || item.unit_price || 0);
    const lineTotal = price * qty;
    return `
      <tr>
        <td style="padding: 3px 0;">
          <div style="font-weight: bold;">${name}</div>
        </td>
        <td style="text-align: center; vertical-align: top;">${qty}</td>
        <td style="text-align: right; vertical-align: top;">${price.toFixed(2)}</td>
        <td style="text-align: right; vertical-align: top; font-weight: bold;">${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Bill - ${billNum}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0mm 0.2in 0mm 0mm;
        }
        body {
          width: 76mm;
          margin: 0 auto;
          padding: 8px 0.2in 8px 4px;
          padding-right: 0.2in;
          font-family: 'Courier New', Courier, monospace, sans-serif;
          font-size: 12px;
          color: #000;
          line-height: 1.2;
          background: #fff;
        }
        .header {
          text-align: center;
          margin-bottom: 6px;
        }
        .restaurant-name {
          font-size: 16px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .contact-info {
          font-size: 11px;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .double-divider {
          border-top: 2px double #000;
          margin: 6px 0;
        }
        .meta-table {
          width: 100%;
          font-size: 11px;
          margin-bottom: 4px;
        }
        .meta-table td {
          padding: 1px 0;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 6px;
        }
        .items-table th {
          border-bottom: 1px solid #000;
          font-size: 11px;
          padding-bottom: 3px;
        }
        .totals-table {
          width: 100%;
          font-size: 12px;
          margin-top: 4px;
        }
        .totals-table td {
          padding: 2px 0;
        }
        .grand-total {
          font-size: 15px;
          font-weight: 900;
        }
        .payment-box {
          border: 1px solid #000;
          padding: 5px;
          text-align: center;
          margin: 8px 0;
          font-weight: bold;
          font-size: 12px;
        }
        .footer {
          text-align: center;
          font-size: 11px;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="restaurant-name">${restaurantName}</div>
        ${address ? `<div class="contact-info">${address}</div>` : ''}
        ${phone ? `<div class="contact-info">Ph: ${phone}</div>` : ''}
        ${gstin ? `<div class="contact-info">GSTIN: ${gstin}</div>` : ''}
      </div>

      <div class="divider"></div>

      <table class="meta-table">
        <tr>
          <td><strong>Bill #:</strong> ${billNum}</td>
          <td style="text-align: right;"><strong>Date:</strong> ${billTime}</td>
        </tr>
        <tr>
          <td><strong>Table:</strong> ${tableNum}</td>
          <td style="text-align: right;"><strong>Type:</strong> POS Sale</td>
        </tr>
      </table>

      <div class="divider"></div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="text-align: left;">ITEM</th>
            <th style="text-align: center; width: 30px;">QTY</th>
            <th style="text-align: right; width: 50px;">RATE</th>
            <th style="text-align: right; width: 60px;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="divider"></div>

      <table class="totals-table">
        <tr>
          <td>Subtotal:</td>
          <td style="text-align: right;">₹${subtotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td>GST (5%):</td>
          <td style="text-align: right;">₹${gst.toFixed(2)}</td>
        </tr>
        ${discount > 0 ? `
        <tr>
          <td>Discount:</td>
          <td style="text-align: right;">-₹${discount.toFixed(2)}</td>
        </tr>
        ` : ''}
        <tr class="grand-total">
          <td style="border-top: 1px solid #000; padding-top: 4px;">TOTAL DUE:</td>
          <td style="text-align: right; border-top: 1px solid #000; padding-top: 4px;">₹${total.toFixed(2)}</td>
        </tr>
      </table>

      <div class="payment-box">
        PAYMENT MODE: ${paymentMethod} | STATUS: ${paymentStatus}
      </div>

      <div class="double-divider"></div>

      <div class="footer">
        <div>Thank you for dining with us!</div>
        <div style="font-weight: bold; margin-top: 2px;">Please Visit Again</div>
      </div>
    </body>
    </html>
  `;

  return executePrint(html);
};
