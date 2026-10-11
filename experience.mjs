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
 Promise.all([...document.querySelectorAll('.door-image,.character img')].map(img=>img.decode())).catch(()=>{note.textContent='Image unavailable. You can explore without the intro.'});
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
  $('#shockwave').classList.remove('hit');$('#enter').disabled=true;note.textContent='Preparing the entrance…';$('#door-progress').textContent='';
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
   $('#door-progress').textContent='';note.textContent='Playback could not start. Try again, or explore without the intro.';
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
  $('#shockwave').classList.add('hit');status.textContent='SIX DISCIPLINES. ONE ORBIT.';
 }
 $('#enter').addEventListener('click',start);$('#replay').addEventListener('click',start);$('#quiet').addEventListener('click',finishStatic);$('#skip').addEventListener('click',finishStatic);
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
 function boltPath(x1,y1,x2,y2,seed,amplitude,count=20){
  const points=[];for(let j=0;j<=count;j++){const p=j/count;points.push([x1+(x2-x1)*p+(j&&j<count?(rand(seed+j)-.5)*amplitude*.45:0),y1+(y2-y1)*p+(j&&j<count?(rand(seed+j+70)-.5)*amplitude:0)])}return points;
 }
 function strokeBolt(points,alpha,width){
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.strokeStyle=`rgba(139,95,221,${alpha*.36})`;ctx.lineWidth=width*6;ctx.shadowColor='#9b73ed';ctx.shadowBlur=17;ctx.stroke();
  ctx.strokeStyle=`rgba(174,205,244,${alpha*.7})`;ctx.lineWidth=width*1.6;ctx.shadowBlur=5;ctx.stroke();
  ctx.strokeStyle=`rgba(224,228,250,${alpha*.7})`;ctx.lineWidth=width*.48;ctx.shadowBlur=0;ctx.stroke();
 }
 function drawLightning(t){
  if(reduced||t<.8||t>=START)return;
  const k=Math.floor((t-.8)/1.6),age=(t-.8)-k*1.6;
  if(age>.72)return;
  const strength=Math.sin(Math.PI*clamp(age/.72))*.85*(1-ease((t-(START-2))/2));
  if(strength<=0)return;
  const left=k%2===0,x1=left?-20:w+20,y1=h*(.17+rand(k+3)*.57),x2=w*(left?.78:.22),y2=h*(.27+rand(k+22)*.45);
  const points=boltPath(x1,y1,x2,y2,k*99+17,Math.min(100,h*.12));
  ctx.save();ctx.globalCompositeOperation='screen';strokeBolt(points,strength,w<650?1.2:1.7);
  for(const j of[7,13]){const [x,y]=points[j];strokeBolt(boltPath(x,y,x+(left?1:-1)*w*.17,y+(rand(k+j)>.5?1:-1)*h*.18,k*61+j,40,9),strength*.42,.8)}
  ctx.restore();
 }
 function paint(now){
  const active=mode==='playing'||mode==='paused',t=mode==='static'?END+(now-backgroundStart)/1000:audio.currentTime,s=sequence(t),motion=reduced?0:t;
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
