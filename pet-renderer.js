const canvas = document.getElementById('pet-canvas');
const ctx = canvas.getContext('2d', { alpha: true });
const sprite = new Image();
sprite.src = 'assets/nailong/spritesheet.webp';

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const ROWS = {
  idle: { row: 0, frames: 6, fps: 3.2 },
  right: { row: 1, frames: 8, fps: 9.5 },
  left: { row: 2, frames: 8, fps: 9.5 },
  waving: { row: 3, frames: 4, fps: 5.2 },
  jumping: { row: 4, frames: 5, fps: 6.5 },
  failed: { row: 5, frames: 8, fps: 4.5 },
  waiting: { row: 6, frames: 6, fps: 3.4 },
  running: { row: 7, frames: 6, fps: 5.5 },
  review: { row: 8, frames: 6, fps: 4.2 },
};

let state = 'idle';
let stateStarted = performance.now();
let stateDuration = 0;
let dragging = false;
let dragPoint = { x: 0, y: 0 };
let dragMoveId = 0;
let lookAngle = null;
let targetLookAngle = null;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
}

function play(next, duration = 0) {
  state = next;
  stateStarted = performance.now();
  stateDuration = duration;
}

function approachAngle(current, target, amount) {
  const delta = ((target - current + 540) % 360) - 180;
  return (current + delta * amount + 360) % 360;
}

function draw(now) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);

  if (sprite.complete && sprite.naturalWidth > 0) {
    if (stateDuration > 0 && now - stateStarted >= stateDuration) play('idle');
    let row = ROWS[state] || ROWS.idle;
    let frame;
    if (state === 'idle' && targetLookAngle !== null) {
      lookAngle = lookAngle === null
        ? targetLookAngle
        : approachAngle(lookAngle, targetLookAngle, 0.16);
      const direction = Math.round(lookAngle / 22.5) % 16;
      row = { row: direction < 8 ? 9 : 10 };
      frame = direction < 8 ? direction : direction - 8;
    } else {
      const elapsed = Math.max(0, now - stateStarted) * 0.001;
      frame = Math.floor(elapsed * row.fps) % row.frames;
    }
    const targetHeight = Math.min(height * 0.94, 218);
    const targetWidth = targetHeight * CELL_WIDTH / CELL_HEIGHT;
    const x = (width - targetWidth) * 0.5;
    const y = height - targetHeight - 4;
    ctx.drawImage(
      sprite,
      frame * CELL_WIDTH,
      row.row * CELL_HEIGHT,
      CELL_WIDTH,
      CELL_HEIGHT,
      x,
      y,
      targetWidth,
      targetHeight,
    );
  }
  requestAnimationFrame(draw);
}

function updateHitTest(clientX, clientY) {
  if (!window.desktopPet || dragging) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const nx = (clientX - width * 0.5) / (width * 0.34);
  const ny = (clientY - height * 0.56) / (height * 0.43);
  const dx = clientX - width * 0.5;
  const dy = clientY - height * 0.52;
  if (Math.hypot(dx, dy) > 8) {
    targetLookAngle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  }
  window.desktopPet.passPointerThrough(nx * nx + ny * ny > 1);
}

canvas.addEventListener('mousemove', (event) => {
  updateHitTest(event.clientX, event.clientY);
});

canvas.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  dragging = true;
  dragPoint = { x: event.screenX, y: event.screenY };
  canvas.classList.add('dragging');
  window.desktopPet?.passPointerThrough(false);
});

window.addEventListener('mousemove', (event) => {
  if (!dragging || !window.desktopPet) return;
  const dx = event.screenX - dragPoint.x;
  const dy = event.screenY - dragPoint.y;
  if (dx === 0 && dy === 0) return;
  dragPoint = { x: event.screenX, y: event.screenY };
  play(dx < 0 ? 'left' : 'right');
  const moveId = ++dragMoveId;
  window.desktopPet.moveBy(dx, dy).then(() => {
    if (moveId !== dragMoveId) return;
  });
});

window.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  canvas.classList.remove('dragging');
  play('idle');
});

window.addEventListener('mouseleave', () => {
  if (!dragging) {
    targetLookAngle = null;
    lookAngle = null;
  }
});

canvas.addEventListener('dblclick', () => play('waving', 1500));
canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  play('jumping', 1000);
});

setInterval(() => {
  if (!dragging && state === 'idle') {
    play(Math.random() > 0.5 ? 'waving' : 'waiting', 1500);
  }
}, 9000);

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(draw);
