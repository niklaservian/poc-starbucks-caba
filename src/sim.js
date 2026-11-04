// Simulación de un día de reparto desde el HAD (datos simulados, no es GPS real)
export const HAD={longitud:-58.4005,latitud:-34.6360}
export const K={CAP:8,PAL:2,VEL:22,SERV:10,CIRC:1.3,KM_C:600,H_C:8000,T0:17*60}
export const dist=(a,b)=>{const r=Math.PI/180,p=(b.latitud-a.latitud)*r,q=(b.longitud-a.longitud)*r
  const h=Math.sin(p/2)**2+Math.cos(a.latitud*r)*Math.cos(b.latitud*r)*Math.sin(q/2)**2;return 12742*Math.asin(Math.sqrt(h))*K.CIRC}
export const hm=m=>{const x=Math.floor(K.T0+m);return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0')}
const rng=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}
function linea(trips,mult,jit){
  let t=0,pos=HAD,w=[[0,HAD.longitud,HAD.latitud]],stops=[]
  trips.forEach(trip=>{
    ;[...trip,HAD].forEach((n,i)=>{t+=dist(pos,n)/K.VEL*60*mult;w.push([t,n.longitud,n.latitud])
      if(i<trip.length){stops.push({n,t});t+=K.SERV+jit();w.push([t,n.longitud,n.latitud])};pos=n})
    t+=10;w.push([t,HAD.longitud,HAD.latitud])})
  return{w,stops,end:t}}
export function simular(rows,seed){
  const ang=r=>Math.atan2(r.latitud-HAD.latitud,r.longitud-HAD.longitud),s=[...rows].sort((x,y)=>ang(x)-ang(y))
  const per=K.CAP/K.PAL,trips=[]
  for(let i=0;i<s.length;i+=per){let rest=s.slice(i,i+per),cur=HAD,o=[]
    while(rest.length){rest.sort((x,y)=>dist(cur,x)-dist(cur,y));cur=rest.shift();o.push(cur)};trips.push(o)}
  const g=[];trips.forEach((t,i)=>{const v=Math.floor(i/2);(g[v]=g[v]||[]).push(t)})
  const R=rng(seed)
  const veh=g.map((tr,i)=>({id:i+1,plan:linea(tr,1,()=>0),real:linea(tr,1+R()*.35,()=>R()*8)}))
  return{veh,tend:Math.ceil(Math.max(0,...veh.map(v=>v.real.end)))+5}}
export function en(L,t){let km=0,w=L.w
  for(let i=1;i<w.length;i++){const[t0,x0,y0]=w[i-1],[t1,x1,y1]=w[i],seg=dist({longitud:x0,latitud:y0},{longitud:x1,latitud:y1})
    if(t>=t1){km+=seg;continue};const f=t1>t0?Math.max(0,t-t0)/(t1-t0):1
    return{p:[x0+(x1-x0)*f,y0+(y1-y0)*f],km:km+seg*f}}
  const e=w[w.length-1];return{p:[e[1],e[2]],km}}
export const costo=(L,t)=>en(L,t).km*K.KM_C+Math.min(t,L.end)/60*K.H_C
