/* Honeybadger SYMBOLS — skeuomorphic, animated dash "parts" as ORIGINAL parametric SVG.
   Same idea as the gauges: code, not scraped images — so they scale crisp, recolor to any
   theme, and animate live (heater glow, purge vapor, valve flow, telltale pulse).
   window.HBSYM = { SYMBOLS, list } */
(function(){
const f1=n=>(+n).toFixed(1);
function hx(c){return[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));}
function shade(c,f){let[r,g,b]=hx(c);const cl=x=>Math.max(0,Math.min(255,Math.round(x)));if(f>=1){r+=(255-r)*(f-1);g+=(255-g)*(f-1);b+=(255-b)*(f-1);}else{r*=f;g*=f;b*=f;}return'#'+[r,g,b].map(x=>cl(x).toString(16).padStart(2,'0')).join('');}
const svg=(w,h,b)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="'Rajdhani','Segoe UI',sans-serif">${b}</svg>`;

// ── NITROUS BOTTLE — live level, heater glow, purge vapor, frost ──────────────
function bottle(o){o=o||{};
  const col=o.color||'#1f6bd6', lvl=Math.max(0,Math.min(100,o.level!=null?o.level:62)),
        psi=Math.max(0,Math.min(1200,o.pressure!=null?o.pressure:950)), st=o.state||'idle';
  const w=150,h=320,cx=75,bx=35,bw=80,top=74,bot=h-14,bH=bot-top,fillY=bot-(lvl/100)*bH;
  const lo=shade(col,0.5),hi=shade(col,1.65);
  let d=`<defs>
    <linearGradient id="bdy" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${lo}"/><stop offset="0.26" stop-color="${hi}"/><stop offset="0.5" stop-color="${col}"/><stop offset="0.8" stop-color="${lo}"/><stop offset="1" stop-color="${shade(col,0.35)}"/></linearGradient>
    <linearGradient id="liq" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${shade(col,0.35)}"/><stop offset="0.5" stop-color="${shade(col,0.85)}"/><stop offset="1" stop-color="${shade(col,0.3)}"/></linearGradient>
    <linearGradient id="chr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b9197"/><stop offset="0.32" stop-color="#f2f4f6"/><stop offset="0.56" stop-color="#7d848b"/><stop offset="1" stop-color="#cfd4d8"/></linearGradient>
    <radialGradient id="heat" cx="50%" cy="62%" r="62%"><stop offset="0" stop-color="#ff7a00" stop-opacity="0.6"/><stop offset="1" stop-color="#ff7a00" stop-opacity="0"/></radialGradient>
    <clipPath id="bc"><rect x="${bx}" y="${top}" width="${bw}" height="${bH}" rx="16"/></clipPath></defs>`;
  let b='';
  if(st==='heating')b+=`<ellipse cx="${cx}" cy="${top+bH*0.62}" rx="80" ry="125" fill="url(#heat)"><animate attributeName="opacity" values="0.45;1;0.45" dur="1.7s" repeatCount="indefinite"/></ellipse>`;
  // body + liquid
  b+=`<rect x="${bx}" y="${top}" width="${bw}" height="${bH}" rx="16" fill="url(#bdy)" stroke="${shade(col,0.3)}" stroke-width="1.5"/>`;
  b+=`<rect x="${bx}" y="${f1(fillY)}" width="${bw}" height="${f1(bot-fillY)}" fill="url(#liq)" clip-path="url(#bc)"/>`;
  b+=`<rect x="${bx}" y="${f1(fillY)}" width="${bw}" height="3" fill="#fff" opacity="0.55" clip-path="url(#bc)"/>`;
  b+=`<rect x="${bx+11}" y="${top}" width="11" height="${bH}" rx="5" fill="#fff" opacity="0.2" clip-path="url(#bc)"/>`;
  if(st==='cold')b+=`<rect x="${bx}" y="${top+bH*0.5}" width="${bw}" height="${bH*0.5}" fill="#dff1ff" opacity="0.34" clip-path="url(#bc)"/>`;
  // label band
  b+=`<rect x="${bx-2}" y="${f1(top+bH*0.30)}" width="${bw+4}" height="58" fill="#0c0f13" opacity="0.92"/>`;
  b+=`<text x="${cx}" y="${f1(top+bH*0.30+25)}" fill="#fff" font-size="23" font-weight="800" text-anchor="middle" letter-spacing="1">${o.label||'N₂O'}</text>`;
  b+=`<text x="${cx}" y="${f1(top+bH*0.30+45)}" fill="${hi}" font-size="10" font-weight="700" text-anchor="middle" letter-spacing="3">HONEYBADGER</text>`;
  b+=`<text x="${cx}" y="${bot-9}" fill="#fff" font-size="13" font-weight="800" text-anchor="middle">${Math.round(lvl)}%</text>`;
  // neck + valve + handle
  b+=`<rect x="${cx-15}" y="56" width="30" height="24" rx="4" fill="url(#chr)"/>`;
  b+=`<rect x="${cx-22}" y="32" width="44" height="28" rx="7" fill="url(#chr)" stroke="#6b7176"/>`;
  b+=`<circle cx="${cx}" cy="22" r="14" fill="url(#chr)" stroke="#6b7176" stroke-width="1.5"/><circle cx="${cx}" cy="22" r="5" fill="#5a6066"/>`;
  b+=`<rect x="${cx+20}" y="38" width="18" height="13" rx="2" fill="url(#chr)"/>`;
  // pressure mini-gauge
  const pa=-120+(psi/1200)*240, prad=pa*Math.PI/180;
  b+=`<circle cx="${cx+48}" cy="44" r="15" fill="#0c0f13" stroke="url(#chr)" stroke-width="2.5"/>`;
  b+=`<line x1="${cx+48}" y1="44" x2="${f1(cx+48+11*Math.sin(prad))}" y2="${f1(44-11*Math.cos(prad))}" stroke="${psi>1100?'#ff3b30':'#39ff9a'}" stroke-width="2"/><circle cx="${cx+48}" cy="44" r="2.5" fill="#cfd4d8"/>`;
  // purge vapor
  if(st==='purging')for(let i=0;i<3;i++){const bg=(i*0.27).toFixed(2);b+=`<circle cx="${cx+44}" cy="44" r="3" fill="#eaf6ff"><animate attributeName="cx" values="${cx+44};${cx+92}" dur="0.8s" begin="${bg}s" repeatCount="indefinite"/><animate attributeName="cy" values="44;${30-i*4}" dur="0.8s" begin="${bg}s" repeatCount="indefinite"/><animate attributeName="r" values="3;15" dur="0.8s" begin="${bg}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.95;0" dur="0.8s" begin="${bg}s" repeatCount="indefinite"/></circle>`;}
  return svg(w,h,d+b);
}

// ── PURGE SOLENOID / VALVE — open(flow+glow) / closed ─────────────────────────
function purge(o){o=o||{};const open=o.state==='open',col=o.color||'#39ff9a',w=170,h=120,cy=60;
  let d=`<defs><linearGradient id="mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd4d8"/><stop offset="0.5" stop-color="#7d848b"/><stop offset="1" stop-color="#3c4248"/></linearGradient><filter id="fg" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.5"/></filter></defs>`;
  let b=`<rect width="${w}" height="${h}" rx="12" fill="#0c0f13"/>`;
  // inlet/outlet pipes
  b+=`<rect x="6" y="${cy-9}" width="40" height="18" rx="3" fill="url(#mt)"/><rect x="${w-46}" y="${cy-9}" width="40" height="18" rx="3" fill="url(#mt)"/>`;
  // flow particles when open
  if(open)for(let i=0;i<4;i++){const bg=(i*0.18).toFixed(2);b+=`<circle cy="${cy}" r="4" fill="${col}" filter="url(#fg)"><animate attributeName="cx" values="50;${w-50}" dur="0.7s" begin="${bg}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="0.7s" begin="${bg}s" repeatCount="indefinite"/></circle>`;}
  // solenoid coil
  b+=`<rect x="58" y="20" width="54" height="80" rx="8" fill="url(#mt)" stroke="#2a2f34"/>`;
  for(let i=0;i<6;i++)b+=`<rect x="60" y="${24+i*12}" width="50" height="6" rx="3" fill="#2a2f34" opacity="0.55"/>`;
  // valve body center
  b+=`<circle cx="${w/2}" cy="${cy}" r="20" fill="#1a1f25" stroke="url(#mt)" stroke-width="3"/>`;
  b+=`<circle cx="${w/2}" cy="${cy}" r="11" fill="${open?col:'#2a313a'}" ${open?'filter="url(#fg)"':''}>${open?'<animate attributeName="opacity" values="0.7;1;0.7" dur="1.1s" repeatCount="indefinite"/>':''}</circle>`;
  // top terminal
  b+=`<rect x="${w/2-7}" y="8" width="14" height="16" rx="2" fill="url(#mt)"/>`;
  b+=`<text x="${w/2}" y="${h-8}" fill="${open?col:'#5b6772'}" font-size="13" font-weight="800" text-anchor="middle" letter-spacing="2">${open?'OPEN':'CLOSED'}</text>`;
  return svg(w,h,d+b);
}

