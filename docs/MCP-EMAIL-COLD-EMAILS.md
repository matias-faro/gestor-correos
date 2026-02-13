# MCP de email para cold emails

Se añadió el servidor MCP **mcp-email-server** (ai-zerolab) a tu configuración global de Cursor (`~/.cursor/mcp.json`). Permite enviar correos desde el chat usando tu cuenta de correo (Gmail, Outlook, etc.).

## Requisitos

- **Python 3.10+** y **uv** (recomendado) o **pip**
- Si no tenés `uv`: `curl -LsSf https://astral.sh/uv/install.sh | sh`  
  O podés usar `pip install mcp-email-server` y en `mcp.json` cambiar a:  
  `"command": "python", "args": ["-m", "mcp_email_server", "stdio"]`

## Configuración (obligatoria)

1. **Abrir la UI de configuración** (solo la primera vez):
   ```bash
   uvx mcp-email-server@latest ui
   ```
   Se abre una interfaz en el navegador para cargar:
   - Email y contraseña (para Gmail usar [Contraseña de aplicación](https://myaccount.google.com/apppasswords))
   - IMAP/SMTP (Gmail: imap.gmail.com / smtp.gmail.com, puertos 993 y 465)

2. **Reiniciar Cursor** para que cargue el MCP.

3. En un chat, podés pedir que envíe los cold emails; el agente usará las herramientas del MCP (p. ej. `send_email`).

## Incluir tu CV en los correos

- **Si el MCP permite adjuntos al enviar**: cuando redactemos los correos, indicá la ruta a tu archivo CV (PDF) y los incluiré como adjunto.
- **Si no** (muchos MCPs solo permiten descargar adjuntos, no enviarlos): la opción más segura es:
  1. Subir tu CV a **Google Drive** (o Dropbox), dar “compartir → cualquiera con el enlace”.
  2. Poner ese enlace en el cuerpo del correo en cada cold email.

Cuando tengas el MCP configurado y reiniciado Cursor, decime y armamos los ~10 cold emails; si querés probar con adjunto primero, avisá y vemos si la herramienta lo soporta.
