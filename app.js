const CARDS = {
  A01:{name:'Nguồn 3V',short:'3V',kind:'source',value:3},
  A02:{name:'Nguồn 5V',short:'5V',kind:'source',value:5},
  A03:{name:'Nguồn 6V',short:'6V',kind:'source',value:6},
  A04:{name:'Điện trở 1kΩ',short:'R1k',kind:'resistor',value:1000},
  A05:{name:'Điện trở 2kΩ',short:'R2k',kind:'resistor',value:2000},
  A06:{name:'Điện trở 3kΩ',short:'R3k',kind:'resistor',value:3000},
  A07:{name:'Điện trở 5kΩ',short:'R5k',kind:'resistor',value:5000},
  A08:{name:'Đèn 3V',short:'L3V',kind:'lamp',value:3000,ratedV:3,ratedI:.001},
  A09:{name:'Đèn 5V',short:'L5V',kind:'lamp',value:5000,ratedV:5,ratedI:.001},
  A10:{name:'Đèn 6V',short:'L6V',kind:'lamp',value:6000,ratedV:6,ratedI:.001},
  A11:{name:'Dây dẫn',short:'DÂY',kind:'wire'},
  A12:{name:'Dây dẫn chữ L',short:'DÂY L',kind:'wire'},
  A13:{name:'Dây dẫn chữ T',short:'DÂY T',kind:'wire'},
  A14:{name:'Ampe kế',short:'A',kind:'ammeter'},
  A15:{name:'Vôn kế',short:'V',kind:'voltmeter'}
};

const MAX_COUNTS={A01:2,A02:2,A03:2,A04:2,A05:2,A06:2,A07:2,A08:2,A09:2,A10:2,A11:9,A12:4,A13:5,A14:1,A15:1};
const SOURCE_IDS=['A01','A02','A03'];
const RESISTOR_IDS=['A04','A05','A06','A07'];
const LAMP_IDS=['A08','A09','A10'];
const WIRE_IDS=['A11','A12','A13'];
const METER_IDS=['A14','A15'];
const LOAD_IDS=[...RESISTOR_IDS,...LAMP_IDS];
const ALL_IDS=Object.keys(CARDS);
const DIFF={EASY:'DỄ',MEDIUM:'TRUNG BÌNH',HARD:'KHÓ'};

const $=s=>document.querySelector(s);
const board=Object.fromEntries(Array.from({length:25},(_,i)=>[i+1,'EMPTY']));
let selectedMode='EASY';
let selectedCard=null;
let selectedCell=null;
let mission=null;
let recentSignatures=[];

const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const choice=a=>a[Math.floor(Math.random()*a.length)];
const fmt=n=>Math.abs(n-Math.round(n))<1e-9?String(Math.round(n)):Number(n.toFixed(3)).toString();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function countCard(id){return Object.values(board).filter(x=>x===id).length;}
function countByKind(ids){return ids.reduce((s,id)=>s+countCard(id),0);}
function resistance(id){return CARDS[id]?.value||0;}
function voltage(id){return CARDS[id]?.kind==='source'?CARDS[id].value:0;}
function seriesR(vals){return vals.reduce((a,b)=>a+b,0);}
function parallelR(vals){const p=vals.filter(v=>v>0);return p.length?1/p.reduce((a,b)=>a+1/b,0):0;}
function exactCounts(cards){const o={};for(const c of cards)o[c]=(o[c]||0)+1;return o;}
function sampleNoReplacement(ids,n){const x=[...ids];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x.slice(0,n);}
function enoughFor(cards){const c=exactCounts(cards);return Object.entries(c).every(([id,n])=>n<=MAX_COUNTS[id]);}
function contains(a,x){return a.includes(x);}
function lampResistanceNote(){return 'Đèn: 3V = 3kΩ; 5V = 5kΩ; 6V = 6kΩ.';}

function sourceBankVoltage(sources,conn){
  if(!sources.length)return [0,false];
  if(conn==='SERIES')return [sources.reduce((s,x)=>s+voltage(x),0),true];
  const v=voltage(sources[0]);
  const ok=sources.every(x=>Math.abs(voltage(x)-v)<1e-9);
  return [ok?v:0,ok];
}

function calcCurrent(sources,sConn,loads,lConn){
  const [V,ok]=sourceBankVoltage(sources,sConn);
  const rs=loads.map(resistance).filter(x=>x>0);
  if(!ok||!rs.length)return [0,false];
  const total=lConn==='SERIES'?seriesR(rs):parallelR(rs);
  return [total>0?V/total:0,total>0];
}

function calcVoltage(sources,sConn,loads,lConn,target){
  if(!loads.includes(target))return [0,false];
  const [V,ok]=sourceBankVoltage(sources,sConn);
  if(!ok)return [0,false];
  const R=resistance(target);if(R<=0)return [0,false];
  if(lConn==='PARALLEL')return [V,true];
  const total=seriesR(loads.map(resistance));
  return total>0?[V*R/total,true]:[0,false];
}

function beautifulCurrent(current){
  if(current<=0)return null;
  const mA=current*1000;
  const rounded=Math.round(mA*10)/10;
  if(rounded>=0.1&&rounded<=100&&Math.abs(mA-rounded)<1e-7)return {display:rounded,unit:'mA'};
  return null;
}

function beautifulVoltage(value){
  if(value<=0)return null;
  const rounded=Math.round(value*10)/10;
  if(Math.abs(value-rounded)<1e-7)return {display:rounded,unit:'V'};
  return null;
}

