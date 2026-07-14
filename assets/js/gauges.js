/* Honeybadger gauge engine (shared) — extracted verbatim from the live builder.
   Pure SVG renderers; what renders here ships pixel-identical on the dash. */
(function(){
const RAD=Math.PI/180, f1=n=>Number(n).toFixed(1);
function polar(cx,cy,r,d){const a=d*RAD;return[cx+r*Math.sin(a),cy-r*Math.cos(a)];}
function arcP(cx,cy,r,d0,d1){const[x0,y0]=polar(cx,cy,r,d0),[x1,y1]=polar(cx,cy,r,d1);const l=Math.abs(d1-d0)>180?1:0;return`M ${f1(x0)} ${f1(y0)} A ${r} ${r} 0 ${l} 1 ${f1(x1)} ${f1(y1)}`;}
function hx(c){return[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));}
function shade(c,f){let[r,g,b]=hx(c);const cl=x=>Math.max(0,Math.min(255,Math.round(x)));if(f>=1){r+=(255-r)*(f-1);g+=(255-g)*(f-1);b+=(255-b)*(f-1);}else{r*=f;g*=f;b*=f;}return'#'+[r,g,b].map(x=>cl(x).toString(16).padStart(2,'0')).join('');}
const lum=c=>{const[r,g,b]=hx(c);return r+g+b;};

/* ── theme derivation (2026-06 color research) ─────────────────────────────
   Auto-derives a full hue-matched theme (panel/face/track/grid/muted/text/
   redline/warn) from a palette's needle+accent. Explicit palette keys
   override their derived slot. The achromatic fallback (H=215 slate)
   reproduces the legacy hardcoded theme byte-for-byte, so old palettes
   render pixel-identical. */
function hex2hsl(c){
  const [r,g,b]=hx(c).map(x=>x/255),M=Math.max(r,g,b),m=Math.min(r,g,b),d=M-m,l=(M+m)/2;
  let h=0;
  if(d)h=60*(M===r?(g-b)/d+(g<b?6:0):M===g?(b-r)/d+2:(r-g)/d+4);
  return [h,d?100*d/(1-Math.abs(2*l-1)):0,100*l];
}
function hsl2hex(h,s,l){
  s/=100;l/=100;
  const a=s*Math.min(l,1-l),
        f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};
  return '#'+[f(0),f(8),f(4)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function deriveTheme(p){
  const needle=p.needle||'#9aa7b2';
  let [h,s]=hex2hsl(needle);
  const h0=h,s0=s;                                 // raw hue for collision guards
  if(s<12){h=215;s=20;}                            // achromatic guard -> house slate
  const D=(S,L)=>hsl2hex(h,S,L),
        hexFace=p.face&&p.face[0]==='#',           // keyword faces (solid/carbon/…) are NOT colors
        light=hexFace&&lum(p.face)>470,            // same flip test round() uses
        redNeedle=s0>30&&(h0<25||h0>335),          // needle collides w/ red alerts
        warmNeedle=s0>30&&Math.abs(h0-45)<40;      // needle collides w/ amber warn
  const out={
    panel:  hexFace&&!light?shade(p.face,0.8):D(22,6),
    face:   D(18,11),
    track:  D(19,17),
    grid:   D(26,15),
    muted:  D(7,51),
    text:   light?'#0a0c0d':'#ffffff',
    redline:redNeedle?(light?'#b8860b':'#ffd23f'):(light?'#c62828':'#ff3b30'),
    warn:   warmNeedle?(light?'#444c55':'#ffffff'):(light?'#b8860b':'#ffd23f')
  };
  // pages build opts with explicit `track:w.track` etc. — those keys arrive as
  // undefined and must NOT clobber the derived slots
  for(const k in p)if(p[k]!=null)out[k]=p[k];
  return out;
}

/* ── HIST: rolling signal history (real charts) ────────────────────────────
   Tick loops push every signal here each frame; sampling is throttled to one
   point per SAMPLE_MS so the buffer always spans ~60s regardless of fps.
   trend/duo plot from these buffers; tiles reads .last(); PERF gets every
   un-throttled mph sample for accurate launch timing. */
const HIST=(()=>{
  const SAMPLE_MS=400,KEEP=150,WIN=SAMPLE_MS*KEEP,buf={},last={};
  let ver=0;
  const now=()=>(typeof performance!=='undefined'?performance.now():Date.now());
  function push(u,v,t){
    if(typeof v!=='number'||!isFinite(v))return;
    t=t!=null?t:now();
    last[u]=v;
    if(u==='mph')PERF.feed(v,t);
    const b=buf[u]||(buf[u]=[]);
    if(b.length&&t-b[b.length-1][0]<SAMPLE_MS)return;
    b.push([t,v]);
    // prune by count AND age — background-tab throttling spaces samples >1s
    // apart, so without the age prune old points smear onto the left edge
    while(b.length>KEEP||(b.length&&t-b[0][0]>WIN))b.shift();
    ver++;
  }
  function clear(){Object.keys(buf).forEach(k=>delete buf[k]);ver++;}
  return {push,clear,get:u=>buf[u]||[],last:u=>last[u],windowMs:()=>WIN,version:()=>ver};
})();

/* ── PERF: 0-60 + quarter-mile timer ───────────────────────────────────────
   Arms when speed sits below 1 mph, launches on movement, captures the 0-60
   split and integrates distance (trapezoid) for the 1/4-mile ET + trap speed.
   Run ends when the car stops again; bests persist until PERF.reset(). */
const PERF=(()=>{
  const S={state:'ready',armed:false,t0:0,dist:0,lastT:null,lastV:0,
           t60:null,tQ:null,trap:null,best60:null,bestQ:null,bestTrap:null};
  function feed(mph,t){
    if(S.lastT==null){S.lastT=t;S.lastV=mph;return;}
    const dt=Math.min(0.25,(t-S.lastT)/1000);S.lastT=t;
    if(S.state==='ready'){
      if(mph<1)S.armed=true;
      else if(S.armed){S.state='run';S.t0=t;S.dist=0;S.t60=null;S.tQ=null;S.trap=null;}
    }else{
      S.dist+=((S.lastV+mph)/2)*1.46667*dt;            // mph avg -> feet
      if(S.t60==null&&mph>=60){S.t60=(t-S.t0)/1000;
        if(S.best60==null||S.t60<S.best60)S.best60=S.t60;}
      if(S.tQ==null&&S.dist>=1320){S.tQ=(t-S.t0)/1000;S.trap=mph;
        if(S.bestQ==null||S.tQ<S.bestQ){S.bestQ=S.tQ;S.bestTrap=mph;}}
      if(mph<1){S.state='ready';S.armed=true;}
    }
    S.lastV=mph;
  }
  return {feed,get:()=>S,
    reset(){S.state='ready';S.armed=false;S.dist=0;S.t60=null;S.tQ=null;S.trap=null;
            S.best60=null;S.bestQ=null;S.bestTrap=null;}};
})();

const UNITS={
  // --- core ---
  rpm:{label:'RPM',sub:'x1000',max:8000,redline:6500,step:1000,div:1000},
  mph:{label:'MPH',sub:'',max:160,redline:null,step:20,div:1},
  kmh:{label:'KM/H',sub:'',max:260,redline:null,step:40,div:1},
  // --- engine / boost ---
  boost:{label:'BOOST',sub:'PSI',max:30,redline:22,step:5,div:1},
  map:{label:'MAP',sub:'kPa',max:255,redline:null,step:50,div:1},
  maf:{label:'MAF',sub:'lb/min',max:60,redline:null,step:10,div:1},
  tps:{label:'TPS',sub:'%',max:100,redline:null,step:20,div:1},
  // --- temps ---
  coolant:{label:'COOLANT',sub:'°F',max:260,redline:230,step:40,div:1},
  oiltemp:{label:'OIL TEMP',sub:'°F',max:300,redline:260,step:50,div:1},
  transtemp:{label:'TRANS',sub:'°F',max:300,redline:270,step:50,div:1},
  iat:{label:'IAT',sub:'°F',max:200,redline:160,step:40,div:1},
  // --- pressures / fluids ---
  oilpress:{label:'OIL PRES',sub:'PSI',max:100,redline:null,step:20,div:1},
  fuelpsi:{label:'FUEL PRES',sub:'PSI',max:80,redline:null,step:20,div:1},
  fuel:{label:'FUEL',sub:'%',max:100,redline:null,step:25,div:1},
  volts:{label:'VOLTS',sub:'V',min:8,max:18,redline:null,step:2,div:1},
  // --- air/fuel ---
  afr:{label:'AFR',sub:':1',min:10,max:18,redline:16,step:1,div:1},
  afrcmd:{label:'AFR CMD',sub:':1',min:10,max:18,redline:16,step:1,div:1},
  o2b1:{label:'O2 B1',sub:'mV',max:1000,redline:null,step:200,div:1},
  o2b2:{label:'O2 B2',sub:'mV',max:1000,redline:null,step:200,div:1},
  stftb1:{label:'STFT B1',sub:'%',min:-25,max:25,redline:null,step:10,div:1},
  stftb2:{label:'STFT B2',sub:'%',min:-25,max:25,redline:null,step:10,div:1},
  ltftb1:{label:'LTFT B1',sub:'%',min:-25,max:25,redline:null,step:10,div:1},
  ltftb2:{label:'LTFT B2',sub:'%',min:-25,max:25,redline:null,step:10,div:1},
  injb1:{label:'INJ B1',sub:'%',max:100,redline:90,step:20,div:1},
  injb2:{label:'INJ B2',sub:'%',max:100,redline:90,step:20,div:1},
  // --- tuning / spark ---
  timing:{label:'TIMING',sub:'°',min:-10,max:45,redline:null,step:10,div:1},
  knock:{label:'KNOCK',sub:'°',max:15,redline:5,step:3,div:1},
};
const START=-135,SWEEP=270;

function bezelDef(b){
  if(b==='chrome')return['<linearGradient id="bz" x1="0.12" y1="0" x2="0.62" y2="1"><stop offset="0" stop-color="#f7f9fb"/><stop offset="0.18" stop-color="#b6bcc2"/><stop offset="0.36" stop-color="#eef1f3"/><stop offset="0.52" stop-color="#7d848b"/><stop offset="0.7" stop-color="#d8dde1"/><stop offset="0.85" stop-color="#969ca2"/><stop offset="1" stop-color="#e6eaed"/></linearGradient>','#2a2d30'];
  if(b==='brushed')return['<linearGradient id="bz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe3e6"/><stop offset="0.25" stop-color="#9aa0a6"/><stop offset="0.5" stop-color="#c8cdd1"/><stop offset="0.75" stop-color="#878d93"/><stop offset="1" stop-color="#b4b9bd"/></linearGradient>','#3a3d40'];
  if(b==='black')return['<linearGradient id="bz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34383c"/><stop offset="1" stop-color="#0a0b0d"/></linearGradient>','#000000'];
  if(b==='gunmetal')return['<linearGradient id="bz" x1="0.15" y1="0" x2="0.7" y2="1"><stop offset="0" stop-color="#5a626b"/><stop offset="0.4" stop-color="#3a4047"/><stop offset="0.7" stop-color="#21262b"/><stop offset="1" stop-color="#454c54"/></linearGradient>','#15191d'];
  if(b==='gold')return['<linearGradient id="bz" x1="0.12" y1="0" x2="0.62" y2="1"><stop offset="0" stop-color="#fcefb4"/><stop offset="0.22" stop-color="#d4a437"/><stop offset="0.45" stop-color="#f6dd8a"/><stop offset="0.62" stop-color="#9c7416"/><stop offset="0.82" stop-color="#e6c558"/><stop offset="1" stop-color="#b8860b"/></linearGradient>','#5a4408'];
  return['<linearGradient id="bz" x1="0.15" y1="0" x2="0.7" y2="1"><stop offset="0" stop-color="'+shade('#3c424b',1.5)+'"/><stop offset="0.38" stop-color="#3c424b"/><stop offset="0.62" stop-color="'+shade('#3c424b',0.55)+'"/><stop offset="1" stop-color="'+shade('#3c424b',1.2)+'"/></linearGradient>',shade('#3c424b',0.35)];
}
function faceDef(fc){
  if(fc&&fc[0]==='#')return['<radialGradient id="fc" cx="50%" cy="36%" r="76%"><stop offset="0" stop-color="'+shade(fc,1.45)+'"/><stop offset="0.58" stop-color="'+fc+'"/><stop offset="1" stop-color="'+shade(fc,0.45)+'"/></radialGradient>',fc];
  if(fc==='carbon')return['<linearGradient id="cw1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2c3137"/><stop offset="1" stop-color="#131518"/></linearGradient><linearGradient id="cw2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3137"/><stop offset="1" stop-color="#131518"/></linearGradient><pattern id="fc" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#131518"/><rect width="11" height="11" fill="url(#cw1)"/><rect x="11" y="11" width="11" height="11" fill="url(#cw1)"/><rect x="11" width="11" height="11" fill="url(#cw2)"/><rect y="11" width="11" height="11" fill="url(#cw2)"/></pattern>','#131518'];
  if(fc==='silver')return['<radialGradient id="fc" cx="50%" cy="36%" r="76%"><stop offset="0" stop-color="#f3f5f7"/><stop offset="0.58" stop-color="#d2d7db"/><stop offset="1" stop-color="#9aa0a6"/></radialGradient>','#d2d7db'];
  if(fc==='brushed')return['<radialGradient id="fc" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#cfd4d8"/><stop offset="0.5" stop-color="#a6acb2"/><stop offset="1" stop-color="#7e858c"/></radialGradient>','#a6acb2'];
  if(fc==='white')return['<radialGradient id="fc" cx="50%" cy="36%" r="78%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#f1f3f5"/><stop offset="1" stop-color="#d7dbdf"/></radialGradient>','#ffffff'];
  return['<radialGradient id="fc" cx="50%" cy="36%" r="76%"><stop offset="0" stop-color="'+shade('#171b21',1.45)+'"/><stop offset="0.58" stop-color="#171b21"/><stop offset="1" stop-color="'+shade('#171b21',0.45)+'"/></radialGradient>','#171b21'];
}

function round(o){
  const U=UNITS[o.unit],size=400,cx=200,cy=200,R=196,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>START+((v-rmin)/(rmax-rmin))*SWEEP;
  const [bz,bevel]=bezelDef(o.bezel), [face,faceval]=faceDef(o.face||o._T.face);
  const tcol=lum(faceval)>470?'#0a0c0d':'#ffffff';
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" font-family="'Rajdhani','Segoe UI',sans-serif"><defs>${bz}${face}<linearGradient id="ndl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(o.needle,1.55)}"/><stop offset="1" stop-color="${shade(o.needle,0.85)}"/></linearGradient><radialGradient id="hub" cx="40%" cy="34%" r="72%"><stop offset="0" stop-color="#eef1f3"/><stop offset="0.46" stop-color="#969ca2"/><stop offset="1" stop-color="#34383c"/></radialGradient><radialGradient id="gl" cx="50%" cy="15%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity="0.3"/><stop offset="0.4" stop-color="#fff" stop-opacity="0.06"/><stop offset="0.68" stop-color="#fff" stop-opacity="0"/></radialGradient><clipPath id="cl"><circle cx="${cx}" cy="${cy}" r="${R-26}"/></clipPath><filter id="dr" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.6"/></filter></defs>`;
  s+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#bz)"/><circle cx="${cx}" cy="${cy}" r="${R-13}" fill="none" stroke="${bevel}" stroke-width="4"/><circle cx="${cx}" cy="${cy}" r="${R-26}" fill="url(#fc)"/>`;
  // LFA-pattern whole-face flash on redline crossing — unfiltered rect tween, ~free on the Pi
  if(U.redline&&val>=redline)s+=`<circle cx="${cx}" cy="${cy}" r="${R-26}" fill="${o._T.redline}" opacity="${FLASH()?0.22:0.05}"/>`;
  if(U.redline)s+=`<path d="${arcP(cx,cy,R-40,ang(redline),ang(rmax))}" fill="none" stroke="${o._T.redline}" stroke-width="10" stroke-linecap="round"/>`;
  for(let v=rmin;v<=rmax+1e-6;v+=U.step){const a=ang(v),o1=polar(cx,cy,R-30,a),o2=polar(cx,cy,R-48,a),rl=U.redline&&v>=redline,col=rl?'#ff3b30':tcol;
    s+=`<line x1="${f1(o1[0])}" y1="${f1(o1[1])}" x2="${f1(o2[0])}" y2="${f1(o2[1])}" stroke="${col}" stroke-width="4.5" stroke-linecap="round"/>`;
    const n=polar(cx,cy,R-70,a);s+=`<text x="${f1(n[0])}" y="${f1(n[1])}" fill="${col}" font-size="24" font-weight="700" text-anchor="middle" dominant-baseline="central">${Math.round(v/U.div)}</text>`;}
  s+=`<text x="${cx}" y="${cy-46}" fill="${o.accent}" font-size="17" font-weight="700" text-anchor="middle" letter-spacing="2">${U.label}</text>`;
  if(U.sub)s+=`<text x="${cx}" y="${cy+52}" fill="${o.accent}" font-size="12" text-anchor="middle" letter-spacing="2">${U.sub}</text>`;
  s+=`<text x="${cx}" y="${cy+88}" fill="${tcol}" font-size="28" font-weight="800" text-anchor="middle">${val}</text>`;
  const L=R-46,a=ang(val);
  if(o.peak!=null&&o.peak>rmin){const pa=ang(Math.min(o.peak,rmax)),Lp=R-44;s+=`<g transform="rotate(${f1(pa)} ${cx} ${cy})"><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy-Lp}" stroke="${o.accent}" stroke-width="3" stroke-opacity="0.42" stroke-linecap="round"/><circle cx="${cx}" cy="${f1(cy-Lp)}" r="5" fill="${o.accent}" fill-opacity="0.7"/></g>`;}
  s+=`<g transform="rotate(${f1(a)} ${cx} ${cy})" filter="url(#dr)"><polygon points="${cx-5.5},${cy} ${cx-1.5},${cy-L} ${cx+1.5},${cy-L} ${cx+5.5},${cy} ${cx},${cy+26}" fill="url(#ndl)"/></g>`;
  s+=`<circle cx="${cx}" cy="${cy}" r="16" fill="url(#hub)" stroke="#2a2d30" stroke-width="2"/><circle cx="${cx-4}" cy="${cy-4}" r="4" fill="#fff" opacity="0.6"/><circle cx="${cx}" cy="${cy}" r="${R-26}" fill="url(#gl)" clip-path="url(#cl)"/></svg>`;
  return s;
}
function arc(o){const U=UNITS[o.unit],size=400,cx=200,cy=200,R=170,A0=-125,A1=125,SW=250,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="fl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${o.needle}"/><stop offset="0.62" stop-color="${o._T.warn}"/><stop offset="1" stop-color="${o._T.redline}"/></linearGradient><filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="${size}" height="${size}" rx="24" fill="${o._T.panel}"/>`;
  s+=`<path d="${arcP(cx,cy,R,A0,A1)}" fill="none" stroke="${o._T.track}" stroke-width="22" stroke-linecap="round"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="url(#fl)" stroke-width="22" stroke-linecap="round" filter="url(#g)"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="url(#fl)" stroke-width="22" stroke-linecap="round"/>`;
  if(U.redline){const r1=polar(cx,cy,R-16,ang(redline)),r2=polar(cx,cy,R+16,ang(redline));s+=`<line x1="${f1(r1[0])}" y1="${f1(r1[1])}" x2="${f1(r2[0])}" y2="${f1(r2[1])}" stroke="${o._T.redline}" stroke-width="4"/>`;}
  if(o.peak!=null&&o.peak>rmin){const pp=polar(cx,cy,R,ang(Math.min(o.peak,rmax)));s+=`<circle cx="${f1(pp[0])}" cy="${f1(pp[1])}" r="7" fill="#fff" stroke="${o.needle}" stroke-width="2.5"/>`;}
  s+=`<text x="${cx}" y="${cy+6}" fill="#fff" font-size="76" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text><text x="${cx}" y="${cy+52}" fill="${o.accent}" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}</text></svg>`;return s;}
function halfarc(o){const U=UNITS[o.unit],w=440,h=258,cx=220,cy=h-28,R=h-54,A0=-90,A1=90,SW=180,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="fl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${o.needle}"/><stop offset="0.62" stop-color="${o._T.warn}"/><stop offset="1" stop-color="${o._T.redline}"/></linearGradient><filter id="g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter></defs><rect width="${w}" height="${h}" rx="20" fill="${o._T.panel}"/>`;
  s+=`<path d="${arcP(cx,cy,R,A0,A1)}" fill="none" stroke="${o._T.track}" stroke-width="22" stroke-linecap="round"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="url(#fl)" stroke-width="22" stroke-linecap="round" filter="url(#g)"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="url(#fl)" stroke-width="22" stroke-linecap="round"/>`;
  s+=`<text x="${cx}" y="${cy-16}" fill="#fff" font-size="68" font-weight="800" text-anchor="middle">${val}</text><text x="${cx}" y="${cy+12}" fill="${o.accent}" font-size="15" font-weight="700" text-anchor="middle" letter-spacing="4">${U.label}</text></svg>`;return s;}
