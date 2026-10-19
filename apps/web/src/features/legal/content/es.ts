import { LEGAL, type LegalDocument } from "../legal";

const { controller, email, minAge } = LEGAL;

export const privacy: LegalDocument = {
  title: "Política de privacidad",
  sections: [
    {
      heading: "Quién es el responsable",
      body: [
        `El responsable del tratamiento de tus datos en Trivia Ajolote es ${controller}. Para cualquier cuestión sobre privacidad puedes escribir a ${email}.`,
      ],
    },
    {
      heading: "Qué datos tratamos",
      body: [
        [
          `Datos de acceso: al entrar con Google o Discord, ese servicio nos envía tu identificador, tu email y, si los tienes, tu nombre, tu alias y tu foto de perfil. Solo usamos el alias para sugerirte un nombre de usuario.`,
          "Perfil: nombre de usuario, avatar, idioma y la fecha en que aceptaste estos textos.",
          "Actividad de juego: partidas, respuestas, puntuaciones, duelos y preguntas que ya has visto.",
          "Amigos: solicitudes enviadas y recibidas, y tu lista de amigos.",
          "Invitados: el nombre y el avatar de los jugadores que añades en una partida local en tu dispositivo.",
          "Reportes de preguntas que envíes.",
          "Avisos: los avisos dentro de la app (se borran a las 24 horas) y, solo si activas los avisos push, la suscripción de tu navegador para enviártelos.",
          "Datos técnicos: contadores de uso para evitar abusos, informes de errores (qué falló, en qué pantalla y con qué navegador y sistema) y los registros técnicos de nuestros proveedores, que pueden incluir tu dirección IP.",
        ],
      ],
    },
    {
      heading: "Para qué y con qué base legal",
      body: [
        [
          "Para prestarte el servicio (tu cuenta, las partidas, los amigos, los duelos y sus avisos): es necesario para cumplir los términos que aceptas al registrarte.",
          "Para mantener el juego seguro y justo (límites de uso, moderación de nombres, reportes): por nuestro interés legítimo en evitar abusos.",
          "Para detectar y corregir errores (informes de errores) y saber si el juego gusta (contamos, sin identificar a nadie, cuántos jugadores vuelven a jugar días después de registrarse, a partir de la actividad de juego que ya guardamos): por nuestro interés legítimo en mejorar el juego.",
          "Avisos push: solo si los activas. Puedes desactivarlos en tu perfil cuando quieras.",
        ],
        "No vendemos tus datos, no mostramos publicidad y no usamos herramientas de analítica. Si algún día las añadimos, te pediremos permiso antes.",
      ],
    },
    {
      heading: "Quién más puede verlos",
      body: [
        "Otros jugadores ven tu nombre de usuario y tu avatar (al buscarte, en sus amigos y en los duelos), y el resultado de los duelos que jugáis juntos.",
        "Para funcionar usamos proveedores que tratan los datos por encargo nuestro: Supabase (base de datos y acceso), Vercel (alojamiento web), Sentry (informes de errores, en servidores de la UE) y los servicios de avisos de tu navegador (Google, Apple o Mozilla). Google y Discord tratan tus datos de acceso según sus propias políticas.",
        "Si algún proveedor trata datos fuera del Espacio Económico Europeo, lo hace con las garantías que exige la ley, como las cláusulas contractuales tipo de la Comisión Europea o el Marco de Privacidad de Datos UE-EE. UU.",
      ],
    },
    {
      heading: "Cuánto tiempo los guardamos",
      body: [
        "Mientras tengas la cuenta. Al borrarla desde tu perfil se eliminan al momento tu perfil y todos tus datos de juego. En los duelos ya terminados de otros jugadores, tu lugar queda vacío. Las copias de seguridad se borran como máximo a los 30 días.",
      ],
    },
    {
      heading: "Tus derechos",
      body: [
        `Puedes cambiar tu nombre, avatar e idioma en tu perfil y borrar tu cuenta allí mismo. También puedes pedirnos una copia de tus datos, corregirlos, limitar u oponerte a su tratamiento o llevártelos a otro servicio, escribiendo a ${email}. Te responderemos en un plazo máximo de un mes.`,
        "Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es) o ante la autoridad de tu país.",
      ],
    },
    {
      heading: "Edad mínima",
      body: [
        `Necesitas tener al menos ${minAge} años (o la edad mínima que exija la ley de tu país, si es mayor) para crear una cuenta. Si sabemos que alguien más joven tiene una cuenta, la borraremos.`,
      ],
    },
    {
      heading: "Cookies y almacenamiento en tu dispositivo",
      body: [
        "Solo usamos lo necesario para que el juego funcione, por eso no te pedimos permiso:",
        [
          "Cookies de sesión: mantienen tu sesión iniciada.",
          "Cookie de idioma (NEXT_LOCALE) y de tamaño de texto (TEXT_SIZE): recuerdan tus preferencias.",
          "Almacenamiento local: recuerda si has desactivado los sonidos o la vibración.",
        ],
      ],
    },
    {
      heading: "Cambios en esta política",
      body: [
        "Si la cambiamos, actualizaremos la fecha de esta página. Si el cambio es importante, te avisaremos en el juego y, cuando haga falta, te pediremos que la aceptes de nuevo.",
      ],
    },
  ],
};

