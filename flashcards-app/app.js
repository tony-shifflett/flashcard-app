document.addEventListener('DOMContentLoaded', () => {
  console.log('Flashcards app loaded');

  const STORAGE_KEY = 'flashcards-app:v1';

  // App state
  const state = {
    decks: [],
    selectedDeckId: null,
    filteredIndices: null, // array of indices representing search results
    currentIndex: 0
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
    renderMain();
    saveState();
  }

  function selectDeck(deckId) {
    state.selectedDeckId = deckId;
    state.currentIndex = 0;
    state.filteredIndices = null;
    renderMain();
    renderDecks();
    saveState();
  }

  function renderDecks() {
    decksList.innerHTML = '';
    state.decks.forEach(deck => {
      const li = document.createElement('li');
      li.textContent = deck.title + ` (${deck.cards.length})`;
      li.dataset.id = deck.id;
      li.classList.toggle('active', deck.id === state.selectedDeckId);
      li.addEventListener('click', () => selectDeck(deck.id));
      decksList.appendChild(li);
    });
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

    // ensure card not flipped
    cardEl.classList.remove('flipped');
  }

  function nextCard() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;
    const total = (state.filteredIndices ? state.filteredIndices.length : deck.cards.length);
    if (total === 0) return;
    state.currentIndex = (state.currentIndex + 1) % total;
    renderCard();
    saveState();
  }

  function prevCard() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;
    const total = (state.filteredIndices ? state.filteredIndices.length : deck.cards.length);
    if (total === 0) return;
    state.currentIndex = (state.currentIndex - 1 + total) % total;
    renderCard();
    saveState();
  }

  function flipCard() {
    cardEl.classList.toggle('flipped');
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