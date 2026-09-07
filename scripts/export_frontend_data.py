#!/usr/bin/env python3
"""Export the app's compact sentence index from the full dataset CSV."""

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "hebrew_sentences_with_audio.csv"
TARGET = ROOT / "src" / "data" / "sentences.json"


def main() -> None:
    sentences = []
    with SOURCE.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source):
            if not row["english_translation"] or not row["local_audio_path"]:
                continue
            sentences.append(
                {
                    "id": row["sentence_id"],
                    "hebrew": row["text"],
                    "english": row["english_translation"],
                    "translationRelation": row["english_translation_relation"],
                }
            )

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(
        json.dumps(sentences, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Exported {len(sentences):,} sentences to {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