function ring(o){const U=UNITS[o.unit],size=360,cx=180,cy=180,R=146,A0=-140,A1=140,SW=280,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" font-family="'Rajdhani',sans-serif"><defs><filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.5"/></filter></defs><rect width="${size}" height="${size}" rx="22" fill="${o._T.panel}"/>`;
  s+=`<path d="${arcP(cx,cy,R,A0,A1)}" fill="none" stroke="${o._T.track}" stroke-width="13" stroke-linecap="round"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="${o.needle}" stroke-width="13" stroke-linecap="round" filter="url(#g)"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="${o.needle}" stroke-width="13" stroke-linecap="round"/>`;
  if(U.redline){const rp=polar(cx,cy,R,ang(redline));s+=`<circle cx="${f1(rp[0])}" cy="${f1(rp[1])}" r="5.5" fill="${o._T.redline}"/>`;}
  if(o.peak!=null&&o.peak>rmin){const pp=polar(cx,cy,R,ang(Math.min(o.peak,rmax)));s+=`<circle cx="${f1(pp[0])}" cy="${f1(pp[1])}" r="6" fill="#fff" stroke="${o.needle}" stroke-width="2"/>`;}
  s+=`<text x="${cx}" y="${cy-2}" fill="#fff" font-size="70" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text><text x="${cx}" y="${cy+44}" fill="${o.accent}" font-size="15" font-weight="700" text-anchor="middle" letter-spacing="4">${U.label}</text></svg>`;return s;}
function segarc(o){const U=UNITS[o.unit],size=400,cx=200,cy=200,R=164,A0=-120,A1=120,SW=240,n=22,sw=SW/n,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" font-family="'Rajdhani',sans-serif"><rect width="${size}" height="${size}" rx="24" fill="${o._T.panel}"/>`;
  for(let i=0;i<n;i++){const a0=A0+i*sw+1.3,a1=A0+(i+1)*sw-1.3,mid=rmin+(i+0.5)/n*(rmax-rmin),lit=mid<=val,c=mid>=redline?o._T.redline:(mid>=redline*0.78?o._T.warn:o.needle);
    s+=`<path d="${arcP(cx,cy,R,a0,a1)}" fill="none" stroke="${lit?c:o._T.track}" stroke-width="26"/>`;}
  s+=`<text x="${cx}" y="${cy-4}" fill="#fff" font-size="78" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text><text x="${cx}" y="${cy+50}" fill="${o.accent}" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}</text></svg>`;return s;}
function neon(o){const U=UNITS[o.unit],size=380,cx=190,cy=190,R=156,A0=-135,A1=135,SW=270,nz=o.needle,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" font-family="'Rajdhani',sans-serif"><defs><filter id="nz" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="${size}" height="${size}" rx="24" fill="${shade(o._T.panel,0.6)}"/>`;
  s+=`<path d="${arcP(cx,cy,R,A0,A1)}" fill="none" stroke="${shade(nz,0.28)}" stroke-width="3"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="${nz}" stroke-width="5" stroke-linecap="round" filter="url(#nz)"/>`;
  for(let k=rmin;k<=rmax+1e-6;k+=U.step){const a=ang(k),o1=polar(cx,cy,R-11,a),o2=polar(cx,cy,R-23,a),col=U.redline&&k>=redline?'#ff3b6b':nz;
    s+=`<line x1="${f1(o1[0])}" y1="${f1(o1[1])}" x2="${f1(o2[0])}" y2="${f1(o2[1])}" stroke="${col}" stroke-width="2.5" filter="url(#nz)"/>`;}
  s+=`<text x="${cx}" y="${cy+4}" fill="${nz}" font-size="74" font-weight="800" text-anchor="middle" dominant-baseline="central" filter="url(#nz)">${val}</text><text x="${cx}" y="${cy+50}" fill="${nz}" font-size="15" font-weight="700" text-anchor="middle" letter-spacing="4">${U.label}</text></svg>`;return s;}
function bar(o){const U=UNITS[o.unit],w=520,h=170,pad=20,n=30,gap=4,bx=pad,by=46,bh=54,bw=w-2*pad-150,seg=(bw-(n-1)*gap)/n,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.42" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="${w}" height="${h}" rx="16" fill="${o._T.panel}"/>`;
  for(let i=0;i<n;i++){const rp=rmin+(i+0.5)/n*(rmax-rmin),lit=rp<=val,c=rp>=redline?o._T.redline:(rp>=redline*0.82?o._T.warn:o.needle),x=bx+i*(seg+gap);
    s+=`<rect x="${f1(x)}" y="${by}" width="${f1(seg)}" height="${bh}" rx="3" fill="${lit?c:o._T.track}"/>`;if(lit)s+=`<rect x="${f1(x)}" y="${by}" width="${f1(seg)}" height="${bh}" rx="3" fill="url(#sg)"/>`;}
  for(let k=rmin;k<=rmax+1e-6;k+=U.step){const fx=bx+((k-rmin)/(rmax-rmin))*bw;s+=`<text x="${f1(fx)}" y="${by+bh+18}" fill="${o._T.muted}" font-size="13" font-weight="600" text-anchor="middle">${Math.round(k/U.div)}</text>`;}
  if(o.peak!=null&&o.peak>rmin){const pkx=bx+((Math.min(o.peak,rmax)-rmin)/(rmax-rmin))*bw;s+=`<rect x="${f1(pkx-1.5)}" y="${by-4}" width="3" height="${bh+8}" rx="1.5" fill="${o.accent}"/>`;}
  s+=`<text x="${bx}" y="${by-10}" fill="${o.accent}" font-size="14" font-weight="700" letter-spacing="2">${U.label}${U.sub?' '+U.sub:''}</text><text x="${w-pad}" y="${by+38}" fill="#fff" font-size="44" font-weight="800" text-anchor="end">${val}</text><text x="${w-pad}" y="${by+bh+18}" fill="${o._T.muted}" font-size="13" text-anchor="end">${U.label}</text></svg>`;return s;}
