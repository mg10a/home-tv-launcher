import datetime,json,os,urllib.request,xml.etree.ElementTree as ET
regions={}
for key in ('nw','dg','UK'):
    try:
        with urllib.request.urlopen('https://weather.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/'+key,timeout=20) as response:
            root=ET.fromstring(response.read())
        if root.find('channel') is None: raise ValueError('Not an RSS feed')
        regions[key]={'ok':True,'title':root.findtext('channel/title'),'items':[{'title':item.findtext('title',''), 'description':item.findtext('description',''), 'url':item.findtext('link','')} for item in root.findall('channel/item')]}
    except Exception:
        regions[key]={'ok':False,'items':[]}
with open(os.environ['RUNNER_TEMP']+'/weather-warnings.json','w') as out:
    json.dump({'checked':datetime.datetime.now(datetime.timezone.utc).isoformat(),'regions':regions},out)
