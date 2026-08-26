import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

const FONT_URL = 'https://unpkg.com/three@0.184.0/examples/fonts/gentilis_bold.typeface.json';

export interface RegisLockup3DProps {
  color?: string;
  sideColor?: string;
  /** how strongly the logo tilts toward the cursor (0–1) */
  trackIntensity?: number;
  className?: string;
  style?: React.CSSProperties;
}

function buildMark(face: THREE.Material, side: THREE.Material): THREE.Group {
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
  const g = new THREE.Group();
  for (const sh of shapes) {
    const geo = new THREE.ExtrudeGeometry(sh, {
      depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1,
    });
    g.add(new THREE.Mesh(geo, [face, side]));
  }
  return g;
}

async function buildLockup(color: string, sideColor: string): Promise<THREE.Group> {
  const face = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 });
  const side = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.45, metalness: 0.15 });
  const font = await new Promise<any>((res, rej) =>
    new FontLoader().load(FONT_URL, res, undefined, rej),
  );
  const group = new THREE.Group();

  const mark = buildMark(face, side);
  group.add(mark);
  const markBox = new THREE.Box3().setFromObject(mark);
  const gap = 0.38;
  const textDepth = 0.22;
  const mkText = (str: string, size: number) => {
    const geo = new TextGeometry(str, {
      font, size, depth: textDepth, curveSegments: 6,
      bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1,
    } as any);
    geo.computeBoundingBox();
    return geo;
  };

  const regisGeo = mkText('REGIS', 1.55);
  const regis = new THREE.Mesh(regisGeo, [face, side]);
  const regisH = regisGeo.boundingBox!.max.y - regisGeo.boundingBox!.min.y;
  regis.position.set(markBox.max.x + gap, markBox.max.y - regisH - 0.02, 0);
  group.add(regis);

  const pSize = 0.42, tracking = 0.24;
  const partners = new THREE.Group();
  let x = 0;
  for (const ch of 'PARTNERS') {
    const geo = mkText(ch, pSize);
    const m = new THREE.Mesh(geo, [face, side]);
    m.position.x = x;
    x += (geo.boundingBox!.max.x - geo.boundingBox!.min.x) + tracking;
    partners.add(m);
  }
  const regisBox = new THREE.Box3().setFromObject(regis);
  const regisW = regisBox.max.x - regisBox.min.x;
  const pW = x - tracking;
  const pScale = Math.min(1, regisW / pW);
  partners.scale.setScalar(pScale);
  partners.position.set(regisBox.min.x + (regisW - pW * pScale) / 2, regisBox.min.y - pSize * pScale - 0.42, 0.07);
  group.add(partners);

  const box = new THREE.Box3().setFromObject(group);
  const c = box.getCenter(new THREE.Vector3());
  group.children.forEach((m) => m.position.sub(c));
  group.scale.setScalar(1.7 / (box.max.x - box.min.x));
  return group;
}

/**
 * Full Regis Partners lockup (mark + wordmark) in 3D; tilts toward the mouse.
 * Fills its parent — size via className/style (e.g. width: 100%; aspect-ratio: 2.6/1).
 */
export default function RegisLockup3D({
  color = '#1a4f9c',
  sideColor = '#0f3a75',
  trackIntensity = 1,
  className,
  style,
}: RegisLockup3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 2.6, 0.1, 20);
    camera.position.set(0, 0, 4.2);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbcc8dc, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9db8ff, 0.7);
    rim.position.set(-3, -1, -2);
    scene.add(rim);

    let logo: THREE.Group | null = null;
    let baseScale = 1;
    buildLockup(color, sideColor).then((g) => {
      if (disposed) return;
      logo = g;
      baseScale = g.scale.x;
      scene.add(g);
    });

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
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
    window.addEventListener('pointermove', onMove);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (logo) {
        const t = (now - start) / 1000;
        const entrance = Math.min(1, t / 1.2);
        const easeOut = 1 - Math.pow(1 - entrance, 3);
        const idle = !reduced && now - lastMove > 2500 ? 1 : 0.3;
        cur.lerp(target, 0.06);
        logo.rotation.y =
          cur.x * 0.35 * trackIntensity + Math.sin(t * 0.4) * 0.08 * idle + (1 - easeOut) * -0.8;
        logo.rotation.x = cur.y * 0.22 * trackIntensity + Math.sin(t * 0.7) * 0.03;
        logo.position.y = Math.sin(t * 0.9) * 0.02;
        logo.scale.setScalar(baseScale * (0.75 + 0.25 * easeOut));
      }
      renderer.render(scene, camera);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
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
      host.removeChild(renderer.domElement);
    };
  }, [color, sideColor, trackIntensity]);

  return <div ref={hostRef} className={className} style={{ width: '100%', height: '100%', ...style }} />;
}
