/*
 * 无畏契约准星代码解析与绘制
 * 准星代码是分号分隔的「键;值」文本，形如：
 *   0;s;1;P;c;5;h;0;0l;4;0o;2;0a;1;0f;0;1b;0;S;c;4;o;1
 * 这里只解析并绘制主准星（P 部分），预览为静止状态（忽略 m/f 动态误差）。
 */
(function (global) {
  'use strict';

  // 预设颜色枚举（依据真实选手颜色校正：TenZ 的 c;5 为青色）
  var PRESET_COLORS = {
    0: '#FFFFFF', // 白
    1: '#00FF00', // 绿
    2: '#FFFF00', // 黄
    3: '#9AFF00', // 黄绿
    4: '#00FF80', // 青绿
    5: '#00FFFF', // 青
    6: '#FF00FF', // 粉
    7: '#FF0000'  // 红
  };

  var DEFAULTS = {
    color: 0,
    customColor: null,
    outlineOn: false,
    outlineOpacity: 1,
    outlineThickness: 1,
    dotOn: false,
    dotThickness: 2,
    dotOpacity: 1,
    innerOn: true,
    innerOpacity: 1,
    innerLength: 6,
    innerThickness: 2,
    innerOffset: 3,
    outerOn: false,
    outerOpacity: 1,
    outerLength: 2,
    outerThickness: 2,
    outerOffset: 5
  };

  function num(v) {
    var n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }

  function parse(code) {
    var s = Object.assign({}, DEFAULTS);
    if (!code) return s;

    var tokens = code.split(';');
    var inPrimary = true;

    // 跳过开头的版本号（通常是 0）
    for (var i = 1; i < tokens.length; i++) {
      var t = tokens[i];
      if (t === 'P') { inPrimary = true; continue; }
      if (t === 'A' || t === 'S') { inPrimary = false; continue; }

      var key = t;
      var val = tokens[i + 1];
      if (val === undefined) continue;
      i++; // 消耗 value

      if (!inPrimary) continue; // 主预览只看 P 部分

      switch (key) {
        case 'c': s.color = num(val) !== undefined ? num(val) : s.color; break;
        case 'u': s.customColor = val; s.color = 8; break;
        case 'h': s.outlineOn = val === '1'; break;
        case 'o': s.outlineOpacity = num(val) !== undefined ? num(val) : s.outlineOpacity; break;
        case 'ot': s.outlineThickness = num(val) !== undefined ? num(val) : s.outlineThickness; break;
        case 'd': s.dotOn = val === '1'; break;
        case 'z': s.dotThickness = num(val) !== undefined ? num(val) : s.dotThickness; break;
        case '0b': s.innerOn = val === '1'; break;
        case '0a': s.innerOpacity = num(val) !== undefined ? num(val) : s.innerOpacity; break;
        case '0l': s.innerLength = num(val) !== undefined ? num(val) : s.innerLength; break;
        case '0t': s.innerThickness = num(val) !== undefined ? num(val) : s.innerThickness; break;
        case '0o': s.innerOffset = num(val) !== undefined ? num(val) : s.innerOffset; break;
        case '1b': s.outerOn = val === '1'; break;
        case '1a': s.outerOpacity = num(val) !== undefined ? num(val) : s.outerOpacity; break;
        case '1l': s.outerLength = num(val) !== undefined ? num(val) : s.outerLength; break;
        case '1t': s.outerThickness = num(val) !== undefined ? num(val) : s.outerThickness; break;
        case '1o': s.outerOffset = num(val) !== undefined ? num(val) : s.outerOffset; break;
        default: break; // 忽略 m/f 动态误差等键
      }
    }
    return s;
  }

  function hexToRgb(hex) {
    var r = parseInt(hex.slice(0, 2), 16);
    var g = parseInt(hex.slice(2, 4), 16);
    var b = parseInt(hex.slice(4, 6), 16);
    var a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r: r, g: g, b: b, a: a };
  }

  function resolveColor(s) {
    if (s.color === 8 && s.customColor) {
      return hexToRgb(s.customColor); // RRGGBBAA
    }
    var hex = PRESET_COLORS[s.color] || '#FFFFFF';
    return hexToRgb(hex.slice(1));
  }

  function rgba(c, opacity) {
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (c.a * opacity) + ')';
  }

  function stroke(ctx, x1, y1, x2, y2, width, style) {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function render(canvas, code) {
    var s = parse(code);
    var dpr = global.devicePixelRatio || 1;
    var cssW = canvas.clientWidth || 200;
    var cssH = canvas.clientHeight || 140;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var cx = cssW / 2;
    var cy = cssH / 2;
    var col = resolveColor(s);

    // 游戏数值 → 预览像素
    var lenScale = 2.2;
    var thickScale = 1.3;
    var offScale = 1.5;

    var outlineColor = { r: 0, g: 0, b: 0, a: 1 };

    function drawCross(length, thickness, offset, opacity) {
      var L = length * lenScale;
      var T = Math.max(1, thickness * thickScale);
      var O = offset * offScale;
      var segs = [
        [cx - O - L, cy, cx - O, cy],
        [cx + O, cy, cx + O + L, cy],
        [cx, cy - O - L, cx, cy - O],
        [cx, cy + O, cx, cy + O + L]
      ];

      if (s.outlineOn && s.outlineOpacity > 0) {
        var OT = T + s.outlineThickness * 2 * thickScale;
        var os = rgba(outlineColor, s.outlineOpacity);
        segs.forEach(function (p) { stroke(ctx, p[0], p[1], p[2], p[3], OT, os); });
      }

      var st = rgba(col, opacity);
      segs.forEach(function (p) { stroke(ctx, p[0], p[1], p[2], p[3], T, st); });
    }

    // 外线（先画，内线叠在上层）
    if (s.outerOn) {
      drawCross(s.outerLength, s.outerThickness, s.outerOffset, s.outerOpacity);
    }

    // 内线
    if (s.innerOn) {
      drawCross(s.innerLength, s.innerThickness, s.innerOffset, s.innerOpacity);
    }

    // 中心点
    if (s.dotOn) {
      var r = Math.max(1, s.dotThickness * 1.4);
      if (s.outlineOn && s.outlineOpacity > 0) {
        ctx.fillStyle = rgba(outlineColor, s.outlineOpacity);
        ctx.beginPath();
        ctx.arc(cx, cy, r + s.outlineThickness * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = rgba(col, s.dotOpacity);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  var Crosshair = { parse: parse, render: render };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Crosshair;
  }
  if (global) {
    global.Crosshair = Crosshair;
  }
})(typeof window !== 'undefined' ? window : globalThis);
