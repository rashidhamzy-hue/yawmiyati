"""Collect one market's merchant feeds once, then fetch regional interest per unique term."""
import argparse
import hashlib
import json
import os
import tempfile
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import xml.etree.ElementTree as ET

CURRENCIES = {"sa":("SAR",2),"ae":("AED",2),"om":("OMR",3),"eg":("EGP",2),"iq":("IQD",3)}
G = "{http://base.google.com/ns/1.0}"

def fetch(url):
    if urlparse(url).scheme != "https": raise ValueError("HTTPS source required")
    with urlopen(Request(url, headers={"User-Agent":"Yawmiyati catalog research/1.0"}),timeout=20) as response:
        raw=response.read(16_000_001)
        if len(raw)>16_000_000: raise ValueError("Source exceeds feed limit")
        return raw

def atomic(path, value):
    with tempfile.NamedTemporaryFile(dir=path.parent,mode="w",delete=False,encoding="utf-8") as f:
        json.dump(value,f,ensure_ascii=False); name=f.name
    os.replace(name,path)

def gtin(s):
    if not isinstance(s,str) or len(s) not in (8,12,13,14) or not s.isascii() or not s.isdigit():return None
    if (sum(int(x)*(3 if i%2==0 else 1) for i,x in enumerate(reversed(s[:-1])))+int(s[-1]))%10:return None
    return s.zfill(14)

def minor(text,market):
    number,currency=text.split()
    cur,digits=CURRENCIES[market]
    amount=Decimal(number)*10**digits
    if currency!=cur or not amount.is_finite() or amount<0 or amount!=int(amount) or amount>2**53-1:raise ValueError()
    return int(amount)

def merchant(feed,market,stamp,get):
    body=get(feed)
    if b"<!DOCTYPE" in body.upper():raise ValueError("Unsupported feed document")
    index={}
    for item in ET.fromstring(body).iter("item"):
        try:
            identity=gtin(item.findtext(G+"gtin")); link=item.findtext("link") or item.findtext(G+"link") or ""
            if not identity or urlparse(link).scheme!="https" or item.findtext(G+"availability","").replace("_"," ")!="in stock":continue
            # Manufacturer pack GTIN is the identifier. Merchant-created multipacks and kits need explicit review.
            if item.findtext(G+"multipack","1")!="1" or item.findtext(G+"is_bundle","no").lower() not in ("no","false"):continue
            price=minor(item.findtext(G+"price",""),market)
            shipping={minor(s.findtext(G+"price",""),market) for s in item.findall(G+"shipping")
                      if s.findtext(G+"country","").lower()==market and all(k.tag in (G+"country",G+"price",G+"service") for k in s)}
            if len(shipping)!=1 or price<=0:continue
            index.setdefault(identity,[]).append(dict(currency=CURRENCIES[market][0],url=link,seller=urlparse(link).hostname,
                observedAt=stamp,price=price,shipping=shipping.pop(),feed=feed))
        except (ValueError,InvalidOperation,AttributeError):continue
    return index

def trend_json(url,get):
    body=get(url).decode().lstrip()
    if body.startswith(")]}'"):body=body.split("\n",1)[-1]
    return json.loads(body)

def interest(market,term,anchor,now,get):
    if not anchor or term==anchor:raise ValueError("Distinct benchmark required")
    geo=market.upper()
    base="https://trends.google.com/trends/"
    spec={"comparisonItem":[{"keyword":k,"geo":geo,"time":"today 3-m"} for k in [term,anchor]],"category":0,"property":""}
    args={"hl":"en-US","tz":"0","req":json.dumps(spec)}
    widgets=trend_json(base+"api/explore?"+urlencode(args),get)["widgets"]
    widget=next(w for w in widgets if w["id"]=="TIMESERIES")
    timeline=trend_json(base+"api/widgetdata/multiline?"+urlencode({**args,"req":json.dumps(widget["request"]),"token":widget["token"]}),get)
    values=[r["value"] for r in timeline["default"]["timelineData"] if not r.get("isPartial")
            and now-timedelta(days=30)<=datetime.fromtimestamp(int(r["time"]),timezone.utc)<now-timedelta(days=1)]
    if not values or any(len(v)!=2 or any(type(n) is not int or not 0<=n<=100 for n in v) for v in values):raise ValueError("No comparable demand series")
    product=sum(v[0] for v in values); reference=sum(v[1] for v in values)
    if reference==0:raise ValueError("No measurable benchmark")
    return dict(metric="search_interest_index",value=round(100*product/(product+reference),2),benchmark=anchor,term=term,
        url=base+"explore?"+urlencode({"geo":geo,"date":"today 3-m","q":term+","+anchor}),observedAt=now.isoformat())

def collect(root,get=fetch,now=None):
    now=now or datetime.now(timezone.utc); stamp=now.isoformat()
    catalog=json.loads((root/"catalog.json").read_text());config=json.loads((root/"research-sources.json").read_text())
    out=root/"collected-evidence.json"; rows=[]; exceptions=[]; failures=[]
    for store in catalog["stores"]:
        market=store["market"]; policy=config.get(market,{})
        feeds=[];cache={}; limited=False
        for url in policy.get("feeds",[]):
            try:feeds.append(merchant(url,market,stamp,get))
            except Exception as exc:failures.append([market,url,type(exc).__name__])
        for record in store["records"]:
            product=record["productKey"];offer=record["offer"];term=record.get("searchTerm",offer["title"])
            identity=gtin(record.get("packGtin")); matches=[x for idx in feeds for x in idx.get(identity,[])]
            reasons=[]
            if not matches:reasons.append("missing exact pack GTIN, comparable price or destination shipping")
            for entry in matches:rows.append(dict(entry,market=market,productKey=product,sku=offer["sku"],packGtin=identity))
            if term not in cache:
                cache[term]=None
                if policy.get("benchmark") and not limited:
                    try:
                        if get is fetch:time.sleep(1)
                        cache[term]=interest(market,term,policy["benchmark"],now,get)
                    except HTTPError as exc:
                        limited=exc.code in (403,429);failures.append([market,"Google Trends",exc.code])
                    except Exception as exc:failures.append([market,term,type(exc).__name__])
            if cache[term]:rows.append(dict(cache[term],market=market,productKey=product,sku=offer["sku"]))
            else:reasons.append("regional demand unavailable")
            if reasons:exceptions.append(dict(market=market,sku=offer["sku"],reasons=reasons))
    atomic(out,{"samples":rows,"exceptions":exceptions,"sourceFailures":failures,"observedAt":stamp})
    return len(rows),len(exceptions)
if __name__=="__main__":
    cli=argparse.ArgumentParser(description=__doc__);cli.add_argument("workspace",type=Path)
    print("Evidence observations: %d; offers needing review: %d"%collect(cli.parse_args().workspace))
