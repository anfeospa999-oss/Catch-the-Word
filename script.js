// Catch the Word V2: a small arcade game built with plain JavaScript.
const categories = {
  ANIMALS: ['CAT','DOG','LION','TIGER','HORSE','COW','BIRD','FISH','MONKEY','ELEPHANT','BEAR','WOLF','RABBIT','SNAKE','TURTLE','DOLPHIN','SHARK','EAGLE','GIRAFFE','ZEBRA'],
  FOOD: ['APPLE','PIZZA','BREAD','CHEESE','RICE','MILK','BANANA','CHICKEN','BURGER','POTATO','ORANGE','CARROT','EGG','SOUP','CAKE','COOKIE','SANDWICH','SALAD','CHOCOLATE','ICE CREAM'],
  OBJECTS: ['PHONE','COMPUTER','BOOK','TABLE','CHAIR','PEN','BAG','CLOCK','DOOR','KEY','LAMP','BOTTLE','CAMERA','GUITAR','WINDOW','BED','PENCIL','BACKPACK','WATCH','NOTEBOOK'],
  TECHNOLOGY: ['COMPUTER','KEYBOARD','MOUSE','SCREEN','PHONE','LAPTOP','TABLET','SERVER','ROUTER','PRINTER','CAMERA','SOFTWARE','HARDWARE','DATABASE','CODE','PROGRAM','WEBSITE','APP','ROBOT','SENSOR'],
  CLOTHES: ['SHIRT','PANTS','SHOES','HAT','JACKET','DRESS','SOCKS','BELT','COAT','SKIRT','TIE','GLOVES','SCARF','BOOTS','SHORTS','SWEATER','CAP','JEANS'],
  PLACES: ['SCHOOL','HOTEL','HOSPITAL','PARK','AIRPORT','RESTAURANT','BANK','LIBRARY','OFFICE','MUSEUM','BEACH','MOUNTAIN','CITY','VILLAGE','STATION','MARKET','STORE','CHURCH','STADIUM','UNIVERSITY'],
  TRANSPORTATION: ['CAR','BUS','TRAIN','PLANE','BIKE','MOTORCYCLE','BOAT','SHIP','TAXI','TRUCK','HELICOPTER','SUBWAY','SCOOTER','VAN','AMBULANCE'],
  JOBS: ['PROGRAMMER','TEACHER','DOCTOR','ENGINEER','NURSE','POLICE OFFICER','CHEF','DRIVER','FARMER','DESIGNER','MECHANIC','PILOT','LAWYER','DENTIST','ARTIST'],
  ACTIONS: ['RUN','JUMP','WALK','SWIM','EAT','DRINK','READ','WRITE','SLEEP','SING','DANCE','PLAY','WORK','STUDY','COOK','DRIVE','BUILD','THINK','SPEAK'],
  NATURE: ['TREE','FLOWER','RIVER','MOUNTAIN','SUN','MOON','RAIN','CLOUD','WIND','SNOW','FOREST','OCEAN','BEACH','ROCK','GRASS','FIRE','STAR','RAINBOW','LAKE','ISLAND']
};
const allWords = Object.values(categories).flat();
const difficultySettings = {
  easy: { label: 'EASY', maxWords: 3, startSpeed: .18, growth: .45, wrongChance: .38, playerStep: 4, spawnDelay: 520, reactionStart: .68 },
  medium: { label: 'MEDIUM', maxWords: 4, startSpeed: .22, growth: .65, wrongChance: .45, playerStep: 5, spawnDelay: 430, reactionStart: .75 },
  hard: { label: 'HARD', maxWords: 5, startSpeed: .26, growth: .85, wrongChance: .52, playerStep: 6, spawnDelay: 360, reactionStart: .82 }
};
const $ = id => document.getElementById(id);
const gameArea = $('game-area'), gameWrap = gameArea.parentElement, wordsContainer = $('words'), player = $('player'), message = $('message');
const gameCard = document.querySelector('.game-card');
const particleCanvas = $('particle-canvas'), particleContext = particleCanvas.getContext('2d');
let selectedDifficulty = 'easy';
let soundEnabled = true;
let audioContext;
let musicGain;
let musicTimer;
let musicStep = 0;
let state = makeState();
let particles = [];

