/**
 * Estilo del nombre según la racha viva: destaca a los usuarios recurrentes
 * en el ranking y en el perfil público.
 *
 * Se calcula con la racha VISIBLE (`estadoRacha().rachaEfectiva`), así que al
 * perder la racha el nombre vuelve a la normalidad sin tareas programadas.
 *
 * El backend manda solo el id; la app decide los colores según su tema. Un id
 * que la app no conozca se pinta como un nombre normal, así que se pueden
 * añadir estilos sin romper versiones viejas.
 */

/** Umbrales en días de racha. Orden ascendente obligatorio. */
const ESTILOS_NOMBRE = [
    { id: 'plata',               dias: 7   },
    { id: 'plata_reluciente',    dias: 14  },
    { id: 'oro',                 dias: 30  },
    { id: 'oro_reluciente',      dias: 60  },
    { id: 'diamante',            dias: 100 },
    { id: 'diamante_reluciente', dias: 150 },
];

/** Id del estilo que corresponde a una racha, o null si no llega al primero. */
const estiloNombrePorRacha = (racha) => {
    let estilo = null;
    for (const e of ESTILOS_NOMBRE) {
        if (racha >= e.dias) estilo = e.id;
    }
    return estilo;
};

module.exports = { ESTILOS_NOMBRE, estiloNombrePorRacha };