// ── ARM SWITCH — guarded missile toggle, armed(glow)/safe ─────────────────────
function armswitch(o){o=o||{};const armed=o.state!=='safe',w=120,h=150;
  let d=`<defs><linearGradient id="pl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4047"/><stop offset="1" stop-color="#14181c"/></linearGradient><radialGradient id="gl" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#ff2a1f" stop-opacity="0.7"/><stop offset="1" stop-color="#ff2a1f" stop-opacity="0"/></radialGradient></defs>`;
  let b=`<rect width="${w}" height="${h}" rx="12" fill="#0c0f13"/>`;
  // plate
  b+=`<rect x="22" y="24" width="76" height="100" rx="10" fill="url(#pl)" stroke="#0a0c0e"/>`;
  [[30,32],[90,32],[30,116],[90,116]].forEach(p=>b+=`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#5a6066"/>`);
  if(armed)b+=`<ellipse cx="60" cy="62" rx="46" ry="40" fill="url(#gl)"><animate attributeName="opacity" values="0.55;1;0.55" dur="1.3s" repeatCount="indefinite"/></ellipse>`;
  // guard cover (up=armed, down=safe over switch)
  if(armed){b+=`<path d="M44 60 L76 60 L72 30 L48 30 Z" fill="#b81e16" stroke="#7a120c" stroke-width="2" opacity="0.92"/>`;
    b+=`<rect x="52" y="58" width="16" height="34" rx="4" fill="#e8edf2"/><rect x="52" y="58" width="16" height="10" rx="4" fill="#ff3b30"/>`; // toggle up
  }else{b+=`<path d="M44 92 L76 92 L72 60 L48 60 Z" fill="#1d232a" stroke="#0a0c0e" stroke-width="2"/>`;
    b+=`<rect x="52" y="66" width="16" height="26" rx="4" fill="#9aa0a6"/>`; // toggle covered/down
  }
  b+=`<text x="60" y="140" fill="${armed?'#ff3b30':'#5b6772'}" font-size="14" font-weight="800" text-anchor="middle" letter-spacing="3">${armed?'ARMED':'SAFE'}</text>`;
  return svg(w,h,d+b);
}