function randomSourceCard(){return choice(SOURCE_IDS);}
function randomUniqueResistor(used){
  const options=sampleNoReplacement(RESISTOR_IDS,RESISTOR_IDS.length);
  return options.find(x=>!used.includes(x))||'A04';
}
function randomUniqueLamp(used){
  const options=sampleNoReplacement(LAMP_IDS,LAMP_IDS.length);
  return options.find(x=>!used.includes(x))||'A08';
}
function randomLoads(maxR,maxL,minTotal=1){
  let r,l;
  do{r=rnd(0,maxR);l=rnd(0,maxL);}while(r+l<minTotal);
  const used=[];
  const loads=[];
  for(let i=0;i<r;i++){const x=randomUniqueResistor(used);used.push(x);loads.push(x);}
  for(let i=0;i<l;i++){const x=randomUniqueLamp(used);used.push(x);loads.push(x);}
  return loads;
}

function randomSourceBank(count,connection){
  if(connection==='PARALLEL'){
    const actual=Math.min(count,2);
    const one=randomSourceCard();
    return Array(actual).fill(one);
  }
  return sampleNoReplacement(['A01','A01','A02','A02','A03','A03'],count);
}

function clearMissionFields(){
  return {
    exactCards:{},sourceMin:1,sourceMax:1,resistorMin:0,resistorMax:0,
    lampMin:0,lampMax:0,totalMin:0,totalMax:0,sourceRequired:'',
    sourceConnection:'SERIES',loadConnection:'SERIES',measure:'',meter:'',
    target:'NONE',anyLoadVoltage:false,answer:0,displayAnswer:0,answerUnit:'',
    mode:'BUILD',difficulty:selectedMode,title:'',requirement:'',parts:[]
  };
}

function makeBuild(difficultyLevel){
  const m=clearMissionFields();
  m.mode='BUILD';m.difficulty=selectedMode;
  const sourceMax=difficultyLevel===2?3:5;
  const sourceMin=difficultyLevel===2?1:2;
  const sourceCount=rnd(sourceMin,sourceMax);
  m.sourceConnection='SERIES';
  if(difficultyLevel===3&&sourceCount===2&&rnd(0,1)===1)m.sourceConnection='PARALLEL';
  const sources=randomSourceBank(sourceCount,m.sourceConnection);
  for(const s of sources)m.exactCards[s]=(m.exactCards[s]||0)+1;

  const rMax=difficultyLevel===2?3:4;
  const lMax=difficultyLevel===2?2:3;
  let r,l;
  do{r=rnd(0,rMax);l=rnd(0,lMax);}while(difficultyLevel===2?r+l===0:r+l<3);
  const used=[];
  for(let i=0;i<r;i++){const x=randomUniqueResistor(used);used.push(x);m.exactCards[x]=(m.exactCards[x]||0)+1;}
  for(let i=0;i<l;i++){const x=randomUniqueLamp(used);used.push(x);m.exactCards[x]=(m.exactCards[x]||0)+1;}
  m.loadConnection=difficultyLevel===2?'SERIES':choice(['SERIES','PARALLEL']);
  m.title=difficultyLevel===2?'MẠCH TRUNG BÌNH':'MẠCH KHÓ';
  m.requirement=difficultyLevel===2?'Lắp đủ các thẻ yêu cầu và mắc đúng kiểu mạch.':'Lắp đủ các thẻ yêu cầu, tạo mạch nhiều tải và mắc đúng kiểu mạch.';
  m.parts=Object.entries(m.exactCards).filter(([,n])=>n>0).map(([id,n])=>({id,count:n}));
  return m;
}

function makeEasyBuild(){
  const m=clearMissionFields();m.mode='BUILD';m.difficulty='EASY';
  const source=randomSourceCard();m.exactCards[source]=1;
  let r=rnd(0,2),l=rnd(0,1);while(r+l===0){r=rnd(0,2);l=rnd(0,1);}
  const used=[];
  for(let i=0;i<r;i++){const x=randomUniqueResistor(used);used.push(x);m.exactCards[x]=(m.exactCards[x]||0)+1;}
  for(let i=0;i<l;i++){const x=randomUniqueLamp(used);used.push(x);m.exactCards[x]=(m.exactCards[x]||0)+1;}
  m.loadConnection='SERIES';m.title='NHIỆM VỤ DỄ';
  m.requirement='Lắp đúng các linh kiện được yêu cầu và mắc nối tiếp.';
  m.parts=Object.entries(m.exactCards).filter(([,n])=>n>0).map(([id,n])=>({id,count:n}));
  return m;
}

