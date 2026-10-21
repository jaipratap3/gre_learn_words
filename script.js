let allWords = [];
let words = []; // currently active words
let currentIndex = 0;
let mnemonicsMap = {};

const homeView = document.getElementById('home-view');
const flashcardView = document.getElementById('flashcard-view');
const partsGrid = document.getElementById('parts-grid');
const partTitle = document.getElementById('part-title');
const backBtn = document.getElementById('back-btn');

const flashcardContainer = document.getElementById('flashcard-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const counter = document.getElementById('counter');

// Search Elements
const wordSearchInput = document.getElementById('word-search');
const searchClearBtn = document.getElementById('search-clear-btn');
const searchDropdown = document.getElementById('search-dropdown');

async function loadWords() {
    try {
        const version = new Date().getTime();
        const response = await fetch(`words.json?v=${version}`);
        allWords = await response.json();
        
        try {
            const mResponse = await fetch(`mnemonics.json?v=${version}`);
            mnemonicsMap = await mResponse.json();
        } catch (e) {
            console.warn('Could not load mnemonics.json (it might be missing or empty).');
            mnemonicsMap = {};
        }
        
        if (allWords && allWords.length > 0) {
            renderHome();
        } else {
            partsGrid.innerHTML = '<div class="loading">No words found!</div>';
        }
    } catch (error) {
        console.error('Error loading words:', error);
        partsGrid.innerHTML = '<div class="loading">Error loading flashcards.<br>Make sure you are running a local server.</div>';
    }
}

function getPartLabel(part) {
    return isNaN(part) ? `${part}` : `Part ${part}`;
}

function renderHome() {
    const partsMap = {};
    allWords.forEach(w => {
        if (!partsMap[w.part]) partsMap[w.part] = 0;
        partsMap[w.part]++;
    });
    
    partsGrid.innerHTML = '';
    Object.keys(partsMap).sort((a,b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (isNaN(numA) && isNaN(numB)) return a.localeCompare(b);
        if (isNaN(numA)) return 1;
        if (isNaN(numB)) return -1;
        return numA - numB;
    }).forEach(part => {
        const card = document.createElement('div');
        card.className = 'part-card';
        card.innerHTML = `
            <h2>${getPartLabel(part)}</h2>
            <p>${partsMap[part]} Words</p>
        `;
        card.onclick = () => showModeModal(part);
        partsGrid.appendChild(card);
    });
}

let currentSelectedPart = null;
const modeModal = document.getElementById('mode-modal');
const modalPartName = document.getElementById('modal-part-name');
const closeModalBtn = document.getElementById('close-modal-btn');
const modeFlashcardsBtn = document.getElementById('mode-flashcards-btn');
const modeQuizBtn = document.getElementById('mode-quiz-btn');
const quizStart = document.getElementById('quiz-start');
const quizEnd = document.getElementById('quiz-end');

function showModeModal(partNum) {
    currentSelectedPart = partNum;
    modalPartName.textContent = getPartLabel(partNum);
    const maxWords = allWords.filter(w => w.part == partNum).length;
    quizStart.max = maxWords;
    quizEnd.max = maxWords;
    quizEnd.value = maxWords;
    quizStart.value = 1;
    modeModal.classList.remove('hidden');
}

closeModalBtn.addEventListener('click', () => {
    modeModal.classList.add('hidden');
});

modeFlashcardsBtn.addEventListener('click', () => {
    modeModal.classList.add('hidden');
    startFlashcards(currentSelectedPart);
});

function startFlashcards(partNum, targetWord = null) {
    words = allWords.filter(w => w.part == partNum);
    if (targetWord) {
        const targetIdx = words.findIndex(w => w.word.toUpperCase() === targetWord.toUpperCase());
        currentIndex = targetIdx !== -1 ? targetIdx : 0;
    } else {
        currentIndex = 0;
    }
    partTitle.textContent = getPartLabel(partNum);
    
    homeView.classList.add('hidden');
    flashcardView.classList.remove('hidden');
    
    renderCard();
}

// --- SEARCH FUNCTIONALITY ---
let activeSearchIndex = -1;

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlightMatch(text, query) {
    if (!text || !query) return escapeHtml(text || '');
    const cleanText = String(text);
    const lower = cleanText.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return escapeHtml(cleanText);
    
    const before = escapeHtml(cleanText.substring(0, idx));
    const match = escapeHtml(cleanText.substring(idx, idx + query.length));
    const after = escapeHtml(cleanText.substring(idx + query.length));
    return `${before}<mark style="background: rgba(250, 204, 21, 0.4); color: inherit; padding: 0 2px; border-radius: 2px;">${match}</mark>${after}`;
}

function handleSearch() {
    if (!wordSearchInput || !searchDropdown) return;
    const query = wordSearchInput.value.trim().toLowerCase();
    
    if (!query) {
        searchDropdown.classList.add('hidden');
        searchDropdown.innerHTML = '';
        if (searchClearBtn) searchClearBtn.classList.add('hidden');
        activeSearchIndex = -1;
        return;
    }
    
    if (searchClearBtn) searchClearBtn.classList.remove('hidden');
    
    const scoredMatches = [];
    allWords.forEach(w => {
        const wordStr = (w.word || '').toLowerCase();
        const descStr = (w.description || '').toLowerCase();
        const mnemStr = (mnemonicsMap[w.word.toUpperCase()] || '').toLowerCase();
        
        let score = 0;
        if (wordStr === query) {
            score = 100;
        } else if (wordStr.startsWith(query)) {
            score = 80;
        } else if (wordStr.includes(query)) {
            score = 60;
        } else if (mnemStr.includes(query)) {
            score = 40;
        } else if (descStr.includes(query)) {
            score = 20;
        }
        
        if (score > 0) {
            scoredMatches.push({ wordObj: w, score });
        }
    });
    
    scoredMatches.sort((a, b) => b.score - a.score || a.wordObj.word.localeCompare(b.wordObj.word));
    const results = scoredMatches.slice(0, 25);
    
    if (results.length === 0) {
        searchDropdown.innerHTML = `<div class="search-no-results">No matching words found for "<strong>${escapeHtml(query)}</strong>"</div>`;
        searchDropdown.classList.remove('hidden');
        activeSearchIndex = -1;
        return;
    }
    
    searchDropdown.innerHTML = '';
    activeSearchIndex = -1;
    
    results.forEach(({ wordObj }, idx) => {
        const item = document.createElement('div');
        item.className = 'search-item';
        item.dataset.index = idx;
        
        const hasMnemonic = !!mnemonicsMap[wordObj.word.toUpperCase()];
        const highlightedWord = highlightMatch(wordObj.word, query);
        const highlightedDesc = highlightMatch(wordObj.description, query);
        
        item.innerHTML = `
            <div class="search-item-header">
                <span class="search-item-word">
                    ${highlightedWord}
                    ${hasMnemonic ? '<span class="search-item-mnemonic-badge">💡 Mnemonic</span>' : ''}
                </span>
                <span class="search-item-badge">${getPartLabel(wordObj.part)} &bull; #${wordObj.num}</span>
            </div>
            <div class="search-item-desc">${highlightedDesc}</div>
        `;
        
        item.onclick = () => {
            selectSearchResult(wordObj);
        };
        
        searchDropdown.appendChild(item);
    });
    
    searchDropdown.classList.remove('hidden');
}

function selectSearchResult(wordObj) {
    if (searchDropdown) {
        searchDropdown.classList.add('hidden');
        searchDropdown.innerHTML = '';
    }
    if (wordSearchInput) wordSearchInput.value = '';
    if (searchClearBtn) searchClearBtn.classList.add('hidden');
    activeSearchIndex = -1;
    startFlashcards(wordObj.part, wordObj.word);
}

function updateActiveSearchItem(items) {
    items.forEach((item, idx) => {
        if (idx === activeSearchIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

if (wordSearchInput) {
    wordSearchInput.addEventListener('input', handleSearch);
    wordSearchInput.addEventListener('focus', () => {
        if (wordSearchInput.value.trim().length > 0) {
            handleSearch();
        }
    });
    
    wordSearchInput.addEventListener('keydown', (e) => {
        const items = searchDropdown ? searchDropdown.querySelectorAll('.search-item') : [];
        if (!items || items.length === 0 || searchDropdown.classList.contains('hidden')) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeSearchIndex = (activeSearchIndex + 1) % items.length;
            updateActiveSearchItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeSearchIndex = (activeSearchIndex - 1 + items.length) % items.length;
            updateActiveSearchItem(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeSearchIndex >= 0 && activeSearchIndex < items.length) {
                items[activeSearchIndex].click();
            } else if (items.length > 0) {
                items[0].click();
            }
        } else if (e.key === 'Escape') {
            searchDropdown.classList.add('hidden');
            activeSearchIndex = -1;
        }
    });
}

if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
        if (wordSearchInput) {
            wordSearchInput.value = '';
            handleSearch();
            wordSearchInput.focus();
        }
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        if (searchDropdown) searchDropdown.classList.add('hidden');
    }
});

backBtn.addEventListener('click', () => {
    flashcardView.classList.add('hidden');
    homeView.classList.remove('hidden');
    // Ensure card is flipped back to front
    const card = document.querySelector('.flashcard');
    if (card && card.classList.contains('flipped')) {
        card.classList.remove('flipped');
    }
});

function renderCard() {
    const wordObj = words[currentIndex];
    
    flashcardContainer.innerHTML = `
        <div class="flashcard" onclick="if(!event.target.closest('.translate-btn')) this.classList.toggle('flipped')">
            <div class="card-face card-front">
                <div class="word-number" style="position: absolute; top: 20px; left: 20px; color: var(--text-secondary); font-size: 0.9rem; font-weight: 600; text-transform: uppercase;">
                    ${getPartLabel(wordObj.part)} &bull; Word #${wordObj.num}
                </div>
                <h2>${wordObj.word}</h2>
                <button onclick="event.stopPropagation(); speakWordCard('${wordObj.word}')" class="translate-btn" style="position: absolute; bottom: 20px; border-radius: 20px; display: inline-flex; align-items: center; gap: 0.4rem;">
                    🔊 Pronounce
                </button>
            </div>
            <div class="card-face card-back">
                <div class="pos">${wordObj.pos}</div>
                <div class="description">${wordObj.description}</div>
                <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-top: 0.8rem;">
                    <button onclick="event.stopPropagation(); speakCardBack('${wordObj.word}')" class="translate-btn" style="background: rgba(139, 92, 246, 0.2); border-color: #a855f7; color: #c084fc; border-radius: 8px; display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 0;">
                        🔊 Speak Mnemonic &amp; Easy Meaning
                    </button>
                </div>
                ${mnemonicsMap[wordObj.word.toUpperCase()] ? `
                <div class="mnemonic-section" style="margin-top: 1rem; width: 100%;">
                    <button onclick="event.stopPropagation(); this.style.display='none'; this.nextElementSibling.style.display='block';" class="translate-btn" style="background: rgba(168, 85, 247, 0.2); border-color: #a855f7; color: #a855f7;">
                        💡 Show Mnemonic
                    </button>
                    <div style="display: none; padding: 1rem; background: rgba(168, 85, 247, 0.1); border-radius: 8px; border-left: 4px solid #a855f7; text-align: left; font-size: 0.95rem; margin-top: 0.5rem;">
                        <strong>Mnemonic:</strong> ${mnemonicsMap[wordObj.word.toUpperCase()]}
                    </div>
                </div>
                ` : ''}
                <button onclick="openTranslation(event, \`${wordObj.description.replace(/`/g, "'")}\`, \`${wordObj.word}\`)" class="translate-btn" style="margin-top: 1rem;">
                    Meaning & Translation
                </button>
            </div>
        </div>
    `;
    
    updateControls();
}

