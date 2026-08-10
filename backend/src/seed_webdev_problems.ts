import prisma from './lib/prisma';
import process from 'process';

/**
 * Seeds web-dev problems for the Web Dev Playground.
 *
 * Idempotent: re-running upserts by slug and refreshes the problem's test
 * cases, so it is safe to run multiple times.
 *
 * Test Case DSL (see src/services/webDevEvaluator.ts):
 *   SELECTOR                      existence check
 *   SELECTOR.PROPERTY             read property
 *   count:SELECTOR                count of matching elements
 *   SELECTOR@ACTION               dispatch ACTION, assert success
 *   SELECTOR@ACTION => TARGET.PROPERTY   dispatch then read from TARGET
 *
 * Starter code layout matters: the frontend loader parses the HTML starter
 * with DOMParser and lifts <style>/<script> out into the CSS/JS tabs. A
 * <script> inside the starter body would run twice (once from the HTML tab,
 * once from the JS tab), so the script lives only in starterCode.js.
 */

interface WebDevSeedProblem {
  title: string;
  slug: string;
  difficulty: string;
  category: string;
  description: string;
  starterHtml: string;
  starterCss: string;
  starterJs: string;
  testCases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
}

const COUNTER_CSS = `body {
    font-family: Arial, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
    background: #f3f4f6;
}
.counter {
    background: #ffffff;
    border-radius: 12px;
    padding: 32px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
#count {
    font-size: 48px;
    font-weight: bold;
    margin: 16px 0;
    color: #1f2937;
}
button {
    font-size: 18px;
    padding: 10px 20px;
    margin: 0 8px;
    border: none;
    border-radius: 6px;
    background: #2563eb;
    color: #ffffff;
    cursor: pointer;
}
button:hover {
    background: #1d4ed8;
}
#reset {
    background: #6b7280;
}`;

const COUNTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Counter App</title>
    <style>
${COUNTER_CSS}
    </style>
</head>
<body>
    <div class="counter" id="counter">
        <h1>Counter</h1>
        <div id="count">0</div>
        <button id="decrement" type="button">-</button>
        <button id="increment" type="button">+</button>
        <button id="reset" type="button">Reset</button>
    </div>
</body>
</html>`;

const COUNTER_JS = `const countEl = document.getElementById('count');
let count = 0;

function render() {
  countEl.textContent = count;
}

document.getElementById('increment').addEventListener('click', () => {
  count += 1;
  render();
});

document.getElementById('decrement').addEventListener('click', () => {
  count -= 1;
  render();
});

document.getElementById('reset').addEventListener('click', () => {
  count = 0;
  render();
});`;

const PRODUCT_CSS = `body {
    font-family: Arial, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
    background: #eef2ff;
}
#product-card {
    width: 320px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 24px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
#product-title {
    font-size: 20px;
    font-weight: bold;
    color: #111827;
    margin: 12px 0 4px;
}
#product-price {
    font-size: 28px;
    font-weight: bold;
    color: #2563eb;
    margin: 8px 0;
}
#buy-button {
    margin-top: 16px;
    padding: 10px 24px;
    border: none;
    border-radius: 8px;
    background: #2563eb;
    color: #ffffff;
    font-size: 16px;
    cursor: pointer;
}
#buy-button:hover {
    background: #1d4ed8;
}
#status {
    margin-top: 12px;
    font-size: 14px;
    color: #059669;
    min-height: 20px;
}`;

const PRODUCT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Product Card</title>
    <style>
${PRODUCT_CSS}
    </style>
</head>
<body>
    <div id="product-card">
        <h2 id="product-title">Wireless Headphones</h2>
        <div id="product-price">$59.99</div>
        <p>Noise-cancelling, 30-hour battery life.</p>
        <button id="buy-button" type="button">Buy Now</button>
        <div id="status" aria-live="polite"></div>
    </div>
</body>
</html>`;

const PRODUCT_JS = `const buyButton = document.getElementById('buy-button');
const status = document.getElementById('status');

buyButton.addEventListener('click', () => {
  status.textContent = 'Added to cart!';
});`;

