// JS propio de la web de Tookie (sale como assets/sitio.js). Sin dependencias.
// Todo funciona sin esto salvo la calculadora de "¿Lo compro?" (y Nara animada, que es otro archivo).
//   1. Sombra del encabezado al bajar.
//   2. Menú del celular (<details>): se cierra al tocar un link, con Escape, tocando afuera o si el foco sale.
//   3. Calculadora de "¿Lo compro?": horas de trabajo y "si lo invertís".
//   4. Año del pie.
//   5. Movimiento de la web (17/11/2026): barra de avance de lectura, aparecer al entrar en pantalla, cifras
//      que cuentan, el link del menú de la sección que se está leyendo y el selector de funciones.
//   6. Carrusel de la ciencia.
//   7. Aviso de visitas (27/11/2026): una señal por visita a la función `visita-web` de Supabase.
//   8. Lista de espera (27/11/2026): el campo de correo del héroe (sin JavaScript no se muestra).
//      Con "Reducir movimiento" (o sin IntersectionObserver) no se anima nada: todo se ve de entrada.
(function () {
  'use strict';

  var raiz = document.documentElement;
  // El script del <head> puso la clase `anima` (ver plantillas/base.cjs) y espera esta señal: si a los 4 s no
  // llegó, la saca para que nada quede escondido.
  window.tookieListo = true;
  var anima = raiz.classList.contains('anima') && 'IntersectionObserver' in window;
  if (!anima) raiz.classList.remove('anima');

  // 1. Sombra del encabezado ------------------------------------------------------------------------
  var encabezado = document.querySelector('[data-encabezado]');
  if (encabezado) {
    var pendiente = false;
    var barra = encabezado.querySelector('[data-progreso]');
    var revisar = function () {
      pendiente = false;
      if (window.scrollY > 8) encabezado.setAttribute('data-sombra', '');
      else encabezado.removeAttribute('data-sombra');
      // Barra de avance: cuánto de la página ya se recorrió.
      if (barra) {
        var total = raiz.scrollHeight - window.innerHeight;
        var avance = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
        barra.style.transform = 'scaleX(' + avance.toFixed(4) + ')';
      }
    };
    window.addEventListener('resize', revisar, { passive: true });
    window.addEventListener(
      'scroll',
      function () {
        if (!pendiente) {
          pendiente = true;
          window.requestAnimationFrame(revisar);
        }
      },
      { passive: true }
    );
    revisar();
  }

  // 2. Menú del celular -----------------------------------------------------------------------------
  var menu = document.querySelector('[data-menu]');
  if (menu) {
    var boton = menu.querySelector('summary');
    var etiqueta = function () {
      if (!boton) return;
      var texto = menu.open ? boton.getAttribute('data-cerrar') : boton.getAttribute('data-abrir');
      if (texto) boton.setAttribute('aria-label', texto);
    };
    var cerrar = function (devolverFoco) {
      if (!menu.open) return;
      menu.open = false;
      if (devolverFoco && boton) boton.focus();
    };
    menu.addEventListener('toggle', etiqueta);
    menu.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) cerrar(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') cerrar(true);
    });
    document.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) cerrar(false);
    });
    // Con el teclado: si el foco sale del menú (Tab desde el último link), se cierra, así el panel no queda
    // abierto tapando lo que se enfoca después. Cerrarlo no mueve la página (el panel flota).
    menu.addEventListener('focusout', function (e) {
      if (menu.open && e.relatedTarget && !menu.contains(e.relatedTarget)) cerrar(false);
    });
    var ancho = window.matchMedia('(min-width: 900px)');
    var alCambiar = function (m) {
      if (m.matches) cerrar(false);
    };
    if (ancho.addEventListener) ancho.addEventListener('change', alCambiar);
  }

  // 3. Calculadora de "¿Lo compro?" -----------------------------------------------------------------
  // Mismas cuentas que la app: horas = precio / valor hora (calcularHoras en
  // src/screens/herramientas/calculos.ts; con sueldo por mes, valor hora = sueldo / (8 h × 5 días × 52/12),
  // calcularValorHora en src/utils/finanzas.ts) y "si lo invertís" = precio × (1 + tasa)^años
  // (proyectarInversion en src/screens/herramientas/contrato.ts, sin aportes), a 20 años y 10 % anual.
  var calc = document.querySelector('[data-calculadora]');
  if (calc) {
    var dato = function (nombre, defecto) {
      var v = calc.getAttribute('data-' + nombre);
      return v === null || v === '' ? defecto : v;
    };
    var locale = dato('locale', document.documentElement.lang || 'es');
    var anios = Number(dato('anios', 20));
    var tasa = Number(dato('tasa', 10)) / 100;
    var horasMes = Number(dato('horas-mes', 0));
    var simbolo = dato('simbolo', '');
    // "$ 54.000" en español y "$6,538.12" en inglés: lo decide la plantilla (data-separador).
    var separador = calc.getAttribute('data-separador');
    if (separador === null) separador = ' ';
    var uHora = dato('u-hora', 'h');
    var uMinuto = dato('u-minuto', 'min');
    var uMenos = dato('u-menos', '< 1 ' + uMinuto);
    var precio = calc.querySelector('[name="precio"]');
    var sueldo = calc.querySelector('[name="sueldo"]');
    var resultados = calc.querySelector('[data-resultados]');
    var vacio = calc.querySelector('[data-vacio]');
    var salidaHoras = calc.querySelector('[data-resultado="horas"] [data-valor]');
    var salidaInvertido = calc.querySelector('[data-resultado="invertido"] [data-valor]');

    var formato = function (opciones) {
      try {
        return new Intl.NumberFormat(locale, opciones);
      } catch (e) {
        return new Intl.NumberFormat(undefined, opciones);
      }
    };
    var entero = formato({ maximumFractionDigits: 0 });
    var partes = formato({}).formatToParts(11111.1);
    var simboloDe = function (tipo, defecto) {
      for (var i = 0; i < partes.length; i += 1) if (partes[i].type === tipo) return partes[i].value;
      return defecto;
    };
    var miles = simboloDe('group', ',');
    var decimal = simboloDe('decimal', '.');

    // "120.000" o "1.234,56" en español; "120,000" o "12.5" en inglés. Si el separador de miles aparece una
    // sola vez y no le siguen exactamente 3 cifras ("12.5" en español), se toma como coma decimal.
    var leer = function (texto) {
      var s = String(texto || '').replace(/[\s  ]/g, '').replace(/[^0-9.,]/g, '');
      if (!s) return NaN;
      if (s.indexOf(decimal) < 0) {
        var trozos = s.split(miles);
        if (trozos.length === 2 && trozos[1].length !== 3) s = trozos[0] + '.' + trozos[1];
        else s = trozos.join('');
      } else {
        s = s.split(miles).join('').replace(decimal, '.');
      }
      var n = parseFloat(s);
      return isFinite(n) ? n : NaN;
    };

    // formatDuracionTrabajo de src/utils/finanzas.ts (sin los días): "13 h 20 min".
    var duracion = function (horas) {
      if (!isFinite(horas) || horas < 0) return '—';
      if (horas < 1 / 60) return uMenos;
      if (horas < 1) return Math.round(horas * 60) + ' ' + uMinuto;
      var h = Math.floor(horas);
      var min = Math.round((horas - h) * 60);
      if (min === 60) {
        h += 1;
        min = 0;
      }
      return min > 0 ? entero.format(h) + ' ' + uHora + ' ' + min + ' ' + uMinuto : entero.format(h) + ' ' + uHora;
    };

    var monto = function (valor) {
      if (!isFinite(valor)) return '—';
      // Sin decimales desde 100; por debajo, siempre dos ("$7.40", "$ 7,40"; nunca "7.4"), como en la plantilla.
      var texto = formato(valor >= 100 ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
      return simbolo ? simbolo + separador + texto : texto;
    };

    var calcular = function () {
      var p = leer(precio && precio.value);
      var s = leer(sueldo && sueldo.value);
      var valorHora = horasMes > 0 ? s / horasMes : s;
      var listo = p > 0 && valorHora > 0;
      if (resultados) resultados.hidden = !listo && !!vacio;
      if (vacio) vacio.hidden = listo;
      poner(salidaHoras, listo ? duracion(p / valorHora) : '—');
      poner(salidaInvertido, listo ? monto(p * Math.pow(1 + tasa, anios)) : '—');
    };
    // Escribe el resultado y, si cambió, le da un saltito (la clase vuelve a arrancar la animación del CSS).
    var poner = function (salida, texto) {
      if (!salida || salida.textContent === texto) return;
      salida.textContent = texto;
      if (!anima) return;
      salida.classList.remove('resultado__valor--cambio');
      void salida.offsetWidth;
      salida.classList.add('resultado__valor--cambio');
    };

    calc.addEventListener('input', calcular);
    calc.addEventListener('submit', function (e) {
      e.preventDefault();
      calcular();
    });
    calcular();
  }

  // 4. Año del pie ----------------------------------------------------------------------------------
  var anio = document.querySelector('[data-anio]');
  if (anio) {
    var actual = new Date().getFullYear();
    if (actual > Number(anio.getAttribute('data-anio'))) anio.textContent = String(actual);
  }

  // 5. Movimiento de la web -------------------------------------------------------------------------
  var lista = function (selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  };

  // 5a. Aparecer al entrar en pantalla: lo que lleva `revelar` recibe `en-vista` (y con eso se llenan las
  // barras de los dibujos). Después de la entrada se le saca `revelar`, así su transición no demora lo que
  // venga después (por ejemplo, levantarse al pasar el mouse).
  var cifras = lista('[data-contar]');
  var contar = function (el) {
    var destino = Number(el.getAttribute('data-contar'));
    if (!anima || !isFinite(destino) || destino <= 0) return;
    var inicio = null;
    var duracionMs = 900;
    var paso = function (ahora) {
      if (inicio === null) inicio = ahora;
      var t = Math.min(1, (ahora - inicio) / duracionMs);
      // Frena al final (curva cúbica de salida).
      el.textContent = String(Math.round(destino * (1 - Math.pow(1 - t, 3))));
      if (t < 1) window.requestAnimationFrame(paso);
    };
    el.textContent = '0';
    window.requestAnimationFrame(paso);
  };
  var revelables = lista('.revelar');
  if (anima) {
    var alVer = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          var el = entrada.target;
          alVer.unobserve(el);
          if (el.hasAttribute('data-contar')) {
            contar(el);
            return;
          }
          el.classList.add('en-vista');
          window.setTimeout(function () {
            el.classList.remove('revelar');
          }, 1600);
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
    );
    revelables.forEach(function (el) {
      alVer.observe(el);
    });
    cifras.forEach(function (el) {
      alVer.observe(el);
    });
  } else {
    revelables.forEach(function (el) {
      el.classList.add('en-vista');
    });
  }

  // 5b. El link del menú de la sección que se está leyendo.
  var enlaces = lista('.nav a[href^="#"]');
  if (enlaces.length && 'IntersectionObserver' in window) {
    var porId = {};
    var visibles = {};
    enlaces.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var seccion = id && document.getElementById(id);
      if (seccion) {
        porId[id] = a;
        espia(seccion);
      }
    });
  }
  function espia(seccion) {
    if (!espia.observador) {
      espia.observador = new IntersectionObserver(
        function (entradas) {
          entradas.forEach(function (entrada) {
            visibles[entrada.target.id] = entrada.isIntersecting;
          });
          var actualId = null;
          for (var id in porId) if (visibles[id]) actualId = id;
          for (var otro in porId) {
            if (otro === actualId) porId[otro].setAttribute('aria-current', 'true');
            else porId[otro].removeAttribute('aria-current');
          }
        },
        // Cuenta la sección que cruza la franja del medio de la pantalla.
        { rootMargin: '-45% 0px -50% 0px' }
      );
    }
    espia.observador.observe(seccion);
  }

  // 5d. "Lleva puesto: …": cada vez que Nara cambia de atuendo (evento del runtime de Nara, ver
  // web/nara/runtime/entrada.tsx), el cartelito dice qué tiene puesto. Los textos vienen armados en el HTML.
  document.addEventListener('nara:atuendo', function (e) {
    var id = e.detail && e.detail.id;
    var cartel = id ? document.querySelector('[data-atuendo="' + id + '"]') : null;
    var salida = cartel && cartel.querySelector('[data-atuendo-texto]');
    if (!salida) return;
    var textos = cartel.tookieAtuendos;
    if (!textos) {
      try {
        textos = JSON.parse(cartel.getAttribute('data-atuendos') || '[]');
      } catch (error) {
        textos = [];
      }
      cartel.tookieAtuendos = textos;
      cartel.tookiePaso = 0;
    }
    if (!textos.length) return;
    cartel.tookiePaso = (cartel.tookiePaso + 1) % textos.length;
    salida.textContent = textos[cartel.tookiePaso];
    cartel.classList.remove('atuendo--cambio');
    void cartel.offsetWidth;
    cartel.classList.add('atuendo--cambio');
  });

  // 5c. El selector de funciones (funciona solo, con botones de opción y CSS). Acá: se bajan las capturas de
  // las demás funciones apenas la persona se acerca, para que el cambio sea instantáneo, y en el celular la
  // función elegida queda a la vista dentro de la fila de botones.
  var explorador = document.querySelector('[data-explorador]');
  if (explorador) {
    var precargado = false;
    var precargar = function () {
      if (precargado) return;
      precargado = true;
      lista('[data-explorador] img[loading="lazy"]').forEach(function (img) {
        img.loading = 'eager';
      });
    };
    ['pointerenter', 'touchstart', 'focusin'].forEach(function (evento) {
      explorador.addEventListener(evento, precargar, { passive: true });
    });
    explorador.addEventListener('change', function (e) {
      precargar();
      var etiqueta = e.target && e.target.id ? explorador.querySelector('label[for="' + e.target.id + '"]') : null;
      var fila = etiqueta && etiqueta.parentNode;
      if (!fila || fila.scrollWidth <= fila.clientWidth) return;
      var destino = etiqueta.offsetLeft - (fila.clientWidth - etiqueta.offsetWidth) / 2;
      try {
        fila.scrollTo({ left: destino, behavior: anima ? 'smooth' : 'auto' });
      } catch (error) {
        fila.scrollLeft = destino;
      }
    });
  }

  // 6. Carrusel de los estudios (#ciencia, 18/11/2026). Sin esto igual se desliza con el dedo o la rueda
  // (scroll-snap); acá se suman las flechas y los puntos: el punto marcado es la tarjeta que arranca a la
  // izquierda, y tocar uno lleva a esa tarjeta.
  lista('[data-carrusel]').forEach(function (carrusel) {
    var pista = carrusel.querySelector('[data-carrusel-pista]');
    if (!pista) return;
    var tarjetas = Array.prototype.slice.call(pista.children);
    var puntos = Array.prototype.slice.call(carrusel.querySelectorAll('[data-carrusel-punto]'));
    var atras = carrusel.querySelector('[data-carrusel-atras]');
    var adelante = carrusel.querySelector('[data-carrusel-adelante]');
    var actual = 0;
    var margen = function () {
      return parseFloat(window.getComputedStyle(pista).paddingLeft) || 0;
    };
    var alFinal = function () {
      return pista.scrollLeft + pista.clientWidth >= pista.scrollWidth - 4;
    };
    var marcarPunto = function (indice) {
      actual = indice;
      puntos.forEach(function (p, i) {
        if (i === indice) p.setAttribute('aria-current', 'true');
        else p.removeAttribute('aria-current');
      });
    };
    var ir = function (i) {
      var indice = Math.max(0, Math.min(tarjetas.length - 1, i));
      var t = tarjetas[indice];
      if (!t) return;
      // El punto se marca enseguida; al terminar de deslizarse, marcar() lo confirma.
      marcarPunto(indice);
      var destino = t.offsetLeft - margen();
      try {
        pista.scrollTo({ left: destino, behavior: anima ? 'smooth' : 'auto' });
      } catch (error) {
        pista.scrollLeft = destino;
      }
    };
    var marcar = function () {
      var base = pista.scrollLeft + margen();
      var mejor = 0;
      var distancia = Infinity;
      tarjetas.forEach(function (t, i) {
        var d = Math.abs(t.offsetLeft - base);
        if (d < distancia) {
          distancia = d;
          mejor = i;
        }
      });
      // Al llegar al final se marca la última, aunque haya varias a la vista.
      if (alFinal() && pista.scrollLeft > 4) mejor = tarjetas.length - 1;
      marcarPunto(mejor);
      if (atras) atras.disabled = pista.scrollLeft <= 4;
      if (adelante) adelante.disabled = alFinal();
    };
    var espera = null;
    var alMover = function () {
      window.clearTimeout(espera);
      espera = window.setTimeout(marcar, 60);
    };
    pista.addEventListener('scroll', alMover, { passive: true });
    window.addEventListener('resize', alMover);
    // La primera tarjeta que se ve entera desde la izquierda (al final, con varias a la vista, `actual` es la
    // última: para volver una se parte de esta).
    var primeraEntera = function () {
      var base = pista.scrollLeft + margen();
      for (var i = 0; i < tarjetas.length; i++) if (tarjetas[i].offsetLeft >= base - 4) return i;
      return tarjetas.length - 1;
    };
    puntos.forEach(function (p, i) {
      p.addEventListener('click', function () {
        ir(i);
      });
    });
    if (atras) {
      atras.addEventListener('click', function () {
        ir((alFinal() ? primeraEntera() : actual) - 1);
      });
    }
    if (adelante) {
      adelante.addEventListener('click', function () {
        ir(actual + 1);
      });
    }
    marcar();
  });

  // 7. Aviso de visitas (27/11/2026; docs/AVISO_VISITAS_WEB.md) ----------------------------------------
  // Una señal por visita (una vez por pestaña) a la función `visita-web` de Supabase, que le avisa a Santi
  // al iPhone. Solo en tookieapps.com. Sin cookies: manda la página, el idioma, la zona horaria, si es
  // celular y el sitio de donde vino (solo el dominio). Para que no cuente tus propias visitas, abrí una vez
  // tookieapps.com/?no-contar=1 en ese navegador (y ?contar=1 para volver a contarlas).
  (function () {
    var destino = raiz.getAttribute('data-visitas');
    var host = location.hostname;
    if (!destino || (host !== 'tookieapps.com' && host !== 'www.tookieapps.com')) return;
    if (navigator.webdriver || !navigator.sendBeacon) return;
    try {
      var params = new URLSearchParams(location.search);
      if (params.get('no-contar') === '1') localStorage.setItem('tookie-no-contar', '1');
      if (params.get('contar') === '1') localStorage.removeItem('tookie-no-contar');
      if (localStorage.getItem('tookie-no-contar') === '1') return;
      if (sessionStorage.getItem('tookie-visita') === '1') return;
    } catch (error) {
      return;
    }
    var origen = '';
    try {
      origen = new URLSearchParams(location.search).get('utm_source') || '';
      if (!origen && document.referrer) {
        var ref = new URL(document.referrer).hostname;
        if (ref !== host) origen = ref;
      }
    } catch (error) {
      origen = '';
    }
    var mandar = function () {
      try {
        sessionStorage.setItem('tookie-visita', '1');
        var zona = '';
        try {
          zona = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        } catch (error) {
          zona = '';
        }
        var datos = {
          pagina: location.pathname,
          idioma: (raiz.lang || '').indexOf('es') === 0 ? 'es' : 'en',
          zona: zona,
          celular: /Mobi|iPhone|iPad|Android/i.test(navigator.userAgent),
          origen: origen,
        };
        navigator.sendBeacon(destino, new Blob([JSON.stringify(datos)], { type: 'text/plain' }));
      } catch (error) {
        /* sin aviso, la página sigue igual */
      }
    };
    // Una página precargada en segundo plano no es una visita hasta que se mira.
    if (document.visibilityState === 'visible') mandar();
    else {
      var alVer = function () {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', alVer);
        mandar();
      };
      document.addEventListener('visibilitychange', alVer);
    }
  })();

  // 8. Lista de espera (27/11/2026; docs/LISTA_DE_ESPERA.md) -------------------------------------------
  // El campo de correo de la primera sección: lo manda a la función `lista-espera` de Supabase, que solo
  // acepta pedidos de tookieapps.com. En la compu (localhost) NO manda nada: simula que salió bien, para
  // poder ver cómo queda. Se manda como texto (no JSON) para que el navegador no haga un pedido previo.
  (function () {
    var form = document.querySelector('[data-lista-espera]');
    if (!form) return;
    var destino = form.getAttribute('data-lista-espera');
    var campo = form.querySelector('input[name="email"]');
    var trampa = form.querySelector('input[name="sitio"]');
    var boton = form.querySelector('button[type="submit"]');
    var estado = form.querySelector('[role="status"]');
    var host = location.hostname;
    var deVerdad = host === 'tookieapps.com' || host === 'www.tookieapps.com';
    var CLAVE = 'tookie-lista-espera';

    var mostrar = function (tipo, texto) {
      if (tipo) form.setAttribute('data-estado', tipo);
      else form.removeAttribute('data-estado');
      estado.textContent = texto || '';
      campo.setAttribute('aria-invalid', tipo === 'error' ? 'true' : 'false');
    };
    var anotado = function () {
      mostrar('listo', form.getAttribute('data-listo'));
      campo.readOnly = true;
      boton.disabled = true;
    };
    try {
      if (localStorage.getItem(CLAVE) === '1') {
        anotado();
        return;
      }
    } catch (error) {
      /* sin memoria del navegador: se puede volver a anotar, y el servidor no duplica */
    }
    var correoValido = function (texto) {
      return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/.test(texto) && texto.length <= 254;
    };
    var origen = function () {
      try {
        var o = new URLSearchParams(location.search).get('utm_source') || '';
        if (!o && document.referrer) {
          var ref = new URL(document.referrer).hostname;
          if (ref !== host) o = ref;
        }
        return o;
      } catch (error) {
        return '';
      }
    };
    campo.addEventListener('input', function () {
      if (form.getAttribute('data-estado') === 'error') mostrar(null, '');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (boton.disabled) return;
      var email = campo.value.trim();
      if (!correoValido(email)) {
        mostrar('error', form.getAttribute('data-invalido'));
        campo.focus();
        return;
      }
      boton.disabled = true;
      mostrar('enviando', form.getAttribute('data-enviando'));
      var listo = function () {
        try {
          localStorage.setItem(CLAVE, '1');
        } catch (error) {
          /* nada */
        }
        anotado();
      };
      var fallo = function (tipo) {
        boton.disabled = false;
        mostrar('error', form.getAttribute(tipo === 'email' ? 'data-invalido' : 'data-error'));
      };
      if (!deVerdad || !window.fetch) {
        window.setTimeout(deVerdad ? function () { fallo(); } : listo, 600);
        return;
      }
      var datos = {
        email: email,
        sitio: trampa ? trampa.value : '',
        idioma: (raiz.lang || '').indexOf('es') === 0 ? 'es' : 'en',
        pagina: location.pathname,
        origen: origen(),
      };
      fetch(destino, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(datos) })
        .then(function (r) {
          return r.json().catch(function () {
            return {};
          }).then(function (cuerpo) {
            if (r.ok && cuerpo.ok) listo();
            else fallo(cuerpo.error);
          });
        })
        .catch(function () {
          fallo();
        });
    });
  })();
})();
