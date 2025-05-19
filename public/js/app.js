document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const qrContainer = document.getElementById('qr-container');
    const qrCodeDiv = document.getElementById('qr-code');
    
    // Variables de estado
    let isBotRunning = false;

    // Manejar inicio del bot
    startBtn.addEventListener('click', () => {
        if (!isBotRunning) {
            socket.emit('start-bot');
            startBtn.disabled = true;
            stopBtn.disabled = false;
            qrContainer.classList.remove('hidden');
            isBotRunning = true;
        }
    });

    // Manejar detención del bot
    stopBtn.addEventListener('click', () => {
        socket.emit('stop-bot');
        resetUI();
    });

    // Reiniciar UI
    function resetUI() {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        qrContainer.classList.add('hidden');
        qrCodeDiv.innerHTML = '';
        isBotRunning = false;
    }

    // Escuchar eventos del servidor
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
            
            // Auto-scroll para nuevos mensajes
            log.scrollTop = 0;
        })
        .on('disconnect', () => {
            resetUI();
            addSystemLog('Desconectado del servidor');
        });

    // Añadir mensajes del sistema
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
});