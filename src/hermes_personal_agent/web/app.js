let currentAudio = null;
async function playGeminiSpeech(text) {
  if (!text) return;
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const currentToken = sessionStorage.getItem('hpa-token') || localStorage.getItem('hpa-token') || (typeof token !== 'undefined' ? token : '') || '';
    const resp = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + currentToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: text.slice(0, 1500) })
    });
    if (resp.ok) {
      const blob = await resp.blob();
      const audioUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(audioUrl);
      await currentAudio.play();
    } else {
      console.warn('Gemini TTS HTTP error:', resp.status);
    }
  } catch (err) {
    console.warn('Gemini TTS playback error:', err);
  }
}
'use strict';
const $=s=>document.querySelector(s);
const tokenFromURL=new URLSearchParams(location.hash.slice(1)).get('token');
if(tokenFromURL){sessionStorage.setItem('hpa-token',tokenFromURL);localStorage.setItem('hpa-token',tokenFromURL);history.replaceState(null,'',location.pathname+location.search)}
const cookieMatch=document.cookie.match(/(?:^|; )hpa-token=([^;]+)/);
const token=sessionStorage.getItem('hpa-token')||localStorage.getItem('hpa-token')||(cookieMatch?decodeURIComponent(cookieMatch[1]):'')||'';
if(token){sessionStorage.setItem('hpa-token',token);localStorage.setItem('hpa-token',token)}
let busy=false,initialized=false,voiceActive=false,currentTab='dashboard',snapshot=null,recognition=null;
const welcomeTemplate=$('#welcome').cloneNode(true);
function notice(message,error=false){const n=$('#notice');n.textContent=message;n.classList.toggle('error',error);n.hidden=false}
async function api(path,body){const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});let result;try{result=await response.json()}catch{throw Error(response.status===413?'Fayl juda katta. 10 MB gacha fayl tanlang.':'Server javob bermadi. Panelni qayta oching.')}if(!response.ok)throw Error(result.error||'Amal bajarilmadi.');return result}
function tab(name){currentTab=name;for(const section of document.querySelectorAll('.view'))section.hidden=section.id!=='view-'+name;for(const button of document.querySelectorAll('[data-tab]')){if(button.dataset.tab===name)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')}$('#breadcrumb').textContent='Ish maydoni / '+({dashboard:'Bosh sahifa',calendar:'Kalendar',chat:'Suhbat',memory:'Bilimlarim',profile:'Menga moslashtirish',setup:'Sozlash ustasi'}[name]);if(name==='memory')loadSources();}
document.querySelectorAll('[data-tab],[data-go]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab||b.dataset.go)));
function applyTheme(theme) {
  const isLight = theme === 'light';
  document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
  try {
    localStorage.setItem('yordamchi_theme', isLight ? 'light' : 'dark');
  } catch (e) {}
  const lightBtn = document.getElementById('theme-light');
  const darkBtn = document.getElementById('theme-dark');
  if (lightBtn && darkBtn) {
    lightBtn.classList.toggle('active', isLight);
    lightBtn.setAttribute('aria-pressed', String(isLight));
    darkBtn.classList.toggle('active', !isLight);
    darkBtn.setAttribute('aria-pressed', String(!isLight));
  }
}

function initTheme() {
  let saved = 'dark';
  try {
    const stored = localStorage.getItem('yordamchi_theme');
    if (stored === 'light' || stored === 'dark') {
      saved = stored;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      saved = 'light';
    }
  } catch (e) {}
  applyTheme(saved);
  document.getElementById('theme-light')?.addEventListener('click', () => applyTheme('light'));
  document.getElementById('theme-dark')?.addEventListener('click', () => applyTheme('dark'));
}
initTheme();

document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();tab('dashboard')});
async function refresh(){try{snapshot=await api('status');$('#connection').textContent='Panel ulangan';$('#source-count').textContent=snapshot.memory.sources;$('#fact-count').textContent=snapshot.memory.facts;$('#ai-status').textContent=snapshot.hermes_installed?'Hermes topildi':'Sozlash kerak';const tg=snapshot.service.phase==='setup'?'Sozlanmoqda':snapshot.service.ready?'Ishlayapti':snapshot.service.running?'Boshlanmoqda':'To‘xtagan';$('#tg-status').textContent=tg;$('#greeting').textContent=(snapshot.profile.owner_name&&snapshot.profile.owner_name!=='Owner'?snapshot.profile.owner_name+', ':'')+'sizning rejalaringiz. Sizning bilimlaringiz. Sizning yordamchingiz.';if(!initialized){for(const [key,value]of Object.entries(snapshot.profile)){const input=$('#profile-form').elements.namedItem(key);if(input)input.value=value}initialized=true;if(!snapshot.hermes_installed)notice('Boshlash uchun profilingiz va bilimlaringizni qo‘shing. AI va Telegramni ulash: Sozlash ustasi.')}updateClock()}catch(error){$('#connection').textContent='Ulanish uzildi';notice(error.message,true)}}
function updateClock(){try{$('#clock').textContent=new Intl.DateTimeFormat('uz',{hour:'2-digit',minute:'2-digit',timeZone:snapshot?.profile.timezone||'Asia/Tashkent'}).format(new Date())}catch{$('#clock').textContent=''}}
function appendMessage(role,text){$('#welcome')?.remove();const item=document.createElement('div');item.className='message '+role;const who=document.createElement('span');who.className='who';who.textContent=role==='user'?'Siz':'Yordamchi';const content=document.createElement('div');content.textContent=text;item.append(who,content);$('#messages').append(item);$('#messages').scrollTop=$('#messages').scrollHeight;return item}
function setBusy(value){busy=value;$('#send').disabled=value;$('#reset').disabled=value;$('#chat-state').textContent=value?'Javob tayyorlanmoqda…':'Tayyor';$('#orb-status').textContent=value?'Vazifa bajarilmoqda':'Muloqot markazi';$('#orb-label').textContent=value?'Fikringizni tushunyapman.':'Siz bilan birga.';$('#messages').setAttribute('aria-busy',String(value))}
let screenStream = null;
let screenVideo = null;
let screenStreamInterval = null;
const screenBtn = $('#screen-share');
const screenText = $('#screen-share-text');
const screenIndicator = $('#screen-indicator');

function startScreenStreaming() {
  if (screenStreamInterval) clearInterval(screenStreamInterval);
  let sending = false;
  screenStreamInterval = setInterval(async () => {
    if (!screenStream || !screenStream.active || !screenVideo || !screenVideo.videoWidth || sending) return;
    try {
      sending = true;
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(screenVideo.videoWidth, 800);
      canvas.height = Math.min(screenVideo.videoHeight, 450);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        try {
          if (blob) {
            await fetch('/api/screen-frame', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'image/jpeg'
              },
              body: blob
            });
          }
        } finally {
          sending = false;
        }
      }, 'image/jpeg', 0.55);
    } catch (_) {
      sending = false;
    }
  }, 2000);
}

