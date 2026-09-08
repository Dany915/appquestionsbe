# API Reference — App Flutter (rol: user)

Base URL: `http://<host>:4000`

Todos los endpoints protegidos requieren el header:
```
Authorization: Bearer <token>
```

El token se obtiene al registrarse, iniciar sesión o usar Google Sign-In.

---

## AUTH

### Registrarse
```
POST /api/auth/register
```
**Body:**
```json
{
  "username": "daniel",
  "email": "daniel@gmail.com",
  "password": "123456",
  "utcOffsetMin": -300
}
```
> **`utcOffsetMin`** (opcional pero recomendado): zona horaria del dispositivo en minutos — en Dart `DateTime.now().timeZoneOffset.inMinutes` (Colombia: `-300`). Se acepta en **register, login, google** (body) y **renew** (query). El backend la usa para saber cuándo empieza el "día" del usuario: sin ella, la racha y el tope diario de XP se cortaban a las 7 pm hora Colombia (medianoche UTC). Si no se envía, se asume Colombia.

**Respuesta:**
```json
{
  "ok": true,
  "token": "<jwt>",
  "user": {
    "uid": "...",
    "username": "daniel",
    "displayName": "daniel",
    "proximoCambioNombre": null,
    "email": "...",
    "role": "user",
    "plan": "free",
    "avatar": "",
    "avatarTipo": "inicial",
    "avatarId": null,
    "cursoActivo": null
  }
}
```
> El token tiene una duración de 2h. Guardarlo localmente para usarlo en el header de los endpoints protegidos.

> **`username` vs `displayName`:** `username` es el identificador único e inmutable (para usuarios de Google se genera solo, ej. `saraymosquera`). **En la app se muestra siempre `displayName`**, nunca `username`. `displayName` ya llega resuelto: si el usuario no ha elegido un nombre, es igual a `username` — Flutter no tiene que hacer ningún fallback. Se cambia con `PUT /api/auth/display-name` (ver abajo).
> `proximoCambioNombre` → fecha ISO a partir de la cual puede volver a cambiar el nombre; `null` = puede cambiarlo ahora.

---

### Iniciar sesión
```
POST /api/auth/login
```
**Body:**
```json
{
  "email": "daniel@gmail.com",
  "password": "123456"
}
```
**Respuesta:** igual que register.

> Si la cuenta fue creada con Google, el backend devuelve un error indicando que use el botón de Google.

---

### Login con Google
```
POST /api/auth/google
```
**Body:**
```json
{
  "token": "<ID token de Google obtenido con google_sign_in en Flutter>"
}
```
**Respuesta:** igual que register.

> Si el usuario no existe se crea automáticamente. Si ya existía con email se vincula el Google ID.

---

### Renovar token
```
GET /api/auth/renew?utcOffsetMin=-300
```
**Header:** `Authorization: Bearer <token>` (requerido)

**Respuesta:** igual que register — devuelve un token nuevo.

> Llamar antes de que expire el token (cada ~1h45min) para mantener la sesión activa sin pedir login de nuevo. Como se llama en cada arranque, es donde se refresca `utcOffsetMin` (por si el usuario cambió de zona horaria).

---

### Cambiar nombre visible
```
PUT /api/auth/display-name
```
**Header:** `Authorization: Bearer <token>` (requerido)

**Body:**
```json
{
  "displayName": "Saray Mosquera"
}
```
**Respuesta:**
```json
{
  "ok": true,
  "msg": "Nombre actualizado.",
  "user": { "...igual que register, con el displayName nuevo y proximoCambioNombre actualizado..." }
}
```

Cambia solo el nombre que se muestra (`displayName`). El `username` no se toca. El nombre nuevo aparece de inmediato en dashboard, ranking y perfil público — no hay que llamar a nada más.

**Reglas** (las valida el servidor; en Flutter conviene reflejarlas en el campo de texto):
- 3 a 20 caracteres. Se recortan espacios al inicio/final y se colapsan los espacios repetidos.
- Solo letras (con tildes y ñ), números, espacios y `_ . -`.
- No puede contener enlaces ni palabras reservadas (`admin`, `soporte`, `oficial`, `moderador`...).
- **Se puede cambiar una vez cada 7 días.** El primer cambio siempre está permitido.

