"use strict";(()=>{var e={};e.id=4187,e.ids=[4187],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},92048:e=>{e.exports=require("fs")},19801:e=>{e.exports=require("os")},55315:e=>{e.exports=require("path")},74131:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>m,patchFetch:()=>h,requestAsyncStorage:()=>l,routeModule:()=>c,serverHooks:()=>x,staticGenerationAsyncStorage:()=>g});var i={};r.r(i),r.d(i,{POST:()=>d});var n=r(22060),o=r(72433),s=r(10137),a=r(16097),u=r(82175),p=r(49992);async function d(e){try{if(!(0,p.h)((0,p.t)(e,"/api/router/questions"),20,6e4).ok)return a.NextResponse.json({error:"Rate limit exceeded"},{status:429});let{session_token:t,classification:r}=await e.json();if(!t||!r)return a.NextResponse.json({error:"Missing required fields"},{status:400});let{text:i}=await (0,u._4)({model:"openai/gpt-4o-mini",prompt:`You are an expert in Singapore financial disputes and FIDReC cases.

Based on this dispute classification:
${JSON.stringify(function(e){try{let t=JSON.stringify(e).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[REDACTED_EMAIL]").replace(/\b([STFG]\d{7}[A-Z])\b/gi,"[REDACTED_NRIC]").replace(/\b(\+?65[- ]?)?\d{4}[- ]?\d{4}\b/g,"[REDACTED_PHONE]").replace(/\b\d{12,16}\b/g,"[REDACTED_ACCOUNT]");return JSON.parse(t)}catch{return e}}(r),null,2)}

Generate 5-7 clarifying questions to assess FIDReC eligibility and case strength.

Questions should cover:
1. Singapore institution verification
2. Individual vs business consumer
3. Claim amount
4. Incident timing
5. Prior complaint to institution
6. Product type
7. Evidence availability

Return a JSON object with a "questions" array. Each question should have:
- key: unique identifier (snake_case)
- question: the question text
- type: "radio", "text", "number", or "date"
- options: array of options (for radio type)
- required: boolean

Return ONLY valid JSON, no other text.`,maxOutputTokens:1e3}),n=JSON.parse(i);return a.NextResponse.json(n)}catch(e){return console.error("[v0] Questions generation error:",e),a.NextResponse.json({error:"Failed to generate questions"},{status:500})}}let c=new n.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/router/questions/route",pathname:"/api/router/questions",filename:"route",bundlePath:"app/api/router/questions/route"},resolvedPagePath:"/workspaces/cursor-guidebuoy-ai-sg/app/api/router/questions/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:l,staticGenerationAsyncStorage:g,serverHooks:x}=c,m="/api/router/questions/route";function h(){return(0,s.patchFetch)({serverHooks:x,staticGenerationAsyncStorage:g})}},49992:(e,t,r)=>{r.d(t,{h:()=>n,t:()=>o});let i=new Map;function n(e,t=20,r=6e4){let n=Date.now(),o=i.get(e);return!o||o.expiresAt<=n?(i.set(e,{count:1,expiresAt:n+r}),{ok:!0,remaining:t-1,reset:n+r}):o.count>=t?{ok:!1,remaining:0,reset:o.expiresAt}:(o.count+=1,{ok:!0,remaining:Math.max(0,t-o.count),reset:o.expiresAt})}function o(e,t){let r=e.headers.get("x-forwarded-for")||e.ip||"unknown";return`${t}:${r}`}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),i=t.X(0,[2461,9582,2175],()=>r(74131));module.exports=i})();