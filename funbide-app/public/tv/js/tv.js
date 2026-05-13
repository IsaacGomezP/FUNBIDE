let lastUpdateTimestamp = 0;
let audioQueue = [];
let isPlaying = false;
let ultimoEstadoTickets = new Map();
let ultimoTicketProcesado = null;
let ultimoTimestampAnuncio = 0;
let ticketsLlamandoActual = new Set();
let supabaseClient = null;

const TIEMPO_MINIMO_ENTRE_MISMO_TICKET = 3000;
const RETRASO_ENTRE_SONIDOS = 1000;

const sucursalNombre = document.getElementById('sucursalNombre');
const cardsContainer = document.getElementById('cardsContainer');
const nextList = document.getElementById('nextList');
const attentionCount = document.getElementById('attentionCount');
const queueCount = document.getElementById('queueCount');
const tickerTrack = document.getElementById('tickerTrack');

const mensajesTicker = [
  'Consulte con nuestros agentes la disponibilidad de servicios y horarios.',
  'Tenga su documento o codigo listo para agilizar la gestion.',
  'Los turnos en pantalla se actualizan en tiempo real.',
  'Nuestro equipo esta listo para asistirle con cualquier consulta.',
  'Si necesita ayuda adicional, acerquese al modulo indicado en pantalla.',
  'FUNBIDE centraliza turnos, recepcion, consulta y apoyo comunitario.',
  'Su turno sera anunciado en pantalla y por voz cuando llegue el momento.',
  'FUNBIDE conecta modulos y operaciones en una sola plataforma.',
  'Gracias por confiar en FUNBIDE. Su atencion es nuestra prioridad.',
  'Mantenga su ticket a la mano para ser atendido mas rapido.'
];

const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

function init() {
  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }

  actualizarReloj();
  iniciarTicker();
  cargarDatosTurnos();

  setInterval(actualizarReloj, 1000);
  setInterval(vigilarCambios, 5000);
}

function actualizarReloj() {
  const now = new Date();
  const diaSemana = diasSemana[now.getDay()];
  const dia = now.getDate();
  const mes = meses[now.getMonth()];
  const anio = now.getFullYear();
  let horas = now.getHours();
  let minutos = now.getMinutes().toString().padStart(2, '0');
  let ampm = horas >= 12 ? 'PM' : 'AM';
  horas = horas % 12 || 12;

  const dateElement = document.getElementById('currentDate');
  const timeElement = document.getElementById('currentTime');
  if (dateElement) dateElement.textContent = `${diaSemana} ${dia} de ${mes} ${anio}`;
  if (timeElement) timeElement.textContent = `${horas.toString().padStart(2, '0')}:${minutos} ${ampm}`;
}

function iniciarTicker() {
  if (!tickerTrack) return;
  const mensajesDuplicados = [...mensajesTicker, ...mensajesTicker, ...mensajesTicker];
  tickerTrack.innerHTML = mensajesDuplicados.map(mensaje => `<div class="tv-ticker-message">${mensaje}</div>`).join('');
}

function limpiarPantalla() {
  if (sucursalNombre) sucursalNombre.textContent = 'Sin conexion';
  if (cardsContainer) cardsContainer.innerHTML = placeholder('fa-plug-circle-xmark', 'No hay conexion con la base de datos');
  if (nextList) nextList.innerHTML = placeholder('fa-plug-circle-xmark', 'No hay datos disponibles');
  if (attentionCount) attentionCount.textContent = '0';
  if (queueCount) queueCount.textContent = '0';
}

function placeholder(icon, text) {
  return `
    <div class="tv-placeholder">
      <i class="fas ${icon}"></i>
      <p>${text}</p>
    </div>
  `;
}

async function cargarDatosTurnos() {
  try {
    if (!supabaseClient) throw new Error('Supabase no inicializado');

    const { data, error } = await supabaseClient
      .from('turnos')
      .select('*')
      .order('fecha_creado', { ascending: true });

    if (error) throw error;
    actualizarUI(desdeTurnos(data || []));
  } catch (error) {
    console.error('Error al cargar turnos:', error);
    limpiarPantalla();
  }
}

function desdeTurnos(turnos) {
  const turnosAtencion = turnos
    .filter(t => ['llamando', 'atendiendo'].includes(t.estado))
    .map(t => ({
      id_visual: t.codigo,
      puesto_atencion: t.puesto_atencion || 'Modulo',
      estado: t.estado === 'llamando' ? 'Llamando' : 'Atendiendo',
      fecha_llamado: t.fecha_llamado || t.fecha_creado
    }));

  const espera = turnos
    .filter(t => t.estado === 'espera')
    .map(t => ({ id_visual: t.codigo, servicio_nombre: t.servicio_nombre || 'Atencion general' }));

  return {
    nombre_sucursal: 'FUNBIDE CENTRAL',
    ticket_actual: turnosAtencion.find(t => t.estado === 'Llamando') || null,
    otros_llamados: turnosAtencion.filter(t => t.estado !== 'Llamando'),
    espera
  };
}

