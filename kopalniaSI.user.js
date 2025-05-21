// ==UserScript==
// @name         Margonem Kopalnia SI
// @namespace    http://tampermonkey.net/
// @version      3.7
// @description  Flaga UA dla graczy bez dodatku + wysyłanie lootów na Discord
// @author       Kuchar
// @match        https://*.margonem.pl/*
// @exclude      https://margonem.pl/
// @updateURL    https://github.com/Oskirrix/Kopalnia83/raw/refs/heads/main/kopalnia83.user.js
// @downloadURL  https://github.com/Oskirrix/Kopalnia83/raw/refs/heads/main/kopalnia83.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- Zabezpieczenie przed błędem parseInput ---
    if (typeof parseInput !== 'function') {
        window.parseInput = function() {
            // Ta funkcja została dodana, aby zapobiec błędom ReferenceError.
            // Jeśli potrzebujesz własnej logiki, dodaj ją tutaj.
        };
    }

    // --- KONFIGURACJA ---
    const SERVER_URL = 'https://kopalnia83.onrender.com';
    const ukraineFlagURL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Flag_of_Ukraine.svg/24px-Flag_of_Ukraine.svg.png';
    const REGISTER_INTERVAL = 10 * 1000;
    const ACTIVE_CHECK_INTERVAL = 10 * 1000;
    const FLAG_UPDATE_INTERVAL = 16; // ~60 FPS (płynne flagi)

    // --- KONFIGURACJA DISCORD WEBHOOK ---
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1374483070010265631/8NcxnxFprvWY7f0XHV2ID6fxC15dNv-ssJMJLDZRy7_jBEjBfpXh2R4wcRqfC-LTJIVO';

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

    // --- MODUŁ LOOTÓW NA DISCORD ---
    function sendToDiscord(message) {
        fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({content: message})
        }).catch(e => console.error('Błąd wysyłania do Discord:', e));
    }

    function parseItemTip(tip) {
        if (!tip) return null;

        const decoded = tip.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

        const nameMatch = decoded.match(/<b class="item-name">([^<]+)<\/b>/);
        const name = nameMatch ? nameMatch[1] : 'Nieznany przedmiot';

        // Poprawne rozpoznawanie rzadkości po polsku i angielsku
        const isUnique = /class="unique".*unikat/i.test(decoded);
        const isHeroic = /class="heroic".*heroi/i.test(decoded);
        const isLegendary = /class="legendary".*legen/i.test(decoded);

        const typeMatch = decoded.match(/<span class="type-text">Typ:\s*([^<]+)<\/span>/);
        const type = typeMatch ? typeMatch[1].trim() : '';

        const amountMatch = decoded.match(/<span class="amount-text">Ilość:\s*(\d+)\s*<\/span>/);
        const amount = amountMatch ? amountMatch[1] : '1';

        let rarity = 'Zwykły';
        if (isLegendary) rarity = 'Legendarny';
        else if (isHeroic) rarity = 'Heroiczny';
        else if (isUnique) rarity = 'Unikatowy';

        return {
            name,
            rarity,
            type,
            amount
        };
    }

    function setupLootObserver() {
        function tryInit() {
            const lootsContainer = document.getElementById('loots');
            if (!lootsContainer) {
                console.warn('Nie znaleziono elementu #loots, ponawiam za 1s...');
                setTimeout(tryInit, 1000);
                return;
            }

            const sentLootIds = new Set();

            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (!(node instanceof HTMLElement)) return;

                        const lootWrappers = node.matches('.loot-wrapper') ? [node] : node.querySelectorAll('.loot-wrapper');
                        lootWrappers.forEach(lootWrapper => {
                            const lootId = lootWrapper.id || lootWrapper.querySelector('.item')?.id || null;
                            if (!lootId) return;

                            if (sentLootIds.has(lootId)) return;
                            sentLootIds.add(lootId);

                            const itemDiv = lootWrapper.querySelector('.item');
                            if (!itemDiv) return;

                            const itemInfo = parseItemTip(itemDiv.getAttribute('tip') || itemDiv.getAttribute('ctip'));
                            if (!itemInfo) return;

                            // Pomijaj tylko zwykłe looty (common)
                            if (itemInfo.rarity === 'Zwykły') return;

                            const playerName = getPlayerName() || 'Nieznany gracz';
                            const time = new Date().toLocaleTimeString();

                            const message = `[${time}] ${playerName} zdobył: **${itemInfo.name}** (${itemInfo.rarity}) x${itemInfo.amount} - Typ: ${itemInfo.type}`;

                            console.log('Wysyłam loot na Discord:', message);
                            sendToDiscord(message);
                        });
                    });
                });
            });

            observer.observe(lootsContainer, {childList: true, subtree: true});
            console.log('Logger lootów Margonem uruchomiony - nasłuchuję nowych lootów w #loots');
        }
        tryInit();
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

    // --- URUCHOM OBSERWATOR LOOTÓW ---
    setupLootObserver();

})();
