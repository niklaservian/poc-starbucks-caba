import {createClient} from '@supabase/supabase-js'
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase=url&&key?createClient(url,key):null
import {useEffect,useMemo,useState} from 'react'
import DeckGL from '@deck.gl/react'
import {ScatterplotLayer,TextLayer} from '@deck.gl/layers'
import {HeatmapLayer} from '@deck.gl/aggregation-layers'
import {Map} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import {supabase} from './supabase'

const STYLE='https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const VIEW={longitude:-58.43,latitude:-34.60,zoom:11.3,pitch:0,bearing:0}
const HAD=[{nombre:'HAD Parque Patricios (ubicación aprox.)',longitud:-58.4005,latitud:-34.6360}]
const COL={Alta:[0,98,65],Media:[60,170,120],Baja:[160,215,190]}
const DIAS=[['L','Lun'],['M','Mar'],['X','Mié'],['J','Jue'],['V','Vie']]
const PALLETS_POR_VISITA=2
const RINGS={'Todas':null,'Hasta 4 km':[0,4],'4 a 8 km':[4,8],'Más de 8 km':[8,99]}
const km=(a,b)=>{const r=Math.PI/180,p=(b.latitud-a.latitud)*r,q=(b.longitud-a.longitud)*r
  const h=Math.sin(p/2)**2+Math.cos(a.latitud*r)*Math.cos(b.latitud*r)*Math.sin(q/2)**2;return 12742*Math.asin(Math.sqrt(h))}
const css=`.w{font-family:Calibri,Arial,sans-serif;background:#f4f6f9;min-height:100vh;padding:14px;color:#14213d}
.k{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.c{background:#fff;border:1px solid #d9dfe8;border-radius:10px;padding:10px 14px}
.m{display:grid;grid-template-columns:1fr 290px;gap:12px}
.b{padding:6px 12px;border:1px solid #006241;border-radius:6px;background:#fff;color:#006241;cursor:pointer;font:inherit}
.b.on{background:#006241;color:#fff}
.r{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center}
@media(max-width:820px){.m{grid-template-columns:1fr}}`

