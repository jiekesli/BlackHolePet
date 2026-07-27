'use strict';

const canvas = document.getElementById('space');
const pointerCanvas = document.getElementById('pointer-layer');
const fileWarp = document.getElementById('file-warp');
const fileNameNode = fileWarp.querySelector('.name');
const statusNode = document.getElementById('status');
const gl = canvas.getContext('webgl2', {
  alpha: true,
  antialias: false,
  depth: false,
  premultipliedAlpha: true,
  powerPreference: 'high-performance',
});
const pointerContext = pointerCanvas.getContext('2d');

const vertexSource = `#version 300 es
precision highp float;
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uView;
uniform float uGrowth;
uniform float uPulse;
uniform vec3 uDiskColor;
uniform vec4 uWindowRect;
uniform vec4 uDisplayRect;
uniform sampler2D uDesktop;
out vec4 outputColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  local = local * local * (3.0 - 2.0 * local);
  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

vec3 desktopAt(vec2 offsetInPetSpace) {
  float minSide = min(uResolution.x, uResolution.y);
  vec2 offsetPixels = offsetInPetSpace * minSide;
  vec2 local = gl_FragCoord.xy / uResolution;
  float topY = 1.0 - local.y;
  vec2 point = vec2(
    uWindowRect.x - uDisplayRect.x + local.x * uWindowRect.z + offsetPixels.x,
    uWindowRect.y - uDisplayRect.y + topY * uWindowRect.w - offsetPixels.y
  );
  vec2 uv = point / uDisplayRect.zw;
  uv.y = 1.0 - uv.y;
  return texture(uDesktop, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
}

void main() {
  float minSide = min(uResolution.x, uResolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / minSide;
  float radius = length(p);
  float angle = atan(p.y, p.x);

  float eventRadius = 0.105 * (1.0 + uGrowth * 3.2);
  float influence = 1.0 - smoothstep(eventRadius * 1.15, 0.47, radius);
  float safeRadius = max(radius, eventRadius * 0.72);
  float bending = influence * eventRadius * eventRadius / (safeRadius + 0.045) * 0.92;
  float vortex = influence * influence * (0.105 + 0.035 * sin(uTime * 0.37));
  vec2 lensPoint = rotate2d(vortex) * normalize(p + vec2(0.00001)) * (radius + bending);
  vec2 lensOffset = lensPoint - p;

  float chroma = influence * 0.0017;
  vec3 lensColor;
  lensColor.r = desktopAt(lensOffset + normalize(p + 0.0001) * chroma).r;
  lensColor.g = desktopAt(lensOffset).g;
  lensColor.b = desktopAt(lensOffset - normalize(p + 0.0001) * chroma).b;

  float viewFlatten = uView < 0.5 ? 0.34 : (uView < 1.5 ? 0.88 : 0.145);
  float viewTilt = uView < 0.5 ? -0.12 : (uView < 1.5 ? 0.02 : 0.0);
  vec2 tilted = rotate2d(viewTilt) * p;
  vec2 diskSpace = vec2(tilted.x, tilted.y / viewFlatten);
  float diskRadius = length(diskSpace);
  float diskAngle = atan(diskSpace.y, diskSpace.x);

  float flow = diskAngle * 9.0 - log(max(diskRadius, 0.02)) * 17.0 - uTime * 2.15;
  float filaments = 0.5 + 0.5 * sin(flow + valueNoise(diskSpace * 38.0 + uTime * 0.08) * 4.2);
  filaments = pow(filaments, 2.4);
  float radialDust = valueNoise(vec2(diskRadius * 82.0 - uTime * 0.65, diskAngle * 6.0));
  float ringCore = exp(-pow((diskRadius - 0.235) / 0.026, 2.0));
  float ringHalo = exp(-pow((diskRadius - 0.255) / 0.083, 2.0)) * 0.38;
  float streams = exp(-pow((diskRadius - 0.34 - sin(flow * 0.21) * 0.018) / 0.072, 2.0));
  streams *= smoothstep(0.48, 0.16, diskRadius) * (0.18 + 0.38 * filaments);
  float disk = (ringCore * (0.92 + 0.22 * filaments) + ringHalo + streams) *
    (0.84 + radialDust * 0.22);

  float doppler = 0.72 + 0.48 * smoothstep(-0.8, 0.9, cos(diskAngle));
  vec3 warm = mix(uDiskColor * vec3(0.50, 0.34, 0.22), uDiskColor, 0.58);
  vec3 hot = mix(uDiskColor, vec3(1.0, 0.96, 0.83), 0.72);
  vec3 diskLight = mix(warm, hot, clamp(ringCore + filaments * 0.35, 0.0, 1.0));
  diskLight *= doppler * (0.72 + filaments * 0.55);

  float nearSide = smoothstep(0.035, -0.035, tilted.y);
  float backDisk = disk * (1.0 - nearSide);
  float frontDisk = disk * nearSide;

  float photonRing = exp(-pow((radius - eventRadius * 1.18) / 0.010, 2.0));
  float topArc = exp(-pow((abs(p.y) - eventRadius * 1.10) / 0.018, 2.0));
  topArc *= exp(-pow(p.x / (eventRadius * 1.7), 4.0)) * (0.35 + 0.65 * influence);

  float edgeFade = 1.0 - smoothstep(0.36, 0.485, radius);
  float opticalBody = clamp(influence * 0.92 + disk * 0.92 + photonRing, 0.0, 1.0);
  float alpha = edgeFade * opticalBody;
  vec3 color = lensColor;

  float backOpacity = clamp(backDisk * 1.15, 0.0, 0.96);
  color = mix(color, diskLight, backOpacity);
  float horizon = 1.0 - smoothstep(eventRadius * 0.965, eventRadius * 1.045, radius);
  color = mix(color, vec3(0.0015, 0.0017, 0.0022), horizon);

  float inward = clamp(1.0 - radius / eventRadius, 0.0, 1.0);
  float spiral = 0.5 + 0.5 * sin(angle * 7.0 - log(max(radius, 0.004)) * 13.0 - uTime * 2.6);
  spiral *= valueNoise(vec2(angle * 4.0, radius * 90.0 - uTime));
  color += vec3(0.055, 0.043, 0.035) * spiral * inward * (1.0 - inward) * 0.75;

  float frontOpacity = clamp(frontDisk * 1.3, 0.0, 0.98);
  color = mix(color, diskLight * 1.08, frontOpacity);
  color = mix(color, hot, clamp(photonRing * 0.92, 0.0, 0.94));
  color = mix(color, hot * 0.86, clamp(topArc * (uView < 1.5 ? 0.68 : 0.28), 0.0, 0.72));
  color = mix(
    color,
    hot,
    clamp(uPulse * exp(-pow((radius - eventRadius * 1.05) / 0.032, 2.0)), 0.0, 0.84)
  );

  float softCorona = exp(-pow((radius - eventRadius * 1.55) / 0.10, 2.0)) * 0.075;
  color += uDiskColor * softCorona * influence;
  alpha = max(alpha, edgeFade * (disk * 0.78 + photonRing + topArc * 0.5));
  alpha = clamp(alpha, 0.0, 1.0);
  outputColor = vec4(max(color, vec3(0.0)) * alpha, alpha);
}`;

