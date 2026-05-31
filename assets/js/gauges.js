/* Honeybadger gauge engine (shared) — extracted verbatim from the live builder.
   Pure SVG renderers; what renders here ships pixel-identical on the dash. */
(function(){
const RAD=Math.PI/180, f1=n=>Number(n).toFixed(1);
function polar(cx,cy,r,d){const a=d*RAD;return[cx+r*Math.sin(a),cy-r*Math.cos(a)];}
function arcP(cx,cy,r,d0,d1){const[x0,y0]=polar(cx,cy,r,d0),[x1,y1]=polar(cx,cy,r,d1);const l=Math.abs(d1-d0)>180?1:0;return`M ${f1(x0)} ${f1(y0)} A ${r} ${r} 0 ${l} 1 ${f1(x1)} ${f1(y1)}`;}
function hx(c){return[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));}
function shade(c,f){let[r,g,b]=hx(c);const cl=x=>Math.max(0,Math.min(255,Math.round(x)));if(f>=1){r+=(255-r)*(f-1);g+=(255-g)*(f-1);b+=(255-b)*(f-1);}else{r*=f;g*=f;b*=f;}return'#'+[r,g,b].map(x=>cl(x).toString(16).padStart(2,'0')).join('');}
const lum=c=>{const[r,g,b]=hx(c);return r+g+b;};

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
  if(fc==='carbon')return['<linearGradient id="cw1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2c3137"/><stop offset="1" stop-color="#131518"/></linearGradient><linearGradient id="cw2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3137"/><stop offset="1" stop-color="#131518"/></linearGradient><pattern id="fc" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#131518"/><rect width="11" height="11" fill="url(#cw1)"/><rect x="11" y="11" width="11" height="11" fill="url(#cw1)"/><rect x="11" width="11" height="11" fill="url(#cw2)"/><rect y="11" width="11" height="11" fill="url(#cw2)"/></pattern>','#131518'];
  if(fc==='silver')return['<radialGradient id="fc" cx="50%" cy="36%" r="76%"><stop offset="0" stop-color="#f3f5f7"/><stop offset="0.58" stop-color="#d2d7db"/><stop offset="1" stop-color="#9aa0a6"/></radialGradient>','#d2d7db'];
  if(fc==='brushed')return['<radialGradient id="fc" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#cfd4d8"/><stop offset="0.5" stop-color="#a6acb2"/><stop offset="1" stop-color="#7e858c"/></radialGradient>','#a6acb2'];
  if(fc==='white')return['<radialGradient id="fc" cx="50%" cy="36%" r="78%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#f1f3f5"/><stop offset="1" stop-color="#d7dbdf"/></radialGradient>','#ffffff'];
  return['<radialGradient id="fc" cx="50%" cy="36%" r="76%"><stop offset="0" stop-color="'+shade('#171b21',1.45)+'"/><stop offset="0.58" stop-color="#171b21"/><stop offset="1" stop-color="'+shade('#171b21',0.45)+'"/></radialGradient>','#171b21'];
}

function round(o){
  const U=UNITS[o.unit],size=400,cx=200,cy=200,R=196,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>START+((v-rmin)/(rmax-rmin))*SWEEP;
  const [bz,bevel]=bezelDef(o.bezel), [face,faceval]=faceDef(o.face);
  const tcol=lum(faceval)>470?'#0a0c0d':'#ffffff';
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" font-family="'Rajdhani','Segoe UI',sans-serif"><defs>${bz}${face}<linearGradient id="ndl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(o.needle,1.55)}"/><stop offset="1" stop-color="${shade(o.needle,0.85)}"/></linearGradient><radialGradient id="hub" cx="40%" cy="34%" r="72%"><stop offset="0" stop-color="#eef1f3"/><stop offset="0.46" stop-color="#969ca2"/><stop offset="1" stop-color="#34383c"/></radialGradient><radialGradient id="gl" cx="50%" cy="15%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity="0.3"/><stop offset="0.4" stop-color="#fff" stop-opacity="0.06"/><stop offset="0.68" stop-color="#fff" stop-opacity="0"/></radialGradient><clipPath id="cl"><circle cx="${cx}" cy="${cy}" r="${R-26}"/></clipPath><filter id="dr" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.6"/></filter></defs>`;
  s+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#bz)"/><circle cx="${cx}" cy="${cy}" r="${R-13}" fill="none" stroke="${bevel}" stroke-width="4"/><circle cx="${cx}" cy="${cy}" r="${R-26}" fill="url(#fc)"/>`;
  if(U.redline)s+=`<path d="${arcP(cx,cy,R-40,ang(redline),ang(rmax))}" fill="none" stroke="#ff3b30" stroke-width="10" stroke-linecap="round"/>`;
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
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="fl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${o.needle}"/><stop offset="0.62" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff3b30"/></linearGradient><filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="${size}" height="${size}" rx="24" fill="#0c0f13"/>`;
  s+=`<path d="${arcP(cx,cy,R,A0,A1)}" fill="none" stroke="#232a33" stroke-width="22" stroke-linecap="round"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="url(#fl)" stroke-width="22" stroke-linecap="round" filter="url(#g)"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="url(#fl)" stroke-width="22" stroke-linecap="round"/>`;
  if(U.redline){const r1=polar(cx,cy,R-16,ang(redline)),r2=polar(cx,cy,R+16,ang(redline));s+=`<line x1="${f1(r1[0])}" y1="${f1(r1[1])}" x2="${f1(r2[0])}" y2="${f1(r2[1])}" stroke="#ff3b30" stroke-width="4"/>`;}
  if(o.peak!=null&&o.peak>rmin){const pp=polar(cx,cy,R,ang(Math.min(o.peak,rmax)));s+=`<circle cx="${f1(pp[0])}" cy="${f1(pp[1])}" r="7" fill="#fff" stroke="${o.needle}" stroke-width="2.5"/>`;}
  s+=`<text x="${cx}" y="${cy+6}" fill="#fff" font-size="76" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text><text x="${cx}" y="${cy+52}" fill="${o.accent}" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}</text></svg>`;return s;}
