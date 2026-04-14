"""
Hybrid Journal Processor v2  Quality-First Analysis Engine

Scoring breakdown (0100):
  - Keyword Relevance  35%  : how strongly keyword appears in title + abstract
  - Citation Score     35%  : citation count, recency-weighted
  - Abstract Quality   20%  : length, informativeness, availability
  - Access Bonus       10%  : open access = readable = more useful

Papers with no abstract and no citations get heavily penalized.
"""

import pandas as pd
import json
import os
import sys
import io
import re
import math
import urllib.request
import urllib.parse
import urllib.error
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

CURRENT_YEAR = __import__("datetime").datetime.now().year

import html as html_module

def clean_text(text):
    """Decode HTML entities, strip control characters, normalize whitespace."""
    if not text or str(text).strip() in ('', 'None', 'nan'):
        return ''
    t = str(text)
    t = html_module.unescape(t)                        
    t = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', t)  
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def clean_author(author_info):
    """
    Strip source/year/domain suffix that Google Scholar appends.
    Input:  "J Kritz, V Robinson - arXiv preprint arXiv, 2025 - arxiv.org"
    Output: "J Kritz, V Robinson"
    Also handles Scopus et al. format which is already clean.
    """
    if not author_info or str(author_info).strip() in ('', 'None', 'nan', 'Unknown'):
        return 'Unknown'
    a = clean_text(author_info)
    
    parts = re.split(r'\s+-\s+', a)
    authors = parts[0].strip()
    
    authors = re.sub(r',?\s*\b(19|20)\d{2}\b.*$', '', authors).strip()
    
    authors = re.sub(r'\s*-\s*\S+\.\S+$', '', authors).strip()
    
    if len(authors) > 200:
        authors = authors[:200] + '...'
    return authors if authors else 'Unknown'

def clean_abstract(abstract):
    """Clean abstract  remove HTML, normalize whitespace, strip BibTeX-unsafe chars."""
    if not abstract or str(abstract).strip() in ('', 'None', 'nan'):
        return 'Abstract not available.'
    a = clean_text(abstract)
    
    a = a.replace('{', '(').replace('}', ')')
    
    a = re.sub(r'\s+', ' ', a).strip()
    return a if len(a) > 10 else 'Abstract not available.'

def clean_title(title):
    """Clean title  remove HTML entities, strip BibTeX-unsafe chars."""
    if not title or str(title).strip() in ('', 'None', 'nan'):
        return 'Untitled'
    t = clean_text(title)
    t = t.replace('{', '(').replace('}', ')')
    return t.strip() or 'Untitled'

def clean_df(df):
    """Apply all cleaning functions to the dataframe."""
    print(" Cleaning data fields...")
    df['judul']          = df.apply(lambda r: clean_title(r.get('judul', '')), axis=1)
    df['author_info']    = df.apply(lambda r: clean_author(r.get('author_info', '')), axis=1)
    df['abstrak_lengkap']= df.apply(lambda r: clean_abstract(r.get('abstrak_lengkap', '')), axis=1)
    
    if 'link' in df.columns:
        df['link'] = df['link'].astype(str).str.strip().replace('None', None).replace('nan', None)
    
    if 'tahun' in df.columns:
        df['tahun'] = df['tahun'].apply(lambda y: str(int(float(y))) if str(y).replace('.','').isdigit() else str(y))
    print(f"    Cleaned {len(df)} entries")
    return df