const PROBLEMS: WebDevSeedProblem[] = [
  {
    title: 'Build an Interactive Counter',
    slug: 'interactive-counter',
    difficulty: 'Easy',
    category: 'Web Dev',
    description: `## Build an Interactive Counter

Create a simple counter widget with **three buttons** and a **live display**:

- A display that shows the current count (starting at **0**).
- An **increment** button (\`#increment\`) that adds 1.
- A **decrement** button (\`#decrement\`) that subtracts 1.
- A **reset** button (\`#reset\`) that returns the count to 0.

### Required elements

| Purpose      | ID           |
| ------------ | ------------ |
| Counter card | \`#counter\`  |
| Count display | \`#count\`    |
| Increment    | \`#increment\` |
| Decrement    | \`#decrement\` |
| Reset        | \`#reset\`     |

### Hints
- Use \`document.getElementById(...)\` and \`addEventListener('click', ...)\`.
- Keep the display's text synced with a variable holding the count.
`,
    starterHtml: COUNTER_HTML,
    starterCss: COUNTER_CSS,
    starterJs: COUNTER_JS,
    testCases: [
      { input: '#count', expectedOutput: 'true' },
      { input: '#count.textContent', expectedOutput: '0' },
      { input: '#increment@click => #count.textContent', expectedOutput: '1' },
      { input: '#increment@click => #count.textContent', expectedOutput: '2' },
      { input: '#decrement@click => #count.textContent', expectedOutput: '1' },
      { input: '#reset@click => #count.textContent', expectedOutput: '0' },
      { input: 'count:#counter', expectedOutput: '1', isHidden: true },
      { input: '#increment@click => #count.textContent', expectedOutput: '1', isHidden: true },
      { input: '#decrement@click => #count.textContent', expectedOutput: '0', isHidden: true },
    ],
  },
  {
    title: 'Styled Product Card',
    slug: 'product-card',
    difficulty: 'Easy',
    category: 'Web Dev',
    description: `## Build a Styled Product Card

Create a product card for a pair of **Wireless Headphones**:

- A card container (\`#product-card\`) with a border and rounded corners.
- A product title (\`#product-title\`) — the text must contain "Wireless".
- A price (\`#product-price\`) — the text must contain "$".
- A **Buy Now** button (\`#buy-button\`) with visible text.
- Clicking the button updates a status message (\`#status\`) that contains "added".

### Styling checklist
- The title should render **bold**.
- The card corners should be rounded (\`border-radius\`).
- The buy button should have a background color.

### Hints
- Use \`addEventListener('click', ...)\` to update the status element.
- Prefer a \`<style>\` block over inline \`style=\` attributes.
`,
    starterHtml: PRODUCT_HTML,
    starterCss: PRODUCT_CSS,
    starterJs: PRODUCT_JS,
    testCases: [
      { input: '#product-card', expectedOutput: 'true' },
      { input: '#product-title.textContent', expectedOutput: '~Wireless' },
      { input: '#product-price.textContent', expectedOutput: '~$' },
      { input: '#buy-button.textContent', expectedOutput: '~Buy' },
      { input: '#buy-button@click => #status.textContent', expectedOutput: '~added' },
      { input: '#product-title.computed.fontWeight', expectedOutput: 'bold' },
      { input: 'count:#product-card', expectedOutput: '1', isHidden: true },
      { input: '#product-card.computed.borderRadius', expectedOutput: '12px', isHidden: true },
      { input: '#buy-button.computed.backgroundColor', expectedOutput: '~rgb', isHidden: true },
    ],
  },
  {
    title: 'Advanced E-Commerce Checkout Engine',
    slug: 'advanced-ecommerce-checkout-engine',
    difficulty: 'Hard',
    category: 'Web Dev',
    description: `## 🛒 Advanced E-Commerce Checkout Engine\n\nBuild a full-featured e-commerce checkout card with **dynamic cart state**, **coupon code application**, **tax/shipping calculations**, and **order placement**.\n\n### 📋 Requirements & Mandatory IDs\n\n1. **Cart Container**: Main wrapper with ID \`#cart-container\`.\n2. **Product Items**: Quantity buttons (\`#item1-inc\`, \`#item1-dec\`, \`#item1-qty\`). Initial quantity is \`1\`, price is \`$100.00\`.\n3. **Promo Code Engine**:\n   - Input field \`#promo-input\` and button \`#apply-promo\`.\n   - Entering \`SAVE20\` applies a **20% discount** to the subtotal.\n   - Output discount display \`#discount-amount\` (must show \`-$20.00\` when applied).\n4. **Totals Display**:\n   - Subtotal (\`#subtotal-val\`) — initial \`$100.00\`.\n   - Tax 10% (\`#tax-val\`) — initial \`$10.00\`.\n   - Grand Total (\`#grand-total-val\`) — initial \`$110.00\` (\`(Subtotal - Discount) + Tax\`).\n5. **Checkout Action**:\n   - Button \`#checkout-btn\`.\n   - Clicking \`#checkout-btn\` updates \`#order-status\` text to contain \`Order Placed Successfully\` and disables the checkout button.`,
    starterHtml: `<!DOCTYPE html>
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
</html>`,
    starterCss: `body {
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
}`,
    starterJs: `let price = 100;
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
});`,
    testCases: [
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
    ]
  },
  {
    title: 'Dynamic Kanban Task Board & Real-Time Search Engine',
    slug: 'dynamic-kanban-board-engine',
    difficulty: 'Hard',
    category: 'Web Dev',
    description: `## 📌 Dynamic Kanban Task Board & Real-Time Search Engine

Build an interactive team Kanban board with **column counter badges**, **modal task creation form**, **card status progression**, and **real-time title & priority filter engine**.

### 📋 Requirements & Mandatory IDs

1. **Kanban Board Container**: Main board with ID \`#kanban-board\` containing columns:
   - To Do Column (\`#col-todo\`) with list \`#list-todo\` and count badge \`#count-todo\` (initial: \`2\`).
   - In Progress Column (\`#col-progress\`) with list \`#list-progress\` and count badge \`#count-progress\` (initial: \`1\`).
   - Completed Column (\`#col-done\`) with list \`#list-done\` and count badge \`#count-done\` (initial: \`1\`).
2. **Task Cards**: Each card has class \`.task-card\` and priority attribute \`data-priority\` (\`high\`, \`medium\`, \`low\`).
3. **Card Progression**:
   - Clicking move button (\`.move-btn\`) on a card in To-Do moves it to In Progress and updates badges (\`#count-todo\` decrements, \`#count-progress\` increments).
   - Clicking move button on a card in In Progress moves it to Completed and updates badges.
4. **Modal Creation Engine**:
   - Button \`#open-modal-btn\` toggles class \`open\` on \`#task-modal\`.
   - Input \`#task-title-input\` and button \`#add-task-submit-btn\`.
   - Submitting adds a new card to \`#list-todo\` and updates badge \`#count-todo\`.
5. **Real-Time Filtering**:
   - Input \`#search-input\` filters cards whose title matches the typed text.`,
    starterHtml: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kanban Task Board</title>
</head>
<body>
    <div id="app-container">
        <header class="header">
            <h2>📌 Team Task Board</h2>
            <div class="controls-bar">
                <input id="search-input" type="text" placeholder="Search tasks by title...">
                <select id="priority-filter">
                    <option value="all">All Priorities</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                </select>
                <button id="open-modal-btn" type="button">+ New Task</button>
            </div>
        </header>

        <main id="kanban-board">
            <section class="column" id="col-todo">
                <div class="column-header">
                    <h3>To Do</h3>
                    <span class="badge" id="count-todo">2</span>
                </div>
                <div class="task-list" id="list-todo">
                    <div class="task-card" id="task-1" data-priority="high">
                        <div class="task-title">Design System UI Mockups</div>
                        <div class="task-meta">
                            <span class="tag tag-high">high</span>
                            <button id="task-1-move" class="move-btn" type="button">Move →</button>
                        </div>
                    </div>
                    <div class="task-card" id="task-2" data-priority="medium">
                        <div class="task-title">Write API Documentation</div>
                        <div class="task-meta">
                            <span class="tag tag-medium">medium</span>
                            <button id="task-2-move" class="move-btn" type="button">Move →</button>
                        </div>
                    </div>
                </div>
            </section>

            <section class="column" id="col-progress">
                <div class="column-header">
                    <h3>In Progress</h3>
                    <span class="badge" id="count-progress">1</span>
                </div>
                <div class="task-list" id="list-progress">
                    <div class="task-card" id="task-3" data-priority="high">
                        <div class="task-title">Build Authentication Service</div>
                        <div class="task-meta">
                            <span class="tag tag-high">high</span>
                            <button id="task-3-move" class="move-btn" type="button">Move →</button>
                        </div>
                    </div>
                </div>
            </section>

            <section class="column" id="col-done">
                <div class="column-header">
                    <h3>Completed</h3>
                    <span class="badge" id="count-done">1</span>
                </div>
                <div class="task-list" id="list-done">
                    <div class="task-card" id="task-4" data-priority="low">
                        <div class="task-title">Database Schema Setup</div>
                        <div class="task-meta">
                            <span class="tag tag-low">low</span>
                            <button id="task-4-move" class="move-btn" type="button">Done ✓</button>
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <div id="task-modal" class="modal-overlay">
            <div class="modal-content">
                <h3>Add New Task</h3>
                <form id="add-task-form">
                    <div class="form-group">
                        <label for="task-title-input">Task Title</label>
                        <input id="task-title-input" type="text" placeholder="Enter task title" required>
                    </div>
                    <div class="form-group">
                        <label for="task-priority-select">Priority</label>
                        <select id="task-priority-select">
                            <option value="high">High</option>
                            <option value="medium" selected>Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button id="close-modal-btn" type="button">Cancel</button>
                        <button id="add-task-submit-btn" type="button">Add Task</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</body>
</html>`,
    starterCss: `body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #0f172a;
    color: #f8fafc;
    margin: 0;
    padding: 24px;
}
#app-container {
    max-width: 1100px;
    margin: 0 auto;
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}
.controls-bar {
    display: flex;
    gap: 12px;
}
#search-input, #priority-filter {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 8px 12px;
    color: #ffffff;
}
#open-modal-btn {
    background: #3b82f6;
    border: none;
    border-radius: 8px;
    color: #ffffff;
    padding: 8px 16px;
    font-weight: bold;
    cursor: pointer;
}
#kanban-board {
    display: flex;
    gap: 20px;
}
.column {
    flex: 1;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 16px;
    min-height: 400px;
}
.column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #334155;
    padding-bottom: 12px;
    margin-bottom: 16px;
}
.column-header h3 {
    margin: 0;
}
.badge {
    background: #334155;
    color: #38bdf8;
    font-weight: bold;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 14px;
}
.task-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.task-card {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 12px;
}
.task-title {
    font-weight: 500;
    margin-bottom: 8px;
}
.task-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.tag {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 4px;
}
.tag-high { background: rgba(239, 68, 68, 0.2); color: #f87171; }
.tag-medium { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
.tag-low { background: rgba(16, 185, 129, 0.2); color: #34d399; }
.move-btn {
    background: #334155;
    border: none;
    color: #ffffff;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
}
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: none;
    justify-content: center;
    align-items: center;
}
.modal-overlay.open {
    display: flex;
}
.modal-content {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 24px;
    width: 360px;
}
.form-group {
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.form-group input, .form-group select {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 8px;
    color: #ffffff;
}
.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}
#close-modal-btn {
    background: transparent;
    border: 1px solid #334155;
    color: #94a3b8;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
}
#add-task-submit-btn {
    background: #10b981;
    border: none;
    color: #000000;
    font-weight: bold;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
}`,
    starterJs: `function updateBadges() {
  const todoCount = document.querySelectorAll('#list-todo .task-card').length;
  const progressCount = document.querySelectorAll('#list-progress .task-card').length;
  const doneCount = document.querySelectorAll('#list-done .task-card').length;

  const todoBadge = document.getElementById('count-todo');
  const progressBadge = document.getElementById('count-progress');
  const doneBadge = document.getElementById('count-done');

  if (todoBadge) todoBadge.textContent = todoCount;
  if (progressBadge) progressBadge.textContent = progressCount;
  if (doneBadge) doneBadge.textContent = doneCount;
}

