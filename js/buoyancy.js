/* =========================================================
   buoyancy.js — 부력 계산 엔진
   ---------------------------------------------------------
   화면을 전혀 모른다. 숫자만 다룬다.

   ■ 이 엔진이 지키는 한 가지
     **부력을 '공식'이 아니라 학습지의 측정 방법 그대로 정의한다.**

         부력 = (공기 중에서 측정한 무게) − (물속에서 측정한 무게)

     학습지 7쪽 「나. 부력의 크기 = ❻에서 측정한 무게 − ❼에서 측정한 무게」 가 그것이다.
     그래서 이 엔진은 부력을 따로 담아 두지 않고 **두 무게에서 언제나 빼서** 쓴다.
     둘이 어긋난 값이 섞일 수가 없다.

   ■ 잠긴 부피가 부력을 정한다
     물속에서 재는 무게가 줄어드는 까닭은 **밀어낸 물의 무게**만큼 위로 떠받치기 때문이다.
         부력(N) = 잠긴 부피(cm³) × 물의 밀도(1 g/cm³) × 중력(9.8 N/kg) ÷ 1000
     학습지의 「물속에 잠긴 추의 개수가 늘어날수록 부력은 커진다」,
     「잠긴 물체의 부피가 클수록 부력의 크기가 커진다」가 이 한 줄에서 나온다.

   ⚠ 중학교 1학년 범위라 물의 밀도는 1 g/cm³ 로 고정한다.
   ========================================================= */