function makeState() { return { playing: false, counting: false, isPaused: false, category: 'ANIMALS', score: 0, combo: 0, bestCombo: 0, lives: 3, time: 60, caught: 0, playerX: 50, blasterEnergy: 3, words: [], lastSpawn: 0, lastPowerUpAt: -10000, powerUpsSpawned: 0, powerUpActive: false, animationId: null, timerId: null, shield: false, slowUntil: 0, speedUntil: 0, doubleUntil: 0 }; }
function randomItem(list) { return list[Math.floor(Math.random() * list.length)]; }
function bestScore() { return Number(localStorage.getItem('catchTheWordBest') || 0); }
function setMessage(text, type = '') { message.textContent = text; message.className = `message ${type}`; }
function resizeCanvas() { particleCanvas.width = gameArea.clientWidth; particleCanvas.height = gameArea.clientHeight; }
function burstParticles(x, y, color = '#75f5df', amount = 14) {
  for (let index = 0; index < amount && particles.length < 90; index += 1) particles.push({ x, y, vx: (Math.random() - .5) * 3.8, vy: (Math.random() - .5) * 3.8 - 1, life: 1, color, size: 2 + Math.random() * 3 });
}
function updateParticles() {
  particleContext.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  particles = particles.filter(particle => particle.life > 0);
  particles.forEach(particle => { particle.x += particle.vx; particle.y += particle.vy; particle.vy += .035; particle.life -= .035; particleContext.globalAlpha = particle.life; particleContext.fillStyle = particle.color; particleContext.fillRect(particle.x, particle.y, particle.size, particle.size); });
  particleContext.globalAlpha = 1;
}
function updateHud() {
  $('score').textContent = state.score;
  $('best-score').textContent = bestScore();
  $('time').textContent = state.time;
  $('lives').textContent = `${'❤️ '.repeat(Math.max(0, state.lives))}${'🖤 '.repeat(3 - state.lives)}`.trim();
  $('blaster-energy').textContent = state.blasterEnergy > 0 ? `⚡ ${state.blasterEnergy}` : '⚡ EMPTY';
  $('blaster-energy').parentElement.classList.toggle('empty', state.blasterEnergy <= 0);
  $('combo').textContent = `COMBO x${state.combo}`;
  $('difficulty-label').textContent = difficultySettings[selectedDifficulty].label;
  $('objective').querySelector('strong').textContent = `🎯 CATCH ONLY ${state.category}`;
  $('time').parentElement.classList.toggle('urgent', state.time <= 10);
}
function showPowerStatus(power, duration = 6000) { const labels = { speed: '⚡ SPEED BOOST', shield: '🛡 SHIELD ACTIVE', slow: '⏱ TIME SLOWED', double: '×2 DOUBLE SCORE', ammo: '🔋 +2 ENERGY' }; const status = $('power-status'); if (!status) return; status.textContent = labels[power]; status.classList.remove('hidden'); clearTimeout(state.powerStatusTimer); state.powerStatusTimer = setTimeout(() => status.classList.add('hidden'), duration); }
function showPoints(text, good, x = 50) {
  const points = $('floating-points'); points.textContent = text; points.className = `floating-points ${good ? 'good' : 'bad'}`; points.style.left = `${x}%`; points.style.top = '66%';
  points.addEventListener('animationend', () => { points.textContent = ''; }, { once: true });
}
function ensureAudio() {
  if (!window.AudioContext && !window.webkitAudioContext) return null;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  } catch (error) {
    audioContext = null;
    return null;
  }
}
function playTone(kind) {
  if (!soundEnabled) return;
  const context = ensureAudio();
  if (!context) return;
  const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
  const tones = { good: [560, .09], bad: [170, .13], combo: [760, .16], count: [430, .12], go: [900, .28], best: [1100, .36], over: [110, .3], blast: [780, .1], destroy: [115, .22], lock: [410, .16], ammo: [980, .18] };
  oscillator.frequency.value = tones[kind][0]; oscillator.type = ['bad','destroy'].includes(kind) ? 'sawtooth' : 'sine'; gain.gain.setValueAtTime(kind === 'blast' ? .06 : .045, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + tones[kind][1]); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + tones[kind][1]);
}
function startMusic() {
  if (!soundEnabled || musicTimer) return;
  const context = ensureAudio();
  if (!context) return;
  if (!musicGain) { musicGain = context.createGain(); musicGain.connect(context.destination); }
  musicGain.gain.value = .45;
  const notes = [220, 277, null, 330, 392, null, 330, 277, 247, null, 330, 392, null, 330, 277, null];
  musicTimer = setInterval(() => {
    if (!soundEnabled) return;
    if (notes[musicStep % notes.length] === null) { musicStep += 1; return; }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = 'triangle';
    oscillator.frequency.value = notes[musicStep % notes.length];
    gain.gain.setValueAtTime(.001, now);
    gain.gain.linearRampToValueAtTime(.09, now + .025);
    gain.gain.exponentialRampToValueAtTime(.001, now + .32);
    oscillator.connect(gain).connect(musicGain);
    oscillator.start(now);
    oscillator.stop(now + .34);
    musicStep += 1;
  }, 300);
}
function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } if (musicGain) musicGain.gain.value = 0; }
function pauseMusic() { stopMusic(); }
function resumeMusic() { if (soundEnabled) { if (musicGain) musicGain.gain.value = .45; startMusic(); } }
function wait(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }
async function runCountdown() {
  const countdown = $('countdown');
  const number = $('countdown-number');
  countdown.classList.remove('hidden');
  $('countdown-label').textContent = 'READY';
  number.textContent = 'READY';
  number.classList.remove('countdown-pop');
  void number.offsetWidth;
  number.classList.add('countdown-pop');
  playTone('count');
  await wait(360);
  for (const value of ['3', '2', '1']) {
    if (!state.counting) return;
    number.textContent = value;
    number.classList.remove('countdown-pop');
    void number.offsetWidth;
    number.classList.add('countdown-pop');
    playTone('count');
    await wait(620);
  }
  if (!state.counting) return;
  $('countdown-label').textContent = 'GO!';
  number.textContent = 'GO!';
  number.classList.remove('countdown-pop');
  void number.offsetWidth;
  number.classList.add('countdown-pop');
  burstParticles(particleCanvas.width / 2, particleCanvas.height / 2, '#75f5df', 28);
  playTone('go');
  await wait(430);
  countdown.classList.add('hidden');
  state.counting = false;
  state.playing = true;
  const amount = difficultySettings[selectedDifficulty].maxWords - 1;
  for (let index = 0; index < amount; index += 1) createWord(index * 140);
  state.lastSpawn = performance.now();
  if (createPowerUp()) state.lastPowerUpAt = performance.now();
  state.timerId = setInterval(updateTimer, 1000);
  state.animationId = requestAnimationFrame(gameLoop);
}
function startGame() {
  if (state.playing || state.counting) return;
  if (state.animationId) cancelAnimationFrame(state.animationId); if (state.timerId) clearInterval(state.timerId);
  state = makeState(); state.counting = true; const requestedCategory = $('category-select').value; state.category = requestedCategory === 'RANDOM' ? randomItem(Object.keys(categories)) : requestedCategory;
  wordsContainer.innerHTML = ''; particles = []; resizeCanvas(); gameCard.classList.remove('run-complete'); gameWrap.classList.remove('is-paused'); $('pause-panel').classList.add('hidden'); player.style.left = '50%'; $('menu-panel').classList.add('hidden'); $('game-over-panel').classList.add('hidden'); $('game-screen').classList.remove('hidden'); updateHud(); $('objective').classList.remove('target-pulse'); void $('objective').offsetWidth; $('objective').classList.add('target-pulse'); setMessage('Catch the correct words!', 'success');
  startMusic(); runCountdown();
}
const spawnLanes = [8, 25, 42, 58, 75, 90];
function chooseSpawnX(minDistance = 17) {
  const candidates = [...spawnLanes].sort(() => Math.random() - .5);
  let bestCandidate = 50; let bestClearance = -1;
  for (const lane of candidates) {
    const candidate = Math.max(6, Math.min(92, lane + (Math.random() * 8 - 4)));
    const clearance = state.words.length ? Math.min(...state.words.map(word => Math.abs(word.x - candidate))) : Infinity;
    if (clearance > bestClearance) { bestCandidate = candidate; bestClearance = clearance; }
    if (clearance >= minDistance) return candidate;
  }
  return bestCandidate;
}
function createWord(startOffset = 0) {
  const settings = difficultySettings[selectedDifficulty]; if (!state.playing || state.words.length >= settings.maxWords) return;
  const correctWords = categories[state.category]; const correctActive = state.words.some(word => !word.power && word.element.dataset.correct === 'true'); const isCorrect = !correctActive && Math.random() > settings.wrongChance;
  const source = isCorrect ? correctWords : allWords.filter(word => !correctWords.includes(word));
  if (startOffset === 0 && state.words.some(word => word.y > -190)) startOffset = 150;
  const element = document.createElement('div'); element.className = 'falling-word'; element.textContent = randomItem(source); element.dataset.correct = isCorrect;
  const left = chooseSpawnX(17);
  element.style.left = `${left}%`; element.style.top = `${-startOffset - 45}px`; wordsContainer.appendChild(element);
  state.words.push({ element, x: left, y: -startOffset - 45, speed: settings.startSpeed + Math.random() * .035, power: false, inReaction: false });
}
function createPowerUp() {
  if (!state.playing || state.powerUpActive) return false;
  const powers = [{ type: 'speed', icon: '⚡' }, { type: 'shield', icon: '🛡️' }, { type: 'slow', icon: '❄️' }, { type: 'double', icon: '💰' }, { type: 'ammo', icon: '🔋' }]; const selected = randomItem(powers);
  const element = document.createElement('div'); element.className = 'falling-word power-up'; element.dataset.power = selected.type; element.setAttribute('aria-label', `${selected.type} power-up`); element.textContent = selected.icon;
  const left = chooseSpawnX(20);
  const spawnY = state.words.some(word => word.y > -140) ? -190 : -50;
  element.style.left = `${left}%`; element.style.top = `${spawnY}px`; wordsContainer.appendChild(element); state.words.push({ element, x: left, y: spawnY, speed: difficultySettings[selectedDifficulty].startSpeed + .02, power: true, inReaction: false }); state.powerUpsSpawned += 1; state.powerUpActive = true; return true;
}
function removeWord(word) { word.element.remove(); state.words = state.words.filter(item => item !== word); if (word.power) { state.powerUpActive = false; state.lastPowerUpAt = performance.now(); } }
function updateScore(points) { state.score = Math.max(0, state.score + points); updateHud(); const hud = document.querySelector('.hud'); hud.classList.remove('pop'); void hud.offsetWidth; hud.classList.add('pop'); }
function triggerCamera(className) { gameWrap.classList.remove(className); void gameWrap.offsetWidth; gameWrap.classList.add(className); setTimeout(() => gameWrap.classList.remove(className), 350); }
function performanceMessage() { if (state.score >= 500) return 'VOCABULARY MASTER!'; if (state.score >= 250) return 'GREAT JOB!'; if (state.score >= 100) return 'GOOD JOB!'; return 'KEEP PRACTICING!'; }
function loseLife(reason) {
  if (state.shield) { state.shield = false; setMessage('🛡️ Shield protected you!', 'success'); return; }
  state.lives -= 1; state.combo = 0; player.classList.remove('shake'); void player.offsetWidth; player.classList.add('shake'); $('lives').parentElement.classList.remove('life-hit'); void $('lives').offsetWidth; $('lives').parentElement.classList.add('life-hit'); triggerCamera('camera-shake'); updateHud(); setMessage(reason, 'wrong'); playTone('bad'); if (state.lives <= 0) endGame('lives');
}
function handlePowerUp(word) {
  const duration = 6000; const now = performance.now(); const power = word.element.dataset.power;
  if (power === 'ammo') { state.blasterEnergy = Math.min(5, state.blasterEnergy + 2); updateHud(); showPowerStatus(power, 2800); setMessage('+2 ENERGY', 'success'); burstParticles(word.x / 100 * particleCanvas.width, word.element.offsetTop, '#8be8ff', 24); triggerCamera('camera-flash'); playTone('ammo'); return; }
  if (power === 'speed') state.speedUntil = now + duration; if (power === 'shield') state.shield = true; if (power === 'slow') state.slowUntil = now + duration; if (power === 'double') state.doubleUntil = now + duration;
  const powerMessages = { speed: 'SPEED BOOST!', shield: 'SHIELD ACTIVE!', slow: 'TIME SLOWED!', double: 'DOUBLE SCORE!', ammo: '+2 ENERGY' };
  player.classList.add('power-aura'); setTimeout(() => player.classList.remove('power-aura'), duration); showPowerStatus(power, duration);
  burstParticles(word.x / 100 * particleCanvas.width, word.element.offsetTop, '#ffd36a', 20); triggerCamera('camera-flash'); setMessage(powerMessages[power], 'success'); playTone('combo');
}
function handleCatch(word) {
  if (word.power) { handlePowerUp(word); removeWord(word); createWord(); return; }
  if (word.element.dataset.correct === 'true') {
    state.combo += 1; state.caught += 1; state.bestCombo = Math.max(state.bestCombo, state.combo); const bonus = state.combo >= 3 ? 5 : 0; const multiplier = performance.now() < state.doubleUntil ? 2 : 1; const points = (10 + bonus) * multiplier;
    updateScore(points); if (state.combo >= 3) { $('combo').classList.remove('combo-pop'); void $('combo').offsetWidth; $('combo').classList.add('combo-pop'); } burstParticles(word.x / 100 * particleCanvas.width, word.element.offsetTop, state.combo >= 3 ? '#ffd36a' : '#75f5df', state.combo >= 3 ? 24 : 14); showPoints(`+${points}`, true, word.x); player.classList.remove('catch'); void player.offsetWidth; player.classList.add('catch'); triggerCamera('camera-flash'); setMessage(state.combo >= 5 ? `🔥 COMBO x${state.combo}! ON FIRE! +${points}` : state.combo >= 3 ? `🔥 COMBO x${state.combo}! +${points} points` : `✅ Correct! +${points} points`, state.combo >= 3 ? 'combo' : 'success'); playTone(state.combo >= 3 ? 'combo' : 'good');
  } else { state.combo = 0; burstParticles(word.x / 100 * particleCanvas.width, word.element.offsetTop, '#ff718c', 9); updateScore(-5); showPoints('-5', false, word.x); setMessage('❌ Wrong word! -5 points', 'wrong'); playTone('bad'); }
  updateHud(); removeWord(word); createWord();
}
function getBlastTarget(explicitElement = null) {
  if (explicitElement) return state.words.find(word => word.element === explicitElement && !word.power) || null;
  return state.words.filter(word => !word.power && !word.blasting && word.element.dataset.correct !== 'true').sort((a, b) => b.y - a.y)[0] || null;
}
function fireBlaster(explicitElement = null) {
  if (!state.playing || state.isPaused) return;
  if (state.blasterEnergy <= 0) { setMessage('⚡ BLASTER EMPTY', 'wrong'); playTone('bad'); return; }
  const target = getBlastTarget(explicitElement);
  if (!target) { setMessage('NO TARGET IN RANGE', 'wrong'); playTone('lock'); return; }
  state.blasterEnergy -= 1; updateHud(); playTone('blast');
  player.classList.remove('blaster-fire'); void player.offsetWidth; player.classList.add('blaster-fire');
  const areaRect = gameArea.getBoundingClientRect(); const playerRect = player.getBoundingClientRect(); const targetRect = target.element.getBoundingClientRect();
  const projectile = document.createElement('i'); projectile.className = 'blaster-projectile'; projectile.style.left = `${playerRect.left + playerRect.width / 2 - areaRect.left}px`; projectile.style.top = `${playerRect.top + playerRect.height * .22 - areaRect.top}px`; gameArea.appendChild(projectile);
  requestAnimationFrame(() => { projectile.style.left = `${targetRect.left + targetRect.width / 2 - areaRect.left}px`; projectile.style.top = `${targetRect.top + targetRect.height / 2 - areaRect.top}px`; });
  target.blasting = true;
  setTimeout(() => {
    projectile.remove();
    if (!state.words.includes(target)) return;
    const impactX = target.x / 100 * particleCanvas.width; const impactY = target.element.offsetTop + target.element.offsetHeight / 2;
    burstParticles(impactX, impactY, target.element.dataset.correct === 'true' ? '#8be8ff' : '#ffbd4f', target.element.dataset.correct === 'true' ? 8 : 22);
    if (target.element.dataset.correct === 'true') { target.blasting = false; target.element.classList.add('target-locked'); setMessage('TARGET LOCKED — CAN\'T DESTROY TARGET', 'success'); playTone('lock'); setTimeout(() => target.element.classList.remove('target-locked'), 320); }
    else { target.element.classList.add('blaster-destroy'); setMessage('DESTROYED!', 'success'); triggerCamera('camera-shake'); playTone('destroy'); setTimeout(() => { if (state.words.includes(target)) { removeWord(target); createWord(); } }, 320); }
  }, 230);
}
function checkCollisions() {
  const playerBox = player.getBoundingClientRect(); state.words.slice().forEach(word => { if (word.blasting) return; const box = word.element.getBoundingClientRect(); if (box.bottom >= playerBox.top && box.top <= playerBox.bottom && box.right >= playerBox.left && box.left <= playerBox.right) handleCatch(word); });
}
function gameLoop(timestamp) {
  if (!state.playing || state.isPaused) return; const settings = difficultySettings[selectedDifficulty]; const progress = (60 - state.time) / 60; const speedBoost = 1 + progress * settings.growth; const slow = timestamp < state.slowUntil ? .55 : 1;
  let reactionCount = 0;
  state.words.slice().forEach(word => {
    word.y += word.speed * speedBoost * slow * 6;
    word.element.style.top = `${word.y}px`;
    const rawDepth = Math.max(0, Math.min(1, (word.y + 55) / (gameArea.clientHeight + 55)));
    const depth = rawDepth * rawDepth * (3 - 2 * rawDepth);
    const scale = .58 + depth * .62;
    const tilt = Math.sin(timestamp / 400 + word.x) * (2.5 - depth * 1.5);
    const blur = (1 - depth) * 3.6;
    const brightness = .48 + depth * .7;
    word.element.style.transform = `translateZ(${depth * 48}px) scale(${scale}) rotate(${tilt}deg)`;
    word.element.style.filter = `blur(${blur}px) brightness(${brightness}) saturate(${.55 + depth * .75})`;
    word.element.style.opacity = `${.38 + depth * .62}`;
    word.element.style.zIndex = String(4 + Math.round(depth * 6));
    word.element.style.setProperty('--depth-focus', depth.toFixed(3));
    const isReady = depth >= settings.reactionStart;
    word.element.classList.toggle('reaction-ready', isReady);
    if (isReady) reactionCount += 1;
    if (word.y > gameArea.clientHeight) {
      const missedCorrect = !word.power && word.element.dataset.correct === 'true';
      if (missedCorrect) { showPoints('MISS', false, word.x); burstParticles(word.x / 100 * particleCanvas.width, gameArea.clientHeight * .84, '#ff718c', 5); }
      removeWord(word); createWord();
      if (missedCorrect) loseLife('A correct word escaped! -1 ❤️');
    }
  });
  gameArea.classList.toggle('zone-active', reactionCount > 0);
  $('reaction-label').classList.toggle('active', reactionCount > 0);
  if (timestamp - state.lastSpawn > settings.spawnDelay) { state.lastSpawn = timestamp; const guaranteedPower = state.powerUpsSpawned < 4 && state.time > 8; const powerReady = !state.powerUpActive && timestamp - state.lastPowerUpAt > 3500 && (guaranteedPower || Math.random() < .35); if (powerReady && createPowerUp()) state.lastPowerUpAt = timestamp; else if (state.words.length < settings.maxWords) createWord(); }
  checkCollisions(); updateParticles(); state.animationId = requestAnimationFrame(gameLoop);
}
function updateTimer() { if (!state.playing) return; state.time -= 1; updateHud(); if (state.time <= 0) endGame('timeout'); }
function endGame(reason = 'timeout') {
  if (!state.playing) return; state.playing = false; clearInterval(state.timerId); cancelAnimationFrame(state.animationId); state.words.slice().forEach(removeWord); state.words = []; const previousBest = bestScore(); const best = Math.max(previousBest, state.score); const isNewBest = state.score > previousBest; localStorage.setItem('catchTheWordBest', best);
  stopMusic(); $('pause-panel').classList.add('hidden'); gameWrap.classList.remove('is-paused'); $('game-over-title').textContent = reason === 'lives' ? 'GAME OVER' : "TIME'S UP!"; $('final-score').textContent = state.score; $('final-combo').textContent = `x${state.bestCombo}`; $('final-caught').textContent = state.caught; $('final-best').textContent = best; $('final-category').textContent = `🎯 CATCH ONLY ${state.category}`; $('performance-message').textContent = reason === 'lives' ? performanceMessage() : "TIME'S UP! Great run!"; $('new-best').classList.toggle('hidden', !isNewBest); $('game-screen').classList.add('hidden'); $('game-over-panel').classList.remove('hidden'); gameCard.classList.add('run-complete'); setMessage(''); playTone(isNewBest ? 'best' : 'over');
}
function clearGameState() { clearInterval(state.timerId); cancelAnimationFrame(state.animationId); stopMusic(); state.words.slice().forEach(removeWord); wordsContainer.innerHTML = ''; state = makeState(); particles = []; $('pause-panel').classList.add('hidden'); $('countdown').classList.add('hidden'); gameWrap.classList.remove('is-paused'); }
function pauseGame() { if (!state.playing || state.isPaused) return; state.isPaused = true; clearInterval(state.timerId); cancelAnimationFrame(state.animationId); pauseMusic(); $('pause-panel').classList.remove('hidden'); gameWrap.classList.add('is-paused'); }
function resumeGame() { if (!state.isPaused) return; state.isPaused = false; $('pause-panel').classList.add('hidden'); gameWrap.classList.remove('is-paused'); state.lastSpawn = performance.now(); resumeMusic(); state.timerId = setInterval(updateTimer, 1000); state.animationId = requestAnimationFrame(gameLoop); }
function togglePause() { if (state.isPaused) resumeGame(); else pauseGame(); }
function goToMenu() { clearGameState(); gameCard.classList.remove('run-complete'); $('game-over-panel').classList.add('hidden'); $('game-screen').classList.add('hidden'); $('menu-panel').classList.remove('hidden'); }
function movePlayer(direction) { if (!state.playing) return; const settings = difficultySettings[selectedDifficulty]; const boost = performance.now() < state.speedUntil ? 1.65 : 1; state.playerX = Math.max(8, Math.min(92, state.playerX + direction * settings.playerStep * boost)); player.style.left = `${state.playerX}%`; player.classList.remove('moving'); void player.offsetWidth; player.classList.add('moving'); clearTimeout(player.moveTimer); player.moveTimer = setTimeout(() => player.classList.remove('moving'), 180); }
document.addEventListener('keydown', event => { const key = event.key.toLowerCase(); if (key === 'escape' && (state.playing || state.isPaused)) { event.preventDefault(); togglePause(); return; } if (key === ' ' || event.code === 'Space') { event.preventDefault(); fireBlaster(); return; } if (['arrowleft','arrowright','a','d'].includes(key)) event.preventDefault(); if (key === 'arrowleft' || key === 'a') movePlayer(-1); if (key === 'arrowright' || key === 'd') movePlayer(1); });
document.querySelectorAll('.difficulty').forEach(button => button.addEventListener('click', () => { selectedDifficulty = button.dataset.difficulty; playTone('good'); document.querySelectorAll('.difficulty').forEach(item => item.classList.toggle('active', item === button)); }));
$('start-button').addEventListener('click', startGame); $('again-button').addEventListener('click', startGame); $('menu-button').addEventListener('click', goToMenu); $('pause-button').addEventListener('click', togglePause); $('blast-button').addEventListener('click', () => fireBlaster()); $('resume-button').addEventListener('click', resumeGame); $('quit-pause-button').addEventListener('click', goToMenu); $('left-button').addEventListener('pointerdown', () => movePlayer(-1)); $('right-button').addEventListener('pointerdown', () => movePlayer(1));
wordsContainer.addEventListener('click', event => { const element = event.target.closest('.falling-word'); if (element) fireBlaster(element); });
 $('sound-button').addEventListener('click', () => { soundEnabled = !soundEnabled; $('sound-button').textContent = soundEnabled ? '🔊' : '🔇'; $('sound-button').classList.toggle('muted', !soundEnabled); if (soundEnabled) { ensureAudio(); startMusic(); playTone('good'); } else stopMusic(); });
$('how-button').addEventListener('click', () => $('how-panel').classList.remove('hidden')); $('close-how').addEventListener('click', () => $('how-panel').classList.add('hidden')); $('how-panel').addEventListener('click', event => { if (event.target === $('how-panel')) $('how-panel').classList.add('hidden'); });
window.addEventListener('resize', resizeCanvas); resizeCanvas(); updateHud();