// ── CONTROLLER BOX — "physical" unit, live display + status LEDs ──────────────
function controller(o){o=o||{};const on=o.state!=='off',col=o.color||'#39ff9a',disp=o.display||(on?'ARMED':'SAFE'),w=240,h=150;
  let d=`<defs><linearGradient id="cb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3037"/><stop offset="1" stop-color="#0e1216"/></linearGradient><linearGradient id="bt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4047"/><stop offset="1" stop-color="#1a1f25"/></linearGradient></defs>`;
  let b=`<rect width="${w}" height="${h}" rx="14" fill="url(#cb)" stroke="#05070a" stroke-width="2"/>`;
  [[14,14],[226,14],[14,136],[226,136]].forEach(p=>b+=`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#5a6066"/><circle cx="${p[0]}" cy="${p[1]}" r="1.6" fill="#1a1f25"/>`);
  b+=`<text x="20" y="30" fill="${col}" font-size="13" font-weight="800" letter-spacing="2">HONEYBADGER · N₂O</text>`;
  // display
  b+=`<rect x="20" y="40" width="150" height="60" rx="6" fill="#05140c" stroke="#0a0c0e" stroke-width="2"/>`;
  b+=`<text x="95" y="82" fill="${on?col:'#1f3a2c'}" font-family="'Consolas',monospace" font-size="34" font-weight="800" text-anchor="middle">${disp}</text>`;
  if(on)b+=`<rect x="20" y="40" width="150" height="60" rx="6" fill="${col}" opacity="0.05"><animate attributeName="opacity" values="0.03;0.1;0.03" dur="2s" repeatCount="indefinite"/></rect>`;
  // status LEDs
  const leds=[['PWR','#39ff9a',on],['ARM',on?'#ff3b30':'#3a2326',on],['PRG','#ffd23f',o.state==='purging']];
  leds.forEach((L,i)=>{const ly=46+i*18;b+=`<circle cx="190" cy="${ly}" r="6" fill="${L[2]?L[1]:shade(L[1],0.3)}">${L[2]?`<animate attributeName="opacity" values="0.6;1;0.6" dur="1.1s" repeatCount="indefinite"/>`:''}</circle><text x="202" y="${ly+4}" fill="#9aa0a6" font-size="10" font-weight="700">${L[0]}</text>`;});
  // buttons
  ['ARM','PURGE','SET'].forEach((t,i)=>{const bx=20+i*72;b+=`<rect x="${bx}" y="112" width="62" height="26" rx="5" fill="url(#bt)" stroke="#05070a"/><text x="${bx+31}" y="129" fill="#cfd4d8" font-size="11" font-weight="800" text-anchor="middle">${t}</text>`;});
  return svg(w,h,d+b);
}

