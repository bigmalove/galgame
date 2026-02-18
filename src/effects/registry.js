import { topWindow } from '../core/env.js';

const SUPPORTED_EFFECTS = Object.freeze([
  'rain',
  'snow',
  'heavySnow',
  'cherryBlossoms',
  'fog',
  'fireflies',
  'embers',
  'screenFlash',
]);

export const PIXI_EFFECT_NAMES = SUPPORTED_EFFECTS;

const EFFECT_FIXED_LAYER = Object.freeze({
  rain: 'fg',
  snow: 'fg',
  heavySnow: 'fg',
  cherryBlossoms: 'fg',
  fog: 'bg',
  fireflies: 'fg',
  embers: 'fg',
  screenFlash: 'fg',
});

const textureCache = Object.create(null);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function choose(list) {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  return list[(Math.random() * list.length) | 0];
}

function toCount(baseCount, quality) {
  const density = quality?.density ?? 1;
  return Math.max(4, Math.round(baseCount * density));
}

function getEffectDocument() {
  return topWindow?.document || (typeof document !== 'undefined' ? document : null);
}

function createTextureFromCanvas(PIXI, key, width, height, drawFn) {
  const cached = textureCache[key];
  if (cached && !cached.destroyed) {
    return cached;
  }

  const doc = getEffectDocument();
  if (!doc?.createElement) {
    return PIXI.Texture.WHITE;
  }

  const canvas = doc.createElement('canvas');
  canvas.width = Math.max(2, Math.round(width));
  canvas.height = Math.max(2, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return PIXI.Texture.WHITE;
  }

  drawFn(ctx, canvas.width, canvas.height);

  let texture = null;
  try {
    texture = PIXI.Texture.from(canvas);
  } catch (error) {
    try {
      texture = PIXI.Texture.from(canvas.toDataURL('image/png'));
    } catch (_innerError) {
      texture = PIXI.Texture.WHITE;
    }
  }

  textureCache[key] = texture;
  return texture;
}

function createParticleLayer(PIXI, maxSize) {
  if (typeof PIXI.ParticleContainer === 'function') {
    return new PIXI.ParticleContainer(Math.max(4, maxSize), {
      scale: true,
      position: true,
      rotation: true,
      alpha: true,
      tint: true,
    });
  }
  return new PIXI.Container();
}

function getRainTexture(PIXI) {
  return createTextureFromCanvas(PIXI, 'effect-rain-v2', 24, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(0.12);

    const gradient = ctx.createLinearGradient(0, -h * 0.46, 0, h * 0.46);
    gradient.addColorStop(0, 'rgba(208, 235, 255, 0)');
    gradient.addColorStop(0.15, 'rgba(208, 235, 255, 0.12)');
    gradient.addColorStop(0.52, 'rgba(176, 224, 255, 0.72)');
    gradient.addColorStop(1, 'rgba(176, 224, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-1.2, -h * 0.43);
    ctx.lineTo(1.2, -h * 0.43);
    ctx.lineTo(1.7, h * 0.43);
    ctx.lineTo(-1.7, h * 0.43);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(-0.4, -h * 0.24, 0.8, h * 0.42);
  });
}

function getSnowTextures(PIXI) {
  return [
    createTextureFromCanvas(PIXI, 'effect-snow-soft-v2', 48, 48, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const gradient = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, h * 0.45);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.45, 'rgba(244,252,255,0.9)');
      gradient.addColorStop(1, 'rgba(244,252,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, h * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }),
    createTextureFromCanvas(PIXI, 'effect-snow-crystal-v2', 64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w / 2, h / 2);
      ctx.strokeStyle = 'rgba(238, 248, 255, 0.95)';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 6; i += 1) {
        ctx.save();
        ctx.rotate((Math.PI / 3) * i);
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(0, 24);
        ctx.stroke();
        ctx.restore();
      }
    }),
    createTextureFromCanvas(PIXI, 'effect-snow-ring-v2', 56, 56, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w / 2, h / 2);
      ctx.strokeStyle = 'rgba(239,248,255,0.88)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();
    }),
  ];
}

function getCherryPetalTexture(PIXI) {
  return createTextureFromCanvas(PIXI, 'effect-cherry-petal-v2', 64, 64, (ctx) => {
    ctx.translate(32, 32);
    ctx.rotate(-0.18);

    const gradient = ctx.createRadialGradient(-6, -10, 2, 0, 0, 28);
    gradient.addColorStop(0, 'rgba(255, 251, 252, 0.98)');
    gradient.addColorStop(0.45, 'rgba(255, 212, 228, 0.96)');
    gradient.addColorStop(1, 'rgba(242, 138, 178, 0.9)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.bezierCurveTo(14, -16, 20, -2, 12, 16);
    ctx.bezierCurveTo(6, 24, -1, 26, -9, 17);
    ctx.bezierCurveTo(-18, 6, -14, -14, 0, -22);
    ctx.closePath();
    ctx.fill();
  });
}

function getFogTexture(PIXI) {
  return createTextureFromCanvas(PIXI, 'effect-fog-cloud-v2', 256, 256, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w * 0.42, h * 0.42, 12, w * 0.5, h * 0.5, h * 0.48);
    gradient.addColorStop(0, 'rgba(241,248,255,0.92)');
    gradient.addColorStop(0.35, 'rgba(233,243,255,0.66)');
    gradient.addColorStop(1, 'rgba(215,229,245,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, h * 0.48, 0, Math.PI * 2);
    ctx.fill();
  });
}

