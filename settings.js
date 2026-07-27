'use strict';

const controls = {
  blackHoleSize: document.getElementById('size'),
  gravityStrength: document.getElementById('gravity'),
  diskColor: document.getElementById('color'),
  performanceMode: document.getElementById('performance'),
};
const sizeValue = document.getElementById('size-value');
const gravityValue = document.getElementById('gravity-value');
const colorValue = document.getElementById('color-value');

let applying = false;
let updateTimer;

function display(state) {
  applying = true;
  controls.blackHoleSize.value = state.blackHoleSize;
  controls.gravityStrength.value = state.gravityStrength;
  controls.diskColor.value = state.diskColor;
  controls.performanceMode.value = state.performanceMode;
  sizeValue.value = Number(state.blackHoleSize).toFixed(3);
  gravityValue.value = `${Math.round(Number(state.gravityStrength) * 100)}%`;
  colorValue.value = state.diskColor.toUpperCase();
  applying = false;
}

function patch(key, value) {
  if (applying) return;
  clearTimeout(updateTimer);
  updateTimer = setTimeout(async () => {
    display(await window.petSettings.update({ [key]: value }));
  }, 45);
}

controls.blackHoleSize.addEventListener('input', (event) => {
  sizeValue.value = Number(event.target.value).toFixed(3);
  patch('blackHoleSize', Number(event.target.value));
});
controls.gravityStrength.addEventListener('input', (event) => {
  gravityValue.value = `${Math.round(Number(event.target.value) * 100)}%`;
  patch('gravityStrength', Number(event.target.value));
});
controls.diskColor.addEventListener('input', (event) => {
  colorValue.value = event.target.value.toUpperCase();
  patch('diskColor', event.target.value);
});
controls.performanceMode.addEventListener('change', (event) => {
  patch('performanceMode', event.target.value);
});

document.getElementById('reset').addEventListener('click', async () => {
  display(await window.petSettings.reset());
});
document.getElementById('close').addEventListener('click', () => window.petSettings.close());
window.petSettings.onState(display);
window.petSettings.read().then(display);
