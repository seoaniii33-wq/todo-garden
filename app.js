/**
 * Todo Garden - Plant Growing Todo List Web Application
 * Core Application Logic
 */

// --- Application State ---
let state = {
    todos: [],
    totalCompleted: 0,
    level: 1,
    plantName: "초록이",
    streak: 0,
    lastCompletedDate: null, // yyyy-mm-dd format
    soundEnabled: true,
    theme: "day" // "day" or "night"
};

// --- Level Thresholds ---
const LEVEL_THRESHOLDS = [0, 3, 6, 9]; // Level 1 starts at 0, Lv2 at 3, Lv3 at 6, Lv4 at 9 completed tasks

// --- UI Elements ---
const bodyEl = document.body;
const todoFormEl = document.getElementById("todo-form");
const todoInputEl = document.getElementById("todo-input");
const todoCategoryEl = document.getElementById("todo-category");
const todoListEl = document.getElementById("todo-list");
const emptyStateEl = document.getElementById("empty-state");
const plantNameEl = document.getElementById("plant-name");
const plantStageBadgeEl = document.getElementById("plant-stage-badge");
const plantDescriptionEl = document.getElementById("plant-description");
const xpTextEl = document.getElementById("xp-text");
const xpBarFillEl = document.getElementById("xp-bar-fill");
const xpMarker1 = document.getElementById("xp-marker-1");
const xpMarker2 = document.getElementById("xp-marker-2");
const xpMarker3 = document.getElementById("xp-marker-3");
const statTotalCompletedEl = document.getElementById("stat-total-completed");
const statStreakEl = document.getElementById("stat-streak");
const todoActiveCountEl = document.getElementById("todo-active-count");
const todoCompletedCountEl = document.getElementById("todo-completed-count");
const btnThemeEl = document.getElementById("btn-theme");
const btnSoundEl = document.getElementById("btn-sound");
const btnResetEl = document.getElementById("btn-reset");
const btnRenameEl = document.getElementById("btn-rename");
const renameModalEl = document.getElementById("rename-modal");
const inputPlantNameEl = document.getElementById("input-plant-name");
const btnModalCancelEl = document.getElementById("btn-modal-cancel");
const btnModalSaveEl = document.getElementById("btn-modal-save");
const plantTouchZone = document.getElementById("plant-touch-zone");
const plantSvgHolder = document.getElementById("plant-svg-holder");
const gardenViewport = document.getElementById("garden-viewport");
const particleCanvas = document.getElementById("particle-canvas");
const categoryFilterWrapper = document.querySelector(".category-filter-wrapper");

// --- Web Audio API Synth Settings ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Sound synthesized: Quick chime sound on task completion
function playCompleteSound() {
    if (!state.soundEnabled) return;
    try {
        initAudio();
        const now = audioCtx.currentTime;
        
        // Note 1 (E5 - 659.25 Hz)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0.15, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.3);

        // Note 2 (A5 - 880 Hz) after 100ms
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880, now + 0.1);
        gain2.gain.setValueAtTime(0.15, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.4);
    } catch (e) {
        console.error("Audio error", e);
    }
}

// Sound synthesized: Sparkly rising arpeggio on Level Up
function playLevelUpSound() {
    if (!state.soundEnabled) return;
    try {
        initAudio();
        const now = audioCtx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
        
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const start = now + idx * 0.08;
            
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, start);
            
            gain.gain.setValueAtTime(0.12, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(start);
            osc.stop(start + 0.45);
        });
    } catch (e) {
        console.error("Audio error", e);
    }
}

// Sound synthesized: Pop sound when interacting with the plant
function playClickSound() {
    if (!state.soundEnabled) return;
    try {
        initAudio();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = "sine";
        // Fast pitch sweep down from 300Hz to 80Hz (woodblock/pop sound)
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    } catch (e) {
        console.error("Audio error", e);
    }
}

// --- Particle System ---
const ctx = particleCanvas.getContext("2d");
let particles = [];
let animationId = null;