// Sidebar logic
const sidebar = document.getElementById('translation-sidebar');
const overlay = document.getElementById('sidebar-overlay');
const closeSidebarBtn = document.getElementById('close-sidebar');
const englishText = document.getElementById('english-text');
const synonymsText = document.getElementById('synonyms-text');
const translationText = document.getElementById('translation-text');
const sidebarWord = document.getElementById('sidebar-word');

async function openTranslation(e, text, word) {
    e.stopPropagation();
    sidebar.classList.remove('hidden');
    overlay.classList.remove('hidden');
    sidebarWord.textContent = `(${word})`;
    
    englishText.innerHTML = text;
    synonymsText.innerHTML = '<span style="color: var(--text-secondary)">Loading...</span>';
    translationText.innerHTML = '<span style="color: var(--text-secondary)">Translating...</span>';
    
    // Fetch Easy English Meaning (Definition)
    try {
        const defUrl = `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`;
        const defResponse = await fetch(defUrl);
        const defData = await defResponse.json();
        
        if (defData && defData.length > 0 && defData[0].defs) {
            // Defs come as array of "pos\tdefinition"
            const defs = defData[0].defs;
            // Get the first definition and strip the part-of-speech prefix (e.g. "adj\t")
            const cleanDef = defs[0].split('\t')[1] || defs[0];
            synonymsText.innerHTML = cleanDef;
        } else {
            synonymsText.innerHTML = 'Simple definition not found.';
        }
    } catch (err) {
        console.error(err);
        synonymsText.innerHTML = 'Error loading definition.';
    }

    // Fetch Hindi translation
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        let translated = '';
        if (data && data[0]) {
            data[0].forEach(chunk => {
                if (chunk[0]) translated += chunk[0];
            });
        }
        
        if (translated) {
            translationText.innerHTML = translated;
        } else {
            translationText.innerHTML = 'Translation not found.';
        }
    } catch (err) {
        console.error(err);
        translationText.innerHTML = 'Error fetching translation. Please try again later.';
    }
}

