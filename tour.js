(function(){
"use strict";
var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
var tour = document.getElementById("tour");
var panels = [].slice.call(document.querySelectorAll(".panel"));
var dots = [].slice.call(document.querySelectorAll(".rail button"));
var STOPS = 6;
var progress = 0;           // 0..1 across the tour
var api = { p: 0 };

/* ---------- page chrome ---------- */
var top = document.getElementById("top");
function chrome(){
  var r = tour.getBoundingClientRect();
  top.classList.toggle("solid", r.bottom < 80 || document.documentElement.classList.contains("no3d"));
}
addEventListener("scroll", chrome, { passive: true }); chrome();

function setStop(f){
  var i = Math.round(f);
  panels.forEach(function(p, k){ p.classList.toggle("on", k === i && Math.abs(f - k) < 0.36); });
  dots.forEach(function(d, k){ d.classList.toggle("on", k === i); });
}
dots.forEach(function(d){
  d.addEventListener("click", function(){
    var i = +d.dataset.go;
    var y = tour.offsetTop + (i / (STOPS - 1)) * (tour.offsetHeight - innerHeight);
    scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  });
});

/* ---------- 3D scene ---------- */
var canvas = document.getElementById("scene");
var renderer;
try {
  if (!window.THREE) throw new Error("three");
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
} catch (err) {
  document.documentElement.classList.add("no3d"); chrome();
  return;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

var scene = new THREE.Scene();
var HORIZON = 0xf1e6cf;
scene.fog = new THREE.Fog(HORIZON, 70, 260);
(function sky(){
  var c = document.createElement("canvas"); c.width = 4; c.height = 256;
  var g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "#7fb6dc"); gr.addColorStop(.55, "#c7e0ee"); gr.addColorStop(.8, "#f1e6cf"); gr.addColorStop(1, "#f1e6cf");
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
})();

var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);

scene.add(new THREE.HemisphereLight(0xe6f1ff, 0xd8c9ad, 1.5));
scene.add(new THREE.AmbientLight(0xfff4e6, 0.75));
var sun = new THREE.DirectionalLight(0xfff1d8, 2.7);
sun.position.set(22, 34, 26); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
var sc = sun.shadow.camera; sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 110;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun);