// ── INDICATOR / TELLTALE — round LED + glyph, glow when ON ────────────────────
const TELL={armed:['◉','#ff3b30'],purge:['❄','#39c5ff'],wot:['WOT','#ffd23f'],shift:['▲','#7a5cff'],
  oil:['OIL','#ff7a00'],temp:['TEMP','#ff3b30'],fuel:['⛽','#ffd23f'],batt:['BATT','#ff3b30'],
  check:['CHK','#ffae00'],knock:['KNK','#ff3b30'],boost:['BST','#39ff9a'],ready:['RDY','#39ff9a']};
function indicator(o){o=o||{};const k=o.icon||'armed',on=o.state!=='off',t=TELL[k]||TELL.armed,col=o.color||t[1],w=110,h=110,cx=55,cy=50;
  let d=`<defs><radialGradient id="ig" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="${col}" stop-opacity="0.85"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient><radialGradient id="lens" cx="42%" cy="34%" r="70%"><stop offset="0" stop-color="${shade(col,1.6)}"/><stop offset="0.6" stop-color="${col}"/><stop offset="1" stop-color="${shade(col,0.45)}"/></radialGradient></defs>`;
  let b=`<rect width="${w}" height="${h}" rx="12" fill="#0c0f13"/>`;
  if(on)b+=`<circle cx="${cx}" cy="${cy}" r="42" fill="url(#ig)"><animate attributeName="opacity" values="0.6;1;0.6" dur="1.2s" repeatCount="indefinite"/></circle>`;
  b+=`<circle cx="${cx}" cy="${cy}" r="30" fill="#14181c" stroke="#2a313a" stroke-width="2"/>`;
  b+=`<circle cx="${cx}" cy="${cy}" r="26" fill="${on?'url(#lens)':shade(col,0.28)}"/>`;
  if(on)b+=`<circle cx="${cx-8}" cy="${cy-9}" r="7" fill="#fff" opacity="0.4"/>`;
  const big=t[0].length<=2;
  b+=`<text x="${cx}" y="${cy+(big?7:5)}" fill="${on?'#0a0c0d':shade(col,0.5)}" font-size="${big?26:15}" font-weight="800" text-anchor="middle" dominant-baseline="middle">${t[0]}</text>`;
  b+=`<text x="${cx}" y="${h-10}" fill="${on?col:'#5b6772'}" font-size="11" font-weight="800" text-anchor="middle" letter-spacing="2">${(o.label||k).toUpperCase()}</text>`;
  return svg(w,h,d+b);
}

