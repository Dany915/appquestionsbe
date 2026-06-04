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
  "user": { "uid": "...", "username": "daniel", "email": "...", "role": "user", "avatar": "" }
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
- `?count=10` — cantidad de preguntas, entre 1 y 50 (default: `10`)

**Niveles disponibles y sus tipos cognitivos:**
| Nivel | Tipos de preguntas |
|---|---|
| `curioso` | literal, comprensión |
| `analitico` | aplicación |
| `estratega` | análisis, mejor respuesta |
| `genio` | síntesis, mejor respuesta |

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
> Este endpoint guarda el intento en la base de datos y actualiza automáticamente la racha del usuario. No hace falta llamar a nada más después.

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

### Racha más larga (leaderboard)
```
GET /api/stats/racha?limit=10
```
**Respuesta:**
```json
{
  "ok": true,
  "count": 10,
  "ranking": [
    {
      "position": 1,
      "username": "daniel",
      "avatar": "https://...",
      "currentStreak": 12,
      "maxStreak": 30
    }
  ]
}
```

---

### Mayor eficiencia (score + rapidez)
```
GET /api/stats/eficiencia?nivel=curioso&limit=10
```
**Query params opcionales:**
- `?nivel=curioso` — filtrar por nivel específico (sin este param muestra el top global)
- `?limit=10`

**Respuesta:**
```json
{
  "ok": true,
  "count": 10,
  "ranking": [
    {
      "position": 1,
      "username": "daniel",
      "avatar": "https://...",
      "scorePercent": 100,
      "timeTakenSecs": 95,
      "timeTakenFormatted": "1:35",
      "nivel": "curioso"
    }
  ]
}
```
> Un resultado por usuario. Primero ordena por mayor score, luego por menor tiempo entre los que tienen el mismo score.

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

7. Ver leaderboard
   ├── GET /api/stats/racha
   └── GET /api/stats/eficiencia?nivel=curioso
```
