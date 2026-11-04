import {createRoot} from 'react-dom/client'
import App from './App.jsx'
import Chofer from './Chofer.jsx'
import Entregas from './Entregas.jsx'
const h=location.hash
createRoot(document.getElementById('root')).render(h==='#chofer'?<Chofer/>:h==='#entregas'?<Entregas/>:<App/>)