function closeSidebar() {
    sidebar.classList.add('hidden');
    overlay.classList.add('hidden');
}

closeSidebarBtn.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
});

// Theme Toggle Logic
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const themeText = document.getElementById('theme-text');
let isLightMode = false;

themeToggleBtn.addEventListener('click', () => {
    isLightMode = !isLightMode;
    if (isLightMode) {
        document.documentElement.classList.add('light-theme');
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Dark Mode';
    } else {
        document.documentElement.classList.remove('light-theme');
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light Mode';
    }
});

// Sidebar Resizing Logic
const resizer = document.getElementById('sidebar-resizer');
let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'ew-resize';
    e.preventDefault(); // Prevent text selection
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    // Set min and max width constraints
    if (newWidth > 300 && newWidth < window.innerWidth * 0.9) {
        sidebar.style.width = `${newWidth}px`;
    }
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = 'default';
    }
});

function updateControls() {
    counter.textContent = `${currentIndex + 1} / ${words.length}`;
    prevBtn.disabled = currentIndex === 0;
    prevBtn.style.opacity = currentIndex === 0 ? 0.5 : 1;
    prevBtn.style.cursor = currentIndex === 0 ? 'not-allowed' : 'pointer';
    
    nextBtn.disabled = currentIndex === words.length - 1;
    nextBtn.style.opacity = currentIndex === words.length - 1 ? 0.5 : 1;
    nextBtn.style.cursor = currentIndex === words.length - 1 ? 'not-allowed' : 'pointer';
}

prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
        currentIndex--;
        renderCard();
    }
});

nextBtn.addEventListener('click', () => {
    if (currentIndex < words.length - 1) {
        currentIndex++;
        renderCard();
    }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    // Ignore keydown if user is typing in the jump input
    if (e.target.id === 'jump-input') return;
    
    if (e.key === 'ArrowRight' || e.key === ' ') {
        if (currentIndex < words.length - 1) {
            currentIndex++;
            renderCard();
        }
    } else if (e.key === 'ArrowLeft') {
        if (currentIndex > 0) {
            currentIndex--;
            renderCard();
        }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const card = document.querySelector('.flashcard');
        if (card) card.classList.toggle('flipped');
    }
});

// Jump Logic
const jumpInput = document.getElementById('jump-input');
const jumpBtn = document.getElementById('jump-btn');

function jumpToWord() {
    const targetNum = parseInt(jumpInput.value, 10);
    if (!isNaN(targetNum) && targetNum >= 1 && targetNum <= words.length) {
        currentIndex = targetNum - 1;
        renderCard();
        jumpInput.value = '';
    } else {
        alert(`Please enter a valid word number between 1 and ${words.length}`);
    }
}

