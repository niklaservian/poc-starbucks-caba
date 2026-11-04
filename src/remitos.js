import {supabase} from './supabase'

export async function descargar(e){
  const {data,error}=await supabase.storage.from('remitos').download(e.foto_path)
  if(error){alert('No se pudo descargar la foto: '+error.message);return}
  const ext=e.foto_path.split('.').pop()||'jpg',n=(e.local_nombre||'remito').replace(/[^a-z0-9]+/gi,'_')
  const a=document.createElement('a')
  a.href=URL.createObjectURL(data);a.download='remito_'+(e.fecha||'')+'_V'+e.vehiculo+'_'+n+'.'+ext
  document.body.appendChild(a);a.click();a.remove()
  setTimeout(()=>URL.revokeObjectURL(a.href),2000)
}

export async function borrar(e){
  if(!window.confirm('¿Eliminar el remito de '+e.local_nombre+'? Se borran la foto y el registro, y no se puede deshacer.'))return false
  const d=await supabase.from('entregas').delete().eq('id',e.id).select()
  if(d.error||!d.data||!d.data.length){alert('No se pudo eliminar el registro. '+(d.error?d.error.message:'Revisá que hayas ejecutado el SQL de borrado en Supabase.'));return false}
  const r=await supabase.storage.from('remitos').remove([e.foto_path])
  if(r.error||!r.data||!r.data.length)alert('Se eliminó el registro, pero la foto no se pudo borrar del almacenamiento.')
  return true
}
