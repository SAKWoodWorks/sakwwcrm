"""Backfill documents.salesperson_id from gdrive_filename for docs with NULL salesperson."""
import os
import re
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Ordered rules: pairs first (more specific), then singles
# (keyword_patterns, salesperson_id)
RULES = [
    # Pairs
    (["pickachu", "wanida"],                37),   # Pickachu + Wanida
    (["pickachu", "jane"],                  28),   # Pickachu+Jane
    (["jane", "pickachu"],                  28),
    (["pickachu", "zoom"],                  36),   # Pickachu + Zoom
    (["zoom", "pickachu"],                  36),
    (["pickachu", "phakh"],                 41),   # Pickachu + Phakhaphon
    (["phakh", "pickachu"],                 41),
    (["alex", "wanida"],                    42),   # Alex + Wanida
    (["alex", "pickachu"],                  59),   # Alex+Pickachu
    # Singles
    (["pickachu"],                          8),
    (["pikachu"],                           8),
    (["yaowalee"],                          9),
    (["wanida"],                            16),
    (["jane"],                              22),
    (["kung"],                              17),
    (["sirirat"],                           13),
    (["sirriat"],                           13),
    (["phakh"],                             40),
    (["zoom"],                              38),
    (["konstantin"],                        61),
    (["kostya"],                            61),
    (["poramate"],                          54),
    (["shopee"],                            15),
    (["lazada"],                            18),
]


def match_salesperson(filename: str) -> int | None:
    fn = filename.lower()
    for keywords, sp_id in RULES:
        if all(kw in fn for kw in keywords):
            return sp_id
    return None


def main():
    db_url = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(db_url)

    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, gdrive_filename FROM documents
            WHERE salesperson_id IS NULL AND gdrive_filename IS NOT NULL
        """)
        rows = cur.fetchall()

    print(f"Null salesperson docs: {len(rows)}")

    updates = {}   # sp_id -> [doc_ids]
    unmatched = []

    for doc_id, filename in rows:
        sp_id = match_salesperson(filename or "")
        if sp_id:
            updates.setdefault(sp_id, []).append(doc_id)
        else:
            unmatched.append((doc_id, filename))

    matched = sum(len(v) for v in updates.values())
    print(f"Matched: {matched}, Unmatched: {len(unmatched)}")

    with conn.cursor() as cur:
        for sp_id, doc_ids in updates.items():
            cur.execute(
                "UPDATE documents SET salesperson_id = %s WHERE id = ANY(%s)",
                (sp_id, doc_ids)
            )
    conn.commit()
    conn.close()

    print("Done.")
    if unmatched:
        print(f"\nUnmatched ({len(unmatched)} docs):")
        for doc_id, fn in unmatched[:20]:
            print(f"  {doc_id}: {fn}")


if __name__ == "__main__":
    main()