function M(c, o){ o = o || {}; o.color = c; if (o.roughness === undefined) o.roughness = 0.85; return new THREE.MeshStandardMaterial(o); }
function box(g, w, h, d, m, x, y, z, o){
  o = o || {};
  var me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  me.position.set(x, y, z); if (o.ry) me.rotation.y = o.ry;
  me.castShadow = o.cast !== false; me.receiveShadow = true; g.add(me); return me;
}
function plane(g, w, h, m, x, y, z, rx, ry){
  var me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  me.position.set(x, y, z); if (rx) me.rotation.x = rx; if (ry) me.rotation.y = ry;
  me.receiveShadow = true; g.add(me); return me;
}
function cyl(g, r1, r2, h, m, x, y, z, seg){
  var me = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 20), m);
  me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; g.add(me); return me;
}
var seed = 7; function rnd(){ seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

var C = {
  wall: M(0xf4efe4), wall2: M(0xfaf7f0), stone: M(0xcbb99b), slab: M(0x8d8a84), wood: M(0x8a5a3a, { roughness: .7 }),
  woodL: M(0xc49a6c, { roughness: .75 }), dark: M(0x2b2a2c, { roughness: .5 }), white: M(0xffffff), maroon: M(0x7d1022),
  sign: M(0xe9c22b), leaf: M(0x3f7d46, { flatShading: true }), leaf2: M(0x5c9a4c, { flatShading: true }),
  grass: M(0x8fb568), pave: M(0xd9d2c4), asphalt: M(0x54575c), pink: M(0xf0c4b8), cream: M(0xf1e6c2),
  fabric: M(0xe8e0d2), grey: M(0xb7b3ab), steel: M(0xc9c9c9, { metalness: .6, roughness: .35 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fc6d8, roughness: .1, metalness: .2, transparent: true, opacity: .35 }),
  pane: new THREE.MeshBasicMaterial({ color: 0xdff1fa }),
  sea: M(0x4f9ec4, { roughness: .35 })
};

/* ----- site and neighbourhood ----- */
var site = new THREE.Group(); scene.add(site);
plane(site, 900, 900, C.grass, 0, -0.03, 0, -Math.PI / 2);
plane(site, 900, 320, C.sea, 0, -0.01, 300, -Math.PI / 2);
function road(x, z, w, d){
  plane(site, w, d, C.asphalt, x, 0.0, z, -Math.PI / 2);
  var horiz = w > d, len = horiz ? w : d;
  for (var s = -len / 2 + 2; s < len / 2 - 2; s += 5)
    plane(site, horiz ? 2.2 : .18, horiz ? .18 : 2.2, C.white, horiz ? x + s : x, 0.012, horiz ? z : z + s, -Math.PI / 2);
}
road(0, 12.75, 170, 6.5); road(0, -26.75, 170, 6.5); road(0, 52.25, 170, 6.5);
road(73.5, 12.75, 7, 86); road(-72.5, 12.75, 7, 86);

function tree(x, z, s){
  s = s || 1;
  cyl(site, .12 * s, .18 * s, 1.8 * s, C.wood, x, .9 * s, z, 7);
  var a = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25 * s, 0), rnd() > .5 ? C.leaf : C.leaf2);
  a.position.set(x, 2.5 * s, z); a.rotation.set(rnd() * 3, rnd() * 3, 0); a.castShadow = true; site.add(a);
  var b = new THREE.Mesh(new THREE.IcosahedronGeometry(.85 * s, 0), C.leaf2);
  b.position.set(x + .5 * s, 3.3 * s, z + .2 * s); b.castShadow = true; site.add(b);
}
var houseMats = [M(0xf7f3ea), M(0xe9dfcf), M(0xdcd6cc), M(0xf2e3d0)];
function massing(x, z, w, d){
  var m = houseMats[Math.floor(rnd() * houseMats.length)];
  var hw = w * .6, hd = d * .5;
  box(site, hw, 3.1, hd, m, x, 1.55, z - 1);
  if (rnd() > .35) box(site, hw * .62, 3, hd * .8, houseMats[Math.floor(rnd() * 4)], x - hw * .19, 4.6, z - 1 - hd * .1);
  box(site, hw + .5, .18, hd + .5, C.slab, x, 3.19, z - 1);
}
function plotRow(z0, z1, mat, front){
  var d = z1 - z0, zc = (z0 + z1) / 2;
  for (var x = -69; x < 68; x += 12.63) {
    var xc = x + 6.3;
    if (z0 === -7 && xc > -12 && xc < 13) continue;         // our villa stands here
    plane(site, 12.1, d - .5, mat, xc, 0.006, zc, -Math.PI / 2);
    if (rnd() < (mat === C.pink ? .7 : .22)) massing(xc, zc + (front > 0 ? -1.5 : 1.5), 12, d);
    else if (rnd() < .35) tree(xc + 3, zc, .8 + rnd() * .4);
  }
}
plane(site, 12.1, 16, C.pink, -15.2, 0.006, 1.25, -Math.PI / 2);
plane(site, 12.1, 16, C.pink, 16.3, 0.006, 1.25, -Math.PI / 2);
plotRow(-7, 9.5, C.pink, 1);
plotRow(-23.5, -7, C.pink, -1);
plotRow(-46.5, -30, C.cream, 1);
plotRow(16, 32.5, C.cream, -1);
plotRow(32.5, 49, C.cream, 1);
for (var tx = -66; tx <= 66; tx += 8.2) { tree(tx, 9.9 + 0, .85); if (Math.abs(tx) > 6) tree(tx + 3, 15.7, .85); tree(tx, -30.3, .8); }
/* park and club house across the far road */
plane(site, 60, 26, M(0x79aa58), 18, 0.004, 70, -Math.PI / 2);
box(site, 14, 3.4, 8, C.wall2, 30, 1.7, 68); box(site, 15, .25, 9, C.slab, 30, 3.5, 68);
plane(site, 12, 6, M(0x57b6d6, { roughness: .2 }), 12, 0.02, 68, -Math.PI / 2);
for (var k = 0; k < 9; k++) tree(-8 + k * 6.5, 80, 1.1);