function vbar(o){const U=UNITS[o.unit],w=180,h=380,bw=58,bx=(w-bw)/2,by=54,bh=h-104,n=22,gap=4,seg=(bh-(n-1)*gap)/n,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.42" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="${w}" height="${h}" rx="16" fill="${o._T.panel}"/>`;
  for(let i=0;i<n;i++){const rp=rmin+(i+0.5)/n*(rmax-rmin),lit=rp<=val,c=rp>=redline?o._T.redline:(rp>=redline*0.82?o._T.warn:o.needle),y=by+bh-(i+1)*seg-i*gap;
    s+=`<rect x="${f1(bx)}" y="${f1(y)}" width="${bw}" height="${f1(seg)}" rx="3" fill="${lit?c:o._T.track}"/>`;if(lit)s+=`<rect x="${f1(bx)}" y="${f1(y)}" width="${bw}" height="${f1(seg)}" rx="3" fill="url(#sg)"/>`;}
  if(o.peak!=null&&o.peak>rmin){const pky=by+bh-((Math.min(o.peak,rmax)-rmin)/(rmax-rmin))*bh;s+=`<rect x="${f1(bx-4)}" y="${f1(pky-1.5)}" width="${bw+8}" height="3" rx="1.5" fill="${o.accent}"/>`;}
  s+=`<text x="${w/2}" y="36" fill="#fff" font-size="30" font-weight="800" text-anchor="middle">${val}</text><text x="${w/2}" y="${h-20}" fill="${o.accent}" font-size="13" font-weight="700" text-anchor="middle" letter-spacing="2">${U.label}</text></svg>`;return s;}

function race(o){const U=UNITS[o.unit],w=560,h=300,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,n=18,pad=24,gap=5,bw=w-2*pad,seg=(bw-(n-1)*gap)/n,by=22,bh=30,ratio=Math.min(1,Math.max(0,(val-rmin)/(rmax-rmin)));
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani','Consolas',monospace"><defs><filter id="rg" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6"/></filter></defs>`;
  s+=`<rect width="${w}" height="${h}" rx="14" fill="${shade(o._T.panel,0.6)}"/><rect x="3" y="3" width="${w-6}" height="${h-6}" rx="12" fill="none" stroke="${o._T.grid}" stroke-width="2"/>`;
  for(let i=0;i<n;i++){const frac=(i+0.5)/n,lit=frac<=ratio,c=frac>0.93?'#8a5cff':frac>0.82?o._T.redline:frac>0.58?o._T.warn:'#27e36a',x=pad+i*(seg+gap);
    s+=`<rect x="${f1(x)}" y="${by}" width="${f1(seg)}" height="${bh}" rx="2" fill="${lit?c:shade(o._T.track,0.55)}"${lit?' filter="url(#rg)"':''}/>`;}
  s+=`<text x="${w/2}" y="${by+bh+24}" fill="${ratio>=0.88?o._T.redline:'#2b333e'}" font-size="14" font-weight="800" text-anchor="middle" letter-spacing="6">▲ SHIFT ▲</text>`;
  s+=`<text x="${w/2}" y="${h/2+46}" fill="#fff" font-size="116" font-weight="800" text-anchor="middle" dominant-baseline="middle">${val}</text>`;
  s+=`<text x="${w/2}" y="${h-24}" fill="${o.accent}" font-size="18" font-weight="700" text-anchor="middle" letter-spacing="5">${U.label}${U.sub?' · '+U.sub:''}</text>`;
  s+=`<text x="${pad}" y="${h-24}" fill="#1ae7ff" font-size="20" font-weight="700">${Math.round(ratio*100)}<tspan font-size="11" fill="${o._T.muted}"> %</tspan></text>`;
  s+=`<text x="${w-pad}" y="${h-24}" fill="#27e36a" font-size="20" font-weight="700" text-anchor="end">${Math.round((U.redline?redline:rmax)/U.div)}<tspan font-size="11" fill="${o._T.muted}"> RL</tspan></text>`;
  s+=`</svg>`;return s;}
function digit(o){const U=UNITS[o.unit],w=300,h=170,val=o.value,redline=U.redline??Infinity,vc=val>=redline?o._T.redline:'#ffffff';
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani','Consolas',monospace">`;
  s+=`<rect width="${w}" height="${h}" rx="14" fill="${o._T.panel}"/><rect x="2" y="2" width="${w-4}" height="${h-4}" rx="12" fill="none" stroke="${o._T.grid}" stroke-width="2"/>`;
  s+=`<rect x="0" y="0" width="${w}" height="7" rx="3" fill="${o.accent}"/>`;
  s+=`<text x="${w/2}" y="44" fill="${o.accent}" font-size="19" font-weight="700" letter-spacing="3" text-anchor="middle">${U.label}</text>`;
  s+=`<text x="${w/2}" y="${h/2+30}" fill="${vc}" font-size="74" font-weight="800" text-anchor="middle" dominant-baseline="middle">${val}</text>`;
  s+=`<text x="${w/2}" y="${h-20}" fill="${o._T.muted}" font-size="16" font-weight="600" text-anchor="middle" letter-spacing="2">${U.sub||''}</text>`;
  s+=`</svg>`;return s;}
function trend(o){const U=UNITS[o.unit],w=380,h=200,rmax=U.max,rmin=U.min||0,val=o.value,redline=U.redline??(rmax+1),px=24,py=24,gw=w-2*px,gh=h-58;
  // real rolling history when HIST has data; synthetic shape only as first-paint fallback
  let pts=[];const hist=HIST.get(o.unit);
  if(hist.length>=2){
    const tEnd=hist[hist.length-1][0],win=HIST.windowMs();
    hist.forEach(([t,v])=>{const f=Math.max(0.02,Math.min(0.98,(v-rmin)/(rmax-rmin)));
      pts.push([px+gw*(1-Math.min(1,(tEnd-t)/win)),py+gh-f*gh]);});
  }else{
    const base=Math.max(0.05,Math.min(0.95,(val-rmin)/(rmax-rmin)));const N=48;
    for(let i=0;i<=N;i++){const t=i/N;let v=base+0.12*Math.sin(t*8.5+0.6)+0.06*Math.sin(t*21+2)-0.04*(1-t);v=Math.max(0.04,Math.min(0.97,v));pts.push([px+t*gw,py+gh-v*gh]);}
  }
  const d='M '+pts.map(p=>f1(p[0])+' '+f1(p[1])).join(' L ');
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.needle}" stop-opacity="0.4"/><stop offset="1" stop-color="${o.needle}" stop-opacity="0"/></linearGradient></defs>`;
  s+=`<rect width="${w}" height="${h}" rx="14" fill="${o._T.panel}"/>`;
  for(let g=0;g<=3;g++){const yy=py+gh*g/3;s+=`<line x1="${px}" y1="${f1(yy)}" x2="${px+gw}" y2="${f1(yy)}" stroke="${o._T.grid}" stroke-width="1"/>`;}
  if(U.redline){const ry=py+gh-Math.max(0,Math.min(1,(redline-rmin)/(rmax-rmin)))*gh;s+=`<line x1="${px}" y1="${f1(ry)}" x2="${px+gw}" y2="${f1(ry)}" stroke="${o._T.redline}" stroke-width="1.5" stroke-dasharray="5 4"/>`;}
  s+=`<path d="${d} L ${f1(pts[pts.length-1][0])} ${py+gh} L ${f1(pts[0][0])} ${py+gh} Z" fill="url(#ar)"/><path d="${d}" fill="none" stroke="${o.needle}" stroke-width="3" stroke-linejoin="round"/>`;
  s+=`<circle cx="${f1(pts[pts.length-1][0])}" cy="${f1(pts[pts.length-1][1])}" r="4" fill="#fff"/>`;
  s+=`<text x="${px}" y="17" fill="${o.accent}" font-size="15" font-weight="700" letter-spacing="2">${U.label}</text>`;
  s+=`<text x="${w-px}" y="${h-14}" fill="#fff" font-size="30" font-weight="800" text-anchor="end">${val}<tspan font-size="13" fill="${o._T.muted}"> ${U.sub||''}</tspan></text>`;
  s+=`</svg>`;return s;}
function tube(o){const U=UNITS[o.unit],z=400,cx=200,cy=200,R=150,A0=-135,A1=135,SW=270,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${z} ${z}" width="${z}" height="${z}" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(o.needle,1.5)}"/><stop offset="1" stop-color="${shade(o.needle,0.7)}"/></linearGradient><filter id="tg" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter></defs><rect width="${z}" height="${z}" rx="24" fill="${o._T.panel}"/>`;
  s+=`<path d="${arcP(cx,cy,R,A0,A1)}" fill="none" stroke="${shade(o._T.track,0.85)}" stroke-width="36" stroke-linecap="round"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="url(#tb)" stroke-width="36" stroke-linecap="round" filter="url(#tg)"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="url(#tb)" stroke-width="36" stroke-linecap="round"/><path d="${arcP(cx,cy,R+10,A0,ang(val))}" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="7" stroke-linecap="round"/>`;
  s+=`<text x="${cx}" y="${cy+4}" fill="#fff" font-size="80" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text><text x="${cx}" y="${cy+54}" fill="${o.accent}" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}</text></svg>`;return s;}
function donut(o){const U=UNITS[o.unit],z=360,cx=180,cy=180,R=128,A0=-90,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,frac=Math.max(0,Math.min(1,(val-rmin)/(rmax-rmin))),col=val>=redline?o._T.redline:o.needle;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${z} ${z}" width="${z}" height="${z}" font-family="'Rajdhani',sans-serif"><defs><filter id="dg" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="${z}" height="${z}" rx="22" fill="${o._T.panel}"/>`;
  s+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${shade(o._T.track,0.85)}" stroke-width="28"/>`;
  if(frac>0.001){const a1=A0+frac*359.999;s+=`<path d="${arcP(cx,cy,R,A0,a1)}" fill="none" stroke="${col}" stroke-width="28" stroke-linecap="round" filter="url(#dg)"/><path d="${arcP(cx,cy,R,A0,a1)}" fill="none" stroke="${col}" stroke-width="28" stroke-linecap="round"/>`;}
  s+=`<text x="${cx}" y="${cy-2}" fill="#fff" font-size="62" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text><text x="${cx}" y="${cy+38}" fill="${o.accent}" font-size="15" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}${U.sub?' '+U.sub:''}</text></svg>`;return s;}
function modern(o){const U=UNITS[o.unit],z=380,cx=190,cy=190,R=162,A0=-140,A1=140,SW=280,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW,NT=64;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${z} ${z}" width="${z}" height="${z}" font-family="'Rajdhani',sans-serif"><rect width="${z}" height="${z}" rx="24" fill="${o._T.panel}"/>`;
  for(let i=0;i<=NT;i++){const v=rmin+(i/NT)*(rmax-rmin),a=ang(v),lit=v<=val,big=i%8===0,o1=polar(cx,cy,R,a),o2=polar(cx,cy,R-(big?22:12),a),col=v>=redline?o._T.redline:(lit?o.needle:o._T.track);s+=`<line x1="${f1(o1[0])}" y1="${f1(o1[1])}" x2="${f1(o2[0])}" y2="${f1(o2[1])}" stroke="${col}" stroke-width="${big?3.4:2}"/>`;}
  s+=`<text x="${cx}" y="${cy+8}" fill="#fff" font-size="86" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text><text x="${cx}" y="${cy+56}" fill="${o.accent}" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}</text></svg>`;return s;}
function linear(o){const U=UNITS[o.unit],w=160,h=360,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,bx=72,bw=34,by=34,bh=h-92,frac=Math.max(0,Math.min(1,(val-rmin)/(rmax-rmin))),fillH=frac*bh,col=val>=redline?o._T.redline:o.needle;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><rect width="${w}" height="${h}" rx="16" fill="${o._T.panel}"/>`;
  s+=`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="7" fill="${shade(o._T.track,0.6)}" stroke="${o._T.track}"/><rect x="${bx}" y="${f1(by+bh-fillH)}" width="${bw}" height="${f1(fillH)}" rx="7" fill="${col}"/>`;
  for(let v=rmin;v<=rmax+1e-6;v+=U.step){const y=by+bh-((v-rmin)/(rmax-rmin))*bh;s+=`<line x1="${bx-9}" y1="${f1(y)}" x2="${bx-3}" y2="${f1(y)}" stroke="${o._T.muted}" stroke-width="2"/><text x="${bx-12}" y="${f1(y+4)}" fill="${o._T.muted}" font-size="12" font-weight="600" text-anchor="end">${Math.round(v/U.div)}</text>`;}
  s+=`<text x="${bx+bw+12}" y="${by+12}" fill="${o.accent}" font-size="13" font-weight="700" letter-spacing="1">${U.label}</text><text x="${w/2}" y="${h-22}" fill="#fff" font-size="30" font-weight="800" text-anchor="middle">${val}</text></svg>`;return s;}
function flip(o){const U=UNITS[o.unit],val=o.value,str=String(val),dw=54,dh=82,gap=8,sx=20,sy=46,w=str.length*dw+(str.length-1)*gap+40,h=172;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Consolas',monospace"><rect width="${w}" height="${h}" rx="14" fill="${o._T.panel}"/>`;
  for(let i=0;i<str.length;i++){const x=sx+i*(dw+gap);s+=`<rect x="${x}" y="${sy}" width="${dw}" height="${dh}" rx="7" fill="#181d23" stroke="#05070a" stroke-width="1.5"/><rect x="${x}" y="${sy}" width="${dw}" height="${dh/2}" rx="7" fill="#20262d"/><line x1="${x}" y1="${sy+dh/2}" x2="${x+dw}" y2="${sy+dh/2}" stroke="#05070a" stroke-width="2.5"/><text x="${x+dw/2}" y="${sy+dh/2+1}" fill="${o.needle}" font-size="56" font-weight="800" text-anchor="middle" dominant-baseline="central">${str[i]}</text>`;}
  s+=`<text x="${w/2}" y="30" fill="${o.accent}" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}${U.sub?' · '+U.sub:''}</text></svg>`;return s;}