**Errores:**
| Código | Cuándo | Respuesta |
|---|---|---|
| `400` | Nombre inválido o igual al actual | `{ "ok": false, "msg": "El nombre debe tener entre 3 y 20 caracteres." }` |
| `403` | Aún no pasaron los 7 días | `{ "ok": false, "msg": "Solo puedes cambiar tu nombre una vez cada 7 días.", "proximoCambioNombre": "2026-09-12T23:18:24.661Z" }` |

> En la pantalla de configuración: si `user.proximoCambioNombre` viene con fecha, mostrar el campo deshabilitado con "Podrás cambiarlo el <fecha>". Si viene `null`, habilitado.

---

## AVATARES
> Todos requieren `Authorization: Bearer <token>`.

El usuario elige qué mostrar como avatar: su **foto de Google**, sus **iniciales** o una **ilustración del catálogo**. Las ilustraciones viven en la app (`assets/avatar/`); el backend solo guarda el id.

**Cómo pintar un avatar.** Todas las respuestas que llevan usuario (login, renew, dashboard, ranking, perfil público) traen los mismos tres campos, **ya resueltos** — la app no decide nada:

| Campo | Valores | Qué pintar |
|---|---|---|
| `avatarTipo` | `google` · `inicial` · `catalogo` | de dónde sale el avatar |
| `avatar` | URL o `""` | la foto de Google, solo cuando `avatarTipo` es `google` |
| `avatarId` | `"zorro/zorro_gafas"` o `null` | la ilustración, solo cuando `avatarTipo` es `catalogo` |

El id es la ruta del archivo dentro de `assets/avatar/` sin extensión: `avatarId: "zorro/zorro_gafas"` → `Image.asset('assets/avatar/zorro/zorro_gafas.webp')`. Si la app recibe un id que no tiene (usuario con una versión más nueva), debe caer a las iniciales.

> `avatar` conserva el significado de siempre (URL de Google o vacío), así las versiones de la app que no conocen `avatarId` siguen funcionando: ven foto o iniciales.

### Mis avatares
```
GET /api/avatars
```
**Respuesta:**
```json
{
  "ok": true,
  "avatar": "",
  "avatarTipo": "catalogo",
  "avatarId": "zorro/zorro_gafas",
  "fotoGoogle": "https://lh3.googleusercontent.com/...",
  "desbloqueados": [],
  "pendientes": [],
  "categorias": { "zorro": "Zorro", "gato": "Gato rosa" },
  "catalogo": [
    { "id": "zorro/zorro_default", "nombre": "Zorro",      "categoria": "zorro", "acceso": "free",  "disponible": true },
    { "id": "zorro/zorro_gafas",   "nombre": "Zorro cool", "categoria": "zorro", "acceso": "logro", "condicion": "Próximamente", "disponible": true },
    { "id": "gato/gatorosa_default", "nombre": "Gato rosa", "categoria": "gato", "acceso": "free",  "disponible": true },
    { "id": "gato/gatorosa_gorra", "nombre": "Gato con gorra", "categoria": "gato", "acceso": "logro", "condicion": "Próximamente", "disponible": false }
  ]
}
```
- `avatar` / `avatarTipo` / `avatarId` → lo que lleva puesto ahora, igual que en el resto de endpoints.
- `fotoGoogle` → la foto de Google aunque no la lleve puesta. Si viene vacía, el selector no ofrece la opción "Mi foto de Google".
- `catalogo` → todos los avatares, agrupados por `categoria` (el título de cada grupo está en `categorias`). `disponible: false` → se muestra en gris con su `condicion`. Hoy solo los `default` de cada personaje son gratuitos (`zorro_default`, `gatorosa_default`, `dragon_default_01`, `dragon_default_02`); el resto son desbloqueables y traen `condicion: "Próximamente"` hasta que tengan logro asignado.
- `acceso` → `free` (todos), `pro` (se otorga al activar el plan pro) o `logro`. Lo desbloqueado **no se quita nunca**, aunque el plan caduque.
- `pendientes` → avatares recién desbloqueados que aún no se han celebrado. Tras mostrarlos, llamar a `POST /api/avatars/vistos`.

