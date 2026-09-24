// ============================================
// Дед алкоголик против бабки Палестинки
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const menuEl = document.getElementById('menu');
const gameOverEl = document.getElementById('gameOver');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const bgMusic = document.getElementById('bgMusic');

let W = 0, H = 0;
let DPR = Math.min(window.devicePixelRatio || 1, 2);

function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // Базовая шкала — привязываем к высоте экрана
    SCALE = Math.max(0.5, Math.min(H / 500, 1.6));
    GROUND_Y = H - Math.max(80, H * 0.18);
}
window.addEventListener('resize', resize);

// ---------- Мир ----------
let SCALE = 1;
let GROUND_Y = 400;
const GRAVITY = 2200;      // px/s^2
const JUMP_VELOCITY = -820; // px/s
const BASE_SPEED = 320;     // px/s
const MAX_SPEED = 720;

// ---------- Состояние игры ----------
const state = {
    running: false,
    over: false,
    time: 0,
    score: 0,
    speed: BASE_SPEED,
    spawnTimer: 0,
    nextSpawn: 1.4,       // сек до следующего препятствия
    distance: 0,
    groundOffset: 0,      // смещение текстуры земли
    best: Number(localStorage.getItem('babka_best') || 0)
};

// ---------- Бабка ----------
const babka = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    w: 56,
    h: 78,
    onGround: true,
    runPhase: 0
};

// ---------- Дед ----------
const ded = {
    x: 0,
    y: 0,
    w: 62,
    h: 88,
    runPhase: 0,
    swingPhase: 0,
    swing: 0
};

// ---------- Препятствия (стога сена) ----------
let haystacks = [];

// ---------- Частицы ----------
let particles = [];

// ---------- Облака ----------
let clouds = [];

function resetGame() {
    state.running = true;
    state.over = false;
    state.time = 0;
    state.score = 0;
    state.speed = BASE_SPEED;
    state.spawnTimer = 0;
    state.nextSpawn = 1.6;
    state.distance = 0;
    state.groundOffset = 0;

    babka.x = W * 0.28;
    babka.y = GROUND_Y;
    babka.vy = 0;
    babka.onGround = true;
    babka.runPhase = 0;

    ded.x = W * 0.28 - 120;
    ded.y = GROUND_Y;
    ded.runPhase = 0;
    ded.swingPhase = 0;
    ded.swing = 0;

    haystacks = [];
    particles = [];
    clouds = [];
    for (let i = 0; i < 5; i++) {
        clouds.push({
            x: Math.random() * W,
            y: 40 + Math.random() * (GROUND_Y * 0.4),
            s: 0.6 + Math.random() * 0.8,
            spd: 10 + Math.random() * 25
        });
    }

    try {
        bgMusic.currentTime = 0;
        bgMusic.volume = 0.5;
        bgMusic.play().catch(() => {});
    } catch (e) {}
}

// ---------- Управление ----------
function jump() {
    if (!state.running || state.over) return;
    if (babka.onGround) {
        babka.vy = JUMP_VELOCITY;
        babka.onGround = false;
        spawnDust(babka.x, GROUND_Y, 8);
    }
}

canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    jump();
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        jump();
    }
});

startBtn.addEventListener('click', () => {
    menuEl.classList.add('hidden');
    resetGame();
});

restartBtn.addEventListener('click', () => {
    gameOverEl.classList.add('hidden');
    resetGame();
});

// ---------- Спавн препятствий ----------
function spawnHaystack() {
    const size = 0.85 + Math.random() * 0.5;
    const w = 48 * size;
    const h = 62 * size;
    haystacks.push({
        x: W + 40,
        y: GROUND_Y,
        w,
        h,
        passed: false,
        wobble: 0
    });
}

// ---------- Частицы пыли ----------
function spawnDust(x, y, n) {
    for (let i = 0; i < n; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y - Math.random() * 6,
            vx: -40 - Math.random() * 80,
            vy: -30 - Math.random() * 60,
            life: 0.5 + Math.random() * 0.4,
            maxLife: 0.9,
            r: 2 + Math.random() * 4
        });
    }
}

