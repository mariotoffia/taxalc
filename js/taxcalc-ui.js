/**
 * TaxUI — Delade UI-verktyg för skattekalkylator.
 * Exponeras som window.TaxUI.
 */
(function () {
    'use strict';

    /** Formatera tal som SEK-valuta. */
    function formatCurrency(value) {
        return Number(value).toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' });
    }

    /**
     * Generera delbar URL med alla fältvärden.
     * @param {Object<string, HTMLInputElement|HTMLSelectElement>} fieldMap
     * @returns {string} URL.
     */
    function generateLink(fieldMap) {
        var params = new URLSearchParams();
        Object.keys(fieldMap).forEach(function (key) {
            params.set(key, fieldMap[key].value);
        });
        return window.location.origin + window.location.pathname + '?' + params.toString();
    }

    /**
     * Ladda URL-parametrar till fält.
     * @param {Object<string, HTMLInputElement|HTMLSelectElement>} fieldMap
     */
    function loadFromURL(fieldMap) {
        var params = new URLSearchParams(window.location.search);
        Object.keys(fieldMap).forEach(function (key) {
            var val = params.get(key);
            if (val !== null) {
                fieldMap[key].value = val;
            }
        });
    }

    /**
     * Dela länk via Web Share API eller kopiera till urklipp.
     * @param {Object<string, HTMLInputElement|HTMLSelectElement>} fieldMap
     * @param {string} title
     * @param {HTMLElement} messageEl - Element för statusmeddelande.
     */
    function shareLink(fieldMap, title, messageEl) {
        var link = generateLink(fieldMap);

        if (messageEl) {
            messageEl.classList.remove('fade-out');
            messageEl.classList.add('hidden');
        }

        if (navigator.share && window.location.protocol !== 'file:') {
            navigator.share({
                title: title,
                text: 'Kolla beräkningen via denna länk:',
                url: link
            }).catch(function () { /* användaren avbröt */ });
        } else {
            navigator.clipboard.writeText(link).then(function () {
                showMessage(messageEl, 'Länk kopierad!', 'success');
            }).catch(function () {
                showMessage(messageEl, 'Kunde inte kopiera länk.', 'error');
            });
        }
    }

    /** Visa ett kort meddelande som tonar ut. */
    function showMessage(el, message, type) {
        if (!el) return;
        el.textContent = message;
        el.classList.remove('hidden', 'fade-out', 'bg-red-700', 'bg-gray-700');
        el.classList.add(type === 'success' ? 'bg-gray-700' : 'bg-red-700');

        setTimeout(function () { el.classList.add('fade-out'); }, 3000);
        setTimeout(function () { el.classList.add('hidden'); }, 15000);
    }

    /** Initiera Tippy.js-tooltips. */
    function initTippy() {
        if (typeof tippy === 'function') {
            tippy('.info-icon', {
                allowHTML: true,
                interactive: true,
                sticky: true,
                animation: 'scale',
                delay: [0, 100],
                duration: [300, 300],
                placement: 'right',
                theme: 'light-border'
            });
        }
    }

    /**
     * Koppla input-lyssnare som triggar beräkning.
     * @param {HTMLElement[]} inputs
     * @param {Function} calculateFn
     */
    function initInputListeners(inputs, calculateFn) {
        inputs.forEach(function (input) {
            if (input) input.addEventListener('input', calculateFn);
        });
    }

    /** Injicera info-ikon SVG-symbol i body via DOM-metoder. */
    function injectInfoIconSvg() {
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.style.display = 'none';

        var symbol = document.createElementNS(ns, 'symbol');
        symbol.setAttribute('id', 'info-icon');
        symbol.setAttribute('viewBox', '0 0 24 24');
        symbol.setAttribute('fill', 'none');
        symbol.setAttribute('stroke', 'currentColor');
        symbol.setAttribute('stroke-width', '2');
        symbol.setAttribute('stroke-linecap', 'round');
        symbol.setAttribute('stroke-linejoin', 'round');

        var circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '12');
        circle.setAttribute('r', '10');

        var line1 = document.createElementNS(ns, 'line');
        line1.setAttribute('x1', '12'); line1.setAttribute('y1', '16');
        line1.setAttribute('x2', '12'); line1.setAttribute('y2', '12');

        var line2 = document.createElementNS(ns, 'line');
        line2.setAttribute('x1', '12'); line2.setAttribute('y1', '8');
        line2.setAttribute('x2', '12.01'); line2.setAttribute('y2', '8');

        symbol.appendChild(circle);
        symbol.appendChild(line1);
        symbol.appendChild(line2);
        svg.appendChild(symbol);
        document.body.appendChild(svg);
    }

    window.TaxUI = {
        formatCurrency: formatCurrency,
        generateLink: generateLink,
        loadFromURL: loadFromURL,
        shareLink: shareLink,
        showMessage: showMessage,
        initTippy: initTippy,
        initInputListeners: initInputListeners,
        injectInfoIconSvg: injectInfoIconSvg
    };
})();