const state = {
  view: 0,
  growth: 0,
  diskColor: [0.85, 0.54, 0.31],
  performanceMode: 'auto',
  placement: undefined,
  draggingWindow: false,
  lastScreenPoint: { x: 0, y: 0 },
  pointerInside: false,
  pointerPoint: { x: 0, y: 0 },
  pointerTarget: { x: 0, y: 0 },
  absorptionActive: false,
  pulseStarted: -10000,
};

function showStatus(message, duration = 1800) {
  statusNode.textContent = message;
  statusNode.classList.add('visible');
  clearTimeout(showStatus.timeout);
  showStatus.timeout = setTimeout(() => statusNode.classList.remove('visible'), duration);
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || '着色器编译失败');
  }
  return shader;
}

function makeProgram() {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || '着色器链接失败');
  }
  return program;
}

if (!gl) {
  showStatus('当前显卡不支持 WebGL2', 10000);
  throw new Error('WebGL2 is required');
}

let program;
try {
  program = makeProgram();
} catch (error) {
  document.body.dataset.renderError = error.message;
  showStatus(error.message, 30000);
  console.error(error);
  throw error;
}
const uniforms = Object.fromEntries(
  [
    'uResolution',
    'uTime',
    'uView',
    'uGrowth',
    'uPulse',
    'uDiskColor',
    'uWindowRect',
    'uDisplayRect',
    'uDesktop',
  ].map((name) => [name, gl.getUniformLocation(program, name)]),
);
const desktopTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, desktopTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texImage2D(
  gl.TEXTURE_2D,
  0,
  gl.RGBA,
  1,
  1,
  0,
  gl.RGBA,
  gl.UNSIGNED_BYTE,
  new Uint8Array([0, 0, 0, 0]),
);
gl.useProgram(program);
gl.uniform1i(uniforms.uDesktop, 0);

