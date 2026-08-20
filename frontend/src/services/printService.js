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
    
    let addonsHtml = '';
    if (Array.isArray(item.selectedOpts) && item.selectedOpts.length > 0) {
      addonsHtml = item.selectedOpts.map(opt => {
        const optPrice = parseFloat(opt.price || 0);
        return `<div style="font-size: 12px; font-weight: 800; color: #000; margin-left: 8px; margin-top: 2px;">
          + ${opt.name} (${optPrice > 0 ? `+₹${optPrice.toFixed(2)}` : 'Free'})
        </div>`;
      }).join('');
    } else if (item.addonsTitle) {
      addonsHtml = `<div style="font-size: 12px; font-weight: 800; color: #000; margin-left: 8px; margin-top: 2px;">
        + ${item.addonsTitle.replace(/^\(|\)$/g, '')}
      </div>`;
    } else if (item.special_instructions || item.note) {
      addonsHtml = `<div style="font-size: 11.5px; font-weight: 700; font-style: italic; color: #000; margin-left: 6px; margin-top: 2px;">(${item.special_instructions || item.note})</div>`;
    }

    return `
      <tr>
        <td style="font-weight: 900; width: 45px; vertical-align: top; font-size: 15px; padding: 4px 0;">${qty}x</td>
        <td style="vertical-align: top; padding: 4px 0;">
          <div style="font-weight: 900; font-size: 14px; color: #000;">${name}</div>
          ${addonsHtml}
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
          margin: 0mm;
        }
        body {
          width: 76mm;
          margin: 0 auto;
          padding: 8px 6px;
          font-family: 'Segoe UI', Arial, 'Courier New', monospace, sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: #000;
          line-height: 1.3;
          background: #fff;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 6px;
          margin-bottom: 6px;
        }
        .title {
          font-size: 18px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 2px;
        }
        .subtitle {
          font-size: 13px;
          font-weight: 800;
        }
        .meta-table {
          width: 100%;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 6px;
          border-bottom: 1.5px dashed #000;
          padding-bottom: 5px;
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
          border-bottom: 1.5px solid #000;
          text-align: left;
          font-size: 13px;
          font-weight: 900;
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
          border: 1.5px dashed #000;
          padding: 6px 8px;
          font-size: 12px;
          font-weight: 800;
          margin-top: 6px;
          background: #fcfcfc;
        }
        .footer {
          text-align: center;
          font-size: 12px;
          margin-top: 8px;
          font-weight: 900;
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
  const gstRate = restaurant.tax_rate !== undefined && restaurant.tax_rate !== null ? parseFloat(restaurant.tax_rate) : (bill.tax_rate !== undefined ? parseFloat(bill.tax_rate) : 5);
  const gst = bill.gst !== undefined ? parseFloat(bill.gst) : (bill.tax !== undefined ? parseFloat(bill.tax) : (subtotal * (gstRate / 100)));
  const discount = parseFloat(bill.discount || 0);
  const rawTotal = Math.max(0, subtotal + gst - discount);
  const total = bill.total !== undefined ? parseFloat(bill.total) : Math.round(rawTotal);
  const roundOff = bill.round_off !== undefined ? parseFloat(bill.round_off) : Math.round((total - rawTotal) * 100) / 100;
  const paymentMethod = (bill.payment_method || 'CASH').toUpperCase();
  const paymentStatus = (bill.payment_status || (bill.status && bill.status !== 'cancelled') ? 'PAID' : 'PAID').toUpperCase();

  const itemsHtml = items.map(item => {
    const qty = item.quantity || item.qty || 1;
    const name = item.name || item.menu_item_name || 'Item';
    const price = parseFloat(item.price || item.unit_price || 0);
    const lineTotal = price * qty;

    // Check for addons list / details with bold pricing
    let addonsHtml = '';
    if (Array.isArray(item.selectedOpts) && item.selectedOpts.length > 0) {
      addonsHtml = item.selectedOpts.map(opt => {
        const optPrice = parseFloat(opt.price || 0);
        return `<div style="font-size: 11px; font-weight: 700; color: #000; margin-left: 8px; padding-top: 2px;">
          + ${opt.name} (${optPrice > 0 ? `+₹${optPrice.toFixed(2)}` : 'Free'})
        </div>`;
      }).join('');
    } else if (item.addonsTitle) {
      addonsHtml = `<div style="font-size: 11px; font-weight: 700; color: #000; margin-left: 8px; padding-top: 2px;">
        + ${item.addonsTitle.replace(/^\(|\)$/g, '')}
      </div>`;
    } else if (item.special_instructions && (item.special_instructions.toLowerCase().includes('add-on') || item.special_instructions.includes('+₹') || item.special_instructions.includes('+'))) {
      addonsHtml = `<div style="font-size: 11px; font-weight: 700; color: #000; margin-left: 8px; padding-top: 2px;">
        ${item.special_instructions}
      </div>`;
    }

    let noteHtml = '';
    if (item.special_instructions && !item.special_instructions.toLowerCase().includes('add-on') && !item.special_instructions.includes('+₹')) {
      noteHtml = `<div style="font-size: 10px; font-weight: 700; color: #000; margin-left: 8px; font-style: italic;">Note: ${item.special_instructions}</div>`;
    }

    return `
      <tr>
        <td style="padding: 4px 0; vertical-align: top;">
          <div style="font-weight: 900; font-size: 12.5px; color: #000;">${name}</div>
          ${addonsHtml}
          ${noteHtml}
        </td>
        <td style="text-align: center; padding: 4px 0; vertical-align: top; font-weight: 900; font-size: 12px;">${qty}</td>
        <td style="text-align: right; padding: 4px 0; vertical-align: top; font-weight: 800; font-size: 12px;">₹${price.toFixed(2)}</td>
        <td style="text-align: right; padding: 4px 0; vertical-align: top; font-weight: 900; font-size: 12.5px;">₹${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Tax Invoice / Bill - ${billNum}</title>
      <style>
        @page {
          margin: 0;
          size: 80mm auto;
        }
        body {
          font-family: 'Segoe UI', Arial, 'Courier New', monospace, sans-serif;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.35;
          color: #000;
          background: #fff;
          margin: 0;
          padding: 8px 6px;
          width: 74mm;
        }
        .header {
          text-align: center;
          margin-bottom: 8px;
        }
        .restaurant-name {
          font-size: 16px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 3px;
        }
        .meta-info {
          font-size: 11px;
          font-weight: 700;
          color: #000;
          margin-bottom: 2px;
        }
        .bill-title {
          font-size: 13px;
          font-weight: 900;
          margin: 8px 0 5px 0;
          border-top: 1.5px dashed #000;
          border-bottom: 1.5px dashed #000;
          padding: 4px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .order-info {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 800;
          color: #000;
          margin-bottom: 3px;
        }
        .divider {
          border-bottom: 1.5px dashed #000;
          margin: 6px 0;
        }
        .double-divider {
          border-bottom: 2px solid #000;
          margin: 6px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th {
          border-bottom: 1.5px solid #000;
          padding: 4px 0;
          text-align: left;
          font-weight: 900;
          font-size: 12px;
        }
        .totals-table {
          width: 100%;
          margin-top: 6px;
          border-top: 1.5px dashed #000;
          padding-top: 4px;
        }
        .totals-table td {
          padding: 3px 0;
          font-size: 12px;
          font-weight: 800;
          color: #000;
        }
        .grand-total {
          font-size: 15px !important;
          font-weight: 900 !important;
        }
        .grand-total td {
          font-size: 15px !important;
          font-weight: 900 !important;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 5px 0 !important;
        }
        .payment-box {
          border: 1.5px solid #000;
          padding: 5px;
          text-align: center;
          margin: 8px 0;
          font-weight: 900;
          font-size: 11px;
        }
        .footer {
          text-align: center;
          font-size: 11px;
          font-weight: 800;
          margin-top: 8px;
          color: #000;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="restaurant-name">${restaurantName}</div>
        ${address ? `<div class="meta-info">${address}</div>` : ''}
        ${phone ? `<div class="meta-info"><strong>Ph:</strong> ${phone}</div>` : ''}
        ${gstin ? `<div class="meta-info"><strong>GSTIN:</strong> ${gstin}</div>` : ''}
        
        <div class="bill-title">TAX INVOICE / RECEIPT</div>
      </div>

      <div class="order-info">
        <div><strong>Bill #:</strong> ${billNum}</div>
        <div><strong>Table:</strong> ${tableNum}</div>
      </div>
      <div class="order-info">
        <div><strong>Date:</strong> ${billTime}</div>
      </div>

      <div class="divider"></div>

      <table>
        <thead>
          <tr>
            <th style="width: 46%;">ITEM</th>
            <th style="text-align: center; width: 14%;">QTY</th>
            <th style="text-align: right; width: 20%;">RATE</th>
            <th style="text-align: right; width: 20%;">AMT</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <table class="totals-table">
        <tr>
          <td><strong>Subtotal:</strong></td>
          <td style="text-align: right;"><strong>₹${subtotal.toFixed(2)}</strong></td>
        </tr>
        <tr>
          <td><strong>GST (${gstRate}%):</strong></td>
          <td style="text-align: right;"><strong>₹${gst.toFixed(2)}</strong></td>
        </tr>
        ${discount > 0 ? `
        <tr>
          <td><strong>Discount:</strong></td>
          <td style="text-align: right;"><strong>-₹${discount.toFixed(2)}</strong></td>
        </tr>
        ` : ''}
        ${Math.abs(roundOff) >= 0.01 ? `
        <tr>
          <td><strong>Round Off:</strong></td>
          <td style="text-align: right;"><strong>${roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</strong></td>
        </tr>
        ` : ''}
        <tr class="grand-total">
          <td>TOTAL DUE:</td>
          <td style="text-align: right;">₹${total.toFixed(2)}</td>
        </tr>
      </table>

      <div class="payment-box">
        PAYMENT: ${paymentMethod} | STATUS: ${paymentStatus}
      </div>

      <div class="footer">
        <div>Thank you for dining with us!</div>
        <div style="margin-top: 3px; font-weight: 900;">Please Visit Again</div>
      </div>
    </body>
    </html>
  `;

  return executePrint(html);
};
