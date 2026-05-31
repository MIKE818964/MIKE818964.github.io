/* Honeybadger LIVE animation driver — window.HBANIM
   Feeds the pure gauge engine (HBG) a believable "demo drive" so gauges sweep
   on load, then move continuously. Pages register a per-frame tick; HBANIM
   throttles to ~26 fps and only the page re-renders the gauges that changed.
   Symbols (HBSYM) animate via their own SMIL and are NEVER re-rendered here.
   Nothing here changes how a gauge looks — the real dash just supplies live
   numbers the same way, so what you design still ships pixel-identical. */
(function(){
  const HBG=window.HBG; if(!HBG) return;
  const U=HBG.UNITS;
  const P=()=>performance.now();
  const clampU=(u,v)=>{const d=U[u],mn=d.min||0;return Math.max(mn,Math.min(d.max,v));};

  // current eased value + where it's heading, per signal
  const sim={}, target={}, peakv={};
  Object.keys(U).forEach(u=>{const mn=U[u].min||0;sim[u]=mn+(U[u].max-mn)*0.4;target[u]=sim[u];});

  // --- simple believable drive cycle ---
  let gear=2, rpm=1500, mph=12, thr=0.4, hold=0, fuel=68;
  function drive(dt){
    const RL=6600;
    if(thr>0.05) rpm += (2400*thr - 250)*dt; else rpm -= 1600*dt;
    if(rpm>=RL){ gear=Math.min(6,gear+1); rpm=3000+Math.random()*500; thr=0.9; }   // upshift
    if(rpm<1050) rpm=1050;
    hold-=dt;
    if(hold<=0){ thr=0.3+Math.random()*0.65; hold=0.8+Math.random()*2.2;
      if(Math.random()<0.2){ gear=Math.max(2,gear-1); rpm=2400; } }                // roll downshift
    mph += (Math.min(150,gear*20+(rpm/RL)*22)-mph)*Math.min(1,dt*0.7);
    fuel=Math.max(6,fuel-dt*0.05);
    const boost=Math.max(0,(thr-0.42))*26*(rpm/RL);
    T('rpm',rpm);T('mph',mph);T('kmh',mph*1.609);T('tps',thr*100);
    T('boost',boost);T('map',32+boost*3+thr*55);T('maf',4+(rpm/RL)*50*thr);
    T('afr',14.5-boost*0.13+Math.sin(P()/650)*0.25);T('afrcmd',14.6-boost*0.1);
    T('timing',16+thr*18-boost*0.5);T('knock',boost>13?Math.max(0,Math.random()*3-1.6):0);
    T('injb1',7+thr*72);T('injb2',7+thr*72);
    T('o2b1',450+Math.sin(P()/280)*360);T('o2b2',450+Math.cos(P()/300)*360);
    T('stftb1',Math.sin(P()/850)*7);T('stftb2',Math.cos(P()/900)*7);T('ltftb1',3);T('ltftb2',2);
    T('fuel',fuel);T('volts',14.1+Math.sin(P()/1500)*0.25);
    D('coolant',199,5);D('oiltemp',213,7);D('transtemp',176,6);D('iat',101,6);
    D('oilpress',50+thr*18,4);D('fuelpsi',58,3);
  }
  function T(u,v){ if(U[u]) target[u]=clampU(u,v); }
  function D(u,c,a){ if(U[u]) target[u]=clampU(u,c+Math.sin(P()/2400+c)*a); }

  // --- startup needle sweep (0 -> max -> settle) ---
  let t0=P();
  function sweepFrac(e){const a=620,b=700;if(e<a)return ez(e/a);if(e<a+b)return 1-ez((e-a)/b);return null;}
  function ez(x){return x<0.5?2*x*x:1-Math.pow(-2*x+2,2)/2;}

  // setInterval (not rAF) so it runs even when the tab/preview is throttled or
  // backgrounded; ~26fps is buttery for gauges and far cheaper than rAF churn.
  let last=P(), on=false, timer=null; const ticks=[];
  function loop(){
    const n=P(), dt=Math.min(0.05,(n-last)/1000); last=n;
    const sf=sweepFrac(n-t0);
    if(sf===null){
      drive(dt);
      Object.keys(target).forEach(u=>{ sim[u]+=(target[u]-sim[u])*Math.min(1,dt*4.5); });
      Object.keys(sim).forEach(u=>{ if(peakv[u]==null||sim[u]>peakv[u])peakv[u]=sim[u]; });
    } else {
      Object.keys(U).forEach(u=>{const mn=U[u].min||0;sim[u]=mn+(U[u].max-mn)*sf;});
    }
    ticks.forEach(f=>{try{f();}catch(_){}});
  }

  // display-rounded value (matches the builders' precision convention)
  function disp(u){const d=U[u],mn=d.min||0,rng=d.max-mn,v=sim[u];return rng<=40?Math.round(v*10)/10:Math.round(v);}
  function isRed(u){const d=U[u];return d.redline!=null && sim[u]>=d.redline;}

  function peak(u){const d=U[u],mn=d.min||0,rng=d.max-mn,v=peakv[u]!=null?peakv[u]:sim[u];return rng<=40?Math.round(v*10)/10:Math.round(v);}
  window.HBANIM={
    value:u=>sim[u]||0,
    disp, isRed, peak,
    gear:()=>gear,
    resetPeaks(){Object.keys(peakv).forEach(k=>delete peakv[k]);},
    start(f){ if(f)ticks.push(f); if(!on){on=true;t0=P();last=P();timer=setInterval(loop,38);} },
    get running(){return on;}
  };
})();
