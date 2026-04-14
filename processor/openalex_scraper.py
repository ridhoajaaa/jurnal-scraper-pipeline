"""
OpenAlex scraper for LitAssist
Outputs JSON in the same format as jurnal_mentah_{job_id}.json

Usage:
    python3 openalex_scraper.py <keyword> <year_from> <year_to> <job_id> [max_results]

Output:
    ../data/openalex_raw_{job_id}.json
"""

import sys
import json
import os
import time
import urllib.request
import urllib.parse
import urllib.error

BASE_URL = 'https://api.openalex.org/works'
HEADERS  = {'User-Agent': 'LiteratureAssistant/2.0 (mailto:research@example.com)'}

def decode_abstract(inverted_index):
    """Decode OpenAlex inverted index format to plain text."""
    if not inverted_index:
        return 'Abstract not available.'
    try:
        max_pos = max(pos for positions in inverted_index.values() for pos in positions)
        words = [''] * (max_pos + 1)
        for word, positions in inverted_index.items():
            for pos in positions:
                words[pos] = word
        return ' '.join(words).strip() or 'Abstract not available.'
    except Exception:
        return 'Abstract not available.'

def fetch_openalex(keyword, year_from, year_to, max_results=25):
    """Fetch papers from OpenAlex API."""
    results = []
    per_page = min(max_results, 50)
    pages_needed = max(1, -(-max_results // per_page))  # ceiling division

    for page in range(1, pages_needed + 1):
        query = urllib.parse.quote(keyword)
        url = (
            f"{BASE_URL}?search={query}"
            f"&filter=publication_year:{year_from}-{year_to},cited_by_count:>2"
            f"&per_page={per_page}"
            f"&page={page}"
            f"&select=id,title,abstract_inverted_index,authorships,publication_year,"
            f"cited_by_count,open_access,primary_location,doi"
            f"&sort=relevance_score:desc"
        )

        print(f"  Fetching page {page}: {per_page} results...", flush=True)

        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            works = data.get('results', [])
            if not works:
                print(f"  No more results on page {page}.", flush=True)
                break

            for work in works:
                try:
                    title = work.get('title') or ''
                    if not title:
                        continue

                    year = str(work.get('publication_year') or '')
                    if not year:
                        continue

                    abstract = decode_abstract(work.get('abstract_inverted_index'))

                    # Authors
                    authorships = work.get('authorships') or []
                    author_names = [
                        a['author']['display_name']
                        for a in authorships[:8]
                        if a.get('author', {}).get('display_name')
                    ]
                    author_info = ', '.join(author_names) if author_names else 'Unknown'

                    # Journal
                    loc    = work.get('primary_location') or {}
                    source = loc.get('source') or {}
                    journal = source.get('display_name') or ''

                    # Link
                    doi  = work.get('doi') or ''
                    link = doi if doi else (loc.get('landing_page_url') or '')

                    # Open access
                    oa       = work.get('open_access') or {}
                    is_oa    = bool(oa.get('is_oa'))
                    oa_url   = oa.get('oa_url') or ''
                    if oa_url and not link:
                        link = oa_url

                    citations = int(work.get('cited_by_count') or 0)

                    results.append({
                        'judul':           title,
                        'author_info':     author_info,
                        'abstrak_lengkap': abstract,
                        'link':            link,
                        'tahun':           year,
                        'citationCount':   citations,
                        'isOpenAccess':    is_oa,
                        'source':          'OpenAlex',
                        'isBook':          False,
                        'keyword':         keyword,
                        'journal':         journal,
                    })
                    print(f"OPENALEX_PROGRESS:{len(results)}/{max_results}", flush=True)

                except Exception as e:
                    print(f"  Warning: failed to parse work: {e}", flush=True)
                    continue

            if len(results) >= max_results:
                break

            time.sleep(0.5)

        except urllib.error.HTTPError as e:
            print(f"  HTTP error {e.code} on page {page}: {e.reason}", flush=True)
            break
        except Exception as e:
            print(f"  Error on page {page}: {e}", flush=True)
            break

    return results[:max_results]


def main():
    if len(sys.argv) < 5:
        print("Usage: python3 openalex_scraper.py <keyword> <year_from> <year_to> <job_id> [max_results]")
        sys.exit(1)

    keyword     = sys.argv[1]
    year_from   = int(sys.argv[2])
    year_to     = int(sys.argv[3])
    job_id      = sys.argv[4]
    max_results = int(sys.argv[5]) if len(sys.argv) > 5 else 25

    output_path = f'../data/openalex_raw_{job_id}.json'

    print(f"OpenAlex scraper starting...", flush=True)
    print(f"  Keyword     : {keyword}", flush=True)
    print(f"  Year range  : {year_from} - {year_to}", flush=True)
    print(f"  Max results : {max_results}", flush=True)
    print(f"  Output      : {output_path}", flush=True)

    results = fetch_openalex(keyword, year_from, year_to, max_results)

    print(f"\nDone. Found {len(results)} papers.", flush=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"Saved to {output_path}", flush=True)


if __name__ == '__main__':
    main()