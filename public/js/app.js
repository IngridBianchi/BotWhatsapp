
document.addEventListener('DOMContentLoaded', async () => {
    const socket = io();
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const qrContainer = document.getElementById('qr-container');
    const qrCodeDiv = document.getElementById('qr-code');
    const failedNumbersDiv = document.getElementById('failed-numbers');
    const successfulNumbersDiv = document.getElementById('successful-numbers');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const sessionIdInput = document.getElementById('session-id');

    let clientId = `session-${Date.now()}`;
    let googleAuthCode = null;

    // Obtener GOOGLE_AUTH_CODE desde el servidor
    try {
        const response = await fetch('/api/google-auth-code');
        const data = await response.json();
        googleAuthCode = data.googleAuthCode;
    } catch (error) {
        console.error('Error al obtener GOOGLE_AUTH_CODE:', error);
    }

    function resetUI() {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        qrCodeDiv.innerHTML = '';
        qrContainer.classList.add('hidden');
    }

    startBtn.addEventListener('click', () => {
        const inputVal = sessionIdInput?.value?.trim();
        if (inputVal) clientId = inputVal;

        const urlParams = new URLSearchParams(window.location.search);
        //const code = urlParams.get('code');
        const code = googleAuthCode ;

        if (!code) {
            alert('Debes autenticar con Google primero.');
            return;
        }

        startBtn.disabled = true;
        stopBtn.disabled = false;
        qrContainer.classList.remove('hidden');

        socket.emit('start-bot', { clientId, authCode: code });
    });

    stopBtn.addEventListener('click', () => {
        socket.emit('stop-bot', { clientId });
        resetUI();
    });

    socket.on('qr', ({ clientId: id, image }) => {
        if (id !== clientId) return;
        qrCodeDiv.innerHTML = '';
        const img = document.createElement('img');
        img.src = image;
        img.alt = `QR Code ${id}`;
        img.style.borderRadius = '8px';
        qrCodeDiv.appendChild(img);
    });

    socket.on('qr-clear', ({ clientId: id }) => {
        if (id === clientId) qrCodeDiv.innerHTML = '';
    });

    socket.on('contacts-loaded', ({ clientId: id, count }) => {
        if (id === clientId) {
            document.getElementById('contact-count').textContent = count;
        }
    });

    socket.on('message-sent', ({ clientId: id }) => {
        if (id === clientId) {
            const sentCount = document.getElementById('sent-count');
            sentCount.textContent = parseInt(sentCount.textContent) + 1;
        }
    });

    socket.on('log', message => {
        const log = document.getElementById('activity-log');
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
            <span class="log-time">[${new Date().toLocaleTimeString()}]</span>
            <span class="log-message">${message}</span>
        `;
        log.prepend(entry);
    });

    socket.on('disconnect', () => {
        resetUI();
        addSystemLog('Desconectado del servidor');
    });

    function addSystemLog(message) {
        const log = document.getElementById('activity-log');
        const entry = document.createElement('div');
        entry.className = 'log-entry system';
        entry.innerHTML = `
            <span class="log-time">[${new Date().toLocaleTimeString()}]</span>
            <span class="log-message">⚙️ ${message}</span>
        `;
        log.prepend(entry);
    }

    async function loadNumbers() {
        const failedResponse = await fetch('/failed-numbers');
        const failedNumbers = await failedResponse.json();
        failedNumbersDiv.innerHTML = failedNumbers.map(number => `<div>${number}</div>`).join('');

        const successfulResponse = await fetch('/successful-numbers');
        const successfulNumbers = await successfulResponse.json();
        successfulNumbersDiv.innerHTML = successfulNumbers.map(number => `<div>${number}</div>`).join('');
    }

    // Detectar code tras login con Google
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        fetch('http://localhost:3000/auth/google/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                addSystemLog(`Se obtuvieron ${data.contacts.length} contactos de Google`);
            } else {
                console.error('Error al obtener contactos:', data.message);
            }
        })
        .catch(err => console.error('Error en la solicitud:', err));
    }

    loadNumbers();
});
