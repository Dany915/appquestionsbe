/**
 * Convierte el formato de texto de las lecturas (contenido/lecturas/*.lectura.txt)
 * en la estructura que guarda el modelo Lectura.
 *
 * Es puro (sin BD) para poder probarlo y para que la importación sea
 * reproducible: el .lectura.txt revisado a mano es la fuente de verdad.
 *
 * ─── Formato ────────────────────────────────────────────────────────────────
 *
 * Cabecera (antes de la primera sección):
 *   @lectura     sena_acuerdo_12_1985
 *   @titulo      Acuerdo N° 12 de 1985
 *   @descripcion Frase corta para la tarjeta
 *   @temas       mod_2_und_tec_sena, otro_tema
 *   @orden       1
 *   @fuente      Nombre visible | https://url
 *   @consultado  2026-09-13
 *   @vigencia    modificada | Texto de la advertencia
 *   @aviso       Texto del aviso legal
 *   @correccion  texto original => texto corregido | motivo
 *
 * Cuerpo:
 *   @seccion slug | Título | Rango (ej: Arts. 1–7)
 *   # Encabezado principal          (Capítulo I)
 *   ## Encabezado secundario        (nombre del capítulo, CONSIDERANDO)
 *   @art 3° | Epígrafe. | texto     (el texto es opcional)
 *   @par Parágrafo: | texto         (el texto es opcional)
 *   1. elemento / 1° / a. / -       (elemento de lista con su marca original)
 *   @nota texto                     (nota editorial: no es parte de la norma)
 *   @firmas                         (líneas siguientes: nombre y cargos,
 *                                    una línea en blanco separa firmantes)
 *   cualquier otra línea            (párrafo; "\" al inicio fuerza párrafo)
 *
 * La sangría (2 espacios por nivel) indica anidación: elementos o parágrafos
 * que pertenecen al numeral de arriba.
 */

const PALABRAS_POR_MINUTO = 180;

// Aviso, no error: más largo que esto cansa en una pantalla de móvil.
const MAX_PALABRAS_SECCION = 1200;

const TAG_VALIDO = /^[a-z0-9_-]+$/;

// "1." y "a." exigen espacio detrás para no confundirse con texto normal;
// "1°", "-" y "•" no, porque la fuente a veces los pega a la palabra.
const MARCA_ITEM = /^(\d+\.(?=\s)|[a-z]\.(?=\s)|\d+[°º]|-|•)\s*(.+)$/;

const VIGENCIAS = ['vigente', 'modificada', 'derogada', 'historica', 'sin_verificar'];

class LecturaMarkupError extends Error {
    constructor(linea, msg) {
        super(`Línea ${linea}: ${msg}`);
        this.linea = linea;
    }
}

const campos = (resto) => resto.split('|').map((c) => c.trim());

const contarPalabras = (texto) => {
    const t = String(texto || '').trim();
    return t ? t.split(/\s+/).length : 0;
};

/** Todo el texto legible de un bloque, en orden (incluye marcas y números). */
const textoDeBloque = (b) => {
    switch (b.tipo) {
        case 'encabezado':
        case 'parrafo':
        case 'nota':
            return b.texto;
        case 'item':
            return `${b.marca} ${b.texto}`;
        case 'articulo':
            return ['Artículo', b.numero, b.epigrafe, b.texto].filter(Boolean).join(' ');
        case 'paragrafo':
            return [b.marca, b.texto].filter(Boolean).join(' ');
        case 'firmas':
            return b.firmantes.map((f) => [f.nombre, ...f.cargos].join(' ')).join(' ');
        default:
            return '';
    }
};

/**
 * Texto de la norma tal como aparece en la lectura, sin lo editorial
 * (títulos de sección, rangos y notas). Sirve para comprobar que no se
 * ha cambiado nada respecto a la fuente.
 */
const textoNormativo = (lectura) =>
    lectura.secciones
        .flatMap((s) => s.bloques)
        .filter((b) => b.tipo !== 'nota')
        .map(textoDeBloque)
        .join('\n');

/** Ancla estable de un artículo: "3°" → "art-3", "11." → "art-11". */
const anclaArticulo = (numero) => {
    const n = String(numero).match(/\d+/);
    return n ? `art-${n[0]}` : null;
};

