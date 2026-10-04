console.log("1. El archivo game.js se ha enlazado correctamente.");

const video = document.getElementById("webcam");
const statusDiv = document.getElementById("detection-status");

// --- Música de fondo ---
const bgMusic = new Audio("./music/musicafondo.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.5;

function iniciarMusica() {
  if (bgMusic.paused) {
    bgMusic.play().catch((err) => console.log("Audio play blocked:", err));
  }
}
window.addEventListener("keydown", iniciarMusica, { once: true });
window.addEventListener("click", iniciarMusica, { once: true });

console.log("2. Iniciando descarga de modelos de IA...");

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("./models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("./models"),
  faceapi.nets.faceExpressionNet.loadFromUri("./models"),
])
  .then(() => {
    console.log(
      "3. Modelos cargados con éxito. Solicitando acceso a la cámara...",
    );
    startVideo();
  })
  .catch((err) => {
    console.error("🛑 ERROR AL CARGAR LOS MODELOS:", err);
    statusDiv.innerHTML = "Error al cargar modelos. Revisa la consola.";
  });

function startVideo() {
  navigator.mediaDevices
    .getUserMedia({ video: {} })
    .then((stream) => {
      console.log("4. Cámara encendida.");
      video.srcObject = stream;
    })
    .catch((err) => {
      console.error("🛑 ERROR AL ACCEDER A LA CÁMARA:", err);
      statusDiv.innerHTML = "Permiso de cámara denegado.";
    });
}

let lecturasSinEmocion = 0;
const limiteNeutral = 5;

video.addEventListener("play", () => {
  iniciarMusica();
  console.log("5. Evento de video iniciado. Arrancando lectura facial...");
  const overlay = document.getElementById("overlay");

  const displaySize = {
    width: video.width,
    height: video.height,
  };

  faceapi.matchDimensions(overlay, displaySize);

  setInterval(async () => {
    const detections = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions();

    if (detections) {
      statusDiv.style.display = "none";
      const expressions = detections.expressions;

      let maxEmotion = "neutral";
      let maxConfidence = 0;

      for (const [emotion, confidence] of Object.entries(expressions)) {
        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          maxEmotion = emotion;
        }
      }

      console.log(
        `Rostro detectado -> Emoción: ${maxEmotion} | Confianza: ${(maxConfidence * 100).toFixed(1)}%`,
      );

      if (maxConfidence > 0.4) {
        lecturasSinEmocion = 0;
        procesarComandoEmocional(maxEmotion);
      } else {
        lecturasSinEmocion++;

        if (lecturasSinEmocion >= limiteNeutral) {
          procesarComandoEmocional("neutral");
        }
      }
    } else {
      statusDiv.style.display = "block";
      statusDiv.innerHTML = "Colócate frente a la cámara";
      lecturasSinEmocion++;

      if (lecturasSinEmocion >= limiteNeutral) {
        procesarComandoEmocional("neutral");
      }
    }
  }, 200);
});

/////////////////////////////////////////////////////
// LÓGICA DEL JUEGO Y CANVAS
/////////////////////////////////////////////////////

const gameCanvas = document.getElementById("gameCanvas");
const ctx = gameCanvas.getContext("2d");

gameCanvas.width = 800;
gameCanvas.height = 450;

// Assets de efectos
const imgEstrella = new Image();
imgEstrella.src = "img/Estrella.png";

const imgMoneda = new Image();
imgMoneda.src = "img/Moneda.png";

// Función auxiliar para diagnosticar carga de imágenes en consola
function cargarImagenPersonaje(ruta) {
  const img = new Image();
  img.src = ruta;
  img.onload = () => console.log(`✅ Imagen cargada con éxito: ${ruta}`);
  img.onerror = () => console.error(`❌ ERROR al cargar imagen: ${ruta}`);
  return img;
}

// IMÁGENES REALES DEL PERSONAJE (Todos .png, dentro de img/ y sin _)
const imgNeutral = cargarImagenPersonaje("img/PersonajeFrente.png");

// Feliz (Caminata a la derecha)
const imgFeliz1 = cargarImagenPersonaje("img/Feliz.png");
const imgFeliz2 = cargarImagenPersonaje("img/Feliz1.png");

// Triste (Caminata a la izquierda)
const imgTriste1 = cargarImagenPersonaje("img/Triste.png");
const imgTriste2 = cargarImagenPersonaje("img/Triste1.png");

// Enojado (Movimiento hacia abajo)
const imgEnojado1 = cargarImagenPersonaje("img/Enojado1.png");
const imgEnojado2 = cargarImagenPersonaje("img/Enojado2.png");

