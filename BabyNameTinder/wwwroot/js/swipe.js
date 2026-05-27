/**
 * swipe.js — Baby Name Tinder
 * Fluid drag/fling swipe with color overlay, velocity detection, and smooth animations.
 */
(function () {
    'use strict';

    const container = document.getElementById('cardContainer');
    if (!container) return;

    const allNamesEl = document.getElementById('remainingNames');
    const lastNameEl = document.getElementById('lastName');
    if (!allNamesEl) return;

    let names = JSON.parse(allNamesEl.value || '[]');
    const lastName = lastNameEl ? lastNameEl.value : '';

    const emojis = ['🌸', '⭐', '🌟', '✨', '🌿', '🦋', '🌈', '🍀', '🌙', '💫', '🌺', '🎀', '🦄', '🌻', '🍁'];
    function getEmoji(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
        return emojis[Math.abs(h) % emojis.length];
    }

    // ── State ──────────────────────────────────────────────────────────────────
    let isDragging = false;
    let startX = 0, startY = 0;
    let currentX = 0, currentY = 0;
    let velocityX = 0;
    let lastMoveX = 0, lastMoveTime = 0;
    let rafId = null;
    let topCard = null;
    let voting = false;

    const SWIPE_THRESHOLD = 90;   // px to count as a deliberate swipe
    const VELOCITY_THRESHOLD = 0.4; // px/ms — fast fling triggers swipe under distance threshold

    // ── Pointer events ─────────────────────────────────────────────────────────
    function getTopCard() { return container.querySelector('.name-card-top'); }

    function pointerDown(e) {
        if (voting) return;
        topCard = getTopCard();
        if (!topCard || !topCard.contains(e.target)) return;

        isDragging = true;
        const pt = e.touches ? e.touches[0] : e;
        startX = pt.clientX;
        startY = pt.clientY;
        currentX = 0;
        currentY = 0;
        velocityX = 0;
        lastMoveX = startX;
        lastMoveTime = Date.now();

        topCard.style.transition = 'none';
        topCard.style.cursor = 'grabbing';
        cancelAnimationFrame(rafId);
    }

    function pointerMove(e) {
        if (!isDragging || !topCard) return;

        const pt = e.touches ? e.touches[0] : e;
        const x = pt.clientX;
        const y = pt.clientY;
        const now = Date.now();
        const dt = now - lastMoveTime;

        // Velocity (exponential smoothing)
        if (dt > 0) {
            const rawVel = (x - lastMoveX) / dt;
            velocityX = velocityX * 0.7 + rawVel * 0.3;
        }
        lastMoveX = x;
        lastMoveTime = now;

        currentX = x - startX;
        currentY = y - startY;

        rafId = requestAnimationFrame(applyDragTransform);
    }

    function pointerUp() {
        if (!isDragging || !topCard) return;
        isDragging = false;
        topCard.style.cursor = '';
        cancelAnimationFrame(rafId);

        const didFling = Math.abs(velocityX) > VELOCITY_THRESHOLD && Math.sign(velocityX) === Math.sign(currentX);
        const didSwipe = Math.abs(currentX) >= SWIPE_THRESHOLD || didFling;

        if (didSwipe) {
            vote(currentX > 0);
        } else {
            snapBack();
        }
    }

    function applyDragTransform() {
        if (!topCard) return;
        const rotate = currentX * 0.07;
        topCard.style.transform = `translate(${currentX}px, ${currentY * 0.25}px) rotate(${rotate}deg)`;

        // Colour overlay
        const progress = Math.min(Math.abs(currentX) / SWIPE_THRESHOLD, 1);
        const overlay = topCard.querySelector('.card-overlay');
        const likeEl  = topCard.querySelector('.like-indicator');
        const passEl  = topCard.querySelector('.pass-indicator');

        if (currentX > 0) {
            overlay.style.background = `rgba(25,135,84,${progress * 0.25})`;
            likeEl.style.opacity = progress;
            passEl.style.opacity = 0;
        } else if (currentX < 0) {
            overlay.style.background = `rgba(220,53,69,${progress * 0.25})`;
            passEl.style.opacity = progress;
            likeEl.style.opacity = 0;
        } else {
            overlay.style.background = 'transparent';
            likeEl.style.opacity = 0;
            passEl.style.opacity = 0;
        }
    }

    function snapBack() {
        topCard.style.transition = 'transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        topCard.style.transform = 'translate(0,0) rotate(0deg)';
        const overlay = topCard.querySelector('.card-overlay');
        const likeEl  = topCard.querySelector('.like-indicator');
        const passEl  = topCard.querySelector('.pass-indicator');
        overlay.style.background = 'transparent';
        likeEl.style.opacity = 0;
        passEl.style.opacity = 0;
        topCard = null;
    }

    // Touch
    container.addEventListener('touchstart', pointerDown, { passive: true });
    document.addEventListener('touchmove',   pointerMove, { passive: true });
    document.addEventListener('touchend',    pointerUp);
    document.addEventListener('touchcancel', pointerUp);

    // Mouse
    container.addEventListener('mousedown', pointerDown);
    document.addEventListener('mousemove',  pointerMove);
    document.addEventListener('mouseup',    pointerUp);
    document.addEventListener('mouseleave', pointerUp);

    // ── Keyboard ───────────────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') triggerButtonVote(true);
        if (e.key === 'ArrowLeft')  triggerButtonVote(false);
    });

    // ── Buttons ────────────────────────────────────────────────────────────────
    const btnLike = document.getElementById('btnLike');
    const btnPass = document.getElementById('btnPass');
    if (btnLike) btnLike.addEventListener('click', () => triggerButtonVote(true));
    if (btnPass) btnPass.addEventListener('click', () => triggerButtonVote(false));

    /** Animate a button press: card leans then flies off */
    async function triggerButtonVote(liked) {
        if (voting || names.length === 0) return;
        const card = getTopCard();
        if (!card) return;

        // Quick lean in the direction
        card.style.transition = 'transform 0.12s ease-out';
        card.style.transform = liked
            ? 'translateX(18px) rotate(4deg)'
            : 'translateX(-18px) rotate(-4deg)';

        // Show indicator immediately
        const overlay = card.querySelector('.card-overlay');
        const likeEl  = card.querySelector('.like-indicator');
        const passEl  = card.querySelector('.pass-indicator');
        overlay.style.background = liked ? 'rgba(25,135,84,0.2)' : 'rgba(220,53,69,0.2)';
        if (liked) { likeEl.style.opacity = 1; passEl.style.opacity = 0; }
        else       { passEl.style.opacity = 1; likeEl.style.opacity = 0; }

        await delay(120);
        vote(liked);
    }

    // ── Vote ───────────────────────────────────────────────────────────────────
    async function vote(liked) {
        if (voting || names.length === 0) return;
        const card = getTopCard();
        if (!card) return;

        voting = true;
        const name = card.dataset.name;

        // Fly the card off screen
        const flyX  = liked ? '130%' : '-130%';
        const flyRot = liked ? '25deg' : '-25deg';
        card.style.transition = 'transform 0.42s cubic-bezier(0.55, 0, 1, 0.45), opacity 0.35s ease';
        card.style.transform  = `translateX(${flyX}) rotate(${flyRot})`;
        card.style.opacity    = '0';

        // Remove from local list and pre-render the next back-card
        names.shift();
        if (names.length > 0) promoteCards();

        // POST to server (fire & forget — don't block the animation)
        fetch('/Swipe/Vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': getToken()
            },
            body: JSON.stringify({ name, liked })
        }).catch(err => console.error('Vote failed:', err));

        // Clean up after animation
        await delay(440);
        card.remove();
        updateProgress();
        if (names.length === 0) showAllDone();
        voting = false;
    }

    // ── Card management ────────────────────────────────────────────────────────
    function promoteCards() {
        const cards = Array.from(container.querySelectorAll('.name-card'));

        // Promote second card to top
        cards.forEach((c, i) => {
            c.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            if (i === 0) {
                c.classList.add('name-card-top');
                c.style.cursor = 'grab';
                c.style.transform = '';
            } else {
                const off = i * 9;
                const sc  = 1 - i * 0.04;
                c.style.transform = `translateY(${off}px) scale(${sc})`;
            }
        });

        // Append a new back card if we have enough names
        if (names.length >= 3) {
            const newCard = buildCard(names[2], 2);
            newCard.style.transform = 'translateY(18px) scale(0.92)';
            container.insertBefore(newCard, container.firstChild);
        }
    }

    function buildCard(name, stackIndex) {
        const div = document.createElement('div');
        div.className = 'name-card' + (stackIndex === 0 ? ' name-card-top' : '');
        div.dataset.name = name;
        div.style.zIndex  = 10 - stackIndex;
        div.style.cursor  = stackIndex === 0 ? 'grab' : 'default';

        div.innerHTML = `
            <div class="card-overlay"></div>
            <div class="name-card-inner">
                <div class="name-card-emoji">${getEmoji(name)}</div>
                <h2 class="name-card-fullname">${esc(name)} ${esc(lastName)}</h2>
                <p class="name-card-firstname text-muted">${esc(name)}</p>
            </div>
            <div class="like-indicator">❤️ LIKE</div>
            <div class="pass-indicator">✕ NOPE</div>
        `;
        return div;
    }

    // ── Progress ───────────────────────────────────────────────────────────────
    let votedSoFar = (() => {
        const el = document.querySelector('.d-flex.justify-content-between span:first-child');
        return parseInt(el?.textContent ?? '0') || 0;
    })();
    const totalNames = (() => {
        const el = document.querySelector('.d-flex.justify-content-between span:first-child');
        const txt = el?.textContent ?? '';
        return parseInt(txt.split('of')[1]) || 0;
    })();

    function updateProgress() {
        votedSoFar++;
        const bar    = document.querySelector('.progress-bar');
        const label1 = document.querySelector('.d-flex.justify-content-between span:first-child');
        const label2 = document.querySelector('.d-flex.justify-content-between span:last-child');
        if (bar && totalNames > 0)
            bar.style.width = `${Math.round(votedSoFar / totalNames * 100)}%`;
        if (label1) label1.textContent = `${votedSoFar} of ${totalNames} names reviewed`;
        if (label2) label2.textContent = `${names.length} remaining`;
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
        document.querySelector('.action-buttons')?.remove();
        document.querySelector('.swipe-hint')?.remove();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────
    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    function getToken() {
        return document.querySelector('input[name="__RequestVerificationToken"]')?.value ?? '';
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // Match event from SignalR (layout.cshtml)
    document.addEventListener('nameMatch', (e) => {
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    });

})();