// ── NITROUS PANEL — the whole system as ONE linked unit: bottle → purge →
//    run → intake, joined by animated plumbing flow. Mirrors the Pi nitrous
//    screen. Drop it as a single widget; move/size it as one. ───────────────
function nitrouspanel(o){o=o||{};
  const st=o.state||'armed', col=o.color||'#ff5b00',
        armed=st!=='off'&&st!=='safe', flow=armed||st==='purging'||st==='firing',
        w=560,h=300, ok='#39ff80', hi=shade('#1f6bd6',1.5), lvl=o.level!=null?o.level:64;
  const valve=(x,y,label,active)=>{
    let s=`<circle cx="${x}" cy="${y}" r="16" fill="#161b21" stroke="url(#np_chr)" stroke-width="2.5"/>`;
    s+=`<circle cx="${x}" cy="${y}" r="8" fill="${active?col:'#2a313a'}"${active?' filter="url(#np_g)"':''}>${active?'<animate attributeName="opacity" values="0.6;1;0.6" dur="1s" repeatCount="indefinite"/>':''}</circle>`;
    s+=`<rect x="${x-6}" y="${y-32}" width="12" height="15" rx="2" fill="url(#np_chr)"/>`;
    s+=`<text x="${x}" y="${y+33}" fill="${active?col:'#5b6772'}" font-size="10" font-weight="800" text-anchor="middle">${label}</text>`;
    return s;
  };
  let d=`<defs>
    <linearGradient id="np_bdy" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${shade('#1f6bd6',0.55)}"/><stop offset="0.5" stop-color="#2f86e6"/><stop offset="1" stop-color="${shade('#1f6bd6',0.4)}"/></linearGradient>
    <radialGradient id="np_heat" cx="50%" cy="60%" r="60%"><stop offset="0" stop-color="#ff7a00" stop-opacity="0.5"/><stop offset="1" stop-color="#ff7a00" stop-opacity="0"/></radialGradient>
    <linearGradient id="np_chr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd4d8"/><stop offset="0.5" stop-color="#7d848b"/><stop offset="1" stop-color="#3c4248"/></linearGradient>
    <filter id="np_g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3"/></filter></defs>`;
  let b=`<rect x="2" y="2" width="${w-4}" height="${h-4}" rx="16" fill="#0b0e12" stroke="${col}" stroke-width="2"/>`;
  b+=`<text x="20" y="30" fill="${col}" font-size="15" font-weight="800" letter-spacing="2">HONEYBADGER · N₂O SYSTEM</text>`;
  b+=`<text x="${w-20}" y="30" fill="${armed?'#ff3b30':'#5b6772'}" font-size="13" font-weight="800" text-anchor="end" letter-spacing="2">${armed?'● ARMED':'○ SAFE'}</text>`;
  // bottle
  const bx=28,by=58,bw=78,bh=150,fy=by+bh-(lvl/100)*bh;
  if(st==='heating'||st==='firing')b+=`<ellipse cx="${bx+bw/2}" cy="${by+bh*0.6}" rx="70" ry="100" fill="url(#np_heat)"><animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite"/></ellipse>`;
  b+=`<clipPath id="np_bc"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="14"/></clipPath>`;
  b+=`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="14" fill="url(#np_bdy)" stroke="#13315a"/>`;
  b+=`<rect x="${bx}" y="${f1(fy)}" width="${bw}" height="${f1(by+bh-fy)}" fill="${shade('#1f6bd6',0.85)}" clip-path="url(#np_bc)"/>`;
  b+=`<rect x="${bx}" y="${f1(fy)}" width="${bw}" height="3" fill="#fff" opacity="0.5" clip-path="url(#np_bc)"/>`;
  b+=`<rect x="${bx-2}" y="${f1(by+bh*0.32)}" width="${bw+4}" height="42" fill="#0b0e12" opacity="0.9"/>`;
  b+=`<text x="${bx+bw/2}" y="${f1(by+bh*0.32+21)}" fill="#fff" font-size="20" font-weight="800" text-anchor="middle">N₂O</text>`;
  b+=`<text x="${bx+bw/2}" y="${f1(by+bh*0.32+35)}" fill="${hi}" font-size="8" font-weight="700" text-anchor="middle" letter-spacing="2">HONEYBADGER</text>`;
  b+=`<text x="${bx+bw/2}" y="${by+bh-9}" fill="#fff" font-size="12" font-weight="800" text-anchor="middle">${Math.round(lvl)}%</text>`;
  b+=`<rect x="${bx+bw/2-12}" y="${by-18}" width="24" height="20" rx="4" fill="url(#np_chr)"/><circle cx="${bx+bw/2}" cy="${by-24}" r="11" fill="url(#np_chr)" stroke="#6b7176"/>`;
  // plumbing  bottle -> purge -> run -> intake
  const ly=by+52,x1=bx+bw,xP=210,xR=330,xI=440;
  const pipe=(a,z)=>`<line x1="${a}" y1="${ly}" x2="${z}" y2="${ly}" stroke="#2a323d" stroke-width="8" stroke-linecap="round"/>`;
  b+=pipe(x1,xP)+pipe(xP,xR)+pipe(xR,xI);
  if(flow)for(let i=0;i<4;i++){const bg=(i*0.22).toFixed(2);b+=`<circle cy="${ly}" r="4" fill="${col}" filter="url(#np_g)"><animate attributeName="cx" values="${x1};${xI}" dur="0.9s" begin="${bg}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="0.9s" begin="${bg}s" repeatCount="indefinite"/></circle>`;}
  b+=valve(xP,ly,'PURGE',st==='purging'||armed)+valve(xR,ly,'RUN',st==='firing');
  b+=`<rect x="${xI}" y="${ly-26}" width="92" height="52" rx="8" fill="#161b21" stroke="#2a323d"/><text x="${xI+46}" y="${ly-4}" fill="#9aa3ad" font-size="11" font-weight="800" text-anchor="middle">INTAKE</text><text x="${xI+46}" y="${ly+15}" fill="${flow?ok:'#3a4450'}" font-size="10" font-weight="700" text-anchor="middle">${flow?'FLOW':'—'}</text>`;
  // controller display
  b+=`<rect x="210" y="150" width="170" height="50" rx="7" fill="#05140c" stroke="#0a0c0e"/><text x="295" y="183" fill="${armed?ok:'#1f3a2c'}" font-family="'Consolas',monospace" font-size="26" font-weight="800" text-anchor="middle">${o.display||(armed?'ARMED':'SAFE')}</text>`;
  // telltale row
  [['ARM',armed,'#ff3b30'],['PRG',st==='purging','#39c5ff'],['WOT',st==='firing','#ffd23f'],['RDY',armed&&st!=='firing',ok]].forEach((t,i)=>{const tx=410+i*38,ty=162;b+=`<circle cx="${tx}" cy="${ty}" r="9" fill="${t[1]?t[2]:shade(t[2],0.28)}">${t[1]?'<animate attributeName="opacity" values="0.6;1;0.6" dur="1.1s" repeatCount="indefinite"/>':''}</circle><text x="${tx}" y="${ty+24}" fill="#9aa3ad" font-size="8" font-weight="700" text-anchor="middle">${t[0]}</text>`;});
  return svg(w,h,d+b);
}