// ---------- Обновление ----------
function update(dt) {
    if (!state.running || state.over) return;

    state.time += dt;
    state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.time * 12);
    state.distance += state.speed * dt;
    state.groundOffset = (state.groundOffset + state.speed * dt) % 60;

    state.score = Math.floor(state.distance / 10);

    // --- Бабка (физика прыжка) ---
    if (!babka.onGround) {
        babka.vy += GRAVITY * dt;
        babka.y += babka.vy * dt;
        if (babka.y >= GROUND_Y) {
            babka.y = GROUND_Y;
            babka.vy = 0;
            babka.onGround = true;
            spawnDust(babka.x, GROUND_Y, 6);
        }
    }
    if (babka.onGround) {
        babka.runPhase += dt * 14;
    }

    // --- Дед (догоняет / отстаёт) ---
    const targetX = W * 0.28 - 110;
    ded.x += (targetX - ded.x) * Math.min(1, dt * 3);
    ded.runPhase += dt * 12;

    // Машет дубинкой когда близко
    const distToBabka = Math.abs(ded.x - babka.x);
    ded.swingPhase += dt * 6;
    ded.swing = Math.max(0, Math.sin(ded.swingPhase)) * (distToBabka < 200 ? 1 : 0.4);

    // --- Спавн стогов ---
    state.spawnTimer += dt;
    const minGap = Math.max(0.75, 1.5 - state.time * 0.015);
    if (state.spawnTimer >= state.nextSpawn) {
        spawnHaystack();
        state.spawnTimer = 0;
        state.nextSpawn = minGap + Math.random() * 0.7;
    }

    // --- Движение стогов ---
    for (let i = haystacks.length - 1; i >= 0; i--) {
        const hs = haystacks[i];
        hs.x -= state.speed * dt;
        hs.wobble += dt * 6;

        if (hs.x + hs.w < -50) {
            haystacks.splice(i, 1);
            continue;
        }

        // --- Столкновение (AABB, с допуском) ---
        const bx = babka.x - babka.w / 2 + 6;
        const bw = babka.w - 12;
        const byTop = babka.y - babka.h;
        const byBot = babka.y;

        const hx = hs.x;
        const hw = hs.w;
        const hyTop = hs.y - hs.h;
        const hyBot = hs.y;

        if (bx < hx + hw && bx + bw > hx && byTop < hyBot && byBot > hyTop) {
            gameOver();
            return;
        }

        // --- Очки за пройденный стог ---
        if (!hs.passed && hs.x + hs.w < babka.x - babka.w / 2) {
            hs.passed = true;
        }
    }

    // --- Частицы ---
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 400 * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // --- Облака ---
    for (const c of clouds) {
        c.x -= (state.speed * 0.15 + c.spd) * dt;
        if (c.x < -150) {
            c.x = W + 100;
            c.y = 40 + Math.random() * (GROUND_Y * 0.4);
        }
    }
}

function gameOver() {
    state.over = true;
    state.running = false;

    if (state.score > state.best) {
        state.best = state.score;
        localStorage.setItem('babka_best', String(state.best));
    }

    finalScoreEl.textContent = state.score;
    bestScoreEl.textContent = state.best;
    gameOverEl.classList.remove('hidden');

    bgMusic.pause();
}

// ============================================
// РИСОВАНИЕ
// ============================================

function draw() {
    // --- Небо (закатное, тревожное) ---
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, '#2b1055');
    skyGrad.addColorStop(0.5, '#7b2d26');
    skyGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // --- Солнце/луна ---
    ctx.save();
    ctx.globalAlpha = 0.5;
    const sunX = W * 0.75;
    const sunY = GROUND_Y * 0.35;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 120);
    sunGrad.addColorStop(0, 'rgba(255, 200, 100, 0.9)');
    sunGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Облака ---
    ctx.fillStyle = 'rgba(60, 20, 40, 0.6)';
    for (const c of clouds) {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 60 * c.s, 20 * c.s, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x + 40 * c.s, c.y + 5 * c.s, 45 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x - 40 * c.s, c.y + 8 * c.s, 40 * c.s, 14 * c.s, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Дальние поля (холмы) ---
    ctx.fillStyle = '#5a3a1a';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= W; x += 40) {
        const y = GROUND_Y - 40 - Math.sin((x + state.distance * 0.3) * 0.01) * 25;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(W, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // --- Земля ---
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    groundGrad.addColorStop(0, '#6b4423');
    groundGrad.addColorStop(1, '#2d1a0a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // Травинки / борозды
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let x = -state.groundOffset; x < W; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y + 8);
        ctx.lineTo(x + 30, GROUND_Y + 8);
        ctx.stroke();
    }

    // --- Стога сена ---
    for (const hs of haystacks) {
        drawHaystack(hs);
    }

    // --- Бабка ---
    drawBabka();

    // --- Дед ---
    drawDed();

    // --- Частицы ---
    for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = '#c9a875';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- HUD ---
    drawHUD();
}