export const terms: LegalDocument = {
  title: "Términos de uso",
  sections: [
    {
      heading: "Qué es Trivia Ajolote",
      body: [
        `Trivia Ajolote es un juego de preguntas gratuito ofrecido por ${controller} (${email}). Al crear tu cuenta aceptas estos términos y declaras que has leído la política de privacidad.`,
        "El juego está en fase de pruebas: puede tener errores, cambiar o dejar de estar disponible temporalmente.",
      ],
    },
    {
      heading: "Tu cuenta",
      body: [
        `Necesitas tener al menos ${minAge} años (o la edad mínima que exija la ley de tu país, si es mayor). Eres responsable de lo que se haga con tu cuenta. Los invitados que añades en una partida local juegan bajo tu cuenta.`,
      ],
    },
    {
      heading: "Normas de juego limpio",
      body: [
        [
          "Elige un nombre de usuario que no sea ofensivo ni se haga pasar por otra persona.",
          "No hagas trampas ni uses programas para jugar o consultar el juego de forma automática.",
          "No intentes saturar, atacar o acceder a partes del servicio que no son para ti.",
          "Usa los reportes de preguntas de buena fe.",
        ],
        "Si incumples estas normas, podemos cambiar tu nombre de usuario, suspender tu cuenta o borrarla.",
      ],
    },
    {
      heading: "Las preguntas",
      body: [
        "Las preguntas se crean con ayuda de inteligencia artificial y se revisan, pero pueden contener errores. Si encuentras uno, repórtalo desde la propia pregunta.",
      ],
    },
    {
      heading: "Propiedad intelectual",
      body: [
        "El juego, su mascota, su diseño y sus preguntas nos pertenecen. Te damos permiso para usarlos de forma personal y no comercial mientras tengas tu cuenta.",
      ],
    },
    {
      heading: "Responsabilidad",
      body: [
        "Ofrecemos el juego tal como está y hacemos lo posible para que funcione bien, pero no podemos garantizar que esté siempre disponible ni libre de errores. Nada de esto limita los derechos que te reconoce la ley como consumidor.",
      ],
    },
    {
      heading: "Fin del servicio",
      body: [
        "Puedes borrar tu cuenta cuando quieras desde tu perfil. Si un día cerramos el juego, te avisaremos con antelación razonable.",
      ],
    },
    {
      heading: "Cambios y ley aplicable",
      body: [
        "Si cambiamos estos términos, actualizaremos la fecha de esta página y, si el cambio es importante, te pediremos que los aceptes de nuevo.",
        "Estos términos se rigen por la ley española. Si eres consumidor, puedes acudir a los tribunales de tu domicilio.",
      ],
    },
  ],
};
