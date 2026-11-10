// El correo de soporte no esta escrito en el HTML: se arma aqui al cargar la pagina,
// para que los robots que recopilan direcciones no lo encuentren.
// Uso: <a data-correo data-asunto="opcional">texto</a>  ·  <span data-correo-texto></span>
(function () {
  var p = ["moc.liamg", "tenretnineogorraf"];
  var c = p[1].split("").reverse().join("") + String.fromCharCode(64) + p[0].split("").reverse().join("");
  function poner() {
    document.querySelectorAll("[data-correo]").forEach(function (a) {
      var asunto = a.getAttribute("data-asunto");
      a.href = "mailto:" + c + (asunto ? "?subject=" + encodeURIComponent(asunto) : "");
    });
    document.querySelectorAll("[data-correo-texto]").forEach(function (s) { s.textContent = c; });
  }
  window.correoSoporte = c;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", poner); else poner();
})();