function halfarc(o){const U=UNITS[o.unit],w=440,h=258,cx=220,cy=h-28,R=h-54,A0=-90,A1=90,SW=180,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="fl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${o.needle}"/><stop offset="0.62" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff3b30"/></linearGradient><filter id="g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter></defs><rect width="${w}" height="${h}" rx="20" fill="#0c0f13"/>`;
  s+=`<path d="${arcP(cx,cy,R,A0,A1)}" fill="none" stroke="#232a33" stroke-width="22" stroke-linecap="round"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="url(#fl)" stroke-width="22" stroke-linecap="round" filter="url(#g)"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="url(#fl)" stroke-width="22" stroke-linecap="round"/>`;
  s+=`<text x="${cx}" y="${cy-16}" fill="#fff" font-size="68" font-weight="800" text-anchor="middle">${val}</text><text x="${cx}" y="${cy+12}" fill="${o.accent}" font-size="15" font-weight="700" text-anchor="middle" letter-spacing="4">${U.label}</text></svg>`;return s;}
function ring(o){const U=UNITS[o.unit],size=360,cx=180,cy=180,R=146,A0=-140,A1=140,SW=280,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" font-family="'Rajdhani',sans-serif"><defs><filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.5"/></filter></defs><rect width="${size}" height="${size}" rx="22" fill="#0c0f13"/>`;
  s+=`<path d="${arcP(cx,cy,R,A0,A1)}" fill="none" stroke="#232a33" stroke-width="13" stroke-linecap="round"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="${o.needle}" stroke-width="13" stroke-linecap="round" filter="url(#g)"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="${o.needle}" stroke-width="13" stroke-linecap="round"/>`;
  if(U.redline){const rp=polar(cx,cy,R,ang(redline));s+=`<circle cx="${f1(rp[0])}" cy="${f1(rp[1])}" r="5.5" fill="#ff3b30"/>`;}
  if(o.peak!=null&&o.peak>rmin){const pp=polar(cx,cy,R,ang(Math.min(o.peak,rmax)));s+=`<circle cx="${f1(pp[0])}" cy="${f1(pp[1])}" r="6" fill="#fff" stroke="${o.needle}" stroke-width="2"/>`;}
  s+=`<text x="${cx}" y="${cy-2}" fill="#fff" font-size="70" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text><text x="${cx}" y="${cy+44}" fill="${o.accent}" font-size="15" font-weight="700" text-anchor="middle" letter-spacing="4">${U.label}</text></svg>`;return s;}
function segarc(o){const U=UNITS[o.unit],size=400,cx=200,cy=200,R=164,A0=-120,A1=120,SW=240,n=22,sw=SW/n,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" font-family="'Rajdhani',sans-serif"><rect width="${size}" height="${size}" rx="24" fill="#0c0f13"/>`;
  for(let i=0;i<n;i++){const a0=A0+i*sw+1.3,a1=A0+(i+1)*sw-1.3,mid=rmin+(i+0.5)/n*(rmax-rmin),lit=mid<=val,c=mid>=redline?'#ff3b30':(mid>=redline*0.78?'#ffd23f':o.needle);
    s+=`<path d="${arcP(cx,cy,R,a0,a1)}" fill="none" stroke="${lit?c:'#232a33'}" stroke-width="26"/>`;}
  s+=`<text x="${cx}" y="${cy-4}" fill="#fff" font-size="78" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text><text x="${cx}" y="${cy+50}" fill="${o.accent}" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}</text></svg>`;return s;}
