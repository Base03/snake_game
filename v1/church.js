// =========================================
// CHURCH ENVIRONMENT
// =========================================
const Church = (() => {
  let pews = [];
  let pewGrid = null;
  let cols = 0, rows = 0;
  let corruption = 0;        // Master 0→1
  let tileCorr = {};         // "x,y" → intensity
  let glyphGrowth = 0;       // 0→1, grows with corruption
  let glyphAngle = 0;
  let bloodPools = [];
  let stainedGlass = [];
  let lightningTimer = 0;
  let lightningAlpha = 0;
  let candlesEaten = 0;
  let cracks = [];      // {x, y, angle, len} - permanent floor cracks
  let statues = [];     // {x, y, side, crying, tearY}

  // --- Level generation ---
  function generate(c, r) {
    cols = c; rows = r;
    pews = [];
    bloodPools = [];
    tileCorr = {};
    corruption = 0;
    glyphGrowth = 0;
    glyphAngle = 0;
    lightningTimer = 8000 + Math.random() * 12000;
    lightningAlpha = 0;
    candlesEaten = 0;
    cracks = [];
    statues = [];

    const aisleX = Math.floor(c / 2);
    const aisleW = 2;
    // Pews start at row 7 (altar is 3 deep + gap)
    for (let row = 7; row < r - 2; row += 3) {
      const lS = 2, lE = aisleX - Math.floor(aisleW/2) - 1;
      if (lE > lS + 1) pews.push({ x:lS, y:row, w:lE-lS, h:1, burning:false, burnT:0, dead:false });
      const rS = aisleX + Math.ceil(aisleW/2) + 1, rE = c - 2;
      if (rE > rS + 1) pews.push({ x:rS, y:row, w:rE-rS, h:1, burning:false, burnT:0, dead:false });
    }

    // Stained glass windows on walls
    stainedGlass = [];
    const spacing = Math.max(3, Math.floor(r / 4));
    for (let wy = 4; wy < r - 2; wy += spacing) {
      stainedGlass.push({ side:0, y:wy, hue: Math.random()*360, pat: Math.floor(Math.random()*3) });
      stainedGlass.push({ side:1, y:wy, hue: Math.random()*360, pat: Math.floor(Math.random()*3) });
    }

    // Statues in naves near stained glass windows
    for (const w of stainedGlass) {
      const sx = w.side === 0 ? 1 : c - 2;
      const sy = w.y;
      // Check not on a pew
      const onPew = pews.some(p => sy === p.y && sx >= p.x && sx < p.x + p.w);
      if (!onPew && sy > 3 && sy < r - 2) {
        statues.push({ x: sx, y: sy, side: w.side, crying: false, tearY: 0, bloodSpawned: false });
      }
    }

    rebuildPewGrid();
  }

  function rebuildPewGrid() {
    pewGrid = new Uint8Array(cols * rows);
    for (const p of pews) {
      if (p.dead) continue;
      for (let dx = 0; dx < p.w; dx++) {
        const px = p.x+dx, py = p.y;
        if (px >= 0 && px < cols && py >= 0 && py < rows) pewGrid[py*cols+px] = 1;
      }
    }
    // Altar: 6 wide, 3 deep, top center
    const ax = Math.floor(cols/2) - 3;
    for (let dx = 0; dx < 6; dx++) for (let dy = 0; dy < 3; dy++) {
      const x = ax+dx, y = dy;
      if (x >= 0 && x < cols && y >= 0 && y < rows) pewGrid[y*cols+x] = 1;
    }
    // Statues
    for (const s of statues) {
      if (s.x >= 0 && s.x < cols && s.y >= 0 && s.y < rows) pewGrid[s.y*cols+s.x] = 1;
    }
  }

  function getPewGrid() { return pewGrid; }

  // --- Pew burning ---
  function tryBurnPewsNear(cx, cy) {
    let burned = false;
    for (const p of pews) {
      if (p.dead || p.burning) continue;
      for (let dx = 0; dx < p.w; dx++) {
        if (Math.abs(p.x+dx - cx) + Math.abs(p.y - cy) <= 1) {
          p.burning = true; p.burnT = 0; burned = true;
          AudioEngine.playPewBurn();
          break;
        }
      }
    }
    return burned;
  }

  function getBurningPews() { return pews.filter(p => p.burning && !p.dead); }

  // --- Corruption ---
  function setCorruption(v) {
    corruption = Math.max(0, Math.min(1, v));
    AudioEngine.setCorruption(corruption);
  }
  function getCorruption() { return corruption; }

  function addTileCorr(x, y) {
    tileCorr[x+','+y] = Math.min((tileCorr[x+','+y]||0) + 0.12, 1);
  }

  // --- Blood ---
  function spawnBlood(x, y) {
    if (corruption < 0.3 || bloodPools.length > 20) return;
    bloodPools.push({ x, y, r: 0.3+Math.random()*0.5, a:0, ta: 0.12+corruption*0.35, angle: Math.random()*6.28 });
  }

  // --- Update ---
  function update(dt, now) {
    // Pew burning
    let changed = false;
    for (const p of pews) {
      if (p.burning && !p.dead) {
        p.burnT += dt * 1000;
        if (p.burnT > 3500) { p.dead = true; changed = true; }
      }
    }
    if (changed) rebuildPewGrid();

    // Tile corruption decay
    for (const k in tileCorr) {
      tileCorr[k] -= 0.00015 * dt * 60;
      if (tileCorr[k] <= 0) delete tileCorr[k];
    }

    // Glyph only begins after windows have gone red (corruption > 0.5)
    const glyphTarget = corruption > 0.5 ? (corruption - 0.5) * 2 : 0;
    glyphGrowth += (glyphTarget - glyphGrowth) * dt * 0.3;
    if (glyphGrowth < 0.005) glyphGrowth = 0;
    glyphAngle += dt * (0.08 + corruption * 0.25);

    // Blood pools expand slowly
    for (const b of bloodPools) {
      b.a = Math.min(b.a + dt * 0.06, b.ta);
      b.r = Math.min(b.r + dt * 0.003, 1.4);
    }

    // Lightning
    lightningTimer -= dt * 1000;
    if (lightningTimer <= 0) {
      lightningTimer = (8000 + Math.random() * 14000) / (1 + corruption * 0.6);
      lightningAlpha = 1;
      AudioEngine.playLightning();
    }
    if (lightningAlpha > 0) lightningAlpha = Math.max(0, lightningAlpha - dt * 3.5);

    // Statues start crying blood at high corruption (demon phase)
    for (const s of statues) {
      if (corruption > 0.6 && !s.crying) s.crying = true;
      if (s.crying) {
        s.tearY = Math.min(s.tearY + dt * 8, 1);
        // Periodically spawn blood pools beneath statues
        if (!s.bloodSpawned && s.tearY > 0.5) {
          spawnBlood(s.x, s.y + 1);
          s.bloodSpawned = true;
        }
        if (s.tearY >= 1 && Math.random() < dt * 0.3) {
          spawnBlood(s.x, s.y + 1);
        }
      }
    }
  }

  // =========================================
  // DRAWING
  // =========================================

  function drawTiles(ctx, G, now) {
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const dark = (x+y)%2===0;
      const seed = Math.sin(x*127.1+y*311.7)*0.5+0.5;
      const l = (dark ? 8 : 11) + seed * 3;
      ctx.fillStyle = `hsl(25,8%,${l}%)`;
      ctx.fillRect(x*G, y*G, G, G);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x*G+0.5, y*G+0.5, G-1, G-1);
      // Tile corruption glow
      const tc = tileCorr[x+','+y]||0;
      if (tc > 0) {
        ctx.fillStyle = `hsla(${8+Math.sin(now*0.003+x+y)*8},100%,${28+tc*18}%,${tc*0.35})`;
        ctx.fillRect(x*G, y*G, G, G);
        if (tc > 0.25) {
          ctx.strokeStyle = `rgba(180,40,0,${tc*0.4})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          const cx2=x*G+G*0.5, cy2=y*G+G*0.5;
          ctx.moveTo(cx2-G*0.3, cy2); ctx.lineTo(cx2+G*0.15, cy2-G*0.2); ctx.lineTo(cx2+G*0.3, cy2+G*0.1);
          ctx.stroke();
        }
      }
    }
  }

  function drawBlood(ctx, G, now) {
    for (const b of bloodPools) {
      if (b.a < 0.01) continue;
      const bx = b.x*G+G/2, by = b.y*G+G/2, br = b.r*G;
      const pulse = Math.sin(now*0.002+b.x+b.y)*0.02;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      grad.addColorStop(0, `rgba(70,0,0,${b.a+pulse})`);
      grad.addColorStop(0.6, `rgba(45,0,0,${(b.a+pulse)*0.5})`);
      grad.addColorStop(1, 'rgba(30,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(bx, by, br, br*0.7, b.angle, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function drawAltar(ctx, G, now) {
    const ax = Math.floor(cols/2)-3;
    const altarW = 6; // wider
    const altarH = 3; // taller
    const px = ax*G, aW = altarW*G, aH = altarH*G;

    // Stone altar base — warmer, brighter
    const ag = ctx.createLinearGradient(px, 0, px, aH);
    ag.addColorStop(0, '#4a3830'); ag.addColorStop(0.5, '#3d2d25'); ag.addColorStop(1, '#2a1c16');
    ctx.fillStyle = ag;
    ctx.fillRect(px+2, 2, aW-4, aH-2);

    // Stone texture lines
    ctx.strokeStyle = 'rgba(80,60,45,0.3)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < altarH; i++) {
      ctx.beginPath();
      ctx.moveTo(px+4, i*G);
      ctx.lineTo(px+aW-4, i*G + Math.sin(i*3.7)*2);
      ctx.stroke();
    }

    // Gold trim — brighter, double line
    const trimAlpha = 0.5 - corruption * 0.3;
    ctx.strokeStyle = `rgba(210,175,90,${trimAlpha})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(px+3, 3, aW-6, aH-4);
    ctx.strokeStyle = `rgba(180,145,70,${trimAlpha*0.6})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(px+6, 6, aW-12, aH-10);

    // Altar cloth
    const clothH = 6;
    const clothHue = corruption > 0.4 ? 0 : 120 - corruption * 200;
    ctx.fillStyle = `hsl(${clothHue},${25+corruption*45}%,${18+corruption*6}%)`;
    ctx.fillRect(px+8, aH-clothH-2, aW-16, clothH);
    // Cloth fringe
    ctx.fillStyle = `rgba(210,175,90,${trimAlpha*0.7})`;
    ctx.fillRect(px+8, aH-clothH-2, aW-16, 1.5);

    // Candelabra marks on altar edges
    for (const cx2 of [px+G*0.8, px+aW-G*0.8]) {
      ctx.fillStyle = `rgba(210,175,90,${trimAlpha})`;
      ctx.beginPath(); ctx.arc(cx2, G*0.8, 2.5, 0, Math.PI*2); ctx.fill();
    }

    // Cross — gradually inverts
    const crossX = (ax+3)*G, crossY = aH + G*0.4;
    ctx.save();
    ctx.translate(crossX, crossY);
    const inv = corruption > 0.55 ? Math.min((corruption-0.55)*2.2, 1) : 0;
    ctx.rotate(Math.PI * inv);
    ctx.strokeStyle = `rgba(210,175,90,${Math.max(0.45-corruption*0.2, 0.08)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -G*1.0); ctx.lineTo(0, G*0.8);
    ctx.moveTo(-G*0.5, -G*0.3); ctx.lineTo(G*0.5, -G*0.3);
    ctx.stroke();
    // Corruption makes cross glow red
    if (corruption > 0.5) {
      ctx.strokeStyle = `rgba(200,30,0,${(corruption-0.5)*0.5})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // Altar glow at high corruption
    if (corruption > 0.4) {
      const gA = (corruption-0.4)*0.15;
      const glow = ctx.createRadialGradient(px+aW/2, aH/2, 0, px+aW/2, aH/2, aW*0.6);
      glow.addColorStop(0, `rgba(180,30,0,${gA})`);
      glow.addColorStop(1, 'rgba(100,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(px+aW/2, aH/2, aW*0.6, 0, Math.PI*2); ctx.fill();
    }
  }

  function drawPews(ctx, G, now) {
    for (const p of pews) {
      if (p.dead) continue;
      for (let dx = 0; dx < p.w; dx++) {
        const px = (p.x+dx)*G, py = p.y*G;
        if (p.burning) {
          const bt = Math.min(p.burnT / 3500, 1);
          // Darkening wood
          const wl = 22 - bt * 12;
          ctx.fillStyle = `hsl(${18-bt*10},${35+bt*20}%,${wl}%)`;
          ctx.fillRect(px+1, py+1, G-2, G-2);
          // Bright fire overlay
          const fireA = 0.3 + bt * 0.4 + Math.sin(now * 0.015 + dx * 2.1) * 0.08;
          const fireHue = 20 + Math.sin(now * 0.01 + dx) * 15;
          ctx.fillStyle = `hsla(${fireHue},100%,${55 - bt*10}%,${fireA})`;
          ctx.fillRect(px+2, py+2, G-4, G-4);
          // Bright embers/sparks
          const sparkA = 0.4 + Math.sin(now * 0.02 + dx * 3.7) * 0.2;
          ctx.fillStyle = `hsla(45,100%,80%,${sparkA * bt})`;
          const sx = px + 3 + Math.sin(now * 0.008 + dx) * (G * 0.3);
          const sy = py + 3 + Math.cos(now * 0.01 + dx * 1.3) * (G * 0.25);
          ctx.beginPath(); ctx.arc(sx, sy, 1.5 + bt, 0, Math.PI * 2); ctx.fill();
          // Flame glow around the pew
          if (bt > 0.15) {
            const gR = G * (0.8 + bt * 0.8);
            const glow = ctx.createRadialGradient(px+G/2, py+G/2, 0, px+G/2, py+G/2, gR);
            glow.addColorStop(0, `rgba(255,100,20,${bt * 0.12})`);
            glow.addColorStop(1, 'rgba(200,40,0,0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(px+G/2, py+G/2, gR, 0, Math.PI*2); ctx.fill();
          }
        } else {
          // Normal pew — warm visible wood
          const seed = Math.sin(dx * 31.7 + p.y * 17.3) * 0.5 + 0.5;
          const woodH = 25 + seed * 8;
          const woodS = 40 + seed * 15;
          const woodL = 28 + seed * 8;
          // Pew body
          ctx.fillStyle = `hsl(${woodH},${woodS}%,${woodL}%)`;
          ctx.fillRect(px+1, py+1, G-2, G-2);
          // Top rail highlight
          ctx.fillStyle = `hsl(${woodH+3},${woodS-5}%,${woodL+10}%)`;
          ctx.fillRect(px+2, py+1, G-4, 3);
          // Wood grain lines
          ctx.strokeStyle = `hsla(${woodH-5},${woodS}%,${woodL-8}%,0.4)`;
          ctx.lineWidth = 0.5;
          for (let g = 0; g < 3; g++) {
            const gy = py + 4 + g * (G * 0.25);
            ctx.beginPath();
            ctx.moveTo(px+2, gy);
            ctx.lineTo(px+G-2, gy + Math.sin(seed+g)*1.5);
            ctx.stroke();
          }
          // Bottom shadow
          ctx.fillStyle = `hsl(${woodH},${woodS}%,${woodL-10}%)`;
          ctx.fillRect(px+1, py+G-3, G-2, 2);
        }
        // End caps with cross detail
        if (dx === 0 || dx === p.w - 1) {
          const capLum = p.burning ? 12 : 35;
          ctx.fillStyle = `hsl(22,40%,${capLum}%)`;
          ctx.fillRect(dx===0 ? px+1 : px+G-4, py+1, 3, G-2);
          if (!p.burning) {
            const capX = dx===0 ? px+2.5 : px+G-2.5;
            ctx.strokeStyle = `rgba(200,160,80,0.3)`; ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(capX, py+G*0.25); ctx.lineTo(capX, py+G*0.75);
            ctx.moveTo(capX-2, py+G*0.4); ctx.lineTo(capX+2, py+G*0.4);
            ctx.stroke();
          }
        }
      }
    }
  }

  function drawStainedGlass(ctx, G, now) {
    const lFlash = lightningAlpha; // lightning flash intensity
    for (const w of stainedGlass) {
      const wx = w.side === 0 ? 0 : (cols-1)*G;
      const wy = w.y * G;
      const wH = G * 2.5;
      const c = corruption;

      // Window frame
      ctx.fillStyle = '#1a1210';
      ctx.fillRect(wx, wy - wH*0.5, G, wH);

      // Glass panels
      const panels = 4;
      for (let i = 0; i < panels; i++) {
        const panelY = wy - wH*0.4 + (wH*0.8/panels)*i;
        const panelH = wH*0.8/panels - 2;
        const origHue = (w.hue + i*70) % 360;
        const targetHue = 10 + Math.sin(now*0.001+i)*8;
        const hue = origHue + (targetHue - origHue) * c;
        const sat = 55 + c * 35;
        const lum = 30 + c * 22;
        const alpha = 0.15 + c * 0.25 + Math.sin(now*0.002+i)*0.03 + lFlash * 0.5;
        ctx.fillStyle = `hsla(${hue},${sat}%,${lum}%,${alpha})`;
        ctx.fillRect(wx+1, panelY, G-2, panelH);
        // Bright center pane
        ctx.fillStyle = `hsla(${hue},${sat+10}%,${lum+15}%,${alpha*0.5})`;
        ctx.fillRect(wx+3, panelY+2, G-6, panelH-4);
      }

      // Lightning flash: entire window lights up bright white/yellow
      if (lFlash > 0.1) {
        const flashHue = c > 0.5 ? 20 : 50;
        ctx.fillStyle = `hsla(${flashHue},80%,80%,${lFlash * 0.6})`;
        ctx.fillRect(wx+1, wy - wH*0.4, G-2, wH*0.8);
      }

      // ---- Directional light beam (wedge/cone) ----
      const castDir = w.side === 0 ? 1 : -1;
      const beamOriginX = w.side === 0 ? G : (cols-1)*G;
      const beamLen = G * (5 + c * 5);
      const beamSpread = G * 1.8; // half-width at far end
      const lightHue = c < 0.4 ? w.hue : w.hue + (12-w.hue)*Math.min((c-0.4)/0.6, 1);
      const lightAlpha = 0.04 + c * 0.06 + Math.sin(now*0.001+w.y*0.3)*0.012 + lFlash * 0.35;

      ctx.save();
      // Draw a trapezoidal beam shape
      const farX = beamOriginX + castDir * beamLen;
      ctx.beginPath();
      ctx.moveTo(beamOriginX, wy - wH*0.35);
      ctx.lineTo(beamOriginX, wy + wH*0.35);
      ctx.lineTo(farX, wy + beamSpread);
      ctx.lineTo(farX, wy - beamSpread);
      ctx.closePath();

      // Gradient along the beam length
      const bGrad = ctx.createLinearGradient(beamOriginX, wy, farX, wy);
      bGrad.addColorStop(0, `hsla(${lightHue},${50+c*40}%,${35+c*20}%,${lightAlpha*1.8})`);
      bGrad.addColorStop(0.3, `hsla(${lightHue},${45+c*35}%,${30+c*15}%,${lightAlpha})`);
      bGrad.addColorStop(0.7, `hsla(${lightHue},${40+c*30}%,${25+c*10}%,${lightAlpha*0.4})`);
      bGrad.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = bGrad;
      ctx.fill();

      // Bright core beam (narrower, brighter)
      ctx.beginPath();
      ctx.moveTo(beamOriginX, wy - wH*0.15);
      ctx.lineTo(beamOriginX, wy + wH*0.15);
      ctx.lineTo(farX, wy + beamSpread*0.4);
      ctx.lineTo(farX, wy - beamSpread*0.4);
      ctx.closePath();
      const cGrad = ctx.createLinearGradient(beamOriginX, wy, farX, wy);
      cGrad.addColorStop(0, `hsla(${lightHue},${60+c*30}%,${45+c*20}%,${lightAlpha*1.2})`);
      cGrad.addColorStop(0.5, `hsla(${lightHue},${50+c*25}%,${35+c*15}%,${lightAlpha*0.5})`);
      cGrad.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = cGrad;
      ctx.fill();
      ctx.restore();

      // Late-game hellfire glow behind windows
      if (c > 0.5) {
        const hG = (c-0.5)*2;
        const pulse = Math.sin(now*0.004+w.y*0.5)*0.3+0.7;
        const hx = wx + G*0.5;
        const hR = G * 4;
        const hGrad = ctx.createRadialGradient(hx, wy, 0, hx+castDir*G, wy, hR);
        hGrad.addColorStop(0, `rgba(255,80,10,${hG*pulse*0.2})`);
        hGrad.addColorStop(0.4, `rgba(200,40,0,${hG*pulse*0.1})`);
        hGrad.addColorStop(1, 'rgba(100,0,0,0)');
        ctx.fillStyle = hGrad;
        ctx.beginPath();
        ctx.arc(hx+castDir*G*0.5, wy, hR, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  // --- Floor cracks (persist after hellfire consumed) ---
  function addCrack(x, y) {
    // Add 2-4 crack lines radiating from point
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      cracks.push({
        x, y,
        angle: Math.random() * Math.PI * 2,
        len: 0.3 + Math.random() * 0.7,
        branch: Math.random() < 0.4,
        branchAngle: (Math.random() - 0.5) * 1.2,
      });
    }
  }

  function drawCracks(ctx, G, now) {
    if (cracks.length === 0) return;
    for (const cr of cracks) {
      const cx2 = cr.x * G + G/2, cy2 = cr.y * G + G/2;
      const ex = cx2 + Math.cos(cr.angle) * cr.len * G;
      const ey = cy2 + Math.sin(cr.angle) * cr.len * G;

      // Red glow in crack
      const glowA = 0.15 + corruption * 0.2 + Math.sin(now * 0.003 + cr.angle) * 0.05;
      ctx.strokeStyle = `rgba(180,30,0,${glowA})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx2, cy2);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Dark crack line on top
      ctx.strokeStyle = `rgba(10,0,0,0.7)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx2, cy2);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Branch
      if (cr.branch) {
        const mx = (cx2 + ex) / 2, my = (cy2 + ey) / 2;
        const bAngle = cr.angle + cr.branchAngle;
        const bx = mx + Math.cos(bAngle) * cr.len * G * 0.4;
        const by = my + Math.sin(bAngle) * cr.len * G * 0.4;
        ctx.strokeStyle = `rgba(140,20,0,${glowA * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = `rgba(10,0,0,0.5)`;
        ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(bx, by); ctx.stroke();
      }
    }
  }

  // --- Statues (top-down view: stone circle with details) ---
  function drawStatues(ctx, G, now) {
    for (const s of statues) {
      const sx2 = s.x * G + G/2, sy2 = s.y * G + G/2;
      const r = G * 0.4;

      // Base pedestal
      ctx.fillStyle = '#3a3530';
      ctx.fillRect(s.x * G + 2, s.y * G + 2, G - 4, G - 4);

      // Figure (oval, lighter stone)
      const figHue = s.crying ? 0 : 30;
      const figSat = s.crying ? 10 : 6;
      const figLum = s.crying ? 32 : 40;
      ctx.fillStyle = `hsl(${figHue},${figSat}%,${figLum}%)`;
      ctx.beginPath();
      ctx.ellipse(sx2, sy2, r * 0.7, r, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head (small circle)
      const headDir = s.side === 0 ? 1 : -1;
      ctx.fillStyle = `hsl(${figHue},${figSat}%,${figLum + 5}%)`;
      ctx.beginPath();
      ctx.arc(sx2 + headDir * r * 0.15, sy2 - r * 0.55, r * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Halo (fading with corruption)
      if (corruption < 0.7) {
        const haloA = 0.2 * (1 - corruption);
        ctx.strokeStyle = `rgba(210,190,120,${haloA})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx2 + headDir * r * 0.15, sy2 - r * 0.55, r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crying blood tears
      if (s.crying) {
        const tearA = Math.min(s.tearY, 1);
        // Eyes (tiny red dots)
        const headX = sx2 + headDir * r * 0.15;
        const headY = sy2 - r * 0.55;
        for (const eOff of [-0.12, 0.12]) {
          ctx.fillStyle = `rgba(120,0,0,${tearA * 0.8})`;
          ctx.beginPath();
          ctx.arc(headX + eOff * G, headY, 1.2, 0, Math.PI * 2);
          ctx.fill();
          // Tear streaks
          const tearLen = tearA * r * 1.8;
          const tGrad = ctx.createLinearGradient(headX + eOff * G, headY, headX + eOff * G, headY + tearLen);
          tGrad.addColorStop(0, `rgba(100,0,0,${tearA * 0.6})`);
          tGrad.addColorStop(1, `rgba(60,0,0,0)`);
          ctx.fillStyle = tGrad;
          ctx.fillRect(headX + eOff * G - 0.8, headY, 1.6, tearLen);
        }

        // Blood pooling around base
        if (s.tearY > 0.5) {
          const poolA = (s.tearY - 0.5) * 0.3;
          const poolR = G * (0.5 + s.tearY * 0.3);
          const pGrad = ctx.createRadialGradient(sx2, sy2 + r, 0, sx2, sy2 + r, poolR);
          pGrad.addColorStop(0, `rgba(80,0,0,${poolA})`);
          pGrad.addColorStop(1, 'rgba(40,0,0,0)');
          ctx.fillStyle = pGrad;
          ctx.beginPath(); ctx.arc(sx2, sy2 + r, poolR, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  // --- Flame drawing helper ---
  function drawFlame(ctx, x, y, size, now, seed) {
    const layers = 5;
    for (let i = layers - 1; i >= 0; i--) {
      const t = i / layers;
      const flicker = Math.sin(now * 0.012 + seed * 7 + i * 1.3) * 0.3
                    + Math.sin(now * 0.019 + seed * 3.7 + i * 2.1) * 0.2;
      const w = size * (0.6 + t * 0.4) * (0.8 + flicker * 0.3);
      const h = size * (1.0 + t * 1.2) * (0.9 + flicker * 0.2);
      const yOff = -h * 0.4 * t;
      const hue = 30 + t * 30 - 20; // yellow core → orange → red tip
      const lum = 80 - t * 45;
      const alpha = (1 - t * 0.5) * (0.7 + flicker * 0.15);
      ctx.fillStyle = `hsla(${hue},100%,${lum}%,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x, y + yOff, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bright white-yellow core
    ctx.fillStyle = `rgba(255,255,200,0.6)`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGlyph(ctx, G, now) {
    if (glyphGrowth < 0.015) return;
    const cx = Math.floor(cols/2)*G + G/2;
    const cy = Math.floor(rows/2)*G + G/2;
    const maxR = Math.min(cols,rows)*G*0.22;
    const r = maxR * glyphGrowth;
    const a = Math.min(glyphGrowth * 1.5, 0.75);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(glyphAngle);

    // --- Glow underneath (drawn first, behind everything) ---
    ctx.globalAlpha = a * 0.25;
    const glG = ctx.createRadialGradient(0, 0, 0, 0, 0, r*1.5);
    glG.addColorStop(0, 'rgba(200,50,0,0.35)');
    glG.addColorStop(0.5, 'rgba(140,20,0,0.15)');
    glG.addColorStop(1, 'rgba(80,0,0,0)');
    ctx.fillStyle = glG;
    ctx.beginPath(); ctx.arc(0, 0, r*1.5, 0, Math.PI*2); ctx.fill();

    ctx.globalAlpha = a;

    // --- Outer circle with ember glow ---
    const circleHue = 355 + Math.sin(now*0.002)*5;
    ctx.strokeStyle = `hsl(${circleHue},75%,${26+corruption*20}%)`;
    ctx.lineWidth = 1.5 + corruption * 2;
    ctx.shadowColor = `rgba(255,60,0,${corruption*0.5})`;
    ctx.shadowBlur = 6 + corruption * 10;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner circle (appears at ~20%)
    if (glyphGrowth > 0.15) {
      const iA = Math.min((glyphGrowth-0.15)/0.15, 1);
      ctx.globalAlpha = a * iA;
      ctx.strokeStyle = `hsl(${circleHue},70%,${22+corruption*15}%)`;
      ctx.lineWidth = 1 + corruption * 1.2;
      ctx.beginPath(); ctx.arc(0, 0, r*0.6, 0, Math.PI*2); ctx.stroke();
    }

    // --- Pentagram with fire tracing ---
    if (glyphGrowth > 0.08) {
      ctx.globalAlpha = a;
      const progress = Math.min((glyphGrowth - 0.08) / 0.7, 1);
      const isComplete = progress >= 0.999;

      // 5 vertices: inverted pentagram (bottom point)
      const verts = [];
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI / 5) + Math.PI / 2;
        verts.push({ x: Math.cos(angle) * r * 0.85, y: Math.sin(angle) * r * 0.85 });
      }
      // Star order: 0→2→4→1→3→0
      const order = [0, 2, 4, 1, 3, 0];
      const totalLines = 5;
      const drawnLines = progress * totalLines;

      // Draw the star lines with glowing stroke
      ctx.strokeStyle = `hsl(${10+corruption*8},90%,${30+corruption*18}%)`;
      ctx.lineWidth = 1.5 + corruption * 1.5;
      ctx.shadowColor = `rgba(255,80,0,${0.3+corruption*0.4})`;
      ctx.shadowBlur = 4 + corruption * 8;
      ctx.beginPath();
      for (let i = 0; i < totalLines; i++) {
        if (i >= drawnLines) break;
        const from = verts[order[i]];
        const to = verts[order[i + 1]];
        const lp = i < Math.floor(drawnLines) ? 1 : (drawnLines - Math.floor(drawnLines));
        const endX = from.x + (to.x - from.x) * lp;
        const endY = from.y + (to.y - from.y) * lp;
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(endX, endY);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // --- Fire at the tracing tip (leading edge) ---
      if (!isComplete) {
        const currentLine = Math.floor(drawnLines);
        if (currentLine < totalLines) {
          const from = verts[order[currentLine]];
          const to = verts[order[currentLine + 1]];
          const lp = drawnLines - currentLine;
          const tipX = from.x + (to.x - from.x) * lp;
          const tipY = from.y + (to.y - from.y) * lp;
          // The tracing flame — bigger and brighter
          const tipSize = G * (0.4 + corruption * 0.3) + Math.sin(now*0.015)*G*0.08;
          // Unrotate the flame so it always points up visually
          ctx.save();
          ctx.translate(tipX, tipY);
          ctx.rotate(-glyphAngle); // counter-rotate so flames point up in screen space
          drawFlame(ctx, 0, 0, tipSize, now, 99);
          ctx.restore();
        }
      }

      // --- Flames at completed vertices ---
      // A vertex is "reached" when a line ends at it.
      // order: 0→2→4→1→3→0
      // After line 0 completes (0→2), vertex 2 is reached
      // After line 1 completes (2→4), vertex 4 is reached
      // After line 2 completes (4→1), vertex 1 is reached
      // After line 3 completes (1→3), vertex 3 is reached
      // After line 4 completes (3→0), vertex 0 is reached (all 5)
      const reachedVerts = [];
      const completedLines = Math.floor(drawnLines);
      // Destination vertex indices in order of completion
      const destOrder = [2, 4, 1, 3, 0];
      for (let i = 0; i < Math.min(completedLines, 5); i++) {
        const vIdx = destOrder[i];
        const age = (completedLines - i - 1) / 5 + (drawnLines - completedLines) / 5;
        reachedVerts.push({ idx: vIdx, age: Math.min(age, 1) });
      }

      // Draw vertex flames
      for (const rv of reachedVerts) {
        const v = verts[rv.idx];
        const flameSize = G * (0.25 + rv.age * 0.2 + corruption * 0.15);
        // Unrotate flames so they point up in screen space
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(-glyphAngle);
        drawFlame(ctx, 0, 0, flameSize, now, rv.idx);
        ctx.restore();
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawLightning(ctx, W, H) {
    if (lightningAlpha <= 0) return;
    ctx.fillStyle = `rgba(200,190,160,${lightningAlpha*0.12})`;
    ctx.fillRect(0, 0, W, H);
  }

  // --- Corruption-driven vignette ---
  function drawVignette(ctx, W, H, now) {
    if (corruption < 0.15) return;
    const c = corruption;
    const pulse = Math.sin(now * 0.002) * 0.015;
    const edgeAlpha = (c - 0.15) * 0.35 + pulse;

    // Red vignette from edges
    const grad = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.3, W/2, H/2, Math.max(W,H)*0.7);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(60,0,0,${edgeAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // --- Snake appearance: 3 phases based on candles eaten ---
  // Phase 1 (0-5):  Green natural snake
  // Phase 2 (6-12): Burning transition — green darkens to orange/red, fire intensifies
  // Phase 3 (13+):  Demon — dark crimson, horns, glowing eyes
  function setCandlesEaten(n) { candlesEaten = n; }

  function getSnakeStyle() {
    const c = corruption;
    const ce = candlesEaten;

    if (ce <= 5) {
      // Phase 1: Natural green snake
      const t1 = ce / 5; // 0→1 within phase
      return {
        headColor: `hsl(${115-t1*10},${70+t1*10}%,${38-t1*5}%)`,
        bodyFn: (t) => {
          const hue = 120 - t * 15 - t1 * 10;
          const sat = 55 + t1 * 10;
          const lum = 32 - t * 8;
          return `hsl(${hue},${sat}%,${lum}%)`;
        },
        eyeColor: '#1a1a0a',
        eyeGlow: false,
        flameHue: 120, // green-ish (barely visible, tail flame is subtle)
        showTailFlame: false,
        phase: 1,
      };
    } else if (ce <= 12) {
      // Phase 2: Burning transition
      const t2 = (ce - 6) / 6; // 0→1 within phase
      return {
        headColor: `hsl(${100-t2*80},${75+t2*15}%,${35-t2*8}%)`,
        bodyFn: (t) => {
          const hue = (110 - t2 * 85) - t * 15;
          const sat = 60 + t2 * 25;
          const lum = 36 - t * 7 - t2 * 4;
          return `hsl(${hue},${sat}%,${Math.max(lum, 20)}%)`;
        },
        eyeColor: `hsl(${40-t2*35},100%,${55+Math.sin(performance.now()*0.008)*8}%)`,
        eyeGlow: t2 > 0.3,
        flameHue: 60 - t2 * 40, // yellow → orange
        showTailFlame: true,
        phase: 2,
      };
    } else {
      // Phase 3: Demon snake
      return {
        headColor: `hsl(${5-c*3},${88+c*8}%,${32-c*6}%)`,
        bodyFn: (t) => {
          const hue = 8 - t * 5 - c * 5;
          const sat = 85 + c * 10;
          const lum = 35 - t * 8 - c * 4; // floor: 35-8-4=23% at worst
          return `hsl(${hue},${sat}%,${Math.max(lum, 18)}%)`;
        },
        eyeColor: `hsl(0,100%,${55+Math.sin(performance.now()*0.01)*12}%)`,
        eyeGlow: true,
        flameHue: 15 - c * 15,
        showTailFlame: true,
        phase: 3,
      };
    }
  }

  function drawDemonHead(ctx, px, py, G, dir, now) {
    // Horns only in phase 2+ (partial in phase 2, full in phase 3)
    if (candlesEaten < 8) return;
    const hornProgress = candlesEaten <= 12
      ? (candlesEaten - 8) / 4  // 0→1 during late phase 2
      : 1;
    const hornAlpha = Math.min(hornProgress, 1);
    const cx2 = px+G/2, cy2 = py+G/2;
    ctx.strokeStyle = `rgba(74,0,0,${hornAlpha})`;
    ctx.lineWidth = 1.5 + corruption * 1.5;
    ctx.lineCap = 'round';
    const pX=-dir.y, pY=dir.x, bX=-dir.x, bY=-dir.y;
    const hL = G * (0.15 + hornProgress * 0.35);
    for (const s of [-1, 1]) {
      const baseX = cx2+pX*s*G*0.28+bX*G*0.12;
      const baseY = cy2+pY*s*G*0.28+bY*G*0.12;
      const tipX = baseX+pX*s*hL*0.7+bX*hL;
      const tipY = baseY+pY*s*hL*0.7+bY*hL;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.quadraticCurveTo(baseX+pX*s*hL, baseY+pY*s*hL, tipX, tipY);
      ctx.stroke();
    }
  }

  function reset() {
    corruption = 0; glyphGrowth = 0; glyphAngle = 0;
    bloodPools = []; tileCorr = {}; candlesEaten = 0;
    cracks = [];
    for (const s of statues) { s.crying = false; s.tearY = 0; s.bloodSpawned = false; }
  }

  return {
    generate, getPewGrid, rebuildPewGrid,
    tryBurnPewsNear, getBurningPews,
    setCorruption, getCorruption, addTileCorr, spawnBlood,
    setCandlesEaten, addCrack,
    getSnakeStyle, drawDemonHead,
    update,
    drawTiles, drawBlood, drawCracks, drawAltar, drawPews, drawStatues,
    drawStainedGlass, drawGlyph, drawLightning, drawVignette,
    reset,
    get corruption() { return corruption; },
    get cols() { return cols; },
    get rows() { return rows; },
    get lightningAlpha() { return lightningAlpha; },
    get statues() { return statues; },
    get pews() { return pews; },
  };
})();
