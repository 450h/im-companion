"""Build-time only (docs/09 §1). Extract per-page text from the owner's local source books into .work/text,
and build a printed-page map per book. Never shipped, never committed (ADR-0003).

Usage:  python -I scripts/extract/extract_text.py <source_dir> <out_dir>
"""
import collections
import io
import json
import os
import re
import sys

import pymupdf

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# bookId -> file name in the owner's local source folder (local build input only; never shown in the app)
BOOKS = {
    "davidson24": "Davidson's Principles and Practice of Medicine, 24th Ed.pdf",
    "kumar10": "Kumar & Clark’s Clinical Medicine 10th ed.pdf",
    "kcEssentials": "Essentials_of_Kumar_and_Clark's_Clinical_Medicine_Pocket_Essentials.pdf",
    "fa2ck11": "First Aid for the USMLE Step 2 Ck 11th Edition 2023.pdf",
    "goldberger": "Goldberger’s_Clinical_electrocardiography_A_simplified_approach.pdf",
    "allam25": "IM in 25 days by Dr.Allam.pdf",
    "pocket8": "Pocket Medicine 8th Ed.pdf",
    "stepup6": "STEP UP TO MEDICINE 6th ed.pdf",
    "talley8": "TALLEY & O’CONNOR’S Clinical Examination 8th Ed.pdf",
    "washington36": "The Washington Manual of Medical Therapeutics 36th ed.pdf",
    "zerotofinals": "ZEROTOFINALS.pdf",
    "emq1": "EMQs for Medical Students - Volume 1.pdf",
    "emq2": "EMQs for Medical Students - Volume 2.pdf",
    "emq3": "EMQs for Medical Students - Volume 3.pdf",
    "blueprint": "Student master blueprint FINAL updated.pdf",
}

NUM_LINE = re.compile(r"^\s*(\d{1,4})\s*$")
# Running headers such as "578  •  RESPIRATORY MEDICINE" or "Cardiology  579"
HEAD_LEAD = re.compile(r"^\s*(\d{1,4})\s+(?:[•|·]\s*)?[A-Za-z]")
HEAD_TRAIL = re.compile(r"[A-Za-z][^\d]*\s(\d{1,4})\s*$")


def candidates(text: str) -> list[int]:
    """Likely printed page numbers: standalone numbers, or numbers leading/trailing a running header."""
    lines = [ln for ln in text.splitlines() if ln.strip()]
    out = []
    for ln in lines[:4] + lines[-4:]:
        m = NUM_LINE.match(ln)
        if m:
            out.append(int(m.group(1)))
    for ln in lines[:3]:
        for rx in (HEAD_LEAD, HEAD_TRAIL):
            m = rx.match(ln) if rx is HEAD_LEAD else rx.search(ln)
            if m and len(ln) < 90:
                out.append(int(m.group(1)))
    return out


def page_map(texts: list[str]) -> dict[int, int | None]:
    """Infer printed page per PDF page from offset votes in a sliding window (robust to noise)."""
    n = len(texts)
    votes: list[set[int]] = []
    for i, t in enumerate(texts):
        votes.append({(i + 1) - c for c in candidates(t)})
    result: dict[int, int | None] = {}
    window = 15
    for i in range(n):
        tally = collections.Counter()
        for j in range(max(0, i - window), min(n, i + window + 1)):
            tally.update(votes[j])
        best = tally.most_common(1)
        if best and best[0][1] >= 4:
            printed = (i + 1) - best[0][0]
            result[i + 1] = printed if printed >= 1 else None
        else:
            result[i + 1] = None
    return result


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    pagemap_only = "--pagemap-only" in sys.argv
    os.makedirs(os.path.join(out, "pagemap"), exist_ok=True)
    summary = {}
    for book_id, fname in BOOKS.items():
        d = os.path.join(out, "text", book_id)
        if pagemap_only:
            files = sorted(os.listdir(d))
            texts = [open(os.path.join(d, fn), encoding="utf-8").read() for fn in files]
            doc_pages = len(texts)
        else:
            path = os.path.join(src, fname)
            if not os.path.exists(path):
                print(f"MISSING {book_id}: {fname}")
                continue
            doc = pymupdf.open(path)
            doc_pages = doc.page_count
            os.makedirs(d, exist_ok=True)
            texts = []
            for i, page in enumerate(doc):
                t = page.get_text()
                texts.append(t)
                with open(os.path.join(d, f"{i + 1:04d}.txt"), "w", encoding="utf-8") as f:
                    f.write(t)
        pm = page_map(texts)
        with open(os.path.join(out, "pagemap", f"{book_id}.json"), "w", encoding="utf-8") as f:
            json.dump(pm, f)
        mapped = sum(1 for v in pm.values() if v is not None)
        offsets = collections.Counter((k - v) for k, v in pm.items() if v is not None)
        summary[book_id] = {"pages": doc_pages, "mapped": mapped, "topOffsets": offsets.most_common(3)}
        print(book_id, summary[book_id])
    with open(os.path.join(out, "pagemap", "_summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=1)


if __name__ == "__main__":
    main()
