const $=id=>document.getElementById(id);
const MODEL='Xenova/whisper-tiny';
let transcriber=null, cancelled=false, busy=false, currentFile='lezione';
const storageKey='trascrivi_studio_testo_v1';
$('output').value=localStorage.getItem(storageKey)||'';
$('output').addEventListener('input',save);
function save(){try{localStorage.setItem(storageKey,$('output').value);$('saved').textContent='Testo salvato su questo dispositivo.'}catch(e){$('saved').textContent='Memoria locale piena: esporta subito il TXT.'}}
function status(s){$('status').textContent=s}
function controls(){ $('start').disabled=!transcriber||busy; $('install').disabled=busy||!!transcriber; $('stop').disabled=!busy }
if('serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{});}
async function loadEngine(){if(transcriber)return;busy=true;controls();status('Caricamento del motore… La prima volta è necessaria una connessione Internet e può richiedere diversi minuti.');try{
// The import is cached by the service worker after first successful fetch.
const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
env.useBrowserCache=true;env.useWasmCache=true;
transcriber=await pipeline('automatic-speech-recognition',MODEL,{device:'wasm',dtype:'q8',progress_callback:x=>{if(x?.status==='progress'&&x?.progress!=null)status(`Scaricamento modello: ${Math.round(x.progress)}%`);}});
$('engine').textContent='Motore caricato. Fai una prova breve, poi verifica il funzionamento in modalità aereo.';status('Motore pronto.');
}catch(e){status('Non riesco a caricare il modello: '+String(e.message||e)+'\nRiprova con Internet attivo.');$('engine').textContent='Caricamento non riuscito.';}finally{busy=false;controls()}}
$('install').onclick=loadEngine;
$('stop').onclick=()=>{cancelled=true;status('Interruzione richiesta: terminerà dopo il blocco attuale.');};
$('clear').onclick=()=>{if(busy)return;if(confirm('Vuoi cancellare il testo attuale? Prima esportalo, se ti serve.')){$('output').value='';save();$('progress').value=0;}};
$('download').onclick=()=>{let text=$('output').value;if(!text.trim()){alert('Non c’è ancora testo da scaricare.');return;}let blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${currentFile.replace(/[^\wÀ-ÿ.-]+/g,'_')}-trascrizione.txt`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('output').value);status('Testo copiato.')}catch(e){status('Copia non disponibile: seleziona e copia il testo manualmente.')}};
$('start').onclick=async()=>{const file=$('file').files[0];if(!file){alert('Scegli un audio.');return}if(!transcriber){alert('Prima carica il modello.');return}
currentFile=file.name.replace(/\.[^.]+$/,'');cancelled=false;busy=true;controls();let ctx=null;
try{status('Lettura e decodifica del file audio…');const buf=await file.arrayBuffer();ctx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000});let audio=await ctx.decodeAudioData(buf);const sr=audio.sampleRate, total=audio.length, channels=audio.numberOfChannels;
// Process only 20 seconds per chunk to bound working input; the browser still decodes the full file.
const seconds=20,chunkSamples=Math.floor(sr*seconds),n=Math.ceil(total/chunkSamples);
if(audio.duration>1800 && !confirm(`L'audio dura ${Math.round(audio.duration/60)} minuti. Su iPad questa trascrizione può richiedere molto tempo e interrompersi. Continuare?`))return;
let offset=0;for(let i=0;i<n;i++){if(cancelled)break;const end=Math.min(total,offset+chunkSamples),mono=new Float32Array(end-offset);for(let c=0;c<channels;c++){const data=audio.getChannelData(c);for(let j=offset;j<end;j++)mono[j-offset]+=data[j]/channels}
let pcm=mono;if(sr!==16000){ // Linear interpolation to 16kHz: Whisper requires 16k input
const len=Math.round(mono.length*16000/sr);pcm=new Float32Array(len);for(let k=0;k<len;k++){const pos=k*sr/16000;const lo=Math.floor(pos);const frac=pos-lo;pcm[k]=mono[Math.min(lo,mono.length-1)]*(1-frac)+mono[Math.min(lo+1,mono.length-1)]*frac}}
status(`Trascrivo blocco ${i+1} di ${n} (circa ${Math.floor(offset/sr/60)} min del file). Mantieni l'app aperta.`);
const result=await transcriber(pcm,{language:'italian',task:'transcribe'});if(result?.text?.trim()){$('output').value+=($('output').value.trim()?'\n\n':'')+result.text.trim();save()}
offset=end;$('progress').value=Math.round(100*(i+1)/n);await new Promise(r=>setTimeout(r,0));}
status(cancelled?'Interrotto. Il testo finora trascritto resta disponibile: scaricalo.':'Trascrizione terminata. Controlla il testo ed esportalo.');
}catch(e){status('Elaborazione interrotta: '+String(e.message||e)+'\nIl testo già generato rimane salvato. Esportalo.')}finally{if(ctx)try{await ctx.close()}catch(e){}busy=false;controls()}};
controls();
