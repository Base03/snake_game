// =========================================
// MAIN GAME ENGINE
// =========================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,radii) {
    let r = typeof radii==='number'?radii:(Array.isArray(radii)?radii[0]:0);
    r = Math.min(r, w/2, h/2);
    this.moveTo(x+r,y); this.lineTo(x+w-r,y); this.arcTo(x+w,y,x+w,y+r,r);
    this.lineTo(x+w,y+h-r); this.arcTo(x+w,y+h,x+w-r,y+h,r);
    this.lineTo(x+r,y+h); this.arcTo(x,y+h,x,y+h-r,r);
    this.lineTo(x,y+r); this.arcTo(x,y,x+r,y,r); this.closePath();
  };
}

const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('is-touch');

const DESKTOP_GRID = 20, MOBILE_GRID = 16;
let GRID = isTouch ? MOBILE_GRID : DESKTOP_GRID;
let COLS, ROWS, W, H;

function resize() {
  GRID = isTouch ? MOBILE_GRID : DESKTOP_GRID;
  const pad=20, topR=70, botR=isTouch?160:10;
  const wW=Math.max(window.innerWidth,300), wH=Math.max(window.innerHeight,300);
  COLS = Math.max(Math.floor(Math.min(wW-pad,560)/GRID),12);
  ROWS = Math.max(Math.floor(Math.min(wH-topR-botR,480)/GRID),12);
  W = COLS*GRID; H = ROWS*GRID;
  canvas.width = W; canvas.height = H;
}
resize();
window.addEventListener('resize', resize);

// --- State ---
let snake, dir, nextDir, score, alive, gameStarted;
let candles = [], particles = [];
let wallpaperMode = false;
let totalCandlesEaten = 0;
let gameTime = 0; // seconds since game start

let burnTimer, moveTimer, candleSpawnTimer;
const MOVE_INTERVAL = 110;
const BURN_INTERVAL = 1800;
const CANDLE_SPAWN_INTERVAL = 3000;
const INITIAL_LENGTH = 8;
const MAX_CANDLES = 12;
const CANDLE_LIFETIME = 14000;

function init() {
  resize();
  Church.generate(COLS, ROWS);
  const sx = Math.floor(COLS/2), sy = Math.floor(ROWS/2);
  snake = [];
  for (let i = 0; i < INITIAL_LENGTH; i++) snake.push({x:sx-i, y:sy});
  dir = {x:1,y:0}; nextDir = {x:1,y:0};
  candles = []; particles = [];
  score = 0; alive = true; gameStarted = true;
  totalCandlesEaten = 0; gameTime = 0;
  burnTimer = 0; moveTimer = 0; candleSpawnTimer = 0;
  spawnInitialCandles();
  updateHUD();
}

// Place ~10 candles spread around church - aisles, beyond pews, near altar
function spawnInitialCandles() {
  const pewGrid = Church.getPewGrid();
  const aisleX = Math.floor(COLS / 2);
  const positions = [];

  for (const p of Church.pews) {
    if (p.dead) continue;
    // Wall side of pews (between pew and wall)
    const wallL = 1;
    if (!pewGrid[p.y * COLS + wallL]) positions.push({ x: wallL, y: p.y, zone: 'wall' });
    const wallR = COLS - 2;
    if (!pewGrid[p.y * COLS + wallR]) positions.push({ x: wallR, y: p.y, zone: 'wall' });
    // Center aisle
    if (!pewGrid[p.y * COLS + aisleX]) positions.push({ x: aisleX, y: p.y, zone: 'aisle' });
    // One tile offset from center
    if (aisleX+1 < COLS && !pewGrid[p.y * COLS + aisleX+1]) positions.push({ x: aisleX+1, y: p.y, zone: 'aisle' });
  }

  // Near altar (rows 4-6, spread across width)
  for (let y = 4; y <= 6; y++) {
    for (let x = 2; x < COLS - 2; x += 3) {
      if (y < ROWS && !pewGrid[y * COLS + x]) positions.push({ x, y, zone: 'altar' });
    }
  }

  // Back of church (last 2 rows)
  for (let x = 2; x < COLS - 2; x += 4) {
    const y = ROWS - 2;
    if (y >= 0 && !pewGrid[y * COLS + x]) positions.push({ x, y, zone: 'back' });
  }

  // Shuffle
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  // Pick ~10, ensuring variety across zones
  const placed = new Set();
  const zoneCounts = { wall: 0, aisle: 0, altar: 0, back: 0 };
  const zoneMax = { wall: 3, aisle: 3, altar: 3, back: 2 };
  const target = Math.min(10, positions.length);

  for (const pos of positions) {
    if (candles.length >= target) break;
    const key = pos.x + ',' + pos.y;
    if (placed.has(key)) continue;
    if (zoneCounts[pos.zone] >= zoneMax[pos.zone]) continue;
    if (snake.some(s => s.x === pos.x && s.y === pos.y)) continue;
    placed.add(key);
    zoneCounts[pos.zone]++;
    candles.push({
      x: pos.x, y: pos.y,
      birth: performance.now(),
      height: 0.7 + Math.random() * 0.3,
      flicker: Math.random() * Math.PI * 2,
      hue: 25 + Math.random() * 20,
      type: 'candle',
    });
  }
}

