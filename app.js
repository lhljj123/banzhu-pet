const $ = selector => document.querySelector(selector);
let state = { elapsed: 0, remaining: 3600, totalSeconds: 0, rounds: 0, points: 0, paused: false };
let speechTimer;
let actionTimer;
let blinkTimer;

const timedActions = ['action-curious', 'action-wave', 'action-stretch'];

function format(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function say(title, text, sticky = false) {
  clearTimeout(speechTimer);
  $('#speechTitle').textContent = title;
  $('#speechText').textContent = text;
  $('#speech').classList.add('show');
  if (!sticky) speechTimer = setTimeout(() => $('#speech').classList.remove('show'), 4200);
}

function action(name, duration = 2400) {
  const cat = $('#photoCat');
  if (state.paused || state.elapsed >= 45 * 60) return;
  clearTimeout(actionTimer);
  cat.className = `photo-cat ${name}`;
  actionTimer = setTimeout(() => { cat.className = 'photo-cat action-idle'; }, duration);
}

function blink() {
  const cat = $('#photoCat');
  if (!state.paused) {
    cat.classList.add('blink');
    setTimeout(() => cat.classList.remove('blink'), 300);
  }
  clearTimeout(blinkTimer);
  blinkTimer = setTimeout(blink, 3500 + Math.random() * 4500);
}

function setStateAction(minutes) {
  const cat = $('#photoCat');
  clearTimeout(actionTimer);
  if (state.paused) {
    cat.className = 'photo-cat action-sleep';
    $('#zzz').classList.add('show');
  } else if (minutes >= 55) {
    cat.className = 'photo-cat action-urgent';
    $('#zzz').classList.remove('show');
  } else if (minutes >= 45) {
    cat.className = 'photo-cat action-tired';
    $('#zzz').classList.remove('show');
  } else if (!timedActions.some(name => cat.classList.contains(name))) {
    cat.className = 'photo-cat action-idle';
    $('#zzz').classList.remove('show');
  }
}

function render(next) {
  const previousMinutes = Math.floor(state.elapsed / 60);
  state = next;
  const minutes = Math.floor(state.elapsed / 60);
  const todayMinutes = Math.floor(state.totalSeconds / 60);
  $('#todayTime').textContent = `${todayMinutes} 分钟`;
  $('#roundTime').textContent = format(state.elapsed);
  $('#points').textContent = state.points;
  $('#rounds').textContent = `${state.rounds} 次`;
  $('#progress').style.width = `${Math.min(100, state.elapsed / state.focusSeconds * 100)}%`;
  $('#pauseButton').textContent = state.paused ? '▶' : 'Ⅱ';
  $('#pauseButton').title = state.paused ? '继续计时' : '暂停计时';
  setStateAction(minutes);

  if (state.paused && !document.querySelector('.speech.show')) say('我先睡一会儿', '准备好后再叫醒我', true);
  if (!state.paused && previousMinutes < 30 && minutes >= 30) say('已经半小时啦', '活动一下肩膀，我们再继续');
  if (!state.paused && previousMinutes < 45 && minutes >= 45) say('我有点坐不住了', '把手上的事情慢慢收个尾');
  if (!state.paused && previousMinutes < 55 && minutes >= 55) say('只剩五分钟', '记得保存，马上要休息啦', true);
}

function toggleStats(open) {
  const panel = $('#stats');
  const shouldOpen = open ?? !panel.classList.contains('open');
  panel.classList.toggle('open', shouldOpen);
  panel.setAttribute('aria-hidden', String(!shouldOpen));
}

function greet() {
  const choices = [
    ['action-wave', '嗨，我在这里', '摸鱼也要记得眨眨眼'],
    ['action-curious', '你在写什么呀', '让我也看看'],
    ['action-bounce', '收到你的摸摸', '继续加油，我陪着你'],
    ['action-stretch', '一起伸个懒腰', '肩膀放松一点']
  ];
  const [motion, title, text] = choices[Math.floor(Math.random() * choices.length)];
  action(motion, motion === 'action-bounce' ? 2200 : 2700);
  say(title, text);
}

$('#catZone').addEventListener('dblclick', () => toggleStats());
$('#catZone').addEventListener('mouseenter', () => action('action-curious', 2000));
$('#closeStats').addEventListener('click', event => { event.stopPropagation(); toggleStats(false); });
$('#greetButton').addEventListener('click', greet);
$('#pauseButton').addEventListener('click', async () => {
  render(state.paused ? await window.desktopPet.resume() : await window.desktopPet.pause());
  if (!state.paused) { $('#speech').classList.remove('show'); say('睡醒啦', '继续陪你工作'); }
});
$('#resetButton').addEventListener('click', async () => {
  render(await window.desktopPet.reset());
  action('action-bounce', 2200);
  say('重新开始计时', '这一轮也要照顾好自己');
});
$('#hideButton').addEventListener('click', () => window.desktopPet.hide());

if (window.desktopPet) {
  window.desktopPet.onState(render);
  window.desktopPet.getState().then(render);
  setTimeout(() => say('我来陪你啦', '点点我，会有不同动作'), 500);
  setTimeout(blink, 1800);
  setInterval(() => {
    if (!state.paused && state.elapsed < 45 * 60) action(timedActions[Math.floor(Math.random() * timedActions.length)]);
  }, 12000);
}
