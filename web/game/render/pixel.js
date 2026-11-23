import * as THREE from 'three';
import { PIXEL, targetOptions, PALETTE } from './config.js';
import { toThree } from './court.js';

const OUTLINE_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const OUTLINE_FS = `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel;
uniform float near; uniform float far; uniform float levels; uniform float edge; varying vec2 vUv;
float lin(float d){ float z = d*2.0-1.0; return (2.0*near*far)/(far+near - z*(far-near)); }
void main(){
  vec3 c = texture2D(tColor, vUv).rgb;
  float d0 = lin(texture2D(tDepth, vUv).r);
  float e = 0.0;
  vec2 o[4]; o[0]=vec2(texel.x,0.); o[1]=vec2(-texel.x,0.); o[2]=vec2(0.,texel.y); o[3]=vec2(0.,-texel.y);
  for(int i=0;i<4;i++){ float d = lin(texture2D(tDepth, vUv+o[i]).r); e += step(0.06*d0 + 0.05, abs(d-d0)); }
  if (levels > 0.5) c = floor(c * levels + 0.5) / levels; // fewer colours: a limited palette
  c = mix(c, vec3(0.08,0.05,0.14), clamp(e,0.0,1.0) * edge);
  gl_FragColor = vec4(pow(c, vec3(1.0/2.2)), 1.0); // target holds linear colour
}`;

/** Renders a scene to a 480x270 target and shows it with crisp pixels and depth outlines. */
export function createPixelRenderer(canvas, size = PIXEL) {
  const W = size.width, H = size.height;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  const target = new THREE.WebGLRenderTarget(W, H, targetOptions());
  target.depthTexture = new THREE.DepthTexture(W, H);
  target.depthTexture.minFilter = target.depthTexture.magFilter = THREE.NearestFilter;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 260);

  const post = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: OUTLINE_VS, fragmentShader: OUTLINE_FS, depthTest: false,
      uniforms: {
        tColor: { value: target.texture }, tDepth: { value: target.depthTexture },
        texel: { value: new THREE.Vector2(1 / W, 1 / H) },
        near: { value: camera.near }, far: { value: camera.far },
        levels: { value: size.levels ?? 0 }, edge: { value: size.edge ?? 1 },
      },
    }));
  post.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(post);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function resize() {
    if (size.fit === false) { renderer.setSize(W, H, false); return; } // embedded: CSS lays it out
    // Largest box of the target's shape that fits the window (or, with cover, the smallest that fills it).
    const w = window.innerWidth, h = window.innerHeight;
    const scale = (size.cover ? Math.max : Math.min)(w / W, h / H);
    const cw = Math.floor(W * scale), ch = Math.floor(H * scale);
    renderer.setSize(cw, ch, false);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    canvas.style.left = `${Math.floor((w - cw) / 2)}px`;
    canvas.style.top = `${Math.floor((h - ch) / 2)}px`;
  }
  if (size.fit !== false) window.addEventListener('resize', resize);
  resize();

  return {
    scene, camera, renderer,
    /** cam: {ex,ey,ez,tx,ty,tz,fov} in core coordinates */
    setCamera(cam) {
      camera.position.set(...toThree(cam.ex, cam.ey, cam.ez));
      camera.lookAt(...toThree(cam.tx, cam.ty, cam.tz));
      if (Math.abs(camera.fov - cam.fov) > 1e-3) {
        camera.fov = cam.fov;
        camera.updateProjectionMatrix();
      }
    },
    render() {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    },
  };
}
