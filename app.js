const $ = selector => document.querySelector(selector);
const rewards = [
  { id: 'none', name: '原本的我', icon: '🐶', minutes: 0 },
  { id: 'glasses', name: '学者眼镜', icon: '👓', minutes: 25 },
  { id: 'hat', name: '小画家帽', icon: '🎩', minutes: 60 },
  { id: 'report', name: '专注报告', icon: '📊', minutes: 180 },
  { id: 'scarf', name: '暖暖围巾', icon: '🧣', minutes: 300 },
  { id: 'crown', name: '专注王冠', icon: '👑', minutes: 600 }
];

let current = { elapsed: 0, remaining: 3600, totalSeconds: 0, rounds: 0, points: 0, paused: false, mode: 'focus' };
let equipped = localStorage.getItem('banzhu-equipped') || 'none';

function format(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function render(state) {
  current = state;
  const todayMinutes = Math.floor(state.totalSeconds / 60);
  const sessionMinutes = Math.floor(state.elapsed / 60);
  $('#timer').textContent = format(state.remaining);
  $('#timerLabel').textContent = state.paused ? '计时已暂停' : '本轮连续使用';
  $('#timerButton').innerHTML = state.paused ? '<span>▶</span> 继续计时' : '<span>Ⅱ</span> 暂停计时';
  $('#todayMinutes').textContent = todayMinutes;
  $('#goalMinutes').textContent = 120;
  $('#goalProgress').style.width = `${Math.min(100, todayMinutes / 120 * 100)}%`;
  $('#roundCount').textContent = state.rounds;
  $('#pointsCount').textContent = state.points;
  const level = Math.floor(state.points / 100) + 1;
  $('#level').textContent = level;
  $('#levelPoints').textContent = state.points % 100;
  $('#nextLevelPoints').textContent = 100;
  $('#levelProgress').style.width = `${state.points % 100}%`;
  const next = rewards.find(reward => reward.minutes > todayMinutes) || rewards.at(-1);
  $('#nextRewardName').textContent = next.name;
  $('#rewardMinutes').textContent = Math.max(0, next.minutes - todayMinutes);
  $('#unlockHint').textContent = `${rewards.filter(reward => reward.minutes <= todayMinutes).length} 件已解锁`;

  const tired = sessionMinutes >= 40;
  $('#pet').classList.toggle('tired', tired);
  if (state.paused) {
    $('#petStatus').textContent = '计时暂停中';
    $('#thoughtBubble').textContent = '准备好后叫我继续';
  } else if (sessionMinutes >= 55) {
    $('#petStatus').textContent = '还有五分钟，记得保存';
    $('#thoughtBubble').textContent = '快收尾啦，马上起来走走';
  } else if (tired) {
    $('#petStatus').textContent = '眼睛有点酸，该准备休息了';
    $('#thoughtBubble').textContent = '写完这点就起来活动喔';
  } else {
    $('#petStatus').textContent = '正在和你一起专注';
    $('#thoughtBubble').textContent = '嘘，灵感正在靠近';
  }
  equip(equipped, false);
}

function equip(id, notify = true) {
  equipped = id;
  localStorage.setItem('banzhu-equipped', id);
  $('#pet').classList.toggle('has-glasses', id === 'glasses');
  $('#pet').classList.toggle('hat-on', id === 'hat' || id === 'crown');
  $('#petHat').style.background = id === 'crown' ? '#e9b84f' : '';
  if (notify) toast('装扮已换好');
}

function renderShop() {
  const minutes = Math.floor(current.totalSeconds / 60);
  $('#shopGrid').innerHTML = rewards.map(item => {
    const unlocked = minutes >= item.minutes;
    const selected = equipped === item.id;
    return `<div class="shop-card ${unlocked ? '' : 'locked'}"><div class="preview">${item.icon}</div><strong>${item.name}</strong><p>${unlocked ? (selected ? '正在使用' : '已解锁') : `累计 ${item.minutes} 分钟`}</p><button type="button" data-equip="${item.id}" ${unlocked ? '' : 'disabled'}>${selected ? '已装备' : '使用'}</button></div>`;
  }).join('');
  document.querySelectorAll('[data-equip]').forEach(button => button.addEventListener('click', () => {
    equip(button.dataset.equip);
    renderShop();
  }));
}

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  setTimeout(() => $('#toast').classList.remove('show'), 1800);
}

$('#timerButton').addEventListener('click', async () => {
  render(current.paused ? await window.desktopPet.resume() : await window.desktopPet.pause());
});
$('#resetButton').addEventListener('click', async () => {
  render(await window.desktopPet.reset());
  toast('本轮已重新计时');
});
$('#shopOpen').addEventListener('click', () => {
  renderShop();
  $('#shopDialog').showModal();
});
$('#settingsOpen').addEventListener('click', () => $('#settingsDialog').showModal());
$('#saveSettings').addEventListener('click', event => {
  event.preventDefault();
  $('#settingsDialog').close();
  toast('保护规则固定为 60 + 10 分钟');
});
$('#soundToggle').addEventListener('click', () => toast('55 分钟时会发送 Windows 通知'));

if (window.desktopPet) {
  window.desktopPet.onState(render);
  window.desktopPet.getState().then(render);
} else {
  $('#timerButton').disabled = true;
  $('#timerButton').textContent = '请在桌面应用中打开';
  render(current);
}
