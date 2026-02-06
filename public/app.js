const socket = io(); // Connect to WebSocket Server
let cart = [];
let products = [];

// 1. Load Products on Startup
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/products')
        .then(res => res.json())
        .then(data => {
            products = data;
            renderProducts(products);
        });
});

// 2. Render Product Grid
function renderProducts(list) {
    const container = document.getElementById('product-list');
    container.innerHTML = '';
    
    list.forEach(prod => {
        const isOutOfStock = prod.stock_quantity <= 0;
        const pointerEvent = isOutOfStock ? 'none' : 'auto';
        const opacity = isOutOfStock ? '0.6' : '1';
        
        const card = `
            <div class="col-md-4 col-lg-3 col-product" data-cat="${prod.category}">
                <div class="product-card p-3 h-100 d-flex flex-column" 
                     style="pointer-events: ${pointerEvent}; opacity: ${opacity}"
                     onclick="addToCart(${prod.id})">
                    <div class="product-img-placeholder rounded mb-3">
                        ${isOutOfStock ? '<span class="badge bg-danger">Out of Stock</span>' : '<i class="bi bi-image fs-1"></i>'}
                    </div>
                    <h6 class="fw-bold mb-1">${prod.name}</h6>
                    <small class="text-muted">${prod.stock_quantity} available</small>
                    <div class="mt-auto d-flex justify-content-between align-items-center pt-2">
                        <h5 class="text-primary m-0">$${prod.price}</h5>
                        <div class="btn btn-sm btn-light rounded-circle text-primary"><i class="bi bi-plus"></i></div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += card;
    });
}

// 3. Add to Cart Logic
function addToCart(id) {
    const product = products.find(p => p.id === id);
    // Safety check: ensure product exists and has stock
    if (!product || product.stock_quantity <= 0) return;

    // Check if we already have this item in cart
    const existingItem = cart.find(item => item.id === id);

    // Check against available stock (Client side check)
    const currentQtyInCart = existingItem ? existingItem.quantity : 0;
    if (currentQtyInCart >= product.stock_quantity) {
        alert("Max stock reached for this item!");
        return;
    }

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
}

// 4. Update Cart UI (FIXED)
function updateCartUI() {
    const cartList = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const btn = document.getElementById('btn-checkout');
    
    // Note: We removed 'cart-count' from the HTML, so we don't try to select it anymore.

    cartList.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        cartList.innerHTML = `
            <div class="text-center text-muted mt-5">
                <i class="bi bi-basket3 fs-1"></i>
                <p>Cart is empty</p>
            </div>`;
    }

    cart.forEach((item, index) => {
        total += item.price * item.quantity;

        // New cleaner layout for cart items
        const div = document.createElement('div');
        div.className = 'd-flex justify-content-between align-items-center mb-3 p-2 border-bottom';
        div.innerHTML = `
            <div>
                <h6 class="m-0 fw-bold">${item.name}</h6>
                <small class="text-muted">${item.quantity} x $${item.price}</small>
            </div>
            <div class="d-flex align-items-center gap-3">
                <span class="fw-bold text-dark">$${(item.price * item.quantity).toFixed(2)}</span>
                <button class="btn btn-sm text-danger p-0" onclick="removeFromCart(${index})">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </div>
        `;
        cartList.appendChild(div);
    });

    totalEl.textContent = `$${total.toFixed(2)}`;
    btn.disabled = cart.length === 0;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

// 5. Checkout
document.getElementById('btn-checkout').addEventListener('click', () => {
    const customerName = document.getElementById('customerName').value || 'Guest';
    const totalAmount = parseFloat(document.getElementById('cart-total').textContent.replace('$', ''));

    if(cart.length === 0) return;

    const orderData = {
        customer_name: customerName,
        total_amount: totalAmount,
        items: cart
    };

    // Disable button to prevent double clicks
    document.getElementById('btn-checkout').disabled = true;
    document.getElementById('btn-checkout').innerText = 'Processing...';

    fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
    })
    .then(res => res.json())
    .then(response => {
        document.getElementById('btn-checkout').disabled = false;
        document.getElementById('btn-checkout').innerText = 'Charge Payment';

        if (response.error) {
            alert('Error: ' + response.error); 
        } else {
            // SUCCESS
            showReceipt(response.orderId, customerName, totalAmount, cart);
            
            // Clear Cart
            cart = []; 
            updateCartUI();
            document.getElementById('customerName').value = '';
            
            // Refresh products to show new stock levels
            fetch('/api/products').then(res => res.json()).then(data => {
                products = data;
                renderProducts(products);
            });
        }
    })
    .catch(err => {
        alert('System Error');
        document.getElementById('btn-checkout').disabled = false;
    });
});

// 6. Receipt Modal
function showReceipt(orderId, customer, total, items) {
    document.getElementById('receipt-date').innerText = new Date().toLocaleString();
    document.getElementById('receipt-customer').innerText = customer;
    document.getElementById('receipt-total-disp').innerText = '$' + total.toFixed(2);

    const container = document.getElementById('receipt-items-list');
    container.innerHTML = '<table class="table table-sm table-borderless"><tbody>';
    
    let rows = '';
    items.forEach(item => {
        rows += `
            <tr>
                <td>${item.name}</td>
                <td class="text-end">${item.quantity}</td>
                <td class="text-end">$${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `;
    });
    container.innerHTML += rows + '</tbody></table>';

    const receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    receiptModal.show();
}

// 7. Download Receipt PDF
function downloadReceiptPDF() {
    const { jsPDF } = window.jspdf;
    
    // Create a document with "Receipt" dimensions (80mm width, auto height approx)
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 200] // 80mm width is standard for thermal printers
    });

    const customer = document.getElementById('receipt-customer').innerText;
    const total = document.getElementById('receipt-total-disp').innerText;
    const date = document.getElementById('receipt-date').innerText;
    
    // -- HEADER --
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Cafeteria Name", 40, 10, { align: 'center' }); // Centered
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text("123 University Road", 40, 15, { align: 'center' });
    doc.text("Tel: +1 234 567 890", 40, 20, { align: 'center' });
    
    doc.text("------------------------------------------------", 40, 25, { align: 'center' });

    // -- META --
    doc.setFontSize(9);
    doc.text(`Date: ${date}`, 5, 32);
    doc.text(`Cust: ${customer}`, 5, 37);

    doc.text("------------------------------------------------", 40, 42, { align: 'center' });

    // -- ITEMS --
    let y = 48; // Start Y position
    
    // Get items from the table we built in showReceipt()
    // Or we can use the global 'cart' variable if it hasn't been cleared yet.
    // However, cart is cleared in checkout logic.
    // Let's scrape the HTML table for simplicity in this context:
    const rows = document.querySelectorAll('#receipt-items-list tr');
    
    doc.setFontSize(9);
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        const name = cols[0].innerText;
        const qty = cols[1].innerText;
        const price = cols[2].innerText;

        // Draw Item Name
        doc.text(name, 5, y);
        // Draw Qty
        doc.text(qty, 55, y, { align: 'right' });
        // Draw Price
        doc.text(price, 75, y, { align: 'right' });
        
        y += 6; // Move down
    });

    doc.text("------------------------------------------------", 40, y, { align: 'center' });
    y += 7;

    // -- TOTAL --
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${total}`, 75, y, { align: 'right' });

    y += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text("Thank you for dining with us!", 40, y, { align: 'center' });

    // Save File
    doc.save(`Receipt_${Date.now()}.pdf`);
}