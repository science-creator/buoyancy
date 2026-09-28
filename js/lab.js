/* =========================================================
   lab.js — 물체를 떠오르게 하는 힘 실험실 (그리기 · 계기판 · 조작 · 미션)
   ---------------------------------------------------------
   계산은 buoyancy.js 가 하고, 이 파일은 그것을 '보이게' 만든다.

   화면의 핵심 장치 세 가지
     ① 학습지의 탐구 그대로 — 물을 부으면 **용수철이 늘어난다.**
        위로 당기는 힘(부력)이 생겼다는 증거다.
     ② 부력을 **재는 방법 그대로** 보여 준다 — 공기 중 무게와 물속 무게를
        나란히 놓고 그 **차이**를 부력이라 부른다.
     ③ 부력 막대와 중력 막대를 **같은 눈금**에 나란히 둔다.
        어느 쪽이 긴가로 떠오를지 가라앉을지가 정해진다.

   ⚠ **그려진 길이가 곧 값이다.**
     두 막대는 같은 눈금을 쓰고, 화살표 길이와 용수철이 늘어난 길이는
     엔진 값에 정비례한다. 잠긴 깊이도 계산된 잠긴 비율 그대로 그린다.

   ⚠ 애니메이션이 없으므로 requestAnimationFrame 을 돌리지 않는다.
   ========================================================= */