function makeEasyTarget(){
  const attempts=7000;
  let fallback=null;
  for(let i=0;i<attempts;i++){
    const source=randomSourceCard();
    const r=rnd(0,2),l=rnd(0,1);
    if(r+l===0)continue;
    const used=[];const loads=[];
    for(let j=0;j<r;j++){const x=randomUniqueResistor(used);used.push(x);loads.push(x);}
    for(let j=0;j<l;j++){const x=randomUniqueLamp(used);used.push(x);loads.push(x);}
    const [value,ok]=calcCurrent([source],'SERIES',loads,'SERIES');
    const pretty=ok?beautifulCurrent(value):null;if(!pretty)continue;
    const m=clearMissionFields();m.mode='TARGET';m.difficulty='EASY';m.title='ĐẠT DÒNG ĐIỆN MỤC TIÊU';
    m.sourceMin=1;m.sourceMax=1;m.sourceRequired=source;
    m.resistorMin=r;m.resistorMax=r;m.lampMin=l;m.lampMax=l;m.totalMin=r+l;m.totalMax=r+l;
    m.sourceConnection='SERIES';m.loadConnection='SERIES';m.measure='CURRENT';m.answer=value;m.displayAnswer=pretty.display;m.answerUnit=pretty.unit;
    m.requirement='Người chơi tự chọn giá trị điện trở/đèn trong đúng số lượng yêu cầu.';
    m.parts=[];return m;
  }
  const source='A02',loads=['A05','A07','A08'];
  const [value]=calcCurrent([source],'SERIES',loads,'SERIES');
  const pretty=beautifulCurrent(value)||{display:value*1000,unit:'mA'};
  const m=clearMissionFields();m.mode='TARGET';m.difficulty='EASY';m.title='ĐẠT DÒNG ĐIỆN MỤC TIÊU';
  m.sourceMin=1;m.sourceMax=1;m.sourceRequired=source;m.resistorMin=2;m.resistorMax=2;m.lampMin=1;m.lampMax=1;m.totalMin=3;m.totalMax=3;
  m.sourceConnection='SERIES';m.loadConnection='SERIES';m.measure='CURRENT';m.answer=value;m.displayAnswer=pretty.display;m.answerUnit=pretty.unit;
  return m;
}

function makeTarget({difficulty,sourceMin,sourceMax,resistorMax,lampMax,totalMin,forceMeasure=null,hard=false}){
  for(let attempt=0;attempt<26000;attempt++){
    const sourceCount=rnd(sourceMin,sourceMax);
    let sourceConnection=(sourceCount<=2&&rnd(0,1)===1)?'PARALLEL':'SERIES';
    if(hard&&sourceCount>2)sourceConnection='SERIES';
    const sources=randomSourceBank(sourceCount,sourceConnection);
    const loads=randomLoads(resistorMax,lampMax,totalMin);
    let loadConnection=choice(['SERIES','PARALLEL']);
    let measure=forceMeasure||choice(['CURRENT','VOLTAGE']);
    let target='NONE';let anyLoadVoltage=false;let value=0;let pretty=null;let ok=false;

    if(measure==='CURRENT'){
      [value,ok]=calcCurrent(sources,sourceConnection,loads,loadConnection);
      if(!ok)continue;pretty=beautifulCurrent(value);if(!pretty)continue;
    }else{
      anyLoadVoltage=true;
      target='NONE';
      const generatedVoltageCard=choice(loads);
      if(hard){loadConnection='SERIES';}
      [value,ok]=calcVoltage(sources,sourceConnection,loads,loadConnection,generatedVoltageCard);
      if(!ok)continue;pretty=beautifulVoltage(value);if(!pretty)continue;
    }

    if(!enoughFor([...sources,...loads]))continue;
    const m=clearMissionFields();m.mode='TARGET';m.difficulty=difficulty;
    m.measure=measure;m.answer=value;m.displayAnswer=pretty.display;m.answerUnit=pretty.unit;
    m.sourceConnection=sourceConnection;m.loadConnection=loadConnection;m.target=target;m.anyLoadVoltage=anyLoadVoltage;
    m.sourceMin=sourceMin;m.sourceMax=sourceMax;m.resistorMin=0;m.resistorMax=resistorMax;m.lampMin=0;m.lampMax=lampMax;
    m.totalMin=totalMin;m.totalMax=resistorMax+lampMax;
    m.title=measure==='CURRENT'?(difficulty==='HARD'?'MẠCH KHÓ - ĐẠT DÒNG':'ĐẠT DÒNG ĐIỆN MỤC TIÊU'):(difficulty==='HARD'?'MẠCH KHÓ - ĐẠT ĐIỆN ÁP':'ĐẠT ĐIỆN ÁP MỤC TIÊU');
    return m;
  }
  return null;
}

function makeMeter({difficulty,sourceMin,sourceMax,resistorMax,lampMax,totalMin,hard=false}){
  for(let attempt=0;attempt<24000;attempt++){
    const sourceCount=rnd(sourceMin,sourceMax);
    let sourceConnection=(sourceCount<=2&&rnd(0,1)===1)?'PARALLEL':'SERIES';
    if(hard)sourceConnection='SERIES';
    const sources=randomSourceBank(sourceCount,sourceConnection);
    const loads=randomLoads(resistorMax,lampMax,totalMin);
    let loadConnection=choice(['SERIES','PARALLEL']);
    const meter=choice(['A14','A15']);
    let target='NONE';let value=0;let pretty=null;let ok=false;
    if(meter==='A14'){
      [value,ok]=calcCurrent(sources,sourceConnection,loads,loadConnection);
      if(!ok)continue;pretty=beautifulCurrent(value);if(!pretty)continue;
    }else{
      target=choice(loads);
      loadConnection='SERIES';
      [value,ok]=calcVoltage(sources,sourceConnection,loads,'SERIES',target);
      if(!ok)continue;pretty=beautifulVoltage(value);if(!pretty)continue;
    }
    if(!enoughFor([...sources,...loads]))continue;
    const m=clearMissionFields();m.mode='METER';m.difficulty=difficulty;m.meter=meter;m.target=target;
    m.measure=meter==='A14'?'CURRENT':'VOLTAGE';m.answer=value;m.displayAnswer=pretty.display;m.answerUnit=pretty.unit;
    m.sourceConnection=sourceConnection;m.loadConnection=loadConnection;m.sourceMin=sourceMin;m.sourceMax=sourceMax;
    m.resistorMin=0;m.resistorMax=resistorMax;m.lampMin=0;m.lampMax=lampMax;m.totalMin=totalMin;m.totalMax=resistorMax+lampMax;
    m.title=difficulty==='HARD'?(meter==='A14'?'MẠCH KHÓ - AMPE KẾ':'MẠCH KHÓ - VÔN KẾ'):(meter==='A14'?'AMPE KẾ':'VÔN KẾ');
    return m;
  }
  return null;
}

