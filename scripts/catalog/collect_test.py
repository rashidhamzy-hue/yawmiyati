import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from collect import collect

class CatalogResearchTest(unittest.TestCase):
    def test_country_and_pack_match_with_cached_demand(self):
        now = datetime(2026,11,22,tzinfo=timezone.utc)
        feed = b'''<rss xmlns:g="http://base.google.com/ns/1.0"><channel><item>
          <g:gtin>4006381333931</g:gtin><link>https://shop.test/item</link><g:price>90.00 SAR</g:price>
          <g:availability>in_stock</g:availability><g:shipping><g:country>SA</g:country>
          <g:price>10 SAR</g:price></g:shipping></item></channel></rss>'''
        calls = []
        def get(url):
            calls.append(url)
            if url.endswith("feed"): return feed
            if "widgetdata" in url: return b'{"default":{"timelineData":[{"time":"1794873600","value":[50,50]}]}}'
            return b'{"widgets":[{"id":"TIMESERIES","request":{},"token":"test"}]}'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            records = [dict(productKey=k,packGtin=g,offer=dict(sku=k,title="rack")) for k,g in
                       [("pack1","4006381333931"),("pack2","4006381333932")]]
            (root/"catalog.json").write_text(json.dumps(dict(stores=[dict(market="sa",records=records)])))
            (root/"research-sources.json").write_text(json.dumps(dict(sa=dict(feeds=["https://shop.test/feed"],benchmark="kitchen"))))
            collect(root,get,now)
            result=json.loads((root/"collected-evidence.json").read_text())
            prices=[r for r in result["samples"] if "price" in r]
            self.assertEqual([(r["sku"],r["price"],r["shipping"]) for r in prices],[("pack1",9000,1000)])
            self.assertEqual(len(calls),3)
            self.assertEqual([r["value"] for r in result["samples"] if "metric" in r],[50,50])
            self.assertEqual([r["sku"] for r in result["exceptions"]],["pack2"])