const parsearCabecera = (lectura, directiva, resto, nLinea) => {
    switch (directiva) {
        case 'lectura':
            if (!TAG_VALIDO.test(resto)) {
                throw new LecturaMarkupError(nLinea, `lecturaTag inválido "${resto}" (solo a-z, 0-9, _ y -).`);
            }
            lectura.lecturaTag = resto;
            break;
        case 'titulo':
            lectura.titulo = resto;
            break;
        case 'descripcion':
            lectura.descripcion = resto;
            break;
        case 'temas':
            lectura.topicTags = resto.split(',').map((t) => t.trim()).filter(Boolean);
            break;
        case 'orden': {
            const n = Number(resto);
            if (!Number.isInteger(n) || n < 0) {
                throw new LecturaMarkupError(nLinea, '@orden debe ser un entero ≥ 0.');
            }
            lectura.orden = n;
            break;
        }
        case 'fuente': {
            const [nombre, url] = campos(resto);
            lectura.fuentes.push({ nombre, url: url || null });
            break;
        }
        case 'consultado':
            if (!/^\d{4}-\d{2}-\d{2}$/.test(resto)) {
                throw new LecturaMarkupError(nLinea, '@consultado debe tener formato AAAA-MM-DD.');
            }
            lectura.consultado = resto;
            break;
        case 'vigencia': {
            const [estado, nota] = campos(resto);
            if (!VIGENCIAS.includes(estado)) {
                throw new LecturaMarkupError(nLinea, `@vigencia debe ser uno de: ${VIGENCIAS.join(', ')}.`);
            }
            lectura.vigencia = { estado, nota: nota || '' };
            break;
        }
        case 'aviso':
            lectura.aviso = resto;
            break;
        case 'correccion': {
            const [cambio, motivo] = campos(resto);
            const partes = cambio.split('=>').map((p) => p.trim());
            if (partes.length !== 2 || !partes[0] || !partes[1]) {
                throw new LecturaMarkupError(nLinea, '@correccion debe tener la forma "original => corregido | motivo".');
            }
            lectura.correcciones.push({ original: partes[0], corregido: partes[1], motivo: motivo || '' });
            break;
        }
        default:
            return false;
    }
    return true;
};

/**
 * @param {string} fuente contenido del .lectura.txt
 * @returns {{ lectura: object, avisos: string[] }}
 */