/* ----- our plot ----- */
plane(site, 19, 16.5, C.pave, 0.5, 0.01, 1.25, -Math.PI / 2);
plane(site, 6.5, 4.6, C.grass, 6.2, 0.02, 6.9, -Math.PI / 2);
plane(site, 3.4, 4.6, C.grass, -6.6, 0.02, 6.9, -Math.PI / 2);
box(site, 19, 1.2, .22, C.wall2, 0.5, .6, -7);
box(site, .22, 1.2, 16.5, C.wall2, -9, .6, 1.25);
box(site, .22, 1.2, 16.5, C.wall2, 10, .6, 1.25);
box(site, 6.2, 1.2, .22, C.wall2, -5.9, .6, 9.5);
box(site, 9.6, 1.2, .22, C.wall2, 5.2, .6, 9.5);
box(site, .5, 2.1, .5, C.stone, -2.8, 1.05, 9.5); box(site, .5, 2.1, .5, C.stone, .4, 1.05, 9.5);
for (var gi = 0; gi < 11; gi++) box(site, .06, 1.5, .06, C.dark, -2.45 + gi * .26, .8, 9.5, { cast: false });
function shrub(g, x, y, z, s){ var a = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), C.leaf2); a.position.set(x, y, z); a.rotation.y = x; a.castShadow = true; g.add(a); }
for (var si = 0; si < 6; si++) { shrub(site, 3.4 + si * 1.1, .35, 8.7, .42); }
tree(-7, 7.2, .75);

/* ----- house: fixed parts ----- */
var fixed = new THREE.Group(); scene.add(fixed);
box(fixed, 11.6, .26, 7.8, C.slab, .5, 3.2, .5);                 // first floor slab, also the terrace
plane(fixed, 4.9, 6.9, C.woodL, 3.5, 3.345, .5, -Math.PI / 2);   // terrace deck
// pergola
[[1.5, -2.7], [5.6, -2.7], [1.5, 1.2], [5.6, 1.2]].forEach(function(p){ box(fixed, .14, 2.7, .14, C.dark, p[0], 4.7, p[1]); });
box(fixed, 4.4, .16, .14, C.dark, 3.55, 6.05, -2.7); box(fixed, 4.4, .16, .14, C.dark, 3.55, 6.05, 1.2);
for (var pi = 0; pi < 10; pi++) box(fixed, .08, .14, 4.3, C.wood, 1.7 + pi * .41, 6.2, -.75);
// rail
box(fixed, .05, 1, 7.2, C.glass, 5.95, 3.85, .5, { cast: false }); box(fixed, 4.9, 1, .05, C.glass, 3.5, 3.85, 4.05, { cast: false });
box(fixed, .07, .05, 7.3, C.steel, 5.95, 4.37, .5); box(fixed, 5, .05, .07, C.steel, 3.5, 4.37, 4.05);
box(fixed, 4.9, 1, .12, C.wall, 3.5, 3.85, -3.05);
// terrace furniture
function lounger(x, z){ box(fixed, .7, .18, 1.9, C.woodL, x, 3.62, z); box(fixed, .64, .1, 1.8, C.fabric, x, 3.76, z); box(fixed, .64, .1, .7, C.fabric, x, 3.98, z - .75).rotation.x = -.6; }
lounger(3.1, -1.1); lounger(4.3, -1.1);
cyl(fixed, .3, .3, .04, C.white, 3.7, 3.82, .55); cyl(fixed, .04, .04, .45, C.dark, 3.7, 3.58, .55, 8);
box(fixed, 3.6, .5, .5, C.wall2, 3.5, 3.6, 3.6); for (var ti = 0; ti < 5; ti++) shrub(fixed, 2.1 + ti * .7, 4.05, 3.6, .36);
box(fixed, .5, .5, .5, C.maroon, 5.5, 3.6, -2.5); shrub(fixed, 5.5, 4.25, -2.5, .5);

