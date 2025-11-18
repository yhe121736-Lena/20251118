let spriteSheet;
let frames = [];
const FRAME_W = 491;
const FRAME_H = 71;
const NUM_FRAMES = 8;
// 顯示寬度（像素）預設使用原始寬度 491，畫面太小時會自動縮放以保留邊界
const SPRITE_DISPLAY_WIDTH = 491;
let currentFrame = 0;
// 基礎幀延遲（越小動畫越快），會根據音量動態調整
const BASE_FRAME_DELAY = 6;
let frameDelay = BASE_FRAME_DELAY;
let frameCounter = 0;
// 愛心特效相關
let hearts = [];
let heartSpawnRate = 12; // 每 n 幀嘗試產生一個心
let maxHearts = 120;
let heartsActive = false; // 預設關閉，點擊開啟/關閉
// 角色動畫開關（點擊切換）
let spritePlaying = false;
// 音樂相關
let bgm = null;
let musicVolume = 0.6;
// 音訊分析器（用於同步動畫速度）
let amp = null;
let smoothedLevel = 0;

function preload() {
  // 直接逐張載入分割的影格檔（1/0.png .. 1/7.png），避免 sprite sheet 切割問題
  for (let i = 0; i < NUM_FRAMES; i++) {
    frames[i] = loadImage(`1/${i}.png`);
  }
  // 同時嘗試載入整張合併圖作為備援（通常不會使用）
  spriteSheet = loadImage('1/0-7.png', () => {}, () => {});
  // 載入背景音樂（請把音檔放在專案根目錄並命名為 music.mp3，或修改路徑）
  try {
    bgm = loadSound('music.mp3', () => {
      console.log('bgm loaded');
    }, (err) => {
      console.warn('bgm load error', err);
    });
  } catch (e) {
    console.warn('loadSound not available', e);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CENTER);
  smooth();

  console.log('frames loaded:', frames.length);
  if (bgm && bgm.setVolume) bgm.setVolume(musicVolume);
  // 建立音量分析器並連到 bgm（如果已載入）
  try {
    amp = new p5.Amplitude();
    if (bgm) amp.setInput(bgm);
  } catch (e) {
    console.warn('p5.Amplitude not available', e);
    amp = null;
  }
}

// Heart particle class
class Heart {
  constructor(x, y, size, vx, vy, life, col) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.vx = vx;
    this.vy = vy;
    this.life = life; // frames remaining
    this.maxLife = life;
    this.col = col; // p5 color
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  isDead() {
    return this.life <= 0 || this.y + this.size < -50;
  }

  draw() {
    const alpha = constrain(this.life / this.maxLife, 0, 1);
    push();
    translate(this.x, this.y);
    noStroke();
    const c = this.col;
    fill(red(c), green(c), blue(c), 255 * alpha);

    // draw heart using two circles + triangle for a simple heart shape
    const s = this.size;
    const r = s * 0.28;
    // left circle
    ellipse(-r, -r / 2, r * 2, r * 2);
    // right circle
    ellipse(r, -r / 2, r * 2, r * 2);
    // bottom triangle
    beginShape();
    vertex(-s * 0.6, -r / 2);
    vertex(0, s);
    vertex(s * 0.6, -r / 2);
    endShape(CLOSE);
    pop();
  }
}

function draw() {
  background('#FFD2D2');

  // 產生新的心（每 heartSpawnRate 幀嘗試產生一個）
  if (heartsActive) {
    if (frameCount % heartSpawnRate === 0) {
      if (hearts.length < maxHearts) {
        const x = random(width * 0.1, width * 0.9);
        const y = random(height * 0.6, height * 0.95);
        const size = random(24, 80);
        const vx = random(-0.4, 0.4);
        const vy = random(-0.6, -2.0);
        const life = Math.round(random(80, 200));
        // 隨機粉紅色系
        const col = color(random(200, 255), random(80, 160), random(120, 220));
        hearts.push(new Heart(x, y, size, vx, vy, life, col));
      }
    }

    // 更新並繪製心（在角色之前，當作背景特效）
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      h.update();
      h.draw();
      if (h.isDead()) hearts.splice(i, 1);
    }
  }

  // 計算依照音訊動態調整的幀延遲
  let effectiveDelay = BASE_FRAME_DELAY;
  if (bgm && bgm.isPlaying() && amp) {
    const level = amp.getLevel();
    // 平滑音量值，避免瞬間波動造成閃動
    smoothedLevel = lerp(smoothedLevel, level, 0.12);
    // 根據平滑音量計算速度倍率（可微調 map 範圍）
    // 當音量很低時速度介於 0.5，音量高時速度可到 2 倍
    const speedFactor = map(smoothedLevel, 0, 0.2, 0.5, 2, true);
    effectiveDelay = Math.max(1, Math.round(BASE_FRAME_DELAY / speedFactor));
  }

  if (spritePlaying) {
    frameCounter++;
    if (frameCounter >= effectiveDelay) {
      frameCounter = 0;
      currentFrame = (currentFrame + 1) % NUM_FRAMES;
    }
  }

  if (frames.length > 0) {
    const img = frames[currentFrame];
    // 使用影格的原始尺寸以確保不變形
    const naturalW = img.width || FRAME_W;
    const naturalH = img.height || FRAME_H;

    // 可用寬高（保留邊界）
    const maxAllowedW = Math.min(SPRITE_DISPLAY_WIDTH, Math.floor(width * 0.9));
    const maxAllowedH = Math.floor(height * 0.9);

    // 計算等比縮放比例（不放大超過原始尺寸，除非 SPRITE_DISPLAY_WIDTH 較大）
    const scaleW = maxAllowedW / naturalW;
    const scaleH = maxAllowedH / naturalH;
    const scale = Math.min(scaleW, scaleH, 1);

    const displayW = Math.round(naturalW * scale);
    const displayH = Math.round(naturalH * scale);

    image(img, width / 2, height / 2, displayW, displayH);
  }

  // 顯示提示文字（告知目前角色動畫狀態）
  push();
  noStroke();
  fill(0, 120);
  textAlign(CENTER, TOP);
  textSize(14);
  const hint = spritePlaying ? '點擊停止角色動畫' : '點擊啟動角色動畫';
  text(hint, width / 2, 8);
  // 顯示音樂狀態
  const musicHint = bgm ? (bgm.isPlaying() ? '音樂：播放' : '音樂：停止') : '音樂：未載入 (請放 music.mp3)';
  textSize(12);
  text(musicHint, width / 2, 26);
  // 顯示動畫速度倍率（依據音量動態調整）
  const currentSpeed = Math.round((BASE_FRAME_DELAY / (typeof effectiveDelay !== 'undefined' ? effectiveDelay : BASE_FRAME_DELAY)) * 100) / 100;
  text(`動畫速度：${currentSpeed}x`, width / 2, 42);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function mousePressed() {
  // 切換角色動畫啟動狀態（點一下開始動畫，再點一下停止）
  spritePlaying = !spritePlaying;
  // 同時啟動或暫停背景音樂（瀏覽器需使用者互動才能播放）
  if (bgm) {
    if (spritePlaying) {
      if (!bgm.isPlaying()) {
        try { bgm.loop(); } catch (e) { bgm.play(); }
      }
    } else {
      if (bgm.isPlaying()) bgm.pause();
    }
  }
}
