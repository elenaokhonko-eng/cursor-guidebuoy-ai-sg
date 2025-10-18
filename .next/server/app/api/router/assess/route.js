"use strict";(()=>{var e={};e.id=8960,e.ids=[8960],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},92048:e=>{e.exports=require("fs")},19801:e=>{e.exports=require("os")},55315:e=>{e.exports=require("path")},26533:(e,t,i)=>{i.r(t),i.d(t,{originalPathname:()=>h,patchFetch:()=>b,requestAsyncStorage:()=>m,routeModule:()=>d,serverHooks:()=>f,staticGenerationAsyncStorage:()=>g});var r={};i.r(r),i.d(r,{POST:()=>c});var s=i(22060),n=i(72433),o=i(10137),a=i(16097),u=i(82175),l=i(49992);function p(e){try{let t=JSON.stringify(e).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[REDACTED_EMAIL]").replace(/\b([STFG]\d{7}[A-Z])\b/gi,"[REDACTED_NRIC]").replace(/\b(\+?65[- ]?)?\d{4}[- ]?\d{4}\b/g,"[REDACTED_PHONE]").replace(/\b\d{12,16}\b/g,"[REDACTED_ACCOUNT]");return JSON.parse(t)}catch{return e}}async function c(e){try{if(!(0,l.h)((0,l.t)(e,"/api/router/assess"),20,6e4).ok)return a.NextResponse.json({error:"Rate limit exceeded"},{status:429});let{session_token:t,classification:i,responses:r}=await e.json();if(!t||!i||!r)return a.NextResponse.json({error:"Missing required fields"},{status:400});let{text:s}=await (0,u._4)({model:"openai/gpt-4o-mini",prompt:`You are an expert in Singapore FIDReC (Financial Industry Disputes Resolution Centre) eligibility criteria.

FIDReC Eligibility Requirements:
1. Must be an individual consumer (not business)
2. Dispute must be with a Singapore financial institution (FIDReC member)
3. Claim amount must be ≤ SGD 150,000
4. Incident must have occurred within last 6 years
5. Must have first complained to the institution
6. Institution must have rejected or not resolved within 30 days

Dispute Classification:
${JSON.stringify(p(i),null,2)}

User Responses:
${JSON.stringify(p(r),null,2)}

Assess eligibility and provide:
1. is_fidrec_eligible: boolean
2. eligibility_score: 0-100 (confidence in case strength)
3. recommended_path: "fidrec_eligible" | "waitlist" | "self_service" | "not_eligible"
4. reasoning: Array of key points explaining the assessment
5. missing_info: Array of any critical missing information
6. next_steps: Array of 3-5 recommended actions
7. estimated_timeline: String describing expected timeline
8. success_probability: "high" | "medium" | "low"

Path Selection Logic:
- "fidrec_eligible": Meets all criteria, strong case (score ≥ 70)
- "waitlist": Meets criteria but needs professional help (score 40-69)
- "self_service": Doesn't meet FIDReC criteria but can self-resolve
- "not_eligible": Cannot proceed with dispute

Return ONLY valid JSON, no other text.`,maxOutputTokens:1e3}),n=JSON.parse(s);return a.NextResponse.json(n)}catch(e){return console.error("[v0] Assessment error:",e),a.NextResponse.json({error:"Assessment failed"},{status:500})}}let d=new s.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/router/assess/route",pathname:"/api/router/assess",filename:"route",bundlePath:"app/api/router/assess/route"},resolvedPagePath:"/workspaces/cursor-guidebuoy-ai-sg/app/api/router/assess/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:m,staticGenerationAsyncStorage:g,serverHooks:f}=d,h="/api/router/assess/route";function b(){return(0,o.patchFetch)({serverHooks:f,staticGenerationAsyncStorage:g})}},49992:(e,t,i)=>{i.d(t,{h:()=>s,t:()=>n});let r=new Map;function s(e,t=20,i=6e4){let s=Date.now(),n=r.get(e);return!n||n.expiresAt<=s?(r.set(e,{count:1,expiresAt:s+i}),{ok:!0,remaining:t-1,reset:s+i}):n.count>=t?{ok:!1,remaining:0,reset:n.expiresAt}:(n.count+=1,{ok:!0,remaining:Math.max(0,t-n.count),reset:n.expiresAt})}function n(e,t){let i=e.headers.get("x-forwarded-for")||e.ip||"unknown";return`${t}:${i}`}}};var t=require("../../../../webpack-runtime.js");t.C(e);var i=e=>t(t.s=e),r=t.X(0,[2461,9582,2175],()=>i(26533));module.exports=r})();