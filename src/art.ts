import * as THREE from 'three';

export function seeded(seed: number) { return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ramp = new THREE.DataTexture(new Uint8Array([90, 157, 207, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = THREE.NearestFilter; ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
export function toon(color: THREE.ColorRepresentation, print = false) {
  const material = new THREE.MeshToonMaterial({ color, gradientMap: ramp });
  if (print) {
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPrintPosition; varying vec3 vPrintNormal;');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPrintPosition = position; vPrintNormal = normalize(mat3(modelMatrix) * normal);');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPrintPosition; varying vec3 vPrintNormal;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float lightSide = dot(normalize(vPrintNormal), normalize(vec3(-4.0, 7.0, 5.0)));
        vec2 printUV = vec2(vPrintPosition.z + vPrintPosition.x * .55, vPrintPosition.y) * 37.0;
        vec2 cell = fract(printUV) - .5;
        float edge = max(fwidth(length(cell)), .035);
        float dotMark = 1.0 - smoothstep(.15 - edge, .15 + edge, length(cell));
        float wax = fract(sin(dot(floor(vPrintPosition.xz*vec2(75.,180.)+vPrintPosition.y*49.),vec2(127.1,311.7)))*43758.5453);
        float drag = sin(vPrintPosition.z*88.+sin(vPrintPosition.y*53.)*2.);
        outgoingLight *= .91 + wax*.14 + drag*.026;
        float shadowInk = (1.0 - smoothstep(.04, .65, lightSide)) * .19;
        outgoingLight *= 1.0 - dotMark * shadowInk;
        outgoingLight = mix(outgoingLight, outgoingLight * vec3(.80, .75, .94), (1.0 - smoothstep(-.25, .45, lightSide)) * .3);
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => 'capy-pastel-v2';
  }
  return material;
}
export function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, at: [number, number, number] = [0, 0, 0], scale?: [number, number, number]) {
  const m = new THREE.Mesh(geometry, material); m.position.set(...at); if (scale) m.scale.set(...scale); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export function line(points: THREE.Vector3[], material: THREE.Material, parent: THREE.Object3D) {
  const curve = new THREE.CatmullRomCurve3(points);
  return mesh(new THREE.TubeGeometry(curve, Math.max(4, points.length * 3), .008, 3, false), material, parent);
}
export function ellipsePoints(cx: number, cz: number, rx: number, rz: number, count: number, variation = .05) {
  return Array.from({ length: count }, (_, i) => { const a = i / count * Math.PI * 2; const r = 1 + Math.sin(a * 3 + .6) * variation + Math.cos(a * 5) * variation * .4; return new THREE.Vector2(cx + Math.cos(a) * rx * r, cz + Math.sin(a) * rz * r); });
}
export function flatShape(outline: THREE.Vector2[], holes: THREE.Vector2[][] = [], height = .1) {
  const all = outline.concat(...holes), triangles = THREE.ShapeUtils.triangulateShape(outline, holes);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(all.flatMap(p => [p.x, height, p.y]), 3));
  geo.setIndex(triangles.flat()); geo.computeVertexNormals(); return geo;
}
export function band(inner: THREE.Vector2[], outer: THREE.Vector2[], innerY: number, outerY: number) {
  const vertices: number[] = [], indices: number[] = [];
  inner.forEach((p, i) => { vertices.push(p.x, innerY, p.y, outer[i].x, outerY, outer[i].y); const n = (i + 1) % inner.length; indices.push(i*2, n*2, i*2+1, n*2, n*2+1, i*2+1); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}