function gforce(o){const U=UNITS[o.unit],w=300,h=300,cx=150,cy=140,R=110,rmax=U.max,rmin=U.min||0,val=o.value,frac=Math.max(0,Math.min(1,(val-rmin)/(rmax-rmin))),dy=cy+R-frac*2*R;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><defs><filter id="gg" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="${w}" height="${h}" rx="20" fill="${o._T.panel}"/>`;
  [R,R*0.66,R*0.33].forEach(r=>s+=`<circle cx="${cx}" cy="${cy}" r="${f1(r)}" fill="none" stroke="${o._T.track}" stroke-width="1.5"/>`);
  s+=`<line x1="${cx-R}" y1="${cy}" x2="${cx+R}" y2="${cy}" stroke="${o._T.track}" stroke-width="1.5"/><line x1="${cx}" y1="${cy-R}" x2="${cx}" y2="${cy+R}" stroke="${o._T.track}" stroke-width="1.5"/>`;
  s+=`<circle cx="${cx}" cy="${f1(dy)}" r="11" fill="${o.needle}" filter="url(#gg)"/><circle cx="${cx}" cy="${f1(dy)}" r="11" fill="${o.needle}"/>`;
  s+=`<text x="${cx}" y="${h-44}" fill="#fff" font-size="34" font-weight="800" text-anchor="middle">${val}</text><text x="${cx}" y="${h-20}" fill="${o.accent}" font-size="14" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}${U.sub?' '+U.sub:''}</text></svg>`;return s;}
function thermo(o){const U=UNITS[o.unit],w=132,h=360,cx=58,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,sTop=36,sBot=h-80,sH=sBot-sTop,bR=26,frac=Math.max(0,Math.min(1,(val-rmin)/(rmax-rmin))),fy=sBot-frac*sH,col=val>=redline?o._T.redline:o.needle;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><rect width="${w}" height="${h}" rx="16" fill="${o._T.panel}"/>`;
  s+=`<rect x="${cx-9}" y="${sTop}" width="18" height="${sH+16}" rx="9" fill="${shade(o._T.track,0.6)}" stroke="${o._T.track}"/><circle cx="${cx}" cy="${sBot+26}" r="${bR}" fill="${shade(o._T.track,0.6)}" stroke="${o._T.track}"/><circle cx="${cx}" cy="${sBot+26}" r="${bR-6}" fill="${col}"/><rect x="${cx-5}" y="${f1(fy)}" width="10" height="${f1(sBot-fy+22)}" rx="5" fill="${col}"/>`;
  for(let v=rmin;v<=rmax+1e-6;v+=U.step){const y=sBot-((v-rmin)/(rmax-rmin))*sH;s+=`<line x1="${cx+12}" y1="${f1(y)}" x2="${cx+19}" y2="${f1(y)}" stroke="${o._T.muted}" stroke-width="2"/><text x="${cx+23}" y="${f1(y+4)}" fill="${o._T.muted}" font-size="11" font-weight="600">${Math.round(v/U.div)}</text>`;}
  s+=`<text x="${w/2}" y="22" fill="${o.accent}" font-size="13" font-weight="700" text-anchor="middle" letter-spacing="2">${U.label}</text></svg>`;return s;}
function chevron(o){const U=UNITS[o.unit],w=170,h=360,n=11,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,frac=Math.max(0,Math.min(1,(val-rmin)/(rmax-rmin))),cw=120,cx0=25,gap=7,ch=((h-110)-(n-1)*gap)/n;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><rect width="${w}" height="${h}" rx="16" fill="${o._T.panel}"/>`;
  for(let i=0;i<n;i++){const lvl=(i+0.5)/n,lit=lvl<=frac,rv=rmin+lvl*(rmax-rmin),col=rv>=redline?o._T.redline:(rv>=redline*0.8?o._T.warn:o.needle),y=(h-66)-i*(ch+gap)-ch,mx=cx0+cw/2;
    s+=`<path d="M ${cx0} ${f1(y+ch)} L ${f1(mx)} ${f1(y)} L ${f1(cx0+cw)} ${f1(y+ch)}" fill="none" stroke="${lit?col:'#222a33'}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;}
  s+=`<text x="${w/2}" y="28" fill="${o.accent}" font-size="14" font-weight="700" text-anchor="middle" letter-spacing="2">${U.label}</text><text x="${w/2}" y="${h-18}" fill="#fff" font-size="28" font-weight="800" text-anchor="middle">${val}</text></svg>`;return s;}
function shiftlights(o){const val=o.value,gear=o.gear||3,w=520,h=210,pad=24,n=12,gap=7;
  const SHIFT={1:6900,2:6800,3:6650,4:6500,5:6400,6:6300},sr=SHIFT[gear]||6600,frac=Math.max(0,Math.min(1.08,val/sr)),over=frac>=1;
  const segW=(w-2*pad-(n-1)*gap)/n,ledY=26,ledH=38;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani','Consolas',monospace"><defs><filter id="slg" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6"/></filter></defs>`;
  s+=`<rect width="${w}" height="${h}" rx="14" fill="${shade(o._T.panel,0.6)}"/><rect x="3" y="3" width="${w-6}" height="${h-6}" rx="12" fill="none" stroke="${o._T.grid}" stroke-width="2"/>`;
  for(let i=0;i<n;i++){const f=(i+0.5)/n,lit=over||f<=frac,col=over?'#ff2a1f':(f>0.84?'#ff2a1f':f>0.6?'#ffd23f':'#27e36a'),x=pad+i*(segW+gap);
    s+=`<rect x="${f1(x)}" y="${ledY}" width="${f1(segW)}" height="${ledH}" rx="3" fill="${lit?col:shade(o._T.track,0.55)}"${lit?' filter="url(#slg)"':''}/>`;}
  s+=`<text x="${pad}" y="${h-58}" fill="${o.accent}" font-size="13" font-weight="700" letter-spacing="2">GEAR</text>`;
  s+=`<text x="${pad+30}" y="${h-22}" fill="${over?'#ff2a1f':'#1ae7ff'}" font-size="78" font-weight="800" text-anchor="middle">${gear}</text>`;
  s+=`<text x="${w/2+24}" y="${h-40}" fill="#fff" font-size="50" font-weight="800" text-anchor="middle">${Math.round(val)}</text>`;
  s+=`<text x="${w/2+24}" y="${h-18}" fill="${o.accent}" font-size="13" font-weight="700" text-anchor="middle" letter-spacing="3">RPM</text>`;
  s+=`<text x="${w-pad}" y="${h-44}" fill="${o._T.muted}" font-size="14" font-weight="700" text-anchor="end">SHIFT @ ${sr}</text>`;
  s+=`<text x="${w-pad}" y="${h-20}" fill="${over?'#ff2a1f':'#3a4450'}" font-size="15" font-weight="800" text-anchor="end" letter-spacing="2">${over?'▲ SHIFT ▲':'G'+gear+' PROGRAM'}</text>`;
  return s;}
// display-rounded value for an arbitrary unit (same precision rule as the pages)
const fmtU=(u,v)=>{const d=UNITS[u];if(!d||v==null)return v;const mn=d.min||0;return(d.max-mn)<=40?Math.round(v*10)/10:Math.round(v);};

function duo(o){
  const u1=o.unit,U1=UNITS[u1],
        u2=(o.unit2&&UNITS[o.unit2]&&o.unit2!==u1)?o.unit2:(u1==='mph'?'rpm':'mph'),U2=UNITS[u2];
  const w=440,h=240,px=24,py=46,gw=w-2*px,gh=h-94;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><rect width="${w}" height="${h}" rx="14" fill="${o._T.panel}"/>`;
  for(let g=0;g<=3;g++){const yy=py+gh*g/3;s+=`<line x1="${px}" y1="${f1(yy)}" x2="${px+gw}" y2="${f1(yy)}" stroke="${o._T.grid}" stroke-width="1"/>`;}
  const line=(u,U,col)=>{
    const hb=HIST.get(u);if(hb.length<2)return '';
    const tEnd=hb[hb.length-1][0],win=HIST.windowMs(),mn=U.min||0;
    const p=hb.map(([t,v])=>[px+gw*(1-Math.min(1,(tEnd-t)/win)),
      py+gh-Math.max(0.02,Math.min(0.98,(v-mn)/(U.max-mn)))*gh]);
    return `<path d="M ${p.map(q=>f1(q[0])+' '+f1(q[1])).join(' L ')}" fill="none" stroke="${col}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="${f1(p[p.length-1][0])}" cy="${f1(p[p.length-1][1])}" r="3.6" fill="${col}"/>`;
  };
  const l2=line(u2,U2,o.accent),l1=line(u1,U1,o.needle);
  if(!l1&&!l2)s+=`<text x="${w/2}" y="${py+gh/2}" fill="${o._T.muted}" font-size="16" font-weight="600" text-anchor="middle">gathering data…</text>`;
  s+=l2+l1;
  const v1=(o.value!=null)?o.value:fmtU(u1,HIST.last(u1)),v2=fmtU(u2,HIST.last(u2));
  s+=`<circle cx="${px+5}" cy="22" r="5" fill="${o.needle}"/><text x="${px+16}" y="27" fill="${o.needle}" font-size="16" font-weight="800">${U1.label}</text><text x="${px+16+U1.label.length*10+10}" y="27" fill="${o._T.text}" font-size="16" font-weight="800">${v1!=null?v1:'--'}</text>`;
  s+=`<text x="${w-px}" y="27" fill="${o._T.text}" font-size="16" font-weight="800" text-anchor="end">${v2!=null?v2:'--'}</text><text x="${w-px-String(v2!=null?v2:'--').length*9-12}" y="27" fill="${o.accent}" font-size="16" font-weight="800" text-anchor="end">● ${U2.label}</text>`;
  s+=`<text x="${px}" y="${h-14}" fill="${o._T.muted}" font-size="11" font-weight="600">LAST 60s</text><text x="${w-px}" y="${h-14}" fill="${o._T.muted}" font-size="11" font-weight="600" text-anchor="end">${U1.sub||''} ${U2.sub?'· '+U2.sub:''}</text></svg>`;
  return s;}

function tiles(o){
  const defaults=['oilpress','coolant','volts','fuel'];
  const list=[o.unit].concat(defaults.filter(u=>u!==o.unit)).slice(0,4);
  const w=400,h=250,gap=9,cw=(w-3*gap)/2,ch=(h-3*gap)/2;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><rect width="${w}" height="${h}" rx="16" fill="${o._T.panel}"/>`;
  list.forEach((u,i)=>{
    const U=UNITS[u],x=gap+(i%2)*(cw+gap),y=gap+Math.floor(i/2)*(ch+gap);
    const raw=(u===o.unit&&o.value!=null)?o.value:fmtU(u,HIST.last(u));
    const hot=U.redline!=null&&typeof raw==='number'&&raw>=U.redline;
    s+=`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(cw)}" height="${f1(ch)}" rx="10" fill="${shade(o._T.panel,1.5)}" stroke="${hot?o._T.redline:o._T.grid}" stroke-width="${hot?2.5:1.5}"/>`;
    s+=`<rect x="${f1(x+12)}" y="${f1(y+12)}" width="34" height="4" rx="2" fill="${u===o.unit?o.needle:o.accent}"/>`;
    s+=`<text x="${f1(x+12)}" y="${f1(y+34)}" fill="${o.accent}" font-size="14" font-weight="700" letter-spacing="1.5">${U.label}</text>`;
    s+=`<text x="${f1(x+12)}" y="${f1(y+ch-22)}" fill="${hot?o._T.redline:o._T.text}" font-size="40" font-weight="800">${raw!=null?raw:'--'}</text>`;
    s+=`<text x="${f1(x+cw-12)}" y="${f1(y+ch-22)}" fill="${o._T.muted}" font-size="13" font-weight="600" text-anchor="end">${U.sub||''}</text>`;
  });
  return s+'</svg>';}

function timer(o){
  const S=PERF.get(),w=440,h=250,px=24;
  const fmt=t=>t==null?'--.--':t.toFixed(2);
  const run=S.state==='run';
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani','Consolas',monospace"><rect width="${w}" height="${h}" rx="16" fill="${o._T.panel}"/><rect x="3" y="3" width="${w-6}" height="${h-6}" rx="13" fill="none" stroke="${o._T.grid}" stroke-width="2"/>`;
  s+=`<text x="${px}" y="34" fill="${o.accent}" font-size="17" font-weight="800" letter-spacing="3">PERF TIMER</text>`;
  s+=`<rect x="${w-px-104}" y="14" width="104" height="28" rx="14" fill="${run?o._T.warn:'#27e36a'}" fill-opacity="0.16" stroke="${run?o._T.warn:'#27e36a'}" stroke-width="1.5"/><text x="${w-px-52}" y="33" fill="${run?o._T.warn:'#27e36a'}" font-size="14" font-weight="800" text-anchor="middle" letter-spacing="2">${run?'RUNNING':(S.armed?'READY':'STAGE')}</text>`;
  const row=(y,label,val,best,extra)=>{
    s+=`<text x="${px}" y="${y}" fill="${o.accent}" font-size="15" font-weight="700" letter-spacing="2">${label}</text>`;
    s+=`<text x="${px+130}" y="${y+4}" fill="${o._T.text}" font-size="34" font-weight="800">${val}</text>`;
    s+=`<text x="${px+130}" y="${y+22}" fill="${o._T.muted}" font-size="12" font-weight="600">s</text>`;
    if(extra)s+=`<text x="${px+250}" y="${y+4}" fill="${o.needle}" font-size="19" font-weight="800">${extra}</text>`;
    s+=`<text x="${w-px}" y="${y+4}" fill="${o._T.muted}" font-size="14" font-weight="700" text-anchor="end">BEST ${best}</text>`;
  };
  row(86,'0–60',fmt(S.t60),fmt(S.best60));
  row(146,'¼ MILE',fmt(S.tQ),fmt(S.bestQ),S.trap!=null?Math.round(S.trap)+' MPH':'');
  const mph=fmtU('mph',HIST.last('mph'));
  s+=`<text x="${px}" y="${h-24}" fill="${o._T.muted}" font-size="12" font-weight="600" letter-spacing="1">ARMS BELOW 1 MPH · TIMES ON LAUNCH</text>`;
  s+=`<text x="${w-px-46}" y="${h-20}" fill="${o._T.text}" font-size="34" font-weight="800" text-anchor="end">${mph!=null?mph:'--'}</text><text x="${w-px}" y="${h-20}" fill="${o.accent}" font-size="13" font-weight="700" text-anchor="end">MPH</text></svg>`;
  return s;}

