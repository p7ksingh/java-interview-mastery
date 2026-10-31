#!/usr/bin/env python3
"""
parse_md.py — Parse the 14 industry Java-interview MD files into structured JSON
for the java-interview-website.

Outputs (under data/):
  - chapters.json        : list of chapters with answer counts + metadata
  - search-index.json    : lightweight [{id, question, chapter, chapterTitle}]
  - ch{NN}.json          : full structured content, one file per chapter

Run:  python3 parse_md.py
"""

import json
import os
import re
import sys

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SRC_DIR = "/Users/PASINGH2501/ct-ned-docs/java-interview-final"
OUT_DIR = "/Users/PASINGH2501/java-interview-website/data"

# ---------------------------------------------------------------------------
# Canonical chapter titles (1..28). Combined/empty chapters still get a title.
# ---------------------------------------------------------------------------
CHAPTER_TITLES = {
    1: "Core Java",
    2: "OOP",
    3: "Collections",
    4: "Exception Handling",
    5: "Concurrency & Multithreading",
    6: "Java 8+ Functional",
    7: "Spring & Spring Boot",
    8: "Transactions",
    9: "JPA & Hibernate",
    10: "Microservices",
    11: "Kafka & Messaging",
    12: "DevOps, Build, Git & Tooling",
    13: "Database & SQL",
    14: "REST API & Web",
    15: "Design Patterns & Principles",
    16: "Advanced Java",
    17: "Coding Problems (DSA / Java)",
    18: "AWS & Cloud",
    19: "DevOps",
    20: "Data Engineering",
    21: "QA, Testing & SDET",
    22: "Java 8 Practical Coding",
    23: "Behavioral / HR (STAR Method)",
    24: "System Design",
    25: "Security",
    26: "JVM Internals",
    27: "Architecture & Patterns",
    28: "Miscellaneous / Advanced",
}

# ---------------------------------------------------------------------------
# File -> chapter range mapping.
#   single: chapter is fixed by the filename.
#   combined: chapter is detected from in-document "## ... Chapter NN" banners,
#             seeded with the first chapter in the range.
# ---------------------------------------------------------------------------
FILE_MAP = [
    ("java-interview-answers-ch01-core-java-industry.md", [1]),
    ("java-interview-answers-ch02-oop-industry.md", [2]),
    ("java-interview-answers-ch03-collections-industry.md", [3]),
    ("java-interview-answers-ch04-exceptions-industry.md", [4]),
    ("java-interview-answers-ch05-concurrency-industry.md", [5]),
    ("java-interview-answers-ch06-java8-industry.md", [6]),
    ("java-interview-answers-ch07-spring-industry.md", [7]),
    ("java-interview-answers-ch08-transactions-industry.md", [8]),
    ("java-interview-answers-ch09-jpa-industry.md", [9]),
    ("java-interview-answers-ch10-microservices-industry.md", [10]),
    ("java-interview-answers-ch11-kafka-industry.md", [11]),
    ("java-interview-answers-ch12-13-devops-db-industry.md", [12, 13]),
    ("java-interview-answers-ch14-16-rest-patterns-advanced-industry.md", [14, 15, 16]),
    ("java-interview-answers-ch17-28-remaining-industry.md",
     [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]),
]

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------
# Answer header:  "### ☑ Q177. <title>" or "### ☑ Q576b. <title>" or "### ☑ Q177-collections. <title>"
# Capture: full id (digits + optional suffix) and the numeric part separately.
ANSWER_HDR_RE = re.compile(r"^###\s*☑\s*Q(\d+)([a-zA-Z]*(?:-[a-zA-Z0-9]+)?)\.\s*(.*)$")
# Chapter banner (level-2 header mentioning a chapter number), e.g.
#   "## Chapter 15 — Design Patterns & Principles"           (START banner)
#   "## 🏆 CHAPTER 15 — DESIGN PATTERNS & PRINCIPLES — COMPLETE! ..."  (END banner)
CHAPTER_BANNER_RE = re.compile(r"^##\s+.*?\b[Cc][Hh][Aa][Pp][Tt][Ee][Rr]\s+(\d+)\b")
# Full-question line:  "> Full question: ...."
FULL_Q_RE = re.compile(r"^>\s*Full question:\s*(.*)$", re.IGNORECASE)
# Sub-section heading:  "#### 4a. Project Structure"
SUBSEC_RE = re.compile(r"^####\s+([0-9]+[a-zA-Z]?)\.\s*(.*)$")