/* ----- house: interiors (walls face inward, so you can look in from outside) ----- */
var inside = new THREE.Group(); scene.add(inside);
function room(x0, x1, z0, z1, y0, h, floor, wall, skip){
  var w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; skip = skip || "";
  plane(inside, w, d, floor, cx, y0 + .005, cz, -Math.PI / 2);
  plane(inside, w, d, C.white, cx, y0 + h, cz, Math.PI / 2);
  if (skip.indexOf("n") < 0) plane(inside, w, h, wall, cx, y0 + h / 2, z0, 0, 0);
  if (skip.indexOf("s") < 0) plane(inside, w, h, wall, cx, y0 + h / 2, z1, 0, Math.PI);
  if (skip.indexOf("w") < 0) plane(inside, d, h, wall, x0, y0 + h / 2, cz, 0, Math.PI / 2);
  if (skip.indexOf("e") < 0) plane(inside, d, h, wall, x1, y0 + h / 2, cz, 0, -Math.PI / 2);
}
function win(x, y, z, w, h, ry){
  var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; inside.add(g);
  var p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), C.pane); p.position.z = .02; g.add(p);
  box(g, w + .12, .07, .08, C.dark, 0, h / 2, .03, { cast: false }); box(g, w + .12, .07, .08, C.dark, 0, -h / 2, .03, { cast: false });
  box(g, .07, h, .08, C.dark, -w / 2, 0, .03, { cast: false }); box(g, .07, h, .08, C.dark, w / 2, 0, .03, { cast: false });
  box(g, .05, h, .06, C.dark, 0, 0, .03, { cast: false });
}
var floorG = M(0xe6dccb, { roughness: .45 }), floorW = M(0xb98d62, { roughness: .6 });
var wallWarm = M(0xf3ece0), wallBed = M(0xefe6da);
room(-5, 1, -3, 4, 0, 3, floorG, wallWarm, "e");
room(1, 6, -3, 4, 0, 3, floorG, wallWarm, "w");
var F = 3.34;
room(-5, 1, -3, 4, F, 3, floorW, wallBed, "");

// living
win(-4.98, 1.6, .6, 3.2, 2, Math.PI / 2);
box(inside, 4.2, 2.4, .12, C.wood, -2, 1.3, -2.93);
box(inside, 2.1, 1.15, .06, C.dark, -2, 1.55, -2.84);
box(inside, 3.4, .4, .45, C.wall2, -2, .35, -2.7);
plane(inside, 4.2, 3, M(0x9c2a3a, { roughness: 1 }), -2, .02, -.3, -Math.PI / 2);
box(inside, 3, .42, .95, C.fabric, -2, .3, 1.2); box(inside, 3, .55, .25, C.fabric, -2, .75, 1.6);
box(inside, .95, .42, 1.6, C.fabric, -3.6, .3, .1); box(inside, .25, .55, 1.6, C.fabric, -3.95, .75, .1);
box(inside, .5, .32, .14, C.maroon, -2.9, .68, 1.35).rotation.x = -.3; box(inside, .5, .32, .14, C.sign, -1.1, .68, 1.35).rotation.x = -.3;
box(inside, 1.3, .08, .7, C.woodL, -1.8, .42, -.4); box(inside, 1.1, .34, .5, C.dark, -1.8, .2, -.4);
cyl(inside, .03, .03, 1.7, C.dark, -.2, .85, 1.5, 8); cyl(inside, .2, .28, .34, C.sign, -.2, 1.8, 1.5);
cyl(inside, .26, .2, .5, C.wall2, -4.4, .25, -2.3); shrub(inside, -4.4, .95, -2.3, .55); shrub(inside, -4.25, 1.5, -2.2, .38);
// kitchen and dining
win(5.98, 1.7, .9, 2.6, 1.7, -Math.PI / 2);
box(inside, 4.6, .9, .65, C.wall2, 3.6, .45, -2.65); box(inside, 4.7, .06, .7, C.dark, 3.6, .93, -2.65);
box(inside, 4.6, .75, .38, C.wood, 3.6, 2.3, -2.8);
plane(inside, 4.6, .6, C.sign, 3.6, 1.42, -2.98, 0, 0);
box(inside, .7, 2.1, .7, C.steel, 1.55, 1.05, -2.6);
box(inside, 2.4, .9, .95, C.maroon, 3.7, .45, -.7); box(inside, 2.6, .07, 1.1, C.white, 3.7, .94, -.7);
for (var st = 0; st < 3; st++) { cyl(inside, .19, .19, .06, C.woodL, 2.9 + st * .8, .68, .15); cyl(inside, .025, .025, .66, C.dark, 2.9 + st * .8, .33, .15, 8); }
for (var pe = 0; pe < 3; pe++) { cyl(inside, .008, .008, .9, C.dark, 3 + pe * .7, 2.55, -.7, 6); cyl(inside, .06, .16, .22, C.sign, 3 + pe * .7, 2, -.7); }
box(inside, 1.9, .07, 1, C.woodL, 3.6, .76, 2.4); [[2.8, 2], [4.4, 2], [2.8, 2.8], [4.4, 2.8]].forEach(function(p){ box(inside, .07, .74, .07, C.dark, p[0], .37, p[1]); });
[[3.1, 1.6], [4.1, 1.6], [3.1, 3.2], [4.1, 3.2]].forEach(function(p, i){ box(inside, .45, .06, .45, C.fabric, p[0], .46, p[1]); box(inside, .45, .5, .06, C.fabric, p[0], .72, p[1] + (i < 2 ? -.2 : .2)); box(inside, .4, .44, .4, C.dark, p[0], .22, p[1]); });
cyl(inside, .1, .07, .2, C.white, 3.6, .9, 2.4); shrub(inside, 3.6, 1.12, 2.4, .2);
// bedroom
win(-4.98, F + 1.6, .8, 3, 1.9, Math.PI / 2);
plane(inside, 6, 3, M(0x8c2233, { roughness: 1 }), -2, F + 1.5, -2.985, 0, 0);
box(inside, 2.6, 1.3, .12, C.woodL, -2, F + .85, -2.9);
box(inside, 2.3, .34, 2.4, C.wood, -2, F + .17, -1.65); box(inside, 2.2, .26, 2.3, C.white, -2, F + .47, -1.65);
box(inside, 2.24, .1, 1.3, C.sign, -2, F + .62, -1.1);
box(inside, .8, .16, .45, C.white, -2.55, F + .68, -2.5); box(inside, .8, .16, .45, C.white, -1.45, F + .68, -2.5);
[-3.6, -.4].forEach(function(x){ box(inside, .55, .5, .45, C.wood, x, F + .25, -2.6); cyl(inside, .03, .05, .3, C.dark, x, F + .65, -2.6, 8); cyl(inside, .13, .17, .24, C.wall2, x, F + .9, -2.6); });
plane(inside, 3.6, 2.6, M(0xe7dcc8, { roughness: 1 }), -2, F + .02, -.6, -Math.PI / 2);
box(inside, .6, 2.5, 2.6, C.wall2, .68, F + 1.25, 1.9); box(inside, .02, 2.5, .03, C.dark, .37, F + 1.25, 1.9, { cast: false });
box(inside, 1.5, .42, .5, C.fabric, -2, F + .21, .1);
cyl(inside, .22, .17, .45, C.wall2, -4.4, F + .22, 3.3); shrub(inside, -4.4, F + .9, 3.3, .5);

