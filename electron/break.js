const timer = document.querySelector('#timer');
const button = document.querySelector('#continue');
const note = document.querySelector('#note');

function format(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function render(state) {
  timer.textContent = format(state.breakRemaining);
  const finished = state.breakRemaining <= 0;
  button.disabled = !finished;
  button.textContent = finished ? '继续使用电脑' : '休息结束后继续';
  note.textContent = finished ? '休息完成，下一轮将重新计时' : '倒计时结束前，屏幕会保持锁定';
}

button.addEventListener('click', async () => {
  if (await window.breakControl.finish()) button.disabled = true;
});
window.breakControl.onState(render);
window.breakControl.getState().then(render);