jumpBtn.addEventListener('click', jumpToWord);
jumpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        jumpToWord();
    }
});

// --- QUIZ MODE LOGIC ---
const quizView = document.getElementById('quiz-view');
const quizBackBtn = document.getElementById('quiz-back-btn');
const quizProgress = document.getElementById('quiz-progress');
const quizSentence = document.getElementById('quiz-sentence');
const quizOptions = document.getElementById('quiz-options');

let quizWords = [];
let quizIndex = 0;
let quizScore = 0;

modeQuizBtn.addEventListener('click', () => {
    modeModal.classList.add('hidden');
    
    // Get start and end limits
    let start = parseInt(quizStart.value, 10);
    let end = parseInt(quizEnd.value, 10);
    
    if (isNaN(start) || start < 1) start = 1;
    if (isNaN(end) || end < start) end = 150;
    
    // Filter words within the range
    const partWords = allWords.filter(w => w.part == currentSelectedPart);
    quizWords = partWords.slice(start - 1, end);
    
    // Shuffle the quiz words for randomness
    quizWords.sort(() => Math.random() - 0.5);
    
    quizIndex = 0;
    quizScore = 0;
    
    homeView.classList.add('hidden');
    quizView.classList.remove('hidden');
    
    renderQuizQuestion();
});

quizBackBtn.addEventListener('click', () => {
    quizView.classList.add('hidden');
    homeView.classList.remove('hidden');
});

function getMaskedSentence(wordObj) {
    const desc = wordObj.description;
    // Split by period to get sentences
    const sentences = desc.split('. ');
    
    // Try to find a sentence that contains the exact word (case insensitive)
    const regex = new RegExp(`\\b${wordObj.word}\\b(s|ed|ing|d|es)?`, 'i');
    let targetSentence = sentences.find(s => regex.test(s));
    
    if (targetSentence) {
        // Ensure the sentence ends with a period
        if (!targetSentence.endsWith('.')) targetSentence += '.';
        // Replace the word with a blank
        return targetSentence.replace(regex, '_________');
    }
    
    // Fallback: If no exact match found, just blank out the word in the description
    return desc.replace(regex, '_________');
}

function renderQuizQuestion() {
    if (quizIndex >= quizWords.length) {
        quizSentence.innerHTML = `Quiz Complete!<br><br>You scored ${quizScore} out of ${quizWords.length}!`;
        quizOptions.innerHTML = `<button class="quiz-btn" onclick="quizBackBtn.click()">Back to Home</button>`;
        quizProgress.textContent = `Completed`;
        return;
    }
    
    quizProgress.textContent = `Question ${quizIndex + 1} / ${quizWords.length}`;
    const correctWord = quizWords[quizIndex];
    
    quizSentence.textContent = getMaskedSentence(correctWord);
    
    // Generate Distractors (wrong options)
    const distractors = [];
    const partWords = allWords.filter(w => w.part == currentSelectedPart && w.word !== correctWord.word);
    
    while (distractors.length < 3 && partWords.length > 0) {
        const randomIndex = Math.floor(Math.random() * partWords.length);
        distractors.push(partWords[randomIndex]);
        partWords.splice(randomIndex, 1);
    }
    
    const options = [correctWord, ...distractors];
    // Shuffle options
    options.sort(() => Math.random() - 0.5);
    
    quizOptions.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'quiz-btn';
        btn.textContent = opt.word;
        btn.onclick = () => handleAnswer(btn, opt.word === correctWord.word, correctWord.word);
        quizOptions.appendChild(btn);
    });
}

function handleAnswer(btn, isCorrect, correctWordStr) {
    // Disable all buttons
    const allBtns = quizOptions.querySelectorAll('.quiz-btn');
    allBtns.forEach(b => {
        b.disabled = true;
        b.style.cursor = 'default';
        if (b.textContent === correctWordStr) {
            b.classList.add('correct');
        }
    });
    
    if (isCorrect) {
        quizScore++;
        btn.classList.add('correct');
    } else {
        btn.classList.add('incorrect');
    }
    
    setTimeout(() => {
        quizIndex++;
        renderQuizQuestion();
    }, 1500);
}

// --- MATCH MODE LOGIC ---
const modeMatchBtn = document.getElementById('mode-match-btn');
const matchView = document.getElementById('match-view');
const matchBackBtn = document.getElementById('match-back-btn');
const matchProgress = document.getElementById('match-progress');
const matchWordsCol = document.getElementById('match-words');
const matchSentencesCol = document.getElementById('match-sentences');
const matchNextBtn = document.getElementById('match-next-btn');

let matchAllWords = [];
let matchCurrentBatch = [];
let matchBatchIndex = 0;
const MATCH_BATCH_SIZE = 5;

let selectedWordBtn = null;
let selectedSentenceBtn = null;
let matchesFoundInBatch = 0;

modeMatchBtn.addEventListener('click', () => {
    modeModal.classList.add('hidden');
    
    // Get start and end limits
    let start = parseInt(quizStart.value, 10);
    let end = parseInt(quizEnd.value, 10);
    
    if (isNaN(start) || start < 1) start = 1;
    if (isNaN(end) || end < start) end = 150;
    
    const partWords = allWords.filter(w => w.part == currentSelectedPart);
    const wordsToUse = partWords.slice(start - 1, end);
    
    // Deep copy and shuffle the words for match mode
    matchAllWords = [...wordsToUse].sort(() => Math.random() - 0.5);
    matchBatchIndex = 0;
    
    homeView.classList.add('hidden');
    matchView.classList.remove('hidden');
    
    renderMatchBatch();
});

