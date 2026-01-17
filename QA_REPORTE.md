# QA Reporte - Gestor de Correos (Prod)

Fecha: 2026-01-16  
Entorno: `https://gestor-correos.vercel.app/`  
Alcance: QA end-to-end con datos `[QA]` y **envío real solo a** `matiboldrini7811@gmail.com`.

## Datos de QA creados

- Contacto: `matiboldrini7811@gmail.com` (Nombre: Matias, Apellido: Boldrini QA, Empresa: `[QA] FAROandes`, Cargo: `[QA] Test 2`)
- Tag: `[QA] Tipo`
- Plantilla: `[QA] Template`
- Campaña: `[QA] Campaña test` (filtro por empresa `[QA] FAROandes`, 1 destinatario)
- Estado actual del contacto QA: **Desuscrito** (por prueba de /u/[token])

## Funcionalidades probadas (resumen)

- Auth + navegación + dashboard: OK
- Contactos: CRUD (crear/editar), filtros por tags/empresa/cargo, include desuscritos: OK
- Tags: crear/seleccionar: OK
- Plantillas: crear/preview/editar: OK con observaciones
- Campañas: crear, snapshot, excluir/incluir draft, iniciar envío: OK
- QStash send-tick: envío real completado (sent=1): OK
- Unsubscribe público: OK (marca desuscrito)
- Rebotes: scan ejecuta y retorna "sin rebotes": OK
- Settings: abrir modales y leer valores: OK con observaciones

## Bugs y problemas detectados

Severidad: Bloqueante / Alta / Media / Baja

1. ~~Alta — **Botón "Enviar prueba real" no hace nada**~~ ✅ CORREGIDO

   - Dónde: detalle de campaña `[QA] Campaña test`.
   - Paso: clic en "Enviar prueba real".
   - Resultado: no aparece modal ni feedback; no se envía email de prueba.
   - Esperado: modal para ingresar emails o envío directo.
   - **Fix aplicado:** Agregado `type="button"` explícito al botón para evitar comportamiento de submit implícito.

2. ~~Media — **Botón "Incluir contacto" sin acción**~~ ✅ CORREGIDO

   - Dónde: detalle de campaña.
   - Paso: clic en "Incluir contacto".
   - Resultado: no se abre modal ni selector; sin feedback.
   - Esperado: permitir incluir contacto manual.
   - **Fix aplicado:** Agregado `type="button"` explícito al botón.

3. ~~Media — **Campaña no pasa a "Completada" luego de enviar todo**~~ ✅ CORREGIDO

   - Dónde: campaña `[QA] Campaña test`.
   - Paso: iniciar campaña, esperar >60s (min delay 30s).
   - Resultado: estado queda en **"Enviando"** con `Pendientes=0`, `Enviados=1`.
   - Esperado: pasar a "Completada" y liberar acciones de envío.
   - **Fix aplicado:** Modificado `processSendTick` en CampaignService para verificar si quedan pendientes inmediatamente después de enviar/fallar un email. Si no hay más pendientes, completa la campaña sin esperar al próximo tick.

4. ~~Media — **Editar plantilla no persiste el cambio de asunto**~~ ✅ CORREGIDO

   - Dónde: Plantillas → Editar `[QA] Template`.
   - Paso: cambiar asunto a `"[QA] Hola {{FirstName}} (edit)"`, guardar.
   - Resultado: toast "Plantilla actualizada", pero listado sigue mostrando el asunto anterior.
   - Esperado: el asunto actualizado debería persistir.
   - **Fix aplicado:** Agregado `await` al `loadTemplates()` para esperar el refresco, reseteo de `editingTemplate`, y agregado `cache: 'no-store'` al fetch de templates.

5. ~~Baja — **Botón "Cancelar" en modal de Límites de envío no cierra**~~ ✅ CORREGIDO

   - Dónde: Settings → "Límites de envío".
   - Paso: clic en "Cancelar".
   - Resultado: modal no cierra; cerrar con `Esc` sí funciona.
   - **Fix aplicado:** Agregado `type="button"` a todos los botones de Cancelar/Guardar en los modales de Settings.

6. ~~Baja — **Botón "Close" en preview de plantilla no responde**~~ ✅ CORREGIDO
   - Dónde: Plantillas → Previsualizar.
   - Paso: clic en "Close".
   - Resultado: no cierra; `Esc` sí funciona.
   - **Fix aplicado:** Agregado botón "Cerrar" explícito en el footer del preview de plantilla.

## Gaps vs DOCUMENTACION_SISTEMA_COMPLETA.md

1. **Enlaces a Gmail por envío**

   - En la UI no se ve el permalink de Gmail para cada envío (se pide en la doc).

2. **Firma global + override por campaña**

   - Settings permite firma default, pero en la creación de campaña no se ve override.

3. **Test send real**

   - La doc indica envío de prueba a 1+ emails. El botón actual no funciona.

4. **Gestión de rebotes detallada**
   - Hay botón “Escanear rebotes”, pero no hay vista de detalle ni acciones de supresión visibles.

## Mejoras recomendadas (prioridad)

1. ~~Arreglar el flujo de **test-send real** (modal + envío + feedback).~~ ✅ IMPLEMENTADO
2. ~~Hacer que campaña **finalice** automáticamente cuando `Pendientes=0`.~~ ✅ IMPLEMENTADO
3. ~~Corregir **persistencia** de edición de plantilla (asunto).~~ ✅ IMPLEMENTADO
4. ~~Asegurar que los **modales cierren** con botón (no solo `Esc`).~~ ✅ IMPLEMENTADO
5. Mostrar **permalink Gmail** en envíos para auditoría. (pendiente)
6. Exponer **override de firma** en campaña y visualizar firma aplicada. (pendiente)
