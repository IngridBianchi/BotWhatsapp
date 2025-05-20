document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const qrContainer = document.getElementById('qr-container');
    const qrCodeDiv = document.getElementById('qr-code');
    const failedNumbersDiv = document.getElementById('failed-numbers');
    const successfulNumbersDiv = document.getElementById('successful-numbers');
    const googleLoginBtn = document.getElementById('google-login-btn');

    let isBotRunning = false;

    // Iniciar bot sin solicitar authCode manual
    startBtn.addEventListener('click', () => {
        if (!isBotRunning) {
            socket.emit('start-bot');
            startBtn.disabled = true;
            stopBtn.disabled = false;
            qrContainer.classList.remove('hidden');
            isBotRunning = true;
        }
    });

    stopBtn.addEventListener('click', () => {
        socket.emit('stop-bot');
        resetUI();
    });

    function resetUI() {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        qrContainer.classList.add('hidden');
        qrCodeDiv.innerHTML = '';
        isBotRunning = false;
    }

    socket
        .on('qr', (qrImage) => {
            qrCodeDiv.innerHTML = '';
            const img = document.createElement('img');
            img.src = qrImage;
            img.alt = 'QR Code para vincular WhatsApp';
            img.style.borderRadius = '8px';
            qrCodeDiv.appendChild(img);
        })
        .on('qr-clear', () => {
            qrCodeDiv.innerHTML = '';
        })
        .on('contacts-loaded', count => {
            document.getElementById('contact-count').textContent = count;
        })
        .on('message-sent', () => {
            const sentCount = document.getElementById('sent-count');
            sentCount.textContent = parseInt(sentCount.textContent) + 1;
        })
        .on('log', message => {
            const log = document.getElementById('activity-log');
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.innerHTML = `
                <span class="log-time">[${new Date().toLocaleTimeString()}]</span>
                <span class="log-message">${message}</span>
            `;
            log.prepend(entry);
            log.scrollTop = 0;
        })
        .on('disconnect', () => {
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

    // Botón para iniciar login con Google
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            const clientId = 'TU_CLIENT_ID';
            const redirectUri = 'http://localhost:3000';
            const scope = 'https://www.googleapis.com/auth/contacts.readonly';
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
            window.location.href = authUrl;
        });
    }

    // Si hay un code en la URL, obtener contactos
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        fetch('http://localhost:3000/auth/google/callback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                console.log('✅ Contactos obtenidos desde Google:', data.contacts);
                addSystemLog(`Se obtuvieron ${data.contacts.length} contactos de Google`);
    
                // Emitir el authCode al backend
                socket.emit('start-bot', { authCode: code });
    
                // Deshabilitar el botón y mostrar QR
                startBtn.disabled = true;
                stopBtn.disabled = false;
                qrContainer.classList.remove('hidden');
                isBotRunning = true;
            } else {
                console.error('Error al obtener contactos:', data.message);
            }
        })
        .catch(err => console.error('Error en la solicitud:', err));
    }
    

    loadNumbers();
});
