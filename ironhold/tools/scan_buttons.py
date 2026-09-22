import json,time,base64,sys,collections
from playwright.sync_api import sync_playwright
SP='/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad'
URL='http://127.0.0.1:8899/dbg6/index.html'
W=int(sys.argv[1]) if len(sys.argv)>1 else 420
def prep(name):
    sv=json.loads(base64.b64decode(open(SP+'/'+name).read()).decode()); sv['S']['last']=int(time.time()*1000); return base64.b64encode(json.dumps(sv,separators=(',',':')).encode()).decode()
MEASURE="""()=>{const out=[];
  const pseudoW=(b,which)=>{const cs=getComputedStyle(b,which);if(!cs||cs.content==='none'||cs.content==='normal'||cs.display==='none'||cs.position==='absolute'||cs.position==='fixed')return 0;const w=parseFloat(cs.width)||0;return w+(parseFloat(cs.marginLeft)||0)+(parseFloat(cs.marginRight)||0);};
  for(const b of document.querySelectorAll('button')){if(!b.offsetParent&&getComputedStyle(b).position!=='fixed')continue;if(b.closest('.pin'))continue;const r=b.getBoundingClientRect();if(r.width<8||r.height<8)continue;
    const cs=getComputedStyle(b);if(cs.visibility==='hidden'||cs.display==='none')continue;
    const txt=(b.textContent||'').trim();if(!txt)continue;
    let l=1e9,t=1e9,rr=-1e9,bb=-1e9;const walk=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);let n;
    while(n=walk.nextNode()){if(!n.textContent.trim())continue;const rng=document.createRange();rng.selectNodeContents(n);for(const x of rng.getClientRects()){if(x.width===0)continue;l=Math.min(l,x.left);t=Math.min(t,x.top);rr=Math.max(rr,x.right);bb=Math.max(bb,x.bottom);}}
    for(const e of b.querySelectorAll('*')){const ec=getComputedStyle(e);if(ec.position==='absolute'||ec.position==='fixed'||ec.display==='none')continue;if(e.textContent.trim())continue;const x=e.getBoundingClientRect();if(x.width<2)continue;l=Math.min(l,x.left);t=Math.min(t,x.top);rr=Math.max(rr,x.right);bb=Math.max(bb,x.bottom);}
    if(l>rr)continue;
    l-=pseudoW(b,'::before');rr+=pseudoW(b,'::after');
    const pl=parseFloat(cs.paddingLeft)+parseFloat(cs.borderLeftWidth),pr=parseFloat(cs.paddingRight)+parseFloat(cs.borderRightWidth);
    const cl=r.left+pl,cr=r.right-pr;
    const over=Math.max(0,cl-l,rr-cr),overBox=Math.max(0,r.left-l,rr-r.right,r.top-t,bb-r.bottom);const off=((l+rr)/2)-((r.left+r.right)/2);
    if(overBox>0.5||over>3||Math.abs(off)>3)out.push({id:b.id,cls:b.className,txt:txt.slice(0,40),w:Math.round(r.width),tw:Math.round(rr-l),overBox:+overBox.toFixed(1),over:+over.toFixed(1),off:+off.toFixed(1)});}
  return out;}"""
found=[]
keys=set()
def scan(pg,where):
    for x in pg.evaluate(MEASURE):
        k=(x['id'],x['cls'],x['txt'],x['w']);
        if k in keys: continue
        keys.add(k); x['where']=where; found.append(x)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':W,'height':900}); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('ironhold_idle_v1',%s)"%json.dumps(prep('asc_1_16.txt')))
    pg.goto(URL,wait_until='commit'); pg.wait_for_function('window.__D',timeout=120000); pg.wait_for_function("!document.getElementById('intro')",timeout=60000)
    pg.evaluate("document.getElementById('modal').className='';S.paused=true;S.keep.larder=5;S.keep.forge=5;S.gold=1e9;for(let i=0;i<FOOD.length;i++)S.food[i]=60;S.chests=3;S.chests2=2;S.chests3=1;renderAll()")
    for tab in ['hero','vault','skills','world','keep']:
        pg.evaluate("(t)=>{showTab(t);renderAll();}",tab); pg.wait_for_timeout(200); scan(pg,tab)
        n=pg.evaluate("(t)=>document.querySelectorAll('#tab-'+t+' > .panel[data-sec]').length",tab)
        for i in range(n):
            name=pg.evaluate("([t,i])=>{showSec(t,i);renderAll();const p=document.querySelectorAll('#tab-'+t+' > .panel[data-sec]')[i];return p?p.dataset.sec:''}",[tab,i]); pg.wait_for_timeout(150); scan(pg,tab+':'+name)
            # expand any folded cards and details
            pg.evaluate("()=>{document.querySelectorAll('details').forEach(d=>d.open=true);for(const k in (S.fold||{}))S.fold[k]=false;renderAll();}"); pg.wait_for_timeout(120); scan(pg,tab+':'+name+':open')
    pg.evaluate("()=>{S.med=S.med||{sock:{},loose:{}};S.med.sock=S.med.sock||{};for(const J of JEWELS){S.med.sock[J.id]={g:JEWEL_MAX,ins:(INSCR.find(x=>x.j===J.id)||{}).id||null};S.med.loose[J.id]=3;}S.med.wildOpen=true;insKnown=()=>true;canInscribe=()=>true;canRecut=()=>true;openMed();renderAll();}"); pg.wait_for_timeout(200); scan(pg,'medallion:carved')
    # windows
    for opener,label in [("openPot()",'potions'),("openPray()",'prayers'),("openItem(S.inv[0]||S.equip.weapon,false)",'item'),("openItem(S.equip.weapon,true)",'worn item'),("document.getElementById('btnLedger').click()",'ledger'),("cqOpen&&cqOpen((S.party[0]||{}).type)",'companion'),("openBeast(beastList()[0].n)",'beast'),("(()=>{const k=Object.keys(S.found||{})[0];if(k)openCodex(k);})()",'codex')]:
        try:
            pg.evaluate("(c)=>{try{eval(c)}catch(e){console.log('open fail',c,e.message)}}",opener); pg.wait_for_timeout(200); scan(pg,label)
            pg.evaluate("()=>{document.getElementById('modal').className='';G.modalKind=null;document.getElementById('lgModal').classList.remove('on');const c=document.getElementById('cqModal');if(c)c.style.display='';}")
        except Exception as e: print('window',label,'error',e)
    b.close()
print('width',W,'buttons flagged:',len(found),'errors',errs[:2])
for x in sorted(found,key=lambda x:(-x['overBox'],-x['over'],-abs(x['off']))): print(x)