CATEGORIES = {
    "Metode Penelitian": {
        "en": ["method", "methodology", "algorithm", "approach", "framework", "technique",
               "procedure", "protocol", "design", "instrument", "measurement", "validation"],
        "id": ["metode", "metodologi", "algoritma", "pendekatan", "kerangka", "teknik",
               "prosedur", "desain", "instrumen", "pengukuran", "validasi"]
    },
    "Hasil & Temuan": {
        "en": ["result", "finding", "outcome", "significant", "performance", "accuracy",
               "improvement", "effect", "impact", "evidence", "demonstrate", "show", "achieve"],
        "id": ["hasil", "temuan", "luaran", "signifikan", "performa", "akurasi",
               "peningkatan", "efek", "dampak", "bukti", "menunjukkan", "mencapai"]
    },
    "Tinjauan Literatur": {
        "en": ["review", "literature", "survey", "meta-analysis", "synthesis", "overview",
               "systematic", "bibliometric", "scoping", "narrative review"],
        "id": ["tinjauan", "literatur", "survei", "meta-analisis", "sintesis",
               "sistematis", "bibliometrik", "kajian pustaka"]
    },
    "Studi Empiris": {
        "en": ["empirical", "case study", "observation", "interview", "questionnaire",
               "field study", "experiment", "sample", "respondent", "participant", "cohort"],
        "id": ["empiris", "studi kasus", "observasi", "wawancara", "kuesioner",
               "studi lapangan", "eksperimen", "sampel", "responden", "partisipan"]
    },
    "Kerangka Teori": {
        "en": ["theory", "theoretical", "model", "concept", "proposition", "hypothesis",
               "construct", "paradigm", "principle", "conceptual"],
        "id": ["teori", "teoretis", "model", "konsep", "proposisi", "hipotesis",
               "konstruk", "paradigma", "prinsip", "konseptual"]
    },
    "Teknologi & Sistem": {
        "en": ["system", "software", "platform", "tool", "application", "implementation",
               "architecture", "infrastructure", "network", "database", "cloud", "iot",
               "interface", "prototype", "deployment"],
        "id": ["sistem", "perangkat lunak", "platform", "alat", "aplikasi", "implementasi",
               "arsitektur", "infrastruktur", "jaringan", "basis data", "antarmuka", "prototipe"]
    },
    "Data & Kecerdasan Buatan": {
        "en": ["machine learning", "deep learning", "neural network", "artificial intelligence",
               "data mining", "natural language processing", "nlp", "classification", "prediction",
               "clustering", "reinforcement", "transformer", "llm", "generative"],
        "id": ["pembelajaran mesin", "kecerdasan buatan", "penambangan data", "jaringan saraf",
               "klasifikasi", "prediksi", "pengelompokan", "pemrosesan bahasa", "generatif"]
    },
    "Kebijakan & Tata Kelola": {
        "en": ["policy", "governance", "regulation", "strategy", "management", "standard",
               "compliance", "initiative", "reform", "law", "legislation", "government"],
        "id": ["kebijakan", "tata kelola", "regulasi", "strategi", "manajemen", "standar",
               "kepatuhan", "inisiatif", "reformasi", "hukum", "perundangan", "pemerintah"]
    },
    "Pendidikan & Pembelajaran": {
        "en": ["education", "learning", "teaching", "curriculum", "student", "pedagogy",
               "e-learning", "training", "knowledge", "school", "university", "instructor",
               "assessment", "competency"],
        "id": ["pendidikan", "pembelajaran", "pengajaran", "kurikulum", "siswa", "mahasiswa",
               "pedagogi", "pelatihan", "pengetahuan", "sekolah", "universitas", "kompetensi"]
    },
    "Kesehatan & Biomedis": {
        "en": ["health", "medical", "clinical", "patient", "disease", "treatment", "diagnosis",
               "therapy", "hospital", "epidemiology", "drug", "vaccine", "mental health",
               "pandemic", "biomedical"],
        "id": ["kesehatan", "medis", "klinis", "pasien", "penyakit", "pengobatan", "diagnosis",
               "terapi", "epidemiologi", "obat", "vaksin", "kesehatan mental", "pandemi"]
    },
    "Bisnis & Ekonomi": {
        "en": ["business", "economic", "market", "financial", "commerce", "enterprise",
               "profit", "investment", "supply chain", "consumer", "startup", "revenue",
               "competitive", "marketing", "sustainability"],
        "id": ["bisnis", "ekonomi", "pasar", "keuangan", "perdagangan", "perusahaan",
               "investasi", "rantai pasok", "konsumen", "pemasaran", "keberlanjutan", "pendapatan"]
    },
    "Keamanan & Privasi": {
        "en": ["security", "privacy", "encryption", "threat", "vulnerability", "attack",
               "protection", "authentication", "cybersecurity", "firewall", "intrusion",
               "malware", "forensic", "risk"],
        "id": ["keamanan", "privasi", "enkripsi", "ancaman", "kerentanan", "serangan",
               "perlindungan", "autentikasi", "siber", "risiko", "forensik"]
    }
}