const parsearLectura = (fuente) => {
    const lectura = {
        lecturaTag: null,
        titulo: null,
        descripcion: '',
        topicTags: [],
        orden: 0,
        fuentes: [],
        consultado: null,
        vigencia: { estado: 'sin_verificar', nota: '' },
        aviso: '',
        correcciones: [],
        secciones: [],
    };
    const avisos = [];
    const slugs = new Set();
    const anclas = new Set();

    let seccion = null;
    let firmas = null; // bloque de firmas abierto
    let firmante = null;

    const lineas = String(fuente).replace(/^﻿/, '').split(/\r?\n/);

    lineas.forEach((original, i) => {
        const nLinea = i + 1;
        const sinFinal = original.replace(/\s+$/, '');

        // ─── Firmas: bloque que dura hasta la siguiente directiva ─────────────
        if (firmas && !sinFinal.trimStart().startsWith('@')) {
            const t = sinFinal.trim();
            if (!t) {
                firmante = null;
            } else if (!firmante) {
                firmante = { nombre: t, cargos: [] };
                firmas.firmantes.push(firmante);
            } else {
                firmante.cargos.push(t);
            }
            return;
        }
        firmas = null;
        firmante = null;

        if (!sinFinal.trim()) return;

        const sangria = sinFinal.match(/^ */)[0].length;
        if (sangria % 2 !== 0) {
            throw new LecturaMarkupError(nLinea, 'La sangría debe ser múltiplo de 2 espacios.');
        }
        const nivel = sangria / 2;
        const linea = sinFinal.trim();

        // ─── Directivas ───────────────────────────────────────────────────────
        const dir = linea.match(/^@([a-z]+)\s*(.*)$/);
        if (dir) {
            const [, directiva, resto] = dir;

            if (!seccion && parsearCabecera(lectura, directiva, resto, nLinea)) return;

            if (directiva === 'seccion') {
                const [slug, titulo, rango] = campos(resto);
                if (!slug || !TAG_VALIDO.test(slug)) {
                    throw new LecturaMarkupError(nLinea, `slug de sección inválido "${slug}".`);
                }
                if (slugs.has(slug)) throw new LecturaMarkupError(nLinea, `slug repetido "${slug}".`);
                if (!titulo) throw new LecturaMarkupError(nLinea, `la sección "${slug}" no tiene título.`);
                if (seccion && seccion.bloques.length === 0) {
                    throw new LecturaMarkupError(nLinea, `la sección "${seccion.slug}" está vacía.`);
                }
                slugs.add(slug);
                seccion = { slug, titulo, rango: rango || '', bloques: [] };
                lectura.secciones.push(seccion);
                return;
            }

            if (!seccion) {
                throw new LecturaMarkupError(nLinea, `directiva "@${directiva}" desconocida o fuera de una sección.`);
            }

            switch (directiva) {
                case 'art': {
                    const [numero, epigrafe, texto] = campos(resto);
                    const ancla = anclaArticulo(numero);
                    if (!ancla) throw new LecturaMarkupError(nLinea, `@art sin número: "${resto}".`);
                    if (anclas.has(ancla)) throw new LecturaMarkupError(nLinea, `artículo repetido (${ancla}).`);
                    anclas.add(ancla);
                    seccion.bloques.push({
                        tipo: 'articulo', ancla, numero,
                        epigrafe: epigrafe || '', texto: texto || '',
                    });
                    return;
                }
                case 'par': {
                    const [marca, texto] = campos(resto);
                    seccion.bloques.push({ tipo: 'paragrafo', marca: marca || 'Parágrafo:', texto: texto || '', nivel });
                    return;
                }
                case 'nota':
                    seccion.bloques.push({ tipo: 'nota', texto: resto });
                    return;
                case 'firmas':
                    firmas = { tipo: 'firmas', firmantes: [] };
                    seccion.bloques.push(firmas);
                    return;
                default:
                    throw new LecturaMarkupError(nLinea, `directiva "@${directiva}" desconocida.`);
            }
        }

        if (!seccion) {
            throw new LecturaMarkupError(nLinea, 'hay texto antes de la primera @seccion.');
        }

        // ─── Encabezados, elementos y párrafos ────────────────────────────────
        const enc = linea.match(/^(#{1,2})\s+(.+)$/);
        if (enc) {
            seccion.bloques.push({ tipo: 'encabezado', nivel: enc[1].length, texto: enc[2] });
            return;
        }

        if (linea.startsWith('\\')) {
            seccion.bloques.push({ tipo: 'parrafo', texto: linea.slice(1).trim(), nivel });
            return;
        }

        const item = linea.match(MARCA_ITEM);
        if (item) {
            seccion.bloques.push({ tipo: 'item', marca: item[1], texto: item[2], nivel });
            return;
        }

        seccion.bloques.push({ tipo: 'parrafo', texto: linea, nivel });
    });

    // ─── Validación final y totales ───────────────────────────────────────────
    if (!lectura.lecturaTag) throw new LecturaMarkupError(0, 'falta @lectura.');
    if (!lectura.titulo) throw new LecturaMarkupError(0, 'falta @titulo.');
    if (lectura.topicTags.length === 0) throw new LecturaMarkupError(0, 'falta @temas.');
    if (lectura.secciones.length === 0) throw new LecturaMarkupError(0, 'la lectura no tiene secciones.');
    const ultima = lectura.secciones[lectura.secciones.length - 1];
    if (ultima.bloques.length === 0) {
        throw new LecturaMarkupError(0, `la sección "${ultima.slug}" está vacía.`);
    }

    lectura.secciones.forEach((s, i) => {
        s.orden = i + 1;
        s.palabras = s.bloques.reduce((n, b) => n + contarPalabras(textoDeBloque(b)), 0);
        s.minutos = Math.max(1, Math.round(s.palabras / PALABRAS_POR_MINUTO));
        if (s.palabras > MAX_PALABRAS_SECCION) {
            avisos.push(`La sección "${s.slug}" tiene ${s.palabras} palabras (máx. recomendado ${MAX_PALABRAS_SECCION}).`);
        }
        // Una lista en línea sin separar ("... 1. Uno 2. Dos") se lee mal.
        for (const b of s.bloques) {
            if (b.tipo === 'parrafo' && /\s\d+[.,]\s[A-ZÁÉÍÓÚ]/.test(b.texto)) {
                avisos.push(`Posible lista sin separar en "${s.slug}": "${b.texto.slice(0, 60)}…"`);
            }
        }
    });

    lectura.totalPalabras = lectura.secciones.reduce((n, s) => n + s.palabras, 0);
    lectura.minutosLectura = Math.max(1, Math.round(lectura.totalPalabras / PALABRAS_POR_MINUTO));

    return { lectura, avisos };
};

/** Quita todo espacio: la comparación de fidelidad ignora saltos y sangrías. */
const compactar = (texto) => String(texto).replace(/\s+/g, '');

/**
 * Aplica las correcciones declaradas al texto fuente (ya compactado).
 * Devuelve las que no encontraron coincidencia, que indican un error en la
 * lista de correcciones.
 */
const aplicarCorrecciones = (fuenteCompacta, correcciones) => {
    let texto = fuenteCompacta;
    const sinCoincidencia = [];
    for (const c of correcciones) {
        const original = compactar(c.original);
        if (!texto.includes(original)) {
            sinCoincidencia.push(c.original);
            continue;
        }
        texto = texto.split(original).join(compactar(c.corregido));
    }
    return { texto, sinCoincidencia };
};

module.exports = {
    parsearLectura,
    textoNormativo,
    textoDeBloque,
    compactar,
    aplicarCorrecciones,
    LecturaMarkupError,
    PALABRAS_POR_MINUTO,
    VIGENCIAS,
};
