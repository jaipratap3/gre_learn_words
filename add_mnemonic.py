import sys
import json

word = sys.argv[1]
mnemonic = sys.argv[2]

with open("mnemonics.json", "r") as f:
    data = json.load(f)

data[word] = mnemonic

with open("mnemonics.json", "w") as f:
    json.dump(data, f, indent=4)

print(f"Successfully added mnemonic for {word}")