function resizeCanvas() {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

class Particle {
    constructor(x, y, colorType) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 8 + 4;
        this.speedX = Math.random() * 8 - 4;
        this.speedY = Math.random() * -10 - 4; // Shoot upwards
        this.gravity = 0.25;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 6 - 3;
        this.opacity = 1;
        this.decay = Math.random() * 0.015 + 0.01;
        this.colorType = colorType; // 'leaf', 'petal', 'star'
    }

    update() {
        this.x += this.speedX;
        this.speedY += this.gravity;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        this.opacity -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.globalAlpha = this.opacity;
        
        if (this.colorType === 'leaf') {
            // Draw a green leaf
            ctx.fillStyle = '#52b788';
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size, this.size / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.colorType === 'petal') {
            // Draw a pink flower petal
            ctx.fillStyle = '#ffb3c6';
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size, this.size * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Draw a gold/yellow star for level up
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                ctx.lineTo(Math.cos(((18 + i * 72) * Math.PI) / 180) * this.size,
                           Math.sin(((18 + i * 72) * Math.PI) / 180) * this.size);
                ctx.lineTo(Math.cos(((54 + i * 72) * Math.PI) / 180) * (this.size / 2),
                           Math.sin(((54 + i * 72) * Math.PI) / 180) * (this.size / 2));
            }
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
}

function loop() {
    ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        
        if (particles[i].opacity <= 0) {
            particles.splice(i, 1);
            i--;
        }
    }
    
    if (particles.length > 0) {
        animationId = requestAnimationFrame(loop);
    } else {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

function spawnParticles(x, y, type = 'task') {
    const count = type === 'levelup' ? 100 : 35;
    for (let i = 0; i < count; i++) {
        let pType = 'leaf';
        if (type === 'levelup') {
            pType = Math.random() > 0.4 ? 'star' : (Math.random() > 0.5 ? 'petal' : 'leaf');
        } else {
            pType = Math.random() > 0.7 ? 'petal' : 'leaf';
        }
        particles.push(new Particle(x, y, pType));
    }
    
    if (!animationId) {
        loop();
    }
}

// --- Dynamic Plant SVG Rendering ---
const PLANT_SVGS = {
    // Level 1: Seed / Sprout
    1: `
    <svg width="180" height="200" viewBox="0 0 180 200" xmlns="http://www.w3.org/2000/svg" class="plant-sway">
        <defs>
            <linearGradient id="stemGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#40916c" />
                <stop offset="100%" stop-color="#52b788" />
            </linearGradient>
            <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#74c69d" />
                <stop offset="100%" stop-color="#2d6a4f" />
            </linearGradient>
        </defs>
        
        <!-- Stem -->
        <path d="M90 160 Q85 130 95 105" fill="none" stroke="url(#stemGrad)" stroke-width="6" stroke-linecap="round" />
        
        <!-- Leaf Left -->
        <path d="M92 115 C75 110 65 125 90 120 Z" fill="url(#leafGrad)" />
        <!-- Leaf Right -->
        <path d="M93 110 C110 100 120 115 95 112 Z" fill="url(#leafGrad)" />
        
        <!-- Pot -->
        <polygon points="65,160 115,160 120,195 60,195" fill="#B07C5B" stroke="#8E5E3D" stroke-width="1.5" />
        <rect x="58" y="150" width="64" height="12" rx="3" fill="#C58F6D" stroke="#8E5E3D" stroke-width="1.5" />
        <ellipse cx="90" cy="151" rx="26" ry="4" fill="#4A3423" />
    </svg>
    `,
    // Level 2: Growing Stem & Branching Leaves
    2: `
    <svg width="180" height="200" viewBox="0 0 180 200" xmlns="http://www.w3.org/2000/svg" class="plant-sway">
        <defs>
            <linearGradient id="stemGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#2d6a4f" />
                <stop offset="100%" stop-color="#52b788" />
            </linearGradient>
            <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#74c69d" />
                <stop offset="100%" stop-color="#1b4332" />
            </linearGradient>
            <linearGradient id="budGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ffb3c6" />
                <stop offset="100%" stop-color="#ff5d8f" />
            </linearGradient>
        </defs>
        
        <!-- Stem Main -->
        <path d="M90 160 Q80 110 90 70" fill="none" stroke="url(#stemGrad)" stroke-width="8" stroke-linecap="round" />
        
        <!-- Leaves -->
        <path d="M85 125 C60 125 50 145 83 135 Z" fill="url(#leafGrad)" />
        <path d="M88 110 C115 100 125 120 90 118 Z" fill="url(#leafGrad)" />
        <path d="M83 95 C62 85 52 105 84 98 Z" fill="url(#leafGrad)" />
        <path d="M88 80 C110 75 118 90 89 87 Z" fill="url(#leafGrad)" />
        
        <!-- Small Flower Bud at top -->
        <path d="M90 70 C84 60 96 60 90 70 Z" fill="url(#budGrad)" />
        <circle cx="90" cy="70" r="4" fill="#fbbf24" />
        
        <!-- Pot -->
        <polygon points="65,160 115,160 120,195 60,195" fill="#B07C5B" stroke="#8E5E3D" stroke-width="1.5" />
        <rect x="58" y="150" width="64" height="12" rx="3" fill="#C58F6D" stroke="#8E5E3D" stroke-width="1.5" />
        <ellipse cx="90" cy="151" rx="26" ry="4" fill="#4A3423" />
    </svg>
    `,
    // Level 3: Blooming Flower
    3: `
    <svg width="180" height="200" viewBox="0 0 180 200" xmlns="http://www.w3.org/2000/svg" class="plant-sway">
        <defs>
            <linearGradient id="stemGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#1b4332" />
                <stop offset="100%" stop-color="#40916c" />
            </linearGradient>
            <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#95d5b2" />
                <stop offset="100%" stop-color="#1b4332" />
            </linearGradient>
            <linearGradient id="petalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffccd5" />
                <stop offset="100%" stop-color="#ff758f" />
            </linearGradient>
        </defs>
        
        <!-- Main Stem -->
        <path d="M90 160 Q85 110 90 70" fill="none" stroke="url(#stemGrad)" stroke-width="9" stroke-linecap="round" />
        <!-- Side Stem -->
        <path d="M87 115 Q115 105 125 90" fill="none" stroke="url(#stemGrad)" stroke-width="5" stroke-linecap="round" />
        
        <!-- Leaves -->
        <path d="M85 130 C58 135 48 150 82 142 Z" fill="url(#leafGrad)" />
        <path d="M87 100 C62 95 55 115 85 108 Z" fill="url(#leafGrad)" />
        <path d="M125 90 C135 98 140 85 120 85 Z" fill="url(#leafGrad)" />
        
        <!-- Blooming Flower at the top (90, 70) -->
        <g class="flower-head">
            <!-- Petals -->
            <ellipse cx="90" cy="50" rx="10" ry="16" fill="url(#petalGrad)" transform="rotate(0 90 70)" />
            <ellipse cx="90" cy="50" rx="10" ry="16" fill="url(#petalGrad)" transform="rotate(60 90 70)" />
            <ellipse cx="90" cy="50" rx="10" ry="16" fill="url(#petalGrad)" transform="rotate(120 90 70)" />
            <ellipse cx="90" cy="50" rx="10" ry="16" fill="url(#petalGrad)" transform="rotate(180 90 70)" />
            <ellipse cx="90" cy="50" rx="10" ry="16" fill="url(#petalGrad)" transform="rotate(240 90 70)" />
            <ellipse cx="90" cy="50" rx="10" ry="16" fill="url(#petalGrad)" transform="rotate(300 90 70)" />
            <!-- Flower Center -->
            <circle cx="90" cy="70" r="11" fill="#ffb703" stroke="#fb8500" stroke-width="1.5" />
            <circle cx="90" cy="70" r="7" fill="#fb8500" />
        </g>
        
        <!-- Pot -->
        <polygon points="65,160 115,160 120,195 60,195" fill="#B07C5B" stroke="#8E5E3D" stroke-width="1.5" />
        <rect x="58" y="150" width="64" height="12" rx="3" fill="#C58F6D" stroke="#8E5E3D" stroke-width="1.5" />
        <ellipse cx="90" cy="151" rx="26" ry="4" fill="#4A3423" />
    </svg>
    `,
    // Level 4: Mighty Tree
    4: `
    <svg width="180" height="200" viewBox="0 0 180 200" xmlns="http://www.w3.org/2000/svg" class="plant-sway">
        <defs>
            <linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#582f0e" />
                <stop offset="100%" stop-color="#7f5539" />
            </linearGradient>
            <linearGradient id="canopyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#52b788" />
                <stop offset="100%" stop-color="#1b4332" />
            </linearGradient>
        </defs>
        
        <!-- Trunk -->
        <path d="M80 185 L85 110 Q85 80 70 65 L76 60 Q90 75 92 100 Q95 75 112 60 L118 65 Q100 80 98 110 L102 185 Z" fill="url(#trunkGrad)" />
        
        <!-- Foliage / Canopy (Overlapping green circles/paths) -->
        <circle cx="90" cy="55" r="32" fill="url(#canopyGrad)" opacity="0.95" />
        <circle cx="65" cy="70" r="26" fill="url(#canopyGrad)" opacity="0.95" />
        <circle cx="115" cy="70" r="26" fill="url(#canopyGrad)" opacity="0.95" />
        <circle cx="90" cy="80" r="22" fill="url(#canopyGrad)" opacity="0.95" />
        <circle cx="75" cy="50" r="24" fill="url(#canopyGrad)" opacity="0.95" />
        <circle cx="105" cy="50" r="24" fill="url(#canopyGrad)" opacity="0.95" />
        
        <!-- Little Apples / Fruits -->
        <circle cx="65" cy="75" r="5" fill="#e63946" />
        <circle cx="115" cy="78" r="5" fill="#e63946" />
        <circle cx="90" cy="45" r="5" fill="#e63946" />
        <circle cx="80" cy="65" r="5" fill="#e63946" />
        <circle cx="102" cy="65" r="5" fill="#e63946" />
        
        <!-- Wooden Tub (Replacing normal pot) -->
        <polygon points="50,175 130,175 125,198 55,198" fill="#8c6239" stroke="#5c3a21" stroke-width="1.5" />
        <!-- Metallic bands on tub -->
        <rect x="49" y="180" width="82" height="4" fill="#a8a29e" />
        <rect x="52" y="192" width="76" height="4" fill="#a8a29e" />
        <ellipse cx="90" cy="176" rx="38" ry="4" fill="#3f2305" />
    </svg>
    `
};

// --- Plant State Descriptive Copy ---
const PLANT_DESCRIPTIONS = {
    1: "🌱 [아기 새싹] 아직은 작고 소중한 새싹입니다. 할 일을 완료해서 키워보세요!",
    2: "🌿 [성장한 푸른 잎] 제법 초록빛을 띠며 자라났습니다! 줄기가 튼튼해지고 있어요.",
    3: "🌸 [피어나는 꽃] 당신의 노력이 모여 예쁜 꽃이 피었습니다! 조금만 더 힘내세요!",
    4: "🌳 [울창한 나무] 당신의 갓생 노력으로 거대한 나무가 되었습니다! 정원의 든든한 버팀목이에요."
};

const PLANT_STAGE_NAMES = {
    1: "Lv.1 아기 새싹",
    2: "Lv.2 푸른 잎",
    3: "Lv.3 피어나는 꽃",
    4: "Lv.4 울창한 나무"
};

// --- Application Functions ---

// 1. Initial State Loading
function loadState() {
    const saved = localStorage.getItem("todo_garden_state");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed };
            // Ensure lists exist
            if (!Array.isArray(state.todos)) state.todos = [];
        } catch (e) {
            console.error("Error loading localStorage data. Using defaults.", e);
        }
    }
    
    // Set settings onto visual layout
    applyTheme(state.theme);
    applySoundIcon();
    updatePlantVisuals();
    updateStatsDOM();
    renderTodoList();
}

