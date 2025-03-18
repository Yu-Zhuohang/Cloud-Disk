document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    fetch('../credentials.json')
       .then(response => response.json())
       .then(data => {
            const validUsername = data.username;
            const validPassword = data.password;

            if (username === validUsername && password === validPassword) {
                sessionStorage.setItem('isLoggedIn', 'true');
                window.location.href = '../index.html';
            } else {
                errorMessage.style.display = 'block';
            }
        })
       .catch(error => {
            console.error('读取账号密码失败:', error);
            errorMessage.style.display = 'block';
        });
});