matchBackBtn.addEventListener('click', () => {
    matchView.classList.add('hidden');
    homeView.classList.remove('hidden');
});

matchNextBtn.addEventListener('click', () => {
    matchBatchIndex++;
    if (matchBatchIndex * MATCH_BATCH_SIZE >= matchAllWords.length) {
        matchWordsCol.innerHTML = '';
        matchSentencesCol.innerHTML = `<h3>Match Mode Complete!</h3>`;
        matchNextBtn.classList.add('hidden');
        matchProgress.textContent = "Finished";
        return;
    }
    renderMatchBatch();
});

function renderMatchBatch() {
    matchesFoundInBatch = 0;
    matchNextBtn.classList.add('hidden');
    selectedWordBtn = null;
    selectedSentenceBtn = null;
    
    const startIdx = matchBatchIndex * MATCH_BATCH_SIZE;
    matchCurrentBatch = matchAllWords.slice(startIdx, startIdx + MATCH_BATCH_SIZE);
    
    matchProgress.textContent = `Batch ${matchBatchIndex + 1} (Words ${startIdx + 1}-${startIdx + matchCurrentBatch.length} of ${matchAllWords.length})`;
    
    // Create words array and sentences array, then shuffle them independently
    const leftItems = [...matchCurrentBatch].sort(() => Math.random() - 0.5);
    const rightItems = [...matchCurrentBatch].sort(() => Math.random() - 0.5);
    
    matchWordsCol.innerHTML = '';
    leftItems.forEach(w => {
        const btn = document.createElement('button');
        btn.className = 'match-btn word-btn';
        btn.textContent = w.word;
        btn.dataset.word = w.word;
        btn.onclick = () => handleMatchSelect(btn, 'word');
        matchWordsCol.appendChild(btn);
    });
    
    matchSentencesCol.innerHTML = '';
    rightItems.forEach(w => {
        const btn = document.createElement('button');
        btn.className = 'match-btn sentence-btn';
        btn.textContent = getMaskedSentence(w);
        btn.dataset.word = w.word;
        btn.onclick = () => handleMatchSelect(btn, 'sentence');
        matchSentencesCol.appendChild(btn);
    });
}

function handleMatchSelect(btn, type) {
    // If clicking a button that's already correct, ignore
    if (btn.classList.contains('correct')) return;
    
    // Deselect previous if clicking same column
    if (type === 'word') {
        if (selectedWordBtn && selectedWordBtn !== btn) selectedWordBtn.classList.remove('selected');
        selectedWordBtn = btn;
    } else {
        if (selectedSentenceBtn && selectedSentenceBtn !== btn) selectedSentenceBtn.classList.remove('selected');
        selectedSentenceBtn = btn;
    }
    
    btn.classList.add('selected');
    
    // If both are selected, check match
    if (selectedWordBtn && selectedSentenceBtn) {
        checkMatch();
    }
}

function checkMatch() {
    const wordBtn = selectedWordBtn;
    const sentBtn = selectedSentenceBtn;
    const isMatch = wordBtn.dataset.word === sentBtn.dataset.word;
    
    // Temporarily lock selections
    selectedWordBtn = null;
    selectedSentenceBtn = null;
    
    if (isMatch) {
        wordBtn.classList.remove('selected');
        sentBtn.classList.remove('selected');
        wordBtn.classList.add('correct');
        sentBtn.classList.add('correct');
        matchesFoundInBatch++;
        
        if (matchesFoundInBatch === matchCurrentBatch.length) {
            matchNextBtn.classList.remove('hidden');
        }
    } else {
        wordBtn.classList.remove('selected');
        sentBtn.classList.remove('selected');
        wordBtn.classList.add('incorrect');
        sentBtn.classList.add('incorrect');
        
        setTimeout(() => {
            wordBtn.classList.remove('incorrect');
            sentBtn.classList.remove('incorrect');
        }, 800);
    }
}

// ============================================================
// AUDIO STUDY MODE (LISTEN & RECALL) LOGIC
// ============================================================
const audioView = document.getElementById('audio-view');
const audioBackBtn = document.getElementById('audio-back-btn');
const audioPartTitle = document.getElementById('audio-part-title');
const audioProgress = document.getElementById('audio-progress');

const modeAudioBtn = document.getElementById('mode-audio-btn');
const flashcardAudioBtn = document.getElementById('flashcard-audio-btn');

const audioStatusBadge = document.getElementById('audio-status-badge');
const audioStatusIcon = document.getElementById('audio-status-icon');
const audioStatusText = document.getElementById('audio-status-text');

const audioPartTag = document.getElementById('audio-part-tag');
const audioCurrentWord = document.getElementById('audio-current-word');
const audioPosTag = document.getElementById('audio-pos-tag');

const audioTimerBox = document.getElementById('audio-timer-box');
const audioTimerCircle = document.getElementById('audio-timer-circle');
const audioCountdownNum = document.getElementById('audio-countdown-num');
const audioRevealBtn = document.getElementById('audio-reveal-btn');

const audioRevealContent = document.getElementById('audio-reveal-content');
const audioMeaningText = document.getElementById('audio-meaning-text');
const audioEasyBox = document.getElementById('audio-easy-box');
const audioEasyText = document.getElementById('audio-easy-text');
const audioMnemonicBox = document.getElementById('audio-mnemonic-box');
const audioMnemonicText = document.getElementById('audio-mnemonic-text');