function spawnCandle() {
  if (candles.length >= MAX_CANDLES) return;
  const pewGrid = Church.getPewGrid();
  const isHellfire = totalCandlesEaten >= 6;
  let attempts = 0;
  while (attempts < 200) {
    const x = 1+Math.floor(Math.random()*(COLS-2));
    const y = 1+Math.floor(Math.random()*(ROWS-2));
    const onSnake = snake.some(s => s.x===x && s.y===y);
    const onCandle = candles.some(c => c.x===x && c.y===y);
    const onPew = pewGrid[y*COLS+x] === 1;
    if (!onSnake && !onCandle && !onPew) {
      if (isHellfire) {
        // Hellfire: appears from cracks in the floor
        Church.addCrack(x, y);
        Church.tryBurnPewsNear(x, y);
        candles.push({
          x, y,
          birth: performance.now(),
          height: 0.5 + Math.random() * 0.5,
          flicker: Math.random() * Math.PI * 2,
          hue: 5 + Math.random() * 15,
          type: 'hellfire',
        });
      } else {
        // Regular candle (only in early game)
        Church.tryBurnPewsNear(x, y);
        candles.push({
          x, y,
          birth: performance.now(),
          height: 0.7 + Math.random() * 0.3,
          flicker: Math.random() * Math.PI * 2,
          hue: 25 + Math.random() * 20,
          type: 'candle',
        });
      }
      return;
    }
    attempts++;
  }
}

// --- Input ---
function setDir(dx, dy) {
  if (wallpaperMode) return;
  if (dx===-dir.x && dy===-dir.y) return;
  if (dx===0 && dy===0) return;
  nextDir = {x:dx, y:dy};
}

window.addEventListener('keydown', e => {
  switch(e.key) {
    case 'ArrowUp': case 'w': case 'W': e.preventDefault(); setDir(0,-1); break;
    case 'ArrowDown': case 's': case 'S': e.preventDefault(); setDir(0,1); break;
    case 'ArrowLeft': case 'a': case 'A': e.preventDefault(); setDir(-1,0); break;
    case 'ArrowRight': case 'd': case 'D': e.preventDefault(); setDir(1,0); break;
  }
});

let touchSX=0, touchSY=0;
canvas.addEventListener('touchstart', e => { e.preventDefault(); touchSX=e.touches[0].clientX; touchSY=e.touches[0].clientY; }, {passive:false});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t=e.touches[0], dx=t.clientX-touchSX, dy=t.clientY-touchSY;
  if (Math.sqrt(dx*dx+dy*dy) >= 20) {
    if (Math.abs(dx)>Math.abs(dy)) setDir(dx>0?1:-1, 0); else setDir(0, dy>0?1:-1);
    touchSX=t.clientX; touchSY=t.clientY;
  }
}, {passive:false});
canvas.addEventListener('touchend', e => e.preventDefault(), {passive:false});
document.addEventListener('touchmove', e => { if(e.target.tagName!=='BUTTON') e.preventDefault(); }, {passive:false});

// =========================================
// AI AUTOPILOT
// =========================================
const DIRS = [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];

function makeGrid() {
  const g = new Uint8Array(COLS*ROWS);
  const pg = Church.getPewGrid();
  for (let i = 0; i < g.length; i++) if (pg[i]) g[i] = 1;
  for (let i = 0; i < snake.length; i++) g[snake[i].y*COLS+snake[i].x] = 1;
  return g;
}

function bfs(sx, sy, grid, targets, exDir) {
  const vis = new Uint8Array(COLS*ROWS);
  const q = [];
  vis[sy*COLS+sx] = 1;
  for (let d = 0; d < 4; d++) {
    if (d === exDir) continue;
    const nx=sx+DIRS[d].x, ny=sy+DIRS[d].y;
    if (nx<0||nx>=COLS||ny<0||ny>=ROWS) continue;
    const k=ny*COLS+nx;
    if (grid[k]||vis[k]) continue;
    vis[k]=1; q.push([nx,ny,d,1]);
  }
  const res = new Map();
  let qi = 0;
  while (qi < q.length) {
    const [cx,cy,fd,dist] = q[qi++];
    for (const t of targets) {
      if (t.x===cx && t.y===cy && !res.has(t.id)) res.set(t.id, {dist,dirIdx:fd});
    }
    if (res.size === targets.length) break;
    for (let d = 0; d < 4; d++) {
      const nx=cx+DIRS[d].x, ny=cy+DIRS[d].y;
      if (nx<0||nx>=COLS||ny<0||ny>=ROWS) continue;
      const k=ny*COLS+nx;
      if (grid[k]||vis[k]) continue;
      vis[k]=1; q.push([nx,ny,fd,dist+1]);
    }
  }
  return res;
}