/* ----- house: outer shell (fades away as you walk in) ----- */
var shell = new THREE.Group(); scene.add(shell);
var sm = {
  wall: M(0xf4efe4, { transparent: true }), wall2: M(0xfbf8f1, { transparent: true }), stone: M(0xc9b594, { transparent: true }),
  slab: M(0x8d8a84, { transparent: true }), wood: M(0x8a5a3a, { transparent: true, roughness: .7 }),
  glass: M(0x35505e, { transparent: true, roughness: .15, metalness: .4 }), dark: M(0x2b2a2c, { transparent: true })
};
var shellMats = Object.keys(sm).map(function(k){ return sm[k]; });
box(shell, 11.3, 3.07, 7.3, sm.wall, .5, 1.535, .5);
box(shell, 6.3, 3.2, 7.3, sm.wall2, -2, 4.93, .5);
box(shell, 7.6, .26, 8.8, sm.slab, -2, 6.66, .8);
box(shell, 2.1, 6.6, .3, sm.stone, -4.1, 3.3, 4.2);
box(shell, 3.4, 1.9, .12, sm.glass, 3.6, 1.55, 4.16); box(shell, 3.6, .1, .3, sm.slab, 3.6, 2.6, 4.25);
box(shell, 1.15, 2.3, .12, sm.wood, -1.3, 1.15, 4.16); box(shell, 2.2, .12, 1.3, sm.slab, -1.3, 2.55, 4.7);
box(shell, 2.8, 2.1, .12, sm.glass, -.9, 4.95, 4.16);
for (var s2 = 0; s2 < 7; s2++) box(shell, .1, 2.9, .14, sm.wood, 1.25 + 0, 4.9, 3.6 - s2 * .32);
box(shell, .12, 1.7, 2.6, sm.glass, 6.16, 1.7, .9);
box(shell, .12, 2, 3.2, sm.glass, -5.16, 1.6, .6); box(shell, .12, 1.9, 3, sm.glass, -5.16, F + 1.6, .8);
box(shell, 1.6, .9, .5, sm.wall2, 1.2, .45, 4.6);
function setShell(o){
  shell.visible = o > 0.01;
  var tr = o < 0.995;
  shellMats.forEach(function(m){ m.opacity = o; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.depthWrite = o > .5; });
}