// 2. State Save
function saveState() {
    localStorage.setItem("todo_garden_state", JSON.stringify(state));
}

// 3. Apply Theme Styling
function applyTheme(themeName) {
    state.theme = themeName;
    bodyEl.className = `theme-${themeName}`;
    const btnThemeIcon = btnThemeEl.querySelector(".theme-icon");
    if (themeName === "day") {
        btnThemeIcon.textContent = "☀️";
        btnThemeEl.title = "밤 테마로 변경";
    } else {
        btnThemeIcon.textContent = "🌙";
        btnThemeEl.title = "낮 테마로 변경";
    }
}

// 4. Update Sound UI
function applySoundIcon() {
    const soundIcon = btnSoundEl.querySelector(".sound-icon");
    if (state.soundEnabled) {
        soundIcon.textContent = "🔊";
        btnSoundEl.title = "소리 끄기";
    } else {
        soundIcon.textContent = "🔇";
        btnSoundEl.title = "소리 켜기";
    }
}

// 5. Update Plant SVG, description and badges
function updatePlantVisuals(animateLevelUp = false) {
    // 1. Compute level dynamically
    let calculatedLevel = 1;
    if (state.totalCompleted >= LEVEL_THRESHOLDS[3]) {
        calculatedLevel = 4;
    } else if (state.totalCompleted >= LEVEL_THRESHOLDS[2]) {
        calculatedLevel = 3;
    } else if (state.totalCompleted >= LEVEL_THRESHOLDS[1]) {
        calculatedLevel = 2;
    }
    
    // Trigger Level up effect if level increases
    if (calculatedLevel > state.level) {
        state.level = calculatedLevel;
        if (animateLevelUp) {
            triggerLevelUpVisual();
        }
    } else {
        state.level = calculatedLevel;
    }

    // 2. Render SVG
    plantSvgHolder.innerHTML = PLANT_SVGS[state.level];
    
    // 3. Set texts
    plantNameEl.textContent = state.plantName;
    plantStageBadgeEl.textContent = PLANT_STAGE_NAMES[state.level];
    plantDescriptionEl.textContent = PLANT_DESCRIPTIONS[state.level];

    // 4. Experience bar fill
    updateXPBar();
}