### Cambiar avatar
```
PUT /api/avatars/equipar
```
**Body:**
```json
{ "avatarTipo": "catalogo", "avatarId": "zorro/zorro_gafas" }
```
| `avatarTipo` | Qué hace | `avatarId` |
|---|---|---|
| `auto` | Foto de Google si la tiene; si no, iniciales. Es el estado inicial de todo usuario. | se ignora |
| `inicial` | Iniciales, aunque tenga foto de Google | se ignora |
| `catalogo` | La ilustración indicada | requerido |

**Respuesta:**
```json
{ "ok": true, "msg": "Avatar actualizado.", "avatar": "", "avatarTipo": "catalogo", "avatarId": "zorro/zorro_gafas" }
```
Los tres campos vienen resueltos: con ellos se actualiza el usuario en memoria sin volver a llamar a nada. El cambio se ve al instante en dashboard, ranking y perfil público.

**Errores:** `400` avatar inexistente o `avatarTipo` inválido · `403` avatar no desbloqueado (`{ "msg": "Aún no has desbloqueado ese avatar." }`).

### Marcar avisos como vistos
```
POST /api/avatars/vistos
```
**Body:** `{ "avatars": ["gato/gatorosa_gafas"] }` — sin body vacía toda la cola. Igual que `POST /api/frames/vistos`.

---

## TEMAS Y MÓDULOS

### Listar módulos disponibles
```
GET /api/topic/modulos
```
**Query params opcionales:**
- `?active=true` — solo módulos con temas activos (recomendado)

**Respuesta:**
```json
{
  "ok": true,
  "count": 3,
  "modules": [
    { "moduleTag": "modulo_1", "moduleTagLabel": "Módulo 1" },
    { "moduleTag": "modulo_2", "moduleTagLabel": "Módulo 2" }
  ]
}
```
> Usar para mostrar la lista de módulos al usuario antes de seleccionar temas.

---

### Listar temas de un módulo
```
GET /api/topic?moduleTag=modulo_1
```
**Query params:**
- `moduleTag` — requerido
- `?active=true` — solo temas activos (recomendado)

**Respuesta:**
```json
{
  "ok": true,
  "moduleTag": "modulo_1",
  "count": 5,
  "topics": [
    {
      "_id": "664a1f...",
      "moduleTag": "modulo_1",
      "moduleTagLabel": "Módulo 1",
      "topicTag": "mod_1_ley_1105",
      "label": "Ley 1105",
      "descripcion": "Regula el uso del espectro radioeléctrico y sus concesiones.",
      "active": true
    }
  ]
}
```
> El `_id` de cada tema es lo que se manda al crear preguntas y al generar el quiz con topicTags. El `topicTag` (string) es lo que se manda en el body de calificar.

> **`descripcion` es opcional** (máx. 300 caracteres): breve resumen de lo que trata el tema. Los temas que no la tienen **no incluyen la clave** en la respuesta — no llega como cadena vacía. En Flutter tratar ausente, `null` y `""` como "sin descripción". Se muestra al mantener pulsada la tarjeta del tema.

---

## QUIZ

### Generar quiz
```
GET /api/quiz
```
**Header:** `Authorization: Bearer <token>` (requerido)

**Query params (enviar uno de los dos):**
- `?topicTags=mod_1_ley_1105,mod_1_ley_1106` — uno o varios temas separados por coma
- `?moduleTag=modulo_1` — todos los temas activos del módulo

**Query params opcionales:**
- `?nivel=curioso` — nivel de dificultad (default: `curioso`)
- `?count=10` — cantidad de preguntas (default: `10`). **Free: 1 a 20 · Pro: 1 a 50.**

