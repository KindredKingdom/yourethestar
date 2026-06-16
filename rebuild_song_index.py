#!/usr/bin/env python3
"""
You're the Star — Yearly Song Index Rebuild Script
=====================================================

WHAT THIS DOES
---------------
Rebuilds song-index.json from a fresh USCO (US Copyright Office) bulk
data export. Run this about once a year — ideally every January — so
your site picks up newly-eligible songs as the 35-year termination
window rolls forward.

You do NOT need to touch your website code to run this. This script
only produces a new song-index.json file. The site's search and
"Act Now / Window Open / Closed" badges are calculated live from
today's date in the browser, so you never need to manually update
status labels — only the underlying song data.

HOW TO USE IT
---------------
1. Download the latest USCO bulk data CSV (same source/process as
   before — musical works + sound recordings registrations).
2. Save it somewhere on your computer, e.g. ~/Downloads/results.csv
3. Run this script:
       python3 rebuild_song_index.py /path/to/results.csv
4. It creates a new song-index.json file next to this script.
5. Upload that new song-index.json to your GitHub repo, replacing
   the old one (same upload process you've used before — it will
   ask if you want to replace the existing file, say yes).
6. Vercel auto-redeploys. Done for another year.

WHO TO ASK IF SOMETHING BREAKS
---------------------------------
This script is intentionally simple and self-contained — no paid
services, no API keys, no scheduling infrastructure. If the USCO
changes their data format in the future, the column names below
(title, author, reg_number, year, window_opens, window_closes,
flagged) may need to be adjusted to match the new export.
"""

import csv
import json
import re
import sys
import os
from datetime import datetime

# Artists we always want represented even if the keyword-flagging
# in the raw USCO export misses them. Add new names here over time
# as you discover important artists who get filtered out.
PRIORITY_ARTISTS = [
    'vandross, luther', 'houston, whitney', 'baker, anita', 'brown, bobby',
    'jackson, freddie', 'sweat, keith', 'edmonds, kenny', 'riley, teddy',
    'myers, dwight', 'saddler, joseph', 'parker, lawrence', 'ridenhour, carlton',
    'smith, james todd', 'hardy, antonio', 'griffin, william', 'mercer, kelvin',
    'burrell, stanley kirk', 'owens, dana', 'tresvant, ralph', 'bell, ricky',
    'bivins, michael', 'glover, melvin', 'simmons, joseph', 'mcdaniels',
    'jolicoeur, david',
]


def clean_title(raw_title):
    """Strip trailing slashes/colons and truncate at first slash."""
    t = raw_title.strip().strip('"').rstrip('/:').strip()
    if '/' in t:
        t = t.split('/')[0].strip()
    return t.rstrip(' :').strip()


def clean_author(raw_author):
    """Remove a trailing stray comma."""
    a = raw_author.strip().strip('"')
    return re.sub(r',\s*$', '', a).strip()


def build_index(csv_path, output_path):
    records = []
    seen = set()
    total_rows = 0

    with open(csv_path, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_rows += 1

            title = row.get('title', '')
            author = row.get('author', '')
            reg = row.get('reg_number', '').strip()
            year = row.get('year', '').strip()
            opens = row.get('window_opens', '').strip()
            closes = row.get('window_closes', '').strip()
            flagged = row.get('flagged', '').strip() == 'True'

            is_priority = any(p in author.lower() for p in PRIORITY_ARTISTS)
            if not (flagged or is_priority):
                continue

            t = clean_title(title)
            a = clean_author(author)
            if not t or not a or len(t) < 3:
                continue

            try:
                opens_i = int(opens)
                closes_i = int(closes)
                year_i = int(year)
            except ValueError:
                continue

            key = (a.lower(), t.lower()[:30])
            if key in seen:
                continue
            seen.add(key)

            # Note: no 's' (status) field is stored anymore — the website
            # calculates Act Now / Window Open / Closed live from today's
            # date using 'o' and 'c' below, so this file stays accurate
            # automatically and never needs a manual status update.
            records.append({
                't': t[:90],
                'a': a[:70],
                'y': year_i,
                'r': reg,
                'o': opens_i,
                'c': closes_i,
            })

    # Sort soonest-closing first so the most time-sensitive songs surface
    records.sort(key=lambda r: r['c'])

    with open(output_path, 'w') as f:
        json.dump(records, f, separators=(',', ':'))

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"Scanned {total_rows:,} rows from {csv_path}")
    print(f"Built {len(records):,} song records")
    print(f"Wrote {output_path} ({size_mb:.2f} MB)")
    print()
    print("Next step: upload this file to your GitHub repo, replacing the")
    print("existing song-index.json. Vercel will auto-redeploy.")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 rebuild_song_index.py /path/to/latest_uscо_export.csv")
        print()
        print("Expected CSV columns: title, author, reg_number, year,")
        print("window_opens, window_closes, flagged")
        sys.exit(1)

    csv_path = sys.argv[1]
    if not os.path.exists(csv_path):
        print(f"File not found: {csv_path}")
        sys.exit(1)

    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'song-index.json')
    print(f"Run date: {datetime.now().strftime('%Y-%m-%d')}")
    build_index(csv_path, output_path)
