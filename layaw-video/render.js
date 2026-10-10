const {chromium}=require(require('child_process').execSync('readlink -f $(npm root -g)/playwright').toString().trim());
const {spawn}=require('child_process');
(async()=>{
  const FPS=30,DUR=39.13,N=Math.ceil(DUR*FPS);
  const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','17','-preset','medium','silent.mp4'],{stdio:['pipe','inherit','inherit']});
  const b=await chromium.launch({args:['--allow-file-access-from-files']});
  const p=await b.newPage({viewport:{width:1080,height:1350}});
  await p.goto('file://'+process.cwd()+'/video.html');await p.waitForTimeout(600);
  for(let i=0;i<N;i++){
    await p.evaluate(t=>render(t),i/FPS);
    const buf=await p.screenshot({type:'jpeg',quality:94});
    if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));
  }
  ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done',N);
})();