function drawHaystack(hs) {
    const x = hs.x;
    const y = hs.y;
    const w = hs.w;
    const h = hs.h;

    ctx.save();

    // Тень
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 4, w * 0.6, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Основа стога (трапеция)
    const grad = ctx.createLinearGradient(x, y - h, x, y);
    grad.addColorStop(0, '#f5c542');
    grad.addColorStop(0.5, '#d4a017');
    grad.addColorStop(1, '#8b6914');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.15, y);
    ctx.lineTo(x + w * 0.85, y);
    ctx.lineTo(x + w * 0.7, y - h * 0.75);
    ctx.lineTo(x + w * 0.5, y - h);
    ctx.lineTo(x + w * 0.3, y - h * 0.75);
    ctx.closePath();
    ctx.fill();

    // Обводка
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Соломинки
    ctx.strokeStyle = 'rgba(90, 58, 26, 0.6)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
        const px = x + w * (0.2 + i * 0.15);
        ctx.beginPath();
        ctx.moveTo(px, y - h * 0.15);
        ctx.lineTo(px + (Math.random() - 0.5) * 4, y - h * (0.5 + Math.random() * 0.3));
        ctx.stroke();
    }

    // Перевязка
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(x + w * 0.2, y - h * 0.45, w * 0.6, 5);

    ctx.restore();
}

