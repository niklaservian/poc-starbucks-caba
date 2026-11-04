import {useEffect,useMemo,useState} from 'react'
import DeckGL from '@deck.gl/react'
import {ScatterplotLayer,PathLayer,TextLayer} from '@deck.gl/layers'
import {Map} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import {HAD,K,simular,en,costo} from './sim'
import {supabase} from './supabase'
import {descargar,borrar} from './remitos'

const STYLE='https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const VIEW={longitude:-58.43,latitude:-34.60,zoom:11.3,pitch:0,bearing:0}
const DIAS=[['L','Lun'],['M','Mar'],['X','Mié'],['J','Jue'],['V','Vie']]
const COL=[[0,98,65],[30,100,200],[200,60,160],[230,120,20],[110,60,190],[20,150,170],[180,40,40],[90,90,90]]
const $=v=>'$'+Math.round(v).toLocaleString('es-AR')
const hv=(a,b)=>{const r=Math.PI/180,p=(b.lat-a.lat)*r,q=(b.lon-a.lon)*r,h=Math.sin(p/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(q/2)**2;return 12742*Math.asin(Math.sqrt(h))}
const inicio=()=>{const d=new Date();d.setHours(0,0,0,0);return d.toISOString()}

export default function TorreGPS({rows,onBack}){
  const [dia,setDia]=useState(()=>{const d='DLMXJVS'[new Date().getDay()];return 'LMXJV'.includes(d)?d:'V'})
  const [pos,setPos]=useState([]),[ent,setEnt]=useState([]),[now,setNow]=useState(Date.now())
  const sim=useMemo(()=>simular(rows.filter(r=>(r.dias||'').split(' ').includes(dia)),'LMXJV'.indexOf(dia)+7),[rows,dia])
  useEffect(()=>{const i=setInterval(()=>setNow(Date.now()),5000);return()=>clearInterval(i)},[])
  useEffect(()=>{
    if(!supabase)return
    setPos([]);setEnt([])
    supabase.from('posiciones').select('*').eq('dia',dia).gte('created_at',inicio()).order('created_at',{ascending:true}).limit(5000).then(({data})=>setPos(data||[]))
    supabase.from('entregas').select('*').eq('dia',dia).gte('created_at',inicio()).order('created_at',{ascending:false}).then(({data})=>setEnt(data||[]))
    const ch=supabase.channel('gps-'+dia)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'posiciones'},p=>{if(p.new.dia===dia)setPos(l=>[...l,p.new])})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'entregas'},p=>{if(p.new.dia===dia)setEnt(l=>[p.new,...l])}).on('postgres_changes',{event:'DELETE',schema:'public',table:'entregas'},p=>setEnt(l=>l.filter(x=>x.id!==p.old.id))).subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[dia])
  const foto=p=>supabase.storage.from('remitos').getPublicUrl(p).data.publicUrl
  const hora=e=>new Date(e.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})
  const sg=v=>(v>=0?'+':'')+v.toFixed(0)

  const stops=[],vehs=sim.veh.map((v,i)=>{
    const c=COL[i%COL.length],pts=pos.filter(p=>p.vehiculo===v.id&&(p.precision==null||p.precision<=100))
    const t0=pts.length?new Date(pts[0].created_at).getTime():null,last=pts[pts.length-1]
    const lastMs=last?new Date(last.created_at).getTime():null,activo=lastMs!==null&&now-lastMs<120000
    const el=t0===null?0:Math.max(0,((activo?now:lastMs)-t0)/60000)
    let kmR=0;for(let j=1;j<pts.length;j++){const d=hv(pts[j-1],pts[j]);if(d>0.015)kmR+=d}
    const pp=en(v.plan,el).p,dev=last?hv(last,{lat:pp[1],lon:pp[0]}):0
    let hechas=0
    const st=v.plan.stops.map(s=>{const e=ent.find(x=>x.vehiculo===v.id&&x.local_nombre===s.n.nombre)
      const demora=e&&t0!==null?(new Date(e.created_at).getTime()-t0)/60000-s.t:null
      if(e)hechas++
      const o={nombre:s.n.nombre,veh:v.id,plan:s.t,pos:[s.n.longitud,s.n.latitud],rem:e,demora};stops.push(o);return o})
    return{id:v.id,c,last,activo,lastMs,el,kmR,pp,dev,hechas,total:st.length,sin:!pts.length,path:pts.map(p=>[p.lon,p.lat]),
      cR:kmR*K.KM_C+el/60*K.H_C,cP:costo(v.plan,el)}})
  const done=stops.filter(s=>s.rem),dem=done.filter(s=>s.demora!==null),late=dem.filter(s=>s.demora>10)
  const desv=dem.length?dem.reduce((a,s)=>a+s.demora,0)/dem.length:0
  const kpis=[['Vehículos con señal GPS',vehs.filter(v=>v.activo).length+' de '+vehs.length],['Entregas confirmadas',done.length+' de '+stops.length],['Demoradas (más de 10 min)',late.length],['Desvío promedio (min)',sg(desv)],['Km recorridos (GPS)',vehs.reduce((a,v)=>a+v.kmR,0).toFixed(1)],['Costo real acumulado',$(vehs.reduce((a,v)=>a+v.cR,0))],['Costo plan (mismo tiempo)',$(vehs.reduce((a,v)=>a+v.cP,0))]]
  const col=s=>!s.rem?[150,150,150]:s.demora!==null&&s.demora>10?[215,50,50]:[34,160,90]
  const con=vehs.filter(v=>!v.sin)
  const layers=[
    new PathLayer({id:'tr',data:con.filter(v=>v.path.length>1),getPath:d=>d.path,getColor:d=>d.c,getWidth:4,widthMinPixels:3}),
    new ScatterplotLayer({id:'st',data:stops,getPosition:d=>d.pos,getFillColor:col,getRadius:150,radiusMinPixels:5,stroked:true,getLineColor:[255,255,255],lineWidthMinPixels:1,pickable:true,updateTriggers:{getFillColor:[ent.length,now]}}),
    new ScatterplotLayer({id:'rem',data:done,getPosition:d=>d.pos,getRadius:260,radiusMinPixels:11,filled:false,stroked:true,getLineColor:[30,100,255],lineWidthMinPixels:3}),
    new ScatterplotLayer({id:'pl',data:con,getPosition:d=>d.pp,getRadius:200,radiusMinPixels:8,filled:false,stroked:true,getLineColor:d=>d.c,lineWidthMinPixels:2}),
    new ScatterplotLayer({id:'rl',data:con,getPosition:d=>[d.last.lon,d.last.lat],getFillColor:d=>d.activo?d.c:[150,150,150],getRadius:200,radiusMinPixels:10,stroked:true,getLineColor:[255,255,255],lineWidthMinPixels:2}),
    new TextLayer({id:'tx',data:con,getPosition:d=>[d.last.lon,d.last.lat],getText:d=>'V'+d.id,getSize:12,getPixelOffset:[0,-20],fontWeight:700}),
    new ScatterplotLayer({id:'had',data:[HAD],getPosition:d=>[d.longitud,d.latitud],getFillColor:[240,120,20],getRadius:250,radiusMinPixels:9,stroked:true,getLineColor:[0,0,0],lineWidthMinPixels:2}),
  ]
  return(<>
    <div className="r"><button className="b" onClick={onBack}>← Volver a la simulación</button>
      <h1 style={{margin:0,fontSize:22}}>Torre de control: GPS en vivo</h1></div>
    <p style={{margin:'0 0 10px',color:'#5b6678',fontSize:13}}>Posición real de los vehículos, enviada por el celular de cada chofer, contra el plan. Los remitos confirmados se ven en el mapa. Se actualiza solo.</p>
    <div className="k">{kpis.map(([a,v])=><div key={a} className="c"><b style={{fontSize:22,color:'#006241'}}>{v}</b><div style={{fontSize:12,color:'#5b6678'}}>{a}</div></div>)}</div>
    <div className="r">{DIAS.map(([k,n])=><button key={k} className={'b'+(dia===k?' on':'')} onClick={()=>setDia(k)}>{n}</button>)}</div>
    {!con.length&&<div className="c" style={{marginBottom:10,borderLeft:'4px solid #f0781e'}}>Todavía no llegó ninguna señal GPS de hoy para este día. En el celular del chofer, abrí la dirección con #chofer al final, elegí el día y el vehículo y tocá “Compartir mi ubicación”.</div>}
    <div className="m">
      <div style={{position:'relative',height:'62vh',minHeight:420,borderRadius:10,overflow:'hidden',border:'1px solid #d9dfe8'}}>
        <DeckGL initialViewState={VIEW} controller layers={layers} getTooltip={({object})=>object&&object.nombre&&{html:`<b>${object.nombre}</b><br>Vehículo ${object.veh}<br>Llegada prevista: +${object.plan.toFixed(0)} min desde la salida${object.rem?`<br><b>Remito confirmado</b> por ${object.rem.chofer} a las ${hora(object.rem)}${object.demora!==null?'<br>Demora: '+sg(object.demora)+' min':''}<br><img src="${foto(object.rem.foto_path)}" width="180"/>`:'<br>Pendiente'}`,style:{fontSize:'12px'}}}>
          <Map mapStyle={STYLE}/>
        </DeckGL>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div className="c"><b>Vehículos</b>
          {vehs.map(v=><div key={v.id} style={{fontSize:13,margin:'8px 0'}}>
            <span style={{display:'inline-block',width:10,height:10,borderRadius:5,background:`rgb(${v.c})`,marginRight:6}}/><b>V{v.id}</b>
            <span style={{float:'right',color:v.activo?'#006241':'#8a93a3'}}>{v.sin?'sin GPS':v.activo?'en línea':'sin señal hace '+Math.round((now-v.lastMs)/60000)+' min'}</span>
            <div style={{fontSize:12,color:'#5b6678'}}>{v.hechas}/{v.total} entregas{v.sin?'':' · '+v.kmR.toFixed(1)+' km · '+v.dev.toFixed(1)+' km del plan'}</div></div>)}
        </div>
        <div className="c"><b>Remitos en vivo</b>
          {ent.slice(0,6).map(e=><div key={e.id} style={{margin:'10px 0'}}><a href={foto(e.foto_path)} target="_blank" rel="noreferrer" style={{display:'flex',gap:8,alignItems:'center',textDecoration:'none',color:'inherit'}}><img src={foto(e.foto_path)} alt="Remito" width={52} height={52} style={{objectFit:'cover',borderRadius:6}}/><span style={{fontSize:13}}><b>{e.local_nombre}</b><br/>V{e.vehiculo} · {e.chofer} · {hora(e)}</span></a>
            <div style={{display:'flex',gap:6,marginTop:4}}><button className="b" style={{padding:'3px 8px',fontSize:12}} onClick={()=>descargar(e)}>Descargar</button><button className="b" style={{padding:'3px 8px',fontSize:12,borderColor:'#d73232',color:'#d73232'}} onClick={async()=>{if(await borrar(e))setEnt(l=>l.filter(x=>x.id!==e.id))}}>Eliminar</button></div></div>)}
          {!ent.length&&<div style={{fontSize:13,margin:'6px 0'}}>Todavía no hay remitos confirmados.</div>}</div>
        <div className="c" style={{fontSize:12,color:'#5b6678'}}>Círculo lleno: posición GPS real (gris si pasaron más de 2 min sin señal). Círculo vacío: dónde debería estar según el plan, contando desde la primera señal del vehículo. Línea: recorrido real. Paradas: gris pendiente, verde confirmada a tiempo, roja con más de 10 min de demora. Aro azul: remito confirmado (pasá el mouse para ver la foto). Costos con tarifas ilustrativas de {$(K.KM_C)} por km y {$(K.H_C)} por hora.</div>
      </div>
    </div>
  </>)}
