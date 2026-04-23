import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  Scene,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three';

// =============================================================
// PASO 1: Preparar el mundo 3D
// Creamos el mundo
// =============================================================

const scene  = new Scene();
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50; // alejamos la cámara para ver bien toda la escena

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement); // conectamos el canvas al HTML

// =============================================================
// PASO 2: Agregar luces
// Usamos dos:
// - una luz suave que ilumina todo por igual (ambiente)
// - una luz direccional que da volumen y sombras (como un sol)
// =============================================================

const ambientLight = new AmbientLight(0x8899bb, 0.6);
scene.add(ambientLight);

const dirLight = new DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 15, 10);
scene.add(dirLight);

// =============================================================
// PASO 3: Cargar las imágenes de textura
// Cada cubo tiene dos "pieles": una tranquila y una agresiva.
// La agresiva se va superponiendo a medida que sube el estrés.
// =============================================================

const loader        = new TextureLoader();
const suaveTexture  = loader.load('/suave.png');
const stressTexture = loader.load('/estres.png');

// =============================================================
// PASO 4: Crear el destello de explosión
// Es un rectángulo blanco invisible que cubre toda la pantalla.
// Cuando hay explosión, aparece y luego se desvanece rápido.
// =============================================================

const flashEl = document.createElement('div');
flashEl.style.cssText = 'position:fixed;inset:0;background:#fff;pointer-events:none;opacity:0;';
document.body.appendChild(flashEl);

// =============================================================
// PASO 5: Definir los límites de la experiencia
// Estos números controlan cuándo cambia cada fase:
//   3 cubos  → todo sigue tranquilo
//   12 cubos → los cubos empiezan a aparecer solos
//   22 cubos → EXPLOSIÓN
// =============================================================

const CALM_COLORS  = [0xb8a9e8, 0xf4a0b5, 0xa8e6cf, 0xffd3b6, 0xc5e1f5]; // colores pastel tranquilos
const HARSH_COLORS = [0xff2200, 0xff8800, 0xffff00, 0x00ff44];             // colores agresivos de estrés
const CALM_THRESHOLD = 3;  // hasta aquí, nada cambia
const AUTO_SPAWN_AT  = 12; // a partir de aquí los cubos aparecen solos
const EXPLOSION_AT   = 22; // aquí todo explota

// =============================================================
// PASO 6: Variables de estado de la animación
// Guardan en qué momento está la experiencia en cada frame.
// =============================================================

const cubes = []; // lista de todos los cubos vivos actualmente
let lastTime          = performance.now(); // momento del último frame (para medir el tiempo transcurrido)
let shakeX            = 0; // cuánto tiembla la cámara horizontalmente
let shakeY            = 0; // cuánto tiembla la cámara verticalmente
let autoSpawnTimer    = 0; // contador para saber cuándo aparecer el próximo cubo automático
let explosionCooldown = 0; // tiempo restante de "descanso" después de una explosión
let flashIntensity    = 0; // opacidad del destello blanco (1 = totalmente blanco, 0 = invisible)
let postBlack         = 0; // intensidad del negro que queda tras la explosión (se desvanece en ~4 s)

// Colores guardados de antemano para no crearlos en cada frame (mejora el rendimiento)
const bgTint      = new Color();        // color de fondo calculado en cada frame
const bgCalm      = new Color(1, 1, 1); // blanco → fondo tranquilo
const bgStress    = new Color(0, 0, 0); // negro → fondo al máximo estrés o tras la explosión
const lightCalm   = new Color(0x8899bb); // azul frío → luz tranquila
const lightStress = new Color(0xff2200); // rojo → luz de estrés

// =============================================================
// PASO 7: Definir cómo es un cubo
// Cada cubo nace al hacer click. Tiene tres capas de apariencia
// que cambian según el nivel de estrés, y parámetros propios de
// movimiento y rotación.
// =============================================================