function buildMission(){
  let m=null;
  if(selectedMode==='EASY'){
    m=Math.random()<0.5?makeEasyBuild():makeEasyTarget();
  }else if(selectedMode==='MEDIUM'){
    const t=rnd(0,2);
    if(t===0)m=makeBuild(2);
    else if(t===1)m=makeTarget({difficulty:'MEDIUM',sourceMin:1,sourceMax:3,resistorMax:3,lampMax:2,totalMin:1,forceMeasure:'CURRENT'});
    else m=makeMeter({difficulty:'MEDIUM',sourceMin:2,sourceMax:3,resistorMax:4,lampMax:3,totalMin:1});
  }else{
    const t=rnd(0,2);
    if(t===0)m=makeBuild(3);
    else if(t===1)m=makeTarget({difficulty:'HARD',sourceMin:2,sourceMax:5,resistorMax:4,lampMax:3,totalMin:3,hard:true});
    else m=makeMeter({difficulty:'HARD',sourceMin:3,sourceMax:6,resistorMax:4,lampMax:3,totalMin:3,hard:true});
  }
  if(!m)return null;
  if(m.mode!=='BUILD'){
    m.requirement=buildReadableRequirement(m);
    if(m.mode==='METER'&&m.meter)m.parts=[{id:m.meter,count:1}];
    else m.parts=[];
  }
  return m;
}

function rangeText(min,max,singular,plural=singular){return min===max?`${min} ${min===1?singular:plural}`:`${min}–${max} ${plural}`;}
function buildReadableRequirement(m){
  const parts=[];
  if(m.sourceRequired)parts.push(`Bắt buộc: ${CARDS[m.sourceRequired].name}.`);
  else parts.push(`Nguồn: ${rangeText(m.sourceMin,m.sourceMax,'nguồn')}.`);
  if(m.resistorMax>0)parts.push(`Điện trở: ${rangeText(m.resistorMin,m.resistorMax,'điện trở')}.`);
  if(m.lampMax>0)parts.push(`Đèn: ${rangeText(m.lampMin,m.lampMax,'đèn')}.`);
  parts.push(lampResistanceNote());
  if(m.mode==='TARGET'&&m.measure==='VOLTAGE'&&m.anyLoadVoltage)parts.push('Tự chọn 1 điện trở hoặc đèn để đạt điện áp mục tiêu.');
  if(m.mode==='METER'&&m.meter==='A15')parts.push(`Dùng Vôn kế đo ${m.target!=='NONE'?CARDS[m.target].name:'một tải'}.`);
  if(m.mode==='METER'&&m.meter==='A14')parts.push('Dùng Ampe kế đo dòng toàn mạch.');
  if(m.measure==='CURRENT')parts.push('Tự chọn giá trị tải trong giới hạn trên.');
  return parts.join(' ');
}

function missionSignature(m){return JSON.stringify({mode:m.mode,d:m.difficulty,sc:m.sourceMin,sx:m.sourceMax,rc:m.resistorMin,rx:m.resistorMax,lc:m.lampMin,lx:m.lampMax,tot:m.totalMin,tm:m.measure,meter:m.meter,src:m.sourceRequired,srcConn:m.sourceConnection,load:m.loadConnection,ans:Math.round(m.displayAnswer*10)/10,unit:m.answerUnit,exact:m.exactCards});}
function isRecent(m){const s=missionSignature(m);return recentSignatures.includes(s);}
function remember(m){const s=missionSignature(m);recentSignatures.push(s);if(recentSignatures.length>10)recentSignatures.shift();}

