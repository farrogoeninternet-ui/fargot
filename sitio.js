// Fargot · web: aparecer al bajar y la demo animada de la app
(function () {
  // aparecer al bajar
  var els = document.querySelectorAll(".aparece");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("visto"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (e) { io.observe(e); });
  } else els.forEach(function (e) { e.classList.add("visto"); });

  // demo de la app: cambia de vista sola, como si alguien la usara
  document.querySelectorAll("[data-demo]").forEach(function (demo) {
    var vistas = demo.querySelectorAll(".app-vista");
    var lat = demo.querySelectorAll(".app-lat [data-v]");
    var puntos = demo.parentNode.querySelector(".app-puntos");
    var n = vistas.length, i = 0, t = null, pausa = false;
    var quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (puntos) for (var k = 0; k < n; k++) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("aria-label", "Ver " + (vistas[k].getAttribute("data-nombre") || "pantalla " + (k + 1)));
      (function (k) { b.onclick = function () { ir(k); reiniciar(); }; })(k);
      puntos.appendChild(b);
    }
    function ir(k) {
      i = k;
      vistas.forEach(function (v, j) { v.classList.toggle("on", j === k); });
      var nombre = vistas[k].getAttribute("data-v");
      lat.forEach(function (s) { s.classList.toggle("on", s.getAttribute("data-v") === nombre); });
      if (puntos) puntos.querySelectorAll("button").forEach(function (b, j) { b.classList.toggle("on", j === k); });
    }
    function siguiente() { if (!pausa) ir((i + 1) % n); }
    function reiniciar() { clearInterval(t); if (!quieto) t = setInterval(siguiente, Number(demo.getAttribute("data-demo")) || 6500); }
    demo.addEventListener("mouseenter", function () { pausa = true; });
    demo.addEventListener("mouseleave", function () { pausa = false; });
    ir(0); reiniciar();
  });

  // año del pie
  document.querySelectorAll("[data-ano]").forEach(function (e) { e.textContent = new Date().getFullYear(); });
})();