def extract_categories(row):
    raw = (str(row.get('judul', '')) + ' ' + str(row.get('abstrak_lengkap', ''))).lower()
    # Word-boundary safe matching — prevents "system" matching "ecosystem"
    matched = []
    for category, keywords in CATEGORIES.items():
        all_kw = keywords['en'] + keywords['id']
        found = False
        for kw in all_kw:
            # Both single and multi-word: use \b word boundary
            if re.search(r'\b' + re.escape(kw) + r'\b', raw):
                found = True
                break
        if found:
            matched.append(category)
    return " | ".join(matched) if matched else "Literatur Umum"

def tokenize(text):
    """Normalize and tokenize text for similarity comparison."""
    text = str(text).lower()
    text = re.sub(r'[^\w\s]', '', text)
    tokens = set(t for t in text.split() if len(t) > 2)
    return tokens

def jaccard_similarity(set_a, set_b):
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0

def detect_duplicates(df, threshold=0.72):
    """
    Flag entries that are likely duplicates of a higher-ranked entry.
    Uses Jaccard similarity on title tokens (weight 0.7) + abstract tokens (weight 0.3).
    Only compares entries with DIFFERENT keywords to find cross-keyword duplicates.
    Entries are already sorted by Relevansi descending  first occurrence wins.
    """
    n = len(df)
    duplicate_flags = [''] * n   
    duplicate_of    = [''] * n   

    titles_list = df['judul'].fillna('').astype(str).tolist()
    abstracts_list = df.get('abstrak_lengkap', pd.Series(['']*n)).fillna('').astype(str).tolist()
    keywords_list = df.get('keyword', pd.Series(['']*n)).fillna('').astype(str).tolist()
    
    title_tokens = [tokenize(t) for t in titles_list]
    abstract_tokens = [tokenize(a) for a in abstracts_list]

    title_lens = [len(t) for t in title_tokens]
    abstract_lens = [len(a) for a in abstract_tokens]

    for i in range(n):
        if duplicate_flags[i]:  
            continue
            
        kw_i = keywords_list[i]
        ti = title_tokens[i]
        ai = abstract_tokens[i]
        ti_len = title_lens[i]
        ai_len = abstract_lens[i]

        for j in range(i + 1, n):
            if duplicate_flags[j]:
                continue
            
            kw_j = keywords_list[j]

            # Fast Jaccard for Title
            tj_len = title_lens[j]
            if ti_len == 0 or tj_len == 0:
                title_sim = 0.0
            else:
                t_intersect = len(ti.intersection(title_tokens[j]))
                title_sim = t_intersect / (ti_len + tj_len - t_intersect)

            # Early escape condition: max abstract similarity is 1.0 (weight 0.3)
            if title_sim * 0.7 + 0.3 < threshold:
                continue

            # Fast Jaccard for Abstract
            aj_len = abstract_lens[j]
            if ai_len == 0 or aj_len == 0:
                abstract_sim = 0.0
            else:
                a_intersect = len(ai.intersection(abstract_tokens[j]))
                abstract_sim = a_intersect / (ai_len + aj_len - a_intersect)

            combined = title_sim * 0.7 + abstract_sim * 0.3

            if combined >= threshold:
                duplicate_flags[j] = f'️ Similar ({int(combined*100)}%)'
                duplicate_of[j]    = str(titles_list[i])[:80]

    df['isDuplicateSuspect'] = duplicate_flags
    df['duplicateOf']        = duplicate_of
    flagged = sum(1 for f in duplicate_flags if f)
    if flagged:
        print(f" Duplicate detector: {flagged} suspected duplicates flagged (threshold: {int(threshold*100)}%)")
    else:
        print(f" Duplicate detector: no duplicates found.")
    return df