function formatMission(){
  const box=$('#missionBox');
  if(!mission){box.innerHTML='<div class="empty-title">CHƯA CÓ NHIỆM VỤ</div><div class="muted">Chọn DỄ / TRUNG BÌNH / KHÓ rồi bấm TẠO NHIỆM VỤ.</div>';return;}
  const mode=mission.mode==='BUILD'?'LẮP MẠCH':mission.mode==='TARGET'?'ĐẠT MỤC TIÊU':'ĐO GIÁ TRỊ';
  const loadConn=mission.loadConnection==='PARALLEL'?'SONG SONG':'NỐI TIẾP';
  const sourceConn=mission.sourceConnection==='PARALLEL'?'SONG SONG':'NỐI TIẾP';
  let html=`<div class="mission-top"><div><div class="mission-title">${mission.title}</div><div class="muted">${mode}</div></div><div class="difficulty-tag">${DIFF[mission.difficulty]}</div></div>`;
  html+='<div class="mission-summary">';
  if(mission.mode==='BUILD'){
    html+='<div class="mission-block"><div class="label">LINH KIỆN PHẢI DÙNG</div><div class="parts">';
    for(const p of mission.parts)html+=`<div class="part-row"><span class="part-name">${CARDS[p.id].name}</span><span class="part-count">× ${p.count}</span></div>`;
    html+='</div></div>';
    html+=`<div class="mission-block"><div class="label">CÁCH MẮC TẢI</div><div class="value">${loadConn}</div></div>`;
    html+=`<div class="mission-block"><div class="label">CÁCH MẮC NGUỒN</div><div class="value">${sourceConn}</div></div>`;
    html+=`<div class="mission-block"><div class="label">YÊU CẦU</div><div class="value">${mission.requirement}</div></div>`;
  }else{
    html+=`<div class="mission-block"><div class="label">CẦN DÙNG</div><div class="value">${buildReadableRequirement(mission)}</div></div>`;
    html+=`<div class="mission-block"><div class="label">MẮC NGUỒN</div><div class="value">${sourceConn}</div></div>`;
    html+=`<div class="mission-block"><div class="label">MẮC TẢI</div><div class="value">${loadConn}</div></div>`;
    if(mission.meter)html+=`<div class="mission-block"><div class="label">DỤNG CỤ ĐO</div><div class="value">${CARDS[mission.meter].name}</div></div>`;
    if(mission.target&&mission.target!=='NONE'&&mission.measure==='VOLTAGE')html+=`<div class="mission-block"><div class="label">ĐỐI TƯỢNG ĐO</div><div class="value">${CARDS[mission.target].name}</div></div>`;
  }
  html+='</div>';
  if(mission.mode!=='BUILD'){
    const prefix=mission.measure==='CURRENT'?'I':'U';
    html+=`<div class="goal-box"><div class="goal-label">MỤC TIÊU</div><div class="goal-value">${prefix} = ${fmt(mission.displayAnswer)} ${mission.answerUnit}</div></div>`;
  }else{
    html+='<div class="goal-box"><div class="goal-label">MỤC TIÊU</div><div class="goal-value" style="font-size:19px">LẮP ĐÚNG MẠCH</div></div>';
  }
  box.innerHTML=html;
}

function getImagePath(id){return `assets/cards/${id}.png`;}

function wireDirs(cell,id){
  const dirs=new Set();
  for(const n of neighbors(cell)){if(board[n]==='EMPTY')continue;dirs.add(direction(cell,n));}
  if(id==='A11'){
    if(dirs.has('N')&&dirs.has('S'))return new Set(['N','S']);
    if(dirs.has('E')&&dirs.has('W'))return new Set(['E','W']);
  }
  return dirs;
}
function hasPair(dirs,a,b){return dirs.has(a)&&dirs.has(b);}
function wireValid(id,dirs){
  if(id==='A11')return dirs.size===2&&(hasPair(dirs,'N','S')||hasPair(dirs,'E','W'));
  if(id==='A12')return dirs.size===2&&(hasPair(dirs,'N','E')||hasPair(dirs,'E','S')||hasPair(dirs,'S','W')||hasPair(dirs,'W','N'));
  if(id==='A13')return dirs.size===3;
  return true;
}
function wireSvg(id,dirs=new Set(),boardMode=false){
  let ports=new Set(dirs);
  if(!boardMode){
    if(id==='A11')ports=new Set(['E','W']);
    else if(id==='A12')ports=new Set(['N','E']);
    else if(id==='A13')ports=new Set(['N','E','W']);
  }
  const pos={N:[50,9],E:[91,50],S:[50,91],W:[9,50]};
  let lines='';for(const d of ports){const [x,y]=pos[d];lines+=`<line class="wire-line" x1="50" y1="50" x2="${x}" y2="${y}"/>`;}
  let dots='';for(const d of ports){const [x,y]=pos[d];dots+=`<circle class="wire-port" cx="${x}" cy="${y}" r="4"/>`;}
  const invalid=boardMode&&!wireValid(id,ports)?'<circle class="wire-invalid" cx="50" cy="50" r="43"/>':'';
  return `<svg class="wire-svg ${boardMode?'board-wire':''}" viewBox="0 0 100 100" role="img" aria-label="${CARDS[id].name}">${lines}<circle class="wire-center" cx="50" cy="50" r="5"/>${dots}${invalid}</svg>`;
}
function imageOrFallback(id,boardMode=false){
  if(WIRE_IDS.includes(id))return wireSvg(id,boardMode?wireDirs(boardCellContext,id):new Set(),boardMode);
  return `<img src="${getImagePath(id)}" alt="${CARDS[id].name}" onerror="this.style.display='none';this.nextElementSibling.nextElementSibling.style.display='block'"/><div class="asset-missing" style="display:none">Ảnh ${id}.png<br>chưa được thêm</div><div class="art-fallback">${CARDS[id].short}</div>`;
}
// boardCellContext is set immediately before rendering an individual board cell.
let boardCellContext=0;

function renderInventory(){
  let html='';
  for(const id of ALL_IDS){
    const remaining=MAX_COUNTS[id]-countCard(id);
    const disabled=remaining<=0;
    const selected=selectedCard===id;
    html+=`<button class="card-btn ${selected?'selected':''}" data-card="${id}" ${disabled?'disabled':''}>
      <div class="card-art">${imageOrFallback(id,false)}</div>
      <div class="card-copy"><div class="card-name">${CARDS[id].name}</div><div class="card-meta"><span>${CARDS[id].short}</span><span class="stock ${disabled?'empty':''}">${remaining}/${MAX_COUNTS[id]}</span></div></div>
    </button>`;
  }
  $('#inventory').innerHTML=html;
  document.querySelectorAll('.card-btn').forEach(btn=>btn.addEventListener('click',()=>selectCard(btn.dataset.card)));
}

