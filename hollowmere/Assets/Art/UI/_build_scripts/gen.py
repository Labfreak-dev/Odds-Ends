import sys,json,os,concurrent.futures as cf
os.environ['MESHY_API_KEY']=json.load(open('/home/box/agent-data/box-secrets.json'))['card']['MESHY_API_KEY']
import meshy
S="Painterly dark fantasy mobile game key art, cohesive palette of deep midnight blue, cold teal mist and warm ember gold accents, high detail, no text, no letters, no watermark, no people."
J={
'far':("16:9",S+" Wide landscape: a misty hollow valley at night, a still glowing teal lake in the center reflecting moonlight, a distant ruined gothic gate and crumbling crypt towers on the far shore, layered fog banks, pale moon behind clouds. Upper center sky is calm and empty (space for a title logo). Lower area darker. Atmospheric perspective."),
'mid':("16:9","Dark fantasy game art layer, NO background: isolated on a perfectly flat pure solid #00FF00 chroma key green background. Two massive ruined gothic stone gate pillars and broken cliffs, one on the far left edge and one on the far right edge of the frame, crumbling arches, hanging moss, a few teal glowing runes and a warm lantern, moonlit midnight-blue stone, rim light. Center of image is empty green. No ground plane across center, no text."),
'near':("16:9","Foreground silhouette layer for a game parallax: pure black silhouettes of gnarled twisted tree roots, thorny branches and jagged rocks framing the bottom left and bottom right corners and the top left corner, on a perfectly flat pure white background. Large empty white center. Solid black shapes only, crisp edges, no gray, no text."),
'orn':("16:9","Ornate dark fantasy game logo frame ornament, wide horizontal gothic filigree crest in aged gold and dark iron with small teal glowing gem in the top center, symmetrical, wings of thorny metal scrollwork extending left and right, large empty dark center area for a word, isolated on a perfectly flat pure black background, no text, no letters."),
'icons':("1:1","Game UI icon sheet, 4 columns by 3 rows grid of 12 separate icons, each well spaced, isolated on a perfectly flat pure solid #00FF00 green background, polished mobile RPG style, dark fantasy, aged gold and dark iron with teal and red accents, thick clean dark outline, front view: row1: gear cog (settings), play triangle, circular arrow (continue), leather backpack (inventory); row2: rolled parchment map, merchant shop stall awning, stack of gold coins, faceted purple-teal gem; row3: red heart, blue mana potion flask, sword, kite shield. No text, no labels."),
}
def run(k):
    ar,p=J[k]; out=f'../gen/{k}.png'
    if os.path.exists(out): return k,'have'
    r=meshy.wait('v1/text-to-image',meshy.create('v1/text-to-image',{'ai_model':'nano-banana','prompt':p,'aspect_ratio':ar},'hm_'+k),every=4)
    if r.get('status')!='SUCCEEDED': return k,str(r.get('task_error'))
    meshy.fetch(r['image_urls'][0],out); return k,'ok'
ks=sys.argv[1:] or list(J)
b0=meshy.balance()
with cf.ThreadPoolExecutor(6) as ex:
    for x in ex.map(run,ks): print(x)
print('balance',b0,'->',meshy.balance())