/* ── 2026-06-11 "go crazy" generation — 10 styles from the 8-universe research ── */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const FLASH=()=>Math.floor(Date.now()/500)%2;

function tape(o){ // PFD-style scrolling speed tape [aviation]
  const U=UNITS[o.unit],rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,rng=rmax-rmin;
  const k=440/rng,yV=v=>216+(val-v)*k;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 230 430" width="230" height="430" font-family="'Rajdhani',sans-serif"><defs><clipPath id="tpc"><rect x="60" y="40" width="110" height="352"/></clipPath></defs>`;
  s+=`<rect width="230" height="430" rx="16" fill="${o._T.panel}"/><rect x="3" y="3" width="224" height="424" rx="14" fill="none" stroke="${o._T.grid}" stroke-width="1.5"/>`;
  s+=`<rect x="60" y="40" width="110" height="352" fill="${shade(o._T.panel,1.35)}"/>`;
  s+=`<g clip-path="url(#tpc)">`;
  const mstep=U.step/5,v0=Math.max(rmin,Math.ceil((val-0.45*rng)/mstep)*mstep),v1=Math.min(rmax,val+0.45*rng);
  for(let v=v0;v<=v1+1e-9;v+=mstep){
    const y=yV(v),major=Math.abs(v/U.step-Math.round(v/U.step))<1e-6;
    if(major){s+=`<line x1="146" y1="${f1(y)}" x2="166" y2="${f1(y)}" stroke="${o._T.text}" stroke-width="2"/><text x="138" y="${f1(y)}" fill="${o._T.text}" font-size="20" font-weight="700" text-anchor="end" dominant-baseline="central">${Math.round(v/U.div)}</text>`;}
    else s+=`<line x1="156" y1="${f1(y)}" x2="166" y2="${f1(y)}" stroke="${o._T.muted}" stroke-width="1.5"/>`;
  }
  if(U.redline)s+=`<rect x="164" y="${f1(yV(rmax))}" width="6" height="${f1((rmax-redline)*k)}" fill="${o._T.redline}"/>`;
  s+=`</g>`;
  if(o.peak!=null){const yp=yV(Math.min(o.peak,rmax));if(yp>=48&&yp<=384)s+=`<polygon points="170,${f1(yp)} 180,${f1(yp-7)} 180,${f1(yp+7)}" fill="${o.accent}"/><text x="183" y="${f1(yp+4)}" fill="${o.accent}" font-size="10">PK</text>`;}
  const h=HIST.get(o.unit);
  if(h.length>=4){const n=Math.min(8,h.length),a=h[h.length-n],b=h[h.length-1],dtm=(b[0]-a[0])/1000;
    if(dtm>0.2){const slope=(b[1]-a[1])/dtm,pred=clamp(val+6*slope,rmin,rmax);
      if(Math.abs(pred-val)>0.02*rng){const y2=clamp(yV(pred),48,384),dir=y2<216?1:-1;
        s+=`<line x1="176" y1="216" x2="176" y2="${f1(y2)}" stroke="#ff4fd8" stroke-width="4"/><polygon points="171,${f1(y2+8*dir)} 181,${f1(y2+8*dir)} 176,${f1(y2)}" fill="#ff4fd8"/>`;}}}
  s+=`<rect x="20" y="192" width="128" height="48" fill="#05070a" stroke="${o._T.grid}" stroke-width="1.5"/><polygon points="148,192 170,216 148,240" fill="#05070a" stroke="${o._T.grid}" stroke-width="1.5"/>`;
  s+=`<text x="84" y="216" fill="${val>=redline?o._T.redline:o._T.text}" font-size="38" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text>`;
  s+=`<text x="115" y="24" fill="${o.accent}" font-size="15" font-weight="700" letter-spacing="2" text-anchor="middle">${U.label}</text><text x="115" y="416" fill="${o._T.muted}" font-size="12" text-anchor="middle">${U.sub||''}</text></svg>`;
  return s;}

function telegraph(o){ // brass engine-order telegraph [marine]
  const U=UNITS[o.unit],rmax=U.max,rmin=U.min||0,redline=U.redline??null,val=o.value;
  const A0=-120,SW=240,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW;
  const b5=redline!=null?redline:rmin+(rmax-rmin)*5/6;
  const NAMES=['STOP','DEAD SLOW','SLOW','HALF','FULL'];
  const [bz]=bezelDef('gold'),INK='#1d2733',IVORY='#f2ead8',RED='#c62828';
  const pie=(a0,a1)=>{const p0=polar(200,200,150,a0);return`M 200 200 L ${f1(p0[0])} ${f1(p0[1])} ${arcP(200,200,150,a0,a1).replace(/^M [\d.\- ]+ /,'')} Z`;};
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 440" width="400" height="440" font-family="'Rajdhani',sans-serif"><defs>${bz}</defs>`;
  s+=`<circle cx="200" cy="200" r="185" fill="url(#bz)"/><circle cx="200" cy="200" r="172" fill="none" stroke="#5a4408" stroke-width="4"/><circle cx="200" cy="200" r="159" fill="${IVORY}"/>`;
  const flank=val>=b5;
  s+=`<path d="${pie(ang(b5),120)}" fill="${RED}" opacity="${flank?1:0.55}"${flank?` stroke="${IVORY}" stroke-width="1.5"`:''}/>`;
  if(!flank){let li=-1;for(let i=0;i<5;i++){const lo=rmin+i*(b5-rmin)/5,hi=rmin+(i+1)*(b5-rmin)/5;if(val>=lo&&val<hi){li=i;break;}}
    if(li<0&&val>=rmin)li=4;
    if(li>=0){const lo=ang(rmin+li*(b5-rmin)/5),hi=ang(rmin+(li+1)*(b5-rmin)/5);s+=`<path d="${pie(lo,hi)}" fill="${o.accent}" opacity="0.25"/>`;}}
  for(let i=0;i<=5;i++){const a=ang(rmin+i*(b5-rmin)/5),p1=polar(200,200,70,a),p2=polar(200,200,150,a);
    s+=`<line x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}" stroke="${INK}" stroke-width="2.5"/>`;}
  for(let i=0;i<5;i++){const am=ang(rmin+(i+0.5)*(b5-rmin)/5),p=polar(200,200,110,am);
    s+=`<text x="${f1(p[0])}" y="${f1(p[1])}" fill="${INK}" font-size="14" font-weight="700" text-anchor="middle" dominant-baseline="central" transform="rotate(${f1(am)} ${f1(p[0])} ${f1(p[1])})">${NAMES[i]}</text>`;}
  const amF=(ang(b5)+120)/2,pF=polar(200,200,110,amF);
  s+=`<text x="${f1(pF[0])}" y="${f1(pF[1])}" fill="${IVORY}" font-size="14" font-weight="800" text-anchor="middle" dominant-baseline="central" transform="rotate(${f1(amF)} ${f1(pF[0])} ${f1(pF[1])})">FLANK</text>`;
  if(o.peak!=null){const ap=ang(Math.min(o.peak,rmax));
    s+=`<g transform="rotate(${f1(ap)} 200 200)"><line x1="200" y1="200" x2="200" y2="78" stroke="${RED}" stroke-width="3"/><polygon points="196,84 200,70 204,84" fill="${RED}"/></g>`;}
  const a=ang(clamp(val,rmin,rmax));
  s+=`<g transform="rotate(${f1(a)} 200 200)"><polygon points="193,206 197,72 203,72 207,206" fill="url(#bz)" stroke="#5a4408" stroke-width="1"/><rect x="178" y="62" width="44" height="13" rx="6" fill="url(#bz)"/><circle cx="182" cy="68" r="8" fill="url(#bz)" stroke="#5a4408"/><circle cx="218" cy="68" r="8" fill="url(#bz)" stroke="#5a4408"/></g>`;
  s+=`<circle cx="200" cy="200" r="22" fill="url(#bz)" stroke="#5a4408" stroke-width="2"/>`;
  for(let k=0;k<6;k++){const p=polar(200,200,15,k*60);s+=`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.5" fill="#5a4408"/>`;}
  s+=`<rect x="24" y="368" width="352" height="56" rx="10" fill="${o._T.panel}" stroke="${o._T.grid}" stroke-width="1.5"/>`;
  s+=`<text x="200" y="388" fill="${o._T.muted}" font-size="13" letter-spacing="3" text-anchor="middle">ENGINE ORDER TELEGRAPH</text>`;
  s+=`<text x="200" y="414" fill="${redline!=null&&val>=redline?o._T.redline:o._T.text}" font-size="26" font-weight="800" text-anchor="middle">${val}</text>`;
  s+=`<text x="376" y="414" fill="${o.accent}" font-size="13" text-anchor="end">${U.label}${U.sub?' '+U.sub:''}</text></svg>`;
  return s;}

function annunciator(o){ // aircraft master-caution tile panel [aviation]
  const TILES=[['OIL','PRESS','oilpress','lo'],['COOLANT','TEMP','coolant','hi'],['TRANS','TEMP','transtemp','hi'],['VOLTS','LOW','volts','lo'],
    ['KNOCK','DET','knock','hi'],['FUEL','LEVEL','fuel','lo'],['IAT','HIGH','iat','hi'],['FUEL','PRESS','fuelpsi','hi'],
    ['INJ','DUTY','injb1','hi'],['AFR','LEAN','afr','hi'],['OIL','TEMP','oiltemp','hi'],['BOOST','OVER','boost','hi']];
  const state=(u,mode)=>{
    const v=(u===o.unit&&o.value!=null)?o.value:HIST.last(u);if(v==null)return 'off';
    const U=UNITS[u],RL=U.redline??U.max;
    if(mode==='lo'){
      if(u==='volts')return v<11?'red':v<12.2?'amber':(v>=16?'red':v>=15.5?'amber':'ok');
      if(u==='fuel')return v<8?'red':v<15?'amber':'ok';
      if(u==='oilpress')return v<15?'red':v<25?'amber':'ok';
    }
    return v>=RL?'red':v>=0.85*RL?'amber':'ok';
  };
  let anyRed=false,anyAmber=false,n=0;
  const st=TILES.map(t=>{const x=state(t[2],t[3]);if(x==='red'){anyRed=true;n++;}if(x==='amber'){anyAmber=true;n++;}return x;});
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 300" width="520" height="300" font-family="'Rajdhani',sans-serif"><rect width="520" height="300" rx="16" fill="${o._T.panel}"/>`;
  const mFill=anyRed?(FLASH()?o._T.redline:shade(o._T.redline,0.3)):anyAmber?(FLASH()?o._T.warn:shade(o._T.warn,0.3)):shade(o._T.track,0.7);
  s+=`<rect x="14" y="14" width="241" height="52" rx="6" fill="${mFill}"/><text x="134" y="40" fill="${anyRed?'#fff':anyAmber?'#1a1206':shade(o._T.muted,0.55)}" font-size="17" font-weight="800" letter-spacing="2" text-anchor="middle" dominant-baseline="central">MASTER CAUTION</text>`;
  s+=`<rect x="265" y="14" width="241" height="52" rx="6" fill="${shade(o._T.panel,1.3)}" stroke="${o._T.grid}"/><text x="279" y="40" fill="${o.accent}" font-size="13" dominant-baseline="central">ANNUN PANEL</text><text x="492" y="40" fill="${anyRed?o._T.redline:anyAmber?o._T.warn:o._T.muted}" font-size="15" font-weight="800" text-anchor="end" dominant-baseline="central">${n} ALERT${n===1?'':'S'}</text>`;
  TILES.forEach((t,i)=>{
    const col=i%4,row=Math.floor(i/4),x=14+col*125.5,y=76+row*73,w=115.5,h=63,cx=x+w/2,sx=st[i];
    const fill=sx==='red'?o._T.redline:sx==='amber'?o._T.warn:shade(o._T.track,0.7);
    const tcol=sx==='red'?'#fff':sx==='amber'?'#1a1206':shade(o._T.muted,0.55);
    s+=`<rect x="${f1(x)}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}"/>`;
    if(sx==='off')s+=`<text x="${f1(cx)}" y="${y+35}" fill="${shade(o._T.muted,0.4)}" font-size="13" font-weight="700" text-anchor="middle">OFF</text>`;
    else s+=`<text x="${f1(cx)}" y="${y+26}" fill="${tcol}" font-size="13" font-weight="700" letter-spacing="1" text-anchor="middle">${t[0]}</text><text x="${f1(cx)}" y="${y+44}" fill="${tcol}" font-size="13" font-weight="700" letter-spacing="1" text-anchor="middle">${t[1]}</text>`;
  });
  return s+'</svg>';}

