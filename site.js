(function(){
"use strict";
/* mobile menu */
var menu = document.getElementById("menu"), nav = document.getElementById("nav");
if (menu) menu.addEventListener("click", function(){ var o = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", o); });

/* image zoom */
var zoom = document.getElementById("zoom"), zimg = zoom && zoom.querySelector("img");
function show(src, alt){ zimg.src = src; zimg.alt = alt || ""; zoom.showModal(); }
if (zoom) {
  document.querySelectorAll("[data-zoom]").forEach(function(b){ b.addEventListener("click", function(){ show(b.dataset.zoom, b.dataset.alt); }); });
  document.getElementById("zoom-x").addEventListener("click", function(){ zoom.close(); });
  zoom.addEventListener("click", function(e){ if (e.target === zoom) zoom.close(); });
}

/* Inside a preview frame downloads and map embeds are blocked: show the file instead.
   On the hosted site the files download and live Google Maps load. */
var framed = false; try { framed = window.top !== window.self; } catch (e) { framed = true; }
if (framed) {
  document.querySelectorAll("a[download][data-view]").forEach(function(a){
    a.addEventListener("click", function(e){ e.preventDefault(); show(a.dataset.view, a.textContent.trim()); });
  });
} else {
  document.querySelectorAll("[data-map]").forEach(function(d){
    var f = document.createElement("iframe");
    f.loading = "lazy"; f.title = "Map of " + d.dataset.map; f.referrerPolicy = "no-referrer-when-downgrade";
    f.src = "https://www.google.com/maps?q=" + encodeURIComponent(d.dataset.map) + "&z=14&output=embed";
    d.appendChild(f);
  });
}

/* videos play only while on screen */
if ("IntersectionObserver" in window) {
  var vio = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function(){}); }
      else e.target.pause();
    });
  }, { threshold: 0.4 });
  document.querySelectorAll("video").forEach(function(v){ vio.observe(v); });
}

/* forms build a WhatsApp link */
function wa(form, send, build){
  if (!form) return;
  function link(){ send.href = "https://wa.me/919885136338?text=" + encodeURIComponent(build(function(n){ return form[n].value.trim(); })); }
  form.addEventListener("input", link); form.addEventListener("submit", function(e){ e.preventDefault(); }); link();
}
wa(document.getElementById("enq"), document.getElementById("f-send"), function(v){
  return "Hello Sneha Mitra Estates, I am interested in " + v("project") + "." +
    (v("name") ? "\nName: " + v("name") : "") + (v("phone") ? "\nPhone: " + v("phone") : "") + (v("msg") ? "\n" + v("msg") : "");
});
wa(document.getElementById("job"), document.getElementById("j-send"), function(v){
  return "Hello Sneha Mitra Estates, I would like to apply for a job." +
    "\nArea of work: " + v("area") + "\nPreferred office: " + v("office") +
    (v("name") ? "\nName: " + v("name") : "") + (v("phone") ? "\nPhone: " + v("phone") : "") +
    (v("exp") ? "\nExperience: " + v("exp") : "") + (v("msg") ? "\n" + v("msg") : "");
});
})();

/* floating buttons: back to top, and step aside while the 3D walkthrough is on screen */
(function(){
  var tt = document.getElementById("to-top"), tour = document.getElementById("tour");
  if (!tt) return;
  tt.addEventListener("click", function(){ scrollTo({ top: 0, behavior: "smooth" }); });
  function upd(){
    var inTour = tour && tour.getBoundingClientRect().bottom > innerHeight * 0.5;
    document.body.classList.toggle("in-tour", !!inTour);
    tt.classList.toggle("show", scrollY > 500);
  }
  addEventListener("scroll", upd, { passive: true }); upd();
})();

/* header brochure menu, and the Ongoing / Completed / Upcoming filter on the Projects page */
(function(){
  var bro = document.querySelector(".dd.bro > a");
  if (bro) {
    bro.addEventListener("click", function(e){ e.preventDefault(); bro.parentNode.classList.toggle("open"); });
    document.addEventListener("click", function(e){ if (!bro.parentNode.contains(e.target)) bro.parentNode.classList.remove("open"); });
  }
  var f = document.querySelector(".filters");
  if (!f) return;
  var cards = [].slice.call(document.querySelectorAll(".posters .poster")), empty = document.getElementById("no-projects");
  function apply(){
    var s = (location.hash || "").slice(1);
    if (["ongoing", "completed", "upcoming"].indexOf(s) < 0) s = "all";
    var n = 0;
    cards.forEach(function(c){ var ok = s === "all" || c.dataset.status === s; c.hidden = !ok; if (ok) n++; });
    empty.hidden = n > 0;
    f.querySelectorAll("a").forEach(function(a){ a.classList.toggle("on", a.getAttribute("href").split("#")[1] === s); });
  }
  addEventListener("hashchange", apply); apply();
})();