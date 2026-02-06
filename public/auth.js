// Check if user is logged in
const userSession = sessionStorage.getItem('user');

if (!userSession) {
    // Not logged in? Send back to login page
    window.location.href = 'login.html';
} 
// else {
//     const user = JSON.parse(userSession);
    
//     // Add a logout button dynamically to the page
//     document.addEventListener('DOMContentLoaded', () => {
//         const logoutBtn = document.createElement('button');
//         logoutBtn.innerText = `Logout (${user.username})`;
//         logoutBtn.className = 'btn btn-outline-danger btn-sm position-fixed top-0 end-0 m-3';
//         logoutBtn.style.zIndex = 1000;
//         logoutBtn.onclick = () => {
//             sessionStorage.removeItem('user');
//             window.location.href = 'login.html';
//         };
//         document.body.appendChild(logoutBtn);
//     });
// }