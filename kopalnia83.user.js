// ==UserScript==
// @name         Margonem Kopalnia
// @namespace    http://tampermonkey.net/
// @version      3.5
// @description  Flaga UA dla graczy bez dodatku
// @author       Kuchar
// @match        https://*.margonem.pl/*
// @exclude      https://margonem.pl/
// @updateURL    https://github.com/Oskirrix/Kopalnia83/raw/refs/heads/main/kopalnia83.user.js
// @downloadURL  https://github.com/Oskirrix/Kopalnia83/raw/refs/heads/main/kopalnia83.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- KONFIGURACJA ---
    const SERVER_URL = 'https://kopalnia83.onrender.com';
    const ukraineFlagURL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Flag_of_Ukraine.svg/24px-Flag_of_Ukraine.svg.png';
    const REGISTER_INTERVAL = 10 * 1000; // Rejestracja co 10 sekund
    const ACTIVE_CHECK_INTERVAL = 10 * 1000; // Lista aktywnych co 10sek
    const FLAG_UPDATE_INTERVAL = 100; // Aktualizacja flag co 500ms (zamiast 100ms)

    // --- ZMIENNE GLOBALNE ---
    let lastActiveNicks = [];
    let mapContainer = null;

    // --- REJESTRACJA NA BACKENDZIE ---
    function getPlayerName() {
        let nickElem = document.querySelector('#nick');
        return nickElem ? nickElem.textContent.trim() : null;
    }

    function registerAddon() {
        const nick = getPlayerName();
        if (!nick) return;

        fetch(`${SERVER_URL}/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nick})
        }).catch(e => console.error('[KopalniaAddon] Błąd rejestracji:', e));
    }

    // --- POBIERANIE LISTY AKTYWNYCH ---
    async function updateActiveNicks() {
        try {
            const response = await fetch(`${SERVER_URL}/active`);
            if (!response.ok) throw new Error('Błąd pobierania listy aktywnych');
            lastActiveNicks = await response.json();
        } catch (e) {
            console.error('[KopalniaAddon] Błąd aktywnych:', e);
        }
    }

    // --- FUNKCJA RYSUJĄCA FLAGI ---
    function drawFlags() {
        // Znajdź kontener mapy
        if (!mapContainer) {
            const selectors = ['#game', '#map', '.map', '#ground', '.ground', '#battle', '.battle', 'body'];
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) { mapContainer = el; break; }
            }
            if (!mapContainer) mapContainer = document.body;
        }

        // Usuń stare flagi
        document.querySelectorAll('.addon-flag-ua').forEach(e => e.remove());

        const mapRect = mapContainer.getBoundingClientRect();

        // Dodaj flagi nad postaciami bez dodatku
        document.querySelectorAll('div.other[tip]').forEach(el => {
            const tipContent = el.getAttribute('tip');
            const nickMatch = tipContent?.match(/<b>([^<]+)<\/b>/);
            if (!nickMatch) return;
            const nick = nickMatch[1].trim();

            // Flaga tylko dla graczy bez dodatku
            let hasAddon = false;
            for (const activeNick of lastActiveNicks) {
                if (activeNick.toLowerCase().trim() === nick.toLowerCase().trim() ||
                    activeNick.toLowerCase().startsWith(nick.toLowerCase().split(' ')[0])) {
                    hasAddon = true;
                    break;
                }
            }

            if (!hasAddon) {
                const rect = el.getBoundingClientRect();
                let left = rect.left - mapRect.left + rect.width / 2;
                let top = rect.top - mapRect.top - 14;
                left = Math.max(0, Math.min(left, mapRect.width));
                top = Math.max(0, Math.min(top, mapRect.height));

                const flag = document.createElement('img');
                flag.src = ukraineFlagURL;
                flag.className = 'addon-flag-ua';
                flag.style.cssText = `
                    position: absolute;
                    left: ${left}px;
                    top: ${top}px;
                    width: 16px;
                    height: 11px;
                    pointer-events: none;
                    z-index: 9999;
                    transform: translateX(-50%);
                `;
                mapContainer.appendChild(flag);
            }
        });
    }

    // --- START ---
    console.log('[KopalniaAddon] Skrypt Margonem startuje');

    // Początkowa rejestracja i aktualizacja
    registerAddon();
    updateActiveNicks();

    // Interwały
    setInterval(registerAddon, REGISTER_INTERVAL);
    setInterval(updateActiveNicks, ACTIVE_CHECK_INTERVAL);
    setInterval(drawFlags, FLAG_UPDATE_INTERVAL);

    // Tylko najważniejsze zdarzenia
    window.addEventListener('resize', drawFlags);
})();
