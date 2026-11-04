import {useEffect,useMemo,useState} from 'react'
import DeckGL from '@deck.gl/react'
import {ScatterplotLayer,PathLayer,TextLayer} from '@deck.gl/layers'
import {Map} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import {HAD,K,simular,en,costo,hm} from './sim'
import {supabase} from './supabase'

const STYLE='https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const VIEW={longitude:-58.43,latitude:-34.60,zoom:11.3,pitch:0,bearing:0}
const DIAS=[['L','Lun'],['M','Mar'],['X','Mié'],['J','Jue'],['V','Vie']]
const COL=[[0,98,65],[30,100,200],[200,60,160],[230,120,20],[110,60,190],[20,150,170],[180,40,40],[90,90,90]]
const $=v=>'$'+Math.round(v).toLocaleString('es-AR')

export default function Torre({rows,onBack}){
  const [dia,setDia]=useState(()=>{const d='DLMXJVS'[new Date().getDay()];return 'LMXJV'.includes(d)?d:'V'}),[t,setT]=useState(0),[play,setPlay]=useState(false),[vel,setVel]=useState(10)
  const sim=useMemo(()=>simular(rows.filter(r=>(r.dias||'').split(' ').includes(dia)),'LMXJV'.indexOf(dia)+7),[rows,dia])
  const tend=sim.tend
  useEffect(()=>{if(!play)return;const i=setInterval(()=>setT(x=>Math.min(tend,x+vel/10)),100);return()=>clearInterval(i)},[play,vel,tend])
  useEffect(()=>{if(t>=tend)setPlay(false)},[t,tend])
  const pick=d=>{setDia(d);setT(0);setPlay(false)}

  const [ent,setEnt]=useState([]),hoy=new Date().toISOString().slice(0,10)
  useEffect(()=>{
    if(!supabase)return
    setEnt([])
    supabase.from('entregas').select('*').eq('fecha',hoy).eq('dia',dia).order('created_at',{ascending:false}).then(({data})=>setEnt(data||[]))
    const ch=supabase.channel('torre-'+dia).on('postgres_changes',{event:'INSERT',schema:'public',table:'entregas'},p=>{if(p.new.fecha===hoy&&p.new.dia===dia)setEnt(l=>[p.new,...l])}).subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[dia])
  const foto=p=>supabase.storage.from('remitos').getPublicUrl(p).data.publicUrl
  const hora=e=>new Date(e.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})
  const conf={};ent.forEach(e=>{conf[e.vehiculo+'|'+e.local_nombre]=e})
  const stops=[],vehs=sim.veh.map((v,i)=>{
    const c=COL[i%COL.length],r=en(v.real,t),pl=en(v.plan,t)
    let hechas=0,dev=0
    v.real.stops.forEach((s,j)=>{const P=v.plan.stops[j],done=s.t<=t,late=s.t-P.t>10
      if(done){hechas++;dev=s.t-P.t}
      stops.push({nombre:s.n.nombre,veh:v.id,plan:P.t,real:s.t,done,late,pos:[s.n.longitud,s.n.latitud],rem:conf[v.id+'|'+s.n.nombre]})})
    return{id:v.id,c,r,pl,hechas,total:v.real.stops.length,dev,path:v.plan.w.map(x=>[x[1],x[2]])}})
  const N=stops.length,done=stops.filter(s=>s.done),late=done.filter(s=>s.late)
  const desv=done.length?done.reduce((a,s)=>a+s.real-s.plan,0)/done.length:0
  const cReal=sim.veh.reduce((a,v)=>a+costo(v.real,t),0),cPlan=sim.veh.reduce((a,v)=>a+costo(v.plan,t),0)
  const fReal=sim.veh.reduce((a,v)=>a+costo(v.real,1e9),0),fPlan=sim.veh.reduce((a,v)=>a+costo(v.plan,1e9),0)
  const kpis=[['Vehículos en ruta',vehs.length],['Entregas completadas',done.length+' de '+N],['Entregas demoradas (más de 10 min)',late.length],['Desvío promedio (min)',(desv>=0?'+':'')+desv.toFixed(0)],['Costo acumulado real',$(cReal)],['Costo plan (mismo momento)',$(cPlan)],['Remitos recibidos',ent.length]]
  const st=s=>!s.done?[150,150,150]:s.late?[215,50,50]:[34,160,90]
  const layers=[
    new PathLayer({id:'rt',data:vehs,getPath:d=>d.path,getColor:d=>[...d.c,90],getWidth:3,widthMinPixels:2}),
    new ScatterplotLayer({id:'st',data:stops,getPosition:d=>d.pos,getFillColor:st,getRadius:150,radiusMinPixels:5,stroked:true,getLineColor:[255,255,255],lineWidthMinPixels:1,pickable:true,updateTriggers:{getFillColor:[t]}}),
    new ScatterplotLayer({id:'rem',data:stops.filter(s=>s.rem),getPosition:d=>d.pos,getRadius:260,radiusMinPixels:11,filled:false,stroked:true,getLineColor:[30,100,255],lineWidthMinPixels:3,pickable:true}),
    new ScatterplotLayer({id:'pl',data:vehs,getPosition:d=>d.pl.p,getRadius:200,radiusMinPixels:8,filled:false,stroked:true,getLineColor:d=>d.c,lineWidthMinPixels:2}),
    new ScatterplotLayer({id:'rl',data:vehs,getPosition:d=>d.r.p,getFillColor:d=>d.c,getRadius:200,radiusMinPixels:10,stroked:true,getLineColor:[255,255,255],lineWidthMinPixels:2}),
    new TextLayer({id:'tx',data:vehs,getPosition:d=>d.r.p,getText:d=>'V'+d.id,getSize:12,getPixelOffset:[0,-20],fontWeight:700}),
    new ScatterplotLayer({id:'had',data:[HAD],getPosition:d=>[d.longitud,d.latitud],getFillColor:[240,120,20],getRadius:250,radiusMinPixels:9,stroked:true,getLineColor:[0,0,0],lineWidthMinPixels:2}),
  ]
  return(<>
    <div className="r"><button className="b" onClick={onBack}>← Volver al mapa</button>
      <h1 style={{margin:0,fontSize:22}}>Torre de control: seguimiento de un día de reparto</h1></div>
    <p style={{margin:'0 0 10px',color:'#5b6678',fontSize:13}}>Simulación del reparto desde el HAD: plan contra real y costo mientras avanza el recorrido. No usa GPS real: el tránsito y las demoras son simulados.</p>
    <div className="k">{kpis.map(([a,v])=><div key={a} className="c"><b style={{fontSize:22,color:'#006241'}}>{v}</b><div style={{fontSize:12,color:'#5b6678'}}>{a}</div></div>)}</div>
    <div className="r">
      {DIAS.map(([k,n])=><button key={k} className={'b'+(dia===k?' on':'')} onClick={()=>pick(k)}>{n}</button>)}
      <button className="b on" onClick={()=>{if(t>=tend)setT(0);setPlay(!play)}}>{play?'Pausar':'Iniciar'}</button>
      <button className="b" onClick={()=>{setT(0);setPlay(false)}}>Reiniciar</button>
      <select value={vel} onChange={e=>setVel(+e.target.value)} style={{padding:6}}><option value={5}>Lento</option><option value={10}>Normal</option><option value={25}>Rápido</option></select>
      <b style={{minWidth:50}}>{hm(t)}</b>
      <input type="range" min={0} max={tend} step={1} value={t} onChange={e=>setT(+e.target.value)} style={{flex:1,minWidth:120}}/>
    </div>
    <div className="m">
      <div style={{position:'relative',height:'62vh',minHeight:420,borderRadius:10,overflow:'hidden',border:'1px solid #d9dfe8'}}>
        <DeckGL initialViewState={VIEW} controller layers={layers} getTooltip={({object})=>object&&object.nombre&&{html:`<b>${object.nombre}</b><br>Vehículo ${object.veh}<br>Llegada plan: ${hm(object.plan)}<br>Llegada real: ${hm(object.real)}<br>Desvío: ${(object.real-object.plan>=0?'+':'')+(object.real-object.plan).toFixed(0)} min${object.rem?'<br><b>Remito confirmado</b> por '+object.rem.chofer+' a las '+hora(object.rem)+'<br><img src="'+foto(object.rem.foto_path)+'" width="180"/>':''}`,style:{fontSize:'12px'}}}>
          <Map mapStyle={STYLE}/>
        </DeckGL>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div className="c"><b>Vehículos</b>
          {vehs.map(v=><div key={v.id} style={{fontSize:13,margin:'6px 0'}}><span style={{display:'inline-block',width:10,height:10,borderRadius:5,background:`rgb(${v.c})`,marginRight:6}}/>V{v.id}: {v.hechas}/{v.total} entregas<span style={{float:'right',color:v.dev>10?'#d73232':'#006241'}}>{v.hechas?(v.dev>=0?'+':'')+v.dev.toFixed(0)+' min':'–'}</span></div>)}
        </div>
        <div className="c"><b>Costo del día</b>
          <div style={{fontSize:13,margin:'6px 0'}}>Plan: {$(fPlan)}</div>
          <div style={{fontSize:13}}>Real: {$(fReal)}<span style={{float:'right',color:'#d73232'}}>{fPlan?'+'+((fReal/fPlan-1)*100).toFixed(0)+'%':''}</span></div></div>
        <div className="c"><b>Remitos en vivo</b><div style={{fontSize:12,color:'#5b6678'}}>Fotos subidas por los choferes (día seleccionado, de hoy).</div>
          {ent.slice(0,6).map(e=><a key={e.id} href={foto(e.foto_path)} target="_blank" rel="noreferrer" style={{display:'flex',gap:8,alignItems:'center',margin:'8px 0',textDecoration:'none',color:'inherit'}}><img src={foto(e.foto_path)} alt="Remito" width={52} height={52} style={{objectFit:'cover',borderRadius:6}}/><span style={{fontSize:13}}><b>{e.local_nombre}</b><br/>V{e.vehiculo} · {e.chofer} · {hora(e)}</span></a>)}
          {!ent.length&&<div style={{fontSize:13,margin:'6px 0'}}>Todavía no hay remitos confirmados.</div>}</div>
        <div className="c" style={{fontSize:12,color:'#5b6678'}}>Círculo lleno: vehículo real. Círculo vacío: dónde debería estar según el plan. Aro azul: entrega confirmada con foto del remito (pasá el mouse para verla). Paradas: gris pendiente, verde a tiempo, rojo con más de 10 min de demora. Supuestos a validar: vehículo de {K.CAP} pallets, {K.PAL} pallets por visita, {K.VEL} km/h, {K.SERV} min por parada, 2 vueltas por vehículo, salida 17:00 del HAD, distancias en línea recta por {K.CIRC}, tarifas ilustrativas de {$(K.KM_C)} por km y {$(K.H_C)} por hora.</div>
      </div>
    </div>
  </>)}