/* ----- camera path ----- */
var V = function(x, y, z){ return new THREE.Vector3(x, y, z); };
var stops = [
  { p: V(10.5, 4.6, 18), t: V(.3, 3, 0) },
  { p: V(-4.2, 1.7, 3.4), t: V(-1.4, 1.05, -1.6) },
  { p: V(.1, 1.8, 3.3), t: V(4, 1, -1.4) },
  { p: V(-4.2, F + 1.75, 3.4), t: V(-1.6, F + .8, -1.4) },
  { p: V(2.3, F + 1.8, -1.8), t: V(5.5, F + .7, 5) },
  { p: V(34, 52, 58), t: V(0, 0, 8) }
];
var mids = [V(-1.2, 1.8, 10.5), null, V(-2.2, 3.4, 7.2), null, V(4, 12, -4)];
var cp = V(0, 0, 0), ct = V(0, 0, 0), a = V(0, 0, 0), b = V(0, 0, 0);
function ease(u){ return u * u * u * (u * (u * 6 - 15) + 10); }
function place(f){
  var i = Math.min(STOPS - 2, Math.floor(f)), u = f - i;
  u = ease(Math.min(1, Math.max(0, (u - .16) / .68)));
  var A = stops[i], B = stops[i + 1], m = mids[i];
  if (m) { a.lerpVectors(A.p, m, u); b.lerpVectors(m, B.p, u); cp.lerpVectors(a, b, u); }
  else cp.lerpVectors(A.p, B.p, u);
  ct.lerpVectors(A.t, B.t, u);
  var o = 1;
  if (f < 1) o = 1 - Math.min(1, Math.max(0, (u - .45) / .4));
  else if (f < 4) o = 0;
  else o = Math.min(1, Math.max(0, (u - .25) / .4));
  setShell(o);
}

var mx = 0, my = 0, sx = 0, sy = 0;
addEventListener("pointermove", function(e){ mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });

function size(){
  var w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w / h < .8 ? 72 : (w / h < 1.25 ? 60 : 50);
  camera.updateProjectionMatrix();
}
addEventListener("resize", size); size();

var visible = true, right = V(0, 0, 0), up = V(0, 1, 0), dir = V(0, 0, 0);
function frame(){
  requestAnimationFrame(frame);
  if (!visible) return;
  var f = api.p * (STOPS - 1);
  place(f); setStop(f);
  sx += (mx - sx) * .05; sy += (my - sy) * .05;
  camera.position.copy(cp);
  dir.subVectors(ct, cp).normalize(); right.crossVectors(dir, up).normalize();
  var k = reduce ? 0 : (f > 4.5 ? 3 : .35);
  camera.position.addScaledVector(right, sx * k); camera.position.y -= sy * k * .5;
  camera.lookAt(ct);
  renderer.render(scene, camera);
}
if ("IntersectionObserver" in window) new IntersectionObserver(function(es){ visible = es[0].isIntersecting; }).observe(tour);

/* ----- scroll ----- */
function raw(){
  var r = tour.getBoundingClientRect(), span = tour.offsetHeight - innerHeight;
  return Math.min(1, Math.max(0, -r.top / span));
}
if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.to(api, { p: 1, ease: "none", scrollTrigger: { trigger: tour, start: "top top", end: "bottom bottom", scrub: reduce ? true : 0.9 } });
  if (!reduce) gsap.utils.toArray(".rv").forEach(function(el){
    gsap.from(el, { y: 36, opacity: .001, duration: .9, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
  });
} else {
  addEventListener("scroll", function(){ api.p = raw(); }, { passive: true }); api.p = raw();
}
window.__tour = api;
frame();
})();