function drawBabka() {
    const x = babka.x;
    const y = babka.y;
    const w = babka.w;
    const h = babka.h;
    const runBounce = babka.onGround ? Math.abs(Math.sin(babka.runPhase)) * 4 : 0;

    ctx.save();
    ctx.translate(x, y - runBounce);

    // Тень
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, runBounce + 4, w * 0.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ноги (сарафан)
    const legSwing = babka.onGround ? Math.sin(babka.runPhase) * 8 : 6;
    ctx.strokeStyle = '#8b0000';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -12);
    ctx.lineTo(-6 + legSwing, -2);
    ctx.moveTo(6, -12);
    ctx.lineTo(6 - legSwing, -2);
    ctx.stroke();

    // Лапти/валенки
    ctx.fillStyle = '#3a2410';
    ctx.beginPath();
    ctx.ellipse(-6 + legSwing, -2, 7, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(6 - legSwing, -2, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Сарафан (тело)
    const bodyGrad = ctx.createLinearGradient(0, -h * 0.7, 0, -10);
    bodyGrad.addColorStop(0, '#c62828');
    bodyGrad.addColorStop(1, '#7f0000');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, -h * 0.65);
    ctx.lineTo(w * 0.32, -h * 0.65);
    ctx.lineTo(w * 0.42, -8);
    ctx.lineTo(-w * 0.42, -8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4a0000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Платок на плечах (жёлтый узор)
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, -h * 0.65);
    ctx.lineTo(w * 0.35, -h * 0.65);
    ctx.lineTo(w * 0.25, -h * 0.5);
    ctx.lineTo(-w * 0.25, -h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c62828';
    for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(i * 10, -h * 0.58, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Руки
    const armSwing = babka.onGround ? Math.sin(babka.runPhase + Math.PI) * 10 : -15;
    ctx.strokeStyle = '#e8b88a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h * 0.6);
    ctx.lineTo(-w * 0.5 - 4, -h * 0.45 + armSwing * 0.5);
    ctx.moveTo(w * 0.3, -h * 0.6);
    ctx.lineTo(w * 0.5 + 4, -h * 0.45 - armSwing * 0.5);
    ctx.stroke();

    // Голова
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(0, -h * 0.78, w * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a06a3a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Платок на голове (красный)
    ctx.fillStyle = '#c62828';
    ctx.beginPath();
    ctx.arc(0, -h * 0.82, w * 0.26, Math.PI, 0);
    ctx.lineTo(w * 0.26, -h * 0.78);
    ctx.lineTo(-w * 0.26, -h * 0.78);
    ctx.closePath();
    ctx.fill();

    // Завязки платка
    ctx.strokeStyle = '#c62828';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, -h * 0.75);
    ctx.lineTo(-w * 0.3, -h * 0.55);
    ctx.stroke();

    // Глаза (испуганные, широкие)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-5, -h * 0.79, 3.5, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(5, -h * 0.79, 3.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-5, -h * 0.79, 2, 0, Math.PI * 2);
    ctx.arc(5, -h * 0.79, 2, 0, Math.PI * 2);
    ctx.fill();

    // Брови (домиком — испуг)
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -h * 0.84);
    ctx.lineTo(-2, -h * 0.83);
    ctx.moveTo(9, -h * 0.84);
    ctx.lineTo(2, -h * 0.83);
    ctx.stroke();

    // Рот (открыт — кричит)
    ctx.fillStyle = '#4a0000';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.72, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawDed() {
    const x = ded.x;
    const y = ded.y;
    const w = ded.w;
    const h = ded.h;
    const runBounce = Math.abs(Math.sin(ded.runPhase)) * 5;

    ctx.save();
    ctx.translate(x, y - runBounce);

    // Тень
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, runBounce + 4, w * 0.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ноги
    const legSwing = Math.sin(ded.runPhase) * 10;
    ctx.strokeStyle = '#2c2c2c';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, -14);
    ctx.lineTo(-7 + legSwing, -2);
    ctx.moveTo(7, -14);
    ctx.lineTo(7 - legSwing, -2);
    ctx.stroke();

    // Сапоги
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(-7 + legSwing, -2, 9, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(7 - legSwing, -2, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Тело — телогрейка (тёмно-серая)
    const bodyGrad = ctx.createLinearGradient(0, -h * 0.7, 0, -10);
    bodyGrad.addColorStop(0, '#4a4a4a');
    bodyGrad.addColorStop(1, '#1f1f1f');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, -h * 0.68);
    ctx.lineTo(w * 0.35, -h * 0.68);
    ctx.lineTo(w * 0.4, -10);
    ctx.lineTo(-w * 0.4, -10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Пуговицы
    ctx.fillStyle = '#8b6914';
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, -h * 0.6 + i * 12, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Руки
    const armSwing = Math.sin(ded.runPhase + Math.PI) * 12;

    // Левая рука (машет дубинкой)
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, -h * 0.62);
    const swingAngle = -0.8 + ded.swing * 2.2;
    const armLen = 30;
    const armX = -w * 0.32 - Math.cos(swingAngle) * armLen;
    const armY = -h * 0.62 - Math.sin(swingAngle) * armLen;
    ctx.lineTo(armX, armY);
    ctx.stroke();

    // Дубинка
    ctx.save();
    ctx.translate(armX, armY);
    ctx.rotate(swingAngle + 0.5);
    const clubGrad = ctx.createLinearGradient(0, 0, 55, 0);
    clubGrad.addColorStop(0, '#5a3a1a');
    clubGrad.addColorStop(0.7, '#3a2410');
    clubGrad.addColorStop(1, '#2a1500');
    ctx.fillStyle = clubGrad;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(50, -9);
    ctx.lineTo(58, 0);
    ctx.lineTo(50, 9);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a0d00';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Шипы/сучки
    ctx.fillStyle = '#1a0d00';
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(40 + i * 5, -8, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // Правая рука
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(w * 0.32, -h * 0.62);
    ctx.lineTo(w * 0.5, -h * 0.4 + armSwing * 0.5);
    ctx.stroke();

    // Голова
    ctx.fillStyle = '#d4a06a';
    ctx.beginPath();
    ctx.arc(0, -h * 0.82, w * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8b5a2a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Шапка-ушанка
    ctx.fillStyle = '#2c2c2c';
    ctx.beginPath();
    ctx.arc(0, -h * 0.86, w * 0.28, Math.PI, 0);
    ctx.lineTo(w * 0.28, -h * 0.82);
    ctx.lineTo(-w * 0.28, -h * 0.82);
    ctx.closePath();
    ctx.fill();
    // Ушки шапки
    ctx.beginPath();
    ctx.ellipse(-w * 0.24, -h * 0.8, 6, 10, 0.3, 0, Math.PI * 2);
    ctx.ellipse(w * 0.24,