(function (global) {
  "use strict";

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function round(v, n) { var p = Math.pow(10, n || 0); return Math.round(v * p) / p; }

  var G = 9.8;                 // N/kg — 중력 (앞 소단원 gravity 앱과 같은 값)
  var RHO_WATER = 1;           // g/cm³ — 물의 밀도

  /* 무게(N) = 질량(g) ÷ 1000 × 중력 */
  function weightN(massG) { return massG / 1000 * G; }

  /* ---------------------------------------------------------
     1. 추 — 학습지의 '물속에 잠긴 추' 실험
        추 한 개의 질량과 부피. 물보다 훨씬 무거운 쇠추라 가라앉는다.
     --------------------------------------------------------- */
  var WEIGHT_MASS_G = 50;      // 추 한 개 50 g (앞 소단원의 추와 같은 값)
  var WEIGHT_VOL_CM3 = 20;     // 추 한 개 20 cm³ → 밀도 2.5 g/cm³ (가라앉는다)

  /* 추 n 개를 **모두** 물에 잠갔을 때 */
  function weightsInAir(n) { return weightN(WEIGHT_MASS_G * n); }
  function buoyancyOfWeights(n) { return submergedVolumeForce(WEIGHT_VOL_CM3 * n); }
  function weightsInWater(n) { return weightsInAir(n) - buoyancyOfWeights(n); }

  /* 잠긴 부피가 받는 부력(N) — 밀어낸 물의 무게 */
  function submergedVolumeForce(volCm3) {
    return volCm3 * RHO_WATER / 1000 * G;
  }

  /* ⚠ 학습지의 정의 그대로 — **두 무게의 차이**가 부력이다.
     위 buoyancyOfWeights 와 반드시 같은 값이 나와야 한다(검증에서 확인한다). */
  function buoyancyByMeasure(airN, waterN) { return airN - waterN; }

  /* ---------------------------------------------------------
     2. 물체 — 뜨는 것과 가라앉는 것
        밀도(질량 ÷ 부피)가 물보다 작으면 뜬다. 학습지의 스타이로폼과 배가 여기 속한다.
     --------------------------------------------------------- */
  var OBJECTS = [
    { key: "styro", name: "스타이로폼 구", emoji: "⚪", massG: 6,   volCm3: 200,
      note: "학습지의 탐구 — 물을 부으면 위로 뜨려 한다" },
    { key: "wood",  name: "나무 도막",     emoji: "🪵", massG: 120, volCm3: 200, note: "" },
    { key: "iron",  name: "쇠추",          emoji: "⚫", massG: 500, volCm3: 200, note: "가라앉는다" },
    { key: "ball",  name: "플라스틱 공",   emoji: "🔵", massG: 180, volCm3: 200, note: "" }
  ];

  function object(key) {
    for (var i = 0; i < OBJECTS.length; i++) if (OBJECTS[i].key === key) return OBJECTS[i];
    return OBJECTS[0];
  }

  function density(massG, volCm3) { return massG / volCm3; }

  /* 완전히 잠갔을 때 받는 부력 */
  function fullBuoyancy(volCm3) { return submergedVolumeForce(volCm3); }

  /* 물체를 잠긴 비율 f(0~1) 만큼 담갔을 때 */
  function state(objKey, f) {
    var o = object(objKey);
    f = clamp(f, 0, 1);
    var w = weightN(o.massG);
    var b = submergedVolumeForce(o.volCm3 * f);
    return {
      name: o.name, emoji: o.emoji, massG: o.massG, volCm3: o.volCm3,
      density: density(o.massG, o.volCm3),
      submerged: f,
      weightN: w,                       // 중력 (아래로)
      buoyN: b,                         // 부력 (위로)
      netN: b - w,                      // + 면 떠오르고, − 면 가라앉는다
      floats: density(o.massG, o.volCm3) < RHO_WATER
    };
  }

  /* 저절로 떠서 멈추는 자리 — 부력 = 중력 이 되는 잠긴 비율.
     밀도가 물보다 크면 아무리 담가도 못 이기므로 1(완전히 잠김)이다. */
  function floatFraction(objKey) {
    var o = object(objKey);
    var d = density(o.massG, o.volCm3);
    return d >= RHO_WATER ? 1 : d / RHO_WATER;
  }

  /* ---------------------------------------------------------
     3. 배 — 짐을 실을수록 더 잠기고, 그만큼 부력이 커진다
        학습지 「짐을 가득 실은 배는 … 물에 더 많이 잠기므로 부력이 더 크게 작용한다」
     --------------------------------------------------------- */
  var SHIP_HULL_G = 2000;      // 배 자체 질량 (g)
  var SHIP_VOL_CM3 = 12000;    // 배가 물에 잠길 수 있는 최대 부피 (cm³)

  function ship(cargoG) {
    var total = SHIP_HULL_G + cargoG;
    var w = weightN(total);
    /* 떠 있으려면 부력 = 중력. 그때 잠긴 부피는 '밀어낸 물의 질량 = 배 전체 질량'. */
    var needVol = total / RHO_WATER;                       // cm³
    var f = clamp(needVol / SHIP_VOL_CM3, 0, 1);
    var b = submergedVolumeForce(SHIP_VOL_CM3 * f);
    return {
      cargoG: cargoG, totalG: total,
      weightN: w, buoyN: b, submerged: f,
      sinking: needVol > SHIP_VOL_CM3,                     // 더 잠길 곳이 없으면 가라앉는다
      balanced: Math.abs(b - w) < 1e-9
    };
  }

  /* ---------------------------------------------------------
     4. 세 가지 움직임 — 학습지의 결론
        부력 > 중력 → 떠오른다 · 부력 = 중력 → 그 자리에 뜬 채로 · 부력 < 중력 → 가라앉는다
     --------------------------------------------------------- */
  function motion(buoyN, weightN2) {
    var d = buoyN - weightN2;
    if (Math.abs(d) < 1e-9) return { key: "still", text: "그 자리에 떠 있다", sign: 0 };
    return d > 0 ? { key: "up", text: "떠오른다", sign: 1 }
                 : { key: "down", text: "가라앉는다", sign: -1 };
  }

  global.Buoyancy = {
    G: G, RHO_WATER: RHO_WATER,
    WEIGHT_MASS_G: WEIGHT_MASS_G, WEIGHT_VOL_CM3: WEIGHT_VOL_CM3,
    SHIP_HULL_G: SHIP_HULL_G, SHIP_VOL_CM3: SHIP_VOL_CM3,
    OBJECTS: OBJECTS,
    clamp: clamp, round: round,
    weightN: weightN, object: object, density: density,
    submergedVolumeForce: submergedVolumeForce, fullBuoyancy: fullBuoyancy,
    weightsInAir: weightsInAir, weightsInWater: weightsInWater,
    buoyancyOfWeights: buoyancyOfWeights, buoyancyByMeasure: buoyancyByMeasure,
    state: state, floatFraction: floatFraction, ship: ship, motion: motion
  };
})(window);
