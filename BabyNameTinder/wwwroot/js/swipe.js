/**
 * swipe.js — Baby Name Tinder swipe logic
 * Handles drag/touch swipe on the top name card and button fallbacks.
 */

(function () {
    'use strict';

    const container = document.getElementById('cardContainer');
    if (!container) return;

    // All unvoted names (JSON array passed from server)
    const allNamesEl = document.getElementById('remainingNames');
    const lastNameEl = document.getElementById('lastName');
    if (!allNamesEl) return;

    let names = JSON.parse(allNamesEl.value || '[]');
    const lastName = lastNameEl ? lastNameEl.value : '';

    const emojis = ['🌸', '⭐', '🌟', '✨', '🌿', '🦋', '🌈', '🍀', '🌙', '💫', '🌺', '🎀', '🦄', '🌻', '🍁'];

    function getEmoji(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return emojis[Math.abs(hash) % emojis.length];
    }

    // ---- Swipe state ----
    let isDragging = false;
    let startX = 0, startY = 0;
    let currentX = 0;
    let topCard = null;
    const SWIPE_THRESHOLD = 80;

    function getTopCard() {
        return container.querySelector('.name-card-top');
    }

    function getLikeIndicator(card) { return card.querySelector('.like-indicator'); }
    function getPassIndicator(card) { return card.querySelector('.pass-indicator'); }

    // ---- Drag handlers ----
    function onPointerDown(e) {
        topCard = getTopCard();
        if (!topCard || !topCard.contains(e.target)) return;
        isDragging = true;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        currentX = 0;
        topCard.style.transition = 'none';
    }

    function onPointerMove(e) {
        if (!isDragging || !topCard) return;
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        currentX = x - startX;
        const currentY = y - startY;
        const rotate = currentX * 0.08;

        topCard.style.transform = `translate(${currentX}px, ${currentY * 0.3}px) rotate(${rotate}deg)`;

        // Show indicators
        const progress = Math.min(Math.abs(currentX) / SWIPE_THRESHOLD, 1);
        const likeEl = getLikeIndicator(topCard);
        const passEl = getPassIndicator(topCard);

        if (currentX > 0) {
            likeEl.style.opacity = progress;
            passEl.style.opacity = 0;
        } else {
            passEl.style.opacity = progress;
            likeEl.style.opacity = 0;
        }

        // Tilt background cards
        updateBackgroundCards();
    }

    function onPointerUp(e) {
        if (!isDragging || !topCard) return;
        isDragging = false;
        topCard.style.transition = '';

        if (Math.abs(currentX) >= SWIPE_THRESHOLD) {
            vote(currentX > 0);
        } else {
            // Snap back
            topCard.style.transform = '';
            getLikeIndicator(topCard).style.opacity = 0;
            getPassIndicator(topCard).style.opacity = 0;
        }
        topCard = null;
    }

    // Touch
    container.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('touchmove', onPointerMove, { passive: true });
    document.addEventListener('touchend', onPointerUp);

    // Mouse
    container.addEventListener('mousedown', onPointerDown);
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);

    // ---- Keyboard ----
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') vote(true);
        if (e.key === 'ArrowLeft') vote(false);
    });

    // ---- Buttons ----
    const btnLike = document.getElementById('btnLike');
    const btnPass = document.getElementById('btnPass');
    if (btnLike) btnLike.addEventListener('click', () => vote(true));
    if (btnPass) btnPass.addEventListener('click', () => vote(false));

    // ---- Voting ----
    let voting = false;

    async function vote(liked) {
        if (voting || names.length === 0) return;
        const card = getTopCard();
        if (!card) return;

        voting = true;
        const name = card.dataset.name;

        // Animate card out
        card.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
        if (liked) {
            getLikeIndicator(card).style.opacity = 1;
            card.style.transform = 'translateX(120%) rotate(20deg)';
        } else {
            getPassIndicator(card).style.opacity = 1;
            card.style.transform = 'translateX(-120%) rotate(-20deg)';
        }
        card.style.opacity = '0';

        // Remove first name from our list
        names.shift();

        // Build next card immediately
        if (names.length > 0) {
            addNextCard();
        }

        // POST vote to server
        try {
            await fetch('/Swipe/Vote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': getAntiForgeryToken()
                },
                body: JSON.stringify({ name, liked })
            });
        } catch (err) {
            console.error('Vote failed:', err);
        }

        // Remove the old card after animation
        setTimeout(() => {
            card.remove();
            updateBackgroundCards();
            updateProgress();
            if (names.length === 0) showAllDone();
            voting = false;
        }, 420);
    }

    function addNextCard() {
        // The card that was at index 1 is now becoming the top card
        const existingCards = container.querySelectorAll('.name-card');
        existingCards.forEach((c, i) => {
            c.style.transition = 'transform 0.3s ease';
            c.style.setProperty('--card-offset', `${i * 8}px`);
            if (i === 0) {
                c.classList.add('name-card-top');
                c.style.transform = '';
            }
        });

        // Add a new card at the back if we have more names
        const backIndex = existingCards.length; // how many cards will be showing after removal
        const nameIndex = backIndex; // next name to pre-render at the back
        if (nameIndex < names.length && backIndex < 3) {
            const name = names[nameIndex];
            const card = buildCard(name, backIndex);
            container.insertBefore(card, container.firstChild);
        }
    }

    function buildCard(name, index) {
        const div = document.createElement('div');
        div.className = 'name-card' + (index === 0 ? ' name-card-top' : '');
        div.dataset.name = name;
        div.dataset.index = index;
        div.style.zIndex = 10 - index;
        div.style.setProperty('--card-offset', `${index * 8}px`);

        div.innerHTML = `
            <div class="name-card-inner">
                <div class="name-card-emoji">${getEmoji(name)}</div>
                <h2 class="name-card-fullname">${escapeHtml(name)} ${escapeHtml(lastName)}</h2>
                <p class="name-card-firstname text-muted">${escapeHtml(name)}</p>
            </div>
            <div class="like-indicator text-success" style="opacity:0">❤️ Like</div>
            <div class="pass-indicator text-danger" style="opacity:0">✕ Pass</div>
        `;
        return div;
    }

    function updateBackgroundCards() {
        const cards = container.querySelectorAll('.name-card');
        cards.forEach((card, i) => {
            if (i === 0) return; // top card managed by drag
            const offset = i * 8;
            const scale = 1 - i * 0.03;
            card.style.transform = `translateY(${offset}px) scale(${scale})`;
        });
    }

    function updateProgress() {
        // Re-fetch progress bar if present
        const bar = document.querySelector('.progress-bar');
        const remaining = names.length;
        const total = parseInt(document.querySelector('.progress')?.parentElement?.querySelector('span:last-child')?.textContent ?? '0');
        if (bar) {
            const voted = parseInt(document.querySelector('.d-flex.justify-content-between span:first-child')?.textContent?.split(' ')[0] ?? '0') + 1;
            bar.style.width = `${total > 0 ? (voted / (voted + remaining) * 100) : 0}%`;
        }

        // Update remaining count label
        const spans = document.querySelectorAll('.d-flex.justify-content-between span');
        if (spans.length >= 2) {
            spans[1].textContent = `${remaining} remaining`;
        }
    }

    function showAllDone() {
        container.innerHTML = `
            <div class="empty-state text-center py-5">
                <div style="font-size:4rem">🎉</div>
                <h3 class="fw-bold mt-3">You've seen them all!</h3>
                <p class="text-muted">Check your matches to see what you and your partner both love.</p>
                <a href="/Match" class="btn btn-primary btn-lg mt-2">
                    <i class="bi bi-heart-fill"></i> View Matches
                </a>
            </div>`;
        const buttons = document.querySelector('.action-buttons');
        if (buttons) buttons.style.display = 'none';
        const hint = buttons?.nextElementSibling;
        if (hint) hint.style.display = 'none';
    }

    function getAntiForgeryToken() {
        return document.querySelector('input[name="__RequestVerificationToken"]')?.value ?? '';
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // Listen for match events from layout SignalR
    document.addEventListener('nameMatch', (e) => {
        // Could show inline match overlay in swipe page too
        console.log('Match!', e.detail);
    });

})();