// ── NITROUS CONTROLLER — the control HMI with editable SET POINTS: RPM window,
//    TPS/WOT min, coolant min, purge program, bottle-heater target/cutoff +
//    interlock status. Mirrors the Pi DashNitrous screen. ────────────────────
function nitrouscontroller(o){o=o||{};
  const st=o.state||'armed', col=o.color||'#ff5b00', armed=st!=='off'&&st!=='safe',
        ok='#39ff80', w=600, h=380;
  const sp=Object.assign({rpmLo:3000,rpmHi:6500,tps:92,coolant:160,htrMode:'AUTO',htrTgt:75,htrCut:90,purgeN:3,purgeDur:1.0,purgeInt:2.0,bottle:78,pressure:950,level:64},o.sp||{});
  const field=(x,y,label,val,unit)=>{const wd=118;
    let r=`<rect x="${x}" y="${y}" width="${wd}" height="48" rx="6" fill="#0e141b" stroke="#1d2733"/>`;
    r+=`<text x="${x+10}" y="${y+16}" fill="#79818b" font-size="9" font-weight="700" letter-spacing="1">${label}</text>`;
    r+=`<text x="${x+10}" y="${y+39}" fill="#fff" font-size="18" font-weight="800">${val}<tspan font-size="10" fill="#79818b"> ${unit||''}</tspan></text>`;
    r+=`<rect x="${x+wd-42}" y="${y+8}" width="16" height="15" rx="3" fill="#1a2230"/><text x="${x+wd-34}" y="${y+20}" fill="${col}" font-size="13" font-weight="800" text-anchor="middle">−</text>`;
    r+=`<rect x="${x+wd-22}" y="${y+8}" width="16" height="15" rx="3" fill="#1a2230"/><text x="${x+wd-14}" y="${y+20}" fill="${col}" font-size="13" font-weight="800" text-anchor="middle">+</text>`;
    return r;};
  const sect=(x,y,t)=>`<text x="${x}" y="${y}" fill="${col}" font-size="11" font-weight="800" letter-spacing="2">${t}</text>`;
  let b=`<rect x="2" y="2" width="${w-4}" height="${h-4}" rx="16" fill="#0b0e12" stroke="${col}" stroke-width="2"/>`;
  b+=`<text x="20" y="30" fill="${col}" font-size="15" font-weight="800" letter-spacing="2">HONEYBADGER · N₂O CONTROLLER</text>`;
  b+=`<text x="${w-20}" y="30" fill="${armed?'#ff3b30':'#5b6772'}" font-size="13" font-weight="800" text-anchor="end" letter-spacing="2">${armed?'● ARMED':'○ SAFE'}</text>`;
  b+=`<rect x="18" y="46" width="160" height="60" rx="8" fill="${armed?'#3a0d0a':'#12171d'}" stroke="${armed?'#ff3b30':'#2a323d'}" stroke-width="2"/>`;
  if(armed)b+=`<rect x="18" y="46" width="160" height="60" rx="8" fill="#ff3b30" opacity="0.08"><animate attributeName="opacity" values="0.04;0.14;0.04" dur="1.4s" repeatCount="indefinite"/></rect>`;
  b+=`<text x="98" y="84" fill="${armed?'#ff3b30':'#cfd4d8'}" font-size="26" font-weight="800" text-anchor="middle" letter-spacing="2">${armed?'ARMED':'ARM'}</text>`;
  const bx=40,by=128,bw=52,bh=118,fy=by+bh-(sp.level/100)*bh;
  b+=`<clipPath id="nc_bc"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="10"/></clipPath>`;
  b+=`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="10" fill="${shade('#1f6bd6',0.7)}" stroke="#13315a"/>`;
  b+=`<rect x="${bx}" y="${f1(fy)}" width="${bw}" height="${f1(by+bh-fy)}" fill="${shade('#1f6bd6',0.9)}" clip-path="url(#nc_bc)"/>`;
  b+=`<text x="${bx+bw/2}" y="${by+bh/2+5}" fill="#fff" font-size="15" font-weight="800" text-anchor="middle">N₂O</text>`;
  b+=`<rect x="${bx+bw/2-8}" y="${by-12}" width="16" height="14" rx="3" fill="#9aa0a6"/>`;
  b+=`<text x="${bx+bw+14}" y="${by+16}" fill="#79818b" font-size="9" font-weight="700">LEVEL</text><text x="${bx+bw+14}" y="${by+35}" fill="#fff" font-size="16" font-weight="800">${Math.round(sp.level)}<tspan font-size="9" fill="#79818b"> %</tspan></text>`;
  b+=`<text x="${bx+bw+14}" y="${by+62}" fill="#79818b" font-size="9" font-weight="700">BOTTLE</text><text x="${bx+bw+14}" y="${by+81}" fill="${ok}" font-size="16" font-weight="800">${Math.round(sp.bottle)}<tspan font-size="9" fill="#79818b"> °F</tspan></text>`;
  b+=`<text x="${bx+bw+14}" y="${by+108}" fill="#79818b" font-size="9" font-weight="700">PRESSURE</text><text x="${bx+bw+14}" y="${by+127}" fill="${sp.pressure>1100?'#ff3b30':'#fff'}" font-size="16" font-weight="800">${Math.round(sp.pressure)}<tspan font-size="9" fill="#79818b"> psi</tspan></text>`;
  b+=sect(196,44,'INTERLOCKS · SET POINTS');
  b+=field(196,52,'RPM WIN',sp.rpmLo+'–'+sp.rpmHi,'')+field(328,52,'WOT MIN',sp.tps,'%')+field(460,52,'COOLANT',sp.coolant,'°F');
  b+=sect(196,124,'PURGE PROGRAM');
  b+=field(196,132,'COUNT',sp.purgeN,'×')+field(328,132,'EACH',sp.purgeDur.toFixed(1),'s')+field(460,132,'INTERVAL',sp.purgeInt.toFixed(1),'s');
  b+=sect(196,204,'BOTTLE HEATER');
  b+=field(196,212,'MODE',sp.htrMode,'')+field(328,212,'TARGET',sp.htrTgt,'°F')+field(460,212,'CUTOFF',sp.htrCut,'°F');
  b+=sect(196,290,'INTERLOCK STATUS');
  [['ARM',armed],['RPM',true],['TPS',true],['TEMP',sp.bottle<sp.htrCut],['COOLANT',true],['GEAR',true]].forEach((g,i)=>{const gx=210+i*64,gy=310;b+=`<circle cx="${gx}" cy="${gy}" r="8" fill="${g[1]?ok:'#3a2326'}"/>${g[1]?`<circle cx="${gx}" cy="${gy}" r="8" fill="${ok}" opacity="0.3"><animate attributeName="r" values="8;13;8" dur="1.9s" repeatCount="indefinite"/></circle>`:''}<text x="${gx}" y="${gy+26}" fill="#9aa3ad" font-size="9" font-weight="700" text-anchor="middle">${g[0]}</text>`;});
  return svg(w,h,b);
}

const SYMBOLS={bottle,purge,armswitch,controller,indicator,nitrouspanel,nitrouscontroller};
window.HBSYM={SYMBOLS,
  list:[
    {sym:'nitrouspanel',name:'Nitrous panel (linked)',opts:{state:'armed',level:64}},
    {sym:'nitrouscontroller',name:'Nitrous controller · set points',opts:{state:'armed'}},
    {sym:'bottle',name:'N₂O bottle',opts:{state:'idle',level:62}},
    {sym:'purge',name:'Purge solenoid',opts:{state:'closed'}},
    {sym:'armswitch',name:'Arm switch',opts:{state:'armed'}},
    {sym:'controller',name:'Controller unit',opts:{state:'on'}},
    {sym:'indicator',name:'Telltale',opts:{icon:'armed',state:'on'}}
  ]};
})();