function actualizarUI(data) {
  if (sucursalNombre && data.nombre_sucursal) {
    sucursalNombre.textContent = data.nombre_sucursal;
  }

  const turnosAtencion = [];
  if (data.ticket_actual) turnosAtencion.push({ ...data.ticket_actual, es_principal: true });
  if (data.otros_llamados && data.otros_llamados.length > 0) {
    data.otros_llamados.forEach(ticket => turnosAtencion.push({ ...ticket, es_principal: false }));
  }

  if (turnosAtencion.length > 0) {
    const turnosLlamando = turnosAtencion.filter(t => t.estado === 'Llamando');
    turnosLlamando.forEach(turno => anunciarTurnoConCola(turno.id_visual, turno.puesto_atencion));
  }

  if (cardsContainer) {
    if (turnosAtencion.length > 0) {
      cardsContainer.innerHTML = turnosAtencion.map(turno => {
        const esActivo = turno.estado === 'Llamando';
        const estadoTexto = esActivo ? 'LLAMANDO' : 'EN ATENCION';
        return `
          <div class="tv-card ${esActivo ? 'tv-card-active' : ''}">
            <span class="tv-card-number">${turno.id_visual}</span>
            <div class="tv-card-divider"></div>
            <div class="tv-card-info">
              <span class="tv-card-puesto">${turno.puesto_atencion || 'Modulo'}</span>
              <span class="tv-card-status">${estadoTexto}</span>
            </div>
          </div>
        `;
      }).join('');
      if (attentionCount) attentionCount.textContent = String(turnosAtencion.length);
    } else {
      cardsContainer.innerHTML = placeholder('fa-inbox', 'No hay turnos en atencion');
      if (attentionCount) attentionCount.textContent = '0';
    }
  }

  if (nextList && data.espera) {
    if (queueCount) queueCount.textContent = String(data.espera.length);
    if (data.espera.length > 0) {
      nextList.innerHTML = data.espera.map((turno, index) => `
        <div class="tv-next-item">
          <span class="tv-next-number">${turno.id_visual}</span>
          <div class="tv-next-info">
            <span class="tv-next-servicio">${turno.servicio_nombre || 'Atencion general'}</span>
            <span class="tv-next-time">Tiempo estimado: ${calcularTiempoEstimado(index)}</span>
          </div>
        </div>
      `).join('');
    } else {
      nextList.innerHTML = placeholder('fa-hourglass-half', 'No hay turnos en espera');
    }
  }
}

function calcularTiempoEstimado(posicion) {
  const minutos = (posicion + 1) * 5;
  if (minutos < 5) return 'Proximamente';
  if (minutos < 30) return `~${minutos} minutos`;
  return `Mas de ${minutos} minutos`;
}

function anunciarTurnoConCola(turno, puesto) {
  if (!turno || turno === '---') return;
  const ahora = Date.now();
  if (ticketsLlamandoActual.has(turno)) return;
  if (ultimoTicketProcesado === turno && (ahora - ultimoTimestampAnuncio) < TIEMPO_MINIMO_ENTRE_MISMO_TICKET) return;

  const texto = `Atencion. Turno ${turno}. Favor pasar a ${puesto || 'su modulo de atencion'}.`;
  ticketsLlamandoActual.add(turno);
  audioQueue.push({ turno, texto, puesto, id: turno });
  procesarColaAudio();
}

function procesarColaAudio() {
  if (isPlaying || audioQueue.length === 0) return;
  isPlaying = true;
  const item = audioQueue.shift();
  ultimoTicketProcesado = item.turno;
  ultimoTimestampAnuncio = Date.now();

  const utterance = new SpeechSynthesisUtterance(item.texto);
  utterance.lang = 'es-ES';
  utterance.rate = 0.85;
  utterance.onend = () => {
    ticketsLlamandoActual.delete(item.id);
    isPlaying = false;
    setTimeout(procesarColaAudio, RETRASO_ENTRE_SONIDOS);
  };
  utterance.onerror = () => {
    ticketsLlamandoActual.delete(item.id);
    isPlaying = false;
    setTimeout(procesarColaAudio, RETRASO_ENTRE_SONIDOS);
  };

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  window.speechSynthesis.speak(utterance);
}

async function vigilarCambios() {
  await cargarDatosTurnos();
}

window.addEventListener('beforeunload', () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
});

document.addEventListener('DOMContentLoaded', init);
