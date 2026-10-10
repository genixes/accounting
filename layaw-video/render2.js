const {chromium}=require(require('child_process').execSync('readlink -f $(npm root -g)/playwright').toString().trim());
const fs=require('fs');
const FPS=30,N=Math.ceil(39.13*FPS),W=+process.argv[2]||4,out=process.argv[3];
fs.mkdirSync(out,{recursive:true});
async function worker(w){
  const b=await chromium.launch({args:['--allow-file-access-from-files']});
  const p=await b.newPage({viewport:{width:1080,height:1350}});
  await p.goto('file://'+process.cwd()+'/video2.html');await p.waitForTimeout(800);
  for(let i=w;i<N;i+=W){
    await p.evaluate(t=>render(t),i/FPS);
    await p.screenshot({path:`${out}/f${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:94});
  }
  await b.close();
}
(async()=>{const t0=Date.now();await Promise.all(Array.from({length:W},(_,i)=>worker(i)));console.log('frames',N,'in',(Date.now()-t0)/1000,'s')})();
