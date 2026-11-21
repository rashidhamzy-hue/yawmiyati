"""Read an English Google Trends weekly comparison export, keeping the common benchmark."""
import argparse
import csv
import json
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path

def collect(args):
    rows = list(csv.reader(Path(args.file).read_text(encoding="utf-8-sig").splitlines()))
    header = next((i for i,row in enumerate(rows) if row and row[0] == "Week"), None)
    if header is None:
        raise ValueError("Expected an English weekly interest-over-time CSV")
    columns = rows[header]
    if args.term == args.anchor or columns.count(args.term) != 1 or columns.count(args.anchor) != 1:
        raise ValueError("Supply distinct exact product and common benchmark columns")
    term, anchor = columns.index(args.term), columns.index(args.anchor)
    observations = []
    now = datetime.fromisoformat(args.observed.replace("Z","+00:00"))
    if now.tzinfo is None or now > datetime.now(timezone.utc):
        raise ValueError("Invalid observation time")
    for row in rows[header+1:]:
        if not row: continue
        week = date.fromisoformat(row[0])
        if week + timedelta(days=7) > now.date() or (now.date()-week).days > 35: continue
        def number(value):
            if value == "<1": return Decimal("0.5")
            n = Decimal(value)
            if not n.is_finite() or not 0 <= n <= 100: raise ValueError("Invalid Trends index")
            return n
        observations.append((week, number(row[term]), number(row[anchor])))
    if not observations or len({x[0] for x in observations}) != len(observations): raise ValueError("Missing or duplicate recent complete weeks")
    demand = sum(x[1] for x in observations)
    benchmark = sum(x[2] for x in observations)
    if benchmark <= 0: raise ValueError("Benchmark has no measurable interest")
    return {"market":args.market,"productKey":args.product_key,"metric":"search_interest_index",
            "url":args.url,"observedAt":args.observed,"value":round(float(100*demand/(demand+benchmark)),2),
            "benchmark":args.anchor,"term":args.term,"weeks":sorted(str(x[0]) for x in observations)}
if __name__ == "__main__":
    cli=argparse.ArgumentParser(description=__doc__)
    for k in ["file","term","anchor","product-key","observed","url"]: cli.add_argument("--"+k,required=True)
    cli.add_argument("--market",choices=["sa","ae","om","eg","iq"],required=True)
    args=cli.parse_args()
    from urllib.parse import urlparse, parse_qs
    url=urlparse(args.url)
    if url.scheme!="https" or url.hostname!="trends.google.com" or parse_qs(url.query).get("geo")!=[args.market.upper()]:
        cli.error("Use the country-specific Google Trends explore URL")
    try: print(json.dumps(collect(args),ensure_ascii=False))
    except (ValueError,ArithmeticError,IndexError,OSError) as error: cli.exit(1,str(error)+"\n")