function readiness(o){ // watch-style engine readiness score [micro-UI]
  const sub=(u,fn)=>{const v=(u===o.unit&&o.value!=null)?o.value:HIST.last(u);return v==null?18:25*clamp(fn(v),0,1);};
  const sOil=sub('oilpress',p=>p/25),
        sCool=sub('coolant',c=>c<170?(c-100)/70:c>220?(230-c)/10:1),
        sVolt=sub('volts',v=>v<13.2?(v-11)/2.2:v>14.8?(16-v)/1.2:1),
        sIat=sub('iat',t=>t<=100?1:(160-t)/60);
  const score=Math.round(sOil+sCool+sVolt+sIat);
  const C=score>=85?'#27e36a':score>=60?o._T.warn:o._T.redline;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 340" width="380" height="340" font-family="'Rajdhani',sans-serif"><rect width="380" height="340" rx="20" fill="${o._T.panel}"/>`;
  s+=`<path d="${arcP(190,150,120,-120,120)}" fill="none" stroke="${shade(o._T.track,0.85)}" stroke-width="14" stroke-linecap="round"/>`;
  if(score>0)s+=`<path d="${arcP(190,150,120,-120,-120+score*2.4)}" fill="none" stroke="${C}" stroke-width="14" stroke-linecap="round"/>`;
  s+=`<text x="190" y="150" fill="${o._T.text}" font-size="88" font-weight="800" text-anchor="middle" dominant-baseline="central">${score}</text>`;
  s+=`<text x="190" y="202" fill="${o.accent}" font-size="13" letter-spacing="3" text-anchor="middle">ENGINE READY</text>`;
  s+=`<text x="190" y="226" fill="${C}" font-size="18" font-weight="800" text-anchor="middle">${score>=85?'OPTIMAL':score>=60?'GOOD':'PAY ATTENTION'}</text>`;
  [['OIL','oilpress',sOil],['COOLANT','coolant',sCool],['VOLTS','volts',sVolt],['IAT','iat',sIat]].forEach((r,i)=>{
    const y=252+i*22,null_=HIST.last(r[1])==null&&r[1]!==o.unit;
    const c=null_?o._T.muted:r[2]>=20?'#27e36a':r[2]>=12?o._T.warn:o._T.redline;
    s+=`<text x="24" y="${y+6}" fill="${o._T.muted}" font-size="11" font-weight="700">${r[0]}</text>`;
    s+=`<rect x="88" y="${y}" width="140" height="7" rx="3.5" fill="${shade(o._T.track,0.7)}"/><rect x="88" y="${y}" width="${f1(140*r[2]/25)}" height="7" rx="3.5" fill="${c}"/>`;
    const v=(r[1]===o.unit&&o.value!=null)?o.value:fmtU(r[1],HIST.last(r[1]));
    s+=`<text x="356" y="${y+7}" fill="${o._T.muted}" font-size="13" text-anchor="end">${v!=null?v:'--'}</text>`;
  });
  return s+'</svg>';}

function pitroad(o){ // NASCAR pit-road speed + 2s loop averages [motorsport]
  const U=UNITS[o.unit],rmax=U.max,val=o.value;
  const L=U.redline??(o.unit==='mph'?55:Math.round(0.8*rmax)),ratio=val/L;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 240" width="560" height="240" font-family="'Rajdhani','Consolas',monospace"><rect width="560" height="240" rx="14" fill="${shade(o._T.panel,0.6)}"/><rect x="3" y="3" width="554" height="234" rx="12" fill="none" stroke="${o._T.grid}" stroke-width="2"/>`;
  for(let i=0;i<6;i++){
    let c=shade(o._T.track,0.55);
    if(ratio>1)c=FLASH()?o._T.redline:shade(o._T.track,0.55);
    else if(ratio>=0.92)c=o._T.warn;
    else if(ratio>=0.8&&i<clamp(Math.ceil((ratio-0.80)/0.02),0,6))c='#27e36a';
    s+=`<circle cx="${170+i*44}" cy="36" r="13" fill="${c}"/>`;
  }
  s+=`<text x="30" y="140" fill="${ratio>1?o._T.redline:o._T.text}" font-size="84" font-weight="800">${Math.round(val)}</text><text x="30" y="164" fill="${o.accent}" font-size="13">${U.label}</text>`;
  const h=HIST.get(o.unit),tEnd=h.length?h[h.length-1][0]:0;
  let anyOver=false;
  const segs=[];
  for(let i=0;i<8;i++){
    const w0=tEnd-(8-i)*2000,w1=tEnd-(7-i)*2000,inWin=h.filter(p=>p[0]>=w0&&p[0]<w1);
    if(!inWin.length){segs.push(null);continue;}
    const avg=inWin.reduce((a,p)=>a+p[1],0)/inWin.length;
    if(avg>L)anyOver=true;
    segs.push(avg);
  }
  if(anyOver)s+=`<rect x="400" y="84" width="130" height="64" rx="10" fill="${o._T.redline}" opacity="${FLASH()?1:0.55}"/><text x="465" y="125" fill="#fff" font-size="22" font-weight="800" text-anchor="middle">PENALTY</text>`;
  else s+=`<rect x="400" y="84" width="130" height="64" rx="10" fill="none" stroke="${o.accent}" stroke-width="2.5"/><text x="465" y="110" fill="${o.accent}" font-size="15" text-anchor="middle">LIMIT</text><text x="465" y="140" fill="${o._T.text}" font-size="30" font-weight="800" text-anchor="middle">${L}</text>`;
  s+=`<text x="24" y="170" fill="${o._T.muted}" font-size="11">PIT LANE · 2s LOOPS →</text>`;
  segs.forEach((avg,i)=>{
    const x=24+i*64.75,w=58.75;
    if(avg==null)s+=`<rect x="${f1(x)}" y="176" width="${w}" height="44" rx="4" fill="${shade(o._T.track,0.55)}"/><text x="${f1(x+w/2)}" y="202" fill="${o._T.muted}" font-size="16" text-anchor="middle">--</text>`;
    else{const over=avg>L;
      s+=`<rect x="${f1(x)}" y="176" width="${w}" height="44" rx="4" fill="${over?o._T.redline:'#27e36a'}" opacity="0.85"/><text x="${f1(x+w/2)}" y="203" fill="${over?'#fff':'#04270f'}" font-size="16" font-weight="800" text-anchor="middle">${Math.round(avg)}</text>`;}
  });
  return s+'</svg>';}

function capacitor(o){ // EVE Online capacitor wheel [game]
  const U=UNITS[o.unit],rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value;
  const frac=clamp((val-rmin)/(rmax-rmin),0,1),litEdge=Math.floor(frac*36);
  const TIERS=[[95,117],[121,143],[147,169]];
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" font-family="'Rajdhani',sans-serif"><rect width="400" height="400" rx="24" fill="${o._T.panel}"/>`;
  for(let j=0;j<36;j++){
    const sp=(j+0.5)*(336/36),a=sp<=168?sp:sp+24;
    const vj=rmin+(sp/336)*(rmax-rmin),lit=sp<frac*336;
    const fill=lit?(vj>=redline?o._T.redline:o.needle):o._T.track;
    const op=lit?(j===litEdge?0.6:1):0.35;
    TIERS.forEach(t=>{
      const p1=polar(200,200,t[0],a-2.6),p2=polar(200,200,t[1],a-3.4),p3=polar(200,200,t[1],a+3.4),p4=polar(200,200,t[0],a+2.6);
      s+=`<polygon points="${f1(p1[0])},${f1(p1[1])} ${f1(p2[0])},${f1(p2[1])} ${f1(p3[0])},${f1(p3[1])} ${f1(p4[0])},${f1(p4[1])}" fill="${fill}" fill-opacity="${op}"/>`;
    });
  }
  if(o.peak!=null){const jp=clamp(Math.floor(clamp((o.peak-rmin)/(rmax-rmin),0,1)*36),0,35),sp=(jp+0.5)*(336/36),a=sp<=168?sp:sp+24,t=TIERS[2];
    const p1=polar(200,200,t[0],a-2.6),p2=polar(200,200,t[1],a-3.4),p3=polar(200,200,t[1],a+3.4),p4=polar(200,200,t[0],a+2.6);
    s+=`<polygon points="${f1(p1[0])},${f1(p1[1])} ${f1(p2[0])},${f1(p2[1])} ${f1(p3[0])},${f1(p3[1])} ${f1(p4[0])},${f1(p4[1])}" fill="none" stroke="${o.accent}" stroke-width="1.5"/>`;}
  s+=`<circle cx="200" cy="200" r="78" fill="${shade(o._T.panel,0.85)}"/><circle cx="200" cy="200" r="78" fill="none" stroke="${o.accent}" stroke-width="1" opacity="0.6"/>`;
  s+=`<text x="200" y="192" fill="${o._T.text}" font-size="56" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text>`;
  s+=`<text x="200" y="224" fill="${o._T.muted}" font-size="15" text-anchor="middle">${Math.round(frac*100)}%</text>`;
  s+=`<text x="200" y="372" fill="${o.accent}" font-size="14" letter-spacing="2" text-anchor="middle">${U.label}</text></svg>`;
  return s;}

function powerflow(o){ // EV-style drive/coast center-zero [EV luxury]
  const tps=(o.unit==='tps'&&o.value!=null)?o.value:HIST.last('tps');
  const map_=HIST.last('map'),vac=map_!=null?clamp(97-map_,0,60):null;
  const drive=(tps!=null&&tps>=3)||vac==null,coast=!drive&&vac!=null&&vac>=3;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="pfg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${o.needle}"/><stop offset="0.8" stop-color="${o._T.warn}"/><stop offset="1" stop-color="${o._T.redline}"/></linearGradient></defs><rect width="400" height="400" rx="24" fill="${o._T.panel}"/>`;
  s+=`<path d="${arcP(200,205,150,-110,110)}" fill="none" stroke="${o._T.track}" stroke-width="2.5"/>`;
  s+=`<polygon points="200,49 195,38 205,38" fill="${o._T.text}"/>`;
  s+=`<path d="${arcP(200,205,150,95,110)}" fill="none" stroke="${o._T.redline}" stroke-width="2.5"/>`;
  const pL=polar(200,205,172,100),pR=polar(200,205,172,-100);
  s+=`<text x="${f1(pL[0])}" y="${f1(pL[1])}" fill="${o._T.muted}" font-size="11" text-anchor="middle">PWR</text><text x="${f1(pR[0])}" y="${f1(pR[1])}" fill="${o._T.muted}" font-size="11" text-anchor="middle">VAC</text>`;
  let num='0',mode='IDLE',mcol=o._T.muted,unit='';
  if(drive&&tps!=null){const sweep=(clamp(tps,0,100)/100)*110;
    if(sweep>0.5){s+=`<path d="${arcP(200,205,150,0,sweep)}" fill="none" stroke="url(#pfg)" stroke-width="18" stroke-linecap="round"/>`;
      const p=polar(200,205,150,sweep);s+=`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="6" fill="${o.needle}"/>`;}
    num='+'+Math.round(tps);mode='DRIVE';mcol=o.needle;unit='% TPS';
    if(sweep>95)mcol=o._T.redline;
  }else if(coast){const sweep=-(vac/60)*110;
    s+=`<path d="${arcP(200,205,150,sweep,0)}" fill="none" stroke="${o.accent}" stroke-width="18" stroke-linecap="round"/>`;
    const p=polar(200,205,150,sweep);s+=`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="6" fill="${o.accent}"/>`;
    num='−'+Math.round(vac);mode='COAST';mcol=o.accent;unit='kPa VAC';}
  s+=`<text x="200" y="195" fill="${mode==='DRIVE'&&mcol===o._T.redline?o._T.redline:o._T.text}" font-size="76" font-weight="700" text-anchor="middle" dominant-baseline="central">${num}</text>`;
  s+=`<text x="200" y="252" fill="${mcol}" font-size="17" font-weight="800" letter-spacing="4" text-anchor="middle">${mode}</text>`;
  s+=`<text x="200" y="276" fill="${o._T.muted}" font-size="11" text-anchor="middle">${unit}</text></svg>`;
  return s;}

// shared 7-segment digit (etboard scoreboard + c4digital tribute)
const SEG7={A:[10,0,30,8],B:[40,8,8,32],C:[40,48,8,32],D:[10,80,30,8],E:[2,48,8,32],F:[2,8,8,32],G:[10,40,30,8]};
const SEG7MAP={'0':'ABCDEF','1':'BC','2':'ABGED','3':'ABGCD','4':'FGBC','5':'AFGCD','6':'AFGEDC','7':'ABC','8':'ABCDEFG','9':'ABFGCD','-':'G',' ':''};
function seg7(ch,x,y,sc,LIT,UNLIT){let d='';for(const k in SEG7){const r=SEG7[k],on=(SEG7MAP[ch]||'').includes(k);
  d+=`<rect x="${f1(x+r[0]*sc)}" y="${f1(y+r[1]*sc)}" width="${f1(r[2]*sc)}" height="${f1(r[3]*sc)}" rx="${f1(2*sc)}" fill="${on?LIT:UNLIT}"${on?` stroke="${shade(LIT,0.6)}" stroke-width="1"`:''}/>`;}return d;}

function etboard(o){ // drag-strip ET scoreboard, incandescent 7-seg [motorsport]
  const S=PERF.get(),LIT='#ffb000',UNLIT='#1a1206',run=S.state==='run';
  const digit=(ch,x,y)=>seg7(ch,x,y,1,LIT,UNLIT);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 300" width="560" height="300" font-family="'Rajdhani','Consolas',monospace"><rect width="560" height="300" rx="12" fill="#3a4047"/><rect x="10" y="10" width="540" height="280" rx="6" fill="#0a0a08"/>`;
  [[15,15],[545,15],[15,285],[545,285]].forEach(p=>s+=`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#1c2024" stroke="#565e66"/>`);
  s+=`<text x="26" y="36" fill="#fff" font-size="16" font-weight="700" letter-spacing="3">¼ MILE</text>`;
  s+=`<circle cx="534" cy="30" r="7" fill="${run?'#ffb000':S.armed?'#27e36a':'#20262c'}"/>`;
  let et=null;
  if(run)et=(performance.now()-S.t0)/1000;else if(S.tQ!=null)et=S.tQ;
  let etStr='  --';let dotLit=false;
  if(et!=null){et=Math.min(99.99,et);etStr=et.toFixed(2).padStart(5,' ').replace('.','');dotLit=true;}
  else etStr='--- -'.replace(/ /g,'');
  const etCells=[150,212,286,348];
  const etChars=et!=null?etStr.split(''):['-','-','-','-'];
  etChars.slice(0,4).forEach((ch,i)=>s+=digit(ch,etCells[i],52));
  s+=`<rect x="270" y="132" width="8" height="8" rx="2" fill="${dotLit?LIT:UNLIT}"/>`;
  s+=`<text x="26" y="100" fill="#aab2ba" font-size="18" font-weight="700">ET</text>`;
  if(S.t60!=null)s+=`<text x="534" y="100" fill="${LIT}" font-size="20" font-weight="700" text-anchor="end">60: ${S.t60.toFixed(2)}</text>`;
  const mphStr=S.trap!=null?String(Math.round(S.trap)).padStart(3,' '):'---';
  [212,274,336].forEach((x,i)=>s+=digit(mphStr[i]===' '?' ':mphStr[i],x,168));
  s+=`<text x="26" y="216" fill="#aab2ba" font-size="18" font-weight="700">MPH</text>`;
  s+=`<text x="26" y="278" fill="#5c646e" font-size="14">BEST ${S.bestQ?S.bestQ.toFixed(2):'--.--'} @ ${S.bestTrap?Math.round(S.bestTrap):'---'}</text>`;
  const mphNow=fmtU('mph',HIST.last('mph'));
  s+=`<text x="534" y="278" fill="#aab2ba" font-size="14" text-anchor="end">${mphNow!=null?mphNow:'--'} MPH NOW</text></svg>`;
  return s;}