function neon(o){const U=UNITS[o.unit],size=380,cx=190,cy=190,R=156,A0=-135,A1=135,SW=270,nz=o.needle,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" font-family="'Rajdhani',sans-serif"><defs><filter id="nz" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="${size}" height="${size}" rx="24" fill="#06070a"/>`;
  s+=`<path d="${arcP(cx,cy,R,A0,A1)}" fill="none" stroke="${shade(nz,0.28)}" stroke-width="3"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="${nz}" stroke-width="5" stroke-linecap="round" filter="url(#nz)"/>`;
  for(let k=rmin;k<=rmax+1e-6;k+=U.step){const a=ang(k),o1=polar(cx,cy,R-11,a),o2=polar(cx,cy,R-23,a),col=U.redline&&k>=redline?'#ff3b6b':nz;
    s+=`<line x1="${f1(o1[0])}" y1="${f1(o1[1])}" x2="${f1(o2[0])}" y2="${f1(o2[1])}" stroke="${col}" stroke-width="2.5" filter="url(#nz)"/>`;}
  s+=`<text x="${cx}" y="${cy+4}" fill="${nz}" font-size="74" font-weight="800" text-anchor="middle" dominant-baseline="central" filter="url(#nz)">${val}</text><text x="${cx}" y="${cy+50}" fill="${nz}" font-size="15" font-weight="700" text-anchor="middle" letter-spacing="4">${U.label}</text></svg>`;return s;}
function bar(o){const U=UNITS[o.unit],w=520,h=170,pad=20,n=30,gap=4,bx=pad,by=46,bh=54,bw=w-2*pad-150,seg=(bw-(n-1)*gap)/n,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.42" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="${w}" height="${h}" rx="16" fill="#0c0f13"/>`;
  for(let i=0;i<n;i++){const rp=rmin+(i+0.5)/n*(rmax-rmin),lit=rp<=val,c=rp>=redline?'#ff3b30':(rp>=redline*0.82?'#ffd23f':o.needle),x=bx+i*(seg+gap);
    s+=`<rect x="${f1(x)}" y="${by}" width="${f1(seg)}" height="${bh}" rx="3" fill="${lit?c:'#232a33'}"/>`;if(lit)s+=`<rect x="${f1(x)}" y="${by}" width="${f1(seg)}" height="${bh}" rx="3" fill="url(#sg)"/>`;}
  for(let k=rmin;k<=rmax+1e-6;k+=U.step){const fx=bx+((k-rmin)/(rmax-rmin))*bw;s+=`<text x="${f1(fx)}" y="${by+bh+18}" fill="#79818b" font-size="13" font-weight="600" text-anchor="middle">${Math.round(k/U.div)}</text>`;}
  if(o.peak!=null&&o.peak>rmin){const pkx=bx+((Math.min(o.peak,rmax)-rmin)/(rmax-rmin))*bw;s+=`<rect x="${f1(pkx-1.5)}" y="${by-4}" width="3" height="${bh+8}" rx="1.5" fill="${o.accent}"/>`;}
  s+=`<text x="${bx}" y="${by-10}" fill="${o.accent}" font-size="14" font-weight="700" letter-spacing="2">${U.label}${U.sub?' '+U.sub:''}</text><text x="${w-pad}" y="${by+38}" fill="#fff" font-size="44" font-weight="800" text-anchor="end">${val}</text><text x="${w-pad}" y="${by+bh+18}" fill="#79818b" font-size="13" text-anchor="end">${U.label}</text></svg>`;return s;}
function vbar(o){const U=UNITS[o.unit],w=180,h=380,bw=58,bx=(w-bw)/2,by=54,bh=h-104,n=22,gap=4,seg=(bh-(n-1)*gap)/n,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.42" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="${w}" height="${h}" rx="16" fill="#0c0f13"/>`;
  for(let i=0;i<n;i++){const rp=rmin+(i+0.5)/n*(rmax-rmin),lit=rp<=val,c=rp>=redline?'#ff3b30':(rp>=redline*0.82?'#ffd23f':o.needle),y=by+bh-(i+1)*seg-i*gap;
    s+=`<rect x="${f1(bx)}" y="${f1(y)}" width="${bw}" height="${f1(seg)}" rx="3" fill="${lit?c:'#232a33'}"/>`;if(lit)s+=`<rect x="${f1(bx)}" y="${f1(y)}" width="${bw}" height="${f1(seg)}" rx="3" fill="url(#sg)"/>`;}
  if(o.peak!=null&&o.peak>rmin){const pky=by+bh-((Math.min(o.peak,rmax)-rmin)/(rmax-rmin))*bh;s+=`<rect x="${f1(bx-4)}" y="${f1(pky-1.5)}" width="${bw+8}" height="3" rx="1.5" fill="${o.accent}"/>`;}
  s+=`<text x="${w/2}" y="36" fill="#fff" font-size="30" font-weight="800" text-anchor="middle">${val}</text><text x="${w/2}" y="${h-20}" fill="${o.accent}" font-size="13" font-weight="700" text-anchor="middle" letter-spacing="2">${U.label}</text></svg>`;return s;}