function filterTasks() {
  const searchVal = (document.getElementById('search-input')?.value || '').toLowerCase();
  const priorityVal = document.getElementById('priority-filter')?.value || 'all';

  document.querySelectorAll('.task-card').forEach((card) => {
    const title = card.querySelector('.task-title')?.textContent.toLowerCase() || '';
    const priority = card.getAttribute('data-priority') || '';

    const matchesSearch = title.includes(searchVal);
    const matchesPriority = priorityVal === 'all' || priority === priorityVal;

    if (matchesSearch && matchesPriority) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

document.addEventListener('click', (e) => {
  const target = e.target;
  if (!target) return;

  if (target.id === 'open-modal-btn') {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.add('open');
  } else if (target.id === 'close-modal-btn') {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.remove('open');
  } else if (target.id === 'add-task-submit-btn') {
    const titleInput = document.getElementById('task-title-input');
    const prioritySelect = document.getElementById('task-priority-select');

    const title = titleInput?.value.trim();
    const priority = prioritySelect?.value || 'medium';

    if (title) {
      const newCard = document.createElement('div');
      newCard.className = 'task-card';
      newCard.setAttribute('data-priority', priority);
      newCard.innerHTML = \`
        <div class="task-title">\${title}</div>
        <div class="task-meta">
          <span class="tag tag-\${priority}">\${priority}</span>
          <button class="move-btn" type="button">Move →</button>
        </div>
      \`;
      document.getElementById('list-todo')?.appendChild(newCard);
      updateBadges();

      if (titleInput) titleInput.value = '';
      const modal = document.getElementById('task-modal');
      if (modal) modal.classList.remove('open');
    }
  } else if (target.classList.contains('move-btn')) {
    const card = target.closest('.task-card');
    if (!card) return;
    const parentList = card.parentElement;

    if (parentList && parentList.id === 'list-todo') {
      document.getElementById('list-progress')?.appendChild(card);
    } else if (parentList && parentList.id === 'list-progress') {
      target.textContent = 'Done ✓';
      document.getElementById('list-done')?.appendChild(card);
    }
    updateBadges();
  }
});

document.addEventListener('input', (e) => {
  if (e.target && (e.target.id === 'search-input' || e.target.id === 'priority-filter')) {
    filterTasks();
  }
});
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'priority-filter') {
    filterTasks();
  }
});`,
    testCases: [
      { input: '#kanban-board', expectedOutput: 'true' },
      { input: '#count-todo.textContent', expectedOutput: '2' },
      { input: '#count-progress.textContent', expectedOutput: '1' },
      { input: '#count-done.textContent', expectedOutput: '1' },
      { input: '#open-modal-btn@click => #task-modal.className', expectedOutput: '~open' },
      { input: '#open-modal-btn@click,#close-modal-btn@click => #task-modal.className', expectedOutput: 'modal-overlay' },
      { input: '#task-title-input@value=Build GraphQL API,#add-task-submit-btn@click => #count-todo.textContent', expectedOutput: '3' },
      { input: '#task-1-move@click => #count-todo.textContent', expectedOutput: '1' },
      { input: '#task-1-move@click => #count-progress.textContent', expectedOutput: '2' },
      { input: '#search-input@value=Write => count:.task-card:not([style*="display: none"])', expectedOutput: '1' },
      { input: '#kanban-board.computed.display', expectedOutput: 'flex' },
      { input: '.task-card.computed.borderRadius', expectedOutput: '8px', isHidden: true }
    ]
  },
];

async function main() {
  for (const p of PROBLEMS) {
    const problem = await prisma.problem.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        title: p.title,
        slug: p.slug,
        description: p.description,
        difficulty: p.difficulty,
        category: p.category,
        problemType: 'web-dev',
        evaluationStrategy: 'EXACT_MATCH',
        referenceSolution: p.starterJs,
        starterCode: {
          html: p.starterHtml,
          css: p.starterCss,
          js: p.starterJs,
        },
        isPublic: true,
        testCases: {
          create: p.testCases.map((tc, idx) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden ?? false,
            order: idx + 1,
          })),
        },
      },
    });

    // Refresh test cases so re-seeding stays in sync with the script
    await prisma.testCase.deleteMany({ where: { problemId: problem.id } });
    await prisma.testCase.createMany({
      data: p.testCases.map((tc, idx) => ({
        problemId: problem.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden ?? false,
        order: idx + 1,
      })),
    });

    const count = await prisma.testCase.count({ where: { problemId: problem.id } });
    console.log(`Seeded "${p.title}" (${problem.id}) with ${count} test cases`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
