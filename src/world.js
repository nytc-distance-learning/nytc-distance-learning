import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

// Original procedural NYTC artwork and bounded demonstrations. The LED is a
// visual output model; this module does not evaluate code or solve circuits.
export function createHubWorld({canvas,onProgress,onReady}={}) {
  if(!canvas)throw new Error('createHubWorld needs a canvas.');
  const palette={purple:'#54308c',bright:'#8056b5',lavender:'#c8b5e2',pale:'#eee6f7',ink:'#372b47',white:'#fcf9ff',gold:'#eabf69',mint:'#b5dcc8'};
  const resources=new Set(),materials=new Map(),geometries=new Map();
  const own=v=>(resources.add(v),v);
  const mat=(color,opts={},unique=false)=>{const key=JSON.stringify([color,opts]);if(!unique&&materials.has(key))return materials.get(key);const m=own(new THREE.MeshStandardMaterial({color,roughness:.61,...opts}));if(!unique)materials.set(key,m);return m;};
  const geo=(key,create)=>{if(!geometries.has(key))geometries.set(key,own(create()));return geometries.get(key);};
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-7,7,5,-5,.1,100);
  const root=new THREE.Group();scene.add(root);
  const mesh=(parent,geometry,material,position=[0,0,0],rotation=[0,0,0])=>{const object=new THREE.Mesh(geometry,material);object.position.set(...position);object.rotation.set(...rotation);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;};
  const group=(parent,at=[0,0,0])=>{const g=new THREE.Group();g.position.set(...at);parent.add(g);return g;};
  const box=(p,size,at,color,opts={})=>mesh(p,geo(`box${size}`,()=>new THREE.BoxGeometry(...size)),typeof color==='string'?mat(color,opts):color,at);
  function soft(p,size,at,color,r=.1){
    r=Math.min(r,...size.map(n=>n/2-.001));
    const geometry=geo(`soft${size}-${r}`,()=>{const[w,h,d]=size,s=new THREE.Shape();s.moveTo(-w/2+r,-h/2+r);s.lineTo(w/2-r,-h/2+r);s.lineTo(w/2-r,h/2-r);s.lineTo(-w/2+r,h/2-r);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:3,steps:1});g.center();return g;});
    return mesh(p,geometry,typeof color==='string'?mat(color):color,at);
  }
  const sphere=(p,r,at,color)=>mesh(p,geo(`sphere${r}`,()=>new THREE.SphereGeometry(r,20,12)),typeof color==='string'?mat(color):color,at);
  const cylinder=(p,r,h,at,color,rotation=[0,0,0])=>mesh(p,geo(`cylinder${r}-${h}`,()=>new THREE.CylinderGeometry(r,r,h,24)),typeof color==='string'?mat(color):color,at,rotation);
  const ring=(p,inner,outer,at,color,opacity=1)=>mesh(p,geo(`ring${inner}-${outer}`,()=>new THREE.RingGeometry(inner,outer,48)),own(new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,side:THREE.DoubleSide,depthWrite:false})),at,[-Math.PI/2,0,0]);
  const wire=(p,points,color)=>{const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));return mesh(p,own(new THREE.TubeGeometry(curve,28,.036,7,false)),mat(color,{roughness:.5}));};
  function label(p,content,at,width,color='#54308c',rotation=[-Math.PI/2,0,0]){
    const c=document.createElement('canvas');c.width=1024;c.height=160;const g=c.getContext('2d');g.fillStyle=color;g.font='700 68px Arial, Helvetica, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(content,512,80);
    const t=own(new THREE.CanvasTexture(c));t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
    const m=mesh(p,geo(`label${width}`,()=>new THREE.PlaneGeometry(width,width/6.4)),own(new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,side:THREE.DoubleSide})),at,rotation);m.castShadow=false;return m;
  }
  function platform(parent){
    soft(parent,[9.35,.53,6.6],[0,-.35,0],'#d2c1e7',.22);soft(parent,[9.12,.14,6.42],[0,-.035,0],'#f9f5fc',.065);
    const lines=[];for(let x=-4;x<=4;x++)lines.push(x,.044,-2.85,x,.044,2.85);for(let z=-2.5;z<=2.5;z++)lines.push(-4.1,.044,z,4.1,.044,z);
    const bg=own(new THREE.BufferGeometry());bg.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));const grid=new THREE.LineSegments(bg,own(new THREE.LineBasicMaterial({color:'#dfd1ed',transparent:true,opacity:.65})));parent.add(grid);
    return parent;
  }
  const blinking=[];
  function robot(p,at=[0,0,0],scale=1){
    const r=group(p,at);r.scale.setScalar(scale);const body=group(r);soft(body,[.84,.84,.66],[0,.69,0],palette.white,.13);soft(body,[.61,.43,.075],[0,.64,.365],palette.bright,.035);box(body,[.29,.035,.02],[0,.69,.411],'#d5c0eb');
    soft(body,[1.05,.77,.8],[0,1.37,0],palette.white,.16);soft(body,[.87,.45,.095],[0,1.39,.41],palette.ink,.045);
    const eyes=[];for(const side of[-1,1]){const eye=sphere(body,.063,[side*.21,1.44,.472],mat('#c7f0db',{emissive:'#89bea3',emissiveIntensity:.17}));eyes.push(eye);soft(body,[.19,.38,.37],[side*.59,1.37,0],palette.bright,.085);soft(body,[.18,.38,.22],[side*.53,.73,0],'#b89bd3',.08);cylinder(body,.285,.22,[side*.49,.285,0],palette.ink,[0,0,Math.PI/2]);cylinder(body,.16,.025,[side*.615,.285,0],'#ad8dca',[0,0,Math.PI/2]);}
    mesh(body,geo('smile',()=>new THREE.TorusGeometry(.074,.012,7,20,Math.PI)),mat('#c7f0db'),[0,1.29,.467],[0,0,Math.PI]);cylinder(body,.023,.27,[0,1.91,0],'#b5a7c3');const antenna=sphere(body,.09,[0,2.07,0],palette.gold);
    blinking.push({eyes,antenna,baseY:antenna.position.y,body});return r;
  }
  function codeBlock(p,at,content,color=palette.purple){const g=group(p,at);soft(g,[1.62,.48,.86],[0,.24,0],color,.11);soft(g,[.36,.14,.31],[-.42,.53,0],color,.06);label(g,content,[0,.488,.04],1.3,'#fff8ff');return g;}
  function shrub(p,at,scale=1){const g=group(p,at);g.scale.setScalar(scale);sphere(g,.29,[-.22,.25,0],'#c6b1dd');sphere(g,.35,[.11,.31,0],'#b79bd1');sphere(g,.22,[.38,.21,.04],'#dac9eb');return g;}
  function post(p,at,color=palette.purple){const g=group(p,at);cylinder(g,.025,.65,[0,.32,0],'#c3b7d2');soft(g,[.34,.21,.035],[.17,.5,0],color,.016);sphere(g,.043,[0,.69,0],palette.gold);return g;}

  const worlds={scratch:platform(group(root)),arduino:platform(group(root)),games:platform(group(root))};
  const scratch=worlds.scratch;
  const start=new THREE.Vector3(-2.8,.07,1.1),targets=[new THREE.Vector3(-1.25,.07,1.1),new THREE.Vector3(.45,.07,1.1),new THREE.Vector3(.45,.07,-.65)];
  const pip=robot(scratch,start.toArray(),1.12);pip.rotation.y=Math.PI/2;
  const sparks=targets.map((p,i)=>{const g=group(scratch,[p.x,.07,p.z]);ring(g,.22,.3,[0,.014,0],'#c1a8d8');const s=mesh(g,geo('spark',()=>new THREE.OctahedronGeometry(.23,0)),mat(palette.gold,{metalness:.25,roughness:.3,emissive:'#d79535',emissiveIntensity:.1}),[0,.67,0]);s.rotation.z=Math.PI/7;return{group:g,core:s,baseY:.67,index:i};});
  const pathMat=mat('#b895d1');for(const x of[-2.3,-1.8,-.7,-.1])cylinder(scratch,.045,.015,[x,.06,1.1],pathMat);for(const z of[.58,.08])cylinder(scratch,.045,.015,[.45,.06,z],pathMat);
  ring(scratch,0,.42,[start.x,.056,start.z],palette.mint);label(scratch,'START',[start.x,.06,start.z+.22],.57,'#608b72');
  codeBlock(scratch,[-2.95,.08,-1.85],'MOVE');codeBlock(scratch,[-1.23,.53,-1.85],'TURN',palette.bright);codeBlock(scratch,[.49,.98,-1.85],'REPEAT','#aa8bca');
  post(scratch,[1.0,.06,-.72]);shrub(scratch,[3.8,.06,1.95],.9);shrub(scratch,[-3.7,.06,-2.4],.8);
  const floatingCode=codeBlock(scratch,[2.85,.67,-1.28],'{  }','#9573bc');floatingCode.rotation.y=-.12;

  const arduino=worlds.arduino;
  const board=group(arduino,[-.55,.09,-.2]);soft(board,[6.2,.19,3.85],[0,.095,0],palette.purple,.09);
  [[-2.75,-1.53],[2.75,-1.53],[-2.75,1.53],[2.75,1.53]].forEach(([x,z])=>{ring(board,.11,.17,[x,.195,z],'#d5c2e8');cylinder(board,.105,.016,[x,.197,z],'#362148');});
  function header(x,z,count){box(board,[count*.33,.46,.39],[x+(count-1)*.165,.42,z],palette.ink);for(let i=0;i<count;i++){box(board,[.16,.018,.16],[x+i*.33,.659,z],'#bb9c6b',{metalness:.6});box(board,[.10,.019,.10],[x+i*.33,.67,z],'#231c2e');}}
  header(-1.75,-1.58,13);header(-1.75,1.58,8);header(1.15,1.58,4);
  soft(board,[2.7,.32,.85],[.48,.47,.48],palette.ink,.05);for(const side of[-1,1])for(let i=0;i<10;i++){box(board,[.11,.07,.26],[-.7+i*.26,.39,.48+side*.5],'#bcb4c9',{metalness:.6});box(board,[.07,.18,.06],[-.7+i*.26,.31,.48+side*.61],'#bcb4c9',{metalness:.6});}
  label(board,'CODE',[.48,.638,.47],1.3,'#cbb8df');label(board,'INPUT',[1.75,.202,1.18],1.25,'#efe5f8');label(board,'OUTPUT',[1.3,.202,-1.1],1.5,'#efe5f8');label(board,'MAKE IT LIGHT',[.15,.204,-.17],2.55,'#fff7ff');
  box(board,[1.15,.8,.95],[-2.75,.61,-.77],'#c8c6d2',{metalness:.78,roughness:.28});box(board,[.04,.62,.75],[-3.345,.61,-.77],'#514a60');box(board,[.045,.37,.48],[-3.37,.61,-.77],'#ece8f1');box(board,[.047,.12,.3],[-3.39,.58,-.77],'#b69a67',{metalness:.7});
  for(const z of[.49,1.15]){cylinder(board,.23,.54,[-2.1,.47,z],'#b9bac6');cylinder(board,.20,.025,[-2.1,.754,z],'#e4e1ea');}
  box(board,[.57,.2,.57],[-1.25,.32,-.83],'#382b4c');for(let i=0;i<5;i++)box(board,[.05,.035,.1],[-1.45+i*.10,.235,-1.16],'#c8bed2');
  const led=group(arduino,[2.7,.06,1.38]);cylinder(led,.64,.16,[0,.08,0],'#ece2f6');cylinder(led,.44,.09,[0,.20,0],'#a98bc7');for(const x of[-.13,.13])cylinder(led,.032,.65,[x,.52,0],'#b8b0c4');
  const lensMat=mat('#b89c63',{roughness:.23,transparent:true,opacity:.93,emissive:'#f1bd4e',emissiveIntensity:0},true);cylinder(led,.38,.46,[0,1.0,0],lensMat);sphere(led,.38,[0,1.22,0],lensMat);cylinder(led,.43,.08,[0,.76,0],'#c8af7b');
  const ledGlow=new THREE.PointLight('#efc264',0,3.3,1.5);ledGlow.position.set(0,1.35,0);led.add(ledGlow);
  wire(arduino,[[.75,.76,-1.78],[2.4,1.15,-.1],[2.57,.4,1.38]],'#a37cc3');wire(arduino,[[2.83,.4,1.38],[3.45,.76,2.15],[-.2,.58,1.38]],'#c9bed7');
  const resistor=group(arduino,[1.98,.68,.32]);resistor.rotation.y=-.23;cylinder(resistor,.12,.67,[0,0,0],'#d7bb8a',[0,0,Math.PI/2]);for(const[x,c]of[[-.21,'#a95d72'],[-.07,'#a95d72'],[.08,'#79566a'],[.23,'#b9954f']])cylinder(resistor,.123,.045,[x,0,0],c,[0,0,Math.PI/2]);
  const arduinoPip=robot(arduino,[-3.22,.08,1.54],.72);arduinoPip.rotation.y=Math.PI/3;
  codeBlock(arduino,[2.35,.08,-2.24],'ON / OFF',palette.bright);shrub(arduino,[-3.9,.06,-2.4],.7);

  const games=worlds.games;
  const road=soft(games,[7.7,.035,1.35],[0,.066,1.12],'#e9dff2',.015);soft(games,[1.35,.035,2.7],[2.12,.068,.37],'#e9dff2',.015);
  for(const x of[-3.5,-2.5,-1.5,-.5,.5,1.5,2.5,3.5])box(games,[.32,.012,.045],[x,.09,1.12],'#bda6d3');
  const pad=group(games,[2.12,.08,-1.0]);soft(pad,[1.7,.13,1.58],[0,.065,0],'#ddd0ec',.06);ring(pad,.50,.57,[0,.14,0],palette.mint);label(pad,'DELIVER',[0,.147,.55],1.15,'#79608f');
  const rover=group(games,[-2.9,.1,1.12]);soft(rover,[1.38,.47,1.78],[0,.54,0],palette.purple,.13);soft(rover,[1.09,.58,.92],[0,1.02,.31],palette.white,.13);soft(rover,[.9,.34,.065],[0,1.06,.795],palette.ink,.03);
  for(const x of[-.21,.21])sphere(rover,.063,[x,1.1,.836],'#c7f0db');soft(rover,[1.15,.13,.69],[0,.84,-.5],'#af93cc',.05);
  const wheels=[];for(const x of[-.77,.77])for(const z of[-.55,.10,.66]){const w=cylinder(rover,.31,.22,[x,.31,z],palette.ink,[0,0,Math.PI/2]);wheels.push(w);cylinder(rover,.17,.028,[x+Math.sign(x)*.125,.31,z],'#ad8dca',[0,0,Math.PI/2]);}
  for(const x of[-.43,.43])sphere(rover,.075,[x,.60,.91],palette.gold);
  const cargoMount=group(rover,[0,1.19,-.43]);const parcel=group(games,[-.6,.48,1.12]);soft(parcel,[.62,.62,.62],[0,0,0],palette.gold,.045);box(parcel,[.63,.08,.08],[0,.1,.01],'#a884bf');box(parcel,[.08,.63,.08],[0,.01,.01],'#a884bf');box(parcel,[.08,.08,.63],[0,.01,.01],'#a884bf');
  const coneMat=mat('#b799ce');for(const[x,z]of[[-3.9,-.1],[-1.75,2.25],[3.67,1.9]]){cylinder(games,.25,.07,[x,.11,z],'#d3c0e4');mesh(games,geo('cone',()=>new THREE.ConeGeometry(.19,.49,16)),coneMat,[x,.39,z]);}
  post(games,[2.95,.08,-1.65],palette.bright);codeBlock(games,[-2.75,.08,-1.85],'PLAY',palette.bright);codeBlock(games,[-.85,.54,-1.85],'SOLVE','#a488c1');shrub(games,[3.8,.06,-2.45],.85);

  const floor=mesh(scene,geo('floor',()=>new THREE.PlaneGeometry(40,40)),own(new THREE.ShadowMaterial({opacity:.14})),[0,-.77,0],[-Math.PI/2,0,0]);floor.castShadow=false;
  scene.add(new THREE.AmbientLight('#ffffff',.65));scene.add(new THREE.HemisphereLight('#fffaff','#c2add8',.8));
  const key=new THREE.DirectionalLight('#fff9ef',2.3);key.position.set(-6,12,8);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-9,right:9,top:8,bottom:-8,near:.1,far:35});key.shadow.normalBias=.035;scene.add(key);
  const fill=new THREE.DirectionalLight('#e9d8ff',.65);fill.position.set(8,6,-7);scene.add(fill);

  let renderer=null,lostRenderer=null,controls=null,disposed=false,mode='scratch',view='perspective',raf=0,lastTime=0,clock=0,dirty=true,intersects=true,ready=false;
  let transition=null;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let motionEnabled=!reduced.matches;
  const progress={scratch:{score:0,status:'Help Pip collect three sparks, one block at a time.'},arduino:{score:0,status:'Output LOW. The concept LED is off.'},games:{score:0,status:'Drive the rover to its cargo, then make a delivery.'}};
  const actionLabels={scratch:['Run next block','Run next block','Run next block','Play again'],games:['Drive to cargo','Pick up cargo','Drive to the pad','Deliver cargo','Play again']};
  const totalFor=m=>m==='games'?4:m==='scratch'?3:1;
  const getState=()=>({mode,score:progress[mode].score,total:totalFor(mode),status:progress[mode].status,actionLabel:mode==='arduino'?(progress.arduino.score?'Switch LED off':'Switch LED on'):actionLabels[mode][progress[mode].score],busy:Boolean(transition)});
  const emit=()=>onProgress?.(getState());
  const active=()=>!document.hidden&&intersects;
  const requestFrame=()=>{if(!raf&&!disposed&&renderer&&active())raf=requestAnimationFrame(frame);};
  function paintLed(){const on=progress.arduino.score===1;lensMat.color.set(on?'#f4cf7c':'#a88e66');lensMat.emissiveIntensity=on?1.8:0;ledGlow.intensity=on?1.5:0;}
  function complete(){if(!transition)return;const current=transition;transition=null;current.update(1);current.done();dirty=true;emit();requestFrame();}
  function animate(duration,update,done){transition={elapsed:0,duration,update,done};dirty=true;emit();if(!motionEnabled||!active()||!renderer)complete();else requestFrame();}
  function moveCharacter(character,waypoints,done){
    const route=[character.position.clone(),...waypoints.map(p=>p.clone())];const lengths=[];let distance=0;for(let i=1;i<route.length;i++){distance+=route[i].distanceTo(route[i-1]);lengths.push(distance);}const startYaw=character.rotation.y;
    animate(Math.min(1.35,.52+distance*.14),p=>{const s=p*p*(3-2*p),travel=distance*s;let segment=lengths.findIndex(d=>travel<=d);if(segment<0)segment=lengths.length-1;const prior=segment===0?0:lengths[segment-1],length=lengths[segment]-prior;character.position.lerpVectors(route[segment],route[segment+1],length?(travel-prior)/length:1);const delta=route[segment+1].clone().sub(route[segment]);const targetYaw=Math.atan2(delta.x,delta.z);const angle=Math.atan2(Math.sin(targetYaw-startYaw),Math.cos(targetYaw-startYaw));character.rotation.y=startYaw+angle*Math.min(1,p*5);},done);
  }
  function reset(){
    transition=null;const state=progress[mode];state.score=0;
    if(mode==='scratch'){pip.position.copy(start);pip.rotation.y=Math.PI/2;sparks.forEach(s=>s.group.visible=true);state.status='Help Pip collect three sparks, one block at a time.';}
    if(mode==='arduino'){state.status='Output LOW. The concept LED is off.';paintLed();}
    if(mode==='games'){games.attach(parcel);parcel.position.set(-.6,.48,1.12);parcel.rotation.set(0,0,0);rover.position.set(-2.9,.1,1.12);rover.rotation.set(0,Math.PI/2,0);state.status='Drive the rover to its cargo, then make a delivery.';}
    dirty=true;emit();requestFrame();return getState();
  }
  function action(){
    if(disposed||transition)return getState();const state=progress[mode];
    if(mode==='arduino'){state.score=state.score?0:1;state.status=state.score?'Output HIGH. The concept LED is on.':'Output LOW. The concept LED is off.';paintLed();dirty=true;emit();requestFrame();return getState();}
    if(state.score>=totalFor(mode))return reset();
    if(mode==='scratch'){
      const index=state.score;state.status='Running the next move block…';moveCharacter(pip,[targets[index]],()=>{sparks[index].group.visible=false;state.score=index+1;state.status=state.score===3?'All three sparks collected. Your sequence worked!':`${state.score} of 3 sparks collected. Ready for the next block.`;});
    } else if(state.score===0){state.status='Driving to the cargo…';moveCharacter(rover,[new THREE.Vector3(-.65,.1,1.12)],()=>{state.score=1;state.status='Cargo reached. Pick it up for the delivery.';});}
    else if(state.score===1){
      state.status='Loading the cargo…';const begin=parcel.position.clone(),target=new THREE.Vector3();cargoMount.getWorldPosition(target);games.worldToLocal(target);
      animate(.55,p=>parcel.position.lerpVectors(begin,target,p*p*(3-2*p)),()=>{cargoMount.add(parcel);parcel.position.set(0,0,0);parcel.rotation.set(0,0,0);state.score=2;state.status='Cargo loaded. Drive to the delivery pad.';});
    } else if(state.score===2){state.status='Following the delivery route…';moveCharacter(rover,[new THREE.Vector3(2.12,.1,1.12),new THREE.Vector3(2.12,.1,.55)],()=>{state.score=3;state.status='At the pad. Deliver your cargo to finish.';});}
    else {
      state.status='Unloading the cargo…';games.attach(parcel);const begin=parcel.position.clone(),target=new THREE.Vector3(2.12,.60,-1.0);
      animate(.65,p=>{const eased=p*p*(3-2*p);parcel.position.lerpVectors(begin,target,eased);parcel.position.y+=Math.sin(p*Math.PI)*.75;},()=>{state.score=4;state.status='Delivery complete. You planned, moved, and solved it!';});
    }
    return getState();
  }
  function setMode(next){if(!worlds[next]||disposed)return getState();if(transition)complete();mode=next;for(const[name,g]of Object.entries(worlds))g.visible=name===mode;dirty=true;fitCamera(true);emit();requestFrame();return getState();}
  function setMotion(enabled){motionEnabled=Boolean(enabled)&&!reduced.matches;if(!motionEnabled){if(transition)complete();sparks.forEach(s=>{s.core.position.y=s.baseY;s.core.rotation.y=0;});blinking.forEach(r=>{r.eyes.forEach(e=>e.scale.y=1);r.antenna.position.y=r.baseY;});floatingCode.position.y=.67;}dirty=true;requestFrame();return getState();}
  const directions={perspective:new THREE.Vector3(11,12,15),top:new THREE.Vector3(.01,22,.01),front:new THREE.Vector3(0,8,23)};
  function setView(next){view=directions[next]?next:'perspective';fitCamera(true);dirty=true;requestFrame();}
  function fitCamera(resetPose=false){
    const rect=canvas.getBoundingClientRect(),width=Math.max(1,rect.width||canvas.parentElement?.clientWidth||600),height=Math.max(1,rect.height||canvas.parentElement?.clientHeight||450),aspect=width/height;
    renderer?.setSize(width,height,false);const bounds=new THREE.Box3().setFromObject(worlds[mode]);const center=bounds.getCenter(new THREE.Vector3());
    if(resetPose||!controls){camera.position.copy(center).add(directions[view]);camera.lookAt(center);if(controls){controls.target.copy(center);controls.update();}}
    camera.updateMatrixWorld();let halfWidth=0,halfHeight=0;
    for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);halfWidth=Math.max(halfWidth,Math.abs(p.x));halfHeight=Math.max(halfHeight,Math.abs(p.y));}
    const h=Math.max(halfHeight,halfWidth/aspect)*1.12;camera.left=-h*aspect;camera.right=h*aspect;camera.top=h;camera.bottom=-h;camera.updateProjectionMatrix();dirty=true;
  }
  function frame(timestamp){
    raf=0;if(disposed||!renderer||!active()){lastTime=0;return;}const delta=lastTime?Math.min(.05,Math.max(0,(timestamp-lastTime)/1000)):0;lastTime=timestamp;
    if(motionEnabled){clock+=delta;if(transition){transition.elapsed+=delta;const p=Math.min(1,transition.elapsed/transition.duration);transition.update(p);dirty=true;if(p>=1)complete();}
      if(mode==='scratch'){sparks.forEach(s=>{s.core.position.y=s.baseY+Math.sin(clock*1.8+s.index*.8)*.055;s.core.rotation.y=clock*.38;});floatingCode.position.y=.67+Math.sin(clock*.9)*.055;}
      blinking.forEach((r,i)=>{const blink=(clock+i*.4)%5.2;r.eyes.forEach(e=>e.scale.y=blink>4.95&&blink<5.08?.15:1);r.antenna.position.y=r.baseY+Math.sin(clock*1.4+i)*.018;});dirty=true;
    }
    controls?.update();if(dirty){renderer.render(scene,camera);dirty=false;if(!ready){ready=true;onReady?.({available:true});}}
    if(motionEnabled||transition)requestFrame();
  }
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
    controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.12;controls.minPolarAngle=.03;controls.maxPolarAngle=Math.PI/2-.14;controls.minZoom=.72;controls.maxZoom=1.65;controls.rotateSpeed=.55;controls.zoomSpeed=.65;controls.addEventListener('change',()=>{dirty=true;requestFrame();});
  }catch(error){renderer=null;ready=true;onReady?.({available:false,message:'The 3D scene needs WebGL. All demo controls still work.'});}
  const observer=new ResizeObserver(()=>{if(disposed)return;fitCamera(false);requestFrame();});observer.observe(canvas.parentElement||canvas);
  const visibility=()=>{lastTime=0;if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else{dirty=true;requestFrame();}};document.addEventListener('visibilitychange',visibility);
  let intersection=null;if('IntersectionObserver'in window){intersection=new IntersectionObserver(entries=>{intersects=entries[0]?.isIntersecting??true;lastTime=0;if(!intersects){if(raf)cancelAnimationFrame(raf);raf=0;}else{dirty=true;requestFrame();}},{threshold:.01});intersection.observe(canvas);}
  const motionChange=()=>setMotion(!reduced.matches);reduced.addEventListener('change',motionChange);
  let pointerStart=null;const raycaster=new THREE.Raycaster();
  for(const object of[pip,led,rover,...sparks.map(s=>s.group)])object.userData.action=action;
  const hitAt=event=>{const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const hits=raycaster.intersectObject(worlds[mode],true);for(const hit of hits){let object=hit.object;while(object&&object!==worlds[mode]){if(object.userData.action)return object.userData.action;object=object.parent;}}return null;};
  const pointerDown=e=>{pointerStart=[e.clientX,e.clientY];};const pointerUp=e=>{if(pointerStart&&Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])<5)hitAt(e)?.();pointerStart=null;};const pointerMove=e=>{canvas.style.cursor=hitAt(e)?'pointer':'grab';};
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointermove',pointerMove);
  const contextLost=e=>{e.preventDefault();if(raf)cancelAnimationFrame(raf);raf=0;lostRenderer=renderer;renderer=null;onReady?.({available:false,message:'The 3D view paused. The demo buttons still work.'});};canvas.addEventListener('webglcontextlost',contextLost);
  for(const[name,g]of Object.entries(worlds))g.visible=name===mode;rover.rotation.y=Math.PI/2;fitCamera(true);emit();requestFrame();
  function dispose(){if(disposed)return;disposed=true;if(raf)cancelAnimationFrame(raf);raf=0;observer.disconnect();intersection?.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motionChange);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('webglcontextlost',contextLost);controls?.dispose();resources.forEach(r=>r.dispose?.());renderer?.dispose();lostRenderer?.dispose();scene.clear();canvas.style.cursor='';transition=null;}
  return{setMode,action,reset,setMotion,dispose,getState,setView};
}