function race(o){const U=UNITS[o.unit],w=560,h=300,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,n=18,pad=24,gap=5,bw=w-2*pad,seg=(bw-(n-1)*gap)/n,by=22,bh=30,ratio=Math.min(1,Math.max(0,(val-rmin)/(rmax-rmin)));
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani','Consolas',monospace"><defs><filter id="rg" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6"/></filter></defs>`;
  s+=`<rect width="${w}" height="${h}" rx="14" fill="#06080b"/><rect x="3" y="3" width="${w-6}" height="${h-6}" rx="12" fill="none" stroke="#171d26" stroke-width="2"/>`;
  for(let i=0;i<n;i++){const frac=(i+0.5)/n,lit=frac<=ratio,c=frac>0.93?'#8a5cff':frac>0.82?'#ff3b30':frac>0.58?'#ffd23f':'#27e36a',x=pad+i*(seg+gap);
    s+=`<rect x="${f1(x)}" y="${by}" width="${f1(seg)}" height="${bh}" rx="2" fill="${lit?c:'#11161d'}"${lit?' filter="url(#rg)"':''}/>`;}
  s+=`<text x="${w/2}" y="${by+bh+24}" fill="${ratio>=0.88?'#ff3b30':'#2b333e'}" font-size="14" font-weight="800" text-anchor="middle" letter-spacing="6">▲ SHIFT ▲</text>`;
  s+=`<text x="${w/2}" y="${h/2+46}" fill="#fff" font-size="116" font-weight="800" text-anchor="middle" dominant-baseline="middle">${val}</text>`;
  s+=`<text x="${w/2}" y="${h-24}" fill="${o.accent}" font-size="18" font-weight="700" text-anchor="middle" letter-spacing="5">${U.label}${U.sub?' · '+U.sub:''}</text>`;
  s+=`<text x="${pad}" y="${h-24}" fill="#1ae7ff" font-size="20" font-weight="700">${Math.round(ratio*100)}<tspan font-size="11" fill="#5b6772"> %</tspan></text>`;
  s+=`<text x="${w-pad}" y="${h-24}" fill="#27e36a" font-size="20" font-weight="700" text-anchor="end">${Math.round((U.redline?redline:rmax)/U.div)}<tspan font-size="11" fill="#5b6772"> RL</tspan></text>`;
  s+=`</svg>`;return s;}
function digit(o){const U=UNITS[o.unit],w=300,h=170,val=o.value,redline=U.redline??Infinity,vc=val>=redline?'#ff3b30':'#ffffff';
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani','Consolas',monospace">`;
  s+=`<rect width="${w}" height="${h}" rx="14" fill="#0c0f13"/><rect x="2" y="2" width="${w-4}" height="${h-4}" rx="12" fill="none" stroke="#1c2530" stroke-width="2"/>`;
  s+=`<rect x="0" y="0" width="${w}" height="7" rx="3" fill="${o.accent}"/>`;
  s+=`<text x="${w/2}" y="44" fill="${o.accent}" font-size="19" font-weight="700" letter-spacing="3" text-anchor="middle">${U.label}</text>`;
  s+=`<text x="${w/2}" y="${h/2+30}" fill="${vc}" font-size="74" font-weight="800" text-anchor="middle" dominant-baseline="middle">${val}</text>`;
  s+=`<text x="${w/2}" y="${h-20}" fill="#79818b" font-size="16" font-weight="600" text-anchor="middle" letter-spacing="2">${U.sub||''}</text>`;
  s+=`</svg>`;return s;}
