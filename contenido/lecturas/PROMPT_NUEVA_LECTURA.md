# Prompt: añadir una nueva lectura (PDF) a la app

Copia el bloque de abajo en una sesión nueva de Claude Code y completa los
datos entre `<…>`. Si no sabes el curso, módulo o tema, deja el campo como
"no sé" y el agente lo buscará en la base de datos.

---

```
Tengo un nuevo PDF para incluir como material de lectura dentro de QLearning,
igual que hicimos con el Acuerdo 12 de 1985 (Unidad Técnica SENA).

- PDF: <ruta completa del PDF>
- Curso: <cursoTag o nombre, ej. "sena">
- Módulo: <moduleTag o nombre, ej. "Módulo 2">
- Tema al que corresponde: <topicTag o nombre, ej. "Unidad Técnica SENA">

CRITERIO DE ADMISIÓN (obligatorio): QLearning tiene planes Pro. Aunque las
lecturas sean gratuitas, NO incluimos ningún documento que pueda traer
problemas con su autor por ese motivo. Solo se admiten actos oficiales
reproducibles libremente (leyes, decretos, ordenanzas, acuerdos, resoluciones
y demás actos administrativos: art. 41 de la Ley 23 de 1982). Se descarta el
documento si:
  - no es un acto oficial (manuales, guías, documentos institucionales con ©,
    libros, artículos, material de academias), aunque lo publique una entidad
    pública; o
  - tiene una licencia o términos de uso "no comercial" (p. ej. CC BY-NC,
    BY-NC-SA) o que exijan autorización para reproducirlo; o
  - su parte sustancial es contenido de terceros sin permiso.
Si un documento mezcla partes admisibles y no admisibles, pregúntame antes de
seguir solo con las admisibles. Precedente: el PEI SENA (2013) se descartó por
ser un manual con © SENA bajo CC BY-NC-SA.

Proyectos:
- Backend Node: C:\Users\Daniel\Documents\APP NODE\app_questions
- App Flutter: C:\Users\Daniel\Documents\APP FLUTTER\appquestion\app_question
  (solo local, sin git: no propongas inicializarla)

La infraestructura de lecturas YA EXISTE; no la rehagas. Revísala primero:
- backend: models/lectura.js, controllers/lectura.js, routes/lectura.js,
  helpers/lecturaMarkup.js (formato y tipos de bloque), scripts/importarLectura.js,
  test/lecturaMarkup.test.js, sección "LECTURAS" de API_FLUTTER.md
- contenido de referencia: contenido/lecturas/sena_acuerdo_12_1985.lectura.txt
  y su fuente contenido/lecturas/fuentes/acuerdo_12_1985.txt
- Flutter: lib/screens/lectura/, lib/models/lectura_model.dart,
  lib/providers/lectura_provider.dart, test/lectura_test.dart

Pasos:

1. Confirma en la BD (SOLO LECTURA, es Atlas de producción) que existen el
   curso, el módulo y el tema, y cuántas preguntas activas tiene el tema.
   Si el tema no existe, detente y pregúntame; no lo crees.

2. Lee el PDF completo (extrae el texto con pdftotext -layout -enc UTF-8 al
   scratchpad). Dime qué contiene realmente: qué normas o documentos, cuántas
   palabras y minutos aproximados. No asumas que es un solo documento.

3. Si del paso 2 ya es evidente que el documento no es un acto oficial (p. ej.
   portada de manual o guía, "©", aviso de licencia), dímelo antes de lanzar
   agentes y pregúntame si igual quiero la investigación.

   Lanza PRIMERO el agente de derechos de autor (en segundo plano) y espera su
   informe antes de planear nada:
   a) Agente de derechos de autor (general-purpose): investigar con fuentes si
      podemos reproducir el texto dentro de la app (no descargable, dividido en
      secciones). Lo primero que debe responder es el CRITERIO DE ADMISIÓN de
      arriba: ¿es un acto oficial?, ¿fue adoptado por un acto administrativo?,
      ¿tiene licencia o términos no comerciales?, ¿cuánto contenido de terceros
      tiene? Además considerar Ley 23 de 1982 (art. 41 y 91), Decisión Andina
      351, Ley 1915 de 2018, contenido de terceros en el PDF (introducciones,
      notas editoriales, logos, academias), términos de uso de las fuentes
      oficiales (Normograma SENA, SUIN-Juriscol, Función Pública, repositorio
      SENA; buscar también la copia oficial del documento y su licencia) y la
      vigencia. Recordar: la app es gratuita con plan Pro, y las lecturas siempre
      serán gratuitas. Entregar veredicto (ADMISIBLE / NO ADMISIBLE / PARCIAL),
      fundamento con enlaces, condiciones, texto de aviso sugerido y nivel de
      confianza. No modificar archivos.

   PUNTO DE CONTROL: si el veredicto es NO ADMISIBLE, detente. Resúmeme el
   motivo, no lances el agente de planeación, no crees archivos ni toques la BD,
   y da el documento por descartado. Si es PARCIAL, pregúntame antes de seguir.
   Solo si es ADMISIBLE (o apruebo seguir con la parte admisible), lanza:

   b) Agente de planeación (Plan): proponer cómo dividir ESTE documento en
      secciones usando el formato existente (.lectura.txt): lista de secciones
      con slug, título, rango y palabras/minutos (objetivo 2–7 min, máx. ~1.200
      palabras, sin cortar artículos ni numerales), tratamiento de preámbulos,
      listas, parágrafos, tablas, anexos y firmas; errores de digitalización
      candidatos a corrección (solo evidentes, los dudosos marcarlos para revisar
      contra el PDF); si el formato actual necesita algún tipo de bloque nuevo
      (p. ej. tablas o títulos de más niveles) y cómo añadirlo sin romper versiones
      viejas de la app. No escribir código ni tocar la BD.

4. Cuando termine la planeación, dame un resumen de ambos informes y pregúntame las
   decisiones pendientes (alcance: todo o por partes, anexos/tablas difíciles,
   lo que haga falta) ANTES de implementar.

5. Implementa con lo que decida:
   - Texto original en contenido/lecturas/fuentes/<nombre>.txt
   - Contenido estructurado en contenido/lecturas/<lecturaTag>.lectura.txt,
     con @fuente, @consultado, @vigencia (nota redactada por nosotros, nunca
     copiada del Normograma), @aviso de no afiliación y cada @correccion.
   - Texto normativo LITERAL: no parafrasear; solo corregir errores evidentes
     de digitalización, cada uno declarado con @correccion.
   - Pruebas en test/lecturaMarkup.test.js: estructura esperada y la prueba de
     fidelidad (el texto de la lectura coincide con la fuente salvo las
     correcciones). Verifica que la prueba falla si cambias una palabra.
   - Si hace falta un tipo de bloque nuevo: parser + API_FLUTTER.md + modelo y
     widget en Flutter + pruebas, manteniendo que los tipos desconocidos se
     ignoren.
   - Corre npm test, flutter analyze lib y flutter test.

6. Verifica en local, nunca en Atlas:
   - Simulación del importador contra Atlas (sin --aplicar) para comprobar el tema.
   - Importa con --aplicar SOLO a la BD local
     (MONGO_URI=mongodb://127.0.0.1:27017/qlearning_lecturas_prueba).
   - Revisa la app en el navegador (build web release con
     --dart-define=API_URL apuntando al backend local), en tamaño móvil:
     tarjeta en el módulo, índice, lector, botón "Aa", progreso y "Continuar".
     No escribas contraseñas en el login: prepara la sesión con un token local.

7. Termina con un resumen y PREGÚNTAME si cargo la lectura en Atlas. No ejecutes
   el importador con --aplicar contra Atlas sin mi aprobación explícita en
   esta conversación.
```
