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