> Si un usuario free pide `count` mayor a 20, el backend responde **403** con `upgradeRequired: true` (igual que con el nivel Genio). En el selector de cantidad de Flutter, mostrar las opciones grandes (30, 40, 50) con candado 🔒 para usuarios free.
> El mismo límite aplica al calificar: un free no puede enviar más de 20 respuestas en un `POST /api/quiz/calificar`.

**Niveles disponibles y sus tipos cognitivos:**
| Nivel | Tipos de preguntas | Plan |
|---|---|---|
| `curioso` | literal, comprensión | free y pro |
| `analitico` | aplicación | free y pro |
| `estratega` | análisis, mejor respuesta | free y pro |
| `genio` | síntesis, mejor respuesta | **solo pro** 🔒 |

> **Nivel Genio (solo pro):** si un usuario free pide `?nivel=genio`, el backend responde **403** con `upgradeRequired: true`:
> ```json
> { "ok": false, "upgradeRequired": true, "msg": "El nivel Genio es exclusivo del plan Pro. Mejora tu plan para desbloquearlo." }
> ```
> En Flutter: mostrar el nivel Genio **visible pero con candado** en el selector de dificultad — que se vea lo que se pierde vende más que ocultarlo. Al tocarlo, abrir la pantalla de upgrade.
> El fallback también lo respeta: a un usuario free que pida `estratega` nunca le llegan preguntas de `genio` para completar el quiz.

**Respuesta:**
```json
{
  "ok": true,
  "nivel": "curioso",
  "requested": 10,
  "returned": 10,
  "distribucion": { "curioso": 8, "analitico": 2 },
  "fallback": true,
  "questions": [
    {
      "_id": "664a1f...",
      "text": "¿Cuál es el objeto de la Ley 1105?",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "topicTag": "664b2a...",
      "difficulty": 1,
      "tipo": "literal"
    }
  ]
}
```
> **Importante:** la respuesta **no incluye `correctIndex` ni `feedback`** — se revelan al calificar.
> Si `fallback: true` significa que no había suficientes preguntas del nivel pedido y se completaron del siguiente nivel. El campo `distribucion` muestra cuántas vinieron de cada nivel.

---

### Calificar quiz
```
POST /api/quiz/calificar
```
**Header:** `Authorization: Bearer <token>` (requerido)

