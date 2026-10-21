# Nota Redmine — ticket 15467

Para pegar en el ticket (Textile). Revisar los números de test antes de
publicar si se corre la suite completa otra vez.

---

h2. Panel de contacto Sysbrazo — implementado (ticket 15467)

Se implementó el panel de cliente de Sysbrazo en la conversación del inbox de
ChatbotX. Se activa cuando el contacto tiene el campo personalizado
`document_id` (punto de inflexión); sin ese campo no se consulta nada.

h3. Qué muestra

* Card "Cliente de Sysbrazo": identidad (avatar, documento con puntos de
  miles, ciudad, última sesión de ChatbotX), contacto (teléfono principal,
  alternativo y correo con copiar y píldoras de validación VALIDADO /
  PENDIENTE / SIN VALIDAR, incluyendo el valor propuesto pendiente),
  servicios con 9 variantes de estado (activo, por vencer, suspendido, TV,
  TV Box, addons, lead, a desinstalar, a designar cuadrilla) y estado ONU/CPE
  con botón refrescar (endpoint Krill existente).
* Card "Contacto" del chat: campos con "ver más/ver menos" (5 iniciales, +3
  por click).

h3. Cómo funciona

* Lookup contra `GET /api/botmaker/client/by-document` reutilizando URL y
  cabeceras del paso `callApi` del flujo publicado (misma fuente de
  credenciales del bot).
* URL base desde la variable global fija `SYSBRAZO_CLIENT_API_URL` (valor por
  entorno; admite variables anidadas como `{{LOCAL_URL}}`). Se crea sola al
  crear un workspace y por migración en los existentes; solo se configura el
  valor.
* Actualización en vivo: cuando el flujo guarda `document_id`, el panel
  aparece sin recargar la página (evento realtime `contactCustomFieldChanged`).

h3. Pendientes

* Desplegar los cambios del repo Sysbrazo a dev (payload ampliado:
  email, alternativo, validaciones, balance, TV boxes, instalaciones,
  addons). Sin ese deploy, el panel solo muestra los campos que ya expone el
  endpoint actual.
* Flujo Bienvenida: pedir el documento solo si el contacto aún no lo tiene.
* Fase 2: captura manual del documento por el asesor (pregunta publicada
  previamente en este ticket).

h3. Pruebas

* ChatbotX builder: 97 tests pasando. Business: 1621 pasando.
* Sysbrazo: 14 tests de Krill pasando.
* Clientes de prueba: documento 95896589 (validaciones pendientes) y
  350349712 (sin validaciones).

Fuera de este ticket: Autodiagnóstico y Tickets (#15466), Notas (#15465),
Multimedia (#15468).