function getFireflyTexture(PIXI) {
  return createTextureFromCanvas(PIXI, 'effect-firefly-v2', 64, 64, (ctx, w, h) => {
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.5, 1, w * 0.5, h * 0.5, h * 0.5);
    glow.addColorStop(0, 'rgba(255,255,219,1)');
    glow.addColorStop(0.45, 'rgba(255,236,133,0.58)');
    glow.addColorStop(1, 'rgba(255,236,133,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, h * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function getEmberTexture(PIXI) {
  return createTextureFromCanvas(PIXI, 'effect-ember-v2', 72, 72, (ctx, w, h) => {
    const core = ctx.createRadialGradient(w * 0.5, h * 0.52, 1, w * 0.5, h * 0.5, h * 0.45);
    core.addColorStop(0, 'rgba(255,255,225,1)');
    core.addColorStop(0.22, 'rgba(255,208,129,0.95)');
    core.addColorStop(0.58, 'rgba(255,126,42,0.62)');
    core.addColorStop(1, 'rgba(255,90,28,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, h * 0.45, 0, Math.PI * 2);
    ctx.fill();
  });
}

function getFlashBurstTexture(PIXI) {
  return createTextureFromCanvas(PIXI, 'effect-flash-burst-v2', 256, 256, (ctx, w, h) => {
    const burst = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, h * 0.5);
    burst.addColorStop(0, 'rgba(255,255,245,1)');
    burst.addColorStop(0.5, 'rgba(255,238,183,0.42)');
    burst.addColorStop(1, 'rgba(255,238,183,0)');
    ctx.fillStyle = burst;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, h * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createRainEffect({ PIXI, width, height, quality }) {
  const container = new PIXI.Container();
  const backCount = toCount(100, quality);
  const frontCount = toCount(68, quality);
  const backLayer = createParticleLayer(PIXI, backCount);
  const frontLayer = createParticleLayer(PIXI, frontCount);
  container.addChild(backLayer);
  container.addChild(frontLayer);

  const texture = getRainTexture(PIXI);
  const speedFactor = quality?.speed ?? 1;
  const drops = [];
  let elapsed = rand(0, 7);
  let gust = rand(-0.06, 0.1);
  let gustTarget = rand(-0.1, 0.16);
  let gustTimer = rand(1.1, 2.8);

  const profiles = [
    {
      layer: backLayer,
      count: backCount,
      scaleMin: 0.32,
      scaleMax: 0.56,
      stretchMin: 0.72,
      stretchMax: 1.08,
      speedMin: 6.2,
      speedMax: 10.8,
      alphaMin: 0.1,
      alphaMax: 0.3,
      windFactor: 0.38,
      sway: 0.025,
      rotationBase: 0.08,
      rotationFollow: 0.08,
      tintPalette: [0x9dc5e8, 0xb4d8f4, 0x9fbfe2],
    },
    {
      layer: frontLayer,
      count: frontCount,
      scaleMin: 0.46,
      scaleMax: 0.88,
      stretchMin: 0.95,
      stretchMax: 1.44,
      speedMin: 9.4,
      speedMax: 15.6,
      alphaMin: 0.2,
      alphaMax: 0.56,
      windFactor: 0.7,
      sway: 0.05,
      rotationBase: 0.12,
      rotationFollow: 0.12,
      tintPalette: [0xb9ddff, 0xc9e8ff, 0xaed2fb],
    },
  ];

  function respawn(drop, w, h, initial = false) {
    const marginX = Math.max(42, w * 0.09);
    drop.x = rand(-marginX, w + marginX);
    drop.y = initial ? rand(-h * 0.2, h + 20) : rand(-Math.max(90, h * 0.2), -12);
    drop.baseScale = rand(drop.profile.scaleMin, drop.profile.scaleMax);
    drop.stretch = rand(drop.profile.stretchMin, drop.profile.stretchMax);
    drop.speed = rand(drop.profile.speedMin, drop.profile.speedMax);
    drop.alphaBase = rand(drop.profile.alphaMin, drop.profile.alphaMax);
    drop.phase = rand(0, Math.PI * 2);
    drop.phaseSpeed = rand(0.02, 0.06);
    drop.alphaPhase = rand(0, Math.PI * 2);
    drop.sprite.tint = choose(drop.profile.tintPalette) || 0xbce2ff;
    drop.sprite.scale.set(drop.baseScale, drop.baseScale * drop.stretch);
  }

  for (const profile of profiles) {
    for (let i = 0; i < profile.count; i += 1) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.blendMode = PIXI.BLEND_MODES.NORMAL;
      profile.layer.addChild(sprite);
      const drop = { sprite, profile };
      respawn(drop, width, height, true);
      drops.push(drop);
    }
  }

  return {
    displayObject: container,
    persistent: true,
    update(delta, size) {
      const w = size.width || width;
      const h = size.height || height;
      const step = clamp(delta, 0.2, 2.8) * speedFactor;
      elapsed += step * 0.019;

      gustTimer -= step * 0.018;
      if (gustTimer <= 0) {
        gustTarget = rand(-0.14, 0.2);
        gustTimer = rand(1.2, 3.4);
      }
      gust += (gustTarget - gust) * Math.min(1, 0.022 * step);
      const wind = Math.sin(elapsed * 1.22) * 0.09 + Math.sin(elapsed * 0.52 + 1.4) * 0.03 + gust;

      const marginX = Math.max(56, w * 0.12);
      const marginY = Math.max(40, h * 0.1);

      for (const drop of drops) {
        drop.phase += drop.phaseSpeed * step;
        const sway = Math.sin(drop.phase) * drop.profile.sway;
        drop.x += (wind * drop.profile.windFactor + sway) * step;
        drop.y += drop.speed * step;

        drop.sprite.position.set(drop.x, drop.y);
        drop.sprite.rotation = drop.profile.rotationBase + wind * drop.profile.rotationFollow;
        drop.sprite.alpha = clamp(
          drop.alphaBase * (0.78 + Math.sin(elapsed * 1.7 + drop.alphaPhase) * 0.16),
          0.06,
          1,
        );

        if (drop.y > h + marginY || drop.x < -marginX || drop.x > w + marginX) {
          respawn(drop, w, h, false);
        }
      }
    },
    onResize(nextWidth, nextHeight) {
      width = Math.max(2, nextWidth);
      height = Math.max(2, nextHeight);
      const marginX = Math.max(56, width * 0.12);
      const marginY = Math.max(40, height * 0.1);
      for (const drop of drops) {
        drop.x = clamp(drop.x, -marginX, width + marginX);
        drop.y = clamp(drop.y, -height, height + marginY);
      }
    },
    destroy() {
      drops.length = 0;
      container.destroy({ children: true });
    },
  };
}

function createSnowEffect({ PIXI, width, height, quality, heavy = false }) {
  const container = new PIXI.Container();
  const textures = getSnowTextures(PIXI);
  const backCount = toCount(heavy ? 148 : 86, quality);
  const frontCount = toCount(heavy ? 118 : 56, quality);
  const backLayer = createParticleLayer(PIXI, backCount);
  const frontLayer = createParticleLayer(PIXI, frontCount);
  container.addChild(backLayer);
  container.addChild(frontLayer);

  const flakes = [];
  const speedFactor = quality?.speed ?? 1;
  let elapsed = rand(0, 6);
  let gust = rand(-0.2, 0.2);
  let gustTarget = rand(-0.35, 0.45);
  let gustTimer = rand(0.9, 2.7);

  const profiles = heavy
    ? [
      {
        layer: backLayer,
        count: backCount,
        scaleMin: 0.14,
        scaleMax: 0.27,
        speedMin: 0.75,
        speedMax: 1.55,
        alphaMin: 0.24,
        alphaMax: 0.54,
        windFactor: 0.85,
        driftMin: -0.12,
        driftMax: 0.2,
        flutterMin: 0.08,
        flutterMax: 0.34,
      },
      {
        layer: frontLayer,
        count: frontCount,
        scaleMin: 0.24,
        scaleMax: 0.48,
        speedMin: 1.35,
        speedMax: 2.85,
        alphaMin: 0.52,
        alphaMax: 0.95,
        windFactor: 1.25,
        driftMin: -0.18,
        driftMax: 0.32,
        flutterMin: 0.18,
        flutterMax: 0.56,
      },
    ]
    : [
      {
        layer: backLayer,
        count: backCount,
        scaleMin: 0.11,
        scaleMax: 0.2,
        speedMin: 0.35,
        speedMax: 0.85,
        alphaMin: 0.24,
        alphaMax: 0.5,
        windFactor: 0.64,
        driftMin: -0.08,
        driftMax: 0.12,
        flutterMin: 0.05,
        flutterMax: 0.22,
      },
      {
        layer: frontLayer,
        count: frontCount,
        scaleMin: 0.17,
        scaleMax: 0.35,
        speedMin: 0.68,
        speedMax: 1.55,
        alphaMin: 0.5,
        alphaMax: 0.88,
        windFactor: 0.98,
        driftMin: -0.11,
        driftMax: 0.18,
        flutterMin: 0.1,
        flutterMax: 0.35,
      },
    ];

  function respawn(flake, w, h, initial = false) {
    const marginX = Math.max(32, w * 0.08);
    flake.x = rand(-marginX, w + marginX);
    flake.y = initial ? rand(-h * 0.3, h + 16) : rand(-Math.max(64, h * 0.16), -8);
    flake.baseScale = rand(flake.profile.scaleMin, flake.profile.scaleMax);
    flake.speed = rand(flake.profile.speedMin, flake.profile.speedMax);
    flake.drift = rand(flake.profile.driftMin, flake.profile.driftMax);
    flake.flutter = rand(flake.profile.flutterMin, flake.profile.flutterMax);
    flake.phase = rand(0, Math.PI * 2);
    flake.phaseSpeed = rand(0.01, 0.04);
    flake.flipPhase = rand(0, Math.PI * 2);
    flake.flipSpeed = rand(0.45, 1.4);
    flake.rotation = rand(0, Math.PI * 2);
    flake.rotationSpeed = rand(-0.012, 0.012);
    flake.alphaBase = rand(flake.profile.alphaMin, flake.profile.alphaMax);
    flake.alphaPhase = rand(0, Math.PI * 2);
    flake.sprite.texture = choose(textures) || PIXI.Texture.WHITE;
    flake.sprite.tint = choose([0xf6fbff, 0xeaf6ff, 0xffffff]) || 0xffffff;
  }

  for (const profile of profiles) {
    for (let i = 0; i < profile.count; i += 1) {
      const sprite = new PIXI.Sprite(choose(textures) || PIXI.Texture.WHITE);
      sprite.anchor.set(0.5);
      profile.layer.addChild(sprite);
      const flake = { sprite, profile };
      respawn(flake, width, height, true);
      flakes.push(flake);
    }
  }

  const windMultiplier = heavy ? 1.34 : 1;

  return {
    displayObject: container,
    persistent: true,
    update(delta, size) {
      const w = size.width || width;
      const h = size.height || height;
      const step = clamp(delta, 0.2, 2.9) * speedFactor;
      elapsed += step * 0.016;

      gustTimer -= step * 0.016;
      if (gustTimer <= 0) {
        gustTarget = rand(-0.42, 0.55);
        gustTimer = rand(1, 3.4);
      }
      gust += (gustTarget - gust) * Math.min(1, 0.026 * step);
      const wind = (Math.sin(elapsed * 0.65) * 0.42 + Math.sin(elapsed * 1.2 + 0.8) * 0.16 + gust) * windMultiplier;
      const marginX = Math.max(48, w * 0.1);
      const marginY = Math.max(26, h * 0.08);

      for (const flake of flakes) {
        flake.phase += flake.phaseSpeed * step;
        flake.rotation += flake.rotationSpeed * step;
        const flutter = Math.sin(flake.phase) * flake.flutter;
        flake.x += (wind * flake.profile.windFactor + flake.drift + flutter) * step;
        flake.y += flake.speed * step;

        const flip = 0.75 + Math.sin(elapsed * flake.flipSpeed + flake.flipPhase) * 0.3;
        const scaleX = flake.baseScale * flip;
        const scaleY = flake.baseScale * (0.86 + Math.cos(elapsed * flake.flipSpeed + flake.flipPhase) * 0.18);
        flake.sprite.position.set(flake.x, flake.y);
        flake.sprite.rotation = flake.rotation;
        flake.sprite.scale.set(scaleX, scaleY);
        flake.sprite.alpha = clamp(
          flake.alphaBase * (0.82 + Math.sin(elapsed * 0.95 + flake.alphaPhase) * 0.18),
          0.08,
          1,
        );

        if (flake.y > h + marginY || flake.x < -marginX || flake.x > w + marginX) {
          respawn(flake, w, h, false);
        }
      }
    },
    onResize(nextWidth, nextHeight) {
      width = Math.max(2, nextWidth);
      height = Math.max(2, nextHeight);
      const marginX = Math.max(48, width * 0.1);
      const marginY = Math.max(26, height * 0.08);
      for (const flake of flakes) {
        flake.x = clamp(flake.x, -marginX, width + marginX);
        flake.y = clamp(flake.y, -height, height + marginY);
      }
    },
    destroy() {
      flakes.length = 0;
      container.destroy({ children: true });
    },
  };
}

function createCherryBlossomEffect({ PIXI, width, height, quality }) {
  const container = new PIXI.Container();
  const texture = getCherryPetalTexture(PIXI);
  const backCount = toCount(72, quality);
  const frontCount = toCount(44, quality);
  const backLayer = createParticleLayer(PIXI, backCount);
  const frontLayer = createParticleLayer(PIXI, frontCount);
  container.addChild(backLayer);
  container.addChild(frontLayer);

  const petals = [];
  const speedFactor = quality?.speed ?? 1;
  let elapsed = rand(0, 8);
  let gust = 0;
  let gustTarget = rand(-0.5, 0.5);
  let gustTimer = rand(0.8, 2.1);

  const tintPalette = [0xffb8d2, 0xffc7dc, 0xffd8e7, 0xffc2d5];

  function createPetal(layer, profile, startOnScreen = true) {
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.tint = tintPalette[(Math.random() * tintPalette.length) | 0];
    layer.addChild(sprite);

    const petal = {
      sprite,
      profile,
      x: rand(0, width),
      y: startOnScreen ? rand(-height * 0.4, height) : rand(-height * 0.3, -12),
      baseScale: rand(profile.scaleMin, profile.scaleMax),
      speedY: rand(profile.speedMin, profile.speedMax),
      swayAmp: rand(profile.swayMin, profile.swayMax),
      swayFreq: rand(0.7, 1.55),
      swayPhase: rand(0, Math.PI * 2),
      driftBias: rand(-0.25, 0.25),
      rotation: rand(0, Math.PI * 2),
      rotationSpeed: rand(-0.035, 0.035),
      flipPhase: rand(0, Math.PI * 2),
      flipSpeed: rand(0.65, 1.75),
      alphaBase: rand(profile.alphaMin, profile.alphaMax),
      alphaPhase: rand(0, Math.PI * 2),
      turbulencePhase: rand(0, Math.PI * 2),
    };
    sprite.rotation = petal.rotation;
    petals.push(petal);
    return petal;
  }

  const backProfile = {
    scaleMin: 0.09,
    scaleMax: 0.16,
    speedMin: 0.42,
    speedMax: 0.95,
    swayMin: 0.45,
    swayMax: 1.2,
    alphaMin: 0.24,
    alphaMax: 0.58,
    windFactor: 0.72,
  };
  const frontProfile = {
    scaleMin: 0.17,
    scaleMax: 0.31,
    speedMin: 0.82,
    speedMax: 1.95,
    swayMin: 0.95,
    swayMax: 2.35,
    alphaMin: 0.45,
    alphaMax: 0.92,
    windFactor: 1.18,
  };

  for (let i = 0; i < backCount; i += 1) {
    createPetal(backLayer, backProfile, true);
  }
  for (let i = 0; i < frontCount; i += 1) {
    createPetal(frontLayer, frontProfile, true);
  }

  function respawnPetal(petal, w, h) {
    const p = petal;
    p.x = rand(-Math.max(36, w * 0.1), w + Math.max(36, w * 0.1));
    p.y = rand(-Math.max(56, h * 0.14), -6);
    p.baseScale = rand(p.profile.scaleMin, p.profile.scaleMax);
    p.speedY = rand(p.profile.speedMin, p.profile.speedMax);
    p.swayAmp = rand(p.profile.swayMin, p.profile.swayMax);
    p.swayFreq = rand(0.7, 1.55);
    p.swayPhase = rand(0, Math.PI * 2);
    p.driftBias = rand(-0.25, 0.25);
    p.rotation = rand(0, Math.PI * 2);
    p.rotationSpeed = rand(-0.035, 0.035);
    p.flipPhase = rand(0, Math.PI * 2);
    p.flipSpeed = rand(0.65, 1.75);
    p.alphaBase = rand(p.profile.alphaMin, p.profile.alphaMax);
    p.alphaPhase = rand(0, Math.PI * 2);
    p.turbulencePhase = rand(0, Math.PI * 2);
    p.sprite.tint = tintPalette[(Math.random() * tintPalette.length) | 0];
  }

  return {
    displayObject: container,
    persistent: true,
    update(delta, size) {
      const w = size.width || width;
      const h = size.height || height;
      const step = clamp(delta, 0.2, 2.8) * speedFactor;
      elapsed += step * 0.0165;
      gustTimer -= step * 0.0165;
      if (gustTimer <= 0) {
        gustTarget = rand(-0.8, 1.15);
        gustTimer = rand(1.05, 3.2);
      }
      gust += (gustTarget - gust) * Math.min(1, 0.018 * step);
      const baseWind = Math.sin(elapsed * 0.58) * 0.66 + Math.sin(elapsed * 1.36 + 1.2) * 0.24;
      const wind = baseWind + gust;
      const marginX = Math.max(44, w * 0.12);
      const marginY = Math.max(28, h * 0.1);

      for (const p of petals) {
        const sway = Math.sin(elapsed * p.swayFreq + p.swayPhase) * p.swayAmp;
        const turbulence = Math.sin((elapsed + p.turbulencePhase) * 2.1) * 0.18;
        p.x += (wind * p.profile.windFactor + p.driftBias + sway + turbulence) * step;
        p.y += p.speedY * step;
        p.rotation += p.rotationSpeed * step;

        const flipWave = Math.sin(elapsed * p.flipSpeed + p.flipPhase);
        const scaleX = p.baseScale * (0.42 + flipWave * 0.72);
        const scaleY = p.baseScale * (0.82 - Math.abs(flipWave) * 0.24);
        p.sprite.position.set(p.x, p.y);
        p.sprite.rotation = p.rotation;
        p.sprite.scale.set(scaleX, scaleY);
        p.sprite.alpha = clamp(p.alphaBase * (0.82 + Math.sin(elapsed * 1.05 + p.alphaPhase) * 0.2), 0.08, 1);

        if (p.y > h + marginY || p.x < -marginX || p.x > w + marginX) {
          respawnPetal(p, w, h);
        }
      }
    },
    onResize(nextWidth, nextHeight) {
      width = Math.max(2, nextWidth);
      height = Math.max(2, nextHeight);
      for (const p of petals) {
        p.x = clamp(p.x, -Math.max(40, width * 0.08), width + Math.max(40, width * 0.08));
        p.y = clamp(p.y, -height, height + Math.max(24, height * 0.08));
      }
    },
    destroy() {
      petals.length = 0;
      container.destroy({ children: true });
    },
  };
}

function createFogEffect({ PIXI, width, height, quality }) {
  const container = new PIXI.Container();
  const texture = getFogTexture(PIXI);
  const clouds = [];
  const speedFactor = quality?.speed ?? 1;
  const cloudCount = toCount(15, quality);
  const tintPalette = [0xd5e1f0, 0xe0e9f6, 0xcbd9eb, 0xdde5f2];
  let elapsed = rand(0, 20);
  let windBias = rand(-0.08, 0.12);
  let windTarget = rand(-0.1, 0.15);
  let windTimer = rand(2, 5);

  const haze = new PIXI.Sprite(texture);
  haze.anchor.set(0.5);
  haze.alpha = 0.09;
  haze.tint = 0xe8f0ff;
  haze.blendMode = PIXI.BLEND_MODES.SCREEN;
  container.addChild(haze);

  function updateHazeSize(w, h) {
    const base = Math.max(w, h) / Math.max(1, texture.width);
    haze.scale.set(base * 2.25);
    haze.position.set(w * 0.5, h * 0.58);
  }

  function respawnCloud(cloud, w, h, initial = false) {
    const spawnMargin = Math.max(100, w * 0.2);
    cloud.x = initial
      ? rand(-spawnMargin, w + spawnMargin)
      : -spawnMargin - rand(20, 120);
    cloud.y = rand(h * 0.16, h * 0.95);
    cloud.baseScale = rand(0.58, 1.38) * cloud.depth;
    cloud.speed = rand(0.08, 0.28) * cloud.depth;
    cloud.alphaBase = rand(0.09, 0.25) / cloud.depth;
    cloud.phase = rand(0, Math.PI * 2);
    cloud.phaseSpeed = rand(0.003, 0.012);
    cloud.breathePhase = rand(0, Math.PI * 2);
    cloud.breatheSpeed = rand(0.12, 0.36);
    cloud.sprite.tint = choose(tintPalette) || 0xdfe8f5;
  }

  for (let i = 0; i < cloudCount; i += 1) {
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.blendMode = PIXI.BLEND_MODES.SCREEN;
    container.addChild(sprite);
    const cloud = {
      sprite,
      depth: 0.75 + (i % 3) * 0.27 + rand(-0.06, 0.08),
    };
    respawnCloud(cloud, width, height, true);
    clouds.push(cloud);
  }

  updateHazeSize(width, height);

  return {
    displayObject: container,
    persistent: true,
    update(delta, size) {
      const w = size.width || width;
      const h = size.height || height;
      const step = clamp(delta, 0.15, 2.5) * speedFactor;
      elapsed += step * 0.009;

      windTimer -= step * 0.01;
      if (windTimer <= 0) {
        windTarget = rand(-0.16, 0.2);
        windTimer = rand(2.2, 6.4);
      }
      windBias += (windTarget - windBias) * Math.min(1, 0.012 * step);
      const wind = Math.sin(elapsed * 0.42) * 0.14 + windBias;
      const marginX = Math.max(120, w * 0.24);

      haze.alpha = clamp(0.08 + Math.sin(elapsed * 0.4) * 0.015, 0.05, 0.12);
      const hazeBase = Math.max(w, h) / Math.max(1, texture.width);
      const hazeScale = hazeBase * (2.2 + Math.sin(elapsed * 0.33) * 0.08);
      haze.scale.set(hazeScale);
      haze.position.set(w * 0.5 + Math.sin(elapsed * 0.18) * 20, h * 0.58);

      for (const cloud of clouds) {
        cloud.phase += cloud.phaseSpeed * step;
        const drift = Math.sin(cloud.phase) * 0.05;
        cloud.x += (cloud.speed + wind * 0.4 * cloud.depth + drift) * step;
        cloud.y += Math.sin(elapsed * 0.31 + cloud.breathePhase) * 0.03 * step;

        const breathe = 0.92 + Math.sin(elapsed * cloud.breatheSpeed + cloud.breathePhase) * 0.12;
        const scale = cloud.baseScale * breathe;
        cloud.sprite.position.set(cloud.x, cloud.y);
        cloud.sprite.scale.set(scale);
        cloud.sprite.alpha = clamp(
          cloud.alphaBase * (0.88 + Math.sin(elapsed * 0.54 + cloud.phase) * 0.16),
          0.03,
          0.42,
        );

        if (cloud.x - (texture.width * scale) / 2 > w + marginX) {
          respawnCloud(cloud, w, h, false);
        }
      }
    },
    onResize(nextWidth, nextHeight) {
      width = Math.max(2, nextWidth);
      height = Math.max(2, nextHeight);
      updateHazeSize(width, height);
      const marginX = Math.max(120, width * 0.24);
      for (const cloud of clouds) {
        cloud.x = clamp(cloud.x, -marginX, width + marginX);
        cloud.y = clamp(cloud.y, height * 0.12, height * 0.98);
      }
    },
    destroy() {
      clouds.length = 0;
      container.destroy({ children: true });
    },
  };
}

function createFirefliesEffect({ PIXI, width, height, quality }) {
  const container = new PIXI.Container();
  const texture = getFireflyTexture(PIXI);
  const backCount = toCount(26, quality);
  const frontCount = toCount(17, quality);
  const backLayer = createParticleLayer(PIXI, backCount);
  const frontLayer = createParticleLayer(PIXI, frontCount);
  container.addChild(backLayer);
  container.addChild(frontLayer);

  const lights = [];
  const speedFactor = quality?.speed ?? 1;
  let elapsed = rand(0, 10);

  const profiles = [
    {
      layer: backLayer,
      count: backCount,
      scaleMin: 0.14,
      scaleMax: 0.24,
      alphaMin: 0.2,
      alphaMax: 0.52,
      velocity: 0.14,
      pulseMin: 0.8,
      pulseMax: 1.45,
    },
    {
      layer: frontLayer,
      count: frontCount,
      scaleMin: 0.25,
      scaleMax: 0.44,
      alphaMin: 0.46,
      alphaMax: 0.95,
      velocity: 0.28,
      pulseMin: 1.25,
      pulseMax: 2.05,
    },
  ];

  function respawn(light, w, h, initial = false) {
    light.x = rand(0, w);
    light.y = initial ? rand(h * 0.08, h * 0.95) : rand(h * 0.35, h * 0.95);
    light.vx = rand(-light.profile.velocity, light.profile.velocity);
    light.vy = rand(-light.profile.velocity * 0.7, light.profile.velocity * 0.4);
    light.baseScale = rand(light.profile.scaleMin, light.profile.scaleMax);
    light.alphaBase = rand(light.profile.alphaMin, light.profile.alphaMax);
    light.phase = rand(0, Math.PI * 2);
    light.phaseSpeed = rand(light.profile.pulseMin, light.profile.pulseMax);
    light.noisePhaseX = rand(0, Math.PI * 2);
    light.noisePhaseY = rand(0, Math.PI * 2);
    light.sprite.tint = choose([0xfff7ae, 0xffef8d, 0xfff2be, 0xffe774]) || 0xfff2a1;
  }

  for (const profile of profiles) {
    for (let i = 0; i < profile.count; i += 1) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.blendMode = PIXI.BLEND_MODES.ADD;
      profile.layer.addChild(sprite);
      const light = { sprite, profile };
      respawn(light, width, height, true);
      lights.push(light);
    }
  }

  return {
    displayObject: container,
    persistent: true,
    update(delta, size) {
      const w = size.width || width;
      const h = size.height || height;
      const step = clamp(delta, 0.2, 2.5) * speedFactor;
      elapsed += step * 0.018;
      const areaTop = h * 0.05;
      const areaBottom = h * 0.96;
      const marginX = Math.max(24, w * 0.04);

      for (const light of lights) {
        light.phase += light.phaseSpeed * 0.012 * step;
        light.vx += Math.sin(elapsed * 0.82 + light.noisePhaseX) * 0.006 * step;
        light.vy += Math.cos(elapsed * 0.65 + light.noisePhaseY) * 0.005 * step;
        light.vx = clamp(light.vx, -light.profile.velocity, light.profile.velocity);
        light.vy = clamp(light.vy, -light.profile.velocity * 0.75, light.profile.velocity * 0.5);

        light.x += light.vx * step;
        light.y += light.vy * step;

        if (light.x < -marginX) light.x = w + rand(0, marginX);
        if (light.x > w + marginX) light.x = -rand(0, marginX);
        if (light.y < areaTop) {
          light.y = areaTop + rand(2, 14);
          light.vy = Math.abs(light.vy) * 0.5;
        }
        if (light.y > areaBottom) {
          light.y = areaBottom - rand(2, 18);
          light.vy = -Math.abs(light.vy) * 0.5;
        }

        const pulse = 0.58 + Math.sin(light.phase) * 0.42;
        const sparkle = 0.86 + Math.sin(elapsed * 1.25 + light.phase * 1.2) * 0.24;
        light.sprite.position.set(light.x, light.y);
        light.sprite.scale.set(light.baseScale * sparkle);
        light.sprite.alpha = clamp(light.alphaBase * pulse, 0.06, 1);
      }
    },
    onResize(nextWidth, nextHeight) {
      width = Math.max(2, nextWidth);
      height = Math.max(2, nextHeight);
      for (const light of lights) {
        light.x = clamp(light.x, -16, width + 16);
        light.y = clamp(light.y, height * 0.04, height * 0.98);
      }
    },
    destroy() {
      lights.length = 0;
      container.destroy({ children: true });
    },
  };
}

function createEmbersEffect({ PIXI, width, height, quality }) {
  const container = new PIXI.Container();
  const texture = getEmberTexture(PIXI);
  const backCount = toCount(46, quality);
  const frontCount = toCount(36, quality);
  const backLayer = createParticleLayer(PIXI, backCount);
  const frontLayer = createParticleLayer(PIXI, frontCount);
  container.addChild(backLayer);
  container.addChild(frontLayer);

  const embers = [];
  const speedFactor = quality?.speed ?? 1;
  let elapsed = rand(0, 6);
  let wind = rand(-0.14, 0.18);
  let windTarget = rand(-0.2, 0.25);
  let windTimer = rand(0.8, 2.2);

  const profiles = [
    {
      layer: backLayer,
      count: backCount,
      scaleMin: 0.22,
      scaleMax: 0.36,
      speedMin: 0.55,
      speedMax: 1.35,
      alphaMin: 0.34,
      alphaMax: 0.72,
      windFactor: 0.66,
      decayMin: 0.0018,
      decayMax: 0.0046,
    },
    {
      layer: frontLayer,
      count: frontCount,
      scaleMin: 0.36,
      scaleMax: 0.62,
      speedMin: 1.1,
      speedMax: 2.65,
      alphaMin: 0.62,
      alphaMax: 1,
      windFactor: 1.15,
      decayMin: 0.0032,
      decayMax: 0.0078,
    },
  ];

  function respawn(ember, w, h, initial = false) {
    ember.x = rand(-24, w + 24);
    ember.y = initial ? rand(h * 0.46, h * 0.96) : rand(h * 0.58, h + 28);
    ember.baseScale = rand(ember.profile.scaleMin, ember.profile.scaleMax);
    ember.speedY = rand(ember.profile.speedMin, ember.profile.speedMax);
    ember.drift = rand(-0.2, 0.2);
    ember.phase = rand(0, Math.PI * 2);
    ember.phaseSpeed = rand(0.02, 0.07);
    ember.rotation = rand(0, Math.PI * 2);
    ember.rotationSpeed = rand(-0.04, 0.04);
    ember.life = 1;
    ember.decay = rand(ember.profile.decayMin, ember.profile.decayMax);
    ember.alphaBase = rand(ember.profile.alphaMin, ember.profile.alphaMax);
    ember.sprite.tint = choose([0xfff0c1, 0xffd486, 0xffb35a, 0xff8e3f]) || 0xffd486;
  }

  for (const profile of profiles) {
    for (let i = 0; i < profile.count; i += 1) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.blendMode = PIXI.BLEND_MODES.ADD;
      profile.layer.addChild(sprite);
      const ember = { sprite, profile };
      respawn(ember, width, height, true);
      embers.push(ember);
    }
  }

  return {
    displayObject: container,
    persistent: true,
    update(delta, size) {
      const w = size.width || width;
      const h = size.height || height;
      const step = clamp(delta, 0.2, 2.8) * speedFactor;
      elapsed += step * 0.017;
      windTimer -= step * 0.017;

      if (windTimer <= 0) {
        windTarget = rand(-0.28, 0.3);
        windTimer = rand(0.9, 2.8);
      }
      wind += (windTarget - wind) * Math.min(1, 0.028 * step);
      const turbulence = Math.sin(elapsed * 1.1) * 0.18 + wind;
      const marginX = Math.max(32, w * 0.08);
      const marginY = Math.max(28, h * 0.08);

      for (const ember of embers) {
        ember.phase += ember.phaseSpeed * step;
        ember.rotation += ember.rotationSpeed * step;
        ember.x += (turbulence * ember.profile.windFactor + ember.drift + Math.sin(ember.phase) * 0.12) * step;
        ember.y -= ember.speedY * step;
        ember.life -= ember.decay * step;

        const lifeGlow = clamp(ember.life, 0, 1);
        const scaleGrow = 0.8 + (1 - lifeGlow) * 0.55;
        ember.sprite.position.set(ember.x, ember.y);
        ember.sprite.rotation = ember.rotation;
        ember.sprite.scale.set(ember.baseScale * scaleGrow);
        ember.sprite.alpha = clamp(
          ember.alphaBase * lifeGlow * (0.9 + Math.sin(elapsed * 1.5 + ember.phase) * 0.26),
          0,
          1,
        );

        if (
          ember.y < -marginY ||
          ember.x < -marginX ||
          ember.x > w + marginX ||
          ember.life <= 0
        ) {
          respawn(ember, w, h, false);
        }
      }
    },
    onResize(nextWidth, nextHeight) {
      width = Math.max(2, nextWidth);
      height = Math.max(2, nextHeight);
      for (const ember of embers) {
        ember.x = clamp(ember.x, -28, width + 28);
        ember.y = clamp(ember.y, -28, height + 40);
      }
    },
    destroy() {
      embers.length = 0;
      container.destroy({ children: true });
    },
  };
}

function createScreenFlashEffect({ PIXI, width, height }) {
  const container = new PIXI.Container();
  const burstTexture = getFlashBurstTexture(PIXI);
  let progress = 0;
  let burstBaseScale = 1;

  const overlay = new PIXI.Sprite(PIXI.Texture.WHITE);
  overlay.tint = 0xfff3ce;
  overlay.alpha = 0;
  overlay.blendMode = PIXI.BLEND_MODES.SCREEN;

  const burst = new PIXI.Sprite(burstTexture);
  burst.anchor.set(0.5);
  burst.tint = 0xfff6e3;
  burst.alpha = 0;
  burst.blendMode = PIXI.BLEND_MODES.ADD;

  const ring = new PIXI.Sprite(burstTexture);
  ring.anchor.set(0.5);
  ring.tint = 0xffdca3;
  ring.alpha = 0;
  ring.blendMode = PIXI.BLEND_MODES.SCREEN;

  container.addChild(overlay);
  container.addChild(ring);
  container.addChild(burst);

  function applySize() {
    overlay.width = Math.max(2, width);
    overlay.height = Math.max(2, height);
    const cx = width * 0.5;
    const cy = height * 0.5;
    burst.position.set(cx, cy);
    ring.position.set(cx, cy);
    burstBaseScale = Math.max(width, height) / Math.max(1, burstTexture.width);
  }

  applySize();

  return {
    displayObject: container,
    persistent: false,
    done: false,
    update(delta) {
      const step = clamp(delta, 0.2, 3);
      progress += step * 0.043;

      const fadeIn = clamp(progress / 0.06, 0, 1);
      const overlayFade = Math.exp(-Math.max(0, progress - 0.04) * 5.8);
      overlay.alpha = clamp(0.86 * fadeIn * overlayFade, 0, 1);

      burst.alpha = clamp(1.02 * Math.exp(-progress * 9.2), 0, 1);
      ring.alpha = clamp(0.75 * Math.exp(-Math.max(0, progress - 0.015) * 4.5), 0, 1);

      burst.scale.set(burstBaseScale * (0.32 + progress * 2.7));
      ring.scale.set(burstBaseScale * (0.18 + progress * 1.5));

      if (overlay.alpha < 0.01 && burst.alpha < 0.01 && ring.alpha < 0.01) {
        this.done = true;
      }
    },
    onResize(nextWidth, nextHeight) {
      width = Math.max(2, nextWidth);
      height = Math.max(2, nextHeight);
      applySize();
    },
    destroy() {
      container.destroy({ children: true });
    },
  };
}

export function isSupportedPixiEffect(name) {
  return SUPPORTED_EFFECTS.includes(String(name || '').trim());
}

export function normalizeEffectLayer(layer) {
  return String(layer || '').trim().toLowerCase() === 'bg' ? 'bg' : 'fg';
}

export function getFixedEffectLayer(name) {
  const effectName = String(name || '').trim();
  return EFFECT_FIXED_LAYER[effectName] || 'fg';
}

export function createPixiEffectInstance(name, context) {
  const effectName = String(name || '').trim();
  switch (effectName) {
    case 'rain':
      return createRainEffect(context);
    case 'snow':
      return createSnowEffect(context);
    case 'heavySnow':
      return createSnowEffect({ ...context, heavy: true });
    case 'cherryBlossoms':
      return createCherryBlossomEffect(context);
    case 'fog':
      return createFogEffect(context);
    case 'fireflies':
      return createFirefliesEffect(context);
    case 'embers':
      return createEmbersEffect(context);
    case 'screenFlash':
      return createScreenFlashEffect(context);
    default:
      return null;
  }
}