// Experience Progress Bar Calculation
function updateXPBar() {
    let percentage = 0;
    const currentXP = state.totalCompleted;
    
    if (state.level === 1) {
        // Range: 0 to 3
        const range = LEVEL_THRESHOLDS[1] - LEVEL_THRESHOLDS[0];
        const val = currentXP - LEVEL_THRESHOLDS[0];
        percentage = (val / range) * 33.3; // First section
    } else if (state.level === 2) {
        // Range: 3 to 6
        const range = LEVEL_THRESHOLDS[2] - LEVEL_THRESHOLDS[1];
        const val = currentXP - LEVEL_THRESHOLDS[1];
        percentage = 33.3 + (val / range) * 33.3; // Second section
    } else if (state.level === 3) {
        // Range: 6 to 9
        const range = LEVEL_THRESHOLDS[3] - LEVEL_THRESHOLDS[2];
        const val = currentXP - LEVEL_THRESHOLDS[2];
        percentage = 66.6 + (val / range) * 33.4; // Third section
    } else {
        // Max level (9+)
        percentage = 100;
    }

    xpBarFillEl.style.width = `${percentage}%`;
    
    // Set markers active states
    xpMarker1.classList.toggle("active", currentXP >= LEVEL_THRESHOLDS[1]);
    xpMarker2.classList.toggle("active", currentXP >= LEVEL_THRESHOLDS[2]);
    xpMarker3.classList.toggle("active", currentXP >= LEVEL_THRESHOLDS[3]);

    if (state.level === 4) {
        xpTextEl.textContent = `${currentXP}개 완료 (최대 레벨 도달! 🌳)`;
    } else {
        const nextThreshold = LEVEL_THRESHOLDS[state.level];
        xpTextEl.textContent = `${currentXP} / ${nextThreshold}개 (다음 성장까지 ${nextThreshold - currentXP}개 남음)`;
    }
}