def keyword_relevance_score(df, search_keyword):
    """
    How strongly the search keyword appears in title (3x) + abstract (1x).
    Phrase bonus: if full keyword phrase appears, +50% bonus.
    """
    if not search_keyword:
        return pd.Series([0.0] * len(df), index=df.index)

    tokens = [t.strip().lower() for t in re.split(r'\s+', search_keyword.strip()) if len(t) > 2]
    full_phrase = search_keyword.strip().lower()

    if not tokens:
        return pd.Series([0.0] * len(df), index=df.index)

    def raw(row):
        title    = str(row.get('judul', '')).lower()
        abstract = str(row.get('abstrak_lengkap', '')).lower()

        
        if abstract.strip() in ('abstract not available.', 'n/a', ''):
            abstract = ''

        score = 0
        for token in tokens:
            score += title.count(token) * 3
            score += abstract.count(token) * 1

        
        if len(tokens) > 1:
            if full_phrase in title:
                score += 6
                # Extra bonus if keyword is the PRIMARY topic (appears in first half of title)
                title_midpoint = len(title) // 2
                if title.find(full_phrase) <= title_midpoint:
                    score += 4
            if full_phrase in abstract: score += 2

        # Penalty for very niche/domain-specific titles
        # If title has "for [specific domain]" pattern with keyword, reduce score slightly
        # e.g. "machine learning for microbiologists" vs "machine learning: a survey"
        niche_patterns = [' for ', ' in ', ' of ', ' on ']
        if full_phrase in title:
            title_after_kw = title[title.find(full_phrase) + len(full_phrase):]
            if any(p in title_after_kw[:30] for p in niche_patterns) and len(title_after_kw) > 10:
                score *= 0.85  # 15% penalty for domain-specific application papers

        return float(score)

    raw_scores = df.apply(raw, axis=1)
    max_s = raw_scores.max()
    if max_s == 0:
        return pd.Series([0.0] * len(df), index=df.index)
    return (raw_scores / max_s * 100).clip(0, 100)

