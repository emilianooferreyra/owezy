/**
 * The app's copy in Rioplatense Spanish, the default locale. Its shape is the Dictionary type:
 * pt-BR and en must have exactly the same keys. Values with {placeholders} go through format().
 */
export const esAR = {
  meta: {
    description: "Asistente de cobros para PyMEs: cobrá en pesos o reales y recibilo en Celo, con Ripio.",
    ogAlt: "Owezy. Te deben, Owezy les cobra por vos. Cobros en pesos y reales sobre Celo y Ripio.",
    howItWorksTitle: "Cómo funciona",
    demoTitle: "Demo",
    demoDescription: "Pedile un cobro al asistente y pagalo desde el celular del cliente, con pagos simulados.",
    payTitle: "Pagar",
  },
  common: {
    language: "Idioma",
    backHome: "Volver al inicio",
    backToApp: "Volver a la app",
    tryDemo: "Probar la demo",
    howItWorks: "Ver cómo funciona",
    viewCode: "Ver el código",
  },
  notFound: {
    title: "No encontramos esta página",
    body: "Puede que el link esté mal escrito o que la página ya no exista.",
  },
  payNotFound: {
    title: "Este link de pago no existe",
    body: "Puede que esté incompleto o que el cobro ya no esté disponible. Pedile al negocio un link nuevo.",
  },
  error: {
    title: "Algo salió mal",
    body: "No pudimos cargar esta página. Probá de nuevo en unos segundos.",
    retry: "Reintentar",
  },
  landing: {
    badge: "Para PyMEs de Argentina y Brasil · Celo + Ripio",
    tagline: "Te deben. Owezy les cobra por vos.",
    intro:
      "Anotá lo que te fían, cobralo con un toque y enterate cuando te pagaron. Tu cliente paga desde su banco en su moneda; vos recibís stablecoins locales en Celo.",
    sceneOwner: "Juan se llevó 2 docenas de medialunas, 12 lucas",
    sceneNoted: "Anotado en la libreta",
    scenePaid: "💸 Juan te pagó $57.000",
    howItWorks: "Cómo funciona",
    steps: [
      { title: "Anotás", example: "“Juan se llevó medialunas, 12 lucas.”" },
      { title: "Cobrás", example: "Un toque y Juan recibe el link de pago." },
      { title: "Te avisa", example: "Cuando paga, el agente lo marca en la libreta." },
    ],
    countries: "Hoy en Argentina y Brasil",
    countriesNext: "Próximamente",
    builtWith: "Hecho con eve · Celo · Ripio",
  },
  howItWorks: {
    badge: "Agents on Open Rails · Celo + Ripio",
    title: "Un agente que cobra por tu negocio, en tu moneda",
    intro:
      "Le pedís el cobro como se lo pedirías a alguien. Tu cliente paga desde su banco, en pesos o en reales. Vos recibís wARS o wBRL en Celo, y el agente concilia cada pago para que no vuelvas a tachar una planilla.",
    problemTitle: "El problema",
    problems: [
      {
        title: "La plata llega sin contexto",
        description:
          "Entra una transferencia y tenés que averiguar quién la mandó y por qué. Con una docena de clientes, se te va la tarde.",
      },
      {
        title: "Conciliar es a mano",
        description:
          "La mayoría de las PyMEs tiene una planilla al lado del home banking y tacha cobros uno por uno. Un error es reclamarle a alguien que ya pagó.",
      },
      {
        title: "Tu cliente no va a aprender cripto",
        description:
          "Cobrar en Celo es barato e instantáneo, pero pedirle a un cliente que instale una billetera es perder la venta. Tiene que pagar como ya paga.",
      },
    ],
    stepsTitle: "Paso a paso",
    stepsIntro: "Todo pasa en un chat. El agente responde con tarjetas, no con párrafos.",
    steps: [
      {
        title: "Anotás lo que te deben",
        description:
          "«Juan se llevó 2 docenas de medialunas, 12 lucas». El agente lo anota en la libreta con add_to_ledger, y el código valida el monto antes de guardar nada.",
      },
      {
        title: "Le cobrás con un toque",
        description:
          "Desde la libreta, Cobrar junta todo lo que el cliente debe en un cobro, C-0001, con su link de pago. Si el pedido se repite en el mismo turno, devuelve el mismo cobro: nunca un duplicado.",
      },
      {
        title: "Tu cliente paga",
        description:
          "El link abre el on-ramp de Ripio: tu cliente paga desde su banco, en pesos o con Pix en reales, y tu billetera recibe wARS o wBRL en Celo.",
      },
      {
        title: "El agente mira la blockchain",
        description:
          "Lee las transferencias de wARS y wBRL que llegan a tu dirección en Celo mainnet. Para leer no necesita claves ni firma nada.",
      },
      {
        title: "Concilia y te avisa",
        description:
          "Cada transferencia se asigna al cobro pendiente con ese monto exacto y esa moneda. El cobro pasa a pagado y las dos partes reciben su comprobante. Y le podés preguntar «¿quién me debe?» cuando quieras.",
      },
    ],
    exampleTitle: "Un ejemplo con números",
    exampleIntro:
      "Una panadería tiene dos cobros pendientes. El link del ramp no lleva número de pedido, así que el monto es la única pista.",
    exampleCharges: [
      { id: "C-0001", line: "Juan Pérez · 2 docenas de medialunas", amount: "$85.000" },
      { id: "C-0002", line: "María Gómez · torta de cumpleaños", amount: "$42.500" },
    ],
    exampleMatchLead: "Llega una transferencia de 85.000 wARS.",
    exampleMatch:
      "Solo C-0001 está pendiente con ese monto exacto y se creó antes de la transferencia: pasa a pagado y Juan recibe su comprobante.",
    exampleAmbiguousLead: "Si C-0002 también fuera de $85.000,",
    exampleAmbiguous:
      "el agente no elige uno. Marca la transferencia como ambigua y te pide que la asignes vos. Un “pagado” equivocado es peor que una pregunta.",
    realTodayTitle: "Qué es real hoy",
    realTodayIntro: "Una demo nunca debería hacerse pasar por algo que no es.",
    states: { works: "Funciona", simulated: "Simulado por defecto", soon: "Próximamente" },
    realToday: [
      {
        piece: "El agente y sus herramientas",
        state: "works",
        detail: "Agente en eve sobre Groq, con la libreta (anotar, leer, cobrar) y los cobros.",
      },
      {
        piece: "Cobros y conciliación",
        state: "works",
        detail: "Números de cobro, idempotencia y asignación de pagos por monto y moneda, con tests.",
      },
      { piece: "Argentina (wARS) y Brasil (wBRL)", state: "works", detail: "Un negocio cobra en la moneda de su país." },
      { piece: "Billetera y saldo", state: "works", detail: "Leído de Celo mainnet. Solo lectura." },
      {
        piece: "El pago del cliente",
        state: "simulated",
        detail: "Un checkout simulado, para que una demo nunca mueva plata real. El ramp de Ripio se activa con una configuración.",
      },
      {
        piece: "Identidad del agente (ERC-8004) y atribución (ERC-8021)",
        state: "works",
        detail: "Registrado en Celo Sepolia, con el tag de atribución en la transacción. Mainnet, pendiente.",
      },
    ],
    builtTitle: "Cómo está construido",
    builtIntro: "Cuatro capas. La plata vive en Celo, el agente decide, la app conversa, y nada en el medio guarda claves.",
    layers: [
      { title: "Vos", points: ["Chateás con el agente", "Tu billetera recibe wARS o wBRL"] },
      { title: "La app", points: ["Next.js 16, React 19", "Tu chat y el celular del cliente, lado a lado"] },
      { title: "El agente", points: ["eve (Vercel), gpt-oss-120b en Groq", "Herramientas tipadas, nada más"] },
      { title: "Celo mainnet", points: ["wARS y wBRL de Ripio", "Transferencias leídas con viem"] },
    ],
    guaranteesTitle: "Garantías",
    guarantees: [
      "No hay claves privadas en el código. La app nunca firma ni mueve plata.",
      "Conectar la billetera es solo lectura: sirve para indicar dónde llegan tus cobros.",
      "Los pagos son simulados salvo que el deploy active explícitamente el ramp real.",
      "La plata nunca es un número con decimales flotantes: los montos son enteros en unidades base, así un saldo nunca muestra plata que no está.",
      "La conciliación nunca adivina: una transferencia ambigua espera a que decida una persona.",
    ],
    walletTitle: "Dónde recibís tus cobros",
    walletIntro: "Conectá la billetera donde querés recibir y mirá tu saldo. Solo lectura: no firmás nada.",
    linksTitle: "Links",
  },
  demo: {
    sides: "Lados de la demo",
    business: "Negocio",
    customer: "Cliente",
    customerPhone: "Celular de tu cliente",
    greetingLabel: "Saludo del asistente",
    greetingLoading: "¡Hola, {owner}! Estoy revisando la libreta…",
    greetingFailed: "¡Hola, {owner}! Contame qué se llevó alguien, o a quién querés cobrarle.",
    activity: "Actividad",
    subtitle: { AR: "Tu asistente de cobros en pesos", BR: "Tu asistente de cobros en reales" },
    home: "Inicio",
    country: "País",
    countries: { AR: "Argentina", BR: "Brasil" },
    toolError: "No se pudo completar: {error}",
    thinking: "Pensando…",
    message: "Mensaje",
    placeholder: {
      AR: "Ej: Anotá que Juan llevó 2 tortas por $30.000",
      BR: "Ej: Anotá que João llevó 2 tortas por R$ 300",
    },
    send: "Enviar",
  },
  ledger: {
    title: "Libreta",
    total: "Total",
    empty: "Todavía no anotaste nada.",
    paidAll: "Pagó todo",
    charge: "Cobrar",
    chargeLabel: "Cobrar a {customer}",
    linkSent: "Link enviado",
    upToDate: "Al día",
    noted: "Anotado:",
    whichCustomer: "¿Cuál cliente?",
    greetingNobody: "¡Hola, {owner}! Nadie te debe nada. Contame qué se llevó alguien y lo anoto.",
    greetingOwed: "¡Hola, {owner}! Hoy te deben {total} entre {count} {customers}.",
    customerOne: "cliente",
    customerMany: "clientes",
    chargeRequest: "Cobrale a {customer} lo que debe",
  },
  charges: {
    cardLabel: "Cobro {id}",
    paid: "Pagado",
    pending: "Pendiente",
    contactLabel: "Contacto de {name}",
    firstName: "Nombre",
    lastName: "Apellido",
    phone: "Celular",
    phonePlaceholder: { AR: "11 2345-6789", BR: "11 91234-5678" },
    phoneHint: { AR: "Código de área sin 0 y número sin 15.", BR: "DDD sin 0 y el número de 9 dígitos." },
    phoneInvalid: {
      AR: "Revisá el celular: código de área sin 0 y número sin 15, por ejemplo 11 2345-6789.",
      BR: "Revisá el celular: DDD sin 0 y el número de 9 dígitos, por ejemplo 11 91234-5678.",
    },
    sendWhatsApp: "Enviar por WhatsApp",
    cancel: "Cancelar",
    viewReceipt: "Ver comprobante",
    receiptTitle: "Comprobante del cobro {id}",
    sendTo: "Enviar a {name}",
    sentTo: "Enviado a {name}",
    openWhatsApp: "Abrir en WhatsApp",
    copyLink: "Copiar link",
    copied: "¡Copiado!",
    paymentMessage: "¡Hola {name}! Te paso el link para pagar {description} ({id}) por {amount}: {link}",
  },
  payer: {
    phoneLabel: "Celular del cliente",
    messages: "Mensajes",
    empty: "Cuando el negocio te mande un cobro, te llega acá.",
    paidReceipt: "Pagado · Ver comprobante",
    pay: "Pagar {amount}",
  },
  checkout: {
    charge: "Cobro",
    howYouPay: {
      AR: "Pagás en pesos desde tu banco con Ripio, y el negocio recibe wARS en Celo.",
      BR: "Pagás en reales con Pix desde tu banco con Ripio, y el negocio recibe wBRL en Celo.",
    },
    pay: "Pagar {amount}",
    processing: "Procesando…",
    ambiguous: "El pago llegó, pero hay otro cobro pendiente por el mismo monto: el negocio tiene que asignarlo a mano.",
    error: "No se pudo simular el pago. Probá de nuevo.",
  },
  receipt: {
    label: "Comprobante de pago",
    received: "Pago recibido",
    test: "Prueba",
    rows: {
      description: "Concepto",
      customer: "Cliente",
      reference: "Cobro",
      paidAt: "Fecha",
      method: "Medio",
      operation: "Operación",
    },
    method: "Ripio · {token} en Celo",
    explorer: "Ver la transacción en Celoscan",
  },
  activity: {
    title: "Lo que hice solo",
    loading: "Cargando…",
    empty: "Todavía no concilié ningún pago.",
    list: "Actividad del agente",
    review: "Revisar",
    matched: "{customer} pagó el cobro {chargeId} ({amount})",
    unmatched: "Llegó un pago de {amount} que no coincide con ningún cobro",
    ambiguous: "Llegó un pago de {amount} que puede ser de {chargeIds}: elegí vos cuál",
    or: " o ",
  },
  wallet: {
    group: "Billeteras",
    connect: "Conectar billetera",
    notConfigured: "La conexión de billeteras no está configurada en este entorno.",
    arrivesAt: "Tus cobros llegarán a",
    balanceIn: "Saldo en {token}",
    balanceError: "No se pudo leer el saldo",
    readingBalance: "Leyendo saldo",
    celoscan: "Ver en Celoscan",
    disconnect: "Desconectar",
  },
};

export type Dictionary = typeof esAR;