**Body:**
```json
{
  "answers": [
    { "questionId": "664a1f...", "selectedIndex": 2 },
    { "questionId": "664b2a...", "selectedIndex": 0 }
  ],
  "nivel": "curioso",
  "topicTags": ["mod_1_ley_1105", "mod_1_ley_1106"],
  "moduleTag": "modulo_1",
  "timeTakenSecs": 180
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `answers` | Array | Sí | Lista de respuestas |
| `answers[].questionId` | String (MongoId) | Sí | `_id` de la pregunta |
| `answers[].selectedIndex` | Number (≥ 0) | Sí | Índice de la opción elegida |
| `nivel` | String | No | Nivel del quiz generado |
| `topicTags` | String[] | No | topicTag strings del quiz |
| `moduleTag` | String | No | Módulo del quiz si aplica |
| `timeTakenSecs` | Number (≥ 0) | No | Segundos que tardó el usuario |

**Respuesta:**
```json
{
  "ok": true,
  "nivel": "curioso",
  "totalAnswered": 10,
  "totalGraded": 10,
  "correct": 7,
  "scorePercent": 70,
  "timeTakenSecs": 180,
  "timeTakenFormatted": "3:00",
  "difficultyAvg": 1.4,
  "xp": {
    "ganada": 43,
    "aplicada": 43,
    "desglose": {
      "respuestasCorrectas": 28,
      "quizCompletado": 10,
      "scoreAlto": 5,
      "perfecto": 0
    },
    "multiplicadorScore": 1,
    "limiteDiarioAlcanzado": false,
    "limiteIntentosAlcanzado": false,
    "intentosConXpRestantes": 3,
    "plan": "free"
  },
  "progreso": {
    "nivel": 7,
    "rango": "Aprendiz",
    "xpTotal": 560,
    "xpEnNivel": 35,
    "xpParaSubir": 175,
    "progressPercent": 20,
    "subioNivel": true,
    "nivelAnterior": 6,
    "subioRango": false,
    "rangoAnterior": "Aprendiz"
  },
  "results": [
    {
      "questionId": "664a1f...",
      "text": "¿Cuál es el objeto de la Ley 1105?",
      "selectedIndex": 2,
      "correctIndex": 2,
      "isCorrect": true,
      "feedback": "La Ley 1105 regula...",
      "calificada": true
    },
    {
      "questionId": "664b2a...",
      "isCorrect": false,
      "calificada": false,
      "msg": "Esta pregunta fue desactivada y no se califica."
    }
  ]
}
```
> Este endpoint guarda el intento en la base de datos y actualiza automáticamente la racha y la XP del usuario. No hace falta llamar a nada más después.

**Sobre `xp` y `progreso`:**
- `xp.ganada` es lo que generó el quiz; `xp.aplicada` es lo que realmente se sumó (puede ser menor si se alcanzó un límite diario).
- `limiteIntentosAlcanzado: true` → el usuario **free** agotó sus intentos con XP del día. Puede seguir jugando pero gana 0 XP. **Momento ideal para ofrecer el plan pro.**
- `intentosConXpRestantes` → cuántos intentos con XP le quedan hoy (`null` = ilimitado, plan pro).
- `multiplicadorScore` → 0 si el score fue < 40%, 0.4 entre 40-69%, 1 desde 70%.
- Si `progreso.subioNivel` es `true`, mostrar animación de subida de nivel (`nivelAnterior` → `nivel`).
- Si `progreso.subioRango` es `true`, mostrar celebración de nuevo rango (`rangoAnterior` → `rango`).
- `progressPercent` es el % de la barra de progreso hacia el siguiente nivel.
- En el nivel máximo, `xpParaSubir` llega como `null` y la barra queda al 100%. **No mostrar al usuario cuál es el nivel máximo.**

---

## ESTADÍSTICAS GLOBALES
> Estos endpoints son públicos — no requieren token.

### Temas más difíciles
```
GET /api/stats/temas-dificiles?limit=10
```
**Respuesta:**
```json
{
  "ok": true,
  "count": 5,
  "topics": [
    {
      "topicId": "664a1f...",
      "label": "Ley 1105",
      "moduleTag": "modulo_1",
      "totalAnswers": 320,
      "successRate": 34.5
    }
  ]
}
```
> Ordenados de menor a mayor `successRate`. Solo incluye temas con al menos 5 respuestas.

---

### Tiempo promedio por nivel
```
GET /api/stats/tiempo-por-nivel
```
**Respuesta:**
```json
{
  "ok": true,
  "stats": [
    {
      "nivel": "curioso",
      "avgTimeSecs": 210,
      "avgTimeFormatted": "3:30",
      "avgScore": 74.2,
      "totalAttempts": 150
    },
    {
      "nivel": "analitico",
      "avgTimeSecs": 340,
      "avgTimeFormatted": "5:40",
      "avgScore": 61.8,
      "totalAttempts": 89
    }
  ]
}
```

---

## ESTADÍSTICAS DEL USUARIO
> Todos requieren `Authorization: Bearer <token>`.

### Dashboard personal
```
GET /api/user-stats/dashboard
```
**Respuesta:**
```json
{
  "ok": true,
  "user": {
    "username": "daniel",
    "displayName": "Dany",
    "avatar": "https://...",
    "avatarTipo": "google",
    "avatarId": null,
    "currentStreak": 5,
    "maxStreak": 12,
    "marcoEquipado": null
  },
  "racha": {
    "jugoHoy": false,
    "enRiesgo": true,
    "expiraEn": "2026-09-09T05:00:00.000Z"
  },
  "progreso": {
    "nivel": 7,
    "rango": "Aprendiz",
    "xpTotal": 560,
    "xpEnNivel": 35,
    "xpParaSubir": 175,
    "progressPercent": 20
  },
  "stats": {
    "totalIntentos": 42,
    "totalPreguntas": 380,
    "tiempoTotal": 7560,
    "tiempoTotalFormateado": "2h 6m",
    "avgScore": 71.3,
    "bestScore": 100,
    "nivelFavorito": "curioso"
  }
}
```

**Sobre la racha:**
- `user.currentStreak` es la **racha real**: viene `0` si ya se perdió, aunque el usuario no haya vuelto a jugar. Los días se cuentan en la zona horaria del dispositivo (`utcOffsetMin`).
- `racha.jugoHoy` → si ya hizo un intento hoy.
- `racha.enRiesgo` → tiene racha viva pero hoy no ha jugado. Pintar la llama apagada / avisar.
- `racha.expiraEn` → instante (ISO, UTC) en que se pierde si no juega antes. `null` si no tiene racha.
- La app usa `currentStreak` + `jugoHoy` para programar los **recordatorios locales** (`StreakReminderService`): 20:00 hora local hoy si está en riesgo, y mañana/pasado por si no vuelve a abrir la app. Se reprograman en cada carga del dashboard, sin servidor.

---

### Nivel y rango del usuario
```
GET /api/user-stats/nivel
```
**Respuesta:**
```json
{
  "ok": true,
  "progreso": {
    "nivel": 7,
    "rango": "Aprendiz",
    "xpTotal": 560,
    "xpEnNivel": 35,
    "xpParaSubir": 175,
    "progressPercent": 20
  }
}
```
> Para la pantalla de perfil. El mismo objeto `progreso` viene también en el dashboard y al calificar un quiz.

---

## SISTEMA DE NIVELES Y RANGOS

La XP se gana **solo al calificar un quiz** (`POST /api/quiz/calificar`):

| Acción | XP |
|---|---|
| Respuesta correcta dificultad 1 | **3 XP** |
| Respuesta correcta dificultad 2 | **4 XP** |
| Respuesta correcta dificultad 3 | **6 XP** |
| Respuesta correcta dificultad 4 | **8 XP** |
| Completar un quiz (≥ 5 preguntas calificadas y score ≥ 70%) | **+10 XP** |
| Score ≥ 80% | **+5 XP** |
| Score 100% (perfecto) | **+10 XP** adicionales |

> La dificultad es la **real de cada pregunta** (calculada en el servidor) — un quiz de máxima dificultad rinde ~2.7x más XP que uno básico.

**Puerta de score (anti-farming):**

| Score final | XP ganada |
|---|---|
| < 40% | **0 XP** (responder al azar no da nada) |
| 40% – 69% | Solo el **40%** de la XP base, sin bonus |
| ≥ 70% | XP completa + bonus |

**Diferencias por plan:**

| Plan | Intentos con XP por día | Tope de XP por día | Niveles de dificultad | Preguntas por quiz |
|---|---|---|---|---|
| `free` | **5** (después gana 0 XP, puede seguir jugando) | 500 XP | curioso, analitico, estratega | 1 a 20 |
| `pro` | Ilimitados | 1000 XP | todos + **genio** 🔒 | 1 a 50 🔒 |

> Solo los intentos que **sí ganaron XP** consumen cupo — fallar un quiz no gasta intentos del plan free.

- Curva: subir del nivel `n` al `n+1` cuesta `25 × n` XP (nivel 1→2: 25 XP; nivel 10→11: 250 XP).
- Nivel máximo: **50** (⚠️ no mostrarlo en la app — el usuario solo ve su nivel, su XP y su rango).

**Rangos (uno cada 5 niveles)** — para asignar insignias/iconos en Flutter:

| Niveles | Rango |
|---|---|
| 1-4 | Novato |
| 5-9 | Aprendiz |
| 10-14 | Explorador |
| 15-19 | Estudioso |
| 20-24 | Conocedor |
| 25-29 | Erudito |
| 30-34 | Maestro |
| 35-39 | Gran Maestro |
| 40-44 | Sabio |
| 45-50 | Leyenda |

---

### Ranking semanal de XP
```
GET /api/user-stats/ranking-semanal?limit=10
```
**Query params opcionales:**
- `?limit=10` — tamaño del top, máximo 50 (default: 10)

La semana va de **lunes a domingo (UTC)** y el ranking se reinicia automáticamente cada lunes — no hay que llamar a nada para resetearlo.

**Respuesta:**
```json
{
  "ok": true,
  "semana": {
    "inicio": "2026-07-06T00:00:00.000Z",
    "fin": "2026-07-13T00:00:00.000Z"
  },
  "totalParticipantes": 87,
  "top": [
    {
      "position": 1,
      "uid": "664a1f...",
      "username": "maria",
      "displayName": "María G.",
      "avatar": "",
      "avatarTipo": "catalogo",
      "avatarId": "zorro/zorro_gafas",
      "nivel": 23,
      "rango": "Conocedor",
      "xpSemana": 1240,
      "quizzes": 18,
      "esMiPosicion": false
    }
  ],
  "yo": {
    "position": 14,
    "uid": "664b2a...",
    "username": "daniel",
    "displayName": "Dany",
    "avatar": "",
    "avatarTipo": "inicial",
    "avatarId": null,
    "nivel": 7,
    "rango": "Aprendiz",
    "xpSemana": 380,
    "quizzes": 6,
    "esMiPosicion": true
  },
  "vecinos": [
    { "position": 12, "uid": "664c3b...", "username": "carlos", "displayName": "carlos", "nivel": 9, "rango": "Aprendiz", "xpSemana": 415, "quizzes": 7, "esMiPosicion": false },
    { "position": 13, "uid": "664d4c...", "username": "ana", "displayName": "Ana Pérez", "nivel": 8, "rango": "Aprendiz", "xpSemana": 400, "quizzes": 6, "esMiPosicion": false },
    { "position": 15, "uid": "664e5d...", "username": "luis", "displayName": "luis", "nivel": 6, "rango": "Aprendiz", "xpSemana": 350, "quizzes": 5, "esMiPosicion": false }
  ]
}
```
**Cómo mostrarlo en Flutter:**
- `top` → lista con los 3 primeros destacados (mayor tamaño y aro dorado/plata/bronce) + el resto en tamaño uniforme.
- `yo` → posición fija del usuario (viene `null` si aún no ganó XP esta semana — mostrar "¡Juega un quiz para entrar al ranking!").
- `vecinos` → los rivales directos (2 arriba y 2 abajo). Ideal para mensajes tipo *"Te faltan 35 XP para alcanzar a Ana Pérez"* (`vecinos` arriba tuyo tienen `position` menor).
- **Mostrar siempre `displayName`**, nunca `username`. Como no es único, dos jugadores pueden tener el mismo `displayName` — el `uid` es lo que los distingue.
- Con `semana.fin` se puede mostrar la cuenta regresiva ("El ranking cierra en 2 días").
- `uid` → id del jugador: se usa para abrir su **perfil público** al tocar la fila (ver endpoint siguiente).

> Todas las filas (`top`, `yo` y `vecinos`) tienen la misma estructura.

---

### Perfil público de otro usuario
```
GET /api/user-stats/perfil/:uid
```
**Header:** `Authorization: Bearer <token>` (requerido)

El `uid` sale de cualquier fila del ranking semanal. Sirve para abrir el perfil de otro jugador al tocarlo en el ranking.

**Respuesta:**
```json
{
  "ok": true,
  "user": {
    "uid": "664a1f...",
    "username": "maria",
    "displayName": "María G.",
    "avatar": "",
    "avatarTipo": "catalogo",
    "avatarId": "gato/gatorosa_gorra",
    "currentStreak": 12,
    "maxStreak": 30,
    "marcoEquipado": null
  },
  "progreso": {
    "nivel": 23,
    "rango": "Conocedor",
    "xpTotal": 6200,
    "xpEnNivel": 120,
    "xpParaSubir": 575,
    "progressPercent": 21
  },
  "stats": {
    "totalIntentos": 84,
    "totalPreguntas": 720,
    "tiempoTotal": 15400,
    "tiempoTotalFormateado": "4h 16m",
    "avgScore": 78.4,
    "bestScore": 100
  },
  "porNivel": [
    {
      "nivel": "curioso",
      "totalIntentos": 40,
      "avgScore": 82.1,
      "bestScore": 100,
      "avgTimeSecs": 185,
      "avgTimeFormatted": "3:05"
    }
  ]
}
```

> **Privacidad:** solo devuelve datos públicos. **Nunca** incluye email, rol ni plan. Si el usuario no existe o su cuenta está desactivada responde **404**.
> `porNivel` siempre trae los 4 niveles de dificultad (con ceros los que no ha jugado), igual que `/por-nivel`.

---

### Rendimiento por tema
```
GET /api/user-stats/por-tema
```
**Respuesta:**
```json
{
  "ok": true,
  "count": 8,
  "topics": [
    {
      "topicId": "664a1f...",
      "label": "Ley 1105",
      "moduleTag": "modulo_1",
      "moduleTagLabel": "Módulo 1",
      "totalAnswers": 40,
      "correctAnswers": 14,
      "successRate": 35.0
    }
  ]
}
```
> Ordenados de peor a mejor `successRate` — el primer tema es el que más necesita repasar.

---

### Rendimiento por nivel
```
GET /api/user-stats/por-nivel
```
**Respuesta:**
```json
{
  "ok": true,
  "stats": [
    {
      "nivel": "curioso",
      "totalIntentos": 20,
      "avgScore": 78.5,
      "bestScore": 100,
      "avgTimeSecs": 195,
      "avgTimeFormatted": "3:15"
    },
    {
      "nivel": "analitico",
      "totalIntentos": 0,
      "avgScore": 0,
      "bestScore": 0,
      "avgTimeSecs": 0,
      "avgTimeFormatted": "0:00"
    }
  ]
}
```
> Siempre devuelve los 4 niveles aunque el usuario no haya jugado en alguno (con valores en 0).

---

### Evolución en el tiempo
```
GET /api/user-stats/evolucion?limit=20
```
**Query params opcionales:**
- `?limit=20` — cantidad de intentos a devolver, máximo 50 (default: 20)

**Respuesta:**
```json
{
  "ok": true,
  "count": 20,
  "attempts": [
    {
      "date": "2026-05-01T14:30:00.000Z",
      "scorePercent": 60,
      "nivel": "curioso",
      "timeTakenSecs": 210,
      "timeTakenFormatted": "3:30",
      "correct": 6,
      "totalGraded": 10
    },
    {
      "date": "2026-05-02T10:15:00.000Z",
      "scorePercent": 75,
      "nivel": "curioso",
      "timeTakenSecs": 185,
      "timeTakenFormatted": "3:05",
      "correct": 9,
      "totalGraded": 12
    }
  ]
}
```
> Ordenados del más antiguo al más reciente para usarlos directamente como puntos en una gráfica de línea (eje X = fecha, eje Y = scorePercent).

---

## FLUJO TÍPICO DE LA APP

```
1. Usuario abre la app
   └── GET /api/auth/renew  →  token válido → continuar
                            →  error 401   → ir a login

2. Pantalla de login
   └── POST /api/auth/login  o  POST /api/auth/google

3. Pantalla principal
   └── GET /api/user-stats/dashboard

4. Seleccionar quiz
   ├── GET /api/topic/modulos?active=true
   └── GET /api/topic?moduleTag=modulo_1&active=true

5. Jugar
   └── GET /api/quiz?topicTags=mod_1_ley_1105&nivel=curioso&count=10

6. Terminar y calificar
   └── POST /api/quiz/calificar

7. Ver ranking semanal
   └── GET /api/user-stats/ranking-semanal

8. Tocar a otro jugador del ranking
   └── GET /api/user-stats/perfil/:uid   (el uid viene en la fila del ranking)
```
