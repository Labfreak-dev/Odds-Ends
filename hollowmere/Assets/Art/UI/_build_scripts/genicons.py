import json,os,concurrent.futures as cf
os.environ['MESHY_API_KEY']=json.load(open('/home/box/agent-data/box-secrets.json'))['card']['MESHY_API_KEY']
import meshy
B="Single polished mobile RPG game UI icon, dark fantasy style, centered, fills 80% of frame, aged gold and dark iron materials with {acc} accents, thick clean dark outline, soft top-left lighting, isolated on a perfectly flat uniform pure #00FF00 bright chroma green background, no shadow on background, no text, no letters, no numbers. Subject: {s}"
I={'settings':('teal','an ornate gear cog with a small teal gem in the hub'),
'play':('teal glow','a bold right-pointing triangular play arrowhead made of gold-rimmed dark iron with a glowing teal inner face, simple and blank'),
'continue':('teal','two curved gold arrows forming a circle, resume/continue symbol'),
'inventory':('brown leather','a leather adventurer backpack with gold buckles'),
'map':('parchment','a partially unrolled parchment treasure map with a red X, wooden scroll ends'),
'shop':('deep red','a small merchant tent stall with a striped red and dark teal awning and a coin sign'),
'gold':('warm gold','a small stack of shiny gold coins with one coin in front'),
'gem':('violet and teal','a single large faceted gemstone, violet blending to teal, sparkling'),
'heart':('crimson red','a glossy crimson heart framed with a thin gold rim'),
'mana':('glowing blue','a round glass potion flask filled with glowing blue mana liquid, cork stopper'),
'sword':('steel','a straight steel longsword pointing up diagonally with a gold crossguard'),
'shield':('dark teal','a heater kite shield, dark teal face with gold rim and boss')}
def run(k):
    out=f'../gen/icon_{k}.png'
    if os.path.exists(out): return k,'have'
    a,s=I[k]
    r=meshy.wait('v1/text-to-image',meshy.create('v1/text-to-image',{'ai_model':'nano-banana','prompt':B.format(acc=a,s=s),'aspect_ratio':'1:1'},'hm_icon_'+k),every=4)
    if r.get('status')!='SUCCEEDED': return k,str(r.get('task_error'))
    meshy.fetch(r['image_urls'][0],out); return k,'ok'
with cf.ThreadPoolExecutor(12) as ex:
    for x in ex.map(run,I): print(x)
print(meshy.balance())