// Sorprendido (Movimiento hacia arriba)
const imgSorprendido1 = cargarImagenPersonaje("img/Sorprendido1.png");
const imgSorprendido2 = cargarImagenPersonaje("img/Sorprendida2.png");
const imgSorprendido3 = cargarImagenPersonaje("img/Sorprendida3.png");

// Arreglos de partículas y objetos dinámicos
let estrellas = [];
let gotasLluvia = [];
let monedas = [];
let emocionActual = "neutral";

function crearEstrella() {
  estrellas.push({
    x: Math.random() * (gameCanvas.width - 40),
    y: Math.random() * (gameCanvas.height - 40),
    tamano: 18 + Math.random() * 12,
    vida: 90,
    vidaMax: 90,
  });
}

function crearGotaLluvia() {
  gotasLluvia.push({
    x: Math.random() * gameCanvas.width,
    y: -10,
    largo: 10 + Math.random() * 10,
    velocidad: 8 + Math.random() * 6,
  });
}

function crearMoneda() {
  const yInicio = 150 + Math.random() * 250;
  monedas.push({
    x: Math.random() * (gameCanvas.width - 40),
    y: yInicio,
    yInicio: yInicio,
    velocidadY: -9,
    tamano: 40,
    fase: 0,
  });
}

// Estado del personaje
let personaje = {
  x: gameCanvas.width / 2 - 50,
  y: gameCanvas.height / 2 - 70,
  velocidad: 15,
  ancho: 90,
  alto: 125,
  imagenActual: imgNeutral,
  frame: 0,
  frameSpeed: 2
};

// Control de fondos de escenario
const fondosEscenario = {
  neutral: "img/escenario_neutral.PNG",
  happy: "img/escenario_feliz.PNG",
  sad: "img/escenario_triste.PNG",
  angry: "img/escenario_enojado.PNG",
  surprised: "img/escenario_sorpresa.PNG",
};

Object.values(fondosEscenario).forEach((ruta) => {
  new Image().src = ruta;
});

const capas = document.querySelectorAll(".fondo-capa");
let capaActiva = 0;
let escenarioActual = "";

function cambiarEscenario(emocion) {
  const ruta = fondosEscenario[emocion] || fondosEscenario.neutral;
  if (ruta === escenarioActual) return;
  escenarioActual = ruta;

  const siguiente = 1 - capaActiva;

  capas[siguiente].style.backgroundImage = `url("${ruta}")`;
  capas[siguiente].style.zIndex = 2;
  capas[capaActiva].style.zIndex = 1;
  capas[siguiente].classList.add("visible");
  capaActiva = siguiente;

  setTimeout(() => {
    capas.forEach((capa, i) => {
      if (i !== capaActiva) capa.classList.remove("visible");
    });
  }, 800);
}

const capasPagina = document.querySelectorAll(".body-capa");
let capaPaginaActiva = 0;
let fondoPaginaActual = "";

function cambiarFondoPagina(fondo) {
  if (fondo === fondoPaginaActual) return;
  fondoPaginaActual = fondo;

  const siguiente = 1 - capaPaginaActiva;

  capasPagina[siguiente].style.background = fondo;
  capasPagina[siguiente].style.zIndex = -1;
  capasPagina[capaPaginaActiva].style.zIndex = -2;
  capasPagina[siguiente].classList.add("visible");
  capaPaginaActiva = siguiente;

  setTimeout(() => {
    capasPagina.forEach((capa, i) => {
      if (i !== capaPaginaActiva) capa.classList.remove("visible");
    });
  }, 800);
}

