import {useEffect,useMemo,useState} from 'react'
import {supabase} from './supabase'
import {simular,hm} from './sim'

const DIAS=[['L','Lun'],['M','Mar'],['X','Mié'],['J','Jue'],['V','Vie']]
const hoy=()=>new Date().toISOString().slice(0,10)
const card={background:'#fff',border:'1px solid #d9dfe8',borderRadius:10,padding:'10px 14px',margin:'8px 0'}
const btn=on=>({padding:'8px 12px',border:'1px solid #006241',borderRadius:6,background:on?'#006241':'#fff',color:on?'#fff':'#006241',cursor:'pointer',font:'inherit'})

export default function Chofer(){
  const d0='DLMXJVS'[new Date().getDay()]
  const [rows,setRows]=useState([]),[dia,setDia]=useState('LMXJV'.includes(d0)?d0:'V'),[veh,setVeh]=useState(1)
  const [chofer,setChofer]=useState(()=>{try{return localStorage.getItem('chofer')||''}catch{return ''}})
  const [hechas,setHechas]=useState({}),[msg,setMsg]=useState(''),[busy,setBusy]=useState(null)
  useEffect(()=>{if(supabase)supabase.from('puntos').select('nombre,direccion,latitud,longitud,dias').not('latitud','is',null).then(({data})=>setRows(data||[]))},[])
  const sim=useMemo(()=>simular(rows.filter(r=>(r.dias||'').split(' ').includes(dia)),'LMXJV'.indexOf(dia)+7),[rows,dia])
  const v=sim.veh.find(x=>x.id===veh)||sim.veh[0]
  useEffect(()=>{if(supabase)supabase.from('entregas').select('local_nombre').eq('fecha',hoy()).eq('dia',dia).eq('vehiculo',veh)
    .then(({data})=>setHechas(Object.fromEntries((data||[]).map(d=>[d.local_nombre,true]))))},[dia,veh])
  const subir=async(s,file)=>{
    if(!file)return
    if(!chofer.trim()){setMsg('Escribí tu nombre antes de confirmar.');return}
    setBusy(s.n.nombre);setMsg('')
    const ext=(file.type.split('/')[1]||'jpg').replace('jpeg','jpg'),path=hoy()+'/'+crypto.randomUUID()+'.'+ext
    const up=await supabase.storage.from('remitos').upload(path,file,{contentType:file.type})
    if(up.error){setMsg('No se pudo subir la foto: '+up.error.message);setBusy(null);return}
    const ins=await supabase.from('entregas').insert({fecha:hoy(),dia,vehiculo:veh,chofer:chofer.trim(),local_nombre:s.n.nombre,foto_path:path})
    setBusy(null)
    if(ins.error)setMsg('No se pudo registrar: '+ins.error.message)
    else{setHechas(h=>({...h,[s.n.nombre]:true}));setMsg('Entrega confirmada: '+s.n.nombre)}
  }
  if(!supabase)return <p style={{padding:14}}>Faltan las variables de Supabase.</p>
  return(<div style={{fontFamily:'Calibri,Arial,sans-serif',background:'#f4f6f9',minHeight:'100vh',padding:14,color:'#14213d',maxWidth:560,margin:'0 auto'}}>
    <h1 style={{margin:0,fontSize:22}}>Vista del chofer</h1>
    <p style={{margin:'2px 0 10px',color:'#5b6678',fontSize:13}}>Confirmá cada entrega sacando una foto del remito. Se ve en tiempo real en la torre de control.</p>
    <div style={card}>
      <label style={{fontSize:12,color:'#5b6678'}}>Tu nombre</label>
      <input value={chofer} onChange={e=>{setChofer(e.target.value);try{localStorage.setItem('chofer',e.target.value)}catch{}}} placeholder="Nombre del chofer" style={{width:'100%',padding:8,margin:'4px 0 10px',boxSizing:'border-box',font:'inherit'}}/>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>{DIAS.map(([k,n])=><button key={k} style={btn(dia===k)} onClick={()=>{setDia(k);setVeh(1)}}>{n}</button>)}</div>
      <label style={{fontSize:12,color:'#5b6678'}}>Vehículo</label>
      <select value={veh} onChange={e=>setVeh(+e.target.value)} style={{width:'100%',padding:8,font:'inherit'}}>{sim.veh.map(x=><option key={x.id} value={x.id}>Vehículo {x.id} ({x.plan.stops.length} paradas)</option>)}</select>
    </div>
    {msg&&<div style={{...card,borderLeft:'4px solid #006241'}}>{msg}</div>}
    {v&&v.plan.stops.map((s,i)=><div key={s.n.nombre} style={card}>
      <b>{i+1}. {s.n.nombre}</b><div style={{fontSize:13,color:'#5b6678'}}>{s.n.direccion}</div>
      <div style={{fontSize:13,margin:'4px 0 8px'}}>Llegada prevista: {hm(s.t)}</div>
      <label style={{...btn(!!hechas[s.n.nombre]),display:'block',textAlign:'center'}}>
        {busy===s.n.nombre?'Subiendo...':hechas[s.n.nombre]?'Confirmada ✓ (tocá para cambiar la foto)':'Confirmar con foto del remito'}
        <input type="file" accept="image/*" capture="environment" style={{display:'none'}} disabled={busy!==null} onChange={e=>{subir(s,e.target.files[0]);e.target.value=''}}/>
      </label></div>)}
    {!rows.length&&<p>Cargando locales...</p>}
  </div>)}