function canReachTail(hx, hy, body) {
  const g = new Uint8Array(COLS*ROWS);
  const pg = Church.getPewGrid();
  for (let i = 0; i < g.length; i++) if (pg[i]) g[i]=1;
  for (const s of body) g[s.y*COLS+s.x]=1;
  g[hy*COLS+hx]=0;
  const tail = body[body.length-1];
  const tgts = [];
  for (const d of DIRS) {
    const tx=tail.x+d.x, ty=tail.y+d.y;
    if (tx>=0&&tx<COLS&&ty>=0&&ty<ROWS) tgts.push({x:tx,y:ty,id:'t'+tgts.length});
  }
  return bfs(hx, hy, g, tgts).size > 0;
}

function floodSize(sx, sy, grid) {
  if (grid[sy*COLS+sx]) return 0;
  const vis = new Uint8Array(COLS*ROWS);
  vis[sy*COLS+sx]=1;
  const st = [[sx,sy]]; let c = 0;
  while (st.length) {
    const [x,y]=st.pop(); c++;
    for (const d of DIRS) {
      const nx=x+d.x, ny=y+d.y;
      if (nx<0||nx>=COLS||ny<0||ny>=ROWS) continue;
      const k=ny*COLS+nx;
      if (grid[k]||vis[k]) continue;
      vis[k]=1; st.push([nx,ny]);
    }
  }
  return c;
}

function aiDecide() {
  if (!alive || !snake || snake.length === 0) return;
  const head = snake[0];
  const grid = makeGrid();
  const now = performance.now();
  const cTargets = candles.map((c,i)=>{
    const lr = 1-Math.min((now-c.birth)/CANDLE_LIFETIME, 1);
    return {x:c.x, y:c.y, id:i, lr};
  }).filter(c=>c.lr>0.05);
  const sg = new Uint8Array(grid);
  sg[head.y*COLS+head.x] = 0;
  const rev = DIRS.findIndex(d=>d.x===-dir.x&&d.y===-dir.y);
  const paths = bfs(head.x, head.y, sg, cTargets, rev);
  let cands = [];
  for (const ct of cTargets) {
    const p = paths.get(ct.id);
    if (!p) continue;
    const urg = (1-ct.lr)*2;
    cands.push({...ct, dist:p.dist, dirIdx:p.dirIdx, score:urg+1/(p.dist+1)});
  }
  cands.sort((a,b)=>b.score-a.score);
  for (const c of cands) {
    const d = DIRS[c.dirIdx];
    if (canReachTail(head.x+d.x, head.y+d.y, snake)) { nextDir={...d}; return; }
  }
  if (snake.length <= 4 && cands.length > 0) { nextDir={...DIRS[cands[0].dirIdx]}; return; }
  const tail = snake[snake.length-1];
  const tTgts = [];
  for (let d=0;d<4;d++) {
    const tx=tail.x+DIRS[d].x, ty=tail.y+DIRS[d].y;
    if (tx>=0&&tx<COLS&&ty>=0&&ty<ROWS) tTgts.push({x:tx,y:ty,id:'tn'+d});
  }
  const tP = bfs(head.x, head.y, sg, tTgts, rev);
  let best = null;
  for (const [,tp] of tP) { if (!best||tp.dist<best.dist) best=tp; }
  if (best) { nextDir={...DIRS[best.dirIdx]}; return; }
  let bestD=null, bestS=-1;
  for (let d=0;d<4;d++) {
    if (d===rev) continue;
    const nx=head.x+DIRS[d].x, ny=head.y+DIRS[d].y;
    if (nx<0||nx>=COLS||ny<0||ny>=ROWS||grid[ny*COLS+nx]) continue;
    const s = floodSize(nx, ny, sg);
    if (s > bestS) { bestS=s; bestD=d; }
  }
  if (bestD !== null) nextDir={...DIRS[bestD]};
}

