#!/usr/bin/env python3
"""Export the app's compact sentence index from the full dataset CSV."""

import csv
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "hebrew_sentences_with_audio.csv"
TARGET = ROOT / "src" / "data" / "sentences.json"
REVIEW = ROOT / "data" / "translation-review.json"
REPORT = ROOT / "data" / "translation-review.csv"


def main() -> None:
    review = json.loads(REVIEW.read_text(encoding="utf-8"))
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != review["sourceSha256"]:
        raise ValueError("Source CSV changed: review the translations before updating the review fingerprint.")
    sentences = []
    report = []
    seen = set()
    with SOURCE.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source):
            if not row["english_translation"] or not row["local_audio_path"]:
                continue
            sentence_id = row["sentence_id"]
            if sentence_id in seen:
                raise ValueError(f"Duplicate sentence ID: {sentence_id}")
            seen.add(sentence_id)
            entry = review["entries"].get(sentence_id, {})
            english = entry.get("english", row["english_translation"])
            translations = [english, *entry.get("alternatives", [])]
            if not 1 <= len(translations) <= 3 or len(set(translations)) != len(translations):
                raise ValueError(f"Expected 1–3 distinct complete translations for {sentence_id}")
            if any(not isinstance(text, str) or not text.strip() or text != text.strip() for text in translations):
                raise ValueError(f"Invalid translation for {sentence_id}")
            sentences.append(
                {
                    "id": sentence_id,
                    "hebrew": row["text"],
                    "english": english,
                    "translations": translations,
                    "translationVersion": review["version"],
                    "translationRelation": row["english_translation_relation"],
                }
            )
            report.append({
                "sentence_id": sentence_id,
                "hebrew": row["text"],
                "source_english": row["english_translation"],
                "canonical_english": english,
                "alternative_1": translations[1] if len(translations) > 1 else "",
                "alternative_2": translations[2] if len(translations) > 2 else "",
                "decision": "+".join(filter(None, ["corrected" if "english" in entry else "", "alternative" if len(translations) > 1 else ""])) or "keep",
                "review_note": entry.get("note", "Reviewed: retain the single canonical translation."),
            })

    if len(sentences) != review["reviewedSentenceCount"] or set(review["entries"]) - seen:
        raise ValueError("Review count or sentence IDs do not match the dataset")

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(
        json.dumps(sentences, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    with REPORT.open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=list(report[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(report)
    print(f"Exported {len(sentences):,} sentences to {TARGET.relative_to(ROOT)}")
    print(f"{sum(len(s['translations']) > 1 for s in sentences)} sentences have an alternative; {sum('english' in e for e in review['entries'].values())} canonical corrections. Full review: {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
