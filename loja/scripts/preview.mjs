import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
process.env.MODO_TESTE='1';
const port=Number(process.env.PORT || 4173);
const handlers=Object.fromEntries(await Promise.all(['status','frete','pedido'].map(async n=>[n,(await import('../api/'+n+'.js')).default])));
http.createServer(async(req,res)=>{
try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname.startsWith('/api/')){const h=handlers[pathname.slice(5)];if(h)return await h(req,res);}
 const f=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const data=await readFile(f);
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg'})[path.extname(f)]||'application/octet-stream');
 res.end(data);
}catch(e){res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('SIER preview http://127.0.0.1:'+port));
