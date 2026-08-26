import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface RegisLogo3DProps {
  /** face color of the mark */
  color?: string;
  /** extrusion side color */
  sideColor?: string;
  /** how strongly the logo tilts toward the cursor (0–1) */
  trackIntensity?: number;
  className?: string;
  style?: React.CSSProperties;
}

function buildLogo(color: string, sideColor: string): THREE.Group {
  const w = 0.32, depth = 0.36;
  const bracket = (cx: number, cy: number, A: number, botY: number): THREE.Shape => {
    const s = new THREE.Shape();
    s.moveTo(cx, cy - w);
    s.lineTo(cx + w, cy);
    s.lineTo(cx + A, cy);
    s.lineTo(cx + A - w, cy - w);
    s.lineTo(cx + w, cy - w);
    s.lineTo(cx + w, botY);
    s.lineTo(cx, botY + w);
    s.closePath();
    return s;
  };
  const shapes = [
    bracket(0.0, 0.0, 2.2, -2.75),
    bracket(0.48, -0.48, 1.57, -2.62),
    bracket(0.96, -1.3, 0.92, -2.5),
  ];
  const face = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 });
  const side = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.45, metalness: 0.15 });
  const group = new THREE.Group();
  for (const sh of shapes) {
    const geo = new THREE.ExtrudeGeometry(sh, {
      depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1,
    });
    group.add(new THREE.Mesh(geo, [face, side]));
  }
  const box = new THREE.Box3().setFromObject(group);
  const c = box.getCenter(new THREE.Vector3());
  group.children.forEach((m) => m.position.sub(c));
  return group;
}

/**
 * Lightweight 3D Regis logo that tilts toward the mouse.
 * Renders into a transparent canvas that fills its parent — size it via
 * className/style on the component (e.g. width: 420px; aspect-ratio: 1).
 */
export default function RegisLogo3D({
  color = '#1a4f9c',
  sideColor = '#0f3a75',
  trackIntensity = 1,
  className,
  style,
}: RegisLogo3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 0, 3.2);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbcc8dc, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9db8ff, 0.7);
    rim.position.set(-3, -1, -2);
    scene.add(rim);

    const logo = buildLogo(color, sideColor);
    scene.add(logo);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /** Resting pose. Reduced motion gets this one frame instead of the loop. */
    const renderStatic = () => {
      logo.rotation.set(0, -0.2, 0);
      logo.position.y = 0;
      logo.scale.setScalar(0.32);
      renderer.render(scene, camera);
    };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (reduced) renderStatic();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const target = new THREE.Vector2();
    const cur = new THREE.Vector2();
    let lastMove = -1e9;
    const onMove = (e: PointerEvent) => {
      target.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      lastMove = performance.now();
    };
    if (!reduced) window.addEventListener('pointermove', onMove);

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const t = (now - start) / 1000;
      const entrance = Math.min(1, t / 1.2);
      const easeOut = 1 - Math.pow(1 - entrance, 3);
      const idle = now - lastMove > 2500 ? 1 : 0.3;
      cur.lerp(target, 0.06);
      logo.rotation.y =
        cur.x * 0.55 * trackIntensity + Math.sin(t * 0.4) * 0.12 * idle + (1 - easeOut) * -1.2;
      logo.rotation.x = cur.y * 0.35 * trackIntensity + Math.sin(t * 0.7) * 0.04;
      logo.position.y = Math.sin(t * 0.9) * 0.03;
      logo.scale.setScalar(0.32 * (0.6 + 0.4 * easeOut));
      renderer.render(scene, camera);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };

    if (reduced) {
      renderStatic();
    } else {
      document.addEventListener('visibilitychange', onVis);
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      const el = renderer.domElement;
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, [color, sideColor, trackIntensity]);

  return <div ref={hostRef} className={className} style={{ width: '100%', height: '100%', ...style }} />;
}
