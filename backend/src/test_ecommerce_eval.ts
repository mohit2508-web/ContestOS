import { evaluateWebDev } from './services/webDevEvaluator';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E-Commerce Checkout</title>
</head>
<body>
    <div id="cart-container">
        <h2>Shopping Cart</h2>
        <div class="item-row">
            <div>
                <h4 class="product-title">Wireless Headphones</h4>
                <span class="item-price">$100.00 each</span>
            </div>
            <div class="qty-controls">
                <button id="item1-dec" class="qty-btn" type="button">-</button>
                <span id="item1-qty">1</span>
                <button id="item1-inc" class="qty-btn" type="button">+</button>
            </div>
        </div>
        <div id="promo-container">
            <input id="promo-input" type="text" placeholder="Enter code SAVE20">
            <button id="apply-promo" type="button">Apply</button>
        </div>
        <div class="summary-row"><span>Subtotal</span><span id="subtotal-val">$100.00</span></div>
        <div class="summary-row"><span>Discount</span><span id="discount-amount">-$0.00</span></div>
        <div class="summary-row"><span>Tax (10%)</span><span id="tax-val">$10.00</span></div>
        <div class="summary-row total"><span>Grand Total</span><span id="grand-total-val">$110.00</span></div>
        <button id="checkout-btn" type="button">Place Order</button>
        <div id="order-status" aria-live="polite"></div>
    </div>
</body>
</html>`;

const css = `body {
    font-family: system-ui, sans-serif;
    background: #0f172a;
    color: #f8fafc;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
}
#cart-container {
    width: 420px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
}
.item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #334155;
}
.product-title {
    margin: 0;
}
.item-price {
    font-size: 12px;
    color: #94a3b8;
}
.qty-controls {
    display: flex;
    align-items: center;
    gap: 8px;
}
.qty-btn {
    background: #3b82f6;
    border: none;
    color: #ffffff;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
}
.qty-btn:hover {
    background: #2563eb;
}
.summary-row {
    display: flex;
    justify-content: space-between;
    margin: 8px 0;
    font-size: 14px;
    color: #94a3b8;
}
.summary-row.total {
    font-size: 18px;
    font-weight: bold;
    color: #f8fafc;
    border-top: 1px solid #334155;
    padding-top: 12px;
}
#promo-container {
    display: flex;
    gap: 8px;
    margin: 16px 0;
}
#promo-input {
    flex: 1;
    padding: 8px 12px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #ffffff;
}
#apply-promo {
    background: #10b981;
    border: none;
    color: #000000;
    font-weight: bold;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
}
#checkout-btn {
    width: 100%;
    padding: 12px;
    background: #3b82f6;
    border: none;
    border-radius: 8px;
    color: #ffffff;
    font-weight: bold;
    font-size: 16px;
    cursor: pointer;
    margin-top: 16px;
}
#checkout-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
#order-status {
    text-align: center;
    margin-top: 12px;
    color: #34d399;
    font-weight: 500;
    min-height: 20px;
}`;

const js = `let price = 100;
let qty = 1;
let discountPercent = 0;

function updateTotals() {
  const subtotal = price * qty;
  const discount = subtotal * discountPercent;
  const taxable = subtotal - discount;
  const tax = taxable * 0.10;
  const grandTotal = taxable + tax;

  const qtyEl = document.getElementById('item1-qty');
  const subtotalEl = document.getElementById('subtotal-val');
  const discountEl = document.getElementById('discount-amount');
  const taxEl = document.getElementById('tax-val');
  const grandTotalEl = document.getElementById('grand-total-val');

  if (qtyEl) qtyEl.textContent = qty;
  if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);
  if (discountEl) discountEl.textContent = '-$' + discount.toFixed(2);
  if (taxEl) taxEl.textContent = '$' + tax.toFixed(2);
  if (grandTotalEl) grandTotalEl.textContent = '$' + grandTotal.toFixed(2);
}

document.addEventListener('click', (e) => {
  const target = e.target;
  if (!target) return;

  if (target.id === 'item1-inc') {
    qty += 1;
    updateTotals();
  } else if (target.id === 'item1-dec') {
    if (qty > 1) {
      qty -= 1;
      updateTotals();
    }
  } else if (target.id === 'apply-promo') {
    const promoInput = document.getElementById('promo-input');
    if (promoInput && promoInput.value.trim() === 'SAVE20') {
      discountPercent = 0.20;
      updateTotals();
    }
  } else if (target.id === 'checkout-btn') {
    const orderStatus = document.getElementById('order-status');
    if (orderStatus) orderStatus.textContent = 'Order Placed Successfully!';
    target.disabled = true;
  }
});`;

const testCases = [
  { input: '#cart-container', expectedOutput: 'true' },
  { input: '#item1-qty.textContent', expectedOutput: '1' },
  { input: '#subtotal-val.textContent', expectedOutput: '$100.00' },
  { input: '#tax-val.textContent', expectedOutput: '$10.00' },
  { input: '#grand-total-val.textContent', expectedOutput: '$110.00' },
  { input: '#item1-inc@click => #item1-qty.textContent', expectedOutput: '2' },
  { input: '#item1-inc@click => #subtotal-val.textContent', expectedOutput: '$200.00' },
  { input: '#promo-input@value=SAVE20', expectedOutput: 'true' },
  { input: '#promo-input@value=SAVE20,#apply-promo@click => #discount-amount.textContent', expectedOutput: '~20' },
  { input: '#checkout-btn@click => #order-status.textContent', expectedOutput: '~Order Placed', isHidden: true },
  { input: '#cart-container.computed.borderRadius', expectedOutput: '16px', isHidden: true },
  { input: '#checkout-btn.computed.backgroundColor', expectedOutput: '~rgb', isHidden: true }
];

async function main() {
  const res = await evaluateWebDev({ html, css, js, testCases });
  console.log("Evaluation Summary:", res.summary);
  console.log("Rubric Grade:", res.rubric);
  console.log("Results:");
  res.results.forEach((r: any) => console.log(`  Case ${r.testCase} (${r.input}): ${r.passed ? 'PASSED' : 'FAILED (' + (r.error || r.actualOutput) + ')'}`));
}

main();