# Map numeric/alpha sub-section ids -> our schema field names.
SECTION_FIELD_MAP = {
    "1": "s1_definition",
    "2": "s2_technical",
    "3": "s3_banking",
    "4": "s4_code_intro",   # "#### 4. Complete Code" intro (kept but not in schema output root)
    "4a": "s4a_structure",
    "4b": "s4b_config",
    "4c": "s4c_config",
    "4d": "s4d_java",
    "4e": "s4e_build",
    "5": "s5_journey",
    "5a": "s5_journey",
    "5b": "s5b_flow",
    "5c": "s5c_hld",
    "5d": "s5d_lld",
    "6": "s6_takeaway",
}

# The exact set of section fields emitted per answer (order preserved).
SECTION_FIELDS = [
    "s1_definition", "s2_technical", "s3_banking",
    "s4a_structure", "s4d_java", "s4e_build",
    "s5_journey", "s5b_flow", "s5c_hld", "s5d_lld",
    "s6_takeaway",
]


# ---------------------------------------------------------------------------
# S1 extraction helpers
# ---------------------------------------------------------------------------
def extract_s1_parts(s1_text):
    """From the 'Simple Definition' section text, pull the three key lines.

    Handles the colon being inside OR outside the bold markers, e.g.
      **Professional definition:** Java exceptions ...
      **One line to remember:** Checked = ...
    """
    def grab(label):
        # Match "**Label** ...", "**Label:** ...", or "**Label :** ..." then
        # capture up to the next bold-label line or a blank line.
        pat = re.compile(
            r"\*\*\s*%s\s*:?\s*\*\*\s*:?\s*(.*?)(?=\n\s*\n|\n\s*\*\*|$)"
            % re.escape(label),
            re.IGNORECASE | re.DOTALL,
        )
        m = pat.search(s1_text)
        return m.group(1).strip() if m else ""

    profdef = grab("Professional definition")
    # Analogy label variants.
    analogy = (grab("In simple words (banking analogy)")
               or grab("In simple words")
               or grab("Banking analogy"))
    oneliner = grab("One line to remember")
    return {"profdef": profdef, "analogy": analogy, "oneliner": oneliner}


# ---------------------------------------------------------------------------
# Answer-block parsing
# ---------------------------------------------------------------------------
def parse_sections(body_lines):
    """Split an answer body into sub-sections at '#### N.' headings."""
    sections = {}
    current_key = None
    buf = []

    def flush():
        if current_key is not None:
            text = "\n".join(buf).strip()
            # If the same mapped field appears twice, concatenate.
            if current_key in sections and sections[current_key]:
                sections[current_key] += "\n\n" + text
            else:
                sections[current_key] = text

    for line in body_lines:
        m = SUBSEC_RE.match(line)
        if m:
            flush()
            buf = []
            sub_id = m.group(1).lower()
            current_key = SECTION_FIELD_MAP.get(sub_id)
            if current_key is None:
                # Unknown sub-section id -> park under a catch-all so content is not lost.
                current_key = "s_other_" + sub_id
            continue
        if current_key is not None:
            buf.append(line)
    flush()
    return sections


def build_answer(id_str, qnum, question_title, chapter, full_question, body_lines):
    raw_sections = parse_sections(body_lines)

    s1_text = raw_sections.get("s1_definition", "")
    s1 = extract_s1_parts(s1_text)
    s1["raw"] = s1_text

    sections = {"s1_definition": s1}
    for field in SECTION_FIELDS:
        if field == "s1_definition":
            continue
        sections[field] = raw_sections.get(field, "")

    question = full_question.strip() if full_question else question_title.strip()

    return {
        "id": "Q%s" % id_str,
        "qnum": qnum,
        "question": question,
        "shortTitle": question_title.strip(),
        "chapter": chapter,
        "chapterTitle": CHAPTER_TITLES.get(chapter, "Chapter %d" % chapter),
        "sections": sections,
    }


