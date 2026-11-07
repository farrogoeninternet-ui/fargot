/* Fargot Transfer - logica del panel. (c) 2026 Fargot. Todos los derechos reservados.
 *
 * El mismo panel se carga en Illustrator y en After Effects. Detecta el
 * programa y muestra la vista correspondiente. Habla con el motor JSX
 * (host/ai.jsx o host/ae.jsx) mediante window.__adobe_cep__.evalScript,
 * que es lo que usa por dentro la libreria CSInterface de Adobe.
 */
(function () {
  "use strict";

  var cep = window.__adobe_cep__ || null;
  var $ = function (id) { return document.getElementById(id); };

  // ------------------------------------------------------------ host
  var env = { appName: "AEFT" };
  if (cep) {
    try { env = JSON.parse(cep.getHostEnvironment()); } catch (e) {}
  } else {
    // Vista previa en un navegador normal: index.html?host=ILST
    var m = /host=(\w+)/.exec(location.search);
    if (m) env.appName = m[1];
  }
  var IS_AI = env.appName === "ILST";

  function evalHost(script) {
    return new Promise(function (resolve) {
      if (!cep) { resolve(mockHost(script)); return; }
      cep.evalScript(script, resolve);
    });
  }

  function call(fn, arg) {
    var script = arg === undefined
      ? "FargotTransfer." + fn + "()"
      : "FargotTransfer." + fn + "(\"" + encodeURIComponent(JSON.stringify(arg)) + "\")";
    return evalHost(script).then(function (r) {
      try { return JSON.parse(r); }
      catch (e) { return { ok: false, message: r || "El programa no respondio." }; }
    });
  }

  // Respuestas simuladas para ver el diseno fuera de Adobe (y para la demo de la web).
  // Los dos paneles de la demo comparten localStorage: lo que "envia" el de
  // Illustrator lo ve llegar el de After Effects.
  function mockSent() { try { return Number(localStorage.getItem("demo.sent")) || 0; } catch (e) { return 0; } }
  function mockHost(script) {
    if (script.indexOf("license(") >= 0) {
      var locked = /lock=1/.test(location.search);
      return JSON.stringify(locked ? { ok: false, reason: "nologin", message: "Inicia sesion en la app Fargot para usar Fargot Transfer." } : { ok: true, email: "demo@fargot.app" });
    }
    if (script.indexOf("openHub") >= 0) return JSON.stringify({ ok: true });
    if (script.indexOf("selInfo") >= 0) {
      return JSON.stringify({ ok: true, doc: "Cartel.ai", count: 6, kinds: { PathItem: 3, GroupItem: 1, TextFrame: 1, CompoundPathItem: 1 } });
    }
    if (script.indexOf("enviar(") >= 0) {
      try { localStorage.setItem("demo.sent", String(Date.now())); } catch (e) {}
      return JSON.stringify({ ok: true, message: "Enviado: 6 objeto(s).", warnings: [], count: 6 });
    }
    if (script.indexOf("recibir(") >= 0) {
      return JSON.stringify({ ok: true, message: "6 objeto(s) en \"Cartel\"", warnings: [], count: 6, stamp: mockSent() });
    }
    if (script.indexOf("info") >= 0) {
      var sent = mockSent();
      return JSON.stringify({ ok: true, exists: true, modified: sent || (Date.now() - 42000), comp: "Cartel" });
    }
    return JSON.stringify({ ok: true, message: "Vista previa: no hay programa de Adobe conectado.", warnings: [] });
  }
  // Demo de la web: la pagina que contiene el panel puede pulsar sus botones
  if (!cep) {
    window.addEventListener("message", function (e) {
      if (e.origin !== location.origin || !e.data || e.data.fargotDemo !== "click") return;
      var el = document.getElementById(e.data.id);
      if (el) el.click();
    });
  }

  // ------------------------------------------------------------ tema
  function applyTheme() {
    var dark = true;
    try {
      var c = env.appSkinInfo.panelBackgroundColor.color;
      if (cep) env = JSON.parse(cep.getHostEnvironment());
      c = env.appSkinInfo.panelBackgroundColor.color;
      dark = (c.red * 0.299 + c.green * 0.587 + c.blue * 0.114) < 128;
      document.documentElement.style.setProperty("--bg",
        "rgb(" + Math.round(c.red) + "," + Math.round(c.green) + "," + Math.round(c.blue) + ")");
    } catch (e) {
      if (!cep && window.matchMedia) dark = !window.matchMedia("(prefers-color-scheme: light)").matches;
    }
    document.body.className = dark ? "dark" : "light";
  }
  applyTheme();
  if (cep && cep.addEventListener) {
    try { cep.addEventListener("com.adobe.csxs.events.ThemeColorChanged", applyTheme); } catch (e) {}
  }

  // ------------------------------------------------------------ utilidades UI
  var toastTimer = null;
  function toast(res) {
    var t = $("toast");
    var warns = (res && res.warnings) || [];
    t.className = "toast glass show" + (!res.ok ? " error" : (warns.length ? " warn" : ""));
    $("toastTitle").textContent = res.message || (res.ok ? "Listo" : "Error");
    var ul = $("toastList");
    ul.innerHTML = "";
    warns.forEach(function (w) {
      var li = document.createElement("li");
      li.textContent = w;
      ul.appendChild(li);
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = t.className.replace(" show", ""); },
      warns.length ? 9000 : 3500);
  }
  $("toast").addEventListener("click", function () { this.className = this.className.replace(" show", ""); });

  function status(kind, text) {
    $("statusPill").className = "pill" + (kind ? " " + kind : "");
    $("statusText").textContent = text;
  }

  function timeAgo(ms) {
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 10) return "Ahora mismo";
    if (s < 60) return "Hace " + s + " s";
    var m = Math.round(s / 60);
    if (m < 60) return "Hace " + m + " min";
    var h = Math.round(m / 60);
    if (h < 24) return "Hace " + h + " h";
    return new Date(ms).toLocaleDateString();
  }

  var KIND_NAMES = {
    PathItem: "Trazado", CompoundPathItem: "Compuesto", GroupItem: "Grupo",
    TextFrame: "Texto", SymbolItem: "Símbolo", PlacedItem: "Imagen vinculada",
    RasterItem: "Imagen", MeshItem: "Malla", PluginItem: "Objeto especial"
  };

  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem("pv." + k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem("pv." + k, JSON.stringify(v)); } catch (e) {} }
  };

  // ============================================================ ILLUSTRATOR
  function initAI() {
    $("viewAI").hidden = false;
    $("subtitle").textContent = "Enviar a After Effects";
    var btn = $("btnSend");
    var busy = false, lastCount = -1;

    function refreshSel() {
      if (busy || document.hidden) return;
      call("selInfo").then(function (r) {
        var n = r.count || 0;
        if (n !== lastCount) {
          var el = $("selCount");
          el.textContent = n;
          el.classList.add("bump");
          setTimeout(function () { el.classList.remove("bump"); }, 200);
          lastCount = n;
        }
        $("selLabel").textContent = !r.doc ? "Abre un documento"
          : (n === 1 ? "objeto seleccionado" : "objetos seleccionados");
        var chips = $("selKinds");
        chips.innerHTML = "";
        var kinds = r.kinds || {};
        Object.keys(kinds).forEach(function (k) {
          var c = document.createElement("span");
          c.className = "chip";
          c.textContent = kinds[k] + " " + (KIND_NAMES[k] || k);
          chips.appendChild(c);
        });
        btn.disabled = n === 0;
      });
    }

    function showLast() {
      var last = store.get("aiLast", null);
      $("aiLast").textContent = last ? (last.count + " objeto(s) · " + timeAgo(last.stamp)) : "Aún no has enviado nada";
    }

    var copyFx = $("optCopyFxAI");
    copyFx.checked = store.get("aiCopyFx", true);
    copyFx.addEventListener("change", function () { store.set("aiCopyFx", this.checked); });

    btn.addEventListener("click", function () {
      if (busy) return;
      busy = true;
      btn.disabled = true;
      btn.classList.add("busy");
      status("busy", copyFx.checked ? "Enviando y leyendo efectos" : "Enviando");
      call("enviar", { copyFx: copyFx.checked }).then(function (r) {
        busy = false;
        btn.classList.remove("busy");
        btn.disabled = false;
        toast(r);
        status(r.ok ? "" : "error", r.ok ? "Enviado" : "Error");
        if (r.ok) { store.set("aiLast", { count: r.count, stamp: r.stamp || Date.now() }); showLast(); }
      });
    });

    refreshSel();
    showLast();
    setInterval(refreshSel, 1500);
    setInterval(showLast, 15000);
  }

  // ============================================================ AFTER EFFECTS
  function initAE() {
    $("viewAE").hidden = false;
    $("subtitle").textContent = "Recibir desde Illustrator";
    var btn = $("btnReceive");
    var busy = false;
    var lastModified = 0;
    var imported = store.get("aeImported", 0);

    // ---- opciones (se recuerdan entre sesiones)
    var opts = store.get("aeOpts", {
      auto: false, center: true, grad: "exacto", copyFx: true,
      shadow: { on: false, opacity: 50, angle: 135, distance: 12, softness: 24, color: "#000000" },
      blur: { on: false, amount: 8 }
    });

    var GRAD_HINTS = {
      exacto: "Colores idénticos a Illustrator. Cada degradado se arma con Gradient Ramp (editable) recortado por la forma vectorial.",
      editable: "Usa el relleno de degradado propio de AE. La dirección llega exacta; los colores van anotados en el comentario de la capa."
    };

    function bindSlider(id, obj, key, unit) {
      var input = $(id), out = input.nextElementSibling;
      function paint() {
        var pct = (input.value - input.min) / (input.max - input.min) * 100;
        input.style.setProperty("--fill", pct + "%");
        out.textContent = input.value + unit;
      }
      input.value = obj[key];
      paint();
      input.addEventListener("input", function () { obj[key] = Number(input.value); paint(); save(); });
    }

    function save() { store.set("aeOpts", opts); }

    if (opts.copyFx === undefined) opts.copyFx = true;
    $("optCopyFx").checked = opts.copyFx;
    $("optCopyFx").addEventListener("change", function () { opts.copyFx = this.checked; save(); });
    // Forma libre: "imagen" | "recrear" | "omitir"
    if (opts.freeform === undefined || opts.freeform === true) opts.freeform = "imagen";
    if (opts.freeform === false) opts.freeform = "omitir";
    var FF_HINTS = {
      imagen: "Idénticos a Illustrator: llegan como imagen de alta resolución recortada por su forma vectorial.",
      recrear: "Se rehacen con 4-Color Gradient y tonos difuminados, todo editable en After Effects. Es una aproximación.",
      omitir: "Solo llega la forma vectorial, sin el degradado."
    };
    var ffSeg = $("optFreeform");
    function paintFF() {
      Array.prototype.forEach.call(ffSeg.children, function (b) {
        b.classList.toggle("on", b.getAttribute("data-v") === opts.freeform);
      });
      $("ffHint").textContent = FF_HINTS[opts.freeform];
    }
    ffSeg.addEventListener("click", function (e) {
      var v = e.target.getAttribute && e.target.getAttribute("data-v");
      if (v) { opts.freeform = v; save(); paintFF(); }
    });
    paintFF();
    // Textos: "editable" (capa de texto de AE) | "contornos" (formas)
    if (opts.text !== "contornos") opts.text = "editable";
    var TXT_HINTS = {
      editable: "Capas de texto de After Effects: puedes cambiar lo que dice, la fuente y el tamaño. Usa las mismas fuentes que en Illustrator.",
      contornos: "El texto llega convertido en formas: idéntico, pero ya no se puede reescribir."
    };
    var txtSeg = $("optText");
    function paintTxt() {
      Array.prototype.forEach.call(txtSeg.children, function (b) {
        b.classList.toggle("on", b.getAttribute("data-v") === opts.text);
      });
      $("txtHint").textContent = TXT_HINTS[opts.text];
    }
    txtSeg.addEventListener("click", function (e) {
      var v = e.target.getAttribute && e.target.getAttribute("data-v");
      if (v) { opts.text = v; save(); paintTxt(); }
    });
    paintTxt();
    $("optAuto").checked = opts.auto;
    $("optCenter").checked = opts.center;
    $("optShadow").checked = opts.shadow.on;
    $("optBlur").checked = opts.blur.on;
    $("shadowBox").hidden = !opts.shadow.on;
    $("blurBox").hidden = !opts.blur.on;
    $("shColor").value = opts.shadow.color;

    bindSlider("shOpacity", opts.shadow, "opacity", " %");
    bindSlider("shAngle", opts.shadow, "angle", "°");
    bindSlider("shDistance", opts.shadow, "distance", " px");
    bindSlider("shSoftness", opts.shadow, "softness", " px");
    bindSlider("blAmount", opts.blur, "amount", "");

    $("optAuto").addEventListener("change", function () {
      opts.auto = this.checked;
      // al activarlo, no importar de golpe un envio antiguo
      if (opts.auto && lastModified) { imported = lastModified; store.set("aeImported", imported); }
      save();
      updateHero();
    });
    $("optCenter").addEventListener("change", function () { opts.center = this.checked; save(); });
    $("optShadow").addEventListener("change", function () {
      opts.shadow.on = this.checked; $("shadowBox").hidden = !this.checked; save();
    });
    $("optBlur").addEventListener("change", function () {
      opts.blur.on = this.checked; $("blurBox").hidden = !this.checked; save();
    });
    $("shColor").addEventListener("input", function () { opts.shadow.color = this.value; save(); });



    function hexToRGB(h) {
      var n = parseInt(h.replace("#", ""), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }

    function hostOptions() {
      return {
        grad: opts.grad,
        center: opts.center,
        copyFx: opts.copyFx,
        freeform: opts.freeform,
        text: opts.text,
        shadow: {
          on: opts.shadow.on, opacity: opts.shadow.opacity, angle: opts.shadow.angle,
          distance: opts.shadow.distance, softness: opts.shadow.softness,
          color: hexToRGB(opts.shadow.color)
        },
        blur: { on: opts.blur.on, amount: opts.blur.amount }
      };
    }

    function receive(auto) {
      if (busy) return;
      busy = true;
      btn.disabled = true;
      status("busy", "Recibiendo");
      call("recibir", hostOptions()).then(function (r) {
        busy = false;
        btn.disabled = false;
        if (r.ok) {
          imported = lastModified || Date.now();
          store.set("aeImported", imported);
          if (auto) r.message = "Automático · " + r.message;
        }
        toast(r);
        status(r.ok ? "" : "error", r.ok ? "Recibido" : "Error");
        updateHero();
      });
    }

    var lastInfo = null;
    function updateHero() {
      var r = lastInfo;
      if (!r || !r.exists) {
        $("aeLast").textContent = "Sin envíos";
        $("aeNew").hidden = true;
        $("aeComp").textContent = "Envía algo desde el panel de Illustrator";
        btn.disabled = true;
        return;
      }
      $("aeLast").textContent = timeAgo(r.modified);
      $("aeNew").hidden = !(r.modified > imported);
      $("aeComp").textContent = r.comp ? "Destino: " + r.comp : "Sin composición activa: se creará una nueva";
      btn.disabled = busy;
      if (opts.auto && !opts.autoPaused) status("", "Automático");
    }

    function poll() {
      if (busy) return;
      call("info").then(function (r) {
        lastInfo = r;
        if (r.exists) lastModified = r.modified;
        updateHero();
        if (opts.auto && r.exists && r.modified > imported) receive(true);
      });
    }

    btn.addEventListener("click", function () { receive(false); });
    poll();
    setInterval(poll, 1000);
  }

  // ============================================================ licencia
  // Sin sesion valida en la app Fargot se muestra el bloqueo. Se vuelve a
  // comprobar cada pocos segundos para desbloquear solo al iniciar sesion.
  var hostDir = "";
  try {
    var ext = cep ? cep.getSystemPath("extension") : "";
    ext = decodeURIComponent(String(ext || "")).replace(/^file:\/{2,3}/, "").replace(/\\/g, "/");
    if (ext) hostDir = ext + "/host";
  } catch (e) {}

  var started = false, licensed = null;
  function checkLicense() {
    evalHost('FargotTransfer.license("' + hostDir.replace(/"/g, '\\"') + '")').then(function (r) {
      var res;
      try { res = JSON.parse(r); } catch (e) { res = { ok: false, message: "No se pudo comprobar la licencia." }; }
      if (res.ok === licensed) return;
      licensed = res.ok;
      $("lock").hidden = res.ok;
      $("viewAI").hidden = !res.ok || !IS_AI;
      $("viewAE").hidden = !res.ok || IS_AI;
      $("lockMsg").textContent = res.message || "";
      $("subtitle").textContent = res.ok ? (IS_AI ? "Enviar a After Effects" : "Recibir desde Illustrator") : "Fargot Transfer";
      if (res.ok && !started) {
        started = true;
        if (IS_AI) initAI(); else initAE();
      }
      if (res.ok && res.email) status("", res.email.split("@")[0]);
    });
  }
  $("btnHub").addEventListener("click", function () {
    call("openHub").then(function (r) { if (!r.ok) toast(r); });
  });
  checkLicense();
  setInterval(checkLicense, 3000);
})();