function stopScreenStreaming() {
  if (screenStreamInterval) {
    clearInterval(screenStreamInterval);
    screenStreamInterval = null;
  }
}

if (screenBtn) {
  screenBtn.addEventListener('click', async () => {
    if (screenStream && screenStream.active) {
      stopScreenStreaming();
      screenStream.getTracks().forEach(t => t.stop());
      screenStream = null;
      screenVideo = null;
      screenText.textContent = 'Ekranni ulash';
      screenBtn.classList.remove('active');
      if (screenIndicator) screenIndicator.hidden = true;
      notice('Ekran ulash to‘xtatildi.');
      return;
    }
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 } });
      screenVideo = document.createElement('video');
      screenVideo.srcObject = screenStream;
      screenVideo.muted = true;
      await screenVideo.play();
      startScreenStreaming();
      screenText.textContent = 'Ekranni to‘xtatish';
      screenBtn.classList.add('active');
      if (screenIndicator) screenIndicator.hidden = false;
      notice('🖥️ Ekran ulandi! Istalgan savol yozsangiz, Yordamchi ekranni ko‘rib javob beradi.');
      screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenStreaming();
        screenStream = null;
        screenVideo = null;
        screenText.textContent = 'Ekranni ulash';
        screenBtn.classList.remove('active');
        if (screenIndicator) screenIndicator.hidden = true;
      });
    } catch (err) {
      if (err.name !== 'NotAllowedError') notice('Ekran ulashda xato: ' + err.message, true);
    }
  });
}

$('#chat-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const text=$('#message').value.trim();
  if(!text||busy)return;
  appendMessage('user',text);
  $('#message').value='';
  setBusy(true);
  try{
    let payload = { text };
    if (screenStream && screenStream.active && screenVideo && screenVideo.videoWidth) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(screenVideo.videoWidth, 1280);
        canvas.height = Math.min(screenVideo.videoHeight, 720);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        payload.image = canvas.toDataURL('image/jpeg', 0.8);
      } catch (err) {
        console.error('Frame capture error', err);
      }
    }
    const result=await api('chat',payload);appendMessage('assistant',result.text||'Javob matni bo‘sh qaytdi.');if($('#speak').checked&&result.text){playGeminiSpeech(result.text)}}catch(error){notice(error.message,true);appendMessage('assistant','Javob olinmadi. Ulanish va model sozlamalarini tekshiring.')}finally{setBusy(false);refresh()}});