def parse_file(path, chapter_range):
    """Parse one MD file, yielding answer dicts with chapter assignment.

    Chapter assignment:
      * single-chapter file -> fixed chapter.
      * combined file -> use "... CHAPTER NN ... COMPLETE" banners as the
        authoritative END boundary of chapter NN. Every answer appearing at or
        before a completion banner (and after the previous one) belongs to that
        chapter. This is robust even when a chapter has no START banner
        (e.g. Ch17 and Ch22 only have completion banners).
    """
    with open(path, "r", encoding="utf-8") as fh:
        lines = fh.read().split("\n")

    combined = len(chapter_range) > 1
    n = len(lines)
    range_set = set(chapter_range)

    # Collect answer headers and completion banners in a single pass.
    headers = []          # (line_idx, id_str, qnum, title)
    completions = []      # (line_idx, chapter)  -- END boundaries, in order

    for i, line in enumerate(lines):
        am = ANSWER_HDR_RE.match(line)
        if am:
            qnum = int(am.group(1))
            suffix = am.group(2) or ""
            id_str = am.group(1) + suffix
            headers.append((i, id_str, qnum, am.group(3).strip()))
            continue
        if combined:
            bm = CHAPTER_BANNER_RE.match(line)
            if bm and "COMPLETE" in line.upper():
                ch = int(bm.group(1))
                if ch in range_set:
                    completions.append((i, ch))

    def chapter_for(line_idx):
        if not combined:
            return chapter_range[0]
        # First completion banner strictly after this header.
        for b_idx, ch in completions:
            if b_idx > line_idx:
                return ch
        # Fallback: no completion banner follows -> last chapter in range.
        return chapter_range[-1]

    answers = []
    for idx, (line_idx, id_str, qnum, title) in enumerate(headers):
        start = line_idx + 1
        end = headers[idx + 1][0] if idx + 1 < len(headers) else n
        body = lines[start:end]
        fq = None
        for bl in body[:10]:
            fm = FULL_Q_RE.match(bl)
            if fm:
                fq = fm.group(1).strip()
                break
        chapter = chapter_for(line_idx)
        answers.append(build_answer(id_str, qnum, title, chapter, fq, body))

    return answers


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    all_answers = []
    per_file_counts = []

    for fname, chapter_range in FILE_MAP:
        path = os.path.join(SRC_DIR, fname)
        if not os.path.exists(path):
            print("WARNING: missing source file: %s" % path, file=sys.stderr)
            per_file_counts.append((fname, 0))
            continue
        answers = parse_file(path, chapter_range)
        per_file_counts.append((fname, len(answers)))
        all_answers.extend(answers)

    # Group by chapter.
    by_chapter = {}
    for a in all_answers:
        by_chapter.setdefault(a["chapter"], []).append(a)

    # Sort each chapter's answers by original question number for stable order.
    for ch in by_chapter:
        by_chapter[ch].sort(key=lambda x: x["qnum"])

    # Write per-chapter full-content files.
    chapters_meta = []
    for ch in sorted(by_chapter.keys()):
        items = by_chapter[ch]
        ch_file = "ch%02d.json" % ch
        with open(os.path.join(OUT_DIR, ch_file), "w", encoding="utf-8") as fh:
            json.dump(
                {
                    "chapter": ch,
                    "chapterTitle": CHAPTER_TITLES.get(ch, "Chapter %d" % ch),
                    "count": len(items),
                    "answers": items,
                },
                fh,
                ensure_ascii=False,
                indent=1,
            )
        chapters_meta.append({
            "chapter": ch,
            "chapterTitle": CHAPTER_TITLES.get(ch, "Chapter %d" % ch),
            "count": len(items),
            "file": ch_file,
        })

    # chapters.json
    with open(os.path.join(OUT_DIR, "chapters.json"), "w", encoding="utf-8") as fh:
        json.dump(
            {"totalAnswers": len(all_answers),
             "totalChapters": len(chapters_meta),
             "chapters": chapters_meta},
            fh, ensure_ascii=False, indent=1,
        )

    # search-index.json (lightweight)
    search_index = [
        {"id": a["id"], "question": a["question"],
         "chapter": a["chapter"], "chapterTitle": a["chapterTitle"]}
        for a in sorted(all_answers, key=lambda x: (x["chapter"], x["qnum"]))
    ]
    with open(os.path.join(OUT_DIR, "search-index.json"), "w", encoding="utf-8") as fh:
        json.dump(search_index, fh, ensure_ascii=False, indent=1)

    # ---- Report ----
    print("=== Per-file answer counts ===")
    for fname, cnt in per_file_counts:
        print("  %5d  %s" % (cnt, fname))
    print("  -----")
    print("  %5d  TOTAL parsed" % len(all_answers))
    print()
    print("=== Per-chapter counts ===")
    for m in chapters_meta:
        print("  Ch%-2d  %5d  %s" % (m["chapter"], m["count"], m["chapterTitle"]))
    print()
    print("Wrote %d chapter files + chapters.json + search-index.json to %s"
          % (len(chapters_meta), OUT_DIR))


if __name__ == "__main__":
    main()