// =========================================
// PARTICLES
// =========================================
function emitFlame(px, py, count, hue, spread) {
  for (let i=0; i<count; i++) particles.push({
    x:px+(Math.random()-0.5)*spread, y:py+(Math.random()-0.5)*spread,
    vx:(Math.random()-0.5)*1.5, vy:-1-Math.random()*2.5,
    life:0.5+Math.random()*0.6, maxLife:0.5+Math.random()*0.6,
    size:2+Math.random()*4, hue:hue+(Math.random()-0.5)*20,
  });
}
function emitDeath(px, py) {
  for (let i=0;i<40;i++) {
    const a=Math.random()*Math.PI*2, spd=1+Math.random()*4;
    particles.push({x:px,y:py,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,
      life:0.8+Math.random()*0.8,maxLife:0.8+Math.random()*0.8,
      size:3+Math.random()*6,hue:10+Math.random()*40});
  }
}
function emitCandleOut(cx, cy) {
  for (let i=0;i<15;i++) particles.push({
    x:cx,y:cy,vx:(Math.random()-0.5)*2,vy:-1.5-Math.random()*2,
    life:0.4+Math.random()*0.5,maxLife:0.4+Math.random()*0.5,
    size:1.5+Math.random()*2.5,hue:0,smoke:true});
}
function updateParticles(dt) {
  for (let i=particles.length-1;i>=0;i--) {
    const p=particles[i];
    p.x+=p.vx*dt*60; p.y+=p.vy*dt*60; p.vy-=0.03*dt*60;
    p.life-=dt;
    if (p.life<=0) particles.splice(i,1);
  }
}
function drawParticles() {
  for (const p of particles) {
    const t=p.life/p.maxLife, alpha=t*0.9, size=p.size*(0.5+t*0.5);
    if (p.smoke) { ctx.fillStyle=`rgba(120,110,100,${alpha*0.4})`; }
    else {
      ctx.fillStyle=`hsla(${p.hue},100%,${50+t*40}%,${alpha})`;
      ctx.shadowColor=`hsla(${p.hue},100%,60%,${alpha*0.5})`; ctx.shadowBlur=8;
    }
    ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
  }
}

// =========================================
// DRAWING
// =========================================
function drawCandle(c, now) {
  const age = now-c.birth;
  const lr = 1-Math.min(age/CANDLE_LIFETIME, 1);
  if (lr<=0) return;
  const cx2=c.x*GRID+GRID/2, baseY=c.y*GRID+GRID;
  const cH=GRID*1.2*c.height*lr, cW=GRID*0.35, topY=baseY-cH;

  const wG=ctx.createLinearGradient(cx2-cW,topY,cx2+cW,baseY);
  wG.addColorStop(0,`hsl(${c.hue+15},25%,80%)`); wG.addColorStop(0.5,`hsl(${c.hue+10},20%,70%)`);
  wG.addColorStop(1,`hsl(${c.hue+5},15%,60%)`);
  ctx.fillStyle=wG; ctx.beginPath(); ctx.roundRect(cx2-cW,topY,cW*2,cH,[3,3,1,1]); ctx.fill();

  for (let i=0;i<3;i++) {
    const dx=Math.sin(c.flicker*1000+i*2.3)*cW*0.8;
    ctx.fillStyle=`hsl(${c.hue+12},18%,73%)`;
    ctx.beginPath();
    ctx.ellipse(cx2+dx,topY+cH*(0.3+i*0.2),2,4+Math.abs(Math.sin(c.flicker*1000+i*1.7))*8*lr,0,0,Math.PI*2);
    ctx.fill();
  }

  ctx.strokeStyle='#1a0a00'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(cx2,topY); ctx.lineTo(cx2,topY-5); ctx.stroke();

  const flick=Math.sin(now*0.012+c.flicker)*2+Math.sin(now*0.023+c.flicker*2);
  const fH=(8+Math.sin(now*0.008+c.flicker)*3)*Math.min(lr*3,1);
  const fCx=cx2+flick*0.5, fCy=topY-5;

  const gR=20+Math.sin(now*0.01+c.flicker)*5;
  const glow=ctx.createRadialGradient(fCx,fCy-fH*0.4,0,fCx,fCy-fH*0.4,gR);
  glow.addColorStop(0,`hsla(40,100%,70%,${0.15*lr})`); glow.addColorStop(1,'hsla(40,100%,50%,0)');
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(fCx,fCy-fH*0.4,gR,0,Math.PI*2); ctx.fill();

  const fG=ctx.createLinearGradient(fCx,fCy,fCx,fCy-fH);
  fG.addColorStop(0,'hsla(30,100%,50%,0.95)'); fG.addColorStop(0.3,'hsla(45,100%,60%,0.9)');
  fG.addColorStop(0.7,'hsla(50,100%,80%,0.7)'); fG.addColorStop(1,'hsla(55,100%,95%,0.3)');
  ctx.fillStyle=fG; ctx.beginPath();
  ctx.moveTo(fCx,fCy);
  ctx.bezierCurveTo(fCx-5,fCy-fH*0.3,fCx-4+flick*0.3,fCy-fH*0.8,fCx+flick*0.4,fCy-fH);
  ctx.bezierCurveTo(fCx+4+flick*0.3,fCy-fH*0.8,fCx+5,fCy-fH*0.3,fCx,fCy);
  ctx.fill();

  ctx.fillStyle=`hsla(55,100%,95%,${0.5*lr})`;
  ctx.beginPath(); ctx.ellipse(fCx,fCy-fH*0.25,2,fH*0.25,0,0,Math.PI*2); ctx.fill();

  if (Math.random()<0.15*lr) emitFlame(fCx,fCy-fH*0.5,1,c.hue+20,4);
  if (lr<0.25) {
    const u=1-lr/0.25;
    if (Math.random()<u*0.3) {
      ctx.fillStyle=`rgba(255,50,0,${0.1+u*0.15})`;
      ctx.beginPath(); ctx.arc(cx2,c.y*GRID+GRID/2,GRID*0.8,0,Math.PI*2); ctx.fill();
    }
  }
}