function eicas(o){ // Boeing EICAS engine dial w/ exceedance box [aviation]
  const U=UNITS[o.unit],rmax=U.max,rmin=U.min||0,redline=U.redline??null,val=o.value;
  const A0=-180,SW=270,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360" width="360" height="360" font-family="'Rajdhani',sans-serif"><rect width="360" height="360" rx="22" fill="${o._T.panel}"/>`;
  s+=`<path d="${arcP(180,180,140,A0,90)}" fill="none" stroke="${o._T.muted}" stroke-width="3"/>`;
  let ti=0;
  for(let v=rmin;v<=rmax+1e-9;v+=U.step){const a=ang(v),p1=polar(180,180,140,a),p2=polar(180,180,128,a);
    s+=`<line x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}" stroke="${o._T.text}" stroke-width="2"/>`;
    if(ti%2===0){const pn=polar(180,180,112,a);s+=`<text x="${f1(pn[0])}" y="${f1(pn[1])}" fill="${o._T.text}" font-size="14" font-weight="600" text-anchor="middle" dominant-baseline="central">${Math.round(v/U.div)}</text>`;}
    ti++;}
  if(redline!=null){
    s+=`<path d="${arcP(180,180,146,ang(0.9*redline),ang(redline))}" fill="none" stroke="${o._T.warn}" stroke-width="5"/>`;
    s+=`<path d="${arcP(180,180,146,ang(redline),ang(rmax))}" fill="none" stroke="${o._T.redline}" stroke-width="5"/>`;}
  const a=ang(clamp(val,rmin,rmax));
  if(a>A0+0.5)s+=`<path d="${arcP(180,180,132,A0,a)}" fill="none" stroke="${o.needle}" stroke-width="4"/>`;
  if(o.peak!=null){const ap=ang(Math.min(o.peak,rmax)),q1=polar(180,180,140,ap),q2=polar(180,180,152,ap);
    s+=`<line x1="${f1(q1[0])}" y1="${f1(q1[1])}" x2="${f1(q2[0])}" y2="${f1(q2[1])}" stroke="${o._T.text}" stroke-width="2.5" opacity="0.85"/>`;}
  const p1=polar(180,180,16,a),p2=polar(180,180,140,a);
  s+=`<line x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}" stroke="${o._T.text}" stroke-width="3.5"/><circle cx="180" cy="180" r="5" fill="${o._T.text}"/>`;
  const exceed=redline!=null&&val>=redline,near=redline!=null&&val>=0.9*redline&&!exceed;
  s+=`<rect x="210" y="240" width="120" height="56" rx="4" fill="${exceed?o._T.redline:'none'}" stroke="${exceed?'none':near?o._T.warn:o._T.text}" stroke-width="${near?3:2}"/>`;
  s+=`<text x="262" y="268" fill="${exceed?'#fff':near?o._T.warn:o._T.text}" font-size="34" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text>`;
  s+=`<text x="322" y="288" fill="${o._T.muted}" font-size="11" text-anchor="end">${U.sub||''}</text>`;
  s+=`<text x="110" y="110" fill="${o.accent}" font-size="16" font-weight="700" letter-spacing="2">${U.label}</text></svg>`;
  return s;}

function c4digital(o){ // 1984 C4 Corvette LCD cluster tribute [retro — the C7's grandfather]
  const U=UNITS[o.unit],rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value;
  const frac=clamp((val-rmin)/(rmax-rmin),0,1);
  const LCD=o.needle,DIM=shade(o.needle,0.22),AMBER='#ffb000';
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 260" width="520" height="260" font-family="'Rajdhani',sans-serif"><rect width="520" height="260" rx="10" fill="#05080a"/><rect x="4" y="4" width="512" height="252" rx="8" fill="none" stroke="#1a2226" stroke-width="2"/>`;
  // the iconic rising-segment speed bar
  const n=20;
  for(let i=0;i<n;i++){
    const fr=(i+0.5)/n,lit=fr<=frac,vh=rmin+fr*(rmax-rmin);
    const h=14+i*3.2,x=24+i*24,y=92-h;
    const col=vh>=redline?(lit?o._T.redline:shade(o._T.redline,0.25)):(lit?LCD:DIM);
    s+=`<rect x="${f1(x)}" y="${f1(y)}" width="17" height="${f1(h)}" fill="${col}"/>`;
  }
  s+=`<line x1="24" y1="98" x2="496" y2="98" stroke="${DIM}" stroke-width="2"/>`;
  for(let v=rmin;v<=rmax+1e-9;v+=U.step*2){const x=24+((v-rmin)/(rmax-rmin))*456;
    s+=`<text x="${f1(x)}" y="114" fill="${DIM}" font-size="12" font-weight="700" text-anchor="middle">${Math.round(v/U.div)}</text>`;}
  // giant LCD digits
  const str=String(val).slice(0,4),sc=1.0,dw=58;
  const x0=260-(str.length*dw)/2;
  str.split('').forEach((ch,i)=>{s+=seg7(SEG7MAP[ch]!=null?ch:'-',x0+i*dw,128,sc,val>=redline?o._T.redline:LCD,DIM);});
  s+=`<text x="${f1(x0+str.length*dw+16)}" y="206" fill="${AMBER}" font-size="22" font-weight="800">${U.label}</text>`;
  s+=`<text x="24" y="244" fill="${DIM}" font-size="12" letter-spacing="3">DIGITAL CLUSTER · EST 1984</text>`;
  if(o.peak!=null)s+=`<text x="496" y="244" fill="${AMBER}" font-size="14" font-weight="700" text-anchor="end">PEAK ${o.peak}</text>`;
  return s+'</svg>';}

function vfd(o){ // vacuum-fluorescent numeric display [retro hi-fi]
  const U=UNITS[o.unit],rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value;
  const GLOW=o.needle;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 180" width="340" height="180" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="vfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1112"/><stop offset="0.5" stop-color="#040707"/><stop offset="1" stop-color="#0a0f10"/></linearGradient></defs>`;
  s+=`<rect width="340" height="180" rx="12" fill="${o._T.panel}"/><rect x="14" y="14" width="312" height="118" rx="8" fill="url(#vfg)" stroke="#222a2c" stroke-width="2"/>`;
  // fake glow: soft underlayer text + crisp core (no filters — Pi cheap)
  const vstr=String(val),vc=val>=redline?o._T.redline:GLOW;
  s+=`<text x="170" y="78" fill="${vc}" opacity="0.35" font-size="78" font-weight="800" text-anchor="middle" dominant-baseline="central" letter-spacing="4" style="filter:none">${vstr}</text>`;
  s+=`<text x="170" y="74" fill="${shade(vc,1.45)}" font-size="70" font-weight="800" text-anchor="middle" dominant-baseline="central" letter-spacing="4">${vstr}</text>`;
  s+=`<text x="306" y="118" fill="${shade(GLOW,0.8)}" font-size="15" font-weight="700" text-anchor="end" opacity="0.85">${U.sub||''}</text>`;
  s+=`<text x="34" y="36" fill="${shade(GLOW,0.75)}" font-size="13" font-weight="700" letter-spacing="3" opacity="0.9">${U.label}</text>`;
  // segment ladder footer
  const n=24;
  for(let i=0;i<n;i++){const fr=(i+0.5)/n,lit=fr<=clamp((val-rmin)/(rmax-rmin),0,1);
    const vh=rmin+fr*(rmax-rmin),col=vh>=redline?o._T.redline:GLOW;
    s+=`<rect x="${24+i*12.2}" y="148" width="8" height="14" fill="${lit?col:shade(GLOW,0.18)}"${lit?' opacity="0.95"':''}/>`;}
  if(o.peak!=null){const px=24+clamp((o.peak-rmin)/(rmax-rmin),0,1)*((n-1)*12.2+8);
    s+=`<polygon points="${f1(px)},144 ${f1(px-4)},138 ${f1(px+4)},138" fill="${o.accent}"/>`;}
  return s+'</svg>';}

function horizon(o){ // horizon chart — 60s of history in a slim strip [data-viz]
  const U=UNITS[o.unit],rmax=U.max,rmin=U.min||0,val=o.value,mid=(rmin+rmax)/2,half=(rmax-rmin)/2;
  const w=520,h=120,px=14,py=30,gw=w-2*px,gh=h-52;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><rect width="${w}" height="${h}" rx="12" fill="${o._T.panel}"/>`;
  const hist=HIST.get(o.unit);
  if(hist.length>=2){
    const tEnd=hist[hist.length-1][0],win=HIST.windowMs(),N=60,bw=gw/N,buckets=new Array(N).fill(null);
    hist.forEach(([t,v])=>{const i=Math.floor((1-(tEnd-t)/win)*N);if(i>=0&&i<N)buckets[i]=buckets[i]==null?v:(buckets[i]+v)/2;});
    buckets.forEach((v,i)=>{
      if(v==null)return;
      const dev=(v-mid)/half,above=dev>=0,mag=clamp(Math.abs(dev),0,1);
      const col=above?o.needle:o.accent;
      // 3 stacked opacity bands = classic horizon fold
      for(let b=0;b<3;b++){const bandLo=b/3;if(mag<=bandLo)break;
        const bh2=clamp((mag-bandLo)*3,0,1)*gh;
        s+=`<rect x="${f1(px+i*bw)}" y="${f1(above?py+gh-bh2:py)}" width="${f1(bw+0.5)}" height="${f1(bh2)}" fill="${col}" opacity="${0.25+b*0.3}"/>`;}
    });
  } else s+=`<text x="${w/2}" y="${py+gh/2}" fill="${o._T.muted}" font-size="14" text-anchor="middle">gathering data…</text>`;
  s+=`<line x1="${px}" y1="${py+gh/2}" x2="${px+gw}" y2="${f1(py+gh/2)}" stroke="${o._T.grid}" stroke-width="1.5"/>`;
  s+=`<text x="${px}" y="20" fill="${o.accent}" font-size="14" font-weight="700" letter-spacing="2">${U.label} · 60s HORIZON</text>`;
  s+=`<text x="${w-px}" y="22" fill="${o._T.text}" font-size="26" font-weight="800" text-anchor="end">${val}</text>`;
  s+=`<text x="${px}" y="${h-10}" fill="${o._T.muted}" font-size="10">▲ ${o.needle===o.accent?'':'ABOVE MID'}</text><text x="${w-px}" y="${h-10}" fill="${o._T.muted}" font-size="10" text-anchor="end">${U.sub||''}</text>`;
  return s+'</svg>';}

function bullet(o){ // Stephen Few bullet graph — value vs bands vs target [data-viz]
  const U=UNITS[o.unit],rmax=U.max,rmin=U.min||0,redline=U.redline??null,val=o.value;
  const w=520,h=140,px=24,bx=120,bw=w-bx-100,by=52,bh=30;
  const X=v=>bx+clamp((v-rmin)/(rmax-rmin),0,1)*bw;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><rect width="${w}" height="${h}" rx="12" fill="${o._T.panel}"/>`;
  const b1=redline!=null?0.75*redline:0.6*(rmax-rmin)+rmin,b2=redline!=null?redline:0.85*(rmax-rmin)+rmin;
  s+=`<rect x="${bx}" y="${by-8}" width="${f1(X(b1)-bx)}" height="${bh+16}" fill="${shade(o._T.track,0.75)}"/>`;
  s+=`<rect x="${f1(X(b1))}" y="${by-8}" width="${f1(X(b2)-X(b1))}" height="${bh+16}" fill="${shade(o._T.track,1.15)}"/>`;
  s+=`<rect x="${f1(X(b2))}" y="${by-8}" width="${f1(bx+bw-X(b2))}" height="${bh+16}" fill="${shade(o._T.redline,0.35)}"/>`;
  const vc=redline!=null&&val>=redline?o._T.redline:o.needle;
  s+=`<rect x="${bx}" y="${by}" width="${f1(Math.max(X(val)-bx,2))}" height="${bh}" fill="${vc}"/>`;
  if(redline!=null)s+=`<rect x="${f1(X(redline)-2)}" y="${by-12}" width="4" height="${bh+24}" fill="${o._T.redline}"/>`;
  if(o.peak!=null)s+=`<rect x="${f1(X(Math.min(o.peak,rmax))-1.5)}" y="${by-6}" width="3" height="${bh+12}" fill="${o.accent}"/>`;
  for(let v=rmin;v<=rmax+1e-9;v+=U.step*2)s+=`<text x="${f1(X(v))}" y="${by+bh+28}" fill="${o._T.muted}" font-size="11" text-anchor="middle">${Math.round(v/U.div)}</text>`;
  s+=`<text x="${px}" y="${by+12}" fill="${o.accent}" font-size="16" font-weight="700" letter-spacing="1">${U.label}</text>`;
  s+=`<text x="${px}" y="${by+30}" fill="${o._T.muted}" font-size="11">${U.sub||''}</text>`;
  s+=`<text x="${w-16}" y="${by+22}" fill="${vc}" font-size="34" font-weight="800" text-anchor="end">${val}</text>`;
  return s+'</svg>';}