export default function App(){
  const [rows,setRows]=useState([]),[err,setErr]=useState(null)
  const [cat,setCat]=useState('Todas'),[dia,setDia]=useState('Todos'),[dist,setDist]=useState('Todas'),[mode,setMode]=useState('puntos')
  useEffect(()=>{
    if(!supabase){setErr('Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY');return}
    supabase.from('puntos').select('nombre,categoria,latitud,longitud,valor,dias,direccion').not('latitud','is',null)
      .then(({data,error})=>error?setErr(error.message):setRows((data||[]).map(r=>({...r,km:km(HAD[0],r)}))))
  },[])
  const base=useMemo(()=>rows.filter(r=>(cat==='Todas'||r.categoria===cat)&&(!RINGS[dist]||(r.km>=RINGS[dist][0]&&r.km<RINGS[dist][1]))),[rows,cat,dist])
  const f=useMemo(()=>dia==='Todos'?base:base.filter(r=>(r.dias||'').split(' ').includes(dia)),[base,dia])
  const porDia=DIAS.map(([k])=>base.filter(r=>(r.dias||'').split(' ').includes(k)).length),mx=Math.max(1,...porDia)
  const visitas=dia==='Todos'?f.reduce((a,r)=>a+r.valor,0):f.length
  const kpis=[['Locales',f.length],[dia==='Todos'?'Visitas por semana':'Visitas ese día',visitas],['Pallets (estimado)',visitas*PALLETS_POR_VISITA],['Distancia prom. al HAD (km)',f.length?(f.reduce((a,r)=>a+r.km,0)/f.length).toFixed(1):'–'],['Locales con 3 visitas',f.filter(r=>r.valor===3).length]]
  const lejanos=[...f].sort((a,b)=>b.km-a.km).slice(0,5)
  const ring=r=>new ScatterplotLayer({id:'ring'+r,data:HAD,getPosition:d=>[d.longitud,d.latitud],getRadius:r*1000,radiusUnits:'meters',stroked:true,filled:false,getLineColor:[240,120,20,170],lineWidthMinPixels:1})
  const layers=[ring(4),ring(8),
    mode==='puntos'&&new ScatterplotLayer({id:'p',data:f,getPosition:d=>[d.longitud,d.latitud],getFillColor:d=>COL[d.categoria],getRadius:d=>120+d.valor*60,radiusMinPixels:5,stroked:true,getLineColor:[255,255,255],lineWidthMinPixels:1,pickable:true}),
    mode==='calor'&&new HeatmapLayer({id:'h',data:f,getPosition:d=>[d.longitud,d.latitud],getWeight:d=>d.valor,radiusPixels:55}),
    new ScatterplotLayer({id:'had',data:HAD,getPosition:d=>[d.longitud,d.latitud],getFillColor:[240,120,20],getRadius:250,radiusMinPixels:9,stroked:true,getLineColor:[0,0,0],lineWidthMinPixels:2,pickable:true}),
    new TextLayer({id:'t',data:HAD,getPosition:d=>[d.longitud,d.latitud],getText:()=>'HAD',getSize:13,getPixelOffset:[0,-18],fontWeight:700})
  ].filter(Boolean)
  return(<div className="w"><style>{css}</style>
    <h1 style={{margin:0,fontSize:22}}>Red de distribución Starbucks CABA</h1>
    <p style={{margin:'2px 0 12px',color:'#5b6678',fontSize:13}}>¿Qué locales concentran más visitas, cuándo y a qué distancia del HAD de Parque Patricios?</p>
    {err&&<p style={{color:'#b00'}}>Error: {err}</p>}
    <div className="k">{kpis.map(([t,v])=><div key={t} className="c"><b style={{fontSize:26,color:'#006241'}}>{v}</b><div style={{fontSize:12,color:'#5b6678'}}>{t}</div></div>)}</div>
    <div className="r">
      {['puntos','calor'].map(m=><button key={m} className={'b'+(mode===m?' on':'')} onClick={()=>setMode(m)}>{m==='puntos'?'Puntos':'Mapa de calor'}</button>)}
      <select value={cat} onChange={e=>setCat(e.target.value)} style={{padding:6}}>{['Todas','Alta','Media','Baja'].map(c=><option key={c} value={c}>{c==='Todas'?'Frecuencia: todas':'Frecuencia '+c}</option>)}</select>
      <select value={dist} onChange={e=>setDist(e.target.value)} style={{padding:6}}>{Object.keys(RINGS).map(c=><option key={c} value={c}>{c==='Todas'?'Distancia: todas':c}</option>)}</select>
      <button className={'b'+(dia==='Todos'?' on':'')} onClick={()=>setDia('Todos')}>Todos los días</button>
      {DIAS.map(([k,n])=><button key={k} className={'b'+(dia===k?' on':'')} onClick={()=>setDia(k)}>{n}</button>)}
    </div>
    <div className="m">
      <div style={{position:'relative',height:'66vh',minHeight:420,borderRadius:10,overflow:'hidden',border:'1px solid #d9dfe8'}}>
        <DeckGL initialViewState={VIEW} controller layers={layers} getTooltip={({object})=>object&&{html:object.categoria?`<b>${object.nombre}</b><br>Frecuencia: ${object.categoria} (${object.valor} por semana)<br>Días: ${object.dias}<br>Distancia al HAD: ${object.km.toFixed(1)} km<br>${object.direccion}`:`<b>${object.nombre}</b>`,style:{fontSize:'12px'}}}>
          <Map mapStyle={STYLE}/>
        </DeckGL>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div className="c"><b>Carga por día</b><div style={{fontSize:12,color:'#5b6678'}}>Locales visitados. Tocá una barra para filtrar.</div>
          <div style={{display:'flex',gap:8,alignItems:'flex-end',height:110,marginTop:8}}>
            {DIAS.map(([k,n],i)=><div key={k} onClick={()=>setDia(dia===k?'Todos':k)} style={{flex:1,textAlign:'center',cursor:'pointer',fontSize:12}}>
              <div>{porDia[i]}</div><div style={{height:porDia[i]/mx*70,background:dia===k?'#006241':'#60aa78',borderRadius:4}}/>{n}</div>)}
          </div></div>
        <div className="c"><b>Locales más lejanos del HAD</b>
          {lejanos.map(r=><div key={r.nombre} style={{fontSize:13,margin:'6px 0'}}>{r.nombre}<span style={{float:'right',color:'#006241'}}>{r.km.toFixed(1)} km</span></div>)}
          {!lejanos.length&&<div style={{fontSize:13}}>Sin datos</div>}</div>
        <div className="c" style={{fontSize:12,color:'#5b6678'}}>Frecuencia: Alta = 3 visitas, Media = 2, Baja = 1 por semana. Círculos naranja: 4 y 8 km desde el HAD. Pallets estimados a razón de {PALLETS_POR_VISITA} por visita (supuesto a validar).</div>
      </div>
    </div>
    <p style={{fontSize:12,color:'#5b6678'}}>Fuente: listado de locales y frecuencias de reparto, georreferenciado con GeoRef Argentina. Datos cargados en Supabase.</p>
  </div>)
}

