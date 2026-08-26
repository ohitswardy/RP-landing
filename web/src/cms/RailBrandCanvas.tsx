import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* Interactive brand-header background — a shallow parallax field of ink/amber
   points on the paper surface. The whole field "navigates" toward the pointer,
   giving the flat graph-paper rail a quiet sense of depth. Transparent canvas,
   so the underlying bg-paper-grid stays visible beneath it. */

const INK = new THREE.Color('#000000');
const AMBER = new THREE.Color('#e6a24e');

function makeDisc() {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export default function RailBrandCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const el = renderer.domElement;
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.display = 'block';
    mount.appendChild(el);

    const COLS = 30;
    const ROWS = 8;
    const count = COLS * ROWS;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count);

    let i = 0;
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        positions[i * 3] = (x / (COLS - 1) - 0.5) * 15;
        positions[i * 3 + 1] = (y / (ROWS - 1) - 0.5) * 4.2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2.6;
        const c = Math.random() < 0.09 ? AMBER : INK;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
        seeds[i] = Math.random() * Math.PI * 2;
        i++;
      }
    }
    const basePositions = positions.slice();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const disc = makeDisc();
    const mat = new THREE.PointsMaterial({
      size: 0.33,
      map: disc,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      alphaTest: 0.02,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove);

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    const clock = new THREE.Clock();
    let raf = 0;

    const render = () => {
      const t = clock.getElapsedTime();
      current.x += (target.x - current.x) * 0.05;
      current.y += (target.y - current.y) * 0.05;

      points.rotation.y = current.x * 0.5;
      points.rotation.x = current.y * 0.3;

      const pos = geo.attributes.position.array as Float32Array;
      for (let k = 0; k < count; k++) {
        pos[k * 3 + 2] = basePositions[k * 3 + 2] + Math.sin(t * 0.6 + seeds[k]) * 0.32;
      }
      geo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    if (reduced) {
      render();
    } else {
      const loop = () => {
        raf = requestAnimationFrame(loop);
        render();
      };
      loop();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      ro.disconnect();
      geo.dispose();
      mat.dispose();
      disc.dispose();
      renderer.dispose();
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, []);

  return <div ref={mountRef} className="pointer-events-none absolute inset-0" aria-hidden />;
}
