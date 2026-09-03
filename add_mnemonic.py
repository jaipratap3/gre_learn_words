import sys
import json
import urllib.request
import urllib.parse

if len(sys.argv) < 3:
    print("Usage: python3 add_mnemonic.py <WORD> <MNEMONIC_TEXT>")
    sys.exit(1)

word_input = sys.argv[1].strip()
word_upper = word_input.upper()
mnemonic_input = sys.argv[2].strip()

# 1. Update mnemonics.json
try:
    with open("mnemonics.json", "r", encoding="utf-8") as f:
        mnemonics_data = json.load(f)
except Exception:
    mnemonics_data = {}

mnemonics_data[word_upper] = mnemonic_input

with open("mnemonics.json", "w", encoding="utf-8") as f:
    json.dump(mnemonics_data, f, indent=4, ensure_ascii=False)

print(f"Successfully added/updated mnemonic for {word_upper} in mnemonics.json")

# 2. Check words.json
try:
    with open("words.json", "r", encoding="utf-8") as f:
        words_data = json.load(f)
except Exception:
    words_data = []

existing_word = next((w for w in words_data if w.get("word", "").strip().upper() == word_upper), None)

def get_translation(text, tl="hi"):
    if not text:
        return ""
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl={tl}&dt=t&q={urllib.parse.quote(text)}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=5)
        data = json.loads(response.read().decode('utf-8'))
        translated = ""
        if data and data[0]:
            for chunk in data[0]:
                if chunk[0]:
                    translated += chunk[0]
        return translated
    except Exception:
        return ""

def get_synonyms(w):
    url = f"https://api.datamuse.com/words?ml={urllib.parse.quote(w)}&max=5"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=5)
        data = json.loads(response.read().decode('utf-8'))
        if data:
            return "Simple synonyms: " + ", ".join([d['word'] for d in data])
    except Exception:
        pass
    return ""

def get_dictionary_definition(w):
    url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{urllib.parse.quote(w.lower())}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=5)
        data = json.loads(response.read().decode('utf-8'))
        if data and isinstance(data, list) and len(data) > 0:
            meanings = data[0].get("meanings", [])
            pos_list = []
            defs_list = []
            for m in meanings:
                pos = m.get("partOfSpeech", "")
                if pos and pos not in pos_list:
                    pos_list.append(pos)
                for d in m.get("definitions", []):
                    definition_text = d.get("definition", "")
                    if definition_text:
                        defs_list.append(definition_text)
            pos_str = ", ".join(pos_list) if pos_list else "adj/n/v"
            desc_str = ". ".join(defs_list[:3])
            return pos_str, desc_str
    except Exception:
        pass
    return "adj/n/v", ""

if existing_word:
    print(f"'{word_upper}' is already in Part {existing_word.get('part')} of words.json (Word #{existing_word.get('num')}).")
else:
    print(f"'{word_upper}' not found in any part of words.json. Adding to part 'EXTRA'...")
    
    extra_words = [w for w in words_data if str(w.get("part")).upper() == "EXTRA"]
    next_num = str(len(extra_words) + 1)
    
    pos, desc = get_dictionary_definition(word_upper)
    if not desc:
        lines = [line.strip() for line in mnemonic_input.split("\n") if line.strip()]
        desc = lines[-1] if lines else mnemonic_input
    
    hindi_w = get_translation(word_upper)
    hindi_d = get_translation(desc)
    easy_eng = get_synonyms(word_upper)
    
    new_entry = {
        "num": next_num,
        "part": "EXTRA",
        "word": word_upper,
        "pos": pos,
        "description": desc,
        "hindi_meaning": hindi_w,
        "hindi_word": hindi_w,
        "hindi_desc": hindi_d,
        "easy_english": easy_eng
    }
    
    words_data.append(new_entry)
    with open("words.json", "w", encoding="utf-8") as f:
        json.dump(words_data, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully added '{word_upper}' to part 'EXTRA' as Word #{next_num} in words.json!")