function deviation(o){ // diverging ±target bar w/ ghost trail [data-viz]
  const U=UNITS[o.unit],rmax=U.max,rmin=U.min||0,val=o.value;
  const X=v=>40+(v-rmin)/(rmax-rmin)*440;
  const cmdMode=o.unit==='afr'&&HIST.last('afrcmd')!=null;
  const A=cmdMode?HIST.last('afrcmd'):(rmin<0?0:(rmin+rmax)/2);
  const ax=X(A),tol=0.05*(rmax-rmin),dev=val-A;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 140" width="520" height="140" font-family="'Rajdhani',sans-serif"><rect width="520" height="140" rx="14" fill="${o._T.panel}"/>`;
  s+=`<rect x="${f1(X(A-tol))}" y="46" width="${f1(X(A+tol)-X(A-tol))}" height="48" fill="${shade(o._T.track,0.8)}"/>`;
  for(let k=Math.ceil(rmin/U.step)*U.step;k<=rmax+1e-9;k+=U.step)s+=`<text x="${f1(X(k))}" y="118" fill="${o._T.muted}" font-size="12" text-anchor="middle">${Math.round(k/U.div)}</text>`;
  const h=HIST.get(o.unit);
  if(h.length){const tEnd=h[h.length-1][0],win=HIST.windowMs();
    h.forEach(([t,v])=>{s+=`<rect x="${f1(X(clamp(v,rmin,rmax))-0.75)}" y="88" width="1.5" height="8" fill="${o.accent}" opacity="${f1(0.06+0.5*(1-(tEnd-t)/win))}"/>`;});}
  const bcol=Math.abs(dev)>tol?o._T.redline:dev<0?o.needle:o._T.warn;
  const bx=dev<0?X(clamp(val,rmin,rmax)):ax,bw=Math.abs(X(clamp(val,rmin,rmax))-ax);
  s+=`<rect x="${f1(bx)}" y="58" width="${f1(Math.max(bw,1))}" height="24" rx="3" fill="${bcol}"/>`;
  s+=`<line x1="${f1(ax)}" y1="38" x2="${f1(ax)}" y2="102" stroke="${o._T.text}" stroke-width="2.5"/>`;
  s+=`<text x="24" y="28" fill="${o.accent}" font-size="15" font-weight="700" letter-spacing="2">${U.label}${cmdMode?' <tspan font-size="11" fill="'+o._T.muted+'">vs CMD</tspan>':''}</text>`;
  const vtxt=cmdMode?((dev>=0?'+':'−')+Math.abs(dev).toFixed(1)):((rmin<0&&val>0?'+':'')+val);
  s+=`<text x="496" y="34" fill="${bcol}" font-size="40" font-weight="800" text-anchor="end">${vtxt}</text></svg>`;
  return s;}

const RENDER={round,arc,halfarc,ring,segarc,neon,bar,vbar,race,digit,trend,duo,tiles,timer,tape,telegraph,annunciator,readiness,pitroad,capacitor,powerflow,etboard,eicas,deviation,c4digital,vfd,horizon,bullet,tube,donut,modern,linear,flip,gforce,thermo,chevron,shiftlights};
// history-driven styles: pages re-render these when HIST.version() changes,
// not on every tick and not only when the primary value changes
const CHART_STYLES={trend:1,duo:1,tiles:1,timer:1,tape:1,annunciator:1,readiness:1,pitroad:1,powerflow:1,etboard:1,deviation:1,horizon:1};
// every renderer gets a derived theme on o._T before drawing
const _wrapT=f=>o=>{o._T=deriveTheme(o);return f(o);};
for(const k in RENDER)RENDER[k]=_wrapT(RENDER[k]);
const STYLES=[['round','Round dial — needle'],['arc','Sweep arc — digital'],['halfarc','Half arc'],['ring','Minimal ring'],['donut','Donut ring'],['tube','Glossy tube'],['modern','Modern minimal'],['segarc','Segmented arc'],['chevron','Chevron stack'],['neon','Neon outline'],['bar','Horizontal bar'],['vbar','Vertical bar'],['linear','Linear scale'],['thermo','Thermometer'],['race','Race shift-bar'],['shiftlights','Shift lights · per-gear'],['digit','Numeric readout'],['flip','Flip digits'],['trend','Trend chart · live history'],['duo','Dual trend — 2 signals'],['tiles','Data tiles · 2×2'],['timer','Perf timer · 0-60 / ¼ mile'],['gforce','G-meter'],
['tape','PFD speed tape · scrolling scale'],['eicas','EICAS dial · exceedance box'],['capacitor','EVE capacitor wheel'],['telegraph','Engine telegraph · brass'],['annunciator','Master caution · all sensors'],['readiness','Readiness · engine score'],['pitroad','Pit road · loop averages'],['powerflow','Power flow · drive/coast'],['etboard','Drag scoreboard · live ET'],['deviation','Deviation bar · ±target'],
['c4digital','C4 digital · 1984 tribute'],['vfd','VFD glow · numeric'],['horizon','Horizon strip · 60s history'],['bullet','Bullet graph · vs target']];

/* 48-palette library — deep multi-agent color research 2026-06-11:
   OEM clusters, motorsport liveries, classic instruments, game/sci-fi HUDs
   (incl. EVE Online), night-vision science, beloved dev themes. face/track
   keys appear only where derivation can't reproduce the real thing. */
const PALETTES=[
 // — Signature (legacy favorites, kept verbatim) —
 {name:'Amber',family:'Signature',needle:'#ff7a00',accent:'#ffae00'},
 {name:'Lime',family:'Signature',needle:'#b8ff00',accent:'#e3ff9a'},
 {name:'Cyan',family:'Signature',needle:'#1ae7ff',accent:'#9fe7ff'},
 {name:'Synthwave',family:'Signature',needle:'#ff2bd6',accent:'#00f0ff'},
 {name:'Violet',family:'Signature',needle:'#8a5cff',accent:'#c9b4ff'},
 {name:'Red',family:'Signature',needle:'#ff3b30',accent:'#ffd0cc'},
 {name:'Gold',family:'Signature',needle:'#e8b04b',accent:'#f0d79a'},
 {name:'Tactical',family:'Signature',needle:'#39ff14',accent:'#c7ffb0'},
 // — Cyber —
 {name:'Night City',family:'Cyber',needle:'#fcee0a',accent:'#02d7f2',face:'#0b0b0d',track:'#232323'},
 {name:'Amber Phosphor',family:'Cyber',needle:'#ffb000',accent:'#cc8400',face:'#050300',track:'#241a06'},
 {name:'Nostromo CRT',family:'Cyber',needle:'#33ff33',accent:'#4faf4f',face:'#020402',track:'#0e2410'},
 {name:'Joi Hologram',family:'Cyber',needle:'#2ad9d2',accent:'#f4f7f7',face:'#0a1216',track:'#153a42'},
 {name:'Tron Grid',family:'Cyber',needle:'#6fc3df',accent:'#e6ffff',face:'#0c141f',track:'#193f4a'},
 {name:'Outrun',family:'Cyber',needle:'#ff2975',accent:'#00ffff',face:'#150f2e',track:'#2d1b4e'},
 {name:'Vegas Haze',family:'Cyber',needle:'#f78b04',accent:'#23ae9c',face:'#14100c',track:'#2b1718'},
 // — Night —
 {name:'Night Amber',family:'Night',needle:'#ffa226',accent:'#ffd9a0'},
 {name:'NVIS Green',family:'Night',needle:'#aef25c',accent:'#e2ffc2',face:'#10150c',track:'#1e2616'},
 {name:'Abyss',family:'Night',needle:'#00e5ff',accent:'#7adfff',face:'#06161f',track:'#0e2b36'},
 {name:'Night Watch',family:'Night',needle:'#ff7a3c',accent:'#8a9099',face:'#0a0c10',track:'#161a20'},
 {name:'Night Ember',family:'Night',needle:'#ff4f3c',accent:'#ffb3a6'},
 {name:'Nightshade',family:'Night',needle:'#9d6bff',accent:'#cdb6ff',track:'#241640'},
 // — Wrap —
 {name:'Verde Mantis',family:'Wrap',needle:'#7dc23b',accent:'#d2eda9'},
 {name:'Miami Blue',family:'Wrap',needle:'#00b5c8',accent:'#9fe4ee'},
 {name:'Nardo',family:'Wrap',needle:'#c0c6c8',accent:'#93989b'},
 // — OEM —
 {name:'C8 Track',family:'OEM',needle:'#ffd400',accent:'#eef1f4',face:'#0b0d10',track:'#21262c'},
 {name:'C6R Track',family:'OEM',needle:'#f5f7fa',accent:'#ffd23f',face:'#0c0e11'},
 {name:'Stingray Blue',family:'OEM',needle:'#3f8cff',accent:'#bcd7ff'},
 {name:'Acid E',family:'OEM',needle:'#bccf00',accent:'#d7e0e6',face:'#0d1013',track:'#1e2226'},
 {name:'Heritage 356',family:'OEM',needle:'#74c69d',accent:'#f2f5f1'},
 {name:'Nine Thousand',family:'OEM',needle:'#e9edf0',accent:'#9aa7b2'},
 {name:'M Sport',family:'OEM',needle:'#ff5f1f',accent:'#6fc2ff',face:'#121419',track:'#21242b'},
 {name:'C8 Sport',family:'OEM',needle:'#ff4048',accent:'#ff9b92',face:'#190f12',track:'#2b181b'},
 // — Racing —
 {name:'Gulf Le Mans',family:'Racing',needle:'#ff7403',accent:'#93dafe',track:'#192c76'},
 {name:'JPS Black Gold',family:'Racing',needle:'#d8bc73',accent:'#b6995b',face:'#0d0d0d',track:'#26221a'},
 {name:'Stack Rally',family:'Racing',needle:'#ff4000',accent:'#f5f7f7',face:'#0e0e10',track:'#26262a'},
 {name:'Jägermeister',family:'Racing',needle:'#f36f21',accent:'#ffc58f',face:'#0b2610',track:'#1c3a28'},
 {name:'Martini Stripe',family:'Racing',needle:'#ff4757',accent:'#71c5e7',track:'#002f5f'},
 // — Classic —
 {name:'Radium',family:'Classic',needle:'#63d471',accent:'#e0c588',face:'#0b0d0b',track:'#1e2a1e'},
 {name:'MiG Cockpit',family:'Classic',needle:'#f4f6f5',accent:'#439284',face:'#101714',track:'#2a3b36'},
 // — Game —
 {name:'Ghost Amber',family:'Game',needle:'#fdcd47',accent:'#e5e8ee',face:'#151d20',track:'#29303c'},
 {name:'EVE Capacitor',family:'Game',needle:'#ffd98a',accent:'#f5a623',face:'#10141a',track:'#2a2419'},
 {name:'EVE Photon',family:'Game',needle:'#b8d9e8',accent:'#6e8ea0'},
 {name:'Triglavian',family:'Game',needle:'#a8be7b',accent:'#cf4a3a',face:'#0a0405',track:'#2b1214'},
 // — Clean —
 {name:'Clean White',family:'Clean',needle:'#f2f6fa',accent:'#ffae00'},
 {name:'Okabe Sky',family:'Clean',needle:'#56b4e9',accent:'#e69f00'},
 {name:'Solar Yellow',family:'Clean',needle:'#f0e442',accent:'#00c389',face:'#14171c'},
 {name:'Porcelain',family:'Clean',needle:'#c8102e',accent:'#2d3640',face:'#f4f6f8',track:'#d7dde3'},
 {name:'Gallery',family:'Clean',needle:'#111418',accent:'#5c646e',face:'#ffffff',track:'#e4e8ec'},
 {name:'Cream Dial',family:'Clean',needle:'#1d2733',accent:'#6f5526',face:'#f2ead8',track:'#ddd2b8'},
 // — Dev —
 {name:'Catppuccin',family:'Dev',needle:'#cba6f7',accent:'#fab387',face:'#1e1e2e',track:'#313244'},
 {name:'Tokyo Night',family:'Dev',needle:'#7aa2f7',accent:'#bb9af7',face:'#1a1b26',track:'#292e42'},
 {name:'Dracula',family:'Dev',needle:'#ff79c6',accent:'#bd93f9',face:'#282a36',track:'#44475a'},
 {name:'Gruvbox',family:'Dev',needle:'#fe8019',accent:'#fabd2f',face:'#282828',track:'#3c3836'},
 {name:'Rose Pine',family:'Dev',needle:'#ebbcba',accent:'#f6c177',face:'#191724',track:'#26233a'},
 {name:'Kanagawa',family:'Dev',needle:'#7e9cd8',accent:'#e6c384',face:'#1f1f28',track:'#223249'},
 {name:'Nord',family:'Dev',needle:'#88c0d0',accent:'#81a1c1',face:'#2e3440',track:'#3b4252'}
];

window.HBG={RENDER,UNITS,PALETTES,STYLES,CHART_STYLES,START,SWEEP,f1,polar,arcP,shade,lum,bezelDef,faceDef,deriveTheme,hex2hsl,hsl2hex,HIST,PERF};
})();
