document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Store user session in browser
            sessionStorage.setItem('user', JSON.stringify(data.user));

            // Redirect based on Role
            if (data.user.role === 'admin') {
                window.location.href = 'admin.html';
            } else if (data.user.role === 'cashier') {
                window.location.href = 'index.html'; // Cashier page
            } else if (data.user.role === 'kitchen') {
                window.location.href = 'kitchen.html';
            }
        } else {
            errorMsg.textContent = data.message;
            errorMsg.classList.remove('d-none');
        }
    })
    .catch(err => {
        console.error(err);
        errorMsg.textContent = "Server Error";
        errorMsg.classList.remove('d-none');
    });
});