function drawHellfire(c, now) {
  const age = now - c.birth;
  const lr = 1 - Math.min(age / CANDLE_LIFETIME, 1);
  if (lr <= 0) return;
  const cx2 = c.x * GRID + GRID / 2, cy2 = c.y * GRID + GRID / 2;

  // Glowing crack center
  const crackGlow = 0.3 + lr * 0.4 + Math.sin(now * 0.006 + c.flicker) * 0.1;
  const gR = GRID * (0.6 + lr * 0.3);
  const gGrad = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, gR);
  gGrad.addColorStop(0, `rgba(255,60,0,${crackGlow * 0.5})`);
  gGrad.addColorStop(0.5, `rgba(200,20,0,${crackGlow * 0.2})`);
  gGrad.addColorStop(1, 'rgba(100,0,0,0)');
  ctx.fillStyle = gGrad;
  ctx.beginPath(); ctx.arc(cx2, cy2, gR, 0, Math.PI * 2); ctx.fill();

  // Hellfire flames
  const flames = 3 + Math.floor(lr * 3);
  for (let i = 0; i < flames; i++) {
    const angle = (i / flames) * Math.PI * 2 + Math.sin(now * 0.008 + i) * 0.5;
    const dist = GRID * 0.1 + Math.sin(now * 0.01 + i * 2.3) * GRID * 0.08;
    const fx = cx2 + Math.cos(angle) * dist;
    const fy = cy2 + Math.sin(angle) * dist;
    const fH = (GRID * 0.4 + Math.sin(now * 0.012 + c.flicker + i) * GRID * 0.15) * lr;
    const fW = GRID * 0.15 * lr;
    const hue = c.hue + Math.sin(now * 0.01 + i) * 10;
    const fGrad = ctx.createLinearGradient(fx, fy, fx, fy - fH);
    fGrad.addColorStop(0, `hsla(${hue},100%,50%,${0.85 * lr})`);
    fGrad.addColorStop(0.4, `hsla(${hue + 20},100%,58%,${0.6 * lr})`);
    fGrad.addColorStop(1, `hsla(${hue + 35},100%,75%,0)`);
    ctx.fillStyle = fGrad;
    const flick = Math.sin(now * 0.015 + i * 1.7) * fW * 0.5;
    ctx.beginPath();
    ctx.moveTo(fx - fW, fy);
    ctx.bezierCurveTo(fx - fW * 0.5, fy - fH * 0.4, fx + flick - fW * 0.3, fy - fH * 0.8, fx + flick, fy - fH);
    ctx.bezierCurveTo(fx + flick + fW * 0.3, fy - fH * 0.8, fx + fW * 0.5, fy - fH * 0.4, fx + fW, fy);
    ctx.fill();
  }

  // Bright core
  ctx.fillStyle = `rgba(255,200,100,${0.3 * lr})`;
  ctx.beginPath(); ctx.arc(cx2, cy2, GRID * 0.12, 0, Math.PI * 2); ctx.fill();

  if (Math.random() < 0.2 * lr) emitFlame(cx2 + (Math.random()-0.5)*GRID*0.4, cy2 - GRID*0.2, 2, c.hue, 8);
}