function kindOf(id){return id==='EMPTY'?'':CARDS[id]?.kind||'';}
function renderBoard(){
  const el=$('#board');el.innerHTML='';
  for(let cell=1;cell<=25;cell++){
    const id=board[cell];
    const b=document.createElement('button');
    const invalid=WIRE_IDS.includes(id)&&!wireValid(id,wireDirs(cell,id));
    b.className='cell '+(id==='EMPTY'?'empty ':'')+(selectedCell===cell?'selected ':'')+(invalid?'invalid':'');
    b.dataset.kind=kindOf(id);b.dataset.cell=cell;
    if(id==='EMPTY'){
      b.innerHTML=`<span class="cell-num">Ô ${String(cell).padStart(2,'0')}</span><span class="cell-code">＋</span><span class="cell-name">TRỐNG</span>`;
    }else{
      boardCellContext=cell;
      let artHtml='';
      if(WIRE_IDS.includes(id))artHtml=wireSvg(id,wireDirs(cell,id),true);
      else artHtml=`<img src="${getImagePath(id)}" alt="${CARDS[id].name}" onerror="this.style.display='none';this.nextElementSibling.nextElementSibling.style.display='block'"/><div class="asset-missing" style="display:none">Ảnh ${id}.png<br>chưa thêm</div><div class="art-fallback">${CARDS[id].short}</div>`;
      b.innerHTML=`<span class="cell-num">Ô ${String(cell).padStart(2,'0')}</span>${selectedCell===cell?'<span class="selection-badge">ĐANG CHỌN</span>':''}<div class="board-art">${artHtml}</div><span class="cell-name">${CARDS[id].name}</span>`;
    }
    b.addEventListener('click',()=>handleCellClick(cell));
    el.appendChild(b);
  }
}

function updateHints(){
  $('#selectionHint').textContent=selectedCard?`Đang chọn: ${CARDS[selectedCard].name} • chạm ô trống để đặt.`:selectedCell?`Đang chọn thẻ ở ô ${selectedCell} • bấm GỠ THẺ để tháo.`:'Chưa chọn linh kiện.';
  $('#boardHint').textContent=selectedCard?'Ô trống: đặt thẻ • Ô đã có thẻ: chọn thẻ đó để gỡ.':'Chạm linh kiện trong kho để chọn • chạm thẻ trên bàn để chọn thẻ muốn gỡ.';
  $('#removeBtn').disabled=!(selectedCell&&board[selectedCell]!=='EMPTY');
  $('#clearSelectionBtn').disabled=!(selectedCard||selectedCell);
}
function renderAll(){renderInventory();renderBoard();updateHints();}

function selectCard(id){
  if(MAX_COUNTS[id]-countCard(id)<=0)return;
  selectedCard=selectedCard===id?null:id;
  selectedCell=null;
  setResult('neutral',selectedCard?`Đã chọn ${CARDS[id].name}. Chạm một ô trống để đặt.`:'Đã bỏ chọn linh kiện.');
  renderAll();
}
function handleCellClick(cell){
  if(board[cell]==='EMPTY'&&selectedCard){
    board[cell]=selectedCard;selectedCard=null;selectedCell=cell;
    setResult('neutral',`Đã đặt ${CARDS[board[cell]].name} vào ô ${cell}.`);
    renderAll();return;
  }
  if(board[cell]!=='EMPTY'){
    selectedCell=cell;selectedCard=null;
    setResult('neutral',`Đã chọn thẻ ở ô ${cell}. Bấm GỠ THẺ để tháo.`);
    renderAll();return;
  }
  selectedCell=cell;renderAll();
}
function removeSelected(){
  if(!selectedCell||board[selectedCell]==='EMPTY'){setResult('warn','Hãy chạm vào một thẻ đã đặt trên bàn trước.');return;}
  const removed=board[selectedCell];board[selectedCell]='EMPTY';selectedCell=null;
  setResult('neutral',`Đã gỡ ${CARDS[removed].name}. Thẻ đã trở lại kho.`);renderAll();
}
function clearSelection(){selectedCard=null;selectedCell=null;renderAll();}
function clearBoard(){for(let i=1;i<=25;i++)board[i]='EMPTY';selectedCard=null;selectedCell=null;renderAll();}