function trend(o){const U=UNITS[o.unit],w=380,h=200,rmax=U.max,rmin=U.min||0,val=o.value,redline=U.redline??(rmax+1),px=24,py=24,gw=w-2*px,gh=h-58;
  const base=Math.max(0.05,Math.min(0.95,(val-rmin)/(rmax-rmin)));let pts=[];const N=48;
  for(let i=0;i<=N;i++){const t=i/N;let v=base+0.12*Math.sin(t*8.5+0.6)+0.06*Math.sin(t*21+2)-0.04*(1-t);v=Math.max(0.04,Math.min(0.97,v));pts.push([px+t*gw,py+gh-v*gh]);}
  const d='M '+pts.map(p=>f1(p[0])+' '+f1(p[1])).join(' L ');
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.needle}" stop-opacity="0.4"/><stop offset="1" stop-color="${o.needle}" stop-opacity="0"/></linearGradient></defs>`;
  s+=`<rect width="${w}" height="${h}" rx="14" fill="#0c0f13"/>`;
  for(let g=0;g<=3;g++){const yy=py+gh*g/3;s+=`<line x1="${px}" y1="${f1(yy)}" x2="${px+gw}" y2="${f1(yy)}" stroke="#1c2530" stroke-width="1"/>`;}
  if(U.redline){const ry=py+gh-Math.max(0,Math.min(1,(redline-rmin)/(rmax-rmin)))*gh;s+=`<line x1="${px}" y1="${f1(ry)}" x2="${px+gw}" y2="${f1(ry)}" stroke="#ff3b30" stroke-width="1.5" stroke-dasharray="5 4"/>`;}
  s+=`<path d="${d} L ${f1(px+gw)} ${py+gh} L ${px} ${py+gh} Z" fill="url(#ar)"/><path d="${d}" fill="none" stroke="${o.needle}" stroke-width="3" stroke-linejoin="round"/>`;
  s+=`<circle cx="${f1(pts[N][0])}" cy="${f1(pts[N][1])}" r="4" fill="#fff"/>`;
  s+=`<text x="${px}" y="17" fill="${o.accent}" font-size="15" font-weight="700" letter-spacing="2">${U.label}</text>`;
  s+=`<text x="${w-px}" y="${h-14}" fill="#fff" font-size="30" font-weight="800" text-anchor="end">${val}<tspan font-size="13" fill="#79818b"> ${U.sub||''}</tspan></text>`;
  s+=`</svg>`;return s;}
function tube(o){const U=UNITS[o.unit],z=400,cx=200,cy=200,R=150,A0=-135,A1=135,SW=270,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${z} ${z}" width="${z}" height="${z}" font-family="'Rajdhani',sans-serif"><defs><linearGradient id="tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(o.needle,1.5)}"/><stop offset="1" stop-color="${shade(o.needle,0.7)}"/></linearGradient><filter id="tg" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter></defs><rect width="${z}" height="${z}" rx="24" fill="#0c0f13"/>`;
  s+=`<path d="${arcP(cx,cy,R,A0,A1)}" fill="none" stroke="#1d242d" stroke-width="36" stroke-linecap="round"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="url(#tb)" stroke-width="36" stroke-linecap="round" filter="url(#tg)"/><path d="${arcP(cx,cy,R,A0,ang(val))}" fill="none" stroke="url(#tb)" stroke-width="36" stroke-linecap="round"/><path d="${arcP(cx,cy,R+10,A0,ang(val))}" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="7" stroke-linecap="round"/>`;
  s+=`<text x="${cx}" y="${cy+4}" fill="#fff" font-size="80" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text><text x="${cx}" y="${cy+54}" fill="${o.accent}" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}</text></svg>`;return s;}
function donut(o){const U=UNITS[o.unit],z=360,cx=180,cy=180,R=128,A0=-90,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,frac=Math.max(0,Math.min(1,(val-rmin)/(rmax-rmin))),col=val>=redline?'#ff3b30':o.needle;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${z} ${z}" width="${z}" height="${z}" font-family="'Rajdhani',sans-serif"><defs><filter id="dg" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="${z}" height="${z}" rx="22" fill="#0c0f13"/>`;
  s+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#1d242d" stroke-width="28"/>`;
  if(frac>0.001){const a1=A0+frac*359.999;s+=`<path d="${arcP(cx,cy,R,A0,a1)}" fill="none" stroke="${col}" stroke-width="28" stroke-linecap="round" filter="url(#dg)"/><path d="${arcP(cx,cy,R,A0,a1)}" fill="none" stroke="${col}" stroke-width="28" stroke-linecap="round"/>`;}
  s+=`<text x="${cx}" y="${cy-2}" fill="#fff" font-size="62" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text><text x="${cx}" y="${cy+38}" fill="${o.accent}" font-size="15" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}${U.sub?' '+U.sub:''}</text></svg>`;return s;}
