#!/usr/bin/env python3
"""
Debug script untuk test PDF extraction step-by-step.
Jalankan: python3 debug_pdf.py /path/to/file.pdf
"""
import sys
import os
import json
import warnings
warnings.filterwarnings("ignore")

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from scripts.pdf_extract import (
    detect_code_blocks,
    heuristic_extract_blocks,
    _heuristic_via_pymupdf,
    _heuristic_via_pdftotext,
    is_monospace_font,
    normalize_fontname,
)
from collections import Counter
import pdfplumber

def print_separator(title):
    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print(f"{'=' * 70}\n")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 debug_pdf.py /path/to/file.pdf")
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"ERROR: File not found: {pdf_path}")
        sys.exit(1)

    print_separator(f"STEP 1: File Info — {os.path.basename(pdf_path)}")
    print(f"Path: {pdf_path}")
    print(f"Size: {os.path.getsize(pdf_path) / 1024:.1f} KB")

    # ─── STEP 2: Font analysis ───
    print_separator("STEP 2: Font Analysis (pdfplumber)")
    try:
        with pdfplumber.open(pdf_path) as pdf:
            print(f"Total pages: {len(pdf.pages)}")
            font_stats = Counter()
            total_chars = 0
            mono_chars = 0

            for page_idx, page in enumerate(pdf.pages[:5]):  # first 5 pages
                chars = page.chars
                page_fonts = Counter(c["fontname"] for c in chars)
                font_stats.update(page_fonts)
                total_chars += len(chars)
                mono_chars += sum(
                    len(c for c in chars if c["fontname"] == f)
                    for f in page_fonts if is_monospace_font(f)
                )

            print(f"Total chars (first 5 pages): {total_chars}")
            print(f"Monospace chars: {mono_chars}")
            print(f"Code ratio: {mono_chars / total_chars * 100:.1f}%" if total_chars else "N/A")
            print(f"\nFonts detected:")
            for font, count in font_stats.most_common(10):
                mono = "MONO" if is_monospace_font(font) else "prose"
                print(f"  [{mono:5s}] {normalize_fontname(font):40s} {count:6d} chars")
    except Exception as e:
        print(f"ERROR: {e}")

    # ─── STEP 3: Full extraction ───
    print_separator("STEP 3: Full Extraction (detect_code_blocks)")
    try:
        result = detect_code_blocks(pdf_path)
        blocks = result.get("blocks", [])
        stats = result.get("stats", {})
        fonts = result.get("fonts_detected", {})

        print(f"Total blocks: {len(blocks)}")
        print(f"Stats:")
        for k, v in stats.items():
            print(f"  {k}: {v}")
        print(f"\nFonts detected:")
        print(f"  monospace: {fonts.get('monospace', [])}")
        print(f"  prose:     {fonts.get('prose', [])[:5]}")

        print(f"\nBlocks:")
        for i, b in enumerate(blocks):
            print(f"\n--- Block #{i} | {b['lines']} lines | via {b.get('source', '?')} | page {b.get('page', '?')} ---")
            code = b["code"]
            if len(code) > 500:
                print(code[:500])
                print(f"... ({len(code)} chars total)")
            else:
                print(code)
    except Exception as e:
        import traceback
        print(f"ERROR: {e}")
        traceback.print_exc()

    # ─── STEP 4: Heuristic via PyMuPDF ───
    print_separator("STEP 4: Heuristic via PyMuPDF (fitz)")
    try:
        pymupdf_blocks = _heuristic_via_pymupdf(pdf_path)
        print(f"PyMuPDF blocks: {len(pymupdf_blocks)}")
        for i, b in enumerate(pymupdf_blocks[:5]):
            print(f"\n--- Block #{i} | {b['lines']} lines | page {b.get('page', '?')} ---")
            print(b["code"][:200])
            if len(b["code"]) > 200:
                print(f"... ({len(b['code'])} chars total)")
    except Exception as e:
        import traceback
        print(f"ERROR: {e}")
        traceback.print_exc()

    # ─── STEP 5: Heuristic via pdftotext ───
    print_separator("STEP 5: Heuristic via pdftotext -layout")
    try:
        pdftotext_blocks = _heuristic_via_pdftotext(pdf_path)
        print(f"pdftotext blocks: {len(pdftotext_blocks)}")
        for i, b in enumerate(pdftotext_blocks[:5]):
            print(f"\n--- Block #{i} | {b['lines']} lines ---")
            print(b["code"][:200])
            if len(b["code"]) > 200:
                print(f"... ({len(b['code'])} chars total)")
    except Exception as e:
        import traceback
        print(f"ERROR: {e}")
        traceback.print_exc()

    # ─── STEP 6: Summary ───
    print_separator("SUMMARY")
    print(f"File: {os.path.basename(pdf_path)}")
    print(f"Font-based blocks:    {len(blocks) if 'blocks' in dir() else 'N/A'}")
    print(f"PyMuPDF heuristic:     {len(pymupdf_blocks)}")
    print(f"pdftotext heuristic:   {len(pdftotext_blocks)}")
    print(f"\nFinal result (detect_code_blocks): {len(blocks) if 'blocks' in dir() else 'N/A'} blocks")

    # ─── STEP 7: Output JSON for BE test ───
    print_separator("STEP 7: JSON Output (first 500 chars)")
    if 'result' in dir():
        json_str = json.dumps(result, ensure_ascii=False)
        print(json_str[:500])
        if len(json_str) > 500:
            print(f"... ({len(json_str)} chars total)")

if __name__ == "__main__":
    main()
