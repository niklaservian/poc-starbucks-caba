import {useEffect,useState} from 'react'
import {supabase} from './supabase'
import {descargar,borrar} from './remitos'

const bt={padding:'5px 10px',border:'1px solid #006241',borderRadius:6,background:'#fff',color:'#006241',cursor:'pointer',font:'inherit',fontSize:12}
const card={background:'#fff',border:'1px solid #d9dfe8',borderRadius:10,padding:'10px 14px'}
export default function Entregas(){
  const [list,setList]=useState([]),[err,setErr]=useState(null)
  useEffect(()=>{
    if(!supabase){setErr('Faltan las variables de Supabase');return}
    supabase.from('entregas').select('*').order('created_at',{ascending:false}).limit(60).then(({data,error})=>error?setErr(error.message):setList(data||[]))
    const ch=supabase.channel('entregas-vivo').on('postgres_changes',{event:'INSERT',schema:'public',table:'entregas'},p=>setList(l=>[p.new,...l])).on('postgres_changes',{event:'DELETE',schema:'public',table:'entregas'},p=>setList(l=>l.filter(x=>x.id!==p.old.id))).subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[])
  const url=p=>supabase.storage.from('remitos').getPublicUrl(p).data.publicUrl
  const porVeh={};list.forEach(e=>{porVeh[e.vehiculo]=(porVeh[e.vehiculo]||0)+1})
  return(<div style={{fontFamily:'Calibri,Arial,sans-serif',background:'#f4f6f9',minHeight:'100vh',padding:14,color:'#14213d'}}>
    <h1 style={{margin:0,fontSize:22}}><span style={{display:'inline-block',width:10,height:10,borderRadius:5,background:'#22a05a',marginRight:8}}/>Entregas confirmadas en vivo</h1>
    <p style={{margin:'2px 0 12px',color:'#5b6678',fontSize:13}}>Cada vez que un chofer sube la foto del remito, aparece acá sin recargar la página.</p>
    {err&&<p style={{color:'#b00'}}>Error: {err}</p>}
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
      <div style={card}><b style={{fontSize:26,color:'#006241'}}>{list.length}</b><div style={{fontSize:12,color:'#5b6678'}}>Entregas confirmadas</div></div>
      {Object.entries(porVeh).map(([k,n])=><div key={k} style={card}><b style={{fontSize:26,color:'#006241'}}>{n}</b><div style={{fontSize:12,color:'#5b6678'}}>Vehículo {k}</div></div>)}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:10}}>
      {list.map(e=><div key={e.id} style={card}>
        <a href={url(e.foto_path)} target="_blank" rel="noreferrer"><img src={url(e.foto_path)} alt="Remito" style={{width:'100%',height:150,objectFit:'cover',borderRadius:6}}/></a>
        <div style={{marginTop:6}}><b>{e.local_nombre}</b></div>
        <div style={{fontSize:13,color:'#5b6678'}}>Vehículo {e.vehiculo} · {e.chofer}</div>
        <div style={{fontSize:13,color:'#006241'}}>{new Date(e.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})} · {new Date(e.created_at).toLocaleDateString('es-AR')}</div>
        <div style={{display:'flex',gap:6,marginTop:8}}><button style={bt} onClick={()=>descargar(e)}>Descargar</button><button style={{...bt,borderColor:'#d73232',color:'#d73232'}} onClick={async()=>{if(await borrar(e))setList(l=>l.filter(x=>x.id!==e.id))}}>Eliminar</button></div>
      </div>)}
    </div>
    {!list.length&&!err&&<p>Todavía no hay entregas confirmadas.</p>}
  </div>)}
