/* El Barto Exclusivo — Demo de boletería (lógica compartida) */
(function () {
  'use strict';

  /* ---------------- Ambient audio (síntesis simple, sin archivos externos) ---------------- */
  var audioCtx = null;
  var audioTimer = null;
  var audioOn = false;

  function startAmbient() {
    try {
      if (!audioCtx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
        var master = audioCtx.createGain();
        master.gain.value = 0.05;
        master.connect(audioCtx.destination);

        var shaper = audioCtx.createWaveShaper();
        var curve = new Float32Array(2048);
        for (var i = 0; i < 2048; i++) {
          var x = (i * 2) / 2048 - 1;
          curve[i] = Math.tanh(x * 3);
        }
        shaper.curve = curve;
        shaper.connect(master);

        var notes = [82.41, 82.41, 110.0, 98.0];

        var playChord = function (freq, start, dur) {
          [1, 1.5].forEach(function (mult) {
            var osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq * mult;
            var g = audioCtx.createGain();
            g.gain.setValueAtTime(0.0001, start);
            g.gain.linearRampToValueAtTime(0.5, start + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, start + dur);
            osc.connect(g);
            g.connect(shaper);
            osc.start(start);
            osc.stop(start + dur + 0.05);
          });
          var kick = audioCtx.createOscillator();
          kick.type = 'sine';
          kick.frequency.setValueAtTime(120, start);
          kick.frequency.exponentialRampToValueAtTime(40, start + 0.15);
          var kg = audioCtx.createGain();
          kg.gain.setValueAtTime(0.5, start);
          kg.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
          kick.connect(kg);
          kg.connect(master);
          kick.start(start);
          kick.stop(start + 0.2);
        };

        var loop = function () {
          if (!audioOn) return;
          var now = audioCtx.currentTime + 0.05;
          notes.forEach(function (f, i) {
            playChord(f, now + i * 0.9, 0.85);
          });
          audioTimer = setTimeout(loop, notes.length * 900);
        };
        loop();
      } else if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    } catch (e) { /* Web Audio no disponible: silencioso por defecto */ }
  }

  function stopAmbient() {
    if (audioTimer) clearTimeout(audioTimer);
    if (audioCtx) {
      try { audioCtx.suspend(); } catch (e) {}
    }
  }

  function updateAudioButtons() {
    document.querySelectorAll('[data-audio-toggle]').forEach(function (btn) {
      btn.classList.toggle('is-on', audioOn);
      var label = btn.querySelector('[data-audio-label]');
      if (label) label.textContent = audioOn ? 'Ambiente ON' : 'Sonido ambiente';
    });
  }

  function toggleAudio() {
    audioOn = !audioOn;
    if (audioOn) startAmbient(); else stopAmbient();
    updateAudioButtons();
  }

  function initAmbientAudio() {
    document.querySelectorAll('[data-audio-toggle]').forEach(function (btn) {
      btn.addEventListener('click', toggleAudio);
    });
    updateAudioButtons();
  }

  /* ---------------- Booking / pago simulado ---------------- */
  function fmt(n) {
    return '$' + n.toLocaleString('es-CO');
  }

  /*
   * EVENT.zones: ordered from closest to the stage to farthest, e.g.
   * [ { id:'preferencial', name, desc, price, type:'tables', tablesCount, tablesReserved:[...] },
   *   { id:'vip',          name, desc, price, type:'tables', tablesCount, tablesReserved:[...] },
   *   { id:'general',      name, desc, price, type:'zone',   availLabel } ]
   * 'tables' zones render a clickable 2D grid of numbered mesas (occupied/free/selected).
   * 'zone' (general) renders as a single standing-room panel with a quantity stepper.
   */
  function initBooking(EVENT) {
    var modal = document.getElementById('bookingModal');
    if (!modal) return;

    var els = {
      openBtns: document.querySelectorAll('[data-open-booking]'),
      closeBtn: document.getElementById('modalClose'),
      stepBooking: document.getElementById('stepBooking'),
      stepPayment: document.getElementById('stepPayment'),
      stepProcessing: document.getElementById('stepProcessing'),
      stepConfirmation: document.getElementById('stepConfirmation'),
      eventName: document.getElementById('modalEventName'),
      bookingBody: document.querySelector('#bookingModal .booking-body'),
      venueMap: document.getElementById('venueMap'),
      qtyRow: document.getElementById('qtyRow'),
      qtyValue: document.getElementById('qtyValue'),
      qtyDec: document.getElementById('qtyDec'),
      qtyInc: document.getElementById('qtyInc'),
      subtotalValue: document.getElementById('subtotalValue'),
      goPaymentBtn: document.getElementById('goPaymentBtn'),
      backToBookingBtn: document.getElementById('backToBookingBtn'),
      payBtn: document.getElementById('payBtn'),
      backToDetailBtn: document.getElementById('backToDetailBtn'),
      summaryLine: document.getElementById('summaryLine'),
      summaryPrice: document.getElementById('summaryPrice'),
      summaryTotal: document.getElementById('summaryTotal'),
      ticketEvent: document.getElementById('ticketEvent'),
      ticketDate: document.getElementById('ticketDate'),
      ticketSummary: document.getElementById('ticketSummary'),
      ticketCode: document.getElementById('ticketCode')
    };
    if (!els.venueMap) return;

    var priceFromEls = document.querySelectorAll('[data-price-from]');
    var state = { step: 'booking', category: null, qty: 1, tableId: null };

    var minPrice = Math.min.apply(null, EVENT.zones.map(function (z) { return z.price; }));
    priceFromEls.forEach(function (el) { el.textContent = fmt(minPrice); });
    if (els.eventName) els.eventName.textContent = EVENT.title;

    function getZone(id) {
      return EVENT.zones.filter(function (z) { return z.id === id; })[0] || null;
    }

    function buildStage() {
      var stage = document.createElement('div');
      stage.className = 'venue-stage';
      stage.textContent = 'TARIMA';
      return stage;
    }

    function buildZone(zone) {
      var wrap = document.createElement('div');
      wrap.className = 'venue-zone zone-' + zone.id;

      var head = document.createElement('div');
      head.className = 'venue-zone-head';

      var left = document.createElement('div');
      var nameEl = document.createElement('div');
      nameEl.className = 'venue-zone-name';
      var dot = document.createElement('span');
      dot.className = 'dot';
      nameEl.appendChild(dot);
      nameEl.appendChild(document.createTextNode(zone.name));
      var descEl = document.createElement('div');
      descEl.className = 'venue-zone-desc';
      descEl.textContent = zone.desc;
      left.appendChild(nameEl);
      left.appendChild(descEl);

      var priceEl = document.createElement('div');
      priceEl.className = 'venue-zone-price';
      priceEl.textContent = fmt(zone.price) + (zone.type === 'tables' ? ' / mesa' : ' / persona');

      head.appendChild(left);
      head.appendChild(priceEl);
      wrap.appendChild(head);

      if (zone.type === 'tables') {
        var grid = document.createElement('div');
        grid.className = 'venue-seats';
        for (var n = 1; n <= zone.tablesCount; n++) {
          (function (n) {
            var reserved = zone.tablesReserved.indexOf(n) !== -1;
            var selected = state.category === zone.id && state.tableId === n;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'venue-seat' + (reserved ? ' is-reserved' : '') + (selected ? ' is-selected' : '');
            btn.disabled = reserved;
            btn.textContent = n;
            btn.setAttribute('aria-label', zone.name + ' — mesa ' + n + (reserved ? ' (ocupada)' : ' (disponible)'));
            btn.addEventListener('click', function () {
              if (reserved) return;
              state.category = zone.id;
              state.tableId = n;
              state.qty = 1;
              renderAll();
            });
            grid.appendChild(btn);
          })(n);
        }
        wrap.appendChild(grid);
      } else {
        var gbtn = document.createElement('button');
        gbtn.type = 'button';
        var isSel = state.category === zone.id;
        gbtn.className = 'venue-general-btn' + (isSel ? ' is-selected' : '');
        var lbl = document.createElement('span');
        lbl.className = 'venue-general-label';
        lbl.textContent = zone.availLabel;
        var action = document.createElement('span');
        action.className = 'venue-general-avail';
        action.textContent = isSel ? 'Seleccionada ✓' : 'Seleccionar zona';
        gbtn.appendChild(lbl);
        gbtn.appendChild(action);
        gbtn.addEventListener('click', function () {
          state.category = zone.id;
          state.tableId = null;
          state.qty = state.qty || 1;
          renderAll();
        });
        wrap.appendChild(gbtn);
      }

      return wrap;
    }

    function renderVenue() {
      els.venueMap.innerHTML = '';
      els.venueMap.appendChild(buildStage());
      EVENT.zones.forEach(function (zone) {
        els.venueMap.appendChild(buildZone(zone));
      });
    }

    function renderAll() {
      renderVenue();
      var zone = getZone(state.category);
      var isZoneType = !!zone && zone.type === 'zone';

      els.qtyRow.hidden = !isZoneType;
      els.qtyValue.textContent = state.qty;

      var subtotal = 0;
      if (zone) subtotal = zone.type === 'tables' ? zone.price : zone.price * state.qty;
      els.subtotalValue.textContent = fmt(subtotal);

      var cannotContinue = !zone || (zone.type === 'tables' && !state.tableId);
      els.goPaymentBtn.disabled = cannotContinue;

      var summary = zone
        ? (zone.type === 'tables' ? ('Mesa ' + state.tableId + ' · ' + zone.name) : (state.qty + ' × ' + zone.name))
        : '';
      if (els.summaryLine) els.summaryLine.textContent = summary;
      if (els.summaryPrice) els.summaryPrice.textContent = fmt(subtotal);
      if (els.summaryTotal) els.summaryTotal.textContent = fmt(subtotal);
      if (els.ticketSummary) els.ticketSummary.textContent = summary;
    }

    function showStep(step) {
      state.step = step;
      els.stepBooking.hidden = step !== 'booking';
      els.stepPayment.hidden = step !== 'payment';
      els.stepProcessing.hidden = step !== 'processing';
      els.stepConfirmation.hidden = step !== 'confirmation';
      if (els.bookingBody) els.bookingBody.scrollTop = 0;
    }

    function openModal() {
      modal.hidden = false;
      document.body.classList.add('modal-open');
      showStep('booking');
      renderAll();
    }

    function closeModal() {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    }

    function resetAndClose() {
      state.category = null;
      state.qty = 1;
      state.tableId = null;
      showStep('booking');
      renderAll();
      closeModal();
    }

    els.openBtns.forEach(function (btn) { btn.addEventListener('click', openModal); });
    els.closeBtn.addEventListener('click', closeModal);
    els.qtyDec.addEventListener('click', function () { state.qty = Math.max(1, state.qty - 1); renderAll(); });
    els.qtyInc.addEventListener('click', function () { state.qty = Math.min(8, state.qty + 1); renderAll(); });
    els.goPaymentBtn.addEventListener('click', function () {
      if (els.goPaymentBtn.disabled) return;
      showStep('payment');
    });
    els.backToBookingBtn.addEventListener('click', function () { showStep('booking'); });

    els.payBtn.addEventListener('click', function () {
      showStep('processing');
      setTimeout(function () {
        if (els.ticketEvent) els.ticketEvent.textContent = EVENT.shortTitle;
        if (els.ticketDate) els.ticketDate.textContent = EVENT.dateLabel;
        if (els.ticketCode) els.ticketCode.textContent = 'Código: ' + EVENT.code;
        showStep('confirmation');
      }, 1600);
    });

    els.backToDetailBtn.addEventListener('click', resetAndClose);

    renderAll();
  }

  window.ElBarto = { initAmbientAudio: initAmbientAudio, initBooking: initBooking };
})();