function deviceScale() {
  const qualityCaps = { quality: 2, balanced: 1.5, battery: 1, auto: 1.6 };
  return Math.min(window.devicePixelRatio || 1, qualityCaps[state.performanceMode] || 1.6);
}

function resizeCanvases() {
  const dpr = deviceScale();
  const width = Math.max(1, Math.round(innerWidth * dpr));
  const height = Math.max(1, Math.round(innerHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    pointerCanvas.width = width;
    pointerCanvas.height = height;
    gl.viewport(0, 0, width, height);
  }
}

function updateDesktop(payload) {
  if (!payload?.image) return;
  state.placement = payload.placement || state.placement;
  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, desktopTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  };
  image.src = payload.image;
}

function applyPreferences(payload) {
  if (!payload) return;
  state.diskColor = payload.diskColor || state.diskColor;
  state.growth = Number(payload.growth) || 0;
  state.performanceMode = payload.performanceMode || 'auto';
  state.placement = payload.placement || state.placement;
  resizeCanvases();
}

function frameInterval() {
  return { quality: 1000 / 60, balanced: 1000 / 45, battery: 1000 / 30, auto: 1000 / 52 }[
    state.performanceMode
  ] || 1000 / 52;
}

let previousFrame = 0;
function render(now) {
  requestAnimationFrame(render);
  if (now - previousFrame < frameInterval()) return;
  previousFrame = now;
  resizeCanvases();
  const placement = state.placement;
  if (!placement) return;

  const pulseAge = Math.max(0, (now - state.pulseStarted) / 1000);
  const pulse = pulseAge < 0.8 ? Math.sin((pulseAge / 0.8) * Math.PI) : 0;
  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, desktopTexture);
  gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
  gl.uniform1f(uniforms.uTime, now / 1000);
  gl.uniform1f(uniforms.uView, state.view);
  gl.uniform1f(uniforms.uGrowth, state.growth);
  gl.uniform1f(uniforms.uPulse, pulse);
  gl.uniform3fv(uniforms.uDiskColor, state.diskColor);
  gl.uniform4f(
    uniforms.uWindowRect,
    placement.window.x,
    placement.window.y,
    placement.window.width,
    placement.window.height,
  );
  gl.uniform4f(
    uniforms.uDisplayRect,
    placement.display.x,
    placement.display.y,
    placement.display.width,
    placement.display.height,
  );
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  drawDistortedPointer(now);
}

function drawCursorArrow(ctx, x, y, opacity, rotation, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale * (0.84 + opacity * 0.16));
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 22);
  ctx.lineTo(5.5, 16.5);
  ctx.lineTo(10, 26);
  ctx.lineTo(14, 24);
  ctx.lineTo(9.5, 14.5);
  ctx.lineTo(17, 14);
  ctx.closePath();
  ctx.fillStyle = '#f8f8f8';
  ctx.strokeStyle = '#151515';
  ctx.lineWidth = 2.3;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawDistortedPointer(now) {
  const dpr = pointerCanvas.width / Math.max(1, innerWidth);
  pointerContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  pointerContext.clearRect(0, 0, innerWidth, innerHeight);
  if (!state.pointerInside || state.draggingWindow || state.absorptionActive) return;
  state.pointerPoint.x += (state.pointerTarget.x - state.pointerPoint.x) * 0.32;
  state.pointerPoint.y += (state.pointerTarget.y - state.pointerPoint.y) * 0.32;

  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const dx = state.pointerPoint.x - cx;
  const dy = state.pointerPoint.y - cy;
  const distance = Math.hypot(dx, dy);
  const captureRadius = Math.min(innerWidth, innerHeight) * 0.46;
  const horizon = Math.min(innerWidth, innerHeight) * 0.105;
  const pull = Math.max(0, Math.min(1, 1 - distance / captureRadius));
  const theta = Math.atan2(dy, dx) + pull * pull * 1.22 + Math.sin(now / 320) * pull * 0.06;
  const squeezedRadius = distance * (1 - pull * 0.48);
  const px = cx + Math.cos(theta) * squeezedRadius;
  const py = cy + Math.sin(theta) * squeezedRadius * (1 - pull * 0.58);
  const fade = Math.max(0, Math.min(1, (distance - horizon * 0.72) / (horizon * 0.82)));
  drawCursorArrow(pointerContext, px, py, fade, pull * 0.72, 1 - pull * 0.44);
}

function insideCaptureArea(x, y) {
  return Math.hypot(x - innerWidth / 2, y - innerHeight / 2) <=
    Math.min(innerWidth, innerHeight) * 0.46;
}