class BurnoutCube {
  constructor(position) {
    // Cada cubo elige al azar su color tranquilo y su color de estrés
    this.calmColor  = new Color(CALM_COLORS [Math.floor(Math.random() * CALM_COLORS.length)]);
    this.harshColor = new Color(HARSH_COLORS[Math.floor(Math.random() * HARSH_COLORS.length)]);

    // La forma del cubo (4×4×4 unidades) es compartida por las tres capas visuales
    this.geometry      = new BoxGeometry(4, 4, 4);
    this.basePositions = this.geometry.attributes.position.array.slice(); // guardamos la forma original para poder deformarla

    // Capa 1: textura suave con tinte de color tranquilo — siempre visible
    this.solidMat = new MeshPhongMaterial({
      map: suaveTexture,
      color: this.calmColor.clone(),
      shininess: 20,
      specular: new Color(0x222244),
    });

    // Capa 2: textura agresiva — comienza invisible y aparece encima a medida que sube el estrés
    this.stressMat = new MeshPhongMaterial({
      map: stressTexture,
      color: this.harshColor.clone(),
      transparent: true,
      opacity: 0,
    });

    // Capa 3: esqueleto de líneas rojo — también invisible al inicio, refuerza el caos visual
    this.wireMat = new MeshPhongMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0,
    });

    // Apilamos las tres capas: las capas 2 y 3 son "hijas" de la 1,
    // así que se mueven, rotan y deforman todas juntas automáticamente
    this.mesh = new Mesh(this.geometry, this.solidMat);
    this.mesh.add(new Mesh(this.geometry, this.stressMat));
    this.mesh.add(new Mesh(this.geometry, this.wireMat));
    this.mesh.position.copy(position);
    this.mesh.scale.setScalar(0.01); // empieza casi invisible y crece

    // Dirección y velocidad de deriva, distintas para cada cubo
    this.velocity = new Vector3(
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.02,
    );

    // Velocidad de giro propia de cada cubo
    this.rotVel = new Vector3(
      (Math.random() - 0.5) * 0.006,
      (Math.random() - 0.5) * 0.006,
      (Math.random() - 0.5) * 0.003,
    );

    this.lifetime    = 0; // Tiempo de vida del cubo, este va cambiando de 0 a maxLifetime
    this.maxLifetime = 12 + Math.random() * 10; // cada cubo vive entre 12 y 22 segundos
    this.alive       = true;
    scene.add(this.mesh);
  }

  // Se llama en cada frame para actualizar la posición, forma y apariencia del cubo
  update(dt, stress) {
    if (!this.alive) return;
    this.lifetime += dt;
    if (this.lifetime >= this.maxLifetime) { this.die(); return; }

    // El cubo crece al nacer (primer 10% de su vida) y se encoge antes de morir (último 20%)
    const t     = this.lifetime / this.maxLifetime;
    const scale = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 1;
    this.mesh.scale.setScalar(scale);

    // El cubo se mueve con sacudidas aleatorias que se vuelven más violentas con el estrés
    const jitter = stress * stress * 0.35; // cuadrático: casi nulo a estrés bajo, fuerte a estrés alto
    const move   = this.velocity.clone();
    move.x += (Math.random() - 0.5) * jitter;
    move.y += (Math.random() - 0.5) * jitter;
    move.z += (Math.random() - 0.5) * jitter * 0.2;
    this.mesh.position.addScaledVector(move, dt * 60); // multiplicar por dt*60 garantiza la misma velocidad en cualquier pantalla

    // El cubo gira más rápido y de forma más errática cuanto mayor sea el estrés
    const rotMult   = 1 + stress * 9;   // hasta 10 veces más rápido al máximo estrés
    const rotJitter = stress * 0.04;
    this.mesh.rotation.x += (this.rotVel.x + (Math.random() - 0.5) * rotJitter) * rotMult;
    this.mesh.rotation.y += (this.rotVel.y + (Math.random() - 0.5) * rotJitter) * rotMult;
    this.mesh.rotation.z += (this.rotVel.z + (Math.random() - 0.5) * rotJitter) * rotMult;

    // Con estrés, la forma del cubo se distorsiona: cada esquina se mueve al azar
    if (stress > 0) {
      const pos    = this.geometry.attributes.position;
      const deform = stress * stress * 1.5; // cuanto más estrés, más se deforma
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, this.basePositions[i * 3]     + (Math.random() - 0.5) * deform);
        pos.setY(i, this.basePositions[i * 3 + 1] + (Math.random() - 0.5) * deform);
        pos.setZ(i, this.basePositions[i * 3 + 2] + (Math.random() - 0.5) * deform);
      }
      pos.needsUpdate = true;
      this.geometry.computeVertexNormals(); // recalculamos las normales para que la luz siga siendo correcta
    }

    // La apariencia visual cambia con el estrés: más brillo, textura agresiva y esqueleto de líneas
    this.solidMat.shininess = 20 + stress * 250;                                   // brillo interno más intenso
    this.solidMat.emissive.copy(this.harshColor).multiplyScalar(stress * 0.3);     // resplandor agresivo
    this.stressMat.opacity  = stress;                                               // textura agresiva aparece
    this.wireMat.opacity    = stress * 0.9;                                         // esqueleto aparece
    this.wireMat.color.setRGB(1, 1 - stress, 0);                                   // amarillo → rojo al máximo
  }

  // Cuando hay explosión, el cubo sale disparado hacia afuera y desaparece en 1.5 segundos
  explode() {
    const dir = this.mesh.position.clone().sub(new Vector3(0, 0, 15)); // dirección desde el centro
    if (dir.length() < 0.5) dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    this.velocity.copy(dir.normalize().multiplyScalar(0.5));
    this.maxLifetime = this.lifetime + 1.5;
  }

  // Quita el cubo de la pantalla y libera la memoria que usaba
  die() {
    this.alive = false;
    scene.remove(this.mesh);
    this.geometry.dispose();
    this.solidMat.dispose();
    this.stressMat.dispose();
    this.wireMat.dispose();
  }
}

// =============================================================
// PASO 8: Traducir la posición del click a coordenadas 3D
// El click ocurre en la pantalla (2D). Necesitamos convertirlo
// a una posición en el mundo 3D para saber dónde poner el cubo.
// ndcTo3D es la función base; las otras dos la usan.
// =============================================================