function modern(o){const U=UNITS[o.unit],z=380,cx=190,cy=190,R=162,A0=-140,A1=140,SW=280,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,ang=v=>A0+((v-rmin)/(rmax-rmin))*SW,NT=64;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${z} ${z}" width="${z}" height="${z}" font-family="'Rajdhani',sans-serif"><rect width="${z}" height="${z}" rx="24" fill="#0c0f13"/>`;
  for(let i=0;i<=NT;i++){const v=rmin+(i/NT)*(rmax-rmin),a=ang(v),lit=v<=val,big=i%8===0,o1=polar(cx,cy,R,a),o2=polar(cx,cy,R-(big?22:12),a),col=v>=redline?'#ff3b30':(lit?o.needle:'#28313c');s+=`<line x1="${f1(o1[0])}" y1="${f1(o1[1])}" x2="${f1(o2[0])}" y2="${f1(o2[1])}" stroke="${col}" stroke-width="${big?3.4:2}"/>`;}
  s+=`<text x="${cx}" y="${cy+8}" fill="#fff" font-size="86" font-weight="800" text-anchor="middle" dominant-baseline="central">${val}</text><text x="${cx}" y="${cy+56}" fill="${o.accent}" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}</text></svg>`;return s;}
function linear(o){const U=UNITS[o.unit],w=160,h=360,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,bx=72,bw=34,by=34,bh=h-92,frac=Math.max(0,Math.min(1,(val-rmin)/(rmax-rmin))),fillH=frac*bh,col=val>=redline?'#ff3b30':o.needle;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><rect width="${w}" height="${h}" rx="16" fill="#0c0f13"/>`;
  s+=`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="7" fill="#12171d" stroke="#222a33"/><rect x="${bx}" y="${f1(by+bh-fillH)}" width="${bw}" height="${f1(fillH)}" rx="7" fill="${col}"/>`;
  for(let v=rmin;v<=rmax+1e-6;v+=U.step){const y=by+bh-((v-rmin)/(rmax-rmin))*bh;s+=`<line x1="${bx-9}" y1="${f1(y)}" x2="${bx-3}" y2="${f1(y)}" stroke="#5b6772" stroke-width="2"/><text x="${bx-12}" y="${f1(y+4)}" fill="#79818b" font-size="12" font-weight="600" text-anchor="end">${Math.round(v/U.div)}</text>`;}
  s+=`<text x="${bx+bw+12}" y="${by+12}" fill="${o.accent}" font-size="13" font-weight="700" letter-spacing="1">${U.label}</text><text x="${w/2}" y="${h-22}" fill="#fff" font-size="30" font-weight="800" text-anchor="middle">${val}</text></svg>`;return s;}
function flip(o){const U=UNITS[o.unit],val=o.value,str=String(val),dw=54,dh=82,gap=8,sx=20,sy=46,w=str.length*dw+(str.length-1)*gap+40,h=172;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Consolas',monospace"><rect width="${w}" height="${h}" rx="14" fill="#0c0f13"/>`;
  for(let i=0;i<str.length;i++){const x=sx+i*(dw+gap);s+=`<rect x="${x}" y="${sy}" width="${dw}" height="${dh}" rx="7" fill="#181d23" stroke="#05070a" stroke-width="1.5"/><rect x="${x}" y="${sy}" width="${dw}" height="${dh/2}" rx="7" fill="#20262d"/><line x1="${x}" y1="${sy+dh/2}" x2="${x+dw}" y2="${sy+dh/2}" stroke="#05070a" stroke-width="2.5"/><text x="${x+dw/2}" y="${sy+dh/2+1}" fill="${o.needle}" font-size="56" font-weight="800" text-anchor="middle" dominant-baseline="central">${str[i]}</text>`;}
  s+=`<text x="${w/2}" y="30" fill="${o.accent}" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}${U.sub?' · '+U.sub:''}</text></svg>`;return s;}
