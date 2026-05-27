/**
 * swipe.js — Baby Name Tinder
 * Fluid drag/fling swipe with color overlay, velocity detection, smooth animations,
 * and single-level undo.
 */
(function () {
    'use strict';

    const container = document.getElementById('cardContainer');
    if (!container) return;

    const allNamesEl = document.getElementById('remainingNames');
    const lastNameEl = document.getElementById('lastName');
    if (!allNamesEl) return;

    let names = JSON.parse(allNamesEl.value || '[]');
    const lastName     = lastNameEl ? lastNameEl.value : '';
    const nameRanks    = JSON.parse(document.getElementById('nameRanks')?.value    || '{}');
    const nameMeanings = JSON.parse(document.getElementById('nameMeanings')?.value || '{}');

    const emojis = ['🌸', '⭐', '🌟', '✨', '🌿', '🦋', '🌈', '🍀', '🌙', '💫', '🌺', '🎀', '🦄', '🌻', '🍁'];
    function getEmoji(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
        return emojis[Math.abs(h) % emojis.length];
    }

    function getPopularity(name) {
        const rank = nameRanks[name] ?? 999;
        if (rank <= 10)  return { label: '🔥 Top 10',      cls: 'pop-hot'     };
        if (rank <= 25)  return { label: '⭐ Top 25',      cls: 'pop-top'     };
        if (rank <= 75)  return { label: '💜 Popular',     cls: 'pop-popular' };
        if (rank <= 150) return { label: '🌿 Less Common', cls: 'pop-less'    };
        return                  { label: '✨ Rare',        cls: 'pop-rare'    };
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

    // Undo state
    let lastVote = null;          // { name, liked } of the most recent swipe
    let wasShowingAllDone = false; // true when showAllDone() replaced the stack

    const SWIPE_THRESHOLD   = 90;  // px
    const VELOCITY_THRESHOLD = 0.4; // px/ms

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
        if (e.key === 'z' || e.key === 'Z') triggerUndo();
    });

    // ── Buttons ────────────────────────────────────────────────────────────────
    const btnLike = document.getElementById('btnLike');
    const btnPass = document.getElementById('btnPass');
    const btnUndo = document.getElementById('btnUndo');
    if (btnLike) btnLike.addEventListener('click', () => triggerButtonVote(true));
    if (btnPass) btnPass.addEventListener('click', () => triggerButtonVote(false));
    if (btnUndo) btnUndo.addEventListener('click', () => triggerUndo());

    async function triggerButtonVote(liked) {
        if (voting || names.length === 0) return;
        const card = getTopCard();
        if (!card) return;

        card.style.transition = 'transform 0.12s ease-out';
        card.style.transform = liked
            ? 'translateX(18px) rotate(4deg)'
            : 'translateX(-18px) rotate(-4deg)';

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

        // Save for undo before we modify state
        lastVote = { name, liked };
        hideUndoButton();

        card.classList.remove('name-card-top');

        const flyX   = liked ? '130%' : '-130%';
        const flyRot = liked ? '25deg' : '-25deg';
        card.style.transition = 'transform 0.42s cubic-bezier(0.55, 0, 1, 0.45), opacity 0.35s ease';
        card.style.transform  = `translateX(${flyX}) rotate(${flyRot})`;
        card.style.opacity    = '0';

        names.shift();
        if (names.length > 0) promoteCards(card);

        fetch('/Swipe/Vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': getToken()
            },
            body: JSON.stringify({ name, liked })
        }).catch(err => console.error('Vote failed:', err));

        await delay(440);
        card.remove();
        votedSoFar++;
        renderProgress();

        if (names.length === 0) {
            showAllDone();
        } else {
            showUndoButton();
        }
        voting = false;
    }

    // ── Undo ───────────────────────────────────────────────────────────────────
    async function triggerUndo() {
        if (!lastVote || voting) return;

        voting = true;
        const { name, liked } = lastVote;
        lastVote = null;
        hideUndoButton();

        // Tell server to remove the vote (fire & forget)
        fetch('/Swipe/Undo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': getToken()
            },
            body: JSON.stringify({ name })
        }).catch(err => console.error('Undo failed:', err));

        // Restore name to front of queue
        names.unshift(name);
        votedSoFar = Math.max(0, votedSoFar - 1);

        // If the all-done screen was showing, restore the card area and action buttons
        if (wasShowingAllDone) {
            wasShowingAllDone = false;
            container.innerHTML = '';
            document.getElementById('actionButtons')?.classList.remove('d-none');
            document.getElementById('swipeHint')?.classList.remove('d-none');
        }

        // Remove any current DOM cards and rebuild the top-3 stack fresh
        Array.from(container.querySelectorAll('.name-card')).forEach(c => c.remove());

        const stackSize = Math.min(3, names.length);
        // Append back→front so the last appended (index 0) is the DOM top-child = top card
        for (let i = stackSize - 1; i >= 0; i--) {
            const card = buildCard(names[i], i);
            // Back cards get their stacked offset immediately (no transition yet)
            if (i > 0) {
                card.style.transition = 'none';
                card.style.transform  = `translateY(${i * 9}px) scale(${1 - i * 0.04})`;
            }
            container.appendChild(card);
        }

        // Animate the returning top card sliding back in from off-screen
        const returningCard = getTopCard();
        if (returningCard) {
            const startX   = liked ? '130%' : '-130%';
            const startRot = liked ? '25deg' : '-25deg';
            returningCard.style.transition = 'none';
            returningCard.style.transform  = `translateX(${startX}) rotate(${startRot})`;
            returningCard.style.opacity    = '0';
            returningCard.getBoundingClientRect(); // force reflow
            returningCard.style.transition = 'transform 0.42s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease';
            returningCard.style.transform  = 'translate(0,0) rotate(0deg)';
            returningCard.style.opacity    = '1';
        }

        renderProgress();
        await delay(440);
        voting = false;
    }

    // ── Card management ────────────────────────────────────────────────────────
    function promoteCards(flyingCard) {
        const remaining = Array.from(container.querySelectorAll('.name-card'))
            .filter(c => c !== flyingCard);

        if (remaining.length === 0) return;

        remaining.forEach((c, i) => {
            const stepsFromTop = remaining.length - 1 - i;
            c.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            c.style.zIndex = String(10 - stepsFromTop);

            if (stepsFromTop === 0) {
                c.classList.add('name-card-top');
                c.style.transform = '';
                c.style.cursor = 'grab';
            } else {
                c.style.transform = `translateY(${stepsFromTop * 9}px) scale(${1 - stepsFromTop * 0.04})`;
                c.style.cursor = 'default';
            }
        });

        if (names.length >= 3) {
            const stepsFromTop = remaining.length;
            const newCard = buildCard(names[2], stepsFromTop);
            newCard.style.zIndex     = String(10 - stepsFromTop);
            newCard.style.transform  = `translateY(${stepsFromTop * 9}px) scale(${1 - stepsFromTop * 0.04})`;
            container.insertBefore(newCard, container.firstChild);
        }
    }

    function buildCard(name, stackIndex) {
        const div = document.createElement('div');
        div.className = 'name-card' + (stackIndex === 0 ? ' name-card-top' : '');
        div.dataset.name = name;
        div.style.zIndex = 10 - stackIndex;
        div.style.cursor = stackIndex === 0 ? 'grab' : 'default';

        const pop     = getPopularity(name);
        const meaning = nameMeanings[name] || '';
        div.innerHTML = `
            <div class="card-overlay"></div>
            <div class="name-card-inner">
                <div class="name-card-emoji">${getEmoji(name)}</div>
                <h2 class="name-card-fullname">${esc(name)} ${esc(lastName)}</h2>
                <p class="name-card-firstname text-muted">${esc(name)}</p>
                ${meaning ? `<p class="name-card-meaning">${esc(meaning)}</p>` : ''}
                <span class="popularity-badge ${pop.cls}">${pop.label}</span>
            </div>
            <div class="like-indicator">❤️ LIKE</div>
            <div class="pass-indicator">✕ NOPE</div>
        `;
        return div;
    }

    // ── Progress ───────────────────────────────────────────────────────────────
    let votedSoFar = parseInt(document.getElementById('votedCount')?.value ?? '0') || 0;
    const totalNames = parseInt(document.getElementById('totalCount')?.value ?? '0') || 0;

    function renderProgress() {
        const bar    = document.getElementById('progressBar');
        const label1 = document.getElementById('progressLabel');
        const label2 = document.getElementById('remainingLabel');
        if (bar && totalNames > 0)
            bar.style.width = `${Math.round(votedSoFar / totalNames * 100)}%`;
        if (label1) label1.textContent = `${votedSoFar} of ${totalNames} names reviewed`;
        if (label2) label2.textContent = `${names.length} remaining`;
    }

    // ── All done ───────────────────────────────────────────────────────────────
    function showAllDone() {
        wasShowingAllDone = true;
        container.innerHTML = `
            <div class="empty-state text-center py-5">
                <div style="font-size:4rem">🎉</div>
                <h3 class="fw-bold mt-3">You've seen them all!</h3>
                <p class="text-muted">Check your matches to see what you and your partner both love.</p>
                <a href="/Match" class="btn btn-primary btn-lg mt-2">
                    <i class="bi bi-heart-fill"></i> View Matches
                </a>
            </div>`;
        // Hide (not remove) so undo can restore them
        document.getElementById('actionButtons')?.classList.add('d-none');
        document.getElementById('swipeHint')?.classList.add('d-none');
        // Still show undo so the user can take back the last swipe
        showUndoButton();
    }

    // ── Undo button visibility ─────────────────────────────────────────────────
    function showUndoButton() {
        const row = document.getElementById('undoRow');
        if (!row) return;
        row.classList.remove('d-none');
        row.classList.add('undo-pop');
        setTimeout(() => row.classList.remove('undo-pop'), 400);
    }

    function hideUndoButton() {
        document.getElementById('undoRow')?.classList.add('d-none');
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
    document.addEventListener('nameMatch', () => {
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    });

})();