// 6. Level Up Visual Flash and Sound
function triggerLevelUpVisual() {
    gardenViewport.classList.add("level-up-flash");
    
    // Spawn gold stars in the center of the viewport
    const rect = gardenViewport.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    spawnParticles(centerX, centerY, 'levelup');
    
    playLevelUpSound();

    setTimeout(() => {
        gardenViewport.classList.remove("level-up-flash");
    }, 1200);
}

// 7. Update Stats in DOM
function updateStatsDOM() {
    statTotalCompletedEl.textContent = state.totalCompleted;
    statStreakEl.textContent = state.streak;
    
    const active = state.todos.filter(t => !t.completed).length;
    const completed = state.todos.filter(t => t.completed).length;
    
    todoActiveCountEl.textContent = active;
    todoCompletedCountEl.textContent = completed;
}

// 8. Render Todo Items with Filters
let currentFilter = "all";
function renderTodoList() {
    todoListEl.innerHTML = "";
    
    let filteredTodos = state.todos;
    if (currentFilter === "active") {
        filteredTodos = state.todos.filter(t => !t.completed);
    } else if (currentFilter === "completed") {
        filteredTodos = state.todos.filter(t => t.completed);
    }

    if (filteredTodos.length === 0) {
        emptyStateEl.style.display = "flex";
        
        // Customise empty messages based on filters
        if (currentFilter === "completed") {
            emptyStateEl.querySelector(".empty-emoji").textContent = "🌾";
            emptyStateEl.querySelector(".empty-title").textContent = "완료된 항목이 없습니다.";
            emptyStateEl.querySelector(".empty-subtitle").textContent = "할 일을 완료하여 보람을 수확해보세요!";
        } else if (currentFilter === "active") {
            emptyStateEl.querySelector(".empty-emoji").textContent = "✨";
            emptyStateEl.querySelector(".empty-title").textContent = "할 일을 모두 마쳤습니다!";
            emptyStateEl.querySelector(".empty-subtitle").textContent = "정원이 평화로워요. 새로운 목표를 심어볼까요?";
        } else {
            emptyStateEl.querySelector(".empty-emoji").textContent = "🍂";
            emptyStateEl.querySelector(".empty-title").textContent = "정원이 텅 비어 있습니다.";
            emptyStateEl.querySelector(".empty-subtitle").textContent = "새로운 할 일을 심어 정원을 가꿔보세요!";
        }
    } else {
        emptyStateEl.style.display = "none";
        
        filteredTodos.forEach((todo) => {
            const li = document.createElement("li");
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            li.dataset.id = todo.id;

            const categoryEmojiMap = {
                personal: "🏠 일상",
                work: "💼 업무",
                study: "📚 공부",
                health: "🏃 건강",
                hobby: "🎨 취미"
            };

            li.innerHTML = `
                <label class="todo-checkbox-wrapper">
                    <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleTodo('${todo.id}', this)">
                    <span class="checkmark"></span>
                </label>
                <span class="todo-cat-badge cat-${todo.category}">${categoryEmojiMap[todo.category] || "🏠 일상"}</span>
                <span class="todo-text">${escapeHTML(todo.text)}</span>
                <button class="btn-delete" onclick="deleteTodo('${todo.id}')" title="삭제">🗑️</button>
            `;
            todoListEl.appendChild(li);
        });
    }
}