function gforce(o){const U=UNITS[o.unit],w=300,h=300,cx=150,cy=140,R=110,rmax=U.max,rmin=U.min||0,val=o.value,frac=Math.max(0,Math.min(1,(val-rmin)/(rmax-rmin))),dy=cy+R-frac*2*R;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><defs><filter id="gg" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="${w}" height="${h}" rx="20" fill="#0c0f13"/>`;
  [R,R*0.66,R*0.33].forEach(r=>s+=`<circle cx="${cx}" cy="${cy}" r="${f1(r)}" fill="none" stroke="#222a33" stroke-width="1.5"/>`);
  s+=`<line x1="${cx-R}" y1="${cy}" x2="${cx+R}" y2="${cy}" stroke="#222a33" stroke-width="1.5"/><line x1="${cx}" y1="${cy-R}" x2="${cx}" y2="${cy+R}" stroke="#222a33" stroke-width="1.5"/>`;
  s+=`<circle cx="${cx}" cy="${f1(dy)}" r="11" fill="${o.needle}" filter="url(#gg)"/><circle cx="${cx}" cy="${f1(dy)}" r="11" fill="${o.needle}"/>`;
  s+=`<text x="${cx}" y="${h-44}" fill="#fff" font-size="34" font-weight="800" text-anchor="middle">${val}</text><text x="${cx}" y="${h-20}" fill="${o.accent}" font-size="14" font-weight="700" text-anchor="middle" letter-spacing="3">${U.label}${U.sub?' '+U.sub:''}</text></svg>`;return s;}
function thermo(o){const U=UNITS[o.unit],w=132,h=360,cx=58,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,sTop=36,sBot=h-80,sH=sBot-sTop,bR=26,frac=Math.max(0,Math.min(1,(val-rmin)/(rmax-rmin))),fy=sBot-frac*sH,col=val>=redline?'#ff3b30':o.needle;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><rect width="${w}" height="${h}" rx="16" fill="#0c0f13"/>`;
  s+=`<rect x="${cx-9}" y="${sTop}" width="18" height="${sH+16}" rx="9" fill="#12171d" stroke="#2a323d"/><circle cx="${cx}" cy="${sBot+26}" r="${bR}" fill="#12171d" stroke="#2a323d"/><circle cx="${cx}" cy="${sBot+26}" r="${bR-6}" fill="${col}"/><rect x="${cx-5}" y="${f1(fy)}" width="10" height="${f1(sBot-fy+22)}" rx="5" fill="${col}"/>`;
  for(let v=rmin;v<=rmax+1e-6;v+=U.step){const y=sBot-((v-rmin)/(rmax-rmin))*sH;s+=`<line x1="${cx+12}" y1="${f1(y)}" x2="${cx+19}" y2="${f1(y)}" stroke="#5b6772" stroke-width="2"/><text x="${cx+23}" y="${f1(y+4)}" fill="#79818b" font-size="11" font-weight="600">${Math.round(v/U.div)}</text>`;}
  s+=`<text x="${w/2}" y="22" fill="${o.accent}" font-size="13" font-weight="700" text-anchor="middle" letter-spacing="2">${U.label}</text></svg>`;return s;}
