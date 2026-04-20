/**
 * Demo de cubo en Three.js con movimiento horizontal.
 */

import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

// Escena
const scene = new Scene();

// Cámara
const camera = new PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

// Alejar la cámara para tener un rango visual más amplio del movimiento en el eje X.
camera.position.z = 50;

// Renderizador
const renderer = new WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Malla del cubo
const geometry = new BoxGeometry(6, 6, 6);
// const material = new MeshBasicMaterial({ color: 0x00ff00, wireframe: true }); // Ejemplo básico sin color - con wireframe
 const material = new MeshBasicMaterial({ color: 0xff6b6b, wireframe: false }); // Ejemplo con color sólido - sin wireframe
const cube = new Mesh(geometry, material);
scene.add(cube);

// Variables de posición para controlar la ubicación del cubo en todos los ejes.
let positionX = -40; // Inicia en el lado izquierdo
const positionY = 0;
const positionZ = 20;

// Variables de estado que controlan el rebote horizontal.
let direction = 1; // 1 = mover a la derecha, -1 = mover a la izquierda
const speed = 0.1; // Unidades por frame
const boundary = 40; // Límite izquierda/derecha

function animate() {
  requestAnimationFrame(animate);

  // Actualiza la posición y revierte la dirección en los límites.
  positionX += speed * direction;

  if (positionX >= boundary) {
    positionX = boundary;
    direction = -1;
  } else if (positionX <= -boundary) {
    positionX = -boundary;
    direction = 1;
  }

  // Aplica la posición calculada al cubo en x, y, z.
  cube.position.set(positionX, positionY, positionZ);

  // Rotación existente del ejemplo base
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  renderer.render(scene, camera);
}
animate();

// Redimensionado de la ventana del navegador
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