function ndcTo3D(nx, ny) {
  const dir = new Vector3(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(dir, 35); // 35 unidades frente a la cámara
}

function screenTo3D(e) {
  // Convierte píxeles de pantalla al rango [-1, 1] que usa el motor 3D
  return ndcTo3D(
    (e.clientX / window.innerWidth)  *  2 - 1,
    (e.clientY / window.innerHeight) * -2 + 1,
  );
}

function randomVisiblePosition() {
  // Posición aleatoria pero siempre dentro de lo que se ve en pantalla
  return ndcTo3D(Math.random() * 2 - 1, Math.random() * 2 - 1);
}

// Cada click del usuario crea un nuevo cubo en ese punto de la pantalla
window.addEventListener('click', (e) => cubes.push(new BurnoutCube(screenTo3D(e))));

// =============================================================
// PASO 9: El loop de animación
// Esta función se repite ~60 veces por segundo. En cada vuelta:
//   1. Calcula cuánto tiempo pasó desde la vuelta anterior
//   2. Decide el nivel de estrés según cuántos cubos hay
//   3. Genera cubos solos si hay suficientes
//   4. Detona la explosión si se llega al límite
//   5. Actualiza cada cubo
//   6. Sacude la cámara
//   7. Cambia el color del fondo y la luz
//   8. Dibuja el frame
// =============================================================

function animate() {
  requestAnimationFrame(animate); // le pide al navegador que vuelva a llamar esta función en el próximo frame

  // 1. Tiempo transcurrido desde el frame anterior (en segundos, máximo 50 ms para evitar saltos raros)
  const now = performance.now();
  const dt  = Math.min((now - lastTime) / 1000, 0.05);
  lastTime  = now;

  // 2. Nivel de estrés: 0 con 3 cubos o menos, sube hasta 1 al llegar a 22 cubos
  const aliveCubes = cubes.filter((c) => c.alive).length;
  const stress = Math.min(Math.max(aliveCubes - CALM_THRESHOLD, 0) / (EXPLOSION_AT - CALM_THRESHOLD), 1);

  // 3. Si hay 12 o más cubos y no estamos en cooldown, aparecen cubos solos cada vez más rápido
  if (aliveCubes >= AUTO_SPAWN_AT && explosionCooldown <= 0) {
    const interval = Math.max(0.3, 2.0 - (aliveCubes - AUTO_SPAWN_AT) * 0.2); // intervalo entre 2 s y 0.3 s
    autoSpawnTimer += dt;
    if (autoSpawnTimer >= interval) {
      autoSpawnTimer = 0;
      cubes.push(new BurnoutCube(randomVisiblePosition()));
    }
  }

  // 4. Si se llegó a 22 cubos, todos explotan y el sistema descansa 10 segundos
  if (aliveCubes >= EXPLOSION_AT && explosionCooldown <= 0) {
    explosionCooldown = 10;
    flashIntensity    = 1.0;
    postBlack         = 1.0;
    cubes.forEach((c) => { if (c.alive) c.explode(); });
  }
  explosionCooldown = Math.max(0, explosionCooldown - dt); // el contador baja cada frame

  // 5. Actualizamos cada cubo; recorremos la lista al revés para poder borrar sin saltar elementos
  for (let i = cubes.length - 1; i >= 0; i--) {
    cubes[i].update(dt, stress);
    if (!cubes[i].alive) cubes.splice(i, 1);
  }

  // 6. La cámara tiembla: el temblor se acumula y se amortigua para que sea suave, no brusco
  const shakeForce = stress * stress * 1.8; // cuadrático: casi nulo a estrés bajo, intenso al máximo
  shakeX = shakeX * 0.8 + (Math.random() - 0.5) * shakeForce * 0.4;
  shakeY = shakeY * 0.8 + (Math.random() - 0.5) * shakeForce * 0.4;
  camera.position.x = shakeX;
  camera.position.y = shakeY;

  // 7a. El fondo pasa de blanco (calma) a negro (estrés máximo)
  bgTint.copy(bgCalm).lerp(bgStress, stress);
  // 7b. Tras la explosión el fondo se queda negro y vuelve a blanco suavemente en ~4 segundos
  if (postBlack > 0) {
    postBlack = Math.max(0, postBlack - dt * 0.25);
    bgTint.lerp(bgStress, postBlack);
  }
  renderer.setClearColor(bgTint);

  // 7c. El destello blanco de la explosión se desvanece en ~0.3 segundos
  if (flashIntensity > 0) {
    flashIntensity = Math.max(0, flashIntensity - dt * 3);
    flashEl.style.opacity = flashIntensity;
  }

  // 7d. La luz ambiental cambia de azul frío (calma) a rojo intenso (estrés)
  ambientLight.color.copy(lightCalm).lerp(lightStress, stress);
  ambientLight.intensity = 0.6 + stress * 0.8;

  // 8. Dibujamos el frame final en pantalla
  renderer.render(scene, camera);
}

animate();

// Si el usuario cambia el tamaño de la ventana, ajustamos la cámara y el canvas
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