function procesarComandoEmocional(emocion) {
  emocionActual = emocion;

  if (emocion !== "happy") estrellas = [];
  if (emocion !== "sad") gotasLluvia = [];
  if (emocion !== "surprised") monedas = [];

  document.body.classList.remove("angry-bg");

  let fondoExpresion;

  switch (emocion) {
    case "happy":
      fondoExpresion = `
        radial-gradient(
          circle at 50% 15%,
          rgba(255, 255, 245, 0.95) 0%,
          rgba(255, 248, 180, 0.55) 20%,
          transparent 48%
        ),
        linear-gradient(
          180deg,
          #fff9c4 0%,
          #ffe97a 35%,
          #ffd95a 65%,
          #f7c948 100%
        )
      `;
      break;

    case "sad":
      fondoExpresion = `
        linear-gradient(
          180deg,
          #55738f 0%,
          #304b66 28%,
          #1c3149 58%,
          #0d1826 100%
        )
      `;
      break;

    case "surprised":
      fondoExpresion = `
        linear-gradient(
          to right,
          #064a08 0%,
          #0d5e09 22%,
          #247d0b 50%,
          #0d5e09 78%,
          #064a08 100%
        )
      `;
      break;

    case "angry":
      document.body.classList.add("angry-bg");
      fondoExpresion = `
        radial-gradient(
          circle at center,
          #7a0000 0%,
          #3a0000 45%,
          #120000 80%,
          #050000 100%
        )
      `;
      break;

    case "neutral":
    default:
      fondoExpresion = `
        linear-gradient(
          180deg,
          #e8c8f5 0%,
          #cfb5ee 40%,
          #b4a0e0 75%,
          #9484c8 100%
        )
      `;
      break;
  }

  cambiarFondoPagina(fondoExpresion);
  cambiarEscenario(emocion);

  personaje.frame++;

  switch (emocion) {
    case "happy":
      personaje.x += personaje.velocidad;
      if (Math.floor(personaje.frame / personaje.frameSpeed) % 2 === 0) {
        personaje.imagenActual = imgFeliz1;
      } else {
        personaje.imagenActual = imgFeliz2;
      }
      for (let i = 0; i < 5; i++) crearEstrella();
      break;

    case "angry":
      personaje.y += personaje.velocidad;
      if (Math.floor(personaje.frame / personaje.frameSpeed) % 2 === 0) {
        personaje.imagenActual = imgEnojado1;
      } else {
        personaje.imagenActual = imgEnojado2;
      }
      break;

    case "sad":
      personaje.x -= personaje.velocidad;
      if (Math.floor(personaje.frame / personaje.frameSpeed) % 2 === 0) {
        personaje.imagenActual = imgTriste1;
      } else {
        personaje.imagenActual = imgTriste2;
      }
      for (let i = 0; i < 5; i++) crearGotaLluvia();
      break;

    case "surprised":
      personaje.y -= personaje.velocidad;
      const stepSorpresa = Math.floor(personaje.frame / personaje.frameSpeed) % 3;
      if (stepSorpresa === 0) personaje.imagenActual = imgSorprendido1;
      else if (stepSorpresa === 1) personaje.imagenActual = imgSorprendido2;
      else personaje.imagenActual = imgSorprendido3;

      if (Math.random() < 0.6) crearMoneda();
      break;

    default:
      personaje.imagenActual = imgNeutral;
  }

  personaje.x = Math.max(
    0,
    Math.min(gameCanvas.width - personaje.ancho, personaje.x),
  );

  personaje.y = Math.max(
    0,
    Math.min(gameCanvas.height - personaje.alto, personaje.y),
  );
}

function dibujarJuego() {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  // RENDER ESTRELLAS
  for (let i = estrellas.length - 1; i >= 0; i--) {
    const estrella = estrellas[i];
    ctx.globalAlpha = estrella.vida / estrella.vidaMax;

    if (imgEstrella.complete) {
      ctx.drawImage(
        imgEstrella,
        estrella.x,
        estrella.y,
        estrella.tamano,
        estrella.tamano,
      );
    }

    estrella.vida--;
    if (estrella.vida <= 0) {
      estrellas.splice(i, 1);
    }
  }

  ctx.globalAlpha = 1;

  // RENDER LLUVIA
  for (let i = gotasLluvia.length - 1; i >= 0; i--) {
    const gota = gotasLluvia[i];

    ctx.strokeStyle = "rgba(180, 220, 255, 0.75)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(gota.x, gota.y);
    ctx.lineTo(gota.x, gota.y + gota.largo);
    ctx.stroke();

    gota.y += gota.velocidad;

    if (gota.y > gameCanvas.height) {
      gotasLluvia.splice(i, 1);
    }
  }

  // RENDER MONEDAS
  if (imgMoneda.complete) {
    for (let i = monedas.length - 1; i >= 0; i--) {
      const m = monedas[i];

      m.y += m.velocidadY;
      m.velocidadY += 0.5;
      m.fase += 0.4;

      const ancho = Math.max(4, Math.abs(Math.cos(m.fase)) * m.tamano);

      ctx.drawImage(
        imgMoneda,
        m.x + (m.tamano - ancho) / 2,
        m.y,
        ancho,
        m.tamano,
      );

      if (m.velocidadY > 0 && m.y >= m.yInicio) {
        monedas.splice(i, 1);
      }
    }
  }

  // RENDER PERSONAJE
  const imgActual = personaje.imagenActual;

  if (imgActual && imgActual.complete && imgActual.naturalWidth !== 0) {
    ctx.drawImage(
      imgActual,
      personaje.x,
      personaje.y,
      personaje.ancho,
      personaje.alto,
    );
  } else {
    if (imgNeutral.complete && imgNeutral.naturalWidth !== 0) {
      ctx.drawImage(
        imgNeutral,
        personaje.x,
        personaje.y,
        personaje.ancho,
        personaje.alto,
      );
    }
  }

  requestAnimationFrame(dibujarJuego);
}

// Bucle principal de dibujo
requestAnimationFrame(dibujarJuego);