const audioPrevBtn = document.getElementById('audio-prev-btn');
const audioPlayPauseBtn = document.getElementById('audio-play-pause-btn');
const audioPlayIcon = document.getElementById('audio-play-icon');
const audioPlayText = document.getElementById('audio-play-text');
const audioReplayBtn = document.getElementById('audio-replay-btn');
const audioNextBtn = document.getElementById('audio-next-btn');

const audioDelaySelect = document.getElementById('audio-delay-select');
const audioSpeedSelect = document.getElementById('audio-speed-select');
const audioVoiceSelect = document.getElementById('audio-voice-select');
const audioSpeakMnemonic = document.getElementById('audio-speak-mnemonic');
const audioAutoAdvance = document.getElementById('audio-auto-advance');

let audioWords = [];
let audioIndex = 0;
let isAudioPlaying = false;
let audioTimerInterval = null;
let audioTimeoutId = null;
let currentPhase = 'IDLE'; // 'SPEAKING_WORD', 'RECALL_WAIT', 'SPEAKING_MEANING', 'PAUSED', 'COMPLETED'
let remainingRecallSeconds = 10;
let availableVoices = [];

// Cache for Easy English Explanations (Datamuse dictionary API / words.json)
const easyEnglishCache = {};

async function fetchEasyEnglish(word, wordObj) {
    if (!word) return '';
    const key = word.toUpperCase();
    if (easyEnglishCache[key]) {
        return easyEnglishCache[key];
    }

    // 1. Fetch from Datamuse dictionary API (which powers Meaning & Translation -> Easy English Explanation)
    try {
        const defUrl = `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`;
        const res = await fetch(defUrl);
        const data = await res.json();
        if (data && data.length > 0 && data[0].defs && data[0].defs.length > 0) {
            const defs = data[0].defs;
            const cleanDef = defs[0].split('\t')[1] || defs[0];
            if (cleanDef) {
                easyEnglishCache[key] = cleanDef;
                return cleanDef;
            }
        }
    } catch (e) {
        console.warn('Could not fetch definition from Datamuse:', e);
    }

    // 2. Fallback: check if wordObj has easy_english in words.json
    if (wordObj && wordObj.easy_english) {
        let clean = wordObj.easy_english.replace(/^Simple synonyms:\s*/i, '').trim();
        if (clean) {
            easyEnglishCache[key] = clean;
            return clean;
        }
    }

    // 3. Fallback: extract the concise first sentence from description
    if (wordObj && wordObj.description) {
        const firstSentence = wordObj.description.split('.')[0].trim();
        easyEnglishCache[key] = firstSentence ? `${firstSentence}.` : wordObj.description;
        return easyEnglishCache[key];
    }

    return '';
}

function getSelectedVoice() {
    if (availableVoices.length === 0 && 'speechSynthesis' in window) {
        availableVoices = window.speechSynthesis.getVoices() || [];
    }
    const selectedVoiceName = audioVoiceSelect ? audioVoiceSelect.value : '';
    if (selectedVoiceName && availableVoices.length > 0) {
        const found = availableVoices.find(v => v.name === selectedVoiceName);
        if (found) return found;
    }
    // Default to Jasper (en-IN)
    const jasper = availableVoices.find(v => /jasper/i.test(v.name));
    if (jasper) return jasper;
    // Fallback to any en-IN / India voice (e.g. Aman, Rishi, Neerja, Google en-IN)
    const enIn = availableVoices.find(v => /en[-_]in/i.test(v.lang) || /india/i.test(v.name));
    if (enIn) return enIn;
    // Fallback to any English voice
    return availableVoices.find(v => v.lang && v.lang.toLowerCase().startsWith('en')) || availableVoices[0] || null;
}

function populateVoices() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;
    availableVoices = voices;

    if (!audioVoiceSelect) return;
    const previousSelection = audioVoiceSelect.value;
    audioVoiceSelect.innerHTML = '';

    const englishVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    const list = englishVoices.length > 0 ? englishVoices : voices;

    // Prioritize Jasper (en-IN) as default voice
    let defaultVoice = list.find(v => /jasper/i.test(v.name));
    if (!defaultVoice) {
        // Fallback to Indian English (en-IN)
        defaultVoice = list.find(v => /en[-_]in/i.test(v.lang) || /india/i.test(v.name));
    }
    if (!defaultVoice) {
        defaultVoice = list.find(v => /samantha|daniel|alex|natural/i.test(v.name)) || list[0];
    }

    list.forEach(v => {
        const option = document.createElement('option');
        option.value = v.name;
        option.textContent = `${v.name} (${v.lang})`;

        if (previousSelection) {
            if (v.name === previousSelection) option.selected = true;
        } else if (defaultVoice && v.name === defaultVoice.name) {
            option.selected = true;
        }
        audioVoiceSelect.appendChild(option);
    });
}

if ('speechSynthesis' in window) {
    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;
}