// Utility to prevent XSS
function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 9. Add a new Todo
function addTodo(text, category) {
    const cleanText = text.trim();
    if (!cleanText) return;

    const newTodo = {
        id: 'todo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        text: cleanText,
        category: category,
        completed: false,
        createdDate: new Date().toISOString()
    };

    state.todos.unshift(newTodo);
    saveState();
    updateStatsDOM();
    renderTodoList();
}

// 10. Toggle Todo Complete/Incomplete
window.toggleTodo = function(id, checkboxEl) {
    const todoIndex = state.todos.findIndex(t => t.id === id);
    if (todoIndex === -1) return;

    const todo = state.todos[todoIndex];
    const itemEl = checkboxEl.closest(".todo-item");

    if (checkboxEl.checked) {
        todo.completed = true;
        itemEl.classList.add("completed");
        
        // Increase totals and check for level up
        state.totalCompleted += 1;
        
        // Particle effect trigger
        const checkboxRect = checkboxEl.getBoundingClientRect();
        spawnParticles(checkboxRect.left + 11, checkboxRect.top + 11, 'task');
        
        // Sound trigger
        playCompleteSound();
        
        // Streak adjustment
        updateStreak();
        
        // Plant Update
        updatePlantVisuals(true);
    } else {
        todo.completed = false;
        itemEl.classList.remove("completed");
        
        // Decrement completed. But wait, do we reduce total XP?
        // Let's NOT decrease state.totalCompleted (XP) to keep achievements permanent,
        // or should we decrease it? The user's Python code decreases completed_count if we...
        // Ah, the user's Python code doesn't allow un-completing! It only allows marking incomplete tasks as complete.
        // In modern Todo lists, toggling off is allowed. To prevent XP farming, we could choose to:
        // A. Decrease totalCompleted (standard todo behavior)
        // B. Keep totalCompleted strictly increasing.
        // Let's choose A so the state remains consistent with the number of completed tasks in list.
        // Wait! If they complete the same task again and again, it would be farming anyway.
        // Let's decrease totalCompleted but cap it at 0 to keep the system logical.
        if (state.totalCompleted > 0) {
            state.totalCompleted -= 1;
        }
        updatePlantVisuals(false);
    }

    saveState();
    updateStatsDOM();
    
    // Re-render list after a short delay if in active/completed filtered view, so the items don't vanish instantly
    if (currentFilter !== "all") {
        setTimeout(() => {
            renderTodoList();
        }, 300);
    } else {
        renderTodoList();
    }
};

// 11. Streak Calculation
function updateStreak() {
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (!state.lastCompletedDate) {
        // First completion ever
        state.streak = 1;
    } else {
        const lastDate = new Date(state.lastCompletedDate);
        const today = new Date(todayStr);
        const diffTime = Math.abs(today - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            // Completed yesterday, increment streak
            state.streak += 1;
        } else if (diffDays > 1) {
            // Streak broken, reset to 1
            state.streak = 1;
        }
        // If diffDays is 0, they completed another task today, so streak remains same.
    }
    
    state.lastCompletedDate = todayStr;
}

