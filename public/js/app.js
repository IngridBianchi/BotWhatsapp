document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const qrContainer = document.getElementById('qr-container');
  
  let qrCode = null;

  startBtn.addEventListener('click', () => {
      socket.emit('start-bot');
      startBtn.disabled = true;
      stopBtn.disabled = false;
      qrContainer.classList.remove('hidden');
  });

  stopBtn.addEventListener('click', () => {
      socket.emit('stop-bot');
      startBtn.disabled = false;
      stopBtn.disabled = true;
      qrContainer.classList.add('hidden');
      if(qrCode) qrCode.clear();
  });

  socket
      .on('qr', qr => {
          if(qrCode) qrCode.clear();
          qrCode = new QRCode(document.getElementById('qr-code'), {
              text: qr,
              width: 200,
              height: 200,
              colorDark: "#25D366"
          });
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
          entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
          log.prepend(entry);
      });
});