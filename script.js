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

async function loadWords() {
    try {
        const response = await fetch('words.json');
        allWords = await response.json();
        
        try {
            const mResponse = await fetch('mnemonics.json');
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

function renderHome() {
    const partsMap = {};
    allWords.forEach(w => {
        if (!partsMap[w.part]) partsMap[w.part] = 0;
        partsMap[w.part]++;
    });
    
    partsGrid.innerHTML = '';
    Object.keys(partsMap).sort((a,b) => a-b).forEach(part => {
        const card = document.createElement('div');
        card.className = 'part-card';
        card.innerHTML = `
            <h2>Part ${part}</h2>
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
    modalPartName.textContent = `Part ${partNum}`;
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

function startFlashcards(partNum) {
    words = allWords.filter(w => w.part == partNum);
    currentIndex = 0;
    partTitle.textContent = `Part ${partNum}`;
    
    homeView.classList.add('hidden');
    flashcardView.classList.remove('hidden');
    
    renderCard();
}

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
                    Part ${wordObj.part} &bull; Word #${wordObj.num}
                </div>
                <h2>${wordObj.word}</h2>
            </div>
            <div class="card-face card-back">
                <div class="pos">${wordObj.pos}</div>
                <div class="description">${wordObj.description}</div>
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

loadWords();