function cleanTextForSpeech(text) {
    if (!text) return '';
    return text
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/<[^>]*>/g, '')
        .replace(/[*_#~`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function stopAudioTimersAndSpeech() {
    if (audioTimerInterval) {
        clearInterval(audioTimerInterval);
        audioTimerInterval = null;
    }
    if (audioTimeoutId) {
        clearTimeout(audioTimeoutId);
        audioTimeoutId = null;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

function updateAudioStatus(badgeClass, icon, text) {
    if (!audioStatusBadge) return;
    audioStatusBadge.className = `audio-status-badge ${badgeClass}`;
    if (audioStatusIcon) audioStatusIcon.textContent = icon;
    if (audioStatusText) audioStatusText.textContent = text;
}

function setPlayPauseUI(isPlaying) {
    isAudioPlaying = isPlaying;
    if (audioPlayIcon && audioPlayText) {
        audioPlayIcon.textContent = isPlaying ? '⏸' : '▶';
        audioPlayText.textContent = isPlaying ? 'Pause' : 'Play';
    }
}

function speakSpeech(text, onEndCallback) {
    if (!('speechSynthesis' in window)) {
        if (onEndCallback && isAudioPlaying) onEndCallback();
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const speed = parseFloat(audioSpeedSelect ? audioSpeedSelect.value : '1') || 1;
    utterance.rate = speed;

    const voice = getSelectedVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
        if (onEndCallback && isAudioPlaying) {
            onEndCallback();
        }
    };

    utterance.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        if (onEndCallback && isAudioPlaying) {
            onEndCallback();
        }
    };

    window.speechSynthesis.speak(utterance);
}

// Flashcard study mode audio triggers
function speakWordCard(word) {
    if (!word) return;
    speakSpeech(word);
}

async function speakCardBack(word) {
    const wordObj = words.find(w => w.word.toUpperCase() === word.toUpperCase()) || words[currentIndex];
    const mnemonic = mnemonicsMap[word.toUpperCase()] || '';
    const easyEnglish = await fetchEasyEnglish(word, wordObj);

    let parts = [];
    if (mnemonic) {
        parts.push(`Mnemonic: ${cleanTextForSpeech(mnemonic)}`);
    }
    if (easyEnglish) {
        parts.push(`Easy English explanation: ${cleanTextForSpeech(easyEnglish)}`);
    } else if (wordObj && wordObj.description) {
        parts.push(`Meaning: ${cleanTextForSpeech(wordObj.description)}`);
    }

    speakSpeech(parts.join('. '));
}

function playAudioWord(index) {
    stopAudioTimersAndSpeech();

    if (index < 0) index = 0;
    if (index >= audioWords.length) {
        currentPhase = 'COMPLETED';
        updateAudioStatus('done', '🎉', 'All Words Finished!');
        setPlayPauseUI(false);
        return;
    }

    audioIndex = index;
    const wordObj = audioWords[audioIndex];
    const mnemonic = mnemonicsMap[wordObj.word.toUpperCase()] || '';

    // Start background prefetch of easy English definition right away so it is ready
    fetchEasyEnglish(wordObj.word, wordObj);

    // Update UI elements
    audioProgress.textContent = `Word ${audioIndex + 1} of ${audioWords.length}`;
    audioPartTag.textContent = `${getPartLabel(wordObj.part)} • #${wordObj.num}`;
    audioCurrentWord.textContent = wordObj.word;
    audioPosTag.textContent = wordObj.pos || '';

    audioMeaningText.textContent = wordObj.description;
    if (audioEasyText) {
        audioEasyText.textContent = 'Loading explanation...';
    }
    if (mnemonic) {
        audioMnemonicText.textContent = mnemonic;
        audioMnemonicBox.classList.remove('hidden');
    } else {
        audioMnemonicBox.classList.add('hidden');
    }

    // Reset countdown display
    const delaySec = parseInt(audioDelaySelect ? audioDelaySelect.value : '10', 10) || 10;
    remainingRecallSeconds = delaySec;
    audioCountdownNum.textContent = remainingRecallSeconds;
    audioTimerCircle.classList.remove('active-pulse');
    audioTimerBox.classList.remove('hidden');
    audioRevealContent.classList.add('hidden');

    if (!isAudioPlaying) {
        currentPhase = 'PAUSED';
        updateAudioStatus('paused', '⏸', 'Paused - Click Play to start');
        return;
    }

    // Phase 1: Speak the Word
    currentPhase = 'SPEAKING_WORD';
    updateAudioStatus('speaking', '🔊', `Speaking: "${wordObj.word}"`);

    speakSpeech(wordObj.word, () => {
        startRecallCountdown();
    });
}

function startRecallCountdown() {
    currentPhase = 'RECALL_WAIT';
    updateAudioStatus('waiting', '⏳', `Recall meaning! (${remainingRecallSeconds}s)`);
    audioTimerCircle.classList.add('active-pulse');

    audioTimerInterval = setInterval(() => {
        if (!isAudioPlaying) return;

        remainingRecallSeconds--;
        audioCountdownNum.textContent = Math.max(0, remainingRecallSeconds);

        if (remainingRecallSeconds <= 0) {
            clearInterval(audioTimerInterval);
            audioTimerInterval = null;
            revealAndSpeakMeaning();
        } else {
            updateAudioStatus('waiting', '⏳', `Recall meaning! (${remainingRecallSeconds}s)`);
        }
    }, 1000);
}

async function revealAndSpeakMeaning() {
    if (audioTimerInterval) {
        clearInterval(audioTimerInterval);
        audioTimerInterval = null;
    }

    currentPhase = 'SPEAKING_MEANING';
    audioTimerCircle.classList.remove('active-pulse');
    audioRevealContent.classList.remove('hidden');

    const wordObj = audioWords[audioIndex];
    const mnemonic = mnemonicsMap[wordObj.word.toUpperCase()] || '';
    const shouldSpeakMnemonic = audioSpeakMnemonic ? audioSpeakMnemonic.checked : true;

    updateAudioStatus('speaking', '📖', 'Speaking Mnemonic & Easy Meaning...');

    // Retrieve Easy English Explanation
    const easyEnglish = await fetchEasyEnglish(wordObj.word, wordObj);
    if (audioEasyText) {
        audioEasyText.textContent = easyEnglish || 'No simple explanation available.';
    }

    // Build speech string: Mnemonic first, then easy English explanation!
    let speechParts = [];

    if (mnemonic && shouldSpeakMnemonic) {
        speechParts.push(`Mnemonic: ${cleanTextForSpeech(mnemonic)}`);
    }

    if (easyEnglish) {
        speechParts.push(`Easy English explanation: ${cleanTextForSpeech(easyEnglish)}`);
    } else if (wordObj.description) {
        speechParts.push(`Meaning: ${cleanTextForSpeech(wordObj.description)}`);
    }

    const fullSpeechText = speechParts.join('. ');

    speakSpeech(fullSpeechText, () => {
        updateAudioStatus('done', '✅', 'Word Finished');
        const autoAdvance = audioAutoAdvance ? audioAutoAdvance.checked : true;

        if (autoAdvance && isAudioPlaying) {
            audioTimeoutId = setTimeout(() => {
                if (isAudioPlaying) {
                    playAudioWord(audioIndex + 1);
                }
            }, 1800);
        } else {
            setPlayPauseUI(false);
        }
    });
}

function startAudioMode(partNum, startWordNum = null, endWordNum = null, specificWord = null) {
    const partWords = allWords.filter(w => w.part == partNum);
    if (!partWords || partWords.length === 0) return;

    if (startWordNum && endWordNum) {
        audioWords = partWords.slice(startWordNum - 1, endWordNum);
    } else {
        audioWords = [...partWords];
    }

    if (specificWord) {
        const foundIdx = audioWords.findIndex(w => w.word.toUpperCase() === specificWord.toUpperCase());
        audioIndex = foundIdx !== -1 ? foundIdx : 0;
    } else {
        audioIndex = 0;
    }

    audioPartTitle.textContent = `Audio Study • ${getPartLabel(partNum)}`;
    homeView.classList.add('hidden');
    flashcardView.classList.add('hidden');
    if (quizView) quizView.classList.add('hidden');
    if (matchView) matchView.classList.add('hidden');
    audioView.classList.remove('hidden');

    populateVoices();
    setPlayPauseUI(true);
    playAudioWord(audioIndex);
}

// Audio Mode Event Listeners
if (modeAudioBtn) {
    modeAudioBtn.addEventListener('click', () => {
        modeModal.classList.add('hidden');
        let start = parseInt(quizStart.value, 10);
        let end = parseInt(quizEnd.value, 10);
        if (isNaN(start) || start < 1) start = 1;
        if (isNaN(end) || end < start) end = 150;
        startAudioMode(currentSelectedPart, start, end);
    });
}

if (flashcardAudioBtn) {
    flashcardAudioBtn.addEventListener('click', () => {
        const currentWord = words[currentIndex] ? words[currentIndex].word : null;
        startAudioMode(currentSelectedPart || (words[0] ? words[0].part : 1), null, null, currentWord);
    });
}

if (audioBackBtn) {
    audioBackBtn.addEventListener('click', () => {
        stopAudioTimersAndSpeech();
        isAudioPlaying = false;
        audioView.classList.add('hidden');
        homeView.classList.remove('hidden');
    });
}

if (audioPlayPauseBtn) {
    audioPlayPauseBtn.addEventListener('click', () => {
        if (isAudioPlaying) {
            // Pause action
            setPlayPauseUI(false);
            if (currentPhase === 'RECALL_WAIT') {
                if (audioTimerInterval) {
                    clearInterval(audioTimerInterval);
                    audioTimerInterval = null;
                }
                updateAudioStatus('paused', '⏸', `Paused during recall (${remainingRecallSeconds}s left)`);
            } else if (currentPhase === 'SPEAKING_WORD' || currentPhase === 'SPEAKING_MEANING') {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                }
                updateAudioStatus('paused', '⏸', 'Paused');
            }
        } else {
            // Play / Resume action
            setPlayPauseUI(true);
            if (currentPhase === 'RECALL_WAIT') {
                startRecallCountdown();
            } else if (currentPhase === 'SPEAKING_MEANING') {
                revealAndSpeakMeaning();
            } else {
                playAudioWord(audioIndex);
            }
        }
    });
}

if (audioRevealBtn) {
    audioRevealBtn.addEventListener('click', () => {
        stopAudioTimersAndSpeech();
        isAudioPlaying = true;
        setPlayPauseUI(true);
        revealAndSpeakMeaning();
    });
}

if (audioReplayBtn) {
    audioReplayBtn.addEventListener('click', () => {
        isAudioPlaying = true;
        setPlayPauseUI(true);
        playAudioWord(audioIndex);
    });
}

if (audioPrevBtn) {
    audioPrevBtn.addEventListener('click', () => {
        if (audioIndex > 0) {
            isAudioPlaying = true;
            setPlayPauseUI(true);
            playAudioWord(audioIndex - 1);
        }
    });
}

if (audioNextBtn) {
    audioNextBtn.addEventListener('click', () => {
        if (audioIndex < audioWords.length - 1) {
            isAudioPlaying = true;
            setPlayPauseUI(true);
            playAudioWord(audioIndex + 1);
        }
    });
}

if (audioDelaySelect) {
    audioDelaySelect.addEventListener('change', () => {
        if (currentPhase === 'RECALL_WAIT') {
            remainingRecallSeconds = parseInt(audioDelaySelect.value, 10) || 10;
            audioCountdownNum.textContent = remainingRecallSeconds;
        }
    });
}


loadWords();
