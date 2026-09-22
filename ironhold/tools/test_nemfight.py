import json,time,base64,sys
from playwright.sync_api import sync_playwright
SP='/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad'
def prep(name):
    sv=json.loads(base64.b64decode(open(SP+'/'+name).read()).decode()); sv['S']['last']=int(time.time()*1000)
    return base64.b64encode(json.dumps(sv,separators=(',',':')).encode()).decode()
HIT=float(sys.argv[1]) if len(sys.argv)>1 else None; SEC=float(sys.argv[2]) if len(sys.argv)>2 else None
with sync_playwright() as p:
    b=p.chromium.launch()
    for name in ['asc_1_9.txt','asc_1_16.txt']:
        pg=b.new_page(); pg.add_init_script("localStorage.setItem('ironhold_idle_v1',%s)"%json.dumps(prep(name)))
        pg.goto('http://127.0.0.1:8899/dbg6/index.html',wait_until='commit'); pg.wait_for_function('window.__D',timeout=120000)
        if HIT: pg.evaluate("([h,s])=>{NEM_T.hit=h;NEM_T.sec=s;}",[HIT,SEC])
        for food in (True,False):
            res=[]
            for k in range(4):
                r=pg.evaluate("""(food)=>{S.paused=false;for(let i=0;i<4;i++)S.cleared[i]=true;S.area=3;S.nem.slain=false;S.nem.fled=false;S.nem.lvl=0;S.nem.taken=[];S.deaths=0;G.dead=false;
                  if(!food)for(let i=0;i<FOOD.length;i++)S.food[i]=0;else if(foodCount()<60)S.food[1]=60;
                  S.hp=maxHp();spawn('nem');const m=G.mob;const st={pHit:+hitChance(playerAtkRoll(),mobDefRoll(m)).toFixed(2),mHit:+hitChance(mobAtkRoll(m),playerDefRoll()).toFixed(2),mh:+(mobMaxHit(m)*(1-dmgReduction()/100)/maxHp()).toFixed(2)};
                  G.sim=true;let t=0,out='';try{for(;t<900;t+=0.2){tick(0.2);if(G.dead){out='died';break;}if(!G.nem){out='slain';break;}}}finally{G.sim=false;}
                  return Object.assign(st,{out,t:+t.toFixed(0),left:G.nem?+(G.mobHp/G.mob.hp).toFixed(2):0,food:foodCount()});}""",food)
                res.append(r)
            print(name,'food' if food else 'no food',[(r['out'],r['t'],r['left']) for r in res],'rolls',{k:res[0][k] for k in ('pHit','mHit','mh')})
        pg.close()
    b.close()