$('#message').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))$('#chat-form').requestSubmit()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-prompt]');if(b){$('#message').value=b.dataset.prompt;$('#message').focus()}});
$('#reset').addEventListener('click',async()=>{try{await api('reset',{});recognition?.abort();voiceActive=false;window.speechSynthesis?.cancel();if(currentAudio){currentAudio.pause();currentAudio=null;}$('#message').value='';$('#messages').replaceChildren(welcomeTemplate.cloneNode(true));$('#message').focus();notice('Yangi suhbat boshlandi. Bilimlaringiz saqlanadi.')}catch(error){notice(error.message,true)}});
async function withButton(button,operation){button.disabled=true;try{await operation()}catch(error){notice(error.message,true)}finally{button.disabled=false}}
$('#profile-form').addEventListener('submit',e=>{e.preventDefault();withButton(e.submitter,async()=>{await api('profile',Object.fromEntries(new FormData(e.target)));notice('Profil saqlandi. Yangi suhbatlarda qo‘llanadi. Telegram ovozi uchun xizmatni qayta ishga tushiring.');await refresh()})});
$('#note-form').addEventListener('submit',e=>{e.preventDefault();withButton(e.submitter,async()=>{const result=await api('note',{title:$('#note-title').value,text:$('#note-text').value});e.target.reset();notice('Xotiraga saqlandi. Manba: '+result.source_id);await loadSources();await refresh()})});
async function handleFileUpload(file){
  if(!file)return;
  if(file.size>100*1024*1024){notice('Fayl 100 MB dan kichik bo‘lsin.',true);$('#file').value='';return}
  $('#file').disabled=true;
  const label=$('#upload-label');
  if(label)label.textContent=`Yuklanmoqda: ${file.name}...`;
  notice(`⏳ "${file.name}" o‘qilmoqda va AI xotirasiga saqlanmoqda...`);
  try{
    const data=new FormData();
    data.append('file',file);
    const result=await api('upload',data);
    notice(`✅ "${file.name}" muvaffaqiyatli saqlandi! (Manba ID: ${result.source_id})`);
    await loadSources();
    await refresh()
  }catch(error){
    notice(error.message||'Faylni yuklashda xatolik yuz berdi.',true)
  }finally{
    $('#file').disabled=false;
    $('#file').value='';
    if(label)label.textContent='Faylni bu yerga tashlang yoki bosing'
  }
}
$('#file').addEventListener('change',e=>{if(e.target.files&&e.target.files[0])handleFileUpload(e.target.files[0])});
const dropzone=$('#dropzone');
if(dropzone){
  ['dragenter','dragover'].forEach(ev=>{dropzone.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();dropzone.classList.add('dragover')})});
  ['dragleave','drop'].forEach(ev=>{dropzone.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();dropzone.classList.remove('dragover')})});
  dropzone.addEventListener('drop',e=>{const files=e.dataTransfer?.files;if(files&&files.length>0)handleFileUpload(files[0])});
}
function node(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el}
async function loadSources(){try{const result=await api('sources');$('#sources').replaceChildren();if(!result.sources.length)$('#sources').append(node('p','Hozircha manba yo‘q. Birinchi qaydingizni qo‘shing.','muted'));for(const source of result.sources){const row=node('div','','source-row'),info=node('div','');info.append(node('h3',source.title),node('small',source.chars+' belgi · '+source.id));const remove=node('button','Qidiruvdan chiqarish','quiet');remove.addEventListener('click',()=>{const dialog=$('#forget-dialog');dialog.returnValue='';dialog.oncancel=()=>{dialog.returnValue='cancel'};dialog.showModal();dialog.onclose=()=>{if(dialog.returnValue==='confirm')withButton(remove,async()=>{await api('forget',{id:source.id,confirm:true});notice('Manba qidiruvdan chiqarildi. Zaxira nusxalar alohida saqlanadi.');await loadSources();refresh()})}});row.append(info,remove);$('#sources').append(row)}}catch(error){notice(error.message,true)}}
$('#refresh-sources').addEventListener('click',loadSources);
$('#search-form').addEventListener('submit',e=>{e.preventDefault();withButton(e.submitter,async()=>{const result=await api('search?q='+encodeURIComponent($('#query').value));$('#results').replaceChildren();if(!result.results.length)$('#results').append(node('p','Mos manba topilmadi. Boshqa kalit so‘z bilan izlang.','muted'));for(const r of result.results){const item=node('article','','result');item.append(node('h3',r.title),node('p',r.text),node('small',r.location+' · '+r.source_id));$('#results').append(item)}})});
const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!Speech){$('#mic').disabled=true;$('#voice-help').textContent='Bu brauzer ovozni matnga aylantirmaydi. Matn yozing yoki Chrome/Edge orqali oching.'}
else{recognition=new Speech();recognition.interimResults=true;let base='';recognition.onresult=e=>{let transcript='';for(let i=0;i<e.results.length;i++)transcript+=e.results[i][0].transcript+' ';$('#message').value=(base+transcript).slice(0,20000)};recognition.onend=()=>{voiceActive=false;$('#mic span').textContent='Gapirish';$('#mic').setAttribute('aria-pressed','false');$('#chat-state').textContent=busy?'Javob tayyorlanmoqda…':'Matnni tekshirib yuboring'};recognition.onerror=e=>notice(e.error==='not-allowed'?'Mikrofonga ruxsat berilmadi. Brauzer ruxsatini tekshiring yoki matn yozing.':'Ovoz tanilmadi. Qayta urinib ko‘ring yoki matn yozing.',true);$('#mic').addEventListener('click',()=>{if(voiceActive){recognition.stop();return}try{base=$('#message').value?$('#message').value+' ':'';recognition.lang=({uz:'uz-UZ',ru:'ru-RU',en:'en-US'}[snapshot?.profile.language]||'uz-UZ');recognition.start();voiceActive=true;$('#mic span').textContent='Tugatish';$('#mic').setAttribute('aria-pressed','true');$('#chat-state').textContent='Tinglayapman…';notice('Brauzer ovozni tanish xizmati audioni internet orqali qayta ishlashi mumkin. Matn tayyor bo‘lgach, Yuborish tugmasini bosing.')}catch{notice('Mikrofonni ishga tushirib bo‘lmadi.',true)}})}
if(!('speechSynthesis'in window)){$('#speak').disabled=true}
// A real XYZ point field, perspective-projected onto a canvas. No CDN or GPU requirement.
const canvas=$('#orb'),ctx=canvas.getContext('2d'),reduce=matchMedia('(prefers-reduced-motion: reduce)');let moving=!reduce.matches,angle=0,lastFrame=0;
const points=Array.from({length:420},(_,i)=>{const y=1-2*i/419,r=Math.sqrt(1-y*y),phi=i*Math.PI*(3-Math.sqrt(5));return{x:Math.cos(phi)*r,y,z:Math.sin(phi)*r}});
function render(t){if(!ctx)return;const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr)}ctx.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.height,cx=w/2,cy=h*.41,r=Math.min(w*.34,h*.32);ctx.clearRect(0,0,w,h);if(moving&&!document.hidden&&currentTab==='chat')angle+=Math.min(t-lastFrame,50)*(busy?.0005:.00012);lastFrame=t;
const isLight=document.documentElement.getAttribute('data-theme')==='light';
for(let ring=0;ring<3;ring++){ctx.beginPath();ctx.strokeStyle=isLight?(ring===1?'rgba(37,99,235,0.45)':'rgba(59,130,246,0.35)'):(ring===1?'#3c8d8b88':'#2c555e88');ctx.lineWidth=isLight?1.4:1;ctx.ellipse(cx,cy,r*(1.22+ring*.09),r*(.32+ring*.07),-.3+ring*.65,0,Math.PI*2);ctx.stroke()}
const rotated=points.map(p=>{const x=p.x*Math.cos(angle)-p.z*Math.sin(angle),z=p.x*Math.sin(angle)+p.z*Math.cos(angle);return{x,y:p.y*Math.cos(.25)-z*Math.sin(.25),z:p.y*Math.sin(.25)+z*Math.cos(.25)}}).sort((a,b)=>a.z-b.z);
for(const p of rotated){const perspective=3/(3-p.z*.55),alpha=.18+(p.z+1)*.32;ctx.beginPath();ctx.fillStyle=isLight?(busy?`rgba(245,158,11,${alpha})`:voiceActive?`rgba(16,185,129,${alpha})`:`rgba(37,99,235,${Math.min(1,alpha+0.2)})`):`rgba(${busy?'240,198,138':voiceActive?'184,247,232':'131,230,210'},${alpha})`;ctx.arc(cx+p.x*r*perspective,cy+p.y*r*perspective,(p.z+1)*.6+.55,0,Math.PI*2);ctx.fill()}
if(moving)requestAnimationFrame(render)}
function motionLabel(){$('#motion').textContent=moving?'Harakatni to‘xtatish':'Harakatni yoqish';$('#motion').setAttribute('aria-label',$('#motion').textContent)}
$('#motion').addEventListener('click',()=>{moving=!moving;motionLabel();if(moving)requestAnimationFrame(render)});reduce.addEventListener('change',e=>{moving=!e.matches;motionLabel();requestAnimationFrame(render)});new ResizeObserver(()=>{if(!moving)render(performance.now())}).observe(canvas);motionLabel();requestAnimationFrame(render);
refresh();setInterval(()=>{if(!document.hidden)refresh()},10000);setInterval(updateClock,30000);