function trackPointer(event) {
  const captured = insideCaptureArea(event.clientX, event.clientY);
  state.pointerTarget = { x: event.clientX, y: event.clientY };
  if (!state.pointerInside) state.pointerPoint = { ...state.pointerTarget };
  state.pointerInside = captured;
  canvas.classList.toggle('captured', captured);
  if (!state.draggingWindow) window.desktopPet?.passPointerThrough(!captured);
}

canvas.addEventListener('mousemove', trackPointer);
canvas.addEventListener('mousedown', (event) => {
  if (event.button !== 0 || state.absorptionActive || !insideCaptureArea(event.clientX, event.clientY)) return;
  state.draggingWindow = true;
  state.lastScreenPoint = { x: event.screenX, y: event.screenY };
  window.desktopPet?.passPointerThrough(false);
});

window.addEventListener('mousemove', (event) => {
  if (!state.draggingWindow) return;
  const dx = event.screenX - state.lastScreenPoint.x;
  const dy = event.screenY - state.lastScreenPoint.y;
  if (!dx && !dy) return;
  state.lastScreenPoint = { x: event.screenX, y: event.screenY };
  window.desktopPet?.moveBy(dx, dy).then((placement) => {
    if (placement) state.placement = placement;
  });
});

function stopWindowDrag() {
  state.draggingWindow = false;
}
window.addEventListener('mouseup', stopWindowDrag);
window.addEventListener('blur', stopWindowDrag);
window.addEventListener('mouseleave', () => {
  if (!state.draggingWindow) {
    state.pointerInside = false;
    canvas.classList.remove('captured');
  }
});

canvas.addEventListener('dblclick', () => {
  state.view = (state.view + 1) % 3;
  showStatus(`黑洞形态 ${state.view + 1}`);
});

function animateFileIn(startX, startY, name) {
  state.absorptionActive = true;
  state.pointerInside = false;
  fileNameNode.textContent = name;
  fileWarp.style.opacity = '1';
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const offsetX = startX - cx;
  const offsetY = startY - cy;
  const side = Math.sign(offsetX) || 1;
  const started = performance.now();
  const duration = 980;
  return new Promise((resolve) => {
    const step = (now) => {
      const t = Math.min(1, (now - started) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const orbit = Math.cos(ease * Math.PI * 2.5);
      const x = offsetX * (1 - ease) + side * orbit * 42 * (1 - ease);
      const y = offsetY * Math.pow(1 - ease, 3) + Math.sin(ease * Math.PI * 5) * 15 * (1 - ease);
      const scaleX = Math.max(0.025, 1 - ease * 0.96);
      const scaleY = Math.max(0.055, 1 - ease * 0.88);
      const rotation = side * ease * ease * 1080;
      fileWarp.style.opacity = String(Math.max(0, 1 - Math.pow(t, 7)));
      fileWarp.style.filter = `blur(${ease * 2.8}px)`;
      fileWarp.style.transform =
        `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg) ` +
        `skewX(${side * ease * 28}deg) scale(${scaleX}, ${scaleY})`;
      if (t < 1) requestAnimationFrame(step);
      else {
        fileWarp.style.opacity = '0';
        state.absorptionActive = false;
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

for (const eventName of ['dragenter', 'dragover']) {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    window.desktopPet?.passPointerThrough(false);
  });
}

window.addEventListener('drop', async (event) => {
  event.preventDefault();
  if (state.absorptionActive) return;
  const files = [...(event.dataTransfer?.files || [])];
  const paths = files.map((file) => window.desktopPet?.filePath(file)).filter(Boolean);
  if (!paths.length) {
    showStatus('没有可回收的文件');
    return;
  }
  await animateFileIn(event.clientX, event.clientY, files[0].name);
  const results = await window.desktopPet.trash(paths);
  const success = results.filter((item) => item.ok).length;
  if (success) {
    state.pulseStarted = performance.now();
    showStatus(`已吸入 ${success} 个项目`);
  } else {
    showStatus(results[0]?.error || '文件吸入失败', 2600);
  }
});

window.desktopPet?.onPreferences(applyPreferences);
window.desktopPet?.onDesktop(updateDesktop);
window.desktopPet?.onPlacement((placement) => {
  if (placement) state.placement = placement;
});
window.desktopPet?.onCommand((command) => {
  if (command === 'next-view') {
    state.view = (state.view + 1) % 3;
    showStatus(`黑洞形态 ${state.view + 1}`);
  }
});
window.addEventListener('resize', resizeCanvases);
window.desktopPet?.placement().then((placement) => {
  state.placement = placement;
});
window.desktopPet?.refreshDesktop();
resizeCanvases();
requestAnimationFrame(render);
