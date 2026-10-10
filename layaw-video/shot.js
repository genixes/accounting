const {chromium}=require(require('child_process').execSync('readlink -f $(npm root -g)/playwright').toString().trim());
(async()=>{
  const file=process.argv[2],times=process.argv.slice(3).map(Number);
  const b=await chromium.launch({args:['--allow-file-access-from-files']});
  const p=await b.newPage({viewport:{width:1080,height:1350}});
  p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('file://'+process.cwd()+'/'+file);await p.waitForTimeout(600);
  for(const t of times){await p.evaluate(t=>render(t),t);await p.screenshot({path:`/tmp/claude-0/-home-user-accounting/d6c5b980-f573-5ed0-aecb-b7a6bba6268c/scratchpad/g_${t}.png`});}
  await b.close();
})();
