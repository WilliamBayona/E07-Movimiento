import {
  BoxGeometry,
  MeshBasicMaterial,
  Mesh,
  PerspectiveCamera,
  Scene,
  WebGLRenderer

} from 'three';


// paso 1: crear la escena
const scene = new Scene();

// crear la cámara
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// paso 2: crear el renderizador
const renderer = new WebGLRenderer();

// paso 3: inicializar los objetos 3d
const geometry = new BoxGeometry(1, 1, 1);
const material = new MeshBasicMaterial({ color: 0x00ff00 });
const cube = new Mesh(geometry, material);

// paso 4: agregar los objetos a la escena
scene.add(cube);

// paso 5: renderizar la escena
const clockStart = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const elapsedSeconds = (performance.now() - clockStart) / 1000;

  // Mueve el cubo horizontalmente de izquierda a derecha en bucle.
  cube.position.x = Math.sin(elapsedSeconds * 1.5) * 2;
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();

// paso 6: agregar el renderizador al DOM
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
