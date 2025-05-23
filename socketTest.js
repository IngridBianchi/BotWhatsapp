const io = require("socket.io-client");

// Conectar al servidor de socket.io
const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("Conectado al servidor con ID:", socket.id);

    // Emitir un evento de prueba para iniciar una sesión
    const clientId = `test-session-${Date.now()}`;
    console.log(`Iniciando sesión con clientId: ${clientId}`);
    socket.emit("start-bot", { authCode: "test-auth-code", clientId });

    // Escuchar el evento 'qr'
    socket.on("qr", ({ clientId: id, image }) => {
        console.log(`Evento 'qr' recibido para clientId: ${id}`);
        console.log(`Imagen QR recibida: ${image}`);
    });

    // Escuchar logs del servidor
    socket.on("log", (message) => {
        console.log(`Log del servidor: ${message}`);
    });
});

socket.on("disconnect", () => {
    console.log("Desconectado del servidor.");
});