import {START,END,FADE_START,FADE,SILENCE,BACKGROUND,INTRO,clamp,ease,sequence} from './sequence.mjs';

export function initializeExperience(){
 const $=s=>document.querySelector(s),audio=$('#soundtrack'),hero=$('.hero'),stage=$('#stage'),character=$('#character'),gate=$('#gate'),prelude=$('#prelude'),status=$('#sequence-status'),note=$('#load-note');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const capsules=[...document.querySelectorAll('.capsule')];
 const terms=[
  ['Computational mechanics','MODELLING',25,26,.6],['Materials science','STRUCTURE',72,35,1.9],
  ['Signal processing','MEASUREMENT',29,68,3.2],['Additive manufacturing','PROCESS',74,65,4.6],
  ['Experimental dynamics','RESPONSE',30,31,6.0],['Constitutive modelling','BEHAVIOUR',73,28,7.4],
  ['Inverse identification','INFERENCE',24,65,8.8],['Structural integrity','RELIABILITY',73,69,10.2],
  ['Multiphysics','COUPLING',25,28,11.4],['Process monitoring','OBSERVATION',74,36,12.6],
  ['Numerical methods','COMPUTATION',29,69,13.5]
 ];
 const words=terms.map(([text,label,x,y])=>{const el=document.createElement('div');el.className='academic-word';el.innerHTML=`<small>${label}</small>${text}`;el.style.left=x+'%';el.style.top=y+'%';$('#academic-field').append(el);return el});
 let mode='idle',context,gain,muted=false,userVolume=INTRO,volumeOverride=false,completed=false,backgroundStart=0,hiddenPaused=false,runId=0,doorAnimations=[],locked=true,lastStatus='';
 function lockScene(lock){
  locked=lock;document.documentElement.classList.toggle('intro-locked',lock);
  document.querySelector('header').inert=lock;document.querySelector('footer').inert=lock;
  for(const el of document.querySelector('main').children)if(el!==hero)el.inert=lock;
  $('.scroll-cue').tabIndex=lock?-1:0;
  $('.hero-footer').inert=lock||hero.classList.contains('soundtrack-running');
  if(lock)window.scrollTo({top:0,left:0,behavior:'instant'});
 }
 lockScene(true);
 function preventScroll(e){if(locked&&!e.target.closest('input[type="range"]'))e.preventDefault()}
 window.addEventListener('wheel',preventScroll,{passive:false});window.addEventListener('touchmove',preventScroll,{passive:false});
 document.addEventListener('keydown',e=>{
  if(!locked)return;
  if(e.key==='Escape'){e.preventDefault();finishStatic();return}
  if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key)&&!e.target.closest('button,input,a'))e.preventDefault();
 });
 // Fragment links and browser scroll restoration cannot move the locked scene.
 window.addEventListener('scroll',()=>{if(locked&&window.scrollY)window.scrollTo(0,0)},{passive:true});
 window.addEventListener('hashchange',()=>{if(locked)window.scrollTo(0,0)});
 Promise.all([...document.querySelectorAll('.door-image,.character img')].map(img=>img.decode())).catch(()=>{note.textContent='Image unavailable. Press Escape to explore the profile.'});
 if(reduced)note.textContent='Reduced motion enabled · sound on';
 function initAudio(){
  if(!context){const Ctx=window.AudioContext||window.webkitAudioContext;if(Ctx){context=new Ctx();gain=context.createGain();context.createMediaElementSource(audio).connect(gain).connect(context.destination)}}
  return context?.resume();
 }
 function setGain(v){if(gain){gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setValueAtTime(muted?0:v,context.currentTime)}else audio.volume=muted?0:v}
 function scheduleEnvelope(){
  if(!gain)return;
  const t=audio.currentTime,n=context.currentTime,target=volumeOverride?userVolume:sequence(t).volume;
  gain.gain.cancelScheduledValues(n);gain.gain.setValueAtTime(muted?0:target,n);
  if(muted||volumeOverride||mode==='static')return;
  if(t<FADE_START){gain.gain.setValueAtTime(INTRO,n+FADE_START-t);gain.gain.linearRampToValueAtTime(BACKGROUND,n+FADE_START+FADE-t)}
  else if(t<FADE_START+FADE)gain.gain.linearRampToValueAtTime(BACKGROUND,n+FADE_START+FADE-t);
 }
 function controls(show){for(const s of['#pause','#skip','#sound','#volume-label'])$(s).hidden=!show;$('#replay').hidden=true}
 function cancelDoor(){for(const animation of doorAnimations)animation.cancel();doorAnimations=[]}
 function traverseDoor(){
  const duration=reduced?500:6000;
  const animate=(selector,frames,easing='linear')=>$(selector).animate(frames,{duration,easing,fill:'forwards'});
  doorAnimations=reduced?[animate('.door-veil',[{opacity:0},{opacity:1}])]:[
   animate('.door-left',[{transform:'rotateY(0deg)',offset:0},{transform:'rotateY(-6deg)',offset:.15},{transform:'rotateY(-85deg)',offset:.66},{transform:'rotateY(-105deg)',offset:1}]),
   animate('.door-right',[{transform:'rotateY(0deg)',offset:0},{transform:'rotateY(6deg)',offset:.15},{transform:'rotateY(85deg)',offset:.66},{transform:'rotateY(105deg)',offset:1}]),
   animate('.door-world',[{transform:'translate(-50%,-50%) scale(1)'},{transform:'translate(-50%,-50%) scale(4)'}],'cubic-bezier(.55,0,.3,1)'),
   animate('.door-veil',[{opacity:0,offset:0},{opacity:0,offset:.73},{opacity:1,offset:1}])
  ];
  if(document.hidden)doorAnimations.forEach(a=>a.pause());
  return Promise.all(doorAnimations.map(a=>a.finished));
 }
 async function start(){
  if(['loading','door'].includes(mode))return;
  const id=++runId;cancelDoor();mode='loading';completed=false;lockScene(true);
  audio.pause();controls(false);hero.classList.add('soundtrack-running');$('.hero-footer').inert=true;gate.hidden=false;gate.inert=false;gate.classList.remove('opening');
  hero.classList.remove('settled','awakened');stage.style.opacity=0;stage.setAttribute('aria-hidden','true');character.style.opacity=0;$('.face').style.opacity=0;prelude.style.opacity=0;
  $('#fracture').style.opacity=0;$('#enter').disabled=true;note.textContent='Preparing the entrance…';$('#door-progress').textContent='';
  try{
   // Prime this same media element silently inside the Enter gesture. Its clock is
   // reset afterwards; the audible soundtrack starts only after the door finishes.
   await initAudio();audio.muted=true;setGain(0);audio.currentTime=0;await audio.play();audio.pause();audio.currentTime=0;audio.muted=false;
   await Promise.all([...document.querySelectorAll('.door-image,.character img')].map(img=>img.decode()));
   if(id!==runId)return;
   mode='door';gate.classList.add('opening');$('#door-progress').textContent='ENTERING';
   await traverseDoor();if(id!==runId)return;
   volumeOverride=false;userVolume=INTRO;muted=false;hiddenPaused=false;audio.currentTime=0;audio.volume=1;setGain(INTRO);
   await audio.play();if(id!==runId){audio.pause();return}
   mode='playing';gate.hidden=true;gate.inert=true;prelude.style.opacity=1;controls(false);
   $('#pause').textContent='Pause';$('#sound').setAttribute('aria-pressed','false');$('#sound').innerHTML='Sound on <span class="equalizer">▂▅▃▆</span>';$('#volume').value=90;
   scheduleEnvelope();hero.tabIndex=-1;hero.focus({preventScroll:true});
  }catch(e){
   if(id!==runId)return;
   cancelDoor();audio.pause();audio.muted=false;mode='idle';gate.hidden=false;gate.inert=false;gate.classList.remove('opening');
   $('#door-progress').textContent='';note.textContent='Playback could not start. Tap the door to retry, or press Escape to explore.';
  }finally{if(id===runId)$('#enter').disabled=false}
 }
 function finishStatic(){
  ++runId;cancelDoor();audio.pause();audio.muted=false;mode='static';completed=true;hero.classList.remove('soundtrack-running');lockScene(false);
  gate.hidden=true;gate.inert=true;prelude.style.opacity=0;hero.classList.add('settled','awakened');stage.style.opacity=1;character.style.opacity=1;character.style.transform='translate(-50%,-50%) scale(1)';$('.face').style.opacity=1;
  stage.removeAttribute('aria-hidden');controls(false);$('#replay').hidden=false;backgroundStart=performance.now();
  status.textContent='SIX DISCIPLINES. ONE ORBIT.';$('#timeline-fill').style.width='100%';$('#replay').focus({preventScroll:true});
 }
 function complete(){
  if(completed)return;completed=true;hero.classList.add('settled','awakened');stage.removeAttribute('aria-hidden');
  status.textContent='SIX DISCIPLINES. ONE ORBIT.';
 }
 $('#enter').addEventListener('click',start);$('#replay').addEventListener('click',start);$('#skip').addEventListener('click',finishStatic);
 $('.skip-link').addEventListener('click',()=>{if(locked)finishStatic()});
 $('#pause').addEventListener('click',async()=>{
  if(audio.paused){await initAudio();try{await audio.play();mode='playing';$('#pause').textContent='Pause';scheduleEnvelope()}catch{status.textContent='PLAYBACK UNAVAILABLE · TRY REPLAY'}}
  else{audio.pause();mode='paused';$('#pause').textContent='Resume';setGain(volumeOverride?userVolume:sequence(audio.currentTime).volume)}
 });
 $('#sound').addEventListener('click',()=>{muted=!muted;$('#sound').setAttribute('aria-pressed',String(muted));$('#sound').innerHTML=muted?'Sound off <span>×</span>':'Sound on <span class="equalizer">▂▅▃▆</span>';scheduleEnvelope()});
 $('#volume').addEventListener('input',e=>{volumeOverride=true;userVolume=Number(e.target.value)/100;if(audio.currentTime>=END)userVolume=Math.min(BACKGROUND,userVolume);e.target.value=Math.round(userVolume*100);scheduleEnvelope()});
 audio.addEventListener('playing',()=>{if(mode==='playing')scheduleEnvelope()});
 audio.addEventListener('waiting',()=>{if(mode==='playing'){if(!completed)status.textContent='BUFFERING · SEQUENCE PAUSED';setGain(volumeOverride?userVolume:sequence(audio.currentTime).volume)}});
 audio.addEventListener('ended',()=>{$('#pause').hidden=true;$('#sound').hidden=true;$('#volume-label').hidden=true;mode='static';backgroundStart=performance.now()});
 audio.addEventListener('error',()=>{if(['playing','paused'].includes(mode)){finishStatic();status.textContent='AUDIO UNAVAILABLE · EXPLORE THE PROFILE'}});
 document.addEventListener('visibilitychange',async()=>{
  if(mode==='door'){doorAnimations.forEach(a=>document.hidden?a.pause():a.play());return}
  if(document.hidden&&mode==='playing'&&!completed){audio.pause();mode='paused';hiddenPaused=true;$('#pause').textContent='Resume';setGain(sequence(audio.currentTime).volume)}
  else if(!document.hidden&&hiddenPaused){hiddenPaused=false;try{await initAudio();await audio.play();mode='playing';scheduleEnvelope()}catch{finishStatic()}}
 });
 const canvas=$('#field'),ctx=canvas.getContext('2d');let w=0,h=0,stageW=0,stageH=0;
 const stars=Array.from({length:105},(_,i)=>({x:((i*73.721)%100)/100,y:((i*41.369)%100)/100,r:i%8===0?1.1:.55}));
 function resize(){w=hero.clientWidth;h=hero.clientHeight;stageW=stage.clientWidth;stageH=stage.clientHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
 new ResizeObserver(resize).observe(hero);resize();
 const rand=(seed)=>{const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n)};
 // Midpoint displacement preserves the irregular structure of a discharge.
 function boltPath(x1,y1,x2,y2,seed,roughness,depth=6){
  function split(a,b,n,k,spread){
   if(!n)return[a,b];
   const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
   const bend=(rand(k)-.5)*spread,along=.38+rand(k+17)*.24;
   const mid=[a[0]+dx*along-dy/len*bend,a[1]+dy*along+dx/len*bend];
   return [...split(a,mid,n-1,k*2+1,spread*.55).slice(0,-1),...split(mid,b,n-1,k*2+2,spread*.55)];
  }
  return split([x1,y1],[x2,y2],depth,seed,roughness);
 }
 function strokeBolt(points,alpha,width){
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowBlur=0;
  ctx.strokeStyle=`rgba(133,166,231,${alpha*.13})`;ctx.lineWidth=width*9;ctx.stroke();
  ctx.strokeStyle=`rgba(178,202,255,${alpha*.35})`;ctx.lineWidth=width*2.8;ctx.stroke();
  ctx.strokeStyle=`rgba(248,250,255,${alpha})`;ctx.lineWidth=width;ctx.stroke();
 }
 function drawLightning(t){
  if(reduced||t<.8||t>=START)return;
  const k=Math.floor((t-.8)/1.72),age=(t-.8)-k*1.72;
  if(age>.52)return;
  const flicker=age<.065?ease(age/.016):age<.15?.16:age<.21?.72:Math.exp(-(age-.21)*13)*.48;
  const strength=flicker*(1-ease((t-(START-2))/2));
  const fromLeft=k%2===0,seed=k*197+41;
  const points=boltPath(fromLeft?-15:w+15,h*(.10+rand(k+3)*.38),w*(fromLeft?.88:.12),h*(.4+rand(k+22)*.42),seed,h*.34);
  ctx.save();ctx.globalCompositeOperation='screen';strokeBolt(points,strength,w<650?.9:1.25);
  for(let j=7;j<58;j+=7){
   const [x,y]=points[j],length=(.06+rand(seed+j)*.18)*w,direction=fromLeft?1:-1;
   const branch=boltPath(x,y,x+direction*length,y+(rand(j+seed+4)-.28)*h*.34,seed+j,length*.5,4);
   strokeBolt(branch,strength*(.28+rand(j)*.32),.45);
   if(j%2){const [bx,by]=branch[7];strokeBolt(boltPath(bx,by,bx+direction*length*.4,by-h*.065,seed+j+400,length*.2,3),strength*.24,.3)}
  }
  ctx.restore();
 }
 const fracture=$('#fracture'),svgNS='http://www.w3.org/2000/svg';
 function addCrack(points,width){const p=document.createElementNS(svgNS,'path');p.setAttribute('d',points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '));p.setAttribute('pathLength','1');p.setAttribute('stroke-width',width);fracture.append(p)}
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4+.12,ex=500+Math.cos(angle)*470,ey=300+Math.sin(angle)*290;
  const points=boltPath(500,300,ex,ey,71+i*81,65,5);addCrack(points,i%2?1.5:2.1);
  for(const j of[12,22]){const [x,y]=points[j];addCrack(boltPath(x,y,x+Math.cos(angle+.65)*105,y+Math.sin(angle+.65)*90,i*21+j,28,3),.65)}
 }
 const eyePaint=[...document.querySelectorAll('.eye-paint')],eyeInk=[...document.querySelectorAll('.rough-eye-rim:not(.rim-alternate) .eye-ink')];let eyeFrame=-1;
 function paintEyes(t){
  const frame=reduced?0:Math.floor(t*12);if(frame===eyeFrame)return;eyeFrame=frame;
  eyePaint.forEach((eye,index)=>{
   const seed=(frame%19)*89+index*41,points=[];
   for(let j=0;j<64;j++){const theta=j*Math.PI/32,r=14.7+(rand(seed+j)-.5)*3.8+(j%7===0?1.8:0);points.push([Math.cos(theta)*r,Math.sin(theta)*r])}
   eye.setAttribute('d',points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')+'Z');
   let scratches='';for(let j=0;j<9;j++){const a=rand(seed+j*17)*Math.PI*2,r=13.1+rand(seed+j*9)*2.1,b=a+.08+rand(seed+j*11)*.18;scratches+=`M${Math.cos(a)*r} ${Math.sin(a)*r}Q${Math.cos((a+b)/2)*(r+.5)} ${Math.sin((a+b)/2)*(r+.5)} ${Math.cos(b)*r} ${Math.sin(b)*r} `}eyeInk[index].setAttribute('d',scratches);
  });
 }
 const fogCanvas=$('#entrance-current'),fog=fogCanvas.getContext('2d');let fw=0,fh=0,doorEpoch=0;
 function drawEntrance(now){
  if(mode!=='door'){doorEpoch=0;fog.clearRect(0,0,fw,fh);return}
  if(!doorEpoch)doorEpoch=now;
  if(fw!==gate.clientWidth||fh!==gate.clientHeight){fw=gate.clientWidth;fh=gate.clientHeight;fogCanvas.width=fw;fogCanvas.height=fh}
  const seconds=(now-doorEpoch)/1000;
  fog.clearRect(0,0,fw,fh);if(reduced)return;
  fog.globalCompositeOperation='screen';
  for(let i=0;i<78;i++){
   const progress=(seconds*.23+rand(i+31))%1,depth=progress*progress,lane=(rand(i+400)-.5)*2;
   const x=fw*.5+lane*fw*(.10+depth*.95)+Math.sin(seconds*.6+i)*fw*.025*depth,y=fh*(.69+depth*.46);
   const rx=fw*(.012+depth*.16),ry=fh*(.008+depth*.07),alpha=Math.sin(progress*Math.PI)*ease(seconds/1.1)*(.085+rand(i+12)*.095);
   fog.save();fog.translate(x,y);fog.scale(1,ry/rx);
   const cloud=fog.createRadialGradient(0,0,0,0,0,rx);cloud.addColorStop(0,`rgba(175,197,214,${alpha})`);cloud.addColorStop(.5,`rgba(133,157,181,${alpha*.7})`);cloud.addColorStop(1,'rgba(70,89,113,0)');fog.fillStyle=cloud;fog.fillRect(-rx,-rx,rx*2,rx*2);fog.restore();
  }
  fog.globalCompositeOperation='source-over';
 }
 function paint(now){
  const active=mode==='playing'||mode==='paused',t=mode==='static'?END+(now-backgroundStart)/1000:audio.currentTime,s=sequence(t),motion=reduced?0:t;
  drawEntrance(now);
  if(completed||s.faceOpacity>0)paintEyes(t);
  fracture.style.opacity=(active||mode==='static')&&t>=END?String(.2+.7*(1-ease((t-END)/2))):'0';
  fracture.style.setProperty('--crack-progress',mode==='static'||reduced?1:s.crack);
  ctx.clearRect(0,0,w,h);
  stars.forEach((star,i)=>{ctx.fillStyle=`rgba(191,166,223,${.13+(Math.sin(motion*.3+i)+1)*.09})`;ctx.beginPath();ctx.arc(star.x*w+Math.sin(motion*.04+i)*8,star.y*h+Math.cos(motion*.03+i)*5,star.r,0,Math.PI*2);ctx.fill()});
  if(active){
   drawLightning(t);stage.style.opacity=s.started?'1':'0';prelude.style.opacity=1-ease((t-(START-1.4))/1.4);prelude.style.setProperty('--energy',ease(t/8));
   words.forEach((word,i)=>{const age=t-terms[i][4],opacity=ease(age/.9)*(1-ease((age-2.8)/1.5))*(1-ease((t-(START-1.5))/1.5));word.style.opacity=opacity;word.style.transform=`translate(-50%,calc(-50% + ${reduced?0:14*(1-ease(age/4.3))}px))`;word.style.filter=`blur(${(1-ease(age/.9))*5}px)`});
   character.style.opacity=s.character;character.style.transform=`translate(-50%,-50%) scale(${reduced?1:s.zoom})`;$('.face').style.opacity=s.faceOpacity;stage.style.setProperty('--aura',s.progress);$('#timeline-fill').style.width=`${clamp(t/END)*100}%`;
   if(s.complete){complete();if(locked&&t>=END+1.2)lockScene(false);if(volumeOverride&&userVolume>BACKGROUND){volumeOverride=false;scheduleEnvelope()}}
   if(!volumeOverride){$('#volume').value=Math.round(s.volume*100);if(!gain)audio.volume=muted?0:s.volume}
   if(t>=SILENCE){setGain(0);audio.pause();mode='static';backgroundStart=now-(t-END)*1000;hero.classList.remove('soundtrack-running');$('.hero-footer').inert=false;controls(false);$('#replay').hidden=false}
   if(!s.complete&&!audio.paused){const label=t<START?'ENGINEERING / MATERIALS / COMPUTATION':`CONVERGENCE / ${Math.min(6,Math.floor(t-START)+1)} OF 6`;if(label!==lastStatus){status.textContent=label;lastStatus=label}}
  }
  if(active||mode==='static'){
   const mobile=w<=650,rx=stageW*(mobile?.31:.355),ry=stageH*(mobile?.435:.405),offset=reduced?0:Math.max(0,t-START)*.22;
   capsules.forEach((el,i)=>{const theta=i*Math.PI/3-Math.PI/2+offset,op=mode==='static'?1:s.capsules[i];el.style.transform=`translate(calc(-50% + ${Math.cos(theta)*rx}px),calc(-50% + ${Math.sin(theta)*ry}px)) scale(${.8+.2*op})`;el.style.opacity=op;el.style.zIndex=Math.sin(theta)>0?'4':'1';el.tabIndex=!locked&&completed&&op>.99?0:-1;el.style.pointerEvents=!locked&&completed&&op>.99?'auto':'none'});
  }
  requestAnimationFrame(paint);
 }
 requestAnimationFrame(paint);
}