function neighbors(cell){
  const r=Math.floor((cell-1)/5),c=(cell-1)%5,n=[];
  if(r>0)n.push(cell-5);if(c<4)n.push(cell+1);if(r<4)n.push(cell+5);if(c>0)n.push(cell-1);
  return n;
}
function direction(a,b){
  const r1=Math.floor((a-1)/5),c1=(a-1)%5,r2=Math.floor((b-1)/5),c2=(b-1)%5;
  if(r2===r1-1)return'N';if(c2===c1+1)return'E';if(r2===r1+1)return'S';if(c2===c1-1)return'W';return'?';
}
function buildGraph(){
  const g=Object.fromEntries(Array.from({length:26},(_,i)=>[i,new Set()]));const errors=[];
  for(let c=1;c<=25;c++)if(WIRE_IDS.includes(board[c])){const d=wireDirs(c,board[c]);if(!wireValid(board[c],d))errors.push(wireError(c,board[c]));}
  for(let c=1;c<=25;c++){
    if(board[c]==='EMPTY')continue;
    for(const n of neighbors(c)){
      if(c>=n||board[n]==='EMPTY')continue;
      const d1=direction(c,n),d2=direction(n,c);let p1=true,p2=true;
      if(WIRE_IDS.includes(board[c]))p1=wireDirs(c,board[c]).has(d1);
      if(WIRE_IDS.includes(board[n]))p2=wireDirs(n,board[n]).has(d2);
      if(p1&&p2){g[c].add(n);g[n].add(c);}
    }
  }
  return {g,errors};
}
function connectedGroups(g){
  const seen=new Set();let groups=0;
  for(let start=1;start<=25;start++){
    if(board[start]==='EMPTY'||seen.has(start))continue;groups++;const st=[start];seen.add(start);
    while(st.length){const c=st.pop();for(const n of g[c])if(!seen.has(n)){seen.add(n);st.push(n);}}
  }
  return groups;
}
function degree(g,c){return g[c].size;}
function wireError(cell,id){
  if(id==='A11')return`Ô ${cell} DÂY THẲNG phải có 2 đầu đối diện (N–S hoặc E–W).`;
  if(id==='A12')return`Ô ${cell} DÂY L phải có đúng 2 đầu vuông góc.`;
  return`Ô ${cell} DÂY T phải có đúng 3 nhánh.`;
}

function componentCheck(){
  if(!mission)return[false,'Chưa có nhiệm vụ.'];
  if(mission.mode==='BUILD'){
    for(const id of [...SOURCE_IDS,...RESISTOR_IDS,...LAMP_IDS,...METER_IDS]){
      const actual=countCard(id),need=mission.exactCards?.[id]||0;
      if(actual!==need)return[false,need===0&&actual>0?`Thừa ${CARDS[id].name}.`:`Sai số lượng ${CARDS[id].name} (${actual}/${need}).`];
    }
  }else{
    const sc=countByKind(SOURCE_IDS),rc=countByKind(RESISTOR_IDS),lc=countByKind(LAMP_IDS);
    if(sc<mission.sourceMin||sc>mission.sourceMax)return[false,`Số nguồn phải từ ${mission.sourceMin} đến ${mission.sourceMax}.`];
    if(mission.sourceRequired&&countCard(mission.sourceRequired)!==1)return[false,`Phải dùng đúng ${CARDS[mission.sourceRequired].name}.`];
    if(rc<mission.resistorMin||rc>mission.resistorMax)return[false,`Số điện trở phải từ ${mission.resistorMin} đến ${mission.resistorMax}.`];
    if(lc<mission.lampMin||lc>mission.lampMax)return[false,`Số đèn phải từ ${mission.lampMin} đến ${mission.lampMax}.`];
    if(mission.totalMax>0){const total=rc+lc;if(total<mission.totalMin||total>mission.totalMax)return[false,`Tổng số tải phải từ ${mission.totalMin} đến ${mission.totalMax}.`];}
  }
  if(mission.meter==='A14'&&countCard('A14')!==1)return[false,'Mạch phải có đúng 1 ampe kế.'];
  if(mission.meter==='A15'&&countCard('A15')!==1)return[false,'Mạch phải có đúng 1 vôn kế.'];
  if(mission.meter!=='A14'&&countCard('A14')>0)return[false,'Không được thêm Ampe kế vào nhiệm vụ này.'];
  if(mission.meter!=='A15'&&countCard('A15')>0)return[false,'Không được thêm Vôn kế vào nhiệm vụ này.'];
  return[true,''];
}

function topologyCheck(g){
  if(connectedGroups(g)!==1)return[false,'Các linh kiện chưa nối thành một mạch duy nhất.'];
  for(let c=1;c<=25;c++)if(SOURCE_IDS.includes(board[c])&&degree(g,c)<1)return[false,`Nguồn ở ô ${c} chưa được nối vào mạch.`];
  for(let c=1;c<=25;c++)if(WIRE_IDS.includes(board[c])){const e=wireValid(board[c],wireDirs(c,board[c]))?'':wireError(c,board[c]);if(e)return[false,e];}
  if(mission.loadConnection==='SERIES'){
    if(countCard('A13')>0)return[false,'Mạch nối tiếp không được có dây T.'];
    for(let c=1;c<=25;c++)if([...LOAD_IDS,'A14'].includes(board[c])&&degree(g,c)<2)return[false,`Ô ${c} ${CARDS[board[c]].name} chưa nằm trên đường mạch kín.`];
  }else if(mission.loadConnection==='PARALLEL'){
    if(countCard('A13')<=0)return[false,'Mạch song song cần ít nhất 1 dây T.'];
    if(!Array.from({length:25},(_,i)=>i+1).some(c=>board[c]==='A13'&&degree(g,c)>=3))return[false,'Dây T chưa tạo điểm phân nhánh.'];
    if(countByKind(LOAD_IDS)<2)return[false,'Mạch song song phải có ít nhất 2 tải.'];
  }
  if(mission.meter==='A14'){
    const cell=Object.entries(board).find(([,v])=>v==='A14');if(!cell||degree(g,+cell[0])<2)return[false,'Ampe kế phải có ít nhất 2 kết nối.'];
  }
  if(mission.meter==='A15'){
    const cell=Object.entries(board).find(([,v])=>v==='A15');if(!cell||degree(g,+cell[0])!==2)return[false,'Vôn kế phải có đúng 2 kết nối đo.'];
  }
  return[true,''];
}