function chevron(o){const U=UNITS[o.unit],w=170,h=360,n=11,rmax=U.max,rmin=U.min||0,redline=U.redline??(rmax+1),val=o.value,frac=Math.max(0,Math.min(1,(val-rmin)/(rmax-rmin))),cw=120,cx0=25,gap=7,ch=((h-110)-(n-1)*gap)/n;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani',sans-serif"><rect width="${w}" height="${h}" rx="16" fill="#0c0f13"/>`;
  for(let i=0;i<n;i++){const lvl=(i+0.5)/n,lit=lvl<=frac,rv=rmin+lvl*(rmax-rmin),col=rv>=redline?'#ff3b30':(rv>=redline*0.8?'#ffd23f':o.needle),y=(h-66)-i*(ch+gap)-ch,mx=cx0+cw/2;
    s+=`<path d="M ${cx0} ${f1(y+ch)} L ${f1(mx)} ${f1(y)} L ${f1(cx0+cw)} ${f1(y+ch)}" fill="none" stroke="${lit?col:'#222a33'}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;}
  s+=`<text x="${w/2}" y="28" fill="${o.accent}" font-size="14" font-weight="700" text-anchor="middle" letter-spacing="2">${U.label}</text><text x="${w/2}" y="${h-18}" fill="#fff" font-size="28" font-weight="800" text-anchor="middle">${val}</text></svg>`;return s;}
function shiftlights(o){const val=o.value,gear=o.gear||3,w=520,h=210,pad=24,n=12,gap=7;
  const SHIFT={1:6900,2:6800,3:6650,4:6500,5:6400,6:6300},sr=SHIFT[gear]||6600,frac=Math.max(0,Math.min(1.08,val/sr)),over=frac>=1;
  const segW=(w-2*pad-(n-1)*gap)/n,ledY=26,ledH=38;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani','Consolas',monospace"><defs><filter id="slg" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6"/></filter></defs>`;
  s+=`<rect width="${w}" height="${h}" rx="14" fill="#06080b"/><rect x="3" y="3" width="${w-6}" height="${h-6}" rx="12" fill="none" stroke="#161d26" stroke-width="2"/>`;
  for(let i=0;i<n;i++){const f=(i+0.5)/n,lit=over||f<=frac,col=over?'#ff2a1f':(f>0.84?'#ff2a1f':f>0.6?'#ffd23f':'#27e36a'),x=pad+i*(segW+gap);
    s+=`<rect x="${f1(x)}" y="${ledY}" width="${f1(segW)}" height="${ledH}" rx="3" fill="${lit?col:'#11161d'}"${lit?' filter="url(#slg)"':''}/>`;}
  s+=`<text x="${pad}" y="${h-58}" fill="${o.accent}" font-size="13" font-weight="700" letter-spacing="2">GEAR</text>`;
  s+=`<text x="${pad+30}" y="${h-22}" fill="${over?'#ff2a1f':'#1ae7ff'}" font-size="78" font-weight="800" text-anchor="middle">${gear}</text>`;
  s+=`<text x="${w/2+24}" y="${h-40}" fill="#fff" font-size="50" font-weight="800" text-anchor="middle">${Math.round(val)}</text>`;
  s+=`<text x="${w/2+24}" y="${h-18}" fill="${o.accent}" font-size="13" font-weight="700" text-anchor="middle" letter-spacing="3">RPM</text>`;
  s+=`<text x="${w-pad}" y="${h-44}" fill="#79818b" font-size="14" font-weight="700" text-anchor="end">SHIFT @ ${sr}</text>`;
  s+=`<text x="${w-pad}" y="${h-20}" fill="${over?'#ff2a1f':'#3a4450'}" font-size="15" font-weight="800" text-anchor="end" letter-spacing="2">${over?'▲ SHIFT ▲':'G'+gear+' PROGRAM'}</text>`;
  return s;}
const RENDER={round,arc,halfarc,ring,segarc,neon,bar,vbar,race,digit,trend,tube,donut,modern,linear,flip,gforce,thermo,chevron,shiftlights};
const STYLES=[['round','Round dial — needle'],['arc','Sweep arc — digital'],['halfarc','Half arc'],['ring','Minimal ring'],['donut','Donut ring'],['tube','Glossy tube'],['modern','Modern minimal'],['segarc','Segmented arc'],['chevron','Chevron stack'],['neon','Neon outline'],['bar','Horizontal bar'],['vbar','Vertical bar'],['linear','Linear scale'],['thermo','Thermometer'],['race','Race shift-bar'],['shiftlights','Shift lights · per-gear'],['digit','Numeric readout'],['flip','Flip digits'],['trend','Trend chart'],['gforce','G-meter']];

const PALETTES=[
 {name:'Amber',needle:'#ff7a00',accent:'#ffae00'},
 {name:'Honey',needle:'#ed7a06',accent:'#ffb84d'},
 {name:'Green',needle:'#39ff9a',accent:'#bfe9cf'},
 {name:'Lime',needle:'#b8ff00',accent:'#e3ff9a'},
 {name:'Cyan',needle:'#1ae7ff',accent:'#9fe7ff'},
 {name:'Ice',needle:'#7bdfff',accent:'#d6f4ff'},
 {name:'Blue',needle:'#3b82f6',accent:'#bcd3ff'},
 {name:'Violet',needle:'#8a5cff',accent:'#c9b4ff'},
 {name:'Magenta',needle:'#ff2bd6',accent:'#ff8be9'},
 {name:'Red',needle:'#ff3b30',accent:'#ffd0cc'},
 {name:'Gold',needle:'#e8b04b',accent:'#f0d79a'},
 {name:'White',needle:'#e8edf2',accent:'#cdd5de'},
 // --- racing liveries + premium schemes (research-sourced) ---
 {name:'Gulf Blue',needle:'#00adef',accent:'#ff8000'},
 {name:'Gulf Orange',needle:'#e87722',accent:'#33b5ff'},
 {name:'Martini',needle:'#2fb8ec',accent:'#d91016'},
 {name:'Teal',needle:'#00ced1',accent:'#7fffd4'},
 {name:'Synthwave',needle:'#ff2bd6',accent:'#00f0ff'},
 {name:'Patriot',needle:'#e23b4e',accent:'#2f6fed'},
 {name:'Steel',needle:'#9fb3c8',accent:'#d6e2ee'},
 {name:'Tactical',needle:'#39ff14',accent:'#c7ffb0'},
 {name:'Cyber',needle:'#ff4141',accent:'#ffcc00'},
 {name:'Copper',needle:'#ff9e40',accent:'#ffd9a0'},
 {name:'Mint',needle:'#2bffb5',accent:'#c9fff0'},
 {name:'Indigo',needle:'#5b6cff',accent:'#b9c2ff'}
];

window.HBG={RENDER,UNITS,PALETTES,STYLES,START,SWEEP,f1,polar,arcP,shade,lum,bezelDef,faceDef};
})();
