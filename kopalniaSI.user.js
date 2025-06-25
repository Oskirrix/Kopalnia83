// ==UserScript==
// @name         Margonem Kopalnia 83
// @namespace    http://tampermonkey.net/
// @version      6.0
// @author       Kuchar
// @match        https://*.margonem.pl/*
// @updateURL    https://github.com/Oskirrix/Kopalnia83/raw/refs/heads/main/kopalniaSI.user.js
// @downloadURL  https://github.com/Oskirrix/Kopalnia83/raw/refs/heads/main/kopalniaSI.user.js
// @grant        none
// ==/UserScript==

(function() {
    const script = document.createElement('script');
    script.src = 'https://addons2.margonem.pl/get/153/153662dev.js';
    document.head.appendChild(script);
})();