(function () {
  "use strict";

  var B = window.Buoyancy;

  var S = {
    scene: "spring",
    water: 0,          // % — 물을 부은 정도
    object: "styro",
    count: 1,          // 물속에 넣은 추 개수
    cargo: 0,          // 배에 실은 짐 (g)
    mission: null, predictPick: null, missionState: "ready"
  };

  var canvas, ctx, cssW = 900, cssH = 556;
  var records = [];
  var seen = { poured: false, sank: {}, counts: {}, cargoBig: false, floatSeen: false };

  var COL = { ink: "#e2e8f0", faint: "#64748b", line: "#94a3b8",
              water: "#38bdf8", weight: "#fbbf24" };

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return B.clamp(v, a, b); }
  function fmt(v, n) { var d = (n == null ? 2 : n); return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* ---------------------------------------------------------
     1. 미션
        ⚠ `setup` 이 정답 자리이면 안 된다 — 시작하자마자 깨지면 미션이 아니다.
     --------------------------------------------------------- */
  var MISSIONS = [
    {
      id: 1, star: "🧪", title: "물을 부으면 어떻게 될까",
      story: "용수철 아래에 <b>스타이로폼 구</b>를 매달아 두었다. 이제 통에 <b>물을 부으면</b> " +
             "용수철의 길이는 어떻게 변할까? 직접 부어 보자.",
      scene: "spring", setup: { water: 0, object: "styro" }, allow: ["water", "object"],
      predict: { q: "물을 부으면 용수철의 길이는?",
                 opts: ["늘어난다", "줄어든다", "변하지 않는다"], ans: 0 },
      goals: [{ key: "poured", text: "물을 <b>절반 이상</b> 부어 보기" }],
      why: "<b>늘어납니다.</b> 학습지의 탐구 결과 그대로예요.<br>" +
           "물을 부으면 스타이로폼 구에 <b>중력과 반대 방향인 위쪽</b>으로 힘이 작용하기 때문입니다. " +
           "이 힘이 <b>부력</b>이에요.<br>" +
           "<em>용수철이 아래에 매여 있으니, 구가 위로 뜨려 할수록 용수철이 늘어납니다.</em>"
    },
    {
      id: 2, star: "⚖️", title: "물속에서는 가벼워진다",
      story: "이번엔 <b>쇠추</b>를 용수철저울에 매달아 공기 중과 물속에서 무게를 재 보자. " +
             "물속에서 잰 무게는 어떨까?",
      scene: "measure", setup: { count: 1 }, allow: ["count"],
      predict: { q: "물속에서 잰 추의 무게는?",
                 opts: ["공기 중과 같다", "공기 중보다 가볍다", "공기 중보다 무겁다"], ans: 1 },
      /* ⚠ '장면을 보기만 하면' 되는 목표는 시작하자마자 깨진다(실제로 그랬다).
         학습지의 표를 채우는 것과 같은 **행동**을 목표로 삼는다. */
      goals: [{ key: "recorded", text: "<b>📋 지금 값 기록</b>을 눌러 두 무게를 기록하기" }],
      why: "<b>가벼워집니다.</b> 물이 추를 <b>위로 밀어 올리기</b> 때문이에요.<br>" +
           "줄어든 무게가 곧 <b>부력의 크기</b>입니다 —<br>" +
           "<b>부력 = 공기 중에서 잰 무게 − 물속에서 잰 무게</b>"
    },
    {
      id: 3, star: "📈", title: "추를 더 넣으면",
      story: "물속에 넣는 추의 <b>개수를 늘리면</b> 부력은 어떻게 될까? " +
             "추를 <b>4개 이상</b> 넣어 확인하자.",
      scene: "measure", setup: { count: 1 }, allow: ["count"],
      predict: { q: "잠긴 추가 많아지면 부력은?",
                 opts: ["커진다", "작아진다", "변하지 않는다"], ans: 0 },
      goals: [{ key: "count4", text: "추를 <b>4개 이상</b> 넣어 부력 확인하기" }],
      why: "<b>커집니다.</b> 추가 늘면 <b>물속에 잠긴 부피</b>가 커지기 때문이에요.<br>" +
           "학습지의 문장 그대로입니다 — <b>물속에 잠긴 물체의 부피가 클수록 부력의 크기가 커진다.</b><br>" +
           "<em>부력을 정하는 것은 무게가 아니라 <b>잠긴 부피</b>입니다.</em>"
    },
    {
      id: 4, star: "⚫", title: "가라앉는 것과 뜨는 것",
      story: "같은 크기(부피가 같은)의 물체를 물에 완전히 담가 보자. " +
             "<b>쇠</b>는 가라앉고 <b>스타이로폼</b>은 뜬다. 부피가 같은데 왜 다를까?",
      scene: "spring", setup: { water: 100, object: "styro" }, allow: ["water", "object"],
      predict: { q: "부피가 같은데 하나는 뜨고 하나는 가라앉는 까닭은?",
                 opts: ["부력이 서로 다르기 때문",
                        "부력은 같지만 중력(무게)이 다르기 때문",
                        "물의 깊이가 다르기 때문"], ans: 1 },
      goals: [{ key: "sankIron", text: "<b>⚫ 쇠</b>를 골라 가라앉는 것 확인하기" }],
      why: "<b>부력은 같지만 중력(무게)이 다르기 때문</b>입니다.<br>" +
           "부력은 <b>잠긴 부피</b>가 정하므로 부피가 같으면 부력도 같아요. " +
           "쇠는 무거워서 <b>중력 &gt; 부력</b> 이라 가라앉고, " +
           "스타이로폼은 가벼워서 <b>부력 &gt; 중력</b> 이라 떠오릅니다.<br>" +
           "<em>두 막대 중 어느 쪽이 긴지 보세요.</em>"
    },
    {
      id: 5, star: "🚢", title: "짐을 실으면",
      story: "배에 <b>짐을 실을수록</b> 배는 물에 더 깊이 잠긴다. 그때 <b>부력</b>은 어떻게 될까? " +
             "짐을 <b>6000 g 이상</b> 실어 보자.",
      scene: "ship", setup: { cargo: 0 }, allow: ["cargo"],
      predict: { q: "짐을 많이 실으면 배가 받는 부력은?",
                 opts: ["커진다", "작아진다", "변하지 않는다"], ans: 0 },
      goals: [{ key: "cargoBig", text: "짐을 <b>6000 g 이상</b> 실어 보기" }],
      why: "<b>커집니다.</b> 학습지의 문장 그대로예요 — " +
           "<b>짐을 가득 실은 배는 짐을 적게 실은 배보다 물에 더 많이 잠기므로 부력이 더 크게 작용한다.</b><br>" +
           "무거워진 만큼 더 깊이 잠기고, 잠긴 부피가 커진 만큼 부력도 커집니다."
    },
    {
      id: 6, star: "⚓", title: "떠 있는 배의 두 힘",
      story: "물 위에 <b>가만히 떠 있는</b> 배에 작용하는 <b>부력</b>과 <b>중력</b>의 크기를 견주어 보자. " +
             "어떤 관계일까?",
      scene: "ship", setup: { cargo: 0 }, allow: ["cargo"],
      predict: { q: "떠 있는 배의 부력과 중력은?",
                 opts: ["부력이 더 크다", "중력이 더 크다", "두 힘의 크기가 같다"], ans: 2 },
      goals: [{ key: "floatSeen", text: "짐을 바꿔 가며 <b>부력 = 중력</b> 확인하기" }],
      why: "<b>두 힘의 크기가 같습니다.</b><br>" +
           "떠 있다는 것은 위아래로 움직이지 않는다는 뜻이고, 그러려면 " +
           "<b>위로 미는 부력</b>과 <b>아래로 당기는 중력</b>이 <b>크기가 같고 방향이 반대</b>여야 합니다. " +
           "이것을 <b>힘의 평형</b>이라고 해요.<br>" +
           "<em>짐을 실으면 중력이 커지지만, 배가 더 잠겨 부력도 그만큼 커져 다시 같아집니다.</em>"
    }
  ];

  /* ---------------------------------------------------------
     2. 화면 만들기
     --------------------------------------------------------- */
  function layout() {
    if (!canvas) return;
    var r = canvas.getBoundingClientRect();
    cssW = Math.max(320, Math.round(r.width || 900));
    cssH = Math.max(200, Math.round(r.height || cssW / 1.62));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function sceneKind() {
    if (S.scene === "mission") return S.mission ? S.mission.scene : "spring";
    return S.scene;
  }

  function draw() {
    if (!ctx) return;
    var g = ctx;
    var grad = g.createLinearGradient(0, 0, 0, cssH);
    grad.addColorStop(0, "#0b1220"); grad.addColorStop(1, "#1e293b");
    g.fillStyle = grad; g.fillRect(0, 0, cssW, cssH);
    var k = sceneKind();
    if (k === "spring") drawSpring(g);
    else if (k === "measure") drawMeasure(g);
    else drawShip(g);
  }

  /* 물통 하나 그리기 — 물 높이는 비율 f(0~1) */
  function tank(g, x, y, w, h, f) {
    g.strokeStyle = "rgba(148,163,184,.65)"; g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x, y); g.lineTo(x, y + h); g.lineTo(x + w, y + h); g.lineTo(x + w, y);
    g.stroke();
    var wh = h * clamp(f, 0, 1);
    if (wh > 0.5) {
      g.fillStyle = "rgba(56,189,248,.32)";
      g.fillRect(x + 1.5, y + h - wh, w - 3, wh);
      g.strokeStyle = "rgba(125,211,252,.9)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 1.5, y + h - wh); g.lineTo(x + w - 1.5, y + h - wh); g.stroke();
    }
    return y + h - wh;              // 수면의 y
  }

  /* ---- 장면 ① 스타이로폼 구와 용수철 (학습지의 탐구) ----
     용수철은 통 **바닥**에 매여 있고 물체가 위에 달려 있다.
     물이 차오르면 부력이 물체를 위로 밀어 용수철이 늘어난다. */
  function drawSpring(g) {
    var f = S.water / 100;
    var tx = cssW * 0.30, tw = Math.min(cssW * 0.30, 240);
    var ty = cssH * 0.14, th = cssH * 0.66;
    var surfaceY = tank(g, tx, ty, tw, th, f);

    /* 물체가 잠긴 비율 — 물이 차오른 만큼만 잠긴다(물체는 통 가운데쯤에 있다) */
    var objH = Math.min(tw * 0.34, th * 0.22);
    var st0 = B.state(S.object, 1);
    /* 물체가 놓이는 자리 : 용수철이 늘어난 만큼 위로 올라간다 */
    var baseY = ty + th - objH - th * 0.16;        // 물이 없을 때의 자리
    /* 잠긴 정도는 '물이 얼마나 찼는가'로만 정한다(용수철이 붙잡고 있으므로 떠오르지 못한다) */
    var objTop = baseY, objBot = baseY + objH;
    var sub = clamp((objBot - surfaceY) / objH, 0, 1);
    var st = B.state(S.object, sub);

    /* 용수철 — 늘어난 길이는 **부력에 정비례**한다.
       바닥에 매인 용수철이므로 위로 뜨려는 힘(부력 − 중력)이 클수록 늘어난다.
       ⚠ 눈금은 **가장 큰 경우로 고정**한다. 그래야 물체를 바꿔도 길이를 견줄 수 있다. */
    var maxUp = 0;
    B.OBJECTS.forEach(function (o) {
      var s2 = B.state(o.key, 1);
      maxUp = Math.max(maxUp, Math.max(s2.buoyN - s2.weightN, 0));
    });
    var up = Math.max(st.buoyN - st.weightN, 0);
    var pxPerN = (th * 0.20) / Math.max(maxUp, 0.001);
    var stretch = up * pxPerN;

    var anchorY = ty + th - 6;
    g.strokeStyle = "#cbd5e1"; g.lineWidth = 2.5;
    g.beginPath();
    var sx = tx + tw * 0.5;
    var coilTop = objBot - stretch;
    var n = 90;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var yy = anchorY + (coilTop - anchorY) * t;
      var xx = sx + Math.sin(t * 7 * Math.PI * 2) * 11;
      if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
    }
    g.stroke();

    /* 물체 */
    var oy = objTop - stretch;
    g.fillStyle = S.object === "iron" ? "#334155" : (S.object === "wood" ? "#a16207" : (S.object === "ball" ? "#2563eb" : "#f1f5f9"));
    roundRect(g, sx - objH / 2, oy, objH, objH, 6); g.fill();
    g.strokeStyle = "rgba(226,232,240,.7)"; g.lineWidth = 1.5;
    roundRect(g, sx - objH / 2, oy, objH, objH, 6); g.stroke();

    /* 늘어난 길이 자 */
    if (stretch > 2) {
      g.strokeStyle = "#4ade80"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(tx + tw + 14, objBot - stretch); g.lineTo(tx + tw + 14, objBot); g.stroke();
      [objBot - stretch, objBot].forEach(function (yy) {
        g.beginPath(); g.moveTo(tx + tw + 8, yy); g.lineTo(tx + tw + 20, yy); g.stroke();
      });
      g.fillStyle = "#4ade80"; g.font = "bold 13px sans-serif"; g.textAlign = "left";
      g.fillText("용수철이 늘어남", tx + tw + 26, objBot - stretch / 2 + 5);
    }

    /* 부력 화살표 — 길이가 곧 부력이다 */
    if (st.buoyN > 0.001) {
      var alen = st.buoyN * pxPerN;
      alen = Math.min(alen, ty + th - 24);
      var ax = sx - objH * 0.9;
      g.strokeStyle = COL.water; g.lineWidth = 3; g.lineCap = "round";
      g.beginPath(); g.moveTo(ax, oy + objH / 2); g.lineTo(ax, oy + objH / 2 - alen); g.stroke();
      g.fillStyle = COL.water;
      g.beginPath();
      g.moveTo(ax, oy + objH / 2 - alen - 8);
      g.lineTo(ax - 5, oy + objH / 2 - alen); g.lineTo(ax + 5, oy + objH / 2 - alen);
      g.closePath(); g.fill();
      g.lineCap = "butt";
      g.fillStyle = COL.water; g.font = "bold 12px sans-serif"; g.textAlign = "right";
      g.fillText("부력", ax - 8, oy + objH / 2 - alen / 2);
    }

    g.fillStyle = COL.faint; g.font = "14px sans-serif"; g.textAlign = "left";
    g.fillText("🧪 물을 부을수록 부력이 커져 용수철이 늘어난다", 16, 26);
    g.fillStyle = "#7dd3fc"; g.font = "bold 14px sans-serif";
    g.fillText("물 " + S.water + " %  ·  잠긴 정도 " + Math.round(sub * 100) + " %", 16, 48);

    /* 오른쪽 : 값 상자 */
    /* ⚠ 좁은 무대에서 글자가 상자 밖으로 나가지 않도록 상자를 넓히고 글자를 줄인다. */
    var bx = cssW * 0.62, by = cssH * 0.18, bw = cssW * 0.36;
    g.fillStyle = "rgba(15,23,42,.75)";
    g.strokeStyle = "rgba(148,163,184,.45)"; g.lineWidth = 1.5;
    roundRect(g, bx, by, bw, 124, 10); g.fill(); g.stroke();
    g.textAlign = "center";
    var mid = bx + bw / 2;
    g.fillStyle = COL.ink; g.font = "bold 14px sans-serif";
    g.fillText(st.emoji + " " + st.name, mid, by + 24);
    g.fillStyle = COL.water; g.font = "bold 14px sans-serif";
    g.fillText("부력 " + fmt(st.buoyN) + " N", mid, by + 50);
    g.fillStyle = COL.weight;
    g.fillText("중력 " + fmt(st.weightN) + " N", mid, by + 74);
    var m = B.motion(st.buoyN, st.weightN);
    g.fillStyle = m.sign > 0 ? "#4ade80" : (m.sign < 0 ? "#f87171" : "#fde047");
    g.font = "bold 14px sans-serif";
    g.fillText(m.sign > 0 ? "→ 떠오른다" : (m.sign < 0 ? "→ 가라앉는다" : "→ 그 자리에"),
               mid, by + 102);
  }

  /* ---- 장면 ② 부력 재기 ----
     공기 중과 물속을 **나란히** 놓고 그 차이를 부력이라 부른다(학습지의 측정 방법). */
  function drawMeasure(g) {
    var n = S.count;
    var air = B.weightsInAir(n), water = B.weightsInWater(n);
    var buoy = B.buoyancyByMeasure(air, water);

    /* 두 저울의 눈금은 **같다** — 그래야 길이 차이가 곧 부력이다 */
    var maxAir = B.weightsInAir(6);
    var barH = cssH * 0.46;
    var pxPerN = barH / maxAir;

    [["공기 중", air, cssW * 0.26, "#fbbf24"], ["물속", water, cssW * 0.60, "#38bdf8"]].forEach(function (c, i) {
      var cx = c[0] === "공기 중" ? c[2] : c[2];
      var top = cssH * 0.16;
      /* 물속 쪽에는 물통을 먼저 그린다 */
      if (i === 1) tank(g, cx - 70, top + 30, 140, barH + 40, 0.72);

      /* 용수철저울 — 눈금 막대 */
      g.strokeStyle = COL.line; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx - 46, top); g.lineTo(cx + 46, top); g.stroke();
      var len = c[1] * pxPerN;
      g.strokeStyle = c[3]; g.lineWidth = 6; g.lineCap = "round";
      g.beginPath(); g.moveTo(cx, top + 4); g.lineTo(cx, top + 4 + len); g.stroke();
      g.lineCap = "butt";
      /* 추 뭉치 */
      for (var k = 0; k < n; k++) {
        g.fillStyle = "#475569";
        roundRect(g, cx - 16 + (k % 3) * 11, top + 8 + len + Math.floor(k / 3) * 13, 9, 11, 2); g.fill();
      }
      g.fillStyle = COL.ink; g.font = "bold 15px sans-serif"; g.textAlign = "center";
      g.fillText(c[0] + "에서 잰 무게", cx, cssH * 0.86);
      g.fillStyle = c[3]; g.font = "bold 19px sans-serif";
      g.fillText(fmt(c[1]) + " N", cx, cssH * 0.86 + 26);
    });

    /* 두 눈금의 차이 = 부력 */
    var top2 = cssH * 0.16;
    var yAir = top2 + 4 + air * pxPerN, yWater = top2 + 4 + water * pxPerN;
    var mx = cssW * 0.44;
    g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1.5;
    g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(cssW * 0.26, yAir); g.lineTo(cssW * 0.60, yAir); g.stroke();
    g.beginPath(); g.moveTo(cssW * 0.26, yWater); g.lineTo(cssW * 0.60, yWater); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = "#4ade80"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(mx, yWater); g.lineTo(mx, yAir); g.stroke();
    g.fillStyle = "#4ade80"; g.font = "bold 15px sans-serif"; g.textAlign = "center";
    g.fillText("부력 " + fmt(buoy) + " N", mx, (yAir + yWater) / 2 - 8);

    g.fillStyle = COL.faint; g.font = "14px sans-serif"; g.textAlign = "left";
    g.fillText("⚖️ 부력 = 공기 중에서 잰 무게 − 물속에서 잰 무게", 16, 26);
    g.fillStyle = "#7dd3fc"; g.font = "bold 14px sans-serif";
    g.fillText("잠긴 추 " + n + "개 · 잠긴 부피 " + (B.WEIGHT_VOL_CM3 * n) + " cm³", 16, 48);
  }

  /* ---- 장면 ③ 배와 부력 ----
     짐을 실으면 더 잠기고, 잠긴 만큼 부력이 커진다. 떠 있는 동안 두 힘은 언제나 같다. */
  function drawShip(g) {
    var sh = B.ship(S.cargo);
    var wx = cssW * 0.10, ww = cssW * 0.54;
    var wy = cssH * 0.30, wh = cssH * 0.50;

    /* 물 */
    g.fillStyle = "rgba(56,189,248,.28)";
    g.fillRect(wx, wy, ww, wh);
    g.strokeStyle = "rgba(125,211,252,.9)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + ww, wy); g.stroke();

    /* 배 — 잠긴 비율만큼 수면 아래로 내려간다 */
    var hullW = Math.min(ww * 0.52, 230), hullH = cssH * 0.20;
    var cx = wx + ww * 0.5;
    var deckY = wy - hullH * (1 - sh.submerged);
    g.fillStyle = "#b45309";
    g.beginPath();
    g.moveTo(cx - hullW / 2, deckY);
    g.lineTo(cx + hullW / 2, deckY);
    g.lineTo(cx + hullW * 0.36, deckY + hullH);
    g.lineTo(cx - hullW * 0.36, deckY + hullH);
    g.closePath(); g.fill();
    g.strokeStyle = "rgba(226,232,240,.6)"; g.lineWidth = 2; g.stroke();

    /* 짐 */
    var boxes = Math.round(S.cargo / 1000);
    for (var i = 0; i < boxes; i++) {
      g.fillStyle = "#a16207";
      var col = i % 5, row = Math.floor(i / 5);
      roundRect(g, cx - hullW * 0.38 + col * 22, deckY - 20 - row * 20, 18, 17, 3); g.fill();
    }

    /* 두 힘 화살표 — **같은 눈금**을 쓴다 */
    var maxF = B.weightN(B.SHIP_HULL_G + 11000);
    var pxPerN = (cssH * 0.22) / maxF;
    var ax = cx + hullW * 0.62;
    /* ⚠ 화살표 옆에 긴 이름표를 붙이면 좁은 무대에서 넘친다(검증에서 걸렸다).
       이름표는 **짧게 화살표 끝에** 두고, 숫자는 왼쪽 위 줄에 함께 적는다. */
    function arrow(x, y, len, up, col, label) {
      g.strokeStyle = col; g.lineWidth = 4; g.lineCap = "round";
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + (up ? -len : len)); g.stroke();
      g.fillStyle = col;
      var ty2 = y + (up ? -len - 9 : len + 9);
      g.beginPath();
      g.moveTo(x, ty2);
      g.lineTo(x - 6, y + (up ? -len : len));
      g.lineTo(x + 6, y + (up ? -len : len));
      g.closePath(); g.fill();
      g.lineCap = "butt";
      g.fillStyle = col; g.font = "bold 13px sans-serif"; g.textAlign = "center";
      g.fillText(label, x, ty2 + (up ? -6 : 15));
    }
    arrow(ax, deckY + hullH * 0.5, sh.buoyN * pxPerN, true, COL.water, "부력");
    arrow(ax + 34, deckY + hullH * 0.5, sh.weightN * pxPerN, false, COL.weight, "중력");

    g.fillStyle = COL.faint; g.font = "14px sans-serif"; g.textAlign = "left";
    g.fillText("🚢 짐을 실을수록 더 잠긴다", 16, 26);
    g.fillStyle = COL.water; g.font = "bold 13px sans-serif";
    g.fillText("부력 " + fmt(sh.buoyN) + " N", 16, 68);
    g.fillStyle = COL.weight;
    g.fillText("중력 " + fmt(sh.weightN) + " N", 16, 88);
    g.fillStyle = sh.sinking ? "#f87171" : "#4ade80";
    g.font = "bold 15px sans-serif";
    g.fillText(sh.sinking
      ? "⚠ 더 잠길 곳이 없다 — 배가 가라앉는다"
      : "부력 = 중력 → 힘의 평형을 이루어 떠 있다", 16, 48);

    g.fillStyle = COL.ink; g.font = "bold 15px sans-serif"; g.textAlign = "center";
    g.fillText("잠긴 정도 " + Math.round(sh.submerged * 100) + " %", cx, cssH - 18);
  }

  /* ---------------------------------------------------------
     3. 계기판
     --------------------------------------------------------- */
  function setBar(id, val, full) {
    $(id).querySelector(".bar-fill").style.width = clamp(val / full * 100, 0, 100) + "%";
  }
  function barText(id, t) { $(id).querySelector(".bar-val").textContent = t; }
  function ro(i, name, val, unit) {
    $("roName" + i).textContent = name; $("roVal" + i).textContent = val;
    $("roUnit" + i).textContent = unit || "";
  }

  /* 지금 장면에서 견줄 두 힘과 값들 */
  function current() {
    var k = sceneKind();
    if (k === "measure") {
      var n = S.count;
      var air = B.weightsInAir(n), water = B.weightsInWater(n);
      return { air: air, water: water, buoy: B.buoyancyByMeasure(air, water),
               weight: air, vol: B.WEIGHT_VOL_CM3 * n, full: B.weightsInAir(6) };
    }
    if (k === "ship") {
      var sh = B.ship(S.cargo);
      return { air: sh.weightN, water: sh.weightN - sh.buoyN, buoy: sh.buoyN,
               weight: sh.weightN, vol: B.SHIP_VOL_CM3 * sh.submerged,
               full: B.weightN(B.SHIP_HULL_G + 11000) };
    }
    var f = S.water / 100;
    var st = B.state(S.object, f);
    var mx = 0;
    B.OBJECTS.forEach(function (o) { mx = Math.max(mx, B.state(o.key, 1).weightN, B.state(o.key, 1).buoyN); });
    return { air: st.weightN, water: st.weightN - st.buoyN, buoy: st.buoyN,
             weight: st.weightN, vol: st.volCm3 * f, full: mx };
  }

  function updatePanel() {
    var k = sceneKind();
    var c = current();

    $("barName1").textContent = "부력 ↑";
    $("barName2").textContent = "중력 ↓";
    $("rowB").classList.remove("hidden");
    /* ⚠ 두 막대는 **같은 눈금**을 쓴다. 어느 쪽이 긴가가 곧 결론이다. */
    setBar("barA", c.buoy, c.full); barText("barA", fmt(c.buoy) + " N");
    setBar("barB", c.weight, c.full); barText("barB", fmt(c.weight) + " N");

    ro(1, "공기 중 무게", fmt(c.air), " N");
    ro(2, "물속 무게", fmt(c.water), " N");
    ro(3, "부력", fmt(c.buoy), " N");
    ro(4, "잠긴 부피", Math.round(c.vol), " cm³");

    var m = B.motion(c.buoy, c.weight);

    if (k === "measure") {
      $("gaugeTitle").textContent = "⚖️ 부력 재기";
      $("gaugeSub").innerHTML = "두 무게의 <b>차이</b>가 부력";
      $("fLaw").innerHTML = '부력 = <span class="k">공기 중 무게</span> − <span class="t">물속 무게</span> = ' +
                            fmt(c.air) + " − " + fmt(c.water) + ' = <span class="k">' + fmt(c.buoy) + ' N</span>';
      $("fWhy").innerHTML = '<em>잠긴 부피 ' + Math.round(c.vol) + ' cm³ — ' +
                            '<b>잠긴 부피가 클수록 부력이 크다</b></em>';
    } else if (k === "ship") {
      $("gaugeTitle").textContent = "🚢 배와 부력";
      $("gaugeSub").innerHTML = "떠 있는 동안 <b>두 힘이 같다</b>";
      $("fLaw").innerHTML = '부력 <span class="k">' + fmt(c.buoy) + ' N</span> ' +
                            (Math.abs(c.buoy - c.weight) < 1e-6 ? '=' : (c.buoy > c.weight ? '&gt;' : '&lt;')) +
                            ' 중력 <span class="t">' + fmt(c.weight) + ' N</span>';
      $("fWhy").innerHTML = '<em>짐을 실으면 중력이 커지지만 <b>더 잠겨서 부력도 그만큼</b> 커진다</em>';
    } else {
      $("gaugeTitle").textContent = "🧪 스타이로폼 구";
      $("gaugeSub").innerHTML = "물을 부으면 <b>부력</b>이 생긴다";
      $("fLaw").innerHTML = '부력 <span class="k">' + fmt(c.buoy) + ' N</span> vs 중력 <span class="t">' +
                            fmt(c.weight) + ' N</span> → <b>' + m.text + '</b>';
      $("fWhy").innerHTML = '<em>부력은 <b>잠긴 부피</b>가 정한다 — 물을 부을수록 잠긴 부피가 커진다</em>';
    }

    $("graphTitle").textContent = "📈 잠긴 부피와 부력";
    $("graphSub").innerHTML = "정비례 — 잠긴 부피가 클수록 부력이 크다";
    $("tip").textContent = tipText();
    syncMissionGoals();
  }

  function tipText() {
    var k = sceneKind();
    if (k === "measure") return "추 개수를 늘려 부력이 어떻게 변하는지 보세요";
    if (k === "ship") return "짐을 실어 보세요 — 두 화살표를 견주면 됩니다";
    return "물을 부어 보세요 — 용수철이 늘어납니다";
  }

  /* ---------------------------------------------------------
     4. 그래프 — 잠긴 부피 vs 부력 (원점을 지나는 직선)
     --------------------------------------------------------- */
  function drawGraph() {
    var c = $("graph");
    if (!c) return;
    var r = c.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(200, Math.round(r.width)), h = Math.max(100, Math.round(r.height));
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    var pad = 32;
    g.strokeStyle = "#cbd5e1"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(pad, h - pad); g.lineTo(w - 8, h - pad);
    g.moveTo(pad, 8); g.lineTo(pad, h - pad); g.stroke();

    var maxVol = B.WEIGHT_VOL_CM3 * 6;
    var maxB = B.submergedVolumeForce(maxVol);
    function X(v) { return pad + (w - pad - 10) * clamp(v / maxVol, 0, 1); }
    function Y(f) { return (h - pad) - (h - pad - 10) * clamp(f / maxB, 0, 1); }

    g.strokeStyle = "#0284c7"; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(maxVol), Y(maxB)); g.stroke();

    /* 추 1~6개의 점 */
    for (var n = 1; n <= 6; n++) {
      var v = B.WEIGHT_VOL_CM3 * n;
      g.fillStyle = (sceneKind() === "measure" && n === S.count) ? "#dc2626" : "#93c5fd";
      g.beginPath(); g.arc(X(v), Y(B.submergedVolumeForce(v)), (sceneKind() === "measure" && n === S.count) ? 6 : 4, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = "#64748b"; g.font = "12px sans-serif"; g.textAlign = "center";
    g.fillText("잠긴 부피 (cm³) →", w / 2, h - 8);
    g.save(); g.translate(12, h / 2); g.rotate(-Math.PI / 2);
    g.fillText("← 부력 (N)", 0, 0); g.restore();
  }

  /* ---------------------------------------------------------
     5. 조작 패널
     --------------------------------------------------------- */
  function syncControls() {
    var k = sceneKind();
    var allow = (S.scene === "mission" && S.mission) ? S.mission.allow : null;
    document.querySelectorAll("[data-for]").forEach(function (el) {
      var scenes = el.getAttribute("data-for").split(/\s+/);
      var need = el.getAttribute("data-need");
      var okScene = scenes.indexOf(S.scene) >= 0 || scenes.indexOf(k) >= 0;
      var okNeed = true;
      if (S.scene === "mission" && need) okNeed = allow && allow.indexOf(need) >= 0;
      el.classList.toggle("hidden", !(okScene && okNeed));
    });
    $("missionCard").classList.toggle("hidden", S.scene !== "mission");
    $("valWater").textContent = S.water + " %";
    $("valCount").textContent = S.count + " 개";
    $("valCargo").textContent = S.cargo.toLocaleString() + " g";
  }

  function setChips(id, val) {
    var w = $(id); if (!w) return;
    w.querySelectorAll(".chip").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-val") === String(val));
    });
  }

  /* ---------------------------------------------------------
     6. 미션
     --------------------------------------------------------- */
  function loadProgress() {
    try { return JSON.parse(sessionStorage.getItem("bu_missions") || "[]"); } catch (e) { return []; }
  }
  function saveProgress(l) { try { sessionStorage.setItem("bu_missions", JSON.stringify(l)); } catch (e) {} }

  function renderMissionList() {
    var done = loadProgress(), host = $("missionList");
    host.innerHTML = "";
    MISSIONS.forEach(function (M) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mcard" + (S.mission && S.mission.id === M.id ? " on" : "") +
                    (done.indexOf(M.id) >= 0 ? " done" : "");
      b.innerHTML = '<span class="mno">미션 ' + M.id + (done.indexOf(M.id) >= 0 ? " ✅" : "") + '</span>' +
                    '<span class="mtitle"><span class="mstar">' + M.star + '</span> ' + M.title + '</span>';
      b.addEventListener("click", function () { pickMission(M); });
      host.appendChild(b);
    });
    $("missionScore").textContent = done.length + " / " + MISSIONS.length;
  }

  function pickMission(M) {
    S.scene = "mission";
    $("scenes").querySelectorAll(".scene-btn").forEach(function (x) {
      x.classList.toggle("on", x.getAttribute("data-scene") === "mission");
    });
    S.mission = M; S.predictPick = null;
    S.missionState = M.predict ? "predict" : "ready";
    Object.keys(M.setup || {}).forEach(function (kk) { S[kk] = M.setup[kk]; });
    seen = { poured: false, sank: {}, counts: {}, cargoBig: false, floatSeen: false };
    $("rngWater").value = S.water; $("rngCount").value = S.count; $("rngCargo").value = S.cargo;
    setChips("chipObject", S.object);
    syncControls(); renderMissionList(); renderMissionBody(); refresh();
  }

  function renderMissionBody() {
    var M = S.mission, body = $("missionBody");
    if (!M) { body.classList.add("hidden"); return; }
    body.classList.remove("hidden");
    $("mTitle").textContent = M.star + " 미션 " + M.id + " · " + M.title;
    $("mStory").innerHTML = M.story;

    var pd = $("mPredict");
    if (M.predict && S.missionState === "predict") {
      pd.classList.remove("hidden");
      $("mQ").innerHTML = M.predict.q;
      var opts = $("mOpts"); opts.innerHTML = "";
      M.predict.opts.forEach(function (t, i) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "opt";
        /* 예측 보기에는 굵은 글씨를 쓰지 않는다 — 정답만 굵으면 답이 드러난다(2026-09-28). */
        b.innerHTML = String(t).replace(/<\/?b>/g, "");
        b.addEventListener("click", function () {
          S.predictPick = i; S.missionState = "ready"; renderMissionBody();
        });
        opts.appendChild(b);
      });
    } else pd.classList.add("hidden");

    var gl = $("mGoals");
    if (M.goals && S.missionState !== "predict") {
      gl.classList.remove("hidden");
      gl.innerHTML = '<div class="q">목표</div>' + M.goals.map(function (gg) {
        var ok = checkGoal(gg.key);
        return '<div class="goal' + (ok ? " ok" : "") + '">' + (ok ? "✅ " : "⬜ ") + gg.text + '</div>';
      }).join("");
    } else gl.classList.add("hidden");

    var vd = $("mVerdict");
    if (S.missionState === "won") {
      vd.className = "verdict ok";
      vd.innerHTML = "<b>🎉 성공!</b>" + M.why +
        (M.predict && S.predictPick != null
          ? "<br><br>" + (S.predictPick === M.predict.ans
              ? "예측도 <b>맞았습니다.</b> 잘했어요!"
              : "예측은 달랐지만 <b>직접 확인해서 알아냈습니다.</b> 그것이 더 중요해요.")
          : "");
      vd.classList.remove("hidden");
    } else if (S.missionState === "predict") vd.classList.add("hidden");
    else {
      vd.className = "verdict no";
      vd.innerHTML = "<b>직접 확인하세요</b>목표를 모두 채우면 이유가 열립니다.";
      vd.classList.remove("hidden");
    }
  }

  function checkGoal(key) {
    switch (key) {
      case "poured": return !!seen.poured;
      case "recorded": return records.length > 0;
      case "count4": return !!seen.counts.four;
      case "sankIron": return !!seen.sank.iron;
      case "cargoBig": return !!seen.cargoBig;
      case "floatSeen": return !!seen.floatSeen;
      default: return false;
    }
  }

  function noteSeen() {
    var k = sceneKind();
    if (k === "spring") {
      if (S.water >= 50) seen.poured = true;
      if (S.object === "iron" && S.water >= 50) seen.sank.iron = true;
    }
    if (k === "measure") {
      seen.counts.any = true;
      if (S.count >= 4) seen.counts.four = true;
    }
    if (k === "ship") {
      if (S.cargo >= 6000) seen.cargoBig = true;
      /* 짐을 **바꿔 가며** 두 힘이 같은 것을 본다 — 두 가지 이상의 짐에서 확인해야 인정 */
      var sh = B.ship(S.cargo);
      if (!sh.sinking && sh.balanced) {
        seen.cargoSet = seen.cargoSet || {};
        seen.cargoSet[S.cargo] = true;
        if (Object.keys(seen.cargoSet).length >= 2) seen.floatSeen = true;
      }
    }
  }

  function syncMissionGoals() {
    if (S.scene !== "mission" || !S.mission || S.missionState === "predict") return;
    var M = S.mission;
    if (!M.goals) return;
    var all = M.goals.every(function (gg) { return checkGoal(gg.key); });
    if (all && S.missionState !== "won") {
      S.missionState = "won";
      var done = loadProgress();
      if (done.indexOf(M.id) < 0) { done.push(M.id); saveProgress(done); }
      renderMissionList(); renderMissionBody();
    } else if (S.missionState !== "won") {
      var gl = $("mGoals");
      if (!gl.classList.contains("hidden")) {
        var rows = gl.querySelectorAll(".goal");
        M.goals.forEach(function (gg, i) {
          if (!rows[i]) return;
          var ok = checkGoal(gg.key);
          rows[i].className = "goal" + (ok ? " ok" : "");
          rows[i].innerHTML = (ok ? "✅ " : "⬜ ") + gg.text;
        });
      }
    }
  }

  /* ---------------------------------------------------------
     7. 실험 기록
     --------------------------------------------------------- */
  function addRecord() {
    var k = sceneKind(), c = current();
    var what = (k === "measure") ? ("추 " + S.count + "개")
             : (k === "ship") ? ("배 · 짐 " + S.cargo.toLocaleString() + " g")
             : (B.object(S.object).emoji + " " + B.object(S.object).name + " · 물 " + S.water + "%");
    records.push({ what: what, air: fmt(c.air) + " N", water: fmt(c.water) + " N", buoy: fmt(c.buoy) + " N" });
    renderRecords();
    window.PdfKit.toast("기록했습니다. (" + records.length + "번째)", "ok");
    refresh();      /* 미션 2 의 목표가 '기록하기' 라 기록 직후 판정을 다시 돌린다 */
  }

  function renderRecords() {
    var body = $("recBody");
    body.innerHTML = "";
    records.forEach(function (r, i) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + (i + 1) + "</td><td>" + r.what + "</td><td>" + r.air +
                     "</td><td>" + r.water + "</td><td><b>" + r.buoy + "</b></td>";
      body.appendChild(tr);
    });
    $("recEmpty").classList.toggle("hidden", records.length > 0);
  }

  function refresh() { noteSeen(); draw(); updatePanel(); drawGraph(); }

  /* ---------------------------------------------------------
     8. 연결
     --------------------------------------------------------- */
  function bindChips(id, fn) {
    var w = $(id); if (!w) return;
    w.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".chip") : null;
      if (!b) return;
      w.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      fn(b.getAttribute("data-val"));
    });
  }

  function bind() {
    $("scenes").addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".scene-btn") : null;
      if (!b) return;
      $("scenes").querySelectorAll(".scene-btn").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      S.scene = b.getAttribute("data-scene");
      if (S.scene === "mission" && !S.mission) pickMission(MISSIONS[0]);
      else { syncControls(); refresh(); }
      renderMissionList();
    });

    $("btnReset").addEventListener("click", function () {
      S.water = 0; S.object = "styro"; S.count = 1; S.cargo = 0;
      $("rngWater").value = 0; $("rngCount").value = 1; $("rngCargo").value = 0;
      setChips("chipObject", "styro");
      syncControls(); refresh();
    });
    $("btnRecord").addEventListener("click", addRecord);
    $("btnClearRec").addEventListener("click", function () {
      if (!records.length) return;
      if (!confirm("기록을 모두 지울까요?")) return;
      records.length = 0; renderRecords();
    });

    $("rngWater").addEventListener("input", function () { S.water = parseInt(this.value, 10); syncControls(); refresh(); });
    $("rngCount").addEventListener("input", function () { S.count = parseInt(this.value, 10); syncControls(); refresh(); });
    $("rngCargo").addEventListener("input", function () { S.cargo = parseInt(this.value, 10); syncControls(); refresh(); });
    bindChips("chipObject", function (v) { S.object = v; refresh(); });

    if (window.ResizeObserver) {
      new ResizeObserver(function () { layout(); draw(); drawGraph(); }).observe(canvas);
    } else {
      window.addEventListener("resize", function () { layout(); draw(); drawGraph(); });
    }
  }

  function boot() {
    canvas = $("stage");
    layout(); bind(); syncControls();
    renderMissionList(); renderRecords(); refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.BuLab = {
    S: S, MISSIONS: MISSIONS,
    _test: {
      set: function (k, v) { S[k] = v; syncControls(); refresh(); },
      scene: function (n) { S.scene = n; syncControls(); refresh(); },
      pick: function (id) { pickMission(MISSIONS[id - 1]); },
      answer: function (i) { S.predictPick = i; S.missionState = "ready"; renderMissionBody(); refresh(); },
      goals: function () {
        if (!S.mission || !S.mission.goals) return null;
        return S.mission.goals.map(function (gg) { return [gg.key, checkGoal(gg.key)]; });
      },
      state: function () { return S.missionState; },
      records: function () { return records; },
      current: current,
      draw: function () { draw(); return true; }
    }
  };
})();
