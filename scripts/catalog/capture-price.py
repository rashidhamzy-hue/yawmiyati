"""Extract a comparable price from a saved retailer page using exact Product identity."""
import argparse
import json
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from datetime import datetime, timezone

MARKETS = {"sa": ("SAR", 2), "ae": ("AED", 2), "om": ("OMR", 3), "eg": ("EGP", 2), "iq": ("IQD", 3)}

class StructuredData(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.chunks = []
        self.blocks = []

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            self.active = dict(attrs).get("type", "").lower().strip() == "application/ld+json"
            self.chunks = []

    def handle_data(self, data):
        if self.active:
            self.chunks.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.active:
            self.active = False
            self.blocks.append("".join(self.chunks))

def objects(value):
    if isinstance(value, list):
        for child in value:
            yield from objects(child)
    elif isinstance(value, dict):
        yield value
        for child in value.values():
            yield from objects(child)

def has_type(obj, name):
    types = obj.get("@type", [])
    return any(str(t).rsplit("/", 1)[-1] == name for t in (types if isinstance(types, list) else [types]))

def minor(value, digits):
    amount = Decimal(str(value)) * 10 ** digits
    if not amount.is_finite() or amount < 0 or amount != amount.to_integral_value() or amount > 2**53 - 1:
        raise ValueError("Invalid local currency amount")
    return int(amount)

def capture(args):
    parsed = urlparse(args.url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Supply a public HTTPS source URL")
    stamp = datetime.fromisoformat(args.observed.replace("Z", "+00:00"))
    if stamp.tzinfo is None or stamp > datetime.now(timezone.utc):
        raise ValueError("Supply the actual capture time with timezone")
    parser = StructuredData()
    if args.page:
        html = Path(args.page).read_text(encoding="utf-8")
    else:
        with urlopen(Request(args.url, headers={"User-Agent": "Yawmiyati product research/1.0"}), timeout=15) as response:
            if urlparse(response.geturl()).netloc != parsed.netloc or response.headers.get_content_type() != "text/html":
                raise ValueError("Retailer returned a different site or unsupported content type")
            raw = response.read(4_000_001)
            if len(raw) > 4_000_000:
                raise ValueError("Retailer page exceeds size limit")
            html = raw.decode(response.headers.get_content_charset() or "utf-8")
    parser.feed(html)
    currency, digits = MARKETS[args.market]
    prices = set()
    for block in parser.blocks:
        try:
            tree = json.loads(block, parse_float=Decimal)
        except ValueError:
            continue
        for obj in objects(tree):
            if not has_type(obj, "Product") or str(obj.get(args.id_field, "")) != args.identity:
                continue
            offers = obj.get("offers", [])
            for offer in offers if isinstance(offers, list) else [offers]:
                if not isinstance(offer, dict) or not has_type(offer, "Offer") or offer.get("priceCurrency") != currency:
                    continue
                if str(offer.get("availability", "")).rsplit("/", 1)[-1] != "InStock":
                    continue
                if "price" in offer:
                    prices.add(minor(offer["price"], digits))
    if len(prices) != 1 or 0 in prices:
        raise ValueError("No unambiguous in-stock exact product and price in this market")
    return {"market": args.market, "productKey": args.product_key, "currency": currency,
            "seller": parsed.hostname, "url": args.url, "observedAt": args.observed,
            "price": prices.pop(), "shipping": minor(args.shipping, digits) if args.shipping is not None else None}

if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    source = cli.add_mutually_exclusive_group(required=True)
    source.add_argument("--page", help="Previously saved retailer HTML")
    source.add_argument("--fetch", action="store_true", help="Read the supplied public retailer URL once")
    for field in ["url", "product-key", "identity", "observed"]:
        cli.add_argument("--" + field, required=True)
    cli.add_argument("--id-field", choices=["sku", "gtin", "gtin13", "gtin14", "mpn"], required=True)
    cli.add_argument("--market", choices=MARKETS, required=True)
    cli.add_argument("--shipping", help="verified customer delivery charge in major currency units")
    try:
        print(json.dumps(capture(cli.parse_args()), ensure_ascii=False))
    except (ValueError, InvalidOperation, OSError) as error:
        cli.exit(1, str(error) + "\n")