// 12. Delete Todo
window.deleteTodo = function(id) {
    const todoIndex = state.todos.findIndex(t => t.id === id);
    if (todoIndex === -1) return;

    const itemEl = document.querySelector(`.todo-item[data-id="${id}"]`);
    if (itemEl) {
        itemEl.classList.add("deleting");
        
        // Wait for slideOut animation to finish
        setTimeout(() => {
            const isCompleted = state.todos[todoIndex].completed;
            state.todos.splice(todoIndex, 1);
            
            // If we deleted a completed todo, do we decrease total completed count?
            // Let's NOT decrease totalCompleted (XP) here, so users aren't punished for clearing their list.
            
            saveState();
            updateStatsDOM();
            renderTodoList();
        }, 250);
    }
};

// 13. Plant Click Interaction
function setupPlantInteraction() {
    plantTouchZone.addEventListener("click", (e) => {
        const svg = plantSvgHolder.querySelector("svg");
        if (svg) {
            svg.classList.remove("plant-bounce");
            // Trigger reflow to restart animation
            void svg.offsetWidth;
            svg.classList.add("plant-bounce");
            
            // Sound feedback
            playClickSound();

            // Spawn cute little hearts/leaves from click point or center of plant
            const rect = plantTouchZone.getBoundingClientRect();
            const clickX = e.clientX || (rect.left + rect.width / 2);
            const clickY = e.clientY || (rect.top + rect.height / 2 - 40);
            
            // Spawn just a few particles
            for (let i = 0; i < 8; i++) {
                particles.push(new Particle(clickX, clickY, Math.random() > 0.5 ? 'petal' : 'leaf'));
            }
            if (!animationId) loop();
        }
    });
}

// --- Event Listeners ---

// Todo Form Submission
todoFormEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = todoInputEl.value;
    const category = todoCategoryEl.value;
    
    addTodo(text, category);
    todoInputEl.value = "";
    todoInputEl.focus();
});

// Category Filter Buttons
categoryFilterWrapper.addEventListener("click", (e) => {
    if (e.target.classList.contains("filter-btn")) {
        // Toggle active button
        document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
        e.target.classList.add("active");
        
        currentFilter = e.target.dataset.filter;
        renderTodoList();
    }
});

// Rename Plant Modal Triggers
btnRenameEl.addEventListener("click", () => {
    inputPlantNameEl.value = state.plantName;
    renameModalEl.classList.add("active");
    inputPlantNameEl.focus();
});

btnModalCancelEl.addEventListener("click", () => {
    renameModalEl.classList.remove("active");
});

btnModalSaveEl.addEventListener("click", () => {
    const newName = inputPlantNameEl.value.trim();
    if (newName) {
        state.plantName = newName;
        saveState();
        updatePlantVisuals();
        renameModalEl.classList.remove("active");
    }
});

// Close modal if clicking outside
renameModalEl.addEventListener("click", (e) => {
    if (e.target === renameModalEl) {
        renameModalEl.classList.remove("active");
    }
});

// Sound Toggle
btnSoundEl.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    saveState();
    applySoundIcon();
    if (state.soundEnabled) {
        playClickSound();
    }
});

// Theme Toggle
btnThemeEl.addEventListener("click", () => {
    const newTheme = state.theme === "day" ? "night" : "day";
    applyTheme(newTheme);
    saveState();
});

// Reset confirmation
btnResetEl.addEventListener("click", () => {
    const confirmReset = confirm("정말로 정원을 초기화하시겠습니까?\n이름, 레벨 및 등록된 모든 투두가 지워집니다.");
    if (confirmReset) {
        localStorage.removeItem("todo_garden_state");
        state = {
            todos: [],
            totalCompleted: 0,
            level: 1,
            plantName: "초록이",
            streak: 0,
            lastCompletedDate: null,
            soundEnabled: state.soundEnabled,
            theme: state.theme
        };
        saveState();
        updatePlantVisuals();
        updateStatsDOM();
        renderTodoList();
        
        // Soft click feedback
        playClickSound();
    }
});

// --- Boot Application ---
document.addEventListener("DOMContentLoaded", () => {
    loadState();
    setupPlantInteraction();
});
