## Diagrama
    A[Iniciar Cliente] --> B{¿Sesión guardada?}
    B -->|Sí| C[Recuperar sesión]
    B -->|No| D[Generar QR]
    C --> E[Listo para enviar]
    D --> E
    E --> F[Cargar contactos]
    F --> G[Cargar log histórico]
    G --> H[Iniciar flujo de mensajes]

## Backup
    A[Inicio] --> B[Inicializar BackupManager]
    B --> C[Programar Backups]
    C --> D{Ejecución Horaria}
    D -->|Sí| E[Crear copias .json]
    D -->|No| F[Esperar]
    E --> G[Limpiar backups antiguos]
    G --> H[Registrar en log]


# Ver últimos backups
ls -lh backups/

# Ver logs en tiempo real
tail -f backup.log

# Módulos Clave y Funcionamiento
1. Integración con Google Contacts API
Tecnologías: Google People API, OAuth 2.0, JWT
Funcionalidad:

Autenticación segura mediante Service Accounts.

Extracción de contactos con nombres y números telefónicos.

Filtrado inteligente para descartar datos incompletos.

2. Motor de Envío de Mensajes (WhatsApp)
Tecnologías: whatsapp-web.js, Puppeteer
Funcionalidad:

Autenticación vía QR para vincular dispositivos.

Envío asincrónico con delays configurables.

Personalización de mensajes usando templates.

3. Sistema de Registro y Logging
Tecnologías: JSON, File System API
Funcionalidad:

Registro persistente de números contactados.

Prevención de duplicados mediante checks en tiempo real.

Auditoría detallada con timestamps.

4. Mecanismo de Backups Automáticos
Tecnologías: Cron jobs, Node.js Scheduler
Funcionalidad:

Copias diarias en formato JSON.

Rotación automática para conservar solo los últimos 7 backups.

Restauración manual mediante CLI.

5. Manejo de Errores y Monitorización
Tecnologías: Try/Catch, Console API
Funcionalidad:

Captura de excepciones en cada capa.

Logs detallados para diagnóstico rápido.

Reintentos automáticos para fallos transitorios.