function drawSnake(now) {
  const len=snake.length;
  const style = Church.getSnakeStyle();
  for (let i=len-1;i>=0;i--) {
    const s=snake[i], px=s.x*GRID, py=s.y*GRID;
    const t=i/len;
    if (i===0) {
      ctx.fillStyle = style.headColor;
      ctx.beginPath(); ctx.roundRect(px+1,py+1,GRID-2,GRID-2,5); ctx.fill();
    } else {
      ctx.fillStyle = style.bodyFn(t);
      ctx.beginPath(); ctx.roundRect(px+1.5,py+1.5,GRID-3,GRID-3,3); ctx.fill();
    }
    if (i===0) {
      const eS=3;
      const eOX=dir.x===0?5:(dir.x>0?12:5), eOY=dir.y===0?5:(dir.y>0?12:5);
      const eOX2=dir.x===0?12:eOX, eOY2=dir.y===0?12:eOY;
      if (style.eyeGlow) { ctx.shadowColor='rgba(255,0,0,0.6)'; ctx.shadowBlur=8; }
      ctx.fillStyle=style.eyeColor;
      ctx.beginPath(); ctx.arc(px+eOX,py+eOY,eS,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px+eOX2,py+eOY2,eS,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle='#1a0a00';
      ctx.beginPath(); ctx.arc(px+eOX+dir.x,py+eOY+dir.y,1.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px+eOX2+dir.x,py+eOY2+dir.y,1.5,0,Math.PI*2); ctx.fill();
      Church.drawDemonHead(ctx, px, py, GRID, dir, now);
    }
  }

  // Tail flame (only in burning/demon phases)
  if (len > 0 && style.showTailFlame) {
    const tail=snake[len-1], tx=tail.x*GRID+GRID/2, ty=tail.y*GRID+GRID/2;
    let fdx=0, fdy=-1;
    if (len>=2) { const p=snake[len-2]; fdx=tail.x-p.x; fdy=tail.y-p.y; if(fdx===0&&fdy===0){fdx=0;fdy=-1;} }
    const fbx=tx+fdx*GRID*0.35, fby=ty+fdy*GRID*0.35;
    const fl1=Math.sin(now*0.013)*3, fl2=Math.sin(now*0.021+1.5)*2, fl3=Math.cos(now*0.017+0.7)*1.5;
    const br=1+Math.sin(now*0.006)*0.15;
    const pX=-fdy, pY=fdx;
    const fH=(14+Math.sin(now*0.009)*3)*br;
    const gR=22*br;
    const fHue = style.flameHue;
    const gl=ctx.createRadialGradient(fbx,fby,0,fbx,fby,gR);
    gl.addColorStop(0,`hsla(${fHue},100%,55%,0.25)`); gl.addColorStop(0.6,`hsla(${fHue},100%,45%,0.08)`);
    gl.addColorStop(1,`hsla(${fHue},100%,40%,0)`);
    ctx.fillStyle=gl; ctx.beginPath(); ctx.arc(fbx,fby,gR,0,Math.PI*2); ctx.fill();

    const tipX=fbx+fdx*fH+pX*fl1*0.4, tipY=fby+fdy*fH+pY*fl1*0.4;
    const oG=ctx.createRadialGradient(fbx,fby,0,tipX,tipY,fH);
    oG.addColorStop(0,`hsla(${fHue+5},100%,55%,0.95)`); oG.addColorStop(0.4,`hsla(${fHue-5},100%,50%,0.85)`);
    oG.addColorStop(0.8,`hsla(${fHue-15},100%,45%,0.5)`); oG.addColorStop(1,`hsla(${fHue-20},100%,40%,0)`);
    ctx.fillStyle=oG; ctx.beginPath();
    ctx.moveTo(fbx+pX*5, fby+pY*5);
    ctx.bezierCurveTo(fbx+fdx*fH*0.3+pX*(6+fl2),fby+fdy*fH*0.3+pY*(6+fl2),
      fbx+fdx*fH*0.7+pX*(3+fl3),fby+fdy*fH*0.7+pY*(3+fl3),tipX,tipY);
    ctx.bezierCurveTo(fbx+fdx*fH*0.7-pX*(3-fl3),fby+fdy*fH*0.7-pY*(3-fl3),
      fbx+fdx*fH*0.3-pX*(6-fl2),fby+fdy*fH*0.3-pY*(6-fl2),fbx-pX*5,fby-pY*5);
    ctx.fill();
    // Core
    const cH=fH*0.5, ctX=fbx+fdx*cH+pX*fl1*0.2, ctY=fby+fdy*cH+pY*fl1*0.2;
    ctx.fillStyle='hsla(50,100%,90%,0.7)'; ctx.beginPath();
    ctx.moveTo(fbx+pX*2.5,fby+pY*2.5);
    ctx.bezierCurveTo(fbx+fdx*cH*0.4+pX*3,fby+fdy*cH*0.4+pY*3,fbx+fdx*cH*0.8+pX,fby+fdy*cH*0.8+pY,ctX,ctY);
    ctx.bezierCurveTo(fbx+fdx*cH*0.8-pX,fby+fdy*cH*0.8-pY,fbx+fdx*cH*0.4-pX*3,fby+fdy*cH*0.4-pY*3,fbx-pX*2.5,fby-pY*2.5);
    ctx.fill();
    if (Math.random()<0.7) emitFlame(fbx+fdx*fH*0.4+(Math.random()-0.5)*8,fby+fdy*fH*0.4+(Math.random()-0.5)*8,2,fHue,6);
    if (Math.random()<0.3) particles.push({x:tipX+(Math.random()-0.5)*4,y:tipY+(Math.random()-0.5)*4,
      vx:fdx*(2+Math.random()*3)+(Math.random()-0.5)*2,vy:fdy*(2+Math.random()*3)+(Math.random()-0.5)*2,
      life:0.3+Math.random()*0.4,maxLife:0.3+Math.random()*0.4,size:1.5+Math.random()*2,hue:fHue+10+Math.random()*15});
  }
}

// =========================================
// GAME LOGIC
// =========================================
function moveSnake() {
  if (!alive) return;
  dir = {...nextDir};
  const head=snake[0], nx=head.x+dir.x, ny=head.y+dir.y;
  const pewGrid = Church.getPewGrid();
  if (nx<0||nx>=COLS||ny<0||ny>=ROWS) { die(); return; }
  if (pewGrid[ny*COLS+nx]) { die(); return; }
  if (snake.some((s,i)=>i>0&&s.x===nx&&s.y===ny)) { die(); return; }
  snake.unshift({x:nx,y:ny});
  Church.addTileCorr(nx, ny);

  let ate = false;
  for (let i=candles.length-1;i>=0;i--) {
    if (candles[i].x===nx && candles[i].y===ny) {
      const c=candles[i];
      const lr=1-Math.min((performance.now()-c.birth)/CANDLE_LIFETIME,1);
      score += 10+Math.floor(lr*100);
      const segs = 2+Math.floor(lr*3);
      for (let j=0;j<segs;j++) { const t=snake[snake.length-1]; snake.push({x:t.x,y:t.y}); }
      emitFlame(c.x*GRID+GRID/2, c.y*GRID, 12, 45, 12);
      candles.splice(i, 1);
      ate = true;
      totalCandlesEaten++;
      Church.setCandlesEaten(totalCandlesEaten);
      AudioEngine.playEat();
      // Blood spawns occasionally after eating
      if (Math.random() < 0.4) Church.spawnBlood(nx, ny);
      break;
    }
  }
  if (!ate) snake.pop();

  // Corruption increases: based on candles eaten + time
  const targetCorr = Math.min(totalCandlesEaten * 0.04 + gameTime * 0.002, 1);
  const currentCorr = Church.getCorruption();
  Church.setCorruption(currentCorr + (targetCorr - currentCorr) * 0.02);

  updateHUD();
}

function burnTail() {
  if (!alive || snake.length <= 1) return;
  const tail = snake.pop();
  emitFlame(tail.x*GRID+GRID/2, tail.y*GRID+GRID/2, 6, 15, 10);
  AudioEngine.playBurn();
  // Blood from burning
  if (Math.random() < 0.15 && Church.getCorruption() > 0.4) Church.spawnBlood(tail.x, tail.y);
  if (snake.length <= 1) die();
  updateHUD();
}

function die() {
  alive = false;
  const head = snake[0];
  emitDeath(head.x*GRID+GRID/2, head.y*GRID+GRID/2);
  for (const s of snake) if (Math.random()<0.5) emitFlame(s.x*GRID+GRID/2,s.y*GRID+GRID/2,3,10,12);
  // Death blood pool
  Church.spawnBlood(head.x, head.y);
  AudioEngine.playDeath();
  setTimeout(showGameOver, 800);
}

function showGameOver() {
  const ov = document.getElementById('overlay');
  ov.classList.remove('hidden');
  const c = Church.getCorruption();
  document.getElementById('overlay-title').textContent = c > 0.7 ? 'Damnation' : c > 0.4 ? 'Consumed' : 'Extinguished';
  document.getElementById('overlay-sub').textContent = c > 0.7
    ? 'Even demons are not eternal.'
    : c > 0.4 ? 'The flame claims all things.'
    : 'Your light gutters and dies.';
  const sl = document.getElementById('overlay-score');
  sl.classList.remove('hidden');
  sl.textContent = `Souls: ${totalCandlesEaten}  ·  Score: ${score}`;
  document.getElementById('start-btn').textContent = 'Resurrect';
}

function updateCandles(now) {
  for (let i=candles.length-1;i>=0;i--) {
    if (now-candles[i].birth >= CANDLE_LIFETIME) {
      const c=candles[i];
      emitCandleOut(c.x*GRID+GRID/2, c.y*GRID);
      AudioEngine.playCandleOut();
      candles.splice(i, 1);
    }
  }
}

function updateHUD() {
  document.getElementById('hud-segs').textContent = snake ? snake.length : 0;
  document.getElementById('hud-candles').textContent = candles.length;
  document.getElementById('hud-score').textContent = score || 0;
}

// =========================================
// MAIN LOOP
// =========================================
let lastTime = 0;
let burnAcc=0, moveAcc=0, spawnAcc=0;

function gameLoop(ts) {
  try {
    if (!lastTime) lastTime = ts;
    const dt = Math.min((ts-lastTime)/1000, 0.1);
    lastTime = ts;

    if (gameStarted && alive) {
      gameTime += dt;
      moveAcc += dt*1000; burnAcc += dt*1000; spawnAcc += dt*1000;
      while (moveAcc >= MOVE_INTERVAL) {
        if (wallpaperMode) aiDecide();
        moveSnake();
        moveAcc -= MOVE_INTERVAL;
      }
      while (burnAcc >= BURN_INTERVAL) { burnTail(); burnAcc -= BURN_INTERVAL; }
      while (spawnAcc >= CANDLE_SPAWN_INTERVAL) { spawnCandle(); spawnAcc -= CANDLE_SPAWN_INTERVAL; updateHUD(); }
      updateCandles(ts);

      // Emit particles from burning pews
      for (const p of Church.getBurningPews()) {
        if (Math.random() < 0.25) {
          const fx = (p.x + Math.random()*p.w)*GRID;
          const fy = p.y*GRID;
          emitFlame(fx, fy, 1, 20, GRID*0.5);
        }
      }
    }

    Church.update(dt, ts);
    updateParticles(dt);

    // --- DRAW ---
    ctx.fillStyle = '#08060a';
    ctx.fillRect(0, 0, W, H);
    Church.drawTiles(ctx, GRID, ts);
    Church.drawBlood(ctx, GRID, ts);
    Church.drawCracks(ctx, GRID, ts);
    Church.drawStainedGlass(ctx, GRID, ts);
    Church.drawAltar(ctx, GRID, ts);
    Church.drawPews(ctx, GRID, ts);
    Church.drawStatues(ctx, GRID, ts);

    if (gameStarted) {
      for (const c of candles) {
        if (c.type === 'hellfire') drawHellfire(c, ts);
        else drawCandle(c, ts);
      }
      drawSnake(ts);
    }

    drawParticles();

    // Glyph renders ABOVE everything - floating in the air
    Church.drawGlyph(ctx, GRID, ts);

    Church.drawLightning(ctx, W, H);
    Church.drawVignette(ctx, W, H, ts);

  } catch(err) {
    ctx.fillStyle='#ff4444'; ctx.font='14px monospace';
    ctx.fillText('ERR: '+err.message, 10, 30);
    console.error(err);
  }
  requestAnimationFrame(gameLoop);
}

// =========================================
// SETUP
// =========================================
function startGame() {
  resize();
  wallpaperMode = document.getElementById('wallpaper-check').checked;
  AudioEngine.init(); AudioEngine.resume();
  // Enable sound on first play (user click satisfies autoplay policy)
  const wantsSound = document.getElementById('sound-toggle').textContent !== '🔇off';
  AudioEngine.setEnabled(true);
  document.getElementById('sound-toggle').textContent = '🔊';
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('overlay-score').classList.add('hidden');
  init();
  lastTime=0; burnAcc=0; moveAcc=0; spawnAcc=0;
}

const startBtn = document.getElementById('start-btn');
startBtn.addEventListener('click', startGame);
startBtn.addEventListener('touchend', e => { e.preventDefault(); startGame(); });

const dpadToggle = document.getElementById('dpad-toggle');
const dpadCheck = document.getElementById('dpad-check');
const wallpaperCheck = document.getElementById('wallpaper-check');
if (isTouch) dpadToggle.classList.remove('hidden');
dpadCheck.addEventListener('change', () => document.body.classList.toggle('show-dpad', dpadCheck.checked));
wallpaperCheck.addEventListener('change', () => {
  if (wallpaperCheck.checked) { dpadCheck.checked=false; document.body.classList.remove('show-dpad'); dpadToggle.classList.add('hidden'); }
  else if (isTouch) dpadToggle.classList.remove('hidden');
});

const soundBtn = document.getElementById('sound-toggle');
function toggleSound() { const on=AudioEngine.toggle(); soundBtn.textContent=on?'🔊':'🔇'; }
soundBtn.addEventListener('click', toggleSound);
soundBtn.addEventListener('touchend', e => { e.preventDefault(); toggleSound(); });

requestAnimationFrame(gameLoop);
