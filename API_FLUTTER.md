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
  "password": "123456"
}
```
**Respuesta:**
```json
{
  "ok": true,
  "token": "<jwt>",
  "user": { "uid": "...", "username": "daniel", "email": "...", "role": "user", "plan": "free", "avatar": "" }
}
```
> El token tiene una duración de 2h. Guardarlo localmente para usarlo en el header de los endpoints protegidos.

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
GET /api/auth/renew
```
**Header:** `Authorization: Bearer <token>` (requerido)

**Respuesta:** igual que register — devuelve un token nuevo.

> Llamar antes de que expire el token (cada ~1h45min) para mantener la sesión activa sin pedir login de nuevo.

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
      "active": true
    }
  ]
}
```
> El `_id` de cada tema es lo que se manda al crear preguntas y al generar el quiz con topicTags. El `topicTag` (string) es lo que se manda en el body de calificar.

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
    "avatar": "https://...",
    "currentStreak": 5,
    "maxStreak": 12
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
      "username": "maria",
      "avatar": "https://...",
      "nivel": 23,
      "rango": "Conocedor",
      "xpSemana": 1240,
      "quizzes": 18,
      "esMiPosicion": false
    }
  ],
  "yo": {
    "position": 14,
    "username": "daniel",
    "avatar": "",
    "nivel": 7,
    "rango": "Aprendiz",
    "xpSemana": 380,
    "quizzes": 6,
    "esMiPosicion": true
  },
  "vecinos": [
    { "position": 12, "username": "carlos", "xpSemana": 415, "esMiPosicion": false },
    { "position": 13, "username": "ana", "xpSemana": 400, "esMiPosicion": false },
    { "position": 15, "username": "luis", "xpSemana": 350, "esMiPosicion": false }
  ]
}
```
**Cómo mostrarlo en Flutter:**
- `top` → podio con avatares para los 3 primeros + lista del resto.
- `yo` → posición fija del usuario (viene `null` si aún no ganó XP esta semana — mostrar "¡Juega un quiz para entrar al ranking!").
- `vecinos` → los rivales directos (2 arriba y 2 abajo). Ideal para mensajes tipo *"Te faltan 35 XP para alcanzar a @carlos"* (`vecinos` arriba tuyo tienen `position` menor).
- Con `semana.fin` se puede mostrar la cuenta regresiva ("El ranking cierra en 2 días").

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
```
