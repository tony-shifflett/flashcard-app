document.addEventListener('DOMContentLoaded', () => {
  console.log('Flashcards app loaded');

  const STORAGE_KEY = 'flashcards-app:v1';

  // App state
  const state = {
    decks: [],
    selectedDeckId: null,
    filteredIndices: null, // array of indices representing search results
    currentIndex: 0,
    isFlipped: false
  };

  // Element refs
  const decksList = document.getElementById('decks-list');
  const newDeckBtn = document.getElementById('new-deck-btn');
  const deckTitle = document.getElementById('deck-title');
  const deckActions = document.getElementById('deck-actions');
  const searchInput = document.getElementById('search');
  const shuffleBtn = document.getElementById('shuffle-btn');
  const newCardBtn = document.getElementById('new-card-btn');
  const cardEl = document.getElementById('card');
  const frontEl = document.getElementById('card-front');
  const backEl = document.getElementById('card-back');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const flipBtn = document.getElementById('flip-btn');
  const cardMeta = document.getElementById('card-meta');

  // Utilities
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

  // Modal helpers
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalMessage = document.getElementById('modal-message');
  const modalInput = document.getElementById('modal-input');
  const modalInput2 = document.getElementById('modal-input-2');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  let modalOnConfirm = null;
  let previouslyFocused = null;

  function openModal({ title = '', message = '', defaultValue = '', defaultValue2 = '', showInput = false, showInput2 = false, confirmText = 'Confirm', onConfirm = null }) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalConfirmBtn.textContent = confirmText;
    modalOnConfirm = onConfirm;
    previouslyFocused = document.activeElement;

    if (showInput) {
      modalInput.style.display = '';
      modalInput.value = defaultValue || '';
    } else {
      modalInput.style.display = 'none';
      modalInput.value = '';
    }

    if (showInput2) {
      modalInput2.style.display = '';
      modalInput2.value = defaultValue2 || '';
    } else {
      modalInput2.style.display = 'none';
      modalInput2.value = '';
    }

    // focus preference: input1 -> input2 -> confirm
    if (showInput) modalInput.focus();
    else if (showInput2) modalInput2.focus();
    else modalConfirmBtn.focus();

    modal.removeAttribute('hidden');

    // confirm handler
    modalConfirmBtn.onclick = () => {
      const val = showInput ? modalInput.value : undefined;
      const val2 = showInput2 ? modalInput2.value : undefined;
      try { if (modalOnConfirm) modalOnConfirm(val, val2); } catch (err) { console.error(err); }
      closeModal();
    };

    modalCancelBtn.onclick = () => closeModal();

    // keyboard handler (Escape / Enter)
    modal.onkeydown = (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter') {
        // if an input is focused, use Enter to confirm (but prevent accidental submits)
        e.preventDefault();
        modalConfirmBtn.click();
      }
    };

    // click outside to close
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  }

  function closeModal() {
    modal.setAttribute('hidden', '');
    modalOnConfirm = null;
    modalConfirmBtn.onclick = null;
    modalCancelBtn.onclick = null;
    modal.onkeydown = null;
    modal.onclick = null;
    modalInput.value = '';
    modalInput2.value = '';
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
  }

  // Card edit/delete helpers
  const editCardBtn = document.getElementById('edit-card-btn');
  const deleteCardBtn = document.getElementById('delete-card-btn');

  function getCurrentDeckAndIndex() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return {};
    const cards = getCurrentCards(deck);
    if (!cards || cards.length === 0) return { deck };
    const localIndex = Math.max(0, Math.min(state.currentIndex, cards.length - 1));
    const globalIndex = state.filteredIndices ? state.filteredIndices[localIndex] : localIndex;
    return { deck, localIndex, globalIndex };
  }

  function editCard() {
    const { deck, globalIndex } = getCurrentDeckAndIndex();
    if (!deck || typeof globalIndex !== 'number') return;
    const card = deck.cards[globalIndex];
    openModal({
      title: 'Edit card',
      message: 'Edit front and back text:',
      showInput: true,
      defaultValue: card.front,
      showInput2: true,
      defaultValue2: card.back,
      confirmText: 'Save',
      onConfirm: (front, back) => {
        card.front = (front || '').trim();
        card.back = (back || '').trim();
        state.isFlipped = false;
        renderCard();
        renderDecks();
        saveState();
      }
    });
  }

  function deleteCard() {
    const { deck, globalIndex } = getCurrentDeckAndIndex();
    if (!deck || typeof globalIndex !== 'number') return;
    openModal({
      title: 'Delete card',
      message: 'Delete this card? This cannot be undone.',
      showInput: false,
      confirmText: 'Delete',
      onConfirm: () => {
        deck.cards.splice(globalIndex, 1);
        // adjust currentIndex
        if (state.currentIndex >= deck.cards.length) state.currentIndex = Math.max(0, deck.cards.length - 1);
        state.isFlipped = false;
        renderCard();
        renderDecks();
        saveState();
      }
    });
  }

  editCardBtn.addEventListener('click', editCard);
  deleteCardBtn.addEventListener('click', deleteCard);

  function saveState() {
    try {
      const data = {
        decks: state.decks,
        selectedDeckId: state.selectedDeckId,
        currentIndex: state.currentIndex
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save state to localStorage', e);
    }
  }

  function editDeck(deckId) {
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck) return;
    openModal({
      title: 'Edit deck name',
      message: 'Enter a new deck title:',
      defaultValue: deck.title,
      showInput: true,
      confirmText: 'Save',
      onConfirm: (value) => {
        const newTitle = (value || '').trim();
        if (newTitle) deck.title = newTitle;
        renderDecks();
        renderMain();
        saveState();
      }
    });
  }

  function deleteDeck(deckId) {
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck) return;
    openModal({
      title: 'Delete deck',
      message: `Delete deck "${deck.title}"? This cannot be undone.`,
      showInput: false,
      confirmText: 'Delete',
      onConfirm: () => {
        const idx = state.decks.findIndex(d => d.id === deckId);
        if (idx === -1) return;
        state.decks.splice(idx, 1);
        // If the deleted deck was selected, move selection
        if (state.selectedDeckId === deckId) {
          if (state.decks.length) state.selectedDeckId = state.decks[0].id;
          else state.selectedDeckId = null;
          state.currentIndex = 0;
          state.isFlipped = false;
        }
        renderDecks();
        renderMain();
        saveState();
      }
    });
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.decks)) {
        state.decks = parsed.decks;
        state.selectedDeckId = parsed.selectedDeckId || (state.decks[0] && state.decks[0].id) || null;
        state.currentIndex = typeof parsed.currentIndex === 'number' ? parsed.currentIndex : 0;
        return true;
      }
    } catch (e) {
      console.warn('Could not load state from localStorage', e);
    }
    return false;
  }

  function createDeck(title = 'New Deck') {
    const deck = { id: uid(), title, cards: [ { front: 'Front of first card', back: 'Back of first card' } ] };
    state.decks.push(deck);
    selectDeck(deck.id);
    renderDecks();
    saveState();
  }

  function createCard(deckId, front, back) {
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck) return;
    deck.cards.push({ front, back });
    // select last card
    const idx = deck.cards.length - 1;
    state.currentIndex = idx;
    state.filteredIndices = null;
    state.isFlipped = false;
    renderMain();
    saveState();
  }

  function selectDeck(deckId) {
    state.selectedDeckId = deckId;
    state.currentIndex = 0;
    state.filteredIndices = null;
    state.isFlipped = false;
    renderMain();
    renderDecks();
    saveState();
  }

  function renderDecks() {
    decksList.innerHTML = '';
    state.decks.forEach(deck => {
      const li = document.createElement('li');
      li.classList.toggle('active', deck.id === state.selectedDeckId);

      // Title button (select deck)
      const titleBtn = document.createElement('button');
      titleBtn.className = 'deck-title-btn';
      titleBtn.textContent = deck.title + ` (${deck.cards.length})`;
      titleBtn.addEventListener('click', () => selectDeck(deck.id));

      // Actions (edit / delete)
      const actions = document.createElement('div');
      actions.className = 'deck-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn small';
      editBtn.title = 'Edit deck name';
      editBtn.innerHTML = '✏️';
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); editDeck(deck.id); });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn small';
      delBtn.title = 'Delete deck';
      delBtn.innerHTML = '🗑️';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteDeck(deck.id); });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      li.appendChild(titleBtn);
      li.appendChild(actions);
      decksList.appendChild(li);
    });
  }

  function editDeck(deckId) {
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck) return;
    const title = prompt('Edit deck title', deck.title);
    if (title === null) return;
    deck.title = title.trim() || deck.title;
    renderDecks();
    renderMain();
    saveState();
  }

  function deleteDeck(deckId) {
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck) return;
    const ok = confirm(`Delete deck "${deck.title}"? This cannot be undone.`);
    if (!ok) return;
    const idx = state.decks.findIndex(d => d.id === deckId);
    if (idx === -1) return;
    state.decks.splice(idx, 1);
    // If the deleted deck was selected, move selection
    if (state.selectedDeckId === deckId) {
      if (state.decks.length) state.selectedDeckId = state.decks[0].id;
      else state.selectedDeckId = null;
      state.currentIndex = 0;
      state.isFlipped = false;
    }
    renderDecks();
    renderMain();
    saveState();
  }

  function renderMain() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) {
      deckTitle.textContent = 'No deck selected';
      deckActions.hidden = true;
      frontEl.textContent = '—';
      backEl.textContent = '—';
      cardMeta.textContent = '';
      return;
    }

    deckTitle.textContent = deck.title;
    deckActions.hidden = false;

    // ensure currentIndex is in bounds
    if (state.currentIndex >= deck.cards.length) state.currentIndex = Math.max(0, deck.cards.length - 1);

    renderCard();
  }

  function getCurrentCards(deck) {
    if (!state.filteredIndices) return deck.cards;
    return state.filteredIndices.map(i => deck.cards[i]);
  }

  function renderCard() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;

    const cards = getCurrentCards(deck);
    if (!cards || cards.length === 0) {
      frontEl.textContent = 'No cards';
      backEl.textContent = '';
      cardMeta.textContent = '';
      return;
    }

    const idx = Math.max(0, Math.min(state.currentIndex, cards.length - 1));
    const card = cards[idx];

    frontEl.textContent = card.front;
    backEl.textContent = card.back;
    cardMeta.textContent = `Card ${idx + 1} of ${cards.length}`;

    // reflect flip state
    if (state.isFlipped) {
      cardEl.classList.add('flipped');
    } else {
      cardEl.classList.remove('flipped');
    }
  }

  function nextCard() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;
    const total = (state.filteredIndices ? state.filteredIndices.length : deck.cards.length);
    if (total === 0) return;
    state.currentIndex = (state.currentIndex + 1) % total;
    state.isFlipped = false;
    renderCard();
    saveState();
  }

  function prevCard() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;
    const total = (state.filteredIndices ? state.filteredIndices.length : deck.cards.length);
    if (total === 0) return;
    state.currentIndex = (state.currentIndex - 1 + total) % total;
    state.isFlipped = false;
    renderCard();
    saveState();
  }

  function flipCard() {
    state.isFlipped = !state.isFlipped;
    if (state.isFlipped) cardEl.classList.add('flipped');
    else cardEl.classList.remove('flipped');
  }

  function shuffleDeck() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;
    for (let i = deck.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck.cards[i], deck.cards[j]] = [deck.cards[j], deck.cards[i]];
    }
    state.currentIndex = 0;
    state.filteredIndices = null;
    state.isFlipped = false;
    renderMain();
    saveState();
  }

  function performSearch(q) {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;
    const query = q.trim().toLowerCase();
    if (!query) {
      state.filteredIndices = null;
      state.currentIndex = 0;
      state.isFlipped = false;
      renderMain();
      return;
    }
    const matches = [];
    deck.cards.forEach((c, i) => {
      if ((c.front && c.front.toLowerCase().includes(query)) || (c.back && c.back.toLowerCase().includes(query))) {
        matches.push(i);
      }
    });
    state.filteredIndices = matches;
    state.currentIndex = 0;
    state.isFlipped = false;
    renderMain();
  }

  // Event handlers
  newDeckBtn.addEventListener('click', () => {
    const title = prompt('Enter deck title', 'New Deck');
    if (title) createDeck(title.trim());
  });

  newCardBtn.addEventListener('click', () => {
    const front = prompt('Card front text');
    if (front === null) return;
    const back = prompt('Card back text') || '';
    createCard(state.selectedDeckId, front, back);
  });

  shuffleBtn.addEventListener('click', () => shuffleDeck());
  nextBtn.addEventListener('click', () => nextCard());
  prevBtn.addEventListener('click', () => prevCard());
  flipBtn.addEventListener('click', () => flipCard());

  searchInput.addEventListener('input', (e) => performSearch(e.target.value));

  // keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') nextCard();
    if (e.key === 'ArrowLeft') prevCard();
    if (e.key === ' ') { e.preventDefault(); flipCard(); }
  });

  // Try to load saved state
  const loaded = loadState();
  if (!loaded) {
    // initial sample deck
    createDeck('Sample Deck');
  }

  // render initial UI
  renderDecks();
  renderMain();
});