document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
  
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const qrContainer = document.getElementById('qr-container');
    const qrCodeDiv = document.getElementById('qr-code');
    const failedNumbersDiv = document.getElementById('failed-numbers');
    const successfulNumbersDiv = document.getElementById('successful-numbers');
    const sessionIdInput = document.getElementById('session-id');
  
    let clientId = `session-${Date.now()}`;
  
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
      const code = urlParams.get('code') || "4/0AUJR-x4KvzWlczI35TEXYIpg9jFgIRLLHp0b2zn-pVdyp2sAri1WA5gV6Oo81m9MtaaFog";
  
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
  
    socket.on('qr', ({ sessionId, qr, clientId: idFromServer, image }) => {
      const id = sessionId || idFromServer || clientId;
      if (id !== clientId) return;
  
      qrCodeDiv.innerHTML = '';
      const img = document.createElement('img');
      img.src = qr || image;
      img.alt = `QR Code ${id}`;
      img.style.borderRadius = '8px';
      qrCodeDiv.appendChild(img);
    });
  
    socket.on('qr-clear', ({ sessionId, clientId: idFromServer }) => {
      const id = sessionId || idFromServer || clientId;
      if (id === clientId) qrCodeDiv.innerHTML = '';
    });
  
    socket.on('contacts-loaded', ({ clientId: id, count }) => {
      // Aquí actualizamos el contador si coincide la sesión o es global
      if (id === clientId || id === 'global') {
        document.getElementById('contact-count').textContent = count;
        addSystemLog(`Se obtuvieron ${count} contactos de Google`);
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
  
    loadNumbers();
  });
  