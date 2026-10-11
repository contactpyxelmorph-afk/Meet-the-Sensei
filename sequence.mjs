export const START=17, END=23, HOLD=2, FADE_START=END+HOLD, SILENCE=35.5, FADE=SILENCE-FADE_START, BACKGROUND=0, INTRO=.9;
export const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
export const ease=n=>{n=clamp(n);return n*n*(3-2*n)};
export function sequence(t){return {started:t>=START,complete:t>=END,progress:clamp((t-START)/6),character:ease((t-START-1)/5),face:t>=END,faceOpacity:ease((t-END)/1.2),zoom:.88+.12*ease((t-START)/6),crack:ease((t-END)/.32),volume:t<FADE_START?INTRO:INTRO+(BACKGROUND-INTRO)*clamp((t-FADE_START)/FADE),capsules:Array.from({length:6},(_,i)=>ease((t-START-i*((END-START)/6))/.65))};}
