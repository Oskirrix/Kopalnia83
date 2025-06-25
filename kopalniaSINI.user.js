// ==UserScript==
// @name         Kopalnia 83
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatycznie ładuje dodatek Margonem z podanego URL
// @match        https://*.margonem.pl/*
// @grant        none
// ==/UserScript==

(function() {
    const script = document.createElement('script');
    script.src = 'https://addons2.margonem.pl/get/153/153662dev.js';
    document.head.appendChild(script);
})();