function solveMission(){
  if(mission.mode==='BUILD')return[0,'',true,''];
  const sources=SOURCE_IDS.flatMap(id=>Array(countCard(id)).fill(id));
  const loads=LOAD_IDS.flatMap(id=>Array(countCard(id)).fill(id));
  if(!sources.length||!loads.length)return[0,'',false,'Không tính được kết quả mạch.'];
  if(mission.measure==='CURRENT'){
    const [value,ok]=calcCurrent(sources,mission.sourceConnection,loads,mission.loadConnection);
    if(!ok||value<=0)return[0,'A',false,'Không tính được dòng điện.'];
    return[value,'A',true,''];
  }
  if(mission.measure==='VOLTAGE'){
    if(mission.anyLoadVoltage){
      const targetValues=[];for(const load of loads){const [value,ok]=calcVoltage(sources,mission.sourceConnection,loads,mission.loadConnection,load);if(ok)targetValues.push(value);}
      if(!targetValues.length)return[0,'V',false,'Không tính được điện áp trên tải.'];
      const answer=mission.answer;const match=targetValues.find(v=>Math.abs(v-answer)<=Math.max(Math.abs(answer)*.05,1e-9));
      return[match??targetValues[0],'V',true,''];
    }
    const target=mission.target;
    const [value,ok]=calcVoltage(sources,mission.sourceConnection,loads,mission.loadConnection,target);
    if(!ok||value<=0)return[0,'V',false,'Không tính được điện áp.'];
    return[value,'V',true,''];
  }
  return[0,'',false,'Không xác định đại lượng cần kiểm tra.'];
}

function answerMatch(value,unit){
  if(mission.mode==='BUILD')return true;
  let p=value,a=mission.answer;
  if(mission.answerUnit==='mA'&&unit==='A')p*=1000;
  else if(mission.answerUnit==='A'&&unit==='mA')a*=1000;
  else if(mission.answerUnit!==unit)return false;
  const tol=Math.max(Math.abs(a)*.05,1e-9);
  return Math.abs(p-a)<=tol;
}

function lampRatedCheck(){return true;} // final.ino hiện không bật cờ missionRequireLampRated.

function checkMission(){
  if(!mission){setResult('warn','Hãy tạo nhiệm vụ trước.');return;}
  const [cok,cmsg]=componentCheck();if(!cok){setResult('fail','✗ CHƯA ĐÚNG LINH KIỆN\n'+cmsg);return;}
  const {g,errors}=buildGraph();if(errors.length){setResult('fail','✗ SAI HÌNH DẠNG DÂY\n'+errors[0]);renderAll();return;}
  const [tok,tmsg]=topologyCheck(g);if(!tok){setResult('fail','✗ SAI CÁCH NỐI\n'+tmsg);renderAll();return;}
  if(!lampRatedCheck()){setResult('fail','✗ SAI ĐỊNH MỨC ĐÈN');return;}
  const [value,unit,ok,detail]=solveMission();
  if(!ok){setResult('fail','✗ KHÔNG TÍNH ĐƯỢC\n'+detail);return;}
  if(!answerMatch(value,unit)){
    const actual=unit==='A'?`${fmt(value*1000)} mA`:`${fmt(value)} V`;
    setResult('fail',`✗ NHIỆM VỤ THẤT BẠI\nKết quả hiện tại: ${actual}\nMục tiêu: ${fmt(mission.displayAnswer)} ${mission.answerUnit}`);return;
  }
  const actual=mission.mode==='BUILD'?'':`\nKết quả: ${unit==='A'?fmt(value*1000)+' mA':fmt(value)+' V'}`;
  setResult('success',`✓ MẠCH ĐÚNG\nHOÀN THÀNH NHIỆM VỤ${actual}`);
}

function setResult(type,text){
  const el=$('#result');el.className='result '+type;el.textContent=text;
  $('#status').textContent=type==='success'?'Hoàn thành':type==='fail'?'Cần sửa mạch':type==='warn'?'Cần chú ý':'Sẵn sàng';
}

function generateMission(){
  clearBoard();let candidate=null;
  for(let i=0;i<25;i++){candidate=buildMission();if(candidate&&!isRecent(candidate))break;candidate=null;}
  if(!candidate){setResult('warn','Không tạo được nhiệm vụ mới. Hãy bấm lại TẠO NHIỆM VỤ.');return;}
  mission=candidate;remember(mission);formatMission();setResult('neutral',`Đã tạo nhiệm vụ ${DIFF[selectedMode]}. Lắp mạch trên 25 ô rồi bấm KIỂM TRA MẠCH.`);renderAll();
}
function setMode(mode){selectedMode=mode;document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));mission=null;clearBoard();formatMission();setResult('neutral',`Đã chọn mức ${DIFF[mode]}. Bấm TẠO NHIỆM VỤ.`);}

// Keyboard convenience.
document.addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&selectedCell)removeSelected();if(e.key==='Escape')clearSelection();});

document.querySelectorAll('.mode-btn').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('#newMissionBtn').addEventListener('click',generateMission);
$('#resetBtn').addEventListener('click',()=>{mission=null;clearBoard();formatMission();setResult('neutral','Đã xóa bàn. Chọn mức độ và tạo nhiệm vụ mới.');});
$('#removeBtn').addEventListener('click',removeSelected);
$('#clearSelectionBtn').addEventListener('click',clearSelection);
$('#checkBtn').addEventListener('click',checkMission);
formatMission();renderAll();