def fetch_openalex_fwci(doi):
    """
    Fetch Field-Weighted Citation Impact (fwci) from OpenAlex for a given DOI.
    fwci > 1.0 = cited more than average for its field/year → high quality signal
    fwci = None = no data yet (new paper or not indexed)
    Free API, no key required for basic usage.
    """
    if not doi or str(doi).strip() in ('', 'None', 'nan'):
        return None
    try:
        doi_clean = str(doi).strip().lstrip('https://doi.org/').lstrip('http://dx.doi.org/')
        url = f"https://api.openalex.org/works/doi:{urllib.parse.quote(doi_clean, safe='')}"
        req = urllib.request.Request(url, headers={
            'User-Agent': 'LiteratureAssistant/2.0 (mailto:research@example.com)',
            'Accept': 'application/json'
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            fwci = data.get('fwci')
            if fwci is not None:
                return float(fwci)
    except Exception:
        pass
    return None


def lookup_doi_by_title(title):
    """
    Look up DOI from paper title via CrossRef API.
    Used for Scholar papers that don't have DOI in their URL.
    Returns DOI string or None.
    """
    if not title or len(title) < 10:
        return None
    try:
        query = urllib.parse.quote(title[:100])
        url = f"https://api.crossref.org/works?query.title={query}&rows=1&select=DOI,title,score"
        req = urllib.request.Request(url, headers={
            'User-Agent': 'LiteratureAssistant/2.0 (mailto:research@example.com)',
            'Accept': 'application/json'
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            items = data.get('message', {}).get('items', [])
            if not items:
                return None
            item = items[0]
            # Only accept if CrossRef score is high (good title match)
            cr_score = float(item.get('score', 0))
            if cr_score < 50:
                return None
            return item.get('DOI')
    except Exception:
        return None


def enrich_with_openalex(df):
    """
    Enrich DataFrame with fwci scores from OpenAlex via DOI lookup.
    Only runs if 'link' column exists and contains DOI-like URLs.
    Adds '_fwci' column — None if not found.
    """
    import re as _re

    def extract_doi(link):
        if not link or str(link) in ('', 'None', 'nan'):
            return None
        m = _re.search(r'(?:doi[.]org|dx[.]doi[.]org)/([10][.][0-9]+[.][^?# ]+)', str(link))
        return m.group(1).rstrip('/') if m else None

    if 'link' not in df.columns:
        df['_fwci'] = None
        return df

    fwci_values = []
    fetched = 0

    print(" Enriching with OpenAlex fwci scores...")
    for _, row in df.iterrows():
        doi = extract_doi(row.get('link', ''))

        # For Scholar/non-DOI links: lookup DOI from title via CrossRef
        if not doi:
            title = str(row.get('judul', '')).strip()
            if title and title not in ('', 'Untitled'):
                doi = lookup_doi_by_title(title)
                if doi:
                    time.sleep(0.1)

        fwci = None
        if doi:
            fwci = fetch_openalex_fwci(doi)
            fetched += 1
            time.sleep(0.12)
        fwci_values.append(fwci)

    df['_fwci'] = fwci_values
    found = sum(1 for v in fwci_values if v is not None)
    print(f"   OpenAlex: {found}/{fetched} papers enriched with fwci")
    return df


def citation_score(df):
    """
    Log-normalized citation count, weighted by paper age.
    Recency weighting: citations per year since publication.
    New papers (≤2 years) with 0 citations get a small baseline.
    Very old papers with 0 citations get penalized.
    """
    if 'citationCount' not in df.columns:
        df['citationCount'] = 0

    citations = pd.to_numeric(df['citationCount'], errors='coerce').fillna(0).clip(lower=0)
    years     = pd.to_numeric(df['tahun'], errors='coerce').fillna(CURRENT_YEAR)

    
    age = (CURRENT_YEAR - years).clip(lower=1)

    
    velocity = citations / age

    
    log_vel = velocity.apply(lambda v: math.log1p(v))
    max_vel = log_vel.max()

    if max_vel == 0:
        base_score = pd.Series([0.0] * len(df), index=df.index)
    else:
        base_score = (log_vel / max_vel * 100).clip(0, 100)

    
    # Recency bonus: new papers get graduated bonus based on how new they are
    # age=1 → +20, age=2 → +15, age=3 → +10 (instead of flat +15 for all ≤2yr)
    recency_bonus = pd.Series(0.0, index=df.index)
    recency_bonus = recency_bonus.where(age > 1, 20.0)   # age == 1
    recency_bonus = recency_bonus.where(age != 2, recency_bonus)
    recency_bonus[(age == 2) & (citations == 0)] = 15.0
    recency_bonus[(age == 3) & (citations == 0)] = 10.0
    # Only apply to papers with 0 citations
    recency_bonus = recency_bonus.where(citations == 0, 0.0)

    
    old_zero_penalty = ((age >= 5) & (citations == 0)).astype(float) * 10

    # Tiebreaker for same-score papers: use abstract length as quality proxy
    # Papers with longer, more informative abstracts rank slightly higher
    abs_lengths = df.get('abstrak_lengkap', pd.Series([''] * len(df), index=df.index))
    abs_lengths = abs_lengths.fillna('').astype(str).map(len)
    max_abs_len = abs_lengths.max()
    abs_tiebreak = (abs_lengths / max_abs_len * 5).clip(0, 5) if max_abs_len > 0 else pd.Series(0.0, index=df.index)

    final = (base_score + recency_bonus - old_zero_penalty + abs_tiebreak).clip(0, 100)

    # ── OpenAlex fwci boost ──────────────────────────────────────────────────
    # fwci > 1.0 = cited more than field average → boost up to +20 pts
    # fwci between 0-1 = below average → no change (don't penalize new papers)
    # fwci = None → no change
    if '_fwci' in df.columns:
        def fwci_boost(fwci_val):
            if fwci_val is None or (isinstance(fwci_val, float) and math.isnan(fwci_val)):
                return 0.0
            f = float(fwci_val)
            if f <= 0:
                return 0.0
            # log-scale boost: fwci=1 → +0, fwci=2 → +7, fwci=5 → +14, fwci=10 → +20
            return min(math.log1p(f) * 10, 20.0)

        fwci_series = df['_fwci'].apply(fwci_boost)
        final = (final + fwci_series).clip(0, 100)

    return final

UNAVAILABLE_PATTERNS = [
    'abstract not available', 'not available', 'info: this is a book',
    'book/citation preview', 'n/a', ''
]

def abstract_quality_score(df):
    """
    Scores based on:
    - Abstract exists and is not a placeholder   (+60 base)
    - Abstract length > 200 chars                (+20)
    - Abstract length > 500 chars                (+10 more)
    - Contains academic signal words             (+10)
    - Abstract missing / placeholder             (0)
    """
    ACADEMIC_SIGNALS = [
        'this study', 'this paper', 'we propose', 'results show', 'results indicate',
        'we present', 'in this work', 'findings suggest', 'analysis', 'conclusion',
        'background', 'objective', 'method', 'purpose', 'aim', 'abstract'
    ]

    def score_abstract(row):
        abstract = str(row.get('abstrak_lengkap', '')).strip().lower()

        if not abstract or any(abstract.startswith(p) for p in UNAVAILABLE_PATTERNS):
            return 0.0

        s = 60.0
        if len(abstract) > 200: s += 20
        if len(abstract) > 500: s += 10
        if any(sig in abstract for sig in ACADEMIC_SIGNALS): s += 10
        return min(s, 100.0)

    return df.apply(score_abstract, axis=1)

def access_score(df):
    """
    Binary: open access = 100, paywalled/unknown = 0.
    Also infers open access from link patterns (arxiv, semanticscholar pdf, etc.)
    """
    def is_open(row):
        
        if row.get('isOpenAccess') is True:
            return 100.0

        link = str(row.get('link', '')).lower()
        open_domains = ['arxiv.org', 'semanticscholar.org', 'researchgate.net',
                        'ncbi.nlm.nih.gov', 'plos', 'frontiersin.org', 'mdpi.com',
                        'hindawi.com', 'springeropen', 'doaj.org', '.pdf']
        if any(d in link for d in open_domains):
            return 100.0

        
        abstract = str(row.get('abstrak_lengkap', '')).lower()
        has_abstract = abstract and not any(abstract.startswith(p) for p in UNAVAILABLE_PATTERNS)
        if has_abstract and link and link != 'none':
            return 50.0  

        return 0.0

    return df.apply(is_open, axis=1)

def compute_quality_score(df, search_keyword):
    """
    Final score = weighted average of 4 components.
    Weights:
        Keyword relevance  50%
        Citation score     25%
        Abstract quality   15%
        Access bonus       10%
    """
    w_kw  = 0.50  # keyword relevance — most important, user search intent
    w_cit = 0.25  # citation score — quality signal
    w_abs = 0.15  # abstract quality
    w_acc = 0.10  # access bonus

    print(" Computing keyword relevance...")
    s_kw  = keyword_relevance_score(df, search_keyword)

    print(" Computing citation score...")
    s_cit = citation_score(df)

    print(" Computing abstract quality...")
    s_abs = abstract_quality_score(df)

    print(" Computing access score...")
    s_acc = access_score(df)

    composite = (s_kw * w_kw + s_cit * w_cit + s_abs * w_abs + s_acc * w_acc)
    df['Relevansi']       = composite.round(1)
    df['_score_keyword']  = s_kw.round(1)
    df['_score_citation'] = s_cit.round(1)
    df['_score_abstract'] = s_abs.round(1)
    df['_score_access']   = s_acc.round(1)

    return df

def access_label(row):
    score = row.get('_score_access', 0)
    if score >= 100: return ' Open Access'
    if score >= 50:  return ' Likely Readable'
    return ' Restricted'

def proses_data():
    
    
    job_id         = sys.argv[4] if len(sys.argv) > 4 else 'standalone'
    input_f        = f'../data/jurnal_mentah_{job_id}.json'
    output_xlsx    = f'../data/jurnal_siap_skripsi_{job_id}.xlsx'
    output_json    = f'../data/jurnal_bersih_{job_id}.json'

    search_keyword = sys.argv[1] if len(sys.argv) > 1 else ''
    year_from      = int(sys.argv[2]) if len(sys.argv) > 2 else 2020
    year_to        = int(sys.argv[3]) if len(sys.argv) > 3 else CURRENT_YEAR

    if not os.path.exists(input_f):
        print(f"Error: {input_f} not found")
        return

    with open(input_f, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Merge Scrapling supplementary data if available
    scrapling_f = f'../data/scrapling_raw_{job_id}.json'
    if os.path.exists(scrapling_f):
        try:
            with open(scrapling_f, 'r', encoding='utf-8') as f:
                scrapling_data = json.load(f)
            if scrapling_data:
                data = data + scrapling_data
                print(f" Merged {len(scrapling_data)} entries from Scrapling source.")
        except Exception as e:
            print(f" Warning: Failed to merge Scrapling data: {e}")
    
    # Merge OpenAlex data if available
    openalex_f = f'../data/openalex_raw_{job_id}.json'
    if os.path.exists(openalex_f):
        try:
            with open(openalex_f, 'r', encoding='utf-8') as f:
                openalex_data = json.load(f)
            if openalex_data:
                data = data + openalex_data
                print(f" Merged {len(openalex_data)} entries from OpenAlex source.")
        except Exception as e:
            print(f" Warning: Failed to merge OpenAlex data: {e}")

    if not data:
        print("Info: Data is empty")
        # Ensure output file exists even if empty to satisfy backend checks
        with open(output_json, 'w', encoding='utf-8') as f:
            f.write('[]')
        return

    df = pd.DataFrame(data)
    print(f" Loaded {len(df)} raw entries.")

    
    df = clean_df(df)

    
    if 'tahun' in df.columns:
        df['_year_int'] = pd.to_numeric(df['tahun'], errors='coerce')
        before = len(df)
        df = df[df['_year_int'].isna() | ((df['_year_int'] >= year_from) & (df['_year_int'] <= year_to))]
        df = df.drop(columns=['_year_int'])
        if len(df) < before:
            print(f" Year filter ({year_from}{year_to}): removed {before - len(df)} entries")

    
    
    if 'keyword' not in df.columns:
        df['keyword'] = search_keyword
    else:
        df['keyword'] = df['keyword'].fillna(search_keyword).replace('', search_keyword)

    
    for col, default in [('isBook', False), ('source', 'Unknown'),
                         ('citationCount', 0), ('isOpenAccess', False)]:
        if col not in df.columns:
            df[col] = default

    
    df['Kategori'] = df.apply(extract_categories, axis=1)

    # Enrich with OpenAlex fwci
    df = enrich_with_openalex(df)

    
    df = compute_quality_score(df, search_keyword)

    
    df['Akses'] = df.apply(access_label, axis=1)

    df = df.sort_values('Relevansi', ascending=False).reset_index(drop=True)

    
    df['_judul_norm'] = df['judul'].str.lower().str.replace(r'[^\w\s]', '', regex=True).str.replace(r'\s+', ' ', regex=True).str.strip()

    
    before_dedup = len(df)
    df = df.drop_duplicates(subset=['_judul_norm'], keep='first')
    df = df.drop(columns=['_judul_norm'])
    removed_exact = before_dedup - len(df)
    if removed_exact:
        print(f" Exact dedup: removed {removed_exact} duplicate title(s)")

    df = df.reset_index(drop=True)

    
    df = detect_duplicates(df, threshold=0.72)

    
    before_jaccard = len(df)
    df = df[df['isDuplicateSuspect'] == ''].reset_index(drop=True)
    removed_jaccard = before_jaccard - len(df)
    if removed_jaccard:
        print(f" Near-dedup: removed {removed_jaccard} near-duplicate(s)")

    print(f"\n Top 5 by quality score:")
    for _, row in df.head(5).iterrows():
        print(f"  [{row['Relevansi']:.0f}] {str(row['judul'])[:60]} "
              f"| cit:{int(row.get('citationCount',0))} | {row.get('Akses','')}")

    
    cols_to_save = [
        'tahun', 'judul', 'author_info', 'link',
        'abstrak_lengkap', 'Kategori', 'Relevansi',
        'citationCount', 'Akses', 'source', 'isBook',
        'keyword', 'journal', 'isDuplicateSuspect', 'duplicateOf'
    ]
    for col in cols_to_save:
        if col not in df.columns:
            df[col] = None

    df_final = df[cols_to_save]

    
    try:
        writer = pd.ExcelWriter(output_xlsx, engine='xlsxwriter')
        df_final.to_excel(writer, index=False, sheet_name='Hasil Jurnal')
        worksheet = writer.sheets['Hasil Jurnal']
        for i, col in enumerate(df_final.columns):
            try:
                col_series = df_final[col].fillna('').astype(str).map(len)
                max_raw = col_series.max()
                max_val = int(max_raw) if pd.notna(max_raw) and max_raw == max_raw else 0
            except Exception:
                max_val = 0
            max_len = max(max_val, len(str(col))) + 2
            worksheet.set_column(i, i, min(max_len, 70))
        writer.close()
        print(f" Excel saved: {output_xlsx}")
    except Exception as e:
        print(f"Warning: Excel save failed: {e}")

    
    df_final.to_json(output_json, orient='records', force_ascii=False)
    print(f" Processed {len(df_final)} items → '{search_keyword}'")

if __name__ == "__main__":
    proses_data()